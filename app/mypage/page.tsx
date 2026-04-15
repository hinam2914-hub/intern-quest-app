"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";
import { AnimatePresence, motion } from "framer-motion";

type PointHistory = {
    id?: string;
    user_id: string;
    change: number;
    created_at: string;
    reason?: string | null;
};

type ProfileRow = {
    id: string;
    name?: string | null;
    streak?: number | null;
    last_report_date?: string | null;
    education?: string | null;
    started_at?: string | null;
};

type GraphData = { date: string; points: number };

type Badge = {
    id: string;
    icon: string;
    name: string;
    description: string;
    unlocked: boolean;
};

function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function isSameJSTDay(value: string, targetYmd: string): boolean {
    const date = new Date(value);
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}` === targetYmd;
}

function formatDateTimeJST(value: string): string {
    const date = new Date(value);
    return date.toLocaleString("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatReason(reason?: string | null): string {
    if (!reason) return "ポイント追加";
    if (reason === "manual_add") return "手動追加";
    if (reason === "login_bonus") return "ログインボーナス";
    if (reason === "report_submit") return "日報提出";
    if (reason === "streak_bonus") return "連続提出ボーナス";
    if (reason === "content_complete") return "学習完了";
    if (reason === "thanks_received") return "サンキュー受領";
    if (reason === "shop_purchase") return "ショップ購入";
    if (reason === "admin_edit") return "管理者編集";
    if (reason === "team_achievement") return "チーム達成ボーナス";
    return reason;
}
function getStatusColor(status: string): string {
    if (status === "Leader") return "linear-gradient(135deg, #f59e0b, #ef4444)";
    if (status === "Core") return "linear-gradient(135deg, #6366f1, #8b5cf6)";
    if (status === "Active") return "linear-gradient(135deg, #06b6d4, #3b82f6)";
    if (status === "Basic") return "linear-gradient(135deg, #34d399, #10b981)";
    return "linear-gradient(135deg, #374151, #6b7280)";
}

function getStatusDesc(status: string): string {
    if (status === "Leader") return "チームを牽引するリーダー";
    if (status === "Core") return "組織の中核メンバー";
    if (status === "Active") return "安定稼働中";
    if (status === "Basic") return "基礎習得中";
    return "オンボーディング中";
}
function getLevel(points: number): number { return Math.max(1, Math.floor(points / 100) + 1); }
function getExp(points: number): number { return points % 100; }
function getBadgeLabel(level: number): string {
    if (level >= 15) return "達人";
    if (level >= 10) return "上級者";
    if (level >= 5) return "中級者";
    return "初級者";
}
function getBadgeColor(level: number): string {
    if (level >= 15) return "linear-gradient(135deg, #f59e0b, #ef4444)";
    if (level >= 10) return "linear-gradient(135deg, #6366f1, #8b5cf6)";
    if (level >= 5) return "linear-gradient(135deg, #06b6d4, #3b82f6)";
    return "linear-gradient(135deg, #374151, #6b7280)";
}
function getRank(score: number): string {
    if (score >= 90) return "SS";
    if (score >= 80) return "S";
    if (score >= 70) return "A";
    if (score >= 60) return "B";
    if (score >= 50) return "C";
    return "D";
}
function getRankColor(rank: string): string {
    if (rank === "SS") return "linear-gradient(135deg, #f59e0b, #ef4444)";
    if (rank === "S") return "linear-gradient(135deg, #a855f7, #ec4899)";
    if (rank === "A") return "linear-gradient(135deg, #6366f1, #3b82f6)";
    if (rank === "B") return "linear-gradient(135deg, #06b6d4, #10b981)";
    if (rank === "C") return "linear-gradient(135deg, #84cc16, #22c55e)";
    return "linear-gradient(135deg, #374151, #6b7280)";
}
function getRankScore(params: {
    level: number; streak: number; points: number; isSubmitted: boolean;
    submissionCount: number; thanksCount: number; kpiCount: number;
    activeDays: number; education: string;
}): number {
    const { level, streak, submissionCount, thanksCount, kpiCount, activeDays, education } = params;
    const eduScore = education ? 8 : 0;
    const activityScore = Math.min(activeDays * 0.5, 15);
    const kpiScore = Math.min(kpiCount * 3, 15);
    const streakScore = Math.min(streak * 2, 20);
    const leaderScore = Math.min(thanksCount * 2, 10);
    const outputScore = Math.min(submissionCount * 2, 20);
    const metaScore = Math.min(level, 10);
    const total = eduScore + activityScore + kpiScore + streakScore + leaderScore + outputScore + metaScore;
    return Math.min(Math.round(total), 100);
}
function getNextRankInfo(rank: string): string {
    if (rank === "SS") return "最高ランク到達！";
    if (rank === "S") return "あと少しでSS到達";
    if (rank === "A") return "Sランクを目指そう";
    if (rank === "B") return "Aランクを目指そう";
    if (rank === "C") return "Bランクを目指そう";
    return "Cランクを目指そう";
}
function getActionMessage(isSubmitted: boolean, streak: number): string {
    if (!isSubmitted) return "📋 日報を提出してポイントを獲得しましょう";
    if (streak >= 7) return "🔥 連続提出が素晴らしい。この調子で継続しましょう";
    if (streak >= 3) return "⚡ 継続できています。次は上位を狙いましょう";
    return "📚 学習コンテンツを進めましょう";
}
function generateAIComment(params: { name: string; level: number; rank2: string; rankScore: number; streak: number; isSubmitted: boolean; points: number }): string {
    const { name, level, rank2, streak, isSubmitted, points } = params;
    if (!isSubmitted && streak <= 1) return `${name}さん、今日はまだ日報が未提出です。小さな一歩でも記録することで成長が加速します。今すぐ提出しましょう！`;
    if (streak >= 7) return `${name}さん、${streak}日連続提出は本物の習慣力の証です。この継続力こそが市場価値を高める最大の武器。ランク${rank2}はあなたの実力を正しく示しています。`;
    if (streak >= 3) return `${name}さん、${streak}日連続で素晴らしい！継続は最強のスキルです。このペースを維持すればランクアップも近いです。`;
    if (rank2 === "SS" || rank2 === "S") return `${name}さん、ランク${rank2}到達おめでとうございます！トップクラスの成長速度です。この調子でインターン業界をリードしていきましょう。`;
    if (level >= 10) return `${name}さん、Lv.${level}まで成長しました。${points}ptという実績はあなたの努力の証。次はランクアップを目指しましょう！`;
    if (points < 100) return `${name}さん、まだ始まったばかりです。毎日の日報提出を続けることで、一気に成長できます。今日から習慣にしましょう！`;
    return `${name}さん、着実に成長しています。日報の継続とKPI達成を意識することで、さらに上のランクが見えてきます。`;
}

function buildGraphData(history: PointHistory[]): GraphData[] {
    const dayMap: Record<string, number> = {};
    [...history].reverse().forEach((item) => {
        const date = new Date(item.created_at);
        const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
        const key = `${jst.getUTCMonth() + 1}/${jst.getUTCDate()}`;
        dayMap[key] = (dayMap[key] || 0) + item.change;
    });
    let cumulative = 0;
    return Object.entries(dayMap).map(([date, pts]) => {
        cumulative += pts;
        return { date, points: cumulative };
    });
}

function getBadges(points: number, streak: number): Badge[] {
    return [
        { id: "first_step", icon: "🔥", name: "はじめの一歩", description: "3日連続提出", unlocked: streak >= 3 },
        { id: "keep_going", icon: "⚡", name: "継続の力", description: "7日連続提出", unlocked: streak >= 7 },
        { id: "habit_master", icon: "💎", name: "習慣マスター", description: "30日連続提出", unlocked: streak >= 30 },
        { id: "newbie", icon: "🌱", name: "新人", description: "100pt達成", unlocked: points >= 100 },
        { id: "growing", icon: "⭐", name: "成長中", description: "500pt達成", unlocked: points >= 500 },
        { id: "ace", icon: "🏆", name: "エース", description: "1000pt達成", unlocked: points >= 1000 },
        { id: "legend", icon: "👑", name: "レジェンド", description: "5000pt達成", unlocked: points >= 5000 },
        { id: "combo", icon: "🎯", name: "コンボ", description: "3日連続＋100pt", unlocked: streak >= 3 && points >= 100 },
    ];
}

export default function MyPage() {
    const router = useRouter();
    const [userId, setUserId] = useState("");
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [inputName, setInputName] = useState("");
    const [myKpis, setMyKpis] = useState<{ deptName: string; target: number; result: number; rate: number; pts: number; approved: boolean }[]>([]);
    const [education, setEducation] = useState("");
    const [departmentId, setDepartmentId] = useState("");
    const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
    const [points, setPoints] = useState(0);
    const [rank, setRank] = useState<number | null>(null);
    const [streak, setStreak] = useState(0);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [history, setHistory] = useState<PointHistory[]>([]);
    const [graphData, setGraphData] = useState<GraphData[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [showNameModal, setShowNameModal] = useState(false);
    const [announcements, setAnnouncements] = useState<{ id: string; title: string; content: string }[]>([]);
    const [closedAnnouncements, setClosedAnnouncements] = useState<string[]>([]);
    const [levelUpShow, setLevelUpShow] = useState(false);
    const [prevLevel, setPrevLevel] = useState(0);
    const [submissionCount, setSubmissionCount] = useState(0);
    const [thanksCount, setThanksCount] = useState(0);
    const [kpiCount, setKpiCount] = useState(0);
    const [activeDays, setActiveDays] = useState(0);
    const [todayKpiDone, setTodayKpiDone] = useState(false);
    const [todayThanksDone, setTodayThanksDone] = useState(false);
    const [todayLearnDone, setTodayLearnDone] = useState(false);
    const [mbti, setMbti] = useState("");
    const [club, setClub] = useState("");
    const [growthStatus, setGrowthStatus] = useState("Onboarding");
    const [growthRank, setGrowthRank] = useState("");
    const [growthGrade, setGrowthGrade] = useState("");
    const [themeColor, setThemeColor] = useState("#6366f1");
    const [bgColor, setBgColor] = useState("");
    const isLightBg = useMemo(() =>
        ["#fce4ec", "#f3e5f5", "#e8f5e9", "#e3f2fd", "#fff9e6"].includes(bgColor),
        [bgColor]);
    const [fontFamily, setFontFamily] = useState("'Inter', sans-serif");

    const todayYmd = getTodayJST();
    const level = getLevel(points);
    const exp = getExp(points);
    const badgeLabel = getBadgeLabel(level);
    const badgeColor = getBadgeColor(level);
    const actionMessage = getActionMessage(isSubmitted, streak);
    const rankScore = getRankScore({ level, streak, points, isSubmitted, submissionCount, thanksCount, kpiCount, activeDays, education });
    const rank2 = getRank(rankScore);
    const rankColor = getRankColor(rank2);
    const nextRankInfo = getNextRankInfo(rank2);
    const aiComment = generateAIComment({ name, level, rank2, rankScore, streak, isSubmitted, points });
    const badges = getBadges(points, streak);
    const unlockedCount = badges.filter(b => b.unlocked).length;
    const loadPage = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }
        setUserId(user.id);

        const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (profileData) {
            const profile = profileData as ProfileRow;
            setName(profile.name || "");
            setInputName(profile.name || "");
            setStreak(profile.streak ?? 0);
            setEducation(profile.education || "");
            setDepartmentId((profileData as any)?.department_id || "");
            setAvatarUrl((profileData as any)?.avatar_url || null);
            setThemeColor((profileData as any)?.theme_color || "#6366f1");
            setBgColor((profileData as any)?.bg_color || "#0a0a0f");
            setFontFamily((profileData as any)?.font_family || "'Inter', sans-serif");
            setGrowthRank((profileData as any)?.growth_rank || "");
            setGrowthGrade((profileData as any)?.growth_grade || "");
            // 育成ステータス自動判定
            const rawStatus = (profileData as any)?.growth_status || "Onboarding";
            const autoStatus = (() => {
                if (points >= 1500 || rank2 === "S" || rank2 === "SS" || thanksCount >= 10) return "Leader";
                if (points >= 700 || submissionCount >= 60) return "Core";
                if (points >= 300 || submissionCount >= 30 || streak >= 7) return "Active";
                if (points >= 100 || submissionCount >= 10) return "Basic";
                return "Onboarding";
            })();
            // 管理者が上書きしていれば優先
            setGrowthStatus(rawStatus !== "Onboarding" ? rawStatus : autoStatus);
            setMbti((profileData as any)?.mbti || "");
            setClub((profileData as any)?.club || "");
            if (profile.started_at) {
                const start = new Date(profile.started_at);
                const now = new Date();
                const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                setActiveDays(days);
            }
        }

        const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", user.id).single();
        setPoints(pointRow?.points || 0);

        const { data: rankingRows } = await supabase.from("user_points").select("id, points").order("points", { ascending: false });
        if (rankingRows) {
            const myRank = rankingRows.findIndex((row) => row.id === user.id);
            setRank(myRank >= 0 ? myRank + 1 : null);
        }

        const { data: historyRows } = await supabase.from("points_history").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
        const hist = (historyRows || []) as PointHistory[];
        setHistory(hist);
        setGraphData(buildGraphData(hist));

        const { data: submissionRows } = await supabase.from("submissions").select("created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
        setIsSubmitted(submissionRows?.some((row) => isSameJSTDay(row.created_at, todayYmd)) || false);

        if (!profileData?.name) setShowNameModal(true);

        const newLevel = Math.max(1, Math.floor((pointRow?.points || 0) / 100) + 1);
        if (prevLevel > 0 && newLevel > prevLevel) {
            setLevelUpShow(true);
            setTimeout(() => setLevelUpShow(false), 3000);
        }
        setPrevLevel(newLevel);

        const { count: subCount } = await supabase.from("submissions").select("*", { count: "exact", head: true }).eq("user_id", user.id);
        setSubmissionCount(subCount || 0);

        const { count: tCount } = await supabase.from("thanks").select("*", { count: "exact", head: true }).eq("to_user_id", user.id);
        setThanksCount(tCount || 0);

        const { count: kCount } = await supabase.from("kpi_logs").select("*", { count: "exact", head: true }).eq("user_id", user.id);
        setKpiCount(kCount || 0);

        const { data: announceRows } = await supabase.from("announcements").select("*").eq("is_active", true).order("created_at", { ascending: false });
        setAnnouncements((announceRows || []) as { id: string; title: string; content: string }[]);

        // デイリーミッション確認
        const { data: todayKpiRows } = await supabase
            .from("kpi_logs").select("created_at").eq("user_id", user.id);
        setTodayKpiDone(todayKpiRows?.some(r => isSameJSTDay(r.created_at, todayYmd)) || false);

        const { data: todayThanksRows } = await supabase
            .from("thanks").select("created_at").eq("from_user_id", user.id);
        setTodayThanksDone(todayThanksRows?.some(r => isSameJSTDay(r.created_at, todayYmd)) || false);

        const { data: todayLearnRows } = await supabase
            .from("content_completions").select("created_at").eq("user_id", user.id);
        setTodayLearnDone(todayLearnRows?.some(r => isSameJSTDay(r.created_at, todayYmd)) || false);

        const { data: deptRows } = await supabase.from("departments").select("id, name, code").order("created_at");
        setDepartments((deptRows || []) as { id: string; name: string; code: string }[]);

        // 月次KPI取得
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const { data: kpiRows } = await supabase.from("monthly_kpi").select("*").eq("user_id", user.id).eq("year_month", ym);
        const { data: kpiDeptRows } = await supabase.from("departments").select("*");
        const { data: targetRows } = await supabase.from("monthly_targets").select("*").eq("year_month", ym).eq("user_id", user.id);

        // ✅ 修正: kpiRows.map(k => ...) を正しく記述
        if (kpiRows && kpiDeptRows) {
            const kpis = kpiRows.map((k: any) => {
                const dept = kpiDeptRows.find((d: any) => d.id === k.department_id);
                const officialTarget = targetRows?.find((t: any) => t.department_id === k.department_id)?.target || k.target;
                const rate = officialTarget > 0 ? Math.round((k.result / officialTarget) * 100) : 0;
                const pts = rate >= 120 ? 50 : rate >= 100 ? 30 : rate >= 80 ? 20 : rate >= 60 ? 10 : 0;
                return { deptName: dept?.name || "不明", target: officialTarget, result: k.result, rate, pts, approved: k.approved };
            });
            setMyKpis(kpis);
        }
        function getStatusColor(status: string): string {
            if (status === "Leader") return "linear-gradient(135deg, #f59e0b, #ef4444)";
            if (status === "Core") return "linear-gradient(135deg, #6366f1, #8b5cf6)";
            if (status === "Active") return "linear-gradient(135deg, #06b6d4, #3b82f6)";
            if (status === "Basic") return "linear-gradient(135deg, #34d399, #10b981)";
            return "linear-gradient(135deg, #374151, #6b7280)";
        }

        function getStatusDesc(status: string): string {
            if (status === "Leader") return "チームを牽引するリーダー";
            if (status === "Core") return "組織の中核メンバー";
            if (status === "Active") return "安定稼働中";
            if (status === "Basic") return "基礎習得中";
            return "オンボーディング中";
        }
        setLoading(false);
    };

    useEffect(() => { loadPage(); }, []);

    const handleSaveProfile = async () => {
        if (!userId) return;
        await supabase.from("profiles").update({
            name: inputName.trim(),
            education: education.trim(),
            department_id: departmentId || null,
        }).eq("id", userId);
        setName(inputName.trim());
        setMessage("✅ プロフィールを保存しました");
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    return (
        <main style={{
            minHeight: "100vh", background: bgColor, padding: "40px 24px 64px", fontFamily: fontFamily, color: isLightBg ? "#1a1a2e" : "#f9fafb",
        }}>
            {isLightBg && (
                <style>{`
        * { color: #1a1a2e !important; }
        .keep-color { color: inherit !important; }
    `}</style>
            )}
            {/* 名前入力モーダル */}
            {showNameModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ background: "#0f0f1a", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 20, padding: 40, width: 400 }}>
                        <div style={{ fontSize: 12, color: themeColor, fontWeight: 700, letterSpacing: 3, marginBottom: 8 }}>INTERN QUEST</div>
                        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#f9fafb", margin: "0 0 8px" }}>名前を教えてください</h2>
                        <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 24px" }}>ランキングや管理画面に表示されます</p>
                        <input value={inputName} onChange={(e) => setInputName(e.target.value)} placeholder="例：田中太郎" onKeyDown={(e) => e.key === "Enter" && handleSaveProfile()} style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 16 }} />
                        <button onClick={async () => { await handleSaveProfile(); setShowNameModal(false); }} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 16 }}>登録する →</button>
                    </div>
                </div>
            )}

            {/* レベルアップ演出 */}
            <AnimatePresence>
                {levelUpShow && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.5, y: -50 }}
                        transition={{ type: "spring", bounce: 0.5 }}
                        style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}
                    >
                        <div style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: 24, padding: "40px 60px", textAlign: "center", boxShadow: "0 0 80px rgba(99,102,241,0.6)" }}>
                            <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
                            <div style={{ fontSize: 14, color: "#c7d2fe", fontWeight: 700, letterSpacing: 3 }}>LEVEL UP!</div>
                            <div style={{ fontSize: 48, fontWeight: 900, color: "#fff", margin: "8px 0" }}>Lv.{level}</div>
                            <div style={{ fontSize: 14, color: "#c7d2fe" }}>おめでとうございます！</div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: `radial-gradient(ellipse at 20% 50%, ${themeColor}08 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, ${themeColor}05 0%, transparent 60%)` }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto" }}>

                {/* ヘッダー */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ position: "relative", flexShrink: 0 }}>
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={name} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", display: "block", border: "3px solid rgba(99,102,241,0.6)" }} />
                            ) : (
                                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                                    {name ? name.charAt(0) : "?"}
                                </div>
                            )}
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: themeColor, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>INTERN QUEST</div>
                            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f9fafb", margin: 0, lineHeight: 1 }}>{name || "名前未設定"}</h1>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => router.push("/report")} style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}aa)`, color: "#fff", padding: "8px 16px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>📋 日報提出</button>
                        <button onClick={() => router.push("/menu")} style={{ background: "rgba(255,255,255,0.05)", color: "#d1d5db", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>☰ メニュー</button>
                    </div>
                </div>

                {/* お知らせバナー */}
                {announcements.filter(a => !closedAnnouncements.includes(a.id)).map((a) => (
                    <div key={a.id} style={{ marginBottom: 12, padding: "14px 20px", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", marginBottom: 4 }}>📢 {a.title}</div>
                            <div style={{ fontSize: 13, color: "#c7d2fe", lineHeight: 1.6 }}>{a.content}</div>
                        </div>
                        <button onClick={() => setClosedAnnouncements(prev => [...prev, a.id])} style={{ marginLeft: 16, background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18 }}>×</button>
                    </div>
                ))}

                {message && (
                    <div style={{ marginBottom: 20, padding: "12px 20px", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, color: "#a5b4fc", fontSize: 14 }}>
                        {message}
                    </div>
                )}

                {/* メイングリッド */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, backdropFilter: "blur(10px)" }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>TOTAL POINTS</div>
                        <div style={{ fontSize: 48, fontWeight: 800, color: "#f9fafb", lineHeight: 1 }}>{points.toLocaleString()}</div>
                        <div style={{ fontSize: 16, color: "#6366f1", fontWeight: 600, marginTop: 4 }}>pt</div>
                        <div style={{ marginTop: 16, padding: "6px 12px", background: "rgba(99,102,241,0.1)", borderRadius: 6, display: "inline-block" }}>
                            <span style={{ fontSize: 12, color: "#818cf8" }}>🏆 順位 {rank || "-"}位</span>
                        </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, backdropFilter: "blur(10px)" }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>LEVEL</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                            <div style={{ fontSize: 48, fontWeight: 800, color: "#f9fafb", lineHeight: 1 }}>Lv.{level}</div>
                            <div style={{ padding: "4px 10px", borderRadius: 6, background: badgeColor, fontSize: 12, fontWeight: 700, color: "#fff" }}>{badgeLabel}</div>
                        </div>
                        <div style={{ marginTop: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
                                <span>EXP {exp}/100</span><span>次まで {100 - exp}</span>
                            </div>
                            <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)" }}>
                                <div style={{ height: "100%", width: `${exp}%`, background: "linear-gradient(90deg, #6366f1, #8b5cf6)", borderRadius: 999, transition: "width 0.6s ease" }} />
                            </div>
                        </div>
                    </div>
                    {/* 育成ステータス */}
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, backdropFilter: "blur(10px)" }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>GROWTH STATUS</div>
                        {growthRank ? (
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                                    <div style={{ padding: "6px 16px", borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", fontSize: 20, fontWeight: 900, color: "#fff" }}>
                                        {growthRank}
                                    </div>
                                    {growthGrade && (
                                        <div style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(255,255,255,0.08)", fontSize: 14, fontWeight: 700, color: "#d1d5db" }}>
                                            {growthGrade}
                                        </div>
                                    )}
                                </div>
                                <div style={{ fontSize: 13, color: "#6b7280" }}>社内育成フェーズ</div>
                            </div>
                        ) : (
                            <div style={{ fontSize: 14, color: "#6b7280" }}>未設定（管理者が設定します）</div>
                        )}
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, backdropFilter: "blur(10px)" }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>EFFORT RANK</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <div style={{ width: 72, height: 72, borderRadius: 16, background: rankColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: "#fff", boxShadow: "0 0 24px rgba(99,102,241,0.4)" }}>{rank2}</div>
                            <div>
                                <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 4 }}>スコア</div>
                                <div style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb" }}>{rankScore}</div>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>/100</div>
                            </div>
                        </div>
                        <div style={{ marginTop: 16 }}>
                            <div style={{ height: 4, borderRadius: 999, background: "rgba(255,255,255,0.08)" }}>
                                <div style={{ height: "100%", width: `${rankScore}%`, background: rankColor, borderRadius: 999, transition: "width 0.6s ease" }} />
                            </div>
                            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>{nextRankInfo}</div>
                        </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, backdropFilter: "blur(10px)" }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>STREAK</div>
                        <div style={{ fontSize: 48, fontWeight: 800, color: "#f9fafb", lineHeight: 1 }}>{streak}</div>
                        <div style={{ fontSize: 16, color: "#f59e0b", fontWeight: 600, marginTop: 4 }}>日連続</div>
                        <div style={{ marginTop: 16, fontSize: 13, color: "#9ca3af" }}>{actionMessage}</div>
                    </div>
                </div>

                {/* 7軸スコア レーダーチャート */}
                <div style={{ marginBottom: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>7-AXIS EVALUATION</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "center" }}>
                        {/* レーダーチャート */}
                        <ResponsiveContainer width="100%" height={280}>
                            <RadarChart data={[
                                { axis: "学歴", value: education ? 8 : 0, max: 10 },
                                { axis: "活動期間", value: Math.min(activeDays * 0.5, 15), max: 15 },
                                { axis: "実績KPI", value: Math.min(kpiCount * 3, 15), max: 15 },
                                { axis: "再現性", value: Math.min(streak * 2, 20), max: 20 },
                                { axis: "リーダーシップ", value: Math.min(thanksCount * 2, 10), max: 10 },
                                { axis: "アウトプット", value: Math.min(submissionCount * 2, 20), max: 20 },
                                { axis: "メタ認知", value: Math.min(level, 10), max: 10 },
                            ]}>
                                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                                <PolarAngleAxis dataKey="axis" tick={{ fill: "#9ca3af", fontSize: 11, fontWeight: 600 }} />
                                <Radar name="スコア" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} strokeWidth={2} />
                            </RadarChart>
                        </ResponsiveContainer>

                        {/* バー表示 */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {[
                                { label: "学歴", value: education ? 8 : 0, max: 10, color: "#6366f1", tip: "学歴を登録するとスコアが上がります" },
                                { label: "活動期間", value: Math.min(activeDays * 0.5, 15), max: 15, color: "#8b5cf6", tip: "インターン参加日数に応じて上がります" },
                                { label: "実績KPI", value: Math.min(kpiCount * 3, 15), max: 15, color: "#06b6d4", tip: "KPIを入力するたびに上がります" },
                                { label: "再現性", value: Math.min(streak * 2, 20), max: 20, color: "#f59e0b", tip: "日報を連続提出するほど上がります" },
                                { label: "リーダーシップ", value: Math.min(thanksCount * 2, 10), max: 10, color: "#ec4899", tip: "サンキューを受け取るほど上がります" },
                                { label: "アウトプット", value: Math.min(submissionCount * 2, 20), max: 20, color: "#34d399", tip: "日報を提出するたびに上がります" },
                                { label: "メタ認知", value: Math.min(level, 10), max: 10, color: "#f97316", tip: "レベルアップするたびに上がります" },
                            ].map((axis) => (
                                <div key={axis.label} style={{ position: "relative" }}
                                    onMouseEnter={(e) => {
                                        const tip = document.getElementById(`tip-${axis.label}`);
                                        if (tip) tip.style.display = "block";
                                    }}
                                    onMouseLeave={() => {
                                        const tip = document.getElementById(`tip-${axis.label}`);
                                        if (tip) tip.style.display = "none";
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>
                                        <span style={{ cursor: "help", borderBottom: "1px dashed rgba(255,255,255,0.2)" }}>{axis.label} 💡</span>
                                        <span style={{ color: axis.color, fontWeight: 700 }}>{Math.round(axis.value)} / {axis.max}</span>
                                    </div>
                                    <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
                                        <div style={{ height: "100%", width: `${(axis.value / axis.max) * 100}%`, background: axis.color, borderRadius: 999, transition: "width 0.8s ease" }} />
                                    </div>
                                    {/* ツールチップ */}
                                    <div id={`tip-${axis.label}`} style={{ display: "none", position: "absolute", top: -36, left: 0, background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#c7d2fe", whiteSpace: "nowrap", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
                                        {axis.tip}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {!education && (
                        <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", fontSize: 12, color: "#fbbf24" }}>
                            💡 プロフィールに学歴を登録するとスコアが上がります
                        </div>
                    )}
                </div>

                {/* 月次KPI */}
                {myKpis.length > 0 && (
                    <div style={{ marginBottom: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2 }}>MONTHLY KPI</div>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>{new Date().getFullYear()}/{new Date().getMonth() + 1}月</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {myKpis.map((kpi, i) => {
                                const rateColor = kpi.rate >= 100 ? "#34d399" : kpi.rate >= 80 ? "#f59e0b" : kpi.rate >= 60 ? "#f97316" : "#f87171";
                                return (
                                    <div key={i} style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${kpi.approved ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.06)"}` }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ padding: "2px 10px", borderRadius: 6, background: "rgba(99,102,241,0.2)", color: "#818cf8", fontSize: 12, fontWeight: 700 }}>{kpi.deptName}</span>
                                                {kpi.approved && <span style={{ fontSize: 12, color: "#34d399", fontWeight: 600 }}>✅ 承認済</span>}
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                                <span style={{ fontSize: 13, color: "#9ca3af" }}>{kpi.result} / {kpi.target}件</span>
                                                <span style={{ fontSize: 20, fontWeight: 800, color: rateColor }}>{kpi.rate}%</span>
                                                <span style={{ fontSize: 16, fontWeight: 700, color: kpi.pts > 0 ? "#818cf8" : "#6b7280" }}>{kpi.approved ? `+${kpi.pts}pt` : `予定${kpi.pts}pt`}</span>
                                            </div>
                                        </div>
                                        <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
                                            <div style={{ height: "100%", width: `${Math.min(kpi.rate, 100)}%`, background: rateColor, borderRadius: 999, transition: "width 0.8s ease" }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <button
                            onClick={() => router.push("/kpi")}
                            style={{ marginTop: 16, width: "100%", padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "#9ca3af", fontWeight: 600, cursor: "pointer", fontSize: 14 }}
                        >
                            📊 KPIを入力・更新する
                        </button>
                    </div>
                )}

                {/* デイリーミッション */}
                <div style={{ marginBottom: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2 }}>DAILY MISSIONS</div>
                        <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 600 }}>
                            {[true, isSubmitted, todayKpiDone, todayThanksDone, todayLearnDone].filter(Boolean).length} / 5 完了
                        </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                            { icon: "🔐", label: "ログインする", done: true, pt: "+1pt", path: null },
                            { icon: "📋", label: "日報を提出する", done: isSubmitted, pt: "+2pt", path: "/report" },
                            { icon: "📊", label: "KPIを入力する", done: todayKpiDone, pt: "✨", path: "/report" },
                            { icon: "🎉", label: "サンキューを送る", done: todayThanksDone, pt: "✨", path: "/thanks" },
                            { icon: "📚", label: "学習を完了する", done: todayLearnDone, pt: "+2pt", path: "/learn" },
                        ].map((mission) => (
                            <div
                                key={mission.label}
                                onClick={() => mission.path && !mission.done && router.push(mission.path)}
                                style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    padding: "12px 16px", borderRadius: 12,
                                    background: mission.done ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.02)",
                                    border: `1px solid ${mission.done ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.06)"}`,
                                    cursor: mission.path && !mission.done ? "pointer" : "default",
                                    opacity: mission.done ? 1 : 0.8,
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <span style={{ fontSize: 20 }}>{mission.done ? "✅" : mission.icon}</span>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: mission.done ? "#34d399" : "#d1d5db", textDecoration: mission.done ? "line-through" : "none" }}>
                                        {mission.label}
                                    </span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: mission.done ? "#34d399" : "#6b7280" }}>{mission.pt}</span>
                                    {!mission.done && mission.path && (
                                        <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 700 }}>→</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* AIメタ認知コメント */}
                <div style={{ marginBottom: 16, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 16, padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🤖</div>
                            <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2 }}>AI METACOGNITION</div>
                        </div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                            {new Date().toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}
                        </div>
                    </div>
                    <p style={{ margin: "0 0 16px", fontSize: 15, color: "#c7d2fe", lineHeight: 1.8, fontWeight: 500 }}>{aiComment}</p>
                    <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", fontSize: 13, color: "#818cf8", fontWeight: 600 }}>
                        💡 {[
                            "小さな積み重ねが大きな差を生む。今日も一歩前へ。",
                            "成長は毎日の習慣から生まれる。継続こそ最強のスキル。",
                            "今日の努力は必ず明日の自分に返ってくる。",
                            "トップ営業マンも最初は初心者だった。諦めずに続けよう。",
                            "失敗は成功のデータ。今日も全力でぶつかろう。",
                            "1日1%の成長で1年後には37倍になる。今日も成長しよう。",
                            "行動した人だけが結果を手にできる。まず動こう。",
                        ][new Date().getDay()]}
                    </div>
                </div>

                {/* ポイント推移グラフ */}
                <div style={{ marginBottom: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>POINT GROWTH</div>
                    {graphData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={graphData}>
                                <XAxis dataKey="date" stroke="#4b5563" tick={{ fill: "#6b7280", fontSize: 11 }} />
                                <YAxis stroke="#4b5563" tick={{ fill: "#6b7280", fontSize: 11 }} />
                                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#f9fafb" }} formatter={(value: unknown) => [`${value}pt`, "累計ポイント"]} />
                                <Line type="monotone" dataKey="points" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 4 }} activeDot={{ r: 6, fill: "#8b5cf6" }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ color: "#6b7280", fontSize: 14, textAlign: "center", padding: 40 }}>データが蓄積されるとグラフが表示されます</div>
                    )}
                </div>

                {/* 下段 */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>PROFILE</div>
                            {/* MBTI・部活表示 */}
                            {(mbti || club) && (
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                                    {mbti && (
                                        <div style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", fontSize: 12, color: "#818cf8", fontWeight: 700 }}>
                                            🧠 {mbti}
                                        </div>
                                    )}
                                    {club && (
                                        <div style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", fontSize: 12, color: "#f59e0b", fontWeight: 700 }}>
                                            ⚽ {club}
                                        </div>
                                    )}
                                </div>
                            )}
                            <input
                                value={inputName}
                                onChange={(e) => setInputName(e.target.value)}
                                placeholder="名前を入力"
                                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
                            />
                            <input
                                value={education}
                                onChange={(e) => setEducation(e.target.value)}
                                placeholder="学歴を入力（例：〇〇大学）"
                                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
                            />
                            <select
                                value={departmentId}
                                onChange={(e) => setDepartmentId(e.target.value)}
                                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#1a1a2e", color: departmentId ? "#f9fafb" : "#6b7280", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
                            >
                                <option value="">事業部を選択</option>
                                {departments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleSaveProfile}
                                style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
                            >
                                保存
                            </button>
                        </div>
                        <button onClick={() => router.push("/history")} style={{ padding: "14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#9ca3af", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>履歴を見る →</button>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>RECENT ACTIVITY</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {history.slice(0, 8).map((item, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "#d1d5db" }}>{formatReason(item.reason)}</div>
                                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{formatDateTimeJST(item.created_at)}</div>
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: item.change >= 0 ? "#34d399" : "#f87171" }}>
                                        {item.change > 0 ? `+${item.change}` : item.change}pt
                                    </div>
                                </div>
                            ))}
                            {history.length === 0 && <div style={{ color: "#6b7280", fontSize: 14 }}>履歴がありません</div>}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}