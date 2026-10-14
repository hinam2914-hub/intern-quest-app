"use client";
// 「昼の島」シーン（home の自分の島）の描画。Phase 1 で HomeIsland.tsx から描画部分だけを切り出したもの。
// 編集（かざる）の状態や保存は HomeIsland 側が持ち、ここは config を受け取って描くだけ。見た目は移行前と同じ。
import { getHouseStage, HOUSE_IMG, GROUND_TOP, GROUND_IMG, TREE_IMG, TREE_EMOJI, DECO_IMG, DECO_EMOJI, SKY_IMG, SKY_EMOJI, ANIMAL_IMG, ANIMAL_EMOJI, type IslandConfig } from "../lib/island";

const HOUSE_W: number[] = [104, 112, 120, 128, 134, 130];

export type PetState = { say: string; hop: boolean; onTap: () => void };

export default function DayIslandScene({ config, totalEarned, onHouseClick, pet, width = "min(88vw, 420px)", flat = false, houseSm = false, lite = false }: {
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
}) {
    const view = config;
    const stage = getHouseStage(totalEarned);
    return (
        <>
            <style>{`
                @keyframes dsFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
                @keyframes dsPet { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
                @media (prefers-reduced-motion: reduce) { .ds-pet { animation: none !important; } }
                @keyframes dsPetShadow { 0%,100%{transform:translateX(-50%) scaleX(1)} 50%{transform:translateX(-50%) scaleX(.8)} }
                @keyframes dsHop { 0%{transform:translateY(0)} 40%{transform:translateY(-14px)} 100%{transform:translateY(0)} }
                @keyframes dsPop { 0%{transform:scale(.2);opacity:0} 70%{transform:scale(1.14)} 100%{transform:scale(1);opacity:1} }
            `}</style>
            <div style={{ position: "relative", minHeight: 265, width, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", animation: lite ? undefined : "dsFloat 6s ease-in-out infinite" }}>
                {/* 空アイテム */}
                {view.sky && (SKY_IMG[view.sky] ? (view.sky === "sky_niji" ? <img key={"sky" + view.sky} src={SKY_IMG[view.sky]} alt="" style={{ position: "absolute", bottom: 112, left: "50%", transform: "translateX(-50%)", width: "96%", zIndex: 2, pointerEvents: "none", opacity: .92, animation: lite ? undefined : "dsPop .5s ease-out" }} /> : <img key={"sky" + view.sky} src={SKY_IMG[view.sky]} alt="" style={{ position: "absolute", top: "6%", right: "10%", width: "16%", zIndex: 6, pointerEvents: "none", animation: lite ? undefined : "dsFloat 5s ease-in-out infinite, dsPop .5s ease-out" }} />) : (SKY_EMOJI[view.sky] && <div key={"sky" + view.sky} style={{ position: "absolute", top: 0, right: "24%", fontSize: 42, zIndex: 1, animation: lite ? undefined : "dsFloat 5s ease-in-out infinite, dsPop .5s ease-out" }}>{SKY_EMOJI[view.sky]}</div>))}

                {/* 島の影（浮遊感・薄青紫） */}
                {!flat && <div style={{ position: "absolute", bottom: -26, left: "50%", transform: "translateX(-50%)", width: "62%", height: 24, borderRadius: "50%", background: "rgba(130,125,200,.32)", filter: lite ? undefined : "blur(13px)", zIndex: 0 }} />}

                {/* 島の側面（草の縁→明茶→濃茶の層＋丸い下端） */}
                {!flat && <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", width: "76%", height: 66, borderRadius: "8% 8% 50% 50% / 12% 12% 100% 100%", background: "linear-gradient(180deg, #7ec95f 0%, #a5814f 16%, #8a6a48 45%, #5c4330 82%, #4a3626 100%)", zIndex: 1 }}>
                    {[{ l: "22%", b: 12, w: 9 }, { l: "58%", b: 7, w: 7 }, { l: "76%", b: 15, w: 8 }].map((r, k) => (
                        <div key={k} style={{ position: "absolute", left: r.l, bottom: r.b, width: r.w, height: r.w * .72, borderRadius: "44%", background: "rgba(120,120,130,.55)" }} />
                    ))}
                </div>}

                {/* 島の上面（奥暗→手前明の草地） */}
                {!flat && <div style={{ position: "absolute", bottom: 46, left: "50%", transform: "translateX(-50%)", width: "88%", height: 96, borderRadius: "50%", background: (view.ground && GROUND_TOP[view.ground]) || "radial-gradient(ellipse at 50% 42%, #baf28b 0%, #83d96d 55%, #54b967 100%)", boxShadow: "inset 0 3px 5px rgba(255,255,255,.35), inset 0 -8px 12px rgba(50,100,40,.3)", zIndex: 2 }}>
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

                {/* 木（家の左奥・上面より手前レイヤー） */}
                {view.tree && (TREE_IMG[view.tree] ? <div key={"tree" + view.tree} style={{ position: "absolute", bottom: 86, left: "5%", width: "36%", zIndex: 3, animation: lite ? undefined : "dsPop .5s ease-out" }}><div style={{ position: "absolute", bottom: -3, left: "50%", transform: "translateX(-50%)", width: "68%", height: 12, borderRadius: "50%", background: "rgba(45,80,40,.36)", filter: lite ? undefined : "blur(5px)" }} /><img src={TREE_IMG[view.tree]} alt="" style={{ width: "100%", display: "block", position: "relative", filter: lite ? undefined : "drop-shadow(0 4px 6px rgba(0,0,0,.2))" }} /></div> : (TREE_EMOJI[view.tree] && <div key={"tree" + view.tree} style={{ position: "absolute", bottom: 104, left: "17%", fontSize: 46, zIndex: 3, filter: lite ? undefined : "drop-shadow(0 4px 5px rgba(0,0,0,.25))", animation: lite ? undefined : "dsPop .5s ease-out" }}>{TREE_EMOJI[view.tree]}</div>))}

                {flat && <div style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)", width: "60%", height: 70, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(60,90,45,.28), rgba(60,90,45,0) 70%)", filter: lite ? undefined : "blur(6px)", zIndex: 2 }} />}
                {/* 家の足元影 */}
                <div style={{ position: "absolute", bottom: 66, left: "50%", transform: "translateX(-50%)", width: HOUSE_W[stage.idx] * .82, height: 15, borderRadius: "50%", background: "rgba(60,90,45,.32)", filter: lite ? undefined : "blur(5px)", zIndex: 3 }} />
                {/* 家（中央より少し奥＝上面の上寄り） */}
                <div onClick={onHouseClick} style={{ position: "relative", zIndex: 4, marginBottom: 62, cursor: onHouseClick ? "pointer" : "default" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={houseSm ? HOUSE_IMG[stage.idx].replace("/island/house/", "/island/house/sm/") : HOUSE_IMG[stage.idx]} alt="house" style={{ width: HOUSE_W[stage.idx], display: "block", filter: lite ? undefined : "drop-shadow(0 6px 9px rgba(60,50,30,.26))" }} />
                </div>
                {/* 小道（家の扉下→手前、遠近台形） */}
                <div style={{ position: "absolute", bottom: 48, left: "50%", transform: "translateX(-50%)", width: 58, height: 42, clipPath: "polygon(38% 0, 62% 0, 92% 100%, 8% 100%)", background: "linear-gradient(180deg, #e6d3a8, #d4bc8a)", opacity: .92, zIndex: 3 }} />

                {/* デコ（家の右手前） */}
                {view.deco && (DECO_IMG[view.deco] ? (
                    <div key={"deco" + view.deco} style={{ position: "absolute", bottom: 70, right: "5%", width: "26%", zIndex: 5, animation: lite ? undefined : "dsPop .5s ease-out" }}>
                        <div style={{ position: "absolute", bottom: -3, left: "50%", transform: "translateX(-50%)", width: "80%", height: 12, borderRadius: "50%", background: "rgba(45,80,40,.36)", filter: lite ? undefined : "blur(5px)" }} />
                        <img src={DECO_IMG[view.deco]} alt="" style={{ width: "100%", display: "block", position: "relative", filter: lite ? undefined : "drop-shadow(0 4px 6px rgba(0,0,0,.2))" }} />
                    </div>
                ) : (DECO_EMOJI[view.deco] && (
                    <div key={"deco" + view.deco} style={{ position: "absolute", bottom: 62, right: "20%", zIndex: 5, textAlign: "center", animation: lite ? undefined : "dsPop .5s ease-out" }}>
                        <div style={{ fontSize: 30, filter: lite ? undefined : "drop-shadow(0 2px 3px rgba(0,0,0,.25))" }}>{DECO_EMOJI[view.deco]}</div>
                        <div style={{ width: 22, height: 6, margin: "0 auto", borderRadius: "50%", background: "rgba(60,90,45,.3)", filter: lite ? undefined : "blur(2px)" }} />
                    </div>
                )))}
                {/* どうぶつ（家の右手前・小道の右横） */}
                {view.animal && ANIMAL_EMOJI[view.animal] && (
                    <div key={"animal" + view.animal} onClick={pet?.onTap} style={{ position: "absolute", left: "68%", top: "58%", zIndex: 8, cursor: pet ? "pointer" : "default", textAlign: "center", transform: view.animal === "animal_inu" ? "scaleX(-1)" : "none" }}>
                        {pet?.say && <div style={{ position: "absolute", top: -30, left: "50%", transform: view.animal === "animal_inu" ? "translateX(-50%) scaleX(-1)" : "translateX(-50%)", padding: "4px 10px", borderRadius: 10, background: "rgba(255,255,255,.95)", color: "#4a3a2a", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap", boxShadow: "0 2px 6px rgba(0,0,0,.2)", zIndex: 9 }}>{pet.say}</div>}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="ds-pet" src={ANIMAL_IMG[view.animal]} alt="" style={{ width: 58, height: 58, objectFit: "contain", display: "block", animation: lite ? undefined : pet?.hop ? "dsHop .7s ease-out" : "dsPet 3.2s ease-in-out infinite", filter: lite ? undefined : "drop-shadow(0 3px 4px rgba(0,0,0,.3))" }} />
                        <div className="ds-pet" style={{ width: 26, height: 7, margin: "-2px auto 0", borderRadius: "50%", background: "rgba(64,49,35,.22)", filter: lite ? undefined : "blur(5px)", animation: lite ? undefined : "dsPetShadow 3.2s ease-in-out infinite" }} />
                    </div>
                )}
            </div>
        </>
    );
}
