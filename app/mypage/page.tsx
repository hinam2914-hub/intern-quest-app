"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

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
};

type GraphData = { date: string; points: number };

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
    return reason;
}

function getLevel(points: number): number { return Math.max(1, Math.floor(points / 100) + 1); }
function getExp(points: number): number { return points % 100; }
function getBadge(level: number): string {
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
function getRankScore(params: { level: number; streak: number; points: number; isSubmitted: boolean }): number {
    const { level, streak, points, isSubmitted } = params;
    let score = 0;
    score += Math.min(level * 2.5, 40);
    score += Math.min(points / 50, 30);
    score += Math.min(streak * 2, 20);
    score += isSubmitted ? 10 : 0;
    return Math.min(Math.round(score), 100);
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
    if (level >= 10) return `${name}さん、Lv.${level}まで成長しました。${points}ptという実績はあなたの努力の証。次はランクアップを狙いましょう！`;
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

export default function MyPage() {
    const router = useRouter();
    const [userId, setUserId] = useState("");
    const [name, setName] = useState("");
    const [inputName, setInputName] = useState("");
    const [points, setPoints] = useState(0);
    const [rank, setRank] = useState<number | null>(null);
    const [streak, setStreak] = useState(1);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [history, setHistory] = useState<PointHistory[]>([]);
    const [graphData, setGraphData] = useState<GraphData[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [showNameModal, setShowNameModal] = useState(false);

    const todayYmd = getTodayJST();
    const level = getLevel(points);
    const exp = getExp(points);
    const badge = getBadge(level);
    const badgeColor = getBadgeColor(level);
    const actionMessage = getActionMessage(isSubmitted, streak);
    const rankScore = getRankScore({ level, streak, points, isSubmitted });
    const rank2 = getRank(rankScore);
    const rankColor = getRankColor(rank2);
    const nextRankInfo = getNextRankInfo(rank2);
    const aiComment = generateAIComment({ name, level, rank2, rankScore, streak, isSubmitted, points });

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
            setStreak(profile.streak || 1);
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
        const [showNameModal, setShowNameModal] = useState(false);
        const { data: submissionRows } = await supabase.from("submissions").select("created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
        setIsSubmitted(submissionRows?.some((row) => isSameJSTDay(row.created_at, todayYmd)) || false);
        if (!profileData?.name) setShowNameModal(true); setLoading(false);
    };

    useEffect(() => { loadPage(); }, []);

    const handleSaveName = async () => {
        if (!userId || !inputName.trim()) return;
        await supabase.from("profiles").update({ name: inputName.trim() }).eq("id", userId);
        setName(inputName.trim());
        setMessage("✅ 名前を保存しました");
    };

    const handleAddPoint = async () => {
        if (!userId) return;
        const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", userId).single();
        const current = pointRow?.points || 0;
        await supabase.from("user_points").update({ points: current + 10 }).eq("id", userId);
        await supabase.from("points_history").insert({ user_id: userId, change: 10, reason: "manual_add", created_at: new Date().toISOString() });
        setMessage("⚡ +10ポイント追加しました");
        await loadPage();
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
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            {/* 名前入力モーダル */}
            {showNameModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ background: "#0f0f1a", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 20, padding: 40, width: 400 }}>
                        <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, marginBottom: 8 }}>INTERN QUEST</div>
                        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#f9fafb", margin: "0 0 8px" }}>名前を教えてください</h2>
                        <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 24px" }}>ランキングや管理画面に表示されます</p>
                        <input
                            value={inputName}
                            onChange={(e) => setInputName(e.target.value)}
                            placeholder="例：田中太郎"
                            onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                            style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 16 }}
                        />
                        <button
                            onClick={async () => { await handleSaveName(); setShowNameModal(false); }}
                            style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 16 }}
                        >
                            登録する →
                        </button>
                    </div>
                </div>
            )}
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.06) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto" }}>

                {/* ヘッダー */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                    <div>
                        <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>INTERN QUEST</div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>{name || "名前未設定"}</h1>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => router.push("/ranking")} style={{ background: "rgba(255,255,255,0.05)", color: "#d1d5db", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>ランキング</button>
                        <button onClick={() => router.push("/report")} style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", padding: "8px 16px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>日報提出</button>
                        <button onClick={() => router.push("/admin")} style={{ background: "rgba(255,255,255,0.05)", color: "#d1d5db", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>管理画面</button>
                        <button onClick={handleLogout} style={{ background: "transparent", color: "#6b7280", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>ログアウト</button>
                    </div>
                </div>

                {message && (
                    <div style={{ marginBottom: 20, padding: "12px 20px", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, color: "#a5b4fc", fontSize: 14 }}>
                        {message}
                    </div>
                )}

                {/* メイングリッド */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
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
                            <div style={{ padding: "4px 10px", borderRadius: 6, background: badgeColor, fontSize: 12, fontWeight: 700, color: "#fff" }}>{badge}</div>
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

                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, backdropFilter: "blur(10px)" }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>MARKET RANK</div>
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

                {/* AIメタ認知コメント */}
                <div style={{ marginBottom: 16, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 16, padding: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🤖</div>
                        <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2 }}>AI METACOGNITION</div>
                    </div>
                    <p style={{ margin: 0, fontSize: 15, color: "#c7d2fe", lineHeight: 1.8, fontWeight: 500 }}>{aiComment}</p>
                </div>

                {/* ポイント推移グラフ */}
                <div style={{ marginBottom: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>POINT GROWTH</div>
                    {graphData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={graphData}>
                                <XAxis dataKey="date" stroke="#4b5563" tick={{ fill: "#6b7280", fontSize: 11 }} />
                                <YAxis stroke="#4b5563" tick={{ fill: "#6b7280", fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#f9fafb" }}
                                    formatter={(value: unknown) => [`${value}pt`, "累計ポイント"]}
                                />
                                <Line type="monotone" dataKey="points" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 4 }} activeDot={{ r: 6, fill: "#8b5cf6" }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ color: "#6b7280", fontSize: 14, textAlign: "center", padding: 40 }}>データが蓄積されるとグラフが表示されます</div>
                    )}
                </div>

                {/* 下段 */}
                <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>PROFILE</div>
                            <input value={inputName} onChange={(e) => setInputName(e.target.value)} placeholder="名前を入力" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                            <button onClick={handleSaveName} style={{ marginTop: 10, width: "100%", padding: "10px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>保存</button>
                        </div>
                        <button onClick={handleAddPoint} style={{ padding: "14px", borderRadius: 12, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.1)", color: "#818cf8", fontWeight: 700, cursor: "pointer", fontSize: 15 }}>⚡ +10pt 追加</button>
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