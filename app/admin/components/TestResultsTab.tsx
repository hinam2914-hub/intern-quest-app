"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Attempt = {
    id: string;
    user_id: string;
    test_key: string;
    score: number;
    passed: boolean;
    created_at: string;
    written_answers: any;
    written_evaluation?: "high" | "mid" | "none" | null;
    written_points_awarded?: number;
    evaluated_at?: string | null;
    userName?: string;
    source: "quiz_attempts" | "test_attempts";
};

type ManagerTest = {
    id: string;
    user_id: string;
    submitted_at: string;
    score_choice: number;
    score_choice_total: number;
    passed_choice: boolean;
    written_status: "pending" | "approved" | "rejected" | "skipped";
    points_awarded: number;
    userName?: string;
    written: { id: string; question_num: number; answer: string }[];
};

const TEST_LABELS: Record<string, { label: string; color: string; icon: string }> = {
    quiz: { label: "確認ワーク", color: "#a78bfa", icon: "🧠" },
    mentor: { label: "メンター", color: "#10b981", icon: "🧭" },
    retention: { label: "Dot.A雇用テスト", color: "#ef4444", icon: "🔥" },
    entrepreneur: { label: "起業適性", color: "#f59e0b", icon: "🚀" },
    marketer: { label: "マーケター適性", color: "#06b6d4", icon: "📊" },
    sales: { label: "営業デビュー", color: "#8b5cf6", icon: "💼" },
    planner: { label: "企画職適性", color: "#ec4899", icon: "💡" },
    manager: { label: "マネージャー", color: "#ec4899", icon: "🎖️" },
};

const WRITTEN_QUESTIONS: Record<string, string[]> = {
    quiz: [
        "「信頼を得るために必要な行動」を3つ書いてください",
        "「成長が早い人の特徴」を具体的に説明してください",
        "「なぜ報連相は重要なのか？」を説明してください",
        "「自分がこれまでにサボった経験」と「改善策」を書いてください",
        "「今の自分に足りないもの」と「それをどう補うか」",
        "「このインターンで得たいもの」",
    ],
    mentor: [
        "メンターとしての自分の強み・弱み",
        "メンティーが「やる気ない」と言ってきたときの対応",
        "後輩に自分のノウハウを伝える難しさと対策",
        "自分が過去に受けたメンタリングで良かった/悪かった経験",
        "メンター制度が会社にもたらす価値",
        "今のメンバーに対してやってあげたいこと",
    ],
    retention: [
        "今Dot.Aに残るべき理由を3つ",
        "もし辞めるとしたら何が原因になるか",
        "自分がDot.Aに提供できる価値",
        "自分がDot.Aからもらいたい価値",
        "半年後・1年後の自分",
        "Dot.Aで成し遂げたいこと",
    ],
    entrepreneur: [
        "自分が起業するとしたら何の事業か",
        "起業家に最も必要な資質を3つ",
        "失敗リスクをどう捉えるか",
        "資金調達の方針",
        "起業するまでに今やるべきこと",
        "自分が起業に向いてる/向いてない理由",
    ],
    marketer: [
        "「なぜ営業経験がマーケに必要か」を説明してください",
        "「売れない原因」を3つに分解してください",
        "「売れる導線」を具体的に説明してください（例：認知→興味→比較→行動）",
        "「今売っているサービスを売るならどう改善するか」",
        "「1→10に伸ばすためにやること」を書いてください",
        "「自分がマーケターとして不足している点」",
    ],
    sales: [
        "営業で「信頼を得る行動」を3つ書いてください",
        "なぜ営業は断られるのか説明してください",
        "ヒアリングで聞くべき内容を3つ書いてください",
        "自分が営業でつまずきそうなポイントと対策",
        "1ヶ月で成果を出すための行動計画",
        "なぜ営業をやるのか",
    ],
    planner: [
        "なぜ営業経験が企画に必要なのか説明してください",
        "売れる企画と売れない企画の違いを具体的に書いてください",
        "売れる導線（認知→興味→比較→行動）を説明してください",
        "今の事業で改善できる企画案を1つ出してください",
        "企画が失敗する原因と対策を書いてください",
        "自分が企画職に足りていないもの",
    ],
};

const EVAL_POINTS = { high: 100, mid: 50, none: 0 };

