"use client";
// Intern Quest 2.0｜職業選択（冒険者情報登録 → この画面 → 既存オンボーディング）
// 6職業のキャラクター画像は提供素材（public/jobs/*.webp）。カード・ボタン・進捗は HTML/CSS。
// 保存先：profiles.job_class（新規列。承認後に SQL を実行する必要あり）。EXP・レベル・ポイント等には触れない。
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";

export type JobKey = "knight" | "mage" | "archer" | "healer" | "rogue" | "paladin";
export const JOBS: { key: JobKey; name: string; en: string; color: string; desc: string; short: string }[] = [
    { key: "knight", name: "ナイト", en: "KNIGHT", color: "#2f6fd6", desc: "剣と盾で仲間を守る、頼れる前衛。", short: "仲間を守る" },
    { key: "mage", name: "魔法使い", en: "MAGE", color: "#7c3aed", desc: "魔法の力で可能性を広げる、知恵の使い手。", short: "魔法で可能性を広げる" },
    { key: "archer", name: "アーチャー", en: "ARCHER", color: "#2e9e5b", desc: "正確な判断と遠距離攻撃で道を切り開く。", short: "正確な判断と遠距離攻撃" },
    { key: "healer", name: "ヒーラー", en: "HEALER", color: "#e8679a", desc: "回復と支援で仲間を支える、優しい癒し手。", short: "仲間を支える" },
    { key: "rogue", name: "ローグ", en: "ROGUE", color: "#2b3a6b", desc: "素早い行動と機動力で先手を取る影の達人。", short: "素早い行動と機動力" },
    { key: "paladin", name: "パラディン", en: "PALADIN", color: "#d49a1c", desc: "攻守のバランスとリーダーシップで導く聖騎士。", short: "攻守のバランスとリーダーシップ" },
];
const STEPS = ["登録", "冒険者情報", "職業", "アバター", "確認", "ライセンス", "初回クエスト"];
const STEP_NOW = 2; // 0-based

