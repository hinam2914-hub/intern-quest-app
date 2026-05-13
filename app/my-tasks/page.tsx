"use client";

import { useState, useEffect, useCallback } from "react";
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

type TaskReport = {
    id: string;
    task_id: string;
    user_id: string;
    report_text: string;
    file_url: string | null;
    file_name: string | null;
    status: "pending" | "approved" | "rejected";
    feedback: string | null;
    submitted_at: string;
};

export default function MyTasksPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [departmentId, setDepartmentId] = useState<string | null>(null);
    const [tasks, setTasks] = useState<AdminTask[]>([]);
    const [reports, setReports] = useState<TaskReport[]>([]);

    // モーダル state
    const [activeTask, setActiveTask] = useState<AdminTask | null>(null);
    const [reportText, setReportText] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");

    const loadTasks = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push("/login");
            return;
        }
        setUserId(user.id);

        // 自分のプロフィール取得（部署ID用）
        const { data: profile } = await supabase
            .from("profiles")
            .select("department_id")
            .eq("id", user.id)
            .single();
        const deptId = profile?.department_id || null;
        setDepartmentId(deptId);

        // 自分宛のタスクを取得（個人宛 + 部署宛）
        let query = supabase.from("admin_tasks").select("*").order("created_at", { ascending: false });

        if (deptId) {
            query = query.or(`assignee_user_id.eq.${user.id},assignee_department_id.eq.${deptId}`);
        } else {
            query = query.eq("assignee_user_id", user.id);
        }

        const { data: taskRows } = await query;
        setTasks((taskRows || []) as AdminTask[]);

        // 自分の提出した報告書を取得
        const { data: reportRows } = await supabase
            .from("task_reports")
            .select("*")
            .eq("user_id", user.id);
        setReports((reportRows || []) as TaskReport[]);

        setLoading(false);
    }, [router]);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    const getReportForTask = (taskId: string): TaskReport | null => {
        return reports.find(r => r.task_id === taskId) || null;
    };

    const getTaskStatus = (task: AdminTask): "未提出" | "審査中" | "承認済" | "差戻し" => {
        const report = getReportForTask(task.id);
        if (!report) return "未提出";
        if (report.status === "pending") return "審査中";
        if (report.status === "approved") return "承認済";
        return "差戻し";
    };

    const handleOpenModal = (task: AdminTask) => {
        const report = getReportForTask(task.id);
        setActiveTask(task);
        setReportText(report?.report_text || "");
        setFile(null);
        setMessage("");
    };

    const handleCloseModal = () => {
        setActiveTask(null);
        setReportText("");
        setFile(null);
        setMessage("");
    };

    const handleSubmit = async () => {
        if (!activeTask || !userId) return;
        if (!reportText.trim()) {
            setMessage("⚠️ 報告書本文を入力してください");
            return;
        }

        setSubmitting(true);
        let fileUrl: string | null = null;
        let fileName: string | null = null;

        try {
            // ファイルアップロード
            if (file) {
                const ext = file.name.split(".").pop();
                const filePath = `${userId}/${activeTask.id}-${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from("task-reports")
                    .upload(filePath, file);
                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from("task-reports").getPublicUrl(filePath);
                fileUrl = urlData.publicUrl;
                fileName = file.name;
            }

            // 既存の差戻し報告書があれば削除して再提出
            const existing = getReportForTask(activeTask.id);
            if (existing && existing.status === "rejected") {
                await supabase.from("task_reports").delete().eq("id", existing.id);
            }

            // 報告書登録
            const { error: insertError } = await supabase.from("task_reports").insert({
                task_id: activeTask.id,
                user_id: userId,
                report_text: reportText.trim(),
                file_url: fileUrl,
                file_name: fileName,
                status: "pending",
            });
            if (insertError) throw insertError;

            setMessage("✅ 報告書を提出しました！");
            await loadTasks();
            setTimeout(() => handleCloseModal(), 1500);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setMessage(`❌ エラー: ${errorMessage}`);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: 40, color: "#f9fafb", textAlign: "center" }}>
                読み込み中...
            </main>
        );
    }

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "32px 24px 64px", color: "#f9fafb" }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                {/* ヘッダー */}
                <button onClick={() => router.push("/mypage")} style={{ marginBottom: 20, padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    🏠 ホームに戻る
                </button>

                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, marginBottom: 4 }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 32, fontWeight: 900, margin: "0 0 8px" }}>📋 タスク管理</h1>
                    <p style={{ color: "#9ca3af", fontSize: 14 }}>adminから割り当てられたタスクと報告書を管理</p>
                </div>

                {/* タスク一覧 */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {tasks.length === 0 ? (
                        <div style={{ padding: 40, textAlign: "center", color: "#6b7280", background: "rgba(255,255,255,0.03)", borderRadius: 16 }}>
                            割り当てられたタスクはありません
                        </div>
                    ) : tasks.map(task => {
                        const status = getTaskStatus(task);
                        const statusStyle = {
                            "未提出": { color: "#f59e0b", bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.3)" },
                            "審査中": { color: "#a78bfa", bg: "rgba(168,139,250,0.15)", border: "rgba(168,139,250,0.3)" },
                            "承認済": { color: "#34d399", bg: "rgba(52,211,153,0.15)", border: "rgba(52,211,153,0.3)" },
                            "差戻し": { color: "#f87171", bg: "rgba(248,113,113,0.15)", border: "rgba(248,113,113,0.3)" },
                        }[status];

                        return (
                            <div key={task.id} onClick={() => handleOpenModal(task)} style={{ padding: 20, background: "rgba(255,255,255,0.03)", border: `1px solid ${statusStyle.border}`, borderRadius: 12, cursor: "pointer", transition: "all 0.2s" }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
                                onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                            <span style={{ padding: "3px 10px", borderRadius: 6, background: statusStyle.bg, color: statusStyle.color, fontSize: 11, fontWeight: 800 }}>{status}</span>
                                            {task.assignee_type === "department" && (
                                                <span style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 11, fontWeight: 700 }}>部署宛</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>{task.title}</div>
                                        {task.description && (
                                            <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.6, marginBottom: 8 }}>{task.description}</div>
                                        )}
                                        {task.deadline && (
                                            <div style={{ fontSize: 12, color: "#fbbf24" }}>
                                                ⏰ 締切: {new Date(task.deadline).toLocaleDateString("ja-JP")}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, whiteSpace: "nowrap" }}>
                                        {status === "未提出" ? "提出する →" : "詳細 →"}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* モーダル */}
            {activeTask && (
                <div onClick={handleCloseModal} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a1a2e", borderRadius: 16, padding: 32, maxWidth: 600, width: "100%", maxHeight: "90vh", overflow: "auto", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#f9fafb", margin: "0 0 8px" }}>{activeTask.title}</h2>
                        {activeTask.description && (
                            <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>{activeTask.description}</p>
                        )}

                        {(() => {
                            const report = getReportForTask(activeTask.id);
                            if (report && report.status !== "rejected") {
                                return (
                                    <div style={{ padding: 16, borderRadius: 12, background: report.status === "approved" ? "rgba(52,211,153,0.1)" : "rgba(168,139,250,0.1)", border: `1px solid ${report.status === "approved" ? "rgba(52,211,153,0.3)" : "rgba(168,139,250,0.3)"}`, marginBottom: 16 }}>
                                        <div style={{ fontSize: 12, fontWeight: 800, color: report.status === "approved" ? "#34d399" : "#a78bfa", marginBottom: 8 }}>
                                            {report.status === "approved" ? "✅ 承認済み (+1pt 獲得)" : "🕐 審査中"}
                                        </div>
                                        <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{report.report_text}</div>
                                        {report.file_url && (
                                            <a href={report.file_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 8, color: "#818cf8", fontSize: 12, fontWeight: 600 }}>
                                                📎 {report.file_name}
                                            </a>
                                        )}
                                        {report.feedback && (
                                            <div style={{ marginTop: 12, padding: 10, background: "rgba(255,255,255,0.05)", borderRadius: 8, fontSize: 12, color: "#d1d5db" }}>
                                                💬 フィードバック: {report.feedback}
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            return (
                                <>
                                    {report && report.status === "rejected" && (
                                        <div style={{ padding: 12, borderRadius: 10, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", marginBottom: 16 }}>
                                            <div style={{ fontSize: 12, fontWeight: 800, color: "#f87171", marginBottom: 6 }}>🔄 差戻されました</div>
                                            {report.feedback && (
                                                <div style={{ fontSize: 12, color: "#d1d5db" }}>💬 {report.feedback}</div>
                                            )}
                                        </div>
                                    )}

                                    <div style={{ marginBottom: 16 }}>
                                        <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, marginBottom: 6, display: "block" }}>📝 報告書本文 *</label>
                                        <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} rows={6} placeholder="タスクの実施結果を記入してください..." style={{ width: "100%", padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f9fafb", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
                                    </div>

                                    <div style={{ marginBottom: 20 }}>
                                        <label style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, marginBottom: 6, display: "block" }}>📎 添付ファイル（任意）</label>
                                        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ width: "100%", padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f9fafb", fontSize: 13 }} />
                                        {file && <div style={{ fontSize: 11, color: "#818cf8", marginTop: 4 }}>選択中: {file.name}</div>}
                                    </div>

                                    {message && (
                                        <div style={{ padding: 12, borderRadius: 8, background: "rgba(99,102,241,0.15)", marginBottom: 16, fontSize: 13, color: "#a5b4fc" }}>{message}</div>
                                    )}

                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button onClick={handleCloseModal} style={{ flex: 1, padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", fontWeight: 600, cursor: "pointer" }}>キャンセル</button>
                                        <button onClick={handleSubmit} disabled={submitting} style={{ flex: 1, padding: 12, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", color: "#fff", fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}>
                                            {submitting ? "送信中..." : "📤 提出する"}
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </main>
    );
}