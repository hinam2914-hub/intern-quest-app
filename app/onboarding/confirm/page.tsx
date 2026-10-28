"use client";
// Intern Quest 2.0｜確認（アバター → この画面 → 既存オンボーディング／今後はライセンス）
// 冒険者情報・職業・アバターを1画面で見せて最終確認する。保存はしない（各画面で保存済み）。
// 「変更する」で該当画面へ戻れる。決定で既存のオンボーディング（/onboarding）へ。
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import AvatarLayered from "@/app/components/AvatarLayered";
import { GEAR, HAIR, HAIR_COLOR, SKIN, type AvatarConfig } from "@/app/lib/avatar/catalog";
import { JOBS, type JobKey } from "../job/page";

const STEPS = ["登録", "冒険者情報", "職業", "アバター", "確認", "ライセンス", "初回クエスト"];
const STEP_NOW = 4;

const CSS = `
.cf-root{min-height:100vh;min-height:100dvh;background:#7fc3ef url(/onboarding/confirm_pc.webp) center top/cover no-repeat fixed;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416;padding:14px 16px calc(16px + env(safe-area-inset-bottom));box-sizing:border-box}
.cf-top{display:flex;align-items:center;justify-content:space-between;gap:10px;max-width:1200px;margin:0 auto;flex-wrap:wrap}
.cf-back{border:2px solid #fff;background:rgba(255,255,255,.75);color:#1d3f8c;font-weight:900;border-radius:999px;padding:8px 16px;cursor:pointer;font-family:inherit;font-size:13px}
.cf-prog{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.cf-prog span{font-size:11px;font-weight:800;color:#5a6b8c;background:rgba(255,255,255,.7);border-radius:999px;padding:4px 10px}
.cf-prog span.on{color:#fff;background:linear-gradient(180deg,#4d9af5,#2458c7)}.cf-prog span.done{color:#1d3f8c;background:#dbe8ff}
.cf-h{text-align:center;margin:14px auto 12px;display:inline-block;background:linear-gradient(180deg,#fffdf4,#f6ead0);border:2px solid #d8b55e;border-radius:14px;padding:10px 36px 12px;box-shadow:0 0 0 4px rgba(255,255,255,.5),0 12px 26px rgba(30,60,120,.25)}
.cf-h h1{margin:0;font-size:clamp(20px,2.6vw,30px);font-weight:900;color:#17397d}.cf-h p{margin:4px 0 0;font-size:13px;font-weight:800;color:#2b3f6b}
.cf-wrap{display:grid;grid-template-columns:minmax(300px,420px) minmax(320px,1fr);gap:18px;max-width:1200px;margin:0 auto;align-items:start}
.cf-stage{background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,.25));border:3px solid #d8b55e;border-radius:22px;padding:14px;box-shadow:0 14px 30px rgba(30,60,120,.22);position:sticky;top:12px}
.cf-stage .plate{position:absolute;left:50%;bottom:6%;transform:translateX(-50%);width:70%;height:7%;border-radius:50%;background:radial-gradient(ellipse,rgba(30,60,120,.35),rgba(30,60,120,0) 70%)}
.cf-stage .name{text-align:center;font-size:18px;font-weight:900;color:#17397d;margin-top:8px}
.cf-stage .job{display:flex;justify-content:center;gap:8px;margin-top:4px;font-size:12.5px;font-weight:900;color:#1d3f8c}
.cf-stage .edit{display:flex;justify-content:center;margin-top:10px}
.cf-panel{background:linear-gradient(180deg,#fffdf6,#f7ecd2);border:3px solid #d8b55e;border-radius:22px;padding:16px;box-shadow:0 14px 30px rgba(30,60,120,.22)}
.cf-sec{margin-bottom:14px}
.cf-sec-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.cf-sec-h b{font-size:14px;font-weight:900;color:#6b4f1d}
.cf-edit{border:2px solid #d9c59a;background:#fffffb;color:#1d3f8c;font-weight:900;border-radius:999px;padding:5px 12px;cursor:pointer;font-family:inherit;font-size:12px}
.cf-edit:hover{background:#e8f0ff;border-color:#2f6fd6}
.cf-rows{display:grid;grid-template-columns:1fr;gap:6px}
.cf-row{display:flex;justify-content:space-between;align-items:center;gap:12px;background:#fffffb;border:2px solid #e7dcc0;border-radius:12px;padding:9px 14px}
.cf-row .k{font-size:12.5px;font-weight:800;color:#8a6a2b;white-space:nowrap}
.cf-row .v{font-size:14.5px;font-weight:900;color:#2b2416;text-align:right;word-break:break-all}
.cf-row .v.none{color:#b45309;font-size:13px}
.cf-foot{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.cf-note{font-size:12px;font-weight:800;color:#2b3f6b;text-align:center}
.cf-next{width:100%;height:54px;border-radius:999px;border:2px solid #e8c45a;font-family:inherit;font-weight:900;font-size:17px;letter-spacing:.06em;color:#fff;cursor:pointer;background:linear-gradient(180deg,#4d9af5 0%,#2f6fd6 50%,#1d4fb3 100%);box-shadow:0 0 0 2px #fff6d0,0 8px 18px rgba(36,88,199,.4)}
.cf-next:disabled{opacity:.6;cursor:default}
.cf-msg{font-size:13px;font-weight:800;border-radius:10px;padding:8px 12px;text-align:center;color:#991b1b;background:#fee2e2}
.cf-load{min-height:60vh;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;text-shadow:0 2px 6px rgba(0,0,0,.4)}
@media (max-width:860px){
  .cf-root{background-image:url(/onboarding/confirm_mobile.webp);background-position:center top}
  .cf-wrap{grid-template-columns:1fr;gap:12px}
  .cf-stage{position:static;padding:10px;max-width:360px;margin:0 auto}
  .cf-h{display:block;padding:8px 16px 10px}
  .cf-panel{padding:12px}
}
`;

