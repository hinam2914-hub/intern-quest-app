"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Req = { id: string; user_id: string; submission_id: string | null; thinking_session_id: string | null; target: string; focus: string | null; status: string; fb_good: string | null; fb_think: string | null; fb_next: string | null; issue_quest: boolean; quest_claimed_at: string | null; created_at: string; responded_at: string | null; responder_id?: string | null; responderName?: string; assignee_id?: string | null; assigneeName?: string; name?: string; content?: string; turns?: any[] };

const TARGET_LABEL: Record<string, string> = { mentor: "指名", leader: "指名", any: "おまかせ" };

function ago(iso: string) {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 60) return `${m}分前`; const h = Math.floor(m / 60); if (h < 24) return `${h}時間前`; return `${Math.floor(h / 24)}日前`;
}

export default function FbRequestTab() {
    const [reqs, setReqs] = useState<Req[]>([]);
    const [filter, setFilter] = useState<"all" | "pending" | "done">("pending");
    const [showReport, setShowReport] = useState<string | null>(null);
    const [showAi, setShowAi] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [note, setNote] = useState<Record<string, string>>({});
    const [q, setQ] = useState("");
    const [meId, setMeId] = useState("");
    const [mineOnly, setMineOnly] = useState(false);
    const [showAssign, setShowAssign] = useState(false);
    const [people, setPeople] = useState<{ id: string; name: string; mentor_id: string | null; leader_id: string | null; department_id: string | null }[]>([]);
    const [assignQ, setAssignQ] = useState("");

    const load = async () => {
        const { data } = await supabase.from("fb_requests").select("*").order("created_at", { ascending: false }).limit(200);
        const rows = (data || []) as Req[];
        const uids = [...new Set(rows.map(r => r.user_id))];
        const sids = rows.map(r => r.submission_id).filter(Boolean) as string[];
        const tsids = rows.map(r => r.thinking_session_id).filter(Boolean) as string[];
        const [{ data: profs }, { data: subs }, { data: sess }] = await Promise.all([
            uids.length ? supabase.from("profiles").select("id, name").in("id", uids) : Promise.resolve({ data: [] as any[] }),
            sids.length ? supabase.from("submissions").select("id, content").in("id", sids) : Promise.resolve({ data: [] as any[] }),
            tsids.length ? supabase.from("thinking_sessions").select("id, turns").in("id", tsids) : Promise.resolve({ data: [] as any[] }),
        ]);
        const aids = [...new Set([...rows.map(r => r.assignee_id), ...rows.map(r => r.responder_id)].filter(Boolean))] as string[];
        const { data: aprofs } = aids.length ? await supabase.from("profiles").select("id, name").in("id", aids) : { data: [] as any[] };
        const am = new Map((aprofs || []).map((p: any) => [p.id, p.name]));
        const pm = new Map((profs || []).map((p: any) => [p.id, p.name]));
        const sm = new Map((subs || []).map((s: any) => [s.id, s.content]));
        const tm = new Map((sess || []).map((s: any) => [s.id, s.turns]));
        setReqs(rows.map(r => ({ ...r, name: pm.get(r.user_id) || "名前未設定", assigneeName: r.assignee_id ? (am.get(r.assignee_id) || "") : "", responderName: r.responder_id ? (am.get(r.responder_id) || "") : "", content: r.submission_id ? sm.get(r.submission_id) : undefined, turns: r.thinking_session_id ? tm.get(r.thinking_session_id) : undefined })));
    };
    useEffect(() => {
        load();
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setMeId(user.id);
            const { data } = await supabase.from("profiles").select("id, name, mentor_id, leader_id, department_id").eq("is_active", true).order("name");
            setPeople((data || []) as any);
        })();
    }, []);
    const setAssign = async (uid: string, field: "mentor_id" | "leader_id", val: string) => {
        await supabase.from("profiles").update({ [field]: val || null }).eq("id", uid);
        setPeople(prev => prev.map(p => p.id === uid ? { ...p, [field]: val || null } : p));
    };

    // 未対応のリクエストを、担当者にもう一度知らせる（FBを書くのは担当者。管理画面では書かない）
    //  指名あり → その人に通知／おまかせ → FBメンター全員に通知。通知を押すと「届いたFBリクエスト」の入力欄が開く
    const remind = async (r: Req) => {
        if (busy) return;
        setBusy(r.id);
        let ids: string[] = [];
        if (r.assignee_id) ids = [r.assignee_id];
        else { const { data } = await supabase.from("profiles").select("id").eq("fb_mentor", true).eq("is_active", true); ids = ((data || []) as any[]).map(x => x.id); }
        ids = ids.filter(id => id !== r.user_id);
        if (ids.length === 0) { setNote(n => ({ ...n, [r.id]: "知らせる相手がいません（FBメンターが設定されていません）" })); setBusy(null); return; }
        const msg = `${r.name}さんから日報のFBをお願いされています。${r.focus ? "「" + r.focus.slice(0, 60) + "」" : ""}`;
        const { error } = await supabase.from("notifications").insert(ids.map(id => ({ user_id: id, type: "fb", title: "FBリクエストが届いています（未対応）", message: msg, link: "/fb/inbox?r=" + r.id, icon: "💌" })));
        setNote(n => ({ ...n, [r.id]: error ? "通知を送れませんでした。もう一度お試しください" : `${r.assignee_id ? (r.assigneeName || "担当者") + "さん" : "FBメンター" + ids.length + "人"}に通知を送りました` }));
        setBusy(null);
    };

    const list = reqs.filter(r => (filter === "all" ? true : r.status === filter) && (!mineOnly || r.assignee_id === meId || (r.target === "any" && !r.assignee_id)) && (!q.trim() || (r.name || "").includes(q.trim()) || (r.assigneeName || "").includes(q.trim()) || (r.responderName || "").includes(q.trim())));
    const day = (iso: string) => new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" });
    const pendingN = reqs.filter(r => r.status === "pending").length;
    const box: React.CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14, marginBottom: 12 };
    const btn = (active: boolean): React.CSSProperties => ({ padding: "6px 14px", borderRadius: 8, border: active ? "1.5px solid #a78bfa" : "1px solid rgba(255,255,255,0.1)", background: active ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.05)", color: active ? "#c4b5fd" : "#9ca3af", fontWeight: 800, fontSize: 12, cursor: "pointer" });

    return (
        <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 4 }}>💌 FBリクエスト</div>
            <div style={{ fontSize: 12, color: "#8b8fa8", marginBottom: 14 }}>本人が「FBがほしい」と送ってきたものの履歴です。FBを書くのは指名されたメンターで、メンターには通知が届き「届いたFBリクエスト」から GOOD / THINK / NEXT QUEST を返します。ここでは状況と返したFBを確認できます</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                <button style={btn(filter === "pending")} onClick={() => setFilter("pending")}>未対応 {pendingN}</button>
                <button style={btn(filter === "done")} onClick={() => setFilter("done")}>対応済み {reqs.length - pendingN}</button>
                <button style={btn(filter === "all")} onClick={() => setFilter("all")}>すべて</button>
                <button style={btn(mineOnly)} onClick={() => setMineOnly(!mineOnly)}>自分宛て</button>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="名前で探す" aria-label="名前で探す" style={{ flex: "1 1 140px", minWidth: 0, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 12.5 }} />
                <button style={btn(showAssign)} onClick={() => setShowAssign(!showAssign)}>👥 担当設定</button>
            </div>
            {showAssign && (
                <div style={{ ...box, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", marginBottom: 6 }}>担当メンター／チームリーダーの設定</div>
                    <div style={{ fontSize: 11.5, color: "#8b8fa8", marginBottom: 10 }}>本人が「担当メンター」「チームリーダー」を選んでFBを頼んだとき、ここで設定した人に届く。未設定なら「おまかせ」扱い</div>
                    <input value={assignQ} onChange={e => setAssignQ(e.target.value)} placeholder="名前で絞り込み" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 13, boxSizing: "border-box", marginBottom: 10 }} />
                    <div style={{ maxHeight: 360, overflowY: "auto" }}>
                        {people.filter(p => !assignQ || (p.name || "").includes(assignQ)).map(p => (
                            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <div style={{ fontSize: 13, color: "#e5e7eb", fontWeight: 700 }}>{p.name || "名前未設定"}</div>
                                <select value={p.mentor_id || ""} onChange={e => setAssign(p.id, "mentor_id", e.target.value)} style={{ padding: "6px 8px", borderRadius: 8, background: "#141428", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", fontSize: 12 }}>
                                    <option value="">メンター未設定</option>
                                    {people.filter(m => m.id !== p.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                                <select value={p.leader_id || ""} onChange={e => setAssign(p.id, "leader_id", e.target.value)} style={{ padding: "6px 8px", borderRadius: 8, background: "#141428", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", fontSize: 12 }}>
                                    <option value="">リーダー未設定</option>
                                    {people.filter(m => m.id !== p.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {list.length === 0 && <div style={{ color: "#6b7280", fontSize: 13, padding: 20, textAlign: "center" }}>リクエストはありません</div>}
            {list.map(r => (
                <div key={r.id} style={box}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div>
                            <span style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>{r.name}</span>
                            <span style={{ fontSize: 11, color: "#8b8fa8", marginLeft: 8 }}>{TARGET_LABEL[r.target] || r.target}{r.assigneeName ? `：${r.assigneeName}` : ""}</span>
                            {r.thinking_session_id && <span style={{ fontSize: 10, marginLeft: 8, padding: "2px 6px", borderRadius: 6, background: "rgba(139,92,246,0.2)", color: "#c4b5fd" }}>AIで深掘り済み</span>}
                        </div>
                        <div style={{ fontSize: 11, color: r.status === "pending" ? "#f87171" : "#34d399", fontWeight: 800 }}>{r.status === "pending" ? "未対応" : r.quest_claimed_at ? "クエスト受領済み" : r.issue_quest ? "クエスト未受領" : "対応済"}　<span style={{ color: "#6b7280", fontWeight: 500 }}>{ago(r.created_at)}</span></div>
                    </div>
                    <div style={{ fontSize: 11.5, color: "#8b8fa8", marginTop: 4 }}>依頼日 {day(r.created_at)}{r.status !== "pending" && r.responded_at ? `　／　返信 ${day(r.responded_at)}${r.responderName ? "（" + r.responderName + "さん）" : ""}` : ""}</div>
                    {r.focus && <div style={{ fontSize: 13, color: "#e5e7eb", marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(139,92,246,0.1)" }}>「{r.focus}」</div>}
                    {r.status !== "pending" && (
                        <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(52,211,153,0.25)", display: "grid", gap: 8 }}>
                            {r.fb_good && <div style={{ fontSize: 13, color: "#e5e7eb", lineHeight: 1.7, whiteSpace: "pre-wrap" }}><b style={{ color: "#34d399" }}>GOOD　</b>{r.fb_good}</div>}
                            {r.fb_think && <div style={{ fontSize: 13, color: "#e5e7eb", lineHeight: 1.7, whiteSpace: "pre-wrap" }}><b style={{ color: "#fbbf24" }}>THINK　</b>{r.fb_think}</div>}
                            {r.fb_next && <div style={{ fontSize: 13, color: "#e5e7eb", lineHeight: 1.7, whiteSpace: "pre-wrap" }}><b style={{ color: "#a78bfa" }}>NEXT QUEST　</b>{r.fb_next}</div>}
                            {!r.fb_good && !r.fb_think && !r.fb_next && <div style={{ fontSize: 12.5, color: "#8b8fa8" }}>FBの本文は記録されていません</div>}
                        </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        {r.content && <button style={btn(showReport === r.id)} onClick={() => setShowReport(showReport === r.id ? null : r.id)}>日報を見る</button>}
                        {r.turns && <button style={btn(showAi === r.id)} onClick={() => setShowAi(showAi === r.id ? null : r.id)}>🤖 AIとの振り返りを見る</button>}
                        {r.status === "pending" && <button disabled={busy === r.id} style={{ ...btn(true), opacity: busy === r.id ? 0.6 : 1 }} onClick={() => remind(r)}>{busy === r.id ? "送信中..." : r.assignee_id ? "担当者に通知を送る" : "FBメンターに通知を送る"}</button>}
                        {r.status === "pending" && r.assignee_id === meId && <a href={"/fb/inbox?r=" + r.id} style={{ ...btn(true), background: "linear-gradient(90deg,#8b5cf6,#a78bfa)", color: "#fff", border: "none", textDecoration: "none" }}>自分でFBを書く</a>}
                    </div>
                    {note[r.id] && <div role="status" style={{ fontSize: 12, color: "#c4b5fd", marginTop: 8, fontWeight: 700 }}>{note[r.id]}</div>}
                    {showReport === r.id && <pre style={{ whiteSpace: "pre-wrap", fontSize: 12.5, color: "#d1d5db", marginTop: 10, padding: 10, borderRadius: 10, background: "rgba(0,0,0,0.3)", fontFamily: "inherit" }}>{r.content}</pre>}
                    {showAi === r.id && <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "rgba(0,0,0,0.3)" }}>{(r.turns || []).map((t: any, i: number) => <div key={i} style={{ fontSize: 12.5, color: t.role === "ai" ? "#c4b5fd" : "#e5e7eb", marginBottom: 6 }}><b>{t.role === "ai" ? "AI" : "本人"}：</b>{t.text}</div>)}</div>}
                </div>
            ))}
        </div>
    );
}
