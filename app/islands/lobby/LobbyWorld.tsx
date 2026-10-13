"use client";
// みんなの島ロビー：ワールド描画＋カメラ（WORLD / AREA / ISLAND / free）
// 配置は lobby-layout.ts の出力をそのまま使う（ここでは座標を持たない）。
// カメラは SKILL WORLD の camera.ts（fitBox / centerCam / tweenCam）を流用。clamp だけワールドサイズが可変なので自前。
import { useEffect, useMemo, useRef, useState } from "react";
import { fitBox, centerCam, tweenCam, type Cam, type Insets, type Viewport, type Box } from "../../skill-board/camera";
import { blobPath, TERRAIN_IMG } from "../../skill-board/terrain";
import DayIslandScene from "../../components/DayIslandScene";
import { getHouseStage, HOUSE_IMG, avatarSrc } from "../../lib/island";
import type { LobbyLayout, LobbyIsland, LobbySlot, Pt } from "./lobby-layout";

export type LobbyMode = "free" | "world" | "area" | "island";
export type LobbyCamCmd = { key: number; mode: "world" | "area" | "island"; area?: string; userId?: string };

const ISLAND_W = 420;        // DayIslandScene の描画幅（固定）
const ISLAND_SCALE = 0.62;   // ロビー内での縮小率
/** ロビー専用素材（GPT 制作）。未配置なら既存 /world/ 素材にフォールバック */
const LOBBY_IMG = {
    grass: "/world/lobby_tile_grass.png", cliff: "/world/lobby_cliff_side.png", sky: "/world/lobby_sky.jpg",
    arena: "/world/lobby_central_arena.png", board: "/world/lobby_notice_board.png", bridge: "/world/lobby_bridge_wood.png", bridge_end_l: "/world/lobby_bridge_end_l.png", bridge_mid: "/world/lobby_bridge_mid.png", bridge_end_r: "/world/lobby_bridge_end_r.png", sign: "/world/lobby_area_sign.png",
    tile_flower: "/world/lobby_tile_flower.png", tile_stone: "/world/lobby_tile_stone.png", tile_plaza: "/world/lobby_tile_plaza.png", tile_crystal: "/world/lobby_tile_crystal.png",
    far_a: "/world/lobby_bg_island_a.png", far_b: "/world/lobby_bg_island_b.png", far_c: "/world/lobby_bg_island_c.png",
};
/** エリアのテーマ（街の個性）。事業部名には固定せず、エリアの並び順で循環して割り当てる。
 *  base：地面タイル（既存 /world/）、overlay：GPT 差分タイル、decor：装飾画像の候補（k 0〜1 で選ぶ）、landmark：目印 */
type Theme = { key: string; label: string; base: string; baseSize: number; overlay?: keyof typeof LOBBY_IMG; overlayOpacity: number; tint: string; road: string;
    decor: { src: string; w: number; min: number }[]; edgeDecor: { src: string; w: number; min: number }[]; landmark: { src: string; w: number; dy: number }[] };
const T = (src: string, w: number, min: number) => ({ src, w, min });
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
      decor: [T("/world/ruin_pillar.png", 70, 0), T("/world/sm/tree_pine.png", 110, 0.4), T("/world/sm/rock.png", 70, 0.8)], edgeDecor: [T("/world/stairs_stone.png", 110, 0), T("/world/sm/tree_pine.png", 120, 0.4)],
      landmark: [{ src: "/world/wall_castle.png", w: 360, dy: 0 }] },
    { key: "crystal", label: "研究都市", base: "/world/terrain_ai_floor.png", baseSize: 420, overlay: "tile_crystal", overlayOpacity: 0.5, tint: "rgba(120,160,255,.12)", road: "#cfe3ff",
      decor: [T("/world/crystal_island.png", 110, 0), T("/world/ruin_pillar.png", 70, 0.5), T("/world/sm/rock.png", 60, 0.85)], edgeDecor: [T("/world/crystal_island.png", 140, 0), T("/world/sm/tree_pine.png", 110, 0.7)],
      landmark: [{ src: "/world/crystal_island.png", w: 300, dy: 0 }] },
];
const themeOf = (i: number) => THEMES[i % THEMES.length];
const pick = (list: { src: string; w: number; min: number }[], k: number) => { let c = list[0]; for (const it of list) if (k >= it.min) c = it; return c; };
const SIDE_H = 150;   // 浮島の厚み（崖テクスチャの高さに合わせる）
const BR_H = 120;     // 橋の高さ（幅は全区間で同じ）
const DECOR_IMG: Record<string, string> = { tree_round: "/world/sm/tree_round.png", tree_pine: "/world/sm/tree_pine.png", bush: "/world/sm/bush_flowers.png", rock: "/world/sm/rock.png" };

