"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

// テスト定義
const TEST_LIST = [
    { key: "quiz", label: "確認ワーク", icon: "✅", color: "#10b981" },
    { key: "mentor", label: "メンター", icon: "🧑‍🏫", color: "#06b6d4" },
    { key: "retention", label: "Dot.A雇用テスト", icon: "💼", color: "#8b5cf6" },
    { key: "entrepreneur", label: "起業", icon: "🚀", color: "#f59e0b" },
    { key: "marketer", label: "マーケター", icon: "📊", color: "#ec4899" },
    { key: "sales", label: "営業デビュー", icon: "💪", color: "#ef4444" },
    { key: "planner", label: "企画", icon: "💡", color: "#3b82f6" },
    { key: "manager", label: "マネージャー", icon: "👔", color: "#6366f1" },
    { key: "common_sense", label: "常識", icon: "📚", color: "#84cc16" },
    { key: "social_standard", label: "社会人基準", icon: "🎓", color: "#a855f7" },
    { key: "profit_thinking", label: "利益思考", icon: "💰", color: "#22c55e" },
    { key: "long_term_thinking", label: "長期思考", icon: "🔭", color: "#eab308" },
    { key: "essence_thinking", label: "本質思考", icon: "🎯", color: "#06b6d4" },
    { key: "standard_keeping", label: "基準維持", icon: "⚖️", color: "#f97316" },
    { key: "market_value", label: "市場価値認識", icon: "📈", color: "#0891b2" },
    { key: "teiou", label: "Dot.A帝王学", icon: "👑", color: "#fbbf24" },
];

const getTestInfo = (key: string) => TEST_LIST.find(t => t.key === key) || { key, label: key, icon: "📝", color: "#6b7280" };

type PointsHistoryItem = {
    id: number;
    change: number;
    created_at: string;
    reason: string;
};

type TestAttempt = {
    id: string;
    test_key: string;
    score: number | null;
    passed: boolean;
    created_at: string;
    written_answers: Record<string, string> | null;
    written_evaluation: string | null;
    written_points_awarded: number | null;
};

type ThanksItem = {
    id: string;
    from_user_id: string;
    message: string;
    created_at: string;
    from_user?: { name: string | null; avatar_url: string | null } | null;
};

type ChallengeSubmission = {
    id: string;
    challenge_id: string;
    comment: string | null;
    image_url: string | null;
    status: string;
    created_at: string;
    approved_at: string | null;
    challenges: { id: string; title: string; points: number | null; category: string | null; icon: string | null } | null;
};

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric", month: "numeric", day: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

function getReasonLabel(reason: string): string {
    switch (reason) {
        case "report_submit": return "日報提出";
        case "streak_bonus": return "連続ボーナス";
        case "login_bonus": return "ログインボーナス";
        case "manual_add": return "手動追加";
        case "content_complete": return "学習完了";
        case "thanks_received": return "サンキュー受領";
        case "shop_purchase": return "ショップ購入";
        case "admin_edit": return "管理者編集";
        case "challenge_complete": return "🎯 チャレンジ完了";
        case "restore_after_reset": return "🔄 リセット復元";
        case "restore_amount_correction": return "🔧 金額調整";
        default: return "その他";
    }
}

function getReasonIcon(reason: string): string {
    switch (reason) {
        case "report_submit": return "📋";
        case "streak_bonus": return "🔥";
        case "login_bonus": return "🎁";
        case "manual_add": return "⚡";
        case "content_complete": return "📚";
        case "thanks_received": return "🎉";
        case "shop_purchase": return "🛍️";
        case "admin_edit": return "⚙️";
        case "challenge_complete": return "🎯";
        case "restore_after_reset": return "🔄";
        case "restore_amount_correction": return "🔧";
        default: return "✨";
    }
}

