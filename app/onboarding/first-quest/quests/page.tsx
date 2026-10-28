"use client";
// Intern Quest 2.0｜STEP 7「はじめての冒険」2/4：はじめてのクエスト（3つのクエスト一覧）
// 達成判定は実際の画面を開いたときに各画面の <TutorialMark> が記録する（app/lib/tutorial.ts、localStorage）。
// この画面はその記録を読んで表示するだけ。チェックを押して達成にはできない。3つ達成で 4/4（クリア演出）へ進める。
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { readTutorial, setTutorialReturn, tutorialAllDone, type TutorialKey, type TutorialProgress } from "@/app/lib/tutorial";

const STEPS = ["登録", "冒険者情報", "職業", "アバター", "確認", "ライセンス", "初回クエスト"];
const STEP_NOW = 6;
const LUKU_SRC = "/onboarding/luku.png";

const QUESTS: { key: TutorialKey; no: string; title: string; sub: string; href: string; icon: string }[] = [
    { key: "home", no: "①", title: "HOMEのエリアを見てみよう", sub: "ホームを探検して、できることを確認しよう", href: "/home", icon: "/onboarding/quest-icon-home.png" },
    { key: "skill", no: "②", title: "SKILL WORLDを開いてみよう", sub: "5つのエリアとスキルを見てみよう", href: "/skill-board", icon: "/onboarding/quest-icon-skill.png" },
    { key: "quest", no: "③", title: "今日のクエストを確認しよう", sub: "実際のクエスト一覧をのぞいてみよう", href: "/today-schedule", icon: "/onboarding/quest-icon-quest.png" },
];

