"use client";
// Intern Quest 2.0｜天空の栄光闘技場（ランキング）
// HOME と同じ世界観（青空・白大理石・ロイヤルブルー×金・羊皮紙）。
// ★集計ロジックは旧ページから一切変更していない（順位・ポイント・種別は従来どおり）。
// ★順位変動（▲▼）は ranking_snapshots テーブル（追加型・ranking_snapshots.sql）があれば翌日から表示。
//   テーブル未作成・履歴なしの間は偽装せず「—（未計測）」を表示する。
// ★表彰台・王冠・月桂樹・自分の順位パネルは ChatGPT 素材が届くまで CSS 仮組み。
//   素材到着後は public/ranking/ に置いて該当クラスの背景を差し替えるだけで完成する。

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type RankingUser = {
    id: string;
    name: string;
    points: number;
    avatar_url?: string | null;
    color?: string | null;
    subLabel?: string;
    isTeam?: boolean;
};

function getOneWeekAgoISO(): string {
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);
    return oneWeekAgo.toISOString();
}

function getYmdJST(iso: string): string {
    const d = new Date(iso);
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const day = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// 1,000行上限を超えて全件取得する
async function fetchAllUserIds(table: string, filters: [string, string | boolean][] = []): Promise<{ user_id: string }[]> {
    const rows: { user_id: string }[] = [];
    for (let from = 0; ; from += 1000) {
        let q = supabase.from(table).select("user_id").range(from, from + 999);
        for (const [col, val] of filters) q = q.eq(col, val);
        const { data: chunk } = await q;
        if (!chunk || chunk.length === 0) break;
        rows.push(...(chunk as { user_id: string }[]));
        if (chunk.length < 1000) break;
    }
    return rows;
}

type TabKey = "total" | "weekly" | "teams" | "streak" | "sankyu" | "sankyu_sent" | "challenge" | "test" | "advice" | "learn" | "work" | "kpi" | "sales_month" | "sales_total" | "maru_total" | "job_rank" | "pay_forward" | "thinking" | "question" | "ippon" | "battle_count" | "battle_wins" | "battle_damage";

// タブ（旧ページの種別・ラベルをそのまま維持）
const TABS: { key: TabKey; em: string; label: string }[] = [
    { key: "total", em: "🏆", label: "総合" },
    { key: "weekly", em: "⚡", label: "今週" },
    { key: "teams", em: "👥", label: "チーム" },
    { key: "streak", em: "🔥", label: "連続" },
    { key: "sankyu", em: "💌", label: "サンキュー受信" },
    { key: "sankyu_sent", em: "🎉", label: "サンキュー送信" },
    { key: "challenge", em: "🎯", label: "チャレンジ" },
    { key: "test", em: "📚", label: "テスト" },
    { key: "advice", em: "💡", label: "アドバイス送信" },
    { key: "learn", em: "📚", label: "学習" },
    { key: "work", em: "💼", label: "仕事完遂" },
    { key: "kpi", em: "📊", label: "KPI" },
    { key: "sales_month", em: "💰", label: "販売(今月)" },
    { key: "sales_total", em: "💰", label: "販売(累計)" },
    { key: "maru_total", em: "☀️", label: "スケジュール" },
    { key: "job_rank", em: "🎓", label: "就活ランク" },
    { key: "pay_forward", em: "🤝", label: "ペイフォワード" },
    { key: "thinking", em: "🧠", label: "思考クエスト" },
    { key: "ippon", em: "🎤", label: "IPPON" },
    { key: "battle_count", em: "⚔️", label: "バトル回数" },
    { key: "battle_wins", em: "🏰", label: "落城数" },
    { key: "battle_damage", em: "💥", label: "与ダメージ" },
];

const CSS = `
.rk-page{min-height:100vh;overflow-x:clip;background:url(/home/bg_mobile.webp) center top / cover no-repeat fixed, #bfe3f5;display:flex;flex-direction:column;align-items:center;padding:14px 14px 130px;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#1f2a44}
.rk-col{width:100%;max-width:480px;display:flex;flex-direction:column}
@media (min-width:700px){ .rk-page{background-image:url(/home/bg_pc.webp)} }
@media (min-width:1024px){ .rk-col{max-width:1020px} }

/* タイトル（HOMEのプレート素材を再利用。エンブレム素材到着後は左に emblem_trophy.webp を追加） */
.rk-title{position:relative;width:min(88%,460px);margin:0 auto;container-type:inline-size;z-index:2}
.rk-title img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 14px rgba(20,40,90,.3))}
.rk-title>div{position:absolute;inset:25.9% 10% 11.8%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;pointer-events:none}
.rk-title .t1{font-size:clamp(16px,6.2cqw,26px);font-weight:900;letter-spacing:.14em;text-shadow:0 2px 4px rgba(10,25,70,.55)}
.rk-title .t2{font-size:clamp(8px,2.4cqw,11px);font-weight:800;letter-spacing:.18em;color:#cfe0ff;margin-top:1%}

/* タブ（選択中のみ青紫の発光） */
.rk-tabs{display:flex;gap:6px;margin:14px 0 4px;padding:6px;background:rgba(255,253,245,.85);border:2px solid #e2bf63;border-radius:999px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;box-shadow:0 4px 10px rgba(40,60,120,.14)}
.rk-tabs::-webkit-scrollbar{display:none}
.rk-tab{flex:none;padding:8px 14px;border-radius:999px;border:1.5px solid transparent;background:transparent;color:#6a7690;font-weight:900;font-size:12.5px;white-space:nowrap;cursor:pointer;font-family:inherit;transition:background .15s,color .15s}
.rk-tab.on{background:linear-gradient(180deg,#4b7ae0,#1d3f96);color:#fff;border-color:#e2bf63;box-shadow:0 0 10px rgba(99,102,241,.55),0 0 20px rgba(99,102,241,.3),inset 0 2px 0 rgba(255,255,255,.25)}

/* タブ切替フェード */
.rk-fade{animation:rkfade .18s ease-out}
@keyframes rkfade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){ .rk-fade{animation:none} .rk-crown{animation:none} }

/* PC: 左=表彰台+自分の順位 / 右=一覧 */
.rk-main{display:flex;flex-direction:column;gap:14px;margin-top:10px}
@media (min-width:1024px){ .rk-main{display:grid;grid-template-columns:10fr 11fr;gap:18px;align-items:start} }

/* 説明パネル（チームタブなど） */
.rk-note{background:linear-gradient(180deg,#fffdf4,#f8efdb);border:2px solid #d8b55e;border-radius:14px;padding:10px 14px;box-shadow:0 4px 10px rgba(40,60,120,.12)}
.rk-note .a{font-size:13px;font-weight:900;color:#17397d}
.rk-note .b{font-size:11px;font-weight:700;color:#8a6a3a;margin-top:2px}

/* ===== 表彰台（素材到着後: .rk-pblock の背景を podium_gold/silver/bronze.webp に差し替え） ===== */
.rk-podium{display:flex;align-items:flex-end;justify-content:center;gap:2%;padding:8px 2px 0;container-type:inline-size}
.rk-pcol{flex:1;max-width:32%;min-width:0;display:flex;flex-direction:column;align-items:center;cursor:pointer;-webkit-tap-highlight-color:transparent}
.rk-pcol.noclick{cursor:default}
.rk-crown{font-size:clamp(20px,7cqw,30px);line-height:1;margin-bottom:-2px;filter:drop-shadow(0 0 6px rgba(255,210,80,.9));animation:rkglow 2.4s ease-in-out infinite}
@keyframes rkglow{0%,100%{filter:drop-shadow(0 0 4px rgba(255,210,80,.7))}50%{filter:drop-shadow(0 0 10px rgba(255,220,100,1))}}
.rk-pav{position:relative;border-radius:50%;padding:3px;background:linear-gradient(145deg,var(--mc1),var(--mc2));box-shadow:0 0 14px var(--mg),0 3px 6px rgba(30,40,90,.3)}
.rk-pav>.av{border-radius:50%;overflow:hidden;display:block;background:#fff}
.rk-medal{position:absolute;bottom:-6px;right:-6px;font-size:clamp(15px,5.5cqw,22px);filter:drop-shadow(0 1px 2px rgba(30,40,90,.4))}
.rk-pnwrap{margin-top:7px;max-width:100%;display:flex;align-items:center;justify-content:center;gap:3px}
.rk-pname{min-width:0;font-size:clamp(10.5px,3.4cqw,13.5px);font-weight:900;color:#1f2a44;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 1px 0 rgba(255,255,255,.7)}
.rk-pnwrap .you{flex:none;font-size:clamp(7.5px,2.4cqw,9.5px);color:#1d3f96;background:rgba(255,255,255,.85);border:1px solid #e2bf63;border-radius:6px;padding:0 4px;font-weight:900}
.rk-ppts{font-size:clamp(11px,3.8cqw,15px);font-weight:900;margin-top:1px;text-shadow:0 1px 0 rgba(255,255,255,.7)}
.rk-psub{font-size:clamp(8.5px,2.6cqw,10px);font-weight:700;color:#6a7690;margin-top:1px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rk-pblock{width:100%;margin-top:7px;border-radius:10px 10px 0 0;display:flex;align-items:center;justify-content:center;border:2px solid var(--bb);border-bottom:none;background:linear-gradient(180deg,var(--b1) 0%,var(--b2) 22%,var(--b3) 100%);box-shadow:inset 0 3px 0 rgba(255,255,255,.55),inset 0 -8px 14px rgba(0,0,0,.08)}
.rk-pblock span{font-size:clamp(20px,8cqw,34px);font-weight:900;color:#fff;text-shadow:0 2px 3px rgba(60,40,0,.35)}
.rk-pbase{height:10px;background:linear-gradient(180deg,#fdfbf2,#dcd4bd);border:2px solid #c9b98a;border-radius:4px;margin-top:-2px;box-shadow:0 5px 10px rgba(40,60,120,.2)}

/* ===== 自分の順位カード（素材到着後: 背景を myrank_panel.webp に差し替え） ===== */
.rk-me{position:relative;background:linear-gradient(180deg,#3b70d4,#1d3f96);border:2.5px solid #e2bf63;border-radius:18px;padding:12px 14px;box-shadow:0 0 0 3px rgba(255,255,255,.35),0 8px 18px rgba(20,40,100,.3),inset 0 2px 0 rgba(255,255,255,.25);color:#fff}
.rk-me .hd{font-size:10.5px;font-weight:900;letter-spacing:.22em;color:#ffe9a8;margin-bottom:7px}
.rk-me .row{display:flex;align-items:center;gap:11px;min-width:0}
.rk-me .avw{flex:none;border-radius:50%;padding:2.5px;background:linear-gradient(145deg,#ffe9a8,#d8a93a)}
.rk-me .avw>.av{border-radius:50%;overflow:hidden;display:block;background:#fff}
.rk-me .rank{flex:none;font-size:24px;font-weight:900;color:#ffe9a8;text-shadow:0 2px 3px rgba(10,25,70,.5);line-height:1}
.rk-me .rank small{font-size:12px}
.rk-me .nm{min-width:0;flex:1}
.rk-me .nm .n1{font-size:14.5px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rk-me .nm .n2{font-size:11px;font-weight:800;color:#cfe0ff;margin-top:1px}
.rk-me .msg{margin-top:9px;font-size:13px;font-weight:900;color:#fff;text-shadow:0 1px 2px rgba(10,25,70,.4)}
.rk-me .msg b{color:#ffe9a8;font-size:1.12em}
.rk-me .barw{margin-top:7px;height:12px;border-radius:999px;background:rgba(10,25,70,.45);border:1.5px solid rgba(255,233,168,.6);overflow:hidden}
.rk-me .bar{height:100%;border-radius:999px;background:linear-gradient(90deg,#ffd76e,#f0b429);box-shadow:0 0 8px rgba(255,210,80,.7);transition:width .4s ease}

/* ===== 4位以下の羊皮紙リスト ===== */
.rk-list{background:linear-gradient(180deg,#fffdf4,#f8efdb);border:3px solid #d8b55e;border-radius:18px;padding:12px 10px 10px;box-shadow:0 0 0 3px rgba(255,255,255,.4),0 8px 20px rgba(40,60,120,.15),inset 0 2px 0 rgba(255,255,255,.8)}
.rk-list .hd{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:900;color:#8a6a3a;letter-spacing:.14em;padding:0 6px 8px;border-bottom:2px solid rgba(190,160,110,.35)}
.rk-row{display:flex;align-items:center;gap:9px;width:100%;padding:9px 7px;border:none;border-bottom:1px solid rgba(190,160,110,.25);background:transparent;cursor:pointer;font-family:inherit;text-align:left;border-radius:10px;-webkit-tap-highlight-color:transparent}
.rk-row:last-of-type{border-bottom:none}
.rk-row.me{background:linear-gradient(180deg,#eaf1ff,#d9e6ff);box-shadow:inset 0 0 0 2px #e2bf63}
.rk-row.noclick{cursor:default}
.rk-row .no{flex:none;width:30px;height:30px;border-radius:50%;background:linear-gradient(180deg,#fdf6e3,#eaddbb);border:1.5px solid #cdb87e;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:900;color:#8a6a3a}
.rk-row .avw{flex:none;width:36px;height:36px;border-radius:50%;overflow:hidden;border:1.5px solid rgba(190,160,110,.5);background:#fff}
.rk-row .mid{flex:1;min-width:0}
.rk-row .nm{font-size:13.5px;font-weight:800;color:#3a4256;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rk-row .nm .you{margin-left:5px;font-size:9.5px;color:#fff;background:linear-gradient(180deg,#4b7ae0,#1d3f96);border-radius:6px;padding:1px 5px;font-weight:900;vertical-align:1px}
.rk-row .sub{font-size:10px;font-weight:700;color:#9a8a68;margin-top:1px}
.rk-row .dl{flex:none;width:44px;text-align:center;font-size:11px;font-weight:900}
.rk-row .dl .up{color:#1e9e55}.rk-row .dl .dn{color:#d2483e}.rk-row .dl .fl{color:#9aa3b5}.rk-row .dl .na{color:#b9ad8e;font-weight:800}
.rk-row .pt{flex:none;font-size:13.5px;font-weight:900;color:#17397d;max-width:34%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rk-more{display:block;margin:10px auto 2px;padding:9px 30px;border-radius:999px;border:2px solid #e2bf63;background:linear-gradient(180deg,#fffdf4,#f6e7c8);color:#8a6a3a;font-size:12.5px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 3px 8px rgba(140,100,30,.18)}
.rk-legend{font-size:9.5px;font-weight:700;color:#a08356;text-align:center;margin-top:8px}
.rk-empty{text-align:center;font-size:13px;font-weight:800;color:#8a6a3a;padding:26px 10px}

/* 下部ナビ（HOME/メニューと共通） */
.rk-nav{position:fixed;left:0;bottom:0;width:100%;max-width:100vw;box-sizing:border-box;z-index:50;display:flex;height:calc(86px + env(safe-area-inset-bottom));padding:0 10px calc(10px + env(safe-area-inset-bottom));overflow:hidden}
.rk-nav .band{position:absolute;inset:6px 8px calc(8px + env(safe-area-inset-bottom));background:url(/home/nav_bar.webp);background-size:100% 100%;pointer-events:none}
.rk-nav button{position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;padding-bottom:calc(17px + env(safe-area-inset-bottom));background:transparent;border:none;cursor:pointer;color:#fff;text-shadow:0 1px 2px rgba(70,40,10,.7);-webkit-tap-highlight-color:transparent}
.rk-nav .lbl{font-size:10.5px;font-weight:800}
`;

export default function RankingPage() {
    const router = useRouter();
    const [users, setUsers] = useState<RankingUser[]>([]);
    const [weeklyUsers, setWeeklyUsers] = useState<RankingUser[]>([]);
    const [teamRanking, setTeamRanking] = useState<RankingUser[]>([]);
    const [streakUsers, setStreakUsers] = useState<RankingUser[]>([]);
    const [sankyuUsers, setSankyuUsers] = useState<RankingUser[]>([]);
    const [sankyuSentUsers, setSankyuSentUsers] = useState<RankingUser[]>([]);
    const [challengeUsers, setChallengeUsers] = useState<RankingUser[]>([]);
    const [testUsers, setTestUsers] = useState<RankingUser[]>([]);
    const [adviceUsers, setAdviceUsers] = useState<RankingUser[]>([]);
    const [learnUsers, setLearnUsers] = useState<RankingUser[]>([]);
    const [workUsers, setWorkUsers] = useState<RankingUser[]>([]);
    const [thinkingUsers, setThinkingUsers] = useState<RankingUser[]>([]);
    const [questionUsers, setQuestionUsers] = useState<RankingUser[]>([]);
    const [ipponUsers, setIpponUsers] = useState<RankingUser[]>([]);
    const [battleCountUsers, setBattleCountUsers] = useState<RankingUser[]>([]);
    const [battleWinUsers, setBattleWinUsers] = useState<RankingUser[]>([]);
    const [battleDamageUsers, setBattleDamageUsers] = useState<RankingUser[]>([]);
    const [kpiUsers, setKpiUsers] = useState<RankingUser[]>([]);
    const [salesMonthUsers, setSalesMonthUsers] = useState<RankingUser[]>([]);
    const [salesTotalUsers, setSalesTotalUsers] = useState<RankingUser[]>([]);
    const [maruTotalUsers, setMaruTotalUsers] = useState<RankingUser[]>([]);
    const [jobRankUsers, setJobRankUsers] = useState<RankingUser[]>([]);
    const [payForwardUsers, setPayForwardUsers] = useState<RankingUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [myTeamId, setMyTeamId] = useState<string | null>(null);
    const [myId, setMyId] = useState("");
    const [myName, setMyName] = useState("");
    const [myAvatar, setMyAvatar] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabKey>("total");
    const [visibleCount, setVisibleCount] = useState(10);
    // 前回スナップショット: tabKey → (id→前回順位)。null=履歴なし（未計測）、未定義=未取得
    const [prevRanks, setPrevRanks] = useState<Record<string, Record<string, number> | null>>({});
    const snapMissing = useRef(false);      // ranking_snapshots 未作成（SQL未実行）
    const snapSaved = useRef<Set<string>>(new Set()); // このセッションで保存済みのタブ

    useEffect(() => {
        const loadRanking = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setMyId(user.id);

            // 自分のteam_id取得（＋圏外カード表示用に名前・アバターも取得）
            const { data: myProfile } = await supabase.from("profiles").select("team_id, name, avatar_url").eq("id", user.id).single();
            setMyTeamId((myProfile as any)?.team_id || null);
            setMyName((myProfile as any)?.name || "あなた");
            setMyAvatar((myProfile as any)?.avatar_url || null);

            // ===== 総合ランキング =====
            const { data: pointRows } = await supabase.from("user_points").select("id, total_earned").order("total_earned", { ascending: false });
            const totalRows = pointRows || [];
            const { data: profileRows } = await supabase.from("profiles").select("id, name, avatar_url, is_active").in("id", totalRows.map((r) => r.id));
            const activeIds = new Set((profileRows || []).filter((p: any) => p.is_active).map((p: any) => p.id));
            setUsers(totalRows.filter((row) => activeIds.has(row.id)).map((row) => ({
                id: row.id,
                name: profileRows?.find((p) => p.id === row.id)?.name || "名前未設定",
                points: (row as any).total_earned || 0,
                avatar_url: profileRows?.find((p) => p.id === row.id)?.avatar_url || null,
            })));

            // ===== 週間ランキング =====
            const { data: weeklyData } = await supabase.from("points_history").select("user_id, change, created_at").gte("created_at", getOneWeekAgoISO());
            const weeklyTotals: Record<string, number> = {};
            (weeklyData || []).forEach((item) => { weeklyTotals[item.user_id] = (weeklyTotals[item.user_id] || 0) + item.change; });
            const weeklyIds = Object.keys(weeklyTotals);
            if (weeklyIds.length > 0) {
                const { data: weeklyProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").in("id", weeklyIds);
                const weeklyActiveIds = new Set((weeklyProfiles || []).filter((p: any) => p.is_active).map((p: any) => p.id));
                setWeeklyUsers(weeklyIds.filter((id) => weeklyActiveIds.has(id)).map((id) => ({
                    id,
                    name: weeklyProfiles?.find((p) => p.id === id)?.name || "名前未設定",
                    points: weeklyTotals[id] || 0,
                    avatar_url: weeklyProfiles?.find((p) => p.id === id)?.avatar_url || null,
                })).sort((a, b) => b.points - a.points));
            }

            // ===== 連続提出日数ランキング =====
            const { data: streakProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active, streak").eq("is_active", true);
            setStreakUsers((streakProfiles || [])
                .map((row: any) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: row.streak || 0,
                }))
                .filter((u) => u.points > 0)
                .sort((a, b) => b.points - a.points));
            // ===== サンキュー受信数ランキング =====
            const { data: thanksAllRows } = await supabase.from("thanks").select("to_user_id");
            const thanksCounts: { [id: string]: number } = {};
            (thanksAllRows || []).forEach((row: any) => { if (row.to_user_id) thanksCounts[row.to_user_id] = (thanksCounts[row.to_user_id] || 0) + 1; });
            const sankyuIds = Object.keys(thanksCounts);
            if (sankyuIds.length > 0) {
                const { data: sankyuProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", sankyuIds);
                setSankyuUsers((sankyuProfiles || []).map((row: any) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: thanksCounts[row.id] || 0,
                })).sort((a, b) => b.points - a.points));
            }
            // ===== ペイフォワードランキング（承認済み報告数） =====
            const pfRows = await fetchAllUserIds("mentor_reports", [["status", "approved"]]);
            const pfCounts: { [id: string]: number } = {};
            (pfRows || []).forEach((row: any) => { if (row.user_id) pfCounts[row.user_id] = (pfCounts[row.user_id] || 0) + 1; });
            const pfIds = Object.keys(pfCounts);
            if (pfIds.length > 0) {
                const { data: pfProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", pfIds);
                setPayForwardUsers((pfProfiles || []).map((row: any) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: pfCounts[row.id] || 0,
                })).sort((a, b) => b.points - a.points));
            }
            // ===== サンキュー送信数ランキング =====
            const { data: thanksSentRows } = await supabase.from("thanks").select("from_user_id");
            const thanksSentCounts: { [id: string]: number } = {};
            (thanksSentRows || []).forEach((row: any) => { if (row.from_user_id) thanksSentCounts[row.from_user_id] = (thanksSentCounts[row.from_user_id] || 0) + 1; });
            const sankyuSentIds = Object.keys(thanksSentCounts);
            if (sankyuSentIds.length > 0) {
                const { data: sankyuSentProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", sankyuSentIds);
                setSankyuSentUsers((sankyuSentProfiles || []).map((row: any) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: thanksSentCounts[row.id] || 0,
                })).sort((a, b) => b.points - a.points));
            }
            // ===== ライフチャレンジ数ランキング =====
            const challengeAllRows = await fetchAllUserIds("challenge_submissions", [["status", "approved"]]);
            const challengeCounts: { [id: string]: number } = {};
            (challengeAllRows || []).forEach((row: any) => { if (row.user_id) challengeCounts[row.user_id] = (challengeCounts[row.user_id] || 0) + 1; });
            const challengeIds = Object.keys(challengeCounts);
            if (challengeIds.length > 0) {
                const { data: challengeProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", challengeIds);
                setChallengeUsers((challengeProfiles || []).map((row: any) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: challengeCounts[row.id] || 0,
                })).sort((a, b) => b.points - a.points));
            }
            // ===== 思考クエスト回答数ランキング =====
            const thinkingAllRows = await fetchAllUserIds("thinking_answers", []);
            const thinkingCounts: { [id: string]: number } = {};
            (thinkingAllRows || []).forEach((row: any) => { if (row.user_id) thinkingCounts[row.user_id] = (thinkingCounts[row.user_id] || 0) + 1; });
            const thinkingIds = Object.keys(thinkingCounts);
            if (thinkingIds.length > 0) {
                const { data: tProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", thinkingIds);
                setThinkingUsers((tProfiles || []).map((row: any) => ({
                    id: row.id, name: row.name, avatar_url: row.avatar_url, is_active: row.is_active,
                    points: thinkingCounts[row.id] || 0,
                })).sort((a, b) => b.points - a.points));
            }
            // ===== 質問クエスト投稿数ランキング =====
            const questionAllRows = await fetchAllUserIds("questions_box", []);
            const questionCounts: { [id: string]: number } = {};
            (questionAllRows || []).forEach((row: any) => { if (row.user_id) questionCounts[row.user_id] = (questionCounts[row.user_id] || 0) + 1; });
            const questionIds = Object.keys(questionCounts);
            if (questionIds.length > 0) {
                const { data: qProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", questionIds);
                setQuestionUsers((qProfiles || []).map((row: any) => ({
                    id: row.id, name: row.name, avatar_url: row.avatar_url, is_active: row.is_active,
                    points: questionCounts[row.id] || 0,
                })).sort((a, b) => b.points - a.points));
            }
            // ===== もらったIPPON数ランキング =====
            const { data: ipponRows } = await supabase.from("thinking_ippon").select("answer_id");
            const ipponAnswerIds = Array.from(new Set((ipponRows || []).map((r: any) => r.answer_id).filter(Boolean)));
            if (ipponAnswerIds.length > 0) {
                const { data: ansOwners } = await supabase.from("thinking_answers").select("id, user_id").in("id", ipponAnswerIds);
                const ownerMap: { [aid: string]: string } = {};
                (ansOwners || []).forEach((a: any) => { ownerMap[a.id] = a.user_id; });
                const ipponCounts: { [uid: string]: number } = {};
                (ipponRows || []).forEach((r: any) => {
                    const owner = ownerMap[r.answer_id];
                    if (owner) ipponCounts[owner] = (ipponCounts[owner] || 0) + 1;
                });
                const ipponIds = Object.keys(ipponCounts);
                if (ipponIds.length > 0) {
                    const { data: ipProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", ipponIds);
                    setIpponUsers((ipProfiles || []).map((row: any) => ({
                        id: row.id, name: row.name, avatar_url: row.avatar_url, is_active: row.is_active,
                        points: ipponCounts[row.id] || 0,
                    })).sort((a, b) => b.points - a.points));
                }
            }
            // ===== 島バトル（回数・落城数・与ダメージ）=====
            // 集計は battle_ranking()（battle_server.sql）で行う。未適用の環境では空のまま（エラーにしない）
            try {
                const { data: bRows, error: bErr } = await supabase.rpc("battle_ranking");
                if (!bErr && bRows && (bRows as any[]).length > 0) {
                    const rows = bRows as any[];
                    const { data: bProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", rows.map((r) => r.user_id));
                    const pm: Record<string, any> = {}; (bProfiles || []).forEach((r: any) => { pm[r.id] = r; });
                    const mk = (field: string) => rows.filter((r) => pm[r.user_id] && Number(r[field]) > 0).map((r) => ({
                        id: r.user_id, name: pm[r.user_id].name, avatar_url: pm[r.user_id].avatar_url, is_active: true, points: Number(r[field]),
                    })).sort((a, b) => b.points - a.points);
                    setBattleCountUsers(mk("attacks")); setBattleWinUsers(mk("wins")); setBattleDamageUsers(mk("damage"));
                }
            } catch { /* バトル未導入 */ }
            // ===== テスト合格数ランキング =====
            const { data: testProfileRows } = await supabase.from("profiles").select("*").eq("is_active", true);
            setTestUsers((testProfileRows || []).map((row: any) => {
                let passedCount = 0;
                Object.keys(row).forEach((key) => { if (key.endsWith("_passed") && row[key] === true) passedCount++; });
                return {
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: passedCount,
                };
            }).filter((u) => u.points > 0).sort((a, b) => b.points - a.points));
            // ===== アドバイス送信数ランキング（承認済みのみ） =====
            const { data: adviceAllRows } = await supabase.from("advice_logs").select("sender_id").eq("status", "approved");
            const adviceCounts: { [id: string]: number } = {};
            (adviceAllRows || []).forEach((row: { sender_id: string }) => { if (row.sender_id) adviceCounts[row.sender_id] = (adviceCounts[row.sender_id] || 0) + 1; });
            const adviceIds = Object.keys(adviceCounts);
            if (adviceIds.length > 0) {
                const { data: adviceProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", adviceIds);
                setAdviceUsers((adviceProfiles || []).map((row: { id: string; name: string; avatar_url: string; is_active: boolean }) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: adviceCounts[row.id] || 0,
                })).sort((a, b) => b.points - a.points));
            }
            // ===== 学習コンテンツ完了数ランキング（承認済みのみ） =====
            const learnAllRows = await fetchAllUserIds("content_completions", [["status", "approved"]]);
            const learnCounts: { [id: string]: number } = {};
            (learnAllRows || []).forEach((row: { user_id: string }) => { if (row.user_id) learnCounts[row.user_id] = (learnCounts[row.user_id] || 0) + 1; });
            const learnIds = Object.keys(learnCounts);
            if (learnIds.length > 0) {
                const { data: learnProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", learnIds);
                setLearnUsers((learnProfiles || []).map((row: { id: string; name: string; avatar_url: string; is_active: boolean }) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: learnCounts[row.id] || 0,
                })).sort((a, b) => b.points - a.points));
            }
            // ===== 仕事完遂量ランキング（KKC + MTG + タスク + ルーティン連続） =====
            const workCounts: { [id: string]: number } = {};
            const kkcRows = await fetchAllUserIds("problem_solutions", [["status", "approved"]]);
            (kkcRows || []).forEach((row: { user_id: string }) => { if (row.user_id) workCounts[row.user_id] = (workCounts[row.user_id] || 0) + 1; });
            const mtgRows = await fetchAllUserIds("mtg_reports", [["status", "approved"]]);
            (mtgRows || []).forEach((row: { user_id: string }) => { if (row.user_id) workCounts[row.user_id] = (workCounts[row.user_id] || 0) + 1; });
            const personalTaskRows = await fetchAllUserIds("personal_tasks", [["is_done", true]]);
            (personalTaskRows || []).forEach((row: { user_id: string }) => { if (row.user_id) workCounts[row.user_id] = (workCounts[row.user_id] || 0) + 1; });
            const taskReportRows = await fetchAllUserIds("task_reports", [["status", "approved"]]);
            (taskReportRows || []).forEach((row: { user_id: string }) => { if (row.user_id) workCounts[row.user_id] = (workCounts[row.user_id] || 0) + 1; });
            const allRoutineChecksCount = await fetchAllUserIds("routine_checks", []);
            (allRoutineChecksCount || []).forEach((row: { user_id: string }) => {
                if (row.user_id) workCounts[row.user_id] = (workCounts[row.user_id] || 0) + 1;
            });
            const workIds = Object.keys(workCounts);
            if (workIds.length > 0) {
                const { data: workProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", workIds);
                setWorkUsers((workProfiles || []).map((row: { id: string; name: string; avatar_url: string; is_active: boolean }) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: workCounts[row.id] || 0,
                })).sort((a, b) => b.points - a.points));
            }
            // ===== KPI達成率ランキング（今月、自分の部署のメインKPI） =====
            const now = new Date();
            const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            const { data: allProfilesKpi } = await supabase.from("profiles").select("id, name, avatar_url, is_active, department_id").eq("is_active", true);
            const { data: kpiThisMonth } = await supabase.from("monthly_kpi").select("user_id, department_id, target, result").eq("year_month", thisMonth);
            const kpiByUser: { [uid: string]: number } = {};
            (allProfilesKpi || []).forEach((p: { id: string; department_id: string | null }) => {
                if (!p.department_id) { kpiByUser[p.id] = 0; return; }
                const myKpi = (kpiThisMonth || []).find((k: { user_id: string; department_id: string; target: number; result: number }) => k.user_id === p.id && k.department_id === p.department_id);
                if (!myKpi || !myKpi.target || myKpi.target <= 0) { kpiByUser[p.id] = 0; return; }
                kpiByUser[p.id] = Math.round((myKpi.result / myKpi.target) * 100);
            });
            setKpiUsers((allProfilesKpi || []).map((row: { id: string; name: string; avatar_url: string; is_active: boolean }) => ({
                id: row.id,
                name: row.name,
                avatar_url: row.avatar_url,
                is_active: row.is_active,
                points: kpiByUser[row.id] || 0,
            })).sort((a, b) => b.points - a.points));
            // ===== 販売額ランキング（今月） =====
            const nowSales = new Date();
            const monthStart = `${nowSales.getFullYear()}-${String(nowSales.getMonth() + 1).padStart(2, "0")}-01`;
            const { data: salesMonthRows } = await supabase.from("sales").select("user_id, amount").gte("sale_date", monthStart);
            const salesMonthByUser: { [uid: string]: number } = {};
            (salesMonthRows || []).forEach((row: { user_id: string; amount: number }) => {
                if (row.user_id) salesMonthByUser[row.user_id] = (salesMonthByUser[row.user_id] || 0) + (row.amount || 0);
            });
            // ===== 販売額ランキング（累計） =====
            const { data: salesTotalRows } = await supabase.from("sales").select("user_id, amount");
            const salesTotalByUser: { [uid: string]: number } = {};
            (salesTotalRows || []).forEach((row: { user_id: string; amount: number }) => {
                if (row.user_id) salesTotalByUser[row.user_id] = (salesTotalByUser[row.user_id] || 0) + (row.amount || 0);
            });
            const salesIds = Array.from(new Set([...Object.keys(salesMonthByUser), ...Object.keys(salesTotalByUser)]));
            if (salesIds.length > 0) {
                const { data: salesProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", salesIds);
                setSalesMonthUsers((salesProfiles || []).map((row: { id: string; name: string; avatar_url: string; is_active: boolean }) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: Math.round((salesMonthByUser[row.id] || 0) / 10000),
                })).filter(u => u.points > 0).sort((a, b) => b.points - a.points));
                setSalesTotalUsers((salesProfiles || []).map((row: { id: string; name: string; avatar_url: string; is_active: boolean }) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: Math.round((salesTotalByUser[row.id] || 0) / 10000),
                })).filter(u => u.points > 0).sort((a, b) => b.points - a.points));
            }
            // ===== 全丸(累計)ランキング =====
            const { data: maruRows } = await supabase
                .from("profiles")
                .select("id, name, avatar_url, is_active, total_maru_days")
                .eq("is_active", true)
                .gt("total_maru_days", 0)
                .order("total_maru_days", { ascending: false });
            setMaruTotalUsers((maruRows || []).map((row: any) => ({
                id: row.id,
                name: row.name,
                avatar_url: row.avatar_url,
                is_active: row.is_active,
                points: row.total_maru_days || 0,
            })));
            // ===== 就活市場ランクランキング =====
            const { data: jobRankRows } = await supabase
                .from("profiles")
                .select("id, name, avatar_url, is_active, rank_score_es, rank_score_personality, rank_score_interview, rank_score_education")
                .eq("is_active", true);
            setJobRankUsers((jobRankRows || []).map((row: any) => {
                const total = (row.rank_score_es || 0) + (row.rank_score_personality || 0) + (row.rank_score_interview || 0) + (row.rank_score_education || 0);
                return {
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: total,
                };
            }).filter(u => u.points > 0).sort((a, b) => b.points - a.points));
            // ===== チーム別 日報提出率ランキング（今週） =====
            const { data: teamsData } = await supabase.from("teams").select("id, name, color");
            const { data: teamMemberProfiles } = await supabase.from("profiles").select("id, team_id").eq("is_active", true).not("team_id", "is", null);
            const { data: subsData } = await supabase.from("submissions").select("user_id, created_at").gte("created_at", getOneWeekAgoISO()).order("created_at", { ascending: false }).limit(100000);

            const teams = teamsData || [];
            const members = teamMemberProfiles || [];
            const subs = subsData || [];

            const teamStats: RankingUser[] = teams.map((team: any) => {
                const teamMemberIds = members.filter((m: any) => m.team_id === team.id).map((m: any) => m.id);
                const memberCount = teamMemberIds.length;
                const expected = memberCount * 7;
                const submittedPairs = new Set<string>();
                subs.forEach((s: any) => {
                    if (teamMemberIds.includes(s.user_id)) {
                        const ymd = getYmdJST(s.created_at);
                        submittedPairs.add(`${s.user_id}_${ymd}`);
                    }
                });
                const actual = submittedPairs.size;
                const rate = expected > 0 ? Math.round((actual / expected) * 100) : 0;
                return {
                    id: team.id,
                    name: team.name,
                    points: rate,
                    avatar_url: null,
                    color: team.color || "#6366f1",
                    subLabel: `${actual}/${expected}日 (${memberCount}名)`,
                    isTeam: true,
                };
            }).sort((a, b) => b.points - a.points);

            setTeamRanking(teamStats);
            setLoading(false);
        };
        loadRanking();
    }, [router]);

    const currentList = activeTab === "battle_count" ? battleCountUsers : activeTab === "battle_wins" ? battleWinUsers : activeTab === "battle_damage" ? battleDamageUsers : activeTab === "total" ? users : activeTab === "weekly" ? weeklyUsers : activeTab === "streak" ? streakUsers : activeTab === "sankyu" ? sankyuUsers : activeTab === "sankyu_sent" ? sankyuSentUsers : activeTab === "challenge" ? challengeUsers : activeTab === "test" ? testUsers : activeTab === "advice" ? adviceUsers : activeTab === "learn" ? learnUsers : activeTab === "work" ? workUsers : activeTab === "kpi" ? kpiUsers : activeTab === "sales_month" ? salesMonthUsers : activeTab === "sales_total" ? salesTotalUsers : activeTab === "maru_total" ? maruTotalUsers : activeTab === "job_rank" ? jobRankUsers : activeTab === "pay_forward" ? payForwardUsers : activeTab === "thinking" ? thinkingUsers : activeTab === "question" ? questionUsers : activeTab === "ippon" ? ipponUsers : teamRanking;

    // ===== 順位変動（前回スナップショット）。テーブル未作成・履歴なしなら「—」のまま =====
    useEffect(() => {
        if (loading || snapMissing.current) return;
        if (prevRanks[activeTab] !== undefined) return;
        const tab = activeTab;
        const list = currentList;
        const run = async () => {
            const today = getYmdJST(new Date().toISOString());
            // 直近の過去スナップ日付を1件取得
            const { data: dateRows, error } = await supabase.from("ranking_snapshots").select("snap_date").eq("tab_key", tab).lt("snap_date", today).order("snap_date", { ascending: false }).limit(1);
            if (error) { snapMissing.current = true; setPrevRanks((p) => ({ ...p, [tab]: null })); return; }
            let map: Record<string, number> | null = null;
            if (dateRows && dateRows.length > 0) {
                const prevDate = (dateRows[0] as any).snap_date;
                const { data: rows } = await supabase.from("ranking_snapshots").select("entry_id, rank").eq("tab_key", tab).eq("snap_date", prevDate);
                if (rows && rows.length > 0) {
                    map = {};
                    rows.forEach((r: any) => { map![r.entry_id] = r.rank; });
                }
            }
            setPrevRanks((p) => ({ ...p, [tab]: map }));
            // 今日分のスナップショットを保存（1日1回・先勝ち。既存行は上書きしない）
            if (!snapSaved.current.has(tab) && list.length > 0) {
                snapSaved.current.add(tab);
                const payload = list.slice(0, 200).map((u, i) => ({ tab_key: tab, entry_id: u.id, rank: i + 1, points: u.points, snap_date: today }));
                await supabase.from("ranking_snapshots").upsert(payload, { onConflict: "tab_key,entry_id,snap_date", ignoreDuplicates: true });
            }
        };
        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, loading]);

    const renderAvatar = (user: RankingUser, size: number) => {
        if (user.isTeam) {
            return (
                <div style={{ width: size, height: size, borderRadius: "50%", background: user.color || "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5, fontWeight: 700, color: "#fff" }}>
                    👥
                </div>
            );
        }
        if (user.avatar_url) {
            return <img src={user.avatar_url} alt={user.name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }} />;
        }
        return (
            <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, color: "#fff" }}>
                {user.name.charAt(0)}
            </div>
        );
    };

    const formatPoints = (user: RankingUser): string => {
        if (user.isTeam) return `${user.points}%`;
        if (activeTab === "streak") return `${user.points}日`;
        if (activeTab === "sankyu") return `${user.points}個`;
        if (activeTab === "sankyu_sent") return `${user.points}個`;
        if (activeTab === "challenge") return `${user.points}個`;
        if (activeTab === "thinking" || activeTab === "battle_count") return `${user.points}回`;
        if (activeTab === "battle_wins") return `${user.points}城`;
        if (activeTab === "battle_damage") return `${user.points.toLocaleString()}ダメージ`;
        if (activeTab === "question") return `${user.points}件`;
        if (activeTab === "ippon") return `${user.points}IPPON`;
        if (activeTab === "test") return `${user.points}個`;
        if (activeTab === "advice") return `${user.points}件`;
        if (activeTab === "learn") return `${user.points}個`;
        if (activeTab === "work") return `${user.points}個`;
        if (activeTab === "kpi") return `${user.points}%`;
        if (activeTab === "sales_month") return `${user.points.toLocaleString()}万円`;
        if (activeTab === "sales_total") return `${user.points.toLocaleString()}万円`;
        if (activeTab === "maru_total") return `${user.points}日`;
        if (activeTab === "pay_forward") return `${user.points}件`;
        if (activeTab === "job_rank") {
            const t = user.points;
            const r = t >= 17 ? "A" : t >= 13 ? "B" : t >= 9 ? "C" : t >= 5 ? "D" : "E";
            return `${t}pt（${r}）`;
        }
        return `${user.points.toLocaleString()}pt`;
    };

    // 「あと◯◯で△位！」の差分表示用（種別ごとの単位）
    const diffFmt = (n: number): string => {
        if (activeTab === "teams" || activeTab === "kpi") return `${n}%`;
        if (activeTab === "streak" || activeTab === "maru_total") return `${n}日`;
        if (["sankyu", "sankyu_sent", "challenge", "test", "learn", "work"].includes(activeTab)) return `${n}個`;
        if (["question", "advice", "pay_forward"].includes(activeTab)) return `${n}件`;
        if (activeTab === "thinking" || activeTab === "battle_count") return `${n}回`;
        if (activeTab === "battle_wins") return `${n}城`;
        if (activeTab === "battle_damage") return `${n.toLocaleString()}ダメージ`;
        if (activeTab === "ippon") return `${n}IPPON`;
        if (activeTab === "sales_month" || activeTab === "sales_total") return `${n.toLocaleString()}万円`;
        return `${n.toLocaleString()}pt`;
    };

    // 順位変動: 数値=変動量, 0=変動なし, null=未計測
    const deltaOf = (userId: string, rank: number): number | null => {
        const map = prevRanks[activeTab];
        if (!map) return null;
        const prev = map[userId];
        if (prev === undefined) return null;
        return prev - rank;
    };

    const renderDelta = (userId: string, rank: number) => {
        const d = deltaOf(userId, rank);
        if (d === null) return <span className="na" title="前回データなし（未計測）">—</span>;
        if (d > 0) return <span className="up">▲{d}</span>;
        if (d < 0) return <span className="dn">▼{Math.abs(d)}</span>;
        return <span className="fl">ー</span>;
    };

    // ===== 表彰台（2位・1位・3位） =====
    const renderPodium = (list: RankingUser[]) => {
        const top3 = list.slice(0, 3);
        const podiumOrder = [1, 0, 2];
        // rank順: [1位, 2位, 3位] の色（金・銀・銅）
        const M = [
            { c1: "#ffe08a", c2: "#d8a93a", glow: "rgba(255,210,80,.65)", b1: "#ffe9b0", b2: "#eec25a", b3: "#c89a2e", bb: "#b8860b", medal: "🥇" },
            { c1: "#f0f2f7", c2: "#aab3c5", glow: "rgba(170,180,200,.6)", b1: "#f5f6fa", b2: "#ccd2de", b3: "#9aa3b5", bb: "#8a93a6", medal: "🥈" },
            { c1: "#f0c9a0", c2: "#b87a40", glow: "rgba(200,140,70,.55)", b1: "#f2d6b4", b2: "#d49c5e", b3: "#ab6f35", bb: "#96602c", medal: "🥉" },
        ];
        const heights = [112, 78, 60]; // 1位・2位・3位の台の高さ
        return (
            <div>
                <div className="rk-podium">
                    {podiumOrder.map((rank) => {
                        const user = top3[rank];
                        if (!user) return <div key={rank} className="rk-pcol noclick" style={{ visibility: "hidden" }} />;
                        const isMe = user.isTeam ? user.id === myTeamId : user.id === myId;
                        const m = M[rank];
                        const avSize = rank === 0 ? 78 : 60;
                        return (
                            <div key={rank} className={`rk-pcol${user.isTeam ? " noclick" : ""}`} onClick={() => { if (!user.isTeam) router.push(`/profile/${user.id}`); }}>
                                {rank === 0 && <div className="rk-crown">👑</div>}
                                <div className="rk-pav" style={{ ["--mc1" as any]: m.c1, ["--mc2" as any]: m.c2, ["--mg" as any]: m.glow }}>
                                    <span className="av">{renderAvatar(user, avSize)}</span>
                                    <span className="rk-medal">{m.medal}</span>
                                </div>
                                <div className="rk-pnwrap"><span className="rk-pname">{user.name}</span>{isMe && <span className="you">{user.isTeam ? "MY TEAM" : "YOU"}</span>}</div>
                                <div className="rk-ppts" style={{ color: rank === 0 ? "#a06a00" : rank === 1 ? "#5a6b85" : "#8a5a2a" }}>{formatPoints(user)}</div>
                                {user.subLabel && <div className="rk-psub">{user.subLabel}</div>}
                                <div className="rk-pblock" style={{ height: heights[rank], ["--b1" as any]: m.b1, ["--b2" as any]: m.b2, ["--b3" as any]: m.b3, ["--bb" as any]: m.bb }}>
                                    <span>{rank + 1}<small style={{ fontSize: ".5em" }}>位</small></span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="rk-pbase" />
            </div>
        );
    };

    // ===== 自分の順位カード =====
    const renderMyCard = (list: RankingUser[]) => {
        const isTeamTab = activeTab === "teams";
        const myKey = isTeamTab ? myTeamId : myId;
        const myIdx = myKey ? list.findIndex((u) => u.id === myKey) : -1;
        const mine = myIdx >= 0 ? list[myIdx] : null;
        const meUser: RankingUser = mine || { id: myId, name: isTeamTab ? "あなたのチーム" : myName, points: 0, avatar_url: myAvatar, isTeam: isTeamTab };

        let msg: ReactNode;
        let pct = 0;
        if (myIdx === 0) {
            msg = <>現在 <b>1位</b>！栄光の頂点だ！🎉</>;
            pct = 100;
        } else if (myIdx > 0 && mine) {
            const above = list[myIdx - 1];
            const diff = above.points - mine.points;
            if (diff <= 0) {
                msg = <><b>{myIdx}位</b>と同点！次の1回で順位アップ！</>;
                pct = 99;
            } else {
                msg = <>あと <b>{diffFmt(diff)}</b> で {myIdx}位！</>;
                pct = Math.max(4, Math.min(96, Math.round((mine.points / above.points) * 100)));
            }
        } else if (isTeamTab && !myTeamId) {
            msg = <>チーム未所属のため対象外です</>;
            pct = 0;
        } else {
            msg = <>まだ圏外…クエストに挑戦してランクインしよう！</>;
            pct = 0;
        }

        return (
            <div className="rk-me">
                <div className="hd">◆ あなたの順位 ◆</div>
                <div className="row">
                    <div className="avw"><span className="av">{renderAvatar(meUser, 46)}</span></div>
                    <div className="rank">{myIdx >= 0 ? <>#{myIdx + 1}<small> 位</small></> : "圏外"}</div>
                    <div className="nm">
                        <div className="n1">{meUser.name}</div>
                        <div className="n2">{mine ? formatPoints(mine) : "記録なし"}</div>
                    </div>
                </div>
                <div className="msg">{msg}</div>
                <div className="barw"><div className="bar" style={{ width: `${pct}%` }} /></div>
            </div>
        );
    };

    // ===== 4位以下の一覧（羊皮紙） =====
    const renderList = (list: RankingUser[]) => {
        const rest = list.slice(3);
        if (rest.length === 0) return null;
        const shown = rest.slice(0, visibleCount);
        return (
            <div className="rk-list">
                <div className="hd">📜 冒険者の記録（4位以下）</div>
                {shown.map((user, i) => {
                    const rank = i + 4;
                    const isMe = user.isTeam ? user.id === myTeamId : user.id === myId;
                    return (
                        <button key={user.id} className={`rk-row${isMe ? " me" : ""}${user.isTeam ? " noclick" : ""}`} onClick={() => { if (!user.isTeam) router.push(`/profile/${user.id}`); }}>
                            <span className="no">{rank}</span>
                            <span className="avw">{renderAvatar(user, 33)}</span>
                            <span className="mid">
                                <span className="nm" style={{ display: "block" }}>{user.name}{isMe && <span className="you">{user.isTeam ? "MY TEAM" : "YOU"}</span>}</span>
                                {user.subLabel && <span className="sub" style={{ display: "block" }}>{user.subLabel}</span>}
                            </span>
                            <span className="dl">{renderDelta(user.id, rank)}</span>
                            <span className="pt">{formatPoints(user)}</span>
                        </button>
                    );
                })}
                {rest.length > visibleCount && (
                    <button className="rk-more" onClick={() => setVisibleCount((v) => v + 20)}>⬇ もっと見る（残り{rest.length - visibleCount}名）</button>
                )}
                <div className="rk-legend">▲▼=前回表示時からの順位変動 ／ ー=変動なし ／ —=未計測（履歴データなし）</div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="rk-page" style={{ justifyContent: "center" }}>
                <style>{CSS}</style>
                <div style={{ fontWeight: 800, color: "#5a6b85" }}>読み込み中...</div>
            </div>
        );
    }

    return (
        <div className="rk-page">
            <style>{CSS}</style>
            <div className="rk-col">
                {/* タイトル */}
                <div className="rk-title">
                    <img src="/home/title_plate.webp" alt="" width={1200} height={374} />
                    <div><span className="t1">🏆 ランキング</span><span className="t2">冒険者たちの栄光の記録</span></div>
                </div>

                {/* タブ（切替は state のみ＝再読み込みなし） */}
                <div className="rk-tabs">
                    {TABS.map((tab) => (
                        <button key={tab.key} className={`rk-tab${activeTab === tab.key ? " on" : ""}`} onClick={() => { setActiveTab(tab.key); setVisibleCount(10); }}>
                            {tab.em} {tab.label}
                        </button>
                    ))}
                </div>

                <div key={activeTab} className="rk-fade">
                    {activeTab === "teams" && (
                        <div className="rk-note" style={{ marginTop: 10 }}>
                            <div className="a">📊 チーム別 日報提出率（今週）</div>
                            <div className="b">提出率 = 提出日数 ÷ (メンバー数 × 7日)</div>
                        </div>
                    )}

                    {currentList.length === 0 ? (
                        <div className="rk-list" style={{ marginTop: 12 }}><div className="rk-empty">まだ記録がありません。最初の栄光を掴もう！✨</div></div>
                    ) : (
                        <div className="rk-main">
                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                {renderPodium(currentList)}
                                {renderMyCard(currentList)}
                            </div>
                            <div>{renderList(currentList)}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* 下部ナビ（HOME/メニューと共通） */}
            <div className="rk-nav">
                <div className="band" />
                {[
                    { key: "home", label: "ホーム", href: "/home" },
                    { key: "ranking", label: "ランキング", href: "/ranking" },
                    { key: "house", label: "おうち", href: "/mypage" },
                    { key: "menu", label: "メニュー", href: "/menu" },
                ].map((t) => (
                    <button key={t.href} onClick={() => router.push(t.href)}>
                        {t.key === "home" && <img src="/home/nav_home_active.webp" alt="" style={{ height: 46, marginBottom: -2, filter: "drop-shadow(0 3px 5px rgba(30,40,90,.4))" }} />}
                        {t.key === "ranking" && <img src="/home/nav_trophy.webp" alt="" style={{ height: 34, filter: "drop-shadow(0 0 6px rgba(255,220,120,.8))" }} />}
                        {t.key === "house" && <img src="/home/nav_house.webp" alt="" style={{ height: 30 }} />}
                        {t.key === "menu" && <div style={{ fontSize: 20, lineHeight: "30px" }}>☰</div>}
                        <div className="lbl" style={t.key === "ranking" ? { color: "#ffe9a8" } : undefined}>{t.label}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}
