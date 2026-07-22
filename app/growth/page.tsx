"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { calculateSibyl, getMbtiColor, calculateGrowthCourse, calculateActionScore } from "../lib/sibyl";

const AXIS_META = [
  { key: "cog", name: "地頭", icon: "🧠" },
  { key: "grit", name: "胆力", icon: "🔥" },
  { key: "social", name: "対人", icon: "👥" },
  { key: "drive", name: "瞬発", icon: "⚡" },
  { key: "create", name: "創造", icon: "💡" },
];

const STRENGTH_TEXT: Record<string, { title: string; body: string }> = {
  cog: { title: "地頭", body: "物事を構造的に捉え、本質を見抜く力が抜群です。考え抜く力が、未来を切り拓きます。" },
  grit: { title: "胆力", body: "困難にも折れずやり切る粘り強さが武器。あなたの継続力は、周りの信頼を生みます。" },
  social: { title: "対人", body: "人と関わり、場を動かす力に長けています。あなたの周りには自然と人が集まります。" },
  drive: { title: "瞬発", body: "誰よりも早く動き出せる行動力が強み。あなたのスピードが、チームを前に進めます。" },
  create: { title: "創造", body: "新しい発想で価値を生み出す力があります。あなたのアイデアが、道を切り拓きます。" },
};

