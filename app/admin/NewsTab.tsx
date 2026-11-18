"use client";
// 管理画面「お知らせ配信」：HOMEに出すお知らせの作成・編集・公開／非公開。
// 読み書きはすべて /api/announcements 経由（サーバー側で管理者かどうかを確認してから処理する）。
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { NEWS_CATEGORIES, categoryInfo, safeLink, type NewsCategory } from "../lib/news";

type Row = { id: string | number; title: string; content: string; category: string; publish_at: string | null; created_at: string; is_active: boolean; is_important: boolean; link_url: string | null };
type Form = { id: string | number | null; title: string; content: string; category: NewsCategory; publishLocal: string; is_active: boolean; is_important: boolean; link_url: string };

const pad = (n: number) => String(n).padStart(2, "0");
const toLocal = (iso?: string | null) => { const d = iso ? new Date(iso) : new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const blank = (): Form => ({ id: null, title: "", content: "", category: "update", publishLocal: toLocal(), is_active: true, is_important: false, link_url: "" });
const fmt = (iso?: string | null) => { if (!iso) return "-"; const d = new Date(iso); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

async function api(method: "GET" | "POST" | "PATCH", body?: any) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/announcements", { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "通信に失敗しました");
    return json;
}

export default function NewsTab() {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState<Form>(blank());
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const load = async () => {
        setLoading(true);
        try { const j = await api("GET"); setRows(j.items || []); } catch (e: any) { setMsg({ ok: false, text: e.message }); }
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const submit = async () => {
        if (busy) return;
        if (!form.title.trim() || !form.content.trim()) { setMsg({ ok: false, text: "タイトルと本文を入力してください" }); return; }
        if (form.link_url.trim() && !safeLink(form.link_url)) { setMsg({ ok: false, text: "遷移先は「/shop」のようなアプリ内のページだけ指定できます" }); return; }
        setBusy(true); setMsg(null);
        const payload = { title: form.title, content: form.content, category: form.category, publish_at: new Date(form.publishLocal).toISOString(), is_active: form.is_active, is_important: form.is_important, link_url: form.link_url };
        try {
            if (form.id === null) await api("POST", payload); else await api("PATCH", { id: form.id, ...payload });
            setMsg({ ok: true, text: form.id === null ? "投稿しました" : "更新しました" }); setForm(blank()); await load();
        } catch (e: any) { setMsg({ ok: false, text: e.message }); }
        setBusy(false);
    };
    const toggle = async (r: Row, key: "is_active" | "is_important") => {
        if (busy) return; setBusy(true); setMsg(null);
        try { await api("PATCH", { id: r.id, [key]: !r[key] }); await load(); } catch (e: any) { setMsg({ ok: false, text: e.message }); }
        setBusy(false);
    };
    const edit = (r: Row) => { setForm({ id: r.id, title: r.title, content: r.content, category: (categoryInfo(r.category).key), publishLocal: toLocal(r.publish_at || r.created_at), is_active: r.is_active, is_important: r.is_important, link_url: r.link_url || "" }); setMsg(null); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {} };

    const box: React.CSSProperties = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 };
    const label: React.CSSProperties = { fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600, display: "block" };
    const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.25)", color: "#f9fafb", fontSize: 14, fontFamily: "inherit" };
    const status = (r: Row) => !r.is_active ? { t: "非公開", c: "#9ca3af" } : new Date(r.publish_at || r.created_at).getTime() > Date.now() ? { t: "予約中", c: "#fbbf24" } : { t: "公開中", c: "#34d399" };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={box}>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>{form.id === null ? "NEW ANNOUNCEMENT｜新しいお知らせ" : "EDIT｜お知らせを編集"}</div>
                <div style={{ display: "grid", gap: 12 }}>
                    <div><span style={label}>タイトル（100文字まで）</span><input style={input} maxLength={100} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例：島バトルに新しい武器が登場！" /></div>
                    <div><span style={label}>本文</span><textarea style={{ ...input, minHeight: 130, resize: "vertical", lineHeight: 1.7 }} maxLength={4000} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="お知らせの内容を入力してください" /></div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                        <div><span style={label}>カテゴリ</span>
                            <select style={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as NewsCategory })}>
                                {NEWS_CATEGORIES.map((c) => <option key={c.key} value={c.key} style={{ color: "#111" }}>{c.label}</option>)}
                            </select></div>
                        <div><span style={label}>公開日時（未来にすると予約公開）</span><input style={input} type="datetime-local" value={form.publishLocal} onChange={(e) => setForm({ ...form, publishLocal: e.target.value })} /></div>
                        <div><span style={label}>遷移先（任意・アプリ内のページ）</span><input style={input} value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="例：/shop" /></div>
                    </div>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#e5e7eb", fontSize: 14, cursor: "pointer" }}><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} style={{ width: 18, height: 18 }} />公開する</label>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#e5e7eb", fontSize: 14, cursor: "pointer" }}><input type="checkbox" checked={form.is_important} onChange={(e) => setForm({ ...form, is_important: e.target.checked })} style={{ width: 18, height: 18 }} />重要表示（スマホのHOMEにも告知カードを出す）</label>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <button onClick={submit} disabled={busy} style={{ padding: "12px 26px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "送信中..." : form.id === null ? "📢 投稿する" : "更新する"}</button>
                        {form.id !== null && <button onClick={() => { setForm(blank()); setMsg(null); }} style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#d1d5db", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>編集をやめる</button>}
                        {msg && <span className="nt-msg" style={{ fontSize: 13, fontWeight: 700, color: msg.ok ? "#34d399" : "#f87171" }}>{msg.ok ? "✅ " : "⚠️ "}{msg.text}</span>}
                    </div>
                </div>
            </div>

            <div style={box}>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 14 }}>ANNOUNCEMENTS｜お知らせ一覧</div>
                {loading ? <div style={{ color: "#6b7280", fontSize: 14 }}>読み込み中...</div> : rows.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>お知らせはありません</div> : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {rows.map((r) => {
                            const st = status(r); const c = categoryInfo(r.category);
                            return (
                                <div key={String(r.id)} className="nt-row" style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${r.is_active ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.08)"}`, opacity: r.is_active ? 1 : 0.65 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                                        <span style={{ fontSize: 11, fontWeight: 800, color: st.c, border: `1px solid ${st.c}`, borderRadius: 999, padding: "1px 9px" }}>{st.t}</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: "#c7d2fe" }}>{c.label}</span>
                                        {r.is_important && <span style={{ fontSize: 11, fontWeight: 800, color: "#fca5a5" }}>★重要表示</span>}
                                        <span style={{ fontSize: 11, color: "#6b7280", marginLeft: "auto" }}>公開日時 {fmt(r.publish_at || r.created_at)}</span>
                                    </div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb", overflowWrap: "anywhere" }}>{r.title}</div>
                                    <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4, whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 60, overflow: "hidden" }}>{r.content}</div>
                                    {r.link_url && <div style={{ fontSize: 12, color: "#818cf8", marginTop: 4 }}>遷移先：{r.link_url}</div>}
                                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                                        <button onClick={() => edit(r)} style={btn}>✏️ 編集</button>
                                        <button onClick={() => toggle(r, "is_active")} disabled={busy} style={btn}>{r.is_active ? "非公開にする" : "公開する"}</button>
                                        <button onClick={() => toggle(r, "is_important")} disabled={busy} style={btn}>{r.is_important ? "重要表示をやめる" : "重要表示にする"}</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
const btn: React.CSSProperties = { padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)", color: "#e5e7eb", fontSize: 12.5, fontWeight: 700, cursor: "pointer" };
