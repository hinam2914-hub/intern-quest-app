"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Q = { q: string; options: string[]; correct: number };

const CHOICE_QUESTIONS: Q[] = [
    { q: "企画の本質として最も近いものは？", options: ["面白いアイデアを出すこと", "売れる構造を設計すること", "デザインを整えること", "トレンドを追うこと"], correct: 1 },
    { q: "「売れない企画」の典型的な原因は？", options: ["タイミングが悪い", "アイデアが弱い", "ターゲットが曖昧", "広告が足りない"], correct: 2 },
    { q: "営業経験がない人が企画をやると起きやすい問題は？", options: ["スピードが遅い", "視点が狭くなる", "売れない設計になる", "チームと揉める"], correct: 2 },
    { q: "良い企画の条件はどれか？", options: ["斬新であること", "誰でも理解できること", "デザインが良いこと", "再現性があること"], correct: 3 },
    { q: "数字が悪い企画の改善で最初にやるべきは？", options: ["広告費を上げる", "デザインを変える", "導線とターゲットを見直す", "投稿数を増やす"], correct: 2 },
    { q: "企画者に最も必要な能力は？", options: ["センス", "分析力", "発想力", "コミュ力"], correct: 1 },
    { q: "「バズったけど売れない企画」はどう評価する？", options: ["成功", "惜しい", "改善前提でOK", "失敗"], correct: 3 },
    { q: "ターゲット設定で重要なのは？", options: ["人数", "年齢", "性別", "解像度"], correct: 3 },
    { q: "企画とマーケの関係として正しいのは？", options: ["同じ", "企画の方が上", "マーケの方が上", "企画が設計、マーケが拡張"], correct: 3 },
    { q: "企画が成功する一番の要因は？", options: ["アイデア", "タイミング", "実行力", "運"], correct: 2 },
    { q: "SNSフォロワー1万人で売上0の場合は？", options: ["伸びている", "惜しい状態", "改善すればいける", "設計ミス"], correct: 3 },
    { q: "営業トップのやり方を見る理由は？", options: ["時短になる", "楽だから", "売れる構造が見える", "勉強になる"], correct: 2 },
    { q: "企画前に最も優先すべきことは？", options: ["アイデア出し", "デザイン", "トレンド分析", "現場と数字の理解"], correct: 3 },
    { q: "「面白いけど売れない」企画の扱いは？", options: ["継続", "改善", "様子見", "切る"], correct: 3 },
    { q: "初心者が企画をやるための最短ルートは？", options: ["本を読む", "SNS運用する", "先輩の真似", "営業で売る経験を積む"], correct: 3 },
];

const WRITTEN_QUESTIONS = [
    "なぜ営業経験が企画に必要なのか説明してください",
    "売れる企画と売れない企画の違いを具体的に書いてください",
    "売れる導線（認知→興味→比較→行動）を説明してください",
    "今の事業で改善できる企画案を1つ出してください",
    "企画が失敗する原因と対策を書いてください",
    "自分が企画職に足りていないもの",
];

const A_THRESHOLD = 0.90;
const REWARD_POINTS = 500;
const TEST_KEY = "planner";

