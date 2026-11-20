// 島まわりの共通定数（Phase 1：islands / IslandHero / HomeIsland で重複していたものを集約）
// 表示サイズなど画面ごとに違う値はここに置かず、各コンポーネントの preset に持たせる

export { getHouseStage } from "../components/DotHouse";

/** 冒険マップ STEP の名前（0〜6） */
export const STEP_TITLE: Record<number, string> = { 0: "冒険の始まり", 1: "入社・研修", 2: "登竜門", 3: "プレイヤー昇格", 4: "DRMスタート", 5: "キャリア面談", 6: "営業デビュー" };

/** 家6段階の画像（getHouseStage().idx で引く） */
export const HOUSE_IMG: string[] = ["/island/house/0_tent.png", "/island/house/1_cabin.png", "/island/house/2_house.png", "/island/house/3_big.png", "/island/house/4_mansion.png", "/island/house/5_castle.png"];

/** 累計pt → レベル（100pt で 1Lv） */
export function getLevel(totalEarned: number): number { return Math.floor((totalEarned || 0) / 100) + 1; }

export const DEFAULT_AVATAR_ID = "girl_bob_brown";
export function avatarIdOf(avatarConfig: any): string { return avatarConfig && avatarConfig.id ? String(avatarConfig.id) : DEFAULT_AVATAR_ID; }
export function avatarSrc(avatarId: string): string { return "/avatars/" + avatarId + ".png"; }

/** island_config のキー → 絵文字（画像が無いアイテムの表示用） */
export const TREE_EMOJI: Record<string, string> = { tree_sakura: "🌸", tree_yashi: "🌴", tree_momi: "🎄", tree_momiji: "🍁" };
export const DECO_EMOJI: Record<string, string> = { deco_funsui: "⛲", deco_bench: "🪑", deco_gaitou: "💡", deco_yukidaruma: "⛄", deco_torii: "⛩️" };
export const SKY_EMOJI: Record<string, string> = { sky_niji: "🌈", sky_chocho: "🦋", sky_fuusen: "🎈" };
export const ANIMAL_EMOJI: Record<string, string> = { animal_neko: "🐈", animal_inu: "🐕", animal_usagi: "🐇", animal_tori: "🐦" };
export const ANIMAL_NAME: Record<string, string> = { animal_neko: "ねこ", animal_inu: "いぬ", animal_usagi: "うさぎ", animal_tori: "ことり", animal_risu: "りす" };

/** 夜の島（みんなの島・プロフィール）の地面グラデーション */
export const GROUND_BG: Record<string, string> = {
    ground_hanabatake: "linear-gradient(180deg, #86efac, #4ade80)",
    ground_sakura: "linear-gradient(180deg, #a7f3a0, #6ee7a0)",
    ground_yukihara: "linear-gradient(180deg, #f8fafc, #cbd5e1)",
    ground_sunahama: "linear-gradient(180deg, #fde68a, #f59e0b)",
    ground_momiji: "linear-gradient(180deg, #fdba74, #ea580c)",
};
/** 昼の島（home）の上面グラデーション */
export const GROUND_TOP: Record<string, string> = {
    ground_hanabatake: "linear-gradient(180deg, #a3e88a, #6cc255)",
    ground_sakura: "linear-gradient(180deg, #a9ea8c, #74c85a)",
    ground_yukihara: "linear-gradient(180deg, #f4f9ff, #d3e3f2)",
    ground_sunahama: "linear-gradient(180deg, #fbe6a8, #ecc264)",
    ground_momiji: "linear-gradient(180deg, #f6b878, #e07d3a)",
};

