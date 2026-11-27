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

export type Layer = "hair_back" | "body" | "eyes" | "outfit_back" | "outfit_front" | "head_back" | "hair_front" | "head" | "cape" | "cape_front" | "weapon" | "accessory" | "accessory_back";
/** 描画順（下→上）。マントは衣装の背面側に入る想定だが、素材の作り方で前にも出せるよう独立レイヤーにする */
export const LAYER_ORDER: Layer[] = ["cape", "accessory_back", "hair_back", "body", "eyes", "outfit_back", "outfit_front", "cape_front", "head_back", "hair_front", "head", "weapon", "accessory"];

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
/** 目の形。"default" は素体に描き込まれている最初の目（重ねる絵なし）。それ以外は「目のない素体」＋「目のパーツ」で描く */
export const EYES: Part[] = [
    { id: "default", label: "ぱっちり", src: "ok" },
    { id: "tare", label: "たれ目", src: "ok" },
    { id: "maru", label: "まんまる", src: "ok" },
    { id: "tsuri", label: "つり目", src: "ok" },
    { id: "jito", label: "ジト目", src: "ok" },
    { id: "kire", label: "切れ長", src: "ok" },
];
export const EYE_COLOR: Part[] = [
    { id: "brown", label: "ブラウン", src: "ok", swatch: "#8a4a1e" },
    { id: "black", label: "ブラック", src: "ok", swatch: "#2b1d1a" },
    { id: "blue", label: "ブルー", src: "ok", swatch: "#2f6fd6" },
    { id: "green", label: "グリーン", src: "ok", swatch: "#3e9b5a" },
];
/** 納品済みの目のパーツ（<目の形>__<色>）。ファイルは public/avatar/eyes/<id>__<color>.png（男女共通・1024×1024） */
export const EYES_READY = new Set<string>(["tare__brown", "tare__black", "tare__blue", "tare__green", "maru__brown", "maru__black", "maru__blue", "maru__green", "tsuri__brown", "tsuri__black", "tsuri__blue", "tsuri__green", "jito__brown", "jito__black", "jito__blue", "jito__green", "kire__brown", "kire__black", "kire__blue", "kire__green"]);
/** 「目のない素体」が納品済みの組み合わせ（<base>__<skin>）。ここに無い肌の色では、目は最初の目のまま */
export const EYES_BODY_READY = new Set<string>(["f__light", "m__light", "f__fair", "m__fair", "f__tan", "m__tan", "f__deep", "m__deep"]);
/** その性別・肌の色で、目を選べるか */
export const eyesSelectable = (base: Base, skin: string) => EYES_BODY_READY.has(`${base}__${skin}`);
/** 「ぱっちり」（素体に描き込まれた最初の目）で選べる瞳の色。ブラウンは素体そのまま。
 *  ほかの色は、素体の目の「瞳の部分だけ」色を変えた絵を素体の上に重ねる：public/avatar/eyes/pacchiri__<色>__<base>__<skin>.png */
export const PACCHIRI_COLORS = new Set<string>(["black", "blue", "green"]);
const isPacchiri = (eyes?: string) => !eyes || eyes === "default";
/** その目の形で選べる瞳の色（ブラウンは必ず選べる） */
export const eyeColorsFor = (eyes?: string): Part[] =>
    EYE_COLOR.filter((c) => c.id === "brown" || (isPacchiri(eyes) ? PACCHIRI_COLORS.has(c.id) : EYES_READY.has(`${eyes}__${c.id}`)));
