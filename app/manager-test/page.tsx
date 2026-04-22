"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type ChoiceQuestion = { num: number; question: string; options: { key: string; text: string }[]; answer: string };
type WrittenQuestion = { num: number; question: string };

const CHOICE_QUESTIONS: ChoiceQuestion[] = [
    { num: 1, question: "メンバーの成果が出ていないとき、最優先で考えるべきは？", options: [{ key: "A", text: "本人のやる気" }, { key: "B", text: "能力不足" }, { key: "C", text: "運" }, { key: "D", text: "自分のマネジメントの問題" }], answer: "D" },
    { num: 2, question: "チームの数字が未達のときの正しい行動は？", options: [{ key: "A", text: "メンバーを叱る" }, { key: "B", text: "様子を見る" }, { key: "C", text: "気合いで押す" }, { key: "D", text: "原因分解→改善施策実行" }], answer: "D" },
    { num: 3, question: "マネージャーの役割として最も重要なのは？", options: [{ key: "A", text: "自分が結果を出す" }, { key: "B", text: "部下と仲良くする" }, { key: "C", text: "指示を出す" }, { key: "D", text: "チームで結果を出す" }], answer: "D" },
    { num: 4, question: "優秀なメンバーに対する適切な対応は？", options: [{ key: "A", text: "放置する" }, { key: "B", text: "仕事を減らす" }, { key: "C", text: "評価だけする" }, { key: "D", text: "さらに成長機会を与える" }], answer: "D" },
    { num: 5, question: "メンバーがミスしたときの最適な対応は？", options: [{ key: "A", text: "感情的に叱る" }, { key: "B", text: "放置する" }, { key: "C", text: "本人に任せる" }, { key: "D", text: "原因を一緒に分析し再発防止" }], answer: "D" },
    { num: 6, question: "マネージャーに必要なスキルは？", options: [{ key: "A", text: "カリスマ性" }, { key: "B", text: "センス" }, { key: "C", text: "経験" }, { key: "D", text: "再現性のある仕組み化" }], answer: "D" },
    { num: 7, question: "チームの雰囲気が悪いときは？", options: [{ key: "A", text: "無視" }, { key: "B", text: "メンバー任せ" }, { key: "C", text: "誰かのせいにする" }, { key: "D", text: "自分が空気を変える" }], answer: "D" },
    { num: 8, question: "メンバーが指示待ち状態のときは？", options: [{ key: "A", text: "放置" }, { key: "B", text: "注意するだけ" }, { key: "C", text: "怒る" }, { key: "D", text: "主体性が出る設計にする" }], answer: "D" },
    { num: 9, question: "評価制度の目的は？", options: [{ key: "A", text: "順位をつけること" }, { key: "B", text: "モチベーション管理" }, { key: "C", text: "給料を決めること" }, { key: "D", text: "成長と成果を最大化すること" }], answer: "D" },
    { num: 10, question: "マネージャーの成果とは？", options: [{ key: "A", text: "自分の売上" }, { key: "B", text: "努力量" }, { key: "C", text: "チームの雰囲気" }, { key: "D", text: "チームの数字" }], answer: "D" },
    { num: 11, question: "メンバーがサボっていると感じたときは？", options: [{ key: "A", text: "怒る" }, { key: "B", text: "放置" }, { key: "C", text: "指摘だけ" }, { key: "D", text: "原因（仕組み・環境・目標）を分析" }], answer: "D" },
    { num: 12, question: "トップとボトムの差が大きいときは？", options: [{ key: "A", text: "トップを褒める" }, { key: "B", text: "ボトムを叱る" }, { key: "C", text: "何もしない" }, { key: "D", text: "ボトムの底上げ施策を作る" }], answer: "D" },
    { num: 13, question: "チームのKPIが不明確なときは？", options: [{ key: "A", text: "現状維持" }, { key: "B", text: "上司に任せる" }, { key: "C", text: "適当にやる" }, { key: "D", text: "分解して明確にする" }], answer: "D" },
    { num: 14, question: "メンバーが辞めそうなときは？", options: [{ key: "A", text: "引き止める" }, { key: "B", text: "無視" }, { key: "C", text: "気合い論" }, { key: "D", text: "原因ヒアリング→改善" }], answer: "D" },
    { num: 15, question: "成果が出ないメンバーへの対応は？", options: [{ key: "A", text: "切る" }, { key: "B", text: "放置" }, { key: "C", text: "怒る" }, { key: "D", text: "教育 or 配置転換" }], answer: "D" },
];

const WRITTEN_QUESTIONS: WrittenQuestion[] = [
    { num: 16, question: "チームで成果を出すために必要な要素を3つ書いてください" },
    { num: 17, question: "メンバーが成長しない原因とその解決策を書いてください" },
    { num: 18, question: "良いマネージャーとは何かを定義してください" },
    { num: 19, question: "自分のマネジメントの弱点と改善策を書いてください" },
    { num: 20, question: "チームの数字を上げるためにやるべきことを具体的に書いてください" },
    { num: 21, question: "離職を防ぐために必要なことを書いてください" },
];

