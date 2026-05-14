"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const QUESTIONS = [
    { section: "Part①: 本質判断編", q: "Q1. 仕事ができない人に多い特徴は？", options: ["A. 忙しそう", "B. タスクを増やしすぎる", "C. 真面目", "D. 返信が早い"], correct: 1 },
    { section: "Part①: 本質判断編", q: "Q2. 成果を出す人の特徴として最も近いのは？", options: ["A. 常に動いている", "B. 仕事量が多い", "C. 本当に必要なことに集中している", "D. 全部完璧にやる"], correct: 2 },
    { section: "Part①: 本質判断編", q: "Q3. 「とりあえずやるか」で増えたタスクは？", options: ["A. 行動力になる", "B. 成長につながる", "C. 生産性を落としやすい", "D. 経験になる"], correct: 2 },
    { section: "Part①: 本質判断編", q: "Q4. 最も避けるべき状態は？", options: ["A. 暇", "B. 余裕がある", "C. 優先順位が崩壊している", "D. やることが少ない"], correct: 2 },
    { section: "Part①: 本質判断編", q: "Q5. 本質思考がある人の特徴は？", options: ["A. なんでも挑戦する", "B. 断れない", "C. やらないことを決めている", "D. 忙しいアピールをする"], correct: 2 },
    { section: "Part①: 本質判断編", q: "Q6. 「頑張ってるのに成果出ない」人に多いのは？", options: ["A. 努力不足", "B. 才能不足", "C. 余計なことをやりすぎ", "D. 人脈不足"], correct: 2 },
    { section: "Part①: 本質判断編", q: "Q7. 仕事の優先順位で最も重要なのは？", options: ["A. 楽なものからやる", "B. 緊急性", "C. 他人の評価", "D. 成果インパクト"], correct: 3 },
    { section: "Part①: 本質判断編", q: "Q8. 本当に強い人の特徴は？", options: ["A. 全部やる", "B. 忙しい", "C. 集中力が分散していない", "D. マルチタスクできる"], correct: 2 },
    { section: "Part①: 本質判断編", q: "Q9. 余計な仕事を増やす人の特徴は？", options: ["A. 真面目", "B. 不安で全部やる", "C. 優しい", "D. コミュ力高い"], correct: 1 },
    { section: "Part①: 本質判断編", q: "Q10. 「やることを減らす」の価値は？", options: ["A. 楽になるだけ", "B. サボり", "C. 集中力が上がる", "D. 成長が止まる"], correct: 2 },
    { section: "Part②: ケーススタディ", q: "Q11. やることが多すぎて終わらないとき、最初にやるべきは？", options: ["A. 気合い入れる", "B. 徹夜する", "C. タスクを書き出して整理する", "D. 全部少しずつやる"], correct: 2 },
    { section: "Part②: ケーススタディ", q: "Q12. 成果に直結しない会議が毎週ある場合は？", options: ["A. とりあえず出る", "B. 空気読む", "C. なんとなく継続", "D. 必要性を見直す"], correct: 3 },
    { section: "Part②: ケーススタディ", q: "Q13. SNS・通知で集中が切れる場合は？", options: ["A. 意志で頑張る", "B. 我慢する", "C. 気合い", "D. 環境を変える"], correct: 3 },
    { section: "Part②: ケーススタディ", q: "Q14. 全部自分でやる人の問題点は？", options: ["A. 優しすぎる", "B. 成長できる", "C. 抱え込みやすい", "D. 頼られる"], correct: 2 },
    { section: "Part②: ケーススタディ", q: "Q15. 最も生産性が高い状態は？", options: ["A. 常に忙しい", "B. タスクが多い", "C. 本質業務に集中できている", "D. 返信が早い"], correct: 2 },
];

const WRITTEN_QUESTIONS = [
    "Q16. 今の自分が無駄にやっていることを書いてください",
    "Q17. やらなくていい仕事の特徴を書いてください",
    "Q18. 自分が忙しいだけになっている部分を書いてください",
    "Q19. 今の自分の成果に最も直結する行動を3つ書いてください",
    "Q20. 余計なことを減らすメリットを説明してください",
    "Q21. 今後やらないことを3つ決めてください",
];

const TEST_CONFIG = {
    type: "essence_thinking",
    title: "🔍 本質思考・タスク整理",
    color: "#06b6d4",
    passedField: "essence_thinking_passed",
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
        if (!confirm(`提出してよろしいですか？\n\n選択式は自動採点、記述式はadminが評価します。\n12問以上正解 + admin承認で合格 (+${TEST_CONFIG.rewardPoints}pt)`)) return;

        setSubmitting(true);
        const correctCount = answers.filter((a, i) => a === QUESTIONS[i].correct).length;
        const passedSelection = correctCount >= 12;

        const { error } = await supabase.from("test_attempts").insert({
            user_id: userId,
            test_type: TEST_CONFIG.type,
            score: correctCount,
            status: passedSelection ? "pending" : "rejected",
            written_answers: WRITTEN_QUESTIONS.map((q, i) => ({ question: q, answer: writtenAnswers[i] || "" })),
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
    if (alreadyPassed) return <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}><div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: 60 }}><div style={{ fontSize: 64, marginBottom: 16 }}>🔍</div><h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>合格済みです</h1><p style={{ color: "#9ca3af", marginBottom: 24 }}>{TEST_CONFIG.title}はすでに合格しています。</p><button onClick={() => router.push("/tests")} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>テスト一覧に戻る</button></div></main>;
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
                    <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6 }}>全21問（選択式15問 + 記述式6問）<br />合格条件：選択式12問以上正解 + admin承認<br />報酬：<strong style={{ color: TEST_CONFIG.color }}>{TEST_CONFIG.rewardPoints}pt</strong></div>
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
                <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: "16px 24px", borderRadius: 12, border: "none", background: submitting ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${TEST_CONFIG.color}, ${TEST_CONFIG.color}aa)`, color: submitting ? "#6b7280" : "#fff", fontSize: 15, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer", marginTop: 16 }}>{submitting ? "提出中..." : "🔍 提出する"}</button>
            </div>
        </main>
    );
}