/** 実際に重ねる目。null＝最初の目のまま。noBody=true のときは「目のない素体」を使う（ぱっちりの色違いは今の素体の上に重ねる） */
export function activeEyes(c: { base: Base; skin: string; eyes?: string; eyeColor?: string }): { src: string; noBody: boolean } | null {
    const col = c.eyeColor || "brown";
    if (isPacchiri(c.eyes)) return PACCHIRI_COLORS.has(col) ? { src: `/avatar/eyes/pacchiri__${col}__${c.base}__${c.skin}.png`, noBody: false } : null;
    if (!eyesSelectable(c.base, c.skin)) return null;
    const key = EYES_READY.has(`${c.eyes}__${col}`) ? `${c.eyes}__${col}` : EYES_READY.has(`${c.eyes}__brown`) ? `${c.eyes}__brown` : null;
    return key ? { src: `/avatar/eyes/${key}.png`, noBody: true } : null;
}

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
        head: [none(), { id: "knight_circlet", label: "銀のサークレット", src: "ok" }],  // 肩装飾は廃止（素材の左右非対称が解消できないため）
        cape: [none(), { id: "knight_cape", label: "青のマント", src: "ok" }, { id: "knight_cape_red", label: "赤のマント", src: "ok" }],
        weapon: [none(), { id: "knight_sword", label: "剣", src: "ok" }, { id: "knight_sword_shield", label: "剣と盾", src: "ok" }, { id: "knight_greatsword", label: "大剣", src: "ok" }, { id: "knight_lance", label: "槍", src: "ok" }],
        accessory: [none(), { id: "knight_ribbon_blue", label: "青リボン", src: "ok" }, { id: "knight_ribbon_white", label: "白リボン", src: "ok" }, { id: "knight_star", label: "星の飾り", src: "ok" }, { id: "knight_medal", label: "金の勲章", src: "ok" }],
    },
    mage: {
        outfit: [{ id: "mage_default", label: "魔法使いのローブ", src: "ok" }],
        head: [none(), { id: "mage_hat_star", label: "帽子（星リボン）", src: "ok" }],  // 魔法帽子・月のチャームは廃止（被り方が合わないため）
        cape: [none(), { id: "mage_cape", label: "紫のマント", src: "ok" }, { id: "mage_cape_navy", label: "星空のマント", src: "ok" }],
        weapon: [none(), { id: "mage_staff", label: "杖（基本）", src: "ok" }, { id: "mage_staff_star", label: "杖（星）", src: "ok" }, { id: "mage_staff_moon", label: "杖（月）", src: "ok" }, { id: "mage_staff_crystal", label: "杖（水晶）", src: "ok" }],
        accessory: [none(), { id: "mage_ribbon", label: "リボン", src: "ok" }, { id: "mage_book", label: "魔導書", src: "ok" }, { id: "mage_glasses", label: "メガネ", src: "ok" }, { id: "mage_pendant", label: "紫のペンダント", src: "ok" }],
    },
    archer: {
        outfit: [{ id: "archer_default", label: "アーチャーの軽装", src: "ok" }],
        head: [none(), { id: "archer_hat", label: "羽根付き帽子", src: "ok" }],
        cape: [none(), { id: "archer_cape", label: "緑のマント", src: "ok" }, { id: "archer_cape_brown", label: "旅人のマント", src: "ok" }],
        weapon: [none(), { id: "archer_bow", label: "弓（基本）", src: "ok" }, { id: "archer_bow_alt", label: "弓（別デザイン）", src: "ok" }, { id: "archer_bow_gold", label: "白金の弓", src: "ok" }, { id: "archer_crossbow", label: "クロスボウ", src: "ok" }],
        accessory: [none(), { id: "archer_leaf", label: "葉のブローチ", src: "ok" }, { id: "archer_pouch", label: "腰ポーチ", src: "ok" }, { id: "archer_quiver", label: "矢筒", src: "ok" }, { id: "archer_flower", label: "花飾り", src: "ok" }, { id: "archer_feather", label: "羽根飾り", src: "ok" }],
    },
    healer: {
        outfit: [{ id: "healer_default", label: "ヒーラーの衣装", src: "ok" }],
        head: [none(), { id: "healer_hat", label: "聖帽", src: "ok" }, { id: "healer_halo", label: "天使の輪", src: "ok" }],
        cape: [none(), { id: "healer_cape", label: "白のマント", src: "ok" }, { id: "healer_cape_pink", label: "ピンクのマント", src: "ok" }],
        weapon: [none(), { id: "healer_staff", label: "杖（基本）", src: "ok" }, { id: "healer_staff_flower", label: "杖（花）", src: "ok" }, { id: "healer_staff_moon", label: "杖（月）", src: "ok" }, { id: "healer_staff_wing", label: "杖（翼）", src: "ok" }, { id: "healer_staff_crystal", label: "杖（水晶）", src: "ok" }],
        accessory: [none(), { id: "healer_ribbon", label: "リボン", src: "ok" }, { id: "healer_cross", label: "十字架の飾り", src: "ok" }, { id: "healer_book", label: "聖書", src: "ok" }, { id: "healer_glasses", label: "メガネ", src: "ok" }],
    },
    rogue: {
        outfit: [{ id: "rogue_default", label: "ローグの軽装", src: "ok" }],
        head: [none(), { id: "rogue_bandana", label: "赤いバンダナ", src: "ok" }],  // フードは廃止（髪型との相性問題のため）
        cape: [none(), { id: "rogue_cape", label: "黒のマント", src: "ok" }, { id: "rogue_cape_crimson", label: "深紅のマント", src: "ok" }],
        weapon: [none(), { id: "rogue_daggers", label: "短剣（二刀）", src: "ok" }, { id: "rogue_knives", label: "投げナイフ", src: "ok" }, { id: "rogue_katana", label: "刀", src: "ok" }, { id: "rogue_claw", label: "鉤爪", src: "ok" }],
        accessory: [none(), { id: "rogue_scarf", label: "スカーフ", src: "ok" }, { id: "rogue_brooch", label: "ブローチ", src: "ok" }, { id: "rogue_pendant", label: "ペンダント", src: "ok" }, { id: "rogue_armband", label: "アームバンド", src: "ok" }],
    },
    paladin: {
        outfit: [{ id: "paladin_default", label: "パラディンの聖鎧", src: "ok" }],
        head: [none(), { id: "paladin_tiara", label: "ティアラ", src: "ok" }, { id: "paladin_crown", label: "冠", src: "ok" }, { id: "paladin_feather", label: "羽飾り", src: "ok" }],
        cape: [none(), { id: "paladin_cape", label: "青のマント", src: "ok" }, { id: "paladin_cape_white", label: "白のマント", src: "ok" }],
        weapon: [none(), { id: "paladin_sword", label: "聖剣（基本）", src: "ok" }, { id: "paladin_sword_shield", label: "聖剣と盾", src: "ok" }, { id: "paladin_sword_deco", label: "聖剣（装飾）", src: "ok" }],
        accessory: [none(), { id: "paladin_clasp", label: "マント留め", src: "ok" }, { id: "paladin_cross", label: "十字架のペンダント", src: "ok" }, { id: "paladin_medal", label: "勲章", src: "ok" }, { id: "paladin_wing", label: "白い羽", src: "ok" }],
    },
};

