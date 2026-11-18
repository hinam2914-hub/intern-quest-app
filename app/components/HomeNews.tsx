"use client";
// HOMEのお知らせ（運営からの告知）。ベル・PC用パネル・重要カード・一覧／詳細を1つの状態（useNews）で動かす。
// ・読むのは公開中のお知らせだけ（DB側のルールで、下書き・予約分は一般ユーザーに返らない）
// ・既読は announcement_reads にユーザーごとに保存（ログアウトしても残る）。開いたら既読になる
// ・NEW＝まだ読んでいないお知らせ
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { categoryInfo, newsDate, safeLink, NEWS_IMG, type News } from "../lib/news";

export type NewsState = {
    list: News[]; unread: number; isUnread: (id: string) => boolean;
    view: "none" | "list" | "detail"; current: News | null;
    openList: () => void; openDetail: (n: News) => void; back: () => void; close: () => void;
};

export function useNews(userId: string): NewsState {
    const [list, setList] = useState<News[]>([]);
    const [read, setRead] = useState<Set<string> | null>(null);   // null＝既読の保存先が未導入（その間は未読バッジを出さない）
    const [view, setView] = useState<"none" | "list" | "detail">("none");
    const [current, setCurrent] = useState<News | null>(null);
    const [fromList, setFromList] = useState(false);

    useEffect(() => {
        if (!userId) return;
        let alive = true;
        (async () => {
            const [{ data: rows }, { data: reads, error: rErr }] = await Promise.all([
                supabase.from("announcements").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(50),
                supabase.from("announcement_reads").select("announcement_id").eq("user_id", userId),
            ]);
            if (!alive) return;
            const now = Date.now();
            const items = ((rows || []) as any[]).map((r) => ({
                id: String(r.id), title: r.title || "", content: r.content || "", category: r.category || "important",
                publish_at: r.publish_at || r.created_at, is_important: !!r.is_important, link_url: safeLink(r.link_url),
            })).filter((n) => new Date(n.publish_at).getTime() <= now)
                .sort((a, b) => new Date(b.publish_at).getTime() - new Date(a.publish_at).getTime());
            setList(items);
            setRead(rErr ? null : new Set(((reads || []) as any[]).map((x) => String(x.announcement_id))));
        })();
        return () => { alive = false; };
    }, [userId]);

    const isUnread = useCallback((id: string) => !!read && !read.has(id), [read]);
    const unread = useMemo(() => (read ? list.filter((n) => !read.has(n.id)).length : 0), [list, read]);
    const markRead = async (n: News) => {
        if (!read || read.has(n.id) || !userId) return;
        setRead(new Set([...read, n.id]));
        await supabase.from("announcement_reads").upsert({ user_id: userId, announcement_id: n.id }, { onConflict: "user_id,announcement_id", ignoreDuplicates: true });
    };
    return {
        list, unread, isUnread, view, current,
        openList: () => { setFromList(false); setView("list"); },
        openDetail: (n) => { setFromList(view === "list"); setCurrent(n); setView("detail"); markRead(n); },
        back: () => { if (fromList) setView("list"); else setView("none"); setCurrent(null); },
        close: () => { setView("none"); setCurrent(null); },
    };
}

const summary = (s: string) => s.replace(/\s+/g, " ").trim();

/** 右上の通知ベル（未読件数の赤バッジつき） */
export function NewsBell({ news }: { news: NewsState }) {
    return (
        <button className="hn-bell" onClick={news.openList} aria-label={news.unread ? `お知らせ（未読${news.unread}件）` : "お知らせ"}>
            <style>{CSS}</style>
            <img src={NEWS_IMG.bell} alt="" />
            {news.unread > 0 && <span className="hn-badge">{news.unread > 99 ? "99+" : news.unread}</span>}
        </button>
    );
}

function Row({ n, news, compact }: { n: News; news: NewsState; compact?: boolean }) {
    const c = categoryInfo(n.category); const unread = news.isUnread(n.id);
    return (
        <button className={"hn-row" + (unread ? " unread" : "")} onClick={() => news.openDetail(n)}>
            <img className="hn-cat" src={c.img} alt="" />
            <span className="hn-mid">
                <span className="hn-meta">{unread && <em className="hn-new">NEW</em>}<i style={{ color: c.color }}>{c.label}</i><time>{newsDate(n.publish_at)}</time></span>
                <span className="hn-title">{n.title}</span>
                <span className={"hn-sum" + (compact ? " one" : "")}>{summary(n.content)}</span>
            </span>
            <span className="hn-go">›</span>
        </button>
    );
}

