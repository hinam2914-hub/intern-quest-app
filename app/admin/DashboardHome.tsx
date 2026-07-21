"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { calculateSibyl, calculateDepartmentMatch } from "../lib/sibyl";

/* ===== 判定しきい値（調整はここ） ===== */
const TH = {
  leaderTotal: 60, leaderGrit: 10, leaderSocial: 10,
  hardTotal: 30, hardAxis: 3,
  riskGrit: 7,
  mismatchScore: 70,
};
const JOB_TO_DEPT: Record<string, string> = { "訪販": "IP", "テレアポ": "CB", "クローザー": "CB", "人事": "HR" };
const JOB_LABEL: Record<string, string> = { "訪販": "訪販(IP)", "テレアポ": "テレアポ(CB)", "クローザー": "クローザー(CB)", "人事": "人事(HR)", "管理マネージャー": "管理マネージャー" };
const DEPT_ORDER = ["IP", "CB", "SP", "HR", "MK"];

type Stats = {
  notSubmitted: number; submitRate: number; pendingCount: number; userCount: number;
  pendingTask?: number; pendingKkc?: number; pendingAdvice?: number; pendingMedaka?: number;
  pendingMentor?: number; pendingMtg?: number; pendingTest?: number; pendingRecruit?: number; pendingChallenge?: number; pendingRequest?: number; pendingQuestion?: number; pendingMgrTest?: number;
};
type Card = { key: string; icon: string; title: string; desc?: string; badgeKey?: keyof Stats };

const QUICK: Card[] = [
  { key: "users", icon: "🧑", title: "ユーザー一覧", desc: "メンバーの詳細と管理" },
  { key: "teams", icon: "👨‍👩‍👧", title: "チーム管理", desc: "チーム編成" },
  { key: "reports", icon: "📋", title: "日報", desc: "確認と評価", badgeKey: "pendingCount" },
  { key: "schedule", icon: "🗓️", title: "スケジュール", desc: "予定の管理" },
  { key: "task_management", icon: "✅", title: "タスク管理", desc: "配布と確認", badgeKey: "pendingTask" },
  { key: "recruit", icon: "🔥", title: "HRキャンペーン承認", desc: "採用アクション承認", badgeKey: "pendingRecruit" },
  { key: "kpi", icon: "🎯", title: "KPI設定", desc: "KPI項目の設定" },
  { key: "monthly_kpi", icon: "📈", title: "月次KPI", desc: "月次の進捗" },
  { key: "sibyl", icon: "🔮", title: "シビュラ", desc: "AI適性分析" },
  { key: "course", icon: "🎓", title: "講座スタンプ", desc: "受講・講師の承認" },
  { key: "sibyl_guide", icon: "📖", title: "シビュラの見方", desc: "5軸・ランク・配属ルール" },
];

const OTHERS: { label: string; cards: Card[] }[] = [
  { label: "承認・申請", cards: [
    { key: "requests", icon: "📮", title: "各種申請", badgeKey: "pendingRequest" },
    { key: "mtg_report", icon: "📝", title: "MTG報告書", badgeKey: "pendingMtg" },
    { key: "mentor_report", icon: "🧑‍🏫", title: "ペイフォワード", badgeKey: "pendingMentor" },
    { key: "advice", icon: "💡", title: "アドバイス", badgeKey: "pendingAdvice" },
    { key: "kkc", icon: "🧩", title: "KKC", badgeKey: "pendingKkc" },
    { key: "tests", icon: "🧪", title: "テスト結果", badgeKey: "pendingTest" },
    { key: "report_eval", icon: "⭐", title: "日報評価" },
  ]},
  { label: "コミュニティ", cards: [
    { key: "announce", icon: "📢", title: "お知らせ" },
    { key: "thinking_manage", icon: "🧠", title: "思考クエスト" },
    { key: "survey", icon: "📊", title: "アンケート" },
    { key: "medaka_manage", icon: "🐟", title: "メダカBOX", badgeKey: "pendingMedaka" },
    { key: "thanks_history", icon: "💌", title: "サンキュー" },
    { key: "badge", icon: "🎖️", title: "バッジ" },
  ]},
  { label: "コンテンツ・データ", cards: [
    { key: "contents", icon: "🎓", title: "学習コンテンツ" },
    { key: "resources", icon: "🗂️", title: "資料管理" },
    { key: "wiki", icon: "📖", title: "用語集" },
    { key: "shop", icon: "🛍️", title: "ショップ" },
    { key: "career", icon: "🧭", title: "就活ボックス" },
    { key: "companies", icon: "🏢", title: "企業管理" },
    { key: "es", icon: "🧾", title: "総合ES" },
    { key: "roadmap", icon: "🗺️", title: "ロードマップ" },
    { key: "challenges", icon: "🏔️", title: "チャレンジ", badgeKey: "pendingChallenge" },
    { key: "talent_archive", icon: "📇", title: "人材アーカイブ" },
    { key: "sales", icon: "💰", title: "売上管理" },
  ]},
];

