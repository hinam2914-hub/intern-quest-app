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
  return null;
};

export const cheerWhen = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  return diff < 1 ? "さっき" : diff < 24 ? `${diff}時間前` : `${Math.floor(diff / 24)}日前`;
};