export default function PlannerTestPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState("");
    const [alreadyPassed, setAlreadyPassed] = useState(false);
    const [canRetry, setCanRetry] = useState(true);
    const [answers, setAnswers] = useState<(number | null)[]>(Array(CHOICE_QUESTIONS.length).fill(null));
    const [written, setWritten] = useState<string[]>(Array(WRITTEN_QUESTIONS.length).fill(""));
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ rank: string; score: number; total: number } | null>(null);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const { data: p } = await supabase.from("profiles").select("planner_passed").eq("id", user.id).maybeSingle();
            if ((p as any)?.planner_passed) { setAlreadyPassed(true); setLoading(false); return; }
            const { data: lastAttempt } = await supabase.from("test_attempts").select("created_at").eq("user_id", user.id).eq("test_key", TEST_KEY).order("created_at", { ascending: false }).limit(1).maybeSingle();
            if (lastAttempt) {
                const elapsed = Date.now() - new Date(lastAttempt.created_at).getTime();
                if (elapsed < 24 * 60 * 60 * 1000) setCanRetry(false);
            }
            setLoading(false);
        };
        load();
    }, [router]);

    const handleSubmit = async () => {
        if (answers.some(a => a === null)) { alert("すべての選択肢に回答してください"); return; }
        setSubmitting(true);
        const correctCount = answers.filter((a, i) => a === CHOICE_QUESTIONS[i].correct).length;
        const score = correctCount / CHOICE_QUESTIONS.length;
        let rank = "C";
        if (score >= A_THRESHOLD) rank = "A";
        else if (score >= 0.80) rank = "B";
        const passed = rank === "A";

        await supabase.from("test_attempts").insert({ user_id: userId, test_key: TEST_KEY, score: Math.round(score * 100), passed });

        if (passed) {
            await supabase.from("profiles").update({ planner_passed: true, planner_passed_at: new Date().toISOString() }).eq("id", userId);
            const { data: ptRow } = await supabase.from("user_points").select("points").eq("id", userId).maybeSingle();
            const currentPt = ptRow?.points || 0;
            await supabase.from("user_points").upsert({ id: userId, points: currentPt + REWARD_POINTS });
            await supabase.from("points_history").insert({ user_id: userId, change: REWARD_POINTS, reason: "企画職適性テスト Aランク合格" });
        }

        setResult({ rank, score: correctCount, total: CHOICE_QUESTIONS.length });
        setSubmitting(false);
    };

    if (loading) return <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#ec4899", fontSize: 18, fontWeight: 700 }}>Loading...</div></main>;

    if (alreadyPassed) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>💡</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#ec4899", margin: "0 0 12px" }}>Aランク済み</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 32 }}>あなたはすでに企画職適性Aランクに認定されています</p>
                <button onClick={() => router.push("/tests")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>テスト一覧へ戻る</button>
            </div>
        </main>
    );

    if (result) {
        const rankColor = result.rank === "A" ? "#10b981" : result.rank === "B" ? "#f59e0b" : "#ef4444";
        const rankLabel = result.rank === "A" ? "企画OK" : result.rank === "B" ? "営業戻す" : "不適性";
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
                <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>{result.rank === "A" ? "💡" : result.rank === "B" ? "🟡" : "🔴"}</div>
                    <h1 style={{ fontSize: 48, fontWeight: 800, color: rankColor, margin: "0 0 8px" }}>{result.rank}ランク</h1>
                    <p style={{ fontSize: 16, color: "#d1d5db", marginBottom: 16 }}>{rankLabel}</p>
                    <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 24 }}>{result.score} / {result.total} 問正解</p>
                    {result.rank === "A" && <div style={{ padding: 16, borderRadius: 12, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontWeight: 700, fontSize: 16, marginBottom: 24 }}>+{REWARD_POINTS}pt 獲得！</div>}
                    {result.rank !== "A" && <div style={{ padding: 16, borderRadius: 12, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", fontSize: 13, marginBottom: 24 }}>Aランク(90%以上)で +{REWARD_POINTS}pt / 24時間後に再挑戦</div>}
                    <button onClick={() => router.push("/tests")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>テスト一覧へ戻る</button>
                </div>
            </main>
        );
    }

    if (!canRetry) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>⏳</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f59e0b", margin: "0 0 12px" }}>クールダウン中</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 32 }}>前回の受験から24時間経過してから再受験できます</p>
                <button onClick={() => router.push("/tests")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>テスト一覧へ戻る</button>
            </div>
        </main>
    );

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 720, margin: "0 auto" }}>
                <div onClick={() => router.push("/tests")} style={{ fontSize: 12, color: "#ec4899", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", marginBottom: 8 }}>← テスト一覧</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "0 0 4px" }}>💡 企画職適性テスト</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 24px" }}>選択式{CHOICE_QUESTIONS.length}問 + 記述{WRITTEN_QUESTIONS.length}問 / Aランク(90%以上)で +{REWARD_POINTS}pt</p>

                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 11, color: "#ec4899", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>【選択式】</div>
                    {CHOICE_QUESTIONS.map((q, i) => (
                        <div key={i} style={{ marginBottom: 20, padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 10 }}>Q{i + 1}. {q.q}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {q.options.map((opt, j) => (
                                    <label key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: answers[i] === j ? "rgba(236,72,153,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${answers[i] === j ? "rgba(236,72,153,0.4)" : "rgba(255,255,255,0.05)"}`, cursor: "pointer", fontSize: 13, color: "#d1d5db" }}>
                                        <input type="radio" checked={answers[i] === j} onChange={() => setAnswers(prev => prev.map((a, idx) => idx === i ? j : a))} style={{ accentColor: "#ec4899" }} />
                                        {String.fromCharCode(65 + j)}. {opt}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 11, color: "#ec4899", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>【記述式（採点対象外・自己振り返り用）】</div>
                    {WRITTEN_QUESTIONS.map((q, i) => (
                        <div key={i} style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#d1d5db", marginBottom: 6 }}>Q{CHOICE_QUESTIONS.length + i + 1}. {q}</div>
                            <textarea value={written[i]} onChange={(e) => setWritten(prev => prev.map((w, idx) => idx === i ? e.target.value : w))} style={{ width: "100%", minHeight: 70, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                        </div>
                    ))}
                </div>

                <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: "16px 24px", borderRadius: 12, border: "none", background: submitting ? "rgba(236,72,153,0.4)" : "linear-gradient(135deg, #ec4899, #db2777)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer", marginBottom: 12 }}>{submitting ? "採点中..." : "💡 判定する"}</button>
                <p style={{ textAlign: "center", fontSize: 12, color: "#6b7280" }}>A/B/Cでランク判定されます</p>
            </div>
        </main>
    );
}
