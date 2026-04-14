"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [sent, setSent] = useState(false);

    const handleReset = async () => {
        if (!email.trim()) { setMessage("メールアドレスを入力してください"); return; }
        setLoading(true);
        setMessage("");

        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: "https://intern-quest-app-8yt4.vercel.app/update-password",
        });

        if (error) {
            setMessage("送信に失敗しました: " + error.message);
        } else {
            setSent(true);
            setMessage("✅ パスワードリセットメールを送信しました！");
        }
        setLoading(false);
    };

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", padding: 24 }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.12) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420 }}>
                <div style={{ textAlign: "center", marginBottom: 40 }}>
                    <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", marginBottom: 8 }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 28, fontWeight: 900, color: "#f9fafb", margin: 0 }}>パスワードリセット</h1>
                    <p style={{ color: "#6b7280", fontSize: 14, margin: "8px 0 0" }}>登録済みのメールアドレスを入力してください</p>
                </div>

                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 32, backdropFilter: "blur(10px)" }}>
                    {!sent ? (
                        <>
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>EMAIL</div>
                                <input
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    type="email"
                                    onKeyDown={(e) => e.key === "Enter" && handleReset()}
                                    style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                                />
                            </div>
                            <button
                                onClick={handleReset}
                                disabled={loading}
                                style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: loading ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 16 }}
                            >
                                {loading ? "送信中..." : "リセットメールを送る"}
                            </button>
                        </>
                    ) : (
                        <div style={{ textAlign: "center", padding: "20px 0" }}>
                            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#34d399", marginBottom: 8 }}>メールを送信しました！</div>
                            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.8 }}>
                                {email} に<br />パスワードリセットのリンクを送りました。<br />メールを確認してください。
                            </div>
                        </div>
                    )}

                    {message && !sent && (
                        <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", fontSize: 14, fontWeight: 600 }}>
                            {message}
                        </div>
                    )}

                    <div style={{ marginTop: 20, textAlign: "center" }}>
                        <button onClick={() => router.push("/login")} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 13, cursor: "pointer" }}>
                            ← ログインに戻る
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}