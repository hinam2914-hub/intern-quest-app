"use client";
// みんなの島ロビー：ワールド描画＋カメラ（WORLD / AREA / ISLAND / free）
// 配置は lobby-layout.ts の出力をそのまま使う（ここでは座標を持たない）。
// カメラは SKILL WORLD の camera.ts（fitBox / centerCam / tweenCam）を流用。clamp だけワールドサイズが可変なので自前。
import { useEffect, useMemo, useRef, useState } from "react";
import { fitBox, centerCam, tweenCam, type Cam, type Insets, type Viewport, type Box } from "../../skill-board/camera";
import { blobPath, TERRAIN_IMG } from "../../skill-board/terrain";
import VillageHouse from "./VillageHouse";
import { getHouseStage, HOUSE_IMG, avatarSrc } from "../../lib/island";
import { TOWN_ANCHOR, type LobbyLayout, type LobbyIsland, type LobbySlot, type LobbyArea, type Pt } from "./lobby-layout";

export type LobbyMode = "free" | "world" | "area" | "island";
export type LobbyCamCmd = { key: number; mode: "world" | "area" | "island" | "back"; area?: string; userId?: string };
/** カメラの履歴（戻る操作で直前の位置・倍率へ復帰する） */
type CamHist = { cam: Cam; mode: LobbyMode; area: string | null; focus: string | null };
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** 画面中央に見えるワールド座標と倍率を補間してカメラを組み立てる（ズームしながらの移動で中心が流れない） */
function lerpCam(from: Cam, to: Cam, e: number, vp: Viewport): Cam {
    const cx = vp.w / 2, cy = vp.h / 2;
    const f = { x: (cx - from.x) / from.s, y: (cy - from.y) / from.s }, t = { x: (cx - to.x) / to.s, y: (cy - to.y) / to.s };
    const s = from.s * Math.pow(to.s / from.s, e);
    const wx = f.x + (t.x - f.x) * e, wy = f.y + (t.y - f.y) * e;
    return { s, x: cx - wx * s, y: cy - wy * s };
}

const ISLAND_W = 420;        // DayIslandScene の描画幅（固定）
const ISLAND_SCALE = 0.62;   // ロビー内での縮小率
/** ロビー専用素材（GPT 制作）。未配置なら既存 /world/ 素材にフォールバック */
const LOBBY_IMG = {
    grass: "/world/lobby_tile_grass.png", cliff: "/world/lobby_cliff_side.png", sky: "/world/lobby_sky.jpg",
    arena: "/world/lobby_central_arena.png", board: "/world/lobby_notice_board.png", bridge: "/world/lobby_bridge_wood.png", bridge_end_l: "/world/lobby_bridge_end_l.png", bridge_mid: "/world/lobby_bridge_mid.png", bridge_end_r: "/world/lobby_bridge_end_r.png", sign: "/world/lobby_area_sign.png",
    tile_flower: "/world/lobby_tile_flower.png", tile_stone: "/world/lobby_tile_stone.png", tile_plaza: "/world/lobby_tile_plaza.png", tile_crystal: "/world/lobby_tile_crystal.png",
    waterfall: "/world/lobby_waterfall.png", cloud: "/world/lobby_cloud_wisp.png", flag: "/world/lobby_flag_pole.png", base: "/world/lobby_island_base.png", cobble: "/world/lobby_tile_cobble.png",
    far_a: "/world/lobby_bg_island_a.png", far_b: "/world/lobby_bg_island_b.png", far_c: "/world/lobby_bg_island_c.png",
};
/** エリアのテーマ（街の個性）。事業部名には固定せず、エリアの並び順で循環して割り当てる。
 *  base：地面タイル（既存 /world/）、overlay：GPT 差分タイル、decor：装飾画像の候補（k 0〜1 で選ぶ）、landmark：目印 */
type Theme = { key: string; label: string; base: string; baseSize: number; overlay?: keyof typeof LOBBY_IMG; overlayOpacity: number; tint: string; road: string;
    decor: { src: string; w: number; min: number }[]; edgeDecor: { src: string; w: number; min: number }[]; landmark: { src: string; w: number; dy: number }[] };
const T = (src: string, w: number, min: number) => ({ src, w, min });
/** WORLD 表示用の「街並み」画像（ChatGPT 制作）。テーマキー → 画像パス。未設定／未配置のテーマは既存の島表示にフォールバック。
 *  仕様：正方形 1024×1024 推奨、透過 PNG、下端中央 = エリア中心（画像の下 12% は崖の厚みに重なる前提）。幅はエリア半径の 1.7 倍で描画 */
const TOWN_IMG: Record<string, string | null> = {
    meadow: "/world/town_meadow.png", town: "/world/town_market.png", forest: "/world/town_forest.png", castle: "/world/town_castle.png", crystal: "/world/town_crystal.png",
};
const THEMES: Theme[] = [
    { key: "meadow", label: "草原の村", base: "/world/lobby_tile_grass.png", baseSize: 460, overlay: "tile_flower", overlayOpacity: 0.45, tint: "rgba(255,230,120,.08)", road: "#e6d3a8",
      decor: [T("/world/sm/bush_flowers.png", 90, 0), T("/world/sm/tree_round.png", 120, 0.35), T("/world/sm/rock.png", 70, 0.8)], edgeDecor: [T("/world/sm/tree_round.png", 130, 0), T("/world/sm/bush_flowers.png", 90, 0.6)],
      landmark: [{ src: "/world/start_village.png", w: 300, dy: 20 }] },
    { key: "town", label: "商業都市", base: "/world/terrain_city_stone.png", baseSize: 420, overlay: "tile_stone", overlayOpacity: 0.55, tint: "rgba(255,255,255,.06)", road: "#f1e6cf",
      decor: [T("/world/ruin_pillar.png", 70, 0), T("/world/sm/bush_flowers.png", 80, 0.4), T("/world/sm/rock.png", 60, 0.8)], edgeDecor: [T("/world/sm/tree_round.png", 110, 0), T("/world/ruin_pillar.png", 70, 0.6)],
      landmark: [{ src: "/world/plaza_round.png", w: 360, dy: 60 }, { src: "/island/deco/deco_funsui.png", w: 150, dy: 10 }] },
    { key: "forest", label: "森の集落", base: "/world/terrain_forest_floor.png", baseSize: 400, overlay: undefined, overlayOpacity: 0, tint: "rgba(20,90,40,.12)", road: "#d9c49a",
      decor: [T("/world/sm/tree_pine.png", 130, 0), T("/world/sm/tree_round.png", 130, 0.4), T("/world/sm/tree_pink.png", 140, 0.75), T("/world/sm/bush_flowers.png", 80, 0.92)], edgeDecor: [T("/world/sm/tree_pine.png", 150, 0), T("/world/sm/tree_round.png", 150, 0.5)],
      landmark: [{ src: "/world/tree_round.png", w: 360, dy: 0 }, { src: "/world/tree_pink.png", w: 220, dy: 30 }] },
    { key: "castle", label: "王都", base: "/world/terrain_highland.png", baseSize: 420, overlay: "tile_stone", overlayOpacity: 0.35, tint: "rgba(120,140,200,.10)", road: "#e8dcc4",
      decor: [T("/world/ruin_pillar.png", 70, 0), T("/world/sm/tree_pine.png", 110, 0.4), T("/world/sm/rock.png", 70, 0.8)], edgeDecor: [T("/world/lobby_flag_pole.png", 70, 0), T("/world/sm/tree_pine.png", 120, 0.45)],
      landmark: [{ src: "/world/wall_castle.png", w: 360, dy: 0 }] },
    { key: "crystal", label: "研究都市", base: "/world/terrain_ai_floor.png", baseSize: 420, overlay: "tile_crystal", overlayOpacity: 0.5, tint: "rgba(120,160,255,.12)", road: "#cfe3ff",
      decor: [T("/world/crystal_island.png", 110, 0), T("/world/ruin_pillar.png", 70, 0.5), T("/world/sm/rock.png", 60, 0.85)], edgeDecor: [T("/world/crystal_island.png", 140, 0), T("/world/sm/tree_pine.png", 110, 0.7)],
      landmark: [{ src: "/world/crystal_island.png", w: 300, dy: 0 }] },
];
const themeOf = (i: number) => THEMES[i % THEMES.length];
/** スマホは縮小版（/world/sm/、/island/house/sm/）を使ってメモリを抑える。無ければそのまま */
function smPath(src: string, sm: boolean): string {
    if (!sm) return src;
    if (src.startsWith("/world/") && !src.startsWith("/world/sm/")) return "/world/sm/" + src.slice(7);
    if (src.startsWith("/island/house/")) return "/island/house/sm/" + src.slice(14);
    if (src.startsWith("/avatars/") && !src.startsWith("/avatars/sm/")) return "/avatars/sm/" + src.slice(9);
    return src;
}
const pick = (list: { src: string; w: number; min: number }[], k: number) => { let c = list[0]; for (const it of list) if (k >= it.min) c = it; return c; };
const SIDE_H = 150;   // 浮島の厚み（崖テクスチャの高さに合わせる）
const PLAZA_SIDE = 280;   // 中央広場の崖の厚み（広場は大きいので島より厚く）
const BR_H = 120;     // 橋の高さ（幅は全区間で同じ）
const DECOR_IMG: Record<string, string> = { tree_round: "/world/sm/tree_round.png", tree_pine: "/world/sm/tree_pine.png", bush: "/world/sm/bush_flowers.png", rock: "/world/sm/rock.png" };

