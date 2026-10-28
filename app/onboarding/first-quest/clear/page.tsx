"use client";
// Intern Quest 2.0｜STEP 7「はじめての冒険」4/4：QUEST CLEAR（クリア演出）
// 3つのチュートリアルを達成した人だけ表示（未達成なら 2/4 へ戻す）。
// 報酬（EXP +100／P +50／宝石 ×1）は【表示のみ】。実際の付与はポイント監査完了＋承認後にサーバー側で実装する。
// 「HOMEへ進む」で onboarding_done を true にして /home へ（既存オンボーディングと同じ更新。他の列は触らない）。
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import AvatarLayered from "@/app/components/AvatarLayered";
import type { AvatarConfig } from "@/app/lib/avatar/catalog";
import { readTutorial, tutorialAllDone, clearTutorialReturn } from "@/app/lib/tutorial";
import { JOBS, type JobKey } from "../../job/page";

const STEPS = ["登録", "冒険者情報", "職業", "アバター", "確認", "ライセンス", "初回クエスト"];
const STEP_NOW = 6;
const LUKU = "/onboarding/ruku_quest_clear.png";

const CSS = `
.qc-root{min-height:100vh;min-height:100dvh;background:#7fc3ef url(/onboarding/confirm_pc.webp) center top/cover no-repeat fixed;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416;padding:14px 16px calc(16px + env(safe-area-inset-bottom));box-sizing:border-box;overflow-x:hidden}
.qc-top{display:flex;align-items:center;justify-content:center;gap:10px;max-width:1200px;margin:0 auto;flex-wrap:wrap}
.qc-prog{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.qc-prog span{font-size:11px;font-weight:800;color:#5a6b8c;background:rgba(255,255,255,.7);border-radius:999px;padding:4px 10px}
.qc-prog span.on{color:#fff;background:linear-gradient(180deg,#4d9af5,#2458c7)}.qc-prog span.done{color:#1d3f8c;background:#dbe8ff}
.qc-step{display:inline-flex;align-items:center;gap:10px;margin:14px 0 0;background:linear-gradient(180deg,#5a3d12,#3b2708);border:2px solid #e8c45a;border-radius:14px;padding:8px 18px 8px 12px;box-shadow:0 0 0 3px rgba(255,255,255,.45),0 10px 22px rgba(30,60,120,.25)}
.qc-step b{font-size:15px;font-weight:900;color:#ffe7a3;letter-spacing:.08em}.qc-step span{font-size:16px;font-weight:900;color:#fff}
.qc-step em{font-style:normal;font-size:13px;font-weight:900;color:#1d3f8c;background:#fff;border-radius:999px;padding:3px 10px}
.qc-wrap{position:relative;max-width:1200px;margin:10px auto 0;display:grid;grid-template-columns:minmax(200px,300px) minmax(320px,640px) minmax(200px,300px);gap:12px;align-items:end;justify-content:center}
.qc-side{display:flex;align-items:flex-end;justify-content:center;position:relative}
.qc-side .shadow{position:absolute;left:50%;bottom:2%;transform:translateX(-50%);width:70%;height:7%;border-radius:50%;background:radial-gradient(ellipse,rgba(30,60,120,.28),rgba(30,60,120,0) 70%)}
.qc-avatar{width:100%;max-width:300px;animation:qc-fade .7s ease-out .3s both}
.qc-luku{width:100%;max-width:300px;position:relative;animation:qc-fade .7s ease-out .5s both}
.qc-luku img{width:100%;height:auto;display:block;animation:qc-bob 2.2s ease-in-out infinite}
.qc-center{display:flex;flex-direction:column;align-items:center;gap:16px}
.qc-title{position:relative;background:linear-gradient(180deg,#4d9af5,#2458c7);border:3px solid #e8c45a;border-radius:18px;padding:12px 44px;box-shadow:0 8px 20px rgba(36,88,199,.4);animation:qc-pop .6s cubic-bezier(.2,.9,.3,1.3) both}
.qc-title b{white-space:nowrap;font-size:clamp(28px,4.2vw,54px);font-weight:900;color:#ffe08a;letter-spacing:.04em;text-shadow:0 2px 0 #b8841a,0 4px 10px rgba(0,0,0,.25);font-family:Impact,"Arial Black",system-ui,sans-serif;font-style:italic}
.qc-title::before,.qc-title::after{content:"✦";position:absolute;top:50%;transform:translateY(-50%);color:#ffe08a;font-size:22px}
.qc-title::before{left:12px}.qc-title::after{right:12px}
.qc-panel{width:100%;background:linear-gradient(180deg,#fffdf4,#f6ead0);border:3px solid #d8b55e;border-radius:24px;padding:22px 24px 20px;box-shadow:0 0 0 4px rgba(255,255,255,.5),0 14px 30px rgba(30,60,120,.25);animation:qc-pop .5s cubic-bezier(.2,.9,.3,1.2) .25s both;text-align:center}
.qc-panel h2{margin:0 0 14px;font-size:clamp(17px,2vw,24px);font-weight:900;color:#2b2416}
.qc-rlab{display:inline-block;background:linear-gradient(180deg,#5a3d12,#3b2708);color:#ffe7a3;font-weight:900;font-size:15px;border:2px solid #e8c45a;border-radius:999px;padding:5px 22px;margin-bottom:-14px;position:relative;z-index:1}
.qc-rewards{display:grid;grid-template-columns:repeat(3,1fr);background:#fffffb;border:2px solid #e7dcc0;border-radius:18px;padding:26px 10px 14px}
.qc-rw{display:flex;flex-direction:column;align-items:center;gap:6px;border-right:2px solid #eadfc6}
.qc-rw:last-child{border-right:0}
.qc-ic{width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;color:#fff;box-shadow:0 3px 8px rgba(0,0,0,.2)}
.qc-ic.exp{background:radial-gradient(circle at 35% 30%,#8fe28c,#2a9d3c 70%);border:3px solid #cdeec9}
.qc-ic.pt{background:radial-gradient(circle at 35% 30%,#ffe27a,#e3a300 70%);border:3px solid #ffeeb0;color:#7a4e05}
.qc-ic.gem{background:radial-gradient(circle at 35% 30%,#d9b8ff,#7a3fe0 70%);border:3px solid #e9dcff;font-size:26px}
.qc-rw b{font-size:clamp(22px,2.4vw,30px);font-weight:900;color:#2b2416}
.qc-note{font-size:11.5px;font-weight:800;color:#8a6a2b;margin-top:10px}
.qc-next{width:100%;max-width:560px;height:64px;border-radius:999px;border:3px solid #e8c45a;font-family:inherit;font-weight:900;font-size:22px;letter-spacing:.06em;color:#fff;cursor:pointer;background:linear-gradient(180deg,#4d9af5 0%,#2f6fd6 50%,#1d4fb3 100%);box-shadow:0 0 0 2px #fff6d0,0 10px 22px rgba(36,88,199,.4);animation:qc-fade .5s ease-out .7s both}
.qc-next:disabled{opacity:.6;cursor:default}
.qc-msg{font-size:13px;font-weight:800;border-radius:10px;padding:8px 12px;text-align:center;color:#991b1b;background:#fee2e2}
.qc-load{min-height:50vh;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;text-shadow:0 2px 6px rgba(0,0,0,.4)}
.qc-spark{position:absolute;pointer-events:none;color:#fff3b0;text-shadow:0 0 10px #ffd34d;animation:qc-spark 1.8s ease-in-out infinite}
@keyframes qc-fade{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes qc-pop{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
@keyframes qc-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes qc-spark{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
@media (prefers-reduced-motion:reduce){.qc-avatar,.qc-luku,.qc-luku img,.qc-title,.qc-panel,.qc-next,.qc-spark{animation:none}}
@media (max-width:860px){
  .qc-root{background-image:url(/onboarding/confirm_mobile.webp)}
  .qc-wrap{grid-template-columns:1fr 1fr;grid-template-areas:"center center" "avatar luku";gap:10px;margin-top:8px}
  .qc-center{grid-area:center}
  .qc-side.a{grid-area:avatar}.qc-side.l{grid-area:luku}
  .qc-avatar,.qc-luku{max-width:170px}
  .qc-title{padding:10px 30px}
  .qc-panel{padding:18px 14px 16px}
  .qc-rewards{padding:22px 4px 12px}
  .qc-ic{width:50px;height:50px;font-size:14px}
  .qc-next{height:58px;font-size:19px}
}
`;

