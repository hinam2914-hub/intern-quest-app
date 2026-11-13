"use client";
// Intern Quest 2.0｜冒険者メニュー。HOME と同じ世界観（青空・浮島・大理石・ロイヤルブルー×金）。
// アイコンは ChatGPT 制作素材（public/menu/、一部は public/home/ の既存素材を再利用）。未提供の項目は絵文字で先行表示し、素材が届き次第差し替える。
// 権限・リンク先・ログアウトなどの動作は従来のまま。スケジュール（予定）への導線のみ廃止。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Item = { icon: string; label: string; path: string };
type Cat = { key: string; title: string; img?: string; emoji?: string; items: Item[] };

// よく使う（上段ショートカット5つ）
const SHORTCUTS: { img?: string; emoji?: string; label: string; desc: string; path: string }[] = [
    { img: "/home/icon_thinking.webp", label: "思考クエスト", desc: "お題に答えて思考力を鍛える", path: "/thinking" },
    { img: "/home/icon_report.webp", label: "日報", desc: "今日の実績・学びを記録する", path: "/report" },
    { img: "/home/icon_thanks.webp", label: "サンキュー", desc: "仲間に感謝の気持ちを届ける", path: "/thanks" },
    { img: "/menu/icon_learning.webp", label: "学びの記録", desc: "学習・挑戦の履歴を見る", path: "/growth" },
    { emoji: "🎯", label: "チャレンジ", desc: "追加のクエストに挑戦する", path: "/challenge" },
];

// メインメニュー（カテゴリー）。既存ページのみにリンクし、スケジュール導線だけ廃止
const CATS: Cat[] = [
    {
        key: "daily", title: "冒険・デイリー", img: "/home/icon_thinking.webp", items: [
            { icon: "🧠", label: "思考クエスト", path: "/thinking" },
            { icon: "📋", label: "日報", path: "/report" },
            { icon: "💌", label: "サンキュー", path: "/thanks" },
            { icon: "📊", label: "最近の活動", path: "/mypage" },
        ]
    },
    {
        key: "learn", title: "学び・挑戦", img: "/home/icon_report.webp", items: [
            { icon: "🌍", label: "SKILL WORLD", path: "/skill-board" },
            { icon: "📚", label: "学習コンテンツ", path: "/learn" },
            { icon: "🎯", label: "チャレンジ", path: "/challenge" },
            { icon: "📝", label: "テスト", path: "/tests" },
            { icon: "🗺️", label: "冒険マップ", path: "/journey" },
            { icon: "🏝️", label: "みんなの島へ行く", path: "/islands" },
            { icon: "🏅", label: "一人前チャレンジ", path: "/rookie" },
            { icon: "🎓", label: "講座スタンプ", path: "/courses" },
            { icon: "📖", label: "Wiki・資料", path: "/wiki" },
        ]
    },
    {
        key: "rank", title: "実績・成長", img: "/menu/icon_rank.webp", items: [
            { icon: "🏆", label: "ランキング", path: "/ranking" },
            { icon: "📜", label: "ポイント・獲得履歴", path: "/history" },
            { icon: "🎖️", label: "バッジ・称号", path: "/badges" },
            { icon: "📈", label: "成長の記録", path: "/growth" },
        ]
    },
    {
        key: "commu", title: "仲間・コミュニケーション", img: "/home/icon_thanks.webp", items: [
            { icon: "💌", label: "サンキューの送受信履歴", path: "/thanks" },
            { icon: "🧑‍🏫", label: "メンター報告", path: "/mentor-report" },
            { icon: "📣", label: "応援掲示板", path: "/cheer" },
            { icon: "🐟", label: "メダカBOX", path: "/medaka" },
            { icon: "📄", label: "MTGレポート", path: "/mtg-report" },
            { icon: "📚", label: "MTG議事録まとめ", path: "/mtg-box" },
        ]
    },
    {
        key: "career", title: "就活・キャリア", emoji: "💼", items: [
            { icon: "✍️", label: "ES", path: "/es" },
            { icon: "📈", label: "就活市場ランク", path: "/rank" },
            { icon: "🗺️", label: "ロードマップ", path: "/roadmap" },
            { icon: "💼", label: "キャリアBOX", path: "/career" },
            { icon: "🎯", label: "月次KPI", path: "/kpi" },
        ]
    },
    {
        key: "setting", title: "マイページ・設定", img: "/menu/icon_settings.webp", items: [
            { icon: "🪪", label: "冒険者プロフィール", path: "/mypage" },
            { icon: "🧍", label: "アバター編集", path: "/onboarding/avatar?from=mypage" },
            { icon: "✏️", label: "基本プロフィール編集", path: "/mypage" },
            { icon: "🔔", label: "通知設定", path: "/notifications" },
        ]
    },
];

