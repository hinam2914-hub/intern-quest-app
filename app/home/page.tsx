"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import DotKun from "../components/DotKun";
import DotHouse, { getHouseStage } from "../components/DotHouse";

type Theme = "light" | "dark";
type Task = { key: string; icon: string; label: string; href: string };
type MyKing = { emoji: string; title: string; dotkun: string };

function getLevel(points: number): number { return Math.max(1, Math.floor(points / 100) + 1); }
function dotStage(level: number): number { return level >= 70 ? 5 : level >= 50 ? 4 : level >= 30 ? 3 : level >= 10 ? 2 : 1; }
function getTodayJST(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}
// 今日のJST 0:00〜24:00 をUTC範囲で
function todayRangeUTC(): { start: string; end: string } {
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = jstNow.getUTCFullYear(), m = jstNow.getUTCMonth(), d = jstNow.getUTCDate();
  const start_utc = Date.UTC(y, m, d) - 9 * 60 * 60 * 1000;
  return { start: new Date(start_utc).toISOString(), end: new Date(start_utc + 24 * 60 * 60 * 1000).toISOString() };
}
function yesterdayRangeUTC(): { start: string; end: string } {
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = jstNow.getUTCFullYear(), m = jstNow.getUTCMonth(), d = jstNow.getUTCDate();
  const todayJst0_utc = Date.UTC(y, m, d) - 9 * 60 * 60 * 1000;
  return { start: new Date(todayJst0_utc - 24 * 60 * 60 * 1000).toISOString(), end: new Date(todayJst0_utc).toISOString() };
}
function seededPick<T>(arr: T[], seedStr: string): T {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) { h = (h * 31 + seedStr.charCodeAt(i)) >>> 0; }
  return arr[h % arr.length];
}
function greeting(): string {
  const hour = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours();
  if (hour < 11) return "おはよう☀️";
  if (hour < 18) return "こんにちは";
  return "おつかれさま🌙";
}

