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
    bridge: { from: Pt; to: Pt; pts: Pt[] };   // エリア縁 → 中央広場縁（pts は曲線の折れ線。from…to を含む）
    landmark: Pt;                   // テーマのランドマーク（島はここを避ける）
    waterfall: { p: Pt; ang: number };   // 滝の位置（輪郭の下半分）
    paths: [Pt, Pt][];              // 家同士をつなぐ小道（最小全域木）
    rad: (t: number) => number;     // 輪郭の半径関数（角度→半径）
};
export type LobbyDepth = "far" | "back" | "mid" | "front";
export type LobbySlot = { userId: string; areaKey: string; x: number; y: number; ring: number; z: number; isLeader: boolean };
/** 装飾の位置。kind は 0〜1 の乱数で、どの画像にするかはテーマ（描画側）が決める */
export type LobbyDecor = { x: number; y: number; k: number; s: number; z: number; areaKey: string; edge: boolean };
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
export function areaRadius(n: number): number { const k = ringsFor(n); return Math.max(430, (k + 0.75) * MIN_DIST + 100); }

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
        const pts: Pt[] = [];
        members.forEach((m, idx) => {
            if (idx === 0) { pts.push({ x: 0, y: 0 }); return; }
            // 六角リングの基準位置＋ゆらぎ（半径±16%、角度±35%）
            let ring = 1, first = 1; while (idx >= first + 6 * ring) { first += 6 * ring; ring++; }
            const cnt = 6 * ring, k = idx - first, step = (Math.PI * 2) / cnt;
            const ang = -Math.PI / 2 + step * k + step * 0.5 * (ring % 2) + (rnd() - 0.5) * step * 0.7;
            const rad = ring * MIN_DIST * 1.05 * (1 + (rnd() - 0.5) * 0.32);
            pts.push({ x: Math.cos(ang) * rad, y: Math.sin(ang) * rad * 0.92 });
        });
        // 衝突解消（中心の島は固定）：最低間隔・エリア内・道の帯を避ける
        // 輪郭の半径関数（角度→半径）：低周波のうねり＋細かい凹凸で円盤に見えないようにする。島・橋・装飾はこの関数を基準にする
        const ph = rng(hash(a.key + "p")); const p1 = ph() * Math.PI * 2, p2 = ph() * Math.PI * 2, p3 = ph() * Math.PI * 2;
        const rad = (t: number) => a.r * (1 + 0.12 * Math.sin(2 * t + p1) + 0.07 * Math.sin(3 * t + p2) + 0.05 * Math.sin(5 * t + p3));
        const corridor = 165;
        // ランドマークの予約位置：橋の反対側、半径の 0.55 倍（島はここから 230 離す）
        const la = Math.atan2(dir.y, dir.x) + Math.PI + (rnd() - 0.5) * 0.8;
        const lmk = { x: Math.cos(la) * rad(la) * 0.55, y: Math.sin(la) * rad(la) * 0.55 * 0.92 };
        for (let it = 0; it < 80; it++) {
            for (let i = 1; i < pts.length; i++) {
                for (let j = 0; j < pts.length; j++) {
                    if (i === j) continue;
                    const dx = pts[i].x - pts[j].x, dy = (pts[i].y - pts[j].y) * 1.15; const d = Math.hypot(dx, dy) || 0.01;
                    if (d < MIN_DIST) { const push = (MIN_DIST - d) / 2; const ux = dx / d, uy = dy / d / 1.15; pts[i].x += ux * push; pts[i].y += uy * push; if (j !== 0) { pts[j].x -= ux * push; pts[j].y -= uy * push; } }
                }
                // 道の帯（中心から広場方向）から離す
                const t = pts[i].x * dir.x + pts[i].y * dir.y;
                if (t > 120) { const px = pts[i].x - dir.x * t, py = pts[i].y - dir.y * t; const dist = Math.hypot(px, py); if (dist < corridor) { const f = (corridor - dist) * 0.9; const nx = dist > 1 ? px / dist : -dir.y, ny = dist > 1 ? py / dist : dir.x; pts[i].x += nx * f; pts[i].y += ny * f; } }
                // ランドマークから離す
                { const ddx = pts[i].x - lmk.x, ddy = (pts[i].y - lmk.y) * 1.1; const dd = Math.hypot(ddx, ddy) || 0.01; if (dd < 230) { const f = (230 - dd); pts[i].x += ddx / dd * f; pts[i].y += ddy / dd / 1.1 * f; } }
                // エリア内に収める
                const rr = Math.hypot(pts[i].x, pts[i].y / 0.92); const lim = rad(Math.atan2(pts[i].y / 0.92, pts[i].x)) - 150; if (rr > lim) { const f = lim / rr; pts[i].x *= f; pts[i].y *= f; }
            }
        }
        let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
        members.forEach((m, idx) => {
            const x = Math.round(cx + pts[idx].x), y = Math.round(cy + pts[idx].y);
            slots.push({ userId: m.id, areaKey: a.key, x, y, ring: idx === 0 ? 0 : 1, z: y, isLeader: idx === 0 });
            fx0 = Math.min(fx0, x - SLOT_W / 2); fx1 = Math.max(fx1, x + SLOT_W / 2); fy0 = Math.min(fy0, y - SLOT_H); fy1 = Math.max(fy1, y + 60);
        });
        // 輪郭（円を 16 点で崩す）
        const outline: Pt[] = []; const n = 28; const or = rng(hash(a.key + "o"));
        for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; const rr = rad(t) * (1 + (or() - 0.5) * 0.06); outline.push({ x: Math.round(cx + Math.cos(t) * rr), y: Math.round(cy + Math.sin(t) * rr * 0.9) }); }
        // 橋：エリア縁 → 広場縁。直線ではなく、層ごとに膨らみを変えた曲線（折れ線）にして放射状に見せない
        const sc = scales[ai], dp = depths[ai];
        const rb = Math.min(rad(Math.atan2(dir.y, dir.x)) * 0.93, townWidth(a.r, sc) * 0.42);
        const from = { x: Math.round(cx + dir.x * rb), y: Math.round(cy + dir.y * rb * 0.9) };
        // 広場側の接続点：手前の島は闘技場の下辺、奥の島は上辺、中段は左右に寄せる
        const toAng = Math.atan2(-dir.y * 0.8, -dir.x);
        const to = { x: Math.round(plazaC.x + Math.cos(toAng) * PLAZA_R * 0.9), y: Math.round(plazaC.y + Math.sin(toAng) * PLAZA_R * 0.9) };
        const bpts = bridgeCurve(from, to, dp, cx < plazaC.x ? -1 : 1, hash(a.key + "b"));
        // 装飾：外周（edge）と内側の隙間（島・道・ランドマークから離れた位置だけ）
        const dr = rng(hash(a.key + "d")); const dn = 14 + Math.round(a.r / 32);
        const lmW = { x: cx + lmk.x, y: cy + lmk.y };
        for (let i = 0; i < dn * 3 && decor.filter((d) => d.areaKey === a.key).length < dn; i++) {
            const edge = dr() < 0.6;
            const t = dr() * Math.PI * 2, rr = rad(t) * (edge ? 0.78 + dr() * 0.14 : 0.2 + dr() * 0.55);
            const x = Math.round(cx + Math.cos(t) * rr), y = Math.round(cy + Math.sin(t) * rr * 0.9);
            if (pts.some((p) => Math.hypot(cx + p.x - x, (cy + p.y - y) * 1.2) < 190)) continue;
            if (Math.hypot(x - from.x, y - from.y) < 130) continue;
            if (Math.hypot(x - lmW.x, y - lmW.y) < 170) continue;
            // 道の帯を避ける
            const tt = (x - cx) * dir.x + (y - cy) * dir.y; if (tt > 60) { const px = (x - cx) - dir.x * tt, py = (y - cy) - dir.y * tt; if (Math.hypot(px, py) < 110) continue; }
            decor.push({ x, y, k: dr(), s: 0.7 + dr() * 0.5, z: y, areaKey: a.key, edge });
        }
        // 小道：家の座標を最小全域木でつなぐ（中心の島から伸びる）
        const paths: [Pt, Pt][] = [];
        { const P = members.map((_, i) => ({ x: cx + pts[i].x, y: cy + pts[i].y })); const used = [0]; const rest = P.map((_, i) => i).slice(1);
          while (rest.length) { let best = -1, bi = -1, bu = -1, bd = Infinity; for (const u of used) for (let k = 0; k < rest.length; k++) { const d = Math.hypot(P[u].x - P[rest[k]].x, (P[u].y - P[rest[k]].y) * 1.3); if (d < bd) { bd = d; best = rest[k]; bi = k; bu = u; } } paths.push([P[bu], P[best]]); used.push(best); rest.splice(bi, 1); } }
        // 滝：輪郭の下半分（橋と反対寄り）のどこか
        const wa = Math.PI / 2 + (dr() - 0.5) * 1.6;
        const waterfall = { p: { x: Math.round(cx + Math.cos(wa) * rad(wa) * 0.97), y: Math.round(cy + Math.sin(wa) * rad(wa) * 0.9 * 0.97) }, ang: wa };
        areas.push({ key: a.key, label: a.label, short: a.short, color: a.color, count: members.length, cx, cy, r: a.r,
            box: { x: cx - a.r, y: cy - a.r * 0.9 - 90, w: a.r * 2, h: a.r * 1.8 + 90 },
            focus: { x: fx0 - 40, y: fy0 - 60, w: fx1 - fx0 + 80, h: fy1 - fy0 + 80 },
            outline, bridge: { from, to, pts: bpts }, landmark: lmW, waterfall, rad, paths, depth: dp, scale: sc, townW: townWidth(a.r, sc) });
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
