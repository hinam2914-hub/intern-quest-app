"use client";
// 思考クエスト・大喜利のお題管理。思考の試練（6種別）とルクのヒントに対応。
// 種別・ヒント列は thinking_quest_v2.sql 適用後に保存できる（未適用でも従来どおり動く）。
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { THINK_CATS } from "../lib/thinking2";

interface Q { id: string; content: string; type: string; is_active: boolean; created_at: string; category?: string | null; hint?: string | null; last_shown_date?: string | null; }

const CAT_LABEL: Record<string, string> = Object.fromEntries(THINK_CATS.map(c => [c.key, `${c.emoji} ${c.quest}（${c.skill}）`]));

export default function ThinkingAdminTab() {
    const [questions, setQuestions] = useState<Q[]>([]);
    const [content, setContent] = useState("");
    const [type, setType] = useState<"thinking" | "oogiri">("thinking");
    const [category, setCategory] = useState<string>("idea");
    const [hint, setHint] = useState("");
    const [saving, setSaving] = useState(false);
    const [filter, setFilter] = useState<string>("all");

    const load = useCallback(async () => {
        const { data } = await supabase.from("thinking_questions").select("*").order("created_at", { ascending: false });
        setQuestions((data || []) as Q[]);
    }, []);
    useEffect(() => { load(); }, [load]);

    const add = async () => {
        if (!content.trim() || saving) return;
        setSaving(true);
        const base: any = { content: content.trim(), type };
        if (type === "thinking") { base.category = category; if (hint.trim()) base.hint = hint.trim(); }
        let { error } = await supabase.from("thinking_questions").insert(base);
        if (error && /category|hint/.test(error.message)) {
            // SQL 未適用の環境：従来の列だけで登録
            ({ error } = await supabase.from("thinking_questions").insert({ content: content.trim(), type }));
            if (!error) alert("登録しました（※種別・ヒント列が未追加のため保存されていません。thinking_quest_v2.sql を実行してください）");
        }
        if (error) alert("登録失敗: " + error.message);
        setContent(""); setHint("");
        await load();
        setSaving(false);
    };
    const toggleActive = async (q: Q) => {
        await supabase.from("thinking_questions").update({ is_active: !q.is_active }).eq("id", q.id);
        await load();
    };
    const setCat = async (q: Q, cat: string) => {
        const { error } = await supabase.from("thinking_questions").update({ category: cat || null }).eq("id", q.id);
        if (error) alert("種別の保存に失敗（thinking_quest_v2.sql 未実行の可能性）: " + error.message);
        await load();
    };
    const editHint = async (q: Q) => {
        const v = prompt("ルクのヒント（空で削除）", q.hint || "");
        if (v === null) return;
        const { error } = await supabase.from("thinking_questions").update({ hint: v.trim() || null }).eq("id", q.id);
        if (error) alert("ヒントの保存に失敗（thinking_quest_v2.sql 未実行の可能性）: " + error.message);
        await load();
    };
    const remove = async (id: string) => {
        if (!confirm("このお題を削除しますか？回答も一緒に消えます。")) return;
        await supabase.from("thinking_questions").delete().eq("id", id);
        await load();
    };

    const label = (t: string) => t === "oogiri" ? "🎤 大喜利" : "🧠 思考";
    const shown = questions.filter(q => filter === "all" ? true : filter === "oogiri" ? q.type === "oogiri" : (q.type === "thinking" && (q.category || "idea") === filter));

    return (
        <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f9fafb", marginBottom: 16 }}>🧠 思考の試練・大喜利 お題管理</h2>
            <div style={{ padding: 20, borderRadius: 12, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", marginBottom: 24 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                    {(["thinking", "oogiri"] as const).map(t => (
                        <button key={t} onClick={() => setType(t)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: type === t ? (t === "oogiri" ? "#f5c542" : "#6366f1") : "rgba(255,255,255,0.05)", color: type === t ? (t === "oogiri" ? "#1a1206" : "#fff") : "#9ca3af" }}>{label(t)}</button>
                    ))}
                    {type === "thinking" && (
                        <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "#15132b", color: "#e5e7eb", fontSize: 13, fontWeight: 700 }}>
                            {THINK_CATS.map(c => <option key={c.key} value={c.key}>{CAT_LABEL[c.key]}</option>)}
                        </select>
                    )}
                </div>
                <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="お題を入力..." rows={2} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(0,0,0,0.2)", color: "#f9fafb", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }} />
                {type === "thinking" && (
                    <input value={hint} onChange={e => setHint(e.target.value)} placeholder="ルクのヒント（任意。未入力なら種別ごとの共通ヒント）" style={{ width: "100%", marginTop: 8, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(0,0,0,0.2)", color: "#f9fafb", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" }} />
                )}
                <button onClick={add} disabled={saving || !content.trim()} style={{ marginTop: 10, padding: "10px 24px", borderRadius: 8, border: "none", background: saving || !content.trim() ? "rgba(99,102,241,0.4)" : "#6366f1", color: "#fff", fontWeight: 700, cursor: saving || !content.trim() ? "not-allowed" : "pointer", fontSize: 14 }}>{saving ? "追加中..." : "お題を追加"}</button>
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                {[["all", "すべて"], ...THINK_CATS.map(c => [c.key, c.emoji + c.quest]), ["oogiri", "🎤 大喜利"]].map(([k, l]) => (
                    <button key={k} onClick={() => setFilter(k)} style={{ padding: "5px 12px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: filter === k ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.06)", color: filter === k ? "#e5e0ff" : "#9ca3af" }}>{l}</button>
                ))}
            </div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>登録済みお題（{shown.length}）。思考の試練は曜日の種別に合わせて1日1問が自動出題されます（月:ひらめき 火:なぜなぜ 水:決断 木:逆転 金:説得 土:視点 日:大喜利）。</div>
            {shown.map(q => (
                <div key={q.id} style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: q.type === "oogiri" ? "#f5c542" : "#818cf8", marginRight: 8 }}>{label(q.type)}</span>
                            {q.type === "thinking" && <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399", marginRight: 8 }}>{CAT_LABEL[q.category || "idea"] || "（未分類→ひらめき扱い）"}</span>}
                            <span style={{ fontSize: 14, color: "#e5e7eb" }}>{q.content}</span>
                            {q.type === "thinking" && q.hint && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>🦊 {q.hint}</div>}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            {q.type === "thinking" && (
                                <select value={q.category || ""} onChange={e => setCat(q, e.target.value)} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "#15132b", color: "#c7c7de", fontSize: 11, fontWeight: 700 }}>
                                    <option value="">未分類</option>
                                    {THINK_CATS.map(c => <option key={c.key} value={c.key}>{c.quest}</option>)}
                                </select>
                            )}
                            {q.type === "thinking" && <button onClick={() => editHint(q)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>ヒント</button>}
                            <button onClick={() => toggleActive(q)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: q.is_active ? "rgba(52,211,153,0.2)" : "rgba(120,120,120,0.2)", color: q.is_active ? "#34d399" : "#9ca3af" }}>{q.is_active ? "出題中" : "停止中"}</button>
                            <button onClick={() => remove(q.id)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: "rgba(248,113,113,0.15)", color: "#f87171" }}>削除</button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
