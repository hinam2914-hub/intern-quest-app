"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type TestItem = {
    key: string;
    label: string;
    desc: string;
    path: string;
    icon: string;
    color: string;
    passedField?: string;
    rewardText: string;
    table: "quiz_attempts" | "test_attempts" | "manual";
};

type Attempt = {
    score: number;
    passed: boolean;
    created_at: string;
    written_answers?: any;
    answers?: any;
};

const TESTS: TestItem[] = [
    { key: "quiz", label: "確認ワークテスト", desc: "価値観と仕事の基本をチェック", path: "/quiz", icon: "🧠", color: "#a78bfa", passedField: "quiz_passed", rewardText: "合格で +500pt", table: "quiz_attempts" },
    { key: "marketer", label: "マーケター適性テスト", desc: "売れる仕組みを作れるか", path: "/tests/marketer", icon: "📊", color: "#06b6d4", passedField: "marketer_passed", rewardText: "Aランクで +500pt", table: "test_attempts" },
    { key: "sales", label: "営業デビュー適性テスト", desc: "現場に出る準備ができているか", path: "/tests/sales", icon: "💼", color: "#8b5cf6", passedField: "sales_passed", rewardText: "Aランクで +500pt", table: "test_attempts" },
    { key: "mentor", label: "メンターテスト", desc: "育成者としての思考判定", path: "/tests/mentor", icon: "🌱", color: "#10b981", passedField: "mentor_passed", rewardText: "合格で +500pt", table: "test_attempts" },
    { key: "planner", label: "企画職適性テスト", desc: "売上責任を持つ設計者か", path: "/tests/planner", icon: "💡", color: "#ec4899", passedField: "planner_passed", rewardText: "Aランクで +500pt", table: "test_attempts" },
    { key: "entrepreneur", label: "起業適性テスト", desc: "今やるべきか、まだやるな", path: "/tests/entrepreneur", icon: "🚀", color: "#f59e0b", passedField: "entrepreneur_passed", rewardText: "Aランクで +500pt", table: "test_attempts" },
    { key: "manager", label: "マネージャーテスト", desc: "チームで勝つための思考", path: "/manager-test", icon: "👔", color: "#6366f1", rewardText: "合格で +500pt", table: "manual" },
    { key: "retention", label: "Dot.A 雇用テスト", desc: "雇用継続の判定テスト", path: "/tests/retention", icon: "🔥", color: "#ef4444", passedField: "retention_passed", rewardText: "合格で +1000pt", table: "test_attempts" },
];

