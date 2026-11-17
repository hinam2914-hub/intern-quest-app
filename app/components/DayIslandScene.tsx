"use client";
// 「昼の島」シーン（home の自分の島）の描画。Phase 1 で HomeIsland.tsx から描画部分だけを切り出したもの。
// 編集（かざる）の状態や保存は HomeIsland 側が持ち、ここは config を受け取って描くだけ。見た目は移行前と同じ。
import { useRef } from "react";
import { GROUND_TOP, GROUND_IMG, GROUND_PLATFORM, ITEM_IMG, TREE_EMOJI, DECO_EMOJI, SKY_IMG, SKY_EMOJI, ANIMAL_EMOJI, placedOf, skyListOf, baseWidthOf, categoryOf, clampToIsland, type IslandConfig } from "../lib/island";
import { getCastleStage } from "../lib/castle";

export type PetState = { say: string; hop: boolean; onTap: () => void };
/** 飾りつけ画面用：選択中の番号と、選択・移動の通知。これを渡したときだけドラッグできる（他人の島では渡さない） */
export type IslandEdit = { sel: number | null; onSelect: (i: number | null) => void; onMove: (i: number, x: number, y: number) => void; onDrop?: (i: number) => void };
// 島の上面の位置（コンテナ下端からのpx／横は％）。配置座標 x,y(0〜100) をここへ写す。描画とドラッグの両方がこの式を使う
const SURF_CSS = { left: 10, width: 80, bottom: 52, height: 84 };        // CSSで描く土台（草地・花畑）
const SURF_PLATFORM = { left: 11, width: 78, bottom: 36, height: 116 };  // 土台ごと描かれた地面画像（上面が広い）
const EMOJI: Record<string, string> = { ...TREE_EMOJI, ...DECO_EMOJI, ...ANIMAL_EMOJI };
// 空の飾りの置き場所（島の景観を邪魔しない位置に固定）
const SKY_POS: Record<string, React.CSSProperties> = {
    sky_niji: { bottom: 112, left: "50%", transform: "translateX(-50%)", width: "96%", opacity: .92 },
    sky_hikari: { bottom: 96, left: "50%", transform: "translateX(-50%)", width: "92%", opacity: .95 },
    sky_chocho: { top: 6, left: "2%", width: "34%" },
    sky_fuusen: { top: 0, right: "3%", width: "20%" },
};

