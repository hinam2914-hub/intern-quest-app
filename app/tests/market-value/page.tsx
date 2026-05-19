"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const TEST_KEY = "market_value";
const TEST_NAME = "💪 市場価値認識テスト";
const TEST_COLOR = "#0891b2";
const TEST_POINTS = 50;
const PASS_THRESHOLD = 15; // 満点必須
const COOLDOWN_HOURS = 24;

const questions = [
    { id: 1, q: "就活において企業側が見ているものとして最も近いのは？", options: ["学生の夢", "学生の気持ち", "一緒に成果を出せるか", "SNSの雰囲気"], correct: 2 },
    { id: 2, q: "「とりあえず大手行きたい」という発言で弱いのは？", options: ["ambition", "行動力", "主体性", "判断軸"], correct: 3 },
    { id: 3, q: "企業が新卒採用で最も避けたい人材は？", options: ["緊張する人", "未経験な人", "指示待ち・他責な人", "学歴低い人"], correct: 2 },
    { id: 4, q: "ESや面接で最も伝わるものは？", options: ["綺麗な言葉", "自信", "行動実績", "テンション"], correct: 2 },
    { id: 5, q: "「就活がうまくいかない」人に多い特徴は？", options: ["運が悪い", "学歴不足", "市場理解不足", "面接回数不足"], correct: 2 },
    { id: 6, q: "企業が学生を見る視点として近いのは？", options: ["お客様", "仲間候補", "将来の利益を生む存在", "若者代表"], correct: 2 },
    { id: 7, q: "「選ばれる人」の特徴は？", options: ["話がうまい", "雰囲気がいい", "価値提供できそう", "陽キャ"], correct: 2 },
    { id: 8, q: "企業が\"ポテンシャル\"を見る時に重要なのは？", options: ["夢の大きさ", "意識高さ", "行動量と継続", "SNS発信"], correct: 2 },
    { id: 9, q: "「自分を選んでもらう」という感覚が弱い人は？", options: ["自信ない", "行動不足", "学生気分が抜けていない", "緊張しやすい"], correct: 2 },
    { id: 10, q: "企業が最終的に見ているのは？", options: ["学歴", "第一印象", "一緒に働けるか", "面白さ"], correct: 2 },
    { id: 11, q: "面接で「御社が第一志望です」と言うだけでは弱い理由は？", options: ["普通だから", "みんな言うから", "根拠がないと意味が薄いから", "テンプレだから"], correct: 2 },
    { id: 12, q: "「やりたいことが分からない」のに企業選びしている状態は？", options: ["普通", "若いから仕方ない", "軸不足", "問題ない"], correct: 2 },
    { id: 13, q: "企業が学生に求める\"最低ライン\"として近いのは？", options: ["コミュ力", "学歴", "約束守れる・動ける", "陽キャ感"], correct: 2 },
    { id: 14, q: "「どこでもいいから内定欲しい」の問題点は？", options: ["焦りすぎ", "甘え", "判断基準がない", "行動不足"], correct: 2 },
    { id: 15, q: "就活で本当に強い人は？", options: ["面接慣れしてる人", "学歴高い人", "行動経験がある人", "インターン数多い人"], correct: 2 },
];

const writtenQuestions = [
    { id: 16, q: "企業が学生を選ぶ理由を、自分の言葉で説明してください" },
    { id: 17, q: "「企業に選ばれる人」の特徴を書いてください" },
    { id: 18, q: "今の自分が企業側から見て弱いと思う点を書いてください" },
    { id: 19, q: "企業が\"お金を払ってでも欲しい人材\"とはどんな人か説明してください" },
    { id: 20, q: "「学生気分」と「社会人思考」の違いを書いてください" },
    { id: 21, q: "今の自分が\"選ばれる側\"になるために必要な行動を書いてください" },
];

