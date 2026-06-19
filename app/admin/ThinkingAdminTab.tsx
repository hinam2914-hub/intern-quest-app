"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

interface Q { id: string; content: string; type: string; is_active: boolean; created_at: string; }

export default function ThinkingAdminTab() {
    const [questions, setQuestions] = useState<Q[]>([]);
    const [content, setContent] = useState("");
    const [type, setType] = useState<"thinking" | "oogiri">("thinking");
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        const { data } = await supabase.from("thinking_questions").select("*").order("created_at", { ascending: false });
        setQuestions((data || []) as Q[]);
    }, []);
    useEffect(() => { load(); }, [load]);

    const add = async () => {
        if (!content.trim() || saving) return;
        setSaving(true);
        await supabase.from("thinking_questions").insert({ content: content.trim(), type });
        setContent("");
        await load();
        setSaving(false);
    };
    const toggleActive = async (q: Q) => {
        await supabase.from("thinking_questions").update({ is_active: !q.is_active }).eq("id", q.id);
        await load();
    };
    const remove = async (id: string) => {
        if (!confirm("このお題を削除しますか？回答も一緒に消えます。")) return;
        await supabase.from("thinking_questions").delete().eq("id", id);
        await load();
    };

    const label = (t: string) => t === "oogiri" ? "🎤 大喜利" : "🧠 思考";

    return (
        <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f9fafb", marginBottom: 16 }}>🧠 思考クエスト・大喜利 お題管理</h2>
            <div style={{ padding: 20, borderRadius: 12, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", marginBottom: 24 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    {(["thinking", "oogiri"] as const).map(t => (
                        <button key={t} onClick={() => setType(t)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: type === t ? (t === "oogiri" ? "#f5c542" : "#6366f1") : "rgba(255,255,255,0.05)", color: type === t ? (t === "oogiri" ? "#1a1206" : "#fff") : "#9ca3af" }}>{label(t)}</button>
                    ))}
                </div>
                <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="お題を入力..." rows={2} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(0,0,0,0.2)", color: "#f9fafb", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }} />
                <button onClick={add} disabled={saving || !content.trim()} style={{ marginTop: 10, padding: "10px 24px", borderRadius: 8, border: "none", background: saving || !content.trim() ? "rgba(99,102,241,0.4)" : "#6366f1", color: "#fff", fontWeight: 700, cursor: saving || !content.trim() ? "not-allowed" : "pointer", fontSize: 14 }}>{saving ? "追加中..." : "お題を追加"}</button>
            </div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>登録済みお題（{questions.length}）。各タイプで最新の「出題中」が1問ずつ表示されます。</div>
            {questions.map(q => (
                <div key={q.id} style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: q.type === "oogiri" ? "#f5c542" : "#818cf8", marginRight: 8 }}>{label(q.type)}</span>
                        <span style={{ fontSize: 14, color: "#e5e7eb" }}>{q.content}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button onClick={() => toggleActive(q)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: q.is_active ? "rgba(52,211,153,0.2)" : "rgba(120,120,120,0.2)", color: q.is_active ? "#34d399" : "#9ca3af" }}>{q.is_active ? "出題中" : "停止中"}</button>
                        <button onClick={() => remove(q.id)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: "rgba(248,113,113,0.15)", color: "#f87171" }}>削除</button>
                    </div>
                </div>
            ))}
        </div>
    );
}
