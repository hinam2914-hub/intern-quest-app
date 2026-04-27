"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const STEPS = [
    {
        id: 1,
        emoji: "🎯",
        title: "まずやること",
        subtitle: "アカウントを完成させよう",
        items: [
            { icon: "📸", label: "プロフィール写真を設定する", path: "/profile" },
            { icon: "✏️", label: "名前・学歴・事業部を入力する", path: "/mypage" },
            { icon: "🧠", label: "MBTIと部活を設定する", path: "/profile" },
            { icon: "🎨", label: "テーマカラーをカスタマイズする", path: "/profile" },
        ],
    },
    {
        id: 2,
        emoji: "📋",
        title: "日々のタスク",
        subtitle: "毎日続けることで成長が加速する",
        items: [
            { icon: "📝", label: "日報を毎日提出する", path: "/report" },
            { icon: "📊", label: "KPIを入力する", path: "/kpi" },
            { icon: "🎉", label: "サンキューを送る", path: "/thanks" },
            { icon: "📚", label: "学習コンテンツを見る", path: "/learn" },
        ],
    },
    {
        id: 3,
        emoji: "🏆",
        title: "ポイント・ボーナス",
        subtitle: "行動するたびにポイントが貯まる",
        items: [
            { icon: "🔐", label: "ログインボーナス", bonus: "+1pt/日" },
            { icon: "📋", label: "日報提出", bonus: "+2pt/回" },
            { icon: "🔥", label: "連続提出ボーナス", bonus: "継続で加算" },
            { icon: "🎉", label: "サンキュー受け取り", bonus: "+1pt/件" },
            { icon: "📚", label: "学習コンテンツ完了", bonus: "+2pt/回" },
            { icon: "🎯", label: "月次KPI達成", bonus: "+30pt〜" },
        ],
    },
];

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [userId, setUserId] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const { data: profile } = await supabase.from("profiles").select("name, onboarding_done").eq("id", user.id).single();
            setName(profile?.name || "");
            setLoading(false);
        };
        load();
    }, []);

    const handleComplete = async () => {
        if (userId) {
            await supabase.from("profiles").update({ onboarding_done: true }).eq("id", userId);
        }
        router.push("/mypage");
    };

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    const currentStep = STEPS[step];
    const isLast = step === STEPS.length - 1;

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", fontFamily: "'Inter', sans-serif", padding: "40px 24px 64px" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.12) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 560, margin: "0 auto" }}>

                {/* ===== ヘッダー（統一） ===== */}
                <div style={{ marginBottom: 32 }}>
                    <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>
                        📖 {name ? `${name}さん、ようこそ！` : "ようこそ！"}
                    </h1>
                    <p style={{ color: "#6b7280", fontSize: 14, margin: "8px 0 0" }}>Intern Questの使い方を確認しましょう</p>
                </div>

                {/* ステップインジケーター */}
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32 }}>
                    {STEPS.map((s, i) => (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: i <= step ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", border: `2px solid ${i <= step ? "transparent" : "rgba(255,255,255,0.1)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: i <= step ? "#fff" : "#6b7280", transition: "all 0.3s" }}>
                                {i < step ? "✓" : s.id}
                            </div>
                            {i < STEPS.length - 1 && (
                                <div style={{ width: 40, height: 2, background: i < step ? "linear-gradient(90deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.08)", borderRadius: 999, transition: "all 0.3s" }} />
                            )}
                        </div>
                    ))}
                </div>

                {/* メインカード */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: 40, marginBottom: 16 }}>
                    <div style={{ textAlign: "center", marginBottom: 32 }}>
                        <div style={{ fontSize: 56, marginBottom: 16 }}>{currentStep.emoji}</div>
                        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#f9fafb", margin: "0 0 8px" }}>Step {currentStep.id}：{currentStep.title}</h2>
                        <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>{currentStep.subtitle}</p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {currentStep.items.map((item, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <span style={{ fontSize: 20 }}>{item.icon}</span>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: "#d1d5db" }}>{item.label}</span>
                                </div>
                                {"bonus" in item ? (
                                    <span style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", background: "rgba(99,102,241,0.15)", padding: "4px 10px", borderRadius: 6 }}>{item.bonus}</span>
                                ) : (
                                    <button onClick={() => router.push(item.path!)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.1)", color: "#818cf8", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                                        設定 →
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ステップ移動ボタン */}
                <div style={{ display: "flex", gap: 12 }}>
                    {step > 0 && (
                        <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontWeight: 700, cursor: "pointer", fontSize: 15 }}>
                            ← 前のステップ
                        </button>
                    )}
                    <button onClick={isLast ? handleComplete : () => setStep(s => s + 1)} style={{ flex: 2, padding: "14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 15 }}>
                        {isLast ? "🚀 はじめる！" : "次のステップ →"}
                    </button>
                </div>

                {/* ===== メニューへ戻るボタン（統一） ===== */}
                <div style={{ display: "flex", justifyContent: "center", marginTop: 48, marginBottom: 32 }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>
                        メニューへ戻る
                    </button>
                </div>
            </div>
        </main>
    );
}