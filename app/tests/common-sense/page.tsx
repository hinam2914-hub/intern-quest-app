"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const QUESTIONS = [
    // Part①: 常識編
    { section: "Part①: 常識編", q: "Q1. 待ち合わせに5分遅れそうなとき、最適な対応は？", options: ["A. 到着後に謝る", "B. 遅れる前に連絡する", "C. 急げば問題ない", "D. 理由を説明して正当化する"], correct: 1 },
    { section: "Part①: 常識編", q: "Q2. 飲食店で店員が料理を間違えたときは？", options: ["A. 無言で不機嫌になる", "B. SNSに書く", "C. 落ち着いて伝える", "D. 強めに注意する"], correct: 2 },
    { section: "Part①: 常識編", q: "Q3. 初対面で最も大切なのは？", options: ["A. 清潔感と態度", "B. 面白さ", "C. トーク力", "D. 自信"], correct: 0 },
    { section: "Part①: 常識編", q: "Q4. 相手が話している途中でやってはいけないことは?", options: ["A. メモを取る", "B. 相槌を打つ", "C. 質問を考える", "D. 話を遮る"], correct: 3 },
    { section: "Part①: 常識編", q: "Q5. LINEの返信が遅れたとき、最も適切なのは？", options: ["A. 普通に返す", "B. スタンプだけ送る", "C. 一言添える", "D. 未読無視する"], correct: 2 },
    { section: "Part①: 常識編", q: "Q6. 人間関係で信頼を失いやすい行動は？", options: ["A. ミスすること", "B. 約束を破ること", "C. 緊張すること", "D. 話が下手なこと"], correct: 1 },
    { section: "Part①: 常識編", q: "Q7. 店員さんへの態度として適切なのは？", options: ["A. 必要最低限だけ話す", "B. タメ口で話す", "C. 横柄にならない", "D. 相手として敬意を持つ"], correct: 3 },
    { section: "Part①: 常識編", q: "Q8. 相手が嫌そうにしているときは？", options: ["A. いじって笑いに変える", "B. 一旦引く", "C. 気にしない", "D. 空気を変えようとする"], correct: 1 },
    { section: "Part①: 常識編", q: "Q9. 会話で最も大事なのは？", options: ["A. 自分が話すこと", "B. 知識量", "C. 相手が話しやすいこと", "D. 面白さ"], correct: 2 },
    { section: "Part①: 常識編", q: "Q10. 「空気読めない」と言われやすい人の特徴は？", options: ["A. 話が長い", "B. 声が大きい", "C. 自分基準で動く", "D. 緊張しやすい"], correct: 2 },
    // Part②: ケーススタディ
    { section: "Part②: ケーススタディ", q: "Q11. 友達が明らかに落ち込んでいるときは？", options: ["A. 放っておく", "B. とりあえず励ます", "C. 明るくいじる", "D. 様子を見つつ話を聞く"], correct: 3 },
    { section: "Part②: ケーススタディ", q: "Q12. 後輩がミスして焦っているときは？", options: ["A. 強めに注意する", "B. 一緒に整理する", "C. 放置する", "D. 他人に任せる"], correct: 1 },
    { section: "Part②: ケーススタディ", q: "Q13. エレベーターで降りる人がいるときは？", options: ["A. そのまま立つ", "B. 先に降りる", "C. 一度降りて道を空ける", "D. 気にしない"], correct: 2 },
    { section: "Part②: ケーススタディ", q: "Q14. 飲み会で一番避けるべき行動は？", options: ["A. 無言", "B. 飲みすぎ", "C. 自分の話ばかりする", "D. 先に帰る"], correct: 2 },
    { section: "Part②: ケーススタディ", q: "Q15. 相手との価値観が違うときは？", options: ["A. 否定する", "B. 距離を置く", "C. 論破する", "D. 一度受け止める"], correct: 3 },
];

const WRITTEN_QUESTIONS = [
    "Q16. 「感じがいい人」の特徴を書いてください",
    "Q17. 「デリカシーがない」とはどういう状態か説明してください",
    "Q18. 過去に「空気読めなかった」経験を書いてください",
    "Q19. 人間関係で信頼を積む方法を3つ書いてください",
    "Q20. 自分が改善したいコミュニケーション面",
    "Q21. 「一緒に働きたい人」の特徴を書いてください",
];

