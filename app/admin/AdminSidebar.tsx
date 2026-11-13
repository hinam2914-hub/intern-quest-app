"use client";
// 王国統括司令室：左サイドバー。既存の全管理機能（QUICK ACCESS / OTHER TOOLS 相当）をカテゴリーに再配置。
// 機能の削除なし・ロジックなし（onNavigate で既存の activeTab を切り替えるだけ）。
import { useState } from "react";
import { ADMIN_ICONS } from "./adminTheme";

type Badges = Record<string, number | undefined>;
type Item = { key: string; label: string; badge?: string };
type Group = { id: string; icon: string; label: string; items: Item[] };

const GROUPS: Group[] = [
    {
        id: "people", icon: "👥", label: "人材・組織", items: [
            { key: "users", label: "ユーザー一覧" },
            { key: "teams", label: "チーム管理" },
            { key: "sibyl", label: "シビュラ（AI適性分析）" },
            { key: "sibyl_guide", label: "シビュラの見方" },
            { key: "talent_archive", label: "人材アーカイブ" },
            { key: "companies", label: "企業管理" },
            { key: "recruit", label: "HRキャンペーン承認", badge: "pendingRecruit" },
            { key: "dept_stats", label: "部署データ" },
        ],
    },
    {
        id: "reports", icon: "📋", label: "日報・評価", items: [
            { key: "reports", label: "日報の確認・評価", badge: "pendingCount" },
            { key: "report_eval", label: "日報評価" },
            { key: "report_analytics", label: "日報分析" },
            { key: "mtg_report", label: "MTG報告書", badge: "pendingMtg" },
            { key: "mentor_report", label: "ペイフォワード", badge: "pendingMentor" },
            { key: "thanks_history", label: "サンキュー履歴" },
            { key: "schedule", label: "スケジュール" },
            { key: "tests", label: "テスト結果", badge: "pendingTest" },
        ],
    },
    {
        id: "kpi", icon: "📊", label: "KPI・分析", items: [
            { key: "kpi", label: "KPI設定" },
            { key: "monthly_kpi", label: "月次KPI" },
            { key: "kpi_dashboard", label: "KPIダッシュボード" },
            { key: "dashboard", label: "週次サマリー" },
            { key: "sales", label: "売上管理" },
            { key: "survey", label: "アンケート" },
        ],
    },
    {
        id: "training", icon: "🎓", label: "育成・研修", items: [
            { key: "contents", label: "学習コンテンツ", badge: "pendingLearn" },
            { key: "course", label: "講座スタンプ" },
            { key: "required_check", label: "必修チェック" },
            { key: "rookie", label: "一人前チャレンジ", badge: "pendingRookie" },
            { key: "fb_requests", label: "FBリクエスト", badge: "pendingFb" },
            { key: "skill_check", label: "スキル認定", badge: "pendingSkill" },
            { key: "journey", label: "冒険マップ進捗", badge: "pendingJourney" },
            { key: "script_practice", label: "スクリプト練習" },
            { key: "roadmap", label: "ロードマップ" },
            { key: "challenges", label: "チャレンジ", badge: "pendingChallenge" },
            { key: "thinking_manage", label: "思考クエスト" },
            { key: "questions_box", label: "質問クエスト" },
            { key: "routine_check", label: "ルーティン" },
        ],
    },
    {
        id: "shop", icon: "🛍️", label: "ショップ管理", items: [
            { key: "shop", label: "購入承認（全ショップ）", badge: "pendingShop" },
            { key: "avatar_shop", label: "アバター景品" },
            { key: "island_shop", label: "島の景品" },
            { key: "gear_shop", label: "装備（アバター）" },
        ],
    },
    {
        id: "others", icon: "⚙️", label: "その他の管理", items: [
            { key: "requests", label: "各種申請", badge: "pendingRequest" },
            { key: "task_management", label: "タスク管理", badge: "pendingTask" },
            { key: "announce", label: "お知らせ配信" },
            { key: "urgent", label: "緊急連絡" },
            { key: "medaka_manage", label: "メダカBOX", badge: "pendingMedaka" },
            { key: "badge", label: "バッジ" },
            { key: "kkc", label: "KKC", badge: "pendingKkc" },
            { key: "advice", label: "アドバイス", badge: "pendingAdvice" },
            { key: "wiki", label: "用語集" },
            { key: "resources", label: "資料管理" },
            { key: "career", label: "就活ボックス" },
            { key: "es", label: "総合ES" },
        ],
    },
];

