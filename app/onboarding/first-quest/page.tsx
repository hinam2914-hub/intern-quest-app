"use client";
// Intern Quest 2.0｜STEP 7「はじめての冒険」導入画面（1/4）
// ライセンス → この画面 → （2/4 以降は未実装。当面は既存のオンボーディング /onboarding へ）
// 背景は確認画面と同じ広場（/onboarding/confirm_*.webp）。アバターは保存済み avatar_config を表示。
// 案内役ルクの透過素材は未納品のため、枠だけ用意し何も描かない（代替キャラは出さない）。保存処理なし。
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import AvatarLayered from "@/app/components/AvatarLayered";
import type { AvatarConfig } from "@/app/lib/avatar/catalog";
import { JOBS, type JobKey } from "../job/page";

const STEPS = ["登録", "冒険者情報", "職業", "アバター", "確認", "ライセンス", "初回クエスト"];
const STEP_NOW = 6;
const TUTORIAL_TOTAL = 4;
const TUTORIAL_NOW = 1;
const LUKU_SRC = "/onboarding/luku.png";   // 透過 PNG が届いたらここに置く（未納品の間は非表示）

const CSS = `
.fq-root{min-height:100vh;min-height:100dvh;background:#7fc3ef url(/onboarding/confirm_pc.webp) center top/cover no-repeat fixed;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416;padding:14px 16px calc(16px + env(safe-area-inset-bottom));box-sizing:border-box;overflow-x:hidden}
.fq-top{display:flex;align-items:center;justify-content:space-between;gap:10px;max-width:1200px;margin:0 auto;flex-wrap:wrap}
.fq-prog{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.fq-prog span{font-size:11px;font-weight:800;color:#5a6b8c;background:rgba(255,255,255,.7);border-radius:999px;padding:4px 10px}
.fq-prog span.on{color:#fff;background:linear-gradient(180deg,#4d9af5,#2458c7)}.fq-prog span.done{color:#1d3f8c;background:#dbe8ff}
.fq-step{display:inline-flex;align-items:center;gap:10px;margin:14px 0 0;background:linear-gradient(180deg,#5a3d12,#3b2708);border:2px solid #e8c45a;border-radius:14px;padding:8px 18px 8px 12px;box-shadow:0 0 0 3px rgba(255,255,255,.45),0 10px 22px rgba(30,60,120,.25)}
.fq-step b{font-size:15px;font-weight:900;color:#ffe7a3;letter-spacing:.08em}
.fq-step span{font-size:16px;font-weight:900;color:#fff}
.fq-step em{font-style:normal;font-size:13px;font-weight:900;color:#1d3f8c;background:#fff;border-radius:999px;padding:3px 10px}
.fq-wrap{display:grid;grid-template-columns:minmax(300px,520px) minmax(320px,1fr);gap:20px;max-width:1200px;margin:12px auto 0;align-items:end;min-height:min(70vh,640px)}
.fq-chars{position:relative;display:flex;align-items:flex-end;justify-content:center;gap:0;min-height:420px}
.fq-avatar{width:min(360px,62%);animation:fq-fade .7s ease-out both}
.fq-luku{width:min(190px,34%);aspect-ratio:1;margin-left:-6%;display:flex;align-items:flex-end;justify-content:center;animation:fq-fade .7s ease-out .2s both}
.fq-luku img{width:100%;height:auto;display:block;animation:fq-bob 2.4s ease-in-out infinite}
.fq-plate{position:absolute;left:50%;bottom:-2%;transform:translateX(-50%);width:80%;height:8%;border-radius:50%;background:radial-gradient(ellipse,rgba(30,60,120,.35),rgba(30,60,120,0) 70%);z-index:-1}
.fq-right{display:flex;flex-direction:column;gap:22px;align-self:center}
.fq-talk{position:relative;background:linear-gradient(180deg,#fffdf4,#f6ead0);border:3px solid #d8b55e;border-radius:28px;padding:44px 34px 26px;box-shadow:0 0 0 4px rgba(255,255,255,.5),0 14px 30px rgba(30,60,120,.25);animation:fq-pop .5s cubic-bezier(.2,.9,.3,1.2) .35s both}
.fq-talk::before{content:"";position:absolute;left:-26px;bottom:38px;border:16px solid transparent;border-right-color:#d8b55e;border-left:0}
.fq-talk::after{content:"";position:absolute;left:-19px;bottom:41px;border:13px solid transparent;border-right-color:#f9efd8;border-left:0}
.fq-name{position:absolute;left:28px;top:-20px;background:linear-gradient(180deg,#4d9af5,#2458c7);color:#fff;font-weight:900;font-size:17px;letter-spacing:.1em;border:2px solid #e8c45a;border-radius:999px;padding:6px 26px;box-shadow:0 4px 10px rgba(36,88,199,.35)}
.fq-text{margin:0;font-size:clamp(17px,1.6vw,22px);font-weight:900;color:#5a3d12;line-height:1.75;text-align:center;white-space:pre-line}
.fq-rule{margin:16px auto 0;width:40%;height:2px;background:linear-gradient(90deg,transparent,#d8b55e,transparent)}
.fq-next{width:100%;height:64px;border-radius:999px;border:3px solid #e8c45a;font-family:inherit;font-weight:900;font-size:20px;letter-spacing:.06em;color:#fff;cursor:pointer;background:linear-gradient(180deg,#4d9af5 0%,#2f6fd6 50%,#1d4fb3 100%);box-shadow:0 0 0 2px #fff6d0,0 10px 22px rgba(36,88,199,.4);animation:fq-fade .5s ease-out .6s both}
.fq-next:disabled{opacity:.6;cursor:default}
.fq-msg{font-size:13px;font-weight:800;border-radius:10px;padding:8px 12px;text-align:center;color:#991b1b;background:#fee2e2;max-width:560px;margin:12px auto 0}
.fq-load{min-height:50vh;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;text-shadow:0 2px 6px rgba(0,0,0,.4)}
@keyframes fq-fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes fq-pop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
@keyframes fq-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@media (prefers-reduced-motion:reduce){.fq-avatar,.fq-luku,.fq-luku img,.fq-talk,.fq-next{animation:none}}
@media (max-width:860px){
  .fq-root{background-image:url(/onboarding/confirm_mobile.webp)}
  .fq-wrap{grid-template-columns:1fr;gap:14px;min-height:0;margin-top:8px}
  .fq-chars{min-height:0;order:1}
  .fq-avatar{width:min(240px,52%)}
  .fq-luku{width:min(130px,30%)}
  .fq-right{order:2;gap:14px}
  .fq-talk{padding:34px 20px 20px;border-radius:22px}
  .fq-talk::before{left:50%;bottom:auto;top:-26px;margin-left:-16px;border:16px solid transparent;border-bottom-color:#d8b55e;border-top:0}
  .fq-talk::after{left:50%;bottom:auto;top:-19px;margin-left:-13px;border:13px solid transparent;border-bottom-color:#fff9e8;border-top:0}
  .fq-name{left:50%;transform:translateX(-50%);top:-18px;font-size:15px}
  .fq-text{font-size:16px;line-height:1.7}
  .fq-next{height:58px;font-size:18px}
}
`;

