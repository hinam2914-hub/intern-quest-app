"use client";
// ランキングパネル：おすすめ／レベル順／連続記録順（旧 /islands のタブ3種）。行をタップでその島へ
import { useState } from "react";
import { avatarSrc } from "../../lib/island";
import type { LobbyIsland } from "./lobby-layout";

export type RankTab = "osusume" | "level" | "streak";
export function sortIslands(list: LobbyIsland[], tab: RankTab): LobbyIsland[] {
    return [...list].sort((a, b) => tab === "osusume" ? b.stepNo - a.stepNo || b.level - a.level : tab === "level" ? b.level - a.level : b.streak - a.streak);
}

export default function RankingPanel({ islands, meId, isMobile, onPick, onRandom, onClose }: {
    islands: LobbyIsland[]; meId: string | null; isMobile: boolean; onPick: (userId: string) => void; onRandom: () => void; onClose: () => void;
}) {
    const [tab, setTab] = useState<RankTab>("osusume");
    const list = sortIslands(islands, tab);
    const wrap: React.CSSProperties = isMobile
        ? { position: "fixed", left: 0, right: 0, bottom: 0, maxHeight: "72vh", borderRadius: "22px 22px 0 0", zIndex: 70, paddingBottom: "max(12px, env(safe-area-inset-bottom))" }
        : { position: "fixed", top: 80, right: 16, bottom: 90, width: 360, borderRadius: 22, zIndex: 70 };
    const chip = (k: RankTab, label: string) => <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "8px 6px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 900, background: tab === k ? "#1e293b" : "#f1f5f9", color: tab === k ? "#fff" : "#475569" }}>{label}</button>;
    return (
        <div onClick={(e) => e.stopPropagation()} style={{ ...wrap, background: "rgba(255,255,255,.97)", boxShadow: "0 16px 50px rgba(30,41,59,.3)", border: "2px solid #fff", display: "flex", flexDirection: "column", color: "#1e293b", overflow: "hidden" }}>
            <div style={{ padding: "14px 16px 8px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 900, flex: 1 }}>🏆 ランキング</div>
                <button onClick={onClose} style={{ border: "none", background: "#e2e8f0", width: 30, height: 30, borderRadius: 15, fontWeight: 900, cursor: "pointer", color: "#475569" }}>×</button>
            </div>
            <div style={{ display: "flex", gap: 6, padding: "0 14px 10px" }}>{chip("osusume", "🌍 おすすめ")}{chip("level", "⭐ レベル順")}{chip("streak", "🔥 連続記録")}</div>
            <div style={{ overflowY: "auto", padding: "0 10px 10px" }}>
                <button onClick={onRandom} style={{ width: "100%", padding: "10px 12px", borderRadius: 14, border: "1px solid #fde68a", background: "linear-gradient(180deg,#fffbeb,#fef3c7)", cursor: "pointer", textAlign: "left", fontWeight: 900, fontSize: 13, color: "#92400e", marginBottom: 8 }}>🎲 ランダム訪問 <span style={{ fontSize: 11, color: "#b45309", fontWeight: 700 }}>ランダムな島へ移動します</span></button>
                {list.map((i, idx) => {
                    const me = i.id === meId;
                    return (
                        <button key={i.id} onClick={() => onPick(i.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12, border: me ? "2px solid #8b5cf6" : "1px solid #e2e8f0", background: me ? "#f5f3ff" : "#fff", cursor: "pointer", marginBottom: 6, textAlign: "left" }}>
                            <span style={{ width: 24, textAlign: "center", fontWeight: 900, fontSize: 13, color: idx < 3 ? "#b45309" : "#64748b" }}>{idx + 1}</span>
                            <img src={avatarSrc(i.avatarId)} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "2px solid #fde68a" }} />
                            <span style={{ flex: 1, fontWeight: 900, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}{me && <span style={{ marginLeft: 6, fontSize: 10, color: "#fff", background: "#8b5cf6", borderRadius: 6, padding: "1px 6px" }}>YOU</span>}</span>
                            <span style={{ fontSize: 11.5, fontWeight: 900, color: "#92400e", background: "#fef3c7", borderRadius: 999, padding: "2px 8px" }}>Lv.{i.level}</span>
                            {i.streak > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: "#c2410c" }}>🔥{i.streak}日</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
