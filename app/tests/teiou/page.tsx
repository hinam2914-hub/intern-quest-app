"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const QUESTIONS = [
    { section: "Part①: 思想・価値観", q: "Q1. 人生で最も避けるべき状態は？", options: ["A. 失敗すること", "B. 嫌われること", "C. 挑戦しないこと", "D. お金がないこと"], correct: 2 },
    { section: "Part①: 思想・価値観", q: "Q2. 若いうちに最優先で得るべきものは？", options: ["A. 安定", "B. 成長経験", "C. 楽な環境", "D. 承認欲求"], correct: 1 },
    { section: "Part①: 思想・価値観", q: "Q3. 「wantを選べる人生」に必要なのは？", options: ["A. 運", "B. 学歴", "C. 他人の評価", "D. 自分で稼ぐ力"], correct: 3 },
    { section: "Part①: 思想・価値観", q: "Q4. 人生で複利が最も働くものは？", options: ["A. 才能", "B. 習慣", "C. センス", "D. 運"], correct: 1 },
    { section: "Part①: 思想・価値観", q: "Q5. 「強い人」の特徴として最も近いのは？", options: ["A. 頭がいい", "B. メンタルが強い", "C. 継続できる", "D. 話がうまい"], correct: 2 },
    { section: "Part①: 思想・価値観", q: "Q6. 人生を壊しやすい判断は？", options: ["A. 挑戦する", "B. 失敗する", "C. 感情で決める", "D. 変化する"], correct: 2 },
    { section: "Part①: 思想・価値観", q: "Q7. 若いうちの苦労の価値は？", options: ["A. 根性論", "B. 時代遅れ", "C. 後半の自由につながる", "D. 意味ない"], correct: 2 },
    { section: "Part①: 思想・価値観", q: "Q8. 組織で最も危険なのは？", options: ["A. ミスする人", "B. 成果出ない人", "C. 他責の人", "D. 緊張する人"], correct: 2 },
    { section: "Part①: 思想・価値観", q: "Q9. 「依存性のない働き方」とは？", options: ["A. 楽して稼ぐこと", "B. 働かないこと", "C. 自分で選択できる状態", "D. フリーランスになること"], correct: 2 },
    { section: "Part①: 思想・価値観", q: "Q10. 人生を変える人の特徴は？", options: ["A. センス", "B. 行動量", "C. 人脈", "D. 学歴"], correct: 1 },
    { section: "Part②: 帝王判断ケース", q: "Q11. 短期的にはキツいが、5年後に大きな差になる行動は？", options: ["A. 毎日遊ぶ", "B. 現状維持", "C. 継続して成長する", "D. 周りに合わせる"], correct: 2 },
    { section: "Part②: 帝王判断ケース", q: "Q12. 優秀だけど空気を壊す人材は？", options: ["A. とりあえず残す", "B. 成果出るならOK", "C. 状況次第", "D. 組織全体で見る"], correct: 3 },
    { section: "Part②: 帝王判断ケース", q: "Q13. 最終的に人を強くするものは？", options: ["A. 才能", "B. 環境", "C. 習慣", "D. 運"], correct: 2 },
    { section: "Part②: 帝王判断ケース", q: "Q14. 「人生経験」が重要な理由は？", options: ["A. モテるから", "B. 話のネタになるから", "C. 判断力の材料になるから", "D. SNS映えするから"], correct: 2 },
    { section: "Part②: 帝王判断ケース", q: "Q15. 「帝王」に必要なものは？", options: ["A. カリスマ", "B. 支配力", "C. 自責思考", "D. 威圧感"], correct: 2 },
];

const WRITTEN_QUESTIONS = [
    "Q16. 「wantを選べる人生」とは何か、自分の言葉で説明してください",
    "Q17. 「複利」が人生に与える影響を説明してください",
    "Q18. 「20代で最優先すべきこと」を書いてください",
    "Q19. 「自分で稼ぐ力」が必要な理由を書いてください",
    "Q20. 「弱い人が陥りやすい思考」を3つ書いてください",
    "Q21. 5年後の自分のために、今やるべきことを書いてください",
];

const TEST_CONFIG = {
    type: "teiou",
    title: "👑 Dot.A 帝王学",
    color: "#fbbf24",
    passedField: "teiou_passed",
    rewardPoints: 1000,
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
                .select("created_at, status")
                .eq("user_id", user.id)
                .eq("test_type", TEST_CONFIG.type)
                .order("created_at", { ascending: false })
                .limit(1);

            if (lastAttempt && lastAttempt.length > 0) {
                const last = lastAttempt[0] as any;
                if (last.status === "pending") {
                    setPendingReview(true);
                } else if (last.status === "rejected") {
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
        if (!confirm(`提出してよろしいですか？\n\n選択式は自動採点、記述式はadminが評価します。\n80%以上正解 + admin承認で合格 (+${TEST_CONFIG.rewardPoints}pt)`)) return;

        setSubmitting(true);
        const correctCount = answers.filter((a, i) => a === QUESTIONS[i].correct).length;
        const passedSelection = correctCount >= 12;

        const { error } = await supabase.from("test_attempts").insert({
            user_id: userId,
            test_type: TEST_CONFIG.type,
            score: correctCount,
            max_score: 15,
            status: passedSelection ? "pending" : "rejected",
            written_answers: WRITTEN_QUESTIONS.map((q, i) => ({ question: q, answer: writtenAnswers[i] || "" })),
            answers: answers.map((a, i) => ({ question: QUESTIONS[i].q, selected: a, correct: QUESTIONS[i].correct, is_correct: a === QUESTIONS[i].correct })),
        });

        if (error) { alert("送信失敗: " + error.message); setSubmitting(false); return; }
        if (passedSelection) {
            alert(`✅ 提出しました！\n\n選択式: ${correctCount}/15問正解\n\nadminの審査後、合格時に${TEST_CONFIG.rewardPoints}pt付与されます。`);
        } else {
            alert(`❌ 不合格\n\n選択式: ${correctCount}/15問正解（合格には12問以上必要）\n\n24時間後に再受験できます。`);
        }
        router.push("/tests");
    };

    if (loading) return <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div></main>;
    if (alreadyPassed) return <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}><div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: 60 }}><div style={{ fontSize: 64, marginBottom: 16 }}>👑</div><h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>合格済みです</h1><p style={{ color: "#9ca3af", marginBottom: 24 }}>{TEST_CONFIG.title}はすでに合格しています。</p><button onClick={() => router.push("/tests")} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>テスト一覧に戻る</button></div></main>;
    if (pendingReview) return <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}><div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: 60 }}><div style={{ fontSize: 64, marginBottom: 16 }}>⏳</div><h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>審査待ちです</h1><p style={{ color: "#9ca3af", marginBottom: 24 }}>admin の審査をお待ちください。<br />合格時に{TEST_CONFIG.rewardPoints}pt付与されます。</p><button onClick={() => router.push("/tests")} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>テスト一覧に戻る</button></div></main>;
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
                    <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6 }}>全21問（選択式15問 + 記述式6問）<br />合格条件：選択式12問以上正解 + admin承認<br />報酬：<strong style={{ color: "#fbbf24" }}>{TEST_CONFIG.rewardPoints}pt</strong>（最高ランクテスト）</div>
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
                <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: "16px 24px", borderRadius: 12, border: "none", background: submitting ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${TEST_CONFIG.color}, ${TEST_CONFIG.color})`, color: submitting ? "#6b7280" : "#0a0a0f", fontSize: 15, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer", marginTop: 16 }}>{submitting ? "提出中..." : "👑 提出する"}</button>
            </div>
        </main>
    );
}