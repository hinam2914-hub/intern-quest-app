"use client";
// FBリクエスト（日報のFBをメンターにお願いする）。送信・通知・日報との紐付けは従来のまま、見た目だけを王国の夜空デザインに変更。
// メンターの顔は、掲示板と同じアバターの顔アイコン（AvatarFace）で表示する。
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import AvatarFace, { unifiedFaceSource, type FaceSource } from "../../components/AvatarFace";

function FbInner() {
    const router = useRouter();
    const sp = useSearchParams();
    const sid = sp.get("sid");
    const tsid = sp.get("tsid");
    const [pick, setPick] = useState<string>("any");
    const [people, setPeople] = useState<{ id: string; name: string; face: FaceSource }[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [q, setQ] = useState("");
    const [focus, setFocus] = useState("");
    const [sending, setSending] = useState(false);
    const [done, setDone] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            const { data } = await supabase.from("profiles").select("id, name, job_class, avatar_config").eq("is_active", true).eq("fb_mentor", true).order("name");
            setPeople(((data || []) as any[]).filter(p => p.id !== user?.id).map(p => ({ id: p.id, name: p.name || "名前未設定", face: unifiedFaceSource(p) })));
            setLoaded(true);
        })();
    }, []);

    const send = async () => {
        if (sending || done) return;
        setSending(true); setErr("");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }
        const { data: row, error } = await supabase.from("fb_requests").insert({ user_id: user.id, submission_id: sid, thinking_session_id: tsid, target: pick === "any" ? "any" : "mentor", focus: focus.trim() || null, assignee_id: pick === "any" ? null : pick }).select("id").single();
        if (error || !row) { setSending(false); setErr("送信できませんでした。通信を確認して、もう一度お試しください。"); return; }
        // お願いされた人に通知する（サーバー側の関数。未導入の環境では、指名した相手にだけ直接通知を入れる）
        const { error: nErr } = await supabase.rpc("fb_request_notify", { p_request: (row as any).id });
        if (nErr && pick !== "any") {
            const { data: me } = await supabase.from("profiles").select("name").eq("id", user.id).single();
            await supabase.from("notifications").insert({ user_id: pick, type: "fb", title: "FBリクエストが届きました", message: `${(me as any)?.name || "メンバー"}さんから日報のFBをお願いされています。${focus.trim() ? "「" + focus.trim().slice(0, 60) + "」" : ""}`, link: "/fb/inbox?r=" + (row as any).id, icon: "💌" });
        }
        setDone(true);
        setSending(false);
        setTimeout(() => router.push("/home"), 1600);
    };

    const pickedName = people.find(p => p.id === pick)?.name;
    const shown = people.filter(p => !q.trim() || p.name.includes(q.trim()));

    return (
        <div className="fq-root">
            <div className="fq-wrap">
                <div className="fq-top">
                    <button className="fq-back" onClick={() => router.back()} aria-label="戻る">←</button>
                    <div className="fq-title"><img src="/home/title_plate.webp" alt="" /><h1>FBリクエスト</h1></div>
                </div>
                {done ? (
                    <div className="fq-done" role="status">
                        <img src="/home/check_done.webp" alt="" />
                        <b>{pickedName ? `${pickedName}さんに届けました` : "メンターに届けました"}</b>
                        <span>相手に通知を送りました。返事が来たら通知でお知らせします</span>
                    </div>
                ) : (
                    <>
                        <h2 className="fq-h">誰にお願いしますか？</h2>
                        <div role="radiogroup" aria-label="FBをお願いする相手">
                            <button type="button" role="radio" aria-checked={pick === "any"} className={"fq-any" + (pick === "any" ? " on" : "")} onClick={() => setPick("any")}>
                                <span className="tx"><b>おまかせ</b><small>手の空いているメンターにお願いする</small></span>
                                <i className="fq-radio" aria-hidden />
                            </button>
                            <input className="fq-search" value={q} onChange={e => setQ(e.target.value)} placeholder="名前で探す" aria-label="メンターを名前で探す" />
                            <div className="fq-list">
                                {shown.map(p => (
                                    <button type="button" key={p.id} role="radio" aria-checked={pick === p.id} className={"fq-person" + (pick === p.id ? " on" : "")} onClick={() => setPick(p.id)}>
                                        <AvatarFace src={p.face} size={44} border="2px solid #e2bf63" />
                                        <b>{p.name}</b>
                                        <i className="fq-radio" aria-hidden />
                                    </button>
                                ))}
                                {loaded && people.length === 0 && <div className="fq-none">指名できるメンターがまだいません。「おまかせ」で送ってください</div>}
                                {loaded && people.length > 0 && shown.length === 0 && <div className="fq-none">「{q.trim()}」に当てはまるメンターはいません</div>}
                            </div>
                        </div>
                        <h2 className="fq-h quill"><img src="/rookie/section_quill.webp" alt="" />特に見てほしいこと（任意）</h2>
                        <textarea className="fq-ta" value={focus} onChange={e => setFocus(e.target.value.slice(0, 200))} maxLength={200} placeholder="例：アポが取れなかった原因について、自分の考え方が合っているか見てほしいです。" aria-label="特に見てほしいこと" />
                        <div className="fq-count">{focus.length}/200</div>
                        <div className="fq-sendbar">
                            {err && <div role="alert" className="fq-err">{err}</div>}
                            <button type="button" className="fq-send" onClick={send} disabled={sending}>
                                <span>{sending ? "送信中..." : pickedName ? `${pickedName}さんにFBをお願いする` : "FBをお願いする"}</span>
                            </button>
                        </div>
                    </>
                )}
            </div>
            <style>{CSS}</style>
        </div>
    );
}