const CSS = `
.fq2-root{min-height:100vh;min-height:100dvh;background:#7fc3ef url(/onboarding/confirm_pc.webp) center top/cover no-repeat fixed;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416;padding:14px 16px calc(16px + env(safe-area-inset-bottom));box-sizing:border-box;overflow-x:hidden}
.fq2-top{display:flex;align-items:center;justify-content:space-between;gap:10px;max-width:1200px;margin:0 auto;flex-wrap:wrap}
.fq2-prog{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.fq2-prog span{font-size:11px;font-weight:800;color:#5a6b8c;background:rgba(255,255,255,.7);border-radius:999px;padding:4px 10px}
.fq2-prog span.on{color:#fff;background:linear-gradient(180deg,#4d9af5,#2458c7)}.fq2-prog span.done{color:#1d3f8c;background:#dbe8ff}
.fq2-back{border:2px solid #fff;background:rgba(255,255,255,.75);color:#1d3f8c;font-weight:900;border-radius:999px;padding:8px 16px;cursor:pointer;font-family:inherit;font-size:13px}
.fq2-step{display:inline-flex;align-items:center;gap:10px;margin:14px 0 0;background:linear-gradient(180deg,#5a3d12,#3b2708);border:2px solid #e8c45a;border-radius:14px;padding:8px 18px 8px 12px;box-shadow:0 0 0 3px rgba(255,255,255,.45),0 10px 22px rgba(30,60,120,.25)}
.fq2-step b{font-size:15px;font-weight:900;color:#ffe7a3;letter-spacing:.08em}.fq2-step span{font-size:16px;font-weight:900;color:#fff}
.fq2-step em{font-style:normal;font-size:13px;font-weight:900;color:#1d3f8c;background:#fff;border-radius:999px;padding:3px 10px}
.fq2-wrap{position:relative;max-width:1100px;margin:34px auto 0;display:grid;grid-template-columns:220px 1fr;gap:0;align-items:end}
.fq2-luku{position:relative;z-index:2;margin-bottom:-6px;animation:fq2-fade .6s ease-out .2s both}
.fq2-luku img{width:100%;height:auto;display:block;animation:fq2-bob 2.4s ease-in-out infinite}
.fq2-board{position:relative;background:linear-gradient(180deg,#fffdf4,#f6ead0);border:3px solid #d8b55e;border-radius:26px;padding:46px 28px 24px;box-shadow:0 0 0 4px rgba(255,255,255,.5),0 14px 30px rgba(30,60,120,.25);animation:fq2-pop .5s cubic-bezier(.2,.9,.3,1.2) both;margin-left:-30px}
.fq2-ribbon{position:absolute;left:50%;top:-28px;transform:translateX(-50%);background:linear-gradient(180deg,#4d9af5,#2458c7);color:#fff;font-weight:900;font-size:clamp(20px,2.4vw,28px);letter-spacing:.08em;border:3px solid #e8c45a;border-radius:16px;padding:8px 40px;box-shadow:0 6px 14px rgba(36,88,199,.35);white-space:nowrap}
.fq2-ribbon::before,.fq2-ribbon::after{content:"";position:absolute;top:10px;width:22px;height:70%;background:#1d4fb3;z-index:-1;border:2px solid #e8c45a}
.fq2-ribbon::before{left:-20px;transform:skewY(12deg)}.fq2-ribbon::after{right:-20px;transform:skewY(-12deg)}
.fq2-lead{margin:0 0 16px;text-align:center;font-size:clamp(16px,1.6vw,21px);font-weight:900;color:#5a3d12;line-height:1.6;white-space:pre-line}
.fq2-list{display:flex;flex-direction:column;gap:12px}
.fq2-q{display:grid;grid-template-columns:64px 1fr auto;align-items:center;gap:14px;background:#fffffb;border:2px solid #e7dcc0;border-radius:16px;padding:12px 16px;box-shadow:0 3px 0 rgba(216,181,94,.35)}
.fq2-q.done{background:#f3fbf3;border-color:#9fd7a8}
.fq2-ic{width:64px;height:56px;display:flex;align-items:center;justify-content:center}
.fq2-ic img{max-width:100%;max-height:100%}
.fq2-ic .no{font-size:26px;font-weight:900;color:#2458c7}
.fq2-t{min-width:0}
.fq2-t b{display:block;font-size:clamp(15px,1.5vw,19px);font-weight:900;color:#2b2416;line-height:1.3}
.fq2-t small{display:block;margin-top:3px;font-size:clamp(12px,1.1vw,14px);font-weight:800;color:#8a6a2b}
.fq2-r{display:flex;align-items:center;gap:10px}
.fq2-go{border:2px solid #2f6fd6;background:#e8f0ff;color:#1d3f8c;font-weight:900;border-radius:999px;padding:8px 14px;cursor:pointer;font-family:inherit;font-size:13px;white-space:nowrap}
.fq2-cb{width:34px;height:34px;border-radius:9px;border:3px solid #d9c59a;background:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#fff;flex:none}
.fq2-cb.on{background:linear-gradient(180deg,#4bd37b,#1f9e4e);border-color:#1f9e4e;box-shadow:0 0 0 3px rgba(31,158,78,.2)}
.fq2-foot{display:flex;flex-direction:column;gap:8px;margin-top:18px;align-items:center}
.fq2-note{font-size:12.5px;font-weight:800;color:#2b3f6b;text-align:center}
.fq2-next{width:100%;max-width:520px;height:58px;border-radius:999px;border:3px solid #e8c45a;font-family:inherit;font-weight:900;font-size:18px;letter-spacing:.06em;color:#fff;cursor:pointer;background:linear-gradient(180deg,#4d9af5 0%,#2f6fd6 50%,#1d4fb3 100%);box-shadow:0 0 0 2px #fff6d0,0 10px 22px rgba(36,88,199,.4)}
.fq2-next:disabled{opacity:.5;cursor:default;filter:grayscale(.3)}
.fq2-load{min-height:50vh;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;text-shadow:0 2px 6px rgba(0,0,0,.4)}
@keyframes fq2-fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes fq2-pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
@keyframes fq2-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@media (prefers-reduced-motion:reduce){.fq2-luku,.fq2-luku img,.fq2-board{animation:none}}
@media (max-width:860px){
  .fq2-root{background-image:url(/onboarding/confirm_mobile.webp)}
  .fq2-wrap{grid-template-columns:1fr;margin-top:40px}
  .fq2-board{margin-left:0;padding:40px 14px 18px;order:1}
  .fq2-luku{order:2;width:120px;margin:10px auto 0}
  .fq2-ribbon{padding:6px 22px;font-size:18px;top:-24px}
  .fq2-q{grid-template-columns:44px 1fr;gap:10px;padding:10px 12px}
  .fq2-ic{width:44px;height:40px}.fq2-ic .no{font-size:20px}
  .fq2-r{grid-column:1 / -1;justify-content:flex-end}
  .fq2-cb{width:30px;height:30px}
}
`;

