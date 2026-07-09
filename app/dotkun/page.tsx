"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import DotKun from "../components/DotKun";

const STAGES = [
    { stage: 1, mood: "happy" as const, name: "うまれたて", lv: "Lv.0〜9", desc: "あたまに小さな芽がついてるよ。まだ何も知らないけど、これからきみと一緒に成長していくんだ〜！" },
    { stage: 2, mood: "normal" as const, name: "ちょっと成長", lv: "Lv.10〜29", desc: "手が生えてきたよ！きみが日報を書いたり、活動するたびにぼくも少しずつ大きくなるんだ。" },
    { stage: 3, mood: "happy" as const, name: "マフラーゲット", lv: "Lv.30〜49", desc: "青いマフラーをもらったよ〜。ここまで続けてくれてありがとう。なんだか自信がついてきた！" },
    { stage: 4, mood: "cheer" as const, name: "王冠と羽", lv: "Lv.50〜69", desc: "王冠と羽が生えた！きみの努力がぼくを輝かせてくれてるんだよ。もうすぐ最終形態だ〜！" },
    { stage: 5, mood: "cheer" as const, name: "さいきょうドットくん", lv: "Lv.70〜", desc: "ついに天使のわっかがついたよ✨ ここまできたきみは本当にすごい。ぼくは一生きみの味方だからね！" },
];

const PROFILE = [
    { label: "なまえ", value: "ドットくん" },
    { label: "たんじょう", value: "Intern Quest と同じ日に生まれたよ" },
    { label: "せいかく", value: "ポジティブで、ちょっとおせっかい。でも応援は本気！" },
    { label: "すきなもの", value: "きみの日報を読むこと。あと、レベルが上がる音" },
    { label: "とくぎ", value: "へこんでる人をそっと励ますこと" },
];

function getLevel(points: number): number { return Math.max(1, Math.floor(points / 100) + 1); }
function dotStage(level: number): number { return level >= 70 ? 5 : level >= 50 ? 4 : level >= 30 ? 3 : level >= 10 ? 2 : 1; }
const PET_MSGS = ["えへへ、くすぐったいよ〜！", "なでなでありがと！元気でた🥰", "きみのそういうとこ好きだな〜", "ふふ、今日もがんばろっ！", "もっとなでていいんだよ？", "きみといると楽しいなあ〜"];

