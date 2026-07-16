"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { computeReportStreak } from "../lib/date";
import TodayScheduleReview, { TodayScheduleReviewHandle } from "../components/TodayScheduleReview";
import DotKun from "../components/DotKun";
import { generateDotKunFeedback, DotKunFeedback } from "../lib/dotkunFeedback";

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

export default function ReportPage() {
    const router = useRouter();
    const reviewRef = useRef<TodayScheduleReviewHandle>(null);
    const [factText, setFactText] = useState("");        // 今日のGood
    const [interpText, setInterpText] = useState("");    // 未使用（空で保存）
    const [actionText, setActionText] = useState("");    // 明日のQuest
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [dotkunFb, setDotkunFb] = useState<DotKunFeedback | null>(null);
    const [kpiItems, setKpiItems] = useState<KpiItem[]>([]);
    const [kpiValues, setKpiValues] = useState<Record<string, number>>({});
    const [gachaSpinning, setGachaSpinning] = useState(false);
    const [gachaResult, setGachaResult] = useState<number | null>(null);
    const [reportDone, setReportDone] = useState(false);
    const [questDone, setQuestDone] = useState(0);
    const [questTotal, setQuestTotal] = useState(0);

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase.from("kpi_items").select("*").eq("is_active", true).order("created_at");
            setKpiItems((data || []) as KpiItem[]);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const todayYmd = getTodayJST();
                const { data: subs } = await supabase.from("submissions").select("created_at").eq("user_id", user.id);
                const submittedToday = (subs || []).some((row: any) => toJSTDateOnly(row.created_at) === todayYmd);
                const { data: gachas } = await supabase.from("gacha_history").select("created_at").eq("user_id", user.id).eq("cost", 0);
                const gachaToday = (gachas || []).some((row: any) => toJSTDateOnly(row.created_at) === todayYmd);
                if (submittedToday && !gachaToday) setReportDone(true);
            }
        };
        load();
    }, []);

    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const combinedText = `【今日のGood】うまくいったこと\n${factText.trim()}\n\n【明日のQuest】明日がんばること\n${actionText.trim()}`;
            const totalLength = factText.trim().length + actionText.trim().length;
            if (totalLength === 0) { setMessage("今日の振り返りを書いてください"); return; }
            if (totalLength < 20) { setMessage(`もう少しだけ書いてみよう（現在${totalLength}文字 / 20文字以上）`); return; }
            setMessage("");

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setMessage("ログインエラー"); setLoading(false); return; }
            const todayYmd = getTodayJST();

            const { data: todaySubmissionRows } = await supabase.from("submissions").select("id, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
            if (todaySubmissionRows?.some((row) => toJSTDateOnly(row.created_at) === todayYmd)) {
                setMessage("今日はすでに提出済みです");
                setLoading(false);
                return;
            }

            const { error: submissionError } = await supabase.from("submissions").insert({ user_id: user.id, content: combinedText });
            if (submissionError) { setMessage("提出に失敗しました"); setLoading(false); return; }

            const nowIso = new Date().toISOString();
            const kpiLogs = Object.entries(kpiValues).filter(([, v]) => v > 0).map(([kpi_item_id, value]) => ({ user_id: user.id, kpi_item_id, value }));
            if (kpiLogs.length > 0) await supabase.from("kpi_logs").insert(kpiLogs);

            const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", user.id).single();
            const currentPoints = pointRow?.points || 0;

            const { data: streakRows } = await supabase.from("submissions").select("created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(400);
            const newStreak = computeReportStreak((streakRows || []).map((r: any) => r.created_at));

            let bonus = 0;
            if (newStreak >= 3) bonus = 5;
            if (newStreak >= 7) bonus = 10;
            const addPoints = 2 + bonus;

            await supabase.from("user_points").update({ points: currentPoints + addPoints }).eq("id", user.id);
            const historyInserts = [{ user_id: user.id, change: 2, reason: "report_submit" }];
            if (bonus > 0) historyInserts.push({ user_id: user.id, change: bonus, reason: "streak_bonus" });
            await supabase.from("points_history").insert(historyInserts);
            await supabase.from("profiles").update({ streak: newStreak, last_report_date: nowIso }).eq("id", user.id);

            // Quest振り返りを保存
            const reviewResult = await reviewRef.current?.saveReview(user.id);

            // 全達成なら累計＆連続ボーナス
            if (reviewResult?.isAllMaru) {
                const { data: schedRow } = await supabase.from("daily_schedules").select("streak_rewarded, schedule_status").eq("user_id", user.id).eq("date", todayYmd).maybeSingle();
                if (schedRow && !(schedRow as any).streak_rewarded && (schedRow as any).schedule_status !== "rejected") {
                    const { data: profMaru } = await supabase.from("profiles").select("total_maru_days").eq("id", user.id).single();
                    const newTotal = ((profMaru as any)?.total_maru_days || 0) + 1;
                    await supabase.from("profiles").update({ total_maru_days: newTotal }).eq("id", user.id);

                    let maruStreak = 1;
                    for (let i = 1; i <= 30; i++) {
                        const past = new Date(`${todayYmd}T00:00:00+09:00`);
                        past.setDate(past.getDate() - i);
                        const pastYmd = past.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
                        const { data: pastRow } = await supabase.from("daily_schedules").select("slots").eq("user_id", user.id).eq("date", pastYmd).maybeSingle();
                        const pastSlots = (pastRow as any)?.slots;
                        // 新3分割Quest構造で全達成判定
                        let pastAllMaru = false;
                        if (pastSlots && !Array.isArray(pastSlots)) {
                            const allQ = [...(pastSlots.morning || []), ...(pastSlots.afternoon || []), ...(pastSlots.night || [])];
                            pastAllMaru = allQ.length > 0 && allQ.every((q: any) => q.done);
                        }
                        if (pastAllMaru) maruStreak++;
                        else break;
                    }

                    let maruBonus = 0;
                    if (maruStreak === 3) maruBonus = 5;
                    else if (maruStreak === 7) maruBonus = 10;
                    if (maruBonus > 0) {
                        const { data: ptNow } = await supabase.from("user_points").select("points").eq("id", user.id).single();
                        await supabase.from("user_points").update({ points: ((ptNow as any)?.points || 0) + maruBonus }).eq("id", user.id);
                        await supabase.from("points_history").insert([{ user_id: user.id, change: maruBonus, reason: "maru_streak_bonus" }]);
                    }
                    await supabase.from("daily_schedules").update({ streak_rewarded: true }).eq("user_id", user.id).eq("date", todayYmd);
                }
            }

            setSuccess(true);
            setMessage(bonus > 0 ? `+${addPoints}pt 獲得！連続ボーナス +${bonus}pt も獲得 🎉` : `+${addPoints}pt 獲得しました！`);
            setDotkunFb(generateDotKunFeedback({ factText, interpText: "", actionText, streak: newStreak }));
            setFactText(""); setActionText(""); setLoading(false);
            setReportDone(true);
        } finally {
            setSubmitting(false);
        }
    };

    const handleGachaSpin = async () => {
        if (gachaSpinning || gachaResult !== null) return;
        setGachaSpinning(true);
        const prizes = [
            { pt: 1, weight: 5 }, { pt: 2, weight: 10 }, { pt: 3, weight: 20 },
            { pt: 4, weight: 20 }, { pt: 5, weight: 20 }, { pt: 6, weight: 10 },
            { pt: 7, weight: 5 }, { pt: 8, weight: 5 }, { pt: 9, weight: 3 }, { pt: 10, weight: 2 },
        ];
        const totalWeight = prizes.reduce((s, p) => s + p.weight, 0);
        let random = Math.random() * totalWeight;
        let selectedPt = 1;
        for (const prize of prizes) { random -= prize.weight; if (random <= 0) { selectedPt = prize.pt; break; } }
        await new Promise(resolve => setTimeout(resolve, 1500));
        setGachaResult(selectedPt);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: ptRow } = await supabase.from("user_points").select("points").eq("id", user.id).maybeSingle();
            const currentPt = (ptRow as any)?.points || 0;
            await supabase.from("user_points").upsert({ id: user.id, points: currentPt + selectedPt });
            await supabase.from("gacha_history").insert({ user_id: user.id, cost: 0, reward: selectedPt, rarity: selectedPt === 10 ? "LEGEND" : selectedPt >= 7 ? "RARE" : "COMMON" });
        }
        setGachaSpinning(false);
    };

    // Quest結果の計算（演出値: 1Quest = 5pt換算）
    const rate = questTotal > 0 ? Math.round((questDone / questTotal) * 100) : 0;
    const rank = rate >= 90 ? "S" : rate >= 80 ? "A" : rate >= 60 ? "B" : rate >= 40 ? "C" : "D";
    const rankColor = rate >= 90 ? "#fbbf24" : rate >= 80 ? "#fbbf24" : rate >= 60 ? "#34d399" : rate >= 40 ? "#818cf8" : "#9ca3af";
    const questPt = questDone * 5;

    const bigInput: React.CSSProperties = {
        width: "100%", minHeight: 70, padding: 14, borderRadius: 12,
        background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15,
        lineHeight: 1.7, outline: "none", resize: "vertical", boxSizing: "border-box",
        fontFamily: "inherit", border: "1px solid rgba(139,92,246,0.3)",
    };

    return (
        <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% 0%, #1a1030 0%, #0b0b16 55%)", padding: "24px 16px 60px" }}>
            <div style={{ maxWidth: 620, margin: "0 auto" }}>
                {/* ヘッダー */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                    <div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>今日のQuest結果</div>
                        <div style={{ fontSize: 12.5, color: "#c4b5fd", marginTop: 3 }}>今日のQuestをクリアして、成長を記録しよう！</div>
                    </div>
                    <button onClick={() => router.push("/home")} style={{ border: "1px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.12)", borderRadius: 12, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, color: "#c4b5fd", cursor: "pointer", whiteSpace: "nowrap" }}>🏝️ 島へ</button>
                </div>

                {/* ===== Today's Quest Result（主役） ===== */}
                <div style={{ borderRadius: 24, padding: "24px 22px", marginBottom: 16, background: "linear-gradient(160deg, rgba(139,92,246,0.25), rgba(76,29,149,0.1))", border: "1.5px solid rgba(167,139,250,0.4)", boxShadow: "0 12px 40px rgba(76,29,149,0.3)", textAlign: "center", position: "relative", overflow: "hidden" }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "#c4b5fd", letterSpacing: 3, marginBottom: 4 }}>TODAY'S QUEST RESULT</div>
                    <div style={{ fontSize: 60, fontWeight: 900, color: rankColor, lineHeight: 1.1, textShadow: `0 0 30px ${rankColor}88` }}>{rank}<span style={{ fontSize: 20, color: "#c4b5fd" }}> RANK</span></div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 18 }}>
                        <div style={{ padding: "12px 6px", borderRadius: 14, background: "rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{questDone}<span style={{ fontSize: 13, color: "#9ca3af" }}>/{questTotal}</span></div>
                            <div style={{ fontSize: 10, color: "#c4b5fd", fontWeight: 700, marginTop: 4 }}>達成Quest</div>
                        </div>
                        <div style={{ padding: "12px 6px", borderRadius: 14, background: "rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: "#fcd34d", lineHeight: 1 }}>{questPt}<span style={{ fontSize: 12 }}>pt</span></div>
                            <div style={{ fontSize: 10, color: "#c4b5fd", fontWeight: 700, marginTop: 4 }}>Questポイント</div>
                        </div>
                        <div style={{ padding: "12px 6px", borderRadius: 14, background: "rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: rankColor, lineHeight: 1 }}>{rate}<span style={{ fontSize: 12 }}>%</span></div>
                            <div style={{ fontSize: 10, color: "#c4b5fd", fontWeight: 700, marginTop: 4 }}>達成率</div>
                        </div>
                    </div>
                    <div style={{ marginTop: 14, height: 8, borderRadius: 999, background: "rgba(0,0,0,0.2)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${rate}%`, borderRadius: 999, background: `linear-gradient(90deg, ${rankColor}, ${rankColor}bb)`, transition: "width .6s ease" }} />
                    </div>
                    <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#e0d7ff", background: "rgba(255,255,255,0.08)", borderRadius: 999, padding: "5px 12px" }}>日報提出 +2pt</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#e0d7ff", background: "rgba(255,255,255,0.08)", borderRadius: 999, padding: "5px 12px" }}>3日連続 +5pt</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#e0d7ff", background: "rgba(255,255,255,0.08)", borderRadius: 999, padding: "5px 12px" }}>7日連続 +10pt</span>
                    </div>
                </div>

                {/* ドットくん応援 */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 16, padding: "12px 16px", marginBottom: 16 }}>
                    <div style={{ flexShrink: 0, animation: "floaty 2.6s ease-in-out infinite" }}><DotKun size={46} stage={5} mood="cheer" /></div>
                    <div style={{ flex: 1, fontSize: 12.5, color: "#e0d7ff", fontWeight: 600, lineHeight: 1.6 }}>おつかれさま！今日もよく頑張ったね✨ 振り返って、明日も最高の1日にしよう！</div>
                </div>

                {/* ===== KPIコンパクト横並び ===== */}
                {kpiItems.length > 0 && (
                    <div style={{ borderRadius: 18, padding: 16, marginBottom: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#9ca3af", letterSpacing: 1, marginBottom: 12 }}>📊 今日の活動実績</div>
                        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(kpiItems.length, 3)}, 1fr)`, gap: 10 }}>
                            {kpiItems.map((item) => {
                                const val = kpiValues[item.id] || 0;
                                const pct = item.target_value > 0 ? Math.min(Math.round((val / item.target_value) * 100), 100) : 0;
                                const done = val > 0 && val >= item.target_value;
                                return (
                                    <div key={item.id} style={{ padding: "12px 10px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#c4b5fd", marginBottom: 6 }}>{item.title}</div>
                                        <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 6 }}>
                                            <input type="number" min={0} value={kpiValues[item.id] ?? ""} onChange={(e) => setKpiValues(prev => ({ ...prev, [item.id]: Number(e.target.value) }))} placeholder="0" style={{ width: 52, padding: "4px 6px", borderRadius: 7, border: "1px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.1)", color: "#fff", fontSize: 16, fontWeight: 800, outline: "none", textAlign: "center" }} />
                                            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>/ {item.target_value}</span>
                                        </div>
                                        <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                            <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: done ? "linear-gradient(90deg,#34d399,#10b981)" : "linear-gradient(90deg,#8b5cf6,#a78bfa)" }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ===== Quest振り返り（Result Cards） ===== */}
                <div style={{ borderRadius: 18, padding: 16, marginBottom: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#9ca3af", letterSpacing: 1, marginBottom: 12 }}>✨ Questの振り返り</div>
                    <TodayScheduleReview ref={reviewRef} onProgressChange={(d, t) => { setQuestDone(d); setQuestTotal(t); }} />
                </div>

                {/* ===== 振り返り質問（2つ） ===== */}
                <div style={{ borderRadius: 18, padding: 20, marginBottom: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#34d399", marginBottom: 8 }}>😊 今日のGood！</div>
                        <div style={{ fontSize: 11.5, color: "#9ca3af", marginBottom: 8 }}>今日うまくいったことは？</div>
                        <textarea value={factText} onChange={(e) => setFactText(e.target.value)} maxLength={100} placeholder="例）朝の課題を早めに終わらせられた！アポが2件取れた！" style={bigInput} />
                        <div style={{ textAlign: "right", fontSize: 11, color: "#6b7280", marginTop: 3 }}>{factText.length} / 100</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#a78bfa", marginBottom: 8 }}>🔥 Tomorrow Quest！</div>
                        <div style={{ fontSize: 11.5, color: "#9ca3af", marginBottom: 8 }}>明日は何を頑張る？</div>
                        <textarea value={actionText} onChange={(e) => setActionText(e.target.value)} maxLength={100} placeholder="例）朝イチで資料作成を終わらせる。アポ3件を目指す。" style={bigInput} />
                        <div style={{ textAlign: "right", fontSize: 11, color: "#6b7280", marginTop: 3 }}>{actionText.length} / 100</div>
                    </div>
                </div>

                {/* 提出ボタン */}
                <button onClick={handleSubmit} disabled={loading || submitting} style={{ width: "100%", padding: "16px 0", borderRadius: 16, border: "none", cursor: (loading || submitting) ? "default" : "pointer", background: "linear-gradient(135deg, #a78bfa, #7c3aed)", color: "#fff", fontSize: 16, fontWeight: 900, letterSpacing: 1, boxShadow: "0 8px 24px rgba(124,58,237,0.4)", opacity: (loading || submitting) ? 0.7 : 1 }}>
                    {submitting ? "送信中..." : "✨ 今日のQuestを完了する！"}
                </button>
                <div style={{ textAlign: "center", fontSize: 11, color: "#6b6b85", marginTop: 8 }}>提出するとポイントが獲得できます！</div>

                {/* メッセージ */}
                {message && (
                    <div style={{ marginTop: 18, padding: "16px 20px", borderRadius: 14, background: success ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)", border: `1px solid ${success ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`, color: success ? "#34d399" : "#f87171", fontWeight: 700, fontSize: 14, textAlign: "center" }}>
                        {message}
                        {success && <button onClick={() => router.push("/mypage")} style={{ marginLeft: 12, padding: "5px 14px", borderRadius: 8, border: "none", background: "rgba(52,211,153,0.2)", color: "#34d399", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>マイページで確認 →</button>}
                    </div>
                )}

                {/* ドットくんフィードバック */}
                {dotkunFb && (
                    <div style={{ marginTop: 16, padding: "16px 18px", borderRadius: 16, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <div style={{ flexShrink: 0, width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}><DotKun size={46} mood={dotkunFb.mood} /></div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", marginBottom: 6 }}>ドットくんより</div>
                            {dotkunFb.lines.map((line, i) => (<p key={i} style={{ margin: "0 0 6px", fontSize: 14, lineHeight: 1.6, color: "#e5e7eb" }}>{line}</p>))}
                        </div>
                    </div>
                )}

                {/* 提出後: 学習導線 */}
                {reportDone && (
                    <div style={{ marginTop: 16, padding: "18px 20px", borderRadius: 16, background: "linear-gradient(135deg, rgba(6,182,212,0.18), rgba(99,102,241,0.15))", border: "1px solid rgba(6,182,212,0.35)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "#f9fafb", marginBottom: 3 }}>📚 この勢いで、学習も進めちゃおう！</div>
                            <div style={{ fontSize: 12.5, color: "#9ca3af" }}>動画・記事を見てポイントもGET</div>
                        </div>
                        <button onClick={() => router.push("/learn")} style={{ flexShrink: 0, padding: "11px 22px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #06b6d4, #6366f1)", color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>続けて学習する →</button>
                    </div>
                )}

                {/* 提出後: ガチャ */}
                {reportDone && (
                    <div style={{ marginTop: 16, padding: "22px", borderRadius: 16, background: "linear-gradient(135deg, #fbbf24 0%, #ec4899 50%, #8b5cf6 100%)", textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", fontWeight: 700, letterSpacing: 3, marginBottom: 6 }}>✨ 日報提出ボーナス ✨</div>
                        <div style={{ fontSize: 17, color: "#fff", fontWeight: 800, marginBottom: 14 }}>🎰 今日の運試し！</div>
                        <button onClick={handleGachaSpin} disabled={gachaSpinning || gachaResult !== null} style={{ padding: "15px 44px", borderRadius: 100, border: "4px solid #fff", background: gachaResult !== null ? "rgba(255,255,255,0.5)" : "linear-gradient(135deg, #fff, #fef3c7)", color: "#ec4899", fontSize: 19, fontWeight: 900, cursor: (gachaSpinning || gachaResult !== null) ? "default" : "pointer" }}>
                            {gachaSpinning ? "🎲 ぐるぐる..." : gachaResult !== null ? `🎁 +${gachaResult}pt 獲得済み` : "🎁 ガチャを引く！"}
                        </button>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 10, fontWeight: 600 }}>ランダムで 1〜10pt 獲得！</div>
                    </div>
                )}
            </div>
            <style>{`@keyframes floaty { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>
        </div>
    );
}