/** 画像があるアイテム（島の描画・飾りつけ画面・ショップ一覧で使用）。素材はすべてChatGPT制作の画像をそのまま使う */
export const TREE_IMG: Record<string, string> = { tree_sakura: "/island/trees/tree_sakura.webp", tree_yashi: "/island/trees/tree_yashi.webp", tree_momiji: "/island/trees/tree_momiji.webp", tree_momi: "/island/trees/tree_momi.webp", tree_kadan: "/island/trees/tree_kadan.webp", tree_himawari: "/island/trees/tree_himawari.webp", tree_ringo: "/island/trees/tree_ringo.webp" };
export const DECO_IMG: Record<string, string> = { deco_funsui: "/island/deco/deco_funsui.png", deco_bench: "/island/deco/deco_bench.webp", deco_gaitou: "/island/deco/deco_gaitou.webp", deco_torii: "/island/deco/deco_torii.webp", deco_yukidaruma: "/island/deco/deco_yukidaruma.webp", deco_fuusha: "/island/deco/deco_fuusha.webp", deco_takarabako: "/island/deco/deco_takarabako.webp", deco_ido: "/island/deco/deco_ido.webp", deco_kanban: "/island/deco/deco_kanban.webp", deco_takibi: "/island/deco/deco_takibi.webp", deco_tent: "/island/deco/deco_tent.webp", deco_hata: "/island/deco/deco_hata.webp" };
export const SKY_IMG: Record<string, string> = { sky_niji: "/island/sky/sky_niji.webp", sky_chocho: "/island/sky/sky_chocho.webp", sky_fuusen: "/island/sky/sky_fuusen.webp", sky_hikari: "/island/sky/sky_hikari.webp", sky_kikyuu: "/island/sky/sky_kikyuu.webp", sky_hoshi: "/island/sky/sky_hoshi.webp" };
export const GROUND_IMG: Record<string, string> = { ground_hanabatake: "/island/ground/ground_hanabatake.webp", ground_yukihara: "/island/ground/ground_yukihara.webp", ground_sunahama: "/island/ground/ground_sunahama.webp", ground_momiji: "/island/ground/ground_momiji.webp", ground_ishidatami: "/island/ground/ground_ishidatami.webp", ground_mahoujin: "/island/ground/ground_mahoujin.webp", ground_sakura: "/island/ground/ground_sakura.webp" };
export const ANIMAL_IMG: Record<string, string> = { animal_neko: "/island/animals/animal_neko.webp", animal_inu: "/island/animals/animal_inu.webp", animal_usagi: "/island/animals/animal_usagi.webp", animal_tori: "/island/animals/animal_tori.webp", animal_risu: "/island/animals/animal_risu.webp" };
export const ITEM_IMG: Record<string, string> = { ...TREE_IMG, ...DECO_IMG, ...SKY_IMG, ...GROUND_IMG, ...ANIMAL_IMG };

/** 地面画像のうち「島の土台ごと描かれている」もの（上面＋岩の側面）。この地面のときは、CSSで描く土台の代わりに画像をそのまま島として表示する */
export const GROUND_PLATFORM = new Set(["ground_yukihara", "ground_sunahama", "ground_momiji", "ground_ishidatami", "ground_mahoujin"]);

