"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Survey = {
    id: string;
    title: string;
    description: string | null;
    reward_points: number;
};

type Question = {
    id: string;
    question_text: string;
    question_type: "single_choice" | "multi_choice" | "scale" | "text" | "rating" | "yes_no" | "nps" | "section";
    options: string[] | null;
    scale_min: number | null;
    scale_max: number | null;
    scale_min_label: string | null;
    scale_max_label: string | null;
    is_required: boolean;
    display_order: number;
    has_followup_text: boolean;
    followup_text_label: string | null;
};

export default function SurveyAnswerPage() {
    const router = useRouter();
    const params = useParams();
    const surveyId = params.id as string;

    const [survey, setSurvey] = useState<Survey | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [followupAnswers, setFollowupAnswers] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }

            // 既に回答済みか確認
            const { data: existing } = await supabase
                .from("survey_responses")
                .select("id")
                .eq("survey_id", surveyId)
                .eq("user_id", user.id)
                .maybeSingle();
            if (existing) {
                setSubmitted(true);
                setLoading(false);
                return;
            }

            // アンケート本体取得
            const { data: surveyRow } = await supabase
                .from("surveys")
                .select("*")
                .eq("id", surveyId)
                .eq("is_active", true)
                .maybeSingle();
            if (!surveyRow) {
                setErrorMsg("アンケートが見つかりません");
                setLoading(false);
                return;
            }
            setSurvey(surveyRow as Survey);

            // 質問取得
            const { data: qRows } = await supabase
                .from("survey_questions")
                .select("*")
                .eq("survey_id", surveyId)
                .order("display_order");
            setQuestions((qRows || []) as Question[]);
            setLoading(false);
        };
        load();
    }, [surveyId, router]);

    const handleSubmit = async () => {
        // 必須チェック
        for (const q of questions) {
            if (q.question_type === "section") continue;
            if (!q.is_required) continue;
            const val = answers[q.id];
            if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
                setErrorMsg(`「${q.question_text}」は必須回答です`);
                return;
            }
        }

        setSubmitting(true);
        setErrorMsg("");

        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !survey) return;

        // 回答データ整形
        const answersData = questions
            .filter(q => q.question_type !== "section")
            .map(q => ({
                question_id: q.id,
                question_text: q.question_text,
                question_type: q.question_type,
                value: answers[q.id] ?? null,
                followup: q.has_followup_text ? (followupAnswers[q.id] || null) : null,
            }));

        // 回答保存
        await supabase.from("survey_responses").insert({
            survey_id: surveyId,
            user_id: user.id,
            answers: answersData,
            points_awarded: survey.reward_points,
        });

        // ポイント付与
        const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", user.id).maybeSingle();
        const current = pointRow?.points || 0;
        await supabase.from("user_points").upsert({ id: user.id, points: current + survey.reward_points });
        await supabase.from("points_history").insert({
            user_id: user.id,
            change: survey.reward_points,
            reason: "survey_complete",
            created_at: new Date().toISOString(),
        });

        setSubmitting(false);
        setSubmitted(true);
    };

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    if (errorMsg && !survey) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>😔</div>
                    <div style={{ color: "#f87171", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{errorMsg}</div>
                    <button onClick={() => router.push("/surveys")} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>一覧に戻る</button>
                </div>
            </main>
        );
    }

    if (submitted) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
                    <div style={{ color: "#34d399", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>回答ありがとうございました！</div>
                    {survey && <div style={{ color: "#fbbf24", fontSize: 18, fontWeight: 700, marginBottom: 24 }}>+{survey.reward_points}pt 獲得しました</div>}
                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button onClick={() => router.push("/surveys")} style={{ padding: "10px 24px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#d1d5db", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>アンケート一覧</button>
                        <button onClick={() => router.push("/mypage")} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>マイページへ</button>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.06) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto" }}>

                <button onClick={() => router.push("/surveys")} style={{ background: "rgba(255,255,255,0.05)", color: "#9ca3af", padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontSize: 12, cursor: "pointer", fontWeight: 600, marginBottom: 16 }}>← アンケート一覧</button>

                {/* タイトル */}
                <div style={{ marginBottom: 32 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f9fafb", margin: "0 0 8px" }}>📋 {survey?.title}</h1>
                    {survey?.description && <p style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.7, margin: 0 }}>{survey.description}</p>}
                    <div style={{ marginTop: 12, padding: "8px 14px", borderRadius: 8, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)", display: "inline-block" }}>
                        <span style={{ fontSize: 12, color: "#a855f7", fontWeight: 700 }}>🎁 完了で +{survey?.reward_points}pt 獲得</span>
                    </div>
                </div>

                {/* 質問一覧 */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {questions.map((q, qi) => {
                        if (q.question_type === "section") {
                            return (
                                <div key={q.id} style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)" }}>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: "#f59e0b", marginBottom: 4 }}>🏗️ {q.question_text}</div>
                                </div>
                            );
                        }

                        return (
                            <div key={q.id} style={{ padding: "20px 24px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 14 }}>
                                    <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginTop: 4 }}>Q{qi + 1}.</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>
                                            {q.question_text}
                                            {q.is_required && <span style={{ color: "#f87171", marginLeft: 6, fontSize: 12 }}>*</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* 単一選択 */}
                                {q.question_type === "single_choice" && q.options && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {q.options.map((opt, i) => (
                                            <label key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: answers[q.id] === opt ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.02)", border: `1px solid ${answers[q.id] === opt ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", transition: "all 0.15s" }}>
                                                <input type="radio" name={q.id} checked={answers[q.id] === opt} onChange={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))} style={{ cursor: "pointer" }} />
                                                <span style={{ fontSize: 14, color: "#f9fafb" }}>{opt}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}

                                {/* 複数選択 */}
                                {q.question_type === "multi_choice" && q.options && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {q.options.map((opt, i) => {
                                            const selected = (answers[q.id] || []).includes(opt);
                                            return (
                                                <label key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: selected ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.02)", border: `1px solid ${selected ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", transition: "all 0.15s" }}>
                                                    <input type="checkbox" checked={selected} onChange={(e) => {
                                                        const current = answers[q.id] || [];
                                                        if (e.target.checked) {
                                                            setAnswers(prev => ({ ...prev, [q.id]: [...current, opt] }));
                                                        } else {
                                                            setAnswers(prev => ({ ...prev, [q.id]: current.filter((v: string) => v !== opt) }));
                                                        }
                                                    }} style={{ cursor: "pointer" }} />
                                                    <span style={{ fontSize: 14, color: "#f9fafb" }}>{opt}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* 尺度評価 */}
                                {q.question_type === "scale" && q.scale_min !== null && q.scale_max !== null && (
                                    <div>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
                                            <span>{q.scale_min_label}</span>
                                            <span>{q.scale_max_label}</span>
                                        </div>
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                            {Array.from({ length: q.scale_max - q.scale_min + 1 }, (_, i) => q.scale_min! + i).map(v => (
                                                <button key={v} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: v }))} style={{ flex: 1, minWidth: 40, padding: "12px 0", borderRadius: 8, border: `1px solid ${answers[q.id] === v ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.1)"}`, background: answers[q.id] === v ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: answers[q.id] === v ? "#fff" : "#9ca3af", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>{v}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 星評価 */}
                                {q.question_type === "rating" && q.scale_max !== null && (
                                    <div style={{ display: "flex", gap: 4 }}>
                                        {Array.from({ length: q.scale_max }, (_, i) => i + 1).map(v => (
                                            <button key={v} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: v }))} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 32, padding: 4, transition: "transform 0.1s", transform: answers[q.id] >= v ? "scale(1.1)" : "scale(1)" }}>
                                                {answers[q.id] >= v ? "⭐" : "☆"}
                                            </button>
                                        ))}
                                        {answers[q.id] && <span style={{ marginLeft: 12, color: "#fbbf24", fontWeight: 700, fontSize: 14, alignSelf: "center" }}>{answers[q.id]} / {q.scale_max}</span>}
                                    </div>
                                )}

                                {/* はい/いいえ */}
                                {q.question_type === "yes_no" && (
                                    <div style={{ display: "flex", gap: 8 }}>
                                        {["はい", "いいえ"].map(v => (
                                            <button key={v} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: v }))} style={{ flex: 1, padding: "12px 20px", borderRadius: 8, border: `1px solid ${answers[q.id] === v ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.1)"}`, background: answers[q.id] === v ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: answers[q.id] === v ? "#fff" : "#9ca3af", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>{v === "はい" ? "✅ はい" : "❌ いいえ"}</button>
                                        ))}
                                    </div>
                                )}

                                {/* NPS */}
                                {q.question_type === "nps" && (
                                    <div>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
                                            <span>全く勧めない</span>
                                            <span>強く勧める</span>
                                        </div>
                                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                            {Array.from({ length: 11 }, (_, i) => i).map(v => (
                                                <button key={v} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: v }))} style={{ flex: 1, minWidth: 36, padding: "10px 0", borderRadius: 8, border: `1px solid ${answers[q.id] === v ? "rgba(168,85,247,0.6)" : "rgba(255,255,255,0.1)"}`, background: answers[q.id] === v ? "linear-gradient(135deg, #a855f7, #ec4899)" : "rgba(255,255,255,0.05)", color: answers[q.id] === v ? "#fff" : "#9ca3af", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>{v}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 自由記述 */}
                                {q.question_type === "text" && (
                                    <textarea value={answers[q.id] || ""} onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} placeholder="ご記入ください..." style={{ width: "100%", minHeight: 100, padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                                )}

                                {/* 補足記述（任意） */}
                                {q.has_followup_text && (q.question_type as string) !== "section" && (q.question_type as string) !== "text" && (
                                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed rgba(168,85,247,0.3)" }}>
                                        <div style={{ fontSize: 12, color: "#a855f7", fontWeight: 700, marginBottom: 6 }}>💬 {q.followup_text_label || "補足コメント（任意）"}</div>
                                        <textarea value={followupAnswers[q.id] || ""} onChange={(e) => setFollowupAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} placeholder="自由にご記入ください..." style={{ width: "100%", minHeight: 70, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(168,85,247,0.2)", background: "rgba(168,85,247,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {questions.filter(q => q.question_type !== "section").length === 0 && (
                    <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14, background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" }}>このアンケートには質問がまだ登録されていません</div>
                )}

                {/* 送信ボタン */}
                {questions.filter(q => q.question_type !== "section").length > 0 && (
                    <div style={{ marginTop: 32, padding: 20, borderRadius: 12, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)" }}>
                        {errorMsg && <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", fontSize: 13, fontWeight: 600 }}>⚠️ {errorMsg}</div>}
                        <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: "14px 24px", borderRadius: 10, border: "none", background: submitting ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", fontSize: 15 }}>
                            {submitting ? "送信中..." : `📤 回答を送信して +${survey?.reward_points}pt 獲得`}
                        </button>
                        <div style={{ fontSize: 11, color: "#6b7280", textAlign: "center", marginTop: 8 }}>送信後は編集できません</div>
                    </div>
                )}
            </div>
        </main>
    );
}