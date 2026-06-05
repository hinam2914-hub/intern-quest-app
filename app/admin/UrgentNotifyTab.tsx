"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { createNotification } from "../lib/createNotification";

type Profile = { id: string; name: string; is_active?: boolean };

// JSTのYYYY-MM-DDを返す（days日前も指定可）
function ymdJST(offsetDays = 0): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000 - offsetDays * 24 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}
function toJSTDateOnly(value: string): string {
  const d = new Date(value);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

export default function UrgentNotifyTab() {
  const [offenders, setOffenders] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    // 昨日までの3日間（例：今日6/5 → 6/2,6/3,6/4）
    const targetDays = [ymdJST(1), ymdJST(2), ymdJST(3)];
    // アクティブメンバー
    const { data: profs } = await supabase
      .from("profiles").select("id, name, is_active").eq("is_active", true).order("name");
    // 直近7日の日報提出
    const sinceISO = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const { data: subs } = await supabase
      .from("submissions").select("user_id, created_at").gte("created_at", sinceISO);
    // user_id -> 提出した日付のSet
    const submittedByUser = new Map<string, Set<string>>();
    (subs || []).forEach((s: any) => {
      if (!submittedByUser.has(s.user_id)) submittedByUser.set(s.user_id, new Set());
      submittedByUser.get(s.user_id)!.add(toJSTDateOnly(s.created_at));
    });
    // 3日間すべて未提出の人を抽出
    const result: Profile[] = (profs || []).filter((p: any) => {
      const days = submittedByUser.get(p.id) || new Set<string>();
      return targetDays.every((d) => !days.has(d));
    });
    setOffenders(result as Profile[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sendUrgent = async (userId: string, name: string) => {
    await createNotification({
      userId,
      type: "urgent",
      title: "⚠️ 3日間、日報が提出されていません",
      message: "日報は成長の記録であり、インターン参加の証です。ここで止まるか、続けるかで差がつきます。今日、まず一歩を踏み出しましょう。",
      link: "/report",
      icon: "🚨",
    });
    setSentIds((prev) => [...prev, userId]);
    setMessage(`${name}さんに緊急通知を送りました`);
    setTimeout(() => setMessage(""), 3000);
  };

  const sendAll = async () => {
    if (!confirm(`未提出者 ${offenders.length}名 全員に緊急通知を送りますか？`)) return;
    for (const p of offenders) {
      await createNotification({
        userId: p.id,
        type: "urgent",
        title: "⚠️ 3日間、日報が提出されていません",
        message: "日報は成長の記録であり、インターン参加の証です。ここで止まるか、続けるかで差がつきます。今日、まず一歩を踏み出しましょう。",
        link: "/report",
        icon: "🚨",
      });
    }
    setSentIds(offenders.map((p) => p.id));
    setMessage(`${offenders.length}名全員に緊急通知を送りました`);
    setTimeout(() => setMessage(""), 4000);
  };

  if (loading) return <div style={{ color: "#9ca3af", fontSize: 14, padding: 20 }}>読み込み中...</div>;

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: "#f87171" }}>🚨 3日連続 日報未提出者</h3>
      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>昨日までの3日間、一度も日報を出していないメンバーです。緊急通知を送ると、本人がアプリを開いたとき全画面で警告が表示されます。</div>
      {message && <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(52,211,153,0.1)", color: "#34d399", fontSize: 13, fontWeight: 700 }}>{message}</div>}
      {offenders.length === 0 ? (
        <div style={{ color: "#6b7280", fontSize: 14, padding: 12 }}>3日連続未提出のメンバーはいません 🎉</div>
      ) : (
        <>
          <button onClick={sendAll} style={{ marginBottom: 16, padding: "10px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #ef4444, #f87171)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            ⚠️ 全員に緊急通知を送る（{offenders.length}名）
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {offenders.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#f9fafb" }}>{p.name}</span>
                {sentIds.includes(p.id) ? (
                  <span style={{ fontSize: 12, color: "#34d399", fontWeight: 700 }}>✓ 送信済み</span>
                ) : (
                  <button onClick={() => sendUrgent(p.id, p.name)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "rgba(239,68,68,0.2)", color: "#f87171", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>緊急通知を送る</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}