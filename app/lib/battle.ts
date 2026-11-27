// 島バトルの設定・計算を【このファイル1か所】に集約する。バランス調整はここだけ直せば全画面に効く。
// Phase 1：クライアント内デモ計算のみ（実データは一切変更しない）。
// Phase 2 でダメージ計算・略奪・攻撃回数検証をサーバー側（Supabase RPC）へ移す予定。関数のシグネチャは据え置く。
// 画像素材について：emoji は仮表示。ChatGPT 素材が納品されたら各 img に パス（例 "/battle/elements/fire.webp"）を
// 入れるだけで全画面が画像表示に切り替わる（コンポーネント側は img 優先 → なければ emoji の順で描画する）。

export type ElementKey = "fire" | "water" | "wind" | "thunder" | "light" | "dark";
export type SkillKey = "double" | "boost" | "guard" | "burn" | "freeze" | "heal" | "purify";

export type ElementDef = {
    key: ElementKey;
    name: string;
    emoji: string;        // 仮素材（画像納品までの代替）
    img: string | null;   // ChatGPT素材の納品後にパスを設定
    color: string;        // 基調色（エフェクト・バッジに使用）
    glow: string;         // 発光色
};

export const ELEMENTS: Record<ElementKey, ElementDef> = {
    fire:    { key: "fire",    name: "炎", emoji: "🔥", img: "/battle/elements/fire.webp", color: "#ef4444", glow: "rgba(251,146,60,.8)" },
    water:   { key: "water",   name: "水", emoji: "💧", img: "/battle/elements/water.webp", color: "#3b82f6", glow: "rgba(96,165,250,.8)" },
    wind:    { key: "wind",    name: "風", emoji: "🍃", img: "/battle/elements/wind.webp", color: "#22c55e", glow: "rgba(134,239,172,.8)" },
    thunder: { key: "thunder", name: "雷", emoji: "⚡", img: "/battle/elements/thunder.webp", color: "#eab308", glow: "rgba(253,224,71,.85)" },
    light:   { key: "light",   name: "光", emoji: "✨", img: "/battle/elements/light.webp", color: "#f59e0b", glow: "rgba(253,230,138,.9)" },
    dark:    { key: "dark",    name: "闇", emoji: "🌀", img: "/battle/elements/dark.webp", color: "#8b5cf6", glow: "rgba(167,139,250,.8)" },
};

export const ELEMENT_ORDER: ElementKey[] = ["fire", "wind", "thunder", "water", "light", "dark"];

// 属性相性：炎→風→雷→水→炎 の循環（矛盾なし）＋ 光⇔闇 は相互有利。
// ADVANTAGE[a] = b は「a は b に有利（×2.0）」。不利は自動的にその逆（b から見た a）。
export const ADVANTAGE: Record<ElementKey, ElementKey[]> = {
    fire:    ["wind"],
    wind:    ["thunder"],
    thunder: ["water"],
    water:   ["fire"],
    light:   ["dark"],
    dark:    ["light"],
};

export function elementMultiplier(atk: ElementKey | null, def: ElementKey): number {
    if (!atk) return BATTLE_CONFIG.multNormal; // 無属性
    if (ADVANTAGE[atk].includes(def)) return BATTLE_CONFIG.multAdvantage;
    if (ADVANTAGE[def].includes(atk)) return BATTLE_CONFIG.multDisadvantage;
    return BATTLE_CONFIG.multNormal;
}

export type SkillDef = {
    key: SkillKey;
    name: string;
    emoji: string;
    img: string | null;
    desc: string;
    color: string;
};

