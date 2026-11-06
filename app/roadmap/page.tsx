"use client";
// Intern Quest 2.0｜人生のロードマップ「未来への冒険マップ」
// HOME と同じ世界観（青空・ロイヤルブルー×金・羊皮紙）。
// ★UIリニューアルのみ：roadmaps テーブルへの upsert 保存・項目構成・文字数制限・
//   完成度計算（記入10項目×10%）・ヒント（例文切替）・「このステップを完了」の挙動は従来のまま。
// ★ステップアイコン・パネル装飾フレームは ChatGPT 素材が届くまで CSS 仮組み（絵文字は従来からの仮アイコン）。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Roadmap = {
    user_id: string;
    month3: string; month6: string; year1: string; year3: string; goal: string;
    month3_why: string; month6_why: string; year1_why: string; year3_why: string; goal_why: string;
    month3_how: string; month6_how: string; year1_how: string; year3_how: string; goal_how: string;
    current_self: string; life_theme: string; role_model: string; shadow_future: string; this_week_action: string;
};
const EMPTY_ROADMAP: Omit<Roadmap, "user_id"> = {
    month3: "", month6: "", year1: "", year3: "", goal: "",
    month3_why: "", month6_why: "", year1_why: "", year3_why: "", goal_why: "",
    month3_how: "", month6_how: "", year1_how: "", year3_how: "", goal_how: "",
    current_self: "", life_theme: "", role_model: "", shadow_future: "", this_week_action: "",
};

const STEPS = [
    { key: "month3", label: "3ヶ月後", icon: "🕐", title: "3ヶ月後の自分", hints: ["1人で旅行に行けるようになっていたい", "テレアポでアポを安定して取れている", "日報を毎日続けられている"] },
    { key: "month6", label: "6ヶ月後", icon: "📅", title: "6ヶ月後の自分", hints: ["後輩に教えられる存在になっている", "貯金を始めて安定している", "自分の得意分野が見つかっている"] },
    { key: "year1", label: "1年後", icon: "🚩", title: "1年後の自分", hints: ["P1になっている", "チームを引っ張る側になっている", "就活の軸が固まっている"] },
    { key: "year3", label: "3年後", icon: "📊", title: "3年後の自分", hints: ["社会人として自立している", "人生の最盛期を迎えている", "好きな仕事で稼げている"] },
    { key: "goal", label: "人生ゴール", icon: "👑", title: "人生のゴール", hints: ["大切な人と好きな場所で暮らしている", "趣味も仕事も全力で楽しめている", "誰かの人生に良い影響を与えられている"] },
] as const;

const WHY_HINTS = ["自信をつけて、もっと色んなことに挑戦したいから", "将来の選択肢を広げたいから", "大切な人を安心させたいから"];
const HOW_HINTS = ["週末に一人で日帰り旅を計画してみる", "毎日1つ、小さな挑戦をメモする", "決めた本を10ページ読む"];

const SECTIONS = [
    { key: "life_theme", icon: "💎", label: "人生のテーマ・価値観", ph: "例：挑戦し続ける／人を大切にする／自由に生きる" },
    { key: "role_model", icon: "⭐", label: "ロールモデル", ph: "例：〇〇さんのように、周りを巻き込んで成果を出す人" },
    { key: "shadow_future", icon: "🛡️", label: "避けたい未来", ph: "例：何も挑戦せず、言い訳ばかりの自分" },
] as const;

