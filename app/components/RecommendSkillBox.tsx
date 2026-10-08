"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { evaluateUser, CATEGORIES, type NodeState } from "../lib/skills";

/** メンター用：メンバーにスキルをおすすめする（skill_recommendations に登録＋通知） */
export default function RecommendSkillBox() {
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [avail, setAvail] = useState<NodeState[]>([]);
  const [node, setNode] = useState<NodeState | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { (async () => { const { data } = await supabase.from("profiles").select("id, name").eq("is_active", true).order("name"); setMembers((data ?? []) as any); })(); }, []);
  useEffect(() => { (async () => { if (!target) { setAvail([]); return; } const r = await evaluateUser(supabase, target.id); setAvail(r.nodes.filter((n) => n.status === "available")); setNode(null); })(); }, [target]);

  async function send() {
    if (!target || !node) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("skill_recommendations").insert({ user_id: target.id, node_id: node.id, source: "mentor", reason: reason.trim() || null, created_by: user?.id ?? null });
    await supabase.from("notifications").insert({ user_id: target.id, type: "skill", title: "✨ メンターからおすすめスキル", message: `${node.icon} ${node.name}${reason.trim() ? "：" + reason.trim() : ""}`, link: "/skill-board", icon: "🗺️" });
    setBusy(false); setReason(""); setNode(null); alert(`${target.name}さんに「${node.name}」をおすすめしました`);
  }
  const col = (c: string) => CATEGORIES.find((x) => x.key === c)?.color ?? "#8b5cf6";
  const filtered = members.filter((m) => !q || m.name.includes(q)).slice(0, 8);

  return (
    <div style={{ background: "linear-gradient(135deg,#fdf2f8,#f5f3ff)", border: "1.5px solid #f9a8d4", borderRadius: 16, padding: 14, marginBottom: 14 }}>
      <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
        <div style={{ fontWeight: 900, fontSize: 14, color: "#1e293b" }}>✨ スキルをおすすめする</div>
        <span style={{ fontSize: 12, color: "#64748b" }}>{open ? "閉じる" : "開く"}</span>
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="メンバーを検索" style={{ width: "100%", padding: 9, borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {filtered.map((m) => <button key={m.id} onClick={() => setTarget(m)} style={{ padding: "5px 10px", borderRadius: 999, border: "1.5px solid #c4b5fd", background: target?.id === m.id ? "#8b5cf6" : "#fff", color: target?.id === m.id ? "#fff" : "#4c1d95", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{m.name}</button>)}
          </div>
          {target && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, marginBottom: 6 }}>{target.name}さんが今挑戦できるスキル</div>
              {avail.length === 0 ? <div style={{ fontSize: 12, color: "#94a3b8" }}>読み込み中…</div> : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {avail.map((n) => <button key={n.id} onClick={() => setNode(n)} style={{ padding: "6px 10px", borderRadius: 10, border: `1.5px solid ${col(n.category)}`, background: node?.id === n.id ? col(n.category) : "#fff", color: node?.id === n.id ? "#fff" : "#1e293b", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{n.icon} {n.name} <span style={{ opacity: .7 }}>{Math.round(n.progress * 100)}%</span></button>)}
                </div>
              )}
              <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 80))} placeholder="ひとこと理由（例：来週の面談に向けて）" style={{ width: "100%", marginTop: 8, padding: 9, borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, boxSizing: "border-box" }} />
              <button disabled={!node || busy} onClick={send} style={{ width: "100%", marginTop: 8, padding: 11, borderRadius: 12, border: "none", background: node ? "linear-gradient(135deg,#f472b6,#ec4899)" : "#e2e8f0", color: "#fff", fontWeight: 900, fontSize: 13, cursor: node ? "pointer" : "default" }}>✨ おすすめを送る</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
