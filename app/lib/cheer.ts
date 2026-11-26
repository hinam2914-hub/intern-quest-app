// 応援掲示板の「何を載せるか」の共通部分。応援掲示板ページ（/cheer）と、みんなの島などに置く小窓（CheerTeaser）で同じ判定を使う。

/** ポイント履歴の理由 → 掲示板に載せる文言。null は載せない */
export const CHEER_LABEL = (r: string): { text: string; icon: string; cat: string } | null => {
  if (r.includes("challenge_complete")) return { text: "ライフチャレンジを達成！", icon: "🎯", cat: "other" };
  if (r.includes("es_first_completed")) return { text: "ESを完成させた！", icon: "📝", cat: "learn" };
  if (r.includes("thinking_ippon_received")) return { text: "IPPONを獲得！", icon: "🎤", cat: "other" };
  if (r.startsWith("course_受講")) return { text: "講座を受講！", icon: "🎓", cat: "learn" };
  if (r.startsWith("course_講師")) return { text: "講師デビュー！", icon: "🧑‍🏫", cat: "learn" };
  if (r.includes("recruit_入社")) return { text: "新メンバーを入社に導いた！", icon: "🎉", cat: "sales" };
  if (r.includes("recruit_採用面談")) return { text: "採用面談を実施！", icon: "🤝", cat: "sales" };
  if (r.includes("content_complete")) return { text: "学習コンテンツを完了！", icon: "📚", cat: "learn" };
  if (r.includes("スクリプト") && r.includes("合格")) return { text: "スクリプトテストに合格！", icon: "🎤", cat: "learn" };
  if (r.includes("kpi")) return { text: "月間KPIを達成！", icon: "🏆", cat: "sales" };
  // ── ここから 11/26 に追加した分（サーバー側 cheer_react の一覧＝like_points.sql と同じ文言にすること）
  if (r === "quiz_passed") return { text: "確認テストに合格！", icon: "✅", cat: "learn" };
  if (r === "thanks_received") return { text: "THANKSをもらった！", icon: "💌", cat: "other" };
  if (r === "mentor_quest") return { text: "メンタークエストを達成！", icon: "🗡️", cat: "learn" };
  if (r === "team_achievement") return { text: "チーム目標を達成！", icon: "🚩", cat: "sales" };
  if (r === "streak_bonus") return { text: "日報の連続提出ボーナスを獲得！", icon: "🔥", cat: "other" };
  if (r === "mtg_report") return { text: "MTG報告を提出！", icon: "📋", cat: "learn" };
  if (r === "advice_approved") return { text: "アドバイスが採用された！", icon: "💡", cat: "other" };
  if (r.startsWith("タスク報告書承認")) return { text: "タスクをやり遂げた！", icon: "📌", cat: "other" };
  if (r.startsWith("KKC")) return { text: "解決案が採用された！", icon: "💡", cat: "other" };
  if (r.startsWith("HRキャンペーン承認")) return { text: "HRキャンペーンを達成！", icon: "🎉", cat: "sales" };
  return null;
};

export const cheerWhen = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  return diff < 1 ? "さっき" : diff < 24 ? `${diff}時間前` : `${Math.floor(diff / 24)}日前`;
};

export type CheerExtra = { uid: string; created_at: string; text: string; icon: string; cat: string };
/** ポイント履歴に出ない出来事（ステージ達成・称号・テスト合格・冒険マップ・新しい仲間）を、掲示板用に集める。
 *  読み取りだけ。読めない表・無い列があっても、その種類を飛ばすだけで掲示板は止めない。
 *  営業の成果は「節目の名前」だけを出し、件数・金額・給料の節目（ip_pay*）は出さない */
export async function loadCheerExtras(sb: any, sinceIso: string, stageName: (id: string) => string | null): Promise<CheerExtra[]> {
  const out: CheerExtra[] = [];
  const safe = async (fn: () => Promise<void>) => { try { await fn(); } catch { /* この種類は載せない */ } };
  await Promise.all([
    safe(async () => {
      const { data } = await sb.from("user_stages").select("user_id, stage_id, cleared_at").gte("cleared_at", sinceIso).order("cleared_at", { ascending: false }).limit(200);
      (data || []).forEach((r: any) => {
        if (!r.cleared_at || String(r.stage_id).startsWith("ip_pay")) return;
        const n = stageName(r.stage_id); if (!n) return;
        out.push({ uid: r.user_id, created_at: r.cleared_at, text: `「${n}」を達成！`, icon: "🏁", cat: "sales" });
      });
    }),
    safe(async () => {
      const { data } = await sb.from("user_badges").select("user_id, granted_at, badges(name)").gte("granted_at", sinceIso).order("granted_at", { ascending: false }).limit(200);
      (data || []).forEach((r: any) => { if (r.granted_at && r.badges?.name) out.push({ uid: r.user_id, created_at: r.granted_at, text: `称号「${r.badges.name}」を獲得！`, icon: "🎖️", cat: "other" }); });
    }),
    safe(async () => {
      const { data } = await sb.from("test_attempts").select("user_id, created_at").eq("passed", true).gte("created_at", sinceIso).order("created_at", { ascending: false }).limit(200);
      (data || []).forEach((r: any) => { if (r.created_at) out.push({ uid: r.user_id, created_at: r.created_at, text: "テストに合格！", icon: "📜", cat: "learn" }); });
    }),
    safe(async () => {
      const { data } = await sb.from("journey_submissions").select("user_id, step_no, created_at").eq("status", "approved").gte("created_at", sinceIso).order("created_at", { ascending: false }).limit(200);
      (data || []).forEach((r: any) => { if (r.created_at && r.step_no) out.push({ uid: r.user_id, created_at: r.created_at, text: `冒険マップ STEP${r.step_no} をクリア！`, icon: "🗺️", cat: "learn" }); });
    }),
    safe(async () => {
      const { data } = await sb.from("profiles").select("id, created_at").eq("is_active", true).gte("created_at", sinceIso).order("created_at", { ascending: false }).limit(100);
      (data || []).forEach((r: any) => { if (r.created_at) out.push({ uid: r.id, created_at: r.created_at, text: "Intern Questに仲間入り！", icon: "🌱", cat: "other" }); });
    }),
  ]);
  return out;
}