const CSS = `
.rm-page{min-height:100vh;overflow-x:clip;background:url(/home/bg_mobile.webp) center top / cover no-repeat fixed,#bfe3f5;display:flex;flex-direction:column;align-items:center;padding:14px 14px 80px;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#173366}
.rm-col{width:100%;max-width:480px;display:flex;flex-direction:column}
@media (min-width:768px){ .rm-page{background-image:url(/home/bg_pc.webp)} .rm-col{max-width:1060px} }

/* タイトル */
.rm-title{position:relative;width:min(88%,460px);margin:0 auto;container-type:inline-size;z-index:2}
.rm-title img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 14px rgba(20,40,90,.3))}
.rm-title>div{position:absolute;inset:25.9% 10% 11.8%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;pointer-events:none}
.rm-title .t1{font-size:clamp(15px,5.6cqw,25px);font-weight:900;letter-spacing:.08em;text-shadow:0 2px 4px rgba(10,25,70,.55)}
.rm-title .t2{font-size:clamp(8px,2.3cqw,11px);font-weight:800;letter-spacing:.3em;color:#cfe0ff;margin-top:1%}

/* 上部バー（戻る・保存） */
.rm-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px}
.rm-back{display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:999px;border:2px solid #d8b55e;background:rgba(255,249,235,.92);color:#8a6a3a;font-size:12.5px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 3px 8px rgba(40,60,120,.15)}
.rm-save{padding:11px 24px;border-radius:999px;border:2px solid #D9A83E;background:linear-gradient(180deg,#2f66c9,#124C9C 55%,#092E70);color:#fff;font-size:13.5px;font-weight:900;letter-spacing:.04em;cursor:pointer;font-family:inherit;box-shadow:0 4px 0 #071f4d,0 7px 14px rgba(9,46,112,.35),inset 0 2px 0 rgba(255,255,255,.3);transition:transform .08s,box-shadow .08s}
.rm-save:active{transform:translateY(3px);box-shadow:0 1px 0 #071f4d,0 3px 6px rgba(9,46,112,.3),inset 0 2px 0 rgba(255,255,255,.3)}
.rm-savedmsg{font-size:12px;font-weight:800}

/* 完成度パネル */
.rm-prog{margin-top:12px;background:linear-gradient(180deg,#FFF9EB,#f6ebd0);border:2.5px solid #D9A83E;border-radius:16px;padding:12px 16px;box-shadow:0 0 0 3px rgba(255,255,255,.4),0 6px 16px rgba(40,60,120,.15),inset 0 2px 0 rgba(255,255,255,.8);display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.rm-prog .lb{font-size:12.5px;font-weight:900;color:#8a6a3a}
.rm-prog .lb b{font-size:22px;color:#124C9C;margin-left:4px}
.rm-prog .barw{flex:1;min-width:130px;height:13px;border-radius:999px;background:rgba(18,76,156,.14);border:1.5px solid #cdb87e;overflow:hidden}
.rm-prog .bar{height:100%;border-radius:999px;background:linear-gradient(90deg,#4b7ae0,#124C9C);box-shadow:0 0 8px rgba(75,122,224,.6);transition:width .8s ease}
.rm-chip{font-size:11px;font-weight:900;padding:5px 11px;border-radius:999px;border:1.5px solid #cdb87e;background:#fffef8;color:#a08356;white-space:nowrap}
.rm-chip.on{border-color:#2e9d5f;color:#1e7a45;background:#eefaf0}

/* レイアウト: モバイル=スクロール選択→編集→追加項目 / PC=左ルート+追加・右編集 */
.rm-main{display:grid;grid-template-columns:1fr;grid-template-areas:"a" "b" "c";gap:14px;margin-top:14px}
@media (min-width:768px){ .rm-main{grid-template-columns:400px 1fr;grid-template-areas:"c b";align-items:start} .rm-a.rm-scroll{display:none} }
.rm-a{grid-area:a}.rm-b{grid-area:b}.rm-c{grid-area:c}
@media (max-width:767px){ .rm-route{display:none} }

/* モバイル: 横スクロールのステップ選択 */
.rm-scroll{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 8px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.rm-scroll::-webkit-scrollbar{display:none}
.rm-sc{flex:none;min-width:96px;border-radius:14px;border:2px solid #d8b55e;background:linear-gradient(180deg,#FFF9EB,#f6ebd0);padding:9px 10px;cursor:pointer;font-family:inherit;text-align:center;box-shadow:0 3px 8px rgba(40,60,120,.14)}
.rm-sc .ic{font-size:20px;line-height:1}
.rm-sc .nm{font-size:11px;font-weight:900;color:#173366;margin-top:3px;white-space:nowrap}
.rm-sc .st{font-size:9.5px;font-weight:800;color:#a08356;margin-top:1px}
.rm-sc.on{background:linear-gradient(180deg,#2f66c9,#124C9C);border-color:#D9A83E;box-shadow:0 0 10px rgba(75,122,224,.55)}
.rm-sc.on .nm{color:#fff}.rm-sc.on .st{color:#cfe0ff}

/* PC: 冒険ルート */
.rm-node{display:flex;gap:12px}
.rm-node .ln{display:flex;flex-direction:column;align-items:center}
.rm-node .dot{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;background:radial-gradient(circle at 50% 35%,#fffdf4,#f1e3bf);border:2.5px solid #cdb87e;box-shadow:0 3px 7px rgba(40,60,120,.2)}
.rm-node.on .dot{border-color:#D9A83E;background:radial-gradient(circle at 50% 35%,#e8f0ff,#bcd2f5);box-shadow:0 0 0 3px rgba(217,168,62,.35),0 0 14px rgba(75,122,224,.5)}
.rm-node .vln{width:3px;flex:1;background:linear-gradient(180deg,#d8b55e,#e9d7a0);margin:4px 0;border-radius:2px}
.rm-card{flex:1;margin-bottom:10px;border-radius:14px;padding:12px 14px;cursor:pointer;border:2px solid #d8b55e;background:linear-gradient(180deg,#FFF9EB,#f8efdb);box-shadow:0 3px 8px rgba(40,60,120,.13),inset 0 2px 0 rgba(255,255,255,.8);transition:transform .12s,box-shadow .12s}
.rm-card:hover{transform:translateY(-1px)}
.rm-card.on{background:linear-gradient(180deg,#2f66c9,#124C9C);border-color:#D9A83E;box-shadow:0 0 0 2px rgba(217,168,62,.3),0 6px 14px rgba(9,46,112,.35)}
.rm-card .hd{display:flex;align-items:center;justify-content:space-between;gap:8px}
.rm-card .nm{font-size:13.5px;font-weight:900;color:#173366}
.rm-card.on .nm{color:#fff}
.rm-card .arr{color:#c9a94f;font-weight:900}
.rm-card.on .arr{color:#ffe9a8}
.rm-card .sum{font-size:11.5px;font-weight:700;color:#8a93a6;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rm-card.on .sum{color:#cfe0ff}
.rm-ck{display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;border-radius:50%;background:#2e9d5f;color:#fff;font-size:10.5px;font-weight:900;box-shadow:0 0 6px rgba(46,157,95,.6)}
@keyframes rmckpop{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.2)}100%{transform:scale(1);opacity:1}}
.rm-ck{animation:rmckpop .35s ease}
@media (prefers-reduced-motion: reduce){ .rm-ck{animation:none} .rm-fade{animation:none} }

/* 追加4項目 */
.rm-sec{margin-top:10px;border-radius:14px;border:2px solid #d8b55e;background:linear-gradient(180deg,#FFF9EB,#f8efdb);box-shadow:0 3px 8px rgba(40,60,120,.13);overflow:hidden}
.rm-sec .shd{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;cursor:pointer}
.rm-sec .snm{font-size:12.5px;font-weight:900;color:#173366}
.rm-sec .done{font-size:10px;font-weight:900;color:#1e7a45;background:#eefaf0;border:1px solid #9fd8b4;border-radius:999px;padding:2px 8px;margin-left:6px}
.rm-sec .cv{color:#a08356;transition:transform .2s}
.rm-sec.open .cv{transform:rotate(180deg)}
.rm-week{margin-top:10px;border-radius:14px;border:2.5px solid #124C9C;background:linear-gradient(180deg,#eaf1ff,#d9e6ff);box-shadow:0 3px 10px rgba(18,76,156,.2);padding:13px 14px}
.rm-week .wnm{font-size:12.5px;font-weight:900;color:#124C9C;margin-bottom:8px}

/* 入力共通 */
.rm-ta,.rm-in{width:100%;padding:12px 13px 24px;border-radius:12px;border:1.5px solid #b9c4e8;background:#fff;color:#092E70;font-size:13.5px;line-height:1.7;outline:none;resize:vertical;box-sizing:border-box;font-family:inherit}
.rm-in{padding:11px 13px;resize:none}
.rm-ta::placeholder,.rm-in::placeholder{color:#a9b3cc}
.rm-ta:focus,.rm-in:focus{border-color:#124C9C;box-shadow:0 0 0 3px rgba(18,76,156,.15)}
.rm-cnt{position:absolute;right:12px;bottom:9px;font-size:10.5px;font-weight:700;color:#8a93a6;pointer-events:none}

/* 右：編集パネル */
.rm-panel{border-radius:20px;border:3px solid #D9A83E;background:linear-gradient(180deg,#FFF9EB,#f8efdb);box-shadow:0 0 0 3px rgba(255,255,255,.45),0 10px 24px rgba(40,60,120,.18),inset 0 2px 0 rgba(255,255,255,.85);padding:18px 16px}
@media (min-width:768px){ .rm-panel{padding:22px 22px 20px} }
.rm-fade{animation:rmfade .18s ease-out}
@keyframes rmfade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.rm-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.rm-ph .ic{width:46px;height:46px;border-radius:50%;background:radial-gradient(circle at 50% 35%,#e8f0ff,#bcd2f5);border:2px solid #D9A83E;display:flex;align-items:center;justify-content:center;font-size:21px;flex:none}
.rm-ph .tt{font-size:18px;font-weight:900;color:#092E70}
.rm-ph .ds{font-size:11.5px;font-weight:700;color:#8a6a3a;margin-top:2px}
.rm-hint{padding:9px 15px;border-radius:999px;border:1.5px solid #b89ae0;background:linear-gradient(180deg,#f4edff,#e4d6f8);color:#6b4bb8;font-size:12px;font-weight:900;cursor:pointer;font-family:inherit;white-space:nowrap;box-shadow:0 2px 6px rgba(107,75,184,.2)}
.rm-hr{height:2px;background:linear-gradient(90deg,transparent,#e2cf9e,transparent);margin:14px 0 16px}
.rm-flab{font-size:13px;font-weight:900;color:#173366;margin-bottom:7px}
.rm-btns{display:flex;gap:10px;margin-top:8px}
.rm-later{flex:1;padding:13px 0;border-radius:999px;border:2px solid #cdb87e;background:#fffef8;color:#8a6a3a;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit}
.rm-done{flex:2;padding:13px 0;border-radius:999px;border:2px solid #D9A83E;background:linear-gradient(180deg,#2f66c9,#124C9C 55%,#092E70);color:#fff;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 4px 0 #071f4d,0 7px 14px rgba(9,46,112,.35),inset 0 2px 0 rgba(255,255,255,.3);transition:transform .08s,box-shadow .08s}
.rm-done:active{transform:translateY(3px);box-shadow:0 1px 0 #071f4d,0 3px 6px rgba(9,46,112,.3),inset 0 2px 0 rgba(255,255,255,.3)}
`;

