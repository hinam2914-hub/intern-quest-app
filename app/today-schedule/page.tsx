"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import DotKun from "../components/DotKun";
import BackToMenuButton from "../components/BackToMenuButton";
const SCHEDULE_CATEGORIES = [
  "📞 テレアポ", "🚪 ピンポン", "🤝 商談・面談", "👥 商談同行", "📝 資料作成",
  "💬 MTG・1on1", "📚 勉強会・研修", "🎓 授業・学校", "✍️ 課題・勉強",
  "📖 読書・インプット", "💪 自己投資", "🍚 食事", "🚗 移動", "😴 睡眠・仮眠",
  "🛁 休憩・リラックス", "🧹 家事・身支度", "🎮 趣味・遊び",
];
const OTHER_OPTION = "✏️ その他（自由入力）";

type Slot = {
  start: string;
  end: string;
  content: string;
  result: "ok" | "ng" | null;
};

// JSTの今日(YYYY-MM-DD)を返す
function getTodayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

// 初期枠：9:00〜21:00を1時間刻み
function defaultSlots(): Slot[] {
  const slots: Slot[] = [];
  for (let h = 9; h < 21; h++) {
    const start = `${String(h).padStart(2, "0")}:00`;
    const end = `${String(h + 1).padStart(2, "0")}:00`;
    slots.push({ start, end, content: "", result: null });
  }
  return slots;
}

