"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "../../lib/supabase";

interface ScoreCardProps {
    label: string;
    value: string | number;
    sub?: string;
    color: string;
    icon: string;
}

function ScoreCard({ label, value, sub, color, icon }: ScoreCardProps) {
    return (
        <div style={{
            padding: 20,
            borderRadius: 14,
            background: `linear-gradient(135deg, ${color}20, ${color}05)`,
            border: `1px solid ${color}40`,
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 1 }}>{label}</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

export default function KpiDashboardTab() {
    const [loading, setLoading] = useState(true);
    const [dau, setDau] = useState(0);
    const [wau, setWau] = useState(0);
    const [coreCount, setCoreCount] = useState(0);
    const [retention7, setRetention7] = useState(0);
    const [totalUsers, setTotalUsers] = useState(0);
    const [dauHistory, setDauHistory] = useState<{ date: string; count: number }[]>([]);
    const [wauHistory, setWauHistory] = useState<{ week: string; count: number }[]>([]);
    const [registerHistory, setRegisterHistory] = useState<{ date: string; count: number; cumulative: number }[]>([]);
    const [topActive, setTopActive] = useState<{ name: string; days: number }[]>([]);
    const [inactiveUsers, setInactiveUsers] = useState<{ name: string; last_active: string | null }[]>([]);

    useEffect(() => {
        const load = async () => {
            // 全ユーザー数
            const { count: totalCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
            setTotalUsers(totalCount || 0);

            const today = new Date();
            const todayStr = today.toISOString().split("T")[0];

            // 全points_history取得（過去30日）
            const past30Date = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            const { data: history } = await supabase
                .from("points_history")
                .select("user_id, created_at")
                .gte("created_at", past30Date.toISOString())
                .not("reason", "in", "(gacha_spend,gacha_reward)")
                .order("created_at", { ascending: false })
                .limit(5000);

            if (history) {
                // DAU (今日)
                const todayActive = new Set(
                    history.filter((h: any) => h.created_at.startsWith(todayStr)).map((h: any) => h.user_id)
                );
                setDau(todayActive.size);

                // WAU (過去7日)
                const past7 = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                const weekActive = new Set(
                    history.filter((h: any) => new Date(h.created_at) >= past7).map((h: any) => h.user_id)
                );
                setWau(weekActive.size);

                // コア層（過去7日で4日以上）
                const userDayMap = new Map<string, Set<string>>();
                history.filter((h: any) => new Date(h.created_at) >= past7).forEach((h: any) => {
                    const day = h.created_at.split("T")[0];
                    if (!userDayMap.has(h.user_id)) userDayMap.set(h.user_id, new Set());
                    userDayMap.get(h.user_id)!.add(day);
                });
                const core = Array.from(userDayMap.values()).filter(days => days.size >= 4).length;
                setCoreCount(core);

                // DAU推移（過去30日）
                const dauMap = new Map<string, Set<string>>();
                history.forEach((h: any) => {
                    const day = h.created_at.split("T")[0];
                    if (!dauMap.has(day)) dauMap.set(day, new Set());
                    dauMap.get(day)!.add(h.user_id);
                });
                const dauArr: { date: string; count: number }[] = [];
                for (let i = 29; i >= 0; i--) {
                    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
                    const ds = d.toISOString().split("T")[0];
                    dauArr.push({ date: ds.slice(5), count: dauMap.get(ds)?.size || 0 });
                }
                setDauHistory(dauArr);

                // WAU推移（過去8週）
                const wauArr: { week: string; count: number }[] = [];
                for (let w = 7; w >= 0; w--) {
                    const weekStart = new Date(today.getTime() - (w * 7 + 6) * 24 * 60 * 60 * 1000);
                    const weekEnd = new Date(today.getTime() - w * 7 * 24 * 60 * 60 * 1000);
                    const weekUsers = new Set(
                        history.filter((h: any) => {
                            const d = new Date(h.created_at);
                            return d >= weekStart && d <= weekEnd;
                        }).map((h: any) => h.user_id)
                    );
                    const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
                    wauArr.push({ week: label, count: weekUsers.size });
                }
                setWauHistory(wauArr);

                // アクティブTOP10（過去30日）
                const userActivityMap = new Map<string, Set<string>>();
                history.forEach((h: any) => {
                    const day = h.created_at.split("T")[0];
                    if (!userActivityMap.has(h.user_id)) userActivityMap.set(h.user_id, new Set());
                    userActivityMap.get(h.user_id)!.add(day);
                });
                const userActiveDays = Array.from(userActivityMap.entries())
                    .map(([uid, days]) => ({ uid, days: days.size }))
                    .sort((a, b) => b.days - a.days)
                    .slice(0, 10);

                if (userActiveDays.length > 0) {
                    const { data: profiles } = await supabase
                        .from("profiles")
                        .select("id, name")
                        .in("id", userActiveDays.map(u => u.uid));
                    const topList = userActiveDays.map(u => ({
                        name: profiles?.find((p: any) => p.id === u.uid)?.name || "?",
                        days: u.days,
                    }));
                    setTopActive(topList);
                }

                // 7日継続率（7日前に登録した人のうち、過去7日でアクティブな人の割合）
                const past14 = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
                const past7Date = past7;
                const { data: oldUsers } = await supabase
                    .from("profiles")
                    .select("id")
                    .gte("created_at", past14.toISOString())
                    .lt("created_at", past7Date.toISOString());
                if (oldUsers && oldUsers.length > 0) {
                    const oldUserIds = new Set(oldUsers.map((u: any) => u.id));
                    const activeOld = Array.from(weekActive).filter(uid => oldUserIds.has(uid)).length;
                    setRetention7(Math.round((activeOld / oldUsers.length) * 100));
                }
            }

            // 新規登録推移（過去30日）
            const { data: newUsers } = await supabase
                .from("profiles")
                .select("created_at")
                .gte("created_at", new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
                .order("created_at", { ascending: true });
            const registerMap = new Map<string, number>();
            (newUsers || []).forEach((u: any) => {
                const day = u.created_at.split("T")[0];
                registerMap.set(day, (registerMap.get(day) || 0) + 1);
            });
            const registerArr: { date: string; count: number; cumulative: number }[] = [];
            let cumulative = (totalCount || 0) - (newUsers?.length || 0);
            for (let i = 29; i >= 0; i--) {
                const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
                const ds = d.toISOString().split("T")[0];
                const count = registerMap.get(ds) || 0;
                cumulative += count;
                registerArr.push({ date: ds.slice(5), count, cumulative });
            }
            setRegisterHistory(registerArr);

            // 未ログイン7日以上のユーザー
            const { data: allProfiles } = await supabase.from("profiles").select("id, name");
            if (allProfiles && history) {
                const lastActiveMap = new Map<string, string>();
                history.forEach((h: any) => {
                    const existing = lastActiveMap.get(h.user_id);
                    if (!existing || h.created_at > existing) {
                        lastActiveMap.set(h.user_id, h.created_at);
                    }
                });
                const past7 = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                const inactive = (allProfiles as any[])
                    .map((p: any) => ({
                        name: p.name || "?",
                        last_active: lastActiveMap.get(p.id) || null,
                    }))
                    .filter(u => !u.last_active || new Date(u.last_active) < past7)
                    .sort((a, b) => {
                        if (!a.last_active) return 1;
                        if (!b.last_active) return -1;
                        return new Date(a.last_active).getTime() - new Date(b.last_active).getTime();
                    })
                    .slice(0, 15);
                setInactiveUsers(inactive);
            }

            setLoading(false);
        };
        load();
    }, []);

    if (loading) {
        return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading...</div>;
    }

    return (
        <div style={{ padding: 24 }}>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>KPI DASHBOARD</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#f9fafb", marginTop: 0, marginBottom: 24 }}>📊 アクティブ指標</h2>

            {/* スコアカード */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
                <ScoreCard icon="🎯" label="DAU (今日)" value={dau} sub={`${totalUsers}人中 ${totalUsers > 0 ? Math.round((dau / totalUsers) * 100) : 0}%`} color="#06b6d4" />
                <ScoreCard icon="📅" label="WAU (今週)" value={wau} sub={`${totalUsers}人中 ${totalUsers > 0 ? Math.round((wau / totalUsers) * 100) : 0}%`} color="#8b5cf6" />
                <ScoreCard icon="🔥" label="コア層（週4日以上）" value={coreCount} sub="活発に使ってる人" color="#ec4899" />
                <ScoreCard icon="📈" label="7日継続率" value={`${retention7}%`} sub="新規登録者の生存率" color="#10b981" />
            </div>

            {/* DAU推移グラフ */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>📈 DAU推移（過去30日）</div>
                <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={dauHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: "#1f1f2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                        <Line type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2} dot={{ fill: "#06b6d4", r: 3 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* WAU推移 + 新規登録 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>📊 WAU推移（過去8週）</div>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={wauHistory}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="week" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                            <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: "#1f1f2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                            <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>📅 新規登録者推移（累計）</div>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={registerHistory}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                            <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: "#1f1f2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                            <Line type="monotone" dataKey="cumulative" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 3 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 一覧 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>🏆 アクティブTOP10（過去30日）</div>
                    {topActive.length === 0 ? <div style={{ color: "#6b7280", fontSize: 13 }}>データなし</div> : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {topActive.map((u, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: i < 3 ? `rgba(${i === 0 ? '251,191,36' : i === 1 ? '156,163,175' : '180,83,9'},0.1)` : "rgba(255,255,255,0.03)" }}>
                                    <span style={{ color: "#f9fafb", fontSize: 13, fontWeight: 600 }}>
                                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`} {u.name}
                                    </span>
                                    <span style={{ color: "#06b6d4", fontSize: 13, fontWeight: 700 }}>{u.days}日</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>⚠️ 7日以上アクティブなし（離脱予兆）</div>
                    {inactiveUsers.length === 0 ? <div style={{ color: "#10b981", fontSize: 13 }}>全員アクティブ ✅</div> : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 350, overflowY: "auto" }}>
                            {inactiveUsers.map((u, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.05)" }}>
                                    <span style={{ color: "#f9fafb", fontSize: 13 }}>{u.name}</span>
                                    <span style={{ color: "#9ca3af", fontSize: 11 }}>
                                        {u.last_active ? new Date(u.last_active).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) : "未活動"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
