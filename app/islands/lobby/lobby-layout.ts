// みんなの島ロビー：配置計算（純関数・DB非依存）
// 入力：島（メンバー）と事業部 → 出力：ワールドサイズ・エリア・島スロット・道・装飾
// 事業部は「メンバーがいるものだけ」エリアになる。固定座標は持たない。

export type Pt = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };

export type LobbyIsland = {
    id: string; name: string; totalEarned: number; level: number; streak: number; stepNo: number;
    avatarId: string; config: Record<string, string>; licenses: Record<string, boolean>; deptId: string | null;
};
export type LobbyDept = { id: string; name: string; code?: string | null; color?: string | null; sort_order?: number | null };

export type LobbyArea = {
    key: string; label: string; short: string; color: string; count: number;
    cx: number; cy: number; r: number;
    depth: LobbyDepth;   // WORLD での奥行き層（far/back/mid/front）
    scale: number;       // WORLD での描画倍率（奥ほど小さい）。AREA の中身（r・slots）はこの値に依存しない
    townW: number;       // WORLD の街画像の幅（人数で緩やかに変わる × 奥行き倍率）。画像の下端は cy + townW*TOWN_ANCHOR
    box: Box;        // エリア全体（看板・装飾を含む）
    focus: Box;      // 島スロットの範囲（スマホ AREA VIEW 用）
    outline: Pt[];   // 大陸の輪郭（blobPath に渡す）
    bridge: { from: Pt; to: Pt; pts: Pt[]; short: Pt[] };   // 門 → 中央広場縁（pts は曲線の折れ線）。short は WORLD 用：街画像の外に出た所から始める
    landmark: Pt;                   // テーマのランドマーク（島はここを避ける）
    waterfall: { p: Pt; ang: number };   // 滝の位置（輪郭の下半分）
    paths: [Pt, Pt][];              // （互換）家同士をつなぐ小道。村レイアウトでは roads を使う
    roads: LobbyRoad[];             // 村の道：大通り（橋→広場）と住宅街の通り（広場→外）。曲線の折れ線
    village: { cx: number; cy: number; r: number; gate: Pt; gateAng: number };   // 村の中央広場（世界座標）と村の門（橋のたもと）
    rad: (t: number) => number;     // 輪郭の半径関数（角度→半径）
};
export type LobbyDepth = "far" | "back" | "mid" | "front";
export type LobbySlot = { userId: string; areaKey: string; x: number; y: number; ring: number; z: number; isLeader: boolean; street: number; side: -1 | 1; faceAng: number };
export type LobbyRoad = { pts: Pt[]; w: number; main: boolean };
/** 装飾の位置。kind は 0〜1 の乱数で、どの画像にするかはテーマ（描画側）が決める */
export type LobbyDecor = { x: number; y: number; k: number; s: number; z: number; areaKey: string; edge: boolean; kind: "tree" | "flower" | "lamp" | "rock" };
export type LobbyLayout = {
    worldW: number; worldH: number;
    plaza: { cx: number; cy: number; r: number; box: Box };
    areas: LobbyArea[]; slots: LobbySlot[]; decor: LobbyDecor[];
    worldBox: Box;
    contentBox: Box;   // 島・看板・広場を含む実コンテンツの範囲（初期カメラはこれに合わせる）
};

// ---- 定数（ここだけ触れば全体の密度が変わる）
export const SLOT_W = 300;          // 島1つの占有幅
export const SLOT_H = 260;          // 島1つの占有高さ
export const MIN_DIST = 290;        // 島同士の最低間隔（中心間）
export const PLAZA_R = 700;         // 中央広場の半径（闘技場・掲示板の専用区画）
export const AREA_GAP = 120;        // エリア同士／エリアと広場の隙間
export const MARGIN = { top: 300, bottom: 220, side: 200 };
export const NO_DEPT_KEY = "__none__";

// ---- 決定的な乱数（配置が毎回同じになるように）
export function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed: number) { let t = seed || 1; return () => { t = (t * 1664525 + 1013904223) >>> 0; return t / 4294967296; }; }

/** n 島を六角リングで収めるのに必要なリング数（中心1＋6k） */
export function ringsFor(n: number): number { if (n <= 1) return 0; return Math.ceil((-3 + Math.sqrt(9 + 12 * (n - 1))) / 6); }
/** エリアの半径（島数から） */
export function areaRadius(n: number): number { return Math.round(Math.max(430, 420 + 185 * Math.sqrt(n))); }

const DEPT_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444", "#64748b"];

