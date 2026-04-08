"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type RankingUser = { id: string; name: string; points: number };

function getOneWeekAgoISO(): string {
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);
    return oneWeekAgo.toISOString();
}

const medals = ["🥇", "🥈", "🥉"];

export default function RankingPage() {
    const router = useRouter();
    const [users, setUsers] = useState<RankingUser[]>([]);
    const [weeklyUsers, setWeeklyUsers] = useState<RankingUser[]>([]);
    const [myId, setMyId] = useState("");
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const loadRanking = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setMyId(user.id);
            const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map(e => e.trim());
            setIsAdmin(!!user.email && adminEmails.includes(user.email));

            const { data: pointRows } = await supabase.from("user_points").select("id, points").order("points", { ascending: false });
            const totalRows = pointRows || [];
            const { data: profileRows } = await supabase.from("profiles").select("id, name").in("id", totalRows.map((r) => r.id));
            setUsers(totalRows.map((row) => ({ id: row.id, name: profileRows?.find((p) => p.id === row.id)?.name || "名前未設定", points: row.points || 0 })));

            const { data: weeklyData } = await supabase.from("points_history").select("user_id, change, created_at").gte("created_at", getOneWeekAgoISO());
            const weeklyTotals: Record<string, number> = {};
            (weeklyData || []).forEach((item) => { weeklyTotals[item.user_id] = (weeklyTotals[item.user_id] || 0) + item.change; });
            const weeklyIds = Object.keys(weeklyTotals);
            if (weeklyIds.length > 0) {
                const { data: weeklyProfiles } = await supabase.from("profiles").select("id, name").in("id", weeklyIds);
                setWeeklyUsers(weeklyIds.map((id) => ({ id, name: weeklyProfiles?.find((p) => p.id === id)?.name || "名前未設定", points: weeklyTotals[id] || 0 })).sort((a, b) => b.points - a.points));
            }
            setLoading(false);
        };
        loadRanking();
    }, [router]);

    const renderList = (list: RankingUser[], label: string) => (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>{label}</div>
            {list.length === 0 ? (
                <div style={{ color: "#6b7280", fontSize: 14 }}>データがありません</div>
            ) : list.map((user, i) => {
                const isMe = user.id === myId;
                return (
                    <div key={user.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderRadius: 12, marginBottom: 8, background: isMe ? "rgba(99,102,241,0.12)" : i === 0 ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.02)", border: isMe ? "1px solid rgba(99,102,241,0.4)" : i === 0 ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ fontSize: 20, width: 32, textAlign: "center" }}>
                                {i < 3 ? medals[i] : <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>{i + 1}</span>}
                            </div>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: isMe ? "#818cf8" : "#f9fafb" }}>{user.name}{isMe && <span style={{ marginLeft: 8, fontSize: 11, color: "#6366f1", fontWeight: 700 }}>YOU</span>}</div>
                            </div>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: i === 0 ? "#f59e0b" : isMe ? "#818cf8" : "#d1d5db" }}>{user.points.toLocaleString()}pt</div>
                    </div>
                );
            })}
        </div>
    );

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>

            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.06) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto" }}>

                {/* ヘッダー */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                    <div>
                        <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>INTERN QUEST</div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>ランキング</h1>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => router.push("/mypage")} style={{ background: "rgba(255,255,255,0.05)", color: "#d1d5db", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>マイページ</button>
                        <button onClick={() => router.push("/report")} style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", padding: "8px 16px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>日報を書く</button>
                        {isAdmin && (
                            <button onClick={() => router.push("/admin")} style={{ background: "rgba(255,255,255,0.05)", color: "#d1d5db", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>管理画面</button>
                        )}
                    </div>
                </div>

                {/* ランキング2カラム */}
                <div style={{
                    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))"
                    , gap: 16
                }}>
                    {renderList(users, "TOTAL RANKING")}
                    {renderList(weeklyUsers, "WEEKLY RANKING")}
                </div>
            </div>
        </main>
    );
}