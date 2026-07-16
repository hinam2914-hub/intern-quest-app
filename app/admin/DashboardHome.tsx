"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { calculateSibyl, calculateDepartmentMatch } from "../lib/sibyl";

/* ===== 判定しきい値（調整はここ） ===== */
const TH = {
  leaderTotal: 60,      // リーダー候補: 5軸合計
  leaderGrit: 10,       //   かつ胆力
  leaderSocial: 10,     //   かつ対人
  hardTotal: 30,        // 育成難易度S: 合計これ以下
  hardAxis: 3,          //   または1軸でもこれ以下
  riskGrit: 7,          // 離職リスク: 胆力これ以下かつ7日提出なし
  mismatchScore: 70,    // ミスマッチ: 1位適性スコアがこれ以上で他部署
};
const JOB_TO_DEPT: Record<string, string> = {
  "IP": "IP", "クローザー": "CB", "テレアポ": "CB", "人事": "HR", "マーケ": "MK", "コンサル": "SP",
};

type Stats = {
  notSubmitted: number; submitRate: number; pendingCount: number; userCount: number;
  pendingTask?: number; pendingKkc?: number; pendingAdvice?: number; pendingMedaka?: number;
  pendingMentor?: number; pendingMtg?: number; pendingTest?: number; pendingRecruit?: number;
};
type Card = { key: string; icon: string; title: string; desc: string; badgeKey?: keyof Stats; soon?: boolean };

const CATEGORIES: { label: string; icon: string; cards: Card[] }[] = [
  { label: "メンバー管理", icon: "👥", cards: [
    { key: "users", icon: "🧑", title: "ユーザー一覧", desc: "メンバーの一覧と詳細" },
    { key: "teams", icon: "👨‍👩‍👧", title: "チーム管理", desc: "チームの作成と管理" },
    { key: "talent_archive", icon: "📇", title: "人材アーカイブ", desc: "過去のメンバー管理" },
    { key: "sibyl", icon: "🔮", title: "シビュラ", desc: "AI分析と適性診断" },
  ]},
  { label: "業務管理", icon: "💼", cards: [
    { key: "reports", icon: "📋", title: "日報", desc: "日報の確認と評価", badgeKey: "pendingCount" },
    { key: "schedule", icon: "🗓️", title: "スケジュール", desc: "予定の確認と管理" },
    { key: "mtg_report", icon: "📝", title: "MTG報告書", desc: "MTG報告の承認", badgeKey: "pendingMtg" },
    { key: "task_management", icon: "✅", title: "タスク管理", desc: "タスクの配布と確認", badgeKey: "pendingTask" },
    { key: "es", icon: "🧾", title: "総合ES", desc: "ES回答の確認" },
    { key: "roadmap", icon: "🗺️", title: "ロードマップ", desc: "成長ロードマップ管理" },
    { key: "tests", icon: "🧪", title: "テスト結果", desc: "各種テストの採点", badgeKey: "pendingTest" },
    { key: "challenges", icon: "🏔️", title: "チャレンジ", desc: "ライフチャレンジ管理" },
  ]},
  { label: "コミュニティ", icon: "🌱", cards: [
    { key: "announce", icon: "📢", title: "お知らせ", desc: "全体告知の配信" },
    { key: "survey", icon: "📊", title: "アンケート", desc: "アンケートの作成と集計" },
    { key: "advice", icon: "💡", title: "アドバイス", desc: "AIアドバイス承認", badgeKey: "pendingAdvice" },
    { key: "questions_box", icon: "❓", title: "質問Quest", desc: "質問への回答管理" },
    { key: "medaka_manage", icon: "🐟", title: "メダカBOX", desc: "匿名意見への対応", badgeKey: "pendingMedaka" },
    { key: "kkc", icon: "🧩", title: "KKC", desc: "課題解決の承認", badgeKey: "pendingKkc" },
    { key: "thanks_history", icon: "💌", title: "ペイフォワード", desc: "サンキュー履歴" },
    { key: "badge", icon: "🎖️", title: "バッジ", desc: "バッジの作成と付与" },
  ]},
  { label: "コンテンツ管理", icon: "📚", cards: [
    { key: "contents", icon: "🎓", title: "学習コンテンツ", desc: "学習教材の管理" },
    { key: "resources", icon: "🗂️", title: "資料管理", desc: "共有資料の管理" },
    { key: "wiki", icon: "📖", title: "用語集", desc: "社内用語の管理" },
    { key: "shop", icon: "🛍️", title: "ショップ", desc: "ポイント景品の管理" },
    { key: "career", icon: "🧭", title: "就活ボックス", desc: "就活支援の管理" },
    { key: "companies", icon: "🏢", title: "企業管理", desc: "企業データの管理" },
  ]},
  { label: "申請・承認", icon: "📮", cards: [
    { key: "requests", icon: "📮", title: "各種申請", desc: "申請の承認と管理" },
    { key: "recruit", icon: "🔥", title: "HRキャンペーン承認", desc: "採用アクションの承認", badgeKey: "pendingRecruit" },
    { key: "mentor_report", icon: "🧑‍🏫", title: "メンター報告", desc: "メンター活動の承認", badgeKey: "pendingMentor" },
    { key: "manager_test", icon: "👔", title: "マネージャーテスト", desc: "受験の承認と採点" },
    { key: "report_eval", icon: "⭐", title: "日報評価", desc: "日報のAI評価管理" },
    { key: "sales", icon: "💰", title: "売上管理", desc: "売上の記録と集計" },
  ]},
  { label: "システム管理", icon: "⚙️", cards: [
    { key: "kpi", icon: "🎯", title: "KPI設定", desc: "KPI項目の設定" },
    { key: "monthly_kpi", icon: "📈", title: "月次KPI", desc: "月次KPIの管理" },
    { key: "_perm", icon: "🔐", title: "権限管理", desc: "準備中", soon: true },
    { key: "_log", icon: "🧾", title: "ログ管理", desc: "準備中", soon: true },
    { key: "_export", icon: "📤", title: "データエクスポート", desc: "準備中", soon: true },
    { key: "_backup", icon: "💾", title: "バックアップ", desc: "準備中", soon: true },
  ]},
];

