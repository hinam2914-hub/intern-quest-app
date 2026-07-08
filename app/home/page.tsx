"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import DotKun from "../components/DotKun";
import DotHouse from "../components/DotHouse";

type Theme = "light" | "dark";
type Task = { key: string; icon: string; label: string; href: string };
type MyKing = { emoji: string; title: string; dotkun: string };

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
  const [streak, setStreak] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [theme, setTheme] = useState<Theme>("light");
  const [task, setTask] = useState<Task>({ key: "report", icon: "📝", label: "日報を書く", href: "/report" });
  const [doneCount, setDoneCount] = useState(0);
  const [dotMsg, setDotMsg] = useState("");
  const [myKings, setMyKings] = useState<MyKing[]>([]);
  const [showKingPopup, setShowKingPopup] = useState(false);

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("homeTheme")) as Theme | null;
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("name, streak").eq("id", user.id).single();
      const { data: pointRow } = await supabase.from("user_points").select("total_earned").eq("id", user.id).single();
      setTotalEarned((pointRow as any)?.total_earned || 0);
      if (profile) {
        setName((profile as any).name || "");
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
      if (hourJST >= 20 && !reportDone) {
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
        chosen = pool.length > 0 ? seededPick(pool, seed) : { key: "gacha", icon: "🎰", label: "ガチャを回す", href: "/gacha" };
        if (scheduleDone && thinkingDone) {
          chosen = seededPick([chosen, { key: "gacha", icon: "🎰", label: "ガチャを回す", href: "/gacha" }], seed + "g");
        }
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

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof window !== "undefined") localStorage.setItem("homeTheme", next);
  };

  const isDark = theme === "dark";
  const bg = isDark ? "radial-gradient(circle at 50% 30%, #14142b 0%, #0a0a0f 65%)" : "#fdfdfb";
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
  const btnBg = isDark ? "linear-gradient(150deg, #6366f1, #8b5cf6)" : "linear-gradient(150deg, #ffb45c, #ff8a3d)";
  const btnShadow = isDark
    ? "0 0 50px rgba(99,102,241,.5), inset 0 -6px 0 rgba(0,0,0,.2)"
    : "0 18px 40px rgba(255,138,61,.35), inset 0 -8px 0 rgba(0,0,0,.08)";
  const dotRowStyle = isDark
    ? { background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.22)" }
    : { background: "#fff", boxShadow: "0 6px 20px rgba(43,52,64,.08)" };
  const dotTextColor = isDark ? "#c7d2fe" : "#4b5563";
  const otherColor = isDark ? "#6b7280" : "#6f7a86";

  if (loading) return <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: helloColor }}>読み込み中...</div>;

  return (
    <>
    <style>{`
      @keyframes floaty { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
      @keyframes fadeInUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes ringGlow { 0%, 100% { filter: drop-shadow(0 0 18px rgba(139,92,246,0.25)); } 50% { filter: drop-shadow(0 0 34px rgba(139,92,246,0.55)); } }
      @keyframes confettiFall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0.7; } }
      @property --ringPct { syntax: "<percentage>"; inherits: false; initial-value: 0%; }
      @keyframes ringFill { from { --ringPct: 0%; } }
      .iq-ring { animation: ringFill 1.1s ease-out both; }
    `}</style>
    <div style={{ minHeight: "100vh", background: bg, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 22px 84px" }}>
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", minHeight: "calc(100vh - 70px)" }}>
        {/* 上部 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", animation: "fadeInUp 0.5s ease-out both" }}>
          <div>
            <div style={{ fontSize: 13, color: helloColor }}>{greeting()}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: nameColor }}>{name || "ゲスト"}さん</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={toggleTheme} style={{ border: "none", background: isDark ? "rgba(255,255,255,.06)" : "#fff", borderRadius: 20, padding: "7px 12px", fontSize: 16, cursor: "pointer", boxShadow: isDark ? "none" : "0 4px 14px rgba(43,52,64,.08)" }}>{isDark ? "🌙" : "☀️"}</button>
            <div style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 20, padding: "7px 13px", fontSize: 14, fontWeight: 900, ...flameStyle }}>🔥 {streak}</div>
          </div>
        </div>

        {/* 中央 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, animation: "fadeInUp 0.5s ease-out 0.15s both" }}>
          <div className="iq-ring" style={{ width: 250, height: 250, borderRadius: "50%", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: ringBg, ["--ringPct" as any]: `${pct}%`, filter: isDark ? undefined : undefined }}>
            <div style={{ position: "absolute", width: 218, height: 218, borderRadius: "50%", background: ringInner }} />
            <button onClick={() => router.push(task.href)} style={{ animation: "breathe 3s ease-in-out infinite", position: "relative", width: 176, height: 176, borderRadius: isDark ? "50%" : 44, background: btnBg, boxShadow: btnShadow, border: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", zIndex: 2 }}>
              <div style={{ fontSize: 52 }}>{task.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: 1 }}>{task.label}</div>
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: otherColor }}>今日のクエスト <b style={{ color: isDark ? "#a78bfa" : "#e8590c" }}>{doneCount}/3</b> 達成</div>

          {/* ドットくんの家（累計ポイントで育つ） */}
          <div style={{ width: "100%", marginTop: 4, animation: "fadeInUp 0.5s ease-out 0.3s both" }}>
            <DotHouse totalEarned={totalEarned} accent={isDark ? "#a78bfa" : "#ff8a3d"} light={!isDark} />
          </div>

          {/* ドットくん（リングのすぐ下） */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 20, padding: "12px 16px", width: "100%", animation: "fadeInUp 0.5s ease-out 0.45s both", ...dotRowStyle }}>
            <div style={{ flexShrink: 0, animation: "floaty 2.6s ease-in-out infinite" }}><DotKun size={44} mood="cheer" /></div>
            <p style={{ fontSize: 12.5, color: dotTextColor, lineHeight: 1.6 }}>{dotMsg}</p>
          </div>
        </div>

        {/* 下部 */}
      </div>
      {/* 下部固定ナビ */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 64, background: isDark ? "rgba(13,13,24,0.92)" : "rgba(255,255,255,0.95)", borderTop: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)", backdropFilter: "blur(12px)", display: "flex", zIndex: 50 }}>
        {[
          { ic: "🏠", label: "ホーム", href: "/home", active: true },
          { ic: "🏆", label: "ランキング", href: "/ranking", active: false },
          { ic: "👤", label: "マイページ", href: "/mypage", active: false },
          { ic: "☰", label: "メニュー", href: "/menu", active: false },
        ].map((t) => (
          <button key={t.href} onClick={() => router.push(t.href)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: "transparent", border: "none", cursor: "pointer", color: t.active ? (isDark ? "#a78bfa" : "#e8590c") : (isDark ? "#6b7280" : "#9ca3af") }}>
            <div style={{ fontSize: 20 }}>{t.ic}</div>
            <div style={{ fontSize: 10, fontWeight: 700 }}>{t.label}</div>
          </button>
        ))}
      </div>
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
