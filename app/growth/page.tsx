"use client";
// あなたの成長マップ。診断・スコアの計算（lib/sibyl）とデータの読み方は従来のまま、見た目だけを天空王国デザインに変更。
// アバターは HOME と同じ AvatarLayered で、本人の今の設定をそのまま表示する。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { calculateSibyl, getMbtiColor, calculateGrowthCourse, calculateActionScore } from "../lib/sibyl";
import AvatarLayered from "../components/AvatarLayered";
import type { AvatarConfig } from "../lib/avatar/catalog";
import { JOBS, type JobKey } from "../onboarding/job/page";

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
  const [av, setAv] = useState<{ job: JobKey | null; cfg: AvatarConfig | null }>({ job: null, cfg: null });
  const [shown, setShown] = useState(false);   // ゲージを伸ばすアニメーション用

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: p } = await supabase.from("profiles").select("mbti,education,club_category,hobby_category,job_class,avatar_config").eq("id", user.id).single();
      const prof: any = p || {};
      { const j = JOBS.some((x) => x.key === prof.job_class) ? (prof.job_class as JobKey) : null; setAv({ job: j, cfg: j && prof.avatar_config?.type === "layered" ? (prof.avatar_config as AvatarConfig) : null }); }
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
      setTimeout(() => setShown(true), 80);
    })();
  }, [router]);

  if (loading) return <div className="gm-root"><div className="gm-load" role="status">読み込み中…</div><style>{CSS}</style></div>;

  // レーダー（スコアは各20点満点。形は実際のスコアから毎回計算する）
  const cx = 150, cy = 140, R = 96;
  const vals = AXIS_META.map(a => (sibyl as any)[a.key] as number);
  const xy = (i: number, ratio: number): [number, number] => { const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2; return [cx + Math.cos(ang) * R * ratio, cy + Math.sin(ang) * R * ratio]; };
  const poly = (f: (i: number) => number) => AXIS_META.map((_, i) => xy(i, f(i)).join(",")).join(" ");
  const strength = STRENGTH_TEXT[topKey];
  const pct = Math.max(0, Math.min(100, (action / 50) * 100));
  const comment = action >= 35 ? "努力が形になってきています！この調子で、さらに高みへ！" : action >= 15 ? "着実に積み上がっています。日報・学習・サンキューを続けて、さらに伸ばそう！" : "ここからがスタート！日報や学習を重ねると、スコアが伸びていきます。";
  const hasType = !!typeName;

  return (
    <div className="gm-root">
      <header className="gm-bar">
        <button className="gm-back" onClick={() => router.push("/mypage")}>← 戻る</button>
        <div className="gm-bar-t"><b>あなたの成長マップ</b><small>GROWTH MAP</small></div>
      </header>

      <div className="gm-wrap">
        {/* タイプ診断結果とアバター */}
        <section className="gm-top">
          <div className="gm-avatar">
            <img className="ped" src="/profile/avatar_pedestal.webp" alt="" />
            <div className="body">
              {av.cfg && av.job ? <AvatarLayered config={av.cfg} job={av.job} size="100%" />
                : av.job ? <img src={`/jobs/${av.job}.webp`} alt="" />
                : <button className="gm-mk" onClick={() => router.push("/onboarding/job")}>アバターを作る →</button>}
            </div>
          </div>
          <div className="gm-type">
            <img src="/home/title_plate.webp" alt="" />
            <div className="in"><small>今のあなた</small><b>{hasType ? typeName : "診断はこれから"}</b></div>
            <p>{hasType ? typeCatch : "プロフィール（MBTI・学歴など）を入力すると、タイプが表示されます"}</p>
          </div>
        </section>

        <div className="gm-mid">
          {/* 5つの成長軸 */}
          <section className="gm-panel">
            <h2>5つの成長軸</h2>
            <svg viewBox="-50 0 400 290" className="gm-radar" role="img" aria-label={"5つの成長軸：" + AXIS_META.map((a, i) => `${a.name}${vals[i]}`).join("、")}>
              {[0.25, 0.5, 0.75, 1].map((r) => <polygon key={r} points={poly(() => r)} fill={r === 1 ? "rgba(255,246,214,.55)" : "none"} stroke="#d4a63d" strokeOpacity={r === 1 ? 0.9 : 0.45} strokeWidth={r === 1 ? 1.6 : 1} />)}
              {AXIS_META.map((_, i) => { const [x, y] = xy(i, 1); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#d4a63d" strokeOpacity=".45" strokeWidth="1" />; })}
              <polygon points={poly((i) => Math.max(0, Math.min(1, vals[i] / 20)))} fill="rgba(137,85,219,.38)" stroke="#8955db" strokeWidth="2.5" strokeLinejoin="round" />
              {vals.map((v, i) => { const [x, y] = xy(i, Math.max(0, Math.min(1, v / 20))); return <g key={i}><circle cx={x} cy={y} r="5.5" fill="#fff" stroke="#8955db" strokeWidth="2.5" /><circle cx={x - 1.2} cy={y - 1.2} r="1.6" fill="#d9c6ff" /></g>; })}
              {AXIS_META.map((a, i) => { const [x, y] = xy(i, 1.3); const anchor = Math.abs(x - cx) < 5 ? "middle" : x > cx ? "start" : "end"; return <text key={i} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" className="lb">{a.name} <tspan className="num">{vals[i]}</tspan></text>; })}
            </svg>
          </section>

          <div className="gm-right">
            {/* あなたの強み */}
            <section className="gm-panel">
              <h2>あなたの強み</h2>
              {vals.every((v) => !v) ? <p className="gm-tx">プロフィール（MBTI・学歴など）を入力すると、あなたの強みが表示されます</p> : (
                <><div className="gm-str"><b>{strength.title}</b>の高さが武器！</div><p className="gm-tx">{strength.body}</p></>
              )}
            </section>
            {/* 行動スコア */}
            <section className="gm-panel">
              <h2>行動スコア</h2>
              <div className="gm-score"><b>{action}</b><span>/ 50</span></div>
              <div className="gm-gauge" role="img" aria-label={`行動スコア ${action}／50`}><i style={{ width: (shown ? pct : 0) + "%" }} /></div>
              <p className="gm-cm">{comment}</p>
            </section>
          </div>
        </div>

        {/* 成長ロードマップ */}
        <section className="gm-panel">
          <h2>あなたの成長ロードマップ</h2>
          {!midGoal && !finalGoal ? <p className="gm-tx">プロフィールを入力すると、あなたの成長ロードマップが表示されます</p> : (
            <div className="gm-road">
              <div className="gm-q"><img src="/island/deco/deco_hata.webp" alt="" /><div><span className="bd mid">中間目標（6ヶ月）</span><p>{midGoal}</p></div></div>
              <div className="gm-q"><img src="/home/nav_trophy.webp" alt="" /><div><span className="bd fin">最終目標（3〜5年）</span><p>{finalGoal}</p></div></div>
            </div>
          )}
        </section>

        <p className="gm-foot">あなたは、もっと輝ける。未来は、あなたの選択で変えられる。<b>さあ、一緒に最高の未来へ進もう！</b></p>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.gm-root{min-height:100vh;min-height:100dvh;background:#cfe6ff url(/home/bg_mobile.webp) center top/cover fixed;color:#172b50;font-family:inherit;overflow-x:clip;padding-bottom:36px}
@media (min-width:700px){ .gm-root{background-image:url(/home/bg_pc.webp)} }
.gm-load{min-height:100vh;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;color:#173c8a}
.gm-bar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:14px;padding:10px 16px;background:linear-gradient(180deg,#173c8a,#10265d);border-bottom:3px solid #d4a63d;box-shadow:0 4px 12px rgba(16,38,93,.35)}
.gm-back{min-height:44px;padding:6px 16px;border-radius:999px;border:2px solid #d4a63d;background:linear-gradient(180deg,#fffdf6,#f3e6c4);color:#7a5a12;font-size:13.5px;font-weight:900;cursor:pointer;font-family:inherit;flex-shrink:0}
.gm-bar-t{min-width:0;display:flex;flex-direction:column;line-height:1.25}
.gm-bar-t b{font-size:clamp(16px,4.6vw,21px);font-weight:900;color:#fff;letter-spacing:.04em}
.gm-bar-t small{font-size:10.5px;font-weight:800;letter-spacing:.22em;color:#ffe6a0}
.gm-wrap{max-width:1120px;margin:0 auto;padding:16px 12px 0;display:flex;flex-direction:column;gap:16px}
.gm-top{display:grid;grid-template-columns:minmax(0,220px) minmax(0,1fr);gap:18px;align-items:center}
.gm-avatar{position:relative;width:100%;max-width:220px;margin:0 auto;padding-bottom:min(25.3%,56px)}
.gm-avatar .ped{position:absolute;left:0;bottom:0;width:100%;height:auto;display:block;filter:drop-shadow(0 8px 10px rgba(16,38,93,.3))}
.gm-avatar .body{position:relative;z-index:1;width:86%;margin:0 auto;aspect-ratio:1024 / 1224;display:flex;align-items:flex-end;justify-content:center}
.gm-avatar .body>img{display:block;width:100%;max-height:92%;object-fit:contain;margin-bottom:4%}
.gm-mk{margin-bottom:38%;min-height:44px;padding:6px 14px;border-radius:999px;border:2px solid #d4a63d;background:#fffdf6;color:#173c8a;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit}
.gm-type{position:relative;width:min(100%,620px);margin:0 auto;container-type:inline-size;text-align:center}
.gm-type>img{display:block;width:100%;height:auto;filter:drop-shadow(0 8px 14px rgba(16,38,93,.4))}
.gm-type .in{position:absolute;left:12%;right:12%;top:0;aspect-ratio:1200 / 321;display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;padding:9.2cqw 0 3.4cqw;color:#fff;text-shadow:0 2px 4px rgba(4,10,40,.6)}
.gm-type small{font-size:clamp(9px,2.3cqw,14px);font-weight:800;letter-spacing:.2em;color:#ffe6a0}
.gm-type b{font-size:clamp(14px,5cqw,32px);font-weight:900;letter-spacing:.06em;line-height:1.2;color:#ffe6a0;overflow-wrap:anywhere}
.gm-type p{display:inline-block;margin:-2.5cqw auto 0;position:relative;max-width:92%;padding:7px 22px;border-radius:999px;background:linear-gradient(180deg,#fffdf6,#f6e7bd);border:2px solid #d4a63d;box-shadow:0 4px 10px rgba(16,38,93,.25);font-size:clamp(12.5px,2.9cqw,17px);font-weight:900;color:#173c8a;line-height:1.5}
.gm-mid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:stretch}
.gm-right{display:flex;flex-direction:column;gap:16px;min-width:0}
.gm-right .gm-panel{flex:1}
.gm-panel{min-width:0;background:linear-gradient(180deg,#fff8e7,#fbf0d4);border:3px solid #d4a63d;border-radius:24px;box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 4px rgba(212,166,61,.35),0 12px 26px rgba(16,38,93,.26);padding:14px 22px 20px}
.gm-panel h2{display:inline-flex;align-items:center;margin:-30px 0 12px -6px;padding:7px 24px;border-radius:999px;background:linear-gradient(180deg,#1f4aa6,#10265d);border:2.5px solid #d4a63d;box-shadow:0 4px 10px rgba(16,38,93,.35);color:#fff;font-size:15.5px;font-weight:900;letter-spacing:.06em}
.gm-radar{display:block;width:100%;max-width:520px;margin:0 auto}
.gm-radar .lb{font-size:14px;font-weight:900;fill:#172b50}
.gm-radar .num{font-size:16px;fill:#173c8a}
.gm-str{font-size:clamp(19px,2.6vw,26px);font-weight:900;line-height:1.4}
.gm-str b{color:#6a35c8}
.gm-tx{margin:8px 0 0;font-size:14.5px;line-height:1.9;font-weight:700;color:#33415f}
.gm-score{display:flex;align-items:baseline;gap:8px}
.gm-score b{font-size:44px;font-weight:900;line-height:1;color:#0f8f76}
.gm-score span{font-size:19px;font-weight:900;color:#33415f}
.gm-gauge{height:20px;margin:10px 0;border-radius:999px;background:#e6dfc9;border:2px solid #c9b98a;box-shadow:inset 0 2px 4px rgba(90,70,20,.25);overflow:hidden}
.gm-gauge i{display:block;height:100%;border-radius:999px;background:linear-gradient(180deg,#5fe3c8,#20bfa0 55%,#149a80);box-shadow:inset 0 2px 0 rgba(255,255,255,.5);transition:width 1.1s cubic-bezier(.2,.8,.2,1)}
.gm-cm{margin:0;padding:8px 14px;border-radius:14px;background:#e3f6ee;border:1.5px solid #9bd6c3;font-size:13.5px;font-weight:800;color:#0f6b58;line-height:1.6}
.gm-road{display:grid;gap:10px}
.gm-q{display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:18px;background:#fffdf6;border:2px solid rgba(212,166,61,.7);box-shadow:0 2px 6px rgba(120,90,30,.14)}
.gm-q img{width:52px;height:52px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 2px 3px rgba(16,38,93,.25))}
.gm-q>div{flex:1;min-width:0}
.gm-q .bd{display:inline-block;padding:2px 12px;border-radius:999px;font-size:12px;font-weight:900;margin-bottom:4px}
.gm-q .bd.mid{background:#ece2fb;color:#5a2fb0}.gm-q .bd.fin{background:#dff3ea;color:#0f6b58}
.gm-q p{margin:0;font-size:15.5px;font-weight:900;line-height:1.6;overflow-wrap:anywhere}
.gm-foot{margin:2px 0 0;padding:12px 16px;border-radius:18px;background:rgba(255,253,246,.92);border:2px solid #d4a63d;text-align:center;font-size:13.5px;font-weight:700;color:#33415f;line-height:1.8}
.gm-foot b{display:block;font-size:16.5px;font-weight:900;color:#173c8a}
.gm-back:focus-visible,.gm-mk:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}
@media (prefers-reduced-motion:reduce){ .gm-gauge i{transition:none} }
@media (max-width:820px){
  .gm-top{grid-template-columns:minmax(0,1fr);gap:6px}
  .gm-type{order:-1}
  .gm-avatar{max-width:170px;padding-bottom:43px}
  .gm-mid{grid-template-columns:minmax(0,1fr);gap:22px}
  .gm-right{gap:22px}
  .gm-wrap{gap:22px;padding-top:14px}
  .gm-panel{padding:12px 14px 16px;border-radius:20px}
  .gm-panel h2{font-size:14.5px;padding:6px 18px;margin-top:-28px}
  .gm-q{align-items:flex-start;padding:10px 12px;gap:10px}
  .gm-q img{width:42px;height:42px}
  .gm-score b{font-size:40px}
}
`;
