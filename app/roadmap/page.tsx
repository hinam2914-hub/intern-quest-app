"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

interface Roadmap {
    user_id: string;
    month3: string;
    month6: string;
    year1: string;
    year3: string;
    goal: string;
    current_self: string;
    life_theme: string;
    role_model: string;
    shadow_future: string;
    this_week_action: string;
}

const EMPTY_ROADMAP: Omit<Roadmap, "user_id"> = {
    month3: "",
    month6: "",
    year1: "",
    year3: "",
    goal: "",
    current_self: "",
    life_theme: "",
    role_model: "",
    shadow_future: "",
    this_week_action: "",
};

export default function RoadmapPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedMessage, setSavedMessage] = useState("");
    const [userId, setUserId] = useState("");
    const [data, setData] = useState<Omit<Roadmap, "user_id">>(EMPTY_ROADMAP);
    const [openSection, setOpenSection] = useState<string | null>(null);
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

            const { data: roadmap } = await supabase
                .from("roadmaps")
                .select("*")
                .eq("user_id", user.id)
                .maybeSingle();

            if (roadmap) {
                setData({
                    month3: roadmap.month3 || "",
                    month6: roadmap.month6 || "",
                    year1: roadmap.year1 || "",
                    year3: roadmap.year3 || "",
                    goal: roadmap.goal || "",
                    current_self: roadmap.current_self || "",
                    life_theme: roadmap.life_theme || "",
                    role_model: roadmap.role_model || "",
                    shadow_future: roadmap.shadow_future || "",
                    this_week_action: roadmap.this_week_action || "",
                });
            }
            setLoading(false);
        };
        load();
    }, [router]);

    const handleSave = async () => {
        if (!userId) return;
        setSaving(true);
        setSavedMessage("");
        const { error } = await supabase
            .from("roadmaps")
            .upsert({ user_id: userId, ...data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
        setSaving(false);
        if (error) {
            setSavedMessage("❌ 保存に失敗しました");
        } else {
            setSavedMessage("✅ 保存しました");
            setTimeout(() => setSavedMessage(""), 3000);
        }
    };

    const update = (key: keyof typeof EMPTY_ROADMAP, value: string) => {
        setData(prev => ({ ...prev, [key]: value }));
    };

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
                読み込み中...
            </main>
        );
    }

    const timelineSteps = [
        { key: "month3" as const, label: "3ヶ月後", short: "3M", color: "#6366f1", bg: "rgba(99,102,241,0.08)", border: "rgba(99,102,241,0.3)" },
        { key: "month6" as const, label: "6ヶ月後", short: "6M", color: "#8b5cf6", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.3)" },
        { key: "year1" as const, label: "1年後", short: "1Y", color: "#a855f7", bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.3)" },
        { key: "year3" as const, label: "3年後", short: "3Y", color: "#d946ef", bg: "rgba(217,70,239,0.08)", border: "rgba(217,70,239,0.3)" },
    ];

    const collapsibleSections = [
        { key: "life_theme" as const, icon: "🧭", label: "人生のテーマ・価値観", placeholder: "負けない軸・大事にしている価値観" },
        { key: "role_model" as const, icon: "⭐", label: "ロールモデル", placeholder: "この人になりたい・参考にしている人" },
        { key: "shadow_future" as const, icon: "🌫️", label: "避けたい未来", placeholder: "こうはなりたくないという未来像" },
    ];

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: isMobile ? "24px 16px" : "40px 24px 64px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(circle at 20% 30%, rgba(99,102,241,0.08), transparent 50%), radial-gradient(circle at 80% 70%, rgba(236,72,153,0.05), transparent 50%)", pointerEvents: "none", zIndex: 0 }}></div>
            <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto" }}>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                    <div onClick={() => router.push("/mypage")} style={{ cursor: "pointer" }}>
                        <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>INTERN QUEST</div>
                        <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>🗺️ 人生のロードマップ</h1>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{ background: saving ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", padding: "10px 24px", borderRadius: 10, border: "none", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontSize: 14 }}
                    >
                        {saving ? "保存中..." : "💾 保存"}
                    </button>
                </div>

                {savedMessage && (
                    <div style={{ background: savedMessage.includes("✅") ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${savedMessage.includes("✅") ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`, color: savedMessage.includes("✅") ? "#34d399" : "#f87171", padding: "10px 16px", borderRadius: 10, marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
                        {savedMessage}
                    </div>
                )}

                <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 16 }}>📍</span>
                        <span style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2 }}>現在地 · CURRENT SELF</span>
                    </div>
                    <textarea
                        value={data.current_self}
                        onChange={(e) => update("current_self", e.target.value)}
                        placeholder="今の自分を言語化してみよう（強み・状態・気持ちなど）"
                        style={{ width: "100%", minHeight: 70, padding: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", color: "#f9fafb", fontSize: 14, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                    />
                </div>

                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>🛤️ TIMELINE</div>

                    <div style={{ position: "relative", paddingLeft: 32 }}>
                        <div style={{ position: "absolute", left: 14, top: 8, bottom: 8, width: 2, background: "linear-gradient(to bottom, #6366f1, #8b5cf6, #ec4899)" }}></div>

                        {timelineSteps.map((step) => (
                            <div key={step.key} style={{ position: "relative", marginBottom: 16 }}>
                                <div style={{ position: "absolute", left: -26, top: 8, width: 24, height: 24, borderRadius: "50%", background: step.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700 }}>
                                    {step.short}
                                </div>
                                <div style={{ background: step.bg, border: `1px solid ${step.border}`, borderRadius: 10, padding: 12 }}>
                                    <div style={{ fontSize: 10, color: step.color, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>{step.label}</div>
                                    <textarea
                                        value={data[step.key]}
                                        onChange={(e) => update(step.key, e.target.value)}
                                        placeholder={`${step.label}にどうなっていたい？`}
                                        style={{ width: "100%", minHeight: 50, padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", color: "#f9fafb", fontSize: 13, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                                    />
                                </div>
                            </div>
                        ))}

                        <div style={{ position: "relative" }}>
                            <div style={{ position: "absolute", left: -28, top: 8, width: 28, height: 28, borderRadius: "50%", background: "#ec4899", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🏆</div>
                            <div style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.4)", borderRadius: 12, padding: 14 }}>
                                <div style={{ fontSize: 10, color: "#f9a8d4", fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>人生ゴール · GOAL</div>
                                <textarea
                                    value={data.goal}
                                    onChange={(e) => update("goal", e.target.value)}
                                    placeholder="人生でこれだけは絶対実現したいこと"
                                    style={{ width: "100%", minHeight: 60, padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", color: "#f9fafb", fontSize: 14, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {collapsibleSections.map((sec) => {
                    const isOpen = openSection === sec.key;
                    return (
                        <div key={sec.key} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
                            <div
                                onClick={() => setOpenSection(isOpen ? null : sec.key)}
                                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 14 }}>{sec.icon}</span>
                                    <span style={{ color: "#f9fafb", fontSize: 13, fontWeight: 500 }}>{sec.label}</span>
                                    {data[sec.key] && <span style={{ fontSize: 10, color: "#34d399", marginLeft: 4 }}>● 記入済み</span>}
                                </div>
                                <span style={{ color: "#6b7280", fontSize: 12 }}>{isOpen ? "▼" : "▶"}</span>
                            </div>
                            {isOpen && (
                                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                                    <textarea
                                        value={data[sec.key]}
                                        onChange={(e) => update(sec.key, e.target.value)}
                                        placeholder={sec.placeholder}
                                        style={{ width: "100%", minHeight: 80, padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", color: "#f9fafb", fontSize: 13, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}

                <div style={{ background: "rgba(236,72,153,0.08)", border: "1px solid rgba(236,72,153,0.3)", borderRadius: 12, padding: 16, marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 16 }}>🎯</span>
                        <span style={{ fontSize: 11, color: "#f9a8d4", fontWeight: 700, letterSpacing: 2 }}>今週の一歩 · THIS WEEK</span>
                    </div>
                    <textarea
                        value={data.this_week_action}
                        onChange={(e) => update("this_week_action", e.target.value)}
                        placeholder="未来へ近づくための、今週やる具体的なアクション"
                        style={{ width: "100%", minHeight: 70, padding: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", color: "#f9fafb", fontSize: 14, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                    />
                </div>

                <div style={{ display: "flex", justifyContent: "center", marginTop: 32, marginBottom: 24 }}>
                    <button
                        onClick={() => router.push("/menu")}
                        style={{ background: "rgba(255,255,255,0.05)", color: "#d1d5db", padding: "12px 32px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", fontSize: 14 }}
                    >
                        ☰ メニューに戻る
                    </button>
                </div>

            </div>
        </main>
    );
}