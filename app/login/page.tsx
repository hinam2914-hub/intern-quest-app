"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/app/lib/supabase";

export default function LoginPage() {
    const router = useRouter();
    const [message, setMessage] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setMessage("ログインに失敗しました");
            setLoading(false);
            return;
        }
        router.push("/mypage");
    };

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 400, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 32 }}>
                <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, marginBottom: 8 }}>INTERN QUEST</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "0 0 24px" }}>ログイン</h1>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="メールアドレス" type="email" style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
                <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワード" type="password" style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 20 }} />
                <button onClick={handleLogin} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 16 }}>
                    {loading ? "ログイン中..." : "ログイン →"}
                </button>
                {message && <p style={{ marginTop: 16, color: "#f87171", fontSize: 14 }}>{message}</p>}
            </div>
        </main>
    );
}