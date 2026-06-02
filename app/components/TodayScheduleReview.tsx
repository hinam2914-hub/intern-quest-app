"use client";

import { useEffect, useImperativeHandle, useState, forwardRef } from "react";
import { supabase } from "../lib/supabase";

type Slot = {
  start: string;
  end: string;
  content: string;
  result: "ok" | "ng" | null;
};

function getTodayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

export type TodayScheduleReviewHandle = {
  // 日報提出成功後に呼ぶ：当日の daily_schedules を更新
  saveReview: (userId: string) => Promise<{ isAllMaru: boolean; hasSchedule: boolean }>;
};

const TodayScheduleReview = forwardRef<TodayScheduleReviewHandle>((_props, ref) => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasSchedule, setHasSchedule] = useState(false);
  const today = getTodayJST();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("daily_schedules")
        .select("slots")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (data && Array.isArray((data as any).slots) && (data as any).slots.length > 0) {
        // 内容が入っているコマだけ振り返り対象にする
        const filled = ((data as any).slots as Slot[]).filter((s) => s.content && s.content.trim() !== "");
        setSlots(filled);
        setHasSchedule(filled.length > 0);
      }
      setLoading(false);
    };
    load();
  }, [today]);

  const setResult = (index: number, result: "ok" | "ng") => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], result: next[index].result === result ? null : result };
      return next;
    });
  };

  // 親（日報ページ）から提出成功時に呼ばれる
  useImperativeHandle(ref, () => ({
    saveReview: async (userId: string) => {
      if (!hasSchedule) return { isAllMaru: false, hasSchedule: false };
      await supabase
        .from("daily_schedules")
        .update({
          slots: slots,
          reviewed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("date", today);

      // 内容ありコマが全て ok なら全丸
      const filled = slots.filter((s) => s.content && s.content.trim() !== "");
      const isAllMaru = filled.length > 0 && filled.every((s) => s.result === "ok");
      return { isAllMaru, hasSchedule: true };
    },
  }));

  if (loading) return null;

  // 今日のスケジュール未入力 → 振り返りUIは出さず、軽い導線だけ
  if (!hasSchedule) {
    return (
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 20,
          color: "#9ca3af",
          fontSize: 13,
        }}
      >
        今日のスケジュールは未入力です。明日は朝に予定を立てると振り返りができます。
      </div>
    );
  }

  const okCount = slots.filter((s) => s.result === "ok").length;

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: "16px",
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb" }}>☀️ 今日の振り返り</span>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>達成 {okCount}/{slots.length}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {slots.map((slot, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 8,
              padding: "8px 10px",
            }}
          >
            <span style={{ fontSize: 12, color: "#9ca3af", width: 92, flexShrink: 0 }}>
              {slot.start}–{slot.end}
            </span>
            <span style={{ flex: 1, fontSize: 13, color: "#e5e7eb" }}>{slot.content}</span>
            <button
              onClick={() => setResult(i, "ok")}
              style={{
                width: 32, height: 32, borderRadius: 8, cursor: "pointer",
                border: slot.result === "ok" ? "none" : "1px solid rgba(255,255,255,0.15)",
                background: slot.result === "ok" ? "#10b981" : "transparent",
                color: slot.result === "ok" ? "#fff" : "#9ca3af", fontSize: 15,
              }}
              title="できた"
            >
              ⭕️
            </button>
            <button
              onClick={() => setResult(i, "ng")}
              style={{
                width: 32, height: 32, borderRadius: 8, cursor: "pointer",
                border: slot.result === "ng" ? "none" : "1px solid rgba(255,255,255,0.15)",
                background: slot.result === "ng" ? "#ef4444" : "transparent",
                color: slot.result === "ng" ? "#fff" : "#9ca3af", fontSize: 15,
              }}
              title="できなかった"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

TodayScheduleReview.displayName = "TodayScheduleReview";

export default TodayScheduleReview;