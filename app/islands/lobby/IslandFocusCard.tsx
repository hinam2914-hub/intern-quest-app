"use client";
// 島フォーカスカード：ISLAND モードで画面下に出る。名前・Lv・STEP・称号・免許 → プロフィールへ
// extensions：将来の「⚔️ 戦闘力」「🛡️ 装備」「🏟️ 対戦」をここに差し込む（今は空）
import type { ReactNode } from "react";
import { STEP_TITLE, titleBadges, avatarSrc, getHouseStage } from "../../lib/island";
import type { LobbyIsland } from "./lobby-layout";

export const FOCUS_CARD_H = { mobile: 230, pc: 190 };

export default function IslandFocusCard({ i, areaLabel, isMobile, isMe, onProfile, onClose, extensions }: {
    i: LobbyIsland; areaLabel: string; isMobile: boolean; isMe: boolean; onProfile: () => void; onClose: () => void; extensions?: ReactNode;
}) {
    const stage = getHouseStage(i.totalEarned);
    const wrap: React.CSSProperties = isMobile
        ? { position: "fixed", left: 8, right: 8, bottom: 8, borderRadius: 22, zIndex: 60 }
        : { position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 20, width: 560, borderRadius: 22, zIndex: 60 };
    return (
        <div onClick={(e) => e.stopPropagation()} style={{ ...wrap, background: "linear-gradient(180deg,rgba(255,255,255,.97),rgba(255,247,237,.97))", boxShadow: "0 16px 50px rgba(30,41,59,.3)", border: "2px solid #fff", paddingTop: 14, paddingLeft: 16, paddingRight: 16, paddingBottom: isMobile ? "max(12px, env(safe-area-inset-bottom))" : 12, color: "#1e293b", animation: "lbSlideUp .3s ease-out" }}>
            <style>{`@keyframes lbSlideUp{from{transform:translate(${isMobile ? "0" : "-50%"},40px);opacity:0}to{transform:translate(${isMobile ? "0" : "-50%"},0);opacity:1}}`}</style>
            <button onClick={onClose} style={{ position: "absolute", top: 10, right: 12, border: "none", background: "#e2e8f0", width: 30, height: 30, borderRadius: 15, fontWeight: 900, cursor: "pointer", color: "#475569" }}>×</button>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <img src={avatarSrc(i.avatarId)} alt="" style={{ width: 58, height: 58, borderRadius: "50%", objectFit: "cover", border: "3px solid #fde68a", boxShadow: "0 3px 8px rgba(0,0,0,.2)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 17, fontWeight: 900 }}>{i.name}</span>
                        {isMe && <span style={{ fontSize: 10, fontWeight: 900, color: "#fff", background: "#8b5cf6", borderRadius: 6, padding: "1px 6px" }}>YOU</span>}
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: "#64748b", background: "#f1f5f9", borderRadius: 6, padding: "1px 7px" }}>{areaLabel}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11.5, fontWeight: 900, color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", padding: "2px 9px", borderRadius: 999 }}>Lv.{i.level}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: "#4c1d95", background: "#ede9fe", border: "1px solid #ddd6fe", padding: "2px 9px", borderRadius: 999 }}>{i.stepNo >= 6 ? "🏆 営業デビュー" : "STEP" + i.stepNo + " " + (STEP_TITLE[i.stepNo] || "")}</span>
                        {i.streak > 0 && <span style={{ fontSize: 11.5, fontWeight: 800, color: "#c2410c", background: "#ffedd5", border: "1px solid #fed7aa", padding: "2px 9px", borderRadius: 999 }}>🔥 {i.streak}日連続</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>🏠 {stage.name}</span>
                        {titleBadges(i).filter((t) => !t.startsWith("🔥")).map((t, k) => <span key={k} style={{ fontSize: 10.5, fontWeight: 800, color: "#5b21b6", background: "#f5f3ff", border: "1px solid #ddd6fe", padding: "1px 8px", borderRadius: 999 }}>{t}</span>)}
                        {i.licenses?.ip && <img src="/island/licenses/license_ip.png" alt="IP" style={{ width: 20, height: 20 }} />}
                        {i.licenses?.cb && <img src="/island/licenses/license_cb.png" alt="CB" style={{ width: 20, height: 20 }} />}
                        {i.licenses?.sales && <img src="/island/licenses/license_sales.png" alt="営業昇格" style={{ width: 20, height: 20 }} />}
                    </div>
                </div>
            </div>
            {/* 拡張スロット：戦闘力・装備・対戦（将来） */}
            {extensions && <div style={{ marginTop: 10 }}>{extensions}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={onProfile} style={{ flex: 1, padding: "12px 16px", borderRadius: 14, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 900, background: "linear-gradient(135deg,#8b5cf6,#6d4bc4)", color: "#fff", boxShadow: "0 5px 16px rgba(139,92,246,.45)" }}>▶ プロフィールへ</button>
            </div>
        </div>
    );
}