export function layoutLobby(islands: LobbyIsland[], depts: LobbyDept[], opts: { wide?: boolean } = {}): LobbyLayout {
    // 1) エリア候補：メンバーがいる事業部だけ
    const byDept = new Map<string, LobbyIsland[]>();
    for (const i of islands) { const k = i.deptId && depts.some((d) => d.id === i.deptId) ? i.deptId : NO_DEPT_KEY; if (!byDept.has(k)) byDept.set(k, []); byDept.get(k)!.push(i); }
    const deptOrder = [...depts].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
    type Tmp = { key: string; label: string; short: string; color: string; members: LobbyIsland[]; r: number };
    const tmp: Tmp[] = [];
    deptOrder.forEach((d, i) => { const m = byDept.get(d.id); if (m && m.length) tmp.push({ key: d.id, label: d.name, short: d.code || d.name, color: d.color || DEPT_COLORS[i % DEPT_COLORS.length], members: m, r: areaRadius(m.length) }); });
    const none = byDept.get(NO_DEPT_KEY); if (none && none.length) tmp.push({ key: NO_DEPT_KEY, label: "所属なし", short: "FREE", color: "#94a3b8", members: none, r: areaRadius(none.length) });
    // 人数の多い順（大きいエリアから角度を割り当てる）
    tmp.sort((a, b) => b.members.length - a.members.length);

    // 2) WORLD 配置：3層ディオラマ（手前・中段・奥）。中央闘技場をランドマークに、
    //    人数の多い事業部ほど手前（大きく）、少ない事業部ほど奥（小さく・霞む）。
    //    放射状の円ではなく「手前2・中段2（闘技場の左右）・奥N」の段構成で奥行きを作る。
    //    事業部が増減しても帯ごとに自動で詰める（奥は何個でも横に並ぶ／多すぎれば更に奥の帯へ）。
    const { centers, scales, depths } = placeWorld(tmp.map((a) => a.r), !!opts.wide, tmp.map((a) => a.key));
    // 3) ワールド座標へ（左上が 0,0）
    let minX = -PLAZA_R, maxX = PLAZA_R, minY = -PLAZA_R, maxY = PLAZA_R;
    tmp.forEach((a, i) => { const tw = townWidth(a.r, scales[i]); const hw = Math.max(a.r, tw * 0.52); minX = Math.min(minX, centers[i].x - hw); maxX = Math.max(maxX, centers[i].x + hw); minY = Math.min(minY, centers[i].y - Math.max(a.r, tw * (1 - TOWN_ANCHOR)) - 200); maxY = Math.max(maxY, centers[i].y + Math.max(a.r, tw * TOWN_ANCHOR + 100)); });
    const ox = MARGIN.side - minX, oy = MARGIN.top - minY;
    const worldW = Math.round(maxX - minX + MARGIN.side * 2), worldH = Math.round(maxY - minY + MARGIN.top + MARGIN.bottom);
    const plazaC = { x: ox, y: oy };

    // 4) 各エリア内の島を「自然な集落」配置に
    const areas: LobbyArea[] = [], slots: LobbySlot[] = [], decor: LobbyDecor[] = [];
    tmp.forEach((a, ai) => {
        const cx = Math.round(centers[ai].x + ox), cy = Math.round(centers[ai].y + oy);
        const rnd = rng(hash(a.key));
        const members = [...a.members].sort((p, q) => q.totalEarned - p.totalEarned || p.name.localeCompare(q.name));
        // 広場へ向かう道の方向（島はこの帯を避ける）
        const toPlaza = { x: plazaC.x - cx, y: plazaC.y - cy }; const L = Math.hypot(toPlaza.x, toPlaza.y) || 1; const dir = { x: toPlaza.x / L, y: toPlaza.y / L };
        // 輪郭の半径関数（角度→半径）：低周波のうねり＋細かい凹凸で円盤に見えないようにする。家・道・装飾はこの関数を基準にする
        const ph = rng(hash(a.key + "p")); const p1 = ph() * Math.PI * 2, p2 = ph() * Math.PI * 2, p3 = ph() * Math.PI * 2;
        const rad = (t: number) => a.r * (1 + 0.12 * Math.sin(2 * t + p1) + 0.07 * Math.sin(3 * t + p2) + 0.05 * Math.sin(5 * t + p3));
        // ---- 村レイアウト：中央広場 ＋ 大通り（門→広場）＋ 曲がった住宅街の通り。家は通りの両側に並ぶ
        const V = layoutVillage(members.length, a.r, rad, dir, rnd);
        const pts = V.houses.map((h) => ({ x: h.x, y: h.y }));
        const lmk = { x: 0, y: 0 };   // ランドマーク（噴水など）は広場の中心
        let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
        members.forEach((m, idx) => {
            const h = V.houses[idx]; const x = Math.round(cx + h.x), y = Math.round(cy + h.y);
            slots.push({ userId: m.id, areaKey: a.key, x, y, ring: idx === 0 ? 0 : 1, z: y, isLeader: idx === 0, street: h.street, side: h.side, faceAng: h.faceAng });
            fx0 = Math.min(fx0, x - SLOT_W / 2); fx1 = Math.max(fx1, x + SLOT_W / 2); fy0 = Math.min(fy0, y - SLOT_H); fy1 = Math.max(fy1, y + 60);
        });
        // 輪郭（円を 16 点で崩す）
        const outline: Pt[] = []; const n = 28; const or = rng(hash(a.key + "o"));
        for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; const rr = rad(t) * (1 + (or() - 0.5) * 0.06); outline.push({ x: Math.round(cx + Math.cos(t) * rr), y: Math.round(cy + Math.sin(t) * rr * 0.9) }); }
        // 橋：エリア縁 → 広場縁。直線ではなく、層ごとに膨らみを変えた曲線（折れ線）にして放射状に見せない
        const sc = scales[ai], dp = depths[ai];
        const from = { x: Math.round(cx + V.gate.x), y: Math.round(cy + V.gate.y) };
        // 広場側の接続点：手前の島は闘技場の下辺、奥の島は上辺、中段は左右に寄せる
        const toAng = Math.atan2(-dir.y * 0.8, -dir.x);
        const to = { x: Math.round(plazaC.x + Math.cos(toAng) * PLAZA_R * 0.9), y: Math.round(plazaC.y + Math.sin(toAng) * PLAZA_R * 0.9) };
        const bpts = bridgeCurve(from, to, dp, cx < plazaC.x ? -1 : 1, hash(a.key + "b"));
        // WORLD 用：街画像（幅 townW、中心は cy より少し上）の縁から始まる橋
        const tw = townWidth(a.r, sc); const tc = { x: cx, y: cy - tw * 0.05 }; const tr = tw * 0.34;
        const inTown = (p: Pt) => Math.hypot(p.x - tc.x, (p.y - tc.y) * 1.15) < tr;
        let short: Pt[] = bpts;
        for (let i = 0; i < bpts.length - 1; i++) { if (inTown(bpts[i]) && !inTown(bpts[i + 1])) { let lo = 0, hi = 1; for (let it = 0; it < 12; it++) { const m = (lo + hi) / 2; const q = { x: bpts[i].x + (bpts[i + 1].x - bpts[i].x) * m, y: bpts[i].y + (bpts[i + 1].y - bpts[i].y) * m }; if (inTown(q)) lo = m; else hi = m; } short = [{ x: Math.round(bpts[i].x + (bpts[i + 1].x - bpts[i].x) * hi), y: Math.round(bpts[i].y + (bpts[i + 1].y - bpts[i].y) * hi) }, ...bpts.slice(i + 1)]; break; } }
        // 門が街画像の外にある（大きな村）場合は、街画像の縁から門へ橋を延ばす（街画像の下に隠れる部分も含めて描く）
        if (!inTown(bpts[0])) { const vx = bpts[0].x - tc.x, vy = (bpts[0].y - tc.y) * 1.15; const L = Math.hypot(vx, vy) || 1; short = [{ x: Math.round(tc.x + vx / L * tr * 0.8), y: Math.round(tc.y + vy / L * tr * 0.8 / 1.15) }, ...bpts]; }
        // 装飾：村レイアウトが出した木・花壇・街灯 ＋ 外周の木
        const lmW = { x: cx + lmk.x, y: cy + lmk.y };
        for (const d of V.decor) decor.push({ x: Math.round(cx + d.x), y: Math.round(cy + d.y), k: d.k, s: d.s, z: Math.round(cy + d.y), areaKey: a.key, edge: d.edge, kind: d.kind });
        const paths: [Pt, Pt][] = [];
        const roads: LobbyRoad[] = V.roads.map((r) => ({ pts: r.pts.map((p) => ({ x: Math.round(cx + p.x), y: Math.round(cy + p.y) })), w: r.w, main: r.main }));
        const village = { cx, cy, r: V.plazaR, gate: { x: Math.round(cx + V.gate.x), y: Math.round(cy + V.gate.y) }, gateAng: Math.atan2(dir.y, dir.x) };
        // 滝：輪郭の下半分（橋と反対寄り）のどこか
        const dr = rng(hash(a.key + "d")); const wa = Math.PI / 2 + (dr() - 0.5) * 1.6;
        const waterfall = { p: { x: Math.round(cx + Math.cos(wa) * rad(wa) * 0.97), y: Math.round(cy + Math.sin(wa) * rad(wa) * 0.9 * 0.97) }, ang: wa };
        areas.push({ key: a.key, label: a.label, short: a.short, color: a.color, count: members.length, cx, cy, r: a.r,
            box: { x: cx - a.r, y: cy - a.r * 0.9 - 90, w: a.r * 2, h: a.r * 1.8 + 90 },
            focus: { x: fx0 - 40, y: fy0 - 60, w: fx1 - fx0 + 80, h: fy1 - fy0 + 80 },
            outline, bridge: { from, to, pts: bpts, short }, landmark: lmW, waterfall, rad, paths, roads, village, depth: dp, scale: sc, townW: townWidth(a.r, sc) });
    });
    const plaza = { cx: plazaC.x, cy: plazaC.y, r: PLAZA_R, box: { x: plazaC.x - PLAZA_R, y: plazaC.y - PLAZA_R, w: PLAZA_R * 2, h: PLAZA_R * 2 } };
    // コンテンツ範囲：各エリアの街画像（半径×2.05、上に看板）と広場
    let cx0 = plaza.cx - plaza.r, cy0 = plaza.cy - plaza.r - 120, cx1 = plaza.cx + plaza.r, cy1 = plaza.cy + plaza.r + 120;
    for (const a of areas) { const w = a.townW; cx0 = Math.min(cx0, a.cx - w / 2); cx1 = Math.max(cx1, a.cx + w / 2); cy0 = Math.min(cy0, a.cy - w * (1 - TOWN_ANCHOR) - 150); cy1 = Math.max(cy1, a.cy + w * TOWN_ANCHOR + (a.depth === "front" ? 100 : 40)); }
    return { worldW, worldH, plaza, areas, slots, decor, worldBox: { x: 0, y: 0, w: worldW, h: worldH }, contentBox: { x: cx0, y: cy0, w: cx1 - cx0, h: cy1 - cy0 } };
}

