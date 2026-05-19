"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const QUESTIONS = [{"section": "Part①: 謝罪と思考編", "q": "Q1. 本当に重要なのはどれ？", "options": ["A. 謝ること", "B. 落ち込むこと", "C. 同じ問題を起こさないこと", "D. 言い訳しないこと"], "correct": 2}, {"section": "Part①: 謝罪と思考編", "q": "Q2. 「すみません！」を何回も言う人の問題は？", "options": ["A. 礼儀正しすぎる", "B. 優しすぎる", "C. 誠実すぎる", "D. 改善されていないことが多い"], "correct": 3}, {"section": "Part①: 謝罪と思考編", "q": "Q3. 信頼を失う原因として大きいのは？", "options": ["A. ミスすること", "B. 謝らないこと", "C. 同じミスを繰り返すこと", "D. 緊張すること"], "correct": 2}, {"section": "Part①: 謝罪と思考編", "q": "Q4. \"謝罪で終わる人\"に多い特徴は？", "options": ["A. 真面目", "B. 感情で満足する", "C. 優しい", "D. 落ち込みやすい"], "correct": 1}, {"section": "Part①: 謝罪と思考編", "q": "Q5. 改善できる人の特徴は？", "options": ["A. 反省文が長い", "B. すぐ謝る", "C. 原因と対策を考える", "D. 気合いを入れる"], "correct": 2}, {"section": "Part①: 謝罪と思考編", "q": "Q6. 「申し訳ないです」が危険な理由は？", "options": ["A. 重いから", "B. 空気悪くなるから", "C. 行動変化がないと意味ないから", "D. 偉そうだから"], "correct": 2}, {"section": "Part①: 謝罪と思考編", "q": "Q7. 最も信頼される人は？", "options": ["A. ミスしない人", "B. 謝れる人", "C. 再発防止できる人", "D. 明るい人"], "correct": 2}, {"section": "Part①: 謝罪と思考編", "q": "Q8. 謝罪後に最初に考えるべきなのは？", "options": ["A. 気持ち", "B. 言い方", "C. 評価", "D. 次どう防ぐか"], "correct": 3}, {"section": "Part①: 謝罪と思考編", "q": "Q9. \"改善力\"に近いものは？", "options": ["A. 根性", "B. 修正速度", "C. メンタル", "D. 反省量"], "correct": 1}, {"section": "Part①: 謝罪と思考編", "q": "Q10. 成長しない人の特徴は？", "options": ["A. ミスする", "B. 落ち込む", "C. 言い訳と謝罪で終わる", "D. 緊張しやすい"], "correct": 2}, {"section": "Part②: ケーススタディ", "q": "Q11. 遅刻した時に最も重要なのは？", "options": ["A. 長文謝罪", "B. 理由説明", "C. 次回防止策", "D. 落ち込むこと"], "correct": 2}, {"section": "Part②: ケーススタディ", "q": "Q12. 同じミスを3回繰り返す状態は？", "options": ["A. 相性問題", "B. 運悪い", "C. 改善不足", "D. 経験不足"], "correct": 2}, {"section": "Part②: ケーススタディ", "q": "Q13. 「気をつけます」だけで終わる問題は？", "options": ["A. 普通すぎる", "B. 元気ない", "C. 真面目すぎる", "D. 行動変更がない"], "correct": 3}, {"section": "Part②: ケーススタディ", "q": "Q14. 改善できる人は指摘後どうする？", "options": ["A. 即修正する", "B. 落ち込む", "C. とりあえず謝る", "D. 空気読む"], "correct": 0}, {"section": "Part②: ケーススタディ", "q": "Q15. 本当に必要なのは？", "options": ["A. 気合い", "B. 反省感", "C. 根性", "D. 仕組み変更"], "correct": 3}];

const WRITTEN_QUESTIONS = ["Q16. 最近\"謝って終わった\"と思う経験を書いてください", "Q17. 「謝罪だけで終わる人」の特徴を書いてください", "Q18. 同じミスを防ぐために必要なことを書いてください", "Q19. 最近受けた指摘と、その改善策を書いてください", "Q20. 「信頼される人」の特徴を書いてください", "Q21. 今の自分が\"言葉だけになっている部分\"を書いてください"];

