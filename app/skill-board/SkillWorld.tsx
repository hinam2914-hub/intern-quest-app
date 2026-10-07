"use client";
import { useEffect, useRef, useState } from "react";
import type { EvalResult, NodeState, JobState } from "../lib/skills";
import { WORLD_W, WORLD_H, START, NODE_POS, JOB_POS, AREAS, AREA_COLOR, ROADS, pt, curve, type Pt } from "./world";

type Cam = { x: number; y: number; s: number };

// スキルごとのランドマーク（場所として見せる）
const LANDMARK: Record<string, string> = {
  comm_1: "🏡", comm_2: "🪧", comm_3: "🛖", comm_4: "⛲", comm_5: "📬", comm_6: "🎪",
  sales_1: "🏪", sales_2: "🛖", sales_3: "⛺", sales_4: "🏬", sales_5: "🏟️", sales_6: "🗼",
  think_1: "⛺", think_2: "📚", think_3: "🧪", think_4: "⚗️", think_5: "🏫", think_6: "🔭",
  mgmt_1: "🕰️", mgmt_2: "📋", mgmt_3: "🎯", mgmt_4: "🚩", mgmt_5: "🧱", mgmt_6: "🏰",
  ai_1: "💎", ai_2: "🔮", ai_3: "🛸", ai_4: "⚡", ai_5: "🤖", ai_6: "🛰️",
};
const JOB_LM: Record<string, string> = { closer: "🏟️", mentor: "🏛️", manager: "🏯" };

