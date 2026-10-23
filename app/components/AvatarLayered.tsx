"use client";
// レイヤー式アバターの描画。1024×1024 の共通座標で透過 PNG を重ねる（CSS で拡大縮小してもズレない）。
// 実装用パーツが未納品の間は、職業の代表キャラクター画像（/jobs/<job>.webp）を仮表示し「素材準備中」の札を出す。
import { resolveLayers, type AvatarConfig } from "../lib/avatar/catalog";
import type { JobKey } from "../onboarding/job/page";

export default function AvatarLayered({ config, job, size = "100%", showFallback = true }: { config: AvatarConfig; job: JobKey; size?: number | string; showFallback?: boolean }) {
    const layers = resolveLayers(config, job);
    const drawable = layers.filter((l) => l.src);
    const missing = layers.filter((l) => l.missing).length;
    return (
        <div style={{ position: "relative", width: size, aspectRatio: "1024 / 1224", overflow: "hidden" }} aria-label="アバター">
            {drawable.length === 0 && showFallback && (
                <img src={`/jobs/${job}.webp`} alt="" decoding="async" style={{ position: "absolute", left: "10%", bottom: "6%", width: "80%", height: "72%", objectFit: "contain", filter: "drop-shadow(0 12px 12px rgba(30,40,80,.3))" }} />
            )}
            {drawable.map((l) => <img key={l.layer} src={l.src!} alt="" decoding="async" style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: "auto" }} />)}
            {missing > 0 && (
                <div style={{ position: "absolute", left: "50%", bottom: 6, transform: "translateX(-50%)", fontSize: 11, fontWeight: 900, color: "#92400e", background: "rgba(255,243,199,.95)", border: "1px solid #fde68a", borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>
                    パーツ素材 準備中（{missing}）
                </div>
            )}
        </div>
    );
}
