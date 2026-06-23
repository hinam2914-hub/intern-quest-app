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
function seededPick<T>(arr: T[], seedStr: string): T | null {
  if (!arr.length) return null;
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) { h = (h * 31 + seedStr.charCodeAt(i)) >>> 0; }
  return arr[h % arr.length];
}
function countEmoji(s: string): number {
  const m = s.match(/\p{Extended_Pictographic}/gu);
  return m ? m.length : 0;
}
const TIRED_WORDS = ["疲れ", "つかれ", "しんど", "だるい", "ねむい", "眠い"];

type King = { emoji: string; title: string; desc: string; name: string | null; detail?: string; dotkun: string; mood: "happy" | "cheer" | "normal" };

export default function KingsPage() {
  const router = useRouter();
  const [kings, setKings] = useState<King[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState("");

  useEffect(() => {
    (async () => {
      const ymd = jstYesterday();
      setToday(ymd);

      const { data: profs } = await supabase.from("profiles").select("id, name").eq("is_active", true);
      const nameMap: Record<string, string> = {};
      (profs || []).forEach((p: any) => { nameMap[p.id] = p.name || "名前未設定"; });

      const { data: logins } = await supabase
        .from("points_history").select("user_id, created_at")
        .eq("reason", "login_bonus")
        .order("created_at", { ascending: true }).limit(1000);
      const todayLogins = (logins || []).filter((r: any) => toJSTDateOnly(r.created_at) === ymd);

      const { data: subs } = await supabase
        .from("submissions").select("user_id, created_at, content")
        .order("created_at", { ascending: true }).limit(1000);
      const todaySubs = (subs || []).filter((r: any) => toJSTDateOnly(r.created_at) === ymd);

      const pick = function<T>(arr: T[]): T | null { return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; };
      const nm = (uid: string | undefined) => uid ? (nameMap[uid] || "名前未設定") : null;

      const result: King[] = [];

      result.push({ emoji: "⚡", title: "早起き王", desc: "今日いちばん早くログイン",
        name: todayLogins.length ? nm(todayLogins[0].user_id) : null });
      result.push({ emoji: "🌙", title: "夜ふかし王", desc: "今日いちばん遅くログイン",
        name: todayLogins.length ? nm(todayLogins[todayLogins.length - 1].user_id) : null });
      result.push({ emoji: "📝", title: "一番乗り王", desc: "今日いちばん早く日報を提出",
        name: todaySubs.length ? nm(todaySubs[0].user_id) : null });
      result.push({ emoji: "🔚", title: "ラストマン王", desc: "今日いちばん遅く日報を提出",
        name: todaySubs.length ? nm(todaySubs[todaySubs.length - 1].user_id) : null });

      if (todaySubs.length) {
        const byLen = [...todaySubs].sort((a, b) => (b.content?.length || 0) - (a.content?.length || 0));
        result.push({ emoji: "💬", title: "長文王", desc: "今日いちばん長い日報",
          name: nm(byLen[0].user_id), detail: `${byLen[0].content?.length || 0}文字` });
        result.push({ emoji: "🏃", title: "瞬速王", desc: "今日いちばん短い日報でキメた",
          name: nm(byLen[byLen.length - 1].user_id), detail: `${byLen[byLen.length - 1].content?.length || 0}文字` });
      } else {
        result.push({ emoji: "💬", title: "長文王", desc: "今日いちばん長い日報", name: null });
        result.push({ emoji: "🏃", title: "瞬速王", desc: "今日いちばん短い日報でキメた", name: null });
      }

      if (todaySubs.length) {
        const byEmoji = [...todaySubs].map((s: any) => ({ uid: s.user_id, n: countEmoji(s.content || "") }))
          .sort((a, b) => b.n - a.n);
        result.push({ emoji: "🎨", title: "絵文字職人", desc: "日報に絵文字を盛りまくった",
          name: byEmoji[0].n > 0 ? nm(byEmoji[0].uid) : null, detail: byEmoji[0].n > 0 ? `絵文字${byEmoji[0].n}個` : undefined });
      } else {
        result.push({ emoji: "🎨", title: "絵文字職人", desc: "日報に絵文字を盛りまくった", name: null });
      }

      const tired = todaySubs.filter((s: any) => TIRED_WORDS.some(w => (s.content || "").includes(w)));
      result.push({ emoji: "😴", title: "おつかれ王", desc: "「疲れた」がにじみ出てた",
        name: tired.length ? nm(pick(tired)!.user_id) : null });

      const activeIds = Array.from(new Set([
        ...todayLogins.map((r: any) => r.user_id),
        ...todaySubs.map((r: any) => r.user_id),
      ]));
      result.push({ emoji: "🎲", title: "ラッキー王", desc: "運だけで選ばれし者",
        name: activeIds.length ? nm(pick(activeIds)!) : null });
      result.push({ emoji: "🃏", title: "本日の主役", desc: "今日はこの人に注目",
        name: activeIds.length ? nm(pick(activeIds)!) : null });

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