const CSS = `
.jb-top .jb-back{order:2}.jb-top .jb-prog{order:1}
.jb-root{min-height:100vh;min-height:100dvh;background:#7fc3ef url(/images/onboarding/job-selection-bg.webp) center 38%/cover no-repeat fixed;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416;padding:16px 20px calc(12px + env(safe-area-inset-bottom));box-sizing:border-box;display:flex;flex-direction:column}
.jb-grid{flex:0 0 auto;width:100%}
.jb-spacer{flex:1 0 0}
.jb-top{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:1500px;margin:0 auto}
.jb-back{border:2px solid #fff;background:rgba(255,255,255,.75);color:#1d3f8c;font-weight:900;border-radius:999px;padding:8px 16px;cursor:pointer;font-family:inherit;font-size:13px;box-shadow:0 4px 10px rgba(20,60,120,.15)}
.jb-brand{font-weight:900;font-size:16px;letter-spacing:.14em;color:#fff;text-shadow:0 2px 0 #c9922b,0 4px 10px rgba(20,60,120,.4)}
.jb-prog{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center}
.jb-prog span{font-size:11px;font-weight:800;color:#5a6b8c;background:rgba(255,255,255,.7);border-radius:999px;padding:4px 10px}
.jb-prog span.on{color:#fff;background:linear-gradient(180deg,#4d9af5,#2458c7);box-shadow:0 3px 8px rgba(36,88,199,.35)}
.jb-prog span.done{color:#1d3f8c;background:#dbe8ff}
.jb-head{text-align:center;margin:18px auto 16px;display:inline-block;position:relative;align-self:center;background:linear-gradient(180deg,#fffdf4,#f6ead0);border:2px solid #d8b55e;border-radius:14px;padding:12px 44px 14px;box-shadow:0 0 0 4px rgba(255,255,255,.5),0 14px 30px rgba(30,60,120,.25)}
.jb-head::before,.jb-head::after{content:"";position:absolute;top:50%;width:18px;height:70%;transform:translateY(-50%);background:linear-gradient(180deg,#e9d6a6,#cfb479);border:2px solid #d8b55e}
.jb-head::before{left:-14px;border-radius:8px 0 0 8px}.jb-head::after{right:-14px;border-radius:0 8px 8px 0}
.jb-h1{margin:0;font-size:clamp(24px,3vw,38px);font-weight:900;color:#17397d}
.jb-sub{margin:6px 0 0;font-size:clamp(13px,1.2vw,16px);font-weight:800;color:#2b3f6b}
.jb-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:16px;max-width:1500px;margin:0 auto}
.jb-card{position:relative;min-height:min(62vh,600px);background:linear-gradient(180deg,rgba(255,253,246,.97),rgba(247,236,210,.97));overflow:hidden;border:3px solid #d8b55e;border-radius:20px;padding:14px 12px 14px;text-align:center;cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s;box-shadow:0 10px 24px rgba(30,60,120,.18);display:flex;flex-direction:column;align-items:center;font-family:inherit;color:inherit}
.jb-card:hover{transform:translateY(-4px)}
.jb-card.on{border-color:#3b82f6;box-shadow:0 0 0 4px rgba(59,130,246,.35),0 0 30px rgba(59,130,246,.55),0 14px 30px rgba(30,60,120,.25);transform:translateY(-6px)}
.jb-card .chk{position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:50%;background:#3b82f6;color:#fff;font-weight:900;display:none;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,.25)}
.jb-card.on .chk{display:flex}
.jb-tint{position:absolute;left:0;right:0;top:0;height:46%;opacity:.28;pointer-events:none}
.jb-img{position:relative;width:100%;flex:1 1 0;min-height:0;max-height:52vh;object-fit:contain;object-position:center center;filter:drop-shadow(0 10px 10px rgba(30,40,80,.3))}
.jb-name{margin-top:6px;font-size:18px;font-weight:900}
.jb-en{font-size:11px;font-weight:900;letter-spacing:.2em;margin-top:2px}
.jb-ic{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:8px auto 6px;color:#fff;box-shadow:inset 0 2px 0 rgba(255,255,255,.4),0 3px 8px rgba(0,0,0,.2)}
.jb-ic svg{width:20px;height:20px;fill:#fff}
.jb-desc{font-size:12.5px;font-weight:700;color:#4b3f2a;line-height:1.55;min-height:3.1em}
.jb-pick{margin-top:10px;width:100%;height:40px;border-radius:999px;border:2px solid #e8c45a;font-family:inherit;font-weight:900;font-size:13px;color:#fff;cursor:pointer;background:linear-gradient(180deg,#4d9af5,#2458c7);box-shadow:0 4px 0 #173f93}
.jb-card.on .jb-pick{background:linear-gradient(180deg,#ffd45c,#e9a72a);color:#4a2f05;box-shadow:0 4px 0 #b67a12}
.jb-foot{position:sticky;bottom:0;margin:14px auto 0;max-width:560px;display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 0 calc(8px + env(safe-area-inset-bottom))}
.jb-next{width:100%;height:56px;border-radius:999px;border:2px solid #e8c45a;font-family:inherit;font-weight:900;font-size:18px;letter-spacing:.08em;color:#fff;cursor:pointer;background:linear-gradient(180deg,#4d9af5 0%,#2f6fd6 50%,#1d4fb3 100%);box-shadow:0 0 0 2px #fff6d0,0 8px 18px rgba(36,88,199,.4)}
.jb-next:disabled{opacity:.5;cursor:default;filter:grayscale(.3)}
.jb-msg{font-size:13px;font-weight:800;border-radius:10px;padding:8px 12px;text-align:center}
.jb-msg.ng{color:#991b1b;background:#fee2e2}.jb-msg.ok{color:#14532d;background:#dcfce7}
@media (max-width:1300px){.jb-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.jb-card{min-height:0}.jb-img{flex:none;aspect-ratio:1/1;max-height:none}}
@media (max-width:640px){
  .jb-root{padding:12px 12px calc(12px + env(safe-area-inset-bottom));background-position:62% 30%;background-attachment:scroll}
  .jb-head{padding:10px 26px 12px;display:block;align-self:stretch}.jb-head::before,.jb-head::after{display:none}
  .jb-top{flex-wrap:wrap}.jb-prog{order:3;width:100%;margin-top:6px}.jb-prog span{font-size:10px;padding:3px 8px}
  .jb-head{margin:14px auto 12px}
  .jb-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .jb-card{padding:10px 8px 10px;border-radius:16px;border-width:2px;min-height:0}
  .jb-img{flex:none;aspect-ratio:1/1;max-height:none}
  .jb-name{font-size:15px}.jb-en{font-size:9.5px}.jb-desc{font-size:11.5px;min-height:0}
  .jb-ic{width:28px;height:28px;margin:6px auto 4px}.jb-ic svg{width:16px;height:16px}
  .jb-pick{height:38px;font-size:12px}
}
`;

