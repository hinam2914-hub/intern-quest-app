"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function UpdatePasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [done, setDone] = useState(false);

    const handleUpdate = async () => {
        if (!password.trim()) { setMessage("パスワードを入力してください"); return; }
        if (password !== confirm) { setMessage("パスワードが一致しません"); return; }
        if (password.length < 6) { setMessage("パスワードは6文字以上にしてください"); return; }

        setLoading(true);
        setMessage("");

        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            setMessage("更新に失敗しました: " + error.message);
        } else {
            setDone(true);
            setTimeout(() => router.push("/login"), 2000);
        }
        setLoading(false);
    };

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", padding: 24 }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.12) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420 }}>
                <div style={{ textAlign: "center", marginBottom: 40 }}>
                    <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", marginBottom: 8 }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 28, fontWeight: 900, color: "#f9fafb", margin: 0 }}>新しいパスワード</h1>
                    <p style={{ color: "#6b7280", fontSize: 14, margin: "8px 0 0" }}>新しいパスワードを設定してください</p>
                </div>

                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 32, backdropFilter: "blur(10px)" }}>
                    {done ? (
                        <div style={{ textAlign: "center", padding: "20px 0" }}>
                            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#34d399", marginBottom: 8 }}>パスワードを更新しました！</div>
                            <div style={{ fontSize: 13, color: "#6b7280" }}>ログインページに移動します...</div>
                        </div>
                    ) : (
                        <>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>新しいパスワード</div>
                                <input
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="6文字以上"
                                    type="password"
                                    style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                                />
                            </div>
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>パスワード確認</div>
                                <input
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    placeholder="もう一度入力"
                                    type="password"
                                    onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                                    style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                                />
                            </div>
                            <button
                                onClick={handleUpdate}
                                disabled={loading}
                                style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: loading ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 16 }}
                            >
                                {loading ? "更新中..." : "パスワードを更新する"}
                            </button>

                            {message && (
                                <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", fontSize: 14, fontWeight: 600 }}>
                                    {message}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}