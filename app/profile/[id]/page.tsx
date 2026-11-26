"use client";
// 冒険者プロフィール（他ユーザー閲覧）。データ取得は従来と同じ（読み取りのみ・保存データは変更しない）。
// 見た目だけを HOME と同じ王国デザインに変更し、下部を OVERVIEW / SKILLS / ACHIEVEMENTS / JOURNAL の4タブに分けた。
// アバターは HOME と同じ AvatarLayered、島は HOME と同じ DayIslandScene をそのまま使う。
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import SkillBoardCard from "../../components/SkillBoardCard";
import AvatarLayered from "../../components/AvatarLayered";
import DayIslandScene from "../../components/DayIslandScene";
import type { AvatarConfig } from "../../lib/avatar/catalog";
import { JOBS, type JobKey } from "../../onboarding/job/page";
import { evaluateUser, CATEGORIES, type EvalResult } from "../../lib/skills";
import { fetchCurrentTitle } from "../../lib/mypage2";

type Profile = { id: string; name: string; [key: string]: any };
type Department = { id: string; name: string; code: string };
type Challenge = { id: string; title: string; points: number | null; category: string | null };
type ChallengeSubmission = { id: string; challenge_id: string; comment: string | null; image_url: string | null; status: string; created_at: string; challenges: Challenge | null };
type Badge = { id: string; name: string; icon: string | null; at: string };

// テスト定義（合格フラグカラム名 → 表示名）
const TEST_LIST = [
    { key: "quiz_passed", label: "確認ワーク" },
    { key: "common_sense_passed", label: "常識・デリカシー" },
    { key: "social_standard_passed", label: "社会人基準" },
    { key: "long_term_thinking_passed", label: "長期思考" },
    { key: "profit_thinking_passed", label: "利益思考" },
    { key: "essence_thinking_passed", label: "本質思考" },
    { key: "standard_keeping_passed", label: "基準維持" },
    { key: "market_value_passed", label: "市場価値認識" },
    { key: "teiou_passed", label: "Dot.A帝王学" },
    { key: "mentor_passed", label: "メンター" },
    { key: "retention_passed", label: "Dot.A雇用" },
    { key: "entrepreneur_passed", label: "起業" },
    { key: "marketer_passed", label: "マーケター" },
    { key: "sales_passed", label: "営業デビュー" },
    { key: "planner_passed", label: "企画" },
    { key: "manager_certified", label: "マネージャー" },
    { key: "standard_raising_passed", label: "基準上昇" },
    { key: "management_collab_passed", label: "マネジメント協働" },
    { key: "cert_market_value_passed", label: "資格依存改善" },
    { key: "improvement_force_passed", label: "改善力" },
    { key: "apology_escape_passed", label: "謝罪逃避防止" },
    { key: "logical_thinking_passed", label: "論理思考" },
    { key: "progress_update_passed", label: "進捗更新" },
    { key: "life_improvement_passed", label: "生活改善" },
    { key: "market_eval_passed", label: "市場価値・評価認識" },
    { key: "quick_response_passed", label: "即レス" },
    { key: "self_protection_passed", label: "保身防止" },
];

// 就活市場ランク計算
const calcRank = (total: number) => {
    if (total >= 17) return { label: "A", color: "#fbbf24", icon: "🏆" };
    if (total >= 13) return { label: "B", color: "#a855f7", icon: "🥈" };
    if (total >= 9) return { label: "C", color: "#06b6d4", icon: "🥉" };
    if (total >= 5) return { label: "D", color: "#f97316", icon: "" };
    return { label: "E", color: "#6b7280", icon: "" };
};

function getReportPeriod(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = (now.getDay() + 6) % 7; // 月曜=0
    const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfToday.getDate() - dayOfWeek);
    const startOfLastWeek = new Date(startOfWeek); startOfLastWeek.setDate(startOfWeek.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    if (d >= startOfWeek) return "今週";
    if (d >= startOfLastWeek) return "先週";
    if (d >= startOfMonth) return "今月";
    if (d >= startOfLastMonth) return "先月";
    return "それ以前";
}


const THINK = [["hypothesis", "仮説思考"], ["cause", "原因分析"], ["verbal", "言語化"], ["improve", "改善力"], ["self", "自走力"]] as const;
const TABS = [["overview", "OVERVIEW", "基本情報"], ["skills", "SKILLS", "スキル"], ["achievements", "ACHIEVEMENTS", "実績"], ["journal", "JOURNAL", "冒険記録"]] as const;
type TabKey = typeof TABS[number][0];
const PERIODS = ["今週", "先週", "今月", "先月", "それ以前"];
const ymd = (s: string) => new Date(s).toLocaleDateString("ja-JP");

