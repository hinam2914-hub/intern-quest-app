"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

interface Q { id: string; user_id: string; content: string; admin_answer: string | null; status: string; created_at: string; name: string; }

export default function QuestionsAdminTab() {
    const [questions, setQuestions] = useState<Q[]>([]);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState<string | null>(null);

    const load = useCallback(async () => {
        const { data: qRows } = await supabase.from("questions_box").select("*").order("created_at", { ascending: false }).limit(300);
        const rows = (qRows || []) as any[];
        const ids = Array.from(new Set(rows.map(r => r.user_id)));
        const nameMap: Record<string, string> = {};
        if (ids.length > 0) {
            const { data: profs } = await supabase.from("profiles").select("id, name").in("id", ids);
            (profs || []).forEach((p: any) => { nameMap[p.id] = p.name || "名前未設定"; });
        }
        const withName = rows.map(r => ({ ...r, name: nameMap[r.user_id] || "名前未設定" }));
        // 未回答を上に
        const rank = (q: any) => q.status === "pending" ? 0 : (!q.admin_answer ? 1 : 2);
        withName.sort((a, b) => rank(a) - rank(b) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setQuestions(withName);
    }, []);
    useEffect(() => { load(); }, [load]);

    const saveAnswer = async (q: Q) => {
        const text = (drafts[q.id] ?? q.admin_answer ?? "").trim();
        if (!text || saving) return;
        setSaving(q.id);
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("questions_box").update({ admin_answer: text, answered_by: user?.id || null, answered_at: new Date().toISOString() }).eq("id", q.id);
        await load();
        setSaving(null);
    };

    const setStatus = async (id: string, status: string) => {
        await supabase.from("questions_box").update({ status }).eq("id", id);
        await load();
    };

    const unanswered = questions.filter(q => !q.admin_answer).length;
    const pendingCount = questions.filter(q => q.status === "pending").length;

    return (
        <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f9fafb", marginBottom: 8 }}>❓ 質問クエスト 回答</h2>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>⏳ 承認待ち {pendingCount} 件 / 未回答 {unanswered} 件 / 全 {questions.length} 件</div>
            {questions.map(q => (
                <div key={q.id} style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${q.admin_answer ? "rgba(52,211,153,0.2)" : "rgba(251,191,36,0.3)"}`, marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#818cf8" }}>{q.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: q.status === "pending" ? "#fbbf24" : q.status === "rejected" ? "#f87171" : "#34d399" }}>{q.status === "pending" ? "⏳ 承認待ち" : q.status === "rejected" ? "🚫 却下" : (q.admin_answer ? "✅ 公開・回答済み" : "📢 公開・未回答")}</span>
                    </div>
                    <div style={{ fontSize: 14, color: "#f3f4f6", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 12 }}>{q.content}</div>
                    {q.status === "pending" && (
                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                            <button onClick={() => setStatus(q.id, "approved")} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>✅ 承認して公開</button>
                            <button onClick={() => setStatus(q.id, "rejected")} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "rgba(248,113,113,0.15)", color: "#f87171", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>🚫 却下</button>
                        </div>
                    )}
                    <textarea value={drafts[q.id] ?? q.admin_answer ?? ""} onChange={e => setDrafts(p => ({ ...p, [q.id]: e.target.value }))} placeholder="回答を入力（公開されます）..." rows={2} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid rgba(52,211,153,0.3)", background: "rgba(0,0,0,0.2)", color: "#f9fafb", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }} />
                    <button onClick={() => saveAnswer(q)} disabled={saving === q.id} style={{ marginTop: 8, padding: "8px 20px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>{saving === q.id ? "保存中..." : q.admin_answer ? "回答を更新" : "回答する"}</button>
                </div>
            ))}
        </div>
    );
}
