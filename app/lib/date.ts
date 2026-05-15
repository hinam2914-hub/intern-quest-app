// JST（日本時間）でフォーマットする共通ヘルパー
// DB保存はUTC、表示は必ずJSTに揃える

/**
 * 日時を「2026/5/15 17:06」形式で返す
 */
export const formatJST = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

/**
 * 日付のみ「2026/5/15」形式で返す
 */
export const formatJSTDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "numeric",
        day: "numeric",
    });
};

/**
 * 時刻のみ「17:06」形式で返す
 */
export const formatJSTTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleTimeString("ja-JP", {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
    });
};

/**
 * 短い日時「5/15 17:06」形式で返す
 */
export const formatJSTShort = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};