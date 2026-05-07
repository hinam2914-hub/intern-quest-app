"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const QUESTIONS = [
    { section: "Part①: 長期思考編", q: "Q1. 毎日2時間ゲームを1年間続けるのと、毎日2時間スキル習得を1年間続ける。5年後に差が出やすいのは？", options: ["A. あまり変わらない", "B. 人脈だけ変わる", "C. 習慣の差が大きな差になる", "D. 才能次第"], correct: 2 },
    { section: "Part①: 長期思考編", q: "Q2. 若いうちに最も価値があるものは？", options: ["A. 楽さ", "B. 時間", "C. 遊び", "D. 安定"], correct: 1 },
    { section: "Part①: 長期思考編", q: "Q3. 「今だけ楽」を選び続けると起こりやすいことは？", options: ["A. 幸せになる", "B. 後半で苦しくなる", "C. 安定する", "D. 人脈が増える"], correct: 1 },
    { section: "Part①: 長期思考編", q: "Q4. 長期で見て最もリターンが大きい行動は？", options: ["A. SNSを見る", "B. 飲み会を増やす", "C. 自分への投資", "D. 楽な仕事を選ぶ"], correct: 2 },
    { section: "Part①: 長期思考編", q: "Q5. 複利が最も働くものは？", options: ["A. 見栄", "B. 習慣", "C. 一発の才能", "D. ノリの良さ"], correct: 1 },
    { section: "Part①: 長期思考編", q: "Q6. 「今はキツいけど後で楽になる行動」は？", options: ["A. 無意味", "B. 若いうちは不要", "C. 長期利益になりやすい", "D. コスパ悪い"], correct: 2 },
    { section: "Part①: 長期思考編", q: "Q7. 長期思考ができない人の特徴は？", options: ["A. 真面目", "B. 感情で決める", "C. 優しい", "D. 行動力がある"], correct: 1 },
    { section: "Part①: 長期思考編", q: "Q8. 毎日30分の勉強を2年続けた人はどうなりやすい？", options: ["A. あまり変わらない", "B. 少し知識が増える", "C. 周りと差が開く", "D. 疲れるだけ"], correct: 2 },
    { section: "Part①: 長期思考編", q: "Q9. 20代で最優先すべきなのは？", options: ["A. 安定", "B. 失敗しないこと", "C. 成長経験", "D. 周りに合わせること"], correct: 2 },
    { section: "Part①: 長期思考編", q: "Q10. 「複利思考」がある人の特徴は？", options: ["A. すぐ結果を求めない", "B. 感情で動く", "C. 楽を優先する", "D. 流行を追う"], correct: 0 },
    { section: "Part②: ケーススタディ", q: "Q11. 毎月3万円自由に使える。長期的に最もリターンが高い使い方は？", options: ["A. 毎月飲み会", "B. ブランド品", "C. 自己投資", "D. ソシャゲ課金"], correct: 2 },
    { section: "Part②: ケーススタディ", q: "Q12. 「若いうちに苦労した方がいい」と言われる理由に近いのは？", options: ["A. 根性がつくから", "B. 我慢できるから", "C. 後で選択肢が増えるから", "D. 大人っぽくなるから"], correct: 2 },
    { section: "Part②: ケーススタディ", q: "Q13. 毎日少しずつでも続ける価値が高い理由は？", options: ["A. 偉そうに見えるから", "B. 継続が複利になるから", "C. 周りに褒められるから", "D. 気持ちいいから"], correct: 1 },
    { section: "Part②: ケーススタディ", q: "Q14. 短期快楽を優先しすぎる人に起きやすいことは？", options: ["A. 成長速度が落ちる", "B. 人脈が減る", "C. 運が悪くなる", "D. モテなくなる"], correct: 0 },
    { section: "Part②: ケーススタディ", q: "Q15. 長期的に見て「良い環境」とは？", options: ["A. 楽な環境", "B. 成長できる環境", "C. 友達が多い環境", "D. 怒られない環境"], correct: 1 },
];

const WRITTEN_QUESTIONS = [
    "Q16. 「5年前にやっておけば良かったこと」を書いてください",
    "Q17. 「長期で得する行動」を3つ書いてください",
    "Q18. 今の自分が「短期快楽」に使いすぎているものを書いてください",
    "Q19. 5年後の自分に最も利益がある習慣を書いてください",
    "Q20. 「複利」とは何かを自分なりに説明してください",
    "Q21. 10年後の自分を良くするために、今やるべきことを書いてください",
];

const TEST_CONFIG = {
    type: "long_term_thinking",
    title: "📈 長期思考・複利思考",
    color: "#3b82f6",
    passedField: "long_term_thinking_passed",
    rewardPoints: 300,
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
    if (alreadyPassed) return <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}><div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: 60 }}><div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div><h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>合格済みです</h1><p style={{ color: "#9ca3af", marginBottom: 24 }}>{TEST_CONFIG.title}はすでに合格しています。</p><button onClick={() => router.push("/tests")} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>テスト一覧に戻る</button></div></main>;
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
                    <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6 }}>全21問（選択式15問 + 記述式6問）<br />合格条件：選択式12問以上正解 + admin承認<br />報酬：<strong style={{ color: "#fbbf24" }}>{TEST_CONFIG.rewardPoints}pt</strong></div>
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
                <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: "16px 24px", borderRadius: 12, border: "none", background: submitting ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${TEST_CONFIG.color}, ${TEST_CONFIG.color})`, color: submitting ? "#6b7280" : "#fff", fontSize: 15, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer", marginTop: 16 }}>{submitting ? "提出中..." : "📤 提出する"}</button>
            </div>
        </main>
    );
}