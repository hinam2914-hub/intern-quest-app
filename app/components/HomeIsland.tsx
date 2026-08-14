"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getHouseStage } from "./DotHouse";

type ShopItem = { id: string; name: string; category: string; emoji: string | null; css_key: string; price: number; rarity: string };

const CATS = ["ground", "tree", "deco", "sky", "animal"];
const CAT_LABEL = { ground: "\U0001F30D 地面", tree: "\U0001F332 木", deco: "\U0001FA91 デコ", sky: "\u2728 空", animal: "\U0001F43E どうぶつ" };
const HOUSE_IMG = ["/island/house/0_tent.png", "/island/house/1_cabin.png", "/island/house/2_house.png", "/island/house/3_big.png", "/island/house/4_mansion.png", "/island/house/5_castle.png"];
const HOUSE_W = [150, 174, 196, 214, 236, 228];
const GROUND_BG = {
    ground_hanabatake: "linear-gradient(180deg, #86efac, #4ade80)",
    ground_yukihara: "linear-gradient(180deg, #f8fafc, #cbd5e1)",
    ground_sunahama: "linear-gradient(180deg, #fde68a, #f59e0b)",
    ground_momiji: "linear-gradient(180deg, #fdba74, #ea580c)",
};
const TREE_EMOJI = { tree_sakura: "\U0001F338", tree_yashi: "\U0001F334", tree_momi: "\U0001F384", tree_momiji: "\U0001F341" };
const DECO_EMOJI = { deco_funsui: "\u26F2", deco_bench: "\U0001FA91", deco_gaitou: "\U0001F4A1", deco_yukidaruma: "\u26C4", deco_torii: "\u26E9\uFE0F" };
const SKY_EMOJI = { sky_niji: "\U0001F308", sky_chocho: "\U0001F98B", sky_fuusen: "\U0001F388" };
const ANIMAL_EMOJI = { animal_neko: "\U0001F408", animal_inu: "\U0001F415" };

