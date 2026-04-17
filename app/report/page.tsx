"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type KpiItem = { id: string; title: string; unit: string; target_value: number };

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

const TEMPLATES = [
    { label: "📋 基本", content: `【今日やったこと】\n・\n\n【学んだこと・気づき】\n・\n\n【明日やること】\n・` },
    { label: "📞 CB", content: `【架電・商談】\n・架電数：\n・アポ獲得：\n・商談数：\n\n【成果・気づき】\n・\n\n【明日の目標】\n・` },
    { label: "🚪 IP", content: `【ピンポン活動】\n・ピンポン数：\n・獲得数：\n・解除数：\n\n【成果・気づき】\n・\n\n【明日の目標】\n・` },
    { label: "🤝 SP", content: `【活動報告】\n・ピンポン数：\n・アポ数：\n\n【成果・気づき】\n・\n\n【明日の目標】\n・` },
    { label: "📣 MK", content: `【マーケティング活動】\n・DM送信数：\n・返信数：\n・日調数：\n・面談数：\n\n【成果・気づき】\n・\n\n【明日の目標】\n・` },
    { label: "💡 振り返り", content: `【KPT振り返り】\nKeep（続けること）：\n・\n\nProblem（課題）：\n・\n\nTry（試すこと）：\n・` },
];

