"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

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
  const today = getTodayJST();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);

      // 今日の分が既にあれば読み込む
      const { data } = await supabase
        .from("daily_schedules")
        .select("slots")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (data && Array.isArray((data as any).slots) && (data as any).slots.length > 0) {
        setSlots((data as any).slots as Slot[]);
      }
      setLoading(false);
    };
    init();
  }, [router, today]);

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
          date: today,
          slots: slots,
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

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>読み込み中...</div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 4 }}>
        ☀️ 今日のスケジュール
      </h1>
      <p style={{ color: "#888", marginBottom: 20, fontSize: 14 }}>
        {today} ／ 今日の予定を時間ごとに書き出しましょう
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {slots.map((slot, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#fff",
              border: "1px solid #eee",
              borderRadius: 10,
              padding: "8px 10px",
            }}
          >
            <input
              type="time"
              value={slot.start}
              onChange={(e) => updateSlot(i, "start", e.target.value)}
              style={{ width: 90, padding: 6, borderRadius: 6, border: "1px solid #ddd" }}
            />
            <span style={{ color: "#aaa" }}>〜</span>
            <input
              type="time"
              value={slot.end}
              onChange={(e) => updateSlot(i, "end", e.target.value)}
              style={{ width: 90, padding: 6, borderRadius: 6, border: "1px solid #ddd" }}
            />
            <input
              type="text"
              placeholder="予定を入力"
              value={slot.content}
              onChange={(e) => updateSlot(i, "content", e.target.value)}
              style={{ flex: 1, padding: 6, borderRadius: 6, border: "1px solid #ddd" }}
            />
            <button
              onClick={() => removeSlot(i)}
              style={{
                border: "none",
                background: "transparent",
                color: "#c00",
                cursor: "pointer",
                fontSize: 18,
              }}
              title="この行を削除"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addSlot}
        style={{
          marginTop: 12,
          padding: "8px 16px",
          borderRadius: 8,
          border: "1px dashed #aaa",
          background: "#fafafa",
          cursor: "pointer",
        }}
      >
        ＋ 行を追加
      </button>

      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: 10,
            border: "none",
            background: "#7c3aed",
            color: "#fff",
            fontWeight: "bold",
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "保存中..." : "保存してマイページへ"}
        </button>
        <button
          onClick={() => router.push("/mypage")}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            color: "#666",
            cursor: "pointer",
          }}
        >
          あとで
        </button>
      </div>
    </div>
  );
}