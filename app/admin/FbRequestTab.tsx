"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Req = { id: string; user_id: string; submission_id: string | null; thinking_session_id: string | null; target: string; focus: string | null; status: string; fb_good: string | null; fb_think: string | null; fb_next: string | null; issue_quest: boolean; quest_claimed_at: string | null; created_at: string; responded_at: string | null; name?: string; content?: string; turns?: any[] };

const TARGET_LABEL: Record<string, string> = { mentor: "担当メンター", leader: "チームリーダー", any: "おまかせ" };

function ago(iso: string) {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 60) return `${m}分前`; const h = Math.floor(m / 60); if (h < 24) return `${h}時間前`; return `${Math.floor(h / 24)}日前`;
}

export default function FbRequestTab() {
    const [reqs, setReqs] = useState<Req[]>([]);
    const [filter, setFilter] = useState<"all" | "pending" | "done">("pending");
    const [open, setOpen] = useState<string | null>(null);
    const [draft, setDraft] = useState<{ good: string; think: string; next: string; issue: boolean }>({ good: "", think: "", next: "", issue: true });
    const [showReport, setShowReport] = useState<string | null>(null);
    const [showAi, setShowAi] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

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
        const pm = new Map((profs || []).map((p: any) => [p.id, p.name]));
        const sm = new Map((subs || []).map((s: any) => [s.id, s.content]));
        const tm = new Map((sess || []).map((s: any) => [s.id, s.turns]));
        setReqs(rows.map(r => ({ ...r, name: pm.get(r.user_id) || "名前未設定", content: r.submission_id ? sm.get(r.submission_id) : undefined, turns: r.thinking_session_id ? tm.get(r.thinking_session_id) : undefined })));
    };
    useEffect(() => { load(); }, []);

    const startWrite = (r: Req) => { setOpen(r.id); setDraft({ good: r.fb_good || "", think: r.fb_think || "", next: r.fb_next || "", issue: r.issue_quest ?? true }); };

    const submit = async (r: Req) => {
        if (saving) return;
        if (!draft.good.trim() && !draft.think.trim() && !draft.next.trim()) return;
        if (draft.issue && !draft.next.trim()) { alert("NEXT QUESTとして発行するには NEXT QUEST の内容が必要です"); return; }
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("fb_requests").update({ fb_good: draft.good.trim() || null, fb_think: draft.think.trim() || null, fb_next: draft.next.trim() || null, issue_quest: draft.issue, status: "done", responder_id: user?.id || null, responded_at: new Date().toISOString() }).eq("id", r.id);
        try { await supabase.from("notifications").insert({ user_id: r.user_id, title: draft.issue ? "💌 メンターから新しいクエストが届きました！" : "💌 メンターからFBが届きました", body: (draft.next || draft.good || draft.think).slice(0, 80), type: "fb" }); } catch { }
        setSaving(false); setOpen(null); load();
    };

    const list = reqs.filter(r => filter === "all" ? true : r.status === filter);
    const pendingN = reqs.filter(r => r.status === "pending").length;
    const box: React.CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14, marginBottom: 12 };
    const ta: React.CSSProperties = { width: "100%", minHeight: 64, borderRadius: 10, padding: 10, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 13, boxSizing: "border-box", resize: "vertical" };
    const btn = (active: boolean): React.CSSProperties => ({ padding: "6px 14px", borderRadius: 8, border: active ? "1.5px solid #a78bfa" : "1px solid rgba(255,255,255,0.1)", background: active ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.05)", color: active ? "#c4b5fd" : "#9ca3af", fontWeight: 800, fontSize: 12, cursor: "pointer" });

    return (
        <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 4 }}>💌 FBリクエスト</div>
            <div style={{ fontSize: 12, color: "#8b8fa8", marginBottom: 14 }}>日報の承認待ちとは別。本人が「FBがほしい」と送ってきたもの。GOOD / THINK / NEXT QUEST の3つで返す</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button style={btn(filter === "pending")} onClick={() => setFilter("pending")}>未対応 {pendingN}</button>
                <button style={btn(filter === "done")} onClick={() => setFilter("done")}>対応済み</button>
                <button style={btn(filter === "all")} onClick={() => setFilter("all")}>すべて</button>
            </div>
            {list.length === 0 && <div style={{ color: "#6b7280", fontSize: 13, padding: 20, textAlign: "center" }}>リクエストはありません</div>}
            {list.map(r => (
                <div key={r.id} style={box}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div>
                            <span style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>{r.name}</span>
                            <span style={{ fontSize: 11, color: "#8b8fa8", marginLeft: 8 }}>{TARGET_LABEL[r.target] || r.target}</span>
                            {r.thinking_session_id && <span style={{ fontSize: 10, marginLeft: 8, padding: "2px 6px", borderRadius: 6, background: "rgba(139,92,246,0.2)", color: "#c4b5fd" }}>AIで深掘り済み</span>}
                        </div>
                        <div style={{ fontSize: 11, color: r.status === "pending" ? "#f87171" : "#34d399", fontWeight: 800 }}>{r.status === "pending" ? "未対応" : r.quest_claimed_at ? "クエスト受領済み" : r.issue_quest ? "クエスト未受領" : "対応済"}　<span style={{ color: "#6b7280", fontWeight: 500 }}>{ago(r.created_at)}</span></div>
                    </div>
                    {r.focus && <div style={{ fontSize: 13, color: "#e5e7eb", marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(139,92,246,0.1)" }}>「{r.focus}」</div>}
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        {r.content && <button style={btn(showReport === r.id)} onClick={() => setShowReport(showReport === r.id ? null : r.id)}>日報を見る</button>}
                        {r.turns && <button style={btn(showAi === r.id)} onClick={() => setShowAi(showAi === r.id ? null : r.id)}>🤖 AIとの振り返りを見る</button>}
                        {open !== r.id && <button style={{ ...btn(true), background: "linear-gradient(90deg,#8b5cf6,#a78bfa)", color: "#fff", border: "none" }} onClick={() => startWrite(r)}>{r.status === "pending" ? "FBを書く" : "FBを編集"}</button>}
                    </div>
                    {showReport === r.id && <pre style={{ whiteSpace: "pre-wrap", fontSize: 12.5, color: "#d1d5db", marginTop: 10, padding: 10, borderRadius: 10, background: "rgba(0,0,0,0.3)", fontFamily: "inherit" }}>{r.content}</pre>}
                    {showAi === r.id && <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "rgba(0,0,0,0.3)" }}>{(r.turns || []).map((t: any, i: number) => <div key={i} style={{ fontSize: 12.5, color: t.role === "ai" ? "#c4b5fd" : "#e5e7eb", marginBottom: 6 }}><b>{t.role === "ai" ? "AI" : "本人"}：</b>{t.text}</div>)}</div>}
                    {open === r.id && (
                        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(167,139,250,0.3)" }}>
                            <div style={{ fontSize: 12, fontWeight: 900, color: "#34d399", marginBottom: 4 }}>👍 GOOD　<span style={{ fontWeight: 500, color: "#8b8fa8" }}>良かった考え・行動</span></div>
                            <textarea style={ta} value={draft.good} onChange={e => setDraft({ ...draft, good: e.target.value.slice(0, 300) })} placeholder="例：送信数だけでなく返信率まで見ている点はとても良いです" />
                            <div style={{ fontSize: 12, fontWeight: 900, color: "#fbbf24", margin: "10px 0 4px" }}>🧠 THINK　<span style={{ fontWeight: 500, color: "#8b8fa8" }}>もう一段考えてほしいこと</span></div>
                            <textarea style={ta} value={draft.think} onChange={e => setDraft({ ...draft, think: e.target.value.slice(0, 300) })} placeholder="例：なぜ時間帯が原因だと思ったのか、もう一段根拠を考えてみましょう" />
                            <div style={{ fontSize: 12, fontWeight: 900, color: "#a78bfa", margin: "10px 0 4px" }}>⚔️ NEXT QUEST　<span style={{ fontWeight: 500, color: "#8b8fa8" }}>次に試してほしいこと</span></div>
                            <textarea style={ta} value={draft.next} onChange={e => setDraft({ ...draft, next: e.target.value.slice(0, 300) })} placeholder="例：明日は送信時間を18〜20時に固定し、対象大学だけ変えて比較してみよう" />
                            <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, cursor: "pointer" }}>
                                <input type="checkbox" checked={draft.issue} onChange={e => setDraft({ ...draft, issue: e.target.checked })} />
                                <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>⚔️ NEXT QUESTとして発行</span>
                                <span style={{ fontSize: 11, color: "#8b8fa8" }}>本人のホームにクエストとして届く（+20pt・仮説思考EXP +10）</span>
                            </label>
                            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                                <button onClick={() => submit(r)} disabled={saving} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "linear-gradient(90deg,#8b5cf6,#a78bfa)", color: "#fff", fontWeight: 900, cursor: "pointer" }}>{saving ? "送信中..." : "FBを返信する"}</button>
                                <button onClick={() => setOpen(null)} style={btn(false)}>キャンセル</button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
