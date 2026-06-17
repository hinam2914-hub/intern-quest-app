"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getAllMaruStreaks } from "../lib/scheduleStreak";
import { createNotification } from "../lib/createNotification";

type Slot = { start: string; end: string; content: string; result: "ok" | "ng" | null };
type Row = {
  user_id: string;
  name: string;
  slots: Slot[];
  reviewed: boolean;
  hasSchedule: boolean;
  rejected: boolean;
};

function getTodayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

export default function ScheduleManagementTab({ initialUserId }: { initialUserId?: string | null }) {
  const [date, setDate] = useState<string>(getTodayJST());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Row | null>(null);
  const [streaks, setStreaks] = useState<Map<string, number>>(new Map());
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
        .select("user_id, slots, reviewed, schedule_status")
        .eq("date", date);

      const schedMap = new Map<string, { slots: Slot[]; reviewed: boolean; rejected: boolean }>();
      (scheds || []).forEach((s: any) => {
        schedMap.set(s.user_id, { slots: Array.isArray(s.slots) ? s.slots : [], reviewed: !!s.reviewed, rejected: s.schedule_status === "rejected" });
      });

      const merged: Row[] = (profs || []).map((p: any) => {
        const sched = schedMap.get(p.id);
        const filled = sched ? sched.slots.filter((x) => x.content && x.content.trim() !== "") : [];
        return {
          user_id: p.id,
          name: p.name || "（名前未設定）",
          slots: filled,
          reviewed: sched?.reviewed || false,
          rejected: sched?.rejected || false,
          hasSchedule: filled.length > 0,
        };
      });

      // 入力済みを上に
      merged.sort((a, b) => Number(b.hasSchedule) - Number(a.hasSchedule));
      setRows(merged);

      // 全丸連続日数をまとめて取得
      const streakMap = await getAllMaruStreaks(merged.map((r) => r.user_id));
      setStreaks(streakMap);

      // ユーザー一覧から特定ユーザーを指定して開かれた場合、その人を自動選択
      if (initialUserId) {
        const target = merged.find((r) => r.user_id === initialUserId);
        if (target) setSelected(target);
      }

      setLoading(false);
    };
    load();
  }, [date, initialUserId]);

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
            {(streaks.get(selected.user_id) || 0) > 0 && (
              <span style={{ color: "#fbbf24", fontWeight: 700, marginLeft: 8 }}>
                🔥{streaks.get(selected.user_id)}日全丸連続
              </span>
            )}
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
          {selected.rejected ? (
            <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", fontSize: 13, fontWeight: 700 }}>
              🔄 このスケジュールは差し戻し済みです（全丸対象外）
            </div>
          ) : (
            <button
              onClick={async () => {
                const reason = prompt("差し戻し理由を記入してください（本人に通知されます）", "スケジュールの内容が不十分です。より具体的に作成してください。");
                if (reason === null) return;
                if (!reason.trim()) { alert("差し戻し理由を記入してください"); return; }
                // この日が全丸として加算済みなら、累計を-1して加算フラグを戻す
                const { data: schedRow } = await supabase
                  .from("daily_schedules")
                  .select("streak_rewarded")
                  .eq("user_id", selected.user_id)
                  .eq("date", date)
                  .maybeSingle();
                if (schedRow && (schedRow as any).streak_rewarded) {
                  const { data: prof } = await supabase
                    .from("profiles")
                    .select("total_maru_days")
                    .eq("id", selected.user_id)
                    .single();
                  const newTotal = Math.max(0, ((prof as any)?.total_maru_days || 0) - 1);
                  await supabase.from("profiles").update({ total_maru_days: newTotal }).eq("id", selected.user_id);
                }
                const { error } = await supabase
                  .from("daily_schedules")
                  .update({ schedule_status: "rejected", schedule_reject_reason: reason.trim(), streak_rewarded: false })
                  .eq("user_id", selected.user_id)
                  .eq("date", date);
                if (error) { alert("差し戻しに失敗しました: " + error.message); return; }
                await createNotification({
                  userId: selected.user_id,
                  type: "schedule_rejected",
                  title: "🔄 スケジュールが差し戻されました",
                  message: reason.trim(),
                  link: "/today-schedule",
                  icon: "📅",
                });
                alert("🔄 差し戻しました");
                setSelected({ ...selected, rejected: true });
                setRows((prev) => prev.map((r) => r.user_id === selected.user_id ? { ...r, rejected: true } : r));
              }}
              style={{ marginTop: 16, padding: "10px 20px", borderRadius: 8, border: "none", background: "rgba(248,113,113,0.2)", color: "#f87171", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              🔄 スケジュールを差し戻す
            </button>
          )}
        </div>
      ) : (
        // ===== 一覧 =====
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflowY: "auto", paddingRight: 4 }}>
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
                      {(streaks.get(r.user_id) || 0) > 0 && (
                        <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 700 }}>
                          🔥{streaks.get(r.user_id)}日全丸
                        </span>
                      )}
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