"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import DotKun from "../components/DotKun";

function toJSTDateOnly(iso: string): string {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}
function jstYesterday(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}
// 昨日のJST 0:00〜24:00 を UTC ISO文字列の範囲で返す
function yesterdayRangeUTC(): { start: string; end: string } {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jstNow.getUTCFullYear(), m = jstNow.getUTCMonth(), d = jstNow.getUTCDate();
  // 今日のJST0時(UTC) = 昨日のJST末。昨日のJST0時 = それの24時間前
  const todayJst0_utc = Date.UTC(y, m, d) - 9 * 60 * 60 * 1000;
  const start = new Date(todayJst0_utc - 24 * 60 * 60 * 1000).toISOString();
  const end = new Date(todayJst0_utc).toISOString();
  return { start, end };
}
function countEmoji(s: string): number {
  const m = s.match(/\p{Extended_Pictographic}/gu);
  return m ? m.length : 0;
}
function seededPick<T>(arr: T[], seedStr: string): T | null {
  if (!arr.length) return null;
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) { h = (h * 31 + seedStr.charCodeAt(i)) >>> 0; }
  return arr[h % arr.length];
}
const TIRED_WORDS = ["疲れ", "つかれ", "しんど", "だるい", "ねむい", "眠い"];

type Mood = "happy" | "cheer" | "normal";
type King = { emoji: string; title: string; desc: string; name: string | null; detail?: string; dotkun: string; mood: Mood };