export default function SkillWorld({ res, avatarId, selectedId, onSelect, focusTo }: {
  res: EvalResult; avatarId: string | null; selectedId: string | null; onSelect: (n: NodeState | null) => void; focusTo?: { key: number; target: Pt };
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState<Cam>({ x: 0, y: 0, s: 1 });
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  const pinch = useRef<{ d: number; s: number } | null>(null);
  const [vp, setVp] = useState({ w: 1200, h: 800 });

  const byId = new Map(res.nodes.map((n) => [n.id, n]));
  const unlockedByCat: Record<string, number> = {};
  res.nodes.forEach((n) => { if (n.status === "unlocked") unlockedByCat[n.category] = (unlockedByCat[n.category] ?? 0) + 1; });

  const lastUnlocked = [...res.nodes].filter((n) => n.status === "unlocked" && n.unlocked_at).sort((a, b) => (b.unlocked_at! > a.unlocked_at! ? 1 : -1))[0];
  const avatarAt: Pt = lastUnlocked ? NODE_POS[lastUnlocked.id] : START;
  const nextBest = res.nodes.filter((n) => n.status === "available").sort((a, b) => b.progress - a.progress)[0];
  const nextCond = nextBest?.conds.find((c) => !c.done);
  const nextPos = nextBest ? NODE_POS[nextBest.id] : null;

  function clamp(c: Cam): Cam {
    const minX = vp.w - WORLD_W * c.s, minY = vp.h - WORLD_H * c.s;
    return { s: c.s, x: Math.min(0, Math.max(minX, c.x)), y: Math.min(0, Math.max(minY, c.y)) };
  }
  function centerOn(p: Pt, s?: number) { const sc = s ?? cam.s; setCam(clamp({ s: sc, x: vp.w / 2 - p.x * sc, y: vp.h / 2 - p.y * sc })); }

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setVp({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el);
    setVp({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const s = vp.w < 640 ? 1.15 : Math.min(1.8, Math.max(1, vp.w / 1000));
    setCam(clamp({ s, x: vp.w / 2 - avatarAt.x * s, y: vp.h / 2 - avatarAt.y * s + 60 }));
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
      roadEls.push(<path key={`m${ns[i].id}`} d={curve(a, b)} fill="none" stroke={lit ? "#fde68a" : "#f5efe0"} strokeWidth={lit ? 15 : 12} strokeLinecap="round" opacity={lit ? 0.95 : explored ? 0.85 : 0.35} style={lit ? { filter: "drop-shadow(0 0 8px rgba(251,191,36,.9))" } : undefined} />);
      roadEls.push(<path key={`md${ns[i].id}`} d={curve(a, b)} fill="none" stroke={lit ? "#f59e0b" : "#c9b89a"} strokeWidth={3} strokeDasharray="10 12" strokeLinecap="round" opacity={explored ? 0.8 : 0.3} />);
    }
  });
  ROADS.forEach((r, i) => {
    const a = pt(r.from), b = pt(r.to); const lit = r.from === "START" || byId.get(r.from)?.status === "unlocked";
    roadEls.push(<path key={`l${i}`} d={curve(a, b, r.via)} fill="none" stroke="#f5efe0" strokeWidth={9} strokeLinecap="round" opacity={0.65} />);
    roadEls.push(<path key={`ld${i}`} d={curve(a, b, r.via)} fill="none" stroke={lit ? "#f59e0b" : "#c9b89a"} strokeWidth={3} strokeDasharray="6 14" strokeLinecap="round" opacity={0.7} />);
  });
  res.jobs.forEach((j) => {
    const jp = JOB_POS[j.id]; if (!jp) return;
    j.requires.forEach((rid) => { const a = NODE_POS[rid]; if (!a) return; const lit = byId.get(rid)?.status === "unlocked";
      roadEls.push(<path key={`j${j.id}${rid}`} d={curve(a, jp)} fill="none" stroke={lit ? "#fbbf24" : "#fde68a"} strokeWidth={lit ? 5 : 2.5} strokeDasharray={lit ? undefined : "4 10"} strokeLinecap="round" opacity={lit ? 0.95 : j.is_obtainable ? 0.5 : 0.25} style={lit ? { filter: "drop-shadow(0 0 6px rgba(251,191,36,.9))" } : undefined} />); });
  });

  const sky = "linear-gradient(180deg,#7cc8ff 0%,#b5e2ff 45%,#e8f7ff 100%)";

  return (
    <div ref={wrapRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      style={{ position: "absolute", inset: 0, overflow: "hidden", cursor: drag.current ? "grabbing" : "grab", touchAction: "none", background: sky, userSelect: "none" }}>

      {/* ===== 遠景レイヤー（パララックス 0.35x） ===== */}
      <div style={{ position: "absolute", left: 0, top: 0, width: WORLD_W, height: WORLD_H, transform: `translate(${cam.x * 0.35}px,${cam.y * 0.35}px)`, pointerEvents: "none" }}>
        {/* 遠くの山 */}
        {[{ x: 1300, w: 700, h: 260, c: "#b9d6ec" }, { x: 1650, w: 520, h: 330, c: "#a9c9e4" }, { x: -100, w: 600, h: 200, c: "#bfdaee" }, { x: 700, w: 500, h: 170, c: "#c6def0" }].map((m, i) => (
          <div key={i} style={{ position: "absolute", left: m.x, top: 420 - m.h, width: m.w, height: m.h, background: m.c, clipPath: "polygon(0 100%, 18% 35%, 30% 55%, 48% 0, 62% 40%, 78% 20%, 100% 100%)", opacity: 0.8 }} />
        ))}
        {/* 遠景の浮島 */}
        {[{ x: 1500, y: 60, w: 240 }, { x: 40, y: 540, w: 170 }, { x: 1720, y: 1250, w: 200 }, { x: 1100, y: 20, w: 150 }, { x: 600, y: 1320, w: 160 }].map((f, i) => (
          <div key={i} style={{ position: "absolute", left: f.x, top: f.y, width: f.w, height: f.w * 0.4, animation: `swFloat ${6 + i}s ease-in-out infinite alternate`, opacity: 0.75 }}>
            <div style={{ position: "absolute", left: "8%", right: "8%", top: "40%", bottom: -6, borderRadius: "10% 10% 50% 50% / 20% 20% 100% 100%", background: "linear-gradient(180deg,#a89a8a,#6b5a4a)", filter: "blur(.5px)" }} />
            <div style={{ position: "absolute", inset: "0 0 45% 0", borderRadius: "50%", background: "radial-gradient(ellipse at 50% 40%, #cfeeb5, #8ecb8c)" }} />
            <div style={{ position: "absolute", left: "30%", top: "-20%", fontSize: f.w * 0.18 }}>🌳</div>
          </div>
        ))}
        {/* 気球・鳥 */}
        <div style={{ position: "absolute", left: 500, top: 80, fontSize: 46, animation: "swBalloon 14s ease-in-out infinite alternate", filter: "drop-shadow(0 6px 6px rgba(0,0,0,.15))" }}>🎈</div>
        <div style={{ position: "absolute", left: 1300, top: 640, fontSize: 36, animation: "swBalloon 18s ease-in-out infinite alternate-reverse", filter: "drop-shadow(0 6px 6px rgba(0,0,0,.15))" }}>🪂</div>
        {[0, 1, 2].map((i) => <div key={i} style={{ position: "absolute", left: 0, top: 120 + i * 260, fontSize: 14, color: "#4b6a8a", animation: `swBird ${40 + i * 15}s linear infinite`, animationDelay: `${-i * 12}s`, opacity: 0.7 }}>〰️</div>)}
      </div>

      {/* 近景の雲（画面固定） */}
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ position: "absolute", top: `${6 + i * 22}%`, left: 0, width: 150 + i * 30, height: 42 + i * 6, background: "rgba(255,255,255,.85)", borderRadius: 999, filter: "blur(2px)", animation: `swCloud ${80 + i * 25}s linear infinite`, animationDelay: `${-i * 23}s`, pointerEvents: "none", boxShadow: "36px -16px 0 -4px rgba(255,255,255,.75), 74px 0 0 -2px rgba(255,255,255,.8)", opacity: 0.9, zIndex: 2 }} />
      ))}

      {/* ===== ワールド本体 ===== */}
      <div style={{ position: "absolute", left: 0, top: 0, width: WORLD_W, height: WORLD_H, transform: `translate(${cam.x}px,${cam.y}px) scale(${cam.s})`, transformOrigin: "0 0", willChange: "transform" }}>

        {/* 川（THINKINGの湖 → 下へ） */}
        <svg width={WORLD_W} height={WORLD_H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
          <path d="M 860 780 C 900 900, 1060 940, 1120 1000 C 1160 1050, 1130 1200, 1150 1400" fill="none" stroke="#9ed7f7" strokeWidth={26} strokeLinecap="round" opacity={0.9} />
          <path d="M 860 780 C 900 900, 1060 940, 1120 1000 C 1160 1050, 1130 1200, 1150 1400" fill="none" stroke="#dff4ff" strokeWidth={6} strokeDasharray="30 40" strokeLinecap="round" opacity={0.9} style={{ animation: "swFlow 3s linear infinite" }} />
        </svg>

        {/* エリア地形 */}
        {AREAS.map((a) => {
          const explored = (unlockedByCat[a.key] ?? 0) > 0;
          const col = AREA_COLOR[a.key];
          return (
            <div key={a.key} style={{ position: "absolute", left: a.x, top: a.y, width: a.w, height: a.h }}>
              {/* 島の底 */}
              <div style={{ position: "absolute", left: "6%", right: "6%", bottom: -26, height: 90, borderRadius: "10% 10% 50% 50% / 20% 20% 100% 100%", background: `linear-gradient(180deg, ${a.side}, #4a3626)`, boxShadow: "0 24px 30px rgba(50,70,110,.3)" }} />
              {/* 滝（川の出口） */}
              {a.key === "think" && <div style={{ position: "absolute", left: "56%", bottom: -58, width: 26, height: 70, background: "linear-gradient(180deg,#bfe6ff,#e8f7ff)", borderRadius: "0 0 10px 10px", opacity: 0.9, boxShadow: "0 0 10px #fff" }} />}
              {/* 地面 */}
              <div style={{ position: "absolute", inset: 0, borderRadius: a.radius, background: a.top, boxShadow: "inset 0 6px 10px rgba(255,255,255,.5), inset 0 -16px 22px rgba(40,80,40,.25)" }}>
                {a.key === "sales" && <div style={{ position: "absolute", inset: "18% 10% 22% 10%", borderRadius: "40%", background: "radial-gradient(circle, #e9dcc0 2px, transparent 3px) 0 0/14px 14px, #efe3cb", opacity: 0.85 }} />}
                {a.key === "mgmt" && [0, 1, 2].map((i) => <div key={i} style={{ position: "absolute", left: `${8 + i * 6}%`, right: `${8 + i * 6}%`, top: `${22 + i * 14}%`, height: 16, borderRadius: 10, background: "rgba(255,255,255,.35)", boxShadow: "0 3px 0 rgba(60,90,60,.25)" }} />)}
                {a.key === "mgmt" && <div style={{ position: "absolute", left: "12%", right: "12%", top: "10%", height: 14, background: "repeating-linear-gradient(90deg,#e5e7eb 0 14px,transparent 14px 22px)", borderBottom: "6px solid #d1d5db" }} />}
                {a.key === "comm" && <div style={{ position: "absolute", left: "10%", right: "10%", bottom: "16%", height: 8, background: "repeating-linear-gradient(90deg,#c48a4b 0 4px,transparent 4px 18px)", borderTop: "3px solid #c48a4b", opacity: 0.8 }} />}
                {a.key === "comm" && <div style={{ position: "absolute", left: "40%", top: "8%", width: 240, height: 22, borderRadius: 999, background: "linear-gradient(90deg,#bfe6ff,#9ed7f7)", transform: "rotate(-6deg)", opacity: 0.9 }} />}
                {a.key === "think" && <div style={{ position: "absolute", left: "48%", top: "24%", width: 190, height: 84, borderRadius: "50%", background: "radial-gradient(ellipse at 50% 40%, #cdebff, #5fb0f0)", boxShadow: "inset 0 4px 8px rgba(255,255,255,.7), 0 0 0 6px rgba(255,255,255,.25)" }}><div style={{ position: "absolute", left: "30%", top: "38%", width: 80, height: 8, background: "#c48a4b", borderRadius: 4 }} /></div>}
                {a.key === "ai" && <div style={{ position: "absolute", inset: "20% 15%", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,.5), transparent 70%)", animation: "swGlow 4s ease-in-out infinite alternate" }} />}
              </div>
              {/* 木・花・建物 */}
              {a.key !== "ai" && [0, 1, 2, 3, 4, 5, 6].map((i) => {
                const leaf = a.key === "comm" ? (i % 2 ? "#f9a8d4" : "#7ccf6a") : a.key === "sales" ? "#86c66a" : a.key === "mgmt" ? "#5aa66b" : (i % 2 ? "#3f9a5a" : "#56b36a");
                return (<div key={i} style={{ position: "absolute", left: `${6 + i * 13.5}%`, top: `${i % 2 ? 6 : 62}%`, width: 30, height: 36, filter: "drop-shadow(0 3px 3px rgba(0,0,0,.2))" }}>
                  <div style={{ position: "absolute", bottom: 0, left: 13, width: 5, height: 14, background: "#8a5a2b", borderRadius: 2 }} />
                  <div style={{ position: "absolute", bottom: 10, left: 0, width: 30, height: 26, borderRadius: "50%", background: leaf, boxShadow: "inset -5px -5px 0 rgba(0,0,0,.12)" }} />
                </div>);
              })}
              {a.key === "comm" && [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => <div key={"f" + i} style={{ position: "absolute", left: `${4 + i * 9.5}%`, top: `${28 + (i % 3) * 20}%`, fontSize: 12 }}>{i % 3 === 0 ? "🌷" : i % 3 === 1 ? "🌼" : "🌸"}</div>)}
              {a.key === "comm" && <div style={{ position: "absolute", left: "70%", top: "20%", fontSize: 16, animation: "swFloat 2s ease-in-out infinite alternate" }}>🦋</div>}
              {a.key === "sales" && [0, 1, 2, 3, 4].map((i) => <div key={"h" + i} style={{ position: "absolute", left: `${12 + i * 18}%`, top: "12%", width: 34, height: 26, background: "#fff7e6", borderTop: `13px solid ${i % 2 ? "#ef4444" : "#f97316"}`, borderRadius: 3, boxShadow: "0 3px 6px rgba(0,0,0,.18)" }}><div style={{ position: "absolute", left: 12, bottom: 0, width: 9, height: 12, background: "#8a5a2b" }} /></div>)}
              {a.key === "sales" && [0, 1, 2].map((i) => <div key={"fl" + i} style={{ position: "absolute", left: `${30 + i * 22}%`, top: "4%", width: 3, height: 28, background: "#8a5a2b" }}><div style={{ position: "absolute", left: 3, top: 0, width: 14, height: 9, background: i % 2 ? "#ef4444" : "#fbbf24", clipPath: "polygon(0 0,100% 50%,0 100%)", animation: "swFlag 1s ease-in-out infinite alternate" }} /></div>)}
              {a.key === "sales" && <div style={{ position: "absolute", left: "58%", top: "60%", fontSize: 20 }}>🏮</div>}
              {a.key === "think" && <div style={{ position: "absolute", left: "20%", top: "58%", fontSize: 16 }}>📖</div>}
              {a.key === "mgmt" && [0, 1].map((i) => <div key={"t" + i} style={{ position: "absolute", left: i ? "84%" : "8%", top: "-6%", width: 22, height: 46, background: "linear-gradient(90deg,#f3f4f6,#cbd5e1)", borderRadius: "4px 4px 0 0", boxShadow: "0 4px 8px rgba(0,0,0,.15)" }}><div style={{ position: "absolute", left: 2, top: -10, width: 18, height: 12, background: "#fbbf24", clipPath: "polygon(0 100%,50% 0,100% 100%)" }} /></div>)}
              {a.key === "ai" && [0, 1, 2, 3, 4, 5].map((i) => <div key={"c" + i} style={{ position: "absolute", left: `${6 + i * 16}%`, top: `${i % 2 ? 10 : 56}%`, width: 20, height: 32, background: "linear-gradient(180deg,#f5f3ff,#a78bfa)", clipPath: "polygon(50% 0, 100% 30%, 80% 100%, 20% 100%, 0 30%)", boxShadow: "0 0 14px #c4b5fd", animation: `swFloat ${3 + i}s ease-in-out infinite alternate` }} />)}
              {a.key === "ai" && [0, 1, 2, 3].map((i) => <div key={"p" + i} style={{ position: "absolute", left: `${14 + i * 24}%`, top: "40%", width: 6, height: 6, borderRadius: "50%", background: "#67e8f9", boxShadow: "0 0 10px #22d3ee", animation: `swTwinkle ${1 + i * 0.3}s ease-in-out infinite alternate` }} />)}
              {/* 看板 */}
              <div style={{ position: "absolute", left: 28, top: -14, padding: "5px 14px", borderRadius: 12, background: "linear-gradient(180deg,#fff,#fdf6e3)", border: `2px solid ${col}`, fontSize: 12, fontWeight: 900, letterSpacing: 1, color: col, boxShadow: "0 4px 10px rgba(0,0,0,.15)", whiteSpace: "nowrap" }}>{a.emoji} {a.label}</div>
              {/* Fog of War：雲の群れ（矩形なし） */}
              {!explored && [0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div key={"fog" + i} style={{ position: "absolute", left: `${38 + (i * 11) % 62}%`, top: `${-10 + (i * 37) % 80}%`, width: 170 + (i % 3) * 50, height: 70 + (i % 2) * 24, borderRadius: 999, background: "rgba(255,255,255,.92)", filter: "blur(6px)", boxShadow: "40px -18px 0 -6px rgba(255,255,255,.85), 90px 4px 0 -4px rgba(255,255,255,.9)", animation: `swFloat ${5 + i}s ease-in-out infinite alternate`, pointerEvents: "none", zIndex: 5 }} />
              ))}
            </div>
          );
        })}

        {/* 道 */}
        <svg width={WORLD_W} height={WORLD_H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
          {roadEls}
          {nextPos && <path d={curve(avatarAt, nextPos)} fill="none" stroke="#fff" strokeWidth={4} strokeDasharray="2 14" strokeLinecap="round" opacity={0.95} style={{ animation: "swSteps 1.2s linear infinite", filter: "drop-shadow(0 0 4px rgba(251,191,36,.9))" }} />}
        </svg>

        {/* START村 */}
        <div style={{ position: "absolute", left: START.x - 60, top: START.y - 70, width: 120, textAlign: "center", zIndex: 8 }}>
          <div style={{ fontSize: 52, lineHeight: 1, filter: "drop-shadow(0 5px 5px rgba(0,0,0,.22))" }}>🏡</div>
          <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 10, background: "#fff", fontSize: 11, fontWeight: 900, color: "#166534", boxShadow: "0 2px 6px rgba(0,0,0,.15)" }}>🌱 START</div>
          <div style={{ fontSize: 9, color: "#166534", fontWeight: 700, marginTop: 2 }}>冒険のはじまり</div>
        </div>

        {/* スキルノード（ランドマーク） */}
        {res.nodes.map((n) => {
          const p = NODE_POS[n.id]; if (!p) return null;
          const color = AREA_COLOR[n.category];
          const explored = (unlockedByCat[n.category] ?? 0) > 0 || n.order_no <= 2;
          const fog = (n.is_hidden && n.status === "locked") || (!explored && n.status === "locked");
          const u = n.status === "unlocked", a = n.status === "available";
          const key = n.kind === "key";
          const lm = key ? 62 : 40;
          const sel = selectedId === n.id;
          const w = key ? 110 : 84;
          return (
            <div key={n.id} onClick={() => clickNode(n)} style={{ position: "absolute", left: p.x - w / 2, top: p.y - lm - 22, width: w, cursor: "pointer", zIndex: sel ? 20 : 10, transition: "transform .2s", transform: sel ? "scale(1.12)" : "none", textAlign: "center" }}>
              {a && !fog && <div style={{ position: "absolute", top: -22, left: "50%", transform: "translateX(-50%)", fontSize: 20, fontWeight: 900, color: "#ef4444", animation: "swBounce 1s ease-in-out infinite", textShadow: "0 0 6px #fff, 0 0 2px #fff" }}>！</div>}
              {u && <div style={{ position: "absolute", top: -8, right: 6, fontSize: 18, zIndex: 2, animation: "swFlag 1s ease-in-out infinite alternate" }}>🚩</div>}
              {/* 台座（地面） */}
              <div style={{ position: "absolute", left: "10%", right: "10%", bottom: 16, height: key ? 30 : 22, borderRadius: "50%", background: u ? `radial-gradient(ellipse, ${color}aa, ${color}22)` : a ? `radial-gradient(ellipse, ${color}66, transparent 70%)` : "rgba(60,60,80,.18)", filter: "blur(2px)", animation: a && !fog ? "swPulse 2s ease-in-out infinite" : undefined }} />
              {/* ランドマーク */}
              <div style={{ position: "relative", fontSize: lm, lineHeight: 1, filter: fog ? "blur(2px) grayscale(1) opacity(.5)" : u ? `drop-shadow(0 0 14px ${color}) drop-shadow(0 6px 5px rgba(0,0,0,.25))` : a ? "drop-shadow(0 6px 5px rgba(0,0,0,.25))" : "saturate(.25) opacity(.75) drop-shadow(0 4px 4px rgba(0,0,0,.2))", display: "inline-block" }}>
                {fog ? "☁️" : LANDMARK[n.id] ?? n.icon}
                {!fog && <span style={{ position: "absolute", right: -10, bottom: -4, width: 22, height: 22, borderRadius: 11, background: u ? color : "#fff", border: `2px solid ${u ? "#fff" : color}`, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 5px rgba(0,0,0,.2)" }}>{n.icon}</span>}
              </div>
              {/* 名前 */}
              <div style={{ marginTop: 2, whiteSpace: "nowrap" }}>
                <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 9, background: u ? color : "rgba(255,255,255,.94)", color: u ? "#fff" : fog ? "#94a3b8" : "#1e293b", fontSize: key ? 12.5 : 11.5, fontWeight: 900, boxShadow: "0 2px 6px rgba(0,0,0,.18)", border: key && !u ? `2px solid ${color}` : "none" }}>{fog ? "？？？" : n.name}</span>
              </div>
              {u && [0, 1, 2].map((i) => <div key={i} style={{ position: "absolute", left: 10 + i * 28, top: 4 + (i % 2) * 14, width: 6, height: 6, borderRadius: "50%", background: "#fff", boxShadow: `0 0 8px ${color}`, animation: `swTwinkle ${1.2 + i * 0.4}s ease-in-out infinite alternate` }} />)}
            </div>
          );
        })}

        {/* JOB 巨大ランドマーク */}
        {res.jobs.map((j: JobState) => {
          const p = JOB_POS[j.id]; if (!p) return null;
          const haze = !j.is_obtainable && !j.unlocked;
          const done = j.requires.length - j.missing.length;
          const ratio = j.requires.length ? done / j.requires.length : 0;
          const size = j.id === "manager" ? 230 : 200;
          return (
            <div key={j.id} style={{ position: "absolute", left: p.x - size / 2, top: p.y - size * 0.7, width: size, textAlign: "center", zIndex: 9 }}>
              <div style={{ position: "absolute", left: "8%", right: "8%", bottom: 22, height: 40, borderRadius: "50%", background: j.unlocked ? "rgba(251,191,36,.6)" : "rgba(60,60,80,.22)", filter: "blur(12px)" }} />
              {j.id === "closer" && <div style={{ position: "absolute", right: 8, bottom: 70, fontSize: size * 0.42, lineHeight: 1, filter: "drop-shadow(0 6px 6px rgba(0,0,0,.25))" }}>🗼</div>}
              <div style={{ position: "relative", fontSize: size * 0.6, lineHeight: 1, filter: j.unlocked ? "drop-shadow(0 0 28px #fbbf24) drop-shadow(0 8px 8px rgba(0,0,0,.25))" : haze ? `blur(${1.5 - ratio}px) saturate(.6) opacity(${0.55 + ratio * 0.4}) drop-shadow(0 8px 8px rgba(0,0,0,.2))` : "drop-shadow(0 8px 8px rgba(0,0,0,.28))" }}>{JOB_LM[j.id]}</div>
              {haze && [0, 1, 2, 3].map((i) => <div key={i} style={{ position: "absolute", left: `${-10 + i * 28}%`, top: `${10 + (i % 2) * 34}%`, width: 120, height: 48, borderRadius: 999, background: `rgba(255,255,255,${0.9 - ratio * 0.6})`, filter: "blur(6px)", boxShadow: "40px -14px 0 -6px rgba(255,255,255,.8)", animation: `swFloat ${5 + i}s ease-in-out infinite alternate`, pointerEvents: "none" }} />)}
              <div style={{ display: "inline-block", marginTop: -4, padding: "6px 18px", borderRadius: 14, background: j.unlocked ? "linear-gradient(135deg,#fbbf24,#f59e0b)" : "linear-gradient(180deg,#fff,#fdf6e3)", border: "3px solid #fbbf24", color: j.unlocked ? "#fff" : "#92400e", fontSize: 16, fontWeight: 900, letterSpacing: 2, boxShadow: "0 4px 14px rgba(0,0,0,.18)", position: "relative" }}>
                {haze ? "？？？" : `${j.icon} ${j.name}`}
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: "#92400e", marginTop: 4, textShadow: "0 0 4px #fff" }}>{j.unlocked ? "👑 到達！" : haze ? "遠くに城が見える…" : `${done} / ${j.requires.length} skills`}</div>
            </div>
          );
        })}

        {/* アバター（主役） */}
        <div style={{ position: "absolute", left: avatarAt.x - 46, top: avatarAt.y - 128, width: 92, zIndex: 30, pointerEvents: "none" }}>
          <div style={{ position: "absolute", left: 6, right: 6, bottom: -4, height: 30, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(251,191,36,.75), rgba(251,191,36,0) 70%)", animation: "swGlow 1.8s ease-in-out infinite alternate" }} />
          <div style={{ position: "absolute", left: 22, right: 22, bottom: 4, height: 12, borderRadius: "50%", background: "rgba(0,0,0,.22)", filter: "blur(3px)" }} />
          {nextBest && (
            <div style={{ position: "absolute", bottom: 100, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", background: "#fff", borderRadius: 14, padding: "6px 12px", fontSize: 12, fontWeight: 900, color: "#1e293b", boxShadow: "0 4px 12px rgba(0,0,0,.2)", border: "2px solid #fde68a" }}>
              🎯 {nextBest.name}{nextCond ? `：あと${nextCond.threshold > 1 ? nextCond.threshold - Math.min(nextCond.current, nextCond.threshold) : 1}つ！` : ""}
              <div style={{ position: "absolute", bottom: -7, left: "50%", marginLeft: -6, width: 12, height: 12, background: "#fff", transform: "rotate(45deg)", borderRight: "2px solid #fde68a", borderBottom: "2px solid #fde68a" }} />
            </div>
          )}
          <div style={{ animation: "swBob 2.2s ease-in-out infinite", position: "relative" }}>
            {avatarId ? <img src={`/avatars/${avatarId}.png`} alt="" style={{ width: 92, display: "block", filter: "drop-shadow(0 8px 8px rgba(0,0,0,.28))" }} /> : <div style={{ fontSize: 64, textAlign: "center" }}>🧑‍🚀</div>}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes swCloud{0%{transform:translateX(-30vw)}100%{transform:translateX(130vw)}}
        @keyframes swFloat{from{transform:translateY(0)}to{transform:translateY(-10px)}}
        @keyframes swBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes swBounce{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-7px)}}
        @keyframes swPulse{0%,100%{opacity:.5;transform:scale(.9)}50%{opacity:1;transform:scale(1.1)}}
        @keyframes swTwinkle{from{opacity:.2;transform:scale(.6)}to{opacity:1;transform:scale(1.2)}}
        @keyframes swGlow{from{opacity:.6;transform:scale(.9)}to{opacity:1;transform:scale(1.08)}}
        @keyframes swFlag{from{transform:skewY(-6deg)}to{transform:skewY(6deg)}}
        @keyframes swBalloon{from{transform:translate(0,0)}to{transform:translate(60px,-30px)}}
        @keyframes swBird{0%{transform:translateX(-80px)}100%{transform:translateX(2100px)}}
        @keyframes swFlow{to{stroke-dashoffset:-70}}
        @keyframes swSteps{to{stroke-dashoffset:-32}}
      `}</style>
    </div>
  );
}
