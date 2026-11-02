// HOME の城：レベル連動の5段階成長。
// 段階の境界値（minLevel）は【この配列1か所】で管理する。後から変えるときはここだけ直せば全画面に効く。
// 画像は ChatGPT 制作の素材（public/island/castle/castle-stage-1〜5.webp）をそのまま使い、加工しない。
// ショップの装飾（虹・猫・噴水など）は island_config／island_purchases 側の別レイヤーで、城の段階とは無関係。
import { getLevel } from "./island";

export const CASTLE_STAGES = [
    { stage: 1, minLevel: 1, img: "/island/castle/castle-stage-1.webp", w: 112 },   // 小さな赤屋根の建物
    { stage: 2, minLevel: 20, img: "/island/castle/castle-stage-2.webp", w: 142 },  // 左右に塔が増えた小さな城
    { stage: 3, minLevel: 40, img: "/island/castle/castle-stage-3.webp", w: 168 },  // 中央の塔が高い中規模の城
    { stage: 4, minLevel: 60, img: "/island/castle/castle-stage-4.webp", w: 196 },  // 複数の塔を持つ大型の城
    { stage: 5, minLevel: 100, img: "/island/castle/castle-stage-5.webp", w: 214 }, // 最終進化（MAX）
] as const;

export type CastleStage = {
    idx: number;            // 0〜4（配列の添字）
    stage: number;          // 1〜5（表示用）
    img: string;
    w: number;              // 島の上での表示幅(px)
    level: number;
    nextStage: number | null;
    nextAtLevel: number | null;
    toNext: number;         // 次の段階までの残り pt
    progress: number;       // 今の段階内の進捗 %（pt ベース）
    isMax: boolean;
};

/** 累計pt（total_earned）から城の段階を返す。レベル＝既存の getLevel（100ptで1Lv）を使い、計算式は変えない */
export function getCastleStage(totalEarned: number): CastleStage {
    const te = totalEarned || 0;
    const level = getLevel(te);
    let idx = 0;
    for (let i = CASTLE_STAGES.length - 1; i >= 0; i--) {
        if (level >= CASTLE_STAGES[i].minLevel) { idx = i; break; }
    }
    const cur = CASTLE_STAGES[idx];
    const next = CASTLE_STAGES[idx + 1] ?? null;
    const spanStart = (cur.minLevel - 1) * 100;                     // この段階が始まる pt
    const spanEnd = next ? (next.minLevel - 1) * 100 : spanStart;   // 次の段階が始まる pt
    const toNext = next ? Math.max(0, spanEnd - te) : 0;
    const progress = next ? Math.min(100, Math.max(0, ((te - spanStart) / (spanEnd - spanStart)) * 100)) : 100;
    return { idx, stage: cur.stage, img: cur.img, w: cur.w, level, nextStage: next ? next.stage : null, nextAtLevel: next ? next.minLevel : null, toNext, progress, isMax: !next };
}
