"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

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
    return date.toLocaleString("ja-JP", {
        year: "numeric", month: "numeric", day: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function formatReason(reason?: string | null): string {
    if (!reason) return "ポイント追加";
    if (reason === "manual_add") return "手動追加";
    if (reason === "login_bonus") return "ログインボーナス";
    if (reason === "report_submit") return "日報提出";
    if (reason === "streak_bonus") return "連続提出ボーナス";
    return reason;
}

function getLevel(points: number): number {
    return Math.max(1, Math.floor(points / 100) + 1);
}

function getExp(points: number): number {
    return points % 100;
}

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

function getActionMessage(isSubmitted: boolean, streak: number): string {
    if (!isSubmitted) return "📋 日報を提出してポイントを獲得しましょう";
    if (streak >= 7) return "🔥 連続提出が素晴らしい。この調子で継続しましょう";
    if (streak >= 3) return "⚡ 継続できています。次は上位を狙いましょう";
    return "📚 学習コンテンツを進めましょう";
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
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");

    const todayYmd = getTodayJST();
    const level = getLevel(points);
    const exp = getExp(points);
    const badge = getBadge(level);
    const badgeColor = getBadgeColor(level);
    const actionMessage = getActionMessage(isSubmitted, streak);

    const loadPage = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }
        setUserId(user.id);

        const { data: profileData } = await supabase
            .from("profiles").select("*").eq("id", user.id).single();
        if (profileData) {
            const profile = profileData as ProfileRow;
            setName(profile.name || "");
            setInputName(profile.name || "");
            setStreak(profile.streak || 1);
        }

        const { data: pointRow } = await supabase
            .from("user_points").select("points").eq("id", user.id).single();
        setPoints(pointRow?.points || 0);

        const { data: rankingRows } = await supabase
            .from("user_points").select("id, points").order("points", { ascending: false });
        if (rankingRows) {
            const myRank = rankingRows.findIndex((row) => row.id === user.id);
            setRank(myRank >= 0 ? myRank + 1 : null);
        }

        const { data: historyRows } = await supabase
            .from("points_history").select("*").eq("user_id", user.id)
            .order("created_at", { ascending: false }).limit(20);
        setHistory((historyRows || []) as PointHistory[]);

        const { data: submissionRows } = await supabase
            .from("submissions").select("created_at").eq("user_id", user.id)
            .order("created_at", { ascending: false }).limit(20);
        setIsSubmitted(submissionRows?.some((row) => isSameJSTDay(row.created_at, todayYmd)) || false);
        setLoading(false);
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

            {/* 背景グロー */}
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>

                    {/* ポイントカード */}
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, backdropFilter: "blur(10px)" }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>TOTAL POINTS</div>
                        <div style={{ fontSize: 48, fontWeight: 800, color: "#f9fafb", lineHeight: 1 }}>{points.toLocaleString()}</div>
                        <div style={{ fontSize: 16, color: "#6366f1", fontWeight: 600, marginTop: 4 }}>pt</div>
                        <div style={{ marginTop: 16, padding: "6px 12px", background: "rgba(99,102,241,0.1)", borderRadius: 6, display: "inline-block" }}>
                            <span style={{ fontSize: 12, color: "#818cf8" }}>🏆 順位 {rank || "-"}位</span>
                        </div>
                    </div>

                    {/* レベルカード */}
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, backdropFilter: "blur(10px)" }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>LEVEL</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                            <div style={{ fontSize: 48, fontWeight: 800, color: "#f9fafb", lineHeight: 1 }}>Lv.{level}</div>
                            <div style={{ padding: "4px 10px", borderRadius: 6, background: badgeColor, fontSize: 12, fontWeight: 700, color: "#fff" }}>{badge}</div>
                        </div>
                        <div style={{ marginTop: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
                                <span>EXP {exp}/100</span>
                                <span>次まで {100 - exp}</span>
                            </div>
                            <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)" }}>
                                <div style={{ height: "100%", width: `${exp}%`, background: "linear-gradient(90deg, #6366f1, #8b5cf6)", borderRadius: 999, transition: "width 0.6s ease" }} />
                            </div>
                        </div>
                    </div>

                    {/* 連続提出カード */}
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, backdropFilter: "blur(10px)" }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>STREAK</div>
                        <div style={{ fontSize: 48, fontWeight: 800, color: "#f9fafb", lineHeight: 1 }}>{streak}</div>
                        <div style={{ fontSize: 16, color: "#f59e0b", fontWeight: 600, marginTop: 4 }}>日連続</div>
                        <div style={{ marginTop: 16, fontSize: 13, color: "#9ca3af" }}>{actionMessage}</div>
                    </div>
                </div>

                {/* 下段：名前編集 + ポイント履歴 + アクション */}
                <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>

                    {/* 左：名前編集 + ボタン */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>PROFILE</div>
                            <input
                                value={inputName}
                                onChange={(e) => setInputName(e.target.value)}
                                placeholder="名前を入力"
                                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                            />
                            <button onClick={handleSaveName} style={{ marginTop: 10, width: "100%", padding: "10px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                                保存
                            </button>
                        </div>

                        <button onClick={handleAddPoint} style={{ padding: "14px", borderRadius: 12, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.1)", color: "#818cf8", fontWeight: 700, cursor: "pointer", fontSize: 15 }}>
                            ⚡ +10pt 追加
                        </button>

                        <button onClick={() => router.push("/history")} style={{ padding: "14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#9ca3af", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
                            履歴を見る →
                        </button>
                    </div>

                    {/* 右：ポイント履歴 */}
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