// ---- WORLD 配置（3層ディオラマ）----------------------------------------------
/** 層ごとの描画倍率。手前ほど大きく、奥ほど小さい */
export const DEPTH_SCALE: Record<LobbyDepth, number> = { front: 1.0, mid: 0.86, back: 0.7, far: 0.58 };
/** 層の収容数（手前2・中段2・奥4・それ以上は far）。人数の多い順に手前から埋める */
const BAND_CAP: { depth: LobbyDepth; cap: number }[] = [{ depth: "front", cap: 2 }, { depth: "mid", cap: 2 }, { depth: "back", cap: 4 }, { depth: "far", cap: 999 }];

type Placed = { x: number; y: number; hw: number; up: number; dn: number };
/** 街画像の幅：人数（半径）で緩やかに変わる × 奥行き倍率。AREA の半径にそのまま比例させない（大所帯だけ巨大化するのを防ぐ） */
export const TOWN_ANCHOR = 0.38;   // 画像の下端 = cy + townW*TOWN_ANCHOR（画像中心より少し下が島の中心）
export function townWidth(r: number, s: number): number { return Math.round((800 + r * 0.8) * s); }
/** 街画像の見かけサイズ。hw=半幅、up=中心から上端（看板込み）、dn=中心から下端（崖込み） */
function extent(r: number, s: number): { hw: number; up: number; dn: number } {
    const w = townWidth(r, s);
    // AREA に入ったとき本来の輪郭（半径 r）が隣の街画像と重ならないよう、r の 8 割も見込む
    return { hw: Math.max(w * 0.5 * 1.03, r * 0.8), up: Math.max(w * (1 - TOWN_ANCHOR) + 150, r * 0.72 + 150), dn: Math.max(w * TOWN_ANCHOR + 60, r * 0.72 + 60) };
}

