"use client";
// Intern Quest 2.0｜アバターカスタマイズ（職業選択 → この画面 → 既存オンボーディング）
// 外見は profiles.avatar_config（既存 jsonb）に {type:"layered", id:<従来プリセットID>, ...} で保存。
// 職業（profiles.job_class）とは独立。職業を変えてもこの設定は消えない。
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import AvatarLayered from "@/app/components/AvatarLayered";
import { GEAR, HAIR, HAIR_COLOR, SKIN, DEFAULT_PRESET, defaultConfig, type AvatarConfig, type Base, type Part } from "@/app/lib/avatar/catalog";
import { JOBS, type JobKey } from "../job/page";

const STEPS = ["登録", "冒険者情報", "職業", "アバター", "確認", "ライセンス", "初回クエスト"];
const STEP_NOW = 3;

const CSS = `
.av-root{min-height:100vh;min-height:100dvh;background:#7fc3ef url(/images/onboarding/job-selection-bg.webp) center 30%/cover no-repeat fixed;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416;padding:14px 16px calc(16px + env(safe-area-inset-bottom));box-sizing:border-box}
.av-top{display:flex;align-items:center;justify-content:space-between;gap:10px;max-width:1200px;margin:0 auto;flex-wrap:wrap}
.av-back{border:2px solid #fff;background:rgba(255,255,255,.75);color:#1d3f8c;font-weight:900;border-radius:999px;padding:8px 16px;cursor:pointer;font-family:inherit;font-size:13px}
.av-prog{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.av-prog span{font-size:11px;font-weight:800;color:#5a6b8c;background:rgba(255,255,255,.7);border-radius:999px;padding:4px 10px}
.av-prog span.on{color:#fff;background:linear-gradient(180deg,#4d9af5,#2458c7)}.av-prog span.done{color:#1d3f8c;background:#dbe8ff}
.av-h{text-align:center;margin:14px auto 12px;display:inline-block;background:linear-gradient(180deg,#fffdf4,#f6ead0);border:2px solid #d8b55e;border-radius:14px;padding:10px 36px 12px;box-shadow:0 0 0 4px rgba(255,255,255,.5),0 12px 26px rgba(30,60,120,.25)}
.av-h h1{margin:0;font-size:clamp(20px,2.6vw,30px);font-weight:900;color:#17397d}.av-h p{margin:4px 0 0;font-size:13px;font-weight:800;color:#2b3f6b}
.av-wrap{display:grid;grid-template-columns:minmax(300px,420px) minmax(320px,1fr);gap:18px;max-width:1200px;margin:0 auto;align-items:start}
.av-stage{background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,.25));border:3px solid #d8b55e;border-radius:22px;padding:14px;box-shadow:0 14px 30px rgba(30,60,120,.22);position:sticky;top:12px}
.av-stage .plate{position:absolute;left:50%;bottom:8%;transform:translateX(-50%);width:70%;height:7%;border-radius:50%;background:radial-gradient(ellipse,rgba(30,60,120,.35),rgba(30,60,120,0) 70%)}
.av-stage .job{display:flex;justify-content:center;gap:8px;margin-top:6px;font-size:12.5px;font-weight:900;color:#1d3f8c}
.av-panel{background:linear-gradient(180deg,#fffdf6,#f7ecd2);border:3px solid #d8b55e;border-radius:22px;padding:16px;box-shadow:0 14px 30px rgba(30,60,120,.22)}
.av-tabs{display:flex;gap:8px;margin-bottom:12px}
.av-tabs button{flex:1;height:40px;border-radius:999px;border:2px solid #d8b55e;background:#fff;color:#6b4f1d;font-weight:900;font-family:inherit;cursor:pointer;font-size:14px}
.av-tabs button.on{background:linear-gradient(180deg,#4d9af5,#2458c7);color:#fff;border-color:#e8c45a}
.av-sec{margin-bottom:14px}
.av-lab{font-size:13px;font-weight:900;color:#6b4f1d;margin-bottom:6px;display:flex;justify-content:space-between;align-items:baseline}
.av-lab small{font-size:11px;color:#92400e;font-weight:800}
.av-opts{display:flex;flex-wrap:wrap;gap:8px}
.av-opt{min-height:40px;padding:0 14px;border-radius:12px;border:2px solid #d9c59a;background:#fffffb;font-family:inherit;font-weight:800;font-size:13px;color:#2b2416;cursor:pointer;display:flex;align-items:center;gap:8px;position:relative}
.av-opt.on{border-color:#2f6fd6;background:#e8f0ff;box-shadow:0 0 0 3px rgba(47,111,214,.18)}
.av-opt.na::after{content:"準備中";position:absolute;top:-8px;right:-6px;font-size:9px;font-weight:900;color:#92400e;background:#fef3c7;border:1px solid #fde68a;border-radius:999px;padding:1px 6px}
.av-sw{width:22px;height:22px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.15)}
.av-seg{display:flex;gap:8px}.av-seg .av-opt{flex:1;justify-content:center;min-height:46px;font-size:15px}
.av-foot{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.av-next{width:100%;height:54px;border-radius:999px;border:2px solid #e8c45a;font-family:inherit;font-weight:900;font-size:17px;letter-spacing:.06em;color:#fff;cursor:pointer;background:linear-gradient(180deg,#4d9af5 0%,#2f6fd6 50%,#1d4fb3 100%);box-shadow:0 0 0 2px #fff6d0,0 8px 18px rgba(36,88,199,.4)}
.av-next:disabled{opacity:.6;cursor:default}
.av-msg{font-size:13px;font-weight:800;border-radius:10px;padding:8px 12px;text-align:center}.av-msg.ng{color:#991b1b;background:#fee2e2}.av-msg.ok{color:#14532d;background:#dcfce7}
@media (max-width:860px){
  .av-wrap{grid-template-columns:1fr;gap:12px}
  .av-stage{position:static;padding:10px;max-width:360px;margin:0 auto}
  .av-h{display:block;padding:8px 16px 10px}
  .av-panel{padding:12px}
  .av-opt{min-height:44px}
}
`;

