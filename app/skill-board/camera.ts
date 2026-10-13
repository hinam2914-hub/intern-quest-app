// SKILL WORLD カメラ制御（表示専用）。WORLD / AREA / QUEST の3段階とトゥイーン
import { WORLD_W, WORLD_H, NODE_POS, type Pt } from "./world";

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

/** スマホ AREA VIEW 用：6スキルの並びに合わせた狭い範囲（建物を大きく見せる） */
export const AREA_FOCUS: Record<string, Box> = (() => {
  const out: Record<string, Box> = {};
  for (const k of ["comm", "sales", "think", "mgmt", "ai"]) {
    const pts = Object.entries(NODE_POS).filter(([id]) => id.startsWith(k + "_")).map(([, p]) => p);
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs) - 70, x1 = Math.max(...xs) + 70, y0 = Math.min(...ys) - 150, y1 = Math.max(...ys) + 50;
    out[k] = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  return out;
})();

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
export function clampCam(c: Cam, vp: Viewport, slack: { x: number; y: number } = { x: 0, y: 0 }): Cam {
  const ww = WORLD_W * c.s, wh = WORLD_H * c.s;
  // slack: ワールドの端を画面内まで寄せられる余裕（スマホで下側のエリアを中央に置くため）
  const lo = (size: number, view: number, sl: number) => (size + sl <= view ? [0, view - size] : [view - size - sl, sl]);
  const [xmin, xmax] = lo(ww, vp.w, slack.x), [ymin, ymax] = lo(wh, vp.h, slack.y);
  return { s: c.s, x: Math.min(xmax, Math.max(xmin, c.x)), y: Math.min(ymax, Math.max(ymin, c.y)) };
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
