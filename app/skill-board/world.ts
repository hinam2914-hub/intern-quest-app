// SKILL WORLD のレイアウト定義（表示専用。解放条件は skill_nodes.requires が正）
export const WORLD_W = 2000;
export const WORLD_H = 1400;

export type Pt = { x: number; y: number };
export const START: Pt = { x: 160, y: 1180 };

// ノード座標（id → 座標）
export const NODE_POS: Record<string, Pt> = {
  comm_1: { x: 330, y: 1120 }, comm_2: { x: 470, y: 1060 }, comm_3: { x: 610, y: 1110 }, comm_4: { x: 760, y: 1050 }, comm_5: { x: 900, y: 1090 }, comm_6: { x: 1040, y: 1030 },
  sales_1: { x: 1180, y: 1120 }, sales_2: { x: 1320, y: 1060 }, sales_3: { x: 1460, y: 1110 }, sales_4: { x: 1600, y: 1050 }, sales_5: { x: 1740, y: 1100 }, sales_6: { x: 1880, y: 1040 },
  think_1: { x: 420, y: 820 }, think_2: { x: 560, y: 760 }, think_3: { x: 700, y: 800 }, think_4: { x: 850, y: 740 }, think_5: { x: 1000, y: 780 }, think_6: { x: 1150, y: 720 },
  mgmt_1: { x: 1250, y: 520 }, mgmt_2: { x: 1380, y: 470 }, mgmt_3: { x: 1510, y: 500 }, mgmt_4: { x: 1640, y: 440 }, mgmt_5: { x: 1770, y: 470 }, mgmt_6: { x: 1890, y: 400 },
  ai_1: { x: 300, y: 330 }, ai_2: { x: 440, y: 280 }, ai_3: { x: 580, y: 320 }, ai_4: { x: 720, y: 260 }, ai_5: { x: 860, y: 300 }, ai_6: { x: 1000, y: 240 },
};
export const JOB_POS: Record<string, Pt> = { closer: { x: 1940, y: 880 }, mentor: { x: 1700, y: 760 }, manager: { x: 1900, y: 235 } };
export const JOB_ICON: Record<string, string> = { closer: "🏟️", mentor: "🏛️", manager: "🏯" };

// エリア（地形ブロブ）
export type Area = { key: string; label: string; emoji: string; x: number; y: number; w: number; h: number; top: string; side: string; radius: string; sign: Pt };
export const AREAS: Area[] = [
  { key: "comm", label: "COMMUNICATION", emoji: "🌸", x: 230, y: 960, w: 900, h: 260, top: "radial-gradient(ellipse at 40% 40%, #c8f5a6 0%, #93dc7a 60%, #6fc46a 100%)", side: "#8a6a48", radius: "46% 54% 50% 50% / 55% 60% 40% 45%", sign: { x: 280, y: 990 } },
  { key: "sales", label: "SALES", emoji: "🔥", x: 1090, y: 960, w: 900, h: 260, top: "radial-gradient(ellipse at 50% 40%, #fde7b8 0%, #f3c77a 55%, #d9a85c 100%)", side: "#8a6a48", radius: "52% 48% 50% 50% / 60% 55% 45% 40%", sign: { x: 1140, y: 990 } },
  { key: "think", label: "THINKING", emoji: "🧠", x: 330, y: 640, w: 920, h: 250, top: "radial-gradient(ellipse at 45% 45%, #b9efa0 0%, #7fcf7b 55%, #4fae6b 100%)", side: "#6a5a3a", radius: "50% 50% 48% 52% / 58% 62% 38% 42%", sign: { x: 380, y: 670 } },
  { key: "mgmt", label: "MANAGEMENT", emoji: "🏰", x: 1170, y: 330, w: 820, h: 300, top: "radial-gradient(ellipse at 50% 40%, #d7efc3 0%, #9dc98e 55%, #6f9c74 100%)", side: "#7a6a58", radius: "48% 52% 50% 50% / 62% 58% 42% 38%", sign: { x: 1210, y: 360 } },
  { key: "ai", label: "AI SKILL", emoji: "🤖", x: 210, y: 160, w: 880, h: 240, top: "radial-gradient(ellipse at 50% 40%, #ede9fe 0%, #c4b5fd 55%, #a5b4fc 100%)", side: "#7c6fb0", radius: "50% 50% 50% 50% / 60% 60% 40% 40%", sign: { x: 250, y: 190 } },
];
export const AREA_COLOR: Record<string, string> = { comm: "#f59e0b", sales: "#ef4444", think: "#8b5cf6", mgmt: "#10b981", ai: "#3b82f6" };

// 道（表示専用）。kind: main=エリア内主道 / link=エリア間接続（必須進行ではない） / job=JOBへの金の道
export type Road = { from: string; to: string; kind: "main" | "link" | "job"; via?: Pt };
export const ROADS: Road[] = [
  // STARTから3方向へ（どこからでも始められる）
  { from: "START", to: "comm_1", kind: "link" },
  { from: "START", to: "think_1", kind: "link", via: { x: 240, y: 980 } },
  { from: "START", to: "sales_1", kind: "link", via: { x: 700, y: 1330 } },
  // エリア間
  { from: "comm_6", to: "sales_1", kind: "link" },
  { from: "think_3", to: "ai_1", kind: "link", via: { x: 380, y: 560 } },
  { from: "think_6", to: "mgmt_1", kind: "link", via: { x: 1220, y: 620 } },
  { from: "think_6", to: "sales_1", kind: "link", via: { x: 1200, y: 900 } },
];
export const AREA_ORDER = ["comm", "sales", "think", "mgmt", "ai"];

export function pt(id: string): Pt { return id === "START" ? START : NODE_POS[id] ?? JOB_POS[id] ?? START; }
export function curve(a: Pt, b: Pt, via?: Pt) {
  const c = via ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 30 };
  return `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`;
}
