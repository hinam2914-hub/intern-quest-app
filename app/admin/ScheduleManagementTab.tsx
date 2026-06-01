"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Slot = { start: string; end: string; content: string; result: "ok" | "ng" | null };
type Row = {
  user_id: string;
  name: string;
  slots: Slot[];
  reviewed: boolean;
  hasSchedule: boolean;
};

function getTodayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

export default function ScheduleManagementTab() {
  const [date, setDate] = useState<string>(getTodayJST());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Row | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setSelected(null);

      // 全メンバー
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, name")
        .order("name");

      // 指定日のスケジュール
      const { data: scheds } = await supabase
        .from("daily_schedules")
        .select("user_id, slots, reviewed")
        .eq("date", date);

      const schedMap = new Map<string, { slots: Slot[]; reviewed: boolean }>();
      (scheds || []).forEach((s: any) => {
        schedMap.set(s.user_id, { slots: Array.isArray(s.slots) ? s.slots : [], reviewed: !!s.reviewed });
      });

      const merged: Row[] = (profs || []).map((p: any) => {
        const sched = schedMap.get(p.id);
        const filled = sched ? sched.slots.filter((x) => x.content && x.content.trim() !== "") : [];
        return {
          user_id: p.id,
          name: p.name || "（名前未設定）",
          slots: filled,
          reviewed: sched?.reviewed || false,
          hasSchedule: filled.length > 0,
        };
      });

      // 入力済みを上に
      merged.sort((a, b) => Number(b.hasSchedule) - Number(a.hasSchedule));
      setRows(merged);
      setLoading(false);
    };
    load();
  }, [date]);

  const inputCount = rows.filter((r) => r.hasSchedule).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2 }}>☀️ スケジュール管理</div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", colorScheme: "dark" }}
        />
        {!loading && (
          <span style={{ fontSize: 13, color: "#9ca3af" }}>
            入力 {inputCount} / {rows.length} 人
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ color: "#6b7280", padding: 20 }}>読み込み中...</div>
      ) : selected ? (
        // ===== 個人詳細 =====
        <div>
          <button
            onClick={() => setSelected(null)}
            style={{ marginBottom: 16, padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", cursor: "pointer", fontSize: 13 }}
          >
            ← 一覧に戻る
          </button>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>{selected.name}</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>
            {date} ／ 達成 {selected.slots.filter((s) => s.result === "ok").length}/{selected.slots.length}
            {selected.reviewed ? "（振り返り済み）" : "（振り返り未）"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {selected.slots.map((slot, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 12px" }}>
                <span style={{ fontSize: 12, color: "#9ca3af", width: 100, flexShrink: 0 }}>{slot.start}–{slot.end}</span>
                <span style={{ flex: 1, fontSize: 14, color: "#e5e7eb" }}>{slot.content}</span>
                <span style={{ fontSize: 16 }}>{slot.result === "ok" ? "⭕️" : slot.result === "ng" ? "❌" : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // ===== 一覧 =====
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r) => {
            const ok = r.slots.filter((s) => s.result === "ok").length;
            const rate = r.slots.length > 0 ? Math.round((ok / r.slots.length) * 100) : 0;
            return (
              <div
                key={r.user_id}
                onClick={() => r.hasSchedule && setSelected(r)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: r.hasSchedule ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.015)",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 16px",
                  cursor: r.hasSchedule ? "pointer" : "default",
                  opacity: r.hasSchedule ? 1 : 0.5,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: "#f9fafb" }}>{r.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  {r.hasSchedule ? (
                    <>
                      <span style={{ fontSize: 12, color: r.reviewed ? "#34d399" : "#6b7280" }}>
                        {r.reviewed ? "振り返り済" : "未振り返り"}
                      </span>
                      <span style={{ fontSize: 13, color: "#a5b4fc", fontWeight: 700 }}>
                        {ok}/{r.slots.length}（{rate}%）
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: "#6b7280" }}>未入力</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}