/**
 * 事業部の半径リスト（人数の多い順）→ 広場中心を原点とした中心座標・倍率・層。
 * - front：広場の下、左右に 2 つ（左右で高さをずらす）
 * - mid  ：広場の左右（橋がほぼ水平になる）
 * - back ：広場の上に横一列（中央から外へ交互に並べ、手前の島と横に重なる分は更に上へ逃がす）
 * - far  ：back より更に奥（5 つ以上の小さな事業部がある場合）
 */
export function placeWorld(radii: number[], wide: boolean, keys: string[]): { centers: Pt[]; scales: number[]; depths: LobbyDepth[] } {
    const n = radii.length;
    const centers: Pt[] = new Array(n), scales: number[] = new Array(n), depths: LobbyDepth[] = new Array(n);
    const placed: Placed[] = [];
    const GX = wide ? 220 : 90;                 // 横の隙間
    const GY = 90;                              // 縦の隙間
    const plazaTop = -PLAZA_R * 0.95, plazaBot = PLAZA_R * 0.75, plazaHw = PLAZA_R * 1.05;
    const jit = (k: string, amp: number) => (rng(hash(k + "w"))() - 0.5) * 2 * amp;
    // 層ごとに割り当て
    const bands: number[][] = []; let idx = 0;
    for (const b of BAND_CAP) { const take = Math.min(b.cap, n - idx); if (take <= 0) break; bands.push(Array.from({ length: take }, (_, k) => idx + k)); idx += take; }
    // 下向きに置く（手前）：y は「上に置いた物と横に重なる物の下端」より下
    // 手前の島は、奥の島の崖（下 45%）までなら重なって良い（ジオラマの前後関係として自然に見える）
    const lowestBelow = (x: number, hw: number) => Math.max(plazaBot + 100, ...placed.filter((p) => Math.abs(p.x - x) < p.hw + hw + GX * 0.5).map((p) => p.y + p.dn * 0.55));
    // 奥の島は、手前側の島の上端（看板）までは隠れない位置に
    const highestAbove = (x: number, hw: number) => Math.min(plazaTop - 40, ...placed.filter((p) => Math.abs(p.x - x) < p.hw + hw + GX * 0.5).map((p) => p.y - p.up));
    const put = (i: number, x: number, y: number, d: LobbyDepth) => { const s = DEPTH_SCALE[d]; const e = extent(radii[i], s); centers[i] = { x: Math.round(x), y: Math.round(y) }; scales[i] = s; depths[i] = d; placed.push({ x, y, ...e }); };

    bands.forEach((ids, bi) => {
        const d = BAND_CAP[bi].depth, s = DEPTH_SCALE[d];
        if (d === "front") {
            // 1 つなら左寄り（闘技場の正面は空ける）。2 つなら左右。手前は大きいので闘技場の真下を避けて左右に振る
            ids.forEach((i, k) => {
                const e = extent(radii[i], s);
                const side = ids.length === 1 ? -1 : (k === 0 ? -1 : 1);
                const x = side * (e.hw + GX * 0.4 + (wide ? 420 : 40)) + jit(keys[i], 60);
                const y = lowestBelow(x, e.hw) + e.up + (wide ? 60 : 240) + (k === 1 ? 200 : 0);   // 看板（上に出る）の分を空ける   // 右の島は少し手前（下）にずらす
                put(i, x, y, d);
            });
        } else if (d === "mid") {
            ids.forEach((i, k) => {
                const e = extent(radii[i], s);
                const side = k === 0 ? 1 : -1;      // 3 番目に大きい事業部を右に
                // PC（横長）：手前の島より外側の両翼に置き、横に広い構図にする。スマホ：広場のすぐ横
                const frontEdge = Math.max(0, ...placed.filter((p) => (side > 0 ? p.x > 0 : p.x < 0)).map((p) => Math.abs(p.x) + p.hw));
                const x = side * (wide ? Math.max(plazaHw + GX + e.hw, frontEdge + GX * 0.6 + e.hw) : plazaHw + GX + e.hw) + jit(keys[i], 40);
                const y = (wide ? (k === 0 ? -60 : 160) : (k === 0 ? -420 : -260)) + jit(keys[i], 50);
                put(i, x, y, d);
            });
        } else {
            // 奥：中央から外へ交互に（大きい順）。横幅は各島の見かけ幅で決める
            const es = ids.map((i) => extent(radii[i], s));
            const order: number[] = []; ids.forEach((_, k) => (k % 2 === 0 ? order.push(k) : order.unshift(k)));   // 左…中央…右 の並び
            const total = order.reduce((t, k) => t + es[k].hw * 2, 0) + GX * (order.length - 1);
            let x = -total / 2;
            order.forEach((k, j) => {
                const e = es[k]; const cx = x + e.hw + (d === "far" ? jit(keys[ids[k]], 80) : jit(keys[ids[k]], 50));
                const y = highestAbove(cx, e.hw) - e.dn - GY + (j % 2 ? -70 : 40);   // 交互に上下させて一直線に見せない
                put(ids[k], cx, y, d);
                x += e.hw * 2 + GX;
            });
        }
    });
    return { centers, scales, depths };
}

