// SKILL WORLD カメラ制御（表示専用）。WORLD / AREA / QUEST の3段階とトゥイーン
import { WORLD_W, WORLD_H, type Pt } from "./world";

export type Cam = { x: number; y: number; s: number };
export type Box = { x: number; y: number; w: number; h: number };
export type CamMode = "free" | "world" | "area" | "quest";
export type CamCmd = { key: number; mode: "world" | "area" | "quest"; area?: string; target?: Pt };

/** エリアの表示範囲（ノード＋ランドマークを含む。ノード座標は world.ts が正） */
export const AREA_BOX: Record<string, Box> = {
  comm: { x: 100, y: 940, w: 1030, h: 340 },
  sales: { x: 1100, y: 820, w: 960, h: 450 },
  think: { x: 270, y: 590, w: 970, h: 350 },
  mgmt: { x: 1150, y: 230, w: 910, h: 470 },
  ai: { x: 200, y: 130, w: 900, h: 290 },
  world: { x: 0, y: 0, w: WORLD_W, h: WORLD_H },
};

export type Viewport = { w: number; h: number };
export type Insets = { top: number; bottom: number; left: number; right: number };

/** box が画面（HUDを除いた領域）に収まるカメラを算出。余白は fill で調整（0.88 ≒ 12%） */
export function fitBox(box: Box, vp: Viewport, ins: Insets, fill = 0.88, minS = 0.1, maxS = 2.2): Cam {
  const uw = Math.max(80, vp.w - ins.left - ins.right), uh = Math.max(80, vp.h - ins.top - ins.bottom);
  let s = Math.min(uw / box.w, uh / box.h) * fill;
  s = Math.min(maxS, Math.max(minS, s));
  const x = ins.left + (uw - box.w * s) / 2 - box.x * s;
  const y = ins.top + (uh - box.h * s) / 2 - box.y * s;
  return { x, y, s };
}
/** 点 p を（HUDを除いた）画面中央に置くカメラ */
export function centerCam(p: Pt, s: number, vp: Viewport, ins: Insets): Cam {
  const cx = ins.left + (vp.w - ins.left - ins.right) / 2, cy = ins.top + (vp.h - ins.top - ins.bottom) / 2;
  return { s, x: cx - p.x * s, y: cy - p.y * s };
}
/** ワールド外を見せない（ワールドが画面より小さい倍率のときは中央寄せ） */
export function clampCam(c: Cam, vp: Viewport): Cam {
  const ww = WORLD_W * c.s, wh = WORLD_H * c.s;
  // ワールドが画面より小さい倍率では、画面内に収まる範囲で自由（fit の位置を尊重）
  const x = ww <= vp.w ? Math.max(0, Math.min(vp.w - ww, c.x)) : Math.min(0, Math.max(vp.w - ww, c.x));
  const y = wh <= vp.h ? Math.max(0, Math.min(vp.h - wh, c.y)) : Math.min(0, Math.max(vp.h - wh, c.y));
  return { s: c.s, x, y };
}
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
/** from→to を ms かけて補間（scale は対数補間で自然に）。cancel 関数を返す */
export function tweenCam(from: Cam, to: Cam, ms: number, onFrame: (c: Cam) => void, onDone?: () => void): () => void {
  const t0 = performance.now(); let raf = 0;
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / ms), e = easeOutCubic(t);
    const s = from.s * Math.pow(to.s / from.s, e);
    // 画面中心に見えるワールド座標を補間してから、その倍率でのカメラを再構成（ズーム中の中心ズレ防止）
    onFrame({ s, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
    if (t < 1) raf = requestAnimationFrame(step); else onDone?.();
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
/** 点がどのエリア箱に入るか（WORLD VIEW のタップ用） */
export function areaAt(p: Pt): string | null {
  for (const k of ["ai", "mgmt", "think", "sales", "comm"]) { const b = AREA_BOX[k]; if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return k; }
  return null;
}
