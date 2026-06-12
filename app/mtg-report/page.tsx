"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}
function getJSTHour(): number {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.getUTCHours();
}
function isLateNight(endTime: string): boolean {
    const hour = parseInt(endTime.split(":")[0], 10);
    return !isNaN(hour) && hour >= 24;
}
function fmtDateTime(iso: string): string {
    const d = new Date(iso);
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()} ${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
}

interface Report {
    id: string; mtg_date: string; title: string | null; participants: string | null;
    start_time: string; end_time: string; content: string;
    status: string; admin_feedback: string | null; points_awarded: number;
    created_at: string; updated_at: string;
}

const fieldStyle = {
    width: "100%", padding: 14, borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
    color: "#f9fafb", fontSize: 14, lineHeight: 1.8, outline: "none",
    resize: "vertical" as const, boxSizing: "border-box" as const, fontFamily: "inherit", minHeight: 80,
};
const inputStyle = { ...fieldStyle, minHeight: 0, padding: "10px 12px" };
const labelStyle = { fontSize: 13, fontWeight: 700, color: "#a5b4fc", display: "block" as const, marginBottom: 6, marginTop: 16 };

const STATUS_LABEL: Record<string, { text: string; color: string; bg: string }> = {
    draft: { text: "📝 下書き", color: "#9ca3af", bg: "rgba(156,163,175,0.15)" },
    pending: { text: "🟡 申請中", color: "#fbbf24", bg: "rgba(251,191,36,0.15)" },
    rejected: { text: "🔴 差し戻し", color: "#f87171", bg: "rgba(248,113,113,0.15)" },
    approved: { text: "🟢 承認済み", color: "#34d399", bg: "rgba(52,211,153,0.15)" },
};

