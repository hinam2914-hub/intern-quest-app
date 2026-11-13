"use client";
// 王国のポイントショップ。タブは「⚔️ 装備」「🏝️ 島」の2つ。
// ・装備＝島バトルの武器。価格と所持は battle_weapon_prices / battle_weapon_owned、購入は battle_buy_weapon()（サーバー側で残高確認と減算を一括処理）
// ・島＝既存の island_items / island_purchases をそのまま利用（購入は申請→管理者の承認でポイント減算、という従来の流れ）。設置は profiles.island_config
// ・旧「景品」「アバター」タブは画面から外しただけで、データ（shop_items / point_requests / avatar_items / avatar_purchases）には触れない
// ・使うポイントは user_points.points（育成ポイント）。累計pt・バトルの戦績とは別
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { ELEMENTS, SKILLS, WEAPONS, loadWeaponShop, type WeaponDef, type WeaponShop } from "../lib/battle";
import { GROUND_IMG, TREE_IMG, DECO_IMG, SKY_IMG, ANIMAL_IMG } from "../lib/island";

type IslandItem = { id: string; name: string; category: string; emoji: string | null; css_key: string; price: number; rarity: string };
const ISLAND_IMG: Record<string, string> = { ...GROUND_IMG, ...TREE_IMG, ...DECO_IMG, ...SKY_IMG, ...ANIMAL_IMG };
const CATS: { key: string; label: string }[] = [
    { key: "ground", label: "🌱 地面" }, { key: "tree", label: "🌳 木" }, { key: "deco", label: "🏡 装飾" }, { key: "sky", label: "✨ 空" }, { key: "animal", label: "🐾 どうぶつ" },
];

