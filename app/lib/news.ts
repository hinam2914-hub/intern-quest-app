// お知らせ（運営からの告知）の共通定義。既存の announcements テーブルを使う（title / content / is_active は従来のまま、列を追加して拡張）。
// 個別通知（notifications テーブル・/notifications）とは別物：こちらは全員に同じ内容を出す告知。
export type NewsCategory = "update" | "quest" | "event" | "important" | "maintenance";
export const NEWS_CATEGORIES: { key: NewsCategory; label: string; img: string; color: string }[] = [
    { key: "update", label: "機能アップデート", img: "/news/cat_update.webp", color: "#2563eb" },
    { key: "quest", label: "新クエスト", img: "/news/cat_quest.webp", color: "#0e7490" },
    { key: "event", label: "イベント", img: "/news/cat_event.webp", color: "#b45309" },
    { key: "important", label: "重要なお知らせ", img: "/news/cat_important.webp", color: "#dc2626" },
    { key: "maintenance", label: "メンテナンス", img: "/news/cat_maintenance.webp", color: "#4b5563" },
];
export const categoryInfo = (k: string | null | undefined) => NEWS_CATEGORIES.find((c) => c.key === k) || NEWS_CATEGORIES[3];
export const NEWS_IMG = { bell: "/news/bell.webp", ribbon: "/news/title_ribbon.webp" };

export type News = { id: string; title: string; content: string; category: string; publish_at: string; is_important: boolean; link_url: string | null; is_active?: boolean; created_at?: string };

/** 遷移先として許可するのはアプリ内のパスだけ（"/" 始まり。"//" や "http:" などの外部URL、スクリプトは不可） */
export function safeLink(url: string | null | undefined): string | null {
    const u = (url || "").trim();
    if (!u) return null;
    return /^\/(?!\/)[A-Za-z0-9\-_.~/?=&%#\[\]]*$/.test(u) && u.length <= 200 ? u : null;
}
export function newsDate(iso: string): string {
    const d = new Date(iso); if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
