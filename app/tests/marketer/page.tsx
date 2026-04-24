"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Q = { q: string; options: string[]; correct: number };

const CHOICE_QUESTIONS: Q[] = [
    { q: "マーケティングの本質は？", options: ["SNS運用", "広告", "ブランディング", "売れる仕組みを作ること"], correct: 3 },
    { q: "売れない原因として最も多いのは？", options: ["デザイン", "商品", "タイミング", "誰に売るか不明確"], correct: 3 },
    { q: "マーケターに最も必要な経験は？", options: ["分析力", "センス", "知識", "営業経験"], correct: 3 },
    { q: "CV（成約）が低いときの改善は？", options: ["投稿増やす", "デザイン変える", "気合い", "導線と訴求を見直す"], correct: 3 },
    { q: "ターゲット設定で重要なのは？", options: ["広さ", "流行", "数", "明確さ"], correct: 3 },
    { q: "良いマーケターの特徴は？", options: ["センス", "アイデア", "知識量", "数字で判断できる"], correct: 3 },
    { q: "売れるコピーとは？", options: ["おしゃれ", "面白い", "長い", "相手の欲求に刺さる"], correct: 3 },
    { q: "マーケターがやってはいけないことは？", options: ["分析", "改善", "テスト", "感覚で決める"], correct: 3 },
    { q: "広告の役割は？", options: ["見せる", "認知", "拡散", "行動させる"], correct: 3 },
    { q: "最も重要な指標は？", options: ["いいね数", "フォロワー数", "インプレッション", "売上"], correct: 3 },
    { q: "フォロワー1万人で売上0の場合は？", options: ["成功", "もう少し頑張る", "投稿増やす", "マーケ失敗"], correct: 3 },
    { q: "売れない商品の改善は？", options: ["諦める", "価格下げる", "広告増やす", "ターゲットと訴求を見直す"], correct: 3 },
    { q: "営業未経験でマーケやりたい人は？", options: ["OK", "センスあればいける", "勉強すればいける", "まず売ってこい"], correct: 3 },
    { q: "数字が悪いときの判断は？", options: ["続ける", "感覚で変える", "放置", "仮説立てて検証"], correct: 3 },
    { q: "SNSマーケで一番重要なのは？", options: ["投稿数", "デザイン", "トレンド", "誰に何を売るか"], correct: 3 },
];

const WRITTEN_QUESTIONS = [
    "「なぜ営業経験がマーケに必要か」を説明してください",
    "「売れない原因」を3つに分解してください",
    "「売れる導線」を具体的に説明してください（例：認知→興味→比較→行動）",
    "「今売っているサービスを売るならどう改善するか」",
    "「1→10に伸ばすためにやること」を書いてください",
    "「自分がマーケターとして不足している点」",
];

const A_THRESHOLD = 0.90;
const REWARD_POINTS = 500;
const TEST_KEY = "marketer";

export default function MarketerTestPage() {
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
            const { data: p } = await supabase.from("profiles").select("marketer_passed").eq("id", user.id).maybeSingle();
            if ((p as any)?.marketer_passed) { setAlreadyPassed(true); setLoading(false); return; }
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
            await supabase.from("profiles").update({ marketer_passed: true, marketer_passed_at: new Date().toISOString() }).eq("id", userId);
            const { data: ptRow } = await supabase.from("user_points").select("points").eq("id", userId).maybeSingle();
            const currentPt = ptRow?.points || 0;
            await supabase.from("user_points").upsert({ id: userId, points: currentPt + REWARD_POINTS });
            await supabase.from("points_history").insert({ user_id: userId, change: REWARD_POINTS, reason: "マーケター適性テスト Aランク合格" });
        }

        setResult({ rank, score: correctCount, total: CHOICE_QUESTIONS.length });
        setSubmitting(false);
    };

    if (loading) return <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#06b6d4", fontSize: 18, fontWeight: 700 }}>Loading...</div></main>;

    if (alreadyPassed) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>📊</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#06b6d4", margin: "0 0 12px" }}>Aランク済み</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 32 }}>あなたはすでにマーケター適性Aランクに認定されています</p>
                <button onClick={() => router.push("/tests")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>テスト一覧へ戻る</button>
            </div>
        </main>
    );

    if (result) {
        const rankColor = result.rank === "A" ? "#10b981" : result.rank === "B" ? "#f59e0b" : "#ef4444";
        const rankLabel = result.rank === "A" ? "マーケOK" : result.rank === "B" ? "まず営業やれ" : "マーケやらせるな（基礎へ）";
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
                <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>{result.rank === "A" ? "📊" : result.rank === "B" ? "🟡" : "🔴"}</div>
                    <h1 style={{ fontSize: 48, fontWeight: 800, color: rankColor, margin: "0 0 8px" }}>{result.rank}ランク</h1>
                    <p style={{ fontSize: 16, color: "#d1d5db", marginBottom: 16 }}>{rankLabel}</p>
                    <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 24 }}>{result.score} / {result.total} 問正解</p>
                    {result.rank === "A" && <div style={{ padding: 16, borderRadius: 12, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontWeight: 700, fontSize: 16, marginBottom: 24 }}>+{REWARD_POINTS}pt 獲得！</div>}
                    {result.rank !== "A" && <div style={{ padding: 16, borderRadius: 12, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", fontSize: 13, marginBottom: 24 }}>Aランクで +{REWARD_POINTS}pt / 24時間後に再挑戦</div>}
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
                <div onClick={() => router.push("/tests")} style={{ fontSize: 12, color: "#06b6d4", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", marginBottom: 8 }}>← テスト一覧</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "0 0 4px" }}>📊 マーケター適性テスト</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 24px" }}>選択式{CHOICE_QUESTIONS.length}問 + 記述{WRITTEN_QUESTIONS.length}問 / Aランク(90%以上)で +{REWARD_POINTS}pt</p>

                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 11, color: "#06b6d4", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>【選択式】</div>
                    {CHOICE_QUESTIONS.map((q, i) => (
                        <div key={i} style={{ marginBottom: 20, padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 10 }}>Q{i + 1}. {q.q}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {q.options.map((opt, j) => (
                                    <label key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: answers[i] === j ? "rgba(6,182,212,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${answers[i] === j ? "rgba(6,182,212,0.4)" : "rgba(255,255,255,0.05)"}`, cursor: "pointer", fontSize: 13, color: "#d1d5db" }}>
                                        <input type="radio" checked={answers[i] === j} onChange={() => setAnswers(prev => prev.map((a, idx) => idx === i ? j : a))} style={{ accentColor: "#06b6d4" }} />
                                        {String.fromCharCode(65 + j)}. {opt}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 11, color: "#06b6d4", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>【記述式（採点対象外・自己振り返り用）】</div>
                    {WRITTEN_QUESTIONS.map((q, i) => (
                        <div key={i} style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#d1d5db", marginBottom: 6 }}>Q{CHOICE_QUESTIONS.length + i + 1}. {q}</div>
                            <textarea value={written[i]} onChange={(e) => setWritten(prev => prev.map((w, idx) => idx === i ? e.target.value : w))} style={{ width: "100%", minHeight: 70, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                        </div>
                    ))}
                </div>

                <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: "16px 24px", borderRadius: 12, border: "none", background: submitting ? "rgba(6,182,212,0.4)" : "linear-gradient(135deg, #06b6d4, #0891b2)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer", marginBottom: 12 }}>{submitting ? "採点中..." : "📊 判定する"}</button>
                <p style={{ textAlign: "center", fontSize: 12, color: "#6b7280" }}>A/B/Cでランク判定されます</p>
            </div>
        </main>
    );
}
