"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const QUESTIONS = [{"section": "Part①: 組織理解編", "q": "Q1. 社会で最終的に価値が高くなりやすい人は？", "options": ["A. 一人で完結できる人", "B. 作業が早い人", "C. 他人を動かせる人", "D. 話が面白い人"], "correct": 2}, {"section": "Part①: 組織理解編", "q": "Q2. \"マネジメント力\"に最も近いものは？", "options": ["A. 怒れること", "B. 指示すること", "C. 人と成果を動かす力", "D. 圧が強いこと"], "correct": 2}, {"section": "Part①: 組織理解編", "q": "Q3. 仕事で成果を大きくするために必要なのは？", "options": ["A. 気合い", "B. 個人能力だけ", "C. 協働と仕組み", "D. 根性論"], "correct": 2}, {"section": "Part①: 組織理解編", "q": "Q4. \"他社との協働\"が弱い人に多い特徴は？", "options": ["A. 真面目", "B. 自分視点が強い", "C. 優しい", "D. 無口"], "correct": 1}, {"section": "Part①: 組織理解編", "q": "Q5. 社会で最も危険なのは？", "options": ["A. ミスすること", "B. 一人で抱え込むこと", "C. 緊張すること", "D. 学歴不足"], "correct": 1}, {"section": "Part①: 組織理解編", "q": "Q6. 「自分だけ頑張る」の限界は？", "options": ["A. 疲れる", "B. 時間と影響力に限界がある", "C. 人脈減る", "D. 成長止まる"], "correct": 1}, {"section": "Part①: 組織理解編", "q": "Q7. 強いマネージャーの特徴として近いのは？", "options": ["A. 圧がある", "B. 全部自分でやる", "C. 周囲を機能させる", "D. 感情が強い"], "correct": 2}, {"section": "Part①: 組織理解編", "q": "Q8. 協働力が高い人は何を意識する？", "options": ["A. 自分の感情", "B. 自分の成果だけ", "C. 相手の状況や全体最適", "D. 空気だけ"], "correct": 2}, {"section": "Part①: 組織理解編", "q": "Q9. 「自分は悪くない」が多い人に起きやすいことは？", "options": ["A. 自信つく", "B. 協働が壊れる", "C. 個性出る", "D. 行動力上がる"], "correct": 1}, {"section": "Part①: 組織理解編", "q": "Q10. \"社会価値\"が高い人に近いのは？", "options": ["A. 作業者", "B. 指示待ち", "C. 周囲の成果も上げられる人", "D. 自己主張強い人"], "correct": 2}, {"section": "Part②: ケーススタディ", "q": "Q11. チーム成果が悪い時に最も重要なのは？", "options": ["A. 誰かを責める", "B. 自分だけ頑張る", "C. 構造と連携を見直す", "D. 気合い入れる"], "correct": 2}, {"section": "Part②: ケーススタディ", "q": "Q12. 「自分の仕事だけやればいい」の問題点は？", "options": ["A. 暗い", "B. 空気悪い", "C. 全体最適が崩れる", "D. 真面目すぎる"], "correct": 2}, {"section": "Part②: ケーススタディ", "q": "Q13. 他社連携で最も重要なのは？", "options": ["A. テンション", "B. 自社都合", "C. 相手理解と進捗共有", "D. 圧力"], "correct": 2}, {"section": "Part②: ケーススタディ", "q": "Q14. マネジメント力が弱い人に多いのは？", "options": ["A. 指摘できない", "B. 全部感覚で動く", "C. 相手視点不足", "D. 明るい"], "correct": 2}, {"section": "Part②: ケーススタディ", "q": "Q15. 最終的に出世・影響力が伸びやすい人は？", "options": ["A. 個人プレー最強", "B. 自己主張強い", "C. 人を育て動かせる", "D. 感情豊か"], "correct": 2}];

const WRITTEN_QUESTIONS = ["Q16. 「マネジメント力」とは何か、自分の言葉で説明してください", "Q17. 最近、他人との連携不足で起きた問題を書いてください", "Q18. \"協働が弱い人\"の特徴を書いてください", "Q19. 今の自分が\"自分視点\"になっている部分を書いてください", "Q20. 「周囲を動かせる人」の特徴を書いてください", "Q21. 今後、自分が強化すべき\"協働力\"を書いてください"];

const TEST_CONFIG = {
    type: "management_collab",
    title: "🤝 マネジメント・協働価値",
    color: "#06b6d4",
    passedField: "management_collab_passed",
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
            await supabase.from("points_history").insert({ user_id: userId, change: TEST_CONFIG.rewardPoints, reason: "マネジメント・協働価値テスト合格" });
            alert(`✅ 提出しました！\n\n選択式: ${correctCount}/${QUESTIONS.length}問正解\n\nadminの審査後、合格時に${TEST_CONFIG.rewardPoints}pt付与されます。\n記述評価で追加 高+30pt / 中+10pt の可能性があります。`);
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
