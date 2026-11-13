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
.av-stage .plate{position:absolute;left:50%;bottom:6%;transform:translateX(-50%);width:70%;height:7%;border-radius:50%;background:radial-gradient(ellipse,rgba(30,60,120,.35),rgba(30,60,120,0) 70%)}
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
.av-lock{margin-left:2px;font-size:10px;font-weight:900;color:#8a5a10;background:#ffeeba;border:1px solid #e2bf63;border-radius:999px;padding:1px 7px}
.av-pend{margin-left:2px;font-size:10px;font-weight:900;color:#a06a00;background:#fff6dd;border:1px dashed #e2a93a;border-radius:999px;padding:1px 7px}
.av-bal{text-align:right;font-size:12px;font-weight:900;color:#8a5a10;margin-bottom:8px}
.av-buyw{position:fixed;inset:0;background:rgba(20,30,60,.6);z-index:20001;display:flex;align-items:center;justify-content:center;padding:20px}
.av-buy{background:linear-gradient(180deg,#fffdf4,#f8efdb);border:3px solid #d8b55e;border-radius:20px;padding:22px;width:100%;max-width:360px;text-align:center;box-shadow:0 0 0 3px rgba(255,255,255,.4),0 18px 50px rgba(20,30,60,.4)}
.av-buy .nm{font-size:17px;font-weight:900;color:#17397d;margin-top:6px}
.av-buy .pr{font-size:22px;font-weight:900;color:#a06a00;margin-top:10px}
.av-buy .bal{font-size:12px;font-weight:800;color:#8a93a6;margin-top:4px}
.av-buy .note{font-size:11px;font-weight:700;color:#8a6a3a;background:#fff6dd;border:1px solid #e9d7a0;border-radius:10px;padding:7px 10px;margin:12px 0}
.av-buy .cancel{width:100%;margin-top:8px;padding:11px 0;border-radius:999px;border:2px solid #cdb87e;background:rgba(255,253,245,.9);color:#8a6a3a;font-weight:900;cursor:pointer;font-size:13px;font-family:inherit}
@media (max-width:860px){
  .av-wrap{grid-template-columns:1fr;gap:12px}
  .av-stage{position:static;padding:10px;max-width:360px;margin:0 auto}
  .av-h{display:block;padding:8px 16px 10px}
  .av-panel{padding:12px}
  .av-opt{min-height:44px}
}
`;

type Tab = "basic" | "gear";
// 装備ショップのアイテム（gear_shop.sql 適用後に有効。未適用なら全装備が従来どおり無料）
type GearItem = { id: string; gear_key: string; name: string; price: number };

export default function AvatarCustomizePage() {
    const router = useRouter();
    const [from, setFrom] = useState<string>("");   // ?from=mypage|home：既存ユーザーの編集（保存後／キャンセルで元の画面へ戻る）
    useEffect(() => { try { const q = new URLSearchParams(window.location.search); setFrom(q.get("from") || ""); if (q.get("tab") === "gear") setTab("gear"); } catch {} }, []);
    const fromMypage = from === "mypage" || from === "home";
    const backTo = from === "home" ? "/home" : "/mypage";
    const [userId, setUserId] = useState<string | null>(null);
    const [job, setJob] = useState<JobKey | null>(null);
    const [cfg, setCfg] = useState<AvatarConfig | null>(null);
    const [tab, setTab] = useState<Tab>("basic");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");
    // 装備ショップ
    const [gearItems, setGearItems] = useState<Record<string, GearItem>>({});
    const [ownedGear, setOwnedGear] = useState<Set<string>>(new Set());
    const [pendingGear, setPendingGear] = useState<Set<string>>(new Set());
    const [points, setPoints] = useState(0);
    const [buyGear, setBuyGear] = useState<GearItem | null>(null);
    const [buying, setBuying] = useState(false);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            // 装備ショップ（テーブル未作成・行なしの場合は全装備が従来どおり無料のまま）
            const [{ data: gi }, { data: gp }, { data: up }] = await Promise.all([
                supabase.from("gear_items").select("id, gear_key, name, price").eq("is_active", true),
                supabase.from("gear_purchases").select("item_id, status").eq("user_id", user.id),
                supabase.from("user_points").select("points").eq("id", user.id).maybeSingle(),
            ]);
            const items: Record<string, GearItem> = {};
            const keyOf: Record<string, string> = {};
            (gi || []).forEach((it: any) => { items[it.gear_key] = it; keyOf[it.id] = it.gear_key; });
            setGearItems(items);
            setOwnedGear(new Set((gp || []).filter((p: any) => p.status === "approved").map((p: any) => keyOf[p.item_id]).filter(Boolean)));
            setPendingGear(new Set((gp || []).filter((p: any) => p.status === "pending").map((p: any) => keyOf[p.item_id]).filter(Boolean)));
            setPoints((up as any)?.points || 0);
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

    // 未購入の有料装備が混ざっていたら外して保存（通常は選択できないため保険）
    const sanitizeCfg = (c: AvatarConfig): AvatarConfig => {
        const s = { ...c };
        (["head", "cape", "weapon", "accessory"] as const).forEach((k) => {
            const v = s[k];
            if (v !== "none" && gearItems[v] && !ownedGear.has(v)) s[k] = "none";
        });
        if (job && gearItems[s.outfit] && !ownedGear.has(s.outfit)) s.outfit = GEAR[job].outfit[0].id;
        return s;
    };

    const handleSave = async () => {
        if (!cfg || !userId || loading) return;
        setLoading(true); setMsg("");
        const { error } = await supabase.from("profiles").update({ avatar_config: sanitizeCfg(cfg) }).eq("id", userId);
        if (error) { setMsg("保存に失敗しました。もう一度お試しください（" + error.message + "）"); setLoading(false); return; }
        setMsg("✅ アバターを保存しました！");
        setTimeout(() => router.push(fromMypage ? backTo : "/onboarding/confirm"), 700);
    };

    const jobInfo = useMemo(() => JOBS.find((j) => j.key === job), [job]);
    const gear = job ? GEAR[job] : null;

    // 装備の販売状態：null=無料 or 購入済み（通常どおり選べる）
    const paidOf = (id: string): { st: "locked" | "pending"; item: GearItem } | null => {
        const it = gearItems[id];
        if (!it || id === "none" || ownedGear.has(id)) return null;
        return { st: pendingGear.has(id) ? "pending" : "locked", item: it };
    };

    const requestBuyGear = async () => {
        if (!buyGear || !userId || buying) return;
        if (points < buyGear.price) { setMsg("ポイントが足りません"); setBuyGear(null); return; }
        setBuying(true);
        const { error } = await supabase.from("gear_purchases").insert({ user_id: userId, item_id: buyGear.id, status: "pending" });
        if (error) { setMsg("申請に失敗しました（" + error.message + "）"); setBuying(false); setBuyGear(null); return; }
        setPendingGear((prev) => new Set([...prev, buyGear.gear_key]));
        setBuying(false); setBuyGear(null);
        setMsg("✅ 購入を申請しました！承認されると装備できるようになります");
    };

    const Opts = ({ list, value, onPick, swatch, paid }: { list: Part[]; value: string; onPick: (id: string) => void; swatch?: boolean; paid?: boolean }) => (
        <div className="av-opts">
            {list.map((p) => {
                const pd = paid ? paidOf(p.id) : null;
                const click = () => {
                    if (!pd) { onPick(p.id); return; }
                    if (pd.st === "locked") setBuyGear(pd.item);
                    // pending は承認待ちのため何もしない
                };
                return (
                    <button key={p.id} type="button" className={"av-opt" + (value === p.id ? " on" : "") + (p.src === null ? " na" : "")} onClick={click} aria-pressed={value === p.id}>
                        {swatch && p.swatch && <span className="av-sw" style={{ background: p.swatch }} />}{p.label}
                        {pd?.st === "locked" && <span className="av-lock">🔒 {pd.item.price.toLocaleString()}pt</span>}
                        {pd?.st === "pending" && <span className="av-pend">⏳ 審査待ち</span>}
                    </button>
                );
            })}
        </div>
    );

    return (
        <>
            <style>{CSS}</style>
            <main className="av-root">
                <div className="av-top">
                    <div className="av-prog">{STEPS.map((s, i) => <span key={s} className={i === STEP_NOW ? "on" : i < STEP_NOW ? "done" : ""}>{i + 1}. {s}</span>)}</div>
                    <button className="av-back" type="button" onClick={() => router.push(fromMypage ? backTo : "/onboarding/job")}>{fromMypage ? (from === "home" ? "← キャンセル（ホームへ）" : "← キャンセル（マイページへ）") : "← 職業選択へ"}</button>
                </div>
                <div style={{ textAlign: "center" }}>
                    <div className="av-h"><h1>{fromMypage ? "アバターを編集" : "アバターをつくろう"}</h1><p>{fromMypage ? (from === "home" ? "保存するとホームに反映されます。" : "保存するとマイページに反映されます。") : "見た目は、あとからマイページで変えられます。"}</p></div>
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
                                    <div className="av-sec"><div className="av-lab">肌の色</div><Opts list={SKIN} value={cfg.skin} onPick={(v) => set("skin", v)} swatch /></div>
                                    <div className="av-sec"><div className="av-lab">髪型</div><Opts list={HAIR[cfg.base]} value={cfg.hair} onPick={(v) => set("hair", v)} /></div>
                                    <div className="av-sec"><div className="av-lab">髪の色</div><Opts list={HAIR_COLOR} value={cfg.hairColor} onPick={(v) => set("hairColor", v)} swatch /></div>
                                </>
                            ) : (
                                <>
                                    {Object.keys(gearItems).length > 0 && <div className="av-bal">💰 所持ポイント {points.toLocaleString()}pt<span style={{ fontWeight: 700, color: "#92751f", marginLeft: 8 }}>🔒は購入するとずっと使えるよ</span></div>}
                                    <div className="av-sec"><div className="av-lab">衣装<small>職業の初期装備</small></div><Opts list={gear.outfit} value={cfg.outfit} onPick={(v) => set("outfit", v)} paid /></div>
                                    <div className="av-sec"><div className="av-lab">帽子・頭飾り</div><Opts list={gear.head} value={cfg.head} onPick={(v) => set("head", v)} paid /></div>
                                    <div className="av-sec"><div className="av-lab">マント</div><Opts list={gear.cape} value={cfg.cape} onPick={(v) => set("cape", v)} paid /></div>
                                    <div className="av-sec"><div className="av-lab">武器</div><Opts list={gear.weapon} value={cfg.weapon} onPick={(v) => set("weapon", v)} paid /></div>
                                    <div className="av-sec"><div className="av-lab">アクセサリー</div><Opts list={gear.accessory} value={cfg.accessory} onPick={(v) => set("accessory", v)} paid /></div>
                                </>
                            )}
                            <div className="av-foot">
                                {msg && <div className={"av-msg " + (msg.startsWith("✅") ? "ok" : "ng")}>{msg}</div>}
                                <button className="av-next" type="button" disabled={loading} onClick={handleSave}>{loading ? "保存中…" : "この見た目で決定 →"}</button>
                            </div>
                        </section>
                    </div>
                )}
                {/* 装備の購入申請モーダル（承認時にポイントが引かれる＝島ショップと同じフロー） */}
                {buyGear && (
                    <div className="av-buyw" onClick={() => setBuyGear(null)}>
                        <div className="av-buy" onClick={(e) => e.stopPropagation()}>
                            <div style={{ fontSize: 32 }}>🗡️✨</div>
                            <div className="nm">{buyGear.name}</div>
                            <div className="pr">🪙 {buyGear.price.toLocaleString()}pt</div>
                            <div className="bal">所持 {points.toLocaleString()}pt → 残り {(points - buyGear.price).toLocaleString()}pt</div>
                            <div className="note">申請後、管理者が承認した時点でポイントが引かれ、装備できるようになります</div>
                            <button className="av-next" style={{ height: 48, fontSize: 15 }} type="button" disabled={buying || points < buyGear.price} onClick={requestBuyGear}>
                                {points < buyGear.price ? "ポイントが足りません" : buying ? "申請中…" : "購入を申請する"}
                            </button>
                            <button className="cancel" type="button" onClick={() => setBuyGear(null)}>やめる</button>
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}
