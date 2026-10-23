// Intern Quest 2.0｜レイヤー式アバターのカタログと設定
//
// 画像の規約（ChatGPT 側で制作する実装用 PNG）
//   - すべて 1024×1024 の透過 PNG、同じ座標系（素体の足元 y≈960、頭頂 y≈120、中心 x=512）
//   - 保存先：public/avatar/<layer>/<id>.png   例：public/avatar/hair_front/f_long.png
//   - 髪型は「後ろ髪」「前髪」の 2 枚に分け、髪色は同じ形状で色違いを用意する（<id>__<color>.png）
//   - 衣装は職業×性別で「背面」「前面」の 2 枚
// ここでは「存在しうるパーツ」をすべて定義し、ファイルが未納品のものは src を null にしておく。
// 画面は src が null のパーツを「準備中」として表示し、選択はできるが描画はしない。

import type { JobKey } from "../../onboarding/job/page";

export type Layer = "hair_back" | "body" | "outfit_back" | "outfit_front" | "hair_front" | "head" | "cape" | "weapon" | "accessory";
/** 描画順（下→上）。マントは衣装の背面側に入る想定だが、素材の作り方で前にも出せるよう独立レイヤーにする */
export const LAYER_ORDER: Layer[] = ["cape", "hair_back", "body", "outfit_back", "outfit_front", "hair_front", "head", "weapon", "accessory"];

export type Base = "f" | "m";
export type Part = { id: string; label: string; src: string | null; swatch?: string };

export const SKIN: Part[] = [
    { id: "light", label: "ライト", src: "ok", swatch: "#fde7d2" },
    { id: "fair", label: "フェア", src: "ok", swatch: "#f5d3b4" },
    { id: "tan", label: "タン", src: "ok", swatch: "#d9a97e" },
    { id: "deep", label: "ディープ", src: "ok", swatch: "#9c6a46" },
];
export const HAIR_COLOR: Part[] = [
    { id: "brown", label: "ブラウン", src: "ok", swatch: "#8a5a3a" },
    { id: "black", label: "ブラック", src: "ok", swatch: "#2b2630" },
    { id: "darkbrown", label: "ダークブラウン", src: "ok", swatch: "#5a3a26" },
    { id: "beige", label: "ベージュ", src: "ok", swatch: "#d9b98f" },
    { id: "pink", label: "ピンク", src: "ok", swatch: "#ee7fa6" },
    { id: "ash", label: "アッシュ", src: "ok", swatch: "#a8a4ad" },
    { id: "blue", label: "ブルー", src: "ok", swatch: "#4c6fe0" },
];
export const HAIR: Record<Base, Part[]> = {
    f: [
        { id: "f_long", label: "ロング", src: "ok" }, { id: "f_semilong", label: "セミロング", src: "ok" }, { id: "f_pony", label: "ポニーテール", src: "ok" },
        { id: "f_bun", label: "おだんご", src: "ok" }, { id: "f_twin", label: "ツインテール", src: "ok" }, { id: "f_short", label: "ショート", src: "ok" },
    ],
    m: [
        { id: "m_short", label: "ショート", src: "ok" }, { id: "m_mash", label: "マッシュ", src: "ok" }, { id: "m_center", label: "センターパート", src: "ok" },
        { id: "m_wolf", label: "ウルフ", src: "ok" }, { id: "m_spiky", label: "スパイキー", src: "ok" }, { id: "m_long", label: "ロング", src: "ok" },
    ],
};

