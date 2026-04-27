"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type RankingUser = { id: string; name: string; points: number; avatar_url?: string | null };

function getOneWeekAgoISO(): string {
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);
    return oneWeekAgo.toISOString();
}

export default function RankingPage() {
    const router = useRouter();
    const [users, setUsers] = useState<RankingUser[]>([]);
    const [weeklyUsers, setWeeklyUsers] = useState<RankingUser[]>([]);
    const [myId, setMyId] = useState("");
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [activeTab, setActiveTab] = useState<"total" | "weekly">("total");

    useEffect(() => {
        const loadRanking = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setMyId(user.id);
            const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map(e => e.trim());
            setIsAdmin(!!user.email && adminEmails.includes(user.email));

            const { data: pointRows } = await supabase.from("user_points").select("id, total_earned").order("total_earned", { ascending: false });
            const totalRows = pointRows || [];
            const { data: profileRows } = await supabase.from("profiles").select("id, name, avatar_url").in("id", totalRows.map((r) => r.id));
            setUsers(totalRows.map((row) => ({
                id: row.id,
                name: profileRows?.find((p) => p.id === row.id)?.name || "名前未設定",
                points: (row as any).total_earned || 0,
                avatar_url: profileRows?.find((p) => p.id === row.id)?.avatar_url || null,
            })));

            const { data: weeklyData } = await supabase.from("points_history").select("user_id, change, created_at").gte("created_at", getOneWeekAgoISO());
            const weeklyTotals: Record<string, number> = {};
            (weeklyData || []).forEach((item) => { weeklyTotals[item.user_id] = (weeklyTotals[item.user_id] || 0) + item.change; });
            const weeklyIds = Object.keys(weeklyTotals);
            if (weeklyIds.length > 0) {
                const { data: weeklyProfiles } = await supabase.from("profiles").select("id, name, avatar_url").in("id", weeklyIds);
                setWeeklyUsers(weeklyIds.map((id) => ({
                    id,
                    name: weeklyProfiles?.find((p) => p.id === id)?.name || "名前未設定",
                    points: weeklyTotals[id] || 0,
                    avatar_url: weeklyProfiles?.find((p) => p.id === id)?.avatar_url || null,
                })).sort((a, b) => b.points - a.points));
            }
            setLoading(false);
        };
        loadRanking();
    }, [router]);

    const renderAvatar = (user: RankingUser, size: number) => {
        if (user.avatar_url) {
            return <img src={user.avatar_url} alt={user.name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }} />;
        }
        return (
            <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, color: "#fff" }}>
                {user.name.charAt(0)}
            </div>
        );
    };

    const renderPodium = (list: RankingUser[]) => {
        const top3 = list.slice(0, 3);
        const podiumOrder = [1, 0, 2];
        const podiumColors = ["#c0c0c0", "#f59e0b", "#cd7f32"];
        const podiumHeights = [110, 150, 80];
        const medals = ["🥇", "🥈", "🥉"];

        return (
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 8 }}>
                    {podiumOrder.map((rank) => {
                        const user = top3[rank];
                        if (!user) return <div key={rank} style={{ width: 140 }} />;
                        const isMe = user.id === myId;
                        const color = podiumColors[rank];
                        const height = podiumHeights[rank];

                        return (
                            <div key={rank} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 140 }}>
                                <div style={{ position: "relative", marginBottom: 8 }}>
                                    <div style={{ width: rank === 0 ? 80 : 64, height: rank === 0 ? 80 : 64, borderRadius: "50%", border: `3px solid ${color}`, overflow: "hidden", boxShadow: `0 0 20px ${color}50` }}>
                                        {renderAvatar(user, rank === 0 ? 80 : 64)}
                                    </div>
                                    <div style={{ position: "absolute", bottom: -4, right: -4, fontSize: rank === 0 ? 24 : 18 }}>{medals[rank]}</div>
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: isMe ? "#818cf8" : "#f9fafb", marginBottom: 2, textAlign: "center", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {user.name}{isMe && <span style={{ marginLeft: 4, fontSize: 10, color: "#6366f1" }}> YOU</span>}
                                </div>
                                <div style={{ fontSize: rank === 0 ? 16 : 13, fontWeight: 800, color, marginBottom: 8 }}>
                                    {user.points.toLocaleString()}pt
                                </div>
                                <div style={{ width: "100%", height, background: `linear-gradient(180deg, ${color}30, ${color}15)`, border: `1px solid ${color}50`, borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <div style={{ fontSize: rank === 0 ? 36 : 28, fontWeight: 900, color: `${color}60` }}>{rank + 1}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div style={{ height: 3, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)", marginBottom: 24 }} />
            </div>
        );
    };

    const renderList = (list: RankingUser[]) => {
        const rest = list.slice(3);
        if (rest.length === 0) return null;
        return (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>4位以下</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {rest.map((user, i) => {
                        const isMe = user.id === myId;
                        return (
                            <div key={user.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 12, background: isMe ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)", border: isMe ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.05)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ width: 28, textAlign: "center", fontSize: 13, color: "#6b7280", fontWeight: 700 }}>{i + 4}</div>
                                    <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                                        {renderAvatar(user, 36)}
                                    </div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: isMe ? "#818cf8" : "#f9fafb" }}>
                                        {user.name}
                                        {isMe && <span style={{ marginLeft: 8, fontSize: 10, color: "#6366f1", fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(99,102,241,0.2)" }}>YOU</span>}
                                    </div>
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: isMe ? "#818cf8" : "#d1d5db" }}>{user.points.toLocaleString()}pt</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    const currentList = activeTab === "total" ? users : weeklyUsers;

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.06) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 640, margin: "0 auto" }}>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                    <div>
                        <div onClick={() => router.push("/menu")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer" }}>INTERN QUEST</div>
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

                {/* タブ */}
                <div style={{ display: "flex", gap: 4, marginBottom: 32, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 4 }}>
                    {[
                        { key: "total", label: "🏆 総合" },
                        { key: "weekly", label: "⚡ 今週" },
                    ].map((tab) => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 13, background: activeTab === tab.key ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "transparent", color: activeTab === tab.key ? "#fff" : "#6b7280", transition: "all 0.2s" }}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {currentList.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#6b7280", fontSize: 14, padding: 40 }}>データがありません</div>
                ) : (
                    <>
                        {renderPodium(currentList)}
                        {renderList(currentList)}
                    </>
                )}
            </div>
        </main>
    );
}