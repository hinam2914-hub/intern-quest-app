"use client";
// 「夜の島」シーン（みんなの島のカード／プロフィールのヒーロー）の共通描画
// Phase 1：app/islands/page.tsx と IslandHero.tsx にあった同じ描画を1つにまとめたもの。
// 画面ごとに違うのは数値だけなので preset（card / hero）で切り替える。見た目は移行前と同じ。
import { getHouseStage, HOUSE_IMG, GROUND_BG, TREE_EMOJI, DECO_EMOJI, SKY_EMOJI, ANIMAL_EMOJI, avatarSrc, getLevel, type IslandConfig } from "../lib/island";

export type IslandSceneVariant = "card" | "hero";

type Preset = {
    height: number;
    ground: { w: number; h: number; b: number; shadow: string; cfgShadow: string };
    base: { side: number; top: number; b: number };
    houseW: number[];
    house: { mb: number; z: number; shadow: string };
    avatar: { size: number; b: number; tx: number; shadow: string };
    tree: { b: number; r: number; fs: number; shadow: string };
    deco: { b: number; l: number; fs: number; shadow: string };
    sky: { t: number; r: number; fs: number; anim?: string };
    animal: { b: number; tx: number; fs: number; anim: string; shadow: string };
    extras: boolean;   // 道・木・岩・花・ランタン・ホタル・Lv演出・窓の灯り・煙（カードのみ）
};

const PRESET: Record<IslandSceneVariant, Preset> = {
    card: {
        height: 215,
        ground: { w: 210, h: 54, b: 16, shadow: "inset 0 -9px 13px rgba(0,0,0,.25)", cfgShadow: "inset 0 -9px 13px rgba(0,0,0,.2)" },
        base: { side: 74, top: 62, b: -22 },
        houseW: [84, 98, 110, 120, 134, 128],
        house: { mb: 42, z: 2, shadow: "drop-shadow(0 7px 12px rgba(0,0,0,.4))" },
        avatar: { size: 48, b: 26, tx: -80, shadow: "0 4px 9px rgba(0,0,0,.45)" },
        tree: { b: 40, r: 20, fs: 40, shadow: "drop-shadow(0 3px 4px rgba(0,0,0,.4))" },
        deco: { b: 30, l: 30, fs: 30, shadow: "drop-shadow(0 2px 3px rgba(0,0,0,.4))" },
        sky: { t: 6, r: 26, fs: 34, anim: "isFar 6s ease-in-out infinite" },
        animal: { b: 24, tx: 52, fs: 24, anim: "isBob 2.6s ease-in-out infinite", shadow: "drop-shadow(0 2px 3px rgba(0,0,0,.4))" },
        extras: true,
    },
    hero: {
        height: 235,
        ground: { w: 260, h: 62, b: 26, shadow: "inset 0 -10px 14px rgba(0,0,0,.25)", cfgShadow: "inset 0 -10px 14px rgba(0,0,0,.2)" },
        base: { side: 88, top: 72, b: -14 },
        houseW: [100, 116, 130, 142, 158, 152],
        house: { mb: 52, z: 1, shadow: "drop-shadow(0 8px 14px rgba(0,0,0,.45))" },
        avatar: { size: 64, b: 40, tx: 26, shadow: "0 4px 10px rgba(0,0,0,.45)" },
        tree: { b: 52, r: 46, fs: 52, shadow: "drop-shadow(0 3px 5px rgba(0,0,0,.4))" },
        deco: { b: 40, l: 52, fs: 38, shadow: "drop-shadow(0 2px 4px rgba(0,0,0,.4))" },
        sky: { t: 10, r: 40, fs: 44 },
        animal: { b: 34, tx: 66, fs: 30, anim: "isBobSm 2.6s ease-in-out infinite", shadow: "drop-shadow(0 2px 4px rgba(0,0,0,.4))" },
        extras: false,
    },
};

const FLOWER_COLORS = ["#f472b6", "#fbbf24", "#f87171", "#c084fc", "#fb923c"];

/** シーンが使う keyframes。ページで1回だけ置く */
export function IslandSceneStyle() {
    return (
        <style>{`
            @keyframes isBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
            @keyframes isBobSm { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
            @keyframes isFar { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-16px)} }
            @keyframes isLantern { 0%,100%{opacity:.75} 50%{opacity:1} }
            @keyframes isFirefly { 0%,100%{transform:translate(0,0);opacity:.3} 30%{opacity:1} 50%{transform:translate(9px,-13px);opacity:.7} 80%{opacity:1} }
            @keyframes isCrystal { 0%,100%{transform:rotate(45deg) translateY(0)} 50%{transform:rotate(45deg) translateY(-9px)} }
            @keyframes isPetal { 0%{transform:translate(0,0) rotate(0)} 100%{transform:translate(-26px,130px) rotate(300deg);opacity:0} }
            @keyframes isSmoke { 0%{transform:translateY(0) scale(.6);opacity:0} 15%{opacity:.7} 100%{transform:translateY(-38px) scale(1.5);opacity:0} }
        `}</style>
    );
}

