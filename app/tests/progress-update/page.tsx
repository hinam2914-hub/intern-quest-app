"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const QUESTIONS = [{"section": "Part①: 進捗更新編", "q": "Q1. 進捗更新の本質として最も近いのは？", "options": ["A. 怒られないため", "B. 空気を良くするため", "C. 相手が判断できる状態を作るため", "D. 礼儀だから"], "correct": 2}, {"section": "Part①: 進捗更新編", "q": "Q2. 進捗報告が遅い人に起きやすい問題は？", "options": ["A. 疲れる", "B. 信頼が下がる", "C. 時間が減る", "D. 会話が減る"], "correct": 1}, {"section": "Part①: 進捗更新編", "q": "Q3. 「終わってから報告します」の問題点は？", "options": ["A. 真面目すぎる", "B. 相談タイミングを失う", "C. 責任感ある", "D. 効率いい"], "correct": 1}, {"section": "Part①: 進捗更新編", "q": "Q4. 仕事で最も危険なのは？", "options": ["A. ミスする", "B. 遅い", "C. 問題を抱え込む", "D. 緊張する"], "correct": 2}, {"section": "Part①: 進捗更新編", "q": "Q5. 進捗更新が強い人の特徴は？", "options": ["A. 話うまい", "B. 返信早い", "C. 小さい変化でも共有する", "D. 明るい"], "correct": 2}, {"section": "Part①: 進捗更新編", "q": "Q6. 「まだ大丈夫です」が危険な理由は？", "options": ["A. 曖昧だから", "B. 暗いから", "C. 感情論だから", "D. 空気悪いから"], "correct": 0}, {"section": "Part①: 進捗更新編", "q": "Q7. 信頼される人の特徴は？", "options": ["A. ミスしない", "B. 問題を早く共有する", "C. 気合いある", "D. 自信ある"], "correct": 1}, {"section": "Part①: 進捗更新編", "q": "Q8. 報連相が弱い人に多いのは？", "options": ["A. 優しい", "B. 不安回避", "C. 頭いい", "D. 行動力ある"], "correct": 1}, {"section": "Part①: 進捗更新編", "q": "Q9. 進捗更新で最も重要なのは？", "options": ["A. 長文", "B. 頻度", "C. 事実と現状共有", "D. テンション"], "correct": 2}, {"section": "Part①: 進捗更新編", "q": "Q10. \"できる人\"ほど進捗共有する理由は？", "options": ["A. 暇だから", "B. 褒められたいから", "C. 全体最適を考えるから", "D. おしゃべりだから"], "correct": 2}, {"section": "Part②: ケアレスミス編", "q": "Q11. ケアレスミスが多い人に不足しやすいのは？", "options": ["A. 才能", "B. センス", "C. 確認習慣", "D. コミュ力"], "correct": 2}, {"section": "Part②: ケアレスミス編", "q": "Q12. \"確認不足\"が危険な理由は？", "options": ["A. 恥ずかしいから", "B. 時間かかるから", "C. 信頼コストが高いから", "D. 怒られるから"], "correct": 2}, {"section": "Part②: ケアレスミス編", "q": "Q13. 同じミスを繰り返す状態とは？", "options": ["A. 普通", "B. 成長途中", "C. 改善不足", "D. 若いから仕方ない"], "correct": 2}, {"section": "Part②: ケアレスミス編", "q": "Q14. ミスを減らす人の特徴は？", "options": ["A. メモする", "B. 気合いある", "C. 仕組み化する", "D. 頭いい"], "correct": 2}, {"section": "Part②: ケアレスミス編", "q": "Q15. 最も危険な考え方は？", "options": ["A. 「確認しよう」", "B. 「あとでやろう」", "C. 「たぶん大丈夫」", "D. 「メモしよう」"], "correct": 2}];

const WRITTEN_QUESTIONS = ["Q16. 最近\"進捗共有不足\"で困った経験を書いてください", "Q17. 「報連相が弱い人」の特徴を書いてください", "Q18. 最近したケアレスミスと、その原因を書いてください", "Q19. ケアレスミスを減らすための仕組みを3つ書いてください", "Q20. 「信頼される進捗更新」とは何か説明してください", "Q21. 今の自分が\"雑になっている部分\"を書いてください"];

const TEST_CONFIG = {
    type: "progress_update",
    title: "📡 進捗更新・ケアレスミス改善",
    color: "#84cc16",
    passedField: "progress_update_passed",
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
            await supabase.from("points_history").insert({ user_id: userId, change: TEST_CONFIG.rewardPoints, reason: "進捗更新テスト合格" });
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
