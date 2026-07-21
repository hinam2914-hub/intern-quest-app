"use client";
import React from "react";
import DotKun from "./DotKun";

// 累計ポイント(total_earned)から家のステージを返す
function getLevel(points: number): number { return Math.max(1, Math.floor(points / 100) + 1); }
function dotStage(level: number): number { return level >= 70 ? 5 : level >= 50 ? 4 : level >= 30 ? 3 : level >= 10 ? 2 : 1; }
export function getHouseStage(totalEarned: number) {
  const stages = [
    { min: 0, max: 500, name: "はじまりのテント", label: "STAGE 1" },
    { min: 500, max: 1500, name: "丸太小屋", label: "STAGE 2" },
    { min: 1500, max: 3000, name: "一軒家", label: "STAGE 3" },
    { min: 3000, max: 5000, name: "大きな家", label: "STAGE 4" },
    { min: 5000, max: 8000, name: "豪邸", label: "STAGE 5" },
    { min: 8000, max: 10000, name: "ドットくん城", label: "STAGE 6・GOAL" },
  ];
  let idx = stages.findIndex(s => totalEarned < s.max);
  if (idx === -1) idx = stages.length - 1; // 上限超え
  const stage = stages[idx];
  const UNLOCKS = [
    ["木の壁", "ちゃんとした屋根"],
    ["窓が増える", "玄関ができる"],
    ["煙突がつく", "二階建てに"],
    ["立派な門", "広い庭"],
    ["王様の城", "旗がはためく"],
    [],
  ];
  const nextName = idx < stages.length - 1 ? stages[idx + 1].name : null;
  const unlocks = UNLOCKS[idx] || [];
  const spanStart = stage.min;
  const spanEnd = stage.max;
  const progress = Math.min(100, Math.max(0, ((totalEarned - spanStart) / (spanEnd - spanStart)) * 100));
  const toNext = Math.max(0, spanEnd - totalEarned);
  const isMax = idx === stages.length - 1 && totalEarned >= 10000;
  return { idx, ...stage, progress, toNext, isMax, nextName, unlocks };
}

// ドットくんの顔（小）
function DotFace() {
  return (
    <div style={{ width: 30, height: 30, borderRadius: 9, background: "#6366f1", position: "relative", zIndex: 5 }}>
      <div style={{ position: "absolute", top: 9, left: 6, width: 5, height: 5, borderRadius: "50%", background: "#fff", boxShadow: "13px 0 0 #fff" }} />
      <div style={{ position: "absolute", top: 18, left: 10, width: 10, height: 5, borderRadius: "0 0 6px 6px", background: "#fff" }} />
    </div>
  );
}

