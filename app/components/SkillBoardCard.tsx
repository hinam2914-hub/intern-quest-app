"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { evaluateUser, syncUnlocks, getFocus, questMission, nearestJob, CATEGORIES, type EvalResult, type Focus } from "../lib/skills";

export default function SkillBoardCard({ userId, mode = "self" }: { userId?: string; mode?: "self" | "public" }) {
  const router = useRouter();
  const [res, setRes] = useState<EvalResult | null>(null);
  const [focus, setFocus] = useState<Focus>({ current: null, subs: [] });
  useEffect(() => {
    (async () => {
      let uid = userId;
      if (!uid) { const { data: { user } } = await supabase.auth.getUser(); uid = user?.id; }
      if (!uid) return;
      let r = await evaluateUser(supabase, uid);
      if (mode === "self") { const { newNodes, newJobs } = await syncUnlocks(supabase, uid, r); if (newNodes.length || newJobs.length) r = await evaluateUser(supabase, uid); setFocus(await getFocus(supabase, uid)); }
      setRes(r);
    })();
  }, [userId, mode]);
  if (!res) return null;
  const total = res.nodes.filter((n) => n.status === "unlocked").length;
  const cur = focus.current ? res.nodes.find((n) => n.id === focus.current) : null;
  const job = nearestJob(res);
  const jobsUnlocked = res.jobs.filter((j) => j.unlocked);
  const rep = [...res.nodes].filter((n) => n.status === "unlocked").sort((a, b) => (a.kind === "key" ? -1 : 1) - (b.kind === "key" ? -1 : 1) || (b.unlocked_at ?? "").localeCompare(a.unlocked_at ?? "")).slice(0, 4);
  const card: React.CSSProperties = { background: "linear-gradient(135deg,#ffffff,#eff6ff 60%,#f5f3ff)", borderRadius: 18, padding: 16, marginBottom: 14, color: "#1e293b", border: "1.5px solid #dbeafe", boxShadow: "0 4px 14px rgba(99,102,241,.12)" };
  const lvRow = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4, marginTop: 10 }}>
      {CATEGORIES.map((c) => (
        <div key={c.key} style={{ textAlign: "center" }}>
          <div style={{ fontSize: 8, color: "#64748b", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden" }}>{c.en.split(" ")[0]}</div>
          <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 2 }}>{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ width: 6, height: 6, borderRadius: 3, background: i <= res.levels[c.key] ? c.color : "#e2e8f0" }} />)}</div>
        </div>
      ))}
    </div>
  );

  if (mode === "public") return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13.5, fontWeight: 900 }}>🌱 SKILL WORLD</div>
        <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 800 }}>取得 {total} / {res.nodes.length}</div>
      </div>
      {jobsUnlocked.length > 0 && <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>{jobsUnlocked.map((j) => <span key={j.id} style={{ fontSize: 11, fontWeight: 900, padding: "3px 8px", borderRadius: 8, background: "#fbbf24", color: "#1e293b" }}>{j.icon} {j.name}</span>)}</div>}
      {rep.length > 0 && <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>{rep.map((n) => <span key={n.id} style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0" }}>{n.icon} {n.name}</span>)}</div>}
      {lvRow}
    </div>
  );

  const qm = cur ? questMission(cur) : null;
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13.5, fontWeight: 900 }}>🌱 SKILL WORLD</div>
        <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 800 }}>{total} / {res.nodes.length}</div>
      </div>
      {cur ? (
        <div style={{ marginTop: 10, background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: "#b45309" }}>🎯 CURRENT QUEST</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
            <span style={{ fontSize: 22 }}>{cur.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 14 }}>{cur.name}</div>
              <div style={{ height: 6, borderRadius: 3, background: "#fde68a", marginTop: 4, overflow: "hidden" }}><div style={{ width: `${Math.round(cur.progress * 100)}%`, height: "100%", background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }} /></div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#b45309" }}>{Math.round(cur.progress * 100)}%</span>
          </div>
          {qm && <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 12.5, fontWeight: 900, color: "#1e293b" }}>{qm.title}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", marginTop: 2 }}>{qm.detail}</div>
          </div>}
        </div>
      ) : (
        <div onClick={() => router.push("/skill-board")} style={{ marginTop: 10, background: "#fffbeb", border: "1.5px dashed #fbbf24", borderRadius: 12, padding: "10px 12px", fontSize: 13, fontWeight: 800, color: "#92400e", cursor: "pointer" }}>🎯 挑戦するスキルを選ぼう →</div>
      )}
      {job && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12, fontWeight: 800, color: "#475569" }}><span>👑 目標JOB</span><span style={{ color: "#1e293b", fontWeight: 900 }}>{job.name}</span><span style={{ color: "#94a3b8" }}>{job.unlocked ? "取得済み" : `${job.requires.length - job.missing.length} / ${job.requires.length}`}</span></div>}
      {lvRow}
      <button onClick={() => router.push(cur ? "/skill-board?focus=1" : "/skill-board")} style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 12, border: "none", background: "linear-gradient(135deg,#8b5cf6,#6366f1)", color: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer" }}>スキルワールドへ →</button>
    </div>
  );
}
