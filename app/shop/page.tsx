"use client";
// 王国のポイントショップ。タブは「⚔️ 装備」「🏝️ 島」の2つ。
// ・装備＝アバター装備（gear_items / gear_purchases、自分の職業のもの）。購入は shop_buy_gear()。島バトルの武器は battle_server.sql 適用後のみ下段に表示。価格と所持は battle_weapon_prices / battle_weapon_owned、購入は battle_buy_weapon()（サーバー側で残高確認と減算を一括処理）
// ・島＝既存の island_items / island_purchases をそのまま利用（購入は申請→管理者の承認でポイント減算、という従来の流れ）。設置は profiles.island_config
// ・旧「景品」「アバター」タブは画面から外しただけで、データ（shop_items / point_requests / avatar_items / avatar_purchases）には触れない
// ・使うポイントは user_points.points（育成ポイント）。累計pt・バトルの戦績とは別
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { ELEMENTS, SKILLS, loadWeaponShop, listedWeapons, weaponAtk, saleState, saleLabel, needsEventJoin, loadEventJoin, EVENT_BUY_RULE, type WeaponDef, type WeaponShop } from "../lib/battle";
import { ITEM_IMG, ISLAND_CATS, PLACE_LIMIT, placedOf, skyListOf } from "../lib/island";
import { GEAR, ASSET_V } from "../lib/avatar/catalog";
import { GEAR_BOX } from "../lib/avatar/gearThumb";
import { JOBS, type JobKey } from "../onboarding/job/page";

