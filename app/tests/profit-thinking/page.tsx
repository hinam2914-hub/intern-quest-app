"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const QUESTIONS = [
    { section: "Part①: 判断基準編", q: "Q1. 月5万円の収入アップと、毎日なんとなく楽しい環境。長期的に優先すべきなのは？", options: ["A. 今楽しい環境", "B. 人間関係", "C. 成長と収入が伸びる環境", "D. 楽な環境"], correct: 2 },
    { section: "Part①: 判断基準編", q: "Q2. 「安いから買う」という判断で最も危険なのは？", options: ["A. お金が減る", "B. テンション下がる", "C. 本当に必要か考えていない", "D. ブランド力がない"], correct: 2 },
    { section: "Part①: 判断基準編", q: "Q3. 人生で最も利益が大きい投資は？", options: ["A. ギャンブル", "B. ブランド物", "C. 他人への見栄", "D. 自分への投資"], correct: 3 },
    { section: "Part①: 判断基準編", q: "Q4. 「今楽」を選び続けるとどうなりやすい？", options: ["A. 幸せになる", "B. 安定する", "C. 後で苦しくなる", "D. 人脈が増える"], correct: 2 },
    { section: "Part①: 判断基準編", q: "Q5. 仕事選びで優先順位が高いのは？", options: ["A. 楽さ", "B. ネームバリュー", "C. 成長環境", "D. 休日の多さ"], correct: 2 },
    { section: "Part①: 判断基準編", q: "Q6. 利益思考がある人の特徴は？", options: ["A. ケチ", "B. 冷たい", "C. 打算的", "D. 長期で考える"], correct: 3 },
    { section: "Part①: 判断基準編", q: "Q7. 「センスがない判断」をしやすい人の特徴は？", options: ["A. 真面目", "B. 素直", "C. 感情で決める", "D. 行動力がある"], correct: 2 },
    { section: "Part①: 判断基準編", q: "Q8. 友達に流されて行動するリスクは？", options: ["A. お金が減る", "B. 時間が減る", "C. 判断軸を失う", "D. 疲れる"], correct: 2 },
    { section: "Part①: 判断基準編", q: "Q9. 短期的にキツい経験の価値は？", options: ["A. できれば避けるべき", "B. 若いうちは不要", "C. メンタル削るだけ", "D. 長期リターンになることが多い"], correct: 3 },
    { section: "Part①: 判断基準編", q: "Q10. 人生で最も避けるべきことは？", options: ["A. 失敗", "B. 挑戦", "C. 恥をかくこと", "D. 成長しないこと"], correct: 3 },
    { section: "Part②: ケーススタディ", q: "Q11. 月3万円の飲み代を減らすと、何に使うのが最も利益が高い？", options: ["A. ブランド服", "B. ソシャゲ課金", "C. 自己投資", "D. タクシー代"], correct: 2 },
    { section: "Part②: ケーススタディ", q: "Q12. 「なんとなく楽しいだけの集まり」に毎週行く状態は？", options: ["A. 青春", "B. 人脈形成", "C. リフレッシュ", "D. 長期で見ると損になりやすい"], correct: 3 },
    { section: "Part②: ケーススタディ", q: "Q13. 今の自分に最も利益がある行動は？", options: ["A. ダラダラSNS", "B. 現状維持", "C. 成長につながる行動", "D. 周りに合わせる"], correct: 2 },
    { section: "Part②: ケーススタディ", q: "Q14. 判断力が高い人の特徴は？", options: ["A. 迷わない", "B. 頭いい", "C. 感情が強い", "D. 損得を長期で見れる"], correct: 3 },
    { section: "Part②: ケーススタディ", q: "Q15. 若いうちに優先すべきなのは？", options: ["A. 安定", "B. 楽さ", "C. 成長経験", "D. 見栄"], correct: 2 },
];

const WRITTEN_QUESTIONS = [
    "Q16. 「過去に損した判断」とその理由を書いてください",
    "Q17. 「長期的に利益がある選択」とは何か説明してください",
    "Q18. 「今の自分が無駄にしているもの」を書いてください（時間・金・人間関係など）",
    "Q19. 「5年後の自分の利益になる行動」を3つ書いてください",
    "Q20. 「感情で判断して失敗した経験」を書いてください",
    "Q21. 「センスがある人」の特徴を説明してください",
];

const TEST_CONFIG = {
    type: "profit_thinking",
    title: "💰 利益思考・判断センス",
    color: "#10b981",
    passedField: "profit_thinking_passed",
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