function clampTo(c: Cam, vp: Viewport, ww: number, wh: number, slack: { x: number; y: number }): Cam {
    const sw = ww * c.s, sh = wh * c.s;
    const lo = (size: number, view: number, sl: number) => (size + sl <= view ? [0, view - size] : [view - size - sl, sl]);
    const [xmin, xmax] = lo(sw, vp.w, slack.x), [ymin, ymax] = lo(sh, vp.h, slack.y);
    return { s: c.s, x: Math.min(xmax, Math.max(xmin, c.x)), y: Math.min(ymax, Math.max(ymin, c.y)) };
}

/** 地形の塗り（clip-path ＋ タイル画像）。SKILL WORLD と同じ方式（iOS Safari 対応） */
function Fill({ d, w, h, dy = 0, img, size = 384, sizeH, pos, color, opacity, blend }: { d: string; w: number; h: number; dy?: number; img?: string; size?: number; sizeH?: number; pos?: string; color?: string; opacity?: number; blend?: any }) {
    const bg = [img ? `url(${img})` : "", color ?? ""].filter(Boolean).join(",");
    const clip = `path("${d}")`;
    return <div style={{ position: "absolute", left: 0, top: dy, width: w, height: h, clipPath: clip, WebkitClipPath: clip, backgroundImage: bg || undefined, backgroundSize: img ? `${size}px ${sizeH ?? size}px, auto` : undefined, backgroundPosition: pos, backgroundRepeat: "repeat", opacity, mixBlendMode: blend, pointerEvents: "none" }} />;
}

