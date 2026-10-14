"use client";
// 村の 1 区画：敷地（成長段階で変わる）＋家＋庭のアイテム＋アバター。
// AREA では「家の一覧」ではなく「人が暮らす区画」に見えるよう、段階ごとに敷地の見た目を変える：
//   STAGE1 テント：土の空き地            STAGE2 丸太小屋：土＋木の柵
//   STAGE3 一軒家：芝生＋花              STAGE4 大きな家：石畳の前庭
//   STAGE5 豪邸：石畳＋生垣              STAGE6 城：石畳＋旗＋金の縁取り
import { getHouseStage, HOUSE_IMG, TREE_IMG, DECO_IMG, ANIMAL_IMG, avatarSrc } from "../../lib/island";

export const LOT_W = 300;    // 区画の幅（SLOT_W と同じ）
const HOUSE_W: number[] = [118, 128, 138, 150, 160, 156];
const LOT: { w: number; h: number; bg: string; border: string }[] = [
    { w: 150, h: 70, bg: "radial-gradient(ellipse at 50% 40%, #d9c29a, #c4a97c 70%, rgba(196,169,124,0) 100%)", border: "none" },
    { w: 176, h: 80, bg: "radial-gradient(ellipse at 50% 40%, #d8c39d, #c2a67a 72%, rgba(194,166,122,0) 100%)", border: "3px dashed rgba(120,80,40,.55)" },
    { w: 196, h: 88, bg: "radial-gradient(ellipse at 50% 40%, #c9f0a0, #93d478 72%, rgba(147,212,120,0) 100%)", border: "none" },
    { w: 214, h: 96, bg: "radial-gradient(ellipse at 50% 40%, #efe6d2, #d6c8ad 72%, rgba(214,200,173,0) 100%)", border: "none" },
    { w: 232, h: 104, bg: "radial-gradient(ellipse at 50% 40%, #f1e9d8, #d8cab0 72%, rgba(216,202,176,0) 100%)", border: "4px solid rgba(70,140,70,.55)" },
    { w: 250, h: 112, bg: "radial-gradient(ellipse at 50% 40%, #fdf3d7, #e2cf9a 72%, rgba(226,207,154,0) 100%)", border: "4px solid rgba(217,160,40,.8)" },
];

function sm(src: string, on: boolean): string {
    if (!on) return src;
    if (src.startsWith("/island/house/")) return "/island/house/sm/" + src.slice(14);
    if (src.startsWith("/avatars/")) return "/avatars/sm/" + src.slice(9);
    return src;
}

