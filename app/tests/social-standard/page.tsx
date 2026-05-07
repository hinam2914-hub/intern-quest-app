"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const QUESTIONS = [
    { section: "Part①: 社会人基準チェック", q: "Q1. 「毎日時間通りに来る」は社会人では？", options: ["A. かなり優秀", "B. 上位20%", "C. 普通以下", "D. 最低ライン"], correct: 3 },
    { section: "Part①: 社会人基準チェック", q: "Q2. 「言われたことをやる」は評価される?", options: ["A. 高評価", "B. 優秀", "C. 一部評価される", "D. 当たり前"], correct: 3 },
    { section: "Part①: 社会人基準チェック", q: "Q3. 月5万円を自力で安定して稼げる人は？", options: ["A. 普通", "B. 少し優秀", "C. 上位層", "D. 誰でもできる"], correct: 2 },
    { section: "Part①: 社会人基準チェック", q: "Q4. 「報連相をちゃんとする」は？", options: ["A. 強み", "B. 才能", "C. 一部の人だけできる", "D. 社会人の最低限"], correct: 3 },
    { section: "Part①: 社会人基準チェック", q: "Q5. 毎日勉強や改善を継続できる人は？", options: ["A. 普通", "B. 意識高いだけ", "C. 実はかなり少ない", "D. 誰でもできる"], correct: 2 },
    { section: "Part①: 社会人基準チェック", q: "Q6. 「時間を守る・返信する・約束守る」ができない人は？", options: ["A. 若いから仕方ない", "B. 性格の問題", "C. 社会ではかなり厳しい", "D. 仕事でカバーできる"], correct: 2 },
    { section: "Part①: 社会人基準チェック", q: "Q7. 20代で営業経験がある人は？", options: ["A. 普通", "B. 時代遅れ", "C. 意外と少ない", "D. 誰でもある"], correct: 2 },
    { section: "Part①: 社会人基準チェック", q: "Q8. 「自分は結構できてる」と思ってる人に多い特徴は？", options: ["A. 自信がある", "B. 行動量が多い", "C. 比較対象が低い", "D. 実績がある"], correct: 2 },
    { section: "Part①: 社会人基準チェック", q: "Q9. 社会で評価されやすいのは？", options: ["A. 口がうまい人", "B. 継続して成果出す人", "C. 自信ある人", "D. 面白い人"], correct: 1 },
    { section: "Part①: 社会人基準チェック", q: "Q10. 「まだまだ自分は弱い」と理解してる人は？", options: ["A. 自信がない", "B. ネガティブ", "C. 成長しやすい", "D. 行動できない"], correct: 2 },
    { section: "Part②: 現実ケース", q: "Q11. 月20万円を継続して自力で稼げる人は？", options: ["A. 普通", "B. 上位20〜30%くらい", "C. 誰でもできる", "D. 才能必要"], correct: 1 },
    { section: "Part②: 現実ケース", q: "Q12. 「自分は頑張ってる」と言う人の中で、本当に努力してる人は？", options: ["A. ほとんど", "B. 半分くらい", "C. 一部だけ", "D. みんな努力してる"], correct: 2 },
    { section: "Part②: 現実ケース", q: "Q13. 毎日ダラダラSNS3時間見る習慣を5年続けると？", options: ["A. そこまで変わらない", "B. 人生にかなり差が出る", "C. リフレッシュになる", "D. 時代的に普通"], correct: 1 },
    { section: "Part②: 現実ケース", q: "Q14. 「社会人として強い人」の特徴は？", options: ["A. センス", "B. 継続力", "C. 学歴", "D. コミュ力だけ"], correct: 1 },
    { section: "Part②: 現実ケース", q: "Q15. 「まだ何者でもない」と理解してる人は？", options: ["A. 弱い", "B. 危険", "C. 成長余地が大きい", "D. ネガティブ"], correct: 2 },
];

const WRITTEN_QUESTIONS = [
    "Q16. 「社会人として今の自分に足りないもの」を3つ書いてください",
    "Q17. 「自分は普通以上だ」と思っていた部分を書いてください。また、それは本当に社会基準で見ても強みか説明してください",
    "Q18. 今の自分が「できてるつもり」になっていることを書いてください",
    "Q19. 5年後に周りと差がつくと思う習慣を書いてください",
    "Q20. 「社会で通用する人」と「通用しない人」の違いを書いてください",
    "Q21. 今の自分が最優先で改善すべきことを書いてください",
];

const TEST_CONFIG = {
    type: "social_standard",
    title: "🎯 社会人基準・現実認識",
    color: "#ec4899",
    passedField: "social_standard_passed",
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