export default function GrowthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sibyl, setSibyl] = useState({ cog: 0, grit: 0, social: 0, drive: 0, create: 0 });
  const [typeName, setTypeName] = useState("");
  const [typeCatch, setTypeCatch] = useState("");
  const [typeColor, setTypeColor] = useState("#8b5cf6");
  const [topKey, setTopKey] = useState("cog");
  const [action, setAction] = useState(0);
  const [midGoal, setMidGoal] = useState("");
  const [finalGoal, setFinalGoal] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: p } = await supabase.from("profiles").select("mbti,education,club_category,hobby_category").eq("id", user.id).single();
      const prof: any = p || {};
      const s = calculateSibyl({ mbti: prof.mbti || "", education: prof.education || "", club: prof.club_category || "", hobby: prof.hobby_category || "" });
      setSibyl(s);
      const color = getMbtiColor(prof.mbti || "");
      const course = calculateGrowthCourse({ mbti: prof.mbti || "", education: prof.education || "", sibyl: s });
      if (course) {
        const [tn, tc] = course.courseName.split("｜");
        setTypeName(tn || "");
        setTypeCatch(tc || "");
        setTypeColor(course.colorCode);
        setMidGoal(course.process);
        setFinalGoal(course.goal);
      }
      const entries = [["cog", s.cog], ["grit", s.grit], ["social", s.social], ["drive", s.drive], ["create", s.create]] as [string, number][];
      entries.sort((a, b) => b[1] - a[1]);
      setTopKey(entries[0][0]);
      // 行動スコア
      try {
        const d30 = new Date(Date.now() - 30 * 86400000).toISOString();
        const [{ data: subs }, { count: testC }, { count: contentC }, { count: courseC }, { count: thxSent }, { count: thxRecv }, { count: chalC }] = await Promise.all([
          supabase.from("submissions").select("created_at").eq("user_id", user.id).gte("created_at", d30),
          supabase.from("test_attempts").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("passed", true),
          supabase.from("content_completions").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved"),
          supabase.from("course_stamps").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved"),
          supabase.from("thanks").select("*", { count: "exact", head: true }).eq("from_user_id", user.id),
          supabase.from("thanks").select("*", { count: "exact", head: true }).eq("to_user_id", user.id),
          supabase.from("challenge_submissions").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved"),
        ]);
        const submitDays = new Set((subs || []).map((r: any) => (r.created_at || "").slice(0, 10))).size;
        const a = calculateActionScore({ streak: submitDays, submitRate: Math.round((submitDays / 30) * 100), testPassed: testC || 0, contentDone: contentC || 0, courseStamps: courseC || 0, thanksSent: thxSent || 0, thanksReceived: thxRecv || 0, challengeDone: chalC || 0, kpiAchieved: 0, level: 0 });
        setAction(a.total);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center" }}>読み込み中...</div>;

  // レーダー座標
  const cx = 130, cy = 130, R = 95;
  const vals = AXIS_META.map(a => (sibyl as any)[a.key] as number);
  const pt = (i: number, ratio: number) => {
    const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    return `${cx + Math.cos(ang) * R * ratio},${cy + Math.sin(ang) * R * ratio}`;
  };
  const dataPoly = vals.map((v, i) => pt(i, v / 20)).join(" ");
  const gridPoly = (ratio: number) => AXIS_META.map((_, i) => pt(i, ratio)).join(" ");
  const strength = STRENGTH_TEXT[topKey];

  const CARD: React.CSSProperties = { background: "rgba(18,16,40,.75)", border: "1px solid rgba(139,92,246,.25)", borderRadius: 18, padding: "20px 22px" };
  const SEC: React.CSSProperties = { fontSize: 13, fontWeight: 900, color: "#a78bfa", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(165deg, #0c0a1e, #08081a 60%)", color: "#e5e7eb", padding: "0 0 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", position: "sticky", top: 0, background: "rgba(8,8,26,.9)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(139,92,246,.2)", zIndex: 10 }}>
        <span style={{ fontSize: 17, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>🔮 あなたの成長マップ</span>
        <button onClick={() => router.push("/mypage")} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.05)", color: "#9ca3af", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>← 戻る</button>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* 今のあなた */}
        <div style={{ ...CARD, background: `linear-gradient(135deg, ${typeColor}22, rgba(16,14,42,.85))`, textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#c7c9dd", marginBottom: 6 }}>今のあなた</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: typeColor, lineHeight: 1.2 }}>{typeName}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#e5e7eb", marginTop: 8 }}>{typeCatch}</div>
        </div>

        {/* レーダー + 強み */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          <div style={CARD}>
            <div style={SEC}>📊 5つの成長軸</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <svg viewBox="0 0 260 260" style={{ width: "100%", maxWidth: 300 }}>
                {[0.25, 0.5, 0.75, 1].map((r, i) => <polygon key={i} points={gridPoly(r)} fill="none" stroke="rgba(139,92,246,.15)" strokeWidth="1" />)}
                {AXIS_META.map((_, i) => { const [x, y] = pt(i, 1).split(",").map(Number); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(139,92,246,.15)" strokeWidth="1" />; })}
                <polygon points={dataPoly} fill="rgba(139,92,246,.35)" stroke="#a78bfa" strokeWidth="2" />
                {vals.map((v, i) => { const [x, y] = pt(i, v / 20).split(",").map(Number); return <circle key={i} cx={x} cy={y} r="3.5" fill="#c4b5fd" />; })}
                {AXIS_META.map((a, i) => { const [x, y] = pt(i, 1.28).split(",").map(Number); return <text key={i} x={x} y={y} fill="#c7c9dd" fontSize="12" fontWeight="700" textAnchor="middle" dominantBaseline="middle">{a.icon}{a.name} {(sibyl as any)[a.key]}</text>; })}
              </svg>
            </div>
          </div>

          <div style={CARD}>
            <div style={SEC}>✨ あなたの強み</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 12 }}><span style={{ color: typeColor }}>{strength.title}</span>の高さが武器！</div>
            <div style={{ fontSize: 14, color: "#c7c9dd", lineHeight: 1.9 }}>{strength.body}</div>
          </div>

          <div style={CARD}>
            <div style={SEC}>🚀 行動スコア</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#34d399" }}>{action} <span style={{ fontSize: 16, color: "#8b8fa8" }}>/ 50</span></div>
            <div style={{ height: 12, borderRadius: 999, background: "rgba(255,255,255,.06)", margin: "10px 0", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(action / 50) * 100}%`, background: "linear-gradient(90deg,#10b981,#34d399)", borderRadius: 999, transition: "width 1s ease" }} />
            </div>
            <div style={{ fontSize: 13, color: "#6ee7b7", fontWeight: 700 }}>努力が形になってきています！この調子で、さらに高みへ！</div>
          </div>
        </div>

        {/* ロードマップ */}
        <div style={CARD}>
          <div style={SEC}>🗺 あなたの成長ロードマップ</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(139,92,246,.15)", border: "2px solid #8b5cf6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🚩</div>
              <div style={{ flex: 1, padding: "12px 16px", borderRadius: 12, background: "rgba(139,92,246,.08)", border: "1px solid rgba(139,92,246,.25)" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#c4b5fd", marginBottom: 5 }}>📍 中間目標（6ヶ月）</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1.5 }}>{midGoal}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(52,211,153,.15)", border: "2px solid #34d399", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🏆</div>
              <div style={{ flex: 1, padding: "12px 16px", borderRadius: 12, background: "rgba(52,211,153,.08)", border: "1px solid rgba(52,211,153,.25)" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#6ee7b7", marginBottom: 5 }}>🎯 最終目標（3〜5年）</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1.5 }}>{finalGoal}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...CARD, textAlign: "center", background: "linear-gradient(135deg, rgba(49,32,95,.5), rgba(16,14,42,.85))" }}>
          <div style={{ fontSize: 13, color: "#c7c9dd", marginBottom: 6 }}>あなたは、もっと輝ける。未来は、あなたの選択で変えられる。</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#c4b5fd" }}>さあ、一緒に最高の未来へ進もう！🚀✨</div>
        </div>
      </div>
    </div>
  );
}
