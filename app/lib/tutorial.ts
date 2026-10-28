// Intern Quest 2.0｜STEP 7「はじめての冒険」のチュートリアル進捗。
// DB 変更なしで、ユーザーIDごとに localStorage へ保存する（端末をまたぐ共有は profiles への列追加が必要＝承認待ち）。
// 達成は「実際にその画面を開いたとき」に各画面側から mark() が呼ばれて記録される。チェックを押して達成にはできない。
export type TutorialKey = "home" | "skill" | "quest";
export type TutorialProgress = { home?: string; skill?: string; quest?: string };
export const TUTORIAL_KEYS: TutorialKey[] = ["home", "skill", "quest"];
const storageKey = (userId: string) => `iq_tutorial_${userId}`;

export function readTutorial(userId: string): TutorialProgress {
    try { return JSON.parse(window.localStorage.getItem(storageKey(userId)) || "{}") as TutorialProgress; } catch { return {}; }
}
export function markTutorial(userId: string, key: TutorialKey) {
    try {
        const cur = readTutorial(userId);
        if (cur[key]) return;                          // 一度達成したら上書きしない
        window.localStorage.setItem(storageKey(userId), JSON.stringify({ ...cur, [key]: new Date().toISOString() }));
    } catch { /* ストレージが使えない環境では何もしない */ }
}
export function tutorialAllDone(p: TutorialProgress) { return TUTORIAL_KEYS.every((k) => !!p[k]); }