export default function KingsPage() {
  const router = useRouter();
  const [kings, setKings] = useState<King[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState("");

  useEffect(() => {
    (async () => {
      const ymd = jstYesterday();
      setToday(ymd);

      const { data: profs } = await supabase.from("profiles").select("id, name, streak").eq("is_active", true);
      const nameMap: Record<string, string> = {};
      (profs || []).forEach((p: any) => { nameMap[p.id] = p.name || "名前未設定"; });

      const range = yesterdayRangeUTC();
      const { data: thanksRows } = await supabase
        .from("thanks").select("to_user_id, created_at")
        .gte("created_at", range.start).lt("created_at", range.end);
      const dayThanks = thanksRows || [];

      const { data: subs } = await supabase
        .from("submissions").select("user_id, created_at, content")
        .gte("created_at", range.start).lt("created_at", range.end)
        .order("created_at", { ascending: true });
      const daySubs = subs || [];

      const nm = (uid: string | undefined): string | null => uid ? (nameMap[uid] || "名前未設定") : null;
      const result: King[] = [];

      // 連続記録王（streak最大）
      const byStreak = [...(profs || [])]
        .map((p: any) => ({ uid: p.id, streak: p.streak || 0 }))
        .filter(p => p.streak > 0)
        .sort((a, b) => b.streak - a.streak);
      result.push({ emoji: "🔥", title: "連続記録王", desc: "日報の連続記録がいちばん長い", dotkun: "毎日えらすぎ…その継続力、尊敬しかない🔥", mood: "happy",
        name: byStreak.length ? nm(byStreak[0].uid) : null,
        detail: byStreak.length ? `${byStreak[0].streak}日連続` : undefined });
      // サンキュー王（昨日いちばんサンキューを受け取った人）
      const thanksCount: Record<string, number> = {};
      dayThanks.forEach((t: any) => { if (t.to_user_id) thanksCount[t.to_user_id] = (thanksCount[t.to_user_id] || 0) + 1; });
      const byThanks = Object.entries(thanksCount).sort((a, b) => b[1] - a[1]);
      result.push({ emoji: "🙏", title: "サンキュー王", desc: "昨日いちばんサンキューをもらった", dotkun: "みんなから感謝されてる…人徳だね🙏✨", mood: "happy",
        name: byThanks.length ? nm(byThanks[0][0]) : null,
        detail: byThanks.length ? `${byThanks[0][1]}件` : undefined });
      result.push({ emoji: "📝", title: "一番乗り王", desc: "昨日いちばん早く日報を提出", dotkun: "一番乗り！さすがの仕事の速さ⚡", mood: "cheer",
        name: daySubs.length ? nm(daySubs[0].user_id) : null });
      // ラストマン王
      result.push({ emoji: "🔚", title: "ラストマン王", desc: "昨日いちばん遅く日報を提出", dotkun: "最後まで残ってえらい…おつかれさま🌛", mood: "normal",
        name: daySubs.length ? nm(daySubs[daySubs.length - 1].user_id) : null });

      // 長文王・瞬速王
      if (daySubs.length) {
        const byLen = [...daySubs].sort((a, b) => (b.content?.length || 0) - (a.content?.length || 0));
        result.push({ emoji: "💬", title: "長文王", desc: "昨日いちばん長い日報", dotkun: "読むの大変だったよ…でも熱意は伝わった！📖", mood: "happy",
          name: nm(byLen[0].user_id), detail: `${byLen[0].content?.length || 0}文字` });
        result.push({ emoji: "🏃", title: "瞬速王", desc: "昨日いちばん短い日報でキメた", dotkun: "潔すぎでしょwでもOK！", mood: "happy",
          name: nm(byLen[byLen.length - 1].user_id), detail: `${byLen[byLen.length - 1].content?.length || 0}文字` });
      } else {
        result.push({ emoji: "💬", title: "長文王", desc: "昨日いちばん長い日報", dotkun: "今日は誰も書かなかったみたい📖", mood: "normal", name: null });
        result.push({ emoji: "🏃", title: "瞬速王", desc: "昨日いちばん短い日報でキメた", dotkun: "今日は出番なしだったね🏃", mood: "normal", name: null });
      }

      // 絵文字職人
      if (daySubs.length) {
        const byEmoji = [...daySubs].map((s: any) => ({ uid: s.user_id, n: countEmoji(s.content || "") })).sort((a, b) => b.n - a.n);
        result.push({ emoji: "🎨", title: "絵文字職人", desc: "日報に絵文字を盛りまくった", dotkun: "絵文字つかいすぎでしょw楽しそうでなにより🎨", mood: "happy",
          name: byEmoji[0].n > 0 ? nm(byEmoji[0].uid) : null, detail: byEmoji[0].n > 0 ? `絵文字${byEmoji[0].n}個` : undefined });
      } else {
        result.push({ emoji: "🎨", title: "絵文字職人", desc: "日報に絵文字を盛りまくった", dotkun: "今日は絵文字ひかえめだったね🎨", mood: "normal", name: null });
      }

      // おつかれ王
      const tired = daySubs.filter((s: any) => TIRED_WORDS.some(w => (s.content || "").includes(w)));
      result.push({ emoji: "😴", title: "おつかれ王", desc: "「疲れた」がにじみ出てた", dotkun: "ちゃんと休んでね、無理しないで🍵", mood: "normal",
        name: tired.length ? nm(seededPick(tired, ymd + "tired")!.user_id) : null });

      // ラッキー王・本日の主役
      const activeIds = Array.from(new Set([
        ...dayThanks.map((r: any) => r.to_user_id),
        ...daySubs.map((r: any) => r.user_id),
      ]));
      result.push({ emoji: "🎲", title: "ラッキー王", desc: "運だけで選ばれし者", dotkun: "運だけで王になったね、おめでとうw🎲", mood: "cheer",
        name: activeIds.length ? nm(seededPick(activeIds, ymd + "lucky")!) : null });
      result.push({ emoji: "🃏", title: "本日の主役", desc: "この日の主役", dotkun: "今日はキミが主役だ！輝いてるよ✨", mood: "cheer",
        name: activeIds.length ? nm(seededPick(activeIds, ymd + "star")!) : null });

      setKings(result);
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#fff", padding: "32px 16px 80px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: "12px 0 4px" }}>👑 昨日の○○王</h1>
        <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 28 }}>{today} の結果　毎朝0時に確定するよ</p>

        {loading ? (
          <p style={{ color: "#9ca3af" }}>集計中...</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {kings.map((k, i) => (
              <div key={i} style={{ padding: "16px 18px", borderRadius: 14, background: k.name ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ fontSize: 34, flexShrink: 0 }}>{k.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 17, fontWeight: 800 }}>{k.title}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{k.desc}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {k.name ? (
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#fbbf24" }}>{k.name}</div>
                        {k.detail ? <div style={{ fontSize: 11, color: "#6b7280" }}>{k.detail}</div> : null}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "#6b7280" }}>まだ不在</div>
                    )}
                  </div>
                </div>
                {k.name ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><DotKun size={30} mood={k.mood} /></div>
                    <div style={{ fontSize: 13, color: "#d1d5db", background: "rgba(99,102,241,0.1)", borderRadius: "2px 12px 12px 12px", padding: "8px 12px" }}>{k.dotkun}</div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <button onClick={() => router.push("/menu")} style={{ marginTop: 32, padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>メニューへ戻る</button>
      </div>
    </div>
  );
}
