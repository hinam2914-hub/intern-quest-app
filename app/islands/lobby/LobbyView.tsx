"use client";
// みんなの島ロビー：HUD・状態（WORLD / AREA / ISLAND）・検索・ランキング。データは page.tsx から受け取る
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LobbyWorld, { type LobbyCamCmd, type LobbyMode } from "./LobbyWorld";
import IslandFocusCard, { FOCUS_CARD_H } from "./IslandFocusCard";
import RankingPanel from "./RankingPanel";
import { layoutLobby, type LobbyDept, type LobbyIsland } from "./lobby-layout";

export default function LobbyView({ islands, depts, meId, initialUserId }: { islands: LobbyIsland[]; depts: LobbyDept[]; meId: string | null; initialUserId?: string | null }) {
    const router = useRouter();
    const layout = useMemo(() => layoutLobby(islands, depts), [islands, depts]);
    const byId = useMemo(() => new Map(islands.map((i) => [i.id, i])), [islands]);
    const [isMobile, setIsMobile] = useState(false);
    const [mode, setMode] = useState<LobbyMode>("world");
    const [area, setArea] = useState<string | null>(null);
    const [focusId, setFocusId] = useState<string | null>(initialUserId && byId.has(initialUserId) ? initialUserId : null);
    const [camCmd, setCamCmd] = useState<LobbyCamCmd | undefined>(initialUserId && byId.has(initialUserId) ? { key: 1, mode: "island", userId: initialUserId } : undefined);
    const [ranking, setRanking] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [q, setQ] = useState("");
    useEffect(() => { const m = () => setIsMobile(window.innerWidth < 640); m(); window.addEventListener("resize", m); return () => window.removeEventListener("resize", m); }, []);

    const cmd = (c: Omit<LobbyCamCmd, "key">) => setCamCmd((p) => ({ key: (p?.key ?? 0) + 1, ...c }));
    const goWorld = () => { setFocusId(null); setRanking(false); cmd({ mode: "world" }); };
    const goArea = (k: string) => { setFocusId(null); setRanking(false); cmd({ mode: "area", area: k }); };
    const goIsland = (id: string) => { setFocusId(id); setRanking(false); setSearchOpen(false); setQ(""); cmd({ mode: "island", userId: id }); };
    const focus = focusId ? byId.get(focusId) ?? null : null;
    const focusArea = focus ? layout.areas.find((a) => a.key === (layout.slots.find((s) => s.userId === focus.id)?.areaKey))?.label ?? "" : "";
    const hits = q.trim() ? islands.filter((i) => i.name.includes(q.trim())).slice(0, 8) : [];
    const cardH = isMobile ? FOCUS_CARD_H.mobile : FOCUS_CARD_H.pc;
    const hud = { top: isMobile ? 64 : 72, bottom: focus ? cardH + (isMobile ? 24 : 40) : (isMobile ? 84 : 72) };

    const pill: React.CSSProperties = { background: "rgba(255,255,255,.92)", border: "1.5px solid rgba(255,255,255,.9)", boxShadow: "0 4px 14px rgba(30,41,59,.18)", backdropFilter: "blur(6px)" };
    const circleBtn = (label: string, onClick: () => void, active = false) => (
        <button onClick={onClick} style={{ ...pill, width: 44, height: 44, borderRadius: 22, border: active ? "2px solid #8b5cf6" : pill.border, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{label}</button>
    );
    const chip = (label: string, onClick: () => void, active: boolean, color = "#1e293b", key?: string) => (
        <button key={key ?? label} onClick={onClick} style={{ ...pill, padding: "8px 14px", borderRadius: 999, border: active ? `2px solid ${color}` : pill.border, background: active ? color : pill.background, color: active ? "#fff" : color, fontWeight: 900, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{label}</button>
    );

    return (
        <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
            <LobbyWorld layout={layout} islands={byId} camCmd={camCmd} focusId={focusId} hud={hud}
                onIslandTap={goIsland} onAreaTap={goArea} onPlazaTap={(k) => { if (k === "board") setRanking(true); }}
                onBackgroundTap={() => { if (focus) goWorld(); }}
                onCamMode={(m, a) => { setMode(m); setArea(a); if (m !== "island") setFocusId((f) => (m === "free" ? f : null)); }} />

            {/* ---- 上部 HUD */}
            <div style={{ position: "fixed", top: "max(10px, env(safe-area-inset-top))", left: 10, right: 10, display: "flex", alignItems: "center", gap: 8, zIndex: 50, pointerEvents: "none" }}>
                <div style={{ pointerEvents: "auto", display: "flex", gap: 8, alignItems: "center", flex: 1, minWidth: 0 }}>
                    {circleBtn("←", () => { if (focus) goWorld(); else if (mode === "area" || mode === "free") goWorld(); else router.push("/home"); })}
                    <div style={{ ...pill, padding: "8px 14px", borderRadius: 999, fontWeight: 900, fontSize: 13.5, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>🌍 みんなの島 <span style={{ color: "#8b5cf6" }}>{islands.length}人</span></div>
                </div>
                <div style={{ pointerEvents: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                    {!isMobile && (
                        <div style={{ position: "relative" }}>
                            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 名前で検索" style={{ ...pill, width: 220, padding: "10px 14px", borderRadius: 999, fontSize: 13, outline: "none", color: "#1e293b" }} />
                            {hits.length > 0 && <div style={{ position: "absolute", top: 46, left: 0, right: 0, ...pill, borderRadius: 14, padding: 6, maxHeight: 300, overflowY: "auto" }}>{hits.map((h) => <button key={h.id} onClick={() => goIsland(h.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", fontWeight: 800, fontSize: 13, borderRadius: 8 }}>{h.name} <span style={{ color: "#b45309", fontSize: 11 }}>Lv.{h.level}</span></button>)}</div>}
                        </div>
                    )}
                    {isMobile && circleBtn("🔍", () => setSearchOpen((v) => !v), searchOpen)}
                    {circleBtn("🏆", () => setRanking((v) => !v), ranking)}
                </div>
            </div>
            {/* スマホ：検索バー（上から） */}
            {isMobile && searchOpen && (
                <div style={{ position: "fixed", top: "calc(max(10px, env(safe-area-inset-top)) + 54px)", left: 10, right: 10, zIndex: 55 }}>
                    <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 名前で検索" style={{ ...pill, width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 14, fontSize: 15, outline: "none", color: "#1e293b" }} />
                    {hits.length > 0 && <div style={{ ...pill, marginTop: 6, borderRadius: 14, padding: 6, maxHeight: 260, overflowY: "auto" }}>{hits.map((h) => <button key={h.id} onClick={() => goIsland(h.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 10px", border: "none", background: "transparent", cursor: "pointer", fontWeight: 800, fontSize: 14, borderRadius: 8 }}>{h.name} <span style={{ color: "#b45309", fontSize: 11 }}>Lv.{h.level}</span></button>)}</div>}
                </div>
            )}

            {/* ---- 下部ナビ：🌍 ＋ 事業部チップ（横スクロール） */}
            {!focus && (
                <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50, padding: `8px 10px max(10px, env(safe-area-inset-bottom))`, display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", pointerEvents: "auto" }}>
                    {chip("🌍 WORLD", goWorld, mode === "world", "#4f46e5")}
                    {layout.areas.map((a) => chip(`${a.short}・${a.count}`, () => goArea(a.key), mode === "area" && area === a.key, a.color, a.key))}
                    {meId && byId.has(meId) && chip("🏠 自分の島", () => goIsland(meId), false, "#0f766e")}
                </div>
            )}

            {focus && <IslandFocusCard i={focus} areaLabel={focusArea} isMobile={isMobile} isMe={focus.id === meId} onProfile={() => router.push("/profile/" + focus.id)} onClose={goWorld} />}
            {ranking && <RankingPanel islands={islands} meId={meId} isMobile={isMobile} onPick={goIsland} onRandom={() => { const l = islands; if (l.length) goIsland(l[Math.floor(Math.random() * l.length)].id); }} onClose={() => setRanking(false)} />}
        </div>
    );
}