/** 橋の曲線：from→to を 2 次ベジェで結び、折れ線にして返す。層ごとに膨らみ方向と量を変える */
export function bridgeCurve(from: Pt, to: Pt, depth: LobbyDepth, side: -1 | 1, seed: number): Pt[] {
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;                        // 法線
    const r = rng(seed)();
    // 手前：外側へ膨らむ／中段：下（手前）へたわむ／奥：外側へ膨らむ（控えめ）
    let bulge = depth === "mid" ? Math.abs(nx) > 0.5 ? 0 : 0.14 : depth === "front" ? 0.2 : 0.14;
    bulge *= len * (0.85 + r * 0.3);
    // 法線の向き：外側（画面中央から離れる側）または下
    let sgn = 1;
    if (depth === "mid") sgn = ny > 0 ? 1 : -1;                  // 下向き
    else { const ox = side; sgn = nx * ox > 0 ? 1 : -1; }      // 外側向き
    const c = { x: (from.x + to.x) / 2 + nx * bulge * sgn, y: (from.y + to.y) / 2 + ny * bulge * sgn };
    const K = Math.max(3, Math.min(7, Math.round(len / 260)));
    const pts: Pt[] = [];
    for (let i = 0; i <= K; i++) { const t = i / K, u = 1 - t; pts.push({ x: Math.round(u * u * from.x + 2 * u * t * c.x + t * t * to.x), y: Math.round(u * u * from.y + 2 * u * t * c.y + t * t * to.y) }); }
    return pts;
}

