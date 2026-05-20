"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const QUESTIONS = [
    { section: "Part①: 基準編", q: "Q1. 成果を出せない人に多い特徴は？", options: ["A. 才能不足", "B. 環境が悪い", "C. 途中で基準を下げる", "D. 人脈がない"], correct: 2 },
    { section: "Part①: 基準編", q: "Q2. 「まあこれくらいでいいか」を繰り返すと？", options: ["A. 効率的になる", "B. 安定する", "C. 基準がどんどん下がる", "D. メンタルに良い"], correct: 2 },
    { section: "Part①: 基準編", q: "Q3. 強い人の特徴として最も近いのは？", options: ["A. センスがある", "B. 自信がある", "C. 基準を下げない", "D. 怒られない"], correct: 2 },
    { section: "Part①: 基準編", q: "Q4. 継続して伸びる人の特徴は？", options: ["A. 気分で頑張る", "B. 調子いい時だけやる", "C. 最低ラインを高く保つ", "D. 完璧主義"], correct: 2 },
    { section: "Part①: 基準編", q: "Q5. 基準が低い人に起きやすいことは？", options: ["A. 時間に余裕できる", "B. 楽になる", "C. 人生全体が緩む", "D. 人間関係良くなる"], correct: 2 },
    { section: "Part①: 基準編", q: "Q6. 「今日はいいや」が危険な理由は？", options: ["A. 怠けるから", "B. 周りに嫌われるから", "C. 自分との約束が崩れるから", "D. 時間が減るから"], correct: 2 },
    { section: "Part①: 基準編", q: "Q7. 本当に強い人は？", options: ["A. 気合いがある", "B. 才能がある", "C. 当たり前基準が高い", "D. メンタル強い"], correct: 2 },
    { section: "Part①: 基準編", q: "Q8. 妥協しやすい人の特徴は？", options: ["A. 優しい", "B. 疲れてる", "C. 感情で判断する", "D. 真面目"], correct: 2 },
    { section: "Part①: 基準編", q: "Q9. 「最低限やる」を決めるメリットは？", options: ["A. 楽になる", "B. サボれる", "C. 基準が安定する", "D. 時間が増える"], correct: 2 },
    { section: "Part①: 基準編", q: "Q10. 人生で差がつく原因として大きいのは？", options: ["A. IQ", "B. 学歴", "C. 小さい妥協の積み重ね", "D. 人脈"], correct: 2 },
    { section: "Part②: ケーススタディ", q: "Q11. 毎日やると決めたことを今日だけサボりたい時は？", options: ["A. 無理しない", "B. 明日頑張る", "C. 最低ラインだけやる", "D. 気分優先する"], correct: 2 },
    { section: "Part②: ケーススタディ", q: "Q12. 目標数字が未達だった時の正しい考え方は？", options: ["A. 仕方ない", "B. 向いてない", "C. 基準を見直して改善する", "D. 一旦忘れる"], correct: 2 },
    { section: "Part②: ケーススタディ", q: "Q13. 「このくらいでいいか」と思った時に必要なのは？", options: ["A. 休憩", "B. ご褒美", "C. 最初の目標を思い出す", "D. 気分転換"], correct: 2 },
    { section: "Part②: ケーススタディ", q: "Q14. 強い組織の特徴は？", options: ["A. 楽しい", "B. 厳しい", "C. 基準が統一されている", "D. 仲良い"], correct: 2 },
    { section: "Part②: ケーススタディ", q: "Q15. 成長が止まりやすい人は？", options: ["A. 失敗する人", "B. 挑戦する人", "C. 自分を甘やかす人", "D. 無口な人"], correct: 2 },
];

const WRITTEN_QUESTIONS = [
    "Q16. 最近、自分が妥協したことを書いてください",
    "Q17. 基準が高い人の特徴を書いてください",
    "Q18. まあいいかで失敗した経験を書いてください",
    "Q19. 今後、自分が絶対に下げたくない基準を3つ書いてください",
    "Q20. 継続と基準の関係を説明してください",
    "Q21. 5年後に差がつくと思う日常の小さい行動を書いてください",
];

const TEST_CONFIG = {
    type: "standard_keeping",
    title: "⚖️ 基準維持・妥協耐性",
    color: "#f97316",
    passedField: "standard_keeping_passed",
    rewardPoints: 10,
};