function clampTo(c: Cam, vp: Viewport, ww: number, wh: number, slack: { x: number; y: number }): Cam { return clampBox(c, vp, { x: 0, y: 0, w: ww, h: wh }, slack); }
/** 指定の範囲（ワールド座標の箱）から外へ出すぎないようにカメラを制限する。箱が画面より小さい倍率なら画面内で中央寄せ */
function clampBox(c: Cam, vp: Viewport, box: Box, slack: { x: number; y: number }): Cam {
    const sw = box.w * c.s, sh = box.h * c.s, ox = box.x * c.s, oy = box.y * c.s;
    const lo = (size: number, view: number, sl: number) => (size + sl <= view ? [0, view - size] : [view - size - sl, sl]);
    const [xmin, xmax] = lo(sw, vp.w, slack.x), [ymin, ymax] = lo(sh, vp.h, slack.y);
    return { s: c.s, x: Math.min(xmax - ox, Math.max(xmin - ox, c.x)), y: Math.min(ymax - oy, Math.max(ymin - oy, c.y)) };
}

/** 地形の塗り（clip-path ＋ タイル画像）。SKILL WORLD と同じ方式（iOS Safari 対応） */
function Fill({ d, w, h, ox = 0, oy = 0, dy = 0, img, size = 384, sizeH, pos, color, opacity, blend }: { d: string; w: number; h: number; ox?: number; oy?: number; dy?: number; img?: string; size?: number; sizeH?: number; pos?: string; color?: string; opacity?: number; blend?: any }) {
    const bg = [img ? `url(${img})` : "", color ?? ""].filter(Boolean).join(",");
    const clip = `path("${d}")`;
    return <div style={{ position: "absolute", left: ox, top: oy + dy, width: w, height: h, clipPath: clip, WebkitClipPath: clip, backgroundImage: bg || undefined, backgroundSize: img ? `${size}px ${sizeH ?? size}px, auto` : undefined, backgroundPosition: pos, backgroundRepeat: "repeat", opacity, mixBlendMode: blend, pointerEvents: "none" }} />;
}

