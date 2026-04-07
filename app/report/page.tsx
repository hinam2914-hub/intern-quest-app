"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function toJSTDateOnly(value: string): string {
    const date = new Date(value);
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export default function ReportPage() {
    const router = useRouter();
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = async () => {
        if (!text.trim()) { setMessage("日報を書いてください"); return; }
        setLoading(true);
        setMessage("");

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setMessage("ログインエラー"); setLoading(false); return; }

        const todayYmd = getTodayJST();
        const nowIso = new Date().toISOString();

        const { data: todaySubmissionRows } = await supabase
            .from("submissions").select("id, created_at").eq("user_id", user.id).order("created_at", { ascending: false });

        if (todaySubmissionRows?.some((row) => toJSTDateOnly(row.created_at) === todayYmd)) {
            setMessage("今日はすでに提出済みです");
            setLoading(false);
            return;
        }

        const { error: submissionError } = await supabase.from("submissions").insert({ user_id: user.id, content: text.trim(), created_at: nowIso });
        if (submissionError) { setMessage("日報の保存に失敗しました"); setLoading(false); return; }

        const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", user.id).single();
        const currentPoints = pointRow?.points || 0;

        const { data: profileRow } = await supabase.from("profiles").select("streak, last_report_date").eq("id", user.id).single();

        let newStreak = 1;
        let bonus = 0;
        if (profileRow?.last_report_date) {
            const lastYmd = toJSTDateOnly(profileRow.last_report_date);
            const todayDate = new Date(todayYmd);
            const yesterdayDate = new Date(todayDate);
            yesterdayDate.setDate(todayDate.getDate() - 1);
            const yesterdayYmd = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, "0")}-${String(yesterdayDate.getDate()).padStart(2, "0")}`;
            newStreak = lastYmd === yesterdayYmd ? (profileRow.streak || 0) + 1 : 1;
        }
        if (newStreak === 3) bonus = 5;
        if (newStreak === 7) bonus = 10;
        const addPoints = 2 + bonus;

        await supabase.from("user_points").update({ points: currentPoints + addPoints }).eq("id", user.id);

        const historyInserts = [{ user_id: user.id, change: 10, created_at: nowIso, reason: "report_submit" }];
        if (bonus > 0) historyInserts.push({ user_id: user.id, change: bonus, created_at: nowIso, reason: "streak_bonus" });
        await supabase.from("points_history").insert(historyInserts);
        await supabase.from("profiles").update({ streak: newStreak, last_report_date: nowIso }).eq("id", user.id);

        setSuccess(true);
        setMessage(bonus > 0 ? `+10pt 獲得！連続提出ボーナス +${bonus}pt も獲得しました 🎉` : "+10pt 獲得しました！");
        setText("");
        setLoading(false);
    };

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>

            {/* 背景グロー */}
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 30% 40%, rgba(99,102,241,0.1) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(139,92,246,0.06) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 760, margin: "0 auto" }}>

                {/* ヘッダー */}
                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>日報提出</h1>
                    <p style={{ margin: "8px 0 0", color: "#6b7280", fontSize: 14 }}>今日の活動を記録してポイントを獲得しましょう</p>
                </div>

                {/* ポイント獲得インフォ */}
                <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                    {[
                        { label: "日報提出", pt: "+2pt", color: "#818cf8" },
                        { label: "3日連続", pt: "+5pt", color: "#34d399" },
                        { label: "7日連続", pt: "+10pt", color: "#f59e0b" },
                    ].map((item, i) => (
                        <div key={i} style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: "#9ca3af" }}>{item.label}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.pt}</span>
                        </div>
                    ))}
                </div>

                {/* メインカード */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 32, backdropFilter: "blur(10px)" }}>

                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>TODAY'S REPORT</div>

                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="今日やったこと、学んだこと、気づきを書いてください..."
                        style={{
                            width: "100%", height: 240, padding: 16, borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.1)",
                            background: "rgba(255,255,255,0.05)",
                            color: "#f9fafb", fontSize: 15, lineHeight: 1.7,
                            outline: "none", resize: "vertical",
                            boxSizing: "border-box", fontFamily: "inherit",
                        }}
                    />

                    <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            style={{
                                flex: 1, padding: "14px", borderRadius: 12, border: "none",
                                background: loading ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                color: "#fff", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 15,
                            }}
                        >
                            {loading ? "送信中..." : "⚡ 日報を送信"}
                        </button>

                        <button
                            onClick={() => router.push("/mypage")}
                            style={{ padding: "14px 24px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontWeight: 600, cursor: "pointer", fontSize: 14 }}
                        >
                            戻る
                        </button>
                    </div>

                    {message && (
                        <div style={{
                            marginTop: 20, padding: "16px 20px", borderRadius: 12,
                            background: success ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                            border: `1px solid ${success ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
                            color: success ? "#34d399" : "#f87171",
                            fontWeight: 600, fontSize: 14,
                        }}>
                            {message}
                            {success && (
                                <button onClick={() => router.push("/mypage")} style={{ marginLeft: 16, padding: "4px 12px", borderRadius: 6, border: "none", background: "rgba(52,211,153,0.2)", color: "#34d399", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                                    マイページで確認 →
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}