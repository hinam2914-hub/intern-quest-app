"use client";
// 届いたFBリクエスト（メンターがFBを書くページ）。読み書きの処理は従来のまま、見た目を HOME と同じ天空王国デザインに変更。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import RecommendSkillBox from "../../components/RecommendSkillBox";
import AvatarFace, { unifiedFaceSource, type FaceSource } from "../../components/AvatarFace";

type Req = { id: string; user_id: string; submission_id: string | null; thinking_session_id: string | null; target: string; focus: string | null; status: string; fb_good: string | null; fb_think: string | null; fb_next: string | null; issue_quest: boolean; quest_claimed_at: string | null; created_at: string; assignee_id: string | null; name?: string; content?: string; face?: FaceSource };

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
    const [focusId, setFocusId] = useState<string | null>(null);
    const [err, setErr] = useState("");

    const load = async (uid: string) => {
        const { data } = await supabase.from("fb_requests").select("*").or(`assignee_id.eq.${uid},and(target.eq.any,assignee_id.is.null)`).order("created_at", { ascending: false }).limit(100);
        const rows = (data || []) as Req[];
        const uids = [...new Set(rows.map(r => r.user_id))];
        const sids = rows.map(r => r.submission_id).filter(Boolean) as string[];
        const [{ data: profs }, { data: subs }] = await Promise.all([
            uids.length ? supabase.from("profiles").select("id, name, job_class, avatar_config").in("id", uids) : Promise.resolve({ data: [] as any[] }),
            sids.length ? supabase.from("submissions").select("id, content").in("id", sids) : Promise.resolve({ data: [] as any[] }),
        ]);
        const pm = new Map((profs || []).map((p: any) => [p.id, p.name]));
        const fm = new Map((profs || []).map((p: any) => [p.id, unifiedFaceSource(p)]));
        const sm = new Map((subs || []).map((s: any) => [s.id, s.content]));
        setReqs(rows.map(r => ({ ...r, name: pm.get(r.user_id) || "名前未設定", face: fm.get(r.user_id), content: r.submission_id ? sm.get(r.submission_id) : undefined })));
    };

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setMeId(user.id);
            const { data: prof } = await supabase.from("profiles").select("fb_mentor").eq("id", user.id).single();
            // FBメンター、または自分あてに指名されたリクエストがある人が見られる
            const { count: mine } = await supabase.from("fb_requests").select("id", { count: "exact", head: true }).eq("assignee_id", user.id);
            const ok = !!(prof as any)?.fb_mentor || (mine || 0) > 0;
            setAllowed(ok);
            if (ok) {
                await load(user.id);
                // 通知から来たとき（?r=リクエストID）：そのリクエストの入力欄を開いた状態にする
                const rid = new URLSearchParams(window.location.search).get("r");
                if (rid) { setFocusId(rid); setTimeout(() => document.getElementById("fbreq-" + rid)?.scrollIntoView({ behavior: "smooth", block: "center" }), 300); }
            }
        })();
    }, []);

    const submit = async (r: Req) => {
        if (saving) return;
        if (!draft.good.trim() && !draft.think.trim() && !draft.next.trim()) { setErr("GOOD・THINK・NEXT QUEST のどれかを書いてください"); return; }
        if (draft.issue && !draft.next.trim()) { setErr("クエストとして発行するには NEXT QUEST が必要です"); return; }
        setSaving(true); setErr("");
        const { error } = await supabase.from("fb_requests").update({ fb_good: draft.good.trim() || null, fb_think: draft.think.trim() || null, fb_next: draft.next.trim() || null, issue_quest: draft.issue, status: "done", responder_id: meId, responded_at: new Date().toISOString() }).eq("id", r.id);
        if (error) { setSaving(false); setErr("送信できませんでした。通信を確認して、もう一度お試しください。"); return; }
        // お願いした人に通知する（サーバー側の関数。未導入の環境では直接通知を入れる）
        { const { error: nErr } = await supabase.rpc("fb_response_notify", { p_request: r.id });
          if (nErr) await supabase.from("notifications").insert({ user_id: r.user_id, type: "fb", title: draft.issue ? "メンターから新しいクエストが届きました" : "メンターからFBが届きました", message: (draft.next || draft.good || draft.think).slice(0, 80), link: "/report?fb=" + r.id, icon: "💌" }); }
        setSaving(false); setOpen(null); load(meId);
    };

    // 通知から開いたリクエスト：未対応なら入力欄を開く／返信済みなら「返信済み」タブを見せる
    useEffect(() => {
        if (!focusId) return;
        const r = reqs.find(x => x.id === focusId); if (!r) return;
        if (r.status === "pending") { setTab("pending"); setOpen(r.id); setDraft({ good: "", think: "", next: "", issue: true }); if (r.content) setShowReport(r.id); }
        else setTab("done");
        setFocusId(null);
    }, [focusId, reqs]);
    const list = reqs.filter(r => r.status === tab);
    const pendingN = reqs.filter(r => r.status === "pending").length;
    const startWrite = (r: Req) => { setOpen(r.id); setErr(""); setDraft({ good: "", think: "", next: "", issue: true }); };
    const FIELDS = [
        { k: "good", cls: "g", label: "GOOD", sub: "良かった考え・行動", ph: "例：送信数だけでなく返信率まで見ている点はとても良いです" },
        { k: "think", cls: "t", label: "THINK", sub: "もう一段考えてほしいこと", ph: "例：なぜ時間帯が原因だと思ったのか、もう一段根拠を考えてみましょう" },
        { k: "next", cls: "n", label: "NEXT QUEST", sub: "次に試してほしいこと", ph: "例：明日は送信時間を18〜20時に固定し、対象大学だけ変えて比較してみよう" },
    ] as const;

    return (
        <div className="fi-root">
            <div className="fi-wrap">
                <button className="fi-back" onClick={() => router.push("/home")} aria-label="ホームへ戻る">←</button>
                <div className="fi-panel">
                    <div className="fi-title"><img src="/home/title_plate.webp" alt="" /><h1><img src="/fb/icon_letter.webp" alt="" />届いたFBリクエスト</h1></div>
                    <p className="fi-lead">GOOD / THINK / NEXT QUEST の3つで返します。「クエストとして発行」をONにすると、本人にクエストとして届きます</p>
                    {allowed === null && <p className="fi-empty" role="status">読み込み中…</p>}
                    {allowed === false && <p className="fi-empty">あなたあてのFBリクエストはまだありません</p>}
                    {allowed && (
                        <>
                            <div className="fi-skill"><RecommendSkillBox /></div>
                            <div className="fi-tabs" role="tablist">
                                <button role="tab" aria-selected={tab === "pending"} className={tab === "pending" ? "on" : ""} onClick={() => setTab("pending")}>未対応<b>{pendingN}</b></button>
                                <button role="tab" aria-selected={tab === "done"} className={tab === "done" ? "on" : ""} onClick={() => setTab("done")}>返信済み<b>{reqs.length - pendingN}</b></button>
                            </div>
                            {list.length === 0 && <p className="fi-empty">{tab === "pending" ? "今は届いていません" : "まだありません"}</p>}
                            {list.map(r => (
                                <article key={r.id} id={"fbreq-" + r.id} className="fi-card">
                                    <div className="fi-head">
                                        <AvatarFace src={r.face || { job: null, cfg: null }} size={48} border="2.5px solid #e2bf63" />
                                        <div className="nm"><b>{r.name}</b><span className={r.assignee_id === meId ? "tag me" : "tag"}>{r.assignee_id === meId ? "あなたを指名" : "おまかせ"}</span></div>
                                        <time>{ago(r.created_at)}</time>
                                    </div>
                                    {r.focus && <div className="fi-focus"><small>特に見てほしいこと</small>{r.focus}</div>}
                                    <div className="fi-btns">
                                        {r.content && <button className="fi-sub" aria-expanded={showReport === r.id} onClick={() => setShowReport(showReport === r.id ? null : r.id)}>{showReport === r.id ? "日報を閉じる" : "日報を見る"}</button>}
                                        {r.status === "pending" && open !== r.id && <button className="fi-main" onClick={() => startWrite(r)}>FBを書く</button>}
                                    </div>
                                    {showReport === r.id && <pre className="fi-report">{r.content}</pre>}
                                    {r.status === "done" && (
                                        <div className="fi-done">
                                            {r.fb_good && <div><span className="lb g">GOOD</span><p>{r.fb_good}</p></div>}
                                            {r.fb_think && <div><span className="lb t">THINK</span><p>{r.fb_think}</p></div>}
                                            {r.fb_next && <div><span className="lb n">NEXT QUEST</span><p>{r.fb_next}{r.issue_quest && <em className={r.quest_claimed_at ? "ok" : ""}>{r.quest_claimed_at ? "クエスト受領済み" : "クエスト未受領"}</em>}</p></div>}
                                        </div>
                                    )}
                                    {open === r.id && (
                                        <div className="fi-form">
                                            {FIELDS.map(f => (
                                                <label key={f.k} className="fi-field">
                                                    <span><i className={"lb " + f.cls}>{f.label}</i>{f.sub}</span>
                                                    <textarea value={draft[f.k]} onChange={e => setDraft({ ...draft, [f.k]: e.target.value.slice(0, 300) })} maxLength={300} placeholder={f.ph} />
                                                    <small>{draft[f.k].length}/300</small>
                                                </label>
                                            ))}
                                            <label className="fi-issue">
                                                <input type="checkbox" checked={draft.issue} onChange={e => setDraft({ ...draft, issue: e.target.checked })} />
                                                <span><b>NEXT QUEST をクエストとして発行</b><small>本人にクエストとして届きます（+20pt）</small></span>
                                            </label>
                                            {err && <div role="alert" className="fi-err">{err}</div>}
                                            <div className="fi-send">
                                                <button className="fi-main big" onClick={() => submit(r)} disabled={saving}>{saving ? <i className="fi-spin" aria-hidden /> : <img src="/fb/icon_send.webp" alt="" />}{saving ? "送信中..." : "FBを返信する"}</button>
                                                <button className="fi-sub" onClick={() => { setOpen(null); setErr(""); }} disabled={saving}>キャンセル</button>
                                            </div>
                                        </div>
                                    )}
                                </article>
                            ))}
                        </>
                    )}
                </div>
            </div>
            <style>{CSS}</style>
        </div>
    );
}

