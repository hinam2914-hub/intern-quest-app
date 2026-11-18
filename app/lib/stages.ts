// STAGE：キャリアの階段（事業部別のマイルストーン）。スキル（skills.ts）とは独立
import type { SupabaseClient } from "@supabase/supabase-js";

export type StageDef = {
  id: string; order_no: number; name: string; icon: string; label: string;
  dept: "ALL" | "IP" | "CBSP";                 // 誰に見えるか
  type: "sales_count" | "kpi_dept" | "position" | "closer_sales" | "stage_claim" | "referral_hire" | "kpi_hr" | "script_test" | "kpi_month" | "kpi_streak";
  /** "ref"＝リファラル研修から派生する採用コース（IP）。無指定はメインの階段 */
  track?: "ref";
  param?: string; threshold: number;
  gate?: { x: number; y: number };             // マップ上のゲート位置（無ければパネルのみ）
  claimHint?: string;
};
export type StageState = StageDef & { current: number; cleared: boolean; cleared_at: string | null; pending: boolean };
export type StageResult = {
  dept: string; position: string; stages: StageState[]; current: StageState | null; newCleared: StageState[];
  /** 採用コース（track:"ref"）の今のステップ。コースが無い事業部は null */
  currentRef: StageState | null;
  /** 自分の事業部の月ごとの実績（新しい月が先）。IP＝その月の解除数 */
  months: { ym: string; result: number }[];
};

const BASE_STAGES: StageDef[] = [
  { id: "debut", order_no: 1, name: "営業デビュー", icon: "🏁", label: "初めての獲得（1件）", dept: "ALL", type: "sales_count", threshold: 1, gate: { x: 1112, y: 1082 } },
  // CB / SP
  { id: "cb_1", order_no: 2, name: "商談1件", icon: "💼", label: "商談 累計1件", dept: "CBSP", type: "kpi_dept", threshold: 1, gate: { x: 1400, y: 988 } },
  { id: "cb_4", order_no: 3, name: "商談4件", icon: "💼", label: "商談 累計4件", dept: "CBSP", type: "kpi_dept", threshold: 4, gate: { x: 1650, y: 985 } },
  { id: "closer_debut", order_no: 4, name: "クローザーデビュー", icon: "🏟️", label: "役職がクローザーになる", dept: "CBSP", type: "position", param: "closer", threshold: 1, gate: { x: 1960, y: 1000 } },
  { id: "closer_1", order_no: 5, name: "クローザー1件獲得", icon: "🎯", label: "クローザーとして獲得1件", dept: "CBSP", type: "closer_sales", threshold: 1 },
  { id: "closer_goal", order_no: 6, name: "クローザーゴール", icon: "👑", label: "獲得 累計10件", dept: "CBSP", type: "closer_sales", threshold: 10 },
  // 共通（後半）
  { id: "referral_training", order_no: 7, name: "リファラル研修修了", icon: "🎓", label: "リファラル研修を受けて申告（承認制）", dept: "ALL", type: "stage_claim", threshold: 1, gate: { x: 1245, y: 612 }, claimHint: "受けた日と、研修で決めた最初の行動を書いてください" },
  { id: "referral_1", order_no: 8, name: "リファラル1人", icon: "🤝", label: "リファラル採用 1人", dept: "ALL", type: "referral_hire", threshold: 1, gate: { x: 1500, y: 642 } },
  { id: "referral_3", order_no: 9, name: "リファラル3人", icon: "🤝", label: "リファラル採用 累計3人", dept: "ALL", type: "referral_hire", threshold: 3, gate: { x: 1705, y: 602 } },
  { id: "hr_debut", order_no: 10, name: "人事面談デビュー", icon: "🎤", label: "人事面談 1件（月次KPIのHR面談数）", dept: "ALL", type: "kpi_hr", threshold: 1, gate: { x: 1960, y: 560 } },
];

/** IP事業部の階段：営業配属のあと、スクリプトテスト → 現場 → 獲得 → 解除 → 給料。
 *  自動判定＝スクリプトテスト合格（管理者の合格承認）・初獲得・月の解除数・リファラル採用。それ以外は本人が申告して管理者が承認する。
 *  debut / ip_4 / ip_7 / referral_training / referral_1 は以前と同じIDなので、達成済みの記録はそのまま残る */
