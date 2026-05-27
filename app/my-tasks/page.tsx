"use client";

import { useState, useEffect, useCallback } from "react";
import ScheduleTab from "./ScheduleTab";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type AdminTask = {
    id: string;
    title: string;
    description: string | null;
    assignee_type: "user" | "department";
    assignee_user_id: string | null;
    assignee_department_id: string | null;
    deadline: string | null;
    created_at: string;
};

type PersonalTask = {
    id: string;
    user_id: string;
    title: string;
    description: string | null;
    requires_report: boolean;
    is_done: boolean;
    done_at: string | null;
    created_at: string;
    deadline: string | null;
};

type TaskReport = {
    id: string;
    task_id: string | null;
    personal_task_id: string | null;
    user_id: string;
    report_text: string;
    file_url: string | null;
    file_name: string | null;
    status: "pending" | "approved" | "rejected";
    feedback: string | null;
    submitted_at: string;
};

// JST日付取得
function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().split("T")[0];
}

export default function MyTasksPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [departmentId, setDepartmentId] = useState<string | null>(null);

    // データ
    const [adminTasks, setAdminTasks] = useState<AdminTask[]>([]);
    const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>([]);
    const [reports, setReports] = useState<TaskReport[]>([]);

    // 追加フォーム
    const [newPersonalTitle, setNewPersonalTitle] = useState("");
    const [newPersonalRequiresReport, setNewPersonalRequiresReport] = useState(false);
    const [newPersonalDeadline, setNewPersonalDeadline] = useState("");

    // 報告書モーダル
    const [activeReportTask, setActiveReportTask] = useState<{ type: "admin" | "personal"; task: AdminTask | PersonalTask } | null>(null);
    const [reportText, setReportText] = useState("");
    const [reportFile, setReportFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [activeTab, setActiveTab] = useState<"daily" | "personal" | "admin">("daily");

    const loadAll = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push("/login");
            return;
        }
        setUserId(user.id);

        // プロフィール取得（部署ID）
        const { data: profile } = await supabase
            .from("profiles")
            .select("department_id")
            .eq("id", user.id)
            .single();
        const deptId = profile?.department_id || null;
        setDepartmentId(deptId);

        // admin タスク
        let adminQuery = supabase.from("admin_tasks").select("*").order("created_at", { ascending: false });
        if (deptId) {
            adminQuery = adminQuery.or(`assignee_user_id.eq.${user.id},assignee_department_id.eq.${deptId}`);
        } else {
            adminQuery = adminQuery.eq("assignee_user_id", user.id);
        }
        const { data: adminRows } = await adminQuery;
        setAdminTasks((adminRows || []) as AdminTask[]);

        // 個人タスク
        const { data: personalRows } = await supabase
            .from("personal_tasks")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
        setPersonalTasks((personalRows || []) as PersonalTask[]);
        // 報告書
        const { data: reportRows } = await supabase
            .from("task_reports")
            .select("*")
            .eq("user_id", user.id);
        setReports((reportRows || []) as TaskReport[]);

        setLoading(false);
    }, [router]);

    useEffect(() => { loadAll(); }, [loadAll]);

    // === 個人タスク操作 ===
    const handleAddPersonal = async () => {
        if (!userId || !newPersonalTitle.trim()) return;
        await supabase.from("personal_tasks").insert({
            user_id: userId,
            title: newPersonalTitle.trim(),
            requires_report: newPersonalRequiresReport,
            deadline: newPersonalDeadline || null,
        });
        setNewPersonalTitle("");
        setNewPersonalRequiresReport(false);
        setNewPersonalDeadline("");
        await loadAll();
    };

    const handleTogglePersonal = async (task: PersonalTask) => {
        if (task.requires_report) return; // 報告書型はチェック不可
        const newDone = !task.is_done;
        await supabase
            .from("personal_tasks")
            .update({ is_done: newDone, done_at: newDone ? new Date().toISOString() : null })
            .eq("id", task.id);
        setPersonalTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_done: newDone } : t));
    };

    const handleDeletePersonal = async (id: string) => {
        if (!confirm("このタスクを削除しますか？")) return;
        await supabase.from("personal_tasks").delete().eq("id", id);
        await loadAll();
    };

    // === 報告書ステータス取得 ===
    const getReportForAdminTask = (taskId: string): TaskReport | null => {
        return reports.find(r => r.task_id === taskId) || null;
    };
    const getReportForPersonalTask = (taskId: string): TaskReport | null => {
        return reports.find(r => r.personal_task_id === taskId) || null;
    };

    // === 報告書提出 ===
    const handleOpenReportModal = (type: "admin" | "personal", task: AdminTask | PersonalTask) => {
        setActiveReportTask({ type, task });
        const report = type === "admin"
            ? getReportForAdminTask(task.id)
            : getReportForPersonalTask(task.id);
        setReportText(report?.report_text || "");
        setReportFile(null);
        setMessage("");
    };

    const handleCloseReportModal = () => {
        setActiveReportTask(null);
        setReportText("");
        setReportFile(null);
        setMessage("");
    };

    const handleSubmitReport = async () => {
        if (!activeReportTask || !userId) return;
        if (!reportText.trim()) {
            setMessage("⚠️ 報告書本文を入力してください");
            return;
        }
        setSubmitting(true);
        let fileUrl: string | null = null;
        let fileName: string | null = null;
        try {
            if (reportFile) {
                const ext = reportFile.name.split(".").pop();
                const filePath = `${userId}/${activeReportTask.task.id}-${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from("task-reports")
                    .upload(filePath, reportFile);
                if (uploadError) throw uploadError;
                const { data: urlData } = supabase.storage.from("task-reports").getPublicUrl(filePath);
                fileUrl = urlData.publicUrl;
                fileName = reportFile.name;
            }

            // 既存の差戻し報告書があれば削除
            const existing = activeReportTask.type === "admin"
                ? getReportForAdminTask(activeReportTask.task.id)
                : getReportForPersonalTask(activeReportTask.task.id);
            if (existing && existing.status === "rejected") {
                await supabase.from("task_reports").delete().eq("id", existing.id);
            }

            const insertData: { user_id: string; report_text: string; file_url: string | null; file_name: string | null; status: string; task_id?: string; personal_task_id?: string } = {
                user_id: userId,
                report_text: reportText.trim(),
                file_url: fileUrl,
                file_name: fileName,
                status: "pending",
            };
            if (activeReportTask.type === "admin") {
                insertData.task_id = activeReportTask.task.id;
            } else {
                insertData.personal_task_id = activeReportTask.task.id;
            }

            const { error: insertError } = await supabase.from("task_reports").insert(insertData);
            if (insertError) throw insertError;

            setMessage("✅ 報告書を提出しました！");
            await loadAll();
            setTimeout(() => handleCloseReportModal(), 1500);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setMessage(`❌ エラー: ${errorMessage}`);
        } finally {
            setSubmitting(false);
        }
    };

    // === ステータス計算 ===
    const getAdminTaskStatus = (task: AdminTask): string => {
        const r = getReportForAdminTask(task.id);
        if (!r) return "未提出";
        if (r.status === "pending") return "審査中";
        if (r.status === "approved") return "承認済";
        return "差戻し";
    };
    const getPersonalReportStatus = (task: PersonalTask): string => {
        const r = getReportForPersonalTask(task.id);
        if (!r) return "未提出";
        if (r.status === "pending") return "審査中";
        if (r.status === "approved") return "承認済";
        return "差戻し";
    };

    const statusColors: Record<string, { color: string; bg: string; border: string }> = {
        "未提出": { color: "#f59e0b", bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.3)" },
        "審査中": { color: "#a78bfa", bg: "rgba(168,139,250,0.15)", border: "rgba(168,139,250,0.3)" },
        "承認済": { color: "#34d399", bg: "rgba(52,211,153,0.15)", border: "rgba(52,211,153,0.3)" },
        "差戻し": { color: "#f87171", bg: "rgba(248,113,113,0.15)", border: "rgba(248,113,113,0.3)" },
    };

    if (loading) {
        return <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: 40, color: "#f9fafb", textAlign: "center" }}>読み込み中...</main>;
    }

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "32px 24px 64px", color: "#f9fafb" }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>

                <div style={{ marginBottom: 32 }}>
                    <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, marginBottom: 4, cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 32, fontWeight: 900, margin: "0 0 8px" }}>📋 タスク管理</h1>
                    <p style={{ color: "#9ca3af", fontSize: 14 }}>デイリー / 自分のタスク / adminからのタスクを管理</p>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                    {([["daily", "☀️ デイリー"], ["personal", "📝 自分のタスク"], ["admin", "🔵 adminから"]] as const).map(([key, label]) => (
                        <button key={key} onClick={() => setActiveTab(key)} style={{ padding: "10px 20px", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", background: activeTab === key ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: activeTab === key ? "#fff" : "#9ca3af" }}>{label}</button>
                    ))}
                </div>
                {activeTab === "daily" && <ScheduleTab />}
                {/* ===== 個人タスク ===== */}
                {activeTab === "personal" && (
                <section style={{ marginBottom: 32, padding: 24, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 }}>
                    <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>📝 自分のタスク</div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                        {personalTasks.length === 0 ? (
                            <div style={{ padding: 20, textAlign: "center", color: "#6b7280", fontSize: 13 }}>タスクがありません。下から追加できます</div>
                        ) : personalTasks.map(t => {
                            const deadlineInfo = (() => {
                                if (!t.deadline) return null;
                                const today = new Date(); today.setHours(0, 0, 0, 0);
                                const due = new Date(t.deadline); due.setHours(0, 0, 0, 0);
                                const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
                                const label = `⏰ 締切: ${due.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}`;
                                if (diffDays < 0) return { label: label + "（期限切れ）", color: "#f87171" };
                                if (diffDays === 0) return { label: label + "（今日）", color: "#fbbf24" };
                                if (diffDays === 1) return { label: label + "（明日）", color: "#fbbf24" };
                                return { label, color: "#9ca3af" };
                            })();
                            if (t.requires_report) {
                                const status = getPersonalReportStatus(t);
                                const s = statusColors[status];
                                return (
                                    <div key={t.id} onClick={() => handleOpenReportModal("personal", t)} style={{ padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${s.border}`, cursor: "pointer" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ padding: "2px 8px", borderRadius: 4, background: s.bg, color: s.color, fontSize: 10, fontWeight: 800 }}>{status}</span>
                                                <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 10, fontWeight: 700 }}>報告書型</span>
                                                <span style={{ fontSize: 14, color: "#f9fafb", fontWeight: 600 }}>{t.title}</span>
                                                {deadlineInfo && <span style={{ fontSize: 11, color: deadlineInfo.color, fontWeight: 700 }}>{deadlineInfo.label}</span>}
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 700 }}>{status === "未提出" ? "提出する →" : "詳細 →"}</span>
                                                <button onClick={(e) => { e.stopPropagation(); handleDeletePersonal(t.id); }} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}>🗑️</button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div key={t.id} onClick={() => handleTogglePersonal(t)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: t.is_done ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${t.is_done ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.08)"}`, cursor: "pointer", transition: "all 0.2s" }}>
                                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: t.is_done ? "linear-gradient(135deg, #34d399, #10b981)" : "transparent", border: `2px solid ${t.is_done ? "transparent" : "rgba(255,255,255,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
                                        {t.is_done && <span style={{ color: "#fff", fontSize: 13, fontWeight: 900 }}>✓</span>}
                                    </div>
                                    <span style={{ flex: 1, fontSize: 14, color: t.is_done ? "#34d399" : "#f9fafb", textDecoration: t.is_done ? "line-through" : "none", fontWeight: t.is_done ? 500 : 600 }}>{t.title}{deadlineInfo && <span style={{ fontSize: 11, color: t.is_done ? "#6b7280" : deadlineInfo.color, fontWeight: 700, marginLeft: 8 }}>{deadlineInfo.label}</span>}</span>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeletePersonal(t.id); }} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 14, padding: 4 }} title="削除">🗑️</button>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ padding: 12, borderRadius: 10, background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)" }}>
                        <input value={newPersonalTitle} onChange={(e) => setNewPersonalTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddPersonal()} placeholder="例: 来週のMTG準備" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f9fafb", fontSize: 13, boxSizing: "border-box", marginBottom: 8 }} />
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: "#9ca3af" }}>⏰ 期日（任意）</span>
                            <input type="date" value={newPersonalDeadline} onChange={(e) => setNewPersonalDeadline(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f9fafb", fontSize: 13 }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9ca3af", cursor: "pointer" }}>
                                <input type="checkbox" checked={newPersonalRequiresReport} onChange={(e) => setNewPersonalRequiresReport(e.target.checked)} />
                                報告書提出型にする（admin承認で +1pt）
                            </label>
                            <button onClick={handleAddPersonal} disabled={!newPersonalTitle.trim()} style={{ padding: "8px 16px", borderRadius: 8, background: newPersonalTitle.trim() ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", border: "none", color: "#fff", fontWeight: 700, cursor: newPersonalTitle.trim() ? "pointer" : "not-allowed", fontSize: 13 }}>+ タスク追加</button>
                        </div>
                    </div>
                </section>  )}

                {/* ===== adminタスク ===== */}
                {activeTab === "admin" && (
                <section style={{ marginBottom: 32, padding: 24, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 }}>
                    <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>🔵 adminから（報告書必要）</div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {adminTasks.length === 0 ? (
                            <div style={{ padding: 20, textAlign: "center", color: "#6b7280", fontSize: 13 }}>adminからのタスクはありません</div>
                        ) : adminTasks.map(t => {
                            const status = getAdminTaskStatus(t);
                            const s = statusColors[status];
                            return (
                                <div key={t.id} onClick={() => handleOpenReportModal("admin", t)} style={{ padding: 18, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${s.border}`, cursor: "pointer" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                                <span style={{ padding: "3px 10px", borderRadius: 6, background: s.bg, color: s.color, fontSize: 11, fontWeight: 800 }}>{status}</span>
                                                {t.assignee_type === "department" && (
                                                    <span style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 11, fontWeight: 700 }}>部署宛</span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>{t.title}</div>
                                            {t.description && <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.6, marginBottom: 6 }}>{t.description}</div>}
                                            {t.deadline && <div style={{ fontSize: 12, color: "#fbbf24" }}>⏰ 締切: {new Date(t.deadline).toLocaleDateString("ja-JP")}</div>}
                                        </div>
                                        <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, whiteSpace: "nowrap" }}>{status === "未提出" ? "提出する →" : "詳細 →"}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section> )}
            </div>

            {/* ===== 報告書モーダル ===== */}
            {activeReportTask && (() => {
                const t = activeReportTask.task;
                const report = activeReportTask.type === "admin"
                    ? getReportForAdminTask(t.id)
                    : getReportForPersonalTask(t.id);
                return (
                    <div onClick={handleCloseReportModal} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
                        <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a1a2e", borderRadius: 16, padding: 32, maxWidth: 600, width: "100%", maxHeight: "90vh", overflow: "auto", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#f9fafb", margin: "0 0 8px" }}>{t.title}</h2>
                            {"description" in t && t.description && <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>{t.description}</p>}

                            {report && report.status !== "rejected" ? (
                                <div style={{ padding: 16, borderRadius: 12, background: report.status === "approved" ? "rgba(52,211,153,0.1)" : "rgba(168,139,250,0.1)", border: `1px solid ${report.status === "approved" ? "rgba(52,211,153,0.3)" : "rgba(168,139,250,0.3)"}`, marginBottom: 16 }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: report.status === "approved" ? "#34d399" : "#a78bfa", marginBottom: 8 }}>
                                        {report.status === "approved" ? "✅ 承認済み (+1pt 獲得)" : "🕐 審査中"}
                                    </div>
                                    <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{report.report_text}</div>
                                    {report.file_url && <a href={report.file_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 8, color: "#818cf8", fontSize: 12, fontWeight: 600 }}>📎 {report.file_name}</a>}
                                    {report.feedback && <div style={{ marginTop: 12, padding: 10, background: "rgba(255,255,255,0.05)", borderRadius: 8, fontSize: 12, color: "#d1d5db" }}>💬 フィードバック: {report.feedback}</div>}
                                </div>
                            ) : (
                                <>
                                    {report && report.status === "rejected" && (
                                        <div style={{ padding: 12, borderRadius: 10, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", marginBottom: 16 }}>
                                            <div style={{ fontSize: 12, fontWeight: 800, color: "#f87171", marginBottom: 6 }}>🔄 差戻されました</div>
                                            {report.feedback && <div style={{ fontSize: 12, color: "#d1d5db" }}>💬 {report.feedback}</div>}
                                        </div>
                                    )}
                                    <div style={{ marginBottom: 16 }}>
                                        <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, marginBottom: 6, display: "block" }}>📝 報告書本文 *</label>
                                        <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} rows={6} placeholder="タスクの実施結果を記入してください..." style={{ width: "100%", padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f9fafb", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
                                    </div>
                                    <div style={{ marginBottom: 20 }}>
                                        <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, marginBottom: 6, display: "block" }}>📎 添付ファイル（任意）</label>
                                        <input type="file" onChange={(e) => setReportFile(e.target.files?.[0] || null)} style={{ width: "100%", padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f9fafb", fontSize: 13 }} />
                                        {reportFile && <div style={{ fontSize: 11, color: "#818cf8", marginTop: 4 }}>選択中: {reportFile.name}</div>}
                                    </div>
                                    {message && <div style={{ padding: 12, borderRadius: 8, background: "rgba(99,102,241,0.15)", marginBottom: 16, fontSize: 13, color: "#a5b4fc" }}>{message}</div>}
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button onClick={handleCloseReportModal} style={{ flex: 1, padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", fontWeight: 600, cursor: "pointer" }}>キャンセル</button>
                                        <button onClick={handleSubmitReport} disabled={submitting} style={{ flex: 1, padding: 12, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", color: "#fff", fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}>
                                            {submitting ? "送信中..." : "📤 提出する"}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            })()}
            {/* ===== ページ下部のメニューに戻るボタン ===== */}
            <div style={{ marginTop: 40, display: "flex", justifyContent: "center" }}>
                <button onClick={() => router.push("/menu")} style={{
                    padding: "12px 32px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#9ca3af",
                    fontSize: 14,
                    cursor: "pointer",
                    fontWeight: 600,
                }}>
                    ☰ メニューに戻る
                </button>
            </div>
        </main>
    );
}