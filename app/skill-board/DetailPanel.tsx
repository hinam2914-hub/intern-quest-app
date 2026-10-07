"use client";
import { useState } from "react";
import type { NodeState, JobState } from "../lib/skills";
import { AREA_COLOR } from "./world";

const STAGE: Record<string, { icon: string; label: string }> = {
  learn: { icon: "📖", label: "LEARN" }, practice: { icon: "🧪", label: "PRACTICE" }, prove: { icon: "🏆", label: "PROVE" }, check: { icon: "🙋", label: "CHECK" },
};
const CAT_LABEL: Record<string, string> = { sales: "SALES", comm: "COMMUNICATION", think: "THINKING", mgmt: "MANAGEMENT", ai: "AI SKILL" };

export default function DetailPanel({ node, jobs, isMobile, onClose, onRequestCheck, onClaim, focusState, nextNode, onChallenge, onPromote, onRemoveFocus }: {
  node: NodeState; jobs: JobState[]; isMobile: boolean; onClose: () => void;
  onRequestCheck: (n: NodeState) => void; onClaim: (n: NodeState, text: string, url: string) => void;
  focusState: "none" | "current" | "sub"; nextNode?: NodeState | null;
  onChallenge: (n: NodeState) => void; onPromote: (n: NodeState) => void; onRemoveFocus: (n: NodeState) => void;
}) {
  const [claimText, setClaimText] = useState(""); const [claimUrl, setClaimUrl] = useState("");
  const color = AREA_COLOR[node.category] ?? "#8b5cf6";
  const remaining = node.conds.filter((c) => !c.done).length;
  const nonCheckDone = node.conds.filter((c) => c.type !== "mentor_check" && c.type !== "claim_approved").every((c) => c.done);
  const needsCheck = node.conds.some((c) => c.type === "mentor_check" && !c.done);
  const needsClaim = node.conds.some((c) => c.type === "claim_approved" && !c.done);
  const leadsTo = jobs.filter((j) => j.requires.includes(node.id));

  const wrap: React.CSSProperties = isMobile
    ? { position: "fixed", left: 0, right: 0, bottom: 0, maxHeight: "72vh", borderRadius: "24px 24px 0 0", zIndex: 60 }
    : { position: "fixed", top: 16, right: 16, bottom: 16, width: 380, borderRadius: 24, zIndex: 60 };

  return (
    <div style={{ ...wrap, background: "linear-gradient(180deg,#ffffff,#f0f9ff)", boxShadow: "0 16px 50px rgba(30,41,59,.25)", border: "2px solid #fff", overflowY: "auto", padding: 20, color: "#1e293b", animation: isMobile ? "swSlideUp .3s ease-out" : "swSlideIn .3s ease-out" }}>
      <button onClick={onClose} style={{ position: "absolute", top: 12, right: 14, border: "none", background: "#e2e8f0", width: 30, height: 30, borderRadius: 15, fontWeight: 900, cursor: "pointer", color: "#475569" }}>×</button>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 58, height: 58, borderRadius: 29, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, background: node.status === "unlocked" ? color : "#f1f5f9", border: `3px solid ${color}`, boxShadow: node.status === "unlocked" ? `0 0 18px ${color}88` : "none" }}>{node.is_hidden && node.status === "locked" ? "？" : node.icon}</div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 900 }}>{node.is_hidden && node.status === "locked" ? "？？？" : node.name}</div>
          <div style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: 1 }}>{CAT_LABEL[node.category]} {node.kind === "key" && <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 6, background: "#fbbf24", color: "#1e293b" }}>KEY</span>}</div>
        </div>
      </div>
      {node.description && <div style={{ fontSize: 13, color: "#475569", background: "#ede9fe", borderRadius: 12, padding: "8px 12px", marginBottom: 12 }}>「{node.description}」</div>}

      {node.status === "unlocked" ? (
        <div style={{ background: "linear-gradient(135deg,#fef3c7,#fde68a)", borderRadius: 14, padding: 14, textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 26 }}>🎉</div>
          <div style={{ fontWeight: 900, fontSize: 15 }}>SKILL UNLOCKED</div>
          {node.unlocked_at && <div style={{ fontSize: 11, color: "#92400e" }}>{node.unlocked_at.slice(0, 10)} 取得</div>}
          {nextNode && <div style={{ fontSize: 12, color: "#78350f", marginTop: 6 }}>次に繋がるスキル：{nextNode.icon} {nextNode.name}</div>}
        </div>
      ) : node.status === "locked" ? (
        <div style={{ fontSize: 12, color: "#b45309", background: "#fef3c7", borderRadius: 10, padding: "8px 12px", marginBottom: 12 }}>🔒 前のスキルを取得するとここに来られます</div>
      ) : null}

      {(["learn", "practice", "prove", "check"] as const).map((st) => {
        const cs = node.conds.filter((c) => c.stage === st); if (!cs.length) return null;
        return (
          <div key={st} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, color: "#64748b", marginBottom: 4 }}>{STAGE[st].icon} {STAGE[st].label}</div>
            {cs.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: c.done ? "#dcfce7" : "#fff", border: `1px solid ${c.done ? "#86efac" : "#e2e8f0"}`, marginBottom: 4 }}>
                <span style={{ fontSize: 15 }}>{c.done ? "✓" : c.type === "mentor_check" || c.type === "claim_approved" ? "🔒" : "○"}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: c.done ? 500 : 700 }}>{c.label}</span>
                {c.threshold > 1 && <span style={{ fontSize: 12, fontWeight: 800, color: c.done ? "#16a34a" : color }}>{Math.min(c.current, c.threshold)} / {c.threshold}</span>}
              </div>
            ))}
          </div>
        );
      })}

      {node.status === "available" && remaining > 0 && (
        <div style={{ textAlign: "center", fontWeight: 900, fontSize: 14, color, margin: "6px 0 10px" }}>あと {remaining} つで解放！</div>
      )}
      {node.status === "available" && focusState === "none" && (
        <button onClick={() => onChallenge(node)} style={{ width: "100%", padding: 13, borderRadius: 14, border: "none", fontWeight: 900, fontSize: 14, cursor: "pointer", background: "linear-gradient(135deg,#fbbf24,#f59e0b)", color: "#fff", boxShadow: "0 6px 16px rgba(245,158,11,.4)", marginBottom: 8 }}>🎯 このスキルに挑戦する</button>
      )}
      {node.status !== "unlocked" && focusState === "current" && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ textAlign: "center", background: "linear-gradient(135deg,#fef3c7,#fde68a)", borderRadius: 12, padding: "8px 10px", fontWeight: 900, color: "#92400e", fontSize: 13 }}>🎯 CURRENT QUEST ・ 挑戦中</div>
          <button onClick={() => onRemoveFocus(node)} style={{ width: "100%", marginTop: 6, padding: 9, borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>挑戦をやめる</button>
        </div>
      )}
      {node.status !== "unlocked" && focusState === "sub" && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ textAlign: "center", background: "#fef9c3", borderRadius: 12, padding: "8px 10px", fontWeight: 900, color: "#a16207", fontSize: 13 }}>🎯 SUB QUEST</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button onClick={() => onPromote(node)} style={{ flex: 1, padding: 10, borderRadius: 12, border: "none", background: "linear-gradient(135deg,#fbbf24,#f59e0b)", color: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer" }}>メインに設定</button>
            <button onClick={() => onRemoveFocus(node)} style={{ flex: 1, padding: 10, borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>挑戦をやめる</button>
          </div>
        </div>
      )}

      {node.status !== "unlocked" && needsCheck && (
        node.pendingCheck
          ? <div style={{ textAlign: "center", fontSize: 13, color: "#b45309", background: "#fef3c7", borderRadius: 10, padding: 10 }}>⏳ メンター認定 審査中</div>
          : <button disabled={!nonCheckDone} onClick={() => onRequestCheck(node)} style={{ width: "100%", padding: 13, borderRadius: 14, border: "none", fontWeight: 900, fontSize: 14, cursor: "pointer", background: `linear-gradient(135deg,${color},${color}cc)`, color: "#fff", opacity: nonCheckDone ? 1 : 0.4, boxShadow: `0 6px 16px ${color}55` }}>🙋 メンター認定を申請する</button>
      )}
      {node.status !== "unlocked" && needsClaim && !node.pendingCheck && (
        <div style={{ marginTop: 8 }}>
          <textarea value={claimText} onChange={(e) => setClaimText(e.target.value)} placeholder="何をどう自動化／どんな仕組みを作った？" rows={3} style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", padding: 10, fontSize: 13, boxSizing: "border-box" }} />
          <input value={claimUrl} onChange={(e) => setClaimUrl(e.target.value)} placeholder="URLがあれば（任意）" style={{ width: "100%", marginTop: 6, borderRadius: 10, border: "1px solid #cbd5e1", padding: 10, fontSize: 13, boxSizing: "border-box" }} />
          <button onClick={() => onClaim(node, claimText, claimUrl)} style={{ width: "100%", marginTop: 6, padding: 13, borderRadius: 14, border: "none", fontWeight: 900, fontSize: 14, cursor: "pointer", background: `linear-gradient(135deg,${color},${color}cc)`, color: "#fff" }}>📨 申告してメンターに見てもらう</button>
        </div>
      )}
      {node.pendingCheck && needsClaim && <div style={{ textAlign: "center", fontSize: 13, color: "#b45309", background: "#fef3c7", borderRadius: 10, padding: 10 }}>⏳ 申告を審査中</div>}

      {leadsTo.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 12, color: "#475569" }}>
          このスキルは {leadsTo.map((j) => <span key={j.id} style={{ fontWeight: 900, color: "#b45309" }}>{j.icon} {j.name} </span>)} への道につながります
        </div>
      )}
      <style>{`@keyframes swSlideIn{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}@keyframes swSlideUp{from{transform:translateY(60px);opacity:0}to{transform:none;opacity:1}}`}</style>
    </div>
  );
}