export default function IslandScene({ variant, totalEarned, avatarId, name, config, seed = 0 }: {
    variant: IslandSceneVariant;
    totalEarned: number;
    avatarId: string;
    name: string;
    config: IslandConfig;
    /** カードの花・ホタルなどの配置に使う乱数の種（一覧の index） */
    seed?: number;
}) {
    const p = PRESET[variant];
    const stage = getHouseStage(totalEarned);
    const level = getLevel(totalEarned);
    const hw = p.houseW[stage.idx];
    const rare60 = level >= 60, rare80 = level >= 80, rare100 = level >= 100;
    const r = (n: number) => ((seed * 73 + n * 137) % 100) / 100;
    const ex = p.extras;
    return (
        <div style={{ position: "relative", height: p.height, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            {/* 魔法陣 Lv100+ */}
            {ex && rare100 && <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", width: 250, height: 66, borderRadius: "50%", border: "2px solid rgba(167,139,250,.55)", boxShadow: "0 0 26px rgba(167,139,250,.5), inset 0 0 22px rgba(167,139,250,.3)", animation: "isLantern 3.2s ease-in-out infinite" }} />}
            {/* 地面 */}
            <div style={{ position: "absolute", bottom: p.ground.b, left: "50%", transform: "translateX(-50%)", width: p.ground.w, height: p.ground.h, borderRadius: "50%", background: "linear-gradient(180deg, #4ade80, #22a05a)", boxShadow: p.ground.shadow }} />
            {config.ground && GROUND_BG[config.ground] && <div style={{ position: "absolute", bottom: p.ground.b, left: "50%", transform: "translateX(-50%)", width: p.ground.w, height: p.ground.h, borderRadius: "50%", background: GROUND_BG[config.ground], boxShadow: p.ground.cfgShadow }} />}
            {/* 道 */}
            {ex && <div style={{ position: "absolute", bottom: 22, left: "50%", transform: "translateX(-8px)", width: 34, height: 34, borderRadius: "50% 50% 60% 60%", background: "linear-gradient(180deg, #d9c49a, #bfa87e)", opacity: .9, zIndex: 1 }} />}
            {/* 土台 */}
            <div style={{ position: "absolute", bottom: p.base.b, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: `${p.base.side}px solid transparent`, borderRight: `${p.base.side}px solid transparent`, borderTop: `${p.base.top}px solid #6b4a34` }} />
            {ex && <div style={{ position: "absolute", bottom: -40, left: "50%", transform: "translateX(-50%)", width: 130, height: 18, borderRadius: "50%", background: "rgba(0,0,0,.45)", filter: "blur(9px)" }} />}
            {/* 木 x2 */}
            {ex && [{ l: 42, s: 1 }, { l: 152, s: .8 }].map((tr, k) => (
                <div key={k} style={{ position: "absolute", bottom: 34, left: tr.l, transform: `scale(${tr.s})`, zIndex: 1 }}>
                    <div style={{ width: 0, height: 0, borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderBottom: "26px solid #16a34a" }} />
                    <div style={{ width: 0, height: 0, marginTop: -14, borderLeft: "16px solid transparent", borderRight: "16px solid transparent", borderBottom: "24px solid #15803d", transform: "translateX(-3px)" }} />
                    <div style={{ width: 6, height: 9, background: "#7c4a2d", margin: "0 auto" }} />
                </div>
            ))}
            {/* 岩 */}
            {ex && <div style={{ position: "absolute", bottom: 26, left: 44, width: 15, height: 10, borderRadius: "50% 50% 40% 40%", background: "#9ca3af", zIndex: 1 }} />}
            {/* 花 */}
            {ex && [0, 1, 2, 3, 4].map((k) => (
                <div key={k} style={{ position: "absolute", bottom: 24 + r(k) * 16, left: 34 + r(k + 9) * 150, width: 5, height: 5, borderRadius: "50%", background: FLOWER_COLORS[(seed + k) % FLOWER_COLORS.length], boxShadow: "0 0 4px rgba(255,255,255,.4)", zIndex: 1 }} />
            ))}
            {/* ランタン */}
            {ex && (
                <div style={{ position: "absolute", bottom: 30, left: "50%", transform: "translateX(36px)", zIndex: 3 }}>
                    <div style={{ width: 2, height: 17, background: "#7c5a3a", margin: "0 auto" }} />
                    <div style={{ width: 9, height: 11, borderRadius: 3, background: "#ffe08a", boxShadow: "0 0 12px rgba(255,224,138,.9)", animation: "isLantern 2.6s ease-in-out infinite" }} />
                </div>
            )}
            {/* ホタル */}
            {ex && [0, 1, 2].map((k) => (
                <div key={k} style={{ position: "absolute", bottom: 46 + r(k + 3) * 60, left: 26 + r(k + 6) * 165, width: 3, height: 3, borderRadius: "50%", background: "#d9f99d", boxShadow: "0 0 6px #d9f99d", animation: `isFirefly ${3 + k}s ease-in-out ${k * .8}s infinite`, zIndex: 3 }} />
            ))}
            {/* クリスタル Lv60+ */}
            {ex && rare60 && [{ l: 20, d: 0 }, { l: 178, d: 1.3 }].map((c, k) => (
                <div key={k} style={{ position: "absolute", bottom: 62 + k * 24, left: c.l, width: 12, height: 12, background: "linear-gradient(135deg, #c4b5fd, #8b5cf6)", transform: "rotate(45deg)", boxShadow: "0 0 12px rgba(167,139,250,.8)", animation: `isCrystal 3.4s ease-in-out ${c.d}s infinite`, zIndex: 3 }} />
            ))}
            {/* 桜吹雪 Lv80+ */}
            {ex && rare80 && [0, 1, 2, 3].map((k) => (
                <div key={k} style={{ position: "absolute", top: 12 + r(k) * 30, left: 24 + r(k + 4) * 160, width: 6, height: 5, borderRadius: "60% 40% 60% 40%", background: "#fbcfe8", opacity: .9, animation: `isPetal ${4.5 + k * .7}s linear ${k * 1.1}s infinite`, zIndex: 4 }} />
            ))}
            {/* 家 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HOUSE_IMG[stage.idx]} alt="house" style={{ width: hw, position: "relative", zIndex: p.house.z, marginBottom: p.house.mb, filter: p.house.shadow }} />
            {/* 窓の灯り（カードのホバーで点く） */}
            {ex && <div className="iq-window" style={{ position: "absolute", bottom: 42 + hw * .3, left: "50%", transform: "translateX(-50%)", width: hw * .55, height: hw * .32, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,224,138,.5), transparent 70%)", opacity: 0, transition: "opacity .3s", zIndex: 2, pointerEvents: "none" }} />}
            {/* 煙 */}
            {ex && stage.idx >= 3 && [0, 1].map((k) => (
                <div key={k} style={{ position: "absolute", bottom: 46 + hw * .62, left: "50%", transform: "translateX(" + (hw * .22) + "px)", width: 8 + k * 3, height: 8 + k * 3, borderRadius: "50%", background: "rgba(255,255,255,.4)", filter: "blur(1.5px)", animation: `isSmoke 3.4s ease-out ${k * 1.4}s infinite`, zIndex: 1 }} />
            ))}
            {/* アバター（主人公） */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarSrc(avatarId)} alt={name} style={{ position: "absolute", bottom: p.avatar.b, left: "50%", transform: `translateX(${p.avatar.tx}px)`, width: p.avatar.size, height: p.avatar.size, objectFit: "cover", borderRadius: "50%", zIndex: ex ? 4 : 2, border: "2px solid rgba(255,255,255,.55)", boxShadow: p.avatar.shadow }} />
            {config.tree && TREE_EMOJI[config.tree] && <div style={{ position: "absolute", bottom: p.tree.b, right: p.tree.r, fontSize: p.tree.fs, zIndex: ex ? 3 : 2, filter: p.tree.shadow }}>{TREE_EMOJI[config.tree]}</div>}
            {config.deco && DECO_EMOJI[config.deco] && <div style={{ position: "absolute", bottom: p.deco.b, left: p.deco.l, fontSize: p.deco.fs, zIndex: ex ? 3 : 2, filter: p.deco.shadow }}>{DECO_EMOJI[config.deco]}</div>}
            {config.sky && SKY_EMOJI[config.sky] && <div style={{ position: "absolute", top: p.sky.t, right: p.sky.r, fontSize: p.sky.fs, zIndex: ex ? 3 : 2, opacity: .95, animation: p.sky.anim }}>{SKY_EMOJI[config.sky]}</div>}
            {config.animal && ANIMAL_EMOJI[config.animal] && <div style={{ position: "absolute", bottom: p.animal.b, left: "50%", transform: `translateX(${p.animal.tx}px)`, fontSize: p.animal.fs, zIndex: ex ? 4 : 3, animation: p.animal.anim, filter: p.animal.shadow }}>{ANIMAL_EMOJI[config.animal]}</div>}
        </div>
    );
}
