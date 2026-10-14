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
    box: Box;        // エリア全体（看板・装飾を含む）
    focus: Box;      // 島スロットの範囲（スマホ AREA VIEW 用）
    outline: Pt[];   // 大陸の輪郭（blobPath に渡す）
    bridge: { from: Pt; to: Pt };   // エリア縁 → 中央広場縁
    landmark: Pt;                   // テーマのランドマーク（島はここを避ける）
    waterfall: { p: Pt; ang: number };   // 滝の位置（輪郭の下半分）
    paths: [Pt, Pt][];              // 家同士をつなぐ小道（最小全域木）
    rad: (t: number) => number;     // 輪郭の半径関数（角度→半径）
};
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

    // 2) エリアを中央広場の周りに配置（極座標。楕円に潰して横長に）
    // 画面比に合わせた楕円：PC（wide）は横長 16:9 を使い切る、スマホは縦寄り
    const EX = opts.wide ? 1.6 : 1.1, EY = opts.wide ? 0.74 : 0.95;
    let ringR = Math.max(...tmp.map((a) => (PLAZA_R + AREA_GAP * 1.5 + a.r * 1.1) / EY), (PLAZA_R + AREA_GAP + 340) / EY);
    const chord = tmp.reduce((s, a) => s + a.r * 2 + AREA_GAP, 0);
    ringR = Math.max(ringR, chord / (2 * Math.PI));
    const centers: Pt[] = [];
    // 重なり判定（縦に並ぶ隣同士は看板・崖の厚みの分だけ余計に離す：縦距離を 1.35 で割って評価）
    // 街画像（半径×2.05）と看板が重ならない距離：横は半径×1.05、縦は街の高さ分（×1.2）を見込む
    const clash = (p: Pt, r: number, q: Pt, rq: number) => Math.hypot((p.x - q.x) / 1.05, (p.y - q.y) / 1.25) < r + rq + AREA_GAP * 1.4;
    const onRing = (R: number, ang: number): Pt => ({ x: Math.cos(ang) * R * EX, y: Math.sin(ang) * R * EY });
    // 貪欲配置：真上から時計回りに、前のエリアと重ならない最小の角度に置いていく。1周に収まらなければ半径を広げる
    // 小さいエリアは広場に近く置く（橋が長くなりすぎない）：各エリアの半径を全体の R に比例させる
    const rmax = Math.max(...tmp.map((a) => a.r));
    const Ri = (R: number, i: number) => R * (PLAZA_R + AREA_GAP + tmp[i].r) / (PLAZA_R + AREA_GAP + rmax);
    const tryPlace = (R: number, extra = 0): boolean => {
        centers.length = 0;
        let ang = -Math.PI / 2;
        for (let i = 0; i < tmp.length; i++) {
            if (i > 0) {
                let a = ang + 0.02 + extra;
                while (a < ang + Math.PI * 2 && centers.some((c, j) => clash(onRing(Ri(R, i), a), tmp[i].r, c, tmp[j].r))) a += 0.02;
                ang = a;
            }
            centers.push(onRing(Ri(R, i), ang));
        }
        // 最後と最初が重ならないか（1周の閉じ）
        return !(tmp.length > 1 && clash(centers[centers.length - 1], tmp[tmp.length - 1].r, centers[0], tmp[0].r)) && ang < -Math.PI / 2 + Math.PI * 2 - 0.3;
    };
    for (let it = 0; it < 60 && !tryPlace(ringR); it++) ringR *= 1.04;
    // 1周に余りがあれば、余りを等分して配置を広げる（片側に寄らないように）
    { let best = 0; for (let g = 0.02; g < 1.5; g += 0.02) { if (tryPlace(ringR, g)) best = g; else break; } tryPlace(ringR, best); }
    // 1エリアだけなら広場の下に置く
    if (tmp.length === 1) centers[0] = { x: 0, y: PLAZA_R + AREA_GAP + tmp[0].r };

    // 3) ワールド座標へ（左上が 0,0）
    let minX = -PLAZA_R, maxX = PLAZA_R, minY = -PLAZA_R, maxY = PLAZA_R;
    tmp.forEach((a, i) => { minX = Math.min(minX, centers[i].x - a.r); maxX = Math.max(maxX, centers[i].x + a.r); minY = Math.min(minY, centers[i].y - a.r); maxY = Math.max(maxY, centers[i].y + a.r); });
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
        // 橋：エリア縁 → 広場縁
        const rb = rad(Math.atan2(dir.y, dir.x)) * 0.93;
        const from = { x: Math.round(cx + dir.x * rb), y: Math.round(cy + dir.y * rb * 0.9) };
        const to = { x: Math.round(plazaC.x - dir.x * PLAZA_R * 0.92), y: Math.round(plazaC.y - dir.y * PLAZA_R * 0.92) };
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
            outline, bridge: { from, to }, landmark: lmW, waterfall, rad, paths });
    });
    const plaza = { cx: plazaC.x, cy: plazaC.y, r: PLAZA_R, box: { x: plazaC.x - PLAZA_R, y: plazaC.y - PLAZA_R, w: PLAZA_R * 2, h: PLAZA_R * 2 } };
    // コンテンツ範囲：各エリアの街画像（半径×2.05、上に看板）と広場
    let cx0 = plaza.cx - plaza.r, cy0 = plaza.cy - plaza.r - 120, cx1 = plaza.cx + plaza.r, cy1 = plaza.cy + plaza.r + 120;
    for (const a of areas) { const w = a.r * 2.05; cx0 = Math.min(cx0, a.cx - w / 2); cx1 = Math.max(cx1, a.cx + w / 2); cy0 = Math.min(cy0, a.cy + a.r * 0.78 - w - 170); cy1 = Math.max(cy1, a.cy + a.r * 0.9 + 320); }
    return { worldW, worldH, plaza, areas, slots, decor, worldBox: { x: 0, y: 0, w: worldW, h: worldH }, contentBox: { x: cx0, y: cy0, w: cx1 - cx0, h: cy1 - cy0 } };
}
