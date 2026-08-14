"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getHouseStage } from "./DotHouse";

type ShopItem = { id: string; name: string; category: string; emoji: string | null; css_key: string; price: number; rarity: string };
type Cfg = Record<string, string>;

const CATS: string[] = ["ground", "tree", "deco", "sky", "animal"];
const CAT_LABEL: Record<string, string> = { ground: "🌍 地面", tree: "🌲 木", deco: "🪑 デコ", sky: "\u2728 空", animal: "🐾 どうぶつ" };
const HOUSE_IMG: string[] = ["/island/house/0_tent.png", "/island/house/1_cabin.png", "/island/house/2_house.png", "/island/house/3_big.png", "/island/house/4_mansion.png", "/island/house/5_castle.png"];
const HOUSE_W: number[] = [126, 136, 144, 152, 160, 154];
const GROUND_TOP: Record<string, string> = {
    ground_hanabatake: "linear-gradient(180deg, #a3e88a, #6cc255)",
    ground_yukihara: "linear-gradient(180deg, #f4f9ff, #d3e3f2)",
    ground_sunahama: "linear-gradient(180deg, #fbe6a8, #ecc264)",
    ground_momiji: "linear-gradient(180deg, #f6b878, #e07d3a)",
};
const TREE_EMOJI: Record<string, string> = { tree_sakura: "🌸", tree_yashi: "🌴", tree_momi: "🎄", tree_momiji: "🍁" };
const DECO_EMOJI: Record<string, string> = { deco_funsui: "\u26F2", deco_bench: "🪑", deco_gaitou: "💡", deco_yukidaruma: "\u26C4", deco_torii: "\u26E9️" };
const SKY_EMOJI: Record<string, string> = { sky_niji: "🌈", sky_chocho: "🦋", sky_fuusen: "🎈" };
const ANIMAL_EMOJI: Record<string, string> = { animal_neko: "🐈", animal_inu: "🐕" };
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
        setToast("島を更新しました \u2728");
        setTimeout(() => setToast(""), 2500);
    };
    const tapPet = () => {
        if (!view.animal) return;
        setPetHop(true);
        setToast(ANIMAL_NAME[view.animal] + "がうれしそう！ 💜");
        setTimeout(() => setPetHop(false), 700);
        setTimeout(() => setToast(""), 1800);
    };

    return (
        <div style={{ width: "100%", position: "relative" }}>
            <style>{`
                @keyframes hiCloud { 0%{transform:translateX(-30px)} 100%{transform:translateX(30px)} }
                @keyframes hiFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
                @keyframes hiPet { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
                @keyframes hiPetShadow { 0%,100%{transform:translateX(-50%) scaleX(1)} 50%{transform:translateX(-50%) scaleX(.8)} }
                @keyframes hiHop { 0%{transform:translateY(0)} 40%{transform:translateY(-18px)} 100%{transform:translateY(0)} }
                @keyframes hiPop { 0%{transform:scale(.2);opacity:0} 70%{transform:scale(1.14)} 100%{transform:scale(1);opacity:1} }
                @keyframes hiToast { 0%{opacity:0;transform:translate(-50%,6px)} 15%{opacity:1;transform:translate(-50%,0)} 85%{opacity:1} 100%{opacity:0} }
                .hi-scroll::-webkit-scrollbar { height: 5px; }
                .hi-scroll::-webkit-scrollbar-thumb { background: rgba(139,92,246,.4); border-radius: 999px; }
            `}</style>

            <div style={{ position: "relative", padding: "8px 0 0" }}>

                <div style={{ position: "relative", minHeight: 250, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", animation: "hiFloat 6s ease-in-out infinite" }}>
                    {/* 空アイテム */}
                    {view.sky && SKY_EMOJI[view.sky] && <div key={"sky" + view.sky} style={{ position: "absolute", top: 2, right: "24%", fontSize: 44, zIndex: 1, animation: "hiFloat 5s ease-in-out infinite, hiPop .5s ease-out" }}>{SKY_EMOJI[view.sky]}</div>}
                    {/* 木（家の左奥） */}
                    {view.tree && TREE_EMOJI[view.tree] && <div key={"tree" + view.tree} style={{ position: "absolute", bottom: 96, left: "22%", fontSize: 50, zIndex: 2, filter: "drop-shadow(0 4px 6px rgba(0,0,0,.28))", animation: "hiPop .5s ease-out" }}>{TREE_EMOJI[view.tree]}</div>}

                    {/* 島の上面 */}
                    <div style={{ position: "absolute", bottom: 52, left: "50%", transform: "translateX(-50%)", width: 288, height: 78, borderRadius: "50%", background: (view.ground && GROUND_TOP[view.ground]) || "linear-gradient(180deg, #b6ec8f, #7ec95f)", boxShadow: "inset 0 -10px 16px rgba(60,110,40,.35)", zIndex: 1 }} />
                    {/* 島の外周（濃い緑のリム） */}
                    <div style={{ position: "absolute", bottom: 50, left: "50%", transform: "translateX(-50%)", width: 292, height: 82, borderRadius: "50%", border: "3px solid rgba(70,140,50,.5)", zIndex: 1, pointerEvents: "none" }} />
                    {/* 島の側面（丸みのある土の厚み） */}
                    <div style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 232, height: 74, borderRadius: "0 0 50% 50% / 0 0 100% 100%", background: "linear-gradient(180deg, #8a6a48, #5c4330)", zIndex: 0 }} />
                    {/* 影（薄い青紫） */}
                    <div style={{ position: "absolute", bottom: -20, left: "50%", transform: "translateX(-50%)", width: 200, height: 26, borderRadius: "50%", background: "rgba(120,110,190,.4)", filter: "blur(11px)", zIndex: 0 }} />

                    {/* 家（島の中央・縮小） */}
                    <div onClick={onHouseClick} style={{ position: "relative", zIndex: 2, marginBottom: 46, cursor: onHouseClick ? "pointer" : "default" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={HOUSE_IMG[stage.idx]} alt="house" style={{ width: HOUSE_W[stage.idx], display: "block", filter: "drop-shadow(0 8px 10px rgba(60,50,30,.28))" }} />
                    </div>

                    {/* デコ（家の右手前） */}
                    {view.deco && DECO_EMOJI[view.deco] && <div key={"deco" + view.deco} style={{ position: "absolute", bottom: 54, right: "24%", fontSize: 34, zIndex: 3, filter: "drop-shadow(0 3px 4px rgba(0,0,0,.3))", animation: "hiPop .5s ease-out" }}>{DECO_EMOJI[view.deco]}</div>}
                    {/* どうぶつ（家の左手前・地面に立つ・影つき・待機モーション） */}
                    {view.animal && ANIMAL_EMOJI[view.animal] && (
                        <div key={"animal" + view.animal} onClick={tapPet} style={{ position: "absolute", bottom: 52, left: "27%", zIndex: 3, cursor: "pointer", textAlign: "center" }}>
                            <div style={{ fontSize: 26, animation: petHop ? "hiHop .7s ease-out" : "hiPet 3.2s ease-in-out infinite", filter: "drop-shadow(0 2px 2px rgba(0,0,0,.28))" }}>{ANIMAL_EMOJI[view.animal]}</div>
                            <div style={{ width: 20, height: 6, margin: "1px auto 0", borderRadius: "50%", background: "rgba(60,50,80,.28)", animation: "hiPetShadow 3.2s ease-in-out infinite" }} />
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
                                    {isOn && <div style={{ position: "absolute", top: 8, left: 8, fontSize: 14, color: "#fbbf24" }}>\u2713</div>}
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
