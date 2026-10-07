"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Row = {
  id: string; kind: "check" | "claim"; user_id: string; node_id: string; status: string;
  description?: string | null; url?: string | null; comment: string | null; created_at: string; decided_at: string | null;
  user_name: string; node_name: string; node_icon: string | null; node_category: string;
};

export default function SkillCheckTab({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"pending" | "done">("pending");
  const [comment, setComment] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [checks, claims, profiles, nodes] = await Promise.all([
      supabase.from("skill_checks").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("skill_claims").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("profiles").select("id, name"),
      supabase.from("skill_nodes").select("id, name, icon, category"),
    ]);
    const pm = new Map((profiles.data ?? []).map((p: any) => [p.id, p.name]));
    const nm = new Map((nodes.data ?? []).map((n: any) => [n.id, n]));
    const mk = (r: any, kind: "check" | "claim"): Row => ({
      id: r.id, kind, user_id: r.user_id, node_id: r.node_id, status: r.status, description: r.description, url: r.url,
      comment: r.comment, created_at: r.created_at, decided_at: r.decided_at,
      user_name: pm.get(r.user_id) ?? "?", node_name: nm.get(r.node_id)?.name ?? r.node_id,
      node_icon: nm.get(r.node_id)?.icon ?? null, node_category: nm.get(r.node_id)?.category ?? "",
    });
    const all = [...(checks.data ?? []).map((r: any) => mk(r, "check")), ...(claims.data ?? []).map((r: any) => mk(r, "claim"))]
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    setRows(all); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function decide(r: Row, status: "approved" | "rejected") {
    const { data: { user } } = await supabase.auth.getUser();
    const table = r.kind === "check" ? "skill_checks" : "skill_claims";
    await supabase.from(table).update({ status, checker_id: user?.id ?? null, comment: comment[r.id] ?? null, decided_at: new Date().toISOString() }).eq("id", r.id);
    if (status === "approved") {
      await supabase.from("user_skills").upsert({ user_id: r.user_id, node_id: r.node_id }, { onConflict: "user_id,node_id" });
      await supabase.from("notifications").insert({ user_id: r.user_id, type: "skill", title: "SKILL UNLOCKED!", message: `${r.node_icon ?? "✨"} ${r.node_name} が認定されました`, link: "/skill-board", icon: "🗺️" });
    } else {
      await supabase.from("notifications").insert({ user_id: r.user_id, type: "skill", title: "スキル認定の結果", message: `${r.node_name}：今回は見送り${comment[r.id] ? "（" + comment[r.id] + "）" : ""}`, link: "/skill-board", icon: "🗺️" });
    }
    await load(); onChanged?.();
  }

  const shown = rows.filter((r) => (filter === "pending" ? r.status === "pending" : r.status !== "pending"));
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {(["pending", "done"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #cbd5e1", background: filter === f ? "#1e293b" : "#fff", color: filter === f ? "#fff" : "#334155", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            {f === "pending" ? `審査待ち (${pendingCount})` : "対応済み"}
          </button>
        ))}
      </div>
      {loading ? <div style={{ color: "#64748b" }}>読み込み中...</div> : shown.length === 0 ? <div style={{ color: "#64748b", padding: 20, textAlign: "center" }}>なし</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map((r) => (
            <div key={r.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 24 }}>{r.node_icon ?? "✨"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{r.user_name} <span style={{ color: "#64748b", fontWeight: 400 }}>→</span> {r.node_name}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{r.kind === "check" ? "🙋 メンター認定" : "📨 自己申告"} ・ {r.created_at.slice(0, 10)}</div>
                </div>
                {r.status !== "pending" && <span style={{ fontSize: 12, fontWeight: 800, color: r.status === "approved" ? "#16a34a" : "#dc2626" }}>{r.status === "approved" ? "承認" : "見送り"}</span>}
              </div>
              {r.description && <div style={{ fontSize: 13, background: "#f8fafc", borderRadius: 8, padding: 10, whiteSpace: "pre-wrap", marginBottom: 6 }}>{r.description}</div>}
              {r.url && <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#2563eb", display: "block", marginBottom: 6 }}>{r.url}</a>}
              {r.status === "pending" ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input value={comment[r.id] ?? ""} onChange={(e) => setComment({ ...comment, [r.id]: e.target.value })} placeholder="ひとこと（任意）" style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }} />
                  <button onClick={() => decide(r, "approved")} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontWeight: 800, cursor: "pointer" }}>承認</button>
                  <button onClick={() => decide(r, "rejected")} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #dc2626", background: "#fff", color: "#dc2626", fontWeight: 800, cursor: "pointer" }}>見送り</button>
                </div>
              ) : r.comment && <div style={{ fontSize: 12, color: "#475569" }}>💬 {r.comment}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