const ICON: Record<JobKey, React.ReactNode> = {
    knight: <svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z" /></svg>,
    mage: <svg viewBox="0 0 24 24"><path d="M12 2l2.4 6.2L21 9l-5 4.2L17.5 20 12 16.6 6.5 20 8 13.2 3 9l6.6-.8z" /></svg>,
    archer: <svg viewBox="0 0 24 24"><path d="M3 21l9-9M21 3l-4 1 2 2-7 7 1.5 1.5 7-7 2 2 1-4z" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>,
    healer: <svg viewBox="0 0 24 24"><path d="M12 21s-7-4.6-9-9c-1.3-3 .6-7 4.5-7 2 0 3.5 1 4.5 2.5C13 6 14.5 5 16.5 5c3.9 0 5.8 4 4.5 7-2 4.4-9 9-9 9z" /></svg>,
    rogue: <svg viewBox="0 0 24 24"><path d="M14 3l7 7-2 2-1.5-1.5L8 20H4v-4l9.5-9.5L12 5z" /></svg>,
    paladin: <svg viewBox="0 0 24 24"><path d="M12 2l2 5 5 .5-3.8 3.4L16.5 16 12 13.3 7.5 16l1.3-5.1L5 7.5 10 7z" /><path d="M4 19h16v2H4z" /></svg>,
};

export default function JobSelectPage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [sel, setSel] = useState<JobKey | "">("");
    const [saved, setSaved] = useState<JobKey | "">("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            // 保存済みの職業があれば選択状態で表示（列が無い環境では無視）
            const { data } = await supabase.from("profiles").select("job_class").eq("id", user.id).single();
            const j = (data as any)?.job_class as JobKey | undefined;
            if (j && JOBS.some((x) => x.key === j)) { setSel(j); setSaved(j); }
        })();
    }, [router]);

    const handleNext = async () => {
        if (!sel || !userId || loading) return;
        setLoading(true); setMsg("");
        const { error } = await supabase.from("profiles").update({ job_class: sel }).eq("id", userId);
        if (error) {
            setMsg(/column|job_class/i.test(error.message) ? "職業の保存先がまだ用意されていません。運営にお問い合わせください。" : "保存に失敗しました。もう一度お試しください（" + error.message + "）");
            setLoading(false);
            return;
        }
        setSaved(sel);
        setMsg("✅ 職業を登録しました！");
        // 次：アバター作成（未実装）→ 当面は既存のオンボーディング画面へ
        setTimeout(() => router.push("/onboarding"), 700);
    };

    return (
        <>
            <style>{CSS}</style>
            <main className="jb-root">
                <div className="jb-top">
                    <button className="jb-back" type="button" onClick={() => router.push("/onboarding/profile")}>← 戻る</button>
                    <div className="jb-prog" aria-label="オンボーディングの進捗">
                        {STEPS.map((s, i) => <span key={s} className={i === STEP_NOW ? "on" : i < STEP_NOW ? "done" : ""}>{i + 1}. {s}</span>)}
                    </div>
                    <div className="jb-brand" style={{ order: -1 }}>INTERN QUEST</div>
                </div>
                <header className="jb-head">
                    <h1 className="jb-h1">職業を選択しよう</h1>
                    <p className="jb-sub">それぞれの強みを活かして、仲間と一緒に成長の冒険に出よう！</p>
                </header>
                <div className="jb-grid" role="radiogroup" aria-label="職業">
                    {JOBS.map((j) => (
                        <div key={j.key} role="radio" aria-checked={sel === j.key} tabIndex={0} className={"jb-card" + (sel === j.key ? " on" : "")}
                            onClick={() => setSel(j.key)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(j.key); } }}>
                            <div className="jb-tint" style={{ background: `linear-gradient(180deg, ${j.color}, transparent)` }} />
                            <div className="chk">✓</div>
                            <img className="jb-img" src={`/jobs/${j.key}.webp`} alt={j.name} decoding="async" />
                            <div className="jb-name">{j.name}</div>
                            <div className="jb-en" style={{ color: j.color }}>{j.en}</div>
                            <div className="jb-ic" style={{ background: j.color }}>{ICON[j.key]}</div>
                            <div className="jb-desc">{j.desc}</div>
                            <button className="jb-pick" type="button" onClick={(e) => { e.stopPropagation(); setSel(j.key); }}>{sel === j.key ? "選択中" : "この職業を選択"}</button>
                        </div>
                    ))}
                </div>
                <div className="jb-spacer" />
                <div className="jb-foot">
                    {msg && <div className={"jb-msg " + (msg.startsWith("✅") ? "ok" : "ng")}>{msg}</div>}
                    <button className="jb-next" type="button" disabled={!sel || loading || !userId} onClick={handleNext}>
                        {loading ? "保存中…" : sel ? `${JOBS.find((j) => j.key === sel)?.name} で次へ進む →` : "職業を選んでください"}
                    </button>
                    {saved && <div style={{ fontSize: 12, fontWeight: 800, color: "#1d3f8c", textShadow: "0 1px 0 #fff" }}>現在の職業：{JOBS.find((j) => j.key === saved)?.name}（あとから変更できます）</div>}
                </div>
            </main>
        </>
    );
}
