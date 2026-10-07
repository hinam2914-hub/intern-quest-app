"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { pickQuestCond, questText, type EvalResult, type NodeState, type JobState, type Focus } from "../lib/skills";
import { WORLD_W, WORLD_H, START, NODE_POS, JOB_POS, AREAS, AREA_COLOR, ROADS, pt, curve, type Pt } from "./world";

type Cam = { x: number; y: number; s: number };
export type Walk = { key: number; from: Pt; to: Pt };

/* ============================================================
   ランドマーク定義（場所として見せる）。img = public の既存素材
   ============================================================ */
type LM = { img?: string; w?: number; emoji?: string; badge?: string; svg?: "sign" | "board" | "tower" | "clock" | "gate" | "wall" | "observatory" | "lab" | "crystal" | "ring" | "mailbox" | "desk" | "stone" };
const LANDMARK: Record<string, LM> = {
  comm_1: { img: "/island/house/1_cabin.png", w: 74 }, comm_2: { svg: "sign", badge: "❓" }, comm_3: { img: "/island/house/2_house.png", w: 76, badge: "🎧" },
  comm_4: { img: "/island/deco/deco_funsui.png", w: 70 }, comm_5: { svg: "mailbox" }, comm_6: { img: "/island/house/3_big.png", w: 104, badge: "🌟" },
  sales_1: { img: "/island/house/2_house.png", w: 80, badge: "⚔️" }, sales_2: { img: "/island/house/1_cabin.png", w: 72, badge: "👂" }, sales_3: { svg: "board", badge: "🔍" },
  sales_4: { img: "/island/house/3_big.png", w: 86, badge: "💡" }, sales_5: { svg: "ring", badge: "🤝" }, sales_6: { svg: "tower" },
  think_1: { img: "/island/house/0_tent.png", w: 66 }, think_2: { svg: "desk", badge: "📚" }, think_3: { img: "/island/house/1_cabin.png", w: 70, badge: "🧪" },
  think_4: { svg: "stone", badge: "⚗️" }, think_5: { img: "/island/house/2_house.png", w: 78, badge: "🏫" }, think_6: { svg: "observatory" },
  mgmt_1: { svg: "clock" }, mgmt_2: { svg: "ring", badge: "🎯" }, mgmt_3: { img: "/island/house/3_big.png", w: 92, badge: "🌱" },
  mgmt_4: { svg: "sign", badge: "🚩" }, mgmt_5: { svg: "wall" }, mgmt_6: { svg: "gate" },
  ai_1: { svg: "lab" }, ai_2: { svg: "crystal", badge: "⌨️" }, ai_3: { svg: "lab", badge: "⚙️" }, ai_4: { svg: "crystal", badge: "⚡" }, ai_5: { svg: "lab", badge: "🤖" }, ai_6: { svg: "lab" },
};

/* 小さなSVGランドマーク */
function LmSvg({ kind, color, size = 60 }: { kind: NonNullable<LM["svg"]>; color: string; size?: number }) {
  const s = size;
  switch (kind) {
    case "sign": return (<svg width={s} height={s} viewBox="0 0 60 60"><rect x="27" y="30" width="6" height="26" fill="#8a5a2b" /><rect x="8" y="12" width="44" height="24" rx="4" fill="#d9a066" stroke="#8a5a2b" strokeWidth="3" /><rect x="14" y="18" width="32" height="3" rx="1.5" fill="#8a5a2b" opacity=".5" /><rect x="14" y="25" width="22" height="3" rx="1.5" fill="#8a5a2b" opacity=".5" /></svg>);
    case "board": return (<svg width={s} height={s} viewBox="0 0 60 60"><rect x="12" y="36" width="5" height="20" fill="#8a5a2b" /><rect x="43" y="36" width="5" height="20" fill="#8a5a2b" /><rect x="6" y="8" width="48" height="30" rx="3" fill="#f5e6c8" stroke="#8a5a2b" strokeWidth="3" /><rect x="12" y="14" width="16" height="10" fill="#fde68a" /><rect x="32" y="14" width="16" height="7" fill="#bfdbfe" /><rect x="12" y="27" width="36" height="5" fill="#fca5a5" /></svg>);
    case "tower": return (<svg width={s} height={s * 1.5} viewBox="0 0 60 90"><rect x="18" y="30" width="24" height="56" fill="#f3e2c3" stroke="#b9834a" strokeWidth="3" /><rect x="14" y="26" width="32" height="8" fill="#d6b27a" /><polygon points="12,28 30,4 48,28" fill="#ef4444" /><rect x="29" y="0" width="2" height="10" fill="#6b4423" /><polygon points="31,0 44,5 31,10" fill="#fbbf24" /><rect x="25" y="40" width="10" height="14" rx="5" fill="#bfe6ff" /><rect x="25" y="62" width="10" height="24" rx="5" fill="#8a5a2b" /><circle cx="30" cy="22" r="5" fill="#fbbf24" stroke="#b9834a" strokeWidth="2" /></svg>);
    case "clock": return (<svg width={s} height={s * 1.4} viewBox="0 0 60 84"><rect x="20" y="30" width="20" height="52" fill="#f8fafc" stroke="#94a3b8" strokeWidth="3" /><polygon points="16,32 30,8 44,32" fill="#6366f1" /><circle cx="30" cy="46" r="9" fill="#fff" stroke="#475569" strokeWidth="2.5" /><line x1="30" y1="46" x2="30" y2="40" stroke="#475569" strokeWidth="2" /><line x1="30" y1="46" x2="35" y2="46" stroke="#475569" strokeWidth="2" /><rect x="26" y="64" width="8" height="18" rx="4" fill="#8a5a2b" /></svg>);
    case "gate": return (<svg width={s * 1.6} height={s * 1.3} viewBox="0 0 96 78"><rect x="6" y="26" width="22" height="52" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="3" /><rect x="68" y="26" width="22" height="52" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="3" /><rect x="26" y="36" width="44" height="42" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="3" /><path d="M36 78 V58 a12 12 0 0 1 24 0 V78 Z" fill="#6b4423" /><rect x="4" y="18" width="26" height="10" fill="#94a3b8" /><rect x="66" y="18" width="26" height="10" fill="#94a3b8" /><rect x="26" y="28" width="44" height="10" fill="#94a3b8" /><polygon points="17,18 17,6 27,10" fill="#ef4444" /><polygon points="79,18 79,6 89,10" fill="#ef4444" /><circle cx="48" cy="48" r="5" fill="#fbbf24" /></svg>);
    case "wall": return (<svg width={s * 1.5} height={s * 0.8} viewBox="0 0 90 48"><rect x="2" y="16" width="86" height="32" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="3" />{[0, 1, 2, 3, 4].map((i) => <rect key={i} x={6 + i * 17} y="6" width="11" height="12" fill="#94a3b8" />)}<rect x="12" y="26" width="14" height="8" fill="#94a3b8" opacity=".6" /><rect x="46" y="30" width="14" height="8" fill="#94a3b8" opacity=".6" /><rect x="68" y="24" width="12" height="8" fill="#94a3b8" opacity=".6" /></svg>);
    case "observatory": return (<svg width={s * 1.3} height={s * 1.3} viewBox="0 0 78 78"><rect x="18" y="40" width="42" height="36" fill="#f8fafc" stroke="#94a3b8" strokeWidth="3" /><path d="M14 44 a25 25 0 0 1 50 0 Z" fill="#8b5cf6" stroke="#6d28d9" strokeWidth="3" /><rect x="36" y="14" width="6" height="22" fill="#1e293b" transform="rotate(-35 39 25)" /><rect x="34" y="58" width="10" height="18" rx="5" fill="#8a5a2b" /><circle cx="26" cy="54" r="4" fill="#fde68a" /><circle cx="52" cy="54" r="4" fill="#fde68a" /></svg>);
    case "lab": return (<svg width={s * 1.2} height={s * 1.2} viewBox="0 0 72 72"><ellipse cx="36" cy="62" rx="30" ry="8" fill="#c4b5fd" opacity=".6" /><rect x="14" y="34" width="44" height="28" rx="6" fill="#f5f3ff" stroke="#a78bfa" strokeWidth="3" /><path d="M14 36 a22 22 0 0 1 44 0 Z" fill="#c4b5fd" stroke="#a78bfa" strokeWidth="3" /><rect x="33" y="6" width="6" height="12" fill="#a78bfa" /><circle cx="36" cy="6" r="5" fill="#67e8f9"><animate attributeName="opacity" values="1;.3;1" dur="2s" repeatCount="indefinite" /></circle><rect x="22" y="42" width="10" height="10" rx="2" fill="#67e8f9" /><rect x="40" y="42" width="10" height="10" rx="2" fill="#67e8f9" /></svg>);
    case "crystal": return (<svg width={s} height={s * 1.2} viewBox="0 0 60 72"><ellipse cx="30" cy="64" rx="22" ry="6" fill="#c4b5fd" opacity=".6" /><polygon points="30,2 48,24 40,62 20,62 12,24" fill="#c4b5fd" stroke="#8b5cf6" strokeWidth="2.5" /><polygon points="30,2 40,24 36,62 30,62" fill="#ede9fe" opacity=".8" /><polygon points="8,40 16,30 20,62 10,62" fill="#a78bfa" stroke="#8b5cf6" strokeWidth="2" /><polygon points="52,38 46,28 42,62 50,62" fill="#a78bfa" stroke="#8b5cf6" strokeWidth="2" /></svg>);
    case "ring": return (<svg width={s * 1.4} height={s * 0.8} viewBox="0 0 84 48"><ellipse cx="42" cy="30" rx="38" ry="15" fill="#f3e2c3" stroke="#b9834a" strokeWidth="3" /><ellipse cx="42" cy="30" rx="26" ry="9" fill="#e9d5a8" /><rect x="6" y="10" width="3" height="20" fill="#8a5a2b" /><polygon points="9,10 22,14 9,18" fill="#ef4444" /><rect x="74" y="10" width="3" height="20" fill="#8a5a2b" /><polygon points="77,10 64,14 77,18" fill="#3b82f6" /></svg>);
    case "mailbox": return (<svg width={s} height={s} viewBox="0 0 60 60"><rect x="27" y="34" width="6" height="24" fill="#8a5a2b" /><rect x="12" y="14" width="36" height="22" rx="8" fill="#3b82f6" stroke="#1e40af" strokeWidth="3" /><rect x="18" y="20" width="24" height="10" rx="2" fill="#fff" opacity=".9" /><rect x="46" y="8" width="3" height="14" fill="#ef4444" /><polygon points="49,8 58,11 49,14" fill="#ef4444" /></svg>);
    case "desk": return (<svg width={s * 1.2} height={s} viewBox="0 0 72 60"><rect x="8" y="30" width="56" height="8" rx="2" fill="#b9834a" /><rect x="12" y="38" width="6" height="18" fill="#8a5a2b" /><rect x="54" y="38" width="6" height="18" fill="#8a5a2b" /><rect x="16" y="18" width="16" height="12" rx="2" fill="#ef4444" /><rect x="34" y="20" width="14" height="10" rx="2" fill="#3b82f6" /><rect x="50" y="22" width="8" height="8" rx="1" fill="#fbbf24" /></svg>);
    case "stone": return (<svg width={s} height={s} viewBox="0 0 60 60"><path d="M10 52 Q6 30 20 20 Q36 10 50 24 Q58 40 48 52 Z" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="3" /><path d="M20 40 Q30 30 40 40" stroke="#94a3b8" strokeWidth="2" fill="none" /></svg>);
  }
}