export default function TestPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string>("");
    const [answers, setAnswers] = useState<number[]>(new Array(QUESTIONS.length).fill(-1));
    const [writtenAnswers, setWrittenAnswers] = useState<string[]>(new Array(WRITTEN_QUESTIONS.length).fill(""));
    const [submitting, setSubmitting] = useState(false);
    const [alreadyPassed, setAlreadyPassed] = useState(false);
    const [cooldownUntil, setCooldownUntil] = useState<Date | null>(null);
    const [pendingReview, setPendingReview] = useState(false);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);

            const { data: profile } = await supabase.from("profiles").select(TEST_CONFIG.passedField).eq("id", user.id).single();
            if ((profile as any)?.[TEST_CONFIG.passedField]) {
                setAlreadyPassed(true);
                setLoading(false);
                return;
            }

            const { data: lastAttempt } = await supabase
                .from("test_attempts")
                .select("created_at, passed")
                .eq("user_id", user.id)
                .eq("test_key", TEST_CONFIG.type)
                .order("created_at", { ascending: false })
                .limit(1);

            if (lastAttempt && lastAttempt.length > 0) {
                const last = lastAttempt[0] as any;
                if (!last.passed) {
                    const cooldownEnd = new Date(new Date(last.created_at).getTime() + 24 * 60 * 60 * 1000);
                    if (cooldownEnd > new Date()) setCooldownUntil(cooldownEnd);
                }
            }
            setLoading(false);
        };
        load();
    }, [router]);

    const handleSubmit = async () => {
        if (answers.some(a => a === -1)) {
            alert("選択式問題（Q1〜Q15）すべてに回答してください");
            return;
        }
        if (writtenAnswers.every(w => !w.trim())) {
            alert("記述式問題（Q16〜Q21）も少なくとも1問は回答してください");
            return;
        }
        if (!confirm(`提出してよろしいですか？\n\n選択式は自動採点、記述式はadminが評価します。\n全問正解 + admin承認で合格 (+${TEST_CONFIG.rewardPoints}pt)
記述評価で追加 高+30pt / 中+10pt`)) return;

        setSubmitting(true);
        const correctCount = answers.filter((a, i) => a === QUESTIONS[i].correct).length;
        const passedSelection = correctCount === 15;

        const { error } = await supabase.from("test_attempts").insert({
            user_id: userId,
            test_key: TEST_CONFIG.type,
            score: correctCount,
            passed: passedSelection,
            written_answers: WRITTEN_QUESTIONS.map((q, i) => ({ question: q, answer: writtenAnswers[i] || "" })),
        });

        if (error) { alert("送信失敗: " + error.message); setSubmitting(false); return; }
        if (passedSelection) {
            alert(`✅ 提出しました！\n\n選択式: ${correctCount}/15問正解\n\nadminの審査後、合格時に${TEST_CONFIG.rewardPoints}pt付与されます。
記述評価で追加 高+30pt / 中+10pt の可能性があります。`);
            await supabase.from("profiles").update({ standard_keeping_passed: true, standard_keeping_passed_at: new Date().toISOString() }).eq("id", userId);
            // ポイント付与
            const { data: ptRow } = await supabase.from("user_points").select("points").eq("id", userId).maybeSingle();
            const currentPt = ptRow?.points || 0;
            await supabase.from("user_points").upsert({ id: userId, points: currentPt + TEST_CONFIG.rewardPoints });
            await supabase.from("points_history").insert({ user_id: userId, change: TEST_CONFIG.rewardPoints, reason: "基準維持テスト合格" });
            // 24時間後に再挑戦できる通知をスケジュール（クールダウン明けに表示）
            const remindAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await supabase.from("notifications").insert({
                user_id: userId,
                type: "test_cooldown",
                title: `⚠️ ${TEST_CONFIG.title}に再挑戦できます`,
                message: "24時間のクールダウンが明けました。再挑戦してみましょう！",
                link: window.location.pathname,
                icon: "⚠️",
                created_at: remindAt.toISOString(),
            });
        } else {
            alert(`❌ 不合格\n\n選択式: ${correctCount}/15問正解(合格には全問正解必要)\n\n24時間後に再受験できます。`);
        }
        router.push("/tests");
    };

    if (loading) return <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div></main>;
    if (alreadyPassed) return <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}><div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: 60 }}><div style={{ fontSize: 64, marginBottom: 16 }}>⚖️</div><h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>合格済みです</h1><p style={{ color: "#9ca3af", marginBottom: 24 }}>{TEST_CONFIG.title}はすでに合格しています。</p><button onClick={() => router.push("/tests")} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>テスト一覧に戻る</button></div></main>;
    if (pendingReview) return <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}><div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: 60 }}><div style={{ fontSize: 64, marginBottom: 16 }}>⏳</div><h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>審査待ちです</h1><p style={{ color: "#9ca3af", marginBottom: 24 }}>admin の審査をお待ちください。<br />合格時に{TEST_CONFIG.rewardPoints}pt付与されます。<br />記述評価で追加 <strong style={{ color: "#10b981" }}>高+30pt / 中+10pt</strong></p><button onClick={() => router.push("/tests")} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>テスト一覧に戻る</button></div></main>;
    if (cooldownUntil) {
        const hoursLeft = Math.ceil((cooldownUntil.getTime() - Date.now()) / (1000 * 60 * 60));
        return <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}><div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: 60 }}><div style={{ fontSize: 64, marginBottom: 16 }}>⏰</div><h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>クールダウン中</h1><p style={{ color: "#9ca3af", marginBottom: 24 }}>あと約 {hoursLeft} 時間で再受験できます。</p><button onClick={() => router.push("/tests")} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>テスト一覧に戻る</button></div></main>;
    }

    let currentSection = "";
    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}>
            <div style={{ maxWidth: 720, margin: "0 auto" }}>
                <button onClick={() => router.push("/tests")} style={{ marginBottom: 16, padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>← テスト一覧に戻る</button>
                <div style={{ background: `linear-gradient(135deg, ${TEST_CONFIG.color}1f, ${TEST_CONFIG.color}1f)`, border: `2px solid ${TEST_CONFIG.color}66`, borderRadius: 16, padding: 24, marginBottom: 24 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: TEST_CONFIG.color, margin: "0 0 8px" }}>{TEST_CONFIG.title}</h1>
                    <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6 }}>全21問（選択式15問 + 記述式6問）<br />合格条件：選択式全問正解 + admin承認<br />報酬：<strong style={{ color: TEST_CONFIG.color }}>{TEST_CONFIG.rewardPoints}pt</strong><span style={{ color: "#9ca3af", fontSize: 12, marginLeft: 8 }}>+ 記述評価で 高+30pt / 中+10pt</span></div>
                </div>
                {QUESTIONS.map((q, i) => {
                    const showSection = q.section !== currentSection;
                    currentSection = q.section;
                    return (
                        <div key={i}>
                            {showSection && <div style={{ fontSize: 14, fontWeight: 800, color: TEST_CONFIG.color, margin: "32px 0 16px", paddingBottom: 8, borderBottom: `1px solid ${TEST_CONFIG.color}4d` }}>{q.section}</div>}
                            <div style={{ marginBottom: 20, padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>{q.q}</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {q.options.map((opt, oi) => (
                                        <button key={oi} onClick={() => { const newAnswers = [...answers]; newAnswers[i] = oi; setAnswers(newAnswers); }} style={{ padding: "12px 16px", borderRadius: 8, border: answers[i] === oi ? `2px solid ${TEST_CONFIG.color}` : "1px solid rgba(255,255,255,0.1)", background: answers[i] === oi ? `${TEST_CONFIG.color}26` : "rgba(255,255,255,0.02)", color: answers[i] === oi ? TEST_CONFIG.color : "#d1d5db", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>{opt}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div style={{ fontSize: 14, fontWeight: 800, color: TEST_CONFIG.color, margin: "32px 0 16px", paddingBottom: 8, borderBottom: `1px solid ${TEST_CONFIG.color}4d` }}>Part③: 筆記</div>
                {WRITTEN_QUESTIONS.map((q, i) => (
                    <div key={i} style={{ marginBottom: 20, padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>{q}</div>
                        <textarea value={writtenAnswers[i]} onChange={(e) => { const newW = [...writtenAnswers]; newW[i] = e.target.value; setWrittenAnswers(newW); }} placeholder="ここに記入..." style={{ width: "100%", minHeight: 80, padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none" }} />
                    </div>
                ))}
                <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: "16px 24px", borderRadius: 12, border: "none", background: submitting ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${TEST_CONFIG.color}, ${TEST_CONFIG.color}aa)`, color: submitting ? "#6b7280" : "#fff", fontSize: 15, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer", marginTop: 16 }}>{submitting ? "提出中..." : "⚖️ 提出する"}</button>
            </div>
        </main>
    );
}