// 各ステージの家（CSSで描画）
function HouseArt({ idx }: { idx: number }) {
  // 画像がある段階は画像を表示（なければ下のCSS描画にフォールバック）
  const HOUSE_IMAGES: Record<number, { src: string; w: number }> = {
    0: { src: "/island/house/0_tent.png", w: 128 },
    1: { src: "/island/house/1_cabin.png", w: 152 },
    2: { src: "/island/house/2_house.png", w: 172 },
    3: { src: "/island/house/3_big.png", w: 190 },
    4: { src: "/island/house/4_mansion.png", w: 214 },
    5: { src: "/island/house/5_castle.png", w: 208 },
  };
  const img = HOUSE_IMAGES[idx];
  if (img) {
    const hasChimney = idx === 3 || idx === 4;
    return (
      <div style={{ position: "relative" }}>
        {hasChimney && [0, 1, 2].map(i => (
          <div key={i} style={{ position: "absolute", top: idx === 4 ? "2%" : "6%", right: idx === 4 ? "10%" : "16%", width: 10 + i * 3, height: 10 + i * 3, borderRadius: "50%", background: "rgba(255,255,255,.55)", filter: "blur(1.5px)", animation: `smokeRise 3.2s ease-out ${i * 1.05}s infinite`, pointerEvents: "none" }} />
        ))}
        <img src={img.src} alt="house" style={{ width: img.w, height: "auto", display: "block", filter: "drop-shadow(0 8px 12px rgba(60,50,30,.28))" }} />
        <style>{`@keyframes smokeRise { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 15% { opacity: .8; } 100% { transform: translateY(-46px) scale(1.4); opacity: 0; } }`}</style>
      </div>
    );
  }
  const win = (extra: React.CSSProperties): React.CSSProperties => ({ position: "absolute", width: 14, height: 14, background: "#ffe08a", borderRadius: 3, ...extra });
  const door = (extra: React.CSSProperties): React.CSSProperties => ({ position: "absolute", bottom: 0, width: 14, height: 22, background: "#3a2a1a", borderRadius: "6px 6px 0 0", ...extra });

  if (idx === 0) {
    return <div style={{ width: 0, height: 0, borderLeft: "34px solid transparent", borderRight: "34px solid transparent", borderBottom: "46px solid #c05a4a", position: "relative" }}>
      <div style={{ position: "absolute", top: 20, left: -10, width: 20, height: 26, background: "#2a1a14", borderRadius: "10px 10px 0 0" }} />
    </div>;
  }
  if (idx === 1) {
    return <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", top: -18, left: -6, width: 0, height: 0, borderLeft: "34px solid transparent", borderRight: "34px solid transparent", borderBottom: "20px solid #6a4a3a" }} />
      <div style={{ width: 56, height: 40, background: "#8a6a4a", borderRadius: 3 }}>
        <div style={door({ left: 22 })} />
      </div>
    </div>;
  }
  if (idx === 2) {
    return <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", top: -22, left: -6, width: 0, height: 0, borderLeft: "41px solid transparent", borderRight: "41px solid transparent", borderBottom: "24px solid #b5453b" }} />
      <div style={{ width: 70, height: 50, background: "#d8c0a0", borderRadius: 3, position: "relative" }}>
        <div style={win({ top: 12, left: 12 })} />
        <div style={win({ top: 12, right: 12 })} />
        <div style={door({ left: 28 })} />
      </div>
    </div>;
  }
  if (idx === 3) {
    return <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", top: -34, right: 14, width: 12, height: 20, background: "#7a5a4a" }} />
      <div style={{ position: "absolute", top: -24, left: -6, width: 0, height: 0, borderLeft: "52px solid transparent", borderRight: "52px solid transparent", borderBottom: "26px solid #a03e34" }} />
      <div style={{ width: 92, height: 60, background: "#e0c8a8", borderRadius: 3, position: "relative" }}>
        <div style={win({ top: 14, left: 14 })} />
        <div style={win({ top: 14, right: 14 })} />
        <div style={win({ bottom: 8, left: 14 })} />
        <div style={door({ left: 39 })} />
      </div>
    </div>;
  }
  if (idx === 4) {
    return <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", top: -44, left: 46, width: 28, height: 40, background: "#e8d8b8" }}>
        <div style={{ position: "absolute", top: -16, left: -3, width: 0, height: 0, borderLeft: "17px solid transparent", borderRight: "17px solid transparent", borderBottom: "18px solid #8a3a30" }} />
      </div>
      <div style={{ position: "absolute", top: -20, left: 6, width: 108, height: 22, background: "#8a3a30", borderRadius: "4px 4px 0 0" }} />
      <div style={{ width: 120, height: 72, background: "linear-gradient(#f0e4c8, #e0cca0)", borderRadius: 4, position: "relative" }}>
        <div style={{ position: "absolute", bottom: 0, left: 12, width: 8, height: 40, background: "#fff8e8" }} />
        <div style={{ position: "absolute", bottom: 0, right: 12, width: 8, height: 40, background: "#fff8e8" }} />
        <div style={win({ top: 12, left: 30 })} />
        <div style={win({ top: 12, right: 30 })} />
        <div style={door({ left: 53, height: 40 })} />
      </div>
    </div>;
  }
  // idx === 5 城
  return <div style={{ position: "relative" }}>
    <div style={{ position: "absolute", top: -30, left: -8, width: 26, height: 50, background: "#b8c0cc" }}>
      <div style={{ position: "absolute", top: -14, left: -2, width: 0, height: 0, borderLeft: "15px solid transparent", borderRight: "15px solid transparent", borderBottom: "16px solid #7a5cc0" }} />
    </div>
    <div style={{ position: "absolute", top: -30, right: -8, width: 26, height: 50, background: "#b8c0cc" }}>
      <div style={{ position: "absolute", top: -14, left: -2, width: 0, height: 0, borderLeft: "15px solid transparent", borderRight: "15px solid transparent", borderBottom: "16px solid #7a5cc0" }} />
    </div>
    <div style={{ position: "absolute", top: -52, left: "50%", width: 2, height: 20, background: "#888" }}>
      <div style={{ position: "absolute", top: 0, left: 2, width: 16, height: 11, background: "#f5c542", clipPath: "polygon(0 0,100% 0,100% 100%,0 100%,30% 50%)" }} />
    </div>
    <div style={{ width: 140, height: 80, background: "linear-gradient(#dfe4ea, #c4ccd6)", borderRadius: 4, position: "relative" }}>
      <div style={{ position: "absolute", top: -8, left: 0, right: 0, height: 8, background: "repeating-linear-gradient(90deg,#c4ccd6 0 10px, transparent 10px 16px)" }} />
      <div style={win({ top: 20, left: 24 })} />
      <div style={win({ top: 20, right: 24 })} />
      <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 22, height: 34, background: "#4a3a5a", borderRadius: "11px 11px 0 0" }} />
    </div>
  </div>;
}