const claim = (what: string) => `${what}（申告して承認されると達成）`;
export const IP_STAGES: StageDef[] = [
  { id: "ip_script1", order_no: 1, name: "スクリプトテスト1合格", icon: "📜", label: "スクリプトテスト①に合格", dept: "IP", type: "script_test", param: "test1_passed", threshold: 1 },
  { id: "ip_script2", order_no: 2, name: "スクリプトテスト2合格", icon: "📜", label: "スクリプトテスト②に合格", dept: "IP", type: "script_test", param: "test2_passed", threshold: 1 },
  { id: "ip_script3", order_no: 3, name: "スクリプトテスト3合格", icon: "📜", label: "スクリプトテスト③に合格", dept: "IP", type: "script_test", param: "test3_passed", threshold: 1 },
  { id: "ip_mtg", order_no: 4, name: "全体MTG参加", icon: "🏛️", label: claim("全体MTGに参加"), dept: "IP", type: "stage_claim", threshold: 1, claimHint: "参加した日を書いてください" },
  { id: "ip_kengaku", order_no: 5, name: "見学", icon: "👀", label: claim("見学をする"), dept: "IP", type: "stage_claim", threshold: 1, claimHint: "見学した日と、気づいたことを書いてください" },
  { id: "ip_jissen1", order_no: 6, name: "実践1", icon: "⚔️", label: claim("実践1回目"), dept: "IP", type: "stage_claim", threshold: 1, claimHint: "実践した日と、やってみてどうだったかを書いてください" },
  { id: "ip_jissen2", order_no: 7, name: "実践2", icon: "⚔️", label: claim("実践2回目"), dept: "IP", type: "stage_claim", threshold: 1, claimHint: "実践した日と、やってみてどうだったかを書いてください" },
  { id: "ip_jissen3", order_no: 8, name: "実践3", icon: "⚔️", label: claim("実践3回目"), dept: "IP", type: "stage_claim", threshold: 1, claimHint: "実践した日と、やってみてどうだったかを書いてください" },
  { id: "ip_first_work", order_no: 9, name: "初稼働", icon: "🚀", label: claim("初めて稼働する"), dept: "IP", type: "stage_claim", threshold: 1, claimHint: "初稼働の日を書いてください" },
  { id: "debut", order_no: 10, name: "初獲得", icon: "🏁", label: "初めての獲得（1件）", dept: "IP", type: "sales_count", threshold: 1, gate: { x: 1112, y: 1082 } },
  { id: "ip_4", order_no: 11, name: "4解除達成", icon: "🔓", label: "1か月で4解除", dept: "IP", type: "kpi_month", threshold: 4, gate: { x: 1400, y: 988 } },
  { id: "ip_7", order_no: 12, name: "7解除達成", icon: "🔓", label: "1か月で7解除", dept: "IP", type: "kpi_month", threshold: 7, gate: { x: 1650, y: 985 } },
  { id: "ip_pay10", order_no: 13, name: "給料10万円", icon: "💰", label: claim("月の給料が10万円に届く"), dept: "IP", type: "stage_claim", threshold: 1, claimHint: "達成した月を書いてください" },
  { id: "ip_pay15", order_no: 14, name: "給料15万円", icon: "💰", label: claim("月の給料が15万円に届く"), dept: "IP", type: "stage_claim", threshold: 1, claimHint: "達成した月を書いてください" },
  { id: "ip_pay20", order_no: 15, name: "給料20万円", icon: "💰", label: claim("月の給料が20万円に届く"), dept: "IP", type: "stage_claim", threshold: 1, claimHint: "達成した月を書いてください" },
  { id: "ip_7x3", order_no: 16, name: "3ヶ月連続7解除", icon: "👑", label: "7解除以上の月が3か月続く", dept: "IP", type: "kpi_streak", param: "7", threshold: 3 },
  // 採用コース（リファラル研修参加から派生）
  { id: "referral_training", order_no: 101, track: "ref", name: "リファラル研修参加", icon: "🎓", label: claim("リファラル研修に参加"), dept: "IP", type: "stage_claim", threshold: 1, gate: { x: 1245, y: 612 }, claimHint: "受けた日と、研修で決めた最初の行動を書いてください" },
  { id: "referral_1", order_no: 102, track: "ref", name: "リファラルで1人採用", icon: "🤝", label: "リファラル採用 1人", dept: "IP", type: "referral_hire", threshold: 1, gate: { x: 1500, y: 642 } },
  { id: "ip_ref_work", order_no: 103, track: "ref", name: "採用した子が稼働", icon: "🌱", label: claim("採用した子が稼働する"), dept: "IP", type: "stage_claim", threshold: 1, claimHint: "誰が、いつ稼働したかを書いてください" },
  { id: "ip_ref_4", order_no: 104, track: "ref", name: "稼働した子が4解除", icon: "🔓", label: claim("稼働した子が4解除する"), dept: "IP", type: "stage_claim", threshold: 1, claimHint: "誰が、何月に達成したかを書いてください" },
  { id: "ip_ref_7", order_no: 105, track: "ref", name: "稼働した子が7解除", icon: "🔓", label: claim("稼働した子が7解除する"), dept: "IP", type: "stage_claim", threshold: 1, claimHint: "誰が、何月に達成したかを書いてください" },
  { id: "ip_hr_watch", order_no: 106, track: "ref", name: "人事面談見学", icon: "🎤", label: claim("人事面談を見学する"), dept: "IP", type: "stage_claim", threshold: 1, claimHint: "見学した日を書いてください" },
  { id: "ip_hr_training", order_no: 107, track: "ref", name: "人事研修実施", icon: "📚", label: claim("人事研修を実施する"), dept: "IP", type: "stage_claim", threshold: 1, claimHint: "実施した日を書いてください" },
  { id: "ip_hr_member", order_no: 108, track: "ref", name: "人事メンバーへ", icon: "🏅", label: claim("人事メンバーになる"), dept: "IP", type: "stage_claim", threshold: 1, gate: { x: 1960, y: 560 }, claimHint: "いつから人事メンバーになったかを書いてください" },
];
/** 全ステージ（管理画面の申告承認で名前を引くのに使う） */
export const STAGES: StageDef[] = [...BASE_STAGES, ...IP_STAGES.filter((s) => !BASE_STAGES.some((b) => b.id === s.id))];

