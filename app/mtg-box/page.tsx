"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import BackToMenuButton from "../components/BackToMenuButton";

type Report = { id: string; user_id: string; mtg_date: string; title: string | null; category: string | null; start_time: string | null; end_time: string | null; content: string; participants: string | null; created_at: string };

export default function MtgBoxPage() {
    const router = useRouter();
    const [reports, setReports] = useState<Report[]>([]);
    const [names, setNames] = useState<{ [id: string]: string }>({});
    const [loading, setLoading] = useState(true);
    const [allowed, setAllowed] = useState(false);
    const [openId, setOpenId] = useState<string | null>(null);
    const [filter, setFilter] = useState("all");
    const MTG_CATEGORIES = ["IP", "CB", "SP", "HR", "MK", "全社・経営", "その他"];

    const load = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const { data: me } = await supabase.from("profiles").select("grade").eq("id", user.id).single();
        if (!me || me.grade !== "社会人") { setAllowed(false); setLoading(false); return; }
        setAllowed(true);
        const { data: r } = await supabase.from("mtg_reports").select("*").eq("status", "approved").neq("hidden", true).order("mtg_date", { ascending: false });
        const reps = (r || []) as Report[];
        setReports(reps);
        const { data: p } = await supabase.from("profiles").select("id, name");
        const map: { [id: string]: string } = {};
        (p || []).forEach((row: any) => { map[row.id] = row.name; });
        setNames(map);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    if (loading) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Loading...</main>
    );

    if (!allowed) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9ca3af", gap: 16, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>🔒</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb" }}>このページはマネージャー・オーナー専用です</div>
            <div style={{ fontSize: 13 }}>議事録BOXの閲覧権限がありません。</div>
            <div onClick={() => router.push("/menu")} style={{ marginTop: 8, padding: "10px 24px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>☰ メニューに戻る</div>
        </main>
    );

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 760, margin: "0 auto" }}>
                <div onClick={() => router.push("/home")} style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>← INTERN QUEST</div>
                <h1 style={{ fontSize: 26, fontWeight: 900, margin: "4px 0 4px" }}>📋 議事録BOX</h1>
                <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>みんなのMTG議事録を見られるよ。タップで詳細を開く。</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                    {["all", ...MTG_CATEGORIES].map((cat) => (
                        <button key={cat} onClick={() => setFilter(cat)} style={{ padding: "6px 14px", borderRadius: 999, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", background: filter === cat ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: filter === cat ? "#fff" : "#9ca3af" }}>{cat === "all" ? "すべて" : cat}</button>
                    ))}
                </div>

                {reports.length === 0 && <div style={{ color: "#9ca3af", fontSize: 14 }}>まだ承認済みの議事録がありません。</div>}

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {reports.filter((r) => filter === "all" || r.category === filter).map((r) => {
                        const isOpen = openId === r.id;
                        return (
                            <div key={r.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 18px", cursor: "pointer" }} onClick={() => setOpenId(isOpen ? null : r.id)}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 14, color: "#f9fafb", fontWeight: 700 }}>{r.title || `${r.mtg_date} のMTG`}</div>
                                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                                            {r.category ? `[${r.category}] ` : ""}{r.mtg_date} ・ 提出: {names[r.user_id] || "不明"}
                                            {r.start_time ? ` ・ ${r.start_time}${r.end_time ? "〜" + r.end_time : ""}` : ""}
                                            {r.participants ? ` ・ 参加: ${r.participants}` : ""}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 11, color: "#6b7280" }}>{isOpen ? "▲" : "▼"}</div>
                                </div>
                                {isOpen && (
                                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: "#d1d5db", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                                        {r.content}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <BackToMenuButton />
            </div>
        </main>
    );
}
