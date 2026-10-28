"use client";
// Intern Quest 2.0｜STEP 6 冒険者ライセンス授与（確認 → この画面 → 初回クエスト）
// GPT 制作の /onboarding/license.webp（背景とライセンスが一体の画像）をそのまま敷き、
// 画像内の「肖像枠」「情報欄4本」「リボン」の位置にアバター・テキストを重ねる。
// 画像には描き込まない。この画面は保存処理を持たない（表示のみ＝再表示しても登録処理は重複しない）。
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import AvatarLayered from "@/app/components/AvatarLayered";
import { getLevel } from "@/app/lib/island";
import type { AvatarConfig } from "@/app/lib/avatar/catalog";
import { JOBS, type JobKey } from "../job/page";

const STEPS = ["登録", "冒険者情報", "職業", "アバター", "確認", "ライセンス", "初回クエスト"];
const STEP_NOW = 5;

// 画像の座標（1659×948 の元画像に対する比率）
const IMG = { w: 1659, h: 948 };
const PORTRAIT = { l: 318, t: 270, w: 348, h: 352 };     // 金の肖像枠の内側
const ROWS = [268, 359, 451, 543].map((t, i) => ({ l: 728, t, w: i === 3 ? 490 : 604, h: 78 }));   // 4本目は封蝋にかからない幅
const RIBBON = { l: 330, t: 708, w: 1000, h: 90 };       // 金のリボン（文字を置く帯）
const TITLE = { l: 330, t: 10, w: 1000, h: 84 };         // ライセンス上の空（装飾を隠さない位置）
const CARD = { l: 185, t: 88, w: 1290, h: 770 };         // スマホで切り出す範囲（ライセンス本体＋リボン）
const pct = (r: { l: number; t: number; w: number; h: number }) => ({ left: `${(r.l / IMG.w) * 100}%`, top: `${(r.t / IMG.h) * 100}%`, width: `${(r.w / IMG.w) * 100}%`, height: `${(r.h / IMG.h) * 100}%` });

