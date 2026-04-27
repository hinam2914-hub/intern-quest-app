"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const CHOICE_QUESTIONS = [
    { id: "q1", text: "上司から「今日中にやって」と言われたタスク、あなたの行動は？", options: [{ key: "A", text: "明日でもいいかなと思う" }, { key: "B", text: "ギリギリで終わらせる" }, { key: "C", text: "できるだけ早く終わらせる" }, { key: "D", text: "最優先で即着手し、早めに完了報告する" }], answer: "D" },
    { id: "q2", text: "ミスをしたときの最適な行動は？", options: [{ key: "A", text: "バレないようにする" }, { key: "B", text: "指摘されたら謝る" }, { key: "C", text: "自分で修正する" }, { key: "D", text: "即報告＋原因＋再発防止を伝える" }], answer: "D" },
    { id: "q3", text: "「報連相」で最も重要なのは？", options: [{ key: "A", text: "報告だけ" }, { key: "B", text: "連絡だけ" }, { key: "C", text: "相談だけ" }, { key: "D", text: "スピード" }], answer: "D" },
    { id: "q4", text: "仕事が終わった後の行動は？", options: [{ key: "A", text: "何も言わず帰る" }, { key: "B", text: "スマホを見る" }, { key: "C", text: "指示待ちする" }, { key: "D", text: "「次何やりますか？」と聞く" }], answer: "D" },
    { id: "q5", text: "成果を出す人の特徴は？", options: [{ key: "A", text: "頭がいい" }, { key: "B", text: "センスがある" }, { key: "C", text: "コネがある" }, { key: "D", text: "行動量が多い" }], answer: "D" },
    { id: "q6", text: "遅刻しそうなときは？", options: [{ key: "A", text: "黙って急ぐ" }, { key: "B", text: "遅れてから謝る" }, { key: "C", text: "理由を考える" }, { key: "D", text: "事前に連絡＋到着予定を伝える" }], answer: "D" },
    { id: "q7", text: "指示を受けたときの正しい行動は？", options: [{ key: "A", text: "なんとなく理解する" }, { key: "B", text: "とりあえずやる" }, { key: "C", text: "メモだけする" }, { key: "D", text: "復唱して認識を合わせる" }], answer: "D" },
    { id: "q8", text: "結果が出ないときにやるべきことは？", options: [{ key: "A", text: "やめる" }, { key: "B", text: "言い訳する" }, { key: "C", text: "気合いを入れる" }, { key: "D", text: "改善して行動量を増やす" }], answer: "D" },
    { id: "q9", text: "仕事における「信頼」とは？", options: [{ key: "A", text: "仲がいいこと" }, { key: "B", text: "話が面白いこと" }, { key: "C", text: "頭がいいこと" }, { key: "D", text: "約束を守ること" }], answer: "D" },
    { id: "q10", text: "成長が早い人の特徴は？", options: [{ key: "A", text: "自信がある" }, { key: "B", text: "才能がある" }, { key: "C", text: "プライドが高い" }, { key: "D", text: "素直" }], answer: "D" },
    { id: "q11", text: "先輩が忙しそうなときは？", options: [{ key: "A", text: "声をかけない" }, { key: "B", text: "後回しにする" }, { key: "C", text: "自分で考える" }, { key: "D", text: "タイミング見て簡潔に聞く" }], answer: "D" },
    { id: "q12", text: "タスクが終わらないときは？", options: [{ key: "A", text: "無言で残業" }, { key: "B", text: "明日やる" }, { key: "C", text: "言い訳する" }, { key: "D", text: "早めに相談する" }], answer: "D" },
    { id: "q13", text: "チームの雰囲気が悪いときは？", options: [{ key: "A", text: "無視する" }, { key: "B", text: "他人のせいにする" }, { key: "C", text: "何もしない" }, { key: "D", text: "一言ポジティブな発言をする" }], answer: "D" },
    { id: "q14", text: "上司からのフィードバックに対しては？", options: [{ key: "A", text: "反論する" }, { key: "B", text: "落ち込む" }, { key: "C", text: "無視する" }, { key: "D", text: "素直に受け入れて改善" }], answer: "D" },
    { id: "q15", text: "結果が出ている人に対しては？", options: [{ key: "A", text: "嫉妬する" }, { key: "B", text: "無視する" }, { key: "C", text: "距離を取る" }, { key: "D", text: "真似する" }], answer: "D" },
];

const WRITTEN_QUESTIONS = [
    { id: "q16", text: "「信頼を得るために必要な行動」を3つ書いてください" },
    { id: "q17", text: "「成長が早い人の特徴」を具体的に説明してください" },
    { id: "q18", text: "「なぜ報連相は重要なのか？」を説明してください" },
    { id: "q19", text: "「自分がこれまでにサボった経験」と「改善策」を書いてください" },
    { id: "q20", text: "「今の自分に足りないもの」と「それをどう補うか」" },
    { id: "q21", text: "「このインターンで得たいもの」" },
];

const PASS_POINTS = 500;
const PASS_THRESHOLD = 12;
const COOLDOWN_HOURS = 24;