export const SKILLS: Record<SkillKey, SkillDef> = {
    double: { key: "double", name: "2回攻撃", emoji: "⚔️", img: "/battle/skills/double.webp", desc: "1ターンに2回攻撃",           color: "#64748b" },
    boost:  { key: "boost",  name: "攻撃2倍", emoji: "🌟", img: null, desc: "次の攻撃ダメージ2倍",       color: "#f59e0b" },
    guard:  { key: "guard",  name: "防御UP",  emoji: "🛡️", img: null, desc: "2ターン被ダメージ半減",     color: "#3b82f6" },
    burn:   { key: "burn",   name: "やけど",  emoji: "🔥", img: null, desc: "3ターン継続ダメージ",       color: "#ef4444" },
    freeze: { key: "freeze", name: "凍結",    emoji: "❄️", img: null, desc: "次の行動を1回停止",         color: "#38bdf8" },
    heal:   { key: "heal",   name: "回復",    emoji: "💖", img: null, desc: "自分の城のHPを20回復",      color: "#ec4899" },
    purify: { key: "purify", name: "浄化",    emoji: "🕊️", img: null, desc: "状態異常を解除",           color: "#a78bfa" },
};

export type WeaponDef = {
    key: string;
    name: string;
    emoji: string;
    img: string | null;    // ChatGPT素材の納品後にパスを設定
    element: ElementKey | null;  // null = 無属性
    atk: number;
    skill: SkillKey | null;      // 攻撃時に確率発動
    skillRate: number;           // 発動率 0〜1
    critBonus: number;           // クリティカル率への加算
    desc: string;
    /** 期間限定の武器（イベント）。攻撃力が変わる・特殊な効果を持つ。値はサーバー側（battle_server.sql）と同じにする */
    limited?: { atkMax: number; lootMult: number; special: string };
};

// 武器10種。値段が高い段ほど攻撃力が高い（0pt:30 ／ 300pt:36〜42 ／ 400pt:44 ／ 600pt:48 ／ 800pt:52）。
// 数値を変えるときは battle_server.sql の battle_attack 内の表と battle_weapon_prices も同じ値にする（ダメージはサーバー側の値で決まる）
export const WEAPONS: WeaponDef[] = [
    { key: "wood_sword",  name: "木の剣",    emoji: "🗡️", img: "/battle/weapons/wood_sword.webp", element: null,      atk: 30, skill: null,     skillRate: 0,    critBonus: 0,    desc: "はじまりの剣。属性なし" },
    { key: "fire_sword",  name: "炎の剣",    emoji: "🔥", img: "/battle/weapons/fire_sword.webp", element: "fire",    atk: 42, skill: "burn",   skillRate: 0.35, critBonus: 0,    desc: "確率でやけどを付与する" },
    { key: "thunder_bow", name: "雷の弓",    emoji: "🏹", img: "/battle/weapons/thunder_bow.webp", element: "thunder", atk: 36, skill: "double", skillRate: 0.30, critBonus: 0,    desc: "確率で2回攻撃が発動する" },
    { key: "ice_staff",   name: "氷の杖",    emoji: "❄️", img: "/battle/weapons/ice_staff.webp", element: "water",   atk: 40, skill: "freeze", skillRate: 0.30, critBonus: 0,    desc: "確率で相手を凍結させる" },
    { key: "holy_staff",  name: "聖なる杖",  emoji: "✨", img: "/battle/weapons/holy_staff.webp", element: "light",   atk: 44, skill: "heal",   skillRate: 0.30, critBonus: 0,    desc: "確率で自分の城を回復する" },
    { key: "dark_dagger", name: "闇の短剣",  emoji: "🌙", img: "/battle/weapons/dark_dagger.webp", element: "dark",    atk: 44, skill: null,     skillRate: 0,    critBonus: 0.15, desc: "クリティカル率が高い" },
    { key: "wind_spear",    name: "風の槍",       emoji: "🍃", img: "/battle/weapons/wind_spear.webp",    element: "wind",    atk: 48, skill: "double", skillRate: 0.30, critBonus: 0,    desc: "確率で2回攻撃が発動する" },
    { key: "ice_sword",     name: "氷の剣",       emoji: "🧊", img: "/battle/weapons/ice_sword.webp",     element: "water",   atk: 48, skill: null,     skillRate: 0,    critBonus: 0.15, desc: "クリティカル率が高い" },
    { key: "thunder_spear", name: "雷の槍",       emoji: "⚡", img: "/battle/weapons/thunder_spear.webp", element: "thunder", atk: 52, skill: "double", skillRate: 0.35, critBonus: 0,    desc: "高い確率で2回攻撃が発動する" },
    { key: "fire_hammer",   name: "炎のハンマー", emoji: "🔨", img: "/battle/weapons/fire_hammer.webp",   element: "fire",    atk: 52, skill: "burn",   skillRate: 0.40, critBonus: 0,    desc: "高い確率でやけどを付与する" },
    // ▼ 期間限定（12月イベント「冬の学び祭」＝クリスマス・年末の冬イベント）。キーは wisdom_staff のまま。学習コンテンツを修了した本数だけ攻撃力が上がる。画像は納品待ち
    { key: "wisdom_staff", name: "聖夜の杖", emoji: "🎄", img: null, element: null, atk: 40, skill: null, skillRate: 0, critBonus: 0,
      desc: "学ぶほど強くなる、冬のイベント限定の杖。学習コンテンツを1本修了するごとに攻撃力+1（最大60）。この杖で城を落とすと、奪えるポイントが1.5倍",
      limited: { atkMax: 60, lootMult: 1.5, special: "学習1本ごとに攻撃力+1（最大60）／奪えるポイント1.5倍" } },
];