export default function DayIslandScene({ config, totalEarned, onHouseClick, pet, width = "min(88vw, 420px)", flat = false, houseSm = false, lite = false, edit }: {
    config: IslandConfig;
    totalEarned: number;
    onHouseClick?: () => void;
    /** どうぶつのタップ反応（HomeIsland が状態を持つ） */
    pet?: PetState;
    /** 島の横幅（home は画面幅に追従、ロビーでは固定幅で使う） */
    width?: string | number;
    /** ロビー AREA 用：島の台座（影・側面・上面）を描かず、家と飾りを地面に直接置く */
    flat?: boolean;
    /** 家画像の 512px 版（/island/house/sm/）を使う */
    houseSm?: boolean;
    /** スマホのロビー用：filter（影・ぼかし）とアニメーションを使わない */
    lite?: boolean;
    edit?: IslandEdit;
}) {
    const view = config;
    const placed = placedOf(config);
    const skies = skyListOf(config);
    const platform = !flat && !!view.ground && GROUND_PLATFORM.has(view.ground) && !!GROUND_IMG[view.ground];
    const SURF = platform ? SURF_PLATFORM : SURF_CSS;
    const still = lite || !!edit;   // 編集中は島を揺らさない（ドラッグしやすくする）
    const boxRef = useRef<HTMLDivElement>(null);
    const drag = useRef<{ i: number; moved: boolean; dx: number; dy: number } | null>(null);   // dx,dy＝つかんだ位置とアイテムの足元のずれ
    // 画面上の位置 → 島の上の座標（0〜100）
    const toXY = (e: React.PointerEvent) => {
        const el = boxRef.current!; const r = el.getBoundingClientRect();
        const k = r.width / (el.offsetWidth || r.width) || 1;   // 拡大表示（zoom）されているときの倍率
        return { x: ((e.clientX - r.left) / r.width * 100 - SURF.left) / SURF.width * 100, y: 100 - ((r.bottom - e.clientY) / k - SURF.bottom) / SURF.height * 100 };
    };
    const firstAnimal = placed.findIndex((p) => categoryOf(p.k) === "animal");
    const castle = getCastleStage(totalEarned);   // 城はレベル連動の5段階（lib/castle.ts で一元管理）
    return (
        <>
            <style>{`
                @keyframes dsFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
                @keyframes dsPet { 0%,100%{translate:0 0} 50%{translate:0 -3px} }
                @media (prefers-reduced-motion: reduce) { .ds-pet { animation: none !important; } }
                @keyframes dsPetShadow { 0%,100%{transform:translateX(-50%) scaleX(1)} 50%{transform:translateX(-50%) scaleX(.8)} }
                @keyframes dsHop { 0%{translate:0 0} 40%{translate:0 -14px} 100%{translate:0 0} }
                @keyframes dsPop { 0%{transform:scale(.2);opacity:0} 70%{transform:scale(1.14)} 100%{transform:scale(1);opacity:1} }
            `}</style>
            <div ref={boxRef} onPointerDown={edit ? () => edit.onSelect(null) : undefined} style={{ position: "relative", minHeight: 265, width, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", animation: still ? undefined : "dsFloat 6s ease-in-out infinite", touchAction: edit ? "none" : undefined }}>
                {/* 空の飾り（最大2つ・位置は固定） */}
                {skies.map((k) => SKY_IMG[k]
                    ? <img key={"sky" + k} src={SKY_IMG[k]} alt="" style={{ position: "absolute", zIndex: 2, pointerEvents: "none", animation: still ? undefined : "dsPop .5s ease-out", ...(SKY_POS[k] || { top: 0, right: "6%", width: "22%" }) }} />
                    : SKY_EMOJI[k] ? <div key={"sky" + k} style={{ position: "absolute", top: 4, right: "14%", fontSize: 30, zIndex: 2, pointerEvents: "none" }}>{SKY_EMOJI[k]}</div> : null)}

                {/* 島の影（浮遊感・薄青紫） */}
                {!flat && <div style={{ position: "absolute", bottom: -26, left: "50%", transform: "translateX(-50%)", width: "62%", height: 24, borderRadius: "50%", background: "rgba(130,125,200,.32)", filter: lite ? undefined : "blur(13px)", zIndex: 0 }} />}

                {/* 島の側面（草の縁→明茶→濃茶の層＋丸い下端） */}
                {!flat && !platform && <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", width: "76%", height: 66, borderRadius: "8% 8% 50% 50% / 12% 12% 100% 100%", background: "linear-gradient(180deg, #7ec95f 0%, #a5814f 16%, #8a6a48 45%, #5c4330 82%, #4a3626 100%)", zIndex: 1 }}>
                    {[{ l: "22%", b: 12, w: 9 }, { l: "58%", b: 7, w: 7 }, { l: "76%", b: 15, w: 8 }].map((r, k) => (
                        <div key={k} style={{ position: "absolute", left: r.l, bottom: r.b, width: r.w, height: r.w * .72, borderRadius: "44%", background: "rgba(120,120,130,.55)" }} />
                    ))}
                </div>}

                {/* 島の上面（奥暗→手前明の草地） */}
                {!flat && !platform && <div style={{ position: "absolute", bottom: 46, left: "50%", transform: "translateX(-50%)", width: "88%", height: 96, borderRadius: "50%", background: (view.ground && GROUND_TOP[view.ground]) || "radial-gradient(ellipse at 50% 42%, #baf28b 0%, #83d96d 55%, #54b967 100%)", boxShadow: "inset 0 3px 5px rgba(255,255,255,.35), inset 0 -8px 12px rgba(50,100,40,.3)", zIndex: 2 }}>
                    {view.ground && GROUND_IMG[view.ground] && <img src={GROUND_IMG[view.ground]} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill", borderRadius: "50%", zIndex: 1, pointerEvents: "none" }} />}
                    {/* 環境装飾：草・花・石（小さく控えめ） */}
                    {[{ l: "12%", t: "48%", e: "🌿", s: 12 }, { l: "84%", t: "40%", e: "🌿", s: 11 }, { l: "26%", t: "70%", e: "🌿", s: 10 }, { l: "70%", t: "76%", e: "🌿", s: 11 }].map((g, k) => (
                        <div key={"g" + k} style={{ position: "absolute", left: g.l, top: g.t, fontSize: g.s, opacity: .85 }}>{g.e}</div>
                    ))}
                    {[{ l: "18%", t: "58%" }, { l: "78%", t: "62%" }].map((f, k) => (
                        <div key={"f" + k} style={{ position: "absolute", left: f.l, top: f.t, width: 5, height: 5, borderRadius: "50%", background: k === 0 ? "#f472b6" : "#fbbf24", boxShadow: "0 0 3px rgba(255,255,255,.5)" }} />
                    ))}
                    {[{ l: "34%", t: "80%" }, { l: "62%", t: "44%" }].map((r, k) => (
                        <div key={"r" + k} style={{ position: "absolute", left: r.l, top: r.t, width: 8, height: 6, borderRadius: "46%", background: "#a8a49a", boxShadow: "inset 0 -2px 2px rgba(0,0,0,.18)" }} />
                    ))}
                    {/* 地面アイテム別の追加装飾 */}
                    {view.ground === "ground_hanabatake" && [{ l: "30%", t: "36%" }, { l: "55%", t: "78%" }, { l: "68%", t: "34%" }, { l: "44%", t: "62%" }].map((f, k) => (
                        <div key={"hb" + k} style={{ position: "absolute", left: f.l, top: f.t, fontSize: 11 }}>🌼</div>
                    ))}
                    {view.ground === "ground_yukihara" && [{ l: "28%", t: "40%" }, { l: "60%", t: "68%" }, { l: "74%", t: "38%" }].map((f, k) => (
                        <div key={"yk" + k} style={{ position: "absolute", left: f.l, top: f.t, width: 4, height: 4, borderRadius: "50%", background: "#fff", boxShadow: "0 0 4px rgba(255,255,255,.9)" }} />
                    ))}
                    {view.ground === "ground_sunahama" && <div style={{ position: "absolute", inset: "6% 4%", borderRadius: "50%", border: "3px dashed rgba(255,255,255,.55)", pointerEvents: "none" }} />}
                    {view.ground === "ground_momiji" && [{ l: "26%", t: "44%" }, { l: "64%", t: "72%" }, { l: "76%", t: "42%" }].map((f, k) => (
                        <div key={"mj" + k} style={{ position: "absolute", left: f.l, top: f.t, fontSize: 10 }}>🍂</div>
                    ))}
                </div>}

                {/* 土台ごと描かれた地面（雪原・砂浜・紅葉・石畳・魔法陣）：画像をそのまま島として表示 */}
                {platform && <img src={GROUND_IMG[view.ground]} alt="" style={{ position: "absolute", bottom: -22, left: "50%", transform: "translateX(-50%)", width: "96%", height: "auto", zIndex: 1, pointerEvents: "none" }} />}

                {flat && <div style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)", width: "60%", height: 70, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(60,90,45,.28), rgba(60,90,45,0) 70%)", filter: lite ? undefined : "blur(6px)", zIndex: 2 }} />}
                {/* 家の足元影 */}
                <div style={{ position: "absolute", bottom: 66, left: "50%", transform: "translateX(-50%)", width: castle.w * .82, height: 15, borderRadius: "50%", background: "rgba(60,90,45,.32)", filter: lite ? undefined : "blur(5px)", zIndex: 3 }} />
                {/* 城（レベルで5段階成長。縦横比は画像のまま、幅だけ段階ごとに指定） */}
                <div onClick={onHouseClick} style={{ position: "relative", zIndex: 4, marginBottom: 62, cursor: onHouseClick ? "pointer" : "default", pointerEvents: edit ? "none" : undefined }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={castle.img} alt="castle" style={{ width: castle.w, height: "auto", display: "block", filter: lite ? undefined : "drop-shadow(0 6px 9px rgba(60,50,30,.26))" }} />
                </div>
                {/* 小道（家の扉下→手前、遠近台形） */}
                {!platform && <div style={{ position: "absolute", bottom: 48, left: "50%", transform: "translateX(-50%)", width: 58, height: 42, clipPath: "polygon(38% 0, 62% 0, 92% 100%, 8% 100%)", background: "linear-gradient(180deg, #e6d3a8, #d4bc8a)", opacity: .92, zIndex: 3 }} />}

                {/* 置いたアイテム（木・植物／建物・装飾／動物）。奥（y小）ほど後ろ、手前ほど前に描く */}
                {placed.map((p, i) => ({ p, i })).sort((a, b) => a.p.y - b.p.y).map(({ p, i }) => {
                    const cat = categoryOf(p.k); const img = ITEM_IMG[p.k]; const w = baseWidthOf(p.k) * (p.s || 1);
                    const behind = p.y < 46;   // 城より奥
                    const selected = edit?.sel === i;
                    const animal = cat === "animal";
                    if (!img && !EMOJI[p.k]) return null;
                    return (
                        <div key={i + p.k}
                            onClick={!edit && animal ? pet?.onTap : undefined}
                            onPointerDown={edit ? (e) => { e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); const q = toXY(e); drag.current = { i, moved: false, dx: p.x - q.x, dy: p.y - q.y }; edit.onSelect(i); } : undefined}
                            onPointerMove={edit ? (e) => { if (drag.current?.i !== i) return; const d = drag.current; d.moved = true; const q = clampToIsland(toXY(e).x + d.dx, toXY(e).y + d.dy); edit.onMove(i, q.x, q.y); } : undefined}
                            onPointerUp={edit ? () => { const d = drag.current; drag.current = null; if (d?.moved) edit.onDrop?.(i); } : undefined}
                            onPointerCancel={edit ? () => { drag.current = null; } : undefined}
                            style={{ position: "absolute", left: `${SURF.left + p.x / 100 * SURF.width}%`, bottom: SURF.bottom + (100 - p.y) / 100 * SURF.height, width: `${w}%`, transform: "translateX(-50%)", zIndex: (behind ? 3 : 5) + (selected ? 20 : 0), order: p.y,
                                cursor: edit ? "grab" : animal && pet ? "pointer" : "default", touchAction: edit ? "none" : undefined,
                                outline: selected ? "3px dashed #1454B8" : undefined, outlineOffset: 3, borderRadius: 10 }}>
                            {animal && i === firstAnimal && pet?.say && <div style={{ position: "absolute", top: -30, left: "50%", transform: "translateX(-50%)", padding: "4px 10px", borderRadius: 10, background: "rgba(255,255,255,.95)", color: "#4a3a2a", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap", boxShadow: "0 2px 6px rgba(0,0,0,.15)", zIndex: 9 }}>{pet.say}</div>}
                            <div style={{ position: "absolute", bottom: -2, left: "50%", transform: "translateX(-50%)", width: "70%", height: animal ? 7 : 11, borderRadius: "50%", background: "rgba(45,80,40,.32)", filter: lite ? undefined : "blur(4px)" }} />
                            {img
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img className={animal ? "ds-pet" : undefined} src={img} alt="" draggable={false} style={{ width: "100%", height: "auto", display: "block", position: "relative", transform: p.f ? "scaleX(-1)" : undefined, userSelect: "none", pointerEvents: "none",
                                    animation: still ? undefined : animal ? (pet?.hop ? "dsHop .7s ease-out" : `dsPet ${3 + (i % 3) * 0.4}s ease-in-out infinite`) : undefined, filter: lite ? undefined : "drop-shadow(0 4px 5px rgba(0,0,0,.22))" }} />
                                : <div style={{ fontSize: 30, textAlign: "center", position: "relative" }}>{EMOJI[p.k]}</div>}
                        </div>
                    );
                })}
            </div>
        </>
    );
}