export default function TestResultsTab() {
    const [attempts, setAttempts] = useState<Attempt[]>([]);
    const [managerTests, setManagerTests] = useState<ManagerTest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "passed" | "needs_eval">("all");
    const [selectedTest, setSelectedTest] = useState<string>("all");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [evaluating, setEvaluating] = useState<string | null>(null);
    const [managerFilter, setManagerFilter] = useState<"pending" | "all">("pending");

    useEffect(() => {
        const load = async () => {
            // 通常テスト取得
            const { data: testRows } = await supabase.from("test_attempts").select("*").order("created_at", { ascending: false });
            const { data: quizRows } = await supabase.from("quiz_attempts").select("*").order("created_at", { ascending: false });
            const { data: profileRows } = await supabase.from("profiles").select("id, name");

            const merged: Attempt[] = [];
            (testRows || []).forEach((a: any) => {
                merged.push({
                    ...a,
                    userName: profileRows?.find((p: any) => p.id === a.user_id)?.name || "（名前未設定）",
                    source: "test_attempts",
                });
            });
            (quizRows || []).forEach((a: any) => {
                merged.push({
                    ...a,
                    test_key: "quiz",
                    userName: profileRows?.find((p: any) => p.id === a.user_id)?.name || "（名前未設定）",
                    source: "quiz_attempts",
                });
            });
            merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setAttempts(merged);

            // マネージャーテスト取得
            const { data: mgrRows } = await supabase.from("manager_tests").select("*").eq("status", "submitted").order("submitted_at", { ascending: false });
            if (mgrRows && mgrRows.length > 0) {
                const mgrWithDetails = await Promise.all((mgrRows as any[]).map(async (t: any) => {
                    const { data: written } = await supabase.from("manager_test_written_answers").select("*").eq("test_id", t.id).order("question_num");
                    return {
                        ...t,
                        userName: profileRows?.find((p: any) => p.id === t.user_id)?.name || "（名前未設定）",
                        written: written || [],
                    };
                }));
                setManagerTests(mgrWithDetails as ManagerTest[]);
            }

            setLoading(false);
        };
        load();
    }, []);

    const handleEvaluate = async (attempt: Attempt, evaluation: "high" | "mid" | "none") => {
        if (evaluating) return;
        const newPoints = EVAL_POINTS[evaluation];
        const oldPoints = attempt.written_points_awarded || 0;
        const diff = newPoints - oldPoints;

        if (!confirm(`${attempt.userName}さんの記述を「${evaluation === "high" ? "高評価+100pt" : evaluation === "mid" ? "中評価+50pt" : "評価なし"}」にしますか？\n${diff > 0 ? `+${diff}pt 付与されます` : diff < 0 ? `${diff}pt 減算されます` : "ポイント変動なし"}`)) return;

        setEvaluating(attempt.id);
        const nowIso = new Date().toISOString();
        const { data: { user } } = await supabase.auth.getUser();

        // 評価をDBに記録
        await supabase.from(attempt.source).update({
            written_evaluation: evaluation,
            written_points_awarded: newPoints,
            evaluated_at: nowIso,
            evaluated_by: user?.id,
        }).eq("id", attempt.id);

        // ポイント差分を反映
        if (diff !== 0) {
            const { data: ptRow } = await supabase.from("user_points").select("points").eq("id", attempt.user_id).maybeSingle();
            const currentPt = (ptRow as any)?.points || 0;
            await supabase.from("user_points").upsert({ id: attempt.user_id, points: Math.max(0, currentPt + diff) });
            if (diff > 0) {
                await supabase.from("points_history").insert({
                    user_id: attempt.user_id,
                    change: diff,
                    reason: `written_evaluation_${evaluation}`,
                    created_at: nowIso,
                });
            }
        }

        // 状態更新
        setAttempts(prev => prev.map(a => a.id === attempt.id ? { ...a, written_evaluation: evaluation, written_points_awarded: newPoints, evaluated_at: nowIso } : a));
        setEvaluating(null);
    };

    const handleApproveManager = async (test: ManagerTest) => {
        if (!confirm("この提出を承認しますか？ユーザーに500ptが付与されマネージャー認定となります")) return;
        const nowIso = new Date().toISOString();
        await supabase.from("manager_tests").update({ written_status: "approved", approved_at: nowIso, points_awarded: 500 }).eq("id", test.id);
        await supabase.from("profiles").update({ manager_certified: true, manager_certified_at: nowIso, manager_passed: true, manager_passed_at: nowIso }).eq("id", test.user_id);
        const { data: ptRow } = await supabase.from("user_points").select("points").eq("id", test.user_id).maybeSingle();
        const newPoints = ((ptRow as any)?.points || 0) + 500;
        await supabase.from("user_points").upsert({ id: test.user_id, points: newPoints });
        await supabase.from("points_history").insert({ user_id: test.user_id, change: 500, reason: "manager_test_certified" });
        setManagerTests(prev => prev.map(t => t.id === test.id ? { ...t, written_status: "approved", points_awarded: 500 } : t));
    };

    const handleRejectManager = async (test: ManagerTest) => {
        if (!confirm("この提出を却下しますか？3日後に再挑戦可能となります")) return;
        const nextRetry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
        await supabase.from("manager_tests").update({ written_status: "rejected", next_retry_at: nextRetry }).eq("id", test.id);
        setManagerTests(prev => prev.map(t => t.id === test.id ? { ...t, written_status: "rejected" } : t));
    };

    const filtered = attempts.filter(a => {
        if (filter === "passed" && !a.passed) return false;
        if (filter === "needs_eval" && a.written_evaluation) return false;
        if (selectedTest !== "all" && a.test_key !== selectedTest) return false;
        return true;
    });

    // 合格者サマリー（マネージャー含む）
    const passersByTest: Record<string, { name: string; score: number; date: string }[]> = {};
    attempts.filter(a => a.passed).forEach(a => {
        if (!passersByTest[a.test_key]) passersByTest[a.test_key] = [];
        if (!passersByTest[a.test_key].find(p => p.name === a.userName)) {
            passersByTest[a.test_key].push({
                name: a.userName || "",
                score: a.score,
                date: new Date(a.created_at).toLocaleDateString("ja-JP"),
            });
        }
    });
    // マネージャー合格者を別途集計
    managerTests.filter(t => t.written_status === "approved").forEach(t => {
        if (!passersByTest["manager"]) passersByTest["manager"] = [];
        if (!passersByTest["manager"].find(p => p.name === t.userName)) {
            passersByTest["manager"].push({
                name: t.userName || "",
                score: t.score_choice,
                date: new Date(t.submitted_at).toLocaleDateString("ja-JP"),
            });
        }
    });

    if (loading) return <div style={{ color: "#9ca3af", fontSize: 14, textAlign: "center", padding: 40 }}>読み込み中...</div>;
    const pendingManagerCount = managerTests.filter(t => t.written_status === "pending" && t.passed_choice).length;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ padding: "20px 24px", borderRadius: 14, background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.2)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>📝 テスト結果管理</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>全テストの受験履歴・合格者・記述式回答を確認できます。記述に評価を付けるとポイント付与されます。</div>
            </div>

            {/* ===== マネージャーテスト承認エリア ===== */}
            {managerTests.length > 0 && (
                <div style={{ padding: 20, borderRadius: 14, background: "rgba(236,72,153,0.05)", border: "1px solid rgba(236,72,153,0.3)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#ec4899" }}>🎖️ マネージャーテスト承認</div>
                            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>選択式合格者の記述を確認 / 承認で500pt付与＋マネージャー認定</div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => setManagerFilter("pending")} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer", fontSize: 11, background: managerFilter === "pending" ? "linear-gradient(135deg, #ec4899, #f472b6)" : "rgba(255,255,255,0.05)", color: managerFilter === "pending" ? "#fff" : "#9ca3af" }}>レビュー待ち{pendingManagerCount > 0 ? `(${pendingManagerCount})` : ""}</button>
                            <button onClick={() => setManagerFilter("all")} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer", fontSize: 11, background: managerFilter === "all" ? "linear-gradient(135deg, #ec4899, #f472b6)" : "rgba(255,255,255,0.05)", color: managerFilter === "all" ? "#fff" : "#9ca3af" }}>すべて</button>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {managerTests.filter(t => managerFilter === "all" || t.written_status === "pending").map(test => (
                            <div key={test.id} style={{ padding: 16, borderRadius: 10, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                                    <div>
                                        <div style={{ color: "#f9fafb", fontSize: 14, fontWeight: 700 }}>{test.userName}</div>
                                        <div style={{ color: "#6b7280", fontSize: 11 }}>提出: {new Date(test.submitted_at).toLocaleString("ja-JP")}</div>
                                    </div>
                                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                        <div style={{ padding: "3px 8px", borderRadius: 6, background: test.passed_choice ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)", color: test.passed_choice ? "#34d399" : "#f87171", fontSize: 11, fontWeight: 700 }}>選択式: {test.score_choice}/{test.score_choice_total}</div>
                                        <div style={{ padding: "3px 8px", borderRadius: 6, background: test.written_status === "approved" ? "rgba(52,211,153,0.15)" : test.written_status === "rejected" ? "rgba(248,113,113,0.15)" : test.written_status === "skipped" ? "rgba(107,114,128,0.15)" : "rgba(251,191,36,0.15)", color: test.written_status === "approved" ? "#34d399" : test.written_status === "rejected" ? "#f87171" : test.written_status === "skipped" ? "#9ca3af" : "#fbbf24", fontSize: 11, fontWeight: 700 }}>{test.written_status === "approved" ? "✅ 承認済" : test.written_status === "rejected" ? "❌ 却下" : test.written_status === "skipped" ? "選択式不合格" : "⏳ レビュー待ち"}</div>
                                    </div>
                                </div>

                                {test.written && test.written.length > 0 && (
                                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                                        <div style={{ color: "#a78bfa", fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>記述式回答</div>
                                        {test.written.map((w) => (
                                            <div key={w.id} style={{ padding: 10, borderRadius: 6, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.04)" }}>
                                                <div style={{ color: "#9ca3af", fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Q{w.question_num}</div>
                                                <div style={{ color: "#d1d5db", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{w.answer}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {test.written_status === "pending" && test.passed_choice && (
                                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                                        <button onClick={() => handleApproveManager(test)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #10b981, #34d399)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✅ 承認（500pt付与）</button>
                                        <button onClick={() => handleRejectManager(test)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.1)", color: "#f87171", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>❌ 却下</button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {managerTests.filter(t => managerFilter === "all" || t.written_status === "pending").length === 0 && (
                            <div style={{ textAlign: "center", color: "#6b7280", fontSize: 12, padding: 20 }}>該当する提出はありません</div>
                        )}
                    </div>
                </div>
            )}

            {/* 合格者サマリー */}
            <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#10b981", marginBottom: 12 }}>🏆 合格者サマリー</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                    {Object.entries(TEST_LABELS).map(([key, info]) => {
                        const passers = passersByTest[key] || [];
                        return (
                            <div key={key} style={{ padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${info.color}30` }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: info.color, marginBottom: 8 }}>{info.icon} {info.label}</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: "#f9fafb", marginBottom: 6 }}>{passers.length}<span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}> 名合格</span></div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 120, overflowY: "auto" }}>
                                    {passers.slice(0, 5).map((p, i) => (
                                        <div key={i} style={{ fontSize: 11, color: "#d1d5db" }}>{p.name} <span style={{ color: "#6b7280" }}>({p.score}点・{p.date})</span></div>
                                    ))}
                                    {passers.length > 5 && <div style={{ fontSize: 11, color: "#6b7280" }}>他{passers.length - 5}名...</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* フィルタ */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, marginRight: 4 }}>FILTER:</div>
                <button onClick={() => setFilter("all")} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: filter === "all" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: filter === "all" ? "#fff" : "#9ca3af", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>すべて</button>
                <button onClick={() => setFilter("passed")} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: filter === "passed" ? "linear-gradient(135deg, #10b981, #059669)" : "rgba(255,255,255,0.05)", color: filter === "passed" ? "#fff" : "#9ca3af", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>合格者のみ</button>
                <button onClick={() => setFilter("needs_eval")} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: filter === "needs_eval" ? "linear-gradient(135deg, #f59e0b, #d97706)" : "rgba(255,255,255,0.05)", color: filter === "needs_eval" ? "#fff" : "#9ca3af", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>📝 未評価のみ</button>
                <select value={selectedTest} onChange={(e) => setSelectedTest(e.target.value)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    <option value="all">全テスト</option>
                    {Object.entries(TEST_LABELS).filter(([k]) => k !== "manager").map(([key, info]) => <option key={key} value={key}>{info.icon} {info.label}</option>)}
                </select>
            </div>

            {/* 受験履歴 */}
            <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#f9fafb", marginBottom: 12 }}>📜 受験履歴 ({filtered.length}件)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {filtered.length === 0 && <div style={{ color: "#6b7280", fontSize: 13, textAlign: "center", padding: 40 }}>該当するデータはありません</div>}
                    {filtered.map((a) => {
                        const info = TEST_LABELS[a.test_key] || { label: a.test_key, color: "#6b7280", icon: "📄" };
                        const isExpanded = expandedId === a.id;
                        const questions = WRITTEN_QUESTIONS[a.test_key] || [];
                        const hasWritten = a.written_answers && (Array.isArray(a.written_answers) ? a.written_answers.length > 0 : Object.keys(a.written_answers).length > 0);
                        const writtenArr: string[] = Array.isArray(a.written_answers) ? a.written_answers : a.written_answers ? Object.values(a.written_answers) : [];
                        const evalLabel = a.written_evaluation === "high" ? "🥇 高評価" : a.written_evaluation === "mid" ? "🥈 中評価" : a.written_evaluation === "none" ? "⚪ 評価なし" : null;
                        const evalColor = a.written_evaluation === "high" ? "#fbbf24" : a.written_evaluation === "mid" ? "#94a3b8" : a.written_evaluation === "none" ? "#6b7280" : null;

                        return (
                            <div key={a.id} style={{ borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${a.passed ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)"}` }}>
                                <div onClick={() => setExpandedId(isExpanded ? null : a.id)} style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", flexWrap: "wrap" }}>
                                    <div style={{ fontSize: 18 }}>{info.icon}</div>
                                    <div style={{ flex: 1, minWidth: 180 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb" }}>{a.userName}</div>
                                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{info.label} / {new Date(a.created_at).toLocaleString("ja-JP")}</div>
                                    </div>
                                    <div style={{ padding: "4px 10px", borderRadius: 6, background: a.passed ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.1)", color: a.passed ? "#10b981" : "#ef4444", fontSize: 11, fontWeight: 700 }}>{a.score}{a.test_key === "quiz" ? "/15" : "%"}</div>
                                    <div style={{ padding: "4px 10px", borderRadius: 6, background: a.passed ? "rgba(16,185,129,0.2)" : "rgba(107,114,128,0.15)", color: a.passed ? "#10b981" : "#9ca3af", fontSize: 11, fontWeight: 700 }}>{a.passed ? "✓ 合格" : "不合格"}</div>
                                    {evalLabel && evalColor && (
                                        <div style={{ padding: "4px 10px", borderRadius: 6, background: `${evalColor}20`, color: evalColor, fontSize: 11, fontWeight: 700 }}>{evalLabel} +{a.written_points_awarded || 0}pt</div>
                                    )}
                                    {hasWritten && <div style={{ fontSize: 10, color: "#6366f1", fontWeight: 700 }}>{isExpanded ? "▲" : "▼"} 記述</div>}
                                </div>
                                {isExpanded && hasWritten && (
                                    <div style={{ padding: "8px 16px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                        <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700, marginBottom: 8, marginTop: 8 }}>📝 記述式回答</div>
                                        {writtenArr.map((ans, i) => (
                                            <div key={i} style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: "rgba(0,0,0,0.2)" }}>
                                                <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, marginBottom: 4 }}>Q{i + 1}. {questions[i] || "（質問情報なし）"}</div>
                                                <div style={{ fontSize: 13, color: "#d1d5db", whiteSpace: "pre-wrap" }}>{ans || <span style={{ color: "#6b7280", fontStyle: "italic" }}>（未記入）</span>}</div>
                                            </div>
                                        ))}

                                        {/* 評価ボタン */}
                                        <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.2)" }}>
                                            <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>━━━ 記述評価 ━━━</div>
                                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                <button onClick={() => handleEvaluate(a, "high")} disabled={evaluating === a.id} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(251,191,36,0.4)", background: a.written_evaluation === "high" ? "rgba(251,191,36,0.3)" : "rgba(251,191,36,0.1)", color: "#fbbf24", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🥇 高評価 +100pt</button>
                                                <button onClick={() => handleEvaluate(a, "mid")} disabled={evaluating === a.id} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.4)", background: a.written_evaluation === "mid" ? "rgba(148,163,184,0.3)" : "rgba(148,163,184,0.1)", color: "#cbd5e1", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🥈 中評価 +50pt</button>
                                                <button onClick={() => handleEvaluate(a, "none")} disabled={evaluating === a.id} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(107,114,128,0.4)", background: a.written_evaluation === "none" ? "rgba(107,114,128,0.3)" : "rgba(107,114,128,0.1)", color: "#9ca3af", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>⚪ 評価なし</button>
                                            </div>
                                            {a.evaluated_at && (
                                                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 8 }}>評価日時: {new Date(a.evaluated_at).toLocaleString("ja-JP")}</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}