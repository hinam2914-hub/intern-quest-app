"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { questMission, type EvalResult, type NodeState, type JobState, type Focus, type Reco } from "../lib/skills";
import { WORLD_W, WORLD_H, START, NODE_POS, JOB_POS, AREAS, AREA_COLOR, ROADS, pt, curve, type Pt } from "./world";
import { TERRAIN_IMG, blobPath, LAND_PTS, MEADOW_PTS, HILL_PTS, STONE_PTS, STREAM_D, COMM_CLUSTERS, WORLD_CLUSTERS, PILLARS, FOREST_PTS, HIGHLAND_PTS, UPPER_PTS, AI_DECK_PTS, clusterItems } from "./terrain";

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
  // 手配置の塊のみ（ノード付近は避ける）
  const nodes = Object.values(NODE_POS).concat(Object.values(JOB_POS), [START]);
  return clusterItems(COMM_CLUSTERS.concat(WORLD_CLUSTERS)).filter((t) => !nodes.some((p) => Math.hypot(p.x - t.x, p.y - t.y) < 58));
}

/** 地形の塗り（CSS clip-path ＋ background-image）。SVG <pattern> は iOS Safari で黒くなるため使わない */
function Fill({ d, dy = 0, img, size, pos, color, mask, opacity }: { d: string; dy?: number; img?: string; size?: number | string; pos?: string; color?: string; mask?: string; opacity?: number }) {
  const bg = [img ? `url(${img})` : "", color ?? ""].filter(Boolean).join(",");
  const clip = `path("${d}")`;
  return <div style={{ position: "absolute", left: 0, top: dy, width: WORLD_W, height: WORLD_H, clipPath: clip, WebkitClipPath: clip, backgroundImage: bg || undefined, backgroundSize: img ? `${typeof size === "number" ? `${size}px ${size}px` : size}, auto` : undefined, backgroundPosition: pos, backgroundRepeat: "repeat", opacity, WebkitMaskImage: mask, maskImage: mask, pointerEvents: "none" }} />;
}

/** 地形タイル画像のうち実在するもの（未配置なら SVG グラデにフォールバック） */
function useTerrainImages(): Record<string, boolean> {
  const [ok, setOk] = useState<Record<string, boolean>>({});
  useEffect(() => {
    Object.entries(TERRAIN_IMG).forEach(([k, src]) => { const im = new Image(); im.onload = () => setOk((o) => ({ ...o, [k]: true })); im.src = src; });
  }, []);
  return ok;
}

