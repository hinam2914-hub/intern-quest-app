// 管理画面（王国統括司令室）の共通テーマ。色とアイコン素材をここに集約。
// ICONS: ChatGPT素材が納品されたらパスを設定（null の間は絵文字で表示）。例 "/admin/crown.webp"
export const AC = {
    royal: "#1454B8",
    deep: "#102F70",
    gold: "#D9A441",
    lightGold: "#F5D77E",
    ivory: "#FFF9ED",
    text: "#172B50",
    green: "#22B981",
    purple: "#8855D5",
    pink: "#E86CA8",
} as const;

export const ADMIN_ICONS: Record<string, string | null> = {
    crown: "/admin/crown.webp",             // サイドバー上部の王冠エンブレム
    crystal: "/admin/sibyl_crystal.webp",   // SIBYLの水晶玉
    kpi_report: "/admin/kpi_report.webp",   // KPI: 日報未提出
    kpi_rate: "/admin/kpi_rate.webp",       // KPI: 提出率
    kpi_grow: "/admin/kpi_grow.webp",       // KPI: 育成優先
    kpi_move: "/admin/kpi_move.webp",       // KPI: 配置変更
    bell: "/admin/bell.webp",               // 管理アクション
    horn: "/admin/horn.webp",               // お知らせ
};
