"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import BackToMenuButton from "../components/BackToMenuButton";

type Report = { id: string; user_id: string; mtg_date: string; start_time: string | null; end_time: string | null; content: string; participants: string | null; created_at: string };

export default function MtgBoxPage() {
    const router = useRouter();
    const [reports, setReports] = useState<Report[]>([]);
    const [names, setNames] = useState<{ [id: string]: string }>({});
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState<string | null>(null);

    const load = useCallback(async () => {
        const { data: r } = await supabase.from("mtg_reports").select("*").eq("status", "approved").order("mtg_date", { ascending: false });
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

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 760, margin: "0 auto" }}>
                <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>← INTERN QUEST</div>
                <h1 style={{ fontSize: 26, fontWeight: 900, margin: "4px 0 4px" }}>📋 議事録BOX</h1>
                <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 24 }}>みんなのMTG議事録を見られるよ。タップで詳細を開く。</p>

                {reports.length === 0 && <div style={{ color: "#9ca3af", fontSize: 14 }}>まだ承認済みの議事録がありません。</div>}

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {reports.map((r) => {
                        const isOpen = openId === r.id;
                        return (
                            <div key={r.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 18px", cursor: "pointer" }} onClick={() => setOpenId(isOpen ? null : r.id)}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 14, color: "#f9fafb", fontWeight: 700 }}>{r.mtg_date} のMTG</div>
                                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                                            提出: {names[r.user_id] || "不明"}
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
