"use client";
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
    { key: "goal", label: "人生ゴール", icon: "🏆", title: "人生のゴール", hints: ["大切な人と好きな場所で暮らしている", "趣味も仕事も全力で楽しめている", "誰かの人生に良い影響を与えられている"] },
] as const;

const WHY_HINTS = ["自信をつけて、もっと色んなことに挑戦したいから", "将来の選択肢を広げたいから", "大切な人を安心させたいから"];
const HOW_HINTS = ["週末に一人で日帰り旅を計画してみる", "毎日1つ、小さな挑戦をメモする", "決めた本を10ページ読む"];

const SECTIONS = [
    { key: "life_theme", icon: "💎", label: "人生のテーマ・価値観", ph: "例：挑戦し続ける／人を大切にする／自由に生きる" },
    { key: "role_model", icon: "⭐", label: "ロールモデル", ph: "例：〇〇さんのように、周りを巻き込んで成果を出す人" },
    { key: "shadow_future", icon: "🛡️", label: "避けたい未来", ph: "例：何も挑戦せず、言い訳ばかりの自分" },
] as const;

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
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

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
        };
        load();
    }, [router]);

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
        const idx = STEPS.findIndex(s => s.key === activeStep);
        if (idx >= 0 && idx < STEPS.length - 1) setActiveStep(STEPS[idx + 1].key);
        setSavedMessage("✅ 保存しました");
        setTimeout(() => setSavedMessage(""), 2500);
    };

    const curStep = STEPS.find(s => s.key === activeStep) || STEPS[0];
    const rotateHint = () => setHintIdx(i => i + 1);

    if (loading) {
        return <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>読み込み中...</main>;
    }

    const chip = (label: string, on: boolean) => (
        <span style={{ fontSize: 11.5, fontWeight: 800, padding: "6px 13px", borderRadius: 10, border: on ? "1px solid rgba(52,211,153,.5)" : "1px solid rgba(255,255,255,.12)", color: on ? "#34d399" : "#8b8fa8", background: on ? "rgba(52,211,153,.08)" : "rgba(255,255,255,.03)", whiteSpace: "nowrap" as const }}>{label} {on ? "✓" : ""}</span>
    );

    const field = (label: string, key: keyof typeof EMPTY_ROADMAP, ph: string, max: number, rows: number) => (
        <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#e5e7eb", marginBottom: 8 }}>{label}</div>
            <div style={{ position: "relative" }}>
                <textarea value={data[key]} onChange={(e) => update(key, e.target.value.slice(0, max))} placeholder={ph} rows={rows}
                    style={{ width: "100%", padding: "13px 14px 26px", borderRadius: 12, border: "1px solid rgba(139,92,246,.25)", background: "rgba(255,255,255,.03)", color: "#f4f2ff", fontSize: 13.5, lineHeight: 1.7, outline: "none", resize: "vertical", boxSizing: "border-box" as const }} />
                <span style={{ position: "absolute", right: 12, bottom: 10, fontSize: 11, color: "#6b7280" }}>{data[key].length} / {max}</span>
            </div>
        </div>
    );

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "18px 14px 60px" }}>
            <div style={{ maxWidth: 1080, margin: "0 auto" }}>
                {/* ヘッダー */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button onClick={() => router.push("/home")} style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.04)", color: "#e5e7eb", fontSize: 17, cursor: "pointer" }}>←</button>
                        <h1 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0 }}>人生のロードマップ</h1>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {savedMessage && <span style={{ fontSize: 12.5, fontWeight: 700, color: savedMessage.includes("❌") ? "#f87171" : "#34d399" }}>{savedMessage}</span>}
                        <button onClick={() => handleSave()} disabled={saving} style={{ padding: "11px 22px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #8b5cf6, #6d4bc4)", color: "#fff", fontSize: 14, fontWeight: 900, cursor: "pointer", opacity: saving ? .6 : 1 }}>💾 保存する</button>
                    </div>
                </div>

                {/* 完成度バー */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" as const, padding: "14px 18px", borderRadius: 16, background: "rgba(255,255,255,.03)", border: "1px solid rgba(139,92,246,.2)", marginBottom: 18 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#c4b5fd" }}>ロードマップ完成度 <span style={{ fontSize: 22, fontWeight: 900, color: "#a78bfa" }}>{progress}%</span></span>
                    <div style={{ flex: 1, minWidth: 140, height: 8, background: "rgba(255,255,255,.08)", borderRadius: 6, overflow: "hidden" }}>
                        <div style={{ width: progress + "%", height: "100%", background: "linear-gradient(90deg, #8b5cf6, #a78bfa)", transition: "width .6s ease" }} />
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                        {chip("現在地", !!data.current_self)}
                        {chip(`未来 ${futureDone}/5`, futureDone === 5)}
                        {chip("価値観", !!data.life_theme)}
                        {chip("今週の一歩", !!data.this_week_action)}
                    </div>
                </div>

                <div style={{ display: "flex", gap: 18, flexDirection: isMobile ? "column" as const : "row" as const }}>
                    {/* 左：タイムライン */}
                    <div style={{ width: isMobile ? "100%" : 380, flexShrink: 0 }}>
                        {/* 現在地 */}
                        <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                            <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center" }}>
                                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(52,211,153,.15)", border: "2px solid #34d399", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>📍</div>
                                <div style={{ width: 2, flex: 1, background: "rgba(139,92,246,.3)", marginTop: 4 }} />
                            </div>
                            <div style={{ flex: 1, padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.1)", marginBottom: 4 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#f4f2ff", marginBottom: 6 }}>現在地 {data.current_self ? "✅" : ""}</div>
                                <textarea value={data.current_self} onChange={(e) => update("current_self", e.target.value.slice(0, 120))} placeholder="例：物事を順序立てて実行できる" rows={2}
                                    style={{ width: "100%", padding: "9px 11px", borderRadius: 10, border: "1px solid rgba(139,92,246,.2)", background: "rgba(0,0,0,.25)", color: "#e5e7eb", fontSize: 12.5, lineHeight: 1.6, outline: "none", resize: "none", boxSizing: "border-box" as const }} />
                            </div>
                        </div>
                        {/* 未来ステップ */}
                        {STEPS.map((s, i) => {
                            const on = activeStep === s.key;
                            const done = stepDone(s.key);
                            return (
                                <div key={s.key} style={{ display: "flex", gap: 12 }}>
                                    <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center" }}>
                                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: on ? "rgba(139,92,246,.25)" : done ? "rgba(52,211,153,.12)" : "rgba(255,255,255,.05)", border: on ? "2px solid #a78bfa" : done ? "2px solid rgba(52,211,153,.5)" : "2px solid rgba(255,255,255,.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{s.icon}</div>
                                        {i < STEPS.length - 1 && <div style={{ width: 2, flex: 1, background: "rgba(139,92,246,.3)", marginTop: 4 }} />}
                                    </div>
                                    <div onClick={() => { setActiveStep(s.key); setHintIdx(0); }} style={{ flex: 1, padding: "13px 15px", borderRadius: 14, marginBottom: 10, cursor: "pointer", background: on ? "rgba(139,92,246,.12)" : "rgba(255,255,255,.03)", border: on ? "2px solid rgba(167,139,250,.6)" : "1px solid rgba(255,255,255,.1)" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ fontSize: 14, fontWeight: 800, color: on ? "#c4b5fd" : "#f4f2ff" }}>{s.label}</span>
                                            <span style={{ fontSize: 15 }}>{done ? "✅" : "✏️"}</span>
                                        </div>
                                        {(data as any)[s.key] && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{(data as any)[s.key]}</div>}
                                    </div>
                                </div>
                            );
                        })}
                        {/* アコーディオン3種 */}
                        {SECTIONS.map((sec) => (
                            <div key={sec.key} style={{ marginTop: 10, borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.1)", overflow: "hidden" }}>
                                <div onClick={() => setOpenSection(openSection === sec.key ? null : sec.key)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 15px", cursor: "pointer" }}>
                                    <span style={{ fontSize: 13.5, fontWeight: 800, color: "#f4f2ff" }}>{sec.icon} {sec.label} {(data as any)[sec.key] && <span style={{ fontSize: 11, color: "#34d399", marginLeft: 6 }}>● 記入済み</span>}</span>
                                    <span style={{ color: "#8b8fa8", transform: openSection === sec.key ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
                                </div>
                                {openSection === sec.key && (
                                    <div style={{ padding: "0 15px 14px" }}>
                                        <textarea value={(data as any)[sec.key]} onChange={(e) => update(sec.key as any, e.target.value.slice(0, 200))} placeholder={sec.ph} rows={3}
                                            style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid rgba(139,92,246,.2)", background: "rgba(0,0,0,.25)", color: "#e5e7eb", fontSize: 12.5, lineHeight: 1.7, outline: "none", resize: "vertical", boxSizing: "border-box" as const }} />
                                    </div>
                                )}
                            </div>
                        ))}
                        {/* 今週の一歩 */}
                        <div style={{ marginTop: 10, padding: "14px 15px", borderRadius: 14, background: "rgba(139,92,246,.08)", border: "2px solid rgba(167,139,250,.4)" }}>
                            <div style={{ fontSize: 13.5, fontWeight: 900, color: "#c4b5fd", marginBottom: 8 }}>🚀 今週の一歩</div>
                            <input value={data.this_week_action} onChange={(e) => update("this_week_action", e.target.value.slice(0, 80))} placeholder="例：決めた本を10ページ読む"
                                style={{ width: "100%", padding: "11px 13px", borderRadius: 10, border: "1px solid rgba(139,92,246,.3)", background: "rgba(0,0,0,.25)", color: "#f4f2ff", fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
                        </div>
                    </div>

                    {/* 右：3問パネル */}
                    <div style={{ flex: 1, padding: "22px 22px 20px", borderRadius: 18, background: "rgba(255,255,255,.03)", border: "1px solid rgba(139,92,246,.25)", alignSelf: "flex-start", width: isMobile ? "100%" : undefined, boxSizing: "border-box" as const }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(139,92,246,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19 }}>{curStep.icon}</div>
                                <div>
                                    <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{curStep.title}</div>
                                    <div style={{ fontSize: 11.5, color: "#8b8fa8", marginTop: 2 }}>完璧に書かなくてOK。今の気持ちを残そう。</div>
                                </div>
                            </div>
                            <button onClick={rotateHint} style={{ padding: "9px 15px", borderRadius: 11, border: "1px solid rgba(167,139,250,.4)", background: "rgba(139,92,246,.12)", color: "#c4b5fd", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" as const }}>✨ ヒントをもらう</button>
                        </div>
                        <div style={{ height: 1, background: "rgba(255,255,255,.08)", margin: "14px 0 18px" }} />
                        {field("どうなっていたい？", curStep.key as any, "例：" + curStep.hints[hintIdx % curStep.hints.length], 120, 3)}
                        {field("なぜ叶えたい？", (curStep.key + "_why") as any, "例：" + WHY_HINTS[hintIdx % WHY_HINTS.length], 200, 4)}
                        {field("最初の一歩は？", (curStep.key + "_how") as any, "例：" + HOW_HINTS[hintIdx % HOW_HINTS.length], 120, 3)}
                        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                            <button onClick={() => handleSave()} style={{ flex: 1, padding: 14, borderRadius: 13, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)", color: "#c4b5fd", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>あとで書く</button>
                            <button onClick={completeStep} style={{ flex: 2, padding: 14, borderRadius: 13, border: "none", background: "linear-gradient(135deg, #8b5cf6, #6d4bc4)", color: "#fff", fontSize: 14.5, fontWeight: 900, cursor: "pointer" }}>このステップを完了</button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