// アバター装備（gear_items）。自分の職業の装備だけを売る（他職業の装備は身につけられないため）
type GearItem = { id: string; gear_key: string; job: string; slot: string; name: string; price: number; rarity: string };
const SLOTS: { key: string; label: string }[] = [
    { key: "weapon", label: "⚔️ 武器" }, { key: "head", label: "🎩 帽子・頭飾り" }, { key: "cape", label: "🧥 マント" }, { key: "accessory", label: "💎 アクセサリー" },
];
/** 関数がまだ無い（shop_instant_buy.sql 未実行）ときのエラーかどうか */
const noFn = (e: any) => !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function|does not exist/i.test(e.message || ""));
type IslandItem = { id: string; name: string; category: string; emoji: string | null; css_key: string; price: number; rarity: string; max_owned?: number; sale_from?: string | null; sale_until?: string | null; require_event?: string | null };
/** 盾（守りの効果を持つ武器） */
const isShield = (w: WeaponDef) => !!(w.selfShieldHours || w.selfHeal || w.passive);
// 期間限定の島アイテム：before＝販売前／on＝販売中／after＝販売終了／always＝いつでも
const iSale = (it: IslandItem): "always" | "before" | "on" | "after" => { if (!it.sale_from && !it.sale_until) return "always"; const n = Date.now(); if (it.sale_from && n < new Date(it.sale_from).getTime()) return "before"; if (it.sale_until && n >= new Date(it.sale_until).getTime()) return "after"; return "on"; };
const iSaleMd = (iso: string, shift = 0) => { const d = new Date(new Date(iso).getTime() + 9 * 3600e3 + shift); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
const ISLAND_IMG: Record<string, string> = ITEM_IMG;
const CATS = ISLAND_CATS;

export default function ShopPage() {
    const router = useRouter();
    const [userId, setUserId] = useState("");
    const [points, setPoints] = useState(0);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<"gear" | "island">("gear");
    const [shop, setShop] = useState<WeaponShop>({ enabled: false, prices: {}, owned: new Set() });
    const [islandItems, setIslandItems] = useState<IslandItem[]>([]);
    const [evJoin, setEvJoin] = useState<Set<string>>(new Set());   // 期間限定の品を買える条件を満たしているイベント（表示用。購入時にサーバーでもう一度確認）
    const [ownedIsland, setOwnedIsland] = useState<string[]>([]);
    const [pendingIsland, setPendingIsland] = useState<string[]>([]);
    const [islandConfig, setIslandConfig] = useState<Record<string, any>>({});
    const [job, setJob] = useState<JobKey | null>(null);
    const [gearItems, setGearItems] = useState<GearItem[]>([]);
    const [ownedGear, setOwnedGear] = useState<string[]>([]);
    const [pendingGear, setPendingGear] = useState<string[]>([]);
    const [selG, setSelG] = useState<GearItem | null>(null);        // アバター装備の詳細
    const [selW, setSelW] = useState<WeaponDef | null>(null);       // 武器の詳細
    const [selI, setSelI] = useState<IslandItem | null>(null);      // 島アイテムの詳細
    const [busy, setBusy] = useState(false);
    const [askAt, setAskAt] = useState(0);   // 購入確認を出した時刻（0=未表示）。出た直後の連打で確定しないよう少し待つ
    const confirmOk = () => askAt > 0 && Date.now() - askAt > 450;
    const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
    const [done, setDone] = useState<{ title: string; sub: string; img: string | null; emoji: string; gear?: string; go?: "avatar" | "edit" } | null>(null);  // 購入完了の演出

    useEffect(() => { try { if (new URLSearchParams(window.location.search).get("tab") === "island") setTab("island"); } catch {} }, []);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const [{ data: pointRow }, { data: profRow }, { data: isItems }, { data: isPur }, ws, { data: gItems }, { data: gPur }] = await Promise.all([
                supabase.from("user_points").select("points").eq("id", user.id).maybeSingle(),
                supabase.from("profiles").select("island_config, job_class").eq("id", user.id).maybeSingle(),
                supabase.from("island_items").select("*").eq("is_active", true).order("sort_order"),
                supabase.from("island_purchases").select("item_id,status").eq("user_id", user.id),
                loadWeaponShop(supabase, user.id),
                supabase.from("gear_items").select("id, gear_key, job, slot, name, price, rarity").eq("is_active", true).order("sort_order"),
                supabase.from("gear_purchases").select("item_id, status").eq("user_id", user.id),
            ]);
            const j = (profRow as any)?.job_class as JobKey | undefined;
            const myJob = j && JOBS.some((x) => x.key === j) ? j : null;
            setJob(myJob);
            // 自分の職業の装備のうち、いまアバター編集で選べるもの（カタログに残っているもの）だけを並べる
            const live = new Set<string>(myJob ? (["head", "cape", "weapon", "accessory"] as const).flatMap((sl) => GEAR[myJob][sl].map((x) => x.id)) : []);
            setGearItems(((gItems || []) as GearItem[]).filter((g) => g.job === myJob && live.has(g.gear_key) && GEAR_BOX[g.gear_key]));
            setOwnedGear((gPur || []).filter((x: any) => x.status === "approved").map((x: any) => x.item_id));
            setPendingGear((gPur || []).filter((x: any) => x.status === "pending").map((x: any) => x.item_id));
            setPoints((pointRow as any)?.points || 0);
            setIslandConfig(((profRow as any)?.island_config || {}) as Record<string, any>);
            // 画像がまだ無いアイテムは並べない（絵文字で代用しない）
            setIslandItems(((isItems || []) as IslandItem[]).filter((it) => !!ITEM_IMG[it.css_key]));
            loadEventJoin(supabase, ((isItems || []) as IslandItem[]).map((it) => it.require_event || "")).then(setEvJoin);
            setOwnedIsland((isPur || []).filter((p: any) => p.status === "approved").map((p: any) => p.item_id));
            setPendingIsland((isPur || []).filter((p: any) => p.status === "pending").map((p: any) => p.item_id));
            setShop(ws);
            setLoading(false);
        };
        load();
    }, [router]);

    const flash = (ok: boolean, text: string) => { setToast({ ok, text }); setTimeout(() => setToast(null), 3800); };

    // ---- 武器を買う：残高確認・減算・所持記録はすべてサーバー側（battle_buy_weapon）。画面は結果を受け取って表示するだけ ----
    const buyWeapon = async (w: WeaponDef) => {
        if (busy || !shop.enabled) return;
        setBusy(true);
        const { data, error } = await supabase.rpc("battle_buy_weapon", { p_weapon: w.key });
        setBusy(false);
        if (error || !data) {
            const m = error?.message || "";
            flash(false, m.includes("NOT_PARTICIPANT") ? EVENT_BUY_RULE : m.includes("NOT_ON_SALE") ? "この武器は、いまは販売期間外です" : m.includes("NO_POINTS") ? "ポイントが足りません" : m.includes("ALREADY_OWNED") ? "この武器はすでに持っています" : "購入できませんでした。もう一度お試しください");
            if (m.includes("ALREADY_OWNED")) setShop((s) => ({ ...s, owned: new Set([...s.owned, w.key]) }));
            return;
        }
        setPoints(Number((data as any).points));
        setShop((s) => ({ ...s, owned: new Set([...s.owned, w.key]) }));
        setSelW(null);
        setDone({ title: "購入完了！", sub: `「${w.name}」を手に入れた！ 島バトルで使えます`, img: w.img, emoji: w.emoji });
    };

    // ---- アバター装備・島アイテムを買う：サーバー側の購入処理（shop_buy_gear / shop_buy_island）でその場で購入。
    //      残高確認・減算・所持の記録はサーバーが一括で行う。その処理がまだ無い環境では、従来どおり「申請→管理者の承認」になる ----
    const buyGear = async (g: GearItem) => {
        if (busy || !userId) return;
        if (points < g.price) { flash(false, "ポイントが足りません"); return; }
        setBusy(true);
        const { data, error } = await supabase.rpc("shop_buy_gear", { p_item: g.id });
        if (!error && data) {
            setBusy(false);
            setPoints(Number((data as any).points)); setOwnedGear((p) => [...p, g.id]); setPendingGear((p) => p.filter((x) => x !== g.id)); setSelG(null);
            setDone({ title: "購入完了！", sub: `「${g.name}」を手に入れた！ アバター編集で身につけられます`, img: null, emoji: "🎁", gear: g.gear_key, go: "avatar" });
            return;
        }
        if (!noFn(error)) {
            setBusy(false);
            const m = error?.message || "";
            if (m.includes("ALREADY_OWNED")) { setOwnedGear((p) => [...p, g.id]); setSelG(null); }
            flash(false, m.includes("NO_POINTS") ? "ポイントが足りません" : m.includes("ALREADY_OWNED") ? "この装備はすでに持っています" : "購入できませんでした。もう一度お試しください");
            return;
        }
        const { error: e2 } = await supabase.from("gear_purchases").insert({ user_id: userId, item_id: g.id, status: "pending" });
        setBusy(false);
        if (e2) { flash(false, "申請できませんでした。もう一度お試しください"); return; }
        setPendingGear((p) => [...p, g.id]); setSelG(null);
        setDone({ title: "購入を申請しました！", sub: `「${g.name}」は承認されると使えるようになります（ポイントは承認時に引かれます）`, img: null, emoji: "🎁", gear: g.gear_key });
    };
    const requestIsland = async (it: IslandItem) => {
        if (busy || !userId) return;
        if (points < it.price) { flash(false, "ポイントが足りません"); return; }
        setBusy(true);
        const { data, error } = await supabase.rpc("shop_buy_island", { p_item: it.id });
        if (!error && data) {
            setBusy(false);
            setPoints(Number((data as any).points)); setOwnedIsland((p) => [...p, it.id]); setPendingIsland((p) => p.filter((x) => x !== it.id)); setSelI(null);
            setDone({ title: "購入完了！", sub: `「${it.name}」を手に入れた！ 飾りつけ画面で島に置けます`, img: ISLAND_IMG[it.css_key] || null, emoji: it.emoji || "🎁", go: "edit" });
            return;
        }
        if (!noFn(error)) {
            setBusy(false);
            const m = error?.message || "";
            if (m.includes("ALREADY_OWNED")) setSelI(null);
            flash(false, m.includes("NOT_PARTICIPANT") ? EVENT_BUY_RULE : m.includes("NOT_ON_SALE") ? "このアイテムは、いまは販売期間外です" : m.includes("NO_POINTS") ? "ポイントが足りません" : m.includes("ALREADY_OWNED") ? "これ以上は持てません" : "購入できませんでした。もう一度お試しください");
            return;
        }
        const { error: e2 } = await supabase.from("island_purchases").insert({ user_id: userId, item_id: it.id, status: "pending" });
        setBusy(false);
        if (e2) { flash(false, "申請できませんでした。もう一度お試しください"); return; }
        setPendingIsland((p) => [...p, it.id]); setSelI(null);
        setDone({ title: "購入を申請しました！", sub: `「${it.name}」は承認されると使えるようになります（ポイントは承認時に引かれます）`, img: ISLAND_IMG[it.css_key] || null, emoji: it.emoji || "🎁" });
    };
    if (loading) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#7fc3ef", color: "#fff", fontWeight: 900 }}>🛍️ ショップを開いています...</div>;

    const wState = (w: WeaponDef) => {
        const price = shop.prices[w.key] ?? 0;
        if (!shop.enabled) return { kind: "free", label: "使用可能", price };
        if (price === 0) return { kind: "owned", label: "はじめから所持", price };
        if (shop.owned.has(w.key)) return { kind: "owned", label: "所持済み", price };
        if (saleState(shop, w.key) === "before") return { kind: "soon", label: `${saleLabel(shop, w.key).split("〜")[0]}から販売`, price };
        if (saleState(shop, w.key) === "after") return { kind: "soon", label: "販売終了", price };
        if (needsEventJoin(shop, w.key)) return { kind: "join", label: "学習コンテンツを見ると買える", price };
        if (points < price) return { kind: "short", label: `あと ${(price - points).toLocaleString()}pt`, price };
        return { kind: "buy", label: "購入できます", price };
    };
    const gState = (g: GearItem) => {
        if (ownedGear.includes(g.id)) return { kind: "owned", label: "所持済み" };
        if (pendingGear.includes(g.id)) return { kind: "pending", label: "承認待ち" };
        if (points < g.price) return { kind: "short", label: `あと ${(g.price - points).toLocaleString()}pt` };
        return { kind: "buy", label: "購入できます" };
    };
    // 装備レイヤー画像から、装備が描かれている部分だけを枠いっぱいに見せる（画像は加工しない）
    const GImg = ({ k, size }: { k: string; size: number }) => {
        const b = GEAR_BOX[k]; if (!b) return <span style={{ fontSize: size * 0.6 }}>🎁</span>;
        const [slot, x, y, w, h, W, H] = b; const sc = (size * 0.94) / Math.max(w, h);
        return <span role="img" aria-label="" style={{ display: "block", width: size, height: size, backgroundImage: `url(/avatar/${slot}/${k}.png?v=${ASSET_V})`, backgroundRepeat: "no-repeat", backgroundSize: `${W * sc}px ${H * sc}px`, backgroundPosition: `${(size - w * sc) / 2 - x * sc}px ${(size - h * sc) / 2 - y * sc}px` }} />;
    };
    // 島アイテムの状態。have=持っている数、max=持てる数（木・装飾・動物は複数、地面・空は1）、placed=いま島に置いている数
    const iState = (it: IslandItem) => {
        const have = ownedIsland.filter((id) => id === it.id).length; const max = it.max_owned || 1;
        const placed = it.category === "ground" ? (islandConfig.ground === it.css_key ? 1 : 0) : it.category === "sky" ? (skyListOf(islandConfig).includes(it.css_key) ? 1 : 0) : placedOf(islandConfig).filter((q) => q.k === it.css_key).length;
        const extra = { have, max, placed };
        if (pendingIsland.includes(it.id)) return { kind: "pending", label: "承認待ち", ...extra };
        if (have >= max) return { kind: "owned", label: "所持済み", ...extra };
        if (iSale(it) === "before") return { kind: "soon", label: `${iSaleMd(it.sale_from!)}から販売`, ...extra };
        if (iSale(it) === "after") return { kind: "soon", label: "販売終了", ...extra };
        if (it.require_event && !evJoin.has(it.require_event)) return { kind: "join", label: "学習コンテンツを見ると買える", ...extra };
        if (points < it.price) return { kind: have ? "more-short" : "short", label: `あと ${(it.price - points).toLocaleString()}pt`, ...extra };
        return { kind: have ? "more" : "buy", label: "購入できます", ...extra };
    };
    // 既存データのレアリティ表記をバッジ用にそろえる（normal/common などの通常品はバッジなし）
    const rare = (r: string | null | undefined): string | null => {
        const v = (r || "").trim().toLowerCase();
        if (!v || ["normal", "common", "n", "none"].includes(v)) return null;
        if (["ssr", "legend", "legendary"].includes(v)) return "SSR";
        if (["sr", "epic", "super_rare"].includes(v)) return "SR";
        if (["r", "rare"].includes(v)) return "R";
        return v.toUpperCase().slice(0, 4);
    };
    const WImg = ({ w, size }: { w: WeaponDef; size: number }) => w.img ? <img src={w.img} alt={w.name} style={{ width: size, height: size, objectFit: "contain" }} /> : <span style={{ fontSize: size * 0.7 }}>{w.emoji}</span>;
    const IImg = ({ it, size }: { it: IslandItem; size: number }) => ISLAND_IMG[it.css_key] ? <img src={ISLAND_IMG[it.css_key]} alt={it.name} style={{ width: size, height: size, objectFit: "contain" }} /> : <span style={{ fontSize: size * 0.66 }}>{it.emoji || "🎁"}</span>;
    const El = ({ k }: { k: keyof typeof ELEMENTS }) => { const e = ELEMENTS[k]; return <span style={{ color: e.color, fontWeight: 900 }}>{e.img ? <img src={e.img} alt="" style={{ width: 14, height: 14, verticalAlign: "-2px" }} /> : e.emoji} {e.name}</span>; };

    // カード1枚の描画（通常の段と「期間限定」の段の両方で使う）
    const islandCard = (it: IslandItem) => {
            const st = iState(it);
            const canBuy = st.kind === "buy" || st.kind === "more"; const short = st.kind === "short" || st.kind === "more-short";
            return (
                <button key={it.id} className={"sp-card sp-st-" + (st.kind === "short" ? "short" : st.kind)} onClick={() => { setAskAt(0); setSelI(it); }}>
                    {st.placed > 0 ? <span className="sp-ribbon on">✓ 設置中{st.max > 1 ? ` ${st.placed}個` : ""}</span>
                        : st.have > 0 ? <span className="sp-ribbon">✓ 所持{st.max > 1 ? ` ${st.have}/${st.max}` : "済み"}</span> : null}
                    {st.kind === "pending" && <span className="sp-ribbon wait">⏳ 承認待ち</span>}
                    {rare(it.rarity) && <span className={"sp-rare sp-rare-" + rare(it.rarity)!.toLowerCase()}>{rare(it.rarity)}</span>}
                    {iSale(it) !== "always" && st.have === 0 && st.kind !== "pending" && <span className="sp-ribbon" style={{ background: "linear-gradient(180deg,#f472b6,#be185d)" }}>期間限定</span>}
                    <span className="sp-card-img"><IImg it={it} size={104} /></span>
                    <span className="sp-card-name">{it.name}</span>
                    <span className="sp-card-sub">{it.max_owned && it.max_owned > 1 ? `${it.max_owned}個まで持てる` : "1つ持てばOK"}</span>
                    {st.kind === "soon" ? <span className="sp-price have">{st.label}</span> : st.kind === "join" ? <span className="sp-price have">🪙 {it.price.toLocaleString()}pt・学習すると買える</span> : canBuy || short || st.kind === "pending"
                        ? <span className={"sp-price" + (short ? " short" : "")}>🪙 {it.price.toLocaleString()}pt{short && <i>{st.label}</i>}</span>
                        : <span className="sp-price have">飾りつけで使える</span>}
                </button>
            );
    };
    const weaponCard = (w: WeaponDef) => {
            const st = wState(w);
            return (
                <button key={w.key} className={"sp-card sp-st-" + st.kind} onClick={() => { setAskAt(0); setSelW(w); }}>
                    {st.kind === "owned" && <span className="sp-ribbon">✓ {st.label}</span>}
                    {w.limited && st.kind !== "owned" && <span className="sp-ribbon" style={{ background: "linear-gradient(180deg,#f472b6,#be185d)" }}>期間限定</span>}
                    <span className="sp-card-img"><WImg w={w} size={112} /></span>
                    <span className="sp-card-name">{w.name}</span>
                    <span className="sp-card-sub">攻撃 {w.limited ? `${w.atk}〜${w.limited.atkMax}` : w.atk}・{w.element ? <El k={w.element} /> : "無属性"}</span>
                    {st.kind === "soon" || st.kind === "join" ? <span className="sp-price have">{st.kind === "join" ? `🪙 ${st.price.toLocaleString()}pt・学習すると買える` : st.label}</span> : shop.enabled && st.price > 0 && !shop.owned.has(w.key)
                        ? <span className={"sp-price" + (st.kind === "short" ? " short" : "")}>🪙 {st.price.toLocaleString()}pt{st.kind === "short" && <i>{st.label}</i>}</span>
                        : <span className="sp-price have">{st.kind === "free" ? "使用可能" : "島バトルで使える"}</span>}
                </button>
            );
    };

    return (
        <div className="sp-root">
            <style>{CSS}</style>

            <header className="sp-head">
                <div className="sp-left"><button className="sp-back" onClick={() => router.push("/menu")}>← メニュー</button><span className="sp-logo">INTERN<br />QUEST</span></div>
                <div className="sp-sign">
                    <span className="sp-sign-main">🛍️ ポイントショップ</span>
                </div>
                <div className="sp-pt"><div className="sp-pt-box"><span>所持ポイント</span><b>🪙 {points.toLocaleString()}<i>pt</i></b></div></div>
            </header>
            <p className="sp-copy"><span>ポイントを使って、装備や島のアイテムを手に入れよう</span></p>

            <div className="sp-tabs">
                <button className={"sp-tab" + (tab === "gear" ? " on" : "")} onClick={() => setTab("gear")}>⚔️ 装備</button>
                <button className={"sp-tab" + (tab === "island" ? " on" : "")} onClick={() => setTab("island")}>🏝️ 島</button>
            </div>

            <main className="sp-main">
                {tab === "gear" && (
                    <>
                        {!job && <div className="sp-info">まず職業を選ぶと、その職業の装備が買えるようになります</div>}
                        {job && gearItems.length === 0 && <div className="sp-info">いま販売中の装備はありません</div>}
                        {SLOTS.map((sl) => {
                            const list = gearItems.filter((g) => g.slot === sl.key);
                            if (!list.length) return null;
                            return (
                                <section key={sl.key}>
                                    <div className="sp-sec">{sl.label}<i>{JOBS.find((x) => x.key === job)?.name}の装備</i></div>
                                    <div className="sp-grid">
                                        {list.map((g) => {
                                            const st = gState(g);
                                            return (
                                                <button key={g.id} className={"sp-card sp-st-" + st.kind} onClick={() => { setAskAt(0); setSelG(g); }}>
                                                    {st.kind === "owned" && <span className="sp-ribbon">✓ 所持済み</span>}
                                                    {st.kind === "pending" && <span className="sp-ribbon wait">⏳ 承認待ち</span>}
                                                    {rare(g.rarity) && <span className={"sp-rare sp-rare-" + rare(g.rarity)!.toLowerCase()}>{rare(g.rarity)}</span>}
                                                    <span className="sp-card-img"><GImg k={g.gear_key} size={112} /></span>
                                                    <span className="sp-card-name">{g.name}</span>
                                                    {st.kind === "owned"
                                                        ? <span className="sp-price have">アバターで使える</span>
                                                        : <span className={"sp-price" + (st.kind === "short" ? " short" : "")}>🪙 {g.price.toLocaleString()}pt{st.kind === "short" && <i>{st.label}</i>}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        })}
                        {shop.enabled && (<>
                        {listedWeapons(shop).some((w) => w.limited) && (<>
                        <div className="sp-sec sp-sec-ltd">❄ 期間限定<i>冬の学び祭のあいだだけ手に入る武器</i></div>
                        <div className="sp-grid sp-grid-ltd">{listedWeapons(shop).filter((w) => w.limited).map(weaponCard)}</div>
                        </>)}
                        <div className="sp-sec">⚔️ 島バトルの武器</div>
                        <div className="sp-grid">
                            {listedWeapons(shop).filter((w) => !w.limited && !isShield(w)).map(weaponCard)}
                        </div>
                        {listedWeapons(shop).some((w) => !w.limited && isShield(w)) && (<>
                        <div className="sp-sec">🛡️ 盾<i>攻めながら自分の城を守る</i></div>
                        <div className="sp-grid">{listedWeapons(shop).filter((w) => !w.limited && isShield(w)).map(weaponCard)}</div>
                        </>)}
                        </>)}
                        <button className="sp-link" onClick={() => router.push("/onboarding/avatar?from=mypage&tab=gear")}>
                            <span style={{ fontSize: 26 }}>🧍</span>
                            <span><b>買った装備を身につける</b><i>アバター編集で、帽子・マント・武器・アクセサリーを着せ替えできます</i></span>
                            <span className="sp-link-go">›</span>
                        </button>
                    </>
                )}

                {tab === "island" && (
                    <>
                        {islandItems.length === 0 && <div className="sp-info">まだ島のアイテムがありません</div>}
                        {/* 期間限定の段：販売期間があるアイテムは、種類に関係なくここにまとめる（販売が終わったものは、持っている人にだけ見せる） */}
                        {(() => {
                            const ltd = islandItems.filter((it) => iSale(it) !== "always" && !(iSale(it) === "after" && !ownedIsland.includes(it.id)));
                            if (!ltd.length) return null;
                            return (
                                <section>
                                    <div className="sp-sec sp-sec-ltd">❄ 期間限定<i>冬の学び祭のあいだだけ買える飾り</i></div>
                                    <div className="sp-grid sp-grid-ltd">{ltd.map(islandCard)}</div>
                                </section>
                            );
                        })()}
                        {CATS.map((c) => {
                            const list = islandItems.filter((it) => it.category === c.key && iSale(it) === "always");   // 販売が終わった期間限定品は、持っている人にだけ見せる
                            if (!list.length) return null;
                            return (
                                <section key={c.key}>
                                    <div className="sp-sec">{c.label}<i>{c.key === "ground" ? "島全体の地面を1種類えらべます" : `島に${PLACE_LIMIT[c.key]}個まで置けます`}</i></div>
                                    <div className="sp-grid">
                                        {list.map(islandCard)}
                                    </div>
                                </section>
                            );
                        })}
                        <button className="sp-link" onClick={() => router.push("/island/edit")}>
                            <span style={{ fontSize: 26 }}>🏝️</span>
                            <span><b>島の飾りつけへ</b><i>買ったアイテムを島に置く・動かす。ホームの島と「みんなの島」に同じ島が出ます</i></span>
                            <span className="sp-link-go">›</span>
                        </button>
                    </>
                )}
            </main>

            {/* 武器の詳細 */}
            {selW && (() => {
                const w = selW; const st = wState(w);
                return (
                    <div className="sp-modal-bg" onClick={() => !busy && setSelW(null)}>
                        <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="sp-modal-img"><WImg w={w} size={150} /></div>
                            <h3>{w.name}</h3>
                            <p className="sp-desc">{w.desc}</p>
                            <div className="sp-stats">
                                <div><span>属性</span><b>{w.element ? <El k={w.element} /> : "無属性"}</b></div>
                                <div><span>攻撃力</span><b>{w.limited ? `いまのあなたは ${weaponAtk(w, shop)}（${w.atk}〜${w.limited.atkMax}）` : w.atk}</b></div>
                                <div><span>特殊効果</span><b>{w.limited ? w.limited.special : w.selfShieldHours ? `攻撃すると自分の城に${w.selfShieldHours}時間のシールド` : w.selfHeal ? `攻撃すると自分の城のHPが${w.selfHeal}回復` : w.passive ? w.passive : w.skill ? `${SKILLS[w.skill].name}（発動率${Math.round(w.skillRate * 100)}%）` : w.critBonus > 0 ? `クリティカル率 +${Math.round(w.critBonus * 100)}%` : "なし"}</b></div>
                                {shop.needEvent?.[w.key] && <div><span>買える人</span><b>{needsEventJoin(shop, w.key) ? "まだ買えません（条件は下）" : "✓ あなたは買えます"}</b></div>}
                                {w.limited && saleLabel(shop, w.key) && <div><span>販売期間</span><b>{saleLabel(shop, w.key)}（買えば期間後も使える）</b></div>}
                                {shop.enabled && st.price > 0 && <div><span>必要ポイント</span><b>🪙 {st.price.toLocaleString()}pt</b></div>}
                                <div><span>所持状況</span><b>{st.kind === "owned" ? st.label : st.kind === "free" ? "使用可能" : "未所持"}</b></div>
                            </div>
                            {st.kind === "soon" && <button className="sp-buy off" disabled>{st.label}</button>}
                            {st.kind === "join" && <><div className="sp-after" style={{ lineHeight: 1.7 }}>{EVENT_BUY_RULE}。</div><button className="sp-buy alt" onClick={() => router.push("/learn")}>学習コンテンツの「次に見る1本」へ</button></>}
                            {st.kind === "buy" && askAt === 0 && <button className="sp-buy" onClick={() => setAskAt(Date.now())}>🪙 {st.price.toLocaleString()}pt で購入する</button>}
                            {st.kind === "buy" && askAt > 0 && (
                                <div className="sp-ask">
                                    <b>「{w.name}」を {st.price.toLocaleString()}pt で購入しますか？</b>
                                    <div><button className="sp-no" disabled={busy} onClick={() => setAskAt(0)}>やめる</button><button className="sp-buy" disabled={busy} onClick={() => confirmOk() && buyWeapon(w)}>{busy ? "購入中..." : "購入する"}</button></div>
                                </div>
                            )}
                            {st.kind === "short" && <button className="sp-buy off" disabled>ポイントが足りません（{st.label}）</button>}
                            {st.kind === "buy" && <div className="sp-after">購入後の残り：{(points - st.price).toLocaleString()}pt</div>}
                            {(st.kind === "owned" || st.kind === "free") && <button className="sp-buy alt" onClick={() => router.push("/islands")}>⚔️ 島バトルへ行く</button>}
                            <button className="sp-close" onClick={() => setSelW(null)} disabled={busy}>とじる</button>
                        </div>
                    </div>
                );
            })()}

            {/* アバター装備の詳細 */}
            {selG && (() => {
                const g = selG; const st = gState(g);
                return (
                    <div className="sp-modal-bg" onClick={() => !busy && setSelG(null)}>
                        <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="sp-modal-img"><GImg k={g.gear_key} size={156} /></div>
                            <h3>{g.name}</h3>
                            <div className="sp-stats">
                                <div><span>種類</span><b>{SLOTS.find((x) => x.key === g.slot)?.label || g.slot}</b></div>
                                <div><span>職業</span><b>{JOBS.find((x) => x.key === g.job)?.name || g.job}</b></div>
                                {rare(g.rarity) && <div><span>レアリティ</span><b>{rare(g.rarity)}</b></div>}
                                <div><span>必要ポイント</span><b>🪙 {g.price.toLocaleString()}pt</b></div>
                                <div><span>所持状況</span><b>{st.kind === "owned" ? "所持済み" : st.kind === "pending" ? "承認待ち" : "未所持"}</b></div>
                            </div>
                            {st.kind === "buy" && askAt === 0 && <button className="sp-buy" onClick={() => setAskAt(Date.now())}>🪙 {g.price.toLocaleString()}pt で購入する</button>}
                            {st.kind === "buy" && askAt > 0 && (
                                <div className="sp-ask">
                                    <b>「{g.name}」を {g.price.toLocaleString()}pt で購入しますか？</b>
                                    <div><button className="sp-no" disabled={busy} onClick={() => setAskAt(0)}>やめる</button><button className="sp-buy" disabled={busy} onClick={() => confirmOk() && buyGear(g)}>{busy ? "購入中..." : "購入する"}</button></div>
                                </div>
                            )}
                            {st.kind === "buy" && <div className="sp-after">購入後の残り：{(points - g.price).toLocaleString()}pt</div>}
                            {st.kind === "short" && <button className="sp-buy off" disabled>ポイントが足りません（{st.label}）</button>}
                            {st.kind === "pending" && <button className="sp-buy off" disabled>⏳ 承認をお待ちください</button>}
                            {st.kind === "owned" && <button className="sp-buy alt" onClick={() => router.push("/onboarding/avatar?from=mypage&tab=gear")}>🧍 アバター編集で身につける</button>}
                            <button className="sp-close" onClick={() => setSelG(null)} disabled={busy}>とじる</button>
                        </div>
                    </div>
                );
            })()}

            {/* 島アイテムの詳細 */}
            {selI && (() => {
                const it = selI; const st = iState(it);
                return (
                    <div className="sp-modal-bg" onClick={() => !busy && setSelI(null)}>
                        <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="sp-modal-img"><IImg it={it} size={150} /></div>
                            <h3>{it.name}</h3>
                            <div className="sp-stats">
                                <div><span>種類</span><b>{CATS.find((c) => c.key === it.category)?.label || it.category}</b></div>
                                <div><span>必要ポイント</span><b>🪙 {it.price.toLocaleString()}pt</b></div>
                                {iSale(it) !== "always" && <div><span>販売期間</span><b>{it.sale_from ? iSaleMd(it.sale_from) : ""}〜{it.sale_until ? iSaleMd(it.sale_until, -1000) : ""}（買えば期間後も置ける）</b></div>}
                                {rare(it.rarity) && <div><span>レアリティ</span><b>{rare(it.rarity)}</b></div>}
                                <div><span>所持状況</span><b>{st.kind === "pending" ? "承認待ち" : st.have > 0 ? `所持 ${st.have}${st.max > 1 ? `/${st.max}個` : ""}` : "未所持"}{st.placed > 0 ? `・設置中${st.max > 1 ? ` ${st.placed}個` : ""}` : ""}</b></div>
                                <div><span>設置できる数</span><b>{it.category === "ground" ? "1（島全体）" : `${st.max > 1 ? `持っている数まで（最大${st.max}個）` : "1"}`}</b></div>
                            </div>
                            {(st.kind === "buy" || st.kind === "more") && askAt === 0 && <button className="sp-buy" onClick={() => setAskAt(Date.now())}>🪙 {it.price.toLocaleString()}pt で{st.have > 0 ? "もう1個" : ""}購入する</button>}
                            {(st.kind === "buy" || st.kind === "more") && askAt > 0 && (
                                <div className="sp-ask">
                                    <b>「{it.name}」を {it.price.toLocaleString()}pt で購入しますか？</b>
                                    <div><button className="sp-no" disabled={busy} onClick={() => setAskAt(0)}>やめる</button><button className="sp-buy" disabled={busy} onClick={() => confirmOk() && requestIsland(it)}>{busy ? "購入中..." : "購入する"}</button></div>
                                </div>
                            )}
                            {(st.kind === "buy" || st.kind === "more") && <div className="sp-after">購入後の残り：{(points - it.price).toLocaleString()}pt</div>}
                            {st.kind === "soon" && <button className="sp-buy off" disabled>{st.label}</button>}
                            {st.kind === "join" && <><div className="sp-after" style={{ lineHeight: 1.7 }}>{EVENT_BUY_RULE}。</div><button className="sp-buy alt" onClick={() => router.push("/learn")}>学習コンテンツの「次に見る1本」へ</button></>}
                            {(st.kind === "short" || st.kind === "more-short") && <button className="sp-buy off" disabled>ポイントが足りません（{st.label}）</button>}
                            {st.kind === "pending" && <button className="sp-buy off" disabled>⏳ 承認をお待ちください</button>}
                            {st.have > 0 && <button className="sp-buy alt" style={{ marginTop: 8 }} onClick={() => router.push("/island/edit")}>🏝️ 飾りつけ画面で島に置く</button>}
                            <button className="sp-close" onClick={() => setSelI(null)} disabled={busy}>とじる</button>
                        </div>
                    </div>
                );
            })()}

            {/* 購入完了の演出 */}
            {done && (
                <div className="sp-modal-bg" onClick={() => setDone(null)}>
                    <div className="sp-done" onClick={(e) => e.stopPropagation()}>
                        <div className="sp-rays" />
                        {[...Array(10)].map((_, i) => <span key={i} className="sp-spark" style={{ left: `${8 + i * 9}%`, animationDelay: `${(i % 5) * 0.14}s` }}>✦</span>)}
                        <div className="sp-done-img">{done.gear ? <GImg k={done.gear} size={136} /> : done.img ? <img src={done.img} alt="" /> : <span>{done.emoji}</span>}</div>
                        <h3>{done.title}</h3>
                        <p>{done.sub}</p>
                        {done.go === "avatar" && <button className="sp-buy alt" style={{ marginBottom: 8 }} onClick={() => router.push("/onboarding/avatar?from=mypage&tab=gear")}>🧍 さっそく身につける</button>}
                        {done.go === "edit" && <button className="sp-buy alt" style={{ marginBottom: 8 }} onClick={() => router.push("/island/edit")}>🏝️ さっそく島に置く</button>}
                        <button className="sp-buy" onClick={() => setDone(null)}>OK</button>
                    </div>
                </div>
            )}

            {toast && <div className={"sp-toast" + (toast.ok ? " ok" : "")}>{toast.ok ? "✅ " : "⚠️ "}{toast.text}</div>}
        </div>
    );
}

const CSS = `
.sp-root{min-height:100vh;min-height:100dvh;background:#7fc3ef url(/images/onboarding/job-selection-bg.webp) center 22%/cover no-repeat fixed;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416;padding:14px 14px calc(44px + env(safe-area-inset-bottom));box-sizing:border-box}
.sp-head{max-width:1040px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.sp-back{border:2px solid #F5D77E;background:rgba(255,249,237,.95);color:#102F70;font-weight:900;font-size:12.5px;border-radius:999px;padding:9px 15px;cursor:pointer}
.sp-sign{display:flex;flex-direction:column;align-items:center;background:linear-gradient(180deg,#2f6ad1,#102F70);border:3px solid #F5D77E;border-radius:18px;padding:8px 30px 10px;box-shadow:0 6px 0 #0a1f4a,0 12px 24px rgba(16,47,112,.4),inset 0 2px 0 rgba(255,255,255,.3)}
.sp-sign-en{font-size:9.5px;font-weight:900;letter-spacing:4px;color:#F5D77E}
.sp-sign-main{font-size:24px;font-weight:900;color:#fff;letter-spacing:2px;text-shadow:0 2px 0 #0a1f4a}
.sp-pt{background:linear-gradient(180deg,#fffdf4,#f6e7c8);border:3px solid #D9A441;border-radius:16px;padding:6px 16px;text-align:right;box-shadow:0 5px 14px rgba(16,47,112,.25);position:sticky;top:8px;z-index:20}
.sp-pt span{display:block;font-size:10px;font-weight:900;color:#8a6a3a}
.sp-pt b{font-size:21px;font-weight:900;color:#17397d}
.sp-pt i{font-style:normal;font-size:12px;margin-left:2px}
.sp-copy{max-width:1040px;margin:12px auto 0;text-align:center;font-size:13px;font-weight:900;color:#fff;text-shadow:0 1px 6px rgba(16,47,112,.7)}
.sp-tabs{max-width:1040px;margin:14px auto 0;display:flex;gap:10px}
.sp-tab{flex:1;padding:15px 10px;border-radius:18px 18px 0 0;border:3px solid #D9A441;border-bottom:none;background:linear-gradient(180deg,#fffdf4,#f1e1bd);color:#8a6a3a;font-size:19px;font-weight:900;cursor:pointer;transition:transform .12s}
.sp-tab:hover{transform:translateY(-2px)}
.sp-tab.on{background:linear-gradient(180deg,#3b78e0,#1454B8);border-color:#F5D77E;color:#fff;text-shadow:0 2px 0 #0a1f4a;box-shadow:0 0 22px rgba(80,150,255,.75),inset 0 2px 0 rgba(255,255,255,.3)}
.sp-main{max-width:1040px;margin:0 auto;background:rgba(255,249,237,.95);border:3px solid #D9A441;border-radius:0 0 22px 22px;padding:18px 16px 20px;box-shadow:0 10px 30px rgba(16,47,112,.25)}
.sp-sec{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(180deg,#2f6ad1,#1454B8);border:2px solid #F5D77E;border-radius:999px;padding:5px 18px;color:#fff;font-size:13.5px;font-weight:900;margin:6px 0 12px;box-shadow:0 3px 10px rgba(16,47,112,.3)}
.sp-sec i{font-style:normal;font-size:10px;font-weight:800;color:#dbe7ff}
.sp-grid-ltd{padding:14px;margin:-4px -6px 22px;border-radius:20px;border:2px solid #f3a9b4;background:linear-gradient(180deg,rgba(226,85,99,.2),rgba(179,32,47,.12))}
.sp-info{background:rgba(219,234,254,.7);border:1.5px solid #93c5fd;border-radius:12px;padding:10px 13px;font-size:12px;font-weight:800;color:#1e3a8a;margin-bottom:12px}
.sp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:14px;margin-bottom:18px}
.sp-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px 10px 12px;border-radius:18px;cursor:pointer;text-align:center;border:3px solid #D9A441;background:radial-gradient(ellipse at 50% 28%,#fffef8 0%,#fbf0d4 62%,#f1dfb2 100%);box-shadow:inset 0 0 0 3px rgba(255,255,255,.7),inset 0 0 0 4px rgba(217,164,65,.35),0 5px 12px rgba(120,80,20,.18);transition:transform .15s,box-shadow .15s;overflow:hidden}
.sp-card:hover{transform:translateY(-5px);box-shadow:inset 0 0 0 3px rgba(255,255,255,.7),inset 0 0 0 4px rgba(217,164,65,.35),0 12px 24px rgba(120,80,20,.28),0 0 20px rgba(245,215,126,.9)}
.sp-card-img{height:100px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 6px 6px rgba(80,50,10,.3))}
.sp-st-short .sp-card-img{filter:grayscale(.55) opacity(.75)}
.sp-card-name{font-size:14.5px;font-weight:900;color:#17397d}
.sp-card-sub{font-size:11px;font-weight:800;color:#6b5a33}
.sp-price{margin-top:4px;display:inline-flex;flex-direction:column;align-items:center;background:linear-gradient(180deg,#fff,#fdf2cf);border:2px solid #D9A441;border-radius:999px;padding:4px 16px;font-size:14px;font-weight:900;color:#a16207}
.sp-price i{font-style:normal;font-size:9.5px;color:#dc2626}
.sp-price.short{border-color:#d6c9a8;color:#8b7b4f;background:#f6efdd}
.sp-price.have{border-color:#86efac;background:#ecfdf3;color:#15803d;font-size:12px}
.sp-ribbon{position:absolute;top:8px;left:-4px;background:linear-gradient(180deg,#34d399,#059669);color:#fff;font-size:10px;font-weight:900;padding:3px 10px 3px 12px;border-radius:0 999px 999px 0;box-shadow:0 2px 5px rgba(0,0,0,.2)}
.sp-ribbon.on{background:linear-gradient(180deg,#3b78e0,#1454B8)}
.sp-ribbon.wait{background:linear-gradient(180deg,#fbbf24,#d97706)}
.sp-link{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;text-align:left;background:#fff;border:2px solid #e7cf96;border-radius:16px;padding:12px 14px;cursor:pointer}
.sp-link:hover{border-color:#1454B8}
.sp-link b{display:block;font-size:14px;font-weight:900;color:#17397d}
.sp-link i{display:block;font-style:normal;font-size:11px;font-weight:700;color:#8a6a3a;margin-top:1px}
.sp-link span:nth-child(2){flex:1}
.sp-link-go{color:#D9A441;font-size:22px;font-weight:900}
.sp-modal-bg{position:fixed;inset:0;z-index:300;background:rgba(16,47,112,.55);display:flex;align-items:center;justify-content:center;padding:18px}
.sp-modal{width:100%;max-width:400px;max-height:92vh;overflow-y:auto;background:linear-gradient(180deg,#fffdf4,#f6e7c8);border:3px solid #D9A441;border-radius:22px;padding:18px 18px 12px;text-align:center;box-shadow:0 18px 50px rgba(16,47,112,.5)}
.sp-modal-img{height:160px;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse,#fff 0%,rgba(255,255,255,0) 70%);filter:drop-shadow(0 8px 8px rgba(80,50,10,.3))}
.sp-modal h3{margin:4px 0 2px;font-size:21px;font-weight:900;color:#17397d}
.sp-desc{margin:0 0 10px;font-size:12.5px;font-weight:800;color:#6b5a33}
.sp-stats{background:#fff;border:2px solid #e7cf96;border-radius:14px;padding:4px 14px;margin-bottom:12px;text-align:left}
.sp-stats div{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px dashed rgba(217,164,65,.4);font-size:13px}
.sp-stats div:last-child{border-bottom:none}
.sp-stats span{font-weight:800;color:#8a6a3a}
.sp-stats b{color:#1f2a44;text-align:right}
.sp-buy{display:block;width:100%;padding:15px 10px;border-radius:999px;border:3px solid #F5D77E;background:linear-gradient(180deg,#ef4444,#b91c1c);color:#fff;font-size:16px;font-weight:900;cursor:pointer;box-shadow:0 6px 16px rgba(185,28,28,.4);text-shadow:0 1px 2px rgba(0,0,0,.3)}
.sp-buy.alt{background:linear-gradient(180deg,#3b78e0,#1454B8);box-shadow:0 6px 16px rgba(16,47,112,.4)}
.sp-buy.off,.sp-buy:disabled{background:#cbbf9f;border-color:#e3d9bd;box-shadow:none;cursor:not-allowed;text-shadow:none}
.sp-ask{background:#fff;border:2px solid #D9A441;border-radius:16px;padding:12px}
.sp-ask b{display:block;font-size:14px;color:#17397d;margin-bottom:10px}
.sp-ask div{display:flex;gap:8px}
.sp-ask .sp-buy{flex:1.4;padding:13px 8px}
.sp-no{flex:1;border:2px solid #d6c9a8;background:#f6efdd;color:#6b5a33;font-weight:900;font-size:14px;border-radius:999px;cursor:pointer}
.sp-after{margin-top:7px;font-size:11.5px;font-weight:800;color:#8a6a3a}
.sp-close{margin-top:6px;padding:10px;width:100%;border:none;background:none;color:#8a6a3a;font-size:13px;font-weight:900;cursor:pointer}
.sp-done{position:relative;overflow:hidden;width:100%;max-width:380px;background:linear-gradient(180deg,#fffdf4,#f6e7c8);border:3px solid #F5D77E;border-radius:24px;padding:26px 20px 18px;text-align:center;box-shadow:0 0 50px rgba(245,215,126,.9),0 18px 50px rgba(16,47,112,.5);animation:spPop .45s cubic-bezier(.2,1.5,.4,1)}
@keyframes spPop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
.sp-rays{position:absolute;left:50%;top:38%;width:520px;height:520px;margin:-260px 0 0 -260px;background:repeating-conic-gradient(rgba(245,215,126,.45) 0 12deg,transparent 12deg 30deg);border-radius:50%;animation:spSpin 16s linear infinite;pointer-events:none}
@keyframes spSpin{to{transform:rotate(360deg)}}
.sp-spark{position:absolute;top:60%;color:#f5b301;font-size:18px;animation:spSpark 1.5s ease-out infinite;pointer-events:none}
@keyframes spSpark{0%{transform:translateY(0) scale(.4);opacity:0}25%{opacity:1}100%{transform:translateY(-150px) scale(1.2);opacity:0}}
.sp-done-img{position:relative;height:140px;display:flex;align-items:center;justify-content:center}
.sp-done-img img{max-height:140px;max-width:70%;filter:drop-shadow(0 8px 10px rgba(80,50,10,.35))}
.sp-done-img span{font-size:84px}
.sp-done h3{position:relative;margin:6px 0 4px;font-size:26px;font-weight:900;color:#b45309;text-shadow:0 2px 0 #fff}
.sp-done p{position:relative;margin:0 0 14px;font-size:13px;font-weight:800;color:#5b4a23;line-height:1.6}
.sp-done .sp-buy{position:relative}
.sp-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:400;background:#7f1d1d;color:#fff;font-size:13.5px;font-weight:900;border-radius:999px;padding:11px 22px;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:92vw}
.sp-toast.ok{background:#166534}
/* ---- 完成イメージ準拠：紺のパネル＋金フレーム、ピル型タブ、金茶の価格プレート ---- */
.sp-head{max-width:1180px;align-items:flex-start;flex-wrap:nowrap}
.sp-left{display:flex;flex-direction:column;align-items:flex-start;gap:8px;flex:1;min-width:0}
.sp-logo{font-family:Georgia,"Times New Roman",serif;font-size:21px;line-height:1.05;font-weight:700;letter-spacing:2px;color:#f6dc9a;text-shadow:0 2px 0 #7a5516,0 3px 8px rgba(16,47,112,.55)}
.sp-sign{flex:0 1 auto;border-radius:22px;padding:13px 56px 15px;background:linear-gradient(180deg,#3f66b8,#1d3a82 55%,#162c66);border:3px solid #F5D77E;box-shadow:0 0 0 2px #b98a35,0 6px 0 #0d1c45,0 14px 26px rgba(16,47,112,.45),inset 0 2px 0 rgba(255,255,255,.35)}
.sp-sign-main{font-size:34px;letter-spacing:5px}
.sp-head>.sp-pt{flex:1;display:flex;justify-content:flex-end;background:none;border:none;box-shadow:none;padding:0}
.sp-pt{position:static}
.sp-copy{margin-top:-4px;position:relative;z-index:1}
.sp-copy span{display:inline-block;background:linear-gradient(180deg,#fffdf6,#f3e9d2);color:#4a3b1c;border:2px solid #e2c98c;border-radius:6px;padding:6px 34px;font-size:14px;letter-spacing:1px;text-shadow:none;box-shadow:0 4px 10px rgba(16,47,112,.25)}
.sp-tabs{max-width:920px;gap:26px;margin-top:18px;position:relative;z-index:2}
.sp-tab{border-radius:999px;border:3px solid #D9A441;border-bottom:3px solid #D9A441;padding:15px 10px;font-size:25px;letter-spacing:8px;background:linear-gradient(180deg,#fffef9,#f3ead6);color:#3b3524;box-shadow:0 0 0 2px #fff6dc inset,0 5px 12px rgba(16,47,112,.3)}
.sp-tab.on{background:linear-gradient(180deg,#3d8af0,#1554c4 55%,#0f3f9c);border-color:#F5D77E;box-shadow:0 0 0 2px rgba(255,255,255,.35) inset,0 0 26px rgba(90,160,255,.95),0 5px 12px rgba(16,47,112,.4)}
.sp-main{max-width:1180px;margin-top:-26px;padding:54px 30px 26px;border-radius:14px;background:linear-gradient(180deg,rgba(38,52,104,.93),rgba(27,38,82,.95));border:3px solid #E8C876;box-shadow:0 0 0 2px #9c7430,inset 0 0 0 2px rgba(232,200,118,.35),0 14px 36px rgba(10,20,60,.45)}
.sp-sec{background:none;border:none;box-shadow:none;padding:0;color:#f6dc9a;font-size:15px;letter-spacing:2px}
.sp-sec i{color:#c9d3f2}
.sp-sec.sp-sec-ltd{color:#ffd0d6}
.sp-sec.sp-sec-ltd i{color:#ffe3e7}
.sp-info{background:rgba(255,255,255,.12);border-color:rgba(232,200,118,.6);color:#fff}
.sp-grid{grid-template-columns:repeat(4,1fr);gap:20px}
.sp-card{border:3px solid #e9d6a6;border-radius:14px;padding:16px 12px 12px;background:radial-gradient(ellipse at 50% 34%,#ffffff 0%,#f4f1fa 45%,#fbf4e3 100%);box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 3px rgba(217,164,65,.45),0 6px 14px rgba(8,14,44,.4)}
.sp-card:hover{box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 3px rgba(217,164,65,.45),0 14px 26px rgba(8,14,44,.5),0 0 24px rgba(245,215,126,.95)}
.sp-card-img{height:124px}
.sp-card-name{font-size:19px;letter-spacing:2px;color:#2a2f52;margin-top:2px}
.sp-card-sub{font-size:12px}
.sp-price{flex-direction:row;gap:6px;justify-content:center;align-self:stretch;margin:6px 6px 0;padding:7px 10px;border:2px solid #e6c98a;background:linear-gradient(180deg,#c9a45f,#a8803f);color:#fff;font-size:18px;text-shadow:0 1px 2px rgba(60,35,5,.6);box-shadow:inset 0 1px 0 rgba(255,255,255,.4)}
.sp-price i{color:#fff3c4;font-size:10.5px;align-self:center}
.sp-price.short{background:linear-gradient(180deg,#b9b2a0,#958d7a);border-color:#d8d0bb;color:#fff}
.sp-price.have{background:linear-gradient(180deg,#4fbf8b,#2f9a68);border-color:#bff0d6;color:#fff;font-size:14px}
.sp-rare{position:absolute;top:8px;right:8px;z-index:2;font-family:Georgia,serif;font-weight:700;font-size:15px;padding:3px 9px;border-radius:8px;color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);background:linear-gradient(180deg,#5aa0f0,#2563c9)}
.sp-rare-sr{background:linear-gradient(180deg,#a678e8,#6d3fc0)}
.sp-rare-ssr{background:linear-gradient(180deg,#f3cf6a,#c98a1c);text-shadow:0 1px 1px rgba(90,50,0,.6)}
.sp-pt-box{display:inline-block;background:linear-gradient(180deg,#2b3f7c,#18265a);border:3px solid #E8C876;border-radius:22px;padding:8px 22px;text-align:right;box-shadow:0 0 0 2px #9c7430,0 6px 16px rgba(10,20,60,.4)}
.sp-pt-box span{display:block;font-size:11px;font-weight:900;color:#f6dc9a}
.sp-pt-box b{font-size:25px;font-weight:900;color:#fff}
.sp-pt-box i{font-style:normal;font-size:13px;margin-left:3px}
@media (max-width:900px){ .sp-grid{grid-template-columns:repeat(3,1fr)} }
@media (max-width:640px){
  .sp-root{padding:10px 10px calc(40px + env(safe-area-inset-bottom))}
  .sp-sign{order:3;width:100%;box-sizing:border-box;padding:6px 10px 8px}
  .sp-sign-main{font-size:19px}
  .sp-pt{padding:4px 12px}
  .sp-pt b{font-size:17px}
  .sp-copy{font-size:11.5px;margin-top:8px}
  .sp-tab{font-size:16px;padding:13px 6px}
  .sp-main{padding:14px 10px 16px}
  .sp-grid{grid-template-columns:1fr 1fr;gap:10px}
  .sp-card{padding:12px 6px 10px}
  .sp-card-img{height:84px}
  .sp-card-name{font-size:13px}
  .sp-head{flex-wrap:wrap;align-items:center}
  .sp-left{flex-direction:row;align-items:center;flex:1}
  .sp-logo{font-size:12px;letter-spacing:1px}
  .sp-sign{order:3;width:100%;padding:8px 10px 10px}
  .sp-sign-main{font-size:21px;letter-spacing:3px}
  .sp-head>.sp-pt{flex:0 0 auto;position:fixed;top:8px;right:10px;z-index:50}
  .sp-left{min-height:44px;padding-right:150px}
  .sp-pt-box{padding:4px 14px;border-radius:16px}
  .sp-pt-box b{font-size:18px}
  .sp-copy{margin-top:8px}
  .sp-copy span{font-size:11px;padding:5px 10px;letter-spacing:0}
  .sp-tabs{gap:10px;margin-top:12px}
  .sp-tab{font-size:18px;letter-spacing:4px;padding:12px 6px}
  .sp-main{margin-top:-22px;padding:40px 10px 16px}
  .sp-grid{grid-template-columns:1fr 1fr;gap:10px}
  .sp-card{padding:12px 6px 10px}
  .sp-card-img{height:92px}
  .sp-card-name{font-size:15px;letter-spacing:1px}
  .sp-price{font-size:15px;margin:6px 2px 0;flex-wrap:wrap;gap:2px 6px}
  .sp-price.have{font-size:11.5px;white-space:nowrap}
}
@media (prefers-reduced-motion: reduce){ .sp-rays,.sp-spark,.sp-done{animation:none} }
`;
