"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Q = { q: string; options: string[]; correct: number };

const CHOICE_QUESTIONS: Q[] = [
    { q: "メンターの役割として最も適切なのは？", options: ["答えを教える", "指示を出す", "管理する", "気づきを与えて行動させる"], correct: 3 },
    { q: "後輩が悩んでいるときの最適な対応は？", options: ["答えを教える", "励ますだけ", "放置する", "質問して思考を引き出す"], correct: 3 },
    { q: "メンターが最も意識すべきことは？", options: ["自分の成果", "評価されること", "仲良くすること", "相手の成長"], correct: 3 },
    { q: "後輩がミスしたときの対応は？", options: ["叱る", "無視", "自分でやり直す", "原因を一緒に考えさせる"], correct: 3 },
    { q: "「良い指導」とは？", options: ["厳しく言う", "優しくする", "具体的に教える", "相手が自走できる状態を作る"], correct: 3 },
    { q: "後輩が行動しないときは？", options: ["怒る", "放置", "諦める", "行動しやすい環境・分解を作る"], correct: 3 },
    { q: "メンターとしてNGな行動は？", options: ["質問する", "フィードバックする", "一緒に考える", "答えを全部与える"], correct: 3 },
    { q: "後輩が結果を出したときは？", options: ["何もしない", "自分の手柄にする", "軽く褒める", "成果を認め、再現性を言語化させる"], correct: 3 },
    { q: "メンターの評価基準は？", options: ["自分の売上", "コミュ力", "忙しさ", "担当メンバーの成長"], correct: 3 },
    { q: "教えるときに重要なことは？", options: ["情報量", "スピード", "正確さ", "相手の理解度に合わせる"], correct: 3 },
    { q: "後輩が「分からない」と言ってきたときは？", options: ["すぐ答えを教える", "無視", "自分で調べろと言う", "どこまで分かってるか確認する"], correct: 3 },
    { q: "後輩が同じミスを繰り返すときは？", options: ["怒る", "放置", "見限る", "原因（理解不足 or 仕組み）を特定"], correct: 3 },
    { q: "やる気が低い後輩には？", options: ["気合いを入れる", "無視", "評価を下げる", "小さな成功体験を作る"], correct: 3 },
    { q: "後輩が成果を出せないときは？", options: ["センスがないと思う", "努力不足と決めつける", "放置する", "行動量・質・方向を分解する"], correct: 3 },
    { q: "メンターとして一番避けるべきは？", options: ["指導すること", "厳しくすること", "優しくすること", "相手の成長を止めること"], correct: 3 },
];

const WRITTEN_QUESTIONS = [
    "「後輩を成長させるために必要な要素」を3つ書いてください",
    "「教える」と「育てる」の違いを説明してください",
    "「後輩が動かない原因」とその解決策を書いてください",
    "「自分のメンタリングの課題」と改善策を書いてください",
    "「後輩が成果を出すためにメンターができること」を具体的に書いてください",
    "「信頼されるメンターとはどんな人か」を定義してください",
];

const PASS_THRESHOLD = 0.85;
const REWARD_POINTS = 500;
const TEST_KEY = "mentor";

export default function MentorTestPage() {
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
            const { data: p } = await supabase.from("profiles").select("mentor_passed").eq("id", user.id).maybeSingle();
            if ((p as any)?.mentor_passed) { setAlreadyPassed(true); setLoading(false); return; }
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

        await supabase.from("test_attempts").insert({ user_id: userId, test_key: TEST_KEY, score: Math.round(score * 100), passed, written_answers: written });

        if (passed) {
            await supabase.from("profiles").update({ mentor_passed: true, mentor_passed_at: new Date().toISOString() }).eq("id", userId);
            const { data: ptRow } = await supabase.from("user_points").select("points").eq("id", userId).maybeSingle();
            const currentPt = ptRow?.points || 0;
            await supabase.from("user_points").upsert({ id: userId, points: currentPt + REWARD_POINTS });
            await supabase.from("points_history").insert({ user_id: userId, change: REWARD_POINTS, reason: "メンターテスト合格" });
        }

        setResult({ passed, score: correctCount, total: CHOICE_QUESTIONS.length });
        setSubmitting(false);
    };

    if (loading) return <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#10b981", fontSize: 18, fontWeight: 700 }}>Loading...</div></main>;

    if (alreadyPassed) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>🌱</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#10b981", margin: "0 0 12px" }}>合格済み</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 32 }}>あなたはすでにメンターテストに合格しています</p>
                <button onClick={() => router.push("/tests")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>テスト一覧へ戻る</button>
            </div>
        </main>
    );

    if (result) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>{result.passed ? "��" : "😢"}</div>
                <h1 style={{ fontSize: 32, fontWeight: 800, color: result.passed ? "#10b981" : "#ef4444", margin: "0 0 12px" }}>{result.passed ? "合格！" : "不合格"}</h1>
                <p style={{ color: "#f9fafb", fontSize: 18, marginBottom: 8 }}>{result.score} / {result.total} 問正解</p>
                <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 24 }}>合格ライン: {Math.round(PASS_THRESHOLD * 100)}%</p>
                {result.passed && <div style={{ padding: 16, borderRadius: 12, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontWeight: 700, fontSize: 16, marginBottom: 24 }}>+{REWARD_POINTS}pt 獲得！</div>}
                {!result.passed && <div style={{ padding: 16, borderRadius: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: 13, marginBottom: 24 }}>24時間後に再受験できます</div>}
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
                <div onClick={() => router.push("/tests")} style={{ fontSize: 12, color: "#10b981", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", marginBottom: 8 }}>← テスト一覧</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "0 0 4px" }}>🌱 メンターテスト</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 24px" }}>選択式{CHOICE_QUESTIONS.length}問 + 記述{WRITTEN_QUESTIONS.length}問 / 合格: {Math.round(PASS_THRESHOLD * 100)}%以上で +{REWARD_POINTS}pt</p>

                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>【選択式】</div>
                    {CHOICE_QUESTIONS.map((q, i) => (
                        <div key={i} style={{ marginBottom: 20, padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 10 }}>Q{i + 1}. {q.q}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {q.options.map((opt, j) => (
                                    <label key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: answers[i] === j ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${answers[i] === j ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.05)"}`, cursor: "pointer", fontSize: 13, color: "#d1d5db" }}>
                                        <input type="radio" checked={answers[i] === j} onChange={() => setAnswers(prev => prev.map((a, idx) => idx === i ? j : a))} style={{ accentColor: "#10b981" }} />
                                        {String.fromCharCode(65 + j)}. {opt}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>【記述式（採点対象外・自己振り返り用）】</div>
                    {WRITTEN_QUESTIONS.map((q, i) => (
                        <div key={i} style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#d1d5db", marginBottom: 6 }}>Q{CHOICE_QUESTIONS.length + i + 1}. {q}</div>
                            <textarea value={written[i]} onChange={(e) => setWritten(prev => prev.map((w, idx) => idx === i ? e.target.value : w))} style={{ width: "100%", minHeight: 70, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                        </div>
                    ))}
                </div>

                <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: "16px 24px", borderRadius: 12, border: "none", background: submitting ? "rgba(16,185,129,0.4)" : "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer", marginBottom: 12 }}>{submitting ? "採点中..." : "📝 提出する"}</button>
                <p style={{ textAlign: "center", fontSize: 12, color: "#6b7280" }}>提出後は結果画面が表示されます</p>
            </div>
        </main>
    );
}
