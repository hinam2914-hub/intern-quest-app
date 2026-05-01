"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Survey = {
    id: string;
    title: string;
    description: string | null;
    reward_points: number;
    is_active: boolean;
    starts_at: string | null;
    ends_at: string | null;
    created_at: string;
    question_count?: number;
    answered?: boolean;
};

export default function SurveysPage() {
    const router = useRouter();
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }

            // 公開中のアンケート取得
            const { data: surveyRows } = await supabase
                .from("surveys")
                .select("*")
                .eq("is_active", true)
                .order("created_at", { ascending: false });

            // 質問数取得
            const { data: qRows } = await supabase
                .from("survey_questions")
                .select("survey_id");

            // 自分の回答済み取得
            const { data: rRows } = await supabase
                .from("survey_responses")
                .select("survey_id")
                .eq("user_id", user.id);

            const enriched = (surveyRows || []).map((s: any) => ({
                ...s,
                question_count: (qRows || []).filter((q: any) => q.survey_id === s.id).length,
                answered: (rRows || []).some((r: any) => r.survey_id === s.id),
            }));

            // 期間フィルタ
            const now = new Date();
            const filtered = enriched.filter((s: Survey) => {
                if (s.starts_at && new Date(s.starts_at) > now) return false;
                if (s.ends_at && new Date(s.ends_at) < now) return false;
                return true;
            });

            setSurveys(filtered as Survey[]);
            setLoading(false);
        };
        load();
    }, [router]);

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.06) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto" }}>

                {/* ヘッダー */}
                <div style={{ marginBottom: 32 }}>
                    <button onClick={() => router.push("/mypage")} style={{ background: "rgba(255,255,255,0.05)", color: "#9ca3af", padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontSize: 12, cursor: "pointer", fontWeight: 600, marginBottom: 16 }}>← マイページに戻る</button>
                    <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>SURVEYS</div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 8px" }}>📋 アンケート</h1>
                    <p style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}>回答するとポイントがもらえます。所要時間は約3〜5分です。</p>
                </div>

                {/* アンケート一覧 */}
                {surveys.length === 0 ? (
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 40, textAlign: "center" }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                        <div style={{ fontSize: 14, color: "#9ca3af" }}>現在公開中のアンケートはありません</div>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {surveys.map(s => (
                            <div
                                key={s.id}
                                onClick={() => !s.answered && router.push(`/surveys/${s.id}`)}
                                style={{
                                    padding: "20px 24px",
                                    borderRadius: 16,
                                    background: s.answered ? "rgba(52,211,153,0.05)" : "rgba(255,255,255,0.03)",
                                    border: `1px solid ${s.answered ? "rgba(52,211,153,0.3)" : "rgba(99,102,241,0.3)"}`,
                                    cursor: s.answered ? "default" : "pointer",
                                    transition: "all 0.2s ease",
                                    opacity: s.answered ? 0.7 : 1,
                                }}
                                onMouseEnter={(e) => {
                                    if (!s.answered) {
                                        e.currentTarget.style.transform = "translateY(-2px)";
                                        e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.2)";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.boxShadow = "none";
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: 16, fontWeight: 800, color: "#f9fafb" }}>📋 {s.title}</span>
                                            {s.answered ? (
                                                <span style={{ padding: "2px 10px", borderRadius: 6, background: "rgba(52,211,153,0.2)", color: "#34d399", fontSize: 11, fontWeight: 700 }}>✅ 回答済み</span>
                                            ) : (
                                                <span style={{ padding: "2px 10px", borderRadius: 6, background: "rgba(251,191,36,0.2)", color: "#fbbf24", fontSize: 11, fontWeight: 700 }}>⏳ 未回答</span>
                                            )}
                                            <span style={{ padding: "2px 10px", borderRadius: 6, background: "rgba(168,85,247,0.2)", color: "#a855f7", fontSize: 11, fontWeight: 700 }}>+{s.reward_points}pt</span>
                                        </div>
                                        {s.description && <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.6, marginBottom: 8 }}>{s.description}</div>}
                                        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#6b7280" }}>
                                            <span>📝 {s.question_count || 0}問</span>
                                            {s.ends_at && <span>📅 締切: {new Date(s.ends_at).toLocaleDateString("ja-JP")}</span>}
                                        </div>
                                    </div>
                                    {!s.answered && (
                                        <div style={{ marginLeft: 12, color: "#818cf8", fontSize: 18 }}>→</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}