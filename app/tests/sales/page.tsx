"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Q = { q: string; options: string[]; correct: number };

const CHOICE_QUESTIONS: Q[] = [
    { q: "営業の本質に最も近いものは？", options: ["商品を正しく説明すること", "相手の課題を引き出して解決すること", "トークで納得させること", "数をこなして慣れること"], correct: 1 },
    { q: "初対面で一番やるべきことは？", options: ["商品の強みを説明する", "雑談で距離を縮める", "相手の状況を把握する", "いきなり提案する"], correct: 2 },
    { q: "断られたとき最も成長につながる行動は？", options: ["気持ちを切り替えて次へ行く", "しつこく粘る", "理由を深掘りして改善する", "落ち込んで反省する"], correct: 2 },
    { q: "営業で最短で成果出す方法は？", options: ["トークを磨く", "商品知識を増やす", "成功している人を真似する", "センスを磨く"], correct: 2 },
    { q: "ヒアリングで最も重要なのは？", options: ["質問の数", "会話のテンポ", "メモを取ること", "本音を引き出すこと"], correct: 3 },
    { q: "「売れない原因」で一番多いのは？", options: ["商品が弱い", "タイミングが悪い", "ヒアリング不足", "相手が悪い"], correct: 2 },
    { q: "クロージングの役割として正しいのは？", options: ["商品をもう一度説明する", "相手を説得する", "相手の意思決定をサポートする", "無理やり契約させる"], correct: 2 },
    { q: "営業で最も信頼を落とす行動は？", options: ["緊張する", "話が詰まる", "少しミスする", "嘘をつく"], correct: 3 },
    { q: "成果が出る人の特徴は？", options: ["トークがうまい", "行動量が多い", "頭がいい", "見た目がいい"], correct: 1 },
    { q: "営業で一番伸びる人は？", options: ["自信がある人", "ポジティブな人", "素直な人", "負けず嫌いな人"], correct: 2 },
    { q: "お客様が無口で反応が薄いときは？", options: ["自分が話し続ける", "雑談を増やす", "一旦諦める", "質問を変えて反応を見る"], correct: 3 },
    { q: "「今はいいです」と言われたときは？", options: ["すぐ引く", "強引に押す", "一旦納得する", "理由を優しく聞く"], correct: 3 },
    { q: "商談前にやるべきことは？", options: ["商品資料を読む", "トークを暗記する", "想定質問と回答を準備", "気合い入れる"], correct: 2 },
    { q: "成果が出ないときの行動は？", options: ["気合いを入れる", "とりあえず数増やす", "他人と比較する", "数とやり方を両方見直す"], correct: 3 },
    { q: "ロープレの正しい使い方は？", options: ["形式的にやる", "とりあえず回数こなす", "先輩に見せるためにやる", "本番で詰まりそうな部分を潰す"], correct: 3 },
];

const WRITTEN_QUESTIONS = [
    "営業で「信頼を得る行動」を3つ書いてください",
    "なぜ営業は断られるのか説明してください",
    "ヒアリングで聞くべき内容を3つ書いてください",
    "自分が営業でつまずきそうなポイントと対策",
    "1ヶ月で成果を出すための行動計画",
    "なぜ営業をやるのか",
];

const A_THRESHOLD = 0.85;
const REWARD_POINTS = 500;
const TEST_KEY = "sales";

