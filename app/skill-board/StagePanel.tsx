"use client";
// STAGE パネル：事業部別のキャリアの階段
import { useState } from "react";
import type { StageResult, StageState } from "../lib/stages";
import { stageText } from "../lib/stages";

export default function StagePanel({ res, isMobile, onClose, onClaim }: {
  res: StageResult; isMobile: boolean; onClose: () => void; onClaim: (stageId: string, text: string, url: string) => Promise<void> | void;
}) {
  const [text, setText] = useState(""); const [url, setUrl] = useState(""); const [busy, setBusy] = useState(false);
  const wrap: React.CSSProperties = isMobile
    ? { position: "fixed", left: 0, right: 0, bottom: 0, maxHeight: "78vh", borderRadius: "24px 24px 0 0", zIndex: 60 }
    : { position: "fixed", top: 16, right: 16, bottom: 16, width: 380, borderRadius: 24, zIndex: 60 };
  const deptLabel = res.dept === "IP" ? "IP" : res.dept === "CB" || res.dept === "SP" ? `${res.dept}${res.position === "closer" ? "・クローザー" : res.position === "appointer" ? "・アポインター" : ""}` : res.dept || "未設定";
  const cleared = res.stages.filter((s) => s.cleared).length;

  const row = (s: StageState, i: number) => {
    const isCur = res.current?.id === s.id;
    const left = Math.max(0, s.threshold - Math.min(s.current, s.threshold));
    return (
      <div key={s.id} style={{ position: "relative", marginBottom: 8 }}>
        <div style={{ position: "absolute", left: -21, top: 16, width: 14, height: 14, borderRadius: 7, background: s.cleared ? "#f59e0b" : "#fff", border: `3px solid ${s.cleared ? "#f59e0b" : isCur ? "#f59e0b" : "#cbd5e1"}`, boxShadow: isCur ? "0 0 0 4px #fde68a" : "none" }} />
        <div style={{ border: isCur ? "2px solid #fbbf24" : "1.5px solid #e2e8f0", background: s.cleared ? "#fffbeb" : "#fff", borderRadius: 14, padding: "9px 12px", opacity: !s.cleared && !isCur ? 0.75 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22, filter: s.cleared || isCur ? "none" : "grayscale(1)" }}>{s.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 900, fontSize: 14 }}>{s.name}</span>
                {s.cleared && <span style={{ fontSize: 10, fontWeight: 900, color: "#92400e", background: "#fde68a", borderRadius: 6, padding: "1px 6px" }}>CLEAR</span>}
                {isCur && <span style={{ fontSize: 10, fontWeight: 900, color: "#fff", background: "#f59e0b", borderRadius: 6, padding: "1px 6px" }}>NOW</span>}
                {s.pending && <span style={{ fontSize: 10, fontWeight: 900, color: "#b45309", background: "#fef3c7", borderRadius: 6, padding: "1px 6px" }}>承認待ち</span>}
              </div>
              <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>{s.label}</div>
            </div>
            {s.threshold > 1 && !s.cleared && <span style={{ fontSize: 12, fontWeight: 900, color: "#b45309" }}>{Math.min(s.current, s.threshold)} / {s.threshold}</span>}
            {s.cleared && s.cleared_at && <span style={{ fontSize: 10, color: "#94a3b8" }}>{s.cleared_at.slice(0, 10)}</span>}
          </div>
          {isCur && s.type !== "stage_claim" && s.threshold > 1 && (
            <div style={{ height: 6, borderRadius: 3, background: "#fde68a", marginTop: 8, overflow: "hidden" }}><div style={{ width: `${Math.round(Math.min(1, s.current / s.threshold) * 100)}%`, height: "100%", background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }} /></div>
          )}
          {isCur && s.type === "stage_claim" && !s.pending && (
            <div style={{ marginTop: 8 }}>
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={s.claimHint ?? "受けた内容を書いてください"} rows={3} style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", padding: 9, fontSize: 13, boxSizing: "border-box" }} />
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="資料やメモのURL（任意）" style={{ width: "100%", marginTop: 6, borderRadius: 10, border: "1px solid #cbd5e1", padding: 9, fontSize: 13, boxSizing: "border-box" }} />
              <button disabled={busy || !text.trim()} onClick={async () => { setBusy(true); await onClaim(s.id, text, url); setBusy(false); setText(""); setUrl(""); }} style={{ width: "100%", marginTop: 6, padding: 11, borderRadius: 12, border: "none", fontWeight: 900, fontSize: 13, cursor: "pointer", background: "linear-gradient(135deg,#f59e0b,#f97316)", color: "#fff", opacity: !text.trim() ? 0.5 : 1 }}>📨 研修を受けたことを申告する</button>
            </div>
          )}
          {isCur && s.type !== "stage_claim" && left > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", marginTop: 6 }}>🏁 {stageText(s)}</div>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ ...wrap, background: "linear-gradient(180deg,#ffffff,#fff7ed)", boxShadow: "0 16px 50px rgba(30,41,59,.25)", border: "2px solid #fff", overflowY: "auto", padding: 20, color: "#1e293b", animation: isMobile ? "swSlideUp .3s ease-out" : "swSlideIn .3s ease-out" }}>
      <button onClick={onClose} style={{ position: "absolute", top: 12, right: 14, border: "none", background: "#e2e8f0", width: 30, height: 30, borderRadius: 15, fontWeight: 900, cursor: "pointer", color: "#475569" }}>×</button>
      <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, color: "#b45309" }}>🏁 STAGE</div>
      <div style={{ fontSize: 19, fontWeight: 900, marginTop: 2 }}>キャリアの階段</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, marginBottom: 12 }}>{deptLabel} ・ {cleared} / {res.stages.length} クリア</div>
      {res.current ? (
        <div style={{ background: "linear-gradient(180deg,#fffbeb,#fef3c7)", border: "2px solid #fde68a", borderRadius: 14, padding: "10px 12px", marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: "#b45309", letterSpacing: 1 }}>NEXT STAGE</div>
          <div style={{ fontSize: 15, fontWeight: 900, marginTop: 2 }}>{res.current.icon} {res.current.name}</div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#92400e", marginTop: 2 }}>{stageText(res.current)}</div>
        </div>
      ) : (
        <div style={{ background: "linear-gradient(135deg,#fef3c7,#fde68a)", borderRadius: 14, padding: 14, textAlign: "center", marginBottom: 14, fontWeight: 900 }}>👑 全STAGEクリア！</div>
      )}
      <div style={{ position: "relative", paddingLeft: 22 }}>
        <div style={{ position: "absolute", left: 6, top: 16, bottom: 16, width: 3, borderRadius: 2, background: "linear-gradient(180deg,#f59e0b,#e2e8f0)" }} />
        {res.stages.map(row)}
      </div>
      {!res.dept && <div style={{ fontSize: 12, color: "#b45309", background: "#fef3c7", borderRadius: 10, padding: "8px 12px", marginTop: 8 }}>事業部が未設定です。プロフィールで事業部を設定すると、事業部の階段が表示されます。</div>}
      <style>{`@keyframes swSlideIn{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}@keyframes swSlideUp{from{transform:translateY(60px);opacity:0}to{transform:none;opacity:1}}`}</style>
    </div>
  );
}