export default function FirstQuestClearPage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
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
                if (!tutorialAllDone(readTutorial(user.id))) { router.push("/onboarding/first-quest/quests"); return; }
                clearTutorialReturn(user.id);
                const { data } = await supabase.from("profiles").select("job_class, avatar_config").eq("id", user.id).single();
                const j = (data as any)?.job_class as JobKey;
                if (j && JOBS.some((x) => x.key === j) && (data as any)?.avatar_config?.type === "layered") { setJob(j); setCfg((data as any).avatar_config); }
                setUserId(user.id);
            } catch (e: any) { setMsg("情報の読み込みに失敗しました（" + (e?.message || e) + "）"); }
        })();
        const im = new Image(); im.onload = () => setHasLuku(true); im.onerror = () => setHasLuku(false); im.src = LUKU;
    }, [router]);

    const goHome = async () => {
        if (!userId || going) return;
        setGoing(true);
        // 既存オンボーディング（/onboarding）の完了処理と同じ更新。EXP・ポイント等は変更しない
        const { error } = await supabase.from("profiles").update({ onboarding_done: true }).eq("id", userId);
        if (error) { setMsg("完了の保存に失敗しました。もう一度お試しください（" + error.message + "）"); setGoing(false); return; }
        router.push("/home");
    };

    return (
        <>
            <style>{CSS}</style>
            <main className="qc-root">
                <div className="qc-top"><div className="qc-prog">{STEPS.map((s, i) => <span key={s} className={i === STEP_NOW ? "on" : i < STEP_NOW ? "done" : ""}>{i + 1}. {s}</span>)}</div></div>
                <div><div className="qc-step"><b>STEP 7</b><span>はじめての冒険</span><em>4 / 4</em></div></div>
                {msg && <div style={{ maxWidth: 560, margin: "12px auto 0" }}><div className="qc-msg">{msg}</div></div>}
                {!userId && !msg && <div className="qc-load">読み込み中…</div>}
                {userId && (
                    <div className="qc-wrap">
                        <div className="qc-side a">
                            <div className="shadow" />
                            {cfg && job && <div className="qc-avatar"><AvatarLayered config={cfg} job={job} /></div>}
                        </div>
                        <div className="qc-center">
                            <div className="qc-title"><b>QUEST CLEAR!</b></div>
                            <section className="qc-panel" aria-label="クリア報酬">
                                <h2>はじめてのクエストをクリアしました！</h2>
                                <div className="qc-rlab">クリア報酬</div>
                                <div className="qc-rewards">
                                    <div className="qc-rw"><div className="qc-ic exp">EXP</div><b>+100</b></div>
                                    <div className="qc-rw"><div className="qc-ic pt">P</div><b>+50</b></div>
                                    <div className="qc-rw"><div className="qc-ic gem">◆</div><b>×1</b></div>
                                </div>
                                <div className="qc-note">報酬は準備中です（付与の仕組みができ次第、まとめて反映します）</div>
                            </section>
                            <button className="qc-next" type="button" disabled={going} onClick={goHome}>{going ? "移動中…" : "HOMEへ進む →"}</button>
                        </div>
                        <div className="qc-side l">
                            <div className="shadow" />
                            {hasLuku && <div className="qc-luku"><img src={LUKU} alt="ルク" /></div>}
                        </div>
                        {["8%:12%", "92%:18%", "14%:70%", "88%:66%", "50%:4%"].map((p, i) => { const [l, t] = p.split(":"); return <span key={i} className="qc-spark" style={{ left: l, top: t, fontSize: 18 + (i % 3) * 6, animationDelay: `${i * 0.3}s` }}>✦</span>; })}
                    </div>
                )}
            </main>
        </>
    );
}
