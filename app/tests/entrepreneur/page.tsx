"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Q = { q: string; options: string[]; correct: number };

const CHOICE_QUESTIONS: Q[] = [
    { q: "起業の目的として最も適切なのは？", options: ["自由になりたい", "モテたい", "稼ぎたい", "価値提供で利益を出す"], correct: 3 },
    { q: "起業に必要な最重要スキルは？", options: ["アイデア", "学歴", "コネ", "売る力"], correct: 3 },
    { q: "収益が出ない状態が続いたときは？", options: ["やめる", "運が悪いと思う", "環境を変える", "仮説検証を回す"], correct: 3 },
    { q: "起業におけるリスクとは？", options: ["失敗すること", "お金が減ること", "周りに否定されること", "行動しないこと"], correct: 3 },
    { q: "起業する前に必要な状態は？", options: ["完璧な準備", "自信", "仲間", "小さく稼いだ経験"], correct: 3 },
    { q: "会社を伸ばすために必要なのは？", options: ["気合い", "モチベーション", "センス", "再現性ある仕組み"], correct: 3 },
    { q: "失敗したときの正しい姿勢は？", options: ["落ち込む", "言い訳する", "他責にする", "学習して次に活かす"], correct: 3 },
    { q: "起業で成功する人の特徴は？", options: ["才能", "運", "学歴", "継続力"], correct: 3 },
    { q: "お金を稼ぐ本質は？", options: ["努力", "運", "人脈", "価値提供"], correct: 3 },
    { q: "起業するタイミングとして最適なのは？", options: ["思いついたとき", "ノリ", "周りがやってるから", "売れる状態が作れたとき"], correct: 3 },
    { q: "月1円も稼げてない状態で起業するべき？", options: ["すぐやる", "とりあえずやる", "勢いでやる", "まず小さく稼ぐ"], correct: 3 },
    { q: "営業が苦手な人は？", options: ["他人に任せる", "やらない", "向いてない", "まず自分でやる"], correct: 3 },
    { q: "事業がうまくいかないときは？", options: ["アイデアが悪い", "市場が悪い", "タイミングが悪い", "仮説検証不足"], correct: 3 },
    { q: "時間がない人は起業できる？", options: ["できない", "難しい", "条件次第", "時間を作れる人だけできる"], correct: 3 },
    { q: "起業に向いている人は？", options: ["頭がいい人", "センスある人", "お金ある人", "行動し続ける人"], correct: 3 },
];

const WRITTEN_QUESTIONS = [
    "「なぜ起業したいのか」を書いてください",
    "「今すぐ売れるものは何か」を具体的に書いてください",
    "「自分が提供できる価値」を説明してください",
    "「今の自分のスキルでお金を生む方法」を書いてください",
    "「起業して失敗する原因」とそれをどう防ぐか",
    "「起業しない場合の人生」と「起業した場合の人生」を比較してください",
];

const A_THRESHOLD = 0.90;
const REWARD_POINTS = 500;
const TEST_KEY = "entrepreneur";

export default function EntrepreneurTestPage() {
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
            const { data: p } = await supabase.from("profiles").select("entrepreneur_passed").eq("id", user.id).maybeSingle();
            if ((p as any)?.entrepreneur_passed) { setAlreadyPassed(true); setLoading(false); return; }
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
            await supabase.from("profiles").update({ entrepreneur_passed: true, entrepreneur_passed_at: new Date().toISOString() }).eq("id", userId);
            const { data: ptRow } = await supabase.from("user_points").select("points").eq("id", userId).maybeSingle();
            const currentPt = ptRow?.points || 0;
            await supabase.from("user_points").upsert({ id: userId, points: currentPt + REWARD_POINTS });
            await supabase.from("points_history").insert({ user_id: userId, change: REWARD_POINTS, reason: "起業適性テスト Aランク合格" });
        }

        setResult({ rank, score: correctCount, total: CHOICE_QUESTIONS.length });
        setSubmitting(false);
    };

    if (loading) return <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#f59e0b", fontSize: 18, fontWeight: 700 }}>Loading...</div></main>;

    if (alreadyPassed) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>🚀</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f59e0b", margin: "0 0 12px" }}>Aランク済み</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 32 }}>あなたはすでに起業適性Aランクに認定されています</p>
                <button onClick={() => router.push("/tests")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>テスト一覧へ戻る</button>
            </div>
        </main>
    );

    if (result) {
        const rankColor = result.rank === "A" ? "#10b981" : result.rank === "B" ? "#f59e0b" : "#ef4444";
        const rankLabel = result.rank === "A" ? "即起業OK" : result.rank === "B" ? "準備フェーズ（副業で検証）" : "まだやるな（基礎育成）";
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
                <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>{result.rank === "A" ? "🚀" : result.rank === "B" ? "🟡" : "🔴"}</div>
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
                <div onClick={() => router.push("/tests")} style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", marginBottom: 8 }}>← テスト一覧</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "0 0 4px" }}>🚀 起業適性テスト</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 24px" }}>選択式{CHOICE_QUESTIONS.length}問 + 記述{WRITTEN_QUESTIONS.length}問 / Aランク(90%以上)で +{REWARD_POINTS}pt</p>

                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>【選択式】</div>
                    {CHOICE_QUESTIONS.map((q, i) => (
                        <div key={i} style={{ marginBottom: 20, padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 10 }}>Q{i + 1}. {q.q}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {q.options.map((opt, j) => (
                                    <label key={j} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: answers[i] === j ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${answers[i] === j ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.05)"}`, cursor: "pointer", fontSize: 13, color: "#d1d5db" }}>
                                        <input type="radio" checked={answers[i] === j} onChange={() => setAnswers(prev => prev.map((a, idx) => idx === i ? j : a))} style={{ accentColor: "#f59e0b" }} />
                                        {String.fromCharCode(65 + j)}. {opt}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>【記述式（採点対象外・自己振り返り用）】</div>
                    {WRITTEN_QUESTIONS.map((q, i) => (
                        <div key={i} style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#d1d5db", marginBottom: 6 }}>Q{CHOICE_QUESTIONS.length + i + 1}. {q}</div>
                            <textarea value={written[i]} onChange={(e) => setWritten(prev => prev.map((w, idx) => idx === i ? e.target.value : w))} style={{ width: "100%", minHeight: 70, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                        </div>
                    ))}
                </div>

                <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: "16px 24px", borderRadius: 12, border: "none", background: submitting ? "rgba(245,158,11,0.4)" : "linear-gradient(135deg, #f59e0b, #dc8a0c)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer", marginBottom: 12 }}>{submitting ? "採点中..." : "🚀 判定する"}</button>
                <p style={{ textAlign: "center", fontSize: 12, color: "#6b7280" }}>A/B/Cでランク判定されます</p>
            </div>
        </main>
    );
}