export default function CommonSenseTest() {
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

            // 合格済みチェック
            const { data: profile } = await supabase.from("profiles").select("common_sense_passed").eq("id", user.id).single();
            if ((profile as any)?.common_sense_passed) {
                setAlreadyPassed(true);
                setLoading(false);
                return;
            }

            // クールダウンチェック
            const { data: lastAttempt } = await supabase
                .from("test_attempts")
                .select("created_at, status")
                .eq("user_id", user.id)
                .eq("test_type", "common_sense")
                .order("created_at", { ascending: false })
                .limit(1);

            if (lastAttempt && lastAttempt.length > 0) {
                const last = lastAttempt[0] as any;
                if (last.status === "pending") {
                    setPendingReview(true);
                } else if (last.status === "rejected") {
                    const cooldownEnd = new Date(new Date(last.created_at).getTime() + 24 * 60 * 60 * 1000);
                    if (cooldownEnd > new Date()) {
                        setCooldownUntil(cooldownEnd);
                    }
                }
            }
            setLoading(false);
        };
        load();
    }, [router]);

    const handleSubmit = async () => {
        // 全選択式回答済みチェック
        if (answers.some(a => a === -1)) {
            alert("選択式問題（Q1〜Q15）すべてに回答してください");
            return;
        }
        // 記述式の最低1問チェック（緩め）
        if (writtenAnswers.every(w => !w.trim())) {
            alert("記述式問題（Q16〜Q21）も少なくとも1問は回答してください");
            return;
        }

        if (!confirm("提出してよろしいですか？\n\n選択式は自動採点、記述式はadminが評価します。\n80%以上正解 + admin承認で合格となります。")) return;

        setSubmitting(true);

        // 採点
        const correctCount = answers.filter((a, i) => a === QUESTIONS[i].correct).length;
        const passedSelection = correctCount >= 12; // 80% = 12問以上

        // 記録
        const { error } = await supabase.from("test_attempts").insert({
            user_id: userId,
            test_type: "common_sense",
            score: correctCount,
            max_score: 15,
            status: passedSelection ? "pending" : "rejected", // 12問未満なら自動却下
            written_answers: WRITTEN_QUESTIONS.map((q, i) => ({
                question: q,
                answer: writtenAnswers[i] || "",
            })),
            answers: answers.map((a, i) => ({
                question: QUESTIONS[i].q,
                selected: a,
                correct: QUESTIONS[i].correct,
                is_correct: a === QUESTIONS[i].correct,
            })),
        });

        if (error) {
            alert("送信失敗: " + error.message);
            setSubmitting(false);
            return;
        }

        if (passedSelection) {
            alert(`✅ 提出しました！\n\n選択式: ${correctCount}/15問正解\n\nadminの審査後、合格時に100pt付与されます。`);
        } else {
            alert(`❌ 不合格\n\n選択式: ${correctCount}/15問正解（合格には12問以上必要）\n\n24時間後に再受験できます。`);
        }
        router.push("/tests");
    };

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    if (alreadyPassed) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}>
                <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: 60 }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>合格済みです</h1>
                    <p style={{ color: "#9ca3af", marginBottom: 24 }}>常識・デリカシーテストはすでに合格しています。</p>
                    <button onClick={() => router.push("/tests")} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>テスト一覧に戻る</button>
                </div>
            </main>
        );
    }

    if (pendingReview) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}>
                <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: 60 }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>⏳</div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>審査待ちです</h1>
                    <p style={{ color: "#9ca3af", marginBottom: 24 }}>admin の審査をお待ちください。<br />合格時に100pt付与されます。</p>
                    <button onClick={() => router.push("/tests")} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>テスト一覧に戻る</button>
                </div>
            </main>
        );
    }

    if (cooldownUntil) {
        const hoursLeft = Math.ceil((cooldownUntil.getTime() - Date.now()) / (1000 * 60 * 60));
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}>
                <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: 60 }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>⏰</div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>クールダウン中</h1>
                    <p style={{ color: "#9ca3af", marginBottom: 24 }}>あと約 {hoursLeft} 時間で再受験できます。</p>
                    <button onClick={() => router.push("/tests")} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>テスト一覧に戻る</button>
                </div>
            </main>
        );
    }

    let currentSection = "";

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}>
            <div style={{ maxWidth: 720, margin: "0 auto" }}>
                <button onClick={() => router.push("/tests")} style={{ marginBottom: 16, padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    ← テスト一覧に戻る
                </button>

                <div style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(99,102,241,0.12))", border: "2px solid rgba(168,85,247,0.4)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: "#a78bfa", margin: "0 0 8px" }}>🧠 常識・デリカシーテスト</h1>
                    <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6 }}>
                        全21問（選択式15問 + 記述式6問）<br />
                        合格条件：選択式12問以上正解 + admin承認<br />
                        報酬：<strong style={{ color: "#fbbf24" }}>100pt</strong>
                    </div>
                </div>

                {/* 選択式 */}
                {QUESTIONS.map((q, i) => {
                    const showSection = q.section !== currentSection;
                    currentSection = q.section;
                    return (
                        <div key={i}>
                            {showSection && (
                                <div style={{ fontSize: 14, fontWeight: 800, color: "#a78bfa", margin: "32px 0 16px", paddingBottom: 8, borderBottom: "1px solid rgba(168,85,247,0.3)" }}>
                                    {q.section}
                                </div>
                            )}
                            <div style={{ marginBottom: 20, padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>{q.q}</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {q.options.map((opt, oi) => (
                                        <button key={oi} onClick={() => {
                                            const newAnswers = [...answers];
                                            newAnswers[i] = oi;
                                            setAnswers(newAnswers);
                                        }} style={{ padding: "12px 16px", borderRadius: 8, border: answers[i] === oi ? "2px solid #a78bfa" : "1px solid rgba(255,255,255,0.1)", background: answers[i] === oi ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.02)", color: answers[i] === oi ? "#c4b5fd" : "#d1d5db", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* 記述式 */}
                <div style={{ fontSize: 14, fontWeight: 800, color: "#a78bfa", margin: "32px 0 16px", paddingBottom: 8, borderBottom: "1px solid rgba(168,85,247,0.3)" }}>
                    Part③: 筆記
                </div>
                {WRITTEN_QUESTIONS.map((q, i) => (
                    <div key={i} style={{ marginBottom: 20, padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>{q}</div>
                        <textarea value={writtenAnswers[i]} onChange={(e) => {
                            const newW = [...writtenAnswers];
                            newW[i] = e.target.value;
                            setWrittenAnswers(newW);
                        }} placeholder="ここに記入..." style={{ width: "100%", minHeight: 80, padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none" }} />
                    </div>
                ))}

                {/* 提出 */}
                <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: "16px 24px", borderRadius: 12, border: "none", background: submitting ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #a78bfa, #6366f1)", color: submitting ? "#6b7280" : "#fff", fontSize: 15, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer", marginTop: 16 }}>
                    {submitting ? "提出中..." : "📤 提出する"}
                </button>
            </div>
        </main>
    );
}