export default function DashboardHome({ stats, onNavigate }: { stats: Stats; onNavigate: (key: string) => void }) {
  const [sibyl, setSibyl] = useState({ mismatch: 0, hard: 0, risk: 0, leader: 0, analyzed: 0, total: 0 });
  const [proposals, setProposals] = useState<string[]>([]);
  const [week, setWeek] = useState({ submitRate: 0, activeRate: 0, hires: 0, thanks: 0, challenges: 0 });
  const [interviews, setInterviews] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();

        const [{ data: profs }, { data: depts }, { data: subs7 }, { data: ph7 }, { count: hireC }, { count: ivC }] = await Promise.all([
          supabase.from("profiles").select("id,name,mbti,education,club_category,hobby_category,department_id,status"),
          supabase.from("departments").select("id,code"),
          supabase.from("submissions").select("user_id").gte("created_at", d7),
          supabase.from("points_history").select("user_id,reason").gte("created_at", d7),
          supabase.from("recruit_progress").select("*", { count: "exact", head: true }).eq("action_type", "hire").eq("status", "approved").gte("created_at", d7),
          supabase.from("interview_requests").select("*", { count: "exact", head: true }).eq("status", "open"),
        ]);

        const active = (profs || []).filter((p: any) => p.status !== "retired" && p.status !== "退職");
        const deptCode: Record<string, string> = {};
        (depts || []).forEach((d: any) => { deptCode[d.id] = d.code; });
        const submitted7 = new Set((subs7 || []).map((s: any) => s.user_id));

        let mismatch = 0, hard = 0, risk = 0, leader = 0, analyzed = 0;
        for (const u of active) {
          if (!u.mbti) continue;
          analyzed++;
          const s = calculateSibyl({ mbti: u.mbti || "", education: u.education || "", club: u.club_category || "", hobby: u.hobby_category || "" });
          const total = s.cog + s.grit + s.social + s.drive + s.create;
          const axes = [s.cog, s.grit, s.social, s.drive, s.create];
          if (total >= TH.leaderTotal && s.grit >= TH.leaderGrit && s.social >= TH.leaderSocial) leader++;
          if (total <= TH.hardTotal || axes.some((a) => a <= TH.hardAxis)) hard++;
          if (s.grit <= TH.riskGrit && !submitted7.has(u.id)) risk++;
          const top = calculateDepartmentMatch(s)[0];
          const cur = deptCode[u.department_id] || "";
          const mapped = JOB_TO_DEPT[top?.dept || ""] || "";
          if (top && top.score >= TH.mismatchScore && mapped && cur && mapped !== cur) mismatch++;
        }
        setSibyl({ mismatch, hard, risk, leader, analyzed: active.length ? Math.round((analyzed / active.length) * 100) : 0, total: active.length });

        const props: string[] = [];
        if (mismatch > 0) props.push(`配属ミスマッチが${mismatch}名。配置転換の検討を推奨します`);
        if (hard > 0) props.push(`育成優先メンバーが${hard}名います。個別フォローを推奨します`);
        if (risk > 0) props.push(`離職リスクの高いメンバーが${risk}名。今週の面談を推奨します`);
        if (leader > 0) props.push(`次世代リーダー候補が${leader}名。権限委譲のチャンスです`);
        if (props.length === 0) props.push("組織状態は安定しています。現在の運用を継続してください");
        setProposals(props.slice(0, 3));

        const active7 = new Set((ph7 || []).map((p: any) => p.user_id));
        const thanksC = (ph7 || []).filter((p: any) => (p.reason || "").includes("サンキュー")).length;
        const chalC = (ph7 || []).filter((p: any) => (p.reason || "").includes("チャレンジ")).length;
        setWeek({
          submitRate: active.length ? Math.round((submitted7.size / active.length) * 100) : 0,
          activeRate: active.length ? Math.round((active7.size / active.length) * 100) : 0,
          hires: hireC || 0, thanks: thanksC, challenges: chalC,
        });
        setInterviews(ivC || 0);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const pendingTotal = (stats.pendingTask || 0) + (stats.pendingKkc || 0) + (stats.pendingAdvice || 0) + (stats.pendingMedaka || 0) + (stats.pendingMentor || 0) + (stats.pendingMtg || 0) + (stats.pendingTest || 0) + (stats.pendingRecruit || 0);

  const alerts = [
    { label: "未提出日報", value: stats.notSubmitted, unit: "人", icon: "📋", color: "#f87171", key: "reports" },
    { label: "昨日の提出率", value: stats.submitRate, unit: "%", icon: "📈", color: "#34d399", key: "reports" },
    { label: "承認待ち申請", value: pendingTotal, unit: "件", icon: "⏳", color: "#fbbf24", key: "requests" },
    { label: "面談予定", value: interviews, unit: "件", icon: "🤝", color: "#818cf8", key: "recruit" },
  ];

  const bars = [
    { label: "日報提出率（7日）", value: week.submitRate, max: 100, unit: "%", color: "#6366f1" },
    { label: "アクティブ率（7日）", value: week.activeRate, max: 100, unit: "%", color: "#34d399" },
    { label: "採用数（7日）", value: week.hires, max: Math.max(week.hires, 5), unit: "人", color: "#f59e0b" },
    { label: "サンキュー数（7日）", value: week.thanks, max: Math.max(week.thanks, 50), unit: "件", color: "#ec4899" },
    { label: "チャレンジ達成（7日）", value: week.challenges, max: Math.max(week.challenges, 20), unit: "件", color: "#a855f7" },
  ];

  const sibylMetrics = [
    { label: "配属ミスマッチ", value: sibyl.mismatch, unit: "人", color: "#fbbf24" },
    { label: "育成難易度S", value: sibyl.hard, unit: "人", color: "#f87171" },
    { label: "離職リスク高", value: sibyl.risk, unit: "人", color: "#ef4444" },
    { label: "次世代リーダー候補", value: sibyl.leader, unit: "人", color: "#34d399" },
    { label: "AI分析済み率", value: sibyl.analyzed, unit: "%", color: "#818cf8" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <style>{`
        @keyframes scanline { 0% { top: -10% } 100% { top: 110% } }
        @keyframes pulse { 0%,100% { opacity: .5 } 50% { opacity: 1 } }
        .dh-card { transition: all .2s ease; }
        .dh-card:hover { border-color: rgba(139,92,246,.55) !important; box-shadow: 0 0 24px rgba(139,92,246,.18); transform: translateY(-2px); }
      `}</style>

      {/* ① 本日のアラート */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, color: "#8b8fa8", marginBottom: 12 }}>⚡ TODAY'S ALERT</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          {alerts.map((a) => (
            <div key={a.label} className="dh-card" onClick={() => onNavigate(a.key)} style={{ cursor: "pointer", padding: "20px 22px", borderRadius: 16, background: "linear-gradient(160deg, rgba(30,30,50,.9), rgba(15,15,30,.9))", border: "1px solid rgba(255,255,255,.08)" }}>
              <div style={{ fontSize: 12, color: "#8b8fa8", fontWeight: 700, marginBottom: 8 }}>{a.icon} {a.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 42, fontWeight: 900, color: a.color, lineHeight: 1 }}>{loading && a.label === "面談予定" ? "…" : a.value}</span>
                <span style={{ fontSize: 14, color: "#8b8fa8", fontWeight: 700 }}>{a.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ② SIBYL SYSTEM */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 24, padding: "30px 32px", background: "linear-gradient(135deg, rgba(49,32,95,.95), rgba(18,16,45,.98) 55%, rgba(10,10,25,1))", border: "1.5px solid rgba(139,92,246,.4)", boxShadow: "0 0 50px rgba(99,102,241,.15)" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(139,92,246,.6), transparent)", animation: "scanline 5s linear infinite" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 4, color: "#a78bfa" }}>🔮 SIBYL SYSTEM</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#34d399", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", animation: "pulse 1.8s infinite", display: "inline-block" }} />
            {loading ? "SCANNING..." : "ANALYSIS ACTIVE"}
          </div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 20 }}>組織リアルタイム解析 <span style={{ fontSize: 12, color: "#8b8fa8", fontWeight: 700 }}>対象 {sibyl.total}名</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 22 }}>
          {sibylMetrics.map((m) => (
            <div key={m.label} style={{ padding: "16px 14px", borderRadius: 14, background: "rgba(255,255,255,.04)", border: "1px solid rgba(139,92,246,.2)", textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: m.color, lineHeight: 1 }}>{loading ? "…" : m.value}<span style={{ fontSize: 13 }}>{m.unit}</span></div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#a5a8c0", marginTop: 8 }}>{m.label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#8b8fa8", marginBottom: 10 }}>💬 AI PROPOSAL</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(loading ? ["解析中..."] : proposals).map((p, i) => (
              <div key={i} style={{ padding: "11px 16px", borderRadius: 10, background: "rgba(139,92,246,.1)", border: "1px solid rgba(139,92,246,.25)", fontSize: 13.5, fontWeight: 600, color: "#e0d9ff" }}>▸ {p}</div>
            ))}
          </div>
        </div>
        <button onClick={() => onNavigate("sibyl")} style={{ padding: "13px 36px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 15, fontWeight: 900, color: "#fff", background: "linear-gradient(135deg, #8b5cf6, #6366f1)", boxShadow: "0 4px 20px rgba(139,92,246,.4)" }}>🔮 シビュラを開く →</button>
      </div>

      {/* ③ 今週のサマリー */}
      <div style={{ borderRadius: 20, padding: "24px 26px", background: "rgba(20,20,38,.8)", border: "1px solid rgba(255,255,255,.07)" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, color: "#8b8fa8", marginBottom: 16 }}>📊 WEEKLY SUMMARY</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {bars.map((b) => (
            <div key={b.label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                <span style={{ color: "#c7c9dd" }}>{b.label}</span>
                <span style={{ color: b.color }}>{loading ? "…" : b.value}{b.unit}</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,.06)" }}>
                <div style={{ height: "100%", width: `${loading ? 0 : Math.min(100, (b.value / b.max) * 100)}%`, borderRadius: 999, background: `linear-gradient(90deg, ${b.color}, ${b.color}88)`, transition: "width .8s ease" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ④〜⑧ 機能一覧 */}
      {CATEGORIES.map((cat) => (
        <div key={cat.label}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#a5a8c0", marginBottom: 12 }}>{cat.icon} {cat.label}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {cat.cards.map((c) => {
              const badge = c.badgeKey ? (stats[c.badgeKey] as number) || 0 : 0;
              return (
                <div key={c.key} className="dh-card" onClick={() => !c.soon && onNavigate(c.key)} style={{ position: "relative", cursor: c.soon ? "default" : "pointer", opacity: c.soon ? 0.45 : 1, padding: "16px 18px", borderRadius: 14, background: "rgba(25,25,45,.7)", border: "1px solid rgba(255,255,255,.07)" }}>
                  {badge > 0 && <span style={{ position: "absolute", top: 10, right: 10, minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</span>}
                  {c.soon && <span style={{ position: "absolute", top: 10, right: 10, padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,.08)", color: "#8b8fa8", fontSize: 9.5, fontWeight: 800 }}>準備中</span>}
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: "#8b8fa8", marginTop: 3 }}>{c.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
