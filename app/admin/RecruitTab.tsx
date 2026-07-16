"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const ACTION_LABEL: Record<string, string> = {
  dm: "DM",
  mentsuna: "メンツナ",
  interview: "面談",
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
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">🎯 HRキャンペーン承認</h2>
      <div className="flex gap-2">
        <button onClick={() => setTab("pending")} className={"px-4 py-2 rounded-lg text-sm font-bold " + (tab === "pending" ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400")}>
          承認待ち {pending.length > 0 && <span className="ml-1 px-2 py-0.5 bg-red-500 rounded-full text-xs">{pending.length}</span>}
        </button>
        <button onClick={() => setTab("history")} className={"px-4 py-2 rounded-lg text-sm font-bold " + (tab === "history" ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400")}>
          履歴
        </button>
      </div>
      {loading ? (
        <p className="text-gray-400 text-sm">読み込み中...</p>
      ) : shown.length === 0 ? (
        <p className="text-gray-500 text-sm">{tab === "pending" ? "承認待ちの申請はありません" : "履歴はありません"}</p>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => (
            <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-bold text-sm">
                  {r.name} <span className="text-indigo-400">／ {ACTION_LABEL[r.action_type] || r.action_type} ×{r.count}</span> <span className="text-yellow-400">+{r.points}pt</span>
                </p>
                {r.note && <p className="text-gray-400 text-xs mt-1">📝 {r.note}</p>}
                <p className="text-gray-600 text-xs mt-1">{new Date(r.created_at).toLocaleString("ja-JP")}</p>
              </div>
              {tab === "pending" ? (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => approve(r)} disabled={busy === r.id} className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg disabled:opacity-50">✅ 承認</button>
                  <button onClick={() => reject(r)} disabled={busy === r.id} className="px-3 py-2 bg-gray-700 hover:bg-red-600 text-white text-sm font-bold rounded-lg disabled:opacity-50">却下</button>
                </div>
              ) : (
                <span className={"text-xs font-bold shrink-0 " + (r.status === "approved" ? "text-green-400" : "text-red-400")}>
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