export default function ManagerTestPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState("");
    const [userRole, setUserRole] = useState("");
    const [alreadyCertified, setAlreadyCertified] = useState(false);
    const [canRetry, setCanRetry] = useState(true);
    const [nextRetryAt, setNextRetryAt] = useState<string | null>(null);
    const [pendingReview, setPendingReview] = useState(false);

    const [choiceAnswers, setChoiceAnswers] = useState<Record<number, string>>({});
    const [writtenAnswers, setWrittenAnswers] = useState<Record<number, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);

            const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
            const role = profile?.role || "";
            setUserRole(role);

            if (!["Manager", "Owner"].includes(role)) {
                setLoading(false);
                return;
            }

            if ((profile as any)?.manager_certified) {
                setAlreadyCertified(true);
                setLoading(false);
                return;
            }

            const { data: pastTests } = await supabase.from("manager_tests")
                .select("*")
                .eq("user_id", user.id)
                .order("started_at", { ascending: false })
                .limit(1);

            if (pastTests && pastTests.length > 0) {
                const latest: any = pastTests[0];
                if (latest.status === "submitted" && latest.written_status === "pending") {
                    setPendingReview(true);
                } else if (latest.next_retry_at && new Date(latest.next_retry_at) > new Date()) {
                    setCanRetry(false);
                    setNextRetryAt(latest.next_retry_at);
                }
            }

            setLoading(false);
        };
        load();
    }, [router]);

    const handleSubmit = async () => {
        if (Object.keys(choiceAnswers).length < 15) {
            setMessage("選択式の問題に全て回答してください");
            return;
        }
        if (WRITTEN_QUESTIONS.some(q => !writtenAnswers[q.num] || writtenAnswers[q.num].trim().length < 20)) {
            setMessage("記述式は各問20文字以上で回答してください");
            return;
        }

        setSubmitting(true);
        setMessage("");

        let correct = 0;
        CHOICE_QUESTIONS.forEach(q => { if (choiceAnswers[q.num] === q.answer) correct++; });
        const passed = correct >= 14;

        const nextRetry = !passed ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() : null;

        const { data: testRow, error: testErr } = await supabase.from("manager_tests").insert({
            user_id: userId,
            status: "submitted",
            score_choice: correct,
            score_choice_total: 15,
            passed_choice: passed,
            written_status: passed ? "pending" : "skipped",
            submitted_at: new Date().toISOString(),
            next_retry_at: nextRetry,
        }).select().single();

        if (testErr || !testRow) {
            setMessage("送信エラー。もう一度お試しください");
            setSubmitting(false);
            return;
        }

        const choiceRows = CHOICE_QUESTIONS.map(q => ({
            test_id: (testRow as any).id,
            question_num: q.num,
            selected_answer: choiceAnswers[q.num],
            is_correct: choiceAnswers[q.num] === q.answer,
        }));
        await supabase.from("manager_test_choice_answers").insert(choiceRows);

        if (passed) {
            const writtenRows = WRITTEN_QUESTIONS.map(q => ({
                test_id: (testRow as any).id,
                question_num: q.num,
                answer: writtenAnswers[q.num],
            }));
            await supabase.from("manager_test_written_answers").insert(writtenRows);
        }

        setResult({ score: correct, passed });
        setSubmitting(false);
    };

    if (loading) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
        </main>
    );

    if (!["Manager", "Owner"].includes(userRole)) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px", fontFamily: "'Inter', sans-serif" }}>
                <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center", paddingTop: 80 }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
                    <h1 style={{ color: "#f9fafb", fontSize: 24, fontWeight: 800, marginBottom: 12 }}>このテストはマネージャー限定です</h1>
                    <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 32 }}>Manager または Owner 権限が必要です</p>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>メニューへ戻る</button>
                </div>
            </main>
        );
    }

    if (alreadyCertified) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px", fontFamily: "'Inter', sans-serif" }}>
                <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center", paddingTop: 80 }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>🎖️</div>
                    <h1 style={{ color: "#f9fafb", fontSize: 28, fontWeight: 800, marginBottom: 12 }}>マネージャー認定済み</h1>
                    <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 32 }}>あなたはすでにマネージャーテストに合格しています</p>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>メニューへ戻る</button>
                </div>
            </main>
        );
    }

    if (pendingReview) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px", fontFamily: "'Inter', sans-serif" }}>
                <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center", paddingTop: 80 }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>⏳</div>
                    <h1 style={{ color: "#f9fafb", fontSize: 24, fontWeight: 800, marginBottom: 12 }}>記述式レビュー中</h1>
                    <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 32 }}>選択式は合格しました。記述式の採点が完了するまでお待ちください</p>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>メニューへ戻る</button>
                </div>
            </main>
        );
    }

    if (!canRetry) {
        const retryDate = new Date(nextRetryAt!);
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px", fontFamily: "'Inter', sans-serif" }}>
                <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center", paddingTop: 80 }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>🕒</div>
                    <h1 style={{ color: "#f9fafb", fontSize: 24, fontWeight: 800, marginBottom: 12 }}>クールダウン中</h1>
                    <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 8 }}>前回のテストから3日以内のため再挑戦できません</p>
                    <p style={{ color: "#818cf8", fontSize: 14, fontWeight: 700, marginBottom: 32 }}>次回挑戦可能: {retryDate.toLocaleString("ja-JP")}</p>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>メニューへ戻る</button>
                </div>
            </main>
        );
    }

    if (result) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px", fontFamily: "'Inter', sans-serif" }}>
                <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center", paddingTop: 80 }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>{result.passed ? "🎉" : "💪"}</div>
                    <h1 style={{ color: "#f9fafb", fontSize: 28, fontWeight: 800, marginBottom: 12 }}>{result.passed ? "選択式 合格！" : "選択式 不合格"}</h1>
                    <p style={{ color: "#9ca3af", fontSize: 16, marginBottom: 8 }}>スコア: <span style={{ color: result.passed ? "#34d399" : "#f87171", fontWeight: 800 }}>{result.score} / 15</span></p>
                    {result.passed && <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 32 }}>記述式の回答は運営レビュー中です。承認されるとマネージャー認定となり500ptが付与されます</p>}
                    {!result.passed && <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 32 }}>合格基準: 14問以上。3日後に再挑戦できます</p>}
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>メニューへ戻る</button>
                </div>
            </main>
        );
    }

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 800, margin: "0 auto" }}>
                <div onClick={() => router.push("/menu")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", marginBottom: 8 }}>INTERN QUEST</div>
                <h1 style={{ color: "#f9fafb", fontSize: 28, fontWeight: 800, margin: "0 0 8px" }}>🎖️ マネージャー認定テスト</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 32 }}>プレイヤー脳 → 経営脳 への進化チェック。選択式15問 + 記述式6問</p>

                <div style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", marginBottom: 32 }}>
                    <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>⚠️ 合格基準</div>
                    <div style={{ color: "#d1d5db", fontSize: 12, lineHeight: 1.7 }}>選択式: 14問以上正解（厳しめ）／記述式: 各問20文字以上、運営レビュー制／不合格時は3日後に再挑戦可能</div>
                </div>

                <h2 style={{ color: "#818cf8", fontSize: 13, fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>PART 1: 選択式（15問）</h2>
                {CHOICE_QUESTIONS.map(q => (
                    <div key={q.num} style={{ padding: "20px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 12 }}>
                        <div style={{ color: "#f9fafb", fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Q{q.num}. {q.question}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {q.options.map(opt => {
                                const selected = choiceAnswers[q.num] === opt.key;
                                return (
                                    <button key={opt.key} onClick={() => setChoiceAnswers(prev => ({ ...prev, [q.num]: opt.key }))} style={{ padding: "10px 14px", borderRadius: 8, border: selected ? "1px solid rgba(99,102,241,0.6)" : "1px solid rgba(255,255,255,0.08)", background: selected ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.02)", color: selected ? "#a5b4fc" : "#d1d5db", fontSize: 13, cursor: "pointer", fontWeight: 600, textAlign: "left" }}>{opt.key}. {opt.text}</button>
                                );
                            })}
                        </div>
                    </div>
                ))}

                <h2 style={{ color: "#818cf8", fontSize: 13, fontWeight: 700, letterSpacing: 2, margin: "32px 0 16px" }}>PART 2: 記述式（6問・各20文字以上）</h2>
                {WRITTEN_QUESTIONS.map(q => (
                    <div key={q.num} style={{ padding: "20px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 12 }}>
                        <div style={{ color: "#f9fafb", fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Q{q.num}. {q.question}</div>
                        <textarea value={writtenAnswers[q.num] || ""} onChange={(e) => setWrittenAnswers(prev => ({ ...prev, [q.num]: e.target.value }))} placeholder="回答を入力..." style={{ width: "100%", minHeight: 100, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                        <div style={{ color: "#6b7280", fontSize: 11, marginTop: 4, textAlign: "right" }}>{(writtenAnswers[q.num] || "").length} 文字</div>
                    </div>
                ))}

                {message && <div style={{ color: "#f87171", fontSize: 13, fontWeight: 600, marginBottom: 16, textAlign: "center" }}>{message}</div>}

                <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: submitting ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", marginTop: 16 }}>{submitting ? "送信中..." : "テストを送信"}</button>
            </div>
        </main>
    );
}