/* 木（SVG use）座標は世界座標 */
function treeSeeds(): { x: number; y: number; k: number; s: number }[] {
  // 決定的な疑似乱数で森を配置（ノード付近は避ける）
  let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const zones: { cx: number; cy: number; rx: number; ry: number; n: number; k: number }[] = [
    { cx: 760, cy: 760, rx: 540, ry: 150, n: 46, k: 2 },  // think forest
    { cx: 420, cy: 1100, rx: 300, ry: 120, n: 14, k: 0 }, // comm
    { cx: 1000, cy: 1180, rx: 260, ry: 60, n: 8, k: 0 },
    { cx: 1520, cy: 1180, rx: 420, ry: 60, n: 10, k: 1 }, // sales edge
    { cx: 1480, cy: 600, rx: 340, ry: 90, n: 16, k: 3 },  // mgmt low
    { cx: 1700, cy: 430, rx: 260, ry: 80, n: 8, k: 3 },
    { cx: 560, cy: 960, rx: 200, ry: 70, n: 10, k: 2 },   // think-comm bridge
    { cx: 1260, cy: 660, rx: 150, ry: 60, n: 8, k: 2 },
  ];
  const nodes = Object.values(NODE_POS).concat(Object.values(JOB_POS), [START]);
  const out: { x: number; y: number; k: number; s: number }[] = [];
  zones.forEach((z) => {
    for (let i = 0; i < z.n; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
      const x = z.cx + Math.cos(a) * z.rx * r, y = z.cy + Math.sin(a) * z.ry * r;
      if (nodes.some((p) => Math.hypot(p.x - x, p.y - y) < 60)) continue;
      out.push({ x, y, k: z.k, s: 0.75 + rnd() * 0.6 });
    }
  });
  return out.sort((a, b) => a.y - b.y);
}