const TEST_CONFIG = {
    type: "apology_escape",
    title: "🪞 謝罪逃避・責任転嫁防止",
    color: "#eab308",
    passedField: "apology_escape_passed",
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
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
            if ((profile as any)?.[TEST_CONFIG.passedField]) { setAlreadyPassed(true); setLoading(false); return; }
            const { data: lastAttempt } = await supabase.from("test_attempts").select("created_at, passed").eq("user_id", user.id).eq("test_key", TEST_CONFIG.type).order("created_at", { ascending: false }).limit(1).maybeSingle();
            if (lastAttempt && !lastAttempt.passed) {
                const cooldownEnd = new Date(new Date(lastAttempt.created_at).getTime() + 24 * 60 * 60 * 1000);
                if (cooldownEnd > new Date()) setCooldownUntil(cooldownEnd);
            }
            if (lastAttempt && !lastAttempt.passed) setPendingReview(false);
            setLoading(false);
        })();
    }, [router]);

    const handleSelect = (idx: number, choice: number) => {
        const a = [...answers]; a[idx] = choice; setAnswers(a);
    };
    const handleWritten = (idx: number, val: string) => {
        const w = [...writtenAnswers]; w[idx] = val; setWrittenAnswers(w);
    };

    const handleSubmit = async () => {
        if (!userId) return;
        if (answers.some(a => a === -1)) { alert("全ての選択問題に回答してください"); return; }
        if (writtenAnswers.some(w => !w.trim())) { alert("全ての記述問題に回答してください"); return; }
        if (!confirm(`提出してよろしいですか？\n\n選択式は自動採点、記述式はadminが評価します。\n全問正解 + admin承認で合格 (+${TEST_CONFIG.rewardPoints}pt)\n記述評価で追加 高+30pt / 中+10pt`)) return;
        setSubmitting(true);
        let correctCount = 0;
        QUESTIONS.forEach((q, i) => { if (answers[i] === q.correct) correctCount++; });
        const writtenObj: Record<string, string> = {};
        WRITTEN_QUESTIONS.forEach((q, i) => { writtenObj[q] = writtenAnswers[i]; });
        const passedSelection = correctCount === QUESTIONS.length;
        await supabase.from("test_attempts").insert({ user_id: userId, test_key: TEST_CONFIG.type, score: correctCount, passed: passedSelection, written_answers: writtenObj });
        if (passedSelection) {
            await supabase.from("profiles").update({ [TEST_CONFIG.passedField]: true, [`${TEST_CONFIG.passedField}_at`]: new Date().toISOString() }).eq("id", userId);
            // ポイント付与
            const { data: ptRow } = await supabase.from("user_points").select("points").eq("id", userId).maybeSingle();
            const currentPt = ptRow?.points || 0;
            await supabase.from("user_points").upsert({ id: userId, points: currentPt + TEST_CONFIG.rewardPoints });
            await supabase.from("points_history").insert({ user_id: userId, change: TEST_CONFIG.rewardPoints, reason: "謝罪逃避テスト合格" });
            alert(`✅ 提出しました！\n\n選択式: ${correctCount}/${QUESTIONS.length}問正解\n\nadminの審査後、合格時に${TEST_CONFIG.rewardPoints}pt付与されます。\n記述評価で追加 高+30pt / 中+10pt の可能性があります。`);
        } else {
            alert(`❌ 不合格\n\n選択式: ${correctCount}/${QUESTIONS.length}問正解（合格には全問正解必要）\n\n24時間後に再受験できます。`);
        }
        router.push("/tests");
    };

    if (loading) return <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Loading...</main>;
    if (alreadyPassed) return <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}><div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: 60 }}><div style={{ fontSize: 64, marginBottom: 16 }}>✅</div><h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>合格済みです</h1><p style={{ color: "#9ca3af", marginBottom: 24 }}>このテストには既に合格しています。</p><button onClick={() => router.push("/tests")} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>テスト一覧に戻る</button></div></main>;
    if (cooldownUntil) { const ms = cooldownUntil.getTime() - Date.now(); const hours = Math.floor(ms / 3600000); const mins = Math.floor((ms % 3600000) / 60000); return <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}><div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: 60 }}><div style={{ fontSize: 64, marginBottom: 16 }}>⏰</div><h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>クールダウン中</h1><p style={{ color: "#9ca3af", marginBottom: 24 }}>再受験まで {hours}時間{mins}分</p><button onClick={() => router.push("/tests")} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>テスト一覧に戻る</button></div></main>; }
    if (pendingReview) return <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}><div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: 60 }}><div style={{ fontSize: 64, marginBottom: 16 }}>⏳</div><h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>審査待ちです</h1><p style={{ color: "#9ca3af", marginBottom: 24 }}>admin の審査をお待ちください。<br />合格時に{TEST_CONFIG.rewardPoints}pt付与されます。<br />記述評価で追加 <strong style={{ color: "#10b981" }}>高+30pt / 中+10pt</strong></p><button onClick={() => router.push("/tests")} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>テスト一覧に戻る</button></div></main>;

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}>
            <div style={{ maxWidth: 720, margin: "0 auto" }}>
                <button onClick={() => router.push("/tests")} style={{ background: "transparent", border: "1px solid #374151", color: "#9ca3af", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, marginBottom: 16 }}>← テスト一覧</button>
                <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12, color: TEST_CONFIG.color }}>{TEST_CONFIG.title}</h1>
                <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6, padding: 16, background: `${TEST_CONFIG.color}10`, borderRadius: 12, marginBottom: 32, border: `1px solid ${TEST_CONFIG.color}33` }}>全{QUESTIONS.length + WRITTEN_QUESTIONS.length}問（選択式{QUESTIONS.length}問 + 記述式{WRITTEN_QUESTIONS.length}問）<br />合格条件：選択式全問正解 + admin承認<br />報酬：<strong style={{ color: TEST_CONFIG.color }}>{TEST_CONFIG.rewardPoints}pt</strong><span style={{ color: "#9ca3af", fontSize: 12, marginLeft: 8 }}>+ 記述評価で 高+30pt / 中+10pt</span></div>

                {QUESTIONS.map((q, i) => (
                    <div key={i} style={{ marginBottom: 24, padding: 20, background: "#111827", borderRadius: 12, border: "1px solid #1f2937" }}>
                        <div style={{ fontSize: 11, color: TEST_CONFIG.color, marginBottom: 6 }}>{q.section}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{q.q}</div>
                        {q.options.map((opt, j) => (
                            <button key={j} onClick={() => handleSelect(i, j)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", marginBottom: 6, borderRadius: 8, border: answers[i] === j ? `2px solid ${TEST_CONFIG.color}` : "1px solid #374151", background: answers[i] === j ? `${TEST_CONFIG.color}22` : "#0f172a", color: "#f9fafb", cursor: "pointer", fontSize: 13 }}>{opt}</button>
                        ))}
                    </div>
                ))}

                <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 40, marginBottom: 20 }}>📝 記述問題</h2>
                {WRITTEN_QUESTIONS.map((q, i) => (
                    <div key={i} style={{ marginBottom: 20, padding: 20, background: "#111827", borderRadius: 12, border: "1px solid #1f2937" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{q}</div>
                        <textarea value={writtenAnswers[i]} onChange={e => handleWritten(i, e.target.value)} placeholder="ここに記入..." style={{ width: "100%", minHeight: 80, padding: 10, borderRadius: 8, border: "1px solid #374151", background: "#0f172a", color: "#f9fafb", fontSize: 13, fontFamily: "inherit", resize: "vertical" }} />
                    </div>
                ))}

                <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: 16, marginTop: 24, borderRadius: 12, border: "none", background: submitting ? "#374151" : `linear-gradient(135deg, ${TEST_CONFIG.color}, ${TEST_CONFIG.color}dd)`, color: "#fff", fontSize: 16, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer" }}>{submitting ? "提出中..." : "📤 提出する"}</button>
            </div>
        </main>
    );
}
