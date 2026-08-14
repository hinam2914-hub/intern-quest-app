"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getHouseStage } from "./DotHouse";

type ShopItem = { id: string; name: string; category: string; emoji: string | null; css_key: string; price: number; rarity: string };
type Cfg = Record<string, string>;

const CATS: string[] = ["ground", "tree", "deco", "sky", "animal"];
const CAT_LABEL: Record<string, string> = { ground: "🌍 地面", tree: "🌲 木", deco: "🪑 デコ", sky: "✨ 空", animal: "🐾 どうぶつ" };
const HOUSE_IMG: string[] = ["/island/house/0_tent.png", "/island/house/1_cabin.png", "/island/house/2_house.png", "/island/house/3_big.png", "/island/house/4_mansion.png", "/island/house/5_castle.png"];
const HOUSE_W: number[] = [104, 112, 120, 128, 134, 130];
const GROUND_TOP: Record<string, string> = {
    ground_hanabatake: "linear-gradient(180deg, #a3e88a, #6cc255)",
    ground_yukihara: "linear-gradient(180deg, #f4f9ff, #d3e3f2)",
    ground_sunahama: "linear-gradient(180deg, #fbe6a8, #ecc264)",
    ground_momiji: "linear-gradient(180deg, #f6b878, #e07d3a)",
};
const TREE_EMOJI: Record<string, string> = { tree_sakura: "🌸", tree_yashi: "🌴", tree_momi: "🎄", tree_momiji: "🍁" };
const DECO_EMOJI: Record<string, string> = { deco_funsui: "⛲", deco_bench: "🪑", deco_gaitou: "💡", deco_yukidaruma: "⛄", deco_torii: "⛩️" };
const SKY_EMOJI: Record<string, string> = { sky_niji: "🌈", sky_chocho: "🦋", sky_fuusen: "🎈" };
const ANIMAL_EMOJI: Record<string, string> = { animal_neko: "🐈", animal_inu: "🐕" };
const ANIMAL_IMG: Record<string, string> = { animal_neko: "/island/animals/cat.png", animal_inu: "/island/animals/dog.png" };
const ANIMAL_NAME: Record<string, string> = { animal_neko: "ねこ", animal_inu: "いぬ" };