const CSS = `
.mn-page{min-height:100vh;overflow-x:clip;background:url(/home/bg_mobile.webp) center top / cover no-repeat fixed, #bfe3f5;display:flex;flex-direction:column;align-items:center;padding:14px 14px 130px;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#1f2a44}
.mn-col{width:100%;max-width:480px;display:flex;flex-direction:column}
@media (min-width:700px){ .mn-page{background-image:url(/home/bg_pc.webp)} .mn-col{max-width:880px} }
.mn-top{display:flex;justify-content:flex-end;margin-bottom:4px}
.mn-home{border:2px solid #e8c45a;background:rgba(255,253,245,.92);color:#17397d;font-weight:900;font-size:13px;border-radius:999px;padding:8px 16px;cursor:pointer;font-family:inherit;box-shadow:0 3px 8px rgba(40,60,120,.15)}
.mn-title{position:relative;width:min(88%,460px);margin:0 auto;container-type:inline-size;z-index:2}
.mn-title img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 14px rgba(20,40,90,.3))}
.mn-title>div{position:absolute;inset:25.9% 10% 11.8%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;pointer-events:none}
.mn-title .t1{font-size:clamp(16px,6.2cqw,26px);font-weight:900;letter-spacing:.08em;text-shadow:0 2px 4px rgba(10,25,70,.55)}
.mn-title .t2{font-size:clamp(8px,2.3cqw,11px);font-weight:800;letter-spacing:.42em;color:#cfe0ff;margin-top:1%}
.mn-h{align-self:center;display:flex;align-items:center;gap:8px;background:linear-gradient(180deg,#fffdf4,#f8efdb);border:2px solid #e2bf63;border-radius:999px;padding:5px 22px;font-weight:900;color:#7a5a1a;font-size:14px;margin:18px 0 10px;box-shadow:0 2px 6px rgba(140,100,30,.18)}
.mn-h .dia{color:#e0b24a;font-size:.8em}
.mn-shorts{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
@media (max-width:699px){ .mn-shorts{grid-template-columns:repeat(3,1fr)} }
.mn-short{border:2.5px solid #e2bf63;background:linear-gradient(180deg,#fffdf4,#f8efdb);border-radius:16px;padding:10px 6px 9px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;font-family:inherit;box-shadow:0 4px 10px rgba(140,100,30,.16),inset 0 2px 0 rgba(255,255,255,.8)}
.mn-short img{height:44px;width:auto;filter:drop-shadow(0 2px 3px rgba(120,90,30,.25))}
.mn-short .em{font-size:36px;line-height:44px}
.mn-short .nm{width:100%;box-sizing:border-box;background:linear-gradient(180deg,#3b70d4,#1d3f96);border:1.5px solid #e2bf63;border-radius:999px;color:#fff;font-weight:900;font-size:11px;padding:3px 2px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mn-short .ds{font-size:9.5px;font-weight:700;color:#8a6a3a;line-height:1.35;text-align:center;min-height:2.6em}
.mn-grid{display:grid;grid-template-columns:1fr;gap:10px}
@media (min-width:700px){ .mn-grid{grid-template-columns:1fr 1fr} }
.mn-cat{background:linear-gradient(180deg,#fffdf4,#f8efdb);border:3px solid #d8b55e;border-radius:18px;padding:12px 12px 10px;box-shadow:0 0 0 3px rgba(255,255,255,.4),0 8px 20px rgba(40,60,120,.15),inset 0 2px 0 rgba(255,255,255,.8)}
.mn-cathead{display:flex;align-items:center;gap:10px;background:linear-gradient(180deg,#3b70d4,#1d3f96);border:2px solid #e2bf63;border-radius:12px;padding:7px 12px;color:#fff;font-weight:900;font-size:13.5px;box-shadow:inset 0 2px 0 rgba(255,255,255,.25)}
.mn-cathead img{height:26px;width:auto}
.mn-cathead .em{font-size:18px}
.mn-item{display:flex;align-items:center;gap:10px;width:100%;padding:9px 8px;border:none;background:transparent;border-bottom:1px solid rgba(190,160,110,.25);cursor:pointer;font-family:inherit;text-align:left}
.mn-item:last-child{border-bottom:none}
.mn-item .ic{font-size:16px;width:22px;text-align:center;flex:none}
.mn-item .lb{flex:1;font-size:13px;font-weight:800;color:#3a4256}
.mn-item .ar{font-size:12px;color:#b09a6a;font-weight:900}
.mn-shop{display:flex;align-items:center;gap:14px;margin-top:14px;background:linear-gradient(180deg,#fffdf4,#f6e7c8);border:3px solid #d8b55e;border-radius:20px;padding:12px 16px;cursor:pointer;font-family:inherit;box-shadow:0 0 0 3px rgba(255,255,255,.4),0 8px 20px rgba(140,100,30,.22);text-align:left;width:100%}
.mn-shop img{height:58px;width:auto;filter:drop-shadow(0 3px 5px rgba(120,80,20,.3))}
.mn-shop .t{font-size:12px;font-weight:900;color:#8a6a3a;letter-spacing:.06em}
.mn-shop .p{font-size:22px;font-weight:900;color:#17397d;line-height:1.2}
.mn-shop .d{font-size:10.5px;font-weight:700;color:#a08356}
.mn-admin{display:flex;align-items:center;gap:12px;margin-top:10px;background:rgba(255,253,245,.92);border:2.5px solid #9db7e8;border-radius:16px;padding:10px 14px;cursor:pointer;font-family:inherit;width:100%;text-align:left;box-shadow:0 4px 12px rgba(40,60,120,.15)}
.mn-admin img{height:40px;width:auto}
.mn-admin .lb{flex:1;font-size:13.5px;font-weight:900;color:#17397d}
.mn-admin .ds{font-size:10.5px;font-weight:700;color:#8a93a6}
.mn-logout{margin-top:10px;width:100%;padding:12px 0;border-radius:999px;border:2.5px solid #e8a0a0;background:rgba(255,248,248,.92);color:#c04545;font-size:13.5px;font-weight:900;cursor:pointer;font-family:inherit}
.mn-luku{display:flex;align-items:flex-end;margin-top:16px;container-type:inline-size}
.mn-luku .lk{width:26%;max-width:120px;flex:none}
.mn-luku .lk img{width:100%;display:block;filter:drop-shadow(0 6px 10px rgba(30,40,90,.3))}
.mn-luku .bw{flex:1;min-width:0;display:flex;flex-direction:column;margin-bottom:4%}
.mn-luku .pl{width:30%;min-width:88px;position:relative;margin-left:5%;z-index:2}
.mn-luku .pl img{display:block;width:100%;height:auto}
.mn-luku .pl span{position:absolute;inset:0 0 6% 0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:clamp(11px,3cqw,14px);letter-spacing:.2em;text-shadow:0 1px 3px rgba(10,25,70,.6)}
.mn-luku .bub{margin-top:-4%;background:url(/home/luku_bubble.webp);background-size:100% 100%;padding:7% 7% 10% 8.5%;font-weight:800;color:#4a3519;font-size:clamp(12px,3.4cqw,14px);line-height:1.7}
.mn-nav{position:fixed;left:0;bottom:0;width:100%;max-width:100vw;box-sizing:border-box;z-index:50;display:flex;height:calc(86px + env(safe-area-inset-bottom));padding:0 10px calc(10px + env(safe-area-inset-bottom));overflow:hidden}
.mn-nav .band{position:absolute;inset:6px 8px calc(8px + env(safe-area-inset-bottom));background:url(/home/nav_bar.webp);background-size:100% 100%;pointer-events:none}
.mn-nav button{position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;padding-bottom:calc(17px + env(safe-area-inset-bottom));background:transparent;border:none;cursor:pointer;color:#fff;text-shadow:0 1px 2px rgba(70,40,10,.7);-webkit-tap-highlight-color:transparent}
.mn-nav .lbl{font-size:10.5px;font-weight:800}
`;

