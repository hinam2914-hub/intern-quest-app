"use client";
// 就活ボックス（王国の資料図書館）。見た目を変えただけで、データは従来のまま：
// ・career_items を全件取得（カテゴリ順 → 新しい順）。読むだけで、このページからは何も書き込まない
// ・カテゴリのボタンは記事のカテゴリから自動で作る（今は「就活」「資料」）
// ・検索はタイトルと本文が対象。カテゴリとの組み合わせで絞り込む
// ・本文は一切加工しない。長い記事は最初だけ見せて「続きを読む」で全文を開く
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type CareerItem = { id: string; title: string; description: string | null; category: string; url: string | null; };

/** カテゴリ名 → アイコン（登録の無いカテゴリは文字だけで出す） */
const CAT_IMG: Record<string, string> = { "就活": "/career/cat_shukatsu.webp", "資料": "/career/cat_shiryo.webp" };
const PREVIEW_PX = 176;   // たたんだ時に見せる本文の高さ（約6行）

/** 本文。たたんだ高さより長い時だけ「続きを読む／閉じる」を出す */
function Body({ id, text, open, onToggle }: { id: string; text: string; open: boolean; onToggle: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const [long, setLong] = useState(false);
    useLayoutEffect(() => {
        const el = ref.current; if (!el) return;
        const check = () => setLong(el.scrollHeight > PREVIEW_PX + 40);
        check();
        const ro = new ResizeObserver(check); ro.observe(el);
        return () => ro.disconnect();
    }, [text]);
    const folded = long && !open;
    return (
        <>
            <div id={"cr-body-" + id} ref={ref} className={"cr-body" + (folded ? " fold" : "")} style={folded ? { maxHeight: PREVIEW_PX } : undefined}>{text}</div>
            {long && (
                <button type="button" className="cr-more" aria-expanded={open} aria-controls={"cr-body-" + id} onClick={onToggle}>
                    {open ? "閉じる ▲" : "続きを読む ▼"}
                </button>
            )}
        </>
    );
}

export default function CareerPage() {
    const router = useRouter();
    const [items, setItems] = useState<CareerItem[]>([]);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [openIds, setOpenIds] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const load = async () => {
            const { data, error } = await supabase.from("career_items").select("*").order("category").order("created_at", { ascending: false });
            if (error) setFailed(true);
            setItems((data || []) as CareerItem[]);
            setLoading(false);
        };
        load();
    }, []);

    const categories = [...new Set(items.map(i => i.category))];
    const q = search.trim().toLowerCase();
    const filtered = items.filter(i =>
        (selectedCategory === "all" || i.category === selectedCategory) &&
        (q === "" || (i.title || "").toLowerCase().includes(q) || (i.description || "").toLowerCase().includes(q))
    );
    const toggle = (id: string) => {
        const closing = !!openIds[id];
        setOpenIds(p => ({ ...p, [id]: !p[id] }));
        // 閉じた時は、カードの先頭が見える位置に戻す（長文を閉じて迷子にならないように）
        if (closing) requestAnimationFrame(() => { const el = document.getElementById("cr-card-" + id); if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" }); });
    };

    if (loading) return <main className="cr-root cr-loading"><style>{CSS}</style>読み込み中…</main>;

    return (
        <main className="cr-root">
            <style>{CSS}</style>
            <div className="cr-wrap">
                <header className="cr-head">
                    <img className="cr-deco cr-deco-l" src="/es/deco_books.webp" alt="" />
                    <div className="cr-title">
                        <img src="/career/title_frame.webp" alt="" />
                        <div className="cr-title-t">
                            <button className="cr-brand" onClick={() => router.push("/home")}>INTERN QUEST</button>
                            <h1>就活ボックス</h1>
                        </div>
                        <p>大学別・企業別の就活情報をまとめました</p>
                    </div>
                    <img className="cr-deco cr-deco-r" src="/rookie/section_quill.webp" alt="" />
                </header>

                <section className="cr-panel">
                    <div className="cr-search">
                        <i aria-hidden />
                        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="検索..." aria-label="就活情報を検索" />
                        {search && <button type="button" onClick={() => setSearch("")} aria-label="検索を消す">×</button>}
                    </div>
                    <div className="cr-cats" role="group" aria-label="カテゴリ">
                        <button type="button" className={"cr-cat" + (selectedCategory === "all" ? " on" : "")} aria-pressed={selectedCategory === "all"} onClick={() => setSelectedCategory("all")}><img src="/career/cat_all.webp" alt="" />すべて<small>{items.length}</small></button>
                        {categories.map(cat => (
                            <button type="button" key={cat} className={"cr-cat" + (selectedCategory === cat ? " on" : "")} aria-pressed={selectedCategory === cat} onClick={() => setSelectedCategory(cat)}>{CAT_IMG[cat] && <img src={CAT_IMG[cat]} alt="" />}{cat}<small>{items.filter(i => i.category === cat).length}</small></button>
                        ))}
                    </div>

                    {failed ? (
                        <div className="cr-empty">読み込みに失敗しました。通信状況を確認して、ページを開き直してください。</div>
                    ) : filtered.length === 0 ? (
                        <div className="cr-empty">該当する情報がありません</div>
                    ) : (
                        <div className="cr-list">
                            {(q !== "" || selectedCategory !== "all") && <div className="cr-count">{filtered.length}件の情報</div>}
                            {filtered.map(item => (
                                <article key={item.id} id={"cr-card-" + item.id} className="cr-card">
                                    <img className="cr-emb" src="/career/card_emblem.webp" alt="" />
                                    <div className="cr-card-h">
                                        <span className="cr-badge">{item.category}</span>
                                        <h2>{item.title}</h2>
                                    </div>
                                    {item.description && <Body id={item.id} text={item.description} open={!!openIds[item.id]} onToggle={() => toggle(item.id)} />}
                                    {item.url && <a className="cr-link" href={item.url} target="_blank" rel="noreferrer">🔗 詳細を見る →</a>}
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <button className="cr-back" onClick={() => router.push("/menu")}>メニューへ戻る</button>
            </div>

            <div className="cr-nav">
                <div className="band" />
                {[{ k: "home", l: "ホーム", h: "/home", img: "/home/nav_home_active.webp" }, { k: "rank", l: "ランキング", h: "/ranking", img: "/home/nav_trophy.webp" }, { k: "house", l: "おうち", h: "/mypage", img: "/home/nav_house.webp" }, { k: "menu", l: "メニュー", h: "/menu", img: "" }].map((t) => (
                    <button key={t.k} onClick={() => router.push(t.h)}>{t.img ? <img src={t.img} alt="" /> : <span>☰</span>}<i>{t.l}</i></button>
                ))}
            </div>
        </main>
    );
}

const CSS = `
.cr-root{min-height:100vh;min-height:100dvh;overflow-x:clip;background:url(/home/bg_mobile.webp) center top / cover no-repeat fixed,#bfe3f5;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#23284a;padding:14px 10px calc(108px + env(safe-area-inset-bottom));box-sizing:border-box}
@media (min-width:700px){ .cr-root{background-image:url(/home/bg_pc.webp);padding-top:22px} }
.cr-root *{box-sizing:border-box}
.cr-loading{display:flex;align-items:center;justify-content:center;font-weight:900;color:#17397d}
.cr-wrap{max-width:1040px;margin:0 auto}
.cr-head{position:relative;display:flex;align-items:flex-end;justify-content:center;gap:0;z-index:2}
.cr-title{position:relative;z-index:1;flex:0 1 640px;min-width:0;container-type:inline-size}
.cr-title>img{display:block;width:100%;height:auto;filter:drop-shadow(0 8px 14px rgba(16,47,112,.3))}
.cr-title-t{position:absolute;left:11%;right:11%;top:27%;bottom:32%;display:flex;flex-direction:column;align-items:center;justify-content:center}
.cr-brand{display:block;border:none;background:none;color:#3160d2;font-size:clamp(8px,2cqw,13px);font-weight:900;letter-spacing:.3em;cursor:pointer;font-family:inherit;padding:2px 8px;line-height:1.2}
.cr-title h1{margin:0;font-size:clamp(20px,8cqw,50px);font-weight:900;color:#17307a;letter-spacing:.08em;line-height:1.15;white-space:nowrap}
.cr-title p{position:absolute;left:21%;right:21%;top:75.5%;bottom:10%;margin:0;display:flex;align-items:center;justify-content:center;font-size:clamp(8.5px,2.9cqw,16px);font-weight:900;color:#5a4a22;white-space:nowrap}
.cr-deco{flex-shrink:0;height:auto;filter:drop-shadow(0 6px 8px rgba(16,47,112,.3))}
.cr-deco-l{width:170px;margin-right:-34px;margin-bottom:14px;position:relative;z-index:2}
.cr-deco-r{width:120px;margin-left:-30px;margin-bottom:22px;position:relative;z-index:2}
.cr-panel{position:relative;margin-top:-18px;padding:40px 30px 26px;background:linear-gradient(180deg,rgba(255,253,246,.97),rgba(248,238,216,.97));border:3px solid #e2bf63;border-radius:26px;box-shadow:inset 0 0 0 2px #fff,0 14px 30px rgba(16,47,112,.3)}
.cr-search{position:relative;display:flex;align-items:center;background:#fff;border:2px solid #e2bf63;border-radius:999px;box-shadow:inset 0 2px 4px rgba(120,80,20,.08)}
.cr-search:focus-within{border-color:#2a4aa6;box-shadow:0 0 0 3px rgba(42,74,166,.16)}
.cr-search>i{position:relative;flex-shrink:0;width:16px;height:16px;margin:0 6px 4px 20px;border:3px solid #17307a;border-radius:50%}
.cr-search>i::after{content:"";position:absolute;right:-8px;bottom:-7px;width:9px;height:3px;background:#17307a;border-radius:2px;transform:rotate(45deg)}
.cr-search input{flex:1;min-width:0;min-height:52px;padding:0 12px 0 8px;border:none;background:transparent;font-size:16px;font-weight:700;color:#23284a;outline:none;font-family:inherit;-webkit-appearance:none;appearance:none}
.cr-search input::-webkit-search-cancel-button{display:none}
.cr-search input::placeholder{color:#a79f8e}
.cr-search button{flex-shrink:0;width:40px;height:40px;margin-right:6px;border:none;border-radius:50%;background:#f1e7cb;color:#5a4a22;font-size:18px;font-weight:900;cursor:pointer}
.cr-cats{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}
.cr-cat{display:inline-flex;align-items:center;gap:7px;min-height:48px;padding:8px 18px 8px 14px;border:2.5px solid #e2c98c;border-radius:14px;background:linear-gradient(180deg,#fff,#fbf2de);color:#2a2f52;font-size:15px;font-weight:900;cursor:pointer;font-family:inherit;white-space:nowrap;box-shadow:0 3px 7px rgba(120,80,20,.16)}
.cr-cat img{width:26px;height:26px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 1px 2px rgba(0,0,0,.2))}
.cr-cat small{font-size:11px;font-weight:900;color:#8a6a1e;background:#f6e7bd;border-radius:999px;padding:1px 7px}
.cr-cat.on{background:linear-gradient(180deg,#3b78e0,#1746b0);border-color:#f5d77e;color:#fff;box-shadow:0 0 0 2px #1746b0,0 5px 12px rgba(16,47,112,.4)}
.cr-cat.on small{background:rgba(255,255,255,.22);color:#fff}
.cr-cat:focus-visible,.cr-more:focus-visible,.cr-link:focus-visible,.cr-back:focus-visible{outline:3px solid #2a4aa6;outline-offset:2px}
.cr-count{font-size:12.5px;font-weight:800;color:#7a6a45;margin:0 4px -2px}
.cr-list{display:flex;flex-direction:column;gap:14px;margin-top:18px}
.cr-empty{margin-top:18px;padding:34px 16px;text-align:center;font-size:14.5px;font-weight:800;color:#6b5a33;background:#fffdf7;border:2px dashed #e2c98c;border-radius:16px;line-height:1.7}
.cr-card{position:relative;background:linear-gradient(180deg,#fffefb,#fdf6e6);border:2.5px solid #e2bf63;border-radius:20px;padding:20px 26px 18px;box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 3px rgba(226,191,99,.3),0 5px 12px rgba(16,47,112,.14);min-width:0}
.cr-emb{position:absolute;right:20px;top:-7px;width:44px;height:auto;filter:drop-shadow(0 3px 4px rgba(16,47,112,.3));pointer-events:none}
.cr-card-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-right:52px;margin-bottom:10px}
.cr-badge{flex-shrink:0;padding:3px 12px;border-radius:8px;background:linear-gradient(180deg,#5a63e6,#3a2fb5);border:1.5px solid #f5d77e;color:#fff;font-size:12.5px;font-weight:900;letter-spacing:.04em}
.cr-card-h h2{margin:0;font-size:19px;font-weight:900;color:#17307a;line-height:1.45;min-width:0;overflow-wrap:anywhere}
.cr-body{position:relative;font-size:15px;line-height:1.95;color:#2c3147;white-space:pre-line;overflow-wrap:anywhere;overflow:hidden}
.cr-body.fold::after{content:"";position:absolute;left:0;right:0;bottom:0;height:64px;background:linear-gradient(180deg,rgba(253,246,230,0),#fdf6e6 88%);pointer-events:none}
.cr-more{display:block;margin:8px auto 0;min-height:44px;padding:7px 26px;border:2px solid #7f95d6;border-radius:999px;background:#fff;color:#17397d;font-size:13.5px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 3px 7px rgba(16,47,112,.14)}
.cr-link{display:inline-flex;align-items:center;min-height:44px;margin-top:6px;color:#1746b0;font-size:14px;font-weight:900;text-decoration:none}
.cr-back{display:block;margin:22px auto 0;min-height:44px;padding:8px 24px;border:2px solid #7f95d6;border-radius:999px;background:rgba(255,255,255,.92);color:#17397d;font-size:13.5px;font-weight:900;cursor:pointer;font-family:inherit}
.cr-nav{position:fixed;left:0;bottom:0;width:100%;max-width:100vw;z-index:50;display:flex;height:calc(86px + env(safe-area-inset-bottom));padding:0 10px calc(10px + env(safe-area-inset-bottom));overflow:hidden}
.cr-nav .band{position:absolute;inset:6px 8px calc(8px + env(safe-area-inset-bottom));background:url(/home/nav_bar.webp);background-size:100% 100%;pointer-events:none}
.cr-nav button{position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;padding-bottom:calc(17px + env(safe-area-inset-bottom));background:transparent;border:none;cursor:pointer;color:#fff;font-family:inherit}
.cr-nav img{height:30px}
.cr-nav span{font-size:20px;line-height:30px}
.cr-nav i{font-style:normal;font-size:10.5px;font-weight:800}
@media (max-width:760px){
  .cr-deco-l{width:100px;margin-right:-22px;margin-bottom:8px}
  .cr-deco-r{width:72px;margin-left:-20px;margin-bottom:12px}
}
@media (max-width:640px){
  .cr-deco{display:none}
  .cr-title{flex-basis:100%}
  .cr-panel{padding:26px 13px 18px;border-radius:20px;margin-top:-10px}
  .cr-cats{gap:6px;flex-wrap:nowrap}
  .cr-cat{flex:1 1 0;min-width:0;justify-content:center;padding:7px 6px;font-size:14px;gap:4px}
  .cr-cat img{width:22px;height:22px}
  .cr-cat small{padding:1px 6px}
  .cr-card{padding:16px 14px 14px;border-radius:16px}
  .cr-emb{right:12px;width:34px}
  .cr-card-h{padding-right:38px}
  .cr-card-h h2{font-size:17px}
  .cr-body{font-size:15px;line-height:1.9}
}
@media (max-width:350px){ .cr-cat small{display:none} }
`;
