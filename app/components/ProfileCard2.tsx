"use client";
// Intern Quest 2.0｜マイページ「冒険者プロフィール」カード。
// GPT 制作のカード画像（public/mypage/profile_card.png、1428×849、文字なし）を 1 枚敷き、
// 画像内の枠・プレートの位置に実データ（アバター／名前／職業／事業部／Lv／称号／EXP）を重ねる。
// 画像は加工しない。座標は画像に対する％で指定しているので、幅が変わっても位置は保たれる。
// スマホ（幅 700px 未満）では画像の比率のまま縮小すると文字が読めないため、
// 同じ画像を「上：肖像枠だけを拡大表示」「下：情報」の 2 段に分けて使う（画像の切り出しは CSS の object-position で行う）。
import { useRouter } from "next/navigation";
import AvatarLayered from "./AvatarLayered";
import type { AvatarConfig } from "../lib/avatar/catalog";
import type { JobKey } from "../onboarding/job/page";

const IMG = "/mypage/profile_card.png";
const W = 1428, H = 849;
const pct = (l: number, t: number, w: number, h: number) => ({ left: `${(l / W) * 100}%`, top: `${(t / H) * 100}%`, width: `${(w / W) * 100}%`, height: `${(h / H) * 100}%` });

export type ProfileCard2Props = {
    name: string;
    jobName: string | null;        // 例：ローグ
    jobEn?: string | null;         // 例：ROGUE
    deptName: string | null;
    level: number;
    exp: number;                   // 現在レベル内の EXP（0-99）
    expMax?: number;               // 既定 100
    title: { name: string; icon?: string | null } | null;
    avatar: { cfg: AvatarConfig; job: JobKey } | null;
    onEditAvatar: () => void;
    onEditProfile: () => void;
};

const CSS = `
.pc2{position:relative;width:100%;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#1f2a44;--u:calc(100cqw / ${W})}
.pc2-img{display:block;width:100%;height:auto}
.pc2-ov{position:absolute;display:flex;align-items:center;box-sizing:border-box;min-width:0}
.pc2-av{justify-content:center;align-items:flex-end;overflow:hidden}
.pc2-av>div{width:118%;margin-bottom:-2%}
.pc2-noav{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#8a6a2b;font-weight:900;font-size:calc(var(--u)*22)}
.pc2-noav button{border:2px solid #2f6fd6;background:#e8f0ff;color:#1d3f8c;font-weight:900;border-radius:999px;padding:.4em 1em;cursor:pointer;font-family:inherit;font-size:.8em}
.pc2-name{font-size:calc(var(--u)*44);font-weight:900;color:#1f2a44;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pc2-meta{font-size:calc(var(--u)*24);font-weight:900;color:#1f2a44;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pc2-lv{justify-content:center;font-size:calc(var(--u)*32);font-weight:900;color:#5a3d12;text-shadow:0 1px 0 #fff3b0}
.pc2-lv small{font-size:.6em;margin-right:.1em}
.pc2-title{font-size:calc(var(--u)*24);font-weight:900;color:#5a3d12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pc2-btn{justify-content:center;background:transparent;border:0;cursor:pointer;font-family:inherit;font-weight:900;color:#17397d;font-size:calc(var(--u)*24);border-radius:999px;padding:0}
.pc2-btn:hover{background:rgba(47,111,214,.08)}
.pc2-btn:focus-visible{outline:3px solid #2f6fd6}
.pc2-exp{justify-content:flex-start;gap:0}
.pc2-exp .bar{position:absolute;left:0;top:0;height:100%;border-radius:999px;background:linear-gradient(180deg,#5db2ff,#1f7be0);box-shadow:inset 0 2px 0 rgba(255,255,255,.5);transition:width 1s ease}
.pc2-exp-l{font-size:calc(var(--u)*22);font-weight:900;color:#1f2a44;justify-content:flex-start}
.pc2-exp-v{font-size:calc(var(--u)*22);font-weight:900;color:#1f2a44;justify-content:flex-end}
.pc2-m{display:none}
@media (max-width:699px){
  .pc2-d{display:none}
  .pc2-m{display:block}
  .pc2m-top{position:relative;width:100%;aspect-ratio:${W} / ${H};overflow:hidden;border-radius:18px}
  .pc2m-top>img{position:absolute;left:0;top:0;width:100%;height:auto}
  .pc2m-head{position:relative;overflow:hidden;width:100%;aspect-ratio:${W} / 200}
  .pc2m-head>img{position:absolute;left:0;top:0;width:100%}
  .pc2m-body{position:relative;width:100%;overflow:hidden;aspect-ratio:460 / 600}
  .pc2m-body>img{position:absolute;width:${(1428/460*100).toFixed(2)}%;left:${(-60/460*100).toFixed(2)}%;top:${(-196/460*100).toFixed(2)}%}
  .pc2m-avbox{position:absolute;left:0;right:0;bottom:12%;display:flex;justify-content:center}
  .pc2m-avbox>div{width:78%}
  .pc2m-info{background:linear-gradient(180deg,#fffdf4,#f6ead0);border:3px solid #d8b55e;border-top:0;border-radius:0 0 18px 18px;padding:12px 14px 14px;display:flex;flex-direction:column;gap:8px}
  .pc2m-name{font-size:22px;font-weight:900;color:#1f2a44}
  .pc2m-meta{font-size:13.5px;font-weight:900;color:#1f2a44;display:flex;gap:10px;flex-wrap:wrap}
  .pc2m-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .pc2m-lv{background:linear-gradient(180deg,#ffe27a,#f2b705);border:2px solid #c98a00;border-radius:12px;padding:4px 12px;font-weight:900;color:#5a3d12;font-size:16px}
  .pc2m-title{flex:1;min-width:0;background:#fffffb;border:2px solid #e7dcc0;border-radius:12px;padding:5px 10px;font-weight:900;font-size:13px;color:#5a3d12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pc2m-exp{display:flex;align-items:center;gap:8px;font-weight:900;font-size:13px}
  .pc2m-exp .tr{flex:1;height:14px;border-radius:999px;background:#d9d9d9;border:2px solid #e7dcc0;overflow:hidden}
  .pc2m-exp .tr>div{height:100%;background:linear-gradient(180deg,#5db2ff,#1f7be0)}
  .pc2m-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .pc2m-btns button{height:44px;border-radius:999px;border:2px solid #e8c45a;background:#fff;color:#17397d;font-weight:900;font-size:13px;cursor:pointer;font-family:inherit;white-space:nowrap;padding:0 6px}
}
`;