// ---- 村レイアウト（AREA の中身）------------------------------------------------
/** 家の 1 区画。street=通り番号（0 は大通り）、side=通りのどちら側か、faceAng=家が向く方向（通りの方向） */
export type VillageHouse = { x: number; y: number; street: number; side: -1 | 1; faceAng: number; t: number };
export type VillageDecor = { x: number; y: number; k: number; s: number; edge: boolean; kind: LobbyDecor["kind"] };
export type Village = { plazaR: number; gate: Pt; roads: { pts: Pt[]; w: number; main: boolean }[]; houses: VillageHouse[]; decor: VillageDecor[] };

const HOUSE_STEP = 340;      // 通り沿いの家の間隔（庭・木が見える余白を確保）
const HOUSE_OFF = 190;       // 通りの中心線から家までの距離
const ROAD_W_MAIN = 64, ROAD_W = 40;

function bezier3(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number): Pt[] {
    const out: Pt[] = [];
    for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push({ x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x, y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y }); }
    return out;
}
function polyLen(pts: Pt[]): number { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return L; }
/** 折れ線上の距離 d の点と進行方向 */
function alongPoly(pts: Pt[], d: number): { p: Pt; ang: number } {
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
        const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        if (acc + seg >= d || i === pts.length - 1) { const t = seg ? Math.max(0, Math.min(1, (d - acc) / seg)) : 0; return { p: { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }, ang: Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x) }; }
        acc += seg;
    }
    return { p: pts[0], ang: 0 };
}
function distToPoly(p: Pt, pts: Pt[]): number {
    let best = Infinity;
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; const vx = b.x - a.x, vy = b.y - a.y; const L2 = vx * vx + vy * vy || 1; const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L2)); best = Math.min(best, Math.hypot(p.x - a.x - vx * t, p.y - a.y - vy * t)); }
    return best;
}

/**
 * 村レイアウト：
 * - 中央広場（半径 plazaR）。広場の奥（門の反対側）に村長＝稼ぎ 1 位の家
 * - 大通り：門（橋のたもと）→ 広場。ゆるい S 字
 * - 住宅街の通り：広場から外へ、門方向を避けて 2〜5 本。くねる 3 次ベジェ
 * - 家は通りの両側に交互、広場に近い順に稼ぎの多い人（＝中心街ほど立派な家が集まる）
 * - 木・花壇・街灯は家と道を避けて配置
 */
