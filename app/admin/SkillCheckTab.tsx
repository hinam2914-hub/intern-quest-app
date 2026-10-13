"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { STAGES, evaluateStages } from "../lib/stages";
import { evaluateUser, syncUnlocks } from "../lib/skills";

type Row = {
  id: string; kind: "check" | "claim" | "stage"; user_id: string; node_id: string; status: string;
  description?: string | null; url?: string | null; comment: string | null; created_at: string; decided_at: string | null;
  user_name: string; node_name: string; node_icon: string | null; node_category: string;
};

export default function SkillCheckTab({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"pending" | "done">("pending");
  const [comment, setComment] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [reeval, setReeval] = useState<{ running: boolean; done: number; total: number; log: string[] }>({ running: false, done: 0, total: 0, log: [] });

  /** 全メンバーを再評価：取れているのに未取得のスキル・STAGE を一括で解除する（告知前などに実行） */
  async function reevaluateAll() {
    if (reeval.running) return;
    if (!confirm("全メンバーのスキル・STAGE を再評価して、条件を満たしているものを一括で解除します。実行しますか？")) return;
    const { data: profiles } = await supabase.from("profiles").select("id, name").order("name");
    const list = profiles ?? [];
    setReeval({ running: true, done: 0, total: list.length, log: [] });
    const log: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const p: any = list[i];
      try {
        const r = await evaluateUser(supabase, p.id);
        const { newNodes, newJobs } = await syncUnlocks(supabase, p.id, r);
        const st = await evaluateStages(supabase, p.id);
        const parts: string[] = [];
        if (newNodes.length) parts.push(`スキル ${newNodes.map((n) => n.name).join("・")}`);
        if (newJobs.length) parts.push(`称号 ${newJobs.map((j) => j.name).join("・")}`);
        if (st.newCleared.length) parts.push(`STAGE ${st.newCleared.map((s) => s.name).join("・")}`);
        if (parts.length) log.push(`✅ ${p.name ?? p.id}：${parts.join(" / ")}`);
      } catch (e: any) {
        log.push(`⚠️ ${p.name ?? p.id}：${e?.message ?? "エラー"}`);
      }
      setReeval({ running: true, done: i + 1, total: list.length, log: [...log] });
    }
    setReeval({ running: false, done: list.length, total: list.length, log: log.length ? log : ["新しく解除されたものはありませんでした"] });
    onChanged?.();
  }

  async function load() {
    setLoading(true);
    const [checks, claims, profiles, nodes, stageClaims] = await Promise.all([
      supabase.from("skill_checks").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("skill_claims").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("profiles").select("id, name"),
      supabase.from("skill_nodes").select("id, name, icon, category"),
      supabase.from("stage_claims").select("*").order("created_at", { ascending: false }).limit(300),
    ]);
    const pm = new Map((profiles.data ?? []).map((p: any) => [p.id, p.name]));
    const nm = new Map((nodes.data ?? []).map((n: any) => [n.id, n]));
    const mkStage = (r: any): Row => { const st = STAGES.find((x) => x.id === r.stage_id); return ({
      id: r.id, kind: "stage", user_id: r.user_id, node_id: r.stage_id, status: r.status, description: r.description, url: r.url,
      comment: r.comment, created_at: r.created_at, decided_at: r.decided_at,
      user_name: pm.get(r.user_id) ?? "?", node_name: st?.name ?? r.stage_id, node_icon: st?.icon ?? "🏁", node_category: "stage",
    }); };
    const mk = (r: any, kind: "check" | "claim"): Row => ({
      id: r.id, kind, user_id: r.user_id, node_id: r.node_id, status: r.status, description: r.description, url: r.url,
      comment: r.comment, created_at: r.created_at, decided_at: r.decided_at,
      user_name: pm.get(r.user_id) ?? "?", node_name: nm.get(r.node_id)?.name ?? r.node_id,
      node_icon: nm.get(r.node_id)?.icon ?? null, node_category: nm.get(r.node_id)?.category ?? "",
    });
    const all = [...(checks.data ?? []).map((r: any) => mk(r, "check")), ...(claims.data ?? []).map((r: any) => mk(r, "claim")), ...(stageClaims.data ?? []).map(mkStage)]
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    setRows(all); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function decide(r: Row, status: "approved" | "rejected") {
    const { data: { user } } = await supabase.auth.getUser();
    const table = r.kind === "check" ? "skill_checks" : r.kind === "claim" ? "skill_claims" : "stage_claims";
    await supabase.from(table).update({ status, checker_id: user?.id ?? null, comment: comment[r.id] ?? null, decided_at: new Date().toISOString() }).eq("id", r.id);
    if (r.kind === "stage") {
      if (status === "approved") {
        await supabase.from("user_stages").upsert({ user_id: r.user_id, stage_id: r.node_id }, { onConflict: "user_id,stage_id" });
        await supabase.from("notifications").insert({ user_id: r.user_id, type: "skill", title: "STAGE CLEAR!", message: `${r.node_icon ?? "🏁"} ${r.node_name} が承認されました`, link: "/skill-board", icon: "🏁" });
      } else {
        await supabase.from("notifications").insert({ user_id: r.user_id, type: "skill", title: "STAGE申告の結果", message: `${r.node_name}：今回は見送り${comment[r.id] ? "（" + comment[r.id] + "）" : ""}`, link: "/skill-board", icon: "🏁" });
      }
      await load(); onChanged?.(); return;
    }
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
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        {(["pending", "done"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #cbd5e1", background: filter === f ? "#1e293b" : "#fff", color: filter === f ? "#fff" : "#334155", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            {f === "pending" ? `審査待ち (${pendingCount})` : "対応済み"}
          </button>
        ))}
        <button onClick={reevaluateAll} disabled={reeval.running} style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 20, border: "1px solid #f59e0b", background: reeval.running ? "#fef3c7" : "#fff7ed", color: "#92400e", fontWeight: 800, fontSize: 13, cursor: reeval.running ? "wait" : "pointer" }}>
          {reeval.running ? `再評価中… ${reeval.done}/${reeval.total}` : "🔄 全員を再評価"}
        </button>
      </div>
      {reeval.log.length > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#78350f", maxHeight: 220, overflowY: "auto" }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>再評価の結果（{reeval.done}/{reeval.total}人）</div>
          {reeval.log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {loading ? <div style={{ color: "#64748b" }}>読み込み中...</div> : shown.length === 0 ? <div style={{ color: "#64748b", padding: 20, textAlign: "center" }}>なし</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map((r) => (
            <div key={r.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 24 }}>{r.node_icon ?? "✨"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{r.user_name} <span style={{ color: "#64748b", fontWeight: 400 }}>→</span> {r.node_name}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{r.kind === "check" ? "🙋 メンター認定" : r.kind === "claim" ? "📨 自己申告" : "🏁 STAGE申告"} ・ {r.created_at.slice(0, 10)}</div>
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