// バトル全体の調整値（Phase 2 以降もこの値を正とする）
export const BATTLE_CONFIG = {
    castleBaseHp: 100,       // 城の基本HP
    attacksPerDay: 3,        // 1日の最大攻撃回数
    multAdvantage: 2.0,      // 属性有利
    multNormal: 1.0,         // 通常
    multDisadvantage: 0.5,   // 属性不利
    critRate: 0.10,          // 基本クリティカル率
    critMult: 1.5,           // クリティカル倍率
    variance: 0.15,          // ダメージ乱数 ±15%
    healAmount: 20,          // 回復スキルの回復量
    burnDamage: 5,           // やけどの毎ターンダメージ
    burnTurns: 3,            // やけど継続ターン
    guardTurns: 2,           // 防御UP継続ターン
    guardCut: 0.5,           // 防御UP時の被ダメージ倍率
    shieldHours: 12,         // 城破壊後の保護シールド時間（Phase 2）
    hpRegenPerHour: 5,       // 城HPの自然回復/時（Phase 2）
    levelStep: 0.1,          // レベル差補正：1レベルごとの強さの増え方（battle_server.sql の battle_level_mult と同じ値）
} as const;

/** レベル差補正：自分のレベルが相手より低いほど、与えるダメージが減る（同じか高いときは×1.0のまま。増えはしない）。
 *  強さ＝1＋levelStep×(Lv−1) として、自分の強さ÷相手の強さ。サーバー側 battle_level_mult と同じ計算 */
export function levelMultiplier(myLevel: number, oppLevel: number): number {
    const k = (lv: number) => 1 + BATTLE_CONFIG.levelStep * (Math.max(1, lv) - 1);
    return Math.min(1, k(myLevel) / k(oppLevel));
}
/** 補正の表示用（×0.05 など。小さいときは小数2桁） */
export const levelMultLabel = (m: number) => "×" + (m >= 0.995 ? "1.0" : m < 0.1 ? m.toFixed(2) : m.toFixed(1));

export type DamageResult = {
    dmg: number;
    mult: number;          // 属性倍率
    crit: boolean;
    skillFired: SkillKey | null;
    hits: number;          // 2回攻撃なら2
};

/** ダメージ計算（Phase 1 はクライアントのデモ用。Phase 2 で同一ロジックをサーバー側に実装し、クライアント値は信用しない） */
export function calcDamage(weapon: WeaponDef, defElement: ElementKey, rand: () => number = Math.random, levelMult = 1): DamageResult {
    const mult = elementMultiplier(weapon.element, defElement);
    const crit = rand() < BATTLE_CONFIG.critRate + weapon.critBonus;
    const skillFired = weapon.skill && rand() < weapon.skillRate ? weapon.skill : null;
    const hits = skillFired === "double" ? 2 : 1;
    let total = 0;
    for (let i = 0; i < hits; i++) {
        const v = 1 + (rand() * 2 - 1) * BATTLE_CONFIG.variance;
        total += weapon.atk * mult * (crit ? BATTLE_CONFIG.critMult : 1) * v;
    }
    return { dmg: Math.max(1, Math.round(total * levelMult)), mult, crit, skillFired, hits };
}

