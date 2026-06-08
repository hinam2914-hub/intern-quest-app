"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { createNotification } from "../lib/createNotification";

type Report = {
  id: string;
  user_id: string;
  target_user_id: string;
  category: string;
  comment: string | null;
  image_url: string | null;
  status: string;
  created_at: string;
};

const CAT_LABEL: Record<string, string> = {
  meal: "🍚 ご飯",
  sales: "🤝 営業同行",
  meeting: "💬 面談・1on1",
  study: "📚 勉強会・研修",
};

export default function MentorReportTab() {
  const [reports, setReports] = useState<Report[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: reportRows } = await supabase.from("mentor_reports").select("*").order("created_at", { ascending: false });
    setReports((reportRows || []) as Report[]);
    const { data: profs } = await supabase.from("profiles").select("id, name");
    const nameMap: Record<string, string> = {};
    (profs || []).forEach((p: any) => { nameMap[p.id] = p.name || "名前未設定"; });
    setNames(nameMap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDecision = async (report: Report, approve: boolean) => {
    const newStatus = approve ? "approved" : "rejected";
    const { error } = await supabase.from("mentor_reports").update({ status: newStatus }).eq("id", report.id);
    if (error) { alert("失敗: " + error.message); return; }
    await createNotification({
      userId: report.user_id,
      type: "mentor_report",
      title: approve ? "🤝 後輩サポート報告が承認されました" : "🔄 後輩サポート報告が差し戻されました",
      message: approve ? "リーダースコアに反映されました。後輩の面倒を見てくれてありがとう！" : "内容を確認のうえ、再度報告してください。",
      link: "/mentor-report",
      icon: "🤝",
    });
    setReports((prev) => prev.map((r) => r.id === report.id ? { ...r, status: newStatus } : r));
    setMessage(approve ? "承認しました" : "差し戻しました");
    setTimeout(() => setMessage(""), 3000);
  };

  const shown = reports.filter((r) => filter === "pending" ? r.status === "pending" : true);

  if (loading) return <div style={{ color: "#9ca3af", fontSize: 14, padding: 20 }}>読み込み中...</div>;

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: "#a5b4fc" }}>🤝 後輩サポート報告 承認</h3>
      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>承認すると、報告した人のリーダースコアに反映されます。</div>
      {message && <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(52,211,153,0.1)", color: "#34d399", fontSize: 13, fontWeight: 700 }}>{message}</div>}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[{ k: "pending", l: "⏳ 承認待ち" }, { k: "all", l: "すべて" }].map((f) => (
          <button key={f.k} onClick={() => setFilter(f.k as any)} style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: filter === f.k ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "transparent", color: filter === f.k ? "#fff" : "#9ca3af", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{f.l}</button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div style={{ color: "#6b7280", fontSize: 14, padding: 12 }}>該当する報告はありません。</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {shown.map((r) => (
            <div key={r.id} style={{ padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>{names[r.user_id] || "不明"} → {names[r.target_user_id] || "不明"}</span>
                <span style={{ fontSize: 12, color: "#a5b4fc", fontWeight: 700 }}>{CAT_LABEL[r.category] || r.category}</span>
                <span style={{ fontSize: 11, color: r.status === "approved" ? "#34d399" : r.status === "rejected" ? "#f87171" : "#fbbf24", fontWeight: 700, marginLeft: "auto" }}>
                  {r.status === "approved" ? "✅ 承認済み" : r.status === "rejected" ? "❌ 差し戻し" : "⏳ 承認待ち"}
                </span>
              </div>
              {r.comment && <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.5, marginBottom: 8 }}>{r.comment}</div>}
              {r.image_url && <img src={r.image_url} alt="報告画像" style={{ maxWidth: 200, borderRadius: 8, marginBottom: 8, display: "block" }} />}
              {r.status === "pending" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleDecision(r, true)} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #10b981, #34d399)", color: "#0a0a0f", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✅ 承認</button>
                  <button onClick={() => handleDecision(r, false)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.4)", background: "rgba(248,113,113,0.1)", color: "#f87171", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>🔄 差し戻し</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}