export default function FirstQuestListPage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [prog, setProg] = useState<TutorialProgress>({});
    const [hasLuku, setHasLuku] = useState(false);
    const [icons, setIcons] = useState<Record<string, boolean>>({});

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id); setProg(readTutorial(user.id));
        })();
        const probe = (src: string, cb: (ok: boolean) => void) => { const im = new Image(); im.onload = () => cb(true); im.onerror = () => cb(false); im.src = src; };
        probe(LUKU_SRC, setHasLuku);
        QUESTS.forEach((q) => probe(q.icon, (ok) => setIcons((m) => ({ ...m, [q.key]: ok }))));
        // 別タブで達成して戻ってきたときにも更新
        const onFocus = () => { supabase.auth.getUser().then(({ data: { user } }) => { if (user) setProg(readTutorial(user.id)); }); };
        window.addEventListener("focus", onFocus); document.addEventListener("visibilitychange", onFocus);
        return () => { window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
    }, [router]);

    const allDone = tutorialAllDone(prog);
    const doneCount = QUESTS.filter((q) => prog[q.key]).length;
    // 次は 3/4（ルクの案内）。3つ達成済みなら 4/4 へ（4/4 は未実装のため当面は既存オンボーディングへ）
    const goNext = () => router.push(allDone ? "/onboarding" : "/onboarding/first-quest/guide");
    const goSee = (href: string) => { if (userId) setTutorialReturn(userId, "/onboarding/first-quest/quests"); router.push(href); };

    return (
        <>
            <style>{CSS}</style>
            <main className="fq2-root">
                <div className="fq2-top">
                    <div className="fq2-prog">{STEPS.map((s, i) => <span key={s} className={i === STEP_NOW ? "on" : i < STEP_NOW ? "done" : ""}>{i + 1}. {s}</span>)}</div>
                    <button className="fq2-back" type="button" onClick={() => router.push("/onboarding/first-quest")}>← 前へ</button>
                </div>
                <div><div className="fq2-step"><b>STEP 7</b><span>はじめての冒険</span><em>2 / 4</em></div></div>
                {!userId && <div className="fq2-load">読み込み中…</div>}
                {userId && (
                    <div className="fq2-wrap">
                        <div className="fq2-luku" aria-hidden={!hasLuku}>{hasLuku && <img src={LUKU_SRC} alt="ルク" />}</div>
                        <section className="fq2-board" aria-label="はじめてのクエスト">
                            <div className="fq2-ribbon">はじめてのクエスト</div>
                            <p className="fq2-lead">{"まずは、3つのクエストをクリアして\nIntern Questの基本を体験しよう！"}</p>
                            <div className="fq2-list">
                                {QUESTS.map((q) => {
                                    const done = !!prog[q.key];
                                    return (
                                        <div key={q.key} className={"fq2-q" + (done ? " done" : "")}>
                                            <div className="fq2-ic">{icons[q.key] ? <img src={q.icon} alt="" /> : <span className="no">{q.no}</span>}</div>
                                            <div className="fq2-t"><b>{icons[q.key] ? q.no + " " : ""}{q.title}</b><small>→ {q.sub}</small></div>
                                            <div className="fq2-r">
                                                {!done && <button className="fq2-go" type="button" onClick={() => goSee(q.href)}>見に行く →</button>}
                                                <div className={"fq2-cb" + (done ? " on" : "")} role="img" aria-label={done ? "達成" : "未達成"}>{done ? "✓" : ""}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="fq2-foot">
                                <div className="fq2-note">{allDone ? "3つのクエストをすべてクリア！" : `達成 ${doneCount} / 3 — 「見に行く」でその画面を開くと達成になります。次の画面でルクが案内します`}</div>
                                <button className="fq2-next" type="button" onClick={goNext}>{allDone ? "クリア報告へ進む →" : "ルクの案内を見る →"}</button>
                            </div>
                        </section>
                    </div>
                )}
            </main>
        </>
    );
}