export default function HomeIsland({ userId, totalEarned, onHouseClick }: { userId: string; totalEarned: number; onHouseClick?: () => void }) {
    const router = useRouter();
    const [items, setItems] = useState<ShopItem[]>([]);
    const [owned, setOwned] = useState<string[]>([]);
    const [config, setConfig] = useState<Cfg>({});
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<Cfg>({});
    const [tab, setTab] = useState<string>("ground");
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState("");
    const [detail, setDetail] = useState<ShopItem | null>(null);
    const [petHop, setPetHop] = useState(false);
    const [petSay, setPetSay] = useState("");

    useEffect(() => {
        if (!userId) return;
        (async () => {
            const [{ data: prow }, { data: its }, { data: pur }] = await Promise.all([
                supabase.from("profiles").select("island_config").eq("id", userId).maybeSingle(),
                supabase.from("island_items").select("*").eq("is_active", true).order("sort_order"),
                supabase.from("island_purchases").select("item_id, status").eq("user_id", userId),
            ]);
            setConfig(((prow as any) && (prow as any).island_config) || {});
            setItems((its || []) as ShopItem[]);
            setOwned((pur || []).filter((p: any) => p.status === "approved").map((p: any) => p.item_id));
        })();
    }, [userId]);

    const view = editing ? draft : config;
    const stage = getHouseStage(totalEarned);
    const nextName = stage.nextName;
    const startEdit = () => { setDraft({ ...config }); setEditing(true); setToast(""); };
    const cancelEdit = () => { setEditing(false); setToast(""); };
    const tapItem = (it: ShopItem) => {
        if (!owned.includes(it.id)) { setDetail(it); return; }
        const d = { ...draft };
        if (d[it.category] === it.css_key) { delete d[it.category]; } else { d[it.category] = it.css_key; }
        setDraft(d);
    };
    const save = async () => {
        if (saving) return;
        setSaving(true);
        const { error } = await supabase.from("profiles").update({ island_config: draft }).eq("id", userId);
        setSaving(false);
        if (error) { setToast("保存に失敗しました"); setTimeout(() => setToast(""), 3000); return; }
        setConfig({ ...draft });
        setEditing(false);
        setToast("島を更新しました ✨");
        setTimeout(() => setToast(""), 2500);
    };
    const tapPet = () => {
        if (!view.animal) return;
        setPetHop(true);
        setPetSay(view.animal === "animal_inu" ? "わん！" : "にゃ！");
        setTimeout(() => setPetSay(""), 1300);
        setTimeout(() => setPetHop(false), 700);
        setTimeout(() => setToast(""), 1800);
    };

    return (
        <div style={{ width: "100%", position: "relative" }}>
            <style>{`
                @keyframes hiCloud { 0%{transform:translateX(-30px)} 100%{transform:translateX(30px)} }
                @keyframes hiFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
                @keyframes hiPet { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
                @media (prefers-reduced-motion: reduce) { .hi-pet { animation: none !important; } }
                @keyframes hiPetShadow { 0%,100%{transform:translateX(-50%) scaleX(1)} 50%{transform:translateX(-50%) scaleX(.8)} }
                @keyframes hiHop { 0%{transform:translateY(0)} 40%{transform:translateY(-14px)} 100%{transform:translateY(0)} }
                @keyframes hiPop { 0%{transform:scale(.2);opacity:0} 70%{transform:scale(1.14)} 100%{transform:scale(1);opacity:1} }
                @keyframes hiToast { 0%{opacity:0;transform:translate(-50%,6px)} 15%{opacity:1;transform:translate(-50%,0)} 85%{opacity:1} 100%{opacity:0} }
                .hi-scroll::-webkit-scrollbar { height: 5px; }
                .hi-scroll::-webkit-scrollbar-thumb { background: rgba(139,92,246,.4); border-radius: 999px; }
            `}</style>

            <div style={{ position: "relative", padding: "8px 0 0" }}>

                <div style={{ position: "relative", minHeight: 265, width: "min(88vw, 420px)", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", animation: "hiFloat 6s ease-in-out infinite" }}>
                    {/* 空アイテム */}
                    {view.sky && SKY_EMOJI[view.sky] && <div key={"sky" + view.sky} style={{ position: "absolute", top: 0, right: "24%", fontSize: 42, zIndex: 1, animation: "hiFloat 5s ease-in-out infinite, hiPop .5s ease-out" }}>{SKY_EMOJI[view.sky]}</div>}

                    {/* 島の影（浮遊感・薄青紫） */}
                    <div style={{ position: "absolute", bottom: -26, left: "50%", transform: "translateX(-50%)", width: "62%", height: 24, borderRadius: "50%", background: "rgba(130,125,200,.32)", filter: "blur(13px)", zIndex: 0 }} />

                    {/* 島の側面（草の縁→明茶→濃茶の層＋丸い下端） */}
                    <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", width: "76%", height: 66, borderRadius: "8% 8% 50% 50% / 12% 12% 100% 100%", background: "linear-gradient(180deg, #7ec95f 0%, #a5814f 16%, #8a6a48 45%, #5c4330 82%, #4a3626 100%)", zIndex: 1 }}>
                        {[{ l: "22%", b: 12, w: 9 }, { l: "58%", b: 7, w: 7 }, { l: "76%", b: 15, w: 8 }].map((r, k) => (
                            <div key={k} style={{ position: "absolute", left: r.l, bottom: r.b, width: r.w, height: r.w * .72, borderRadius: "44%", background: "rgba(120,120,130,.55)" }} />
                        ))}
                    </div>

                    {/* 島の上面（奥暗→手前明の草地） */}
                    <div style={{ position: "absolute", bottom: 46, left: "50%", transform: "translateX(-50%)", width: "88%", height: 96, borderRadius: "50%", background: (view.ground && GROUND_TOP[view.ground]) || "radial-gradient(ellipse at 50% 42%, #baf28b 0%, #83d96d 55%, #54b967 100%)", boxShadow: "inset 0 3px 5px rgba(255,255,255,.35), inset 0 -8px 12px rgba(50,100,40,.3)", zIndex: 2 }}>
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
                    </div>

                    {/* 木（家の左奥・上面より手前レイヤー） */}
                    {view.tree && TREE_EMOJI[view.tree] && <div key={"tree" + view.tree} style={{ position: "absolute", bottom: 104, left: "17%", fontSize: 46, zIndex: 3, filter: "drop-shadow(0 4px 5px rgba(0,0,0,.25))", animation: "hiPop .5s ease-out" }}>{TREE_EMOJI[view.tree]}</div>}

                    {/* 家の足元影 */}
                    <div style={{ position: "absolute", bottom: 66, left: "50%", transform: "translateX(-50%)", width: HOUSE_W[stage.idx] * .82, height: 15, borderRadius: "50%", background: "rgba(60,90,45,.32)", filter: "blur(5px)", zIndex: 3 }} />
                    {/* 家（中央より少し奥＝上面の上寄り） */}
                    <div onClick={onHouseClick} style={{ position: "relative", zIndex: 4, marginBottom: 62, cursor: onHouseClick ? "pointer" : "default" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={HOUSE_IMG[stage.idx]} alt="house" style={{ width: HOUSE_W[stage.idx], display: "block", filter: "drop-shadow(0 6px 9px rgba(60,50,30,.26))" }} />
                    </div>
                    {/* 小道（家の扉下→手前、遠近台形） */}
                    <div style={{ position: "absolute", bottom: 48, left: "50%", transform: "translateX(-50%)", width: 58, height: 42, clipPath: "polygon(38% 0, 62% 0, 92% 100%, 8% 100%)", background: "linear-gradient(180deg, #e6d3a8, #d4bc8a)", opacity: .92, zIndex: 3 }} />

                    {/* デコ（家の右手前） */}
                    {view.deco && DECO_EMOJI[view.deco] && (
                        <div key={"deco" + view.deco} style={{ position: "absolute", bottom: 62, right: "20%", zIndex: 5, textAlign: "center", animation: "hiPop .5s ease-out" }}>
                            <div style={{ fontSize: 30, filter: "drop-shadow(0 2px 3px rgba(0,0,0,.25))" }}>{DECO_EMOJI[view.deco]}</div>
                            <div style={{ width: 22, height: 6, margin: "0 auto", borderRadius: "50%", background: "rgba(60,90,45,.3)", filter: "blur(2px)" }} />
                        </div>
                    )}
                    {/* どうぶつ（家の右手前・小道の右横） */}
                    {view.animal && ANIMAL_EMOJI[view.animal] && (
                        <div key={"animal" + view.animal} onClick={tapPet} style={{ position: "absolute", left: "68%", top: "58%", zIndex: 8, cursor: "pointer", textAlign: "center", transform: view.animal === "animal_inu" ? "scaleX(-1)" : "none" }}>
                            {petSay && <div style={{ position: "absolute", top: -30, left: "50%", transform: view.animal === "animal_inu" ? "translateX(-50%) scaleX(-1)" : "translateX(-50%)", padding: "4px 10px", borderRadius: 10, background: "rgba(255,255,255,.95)", color: "#4a3a2a", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap", boxShadow: "0 2px 6px rgba(0,0,0,.2)", zIndex: 9 }}>{petSay}</div>}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img className="hi-pet" src={ANIMAL_IMG[view.animal]} alt="" style={{ width: 58, height: 58, objectFit: "contain", display: "block", animation: petHop ? "hiHop .7s ease-out" : "hiPet 3.2s ease-in-out infinite", filter: "drop-shadow(0 3px 4px rgba(0,0,0,.3))" }} />
                            <div className="hi-pet" style={{ width: 26, height: 7, margin: "-2px auto 0", borderRadius: "50%", background: "rgba(64,49,35,.22)", filter: "blur(5px)", animation: "hiPetShadow 3.2s ease-in-out infinite" }} />
                        </div>
                    )}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: "#7c5a2b", background: "rgba(255,255,255,.75)", border: "1px solid rgba(255,180,92,.45)", padding: "6px 14px", borderRadius: 999 }}>🏝️ 島コレクション {owned.length}/{items.length}</div>
                </div>

                {!editing && (
                    <>
                        <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 14, background: "rgba(255,255,255,.7)", border: "1px solid rgba(255,180,92,.35)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 800, color: "#7a5a2b" }}>{stage.isMax ? "👑 GOAL達成！" : (nextName ? "🏠 " + nextName + "まで" : "GOALまで")}</span>
                                <span style={{ fontSize: 11, fontWeight: 800, color: "#e8590c" }}>{stage.isMax ? "MAX！" : "あと " + stage.toNext.toLocaleString() + "pt"}</span>
                            </div>
                            <div style={{ height: 9, background: "rgba(150,110,50,.18)", borderRadius: 6, overflow: "hidden" }}>
                                <div style={{ width: stage.progress + "%", height: "100%", background: "linear-gradient(180deg, #8ee04a, #5cbf2a)", borderRadius: 6, transition: "width 1s ease" }} />
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
                            <button onClick={startEdit} style={{ padding: "12px 30px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 14.5, fontWeight: 900, background: "linear-gradient(135deg, #a78bfa, #8b5cf6)", color: "#fff", boxShadow: "0 6px 18px rgba(139,92,246,.5)" }}>🎨 島をかざる</button>
                            <button onClick={() => router.push("/shop")} style={{ padding: "12px 20px", borderRadius: 999, border: "1px solid rgba(255,180,92,.5)", cursor: "pointer", fontSize: 14, fontWeight: 800, background: "rgba(255,255,255,.65)", color: "#c2410c" }}>🛍️ ショップ</button>
                        </div>
                    </>
                )}
            </div>

            {toast && <div style={{ position: "absolute", top: 12, left: "50%", zIndex: 30, padding: "8px 18px", borderRadius: 999, background: "rgba(30,20,50,.92)", color: "#fff", fontSize: 13, fontWeight: 800, animation: "hiToast 2s ease-out", whiteSpace: "nowrap" }}>{toast}</div>}

            {editing && (
                <div style={{ marginTop: 16, borderRadius: 18, background: "rgba(11,11,20,.94)", border: "1px solid rgba(139,92,246,.4)", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                        <button onClick={cancelEdit} style={{ border: "none", background: "transparent", color: "#9ca3af", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>やめる</button>
                        <span style={{ fontSize: 14, fontWeight: 900, color: "#f4f2ff" }}>🏝️ 島をかざる</span>
                        <button onClick={save} disabled={saving} style={{ border: "none", background: "linear-gradient(135deg, #34d399, #10b981)", color: "#052e22", fontSize: 13, fontWeight: 900, cursor: "pointer", padding: "7px 16px", borderRadius: 999, opacity: saving ? .6 : 1 }}>{saving ? "保存中..." : "保存"}</button>
                    </div>
                    <div style={{ display: "flex", gap: 6, padding: "12px 12px 8px", overflowX: "auto" }} className="hi-scroll">
                        {CATS.map((c: string) => (
                            <button key={c} onClick={() => setTab(c)} style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 800, background: tab === c ? "rgba(139,92,246,.35)" : "rgba(255,255,255,.06)", color: tab === c ? "#e5e0ff" : "#9ca3af" }}>{CAT_LABEL[c]}</button>
                        ))}
                    </div>
                    <div style={{ display: "flex", gap: 10, padding: "8px 14px 16px", overflowX: "auto" }} className="hi-scroll">
                        {items.filter((it: ShopItem) => it.category === tab).map((it: ShopItem) => {
                            const isOwned = owned.includes(it.id);
                            const isOn = draft[it.category] === it.css_key;
                            return (
                                <div key={it.id} onClick={() => tapItem(it)} style={{ flexShrink: 0, width: 92, textAlign: "center", cursor: "pointer", padding: "12px 6px 10px", borderRadius: 14, background: "rgba(255,255,255,.04)", border: isOn ? "2px solid #fbbf24" : isOwned ? "2px solid rgba(167,139,250,.4)" : "2px solid rgba(255,255,255,.08)", position: "relative" }}>
                                    <div style={{ fontSize: 38, filter: isOwned ? "none" : "grayscale(1) opacity(.45)" }}>{it.emoji || "🎁"}</div>
                                    {!isOwned && <div style={{ position: "absolute", top: 8, right: 8, fontSize: 15 }}>🔒</div>}
                                    {isOn && <div style={{ position: "absolute", top: 8, left: 8, fontSize: 14, color: "#fbbf24" }}>✓</div>}
                                    <div style={{ fontSize: 11, fontWeight: 800, color: isOn ? "#fbbf24" : "#e5e7eb", marginTop: 5 }}>{it.name}</div>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: isOwned ? "#34d399" : "#8b8fa8", marginTop: 2 }}>{isOwned ? (isOn ? "装備中" : "タップで飾る") : it.price.toLocaleString() + "pt"}</div>
                                </div>
                            );
                        })}
                        {items.filter((it: ShopItem) => it.category === tab).length === 0 && <div style={{ color: "#8b8fa8", fontSize: 12, padding: 20 }}>アイテムなし</div>}
                    </div>
                </div>
            )}

            {detail && (
                <div onClick={() => setDetail(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 40, borderRadius: 18 }}>
                    <div onClick={(e: any) => e.stopPropagation()} style={{ width: "100%", background: "#1a1a2e", borderRadius: "20px 20px 0 0", padding: "20px 20px 24px", textAlign: "center", border: "1px solid rgba(139,92,246,.3)" }}>
                        <div style={{ fontSize: 56 }}>{detail.emoji || "🎁"}</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: "#f9fafb", marginTop: 6 }}>{detail.name}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#fbbf24", marginTop: 4 }}>{detail.price.toLocaleString()}pt でショップで購入できます</div>
                        <button onClick={() => router.push("/shop")} style={{ width: "100%", marginTop: 16, padding: 13, borderRadius: 14, border: "none", background: "linear-gradient(135deg, #a78bfa, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 900, cursor: "pointer" }}>ショップで見る</button>
                        <button onClick={() => setDetail(null)} style={{ width: "100%", marginTop: 8, padding: 11, borderRadius: 14, border: "none", background: "transparent", color: "#9ca3af", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>閉じる</button>
                    </div>
                </div>
            )}
        </div>
    );
}