export default function VillageHouse({ i, isLeader, focus, dim, houseSm, lite, flip }: {
    i: { name: string; totalEarned: number; level: number; avatarId: string; config: Record<string, string> };
    isLeader: boolean; focus: boolean; dim: boolean; houseSm: boolean; lite: boolean;
    /** 家が左を向く（通りの向きに合わせる） */
    flip: boolean;
}) {
    const st = getHouseStage(i.totalEarned); const k = st.idx; const lot = LOT[k]; const hw = HOUSE_W[k];
    const tree = i.config?.tree && TREE_IMG[i.config.tree]; const deco = i.config?.deco && DECO_IMG[i.config.deco]; const animal = i.config?.animal && ANIMAL_IMG[i.config.animal];
    const sh = lite ? undefined : "drop-shadow(0 6px 8px rgba(50,40,20,.28))";
    return (
        <div style={{ position: "absolute", left: -LOT_W / 2, bottom: -30, width: LOT_W, height: 230, pointerEvents: "none", opacity: dim ? 0.55 : 1, transition: "opacity .25s" }}>
            {/* 敷地 */}
            <div style={{ position: "absolute", left: "50%", bottom: 8, transform: "translateX(-50%)", width: lot.w, height: lot.h, borderRadius: "50%", background: lot.bg, border: lot.border, boxSizing: "border-box", opacity: .95, pointerEvents: "auto", cursor: "pointer" }} />
            {/* STAGE6：金の縁取りの内側にもう一周 */}
            {k === 5 && <div style={{ position: "absolute", left: "50%", bottom: 16, transform: "translateX(-50%)", width: lot.w - 30, height: lot.h - 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,.7)" }} />}
            {/* STAGE3 以上：花 */}
            {k >= 2 && [[-0.42, 0.55], [0.4, 0.5], [-0.3, 0.9], [0.32, 0.92]].slice(0, k >= 4 ? 4 : 2).map(([fx, fy], j) => (
                <div key={j} style={{ position: "absolute", left: `calc(50% + ${fx * lot.w}px)`, bottom: 8 + fy * lot.h * 0.35, width: 7, height: 7, borderRadius: "50%", background: j % 2 ? "#f472b6" : "#fbbf24", boxShadow: "0 0 3px rgba(255,255,255,.6)" }} />
            ))}
            {/* STAGE5 以上：生垣（左右） */}
            {k >= 4 && [-1, 1].map((sd) => <div key={sd} style={{ position: "absolute", left: `calc(50% + ${sd * lot.w * 0.43}px - 16px)`, bottom: 22, width: 32, height: 22, borderRadius: 12, background: "linear-gradient(180deg,#86d36a,#4e9f48)", boxShadow: "0 2px 3px rgba(0,0,0,.25)" }} />)}
            {/* STAGE6：旗 */}
            {k === 5 && <img decoding="async" src="/world/sm/lobby_flag_pole.png" alt="" style={{ position: "absolute", left: "50%", bottom: 40, transform: "translateX(70px)", width: 44, filter: sh }} />}
            {/* 家の足元影 */}
            <div style={{ position: "absolute", left: "50%", bottom: 30, transform: "translateX(-50%)", width: hw * .8, height: 16, borderRadius: "50%", background: "rgba(50,70,35,.32)", filter: lite ? undefined : "blur(5px)" }} />
            {/* 木（左奥） */}
            {tree && <img decoding="async" src={tree} alt="" style={{ position: "absolute", left: 28, bottom: 52, width: 92, filter: sh }} />}
            {/* 家 */}
            <img decoding="async" src={sm(HOUSE_IMG[k], houseSm)} alt="" style={{ position: "absolute", left: "50%", bottom: 36, transform: `translateX(-50%)${flip ? " scaleX(-1)" : ""}`, width: hw, pointerEvents: "auto", cursor: "pointer", filter: focus ? "drop-shadow(0 0 14px rgba(255,220,100,.9)) drop-shadow(0 8px 10px rgba(50,40,20,.3))" : sh }} />
            {/* 小道（玄関→通り側） */}
            <div style={{ position: "absolute", left: "50%", bottom: 10, transform: "translateX(-50%)", width: 54, height: 34, clipPath: "polygon(36% 0, 64% 0, 92% 100%, 8% 100%)", background: "linear-gradient(180deg,#e6d3a8,#d4bc8a)", opacity: .95 }} />
            {/* デコ（右手前） */}
            {deco && <img decoding="async" src={deco} alt="" style={{ position: "absolute", right: 34, bottom: 22, width: 58, filter: sh }} />}
            {/* どうぶつ */}
            {animal && <img decoding="async" src={animal} alt="" style={{ position: "absolute", left: "50%", bottom: 18, transform: "translateX(40px)", width: 38, filter: sh }} />}
            {/* アバター（玄関前） */}
            <img decoding="async" src={sm(avatarSrc(i.avatarId), houseSm)} alt="" style={{ position: "absolute", left: "50%", bottom: 26, transform: "translateX(-96px)", width: 50, height: 50, objectFit: "cover", borderRadius: "50%", border: `3px solid ${isLeader ? "#fbbf24" : "#fff"}`, boxShadow: "0 3px 6px rgba(0,0,0,.35)" }} />
            {/* 成長段階ピップ（6 段階） */}
            <div style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)", display: "flex", gap: 3 }}>
                {[0, 1, 2, 3, 4, 5].map((j) => <div key={j} style={{ width: 9, height: 5, borderRadius: 3, background: j <= k ? (k === 5 ? "#f59e0b" : "#22c55e") : "rgba(255,255,255,.55)", boxShadow: "0 1px 2px rgba(0,0,0,.3)" }} />)}
            </div>
        </div>
    );
}