export function layoutVillage(n: number, r: number, rad: (t: number) => number, dir: Pt, rnd: () => number): Village {
    const gateAng = Math.atan2(dir.y, dir.x);
    const plazaR = n <= 3 ? 170 : Math.max(200, Math.min(330, r * 0.24));
    const edge = (t: number, f: number): Pt => ({ x: Math.cos(t) * rad(t) * f, y: Math.sin(t) * rad(t) * f * 0.9 });
    const gate = edge(gateAng, 0.9);
    const roads: Village["roads"] = [];
    // 大通り（門→広場の縁）
    {
        const p0 = gate, p3 = { x: Math.cos(gateAng) * plazaR * 0.95, y: Math.sin(gateAng) * plazaR * 0.95 * 0.9 };
        const nx = -Math.sin(gateAng), ny = Math.cos(gateAng); const L = Math.hypot(p3.x - p0.x, p3.y - p0.y); const b = L * 0.16 * (rnd() < 0.5 ? -1 : 1);
        roads.push({ pts: bezier3(p0, { x: p0.x + (p3.x - p0.x) * 0.3 + nx * b, y: p0.y + (p3.y - p0.y) * 0.3 + ny * b }, { x: p0.x + (p3.x - p0.x) * 0.7 - nx * b, y: p0.y + (p3.y - p0.y) * 0.7 - ny * b }, p3, 10), w: ROAD_W_MAIN, main: true });
    }
    // 住宅街の通り：放射状に見えないよう、
    //  (a) 広場から出る通りは本数を抑え、長さ・曲がりをばらつかせる
    //  (b) 中くらい以上の村には「環状の裏道」を広場の外側に回し、そこから枝道を外へ伸ばす
    const k = Math.max(2, Math.min(8, Math.ceil((n - 1) / 4)));
    const avoid = 0.65; const span = Math.PI * 2 - avoid * 2;
    const hasRing = r >= 820 && n >= 8;
    const ringR = plazaR + 400 + (r - 800) * 0.12;    // 環状道の半径（広場から 1 軒分ほど外）
    const ringPts: Pt[] = [];
    if (hasRing) {
        // 門側は大通りがあるので、門の方向 ±0.5rad は環状道を通さない（C 字）
        const a0 = gateAng + 0.55, a1 = gateAng + Math.PI * 2 - 0.55; const m = 22;
        for (let i = 0; i <= m; i++) { const t = a0 + (a1 - a0) * i / m; const rr = ringR * (1 + 0.08 * Math.sin(3 * t + 1.3) + 0.05 * Math.sin(5 * t)); ringPts.push({ x: Math.cos(t) * rr, y: Math.sin(t) * rr * 0.9 }); }
        roads.push({ pts: ringPts, w: ROAD_W, main: false });
    }
    for (let i = 0; i < k; i++) {
        const t = gateAng + avoid + span * (i + 0.5) / k + (rnd() - 0.5) * 0.25;
        // 偶数番は広場から、奇数番は環状道から（枝道）。環状道が無い村は全部広場から
        const fromRing = hasRing && i % 2 === 1;
        const startR = fromRing ? ringR * (1 + 0.08 * Math.sin(3 * t + 1.3) + 0.05 * Math.sin(5 * t)) : plazaR * 0.95;
        const p0 = { x: Math.cos(t) * startR, y: Math.sin(t) * startR * 0.9 };
        const reach = 0.78 + rnd() * 0.16;                                   // 長さをばらつかせる
        const p3 = edge(t + (rnd() - 0.5) * 0.7, reach);
        const nx = -Math.sin(t), ny = Math.cos(t); const L = Math.hypot(p3.x - p0.x, p3.y - p0.y); const b = L * (0.26 + rnd() * 0.16) * (i % 2 ? -1 : 1);
        roads.push({ pts: bezier3(p0, { x: p0.x + (p3.x - p0.x) * 0.3 + nx * b, y: p0.y + (p3.y - p0.y) * 0.3 + ny * b }, { x: p0.x + (p3.x - p0.x) * 0.7 - nx * b * 0.7, y: p0.y + (p3.y - p0.y) * 0.7 - ny * b * 0.7 }, p3, 12), w: ROAD_W, main: false });
    }
    // 家の候補：各通りの両側、広場側から外へ。大通りは門の近く（手前）だけ両側に少し
    type Cand = VillageHouse & { rank: number };
    const cands: Cand[] = [];
    const inside = (p: Pt, margin: number) => Math.hypot(p.x, p.y / 0.9) < rad(Math.atan2(p.y / 0.9, p.x)) - margin;
    roads.forEach((rd, si) => {
        const L = polyLen(rd.pts);
        const start = rd.main ? 110 : 130, end = L - 40;
        for (let d = start, j = 0; d <= end; d += HOUSE_STEP * (0.92 + rnd() * 0.16), j++) {
            const { p, ang } = alongPoly(rd.pts, d);
            const sides: (-1 | 1)[] = [-1, 1];
            for (const sd of sides) for (const row of [1, 2]) {
                const off = HOUSE_OFF * (row === 1 ? 1 : 2.05) + (rnd() - 0.5) * 30;
                const q = { x: p.x - Math.sin(ang) * off * sd, y: p.y + Math.cos(ang) * off * sd * 0.9 };
                if (!inside(q, 120)) continue;
                if (Math.hypot(q.x, q.y / 0.9) < plazaR + 125) continue;
                if (roads.some((o, oi) => oi !== si && distToPoly(q, o.pts) < 110)) continue;
                // rank：広場からの距離（中心街ほど上位）。2 列目と大通り（門側）は後回し
                cands.push({ x: q.x, y: q.y, street: si, side: sd, faceAng: ang + (sd > 0 ? -Math.PI / 2 : Math.PI / 2), t: d, rank: Math.hypot(q.x, q.y / 0.9) + (rd.main ? 200 : 0) + (row === 2 ? 350 : 0) + j * 8 });
            }
        }
    });
    // 候補同士の間引き（近すぎる候補を落とす）
    const kept: Cand[] = [];
    for (const c of cands.sort((a, b) => a.rank - b.rank)) { if (kept.every((o) => Math.hypot(o.x - c.x, (o.y - c.y) * 1.15) >= MIN_DIST * 1.05)) kept.push(c); }
    // 村長の家：広場の奥（門の反対側）、広場の縁
    const la = gateAng + Math.PI;
    const ld = Math.min(plazaR + 170, rad(la) * 0.62);
    const leader: VillageHouse = { x: Math.cos(la) * ld, y: Math.sin(la) * ld * 0.9, street: -1, side: 1, faceAng: la + Math.PI, t: 0 };
    const houses: VillageHouse[] = [leader];
    for (const c of kept) { if (houses.length >= n) break; if (Math.hypot(c.x - leader.x, (c.y - leader.y) * 1.15) < MIN_DIST) continue; houses.push(c); }
    // それでも足りなければ、輪郭内の空きに置く（最後の保険。衝突だけ避ける）
    let guard = 0;
    while (houses.length < n && guard++ < 12000) {
        const relax = guard < 3000 ? 0.95 : guard < 6000 ? 0.85 : guard < 9000 ? 0.75 : 0.65;   // 混んでいれば徐々に詰める
        const t = rnd() * Math.PI * 2, rr = (0.3 + rnd() * 0.58); const q = edge(t, rr);
        if (Math.hypot(q.x, q.y / 0.9) < plazaR + 130) continue;
        if (houses.some((o) => Math.hypot(o.x - q.x, (o.y - q.y) * 1.15) < MIN_DIST * relax)) continue;
        // 通りの近く（裏手）に限る：村としてのまとまりを保つ。向きは最寄りの通りへ
        let bi = -1, bd = Infinity; roads.forEach((rd, ri) => { const d = distToPoly(q, rd.pts); if (d < bd) { bd = d; bi = ri; } });
        if (bd < 105 || bd > (guard < 6000 ? 420 : 640)) continue;
        const near = roads[bi].pts.reduce((b, p) => (Math.hypot(p.x - q.x, p.y - q.y) < Math.hypot(b.x - q.x, b.y - q.y) ? p : b), roads[bi].pts[0]);
        houses.push({ x: q.x, y: q.y, street: bi, side: 1, faceAng: Math.atan2(near.y - q.y, near.x - q.x), t: 0 });
    }
    // ---- 植栽：外周の木、通りの間の木、道沿いの花壇、広場まわりの街灯
    const decor: VillageDecor[] = [];
    const farFromHouses = (p: Pt, d: number) => houses.every((h) => Math.hypot(h.x - p.x, (h.y - p.y) * 1.2) > d);
    const farFromRoads = (p: Pt, d: number) => roads.every((rd) => distToPoly(p, rd.pts) > d);
    // 外周：門の周囲を除き、ほぼ等間隔
    { const circ = Math.PI * 2 * r * 0.95; const cnt = Math.round(circ / 150);
      for (let i = 0; i < cnt; i++) { const t = (i / cnt) * Math.PI * 2 + rnd() * 0.08; let da = Math.abs(((t - gateAng) + Math.PI * 3) % (Math.PI * 2) - Math.PI); if (da < 0.32) continue; const p = edge(t, 0.9 + rnd() * 0.05); if (!farFromHouses(p, 120)) continue; decor.push({ x: p.x, y: p.y, k: rnd(), s: 0.85 + rnd() * 0.4, edge: true, kind: "tree" }); } }
    // 内側の木：空き地に
    { const want = Math.round(r / 26); let tries = 0;
      while (decor.filter((d) => !d.edge && d.kind === "tree").length < want && tries++ < want * 30) {
          const t = rnd() * Math.PI * 2, rr = 0.3 + rnd() * 0.58; const p = edge(t, rr);
          if (Math.hypot(p.x, p.y / 0.9) < plazaR + 120) continue;
          if (!farFromHouses(p, 165) || !farFromRoads(p, 95)) continue;
          if (decor.some((d) => Math.hypot(d.x - p.x, d.y - p.y) < 90)) continue;
          decor.push({ x: p.x, y: p.y, k: rnd(), s: 0.7 + rnd() * 0.5, edge: false, kind: "tree" });
      } }
    // 花壇：通り沿い（家の無い側の隙間）
    roads.forEach((rd) => { const L = polyLen(rd.pts); for (let d = 90; d < L - 60; d += 230 + rnd() * 120) { const { p, ang } = alongPoly(rd.pts, d); const sd = rnd() < 0.5 ? -1 : 1; const q = { x: p.x - Math.sin(ang) * 62 * sd, y: p.y + Math.cos(ang) * 62 * sd }; if (!farFromHouses(q, 120) || !inside(q, 60)) continue; decor.push({ x: q.x, y: q.y, k: rnd(), s: 0.5 + rnd() * 0.3, edge: false, kind: "flower" }); } });
    // 街灯：広場の縁 4 本（門方向を除く）
    for (let i = 0; i < 4; i++) { const t = gateAng + Math.PI / 4 + (Math.PI / 2) * i; const p = { x: Math.cos(t) * (plazaR + 40), y: Math.sin(t) * (plazaR + 40) * 0.9 }; if (!farFromHouses(p, 110)) continue; decor.push({ x: p.x, y: p.y, k: rnd(), s: 1, edge: false, kind: "lamp" }); }
    // 岩：外周近くに少し
    for (let i = 0; i < 4; i++) { const p = edge(rnd() * Math.PI * 2, 0.72 + rnd() * 0.14); if (!farFromHouses(p, 130) || !farFromRoads(p, 90)) continue; decor.push({ x: p.x, y: p.y, k: rnd(), s: 0.7 + rnd() * 0.4, edge: false, kind: "rock" }); }
    return { plazaR, gate, roads, houses, decor };
}