const CSS = `
.lc-root{min-height:100vh;min-height:100dvh;background:#8ec5f0;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416;display:flex;flex-direction:column;align-items:center;padding:12px 0 calc(16px + env(safe-area-inset-bottom));box-sizing:border-box;overflow-x:hidden}
.lc-top{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;max-width:1200px;padding:0 16px;box-sizing:border-box;flex-wrap:wrap}
.lc-prog{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.lc-prog span{font-size:11px;font-weight:800;color:#5a6b8c;background:rgba(255,255,255,.7);border-radius:999px;padding:4px 10px}
.lc-prog span.on{color:#fff;background:linear-gradient(180deg,#4d9af5,#2458c7)}.lc-prog span.done{color:#1d3f8c;background:#dbe8ff}
.lc-view{position:relative;width:100%;overflow:hidden;margin-top:10px}
.lc-img{position:absolute;left:0;top:0}
.lc-img>img{display:block;width:100%;height:auto}
.lc-ov{position:absolute;display:flex;align-items:center;justify-content:center;box-sizing:border-box}
.lc-title{flex-direction:column;gap:0}
.lc-title b{font-size:calc(var(--u)*44);font-weight:900;color:#17397d;text-shadow:0 2px 0 #fff,0 0 18px rgba(255,255,255,.9);letter-spacing:.04em;line-height:1.1}
.lc-title small{font-size:calc(var(--u)*15);font-weight:800;color:#2b3f6b;letter-spacing:.3em;text-shadow:0 1px 0 #fff}
.lc-portrait{align-items:flex-start;overflow:hidden;padding:0}
.lc-portrait>div{flex:none;margin-top:-30%}
.lc-mtitle{display:none;text-align:center;margin:10px 0 2px}
.lc-mtitle b{display:block;font-size:24px;font-weight:900;color:#17397d;text-shadow:0 2px 0 #fff}
.lc-mtitle small{font-size:11px;font-weight:800;color:#2b3f6b;letter-spacing:.3em}
@media (max-width:859px){.lc-mtitle{display:block}}
.lc-row{justify-content:space-between;padding:0 4.5%;gap:3%}
.lc-row .k{font-size:calc(var(--u)*22);font-weight:900;color:#8a6a2b;white-space:nowrap;letter-spacing:.08em}
.lc-row .v{font-size:calc(var(--u)*30);font-weight:900;color:#2b2416;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.lc-row .v.none{color:#b45309;font-size:calc(var(--u)*22)}
.lc-ribbon b{font-size:calc(var(--u)*34);font-weight:900;color:#7a4e05;text-shadow:0 1px 0 #fff4c2;letter-spacing:.04em;white-space:nowrap}
.lc-foot{width:100%;max-width:560px;padding:14px 16px 0;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;align-items:center}
.lc-next{width:100%;height:56px;border-radius:999px;border:2px solid #e8c45a;font-family:inherit;font-weight:900;font-size:18px;letter-spacing:.06em;color:#fff;cursor:pointer;background:linear-gradient(180deg,#4d9af5 0%,#2f6fd6 50%,#1d4fb3 100%);box-shadow:0 0 0 2px #fff6d0,0 8px 18px rgba(36,88,199,.4)}
.lc-next:disabled{opacity:.6;cursor:default}
.lc-msg{font-size:13px;font-weight:800;border-radius:10px;padding:8px 12px;text-align:center;color:#991b1b;background:#fee2e2}
.lc-load{min-height:50vh;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;text-shadow:0 2px 6px rgba(0,0,0,.4)}
/* 演出：フェードイン＋わずかに拡大、金色の光が一度だけ控えめに輝く */
.lc-anim .lc-img{animation:lc-in 1.1s cubic-bezier(.2,.8,.2,1) both}
.lc-anim .lc-ov{animation:lc-fade .6s ease-out .7s both}
.lc-anim .lc-glow{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 42%,rgba(255,236,160,.55),rgba(255,236,160,0) 55%);animation:lc-glow 1.8s ease-out .3s both}
@keyframes lc-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
@keyframes lc-fade{from{opacity:0}to{opacity:1}}
@keyframes lc-glow{0%{opacity:0}40%{opacity:1}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.lc-anim .lc-img,.lc-anim .lc-ov,.lc-anim .lc-glow{animation:none}}
`;

type Profile = { name: string | null; department_id: string | null; job_class: string | null; avatar_config: any };

