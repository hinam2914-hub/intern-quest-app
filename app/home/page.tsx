"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import DotKun from "../components/DotKun";

type Theme = "light" | "dark";
type Task = { icon: string; label: string; href: string };

function getTodayJST(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [streak, setStreak] = useState(0);
  const [theme, setTheme] = useState<Theme>("dark");
  // 今日のタスク（今は仮固定。次のステップで判定ロジックを入れる）
  const [task, setTask] = useState<Task>({ icon: "📝", label: "日報を書く", href: "/report" });
  const [doneCount, setDoneCount] = useState(2);
  const [dotMsg, setDotMsg] = useState("あとは日報だけ！書いたら今日のリング完成だよ🎉");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("homeTheme")) as Theme | null;
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("name, streak").eq("id", user.id).single();
      if (profile) {
        setName((profile as any).name || "");
        setStreak((profile as any).streak || 0);
      }
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
  const bg = isDark
    ? "radial-gradient(circle at 50% 30%, #14142b 0%, #0a0a0f 65%)"
    : "#fdfdfb";
  const nameColor = isDark ? "#f9fafb" : "#2b3440";
  const helloColor = isDark ? "#6b7280" : "#8a94a0";
  const flameStyle = isDark
    ? { background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.35)", color: "#fbbf24" }
    : { background: "#fff", border: "none", color: "#e8590c", boxShadow: "0 4px 14px rgba(43,52,64,.08)" };
  const ringBg = isDark
    ? `conic-gradient(#8b5cf6 0 ${(doneCount / 3) * 100}%, rgba(139,92,246,.12) ${(doneCount / 3) * 100}% 100%)`
    : `conic-gradient(#ffa94d 0 ${(doneCount / 3) * 100}%, #eceae4 ${(doneCount / 3) * 100}% 100%)`;
  const ringInner = isDark ? "#0d0d18" : "#fdfdfb";
  const btnBg = isDark
    ? "linear-gradient(150deg, #6366f1, #8b5cf6)"
    : "linear-gradient(150deg, #ff7d94, #f74f6e)";
  const btnShadow = isDark
    ? "0 0 50px rgba(99,102,241,.5), inset 0 -6px 0 rgba(0,0,0,.2)"
    : "0 18px 40px rgba(247,79,110,.35), inset 0 -8px 0 rgba(0,0,0,.08)";
  const dotRowStyle = isDark
    ? { background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.22)" }
    : { background: "#fff", boxShadow: "0 6px 20px rgba(43,52,64,.08)" };
  const dotTextColor = isDark ? "#c7d2fe" : "#4b5563";
  const otherColor = isDark ? "#6b7280" : "#8a94a0";

  if (loading) return <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: helloColor }}>読み込み中...</div>;

  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 22px 30px", position: "relative" }}>
      {/* 上部 */}
      <div style={{ width: "100%", maxWidth: 420, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, color: helloColor }}>おはよう</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: nameColor }}>{name || "ゲスト"}さん</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={toggleTheme} style={{ border: "none", background: isDark ? "rgba(255,255,255,.06)" : "#fff", borderRadius: 20, padding: "7px 12px", fontSize: 16, cursor: "pointer", boxShadow: isDark ? "none" : "0 4px 14px rgba(43,52,64,.08)" }}>{isDark ? "🌙" : "☀️"}</button>
          <div style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 20, padding: "7px 13px", fontSize: 14, fontWeight: 900, ...flameStyle }}>🔥 {streak}</div>
        </div>
      </div>

      {/* 中央 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 250, height: 250, borderRadius: "50%", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: ringBg, filter: isDark ? "drop-shadow(0 0 24px rgba(139,92,246,.35))" : "none" }}>
          <div style={{ position: "absolute", width: 218, height: 218, borderRadius: "50%", background: ringInner }} />
          <button onClick={() => router.push(task.href)} style={{ position: "relative", width: 176, height: 176, borderRadius: isDark ? "50%" : 44, background: btnBg, boxShadow: btnShadow, border: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", zIndex: 2 }}>
            <div style={{ fontSize: 52 }}>{task.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: 1 }}>{task.label}</div>
          </button>
        </div>
        <div style={{ marginTop: 16, fontSize: 11.5, color: otherColor }}>今日のクエスト <b style={{ color: isDark ? "#a78bfa" : "#e8590c" }}>{doneCount}/3</b> 達成</div>
      </div>

      {/* ドットくん */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 20, padding: "12px 16px", marginBottom: 14, maxWidth: 420, width: "100%", ...dotRowStyle }}>
        <div style={{ flexShrink: 0 }}><DotKun size={44} mood="cheer" /></div>
        <p style={{ fontSize: 12, color: dotTextColor, lineHeight: 1.6 }}>{dotMsg}</p>
      </div>
      <div onClick={() => router.push("/menu")} style={{ fontSize: 12.5, color: otherColor, fontWeight: 700, cursor: "pointer" }}>ほかのことをする →</div>
    </div>
  );
}
