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

/**
 * 日報の連続提出日数(streak)を submissions の created_at 配列から算出する。
 * - JST基準。1日でも提出が空いたら連続は途切れる（厳密リセット）。
 * - 今日(JST)を起点に過去へ遡り、連続して提出がある日数を数える。
 * - 今日まだ未提出でも、昨日までの連続は維持する（深夜0時で即0にはしない）。
 * 累積加算ではなく毎回ソース(submissions)から算出するため、ズレが蓄積しない。
 */
export const computeReportStreak = (
    createdAts: (string | null | undefined)[],
    now: Date = new Date()
): number => {
    const toYmd = (d: Date): string => d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }); // "YYYY-MM-DD"
    const days = new Set<string>();
    for (const c of createdAts) {
        if (c) days.add(toYmd(new Date(c)));
    }
    // 今日(JST)の暦日を起点に、UTC正午アンカーで1日ずつ遡る（端末TZに依存しない）
    const [y, m, d] = toYmd(now).split("-").map(Number);
    const cursor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const cursorYmd = (): string => {
        const yy = cursor.getUTCFullYear();
        const mm = String(cursor.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(cursor.getUTCDate()).padStart(2, "0");
        return `${yy}-${mm}-${dd}`;
    };
    let streak = 0;
    if (!days.has(cursorYmd())) cursor.setUTCDate(cursor.getUTCDate() - 1); // 今日未提出なら昨日から数え始める
    while (days.has(cursorYmd())) {
        streak++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return streak;
};