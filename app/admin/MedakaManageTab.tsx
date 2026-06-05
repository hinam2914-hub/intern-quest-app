"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

type MedakaPost = {
  id: string;
  user_id: string;
  post_type: string;
  title: string;
  body: string;
  status: string;
  admin_response: string | null;
  like_count: number;
  created_at: string;
};

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  open: { label: "🔵 受付中", color: "#06b6d4" },
  acknowledged: { label: "🟡 確認済み", color: "#fbbf24" },
  resolved: { label: "🟢 解決済み", color: "#10b981" },
};

export default function MedakaManageTab() {
  const [posts, setPosts] = useState<MedakaPost[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, { id: string; body: string; user_id: string; created_at: string }[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "opinion" | "issue">("all");
  const [responseText, setResponseText] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: postData } = await supabase
      .from("medaka_box").select("*").order("created_at", { ascending: false }).limit(200);
    setPosts((postData || []) as MedakaPost[]);
    const { data: profs } = await supabase.from("profiles").select("id, name");
    const nameMap: Record<string, string> = {};
    (profs || []).forEach((p: any) => { nameMap[p.id] = p.name || "名前未設定"; });
    setNames(nameMap);
    const { data: commentData } = await supabase
      .from("medaka_comments").select("id, post_id, body, user_id, created_at").order("created_at", { ascending: true });
    const byPost: Record<string, { id: string; body: string; user_id: string; created_at: string }[]> = {};
    (commentData || []).forEach((c: any) => {
      if (!byPost[c.post_id]) byPost[c.post_id] = [];
      byPost[c.post_id].push({ id: c.id, body: c.body, user_id: c.user_id, created_at: c.created_at });
    });
    setComments(byPost);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("medaka_box").update({ status: newStatus }).eq("id", id);
    if (error) { alert("失敗: " + error.message); return; }
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, status: newStatus } : p));
  };

  const saveResponse = async (id: string) => {
    const text = (responseText[id] || "").trim();
    const { error } = await supabase.from("medaka_box").update({ admin_response: text || null }).eq("id", id);
    if (error) { alert("失敗: " + error.message); return; }
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, admin_response: text || null } : p));
    setMessage("運営返信を保存しました");
    setTimeout(() => setMessage(""), 3000);
  };

  const shown = posts.filter((p) => {
    if (filter === "opinion") return p.post_type === "opinion";
    if (filter === "issue") return p.post_type === "issue";
    return true;
  });

  if (loading) return <div style={{ color: "#9ca3af", fontSize: 14, padding: 20 }}>読み込み中...</div>;

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: "#a5b4fc" }}>🐟 メダカBOX 管理</h3>
      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>投稿者の実名・ステータス・解決案コメントを確認できます。</div>
      {message && <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(52,211,153,0.1)", color: "#34d399", fontSize: 13, fontWeight: 700 }}>{message}</div>}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[{ k: "all", l: "すべて" }, { k: "opinion", l: "💬 意見" }, { k: "issue", l: "🔧 課題" }].map((f) => (
          <button key={f.k} onClick={() => setFilter(f.k as any)} style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: filter === f.k ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "transparent", color: filter === f.k ? "#fff" : "#9ca3af", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{f.l}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {shown.map((post) => {
          const isIssue = post.post_type === "issue";
          const st = STATUS_INFO[post.status] || STATUS_INFO.open;
          return (
            <div key={post.id} style={{ padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ padding: "2px 8px", borderRadius: 6, background: isIssue ? "rgba(249,115,22,0.15)" : "rgba(99,102,241,0.15)", color: isIssue ? "#fb923c" : "#a5b4fc", fontSize: 11, fontWeight: 700 }}>{isIssue ? "🔧 課題" : "💬 意見"}</span>
                <span style={{ fontSize: 11, color: st.color, fontWeight: 700 }}>{st.label}</span>
                <span style={{ fontSize: 12, color: "#f9fafb", fontWeight: 700 }}>👤 {names[post.user_id] || "不明"}</span>
                <span style={{ fontSize: 10, color: "#6b7280", marginLeft: "auto" }}>{new Date(post.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#f9fafb", marginBottom: 4 }}>{post.title}</div>
              <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 10 }}>{post.body}</div>
              {(comments[post.id] || []).length > 0 && (
                <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: "rgba(99,102,241,0.05)" }}>
                  <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 700, marginBottom: 4 }}>💡 解決案コメント</div>
                  {(comments[post.id] || []).map((c) => (
                    <div key={c.id} style={{ fontSize: 12, color: "#d1d5db", marginBottom: 4 }}>・{c.body} <span style={{ color: "#6b7280" }}>（{names[c.user_id] || "不明"}）</span></div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                {Object.entries(STATUS_INFO).map(([key, info]) => (
                  <button key={key} onClick={() => changeStatus(post.id, key)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${post.status === key ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.1)"}`, background: post.status === key ? "rgba(99,102,241,0.2)" : "transparent", color: post.status === key ? "#fff" : "#9ca3af", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{info.label}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={responseText[post.id] ?? (post.admin_response || "")} onChange={(e) => setResponseText((prev) => ({ ...prev, [post.id]: e.target.value }))} placeholder="運営からの返信" style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none" }} />
                <button onClick={() => saveResponse(post.id)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #10b981, #34d399)", color: "#0a0a0f", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>返信保存</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}