export default function DashboardHome({ stats, onNavigate }: { stats: Stats; onNavigate: (key: string) => void }) {
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

        const [{ data: profs }, { data: depts }, { data: subs7 }, { data: ph7 }, { data: rec7 }, { count: ivC }] = await Promise.all([
          supabase.from("profiles").select("id,name,mbti,education,club_category,hobby_category,department_id"),
          supabase.from("departments").select("id,code"),
          supabase.from("submissions").select("user_id").gte("created_at", d7),
          supabase.from("points_history").select("user_id,reason").gte("created_at", d7),
          supabase.from("recruit_progress").select("action_type,status").gte("created_at", d7),
          supabase.from("interview_requests").select("*", { count: "exact", head: true }).eq("status", "open"),
        ]);

        const active = profs || [];
        const deptCode: Record<string, string> = {};
        (depts || []).forEach((d: any) => { deptCode[d.id] = d.code; });
        const submitted7 = new Set((subs7 || []).map((s: any) => s.user_id));

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
          const code = deptCode[u.department_id];
          if (!code) continue;
          byDeptTmp[code] = byDeptTmp[code] || { total: 0, sub: 0 };
          byDeptTmp[code].total++;
          if (submitted7.has(u.id)) byDeptTmp[code].sub++;
        }
        const submitRate7 = active.length ? Math.round((submitted7.size / active.length) * 100) : 0;
        const active7 = new Set((ph7 || []).map((p: any) => p.user_id));
        const activeRate = active.length ? Math.round((active7.size / active.length) * 100) : 0;
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
        for (const u of active) {
          const code = deptCode[u.department_id];
          if (!code) continue;
          byDept[code] = byDept[code] || { total: 0, sub: 0 };
          byDept[code].total++;
          if (submitted7.has(u.id)) byDept[code].sub++;
        }
        setDeptRates(DEPT_ORDER.filter((c) => byDept[c]).map((c) => ({ code: c, rate: Math.round((byDept[c].sub / byDept[c].total) * 100) })));

        setInterviews(ivC || 0);
        setScanTime(now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }));
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const pendingTotal = (stats.pendingTask || 0) + (stats.pendingKkc || 0) + (stats.pendingAdvice || 0) + (stats.pendingMedaka || 0) + (stats.pendingMentor || 0) + (stats.pendingMtg || 0) + (stats.pendingTest || 0) + (stats.pendingRecruit || 0) + (stats.pendingChallenge || 0) + (stats.pendingRequest || 0);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <style>{`
        @keyframes scanline { 0% { top: -8% } 100% { top: 108% } }
        @keyframes blink { 0%,100% { opacity: .4 } 50% { opacity: 1 } }
        @keyframes ringIn { from { stroke-dashoffset: ${circ} } }
        .dh-card { transition: all .18s ease; }
        .dh-card:hover { border-color: rgba(139,92,246,.55) !important; box-shadow: 0 0 22px rgba(139,92,246,.16); transform: translateY(-2px); }
      `}</style>

      {/* ① TODAY'S ALERT */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, color: "#8b8fa8", marginBottom: 12 }}>⚡ TODAY'S ALERT</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
          {alerts.map((a) => (
            <div key={a.label} className="dh-card" onClick={() => onNavigate(a.key)} style={{ cursor: "pointer", padding: "18px 20px", borderRadius: 16, background: "linear-gradient(160deg, rgba(30,30,52,.92), rgba(14,14,28,.92))", border: `1px solid ${a.color}33`, borderLeft: `3px solid ${a.color}` }}>
              <div style={{ fontSize: 12, color: "#8b8fa8", fontWeight: 700, marginBottom: 8 }}>{a.icon} {a.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 900, color: a.color, lineHeight: 1 }}>{a.value}</span>
                <span style={{ fontSize: 13, color: "#8b8fa8", fontWeight: 700 }}>{a.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ② SIBYL SYSTEM */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 24, padding: "28px 30px", background: "linear-gradient(135deg, rgba(49,32,95,.95), rgba(16,14,42,.98) 55%, rgba(8,8,22,1))", border: "1.5px solid rgba(139,92,246,.4)", boxShadow: "0 0 50px rgba(99,102,241,.15)" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(139,92,246,.65), transparent)", animation: "scanline 5s linear infinite", pointerEvents: "none" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 5, color: "#a78bfa" }}>🔮 SIBYL SYSTEM</div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 10, fontWeight: 700, color: "#8b8fa8" }}>
            <span style={{ color: "#34d399", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", animation: "blink 1.6s infinite", display: "inline-block" }} />
              {loading ? "SCANNING..." : "ANALYSIS ACTIVE"}
            </span>
            {!loading && <span>LAST SCAN {scanTime} ／ 対象 {sibyl.total}名</span>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 26, flexWrap: "wrap", alignItems: "center", marginBottom: 22 }}>
          {/* 組織健全度リング */}
          <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
            <svg width="130" height="130" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="65" cy="65" r="52" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="10" />
              <circle cx="65" cy="65" r="52" fill="none" stroke={healthColor} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={loading ? circ : circ * (1 - sibyl.health / 100)}
                style={{ transition: "stroke-dashoffset 1.2s ease", animation: "ringIn 1.2s ease" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: healthColor, lineHeight: 1 }}>{loading ? "…" : sibyl.health}<span style={{ fontSize: 14 }}>%</span></div>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: "#8b8fa8", marginTop: 4, letterSpacing: 1 }}>組織健全度</div>
            </div>
          </div>
          {/* メトリクス */}
          <div style={{ flex: 1, minWidth: 260, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
            {[
              { label: "育成優先メンバー", value: sibyl.hard, color: "#f87171" },
              { label: "離職リスク", value: sibyl.risk, color: "#ef4444" },
              { label: "配属変更推奨", value: sibyl.mismatch, color: "#fbbf24" },
              { label: "次世代リーダー候補", value: sibyl.leader, color: "#34d399" },
            ].map((m) => (
              <div key={m.label} style={{ padding: "14px 12px", borderRadius: 14, background: "rgba(255,255,255,.04)", border: "1px solid rgba(139,92,246,.2)", textAlign: "center" }}>
                <div style={{ fontSize: 30, fontWeight: 900, color: m.color, lineHeight: 1 }}>{loading ? "…" : m.value}<span style={{ fontSize: 12 }}>人</span></div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#a5a8c0", marginTop: 7 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#8b8fa8", marginBottom: 10 }}>💬 AI PROPOSAL</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {loading ? (
              <div style={{ padding: "11px 16px", borderRadius: 10, background: "rgba(139,92,246,.1)", border: "1px solid rgba(139,92,246,.25)", fontSize: 13.5, fontWeight: 600, color: "#e0d9ff" }}>▸ 組織をスキャンしています...</div>
            ) : proposals.map((p, i) => (
              <div key={i} onClick={() => { if (p.uid) window.location.href = `/admin/sibyl/${p.uid}`; }} style={{ padding: "11px 16px", borderRadius: 10, background: "rgba(139,92,246,.1)", border: "1px solid rgba(139,92,246,.25)", fontSize: 13.5, fontWeight: 600, color: "#e0d9ff", cursor: p.uid ? "pointer" : "default", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span>{p.icon}</span><span style={{ flex: 1 }}>{p.text}</span>{p.uid && <span style={{ fontSize: 11, color: "#a78bfa" }}>詳細 →</span>}
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => onNavigate("sibyl")} style={{ padding: "13px 36px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 15, fontWeight: 900, color: "#fff", background: "linear-gradient(135deg, #8b5cf6, #6366f1)", boxShadow: "0 4px 20px rgba(139,92,246,.4)" }}>🔮 シビュラシステムを開く →</button>
      </div>

      {/* ③ WEEKLY SUMMARY */}
      <div style={{ borderRadius: 20, padding: "24px 26px", background: "rgba(18,18,36,.85)", border: "1px solid rgba(255,255,255,.07)" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, color: "#8b8fa8", marginBottom: 16 }}>📊 WEEKLY SUMMARY（直近7日）</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px 26px", marginBottom: 22 }}>
          {weekly.map((b) => (
            <div key={b.label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                <span style={{ color: "#c7c9dd" }}>{b.label}</span>
                <span style={{ color: b.color }}>{loading ? "…" : b.value}{b.unit}</span>
              </div>
              <div style={{ height: 7, borderRadius: 999, background: "rgba(255,255,255,.06)" }}>
                <div style={{ height: "100%", width: `${loading ? 0 : Math.min(100, (b.value / b.max) * 100)}%`, borderRadius: 999, background: `linear-gradient(90deg, ${b.color}, ${b.color}88)`, transition: "width .8s ease" }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#8b8fa8", marginBottom: 12 }}>部署別 日報提出率</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {(loading ? [] : deptRates).map((d) => (
            <div key={d.code} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 34, fontSize: 12, fontWeight: 900, color: "#c7c9dd" }}>{d.code}</span>
              <div style={{ flex: 1, height: 12, borderRadius: 999, background: "rgba(255,255,255,.06)" }}>
                <div style={{ height: "100%", width: `${d.rate}%`, borderRadius: 999, background: `linear-gradient(90deg, ${rateColor(d.rate)}, ${rateColor(d.rate)}88)`, transition: "width .8s ease" }} />
              </div>
              <span style={{ width: 42, textAlign: "right", fontSize: 12, fontWeight: 900, color: rateColor(d.rate) }}>{d.rate}%</span>
            </div>
          ))}
          {loading && <div style={{ fontSize: 12, color: "#6b7280" }}>集計中...</div>}
        </div>
      </div>

      {/* ④ QUICK ACCESS */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, color: "#8b8fa8", marginBottom: 12 }}>🚀 QUICK ACCESS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
          {QUICK.map((c) => {
            const badge = c.badgeKey ? (stats[c.badgeKey] as number) || 0 : 0;
            return (
              <div key={c.key} className="dh-card" onClick={() => onNavigate(c.key)} style={{ position: "relative", cursor: "pointer", padding: "18px 20px", borderRadius: 16, background: "linear-gradient(160deg, rgba(30,30,52,.85), rgba(16,16,32,.85))", border: "1px solid rgba(255,255,255,.08)" }}>
                {badge > 0 && <span style={{ position: "absolute", top: 12, right: 12, minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</span>}
                <div style={{ fontSize: 26, marginBottom: 8 }}>{c.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{c.title}</div>
                {c.desc && <div style={{ fontSize: 11, color: "#8b8fa8", marginTop: 3 }}>{c.desc}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ⑤ OTHER TOOLS */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, color: "#8b8fa8", marginBottom: 12 }}>🧰 OTHER TOOLS</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {OTHERS.map((sec) => {
            const open = !!openSec[sec.label];
            const secBadge = sec.cards.reduce((sum, c) => sum + (c.badgeKey ? (stats[c.badgeKey] as number) || 0 : 0), 0);
            return (
              <div key={sec.label} style={{ borderRadius: 14, background: "rgba(18,18,36,.7)", border: "1px solid rgba(255,255,255,.06)", overflow: "hidden" }}>
                <div onClick={() => setOpenSec((o) => ({ ...o, [sec.label]: !o[sec.label] }))} style={{ cursor: "pointer", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#c7c9dd" }}>
                    {sec.label}
                    {secBadge > 0 && <span style={{ marginLeft: 8, padding: "1px 8px", borderRadius: 999, background: "#ef4444", color: "#fff", fontSize: 10.5, fontWeight: 800 }}>{secBadge}</span>}
                  </span>
                  <span style={{ fontSize: 12, color: "#8b8fa8", transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }}>▶</span>
                </div>
                {open && (
                  <div style={{ padding: "0 14px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                    {sec.cards.map((c) => {
                      const badge = c.badgeKey ? (stats[c.badgeKey] as number) || 0 : 0;
                      return (
                        <div key={c.key} className="dh-card" onClick={() => onNavigate(c.key)} style={{ position: "relative", cursor: "pointer", padding: "11px 13px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 9 }}>
                          <span style={{ fontSize: 16 }}>{c.icon}</span>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#d5d7e8" }}>{c.title}</span>
                          {badge > 0 && <span style={{ marginLeft: "auto", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
