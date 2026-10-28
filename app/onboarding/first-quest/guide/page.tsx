"use client";
// Intern Quest 2.0｜STEP 7「はじめての冒険」3/4：ルクの案内（3機能の紹介 → 実画面へ）
// 「◯◯を開く」で実画面へ移動。達成判定は実画面側の <TutorialMark> が記録（2/4 と同じ localStorage を共有）。
// 移動前に「戻り先」フラグを立てるので、実画面にはルクの小さなパネル（戻る）が出る。通常利用時は出ない。
// 3つ達成で 4/4 へ進める（4/4 は未実装のため当面は既存オンボーディングへ）。
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { readTutorial, setTutorialReturn, tutorialAllDone, type TutorialKey, type TutorialProgress } from "@/app/lib/tutorial";

const STEPS = ["登録", "冒険者情報", "職業", "アバター", "確認", "ライセンス", "初回クエスト"];
const STEP_NOW = 6;
const HERE = "/onboarding/first-quest/guide";

// カード画像：専用素材（public/onboarding/guide-*.png）があればそれを使い、無ければ既存のアプリ素材で代用
const CARDS: { key: TutorialKey; head: string; img: string; fallback: string; fit: "cover" | "contain"; body: string; btn: string; href: string }[] = [
    { key: "home", head: "① HOMEを探検", img: "/onboarding/guide-home.png", fallback: "/island_bg.png", fit: "cover", body: "下の「HOME」をタップ！\nホームには、クエストや\n成長状況がまとまっているよ！", btn: "HOMEを開く →", href: "/home" },
    { key: "skill", head: "② SKILL WORLDを開く", img: "/onboarding/guide-skill.png", fallback: "/world/start_village.png", fit: "contain", body: "「SKILL WORLD」をタップ！\n5つのエリアで、\n30のスキルを学べるよ！", btn: "SKILL WORLDを開く →", href: "/skill-board" },
    { key: "quest", head: "③ 今日のクエストを確認", img: "/onboarding/guide-quest.png", fallback: "/island/quest_btn.png", fit: "contain", body: "「クエスト」をタップ！\n今取り組めるクエストが\n一覧で確認できるよ！", btn: "クエストを開く →", href: "/today-schedule" },
];