/** PC（1024px以上）で島の右に出すパネル：最新3件 */
export function NewsPanel({ news }: { news: NewsState }) {
    return (
        <aside className="hn-panel">
            <style>{CSS}</style>
            <div className="hn-ribbon"><img src={NEWS_IMG.ribbon} alt="" /><span>お知らせ</span></div>
            <div className="hn-paper">
                {news.list.length === 0 && <div className="hn-empty">いまお知らせはありません</div>}
                {news.list.slice(0, 3).map((n) => <Row key={n.id} n={n} news={news} compact />)}
                <button className="hn-all" onClick={news.openList}>すべてのお知らせを見る ›</button>
            </div>
        </aside>
    );
}

/** スマホ・タブレット：未読の「重要なお知らせ」があるときだけ出す小さな告知カード（最新1件） */
export function NewsImportantCard({ news }: { news: NewsState }) {
    const n = news.list.find((x) => x.is_important && news.isUnread(x.id));
    if (!n) return null;
    return (
        <button className="hn-imp" onClick={() => news.openDetail(n)}>
            <style>{CSS}</style>
            <img src={categoryInfo(n.category).img} alt="" />
            <span className="hn-imp-mid"><em className="hn-new">NEW</em><b>{n.title}</b></span>
            <span className="hn-imp-go">詳しく見る →</span>
        </button>
    );
}

/** 一覧と詳細（スマホは下から開くシート、PCは中央のウィンドウ） */
export function NewsLayer({ news }: { news: NewsState }) {
    const router = useRouter();
    // 開いているあいだは後ろのHOMEをスクロールさせない
    useEffect(() => {
        if (news.view === "none") return;
        const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
    }, [news.view]);
    if (news.view === "none") return null;
    const n = news.current; const c = n ? categoryInfo(n.category) : null;
    return (
        <div className="hn-bg" onClick={news.close}>
            <style>{CSS}</style>
            <div className="hn-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="hn-sheet-head">
                    {news.view === "detail" ? <button className="hn-x" onClick={news.back} aria-label="もどる">‹</button> : <span className="hn-x ghost" />}
                    <b>📣 お知らせ</b>
                    <button className="hn-x" onClick={news.close} aria-label="とじる">✕</button>
                </div>
                {news.view === "list" && (
                    <div className="hn-scroll">
                        {news.list.length === 0 && <div className="hn-empty">いまお知らせはありません</div>}
                        {news.list.map((x) => <Row key={x.id} n={x} news={news} />)}
                    </div>
                )}
                {news.view === "detail" && n && c && (
                    <div className="hn-scroll hn-detail">
                        <div className="hn-meta"><img className="hn-cat sm" src={c.img} alt="" /><i style={{ color: c.color }}>{c.label}</i><time>{newsDate(n.publish_at)}</time></div>
                        <h3>{n.title}</h3>
                        <p>{n.content}</p>
                        {n.link_url && <button className="hn-link" onClick={() => { const u = n.link_url!; news.close(); router.push(u); }}>詳しく見る →</button>}
                    </div>
                )}
            </div>
        </div>
    );
}