/** 職業ごとの装備候補（デザイン資料のパーツ名に対応）。src は未納品のため null */
type JobGear = { outfit: Part[]; head: Part[]; cape: Part[]; weapon: Part[]; accessory: Part[] };
const none = (label = "なし"): Part => ({ id: "none", label, src: "" });
export const GEAR: Record<JobKey, JobGear> = {
    knight: {
        outfit: [{ id: "knight_default", label: "ナイトの鎧", src: "ok" }],
        head: [none(), { id: "knight_shoulder", label: "肩装飾", src: null }],
        cape: [none(), { id: "knight_cape", label: "青のマント", src: null }],
        weapon: [none(), { id: "knight_sword", label: "剣", src: null }, { id: "knight_sword_shield", label: "剣と盾", src: null }],
        accessory: [none(), { id: "knight_ribbon_blue", label: "青リボン", src: null }, { id: "knight_ribbon_white", label: "白リボン", src: null }, { id: "knight_star", label: "星の飾り", src: null }],
    },
    mage: {
        outfit: [{ id: "mage_default", label: "魔法使いのローブ", src: "ok" }],
        head: [none(), { id: "mage_hat", label: "魔法帽子", src: null }, { id: "mage_hat_star", label: "帽子（星リボン）", src: null }, { id: "mage_hat_moon", label: "帽子（月のチャーム）", src: null }],
        cape: [none(), { id: "mage_cape", label: "紫のマント", src: null }],
        weapon: [none(), { id: "mage_staff", label: "杖（基本）", src: null }, { id: "mage_staff_star", label: "杖（星）", src: null }, { id: "mage_staff_moon", label: "杖（月）", src: null }, { id: "mage_staff_crystal", label: "杖（水晶）", src: null }],
        accessory: [none(), { id: "mage_ribbon", label: "リボン", src: null }, { id: "mage_book", label: "魔導書", src: null }, { id: "mage_glasses", label: "メガネ", src: null }],
    },
    archer: {
        outfit: [{ id: "archer_default", label: "アーチャーの軽装", src: "ok" }],
        head: [none(), { id: "archer_hat", label: "羽根付き帽子", src: null }],
        cape: [none(), { id: "archer_cape", label: "緑のマント", src: null }],
        weapon: [none(), { id: "archer_bow", label: "弓（基本）", src: null }, { id: "archer_bow_alt", label: "弓（別デザイン）", src: null }],
        accessory: [none(), { id: "archer_leaf", label: "葉のブローチ", src: null }, { id: "archer_pouch", label: "腰ポーチ", src: null }, { id: "archer_quiver", label: "矢筒", src: null }, { id: "archer_flower", label: "花飾り", src: null }],
    },
    healer: {
        outfit: [{ id: "healer_default", label: "ヒーラーの衣装", src: "ok" }],
        head: [none(), { id: "healer_hat", label: "聖帽", src: null }],
        cape: [none(), { id: "healer_cape", label: "白のマント", src: null }],
        weapon: [none(), { id: "healer_staff", label: "杖（基本）", src: null }, { id: "healer_staff_flower", label: "杖（花）", src: null }, { id: "healer_staff_moon", label: "杖（月）", src: null }, { id: "healer_staff_wing", label: "杖（翼）", src: null }, { id: "healer_staff_crystal", label: "杖（水晶）", src: null }],
        accessory: [none(), { id: "healer_ribbon", label: "リボン", src: null }, { id: "healer_cross", label: "十字架の飾り", src: null }, { id: "healer_book", label: "聖書", src: null }, { id: "healer_glasses", label: "メガネ", src: null }],
    },
    rogue: {
        outfit: [{ id: "rogue_default", label: "ローグの軽装", src: "ok" }],
        head: [none(), { id: "rogue_hood", label: "フード", src: null }],
        cape: [none(), { id: "rogue_cape", label: "黒のマント", src: null }],
        weapon: [none(), { id: "rogue_daggers", label: "短剣（二刀）", src: null }, { id: "rogue_knives", label: "投げナイフ", src: null }],
        accessory: [none(), { id: "rogue_scarf", label: "スカーフ", src: null }, { id: "rogue_brooch", label: "ブローチ", src: null }, { id: "rogue_pendant", label: "ペンダント", src: null }, { id: "rogue_armband", label: "アームバンド", src: null }],
    },
    paladin: {
        outfit: [{ id: "paladin_default", label: "パラディンの聖鎧", src: "ok" }],
        head: [none(), { id: "paladin_tiara", label: "ティアラ", src: null }, { id: "paladin_crown", label: "冠", src: null }, { id: "paladin_feather", label: "羽飾り", src: null }],
        cape: [none(), { id: "paladin_cape", label: "青のマント", src: null }],
        weapon: [none(), { id: "paladin_sword", label: "聖剣（基本）", src: null }, { id: "paladin_sword_shield", label: "聖剣と盾", src: null }, { id: "paladin_sword_deco", label: "聖剣（装飾）", src: null }],
        accessory: [none(), { id: "paladin_clasp", label: "マント留め", src: null }, { id: "paladin_cross", label: "十字架のペンダント", src: null }, { id: "paladin_medal", label: "勲章", src: null }],
    },
};

