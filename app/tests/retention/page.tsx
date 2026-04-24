"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Q = { q: string; options: string[]; correct: number };

const CHOICE_QUESTIONS: Q[] = [
    { q: "「成長したい」と言いながら行動しない人はどうなる？", options: ["いつか成長する", "環境次第で変わる", "タイミングの問題", "一生そのまま"], correct: 3 },
    { q: "Dot.Aで評価される人は？", options: ["いい人", "面白い人", "頭がいい人", "行動し続ける人"], correct: 3 },
    { q: "結果が出ないときの正しい考え方は？", options: ["向いてない", "環境が悪い", "タイミングが悪い", "自分の行動が足りない"], correct: 3 },
    { q: "「忙しいのでできません」は？", options: ["正当な理由", "状況次第", "仕方ない", "優先順位の問題"], correct: 3 },
    { q: "この環境で最も重要なことは？", options: ["楽しさ", "人間関係", "居心地", "成長と成果"], correct: 3 },
    { q: "ミスをしたときの正しい姿勢は？", options: ["隠す", "言い訳する", "気にしない", "即報告＋改善"], correct: 3 },
    { q: "続けられる人の特徴は？", options: ["モチベが高い", "時間がある", "センスがある", "習慣化している"], correct: 3 },
    { q: "Dot.Aに残るべき人は？", options: ["楽しいからいる人", "なんとなくいる人", "他に行くところがない人", "成長と成果にコミットできる人"], correct: 3 },
    { q: "結果を出す人の行動は？", options: ["気分でやる", "やる気のあるときだけやる", "周りに合わせる", "毎日やる"], correct: 3 },
    { q: "「向いてない」と感じたときは？", options: ["やめる", "休む", "誰かのせいにする", "改善して試す"], correct: 3 },
    { q: "1週間稼働できなかった場合は？", options: ["仕方ない", "来週頑張る", "忘れる", "理由を分析し再発防止"], correct: 3 },
    { q: "数字が未達だったときは？", options: ["落ち込む", "言い訳する", "放置", "行動量と質を見直す"], correct: 3 },
    { q: "指示されたことしかやらない人は？", options: ["普通", "問題ない", "悪くない", "成長が止まる"], correct: 3 },
    { q: "周りが頑張っていないときは？", options: ["合わせる", "サボる", "文句言う", "自分はやる"], correct: 3 },
    { q: "この環境で最終的に得るべきものは？", options: ["友達", "思い出", "楽しさ", "自分で稼ぐ力"], correct: 3 },
];

const WRITTEN_QUESTIONS = [
    "「なぜ自分はDot.Aに残るべきなのか」を書いてください",
    "「この環境で成果を出すためにやること」を具体的に書いてください",
    "「今の自分の課題」とその改善策を書いてください",
    "「辞める人の特徴」と「自分はどう違うか」",
    "「1ヶ月後に成果を出すための行動計画」",
    "「覚悟」を言語化してください",
];

const PASS_THRESHOLD = 0.90;
const REWARD_POINTS = 1000;
const TEST_KEY = "retention";

