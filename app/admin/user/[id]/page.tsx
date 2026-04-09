"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type PointHistory = { id: string; change: number; reason: string | null; created_at: string };
type Submission = { id: string; content: string; created_at: string };
type KpiLog = { id: string; kpi_item_id: string; value: number; created_at: string; kpiTitle?: string; unit?: string; target?: number };
type Thanks = { id: string; from_user_id: string; to_user_id: string; message: string; created_at: string; fromName?: string; toName?: string };
type ContentCompletion = { id: string; content_id: string; created_at: string; contentTitle?: string };

function formatDateTime(value: string): string {
    const date = new Date(value);
    return date.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatReason(reason?: string | null): string {
    if (!reason) return "ポイント追加";
    if (reason === "manual_add") return "手動追加";
    if (reason === "login_bonus") return "ログインボーナス";
    if (reason === "report_submit") return "日報提出";
    if (reason === "streak_bonus") return "連続提出ボーナス";
    if (reason === "content_complete") return "学習完了";
    if (reason === "thanks_received") return "サンキュー受領";
    if (reason === "shop_purchase") return "ショップ購入";
    if (reason === "admin_edit") return "管理者編集";
    return reason;
}

function getLevel(points: number): number { return Math.max(1, Math.floor(points / 100) + 1); }
function getRank(score: number): string {
    if (score >= 90) return "SS";
    if (score >= 80) return "S";
    if (score >= 70) return "A";
    if (score >= 60) return "B";
    if (score >= 50) return "C";
    return "D";
}
function getRankColor(rank: string): string {
    if (rank === "SS") return "#f59e0b";
    if (rank === "S") return "#a855f7";
    if (rank === "A") return "#6366f1";
    if (rank === "B") return "#06b6d4";
    if (rank === "C") return "#84cc16";
    return "#6b7280";
}

export default function UserDetailPage() {
    const router = useRouter();
    const params = useParams();
    const userId = params.id as string;

    const [name, setName] = useState("");
    const [points, setPoints] = useState(0);
    const [streak, setStreak] = useState(0);
    const [role, setRole] = useState("");
    const [education, setEducation] = useState("");
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [departmentName, setDepartmentName] = useState("");
    const [startedAt, setStartedAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [pointHistory, setPointHistory] = useState<PointHistory[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [kpiLogs, setKpiLogs] = useState<KpiLog[]>([]);
    const [thanksSent, setThanksSent] = useState<Thanks[]>([]);
    const [thanksReceived, setThanksReceived] = useState<Thanks[]>([]);
    const [completions, setCompletions] = useState<ContentCompletion[]>([]);
    const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map(e => e.trim());
            if (!user.email || !adminEmails.includes(user.email)) { router.push("/mypage"); return; }

            const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
            setName(profile?.name || "名前未設定");
            setStreak(profile?.streak || 0);
            setRole(profile?.role || "");
            setEducation(profile?.education || "");
            setAvatarUrl(profile?.avatar_url || null);
            setStartedAt(profile?.started_at || null);

            // 事業部名を取得
            if (profile?.department_id) {
                const { data: dept } = await supabase.from("departments").select("name").eq("id", profile.department_id).single();
                setDepartmentName(dept?.name || "");
            }

            const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", userId).single();
            setPoints(pointRow?.points || 0);

            const { data: histRows } = await supabase.from("points_history").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
            setPointHistory((histRows || []) as PointHistory[]);

            const { data: subRows } = await supabase.from("submissions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
            setSubmissions((subRows || []) as Submission[]);

            const { data: kpiItems } = await supabase.from("kpi_items").select("id, title, unit, target_value");
            const { data: kpiRows } = await supabase.from("kpi_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
            setKpiLogs((kpiRows || []).map((r: any) => ({
                ...r,
                kpiTitle: kpiItems?.find((k: any) => k.id === r.kpi_item_id)?.title || "不明",
                unit: kpiItems?.find((k: any) => k.id === r.kpi_item_id)?.unit || "件",
                target: kpiItems?.find((k: any) => k.id === r.kpi_item_id)?.target_value || 0,
            })) as KpiLog[]);

            const { data: profiles } = await supabase.from("profiles").select("id, name");
            const { data: sentRows } = await supabase.from("thanks").select("*").eq("from_user_id", userId).order("created_at", { ascending: false });
            const { data: receivedRows } = await supabase.from("thanks").select("*").eq("to_user_id", userId).order("created_at", { ascending: false });
            const enrich = (rows: any[]) => rows.map((r: any) => ({
                ...r,
                fromName: profiles?.find((p: any) => p.id === r.from_user_id)?.name || "名前未設定",
                toName: profiles?.find((p: any) => p.id === r.to_user_id)?.name || "名前未設定",
            }));
            setThanksSent(enrich(sentRows || []));
            setThanksReceived(enrich(receivedRows || []));

            const { data: contents } = await supabase.from("contents").select("id, title");
            const { data: compRows } = await supabase.from("content_completions").select("*").eq("user_id", userId).order("created_at", { ascending: false });
            setCompletions((compRows || []).map((r: any) => ({
                ...r,
                contentTitle: contents?.find((c: any) => c.id === r.content_id)?.title || "不明",
            })) as ContentCompletion[]);

            setLoading(false);
        };
        load();
    }, [userId, router]);

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    const level = getLevel(points);
    const activeDays = startedAt ? Math.floor((Date.now() - new Date(startedAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const rankScore = Math.min(Math.round(
        (education ? 8 : 0) +
        Math.min(activeDays * 0.5, 15) +
        Math.min(kpiLogs.length * 3, 15) +
        Math.min(streak * 2, 20) +
        Math.min(thanksReceived.length * 2, 10) +
        Math.min(submissions.length * 2, 20) +
        Math.min(level, 10)
    ), 100);
    const rank2 = getRank(rankScore);
    const rankColor = getRankColor(rank2);

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto" }}>

                {/* 戻るボタン */}
                <div style={{ marginBottom: 24 }}>
                    <button onClick={() => router.push("/admin")} style={{ background: "rgba(255,255,255,0.05)", color: "#d1d5db", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>← 管理者画面</button>
                </div>

                {/* プロフィールカード */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 32, marginBottom: 24 }}>
                    <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
                        {/* アバター */}
                        {avatarUrl ? (
                            <img src={avatarUrl} alt={name} style={{ width: 100, height: 100, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(99,102,241,0.5)", flexShrink: 0 }} />
                        ) : (
                            <div style={{ width: 100, height: 100, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                                {name.charAt(0)}
                            </div>
                        )}

                        {/* 基本情報 */}
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, marginBottom: 4 }}>INTERN QUEST / メンバー詳細</div>
                            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "0 0 12px" }}>{name}</h1>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                {role && (
                                    <span style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", fontSize: 12, color: "#818cf8", fontWeight: 600 }}>
                                        👤 {role}
                                    </span>
                                )}
                                {departmentName && (
                                    <span style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)", fontSize: 12, color: "#06b6d4", fontWeight: 600 }}>
                                        🏢 {departmentName}
                                    </span>
                                )}
                                {education && (
                                    <span style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>
                                        🎓 {education}
                                    </span>
                                )}
                                {startedAt && (
                                    <span style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", fontSize: 12, color: "#34d399", fontWeight: 600 }}>
                                        📅 参加 {activeDays}日目
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ランク */}
                        <div style={{ textAlign: "center", flexShrink: 0 }}>
                            <div style={{ width: 80, height: 80, borderRadius: 16, background: rankColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 900, color: "#fff", boxShadow: `0 0 24px ${rankColor}60`, marginBottom: 8 }}>{rank2}</div>
                            <div style={{ fontSize: 12, color: "#9ca3af" }}>スコア {rankScore}/100</div>
                        </div>
                    </div>
                </div>

                {/* ステータスカード */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                    {[
                        { label: "TOTAL POINTS", value: `${points.toLocaleString()}pt`, color: "#818cf8" },
                        { label: "LEVEL", value: `Lv.${level}`, color: "#6366f1" },
                        { label: "STREAK", value: `${streak}日`, color: "#f59e0b" },
                        { label: "SUBMISSIONS", value: `${submissions.length}件`, color: "#34d399" },
                    ].map((card, i) => (
                        <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>{card.label}</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: card.color }}>{card.value}</div>
                        </div>
                    ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    {/* 日報履歴 */}
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>SUBMISSIONS ({submissions.length}件)</div>
                        {submissions.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>日報はありません</div> : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {submissions.map((s) => (
                                    <div key={s.id} style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                        <div onClick={() => setExpandedSubmission(expandedSubmission === s.id ? null : s.id)} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.02)" }}>
                                            <div style={{ fontSize: 12, color: "#9ca3af", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.content}</div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ fontSize: 11, color: "#6b7280" }}>{formatDateTime(s.created_at)}</span>
                                                <span style={{ fontSize: 11, color: "#6b7280" }}>{expandedSubmission === s.id ? "▲" : "▼"}</span>
                                            </div>
                                        </div>
                                        {expandedSubmission === s.id && (
                                            <div style={{ padding: "12px 14px", background: "rgba(99,102,241,0.05)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                                                <p style={{ margin: 0, fontSize: 13, color: "#c7d2fe", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{s.content}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* KPI実績 */}
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>KPI LOGS ({kpiLogs.length}件)</div>
                        {kpiLogs.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>KPIデータがありません</div> : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {kpiLogs.map((k) => (
                                    <div key={k.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: `${k.value >= (k.target || 0) ? "rgba(52,211,153,0.05)" : "rgba(255,255,255,0.02)"}`, border: `1px solid ${k.value >= (k.target || 0) ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.05)"}` }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "#d1d5db" }}>{k.kpiTitle}</div>
                                            <div style={{ fontSize: 11, color: "#6b7280" }}>{formatDateTime(k.created_at)}</div>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: k.value >= (k.target || 0) ? "#34d399" : "#f9fafb" }}>{k.value}{k.unit}</div>
                                            <div style={{ fontSize: 11, color: "#6b7280" }}>目標: {k.target}{k.unit}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    {/* 学習完了 */}
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>LEARNING ({completions.length}件)</div>
                        {completions.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>学習記録がありません</div> : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {completions.map((c) => (
                                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.15)" }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "#d1d5db" }}>{c.contentTitle}</div>
                                        <div style={{ fontSize: 11, color: "#34d399", fontWeight: 700 }}>✅ {formatDateTime(c.created_at)}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* サンキュー */}
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>THANKS</div>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>受け取った ({thanksReceived.length}件)</div>
                        {thanksReceived.length === 0 ? <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 12 }}>なし</div> : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                                {thanksReceived.slice(0, 3).map((t) => (
                                    <div key={t.id} style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                                        <div style={{ fontSize: 11, color: "#fbbf24", marginBottom: 2 }}>from {t.fromName}</div>
                                        <div style={{ fontSize: 12, color: "#d1d5db" }}>{t.message}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>送った ({thanksSent.length}件)</div>
                        {thanksSent.length === 0 ? <div style={{ color: "#6b7280", fontSize: 13 }}>なし</div> : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {thanksSent.slice(0, 3).map((t) => (
                                    <div key={t.id} style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                                        <div style={{ fontSize: 11, color: "#818cf8", marginBottom: 2 }}>to {t.toName}</div>
                                        <div style={{ fontSize: 12, color: "#d1d5db" }}>{t.message}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ポイント履歴 */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>POINT HISTORY</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {pointHistory.map((item) => (
                            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#d1d5db" }}>{formatReason(item.reason)}</div>
                                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{formatDateTime(item.created_at)}</div>
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: item.change > 0 ? "#34d399" : item.change < 0 ? "#f87171" : "#6b7280" }}>
                                    {item.change > 0 ? `+${item.change}` : item.change}pt
                                </div>
                            </div>
                        ))}
                        {pointHistory.length === 0 && <div style={{ color: "#6b7280", fontSize: 14 }}>履歴がありません</div>}
                    </div>
                </div>
            </div>
        </main>
    );
}