/** profiles.avatar_config に保存する形。id は従来の preset ID を残し、既存の表示箇所（avatar_config.id）を壊さない */
export type AvatarConfig = {
    type: "layered"; v: 1;
    /** 従来のプリセット ID（みんなの島・プロフィール等の既存表示用） */
    id: string;
    base: Base; skin: string; hair: string; hairColor: string;
    /** 目の形と色（あとから足した項目。無いときは最初の目） */
    eyes?: string; eyeColor?: string;
    outfit: string; head: string; cape: string; weapon: string; accessory: string;
};
/** イベントの達成報酬の装備（どの職業でも着けられる共通の装備）。持っている人だけが選べる（買うことはできない）。
 *  配るのはサーバー側（season_event.sql の event_sync）。gear_items の gear_key と同じIDにする */
export const REWARD_GEAR: { head: Part[]; cape: Part[] } = {
    head: [{ id: "event_santa_hat", label: "サンタ帽", src: "ok" }],
    cape: [{ id: "event_xmas_cape", label: "聖夜のマント", src: "ok" }],
};
export const REWARD_ONLY = new Set<string>([...REWARD_GEAR.head, ...REWARD_GEAR.cape].map((p) => p.id));
(Object.keys(GEAR) as JobKey[]).forEach((j) => { GEAR[j].head.push(...REWARD_GEAR.head); GEAR[j].cape.push(...REWARD_GEAR.cape); });
/** えり・リボンなど、体の「前」にも重ねる部分があるマント（public/avatar/cape_front/<id>.png） */
export const CAPE_FRONT = new Set<string>(["event_xmas_cape"]);

export const DEFAULT_PRESET = { f: "girl_bob_brown", m: "boy_short_black" } as const;

export function defaultConfig(job: JobKey, base: Base = "f", presetId?: string): AvatarConfig {
    const g = GEAR[job];
    return { type: "layered", v: 1, id: presetId || DEFAULT_PRESET[base], base, skin: "light", hair: HAIR[base][0].id, hairColor: "brown", outfit: g.outfit[0].id, head: "none", cape: "none", weapon: "none", accessory: "none" };
}

/** 設定 → レイヤーごとの画像 URL（未納品は null）。描画コンポーネントはこれを順に重ねる */
/** 納品済みの素体（base__skin） */
export const BODY_READY = new Set(["f__light","m__light","f__fair","m__fair","f__tan","m__tan","f__deep","m__deep"]);
/** 納品済みの衣装（outfitId__base）と、背面画像があるもの */
export const OUTFIT_READY = new Set(["knight_default__f","mage_default__f","archer_default__f","healer_default__f","rogue_default__f","paladin_default__f","knight_default__m","mage_default__m","healer_default__m","rogue_default__m","paladin_default__m","archer_default__m"]);
export const OUTFIT_HAS_BACK = new Set<string>([]);
/** 納品済みの装備（head/cape/weapon/accessory）。
 *  男女共通1枚なら "rogue_hood"、男女別なら "rogue_hood__f" / "rogue_hood__m" を登録する。
 *  ファイルは public/avatar/<layer>/<id>.png または <id>__<base>.png（1024×1024・既存座標系） */
