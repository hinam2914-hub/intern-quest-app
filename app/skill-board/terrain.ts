// SKILL WORLD の地形定義（表示専用）。ノード座標・道・判定には一切関与しない。
import type { Pt } from "./world";

/** 地形タイル画像（public/world/）。未配置なら SVG のグラデーションにフォールバックする */
export const TERRAIN_IMG = {
  grass: "/world/terrain_grassland.png",
  meadow: "/world/terrain_flower_meadow.png",
  stone: "/world/terrain_city_stone.png",
  water: "/world/water_tile.png",
  cliff: "/world/cliff_grass_edge.png",
  plaza: "/world/plaza_round.png",
  forest: "/world/terrain_forest_floor.png",
  highland: "/world/terrain_highland.png",
  ai: "/world/terrain_ai_floor.png",
  pillar: "/world/ruin_pillar.png",
};

/** 点列を通る滑らかな閉曲線（Catmull-Rom → 3次ベジェ） */
export function blobPath(pts: Pt[], tension = 0.5): string {
  const n = pts.length; if (n < 3) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = { x: p1.x + (p2.x - p0.x) * tension / 3, y: p1.y + (p2.y - p0.y) * tension / 3 };
    const c2 = { x: p2.x - (p3.x - p1.x) * tension / 3, y: p2.y - (p3.y - p1.y) * tension / 3 };
    d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x} ${p2.y}`;
  }
  return d + " Z";
}
/** 決定的な凹凸を点列に加える（崖・草地の縁を自然に崩す） */
export function wobble(pts: Pt[], amp = 10, seed = 3): Pt[] {
  let s = seed; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
  return pts.map((p) => ({ x: p.x + rnd() * amp * 2, y: p.y + rnd() * amp * 2 }));
}

/** 大陸の外形（時計回り）。START の小島・AI 浮島は別描画 */
export const LAND_PTS: Pt[] = wobble([
  { x: 250, y: 700 }, { x: 380, y: 630 }, { x: 560, y: 600 }, { x: 760, y: 590 }, { x: 950, y: 610 }, { x: 1080, y: 600 },
  { x: 1150, y: 540 }, { x: 1230, y: 440 }, { x: 1360, y: 370 }, { x: 1520, y: 320 }, { x: 1700, y: 290 }, { x: 1880, y: 300 },
  { x: 2010, y: 350 }, { x: 2060, y: 480 }, { x: 2070, y: 640 }, { x: 2060, y: 800 }, { x: 2050, y: 960 }, { x: 2010, y: 1120 },
  { x: 1920, y: 1230 }, { x: 1760, y: 1265 }, { x: 1580, y: 1270 }, { x: 1420, y: 1250 }, { x: 1270, y: 1275 }, { x: 1140, y: 1300 },
  { x: 1040, y: 1265 }, { x: 900, y: 1280 }, { x: 760, y: 1270 }, { x: 600, y: 1275 }, { x: 440, y: 1245 }, { x: 320, y: 1215 },
  { x: 230, y: 1150 }, { x: 180, y: 1060 }, { x: 190, y: 960 }, { x: 220, y: 860 }, { x: 230, y: 770 },
], 8, 11);

/** COMM：花畑（不定形）。道と重なってよい（道が上に描かれる） */
export const MEADOW_PTS: Pt[] = wobble([
  { x: 330, y: 1150 }, { x: 420, y: 1120 }, { x: 540, y: 1160 }, { x: 700, y: 1140 }, { x: 860, y: 1170 }, { x: 980, y: 1150 },
  { x: 1060, y: 1200 }, { x: 980, y: 1245 }, { x: 800, y: 1240 }, { x: 600, y: 1250 }, { x: 420, y: 1225 }, { x: 310, y: 1200 },
], 10, 5);
/** COMM：北側の丘（少し濃い草） */
export const HILL_PTS: Pt[] = wobble([
  { x: 600, y: 960 }, { x: 760, y: 940 }, { x: 930, y: 960 }, { x: 1020, y: 1000 }, { x: 960, y: 1030 }, { x: 800, y: 1010 }, { x: 650, y: 1010 }, { x: 570, y: 990 },
], 8, 9);

/** SALES：石畳（西端は不定形。マスクで草へ溶かす） */
export const STONE_PTS: Pt[] = wobble([
  { x: 1090, y: 1030 }, { x: 1200, y: 990 }, { x: 1400, y: 960 }, { x: 1650, y: 950 }, { x: 1880, y: 970 }, { x: 2000, y: 1040 },
  { x: 2010, y: 1150 }, { x: 1900, y: 1230 }, { x: 1700, y: 1245 }, { x: 1480, y: 1230 }, { x: 1300, y: 1245 }, { x: 1180, y: 1230 }, { x: 1110, y: 1150 },
], 10, 7);

/** COMM の小川（START の水辺から東へ） */
export const STREAM_D = "M 215 1015 C 280 985, 340 1005, 400 985 C 470 962, 540 985, 620 968 C 700 952, 760 972, 830 958";

/** 木の塊（手配置）。k: 0=丸い木 1=ピンク 2=松 3=茂み 4=岩 */
export type Cluster = { x: number; y: number; k: number; n: number; r: number; s?: number };
export const COMM_CLUSTERS: Cluster[] = [
  // 北の丘の縁（道の向こう側）
  { x: 300, y: 1000, k: 0, n: 3, r: 26 }, { x: 540, y: 970, k: 0, n: 4, r: 34 }, { x: 700, y: 955, k: 0, n: 3, r: 28 }, { x: 880, y: 960, k: 0, n: 4, r: 36 },
  // 自己紹介・関係構築のピンク
  { x: 285, y: 1085, k: 1, n: 1, r: 0, s: 1.3 }, { x: 820, y: 1000, k: 1, n: 1, r: 0, s: 1.1 },
  // 南の崖際（列）
  { x: 380, y: 1230, k: 0, n: 3, r: 30 }, { x: 560, y: 1250, k: 3, n: 3, r: 30 }, { x: 740, y: 1245, k: 0, n: 3, r: 32 }, { x: 930, y: 1255, k: 3, n: 2, r: 22 },
  // 花畑の茂み
  { x: 450, y: 1170, k: 3, n: 2, r: 20 }, { x: 680, y: 1190, k: 3, n: 2, r: 22 }, { x: 870, y: 1200, k: 3, n: 2, r: 20 },
  // 岩
  { x: 240, y: 1130, k: 4, n: 2, r: 18 }, { x: 1020, y: 1230, k: 4, n: 1, r: 0 },
  // 建物の裏
  { x: 640, y: 1060, k: 0, n: 2, r: 22, s: 0.9 }, { x: 1080, y: 985, k: 0, n: 3, r: 26 },
];
export function clusterItems(cs: Cluster[], seed = 17): { x: number; y: number; k: number; s: number }[] {
  let sd = seed; const rnd = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
  const out: { x: number; y: number; k: number; s: number }[] = [];
  cs.forEach((c) => {
    for (let i = 0; i < c.n; i++) {
      const a = (i / Math.max(1, c.n)) * Math.PI * 2 + rnd() * 1.2, r = c.n === 1 ? 0 : c.r * (0.5 + rnd() * 0.5);
      out.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.55, k: c.k, s: (c.s ?? 1) * (0.85 + rnd() * 0.3) });
    }
  });
  return out.sort((a, b) => a.y - b.y);
}

/** THINKING：知恵の森（濃い緑の床） */
export const FOREST_PTS: Pt[] = wobble([
  { x: 290, y: 770 }, { x: 370, y: 660 }, { x: 540, y: 615 }, { x: 760, y: 605 }, { x: 980, y: 625 }, { x: 1140, y: 625 },
  { x: 1225, y: 700 }, { x: 1200, y: 830 }, { x: 1090, y: 905 }, { x: 900, y: 930 }, { x: 700, y: 922 }, { x: 500, y: 905 }, { x: 350, y: 875 },
], 10, 21);
/** MANAGEMENT：下段の高原（mgmt_1〜3） */
export const HIGHLAND_PTS: Pt[] = wobble([
  { x: 1165, y: 570 }, { x: 1225, y: 460 }, { x: 1370, y: 385 }, { x: 1540, y: 345 }, { x: 1720, y: 325 }, { x: 1900, y: 322 },
  { x: 2030, y: 385 }, { x: 2050, y: 520 }, { x: 2000, y: 625 }, { x: 1840, y: 665 }, { x: 1640, y: 655 }, { x: 1450, y: 645 }, { x: 1280, y: 625 },
], 9, 31);
/** MANAGEMENT：上段（mgmt_4〜6・王都へ） */
export const UPPER_PTS: Pt[] = wobble([
  { x: 1560, y: 440 }, { x: 1640, y: 370 }, { x: 1780, y: 335 }, { x: 1920, y: 330 }, { x: 2030, y: 380 }, { x: 2045, y: 470 },
  { x: 1980, y: 545 }, { x: 1820, y: 575 }, { x: 1680, y: 555 }, { x: 1590, y: 510 },
], 8, 41);
/** AI：空中研究エリアの床（浮島をつなぐデッキ） */
export const AI_DECK_PTS: Pt[] = wobble([
  { x: 250, y: 300 }, { x: 290, y: 222 }, { x: 440, y: 198 }, { x: 580, y: 232 }, { x: 720, y: 190 }, { x: 860, y: 220 }, { x: 1000, y: 178 },
  { x: 1075, y: 255 }, { x: 1035, y: 352 }, { x: 860, y: 376 }, { x: 720, y: 346 }, { x: 580, y: 386 }, { x: 440, y: 356 }, { x: 300, y: 372 },
], 6, 51);

/** 他エリアの木の塊 */
export const WORLD_CLUSTERS: Cluster[] = [
  // THINKING：松を森の縁に密集、内側は余白
  { x: 400, y: 650, k: 2, n: 4, r: 34 }, { x: 600, y: 628, k: 2, n: 5, r: 40 }, { x: 820, y: 622, k: 2, n: 5, r: 40 }, { x: 1050, y: 645, k: 2, n: 4, r: 34 },
  { x: 470, y: 895, k: 2, n: 4, r: 34 }, { x: 690, y: 910, k: 2, n: 4, r: 36 }, { x: 1010, y: 915, k: 2, n: 3, r: 30 },
  { x: 500, y: 700, k: 2, n: 3, r: 28 }, { x: 780, y: 690, k: 2, n: 4, r: 34 }, { x: 940, y: 695, k: 2, n: 3, r: 28 }, { x: 1110, y: 800, k: 2, n: 3, r: 26 },
  { x: 1045, y: 862, k: 0, n: 3, r: 26 }, { x: 640, y: 862, k: 4, n: 2, r: 18 }, { x: 1185, y: 660, k: 4, n: 1, r: 0 },
  // MANAGEMENT：茂みと岩、木は少なめ
  { x: 1320, y: 600, k: 3, n: 3, r: 26 }, { x: 1500, y: 622, k: 0, n: 3, r: 28 }, { x: 1700, y: 640, k: 3, n: 3, r: 26 }, { x: 1900, y: 605, k: 0, n: 3, r: 28 },
  { x: 1600, y: 365, k: 3, n: 2, r: 20 }, { x: 1800, y: 345, k: 3, n: 2, r: 20 }, { x: 2000, y: 425, k: 0, n: 2, r: 22 },
  { x: 1400, y: 560, k: 4, n: 2, r: 18 }, { x: 1985, y: 525, k: 4, n: 2, r: 18 }, { x: 1230, y: 600, k: 4, n: 1, r: 0 },
  // SALES：街路樹（縁だけ）
  { x: 1250, y: 1235, k: 0, n: 3, r: 28 }, { x: 1450, y: 1240, k: 3, n: 2, r: 22 }, { x: 1650, y: 1235, k: 0, n: 3, r: 28 }, { x: 1850, y: 1225, k: 0, n: 2, r: 24 },
  { x: 1350, y: 978, k: 0, n: 3, r: 28 }, { x: 1550, y: 962, k: 3, n: 2, r: 22 }, { x: 1800, y: 978, k: 0, n: 2, r: 24 }, { x: 1900, y: 1200, k: 4, n: 1, r: 0 },
  // MENTOR 周辺
  { x: 1560, y: 830, k: 0, n: 3, r: 28 }, { x: 1800, y: 860, k: 0, n: 2, r: 24 },
];
/** 遺跡の柱（THINKING） */
export const PILLARS: { x: number; y: number; s: number }[] = [{ x: 470, y: 795, s: 1 }, { x: 770, y: 862, s: 0.85 }, { x: 1120, y: 690, s: 0.8 }];