export default function SkillWorld({ res, avatarId, selectedId, onSelect, focusTo, focus, locNodeId, walk, onWalkEnd }: {
  res: EvalResult; avatarId: string | null; selectedId: string | null; onSelect: (n: NodeState | null) => void; focusTo?: { key: number; target: Pt };
  focus: Focus; locNodeId: string | null; walk: Walk | null; onWalkEnd?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState<Cam>({ x: 0, y: 0, s: 1 });
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  const pinch = useRef<{ d: number; s: number } | null>(null);
  const [vp, setVp] = useState({ w: 1200, h: 800 });
  const trees = useMemo(treeSeeds, []);

  const byId = new Map(res.nodes.map((n) => [n.id, n]));
  const unlockedByCat: Record<string, number> = {};
  res.nodes.forEach((n) => { if (n.status === "unlocked") unlockedByCat[n.category] = (unlockedByCat[n.category] ?? 0) + 1; });
  const explored = (c: string) => (unlockedByCat[c] ?? 0) > 0;

  const homePos: Pt = locNodeId && NODE_POS[locNodeId] ? NODE_POS[locNodeId] : START;
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
  const facingLeft = nextPos ? nextPos.x < homePos.x : false;

  function clamp(c: Cam): Cam { const minX = vp.w - WORLD_W * c.s, minY = vp.h - WORLD_H * c.s; return { s: c.s, x: Math.min(0, Math.max(minX, c.x)), y: Math.min(0, Math.max(minY, c.y)) }; }
  function centerOn(p: Pt, s?: number) { const sc = s ?? cam.s; setCam(clamp({ s: sc, x: vp.w / 2 - p.x * sc, y: vp.h / 2 - p.y * sc })); }
  useEffect(() => { const el = wrapRef.current; if (!el) return; const ro = new ResizeObserver(() => setVp({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el); setVp({ w: el.clientWidth, h: el.clientHeight }); return () => ro.disconnect(); }, []);
  useEffect(() => {
    const s = vp.w < 640 ? 1.25 : Math.min(1.5, Math.max(1.15, vp.w / 1150));
    const k = vp.w < 640 ? 0.88 : 0.65;
    const t = nextPos ? { x: homePos.x * k + nextPos.x * (1 - k), y: homePos.y * k + nextPos.y * (1 - k) } : homePos;
    setCam(clamp({ s, x: vp.w / 2 - t.x * s, y: vp.h / 2 - t.y * s + 30 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp.w, vp.h]);
  useEffect(() => { if (focusTo) centerOn(focusTo.target); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTo?.key]);
  const minS = Math.max(0.42, Math.max(vp.w / WORLD_W, vp.h / WORLD_H));
  function onPointerDown(e: React.PointerEvent) { if (pinch.current) return; drag.current = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }
  function onPointerMove(e: React.PointerEvent) { if (!drag.current) return; const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true; setCam(clamp({ s: cam.s, x: drag.current.cx + dx, y: drag.current.cy + dy })); }
  function onPointerUp() { setTimeout(() => { drag.current = null; }, 0); }
  function zoomAt(ns: number, mx: number, my: number) { const wx = (mx - cam.x) / cam.s, wy = (my - cam.y) / cam.s; setCam(clamp({ s: ns, x: mx - wx * ns, y: my - wy * ns })); }
  function onWheel(e: React.WheelEvent) { const ns = Math.min(2.2, Math.max(minS, cam.s * (e.deltaY > 0 ? 0.9 : 1.1))); const r = wrapRef.current!.getBoundingClientRect(); zoomAt(ns, e.clientX - r.left, e.clientY - r.top); }
  function onTouchStart(e: React.TouchEvent) { if (e.touches.length === 2) { pinch.current = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), s: cam.s }; drag.current = null; } }
  function onTouchMove(e: React.TouchEvent) { if (e.touches.length === 2 && pinch.current) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); const ns = Math.min(2.2, Math.max(minS, pinch.current.s * (d / pinch.current.d))); const r = wrapRef.current!.getBoundingClientRect(); zoomAt(ns, (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top); } }
  function onTouchEnd(e: React.TouchEvent) { if (e.touches.length < 2) pinch.current = null; }
  function clickNode(n: NodeState) { if (drag.current?.moved) return; onSelect(n); }

  /* ---------------- 道 ---------------- */
  const ROAD_STYLE: Record<string, { base: string; top: string; dash?: string; w: number }> = {
    comm: { base: "#b98a5a", top: "#e9c99a", dash: "8 10", w: 26 },
    sales: { base: "#9a9a9a", top: "#d9d4c8", dash: "3 7", w: 28 },
    think: { base: "#8a6a48", top: "#d6b48a", dash: "10 12", w: 24 },
    mgmt: { base: "#8c8c8c", top: "#e5e7eb", dash: "6 6", w: 26 },
    ai: { base: "#a78bfa", top: "#e9d5ff", dash: "14 10", w: 14 },
  };
  const roadEls: React.ReactNode[] = [];
  const wavy = (a: Pt, b: Pt, i: number) => { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; const off = (i % 2 ? -1 : 1) * 34; return `M ${a.x} ${a.y} Q ${mx} ${my + off} ${b.x} ${b.y}`; };
  ["comm", "sales", "think", "mgmt", "ai"].forEach((c) => {
    const st = ROAD_STYLE[c];
    const ns = res.nodes.filter((n) => n.category === c).sort((a, b) => a.order_no - b.order_no);
    for (let i = 0; i < ns.length - 1; i++) {
      const a = NODE_POS[ns[i].id], b = NODE_POS[ns[i + 1].id]; if (!a || !b) continue;
      const lit = ns[i].status === "unlocked"; const ex = explored(c) || i < 1; const d = wavy(a, b, i);
      if (c === "ai") {
        roadEls.push(<path key={`a${i}`} d={d} fill="none" stroke={lit ? "#fde68a" : "#c4b5fd"} strokeWidth={lit ? 10 : 7} strokeLinecap="round" strokeDasharray="16 12" opacity={ex ? 0.95 : 0.5} style={{ filter: `drop-shadow(0 0 8px ${lit ? "#fbbf24" : "#a78bfa"})` }} />);
        continue;
      }
      roadEls.push(<path key={`b${c}${i}`} d={d} fill="none" stroke={st.base} strokeWidth={st.w} strokeLinecap="round" opacity={ex ? 0.95 : 0.55} />);
      roadEls.push(<path key={`t${c}${i}`} d={d} fill="none" stroke={lit ? "#fde68a" : st.top} strokeWidth={st.w - 10} strokeLinecap="round" opacity={ex ? 1 : 0.6} style={lit ? { filter: "drop-shadow(0 0 8px rgba(251,191,36,.8))" } : undefined} />);
      if (st.dash) roadEls.push(<path key={`d${c}${i}`} d={d} fill="none" stroke={lit ? "#f59e0b" : st.base} strokeWidth={c === "sales" ? 4 : 3} strokeDasharray={st.dash} strokeLinecap="round" opacity={0.6} />);
    }
  });
  ROADS.forEach((r, i) => {
    const a = pt(r.from), b = pt(r.to); const lit = r.from === "START" || byId.get(r.from)?.status === "unlocked";
    const d = curve(a, b, r.via); const air = r.to.startsWith("ai");
    if (air) { roadEls.push(<path key={`l${i}`} d={d} fill="none" stroke="#c4b5fd" strokeWidth={6} strokeDasharray="4 16" strokeLinecap="round" opacity={0.7} />); return; }
    roadEls.push(<path key={`l${i}`} d={d} fill="none" stroke="#b98a5a" strokeWidth={20} strokeLinecap="round" opacity={0.85} />);
    roadEls.push(<path key={`lt${i}`} d={d} fill="none" stroke={lit ? "#fde68a" : "#e9c99a"} strokeWidth={12} strokeLinecap="round" opacity={0.95} />);
  });
  res.jobs.forEach((j) => {
    const jp = JOB_POS[j.id]; if (!jp) return;
    j.requires.forEach((rid) => { const a = NODE_POS[rid]; if (!a) return; const lit = byId.get(rid)?.status === "unlocked";
      roadEls.push(<path key={`j${j.id}${rid}`} d={curve(a, jp)} fill="none" stroke={lit ? "#fbbf24" : "#fde68a"} strokeWidth={lit ? 5 : 2.5} strokeDasharray={lit ? undefined : "4 10"} strokeLinecap="round" opacity={lit ? 0.95 : j.is_obtainable ? 0.45 : 0.2} style={lit ? { filter: "drop-shadow(0 0 6px rgba(251,191,36,.9))" } : undefined} />); });
  });

  /* 足跡（CURRENT QUEST へ） */
  const steps: { x: number; y: number; r: number }[] = [];
  if (nextPos && currentNode) {
    const a = homePos, b = nextPos, c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 30 };
    const n = Math.max(4, Math.min(14, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 48)));
    for (let i = 1; i < n; i++) { const t = i / n; const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y; const dx = 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x), dy = 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y); steps.push({ x, y, r: (Math.atan2(dy, dx) * 180) / Math.PI + 90 }); }
  }

  const sky = "linear-gradient(180deg,#79c6ff 0%,#aee0ff 40%,#dff3ff 100%)";
  const Z = (k: string) => AREA_COLOR[k];

  return (
    <div ref={wrapRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      style={{ position: "absolute", inset: 0, overflow: "hidden", cursor: drag.current ? "grabbing" : "grab", touchAction: "none", background: sky, userSelect: "none", fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif' }}>

      {/* 遠景（パララックス） */}
      <div style={{ position: "absolute", left: 0, top: 0, width: WORLD_W, height: WORLD_H, transform: `translate(${cam.x * 0.3}px,${cam.y * 0.3}px)`, pointerEvents: "none" }}>
        <svg width={WORLD_W} height={WORLD_H} style={{ position: "absolute", left: 0, top: 0 }}>
          <defs><linearGradient id="mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dbe9f5" /><stop offset="1" stopColor="#a9c6e0" /></linearGradient></defs>
          <path d="M 1100 520 L 1320 230 L 1420 330 L 1560 150 L 1700 300 L 1820 120 L 1960 310 L 2100 220 L 2100 620 L 1100 620 Z" fill="url(#mt)" opacity=".9" />
          <path d="M 1560 150 L 1500 250 L 1620 250 Z M 1820 120 L 1760 220 L 1880 220 Z" fill="#fff" opacity=".8" />
          <path d="M -50 500 L 120 330 L 260 440 L 420 300 L 600 470 L 760 380 L 900 520 L -50 560 Z" fill="url(#mt)" opacity=".75" />
        </svg>
        {[{ x: 1560, y: 60, w: 200 }, { x: 60, y: 480, w: 150 }, { x: 1720, y: 1280, w: 180 }].map((f, i) => (
          <div key={i} style={{ position: "absolute", left: f.x, top: f.y, width: f.w, height: f.w * 0.4, animation: `swFloat ${6 + i}s ease-in-out infinite alternate`, opacity: 0.7 }}>
            <div style={{ position: "absolute", left: "8%", right: "8%", top: "40%", bottom: -6, borderRadius: "10% 10% 50% 50% / 20% 20% 100% 100%", background: "linear-gradient(180deg,#a89a8a,#6b5a4a)" }} />
            <div style={{ position: "absolute", inset: "0 0 45% 0", borderRadius: "50%", background: "radial-gradient(ellipse at 50% 40%, #cfeeb5, #8ecb8c)" }} />
          </div>
        ))}
        <div style={{ position: "absolute", left: 420, top: 120, fontSize: 46, animation: "swBalloon 16s ease-in-out infinite alternate", filter: "drop-shadow(0 6px 6px rgba(0,0,0,.15))" }}>🎈</div>
        {[0, 1].map((i) => <div key={i} style={{ position: "absolute", left: 0, top: 160 + i * 320, fontSize: 15, animation: `swBird ${45 + i * 15}s linear infinite`, animationDelay: `${-i * 12}s`, opacity: 0.8 }}>🕊️</div>)}
      </div>
      {[0, 1].map((i) => (<div key={i} style={{ position: "absolute", top: `${12 + i * 42}%`, left: 0, width: 170, height: 46, background: "rgba(255,255,255,.85)", borderRadius: 999, filter: "blur(2px)", animation: `swCloud ${90 + i * 30}s linear infinite`, animationDelay: `${-i * 30}s`, pointerEvents: "none", boxShadow: "40px -18px 0 -4px rgba(255,255,255,.8), 80px 0 0 -2px rgba(255,255,255,.85)", opacity: 0.55, zIndex: 0 }} />))}

      {/* ===== ワールド ===== */}
      <div style={{ position: "absolute", left: 0, top: 0, width: WORLD_W, height: WORLD_H, transform: `translate(${cam.x}px,${cam.y}px) scale(${cam.s})`, transformOrigin: "0 0", willChange: "transform", zIndex: 1 }}>

        {/* ---------- 地形 SVG ---------- */}
        <svg width={WORLD_W} height={WORLD_H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
          <defs>
            <radialGradient id="grass" cx="45%" cy="35%" r="75%"><stop offset="0" stopColor="#c9f3a8" /><stop offset=".6" stopColor="#8fd47a" /><stop offset="1" stopColor="#5fb56a" /></radialGradient>
            <linearGradient id="cliff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9c7b55" /><stop offset="1" stopColor="#4a3626" /></linearGradient>
            <radialGradient id="sand" cx="50%" cy="40%" r="70%"><stop offset="0" stopColor="#f7e9cf" /><stop offset="1" stopColor="#e5cfa5" /></radialGradient>
            <radialGradient id="high" cx="50%" cy="40%" r="70%"><stop offset="0" stopColor="#e6f6d6" /><stop offset="1" stopColor="#a9d49a" /></radialGradient>
            <radialGradient id="forest" cx="50%" cy="45%" r="70%"><stop offset="0" stopColor="#a6e29a" /><stop offset="1" stopColor="#6fbf72" /></radialGradient>
            <radialGradient id="lake" cx="50%" cy="35%" r="70%"><stop offset="0" stopColor="#d8f1ff" /><stop offset="1" stopColor="#5fb0f0" /></radialGradient>
            <pattern id="cobble" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="5" fill="#d8ccb4" /><circle cx="0" cy="0" r="5" fill="#d8ccb4" /><circle cx="16" cy="16" r="5" fill="#d8ccb4" /></pattern>
            <pattern id="flowers" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="8" cy="10" r="3" fill="#f472b6" /><circle cx="26" cy="22" r="2.5" fill="#fbbf24" /><circle cx="14" cy="32" r="2.5" fill="#fff" /><circle cx="34" cy="6" r="2" fill="#f472b6" /></pattern>
            <filter id="soft"><feGaussianBlur stdDeviation="6" /></filter>
            <filter id="cloudf"><feGaussianBlur stdDeviation="9" /></filter>
            <symbol id="tree0" viewBox="0 0 40 50"><rect x="17" y="34" width="6" height="16" rx="2" fill="#8a5a2b" /><circle cx="20" cy="22" r="16" fill="#86d36f" /><circle cx="13" cy="26" r="10" fill="#6fc45f" /><circle cx="26" cy="18" r="9" fill="#a3e58a" /></symbol>
            <symbol id="tree1" viewBox="0 0 40 50"><rect x="17" y="34" width="6" height="16" rx="2" fill="#8a5a2b" /><circle cx="20" cy="22" r="16" fill="#f9a8d4" /><circle cx="12" cy="26" r="10" fill="#f472b6" /><circle cx="27" cy="18" r="9" fill="#fbcfe8" /></symbol>
            <symbol id="tree2" viewBox="0 0 40 50"><rect x="17" y="36" width="6" height="14" rx="2" fill="#6b4423" /><polygon points="20,2 36,26 4,26" fill="#3f9a5a" /><polygon points="20,12 38,38 2,38" fill="#4caf50" /></symbol>
            <symbol id="tree3" viewBox="0 0 40 50"><rect x="17" y="34" width="6" height="16" rx="2" fill="#8a5a2b" /><circle cx="20" cy="22" r="15" fill="#5aa66b" /><circle cx="12" cy="26" r="9" fill="#4a9560" /></symbol>
            <clipPath id="clipSales"><ellipse cx="1500" cy="1095" rx="500" ry="150" /></clipPath>
            <clipPath id="clipComm"><ellipse cx="680" cy="1095" rx="540" ry="150" /></clipPath>
          </defs>

          {/* 山（MGMT奥）＋MANAGERの峰 */}
          <path d="M 1150 560 L 1350 300 L 1470 400 L 1620 220 L 1760 360 L 1880 180 L 2000 360 L 2000 640 L 1150 640 Z" fill="#bcd3e6" />
          <path d="M 1620 220 L 1560 320 L 1690 320 Z M 1880 180 L 1820 280 L 1940 280 Z" fill="#f1f6fb" />
          <ellipse cx="1880" cy="360" rx="130" ry="36" fill="#cfe0ee" />

          {/* 大陸：崖（下側） */}
          <g fill="url(#cliff)">
            {[[680, 1140, 560, 170], [1500, 1140, 520, 170], [800, 820, 560, 180], [560, 985, 230, 120], [1450, 600, 430, 160], [1600, 510, 380, 140], [1750, 440, 300, 120], [1240, 690, 210, 120], [1700, 830, 230, 120], [1900, 970, 190, 120], [160, 1225, 120, 60], [1250, 800, 270, 130], [1450, 920, 340, 130], [1800, 940, 240, 120], [1100, 970, 230, 110], [1150, 740, 270, 120], [1350, 760, 230, 110]].map(([cx, cy, rx, ry], i) => <ellipse key={i} cx={cx} cy={cy + 10} rx={rx} ry={ry} />)}
          </g>
          <ellipse cx="1060" cy="1330" rx="1000" ry="60" fill="#000" opacity=".12" filter="url(#soft)" />
          {/* 大陸：地面 */}
          <g fill="url(#grass)">
            {[[680, 1095, 560, 165], [1500, 1095, 520, 165], [800, 780, 560, 175], [560, 940, 230, 120], [1450, 560, 430, 150], [1600, 470, 380, 130], [1750, 400, 300, 110], [1240, 640, 210, 110], [1700, 790, 230, 110], [1900, 930, 190, 110], [160, 1180, 120, 60], [1250, 760, 270, 120], [1450, 880, 340, 120], [1800, 900, 240, 110], [1100, 930, 230, 100], [1150, 700, 270, 110], [1350, 720, 230, 100]].map(([cx, cy, rx, ry], i) => <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} />)}
          </g>
          {/* 段丘（MGMT：右上へ登る） */}
          <ellipse cx="1600" cy="470" rx="380" ry="130" fill="url(#high)" opacity=".9" />
          <ellipse cx="1600" cy="470" rx="380" ry="130" fill="none" stroke="#fff" strokeWidth="4" opacity=".5" />
          <ellipse cx="1760" cy="400" rx="290" ry="105" fill="url(#high)" />
          <ellipse cx="1760" cy="400" rx="290" ry="105" fill="none" stroke="#fff" strokeWidth="4" opacity=".6" />
          {/* 石段 */}
          {[0, 1, 2, 3].map((i) => <rect key={i} x={1310 + i * 16} y={560 - i * 14} width="34" height="8" rx="2" fill="#e5e7eb" stroke="#94a3b8" strokeWidth="1.5" />)}
          {[0, 1, 2, 3].map((i) => <rect key={"s" + i} x={1530 + i * 16} y={445 - i * 12} width="34" height="8" rx="2" fill="#e5e7eb" stroke="#94a3b8" strokeWidth="1.5" />)}
          {/* 森（THINKING）地面色 */}
          <ellipse cx="800" cy="780" rx="540" ry="160" fill="url(#forest)" opacity=".85" />
          {/* 花畑（COMM） */}
          <ellipse cx="680" cy="1095" rx="520" ry="140" fill="url(#flowers)" opacity=".55" clipPath="url(#clipComm)" />
          {/* 石畳の街（SALES） */}
          <g clipPath="url(#clipSales)">
            <ellipse cx="1500" cy="1095" rx="500" ry="150" fill="url(#sand)" />
            <ellipse cx="1500" cy="1095" rx="480" ry="135" fill="url(#cobble)" opacity=".7" />
            <ellipse cx="1520" cy="1150" rx="120" ry="40" fill="#f3e6c8" stroke="#d6c39a" strokeWidth="4" />
          </g>
          {/* 湖・川 */}
          <path d="M 930 880 C 960 930, 1060 950, 1110 1010 C 1140 1050, 1120 1150, 1135 1260 C 1140 1300, 1120 1330, 1100 1340" fill="none" stroke="#4f9ee0" strokeWidth="30" strokeLinecap="round" opacity=".9" />
          <path d="M 930 880 C 960 930, 1060 950, 1110 1010 C 1140 1050, 1120 1150, 1135 1260 C 1140 1300, 1120 1330, 1100 1340" fill="none" stroke="#9ed7f7" strokeWidth="20" strokeLinecap="round" />
          <path d="M 930 880 C 960 930, 1060 950, 1110 1010 C 1140 1050, 1120 1150, 1135 1260" fill="none" stroke="#e0f4ff" strokeWidth="5" strokeDasharray="26 34" strokeLinecap="round" opacity=".9" style={{ animation: "swFlow 3s linear infinite" }} />
          <ellipse cx="930" cy="870" rx="120" ry="52" fill="url(#lake)" stroke="#fff" strokeWidth="5" opacity=".95" />
          <path d="M 300 1010 C 420 990, 560 1020, 700 995" fill="none" stroke="#9ed7f7" strokeWidth="14" strokeLinecap="round" opacity=".9" />
          {/* 滝 */}
          <rect x="1088" y="1300" width="30" height="80" rx="8" fill="#cfeeff" opacity=".9" />
          {/* 橋（comm→sales の川越え） */}
          <rect x="1086" y="1056" width="60" height="22" rx="4" fill="#c48a4b" stroke="#8a5a2b" strokeWidth="3" />
          {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={1092 + i * 12} y1="1056" x2={1092 + i * 12} y2="1078" stroke="#8a5a2b" strokeWidth="2" />)}
          {/* 柵（COMM） */}
          <path d="M 240 1215 H 1100" stroke="#c48a4b" strokeWidth="4" />
          {[...Array(30)].map((_, i) => <rect key={i} x={244 + i * 29} y="1206" width="5" height="18" fill="#c48a4b" />)}
          {/* 城壁（MGMT 上段） */}
          <path d="M 1500 335 H 1990" stroke="#cbd5e1" strokeWidth="14" />
          {[...Array(18)].map((_, i) => <rect key={i} x={1504 + i * 28} y="318" width="14" height="12" fill="#e5e7eb" stroke="#94a3b8" strokeWidth="1.5" />)}

          {/* 道 */}
          {roadEls}
          {/* CURRENT QUEST ルート */}
          {nextPos && currentNode && <path d={curve(homePos, nextPos)} fill="none" stroke="#fbbf24" strokeWidth={14} strokeLinecap="round" opacity={0.5} style={{ filter: "drop-shadow(0 0 10px rgba(251,191,36,.9))" }} />}
          {steps.map((s, i) => <text key={i} x={s.x} y={s.y} fontSize="16" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${s.r} ${s.x} ${s.y})`} style={{ animation: "swStep 2.4s ease-in-out infinite", animationDelay: `${i * 0.18}s` }}>👣</text>)}

          {/* 木 */}
          {trees.map((t, i) => <use key={i} href={`#tree${t.k}`} x={t.x - 16 * t.s} y={t.y - 40 * t.s} width={32 * t.s} height={40 * t.s} style={{ transformOrigin: `${t.x}px ${t.y}px`, animation: `swSway ${3 + (i % 5)}s ease-in-out infinite alternate` }} />)}

          {/* 未探索：雲（矩形なし） */}
          {AREAS.filter((a) => !explored(a.key) && a.key !== "ai").map((a) => [0, 1, 2].map((i) => (
            <ellipse key={a.key + i} cx={a.x + a.w * (0.55 + i * 0.16)} cy={a.y + a.h * (0.25 + (i % 2) * 0.45)} rx={120 + i * 20} ry={46} fill="#fff" opacity=".8" filter="url(#cloudf)" />
          )))}
          {!explored("ai") && [0, 1, 2].map((i) => <ellipse key={"ai" + i} cx={600 + i * 170} cy={300 - (i % 2) * 40} rx={120} ry={44} fill="#fff" opacity=".85" filter="url(#cloudf)" />)}
        </svg>

        {/* ---------- AI 浮遊島（ノードごと） ---------- */}
        {res.nodes.filter((n) => n.category === "ai").map((n, i) => {
          const p = NODE_POS[n.id]; const w = n.kind === "key" ? 200 : 130 + i * 8; const hid = n.is_hidden && n.status === "locked";
          return (<div key={n.id} style={{ position: "absolute", left: p.x - w / 2, top: p.y - 24, width: w, height: 64, animation: `swFloat ${4 + i * 0.6}s ease-in-out infinite alternate`, opacity: hid ? 0.55 : 1, filter: hid ? "blur(2px)" : "none" }}>
            <div style={{ position: "absolute", left: "14%", right: "14%", bottom: -26, height: 52, borderRadius: "10% 10% 50% 50% / 20% 20% 100% 100%", background: "linear-gradient(180deg,#8b7fc4,#4c3f8a)" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse at 50% 40%, #f3f0ff, #c4b5fd 60%, #a5b4fc)", boxShadow: "inset 0 5px 8px rgba(255,255,255,.7), 0 0 26px rgba(167,139,250,.55)" }} />
            <div style={{ position: "absolute", left: "50%", top: "50%", width: w * 1.25, height: w * 0.5, marginLeft: -w * 0.625, marginTop: -w * 0.25, borderRadius: "50%", border: "2px solid rgba(103,232,249,.5)", animation: `swSpin ${10 + i * 2}s linear infinite` }} />
          </div>);
        })}

        {/* ---------- START 村 ---------- */}
        <div style={{ position: "absolute", left: START.x - 90, top: START.y - 90, width: 180, zIndex: 8, pointerEvents: "none" }}>
          <img src="/island/house/1_cabin.png" alt="" style={{ position: "absolute", left: 40, top: 0, width: 70, filter: "drop-shadow(0 6px 6px rgba(0,0,0,.25))" }} />
          <div style={{ position: "absolute", left: 6, top: 30 }}><LmSvg kind="sign" color="#16a34a" size={44} /></div>
          <div style={{ position: "absolute", left: 124, top: 66, width: 64, height: 10, background: "repeating-linear-gradient(90deg,#c48a4b 0 8px,#a8713a 8px 10px)", borderRadius: 3, transform: "rotate(10deg)" }} />
          <div style={{ position: "absolute", left: 176, top: 60, fontSize: 24 }}>⛵</div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 86, textAlign: "center" }}>
            <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 10, background: "linear-gradient(180deg,#fff,#fdf6e3)", border: "2px solid #16a34a", fontSize: 12, fontWeight: 900, color: "#166534", boxShadow: "0 2px 6px rgba(0,0,0,.15)" }}>🌱 START</span>
            <div style={{ fontSize: 10, color: "#166534", fontWeight: 800, marginTop: 2, textShadow: "0 0 4px #fff" }}>冒険のはじまり</div>
          </div>
        </div>

        {/* 生活感：犬・猫・蝶・煙 */}
        <img src="/island/animals/dog.png" alt="" style={{ position: "absolute", left: 560, top: 1150, width: 30, animation: "swBob 3s ease-in-out infinite" }} />
        <img src="/island/animals/cat.png" alt="" style={{ position: "absolute", left: 1380, top: 1160, width: 28 }} />
        <div style={{ position: "absolute", left: 500, top: 1040, fontSize: 16, animation: "swButterfly 7s ease-in-out infinite alternate" }}>🦋</div>
        <div style={{ position: "absolute", left: 860, top: 1060, fontSize: 14, animation: "swButterfly 9s ease-in-out infinite alternate-reverse" }}>🦋</div>
        <img src="/island/trees/tree_sakura.png" alt="" style={{ position: "absolute", left: 250, top: 1000, width: 70, filter: "drop-shadow(0 4px 4px rgba(0,0,0,.2))" }} />
        <img src="/island/trees/tree_sakura.png" alt="" style={{ position: "absolute", left: 1000, top: 1120, width: 56, filter: "drop-shadow(0 4px 4px rgba(0,0,0,.2))" }} />
        <div style={{ position: "absolute", left: 1296, top: 1060, fontSize: 18 }}>🪔</div>
        <div style={{ position: "absolute", left: 1668, top: 1070, fontSize: 18 }}>🪔</div>
        <div style={{ position: "absolute", left: 1392, top: 1090, fontSize: 20 }}>🛒</div>

        {/* 地域看板 */}
        {AREAS.map((a) => (
          <div key={a.key} style={{ position: "absolute", left: a.sign.x, top: a.sign.y - (a.key === "ai" ? 70 : 60), padding: "5px 14px", borderRadius: 12, background: "linear-gradient(180deg,#fff,#fdf6e3)", border: `2px solid ${Z(a.key)}`, fontSize: 12, fontWeight: 900, letterSpacing: 1, color: Z(a.key), boxShadow: "0 4px 10px rgba(0,0,0,.15)", whiteSpace: "nowrap", zIndex: 6 }}>{a.emoji} {a.label}</div>
        ))}

        {/* ---------- スキルノード（ランドマーク） ---------- */}
        {res.nodes.map((n) => {
          const p = NODE_POS[n.id]; if (!p) return null;
          const color = Z(n.category);
          const ex = explored(n.category) || n.order_no <= 2;
          const fog = (n.is_hidden && n.status === "locked") || (!ex && n.status === "locked");
          const u = n.status === "unlocked", a = n.status === "available";
          const key = n.kind === "key"; const w = key ? 130 : 100; const sel = selectedId === n.id;
          const lm = LANDMARK[n.id] ?? {}; const isCur = focus.current === n.id, isSub = focus.subs.includes(n.id);
          const lmH = key ? 96 : 70;
          const filt = fog ? "grayscale(1) brightness(.55) opacity(.45) blur(1px)" : u ? `drop-shadow(0 0 12px ${color}) drop-shadow(0 6px 5px rgba(0,0,0,.25))` : a ? "drop-shadow(0 6px 5px rgba(0,0,0,.25))" : "saturate(.3) opacity(.8) drop-shadow(0 4px 4px rgba(0,0,0,.2))";
          return (
            <div key={n.id} onClick={() => clickNode(n)} style={{ position: "absolute", left: p.x - w / 2, top: p.y - lmH - 18, width: w, cursor: "pointer", zIndex: sel ? 20 : isCur ? 12 : 10, transition: "transform .2s", transform: sel ? "scale(1.1)" : "none", textAlign: "center" }}>
              {/* CURRENT QUEST：光柱・リング・キラキラ */}
              {isCur && <>
                <div style={{ position: "absolute", left: "50%", bottom: 8, width: 70, height: 240, marginLeft: -35, background: "linear-gradient(180deg, rgba(251,191,36,0) 0%, rgba(251,191,36,.35) 60%, rgba(251,191,36,.6) 100%)", filter: "blur(6px)", pointerEvents: "none", animation: "swGlow 2s ease-in-out infinite alternate" }} />
                <div style={{ position: "absolute", left: "50%", bottom: 6, width: w + 40, height: 30, marginLeft: -(w + 40) / 2, borderRadius: "50%", border: "4px solid #fbbf24", boxShadow: "0 0 18px #fbbf24, inset 0 0 18px rgba(251,191,36,.6)", pointerEvents: "none", animation: "swPulse 2s ease-in-out infinite" }} />
                {[0, 1, 2, 3].map((i) => <div key={i} style={{ position: "absolute", left: 8 + i * 28, top: -10 + (i % 2) * 30, fontSize: 12, animation: `swTwinkle ${1 + i * 0.3}s ease-in-out infinite alternate` }}>✨</div>)}
                <div style={{ position: "absolute", top: -62, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 900, letterSpacing: 1, color: "#92400e", background: "#fde68a", borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap", zIndex: 3 }}>CURRENT QUEST</div>
              </>}
              {(isCur || isSub) && <div style={{ position: "absolute", top: -44, left: "50%", transform: "translateX(-50%)", fontSize: isCur ? 28 : 18, zIndex: 3, animation: "swBounce 1.4s ease-in-out infinite", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.3))" }}>🎯</div>}
              {a && !fog && !isCur && <div style={{ position: "absolute", top: -30, left: "50%", transform: "translateX(-50%)", fontSize: 20, fontWeight: 900, color: "#ef4444", animation: "swBounce 1s ease-in-out infinite", textShadow: "0 0 6px #fff, 0 0 2px #fff" }}>！</div>}
              {u && <div style={{ position: "absolute", top: -6, right: 4, fontSize: 18, zIndex: 2, animation: "swFlag 1s ease-in-out infinite alternate" }}>🚩</div>}
              {/* 足元 */}
              <div style={{ position: "absolute", left: "12%", right: "12%", bottom: 10, height: key ? 28 : 20, borderRadius: "50%", background: u ? `radial-gradient(ellipse, ${color}99, ${color}11)` : a ? `radial-gradient(ellipse, ${color}55, transparent 70%)` : "rgba(60,60,80,.18)", filter: "blur(2px)", animation: a && !fog && !isCur ? "swPulse 2s ease-in-out infinite" : undefined }} />
              {/* ランドマーク本体 */}
              <div style={{ position: "relative", height: lmH, display: "flex", alignItems: "flex-end", justifyContent: "center", filter: filt }}>
                {fog ? <div style={{ fontSize: 40 }}>☁️</div> : lm.img ? <img src={lm.img} alt="" style={{ width: (lm.w ?? 70) * (key ? 1.15 : 1), display: "block" }} /> : lm.svg ? <LmSvg kind={lm.svg} color={color} size={key ? 64 : 48} /> : <div style={{ fontSize: 40 }}>{n.icon}</div>}
                {!fog && (lm.badge || !lm.img) && <span style={{ position: "absolute", right: 4, top: 6, width: 24, height: 24, borderRadius: 12, background: u ? color : "#fff", border: `2px solid ${u ? "#fff" : color}`, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 5px rgba(0,0,0,.2)" }}>{lm.badge ?? n.icon}</span>}
              </div>
              <div style={{ marginTop: 4, whiteSpace: "nowrap" }}>
                <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 10, background: u ? color : fog ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.95)", color: u ? "#fff" : fog ? "#94a3b8" : "#1e293b", fontSize: key ? 12.5 : 11.5, fontWeight: 900, boxShadow: "0 2px 6px rgba(0,0,0,.18)", border: key && !u ? `2px solid ${color}` : "2px solid rgba(255,255,255,.9)" }}>{fog ? "？？？" : n.name}</span>
              </div>
            </div>
          );
        })}

        {/* ---------- JOB ランドマーク ---------- */}
        {res.jobs.map((j: JobState) => {
          const p = JOB_POS[j.id]; if (!p) return null;
          const haze = !j.is_obtainable && !j.unlocked;
          const done = j.requires.length - j.missing.length; const ratio = j.requires.length ? done / j.requires.length : 0;
          const label = (<div style={{ textAlign: "center", position: "relative", zIndex: 2 }}>
            <div style={{ display: "inline-block", padding: "6px 18px", borderRadius: 14, background: j.unlocked ? "linear-gradient(135deg,#fbbf24,#f59e0b)" : "linear-gradient(180deg,#fff,#fdf6e3)", border: "3px solid #fbbf24", color: j.unlocked ? "#fff" : "#92400e", fontSize: 16, fontWeight: 900, letterSpacing: 2, boxShadow: "0 4px 14px rgba(0,0,0,.18)" }}>{haze ? "？？？" : `${j.icon} ${j.name}`}</div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#92400e", marginTop: 4, textShadow: "0 0 4px #fff" }}>{j.unlocked ? "👑 到達！" : haze ? "山頂に巨大な城が見える…" : `${done} / ${j.requires.length} skills`}</div>
          </div>);
          if (j.id === "mentor") return (
            <div key={j.id} style={{ position: "absolute", left: p.x - 120, top: p.y - 190, width: 240, textAlign: "center", zIndex: 9 }}>
              <div style={{ position: "absolute", left: "15%", right: "15%", bottom: 40, height: 36, borderRadius: "50%", background: j.unlocked ? "rgba(251,191,36,.6)" : "rgba(60,60,80,.25)", filter: "blur(12px)" }} />
              <div style={{ position: "relative", display: "inline-block", filter: j.unlocked ? "drop-shadow(0 0 28px #fbbf24)" : "drop-shadow(0 10px 10px rgba(0,0,0,.25))" }}>
                <img src="/island/house/4_mansion.png" alt="" style={{ width: 190, display: "block" }} />
                {/* 灯り：取得数に応じて点灯 */}
                {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} style={{ position: "absolute", left: 30 + (i % 3) * 56, top: 66 + Math.floor(i / 3) * 44, width: 14, height: 18, borderRadius: 4, background: i < done ? "#fde68a" : "transparent", boxShadow: i < done ? "0 0 12px #fbbf24" : "none" }} />)}
                <div style={{ position: "absolute", left: "50%", top: -26, transform: "translateX(-50%)", fontSize: 26 }}>🧭</div>
              </div>
              {label}
            </div>
          );
          if (j.id === "closer") return (
            <div key={j.id} style={{ position: "absolute", left: p.x - 170, top: p.y - 200, width: 340, textAlign: "center", zIndex: 9 }}>
              <div style={{ position: "absolute", left: "15%", right: "15%", bottom: 44, height: 44, borderRadius: "50%", background: j.unlocked ? "rgba(251,191,36,.6)" : "rgba(60,60,80,.25)", filter: "blur(14px)" }} />
              <svg width="300" height="190" viewBox="0 0 300 190" style={{ filter: j.unlocked ? "drop-shadow(0 0 30px #fbbf24)" : "drop-shadow(0 10px 10px rgba(0,0,0,.28))" }}>
                <ellipse cx="150" cy="120" rx="140" ry="58" fill="#e8dcc0" stroke="#b9834a" strokeWidth="5" />
                <ellipse cx="150" cy="112" rx="112" ry="42" fill="#d9c7a0" />
                <ellipse cx="150" cy="112" rx="80" ry="28" fill="#86d36f" />
                <rect x="120" y="100" width="60" height="26" rx="3" fill="none" stroke="#fff" strokeWidth="2" />
                <path d="M 10 120 a140 58 0 0 1 280 0" fill="none" stroke="#ef4444" strokeWidth="18" opacity=".9" />
                <path d="M 30 120 a120 48 0 0 1 240 0" fill="none" stroke="#fbbf24" strokeWidth="6" />
                {[0, 1, 2].map((i) => <g key={i}><rect x={70 + i * 80} y="40" width="4" height="40" fill="#8a5a2b" /><polygon points={`${74 + i * 80},40 ${98 + i * 80},48 ${74 + i * 80},56`} fill={["#ef4444", "#fbbf24", "#3b82f6"][i]} /></g>)}
                <rect x="228" y="6" width="26" height="110" rx="4" fill="#f3e2c3" stroke="#b9834a" strokeWidth="3" /><polygon points="224,10 241,-14 258,10" fill="#ef4444" />
                {/* 紋章 4つ */}
                {[0, 1, 2, 3].map((i) => <circle key={i} cx={96 + i * 36} cy="166" r="12" fill={i < done ? "#fbbf24" : "#e2e8f0"} stroke="#92400e" strokeWidth="2.5" style={i < done ? { filter: "drop-shadow(0 0 6px #fbbf24)" } : undefined} />)}
                <text x="150" y="171" textAnchor="middle" fontSize="11" fontWeight="900" fill="#92400e">{"⚜".repeat(0)}</text>
              </svg>
              {label}
            </div>
          );
          return (
            <div key={j.id} style={{ position: "absolute", left: p.x - 150, top: p.y - 240, width: 300, textAlign: "center", zIndex: 9 }}>
              <div style={{ position: "relative", display: "inline-block", filter: j.unlocked ? "drop-shadow(0 0 30px #fbbf24)" : `brightness(${0.6 + ratio * 0.4}) saturate(${0.25 + ratio * 0.75}) blur(${(1 - ratio) * 1.4}px) opacity(${0.6 + ratio * 0.4})`, transition: "filter .6s" }}>
                <img src="/island/house/5_castle.png" alt="" style={{ width: 200, display: "block" }} />
              </div>
              {haze && [0, 1, 2].map((i) => <div key={i} style={{ position: "absolute", left: `${6 + i * 30}%`, top: `${30 + (i % 2) * 28}%`, width: 150, height: 56, borderRadius: 999, background: `rgba(255,255,255,${0.8 - ratio * 0.6})`, filter: "blur(9px)", boxShadow: "50px -14px 0 -6px rgba(255,255,255,.7)", animation: `swFloat ${5 + i}s ease-in-out infinite alternate`, pointerEvents: "none" }} />)}
              {label}
            </div>
          );
        })}

        {/* ---------- アバター ---------- */}
        <div style={{ position: "absolute", left: avatarAt.x - 64 - 74, top: avatarAt.y - 150, width: 128, zIndex: 30, pointerEvents: "none" }}>
          <div style={{ position: "absolute", left: 14, right: 14, bottom: -4, height: 40, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(251,191,36,.7), rgba(251,191,36,0) 70%)", animation: "swGlow 1.8s ease-in-out infinite alternate" }} />
          <div style={{ position: "absolute", left: 38, right: 38, bottom: 6, height: 16, borderRadius: "50%", background: "rgba(0,0,0,.25)", filter: "blur(4px)" }} />
          {bubble && (
            <div style={{ position: "absolute", bottom: 136, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", background: "linear-gradient(180deg,#fff,#fffbeb)", borderRadius: 16, padding: "7px 14px", fontSize: 13, fontWeight: 900, color: "#1e293b", boxShadow: "0 6px 16px rgba(0,0,0,.2)", border: "2.5px solid #fde68a", textAlign: "center" }}>
              {currentNode && <div style={{ fontSize: 9, letterSpacing: 1, color: "#b45309" }}>🎯 CURRENT QUEST ・ {currentNode.name}</div>}
              <div>{bubble}</div>
              <div style={{ position: "absolute", bottom: -8, left: "50%", marginLeft: -7, width: 14, height: 14, background: "#fffbeb", transform: "rotate(45deg)", borderRight: "2.5px solid #fde68a", borderBottom: "2.5px solid #fde68a" }} />
            </div>
          )}
          <div style={{ animation: "swBob 2.4s ease-in-out infinite", position: "relative", transform: facingLeft ? "scaleX(-1)" : "none" }}>
            {avatarId ? <img src={`/avatars/${avatarId}.png`} alt="" style={{ width: 128, display: "block", filter: "drop-shadow(0 10px 10px rgba(0,0,0,.28))" }} /> : <div style={{ fontSize: 100, textAlign: "center" }}>🧑‍🚀</div>}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes swCloud{0%{transform:translateX(-30vw)}100%{transform:translateX(130vw)}}
        @keyframes swFloat{from{transform:translateY(0)}to{transform:translateY(-10px)}}
        @keyframes swBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes swBounce{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-7px)}}
        @keyframes swPulse{0%,100%{opacity:.6;transform:scale(.95)}50%{opacity:1;transform:scale(1.06)}}
        @keyframes swTwinkle{from{opacity:.2;transform:scale(.6)}to{opacity:1;transform:scale(1.2)}}
        @keyframes swGlow{from{opacity:.55;transform:scale(.92)}to{opacity:1;transform:scale(1.06)}}
        @keyframes swFlag{from{transform:skewY(-6deg)}to{transform:skewY(6deg)}}
        @keyframes swBalloon{from{transform:translate(0,0)}to{transform:translate(70px,-30px)}}
        @keyframes swBird{0%{transform:translateX(-80px)}100%{transform:translateX(2100px)}}
        @keyframes swFlow{to{stroke-dashoffset:-60}}
        @keyframes swStep{0%,100%{opacity:.15}50%{opacity:1}}
        @keyframes swSpin{to{transform:rotate(360deg)}}
        @keyframes swSway{from{transform:rotate(-2deg)}to{transform:rotate(2deg)}}
        @keyframes swButterfly{0%{transform:translate(0,0)}50%{transform:translate(40px,-18px)}100%{transform:translate(80px,6px)}}
      `}</style>
    </div>
  );
}
