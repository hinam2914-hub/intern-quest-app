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
    written_answers: string[] | null;
    userName?: string;
};

const TEST_LABELS: Record<string, { label: string; color: string; icon: string }> = {
    quiz: { label: "確認ワーク", color: "#a78bfa", icon: "🧠" },
    mentor: { label: "メンター", color: "#10b981", icon: "🧭" },
    retention: { label: "Dot.A残留判定", color: "#ef4444", icon: "🔥" },
    entrepreneur: { label: "起業適性", color: "#f59e0b", icon: "🚀" },
    marketer: { label: "マーケター適性", color: "#06b6d4", icon: "📊" },
    sales: { label: "営業デビュー", color: "#8b5cf6", icon: "💼" },
    planner: { label: "企画職適性", color: "#ec4899", icon: "💡" },
    manager: { label: "マネージャー", color: "#ec4899", icon: "🎖️" },
};

const WRITTEN_QUESTIONS: Record<string, string[]> = {
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

export default function TestResultsTab() {
    const [attempts, setAttempts] = useState<Attempt[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "passed">("all");
    const [selectedTest, setSelectedTest] = useState<string>("all");
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            const { data: attemptRows } = await supabase.from("test_attempts").select("*").order("created_at", { ascending: false });
            const { data: profileRows } = await supabase.from("profiles").select("id, name");
            const merged: Attempt[] = (attemptRows || []).map((a: any) => ({
                ...a,
                userName: profileRows?.find((p: any) => p.id === a.user_id)?.name || "（名前未設定）",
            }));
            setAttempts(merged);
            setLoading(false);
        };
        load();
    }, []);

    const filtered = attempts.filter(a => {
        if (filter === "passed" && !a.passed) return false;
        if (selectedTest !== "all" && a.test_key !== selectedTest) return false;
        return true;
    });

    // 合格者サマリー
    const passersByTest: Record<string, { name: string; score: number; date: string }[]> = {};
    attempts.filter(a => a.passed).forEach(a => {
        if (!passersByTest[a.test_key]) passersByTest[a.test_key] = [];
        // 同じユーザー重複を除く（最新のみ）
        if (!passersByTest[a.test_key].find(p => p.name === a.userName)) {
            passersByTest[a.test_key].push({
                name: a.userName || "",
                score: a.score,
                date: new Date(a.created_at).toLocaleDateString("ja-JP"),
            });
        }
    });

    if (loading) return <div style={{ color: "#9ca3af", fontSize: 14, textAlign: "center", padding: 40 }}>読み込み中...</div>;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ padding: "20px 24px", borderRadius: 14, background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.2)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>📝 テスト結果管理</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>全テストの受験履歴・合格者・記述式回答を確認できます</div>
            </div>

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
                <select value={selectedTest} onChange={(e) => setSelectedTest(e.target.value)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    <option value="all">全テスト</option>
                    {Object.entries(TEST_LABELS).map(([key, info]) => <option key={key} value={key}>{info.icon} {info.label}</option>)}
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
                        return (
                            <div key={a.id} style={{ borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${a.passed ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)"}` }}>
                                <div onClick={() => setExpandedId(isExpanded ? null : a.id)} style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", flexWrap: "wrap" }}>
                                    <div style={{ fontSize: 18 }}>{info.icon}</div>
                                    <div style={{ flex: 1, minWidth: 180 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb" }}>{a.userName}</div>
                                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{info.label} / {new Date(a.created_at).toLocaleString("ja-JP")}</div>
                                    </div>
                                    <div style={{ padding: "4px 10px", borderRadius: 6, background: a.passed ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.1)", color: a.passed ? "#10b981" : "#ef4444", fontSize: 11, fontWeight: 700 }}>{a.score}点</div>
                                    <div style={{ padding: "4px 10px", borderRadius: 6, background: a.passed ? "rgba(16,185,129,0.2)" : "rgba(107,114,128,0.15)", color: a.passed ? "#10b981" : "#9ca3af", fontSize: 11, fontWeight: 700 }}>{a.passed ? "✓ 合格" : "不合格"}</div>
                                    {a.written_answers && <div style={{ fontSize: 10, color: "#6366f1", fontWeight: 700 }}>{isExpanded ? "▲" : "▼"} 記述</div>}
                                </div>
                                {isExpanded && a.written_answers && (
                                    <div style={{ padding: "8px 16px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                        <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700, marginBottom: 8, marginTop: 8 }}>📝 記述式回答</div>
                                        {(a.written_answers as string[]).map((ans, i) => (
                                            <div key={i} style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: "rgba(0,0,0,0.2)" }}>
                                                <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, marginBottom: 4 }}>Q{i + 1}. {questions[i] || "（質問情報なし）"}</div>
                                                <div style={{ fontSize: 13, color: "#d1d5db", whiteSpace: "pre-wrap" }}>{ans || <span style={{ color: "#6b7280", fontStyle: "italic" }}>（未記入）</span>}</div>
                                            </div>
                                        ))}
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
