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
};

// 指示書§6の初期武器6種。atk などの数値は仮バランス（このファイルで後から調整可能）
export const WEAPONS: WeaponDef[] = [
    { key: "wood_sword",  name: "木の剣",    emoji: "🗡️", img: "/battle/weapons/wood_sword.webp", element: null,      atk: 30, skill: null,     skillRate: 0,    critBonus: 0,    desc: "はじまりの剣。属性なし" },
    { key: "fire_sword",  name: "炎の剣",    emoji: "🔥", img: "/battle/weapons/fire_sword.webp", element: "fire",    atk: 42, skill: "burn",   skillRate: 0.35, critBonus: 0,    desc: "確率でやけどを付与する" },
    { key: "thunder_bow", name: "雷の弓",    emoji: "🏹", img: "/battle/weapons/thunder_bow.webp", element: "thunder", atk: 36, skill: "double", skillRate: 0.30, critBonus: 0,    desc: "確率で2回攻撃が発動する" },
    { key: "ice_staff",   name: "氷の杖",    emoji: "❄️", img: "/battle/weapons/ice_staff.webp", element: "water",   atk: 40, skill: "freeze", skillRate: 0.30, critBonus: 0,    desc: "確率で相手を凍結させる" },
    { key: "holy_staff",  name: "聖なる杖",  emoji: "✨", img: "/battle/weapons/holy_staff.webp", element: "light",   atk: 38, skill: "heal",   skillRate: 0.30, critBonus: 0,    desc: "確率で自分の城を回復する" },
    { key: "dark_dagger", name: "闇の短剣",  emoji: "🌙", img: "/battle/weapons/dark_dagger.webp", element: "dark",    atk: 40, skill: null,     skillRate: 0,    critBonus: 0.15, desc: "クリティカル率が高い" },
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
    lootRate: 0.10,          // 勝利時：相手バトルポイントの略奪率（Phase 3）
    lootCap: 50,             // 略奪の1回上限（Phase 3）
    shieldHours: 12,         // 城破壊後の保護シールド時間（Phase 2）
    hpRegenPerHour: 5,       // 城HPの自然回復/時（Phase 2）
} as const;

export type DamageResult = {
    dmg: number;
    mult: number;          // 属性倍率
    crit: boolean;
    skillFired: SkillKey | null;
    hits: number;          // 2回攻撃なら2
};

/** ダメージ計算（Phase 1 はクライアントのデモ用。Phase 2 で同一ロジックをサーバー側に実装し、クライアント値は信用しない） */
export function calcDamage(weapon: WeaponDef, defElement: ElementKey, rand: () => number = Math.random): DamageResult {
    const mult = elementMultiplier(weapon.element, defElement);
    const crit = rand() < BATTLE_CONFIG.critRate + weapon.critBonus;
    const skillFired = weapon.skill && rand() < weapon.skillRate ? weapon.skill : null;
    const hits = skillFired === "double" ? 2 : 1;
    let total = 0;
    for (let i = 0; i < hits; i++) {
        const v = 1 + (rand() * 2 - 1) * BATTLE_CONFIG.variance;
        total += weapon.atk * mult * (crit ? BATTLE_CONFIG.critMult : 1) * v;
    }
    return { dmg: Math.max(1, Math.round(total)), mult, crit, skillFired, hits };
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
export type WeaponShop = { enabled: boolean; prices: Record<string, number>; owned: Set<string> };
export async function loadWeaponShop(sb: { from: (t: string) => any }, userId: string): Promise<WeaponShop> {
    try {
        const [{ data: pr, error: e1 }, { data: ow, error: e2 }] = await Promise.all([
            sb.from("battle_weapon_prices").select("weapon_key, price"),
            sb.from("battle_weapon_owned").select("weapon_key").eq("user_id", userId),
        ]);
        if (e1 || e2 || !pr || pr.length === 0) return { enabled: false, prices: {}, owned: new Set() };
        const prices: Record<string, number> = {};
        (pr as any[]).forEach((r) => { prices[r.weapon_key] = Number(r.price); });
        return { enabled: true, prices, owned: new Set(((ow || []) as any[]).map((r) => r.weapon_key)) };
    } catch { return { enabled: false, prices: {}, owned: new Set() }; }
}
/** その武器を使えるか（ショップ未導入なら全部使える／価格0は全員使える） */
export const canUseWeapon = (shop: WeaponShop, key: string) => !shop.enabled || (shop.prices[key] ?? 0) === 0 || shop.owned.has(key);