export default function DotHouse({ totalEarned, accent = "#a78bfa", light = false, onHouseClick }: { totalEarned: number; accent?: string; light?: boolean; onHouseClick?: () => void }) {
  const h = getHouseStage(totalEarned);
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {/* 家のシーン */}
      <div style={{ width: "100%", height: light ? 205 : 140, borderRadius: 18, background: light ? "transparent" : "radial-gradient(circle at 50% 20%, #1a1a35 0%, #0d0d18 70%)", border: light ? "none" : "1px solid rgba(255,255,255,0.08)", position: "relative", overflow: light ? "visible" : "hidden", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        {!light && <div style={{ position: "absolute", top: 16, right: 24, width: 26, height: 26, borderRadius: "50%", background: "radial-gradient(circle at 60% 40%, #fdf6d8, #e8dca0)", boxShadow: "0 0 20px rgba(253,246,216,0.3)" }} />}
        {!light && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 36, background: "linear-gradient(180deg, #1e2a3a, #16202c)" }} />}
        <div style={{ position: "relative", display: "flex", alignItems: "flex-end", marginBottom: light ? 6 : 30, gap: 8 }}>
          <div onClick={onHouseClick} style={{ cursor: onHouseClick ? "pointer" : "default", transition: "transform 0.15s" }} onMouseDown={(e) => { if (onHouseClick) e.currentTarget.style.transform = "scale(0.96)"; }} onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}>
            <HouseArt idx={h.idx} />
          </div>
          <div style={{ marginLeft: 6, marginBottom: 2, animation: "floaty 2.2s ease-in-out infinite" }}><DotKun size={40} stage={dotStage(getLevel(totalEarned))} mood="cheer" /></div>
        </div>
      </div>
      {/* ステージ情報 */}
      <div style={light ? { width: "100%", background: "url(/island/level_bar_bg.png) center / 100% 100% no-repeat", padding: "14px 24px 16px", display: "flex", alignItems: "center", gap: 12 } : { width: "100%" }}>
        {light && <div style={{ fontSize: 24, flexShrink: 0, filter: "drop-shadow(0 1px 2px rgba(150,100,30,.35))" }}>⭐</div>}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: light ? "#7a5a2b" : "#fff" }}>{h.isMax ? "👑 GOAL達成！" : h.nextName ? `${h.idx === 4 ? "🏰" : "🏠"} ${h.nextName}まで` : "🏰 ドットくん城 完成まで"}</div>
            <div style={{ fontSize: 11, fontWeight: light ? 800 : 400, color: light ? "#e8590c" : "#8a8898" }}>{h.isMax ? "MAX！" : `あと ${h.toNext.toLocaleString()}pt`}</div>
          </div>
          <div style={{ height: light ? 10 : 6, background: light ? "rgba(150,110,50,.18)" : "rgba(255,255,255,0.08)", borderRadius: 6, overflow: "hidden", boxShadow: light ? "inset 0 1px 2px rgba(120,80,30,.25)" : "none" }}>
            <div style={{ width: `${h.progress}%`, height: "100%", background: light ? "linear-gradient(180deg, #8ee04a, #5cbf2a)" : `linear-gradient(90deg, ${accent}, #8b5cf6)`, borderRadius: 6, transition: "width 1.2s cubic-bezier(.4,1.2,.4,1)" }} />
          </div>
          {light && !h.isMax && h.unlocks.length > 0 && (
            <div style={{ marginTop: 7, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {h.unlocks.map((u: string, i: number) => (
                <div key={i} style={{ fontSize: 10.5, fontWeight: 700, color: "#9a7a4a", display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: 9, color: "#c0a070" }}>◆</span>{u}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