// タスクごとのドットくんセリフ（日替わりで1つ選ばれる）
const DOT_MSGS: Record<string, string[]> = {
  report: [
    "今日の日報、待ってるよ！どんな一日だった？",
    "まずは日報から！書くと頭が整理されるよ📝",
    "日報タイム！今日の自分を振り返ってみよう",
  ],
  schedule: [
    "今日の予定を立てよう！決めると一日が動きやすくなるよ",
    "まずスケジュール！何をやるか決めちゃおう☀️",
  ],
  thinking: [
    "今日は思考クエストの日！きみの考え、聞かせて🧠",
    "頭の体操いこう！今日のお題、なかなか面白いよ",
  ],
  oogiri: [
    "今日は大喜利の日🎤 きみのボケ、待ってるよ！",
    "たまには笑いも大事！今日のお題でボケてみて",
  ],
  learn: [
    "今日は学習の日📚 新しい武器を1つ手に入れよう",
    "学習コンテンツ、1本だけでも見てみない？未来の自分が喜ぶよ",
  ],
  challenge: [
    "今日はライフチャレンジ！楽しみながらポイント稼ごう🎯",
    "チャレンジ日和だね！小さな挑戦が毎日を変えるよ",
  ],
  medaka: [
    "今日はメダカBOXの日🐟 きみの気づき、組織を動かすかも",
    "最近気づいたこと、メダカBOXに投稿してみない？",
  ],
  gacha: [
    "今日のクエスト全部クリア！ご褒美にガチャ回そう🎰",
    "全部やりきったね、えらい！ガチャで運試ししよ🎰",
  ],
};

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [theme, setTheme] = useState<Theme>("light");
  const [task, setTask] = useState<Task>({ key: "report", icon: "📝", label: "日報を書く", href: "/report" });
  const [doneCount, setDoneCount] = useState(0);
  const [dotMsg, setDotMsg] = useState("");
  const [myKings, setMyKings] = useState<MyKing[]>([]);
  const [showKingPopup, setShowKingPopup] = useState(false);
  const [showEvolve, setShowEvolve] = useState(false);
  const [evolveIdx, setEvolveIdx] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [petHearts, setPetHearts] = useState<{ id: number; hx: string; hr: string }[]>([]);
  const [petMsg, setPetMsg] = useState<string | null>(null);
  const [petKey, setPetKey] = useState(0);
  const [btnPop, setBtnPop] = useState(false);
  const [hopNav, setHopNav] = useState<string | null>(null);

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("homeTheme")) as Theme | null;
    if (saved === "light" || saved === "dark") setTheme(saved);
    if (typeof window !== "undefined" && localStorage.getItem("homeSound") === "on") setSoundOn(true);
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("name, streak, avatar_config").eq("id", user.id).single();
      const { data: pointRow } = await supabase.from("user_points").select("total_earned").eq("id", user.id).single();
      const te = (pointRow as any)?.total_earned || 0;
      setTotalEarned(te);
      // 家の進化検知（前回見た段階より上がってたら1回だけ祝う）
      try {
        const curIdx = getHouseStage(te).idx;
        const prevRaw = localStorage.getItem("lastHouseStage");
        if (prevRaw === null) {
          localStorage.setItem("lastHouseStage", String(curIdx));
        } else if (curIdx > parseInt(prevRaw, 10)) {
          setEvolveIdx(curIdx);
          setShowEvolve(true);
          localStorage.setItem("lastHouseStage", String(curIdx));
        }
      } catch {}
      if (profile) {
        setName((profile as any).name || "");
        setAvatarId((profile as any).avatar_config?.id || null);
        setStreak((profile as any).streak || 0);
      }
      const todayYmd = getTodayJST();
      const range = todayRangeUTC();

      // 今日の状況を取得
      const { data: subRows } = await supabase.from("submissions").select("id").eq("user_id", user.id).gte("created_at", range.start).lt("created_at", range.end).limit(1);
      const reportDone = !!(subRows && subRows.length > 0);
      const { data: schedRow } = await supabase.from("daily_schedules").select("id").eq("user_id", user.id).eq("date", todayYmd).maybeSingle();
      const scheduleDone = !!schedRow;
      const { data: thinkRows } = await supabase.from("thinking_answers").select("id").eq("user_id", user.id).gte("created_at", range.start).lt("created_at", range.end).limit(1);
      const thinkingDone = !!(thinkRows && thinkRows.length > 0);

      // リング: コアタスク3つ（スケジュール・日報・思考系）
      setDoneCount([scheduleDone, reportDone, thinkingDone].filter(Boolean).length);

      // 中央ボタンの決定
      const seed = todayYmd + user.id;
      const hourJST = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours();
      let chosen: Task;
      if (hourJST >= 18 && !reportDone) {
        chosen = { key: "report", icon: "📝", label: "日報を書く", href: "/report" };
      } else {
        const pool: Task[] = [];
        if (!scheduleDone) pool.push({ key: "schedule", icon: "☀️", label: "予定を立てる", href: "/today-schedule" });
        if (!thinkingDone) {
          pool.push({ key: "thinking", icon: "🧠", label: "今日のお題", href: "/thinking" });
          pool.push({ key: "oogiri", icon: "🎤", label: "大喜利でボケる", href: "/thinking" });
        }
        pool.push({ key: "learn", icon: "📚", label: "学習する", href: "/learn" });
        pool.push({ key: "challenge", icon: "🎯", label: "チャレンジ", href: "/challenge" });
        pool.push({ key: "medaka", icon: "🐟", label: "気づきを投稿", href: "/medaka" });
        chosen = pool.length > 0 ? seededPick(pool, seed) : { key: "learn", icon: "📚", label: "学習する", href: "/learn" };
      }
      setTask(chosen);
      const msgs = DOT_MSGS[chosen.key] || ["今日もいこう！"];
      setDotMsg(seededPick(msgs, seed + "m"));
      // 昨日の称号判定（自分が該当する称号をポップアップで祝う）
      try {
        const kingRange = yesterdayRangeUTC();
        const myKingList: MyKing[] = [];
        const { data: kThanks } = await supabase.from("thanks").select("to_user_id").gte("created_at", kingRange.start).lt("created_at", kingRange.end);
        if (kThanks && kThanks.length > 0) {
          const cnt: Record<string, number> = {};
          (kThanks as any[]).forEach(t => { cnt[t.to_user_id] = (cnt[t.to_user_id] || 0) + 1; });
          const maxCnt = Math.max(...Object.values(cnt));
          if (maxCnt > 0 && cnt[user.id] === maxCnt) myKingList.push({ emoji: "🙏", title: "サンキュー王", dotkun: "昨日いちばんサンキューをもらったよ！みんなから感謝されてる、人徳だね🙏✨" });
        }
        const { data: kSubs } = await supabase.from("submissions").select("user_id, content, created_at").gte("created_at", kingRange.start).lt("created_at", kingRange.end).order("created_at", { ascending: true });
        if (kSubs && kSubs.length > 0) {
          const subs = kSubs as any[];
          if (subs[0].user_id === user.id) myKingList.push({ emoji: "📝", title: "一番乗り王", dotkun: "昨日いちばん早く日報を出したね！さすがの仕事の速さ⚡" });
          let longest = subs[0];
          subs.forEach(s => { if ((s.content?.length || 0) > (longest.content?.length || 0)) longest = s; });
          if (longest.user_id === user.id) myKingList.push({ emoji: "💬", title: "長文王", dotkun: "昨日いちばん熱のこもった長い日報だったよ！熱意、伝わってる📖" });
        }
        if (myKingList.length > 0 && localStorage.getItem("kingPopupSeen") !== todayYmd) {
          setMyKings(myKingList);
          setShowKingPopup(true);
        }
      } catch (e) { /* 称号判定の失敗はhome本体に影響させない */ }
      setLoading(false);
    };
    load();
  }, [router]);

  const PET_MSGS = ["えへへ、くすぐったいよ〜！", "なでなでありがと！元気でた🥰", "きみのそういうとこ好きだな〜", "ふふ、今日もがんばろっ！", "もっとなでてもいいんだよ？"];
  const handlePet = () => {
    const now = Date.now();
    const newHearts = Array.from({ length: 3 }, (_, i) => ({
      id: now + i,
      hx: `${(Math.random() * 60 - 30).toFixed(0)}px`,
      hr: `${(Math.random() * 80 - 40).toFixed(0)}deg`,
    }));
    setPetHearts(prev => [...prev.slice(-6), ...newHearts]);
    setPetKey(k => k + 1);
    setPetMsg(PET_MSGS[Math.floor(Math.random() * PET_MSGS.length)]);
    setTimeout(() => setPetHearts(prev => prev.filter(h => !newHearts.some(n => n.id === h.id))), 900);
    setTimeout(() => setPetMsg(null), 3000);
  };

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof window !== "undefined") localStorage.setItem("homeTheme", next);
  };

  // --- 効果音（Web Audio合成、音源ファイル不要） ---
  const playPoko = () => {
    if (!soundOn) return;
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = (window as any).__iqAudio || new AC();
      (window as any).__iqAudio = ctx;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.13);
    } catch {}
  };
  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    if (typeof window !== "undefined") localStorage.setItem("homeSound", next ? "on" : "off");
    if (next) setTimeout(() => { try { const AC = (window as any).AudioContext || (window as any).webkitAudioContext; const ctx: AudioContext = (window as any).__iqAudio || new AC(); (window as any).__iqAudio = ctx; ctx.resume(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = "sine"; osc.frequency.setValueAtTime(660, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.09); gain.gain.setValueAtTime(0.25, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12); osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.13); } catch {} }, 50);
  };
  const isDark = false; // ダーク廃止・島テーマ一本化（theme切替は無効化）
  const bg = isDark ? "radial-gradient(circle at 50% 30%, #14142b 0%, #0a0a0f 65%)" : "url(/island_bg.png) center top / cover no-repeat fixed, #bfe3f5";
  const nameColor = isDark ? "#f9fafb" : "#2b3440";
  const helloColor = isDark ? "#6b7280" : "#6f7a86";
  const flameStyle = isDark
    ? { background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.35)", color: "#fbbf24" }
    : { background: "#fff", border: "none", color: "#e8590c", boxShadow: "0 4px 14px rgba(43,52,64,.08)" };
  const pct = (doneCount / 3) * 100;
  const ringBg = isDark
    ? `conic-gradient(#8b5cf6 0 var(--ringPct), rgba(139,92,246,.12) var(--ringPct) 100%)`
    : `conic-gradient(#ffa94d 0 var(--ringPct), #eceae4 var(--ringPct) 100%)`;
  const ringInner = isDark ? "#0d0d18" : "#fdfdfb";
  const btnBg = isDark ? "linear-gradient(150deg, #6366f1, #8b5cf6)" : "transparent";
  const btnShadow = isDark
    ? "0 0 50px rgba(99,102,241,.5), inset 0 -6px 0 rgba(0,0,0,.2)"
    : "0 18px 40px rgba(255,138,61,.35), inset 0 -8px 0 rgba(0,0,0,.08)";
  const dotRowStyle = isDark
    ? { background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.22)" }
    : { background: "linear-gradient(160deg, #b07a4a, #8b5e34)", border: "2px solid #6f4a29", boxShadow: "0 6px 16px rgba(60,38,18,.35), inset 0 1px 0 rgba(255,255,255,.25), inset 0 -2px 6px rgba(60,38,18,.35)" };
  const dotTextColor = isDark ? "#c7d2fe" : "#fff";
  const otherColor = isDark ? "#6b7280" : "#6f7a86";

  if (loading) return <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: helloColor }}>読み込み中...</div>;

  return (
    <>
    <style>{`
      @keyframes floaty { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
      @keyframes fadeInUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes popIn { 0% { opacity: 0; transform: translateY(16px) scale(0.86); } 55% { opacity: 1; transform: translateY(-3px) scale(1.05); } 78% { transform: translateY(1px) scale(0.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes flashGlow { 0% { opacity: 0; } 30% { opacity: 1; } 100% { opacity: 0; } }
      @keyframes houseReveal { 0% { opacity: 0; transform: scale(0.3) translateY(30px); } 55% { opacity: 1; transform: scale(1.15) translateY(-6px); } 75% { transform: scale(0.95) translateY(2px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
      @keyframes ringGlow { 0%, 100% { filter: drop-shadow(0 0 18px rgba(139,92,246,0.25)); } 50% { filter: drop-shadow(0 0 34px rgba(139,92,246,0.55)); } }
      @keyframes confettiFall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0.7; } }
      @property --ringPct { syntax: "<percentage>"; inherits: false; initial-value: 0%; }
      @keyframes ringFill { from { --ringPct: 0%; } }
      .iq-ring { animation: ringFill 1.1s ease-out both; }
      @keyframes petSquish { 0% { transform: scale(1,1); } 15% { transform: scale(1.15,0.82) translateY(4px); } 40% { transform: scale(0.9,1.15) translateY(-8px); } 65% { transform: scale(1.06,0.96); } 100% { transform: scale(1,1); } }
      @keyframes heartPop { 0% { transform: translate(0,0) scale(0.3) rotate(0deg); opacity: 1; } 40% { opacity: 1; } 100% { transform: translate(var(--hx), -52px) scale(1.3) rotate(var(--hr)); opacity: 0; } }
      @keyframes pushPop { 0% { transform: scale(0.9); } 45% { transform: scale(1.08); } 70% { transform: scale(0.97); } 100% { transform: scale(1); } }
      @keyframes hop { 0% { transform: translateY(0) scale(1); } 30% { transform: translateY(-7px) scale(1.12, 0.9); } 60% { transform: translateY(0) scale(0.94, 1.08); } 100% { transform: translateY(0) scale(1); } }
      @keyframes cloudDrift { 0% { transform: translateX(-30vw); } 100% { transform: translateX(130vw); } }
      @keyframes dotHop { 0%, 88%, 100% { transform: translateY(0); } 92% { transform: translateY(-9px) scale(1.06, 0.94); } 96% { transform: translateY(0) scale(0.96, 1.05); } }
      @keyframes sunPulse { 0%, 100% { opacity: .35; transform: scale(1); } 50% { opacity: .7; transform: scale(1.18); } }
      @keyframes btnShine { 0%, 82% { transform: translateX(-120%) rotate(18deg); opacity: 0; } 86% { opacity: .9; } 94%, 100% { transform: translateX(160%) rotate(18deg); opacity: 0; } }
      @keyframes birdFly { 0% { transform: translate(-10vw, 0); } 50% { transform: translate(55vw, -24px); } 100% { transform: translate(120vw, -8px); } }
      @keyframes leafFall { 0% { transform: translate(0, -5vh) rotate(0deg); opacity: 0; } 8% { opacity: .9; } 100% { transform: translate(-90px, 108vh) rotate(560deg); opacity: 0; } }
    `}</style>
    <div style={{ minHeight: "100vh", background: bg, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 22px 84px" }}>
      {/* 流れる雲（島の生きてる感） */}
      <div style={{ position: "fixed", top: "8%", left: 0, width: 120, height: 36, background: "rgba(255,255,255,.75)", borderRadius: 999, filter: "blur(2px)", animation: "cloudDrift 75s linear infinite", pointerEvents: "none", zIndex: 1, boxShadow: "30px -12px 0 -4px rgba(255,255,255,.65), 60px 0 0 -2px rgba(255,255,255,.7)" }} />
      <div style={{ position: "fixed", top: "16%", left: 0, width: 90, height: 28, background: "rgba(255,255,255,.6)", borderRadius: 999, filter: "blur(2px)", animation: "cloudDrift 110s linear infinite", animationDelay: "-40s", pointerEvents: "none", zIndex: 1, boxShadow: "24px -10px 0 -3px rgba(255,255,255,.5)" }} />
      {/* 太陽のきらめき */}
      <div style={{ position: "fixed", top: "6.5%", right: "7%", width: 90, height: 90, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,244,190,.8) 0%, rgba(255,244,190,0) 70%)", animation: "sunPulse 5s ease-in-out infinite", pointerEvents: "none", zIndex: 1 }} />
      {/* 遠くを飛ぶ鳥 */}
      <div style={{ position: "fixed", top: "13%", left: 0, animation: "birdFly 34s linear infinite", pointerEvents: "none", zIndex: 1, display: "flex", gap: 6 }}>
        {[0,1].map(i => (
          <div key={i} style={{ width: 14, height: 7, position: "relative", top: i * 4 }}>
            <div style={{ position: "absolute", left: 0, width: 8, height: 8, border: "1.6px solid rgba(55,65,85,.5)", borderColor: "rgba(55,65,85,.5) transparent transparent transparent", borderRadius: "50%", transform: "rotate(12deg)" }} />
            <div style={{ position: "absolute", left: 6, width: 8, height: 8, border: "1.6px solid rgba(55,65,85,.5)", borderColor: "rgba(55,65,85,.5) transparent transparent transparent", borderRadius: "50%", transform: "rotate(-12deg)" }} />
          </div>
        ))}
      </div>
      {/* 舞い落ちる葉っぱ */}
      <div style={{ position: "fixed", top: 0, left: "72%", fontSize: 14, animation: "leafFall 16s linear infinite", animationDelay: "-3s", pointerEvents: "none", zIndex: 1, opacity: 0 }}>🍃</div>
      <div style={{ position: "fixed", top: 0, left: "22%", fontSize: 12, animation: "leafFall 21s linear infinite", animationDelay: "-12s", pointerEvents: "none", zIndex: 1, opacity: 0 }}>🍃</div>
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", minHeight: "calc(100vh - 70px)" }}>
        {/* 上部 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", animation: "popIn 0.5s ease-out both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {avatarId && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={`/avatars/${avatarId}.png`} alt="avatar" onClick={() => router.push("/avatar")} style={{ width: 46, height: 46, objectFit: "cover", objectPosition: "top", borderRadius: "50%", background: "#fff", boxShadow: "0 4px 12px rgba(43,52,64,.12)", cursor: "pointer" }} />
            )}
            <div>
              <div style={{ fontSize: 13, color: helloColor }}>{greeting()}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: nameColor }}>{name || "ゲスト"}さん</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            
            <button onClick={toggleSound} style={{ border: "none", background: "#fff", borderRadius: 20, padding: "7px 12px", fontSize: 15, cursor: "pointer", boxShadow: "0 4px 14px rgba(43,52,64,.08)", opacity: soundOn ? 1 : 0.55 }}>{soundOn ? "🔊" : "🔇"}</button>
            <div style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 20, padding: "7px 13px", fontSize: 14, fontWeight: 900, ...flameStyle }}>🔥 {streak}</div>
          </div>
        </div>

        {/* アバター未作成の人への導線 */}
        {!avatarId && (
          <div onClick={() => router.push("/avatar")} style={{ marginTop: 14, borderRadius: 18, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, background: isDark ? "linear-gradient(135deg, rgba(255,180,92,.15), rgba(255,138,61,.08))" : "linear-gradient(135deg, #fff3e4, #ffe8d1)", border: isDark ? "1px solid rgba(255,180,92,.3)" : "1px solid #ffd9ae", animation: "popIn 0.5s ease-out 0.1s both" }}>
            <div style={{ fontSize: 30 }}>🧑‍🎨</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 900, color: isDark ? "#ffcf9e" : "#c2410c" }}>きみの分身をつくろう！</div>
              <div style={{ fontSize: 11.5, color: isDark ? "#c9a882" : "#9a6a3a", marginTop: 2 }}>ホームに登場するアバターをえらべるよ</div>
            </div>
            <div style={{ fontSize: 16, color: isDark ? "#ffb45c" : "#ff8a3d", fontWeight: 900 }}>→</div>
          </div>
        )}

        {/* 中央 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, animation: "popIn 0.5s ease-out 0.15s both" }}>
          <div className="iq-ring" style={{ width: 250, height: 250, borderRadius: "50%", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: ringBg, ["--ringPct" as any]: `${pct}%`, filter: isDark ? undefined : undefined }}>
            <div style={{ position: "absolute", width: 218, height: 218, borderRadius: "50%", background: ringInner }} />
            <button onPointerDown={() => setBtnPop(false)} onClick={() => { playPoko(); setBtnPop(true); setTimeout(() => router.push(task.href), 260); }} style={{ animation: btnPop ? "pushPop 0.4s ease-out" : "breathe 3s ease-in-out infinite", position: "relative", width: 176, height: 176, borderRadius: isDark ? "50%" : 0, background: isDark ? btnBg : "url(/island/quest_btn.png) center / contain no-repeat", boxShadow: isDark ? btnShadow : "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", zIndex: 2, transition: "transform 0.08s", transform: "scale(1)", WebkitTapHighlightColor: "transparent" }} onTouchStart={(e) => { e.currentTarget.style.transform = "scale(0.93)"; }} onTouchEnd={(e) => { e.currentTarget.style.transform = "scale(1)"; }}>
              {!isDark && <div style={{ position: "absolute", inset: "14% 12%", borderRadius: "50%", overflow: "hidden", pointerEvents: "none" }}><div style={{ position: "absolute", top: "-20%", left: 0, width: "36%", height: "140%", background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.55) 50%, rgba(255,255,255,0) 100%)", animation: "btnShine 6.5s ease-in-out infinite" }} /></div>}
              <div style={{ fontSize: 50, filter: isDark ? "none" : "drop-shadow(0 2px 3px rgba(120,72,20,.35))" }}>{task.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: 1, textShadow: isDark ? "none" : "0 2px 4px rgba(150,90,20,.7)" }}>{task.label}</div>
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: otherColor }}>今日のクエスト <b style={{ color: isDark ? "#a78bfa" : "#e8590c" }}>{doneCount}/3</b> 達成</div>

          {/* ドットくんの家（累計ポイントで育つ） */}
          <div style={{ width: "100%", marginTop: 4, animation: "popIn 0.5s ease-out 0.3s both" }}>
            <DotHouse totalEarned={totalEarned} accent={isDark ? "#a78bfa" : "#ff8a3d"} light={!isDark} />
          </div>

          {/* ドットくん（リングのすぐ下） */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 20, padding: "12px 16px", width: "100%", animation: "popIn 0.5s ease-out 0.45s both", ...dotRowStyle }}>
            <div onClick={() => router.push("/dotkun")} style={{ flexShrink: 0, position: "relative", cursor: "pointer", animation: "floaty 2.6s ease-in-out infinite" }}><div style={{ animation: "dotHop 7s ease-in-out infinite" }}>
              <DotKun size={44} stage={dotStage(getLevel(totalEarned))} mood="cheer" /></div>
              {petHearts.map(h => (
                <div key={h.id} style={{ position: "absolute", top: 4, left: 16, fontSize: 15, pointerEvents: "none", animation: "heartPop 0.9s ease-out forwards", ["--hx" as any]: h.hx, ["--hr" as any]: h.hr }}>💗</div>
              ))}
            </div>
            <p style={{ fontSize: 12.5, fontWeight: isDark ? 400 : 600, color: dotTextColor, lineHeight: 1.6, textShadow: isDark ? "none" : "0 1px 3px rgba(40,24,10,.6)" }}>{petMsg || dotMsg}</p>
          </div>
        </div>

        {/* 下部 */}
      </div>
      {/* 下部固定ナビ */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: isDark ? 64 : 88, background: isDark ? "rgba(13,13,24,0.92)" : "transparent", borderTop: isDark ? "1px solid rgba(255,255,255,0.08)" : "none", backdropFilter: isDark ? "blur(12px)" : "none", display: "flex", zIndex: 50, ...(isDark ? {} : { paddingBottom: 6 }) }}>{!isDark && <div style={{ position: "absolute", inset: "4px 6px 10px", background: "url(/island/nav_wood.png) center / 100% 100% no-repeat", zIndex: 0, pointerEvents: "none" }} />}
        {[
          { ic: "🏠", label: "ホーム", href: "/home", active: true },
          { ic: "🏆", label: "ランキング", href: "/ranking", active: false },
          { ic: "👤", label: "マイページ", href: "/mypage", active: false },
          { ic: "☰", label: "メニュー", href: "/menu", active: false },
        ].map((t) => (
          <button key={t.href} onClick={() => { playPoko(); setHopNav(t.href); setTimeout(() => router.push(t.href), 180); }} style={{ position: "relative", zIndex: 1, flex: 1, animation: hopNav === t.href ? "hop 0.35s ease-out" : "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, paddingBottom: 4, background: "transparent", border: "none", cursor: "pointer", color: t.active ? (isDark ? "#a78bfa" : "#fff") : (isDark ? "#6b7280" : "rgba(255,255,255,.75)"), textShadow: isDark ? "none" : "0 1px 2px rgba(90,55,20,.6)" }}>
            <div style={{ fontSize: 20 }}>{t.ic}</div>
            <div style={{ fontSize: 10, fontWeight: 700 }}>{t.label}</div>
          </button>
        ))}
      </div>
      {showEvolve && (() => {
        const NAMES = ["はじまりのテント", "丸太小屋", "一軒家", "大きな家", "豪邸", "ドットくん城"];
        const IMGS = ["/island/house/0_tent.png", "/island/house/1_cabin.png", "/island/house/2_house.png", "/island/house/3_big.png", "/island/house/4_mansion.png", "/island/house/5_castle.png"];
        const isCastle = evolveIdx === 5;
        const confs = isCastle
          ? ["#ffd700","#ffec8b","#f59e0b","#fbbf24","#fff3b0","#ffd700","#f59e0b","#ffec8b","#fbbf24","#ffd700","#fff3b0","#f59e0b","#ffd700","#fbbf24"]
          : ["#fbbf24","#a78bfa","#f472b6","#34d399","#60a5fa","#fbbf24","#f472b6","#a78bfa"];
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2200, padding: 20 }}>
            <div style={{ position: "absolute", inset: 0, background: isCastle ? "radial-gradient(circle, rgba(255,215,0,.5) 0%, rgba(255,215,0,0) 70%)" : "radial-gradient(circle, rgba(255,255,255,.45) 0%, rgba(255,255,255,0) 70%)", animation: "flashGlow 1.4s ease-out" }} />
            {confs.map((c, i) => (
              <div key={i} style={{ position: "absolute", top: 0, left: `${4 + i * (92 / confs.length)}%`, width: isCastle ? 11 : 9, height: isCastle ? 11 : 9, borderRadius: 2, background: c, animation: `confettiFall ${2.2 + (i % 4) * 0.5}s linear ${(i % 5) * 0.3}s infinite` }} />
            ))}
            <div style={{ background: isCastle ? "linear-gradient(135deg, #fff9e0, #ffedb0)" : "linear-gradient(135deg, #fffbeb, #fef3c7)", borderRadius: 24, padding: "30px 26px", maxWidth: 380, width: "100%", textAlign: "center", boxShadow: isCastle ? "0 20px 70px rgba(200,150,0,.5)" : "0 20px 60px rgba(0,0,0,0.3)", position: "relative" }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#b45309", marginBottom: 2 }}>{isCastle ? "👑 GOAL!! 👑" : "✨ おうちが進化！ ✨"}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: isCastle ? "#a16207" : "#b45309", marginBottom: 14 }}>{NAMES[evolveIdx]}{isCastle ? "、完成！" : "になった！"}</div>
              <img src={IMGS[evolveIdx]} alt="new house" style={{ width: isCastle ? 190 : 165, height: "auto", margin: "0 auto 14px", display: "block", animation: "houseReveal 0.9s cubic-bezier(.5,1.6,.4,1) 0.35s both", filter: "drop-shadow(0 10px 16px rgba(120,90,20,.3))" }} />
              <div style={{ fontSize: 12.5, color: "#92400e", lineHeight: 1.7, marginBottom: 18 }}>{isCastle ? "テントから始まった冒険、ついに城まで来たね。きみの積み重ねはホンモノだよ。" : "コツコツの積み重ねがカタチになったよ。この調子！"}</div>
              <button onClick={() => setShowEvolve(false)} style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: isCastle ? "linear-gradient(135deg, #f5c542, #d99e06)" : "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>{isCastle ? "最高！" : "やった！"}</button>
            </div>
          </div>
        );
      })()}
      {showKingPopup && myKings.length > 0 && (
        <div onClick={() => { localStorage.setItem("kingPopupSeen", getTodayJST()); setShowKingPopup(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2100, padding: 20, cursor: "pointer" }}>
          {["#fbbf24","#a78bfa","#f472b6","#34d399","#60a5fa","#fbbf24","#f472b6","#a78bfa","#34d399","#fbbf24"].map((c, i) => (
            <div key={i} style={{ position: "absolute", top: 0, left: `${8 + i * 9}%`, width: 9, height: 9, borderRadius: 2, background: c, animation: `confettiFall ${2.4 + (i % 4) * 0.5}s linear ${(i % 5) * 0.35}s infinite` }} />
          ))}
          <div onClick={(e) => e.stopPropagation()} style={{ background: "linear-gradient(135deg, #fffbeb, #fef3c7)", borderRadius: 24, padding: "32px 28px", maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", cursor: "default" }}>
            <div style={{ fontSize: 40, marginBottom: 4 }}>👑</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#b45309", marginBottom: 4 }}>昨日の称号発表！</div>
            <div style={{ fontSize: 13, color: "#92400e", marginBottom: 20 }}>きみ、こんなにすごかったんだよ</div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><DotKun size={80} mood="cheer" /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {myKings.map((k, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.7)", borderRadius: 14, padding: "14px 16px", textAlign: "left", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ fontSize: 32, flexShrink: 0 }}>{k.emoji}</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#b45309", marginBottom: 3 }}>{k.title}</div>
                    <div style={{ fontSize: 12, color: "#78350f", lineHeight: 1.6 }}>{k.dotkun}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { localStorage.setItem("kingPopupSeen", getTodayJST()); setShowKingPopup(false); }} style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>ありがとう！</button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