/** 城の属性：user id から決定的に割り当てる（Phase 1 の仮仕様。Phase 2 で防衛設定から選択可能にする） */
export function castleElementOf(userId: string): ElementKey {
    let h = 0;
    for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
    return ELEMENT_ORDER[h % ELEMENT_ORDER.length];
}

/** 勝利演出の宝箱画像（null なら絵文字🎁で表示） */
export const CHEST_IMG: string | null = "/battle/chest.webp";

/** Phase 1 デモ：1日の攻撃回数を localStorage で仮管理（Phase 2 でサーバー検証に置き換え） */
export const DEMO_ATTACK_KEY = (date: string) => `iq_battle_demo_attacks_${date}`;

/** 島ごとの挑戦記録（この端末のブラウザ内のみ・DB保存なし）。攻略ミッションの進捗表示に使う。
 *  サーバー側の戦績テーブルが承認・実装されたら、この読み書きをそちらへ置き換える。 */
export type BattleLog = { attempts: number; wins: number; streak: number; bestStreak: number };
export const BATTLE_LOG_KEY = (oppId: string) => `iq_battle_log_${oppId}`;
export function readBattleLog(oppId: string): BattleLog {
    const empty = { attempts: 0, wins: 0, streak: 0, bestStreak: 0 };
    try { return { ...empty, ...(JSON.parse(localStorage.getItem(BATTLE_LOG_KEY(oppId)) || "{}")) }; } catch { return empty; }
}
export function writeBattleLog(oppId: string, log: BattleLog) {
    try { localStorage.setItem(BATTLE_LOG_KEY(oppId), JSON.stringify(log)); } catch {}
}

/** 武器ショップの状態（価格表と自分の所持武器）。
 *  enabled=false は battle_server.sql が未適用の環境：その場合は従来どおり全武器を使用可能として扱う。 */
