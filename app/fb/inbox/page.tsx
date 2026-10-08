"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import RecommendSkillBox from "../../components/RecommendSkillBox";

type Req = { id: string; user_id: string; submission_id: string | null; thinking_session_id: string | null; target: string; focus: string | null; status: string; fb_good: string | null; fb_think: string | null; fb_next: string | null; issue_quest: boolean; quest_claimed_at: string | null; created_at: string; assignee_id: string | null; name?: string; content?: string };

function ago(iso: string) { const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); if (m < 60) return `${m}分前`; const h = Math.floor(m / 60); if (h < 24) return `${h}時間前`; return `${Math.floor(h / 24)}日前`; }

export default function FbInboxPage() {
    const router = useRouter();
    const [meId, setMeId] = useState("");
    const [allowed, setAllowed] = useState<boolean | null>(null);
    const [reqs, setReqs] = useState<Req[]>([]);
    const [tab, setTab] = useState<"pending" | "done">("pending");
    const [open, setOpen] = useState<string | null>(null);
    const [showReport, setShowReport] = useState<string | null>(null);
    const [draft, setDraft] = useState({ good: "", think: "", next: "", issue: true });
    const [saving, setSaving] = useState(false);

    const load = async (uid: string) => {
        const { data } = await supabase.from("fb_requests").select("*").or(`assignee_id.eq.${uid},and(target.eq.any,assignee_id.is.null)`).order("created_at", { ascending: false }).limit(100);
        const rows = (data || []) as Req[];
        const uids = [...new Set(rows.map(r => r.user_id))];
        const sids = rows.map(r => r.submission_id).filter(Boolean) as string[];
        const [{ data: profs }, { data: subs }] = await Promise.all([
            uids.length ? supabase.from("profiles").select("id, name").in("id", uids) : Promise.resolve({ data: [] as any[] }),
            sids.length ? supabase.from("submissions").select("id, content").in("id", sids) : Promise.resolve({ data: [] as any[] }),
        ]);
        const pm = new Map((profs || []).map((p: any) => [p.id, p.name]));
        const sm = new Map((subs || []).map((s: any) => [s.id, s.content]));
        setReqs(rows.map(r => ({ ...r, name: pm.get(r.user_id) || "名前未設定", content: r.submission_id ? sm.get(r.submission_id) : undefined })));
    };

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setMeId(user.id);
            const { data: prof } = await supabase.from("profiles").select("fb_mentor").eq("id", user.id).single();
            const ok = !!(prof as any)?.fb_mentor;
            setAllowed(ok);
            if (ok) load(user.id);
        })();
    }, []);

    const submit = async (r: Req) => {
        if (saving) return;
        if (!draft.good.trim() && !draft.think.trim() && !draft.next.trim()) return;
        if (draft.issue && !draft.next.trim()) { alert("クエストとして発行するには NEXT QUEST が必要です"); return; }
        setSaving(true);
        await supabase.from("fb_requests").update({ fb_good: draft.good.trim() || null, fb_think: draft.think.trim() || null, fb_next: draft.next.trim() || null, issue_quest: draft.issue, status: "done", responder_id: meId, responded_at: new Date().toISOString() }).eq("id", r.id);
        try { await supabase.from("notifications").insert({ user_id: r.user_id, title: draft.issue ? "💌 メンターから新しいクエストが届きました！" : "💌 メンターからFBが届きました", body: (draft.next || draft.good || draft.think).slice(0, 80), type: "fb" }); } catch { }
        setSaving(false); setOpen(null); load(meId);
    };

    const list = reqs.filter(r => r.status === tab);
    const ta: React.CSSProperties = { width: "100%", minHeight: 70, borderRadius: 12, padding: 10, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 13.5, boxSizing: "border-box", resize: "vertical" };
    const btn = (active: boolean): React.CSSProperties => ({ padding: "7px 14px", borderRadius: 10, border: active ? "1.5px solid #a78bfa" : "1px solid rgba(255,255,255,0.1)", background: active ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.05)", color: active ? "#c4b5fd" : "#9ca3af", fontWeight: 800, fontSize: 12.5, cursor: "pointer" });

    return (
        <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% 0%, #1a1030 0%, #0b0b16 55%)", padding: "24px 16px 60px" }}>
            <div style={{ maxWidth: 620, margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <button onClick={() => router.push("/home")} style={{ border: "none", background: "transparent", color: "#c4b5fd", fontSize: 20, cursor: "pointer" }}>←</button>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>💌 届いたFBリクエスト</div>
                </div>
                <div style={{ fontSize: 12.5, color: "#8b8fa8", marginBottom: 16, paddingLeft: 34 }}>GOOD / THINK / NEXT QUEST の3つで返す。発行ONにすると本人の島にクエストとして届く</div>
                {allowed === false && <div style={{ color: "#f87171", fontSize: 14, padding: 20, textAlign: "center" }}>このページはFBメンターのみ見られます</div>}
                {allowed && (
                    <>
                        <RecommendSkillBox />
                        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                            <button style={btn(tab === "pending")} onClick={() => setTab("pending")}>未対応 {reqs.filter(r => r.status === "pending").length}</button>
                            <button style={btn(tab === "done")} onClick={() => setTab("done")}>返信済み</button>
                        </div>
                        {list.length === 0 && <div style={{ color: "#6b7280", fontSize: 13, padding: 24, textAlign: "center" }}>{tab === "pending" ? "今は届いていません" : "まだありません"}</div>}
                        {list.map(r => (
                            <div key={r.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, marginBottom: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <div><span style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{r.name}</span><span style={{ fontSize: 11, color: "#8b8fa8", marginLeft: 8 }}>{r.assignee_id === meId ? "あなたを指名" : "おまかせ"}</span></div>
                                    <span style={{ fontSize: 11, color: "#6b7280" }}>{ago(r.created_at)}</span>
                                </div>
                                {r.focus && <div style={{ fontSize: 13.5, color: "#e5e7eb", marginTop: 10, padding: 10, borderRadius: 10, background: "rgba(139,92,246,0.1)" }}>「{r.focus}」</div>}
                                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                                    {r.content && <button style={btn(showReport === r.id)} onClick={() => setShowReport(showReport === r.id ? null : r.id)}>日報を見る</button>}
                                    {r.status === "pending" && open !== r.id && <button style={{ ...btn(true), background: "linear-gradient(90deg,#8b5cf6,#a78bfa)", color: "#fff", border: "none" }} onClick={() => { setOpen(r.id); setDraft({ good: "", think: "", next: "", issue: true }); }}>FBを書く</button>}
                                </div>
                                {showReport === r.id && <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "#d1d5db", marginTop: 10, padding: 10, borderRadius: 10, background: "rgba(0,0,0,0.3)", fontFamily: "inherit" }}>{r.content}</pre>}
                                {r.status === "done" && (
                                    <div style={{ marginTop: 10, fontSize: 13, color: "#d1d5db", display: "grid", gap: 4 }}>
                                        {r.fb_good && <div><span style={{ color: "#34d399", fontWeight: 800 }}>👍 </span>{r.fb_good}</div>}
                                        {r.fb_think && <div><span style={{ color: "#fbbf24", fontWeight: 800 }}>🧠 </span>{r.fb_think}</div>}
                                        {r.fb_next && <div><span style={{ color: "#a78bfa", fontWeight: 800 }}>⚔️ </span>{r.fb_next}{r.issue_quest && <span style={{ fontSize: 11, color: r.quest_claimed_at ? "#34d399" : "#8b8fa8", marginLeft: 8 }}>{r.quest_claimed_at ? "クエスト受領済み" : "クエスト未受領"}</span>}</div>}
                                    </div>
                                )}
                                {open === r.id && (
                                    <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(167,139,250,0.3)" }}>
                                        <div style={{ fontSize: 12.5, fontWeight: 900, color: "#34d399", marginBottom: 4 }}>👍 GOOD <span style={{ fontWeight: 500, color: "#8b8fa8" }}>良かった考え・行動</span></div>
                                        <textarea style={ta} value={draft.good} onChange={e => setDraft({ ...draft, good: e.target.value.slice(0, 300) })} placeholder="例：送信数だけでなく返信率まで見ている点はとても良いです" />
                                        <div style={{ fontSize: 12.5, fontWeight: 900, color: "#fbbf24", margin: "10px 0 4px" }}>🧠 THINK <span style={{ fontWeight: 500, color: "#8b8fa8" }}>もう一段考えてほしいこと</span></div>
                                        <textarea style={ta} value={draft.think} onChange={e => setDraft({ ...draft, think: e.target.value.slice(0, 300) })} placeholder="例：なぜ時間帯が原因だと思ったのか、もう一段根拠を考えてみましょう" />
                                        <div style={{ fontSize: 12.5, fontWeight: 900, color: "#a78bfa", margin: "10px 0 4px" }}>⚔️ NEXT QUEST <span style={{ fontWeight: 500, color: "#8b8fa8" }}>次に試してほしいこと</span></div>
                                        <textarea style={ta} value={draft.next} onChange={e => setDraft({ ...draft, next: e.target.value.slice(0, 300) })} placeholder="例：明日は送信時間を18〜20時に固定し、対象大学だけ変えて比較してみよう" />
                                        <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, cursor: "pointer" }}>
                                            <input type="checkbox" checked={draft.issue} onChange={e => setDraft({ ...draft, issue: e.target.checked })} />
                                            <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>⚔️ NEXT QUESTとして発行</span>
                                            <span style={{ fontSize: 11, color: "#8b8fa8" }}>本人の島にクエストとして届く（+20pt）</span>
                                        </label>
                                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                                            <button onClick={() => submit(r)} disabled={saving} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: "linear-gradient(90deg,#8b5cf6,#a78bfa)", color: "#fff", fontWeight: 900, cursor: "pointer" }}>{saving ? "送信中..." : "FBを返信する"}</button>
                                            <button onClick={() => setOpen(null)} style={btn(false)}>キャンセル</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}
