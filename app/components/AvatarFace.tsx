"use client";
// 丸い顔アイコン（一覧・ランキング用）。表示の優先順位はアプリ全体で共通：
//   ① 本人が編集したアバター（avatar_config.type === "layered"）の顔アップ
//   ② 設定した職業のキャラクター（/jobs/<job>.webp）
//   ③ どちらも無ければ fallback（呼び出し側の従来表示）
import type { ReactNode } from "react";
import AvatarLayered from "./AvatarLayered";
import { defaultConfig, type AvatarConfig } from "../lib/avatar/catalog";
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

// 昔の固定アバター画像（/avatars/<id>.png）の「顔まわり」の位置：[画像の幅, 画像の高さ, 切り出しの左, 上, 一辺]。
// 画像によって全身・胸から上・頭だけと写り方が違うので、顔アイコンでは同じ大きさの顔に見えるようにここで合わせる（画像は加工しない）
const OLD_AVATAR_BOX: Record<string, number[]> = { angel_girl_long: [512,512,24,24,463], boy_center_black: [1536,1024,404,13,741], boy_hoodie_brown: [1536,1024,404,13,741], boy_mash_brown: [1122,1402,140,28,841], boy_perm_black: [1122,1402,140,28,841], boy_short_black: [1121,1403,139,28,841], boy_suit_navy: [1536,1024,414,37,706], boy_wolf_brown: [1254,1254,162,-8,924], cap_boy_short: [512,512,24,23,464], crown_girl_bob: [512,512,24,24,463], devil_boy_black: [512,512,25,24,463], flower_girl_bob: [512,512,24,23,464], galaxy_special: [512,512,24,24,463], girl_bob_brown: [1122,1402,140,28,841], girl_bun_brown: [1122,1402,140,28,841], girl_hoodie_pink: [1536,1024,387,0,762], girl_long_black: [1122,1402,140,28,841], girl_pony_brown: [1122,1402,140,28,841], girl_suit_black: [1536,1024,391,0,757], glasses_girl_bob: [512,512,23,23,464], headphone_boy_mash: [512,512,24,23,464], ribbon_girl_pony: [512,512,24,24,463], sunglasses_girl_bob: [512,512,24,23,464] };

/** 昔の固定アバターを、新しいアバターと同じ「顔アップの丸アイコン」で表示する。位置が分からない画像は上寄せで表示 */
export function OldAvatarFace({ id, size, border = "2px solid #F5D77E" }: { id: string; size: number; border?: string }) {
    const b = OLD_AVATAR_BOX[id];
    const base = { width: size, height: size, borderRadius: "50%", border, background: "#dbeafe", flexShrink: 0, boxSizing: "border-box" as const, display: "block" };
    if (!b) return <img src={`/avatars/${id}.png`} alt="" style={{ ...base, objectFit: "cover", objectPosition: "top" }} />;
    const [W, H, x, y, side] = b; const k = size / side;
    return <span role="img" aria-label="" style={{ ...base, backgroundImage: `url(/avatars/${id}.png)`, backgroundRepeat: "no-repeat", backgroundSize: `${W * k}px ${H * k}px`, backgroundPosition: `${-x * k}px ${-y * k}px`, backgroundOrigin: "border-box" }} />;
}

/** 全員を「新しいアバターの顔」でそろえて表示するための元データ（掲示板用）。表示だけで、保存されているデータは変えない。
 *  ・新しいアバターを作っている人 → そのアバター
 *  ・作っていない人 → 初期アバター。昔の固定アバターを選んでいた人は、その性別・髪型・髪色に近い初期アバターにする
 *  ・職業が未設定の人 → 服はナイトの初期服（顔アイコンでは襟元しか見えない） */
export function unifiedFaceSource(row: { job_class?: string | null; avatar_config?: any } | null | undefined): FaceSource {
    const f = faceSourceOf(row);
    if (f.cfg && f.job) return f;
    const job: JobKey = f.job || "knight";
    const id: string = typeof row?.avatar_config?.id === "string" ? row!.avatar_config.id : "";
    const base = /boy/.test(id) ? "m" : "f";
    const cfg = defaultConfig(job, base, id || undefined);
    const hair = base === "m"
        ? (/mash/.test(id) ? "m_mash" : /center/.test(id) ? "m_center" : /wolf/.test(id) ? "m_wolf" : "m_short")
        : (/long/.test(id) ? "f_long" : /pony/.test(id) ? "f_pony" : /bun/.test(id) ? "f_bun" : "f_short");
    return { job, cfg: { ...cfg, hair, hairColor: /black/.test(id) ? "black" : "brown" } };
}