export default function ProfileCard2(p: ProfileCard2Props) {
    const router = useRouter();
    const expMax = p.expMax ?? 100;
    const ratio = Math.max(0, Math.min(1, p.exp / expMax));
    const jobText = p.jobName ? `${p.jobName}${p.jobEn ? `（${p.jobEn}）` : ""}` : "未選択";
    const Av = () => p.avatar ? <AvatarLayered config={p.avatar.cfg} job={p.avatar.job} /> : (
        <div className="pc2-noav">アバター未作成<button type="button" onClick={() => router.push("/onboarding/avatar?from=mypage")}>作成する</button></div>
    );
    return (
        <div className="pc2" style={{ containerType: "inline-size" } as any}>
            <style>{CSS}</style>
            {/* PC／タブレット：画像 1 枚にそのまま重ねる */}
            <div className="pc2-d" style={{ position: "relative" }}>
                <img className="pc2-img" src={IMG} alt="冒険者プロフィール" width={W} height={H} />
                <div className="pc2-ov pc2-av" style={pct(96, 232, 386, 526)}><div><Av /></div></div>
                <div className="pc2-ov" style={pct(600, 232, 800, 70)}><div className="pc2-name">{p.name || "名前未設定"}</div></div>
                <div className="pc2-ov" style={pct(640, 318, 175, 50)}><div className="pc2-meta">{p.jobName || "未選択"}</div></div>
                <div className="pc2-ov" style={pct(860, 318, 540, 50)}><div className="pc2-meta">{p.deptName || "所属未設定"}</div></div>
                <div className="pc2-ov pc2-lv" style={pct(574, 392, 127, 65)}><small>Lv.</small>{p.level}</div>
                <div className="pc2-ov" style={pct(800, 392, 230, 65)}><div className="pc2-title">{p.title?.name || "称号なし"}</div></div>
                <button type="button" className="pc2-ov pc2-btn" style={pct(1140, 390, 240, 70)} onClick={p.onEditAvatar}>アバターを編集</button>
                <div className="pc2-ov pc2-exp-l" style={pct(600, 505, 60, 40)}>EXP</div>
                <div className="pc2-ov pc2-exp" style={pct(655, 510, 545, 28)}><div className="bar" style={{ width: `${ratio * 100}%` }} /></div>
                <div className="pc2-ov pc2-exp-v" style={pct(1210, 505, 150, 40)}>{p.exp} / {expMax}</div>
                <button type="button" className="pc2-ov pc2-btn" style={pct(1050, 738, 300, 60)} onClick={p.onEditProfile}>基本プロフィール編集</button>
            </div>
            {/* スマホ：見出し帯＋肖像枠を拡大して上に、情報は下に（画像は同じものを切り出し表示） */}
            <div className="pc2-m">
                <div className="pc2m-head"><img src={IMG} alt="" /></div>
                <div className="pc2m-body">
                    <img src={IMG} alt="" />
                    <div className="pc2m-avbox"><div><Av /></div></div>
                </div>
                <div className="pc2m-info">
                    <div className="pc2m-name">{p.name || "名前未設定"}</div>
                    <div className="pc2m-meta"><span>👤 {jobText}</span><span>🏛 {p.deptName || "所属未設定"}</span></div>
                    <div className="pc2m-row"><span className="pc2m-lv">Lv.{p.level}</span><span className="pc2m-title">👑 {p.title?.name || "称号なし"}</span></div>
                    <div className="pc2m-exp"><span>EXP</span><div className="tr"><div style={{ width: `${ratio * 100}%` }} /></div><span>{p.exp} / {expMax}</span></div>
                    <div className="pc2m-btns"><button type="button" onClick={p.onEditAvatar}>✎ アバターを編集</button><button type="button" onClick={p.onEditProfile}>基本プロフィール編集 →</button></div>
                </div>
            </div>
        </div>
    );
}