const CURRENT = { key: "current", label: "現在地", icon: "📍", title: "現在地", desc: "今の自分を一言で残そう。" } as const;

export default function RoadmapPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedMessage, setSavedMessage] = useState("");
    const [userId, setUserId] = useState("");
    const [data, setData] = useState<Omit<Roadmap, "user_id">>(EMPTY_ROADMAP);
    const [activeStep, setActiveStep] = useState<string>("month3");
    const [openSection, setOpenSection] = useState<string | null>(null);
    const [hintIdx, setHintIdx] = useState(0);
    const [barOn, setBarOn] = useState(false);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const { data: roadmap } = await supabase.from("roadmaps").select("*").eq("user_id", user.id).maybeSingle();
            if (roadmap) {
                const filled: Omit<Roadmap, "user_id"> = { ...EMPTY_ROADMAP };
                (Object.keys(EMPTY_ROADMAP) as Array<keyof typeof EMPTY_ROADMAP>).forEach((key) => {
                    filled[key] = roadmap[key] || "";
                });
                setData(filled);
            }
            setLoading(false);
            setTimeout(() => setBarOn(true), 80);
        };
        load();
    }, [router]);

    // ===== 保存・完成度・完了（既存ロジックそのまま） =====
    const handleSave = async (silent?: boolean) => {
        if (!userId) return;
        setSaving(true);
        if (!silent) setSavedMessage("");
        const { error } = await supabase.from("roadmaps").upsert({ user_id: userId, ...data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
        setSaving(false);
        if (error) { setSavedMessage("❌ 保存に失敗しました"); }
        else { setSavedMessage("✅ 保存しました"); setTimeout(() => setSavedMessage(""), 3000); }
    };

    const update = (key: keyof typeof EMPTY_ROADMAP, value: string) => {
        setData(prev => ({ ...prev, [key]: value }));
    };

    const stepDone = (k: string) => !!((data as any)[k] || (data as any)[k + "_why"] || (data as any)[k + "_how"]);
    const doneCount = [
        !!data.current_self,
        ...STEPS.map(s => stepDone(s.key)),
        !!data.life_theme, !!data.role_model, !!data.shadow_future, !!data.this_week_action,
    ].filter(Boolean).length;
    const progress = doneCount * 10;
    const futureDone = STEPS.filter(s => stepDone(s.key)).length;

    const completeStep = async () => {
        await handleSave(true);
        if (activeStep === "current") { setActiveStep("month3"); }
        else {
            const idx = STEPS.findIndex(s => s.key === activeStep);
            if (idx >= 0 && idx < STEPS.length - 1) setActiveStep(STEPS[idx + 1].key);
        }
        setSavedMessage("✅ 保存しました");
        setTimeout(() => setSavedMessage(""), 2500);
    };

    const curStep = STEPS.find(s => s.key === activeStep);
    const rotateHint = () => setHintIdx(i => i + 1);

    if (loading) {
        return (
            <main className="rm-page" style={{ justifyContent: "center" }}>
                <style>{CSS}</style>
                <div style={{ fontWeight: 800, color: "#5a6b85" }}>読み込み中...</div>
            </main>
        );
    }

    const chip = (label: string, on: boolean) => (
        <span className={`rm-chip${on ? " on" : ""}`}>{label} {on ? "✓" : ""}</span>
    );

    const field = (label: string, key: keyof typeof EMPTY_ROADMAP, ph: string, max: number, rows: number) => (
        <div style={{ marginBottom: 16 }}>
            <div className="rm-flab">{label}</div>
            <div style={{ position: "relative" }}>
                <textarea className="rm-ta" value={data[key]} onChange={(e) => update(key, e.target.value.slice(0, max))} placeholder={ph} rows={rows} />
                <span className="rm-cnt">{data[key].length} / {max}</span>
            </div>
        </div>
    );

    // ルート表示用（現在地＋5ステップ）
    const routeItems = [
        { key: CURRENT.key, label: CURRENT.label, icon: CURRENT.icon, done: !!data.current_self, sum: data.current_self },
        ...STEPS.map(s => ({ key: s.key, label: s.label, icon: s.icon, done: stepDone(s.key), sum: (data as any)[s.key] as string })),
    ];

    const pick = (k: string) => { setActiveStep(k); setHintIdx(0); };

    return (
        <main className="rm-page">
            <style>{CSS}</style>
            <div className="rm-col">
                {/* タイトル */}
                <div className="rm-title">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/home/title_plate.webp" alt="" width={1200} height={374} />
                    <div><span className="t1">🗺️ 人生のロードマップ</span><span className="t2">LIFE ROADMAP</span></div>
                </div>

                {/* 戻る・保存 */}
                <div className="rm-bar">
                    <button className="rm-back" onClick={() => router.push("/home")}>← もどる</button>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {savedMessage && <span className="rm-savedmsg" style={{ color: savedMessage.includes("❌") ? "#c23b3b" : "#1e7a45" }}>{savedMessage}</span>}
                        <button className="rm-save" onClick={() => handleSave()} disabled={saving} style={{ opacity: saving ? .6 : 1 }}>💾 保存する</button>
                    </div>
                </div>

                {/* 完成度 */}
                <div className="rm-prog">
                    <span className="lb">🧭 ロードマップ完成度<b>{progress}%</b></span>
                    <div className="barw"><div className="bar" style={{ width: barOn ? `${progress}%` : 0 }} /></div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {chip("現在地", !!data.current_self)}
                        {chip(`未来 ${futureDone}/5`, futureDone === 5)}
                        {chip("価値観", !!data.life_theme)}
                        {chip("今週の一歩", !!data.this_week_action)}
                    </div>
                </div>

                <div className="rm-main">
                    {/* モバイル：横スクロールのステップ選択 */}
                    <div className="rm-a rm-scroll">
                        {routeItems.map(it => (
                            <button key={it.key} className={`rm-sc${activeStep === it.key ? " on" : ""}`} onClick={() => pick(it.key)}>
                                <div className="ic">{it.icon}</div>
                                <div className="nm">{it.label} {it.done && <span className="rm-ck" style={{ width: 14, height: 14, fontSize: 9 }}>✓</span>}</div>
                                <div className="st">{it.done ? "記入済み" : "未記入"}</div>
                            </button>
                        ))}
                    </div>

                    {/* 右（PC）／中央（モバイル）：編集パネル */}
                    <div className="rm-b">
                        <div key={activeStep} className="rm-panel rm-fade">
                            {activeStep === "current" ? (
                                <>
                                    <div className="rm-ph">
                                        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                                            <div className="ic">📍</div>
                                            <div><div className="tt">現在地</div><div className="ds">{CURRENT.desc}</div></div>
                                        </div>
                                    </div>
                                    <div className="rm-hr" />
                                    <div className="rm-flab">いまの自分は？</div>
                                    <div style={{ position: "relative" }}>
                                        <textarea className="rm-ta" value={data.current_self} onChange={(e) => update("current_self", e.target.value.slice(0, 120))} placeholder="例：物事を順序立てて実行できる" rows={3} />
                                        <span className="rm-cnt">{data.current_self.length} / 120</span>
                                    </div>
                                    <div className="rm-btns">
                                        <button className="rm-later" onClick={() => handleSave()}>あとで書く</button>
                                        <button className="rm-done" onClick={completeStep}>✓ このステップを完了</button>
                                    </div>
                                </>
                            ) : curStep && (
                                <>
                                    <div className="rm-ph">
                                        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                                            <div className="ic">{curStep.icon}</div>
                                            <div><div className="tt">{curStep.title}</div><div className="ds">完璧に書かなくてOK。今の気持ちを残そう。</div></div>
                                        </div>
                                        <button className="rm-hint" onClick={rotateHint}>✨ ヒントをもらう</button>
                                    </div>
                                    <div className="rm-hr" />
                                    {field("🧭 どうなっていたい？", curStep.key as any, "例：" + curStep.hints[hintIdx % curStep.hints.length], 120, 3)}
                                    {field("✨ なぜ叶えたい？", (curStep.key + "_why") as any, "例：" + WHY_HINTS[hintIdx % WHY_HINTS.length], 200, 4)}
                                    {field("🚩 最初の一歩は？", (curStep.key + "_how") as any, "例：" + HOW_HINTS[hintIdx % HOW_HINTS.length], 120, 3)}
                                    <div className="rm-btns">
                                        <button className="rm-later" onClick={() => handleSave()}>あとで書く</button>
                                        <button className="rm-done" onClick={completeStep}>✓ このステップを完了</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* 左（PC）／下（モバイル）：冒険ルート＋追加項目 */}
                    <div className="rm-c">
                        {/* 冒険ルート（PCのみ表示） */}
                        <div className="rm-route">
                            {routeItems.map((it, i) => {
                                const on = activeStep === it.key;
                                return (
                                    <div key={it.key} className={`rm-node${on ? " on" : ""}`}>
                                        <div className="ln">
                                            <div className="dot">{it.icon}</div>
                                            {i < routeItems.length - 1 && <div className="vln" />}
                                        </div>
                                        <div className={`rm-card${on ? " on" : ""}`} onClick={() => pick(it.key)}>
                                            <div className="hd">
                                                <span className="nm">{it.label} {it.done && <span className="rm-ck">✓</span>}</span>
                                                <span className="arr">›</span>
                                            </div>
                                            {it.sum && <div className="sum">{it.sum}</div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 追加3項目（開閉式・既存機能維持） */}
                        {SECTIONS.map((sec) => (
                            <div key={sec.key} className={`rm-sec${openSection === sec.key ? " open" : ""}`}>
                                <div className="shd" onClick={() => setOpenSection(openSection === sec.key ? null : sec.key)}>
                                    <span className="snm">{sec.icon} {sec.label}{(data as any)[sec.key] && <span className="done">● 記入済み</span>}</span>
                                    <span className="cv">▼</span>
                                </div>
                                {openSection === sec.key && (
                                    <div style={{ padding: "0 14px 13px", position: "relative" }}>
                                        <textarea className="rm-ta" value={(data as any)[sec.key]} onChange={(e) => update(sec.key as any, e.target.value.slice(0, 200))} placeholder={sec.ph} rows={3} />
                                        <span className="rm-cnt" style={{ right: 24, bottom: 22 }}>{((data as any)[sec.key] as string).length} / 200</span>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* 今週の一歩（既存機能維持） */}
                        <div className="rm-week">
                            <div className="wnm">🚩 今週の一歩</div>
                            <input className="rm-in" value={data.this_week_action} onChange={(e) => update("this_week_action", e.target.value.slice(0, 80))} placeholder="例：決めた本を10ページ読む" />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
