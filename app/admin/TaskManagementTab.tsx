"use client";

import { useState, useEffect, useCallback } from "react";
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
    reviewed_by: string | null;
    reviewed_at: string | null;
};

type Profile = { id: string; name: string; department_id: string | null };
type Department = { id: string; name: string; code: string };
type PersonalTask = { id: string; user_id: string; title: string; description: string | null; requires_report: boolean };

export default function TaskManagementTab() {
    const [subTab, setSubTab] = useState<"create" | "review">("create");
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");

    // データ
    const [tasks, setTasks] = useState<AdminTask[]>([]);
    const [reports, setReports] = useState<TaskReport[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>([]);

    // タスク作成フォーム
    const [newTitle, setNewTitle] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [newAssigneeType, setNewAssigneeType] = useState<"user" | "department">("user");
    const [newAssigneeUserId, setNewAssigneeUserId] = useState("");
    const [newAssigneeDeptId, setNewAssigneeDeptId] = useState("");
    const [newDeadline, setNewDeadline] = useState("");
    const [creating, setCreating] = useState(false);

    // 承認モーダル
    const [activeReport, setActiveReport] = useState<TaskReport | null>(null);
    const [feedback, setFeedback] = useState("");
    const [reviewing, setReviewing] = useState(false);

    const loadAll = useCallback(async () => {
        // タスク一覧
        const { data: taskRows } = await supabase
            .from("admin_tasks")
            .select("*")
            .order("created_at", { ascending: false });
        setTasks((taskRows || []) as AdminTask[]);

        // 報告書一覧
        const { data: reportRows } = await supabase
            .from("task_reports")
            .select("*")
            .order("submitted_at", { ascending: false });
        setReports((reportRows || []) as TaskReport[]);

        // ユーザー一覧
        const { data: profileRows } = await supabase
            .from("profiles")
            .select("id, name, department_id")
            .order("name");
        setProfiles((profileRows || []) as Profile[]);

        // 部署一覧
        const { data: deptRows } = await supabase
            .from("departments")
            .select("id, name, code")
            .order("code");
        setDepartments((deptRows || []) as Department[]);

        // 個人タスク（報告書型）
        const { data: pTaskRows } = await supabase
            .from("personal_tasks")
            .select("*")
            .eq("requires_report", true);
        setPersonalTasks((pTaskRows || []) as PersonalTask[]);

        setLoading(false);
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    // === タスク作成 ===
    const handleCreateTask = async () => {
        if (!newTitle.trim()) {
            setMessage("⚠️ タイトルを入力してください");
            return;
        }
        if (newAssigneeType === "user" && !newAssigneeUserId) {
            setMessage("⚠️ 割り当てるユーザーを選択してください");
            return;
        }
        if (newAssigneeType === "department" && !newAssigneeDeptId) {
            setMessage("⚠️ 割り当てる部署を選択してください");
            return;
        }

        setCreating(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const insertData = {
                title: newTitle.trim(),
                description: newDescription.trim() || null,
                assignee_type: newAssigneeType,
                assignee_user_id: newAssigneeType === "user" ? newAssigneeUserId : null,
                assignee_department_id: newAssigneeType === "department" ? newAssigneeDeptId : null,
                deadline: newDeadline || null,
                created_by: user?.id,
            };

            const { error } = await supabase.from("admin_tasks").insert(insertData);
            if (error) throw error;

            setMessage("✅ タスクを作成しました");
            setNewTitle("");
            setNewDescription("");
            setNewAssigneeUserId("");
            setNewAssigneeDeptId("");
            setNewDeadline("");
            await loadAll();
            setTimeout(() => setMessage(""), 3000);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setMessage(`❌ エラー: ${errorMessage}`);
        } finally {
            setCreating(false);
        }
    };

    // === タスク削除 ===
    const handleDeleteTask = async (id: string) => {
        if (!confirm("このタスクを削除しますか？\n（提出された報告書も削除されます）")) return;
        await supabase.from("admin_tasks").delete().eq("id", id);
        await loadAll();
    };

    // === 報告書承認 ===
    const handleApprove = async () => {
        if (!activeReport) return;
        setReviewing(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // 報告書を承認状態に更新
            await supabase
                .from("task_reports")
                .update({
                    status: "approved",
                    feedback: feedback.trim() || null,
                    reviewed_by: user?.id,
                    reviewed_at: new Date().toISOString(),
                })
                .eq("id", activeReport.id);

            // +1pt 付与
            await supabase.rpc("increment_user_points", {
                p_user_id: activeReport.user_id,
                p_amount: 1,
                p_reason: "タスク報告書承認"
            }).then(({ error }) => {
                if (error) {
                    // RPC関数がない場合は直接更新
                    return supabase.from("points_history").insert({
                        user_id: activeReport.user_id,
                        change: 1,
                        reason: "タスク報告書承認",
                    });
                }
            });

            // 直接 user_points と points_history を更新
            const { data: currentPoints } = await supabase
                .from("user_points")
                .select("points, total_earned")
                .eq("user_id", activeReport.user_id)
                .single();

            const newPoints = (currentPoints?.points || 0) + 1;
            const newTotalEarned = (currentPoints?.total_earned || 0) + 1;

            await supabase
                .from("user_points")
                .upsert({
                    user_id: activeReport.user_id,
                    points: newPoints,
                    total_earned: newTotalEarned,
                });

            await supabase.from("points_history").insert({
                user_id: activeReport.user_id,
                change: 1,
                reason: "タスク報告書承認",
            });

            setMessage("✅ 承認しました（+1pt 付与）");
            await loadAll();
            setActiveReport(null);
            setFeedback("");
            setTimeout(() => setMessage(""), 3000);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setMessage(`❌ エラー: ${errorMessage}`);
        } finally {
            setReviewing(false);
        }
    };

    // === 報告書差戻し ===
    const handleReject = async () => {
        if (!activeReport) return;
        if (!feedback.trim()) {
            alert("差戻し理由を記入してください");
            return;
        }
        setReviewing(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            await supabase
                .from("task_reports")
                .update({
                    status: "rejected",
                    feedback: feedback.trim(),
                    reviewed_by: user?.id,
                    reviewed_at: new Date().toISOString(),
                })
                .eq("id", activeReport.id);

            setMessage("🔄 差戻しました");
            await loadAll();
            setActiveReport(null);
            setFeedback("");
            setTimeout(() => setMessage(""), 3000);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setMessage(`❌ エラー: ${errorMessage}`);
        } finally {
            setReviewing(false);
        }
    };

    const getUserName = (userId: string): string => {
        return profiles.find(p => p.id === userId)?.name || "?";
    };

    const getTaskTitle = (report: TaskReport): string => {
        if (report.task_id) {
            return tasks.find(t => t.id === report.task_id)?.title || "(削除済みタスク)";
        }
        if (report.personal_task_id) {
            const pt = personalTasks.find(t => t.id === report.personal_task_id);
            return pt ? `(個人) ${pt.title}` : "(削除済み個人タスク)";
        }
        return "(不明)";
    };

    const pendingReports = reports.filter(r => r.status === "pending");

    if (loading) {
        return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>読み込み中...</div>;
    }

    return (
        <div>
            {/* サブタブ */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 12 }}>
                <button onClick={() => setSubTab("create")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: subTab === "create" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "transparent", color: subTab === "create" ? "#fff" : "#9ca3af", fontWeight: 700, cursor: "pointer" }}>
                    📋 タスク作成・一覧
                </button>
                <button onClick={() => setSubTab("review")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: subTab === "review" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "transparent", color: subTab === "review" ? "#fff" : "#9ca3af", fontWeight: 700, cursor: "pointer" }}>
                    📥 報告書の承認 {pendingReports.length > 0 && <span style={{ marginLeft: 4, padding: "1px 6px", borderRadius: 4, background: "#f59e0b", color: "#fff", fontSize: 11 }}>{pendingReports.length}</span>}
                </button>
            </div>

            {message && (
                <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: "rgba(99,102,241,0.15)", color: "#a5b4fc", fontSize: 14 }}>{message}</div>
            )}

            {/* タスク作成 */}
            {subTab === "create" && (
                <div>
                    <div style={{ marginBottom: 24, padding: 20, background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12 }}>
                        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: "#a78bfa" }}>📝 新しいタスクを作成</h3>

                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, marginBottom: 4, display: "block" }}>タイトル *</label>
                            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="例: 競合分析レポート提出" style={{ width: "100%", padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f9fafb", fontSize: 14, boxSizing: "border-box" }} />
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, marginBottom: 4, display: "block" }}>説明（任意）</label>
                            <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={3} placeholder="タスクの詳細・指示" style={{ width: "100%", padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f9fafb", fontSize: 14, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, marginBottom: 4, display: "block" }}>割り当て先 *</label>
                            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#d1d5db", cursor: "pointer" }}>
                                    <input type="radio" name="assignee" checked={newAssigneeType === "user"} onChange={() => setNewAssigneeType("user")} />
                                    個人
                                </label>
                                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#d1d5db", cursor: "pointer" }}>
                                    <input type="radio" name="assignee" checked={newAssigneeType === "department"} onChange={() => setNewAssigneeType("department")} />
                                    部署
                                </label>
                            </div>
                            {newAssigneeType === "user" ? (
                                <select value={newAssigneeUserId} onChange={(e) => setNewAssigneeUserId(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f9fafb", fontSize: 14, boxSizing: "border-box" }}>
                                    <option value="">選択してください</option>
                                    {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            ) : (
                                <select value={newAssigneeDeptId} onChange={(e) => setNewAssigneeDeptId(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f9fafb", fontSize: 14, boxSizing: "border-box" }}>
                                    <option value="">選択してください</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.code} - {d.name}</option>)}
                                </select>
                            )}
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, marginBottom: 4, display: "block" }}>締切日（任意）</label>
                            <input type="date" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f9fafb", fontSize: 14 }} />
                        </div>

                        <button onClick={handleCreateTask} disabled={creating} style={{ padding: "10px 24px", borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", color: "#fff", fontWeight: 800, cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.6 : 1 }}>
                            {creating ? "作成中..." : "📤 タスクを作成"}
                        </button>
                    </div>

                    {/* 既存タスク一覧 */}
                    <h3 style={{ margin: "24px 0 12px", fontSize: 14, color: "#9ca3af", fontWeight: 700, letterSpacing: 2 }}>📋 既存タスク ({tasks.length}件)</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {tasks.length === 0 ? (
                            <div style={{ padding: 30, textAlign: "center", color: "#6b7280", background: "rgba(255,255,255,0.02)", borderRadius: 12 }}>まだタスクがありません</div>
                        ) : tasks.map(t => {
                            const taskReports = reports.filter(r => r.task_id === t.id);
                            const approvedCount = taskReports.filter(r => r.status === "approved").length;
                            const pendingCount = taskReports.filter(r => r.status === "pending").length;
                            const dept = departments.find(d => d.id === t.assignee_department_id);
                            const assignee = t.assignee_type === "user"
                                ? getUserName(t.assignee_user_id || "")
                                : `${dept?.code || "?"} - ${dept?.name || "?"}`;

                            return (
                                <div key={t.id} style={{ padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                                <span style={{ padding: "2px 8px", borderRadius: 4, background: t.assignee_type === "user" ? "rgba(99,102,241,0.15)" : "rgba(168,139,250,0.15)", color: t.assignee_type === "user" ? "#818cf8" : "#a78bfa", fontSize: 11, fontWeight: 700 }}>
                                                    {t.assignee_type === "user" ? "👤 個人" : "🏢 部署"}
                                                </span>
                                                <span style={{ fontSize: 13, color: "#d1d5db" }}>→ {assignee}</span>
                                            </div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>{t.title}</div>
                                            {t.description && <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6, marginBottom: 6 }}>{t.description}</div>}
                                            {t.deadline && <div style={{ fontSize: 11, color: "#fbbf24" }}>⏰ 締切: {new Date(t.deadline).toLocaleDateString("ja-JP")}</div>}
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                                            <div style={{ display: "flex", gap: 4 }}>
                                                {pendingCount > 0 && <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(168,139,250,0.15)", color: "#a78bfa", fontSize: 11, fontWeight: 700 }}>審査中 {pendingCount}</span>}
                                                {approvedCount > 0 && <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(52,211,153,0.15)", color: "#34d399", fontSize: 11, fontWeight: 700 }}>承認 {approvedCount}</span>}
                                            </div>
                                            <button onClick={() => handleDeleteTask(t.id)} style={{ background: "none", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>🗑️ 削除</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 報告書の承認 */}
            {subTab === "review" && (
                <div>
                    <div style={{ marginBottom: 16, fontSize: 13, color: "#9ca3af" }}>
                        審査中: <span style={{ color: "#fbbf24", fontWeight: 700 }}>{pendingReports.length}件</span> / 全{reports.length}件
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {reports.length === 0 ? (
                            <div style={{ padding: 30, textAlign: "center", color: "#6b7280", background: "rgba(255,255,255,0.02)", borderRadius: 12 }}>まだ報告書がありません</div>
                        ) : reports.map(r => {
                            const statusColors: Record<string, { color: string; bg: string; label: string }> = {
                                "pending": { color: "#a78bfa", bg: "rgba(168,139,250,0.15)", label: "🕐 審査中" },
                                "approved": { color: "#34d399", bg: "rgba(52,211,153,0.15)", label: "✅ 承認済" },
                                "rejected": { color: "#f87171", bg: "rgba(248,113,113,0.15)", label: "🔄 差戻し" },
                            };
                            const s = statusColors[r.status];
                            return (
                                <div key={r.id} onClick={() => { setActiveReport(r); setFeedback(r.feedback || ""); }} style={{ padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${r.status === "pending" ? "rgba(168,139,250,0.3)" : "rgba(255,255,255,0.08)"}`, cursor: "pointer", transition: "all 0.2s" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                                        <div style={{ flex: 1, minWidth: 200 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                                                <span style={{ padding: "2px 8px", borderRadius: 4, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700 }}>{s.label}</span>
                                                <span style={{ fontSize: 13, color: "#d1d5db", fontWeight: 700 }}>{getUserName(r.user_id)}</span>
                                            </div>
                                            <div style={{ fontSize: 14, color: "#f9fafb", marginBottom: 4 }}>{getTaskTitle(r)}</div>
                                            <div style={{ fontSize: 11, color: "#6b7280" }}>提出: {new Date(r.submitted_at).toLocaleString("ja-JP")}</div>
                                        </div>
                                        <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 700 }}>詳細 →</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 報告書詳細モーダル */}
            {activeReport && (
                <div onClick={() => setActiveReport(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a1a2e", borderRadius: 16, padding: 32, maxWidth: 600, width: "100%", maxHeight: "90vh", overflow: "auto", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f9fafb", margin: "0 0 4px" }}>📥 報告書の確認</h2>
                        <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>
                            提出者: {getUserName(activeReport.user_id)} / 提出: {new Date(activeReport.submitted_at).toLocaleString("ja-JP")}
                        </div>

                        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: "rgba(99,102,241,0.08)" }}>
                            <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, marginBottom: 4 }}>📋 タスク</div>
                            <div style={{ fontSize: 14, color: "#f9fafb" }}>{getTaskTitle(activeReport)}</div>
                        </div>

                        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)" }}>
                            <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, marginBottom: 6 }}>📝 報告書本文</div>
                            <div style={{ fontSize: 13, color: "#f9fafb", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{activeReport.report_text}</div>
                        </div>

                        {activeReport.file_url && (
                            <div style={{ marginBottom: 16 }}>
                                <a href={activeReport.file_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", padding: "8px 16px", borderRadius: 8, background: "rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                                    📎 添付ファイル: {activeReport.file_name}
                                </a>
                            </div>
                        )}

                        {activeReport.status === "pending" ? (
                            <>
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, marginBottom: 6, display: "block" }}>💬 フィードバック（差戻し時は必須）</label>
                                    <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} placeholder="任意のコメント（差戻し時は理由を記入）" style={{ width: "100%", padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f9fafb", fontSize: 13, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
                                </div>

                                <div style={{ display: "flex", gap: 8 }}>
                                    <button onClick={() => setActiveReport(null)} style={{ flex: 1, padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", fontWeight: 600, cursor: "pointer" }}>閉じる</button>
                                    <button onClick={handleReject} disabled={reviewing} style={{ flex: 1, padding: 12, borderRadius: 8, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", fontWeight: 700, cursor: reviewing ? "not-allowed" : "pointer", opacity: reviewing ? 0.6 : 1 }}>🔄 差戻し</button>
                                    <button onClick={handleApprove} disabled={reviewing} style={{ flex: 1, padding: 12, borderRadius: 8, background: "linear-gradient(135deg, #10b981, #34d399)", border: "none", color: "#fff", fontWeight: 800, cursor: reviewing ? "not-allowed" : "pointer", opacity: reviewing ? 0.6 : 1 }}>✅ 承認 (+1pt)</button>
                                </div>
                            </>
                        ) : (
                            <div style={{ padding: 12, borderRadius: 8, background: activeReport.status === "approved" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", marginBottom: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: activeReport.status === "approved" ? "#34d399" : "#f87171", marginBottom: 4 }}>
                                    {activeReport.status === "approved" ? "✅ 承認済み" : "🔄 差戻し済み"}
                                </div>
                                {activeReport.feedback && (
                                    <div style={{ fontSize: 12, color: "#d1d5db" }}>💬 {activeReport.feedback}</div>
                                )}
                                <button onClick={() => setActiveReport(null)} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", fontSize: 12, cursor: "pointer" }}>閉じる</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}