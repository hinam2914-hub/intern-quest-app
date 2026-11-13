"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { calculateSibyl, calculateDepartmentMatch, isExcluded } from "../lib/sibyl";
import { ADMIN_ICONS } from "./adminTheme";

/** ChatGPT素材アイコン（未納品キーは絵文字で代替） */
const Ico = ({ k, emoji, size = 30 }: { k: string; emoji: string; size?: number }) =>
  ADMIN_ICONS[k]
    ? <img src={ADMIN_ICONS[k]!} alt="" style={{ width: size, height: size, objectFit: "contain", verticalAlign: "middle" }} />
    : <span style={{ fontSize: size * 0.8 }}>{emoji}</span>;

/* ===== 判定しきい値（調整はここ） ===== */
const TH = {
  leaderTotal: 60, leaderGrit: 10, leaderSocial: 10,
  hardTotal: 30, hardAxis: 3,
  riskGrit: 7,
  mismatchScore: 70,
};
const JOB_TO_DEPT: Record<string, string> = { "訪販": "IP", "テレアポ": "CB", "クローザー": "CB", "人事": "HR" };
const JOB_LABEL: Record<string, string> = { "訪販": "訪販(IP)", "テレアポ": "テレアポ(CB)", "クローザー": "クローザー(CB)", "人事": "人事(HR)", "管理マネージャー": "管理マネージャー" };
const DEPT_ORDER = ["IP", "CB", "SP", "HR", "MK", "EXAM"];

type Stats = {
  notSubmitted: number; submitRate: number; pendingCount: number; userCount: number; pendingAvatar?: number; pendingIsland?: number; pendingShop?: number;
  pendingTask?: number; pendingKkc?: number; pendingAdvice?: number; pendingMedaka?: number;
  pendingMentor?: number; pendingMtg?: number; pendingTest?: number; pendingRecruit?: number; pendingChallenge?: number; pendingRequest?: number; pendingQuestion?: number; pendingMgrTest?: number; pendingLearn?: number; pendingJourney?: number; pendingRookie?: number; pendingFb?: number; pendingSkill?: number;
};
type Card = { key: string; icon: string; title: string; desc?: string; badgeKey?: keyof Stats };

