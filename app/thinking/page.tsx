"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

interface Question { id: string; content: string; created_at: string; }
interface Answer { id: string; question_id: string; user_id: string; content: string; created_at: string; name: string; }

export default function ThinkingPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState("");
    const [question, setQuestion] = useState<Question | null>(null);
    const [answers, setAnswers] = useState<Answer[]>([]);
    const [myAnswer, setMyAnswer] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");

    const loadData = useCallback(async () => {
        // 出題中の最新お題を1つ取得
        const { data: qRows } = await supabase
            .from("thinking_questions")
            .select("*")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1);
        const q = (qRows || [])[0] as Question | undefined;
        setQuestion(q || null);

        if (q) {
            // そのお題への回答を取得
            const { data: aRows } = await supabase
                .from("thinking_answers")
                .select("id, question_id, user_id, content, created_at")
                .eq("question_id", q.id)
                .order("created_at", { ascending: false })
                .limit(200);
            const rows = (aRows || []) as Omit<Answer, "name">[];
            // 名前を引く
            const ids = Array.from(new Set(rows.map(r => r.user_id)));
            const nameMap: Record<string, string> = {};
            if (ids.length > 0) {
                const { data: profs } = await supabase.from("profiles").select("id, name").in("id", ids);
                (profs || []).forEach((p: any) => { nameMap[p.id] = p.name || "名前未設定"; });
            }
            setAnswers(rows.map(r => ({ ...r, name: nameMap[r.user_id] || "名前未設定" })));
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            await loadData();
        })();
    }, [loadData, router]);

    const handleSubmit = async () => {
        if (!myAnswer.trim() || !question || submitting) return;
        setSubmitting(true);
        const { error } = await supabase.from("thinking_answers").insert({
            question_id: question.id,
            user_id: userId,
            content: myAnswer.trim(),
        });
        if (error) { setMessage("投稿に失敗しました"); setSubmitting(false); return; }
        setMyAnswer("");
        setMessage("投稿しました！");
        await loadData();
        setSubmitting(false);
        setTimeout(() => setMessage(""), 2500);
    };

    if (loading) return <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center" }}>読み込み中...</div>;

    return (
        <div style={{ minHeight: "100vh", background: "#0a0a0f", padding: "32px 20px" }}>
            <div style={{ maxWidth: 680, margin: "0 auto" }}>
                <div onClick={() => router.push("/menu")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 24px" }}>🧠 思考クエスト</h1>

                {!question ? (
                    <div style={{ padding: 24, borderRadius: 16, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#9ca3af" }}>今出題中のお題はありません。</div>
                ) : (
                    <>
                        {/* お題 */}
                        <div style={{ padding: "24px", borderRadius: 16, background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))", border: "1px solid rgba(99,102,241,0.3)", marginBottom: 24 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", marginBottom: 8 }}>今日のお題</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: "#f9fafb", lineHeight: 1.6 }}>{question.content}</div>
                        </div>

                        {/* 回答フォーム */}
                        <div style={{ marginBottom: 28 }}>
                            <textarea
                                value={myAnswer}
                                onChange={(e) => setMyAnswer(e.target.value)}
                                placeholder="自分の考えを書いてみよう..."
                                rows={4}
                                style={{ width: "100%", padding: "14px", borderRadius: 12, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.08)", color: "#f9fafb", fontSize: 15, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.6 }}
                            />
                            <button onClick={handleSubmit} disabled={submitting || !myAnswer.trim()} style={{ marginTop: 10, width: "100%", padding: "14px", borderRadius: 12, border: "none", background: submitting || !myAnswer.trim() ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: submitting || !myAnswer.trim() ? "not-allowed" : "pointer", fontSize: 15 }}>
                                {submitting ? "送信中..." : "考えを投稿する"}
                            </button>
                            {message && <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 10, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399", fontWeight: 600, fontSize: 14 }}>{message}</div>}
                        </div>

                        {/* みんなの回答 */}
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#9ca3af", marginBottom: 12 }}>みんなの考え（{answers.length}）</div>
                        {answers.length === 0 ? (
                            <div style={{ padding: 20, color: "#6b7280", fontSize: 14, textAlign: "center" }}>まだ回答がありません。最初の一人になろう！</div>
                        ) : (
                            answers.map((a) => (
                                <div key={a.id} style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 12 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: "#818cf8" }}>{a.name}</span>
                                        <span style={{ fontSize: 11, color: "#6b7280" }}>{new Date(a.created_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}</span>
                                    </div>
                                    <div style={{ fontSize: 14, color: "#e5e7eb", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{a.content}</div>
                                </div>
                            ))
                        )}
                    </>
                )}

                <button onClick={() => router.push("/menu")} style={{ marginTop: 32, padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>メニューへ戻る</button>
            </div>
        </div>
    );
}
