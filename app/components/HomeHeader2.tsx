"use client";
// Intern Quest 2.0｜HOME の冒険者ヘッダー。
// GPT 制作の枠画像（public/home/header_frame.webp 1500×457、文字なし）を敷き、
// 円形フレーム・Lvプレート・EXP溝・称号帯の位置（画像から計測済み）に実データを重ねる。
// 座標は画像に対する％指定なので幅が変わっても崩れない（マイページの ProfileCard2 と同方式）。
import AvatarLayered from "./AvatarLayered";
import type { AvatarConfig } from "../lib/avatar/catalog";
import type { JobKey } from "../onboarding/job/page";

const IMG = "/home/header_frame.webp";
const W = 1500, H = 457;
const pct = (l: number, t: number, w: number, h: number) => ({ left: `${(l / W) * 100}%`, top: `${(t / H) * 100}%`, width: `${(w / W) * 100}%`, height: `${(h / H) * 100}%` });

export type HomeHeader2Props = {
    name: string;
    jobName: string | null;
    level: number;
    exp: number;                 // 現在レベル内 EXP（0-99）
    streak: number;
    title: string | null;        // 直近に獲得した称号（無ければ既定文言）
    avatar: { cfg: AvatarConfig; job: JobKey } | null;
    onAvatarClick: () => void;
};

const CSS = `
.hh{position:relative;width:100%;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;--u:calc(100cqw / ${W})}
.hh-img{display:block;width:100%;height:auto}
.hh-ov{position:absolute;display:flex;align-items:center;box-sizing:border-box;min-width:0}
.hh-av{border-radius:50%;overflow:hidden;cursor:pointer;background:radial-gradient(circle at 50% 35%, #fdfbf2, #efe6d2)}
.hh-av>div{position:absolute;left:-70%;top:-68%;width:240%}
.hh-noav{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2%;color:#8a6a2b;font-weight:900;font-size:calc(var(--u)*30)}
.hh-name{font-size:calc(var(--u)*42);font-weight:900;color:#1f2a44;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hh-job{font-size:calc(var(--u)*23);font-weight:800;color:#5a6b85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hh-streak{justify-content:flex-end;font-size:calc(var(--u)*34);font-weight:900;color:#e8590c}
.hh-lv{justify-content:center;font-size:calc(var(--u)*36);font-weight:900;color:#5a3d12;text-shadow:0 1px 0 #ffe9a8}
.hh-lv small{font-size:.6em;margin-right:.08em}
.hh-expfill{border-radius:999px;overflow:hidden}
.hh-expfill>div{position:absolute;left:0;top:0;height:100%;border-radius:999px;background:linear-gradient(180deg,#5db2ff,#1f7be0);box-shadow:inset 0 2px 0 rgba(255,255,255,.5);transition:width 1s ease}
.hh-expv{justify-content:flex-end;font-size:calc(var(--u)*22);font-weight:900;color:#33486e;text-shadow:0 1px 0 rgba(255,255,255,.75)}
.hh-title{font-size:calc(var(--u)*22);font-weight:900;color:#5a3d12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;

export default function HomeHeader2(p: HomeHeader2Props) {
    const ratio = Math.max(0, Math.min(1, p.exp / 100));
    return (
        <div className="hh" style={{ containerType: "inline-size" } as any}>
            <style>{CSS}</style>
            <img className="hh-img" src={IMG} alt="冒険者ヘッダー" width={W} height={H} />
            {/* 円形フレーム：保存済みアバターの顔（タップで編集） */}
            <div className="hh-ov hh-av" style={pct(56, 84, 290, 288)} onClick={p.onAvatarClick} title="アバターを編集">
                {p.avatar
                    ? <div><AvatarLayered config={p.avatar.cfg} job={p.avatar.job} showFallback={false} /></div>
                    : <div className="hh-noav"><span>🧑‍🎨</span><span>つくる</span></div>}
            </div>
            <div className="hh-ov" style={pct(392, 98, 710, 80)}><div className="hh-name">{p.name || "ゲスト"}さん</div></div>
            {p.jobName && <div className="hh-ov" style={pct(394, 172, 690, 54)}><div className="hh-job">{p.jobName}</div></div>}
            <div className="hh-ov hh-streak" style={pct(1030, 102, 330, 72)}>🔥 {p.streak}</div>
            <div className="hh-ov hh-lv" style={pct(401, 231, 219, 78)}><small>Lv.</small>{p.level}</div>
            <div className="hh-ov hh-expfill" style={pct(650, 252, 762, 32)}><div style={{ width: `${ratio * 100}%` }} /></div>
            <div className="hh-ov hh-expv" style={{ ...pct(1040, 244, 370, 47), ...(ratio > 0.72 ? { color: "#fff", textShadow: "0 1px 2px rgba(20,40,90,.6)" } : {}) }}>EXP {p.exp} / 100</div>
            <div className="hh-ov" style={pct(452, 346, 306, 58)}><div className="hh-title">{p.title || "かけだしの冒険者"}</div></div>
        </div>
    );
}