const CSS = `
.fi-root{min-height:100vh;min-height:100dvh;background:#cfe6ff url(/home/bg_mobile.webp) center top/cover fixed;padding:12px 8px 28px;color:#17307a;font-family:inherit;overflow-x:clip}
@media (min-width:700px){ .fi-root{background-image:url(/home/bg_pc.webp);padding:20px 16px 36px} }
.fi-wrap{position:relative;max-width:900px;margin:0 auto;display:flow-root}
.fi-back{position:absolute;left:0;top:0;width:56px;height:44px;border-radius:999px;border:2.5px solid #c9a94e;background:linear-gradient(180deg,#fffdf6,#f3e6c4);color:#7a5a12;font-size:21px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 4px 10px rgba(16,47,112,.25);z-index:3}
.fi-panel{margin:84px auto 0;max-width:780px;background:linear-gradient(180deg,#fffdf6,#fbf3df);border:4px solid #e2bf63;border-radius:30px;box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 4px rgba(226,191,99,.45),0 16px 36px rgba(16,47,112,.32);padding:0 26px 22px}
.fi-title{position:relative;width:min(100%,460px);margin:-32px auto 0;container-type:inline-size}
.fi-title>img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 12px rgba(16,47,112,.35))}
.fi-title h1{position:absolute;inset:0;margin:0;display:flex;align-items:center;justify-content:center;gap:.35em;color:#fff;font-size:clamp(14px,5.6cqw,25px);font-weight:900;letter-spacing:.05em;text-shadow:0 2px 4px rgba(4,10,40,.6);white-space:nowrap}
.fi-title h1 img{width:1.5em;height:auto}
.fi-lead{margin:12px 0 14px;font-size:13px;font-weight:700;color:#3a4a75;line-height:1.7;text-align:center}
.fi-empty{margin:26px 0;text-align:center;font-size:14px;font-weight:800;color:#5a6488}
.fi-skill{margin-bottom:14px}
.fi-tabs{display:flex;gap:8px;margin-bottom:12px}
.fi-tabs button{min-height:44px;padding:6px 18px;border-radius:999px;border:2px solid rgba(201,169,78,.6);background:#fffefb;color:#3a4a75;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:8px}
.fi-tabs b{min-width:22px;padding:0 6px;border-radius:999px;background:#e9eefc;font-size:12.5px;line-height:22px;text-align:center}
.fi-tabs button.on{background:linear-gradient(180deg,#3f6fe0,#1c3fa8);border-color:#e2bf63;color:#fff}
.fi-tabs button.on b{background:#fff;color:#1c3fa8}
.fi-card{background:#fffefb;border:2px solid rgba(201,169,78,.55);border-radius:20px;padding:14px 16px;margin-bottom:12px;box-shadow:0 3px 8px rgba(120,90,30,.12)}
.fi-head{display:flex;align-items:center;gap:12px}
.fi-head .nm{flex:1;min-width:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.fi-head b{font-size:17px;font-weight:900;overflow-wrap:anywhere}
.fi-head .tag{padding:2px 10px;border-radius:999px;background:#eef1f8;color:#5a6488;font-size:11.5px;font-weight:900;white-space:nowrap}
.fi-head .tag.me{background:#fff0c9;color:#8a5a08;border:1.5px solid #e2bf63}
.fi-head time{flex-shrink:0;font-size:12px;font-weight:700;color:#6b7591}
.fi-focus{margin-top:10px;padding:10px 14px;border-radius:14px;background:#eef4ff;border:1.5px solid #b9cdf6;font-size:14px;font-weight:700;line-height:1.7;overflow-wrap:anywhere;white-space:pre-wrap}
.fi-focus small{display:block;font-size:11.5px;font-weight:900;color:#3f5fb0;margin-bottom:2px}
.fi-btns{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.fi-sub{min-height:44px;padding:6px 18px;border-radius:999px;border:2px solid #b9cdf6;background:#fff;color:#17397d;font-size:13.5px;font-weight:900;cursor:pointer;font-family:inherit}
.fi-main{min-height:44px;padding:6px 22px;border-radius:999px;border:2.5px solid #e2bf63;background:linear-gradient(180deg,#3f6fe0,#1c3fa8);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.35),0 4px 10px rgba(16,47,112,.3);color:#fff;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:transform .08s}
.fi-main.big{flex:1;min-height:56px;font-size:16.5px;letter-spacing:.04em}
.fi-main img{width:26px;height:26px;object-fit:contain}
.fi-main:active:not(:disabled),.fi-sub:active:not(:disabled){transform:translateY(1px)}
.fi-main:disabled,.fi-sub:disabled{opacity:.65;cursor:default}
.fi-report{margin:10px 0 0;padding:12px 14px;border-radius:14px;background:#f7f2e4;border:1.5px solid rgba(190,160,110,.5);font-family:inherit;font-size:13.5px;line-height:1.75;font-weight:600;color:#2c3555;white-space:pre-wrap;overflow-wrap:anywhere;max-height:320px;overflow-y:auto}
.lb{display:inline-block;flex-shrink:0;padding:1px 10px;border-radius:999px;font-style:normal;font-size:11.5px;font-weight:900;letter-spacing:.04em;color:#fff;white-space:nowrap}
.lb.g{background:#2f9e62}.lb.t{background:#d08a10}.lb.n{background:#3f5fd0}
.fi-done{margin-top:10px;display:grid;gap:8px}
.fi-done>div{display:flex;align-items:flex-start;gap:10px}
.fi-done .lb{margin-top:3px}
.fi-done p{margin:0;flex:1;min-width:0;font-size:14px;line-height:1.7;font-weight:600;color:#2c3555;white-space:pre-wrap;overflow-wrap:anywhere}
.fi-done em{font-style:normal;margin-left:8px;padding:1px 9px;border-radius:999px;background:#eef1f8;color:#5a6488;font-size:11.5px;font-weight:900;white-space:nowrap}
.fi-done em.ok{background:#e3f5ea;color:#1f6a3d}
.fi-form{margin-top:12px;padding:14px;border-radius:16px;background:#f4f7ff;border:2px solid #b9cdf6}
.fi-field{display:block;margin-bottom:10px}
.fi-field>span{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px;font-weight:800;color:#3a4a75;margin-bottom:5px}
.fi-field textarea{display:block;width:100%;box-sizing:border-box;min-height:84px;border-radius:14px;padding:11px 14px;background:#fffefb;border:2px solid rgba(201,169,78,.7);color:#17307a;font-size:16px;line-height:1.65;font-family:inherit;resize:vertical}
.fi-field textarea::placeholder{color:#8a8fa6}
.fi-field small{display:block;text-align:right;font-size:11.5px;font-weight:700;color:#6b7591;margin-top:2px}
.fi-issue{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:14px;background:#fffefb;border:1.5px solid rgba(201,169,78,.6);cursor:pointer}
.fi-issue input{width:22px;height:22px;flex-shrink:0;accent-color:#1c3fa8}
.fi-issue b{display:block;font-size:14px;font-weight:900}
.fi-issue small{font-size:12px;font-weight:700;color:#5a6488}
.fi-err{margin-top:10px;padding:10px 14px;border-radius:12px;background:#fdecec;border:2px solid #e58a8a;color:#a11d1d;font-size:13.5px;font-weight:800}
.fi-send{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.fi-spin{width:18px;height:18px;border-radius:50%;border:3px solid rgba(255,255,255,.4);border-top-color:#fff;animation:fi-rot .8s linear infinite}
@keyframes fi-rot{to{transform:rotate(360deg)}}
.fi-back:focus-visible,.fi-tabs button:focus-visible,.fi-sub:focus-visible,.fi-main:focus-visible,.fi-field textarea:focus-visible,.fi-issue input:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}
@media (max-width:640px){
  .fi-panel{padding:0 12px 16px;border-width:3px;border-radius:24px}
  .fi-title{width:min(100%,340px);margin-top:-28px}
  .fi-card{padding:12px}
  .fi-head time{font-size:11px}
  .fi-form{padding:10px}
  .fi-send .fi-sub{flex:1 1 100%}
}
`;
