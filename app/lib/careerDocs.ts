// ES・ロードマップの記入状況（未記入の人への案内・催促で使う）。判定は各ページの完成判定と同じ項目を見る。
export const ES_FIELDS = [
  "gakuchika_what", "gakuchika_goal", "gakuchika_issue", "gakuchika_improvement", "gakuchika_result",
  "axis_industry", "axis_industry_why", "axis_role", "axis_role_why", "axis_other", "axis_other_why",
  "goal_value", "goal_role", "goal_why", "goal_skills",
  "pr_strength", "pr_experience", "pr_reproducibility",
  "failure_what", "failure_overcome",
];
const RM_STEPS = ["month3", "month6", "year1", "year3", "goal"];
const RM_EXTRA = ["current_self", "life_theme", "role_model", "shadow_future", "this_week_action"];

export type DocState = "none" | "partial" | "done";
export type DocStatus = { state: DocState; filled: number; total: number };
const has = (v: any) => typeof v === "string" && v.trim().length > 0;
const mk = (filled: number, total: number): DocStatus => ({ state: filled === 0 ? "none" : filled >= total ? "done" : "partial", filled, total });

/** ES：20項目のうち書けている数（行が無ければ 0） */
export const esStatus = (row: any): DocStatus => mk(row ? ES_FIELDS.filter((k) => has(row[k])).length : 0, ES_FIELDS.length);
/** ロードマップ：ページの完成度と同じ10項目（現在地・5ステップ・追加4項目） */
export const roadmapStatus = (row: any): DocStatus => mk(row ? [...RM_STEPS, ...RM_EXTRA].filter((k) => has(row[k])).length : 0, 10);

export const DOC_LABEL: Record<DocState, string> = { none: "未記入", partial: "途中", done: "完成" };

/** 催促の通知（タイトルで二重送信を防ぐので、文言を変えるときは両方そろえる） */
export const NUDGE = {
  es: { title: "ESを書こう", link: "/es", icon: "✍️", message: (s: DocStatus) => s.state === "none" ? "まだESが書かれていません。ガクチカ・就活の軸・自己PRなど、今の自分の言葉で書いてみましょう。途中まででも保存できます。" : `ESが途中です（${s.filled}/${s.total}項目）。残りを書いて完成させましょう。` },
  roadmap: { title: "ロードマップを書こう", link: "/roadmap", icon: "🗺️", message: (s: DocStatus) => s.state === "none" ? "まだロードマップが書かれていません。3ヶ月後・半年後・1年後の自分を書いて、進む方向を決めましょう。" : `ロードマップが途中です（完成度${s.filled * 10}%）。残りを書いて完成させましょう。` },
} as const;