export default function ProfilePage() {
    const params = useParams();
    const router = useRouter();
    const userId = params.id as string;

    const [profile, setProfile] = useState<Profile | null>(null);
    const [department, setDepartment] = useState<Department | null>(null);
    const [totalEarned, setTotalEarned] = useState(0);
    const [challenges, setChallenges] = useState<ChallengeSubmission[]>([]);
    const [thanksCount, setThanksCount] = useState(0);
    const [isMyself, setIsMyself] = useState(false);
    const [learnDone, setLearnDone] = useState(0);
    const [learnTotal, setLearnTotal] = useState(0);
    const [skills, setSkills] = useState<Record<string, number>>({ hypothesis: 0, cause: 0, verbal: 0, improve: 0, self: 0 });
    const [evalRes, setEvalRes] = useState<EvalResult | null>(null);
    const [title, setTitle] = useState<string | null>(null);
    const [badges, setBadges] = useState<Badge[]>([]);
    const [collection, setCollection] = useState<{ have: number; total: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [reports, setReports] = useState<{ id: string; content: string; created_at: string }[]>([]);
    const [expandedReport, setExpandedReport] = useState<string | null>(null);
    const [expandedChallenge, setExpandedChallenge] = useState<string | null>(null);
    const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
    const [reportPeriod, setReportPeriod] = useState("今週");
    const [tab, setTab] = useState<TabKey>("overview");
    const [fromBattle, setFromBattle] = useState(false);

    useEffect(() => { try { setFromBattle(new URLSearchParams(window.location.search).get("from") === "battle"); } catch {} }, []);

    useEffect(() => {
        let alive = true;
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setIsMyself(user.id === userId);

            const { data: profileData, error: pErr } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
            if (!alive) return;
            if (pErr) { setLoadError(true); setLoading(false); return; }
            if (!profileData) { setLoading(false); return; }
            setProfile(profileData as Profile);

            const [doneQ, totalQ, logsQ, deptQ, ptsQ, chQ, thQ, repQ] = await Promise.all([
                supabase.from("content_completions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "approved"),
                supabase.from("contents").select("id", { count: "exact", head: true }),
                supabase.from("thinking_skill_logs").select("skill, exp").eq("user_id", userId),
                profileData.department_id ? supabase.from("departments").select("*").eq("id", profileData.department_id).maybeSingle() : Promise.resolve({ data: null }),
                supabase.from("user_points").select("points, total_earned").eq("id", userId).maybeSingle(),
                supabase.from("challenge_submissions").select("*, challenges(id, title, points, category)").eq("user_id", userId).eq("status", "approved").order("created_at", { ascending: false }),
                supabase.from("thanks").select("*", { count: "exact", head: true }).eq("to_user_id", userId),
                supabase.from("submissions").select("id, content, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
            ]);
            if (!alive) return;
            setLearnDone(doneQ.count || 0); setLearnTotal(totalQ.count || 0);
            const acc: Record<string, number> = { hypothesis: 0, cause: 0, verbal: 0, improve: 0, self: 0 };
            ((logsQ.data || []) as any[]).forEach((l) => { acc[l.skill] = (acc[l.skill] || 0) + (l.exp || 0); });
            setSkills(acc);
            if ((deptQ as any).data) setDepartment((deptQ as any).data as Department);
            setTotalEarned((ptsQ.data as any)?.total_earned || 0);
            setChallenges((chQ.data as ChallengeSubmission[]) || []);
            setThanksCount(thQ.count || 0);
            setReports((repQ.data as any[]) || []);
            setLoading(false);

            // ここから下は補助情報（失敗してもページ本体には影響させない）
            evaluateUser(supabase, userId).then((r) => { if (alive) setEvalRes(r); }).catch(() => {});
            fetchCurrentTitle(supabase, userId).then((t) => { if (alive) setTitle(t?.name ?? null); }).catch(() => {});
            supabase.from("user_badges").select("badge_id, granted_at, badges(name, icon)").eq("user_id", userId).order("granted_at", { ascending: false }).then(({ data }) => {
                if (alive) setBadges(((data || []) as any[]).filter((x) => x.badges?.name).map((x) => ({ id: x.badge_id, name: x.badges.name, icon: x.badges.icon ?? null, at: x.granted_at })));
            });
            // 島コレクション（HOME と同じ数え方：持っている品物 ÷ 販売中の品物）。相手の購入記録が読めない場合は表示しない
            Promise.all([
                supabase.from("island_items").select("id", { count: "exact", head: true }).eq("is_active", true),
                supabase.from("island_purchases").select("item_id, status").eq("user_id", userId),
            ]).then(([it, pur]) => {
                if (!alive || pur.error || !it.count) return;
                const have = ((pur.data || []) as any[]).filter((p) => p.status === "approved").length;
                if (have > 0 || user.id === userId) setCollection({ have, total: it.count });
            }).catch(() => {});
        };
        load();
        return () => { alive = false; };
    }, [userId, router]);

    const goBack = () => { if (typeof window !== "undefined" && window.history.length > 1) router.back(); else router.push(fromBattle ? "/islands" : "/home"); };
    const Nav = () => (
        <div className="pr-nav">
            <div className="band" />
            <button onClick={() => router.push("/home")}><img src="/home/nav_home_active.webp" alt="" /><i>ホーム</i></button>
            <button onClick={() => router.push("/ranking")}><img src="/home/nav_trophy.webp" alt="" /><i>ランキング</i></button>
            <button onClick={() => router.push("/mypage")}><img src="/home/nav_house.webp" alt="" /><i>おうち</i></button>
            <button onClick={() => router.push("/menu")}><span aria-hidden>☰</span><i>メニュー</i></button>
        </div>
    );

    if (loading || !profile) {
        return (
            <div className="pr-root">
                <div className="pr-wrap"><div className="pr-msg" role={loading ? "status" : "alert"}>
                    {loading ? "読み込み中…" : loadError ? "読み込みに失敗しました。通信を確認して、もう一度開いてください。" : "ユーザーが見つかりません"}
                    {!loading && <button className="pr-back" style={{ position: "static", marginTop: 14 }} onClick={goBack}>← 戻る</button>}
                </div></div>
                <Nav /><style>{CSS}</style>
            </div>
        );
    }

    const level = Math.floor(totalEarned / 100) + 1;
    const expInLevel = totalEarned % 100;
    const job = profile.job_class && JOBS.some((j) => j.key === profile.job_class) ? (profile.job_class as JobKey) : null;
    const ac = profile.avatar_config;
    const cfg = job && ac?.type === "layered" ? (ac as AvatarConfig) : null;
    // アバター未設定で職業も選んでいない人：6職業の最初のキャラクターから1つを出す（人ごとに固定。開くたびには変わらない）
    const JOB_KEYS = ["knight", "mage", "archer", "healer", "rogue", "paladin"];
    let seed = 0; for (let i = 0; i < userId.length; i++) seed = (seed * 31 + userId.charCodeAt(i)) >>> 0;
    const defaultJob = JOB_KEYS[seed % JOB_KEYS.length];
    const lic = profile.licenses || {};
    const licenses = [
        lic.ip ? { img: "license_ip.png", label: "IP免許" } : null,
        lic.cb ? { img: "license_cb.png", label: "CB免許" } : null,
        lic.sales ? { img: "license_sales.png", label: "営業昇格" } : null,
    ].filter(Boolean) as { img: string; label: string }[];
    const passedTests = TEST_LIST.filter((t) => profile[t.key] === true);
    const rankTotal = (profile.rank_score_es || 0) + (profile.rank_score_personality || 0) + (profile.rank_score_interview || 0) + (profile.rank_score_education || 0);
    const rank = calcRank(rankTotal);
    const streak = profile.streak || 0;
    const hobby = profile.hobby_category || null;
    const club = profile.club || profile.club_category || null;
    const facts = [["学歴", profile.education], ["MBTI", profile.mbti], ["部活", club], ["趣味", hobby]].filter((f) => f[1]) as [string, string][];
    const unlocked = evalRes ? evalRes.nodes.filter((n) => n.status === "unlocked").length : 0;
    const chPoints = challenges.reduce((s, c) => s + (c.challenges?.points || 0), 0);
    const chGroups: Record<string, ChallengeSubmission[]> = {};
    challenges.forEach((c) => { const k = c.challenges?.category || "その他"; (chGroups[k] = chGroups[k] || []).push(c); });
    const reportGroup = reports.filter((r) => getReportPeriod(r.created_at) === reportPeriod);

    const Licenses = ({ size }: { size: number }) => licenses.length === 0 ? null : (
        <div className="pr-lics">{licenses.map((l) => <div key={l.label} className="pr-lic"><img src={"/island/licenses/" + l.img} alt="" style={{ width: size, height: size }} /><span>{l.label}</span></div>)}</div>
    );
    const Bar = ({ pct, color }: { pct: number; color?: string }) => <div className="pr-bar" role="img" aria-label={`${Math.round(pct)}%`}><i style={{ width: Math.max(0, Math.min(100, pct)) + "%", background: color }} /></div>;

    return (
        <div className="pr-root">
            <div className="pr-wrap">
                {/* ===== 見出し ===== */}
                <div className="pr-top">
                    <button className="pr-back" onClick={goBack}>← {fromBattle ? "バトルへ戻る" : "戻る"}</button>
                    <div className="pr-title"><img src="/profile/title_ribbon.webp" alt="" /><h1>冒険者プロフィール</h1></div>
                </div>

                {/* ===== 上段：アバター／冒険者情報／島 ===== */}
                <div className="pr-hero">
                    <div className="pr-avatar">
                        <img className="pr-ped" src="/profile/avatar_pedestal.webp" alt="" />
                        <div className="pr-avbody">
                        {cfg && job ? <AvatarLayered config={cfg} job={job} size="100%" />
                            : job ? <img src={`/jobs/${job}.webp`} alt="" className="pr-avimg" />
                            : <img src={`/jobs/${defaultJob}.webp`} alt="" className="pr-avimg" />}
                        </div>
                    </div>

                    <div className="pr-info">
                        <div className="pr-card">
                            <div className="pr-card-top">
                                <div className="pr-idn">
                                    <div className="pr-name">{profile.name}</div>
                                    <div className="pr-sub">
                                        {job && <span>{JOBS.find((j) => j.key === job)?.name}</span>}
                                        {profile.position && <span>{profile.position}</span>}
                                    </div>
                                    <div className="pr-chips">
                                        {department && <span className="pr-chip dept">{department.code || department.name}</span>}
                                        {title && <span className="pr-chip title">{title}</span>}
                                        {isMyself && <button className="pr-chip edit" onClick={() => router.push("/profile")}>プロフィールを編集</button>}
                                    </div>
                                </div>
                                <Licenses size={58} />
                            </div>
                            {facts.length > 0 && <div className="pr-facts">{facts.map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>}
                        </div>
                        <div className="pr-stat">
                            <div className="pr-lv"><small>Lv.</small>{level}</div>
                            <div className="pr-exp">
                                <div className="pr-exp-t"><span>EXP {expInLevel} / 100</span><b>{totalEarned.toLocaleString()}pt</b></div>
                                <Bar pct={expInLevel} />
                            </div>
                            <div className="pr-streak"><b>{streak}</b>日連続</div>
                            <div className="pr-thanks"><small>THANKS</small><b>{thanksCount}</b></div>
                        </div>
                    </div>

                    <div className="pr-island">
                        <div className="pr-island-in"><DayIslandScene config={profile.island_config || {}} totalEarned={totalEarned} width="100%" /></div>
                        {collection && <div className="pr-col">島コレクション {collection.have}/{collection.total}</div>}
                    </div>
                </div>

                {/* ===== タブ ===== */}
                <div className="pr-tabs" role="tablist" aria-label="プロフィールの内容">
                    {TABS.map(([k, en, ja]) => (
                        <button key={k} role="tab" aria-selected={tab === k} className={"pr-tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}><img src={`/profile/tab_${k}.webp`} alt="" /><span><b>{en}</b><small>{ja}</small></span></button>
                    ))}
                </div>

                <div className="pr-panel" role="tabpanel">
                    {tab === "overview" && (
                        <div className="pr-cols">
                            <section className="pr-box">
                                <h2>基本情報</h2>
                                <dl className="pr-dl">
                                    {department && <div><dt>所属</dt><dd>{department.name}</dd></div>}
                                    {profile.position && <div><dt>役職</dt><dd>{profile.position}</dd></div>}
                                    {job && <div><dt>職業</dt><dd>{JOBS.find((j) => j.key === job)?.name}</dd></div>}
                                    {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                                </dl>
                                {!department && !profile.position && !job && facts.length === 0 && <p className="pr-empty">まだ登録されていません</p>}
                                {profile.bio && <><h3>自己紹介</h3><p className="pr-bio">{profile.bio}</p></>}
                                <h3>取得免許・称号</h3>
                                {licenses.length === 0 && !title ? <p className="pr-empty">まだありません</p> : (
                                    <div className="pr-lt"><Licenses size={64} />{title && <div className="pr-titlebox"><small>設定中の称号</small><b>{title}</b></div>}</div>
                                )}
                            </section>
                            <section className="pr-box">
                                <h2>ステータス</h2>
                                <div className="pr-tiles">
                                    <div className="pr-tile blue"><small>TOTAL POINTS</small><b>{totalEarned.toLocaleString()}<i>pt</i></b></div>
                                    <div className="pr-tile gold"><small>LEVEL</small><b>Lv.{level}</b></div>
                                    <div className="pr-tile pink"><small>THANKS</small><b>{thanksCount}</b></div>
                                    <div className="pr-tile green"><small>連続ログイン</small><b>{streak}<i>日</i></b></div>
                                </div>
                                {/* 本人だけに表示（従来と同じ。他の人には見せない） */}
                                {isMyself && rankTotal > 0 && (
                                    <div className="pr-rank">
                                        <h3>就活市場ランク <span>あなたにだけ表示されています</span></h3>
                                        <div className="pr-rank-row"><b style={{ color: rank.color }}>{rank.label}</b><span>合計 {rankTotal} / 20</span></div>
                                        <dl className="pr-dl four">
                                            <div><dt>ES</dt><dd>{profile.rank_score_es || 0}</dd></div>
                                            <div><dt>人柄</dt><dd>{profile.rank_score_personality || 0}</dd></div>
                                            <div><dt>面接</dt><dd>{profile.rank_score_interview || 0}</dd></div>
                                            <div><dt>学歴</dt><dd>{profile.rank_score_education || 0}</dd></div>
                                        </dl>
                                    </div>
                                )}
                            </section>
                        </div>
                    )}

                    {tab === "skills" && (
                        <div className="pr-cols">
                            <section className="pr-box">
                                <h2>SKILL WORLD {evalRes && <span>取得 {unlocked} / {evalRes.nodes.length}</span>}</h2>
                                {!evalRes ? <p className="pr-empty">読み込み中…</p> : CATEGORIES.map((c) => {
                                    const all = evalRes.nodes.filter((n) => n.category === c.key); const got = all.filter((n) => n.status === "unlocked").length;
                                    return (
                                        <div key={c.key} className="pr-skill">
                                            <div className="pr-skill-t"><b>{c.en}<small>{c.label}</small></b><span>Lv.{evalRes.levels[c.key] ?? 0}　{got} / {all.length}</span></div>
                                            <Bar pct={all.length ? (got / all.length) * 100 : 0} color={c.color} />
                                        </div>
                                    );
                                })}
                                <div className="pr-sbc"><SkillBoardCard mode="public" userId={userId} /></div>
                            </section>
                            <section className="pr-box">
                                <h2>THINKING SKILLS</h2>
                                {THINK.map(([k, label]) => {
                                    const exp = skills[k] || 0; const lv = Math.floor(exp / 50) + 1;
                                    return (
                                        <div key={k} className="pr-skill">
                                            <div className="pr-skill-t"><b>{label}</b><span>Lv.{lv}　{exp} EXP</span></div>
                                            <Bar pct={(exp % 50) * 2} />
                                        </div>
                                    );
                                })}
                                <p className="pr-note">日報後の実験・振り返り・メンタークエストで上がります（動画視聴では上がりません）</p>
                                <h3>学習コンテンツ <span>{learnDone} / {learnTotal}</span></h3>
                                <Bar pct={learnTotal ? (learnDone / learnTotal) * 100 : 0} />
                                <h3>合格テスト <span>{passedTests.length} / {TEST_LIST.length}</span></h3>
                                {passedTests.length === 0 ? <p className="pr-empty">まだ合格したテストはありません</p> : (
                                    <div className="pr-tests">{passedTests.map((t) => <span key={t.key}><img src="/home/check_done.webp" alt="合格" />{t.label}</span>)}</div>
                                )}
                            </section>
                        </div>
                    )}

                    {tab === "achievements" && (
                        <div className="pr-cols">
                            <section className="pr-box">
                                <h2>ライフチャレンジ <span>達成 {challenges.length}件</span></h2>
                                <div className="pr-tiles two">
                                    <div className="pr-tile gold"><small>達成数</small><b>{challenges.length}<i>件</i></b></div>
                                    <div className="pr-tile blue"><small>チャレンジで獲得</small><b>{chPoints.toLocaleString()}<i>pt</i></b></div>
                                </div>
                                {challenges.length === 0 ? <p className="pr-empty">まだ達成したチャレンジはありません</p> : Object.entries(chGroups).map(([cat, list]) => {
                                    const open = !!openCats[cat];
                                    return (
                                        <div key={cat} className="pr-fold">
                                            <button className="pr-fold-h" aria-expanded={open} onClick={() => setOpenCats((p) => ({ ...p, [cat]: !open }))}><b>{cat}</b><span>{list.length}件</span><i aria-hidden>{open ? "▲" : "▼"}</i></button>
                                            {open && list.map((c) => {
                                                const ex = expandedChallenge === c.id; const has = !!(c.comment || c.image_url);
                                                return (
                                                    <div key={c.id} className="pr-item">
                                                        <button className="pr-item-h" disabled={!has} aria-expanded={has ? ex : undefined} onClick={() => setExpandedChallenge(ex ? null : c.id)}>
                                                            <b>{c.challenges?.title || "チャレンジ"}</b>
                                                            {c.challenges?.points ? <span className="pt">+{c.challenges.points}pt</span> : null}
                                                            <span className="dt">{ymd(c.created_at)}</span>
                                                            {has && <i aria-hidden>{ex ? "▲" : "▼"}</i>}
                                                        </button>
                                                        {ex && <div className="pr-item-b">{c.comment && <p>{c.comment}</p>}{c.image_url && <img src={c.image_url} alt={c.challenges?.title || "チャレンジ画像"} />}</div>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </section>
                            <section className="pr-box">
                                <h2>取得称号 <span>{badges.length}個</span></h2>
                                {badges.length === 0 ? <p className="pr-empty">まだ称号はありません</p> : (
                                    <div className="pr-badges">{badges.map((b) => <div key={b.id + b.at}>{b.icon && b.icon.startsWith("/") && <img src={b.icon} alt="" />}<b>{b.name}</b><small>{ymd(b.at)}</small></div>)}</div>
                                )}
                                <h3>累計の実績</h3>
                                <dl className="pr-dl">
                                    <div><dt>累計ポイント</dt><dd>{totalEarned.toLocaleString()}pt</dd></div>
                                    <div><dt>もらったTHANKS</dt><dd>{thanksCount}件</dd></div>
                                    <div><dt>合格テスト</dt><dd>{passedTests.length}個</dd></div>
                                    <div><dt>学習コンテンツ</dt><dd>{learnDone} / {learnTotal}</dd></div>
                                </dl>
                            </section>
                        </div>
                    )}

                    {tab === "journal" && (
                        <section className="pr-box">
                            <h2>日報 <span>直近 {reports.length}件</span></h2>
                            {reports.length === 0 ? <p className="pr-empty">まだ日報がありません</p> : (
                                <>
                                    <div className="pr-periods">{PERIODS.map((p) => <button key={p} className={reportPeriod === p ? "on" : ""} aria-pressed={reportPeriod === p} onClick={() => setReportPeriod(p)}>{p}<small>{reports.filter((r) => getReportPeriod(r.created_at) === p).length}</small></button>)}</div>
                                    {reportGroup.length === 0 ? <p className="pr-empty">この期間の日報はありません</p> : reportGroup.map((r) => {
                                        const ex = expandedReport === r.id; const long = r.content.length > 100;
                                        return (
                                            <div key={r.id} className="pr-report">
                                                <div className="dt">{ymd(r.created_at)}</div>
                                                <div className={"tx" + (ex || !long ? " open" : "")}>{r.content}</div>
                                                {long && <button aria-expanded={ex} onClick={() => setExpandedReport(ex ? null : r.id)}>{ex ? "▲ 閉じる" : "▼ 続きを読む"}</button>}
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </section>
                    )}
                </div>
            </div>
            <Nav />
            <style>{CSS}</style>
        </div>
    );
}

const CSS = `
.pr-root{min-height:100vh;background:#cfe6ff url(/home/bg_mobile.webp) center top/cover fixed;padding:14px 12px calc(110px + env(safe-area-inset-bottom));font-family:inherit;color:#17307a;overflow-x:clip}
@media (min-width:700px){ .pr-root{background-image:url(/home/bg_pc.webp);padding-top:20px} }
.pr-wrap{max-width:1180px;margin:0 auto}
.pr-msg{margin:80px auto;max-width:420px;text-align:center;padding:26px 18px;background:rgba(255,253,246,.96);border:3px solid #e2bf63;border-radius:22px;font-weight:900;font-size:15px;display:flex;flex-direction:column;align-items:center}
.pr-top{position:relative;display:flex;justify-content:center;align-items:center;min-height:64px}
.pr-back{position:absolute;left:0;top:50%;transform:translateY(-50%);min-height:44px;padding:8px 18px;border:2px solid #c9a94e;border-radius:999px;background:rgba(255,255,255,.95);color:#17397d;font-size:13.5px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 4px 10px rgba(16,47,112,.2);z-index:2}
.pr-title{position:relative;width:min(100%,520px);container-type:inline-size}
.pr-title img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 12px rgba(16,47,112,.3))}
.pr-title h1{position:absolute;left:13%;right:13%;top:27%;bottom:45%;margin:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:clamp(14px,5.6cqw,28px);font-weight:900;letter-spacing:.1em;text-shadow:0 2px 4px rgba(8,24,70,.6);white-space:nowrap}
.pr-hero{display:grid;grid-template-columns:minmax(0,250px) minmax(0,1fr) minmax(0,360px);gap:16px;align-items:center;margin-top:6px}
.pr-avatar{position:relative;width:100%;max-width:250px;margin:0 auto;padding-bottom:25.3%}
.pr-ped{position:absolute;left:0;bottom:0;width:100%;height:auto;display:block;filter:drop-shadow(0 10px 12px rgba(16,47,112,.3))}
.pr-avbody{position:relative;z-index:1;width:86%;margin:0 auto;aspect-ratio:1024 / 1224;display:flex;align-items:flex-end;justify-content:center}
.pr-avimg{display:block;width:100%;height:auto;max-height:92%;object-fit:contain;border-radius:20px;margin-bottom:4%}
.pr-info{min-width:0}
.pr-card{background:linear-gradient(180deg,rgba(255,253,246,.98),rgba(250,241,221,.98));border:3px solid #e2bf63;border-radius:24px;box-shadow:inset 0 0 0 2px #fff,0 10px 24px rgba(16,47,112,.26);padding:16px 20px}
.pr-card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.pr-idn{min-width:0}
.pr-name{font-size:clamp(21px,2.6vw,30px);font-weight:900;line-height:1.25;overflow-wrap:anywhere}
.pr-sub{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:3px;font-size:13.5px;font-weight:800;color:#3a4a75}
.pr-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.pr-chip{display:inline-flex;align-items:center;min-height:26px;padding:2px 12px;border-radius:999px;font-size:12px;font-weight:900;border:1.5px solid transparent;font-family:inherit}
.pr-chip.dept{background:#2a4aa6;color:#fff}
.pr-chip.title{background:#fff6d6;color:#7a5a12;border-color:#e2bf63}
.pr-chip.edit{background:#fff;color:#17397d;border-color:#7f95d6;cursor:pointer;min-height:32px}
.pr-lics{display:flex;gap:10px;flex-wrap:wrap;flex-shrink:0}
.pr-lic{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11.5px;font-weight:900;white-space:nowrap}
.pr-lic img{display:block;object-fit:contain}
.pr-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px 12px;margin-top:12px;padding-top:12px;border-top:1.5px solid rgba(190,160,110,.45)}
.pr-facts small{display:block;font-size:11px;font-weight:800;color:#6b7591}
.pr-facts b{display:block;font-size:13.5px;font-weight:900;overflow-wrap:anywhere}
.pr-stat{display:flex;align-items:center;gap:10px;margin-top:10px;padding:8px 12px;background:linear-gradient(180deg,#22367c,#16265e);border:2.5px solid #e2bf63;border-radius:18px;box-shadow:0 8px 18px rgba(16,47,112,.3);color:#fff;flex-wrap:wrap}
.pr-lv{flex-shrink:0;padding:6px 14px;border-radius:12px;background:linear-gradient(180deg,#5a4313,#3a2a0a);border:2px solid #e2bf63;color:#ffe9a8;font-size:21px;font-weight:900;line-height:1.1}
.pr-lv small{font-size:12px;margin-right:2px}
.pr-exp{flex:1 1 150px;min-width:0}
.pr-exp-t{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;font-weight:800;margin-bottom:4px;color:#dbe6ff}
.pr-exp-t b{color:#fff;font-size:13px}
.pr-streak{flex-shrink:0;font-size:12.5px;font-weight:900;color:#ffd98a;white-space:nowrap}
.pr-streak b{font-size:19px;margin-right:2px}
.pr-thanks{flex-shrink:0;display:flex;flex-direction:column;align-items:center;padding:3px 14px;border-radius:12px;background:linear-gradient(180deg,#8a5aa8,#6b3f8a);border:2px solid #e9c7f5;line-height:1.15}
.pr-thanks small{font-size:10px;font-weight:900;letter-spacing:.08em}
.pr-thanks b{font-size:19px;font-weight:900}
.pr-bar{height:10px;border-radius:999px;background:rgba(23,48,122,.16);overflow:hidden}
.pr-stat .pr-bar{background:rgba(255,255,255,.2)}
.pr-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#4f8dff,#2a5bd6)}
.pr-stat .pr-bar i{background:linear-gradient(90deg,#7fc4ff,#3f8dff)}
.pr-island{min-width:0;display:flex;flex-direction:column;align-items:center}
.pr-island-in{width:100%;max-width:360px}
.pr-col{margin-top:-4px;padding:5px 16px;border-radius:999px;background:rgba(255,255,255,.94);border:2px solid #e2bf63;font-size:12.5px;font-weight:900;color:#5a4a22;position:relative;z-index:2}
.pr-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:14px;position:relative;z-index:2}
.pr-tab{min-height:56px;padding:6px 4px;border:3px solid #e2bf63;border-bottom-width:0;border-radius:18px 18px 0 0;background:linear-gradient(180deg,#fffdf6,#f6ecd4);color:#3a4a75;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:10px;min-width:0}
.pr-tab img{width:38px;height:38px;object-fit:contain;flex-shrink:0}
.pr-tab span{display:flex;flex-direction:column;align-items:center;gap:1px;min-width:0}
.pr-tab b{font-size:clamp(10.5px,1.5vw,16px);font-weight:900;letter-spacing:.04em;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.pr-tab small{font-size:11px;font-weight:800;color:#6b7591}
.pr-tab.on{background:linear-gradient(180deg,#3f6fe0,#1f3f9e);color:#fff;border-color:#f1d27a;box-shadow:0 -4px 12px rgba(31,63,158,.3)}
.pr-tab.on small{color:#dbe6ff}
.pr-tab:focus-visible,.pr-back:focus-visible,.pr-fold-h:focus-visible,.pr-item-h:focus-visible,.pr-periods button:focus-visible,.pr-report button:focus-visible,.pr-chip.edit:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}
.pr-panel{background:linear-gradient(180deg,rgba(255,253,246,.98),rgba(248,238,216,.98));border:3px solid #e2bf63;border-radius:0 0 26px 26px;box-shadow:inset 0 0 0 2px #fff,0 14px 30px rgba(16,47,112,.3);padding:18px}
.pr-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
.pr-box{min-width:0;background:rgba(255,255,255,.72);border:1.5px solid rgba(190,160,110,.55);border-radius:18px;padding:16px}
.pr-box h2{margin:0 0 12px;font-size:17px;font-weight:900;display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap;padding-bottom:8px;border-bottom:2px solid rgba(226,191,99,.7)}
.pr-box h3{margin:18px 0 8px;font-size:14.5px;font-weight:900;display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}
.pr-box h2 span,.pr-box h3 span{font-size:12px;font-weight:800;color:#6b7591}
.pr-dl{margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.pr-dl.four{grid-template-columns:repeat(4,minmax(0,1fr))}
.pr-dl>div{background:#fff;border:1px solid rgba(190,160,110,.45);border-radius:12px;padding:8px 12px;min-width:0}
.pr-dl dt{font-size:11px;font-weight:800;color:#6b7591}
.pr-dl dd{margin:2px 0 0;font-size:14px;font-weight:900;overflow-wrap:anywhere}
.pr-bio{margin:0;font-size:14px;line-height:1.75;font-weight:700;color:#2c3555;white-space:pre-wrap;overflow-wrap:anywhere}
.pr-empty{margin:6px 0;font-size:13px;font-weight:700;color:#6b7591}
.pr-note{margin:8px 0 0;font-size:11.5px;font-weight:700;color:#6b7591;line-height:1.6}
.pr-lt{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.pr-titlebox{padding:8px 14px;border-radius:12px;background:#fff6d6;border:1.5px solid #e2bf63}
.pr-titlebox small{display:block;font-size:11px;font-weight:800;color:#7a5a12}
.pr-titlebox b{font-size:14.5px;font-weight:900;color:#5a4313}
.pr-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.pr-tile{border-radius:16px;padding:10px 8px;text-align:center;border:2px solid;min-width:0}
.pr-tile small{display:block;font-size:11px;font-weight:900;letter-spacing:.04em}
.pr-tile b{font-size:clamp(19px,2.4vw,26px);font-weight:900;line-height:1.3}
.pr-tile i{font-style:normal;font-size:12px;margin-left:2px}
.pr-tile.blue{background:#eef4ff;border-color:#b9cdf6;color:#17307a}
.pr-tile.gold{background:#fff6d6;border-color:#e2bf63;color:#7a4a08}
.pr-tile.pink{background:#fdeaf4;border-color:#f0b6d3;color:#8a1f58}
.pr-tile.green{background:#e9f7ee;border-color:#a9d9b9;color:#1f6a3d}
.pr-rank{margin-top:16px;padding:12px;border-radius:14px;background:#fff;border:1.5px dashed #c9a94e}
.pr-rank h3{margin-top:0}
.pr-rank-row{display:flex;align-items:baseline;gap:12px;margin-bottom:8px}
.pr-rank-row b{font-size:38px;font-weight:900;line-height:1}
.pr-rank-row span{font-size:13px;font-weight:800;color:#3a4a75}
.pr-skill{margin-bottom:11px}
.pr-skill-t{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:4px;font-size:13px}
.pr-skill-t b{font-weight:900;min-width:0;overflow-wrap:anywhere}
.pr-skill-t b small{margin-left:6px;font-size:11px;font-weight:800;color:#6b7591}
.pr-skill-t span{font-size:12px;font-weight:900;color:#3a4a75;white-space:nowrap}
.pr-sbc{margin-top:14px}
.pr-tests{display:flex;flex-wrap:wrap;gap:6px}
.pr-tests span{display:inline-flex;align-items:center;gap:5px;padding:5px 11px 5px 6px;border-radius:999px;background:#fff;border:1.5px solid #b9cdf6;font-size:12.5px;font-weight:900}
.pr-tests img{width:18px;height:18px;object-fit:contain}
.pr-tiles.two{margin-bottom:12px}
.pr-fold{margin-bottom:8px;border:1.5px solid rgba(190,160,110,.55);border-radius:14px;background:#fff;overflow:hidden}
.pr-fold-h{width:100%;min-height:46px;display:flex;align-items:center;gap:10px;padding:8px 14px;background:linear-gradient(180deg,#f4f7ff,#e6edff);border:none;cursor:pointer;font-family:inherit;color:#17307a;text-align:left}
.pr-fold-h b{flex:1;min-width:0;font-size:14px;font-weight:900;overflow-wrap:anywhere}
.pr-fold-h span{font-size:12px;font-weight:900;color:#3a4a75;white-space:nowrap}
.pr-fold-h i,.pr-item-h i{font-style:normal;font-size:10px;color:#6b7591}
.pr-item{border-top:1px solid rgba(190,160,110,.35)}
.pr-item-h{width:100%;min-height:44px;display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;padding:8px 14px;background:transparent;border:none;cursor:pointer;font-family:inherit;color:#17307a;text-align:left}
.pr-item-h:disabled{cursor:default}
.pr-item-h b{flex:1 1 90px;min-width:0;font-size:13.5px;font-weight:800;overflow-wrap:anywhere}
.pr-item-h .pt{font-size:12.5px;font-weight:900;color:#a8690a;white-space:nowrap}
.pr-item-h .dt{font-size:11.5px;font-weight:700;color:#6b7591;white-space:nowrap}
.pr-item-b{padding:0 14px 12px}
.pr-item-b p{margin:0 0 8px;font-size:13px;line-height:1.7;font-weight:700;color:#2c3555;white-space:pre-wrap;overflow-wrap:anywhere}
.pr-item-b img{display:block;max-width:100%;max-height:320px;border-radius:10px}
.pr-badges{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
.pr-badges>div{background:#fff6d6;border:1.5px solid #e2bf63;border-radius:12px;padding:8px 10px;min-width:0;text-align:center}
.pr-badges img{display:block;width:40px;height:40px;object-fit:contain;margin:0 auto 4px}
.pr-badges b{display:block;font-size:13px;font-weight:900;color:#5a4313;overflow-wrap:anywhere}
.pr-badges small{font-size:10.5px;font-weight:700;color:#7a6a40}
.pr-periods{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.pr-periods button{min-height:40px;padding:6px 14px;border-radius:999px;border:2px solid #b9cdf6;background:#fff;color:#17397d;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px}
.pr-periods button small{font-size:11px;font-weight:900;color:#6b7591}
.pr-periods button.on{background:linear-gradient(180deg,#3f6fe0,#1f3f9e);border-color:#f1d27a;color:#fff}
.pr-periods button.on small{color:#dbe6ff}
.pr-report{background:#fff;border:1.5px solid rgba(190,160,110,.5);border-radius:14px;padding:12px 14px;margin-bottom:8px}
.pr-report .dt{font-size:11.5px;font-weight:800;color:#6b7591;margin-bottom:5px}
.pr-report .tx{font-size:13.5px;line-height:1.75;font-weight:700;color:#2c3555;white-space:pre-wrap;overflow-wrap:anywhere;max-height:66px;overflow:hidden}
.pr-report .tx.open{max-height:none}
.pr-report button{margin-top:6px;min-height:36px;padding:4px 12px;border-radius:999px;border:1.5px solid #b9cdf6;background:#f4f7ff;color:#17397d;font-size:12px;font-weight:900;cursor:pointer;font-family:inherit}
.pr-nav{position:fixed;left:0;bottom:0;width:100%;max-width:100vw;z-index:50;display:flex;height:calc(86px + env(safe-area-inset-bottom));padding:0 10px calc(10px + env(safe-area-inset-bottom));overflow:hidden}
.pr-nav .band{position:absolute;inset:6px 8px calc(8px + env(safe-area-inset-bottom));background:url(/home/nav_bar.webp);background-size:100% 100%;pointer-events:none}
.pr-nav button{position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;padding-bottom:calc(17px + env(safe-area-inset-bottom));background:transparent;border:none;cursor:pointer;color:#fff;font-family:inherit}
.pr-nav img{height:30px}
.pr-nav span{font-size:20px;line-height:30px}
.pr-nav i{font-style:normal;font-size:10.5px;font-weight:800}
@media (max-width:980px){
  .pr-hero{grid-template-columns:minmax(0,190px) minmax(0,1fr)}
  .pr-island{grid-column:1 / -1}
}
@media (max-width:640px){
  .pr-top{flex-direction:column;align-items:stretch;gap:8px}
  .pr-back{position:static;transform:none;align-self:flex-start}
  .pr-title{margin:0 auto}
  .pr-hero{grid-template-columns:minmax(0,1fr);gap:10px}
  .pr-avatar{max-width:190px}
  .pr-card{padding:14px}
  .pr-card-top{flex-direction:column}
  .pr-island-in{max-width:320px}
  .pr-tabs{gap:3px}
  .pr-tab{min-height:52px;border-width:2px;border-bottom-width:0;border-radius:13px 13px 0 0}
  .pr-tab{flex-direction:column;gap:2px;min-height:74px}
  .pr-tab img{width:26px;height:26px}
  .pr-tab span{flex-direction:column-reverse}
  .pr-tab b{font-size:8px;letter-spacing:0;font-weight:800;opacity:.85}
  .pr-tab small{font-size:13px;font-weight:900;color:inherit}
  .pr-tab.on small{color:#fff}
  .pr-panel{padding:10px;border-radius:0 0 20px 20px}
  .pr-cols{grid-template-columns:minmax(0,1fr);gap:10px}
  .pr-box{padding:13px}
  .pr-dl.four{grid-template-columns:repeat(2,minmax(0,1fr))}
}
`;