function formatDate(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function TestsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [attemptsByKey, setAttemptsByKey] = useState<Record<string, Attempt[]>>({});
    const [selectedTest, setSelectedTest] = useState<TestItem | null>(null);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
            setProfile(p);

            // 確認ワーク（quiz_attempts）を取得
            const { data: quizAttempts } = await supabase
                .from("quiz_attempts")
                .select("score, passed, created_at, answers, written_answers")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            // 他テスト（test_attempts）を取得
            const { data: testAttempts } = await supabase
                .from("test_attempts")
                .select("test_key, score, passed, created_at, written_answers")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            const byKey: Record<string, Attempt[]> = {};
            byKey["quiz"] = (quizAttempts || []) as Attempt[];
            (testAttempts || []).forEach((a: any) => {
                if (!byKey[a.test_key]) byKey[a.test_key] = [];
                byKey[a.test_key].push({ score: a.score, passed: a.passed, created_at: a.created_at, written_answers: a.written_answers });
            });
            setAttemptsByKey(byKey);

            setLoading(false);
        };
        load();
    }, [router]);

    if (loading) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
        </main>
    );

    const getStats = (testKey: string) => {
        const attempts = attemptsByKey[testKey] || [];
        if (attempts.length === 0) return null;
        const maxScore = Math.max(...attempts.map(a => a.score));
        const lastAttempt = attempts[0]; // 既に降順なので先頭が最新
        return { count: attempts.length, maxScore, lastScore: lastAttempt.score, lastAt: lastAttempt.created_at };
    };

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 800, margin: "0 auto" }}>

                {/* ===== ヘッダー（統一） ===== */}
                <div style={{ marginBottom: 32 }}>
                    <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>📝 テスト一覧</h1>
                    <p style={{ color: "#9ca3af", fontSize: 14, margin: "8px 0 0" }}>あなたの価値観・適性・覚悟を測る8種類のテスト</p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {TESTS.map(t => {
                        const passed = t.passedField ? (profile?.[t.passedField] || false) : false;
                        const stats = getStats(t.key);
                        return (
                            <div key={t.key} style={{ padding: "20px 24px", borderRadius: 14, background: passed ? "rgba(16,185,129,0.05)" : "rgba(255,255,255,0.03)", border: `1px solid ${passed ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)"}`, transition: "all 0.2s" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                    <div onClick={() => router.push(t.path)} style={{ width: 56, height: 56, borderRadius: 12, background: `${t.color}20`, border: `1px solid ${t.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0, cursor: "pointer" }}>{t.icon}</div>
                                    <div style={{ flex: 1, cursor: "pointer" }} onClick={() => router.push(t.path)}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                                            <div style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb" }}>{t.label}</div>
                                            {passed && <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(16,185,129,0.2)", color: "#10b981", fontSize: 11, fontWeight: 700 }}>✅ 合格済</span>}
                                        </div>
                                        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>{t.desc}</div>
                                        <div style={{ fontSize: 11, color: t.color, fontWeight: 600 }}>{t.rewardText}</div>
                                    </div>
                                    <div style={{ fontSize: 20, color: "#6b7280" }}>›</div>
                                </div>

                                {/* スコアサマリー */}
                                {stats && (
                                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                                        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#9ca3af", flexWrap: "wrap" }}>
                                            <span>📊 受験 <strong style={{ color: "#f9fafb" }}>{stats.count}回</strong></span>
                                            <span>🏆 最高 <strong style={{ color: "#fbbf24" }}>{stats.maxScore}{t.key === "quiz" ? "/15" : "%"}</strong></span>
                                            <span>📅 前回 <strong style={{ color: "#f9fafb" }}>{stats.lastScore}{t.key === "quiz" ? "/15" : "%"}</strong></span>
                                            <span style={{ color: "#6b7280" }}>{formatDate(stats.lastAt)}</span>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedTest(t); }}
                                            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.1)", color: "#818cf8", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                        >
                                            📜 履歴を見る
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ===== メニューへ戻るボタン（統一） ===== */}
                <div style={{ display: "flex", justifyContent: "center", marginTop: 48, marginBottom: 32 }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>
                        メニューへ戻る
                    </button>
                </div>
            </div>

            {/* ===== 履歴モーダル ===== */}
            {selectedTest && (
                <div onClick={() => setSelectedTest(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: "#0f0f1a", border: `1px solid ${selectedTest.color}40`, borderRadius: 20, width: "100%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }}>
                        {/* モーダルヘッダー */}
                        <div style={{ padding: "24px 28px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#0f0f1a", zIndex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ fontSize: 28 }}>{selectedTest.icon}</span>
                                <div>
                                    <div style={{ fontSize: 11, color: selectedTest.color, fontWeight: 700, letterSpacing: 2, marginBottom: 2 }}>HISTORY</div>
                                    <h2 style={{ fontSize: 18, fontWeight: 800, color: "#f9fafb", margin: 0 }}>{selectedTest.label}</h2>
                                </div>
                            </div>
                            <button onClick={() => setSelectedTest(null)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", fontSize: 16, cursor: "pointer" }}>✕</button>
                        </div>

                        {/* 履歴コンテンツ */}
                        <div style={{ padding: "24px 28px" }}>
                            {(() => {
                                const attempts = attemptsByKey[selectedTest.key] || [];
                                if (attempts.length === 0) {
                                    return <div style={{ color: "#6b7280", fontSize: 14, textAlign: "center", padding: 40 }}>まだ受験履歴がありません</div>;
                                }
                                return (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                        {attempts.map((a, i) => (
                                            <div key={i} style={{ padding: 16, borderRadius: 12, background: a.passed ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${a.passed ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.06)"}` }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: a.written_answers ? 12 : 0 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                        <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>第{attempts.length - i}回</span>
                                                        <span style={{ fontSize: 13, color: "#9ca3af" }}>{formatDate(a.created_at)}</span>
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                        <span style={{ fontSize: 18, fontWeight: 800, color: a.passed ? "#10b981" : "#f59e0b" }}>{a.score}{selectedTest.key === "quiz" ? "/15" : "%"}</span>
                                                        <span style={{ padding: "3px 10px", borderRadius: 6, background: a.passed ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)", color: a.passed ? "#10b981" : "#f59e0b", fontSize: 11, fontWeight: 700 }}>{a.passed ? "✅ 合格" : "❌ 不合格"}</span>
                                                    </div>
                                                </div>

                                                {/* 記述式回答 */}
                                                {a.written_answers && (
                                                    <details style={{ marginTop: 8 }}>
                                                        <summary style={{ cursor: "pointer", fontSize: 12, color: "#818cf8", fontWeight: 600, padding: "6px 0" }}>✍️ 記述式回答を振り返る</summary>
                                                        <div style={{ marginTop: 8, padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                                            {Array.isArray(a.written_answers) ? (
                                                                a.written_answers.map((ans: string, j: number) => (
                                                                    <div key={j} style={{ marginBottom: j < a.written_answers.length - 1 ? 12 : 0 }}>
                                                                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>Q{j + 1}</div>
                                                                        <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{ans || "(未記入)"}</div>
                                                                    </div>
                                                                ))
                                                            ) : typeof a.written_answers === "object" ? (
                                                                Object.entries(a.written_answers).map(([key, val], j) => (
                                                                    <div key={key} style={{ marginBottom: j < Object.keys(a.written_answers).length - 1 ? 12 : 0 }}>
                                                                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>{key}</div>
                                                                        <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{(val as string) || "(未記入)"}</div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div style={{ fontSize: 13, color: "#6b7280" }}>記述データなし</div>
                                                            )}
                                                        </div>
                                                    </details>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}