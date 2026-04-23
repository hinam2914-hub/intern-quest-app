"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Solution = {
    id: string;
    problem_description: string | null;
    solution: string;
    result: string | null;
    status: string;
    admin_comment: string | null;
    created_at: string;
    reviewed_at: string | null;
};

export default function KkcPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState("");
    const [mySolutions, setMySolutions] = useState<Solution[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [problemText, setProblemText] = useState("");
    const [solutionText, setSolutionText] = useState("");
    const [resultText, setResultText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);

            const { data: solRows } = await supabase.from("problem_solutions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
            setMySolutions((solRows || []) as Solution[]);

            setLoading(false);
        };
        load();
    }, [router]);

    const handleSubmit = async () => {
        if (!problemText.trim() || !solutionText.trim() || !resultText.trim()) {
            setMessage("すべての項目を入力してください");
            return;
        }
        setSubmitting(true);
        await supabase.from("problem_solutions").insert({
            user_id: userId,
            problem_description: problemText.trim(),
            solution: solutionText.trim(),
            result: resultText.trim(),
            status: "pending",
        });
        setMessage("✅ 提出しました。審査をお待ちください");
        setProblemText(""); setSolutionText(""); setResultText("");
        setShowForm(false);

        const { data: solRows } = await supabase.from("problem_solutions").select("*").eq("user_id", userId).order("created_at", { ascending: false });
        setMySolutions((solRows || []) as Solution[]);
        setSubmitting(false);
        setTimeout(() => setMessage(""), 3000);
    };

    const getStatusLabel = (status: string) => {
        if (status === "approved") return { text: "✅ 承認", color: "#10b981", bg: "rgba(16,185,129,0.15)" };
        if (status === "rejected") return { text: "❌ 却下", color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
        return { text: "⏳ 審査中", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" };
    };

    if (loading) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
        </main>
    );

    const approvedCount = mySolutions.filter(s => s.status === "approved").length;
    const pendingCount = mySolutions.filter(s => s.status === "pending").length;

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 800, margin: "0 auto" }}>
                <div onClick={() => router.push("/menu")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", marginBottom: 8 }}>INTERN QUEST</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "0 0 4px" }}>💡 KKC 課題解決案box</h1>
                        <p style={{ color: "#9ca3af", fontSize: 14, margin: 0 }}>業務で見つけた課題・実施した解決案・結果を共有しよう</p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <div style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
                            <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>承認済み</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: "#10b981" }}>{approvedCount}</div>
                        </div>
                        <div style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
                            <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700 }}>審査中</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b" }}>{pendingCount}</div>
                        </div>
                    </div>
                </div>

                {message && <div style={{ padding: 12, borderRadius: 8, background: message.includes("✅") ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: message.includes("✅") ? "#10b981" : "#ef4444", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{message}</div>}

                {!showForm ? (
                    <button onClick={() => setShowForm(true)} style={{ width: "100%", padding: "16px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 24 }}>
                        ➕ 新しい投稿を追加（承認で +1pt）
                    </button>
                ) : (
                    <div style={{ padding: 20, borderRadius: 14, background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.2)", marginBottom: 24 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>📝 新規投稿</div>

                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, letterSpacing: 1, display: "block", marginBottom: 4 }}>① 課題</label>
                            <textarea value={problemText} onChange={(e) => setProblemText(e.target.value)} placeholder="例：新規インターンの初回日報のクオリティがバラバラで、確認に時間がかかっていた" style={{ width: "100%", minHeight: 70, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, letterSpacing: 1, display: "block", marginBottom: 4 }}>② 解決案</label>
                            <textarea value={solutionText} onChange={(e) => setSolutionText(e.target.value)} placeholder="例：日報テンプレートを作成し、提出前に自己チェック項目を追加" style={{ width: "100%", minHeight: 70, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, letterSpacing: 1, display: "block", marginBottom: 4 }}>③ 結果</label>
                            <textarea value={resultText} onChange={(e) => setResultText(e.target.value)} placeholder="例：確認時間が半分に短縮、インターン側の気付きも増えた" style={{ width: "100%", minHeight: 70, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={handleSubmit} disabled={submitting} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: submitting ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer" }}>{submitting ? "提出中..." : "📤 提出する"}</button>
                            <button onClick={() => { setShowForm(false); setProblemText(""); setSolutionText(""); setResultText(""); }} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>キャンセル</button>
                        </div>
                    </div>
                )}

                <div>
                    <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>📋 自分の投稿履歴</div>
                    {mySolutions.length === 0 ? (
                        <div style={{ padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center", color: "#6b7280", fontSize: 14 }}>まだ投稿がありません</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {mySolutions.map(s => {
                                const status = getStatusLabel(s.status);
                                return (
                                    <div key={s.id} style={{ padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                            <span style={{ padding: "4px 10px", borderRadius: 6, background: status.bg, color: status.color, fontSize: 12, fontWeight: 700 }}>{status.text}</span>
                                            <span style={{ fontSize: 11, color: "#6b7280" }}>{new Date(s.created_at).toLocaleString("ja-JP")}</span>
                                        </div>

                                        {s.problem_description && (
                                            <div style={{ marginBottom: 8 }}>
                                                <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 700, letterSpacing: 1, marginBottom: 2 }}>① 課題</div>
                                                <div style={{ fontSize: 13, color: "#d1d5db", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{s.problem_description}</div>
                                            </div>
                                        )}

                                        <div style={{ marginBottom: 8 }}>
                                            <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 700, letterSpacing: 1, marginBottom: 2 }}>② 解決案</div>
                                            <div style={{ fontSize: 13, color: "#d1d5db", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{s.solution}</div>
                                        </div>

                                        {s.result && (
                                            <div style={{ marginBottom: 8 }}>
                                                <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 700, letterSpacing: 1, marginBottom: 2 }}>③ 結果</div>
                                                <div style={{ fontSize: 13, color: "#d1d5db", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{s.result}</div>
                                            </div>
                                        )}

                                        {s.admin_comment && (
                                            <div style={{ marginTop: 10, padding: 10, borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                                <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700, marginBottom: 2 }}>💬 管理者コメント</div>
                                                <div style={{ fontSize: 12, color: "#d1d5db", whiteSpace: "pre-wrap" }}>{s.admin_comment}</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div style={{ marginTop: 40, textAlign: "center" }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>メニューへ戻る</button>
                </div>
            </div>
        </main>
    );
}