export default function QuizPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string>("");
    const [quizPassed, setQuizPassed] = useState(false);
    const [lastAttemptAt, setLastAttemptAt] = useState<string | null>(null);
    const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [written, setWritten] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ passed: boolean; score: number } | null>(null);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);

            const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
            if ((profile as any)?.quiz_passed) {
                setQuizPassed(true);
                setLoading(false);
                return;
            }

            const { data: attempts } = await supabase.from("quiz_attempts").select("created_at, passed").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
            if (attempts && attempts.length > 0) {
                const last = attempts[0];
                setLastAttemptAt(last.created_at);
                if (!last.passed) {
                    const elapsedMs = Date.now() - new Date(last.created_at).getTime();
                    const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
                    if (elapsedMs < cooldownMs) {
                        setCooldownRemaining(Math.ceil((cooldownMs - elapsedMs) / (60 * 60 * 1000)));
                    }
                }
            }
            setLoading(false);
        };
        load();
    }, [router]);

    const handleSubmit = async () => {
        if (submitting) return;
        const unanswered = CHOICE_QUESTIONS.filter(q => !answers[q.id]);
        if (unanswered.length > 0) {
            alert(`選択問題が${unanswered.length}問未回答です`);
            return;
        }
        const unwritten = WRITTEN_QUESTIONS.filter(q => !written[q.id]?.trim());
        if (unwritten.length > 0) {
            alert(`記述問題が${unwritten.length}問未記入です`);
            return;
        }

        setSubmitting(true);
        const score = CHOICE_QUESTIONS.filter(q => answers[q.id] === q.answer).length;
        const passed = score >= PASS_THRESHOLD;

        await supabase.from("quiz_attempts").insert({
            user_id: userId,
            score,
            passed,
            answers,
            written_answers: written,
        });

        if (passed) {
            await supabase.from("profiles").update({ quiz_passed: true, quiz_passed_at: new Date().toISOString() }).eq("id", userId);
            const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", userId).single();
            const currentPoints = pointRow?.points || 0;
            await supabase.from("user_points").update({ points: currentPoints + PASS_POINTS }).eq("id", userId);
            await supabase.from("points_history").insert({
                user_id: userId,
                change: PASS_POINTS,
                reason: "quiz_passed",
                created_at: new Date().toISOString(),
            });
        }

        setResult({ passed, score });
        setSubmitting(false);
    };

    if (loading) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
        </main>
    );

    if (quizPassed) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ maxWidth: 500, textAlign: "center" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>🎓</div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f9fafb", marginBottom: 12 }}>確認ワークテスト 合格済み</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 32, lineHeight: 1.7 }}>あなたは既にこのテストに合格しています。<br />価値観を日々の行動に活かしていきましょう。</p>
                <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>メニューへ戻る</button>
            </div>
        </main>
    );

    if (cooldownRemaining > 0) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ maxWidth: 500, textAlign: "center" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>⏳</div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f9fafb", marginBottom: 12 }}>再受験まで {cooldownRemaining} 時間</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 32, lineHeight: 1.7 }}>前回の不合格から24時間経過後に再受験できます。<br />時間を置いてじっくり考えましょう。</p>
                <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>メニューへ戻る</button>
            </div>
        </main>
    );

    if (result) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ maxWidth: 500, textAlign: "center" }}>
                <div style={{ fontSize: 72, marginBottom: 16 }}>{result.passed ? "🎉" : "💪"}</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: result.passed ? "#10b981" : "#f59e0b", marginBottom: 8 }}>{result.passed ? "合格！" : "不合格"}</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 8 }}>スコア: {result.score} / 15 問</p>
                {result.passed ? (
                    <p style={{ color: "#10b981", fontSize: 16, fontWeight: 700, marginBottom: 32 }}>+ {PASS_POINTS} pt 獲得！</p>
                ) : (
                    <p style={{ color: "#f59e0b", fontSize: 14, marginBottom: 32, lineHeight: 1.7 }}>合格ラインは {PASS_THRESHOLD}/15 問正解です<br />24時間後に再受験できます</p>
                )}
                <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>メニューへ戻る</button>
            </div>
        </main>
    );

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 720, margin: "0 auto" }}>
                <div onClick={() => router.push("/menu")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", marginBottom: 8 }}>INTERN QUEST</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "0 0 4px" }}>🧠🧠 確認ワークテスト</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 32 }}>価値観と仕事の基本を確認するテストです。選択式15問＋記述式6問。合格ラインは選択式12問以上正解。</p>

                <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
                    <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>📝 選択式（全15問）</div>
                    {CHOICE_QUESTIONS.map((q, idx) => (
                        <div key={q.id} style={{ marginBottom: 24 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>Q{idx + 1}. {q.text}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {q.options.map(opt => (
                                    <label key={opt.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: answers[q.id] === opt.key ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.03)", border: answers[q.id] === opt.key ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)", cursor: "pointer", transition: "all 0.15s" }}>
                                        <input type="radio" name={q.id} value={opt.key} checked={answers[q.id] === opt.key} onChange={() => setAnswers(prev => ({ ...prev, [q.id]: opt.key }))} style={{ accentColor: "#6366f1" }} />
                                        <span style={{ fontSize: 14, color: "#d1d5db" }}><strong style={{ color: "#818cf8", marginRight: 8 }}>{opt.key}.</strong>{opt.text}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
                    <div style={{ fontSize: 11, color: "#a78bfa", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>✍️ 記述式（全6問）</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>自分の言葉で、具体的に書いてください</div>
                    {WRITTEN_QUESTIONS.map((q, idx) => (
                        <div key={q.id} style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 8 }}>Q{idx + 16}. {q.text}</div>
                            <textarea value={written[q.id] || ""} onChange={(e) => setWritten(prev => ({ ...prev, [q.id]: e.target.value }))} style={{ width: "100%", minHeight: 80, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.6 }} placeholder="自由記述..." />
                        </div>
                    ))}
                </div>

                <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: "16px 24px", borderRadius: 12, border: "none", background: submitting ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer", marginBottom: 12 }}>
                    {submitting ? "採点中..." : "📝 提出する"}
                </button>
                <p style={{ textAlign: "center", fontSize: 12, color: "#6b7280" }}>提出後は結果画面が表示されます。不合格の場合、24時間後に再受験可能です。</p>
            </div>
        </main>
    );
}
