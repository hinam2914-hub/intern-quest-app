"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/app/lib/supabase";

function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function isSameJSTDay(value: string, targetYmd: string): boolean {
    const date = new Date(value);
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}` === targetYmd;
}

export default function LoginPage() {
    const router = useRouter();
    const [message, setMessage] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [bonus, setBonus] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        setMessage("");

        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setMessage("ログインに失敗しました");
            setLoading(false);
            return;
        }

        const user = data.user;
        const todayYmd = getTodayJST();
        const nowIso = new Date().toISOString();

        const { data: historyRows } = await supabase
            .from("points_history")
            .select("created_at, reason")
            .eq("user_id", user.id)
            .eq("reason", "login_bonus");

        const alreadyReceived = historyRows?.some(
            (row) => isSameJSTDay(row.created_at, todayYmd)
        ) || false;

        if (!alreadyReceived) {
            const { data: pointRow } = await supabase
                .from("user_points").select("points").eq("id", user.id).single();
            const current = pointRow?.points || 0;

            await supabase.from("user_points")
                .update({ points: current + 1 })
                .eq("id", user.id);

            await supabase.from("points_history").insert({
                user_id: user.id,
                change: 1,
                reason: "login_bonus",
                created_at: nowIso,
            });

            setBonus(true);
            setMessage("🎁 ログインボーナス +1pt 獲得！");
        } else {
            setMessage("✅ ログイン成功！");
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", user.id)
            .single();

        const destination = (!profile?.name || profile.name.trim() === "") ? "/register" : ((profile as any)?.onboarding_done ? "/mypage" : "/onboarding");

        setTimeout(() => router.push(destination), 1200);
        setLoading(false);
    };

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", padding: 24 }}>

            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.12) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420 }}>

                <div style={{ textAlign: "center", marginBottom: 40 }}>
                    <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", marginBottom: 8 }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 32, fontWeight: 900, color: "#f9fafb", margin: 0 }}>Welcome Back</h1>
                    <p style={{ color: "#6b7280", fontSize: 14, margin: "8px 0 0" }}>アカウントにログインしてください</p>
                </div>

                <div style={{ marginBottom: 20, padding: "12px 16px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>🎁</span>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8" }}>毎日ログインボーナス</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>ログインするだけで +1pt 獲得！</div>
                    </div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 32, backdropFilter: "blur(10px)" }}>

                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>EMAIL</div>
                        <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            type="email"
                            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                            style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                        />
                    </div>

                    <div style={{ marginBottom: 28 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>PASSWORD</div>
                        <input
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            type="password"
                            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                            style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                        />
                    </div>

                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: loading ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 16 }}
                    >
                        {loading ? "ログイン中..." : "ログイン →"}
                    </button>

                    <div style={{ marginTop: 20, textAlign: "center" }}>
                        <span style={{ fontSize: 13, color: "#6b7280" }}>アカウントをお持ちでない方は </span>
                        <button onClick={() => router.push("/register")} style={{ background: "none", border: "none", color: "#818cf8", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>新規登録</button>
                    </div>
                    <div style={{ marginTop: 8, textAlign: "center" }}>
                        <button
                            onClick={() => router.push("/reset-password")}
                            style={{ background: "none", border: "none", color: "#818cf8", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}
                        >
                            パスワードをお忘れの方はこちら
                        </button>
                    </div>

                    {message && (
                        <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: bonus ? "rgba(99,102,241,0.15)" : message.includes("✅") ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${bonus ? "rgba(99,102,241,0.3)" : message.includes("✅") ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`, color: bonus ? "#a5b4fc" : message.includes("✅") ? "#34d399" : "#f87171", fontSize: 14, fontWeight: 600 }}>
                            {message}
                        </div>
                    )}
                </div>

                <p style={{ textAlign: "center", color: "#4b5563", fontSize: 12, marginTop: 24 }}>
                    Intern Quest — 成長が可視化されるゲームOS
                </p>
            </div>
        </main >
    );
}