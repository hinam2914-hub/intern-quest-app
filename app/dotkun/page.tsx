"use client";

import { useRouter } from "next/navigation";
import DotKun from "../components/DotKun";

const STAGES = [
    { stage: 1, mood: "happy" as const, name: "うまれたて", desc: "あたまに小さな芽がついてるよ。まだ何も知らないけど、これからきみと一緒に成長していくんだ〜！" },
    { stage: 2, mood: "normal" as const, name: "ちょっと成長", desc: "手が生えてきたよ！きみが日報を書いたり、活動するたびにぼくも少しずつ大きくなるんだ。" },
    { stage: 3, mood: "happy" as const, name: "マフラーゲット", desc: "青いマフラーをもらったよ〜。ここまで続けてくれてありがとう。なんだか自信がついてきた！" },
    { stage: 4, mood: "cheer" as const, name: "王冠と羽", desc: "王冠と羽が生えた！きみの努力がぼくを輝かせてくれてるんだよ。もうすぐ最終形態だ〜！" },
    { stage: 5, mood: "cheer" as const, name: "さいきょうドットくん", desc: "ついに天使のわっかがついたよ✨ ここまできたきみは本当にすごい。ぼくは一生きみの味方だからね！" },
];

const PROFILE = [
    { label: "なまえ", value: "ドットくん" },
    { label: "たんじょう", value: "Intern Quest と同じ日に生まれたよ" },
    { label: "せいかく", value: "ポジティブで、ちょっとおせっかい。でも応援は本気！" },
    { label: "すきなもの", value: "きみの日報を読むこと。あと、レベルが上がる音" },
    { label: "とくぎ", value: "へこんでる人をそっと励ますこと" },
];

export default function DotKunPage() {
    const router = useRouter();

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 20%, rgba(99,102,241,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.08) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "relative", zIndex: 1, maxWidth: 680, margin: "0 auto" }}>

                <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block", marginBottom: 4 }}>INTERN QUEST</div>

                <div style={{ textAlign: "center", marginBottom: 40, padding: "32px 24px", borderRadius: 24, background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.04))", border: "1px solid rgba(99,102,241,0.2)" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                        <DotKun size={160} stage={5} mood="cheer" />
                    </div>
                    <h1 style={{ fontSize: 28, fontWeight: 900, color: "#f9fafb", margin: "0 0 12px" }}>やっほー！ぼくドットくんだよ〜</h1>
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
                    <button onClick={() => router.push("/mypage")} style={{ padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>
                        マイページに戻る
                    </button>
                </div>

            </div>
        </main>
    );
}