/** profiles.avatar_config に保存する形。id は従来の preset ID を残し、既存の表示箇所（avatar_config.id）を壊さない */
export type AvatarConfig = {
    type: "layered"; v: 1;
    /** 従来のプリセット ID（みんなの島・プロフィール等の既存表示用） */
    id: string;
    base: Base; skin: string; hair: string; hairColor: string;
    outfit: string; head: string; cape: string; weapon: string; accessory: string;
};
export const DEFAULT_PRESET = { f: "girl_bob_brown", m: "boy_short_black" } as const;

export function defaultConfig(job: JobKey, base: Base = "f", presetId?: string): AvatarConfig {
    const g = GEAR[job];
    return { type: "layered", v: 1, id: presetId || DEFAULT_PRESET[base], base, skin: "light", hair: HAIR[base][0].id, hairColor: "brown", outfit: g.outfit[0].id, head: "none", cape: "none", weapon: "none", accessory: "none" };
}

/** 設定 → レイヤーごとの画像 URL（未納品は null）。描画コンポーネントはこれを順に重ねる */
/** 納品済みの素体（base__skin） */
export const BODY_READY = new Set(["f__light","m__light","f__fair","m__fair","f__tan","m__tan","f__deep","m__deep"]);
/** 納品済みの衣装（outfitId__base）と、背面画像があるもの */
export const OUTFIT_READY = new Set(["knight_default__f","mage_default__f","archer_default__f","healer_default__f","rogue_default__f","paladin_default__f","knight_default__m","mage_default__m","healer_default__m","rogue_default__m","paladin_default__m"]);
export const OUTFIT_HAS_BACK = new Set<string>([]);

/** 画像差し替え時にブラウザキャッシュを無効化するためのバージョン */
export const ASSET_V = "26";

export function resolveLayers(c: AvatarConfig, job: JobKey): { layer: Layer; src: string | null; missing: boolean }[] {
    const g = GEAR[job];
    const find = (list: Part[], id: string) => list.find((p) => p.id === id);
    const hair = find(HAIR[c.base], c.hair);
    const colorOk = !!find(HAIR_COLOR, c.hairColor)?.src;
    const hairSrc = (which: "back" | "front") => hair?.src && colorOk ? `/avatar/hair_${which}/${hair.id}__${c.hairColor}.png` : null;
    const gear = (list: Part[], id: string, layer: string) => { const p = find(list, id); if (!p || p.id === "none") return { src: "", missing: false }; return { src: p.src ? `/avatar/${layer}/${p.id}.png` : null, missing: !p.src }; };
    const out = (which: "back" | "front") => {
        const p = find(g.outfit, c.outfit);
        // 男性用が未納品の間は女性用を代用（体格はほぼ同じ）
        const base = OUTFIT_READY.has(`${p?.id}__${c.base}`) ? c.base : (OUTFIT_READY.has(`${p?.id}__f`) ? "f" : c.base);
        const ready = !!p?.src && OUTFIT_READY.has(`${p.id}__${base}`);
        if (which === "back") return { src: ready && OUTFIT_HAS_BACK.has(`${p.id}__${base}`) ? `/avatar/outfit_back/${p.id}__${base}.png` : "", missing: false };
        const sk = c.skin && c.skin !== "light" ? `__${c.skin}` : "";
        return { src: ready ? `/avatar/outfit_front/${p.id}__${base}${sk}.png` : null, missing: !ready };
    };
    // 素体：public/avatar/body/<base>__<skin>.png。納品済みは BODY_READY に登録
    const bodyReady = BODY_READY.has(`${c.base}__${c.skin}`);
    const body = { src: bodyReady ? `/avatar/body/${c.base}__${c.skin}.png` : null, missing: !bodyReady };
    const parts: Record<Layer, { src: string | null; missing: boolean }> = {
        cape: gear(g.cape, c.cape, "cape"), hair_back: { src: hairSrc("back"), missing: !(hair?.src && colorOk) }, body, outfit_back: out("back"), outfit_front: out("front"),
        hair_front: { src: hairSrc("front"), missing: !(hair?.src && colorOk) }, head: gear(g.head, c.head, "head"), weapon: gear(g.weapon, c.weapon, "weapon"), accessory: gear(g.accessory, c.accessory, "accessory"),
    };
    return LAYER_ORDER.map((layer) => { const p = parts[layer]; return { layer, src: p.src ? p.src + "?v=" + ASSET_V : p.src, missing: p.missing }; });
}