export type WeaponShop = { enabled: boolean; prices: Record<string, number>; owned: Set<string>; sale?: Record<string, { from: string | null; until: string | null }>; learned?: number; needEvent?: Record<string, string>; joined?: Set<string> };
export async function loadWeaponShop(sb: { from: (t: string) => any }, userId: string): Promise<WeaponShop> {
    try {
        const [{ data: pr, error: e1 }, { data: ow, error: e2 }] = await Promise.all([
            sb.from("battle_weapon_prices").select("*"),
            sb.from("battle_weapon_owned").select("weapon_key").eq("user_id", userId),
        ]);
        if (e1 || e2 || !pr || pr.length === 0) return { enabled: false, prices: {}, owned: new Set() };
        const prices: Record<string, number> = {};
        const sale: Record<string, { from: string | null; until: string | null }> = {};
        const needEvent: Record<string, string> = {};
        (pr as any[]).forEach((r) => { prices[r.weapon_key] = Number(r.price); if (r.sale_from || r.sale_until) sale[r.weapon_key] = { from: r.sale_from || null, until: r.sale_until || null }; if (r.require_event) needEvent[r.weapon_key] = String(r.require_event); });
        // 参加しているイベント（イベントボーナスを1回でも受け取っているもの）。購入できるかの判定はサーバー側でもう一度行う
        const joined = new Set<string>();
        if (Object.keys(needEvent).length > 0) { try { const { data: jb } = await sb.from("season_event_bonus").select("event_key").eq("user_id", userId); ((jb || []) as any[]).forEach((r) => joined.add(r.event_key)); } catch {} }
        // 学習コンテンツを修了した本数（聖夜の杖の攻撃力の表示用。実際のダメージはサーバー側で数え直す）
        let learned = 0;
        try { const { data: cc } = await sb.from("content_completions").select("content_id").eq("user_id", userId).eq("status", "approved"); learned = new Set(((cc || []) as any[]).map((r) => r.content_id)).size; } catch {}
        return { enabled: true, prices, owned: new Set(((ow || []) as any[]).map((r) => r.weapon_key)), sale, learned, needEvent, joined };
    } catch { return { enabled: false, prices: {}, owned: new Set() }; }
}
/** その武器を使えるか（ショップ未導入なら全部使える／価格0は全員使える） */
export const canUseWeapon = (shop: WeaponShop, key: string) => {
    if (WEAPONS.find((w) => w.key === key)?.limited) return shop.enabled && shop.owned.has(key);   // 期間限定の武器は、持っている人だけ
    return !shop.enabled || (shop.prices[key] ?? 0) === 0 || shop.owned.has(key);
};
/** 期間限定の武器の販売状態：always＝いつでも／before＝販売前／on＝販売中／after＝販売終了 */
export function saleState(shop: WeaponShop, key: string): "always" | "before" | "on" | "after" {
    const s = shop.sale?.[key]; if (!s) return "always";
    const now = Date.now();
    if (s.from && now < new Date(s.from).getTime()) return "before";
    if (s.until && now >= new Date(s.until).getTime()) return "after";
    return "on";
}
/** イベント参加者だけが買える武器で、まだ参加していないとき true */
export const needsEventJoin = (shop: WeaponShop, key: string) => !!shop.needEvent?.[key] && !shop.joined?.has(shop.needEvent[key]);
/** 画面に並べる武器。期間限定の武器は、サーバーに登録済みで「持っている／販売前／販売中」のときだけ出す */
export function listedWeapons(shop: WeaponShop): WeaponDef[] {
    return WEAPONS.filter((w) => !w.limited || (shop.enabled && w.key in shop.prices && (shop.owned.has(w.key) || saleState(shop, w.key) !== "after")));
}
/** その人にとっての攻撃力（聖夜の杖は学習の本数で変わる） */
export const weaponAtk = (w: WeaponDef, shop?: WeaponShop | null) => w.limited ? Math.min(w.limited.atkMax, w.atk + (shop?.learned ?? 0)) : w.atk;
/** 販売期間の表示（例：12/1〜12/31） */
export function saleLabel(shop: WeaponShop, key: string): string {
    const s = shop.sale?.[key]; if (!s) return "";
    const md = (iso: string, shift = 0) => { const d = new Date(new Date(iso).getTime() + 9 * 3600e3 + shift); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
    return `${s.from ? md(s.from) : ""}〜${s.until ? md(s.until, -1000) : ""}`;
}

/** 勝利時の略奪の設定（サーバーの battle_loot_config テーブルと同じ形）。計算はサーバー側で行い、ここは画面の説明表示にだけ使う */
export type LootConfig = { enabled: boolean; rate_high: number; rate_same: number; rate_low: number; level_gap: number; cap_points: number; protect_points: number };
export async function loadLootConfig(sb: { from: (t: string) => any }): Promise<LootConfig | null> {
    try {
        const { data, error } = await sb.from("battle_loot_config").select("*").eq("id", 1).maybeSingle();
        if (error || !data) return null;
        return { enabled: !!data.enabled, rate_high: Number(data.rate_high), rate_same: Number(data.rate_same), rate_low: Number(data.rate_low), level_gap: Number(data.level_gap), cap_points: Number(data.cap_points), protect_points: Number(data.protect_points) };
    } catch { return null; }
}
/** 自分と相手のレベルから、奪える割合を返す（格上ほど多い） */
export function lootRateFor(cfg: LootConfig, myLevel: number, oppLevel: number): number {
    if (oppLevel - myLevel >= cfg.level_gap) return cfg.rate_high;
    if (myLevel - oppLevel >= cfg.level_gap) return cfg.rate_low;
    return cfg.rate_same;
}
