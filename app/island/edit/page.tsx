"use client";
// 島の飾りつけ画面。持っているアイテムを島に置く・動かす・大きさを変える・片付ける。
// ・島の描画は HOME／みんなの島と同じ部品（DayIslandScene）。保存先も同じ profiles.island_config なので、保存すればどの画面にも同じ島が出る
// ・保存はサーバーの island_save()（持っている数・上限・座標を検証）。その処理が無い環境だけ、従来どおり自分のプロフィールへ直接保存する
// ・ここでは購入しない（購入はポイントショップ）。城は累計ptで決まる既存の仕組みのままで、ここでは変えられない
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import DayIslandScene from "../../components/DayIslandScene";
import { ITEM_IMG, ISLAND_CATS, PLACE_LIMIT, SCALE_MIN, SCALE_MAX, placedOf, skyListOf, buildIslandConfig, categoryOf, clampToIsland, type Placed, type IslandCategory } from "../../lib/island";

type Item = { id: string; name: string; category: string; css_key: string; price: number; rarity: string };
const SPOTS: [number, number][] = [[18, 34], [82, 34], [14, 62], [86, 62], [30, 84], [70, 84], [50, 92], [34, 16], [66, 16], [8, 48], [92, 48], [50, 8]];
const MIN_GAP = 7;   // アイテム同士の最小間隔（重なりすぎ防止）
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export default function IslandEditPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState("");
    const [total, setTotal] = useState(0);
    const [items, setItems] = useState<Item[]>([]);
    const [ownCount, setOwnCount] = useState<Record<string, number>>({});   // css_key → 持っている数
    const [base, setBase] = useState<any>({});                              // 読み込んだ時点の設定（元に戻す用）
    const [ground, setGround] = useState<string | null>(null);
    const [skies, setSkies] = useState<string[]>([]);
    const [placed, setPlaced] = useState<Placed[]>([]);
    const [sel, setSel] = useState<number | null>(null);
    const [tab, setTab] = useState<IslandCategory>("tree");
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
    const [leave, setLeave] = useState<string | null>(null);   // 未保存で離れようとした行き先

    const apply = (cfg: any) => { setGround(cfg?.ground || null); setSkies(skyListOf(cfg)); setPlaced(placedOf(cfg)); setSel(null); setDirty(false); };

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const [{ data: prof }, { data: its }, { data: pur }, { data: pt }] = await Promise.all([
                supabase.from("profiles").select("island_config").eq("id", user.id).maybeSingle(),
                supabase.from("island_items").select("id, name, category, css_key, price, rarity").eq("is_active", true).order("sort_order"),
                supabase.from("island_purchases").select("item_id, status").eq("user_id", user.id),
                supabase.from("user_points").select("total_earned").eq("id", user.id).maybeSingle(),
            ]);
            const list = (its || []) as Item[];
            const keyOf: Record<string, string> = {}; list.forEach((i) => { keyOf[i.id] = i.css_key; });
            const cnt: Record<string, number> = {};
            (pur || []).filter((p: any) => p.status === "approved").forEach((p: any) => { const k = keyOf[p.item_id]; if (k) cnt[k] = (cnt[k] || 0) + 1; });
            setItems(list); setOwnCount(cnt); setTotal(Number((pt as any)?.total_earned || 0));
            const cfg = ((prof as any)?.island_config || {}) as any;
            setBase(cfg); apply(cfg);
            setLoading(false);
        })();
    }, [router]);

    // 未保存のままタブを閉じる・再読み込みするときの確認
    useEffect(() => {
        if (!dirty) return;
        const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
        window.addEventListener("beforeunload", h);
        return () => window.removeEventListener("beforeunload", h);
    }, [dirty]);

    const flash = (ok: boolean, text: string) => { setToast({ ok, text }); setTimeout(() => setToast(null), 3200); };
    const config = useMemo(() => buildIslandConfig(base, ground, skies, placed), [base, ground, skies, placed]);
    const usedOf = (k: string) => placed.filter((p) => p.k === k).length;
    const catCount = (c: string) => placed.filter((p) => categoryOf(p.k) === c).length;
    const go = (path: string) => { if (dirty) setLeave(path); else router.push(path); };

    const tapItem = (it: Item) => {
        const own = ownCount[it.css_key] || 0;
        if (!ITEM_IMG[it.css_key]) { flash(false, "このアイテムは画像を準備中です"); return; }
        if (own === 0) { flash(false, "まだ持っていません。ポイントショップで手に入ります"); return; }
        const cat = it.category as IslandCategory;
        if (cat === "ground") { setGround((g) => (g === it.css_key ? null : it.css_key)); setDirty(true); return; }
        if (cat === "sky") {
            if (skies.includes(it.css_key)) { setSkies(skies.filter((k) => k !== it.css_key)); setDirty(true); return; }
            if (skies.length >= PLACE_LIMIT.sky) { flash(false, `空の飾りは${PLACE_LIMIT.sky}つまでです`); return; }
            setSkies([...skies, it.css_key]); setDirty(true); return;
        }
        if (usedOf(it.css_key) >= own) { flash(false, own === 1 ? "もう置いてあります（もう1つ置くにはショップで追加購入）" : `持っている${own}個すべて置いてあります`); return; }
        if (catCount(cat) >= PLACE_LIMIT[cat]) { flash(false, `${ISLAND_CATS.find((c) => c.key === cat)?.label.slice(2)}は${PLACE_LIMIT[cat]}個までです`); return; }
        const spot = SPOTS.map(([x, y]) => ({ x, y })).find((s) => placed.every((p) => dist(p, s) >= 12)) || { x: 50, y: 70 };
        setPlaced([...placed, { k: it.css_key, x: spot.x, y: spot.y, s: 1, f: false }]); setSel(placed.length); setDirty(true);
    };
    // ドラッグ中は自由に動かせる。指を離したとき、ほかのアイテムに重なりすぎていたら少し押し出す（重なりすぎ防止）
    const move = (i: number, x: number, y: number) => {
        const q = clampToIsland(x, y);
        setPlaced((ps) => ps.map((p, j) => (j === i ? { ...p, x: q.x, y: q.y } : p))); setDirty(true);
    };
    const drop = (i: number) => {
        setPlaced((ps) => {
            let q = { x: ps[i].x, y: ps[i].y };
            for (let n = 0; n < 8; n++) {
                const near = ps.find((p, j) => j !== i && dist(p, q) < MIN_GAP);
                if (!near) break;
                let dx = q.x - near.x, dy = q.y - near.y; const d = Math.hypot(dx, dy) || 1;
                if (d === 1 && dx === 0 && dy === 0) { dx = 1; dy = 0; }
                q = clampToIsland(near.x + (dx / d) * (MIN_GAP + 0.5), near.y + (dy / d) * (MIN_GAP + 0.5));
            }
            return ps.map((p, j) => (j === i ? { ...p, x: q.x, y: q.y } : p));
        });
    };
    const edit = (fn: (p: Placed) => Placed) => { if (sel === null) return; setPlaced((ps) => ps.map((p, j) => (j === sel ? fn(p) : p))); setDirty(true); };
    const removeSel = () => { if (sel === null) return; setPlaced((ps) => ps.filter((_, j) => j !== sel)); setSel(null); setDirty(true); };

    const save = async () => {
        if (saving || !userId) return;
        setSaving(true);
        let { error } = await supabase.rpc("island_save", { p_config: config });
        if (error && (error.code === "PGRST202" || error.code === "42883" || /could not find the function|does not exist/i.test(error.message || ""))) {
            ({ error } = await supabase.from("profiles").update({ island_config: config }).eq("id", userId));
        }
        setSaving(false);
        if (error) {
            const m = error.message || "";
            flash(false, m.includes("NOT_OWNED") ? "持っていないアイテムが含まれています" : m.includes("LIMIT") ? "置ける数の上限を超えています" : "保存に失敗しました。もう一度お試しください");
            return;
        }
        setBase(config); setDirty(false); setSel(null);
        flash(true, "島を保存しました ✨ ホームとみんなの島に反映されます");
    };

    if (loading) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#7fc3ef", color: "#fff", fontWeight: 900 }}>🏝️ 島を読み込んでいます...</div>;

    const selP = sel !== null ? placed[sel] : null;
    const selItem = selP ? items.find((i) => i.css_key === selP.k) : null;
    const list = items.filter((i) => i.category === tab);

    return (
        <div className="ie-root">
            <style>{CSS}</style>
            <header className="ie-head">
                <button className="ie-back" onClick={() => go("/home")}>← ホーム</button>
                <div className="ie-title">🏝️ 島の飾りつけ</div>
                <button className="ie-shop" onClick={() => go("/shop?tab=island")}>🛍️ ショップ</button>
            </header>

            <div className="ie-grid">
                <section className="ie-stage">
                    <div className="ie-zoom"><DayIslandScene config={config} totalEarned={total} width={420} edit={{ sel, onSelect: setSel, onMove: move, onDrop: drop }} /></div>
                    <div className="ie-hint">{selP ? "ドラッグで移動できます" : placed.length ? "アイテムをタップすると選べます" : "右のアイテムをタップして島に置いてみよう"}</div>
                    <div className={"ie-tools" + (selP ? "" : " off")}>
                        <span className="ie-selname">{selItem ? selItem.name : "アイテム未選択"}</span>
                        <button disabled={!selP || (selP.s || 1) <= SCALE_MIN} onClick={() => edit((p) => ({ ...p, s: Math.max(SCALE_MIN, Math.round(((p.s || 1) - 0.1) * 10) / 10) }))}>－ 小さく</button>
                        <button disabled={!selP || (selP.s || 1) >= SCALE_MAX} onClick={() => edit((p) => ({ ...p, s: Math.min(SCALE_MAX, Math.round(((p.s || 1) + 0.1) * 10) / 10) }))}>＋ 大きく</button>
                        <button disabled={!selP} onClick={() => edit((p) => ({ ...p, f: !p.f }))}>⇄ 左右反転</button>
                        <button className="del" disabled={!selP} onClick={removeSel}>片付ける</button>
                    </div>
                </section>

                <section className="ie-inv">
                    <nav className="ie-tabs">
                        {ISLAND_CATS.map((c) => <button key={c.key} className={tab === c.key ? "on" : ""} onClick={() => setTab(c.key)}>{c.label}</button>)}
                    </nav>
                    <div className="ie-limit">
                        {tab === "ground" ? "地面は1種類えらべます" : tab === "sky" ? `空の飾り ${skies.length}/${PLACE_LIMIT.sky}` : `置いている数 ${catCount(tab)}/${PLACE_LIMIT[tab]}`}
                    </div>
                    <div className="ie-items">
                        {list.length === 0 && <div className="ie-empty">この種類のアイテムはまだありません</div>}
                        {list.map((it) => {
                            const own = ownCount[it.css_key] || 0; const img = ITEM_IMG[it.css_key];
                            const on = it.category === "ground" ? ground === it.css_key : it.category === "sky" ? skies.includes(it.css_key) : usedOf(it.css_key) > 0;
                            return (
                                <button key={it.id} className={"ie-item" + (own ? "" : " lock") + (on ? " on" : "")} onClick={() => tapItem(it)}>
                                    {on && <span className="ie-on">{it.category === "ground" || it.category === "sky" ? "設置中" : `${usedOf(it.css_key)}個設置中`}</span>}
                                    <span className="ie-img">{img ? <img src={img} alt="" /> : <i>画像準備中</i>}</span>
                                    <span className="ie-name">{it.name}</span>
                                    <span className="ie-own">{own ? (it.category === "ground" || it.category === "sky" ? "所持" : `所持 ${own}個`) : "未所持"}</span>
                                </button>
                            );
                        })}
                    </div>
                </section>
            </div>

            <footer className="ie-foot">
                <button className="sub" disabled={!dirty || saving} onClick={() => apply(base)}>元に戻す</button>
                <button className="main" disabled={!dirty || saving} onClick={save}>{saving ? "保存中..." : dirty ? "保存する" : "保存済み"}</button>
            </footer>

            {leave && (
                <div className="ie-modal-bg" onClick={() => setLeave(null)}>
                    <div className="ie-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>保存せずに移動しますか？</h3>
                        <p>いまの飾りつけはまだ保存されていません。</p>
                        <div><button className="sub" onClick={() => setLeave(null)}>編集にもどる</button><button className="main" onClick={() => router.push(leave)}>保存せず移動</button></div>
                    </div>
                </div>
            )}
            {toast && <div className={"ie-toast" + (toast.ok ? " ok" : "")}>{toast.ok ? "" : "⚠️ "}{toast.text}</div>}
        </div>
    );
}