const CSS = `
.g3-root{min-height:100vh;min-height:100dvh;background:#7fc3ef url(/onboarding/confirm_pc.webp) center top/cover no-repeat fixed;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416;padding:14px 16px calc(16px + env(safe-area-inset-bottom));box-sizing:border-box;overflow-x:hidden}
.g3-top{display:flex;align-items:center;justify-content:space-between;gap:10px;max-width:1200px;margin:0 auto;flex-wrap:wrap}
.g3-prog{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.g3-prog span{font-size:11px;font-weight:800;color:#5a6b8c;background:rgba(255,255,255,.7);border-radius:999px;padding:4px 10px}
.g3-prog span.on{color:#fff;background:linear-gradient(180deg,#4d9af5,#2458c7)}.g3-prog span.done{color:#1d3f8c;background:#dbe8ff}
.g3-back{border:2px solid #fff;background:rgba(255,255,255,.75);color:#1d3f8c;font-weight:900;border-radius:999px;padding:8px 16px;cursor:pointer;font-family:inherit;font-size:13px}
.g3-step{display:inline-flex;align-items:center;gap:10px;margin:14px 0 0;background:linear-gradient(180deg,#5a3d12,#3b2708);border:2px solid #e8c45a;border-radius:14px;padding:8px 18px 8px 12px;box-shadow:0 0 0 3px rgba(255,255,255,.45),0 10px 22px rgba(30,60,120,.25)}
.g3-step b{font-size:15px;font-weight:900;color:#ffe7a3;letter-spacing:.08em}.g3-step span{font-size:16px;font-weight:900;color:#fff}
.g3-step em{font-style:normal;font-size:13px;font-weight:900;color:#1d3f8c;background:#fff;border-radius:999px;padding:3px 10px}
.g3-msg{display:block;margin:14px auto 0;max-width:720px;text-align:center;background:linear-gradient(180deg,#fffdf4,#f6ead0);border:2px solid #d8b55e;border-radius:999px;padding:10px 24px;font-size:clamp(15px,1.7vw,21px);font-weight:900;color:#5a3d12;box-shadow:0 0 0 3px rgba(255,255,255,.5),0 10px 22px rgba(30,60,120,.22)}
.g3-board{max-width:1200px;margin:16px auto 0;background:linear-gradient(180deg,#fffdf4,#f6ead0);border:3px solid #d8b55e;border-radius:26px;padding:34px 22px 22px;box-shadow:0 0 0 4px rgba(255,255,255,.5),0 14px 30px rgba(30,60,120,.25)}
.g3-cards{display:grid;grid-template-columns:1fr 34px 1fr 34px 1fr;gap:10px;align-items:stretch}
.g3-arrow{display:flex;align-items:center;justify-content:center;color:#e8b43a;font-size:30px;font-weight:900;text-shadow:0 2px 0 #b8841a}
.g3-card{display:flex;flex-direction:column;align-items:center;gap:12px;min-width:0}
.g3-head{background:linear-gradient(180deg,#4d9af5,#2458c7);color:#fff;font-weight:900;font-size:clamp(15px,1.5vw,20px);border:3px solid #e8c45a;border-radius:999px;padding:7px 22px;box-shadow:0 5px 12px rgba(36,88,199,.3);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.g3-shot{width:100%;aspect-ratio:4/3;border-radius:18px;border:3px solid #e8c45a;overflow:hidden;background:linear-gradient(180deg,#bfe3ff,#8ec5f0);display:flex;align-items:center;justify-content:center;position:relative;box-shadow:0 6px 14px rgba(30,60,120,.2)}
.g3-shot img{width:100%;height:100%;object-fit:cover;display:block}
.g3-shot img.contain{object-fit:contain;padding:8%;box-sizing:border-box}
.g3-shot .qtxt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-weight:900;text-shadow:0 2px 4px rgba(150,90,20,.7);pointer-events:none}
.g3-shot .qtxt b{font-size:clamp(12px,1.3vw,16px)}.g3-shot .qtxt em{font-style:normal;font-size:clamp(28px,3.4vw,44px);line-height:1.1}
.g3-done{position:absolute;top:8px;right:8px;background:linear-gradient(180deg,#4bd37b,#1f9e4e);color:#fff;font-weight:900;font-size:12px;border-radius:999px;padding:4px 10px;border:2px solid #fff}
.g3-body{margin:0;text-align:center;font-size:clamp(14px,1.35vw,18px);font-weight:900;color:#2b2416;line-height:1.65;white-space:pre-line}
.g3-btn{margin-top:auto;width:100%;height:50px;border-radius:999px;border:2px solid #e8c45a;font-family:inherit;font-weight:900;font-size:15px;color:#fff;cursor:pointer;background:linear-gradient(180deg,#4d9af5 0%,#2f6fd6 50%,#1d4fb3 100%);box-shadow:0 0 0 2px #fff6d0,0 8px 18px rgba(36,88,199,.35)}
.g3-btn.done{background:linear-gradient(180deg,#4bd37b,#1f9e4e);border-color:#9fd7a8}
.g3-foot{display:flex;flex-direction:column;gap:8px;margin-top:20px;align-items:center}
.g3-note{font-size:12.5px;font-weight:800;color:#2b3f6b;text-align:center}
.g3-next{width:100%;max-width:520px;height:58px;border-radius:999px;border:3px solid #e8c45a;font-family:inherit;font-weight:900;font-size:18px;letter-spacing:.06em;color:#fff;cursor:pointer;background:linear-gradient(180deg,#4d9af5 0%,#2f6fd6 50%,#1d4fb3 100%);box-shadow:0 0 0 2px #fff6d0,0 10px 22px rgba(36,88,199,.4)}
.g3-next:disabled{opacity:.5;cursor:default;filter:grayscale(.3)}
.g3-load{min-height:50vh;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;text-shadow:0 2px 6px rgba(0,0,0,.4)}
@media (max-width:860px){
  .g3-root{background-image:url(/onboarding/confirm_mobile.webp)}
  .g3-board{padding:22px 14px 18px}
  .g3-cards{grid-template-columns:1fr;gap:18px}
  .g3-arrow{transform:rotate(90deg);font-size:26px;height:14px}
  .g3-card{gap:10px}
  .g3-shot{aspect-ratio:16/10}
  .g3-btn{height:54px;font-size:16px}
}
`;