export default function LicensePage() {
    const router = useRouter();
    const [p, setP] = useState<Profile | null>(null);
    const [deptName, setDeptName] = useState("");
    const [level, setLevel] = useState<number | null>(null);
    const [msg, setMsg] = useState("");
    const [going, setGoing] = useState(false);
    const [vw, setVw] = useState(0);
    const [vh, setVh] = useState(0);
    const viewRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const f = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
        f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f);
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) { router.push("/login"); return; }
                const [{ data, error }, { data: pt }] = await Promise.all([
                    supabase.from("profiles").select("name, department_id, job_class, avatar_config").eq("id", user.id).single(),
                    supabase.from("user_points").select("total_earned").eq("id", user.id).maybeSingle(),
                ]);
                if (error || !data) { setMsg("情報の読み込みに失敗しました。再読み込みしてください。"); return; }
                const pr = data as Profile;
                // 途中離脱からの再開：足りない情報があればその画面へ（この画面は何も保存しない）
                if (!pr.job_class || !JOBS.some((j) => j.key === pr.job_class)) { router.push("/onboarding/job"); return; }
                if (pr.avatar_config?.type !== "layered") { router.push("/onboarding/avatar"); return; }
                setP(pr);
                setLevel(getLevel(((pt as any)?.total_earned as number) || 0));
                if (pr.department_id) {
                    const { data: d } = await supabase.from("departments").select("name").eq("id", pr.department_id).single();
                    setDeptName((d as any)?.name || "");
                }
            } catch (e: any) { setMsg("情報の読み込みに失敗しました（" + (e?.message || e) + "）"); }
        })();
    }, [router]);

    const job = (p?.job_class as JobKey) || null;
    const jobInfo = useMemo(() => JOBS.find((j) => j.key === job), [job]);
    const cfg = p?.avatar_config as AvatarConfig | undefined;

    // 表示レイアウト：PC は画像全体を中央に大きく。スマホは画像を単純縮小せず、ライセンス本体の範囲（CARD）だけを切り出して横幅いっぱいに表示する。
    const mobile = vw > 0 && vw < 860;
    const layout = useMemo(() => {
        if (!vw) return null;
        if (!mobile) {
            const avail = Math.max(320, vh - 150);                      // 上の進捗・下のボタンぶんを引く
            const w = Math.min(vw, avail * IMG.w / IMG.h);              // 画面に収まる最大幅
            return { viewW: w, viewH: w * IMG.h / IMG.w, imgW: w, offX: 0, offY: 0 };
        }
        const viewW = vw; const imgW = viewW * IMG.w / CARD.w; const s = imgW / IMG.w;
        return { viewW, viewH: CARD.h * s, imgW, offX: -CARD.l * s, offY: -CARD.t * s };
    }, [vw, vh, mobile]);
    const u = layout ? layout.imgW / IMG.w : 0;   // 元画像 1px あたりの画面 px（文字サイズの基準）

    const start = () => { if (going) return; setGoing(true); router.push("/onboarding/first-quest"); };

    const V = ({ v }: { v?: string | null }) => <span className={"v" + (v ? "" : " none")}>{v || "未設定"}</span>;

    return (
        <>
            <style>{CSS}</style>
            <main className="lc-root">
                <div className="lc-top">
                    <div className="lc-prog">{STEPS.map((s, i) => <span key={s} className={i === STEP_NOW ? "on" : i < STEP_NOW ? "done" : ""}>{i + 1}. {s}</span>)}</div>
                </div>
                {msg && <div style={{ maxWidth: 560, margin: "12px auto 0", padding: "0 16px" }}><div className="lc-msg">{msg}</div></div>}
                {(!p || !layout || level === null) && !msg && <div className="lc-load">ライセンスを発行しています…</div>}
                {p && cfg && job && layout && level !== null && (
                    <>
                        <div className="lc-mtitle"><b>冒険者ライセンス</b><small>ADVENTURER LICENSE</small></div>
                        <div ref={viewRef} className="lc-view lc-anim" style={{ width: layout.viewW, height: layout.viewH, ["--u" as any]: `${u}px` }}>
                            <div className="lc-img" style={{ width: layout.imgW, left: layout.offX, top: layout.offY }}>
                                <img src="/onboarding/license.webp" alt="冒険者ライセンス" width={IMG.w} height={IMG.h} />
                                <div className="lc-glow" />
                                <div className="lc-ov lc-title" style={pct(TITLE)}><b>冒険者ライセンス</b><small>ADVENTURER LICENSE</small></div>
                                <div className="lc-ov lc-portrait" style={pct(PORTRAIT)} aria-label="アバター">
                                    <AvatarLayered config={cfg} job={job} size="150%" showFallback />
                                </div>
                                <div className="lc-ov lc-row" style={pct(ROWS[0])}><span className="k">名前</span><V v={p.name} /></div>
                                <div className="lc-ov lc-row" style={pct(ROWS[1])}><span className="k">職業</span><span className="v">{jobInfo?.name}<span style={{ color: jobInfo?.color, fontSize: "calc(var(--u)*16)", letterSpacing: ".15em", marginLeft: "0.6em" }}>{jobInfo?.en}</span></span></div>
                                <div className="lc-ov lc-row" style={pct(ROWS[2])}><span className="k">Lv.</span><span className="v">{level}</span></div>
                                <div className="lc-ov lc-row" style={pct(ROWS[3])}><span className="k">所属</span><V v={deptName} /></div>
                                <div className="lc-ov lc-ribbon" style={pct(RIBBON)}><b>冒険者ギルドへの登録が完了しました！</b></div>
                            </div>
                        </div>
                        <div className="lc-foot">
                            <button className="lc-next" type="button" disabled={going} onClick={start}>{going ? "移動中…" : "冒険を始める →"}</button>
                        </div>
                    </>
                )}
            </main>
        </>
    );
}
