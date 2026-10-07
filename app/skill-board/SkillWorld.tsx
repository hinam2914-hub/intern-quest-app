"use client";
import { useEffect, useRef, useState } from "react";
import { pickQuestCond, questText, type EvalResult, type NodeState, type JobState, type Focus } from "../lib/skills";
import { WORLD_W, WORLD_H, START, NODE_POS, JOB_POS, AREAS, AREA_COLOR, ROADS, pt, curve, type Pt } from "./world";

type Cam = { x: number; y: number; s: number };

const LANDMARK: Record<string, string> = {
  comm_1: "🏡", comm_2: "🪧", comm_3: "🛖", comm_4: "⛲", comm_5: "📬", comm_6: "🎪",
  sales_1: "🏪", sales_2: "🛖", sales_3: "⛺", sales_4: "🏬", sales_5: "🏟️", sales_6: "🗼",
  think_1: "⛺", think_2: "📚", think_3: "🧪", think_4: "⚗️", think_5: "🏫", think_6: "🔭",
  mgmt_1: "🕰️", mgmt_2: "📋", mgmt_3: "🎯", mgmt_4: "🚩", mgmt_5: "🧱", mgmt_6: "🏰",
  ai_1: "💎", ai_2: "🔮", ai_3: "🛸", ai_4: "⚡", ai_5: "🤖", ai_6: "🛰️",
};
// ノード周りの小道具（立ち寄る場所感）
const PROPS: Record<string, string[]> = {
  comm: ["🌷", "🪵", "🌼", "🧺", "🐓", "🌸"], sales: ["🪧", "🛒", "🏮", "📦", "🪙", "🚩"],
  think: ["🔥", "🪨", "🍄", "📖", "🦉", "🕯️"], mgmt: ["🪨", "🛡️", "⚔️", "🪧", "🏺", "👑"], ai: ["✨", "🔷", "💫", "🔹", "🧿", "✨"],
};

function Tree({ x, y, c = "#4caf50", s = 1 }: { x: string | number; y: string | number; c?: string; s?: number }) {
  return (<div style={{ position: "absolute", left: x, top: y, width: 30 * s, height: 38 * s, filter: "drop-shadow(0 3px 3px rgba(0,0,0,.22))" }}>
    <div style={{ position: "absolute", bottom: 0, left: 12 * s, width: 6 * s, height: 14 * s, background: "#8a5a2b", borderRadius: 2 }} />
    <div style={{ position: "absolute", bottom: 10 * s, left: 0, width: 30 * s, height: 28 * s, borderRadius: "50% 50% 45% 45%", background: c, boxShadow: "inset -5px -6px 0 rgba(0,0,0,.14)" }} />
  </div>);
}
function House({ x, y, roof = "#ef4444", w = 36 }: { x: string | number; y: string | number; roof?: string; w?: number }) {
  return (<div style={{ position: "absolute", left: x, top: y, width: w, height: w * 0.8, filter: "drop-shadow(0 4px 4px rgba(0,0,0,.2))" }}>
    <div style={{ position: "absolute", left: -4, top: 0, width: w + 8, height: w * 0.4, background: roof, clipPath: "polygon(0 100%,50% 0,100% 100%)" }} />
    <div style={{ position: "absolute", left: 0, top: w * 0.38, width: w, height: w * 0.42, background: "#fff7e6", borderRadius: "0 0 3px 3px" }}>
      <div style={{ position: "absolute", left: "40%", bottom: 0, width: "20%", height: "60%", background: "#8a5a2b", borderRadius: "3px 3px 0 0" }} />
      <div style={{ position: "absolute", left: "10%", top: "20%", width: "18%", height: "30%", background: "#bfe6ff" }} />
    </div>
  </div>);
}