export default function MarketValueTest() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [alreadyPassed, setAlreadyPassed] = useState(false);
    const [cooldownUntil, setCooldownUntil] = useState<Date | null>(null);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [writtenAnswers, setWrittenAnswers] = useState<Record<number, string>>({});
    const [showResult, setShowResult] = useState(false);
    const [score, setScore] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);

            const { data: profile } = await supabase.from("profiles").select(`${TEST_KEY}_passed`).eq("id", user.id).single();
            if ((profile as any)?.[`${TEST_KEY}_passed`]) {
                setAlreadyPassed(true);
                setLoading(false);
                return;
            }

            const { data: lastAttempt } = await supabase
                .from("test_attempts")
                .select("created_at")
                .eq("user_id", user.id)
                .eq("test_key", TEST_KEY)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

            if (lastAttempt) {
                const lastDate = new Date(lastAttempt.created_at);
                const cooldownEnd = new Date(lastDate.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
                if (cooldownEnd > new Date()) setCooldownUntil(cooldownEnd);
            }

            setLoading(false);
        };
        load();
    }, [router]);

    const handleSelect = (qid: number, optIndex: number) => {
        setAnswers(prev => ({ ...prev, [qid]: optIndex }));
    };

    const handleWritten = (qid: number, text: string) => {
        setWrittenAnswers(prev => ({ ...prev, [qid]: text }));
    };

    const handleSubmit = async () => {
        if (!userId) return;
        if (Object.keys(answers).length < questions.length) {
            alert(`全${questions.length}問の選択問題に回答してください`);
            return;
        }
        const unfilled = writtenQuestions.filter(w => !writtenAnswers[w.id] || writtenAnswers[w.id].trim().length < 10);
        if (unfilled.length > 0) {
            alert(`記述問題は全て10文字以上で回答してください（未回答: ${unfilled.length}問）`);
            return;
        }

        setSubmitting(true);
        let correctCount = 0;
        questions.forEach(q => { if (answers[q.id] === q.correct) correctCount++; });
        setScore(correctCount);

        const passed = correctCount >= PASS_THRESHOLD;

        await supabase.from("test_attempts").insert({
            user_id: userId,
            test_key: TEST_KEY,
            score: correctCount,
            passed,
            written_answers: writtenAnswers,
            answers,
        });

        if (passed) {
            await supabase.from("profiles").update({ market_value_passed: true, market_value_passed_at: new Date().toISOString() }).eq("id", userId);
        }
        setShowResult(true);
        setSubmitting(false);
    };

    if (loading) {
        return <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: TEST_COLOR }}>Loading...</main>;
    }

    if (alreadyPassed) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px", color: "#f9fafb" }}>
                <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center", padding: 60, borderRadius: 16, background: `${TEST_COLOR}15`, border: `1px solid ${TEST_COLOR}66` }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>🏆</div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12, color: TEST_COLOR }}>合格済み</h1>
                    <p style={{ color: "#9ca3af", lineHeight: 1.7 }}>{TEST_NAME}は既に合格済みです</p>
                    <button onClick={() => router.push("/tests")} style={{ marginTop: 24, padding: "10px 24px", borderRadius: 8, border: "none", background: TEST_COLOR, color: "#fff", fontWeight: 700, cursor: "pointer" }}>テスト一覧に戻る</button>
                </div>
            </main>
        );
    }

    if (cooldownUntil) {
        const remainingMs = cooldownUntil.getTime() - Date.now();
        const hours = Math.floor(remainingMs / 1000 / 60 / 60);
        const minutes = Math.floor(remainingMs / 1000 / 60) % 60;
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px", color: "#f9fafb" }}>
                <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center", padding: 60, borderRadius: 16, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.4)" }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>⏳</div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12, color: "#f59e0b" }}>クールダウン中</h1>
                    <p style={{ color: "#9ca3af", lineHeight: 1.7 }}>あと {hours}時間{minutes}分後に再受験できます</p>
                    <button onClick={() => router.push("/tests")} style={{ marginTop: 24, padding: "10px 24px", borderRadius: 8, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 700, cursor: "pointer" }}>テスト一覧に戻る</button>
                </div>
            </main>
        );
    }

    if (showResult) {
        const passed = score >= PASS_THRESHOLD;
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px", color: "#f9fafb" }}>
                <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center", padding: 60, borderRadius: 16, background: passed ? `${TEST_COLOR}15` : "rgba(239,68,68,0.1)", border: `1px solid ${passed ? TEST_COLOR : "#ef4444"}66` }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>{passed ? "🎉" : "😔"}</div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, color: passed ? TEST_COLOR : "#ef4444" }}>{passed ? "1次合格！" : "不合格"}</h1>
                    <div style={{ fontSize: 48, fontWeight: 900, color: passed ? TEST_COLOR : "#ef4444", marginBottom: 8 }}>{score}<span style={{ fontSize: 20, color: "#6b7280" }}>/{questions.length}問</span></div>
                    <p style={{ color: "#9ca3af", lineHeight: 1.7, marginTop: 16 }}>
                        {passed
                            ? `選択問題は合格です。記述問題はadminが審査します。\n承認後、${TEST_POINTS}ptと合格バッジが付与されます🏆`
                            : `合格には${PASS_THRESHOLD}問以上の正解が必要です。\n24時間後に再受験できます。`}
                    </p>
                    <button onClick={() => router.push("/tests")} style={{ marginTop: 24, padding: "10px 24px", borderRadius: 8, border: "none", background: passed ? TEST_COLOR : "#6b7280", color: "#fff", fontWeight: 700, cursor: "pointer" }}>テスト一覧に戻る</button>
                </div>
            </main>
        );
    }

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}>
            <div style={{ maxWidth: 800, margin: "0 auto" }}>
                <button onClick={() => router.push("/tests")} style={{ marginBottom: 24, padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>← テスト一覧に戻る</button>

                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 12, color: TEST_COLOR, fontWeight: 700, letterSpacing: 3, marginBottom: 4 }}>TEIOU TEST</div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "0 0 8px" }}>{TEST_NAME}</h1>
                    <p style={{ color: "#9ca3af", fontSize: 13, lineHeight: 1.7 }}>
                        企業が選ぶ側の視点を理解するためのテスト。<br />
                        全15問選択問題（{PASS_THRESHOLD}問以上正解で1次合格）+ 記述6問（admin審査）。<br />
                        合格で <span style={{ color: TEST_COLOR, fontWeight: 700 }}>{TEST_POINTS}pt</span>獲得 🏆
                    </p>
                </div>

                {/* 選択問題 */}
                <div style={{ marginBottom: 32, padding: 24, borderRadius: 16, background: `${TEST_COLOR}08`, border: `1px solid ${TEST_COLOR}30` }}>
                    <div style={{ fontSize: 13, color: TEST_COLOR, fontWeight: 700, marginBottom: 16 }}>📝 Part① 就活の現実 / Part② ケーススタディ</div>
                    {questions.map((q, idx) => (
                        <div key={q.id} style={{ marginBottom: 20, padding: 16, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 4 }}>Q{idx + 1}</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>{q.q}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {q.options.map((opt, optIdx) => (
                                    <button key={optIdx} onClick={() => handleSelect(q.id, optIdx)} style={{
                                        padding: "10px 14px",
                                        borderRadius: 8,
                                        border: `1px solid ${answers[q.id] === optIdx ? TEST_COLOR : "rgba(255,255,255,0.1)"}`,
                                        background: answers[q.id] === optIdx ? `${TEST_COLOR}25` : "rgba(0,0,0,0.2)",
                                        color: answers[q.id] === optIdx ? TEST_COLOR : "#d1d5db",
                                        fontSize: 13,
                                        fontWeight: answers[q.id] === optIdx ? 700 : 500,
                                        cursor: "pointer",
                                        textAlign: "left",
                                    }}>
                                        {String.fromCharCode(65 + optIdx)}. {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* 記述問題 */}
                <div style={{ marginBottom: 32, padding: 24, borderRadius: 16, background: `${TEST_COLOR}08`, border: `1px solid ${TEST_COLOR}30` }}>
                    <div style={{ fontSize: 13, color: TEST_COLOR, fontWeight: 700, marginBottom: 16 }}>✍️ Part③ 筆記（admin審査）</div>
                    {writtenQuestions.map((q, idx) => (
                        <div key={q.id} style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 4 }}>Q{questions.length + idx + 1}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 8 }}>{q.q}</div>
                            <textarea
                                value={writtenAnswers[q.id] || ""}
                                onChange={(e) => handleWritten(q.id, e.target.value)}
                                placeholder="あなたの考えを書いてください（10文字以上）"
                                style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box", minHeight: 80, resize: "vertical", fontFamily: "inherit" }}
                            />
                        </div>
                    ))}
                </div>

                {/* 提出ボタン */}
                <button onClick={handleSubmit} disabled={submitting} style={{
                    width: "100%",
                    padding: "16px 24px",
                    borderRadius: 12,
                    border: "none",
                    background: submitting ? "rgba(8,145,178,0.4)" : `linear-gradient(135deg, ${TEST_COLOR}, #06b6d4)`,
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: submitting ? "not-allowed" : "pointer",
                    boxShadow: `0 0 30px ${TEST_COLOR}50`,
                }}>
                    {submitting ? "送信中..." : "💪 テストを提出する"}
                </button>
            </div>
        </main>
    );
}