// ===== 島の飾りつけ（複数配置） =====
// 保存先は従来どおり profiles.island_config。そこに placed（配置リスト）と skyList を足す形で、既存の ground / tree / deco / animal / sky キーも残す。
//   placed: [{ k: アイテムのcss_key, x: 0〜100（左→右）, y: 0〜100（奥→手前）, s: 大きさ倍率, f: 左右反転 }]
// placed が無い（＝まだ飾りつけ画面で保存していない）島は、従来の1個ずつの設定を「いつもの位置」に置いたものとして描く。
export type Placed = { k: string; x: number; y: number; s?: number; f?: boolean };
export type IslandCategory = "ground" | "tree" | "deco" | "animal" | "sky";
export const ISLAND_CATS: { key: IslandCategory; label: string }[] = [
    { key: "ground", label: "🌱 地面" }, { key: "tree", label: "🌳 木・植物" }, { key: "deco", label: "🏡 建物・装飾" }, { key: "animal", label: "🐾 動物" }, { key: "sky", label: "✨ 空・エフェクト" },
];
/** 島に置ける数の上限（種類ごと） */
export const PLACE_LIMIT: Record<IslandCategory, number> = { ground: 1, tree: 6, deco: 6, animal: 3, sky: 2 };
export const SCALE_MIN = 0.6, SCALE_MAX = 1.5;
export function categoryOf(key: string): IslandCategory | null {
    const c = key.split("_")[0];
    return c === "ground" || c === "tree" || c === "deco" || c === "animal" || c === "sky" ? c : null;
}
/** 置いたときの基準の横幅（島の横幅に対する％）。大きさ倍率 s はこれに掛ける */
const BASE_W: Record<string, number> = {
    tree_sakura: 34, tree_yashi: 30, tree_momiji: 34, tree_momi: 26, tree_kadan: 26,
    deco_funsui: 25, deco_bench: 26, deco_gaitou: 13, deco_torii: 27, deco_yukidaruma: 17, deco_fuusha: 24, deco_takarabako: 16, deco_hata: 13,
    animal_neko: 14, animal_inu: 14, animal_usagi: 12, animal_tori: 10, animal_risu: 13,
    tree_himawari: 24, tree_ringo: 32, deco_ido: 22, deco_kanban: 15, deco_takibi: 17, deco_tent: 27,
};
export function baseWidthOf(key: string): number { return BASE_W[key] || (categoryOf(key) === "tree" ? 28 : categoryOf(key) === "animal" ? 13 : 20); }
/** 島の上面（だ円）の中に収める */
export function clampToIsland(x: number, y: number): { x: number; y: number } {
    let dx = (x - 50) / 50, dy = (y - 50) / 50; const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 1) { dx /= d; dy /= d; }
    return { x: Math.round((50 + dx * 50) * 10) / 10, y: Math.round((50 + dy * 50) * 10) / 10 };
}
/** 描画・編集に使う配置リスト。placed があればそれ、無ければ従来の1個ずつの設定をいつもの位置に置いたもの */
export function placedOf(config: any): Placed[] {
    if (config && Array.isArray(config.placed)) {
        return (config.placed as any[]).filter((p) => p && typeof p.k === "string" && typeof p.x === "number" && typeof p.y === "number")
            .map((p) => ({ k: p.k, x: p.x, y: p.y, s: typeof p.s === "number" ? p.s : 1, f: !!p.f }));
    }
    const out: Placed[] = [];
    if (config?.tree) out.push({ k: String(config.tree), x: 14, y: 30, s: 1, f: false });
    if (config?.deco) out.push({ k: String(config.deco), x: 86, y: 60, s: 1, f: false });
    if (config?.animal) out.push({ k: String(config.animal), x: 70, y: 84, s: 1, f: config.animal === "animal_inu" });
    return out;
}
/** 空の飾り（最大2つ）。skyList があればそれ、無ければ従来の sky */
export function skyListOf(config: any): string[] {
    if (config && Array.isArray(config.skyList)) return (config.skyList as any[]).filter((k) => typeof k === "string").slice(0, PLACE_LIMIT.sky);
    return config?.sky ? [String(config.sky)] : [];
}
/** 保存する形に組み立てる。従来のキー（tree / deco / animal / sky）も先頭の1個で埋めておく（古い画面との互換用） */
export function buildIslandConfig(prev: any, ground: string | null, skies: string[], placed: Placed[]): Record<string, any> {
    const c: Record<string, any> = { ...(prev || {}) };
    delete c.ground; delete c.tree; delete c.deco; delete c.animal; delete c.sky;
    if (ground) c.ground = ground;
    if (skies[0]) c.sky = skies[0];
    c.skyList = skies.slice(0, PLACE_LIMIT.sky);
    c.placed = placed.map((p) => ({ k: p.k, x: p.x, y: p.y, s: Math.round((p.s || 1) * 100) / 100, f: !!p.f }));
    (["tree", "deco", "animal"] as const).forEach((cat) => { const f = placed.find((p) => categoryOf(p.k) === cat); if (f) c[cat] = f.k; });
    c.v = 2;
    return c;
}

export type IslandConfig = Record<string, any>;

/** みんなの島カードの称号（最大2つ）。islands 一覧とロビーの島フォーカスで共用 */
export function titleBadges(i: { stepNo: number; streak: number; level: number }): string[] {
    const t: string[] = [];
    if (i.stepNo >= 6) t.push("⚔️ 営業デビュー");
    if (i.streak >= 30) t.push("🔥 30日連続");
    else if (i.streak >= 7) t.push("🔥 " + i.streak + "日連続");
    if (i.level >= 20) t.push("⭐ トップランカー");
    else if (i.level >= 10) t.push("💎 努力家");
    if (t.length === 0) t.push("🌱 かけだし冒険者");
    return t.slice(0, 2);
}
