"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "../../lib/supabase";

interface ScoreCardProps { label: string; value: string | number; sub?: string; color: string; icon: string; }

function ScoreCard({ label, value, sub, color, icon }: ScoreCardProps) {
    return (
        <div style={{ padding: 20, borderRadius: 14, background: `linear-gradient(135deg, ${color}20, ${color}05)`, border: `1px solid ${color}40` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 1 }}>{label}</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

// "YYYY-MM-DD"（JST）に変換
function toJSTDate(iso: string): string {
    const d = new Date(iso);
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

export default function ReportAnalyticsTab() {
    const [loading, setLoading] = useState(true);
    const [totalUsers, setTotalUsers] = useState(0);
    const [todayRate, setTodayRate] = useState(0);
    const [weekRate, setWeekRate] = useState(0);
    const [monthRate, setMonthRate] = useState(0);
    const [streak7Count, setStreak7Count] = useState(0);
    const [dailyHistory, setDailyHistory] = useState<{ date: string; rate: number }[]>([]);
    const [weeklyHistory, setWeeklyHistory] = useState<{ week: string; rate: number }[]>([]);
    const [topSubmitters, setTopSubmitters] = useState<{ name: string; days: number }[]>([]);
    const [notSubmitted, setNotSubmitted] = useState<{ name: string; last: string | null }[]>([]);

    useEffect(() => {
        const load = async () => {
            const { count: totalCount } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true);
            const total = totalCount || 0;
            setTotalUsers(total);

            const today = new Date();
            const todayStr = toJSTDate(today.toISOString());

            // 過去60日ぶんの submissions を取得
            const past60 = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
            const { data: subs } = await supabase
                .from("submissions")
                .select("user_id, created_at")
                .gte("created_at", past60.toISOString())
                .limit(10000);
            const submissions = subs || [];

            // 日付ごとに「提出したユーザーID集合」を作る
            const byDate = new Map<string, Set<string>>();
            submissions.forEach((s: any) => {
                const day = toJSTDate(s.created_at);
                if (!byDate.has(day)) byDate.set(day, new Set());
                byDate.get(day)!.add(s.user_id);
            });
            const rateOf = (day: string) => total > 0 ? Math.round(((byDate.get(day)?.size || 0) / total) * 100) : 0;

            // 今日の提出率
            setTodayRate(rateOf(todayStr));

            // 今週・今月の提出率（期間内に1回でも出した人 ÷ 全登録者）
            const past7 = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            const past30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            const weekUsers = new Set(submissions.filter((s: any) => new Date(s.created_at) >= past7).map((s: any) => s.user_id));
            const monthUsers = new Set(submissions.filter((s: any) => new Date(s.created_at) >= past30).map((s: any) => s.user_id));
            setWeekRate(total > 0 ? Math.round((weekUsers.size / total) * 100) : 0);
            setMonthRate(total > 0 ? Math.round((monthUsers.size / total) * 100) : 0);

            // 日次提出率の推移（過去30日）
            const dailyArr: { date: string; rate: number }[] = [];
            for (let i = 29; i >= 0; i--) {
                const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
                const ds = toJSTDate(d.toISOString());
                dailyArr.push({ date: ds.slice(5), rate: rateOf(ds) });
            }
            setDailyHistory(dailyArr);

            // 週次提出率の推移（過去8週）
            const weeklyArr: { week: string; rate: number }[] = [];
            for (let w = 7; w >= 0; w--) {
                const weekStart = new Date(today.getTime() - (w * 7 + 6) * 24 * 60 * 60 * 1000);
                const weekEnd = new Date(today.getTime() - w * 7 * 24 * 60 * 60 * 1000);
                const wu = new Set(submissions.filter((s: any) => {
                    const d = new Date(s.created_at);
                    return d >= weekStart && d <= weekEnd;
                }).map((s: any) => s.user_id));
                weeklyArr.push({ week: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`, rate: total > 0 ? Math.round((wu.size / total) * 100) : 0 });
            }
            setWeeklyHistory(weeklyArr);

            // ユーザーごとの提出日数（過去30日）
            const userDays = new Map<string, Set<string>>();
            submissions.filter((s: any) => new Date(s.created_at) >= past30).forEach((s: any) => {
                if (!userDays.has(s.user_id)) userDays.set(s.user_id, new Set());
                userDays.get(s.user_id)!.add(toJSTDate(s.created_at));
            });

            // 7日連続提出者数
            let streak7 = 0;
            const last7days: string[] = [];
            for (let i = 1; i <= 7; i++) last7days.push(toJSTDate(new Date(today.getTime() - i * 24 * 60 * 60 * 1000).toISOString()));
            userDays.forEach((days) => {
                if (last7days.every((d) => days.has(d))) streak7++;
            });
            setStreak7Count(streak7);

            // 提出ランキングTOP10
            const ranked = Array.from(userDays.entries()).map(([uid, days]) => ({ uid, days: days.size })).sort((a, b) => b.days - a.days).slice(0, 10);
            // 3日以上未提出の人
            const { data: allProfiles } = await supabase.from("profiles").select("id, name").eq("is_active", true);
            const lastSubMap = new Map<string, string>();
            submissions.forEach((s: any) => {
                const ex = lastSubMap.get(s.user_id);
                if (!ex || s.created_at > ex) lastSubMap.set(s.user_id, s.created_at);
            });
            const past3 = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);

            if (allProfiles) {
                setTopSubmitters(ranked.map((r) => ({
                    name: (allProfiles as any[]).find((p) => p.id === r.uid)?.name || "?",
                    days: r.days,
                })));
                const notSub = (allProfiles as any[])
                    .map((p) => ({ name: p.name || "?", last: lastSubMap.get(p.id) || null }))
                    .filter((u) => !u.last || new Date(u.last) < past3)
                    .sort((a, b) => {
                        if (!a.last) return 1;
                        if (!b.last) return -1;
                        return new Date(a.last).getTime() - new Date(b.last).getTime();
                    })
                    .slice(0, 15);
                setNotSubmitted(notSub);
            }

            setLoading(false);
        };
        load();
    }, []);

    if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading...</div>;

    const rateColor = (r: number) => r >= 80 ? "#34d399" : r >= 50 ? "#f59e0b" : "#f87171";

    return (
        <div style={{ padding: 24 }}>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>KPI ANALYTICS</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#f9fafb", marginTop: 0, marginBottom: 24 }}>📈 日報提出率アナリティクス</h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
                <ScoreCard icon="📋" label="今日の提出率" value={`${todayRate}%`} sub={`全${totalUsers}人中`} color={rateColor(todayRate)} />
                <ScoreCard icon="📅" label="今週の提出率" value={`${weekRate}%`} sub="過去7日で1回以上" color={rateColor(weekRate)} />
                <ScoreCard icon="🗓️" label="今月の提出率" value={`${monthRate}%`} sub="過去30日で1回以上" color={rateColor(monthRate)} />
                <ScoreCard icon="🔥" label="7日連続提出者" value={streak7Count} sub="毎日出している人" color="#10b981" />
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>📈 日次提出率の推移（過去30日）</div>
                <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={dailyHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} domain={[0, 100]} />
                        <Tooltip contentStyle={{ background: "#1f1f2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} formatter={(v) => `${v}%`} />
                        <Line type="monotone" dataKey="rate" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 3 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>📊 週次提出率の推移（過去8週）</div>
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={weeklyHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="week" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} domain={[0, 100]} />
                        <Tooltip contentStyle={{ background: "#1f1f2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} formatter={(v) => `${v}%`} />
                        <Bar dataKey="rate" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>🏆 提出ランキング（過去30日）</div>
                    {topSubmitters.length === 0 ? <div style={{ color: "#6b7280", fontSize: 13 }}>データなし</div> : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {topSubmitters.map((u, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: i < 3 ? `rgba(${i === 0 ? '251,191,36' : i === 1 ? '156,163,175' : '180,83,9'},0.1)` : "rgba(255,255,255,0.03)" }}>
                                    <span style={{ color: "#f9fafb", fontSize: 13, fontWeight: 600 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`} {u.name}</span>
                                    <span style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700 }}>{u.days}日</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>⚠️ 3日以上未提出</div>
                    {notSubmitted.length === 0 ? <div style={{ color: "#10b981", fontSize: 13 }}>全員提出 ✅</div> : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 350, overflowY: "auto" }}>
                            {notSubmitted.map((u, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.05)" }}>
                                    <span style={{ color: "#f9fafb", fontSize: 13 }}>{u.name}</span>
                                    <span style={{ color: "#9ca3af", fontSize: 11 }}>{u.last ? new Date(u.last).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) : "未提出"}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