const CSS = `
.hn-bell{position:relative;width:48px;height:48px;border:none;background:none;padding:0;cursor:pointer;flex-shrink:0;filter:drop-shadow(0 4px 8px rgba(16,47,112,.3))}
.hn-bell img{width:100%;height:100%;object-fit:contain;display:block}
.hn-badge{position:absolute;top:-3px;right:-4px;min-width:20px;height:20px;box-sizing:border-box;padding:0 5px;border-radius:999px;background:#e11d48;border:2px solid #fff;color:#fff;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;line-height:1}
.hn-new{font-style:normal;display:inline-block;background:linear-gradient(180deg,#fb7185,#e11d48);color:#fff;font-size:10px;font-weight:900;letter-spacing:.5px;border-radius:999px;padding:2px 8px;flex-shrink:0}
.hn-panel{display:none}
.hn-ribbon{position:relative;width:86%;margin:0 auto -17px;z-index:2}
.hn-ribbon img{display:block;width:100%;height:auto;filter:drop-shadow(0 4px 8px rgba(16,47,112,.3))}
.hn-ribbon span{position:absolute;left:0;right:0;top:36%;text-align:center;color:#fff;font-size:19px;font-weight:900;letter-spacing:4px;text-shadow:0 2px 3px rgba(10,25,70,.6);padding-left:8%}
.hn-paper{background:linear-gradient(180deg,#fffdf6,#f8eed8);border:3px solid #e2bf63;border-radius:18px;padding:26px 12px 12px;box-shadow:inset 0 0 0 2px #fff,0 10px 26px rgba(16,47,112,.28)}
.hn-row{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;text-align:left;background:#fff;border:2px solid #efe2c0;border-radius:14px;padding:10px 10px;margin-bottom:8px;cursor:pointer;min-height:76px;font-family:inherit}
.hn-row:hover{border-color:#1454B8}
.hn-row.unread{border-color:#f3c96a;background:#fffdf5}
.hn-cat{width:42px;height:42px;object-fit:contain;flex-shrink:0}
.hn-cat.sm{width:26px;height:26px}
.hn-mid{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.hn-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:10.5px;font-weight:800}
.hn-meta i{font-style:normal}
.hn-meta time{color:#9a8f76;margin-left:auto}
.hn-title{font-size:14px;font-weight:900;color:#17397d;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}
.hn-sum{font-size:11.5px;font-weight:700;color:#7a6f58;line-height:1.45;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}
.hn-sum.one{-webkit-line-clamp:1}
.hn-go{color:#c9a04a;font-size:20px;font-weight:900;flex-shrink:0}
.hn-all{display:block;width:100%;margin-top:4px;border:2px solid #e2bf63;background:linear-gradient(180deg,#fffef9,#f6ecd2);color:#17397d;font-size:13px;font-weight:900;border-radius:999px;padding:11px 10px;cursor:pointer;min-height:44px;font-family:inherit}
.hn-empty{text-align:center;font-size:12.5px;font-weight:800;color:#8a7f66;padding:18px 6px}
.hn-imp{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;margin-top:14px;text-align:left;background:linear-gradient(180deg,#fffdf4,#fbeecb);border:2.5px solid #e2bf63;border-radius:16px;padding:10px 12px;cursor:pointer;min-height:56px;box-shadow:0 6px 16px rgba(16,47,112,.2);font-family:inherit}
.hn-imp img{width:38px;height:38px;object-fit:contain;flex-shrink:0}
.hn-imp-mid{flex:1;min-width:0;display:flex;align-items:center;gap:8px}
.hn-imp-mid b{font-size:13.5px;font-weight:900;color:#17397d;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-width:0}
.hn-imp-go{font-size:11.5px;font-weight:900;color:#b45309;white-space:nowrap;flex-shrink:0}
.hn-bg{position:fixed;inset:0;z-index:400;background:rgba(16,47,112,.55);display:flex;align-items:flex-end;justify-content:center}
.hn-sheet{width:100%;max-width:560px;max-height:86dvh;display:flex;flex-direction:column;background:linear-gradient(180deg,#fffdf6,#f8eed8);border:3px solid #e2bf63;border-bottom:none;border-radius:22px 22px 0 0;box-shadow:0 -10px 40px rgba(10,20,60,.4);padding-bottom:env(safe-area-inset-bottom);animation:hnUp .28s ease-out}
@keyframes hnUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
.hn-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:2px dashed rgba(226,191,99,.6)}
.hn-sheet-head b{font-size:17px;font-weight:900;color:#17397d;letter-spacing:2px}
.hn-x{width:44px;height:44px;border-radius:50%;border:2px solid #e2bf63;background:#fff;color:#17397d;font-size:19px;font-weight:900;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:inherit}
.hn-x.ghost{visibility:hidden}
.hn-scroll{overflow-y:auto;padding:12px;-webkit-overflow-scrolling:touch}
.hn-detail h3{margin:8px 0 10px;font-size:19px;font-weight:900;color:#17397d;line-height:1.45;overflow-wrap:anywhere}
.hn-detail p{margin:0;font-size:14.5px;line-height:1.85;color:#3b3524;white-space:pre-wrap;overflow-wrap:anywhere}
.hn-detail .hn-meta{font-size:12px}
.hn-link{display:block;width:100%;margin-top:18px;border:3px solid #F5D77E;background:linear-gradient(180deg,#3b78e0,#1454B8);color:#fff;font-size:15px;font-weight:900;border-radius:999px;padding:13px 10px;cursor:pointer;min-height:50px;box-shadow:0 5px 12px rgba(16,47,112,.3);font-family:inherit}
@media (min-width:1024px){
  .hn-panel{display:block;width:330px;flex-shrink:0;position:sticky;top:24px;margin-top:64px}
  .hn-imp{display:none}
  .hn-bg{align-items:center;padding:20px}
  .hn-sheet{border-bottom:3px solid #e2bf63;border-radius:22px;max-height:82vh;padding-bottom:0}
}
@media (max-width:360px){ .hn-imp-go{display:none} .hn-title{font-size:13px} }
@media (prefers-reduced-motion: reduce){ .hn-sheet{animation:none} }
`;