export default function TodaySchedulePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>(defaultSlots());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayJST());
  const today = getTodayJST();
  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + "T00:00:00+09:00");
    d.setDate(d.getDate() + days);
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    setSelectedDate(`${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);

      const { data } = await supabase
        .from("daily_schedules")
        .select("slots, schedule_status, schedule_reject_reason")
        .eq("user_id", user.id)
        .eq("date", selectedDate)
        .maybeSingle();

      if (data && Array.isArray((data as any).slots) && (data as any).slots.length > 0) {
        setSlots((data as any).slots as Slot[]);
      } else {
        setSlots(defaultSlots());
      }
      if (data && (data as any).schedule_status === "rejected") {
        setRejectReason((data as any).schedule_reject_reason || "スケジュールの内容を見直してください");
      } else {
        setRejectReason(null);
      }
      setLoading(false);
    };
    init();
  }, [router, selectedDate]);

  const updateSlot = (index: number, field: keyof Slot, value: string) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addSlot = () => {
    setSlots((prev) => [...prev, { start: "", end: "", content: "", result: null }]);
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);

    const { error } = await supabase
      .from("daily_schedules")
      .upsert(
        {
          user_id: userId,
          date: selectedDate,
          slots: slots,
          schedule_status: null,
          schedule_reject_reason: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,date" }
      );

    setSaving(false);

    if (error) {
      alert("保存に失敗しました: " + error.message);
      return;
    }
    router.push("/mypage");
  };

  // ===== テーマ（マイページに合わせたダーク） =====
  const bg = "#0a0a0f";
  const cardBg = "#15151f";
  const cardBorder = "#2a2a3a";
  const inputBg = "#1e1e2b";
  const inputBorder = "#33334a";
  const textPrimary = "#f5f5f7";
  const textMuted = "#8a8aa0";
  const accent = "#7c3aed";

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: bg,
          color: textMuted,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        読み込み中...
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: bg,
        padding: "40px 24px 64px",
        color: textPrimary,
      }}
    >
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8, cursor: "pointer", display: "inline-block" }}>← INTERN QUEST</div>
        <h1 style={{ fontSize: 26, fontWeight: "bold", marginBottom: 4 }}>
          ☀️ 今日のスケジュール
        </h1>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 24 }}>
          <button onClick={() => shiftDate(-1)} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.08)", color: "#818cf8", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>◀ 前日</button>
          <div style={{ minWidth: 160, textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: textPrimary }}>{selectedDate}{selectedDate === today ? "（今日）" : ""}</div>
          </div>
          <button onClick={() => shiftDate(1)} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.08)", color: "#818cf8", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>翌日 ▶</button>
        </div>
        {selectedDate !== today && (
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <button onClick={() => setSelectedDate(today)} style={{ padding: "4px 12px", borderRadius: 8, border: "none", background: "rgba(99,102,241,0.15)", color: "#a5b4fc", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>今日に戻る</button>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 16, padding: 16, marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><DotKun size={50} /></div>
          <div style={{ fontSize: 14, color: "#818cf8", fontWeight: 600, lineHeight: 1.6 }}>今日の予定を立てよう！何をやるか決めると、1日がぐっと動きやすくなるよ。迷ったらメニューから選んでね。</div>
        </div>
        {rejectReason && (
          <div style={{ marginBottom: 24, padding: "14px 16px", borderRadius: 10, background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.35)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f87171", marginBottom: 4 }}>🔄 スケジュールが差し戻されました</div>
            <div style={{ fontSize: 13, color: "#fca5a5" }}>{rejectReason}</div>
            <div style={{ fontSize: 12, color: textMuted, marginTop: 6 }}>内容を見直して、保存し直してください。</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {slots.map((slot, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: 8,
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                borderRadius: 12,
                padding: "10px 12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="time"
                value={slot.start}
                onChange={(e) => updateSlot(i, "start", e.target.value)}
                style={{
                  width: 110,
                  padding: 8,
                  borderRadius: 8,
                  border: `1px solid ${inputBorder}`,
                  background: inputBg,
                  color: textPrimary,
                  colorScheme: "dark",
                }}
              />
              <span style={{ color: textMuted }}>〜</span>
              <input
                type="time"
                value={slot.end}
                onChange={(e) => updateSlot(i, "end", e.target.value)}
                style={{
                  width: 110,
                  padding: 8,
                  borderRadius: 8,
                  border: `1px solid ${inputBorder}`,
                  background: inputBg,
                  color: textPrimary,
                  colorScheme: "dark",
                }}
              />
                <button
                  onClick={() => removeSlot(i)}
                  style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 18, marginLeft: "auto" }}
                  title="この行を削除"
                >×</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <select
                  value={SCHEDULE_CATEGORIES.includes(slot.content) ? slot.content : (slot.content ? OTHER_OPTION : "")}
                  onChange={(e) => updateSlot(i, "content", e.target.value === OTHER_OPTION ? " " : e.target.value)}
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    border: `1px solid ${inputBorder}`,
                    background: inputBg,
                    color: textPrimary,
                  }}
                >
                  <option value="">予定を選ぶ</option>
                  {SCHEDULE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value={OTHER_OPTION}>{OTHER_OPTION}</option>
                </select>
                {slot.content !== "" && !SCHEDULE_CATEGORIES.includes(slot.content) && (
                  <input
                    type="text"
                    placeholder="自由に入力してね"
                    value={slot.content}
                    onChange={(e) => updateSlot(i, "content", e.target.value)}
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 8,
                      border: `1px solid ${inputBorder}`,
                      background: inputBg,
                      color: textPrimary,
                    }}
                  />
                )}
              </div>

            </div>
          ))}
        </div>

        <button
          onClick={addSlot}
          style={{
            marginTop: 14,
            padding: "8px 16px",
            borderRadius: 8,
            border: `1px dashed ${inputBorder}`,
            background: "transparent",
            color: textMuted,
            cursor: "pointer",
          }}
        >
          ＋ 行を追加
        </button>

        <div style={{ marginTop: 28, display: "flex", gap: 12 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              padding: "14px",
              borderRadius: 12,
              border: "none",
              background: accent,
              color: "#fff",
              fontWeight: "bold",
              fontSize: 15,
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "保存中..." : "保存してマイページへ"}
          </button>
          <button
            onClick={() => router.push("/mypage")}
            style={{
              padding: "14px 18px",
              borderRadius: 12,
              border: `1px solid ${inputBorder}`,
              background: "transparent",
              color: textMuted,
              cursor: "pointer",
            }}
          >
            あとで
          </button>
        </div>
        <BackToMenuButton />
      </div>
    </main>
  );
}