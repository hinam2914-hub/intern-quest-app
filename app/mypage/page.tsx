"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
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

type Trophy = {
    id: string;
    icon: string;
    name: string;
    description: string;
    rarity: "common" | "rare" | "epic" | "legendary";
    unlocked: boolean;
};

type UserTag = { id: string; tag: string; };

// パーティクル型
type Particle = {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    life: number;
    maxLife: number;
    shape: "circle" | "star" | "rect";
};

// フローティングポイント型
type FloatingPoint = {
    id: number;
    x: number;
    y: number;
    value: number;
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
    return Math.min(Math.round(eduScore + activityScore + kpiScore + streakScore + leaderScore + outputScore + metaScore), 100);
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
    if (!isSubmitted) return "📋 日報を提出しよう";
    if (streak >= 7) return "🔥 連続提出が素晴らしい。この調子で継続しましょう";
    if (streak >= 3) return "⚡ 継続できています。次は上位を狙いましょう";
    return "📚 学習コンテンツを進めましょう";
}
function generateAIComment(params: { name: string; level: number; rank2: string; rankScore: number; streak: number; isSubmitted: boolean; points: number }): string {
    const { name, level, rank2, streak, isSubmitted, points } = params;
    if (!isSubmitted && streak <= 1) return `${name}さん、今日はまだ日報が未提出です。小さな一歩でも記録することで成長が加速します。今すぐ提出しましょう！`;
    if (streak >= 7) return `${name}さん、${streak}日連続提出は本物の習慣力の証です。この継続力こそが市場価値を高める最大の武器。ランク${rank2}はあなたの実力を正しく示しています。`;
    if (streak >= 3) return `${name}さん、${streak}日連続で素晴らしい！継続は最強のスキルです。このペースを維持すればランクアップも近いです。`;
    if (rank2 === "SS" || rank2 === "S") return `${name}さん、ランク${rank2}到達おめでとうございます！トップクラスの成長速度です。`;
    if (level >= 10) return `${name}さん、Lv.${level}まで成長しました。${points}ptという実績はあなたの努力の証。`;
    if (points < 100) return `${name}さん、まだ始まったばかりです。毎日の日報提出を続けることで、一気に成長できます。`;
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

function getBadges(points: number, streak: number, contentCompletionCount: number, esCompleted: boolean): Badge[] {
    return [
        { id: "first_step", icon: "🔥", name: "はじめの一歩", description: "3日連続提出", unlocked: streak >= 3 },
        { id: "keep_going", icon: "⚡", name: "継続の力", description: "7日連続提出", unlocked: streak >= 7 },
        { id: "habit_master", icon: "💎", name: "習慣マスター", description: "30日連続提出", unlocked: streak >= 30 },
        { id: "newbie", icon: "🌱", name: "新人", description: "100pt達成", unlocked: points >= 100 },
        { id: "growing", icon: "⭐", name: "成長中", description: "500pt達成", unlocked: points >= 500 },
        { id: "ace", icon: "🏆", name: "エース", description: "1000pt達成", unlocked: points >= 1000 },
        { id: "legend", icon: "👑", name: "レジェンド", description: "5000pt達成", unlocked: points >= 5000 },
        { id: "combo", icon: "🎯", name: "コンボ", description: "3日連続＋100pt", unlocked: streak >= 3 && points >= 100 },
        { id: "es_writer", icon: "📝", name: "ES記入者", description: "総合ES初回完成", unlocked: esCompleted },
        { id: "learn_habit", icon: "📚", name: "学びの習慣", description: "学習コンテンツ10本完了", unlocked: contentCompletionCount >= 10 },
    ];
}

function getTrophies(params: { points: number; streak: number; submissionCount: number; thanksCount: number; rank2: string; contentCompletionCount: number; }): Trophy[] {
    const { points, streak, submissionCount, thanksCount, rank2, contentCompletionCount } = params;
    return [
        { id: "legend_intern", icon: "👑", name: "伝説のインターン", description: "5000pt達成", rarity: "legendary" as const, unlocked: points >= 5000 },
        { id: "streak_master", icon: "🔥", name: "連続投稿マスター", description: "30日連続提出", rarity: "epic" as const, unlocked: streak >= 30 },
        { id: "ss_ranker", icon: "💎", name: "SSランカー", description: "ランクSS到達", rarity: "epic" as const, unlocked: rank2 === "SS" },
        { id: "output_king", icon: "📋", name: "アウトプット王", description: "日報50件提出", rarity: "rare" as const, unlocked: submissionCount >= 50 },
        { id: "thanks_hero", icon: "🎉", name: "感謝の人", description: "サンキュー10件受領", rarity: "rare" as const, unlocked: thanksCount >= 10 },
        { id: "s_ranker", icon: "⭐", name: "Sランカー", description: "ランクS到達", rarity: "rare" as const, unlocked: rank2 === "S" || rank2 === "SS" },
        { id: "learn_master", icon: "📚", name: "学びの達人", description: "学習コンテンツ20本完了", rarity: "rare" as const, unlocked: contentCompletionCount >= 20 },
        { id: "week_streak", icon: "⚡", name: "週間連続賞", description: "7日連続提出", rarity: "common" as const, unlocked: streak >= 7 },
        { id: "first_100", icon: "🌱", name: "100pt突破", description: "100pt達成", rarity: "common" as const, unlocked: points >= 100 },
        { id: "submitter10", icon: "📝", name: "コツコツ提出者", description: "日報10件提出", rarity: "common" as const, unlocked: submissionCount >= 10 },
    ];
}

function getRarityStyle(rarity: Trophy["rarity"]) {
    if (rarity === "legendary") return { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.5)", color: "#f59e0b", label: "LEGENDARY" };
    if (rarity === "epic") return { bg: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.5)", color: "#8b5cf6", label: "EPIC" };
    if (rarity === "rare") return { bg: "rgba(6,182,212,0.15)", border: "rgba(6,182,212,0.5)", color: "#06b6d4", label: "RARE" };
    return { bg: "rgba(107,114,128,0.15)", border: "rgba(107,114,128,0.4)", color: "#9ca3af", label: "COMMON" };
}

// ========== パーティクルエフェクト Hook ==========
function useParticleEffect() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const animFrameRef = useRef<number>(0);
    const particleIdRef = useRef(0);

    const COLORS = ["#6366f1", "#8b5cf6", "#f59e0b", "#34d399", "#ec4899", "#06b6d4", "#f97316", "#fbbf24", "#a855f7"];

    const spawnParticles = useCallback((x: number, y: number, count = 40) => {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
            const speed = 4 + Math.random() * 8;
            particlesRef.current.push({
                id: particleIdRef.current++,
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - Math.random() * 4,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                size: 4 + Math.random() * 8,
                life: 1,
                maxLife: 0.6 + Math.random() * 0.8,
                shape: (["circle", "star", "rect"] as const)[Math.floor(Math.random() * 3)],
            });
        }
    }, []);

    const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const outer = (i * Math.PI * 2) / 5 - Math.PI / 2;
            const inner = outer + Math.PI / 5;
            if (i === 0) ctx.moveTo(x + Math.cos(outer) * size, y + Math.sin(outer) * size);
            else ctx.lineTo(x + Math.cos(outer) * size, y + Math.sin(outer) * size);
            ctx.lineTo(x + Math.cos(inner) * size * 0.4, y + Math.sin(inner) * size * 0.4);
        }
        ctx.closePath();
        ctx.fill();
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener("resize", resize);

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particlesRef.current = particlesRef.current.filter(p => p.life > 0);
            particlesRef.current.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.25; // 重力
                p.vx *= 0.98;
                p.life -= 0.018;
                const alpha = Math.max(0, p.life / 1);
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 8;
                if (p.shape === "circle") {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                } else if (p.shape === "star") {
                    drawStar(ctx, p.x, p.y, p.size / 2);
                } else {
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.life * 10);
                    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
                    ctx.restore();
                }
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
            });
            animFrameRef.current = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            window.removeEventListener("resize", resize);
            cancelAnimationFrame(animFrameRef.current);
        };
    }, []);

    return { canvasRef, spawnParticles };
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
    const [contentCompletionCount, setContentCompletionCount] = useState(0);
    const [esCompleted, setEsCompleted] = useState(false);
    const [thanksCount, setThanksCount] = useState(0);
    const [kpiCount, setKpiCount] = useState(0);
    const [activeDays, setActiveDays] = useState(0);
    const [startedAt, setStartedAt] = useState("");
    const [todayKpiDone, setTodayKpiDone] = useState(false);
    const [todayThanksDone, setTodayThanksDone] = useState(false);
    const [todayLearnDone, setTodayLearnDone] = useState(false);
    const [mbti, setMbti] = useState("");
    const [club, setClub] = useState("");
    const [growthRank, setGrowthRank] = useState("");
    const [growthGrade, setGrowthGrade] = useState("");
    const [themeColor, setThemeColor] = useState("#6366f1");
    const [bgColor, setBgColor] = useState("#0a0a0f");
    const [fontFamily, setFontFamily] = useState("'Inter', sans-serif");

    // タグ state
    const [userTags, setUserTags] = useState<UserTag[]>([]);
    const [newTag, setNewTag] = useState("");
    const [tagSaving, setTagSaving] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // エフェクト用 state
    const [floatingPoints, setFloatingPoints] = useState<FloatingPoint[]>([]);
    const floatingIdRef = useRef(0);
    const pointsCardRef = useRef<HTMLDivElement>(null);
    const { canvasRef, spawnParticles } = useParticleEffect();

    const isLightBg = useMemo(() =>
        ["#fce4ec", "#f3e5f5", "#e8f5e9", "#e3f2fd", "#fff9e6"].includes(bgColor),
        [bgColor]);

    const cardBg = isLightBg ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.03)";
    const cardBorder = isLightBg ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.08)";
    const inputBg = isLightBg ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.05)";
    const textPrimary = isLightBg ? "#1a1a2e" : "#f9fafb";
    const textSecondary = isLightBg ? "#4b5563" : "#9ca3af";
    const textMuted = isLightBg ? "#6b7280" : "#6b7280";
    const barBg = isLightBg ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.06)";

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
    const badges = getBadges(points, streak, contentCompletionCount, esCompleted);
    const trophies = getTrophies({ points, streak, submissionCount, thanksCount, rank2, contentCompletionCount });
    const unlockedTrophies = trophies.filter(t => t.unlocked);
    const topTrophy = [...unlockedTrophies].sort((a, b) => {
        const order = { legendary: 4, epic: 3, rare: 2, common: 1 };
        return order[b.rarity] - order[a.rarity];
    })[0];

    // ポイント獲得エフェクト発火
    const triggerPointEffect = useCallback((amount: number, prevPoints: number) => {
        if (amount <= 0) return;

        // フローティング +Xpt テキスト
        const card = pointsCardRef.current;
        const x = card ? card.getBoundingClientRect().left + card.offsetWidth / 2 : window.innerWidth / 2;
        const y = card ? card.getBoundingClientRect().top + card.offsetHeight / 2 : window.innerHeight / 2;

        const newFloat: FloatingPoint = { id: floatingIdRef.current++, x, y, value: amount };
        setFloatingPoints(prev => [...prev, newFloat]);
        setTimeout(() => {
            setFloatingPoints(prev => prev.filter(f => f.id !== newFloat.id));
        }, 1500);

        // パーティクル
        spawnParticles(x, y, amount >= 10 ? 60 : 30);
    }, [spawnParticles]);

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
            setMbti((profileData as any)?.mbti || "");
            setClub((profileData as any)?.club || "");
            if (profile.started_at) {
                const start = new Date(profile.started_at);
                const now = new Date();
                const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                setActiveDays(days);
                setStartedAt(profile.started_at.slice(0, 10));
            }
        }

        const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", user.id).single();
        const newPoints = pointRow?.points || 0;
        setPoints(newPoints);

        // ページを開いたら必ずエフェクト発火（0pt以上なら）
        if (newPoints > 0) {
            setTimeout(() => triggerPointEffect(newPoints, 0), 800);
        }

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

        const newLevel = Math.max(1, Math.floor(newPoints / 100) + 1);
        if (prevLevel > 0 && newLevel > prevLevel) {
            setLevelUpShow(true);
            setTimeout(() => setLevelUpShow(false), 4000);
        }
        setPrevLevel(newLevel);

        const { count: subCount } = await supabase.from("submissions").select("*", { count: "exact", head: true }).eq("user_id", user.id);
        setSubmissionCount(subCount || 0);

        const { count: tCount } = await supabase.from("thanks").select("*", { count: "exact", head: true }).eq("to_user_id", user.id);
        setThanksCount(tCount || 0);

        const { count: cCount } = await supabase.from("content_completions").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved");
        setContentCompletionCount(cCount || 0);

        const { data: esRow } = await supabase.from("user_es").select("*").eq("user_id", user.id).maybeSingle();
        if (esRow) {
            const fields = ["gakuchika_1","gakuchika_2","gakuchika_3","gakuchika_4","axis_1","axis_2","axis_3","axis_4","future_1","future_2","future_3","future_4","pr_1","pr_2","pr_3","pr_4","fail_1","fail_2","fail_3","fail_4"];
            const allFilled = fields.every(f => ((esRow as any)[f] || "").trim().length > 0);
            setEsCompleted(allFilled);
        }

        const { count: kCount } = await supabase.from("kpi_logs").select("*", { count: "exact", head: true }).eq("user_id", user.id);
        setKpiCount(kCount || 0);

        const { data: announceRows } = await supabase.from("announcements").select("*").eq("is_active", true).order("created_at", { ascending: false });
        setAnnouncements((announceRows || []) as { id: string; title: string; content: string }[]);

        const { data: todayKpiRows } = await supabase.from("kpi_logs").select("created_at").eq("user_id", user.id);
        setTodayKpiDone(todayKpiRows?.some(r => isSameJSTDay(r.created_at, todayYmd)) || false);

        const { data: todayThanksRows } = await supabase.from("thanks").select("created_at").eq("from_user_id", user.id);
        setTodayThanksDone(todayThanksRows?.some(r => isSameJSTDay(r.created_at, todayYmd)) || false);

        const { data: todayLearnRows } = await supabase.from("content_completions").select("created_at").eq("user_id", user.id);
        setTodayLearnDone(todayLearnRows?.some(r => isSameJSTDay(r.created_at, todayYmd)) || false);

        const { data: deptRows } = await supabase.from("departments").select("id, name, code").order("created_at");
        setDepartments((deptRows || []) as { id: string; name: string; code: string }[]);

        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const { data: kpiRows } = await supabase.from("monthly_kpi").select("*").eq("user_id", user.id).eq("year_month", ym);
        const { data: kpiDeptRows } = await supabase.from("departments").select("*");
        const { data: targetRows } = await supabase.from("monthly_targets").select("*").eq("year_month", ym).eq("user_id", user.id);

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

        // タグ取得
        const { data: tagRows } = await supabase.from("user_tags").select("*").eq("user_id", user.id).order("created_at");
        setUserTags((tagRows || []) as UserTag[]);

        setLoading(false);
    };

    useEffect(() => { loadPage(); }, []);

    const handleSaveProfile = async () => {
        if (!userId) return;
        setSavingProfile(true);
        await supabase.from("profiles").update({
            name: inputName.trim(),
            education: education.trim(),
            department_id: departmentId || null,
            started_at: startedAt || null,
        }).eq("id", userId);
        // activeDaysを再計算
        if (startedAt) {
            const start = new Date(startedAt);
            setActiveDays(Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
        }
        setName(inputName.trim());
        setSavingProfile(false);
        setSaveSuccess(true);
        setMessage("✅ プロフィールを保存しました");
        setTimeout(() => setSaveSuccess(false), 2000);
    };

    const handleAddTag = async () => {
        if (!newTag.trim() || !userId) return;
        setTagSaving(true);
        const { data } = await supabase.from("user_tags").insert({ user_id: userId, tag: newTag.trim(), created_by: userId }).select().single();
        if (data) setUserTags(prev => [...prev, data as UserTag]);
        setNewTag("");
        setTagSaving(false);
    };

    const handleDeleteTag = async (tagId: string) => {
        await supabase.from("user_tags").delete().eq("id", tagId);
        setUserTags(prev => prev.filter(t => t.id !== tagId));
    };

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    return (
        <main style={{ minHeight: "100vh", background: bgColor || "#0a0a0f", padding: "40px 24px 64px", fontFamily: fontFamily, color: textPrimary }}>

            {/* ===== パーティクルキャンバス ===== */}
            <canvas
                ref={canvasRef}
                style={{
                    position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                    pointerEvents: "none", zIndex: 9999,
                }}
            />

            {/* ===== フローティング +Xpt テキスト ===== */}
            <AnimatePresence>
                {floatingPoints.map(fp => (
                    <motion.div
                        key={fp.id}
                        initial={{ opacity: 1, y: 0, scale: 0.5, x: fp.x - 40 }}
                        animate={{ opacity: 0, y: -120, scale: 1.4 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.4, ease: "easeOut" }}
                        style={{
                            position: "fixed",
                            top: fp.y - 30,
                            left: 0,
                            zIndex: 9998,
                            pointerEvents: "none",
                            fontSize: 28,
                            fontWeight: 900,
                            color: "#fbbf24",
                            textShadow: "0 0 20px rgba(251,191,36,0.8), 0 0 40px rgba(251,191,36,0.4)",
                            letterSpacing: 1,
                        }}
                    >
                        +{fp.value}pt ✨
                    </motion.div>
                ))}
            </AnimatePresence>

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

            {/* ===== レベルアップ演出（派手バージョン） ===== */}
            <AnimatePresence>
                {levelUpShow && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{
                            position: "fixed", inset: 0, zIndex: 9990,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            pointerEvents: "none",
                            background: "radial-gradient(ellipse at center, rgba(99,102,241,0.3) 0%, transparent 70%)",
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0, rotate: -20 }}
                            animate={{ scale: [0, 1.3, 1.1, 1.2], rotate: [0, 5, -3, 0] }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: "spring", bounce: 0.6, duration: 0.8 }}
                            style={{
                                background: "linear-gradient(135deg, #1a1a3e, #0f0f2a)",
                                border: "2px solid rgba(99,102,241,0.8)",
                                borderRadius: 32,
                                padding: "48px 80px",
                                textAlign: "center",
                                boxShadow: "0 0 120px rgba(99,102,241,0.7), 0 0 60px rgba(139,92,246,0.5), inset 0 0 40px rgba(99,102,241,0.1)",
                            }}
                        >
                            <motion.div
                                animate={{ rotate: [0, 15, -15, 10, -10, 0] }}
                                transition={{ duration: 0.6, delay: 0.3 }}
                                style={{ fontSize: 64, marginBottom: 8 }}
                            >
                                🎉
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                style={{ fontSize: 13, color: "#818cf8", fontWeight: 800, letterSpacing: 5, marginBottom: 8 }}
                            >
                                LEVEL UP!
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3, type: "spring", bounce: 0.5 }}
                                style={{
                                    fontSize: 80, fontWeight: 900, color: "#fff",
                                    lineHeight: 1,
                                    textShadow: "0 0 40px rgba(139,92,246,0.8), 0 0 20px rgba(99,102,241,0.6)",
                                }}
                            >
                                Lv.{level}
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                style={{ fontSize: 16, color: "#c7d2fe", marginTop: 12, fontWeight: 600 }}
                            >
                                おめでとうございます！🚀
                            </motion.div>

                            {/* 周囲を回るリング */}
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                style={{
                                    position: "absolute", inset: -20,
                                    borderRadius: 48,
                                    border: "2px dashed rgba(99,102,241,0.4)",
                                    pointerEvents: "none",
                                }}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: `radial-gradient(ellipse at 20% 50%, ${themeColor}08 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, ${themeColor}05 0%, transparent 60%)`, pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto" }}>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        {avatarUrl ? (
                            <img src={avatarUrl} alt={name} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", display: "block", border: "3px solid rgba(99,102,241,0.6)" }} />
                        ) : (
                            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                                {name ? name.charAt(0) : "?"}
                            </div>
                        )}
                        <div>
                            <div onClick={() => router.push("/mypage")} style={{ fontSize: 11, color: themeColor, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 4, cursor: "pointer" }}>INTERN QUEST</div>
                            <h1 style={{ fontSize: 26, fontWeight: 800, color: textPrimary, margin: 0, lineHeight: 1 }}>{name || "名前未設定"}</h1>
                            {topTrophy && (
                                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ fontSize: 15 }}>{topTrophy.icon}</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: getRarityStyle(topTrophy.rarity).color }}>{topTrophy.name}</span>
                                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: getRarityStyle(topTrophy.rarity).bg, border: `1px solid ${getRarityStyle(topTrophy.rarity).border}`, color: getRarityStyle(topTrophy.rarity).color, fontWeight: 700 }}>{getRarityStyle(topTrophy.rarity).label}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button onClick={() => router.push("/report")} style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}aa)`, color: "#fff", padding: "8px 12px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>📋 日報</button>
                        <button onClick={() => router.push("/menu")} style={{ background: cardBg, color: textPrimary, padding: "8px 10px", borderRadius: 8, border: `1px solid ${cardBorder}`, fontWeight: 600, cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" }}>☰</button>
                    </div>
                </div>

                {announcements.filter(a => !closedAnnouncements.includes(a.id)).map((a) => (
                    <div key={a.id} style={{ marginBottom: 12, padding: "14px 20px", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", marginBottom: 4 }}>📢 {a.title}</div>
                            <div style={{ fontSize: 13, color: isLightBg ? "#4b5563" : "#c7d2fe", lineHeight: 1.6 }}>{a.content}</div>
                        </div>
                        <button onClick={() => setClosedAnnouncements(prev => [...prev, a.id])} style={{ marginLeft: 16, background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18 }}>×</button>
                    </div>
                ))}

                {message && <div style={{ marginBottom: 20, padding: "12px 20px", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, color: "#a5b4fc", fontSize: 14 }}>{message}</div>}

                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                        {[
                            {
                                title: "TOTAL POINTS", tip: "獲得したポイントの累計です", ref: pointsCardRef, content: (
                                    <div>
                                        <div style={{ fontSize: 36, fontWeight: 800, color: textPrimary, lineHeight: 1 }}>{points.toLocaleString()}</div>
                                        <div style={{ fontSize: 16, color: themeColor, fontWeight: 600, marginTop: 4 }}>pt</div>
                                        <div style={{ marginTop: 12, padding: "6px 12px", background: "rgba(99,102,241,0.1)", borderRadius: 6, display: "inline-block" }}>
                                            <span style={{ fontSize: 12, color: "#818cf8" }}>🏆 順位 {rank || "-"}位</span>
                                        </div>
                                    </div>
                                )
                            },
                            {
                                title: "LEVEL", tip: "ポイントが100pt貯まるごとにレベルアップします", ref: undefined, content: (
                                    <div>
                                        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                                            <div style={{ fontSize: 48, fontWeight: 800, color: textPrimary, lineHeight: 1 }}>Lv.{level}</div>
                                            <div style={{ padding: "4px 10px", borderRadius: 6, background: badgeColor, fontSize: 12, fontWeight: 700, color: "#fff" }}>{badgeLabel}</div>
                                        </div>
                                        <div style={{ marginTop: 16 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: textMuted, marginBottom: 6 }}>
                                                <span>EXP {exp}/100</span><span>次まで {100 - exp}</span>
                                            </div>
                                            <div style={{ height: 6, borderRadius: 999, background: barBg }}>
                                                <div style={{ height: "100%", width: `${exp}%`, background: `linear-gradient(90deg, ${themeColor}, ${themeColor}aa)`, borderRadius: 999 }} />
                                            </div>
                                        </div>
                                    </div>
                                )
                            },
                            {
                                title: "STREAK", tip: "日報を連続提出した日数です", ref: undefined, content: (
                                    <div>
                                        <div style={{ fontSize: 36, fontWeight: 800, color: textPrimary, lineHeight: 1 }}>{streak}</div>
                                        <div style={{ fontSize: 16, color: "#f59e0b", fontWeight: 600, marginTop: 4 }}>日連続</div>
                                        <div style={{ marginTop: 8, fontSize: 11, color: textSecondary, lineHeight: 1.4 }}>{actionMessage}</div>
                                    </div>
                                )
                            },
                        ].map((card) => (
                            <div key={card.title} ref={card.ref} style={{ position: "relative" }}
                                onMouseEnter={() => { const t = document.getElementById(`tip-card-${card.title}`); if (t) t.style.display = "block"; }}
                                onMouseLeave={() => { const t = document.getElementById(`tip-card-${card.title}`); if (t) t.style.display = "none"; }}
                            >
                                <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: "16px 12px", height: "100%", boxSizing: "border-box" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                        <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2 }}>{card.title}</div>
                                        <div style={{ fontSize: 12, color: textMuted, cursor: "help" }}>💡</div>
                                    </div>
                                    {card.content}
                                </div>
                                <div id={`tip-card-${card.title}`} style={{ display: "none", position: "absolute", top: -44, left: 0, background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#c7d2fe", whiteSpace: "nowrap", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
                                    {card.tip}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[
                            {
                                title: "GROWTH STATUS", tip: "管理者が設定する社内育成フェーズです", content: (
                                    <div>
                                        {growthRank ? (
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                                    <div style={{ width: 72, height: 72, borderRadius: 16, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: "#fff" }}>{growthRank}</div>
                                                    <div style={{ fontSize: 28, fontWeight: 800, color: textPrimary }}>{growthGrade}</div>
                                                </div>
                                                <div style={{ fontSize: 12, color: textMuted, marginTop: 16 }}>社内育成フェーズ</div>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 14, color: textMuted }}>未設定（管理者が設定します）</div>
                                        )}
                                    </div>
                                )
                            },
                            {
                                title: "EFFORT RANK", tip: "日々の活動量・質を7軸で総合評価したランクです", content: (
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                            <div style={{ width: 72, height: 72, borderRadius: 16, background: rankColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: "#fff" }}>{rank2}</div>
                                            <div>
                                                <div style={{ fontSize: 13, color: textMuted, marginBottom: 4 }}>スコア</div>
                                                <div style={{ fontSize: 28, fontWeight: 800, color: textPrimary }}>{rankScore}</div>
                                                <div style={{ fontSize: 11, color: textMuted }}>/100</div>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: 16 }}>
                                            <div style={{ height: 4, borderRadius: 999, background: barBg }}>
                                                <div style={{ height: "100%", width: `${rankScore}%`, background: rankColor, borderRadius: 999 }} />
                                            </div>
                                            <div style={{ fontSize: 12, color: textMuted, marginTop: 8 }}>{nextRankInfo}</div>
                                        </div>
                                    </div>
                                )
                            },
                        ].map((card) => (
                            <div key={card.title} style={{ position: "relative" }}
                                onMouseEnter={() => { const t = document.getElementById(`tip-card-${card.title}`); if (t) t.style.display = "block"; }}
                                onMouseLeave={() => { const t = document.getElementById(`tip-card-${card.title}`); if (t) t.style.display = "none"; }}
                            >
                                <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: "16px 12px", height: "100%", boxSizing: "border-box" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                        <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2 }}>{card.title}</div>
                                        <div style={{ fontSize: 12, color: textMuted, cursor: "help" }}>💡</div>
                                    </div>
                                    {card.content}
                                </div>
                                <div id={`tip-card-${card.title}`} style={{ display: "none", position: "absolute", top: -44, left: 0, background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#c7d2fe", whiteSpace: "nowrap", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
                                    {card.tip}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>


                {/* ===== タグ ===== */}
                <div style={{ marginBottom: 16, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24 }}>
                    <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>🏷️ MY TAGS</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                        {mbti && <div style={{ padding: "6px 14px", borderRadius: 20, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", fontSize: 13, color: "#818cf8", fontWeight: 700 }}>🧠 {mbti}</div>}
                        {club && <div style={{ padding: "6px 14px", borderRadius: 20, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", fontSize: 13, color: "#f59e0b", fontWeight: 700 }}>⚽ {club}</div>}
                        {userTags.map(tag => (
                            <div key={tag.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", fontSize: 13, color: "#34d399", fontWeight: 700 }}>
                                {tag.tag}
                                <button onClick={() => handleDeleteTag(tag.id)} style={{ background: "none", border: "none", color: "#34d399", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1, opacity: 0.7 }}>×</button>
                            </div>
                        ))}
                        {userTags.length === 0 && !mbti && !club && <div style={{ fontSize: 13, color: textMuted }}>タグがありません。追加してみましょう！</div>}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddTag()} placeholder="例：🏢 新宿オフィス、💼 営業担当" style={{ flex: 1, padding: "8px 14px", borderRadius: 10, border: `1px solid ${cardBorder}`, background: inputBg, color: textPrimary, fontSize: 13, outline: "none" }} />
                        <button onClick={handleAddTag} disabled={tagSaving || !newTag.trim()} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: newTag.trim() ? `linear-gradient(135deg, ${themeColor}, ${themeColor}aa)` : "rgba(255,255,255,0.1)", color: "#fff", fontWeight: 700, cursor: newTag.trim() ? "pointer" : "not-allowed", fontSize: 13 }}>追加</button>
                    </div>
                </div>

                {/* ===== トロフィー ===== */}
                <div style={{ marginBottom: 16, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2 }}>🏆 TROPHIES & 称号</div>
                        <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 600 }}>{unlockedTrophies.length} / {trophies.length} 獲得</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                        {[...trophies].sort((a, b) => { const order = { legendary: 4, epic: 3, rare: 2, common: 1 }; return order[b.rarity] - order[a.rarity]; }).map(trophy => {
                            const s = getRarityStyle(trophy.rarity);
                            return (
                                <div key={trophy.id} style={{ padding: "14px 16px", borderRadius: 12, background: trophy.unlocked ? s.bg : "rgba(255,255,255,0.02)", border: `1px solid ${trophy.unlocked ? s.border : "rgba(255,255,255,0.06)"}`, opacity: trophy.unlocked ? 1 : 0.4 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <span style={{ fontSize: 28, filter: trophy.unlocked ? "none" : "grayscale(1)" }}>{trophy.icon}</span>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: trophy.unlocked ? textPrimary : textMuted }}>{trophy.name}</div>
                                            <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>{trophy.description}</div>
                                            <div style={{ marginTop: 4, fontSize: 10, padding: "1px 6px", borderRadius: 4, display: "inline-block", background: trophy.unlocked ? s.bg : "rgba(255,255,255,0.05)", border: `1px solid ${trophy.unlocked ? s.border : "rgba(255,255,255,0.1)"}`, color: trophy.unlocked ? s.color : textMuted, fontWeight: 700 }}>{s.label}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ===== バッジ ===== */}
                <div style={{ marginBottom: 16, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2 }}>🎖️ BADGES</div>
                        <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 600 }}>{badges.filter(b => b.unlocked).length} / {badges.length} 解除済み</div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        {badges.map(badge => (
                            <div key={badge.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, background: badge.unlocked ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)", border: `1px solid ${badge.unlocked ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}`, opacity: badge.unlocked ? 1 : 0.4 }}>
                                <span style={{ fontSize: 22, filter: badge.unlocked ? "none" : "grayscale(1)" }}>{badge.icon}</span>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: badge.unlocked ? textPrimary : textMuted }}>{badge.name}</div>
                                    <div style={{ fontSize: 11, color: textMuted }}>{badge.description}</div>
                                </div>
                                {badge.unlocked && <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700, marginLeft: 4 }}>✅</span>}
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ marginBottom: 16, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24 }}>
                    <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>7-AXIS EVALUATION</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "center" }}>
                        <ResponsiveContainer width="100%" height={280}>
                            <RadarChart data={[
                                { axis: "学歴", value: education ? 8 : 0 },
                                { axis: "活動期間", value: Math.min(activeDays * 0.5, 15) },
                                { axis: "実績KPI", value: Math.min(kpiCount * 3, 15) },
                                { axis: "再現性", value: Math.min(streak * 2, 20) },
                                { axis: "リーダーシップ", value: Math.min(thanksCount * 2, 10) },
                                { axis: "アウトプット", value: Math.min(submissionCount * 2, 20) },
                                { axis: "メタ認知", value: Math.min(level, 10) },
                            ]}>
                                <PolarGrid stroke={barBg} />
                                <PolarAngleAxis dataKey="axis" tick={{ fill: textMuted, fontSize: 11, fontWeight: 600 }} />
                                <Radar name="スコア" dataKey="value" stroke={themeColor} fill={themeColor} fillOpacity={0.3} strokeWidth={2} />
                            </RadarChart>
                        </ResponsiveContainer>
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
                                    onMouseEnter={() => { const tip = document.getElementById(`tip-${axis.label}`); if (tip) tip.style.display = "block"; }}
                                    onMouseLeave={() => { const tip = document.getElementById(`tip-${axis.label}`); if (tip) tip.style.display = "none"; }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: textMuted, marginBottom: 4 }}>
                                        <span style={{ cursor: "help", borderBottom: `1px dashed ${cardBorder}` }}>{axis.label} 💡</span>
                                        <span style={{ color: axis.color, fontWeight: 700 }}>{Math.round(axis.value)} / {axis.max}</span>
                                    </div>
                                    <div style={{ height: 6, borderRadius: 999, background: barBg }}>
                                        <div style={{ height: "100%", width: `${(axis.value / axis.max) * 100}%`, background: axis.color, borderRadius: 999 }} />
                                    </div>
                                    <div id={`tip-${axis.label}`} style={{ display: "none", position: "absolute", top: -36, left: 0, background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#c7d2fe", whiteSpace: "nowrap", zIndex: 10 }}>
                                        {axis.tip}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {myKpis.length > 0 && (
                    <div style={{ marginBottom: 16, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2 }}>MONTHLY KPI</div>
                            <div style={{ fontSize: 12, color: textMuted }}>{new Date().getFullYear()}/{new Date().getMonth() + 1}月</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {myKpis.map((kpi, i) => {
                                const rateColor = kpi.rate >= 100 ? "#34d399" : kpi.rate >= 80 ? "#f59e0b" : kpi.rate >= 60 ? "#f97316" : "#f87171";
                                return (
                                    <div key={i} style={{ padding: "16px 20px", borderRadius: 12, background: isLightBg ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.02)", border: `1px solid ${kpi.approved ? "rgba(52,211,153,0.3)" : cardBorder}` }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ padding: "2px 10px", borderRadius: 6, background: "rgba(99,102,241,0.2)", color: "#818cf8", fontSize: 12, fontWeight: 700 }}>{kpi.deptName}</span>
                                                {kpi.approved && <span style={{ fontSize: 12, color: "#34d399", fontWeight: 600 }}>✅ 承認済</span>}
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                                <span style={{ fontSize: 13, color: textMuted }}>{kpi.result} / {kpi.target}件</span>
                                                <span style={{ fontSize: 20, fontWeight: 800, color: rateColor }}>{kpi.rate}%</span>
                                                <span style={{ fontSize: 16, fontWeight: 700, color: kpi.pts > 0 ? "#818cf8" : textMuted }}>{kpi.approved ? `+${kpi.pts}pt` : `予定${kpi.pts}pt`}</span>
                                            </div>
                                        </div>
                                        <div style={{ height: 8, borderRadius: 999, background: barBg }}>
                                            <div style={{ height: "100%", width: `${Math.min(kpi.rate, 100)}%`, background: rateColor, borderRadius: 999 }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <button onClick={() => router.push("/kpi")} style={{ marginTop: 16, width: "100%", padding: "12px", borderRadius: 10, border: `1px solid ${cardBorder}`, background: cardBg, color: textSecondary, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>📊 KPIを入力・更新する</button>
                    </div>
                )}

                <div style={{ marginBottom: 16, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2 }}>DAILY MISSIONS</div>
                        <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 600 }}>{[true, isSubmitted, todayKpiDone, todayThanksDone, todayLearnDone].filter(Boolean).length} / 5 完了</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                            { icon: "🔐", label: "ログインする", done: true, pt: "+1pt", path: null },
                            { icon: "📋", label: "日報を提出する", done: isSubmitted, pt: "+2pt", path: "/report" },
                            { icon: "📊", label: "KPIを入力する", done: todayKpiDone, pt: "✨", path: "/report" },
                            { icon: "🎉", label: "サンキューを送る", done: todayThanksDone, pt: "✨", path: "/thanks" },
                            { icon: "📚", label: "学習を完了する", done: todayLearnDone, pt: "+2pt", path: "/learn" },
                        ].map((mission) => (
                            <div key={mission.label} onClick={() => mission.path && !mission.done && router.push(mission.path)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 12, background: mission.done ? "rgba(52,211,153,0.08)" : isLightBg ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.02)", border: `1px solid ${mission.done ? "rgba(52,211,153,0.3)" : cardBorder}`, cursor: mission.path && !mission.done ? "pointer" : "default" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <span style={{ fontSize: 20 }}>{mission.done ? "✅" : mission.icon}</span>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: mission.done ? "#34d399" : textPrimary, textDecoration: mission.done ? "line-through" : "none" }}>{mission.label}</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: mission.done ? "#34d399" : textMuted }}>{mission.pt}</span>
                                    {!mission.done && mission.path && <span style={{ fontSize: 12, color: themeColor, fontWeight: 700 }}>→</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ marginBottom: 16, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 16, padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🤖</div>
                            <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2 }}>AI METACOGNITION</div>
                        </div>
                        <div style={{ fontSize: 12, color: textMuted }}>{new Date().toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}</div>
                    </div>
                    <p style={{ margin: "0 0 16px", fontSize: 15, color: isLightBg ? "#4b5563" : "#c7d2fe", lineHeight: 1.8, fontWeight: 500 }}>{aiComment}</p>
                    <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", fontSize: 13, color: "#818cf8", fontWeight: 600 }}>
                        💡 {["小さな積み重ねが大きな差を生む。今日も一歩前へ。", "成長は毎日の習慣から生まれる。継続こそ最強のスキル。", "今日の努力は必ず明日の自分に返ってくる。", "トップ営業マンも最初は初心者だった。諦めずに続けよう。", "失敗は成功のデータ。今日も全力でぶつかろう。", "1日1%の成長で1年後には37倍になる。今日も成長しよう。", "行動した人だけが結果を手にできる。まず動こう。"][new Date().getDay()]}
                    </div>
                </div>

                <div style={{ marginBottom: 16, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24 }}>
                    <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>POINT GROWTH</div>
                    {graphData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={graphData}>
                                <XAxis dataKey="date" stroke={isLightBg ? "#9ca3af" : "#4b5563"} tick={{ fill: textMuted, fontSize: 11 }} />
                                <YAxis stroke={isLightBg ? "#9ca3af" : "#4b5563"} tick={{ fill: textMuted, fontSize: 11 }} />
                                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#f9fafb" }} formatter={(value: unknown) => [`${value}pt`, "累計ポイント"]} />
                                <Line type="monotone" dataKey="points" stroke={themeColor} strokeWidth={2} dot={{ fill: themeColor, r: 4 }} activeDot={{ r: 6, fill: themeColor }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ color: textMuted, fontSize: 14, textAlign: "center", padding: 40 }}>データが蓄積されるとグラフが表示されます</div>
                    )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 20 }}>
                            <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>PROFILE</div>
                            {(mbti || club) && (
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                                    {mbti && <div style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", fontSize: 12, color: "#818cf8", fontWeight: 700 }}>🧠 {mbti}</div>}
                                    {club && <div style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", fontSize: 12, color: "#f59e0b", fontWeight: 700 }}>⚽ {club}</div>}
                                </div>
                            )}
                            <input value={inputName} onChange={(e) => setInputName(e.target.value)} placeholder="名前を入力" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${cardBorder}`, background: inputBg, color: textPrimary, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
                            <input value={education} onChange={(e) => setEducation(e.target.value)} placeholder="学歴を入力（例：〇〇大学）" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${cardBorder}`, background: inputBg, color: textPrimary, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
                            <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 11, color: textMuted, marginBottom: 4 }}>📅 入社日</div>
                                <input type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${cardBorder}`, background: inputBg, color: textPrimary, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${cardBorder}`, background: isLightBg ? "rgba(240,240,240,0.8)" : "#1a1a2e", color: textPrimary, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }}>
                                <option value="">事業部を選択</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            <button onClick={handleSaveProfile} disabled={savingProfile} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: saveSuccess ? "linear-gradient(135deg, #10b981, #34d399)" : `linear-gradient(135deg, ${themeColor}, ${themeColor}aa)`, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14, transition: "all 0.3s" }}>{savingProfile ? "保存中..." : saveSuccess ? "✅ 保存しました！" : "保存"}</button>
                        </div>
                        <button onClick={() => router.push("/history")} style={{ padding: "14px", borderRadius: 12, border: `1px solid ${cardBorder}`, background: cardBg, color: textSecondary, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>履歴を見る →</button>
                    </div>

                    <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24 }}>
                        <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>RECENT ACTIVITY</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {history.slice(0, 8).map((item, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: isLightBg ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.02)", border: `1px solid ${cardBorder}` }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{formatReason(item.reason)}</div>
                                        <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>{formatDateTimeJST(item.created_at)}</div>
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: item.change >= 0 ? "#34d399" : "#f87171" }}>
                                        {item.change > 0 ? `+${item.change}` : item.change}pt
                                    </div>
                                </div>
                            ))}
                            {history.length === 0 && <div style={{ color: textMuted, fontSize: 14 }}>履歴がありません</div>}
                        </div>
                    </div>
                </div>
            </div>

            {/* ✅ ページ下部ホームボタン */}
            <div style={{ marginTop: 32, textAlign: "center" }}>
                <button onClick={() => router.push("/mypage")} style={{ padding: "12px 32px", borderRadius: 12, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.08)", color: "#818cf8", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                    🏠 ホームに戻る
                </button>
            </div>
        </main>
    );
}