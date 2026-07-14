"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Member = { id: string; name: string };
type Report = { id: string; target_user_id: string; category: string; comment: string | null; image_url: string | null; status: string; created_at: string };

const CATEGORIES = [
  { key: "meal", label: "🍚 ご飯" },
  { key: "sales", label: "🤝 営業同行" },
  { key: "meeting", label: "💬 面談・1on1" },
  { key: "study", label: "📚 勉強会・研修" },
  { key: "play", label: "🎮 遊び" },
];

export default function MentorReportPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [targetId, setTargetId] = useState("");
  const [category, setCategory] = useState("meal");
  const [comment, setComment] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      const { data: profs } = await supabase.from("profiles").select("id, name").eq("is_active", true).neq("id", user.id).order("name");
      setMembers((profs || []) as Member[]);
      const { data: reportRows } = await supabase.from("mentor_reports").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setReports((reportRows || []) as Report[]);
      setLoading(false);
    })();
  }, [router]);

  const handleSubmit = async () => {
    if (!targetId) { setMessage("後輩を選んでください"); return; }
    if (!comment.trim()) { setMessage("内容を入力してください"); return; }
    if (!image) { setMessage("写真を選択してください"); return; }
    setSending(true);
    setMessage("");
    let imageUrl: string | null = null;
    if (image) {
      const ext = image.name.split(".").pop();
      const filePath = `mentor-reports/${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, image, { upsert: true });
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
        imageUrl = publicUrl;
      }
    }
    const { error: insertError } = await supabase.from("mentor_reports").insert({
      user_id: userId,
      target_user_id: targetId,
      category,
      comment: comment.trim(),
      image_url: imageUrl,
      status: "pending",
    });
    if (insertError) {
      setMessage("❌ 送信に失敗しました: " + insertError.message);
      setSending(false);
      return;
    }
    const { data: reportRows } = await supabase.from("mentor_reports").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    setReports((reportRows || []) as Report[]);
    setTargetId(""); setComment(""); setImage(null);
    setMessage("✅ 報告を送信しました！承認をお待ちください。");
    setSending(false);
  };

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name || "不明";
  const catLabel = (key: string) => CATEGORIES.find((c) => c.key === key)?.label || key;
  const statusLabel = (s: string) => s === "approved" ? "✅ 承認済み" : s === "rejected" ? "❌ 差し戻し" : "⏳ 承認待ち";
  const statusColor = (s: string) => s === "approved" ? "#34d399" : s === "rejected" ? "#f87171" : "#fbbf24";

  if (loading) return <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center" }}>読み込み中...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 20px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div onClick={() => router.push("/home")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block", marginBottom: 16 }}>INTERN QUEST</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f9fafb", margin: "0 0 4px" }}>🤝 ペイフォワード報告</h1>
        <p style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 24px" }}>後輩を連れて行った・面倒を見たことを報告しよう。承認されるとリーダースコアが上がります。</p>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <label style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, display: "block", marginBottom: 4 }}>後輩を選ぶ</label>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#1a1a2e", color: "#f9fafb", fontSize: 14, outline: "none", marginBottom: 16 }}>
            <option value="">選択してください</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <label style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, display: "block", marginBottom: 8 }}>種類</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {CATEGORIES.map((c) => (
              <button key={c.key} onClick={() => setCategory(c.key)} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${category === c.key ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.1)"}`, background: category === c.key ? "rgba(99,102,241,0.2)" : "transparent", color: category === c.key ? "#fff" : "#9ca3af", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{c.label}</button>
            ))}
          </div>

          <label style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, display: "block", marginBottom: 4 }}>内容</label>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="例：ランチに連れて行って、最近の悩みを聞いた" style={{ width: "100%", minHeight: 70, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 16 }} />

          <label style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, display: "block", marginBottom: 4 }}>写真</label>
          <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} style={{ marginBottom: 16, color: "#9ca3af", fontSize: 13 }} />

          {message && <div style={{ marginBottom: 12, fontSize: 13, color: message.startsWith("✅") ? "#34d399" : "#f87171", fontWeight: 600 }}>{message}</div>}
          <button onClick={handleSubmit} disabled={sending} style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", background: sending ? "#374151" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: sending ? "not-allowed" : "pointer" }}>{sending ? "送信中..." : "報告を送信"}</button>
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#f9fafb", marginBottom: 12 }}>これまでの報告</h2>
        {reports.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 14 }}>まだ報告がありません。</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {reports.map((r) => (
              <div key={r.id} style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb" }}>{catLabel(r.category)} → {nameOf(r.target_user_id)}</span>
                  <span style={{ fontSize: 12, color: statusColor(r.status), fontWeight: 700, marginLeft: "auto" }}>{statusLabel(r.status)}</span>
                </div>
                {r.comment && <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.5 }}>{r.comment}</div>}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
          <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>メニューへ戻る</button>
        </div>
      </div>
    </div>
  );
}