// 背景は夜空の色だけをCSSで敷いている（星・雲・城の絵は素材が届いたら差し込む）
const CSS = `
.fq-root{min-height:100vh;min-height:100dvh;background:#151a3f;background-image:radial-gradient(ellipse at 50% -10%,#3a3f8f 0%,rgba(58,63,143,0) 55%),linear-gradient(180deg,#141838 0%,#1c2152 55%,#2a2a6a 100%);padding:16px 14px 28px;color:#fff;font-family:inherit;overflow-x:clip}
.fq-wrap{max-width:760px;margin:0 auto}
.fq-top{position:relative;display:flex;justify-content:center;align-items:center;min-height:70px;margin-bottom:10px}
.fq-back{position:absolute;left:0;top:50%;transform:translateY(-50%);width:52px;height:44px;border-radius:999px;border:1.5px solid #e2bf63;background:rgba(20,24,56,.7);color:#ffe9a8;font-size:20px;font-weight:900;cursor:pointer;font-family:inherit;z-index:2}
.fq-title{position:relative;width:min(100% - 124px,400px);container-type:inline-size}
.fq-title img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 14px rgba(0,0,0,.45))}
.fq-title h1{position:absolute;inset:0;margin:0;display:flex;align-items:center;justify-content:center;font-size:clamp(15px,7cqw,27px);font-weight:900;letter-spacing:.08em;text-shadow:0 2px 4px rgba(4,10,40,.7);white-space:nowrap}
.fq-h{margin:18px 0 10px;font-size:15px;font-weight:900;color:#f3e3b0;display:flex;align-items:center;gap:8px}
.fq-h.quill img{width:30px;height:30px;object-fit:contain}
.fq-any,.fq-person{width:100%;display:flex;align-items:center;gap:12px;text-align:left;cursor:pointer;font-family:inherit;color:#fff;border-radius:18px;border:1.5px solid rgba(190,200,255,.32);background:rgba(255,255,255,.06);padding:10px 16px;min-height:64px}
.fq-any{min-height:72px;padding:12px 18px}
.fq-any .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.fq-any b{font-size:17px;font-weight:900}
.fq-any small{font-size:12.5px;font-weight:700;color:#cfd4ff}
.fq-person b{flex:1;min-width:0;font-size:15px;font-weight:800;overflow-wrap:anywhere}
.fq-any.on,.fq-person.on{border:2px solid #f1d27a;background:linear-gradient(90deg,rgba(104,92,214,.9),rgba(86,78,190,.9));box-shadow:0 0 0 3px rgba(140,130,255,.28),0 8px 20px rgba(60,50,170,.4)}
.fq-radio{flex-shrink:0;width:24px;height:24px;border-radius:50%;border:2px solid rgba(215,220,255,.75);box-sizing:border-box;position:relative}
.on .fq-radio{border-color:#fff;background:#fff}
.on .fq-radio::after{content:"";position:absolute;left:7px;top:3px;width:6px;height:11px;border:solid #4338ca;border-width:0 3px 3px 0;transform:rotate(45deg)}
.fq-search{width:100%;box-sizing:border-box;margin:10px 0 8px;min-height:46px;padding:10px 18px;border-radius:999px;border:1.5px solid rgba(190,200,255,.32);background:rgba(255,255,255,.07);color:#fff;font-size:16px;font-family:inherit}
.fq-search::placeholder,.fq-ta::placeholder{color:#a9afd8}
.fq-list{display:grid;gap:7px;max-height:330px;overflow-y:auto;padding:2px 2px 4px;overscroll-behavior:contain}
.fq-none{font-size:13px;font-weight:700;color:#cfd4ff;padding:10px 6px}
.fq-ta{width:100%;box-sizing:border-box;min-height:112px;border-radius:16px;padding:14px 16px;background:rgba(255,255,255,.06);border:1.5px solid rgba(226,191,99,.75);color:#fff;font-size:16px;line-height:1.7;font-family:inherit;resize:vertical}
.fq-count{text-align:right;font-size:12px;font-weight:700;color:#cfd4ff;margin-top:4px}
.fq-err{width:min(100%,560px);box-sizing:border-box;margin:0 auto 8px;padding:10px 14px;border-radius:12px;background:#4a1f2e;border:1.5px solid rgba(248,113,113,.7);color:#fecaca;font-size:13.5px;font-weight:800}
.fq-sendbar{position:sticky;bottom:0;z-index:3;margin:14px -14px 0;padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:linear-gradient(180deg,rgba(28,33,82,0),rgba(28,33,82,.96) 35%)}
.fq-send{display:block;width:min(100%,560px);margin:0 auto;min-height:60px;padding:0 20px;border-radius:999px;border:2.5px solid #f1d27a;background:linear-gradient(90deg,#3f5fe0,#6a55e8 55%,#7c4fe6);box-shadow:inset 0 0 0 2px rgba(255,255,255,.22),0 10px 24px rgba(70,60,200,.5);color:#fff;font-size:17px;font-weight:900;letter-spacing:.04em;cursor:pointer;font-family:inherit}
.fq-send span{display:block;overflow-wrap:anywhere;line-height:1.3;padding:8px 0}
.fq-send:disabled{opacity:.6;cursor:default}
.fq-done{margin:70px auto 0;max-width:420px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px;padding:28px 18px;border-radius:22px;border:2px solid #f1d27a;background:rgba(255,255,255,.07)}
.fq-done img{width:84px;height:84px;object-fit:contain}
.fq-done b{font-size:18px;font-weight:900}
.fq-done span{font-size:13.5px;font-weight:700;color:#cfd4ff;line-height:1.7}
.fq-back:focus-visible,.fq-any:focus-visible,.fq-person:focus-visible,.fq-send:focus-visible,.fq-search:focus-visible,.fq-ta:focus-visible{outline:3px solid #fbbf24;outline-offset:2px}
@media (max-width:640px){
  .fq-list{max-height:min(300px,38vh)}
  .fq-any b{font-size:16px}
  .fq-title{width:min(100% - 116px,340px)}
}
`;

export default function FbRequestPage() {
    return <Suspense fallback={null}><FbInner /></Suspense>;
}
