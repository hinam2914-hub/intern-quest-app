"use client";
// ES・ロードマップの記入状況と催促。催促は notifications に1通足すだけ（押すとES／ロードマップが開く）。
// 同じ催促が未読で残っている人には重ねて送らない。ES・ロードマップ・ポイントなどのデータは変更しない。
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { esStatus, roadmapStatus, DOC_LABEL, NUDGE, type DocStatus } from "../lib/careerDocs";

type Row = { id: string; name: string; dept: string; es: DocStatus; rm: DocStatus; esSent: string | null; rmSent: string | null; esUnread: boolean; rmUnread: boolean };
type Kind = "es" | "roadmap";
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) : "";

export default function CareerDocTab() {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"todo" | "es" | "roadmap" | "all">("todo");
    const [q, setQ] = useState("");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");
    const [confirm, setConfirm] = useState<{ kind: Kind; ids: string[] } | null>(null);

    const load = async () => {
        const [{ data: profs }, { data: depts }, { data: es }, { data: rm }, { data: ns }] = await Promise.all([
            supabase.from("profiles").select("id, name, department_id").eq("is_active", true).order("name"),
            supabase.from("departments").select("id, name"),
            supabase.from("user_es").select("*"),
            supabase.from("roadmaps").select("*"),
            supabase.from("notifications").select("user_id, title, is_read, created_at").in("title", [NUDGE.es.title, NUDGE.roadmap.title]).order("created_at", { ascending: false }).limit(2000),
        ]);
        const dn: Record<string, string> = {}; (depts || []).forEach((d: any) => { dn[d.id] = d.name; });
        const em: Record<string, any> = {}; (es || []).forEach((e: any) => { em[e.user_id] = e; });
        const rmm: Record<string, any> = {}; (rm || []).forEach((r: any) => { rmm[r.user_id] = r; });
        const last: Record<string, { at: string; unread: boolean }> = {};
        (ns || []).forEach((n: any) => {
            const k = n.user_id + "|" + n.title; const cur = last[k];
            if (!cur) last[k] = { at: n.created_at, unread: !n.is_read }; else if (!n.is_read) cur.unread = true;
        });
        setRows(((profs || []) as any[]).map((p) => {
            const e = last[p.id + "|" + NUDGE.es.title], r = last[p.id + "|" + NUDGE.roadmap.title];
            return { id: p.id, name: p.name || "名前未設定", dept: dn[p.department_id] || "", es: esStatus(em[p.id]), rm: roadmapStatus(rmm[p.id]), esSent: e?.at || null, rmSent: r?.at || null, esUnread: !!e?.unread, rmUnread: !!r?.unread };
        }));
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const stOf = (r: Row, k: Kind) => (k === "es" ? r.es : r.rm);
    const unreadOf = (r: Row, k: Kind) => (k === "es" ? r.esUnread : r.rmUnread);
    /** 送れる相手：完成していない人のうち、同じ催促が未読で残っていない人 */
    const sendable = (k: Kind, list: Row[]) => list.filter((r) => stOf(r, k).state !== "done" && !unreadOf(r, k));

    const send = async (k: Kind, ids: string[]) => {
        if (busy || ids.length === 0) return;
        setBusy(true); setMsg("");
        const targets = rows.filter((r) => ids.includes(r.id));
        const { error } = await supabase.from("notifications").insert(targets.map((r) => ({ user_id: r.id, type: "info", title: NUDGE[k].title, message: NUDGE[k].message(stOf(r, k)), link: NUDGE[k].link, icon: NUDGE[k].icon })));
        setMsg(error ? "通知を送れませんでした。もう一度お試しください" : `${k === "es" ? "ES" : "ロードマップ"}の催促を ${targets.length}人 に送りました`);
        setConfirm(null); setBusy(false);
        if (!error) await load();
    };

    const list = useMemo(() => rows.filter((r) => {
        if (q.trim() && !r.name.includes(q.trim()) && !r.dept.includes(q.trim())) return false;
        if (filter === "todo") return r.es.state !== "done" || r.rm.state !== "done";
        if (filter === "es") return r.es.state !== "done";
        if (filter === "roadmap") return r.rm.state !== "done";
        return true;
    }), [rows, q, filter]);

    const cnt = (k: Kind, s: string) => rows.filter((r) => stOf(r, k).state === s).length;
    const box: React.CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14, marginBottom: 12 };
    const chip = (s: DocStatus, pct?: boolean): React.CSSProperties => ({ display: "inline-block", fontSize: 11, fontWeight: 800, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap", background: s.state === "done" ? "rgba(52,211,153,.15)" : s.state === "partial" ? "rgba(251,191,36,.15)" : "rgba(248,113,113,.15)", color: s.state === "done" ? "#34d399" : s.state === "partial" ? "#fbbf24" : "#f87171" });
    const btn = (on: boolean): React.CSSProperties => ({ padding: "6px 12px", borderRadius: 999, border: "1px solid " + (on ? "#818cf8" : "rgba(255,255,255,.15)"), background: on ? "rgba(129,140,248,.2)" : "transparent", color: on ? "#c7d2fe" : "rgba(255,255,255,.6)", fontSize: 12, fontWeight: 700, cursor: "pointer" });
    const act = (dis: boolean): React.CSSProperties => ({ padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(129,140,248,.5)", background: dis ? "transparent" : "rgba(129,140,248,.18)", color: dis ? "rgba(255,255,255,.3)" : "#c7d2fe", fontSize: 11, fontWeight: 700, cursor: dis ? "default" : "pointer", whiteSpace: "nowrap" });

    if (loading) return <div style={{ color: "rgba(255,255,255,.5)", padding: 20 }}>読み込み中…</div>;
    return (
        <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 4 }}>ES・ロードマップの記入状況</h2>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginBottom: 12, lineHeight: 1.7 }}>在籍中の {rows.length}人 が対象です。催促を送ると本人の通知に届き、押すとES／ロードマップが開きます。同じ催促が未読のままの人には重ねて送りません。</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
                {(["es", "roadmap"] as Kind[]).map((k) => {
                    const ids = sendable(k, rows).map((r) => r.id);
                    return (
                        <div key={k} style={box}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 8 }}>{k === "es" ? "✍️ ES" : "🗺️ ロードマップ"}</div>
                            <div style={{ display: "flex", gap: 14, fontSize: 12, color: "rgba(255,255,255,.7)", marginBottom: 10, flexWrap: "wrap" }}>
                                <span>未記入 <b style={{ color: "#f87171", fontSize: 16 }}>{cnt(k, "none")}</b></span>
                                <span>途中 <b style={{ color: "#fbbf24", fontSize: 16 }}>{cnt(k, "partial")}</b></span>
                                <span>完成 <b style={{ color: "#34d399", fontSize: 16 }}>{cnt(k, "done")}</b></span>
                            </div>
                            <button disabled={busy || ids.length === 0} onClick={() => setConfirm({ kind: k, ids })} style={{ ...act(busy || ids.length === 0), padding: "8px 14px", fontSize: 12 }}>
                                {ids.length === 0 ? "送れる相手はいません" : `未記入・途中の ${ids.length}人 にまとめて催促`}
                            </button>
                        </div>
                    );
                })}
            </div>

            {confirm && (
                <div style={{ ...box, borderColor: "#818cf8", background: "rgba(129,140,248,.1)" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{confirm.kind === "es" ? "ES" : "ロードマップ"}の催促を {confirm.ids.length}人 に送ります。よろしいですか？</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", marginBottom: 10 }}>通知の文面：「{NUDGE[confirm.kind].title}」</div>
                    <button disabled={busy} onClick={() => send(confirm.kind, confirm.ids)} style={{ ...act(busy), padding: "8px 16px", fontSize: 12, marginRight: 8 }}>{busy ? "送信中…" : "送る"}</button>
                    <button disabled={busy} onClick={() => setConfirm(null)} style={{ ...btn(false), borderRadius: 8 }}>やめる</button>
                </div>
            )}
            {msg && <div role="status" style={{ ...box, color: "#c7d2fe", fontSize: 13, fontWeight: 700 }}>{msg}</div>}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                <button style={btn(filter === "todo")} onClick={() => setFilter("todo")}>どちらか未完成</button>
                <button style={btn(filter === "es")} onClick={() => setFilter("es")}>ES未完成</button>
                <button style={btn(filter === "roadmap")} onClick={() => setFilter("roadmap")}>ロードマップ未完成</button>
                <button style={btn(filter === "all")} onClick={() => setFilter("all")}>全員</button>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="名前・事業部で検索" style={{ marginLeft: "auto", minWidth: 160, padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.05)", color: "#fff", fontSize: 13 }} />
            </div>

            <div style={{ ...box, padding: 0, maxHeight: "62vh", overflowY: "auto", overscrollBehavior: "contain" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, color: "rgba(255,255,255,.85)" }}>
                    <thead>
                        <tr style={{ position: "sticky", top: 0, background: "#1b1f3a", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,.5)" }}>
                            <th style={{ padding: "10px 12px" }}>名前（{list.length}人）</th><th style={{ padding: "10px 8px" }}>ES</th><th style={{ padding: "10px 8px" }}>ロードマップ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {list.length === 0 && <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: "rgba(255,255,255,.4)" }}>該当する人はいません</td></tr>}
                        {list.map((r) => (
                            <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
                                <td style={{ padding: "9px 12px" }}><div style={{ fontWeight: 700 }}>{r.name}</div><div style={{ fontSize: 10.5, color: "rgba(255,255,255,.4)" }}>{r.dept}</div></td>
                                {(["es", "roadmap"] as Kind[]).map((k) => {
                                    const s = stOf(r, k); const sent = k === "es" ? r.esSent : r.rmSent; const unread = unreadOf(r, k);
                                    return (
                                        <td key={k} style={{ padding: "9px 8px", verticalAlign: "top" }}>
                                            <span style={chip(s)}>{DOC_LABEL[s.state]}{s.state === "partial" ? ` ${s.filled}/${s.total}` : ""}</span>
                                            {s.state !== "done" && (
                                                <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                                    <button disabled={busy || unread} onClick={() => send(k, [r.id])} style={act(busy || unread)}>{unread ? "催促ずみ（未読）" : "催促を送る"}</button>
                                                    {sent && <span style={{ fontSize: 10.5, color: "rgba(255,255,255,.4)" }}>前回 {day(sent)}</span>}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