/** 簡易描画の島（スマホ WORLD 用：DOM 4 つ） */
function IslandMini({ i, leader }: { i: LobbyIsland; leader: boolean }) {
    const stage = getHouseStage(i.totalEarned);
    const w = [104, 112, 120, 128, 134, 130][stage.idx] * ISLAND_SCALE * 1.15;
    return (
        <div style={{ position: "absolute", left: -ISLAND_W * ISLAND_SCALE / 2, bottom: 0, width: ISLAND_W * ISLAND_SCALE, height: 160, display: "flex", alignItems: "flex-end", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", width: 150, height: 54, borderRadius: "50%", background: leader ? "radial-gradient(ellipse at 50% 40%, #d8f5b0, #86c86a)" : "radial-gradient(ellipse at 50% 40%, #baf28b, #6fbf5e)", boxShadow: "0 10px 14px rgba(40,60,30,.25), inset 0 -8px 10px rgba(50,100,40,.3)" }} />
            <img src={HOUSE_IMG[stage.idx]} alt="" style={{ width: w, position: "relative", marginBottom: 36, filter: "drop-shadow(0 5px 6px rgba(0,0,0,.25))" }} />
            <img src={avatarSrc(i.avatarId)} alt="" style={{ position: "absolute", bottom: 26, left: "50%", transform: "translateX(28px)", width: 30, height: 30, objectFit: "cover", borderRadius: "50%", border: "2px solid #fff", boxShadow: "0 2px 4px rgba(0,0,0,.3)" }} />
        </div>
    );
}

function useLobbyImages(): Record<string, boolean> {
    const [ok, setOk] = useState<Record<string, boolean>>({});
    useEffect(() => { Object.entries(LOBBY_IMG).forEach(([k, src]) => { const im = new Image(); im.onload = () => setOk((o) => ({ ...o, [k]: true })); im.src = src; }); }, []);
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
    const modeRef = useRef<LobbyMode>("free");
    const areaRef = useRef<string | null>(null);
    const focusRef = useRef<string | null>(null);
    const initDone = useRef(false);
    const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
    const pinch = useRef<{ d: number; s: number } | null>(null);
    const tapped = useRef(false);
    const minS = Math.max(0.03, Math.min((vp.w || 1000) / worldW, (vp.h || 800) / worldH) * 0.8);   // 全体が収まる倍率より少し引ける程度まで
    const maxS = 2.0;
    const slack = isMobile ? { x: vp.w * 0.3, y: vp.h * 0.5 } : { x: 0, y: 0 };
    const [mode, setModeState] = useState<LobbyMode>("free");
    const lobbyImg = useLobbyImages();

    useEffect(() => {
        const el = wrapRef.current; if (!el) return;
        const m = () => setVp({ w: el.clientWidth, h: el.clientHeight });
        m(); const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect();
    }, []);

    function clamp(c: Cam): Cam { return clampTo(c, vp, worldW, worldH, slack); }
    function setCamNow(c: Cam) { const k = clamp(c); camRef.current = k; setCam(k); }
    function stopTween() { tweenCancel.current?.(); tweenCancel.current = null; }
    function animateTo(c: Cam, ms = 600) {
        stopTween(); const to = clamp(c), from = camRef.current;
        if (ms <= 0 || !vp.w) { setCamNow(to); return; }
        tweenCancel.current = tweenCam(from, to, ms, (k) => { camRef.current = k; setCam(k); }, () => { tweenCancel.current = null; });
    }
    function setMode(m: LobbyMode, area: string | null, focus: string | null) { modeRef.current = m; areaRef.current = area; focusRef.current = focus; setModeState(m); onCamMode?.(m, area); }
    function worldCam(): Cam { return fitBox(layout.worldBox, vp, ins, isMobile ? 0.98 : 0.96, minS, maxS); }
    function areaCam(key: string): Cam {
        const a = areas.find((x) => x.key === key); if (!a) return worldCam();
        if (!isMobile) return fitBox(a.box, vp, ins, 0.92, minS, maxS);
        // スマホ：島スロットの範囲を主役に（高さ基準）、中心はエリア中心
        const uh = Math.max(80, vp.h - ins.top - ins.bottom), uw = Math.max(80, vp.w);
        const s = Math.min(0.9, Math.max(0.28, Math.min((uh * 0.92) / a.focus.h, (uw * 0.96) / a.focus.w)));
        return centerCam({ x: a.focus.x + a.focus.w / 2, y: a.focus.y + a.focus.h / 2 }, s, vp, ins);
    }
    function islandCam(userId: string): Cam {
        const sl = slots.find((x) => x.userId === userId); if (!sl) return worldCam();
        // 中心は島の座標から（家の足元 y から少し上）。ISLAND 中はカード分を bottom に足して呼ばれる
        return centerCam({ x: sl.x, y: sl.y - 110 }, isMobile ? 1.15 : 1.1, vp, ins);
    }
    function goWorld() { setMode("world", null, null); animateTo(worldCam(), 650); }
    function goArea(key: string) { setMode("area", key, null); animateTo(areaCam(key), 650); }
    function goIsland(userId: string) { const sl = slots.find((x) => x.userId === userId); setMode("island", sl?.areaKey ?? null, userId); animateTo(islandCam(userId), 650); }

    // 初期カメラ：計測後に1回。以降のリサイズ（iOS アドレスバー等）はモードを維持して再フィット
    useEffect(() => {
        if (!vp.w || !vp.h) return;
        if (initDone.current) {
            if (modeRef.current === "area" && areaRef.current) setCamNow(areaCam(areaRef.current));
            else if (modeRef.current === "island" && focusRef.current) setCamNow(islandCam(focusRef.current));
            else if (modeRef.current === "world") setCamNow(worldCam());
            else setCamNow(camRef.current);
            return;
        }
        initDone.current = true;
        if (camCmd?.mode === "island" && camCmd.userId) { setMode("island", null, camCmd.userId); setCamNow(islandCam(camCmd.userId)); }
        else if (camCmd?.mode === "area" && camCmd.area) { setMode("area", camCmd.area, null); setCamNow(areaCam(camCmd.area)); }
        else { setMode("world", null, null); setCamNow(worldCam()); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vp.w, vp.h, ins.top, ins.bottom]);
    // カメラ指示
    useEffect(() => {
        if (!camCmd || !initDone.current) return;
        if (camCmd.mode === "world") goWorld(); else if (camCmd.mode === "area" && camCmd.area) goArea(camCmd.area); else if (camCmd.mode === "island" && camCmd.userId) goIsland(camCmd.userId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [camCmd?.key]);

    // ---- 入力（ドラッグ／ホイール／ピンチ）
    function userTakesOver() { if (tweenCancel.current) stopTween(); if (modeRef.current !== "free") setMode("free", areaRef.current, focusRef.current); }
    function zoomAt(ns: number, mx: number, my: number) { userTakesOver(); const c = camRef.current; const wx = (mx - c.x) / c.s, wy = (my - c.y) / c.s; setCamNow({ s: ns, x: mx - wx * ns, y: my - wy * ns }); }
    function onPointerDown(e: React.PointerEvent) { if (pinch.current) return; stopTween(); drag.current = { x: e.clientX, y: e.clientY, cx: camRef.current.x, cy: camRef.current.y, moved: false }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }
    function onPointerMove(e: React.PointerEvent) { if (!drag.current) return; const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y; if (Math.abs(dx) + Math.abs(dy) > 4) { if (!drag.current.moved) userTakesOver(); drag.current.moved = true; } setCamNow({ s: camRef.current.s, x: drag.current.cx + dx, y: drag.current.cy + dy }); }
    function onPointerUp() { setTimeout(() => { drag.current = null; }, 0); }
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
    const inv = isMobile ? Math.min(3.2, Math.max(1, 0.45 / cam.s)) : Math.min(2.2, Math.max(1, 0.5 / cam.s));
    const sky = lobbyImg.sky ? `url(${LOBBY_IMG.sky}) center / cover no-repeat, linear-gradient(180deg, #9fd3ff 0%, #c9e9ff 45%, #e6f5ff 100%)` : "linear-gradient(180deg, #9fd3ff 0%, #c9e9ff 45%, #e6f5ff 100%)";
    const slotById = useMemo(() => new Map(slots.map((s) => [s.userId, s])), [slots]);
    const plazaD = useMemo(() => { const pts: Pt[] = []; for (let i = 0; i < 18; i++) { const t = (i / 18) * Math.PI * 2; pts.push({ x: plaza.cx + Math.cos(t) * plaza.r * 0.96, y: plaza.cy + Math.sin(t) * plaza.r * 0.9 }); } return blobPath(pts); }, [plaza]);
    const areaD = useMemo(() => Object.fromEntries(areas.map((a) => [a.key, blobPath(a.outline)])), [areas]);

    return (
        <div ref={wrapRef} onClick={onWrapClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            style={{ position: "absolute", inset: 0, overflow: "hidden", cursor: drag.current ? "grabbing" : "grab", touchAction: "none", background: sky, userSelect: "none", fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif' }}>
            <style>{`@keyframes lbCloud { 0%{transform:translateX(-200px)} 100%{transform:translateX(110vw)} } @keyframes lbFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} } @keyframes lbFlag { 0%{transform:rotate(-4deg)} 100%{transform:rotate(4deg)} } @keyframes lbWater { 0%{background-position:0 0} 100%{background-position:0 140px} }`}</style>
            {lobbyImg.sky && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(235,245,255,.55), rgba(255,255,255,.42) 60%, rgba(255,255,255,.5))", pointerEvents: "none" }} />}
            {/* 遠景の雲（画面固定）＋ 遠景の浮き島（カメラ 0.3 倍追従・倍率連動） */}
            {[0, 1, 2].map((i) => (<div key={i} style={{ position: "absolute", top: `${8 + i * 30}%`, left: 0, width: 190, height: 50, background: "rgba(255,255,255,.85)", borderRadius: 999, filter: "blur(2px)", animation: `lbCloud ${100 + i * 35}s linear infinite`, animationDelay: `${-i * 40}s`, pointerEvents: "none", boxShadow: "50px -20px 0 -4px rgba(255,255,255,.8), 100px 0 0 -2px rgba(255,255,255,.85)", opacity: 0.6 }} />))}
            <div style={{ position: "absolute", left: 0, top: 0, width: worldW, height: worldH, transform: `translate(${cam.x * 0.3 + (vp.w / 2 - (worldW * cam.s) / 2) * 0.7}px,${cam.y * 0.3 + (vp.h / 2 - (worldH * cam.s) / 2) * 0.7}px) scale(${cam.s})`, transformOrigin: "0 0", pointerEvents: "none" }}>
                {[{ x: worldW * 0.06, y: worldH * 0.1, w: 380, k: "far_a" }, { x: worldW * 0.86, y: worldH * 0.06, w: 340, k: "far_b" }, { x: worldW * 0.48, y: worldH * 0.93, w: 420, k: "far_c" }].map((f, i) => (
                    lobbyImg[f.k] ? <img key={i} src={(LOBBY_IMG as any)[f.k]} alt="" style={{ position: "absolute", left: f.x, top: f.y, width: f.w, opacity: 0.85, animation: `lbFloat ${6 + i}s ease-in-out infinite alternate` }} /> : (
                    <div key={i} style={{ position: "absolute", left: f.x, top: f.y, width: f.w * 0.7, height: f.w * 0.28, opacity: 0.55, animation: `lbFloat ${6 + i}s ease-in-out infinite alternate` }}>
                        <div style={{ position: "absolute", left: "8%", right: "8%", top: "40%", bottom: -6, borderRadius: "10% 10% 50% 50% / 20% 20% 100% 100%", background: "linear-gradient(180deg,#a89a8a,#6b5a4a)" }} />
                        <div style={{ position: "absolute", inset: "0 0 45% 0", borderRadius: "50%", background: "radial-gradient(ellipse at 50% 40%, #cfeeb5, #8ecb8c)" }} />
                    </div>)
                ))}
            </div>

            {/* ===== ワールド ===== */}
            <div style={{ position: "absolute", left: 0, top: 0, width: worldW, height: worldH, transform: `translate(${cam.x}px,${cam.y}px) scale(${cam.s})`, transformOrigin: "0 0", willChange: "transform" }}>
                {/* 影（浮島の下） */}
                <svg width={worldW} height={worldH} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
                    <defs><filter id="lbSoft"><feGaussianBlur stdDeviation="14" /></filter></defs>
                    {areas.map((a) => <path key={a.key} d={areaD[a.key]} transform="translate(0,120)" fill="#2b3a6b" opacity=".18" filter="url(#lbSoft)" />)}
                    <path d={plazaD} transform="translate(0,120)" fill="#2b3a6b" opacity=".18" filter="url(#lbSoft)" />
                    {/* 橋の下の影線 */}
                    {areas.map((a) => <line key={"bl" + a.key} x1={a.bridge.from.x} y1={a.bridge.from.y + 100} x2={a.bridge.to.x} y2={a.bridge.to.y + 100} stroke="#2b3a6b" strokeWidth="60" opacity=".12" strokeLinecap="round" filter="url(#lbSoft)" />)}
                </svg>
                {/* 側面（崖）：輪郭を下にずらして茶色で塗る */}
                {areas.map((a) => lobbyImg.cliff
                    ? (() => { /* 帯の上端〜下端が岩の範囲（タイルの 105px 以降）に収まる高さにする。Fill は dy だけ下にずれているので位置から引く */ const th = Math.max(420, Math.round(0.45 * a.r + 320)); const posY = a.cy + 1.116 * a.r + 20 - th; return <Fill key={"side" + a.key} d={areaD[a.key]} w={worldW} h={worldH} dy={SIDE_H} img={LOBBY_IMG.cliff} size={th * 3} sizeH={th} pos={`0 ${Math.round(posY - SIDE_H)}px`} color="linear-gradient(180deg,#5c4330,#3b2a1c)" />; })()
                    : <Fill key={"side" + a.key} d={areaD[a.key]} w={worldW} h={worldH} dy={78} color="linear-gradient(180deg,#a5814f 0%,#8a6a48 40%,#5c4330 80%,#4a3626 100%)" />)}
                {lobbyImg.cliff
                    ? <Fill d={plazaD} w={worldW} h={worldH} dy={SIDE_H} img={LOBBY_IMG.cliff} size={1260} sizeH={420} pos={`0 ${Math.round(plaza.cy + plaza.r * 0.9 + 20 - 420 - SIDE_H)}px`} color="linear-gradient(180deg,#5c4330,#3b2a1c)" />
                    : <Fill d={plazaD} w={worldW} h={worldH} dy={78} color="linear-gradient(180deg,#9a8a74 0%,#7b6a55 45%,#55483a 100%)" />}
                {/* 上面：草地タイル＋事業部色の薄い着色 */}
                {areas.map((a) => (
                    <div key={"top" + a.key}>
                        {(() => { const th = themeOf(areas.indexOf(a)); return <>
                            <Fill d={areaD[a.key]} w={worldW} h={worldH} img={th.base} size={th.baseSize} color="linear-gradient(180deg,#b9ec8f,#7ccb6a)" />
                            {th.overlay && lobbyImg[th.overlay] && <Fill d={areaD[a.key]} w={worldW} h={worldH} img={LOBBY_IMG[th.overlay]} size={448} opacity={th.overlayOpacity} />}
                            <Fill d={areaD[a.key]} w={worldW} h={worldH} color={th.tint} />
                            {/* 縁をわずかに暗くして立体感（内側へのビネット） */}
                            <Fill d={areaD[a.key]} w={worldW} h={worldH} color={`radial-gradient(ellipse ${Math.round(a.r * 1.1)}px ${Math.round(a.r)}px at ${a.cx}px ${a.cy}px, rgba(0,0,0,0) 60%, rgba(40,60,20,.22) 100%)`} />
                        </>; })()}
                    </div>
                ))}
                <Fill d={plazaD} w={worldW} h={worldH} img={lobbyImg.tile_plaza ? LOBBY_IMG.tile_plaza : TERRAIN_IMG.stone} size={lobbyImg.tile_plaza ? 512 : 320} color="linear-gradient(180deg,#e8dcc4,#cdbfa3)" />
                {/* エリア内の道（中心→橋のたもと）＋ 画像が無い環境だけ線の橋 */}
                <svg width={worldW} height={worldH} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
                    {areas.map((a) => (
                        <g key={"br" + a.key}>
                            {!lobbyImg.bridge_mid && <><line x1={a.bridge.from.x} y1={a.bridge.from.y} x2={a.bridge.to.x} y2={a.bridge.to.y} stroke="#6b4a34" strokeWidth="46" strokeLinecap="round" />
                            <line x1={a.bridge.from.x} y1={a.bridge.from.y} x2={a.bridge.to.x} y2={a.bridge.to.y} stroke="#c9a46a" strokeWidth="34" strokeLinecap="round" strokeDasharray="22 10" /></>}
                            <line x1={a.cx} y1={a.cy + 20} x2={a.bridge.from.x} y2={a.bridge.from.y} stroke={themeOf(areas.indexOf(a)).road} strokeWidth="26" strokeLinecap="round" opacity=".85" />
                            <ellipse cx={a.cx} cy={a.cy + 10} rx={Math.min(a.r * 0.5, 330)} ry={Math.min(a.r * 0.5, 330) * 0.8} fill="none" stroke={themeOf(areas.indexOf(a)).road} strokeWidth="18" strokeDasharray="30 26" opacity=".55" />
                        </g>
                    ))}
                </svg>
                {/* 中央広場：闘技場（近日公開）・掲示板 */}
                {!lobbyImg.arena && <img src={TERRAIN_IMG.plaza} alt="" style={{ position: "absolute", left: plaza.cx - 260, top: plaza.cy - 150, width: 520, pointerEvents: "none", opacity: .9 }} />}
                <div onClick={(e) => { e.stopPropagation(); tapped.current = true; onPlazaTap?.("arena"); }} style={{ position: "absolute", left: plaza.cx, top: plaza.cy + 150, width: 0, cursor: "pointer", zIndex: 3 }}>
                    {lobbyImg.arena
                        ? <img src={LOBBY_IMG.arena} alt="" style={{ position: "absolute", left: -470, bottom: 0, width: 940, filter: "drop-shadow(0 16px 16px rgba(0,0,0,.28)) drop-shadow(0 0 40px rgba(255,210,90,.55))", animation: "lbFloat 7s ease-in-out infinite" }} />
                        : <div style={{ position: "absolute", left: -60, bottom: 0, fontSize: 120, lineHeight: 1, filter: "drop-shadow(0 10px 10px rgba(0,0,0,.25))" }}>🏟️</div>}
                    <div style={{ position: "absolute", left: 0, top: 8, transform: `translateX(-50%) scale(${inv})`, transformOrigin: "50% 0", padding: "6px 16px", borderRadius: 12, background: "linear-gradient(180deg,#fff,#fdf6e3)", border: "2px solid #b45309", fontSize: 14, fontWeight: 900, color: "#7c2d12", boxShadow: "0 4px 10px rgba(0,0,0,.2)", whiteSpace: "nowrap" }}>🏟️ 闘技場 <span style={{ fontSize: 11, color: "#b45309" }}>近日公開</span></div>
                </div>
                <div onClick={(e) => { e.stopPropagation(); tapped.current = true; onPlazaTap?.("board"); }} style={{ position: "absolute", left: plaza.cx - 330, top: plaza.cy + 210, width: 0, cursor: "pointer", zIndex: 4 }}>
                    {lobbyImg.board
                        ? <img src={LOBBY_IMG.board} alt="" style={{ position: "absolute", left: -110, bottom: 0, width: 220, filter: "drop-shadow(0 10px 10px rgba(0,0,0,.25))" }} />
                        : <div style={{ position: "absolute", left: -36, bottom: 0, fontSize: 72, lineHeight: 1, filter: "drop-shadow(0 6px 6px rgba(0,0,0,.25))" }}>📋</div>}
                    <div style={{ position: "absolute", left: 0, top: 6, transform: `translateX(-50%) scale(${inv})`, transformOrigin: "50% 0", padding: "5px 12px", borderRadius: 10, background: "linear-gradient(180deg,#fff,#fdf6e3)", border: "2px solid #8b5cf6", fontSize: 13, fontWeight: 900, color: "#4c1d95", boxShadow: "0 4px 10px rgba(0,0,0,.2)", whiteSpace: "nowrap" }}>📋 掲示板・ランキング</div>
                </div>
                {lobbyImg.arena && <><img src="/island/deco/deco_funsui.png" alt="" style={{ position: "absolute", left: plaza.cx + 180, top: plaza.cy + 120, width: 120, pointerEvents: "none", zIndex: 4, filter: "drop-shadow(0 6px 6px rgba(0,0,0,.25))" }} /><img src="/world/sm/bush_flowers.png" alt="" style={{ position: "absolute", left: plaza.cx + 300, top: plaza.cy + 200, width: 90, pointerEvents: "none", zIndex: 4 }} /><img src="/world/sm/bush_flowers.png" alt="" style={{ position: "absolute", left: plaza.cx - 420, top: plaza.cy + 120, width: 90, pointerEvents: "none", zIndex: 4 }} /></>}
                {!lobbyImg.arena && <img src="/world/ruin_pillar.png" alt="" style={{ position: "absolute", left: plaza.cx + 170, top: plaza.cy - 120, width: 90, pointerEvents: "none", filter: "drop-shadow(0 6px 5px rgba(0,0,0,.25))" }} />}
                {/* 橋：両端の装飾は固定、中央の床板は繰り返し（長さに合わせて引き伸ばさない） */}
                {areas.map((a) => {
                    const dx = a.bridge.to.x - a.bridge.from.x, dy = a.bridge.to.y - a.bridge.from.y; const len = Math.hypot(dx, dy); const ang = Math.atan2(dy, dx) * 180 / Math.PI;
                    if (!lobbyImg.bridge_mid) {
                        const mx = (a.bridge.from.x + a.bridge.to.x) / 2, my = (a.bridge.from.y + a.bridge.to.y) / 2;
                        return <img key={"bw" + a.key} src="/world/bridge_wood.png" alt="" style={{ position: "absolute", left: mx - 70, top: my - 48, width: 140, transform: `rotate(${ang}deg)`, pointerEvents: "none", filter: "drop-shadow(0 6px 6px rgba(0,0,0,.25))" }} />;
                    }
                    // 画像は 1024×337。高さ BR_H に合わせた幅：左端 409、中央タイル 225、右端 369（px → ×scale）
                    const sc = BR_H / 337, wl = 409 * sc, wm = 225 * sc, wr = 369 * sc;
                    const mid = Math.max(0, len - wl - wr);
                    return (
                        <div key={"bw" + a.key} style={{ position: "absolute", left: a.bridge.from.x, top: a.bridge.from.y - BR_H * 0.58, width: len, height: BR_H, transform: `rotate(${ang}deg)`, transformOrigin: `0 ${BR_H * 0.58}px`, pointerEvents: "none", zIndex: 2, filter: "drop-shadow(0 10px 8px rgba(0,0,0,.28))" }}>
                            <div style={{ position: "absolute", left: 0, top: 0, width: wl, height: BR_H, backgroundImage: `url(${LOBBY_IMG.bridge_end_l})`, backgroundSize: `${wl}px ${BR_H}px`, backgroundRepeat: "no-repeat" }} />
                            <div style={{ position: "absolute", left: wl - 1, top: 0, width: mid + 2, height: BR_H, backgroundImage: `url(${LOBBY_IMG.bridge_mid})`, backgroundSize: `${wm}px ${BR_H}px`, backgroundRepeat: "repeat-x", backgroundPosition: "0 0" }} />
                            <div style={{ position: "absolute", left: wl + mid, top: 0, width: wr, height: BR_H, backgroundImage: `url(${LOBBY_IMG.bridge_end_r})`, backgroundSize: `${wr}px ${BR_H}px`, backgroundRepeat: "no-repeat" }} />
                        </div>
                    );
                })}
                {/* 装飾（木・茂み・岩） */}
                {showDecor && decor.map((d, i) => { const ai = areas.findIndex((a) => a.key === d.areaKey); const th = themeOf(ai); const it = pick(d.edge ? th.edgeDecor : th.decor, d.k); const w = it.w * d.s; return <img key={"dc" + i} src={it.src} alt="" style={{ position: "absolute", left: d.x - w / 2, top: d.y - w * 0.9, width: w, zIndex: d.z, pointerEvents: "none", filter: "drop-shadow(0 4px 4px rgba(0,0,0,.2))" }} />; })}
                {/* テーマのランドマーク（WORLD でも見える街の目印） */}
                {areas.map((a, ai) => themeOf(ai).landmark.map((lm, k) => { const w = lm.w * Math.min(1.5, Math.max(0.85, a.r / 650)); return <img key={"lm" + a.key + k} src={lm.src} alt="" style={{ position: "absolute", left: a.landmark.x - w / 2, top: a.landmark.y - w * 0.78 + lm.dy, width: w, zIndex: Math.round(a.landmark.y) + k, pointerEvents: "none", filter: "drop-shadow(0 8px 8px rgba(0,0,0,.25))" }} />; }))}
                {/* 滝（崖から落ちる水：水タイル＋ぼかし） */}
                {areas.map((a) => <div key={"wf" + a.key} style={{ position: "absolute", left: a.waterfall.p.x - 34, top: a.waterfall.p.y - 10, width: 68, height: SIDE_H + 170, backgroundImage: `url(${TERRAIN_IMG.water})`, backgroundSize: "140px 140px", borderRadius: "30% 30% 50% 50%", opacity: .85, pointerEvents: "none", zIndex: 1, WebkitMaskImage: "linear-gradient(180deg,#000 0%,#000 55%,transparent 100%)", maskImage: "linear-gradient(180deg,#000 0%,#000 55%,transparent 100%)", filter: "blur(.6px) brightness(1.15)", animation: "lbWater 1.6s linear infinite" }}><div style={{ position: "absolute", left: 4, right: 4, bottom: 24, height: 46, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(255,255,255,.95), rgba(255,255,255,0) 70%)", filter: "blur(4px)" }} /></div>)}
                {/* 島のまわりの雲（軽く浮遊感） */}
                {areas.map((a, ai) => [0, 1].map((k) => { const t = (ai * 1.7 + k * 2.4) % (Math.PI * 2); const x = a.cx + Math.cos(t) * a.r * 1.05, y = a.cy + Math.sin(t) * a.r * 0.9 + SIDE_H * 0.6; return <img key={"cl" + a.key + k} src="/world/sm/cloud_soft.png" alt="" style={{ position: "absolute", left: x - 150, top: y - 40, width: 300, opacity: .8, pointerEvents: "none", zIndex: 1, animation: `lbFloat ${7 + k * 2}s ease-in-out infinite alternate` }} />; }))}
                {/* エリア看板（木の看板画像＋事業部名はコードで描く） */}
                {areas.map((a) => (
                    <div key={"sg" + a.key} onClick={(e) => { e.stopPropagation(); tapped.current = true; onAreaTap?.(a.key); }} style={{ position: "absolute", left: a.cx, top: a.cy - a.r * 0.9 - 10, transform: `translateX(-50%) scale(${Math.min(inv, 3.2)})`, transformOrigin: "50% 100%", zIndex: 5, cursor: "pointer", width: lobbyImg.sign ? 260 : "auto", height: lobbyImg.sign ? 158 : "auto" }}>
                        {lobbyImg.sign && <img src={LOBBY_IMG.sign} alt="" style={{ position: "absolute", left: 0, top: 0, width: 260, pointerEvents: "none", filter: "drop-shadow(0 6px 6px rgba(0,0,0,.25))" }} />}
                        <div style={{ position: lobbyImg.sign ? "absolute" : "relative", left: lobbyImg.sign ? 34 : 0, right: lobbyImg.sign ? 34 : 0, top: lobbyImg.sign ? 48 : 0, textAlign: "center", padding: lobbyImg.sign ? 0 : "6px 16px", borderRadius: 12, background: lobbyImg.sign ? "transparent" : "linear-gradient(180deg,#fff,#fdf6e3)", border: lobbyImg.sign ? "none" : `2.5px solid ${a.color}`, fontSize: lobbyImg.sign ? 17 : 15, fontWeight: 900, color: lobbyImg.sign ? "#3b2410" : a.color, textShadow: lobbyImg.sign ? "0 1px 0 rgba(255,255,255,.35)" : undefined, boxShadow: lobbyImg.sign ? "none" : "0 4px 12px rgba(0,0,0,.2)", whiteSpace: "nowrap", lineHeight: 1.25 }}>
                            {a.label}<br /><span style={{ fontSize: 12, color: lobbyImg.sign ? "#6b4a2a" : "#64748b" }}>{a.count}人</span>
                        </div>
                    </div>
                ))}
                {/* 島 */}
                {slots.map((sl) => {
                    const i = islands.get(sl.userId); if (!i) return null;
                    const detail = detailFor(sl); const isFocus = focusId === sl.userId;
                    return (
                        <div key={sl.userId} onClick={(e) => tapIsland(e, sl.userId)} style={{ position: "absolute", left: sl.x, top: sl.y, width: 0, height: 0, zIndex: Math.round(sl.z) + 10, cursor: "pointer" }}>
                            {sl.isLeader && <img src={TERRAIN_IMG.plaza} alt="" style={{ position: "absolute", left: -170, top: -120, width: 340, pointerEvents: "none", opacity: .85 }} />}
                            {isFocus && <div style={{ position: "absolute", left: -150, top: -60, width: 300, height: 110, borderRadius: "50%", border: "4px solid #fbbf24", boxShadow: "0 0 24px #fbbf24, inset 0 0 24px rgba(251,191,36,.5)", pointerEvents: "none" }} />}
                            {detail ? (
                                <div style={{ position: "absolute", left: -ISLAND_W / 2, bottom: 0, width: ISLAND_W, transform: `scale(${ISLAND_SCALE})`, transformOrigin: "50% 100%", pointerEvents: "none" }}>
                                    <DayIslandScene config={i.config} totalEarned={i.totalEarned} width={ISLAND_W} />
                                    <img src={avatarSrc(i.avatarId)} alt="" style={{ position: "absolute", bottom: 86, left: "50%", transform: "translateX(-118px)", width: 54, height: 54, objectFit: "cover", borderRadius: "50%", border: "3px solid #fff", boxShadow: "0 3px 6px rgba(0,0,0,.35)", zIndex: 9 }} />
                                </div>
                            ) : <IslandMini i={i} leader={sl.isLeader} />}
                            {/* 名前プレート（スマホの WORLD では代表の島だけ） */}
                            {(sl.isLeader || isFocus || inCurArea(sl) || cam.s > 0.42) && <div style={{ position: "absolute", left: 0, top: 14, transform: `translateX(-50%) scale(${inv})`, transformOrigin: "50% 0", whiteSpace: "nowrap", textAlign: "center", pointerEvents: "none" }}>
                                <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 8, background: isFocus ? "linear-gradient(180deg,#fff7ed,#fde68a)" : "rgba(255,255,255,.92)", border: `2px solid ${isFocus ? "#f59e0b" : sl.isLeader ? "#f59e0b" : "#cbd5e1"}`, fontSize: 12.5, fontWeight: 900, color: "#1e293b", boxShadow: "0 2px 6px rgba(0,0,0,.2)" }}>{sl.isLeader ? "👑 " : ""}{i.name} <span style={{ color: "#b45309", fontSize: 11 }}>Lv.{i.level}</span></span>
                            </div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