export default function MenuPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [balance, setBalance] = useState<number | null>(null);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
            if (user.email && adminEmails.includes(user.email)) setIsAdmin(true);
            const { data: pr } = await supabase.from("user_points").select("*").eq("id", user.id).maybeSingle();
            const p: any = pr;
            setBalance(typeof p?.points === "number" ? p.points : (typeof p?.balance === "number" ? p.balance : null));
            setLoading(false);
        };
        init();
    }, [router]);

    if (loading) return <div className="mn-page" style={{ justifyContent: "center" }}><style>{CSS}</style><div style={{ fontWeight: 800, color: "#5a6b85" }}>読み込み中...</div></div>;

    return (
        <div className="mn-page">
            <style>{CSS}</style>
            <div className="mn-col">
                <div className="mn-top"><button className="mn-home" onClick={() => router.push("/mypage")}>🏠 おうちへ戻る</button></div>
                <div className="mn-title">
                    <img src="/home/title_plate.webp" alt="" width={1200} height={374} />
                    <div><span className="t1">冒険者メニュー</span><span className="t2">MENU</span></div>
                </div>

                {/* よく使う */}
                <div className="mn-h"><span className="dia">◆</span>よく使う<span className="dia">◆</span></div>
                <div className="mn-shorts">
                    {SHORTCUTS.map((s) => (
                        <button key={s.path + s.label} className="mn-short" onClick={() => router.push(s.path)}>
                            {s.img ? <img src={s.img} alt="" /> : <span className="em">{s.emoji}</span>}
                            <span className="nm">{s.label}</span>
                            <span className="ds">{s.desc}</span>
                        </button>
                    ))}
                </div>

                {/* メインメニュー */}
                <div className="mn-h"><span className="dia">◆</span>メインメニュー<span className="dia">◆</span></div>
                <div className="mn-grid">
                    {CATS.map((c) => (
                        <div key={c.key} className="mn-cat">
                            <div className="mn-cathead">{c.img ? <img src={c.img} alt="" /> : <span className="em">{c.emoji}</span>}{c.title}</div>
                            <div>
                                {c.items.map((it) => (
                                    <button key={it.path + it.label} className="mn-item" onClick={() => router.push(it.path)}>
                                        <span className="ic">{it.icon}</span><span className="lb">{it.label}</span><span className="ar">→</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ポイントショップ */}
                <button className="mn-shop" onClick={() => router.push("/shop")}>
                    <img src="/menu/icon_shop.webp" alt="" />
                    <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="t">ポイントショップ</span>
                        <span className="p" style={{ display: "block" }}>{balance !== null ? `${balance.toLocaleString()} pt` : "ショップへ"}</span>
                        <span className="d">{balance !== null ? "獲得したポイントでアイテムと交換しよう（累計ptとは別）" : "貯めたptでアイテムと交換"}</span>
                    </span>
                    <span style={{ fontSize: 16, color: "#b09a6a", fontWeight: 900 }}>→</span>
                </button>

                {/* 管理者（権限のあるユーザーのみ） */}
                {isAdmin && (
                    <button className="mn-admin" onClick={() => router.push("/admin")}>
                        <img src="/menu/icon_admin.webp" alt="" />
                        <span style={{ flex: 1 }}><span className="lb" style={{ display: "block" }}>管理者ページ</span><span className="ds">メンバー管理・データ確認</span></span>
                        <span style={{ fontSize: 14, color: "#8a93a6", fontWeight: 900 }}>→</span>
                    </button>
                )}

                <button className="mn-logout" onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}>ログアウト</button>

                {/* ルクの案内 */}
                <div className="mn-luku">
                    <div className="lk"><img src="/onboarding/luku.png" alt="ルク" /></div>
                    <div className="bw">
                        <div className="pl"><img src="/home/luku_plate.webp" alt="" /><span>ルク</span></div>
                        <div className="bub">ここから各機能にアクセスできるよ！今日も充実した冒険にしよう！</div>
                    </div>
                </div>
            </div>

            {/* 下部ナビ（HOMEと同じ木目バー。項目・遷移先は共通） */}
            <div className="mn-nav">
                <div className="band" />
                {[
                    { key: "home", label: "ホーム", href: "/home" },
                    { key: "ranking", label: "ランキング", href: "/ranking" },
                    { key: "house", label: "おうち", href: "/mypage" },
                    { key: "menu", label: "メニュー", href: "/menu" },
                ].map((t) => (
                    <button key={t.href} onClick={() => router.push(t.href)}>
                        {t.key === "home" && <img src="/home/nav_home_active.webp" alt="" style={{ height: 46, marginBottom: -2, filter: "drop-shadow(0 3px 5px rgba(30,40,90,.4))" }} />}
                        {t.key === "ranking" && <img src="/home/nav_trophy.webp" alt="" style={{ height: 30 }} />}
                        {t.key === "house" && <img src="/home/nav_house.webp" alt="" style={{ height: 30 }} />}
                        {t.key === "menu" && <div style={{ fontSize: 20, lineHeight: "30px", color: "#ffe9a8" }}>☰</div>}
                        <div className="lbl" style={t.key === "menu" ? { color: "#ffe9a8" } : undefined}>{t.label}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}