/** 事業部コード → 表示する階段 */
export function stagesFor(deptCode: string): StageDef[] {
  if (deptCode === "IP") return IP_STAGES;
  const track = deptCode === "IP" ? "IP" : deptCode === "CB" || deptCode === "SP" ? "CBSP" : null;
  return BASE_STAGES.filter((s) => s.dept === "ALL" || s.dept === track).sort((a, b) => a.order_no - b.order_no);
}

export async function evaluateStages(sb: SupabaseClient, uid: string): Promise<StageResult> {
  const [prof, depts, kpi, sales, recruit, claims, owned, script] = await Promise.all([
    sb.from("profiles").select("department_id, position").eq("id", uid).maybeSingle(),
    sb.from("departments").select("id, code"),
    sb.from("monthly_kpi").select("department_id, result, year_month").eq("user_id", uid),
    sb.from("sales").select("id", { count: "exact", head: true }).eq("user_id", uid),
    sb.from("recruit_progress").select("count, status").eq("user_id", uid).eq("action_type", "hire"),
    sb.from("stage_claims").select("stage_id, status").eq("user_id", uid),
    sb.from("user_stages").select("stage_id, cleared_at").eq("user_id", uid),
    sb.from("script_test_progress").select("*").eq("user_id", uid).maybeSingle(),
  ]);
  const codeOf = new Map((depts.data ?? []).map((d: any) => [d.id as string, d.code as string]));
  const dept = codeOf.get((prof.data as any)?.department_id) ?? "";
  const position = String((prof.data as any)?.position ?? "");
  const kpiByCode: Record<string, number> = {};
  (kpi.data ?? []).forEach((r: any) => { const c = codeOf.get(r.department_id) ?? ""; kpiByCode[c] = (kpiByCode[c] ?? 0) + (Number(r.result) || 0); });
  // 自分の事業部の月ごとの実績（IP＝その月の解除数）
  const byMonth: Record<string, number> = {};
  (kpi.data ?? []).forEach((r: any) => { if ((codeOf.get(r.department_id) ?? "") !== dept || !r.year_month) return; const ym = String(r.year_month).slice(0, 7); byMonth[ym] = (byMonth[ym] ?? 0) + (Number(r.result) || 0); });
  const months = Object.entries(byMonth).map(([ym, result]) => ({ ym, result })).sort((a, b) => (a.ym < b.ym ? 1 : -1));
  const bestMonth = months.reduce((m, x) => Math.max(m, x.result), 0);
  /** n 件以上の月が何か月続いたか（最長） */
  const longestStreak = (n: number) => {
    const idx = months.filter((x) => x.result >= n).map((x) => { const [y, mo] = x.ym.split("-").map(Number); return y * 12 + mo; }).sort((a, b) => a - b);
    let best = 0, run = 0, prev = NaN;
    idx.forEach((i) => { run = i === prev + 1 ? run + 1 : 1; prev = i; if (run > best) best = run; });
    return best;
  };
  const salesN = sales.count ?? 0;
  let hires = 0; (recruit.data ?? []).forEach((r: any) => { if (String(r.status) !== "rejected") hires += r.count ?? 1; });
  const approved = new Set<string>(), pending = new Set<string>();
  (claims.data ?? []).forEach((c: any) => { if (c.status === "approved") approved.add(c.stage_id); else if (c.status === "pending") pending.add(c.stage_id); });
  const ownedMap = new Map((owned.data ?? []).map((o: any) => [o.stage_id as string, o.cleared_at as string]));

  const cur = (s: StageDef): number => {
    switch (s.type) {
      case "sales_count": return salesN;
      case "kpi_dept": return kpiByCode[dept] ?? 0;
      case "position": return position === s.param ? 1 : 0;
      case "closer_sales": return position === "closer" ? salesN : 0;
      case "stage_claim": return approved.has(s.id) ? 1 : 0;
      case "referral_hire": return hires;
      case "kpi_hr": return kpiByCode["HR"] ?? 0;
      case "script_test": return s.param && (script.data as any)?.[s.param] ? 1 : 0;
      case "kpi_month": return bestMonth;
      case "kpi_streak": return longestStreak(Number(s.param) || 0);
      default: return 0;
    }
  };
  const stages: StageState[] = stagesFor(dept).map((s) => {
    const c = cur(s); const was = ownedMap.has(s.id); const cleared = was || c >= s.threshold;
    return { ...s, current: c, cleared, cleared_at: ownedMap.get(s.id) ?? null, pending: pending.has(s.id) };
  });
  const newCleared = stages.filter((s) => s.cleared && !ownedMap.has(s.id));
  if (newCleared.length) {
    await sb.from("user_stages").upsert(newCleared.map((s) => ({ user_id: uid, stage_id: s.id })), { onConflict: "user_id,stage_id" });
    newCleared.forEach((s) => { s.cleared_at = new Date().toISOString(); });
  }
  const current = stages.find((s) => !s.cleared && !s.track) ?? null;
  const currentRef = stages.find((s) => !s.cleared && s.track === "ref") ?? null;
  return { dept, position, stages, current, newCleared, currentRef, months };
}

/** 「4解除まであと2」のような短文 */
export function stageText(s: StageState | null): string {
  if (!s) return "全STAGEクリア！";
  if (s.type === "stage_claim") return s.pending ? `${s.name}：承認待ち` : `${s.name}：達成したら申告`;
  if (s.type === "script_test") return `${s.name}：テストに合格で達成`;
  if (s.type === "kpi_month") return `${s.name}：1か月で${s.threshold}解除（最高 ${s.current}解除）`;
  if (s.type === "kpi_streak") return `${s.name}：あと${Math.max(0, s.threshold - Math.min(s.current, s.threshold))}か月`;
  if (s.type === "position") return `${s.name}：クローザー配属で達成`;
  const left = Math.max(0, s.threshold - Math.min(s.current, s.threshold));
  return `${s.name}まであと${left}`;
}

export async function submitStageClaim(sb: SupabaseClient, uid: string, stageId: string, text: string, url: string) {
  return sb.from("stage_claims").insert({ user_id: uid, stage_id: stageId, description: text.trim(), url: url.trim() || null });
}