type Tab = "basic" | "gear";

export default function AvatarCustomizePage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [job, setJob] = useState<JobKey | null>(null);
    const [cfg, setCfg] = useState<AvatarConfig | null>(null);
    const [tab, setTab] = useState<Tab>("basic");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const { data } = await supabase.from("profiles").select("job_class, avatar_config").eq("id", user.id).single();
            const j = ((data as any)?.job_class as JobKey) || null;
            if (!j || !JOBS.some((x) => x.key === j)) { router.push("/onboarding/job"); return; }
            setJob(j);
            const prev = (data as any)?.avatar_config;
            if (prev?.type === "layered" && prev.v === 1) {
                // 職業が変わっていても髪型・肌などは維持。衣装だけ新職業の初期装備に合わせる（装備が無効な ID の場合）
                const g = GEAR[j]; const fix = (list: Part[], id: string) => list.some((p) => p.id === id) ? id : list[0].id;
                setCfg({ ...prev, outfit: fix(g.outfit, prev.outfit), head: fix(g.head, prev.head), cape: fix(g.cape, prev.cape), weapon: fix(g.weapon, prev.weapon), accessory: fix(g.accessory, prev.accessory) });
            } else {
                // 既存のプリセット ID があれば引き継ぐ（みんなの島などの表示を変えない）
                const presetId: string | undefined = prev?.id;
                const base: Base = presetId?.includes("boy") ? "m" : "f";
                setCfg(defaultConfig(j, base, presetId));
            }
        })();
    }, [router]);

    const set = <K extends keyof AvatarConfig>(k: K, v: AvatarConfig[K]) => setCfg((c) => c ? { ...c, [k]: v } : c);
    const setBase = (b: Base) => setCfg((c) => {
        if (!c) return c;
        const keepPreset = c.id && c.id !== DEFAULT_PRESET.f && c.id !== DEFAULT_PRESET.m;
        return { ...c, base: b, hair: HAIR[b][0].id, id: keepPreset ? c.id : DEFAULT_PRESET[b] };
    });

    const handleSave = async () => {
        if (!cfg || !userId || loading) return;
        setLoading(true); setMsg("");
        const { error } = await supabase.from("profiles").update({ avatar_config: cfg }).eq("id", userId);
        if (error) { setMsg("保存に失敗しました。もう一度お試しください（" + error.message + "）"); setLoading(false); return; }
        setMsg("✅ アバターを保存しました！");
        // 次：アバター確認（未実装）→ 当面は既存のオンボーディング画面へ
        setTimeout(() => router.push("/onboarding"), 700);
    };

    const jobInfo = useMemo(() => JOBS.find((j) => j.key === job), [job]);
    const gear = job ? GEAR[job] : null;

    const Opts = ({ list, value, onPick, swatch }: { list: Part[]; value: string; onPick: (id: string) => void; swatch?: boolean }) => (
        <div className="av-opts">
            {list.map((p) => (
                <button key={p.id} type="button" className={"av-opt" + (value === p.id ? " on" : "") + (p.src === null ? " na" : "")} onClick={() => onPick(p.id)} aria-pressed={value === p.id}>
                    {swatch && p.swatch && <span className="av-sw" style={{ background: p.swatch }} />}{p.label}
                </button>
            ))}
        </div>
    );

    return (
        <>
            <style>{CSS}</style>
            <main className="av-root">
                <div className="av-top">
                    <div className="av-prog">{STEPS.map((s, i) => <span key={s} className={i === STEP_NOW ? "on" : i < STEP_NOW ? "done" : ""}>{i + 1}. {s}</span>)}</div>
                    <button className="av-back" type="button" onClick={() => router.push("/onboarding/job")}>← 職業選択へ</button>
                </div>
                <div style={{ textAlign: "center" }}>
                    <div className="av-h"><h1>アバターをつくろう</h1><p>見た目は、あとからマイページで変えられます。</p></div>
                </div>
                {cfg && job && gear && (
                    <div className="av-wrap">
                        <section className="av-stage" aria-label="プレビュー">
                            <div style={{ position: "relative" }}>
                                <div className="plate" />
                                <AvatarLayered config={cfg} job={job} />
                            </div>
                            <div className="job"><img src={`/images/onboarding/job-icon-${job}.webp`} alt="" style={{ width: 22, height: 26 }} />{jobInfo?.name}<span style={{ color: jobInfo?.color, letterSpacing: ".15em", fontSize: 10.5 }}>{jobInfo?.en}</span></div>
                        </section>
                        <section className="av-panel">
                            <div className="av-tabs" role="tablist">
                                <button type="button" role="tab" className={tab === "basic" ? "on" : ""} aria-selected={tab === "basic"} onClick={() => setTab("basic")}>基本</button>
                                <button type="button" role="tab" className={tab === "gear" ? "on" : ""} aria-selected={tab === "gear"} onClick={() => setTab("gear")}>装備</button>
                            </div>
                            {tab === "basic" ? (
                                <>
                                    <div className="av-sec"><div className="av-lab">素体</div>
                                        <div className="av-seg">
                                            <button type="button" className={"av-opt" + (cfg.base === "f" ? " on" : "")} onClick={() => setBase("f")}>女性</button>
                                            <button type="button" className={"av-opt" + (cfg.base === "m" ? " on" : "")} onClick={() => setBase("m")}>男性</button>
                                        </div></div>
                                    <div className="av-sec"><div className="av-lab">肌の色<small>素材準備中</small></div><Opts list={SKIN} value={cfg.skin} onPick={(v) => set("skin", v)} swatch /></div>
                                    <div className="av-sec"><div className="av-lab">髪型<small>素材準備中</small></div><Opts list={HAIR[cfg.base]} value={cfg.hair} onPick={(v) => set("hair", v)} /></div>
                                    <div className="av-sec"><div className="av-lab">髪の色<small>素材準備中</small></div><Opts list={HAIR_COLOR} value={cfg.hairColor} onPick={(v) => set("hairColor", v)} swatch /></div>
                                </>
                            ) : (
                                <>
                                    <div className="av-sec"><div className="av-lab">衣装<small>職業の初期装備</small></div><Opts list={gear.outfit} value={cfg.outfit} onPick={(v) => set("outfit", v)} /></div>
                                    <div className="av-sec"><div className="av-lab">帽子・頭飾り</div><Opts list={gear.head} value={cfg.head} onPick={(v) => set("head", v)} /></div>
                                    <div className="av-sec"><div className="av-lab">マント</div><Opts list={gear.cape} value={cfg.cape} onPick={(v) => set("cape", v)} /></div>
                                    <div className="av-sec"><div className="av-lab">武器</div><Opts list={gear.weapon} value={cfg.weapon} onPick={(v) => set("weapon", v)} /></div>
                                    <div className="av-sec"><div className="av-lab">アクセサリー</div><Opts list={gear.accessory} value={cfg.accessory} onPick={(v) => set("accessory", v)} /></div>
                                </>
                            )}
                            <div className="av-foot">
                                {msg && <div className={"av-msg " + (msg.startsWith("✅") ? "ok" : "ng")}>{msg}</div>}
                                <button className="av-next" type="button" disabled={loading} onClick={handleSave}>{loading ? "保存中…" : "この見た目で決定 →"}</button>
                            </div>
                        </section>
                    </div>
                )}
            </main>
        </>
    );
}