/** 簡易描画の島（スマホ WORLD 用：DOM 4 つ） */
function IslandMini({ i, leader }: { i: LobbyIsland; leader: boolean }) {
    const stage = getHouseStage(i.totalEarned);
    const w = [104, 112, 120, 128, 134, 130][stage.idx] * ISLAND_SCALE * 1.15;
    return (
        <div style={{ position: "absolute", left: -ISLAND_W * ISLAND_SCALE / 2, bottom: 0, width: ISLAND_W * ISLAND_SCALE, height: 160, display: "flex", alignItems: "flex-end", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", width: 150, height: 54, borderRadius: "50%", background: leader ? "radial-gradient(ellipse at 50% 40%, #d8f5b0, #86c86a)" : "radial-gradient(ellipse at 50% 40%, #baf28b, #6fbf5e)", boxShadow: "0 10px 14px rgba(40,60,30,.25), inset 0 -8px 10px rgba(50,100,40,.3)" }} />
            <img src={smPath(HOUSE_IMG[stage.idx], true)} alt="" style={{ width: w, position: "relative", marginBottom: 36, }} />
            <img src={smPath(avatarSrc(i.avatarId), true)} alt="" style={{ position: "absolute", bottom: 26, left: "50%", transform: "translateX(28px)", width: 30, height: 30, objectFit: "cover", borderRadius: "50%", border: "2px solid #fff", boxShadow: "0 2px 4px rgba(0,0,0,.3)" }} />
        </div>
    );
}

function useLobbyImages(sm: boolean | null): Record<string, boolean> {
    const [ok, setOk] = useState<Record<string, boolean>>({});
    useEffect(() => {
        if (sm === null) return;   // 画面幅の計測前は読まない（PC/スマホで読むサイズが違う）
        // 存在確認は HEAD で行い、画像のダウンロードはしない（実際の読み込みは <img> に任せる）
        const probe = (key: string, src: string) => { fetch(smPath(src, sm), { method: "HEAD" }).then((r) => { if (r.ok) setOk((o) => ({ ...o, [key]: true })); }).catch(() => {}); };
        Object.entries(LOBBY_IMG).forEach(([k, src]) => probe(k, src));
        Object.entries(TOWN_IMG).forEach(([k, src]) => { if (src) probe("town:" + k, src); });
    }, [sm]);
    return ok;
}

export default function LobbyWorld({ layout, islands, camCmd, focusId, onIslandTap, onAreaTap, onPlazaTap, onBackgroundTap, onCamMode, hud }: {
    layout: LobbyLayout; islands: Map<string, LobbyIsland>;
    camCmd?: LobbyCamCmd; focusId: string | null;
    onIslandTap: (userId: string) => void; onAreaTap?: (areaKey: string) => void; onPlazaTap?: (kind: "arena" | "board") => void; onBackgroundTap?: () => void;
    onCamMode?: (mode: LobbyMode, area: string | null) => void;
    /** HUD が隠す範囲（ISLAND 中はカードの高さを bottom に足す） */
    hud?: Partial<Insets>;
}) {
    const { worldW, worldH, areas, slots, plaza, decor } = layout;
    const wrapRef = useRef<HTMLDivElement>(null);
    const [vp, setVp] = useState<Viewport>({ w: 0, h: 0 });   // 計測前は 0：初期カメラは計測後に1回だけ
    const isMobile = vp.w > 0 && vp.w < 640;
    const ins: Insets = { top: hud?.top ?? (isMobile ? 64 : 72), bottom: hud?.bottom ?? (isMobile ? 84 : 72), left: hud?.left ?? 0, right: hud?.right ?? 0 };
    const [cam, setCam] = useState<Cam>({ x: 0, y: 0, s: 0.2 });
    const camRef = useRef<Cam>(cam);
    const tweenCancel = useRef<(() => void) | null>(null);
    const tweenTarget = useRef<{ cam: Cam; ms: number; t0: number } | null>(null);   // 進行中のトゥイーンの目的地（割り込み後の再開・リサイズ時の再ターゲット用）
    const worldRef = useRef<HTMLDivElement>(null);     // トゥイーン中は DOM に直接 transform を書く（毎フレームの再レンダーを避ける）
    const farRef = useRef<HTMLDivElement>(null);
    const histRef = useRef<CamHist[]>([]);             // 戻る用の履歴
    const leavingArea = useRef<string | null>(null);   // WORLD へ戻るトゥイーン中も村を描き続けるためのエリア
    const modeRef = useRef<LobbyMode>("free");
    const areaRef = useRef<string | null>(null);
    const focusRef = useRef<string | null>(null);
    const initDone = useRef(false);
    const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
    const pinch = useRef<{ d: number; s: number } | null>(null);
    const tapped = useRef(false);
    const minS = Math.max(0.03, Math.min((vp.w || 1000) / layout.contentBox.w, (vp.h || 800) / layout.contentBox.h) * 0.8);   // 全体が収まる倍率より少し引ける程度まで
    const maxS = 2.0;
    const slack = isMobile ? { x: vp.w * 0.3, y: vp.h * 0.5 } : { x: vp.w * 0.35, y: vp.h * 0.35 };  // 端のエリアも中央に寄せられる余裕
    const [mode, setModeState] = useState<LobbyMode>("free");
    const lobbyImg = useLobbyImages(vp.w ? isMobile : null);
    const lite = isMobile;   // スマホ：GPU レイヤーを増やす filter / blur / 影 SVG を使わない
    const [reduceMotion, setReduceMotion] = useState(false);
    useEffect(() => { const m = window.matchMedia?.("(prefers-reduced-motion: reduce)"); if (!m) return; setReduceMotion(m.matches); const f = () => setReduceMotion(m.matches); m.addEventListener?.("change", f); return () => m.removeEventListener?.("change", f); }, []);
    const [hoverArea, setHoverArea] = useState<string | null>(null);

    useEffect(() => {
        const el = wrapRef.current; if (!el) return;
        const m = () => setVp({ w: el.clientWidth, h: el.clientHeight });
        m(); const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect();
    }, []);

    /** カメラの可動範囲：村の中（AREA / ISLAND / その後の自由操作）は村の縁＋少し外まで。WORLD はワールド全体 */
    function clamp(c: Cam): Cam {
        const ak = areaRef.current; const m = modeRef.current;
        if (ak && (m === "area" || m === "island" || m === "free")) {
            const a = areas.find((x) => x.key === ak);
            if (a) { const pad = a.r * 0.35; return clampBox(c, vp, { x: a.cx - a.r - pad, y: a.cy - a.r * 0.9 - pad - 160, w: a.r * 2 + pad * 2, h: a.r * 1.8 + pad * 2 + 320 }, { x: vp.w * 0.25, y: vp.h * 0.25 }); }
        }
        return clampTo(c, vp, worldW, worldH, slack);
    }
    function applyDom(c: Cam) {
        if (worldRef.current) { const el = worldRef.current; el.style.transform = `translate(${c.x}px,${c.y}px) scale(${c.s})`; const iv = isMobile ? Math.min(3.2, Math.max(1, 0.45 / c.s)) : Math.min(2.6, Math.max(1, 0.55 / c.s)); el.style.setProperty("--inv", String(iv)); el.style.setProperty("--invs", String(Math.min(isMobile ? 3.4 : 3.2, Math.max(1.2, iv * 1.1)))); }
        if (farRef.current) farRef.current.style.transform = `translate(${c.x * 0.3 + (vp.w / 2 - (worldW * c.s) / 2) * 0.7}px,${c.y * 0.3 + (vp.h / 2 - (worldH * c.s) / 2) * 0.7}px) scale(${c.s})`;
    }
    function setCamNow(c: Cam) { navSeq.current++; const k = clamp(c); camRef.current = k; applyDom(k); setCam(k); }
    function stopTween() { tweenCancel.current?.(); tweenCancel.current = null; tweenTarget.current = null; }
    /** from→to を ms かけて ease-in-out で補間。毎フレーム DOM に書き、React の状態は 90ms ごと＋最後に更新 */
    const [moving, setMoving] = useState(false);   // トゥイーン中（ビネットなど画面座標依存の演出を止める）
    function setAnimating(on: boolean) { setMoving(on); const el = worldRef.current; if (!el) return; el.classList.toggle("lb-anim", on); el.style.willChange = on ? "transform" : ""; }
    const navSeq = useRef(0);   // 新しい目的地が設定されるたびに増える（割り込み再開の判定用）
    function animateTo(c: Cam, ms = 600, onDone?: () => void) {
        navSeq.current++;
        stopTween(); const to = clamp(c), from = camRef.current;
        if (ms <= 0 || !vp.w || reduceMotion) { setCamNow(to); onDone?.(); return; }
        setAnimating(true);
        const t0 = performance.now(); let raf = 0;
        tweenTarget.current = { cam: to, ms, t0 };
        const step = (now: number) => {
            const t = Math.min(1, (now - t0) / ms); const k = lerpCam(from, to, easeInOutCubic(t), vp);
            camRef.current = k; applyDom(k);
            if (t >= 1) { tweenCancel.current = null; tweenTarget.current = null; setAnimating(false); setCam(k); onDone?.(); return; }
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        tweenCancel.current = () => { cancelAnimationFrame(raf); setAnimating(false); };
    }
    function setMode(m: LobbyMode, area: string | null, focus: string | null) { modeRef.current = m; areaRef.current = area; focusRef.current = focus; setModeState(m); onCamMode?.(m, area); }
    // ---- 画角の設計（各画面の倍率差を小さく、近めの視点で探索する）
    //  WORLD  ：全島を一画面に収めず、中央の闘技場と手前の街が大きく見える距離。周囲はドラッグで探索（全体は「俯瞰」で）
    //  AREA   ：村全体を小さく収めるのではなく、家・道・木の立体感が伝わる倍率（家 1 軒 ≒ PC 130px / スマホ 110px）
    //  ISLAND ：家だけを拡大せず、敷地・小道・お隣まで入る倍率。カードを除いた領域の中央に家
    //  倍率の目安（PC）：WORLD 0.27 → AREA 0.45 → ISLAND 0.72（各段 1.6〜1.7 倍）
    const SCALE = isMobile ? { world: 0.16, area: 0.38, island: 0.62 } : { world: 0.22, area: 0.45, island: 0.72 };
    /** 全体俯瞰（全島が収まる） */
    function overviewCam(): Cam { return fitBox(layout.contentBox, vp, ins, isMobile ? 0.96 : 0.97, minS, maxS); }
    /** WORLD：闘技場を中心に、少し上（奥の街）が見える位置。倍率は固定（画面が狭ければ全体俯瞰まで引く） */
    function worldCam(): Cam {
        const ov = overviewCam();
        const s = Math.max(ov.s, Math.min(SCALE.world, maxS));
        return centerCam({ x: plaza.cx, y: plaza.cy + (isMobile ? 260 : 140) }, s, vp, ins);
    }
    /** AREA：中央広場を画面の中心に置き、「広場＋主要な住宅街（中心から半径の 72% 以内の家）」が収まる倍率。
     *  島全体を小さく収めず、上下が大きく見切れない範囲で寄る（PC 0.30〜0.50、スマホ 0.26〜0.42） */
    function areaCam(key: string): Cam {
        const a = areas.find((x) => x.key === key); if (!a) return worldCam();
        const v = a.village;
        const core = slots.filter((sl) => sl.areaKey === key && Math.hypot(sl.x - v.cx, (sl.y - v.cy) / 0.9) < a.r * 0.72);
        let x0 = v.cx - v.r - 80, y0 = v.cy - v.r * 0.9 - 80, x1 = v.cx + v.r + 80, y1 = v.cy + v.r * 0.9 + 80;
        for (const sl of core) { x0 = Math.min(x0, sl.x - 170); x1 = Math.max(x1, sl.x + 170); y0 = Math.min(y0, sl.y - 250); y1 = Math.max(y1, sl.y + 70); }
        // 広場を中心に置くので、広場からの最大距離×2 を箱の大きさとする（左右・上下で非対称でも中心がずれない）
        const hw = Math.max(v.cx - x0, x1 - v.cx), hh = Math.max(v.cy - y0, y1 - v.cy);
        const fit = fitBox({ x: v.cx - hw, y: v.cy - hh, w: hw * 2, h: hh * 2 }, vp, ins, 0.94, minS, maxS);
        const lim = isMobile ? [0.26, 0.42] : [0.3, 0.5];
        const s = Math.min(lim[1], Math.max(lim[0], fit.s));
        return centerCam({ x: v.cx, y: v.cy + (isMobile ? 30 : 0) }, s, vp, ins);
    }
    function islandCam(userId: string): Cam {
        const sl = slots.find((x) => x.userId === userId); if (!sl) return worldCam();
        // 家の足元（sl.y）から少し上を、カードを除いた領域の中央に。倍率は AREA の 1.6 倍程度
        return centerCam({ x: sl.x, y: sl.y - 70 }, SCALE.island, vp, ins);
    }
    function snapshot(): CamHist { return { cam: camRef.current, mode: modeRef.current, area: areaRef.current, focus: focusRef.current }; }
    function goWorld(overview = false) {
        histRef.current = [];
        // WORLD へ引くあいだも村を描き続け、終わってから街画像に切り替える（寄った状態で急に街画像にならないように）
        leavingArea.current = areaRef.current;
        const wasWorld = modeRef.current === "world" || modeRef.current === "free";
        setMode("world", null, null);
        animateTo(overview ? overviewCam() : worldCam(), wasWorld ? 650 : 800, () => { leavingArea.current = null; setCam((c) => ({ ...c })); });
    }
    function goArea(key: string) {
        const m = modeRef.current;
        if (m === "world" || m === "free") histRef.current = [snapshot()];           // WORLD から：戻り先は今の WORLD カメラ
        else if (m === "island") histRef.current = histRef.current.slice(0, 1);        // 家から村へ：履歴を WORLD だけに
        // 村→別の村：履歴はそのまま（戻ると WORLD）
        leavingArea.current = null;
        setMode("area", key, null);
        animateTo(areaCam(key), m === "world" || m === "free" ? 850 : 750);
    }
    function goIsland(userId: string) {
        const sl = slots.find((x) => x.userId === userId); const m = modeRef.current;
        if (m === "world") histRef.current = [snapshot()];
        if (m === "area" || (m === "free" && areaRef.current === sl?.areaKey)) histRef.current = [...histRef.current.slice(0, 1), snapshot()];   // 戻り先＝今の村カメラ（ユーザーが動かした位置も含む）
        leavingArea.current = null;
        setMode("island", sl?.areaKey ?? null, userId);
        animateTo(islandCam(userId), m === "island" ? 550 : m === "area" || m === "free" ? 600 : 950);
    }
    /** 戻る：直前のカメラへ。履歴が無ければ村→WORLD の順に戻る */
    function goBack() {
        const h = histRef.current.pop();
        if (h) { if (h.mode === "world") { leavingArea.current = areaRef.current; setMode("world", null, null); animateTo(h.cam, 700, () => { leavingArea.current = null; setCam((c) => ({ ...c })); }); } else { setMode(h.mode === "free" ? "area" : h.mode, h.area, h.focus); animateTo(h.cam, 650); } return; }
        if (modeRef.current === "island" && areaRef.current) { const k = areaRef.current; setMode("area", k, null); animateTo(areaCam(k), 650); return; }
        goWorld();
    }

    // 初期カメラ：計測後に1回。以降の「画面サイズ」の変化（iOS アドレスバー等）はモードを維持して再フィット。
    // HUD の高さ（カードの出入り）は依存に入れない：目的地は go* の時点で計算済みなので、ここで snap させると移動中に跳ぶ
    useEffect(() => {
        if (!vp.w || !vp.h) return;
        if (initDone.current) {
            const target = modeRef.current === "area" && areaRef.current ? areaCam(areaRef.current) : modeRef.current === "island" && focusRef.current ? islandCam(focusRef.current) : modeRef.current === "world" ? worldCam() : null;
            if (!target) { setCamNow(camRef.current); return; }
            if (tweenTarget.current) animateTo(target, Math.max(200, tweenTarget.current.ms - (performance.now() - tweenTarget.current.t0))); else setCamNow(target);
            return;
        }
        initDone.current = true;
        if (camCmd?.mode === "island" && camCmd.userId) { setMode("island", null, camCmd.userId); setCamNow(islandCam(camCmd.userId)); }
        else if (camCmd?.mode === "area" && camCmd.area) { setMode("area", camCmd.area, null); setCamNow(areaCam(camCmd.area)); }
        else {
            // 入場演出：闘技場に寄った状態から引いて、ワールド全体を見せる（reduceMotion／スマホは即時）
            setMode("world", null, null);
            const w = worldCam();
            if (reduceMotion || lite) setCamNow(w);
            else { const start = clamp(centerCam({ x: plaza.cx, y: plaza.cy - 40 }, Math.max(minS, w.s * 0.72), vp, ins)); setCamNow(start); setTimeout(() => { if (modeRef.current === "world" && !tweenTarget.current) animateTo(w, 1200); }, 200); }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vp.w, vp.h]);
    // カメラ指示
    useEffect(() => {
        if (!camCmd || !initDone.current) return;
        if (camCmd.mode === "world") goWorld(camCmd.area === "overview"); else if (camCmd.mode === "area" && camCmd.area) goArea(camCmd.area); else if (camCmd.mode === "island" && camCmd.userId) goIsland(camCmd.userId); else if (camCmd.mode === "back") goBack();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [camCmd?.key]);

    // ---- 入力（ドラッグ／ホイール／ピンチ）
    function userTakesOver() { interrupted.current = null; if (tweenCancel.current) stopTween(); if (modeRef.current !== "free") setMode("free", areaRef.current, focusRef.current); }
    function zoomAt(ns: number, mx: number, my: number) { userTakesOver(); const c = camRef.current; const wx = (mx - c.x) / c.s, wy = (my - c.y) / c.s; setCamNow({ s: ns, x: mx - wx * ns, y: my - wy * ns }); }
    const interrupted = useRef<{ cam: Cam; ms: number; t0: number } | null>(null);
    function onPointerDown(e: React.PointerEvent) { if (pinch.current) return; interrupted.current = tweenTarget.current; stopTween(); drag.current = { x: e.clientX, y: e.clientY, cx: camRef.current.x, cy: camRef.current.y, moved: false }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }
    function onPointerMove(e: React.PointerEvent) { if (!drag.current) return; const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y; if (Math.abs(dx) + Math.abs(dy) > 4) { if (!drag.current.moved) userTakesOver(); drag.current.moved = true; } setCamNow({ s: camRef.current.s, x: drag.current.cx + dx, y: drag.current.cy + dy }); }
    function onPointerUp() {
        // 移動中に触れただけ（ドラッグしていない）なら、止めたトゥイーンを残り時間で再開する（途中で止まったままにしない）
        const it = interrupted.current; interrupted.current = null;
        // タップで別の目的地（家・村・看板）が設定された場合は再開しない：少し待ってから、その間に navSeq が進んでいなければ再開する
        if (it && !drag.current?.moved) { const seq = navSeq.current, left = Math.max(220, it.ms - (performance.now() - it.t0)); setTimeout(() => { if (navSeq.current === seq && !tweenTarget.current && !drag.current?.moved) animateTo(it.cam, left); }, 120); }
        setTimeout(() => { drag.current = null; }, 0);
    }
    function onWheel(e: React.WheelEvent) { const ns = Math.min(maxS, Math.max(minS, camRef.current.s * (e.deltaY > 0 ? 0.9 : 1.1))); const r = wrapRef.current!.getBoundingClientRect(); zoomAt(ns, e.clientX - r.left, e.clientY - r.top); }
    function onTouchStart(e: React.TouchEvent) { if (e.touches.length === 2) { pinch.current = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), s: camRef.current.s }; drag.current = null; stopTween(); } }
    function onTouchMove(e: React.TouchEvent) { if (e.touches.length === 2 && pinch.current) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); const ns = Math.min(maxS, Math.max(minS, pinch.current.s * (d / pinch.current.d))); const r = wrapRef.current!.getBoundingClientRect(); zoomAt(ns, (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top); } }
    function onTouchEnd(e: React.TouchEvent) { if (e.touches.length < 2) pinch.current = null; }
    function tapIsland(e: React.MouseEvent, userId: string) { e.stopPropagation(); if (drag.current?.moved) return; tapped.current = true; onIslandTap(userId); }
    function onWrapClick(e: React.MouseEvent) {
        if (drag.current?.moved) return;
        if (tapped.current) { tapped.current = false; return; }
        const r = wrapRef.current!.getBoundingClientRect(); const c = camRef.current;
        const wx = (e.clientX - r.left - c.x) / c.s, wy = (e.clientY - r.top - c.y) / c.s;
        // WORLD VIEW：エリアをタップでそのエリアへ（スマホ）
        if (modeRef.current === "world" && isMobile) { const a = areas.find((x) => Math.hypot(wx - x.cx, (wy - x.cy) / 0.9) < x.r); if (a) { onAreaTap?.(a.key); return; } }
        if (modeRef.current === "island") onBackgroundTap?.();
    }

    // ---- 描画の切り替え（スマホ WORLD は簡易描画）
    // WORLD（引き）では家・名前を主張させずエリアを主役に：PC でも簡易描画。寄ったら詳細
    const detailAll = cam.s > 0.5;
    const inCurArea = (sl: LobbySlot) => sl.areaKey === areaRef.current && (mode === "area" || mode === "island" || (mode === "free" && cam.s > 0.3));
    const detailFor = (sl: LobbySlot) => detailAll || inCurArea(sl) || (mode === "island" && sl.userId === focusRef.current);
    const showDecor = !isMobile || cam.s > 0.3;
    // WORLD：街並み画像があるエリアは、個々の家の代わりに街1枚で表示（AREA/ISLAND で見ているエリアと、寄っているときは家を出す）
    const areaActive = (key: string) => (key === areaRef.current && (mode === "area" || mode === "island" || mode === "free")) || key === leavingArea.current;
    const townFor = (a: LobbyArea, ai: number) => { const th = themeOf(ai); return !!TOWN_IMG[th.key] && !!lobbyImg["town:" + th.key] && !areaActive(a.key) && cam.s < 0.5; };
    // 倍率に反比例するラベルの拡大率。トゥイーン中は React を再レンダーせず CSS 変数（--inv / --invs）だけ更新する
    const invOf = (sc: number) => (isMobile ? Math.min(3.2, Math.max(1, 0.45 / sc)) : Math.min(2.6, Math.max(1, 0.55 / sc)));
    const inv = invOf(cam.s);
    const sky = lobbyImg.sky ? `url(${smPath(LOBBY_IMG.sky, isMobile)}) center / cover no-repeat, linear-gradient(180deg, #9fd3ff 0%, #c9e9ff 45%, #e6f5ff 100%)` : "linear-gradient(180deg, #9fd3ff 0%, #c9e9ff 45%, #e6f5ff 100%)";
    const slotById = useMemo(() => new Map(slots.map((s) => [s.userId, s])), [slots]);
    const plazaD = useMemo(() => { const pts: Pt[] = []; for (let i = 0; i < 18; i++) { const t = (i / 18) * Math.PI * 2; pts.push({ x: plaza.cx + Math.cos(t) * plaza.r * 0.96, y: plaza.cy + Math.sin(t) * plaza.r * 0.9 }); } return blobPath(pts); }, [plaza]);
    const areaD = useMemo(() => Object.fromEntries(areas.map((a) => [a.key, blobPath(a.outline)])), [areas]);
    // 塗りレイヤーはエリアの大きさだけにする（ワールド全体サイズの div を重ねると Chrome で描画落ちする）
    type Loc = { x: number; y: number; w: number; h: number; d: string };
    const locOf = (pts: Pt[], padB: number): Loc => { const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y); const x = Math.floor(Math.min(...xs)) - 40, y = Math.floor(Math.min(...ys)) - 40; const w = Math.ceil(Math.max(...xs)) + 40 - x, h = Math.ceil(Math.max(...ys)) + 40 + padB - y; return { x, y, w, h, d: blobPath(pts.map((p) => ({ x: p.x - x, y: p.y - y }))) }; };
    const areaL = useMemo(() => Object.fromEntries(areas.map((a) => [a.key, locOf(a.outline, SIDE_H + 60)])), [areas]);
    const plazaL = useMemo(() => { const pts: Pt[] = []; for (let i = 0; i < 18; i++) { const t = (i / 18) * Math.PI * 2; pts.push({ x: plaza.cx + Math.cos(t) * plaza.r * 0.96, y: plaza.cy + Math.sin(t) * plaza.r * 0.9 }); } return locOf(pts, PLAZA_SIDE + 60); }, [plaza]);

    return (
        <div ref={wrapRef} onScroll={(e) => { const el = e.currentTarget; if (el.scrollLeft || el.scrollTop) el.scrollTo(0, 0); }} onClick={onWrapClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            style={{ position: "absolute", inset: 0, overflow: "hidden", cursor: drag.current ? "grabbing" : "grab", touchAction: "none", background: sky, userSelect: "none", fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif' }}>
            <style>{`.lb-anim img, .lb-anim [data-fx] { filter: none !important; } .lb-anim * { animation-play-state: paused !important; } @keyframes lbCloud { 0%{transform:translateX(-200px)} 100%{transform:translateX(110vw)} } @keyframes lbFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} } @keyframes lbFlag { 0%{transform:rotate(-4deg)} 100%{transform:rotate(4deg)} } @keyframes lbWater { 0%{background-position:0 0} 100%{background-position:0 140px} } @keyframes lbGlow { 0%{opacity:.6} 100%{opacity:1} } @keyframes lbFadeIn { from{opacity:0} to{opacity:1} } @keyframes lbRing { 0%{transform:scale(1)} 50%{transform:scale(1.06)} 100%{transform:scale(1)} } @keyframes lbSpark { 0%{transform:translateY(0) scale(.6);opacity:.4} 100%{transform:translateY(-26px) scale(1.1);opacity:1} }`}</style>
            {lobbyImg.sky && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(235,245,255,.55), rgba(255,255,255,.42) 60%, rgba(255,255,255,.5))", pointerEvents: "none" }} />}
            {/* 遠景の雲（画面固定）＋ 遠景の浮き島（カメラ 0.3 倍追従・倍率連動） */}
            {[0, 1, 2].map((i) => (<div key={i} style={{ position: "absolute", top: `${8 + i * 30}%`, left: 0, width: 190, height: 50, background: "rgba(255,255,255,.85)", borderRadius: 999, filter: lite ? undefined : "blur(2px)", animation: `lbCloud ${180 + i * 50}s linear infinite`, animationDelay: `${-i * 40}s`, pointerEvents: "none", boxShadow: "50px -20px 0 -4px rgba(255,255,255,.8), 100px 0 0 -2px rgba(255,255,255,.85)", opacity: 0.6 }} />))}
            {!lite && <div ref={farRef} style={{ position: "absolute", left: 0, top: 0, width: worldW, height: worldH, transform: `translate(${cam.x * 0.3 + (vp.w / 2 - (worldW * cam.s) / 2) * 0.7}px,${cam.y * 0.3 + (vp.h / 2 - (worldH * cam.s) / 2) * 0.7}px) scale(${cam.s})`, transformOrigin: "0 0", pointerEvents: "none" }}>
                {[{ x: worldW * 0.06, y: worldH * 0.1, w: 380, k: "far_a" }, { x: worldW * 0.86, y: worldH * 0.06, w: 340, k: "far_b" }, { x: worldW * 0.48, y: worldH * 0.93, w: 420, k: "far_c" }].map((f, i) => (
                    lobbyImg[f.k] ? <img key={i} src={smPath((LOBBY_IMG as any)[f.k], isMobile)} alt="" style={{ position: "absolute", left: f.x, top: f.y, width: f.w, opacity: 0.85, animation: `lbFloat ${6 + i}s ease-in-out infinite alternate` }} /> : (
                    <div key={i} style={{ position: "absolute", left: f.x, top: f.y, width: f.w * 0.7, height: f.w * 0.28, opacity: 0.55, animation: `lbFloat ${6 + i}s ease-in-out infinite alternate` }}>
                        <div style={{ position: "absolute", left: "8%", right: "8%", top: "40%", bottom: -6, borderRadius: "10% 10% 50% 50% / 20% 20% 100% 100%", background: "linear-gradient(180deg,#a89a8a,#6b5a4a)" }} />
                        <div style={{ position: "absolute", inset: "0 0 45% 0", borderRadius: "50%", background: "radial-gradient(ellipse at 50% 40%, #cfeeb5, #8ecb8c)" }} />
                    </div>)
                ))}
            </div>}

            {/* ===== ワールド（画面幅の計測前は描かない：スマホ/PC で読む画像サイズが違うため） ===== */}
            {vp.w > 0 && <div ref={worldRef} style={{ position: "absolute", left: 0, top: 0, width: worldW, height: worldH, transform: `translate(${cam.x}px,${cam.y}px) scale(${cam.s})`, transformOrigin: "0 0", ["--inv" as any]: inv, ["--invs" as any]: Math.min(isMobile ? 3.4 : 3.2, Math.max(1.2, inv * 1.1)) }}>
                {/* 影（浮島の下） */}
                {!lite && <svg width={worldW} height={worldH} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
                    
                    {areas.map((a, ai) => townFor(a, ai) ? null : <path key={a.key} d={areaD[a.key]} transform="translate(0,120)" fill="#2b3a6b" opacity=".13" />)}
                    <path d={plazaD} transform="translate(0,120)" fill="#2b3a6b" opacity=".13" />
                    {/* 橋の下の影線 */}
                    {areas.map((a, ai) => <polyline key={"bl" + a.key} points={(townFor(a, ai) ? a.bridge.short : a.bridge.pts).map((p) => `${p.x},${p.y + 100}`).join(" ")} fill="none" stroke="#2b3a6b" strokeWidth="60" opacity=".12" strokeLinecap="round" strokeLinejoin="round" />)}
                </svg>}
                {/* 側面（崖）：輪郭を下にずらして茶色で塗る */}
                {areas.map((a, ai) => townFor(a, ai) ? null : lobbyImg.cliff && !lite
                    ? (() => { /* 帯の上端〜下端が岩の範囲（タイルの 105px 以降）に収まる高さにする。Fill は dy だけ下にずれているので位置から引く */ const th = Math.max(420, Math.round(0.45 * a.r + 320)); const posY = a.cy + 1.116 * a.r + 20 - th; return <Fill key={"side" + a.key} d={areaL[a.key].d} w={areaL[a.key].w} h={areaL[a.key].h} ox={areaL[a.key].x} oy={areaL[a.key].y} dy={SIDE_H} img={smPath(LOBBY_IMG.cliff, isMobile)} size={th * 3} sizeH={th} pos={`0 ${Math.round(posY - SIDE_H - areaL[a.key].y)}px`} color="linear-gradient(180deg,#5c4330,#3b2a1c)" />; })()
                    : <Fill key={"side" + a.key} d={areaL[a.key].d} w={areaL[a.key].w} h={areaL[a.key].h} ox={areaL[a.key].x} oy={areaL[a.key].y} dy={78} color="linear-gradient(180deg,#a5814f 0%,#8a6a48 40%,#5c4330 80%,#4a3626 100%)" />)}
                {lobbyImg.cliff && !lite
                    ? <Fill d={plazaL.d} w={plazaL.w} h={plazaL.h} ox={plazaL.x} oy={plazaL.y} dy={PLAZA_SIDE} img={smPath(LOBBY_IMG.cliff, isMobile)} size={1260} sizeH={420} pos={`0 ${Math.round(plaza.cy + plaza.r * 0.9 - 112 - PLAZA_SIDE - plazaL.y)}px`} color="linear-gradient(180deg,#5c4330,#3b2a1c)" />
                    : <Fill d={plazaL.d} w={plazaL.w} h={plazaL.h} ox={plazaL.x} oy={plazaL.y} dy={78} color="linear-gradient(180deg,#9a8a74 0%,#7b6a55 45%,#55483a 100%)" />}
                {/* 上面：草地タイル＋事業部色の薄い着色 */}
                {areas.map((a, ai) => townFor(a, ai) ? null : (
                    <div key={"top" + a.key}>
                        {(() => { const th = themeOf(areas.indexOf(a)); return <>
                            <Fill d={areaL[a.key].d} w={areaL[a.key].w} h={areaL[a.key].h} ox={areaL[a.key].x} oy={areaL[a.key].y} img={smPath((th.key === "town" || th.key === "castle") && lobbyImg.cobble ? LOBBY_IMG.cobble : th.base, isMobile)} size={th.baseSize} color="linear-gradient(180deg,#b9ec8f,#7ccb6a)" />
                            {!lite && th.overlay && lobbyImg[th.overlay] && <Fill d={areaL[a.key].d} w={areaL[a.key].w} h={areaL[a.key].h} ox={areaL[a.key].x} oy={areaL[a.key].y} img={smPath(LOBBY_IMG[th.overlay], isMobile)} size={448} opacity={th.overlayOpacity} />}
                            {!lite && <Fill d={areaL[a.key].d} w={areaL[a.key].w} h={areaL[a.key].h} ox={areaL[a.key].x} oy={areaL[a.key].y} color={th.tint} />}
                            {/* 縁をわずかに暗くして立体感（内側へのビネット） */}
                            {!lite && <Fill d={areaL[a.key].d} w={areaL[a.key].w} h={areaL[a.key].h} ox={areaL[a.key].x} oy={areaL[a.key].y} color={`radial-gradient(ellipse ${Math.round(a.r * 1.1)}px ${Math.round(a.r)}px at ${a.cx - areaL[a.key].x}px ${a.cy - areaL[a.key].y}px, rgba(0,0,0,0) 60%, rgba(40,60,20,.22) 100%)`} />}
                        </>; })()}
                    </div>
                ))}
                <Fill d={plazaL.d} w={plazaL.w} h={plazaL.h} ox={plazaL.x} oy={plazaL.y} img={smPath(lobbyImg.tile_plaza ? LOBBY_IMG.tile_plaza : TERRAIN_IMG.stone, isMobile)} size={lobbyImg.tile_plaza ? 512 : 320} color="linear-gradient(180deg,#e8dcc4,#cdbfa3)" />
                {/* エリア内の道（中心→橋のたもと）＋ 画像が無い環境だけ線の橋 */}
                <svg width={worldW} height={worldH} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
                    {areas.map((a) => (
                        <g key={"br" + a.key}>
                            {!lobbyImg.bridge_mid && <><line x1={a.bridge.from.x} y1={a.bridge.from.y} x2={a.bridge.to.x} y2={a.bridge.to.y} stroke="#6b4a34" strokeWidth="46" strokeLinecap="round" />
                            <line x1={a.bridge.from.x} y1={a.bridge.from.y} x2={a.bridge.to.x} y2={a.bridge.to.y} stroke="#c9a46a" strokeWidth="34" strokeLinecap="round" strokeDasharray="22 10" /></>}
                            {/* 村の道：大通り（門→広場）と住宅街の通り。縁取り＋本体＋中央の飛び石 */}
                            {!townFor(a, areas.indexOf(a)) && a.roads.map((rd, k) => { const d = "M " + rd.pts.map((p) => `${p.x} ${p.y}`).join(" L "); const th = themeOf(areas.indexOf(a)); return (
                                <g key={"rd" + k}>
                                    <path d={d} fill="none" stroke="rgba(70,50,30,.35)" strokeWidth={rd.w + 12} strokeLinecap="round" strokeLinejoin="round" />
                                    <path d={d} fill="none" stroke={th.road} strokeWidth={rd.w} strokeLinecap="round" strokeLinejoin="round" />
                                    {rd.main && <path d={d} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth={rd.w * 0.35} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="18 26" />}
                                    {!rd.main && <path d={d} fill="none" stroke="rgba(120,90,60,.25)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="10 22" />}
                                </g>
                            ); })}
                        </g>
                    ))}
                </svg>
                {/* 中央広場：闘技場（近日公開）・掲示板 */}
                {!lobbyImg.arena && <img src={smPath(TERRAIN_IMG.plaza, isMobile)} alt="" style={{ position: "absolute", left: plaza.cx - 260, top: plaza.cy - 150, width: 520, pointerEvents: "none", opacity: .9 }} />}
                <div onClick={(e) => { e.stopPropagation(); tapped.current = true; onPlazaTap?.("arena"); }} style={{ position: "absolute", left: plaza.cx, top: plaza.cy + 260, width: 0, cursor: "pointer", zIndex: 3 }}>
                    {lobbyImg.arena && !lite && <div style={{ position: "absolute", left: -560, top: -720, width: 1120, height: 720, background: "radial-gradient(ellipse at 50% 90%, rgba(255,230,140,.55), rgba(255,230,140,0) 65%)", pointerEvents: "none", animation: reduceMotion ? undefined : "lbGlow 3.5s ease-in-out infinite alternate" }} />}
                    {lobbyImg.arena && lobbyImg.flag && [-660, 660].map((dx, k) => <img key={"af" + k} src={smPath(LOBBY_IMG.flag, isMobile)} alt="" style={{ position: "absolute", left: dx - 40, bottom: 60, width: 80, pointerEvents: "none", transform: k ? "scaleX(-1)" : undefined }} />)}
                    {lobbyImg.arena
                        ? <img src={smPath(LOBBY_IMG.arena, isMobile)} alt="" style={{ position: "absolute", left: -700, bottom: 0, width: 1400, filter: lite ? undefined : "drop-shadow(0 16px 16px rgba(0,0,0,.28)) drop-shadow(0 0 40px rgba(255,210,90,.55))", animation: "lbFloat 7s ease-in-out infinite" }} />
                        : <div style={{ position: "absolute", left: -60, bottom: 0, fontSize: 120, lineHeight: 1, filter: lite ? undefined : "drop-shadow(0 10px 10px rgba(0,0,0,.25))" }}>🏟️</div>}
                    <div style={{ position: "absolute", left: 0, top: 8, transform: "translateX(-50%) scale(var(--inv))", transformOrigin: "50% 0", padding: "6px 16px", borderRadius: 12, background: "linear-gradient(180deg,#fff,#fdf6e3)", border: "2px solid #b45309", fontSize: 14, fontWeight: 900, color: "#7c2d12", boxShadow: "0 4px 10px rgba(0,0,0,.2)", whiteSpace: "nowrap" }}>🏟️ 闘技場 <span style={{ fontSize: 11, color: "#b45309" }}>近日公開</span></div>
                </div>
                <div onClick={(e) => { e.stopPropagation(); tapped.current = true; onPlazaTap?.("board"); }} style={{ position: "absolute", left: plaza.cx - 520, top: plaza.cy + 330, width: 0, cursor: "pointer", zIndex: 4 }}>
                    {lobbyImg.board
                        ? <img src={smPath(LOBBY_IMG.board, isMobile)} alt="" style={{ position: "absolute", left: -110, bottom: 0, width: 220, filter: lite ? undefined : "drop-shadow(0 10px 10px rgba(0,0,0,.25))" }} />
                        : <div style={{ position: "absolute", left: -36, bottom: 0, fontSize: 72, lineHeight: 1, filter: lite ? undefined : "drop-shadow(0 6px 6px rgba(0,0,0,.25))" }}>📋</div>}
                    <div style={{ position: "absolute", left: 0, top: 6, transform: "translateX(-50%) scale(var(--inv))", transformOrigin: "50% 0", padding: "5px 12px", borderRadius: 10, background: "linear-gradient(180deg,#fff,#fdf6e3)", border: "2px solid #8b5cf6", fontSize: 13, fontWeight: 900, color: "#4c1d95", boxShadow: "0 4px 10px rgba(0,0,0,.2)", whiteSpace: "nowrap" }}>📋 掲示板・ランキング</div>
                </div>
                {lobbyImg.arena && <><img src="/island/deco/deco_funsui.png" alt="" style={{ position: "absolute", left: plaza.cx + 180, top: plaza.cy + 120, width: 120, pointerEvents: "none", zIndex: 4, filter: lite ? undefined : "drop-shadow(0 6px 6px rgba(0,0,0,.25))" }} /><img src="/world/sm/bush_flowers.png" alt="" style={{ position: "absolute", left: plaza.cx + 300, top: plaza.cy + 200, width: 90, pointerEvents: "none", zIndex: 4 }} /><img src="/world/sm/bush_flowers.png" alt="" style={{ position: "absolute", left: plaza.cx - 420, top: plaza.cy + 120, width: 90, pointerEvents: "none", zIndex: 4 }} /></>}
                {!lobbyImg.arena && <img src="/world/ruin_pillar.png" alt="" style={{ position: "absolute", left: plaza.cx + 170, top: plaza.cy - 120, width: 90, pointerEvents: "none", filter: lite ? undefined : "drop-shadow(0 6px 5px rgba(0,0,0,.25))" }} />}
                {/* 橋：曲線（折れ線）に沿って区間ごとに描く。両端の装飾は固定、中央の床板は繰り返し（長さに合わせて引き伸ばさない） */}
                {areas.map((a) => {
                    const P0 = townFor(a, areas.indexOf(a)) ? a.bridge.short : a.bridge.pts; const P = P0.length >= 2 ? P0 : [a.bridge.from, a.bridge.to];
                    if (!lobbyImg.bridge_mid) {
                        const mx = (a.bridge.from.x + a.bridge.to.x) / 2, my = (a.bridge.from.y + a.bridge.to.y) / 2;
                        const ang = Math.atan2(a.bridge.to.y - a.bridge.from.y, a.bridge.to.x - a.bridge.from.x) * 180 / Math.PI;
                        return <img key={"bw" + a.key} src={smPath("/world/bridge_wood.png", isMobile)} alt="" style={{ position: "absolute", left: mx - 70, top: my - 48, width: 140, transform: `rotate(${ang}deg)`, pointerEvents: "none", filter: lite ? undefined : "drop-shadow(0 6px 6px rgba(0,0,0,.25))" }} />;
                    }
                    // 画像は 1024×337。高さ BR_H に合わせた幅：左端 222、中央タイル 222、右端 222（px → ×scale）
                    const sc = BR_H / 337, wl = 222 * sc, wm = 222 * sc, wr = 222 * sc;
                    // 奥の島へ渡る橋は細く（遠近）
                    const bh = BR_H * (a.depth === "far" ? 0.7 : a.depth === "back" ? 0.8 : a.depth === "mid" ? 0.92 : 1);
                    let acc = 0;
                    return (
                        <div key={"bw" + a.key} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", zIndex: 2, filter: lite ? undefined : "drop-shadow(0 10px 8px rgba(0,0,0,.28))" }}>
                            {P.slice(0, -1).map((p, k) => {
                                const q = P[k + 1]; const dx = q.x - p.x, dy = q.y - p.y; const len = Math.hypot(dx, dy) + 2; const ang = Math.atan2(dy, dx) * 180 / Math.PI;
                                const first = k === 0, last = k === P.length - 2;
                                const capL = first ? wl : 0, capR = last ? wr : 0; const mid = Math.max(0, len - capL - capR);
                                const off = acc; acc += len - 2;   // 床板の繰り返し位置を区間をまたいで連続させる
                                return (
                                    <div key={k} style={{ position: "absolute", left: p.x, top: p.y - bh * 0.58, width: len, height: bh, transform: `rotate(${ang}deg)`, transformOrigin: `0 ${bh * 0.58}px` }}>
                                        {first && <div style={{ position: "absolute", left: 0, top: 0, width: wl, height: bh, backgroundImage: `url(${smPath(LOBBY_IMG.bridge_end_l, isMobile)})`, backgroundSize: `${wl}px ${bh}px`, backgroundRepeat: "no-repeat" }} />}
                                        <div style={{ position: "absolute", left: capL - 1, top: 0, width: mid + 2, height: bh, backgroundImage: `url(${smPath(LOBBY_IMG.bridge_mid, isMobile)})`, backgroundSize: `${wm}px ${bh}px`, backgroundRepeat: "repeat-x", backgroundPosition: `${-((off - (first ? 0 : wl)) % wm)}px 0` }} />
                                        {last && <div style={{ position: "absolute", left: capL + mid, top: 0, width: wr, height: bh, backgroundImage: `url(${smPath(LOBBY_IMG.bridge_end_r, isMobile)})`, backgroundSize: `${wr}px ${bh}px`, backgroundRepeat: "no-repeat" }} />}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
                {/* 装飾（木・茂み・岩） */}
                {showDecor && decor.map((d, i) => { const ai = areas.findIndex((a) => a.key === d.areaKey); if (ai >= 0 && townFor(areas[ai], ai)) return null; const th = themeOf(ai);
                    const it = d.kind === "flower" ? { src: "/world/sm/bush_flowers.png", w: 92 } : d.kind === "lamp" ? { src: "/world/lobby_flag_pole.png", w: 64 } : d.kind === "rock" ? { src: "/world/sm/rock.png", w: 72 } : pick(d.edge ? th.edgeDecor : th.decor.filter((x) => x.src.includes("tree")).length ? th.decor.filter((x) => x.src.includes("tree")) : th.decor, d.k);
                    const w = it.w * d.s; return <img key={"dc" + i} decoding="async" src={smPath(it.src, isMobile)} alt="" style={{ position: "absolute", left: d.x - w / 2, top: d.y - w * 0.9, width: w, zIndex: d.z, pointerEvents: "none", filter: lite ? undefined : "drop-shadow(0 4px 4px rgba(0,0,0,.2))" }} />; })}
                {/* 村の中央広場（石畳の円）と門（橋のたもとの旗） */}
                {areas.map((a, ai) => townFor(a, ai) ? null : (() => { const v = a.village; const rx = v.r, ry = v.r * 0.9; return (
                    <div key={"vp" + a.key}>
                        <div style={{ position: "absolute", left: v.cx - rx - 14, top: v.cy - ry - 14, width: rx * 2 + 28, height: ry * 2 + 28, borderRadius: "50%", background: "rgba(70,50,30,.28)", pointerEvents: "none" }} />
                        <div style={{ position: "absolute", left: v.cx - rx, top: v.cy - ry, width: rx * 2, height: ry * 2, borderRadius: "50%", backgroundImage: `url(${smPath(lobbyImg.tile_plaza ? LOBBY_IMG.tile_plaza : TERRAIN_IMG.stone, isMobile)})`, backgroundSize: "420px 420px", boxShadow: "inset 0 0 40px rgba(0,0,0,.18)", pointerEvents: "none" }} />
                        <div style={{ position: "absolute", left: v.cx - rx * 0.55, top: v.cy - ry * 0.55, width: rx * 1.1, height: ry * 1.1, borderRadius: "50%", border: "6px solid rgba(255,255,255,.25)", pointerEvents: "none" }} />
                        {lobbyImg.flag && [-1, 1].map((sd) => <img key={sd} src={smPath(LOBBY_IMG.flag, isMobile)} alt="" style={{ position: "absolute", left: v.gate.x - Math.sin(v.gateAng) * 70 * sd - 32, top: v.gate.y + Math.cos(v.gateAng) * 70 * sd - 120, width: 64, zIndex: Math.round(v.gate.y) + 2, pointerEvents: "none", transform: sd > 0 ? "scaleX(-1)" : undefined }} />)}
                    </div>
                ); })())}
                {/* テーマのランドマーク（WORLD でも見える街の目印） */}
                {areas.map((a, ai) => townFor(a, ai) || (isMobile && cam.s < 0.5 && !areaActive(a.key)) ? null : themeOf(ai).landmark.map((lm, k) => { const w = Math.min(lm.w * Math.min(1.5, Math.max(0.85, a.r / 650)), a.village.r * 1.15); return <img key={"lm" + a.key + k} src={smPath(lm.src, isMobile)} alt="" style={{ position: "absolute", left: a.landmark.x - w / 2, top: a.landmark.y - w * 0.78 + lm.dy, width: w, zIndex: Math.round(a.landmark.y) + k, pointerEvents: "none", filter: lite ? undefined : "drop-shadow(0 8px 8px rgba(0,0,0,.25))" }} />; }))}
                {/* 滝（崖から落ちる水：水タイル＋ぼかし） */}
                {areas.map((a, ai) => townFor(a, ai) ? null : lobbyImg.waterfall ? <img key={"wf" + a.key} src={smPath(LOBBY_IMG.waterfall, isMobile)} alt="" style={{ position: "absolute", left: a.waterfall.p.x - 60, top: a.waterfall.p.y - 30, width: 120, pointerEvents: "none", zIndex: 1, opacity: .95 }} /> : <div key={"wf" + a.key} style={{ position: "absolute", left: a.waterfall.p.x - 34, top: a.waterfall.p.y - 10, width: 68, height: SIDE_H + 170, backgroundImage: `url(${TERRAIN_IMG.water})`, backgroundSize: "140px 140px", borderRadius: "30% 30% 50% 50%", opacity: .85, pointerEvents: "none", zIndex: 1, WebkitMaskImage: "linear-gradient(180deg,#000 0%,#000 55%,transparent 100%)", maskImage: "linear-gradient(180deg,#000 0%,#000 55%,transparent 100%)", filter: lite ? undefined : "blur(.6px) brightness(1.15)", animation: "lbWater 1.6s linear infinite" }}><div style={{ position: "absolute", left: 4, right: 4, bottom: 24, height: 46, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(255,255,255,.95), rgba(255,255,255,0) 70%)", filter: lite ? undefined : "blur(4px)" }} /></div>)}
                {/* 島のまわりの雲（軽く浮遊感） */}
                {!lite && areas.map((a, ai) => [0, 1].map((k) => { const t = (ai * 1.7 + k * 2.4) % (Math.PI * 2); const x = a.cx + Math.cos(t) * a.r * 1.05, y = a.cy + Math.sin(t) * a.r * 0.9 + SIDE_H * 0.6; return <img key={"cl" + a.key + k} src={lobbyImg.cloud ? smPath(LOBBY_IMG.cloud, isMobile) : "/world/sm/cloud_soft.png"} alt="" style={{ position: "absolute", left: x - 190, top: y - 50, width: 380, opacity: .85, pointerEvents: "none", zIndex: 1, animation: `lbFloat ${7 + k * 2}s ease-in-out infinite alternate` }} />; }))}
                {/* エリア看板（木の看板画像＋事業部名はコードで描く） */}
                {areas.map((a) => (
                    <div key={"sg" + a.key} onClick={(e) => { e.stopPropagation(); tapped.current = true; onAreaTap?.(a.key); }} style={{ position: "absolute", left: a.cx, top: townFor(a, areas.indexOf(a)) ? a.cy + a.townW * TOWN_ANCHOR - a.townW + 70 : a.cy - a.r * 0.9 - 10, transform: `translateX(-50%) ${mode === "area" || mode === "island" ? `scale(${isMobile ? 1.7 : 1.5})` : `scale(calc(var(--invs) * ${areaActive(a.key) ? 1 : a.depth === "front" ? 1 : a.depth === "mid" ? 0.9 : 0.78}))`}`, transformOrigin: "50% 100%", zIndex: 200000, cursor: "pointer", width: lobbyImg.sign ? 260 : "auto", height: lobbyImg.sign ? 158 : "auto" }}>
                        {lobbyImg.sign && <img src={smPath(LOBBY_IMG.sign, isMobile)} alt="" style={{ position: "absolute", left: 0, top: 0, width: 260, pointerEvents: "none", filter: lite ? undefined : "drop-shadow(0 6px 6px rgba(0,0,0,.25))" }} />}
                        <div style={{ position: lobbyImg.sign ? "absolute" : "relative", left: lobbyImg.sign ? 26 : 0, right: lobbyImg.sign ? 26 : 0, top: lobbyImg.sign ? 38 : 0, textAlign: "center", padding: lobbyImg.sign ? 0 : "6px 16px", borderRadius: 12, background: lobbyImg.sign ? "transparent" : "linear-gradient(180deg,#fff,#fdf6e3)", border: lobbyImg.sign ? "none" : `2.5px solid ${a.color}`, fontSize: lobbyImg.sign ? 26 : 15, letterSpacing: lobbyImg.sign ? 0.5 : undefined, fontWeight: 900, color: lobbyImg.sign ? "#3b2410" : a.color, textShadow: lobbyImg.sign ? "0 1px 0 rgba(255,255,255,.35)" : undefined, boxShadow: lobbyImg.sign ? "none" : "0 4px 12px rgba(0,0,0,.2)", whiteSpace: "nowrap", lineHeight: 1.25 }}>
                            {a.label}<br /><span style={{ fontSize: 16, color: lobbyImg.sign ? "#6b4a2a" : "#64748b" }}>{a.count}人</span>
                        </div>
                    </div>
                ))}
                {/* 奥行き：奥（上）の島ほど薄い空気遠近（霞）をかける */}
                {!lite && areas.map((a, ai) => { if (townFor(a, ai)) return null; const op = a.depth === "far" ? 0.3 : a.depth === "back" ? 0.2 : a.depth === "mid" ? 0.07 : 0; return op < 0.03 ? null : <Fill key={"haze" + a.key} d={areaL[a.key].d} w={areaL[a.key].w} h={areaL[a.key].h} ox={areaL[a.key].x} oy={areaL[a.key].y} color={`rgba(215,235,255,${op.toFixed(2)})`} />; })}
                {/* 街並み（WORLD）：テーマ画像を中心に1枚。下端中央＝エリア中心 */}
                {areas.map((a, ai) => townFor(a, ai) ? (() => { const w = a.townW; const hov = hoverArea === a.key; const hz = a.depth === "far" ? "brightness(1.06) saturate(.78) opacity(.9)" : a.depth === "back" ? "brightness(1.04) saturate(.86)" : ""; return <img key={"town" + a.key} src={smPath(TOWN_IMG[themeOf(ai).key]!, isMobile)} alt="" onClick={(e) => { e.stopPropagation(); tapped.current = true; onAreaTap?.(a.key); }} onMouseEnter={() => setHoverArea(a.key)} onMouseLeave={() => setHoverArea((h) => (h === a.key ? null : h))} style={{ position: "absolute", left: a.cx - w / 2, top: a.cy + w * TOWN_ANCHOR - w, width: w, zIndex: Math.round(a.cy) + 5, cursor: "pointer", transform: hov ? "translateY(-10px)" : "none", transition: reduceMotion ? undefined : "transform .25s ease, filter .25s ease", filter: lite ? (hz || undefined) : hov ? "drop-shadow(0 18px 16px rgba(0,0,0,.3)) brightness(1.07) drop-shadow(0 0 22px rgba(255,235,150,.8))" : `drop-shadow(0 12px 12px rgba(0,0,0,.25)) ${hz}` }} />; })() : null)}
                {/* 島 */}
                {slots.map((sl) => {
                    const i = islands.get(sl.userId); if (!i) return null;
                    { const ai = areas.findIndex((x) => x.key === sl.areaKey); if (ai >= 0 && townFor(areas[ai], ai)) return null; if (isMobile && !detailFor(sl) && !sl.isLeader) return null; }
                    const detail = detailFor(sl); const isFocus = focusId === sl.userId;
                    const ar = areas.find((x) => x.key === sl.areaKey); const depth = ar ? 0.88 + 0.12 * Math.min(1, Math.max(0, (sl.y - (ar.cy - ar.r * 0.9)) / (ar.r * 1.8))) : 1;
                    return (
                        <div key={sl.userId} onClick={(e) => tapIsland(e, sl.userId)} style={{ position: "absolute", left: sl.x, top: sl.y, width: 0, height: 0, zIndex: Math.round(sl.z) + 10, cursor: "pointer" }}>
                            {isFocus && <>
                                {/* スポットライト：地面の光の輪＋上からの光 */}
                                <div style={{ position: "absolute", left: -260, top: -120, width: 520, height: 230, borderRadius: "50%", background: "radial-gradient(ellipse at 50% 50%, rgba(255,240,180,.55), rgba(255,240,180,.18) 45%, rgba(255,240,180,0) 70%)", pointerEvents: "none", animation: reduceMotion ? undefined : "lbGlow 2.4s ease-in-out infinite alternate" }} />
                                <div style={{ position: "absolute", left: -175, top: -70, width: 350, height: 128, borderRadius: "50%", border: "5px solid rgba(251,191,36,.95)", boxShadow: "0 0 28px rgba(251,191,36,.9), inset 0 0 28px rgba(251,191,36,.45)", pointerEvents: "none", animation: reduceMotion ? undefined : "lbRing 2.8s linear infinite" }} />
                                {!lite && [0, 1, 2, 3, 4, 5].map((k) => <div key={k} style={{ position: "absolute", left: -140 + k * 56, top: -250 - (k % 2) * 40, width: 10, height: 10, borderRadius: "50%", background: k % 2 ? "#fde68a" : "#fff", boxShadow: "0 0 10px #fde68a", pointerEvents: "none", animation: `lbSpark ${1.6 + k * 0.3}s ease-in-out infinite alternate` }} />)}
                            </>}
                            {detail ? (
                                <div style={{ position: "absolute", left: 0, bottom: 0, width: 0, transform: `scale(${(areaActive(sl.areaKey) ? 1.3 : ISLAND_SCALE * 1.6) * depth * (isFocus ? 1.12 : 1)})`, transformOrigin: "50% 100%", transition: reduceMotion ? undefined : "transform .3s ease", pointerEvents: "none" }}>
                                    <VillageHouse i={i} isLeader={sl.isLeader} focus={isFocus} dim={!!focusId && !isFocus && mode === "island"} houseSm lite={lite} flip={Math.cos(sl.faceAng) < 0} />
                                </div>
                            ) : <IslandMini i={i} leader={sl.isLeader} />}
                            {/* 名前プレート（スマホの WORLD では代表の島だけ） */}
                            {(mode === "island" ? isFocus : (sl.isLeader || isFocus || inCurArea(sl) || cam.s > 0.42)) && <div style={{ position: "absolute", left: 0, top: 14, transform: "translateX(-50%) scale(var(--inv))", transformOrigin: "50% 0", whiteSpace: "nowrap", textAlign: "center", pointerEvents: "auto", cursor: "pointer" }}>
                                <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 8, background: isFocus ? "linear-gradient(180deg,#fff7ed,#fde68a)" : "rgba(255,255,255,.92)", border: `2px solid ${isFocus ? "#f59e0b" : sl.isLeader ? "#f59e0b" : "#cbd5e1"}`, fontSize: 12.5, fontWeight: 900, color: "#1e293b", boxShadow: "0 2px 6px rgba(0,0,0,.2)" }}>{sl.isLeader ? "👑 " : ""}{i.name} <span style={{ color: "#b45309", fontSize: 11 }}>Lv.{i.level}</span></span>
                            </div>}
                        </div>
                    );
                })}
            </div>}
            {/* ISLAND：主役以外を落として視線を集める（画面座標のビネット。穴の中心＝家の位置） */}
            {mode === "island" && focusId && !lite && !moving && (() => { const sl = slots.find((x) => x.userId === focusId); if (!sl) return null; const sx = sl.x * cam.s + cam.x, sy = (sl.y - 90) * cam.s + cam.y; const R = 260 * cam.s; return <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse ${R * 1.3}px ${R}px at ${sx}px ${sy}px, rgba(20,30,70,0) 0%, rgba(20,30,70,0) 70%, rgba(20,30,70,.42) 100%)`, animation: "lbFadeIn .5s ease-out", zIndex: 5 }} />; })()}
        </div>
    );
}
