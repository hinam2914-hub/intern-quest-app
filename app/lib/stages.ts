// STAGE：キャリアの階段（事業部別のマイルストーン）。スキル（skills.ts）とは独立
import type { SupabaseClient } from "@supabase/supabase-js";

export type StageDef = {
  id: string; order_no: number; name: string; icon: string; label: string;
  dept: "ALL" | "IP" | "CBSP";                 // 誰に見えるか
  type: "sales_count" | "kpi_dept" | "position" | "closer_sales" | "stage_claim" | "referral_hire" | "kpi_hr";
  param?: string; threshold: number;
  gate?: { x: number; y: number };             // マップ上のゲート位置（無ければパネルのみ）
  claimHint?: string;
};
export type StageState = StageDef & { current: number; cleared: boolean; cleared_at: string | null; pending: boolean };
export type StageResult = { dept: string; position: string; stages: StageState[]; current: StageState | null; newCleared: StageState[] };

export const STAGES: StageDef[] = [
  { id: "debut", order_no: 1, name: "営業デビュー", icon: "🏁", label: "初めての獲得（1件）", dept: "ALL", type: "sales_count", threshold: 1, gate: { x: 1112, y: 1082 } },
  // IP
  { id: "ip_4", order_no: 2, name: "4解除", icon: "🔓", label: "解除 累計4件", dept: "IP", type: "kpi_dept", threshold: 4, gate: { x: 1400, y: 988 } },
  { id: "ip_7", order_no: 3, name: "7解除", icon: "🔓", label: "解除 累計7件", dept: "IP", type: "kpi_dept", threshold: 7, gate: { x: 1650, y: 985 } },
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

/** 事業部コード → 表示する階段 */
export function stagesFor(deptCode: string): StageDef[] {
  const track = deptCode === "IP" ? "IP" : deptCode === "CB" || deptCode === "SP" ? "CBSP" : null;
  return STAGES.filter((s) => s.dept === "ALL" || s.dept === track).sort((a, b) => a.order_no - b.order_no);
}

export async function evaluateStages(sb: SupabaseClient, uid: string): Promise<StageResult> {
  const [prof, depts, kpi, sales, recruit, claims, owned] = await Promise.all([
    sb.from("profiles").select("department_id, position").eq("id", uid).maybeSingle(),
    sb.from("departments").select("id, code"),
    sb.from("monthly_kpi").select("department_id, result").eq("user_id", uid),
    sb.from("sales").select("id", { count: "exact", head: true }).eq("user_id", uid),
    sb.from("recruit_progress").select("count, status").eq("user_id", uid).eq("action_type", "hire"),
    sb.from("stage_claims").select("stage_id, status").eq("user_id", uid),
    sb.from("user_stages").select("stage_id, cleared_at").eq("user_id", uid),
  ]);
  const codeOf = new Map((depts.data ?? []).map((d: any) => [d.id as string, d.code as string]));
  const dept = codeOf.get((prof.data as any)?.department_id) ?? "";
  const position = String((prof.data as any)?.position ?? "");
  const kpiByCode: Record<string, number> = {};
  (kpi.data ?? []).forEach((r: any) => { const c = codeOf.get(r.department_id) ?? ""; kpiByCode[c] = (kpiByCode[c] ?? 0) + (Number(r.result) || 0); });
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
  const current = stages.find((s) => !s.cleared) ?? null;
  return { dept, position, stages, current, newCleared };
}

/** 「4解除まであと2」のような短文 */
export function stageText(s: StageState | null): string {
  if (!s) return "全STAGEクリア！";
  if (s.type === "stage_claim") return s.pending ? `${s.name}：承認待ち` : `${s.name}：研修を受けたら申告`;
  if (s.type === "position") return `${s.name}：クローザー配属で達成`;
  const left = Math.max(0, s.threshold - Math.min(s.current, s.threshold));
  return `${s.name}まであと${left}`;
}

export async function submitStageClaim(sb: SupabaseClient, uid: string, stageId: string, text: string, url: string) {
  return sb.from("stage_claims").insert({ user_id: uid, stage_id: stageId, description: text.trim(), url: url.trim() || null });
}
