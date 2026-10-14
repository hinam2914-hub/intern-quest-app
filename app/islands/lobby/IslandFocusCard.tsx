"use client";
// 島フォーカスカード：ISLAND モードで画面下に出る「その人が主役」のパネル。
// 左：家のポートレート（成長段階）／右：名前・称号・成長ゲージ（次の段階まで）・お隣さん → プロフィールへ
// extensions：将来の「⚔️ 戦闘力」「🛡️ 装備」「🏟️ 対戦」をここに差し込む（今は空）
import type { ReactNode } from "react";
import { STEP_TITLE, titleBadges, avatarSrc, getHouseStage, HOUSE_IMG } from "../../lib/island";
import type { LobbyIsland } from "./lobby-layout";

export const FOCUS_CARD_H = { mobile: 300, pc: 236 };
const STAGE_MAX = [500, 1500, 3000, 5000, 8000, 10000];

export default function IslandFocusCard({ i, areaLabel, areaColor, isMobile, isMe, neighbors, onProfile, onClose, onPick, extensions }: {
    i: LobbyIsland; areaLabel: string; areaColor?: string; isMobile: boolean; isMe: boolean;
    /** 同じ村のお隣さん（最大 4 人） */
    neighbors: LobbyIsland[];
    onProfile: () => void; onClose: () => void; onPick: (id: string) => void; extensions?: ReactNode;
}) {
    const stage = getHouseStage(i.totalEarned); const k = stage.idx;
    const lo = k === 0 ? 0 : STAGE_MAX[k - 1], hi = STAGE_MAX[k];
    const prog = k === 5 && i.totalEarned >= hi ? 1 : Math.max(0, Math.min(1, (i.totalEarned - lo) / (hi - lo)));
    const next = k < 5 ? getHouseStage(hi).name : null;
    const wrap: React.CSSProperties = isMobile
        ? { position: "fixed", left: 8, right: 8, bottom: 8, borderRadius: 24, zIndex: 60 }
        : { position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 20, width: 640, borderRadius: 24, zIndex: 60 };
    const col = areaColor || "#8b5cf6";
    return (
        <div onClick={(e) => e.stopPropagation()} style={{ ...wrap, background: "linear-gradient(180deg,rgba(255,255,255,.97),rgba(255,247,237,.97))", boxShadow: "0 18px 50px rgba(30,41,59,.32)", border: "2px solid #fff", padding: isMobile ? "14px 14px max(12px, env(safe-area-inset-bottom))" : "16px 18px 14px", color: "#1e293b", animation: "lbSlideUp .32s ease-out", overflow: "hidden" }}>
            <style>{`@keyframes lbSlideUp{from{transform:translate(${isMobile ? "0" : "-50%"},40px);opacity:0}to{transform:translate(${isMobile ? "0" : "-50%"},0);opacity:1}} @keyframes lbBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}} @keyframes lbBar{from{width:0}}`}</style>
            {/* 事業部色の帯 */}
            <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: 6, background: `linear-gradient(90deg, ${col}, ${col}66)` }} />
            <button onClick={onClose} aria-label="閉じる" style={{ position: "absolute", top: 12, right: 12, border: "none", background: "#e2e8f0", width: 30, height: 30, borderRadius: 15, fontWeight: 900, cursor: "pointer", color: "#475569" }}>×</button>
            <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
                {/* 家のポートレート */}
                <div style={{ width: isMobile ? 104 : 124, flexShrink: 0, borderRadius: 18, background: `radial-gradient(circle at 50% 35%, #fff7d6, ${col}33 70%, ${col}22)`, border: "2px solid #fde68a", position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 8 }}>
                    <div style={{ position: "absolute", top: 6, left: 0, right: 0, textAlign: "center", fontSize: 10, fontWeight: 900, color: "#92400e", letterSpacing: .5 }}>{stage.label}</div>
                    <img src={HOUSE_IMG[k]} alt="" style={{ width: isMobile ? 76 : 92, animation: "lbBob 2.6s ease-in-out infinite", filter: "drop-shadow(0 6px 8px rgba(60,40,10,.3))" }} />
                    <img src={avatarSrc(i.avatarId)} alt="" style={{ position: "absolute", left: 6, bottom: 6, width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "2px solid #fff", boxShadow: "0 2px 5px rgba(0,0,0,.3)" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", paddingRight: 30 }}>
                        <span style={{ fontSize: 19, fontWeight: 900 }}>{i.name}</span>
                        {isMe && <span style={{ fontSize: 10, fontWeight: 900, color: "#fff", background: "#8b5cf6", borderRadius: 6, padding: "1px 6px" }}>YOU</span>}
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: col, borderRadius: 6, padding: "2px 8px" }}>{areaLabel}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11.5, fontWeight: 900, color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", padding: "2px 9px", borderRadius: 999 }}>Lv.{i.level}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: "#4c1d95", background: "#ede9fe", border: "1px solid #ddd6fe", padding: "2px 9px", borderRadius: 999 }}>{i.stepNo >= 6 ? "🏆 営業デビュー" : "STEP" + i.stepNo + " " + (STEP_TITLE[i.stepNo] || "")}</span>
                        {i.streak > 0 && <span style={{ fontSize: 11.5, fontWeight: 800, color: "#c2410c", background: "#ffedd5", border: "1px solid #fed7aa", padding: "2px 9px", borderRadius: 999 }}>🔥 {i.streak}日連続</span>}
                        {titleBadges(i).filter((t) => !t.startsWith("🔥")).slice(0, 2).map((t, j) => <span key={j} style={{ fontSize: 10.5, fontWeight: 800, color: "#5b21b6", background: "#f5f3ff", border: "1px solid #ddd6fe", padding: "2px 8px", borderRadius: 999 }}>{t}</span>)}
                        {i.licenses?.ip && <img src="/island/licenses/license_ip.png" alt="IP" style={{ width: 20, height: 20 }} />}
                        {i.licenses?.cb && <img src="/island/licenses/license_cb.png" alt="CB" style={{ width: 20, height: 20 }} />}
                        {i.licenses?.sales && <img src="/island/licenses/license_sales.png" alt="営業昇格" style={{ width: 20, height: 20 }} />}
                    </div>
                    {/* 成長ゲージ：いまの家 → 次の家 */}
                    <div style={{ marginTop: 9 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 11.5, fontWeight: 800, color: "#475569" }}>
                            <span>🏠 {stage.name}</span>
                            <span style={{ color: "#64748b", fontWeight: 700 }}>{next ? `次：${next} まで あと ${Math.max(0, hi - i.totalEarned).toLocaleString()}pt` : "🏆 最終段階に到達！"}</span>
                        </div>
                        <div style={{ position: "relative", height: 12, borderRadius: 6, background: "#e2e8f0", marginTop: 4, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.round(prog * 100)}%`, borderRadius: 6, background: k === 5 ? "linear-gradient(90deg,#f59e0b,#fbbf24)" : "linear-gradient(90deg,#22c55e,#86efac)", animation: "lbBar .7s ease-out" }} />
                        </div>
                        <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
                            {[0, 1, 2, 3, 4, 5].map((j) => <div key={j} title={getHouseStage(j === 0 ? 0 : STAGE_MAX[j - 1]).name} style={{ flex: 1, height: 6, borderRadius: 3, background: j < k ? "#22c55e" : j === k ? (k === 5 ? "#f59e0b" : "#86efac") : "#e2e8f0" }} />)}
                        </div>
                    </div>
                </div>
            </div>
            {/* 拡張スロット：戦闘力・装備・対戦（将来） */}
            {extensions && <div style={{ marginTop: 10 }}>{extensions}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
                {neighbors.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: "#64748b", marginRight: 2 }}>お隣</span>
                        {neighbors.slice(0, isMobile ? 3 : 4).map((n) => (
                            <button key={n.id} onClick={() => onPick(n.id)} title={n.name} style={{ width: 34, height: 34, borderRadius: 17, border: "2px solid #fff", padding: 0, overflow: "hidden", cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,.25)", background: "#fff" }}><img src={avatarSrc(n.avatarId)} alt={n.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></button>
                        ))}
                    </div>
                )}
                <button onClick={onProfile} style={{ flex: 1, padding: "12px 16px", borderRadius: 14, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 900, background: "linear-gradient(135deg,#8b5cf6,#6d4bc4)", color: "#fff", boxShadow: "0 5px 16px rgba(139,92,246,.45)" }}>▶ プロフィールへ</button>
            </div>
        </div>
    );
}
