"use client";
import { useEffect, useState } from "react";
import MentorQuestEvent from "../components/MentorQuestEvent";
import MentorInboxBanner from "../components/MentorInboxBanner";
import TodayQuestCard from "../components/TodayQuestCard";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import TutorialMark from "../components/TutorialMark";
import AvatarLayered from "../components/AvatarLayered";
import type { AvatarConfig } from "../lib/avatar/catalog";
import { JOBS, type JobKey } from "../onboarding/job/page";
import DotKun from "../components/DotKun";
import DotHouse, { getHouseStage } from "../components/DotHouse";
import HomeIsland from "../components/HomeIsland";
import HomeHeader2 from "../components/HomeHeader2";
import { fetchCurrentTitle } from "../lib/mypage2";

type Theme = "light" | "dark";
type Task = { key: string; icon: string; label: string; href: string };
type MyKing = { emoji: string; title: string; dotkun: string };

function getLevel(points: number): number { return Math.max(1, Math.floor(points / 100) + 1); }
function dotStage(level: number): number { return level >= 70 ? 5 : level >= 50 ? 4 : level >= 30 ? 3 : level >= 10 ? 2 : 1; }
function jstYesterday(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}
function countEmoji(s: string): number {
  const m = s.match(/\p{Extended_Pictographic}/gu);
  return m ? m.length : 0;
}
const HOME_TIRED_WORDS = ["疲れ", "つかれ", "しんど", "だるい", "ねむい", "眠い"];
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
  const [layered, setLayered] = useState<{ cfg: AvatarConfig; job: JobKey } | null>(null);   // 2.0 のレイヤーアバター（保存済みなら顔を表示）
  const [streak, setStreak] = useState(0);
  const [goals, setGoals] = useState<{ monthly_target: string; monthly_theme: string; quarter_goal: string; career_goal: string }>({ monthly_target: "", monthly_theme: "", quarter_goal: "", career_goal: "" });
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const saveGoals = async () => {
    if (savingGoal) return;
    setSavingGoal(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("user_goals").upsert({
        user_id: user.id,
        monthly_target: goals.monthly_target || null,
        monthly_theme: goals.monthly_theme || null,
        quarter_goal: goals.quarter_goal || null,
        career_goal: goals.career_goal || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }
    setSavingGoal(false);
    setShowGoalModal(false);
  };
  const applyLicense = async (key: string) => {
    if (applyingLicense) return;
    setApplyingLicense(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const next = { ...licenses, [key]: true };
      const { error } = await supabase.from("profiles").update({ licenses: next }).eq("id", user.id);
      if (!error) setLicenses(next);
    }
    setApplyingLicense(false);
  };
  const [totalEarned, setTotalEarned] = useState(0);
  const [homeUserId, setHomeUserId] = useState("");
  const [licenses, setLicenses] = useState<Record<string, boolean>>({});
  const [applyingLicense, setApplyingLicense] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [task, setTask] = useState<Task>({ key: "report", icon: "📝", label: "日報を書く", href: "/report" });
  const [doneCount, setDoneCount] = useState(0);
  const [dotMsg, setDotMsg] = useState("");
  const [myKings, setMyKings] = useState<MyKing[]>([]);
  const [showKingPopup, setShowKingPopup] = useState(false);
  const [showEvolve, setShowEvolve] = useState(false);
  const [evolveIdx, setEvolveIdx] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [ptGain, setPtGain] = useState(0);
  const [showPtFx, setShowPtFx] = useState(false);
  const [barFrom, setBarFrom] = useState<number | null>(null);
  const [missions, setMissions] = useState({ schedule: false, report: false, thinking: false });
  const [petHearts, setPetHearts] = useState<{ id: number; hx: string; hr: string }[]>([]);
  const [petMsg, setPetMsg] = useState<string | null>(null);
  const [petKey, setPetKey] = useState(0);
  const [btnPop, setBtnPop] = useState(false);
  const [hopNav, setHopNav] = useState<string | null>(null);
  const [homeTitle, setHomeTitle] = useState<string | null>(null);   // 直近に獲得した称号（ヘッダー表示用）
  const [jobName, setJobName] = useState<string | null>(null);

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("homeTheme")) as Theme | null;
    if (saved === "light" || saved === "dark") setTheme(saved);
    if (typeof window !== "undefined" && localStorage.getItem("homeSound") === "on") setSoundOn(true);
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("name, streak, avatar_config, licenses, job_class").eq("id", user.id).single();
      const { data: pointRow } = await supabase.from("user_points").select("total_earned").eq("id", user.id).single();
      const te = (pointRow as any)?.total_earned || 0;
      setTotalEarned(te);
      setHomeUserId(user.id);
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
        // pt獲得演出（進化演出が出る時はスキップ）
        const lastTERaw = localStorage.getItem("lastSeenTE");
        if (lastTERaw === null) {
          localStorage.setItem("lastSeenTE", String(te));
        } else {
          const lastTE = parseInt(lastTERaw, 10);
          if (te > lastTE && !(prevRaw !== null && curIdx > parseInt(prevRaw, 10))) {
            setPtGain(te - lastTE);
            setBarFrom(lastTE);
            setShowPtFx(true);
            setTimeout(() => setShowPtFx(false), 3200);
          }
          localStorage.setItem("lastSeenTE", String(te));
        }
      } catch {}
      if (profile) {
        setName((profile as any).name || "");
        setLicenses((profile as any).licenses || {});
        setAvatarId((profile as any).avatar_config?.id || null);
        { const ac = (profile as any).avatar_config; const jc = (profile as any).job_class; setLayered(ac?.type === "layered" && jc && JOBS.some((j) => j.key === jc) ? { cfg: ac, job: jc } : null); setJobName(JOBS.find((j) => j.key === jc)?.name ?? null); }
        setStreak((profile as any).streak || 0);
        const { data: goalRow } = await supabase.from("user_goals").select("*").eq("user_id", user.id).maybeSingle();
        if (goalRow) setGoals({ monthly_target: (goalRow as any).monthly_target || "", monthly_theme: (goalRow as any).monthly_theme || "", quarter_goal: (goalRow as any).quarter_goal || "", career_goal: (goalRow as any).career_goal || "" });

      }
      // ヘッダーの称号（直近に獲得したバッジ。読み取りのみ・失敗しても HOME には影響させない）
      fetchCurrentTitle(supabase, user.id).then((t) => setHomeTitle(t?.name ?? null)).catch(() => {});
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
      setMissions({ schedule: scheduleDone, report: reportDone, thinking: thinkingDone });

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
          const kingYmd = jstYesterday();
          const zoro = subs.filter((x: any) => { const j = new Date(new Date(x.created_at).getTime() + 9 * 3600000); return j.getUTCMinutes() % 11 === 0; });
          const zoroPick: any = seededPick(zoro, kingYmd + "zoro");
          if (zoroPick && zoroPick.user_id === user.id) myKingList.push({ emoji: "🎰", title: "ゾロ目王", dotkun: "昨日はゾロ目のタイミングで日報を出してたよ！強運の持ち主かも🎰" });
          if (subs[subs.length - 1].user_id === user.id) myKingList.push({ emoji: "🌙", title: "ラストマン王", dotkun: "昨日いちばん最後まで頑張ってたね！おつかれさま🌙" });
          let shortest = subs[0];
          subs.forEach((x: any) => { if ((x.content?.length || 0) < (shortest.content?.length || 0)) shortest = x; });
          if (shortest.user_id === user.id) myKingList.push({ emoji: "🏃", title: "瞬速王", dotkun: "昨日いちばんスパッと要点をまとめてたね！スピード感◎🏃" });
          const byEmoji = subs.map((x: any) => ({ uid: x.user_id, n: countEmoji(x.content || "") })).sort((a: any, b: any) => b.n - a.n);
          if (byEmoji[0].n > 0 && byEmoji[0].uid === user.id) myKingList.push({ emoji: "🎨", title: "絵文字職人", dotkun: "昨日いちばん絵文字を使いこなしてたよ！表現力ゆたか🎨" });
          const tired = subs.filter((x: any) => HOME_TIRED_WORDS.some(w => (x.content || "").includes(w)));
          const tiredPick: any = seededPick(tired, kingYmd + "tired");
          if (tiredPick && tiredPick.user_id === user.id) myKingList.push({ emoji: "😴", title: "おつかれ王", dotkun: "昨日はおつかれ気味だったかな？ちゃんと休んでね🍵" });
        }
        {
          const kingYmd2 = jstYesterday();
          const activeSet = new Set<string>();
          (kThanks as any[] || []).forEach(t => { if (t.to_user_id) activeSet.add(t.to_user_id); });
          (kSubs as any[] || []).forEach(x => { if (x.user_id) activeSet.add(x.user_id); });
          const activeIds = Array.from(activeSet);
          if (activeIds.length) {
            if (seededPick(activeIds, kingYmd2 + "lucky") === user.id) myKingList.push({ emoji: "🎲", title: "ラッキー王", dotkun: "今日はいいことあるかも！ラッキーデーだよ🎲" });
            if (seededPick(activeIds, kingYmd2 + "star") === user.id) myKingList.push({ emoji: "🎉", title: "本日の主役", dotkun: "今日はあなたが主役！すてきな一日になりますように🎉" });
          }
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
  // ===== Intern Quest 2.0 HOME（GPT素材下敷き＋実データ重ね。ロジック・保存処理は上と同じまま） =====
  const QUESTS = [
    { key: "schedule" as const, icon: "/home/icon_schedule.webp", tag: "朝のクエスト", label: "今日の作戦を立てる", desc: "今日の目標と行動予定を設定しよう", href: "/today-schedule" },
    { key: "report" as const, icon: "/home/icon_report.webp", tag: "夕方のクエスト", label: "冒険の記録を残す", desc: "今日の成果・学び・改善点を記録しよう", href: "/report" },
    { key: "thinking" as const, icon: "/home/icon_thinking.webp", tag: "成長のクエスト", label: "今日の思考クエスト", desc: "1問のお題に答えて思考力を鍛えよう", href: "/thinking" },
  ];

  if (loading) return <div style={{ minHeight: "100vh", background: "url(/home/bg_mobile.webp) center top / cover no-repeat fixed, #bfe3f5", display: "flex", alignItems: "center", justifyContent: "center", color: "#5a6b85", fontWeight: 800 }}>読み込み中...</div>;

  return (
    <>
    <TutorialMark id="home" />
    <MentorQuestEvent />
    <MentorInboxBanner />
    <TodayQuestCard />
    <style>{`
      @keyframes floaty { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      @keyframes popIn { 0% { opacity: 0; transform: translateY(16px) scale(0.86); } 55% { opacity: 1; transform: translateY(-3px) scale(1.05); } 78% { transform: translateY(1px) scale(0.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes flashGlow { 0% { opacity: 0; } 30% { opacity: 1; } 100% { opacity: 0; } }
      @keyframes houseReveal { 0% { opacity: 0; transform: scale(0.3) translateY(30px); } 55% { opacity: 1; transform: scale(1.15) translateY(-6px); } 75% { transform: scale(0.95) translateY(2px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
      @keyframes ptFloat { 0% { opacity: 0; transform: translateY(12px) scale(0.7); } 18% { opacity: 1; transform: translateY(0) scale(1.15); } 30% { transform: translateY(-2px) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(-42px) scale(1); } }
      @keyframes sparklePop { 0% { opacity: 0; transform: translate(0,0) scale(0.3) rotate(0deg); } 25% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--sx), var(--sy)) scale(1.2) rotate(180deg); } }
      @keyframes confettiFall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0.7; } }
      @keyframes petSquish { 0% { transform: scale(1,1); } 15% { transform: scale(1.15,0.82) translateY(4px); } 40% { transform: scale(0.9,1.15) translateY(-8px); } 65% { transform: scale(1.06,0.96); } 100% { transform: scale(1,1); } }
      @keyframes heartPop { 0% { transform: translate(0,0) scale(0.3) rotate(0deg); opacity: 1; } 40% { opacity: 1; } 100% { transform: translate(var(--hx), -52px) scale(1.3) rotate(var(--hr)); opacity: 0; } }
      @keyframes hop { 0% { transform: translateY(0) scale(1); } 30% { transform: translateY(-7px) scale(1.12, 0.9); } 60% { transform: translateY(0) scale(0.94, 1.08); } 100% { transform: translateY(0) scale(1); } }
      .hq-page{min-height:100vh;overflow-x:clip;background:url(/home/bg_mobile.webp) center top / cover no-repeat fixed, #bfe3f5;display:flex;flex-direction:column;align-items:center;padding:14px 14px 132px;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif}
      .hq-col{width:100%;max-width:480px;display:flex;flex-direction:column}
      @media (min-width:700px){ .hq-page{background-image:url(/home/bg_pc.webp);padding-top:28px} .hq-col{max-width:640px} }
      .hq-top{display:flex;justify-content:flex-end;margin:0 2px 8px}
      .hq-title{position:relative;width:min(94%,560px);margin:26px auto 0;container-type:inline-size;z-index:2}
      .hq-title img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 14px rgba(20,40,90,.3))}
      .hq-title>div{position:absolute;inset:14% 8% 8%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;pointer-events:none}
      .hq-title .t1{font-size:clamp(16px,6cqw,27px);font-weight:900;letter-spacing:.06em;text-shadow:0 2px 4px rgba(10,25,70,.55)}
      .hq-title .t2{font-size:clamp(8px,2.2cqw,11px);font-weight:800;letter-spacing:.42em;color:#cfe0ff;margin-top:1%}
      .hq-panel{position:relative;margin-top:-10px;padding:8.5% 7% 8%;background:url(/home/quest_panel.webp);background-size:100% 100%;display:flex;flex-direction:column;gap:12px;container-type:inline-size}
      .hq-prog{align-self:center;display:flex;align-items:center;gap:10px;background:linear-gradient(180deg,#fffdf4,#f8efdb);border:2px solid #e2bf63;border-radius:999px;padding:5px 22px;font-weight:900;color:#7a5a1a;font-size:clamp(12px,3.6cqw,15px);box-shadow:0 2px 6px rgba(140,100,30,.18)}
      .hq-prog b{color:#17397d;font-size:1.25em}
      .hq-prog .dia{color:#e0b24a;font-size:.8em}
      .hq-card{position:relative;border:none;background:transparent;padding:0;cursor:pointer;text-align:left;font-family:inherit;container-type:inline-size;-webkit-tap-highlight-color:transparent}
      .hq-card:disabled{cursor:default}
      .hq-card>img{display:block;width:100%;height:auto}
      .hq-card .in{position:absolute;inset:8% 5%;display:flex;align-items:center;gap:3.5%}
      .hq-card .ic{height:96%;width:auto;flex:none;filter:drop-shadow(0 2px 3px rgba(120,90,30,.25))}
      .hq-card .tx{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:3.5%}
      .hq-card .tag{background:linear-gradient(180deg,#f7d264,#e3a62e);color:#6e4606;font-weight:900;font-size:clamp(9px,2.7cqw,12px);padding:.22em .9em;border-radius:999px;box-shadow:inset 0 1px 0 rgba(255,255,255,.6)}
      .hq-card .qt{font-size:clamp(14px,4.6cqw,22px);font-weight:900;color:#17397d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
      .hq-card .qd{font-size:clamp(10px,3cqw,13px);font-weight:700;color:#8a8f9c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
      .hq-card .st{flex:none;width:12.5%;display:flex;align-items:center;justify-content:center}
      .hq-card .st img{width:82%;height:auto}
      .hq-card .st .todo{width:68%;aspect-ratio:1;border:3px solid #cfd4dd;border-radius:50%;background:#fff;box-sizing:border-box}
      .hq-luku{display:flex;align-items:flex-end;margin-top:18px;container-type:inline-size}
      .hq-luku .lk{width:29%;flex:none;position:relative;cursor:pointer;z-index:2;animation:floaty 2.8s ease-in-out infinite}
      .hq-luku .lk img{width:100%;display:block;filter:drop-shadow(0 6px 10px rgba(30,40,90,.3))}
      .hq-luku .bw{flex:1;min-width:0;display:flex;flex-direction:column;margin-bottom:4%}
      .hq-luku .pl{width:36%;min-width:96px;position:relative;margin-left:5%;z-index:2}
      .hq-luku .pl img{display:block;width:100%;height:auto}
      .hq-luku .pl span{position:absolute;inset:0 0 6% 0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:clamp(11px,3.2cqw,15px);letter-spacing:.2em;text-shadow:0 1px 3px rgba(10,25,70,.6)}
      .hq-luku .bub{margin-top:-5%;background:url(/home/luku_bubble.webp);background-size:100% 100%;padding:8% 7% 11% 8.5%;font-weight:800;color:#4a3519;font-size:clamp(12px,3.6cqw,15px);line-height:1.7;cursor:pointer}
      .hq-nav{position:fixed;left:0;bottom:0;width:100%;max-width:100vw;box-sizing:border-box;z-index:50;display:flex;height:calc(86px + env(safe-area-inset-bottom));padding:0 10px calc(10px + env(safe-area-inset-bottom));overflow:hidden}
      .hq-nav .band{position:absolute;inset:6px 8px calc(8px + env(safe-area-inset-bottom));background:url(/home/nav_bar.webp);background-size:100% 100%;pointer-events:none}
      .hq-nav button{position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;padding-bottom:calc(17px + env(safe-area-inset-bottom));background:transparent;border:none;cursor:pointer;color:#fff;text-shadow:0 1px 2px rgba(70,40,10,.7);-webkit-tap-highlight-color:transparent}
      .hq-nav .lbl{font-size:10.5px;font-weight:800}
    `}</style>
    <div className="hq-page">
      <div className="hq-col">
        {/* 右上：サウンド切替（既存機能） */}
        <div className="hq-top">
          <button onClick={toggleSound} style={{ border: "none", background: "rgba(255,255,255,.85)", borderRadius: 20, padding: "7px 12px", fontSize: 15, cursor: "pointer", boxShadow: "0 4px 14px rgba(43,52,64,.15)", opacity: soundOn ? 1 : 0.55 }}>{soundOn ? "🔊" : "🔇"}</button>
        </div>

        {/* A. 冒険者ヘッダー（枠素材＋実データ） */}
        <div style={{ animation: "popIn 0.5s ease-out both" }}>
          <HomeHeader2
            name={name}
            jobName={jobName}
            level={getLevel(totalEarned)}
            exp={totalEarned % 100}
            streak={streak}
            title={homeTitle}
            avatar={layered}
            onAvatarClick={() => router.push("/onboarding/avatar?from=home")}
          />
        </div>

        {/* アバター未作成の人への導線（既存） */}
        {!avatarId && (
          <div onClick={() => router.push("/onboarding/avatar?from=home")} style={{ marginTop: 12, borderRadius: 18, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(135deg, #fff3e4, #ffe8d1)", border: "1px solid #ffd9ae", animation: "popIn 0.5s ease-out 0.1s both" }}>
            <div style={{ fontSize: 30 }}>🧑‍🎨</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 900, color: "#c2410c" }}>きみの分身をつくろう！</div>
              <div style={{ fontSize: 11.5, color: "#9a6a3a", marginTop: 2 }}>ホームに登場するアバターをえらべるよ</div>
            </div>
            <div style={{ fontSize: 16, color: "#ff8a3d", fontWeight: 900 }}>→</div>
          </div>
        )}

        {/* B. 中央の浮島（既存の島・コレクション・ショップ機能をそのまま維持） */}
        <div style={{ width: "100%", marginTop: 14, animation: "popIn 0.5s ease-out 0.2s both", position: "relative", overflow: "hidden", padding: "4px 2px 6px" }}>
          {showPtFx && (
            <div style={{ position: "absolute", top: -8, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 5, pointerEvents: "none" }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#f59e0b", textShadow: "0 2px 0 #fff, 0 3px 8px rgba(180,120,0,.45)", animation: "ptFloat 3s ease-out both" }}>+{ptGain.toLocaleString()}pt</div>
              {["-52px,-38px","44px,-46px","-28px,-64px","58px,-20px","-64px,-12px","30px,-70px"].map((d, i) => {
                const [sx, sy] = d.split(",");
                return <div key={i} style={{ position: "absolute", top: 18, left: "50%", fontSize: 15, animation: `sparklePop ${0.9 + (i % 3) * 0.25}s ease-out ${i * 0.14}s both`, ["--sx" as any]: sx, ["--sy" as any]: sy, pointerEvents: "none" }}>{i % 2 === 0 ? "✨" : "⭐"}</div>;
              })}
            </div>
          )}
          <HomeIsland userId={homeUserId} totalEarned={totalEarned} onHouseClick={() => { playPoko(); router.push("/mypage"); }} />
        </div>

        {/* C. 今日の冒険クエスト（見出しプレート＋羊皮紙パネル＋カード3枚。完了判定・遷移先は既存のまま） */}
        <div className="hq-title" style={{ animation: "popIn 0.5s ease-out 0.35s both" }}>
          <img src="/home/title_plate.webp" alt="" width={1200} height={374} />
          <div><span className="t1">今日の冒険クエスト</span><span className="t2">DAILY QUEST</span></div>
        </div>
        <div className="hq-panel" style={{ animation: "popIn 0.5s ease-out 0.4s both" }}>
          <div className="hq-prog"><span className="dia">◆</span>達成状況<b>{doneCount}/3</b><span className="dia">◆</span></div>
          {QUESTS.map((q) => {
            const done = missions[q.key];
            return (
              <button key={q.key} className="hq-card" disabled={done} onClick={() => { if (!done) { playPoko(); router.push(q.href); } }}>
                <img src="/home/quest_card.webp" alt="" width={1300} height={267} />
                <div className="in">
                  <img className="ic" src={q.icon} alt="" />
                  <div className="tx">
                    <span className="tag">{q.tag}</span>
                    <span className="qt">{q.label}</span>
                    <span className="qd">{q.desc}</span>
                  </div>
                  <div className="st">{done ? <img src="/home/check_done.webp" alt="達成" /> : <div className="todo" />}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* D. ルクの案内（タップで今日のおすすめへ。ルクをなでると喜ぶ＝既存のなでなで機能） */}
        <div className="hq-luku" style={{ animation: "popIn 0.5s ease-out 0.5s both" }}>
          <div className="lk" onClick={handlePet}>
            <img key={petKey} src="/onboarding/luku.png" alt="ルク" style={{ animation: petKey ? "petSquish 0.7s ease-out" : undefined }} />
            {petHearts.map(h => (
              <div key={h.id} style={{ position: "absolute", top: "14%", left: "40%", fontSize: 16, pointerEvents: "none", animation: "heartPop 0.9s ease-out forwards", ["--hx" as any]: h.hx, ["--hr" as any]: h.hr }}>💗</div>
            ))}
          </div>
          <div className="bw">
            <div className="pl"><img src="/home/luku_plate.webp" alt="" /><span>ルク</span></div>
            <div className="bub" onClick={() => { playPoko(); router.push(task.href); }}>{petMsg || dotMsg}</div>
          </div>
        </div>
      </div>

      {/* E. 下部ナビ（4項目・リンク先・動作は既存のまま。帯とホーム/おうちは提供素材、他は従来表示） */}
      <div className="hq-nav">
        <div className="band" />
        {[
          { key: "home", label: "ホーム", href: "/home" },
          { key: "ranking", label: "ランキング", href: "/ranking" },
          { key: "house", label: "おうち", href: "/mypage" },
          { key: "menu", label: "メニュー", href: "/menu" },
        ].map((t) => (
          <button key={t.href} onClick={() => { playPoko(); setHopNav(t.href); setTimeout(() => router.push(t.href), 180); }} style={{ animation: hopNav === t.href ? "hop 0.35s ease-out" : "none" }}>
            {t.key === "home" && <img src="/home/nav_home_active.webp" alt="" style={{ height: 46, marginBottom: -2, filter: "drop-shadow(0 3px 5px rgba(30,40,90,.4))" }} />}
            {t.key === "ranking" && <img src="/home/nav_trophy.webp" alt="" style={{ height: 30 }} />}
            {t.key === "house" && <img src="/home/nav_house.webp" alt="" style={{ height: 30 }} />}
            {t.key === "menu" && <div style={{ fontSize: 20, lineHeight: "30px" }}>☰</div>}
            <div className="lbl">{t.label}</div>
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
      {showGoalModal && (
        <div onClick={() => setShowGoalModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20001, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#15132b", border: "1px solid rgba(139,92,246,0.35)", borderRadius: 18, padding: 24, width: "100%", maxWidth: 440, maxHeight: "80vh", overflowY: "auto", paddingBottom: 90 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", marginBottom: 4 }}>🎯 目標を設定</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 18 }}>ホーム画面に常に表示されます</div>
            {[
              { key: "monthly_target", label: "📊 今月の目標（数字）", ph: "例：アポ30件 / 売上50万" },
              { key: "monthly_theme", label: "💡 今月のテーマ", ph: "例：即レス徹底" },
              { key: "quarter_goal", label: "📈 3ヶ月目標", ph: "例：四半期で80件" },
              { key: "career_goal", label: "🏁 就活ゴール", ph: "例：Aランク企業内定" },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#c4b5fd", marginBottom: 5 }}>{f.label}</div>
                <input value={(goals as any)[f.key]} onChange={(e) => setGoals({ ...goals, [f.key]: e.target.value })} placeholder={f.ph} style={{ width: "100%", padding: "11px 13px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            <button onClick={saveGoals} disabled={savingGoal} style={{ width: "100%", marginTop: 6, padding: 13, borderRadius: 12, border: "none", cursor: "pointer", fontSize: 15, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", opacity: savingGoal ? 0.6 : 1 }}>{savingGoal ? "保存中..." : "保存する"}</button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