export default function ShopPage() {
    const router = useRouter();
    const [userId, setUserId] = useState("");
    const [points, setPoints] = useState(0);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<"gear" | "island">("gear");
    const [shop, setShop] = useState<WeaponShop>({ enabled: false, prices: {}, owned: new Set() });
    const [islandItems, setIslandItems] = useState<IslandItem[]>([]);
    const [ownedIsland, setOwnedIsland] = useState<string[]>([]);
    const [pendingIsland, setPendingIsland] = useState<string[]>([]);
    const [islandConfig, setIslandConfig] = useState<Record<string, string>>({});
    const [selW, setSelW] = useState<WeaponDef | null>(null);       // 武器の詳細
    const [selI, setSelI] = useState<IslandItem | null>(null);      // 島アイテムの詳細
    const [busy, setBusy] = useState(false);
    const [askAt, setAskAt] = useState(0);   // 購入確認を出した時刻（0=未表示）。出た直後の連打で確定しないよう少し待つ
    const confirmOk = () => askAt > 0 && Date.now() - askAt > 450;
    const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
    const [done, setDone] = useState<{ title: string; sub: string; img: string | null; emoji: string } | null>(null);  // 購入完了の演出

    useEffect(() => { try { if (new URLSearchParams(window.location.search).get("tab") === "island") setTab("island"); } catch {} }, []);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const [{ data: pointRow }, { data: profRow }, { data: isItems }, { data: isPur }, ws] = await Promise.all([
                supabase.from("user_points").select("points").eq("id", user.id).maybeSingle(),
                supabase.from("profiles").select("island_config").eq("id", user.id).maybeSingle(),
                supabase.from("island_items").select("*").eq("is_active", true).order("sort_order"),
                supabase.from("island_purchases").select("item_id,status").eq("user_id", user.id),
                loadWeaponShop(supabase, user.id),
            ]);
            setPoints((pointRow as any)?.points || 0);
            setIslandConfig(((profRow as any)?.island_config || {}) as Record<string, string>);
            setIslandItems((isItems || []) as IslandItem[]);
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
            flash(false, m.includes("NO_POINTS") ? "ポイントが足りません" : m.includes("ALREADY_OWNED") ? "この武器はすでに持っています" : "購入できませんでした。もう一度お試しください");
            if (m.includes("ALREADY_OWNED")) setShop((s) => ({ ...s, owned: new Set([...s.owned, w.key]) }));
            return;
        }
        setPoints(Number((data as any).points));
        setShop((s) => ({ ...s, owned: new Set([...s.owned, w.key]) }));
        setSelW(null);
        setDone({ title: "購入完了！", sub: `「${w.name}」を手に入れた！ 島バトルで使えます`, img: w.img, emoji: w.emoji });
    };

    // ---- 島アイテム：従来どおり「申請→管理者の承認」。ポイントは承認時に管理画面側で減算される ----
    const requestIsland = async (it: IslandItem) => {
        if (busy || !userId) return;
        if (points < it.price) { flash(false, "ポイントが足りません"); return; }
        setBusy(true);
        const { error } = await supabase.from("island_purchases").insert({ user_id: userId, item_id: it.id, status: "pending" });
        setBusy(false);
        if (error) { flash(false, "申請できませんでした。もう一度お試しください"); return; }
        setPendingIsland((p) => [...p, it.id]);
        setSelI(null);
        setDone({ title: "購入を申請しました！", sub: `「${it.name}」は承認されると使えるようになります（ポイントは承認時に引かれます）`, img: ISLAND_IMG[it.css_key] || null, emoji: it.emoji || "🎁" });
    };
    const toggleIsland = async (it: IslandItem) => {
        if (busy || !userId) return;
        const cur: Record<string, string> = { ...islandConfig };
        const removing = cur[it.category] === it.css_key;
        if (removing) delete cur[it.category]; else cur[it.category] = it.css_key;
        setBusy(true);
        const { error } = await supabase.from("profiles").update({ island_config: cur }).eq("id", userId);
        setBusy(false);
        if (error) { flash(false, "保存に失敗しました"); return; }
        setIslandConfig(cur);
        flash(true, removing ? `「${it.name}」を片付けました` : `「${it.name}」を島に設置しました！`);
    };

    if (loading) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#7fc3ef", color: "#fff", fontWeight: 900 }}>🛍️ ショップを開いています...</div>;

    const wState = (w: WeaponDef) => {
        const price = shop.prices[w.key] ?? 0;
        if (!shop.enabled) return { kind: "free", label: "使用可能", price };
        if (price === 0) return { kind: "owned", label: "はじめから所持", price };
        if (shop.owned.has(w.key)) return { kind: "owned", label: "所持済み", price };
        if (points < price) return { kind: "short", label: `あと ${(price - points).toLocaleString()}pt`, price };
        return { kind: "buy", label: "購入できます", price };
    };
    const iState = (it: IslandItem) => {
        if (ownedIsland.includes(it.id)) return islandConfig[it.category] === it.css_key ? { kind: "on", label: "設置中" } : { kind: "owned", label: "所持済み" };
        if (pendingIsland.includes(it.id)) return { kind: "pending", label: "承認待ち" };
        if (points < it.price) return { kind: "short", label: `あと ${(it.price - points).toLocaleString()}pt` };
        return { kind: "buy", label: "購入できます" };
    };
    const WImg = ({ w, size }: { w: WeaponDef; size: number }) => w.img ? <img src={w.img} alt={w.name} style={{ width: size, height: size, objectFit: "contain" }} /> : <span style={{ fontSize: size * 0.7 }}>{w.emoji}</span>;
    const IImg = ({ it, size }: { it: IslandItem; size: number }) => ISLAND_IMG[it.css_key] ? <img src={ISLAND_IMG[it.css_key]} alt={it.name} style={{ width: size, height: size, objectFit: "contain" }} /> : <span style={{ fontSize: size * 0.66 }}>{it.emoji || "🎁"}</span>;
    const El = ({ k }: { k: keyof typeof ELEMENTS }) => { const e = ELEMENTS[k]; return <span style={{ color: e.color, fontWeight: 900 }}>{e.img ? <img src={e.img} alt="" style={{ width: 14, height: 14, verticalAlign: "-2px" }} /> : e.emoji} {e.name}</span>; };

    return (
        <div className="sp-root">
            <style>{CSS}</style>

            <header className="sp-head">
                <button className="sp-back" onClick={() => router.push("/menu")}>← メニュー</button>
                <div className="sp-sign">
                    <span className="sp-sign-en">INTERN QUEST</span>
                    <span className="sp-sign-main">🛍️ ポイントショップ</span>
                </div>
                <div className="sp-pt"><span>所持ポイント</span><b>🪙 {points.toLocaleString()}<i>pt</i></b></div>
            </header>
            <p className="sp-copy">ポイントを使って、装備や島のアイテムを手に入れよう</p>

            <div className="sp-tabs">
                <button className={"sp-tab" + (tab === "gear" ? " on" : "")} onClick={() => setTab("gear")}>⚔️ 装備</button>
                <button className={"sp-tab" + (tab === "island" ? " on" : "")} onClick={() => setTab("island")}>🏝️ 島</button>
            </div>

            <main className="sp-main">
                {tab === "gear" && (
                    <>
                        <div className="sp-sec">⚔️ 島バトルの武器</div>
                        {!shop.enabled && <div className="sp-info">🛠️ 武器の販売は準備中です。いまは全員がすべての武器を使えます</div>}
                        <div className="sp-grid">
                            {WEAPONS.map((w) => {
                                const st = wState(w);
                                return (
                                    <button key={w.key} className={"sp-card sp-st-" + st.kind} onClick={() => { setAskAt(0); setSelW(w); }}>
                                        {st.kind === "owned" && <span className="sp-ribbon">✓ {st.label}</span>}
                                        <span className="sp-card-img"><WImg w={w} size={92} /></span>
                                        <span className="sp-card-name">{w.name}</span>
                                        <span className="sp-card-sub">攻撃 {w.atk}・{w.element ? <El k={w.element} /> : "無属性"}</span>
                                        {shop.enabled && st.price > 0 && !shop.owned.has(w.key)
                                            ? <span className={"sp-price" + (st.kind === "short" ? " short" : "")}>🪙 {st.price.toLocaleString()}pt{st.kind === "short" && <i>{st.label}</i>}</span>
                                            : <span className="sp-price have">{st.kind === "free" ? "使用可能" : "島バトルで使える"}</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <button className="sp-link" onClick={() => router.push("/onboarding/avatar?from=mypage&tab=gear")}>
                            <span style={{ fontSize: 26 }}>🧍</span>
                            <span><b>アバターの見た目装備はこちら</b><i>帽子・マント・武器の飾り・アクセサリー（アバター編集で購入）</i></span>
                            <span className="sp-link-go">›</span>
                        </button>
                    </>
                )}

                {tab === "island" && (
                    <>
                        {islandItems.length === 0 && <div className="sp-info">まだ島のアイテムがありません</div>}
                        {CATS.map((c) => {
                            const list = islandItems.filter((it) => it.category === c.key);
                            if (!list.length) return null;
                            return (
                                <section key={c.key}>
                                    <div className="sp-sec">{c.label}<i>1つだけ設置できます</i></div>
                                    <div className="sp-grid">
                                        {list.map((it) => {
                                            const st = iState(it);
                                            const have = st.kind === "on" || st.kind === "owned";
                                            return (
                                                <button key={it.id} className={"sp-card sp-st-" + st.kind} onClick={() => { setAskAt(0); setSelI(it); }}>
                                                    {st.kind === "on" && <span className="sp-ribbon on">✓ 設置中</span>}
                                                    {st.kind === "owned" && <span className="sp-ribbon">✓ 所持済み</span>}
                                                    {st.kind === "pending" && <span className="sp-ribbon wait">⏳ 承認待ち</span>}
                                                    <span className="sp-card-img"><IImg it={it} size={92} /></span>
                                                    <span className="sp-card-name">{it.name}</span>
                                                    {have
                                                        ? <span className="sp-price have">{st.kind === "on" ? "タップで片付け" : "タップで設置"}</span>
                                                        : <span className={"sp-price" + (st.kind === "short" ? " short" : "")}>🪙 {it.price.toLocaleString()}pt{st.kind === "short" && <i>{st.label}</i>}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        })}
                        <button className="sp-link" onClick={() => router.push("/home")}>
                            <span style={{ fontSize: 26 }}>🏝️</span>
                            <span><b>自分の島へ行く</b><i>設置したアイテムはホームの島と「みんなの島」に反映されます</i></span>
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
                                <div><span>攻撃力</span><b>{w.atk}</b></div>
                                <div><span>特殊効果</span><b>{w.skill ? `${SKILLS[w.skill].name}（発動率${Math.round(w.skillRate * 100)}%）` : w.critBonus > 0 ? `クリティカル率 +${Math.round(w.critBonus * 100)}%` : "なし"}</b></div>
                                {shop.enabled && st.price > 0 && <div><span>必要ポイント</span><b>🪙 {st.price.toLocaleString()}pt</b></div>}
                                <div><span>所持状況</span><b>{st.kind === "owned" ? st.label : st.kind === "free" ? "使用可能" : "未所持"}</b></div>
                            </div>
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
                                <div><span>所持状況</span><b>{st.kind === "on" ? "所持済み・設置中" : st.kind === "owned" ? "所持済み" : st.kind === "pending" ? "承認待ち" : "未所持"}</b></div>
                            </div>
                            {st.kind === "buy" && askAt === 0 && <button className="sp-buy" onClick={() => setAskAt(Date.now())}>🪙 {it.price.toLocaleString()}pt で購入を申請する</button>}
                            {st.kind === "buy" && askAt > 0 && (
                                <div className="sp-ask">
                                    <b>「{it.name}」（{it.price.toLocaleString()}pt）の購入を申請しますか？</b>
                                    <div><button className="sp-no" disabled={busy} onClick={() => setAskAt(0)}>やめる</button><button className="sp-buy" disabled={busy} onClick={() => confirmOk() && requestIsland(it)}>{busy ? "申請中..." : "申請する"}</button></div>
                                </div>
                            )}
                            {st.kind === "buy" && <div className="sp-after">承認されるとポイントが引かれ、島に置けるようになります</div>}
                            {st.kind === "short" && <button className="sp-buy off" disabled>ポイントが足りません（{st.label}）</button>}
                            {st.kind === "pending" && <button className="sp-buy off" disabled>⏳ 承認をお待ちください</button>}
                            {(st.kind === "owned" || st.kind === "on") && <button className="sp-buy alt" disabled={busy} onClick={async () => { await toggleIsland(it); setSelI(null); }}>{st.kind === "on" ? "島から片付ける" : "🏝️ 島に設置する"}</button>}
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
                        <div className="sp-done-img">{done.img ? <img src={done.img} alt="" /> : <span>{done.emoji}</span>}</div>
                        <h3>{done.title}</h3>
                        <p>{done.sub}</p>
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
}
@media (prefers-reduced-motion: reduce){ .sp-rays,.sp-spark,.sp-done{animation:none} }
`;