export default function MtgReportPage() {
    const router = useRouter();
    const [userId, setUserId] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [reports, setReports] = useState<Report[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [mtgDate, setMtgDate] = useState(getTodayJST());
    const [title, setTitle] = useState("");
    const [participants, setParticipants] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [purpose, setPurpose] = useState("");
    const [discussion, setDiscussion] = useState("");
    const [decision, setDecision] = useState("");
    const [nextAction, setNextAction] = useState("");

    const loadReports = useCallback(async (uid: string) => {
        const { data } = await supabase.from("mtg_reports").select("*").eq("user_id", uid).order("updated_at", { ascending: false });
        setReports((data || []) as Report[]);
    }, []);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            await loadReports(user.id);
            setLoading(false);
        })();
    }, [router, loadReports]);

    const resetForm = () => {
        setEditingId(null); setMtgDate(getTodayJST()); setTitle(""); setParticipants("");
        setStartTime(""); setEndTime(""); setPurpose(""); setDiscussion(""); setDecision(""); setNextAction("");
        setMessage("");
    };

    const loadIntoForm = (r: Report) => {
        setEditingId(r.id);
        setMtgDate(r.mtg_date);
        setTitle(r.title || "");
        setParticipants(r.participants || "");
        setStartTime(r.start_time);
        setEndTime(r.end_time);
        const parts = r.content.split(/【[^】]+】\n/).map((s) => s.trim()).filter((_, i) => i > 0);
        setPurpose(parts[0]?.replace(/\n\n$/, "") || "");
        setDiscussion(parts[1]?.replace(/\n\n$/, "") || "");
        setDecision(parts[2]?.replace(/\n\n$/, "") || "");
        setNextAction(parts[3] || "");
        setMessage("");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const buildContent = () =>
        `【目的・議題】\n${purpose.trim()}\n\n【議論した内容】\n${discussion.trim()}\n\n【決定事項（着地点）】\n${decision.trim()}\n\n【ネクストアクション】\n${nextAction.trim()}`;

    const validate = (forDraft: boolean): string | null => {
        if (!mtgDate) return "MTG実施日を入力してください";
        if (forDraft) return null;
        if (!participants.trim()) return "参加者を入力してください";
        if (!startTime.trim() || !endTime.trim()) return "開始時刻と終了時刻を入力してください";
        const len = purpose.trim().length + discussion.trim().length + decision.trim().length + nextAction.trim().length;
        if (len < 100) return `報告内容は合計100文字以上で書いてください（現在${len}文字）`;
        return null;
    };

    const save = async (status: "draft" | "pending") => {
        const err = validate(status === "draft");
        if (err) { setMessage(err); return; }
        if (status === "pending") {
            const h = getJSTHour();
            if (h >= 0 && h < 5) { setMessage("深夜0時〜朝5時の間は提出できません。下書き保存して、朝以降に提出してください。"); return; }
        }
        setSubmitting(true);
        setMessage("");
        const payload = {
            user_id: userId, mtg_date: mtgDate, title: title.trim() || null, participants: participants.trim(),
            start_time: startTime.trim(), end_time: endTime.trim(),
            content: buildContent(), status, admin_feedback: null,
            updated_at: new Date().toISOString(),
        };
        let error;
        if (editingId) {
            ({ error } = await supabase.from("mtg_reports").update(payload).eq("id", editingId));
        } else {
            ({ error } = await supabase.from("mtg_reports").insert(payload));
        }
        if (error) { setMessage("保存に失敗しました: " + error.message); setSubmitting(false); return; }
        await loadReports(userId);
        resetForm();
        setSubmitting(false);
    };

    if (loading) {
        return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f1a", color: "#9ca3af" }}>読み込み中...</div>;
    }

    const lateWarning = isLateNight(endTime);
    const bodyLen = purpose.trim().length + discussion.trim().length + decision.trim().length + nextAction.trim().length;
    const h = getJSTHour();
    const nightBlock = h >= 0 && h < 5;

    return (
        <div style={{ minHeight: "100vh", background: "#0f0f1a", padding: "32px 20px", color: "#f9fafb" }}>
            <div style={{ maxWidth: 600, margin: "0 auto" }}>
                <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", marginBottom: 20 }}>INTERN QUEST</div>

                <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>📋 MTG報告書（議事録）</h1>
                <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>{editingId ? "差し戻された報告書を修正しています。" : "MTGの議事録をまとめて提出します。着地していない場合はFB付きで差し戻されます。"}</p>

                {nightBlock && (
                    <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, color: "#f87171", fontWeight: 600 }}>🌙 深夜0時〜朝5時は提出できません。下書き保存して朝以降に提出してください。</span>
                    </div>
                )}

                <label style={labelStyle}>タイトル</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：採用戦略MTG" style={inputStyle} />
                <label style={labelStyle}>MTG実施日</label>
                <input type="date" value={mtgDate} onChange={(e) => setMtgDate(e.target.value)} style={inputStyle} />

                <label style={labelStyle}>参加者</label>
                <input value={participants} onChange={(e) => setParticipants(e.target.value)} placeholder="例：田中、佐藤、鈴木" style={inputStyle} />

                <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle}>開始時刻</label>
                        <input value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="例：21:00" style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle}>終了時刻</label>
                        <input value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="例：22:30（深夜は25:00等）" style={{ ...inputStyle, border: `1px solid ${lateWarning ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.1)"}` }} />
                    </div>
                </div>

                {lateWarning && (
                    <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", marginTop: 12 }}>
                        <span style={{ fontSize: 13, color: "#f87171", fontWeight: 600 }}>⚠️ 終了が24時を超えています。深夜の長時間MTGは翌日のパフォーマンスに影響します。</span>
                    </div>
                )}

                <label style={labelStyle}>① 目的・議題</label>
                <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="何のためのMTGだったか" style={fieldStyle} />
                <label style={labelStyle}>② 議論した内容</label>
                <textarea value={discussion} onChange={(e) => setDiscussion(e.target.value)} placeholder="どんな議論をしたか" style={fieldStyle} />
                <label style={labelStyle}>③ 決定事項（着地点）</label>
                <textarea value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="結局どう決まったか。空欄・曖昧だと差し戻されます" style={fieldStyle} />
                <label style={labelStyle}>④ ネクストアクション</label>
                <textarea value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="誰が・何を・いつまでに" style={fieldStyle} />

                <div style={{ fontSize: 12, color: bodyLen >= 100 ? "#34d399" : "#6b7280", marginTop: 8, marginBottom: 16 }}>①〜④合計 {bodyLen} 文字（100文字以上）</div>

                {message && <div style={{ fontSize: 13, color: "#f87171", marginBottom: 12 }}>{message}</div>}

                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => save("draft")} disabled={submitting} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#e5e7eb", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", fontSize: 14 }}>下書き保存</button>
                    <button onClick={() => save("pending")} disabled={submitting || nightBlock} style={{ flex: 2, padding: "14px", borderRadius: 12, border: "none", background: (submitting || nightBlock) ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: (submitting || nightBlock) ? "not-allowed" : "pointer", fontSize: 15 }}>{nightBlock ? "深夜は提出不可" : editingId ? "修正して再提出" : "報告書を提出する"}</button>
                </div>
                {editingId && <button onClick={resetForm} style={{ width: "100%", marginTop: 8, padding: "10px", borderRadius: 10, border: "none", background: "transparent", color: "#9ca3af", cursor: "pointer", fontSize: 13 }}>修正をやめて新規作成に戻る</button>}

                {/* 提出履歴 */}
                <h2 style={{ fontSize: 16, fontWeight: 800, marginTop: 40, marginBottom: 12 }}>提出履歴</h2>
                {reports.length === 0 ? (
                    <div style={{ padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.03)", color: "#6b7280", fontSize: 14, textAlign: "center" }}>まだ報告書がありません。</div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {reports.map((r) => {
                            const st = STATUS_LABEL[r.status] || STATUS_LABEL.pending;
                            const isOpen = expandedId === r.id;
                            return (
                                <div key={r.id} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div onClick={() => setExpandedId(isOpen ? null : r.id)} style={{ cursor: "pointer" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: 14, fontWeight: 700 }}>{isOpen ? "▼" : "▶"} {r.mtg_date} のMTG</span>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, padding: "3px 10px", borderRadius: 6 }}>{st.text}</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{r.start_time}〜{r.end_time} ／ 提出: {fmtDateTime(r.created_at)}{r.points_awarded > 0 && ` ／ +${r.points_awarded}pt`}</div>
                                    </div>

                                    {isOpen && (
                                        <div style={{ marginTop: 10 }}>
                                            {isLateNight(r.end_time) && (
                                                <div style={{ marginBottom: 8, fontSize: 12, color: "#f87171", fontWeight: 700 }}>⚠️ 終了が24時超え（深夜の長時間MTG）</div>
                                            )}
                                            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>参加者: {r.participants || "未記入"}</div>
                                            <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(0,0,0,0.25)", fontSize: 13, color: "#d1d5db", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{r.content}</div>
                                        </div>
                                    )}

                                    {r.status === "rejected" && r.admin_feedback && (
                                        <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)" }}>
                                            <div style={{ fontSize: 11, color: "#f87171", fontWeight: 700, marginBottom: 4 }}>管理者からのフィードバック</div>
                                            <div style={{ fontSize: 13, color: "#fca5a5", whiteSpace: "pre-wrap" }}>{r.admin_feedback}</div>
                                        </div>
                                    )}
                                    {(r.status === "rejected" || r.status === "draft") && (
                                        <button onClick={() => loadIntoForm(r)} style={{ marginTop: 10, padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{r.status === "draft" ? "下書きの続きを書く" : "修正する"}</button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <div style={{ marginTop: 40, textAlign: "center" }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>☰ メニューに戻る</button>
                </div>
            </div>
        </div>
    );
}
