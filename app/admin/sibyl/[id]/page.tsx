"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { calculateSibyl, calculateDepartmentMatch, calculateGrowthCourse, getIkuseiGuide, getMbtiColor, mentorCompat, calculateActionScore, getPotentialRank } from "../../../lib/sibyl";

const MBTI_NAME: Record<string, string> = {
  INTJ: "建築家", INTP: "論理学者", ENTJ: "指揮官", ENTP: "討論者",
  INFJ: "提唱者", INFP: "仲介者", ENFJ: "主人公", ENFP: "運動家",
  ISTJ: "管理者", ISFJ: "擁護者", ESTJ: "幹部", ESFJ: "領事官",
  ISTP: "巨匠", ISFP: "冒険家", ESTP: "起業家", ESFP: "エンターテイナー",
};
const COLOR_TYPE: Record<string, string> = { "緑": "外交官タイプ", "紫": "分析家タイプ", "青": "番人タイプ", "黄": "探検家タイプ" };
const JOB_LABEL: Record<string, string> = { "訪販": "訪販(IP)", "テレアポ": "テレアポ(CB)", "クローザー": "クローザー(CB)", "人事": "人事(HR)", "管理マネージャー": "管理マネージャー" };

export default function SibylPersonalPage() {
  const params = useParams();
  const router = useRouter();
  const uid = params.id as string;
  const [p, setP] = useState<any>(null);
  const [deptName, setDeptName] = useState("");
  const [mentors, setMentors] = useState<{ good: any[]; bad: any[] }>({ good: [], bad: [] });
  const [scanTime, setScanTime] = useState("");
  const [action, setAction] = useState<{ total: number; breakdown: { label: string; score: number; max: number }[] }>({ total: 0, breakdown: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("id,name,mbti,education,club_category,hobby_category,department_id,grade,avatar_config,created_at").eq("id", uid).single();
      if (!prof) { setLoading(false); return; }
      setP(prof);
      if (prof.department_id) {
        const { data: d } = await supabase.from("departments").select("name").eq("id", prof.department_id).single();
        setDeptName(d?.name || "");
      }
      const { data: others } = await supabase.from("profiles").select("id,name,mbti,created_at,avatar_config").not("mbti", "is", null).neq("id", uid);
      if (prof.mbti && others) {
        const seniors = others.filter((o: any) => o.created_at && prof.created_at && o.created_at < prof.created_at);
        const scored = seniors.map((o: any) => { const c = mentorCompat(prof.mbti, o.mbti); return c ? { ...o, ...c } : null; }).filter(Boolean) as any[];
        setMentors({
          good: [...scored].sort((a, b) => b.rank - a.rank).slice(0, 3),
          bad: [...scored].sort((a, b) => a.rank - b.rank).slice(0, 2),
        });
      }
      // 行動データ取得
      try {
        const d30 = new Date(Date.now() - 30 * 86400000).toISOString();
        const [{ data: subs }, { count: testC }, { count: contentC }, { count: courseC }, { count: thxSent }, { count: thxRecv }, { count: chalC }] = await Promise.all([
          supabase.from("submissions").select("created_at").eq("user_id", uid).gte("created_at", d30),
          supabase.from("test_attempts").select("*", { count: "exact", head: true }).eq("user_id", uid).eq("passed", true),
          supabase.from("content_completions").select("*", { count: "exact", head: true }).eq("user_id", uid).eq("status", "approved"),
          supabase.from("course_stamps").select("*", { count: "exact", head: true }).eq("user_id", uid).eq("status", "approved"),
          supabase.from("thanks").select("*", { count: "exact", head: true }).eq("from_user_id", uid),
          supabase.from("thanks").select("*", { count: "exact", head: true }).eq("to_user_id", uid),
          supabase.from("challenge_submissions").select("*", { count: "exact", head: true }).eq("user_id", uid).eq("status", "approved"),
        ]);
        const submitDays = new Set((subs || []).map((r: any) => (r.created_at || "").slice(0, 10))).size;
        setAction(calculateActionScore({
          streak: submitDays,
          submitRate: Math.round((submitDays / 30) * 100),
          testPassed: testC || 0,
          contentDone: contentC || 0,
          courseStamps: courseC || 0,
          thanksSent: thxSent || 0,
          thanksReceived: thxRecv || 0,
          challengeDone: chalC || 0,
          kpiAchieved: 0,
          level: 0,
        }));
      } catch (e) { console.error("action score error", e); }
      setScanTime(new Date().toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }));
      setLoading(false);
    })();
  }, [uid]);

  if (loading) return <div style={{ minHeight: "100vh", background: "#08081a", display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa", fontWeight: 800, letterSpacing: 3 }}>SCANNING...</div>;
  if (!p) return <div style={{ minHeight: "100vh", background: "#08081a", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171" }}>ユーザーが見つかりません</div>;

  const s = calculateSibyl({ mbti: p.mbti || "", education: p.education || "", club: p.club_category || "", hobby: p.hobby_category || "" });
  const total = s.cog + s.grit + s.social + s.drive + s.create;
  const rank = total >= 68 ? "S" : total >= 56 ? "A" : total >= 44 ? "B" : total >= 32 ? "C" : "D";
  const rankColor = rank === "S" ? "#a78bfa" : rank === "A" ? "#34d399" : rank === "B" ? "#38bdf8" : rank === "C" ? "#fbbf24" : "#f87171";
  const orgScore = Math.min(100, Math.round((total / 90) * 100));
  const color = getMbtiColor(p.mbti || "");
  const typeName = color ? COLOR_TYPE[color] : "未分析";
  const course = p.mbti ? calculateGrowthCourse({ mbti: p.mbti, education: p.education || "", sibyl: s }) : null;
  const guide = getIkuseiGuide(p.mbti || "");
  const matches = calculateDepartmentMatch(s, { mbti: p.mbti || "", education: p.education || "" });
  const topMatch = matches[0];
  const maxMatchScore = topMatch?.score || 1;
  const deployRank = topMatch && topMatch.score >= 80 ? "S" : topMatch && topMatch.score >= 65 ? "A" : "B";
  const ikuseiRank = total >= 60 ? "A" : total >= 40 ? "B" : "S";
  const riskLevel = s.grit <= 7 ? "HIGH" : s.grit <= 11 ? "MID" : "LOW";
  const riskColor = riskLevel === "HIGH" ? "#f87171" : riskLevel === "MID" ? "#fbbf24" : "#34d399";
  const potential = getPotentialRank(total, action.total);
  const circ = 2 * Math.PI * 44;
  const axes = [
    { label: "地頭", v: s.cog, color: "#6366f1" },
    { label: "胆力", v: s.grit, color: "#ef4444" },
    { label: "対人", v: s.social, color: "#10b981" },
    { label: "瞬発", v: s.drive, color: "#f59e0b" },
    { label: "創造", v: s.create, color: "#a855f7" },
  ];
  // レーダーチャート座標
  const radar = (r: number) => axes.map((a, i) => {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const len = (a.v / 20) * r;
    return `${100 + Math.cos(angle) * len},${100 + Math.sin(angle) * len}`;
  }).join(" ");
  const radarBg = (ratio: number) => axes.map((_, i) => {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    return `${100 + Math.cos(angle) * 80 * ratio},${100 + Math.sin(angle) * 80 * ratio}`;
  }).join(" ");
  // キャリア予測（マッチ上位から生成）
  const careerSteps = [
    { lv: "Lv.1", when: "現在", role: `${JOB_LABEL[topMatch?.dept] || "配属先"} インターン`, fit: Math.min(99, Math.round(orgScore * 0.85)) },
    { lv: "Lv.2", when: "6ヶ月後", role: course?.process ? course.process.split("。")[0].slice(0, 16) : `${topMatch?.dept || ""}リーダー`, fit: Math.min(99, Math.round(orgScore * 0.95)) },
    { lv: "Lv.3", when: "1年後", role: course?.goal.split("。")[0].slice(0, 14) || "中核メンバー", fit: Math.min(99, orgScore) },
    { lv: "Lv.4", when: "2-3年後", role: matches[1] ? `${JOB_LABEL[matches[1].dept] || matches[1].dept}兼務` : "マネージャー候補", fit: Math.min(99, Math.round(orgScore * 0.92)) },
    { lv: "Lv.5", when: "5年後", role: "起業 / 新規事業責任者", fit: Math.min(99, Math.round((s.create + s.drive) / 40 * 100)) },
  ];
  const CARD: React.CSSProperties = { background: "rgba(18,16,40,.85)", border: "1px solid rgba(139,92,246,.25)", borderRadius: 18, padding: "22px 24px" };
  const SEC: React.CSSProperties = { fontSize: 12, fontWeight: 900, letterSpacing: 2, color: "#a78bfa", marginBottom: 16 };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0c0a24, #08081a 60%)", color: "#e5e7eb", padding: "0 0 60px" }}>
      <style>{`
        @keyframes blink { 0%,100% { opacity:.4 } 50% { opacity:1 } }
        @keyframes orbit { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes pulseOrb { 0%,100% { box-shadow: 0 0 30px rgba(99,102,241,.5), inset 0 0 20px rgba(139,92,246,.4) } 50% { box-shadow: 0 0 60px rgba(139,92,246,.8), inset 0 0 30px rgba(99,102,241,.6) } }
      `}</style>

      {/* ヘッダー */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 28px", borderBottom: "1px solid rgba(139,92,246,.2)", position: "sticky", top: 0, background: "rgba(8,8,26,.92)", backdropFilter: "blur(8px)", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: 3, color: "#fff" }}>🔮 SIBYL SYSTEM</span>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#a78bfa", borderLeft: "1px solid rgba(139,92,246,.4)", paddingLeft: 12 }}>PERSONAL ANALYSIS</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 11, color: "#8b8fa8", fontWeight: 700 }}>最終更新：{scanTime}</span>
          <button onClick={() => router.push("/admin/sibyl/guide")} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(139,92,246,.4)", background: "rgba(139,92,246,.1)", color: "#c4b5fd", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>📖 見方ガイド</button>
          <button onClick={() => window.print()} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(139,92,246,.4)", background: "rgba(139,92,246,.1)", color: "#c4b5fd", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>📄 PDFレポート出力</button>
          <button onClick={() => router.push("/admin")} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.05)", color: "#9ca3af", fontWeight: 800, cursor: "pointer" }}>✕</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* プロフィール＋ランク＋ステータス */}
        <div style={{ ...CARD, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ width: 96, height: 96, borderRadius: "50%", overflow: "hidden", border: `3px solid ${rankColor}`, boxShadow: `0 0 24px ${rankColor}55`, margin: "0 auto 10px", background: "#fff" }}>
              {p.avatar_config?.id ? <img src={`/avatars/${p.avatar_config.id}.png`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, background: "#1e1b3a" }}>👤</div>}
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{p.name}</div>
            <div style={{ fontSize: 11.5, color: "#8b8fa8", fontWeight: 700, marginTop: 2 }}>{deptName || "所属未設定"}{p.grade ? ` ／ ${p.grade}` : ""}</div>
            {p.education && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{p.education}</div>}
          </div>

          <div style={{ textAlign: "center", flexShrink: 0, padding: "0 10px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 2, color: "#8b8fa8", marginBottom: 6 }}>ポテンシャルランク</div>
            <div style={{ fontSize: 64, fontWeight: 900, color: potential.color, lineHeight: 1, textShadow: `0 0 30px ${potential.color}88` }}>{potential.rank}</div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: potential.color, marginTop: 8 }}>{potential.label}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#8b8fa8", marginTop: 8, lineHeight: 1.6 }}>
              資質 {total} + 行動 {action.total}<br />= {potential.score} / 150
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "#6b7280", marginTop: 6 }}>（資質のみ: {rank}ランク）</div>
          </div>

          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{typeName} <span style={{ fontSize: 14, color: "#a78bfa" }}>({p.mbti || "未設定"}{p.mbti && MBTI_NAME[p.mbti] ? `・${MBTI_NAME[p.mbti]}` : ""})</span></div>
            <div style={{ fontSize: 12.5, color: "#a5a8c0", fontWeight: 600, marginTop: 4, marginBottom: 16 }}>{course?.courseName.split("｜")[1] || "分析にはMBTIの登録が必要です"}</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ position: "relative", width: 104, height: 104 }}>
                <svg width="104" height="104" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="52" cy="52" r="44" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="9" />
                  <circle cx="52" cy="52" r="44" fill="none" stroke="#8b5cf6" strokeWidth="9" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - orgScore / 100)} style={{ transition: "stroke-dashoffset 1s ease" }} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: "#c4b5fd" }}>{orgScore}<span style={{ fontSize: 12 }}>%</span></span>
                  <span style={{ fontSize: 8.5, fontWeight: 800, color: "#8b8fa8", letterSpacing: 1 }}>組織適性</span>
                </div>
              </div>
              {[
                { label: "配属適性", v: deployRank, c: "#a78bfa", sub: deployRank === "S" ? "非常に高い" : "高い" },
                { label: "育成難易度", v: ikuseiRank, c: "#fbbf24", sub: ikuseiRank === "S" ? "要重点フォロー" : "標準" },
                { label: "離職リスク", v: riskLevel, c: riskColor, sub: riskLevel === "HIGH" ? "高い" : riskLevel === "MID" ? "標準" : "低い" },
              ].map((m) => (
                <div key={m.label} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,.04)", border: "1px solid rgba(139,92,246,.2)", textAlign: "center", minWidth: 92 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#8b8fa8", marginBottom: 6 }}>{m.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: m.c, lineHeight: 1 }}>{m.v}</div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#8b8fa8", marginTop: 5 }}>{m.sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, color: "#34d399", marginBottom: 4 }}>SIBYL STATUS</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#34d399", marginBottom: 12, animation: "blink 1.8s infinite" }}>ANALYSIS ACTIVE</div>
            <div style={{ width: 90, height: 90, borderRadius: "50%", margin: "0 auto", background: "radial-gradient(circle at 40% 35%, rgba(139,92,246,.9), rgba(30,27,74,.95) 65%)", animation: "pulseOrb 3s ease-in-out infinite", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: "1px dashed rgba(139,92,246,.4)", animation: "orbit 12s linear infinite" }} />
              <span style={{ fontSize: 26 }}>👁️</span>
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "#8b8fa8", marginTop: 12 }}>AI分析完了<br />{scanTime}</div>
          </div>
        </div>

        {/* 行動スコア */}
        <div style={CARD}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            <span style={SEC}>⚡ 行動スコア（実績ベース）</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: "#34d399" }}>{action.total} / 50</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            {action.breakdown.map(b => (
              <div key={b.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, marginBottom: 5 }}>
                  <span style={{ color: "#c7c9dd" }}>{b.label}</span>
                  <span style={{ color: b.score >= b.max * 0.7 ? "#34d399" : b.score >= b.max * 0.4 ? "#fbbf24" : "#8b8fa8" }}>{b.score} / {b.max}</span>
                </div>
                <div style={{ height: 7, borderRadius: 999, background: "rgba(255,255,255,.06)" }}>
                  <div style={{ height: "100%", width: `${(b.score / b.max) * 100}%`, borderRadius: 999, background: "linear-gradient(90deg,#10b981,#34d399)", transition: "width .8s ease" }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 11.5, color: "#8b8fa8", lineHeight: 1.7 }}>
            継続力=直近30日の提出日数・提出率／学習量=テスト合格・学習完了・講座スタンプ／貢献=サンキュー送受信／挑戦=チャレンジ達成
          </div>
        </div>

        {/* 能力パラメータ＋キャリア予測 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
          <div style={CARD}>
            <div style={SEC}>能力パラメータ</div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
              <svg width="200" height="200" viewBox="0 0 200 200" style={{ flexShrink: 0 }}>
                {[1, 0.75, 0.5, 0.25].map((r) => <polygon key={r} points={radarBg(r)} fill="none" stroke="rgba(139,92,246,.18)" strokeWidth="1" />)}
                {axes.map((a, i) => { const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2; return <line key={i} x1="100" y1="100" x2={100 + Math.cos(angle) * 80} y2={100 + Math.sin(angle) * 80} stroke="rgba(139,92,246,.18)" strokeWidth="1" />; })}
                <polygon points={radar(80)} fill="rgba(139,92,246,.35)" stroke="#8b5cf6" strokeWidth="2" />
                {axes.map((a, i) => { const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2; return <text key={i} x={100 + Math.cos(angle) * 96} y={100 + Math.sin(angle) * 96 + 4} textAnchor="middle" fill="#c7c9dd" fontSize="11" fontWeight="800">{a.label} {a.v}</text>; })}
              </svg>
              <div style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 10 }}>
                {axes.map((a) => (
                  <div key={a.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 800, marginBottom: 4 }}>
                      <span style={{ color: "#c7c9dd" }}>{a.label}</span><span style={{ color: a.color }}>{a.v} / 20</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,.06)" }}>
                      <div style={{ height: "100%", width: `${(a.v / 20) * 100}%`, borderRadius: 999, background: a.color, transition: "width .8s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={CARD}>
            <div style={SEC}>キャリア予測シミュレーション</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {careerSteps.map((c, i) => (
                <div key={c.lv} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: i === 0 ? "linear-gradient(135deg,#8b5cf6,#6366f1)" : "rgba(139,92,246,.15)", border: "1px solid rgba(139,92,246,.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff", flexShrink: 0 }}>{i + 1}</div>
                    {i < careerSteps.length - 1 && <div style={{ width: 2, height: 26, background: "rgba(139,92,246,.3)" }} />}
                  </div>
                  <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 5 }}>
                    <div>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: "#8b8fa8" }}>{c.lv}　{c.when}</span>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{c.role}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 900, color: "#34d399" }}>適性 {c.fit}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI分析＋注意ポイント */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
          <div style={CARD}>
            <div style={SEC}>🧠 AI分析結果</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {(guide ? [guide.tag + "の気質です", guide.talk, guide.grow] : ["MBTI未登録のため分析できません"]).map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 9, fontSize: 13, fontWeight: 600, color: "#c8f7dd", lineHeight: 1.6 }}>
                  <span style={{ color: "#34d399" }}>✅</span><span>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...CARD, border: "1px solid rgba(251,191,36,.35)" }}>
            <div style={{ ...SEC, color: "#fbbf24" }}>⚠️ 注意すべきポイント</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {(guide ? guide.avoid.split("／").slice(0, 4) : ["—"]).map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 9, fontSize: 13, fontWeight: 600, color: "#fde8b8", lineHeight: 1.6 }}>
                  <span style={{ color: "#fbbf24" }}>●</span><span>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 事業部マッチング＋メンターマッチング */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
          <div style={CARD}>
            <div style={SEC}>事業部マッチング</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {matches.map((m) => {
                const pct = Math.round((m.score / maxMatchScore) * 100);
                const r = m.score >= 80 ? "S" : m.score >= 65 ? "A" : m.score >= 50 ? "B" : "C";
                const rc = r === "S" ? "#a78bfa" : r === "A" ? "#34d399" : r === "B" ? "#fbbf24" : "#8b8fa8";
                return (
                  <div key={m.dept} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 130, fontSize: 12, fontWeight: 800, color: "#c7c9dd" }}>{JOB_LABEL[m.dept] || m.dept}</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 999, background: "rgba(255,255,255,.06)" }}>
                      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: "linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
                    </div>
                    <span style={{ width: 40, textAlign: "right", fontSize: 12, fontWeight: 900, color: "#c7c9dd" }}>{pct}%</span>
                    <span style={{ width: 18, textAlign: "center", fontSize: 13, fontWeight: 900, color: rc }}>{r}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={CARD}>
            <div style={SEC}>メンターマッチング</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 900, color: "#34d399", marginBottom: 10 }}>相性の良いメンター</div>
                {mentors.good.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>該当なし</div>}
                {mentors.good.map((m) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", background: "#1e1b3a", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {m.avatar_config?.id ? <img src={`/avatars/${m.avatar_config.id}.png`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} /> : <span style={{ fontSize: 15 }}>👤</span>}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#8b8fa8" }}>{m.mbti}・{m.label}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 900, color: "#f87171", marginBottom: 10 }}>相性が低いメンター</div>
                {mentors.bad.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>該当なし</div>}
                {mentors.bad.map((m) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", background: "#1e1b3a", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {m.avatar_config?.id ? <img src={`/avatars/${m.avatar_config.id}.png`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} /> : <span style={{ fontSize: 15 }}>👤</span>}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#8b8fa8" }}>{m.mbti}・{m.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 8 }}>※ 入社が先のメンバーの中から気質相性で算出</div>
          </div>
        </div>

      </div>
    </div>
  );
}