export default function HomeIsland({ userId, totalEarned, onHouseClick }) {
    const router = useRouter();
    const [items, setItems] = useState([]);
    const [owned, setOwned] = useState([]);
    const [config, setConfig] = useState({});
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState({});
    const [tab, setTab] = useState("ground");
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState("");
    const [detail, setDetail] = useState(null);

    useEffect(() => {
        if (!userId) return;
        (async () => {
            const [{ data: prow }, { data: its }, { data: pur }] = await Promise.all([
                supabase.from("profiles").select("island_config").eq("id", userId).maybeSingle(),
                supabase.from("island_items").select("*").eq("is_active", true).order("sort_order"),
                supabase.from("island_purchases").select("item_id, status").eq("user_id", userId),
            ]);
            setConfig((prow && prow.island_config) || {});
            setItems(its || []);
            setOwned((pur || []).filter((p) => p.status === "approved").map((p) => p.item_id));
        })();
    }, [userId]);

    const view = editing ? draft : config;
    const stage = getHouseStage(totalEarned);
    const nextName = stage.nextName;
    const startEdit = () => { setDraft({ ...config }); setEditing(true); setToast(""); };
    const cancelEdit = () => { setEditing(false); setToast(""); };
    const tapItem = (it) => {
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
        setToast("島を更新しました \u2728");
        setTimeout(() => setToast(""), 2500);
    };

    return (
        <div style={{ width: "100%", position: "relative" }}>
            <style>{`
                @keyframes hiBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
                @keyframes hiFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
                @keyframes hiPop { 0%{transform:scale(.2);opacity:0} 70%{transform:scale(1.14)} 100%{transform:scale(1);opacity:1} }
                @keyframes hiToast { 0%{opacity:0;transform:translate(-50%,6px)} 15%{opacity:1;transform:translate(-50%,0)} 85%{opacity:1} 100%{opacity:0} }
                .hi-scroll::-webkit-scrollbar { height: 5px; }
                .hi-scroll::-webkit-scrollbar-thumb { background: rgba(139,92,246,.4); border-radius: 999px; }
            `}</style>

            <div style={{ position: "relative", padding: "8px 0 0" }}>
                <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 300, height: 260, background: "radial-gradient(circle, rgba(167,139,250,.3), transparent 68%)", filter: "blur(22px)", pointerEvents: "none" }} />

                <div style={{ position: "relative", minHeight: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", animation: "hiFloat 6s ease-in-out infinite" }}>
                    {view.sky && SKY_EMOJI[view.sky] && <div key={"sky" + view.sky} style={{ position: "absolute", top: 4, right: "22%", fontSize: 48, zIndex: 1, animation: "hiFloat 5s ease-in-out infinite, hiPop .5s ease-out" }}>{SKY_EMOJI[view.sky]}</div>}
                    {view.tree && TREE_EMOJI[view.tree] && <div key={"tree" + view.tree} style={{ position: "absolute", bottom: 92, left: "18%", fontSize: 60, zIndex: 2, filter: "drop-shadow(0 4px 6px rgba(0,0,0,.35))", animation: "hiPop .5s ease-out" }}>{TREE_EMOJI[view.tree]}</div>}

                    <div style={{ position: "absolute", bottom: 44, left: "50%", transform: "translateX(-50%)", width: 288, height: 76, borderRadius: "50%", background: (view.ground && GROUND_BG[view.ground]) || "linear-gradient(180deg, #86efac, #56b47a)", boxShadow: "inset 0 -12px 18px rgba(0,0,0,.2)", zIndex: 1 }} />
                    <div style={{ position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "98px solid transparent", borderRight: "98px solid transparent", borderTop: "86px solid #6b4a34", zIndex: 0 }} />
                    <div style={{ position: "absolute", bottom: -32, left: "50%", transform: "translateX(-50%)", width: 176, height: 22, borderRadius: "50%", background: "rgba(88,40,120,.5)", filter: "blur(12px)", zIndex: 0 }} />

                    <div onClick={onHouseClick} style={{ position: "relative", zIndex: 2, marginBottom: 40, cursor: onHouseClick ? "pointer" : "default" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={HOUSE_IMG[stage.idx]} alt="house" style={{ width: HOUSE_W[stage.idx], display: "block", filter: "drop-shadow(0 8px 12px rgba(60,50,30,.3))" }} />
                    </div>

                    {view.deco && DECO_EMOJI[view.deco] && <div key={"deco" + view.deco} style={{ position: "absolute", bottom: 48, right: "21%", fontSize: 42, zIndex: 3, filter: "drop-shadow(0 3px 4px rgba(0,0,0,.35))", animation: "hiPop .5s ease-out" }}>{DECO_EMOJI[view.deco]}</div>}
                    {view.animal && ANIMAL_EMOJI[view.animal] && <div key={"animal" + view.animal} style={{ position: "absolute", bottom: 46, left: "30%", fontSize: 34, zIndex: 3, animation: "hiBob 2.6s ease-in-out infinite, hiPop .5s ease-out", filter: "drop-shadow(0 3px 4px rgba(0,0,0,.35))" }}>{ANIMAL_EMOJI[view.animal]}</div>}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: "#7c5a2b", background: "rgba(255,255,255,.7)", border: "1px solid rgba(255,180,92,.4)", padding: "6px 14px", borderRadius: 999 }}>\U0001F3DD\uFE0F 島コレクション {owned.length}/{items.length}</div>
                </div>

                {!editing && (
                    <>
                        <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 14, background: "rgba(255,255,255,.6)", border: "1px solid rgba(255,180,92,.3)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 800, color: "#7a5a2b" }}>{stage.isMax ? "\U0001F451 GOAL達成！" : (nextName ? "\U0001F3E0 " + nextName + "まで" : "GOALまで")}</span>
                                <span style={{ fontSize: 11, fontWeight: 800, color: "#e8590c" }}>{stage.isMax ? "MAX！" : "あと " + stage.toNext.toLocaleString() + "pt"}</span>
                            </div>
                            <div style={{ height: 9, background: "rgba(150,110,50,.18)", borderRadius: 6, overflow: "hidden" }}>
                                <div style={{ width: stage.progress + "%", height: "100%", background: "linear-gradient(180deg, #8ee04a, #5cbf2a)", borderRadius: 6, transition: "width 1s ease" }} />
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
                            <button onClick={startEdit} style={{ padding: "11px 26px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 900, background: "linear-gradient(135deg, #a78bfa, #8b5cf6)", color: "#fff", boxShadow: "0 5px 16px rgba(139,92,246,.4)" }}>\U0001F3A8 島をかざる</button>
                            <button onClick={() => router.push("/shop")} style={{ padding: "11px 22px", borderRadius: 999, border: "1px solid rgba(255,180,92,.5)", cursor: "pointer", fontSize: 14, fontWeight: 900, background: "rgba(255,255,255,.6)", color: "#c2410c" }}>\U0001F6CD\uFE0F ショップ</button>
                        </div>
                    </>
                )}
            </div>

            {toast && <div style={{ position: "absolute", top: 12, left: "50%", zIndex: 30, padding: "8px 18px", borderRadius: 999, background: "rgba(30,20,50,.9)", color: "#fff", fontSize: 13, fontWeight: 800, animation: "hiToast 2.5s ease-out", whiteSpace: "nowrap" }}>{toast}</div>}

            {editing && (
                <div style={{ marginTop: 16, borderRadius: 18, background: "rgba(20,16,38,.95)", border: "1px solid rgba(139,92,246,.35)", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                        <button onClick={cancelEdit} style={{ border: "none", background: "transparent", color: "#9ca3af", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>やめる</button>
                        <span style={{ fontSize: 14, fontWeight: 900, color: "#f4f2ff" }}>\U0001F3DD\uFE0F 島をかざる</span>
                        <button onClick={save} disabled={saving} style={{ border: "none", background: "linear-gradient(135deg, #34d399, #10b981)", color: "#052e22", fontSize: 13, fontWeight: 900, cursor: "pointer", padding: "7px 16px", borderRadius: 999, opacity: saving ? .6 : 1 }}>{saving ? "保存中..." : "保存"}</button>
                    </div>
                    <div style={{ display: "flex", gap: 6, padding: "12px 12px 8px", overflowX: "auto" }} className="hi-scroll">
                        {CATS.map((c) => (
                            <button key={c} onClick={() => setTab(c)} style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 800, background: tab === c ? "rgba(139,92,246,.35)" : "rgba(255,255,255,.06)", color: tab === c ? "#e5e0ff" : "#9ca3af" }}>{CAT_LABEL[c]}</button>
                        ))}
                    </div>
                    <div style={{ display: "flex", gap: 10, padding: "8px 14px 16px", overflowX: "auto" }} className="hi-scroll">
                        {items.filter((it) => it.category === tab).map((it) => {
                            const isOwned = owned.includes(it.id);
                            const isOn = draft[it.category] === it.css_key;
                            return (
                                <div key={it.id} onClick={() => tapItem(it)} style={{ flexShrink: 0, width: 92, textAlign: "center", cursor: "pointer", padding: "12px 6px 10px", borderRadius: 14, background: "rgba(255,255,255,.04)", border: isOn ? "2px solid #fbbf24" : isOwned ? "2px solid rgba(167,139,250,.4)" : "2px solid rgba(255,255,255,.08)", position: "relative" }}>
                                    <div style={{ fontSize: 38, filter: isOwned ? "none" : "grayscale(1) opacity(.45)" }}>{it.emoji || "\U0001F381"}</div>
                                    {!isOwned && <div style={{ position: "absolute", top: 8, right: 8, fontSize: 15 }}>\U0001F512</div>}
                                    {isOn && <div style={{ position: "absolute", top: 8, left: 8, fontSize: 14, color: "#fbbf24" }}>\u2713</div>}
                                    <div style={{ fontSize: 11, fontWeight: 800, color: isOn ? "#fbbf24" : "#e5e7eb", marginTop: 5 }}>{it.name}</div>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: isOwned ? "#34d399" : "#8b8fa8", marginTop: 2 }}>{isOwned ? (isOn ? "装備中" : "タップで飾る") : it.price.toLocaleString() + "pt"}</div>
                                </div>
                            );
                        })}
                        {items.filter((it) => it.category === tab).length === 0 && <div style={{ color: "#8b8fa8", fontSize: 12, padding: 20 }}>アイテムなし</div>}
                    </div>
                </div>
            )}

            {detail && (
                <div onClick={() => setDetail(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 40, borderRadius: 18 }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: "#1a1a2e", borderRadius: "20px 20px 0 0", padding: "20px 20px 24px", textAlign: "center", border: "1px solid rgba(139,92,246,.3)" }}>
                        <div style={{ fontSize: 56 }}>{detail.emoji || "\U0001F381"}</div>
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