const LINES = "冒険者登録おめでとう！\nこれから、Intern Questの世界を\n一緒に冒険しながら、\n使い方を覚えていこう！";

export default function FirstQuestIntroPage() {
    const router = useRouter();
    const [cfg, setCfg] = useState<AvatarConfig | null>(null);
    const [job, setJob] = useState<JobKey | null>(null);
    const [hasLuku, setHasLuku] = useState(false);
    const [msg, setMsg] = useState("");
    const [going, setGoing] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) { router.push("/login"); return; }
                const { data, error } = await supabase.from("profiles").select("job_class, avatar_config").eq("id", user.id).single();
                if (error || !data) { setMsg("情報の読み込みに失敗しました。再読み込みしてください。"); return; }
                const j = (data as any).job_class as JobKey;
                if (!j || !JOBS.some((x) => x.key === j)) { router.push("/onboarding/job"); return; }
                const c = (data as any).avatar_config;
                if (c?.type !== "layered") { router.push("/onboarding/avatar"); return; }
                setJob(j); setCfg(c as AvatarConfig);
            } catch (e: any) { setMsg("情報の読み込みに失敗しました（" + (e?.message || e) + "）"); }
        })();
        // ルクの素材があるときだけ表示（未納品なら枠を空けておく）
        const im = new Image(); im.onload = () => setHasLuku(true); im.onerror = () => setHasLuku(false); im.src = LUKU_SRC;
    }, [router]);

    const jobInfo = useMemo(() => JOBS.find((j) => j.key === job), [job]);

    const next = () => {
        if (going) return;
        setGoing(true);
        // 2/4 以降は未実装。未完成画面へは遷移させず、既存のオンボーディング（使い方説明）へ
        router.push("/onboarding");
    };

    return (
        <>
            <style>{CSS}</style>
            <main className="fq-root">
                <div className="fq-top">
                    <div className="fq-prog">{STEPS.map((s, i) => <span key={s} className={i === STEP_NOW ? "on" : i < STEP_NOW ? "done" : ""}>{i + 1}. {s}</span>)}</div>
                </div>
                <div><div className="fq-step"><b>STEP 7</b><span>はじめての冒険</span><em>{TUTORIAL_NOW} / {TUTORIAL_TOTAL}</em></div></div>
                {msg && <div className="fq-msg">{msg}</div>}
                {!cfg && !msg && <div className="fq-load">読み込み中…</div>}
                {cfg && job && (
                    <div className="fq-wrap">
                        <section className="fq-chars" aria-label={`${jobInfo?.name}のアバターと案内役ルク`}>
                            <div className="fq-avatar"><AvatarLayered config={cfg} job={job} /></div>
                            <div className="fq-luku" aria-hidden={!hasLuku}>{hasLuku && <img src={LUKU_SRC} alt="ルク" />}</div>
                            <div className="fq-plate" />
                        </section>
                        <section className="fq-right">
                            <div className="fq-talk" role="dialog" aria-label="ルクの会話">
                                <div className="fq-name">ルク</div>
                                <p className="fq-text">{LINES}</p>
                                <div className="fq-rule" />
                            </div>
                            <button className="fq-next" type="button" disabled={going} onClick={next}>{going ? "移動中…" : "はじめてのクエストに進む →"}</button>
                        </section>
                    </div>
                )}
            </main>
        </>
    );
}
