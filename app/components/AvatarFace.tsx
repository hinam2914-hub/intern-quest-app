"use client";
// 丸い顔アイコン（一覧・ランキング用）。表示の優先順位はアプリ全体で共通：
//   ① 本人が編集したアバター（avatar_config.type === "layered"）の顔アップ
//   ② 設定した職業のキャラクター（/jobs/<job>.webp）
//   ③ どちらも無ければ fallback（呼び出し側の従来表示）
import type { ReactNode } from "react";
import AvatarLayered from "./AvatarLayered";
import type { AvatarConfig } from "../lib/avatar/catalog";
import { JOBS, type JobKey } from "../onboarding/job/page";

export type FaceSource = { job: JobKey | null; cfg: AvatarConfig | null };

/** profiles の行（job_class / avatar_config）から顔アイコンの元データを作る */
export function faceSourceOf(row: { job_class?: string | null; avatar_config?: any } | null | undefined): FaceSource {
    const job = row?.job_class && JOBS.some((j) => j.key === row.job_class) ? (row.job_class as JobKey) : null;
    const ac = row?.avatar_config;
    return { job, cfg: job && ac?.type === "layered" ? (ac as AvatarConfig) : null };
}

export default function AvatarFace({ src, size, border = "2px solid #F5D77E", fallback = null }: {
    src: FaceSource | null | undefined; size: number; border?: string; fallback?: ReactNode;
}) {
    if (!src || !src.job) return <>{fallback}</>;
    const w = size * 1.7;                  // 頭まわりが円に収まる倍率
    const h = w * (1224 / 1024);
    return (
        <div style={{ position: "relative", width: size, height: size, borderRadius: "50%", overflow: "hidden", border, background: "#dbeafe", flexShrink: 0, boxSizing: "border-box" }}>
            {src.cfg ? (
                <div style={{ position: "absolute", width: w, left: size / 2 - w / 2, top: size / 2 - h * (505 / 1224) }}>
                    <AvatarLayered config={src.cfg} job={src.job} size="100%" />
                </div>
            ) : (
                <img src={`/jobs/${src.job}.webp`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }} />
            )}
        </div>
    );
}
