"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { createNotification } from "../lib/createNotification";

interface Report {
    id: string; user_id: string; mtg_date: string; participants: string | null;
    start_time: string; end_time: string; content: string;
    status: string; admin_feedback: string | null; points_awarded: number; hidden: boolean | null;
    created_at: string; updated_at: string;
}
interface UserRow { id: string; name: string | null; }

function isLateNight(endTime: string): boolean {
    const hour = parseInt(endTime.split(":")[0], 10);
    return !isNaN(hour) && hour >= 24;
}
function fmtDateTime(iso: string): string {
    const d = new Date(iso);
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()} ${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<string, { text: string; color: string; bg: string }> = {
    draft: { text: "📝 下書き", color: "#9ca3af", bg: "rgba(156,163,175,0.15)" },
    pending: { text: "🟡 申請中", color: "#fbbf24", bg: "rgba(251,191,36,0.15)" },
    rejected: { text: "🔴 差し戻し", color: "#f87171", bg: "rgba(248,113,113,0.15)" },
    approved: { text: "🟢 承認済み", color: "#34d399", bg: "rgba(52,211,153,0.15)" },
};

export default function MtgReportTab() {
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState<Report[]>([]);
    const [users, setUsers] = useState<UserRow[]>([]);
    const [filter, setFilter] = useState<"pending" | "rejected" | "approved" | "all">("pending");
    const [feedbackText, setFeedbackText] = useState<Record<string, string>>({});
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        const { data: reportRows } = await supabase.from("mtg_reports").select("*").order("updated_at", { ascending: false });
        const { data: userRows } = await supabase.from("profiles").select("id, name");
        setReports((reportRows || []) as Report[]);
        setUsers((userRows || []) as UserRow[]);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const userName = (uid: string) => users.find((u) => u.id === uid)?.name || "名前未設定";

    // 承認＋ポイント付与
    const approve = async (r: Report, points: number) => {
        setBusyId(r.id);
        const { error: upErr } = await supabase.from("mtg_reports")
            .update({ status: "approved", points_awarded: points, admin_feedback: null, updated_at: new Date().toISOString() })
            .eq("id", r.id);
        if (upErr) { alert("承認に失敗しました: " + upErr.message); setBusyId(null); return; }
        const { data: up } = await supabase.from("user_points").select("points").eq("id", r.user_id).single();
        const current = (up as any)?.points || 0;
        await supabase.from("user_points").update({ points: current + points }).eq("id", r.user_id);
        await supabase.from("points_history").insert({ user_id: r.user_id, points, reason: "mtg_report" });
        await createNotification({
            userId: r.user_id,
            type: "mtg_report_approved",
            title: "✅ MTG報告書が承認されました",
            message: `${r.mtg_date}のMTG報告書が承認されました（+${points}pt）`,
            link: "/mtg-report",
            icon: "📝",
        });
        await load();
        setBusyId(null);
    };
    // FB付き差し戻し
    const reject = async (r: Report) => {
        const fb = (feedbackText[r.id] || "").trim();
        if (!fb) { alert("差し戻すにはフィードバックを入力してください"); return; }
        setBusyId(r.id);
        const { error } = await supabase.from("mtg_reports")
            .update({ status: "rejected", admin_feedback: fb, updated_at: new Date().toISOString() })
            .eq("id", r.id);
        if (error) { alert("差し戻しに失敗しました: " + error.message); setBusyId(null); return; }
        await createNotification({
            userId: r.user_id,
            type: "mtg_report_rejected",
            title: "🔄 MTG報告書が差し戻されました",
            message: fb,
            link: "/mtg-report",
            icon: "📝",
        });
        await load();
        setBusyId(null);
    };

    if (loading) return <div style={{ color: "#9ca3af", fontSize: 14, padding: 20 }}>読み込み中...</div>;

    const toggleHidden = async (r: Report) => {
        setBusyId(r.id);
        await supabase.from("mtg_reports").update({ hidden: !r.hidden, updated_at: new Date().toISOString() }).eq("id", r.id);
        setBusyId(null);
        load();
    };
    const shown = filter === "all" ? reports.filter((r) => r.status !== "draft") : reports.filter((r) => r.status === filter);
    const pendingCount = reports.filter((r) => r.status === "pending").length;

    return (
        <div>
            <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 16, padding: 24, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>📋 MTG報告書の承認</div>
                <div style={{ fontSize: 13, color: "#9ca3af" }}>提出されたMTG報告書を確認し、着地していれば承認（ポイント付与）、不十分ならフィードバック付きで差し戻します。</div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {([["pending", `申請中(${pendingCount})`], ["rejected", "差し戻し"], ["approved", "承認済み"], ["all", "すべて"]] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setFilter(k)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", background: filter === k ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: filter === k ? "#fff" : "#9ca3af" }}>{label}</button>
                ))}
            </div>

            {shown.length === 0 ? (
                <div style={{ color: "#6b7280", fontSize: 14, padding: 16 }}>該当する報告書はありません。</div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {shown.map((r) => {
                        const st = STATUS_LABEL[r.status] || STATUS_LABEL.pending;
                        const late = isLateNight(r.end_time);
                        return (
                            <div key={r.id} style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: "#e5e7eb" }}>{userName(r.user_id)} ／ {r.mtg_date}</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, padding: "3px 10px", borderRadius: 6 }}>{st.text}</span>
                                </div>
                                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                                    参加者: {r.participants || "未記入"} ／ {r.start_time}〜{r.end_time} ／ 提出: {fmtDateTime(r.created_at)}{r.points_awarded > 0 && ` ／ +${r.points_awarded}pt`}
                                </div>
                                {late && (
                                    <div style={{ marginTop: 6, fontSize: 12, color: "#f87171", fontWeight: 700 }}>⚠️ 終了が24時超え（深夜の長時間MTG）</div>
                                )}
                                <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 8, background: "rgba(0,0,0,0.2)", fontSize: 13, color: "#d1d5db", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{r.content}</div>

                                {(r.status === "pending" || r.status === "rejected") && (
                                    <div style={{ marginTop: 12 }}>
                                        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                                            <button disabled={busyId === r.id} onClick={() => approve(r, 3)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "rgba(52,211,153,0.2)", color: "#34d399", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>承認 +3pt</button>
                                            <button disabled={busyId === r.id} onClick={() => approve(r, 30)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "rgba(52,211,153,0.3)", color: "#34d399", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>承認 +30pt</button>
                                        </div>
                                        <textarea
                                            value={feedbackText[r.id] || ""}
                                            onChange={(e) => setFeedbackText((prev) => ({ ...prev, [r.id]: e.target.value }))}
                                            placeholder="差し戻す場合：着地していない点・修正してほしい点を書いてください"
                                            style={{ width: "100%", minHeight: 60, padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
                                        />
                                        <button disabled={busyId === r.id} onClick={() => reject(r)} style={{ marginTop: 6, padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.4)", background: "rgba(248,113,113,0.1)", color: "#f87171", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>FB付きで差し戻す</button>
                                    </div>
                                )}
                                {r.status === "approved" && (
                                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                                        {r.hidden && <span style={{ fontSize: 11, fontWeight: 700, color: "#f87171", background: "rgba(248,113,113,0.15)", padding: "3px 10px", borderRadius: 6 }}>🚫 議事録BOX非表示中</span>}
                                        <button disabled={busyId === r.id} onClick={() => toggleHidden(r)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: r.hidden ? "#34d399" : "#9ca3af", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{r.hidden ? "👁 議事録BOXに公開する" : "🚫 議事録BOXで非表示にする"}</button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