export default function SalesTestPage() {
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
            const { data: p } = await supabase.from("profiles").select("sales_passed").eq("id", user.id).maybeSingle();
            if ((p as any)?.sales_passed) { setAlreadyPassed(true); setLoading(false); return; }
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
        else if (score >= 0.70) rank = "B";
        const passed = rank === "A";

        await supabase.from("test_attempts").insert({ user_id: userId, test_key: TEST_KEY, score: Math.round(score * 100), passed, written_answers: written });

        if (passed) {
            await supabase.from("profiles").update({ sales_passed: true, sales_passed_at: new Date().toISOString() }).eq("id", userId);
            const { data: ptRow } = await supabase.from("user_points").select("points").eq("id", userId).maybeSingle();
            const currentPt = ptRow?.points || 0;
            await supabase.from("user_points").upsert({ id: userId, points: currentPt + REWARD_POINTS });
            await supabase.from("points_history").insert({ user_id: userId, change: REWARD_POINTS, reason: "営業デビュー適性テスト Aランク合格" });
        }

        setResult({ rank, score: correctCount, total: CHOICE_QUESTIONS.length });
        setSubmitting(false);
    };

    if (loading) return <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#8b5cf6", fontSize: 18, fontWeight: 700 }}>Loading...</div></main>;

    if (alreadyPassed) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>💼</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#8b5cf6", margin: "0 0 12px" }}>Aランク済み</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 32 }}>あなたはすでに営業デビュー適性Aランクに認定されています</p>
                <button onClick={() => router.push("/tests")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>テスト一覧へ戻る</button>
            </div>
        </main>
    );

    if (result) {
        const rankColor = result.rank === "A" ? "#10b981" : result.rank === "B" ? "#f59e0b" : "#ef4444";
        const rankLabel = result.rank === "A" ? "即デビューOK" : result.rank === "B" ? "ロープレ強化" : "基礎から";
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
                <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>{result.rank === "A" ? "💼" : result.rank === "B" ? "🟡" : "🔴"}</div>
                    <h1 style={{ fontSize: 48, fontWeight: 800, color: rankColor, margin: "0 0 8px" }}>{result.rank}ランク</h1>
                    <p style={{ fontSize: 16, color: "#d1d5db", marginBottom: 16 }}>{rankLabel}</p>
                    <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 24 }}>{result.score} / {result.total} 問正解</p>
                    {result.rank === "A" && <div style={{ padding: 16, borderRadius: 12, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontWeight: 700, fontSize: 16, marginBottom: 24 }}>+{REWARD_POINTS}pt 獲得！</div>}
                    {result.rank !== "A" && <div style={{ padding: 16, borderRadius: 12, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", fontSize: 13, marginBottom: 24 }}>Aランク(85%以上)で +{REWARD_POINTS}pt / 24時間後に再挑戦</div>}
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
                <div onClick={() => router.push("/tests")} style={{ fontSize: 12, color: "#8b5cf6", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", marginBottom: 8 }}>← テスト一覧</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "0 0 4px" }}>💼 営業デビュー適性テスト</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 24px" }}>選択式{CHOICE_QUESTIONS.length}問 + 記述{WRITTEN_QUESTIONS.length}問 / Aランク(85%以上)で +{REWARD_POINTS}pt</p>

                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>【選択式】</div>
                    {CHOICE_QUESTIONS.map((q, i) => (
                        <div key={i} style={{ marginBottom: 20, padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 10 }}>Q{i + 1}. {q.q}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {q.options.map((opt, j) => (
                                    <label key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: answers[i] === j ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${answers[i] === j ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.05)"}`, cursor: "pointer", fontSize: 13, color: "#d1d5db" }}>
                                        <input type="radio" checked={answers[i] === j} onChange={() => setAnswers(prev => prev.map((a, idx) => idx === i ? j : a))} style={{ accentColor: "#8b5cf6" }} />
                                        {String.fromCharCode(65 + j)}. {opt}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>【記述式（採点対象外・自己振り返り用）】</div>
                    {WRITTEN_QUESTIONS.map((q, i) => (
                        <div key={i} style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#d1d5db", marginBottom: 6 }}>Q{CHOICE_QUESTIONS.length + i + 1}. {q}</div>
                            <textarea value={written[i]} onChange={(e) => setWritten(prev => prev.map((w, idx) => idx === i ? e.target.value : w))} style={{ width: "100%", minHeight: 70, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                        </div>
                    ))}
                </div>

                <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: "16px 24px", borderRadius: 12, border: "none", background: submitting ? "rgba(139,92,246,0.4)" : "linear-gradient(135deg, #8b5cf6, #7c3aed)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer", marginBottom: 12 }}>{submitting ? "採点中..." : "💼 判定する"}</button>
                <p style={{ textAlign: "center", fontSize: 12, color: "#6b7280" }}>A/B/Cでランク判定されます</p>
            </div>
        </main>
    );
}
