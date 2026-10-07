"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { evaluateUser, syncUnlocks, CATEGORIES, type EvalResult } from "../lib/skills";

export default function SkillBoardCard({ userId }: { userId?: string }) {
  const router = useRouter();
  const [res, setRes] = useState<EvalResult | null>(null);
  useEffect(() => {
    (async () => {
      let uid = userId;
      if (!uid) { const { data: { user } } = await supabase.auth.getUser(); uid = user?.id; }
      if (!uid) return;
      const r = await evaluateUser(supabase, uid);
      const { newNodes, newJobs } = await syncUnlocks(supabase, uid, r);
      setRes(newNodes.length || newJobs.length ? await evaluateUser(supabase, uid) : r);
    })();
  }, [userId]);
  if (!res) return null;
  const total = res.nodes.filter((n) => n.status === "unlocked").length;
  const next = res.nodes.filter((n) => n.status === "available").sort((a, b) => b.progress - a.progress)[0];
  const jobs = res.jobs.filter((j) => j.unlocked);
  return (
    <div onClick={() => router.push("/skill-board")} style={{ background: "linear-gradient(135deg,#1e1b4b,#312e81)", borderRadius: 18, padding: 16, marginBottom: 14, color: "#fff", cursor: "pointer", boxShadow: "0 4px 14px rgba(49,46,129,0.3)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 13.5, fontWeight: 900, letterSpacing: 1 }}>🗺️ SKILL BOARD</div>
        <div style={{ fontSize: 12, color: "#c7d2fe" }}>{total} / {res.nodes.length} ›</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5, marginBottom: 10 }}>
        {CATEGORIES.map((c) => (
          <div key={c.key} style={{ textAlign: "center", background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "6px 2px" }}>
            <div style={{ fontSize: 8, letterSpacing: 0.5, color: "#c7d2fe", whiteSpace: "nowrap", overflow: "hidden" }}>{c.en}</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: c.color }}>Lv.{res.levels[c.key]}</div>
          </div>
        ))}
      </div>
      {jobs.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {jobs.map((j) => <span key={j.id} style={{ fontSize: 11, fontWeight: 900, padding: "3px 8px", borderRadius: 8, background: "#fbbf24", color: "#1e1b4b" }}>{j.icon} {j.name}</span>)}
        </div>
      )}
      {next ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 10px" }}>
          <span style={{ fontSize: 20 }}>{next.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800 }}>次：{next.name}</div>
            <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", marginTop: 4, overflow: "hidden" }}>
              <div style={{ width: `${Math.round(next.progress * 100)}%`, height: "100%", background: "#a5b4fc" }} />
            </div>
          </div>
          <span style={{ fontSize: 11, color: "#c7d2fe" }}>{Math.round(next.progress * 100)}%</span>
        </div>
      ) : <div style={{ fontSize: 12, color: "#c7d2fe" }}>全スキル取得！🎉</div>}
    </div>
  );
}