export default function AdminSidebar({ activeTab, badges, onNavigate, onExit, isMobile }: {
    activeTab: string; badges: Badges; onNavigate: (key: string) => void; onExit: () => void; isMobile: boolean;
}) {
    const [open, setOpen] = useState<Record<string, boolean>>({});
    const [drawer, setDrawer] = useState(false);

    const groupBadge = (g: Group) => g.items.reduce((s, it) => s + (it.badge ? badges[it.badge] || 0 : 0), 0);
    const nav = (key: string) => { onNavigate(key); if (isMobile) setDrawer(false); };

    const body = (
        <div className="as-body">
            <div className="as-logo">
                <div className="as-logo-crown">{ADMIN_ICONS.crown ? <img src={ADMIN_ICONS.crown} alt="" style={{ width: 40, height: 40, objectFit: "contain" }} /> : "👑"}</div>
                <div className="as-logo-main">INTERN QUEST</div>
                <div className="as-logo-admin">ADMIN</div>
                <div className="as-logo-sub">王国統括司令室<span>Management Command</span></div>
            </div>

            <button className={"as-home" + (activeTab === "home" ? " as-home-on" : "")} onClick={() => nav("home")}>🏠 ダッシュボード</button>

            <div className="as-groups">
                {GROUPS.map((g) => {
                    const isOpen = !!open[g.id];
                    const gb = groupBadge(g);
                    const hasActive = g.items.some((it) => it.key === activeTab);
                    return (
                        <div key={g.id} className="as-group">
                            <button className={"as-ghead" + (hasActive ? " as-ghead-active" : "")} onClick={() => setOpen((o) => ({ ...o, [g.id]: !o[g.id] }))}>
                                <span className="as-gicon">{g.icon}</span>
                                <span className="as-glabel">{g.label}</span>
                                {gb > 0 && <span className="as-badge">{gb}</span>}
                                <span className={"as-arrow" + (isOpen ? " as-arrow-open" : "")}>▸</span>
                            </button>
                            {isOpen && (
                                <div className="as-items">
                                    {g.items.map((it) => {
                                        const b = it.badge ? badges[it.badge] || 0 : 0;
                                        return (
                                            <button key={it.key} className={"as-item" + (activeTab === it.key ? " as-item-on" : "")} onClick={() => nav(it.key)}>
                                                <span className="as-item-label">{it.label}</span>
                                                {b > 0 && <span className="as-badge">{b}</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="as-foot">
                <img className="as-foot-castle" src="/island/castle/castle-stage-5.webp" alt="" />
                <button className="as-exit" onClick={onExit}>🏠 一般ユーザー画面へ ↗</button>
                <div className="as-me">👑 管理者 <span>Admin</span></div>
            </div>
        </div>
    );

    return (
        <>
            <style>{CSS}</style>
            {isMobile ? (
                <>
                    <button className="as-burger" onClick={() => setDrawer(true)}>☰ メニュー</button>
                    {drawer && (
                        <div className="as-overlay" onClick={() => setDrawer(false)}>
                            <div className="as-drawer" onClick={(e) => e.stopPropagation()}>
                                <button className="as-close" onClick={() => setDrawer(false)}>×</button>
                                {body}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <aside className="as-side">{body}</aside>
            )}
        </>
    );
}

const CSS = `
.as-side{position:fixed;left:0;top:0;bottom:0;width:240px;z-index:50;background:linear-gradient(180deg,#1a51b0 0%,#123c8c 45%,#102F70 100%);border-right:3px solid #D9A441;box-shadow:4px 0 24px rgba(16,47,112,.35);overflow-y:auto}
.as-side::-webkit-scrollbar{width:6px}
.as-side::-webkit-scrollbar-thumb{background:rgba(245,215,126,.4);border-radius:999px}
.as-body{display:flex;flex-direction:column;min-height:100%;padding:14px 12px 16px}
.as-logo{text-align:center;background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.04));border:2px solid #F5D77E;border-radius:16px;padding:12px 8px 10px;margin-bottom:12px;box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.as-logo-crown{font-size:30px;line-height:1}
.as-logo-main{font-size:15px;font-weight:900;color:#fff;letter-spacing:1px;margin-top:4px;text-shadow:0 1px 3px rgba(0,0,0,.35)}
.as-logo-admin{display:inline-block;margin-top:3px;font-size:10px;font-weight:900;letter-spacing:3px;color:#102F70;background:linear-gradient(180deg,#F5D77E,#D9A441);border-radius:999px;padding:2px 12px}
.as-logo-sub{margin-top:6px;font-size:12px;font-weight:900;color:#F5D77E}
.as-logo-sub span{display:block;font-size:8px;font-weight:700;letter-spacing:1px;color:#9db8e8}
.as-home{display:block;width:100%;text-align:left;padding:11px 14px;border-radius:12px;border:2px solid transparent;background:rgba(255,255,255,.08);color:#dbe7ff;font-size:13.5px;font-weight:900;cursor:pointer;margin-bottom:10px}
.as-home-on{background:linear-gradient(180deg,#2f6ad1,#1454B8);border-color:#F5D77E;color:#fff;box-shadow:0 3px 10px rgba(16,47,112,.5)}
.as-groups{display:flex;flex-direction:column;gap:5px}
.as-ghead{display:flex;align-items:center;gap:8px;width:100%;padding:10px 11px;border-radius:11px;border:2px solid transparent;background:rgba(255,255,255,.06);color:#dbe7ff;font-size:12.5px;font-weight:900;cursor:pointer}
.as-ghead:hover{background:rgba(255,255,255,.12)}
.as-ghead-active{border-color:rgba(245,215,126,.7);background:rgba(245,215,126,.12);color:#fff}
.as-glabel{flex:1;text-align:left}
.as-arrow{font-size:11px;color:#9db8e8;transition:transform .15s}
.as-arrow-open{transform:rotate(90deg)}
.as-items{display:flex;flex-direction:column;gap:2px;padding:4px 2px 6px 10px}
.as-item{display:flex;align-items:center;gap:6px;width:100%;padding:7px 10px;border-radius:9px;border:1.5px solid transparent;background:none;color:#c3d4f5;font-size:12px;font-weight:700;cursor:pointer;text-align:left}
.as-item:hover{background:rgba(255,255,255,.1);color:#fff}
.as-item-on{background:linear-gradient(180deg,#2f6ad1,#1454B8);border-color:#F5D77E;color:#fff;font-weight:900}
.as-item-label{flex:1}
.as-badge{min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#ef4444;color:#fff;font-size:10px;font-weight:900;display:inline-flex;align-items:center;justify-content:center}
.as-foot{margin-top:auto;padding-top:14px;text-align:center}
.as-foot-castle{width:82%;opacity:.9;filter:drop-shadow(0 6px 10px rgba(0,0,30,.4))}
.as-exit{display:block;width:100%;margin-top:8px;padding:10px;border-radius:999px;border:2px solid #F5D77E;background:rgba(255,255,255,.95);color:#102F70;font-size:12.5px;font-weight:900;cursor:pointer}
.as-me{margin-top:8px;padding:8px;border-radius:12px;background:linear-gradient(180deg,#0e2a60,#0a1f4a);border:1.5px solid rgba(245,215,126,.5);color:#F5D77E;font-size:12px;font-weight:900}
.as-me span{color:#9db8e8;font-size:9px;letter-spacing:2px;margin-left:4px}
.as-burger{position:fixed;left:12px;bottom:14px;z-index:60;padding:12px 18px;border-radius:999px;border:2px solid #F5D77E;background:linear-gradient(180deg,#2f6ad1,#1454B8);color:#fff;font-size:13.5px;font-weight:900;cursor:pointer;box-shadow:0 6px 18px rgba(16,47,112,.5)}
.as-overlay{position:fixed;inset:0;z-index:70;background:rgba(10,20,50,.55);backdrop-filter:blur(2px)}
.as-drawer{position:absolute;left:0;top:0;bottom:0;width:min(290px,86vw);background:linear-gradient(180deg,#1a51b0,#102F70);border-right:3px solid #D9A441;overflow-y:auto}
.as-close{position:absolute;right:10px;top:10px;z-index:2;width:32px;height:32px;border-radius:999px;border:none;background:rgba(255,255,255,.15);color:#fff;font-size:18px;cursor:pointer}
`;