export default function HistoryPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"points" | "tests" | "thanks" | "challenges">("points");
    const [pointsHistory, setPointsHistory] = useState<PointsHistoryItem[]>([]);
    const [totalPoints, setTotalPoints] = useState(0);
    const [tests, setTests] = useState<TestAttempt[]>([]);
    const [thanks, setThanks] = useState<ThanksItem[]>([]);
    const [challenges, setChallenges] = useState<ChallengeSubmission[]>([]);
    const [expandedTest, setExpandedTest] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/login");
                return;
            }

            // ポイント履歴
            const { data: phData } = await supabase
                .from("points_history")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            // テスト履歴
            const { data: testData } = await supabase
                .from("test_attempts")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            // サンキュー受信
            const { data: thanksData } = await supabase
                .from("thanks")
                .select("*")
                .eq("to_user_id", user.id)
                .order("created_at", { ascending: false });

            let thanksWithUser: ThanksItem[] = [];
            if (thanksData && thanksData.length > 0) {
                const fromIds = [...new Set(thanksData.map((t: any) => t.from_user_id))];
                const { data: profiles } = await supabase
                    .from("profiles")
                    .select("id, name, avatar_url")
                    .in("id", fromIds);
                const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
                thanksWithUser = thanksData.map((t: any) => ({
                    ...t,
                    from_user: profileMap.get(t.from_user_id) || null,
                }));
            }

            // ライフチャレンジ履歴
            const { data: chData } = await supabase
                .from("challenge_submissions")
                .select("*, challenges(id, title, points, category, icon)")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (phData) {
                setPointsHistory(phData);
                setTotalPoints(phData.reduce((sum: number, item: any) => sum + (item.change > 0 ? item.change : 0), 0));
            }
            setTests((testData || []) as TestAttempt[]);
            setThanks(thanksWithUser);
            setChallenges((chData || []) as ChallengeSubmission[]);
            setLoading(false);
        })();
    }, [router]);

    const passedTests = tests.filter(t => t.passed);
    const approvedChallenges = challenges.filter(c => c.status === "approved");
    const pendingChallenges = challenges.filter(c => c.status === "pending");
    const rejectedChallenges = challenges.filter(c => c.status === "rejected");

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.06) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto" }}>
                {/* ヘッダー */}
                <div style={{ marginBottom: 24 }}>
                    <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>📜 履歴</h1>
                </div>

                {/* タブ */}
                <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.1)", overflowX: "auto" }}>
                    {[
                        { key: "points", label: "💎 ポイント", count: pointsHistory.length },
                        { key: "tests", label: "📚 テスト", count: passedTests.length },
                        { key: "thanks", label: "💌 サンキュー", count: thanks.length },
                        { key: "challenges", label: "🎯 チャレンジ", count: challenges.length },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            style={{
                                padding: "12px 16px",
                                border: "none",
                                background: "transparent",
                                borderBottom: activeTab === tab.key ? "2px solid #8b5cf6" : "2px solid transparent",
                                color: activeTab === tab.key ? "#c4b5fd" : "#6b7280",
                                fontSize: 13,
                                fontWeight: activeTab === tab.key ? 700 : 400,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>

                {/* ポイントタブ */}
                {activeTab === "points" && (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>TOTAL EARNED</div>
                                <div style={{ fontSize: 36, fontWeight: 800, color: "#f9fafb" }}>{totalPoints.toLocaleString()}</div>
                                <div style={{ fontSize: 14, color: "#6366f1", fontWeight: 600 }}>pt</div>
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>TOTAL ACTIONS</div>
                                <div style={{ fontSize: 36, fontWeight: 800, color: "#f9fafb" }}>{pointsHistory.length}</div>
                                <div style={{ fontSize: 14, color: "#34d399", fontWeight: 600 }}>回</div>
                            </div>
                        </div>

                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>ACTIVITY LOG</div>
                            {pointsHistory.length === 0 ? (
                                <div style={{ color: "#6b7280", fontSize: 14, padding: 16 }}>履歴がありません</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {pointsHistory.map((item) => (
                                        <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                                                    {getReasonIcon(item.reason)}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 14, fontWeight: 600, color: "#d1d5db" }}>{getReasonLabel(item.reason)}</div>
                                                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{formatDate(item.created_at)}</div>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 18, fontWeight: 700, color: item.change > 0 ? "#34d399" : "#f87171" }}>
                                                {item.change > 0 ? `+${item.change}` : item.change}pt
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* テストタブ */}
                {activeTab === "tests" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {passedTests.length === 0 ? (
                            <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", padding: "40px 0" }}>まだ合格したテストはありません</div>
                        ) : (
                            passedTests.map(t => {
                                const info = getTestInfo(t.test_key);
                                const isExpanded = expandedTest === t.id;
                                const hasWritten = t.written_answers && Object.keys(t.written_answers).length > 0;
                                return (
                                    <div key={t.id} style={{ background: `${info.color}10`, border: `1px solid ${info.color}30`, borderRadius: 8, padding: 12 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: 16 }}>{info.icon}</span>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: info.color, flex: 1, minWidth: 0 }}>{info.label}</div>
                                            <span style={{ padding: "2px 8px", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 4, fontSize: 11, color: "#6ee7b7", fontWeight: 600 }}>
                                                ✅ 合格 {t.score !== null && `${t.score}点`}
                                            </span>
                                            {t.written_points_awarded !== null && t.written_points_awarded > 0 && (
                                                <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 700 }}>+{t.written_points_awarded}pt</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, paddingLeft: 24 }}>
                                            {new Date(t.created_at).toLocaleDateString("ja-JP")} 受験
                                        </div>
                                        {hasWritten && (
                                            <button
                                                onClick={() => setExpandedTest(isExpanded ? null : t.id)}
                                                style={{ marginTop: 8, marginLeft: 24, padding: "4px 10px", background: `${info.color}20`, border: `1px solid ${info.color}40`, borderRadius: 4, color: info.color, fontSize: 11, cursor: "pointer", fontWeight: 600 }}
                                            >
                                                📖 記述回答を見る {isExpanded ? "▲" : "▼"}
                                            </button>
                                        )}
                                        {isExpanded && hasWritten && (
                                            <div style={{ marginTop: 12, marginLeft: 24, padding: 12, background: "rgba(0,0,0,0.3)", borderRadius: 6 }}>
                                                {Object.entries(t.written_answers || {}).map(([q, a]) => (
                                                    <div key={q} style={{ marginBottom: 12 }}>
                                                        <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, marginBottom: 4 }}>Q. {q}</div>
                                                        <div style={{ fontSize: 12, color: "#d1d5db", whiteSpace: "pre-wrap", lineHeight: 1.5, paddingLeft: 8, borderLeft: `2px solid ${info.color}` }}>{a as string}</div>
                                                    </div>
                                                ))}
                                                {t.written_evaluation && (
                                                    <div style={{ marginTop: 8, padding: 8, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 4 }}>
                                                        <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 600, marginBottom: 4 }}>💬 評価コメント</div>
                                                        <div style={{ fontSize: 12, color: "#fef3c7", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{t.written_evaluation}</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* サンキュータブ */}
                {activeTab === "thanks" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {thanks.length === 0 ? (
                            <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", padding: "40px 0" }}>まだサンキューを受け取っていません</div>
                        ) : (
                            thanks.map(t => (
                                <div key={t.id} style={{ background: "rgba(236,72,153,0.05)", border: "1px solid rgba(236,72,153,0.2)", borderRadius: 8, padding: 12 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                        {t.from_user?.avatar_url ? (
                                            <img src={t.from_user.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                                        ) : (
                                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(236,72,153,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>👤</div>
                                        )}
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "#fbcfe8", flex: 1 }}>{t.from_user?.name || "不明"}さん から</div>
                                        <span style={{ fontSize: 10, color: "#6b7280" }}>{new Date(t.created_at).toLocaleDateString("ja-JP")}</span>
                                    </div>
                                    <div style={{ fontSize: 13, color: "#d1d5db", whiteSpace: "pre-wrap", lineHeight: 1.5, paddingLeft: 36 }}>💌 {t.message}</div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* チャレンジタブ */}
                {activeTab === "challenges" && (
                    <div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                            <div style={{ padding: "8px 12px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 6, flex: 1, minWidth: 100 }}>
                                <div style={{ fontSize: 10, color: "#6ee7b7" }}>✅ 承認済み</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: "#10b981" }}>{approvedChallenges.length}</div>
                            </div>
                            <div style={{ padding: "8px 12px", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 6, flex: 1, minWidth: 100 }}>
                                <div style={{ fontSize: 10, color: "#fde68a" }}>⏳ 承認待ち</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: "#fbbf24" }}>{pendingChallenges.length}</div>
                            </div>
                            <div style={{ padding: "8px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, flex: 1, minWidth: 100 }}>
                                <div style={{ fontSize: 10, color: "#fca5a5" }}>❌ 差戻し</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>{rejectedChallenges.length}</div>
                            </div>
                        </div>

                        {challenges.length === 0 ? (
                            <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", padding: "40px 0" }}>まだチャレンジに参加していません</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {challenges.map(c => {
                                    const statusInfo = c.status === "approved"
                                        ? { color: "#10b981", bg: "rgba(16,185,129,0.05)", border: "rgba(16,185,129,0.2)", label: "✅ 承認済み", text: "#6ee7b7" }
                                        : c.status === "pending"
                                            ? { color: "#fbbf24", bg: "rgba(251,191,36,0.05)", border: "rgba(251,191,36,0.2)", label: "⏳ 承認待ち", text: "#fde68a" }
                                            : { color: "#ef4444", bg: "rgba(239,68,68,0.05)", border: "rgba(239,68,68,0.2)", label: "❌ 差戻し", text: "#fca5a5" };
                                    return (
                                        <div key={c.id} style={{ background: statusInfo.bg, border: `1px solid ${statusInfo.border}`, borderRadius: 8, padding: 12 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                                                <span style={{ padding: "2px 6px", background: `${statusInfo.color}20`, border: `1px solid ${statusInfo.color}50`, borderRadius: 4, fontSize: 10, color: statusInfo.text, fontWeight: 600 }}>
                                                    {statusInfo.label}
                                                </span>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: statusInfo.text, flex: 1, minWidth: 0 }}>{c.challenges?.title || "チャレンジ"}</div>
                                                {c.challenges?.category && (
                                                    <span style={{ padding: "2px 6px", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 4, fontSize: 10, color: "#a5b4fc", fontWeight: 600 }}>
                                                        {c.challenges.category}
                                                    </span>
                                                )}
                                                {c.challenges?.points && c.status === "approved" && (
                                                    <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 700 }}>+{c.challenges.points}pt</span>
                                                )}
                                            </div>
                                            {c.comment && (
                                                <div style={{ fontSize: 12, color: "#d1d5db", marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.comment}</div>
                                            )}
                                            {c.image_url && (
                                                <div style={{ marginTop: 8 }}>
                                                    <img src={c.image_url} alt={c.challenges?.title || "チャレンジ画像"} style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 6, display: "block" }} />
                                                </div>
                                            )}
                                            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 8 }}>
                                                提出: {new Date(c.created_at).toLocaleDateString("ja-JP")}
                                                {c.approved_at && ` / 承認: ${new Date(c.approved_at).toLocaleDateString("ja-JP")}`}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* メニューへ戻る */}
                <div style={{ display: "flex", justifyContent: "center", marginTop: 48, marginBottom: 32 }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>
                        メニューへ戻る
                    </button>
                </div>
            </div>
        </main>
    );
}