export default function RetentionTestPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState("");
    const [alreadyPassed, setAlreadyPassed] = useState(false);
    const [canRetry, setCanRetry] = useState(true);
    const [answers, setAnswers] = useState<(number | null)[]>(Array(CHOICE_QUESTIONS.length).fill(null));
    const [written, setWritten] = useState<string[]>(Array(WRITTEN_QUESTIONS.length).fill(""));
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ passed: boolean; score: number; total: number } | null>(null);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const { data: p } = await supabase.from("profiles").select("retention_passed").eq("id", user.id).maybeSingle();
            if ((p as any)?.retention_passed) { setAlreadyPassed(true); setLoading(false); return; }
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
        const passed = score >= PASS_THRESHOLD;

        await supabase.from("test_attempts").insert({ user_id: userId, test_key: TEST_KEY, score: Math.round(score * 100), passed });

        if (passed) {
            await supabase.from("profiles").update({ retention_passed: true, retention_passed_at: new Date().toISOString() }).eq("id", userId);
            const { data: ptRow } = await supabase.from("user_points").select("points").eq("id", userId).maybeSingle();
            const currentPt = ptRow?.points || 0;
            await supabase.from("user_points").upsert({ id: userId, points: currentPt + REWARD_POINTS });
            await supabase.from("points_history").insert({ user_id: userId, change: REWARD_POINTS, reason: "Dot.A残留判定テスト合格" });
        }

        setResult({ passed, score: correctCount, total: CHOICE_QUESTIONS.length });
        setSubmitting(false);
    };

    if (loading) return <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#ef4444", fontSize: 18, fontWeight: 700 }}>Loading...</div></main>;

    if (alreadyPassed) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>🔥</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#ef4444", margin: "0 0 12px" }}>残留確定</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 32 }}>あなたはすでにDot.A残留判定に合格しています</p>
                <button onClick={() => router.push("/tests")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>テスト一覧へ戻る</button>
            </div>
        </main>
    );

    if (result) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>{result.passed ? "🔥" : "😢"}</div>
                <h1 style={{ fontSize: 32, fontWeight: 800, color: result.passed ? "#ef4444" : "#6b7280", margin: "0 0 12px" }}>{result.passed ? "残留OK" : "不合格"}</h1>
                <p style={{ color: "#f9fafb", fontSize: 18, marginBottom: 8 }}>{result.score} / {result.total} 問正解</p>
                <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 24 }}>合格ライン: {Math.round(PASS_THRESHOLD * 100)}%</p>
                {result.passed && <div style={{ padding: 16, borderRadius: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontWeight: 700, fontSize: 16, marginBottom: 24 }}>+{REWARD_POINTS}pt 獲得！優先育成対象</div>}
                {!result.passed && <div style={{ padding: 16, borderRadius: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: 13, marginBottom: 24 }}>覚悟を見直して24時間後に再挑戦</div>}
                <button onClick={() => router.push("/tests")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>テスト一覧へ戻る</button>
            </div>
        </main>
    );

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
                <div onClick={() => router.push("/tests")} style={{ fontSize: 12, color: "#ef4444", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", marginBottom: 8 }}>← テスト一覧</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "0 0 4px" }}>🔥 Dot.A残留判定テスト</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 24px" }}>選択式{CHOICE_QUESTIONS.length}問 + 記述{WRITTEN_QUESTIONS.length}問 / 合格: {Math.round(PASS_THRESHOLD * 100)}%以上で +{REWARD_POINTS}pt</p>

                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>【選択式】</div>
                    {CHOICE_QUESTIONS.map((q, i) => (
                        <div key={i} style={{ marginBottom: 20, padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 10 }}>Q{i + 1}. {q.q}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {q.options.map((opt, j) => (
                                    <label key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: answers[i] === j ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${answers[i] === j ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.05)"}`, cursor: "pointer", fontSize: 13, color: "#d1d5db" }}>
                                        <input type="radio" checked={answers[i] === j} onChange={() => setAnswers(prev => prev.map((a, idx) => idx === i ? j : a))} style={{ accentColor: "#ef4444" }} />
                                        {String.fromCharCode(65 + j)}. {opt}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>【記述式（採点対象外・覚悟の言語化）】</div>
                    {WRITTEN_QUESTIONS.map((q, i) => (
                        <div key={i} style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#d1d5db", marginBottom: 6 }}>Q{CHOICE_QUESTIONS.length + i + 1}. {q}</div>
                            <textarea value={written[i]} onChange={(e) => setWritten(prev => prev.map((w, idx) => idx === i ? e.target.value : w))} style={{ width: "100%", minHeight: 70, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                        </div>
                    ))}
                </div>

                <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: "16px 24px", borderRadius: 12, border: "none", background: submitting ? "rgba(239,68,68,0.4)" : "linear-gradient(135deg, #ef4444, #dc2626)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer", marginBottom: 12 }}>{submitting ? "採点中..." : "🔥 覚悟を提出する"}</button>
                <p style={{ textAlign: "center", fontSize: 12, color: "#6b7280" }}>提出後は結果画面が表示されます</p>
            </div>
        </main>
    );
}