export const GEAR_READY = new Set<string>([]);
/** 装備すると髪を隠す頭装備（フード・兜など、髪がはみ出すと不自然なもの） */
/** 髪の「後ろ」に描く頭装備（フードなど）。髪はそのまま、装備が頭の後ろに回り込む */
export const HEAD_BEHIND_HAIR = new Set<string>([]);  // 後ろ配置は髪に埋もれたため不使用（前被りに戻した）

/** 画像差し替え時にブラウザキャッシュを無効化するためのバージョン */
export const ASSET_V = "53";

/** 体の「後ろ」に描くアクセサリー（背中の羽など）。マントより前、髪・体より後ろ */
export const ACCESSORY_BEHIND = new Set<string>(["paladin_wing"]);

/** 被ると髪を帽子の中に収める頭装備。帽子より上にはみ出す髪を <id>__hairmask.png で隠す（＝ちゃんと被って見える） */
export const HEAD_HAIR_MASK = new Set<string>(["mage_hat_star"]);

export function resolveLayers(c: AvatarConfig, job: JobKey): { layer: Layer; src: string | null; missing: boolean; mask?: string }[] {
    const g = GEAR[job];
    const find = (list: Part[], id: string) => list.find((p) => p.id === id);
    const hair = find(HAIR[c.base], c.hair);
    const colorOk = !!find(HAIR_COLOR, c.hairColor)?.src;
    const hairSrc = (which: "back" | "front") => hair?.src && colorOk ? `/avatar/hair_${which}/${hair.id}__${c.hairColor}.png` : null;
    const gear = (list: Part[], id: string, layer: string) => {
        const p = find(list, id); if (!p || p.id === "none") return { src: "", missing: false };
        // 性別別ファイル（<id>__<base>）→ 男女共通（<id>）の順で解決。GEAR_READY 登録 or src が入っていれば納品済み
        if (GEAR_READY.has(`${p.id}__${c.base}`)) return { src: `/avatar/${layer}/${p.id}__${c.base}.png`, missing: false };
        if (GEAR_READY.has(p.id) || p.src) return { src: `/avatar/${layer}/${p.id}.png`, missing: false };
        return { src: null, missing: true };
    };
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
    const none = { src: "", missing: false };
    const eyeKey = bodyReady ? activeEyes(c) : null;   // 目を替えるときは「目のない素体」を使い、その上に目のパーツを重ねる
    const body = { src: bodyReady ? `/avatar/${eyeKey?.noBody ? "body_noeyes" : "body"}/${c.base}__${c.skin}.png` : null, missing: !bodyReady };
    // フード等は髪の「後ろ」のレイヤーに描く（髪はそのまま表示）
    const headGear = gear(g.head, c.head, "head");
    const behind = HEAD_BEHIND_HAIR.has(c.head);
    const accGear = gear(g.accessory, c.accessory, "accessory");
    const accBehind = ACCESSORY_BEHIND.has(c.accessory);
    const parts: Record<Layer, { src: string | null; missing: boolean }> = {
        cape: gear(g.cape, c.cape, "cape"), cape_front: CAPE_FRONT.has(c.cape) ? { src: `/avatar/cape_front/${c.cape}.png`, missing: false } : none, hair_back: { src: hairSrc("back"), missing: !(hair?.src && colorOk) }, body, eyes: eyeKey ? { src: eyeKey.src, missing: false } : none, outfit_back: out("back"), outfit_front: out("front"),
        head_back: behind ? headGear : none,
        hair_front: { src: hairSrc("front"), missing: !(hair?.src && colorOk) }, head: behind ? none : headGear, weapon: gear(g.weapon, c.weapon, "weapon"),
        accessory: accBehind ? none : accGear, accessory_back: accBehind ? accGear : none,
    };
    // 帽子を被っている間、髪レイヤーにマスクを掛ける（帽子画像が表示できるときだけ）
    const hairMask = HEAD_HAIR_MASK.has(c.head) && headGear.src ? `/avatar/head/${c.head}__hairmask.png?v=${ASSET_V}` : undefined;
    return LAYER_ORDER.map((layer) => {
        const p = parts[layer];
        const mask = (layer === "hair_back" || layer === "hair_front") ? hairMask : undefined;
        return { layer, src: p.src ? p.src + "?v=" + ASSET_V : p.src, missing: p.missing, mask };
    });
}
