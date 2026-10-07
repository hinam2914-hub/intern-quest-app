"use client";
import { useEffect, useRef, useState } from "react";
import type { EvalResult, NodeState, JobState } from "../lib/skills";
import { WORLD_W, WORLD_H, START, NODE_POS, JOB_POS, JOB_ICON, AREAS, AREA_COLOR, ROADS, pt, curve, type Pt } from "./world";

type Cam = { x: number; y: number; s: number };

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

  // アバター位置：直近取得ノード → START
  const lastUnlocked = [...res.nodes].filter((n) => n.status === "unlocked" && n.unlocked_at).sort((a, b) => (b.unlocked_at! > a.unlocked_at! ? 1 : -1))[0];
  const avatarAt: Pt = lastUnlocked ? NODE_POS[lastUnlocked.id] : START;
  const nextBest = res.nodes.filter((n) => n.status === "available").sort((a, b) => b.progress - a.progress)[0];
  const nextCond = nextBest?.conds.find((c) => !c.done);

  function clamp(c: Cam): Cam {
    const minX = vp.w - WORLD_W * c.s, minY = vp.h - WORLD_H * c.s;
    return { s: c.s, x: Math.min(0, Math.max(minX, c.x)), y: Math.min(0, Math.max(minY, c.y)) };
  }
  function centerOn(p: Pt, s?: number) {
    const sc = s ?? cam.s;
    setCam(clamp({ s: sc, x: vp.w / 2 - p.x * sc, y: vp.h / 2 - p.y * sc }));
  }

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setVp({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el);
    setVp({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  useEffect(() => { // 初回：アバターにセンタリング
    const s = vp.w < 640 ? 0.8 : Math.min(1.8, Math.max(1, vp.w / 1000));
    setCam(clamp({ s, x: vp.w / 2 - avatarAt.x * s, y: vp.h / 2 - avatarAt.y * s + 60 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp.w, vp.h]);
  useEffect(() => { if (focusTo) centerOn(focusTo.target); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTo?.key]);

  // --- 操作 ---
  function onPointerDown(e: React.PointerEvent) {
    if (pinch.current) return;
    drag.current = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
    setCam(clamp({ s: cam.s, x: drag.current.cx + dx, y: drag.current.cy + dy }));
  }
  function onPointerUp() { setTimeout(() => { drag.current = null; }, 0); }
  function onWheel(e: React.WheelEvent) {
    const ns = Math.min(2.0, Math.max(0.5, cam.s * (e.deltaY > 0 ? 0.9 : 1.1)));
    const rect = wrapRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const wx = (mx - cam.x) / cam.s, wy = (my - cam.y) / cam.s;
    setCam(clamp({ s: ns, x: mx - wx * ns, y: my - wy * ns }));
  }
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); pinch.current = { d, s: cam.s }; drag.current = null; }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinch.current) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const ns = Math.min(2.0, Math.max(0.5, pinch.current.s * (d / pinch.current.d)));
      const rect = wrapRef.current!.getBoundingClientRect();
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left, my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      const wx = (mx - cam.x) / cam.s, wy = (my - cam.y) / cam.s;
      setCam(clamp({ s: ns, x: mx - wx * ns, y: my - wy * ns }));
    }
  }
  function onTouchEnd(e: React.TouchEvent) { if (e.touches.length < 2) pinch.current = null; }
  function clickNode(n: NodeState) { if (drag.current?.moved) return; onSelect(n); }

  // --- 道 ---
  const roadEls: React.ReactNode[] = [];
  const cats = ["comm", "sales", "think", "mgmt", "ai"];
  cats.forEach((c) => {
    const ns = res.nodes.filter((n) => n.category === c).sort((a, b) => a.order_no - b.order_no);
    for (let i = 0; i < ns.length - 1; i++) {
      const a = NODE_POS[ns[i].id], b = NODE_POS[ns[i + 1].id]; if (!a || !b) continue;
      const lit = ns[i].status === "unlocked";
      const explored = (unlockedByCat[c] ?? 0) > 0 || i < 1;
      roadEls.push(<path key={`m${ns[i].id}`} d={curve(a, b)} fill="none" stroke={lit ? "#fde68a" : "#fff"} strokeWidth={lit ? 14 : 10} strokeLinecap="round" opacity={lit ? 0.95 : explored ? 0.75 : 0.35} style={lit ? { filter: "drop-shadow(0 0 8px rgba(251,191,36,.9))" } : undefined} />);
      roadEls.push(<path key={`md${ns[i].id}`} d={curve(a, b)} fill="none" stroke={lit ? "#f59e0b" : "#cbd5e1"} strokeWidth={3} strokeDasharray="10 12" strokeLinecap="round" opacity={explored ? 0.8 : 0.3} />);
    }
  });
  ROADS.forEach((r, i) => {
    const a = pt(r.from), b = pt(r.to);
    const lit = r.from === "START" || byId.get(r.from)?.status === "unlocked";
    roadEls.push(<path key={`l${i}`} d={curve(a, b, r.via)} fill="none" stroke="#fff" strokeWidth={9} strokeLinecap="round" opacity={0.6} />);
    roadEls.push(<path key={`ld${i}`} d={curve(a, b, r.via)} fill="none" stroke={lit ? "#f59e0b" : "#cbd5e1"} strokeWidth={3} strokeDasharray="6 14" strokeLinecap="round" opacity={0.7} />);
  });
  res.jobs.forEach((j) => {
    const jp = JOB_POS[j.id]; if (!jp) return;
    j.requires.forEach((rid) => {
      const a = NODE_POS[rid]; if (!a) return;
      const lit = byId.get(rid)?.status === "unlocked";
      roadEls.push(<path key={`j${j.id}${rid}`} d={curve(a, jp)} fill="none" stroke={lit ? "#fbbf24" : "#fde68a"} strokeWidth={lit ? 5 : 2.5} strokeDasharray={lit ? undefined : "4 10"} strokeLinecap="round" opacity={lit ? 0.95 : j.is_obtainable ? 0.5 : 0.25} style={lit ? { filter: "drop-shadow(0 0 6px rgba(251,191,36,.9))" } : undefined} />);
    });
  });

  return (
    <div ref={wrapRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      style={{ position: "absolute", inset: 0, overflow: "hidden", cursor: drag.current ? "grabbing" : "grab", touchAction: "none", background: "linear-gradient(180deg,#8fd3ff 0%,#bfe8ff 40%,#e6f6ff 100%)", userSelect: "none" }}>
      {/* 遠景の雲（画面固定・パララックス弱） */}
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ position: "absolute", top: `${8 + i * 18}%`, left: 0, width: 140 + i * 30, height: 40 + i * 6, background: "rgba(255,255,255,.8)", borderRadius: 999, filter: "blur(2px)", animation: `swCloud ${70 + i * 25}s linear infinite`, animationDelay: `${-i * 23}s`, pointerEvents: "none", boxShadow: "34px -14px 0 -4px rgba(255,255,255,.7), 70px 0 0 -2px rgba(255,255,255,.75)", opacity: 0.9 }} />
      ))}

      <div style={{ position: "absolute", left: 0, top: 0, width: WORLD_W, height: WORLD_H, transform: `translate(${cam.x}px,${cam.y}px) scale(${cam.s})`, transformOrigin: "0 0", willChange: "transform" }}>
        {/* 遠景の浮島シルエット */}
        {[{ x: 1500, y: 90, w: 220 }, { x: 60, y: 560, w: 160 }, { x: 1750, y: 1300, w: 190 }, { x: 1150, y: 40, w: 140 }].map((f, i) => (
          <div key={i} style={{ position: "absolute", left: f.x, top: f.y, width: f.w, height: f.w * 0.36, borderRadius: "50% 50% 46% 54% / 60% 60% 40% 40%", background: "linear-gradient(180deg, rgba(190,230,170,.55), rgba(120,140,170,.35))", filter: "blur(1.5px)", opacity: 0.7, animation: `swFloat ${6 + i}s ease-in-out infinite alternate` }} />
        ))}

        {/* エリア地形 */}
        {AREAS.map((a) => {
          const explored = (unlockedByCat[a.key] ?? 0) > 0;
          return (
            <div key={a.key} style={{ position: "absolute", left: a.x, top: a.y, width: a.w, height: a.h }}>
              <div style={{ position: "absolute", left: "6%", right: "6%", bottom: -22, height: 80, borderRadius: "10% 10% 50% 50% / 20% 20% 100% 100%", background: `linear-gradient(180deg, ${a.side}, #4a3626)`, opacity: 0.9 }} />
              <div style={{ position: "absolute", inset: 0, borderRadius: a.radius, background: a.top, boxShadow: "inset 0 4px 8px rgba(255,255,255,.45), inset 0 -14px 20px rgba(40,80,40,.25), 0 18px 30px rgba(60,80,120,.25)" }} />
              {/* 装飾：木・花・建物（CSS） */}
              {a.key !== "ai" && [0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ position: "absolute", left: `${8 + i * 15}%`, top: `${i % 2 ? 12 : 60}%`, width: 26, height: 30 }}>
                  <div style={{ position: "absolute", bottom: 0, left: 11, width: 5, height: 12, background: "#8a5a2b", borderRadius: 2 }} />
                  <div style={{ position: "absolute", bottom: 8, left: 0, width: 26, height: 22, borderRadius: "50%", background: a.key === "comm" ? "#f9a8d4" : a.key === "sales" ? "#86c66a" : a.key === "mgmt" ? "#5aa66b" : "#4caf50", boxShadow: "inset -4px -4px 0 rgba(0,0,0,.12)" }} />
                </div>
              ))}
              {a.key === "comm" && [0, 1, 2, 3, 4, 5, 6, 7].map((i) => <div key={"f" + i} style={{ position: "absolute", left: `${5 + i * 12}%`, top: `${30 + (i % 3) * 20}%`, width: 7, height: 7, borderRadius: "50%", background: i % 2 ? "#f472b6" : "#fbbf24", boxShadow: "0 0 4px #fff" }} />)}
              {a.key === "think" && <div style={{ position: "absolute", left: "52%", top: "28%", width: 150, height: 70, borderRadius: "50%", background: "radial-gradient(ellipse at 50% 40%, #bae6fd, #60a5fa)", boxShadow: "inset 0 3px 6px rgba(255,255,255,.7)" }} />}
              {a.key === "sales" && [0, 1, 2, 3].map((i) => <div key={"h" + i} style={{ position: "absolute", left: `${14 + i * 22}%`, top: "18%", width: 30, height: 24, background: "#fef3c7", borderTop: "12px solid #ef4444", borderRadius: 3, boxShadow: "0 3px 6px rgba(0,0,0,.15)" }} />)}
              {a.key === "mgmt" && <div style={{ position: "absolute", right: "6%", top: "-8%", width: 70, height: 60, background: "#e2e8f0", borderRadius: "6px 6px 0 0", boxShadow: "0 4px 8px rgba(0,0,0,.15)" }}><div style={{ position: "absolute", top: -18, left: 6, width: 14, height: 18, background: "#cbd5e1" }} /><div style={{ position: "absolute", top: -18, right: 6, width: 14, height: 18, background: "#cbd5e1" }} /></div>}
              {a.key === "ai" && [0, 1, 2, 3, 4].map((i) => <div key={"c" + i} style={{ position: "absolute", left: `${10 + i * 20}%`, top: `${i % 2 ? 15 : 55}%`, width: 18, height: 28, background: "linear-gradient(180deg,#e9d5ff,#a78bfa)", clipPath: "polygon(50% 0, 100% 30%, 80% 100%, 20% 100%, 0 30%)", boxShadow: "0 0 10px #c4b5fd", animation: `swFloat ${3 + i}s ease-in-out infinite alternate` }} />)}
              {/* 看板 */}
              <div style={{ position: "absolute", left: 24, top: 10, padding: "4px 12px", borderRadius: 10, background: "rgba(255,255,255,.85)", border: `2px solid ${AREA_COLOR[a.key]}`, fontSize: 11, fontWeight: 900, letterSpacing: 1, color: AREA_COLOR[a.key], boxShadow: "0 3px 8px rgba(0,0,0,.12)", whiteSpace: "nowrap" }}>{a.emoji} {a.label}</div>
              {/* 未探索の霞 */}
              {!explored && <div style={{ position: "absolute", left: "36%", right: "-4%", top: "-18%", bottom: "-18%", borderRadius: "50%", background: "radial-gradient(ellipse at 60% 50%, rgba(255,255,255,.96) 0%, rgba(255,255,255,.85) 50%, rgba(255,255,255,0) 72%)", filter: "blur(10px)", pointerEvents: "none" }} />}
            </div>
          );
        })}

        {/* 道 */}
        <svg width={WORLD_W} height={WORLD_H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>{roadEls}</svg>

        {/* START村 */}
        <div style={{ position: "absolute", left: START.x - 50, top: START.y - 60, width: 100, textAlign: "center" }}>
          <div style={{ fontSize: 44, filter: "drop-shadow(0 4px 4px rgba(0,0,0,.2))" }}>🏡</div>
          <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 10, background: "#fff", fontSize: 11, fontWeight: 900, color: "#166534", boxShadow: "0 2px 6px rgba(0,0,0,.15)" }}>🌱 START</div>
          <div style={{ fontSize: 9, color: "#166534", fontWeight: 700, marginTop: 2 }}>冒険のはじまり</div>
        </div>

        {/* スキルノード */}
        {res.nodes.map((n) => {
          const p = NODE_POS[n.id]; if (!p) return null;
          const color = AREA_COLOR[n.category];
          const explored = (unlockedByCat[n.category] ?? 0) > 0 || n.order_no <= 2;
          const fog = (n.is_hidden && n.status === "locked") || (!explored && n.status === "locked");
          const u = n.status === "unlocked", a = n.status === "available";
          const size = n.kind === "key" ? 84 : 64;
          const sel = selectedId === n.id;
          return (
            <div key={n.id} onClick={() => clickNode(n)} style={{ position: "absolute", left: p.x - size / 2, top: p.y - size / 2, width: size, cursor: "pointer", zIndex: sel ? 20 : 10, transition: "transform .2s", transform: sel ? "scale(1.12)" : "none" }}>
              {a && !fog && <div style={{ position: "absolute", top: -26, left: "50%", transform: "translateX(-50%)", fontSize: 18, fontWeight: 900, color: "#ef4444", animation: "swBounce 1s ease-in-out infinite", textShadow: "0 0 6px #fff" }}>！</div>}
              {u && <div style={{ position: "absolute", top: -14, right: -8, fontSize: 18, zIndex: 2 }}>🚩</div>}
              {/* 台座 */}
              <div style={{ position: "absolute", left: "8%", right: "8%", bottom: -6, height: size * 0.3, borderRadius: "50%", background: "rgba(60,60,80,.22)", filter: "blur(4px)" }} />
              <div style={{ width: size, height: size, borderRadius: n.kind === "key" ? 18 : "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5,
                background: fog ? "rgba(255,255,255,.9)" : u ? `radial-gradient(circle at 35% 30%, #fff8, ${color})` : a ? "#fff" : "#e2e8f0",
                border: `4px solid ${fog ? "#e2e8f0" : u ? "#fff" : a ? color : "#cbd5e1"}`,
                boxShadow: u ? `0 0 22px ${color}aa, 0 6px 12px rgba(0,0,0,.2)` : a ? `0 0 14px ${color}66, 0 6px 12px rgba(0,0,0,.15)` : "0 4px 10px rgba(0,0,0,.12)",
                filter: !u && !a && !fog ? "saturate(.3)" : "none", opacity: !u && !a && !fog ? 0.8 : 1,
                animation: a && !fog ? "swPulse 2s ease-in-out infinite" : undefined, position: "relative" }}>
                {fog ? <span style={{ color: "#94a3b8" }}>？</span> : n.icon}
                {fog && <div style={{ position: "absolute", inset: -14, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,.95) 40%, rgba(255,255,255,0) 72%)", pointerEvents: "none" }} />}
              </div>
              <div style={{ marginTop: 6, textAlign: "center", whiteSpace: "nowrap", transform: "translateX(-50%)", marginLeft: "50%" }}>
                <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 9, background: u ? color : "rgba(255,255,255,.92)", color: u ? "#fff" : fog ? "#94a3b8" : "#1e293b", fontSize: 11.5, fontWeight: 900, boxShadow: "0 2px 6px rgba(0,0,0,.15)" }}>{fog ? "？？？" : n.name}</span>
              </div>
              {u && [0, 1, 2].map((i) => <div key={i} style={{ position: "absolute", left: 8 + i * 22, top: -4 + (i % 2) * 10, width: 6, height: 6, borderRadius: "50%", background: "#fff", boxShadow: `0 0 8px ${color}`, animation: `swTwinkle ${1.2 + i * 0.4}s ease-in-out infinite alternate` }} />)}
            </div>
          );
        })}

        {/* JOBランドマーク */}
        {res.jobs.map((j: JobState) => {
          const p = JOB_POS[j.id]; if (!p) return null;
          const haze = !j.is_obtainable && !j.unlocked;
          const done = j.requires.length - j.missing.length;
          const size = j.id === "manager" ? 170 : 150;
          return (
            <div key={j.id} style={{ position: "absolute", left: p.x - size / 2, top: p.y - size / 2, width: size, textAlign: "center", zIndex: 9, opacity: haze ? 0.55 : 1, filter: haze ? "blur(1.2px) saturate(.5)" : "none" }}>
              <div style={{ position: "absolute", left: "10%", right: "10%", bottom: 10, height: 30, borderRadius: "50%", background: j.unlocked ? "rgba(251,191,36,.55)" : "rgba(60,60,80,.2)", filter: "blur(10px)" }} />
              <div style={{ fontSize: size * 0.62, lineHeight: 1, filter: j.unlocked ? "drop-shadow(0 0 22px #fbbf24)" : "drop-shadow(0 6px 6px rgba(0,0,0,.25))", position: "relative" }}>{JOB_ICON[j.id]}</div>
              <div style={{ display: "inline-block", marginTop: -6, padding: "4px 14px", borderRadius: 12, background: j.unlocked ? "linear-gradient(135deg,#fbbf24,#f59e0b)" : "rgba(255,255,255,.92)", border: "2px solid #fbbf24", color: j.unlocked ? "#fff" : "#92400e", fontSize: 13, fontWeight: 900, letterSpacing: 1, boxShadow: "0 3px 10px rgba(0,0,0,.15)" }}>
                {haze ? "？？？" : `${j.icon} ${j.name}`}
              </div>
              {!haze && <div style={{ fontSize: 11, fontWeight: 800, color: "#92400e", marginTop: 3 }}>{j.unlocked ? "到達！" : `${done} / ${j.requires.length} skills`}</div>}
              {haze && <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>遠くに城が見える…</div>}
            </div>
          );
        })}

        {/* アバター */}
        <div style={{ position: "absolute", left: avatarAt.x - 32, top: avatarAt.y - 96, width: 64, zIndex: 30, pointerEvents: "none", animation: "swBob 2.2s ease-in-out infinite" }}>
          {nextCond && nextBest && (
            <div style={{ position: "absolute", bottom: 72, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", background: "#fff", borderRadius: 12, padding: "5px 10px", fontSize: 11, fontWeight: 800, color: "#1e293b", boxShadow: "0 4px 10px rgba(0,0,0,.18)" }}>
              次は「{nextBest.name}」{nextCond.threshold > 1 ? `あと${nextCond.threshold - Math.min(nextCond.current, nextCond.threshold)}` : ""}
              <div style={{ position: "absolute", bottom: -6, left: "50%", marginLeft: -6, width: 12, height: 12, background: "#fff", transform: "rotate(45deg)" }} />
            </div>
          )}
          {avatarId ? <img src={`/avatars/${avatarId}.png`} alt="" style={{ width: 64, display: "block", filter: "drop-shadow(0 6px 6px rgba(0,0,0,.25))" }} /> : <div style={{ fontSize: 48, textAlign: "center" }}>🧑‍🚀</div>}
        </div>
      </div>

      <style>{`
        @keyframes swCloud{0%{transform:translateX(-30vw)}100%{transform:translateX(130vw)}}
        @keyframes swFloat{from{transform:translateY(0)}to{transform:translateY(-10px)}}
        @keyframes swBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes swBounce{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-6px)}}
        @keyframes swPulse{0%,100%{box-shadow:0 0 10px rgba(0,0,0,.1)}50%{box-shadow:0 0 26px rgba(251,191,36,.8)}}
        @keyframes swTwinkle{from{opacity:.2;transform:scale(.6)}to{opacity:1;transform:scale(1.2)}}
      `}</style>
    </div>
  );
}
