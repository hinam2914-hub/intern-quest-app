"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type ProblemCase = { id: string; title: string; description: string | null; is_active: boolean; created_at: string; };
type Solution = { id: string; problem_case_id: string; solution: string; status: string; admin_comment: string | null; created_at: string; reviewed_at: string | null; };

export default function KkcPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState("");
    const [cases, setCases] = useState<ProblemCase[]>([]);
    const [mySolutions, setMySolutions] = useState<Solution[]>([]);
    const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
    const [solutionText, setSolutionText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);

            const { data: caseRows } = await supabase.from("problem_cases").select("*").eq("is_active", true).order("created_at", { ascending: false });
            setCases((caseRows || []) as ProblemCase[]);

            const { data: solRows } = await supabase.from("problem_solutions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
            setMySolutions((solRows || []) as Solution[]);

            setLoading(false);
        };
        load();
    }, [router]);

    const handleSubmit = async (caseId: string) => {
        if (!solutionText.trim()) { setMessage("解決案を入力してください"); return; }
        setSubmitting(true);
        await supabase.from("problem_solutions").insert({
            user_id: userId,
            problem_case_id: caseId,
            solution: solutionText.trim(),
            status: "pending",
        });
        setMessage("✅ 提出しました");
        setSolutionText("");
        setSelectedCaseId(null);

        const { data: solRows } = await supabase.from("problem_solutions").select("*").eq("user_id", userId).order("created_at", { ascending: false });
        setMySolutions((solRows || []) as Solution[]);
        setSubmitting(false);
        setTimeout(() => setMessage(""), 3000);
    };

    const getStatusLabel = (status: string) => {
        if (status === "approved") return { text: "承認", color: "#10b981", bg: "rgba(16,185,129,0.15)" };
        if (status === "rejected") return { text: "却下", color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
        return { text: "審査中", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" };
    };

    if (loading) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
        </main>
    );

    const approvedCount = mySolutions.filter(s => s.status === "approved").length;

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 800, margin: "0 auto" }}>
                <div onClick={() => router.push("/menu")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", marginBottom: 8 }}>INTERN QUEST</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                    <div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "0 0 4px" }}>💡 KKC 課題解決案box</h1>
                        <p style={{ color: "#9ca3af", fontSize: 14, margin: 0 }}>施策コンテスト：課題に対して解決案を申請しよう</p>
                    </div>
                    <div style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
                        <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700 }}>承認済み</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b" }}>{approvedCount} 件</div>
                    </div>
                </div>

                {message && <div style={{ padding: 12, borderRadius: 8, background: message.includes("✅") ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: message.includes("✅") ? "#10b981" : "#ef4444", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{message}</div>}

                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>📋 現在の課題</div>
                    {cases.length === 0 ? (
                        <div style={{ padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center", color: "#6b7280", fontSize: 14 }}>現在、出題中の課題はありません</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {cases.map(c => {
                                const mySubmission = mySolutions.find(s => s.problem_case_id === c.id);
                                const isSelected = selectedCaseId === c.id;
                                return (
                                    <div key={c.id} style={{ padding: "20px 24px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb", marginBottom: 8 }}>{c.title}</div>
                                        {c.description && <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.7, marginBottom: 12, whiteSpace: "pre-wrap" }}>{c.description}</div>}
                                        {mySubmission ? (
                                            <div style={{ padding: 12, borderRadius: 8, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                                    <span style={{ padding: "2px 8px", borderRadius: 4, background: getStatusLabel(mySubmission.status).bg, color: getStatusLabel(mySubmission.status).color, fontSize: 11, fontWeight: 700 }}>{getStatusLabel(mySubmission.status).text}</span>
                                                    <span style={{ fontSize: 11, color: "#6b7280" }}>申請済み</span>
                                                </div>
                                                <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{mySubmission.solution}</div>
                                                {mySubmission.admin_comment && <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: "rgba(255,255,255,0.03)", fontSize: 12, color: "#9ca3af" }}>💬 {mySubmission.admin_comment}</div>}
                                            </div>
                                        ) : isSelected ? (
                                            <div>
                                                <textarea value={solutionText} onChange={(e) => setSolutionText(e.target.value)} placeholder="あなたの解決案を入力..." style={{ width: "100%", minHeight: 100, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 10 }} />
                                                <div style={{ display: "flex", gap: 8 }}>
                                                    <button onClick={() => handleSubmit(c.id)} disabled={submitting} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: submitting ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer" }}>{submitting ? "提出中..." : "📤 提出する"}</button>
                                                    <button onClick={() => { setSelectedCaseId(null); setSolutionText(""); }} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>キャンセル</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button onClick={() => { setSelectedCaseId(c.id); setSolutionText(""); }} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>💡 解決案を提出</button>
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