export default function FirstQuestGuidePage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [prog, setProg] = useState<TutorialProgress>({});
    const [imgOk, setImgOk] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const load = () => supabase.auth.getUser().then(({ data: { user } }) => { if (!user) { router.push("/login"); return; } setUserId(user.id); setProg(readTutorial(user.id)); });
        load();
        CARDS.forEach((c) => { const im = new Image(); im.onload = () => setImgOk((m) => ({ ...m, [c.key]: true })); im.onerror = () => setImgOk((m) => ({ ...m, [c.key]: false })); im.src = c.img; });
        const onFocus = () => { load(); };
        window.addEventListener("focus", onFocus); document.addEventListener("visibilitychange", onFocus);
        return () => { window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
    }, [router]);

    const open = (href: string) => { if (userId) setTutorialReturn(userId, HERE); router.push(href); };
    const allDone = tutorialAllDone(prog);
    const doneCount = CARDS.filter((c) => prog[c.key]).length;
    const goClear = () => { if (!allDone) return; router.push("/onboarding/first-quest/clear"); };

    return (
        <>
            <style>{CSS}</style>
            <main className="g3-root">
                <div className="g3-top">
                    <div className="g3-prog">{STEPS.map((s, i) => <span key={s} className={i === STEP_NOW ? "on" : i < STEP_NOW ? "done" : ""}>{i + 1}. {s}</span>)}</div>
                    <button className="g3-back" type="button" onClick={() => router.push("/onboarding/first-quest/quests")}>← クエスト一覧へ</button>
                </div>
                <div><div className="g3-step"><b>STEP 7</b><span>はじめての冒険</span><em>3 / 4</em></div></div>
                <div style={{ textAlign: "center" }}><div className="g3-msg">ルクの案内にそって、実際の画面を見てみよう！</div></div>
                {!userId && <div className="g3-load">読み込み中…</div>}
                {userId && (
                    <section className="g3-board" aria-label="ルクの案内">
                        <div className="g3-cards">
                            {CARDS.map((c, i) => {
                                const done = !!prog[c.key];
                                const src = imgOk[c.key] ? c.img : c.fallback;
                                const useFallback = !imgOk[c.key];
                                return (
                                    <Fragment key={c.key}>
                                        {i > 0 && <div className="g3-arrow" aria-hidden>➜</div>}
                                        <div className="g3-card">
                                            <div className="g3-head">{c.head}</div>
                                            <div className="g3-shot">
                                                <img src={src} alt="" className={useFallback && c.fit === "contain" ? "contain" : ""} />
                                                {useFallback && c.key === "quest" && <div className="qtxt"><b>今日のクエスト</b><em>0<span style={{ fontSize: "55%", opacity: .85 }}>/3</span></em></div>}
                                                {done && <div className="g3-done">達成 ✓</div>}
                                            </div>
                                            <p className="g3-body">{c.body}</p>
                                            <button className={"g3-btn" + (done ? " done" : "")} type="button" onClick={() => open(c.href)}>{done ? "もう一度見る" : c.btn}</button>
                                        </div>
                                    </Fragment>
                                );
                            })}
                        </div>
                        <div className="g3-foot">
                            <div className="g3-note">{allDone ? "3つの画面をすべて見ました！" : `達成 ${doneCount} / 3 — 画面を開くと自動で達成になり、ルクが戻り方を案内します`}</div>
                            <button className="g3-next" type="button" disabled={!allDone} onClick={goClear}>{allDone ? "クリア報告へ進む →" : "3つ見ると進めます"}</button>
                        </div>
                    </section>
                )}
            </main>
        </>
    );
}
