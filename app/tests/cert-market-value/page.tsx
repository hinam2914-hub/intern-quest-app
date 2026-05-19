"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const QUESTIONS = [{"section": "Part①: 市場価値編", "q": "Q1. 今の時代、企業が最終的に見ているものとして近いのは？", "options": ["A. 資格数", "B. 学歴", "C. 実際に価値を出せるか", "D. 暗記力"], "correct": 2}, {"section": "Part①: 市場価値編", "q": "Q2. 「資格あるのに評価されない」理由として近いのは？", "options": ["A. 運悪い", "B. 時代が悪い", "C. 実務価値につながっていない", "D. 勉強不足"], "correct": 2}, {"section": "Part①: 市場価値編", "q": "Q3. 市場価値が高い人の特徴は？", "options": ["A. 資格マニア", "B. 行動経験がある", "C. テスト強い", "D. 暗記得意"], "correct": 1}, {"section": "Part①: 市場価値編", "q": "Q4. 資格だけで差別化しにくい理由は？", "options": ["A. 難しいから", "B. 誰でも取れる情報化時代だから", "C. 時間かかるから", "D. 意味ないから"], "correct": 1}, {"section": "Part①: 市場価値編", "q": "Q5. 今の時代に最も重要なのは？", "options": ["A. 暗記", "B. 肩書き", "C. 実行力と経験", "D. 資格数"], "correct": 2}, {"section": "Part①: 市場価値編", "q": "Q6. \"強い人\"に近いのは？", "options": ["A. 資格たくさん持ってる", "B. 実際に成果出した経験ある", "C. テスト高得点", "D. ノート綺麗"], "correct": 1}, {"section": "Part①: 市場価値編", "q": "Q7. 企業が欲しい人材として近いのは？", "options": ["A. 知識だけある人", "B. 指示待ち", "C. 行動して成果出せる人", "D. 資格コレクター"], "correct": 2}, {"section": "Part①: 市場価値編", "q": "Q8. 資格取得が危険になるケースは？", "options": ["A. 勉強嫌いになる", "B. \"やった気\"になる", "C. 時間かかる", "D. 友達減る"], "correct": 1}, {"section": "Part①: 市場価値編", "q": "Q9. 今後さらに価値が上がりやすいのは？", "options": ["A. 暗記資格", "B. AIで代替されやすい知識", "C. 人を動かす力・実行力", "D. 一般論知識"], "correct": 2}, {"section": "Part①: 市場価値編", "q": "Q10. 社会で最終的に評価されるのは？", "options": ["A. 資格持ってる人", "B. 知識量多い人", "C. 実際に成果出した人", "D. 勉強時間長い人"], "correct": 2}, {"section": "Part②: ケーススタディ", "q": "Q11. 資格だけあるが行動経験ゼロの人の弱みは？", "options": ["A. 暗い", "B. 真面目すぎる", "C. 実務再現性が見えない", "D. 優しすぎる"], "correct": 2}, {"section": "Part②: ケーススタディ", "q": "Q12. \"市場価値\"を上げる行動として近いのは？", "options": ["A. 資格だけ増やす", "B. 実務経験を積む", "C. ノートまとめる", "D. テスト勉強だけする"], "correct": 1}, {"section": "Part②: ケーススタディ", "q": "Q13. 「資格あるから大丈夫」の問題点は？", "options": ["A. 古い", "B. 暗い", "C. 市場視点不足になりやすい", "D. 効率悪い"], "correct": 2}, {"section": "Part②: ケーススタディ", "q": "Q14. 今後の時代に強い人は？", "options": ["A. 指示待ち", "B. 知識だけある人", "C. 行動しながら学べる人", "D. 資格数多い人"], "correct": 2}, {"section": "Part②: ケーススタディ", "q": "Q15. 資格の本来の使い方として近いのは？", "options": ["A. マウント", "B. ゴール", "C. 行動や実務の補助", "D. 承認欲求"], "correct": 2}];

const WRITTEN_QUESTIONS = ["Q16. 「資格」と「市場価値」の違いを書いてください", "Q17. 今の時代に価値が高い人材の特徴を書いてください", "Q18. 自分が\"勉強した気\"になっている部分を書いてください", "Q19. 実務経験が重要な理由を書いてください", "Q20. 今後AI時代で価値が上がる能力を書いてください", "Q21. 今後、自分が積むべき\"経験\"を書いてください"];

const TEST_CONFIG = {
    type: "cert_market_value",
    title: "💎 資格依存・市場価値現実",
    color: "#14b8a6",
    passedField: "cert_market_value_passed",
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
            await supabase.from("points_history").insert({ user_id: userId, change: TEST_CONFIG.rewardPoints, reason: "資格・市場価値テスト合格" });
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
