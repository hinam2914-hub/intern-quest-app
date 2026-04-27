"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type StatItem = { icon: string; label: string; value: string | number; sub?: string; color: string };

export default function StatsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState("");

    // 累計データ
    const [points, setPoints] = useState(0);
    const [submissionCount, setSubmissionCount] = useState(0);
    const [thanksReceived, setThanksReceived] = useState(0);
    const [thanksSent, setThanksSent] = useState(0);
    const [kpiLogCount, setKpiLogCount] = useState(0);
    const [learnCompletedCount, setLearnCompletedCount] = useState(0);
    const [challengeCount, setChallengeCount] = useState(0);
    const [streak, setStreak] = useState(0);
    const [daysSinceJoin, setDaysSinceJoin] = useState(0);
    const [growthRank, setGrowthRank] = useState("");
    const [growthGrade, setGrowthGrade] = useState("");

    // 月次KPI
    const [kpiAchievementRate, setKpiAchievementRate] = useState(0);
    const [kpiAchievedCount, setKpiAchievedCount] = useState(0);
    const [kpiTotalCount, setKpiTotalCount] = useState(0);

    // 同期比較
    const [rankAmongPeers, setRankAmongPeers] = useState(0);
    const [totalPeers, setTotalPeers] = useState(0);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }

            // プロフィール
            const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
            setName(profile?.name || "");
            setStreak(profile?.streak || 0);
            setGrowthRank((profile as any)?.growth_rank || "");
            setGrowthGrade((profile as any)?.growth_grade || "");
            if ((profile as any)?.started_at) {
                const days = Math.floor((Date.now() - new Date((profile as any).started_at).getTime()) / (1000 * 60 * 60 * 24));
                setDaysSinceJoin(Math.max(0, days));
            }

            // ポイント
            const { data: pointRow } = await supabase.from("user_points").select("total_earned").eq("id", user.id).single();
            setPoints((pointRow as any)?.total_earned || 0);

            // 日報
            const { count: sCount } = await supabase.from("submissions").select("*", { count: "exact", head: true }).eq("user_id", user.id);
            setSubmissionCount(sCount || 0);

            // サンキュー受領
            const { count: trCount } = await supabase.from("thanks").select("*", { count: "exact", head: true }).eq("to_user_id", user.id);
            setThanksReceived(trCount || 0);

            // サンキュー送信
            const { count: tsCount } = await supabase.from("thanks").select("*", { count: "exact", head: true }).eq("from_user_id", user.id);
            setThanksSent(tsCount || 0);

            // KPI入力
            const { count: kCount } = await supabase.from("kpi_logs").select("*", { count: "exact", head: true }).eq("user_id", user.id);
            setKpiLogCount(kCount || 0);

            // 学習視聴（approved）
            const { count: lCount } = await supabase.from("content_completions").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved");
            setLearnCompletedCount(lCount || 0);

            // ライフチャレンジ（approved）
            const { count: cCount } = await supabase.from("challenge_submissions").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved");
            setChallengeCount(cCount || 0);

            // 月次KPI達成率
            const { data: kpiRows } = await supabase.from("monthly_kpi").select("target, result").eq("user_id", user.id);
            if (kpiRows && kpiRows.length > 0) {
                const achieved = kpiRows.filter((k: any) => k.target > 0 && k.result >= k.target).length;
                setKpiAchievedCount(achieved);
                setKpiTotalCount(kpiRows.length);
                setKpiAchievementRate(Math.round((achieved / kpiRows.length) * 100));
            }

            // 同期比較（ポイント順位）
            const { data: allPoints } = await supabase.from("user_points").select("id, total_earned").order("total_earned", { ascending: false });
            if (allPoints) {
                const myIndex = allPoints.findIndex((p: any) => p.id === user.id);
                setRankAmongPeers(myIndex >= 0 ? myIndex + 1 : 0);
                setTotalPeers(allPoints.length);
            }

            setLoading(false);
        };
        load();
    }, [router]);

    if (loading) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
        </main>
    );

    const stats: StatItem[] = [
        { icon: "💎", label: "総獲得ポイント", value: points.toLocaleString(), sub: "pt", color: "#818cf8" },
        { icon: "📋", label: "日報提出数", value: submissionCount, sub: "件", color: "#8b5cf6" },
        { icon: "📚", label: "学習コンテンツ視聴", value: learnCompletedCount, sub: "本", color: "#06b6d4" },
        { icon: "📊", label: "KPI入力回数", value: kpiLogCount, sub: "回", color: "#06b6d4" },
        { icon: "🎯", label: "月次KPI達成率", value: kpiAchievementRate, sub: `% (${kpiAchievedCount}/${kpiTotalCount})`, color: "#10b981" },
        { icon: "🎉", label: "サンキュー受領", value: thanksReceived, sub: "件", color: "#f59e0b" },
        { icon: "💌", label: "サンキュー送信", value: thanksSent, sub: "件", color: "#f59e0b" },
        { icon: "🏆", label: "ライフチャレンジ達成", value: challengeCount, sub: "件", color: "#ef4444" },
        { icon: "🔥", label: "連続提出日数", value: streak, sub: "日", color: "#f87171" },
        { icon: "📅", label: "入社からの日数", value: daysSinceJoin, sub: "日", color: "#34d399" },
        { icon: "🏅", label: "ランク", value: (growthRank || "-") + (growthGrade ? ` (${growthGrade})` : ""), color: "#ec4899" },
        { icon: "👥", label: "全体順位", value: rankAmongPeers > 0 ? `${rankAmongPeers} / ${totalPeers}` : "-", sub: "位", color: "#6366f1" },
    ];

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.08) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto" }}>
                <div onClick={() => router.push("/menu")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", marginBottom: 8 }}>INTERN QUEST</div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                    <div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "0 0 4px" }}>📊 自分の実績</h1>
                        <p style={{ color: "#9ca3af", fontSize: 14, margin: 0 }}>{name} さんの累計データ</p>
                    </div>
                    <button onClick={() => router.push("/mypage")} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>マイページへ</button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                    {stats.map((stat, idx) => (
                        <div key={idx} style={{ padding: "20px 20px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                <div style={{ fontSize: 20 }}>{stat.icon}</div>
                                <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 1 }}>{stat.label}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                                <div style={{ fontSize: 28, fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                                {stat.sub && <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>{stat.sub}</div>}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: 40, textAlign: "center" }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>メニューへ戻る</button>
                </div>
            </div>
        </main>
    );
}