type Profile = {
    name: string | null; department_id: string | null; education: string | null; mbti: string | null;
    club_category: string | null; club: string | null; hobby_category: string | null; job_class: string | null; avatar_config: any;
};

export default function ConfirmPage() {
    const router = useRouter();
    const [p, setP] = useState<Profile | null>(null);
    const [deptName, setDeptName] = useState<string>("");
    const [msg, setMsg] = useState("");
    const [going, setGoing] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) { router.push("/login"); return; }
                const { data, error } = await supabase.from("profiles")
                    .select("name, department_id, education, mbti, club_category, club, hobby_category, job_class, avatar_config")
                    .eq("id", user.id).single();
                if (error || !data) { setMsg("情報の読み込みに失敗しました。再読み込みしてください。"); return; }
                const pr = data as Profile;
                // 途中離脱からの再開：足りない情報があればその画面へ
                if (!pr.department_id || !pr.mbti || !pr.hobby_category) { router.push("/onboarding/profile"); return; }
                if (!pr.job_class || !JOBS.some((j) => j.key === pr.job_class)) { router.push("/onboarding/job"); return; }
                if (pr.avatar_config?.type !== "layered") { router.push("/onboarding/avatar"); return; }
                setP(pr);
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
    const label = (list: { id: string; label: string }[], id?: string) => list.find((x) => x.id === id)?.label || "—";
    const gear = job ? GEAR[job] : null;

    const start = () => {
        if (going) return;
        setGoing(true);
        // 次：ライセンス（未実装）→ 当面は既存のオンボーディング画面へ
        router.push("/onboarding");
    };

    const V = ({ v }: { v?: string | null }) => <span className={"v" + (v ? "" : " none")}>{v || "未設定"}</span>;

    return (
        <>
            <style>{CSS}</style>
            <main className="cf-root">
                <div className="cf-top">
                    <div className="cf-prog">{STEPS.map((s, i) => <span key={s} className={i === STEP_NOW ? "on" : i < STEP_NOW ? "done" : ""}>{i + 1}. {s}</span>)}</div>
                    <button className="cf-back" type="button" onClick={() => router.push("/onboarding/avatar")}>← アバターへ</button>
                </div>
                <div style={{ textAlign: "center" }}>
                    <div className="cf-h"><h1>冒険の準備ができました</h1><p>内容を確認して、冒険をはじめましょう。</p></div>
                </div>
                {msg && <div style={{ maxWidth: 560, margin: "0 auto" }}><div className="cf-msg">{msg}</div></div>}
                {!p && !msg && <div className="cf-load">読み込み中…</div>}
                {p && cfg && job && gear && (
                    <div className="cf-wrap">
                        <section className="cf-stage" aria-label="アバター">
                            <div style={{ position: "relative" }}>
                                <div className="plate" />
                                <AvatarLayered config={cfg} job={job} />
                            </div>
                            <div className="name">{p.name}</div>
                            <div className="job"><img src={`/images/onboarding/job-icon-${job}.webp`} alt="" style={{ width: 22, height: 26 }} />{jobInfo?.name}<span style={{ color: jobInfo?.color, letterSpacing: ".15em", fontSize: 10.5 }}>{jobInfo?.en}</span></div>
                            <div className="edit"><button className="cf-edit" type="button" onClick={() => router.push("/onboarding/avatar")}>見た目を変更する</button></div>
                        </section>
                        <section className="cf-panel">
                            <div className="cf-sec">
                                <div className="cf-sec-h"><b>冒険者情報</b><button className="cf-edit" type="button" onClick={() => router.push("/onboarding/profile")}>変更する</button></div>
                                <div className="cf-rows">
                                    <div className="cf-row"><span className="k">名前</span><V v={p.name} /></div>
                                    <div className="cf-row"><span className="k">事業部</span><V v={deptName} /></div>
                                    <div className="cf-row"><span className="k">大学・学部</span><V v={p.education} /></div>
                                    <div className="cf-row"><span className="k">MBTI</span><V v={p.mbti} /></div>
                                    <div className="cf-row"><span className="k">高校の部活</span><V v={p.club_category || p.club} /></div>
                                    <div className="cf-row"><span className="k">趣味</span><V v={p.hobby_category} /></div>
                                </div>
                            </div>
                            <div className="cf-sec">
                                <div className="cf-sec-h"><b>職業</b><button className="cf-edit" type="button" onClick={() => router.push("/onboarding/job")}>変更する</button></div>
                                <div className="cf-rows">
                                    <div className="cf-row"><span className="k">職業</span><span className="v">{jobInfo?.name}（{jobInfo?.en}）</span></div>
                                </div>
                            </div>
                            <div className="cf-sec">
                                <div className="cf-sec-h"><b>アバター</b><button className="cf-edit" type="button" onClick={() => router.push("/onboarding/avatar")}>変更する</button></div>
                                <div className="cf-rows">
                                    <div className="cf-row"><span className="k">素体・肌</span><span className="v">{cfg.base === "m" ? "男性" : "女性"}・{label(SKIN, cfg.skin)}</span></div>
                                    <div className="cf-row"><span className="k">髪型・髪色</span><span className="v">{label(HAIR[cfg.base], cfg.hair)}・{label(HAIR_COLOR, cfg.hairColor)}</span></div>
                                    <div className="cf-row"><span className="k">衣装</span><span className="v">{label(gear.outfit, cfg.outfit)}</span></div>
                                </div>
                            </div>
                            <div className="cf-foot">
                                <div className="cf-note">冒険者情報・職業・見た目は、あとからマイページで変更できます。</div>
                                <button className="cf-next" type="button" disabled={going} onClick={start}>{going ? "移動中…" : "この内容で冒険をはじめる →"}</button>
                            </div>
                        </section>
                    </div>
                )}
            </main>
        </>
    );
}