export default function DashboardHome({ stats, onNavigate, notSubmittedList = [] }: { stats: Stats; onNavigate: (key: string) => void; notSubmittedList?: { name: string; department_id: string | null }[] }) {
  const [sibyl, setSibyl] = useState({ health: 0, hard: 0, risk: 0, mismatch: 0, leader: 0, total: 0 });
  const [proposals, setProposals] = useState<{ icon: string; text: string; uid?: string }[]>([]);
  const [week, setWeek] = useState({ submitRate: 0, activeRate: 0, thanks: 0, challenges: 0, hires: 0, mentsuna: 0 });
  const [deptRates, setDeptRates] = useState<{ code: string; rate: number }[]>([]);
  const [interviews, setInterviews] = useState(0);
  const [scanTime, setScanTime] = useState("");
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
        const d3 = new Date(now.getTime() - 3 * 86400000).toISOString();

        const [{ data: profs }, { data: depts }, { data: subs7 }, { data: ph7 }, { data: rec7 }, { count: ivC }] = await Promise.all([
          supabase.from("profiles").select("id,name,mbti,education,club_category,hobby_category,department_id,exclude_from_stats"),
          supabase.from("departments").select("id,code"),
          supabase.from("submissions").select("user_id").gte("created_at", d7),
          supabase.from("points_history").select("user_id,reason").gte("created_at", d7),
          supabase.from("recruit_progress").select("action_type,status").gte("created_at", d7),
          supabase.from("interview_requests").select("*", { count: "exact", head: true }).eq("status", "open"),
        ]);
        const { data: resigned } = await supabase.from("resignations").select("user_id");
        const resignedIds = new Set((resigned || []).map((r: any) => r.user_id));

        const active = (profs || []).filter((p: any) => !isExcluded(p.id) && !resignedIds.has(p.id));
        // 運用指標（提出率・アクティブ率・部署別）は経営側も含めた全在籍者を母数にする（離職者のみ除外）
        const activeAll = (profs || []).filter((p: any) => !resignedIds.has(p.id));
        const statAll = activeAll.filter((p: any) => !p.exclude_from_stats); // 日報提出率のみ3人除外
        const deptCode: Record<string, string> = {};
        (depts || []).forEach((d: any) => { deptCode[d.id] = d.code; });
        const submitted7 = new Set((subs7 || []).map((s: any) => s.user_id));
        const { data: subs3 } = await supabase.from("submissions").select("user_id").gte("created_at", d3);
        const submitted3 = new Set((subs3 || []).map((s: any) => s.user_id));

        let hard = 0, risk = 0, mismatch = 0, leader = 0;
        const mismatchNames: { name: string; to: string; cur: string; uid: string }[] = [];
        const hardNames: string[] = [];
        const leaderNames: string[] = [];
        let fullData = 0;
        for (const u of active) {
          if (!u.mbti) continue;
          const hasFull = !!(u.mbti && u.club_category && u.hobby_category);
          if (hasFull) fullData++;
          const s = calculateSibyl({ mbti: u.mbti || "", education: u.education || "", club: u.club_category || "", hobby: u.hobby_category || "" });
          const total = s.cog + s.grit + s.social + s.drive + s.create;
          const axes = [s.cog, s.grit, s.social, s.drive, s.create];
          if (total >= TH.leaderTotal && s.grit >= TH.leaderGrit && s.social >= TH.leaderSocial) { leader++; leaderNames.push(u.name); }
          // 育成優先・離職リスクはフルデータ入力者のみ判定（未入力による誤検知を防ぐ）
          if (hasFull && (total <= TH.hardTotal || axes.some((a) => a <= TH.hardAxis))) { hard++; hardNames.push(u.name); }
          if (hasFull && s.grit <= TH.riskGrit && !submitted7.has(u.id)) risk++;
          const top = calculateDepartmentMatch(s, { mbti: u.mbti || "", education: u.education || "" })[0];
          const cur = deptCode[u.department_id] || "";
          const mapped = JOB_TO_DEPT[top?.dept || ""] || "";
          if (top && top.score >= TH.mismatchScore && mapped && cur && mapped !== cur) { mismatch++; mismatchNames.push({ name: u.name, to: JOB_LABEL[top.dept] || top.dept, cur: cur, uid: u.id }); }
        }

        const byDeptTmp: Record<string, { total: number; sub: number }> = {};
        for (const u of active) {
          if ((u as any).exclude_from_stats) continue; // 日報提出率のみ3人除外
          const code = deptCode[u.department_id];
          if (!code) continue;
          byDeptTmp[code] = byDeptTmp[code] || { total: 0, sub: 0 };
          byDeptTmp[code].total++;
          if (submitted7.has(u.id)) byDeptTmp[code].sub++;
        }
        const activeAllIds = new Set(activeAll.map((u: any) => u.id));
        const statAllIds = new Set(statAll.map((u: any) => u.id));
        const submitted7Stat = new Set([...submitted3].filter((id: any) => statAllIds.has(id)));
        const submitRate7 = statAll.length ? Math.round((submitted7Stat.size / statAll.length) * 100) : 0;
        const submitted7All = new Set([...submitted7].filter((id: any) => activeAllIds.has(id)));
        const active7 = new Set((ph7 || []).map((p: any) => p.user_id));
        const active7All = new Set([...active7].filter((id: any) => activeAllIds.has(id)));
        const activeRate = activeAll.length ? Math.round((active7All.size / activeAll.length) * 100) : 0;
        const riskRatio = active.length ? risk / active.length : 0;
        const health = Math.max(0, Math.min(100, Math.round(submitRate7 * 0.4 + activeRate * 0.4 + (1 - riskRatio) * 100 * 0.2)));
        setSibyl({ health, hard, risk, mismatch, leader, total: active.length });

        const props: { icon: string; text: string; uid?: string }[] = [];
        mismatchNames.slice(0, 2).forEach((m: any) => props.push({ icon: "🔄", text: `${m.name}（${m.cur || "所属なし"}）→ ${m.to} が適性1位。異動を検討`, uid: m.uid }));
        if (leaderNames.length > 0) props.push({ icon: "👑", text: `次世代リーダー候補: ${leaderNames.slice(0, 3).join("・")}さん${leaderNames.length > 3 ? `ほか${leaderNames.length - 3}名` : ""}。権限委譲のチャンス` });
        if (hardNames.length > 0) props.push({ icon: "🌱", text: `育成優先: ${hardNames.slice(0, 3).join("・")}さん${hardNames.length > 3 ? `ほか${hardNames.length - 3}名` : ""}。個別フォローを推奨` });
        if (risk > 0) props.push({ icon: "⚠️", text: `離職リスクの高いメンバーが${risk}名。早めの面談を推奨（氏名はシビュラで確認）` });
        if (submitRate7 < 60) props.push({ icon: "📉", text: `日報提出率${submitRate7}%。部署別の内訳を確認してください` });
        const fullRate = active.length ? Math.round((fullData / active.length) * 100) : 0;
        if (fullRate < 50) props.push({ icon: "📝", text: `分析データ入力率${fullRate}%。マイページから部活・趣味の入力を促してください` });
        if (props.length === 0) props.push({ icon: "✅", text: "組織状態は安定しています。現在の運用を継続してください" });
        setProposals(props.slice(0, 4));

        const thanksC = (ph7 || []).filter((p: any) => { const r = p.reason || ""; return r.includes("thanks") || r.includes("サンキュー"); }).length;
        const chalC = (ph7 || []).filter((p: any) => { const r = p.reason || ""; return r.includes("challenge") || r.includes("チャレンジ"); }).length;
        const hiresC = (rec7 || []).filter((r: any) => r.action_type === "hire" && r.status === "approved").length;
        const mentsunaC = (rec7 || []).filter((r: any) => r.action_type === "mentsuna" && r.status === "approved").length;
        setWeek({ submitRate: submitRate7, activeRate, thanks: thanksC, challenges: chalC, hires: hiresC, mentsuna: mentsunaC });

        const byDept: Record<string, { total: number; sub: number }> = {};
        for (const u of activeAll) {
          if ((u as any).exclude_from_stats) continue; // 日報提出率のみ3人除外
          const code = deptCode[u.department_id];
          if (!code) continue;
          byDept[code] = byDept[code] || { total: 0, sub: 0 };
          byDept[code].total++;
          if (submitted3.has(u.id)) byDept[code].sub++;
        }
        setDeptRates(DEPT_ORDER.filter((c) => byDept[c]).map((c) => ({ code: c, rate: Math.round((byDept[c].sub / byDept[c].total) * 100) })));

        setInterviews(ivC || 0);
        setScanTime(now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }));
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const [showNotSubmitted, setShowNotSubmitted] = useState(false);
  const pendingTotal = (stats.pendingTask || 0) + (stats.pendingKkc || 0) + (stats.pendingAdvice || 0) + (stats.pendingMedaka || 0) + (stats.pendingMentor || 0) + (stats.pendingMtg || 0) + (stats.pendingTest || 0) + (stats.pendingRecruit || 0) + (stats.pendingChallenge || 0) + (stats.pendingRequest || 0) + (stats.pendingLearn || 0);
  const rateColor = (v: number) => (v >= 70 ? "#34d399" : v >= 40 ? "#fbbf24" : "#f87171");

  const alerts = [
    { label: "未提出日報", value: stats.notSubmitted, unit: "人", icon: "📋", color: stats.notSubmitted > 0 ? "#f87171" : "#34d399", key: "reports" },
    { label: "昨日の提出率", value: stats.submitRate, unit: "%", icon: "📈", color: rateColor(stats.submitRate), key: "reports" },
  ];

  const weekly = [
    { label: "日報提出率", value: week.submitRate, unit: "%", max: 100, color: rateColor(week.submitRate) },
    { label: "アクティブ率", value: week.activeRate, unit: "%", max: 100, color: rateColor(week.activeRate) },
    { label: "サンキュー", value: week.thanks, unit: "件", max: Math.max(week.thanks, 50), color: "#ec4899" },
  ];

  const healthColor = sibyl.health >= 80 ? "#34d399" : sibyl.health >= 60 ? "#fbbf24" : "#f87171";
  const circ = 2 * Math.PI * 52;

  // ===== 王国統括司令室リデザイン：以下は表示のみ（集計ロジックは上の既存コードのまま） =====
  const [anns, setAnns] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("announcements").select("id,title").eq("is_active", true).order("created_at", { ascending: false }).limit(3);
        setAnns((data || []).map((a: any) => ({ id: a.id, title: a.title })));
      } catch { /* お知らせ機能が無い場合は空表示 */ }
    })();
  }, []);

  // 本日の王国状況（既存の値をそのまま表示）
  const kpis = [
    { label: "日報未提出", value: stats.notSubmitted, unit: "人", icon: "📋", ik: "kpi_report", tone: stats.notSubmitted > 0 ? "red" : "green", onClick: () => setShowNotSubmitted(true) },
    { label: "昨日の提出率", value: stats.submitRate, unit: "%", icon: "📊", ik: "kpi_rate", tone: "blue", onClick: () => onNavigate("reports") },
    { label: "育成優先", value: loading ? null : sibyl.hard, unit: "人", icon: "🌱", ik: "kpi_grow", tone: "pink", onClick: () => onNavigate("sibyl") },
    { label: "配置変更推奨", value: loading ? null : sibyl.mismatch, unit: "人", icon: "🔄", ik: "kpi_move", tone: "gold", onClick: () => onNavigate("sibyl") },
  ];

  // 本日の優先対応（既存の判定結果のみ使用・新ロジックなし）
  const priorities: { pr: "高" | "中" | "低"; icon: string; title: string; desc: string; onClick: () => void }[] = [];
  if (!loading) {
    if (stats.notSubmitted > 0) priorities.push({ pr: "高", icon: "📋", title: "日報未提出のフォロー", desc: `${stats.notSubmitted}名に提出を声かけ`, onClick: () => setShowNotSubmitted(true) });
    if (sibyl.mismatch > 0) priorities.push({ pr: "高", icon: "🔄", title: "配置変更推奨の確認", desc: `${sibyl.mismatch}名の配置変更を検討`, onClick: () => onNavigate("sibyl") });
    if (sibyl.hard > 0) priorities.push({ pr: "中", icon: "🌱", title: "育成優先メンバーのフォロー", desc: `${sibyl.hard}名の育成計画を確認`, onClick: () => onNavigate("sibyl") });
    if (sibyl.leader > 0) priorities.push({ pr: "低", icon: "👑", title: "次世代リーダー候補の育成", desc: `${sibyl.leader}名の進捗を確認`, onClick: () => onNavigate("sibyl") });
  }

  // 管理アクション（既存の未処理カウントのみ）
  const actions = [
    { label: "申請の承認", n: stats.pendingRequest || 0, key: "requests" },
    { label: "FBリクエストの確認", n: stats.pendingFb || 0, key: "fb_requests" },
    { label: "ショップ申請の確認", n: stats.pendingShop || 0, key: "shop" },
    { label: "タスク報告の確認", n: stats.pendingTask || 0, key: "task_management" },
    { label: "MTG報告書の確認", n: stats.pendingMtg || 0, key: "mtg_report" },
    { label: "テスト結果の確認", n: stats.pendingTest || 0, key: "tests" },
    { label: "冒険マップの承認", n: stats.pendingJourney || 0, key: "journey" },
  ].filter((a) => a.n > 0).slice(0, 6);

  const favorites = [
    { icon: "👥", label: "ユーザー一覧", key: "users" },
    { icon: "📋", label: "日報", key: "reports" },
    { icon: "🎯", label: "KPI設定", key: "kpi" },
    { icon: "🛍️", label: "ショップ", key: "shop" },
  ];

  const prColor: Record<string, string> = { 高: "#ef4444", 中: "#f59e0b", 低: "#3b82f6" };
  const toneBg: Record<string, string> = {
    green: "linear-gradient(180deg,#eafcf3,#d7f5e6)", blue: "linear-gradient(180deg,#eaf3fe,#d8e9fc)",
    pink: "linear-gradient(180deg,#fdeef5,#fbdcea)", gold: "linear-gradient(180deg,#fdf6e3,#f8ecc8)", red: "linear-gradient(180deg,#fdecec,#fad7d7)",
  };
  const toneFg: Record<string, string> = { green: "#15803d", blue: "#1454B8", pink: "#be3d7f", gold: "#a16207", red: "#b91c1c" };

  return (
    <div className="ad-root">
      <style>{`
        .ad-root{color:#172B50}
        .ad-grid{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}
        .ad-sec{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(180deg,#2f6ad1,#1454B8);border:2px solid #F5D77E;border-radius:999px;padding:6px 18px;color:#fff;font-size:13.5px;font-weight:900;box-shadow:0 3px 10px rgba(16,47,112,.3);margin-bottom:12px}
        .ad-panel{background:rgba(255,249,237,.95);border:2px solid #D9A441;border-radius:18px;padding:16px 18px;box-shadow:0 6px 18px rgba(16,47,112,.12)}
        .ad-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
        .ad-kpi{border:2px solid rgba(217,164,65,.55);border-radius:16px;padding:14px 12px;text-align:center;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;box-shadow:0 3px 10px rgba(16,47,112,.08)}
        .ad-kpi:hover{transform:translateY(-3px);box-shadow:0 8px 20px rgba(16,47,112,.18)}
        .ad-kpi-ico{font-size:22px}
        .ad-kpi-label{font-size:12px;font-weight:900;margin-top:2px}
        .ad-kpi-val{font-size:34px;font-weight:900;line-height:1.15}
        .ad-kpi-val span{font-size:14px}
        .ad-mid{display:grid;grid-template-columns:1fr 1.35fr;gap:14px;margin-top:18px;align-items:stretch}
        .ad-pri{display:flex;flex-direction:column;gap:9px}
        .ad-pri-row{display:flex;align-items:center;gap:10px;background:#fff;border:1.5px solid rgba(217,164,65,.5);border-radius:13px;padding:11px 13px;cursor:pointer;transition:transform .12s}
        .ad-pri-row:hover{transform:translateX(3px)}
        .ad-pri-chip{flex-shrink:0;width:30px;height:30px;border-radius:9px;color:#fff;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center}
        .ad-pri-t{font-size:13px;font-weight:900}
        .ad-pri-d{font-size:11px;color:#6b5a33;font-weight:700;margin-top:1px}
        .ad-sibyl{position:relative;overflow:hidden;background:linear-gradient(150deg,#f3ecff 0%,#ece0ff 45%,#f8f1ff 100%);border:2px solid #8855D5;border-radius:18px;padding:16px 18px;box-shadow:0 6px 20px rgba(136,85,213,.2)}
        .ad-sibyl-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
        .ad-sibyl-title{font-size:14px;font-weight:900;color:#5a2ea6;letter-spacing:1px}
        .ad-sibyl-meta{font-size:10.5px;font-weight:800;color:#8168b0}
        .ad-sibyl-body{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
        .ad-sibyl-chara{width:110px;flex-shrink:0;filter:drop-shadow(0 8px 10px rgba(90,46,166,.3))}
        .ad-ring{position:relative;width:128px;height:128px;flex-shrink:0;margin:0 auto}
        .ad-mets{flex:1;min-width:190px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .ad-met{background:rgba(255,255,255,.85);border:1.5px solid rgba(136,85,213,.35);border-radius:12px;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;cursor:pointer}
        .ad-met-l{font-size:11px;font-weight:900;color:#5a2ea6}
        .ad-met-v{font-size:17px;font-weight:900}
        .ad-ai{margin-top:12px;background:rgba(255,255,255,.9);border:1.5px solid rgba(136,85,213,.4);border-radius:12px;padding:10px 13px;font-size:12px;font-weight:800;color:#44306b;display:flex;gap:8px;align-items:flex-start;cursor:pointer}
        .ad-sibyl-btn{margin-top:12px;display:inline-block;padding:11px 26px;border-radius:999px;border:2px solid #F5D77E;background:linear-gradient(135deg,#9b6ae0,#7a3fd0);color:#fff;font-size:13.5px;font-weight:900;cursor:pointer;box-shadow:0 5px 16px rgba(122,63,208,.4)}
        .ad-week{margin-top:18px}
        .ad-week-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
        .ad-week-card{border:2px solid rgba(217,164,65,.5);border-radius:14px;padding:12px;text-align:center}
        .ad-week-l{font-size:11.5px;font-weight:900}
        .ad-week-v{font-size:28px;font-weight:900;line-height:1.2}
        .ad-week-v span{font-size:13px}
        .ad-dept{margin-top:14px;background:#fff;border:1.5px solid rgba(217,164,65,.45);border-radius:14px;padding:13px 15px}
        .ad-dept-t{font-size:12.5px;font-weight:900;margin-bottom:9px}
        .ad-dept-row{display:flex;align-items:center;gap:10px;margin-bottom:7px}
        .ad-dept-code{width:30px;font-size:11.5px;font-weight:900;color:#172B50}
        .ad-dept-bar{flex:1;height:11px;border-radius:999px;background:#eee4cc;overflow:hidden}
        .ad-dept-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#34d399,#22B981);transition:width .8s ease}
        .ad-dept-pct{width:42px;text-align:right;font-size:11.5px;font-weight:900}
        .ad-aside{display:flex;flex-direction:column;gap:14px}
        .ad-aside-t{font-size:13px;font-weight:900;color:#172B50;margin-bottom:9px}
        .ad-act{display:flex;align-items:center;gap:8px;background:#fff;border:1.5px solid rgba(217,164,65,.45);border-radius:11px;padding:9px 11px;font-size:12px;font-weight:800;cursor:pointer;margin-bottom:6px}
        .ad-act:hover{border-color:#1454B8}
        .ad-fav{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .ad-fav-b{background:#fff;border:2px solid rgba(217,164,65,.55);border-radius:13px;padding:12px 8px;text-align:center;cursor:pointer;transition:transform .12s}
        .ad-fav-b:hover{transform:translateY(-2px);border-color:#1454B8}
        .ad-fav-i{font-size:21px}
        .ad-fav-l{font-size:11.5px;font-weight:900;margin-top:3px}
        @keyframes adRing{from{stroke-dashoffset:${circ}}}
        @media (max-width: 1080px){ .ad-grid{grid-template-columns:1fr} .ad-mid{grid-template-columns:1fr} }
        @media (max-width: 640px){ .ad-kpis{grid-template-columns:1fr 1fr} .ad-week-grid{grid-template-columns:1fr 1fr} .ad-sibyl-chara{width:84px} }
      `}</style>

      <div className="ad-grid">
        {/* ===== 中央メイン ===== */}
        <div>
          {/* 本日の王国状況 */}
          <div className="ad-sec">🛡️ 本日の王国状況（主要KPI）</div>
          <div className="ad-kpis">
            {kpis.map((k) => (
              <div key={k.label} className="ad-kpi" onClick={k.onClick} style={{ background: toneBg[k.tone === "red" ? "red" : k.tone] }}>
                <div className="ad-kpi-ico"><Ico k={k.ik} emoji={k.icon} size={34} /></div>
                <div className="ad-kpi-label" style={{ color: toneFg[k.tone] }}>{k.label}</div>
                <div className="ad-kpi-val" style={{ color: toneFg[k.tone] }}>{k.value === null ? "…" : k.value}<span>{k.unit}</span></div>
              </div>
            ))}
          </div>

          {/* 優先対応 ＋ SIBYL */}
          <div className="ad-mid">
            <div>
              <div className="ad-sec">🚩 本日の優先対応</div>
              <div className="ad-panel ad-pri">
                {loading ? (
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#8168b0" }}>判定中...</div>
                ) : priorities.length === 0 ? (
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#15803d" }}>✅ 今日の優先対応はありません</div>
                ) : priorities.slice(0, 4).map((p) => (
                  <div key={p.title} className="ad-pri-row" onClick={p.onClick}>
                    <span className="ad-pri-chip" style={{ background: prColor[p.pr] }}>{p.pr}</span>
                    <span style={{ fontSize: 18 }}>{p.icon}</span>
                    <span style={{ flex: 1 }}>
                      <div className="ad-pri-t">{p.title}</div>
                      <div className="ad-pri-d">{p.desc}</div>
                    </span>
                    <span style={{ color: "#D9A441", fontWeight: 900 }}>›</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="ad-sec" style={{ background: "linear-gradient(180deg,#9b6ae0,#7a3fd0)" }}><Ico k="crystal" emoji="🔮" size={20} /> SIBYL SYSTEM（シビュラ）</div>
              <div className="ad-sibyl">
                <div className="ad-sibyl-head">
                  <span className="ad-sibyl-title">組織分析AI</span>
                  <span className="ad-sibyl-meta">{loading ? "SCANNING..." : `最終分析 ${scanTime}｜対象 ${sibyl.total}名`}</span>
                </div>
                <div className="ad-sibyl-body">
                  <img className="ad-sibyl-chara" src="/jobs/mage.webp" alt="" />
                  <div className="ad-ring">
                    <svg width="128" height="128" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx="64" cy="64" r="52" fill="none" stroke="rgba(136,85,213,.18)" strokeWidth="11" />
                      <circle cx="64" cy="64" r="52" fill="none" stroke={healthColor} strokeWidth="11" strokeLinecap="round"
                        strokeDasharray={circ} strokeDashoffset={loading ? circ : circ * (1 - sibyl.health / 100)}
                        style={{ transition: "stroke-dashoffset 1.2s ease", animation: "adRing 1.2s ease" }} />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ fontSize: 27, fontWeight: 900, color: "#5a2ea6", lineHeight: 1 }}>{loading ? "…" : sibyl.health}<span style={{ fontSize: 13 }}>%</span></div>
                      <div style={{ fontSize: 9.5, fontWeight: 900, color: "#8168b0", marginTop: 3 }}>組織健全度</div>
                    </div>
                  </div>
                  <div className="ad-mets">
                    {[
                      { label: "育成優先", value: sibyl.hard, color: "#e11d48" },
                      { label: "離職リスク", value: sibyl.risk, color: "#b91c1c" },
                      { label: "配置変更推奨", value: sibyl.mismatch, color: "#a16207" },
                      { label: "次世代リーダー候補", value: sibyl.leader, color: "#15803d" },
                    ].map((m) => (
                      <div key={m.label} className="ad-met" onClick={() => onNavigate("sibyl")}>
                        <span className="ad-met-l">{m.label}</span>
                        <span className="ad-met-v" style={{ color: m.color }}>{loading ? "…" : m.value}<span style={{ fontSize: 11 }}>人</span></span>
                      </div>
                    ))}
                  </div>
                </div>
                {!loading && proposals[0] && (
                  <div className="ad-ai" onClick={() => { if (proposals[0].uid) window.location.href = `/admin/sibyl/${proposals[0].uid}`; }}>
                    <span>⭐</span>
                    <span style={{ flex: 1 }}><b>AI提案（抜粋）</b><br />{proposals[0].icon} {proposals[0].text}</span>
                    {proposals[0].uid && <span style={{ color: "#7a3fd0" }}>›</span>}
                  </div>
                )}
                <button className="ad-sibyl-btn" onClick={() => onNavigate("sibyl")}>シビュラの詳細を見る →</button>
              </div>
            </div>
          </div>

          {/* WEEKLY SUMMARY */}
          <div className="ad-week">
            <div className="ad-sec">🏅 WEEKLY SUMMARY（直近3日）</div>
            <div className="ad-panel">
              <div className="ad-week-grid">
                {[
                  { label: "日報提出率", v: week.submitRate, unit: "%", tone: "green", icon: "📋" },
                  { label: "アクティブ率", v: week.activeRate, unit: "%", tone: "blue", icon: "👥" },
                  { label: "サンキュー", v: week.thanks, unit: "件", tone: "pink", icon: "💗" },
                ].map((c) => (
                  <div key={c.label} className="ad-week-card" style={{ background: toneBg[c.tone] }}>
                    <div style={{ fontSize: 19 }}>{c.icon}</div>
                    <div className="ad-week-l" style={{ color: toneFg[c.tone] }}>{c.label}</div>
                    <div className="ad-week-v" style={{ color: toneFg[c.tone] }}>{loading ? "…" : c.v}<span>{c.unit}</span></div>
                  </div>
                ))}
              </div>
              <div className="ad-dept">
                <div className="ad-dept-t">部署別 日報提出率</div>
                {(loading ? [] : deptRates).map((d) => (
                  <div key={d.code} className="ad-dept-row">
                    <span className="ad-dept-code">{d.code}</span>
                    <div className="ad-dept-bar"><div className="ad-dept-fill" style={{ width: `${d.rate}%`, background: `linear-gradient(90deg, ${rateColor(d.rate)}, ${rateColor(d.rate)}cc)` }} /></div>
                    <span className="ad-dept-pct" style={{ color: rateColor(d.rate) }}>{d.rate}%</span>
                  </div>
                ))}
                {loading && <div style={{ fontSize: 12, color: "#8b7b4f", fontWeight: 700 }}>集計中...</div>}
              </div>
            </div>
          </div>
        </div>

        {/* ===== 右サイドパネル ===== */}
        <div className="ad-aside">
          <div className="ad-panel">
            <div className="ad-aside-t"><Ico k="bell" emoji="⚡" size={22} /> 管理アクション</div>
            {actions.length === 0 ? (
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "#15803d" }}>✅ 未処理の承認はありません</div>
            ) : actions.map((a) => (
              <div key={a.key + a.label} className="ad-act" onClick={() => onNavigate(a.key)}>
                <span style={{ color: "#22B981" }}>●</span>
                <span style={{ flex: 1 }}>{a.label}（{a.n}件）</span>
                <span style={{ color: "#D9A441", fontWeight: 900 }}>›</span>
              </div>
            ))}
          </div>

          <div className="ad-panel">
            <div className="ad-aside-t"><Ico k="horn" emoji="📣" size={22} /> お知らせ</div>
            {anns.length === 0 ? (
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8b7b4f" }}>お知らせはありません</div>
            ) : anns.map((a) => (
              <div key={a.id} className="ad-act" onClick={() => onNavigate("announce")}>
                <span style={{ color: "#D9A441" }}>⭐</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
                <span style={{ color: "#D9A441", fontWeight: 900 }}>›</span>
              </div>
            ))}
            <div onClick={() => onNavigate("announce")} style={{ textAlign: "center", fontSize: 12, fontWeight: 900, color: "#1454B8", cursor: "pointer", marginTop: 4 }}>すべて見る →</div>
          </div>

          <div className="ad-panel">
            <div className="ad-aside-t">⭐ よく使う機能</div>
            <div className="ad-fav">
              {favorites.map((f) => (
                <div key={f.key} className="ad-fav-b" onClick={() => onNavigate(f.key)}>
                  <div className="ad-fav-i">{f.icon}</div>
                  <div className="ad-fav-l">{f.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 未提出者モーダル（機能そのまま・配色のみ王国風） */}
      {showNotSubmitted && (
        <div onClick={() => setShowNotSubmitted(false)} style={{ position: "fixed", inset: 0, background: "rgba(16,47,112,.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#FFF9ED", border: "2px solid #D9A441", borderRadius: 18, padding: 26, width: "100%", maxWidth: 440, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 18px 50px rgba(16,47,112,.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#172B50" }}>📋 日報 未提出者</div>
              <button onClick={() => setShowNotSubmitted(false)} style={{ background: "none", border: "none", color: "#8b7b4f", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: "#6b5a33", fontWeight: 700, marginBottom: 14 }}>直近3日間（今日・昨日・一昨日）に1回も提出がない {notSubmittedList.length}名</div>
            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {notSubmittedList.length === 0 ? (
                <div style={{ fontSize: 13, color: "#15803d", fontWeight: 800, padding: "12px 0" }}>✅ 全員提出済みです</div>
              ) : notSubmittedList.map((u, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "#fff", border: "1px solid rgba(217,164,65,.4)" }}>
                  <span style={{ fontSize: 11, color: "#8b7b4f", width: 20 }}>{i + 1}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#172B50", flex: 1 }}>{u.name}</span>
                </div>
              ))}
            </div>
            {notSubmittedList.length > 0 && (
              <button onClick={() => { navigator.clipboard.writeText(notSubmittedList.map((u) => `・${u.name}`).join("\n")); }} style={{ marginTop: 14, padding: "11px", borderRadius: 999, border: "2px solid #F5D77E", background: "linear-gradient(180deg,#2f6ad1,#1454B8)", color: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer" }}>
                📋 名前リストをコピー
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
