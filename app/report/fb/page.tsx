"use client";
// FBリクエスト（日報のFBをメンターにお願いする）。送信・通知・日報との紐付けは従来のまま、見た目だけを HOME と同じ天空王国デザイン（白×ロイヤルブルー×金）に変更。
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
                <button className="fq-back" onClick={() => router.back()} aria-label="戻る">←</button>
                <div className="fq-panel">
                <div className="fq-title"><img src="/home/title_plate.webp" alt="" /><h1><img src="/fb/icon_letter.webp" alt="" />FBリクエスト</h1></div>
                {done ? (
                    <div className="fq-done" role="status">
                        <img src="/fb/icon_letter.webp" alt="" />
                        <b>{pickedName ? `${pickedName}さんに届けました` : "メンターに届けました"}</b>
                        <span>相手に通知を送りました。返事が来たら通知でお知らせします</span>
                    </div>
                ) : (
                    <>
                        <h2 className="fq-h">誰にお願いしますか？</h2>
                        <div role="radiogroup" aria-label="FBをお願いする相手">
                            <button type="button" role="radio" aria-checked={pick === "any"} className={"fq-any" + (pick === "any" ? " on" : "")} onClick={() => setPick("any")}>
                                <img className="ic" src="/fb/icon_dice.webp" alt="" />
                                <span className="tx"><b>おまかせ</b><small>手の空いているメンターにお願いする</small></span>
                                <i className="fq-radio" aria-hidden />
                            </button>
                            <div className="fq-searchbox"><img src="/fb/icon_search.webp" alt="" /><input className="fq-search" value={q} onChange={e => setQ(e.target.value)} placeholder="名前で探す" aria-label="メンターを名前で探す" /></div>
                            <div className="fq-list">
                                {shown.map(p => (
                                    <button type="button" key={p.id} role="radio" aria-checked={pick === p.id} className={"fq-person" + (pick === p.id ? " on" : "")} onClick={() => setPick(p.id)}>
                                        <AvatarFace src={p.face} size={48} border="2.5px solid #e2bf63" />
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
                                {sending ? <i className="fq-spin" aria-hidden /> : <img src="/fb/icon_send.webp" alt="" />}<span>{sending ? "送信中..." : pickedName ? `${pickedName}さんにFBをお願いする` : "FBをお願いする"}</span>
                            </button>
                        </div>
                    </>
                )}
                </div>
            </div>
            <style>{CSS}</style>
        </div>
    );
}

const CSS = `
.fq-root{min-height:100vh;min-height:100dvh;background:#cfe6ff url(/home/bg_mobile.webp) center top/cover fixed;padding:12px 8px 20px;color:#17307a;font-family:inherit;overflow-x:clip}
@media (min-width:700px){ .fq-root{background-image:url(/home/bg_pc.webp);padding:20px 16px 32px} }
.fq-wrap{position:relative;max-width:1010px;margin:0 auto;display:flow-root}
.fq-back{position:absolute;left:0;top:0;width:60px;height:46px;border-radius:999px;border:2.5px solid #c9a94e;background:linear-gradient(180deg,#fffdf6,#f3e6c4);color:#7a5a12;font-size:22px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 4px 10px rgba(16,47,112,.25);z-index:3}
.fq-back:active{transform:translateY(1px)}
.fq-panel{margin:34px auto 0;max-width:820px;background:linear-gradient(180deg,#fffdf6,#fbf3df);border:4px solid #e2bf63;border-radius:34px;box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 4px rgba(226,191,99,.45),0 16px 36px rgba(16,47,112,.32);padding:0 34px 22px}
.fq-title{position:relative;width:min(100%,430px);margin:-34px auto 0;container-type:inline-size}
.fq-title img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 12px rgba(16,47,112,.35))}
.fq-title h1{position:absolute;inset:0;margin:0;display:flex;align-items:center;justify-content:center;gap:.4em;color:#fff;font-size:clamp(16px,7cqw,29px);font-weight:900;letter-spacing:.08em;text-shadow:0 2px 4px rgba(4,10,40,.6);white-space:nowrap}
.fq-title h1 img{position:static;width:1.5em;height:auto;filter:drop-shadow(0 2px 3px rgba(4,10,40,.5))}
.fq-any .ic{width:46px;height:46px;object-fit:contain;flex-shrink:0}
.fq-searchbox{position:relative;margin:12px 0 8px}
.fq-searchbox img{position:absolute;left:16px;top:50%;transform:translateY(-50%);width:22px;height:22px;object-fit:contain;pointer-events:none}
.fq-send img{width:30px;height:30px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 2px 2px rgba(4,10,40,.4))}
.fq-h{margin:16px 0 10px;font-size:16px;font-weight:900;color:#17307a;display:flex;align-items:center;gap:8px}
.fq-h.quill img{width:32px;height:32px;object-fit:contain}
.fq-any,.fq-person{width:100%;display:flex;align-items:center;gap:14px;text-align:left;cursor:pointer;font-family:inherit;color:#17307a;border-radius:999px;border:2px solid rgba(201,169,78,.55);background:linear-gradient(180deg,#fffefb,#f8efd9);padding:6px 20px 6px 10px;min-height:60px;box-shadow:0 2px 5px rgba(120,90,30,.12)}
.fq-any{border-radius:22px;min-height:74px;padding:12px 22px}
.fq-any .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.fq-any b{font-size:18px;font-weight:900}
.fq-any small{font-size:13px;font-weight:700;color:#3a4a75}
.fq-person b{flex:1;min-width:0;font-size:16px;font-weight:900;overflow-wrap:anywhere}
.fq-any.on,.fq-person.on{border:2.5px solid #e2bf63;background:linear-gradient(180deg,#c9dcff,#a9c4f8);box-shadow:inset 0 0 0 2px rgba(255,255,255,.7),0 4px 12px rgba(42,91,214,.28)}
.fq-any:active,.fq-person:active{transform:translateY(1px)}
.fq-radio{flex-shrink:0;width:28px;height:28px;border-radius:50%;border:2.5px solid #9aa3bd;background:#fff;box-sizing:border-box;position:relative}
.on .fq-radio{border-color:#fff;background:linear-gradient(180deg,#3f7bf0,#1f4fc8);box-shadow:0 2px 5px rgba(31,79,200,.4)}
.on .fq-radio::after{content:"";position:absolute;left:8px;top:3px;width:6px;height:12px;border:solid #fff;border-width:0 3px 3px 0;transform:rotate(45deg)}
.fq-search{width:100%;box-sizing:border-box;margin:0;min-height:48px;padding:10px 20px 10px 48px;border-radius:999px;border:2px solid rgba(201,169,78,.6);background:#fffefb;color:#17307a;font-size:16px;font-weight:700;font-family:inherit;box-shadow:inset 0 2px 4px rgba(120,90,30,.1)}
.fq-search::placeholder,.fq-ta::placeholder{color:#8a8fa6;font-weight:600}
.fq-list{display:grid;gap:7px;max-height:336px;overflow-y:auto;padding:2px 4px 4px 2px;overscroll-behavior:contain}
.fq-none{font-size:13.5px;font-weight:700;color:#3a4a75;padding:10px 8px}
.fq-ta{width:100%;box-sizing:border-box;min-height:112px;border-radius:18px;padding:14px 18px;background:#fffefb;border:2px solid rgba(201,169,78,.7);color:#17307a;font-size:16px;line-height:1.7;font-family:inherit;resize:vertical;box-shadow:inset 0 2px 4px rgba(120,90,30,.1)}
.fq-count{text-align:right;font-size:12.5px;font-weight:800;color:#5a6488;margin-top:4px}
.fq-err{width:min(100%,600px);box-sizing:border-box;margin:0 auto 8px;padding:10px 14px;border-radius:12px;background:#fdecec;border:2px solid #e58a8a;color:#a11d1d;font-size:13.5px;font-weight:800}
.fq-sendbar{margin:14px 0 0;padding:0 0 env(safe-area-inset-bottom)}
.fq-send{display:flex;align-items:center;justify-content:center;gap:10px;width:min(100%,600px);margin:0 auto;min-height:64px;padding:0 22px;border-radius:999px;border:3.5px solid #e2bf63;background:linear-gradient(180deg,#3f6fe0,#1c3fa8);box-shadow:inset 0 0 0 2px rgba(255,255,255,.35),inset 0 -6px 10px rgba(8,24,90,.35),0 8px 18px rgba(16,47,112,.4);color:#fff;font-size:19px;font-weight:900;letter-spacing:.06em;cursor:pointer;font-family:inherit;text-shadow:0 2px 3px rgba(4,10,40,.5);transition:transform .08s,filter .08s}
.fq-send span{overflow-wrap:anywhere;line-height:1.3;padding:8px 0}
.fq-send:active:not(:disabled){transform:translateY(2px) scale(.985);filter:brightness(.95)}
.fq-send:disabled{opacity:.7;cursor:default}
.fq-spin{flex-shrink:0;width:20px;height:20px;border-radius:50%;border:3px solid rgba(255,255,255,.4);border-top-color:#fff;animation:fq-rot .8s linear infinite}
@keyframes fq-rot{to{transform:rotate(360deg)}}
.fq-done{margin:26px auto 10px;max-width:440px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px;padding:26px 18px;border-radius:22px;border:2px solid #e2bf63;background:#fffefb}
.fq-done img{width:84px;height:84px;object-fit:contain}
.fq-done b{font-size:19px;font-weight:900}
.fq-done span{font-size:13.5px;font-weight:700;color:#3a4a75;line-height:1.7}
.fq-back:focus-visible,.fq-any:focus-visible,.fq-person:focus-visible,.fq-send:focus-visible,.fq-search:focus-visible,.fq-ta:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}
@media (prefers-reduced-motion:reduce){ .fq-spin{animation-duration:2s} .fq-send{transition:none} }
@media (max-width:1009px){ .fq-panel{margin-top:86px} }
@media (max-width:640px){
  .fq-back{width:52px;height:42px;font-size:20px}
  .fq-panel{margin-top:84px;padding:0 12px 16px;border-width:3px;border-radius:26px}
  .fq-title{width:min(100%,330px);margin-top:-30px}
  .fq-list{max-height:min(300px,36vh)}
  .fq-any{padding:10px 16px;min-height:68px}
  .fq-any b{font-size:17px}
  .fq-person{padding:5px 14px 5px 8px;min-height:58px}
  .fq-send{font-size:17px;min-height:60px}
}
`;

export default function FbRequestPage() {
    return <Suspense fallback={null}><FbInner /></Suspense>;
}
