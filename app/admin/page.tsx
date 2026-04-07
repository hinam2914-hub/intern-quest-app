"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type UserRow = { id: string; name: string | null };
type TopUser = { name: string; points: number };
type TopSubmitter = { name: string; count: number };
type ReportRow = { id: string; user_id: string; content: string; created_at: string; userName?: string };

function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function formatDateTime(value: string): string {
    const date = new Date(value);
    return date.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminPage() {
    const router = useRouter();
    const [userCount, setUserCount] = useState(0);
    const [reportCount, setReportCount] = useState(0);
    const [submitRate, setSubmitRate] = useState(0);
    const [topUsers, setTopUsers] = useState<TopUser[]>([]);
    const [topSubmitters, setTopSubmitters] = useState<TopSubmitter[]>([]);
    const [notSubmittedUsers, setNotSubmittedUsers] = useState<UserRow[]>([]);
    const [reports, setReports] = useState<ReportRow[]>([]);
    const [copied, setCopied] = useState(false);
    const [period, setPeriod] = useState<"today" | "week" | "month">("today");
    const [loading, setLoading] = useState(true);
    const [expandedReport, setExpandedReport] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }

            const adminEmails = ["hinam2914@gmail.com"];
            if (!user.email || !adminEmails.includes(user.email)) { router.push("/mypage"); return; }

            const { data: profileRows } = await supabase.from("profiles").select("id, name");
            const users = (profileRows || []) as UserRow[];
            setUserCount(users.length);

            const now = new Date();
            const from = new Date();
            if (period === "week") from.setDate(now.getDate() - 7);
            else if (period === "month") from.setMonth(now.getMonth() - 1);
            const todayYmd = getTodayJST();

            const { data: submissionRows } = period === "today"
                ? await supabase.from("submissions").select("id, user_id, content, created_at").gte("created_at", `${todayYmd}T00:00:00`).order("created_at", { ascending: false })
                : await supabase.from("submissions").select("id, user_id, content, created_at").gte("created_at", from.toISOString()).order("created_at", { ascending: false });

            const submissions = submissionRows || [];
            const submittedIds = [...new Set(submissions.map((row) => row.user_id))];
            setReportCount(submittedIds.length);
            setSubmitRate(users.length === 0 ? 0 : Math.round((submittedIds.length / users.length) * 100));
            setNotSubmittedUsers(users.filter((u) => !submittedIds.includes(u.id)));

            // 日報に名前を付与
            const reportsWithName: ReportRow[] = submissions.map((row) => ({
                ...row,
                userName: users.find((u) => u.id === row.user_id)?.name || "名前未設定",
            }));
            setReports(reportsWithName);

            const { data: pointRows } = await supabase.from("user_points").select("id, points").order("points", { ascending: false }).limit(3);
            if (pointRows && pointRows.length > 0) {
                const { data: pointProfiles } = await supabase.from("profiles").select("id, name").in("id", pointRows.map((u) => u.id));
                setTopUsers(pointRows.map((row) => ({ name: pointProfiles?.find((p) => p.id === row.id)?.name || "名前未設定", points: row.points || 0 })));
            }

            const countMap: Record<string, number> = {};
            submissions.forEach((row) => { countMap[row.user_id] = (countMap[row.user_id] || 0) + 1; });
            setTopSubmitters(Object.entries(countMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, count]) => ({ name: users.find((u) => u.id === id)?.name || "名前未設定", count })));
            setLoading(false);
        };
        load();
    }, [period, router]);

    const periodLabel = period === "today" ? "今日" : period === "week" ? "今週" : "今月";
    const copyText = useMemo(() => notSubmittedUsers.map((u) => u.name || "名前未設定").join("\n"), [notSubmittedUsers]);
    const reminderText = useMemo(() => `${periodLabel}の日報が未提出の方へ\n\n${notSubmittedUsers.map((u) => `・${u.name || "名前未設定"}`).join("\n")}\n\n確認のうえ、ご対応をお願いいたします。`, [notSubmittedUsers, periodLabel]);
    const rankMedals = ["🥇", "🥈", "🥉"];

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

            <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto" }}>

                {/* ヘッダー */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                    <div>
                        <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>INTERN QUEST</div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>管理ダッシュボード</h1>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => router.push("/mypage")} style={{ background: "rgba(255,255,255,0.05)", color: "#d1d5db", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>マイページ</button>
                        <button onClick={() => router.push("/ranking")} style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", padding: "8px 16px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>ランキング</button>
                    </div>
                </div>

                {/* 期間タブ */}
                <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                    {(["today", "week", "month"] as const).map((p) => (
                        <button key={p} onClick={() => setPeriod(p)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer", fontSize: 13, background: period === p ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: period === p ? "#fff" : "#9ca3af" }}>
                            {p === "today" ? "今日" : p === "week" ? "今週" : "今月"}
                        </button>
                    ))}
                </div>

                {/* KPIカード */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                    {[
                        { label: "TOTAL USERS", value: userCount, unit: "人", color: "#818cf8" },
                        { label: "SUBMISSIONS", value: reportCount, unit: "件", color: "#34d399" },
                        { label: `${periodLabel.toUpperCase()} RATE`, value: `${submitRate}%`, unit: "", color: submitRate >= 80 ? "#34d399" : submitRate >= 50 ? "#f59e0b" : "#f87171" },
                        { label: "NOT SUBMITTED", value: notSubmittedUsers.length, unit: "人", color: "#f87171" },
                    ].map((card, i) => (
                        <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>{card.label}</div>
                            <div style={{ fontSize: 40, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                            {card.unit && <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>{card.unit}</div>}
                        </div>
                    ))}
                </div>

                {/* 日報内容一覧 */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>REPORT CONTENTS</div>
                    {reports.length === 0 ? (
                        <div style={{ color: "#6b7280", fontSize: 14 }}>{periodLabel}の日報はまだありません</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {reports.map((report) => (
                                <div key={report.id} style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                    <div
                                        onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(255,255,255,0.02)", cursor: "pointer" }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>
                                                {report.userName?.charAt(0) || "?"}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: "#d1d5db" }}>{report.userName}</div>
                                                <div style={{ fontSize: 11, color: "#6b7280" }}>{formatDateTime(report.created_at)}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <div style={{ fontSize: 12, color: "#9ca3af", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {report.content}
                                            </div>
                                            <span style={{ color: "#6b7280", fontSize: 12 }}>{expandedReport === report.id ? "▲" : "▼"}</span>
                                        </div>
                                    </div>
                                    {expandedReport === report.id && (
                                        <div style={{ padding: "16px", background: "rgba(99,102,241,0.05)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                                            <p style={{ margin: 0, fontSize: 14, color: "#c7d2fe", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{report.content}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 下段グリッド */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

                    {/* 未提出者 */}
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2 }}>MISSING REPORTS</div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={async () => { await navigator.clipboard.writeText(copyText); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#d1d5db", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                                    {copied ? "✅ コピー済" : "名前コピー"}
                                </button>
                                <button onClick={async () => { await navigator.clipboard.writeText(reminderText); }} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                                    リマインド文
                                </button>
                            </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {notSubmittedUsers.length > 0 ? notSubmittedUsers.map((u) => (
                                <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
                                    <span style={{ fontWeight: 600, color: "#fca5a5", fontSize: 14 }}>{u.name || "名前未設定"}</span>
                                    <a href={`https://line.me/R/msg/text/?${encodeURIComponent(`${u.name || ""}さん、日報の提出をお願いします。`)}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#818cf8", textDecoration: "none", fontWeight: 600 }}>連絡 →</a>
                                </div>
                            )) : (
                                <div style={{ padding: 16, borderRadius: 10, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399", fontSize: 14, fontWeight: 600 }}>
                                    ✅ 全員提出済み（{periodLabel}）
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ランキング */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>POINT RANKING</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {topUsers.length > 0 ? topUsers.map((u, i) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                        <span style={{ fontSize: 14, color: "#d1d5db", fontWeight: 600 }}>{rankMedals[i]} {u.name}</span>
                                        <span style={{ fontSize: 16, fontWeight: 700, color: "#818cf8" }}>{u.points.toLocaleString()}pt</span>
                                    </div>
                                )) : <div style={{ color: "#6b7280", fontSize: 14 }}>データがありません</div>}
                            </div>
                        </div>

                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>SUBMISSION RANKING</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {topSubmitters.length > 0 ? topSubmitters.map((u, i) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                        <span style={{ fontSize: 14, color: "#d1d5db", fontWeight: 600 }}>{rankMedals[i]} {u.name}</span>
                                        <span style={{ fontSize: 16, fontWeight: 700, color: "#34d399" }}>{u.count}回</span>
                                    </div>
                                )) : <div style={{ color: "#6b7280", fontSize: 14 }}>データがありません</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}