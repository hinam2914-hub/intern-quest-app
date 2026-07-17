"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const ACTION_LABEL: Record<string, string> = {
  dm: "DM",
  mentsuna: "メンツナ",
  interview: "面談",
  saiyo_interview: "採用面談",
  hire: "入社",
};

type Row = {
  id: string;
  user_id: string;
  action_type: string;
  count: number;
  points: number;
  note: string | null;
  status: string;
  created_at: string;
  approved_at: string | null;
  name?: string;
};

export default function RecruitTab() {
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("recruit_progress")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const list = data || [];
    const ids = [...new Set(list.map((r: Row) => r.user_id))];
    const names: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id,name").in("id", ids);
      (profs || []).forEach((p: { id: string; name: string }) => { names[p.id] = p.name; });
    }
    setRows(list.map((r: Row) => ({ ...r, name: names[r.user_id] || "不明" })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (r: Row) => {
    if (busy) return;
    setBusy(r.id);
    const { data: up } = await supabase.from("user_points").select("points").eq("id", r.user_id).single();
    if (up) {
      await supabase.from("user_points").update({ points: (up.points || 0) + r.points }).eq("id", r.user_id);
    }
    await supabase.from("points_history").insert({
      user_id: r.user_id,
      change: r.points,
      reason: "HRキャンペーン承認: " + (ACTION_LABEL[r.action_type] || r.action_type),
    });
    await supabase.from("recruit_progress").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", r.id);
    setBusy(null);
    load();
  };

  const reject = async (r: Row) => {
    if (busy) return;
    setBusy(r.id);
    await supabase.from("recruit_progress").update({ status: "rejected", approved_at: new Date().toISOString() }).eq("id", r.id);
    setBusy(null);
    load();
  };

  const pending = rows.filter((r) => r.status === "pending");
  const history = rows.filter((r) => r.status !== "pending");
  const shown = tab === "pending" ? pending : history;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>🎯 HRキャンペーン承認</h2>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setTab("pending")} style={{ padding: "9px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800, background: tab === "pending" ? "linear-gradient(135deg, #8b5cf6, #6366f1)" : "rgba(255,255,255,0.06)", color: tab === "pending" ? "#fff" : "#9ca3af" }}>
          承認待ち{pending.length > 0 ? ` (${pending.length})` : ""}
        </button>
        <button onClick={() => setTab("history")} style={{ padding: "9px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800, background: tab === "history" ? "linear-gradient(135deg, #8b5cf6, #6366f1)" : "rgba(255,255,255,0.06)", color: tab === "history" ? "#fff" : "#9ca3af" }}>
          履歴
        </button>
      </div>
      {loading ? (
        <p style={{ color: "#9ca3af", fontSize: 13 }}>読み込み中...</p>
      ) : shown.length === 0 ? (
        <p style={{ color: "#6b7280", fontSize: 13 }}>{tab === "pending" ? "承認待ちの申請はありません" : "履歴はありません"}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map((r) => (
            <div key={r.id} style={{ background: "rgba(30,30,50,0.8)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>
                  {r.name} <span style={{ color: "#a78bfa" }}>／ {ACTION_LABEL[r.action_type] || r.action_type} ×{r.count}</span> <span style={{ color: "#fbbf24" }}>+{r.points}pt</span>
                </div>
                {r.note && <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>📝 {r.note}</div>}
                <div style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>{new Date(r.created_at).toLocaleString("ja-JP")}</div>
              </div>
              {tab === "pending" ? (
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => approve(r)} disabled={busy === r.id} style={{ padding: "9px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800, background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", opacity: busy === r.id ? 0.5 : 1 }}>✅ 承認</button>
                  <button onClick={() => reject(r)} disabled={busy === r.id} style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", fontSize: 13, fontWeight: 800, background: "rgba(255,255,255,0.05)", color: "#f87171", opacity: busy === r.id ? 0.5 : 1 }}>却下</button>
                </div>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 800, flexShrink: 0, color: r.status === "approved" ? "#34d399" : "#f87171" }}>
                  {r.status === "approved" ? "承認済み" : "却下"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