export type Walk = { key: number; from: Pt; to: Pt };
export default function SkillWorld({ res, avatarId, selectedId, onSelect, focusTo, focus, locNodeId, walk, onWalkEnd }: {
  res: EvalResult; avatarId: string | null; selectedId: string | null; onSelect: (n: NodeState | null) => void; focusTo?: { key: number; target: Pt };
  focus: Focus; locNodeId: string | null; walk: Walk | null; onWalkEnd?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState<Cam>({ x: 0, y: 0, s: 1 });
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  const pinch = useRef<{ d: number; s: number } | null>(null);
  const [vp, setVp] = useState({ w: 1200, h: 800 });

  const byId = new Map(res.nodes.map((n) => [n.id, n]));
  const unlockedByCat: Record<string, number> = {};
  res.nodes.forEach((n) => { if (n.status === "unlocked") unlockedByCat[n.category] = (unlockedByCat[n.category] ?? 0) + 1; });

  const homePos: Pt = locNodeId && NODE_POS[locNodeId] ? NODE_POS[locNodeId] : START;
  // 歩行：world座標上で2次ベジェを補間（パン・ズームの影響を受けない）
  const [avatarAt, setAvatarAt] = useState<Pt>(homePos);
  const [walking, setWalking] = useState(false);
  useEffect(() => { if (!walking) setAvatarAt(homePos); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homePos.x, homePos.y]);
  useEffect(() => {
    if (!walk) return;
    const a = walk.from, b = walk.to, c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 30 };
    const dur = 1600; const t0 = performance.now(); setWalking(true); let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur); const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setAvatarAt({ x: (1 - e) * (1 - e) * a.x + 2 * (1 - e) * e * c.x + e * e * b.x, y: (1 - e) * (1 - e) * a.y + 2 * (1 - e) * e * c.y + e * e * b.y });
      if (t < 1) raf = requestAnimationFrame(step); else { setWalking(false); onWalkEnd?.(); }
    };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk?.key]);
  const currentNode = focus.current ? res.nodes.find((n) => n.id === focus.current) ?? null : null;
  const nextBest = currentNode ?? res.nodes.filter((n) => n.status === "available").sort((a, b) => b.progress - a.progress)[0];
  const nextPos = nextBest ? NODE_POS[nextBest.id] : null;
  const bubble = nextBest ? (questText(pickQuestCond(nextBest)) || `次は「${nextBest.name}」`) : "";

  function clamp(c: Cam): Cam { const minX = vp.w - WORLD_W * c.s, minY = vp.h - WORLD_H * c.s; return { s: c.s, x: Math.min(0, Math.max(minX, c.x)), y: Math.min(0, Math.max(minY, c.y)) }; }
  function centerOn(p: Pt, s?: number) { const sc = s ?? cam.s; setCam(clamp({ s: sc, x: vp.w / 2 - p.x * sc, y: vp.h / 2 - p.y * sc })); }

  useEffect(() => { const el = wrapRef.current; if (!el) return; const ro = new ResizeObserver(() => setVp({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el); setVp({ w: el.clientWidth, h: el.clientHeight }); return () => ro.disconnect(); }, []);
  useEffect(() => { // 初期構図：アバターと次の目的地の間
    const s = vp.w < 640 ? 1.15 : Math.min(1.35, Math.max(1.0, vp.w / 1300));
    const t = nextPos ? { x: homePos.x * 0.6 + nextPos.x * 0.4, y: homePos.y * 0.6 + nextPos.y * 0.4 } : homePos;
    setCam(clamp({ s, x: vp.w / 2 - t.x * s, y: vp.h / 2 - t.y * s + 40 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp.w, vp.h]);
  useEffect(() => { if (focusTo) centerOn(focusTo.target); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTo?.key]);

  function onPointerDown(e: React.PointerEvent) { if (pinch.current) return; drag.current = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }
  function onPointerMove(e: React.PointerEvent) { if (!drag.current) return; const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true; setCam(clamp({ s: cam.s, x: drag.current.cx + dx, y: drag.current.cy + dy })); }
  function onPointerUp() { setTimeout(() => { drag.current = null; }, 0); }
  function zoomAt(ns: number, mx: number, my: number) { const wx = (mx - cam.x) / cam.s, wy = (my - cam.y) / cam.s; setCam(clamp({ s: ns, x: mx - wx * ns, y: my - wy * ns })); }
  function onWheel(e: React.WheelEvent) { const ns = Math.min(2.2, Math.max(0.5, cam.s * (e.deltaY > 0 ? 0.9 : 1.1))); const r = wrapRef.current!.getBoundingClientRect(); zoomAt(ns, e.clientX - r.left, e.clientY - r.top); }
  function onTouchStart(e: React.TouchEvent) { if (e.touches.length === 2) { pinch.current = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), s: cam.s }; drag.current = null; } }
  function onTouchMove(e: React.TouchEvent) { if (e.touches.length === 2 && pinch.current) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); const ns = Math.min(2.2, Math.max(0.5, pinch.current.s * (d / pinch.current.d))); const r = wrapRef.current!.getBoundingClientRect(); zoomAt(ns, (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top); } }
  function onTouchEnd(e: React.TouchEvent) { if (e.touches.length < 2) pinch.current = null; }
  function clickNode(n: NodeState) { if (drag.current?.moved) return; onSelect(n); }

  // ---------- 道 ----------
  const roadEls: React.ReactNode[] = [];
  ["comm", "sales", "think", "mgmt", "ai"].forEach((c) => {
    const ns = res.nodes.filter((n) => n.category === c).sort((a, b) => a.order_no - b.order_no);
    for (let i = 0; i < ns.length - 1; i++) {
      const a = NODE_POS[ns[i].id], b = NODE_POS[ns[i + 1].id]; if (!a || !b) continue;
      const lit = ns[i].status === "unlocked"; const explored = (unlockedByCat[c] ?? 0) > 0 || i < 1;
      const isAi = c === "ai";
      roadEls.push(<path key={`m${ns[i].id}`} d={curve(a, b)} fill="none" stroke={lit ? "#fde68a" : isAi ? "#e9d5ff" : "#f5efe0"} strokeWidth={lit ? 15 : isAi ? 6 : 12} strokeLinecap="round" strokeDasharray={isAi && !lit ? "14 10" : undefined} opacity={lit ? 0.95 : explored ? 0.85 : 0.4} style={lit ? { filter: "drop-shadow(0 0 8px rgba(251,191,36,.9))" } : undefined} />);
      if (!isAi) roadEls.push(<path key={`md${ns[i].id}`} d={curve(a, b)} fill="none" stroke={lit ? "#f59e0b" : "#c9b89a"} strokeWidth={3} strokeDasharray="10 12" strokeLinecap="round" opacity={explored ? 0.8 : 0.3} />);
    }
  });
  ROADS.forEach((r, i) => {
    const a = pt(r.from), b = pt(r.to); const lit = r.from === "START" || byId.get(r.from)?.status === "unlocked";
    roadEls.push(<path key={`l${i}`} d={curve(a, b, r.via)} fill="none" stroke="#f5efe0" strokeWidth={9} strokeLinecap="round" opacity={0.6} />);
    roadEls.push(<path key={`ld${i}`} d={curve(a, b, r.via)} fill="none" stroke={lit ? "#f59e0b" : "#c9b89a"} strokeWidth={3} strokeDasharray="6 14" strokeLinecap="round" opacity={0.7} />);
  });
  res.jobs.forEach((j) => {
    const jp = JOB_POS[j.id]; if (!jp) return;
    j.requires.forEach((rid) => { const a = NODE_POS[rid]; if (!a) return; const lit = byId.get(rid)?.status === "unlocked";
      roadEls.push(<path key={`j${j.id}${rid}`} d={curve(a, jp)} fill="none" stroke={lit ? "#fbbf24" : "#fde68a"} strokeWidth={lit ? 5 : 2.5} strokeDasharray={lit ? undefined : "4 10"} strokeLinecap="round" opacity={lit ? 0.95 : j.is_obtainable ? 0.5 : 0.25} style={lit ? { filter: "drop-shadow(0 0 6px rgba(251,191,36,.9))" } : undefined} />); });
  });

  const sky = "linear-gradient(180deg,#7cc8ff 0%,#b5e2ff 45%,#e8f7ff 100%)";
  const aiArea = AREAS.find((a) => a.key === "ai")!;

  return (
    <div ref={wrapRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      style={{ position: "absolute", inset: 0, overflow: "hidden", cursor: drag.current ? "grabbing" : "grab", touchAction: "none", background: sky, userSelect: "none", fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif' }}>

      {/* 遠景（パララックス） */}
      <div style={{ position: "absolute", left: 0, top: 0, width: WORLD_W, height: WORLD_H, transform: `translate(${cam.x * 0.35}px,${cam.y * 0.35}px)`, pointerEvents: "none" }}>
        {[{ x: 1250, w: 760, h: 280, c: "#b9d6ec" }, { x: 1650, w: 560, h: 360, c: "#a9c9e4" }, { x: -120, w: 620, h: 210, c: "#bfdaee" }, { x: 650, w: 520, h: 180, c: "#c6def0" }].map((m, i) => (
          <div key={i} style={{ position: "absolute", left: m.x, top: 430 - m.h, width: m.w, height: m.h, background: m.c, clipPath: "polygon(0 100%, 18% 35%, 30% 55%, 48% 0, 62% 40%, 78% 20%, 100% 100%)", opacity: 0.8 }} />
        ))}
        {[{ x: 1500, y: 60, w: 240 }, { x: 40, y: 560, w: 170 }, { x: 1720, y: 1250, w: 200 }, { x: 600, y: 1320, w: 160 }].map((f, i) => (
          <div key={i} style={{ position: "absolute", left: f.x, top: f.y, width: f.w, height: f.w * 0.4, animation: `swFloat ${6 + i}s ease-in-out infinite alternate`, opacity: 0.75 }}>
            <div style={{ position: "absolute", left: "8%", right: "8%", top: "40%", bottom: -6, borderRadius: "10% 10% 50% 50% / 20% 20% 100% 100%", background: "linear-gradient(180deg,#a89a8a,#6b5a4a)" }} />
            <div style={{ position: "absolute", inset: "0 0 45% 0", borderRadius: "50%", background: "radial-gradient(ellipse at 50% 40%, #cfeeb5, #8ecb8c)" }} />
            <div style={{ position: "absolute", left: "30%", top: "-20%", fontSize: f.w * 0.18 }}>🌳</div>
          </div>
        ))}
        <div style={{ position: "absolute", left: 520, top: 90, fontSize: 48, animation: "swBalloon 14s ease-in-out infinite alternate", filter: "drop-shadow(0 6px 6px rgba(0,0,0,.15))" }}>🎈</div>
        {[0, 1].map((i) => <div key={i} style={{ position: "absolute", left: 0, top: 140 + i * 300, fontSize: 16, animation: `swBird ${45 + i * 15}s linear infinite`, animationDelay: `${-i * 12}s`, opacity: 0.8 }}>🕊️</div>)}
      </div>
      {[0, 1].map((i) => (<div key={i} style={{ position: "absolute", top: `${10 + i * 40}%`, left: 0, width: 160, height: 44, background: "rgba(255,255,255,.8)", borderRadius: 999, filter: "blur(2px)", animation: `swCloud ${90 + i * 30}s linear infinite`, animationDelay: `${-i * 30}s`, pointerEvents: "none", boxShadow: "36px -16px 0 -4px rgba(255,255,255,.75), 74px 0 0 -2px rgba(255,255,255,.8)", opacity: 0.5, zIndex: 0 }} />))}

      {/* ===== ワールド ===== */}
      <div style={{ position: "absolute", left: 0, top: 0, width: WORLD_W, height: WORLD_H, transform: `translate(${cam.x}px,${cam.y}px) scale(${cam.s})`, transformOrigin: "0 0", willChange: "transform", zIndex: 1 }}>

        {/* 川 */}
        <svg width={WORLD_W} height={WORLD_H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
          <path d="M 860 780 C 900 900, 1060 940, 1120 1000 C 1160 1050, 1140 1120, 1145 1180" fill="none" stroke="#9ed7f7" strokeWidth={26} strokeLinecap="round" opacity={0.9} />
          <path d="M 860 780 C 900 900, 1060 940, 1120 1000 C 1160 1050, 1140 1120, 1145 1180" fill="none" stroke="#dff4ff" strokeWidth={6} strokeDasharray="30 40" strokeLinecap="round" opacity={0.9} style={{ animation: "swFlow 3s linear infinite" }} />
          <path d="M 300 1000 C 420 980, 560 1010, 700 985" fill="none" stroke="#9ed7f7" strokeWidth={14} strokeLinecap="round" opacity={0.85} />
        </svg>

        {/* START 小島 */}
        <div style={{ position: "absolute", left: START.x - 110, top: START.y - 60, width: 220, height: 130 }}>
          <div style={{ position: "absolute", left: "8%", right: "8%", bottom: -18, height: 60, borderRadius: "10% 10% 50% 50% / 20% 20% 100% 100%", background: "linear-gradient(180deg,#8a6a48,#4a3626)" }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: "50% 50% 46% 54% / 60% 60% 40% 40%", background: "radial-gradient(ellipse at 45% 40%, #c8f5a6, #7fcf7b 70%)", boxShadow: "inset 0 6px 10px rgba(255,255,255,.5)" }} />
          <div style={{ position: "absolute", left: 150, top: 84, width: 70, height: 10, background: "repeating-linear-gradient(90deg,#c48a4b 0 8px,#a8713a 8px 10px)", borderRadius: 3, transform: "rotate(8deg)" }} />
          <div style={{ position: "absolute", left: 212, top: 78, fontSize: 24 }}>⛵</div>
          <Tree x={14} y={10} c="#7ccf6a" /><Tree x={160} y={6} c="#f9a8d4" s={0.9} />
        </div>

        {/* エリア地形 */}
        {AREAS.map((a) => {
          const explored = (unlockedByCat[a.key] ?? 0) > 0;
          const col = AREA_COLOR[a.key];
          const dim: React.CSSProperties = explored ? {} : { filter: "saturate(.55) brightness(1.06)", opacity: 0.8 };
          if (a.key === "ai") return (
            <div key={a.key} style={{ position: "absolute", left: 0, top: 0, ...dim }}>
              {res.nodes.filter((n) => n.category === "ai").map((n, i) => { const p = NODE_POS[n.id]; const w = n.kind === "key" ? 170 : 140;
                return (<div key={n.id} style={{ position: "absolute", left: p.x - w / 2, top: p.y - 30, width: w, height: 70, animation: `swFloat ${4 + i * 0.7}s ease-in-out infinite alternate` }}>
                  <div style={{ position: "absolute", left: "12%", right: "12%", bottom: -22, height: 50, borderRadius: "10% 10% 50% 50% / 20% 20% 100% 100%", background: "linear-gradient(180deg,#8b7fc4,#4c3f8a)" }} />
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse at 50% 40%, #f3f0ff, #c4b5fd 60%, #a5b4fc)", boxShadow: "inset 0 5px 8px rgba(255,255,255,.7), 0 0 24px rgba(167,139,250,.5)" }} />
                  <div style={{ position: "absolute", left: 10, top: -14, width: 14, height: 24, background: "linear-gradient(180deg,#f5f3ff,#a78bfa)", clipPath: "polygon(50% 0,100% 30%,80% 100%,20% 100%,0 30%)", boxShadow: "0 0 10px #c4b5fd" }} />
                  <div style={{ position: "absolute", right: 14, top: 36, width: 6, height: 6, borderRadius: "50%", background: "#67e8f9", boxShadow: "0 0 10px #22d3ee", animation: "swTwinkle 1.4s ease-in-out infinite alternate" }} />
                </div>); })}
              <div style={{ position: "absolute", left: a.sign.x, top: a.sign.y - 60, padding: "5px 14px", borderRadius: 12, background: "linear-gradient(180deg,#fff,#f5f3ff)", border: `2px solid ${col}`, fontSize: 12, fontWeight: 900, letterSpacing: 1, color: col, boxShadow: "0 4px 10px rgba(0,0,0,.15)", whiteSpace: "nowrap" }}>{a.emoji} {a.label}</div>
            </div>
          );
          if (a.key === "mgmt") return (
            <div key={a.key} style={{ position: "absolute", left: a.x, top: a.y, width: a.w, height: a.h, ...dim }}>
              <div style={{ position: "absolute", left: "6%", right: "6%", bottom: -26, height: 100, borderRadius: "10% 10% 50% 50% / 20% 20% 100% 100%", background: "linear-gradient(180deg,#7a6a58,#4a3626)", boxShadow: "0 24px 30px rgba(50,70,110,.3)" }} />
              {[0, 1, 2].map((i) => (<div key={i} style={{ position: "absolute", left: `${i * 26}%`, right: 0, top: `${44 - i * 22}%`, bottom: 0, borderRadius: "40% 40% 50% 50% / 60% 60% 40% 40%", background: i === 2 ? "radial-gradient(ellipse at 50% 40%, #e8f5d8, #a6cf95)" : i === 1 ? "radial-gradient(ellipse at 50% 40%, #d7efc3, #8fc287)" : "radial-gradient(ellipse at 50% 40%, #c5e8ad, #7bb47a)", boxShadow: "inset 0 6px 10px rgba(255,255,255,.5), 0 10px 14px rgba(40,80,40,.25)" }}>
                {i < 2 && <div style={{ position: "absolute", left: "22%", top: "-6px", width: 60, height: 40, background: "repeating-linear-gradient(180deg,#e5e7eb 0 8px,#cbd5e1 8px 10px)", borderRadius: 4, transform: "skewX(-12deg)", opacity: 0.9 }} />}
              </div>))}
              <div style={{ position: "absolute", left: "48%", right: "4%", top: "8%", height: 16, background: "repeating-linear-gradient(90deg,#f3f4f6 0 14px,transparent 14px 22px)", borderBottom: "8px solid #d1d5db", boxShadow: "0 4px 6px rgba(0,0,0,.15)" }} />
              {[0, 1, 2].map((i) => <div key={"t" + i} style={{ position: "absolute", left: `${50 + i * 22}%`, top: "-10%", width: 24, height: 50, background: "linear-gradient(90deg,#f8fafc,#cbd5e1)", borderRadius: "4px 4px 0 0", boxShadow: "0 4px 8px rgba(0,0,0,.15)" }}><div style={{ position: "absolute", left: 2, top: -12, width: 20, height: 14, background: "#fbbf24", clipPath: "polygon(0 100%,50% 0,100% 100%)" }} /><div style={{ position: "absolute", left: 24, top: -10, width: 14, height: 9, background: "#ef4444", clipPath: "polygon(0 0,100% 50%,0 100%)", animation: "swFlag 1s ease-in-out infinite alternate" }} /></div>)}
              <Tree x="8%" y="60%" c="#5aa66b" /><Tree x="30%" y="40%" c="#6fb66b" /><Tree x="14%" y="78%" c="#5aa66b" s={0.8} />
              <div style={{ position: "absolute", left: 28, top: -14, padding: "5px 14px", borderRadius: 12, background: "linear-gradient(180deg,#fff,#fdf6e3)", border: `2px solid ${col}`, fontSize: 12, fontWeight: 900, letterSpacing: 1, color: col, boxShadow: "0 4px 10px rgba(0,0,0,.15)", whiteSpace: "nowrap" }}>{a.emoji} {a.label}</div>
            </div>
          );
          return (
            <div key={a.key} style={{ position: "absolute", left: a.x, top: a.y, width: a.w, height: a.h, ...dim }}>
              <div style={{ position: "absolute", left: "6%", right: "6%", bottom: -26, height: 90, borderRadius: "10% 10% 50% 50% / 20% 20% 100% 100%", background: `linear-gradient(180deg, ${a.side}, #4a3626)`, boxShadow: "0 24px 30px rgba(50,70,110,.3)" }} />
              {a.key === "think" && <div style={{ position: "absolute", left: "56%", bottom: -58, width: 26, height: 70, background: "linear-gradient(180deg,#bfe6ff,#e8f7ff)", borderRadius: "0 0 10px 10px", opacity: 0.9, boxShadow: "0 0 10px #fff" }} />}
              {/* 地面（2枚重ねで有機的に） */}
              <div style={{ position: "absolute", inset: 0, borderRadius: a.radius, background: a.top, boxShadow: "inset 0 6px 10px rgba(255,255,255,.5), inset 0 -16px 22px rgba(40,80,40,.25)" }} />
              <div style={{ position: "absolute", left: "18%", right: "22%", top: -26, height: "60%", borderRadius: "50% 50% 40% 60% / 70% 60% 40% 30%", background: a.top, boxShadow: "inset 0 6px 10px rgba(255,255,255,.4)" }} />
              {a.key === "sales" && <div style={{ position: "absolute", inset: "6% 4% 10% 4%", borderRadius: "48% 52% 50% 50% / 60% 55% 45% 40%", background: "radial-gradient(circle, #e2d3b0 2px, transparent 3px) 0 0/14px 14px, #efe3cb", opacity: 0.95 }} />}
              {a.key === "sales" && <div style={{ position: "absolute", left: "40%", top: "34%", width: 150, height: 70, borderRadius: "50%", background: "radial-gradient(circle, #f3e6c8, #e2d3b0)", border: "4px solid #d6c39a" }} />}
              {a.key === "sales" && [0, 1, 2, 3, 4, 5, 6].map((i) => <House key={"h" + i} x={`${6 + i * 13.5}%`} y={i % 2 ? "4%" : "12%"} roof={["#ef4444", "#f97316", "#dc2626", "#fb923c", "#ef4444", "#f59e0b", "#dc2626"][i]} w={i % 3 === 0 ? 42 : 34} />)}
              {a.key === "sales" && [0, 1, 2].map((i) => <div key={"fl" + i} style={{ position: "absolute", left: `${28 + i * 24}%`, top: "28%", width: 3, height: 30, background: "#8a5a2b" }}><div style={{ position: "absolute", left: 3, top: 0, width: 16, height: 10, background: i % 2 ? "#ef4444" : "#fbbf24", clipPath: "polygon(0 0,100% 50%,0 100%)", animation: "swFlag 1s ease-in-out infinite alternate" }} /></div>)}
              {a.key === "sales" && <div style={{ position: "absolute", left: "22%", top: "62%", fontSize: 22 }}>🏮</div>}
              {a.key === "sales" && <div style={{ position: "absolute", left: "70%", top: "60%", fontSize: 22 }}>🛒</div>}
              {a.key === "comm" && <>
                <div style={{ position: "absolute", left: "8%", right: "8%", bottom: "14%", height: 8, background: "repeating-linear-gradient(90deg,#c48a4b 0 4px,transparent 4px 18px)", borderTop: "3px solid #c48a4b", opacity: 0.85 }} />
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => <div key={"f" + i} style={{ position: "absolute", left: `${3 + i * 8}%`, top: `${26 + (i % 3) * 22}%`, fontSize: 13 }}>{["🌷", "🌼", "🌸", "🌻"][i % 4]}</div>)}
                <House x="26%" y="8%" roof="#f97316" w={34} /><House x="62%" y="10%" roof="#f59e0b" w={30} />
                <Tree x="4%" y="4%" c="#f9a8d4" /><Tree x="44%" y="56%" c="#7ccf6a" /><Tree x="86%" y="6%" c="#f9a8d4" /><Tree x="70%" y="58%" c="#7ccf6a" s={0.8} />
                <div style={{ position: "absolute", left: "52%", top: "22%", fontSize: 16, animation: "swFloat 2s ease-in-out infinite alternate" }}>🦋</div>
              </>}
              {a.key === "think" && <>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Tree key={"t" + i} x={`${2 + (i % 5) * 9}%`} y={`${8 + Math.floor(i / 5) * 46 + (i % 2) * 14}%`} c={i % 2 ? "#3f9a5a" : "#56b36a"} s={i % 3 === 0 ? 1.2 : 0.95} />)}
                <div style={{ position: "absolute", left: "48%", top: "22%", width: 210, height: 92, borderRadius: "50%", background: "radial-gradient(ellipse at 50% 40%, #cdebff, #5fb0f0)", boxShadow: "inset 0 4px 8px rgba(255,255,255,.7), 0 0 0 6px rgba(255,255,255,.25)" }}>
                  <div style={{ position: "absolute", left: "28%", top: "40%", width: 90, height: 10, background: "repeating-linear-gradient(90deg,#c48a4b 0 6px,#a8713a 6px 8px)", borderRadius: 4 }} />
                  <div style={{ position: "absolute", left: "70%", top: "20%", fontSize: 14 }}>🦆</div>
                </div>
                <Tree x="78%" y="8%" c="#3f9a5a" /><Tree x="90%" y="52%" c="#56b36a" />
                <div style={{ position: "absolute", left: "30%", top: "62%", fontSize: 18 }}>🍄</div>
              </>}
              <div style={{ position: "absolute", left: 28, top: -14, padding: "5px 14px", borderRadius: 12, background: "linear-gradient(180deg,#fff,#fdf6e3)", border: `2px solid ${col}`, fontSize: 12, fontWeight: 900, letterSpacing: 1, color: col, boxShadow: "0 4px 10px rgba(0,0,0,.15)", whiteSpace: "nowrap" }}>{a.emoji} {a.label}</div>
              {!explored && <div style={{ position: "absolute", left: "45%", right: "-6%", top: "-20%", bottom: "-20%", borderRadius: "50%", background: "radial-gradient(ellipse at 60% 50%, rgba(255,255,255,.6), rgba(255,255,255,0) 70%)", filter: "blur(14px)", pointerEvents: "none" }} />}
            </div>
          );
        })}

        {/* 道 */}
        <svg width={WORLD_W} height={WORLD_H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
          {roadEls}
          {nextPos && currentNode && <path d={curve(homePos, nextPos)} fill="none" stroke="#fbbf24" strokeWidth={12} strokeLinecap="round" opacity={0.55} style={{ filter: "drop-shadow(0 0 10px rgba(251,191,36,.9))" }} />}
          {nextPos && <path d={curve(homePos, nextPos)} fill="none" stroke="#fff" strokeWidth={4} strokeDasharray="2 14" strokeLinecap="round" opacity={0.95} style={{ animation: "swSteps 1.2s linear infinite", filter: "drop-shadow(0 0 4px rgba(251,191,36,.9))" }} />}
        </svg>

        {/* START 村 */}
        <div style={{ position: "absolute", left: START.x - 70, top: START.y - 80, width: 140, textAlign: "center", zIndex: 8 }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 4 }}>
            <div style={{ fontSize: 30, filter: "drop-shadow(0 4px 4px rgba(0,0,0,.2))" }}>🪧</div>
            <div style={{ fontSize: 54, lineHeight: 1, filter: "drop-shadow(0 5px 5px rgba(0,0,0,.22))" }}>🏡</div>
          </div>
          <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 10, background: "linear-gradient(180deg,#fff,#fdf6e3)", border: "2px solid #16a34a", fontSize: 12, fontWeight: 900, color: "#166534", boxShadow: "0 2px 6px rgba(0,0,0,.15)" }}>🌱 START</div>
          <div style={{ fontSize: 10, color: "#166534", fontWeight: 800, marginTop: 2, textShadow: "0 0 4px #fff" }}>冒険のはじまり</div>
        </div>

        {/* スキルノード */}
        {res.nodes.map((n) => {
          const p = NODE_POS[n.id]; if (!p) return null;
          const color = AREA_COLOR[n.category];
          const explored = (unlockedByCat[n.category] ?? 0) > 0 || n.order_no <= 2;
          const fog = (n.is_hidden && n.status === "locked") || (!explored && n.status === "locked");
          const u = n.status === "unlocked", a = n.status === "available";
          const key = n.kind === "key"; const lm = key ? 66 : 42; const w = key ? 120 : 90; const sel = selectedId === n.id;
          const props = PROPS[n.category] ?? [];
          const isCur = focus.current === n.id, isSub = focus.subs.includes(n.id);
          return (
            <div key={n.id} onClick={() => clickNode(n)} style={{ position: "absolute", left: p.x - w / 2, top: p.y - lm - 22, width: w, cursor: "pointer", zIndex: sel ? 20 : isCur ? 12 : 10, transition: "transform .2s", transform: sel ? "scale(1.12)" : "none", textAlign: "center" }}>
              {isCur && <div style={{ position: "absolute", left: "50%", top: "40%", width: w + 60, height: w + 60, marginLeft: -(w + 60) / 2, marginTop: -(w + 60) / 2, borderRadius: "50%", background: "radial-gradient(circle, rgba(251,191,36,.35), rgba(251,191,36,0) 65%)", pointerEvents: "none" }} />}
              {isCur && <div style={{ position: "absolute", left: "50%", top: "40%", width: w + 14, height: w + 14, marginLeft: -(w + 14) / 2, marginTop: -(w + 14) / 2, borderRadius: "50%", border: "4px dashed #fbbf24", animation: "swSpin 8s linear infinite", pointerEvents: "none", boxShadow: "0 0 16px rgba(251,191,36,.7)" }} />}
              {(isCur || isSub) && <div style={{ position: "absolute", top: -34, left: "50%", transform: "translateX(-50%)", fontSize: isCur ? 26 : 18, zIndex: 3, animation: "swBounce 1.4s ease-in-out infinite", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.3))" }}>🎯</div>}
              {isCur && <div style={{ position: "absolute", top: -52, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 900, letterSpacing: 1, color: "#92400e", background: "#fde68a", borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap", zIndex: 3 }}>CURRENT QUEST</div>}
              {!fog && <div style={{ position: "absolute", left: -14, bottom: 18, fontSize: 16, opacity: 0.9 }}>{props[(n.order_no - 1) % props.length]}</div>}
              {!fog && !key && <div style={{ position: "absolute", right: -12, bottom: 30, fontSize: 13, opacity: 0.85 }}>{props[(n.order_no + 2) % props.length]}</div>}
              {a && !fog && <div style={{ position: "absolute", top: -22, left: "50%", transform: "translateX(-50%)", fontSize: 20, fontWeight: 900, color: "#ef4444", animation: "swBounce 1s ease-in-out infinite", textShadow: "0 0 6px #fff, 0 0 2px #fff" }}>！</div>}
              {u && <div style={{ position: "absolute", top: -8, right: 6, fontSize: 18, zIndex: 2, animation: "swFlag 1s ease-in-out infinite alternate" }}>🚩</div>}
              <div style={{ position: "absolute", left: "10%", right: "10%", bottom: 16, height: key ? 30 : 22, borderRadius: "50%", background: u ? `radial-gradient(ellipse, ${color}aa, ${color}22)` : a ? `radial-gradient(ellipse, ${color}66, transparent 70%)` : "rgba(60,60,80,.18)", filter: "blur(2px)", animation: a && !fog ? "swPulse 2s ease-in-out infinite" : undefined }} />
              <div style={{ position: "relative", fontSize: lm, lineHeight: 1, display: "inline-block", filter: fog ? "grayscale(1) brightness(.4) opacity(.35) blur(1px)" : u ? `drop-shadow(0 0 14px ${color}) drop-shadow(0 6px 5px rgba(0,0,0,.25))` : a ? "drop-shadow(0 6px 5px rgba(0,0,0,.25))" : "saturate(.25) opacity(.75) drop-shadow(0 4px 4px rgba(0,0,0,.2))" }}>
                {LANDMARK[n.id] ?? n.icon}
                {!fog && <span style={{ position: "absolute", right: -10, bottom: -4, width: 22, height: 22, borderRadius: 11, background: u ? color : "#fff", border: `2px solid ${u ? "#fff" : color}`, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 5px rgba(0,0,0,.2)" }}>{n.icon}</span>}
              </div>
              <div style={{ marginTop: 2, whiteSpace: "nowrap" }}>
                <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 9, background: u ? color : fog ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.94)", color: u ? "#fff" : fog ? "#94a3b8" : "#1e293b", fontSize: key ? 12.5 : 11.5, fontWeight: 900, boxShadow: "0 2px 6px rgba(0,0,0,.18)", border: key && !u ? `2px solid ${color}` : "none" }}>{fog ? "？？？" : n.name}</span>
              </div>
              {u && [0, 1, 2].map((i) => <div key={i} style={{ position: "absolute", left: 10 + i * 30, top: 4 + (i % 2) * 14, width: 6, height: 6, borderRadius: "50%", background: "#fff", boxShadow: `0 0 8px ${color}`, animation: `swTwinkle ${1.2 + i * 0.4}s ease-in-out infinite alternate` }} />)}
            </div>
          );
        })}

        {/* JOB 巨大ランドマーク */}
        {res.jobs.map((j: JobState) => {
          const p = JOB_POS[j.id]; if (!p) return null;
          const haze = !j.is_obtainable && !j.unlocked;
          const done = j.requires.length - j.missing.length; const ratio = j.requires.length ? done / j.requires.length : 0;
          const label = (<div style={{ textAlign: "center", position: "relative", zIndex: 2 }}>
            <div style={{ display: "inline-block", padding: "7px 20px", borderRadius: 14, background: j.unlocked ? "linear-gradient(135deg,#fbbf24,#f59e0b)" : "linear-gradient(180deg,#fff,#fdf6e3)", border: "3px solid #fbbf24", color: j.unlocked ? "#fff" : "#92400e", fontSize: 17, fontWeight: 900, letterSpacing: 2, boxShadow: "0 4px 14px rgba(0,0,0,.18)" }}>{haze ? "？？？" : `${j.icon} ${j.name}`}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", marginTop: 4, textShadow: "0 0 4px #fff" }}>{j.unlocked ? "👑 到達！" : haze ? "山頂に巨大な城が見える…" : `${done} / ${j.requires.length} skills`}</div>
          </div>);
          if (j.id === "mentor") return (
            <div key={j.id} style={{ position: "absolute", left: p.x - 140, top: p.y - 200, width: 280, zIndex: 9 }}>
              <div style={{ position: "absolute", left: "10%", right: "10%", bottom: 36, height: 40, borderRadius: "50%", background: j.unlocked ? "rgba(251,191,36,.6)" : "rgba(60,60,80,.25)", filter: "blur(12px)" }} />
              <div style={{ position: "relative", height: 170, filter: j.unlocked ? "drop-shadow(0 0 28px #fbbf24)" : "drop-shadow(0 10px 10px rgba(0,0,0,.25))" }}>
                <div style={{ position: "absolute", left: 20, right: 20, bottom: 0, height: 100, background: "linear-gradient(180deg,#fff7e6,#f3d9a4)", borderRadius: "6px 6px 4px 4px", border: "3px solid #b9834a" }}>
                  {[0, 1, 2, 3].map((i) => <div key={i} style={{ position: "absolute", left: 18 + i * 54, top: 18, width: 22, height: 30, background: "#bfe6ff", border: "3px solid #b9834a", borderRadius: "11px 11px 2px 2px" }} />)}
                  <div style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)", width: 54, height: 56, background: "#8a5a2b", borderRadius: "27px 27px 0 0", border: "3px solid #6b4423" }} />
                </div>
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 96, height: 60, background: "linear-gradient(180deg,#ef4444,#b91c1c)", clipPath: "polygon(0 100%,50% 0,100% 100%)" }} />
                <div style={{ position: "absolute", left: "50%", bottom: 150, transform: "translateX(-50%)", width: 4, height: 34, background: "#6b4423" }} />
                <div style={{ position: "absolute", left: "50%", bottom: 166, width: 28, height: 16, background: "#fbbf24", clipPath: "polygon(0 0,100% 50%,0 100%)", animation: "swFlag 1s ease-in-out infinite alternate" }} />
                <div style={{ position: "absolute", left: "50%", bottom: 62, transform: "translateX(-50%)", fontSize: 30 }}>🧭</div>
              </div>
              {label}
            </div>
          );
          if (j.id === "closer") return (
            <div key={j.id} style={{ position: "absolute", left: p.x - 170, top: p.y - 230, width: 340, textAlign: "center", zIndex: 9 }}>
              <div style={{ position: "absolute", left: "10%", right: "10%", bottom: 40, height: 50, borderRadius: "50%", background: j.unlocked ? "rgba(251,191,36,.6)" : "rgba(60,60,80,.25)", filter: "blur(14px)" }} />
              <div style={{ position: "relative", display: "inline-block" }}>
                <div style={{ position: "absolute", right: -30, bottom: 50, fontSize: 120, lineHeight: 1, filter: "drop-shadow(0 8px 8px rgba(0,0,0,.25))" }}>🗼</div>
                <div style={{ fontSize: 210, lineHeight: 1, position: "relative", filter: j.unlocked ? "drop-shadow(0 0 30px #fbbf24)" : "drop-shadow(0 10px 10px rgba(0,0,0,.28))" }}>🏟️</div>
                {[0, 1, 2].map((i) => <div key={i} style={{ position: "absolute", left: 40 + i * 80, top: 30, width: 4, height: 36, background: "#8a5a2b" }}><div style={{ position: "absolute", left: 4, top: 0, width: 22, height: 14, background: ["#ef4444", "#fbbf24", "#3b82f6"][i], clipPath: "polygon(0 0,100% 50%,0 100%)", animation: "swFlag 1s ease-in-out infinite alternate" }} /></div>)}
              </div>
              {label}
            </div>
          );
          return (
            <div key={j.id} style={{ position: "absolute", left: p.x - 190, top: p.y - 260, width: 380, textAlign: "center", zIndex: 9 }}>
              <div style={{ position: "absolute", left: "20%", right: "20%", bottom: 10, width: "60%", height: 220, background: "linear-gradient(180deg,#c7d9ea,#9fb8d0)", clipPath: "polygon(0 100%,25% 40%,50% 0,75% 40%,100% 100%)", opacity: 0.9 }} />
              <div style={{ position: "relative", fontSize: 230, lineHeight: 1, filter: j.unlocked ? "drop-shadow(0 0 30px #fbbf24)" : `brightness(${0.55 + ratio * 0.45}) saturate(${0.3 + ratio * 0.7}) blur(${(1 - ratio) * 1.6}px) opacity(${0.55 + ratio * 0.45})`, transition: "filter .6s" }}>🏯</div>
              {haze && [0, 1, 2].map((i) => <div key={i} style={{ position: "absolute", left: `${10 + i * 28}%`, top: `${26 + (i % 2) * 30}%`, width: 150, height: 56, borderRadius: 999, background: `rgba(255,255,255,${0.75 - ratio * 0.6})`, filter: "blur(8px)", boxShadow: "50px -14px 0 -6px rgba(255,255,255,.7)", animation: `swFloat ${5 + i}s ease-in-out infinite alternate`, pointerEvents: "none" }} />)}
              {label}
            </div>
          );
        })}

        {/* アバター（主役） */}
        <div style={{ position: "absolute", left: avatarAt.x - 75 - 80, top: avatarAt.y - 175, width: 150, zIndex: 30, pointerEvents: "none" }}>
          <div style={{ position: "absolute", left: 10, right: 10, bottom: -6, height: 44, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(251,191,36,.8), rgba(251,191,36,0) 70%)", animation: "swGlow 1.8s ease-in-out infinite alternate" }} />
          <div style={{ position: "absolute", left: 36, right: 36, bottom: 6, height: 16, borderRadius: "50%", background: "rgba(0,0,0,.24)", filter: "blur(4px)" }} />
          {bubble && (
            <div style={{ position: "absolute", bottom: 160, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", background: "#fff", borderRadius: 16, padding: "8px 14px", fontSize: 14, fontWeight: 900, color: "#1e293b", boxShadow: "0 6px 16px rgba(0,0,0,.2)", border: "2.5px solid #fde68a" }}>
              🎯 {bubble}
              <div style={{ position: "absolute", bottom: -8, left: "50%", marginLeft: -7, width: 14, height: 14, background: "#fff", transform: "rotate(45deg)", borderRight: "2.5px solid #fde68a", borderBottom: "2.5px solid #fde68a" }} />
            </div>
          )}
          <div style={{ animation: "swBob 2.2s ease-in-out infinite", position: "relative" }}>
            {avatarId ? <img src={`/avatars/${avatarId}.png`} alt="" style={{ width: 150, display: "block", filter: "drop-shadow(0 10px 10px rgba(0,0,0,.28))" }} /> : <div style={{ fontSize: 100, textAlign: "center" }}>🧑‍🚀</div>}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes swCloud{0%{transform:translateX(-30vw)}100%{transform:translateX(130vw)}}
        @keyframes swFloat{from{transform:translateY(0)}to{transform:translateY(-10px)}}
        @keyframes swBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes swBounce{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-7px)}}
        @keyframes swPulse{0%,100%{opacity:.5;transform:scale(.9)}50%{opacity:1;transform:scale(1.1)}}
        @keyframes swTwinkle{from{opacity:.2;transform:scale(.6)}to{opacity:1;transform:scale(1.2)}}
        @keyframes swGlow{from{opacity:.6;transform:scale(.9)}to{opacity:1;transform:scale(1.08)}}
        @keyframes swFlag{from{transform:skewY(-6deg)}to{transform:skewY(6deg)}}
        @keyframes swBalloon{from{transform:translate(0,0)}to{transform:translate(60px,-30px)}}
        @keyframes swBird{0%{transform:translateX(-80px)}100%{transform:translateX(2100px)}}
        @keyframes swFlow{to{stroke-dashoffset:-70}}
        @keyframes swSteps{to{stroke-dashoffset:-32}}
        @keyframes swSpin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}