export default function DotKunPage() {
    const router = useRouter();
    const [stage, setStage] = useState(5);
    const [petHearts, setPetHearts] = useState<{ id: number; hx: string; hr: string }[]>([]);
    const [petMsg, setPetMsg] = useState<string | null>(null);
    const [petKey, setPetKey] = useState(0);
    const [petCount, setPetCount] = useState(0);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: pointRow } = await supabase.from("user_points").select("total_earned").eq("id", user.id).single();
            const te = (pointRow as any)?.total_earned || 0;
            setStage(dotStage(getLevel(te)));
        })();
    }, []);

    const handlePet = () => {
        const now = Date.now();
        const newHearts = Array.from({ length: 4 }, (_, i) => ({
            id: now + i,
            hx: `${(Math.random() * 100 - 50).toFixed(0)}px`,
            hr: `${(Math.random() * 100 - 50).toFixed(0)}deg`,
        }));
        setPetHearts(prev => [...prev.slice(-8), ...newHearts]);
        setPetKey(k => k + 1);
        setPetCount(c => c + 1);
        setPetMsg(PET_MSGS[Math.floor(Math.random() * PET_MSGS.length)]);
        setTimeout(() => setPetHearts(prev => prev.filter(h => !newHearts.some(n => n.id === h.id))), 1000);
        setTimeout(() => setPetMsg(null), 2800);
    };

    return (
        <>
        <style>{`
          @keyframes petSquish { 0% { transform: scale(1,1); } 15% { transform: scale(1.15,0.82) translateY(6px); } 40% { transform: scale(0.88,1.16) translateY(-12px); } 65% { transform: scale(1.07,0.95); } 100% { transform: scale(1,1); } }
          @keyframes heartPop { 0% { transform: translate(0,0) scale(0.3) rotate(0deg); opacity: 1; } 40% { opacity: 1; } 100% { transform: translate(var(--hx), -80px) scale(1.4) rotate(var(--hr)); opacity: 0; } }
        `}</style>
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 20%, rgba(99,102,241,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.08) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "relative", zIndex: 1, maxWidth: 680, margin: "0 auto" }}>

                <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block", marginBottom: 4 }}>INTERN QUEST</div>

                <div style={{ textAlign: "center", marginBottom: 40, padding: "32px 24px", borderRadius: 24, background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.04))", border: "1px solid rgba(99,102,241,0.2)" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                        <div onClick={handlePet} key={petKey} style={{ position: "relative", cursor: "pointer", animation: petKey > 0 ? "petSquish 0.6s ease-out" : "none" }}>
                            <DotKun size={160} stage={stage} mood="cheer" />
                            {petHearts.map(h => (
                                <div key={h.id} style={{ position: "absolute", top: 30, left: 70, fontSize: 26, pointerEvents: "none", animation: "heartPop 1s ease-out forwards", ["--hx" as any]: h.hx, ["--hr" as any]: h.hr }}>💗</div>
                            ))}
                        </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, marginBottom: 8 }}>👆 タップしてなでてあげよう{petCount > 0 ? `（今日 ${petCount}回）` : ""}</div>
                    <h1 style={{ fontSize: 28, fontWeight: 900, color: "#f9fafb", margin: "0 0 12px" }}>{petMsg || "やっほー！ぼくドットくんだよ〜"}</h1>
                    <p style={{ fontSize: 15, color: "#c7d2fe", lineHeight: 1.8, margin: 0 }}>
                        きみのインターン生活を、となりでずっと見守ってる相棒だよ。<br />
                        がんばってる日も、ちょっと疲れた日も、ぼくはいつもここにいるからね！
                    </p>
                </div>

                <div style={{ marginBottom: 40 }}>
                    <h2 style={{ fontSize: 13, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>📋 ぼくのプロフィール</h2>
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 8 }}>
                        {PROFILE.map((p, i) => (
                            <div key={p.label} style={{ display: "flex", gap: 16, padding: "14px 16px", borderBottom: i < PROFILE.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                                <div style={{ fontSize: 13, color: "#9ca3af", fontWeight: 700, width: 96, flexShrink: 0 }}>{p.label}</div>
                                <div style={{ fontSize: 14, color: "#e5e7eb", lineHeight: 1.6 }}>{p.value}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ marginBottom: 40 }}>
                    <h2 style={{ fontSize: 13, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>✨ ぼくの進化5段階</h2>
                    <p style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.7, marginBottom: 20 }}>
                        きみがレベルを上げるたびに、ぼくも進化していくんだ。今のぼくが何段階目か、マイページで確認してみてね！
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {STAGES.map((s) => (
                            <div key={s.stage} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(99,102,241,0.15)" }}>
                                <div style={{ width: 80, height: 80, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 16, background: "rgba(99,102,241,0.08)" }}>
                                    <DotKun size={72} stage={s.stage} mood={s.mood} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: "#0a0a0f", background: "linear-gradient(135deg, #8b5cf6, #6366f1)", padding: "2px 10px", borderRadius: 999 }}>Stage {s.stage}</span>
                                        <span style={{ fontSize: 15, fontWeight: 800, color: "#f9fafb" }}>{s.name}</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", padding: "2px 10px", borderRadius: 999 }}>{s.lv}</span>
                                    </div>
                                    <div style={{ fontSize: 13, color: "#c7d2fe", lineHeight: 1.6 }}>{s.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ marginBottom: 40, padding: "28px 24px", borderRadius: 20, background: "linear-gradient(135deg, rgba(251,191,36,0.1), rgba(139,92,246,0.06))", border: "1px solid rgba(251,191,36,0.25)", textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                        <DotKun size={90} stage={4} mood="cheer" />
                    </div>
                    <div style={{ fontSize: 13, color: "#fbbf24", fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>ドットくんから、きみへ</div>
                    <p style={{ fontSize: 15, color: "#fef3c7", lineHeight: 1.9, margin: 0 }}>
                        完璧じゃなくていいんだよ。<br />
                        ちょっとずつでも、続けてるきみがいちばんえらい。<br />
                        うまくいかない日があっても大丈夫。<br />
                        ぼくはきみのこと、ぜんぶ見てるし、ずっと応援してるからね。<br />
                        <span style={{ fontWeight: 800, color: "#fde68a" }}>いっしょにいこ〜！</span>
                    </p>
                </div>

                <div style={{ display: "flex", justifyContent: "center", marginTop: 40, marginBottom: 16 }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>
                        メニューに戻る
                    </button>
                </div>

            </div>
        </main>
        </>
    );
}
