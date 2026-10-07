"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { evaluateUser, getFocus, pickQuestCond, questText, type NodeState } from "../lib/skills";

export default function TodayQuestCard() {
  const router = useRouter();
  const [cur, setCur] = useState<NodeState | null | undefined>(undefined);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
      const [r, f] = await Promise.all([evaluateUser(supabase, user.id), getFocus(supabase, user.id)]);
      setCur(f.current ? r.nodes.find((n) => n.id === f.current) ?? null : null);
    })();
  }, []);
  if (cur === undefined) return null;
  const qc = cur ? pickQuestCond(cur) : null;
  return (
    <div onClick={() => router.push(cur ? "/skill-board?focus=1" : "/skill-board")} style={{ margin: "12px 0", borderRadius: 18, padding: "12px 14px", cursor: "pointer", background: "linear-gradient(135deg,#fffbeb,#fef3c7)", border: "1.5px solid #fde68a", boxShadow: "0 4px 14px rgba(245,158,11,.15)", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ fontSize: 30 }}>{cur ? cur.icon : "🎯"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: "#b45309" }}>🎯 今日の冒険</div>
        {cur ? (<>
          <div style={{ fontWeight: 900, fontSize: 14, color: "#1e293b" }}>{cur.name}</div>
          <div style={{ height: 6, borderRadius: 3, background: "#fde68a", marginTop: 4, overflow: "hidden" }}><div style={{ width: `${Math.round(cur.progress * 100)}%`, height: "100%", background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }} /></div>
          {qc && <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", marginTop: 4 }}>{questText(qc)}</div>}
        </>) : <div style={{ fontWeight: 800, fontSize: 13, color: "#92400e" }}>スキルワールドで挑戦するスキルを選ぼう</div>}
      </div>
      <div style={{ fontSize: 12, fontWeight: 900, color: "#b45309", whiteSpace: "nowrap" }}>{cur ? "冒険を続ける →" : "→"}</div>
    </div>
  );
}