const CSS = `
.ie-root{min-height:100vh;min-height:100dvh;background:#7fc3ef url(/images/onboarding/job-selection-bg.webp) center 22%/cover no-repeat fixed;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416;padding:12px 12px calc(96px + env(safe-area-inset-bottom));box-sizing:border-box}
.ie-head{max-width:1180px;margin:0 auto 12px;display:flex;align-items:center;gap:10px}
.ie-back,.ie-shop{border:2px solid #F5D77E;background:rgba(255,249,237,.96);color:#102F70;font-weight:900;font-size:12.5px;border-radius:999px;padding:10px 15px;cursor:pointer;min-height:44px;white-space:nowrap}
.ie-title{flex:1;min-width:0;text-align:center;background:linear-gradient(180deg,#3f66b8,#162c66);border:3px solid #F5D77E;border-radius:16px;padding:9px 12px;color:#fff;font-size:20px;font-weight:900;letter-spacing:2px;box-shadow:0 5px 0 #0d1c45,0 10px 20px rgba(16,47,112,.35)}
.ie-grid{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:14px;align-items:start}
.ie-grid>*{min-width:0}
.ie-stage{background:linear-gradient(180deg,rgba(214,238,255,.92),rgba(240,250,255,.92));border:3px solid #E8C876;border-radius:18px;padding:14px 10px 12px;box-shadow:0 10px 28px rgba(10,20,60,.3);overflow:hidden}
.ie-zoom{zoom:1.45;padding:26px 0 30px;display:flex;justify-content:center}
.ie-hint{text-align:center;font-size:12.5px;font-weight:800;color:#3d5a8a;margin-top:2px}
.ie-tools{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;margin-top:10px;background:#fff;border:2px solid #ead9b0;border-radius:14px;padding:8px}
.ie-tools.off{opacity:.55}
.ie-selname{font-size:13.5px;font-weight:900;color:#17397d;padding:0 8px}
.ie-tools button{border:2px solid #c9d6f5;background:#f2f6ff;color:#17397d;font-weight:900;font-size:13px;border-radius:999px;padding:9px 14px;cursor:pointer;min-height:44px}
.ie-tools button.del{border-color:#f0a9b5;background:#fdeff1;color:#b4233f}
.ie-tools button:disabled{opacity:.45;cursor:not-allowed}
.ie-inv{background:linear-gradient(180deg,rgba(38,52,104,.94),rgba(27,38,82,.96));border:3px solid #E8C876;border-radius:18px;padding:12px;box-shadow:0 10px 28px rgba(10,20,60,.35)}
.ie-tabs{display:flex;flex-wrap:wrap;gap:6px;padding-bottom:6px}
.ie-tabs button{flex-shrink:0;border:2px solid #D9A441;background:linear-gradient(180deg,#fffef9,#f3ead6);color:#3b3524;font-weight:900;font-size:12.5px;border-radius:999px;padding:8px 12px;cursor:pointer;min-height:42px;white-space:nowrap}
.ie-tabs button.on{background:linear-gradient(180deg,#3d8af0,#1554c4);border-color:#F5D77E;color:#fff}
.ie-limit{color:#f6dc9a;font-size:12px;font-weight:900;margin:6px 2px 8px}
.ie-items{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:56vh;overflow-y:auto}
.ie-empty{grid-column:1/-1;color:#dbe3ff;font-size:13px;font-weight:800;text-align:center;padding:20px 0}
.ie-item{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;border:3px solid #e9d6a6;background:radial-gradient(ellipse at 50% 34%,#fff 0%,#f4f1fa 45%,#fbf4e3 100%);border-radius:12px;padding:8px 4px 6px;cursor:pointer;min-width:0}
.ie-item.on{border-color:#3d8af0;box-shadow:0 0 0 2px rgba(61,138,240,.35)}
.ie-item.lock{opacity:.5}
.ie-img{height:70px;display:flex;align-items:center;justify-content:center}
.ie-img img{max-height:70px;max-width:100%;object-fit:contain}
.ie-img i{font-style:normal;font-size:10.5px;font-weight:800;color:#8a8fa8}
.ie-name{font-size:12px;font-weight:900;color:#2a2f52;overflow-wrap:anywhere;line-height:1.3;text-align:center}
.ie-own{font-size:10.5px;font-weight:800;color:#8a6a3a}
.ie-on{position:absolute;top:4px;left:-3px;background:linear-gradient(180deg,#3b78e0,#1454B8);color:#fff;font-size:9.5px;font-weight:900;padding:2px 8px;border-radius:0 999px 999px 0}
.ie-foot{pointer-events:none;position:fixed;left:0;right:0;bottom:0;z-index:50;display:flex;gap:10px;justify-content:center;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:linear-gradient(180deg,rgba(255,253,244,0),rgba(255,253,244,.96) 30%)}
.ie-foot button{pointer-events:auto}
.ie-foot button,.ie-modal button{border-radius:999px;font-weight:900;font-size:15px;padding:12px 26px;cursor:pointer;min-height:50px;border:3px solid #F5D77E}
.ie-foot .main,.ie-modal .main{background:linear-gradient(180deg,#3b78e0,#1454B8);color:#fff;min-width:190px;box-shadow:0 5px 12px rgba(16,47,112,.3)}
.ie-foot .sub,.ie-modal .sub{background:linear-gradient(180deg,#fffdf4,#f1e1bd);color:#17397d;border-color:#D9A441}
.ie-foot button:disabled{opacity:.55;cursor:not-allowed}
.ie-modal-bg{position:fixed;inset:0;z-index:300;background:rgba(16,47,112,.55);display:flex;align-items:center;justify-content:center;padding:18px}
.ie-modal{width:100%;max-width:380px;background:linear-gradient(180deg,#fffdf4,#f6e7c8);border:3px solid #D9A441;border-radius:20px;padding:20px 18px;text-align:center}
.ie-modal h3{margin:0 0 6px;font-size:18px;font-weight:900;color:#17397d}
.ie-modal p{margin:0 0 14px;font-size:13.5px;font-weight:700;color:#5b4a23}
.ie-modal div{display:flex;gap:8px}
.ie-modal button{flex:1;padding:11px 6px;font-size:14px;min-width:0}
.ie-toast{position:fixed;left:50%;bottom:92px;transform:translateX(-50%);z-index:400;background:#7f1d1d;color:#fff;font-size:13.5px;font-weight:900;border-radius:999px;padding:11px 20px;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:92vw;text-align:center}
.ie-toast.ok{background:#166534}
@media (max-width:900px){
  .ie-grid{grid-template-columns:1fr}
  .ie-title{font-size:14px;letter-spacing:0;white-space:nowrap;padding:9px 6px}
  .ie-back,.ie-shop{padding:10px 11px;font-size:12px}
  .ie-zoom{zoom:1;padding:6px 0 14px}
  .ie-stage{padding:8px 4px 10px}
  .ie-tools button{padding:8px 10px;font-size:12.5px}
  .ie-tabs{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
  .ie-tabs::-webkit-scrollbar{display:none}
  .ie-items{display:flex;overflow-x:auto;max-height:none;padding-bottom:6px;-webkit-overflow-scrolling:touch}
  .ie-item{flex:0 0 104px}
  .ie-foot button{padding:12px 16px}
  .ie-foot .main{min-width:0;flex:1}
}
`;