export default function ReportPage() {
    const router = useRouter();
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [success, setSuccess] = useState(false);
    const [kpiItems, setKpiItems] = useState<KpiItem[]>([]);
    const [kpiValues, setKpiValues] = useState<Record<string, number>>({});
    const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase.from("kpi_items").select("*").eq("is_active", true).order("created_at");
            setKpiItems((data || []) as KpiItem[]);
        };
        load();
    }, []);

    const handleApplyTemplate = (index: number) => {
        if (selectedTemplate === index) { setText(""); setSelectedTemplate(null); }
        else { setText(TEMPLATES[index].content); setSelectedTemplate(index); }
    };

    const handleSubmit = async () => {
        if (!text.trim()) { setMessage("日報を書いてください"); return; }
        if (text.trim().length < 100) { setMessage(`❌ 日報は100文字以上で書いてください（現在${text.trim().length}文字）`); return; }
        setLoading(true);
        setMessage("");

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setMessage("ログインエラー"); setLoading(false); return; }

        const todayYmd = getTodayJST();

        const { data: todaySubmissionRows } = await supabase
            .from("submissions").select("id, created_at").eq("user_id", user.id).order("created_at", { ascending: false });

        if (todaySubmissionRows?.some((row) => toJSTDateOnly(row.created_at) === todayYmd)) {
            setMessage("今日はすでに提出済みです");
            setLoading(false);
            return;
        }

        // ✅ created_at を省略 → DBのデフォルトUTC時刻で保存 → 表示時にJST変換で正しく表示
        const { error: submissionError } = await supabase.from("submissions").insert({
            user_id: user.id,
            content: text.trim(),
        });
        if (submissionError) { setMessage("日報の保存に失敗しました"); setLoading(false); return; }

        const nowIso = new Date().toISOString();

        const kpiLogs = Object.entries(kpiValues)
            .filter(([, v]) => v > 0)
            .map(([kpi_item_id, value]) => ({ user_id: user.id, kpi_item_id, value }));
        if (kpiLogs.length > 0) await supabase.from("kpi_logs").insert(kpiLogs);

        const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", user.id).single();
        const currentPoints = pointRow?.points || 0;
        const { data: profileRow } = await supabase.from("profiles").select("streak, last_report_date").eq("id", user.id).single();

        let newStreak = 1;
        let bonus = 0;
        if (profileRow?.last_report_date) {
            const lastYmd = toJSTDateOnly(profileRow.last_report_date);
            const todayDate = new Date(`${todayYmd}T00:00:00+09:00`);
            const yesterdayDate = new Date(todayDate);
            yesterdayDate.setDate(todayDate.getDate() - 1);
            const yesterdayYmd = yesterdayDate.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
            if (lastYmd === yesterdayYmd) newStreak = (profileRow.streak || 0) + 1;
            else if (lastYmd === todayYmd) newStreak = profileRow.streak || 1;
            else newStreak = 1;
        }
        if (newStreak >= 3) bonus = 5;
        if (newStreak >= 7) bonus = 10;
        const addPoints = 2 + bonus;

        await supabase.from("user_points").update({ points: currentPoints + addPoints }).eq("id", user.id);
        const historyInserts = [{ user_id: user.id, change: 2, reason: "report_submit" }];
        if (bonus > 0) historyInserts.push({ user_id: user.id, change: bonus, reason: "streak_bonus" });
        await supabase.from("points_history").insert(historyInserts);
        await supabase.from("profiles").update({ streak: newStreak, last_report_date: nowIso }).eq("id", user.id);

        setSuccess(true);
        setMessage(bonus > 0 ? `+${addPoints}pt 獲得！連続提出ボーナス +${bonus}pt も獲得しました 🎉` : `+${addPoints}pt 獲得しました！`);
        setText(""); setSelectedTemplate(null); setLoading(false);
    };

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 30% 40%, rgba(99,102,241,0.1) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "relative", zIndex: 1, maxWidth: 760, margin: "0 auto" }}>
                <div style={{ marginBottom: 32 }}>
                    <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>日報提出</h1>
                    <p style={{ margin: "8px 0 0", color: "#6b7280", fontSize: 14 }}>今日の活動を記録してポイントを獲得しましょう</p>
                </div>

                <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                    {[{ label: "日報提出", pt: "+2pt", color: "#818cf8" }, { label: "3日連続", pt: "+5pt", color: "#34d399" }, { label: "7日連続", pt: "+10pt", color: "#f59e0b" }].map((item, i) => (
                        <div key={i} style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: "#9ca3af" }}>{item.label}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.pt}</span>
                        </div>
                    ))}
                </div>

                {kpiItems.length > 0 && (
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 24, marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>📊 KPI入力</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {kpiItems.map((item) => (
                                <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: "#f9fafb" }}>{item.title}</div>
                                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>目標: {item.target_value}{item.unit}</div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <input type="number" min={0} value={kpiValues[item.id] ?? ""} onChange={(e) => setKpiValues(prev => ({ ...prev, [item.id]: Number(e.target.value) }))} placeholder="0" style={{ width: 80, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.1)", color: "#f9fafb", fontSize: 14, outline: "none", textAlign: "right" }} />
                                        <span style={{ fontSize: 13, color: "#6b7280" }}>{item.unit}</span>
                                        {kpiValues[item.id] > 0 && kpiValues[item.id] >= item.target_value && <span style={{ fontSize: 12, color: "#34d399", fontWeight: 700 }}>✅ 達成！</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 32 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2 }}>TODAY'S REPORT</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {TEMPLATES.map((tmpl, i) => (
                                <button key={i} onClick={() => handleApplyTemplate(i)} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: selectedTemplate === i ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: selectedTemplate === i ? "#fff" : "#9ca3af", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                                    {tmpl.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="今日やったこと、学んだこと、気づきを書いてください..." style={{ width: "100%", height: 280, padding: 16, borderRadius: 12, border: `1px solid ${text.trim().length >= 100 ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.1)"}`, background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, lineHeight: 1.8, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                        <div style={{ fontSize: 12, color: text.trim().length >= 100 ? "#34d399" : text.trim().length >= 50 ? "#f59e0b" : "#6b7280" }}>
                            {text.trim().length >= 100 ? "✅ OK!" : `あと${100 - text.trim().length}文字`}
                        </div>
                        <div style={{ fontSize: 12, color: text.trim().length >= 100 ? "#34d399" : "#6b7280", fontWeight: 700 }}>
                            {text.trim().length} / 100文字
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                        <button onClick={handleSubmit} disabled={loading} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none", background: loading ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 15 }}>
                            {loading ? "送信中..." : "⚡ 日報を送信"}
                        </button>
                        <button onClick={() => router.push("/mypage")} style={{ padding: "14px 24px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>戻る</button>
                    </div>
                    {message && (
                        <div style={{ marginTop: 20, padding: "16px 20px", borderRadius: 12, background: success ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${success ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`, color: success ? "#34d399" : "#f87171", fontWeight: 600, fontSize: 14 }}>
                            {message}
                            {success && <button onClick={() => router.push("/mypage")} style={{ marginLeft: 16, padding: "4px 12px", borderRadius: 6, border: "none", background: "rgba(52,211,153,0.2)", color: "#34d399", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>マイページで確認 →</button>}
                        </div>
                    )}
                </div>

                <div style={{ marginTop: 32, textAlign: "center" }}>
                    <button onClick={() => router.push("/mypage")} style={{ padding: "12px 32px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>🏠 ホームに戻る</button>
                </div>
            </div>
        </main>
    );
}