export default function SkillWorld({ res, avatarId, selectedId, onSelect, focusTo, focus, locNodeId, walk, onWalkEnd, recos, title }: {
  res: EvalResult; avatarId: string | null; selectedId: string | null; onSelect: (n: NodeState | null) => void; focusTo?: { key: number; target: Pt };
  focus: Focus; locNodeId: string | null; walk: Walk | null; onWalkEnd?: () => void; recos?: Reco[]; title?: { name: string; icon: string | null } | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState<Cam>({ x: 0, y: 0, s: 1 });
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  const pinch = useRef<{ d: number; s: number } | null>(null);
  const [vp, setVp] = useState({ w: 1200, h: 800 });
  const trees = useMemo(treeSeeds, []);
  const tx = useTerrainImages();

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
  const mission = nextBest ? questMission(nextBest) : null;
  const bubble = mission ? (currentNode ? mission.title : `次は「${nextBest!.name}」`) : "";
  const bubbleSub = mission ? mission.detail : "";
  const facingLeft = nextPos ? nextPos.x < homePos.x : false;

  function clamp(c: Cam): Cam { const minX = vp.w - WORLD_W * c.s, minY = vp.h - WORLD_H * c.s; return { s: c.s, x: Math.min(0, Math.max(minX, c.x)), y: Math.min(0, Math.max(minY, c.y)) }; }
  function centerOn(p: Pt, s?: number) { const sc = s ?? cam.s; setCam(clamp({ s: sc, x: vp.w / 2 - p.x * sc, y: vp.h / 2 - p.y * sc })); }
  useEffect(() => { const el = wrapRef.current; if (!el) return; const ro = new ResizeObserver(() => setVp({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el); setVp({ w: el.clientWidth, h: el.clientHeight }); return () => ro.disconnect(); }, []);
  useEffect(() => {
    const s = vp.w < 640 ? 1.3 : Math.min(2.0, Math.max(1.5, vp.w / 850));
    const k = vp.w < 640 ? 0.88 : 0.65;
    const av = { x: homePos.x - 74, y: homePos.y - 60 };
    const t = nextPos ? { x: av.x * k + nextPos.x * (1 - k), y: av.y * k + nextPos.y * (1 - k) } : av;
    setCam(clamp({ s, x: vp.w / 2 - t.x * s, y: vp.h / 2 - t.y * s + 30 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp.w, vp.h]);
  useEffect(() => { if (focusTo) centerOn(focusTo.target); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTo?.key]);
  const minS = Math.max(0.4, Math.max(vp.w / WORLD_W, vp.h / WORLD_H));
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
    comm: { base: "#b08552", top: "#e6c38f", dash: "8 10", w: 30 },
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
      roadEls.push(<path key={`s${c}${i}`} d={d} fill="none" stroke="#5a4a33" strokeWidth={st.w + 10} strokeLinecap="round" opacity={ex ? 0.22 : 0.12} filter="url(#shadowSoft)" />);
      roadEls.push(<path key={`b${c}${i}`} d={d} fill="none" stroke={st.base} strokeWidth={st.w} strokeLinecap="round" opacity={ex ? 0.95 : 0.55} />);
      roadEls.push(<path key={`t${c}${i}`} d={d} fill="none" stroke={lit ? "#fde68a" : st.top} strokeWidth={st.w - 10} strokeLinecap="round" opacity={ex ? 1 : 0.6} style={lit ? { filter: "drop-shadow(0 0 8px rgba(251,191,36,.8))" } : undefined} />);
      if (st.dash) roadEls.push(<path key={`d${c}${i}`} d={d} fill="none" stroke={lit ? "#f59e0b" : st.base} strokeWidth={c === "sales" ? 4 : 3} strokeDasharray={st.dash} strokeLinecap="round" opacity={0.6} />);
    }
  });
  ROADS.forEach((r, i) => {
    const a = pt(r.from), b = pt(r.to); const lit = r.from === "START" || byId.get(r.from)?.status === "unlocked";
    const d = curve(a, b, r.via); const air = r.to.startsWith("ai");
    if (air) { roadEls.push(<path key={`l${i}`} d={d} fill="none" stroke="#c4b5fd" strokeWidth={6} strokeDasharray="4 16" strokeLinecap="round" opacity={0.7} />); return; }
    const mountain = r.to.startsWith("mgmt");
    const narrow = r.from === "START";
    roadEls.push(<path key={`ls0${i}`} d={d} fill="none" stroke="#5a4a33" strokeWidth={(mountain ? 24 : narrow ? 16 : 20) + 10} strokeLinecap="round" opacity={0.2} filter="url(#shadowSoft)" />);
    roadEls.push(<path key={`l${i}`} d={d} fill="none" stroke={mountain ? "#8c8c8c" : "#b98a5a"} strokeWidth={mountain ? 24 : narrow ? 16 : 20} strokeLinecap="round" opacity={0.9} />);
    roadEls.push(<path key={`lt${i}`} d={d} fill="none" stroke={lit ? "#fde68a" : mountain ? "#e5e7eb" : "#e9c99a"} strokeWidth={mountain ? 14 : narrow ? 8 : 12} strokeLinecap="round" opacity={0.95} />);
    if (mountain) roadEls.push(<path key={`ls${i}`} d={d} fill="none" stroke="#9ca3af" strokeWidth={14} strokeDasharray="4 12" strokeLinecap="butt" opacity={0.6} />);
  });
  res.jobs.forEach((j) => {
    const jp = JOB_POS[j.id]; if (!jp) return;
    j.requires.forEach((rid) => { const a = NODE_POS[rid]; if (!a) return; const lit = byId.get(rid)?.status === "unlocked";
      roadEls.push(<path key={`j${j.id}${rid}`} d={curve(a, jp)} fill="none" stroke={lit ? "#fbbf24" : "#fde68a"} strokeWidth={lit ? 5 : 2.5} strokeDasharray={lit ? undefined : "4 10"} strokeLinecap="round" opacity={lit ? 0.9 : j.is_obtainable ? 0.3 : 0.15} style={lit ? { filter: "drop-shadow(0 0 6px rgba(251,191,36,.9))" } : undefined} />); });
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
        <img src="/world/balloon.png" alt="" style={{ position: "absolute", left: 1150, top: 60, width: 70, animation: "swBalloon 16s ease-in-out infinite alternate", filter: "drop-shadow(0 6px 6px rgba(0,0,0,.15))", opacity: 0.85 }} />
        {[0, 1].map((i) => <div key={i} style={{ position: "absolute", left: 0, top: 160 + i * 320, fontSize: 15, animation: `swBird ${45 + i * 15}s linear infinite`, animationDelay: `${-i * 12}s`, opacity: 0.8 }}>🕊️</div>)}
      </div>
      {[0, 1].map((i) => (<div key={i} style={{ position: "absolute", top: `${12 + i * 42}%`, left: 0, width: 170, height: 46, background: "rgba(255,255,255,.85)", borderRadius: 999, filter: "blur(2px)", animation: `swCloud ${90 + i * 30}s linear infinite`, animationDelay: `${-i * 30}s`, pointerEvents: "none", boxShadow: "40px -18px 0 -4px rgba(255,255,255,.8), 80px 0 0 -2px rgba(255,255,255,.85)", opacity: 0.55, zIndex: 0 }} />))}

      {/* ===== ワールド ===== */}
      <div style={{ position: "absolute", left: 0, top: 0, width: WORLD_W, height: WORLD_H, transform: `translate(${cam.x}px,${cam.y}px) scale(${cam.s})`, transformOrigin: "0 0", willChange: "transform", zIndex: 1 }}>

        {/* ---------- 遠景 SVG（山・大陸の影） ---------- */}
        <svg width={WORLD_W} height={WORLD_H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
          <defs>
            <linearGradient id="mtA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dbe9f5" /><stop offset="1" stopColor="#a9c6e0" /></linearGradient>
            <filter id="softA"><feGaussianBlur stdDeviation="6" /></filter>
          </defs>
          {/* 山（MGMT奥）＋MANAGERの峰 */}
          <path d="M 1150 560 L 1350 300 L 1470 400 L 1620 220 L 1760 360 L 1880 180 L 2000 360 L 2000 640 L 1150 640 Z" fill="#bcd3e6" />
          <path d="M 1620 220 L 1560 320 L 1690 320 Z M 1880 180 L 1820 280 L 1940 280 Z" fill="#f1f6fb" />
          <ellipse cx="1880" cy="360" rx="130" ry="36" fill="#cfe0ee" />

          <path d={blobPath(LAND_PTS)} transform="translate(0,88)" fill="#000" opacity=".16" filter="url(#softA)" />
          <path d={blobPath(HIGHLAND_PTS)} transform="translate(0,30)" fill="#000" opacity=".14" filter="url(#softA)" />
          <path d={blobPath(UPPER_PTS)} transform="translate(0,22)" fill="#000" opacity=".14" filter="url(#softA)" />
          <path d={blobPath(AI_DECK_PTS)} transform="translate(0,26)" fill="#1e1b4b" opacity=".18" filter="url(#softA)" />
        </svg>

        {/* ---------- Layer2 ベース地形（CSS塗り：iOS対応） ---------- */}
        {/* 大陸：崖 → 草原 */}
        <Fill d={blobPath(LAND_PTS)} dy={64} color="linear-gradient(180deg,#b08a5c 0%,#8b6a44 40%,#4b3626 100%)" />
        <Fill d={blobPath(LAND_PTS)} dy={64} img={TERRAIN_IMG.cliff} size="1130px 260px" pos="0 1096px" />
        <Fill d={blobPath(LAND_PTS)} img={TERRAIN_IMG.grass} size={384} color="linear-gradient(180deg,#b9ea95,#7fcc74)" />
        {/* THINKING：森（縁ぼかし） */}
        <Fill d={blobPath(FOREST_PTS)} img={TERRAIN_IMG.forest} size={360} color="linear-gradient(180deg,#a6e29a,#6fbf72)" mask="radial-gradient(ellipse 940px 330px at 757px 767px, #000 58%, transparent 100%)" />
        {/* MANAGEMENT：段丘 */}
        <Fill d={blobPath(HIGHLAND_PTS)} dy={20} color="linear-gradient(180deg,#b08a5c 0%,#8b6a44 40%,#4b3626 100%)" />
        <Fill d={blobPath(HIGHLAND_PTS)} img={TERRAIN_IMG.highland} size={380} color="linear-gradient(180deg,#e6f6d6,#a9d49a)" />
        <Fill d={blobPath(UPPER_PTS)} dy={16} color="linear-gradient(180deg,#b08a5c 0%,#8b6a44 40%,#4b3626 100%)" />
        <Fill d={blobPath(UPPER_PTS)} img={TERRAIN_IMG.highland} size={380} color="linear-gradient(180deg,#e6f6d6,#a9d49a)" />
        {/* AI：研究デッキ */}
        <Fill d={blobPath(AI_DECK_PTS)} dy={12} color="#7c6fb0" opacity={0.9} />
        <Fill d={blobPath(AI_DECK_PTS)} img={TERRAIN_IMG.ai} size={220} color="#ede9fe" />
        {/* COMM：丘・花畑 */}
        <Fill d={blobPath(HILL_PTS)} color="#8fd47a" opacity={0.55} />
        <Fill d={blobPath(MEADOW_PTS)} img={TERRAIN_IMG.meadow} size={384} color="linear-gradient(180deg,#c9f3a8,#b6e89a)" mask="radial-gradient(ellipse 760px 140px at 685px 1185px, #000 60%, transparent 100%)" />
        {/* SALES：石畳（西端は草へ溶ける） */}
        <Fill d={blobPath(STONE_PTS)} img={TERRAIN_IMG.stone} size={200} color="linear-gradient(180deg,#f7e9cf,#e5cfa5)" mask="linear-gradient(90deg, transparent 1080px, #000 1280px)" />
        {/* 湖 */}
        <div style={{ position: "absolute", left: 802, top: 812, width: 256, height: 116, borderRadius: "50%", background: "#e6dcc0", opacity: 0.9, pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: 810, top: 818, width: 240, height: 104, borderRadius: "50%", backgroundImage: `url(${TERRAIN_IMG.water}), radial-gradient(ellipse at 50% 35%, #d8f1ff, #5fb0f0)`, backgroundSize: "220px 220px, auto", boxShadow: "inset 0 0 0 3px rgba(255,255,255,.8)", pointerEvents: "none" }} />

        {/* ---------- 地形 SVG（縁・水・道・装飾） ---------- */}
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
            <filter id="shadowSoft"><feGaussianBlur stdDeviation="3" /></filter>
            {/* 地形タイル（画像が無ければ透明＝下のグラデーションが見える） */}
            <radialGradient id="forestFade" cx="50%" cy="50%" r="50%"><stop offset=".55" stopColor="#fff" /><stop offset="1" stopColor="#000" /></radialGradient>
            <mask id="forestMask"><path d={blobPath(FOREST_PTS)} fill="url(#forestFade)" /></mask>
            <linearGradient id="aiGlow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#67e8f9" /><stop offset=".5" stopColor="#c4b5fd" /><stop offset="1" stopColor="#67e8f9" /></linearGradient>
            <clipPath id="clipCliffBand"><path d={blobPath(LAND_PTS)} transform="translate(0,64)" /></clipPath>
            <radialGradient id="meadowFade" cx="50%" cy="50%" r="50%"><stop offset=".6" stopColor="#fff" /><stop offset="1" stopColor="#000" /></radialGradient>
            <mask id="meadowMask"><path d={blobPath(MEADOW_PTS)} fill="url(#meadowFade)" /></mask>
            <linearGradient id="grassBase" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b9ea95" /><stop offset="1" stopColor="#7fcc74" /></linearGradient>
            <linearGradient id="cliffV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b08a5c" /><stop offset=".35" stopColor="#8b6a44" /><stop offset="1" stopColor="#4b3626" /></linearGradient>
            <linearGradient id="stoneFade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#000" /><stop offset="1" stopColor="#fff" /></linearGradient>
            <mask id="stoneMask"><rect x="1080" y="900" width="200" height="400" fill="url(#stoneFade)" /><rect x="1280" y="900" width="800" height="400" fill="#fff" /></mask>
            <pattern id="grassDots" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M6 20 l2 -6 l2 6 M22 10 l2 -6 l2 6 M14 30 l2 -5 l2 5" stroke="#5fb56a" strokeWidth="1.6" fill="none" opacity=".55" /></pattern>
            <clipPath id="clipLand"><path d={blobPath(LAND_PTS)} /></clipPath>
            <symbol id="tree0" viewBox="0 0 40 50"><rect x="17" y="34" width="6" height="16" rx="2" fill="#8a5a2b" /><circle cx="20" cy="22" r="16" fill="#86d36f" /><circle cx="13" cy="26" r="10" fill="#6fc45f" /><circle cx="26" cy="18" r="9" fill="#a3e58a" /></symbol>
            <symbol id="tree1" viewBox="0 0 40 50"><rect x="17" y="34" width="6" height="16" rx="2" fill="#8a5a2b" /><circle cx="20" cy="22" r="16" fill="#f9a8d4" /><circle cx="12" cy="26" r="10" fill="#f472b6" /><circle cx="27" cy="18" r="9" fill="#fbcfe8" /></symbol>
            <symbol id="tree2" viewBox="0 0 40 50"><rect x="17" y="36" width="6" height="14" rx="2" fill="#6b4423" /><polygon points="20,2 36,26 4,26" fill="#3f9a5a" /><polygon points="20,12 38,38 2,38" fill="#4caf50" /></symbol>
            <symbol id="tree3" viewBox="0 0 40 50"><rect x="17" y="34" width="6" height="16" rx="2" fill="#8a5a2b" /><circle cx="20" cy="22" r="15" fill="#5aa66b" /><circle cx="12" cy="26" r="9" fill="#4a9560" /></symbol>
            <clipPath id="clipSales"><ellipse cx="1500" cy="1095" rx="500" ry="150" /></clipPath>
            <clipPath id="clipComm"><ellipse cx="680" cy="1095" rx="540" ry="150" /></clipPath>
          </defs>

          {/* 縁のライン・影（塗り本体は下の DIV 層） */}
          <path d={blobPath(LAND_PTS)} transform="translate(0,64)" fill="none" stroke="#3b2a1c" strokeWidth="2" opacity=".3" />
          <path d={blobPath(LAND_PTS)} fill="none" stroke="#dfffb8" strokeWidth="5" opacity=".7" />
          <path d={blobPath(LAND_PTS)} transform="translate(0,6)" fill="none" stroke="#5a9a52" strokeWidth="3" opacity=".35" clipPath="url(#clipLand)" />
          <path d={blobPath(FOREST_PTS)} fill="none" stroke="#2f6b3a" strokeWidth="10" opacity=".12" filter="url(#soft)" />
          <path d={blobPath(HIGHLAND_PTS)} transform="translate(0,20)" fill="none" stroke="#f5deb3" strokeWidth="2" opacity=".25" />
          <path d={blobPath(HIGHLAND_PTS)} fill="none" stroke="#f3f8e8" strokeWidth="4" opacity=".7" />
          <path d={blobPath(UPPER_PTS)} fill="none" stroke="#f3f8e8" strokeWidth="4" opacity=".75" />
          <path d={blobPath(AI_DECK_PTS)} fill="none" stroke="url(#aiGlow)" strokeWidth="4" opacity=".9" style={{ filter: "drop-shadow(0 0 6px #67e8f9)" }} />
          <path d={blobPath(HILL_PTS)} fill="none" stroke="#dfffb8" strokeWidth="3" opacity=".5" />
          <g mask="url(#stoneMask)">
            <path d={blobPath(STONE_PTS)} fill="none" stroke="#d6c39a" strokeWidth="6" opacity=".8" />
            <ellipse cx="1520" cy="1150" rx="120" ry="40" fill="#f6ecd6" opacity=".55" stroke="#cdb98c" strokeWidth="3" strokeDasharray="10 8" />
          </g>

          {/* ===== 水：湖・川・小川 ===== */}
          <path d="M 930 880 C 960 930, 1060 950, 1110 1010 C 1140 1050, 1120 1150, 1135 1260 C 1140 1300, 1120 1330, 1100 1340" fill="none" stroke="#3b7fc4" strokeWidth="36" strokeLinecap="round" opacity=".35" />
          <path d="M 930 880 C 960 930, 1060 950, 1110 1010 C 1140 1050, 1120 1150, 1135 1260 C 1140 1300, 1120 1330, 1100 1340" fill="none" stroke="#4f9ee0" strokeWidth="30" strokeLinecap="round" opacity=".9" />
          <path d="M 930 880 C 960 930, 1060 950, 1110 1010 C 1140 1050, 1120 1150, 1135 1260 C 1140 1300, 1120 1330, 1100 1340" fill="none" stroke="#9ed7f7" strokeWidth="20" strokeLinecap="round" />
          <path d="M 930 880 C 960 930, 1060 950, 1110 1010 C 1140 1050, 1120 1150, 1135 1260 C 1140 1300, 1120 1330, 1100 1340" fill="none" stroke="#cdeeff" strokeWidth="8" strokeLinecap="round" opacity=".7" />
          <path d="M 930 880 C 960 930, 1060 950, 1110 1010 C 1140 1050, 1120 1150, 1135 1260" fill="none" stroke="#e0f4ff" strokeWidth="5" strokeDasharray="26 34" strokeLinecap="round" opacity=".9" style={{ animation: "swFlow 3s linear infinite" }} />

          <path d={STREAM_D} fill="none" stroke="#3b7fc4" strokeWidth="22" strokeLinecap="round" opacity=".3" />
          <path d={STREAM_D} fill="none" stroke="#5fb0f0" strokeWidth="18" strokeLinecap="round" opacity=".95" />
          <path d={STREAM_D} fill="none" stroke="#b3e3ff" strokeWidth="10" strokeLinecap="round" />
          <path d={STREAM_D} fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="18 26" strokeLinecap="round" opacity=".8" style={{ animation: "swFlow 4s linear infinite" }} />
          {/* 滝 */}
          <rect x="1088" y="1300" width="30" height="80" rx="8" fill="#cfeeff" opacity=".9" />
          {/* THINKING→MANAGEMENT：山道の石橋と坂 */}
          <path d="M 1150 690 Q 1210 640 1270 612" fill="none" stroke="#a8a29e" strokeWidth="34" strokeLinecap="round" />
          <path d="M 1150 690 Q 1210 640 1270 612" fill="none" stroke="#e7e5e4" strokeWidth="22" strokeLinecap="round" />
          <path d="M 1160 700 Q 1210 660 1262 625" fill="none" stroke="#a8a29e" strokeWidth="4" strokeDasharray="10 8" />
          <path d="M 1168 714 Q 1210 690 1252 652" fill="none" stroke="#a8a29e" strokeWidth="6" opacity=".7" />
          {[0, 1, 2].map((i) => <ellipse key={"arch" + i} cx={1180 + i * 32} cy={686 - i * 18} rx="9" ry="12" fill="#78716c" opacity=".5" />)}
          {/* 街灯（SALES の街道沿い） */}
          {[1120, 1250, 1400, 1560, 1700, 1850].map((x, i) => <g key={"lamp" + i}><rect x={x - 2} y={1020 + (i % 2) * 90} width="4" height="34" fill="#475569" /><circle cx={x} cy={1016 + (i % 2) * 90} r="6" fill="#fde68a" stroke="#475569" strokeWidth="2" style={{ filter: "drop-shadow(0 0 6px #fbbf24)" }} /></g>)}
          {/* 気球乗り場の台地 */}
          <ellipse cx="400" cy="606" rx="70" ry="34" fill="url(#grass)" />
          {/* 柵（花畑の縁・短く2本） */}
          {[[330, 1160, 6], [720, 1210, 5]].map(([x, y, n], j) => <g key={"fence" + j}><path d={`M ${x} ${y + 9} H ${x + n * 26}`} stroke="#c48a4b" strokeWidth="3.5" />{[...Array(n)].map((_, i) => <rect key={i} x={x + i * 26} y={y} width="4.5" height="16" fill="#c48a4b" />)}</g>)}

          {/* ===== ノード足元の広場（踏み固めた土） ===== */}
          {res.nodes.filter((n) => n.category !== "ai").map((n) => { const p = NODE_POS[n.id]; if (!p) return null; const stone = n.category === "sales"; return (
            <g key={"plaza" + n.id}>
              {(!tx.plaza || stone) && <><ellipse cx={p.x} cy={p.y - 4} rx="54" ry="20" fill={stone ? "#e7dcc4" : "#d8b98a"} opacity=".9" />
              <ellipse cx={p.x} cy={p.y - 4} rx="42" ry="14" fill={stone ? "#f1e8d6" : "#e9cfa4"} opacity=".9" /></>}
              {tx.plaza && !stone && <image href={TERRAIN_IMG.plaza} x={p.x - 80} y={p.y - 44} width="160" height="80" preserveAspectRatio="none" />}
            </g>); })}

          {/* 道 */}
          {roadEls}
          {/* CURRENT QUEST ルート */}
          {nextPos && currentNode && <path d={curve(homePos, nextPos)} fill="none" stroke="#fbbf24" strokeWidth={14} strokeLinecap="round" opacity={0.5} style={{ filter: "drop-shadow(0 0 10px rgba(251,191,36,.9))" }} />}
          {steps.map((s, i) => <text key={i} x={s.x} y={s.y} fontSize="16" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${s.r} ${s.x} ${s.y})`} style={{ animation: "swStep 2.4s ease-in-out infinite", animationDelay: `${i * 0.18}s` }}>👣</text>)}

          {/* 木（画像は後段の div 層で描画） */}

        </svg>

        {/* ---------- AI 浮遊島（ノードごと・画像） ---------- */}
        {res.nodes.filter((n) => n.category === "ai").map((n, i) => {
          const p = NODE_POS[n.id]; const w = n.kind === "key" ? 260 : 170 + i * 10; const hid = n.is_hidden && n.status === "locked";
          return (<img key={n.id} src="/world/crystal_island.png" alt="" style={{ position: "absolute", left: p.x - w / 2, top: p.y - w * 0.42, width: w, pointerEvents: "none", animation: `swFloat ${4 + i * 0.6}s ease-in-out infinite alternate`, opacity: hid ? 0.5 : 1, filter: hid ? "blur(2px)" : "drop-shadow(0 16px 14px rgba(60,40,120,.35))" }} />);
        })}
        {!explored("ai") && [0, 1].map((i) => <img key={"aic" + i} src="/world/sm/cloud_soft.png" alt="" style={{ position: "absolute", left: 600 + i * 220, top: 240 - (i % 2) * 30, width: 170, opacity: 0.85, pointerEvents: "none", animation: `swFloat ${5 + i}s ease-in-out infinite alternate`, zIndex: 5 }} />)}

        {/* 画像パーツ：橋・石段・城壁・気球 */}
        <img src="/world/bridge_wood.png" alt="" style={{ position: "absolute", left: 1070, top: 1032, width: 100, pointerEvents: "none", filter: "drop-shadow(0 4px 4px rgba(0,0,0,.25))", zIndex: 3 }} />
        <img src="/world/bridge_wood.png" alt="" style={{ position: "absolute", left: 212, top: 972, width: 70, transform: "rotate(-62deg)", pointerEvents: "none", filter: "drop-shadow(0 4px 4px rgba(0,0,0,.25))", zIndex: 3 }} />
        <img src="/world/bridge_wood.png" alt="" style={{ position: "absolute", left: 870, top: 846, width: 80, pointerEvents: "none", filter: "drop-shadow(0 4px 4px rgba(0,0,0,.25))", zIndex: 3 }} />
        <img src="/world/stairs_stone.png" alt="" style={{ position: "absolute", left: 1280, top: 540, width: 110, pointerEvents: "none", filter: "drop-shadow(0 4px 4px rgba(0,0,0,.2))", zIndex: 3 }} />
        <img src="/world/stairs_stone.png" alt="" style={{ position: "absolute", left: 1500, top: 410, width: 100, pointerEvents: "none", filter: "drop-shadow(0 4px 4px rgba(0,0,0,.2))", zIndex: 3 }} />
        <img src="/world/wall_castle.png" alt="" style={{ position: "absolute", left: 1480, top: 262, width: 300, pointerEvents: "none", filter: "drop-shadow(0 6px 6px rgba(0,0,0,.2))", zIndex: 3 }} />
        <img src="/world/wall_castle.png" alt="" style={{ position: "absolute", left: 1740, top: 262, width: 300, pointerEvents: "none", filter: "drop-shadow(0 6px 6px rgba(0,0,0,.2))", zIndex: 3 }} />
        {tx.pillar && PILLARS.map((q, i) => <img key={"pillar" + i} src={TERRAIN_IMG.pillar} alt="" style={{ position: "absolute", left: q.x - 40 * q.s, top: q.y - 76 * q.s, width: 80 * q.s, pointerEvents: "none", filter: "drop-shadow(0 6px 5px rgba(0,0,0,.25))", zIndex: 4 }} />)}
        <img src="/world/balloon.png" alt="" style={{ position: "absolute", left: 356, top: 470, width: 88, pointerEvents: "none", filter: "drop-shadow(0 8px 8px rgba(0,0,0,.25))", zIndex: 6, animation: "swFloat 3s ease-in-out infinite alternate" }} />
        <div style={{ position: "absolute", left: 356, top: 592, width: 88, textAlign: "center", zIndex: 6, pointerEvents: "none" }}><span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, background: "#a8713a", color: "#fff7e6", fontSize: 10, fontWeight: 900, border: "1.5px solid #6b4423" }}>🎈 空へ</span></div>
        {/* 未探索：雲（画像） */}
        {AREAS.filter((a) => !explored(a.key) && a.key !== "ai").map((a) => [0, 1].map((i) => (
          <img key={a.key + i} src="/world/sm/cloud_soft.png" alt="" style={{ position: "absolute", left: a.x + a.w * (0.55 + i * 0.22) - 80, top: a.y + a.h * (0.25 + (i % 2) * 0.4) - 40, width: 160, opacity: 0.8, pointerEvents: "none", animation: `swFloat ${5 + i}s ease-in-out infinite alternate`, zIndex: 11 }} />
        )))}

        {/* ---------- START 村（画像） ---------- */}
        <div style={{ position: "absolute", left: START.x - 120, top: START.y - 150, width: 240, zIndex: 8, pointerEvents: "none", textAlign: "center" }}>
          <img src="/world/start_village.png" alt="" style={{ width: 240, display: "block", filter: "drop-shadow(0 10px 10px rgba(0,0,0,.25))" }} />
          <div style={{ marginTop: 2 }}>
            <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 10, background: "linear-gradient(180deg,#fff,#fdf6e3)", border: "2px solid #16a34a", fontSize: 12, fontWeight: 900, color: "#166534", boxShadow: "0 2px 6px rgba(0,0,0,.15)" }}>🌱 START</span>
            <div style={{ fontSize: 10, color: "#166534", fontWeight: 800, marginTop: 2, textShadow: "0 0 4px #fff" }}>冒険のはじまり</div>
          </div>
        </div>

        {/* 生活感：犬・猫・蝶・煙 */}
        <img src="/island/animals/dog.png" alt="" style={{ position: "absolute", left: 560, top: 1150, width: 30, animation: "swBob 3s ease-in-out infinite" }} />
        <img src="/island/animals/cat.png" alt="" style={{ position: "absolute", left: 1380, top: 1160, width: 28 }} />
        <div style={{ position: "absolute", left: 500, top: 1040, fontSize: 16, animation: "swButterfly 7s ease-in-out infinite alternate" }}>🦋</div>
        <div style={{ position: "absolute", left: 860, top: 1060, fontSize: 14, animation: "swButterfly 9s ease-in-out infinite alternate-reverse" }}>🦋</div>
        <div style={{ position: "absolute", left: 1296, top: 1060, fontSize: 18 }}>🪔</div>
        <div style={{ position: "absolute", left: 1668, top: 1070, fontSize: 18 }}>🪔</div>
        <div style={{ position: "absolute", left: 1392, top: 1090, fontSize: 20 }}>🛒</div>

        {/* 地域看板 */}
        {AREAS.map((a) => (
          <div key={a.key} style={{ position: "absolute", left: a.sign.x, top: a.sign.y - (a.key === "ai" ? 70 : 60), padding: "5px 14px", borderRadius: 12, background: "linear-gradient(180deg,#fff,#fdf6e3)", border: `2px solid ${Z(a.key)}`, fontSize: 12, fontWeight: 900, letterSpacing: 1, color: Z(a.key), boxShadow: "0 4px 10px rgba(0,0,0,.15)", whiteSpace: "nowrap", zIndex: 6 }}>{a.emoji} {a.label}</div>
        ))}

        {/* ---------- 木・茂み・岩（画像） ---------- */}
        {trees.map((t, i) => {
          const src = t.k === 1 ? "tree_pink" : t.k === 2 ? "tree_pine" : t.k === 4 ? "rock" : t.k === 3 ? (i % 4 === 0 ? "tree_round" : "bush_flowers") : (i % 5 === 0 ? "bush_flowers" : i % 7 === 0 ? "rock" : "tree_round");
          const w = (src === "bush_flowers" ? 34 : src === "rock" ? 36 : 46) * t.s;
          return (<div key={i} style={{ position: "absolute", left: t.x - w / 2, top: t.y - w * 0.9, width: w, pointerEvents: "none", zIndex: 4 }}>
            <div style={{ position: "absolute", left: "18%", right: "18%", bottom: -3, height: w * 0.16, borderRadius: "50%", background: "rgba(40,60,30,.28)", filter: "blur(2px)" }} />
            <img src={`/world/sm/${src}.png`} alt="" style={{ width: w, display: "block", position: "relative", transformOrigin: "50% 100%", animation: src.startsWith("tree") ? `swSway ${3 + (i % 5)}s ease-in-out infinite alternate` : undefined }} />
          </div>);
        })}

        {/* ---------- スキルノード（ランドマーク） ---------- */}
        {res.nodes.map((n) => {
          const p = NODE_POS[n.id]; if (!p) return null;
          const color = Z(n.category);
          const ex = explored(n.category) || n.order_no <= 2;
          const fog = (n.is_hidden && n.status === "locked") || (!ex && n.status === "locked");
          const u = n.status === "unlocked", a = n.status === "available";
          const key = n.kind === "key"; const w = key ? 130 : 100; const sel = selectedId === n.id;
          const lm = LANDMARK[n.id] ?? {}; const isCur = focus.current === n.id, isSub = focus.subs.includes(n.id);
          const reco = !isCur && !isSub && n.status === "available" ? (recos ?? []).find((rc) => rc.nodeId === n.id) : undefined;
          const lmH = key ? 96 : 70;
          const filt = fog ? "grayscale(1) brightness(.55) opacity(.45) blur(1px)" : u ? `drop-shadow(0 0 12px ${color}) drop-shadow(0 6px 5px rgba(0,0,0,.25))` : a ? "drop-shadow(0 6px 5px rgba(0,0,0,.25))" : "saturate(.3) opacity(.8) drop-shadow(0 4px 4px rgba(0,0,0,.2))";
          return (
            <div key={n.id} onClick={() => clickNode(n)} style={{ position: "absolute", left: p.x - w / 2, top: p.y - lmH - 18, width: w, cursor: "pointer", zIndex: sel ? 20 : isCur ? 12 : 10, transition: "transform .2s", transform: sel ? "scale(1.1)" : "none", textAlign: "center" }}>
              {/* CURRENT QUEST：光柱・リング・キラキラ */}
              {isCur && <>
                <div style={{ position: "absolute", left: "50%", bottom: 8, width: 84, height: 320, marginLeft: -42, background: "linear-gradient(180deg, rgba(251,191,36,0) 0%, rgba(253,224,71,.45) 55%, rgba(251,191,36,.75) 100%)", filter: "blur(5px)", pointerEvents: "none", animation: "swGlow 2s ease-in-out infinite alternate" }} />
                <div style={{ position: "absolute", left: "50%", bottom: 6, width: w + 40, height: 30, marginLeft: -(w + 40) / 2, borderRadius: "50%", border: "4px solid #fbbf24", boxShadow: "0 0 18px #fbbf24, inset 0 0 18px rgba(251,191,36,.6)", pointerEvents: "none", animation: "swPulse 2s ease-in-out infinite" }} />
                {[0, 1, 2, 3].map((i) => <div key={i} style={{ position: "absolute", left: 8 + i * 28, top: -10 + (i % 2) * 30, fontSize: 12, animation: `swTwinkle ${1 + i * 0.3}s ease-in-out infinite alternate` }}>✨</div>)}
                <div style={{ position: "absolute", top: -62, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 900, letterSpacing: 1, color: "#92400e", background: "#fde68a", borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap", zIndex: 3 }}>CURRENT QUEST</div>
              </>}
              {(isCur || isSub) && <div style={{ position: "absolute", top: -44, left: "50%", transform: "translateX(-50%)", fontSize: isCur ? 28 : 18, zIndex: 3, animation: "swBounce 1.4s ease-in-out infinite", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.3))" }}>🎯</div>}
              {reco && <>
                <div style={{ position: "absolute", left: "50%", bottom: 10, width: w + 20, height: 26, marginLeft: -(w + 20) / 2, borderRadius: "50%", border: "3px solid #c4b5fd", boxShadow: "0 0 14px #a78bfa", pointerEvents: "none", animation: "swPulse 2.4s ease-in-out infinite" }} />
                <div style={{ position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)", fontSize: 20, zIndex: 3, animation: "swBounce 1.6s ease-in-out infinite", filter: "drop-shadow(0 0 6px #fff)" }}>✨</div>
                <div style={{ position: "absolute", top: -56, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 900, letterSpacing: 1, color: "#fff", background: reco.source === "mentor" ? "linear-gradient(135deg,#f472b6,#ec4899)" : "linear-gradient(135deg,#a78bfa,#8b5cf6)", borderRadius: 6, padding: "1px 7px", whiteSpace: "nowrap", zIndex: 3, boxShadow: "0 2px 6px rgba(0,0,0,.2)" }}>{reco.source === "mentor" ? "メンターのおすすめ" : "おすすめルート"}</div>
              </>}
              {a && !fog && !isCur && !reco && <div style={{ position: "absolute", top: -30, left: "50%", transform: "translateX(-50%)", fontSize: 16, fontWeight: 900, color: "#ef4444", animation: "swBounce 1s ease-in-out infinite", textShadow: "0 0 6px #fff, 0 0 2px #fff" }}>！</div>}
              {u && <div style={{ position: "absolute", top: -6, right: 4, fontSize: 18, zIndex: 2, animation: "swFlag 1s ease-in-out infinite alternate" }}>🚩</div>}
              {/* 足元 */}
              <div style={{ position: "absolute", left: "12%", right: "12%", bottom: 10, height: key ? 28 : 20, borderRadius: "50%", background: u ? `radial-gradient(ellipse, ${color}99, ${color}11)` : a ? `radial-gradient(ellipse, ${color}55, transparent 70%)` : "rgba(60,60,80,.18)", filter: "blur(2px)", animation: a && !fog && !isCur ? "swPulse 2s ease-in-out infinite" : undefined }} />
              {/* ランドマーク本体 */}
              <div style={{ position: "relative", height: lmH, display: "flex", alignItems: "flex-end", justifyContent: "center", filter: filt }}>
                {fog ? <div style={{ fontSize: 40 }}>☁️</div> : lm.img ? <img src={lm.img} alt="" style={{ width: (lm.w ?? 70) * (key ? 1.15 : 1), display: "block" }} /> : lm.svg ? <LmSvg kind={lm.svg} color={color} size={key ? 64 : 48} /> : <div style={{ fontSize: 40 }}>{n.icon}</div>}
                {!fog && (lm.badge || !lm.img) && <span style={{ position: "absolute", right: 4, top: 6, width: 24, height: 24, borderRadius: 12, background: u ? color : "#fff", border: `2px solid ${u ? "#fff" : color}`, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 5px rgba(0,0,0,.2)" }}>{lm.badge ?? n.icon}</span>}
              </div>
              <div style={{ marginTop: 2, whiteSpace: "nowrap" }}>
                {isCur || sel ? (
                  <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 10, background: "linear-gradient(180deg,#fff,#fef3c7)", color: "#1e293b", fontSize: 13, fontWeight: 900, boxShadow: "0 3px 8px rgba(0,0,0,.2)", border: "2px solid #fbbf24" }}>{fog ? "？？？" : n.name}</span>
                ) : (
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, background: fog ? "#b9a68a" : u ? "#8a5a2b" : "#a8713a", color: fog ? "#efe6d6" : "#fff7e6", fontSize: key ? 10.5 : 9.5, fontWeight: 800, boxShadow: "0 2px 3px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.25)", border: "1.5px solid #6b4423", opacity: fog ? 0.7 : n.status === "locked" ? 0.75 : 1, letterSpacing: 0.3 }}>{fog ? "？？？" : n.name}</span>
                )}
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
            <div key={j.id} style={{ position: "absolute", left: p.x - 230, top: p.y - 230, width: 300, textAlign: "center", zIndex: 9 }}>
              <div style={{ position: "absolute", left: "15%", right: "15%", bottom: 50, height: 40, borderRadius: "50%", background: j.unlocked ? "rgba(251,191,36,.6)" : "rgba(60,60,80,.25)", filter: "blur(14px)" }} />
              <div style={{ position: "relative", display: "inline-block", filter: j.unlocked ? "drop-shadow(0 0 30px #fbbf24)" : "drop-shadow(0 12px 12px rgba(0,0,0,.28))" }}>
                <img src="/world/job_mentor.png" alt="" style={{ width: 280, display: "block" }} />
                {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} style={{ position: "absolute", left: 60 + (i % 3) * 70, top: 96 + Math.floor(i / 3) * 40, width: 16, height: 16, borderRadius: 8, background: i < done ? "#fde68a" : "transparent", boxShadow: i < done ? "0 0 16px 6px rgba(251,191,36,.7)" : "none" }} />)}
              </div>
              <div style={{ marginTop: -30 }}>{label}</div>
            </div>
          );
          if (j.id === "closer") return (
            <div key={j.id} style={{ position: "absolute", left: p.x - 215, top: p.y - 230, width: 260, textAlign: "center", zIndex: 9 }}>
              <div style={{ position: "absolute", left: "15%", right: "15%", bottom: 50, height: 44, borderRadius: "50%", background: j.unlocked ? "rgba(251,191,36,.6)" : "rgba(60,60,80,.25)", filter: "blur(14px)" }} />
              <div style={{ position: "relative", display: "inline-block", filter: j.unlocked ? "drop-shadow(0 0 30px #fbbf24)" : "drop-shadow(0 12px 12px rgba(0,0,0,.28))" }}>
                <img src="/world/job_closer.png" alt="" style={{ width: 250, display: "block" }} />
                {/* 入口の紋章4つ：取得ごとに点灯 */}
                {[0, 1, 2, 3].map((i) => <div key={i} style={{ position: "absolute", left: 80 + i * 26, bottom: 28, width: 16, height: 16, borderRadius: 9, background: i < done ? "#fde68a" : "rgba(255,255,255,.35)", border: "2px solid #b45309", boxShadow: i < done ? "0 0 12px 4px rgba(251,191,36,.8)" : "none" }} />)}
                {j.unlocked && <div style={{ position: "absolute", left: "50%", bottom: 40, transform: "translateX(-50%)", width: 60, height: 70, background: "radial-gradient(ellipse at 50% 100%, rgba(251,191,36,.9), rgba(251,191,36,0) 70%)" }} />}
              </div>
              <div style={{ marginTop: -36 }}>{label}</div>
            </div>
          );
          return (
            <div key={j.id} style={{ position: "absolute", left: p.x - 170, top: p.y - 250, width: 340, textAlign: "center", zIndex: 9 }}>
              <div style={{ position: "relative", display: "inline-block", filter: j.unlocked ? "drop-shadow(0 0 30px #fbbf24)" : `brightness(${0.75 + ratio * 0.25}) saturate(${0.5 + ratio * 0.5}) opacity(${0.75 + ratio * 0.25})`, transition: "filter .6s" }}>
                <img src="/world/job_manager.png" alt="" style={{ width: 320, display: "block" }} />
              </div>
              {haze && [0, 1].map((i) => <img key={i} src="/world/sm/cloud_soft.png" alt="" style={{ position: "absolute", left: 20 + i * 140, top: 150 + (i % 2) * 60, width: 170, opacity: 0.85 - ratio * 0.7, pointerEvents: "none", animation: `swFloat ${5 + i}s ease-in-out infinite alternate` }} />)}
              <div style={{ marginTop: -40 }}>{label}</div>
            </div>
          );
        })}

        {/* ---------- アバター ---------- */}
        <div style={{ position: "absolute", left: avatarAt.x - 64 - 74, top: avatarAt.y - 150, width: 128, zIndex: 30, pointerEvents: "none" }}>
          <div style={{ position: "absolute", left: 14, right: 14, bottom: -4, height: 40, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(251,191,36,.7), rgba(251,191,36,0) 70%)", animation: "swGlow 1.8s ease-in-out infinite alternate" }} />
          <div style={{ position: "absolute", left: 38, right: 38, bottom: 6, height: 16, borderRadius: "50%", background: "rgba(0,0,0,.25)", filter: "blur(4px)" }} />
          {bubble && (
            <div style={{ position: "absolute", bottom: bubbleSub ? 150 : 136, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", background: "linear-gradient(180deg,#fff,#fffbeb)", borderRadius: 16, padding: "7px 14px", fontSize: 13, fontWeight: 900, color: "#1e293b", boxShadow: "0 6px 16px rgba(0,0,0,.2)", border: "2.5px solid #fde68a", textAlign: "center" }}>
              {currentNode && <div style={{ fontSize: 9, letterSpacing: 1, color: "#b45309" }}>🎯 CURRENT QUEST ・ {currentNode.name}</div>}
              <div>{bubble}</div>
              {bubbleSub && <div style={{ fontSize: 11, fontWeight: 800, color: "#92400e", marginTop: 2 }}>{bubbleSub}</div>}
              <div style={{ position: "absolute", bottom: -8, left: "50%", marginLeft: -7, width: 14, height: 14, background: "#fffbeb", transform: "rotate(45deg)", borderRight: "2.5px solid #fde68a", borderBottom: "2.5px solid #fde68a" }} />
            </div>
          )}
          {title && (
            <div style={{ position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", padding: "2px 9px", borderRadius: 999, background: "linear-gradient(135deg,#fde68a,#f59e0b)", color: "#78350f", fontSize: 10.5, fontWeight: 900, border: "1.5px solid #fff", boxShadow: "0 2px 8px rgba(180,120,0,.35)", zIndex: 2 }}>{title.icon ?? "🏅"} {title.name}</div>
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
