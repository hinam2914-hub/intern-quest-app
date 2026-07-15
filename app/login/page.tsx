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
    const [showPw, setShowPw] = useState(false);
    const handleLogin = async () => {
        setLoading(true);
        setMessage("");
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setMessage("ログインに失敗しました");
            setLoading(false);
            return;
        }
        setMessage("✅ ログイン成功！");
        const user = data.user;
        const { data: profile } = await supabase
            .from("profiles")
            .select("name, onboarding_done, is_active")
            .eq("id", user.id)
            .single();
        if (profile && (profile as any).is_active === false) {
            await supabase.auth.signOut();
            setMessage("このアカウントは現在ご利用いただけません。運営にお問い合わせください。");
            setLoading(false);
            return;
        }
        const destination = (!profile?.name || profile.name.trim() === "") ? "/register" : ((profile as any)?.onboarding_done ? "/home" : "/onboarding");
        setTimeout(() => router.push(destination), 1200);
        setLoading(false);
    };

    const inputStyle: React.CSSProperties = {
        width: "100%", padding: "13px 44px 13px 16px", borderRadius: 12,
        border: "1px solid rgba(167,139,250,0.35)", background: "rgba(30,20,55,0.55)",
        color: "#f3f0ff", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
    };
    const labelStyle: React.CSSProperties = {
        fontSize: 12, color: "#c4b5fd", fontWeight: 700, marginBottom: 7, display: "flex", alignItems: "center", gap: 6,
    };

    return (
        <div style={{
            minHeight: "100vh", width: "100%",
            background: "linear-gradient(180deg, rgba(20,12,40,0.55), rgba(15,8,32,0.75)), url(/island/login_bg.png) center / cover no-repeat fixed",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px",
            fontFamily: "system-ui, sans-serif",
        }}>
            <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
                {/* ロゴ */}
                <div style={{ fontSize: 44, marginBottom: 4, filter: "drop-shadow(0 0 16px rgba(167,139,250,0.8))" }}>✦</div>
                <h1 style={{ fontSize: 34, fontWeight: 900, letterSpacing: 6, margin: 0, color: "#f3f0ff", textShadow: "0 0 24px rgba(167,139,250,0.6)" }}>INTERN QUEST</h1>
                <p style={{ fontSize: 13.5, color: "#c4b5fd", margin: "10px 0 0", fontWeight: 600, letterSpacing: 1 }}>✧ 成長が見える、挑戦が楽しくなる。 ✧</p>

                <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.4), transparent)", margin: "24px 0 20px" }} />
                <p style={{ fontSize: 14, color: "#e0d7ff", margin: "0 0 22px", fontWeight: 600 }}>今日も <span style={{ color: "#a78bfa", fontWeight: 900 }}>Quest</span> を始めよう。</p>

                {/* フォームパネル */}
                <div style={{
                    background: "rgba(25,16,48,0.62)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
                    border: "1px solid rgba(167,139,250,0.28)", borderRadius: 22, padding: "26px 24px 22px",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)", textAlign: "left",
                }}>
                    <div style={{ marginBottom: 18 }}>
                        <div style={labelStyle}>✉️ メールアドレス</div>
                        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="メールアドレスを入力" type="email" onKeyDown={(e) => e.key === "Enter" && handleLogin()} style={inputStyle} />
                    </div>
                    <div style={{ marginBottom: 22 }}>
                        <div style={labelStyle}>🔒 パスワード</div>
                        <div style={{ position: "relative" }}>
                            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワードを入力" type={showPw ? "text" : "password"} onKeyDown={(e) => e.key === "Enter" && handleLogin()} style={inputStyle} />
                            <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, opacity: 0.7 }}>{showPw ? "🙈" : "👁"}</button>
                        </div>
                    </div>

                    <button onClick={handleLogin} disabled={loading} style={{
                        width: "100%", padding: "14px 0", borderRadius: 14, border: "none", cursor: loading ? "default" : "pointer",
                        background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", color: "#fff", fontSize: 16, fontWeight: 900, letterSpacing: 1,
                        boxShadow: "0 8px 24px rgba(124,58,237,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        opacity: loading ? 0.7 : 1, transition: "transform 0.1s",
                    }}>
                        {loading ? "接続中..." : "Quest Start"} <span style={{ fontSize: 18 }}>→</span>
                    </button>

                    {message && <div style={{ marginTop: 14, fontSize: 13, textAlign: "center", color: message.startsWith("✅") ? "#6ee7b7" : "#fca5a5", fontWeight: 700 }}>{message}</div>}

                    <div style={{ height: 1, background: "rgba(167,139,250,0.2)", margin: "18px 0 14px" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <button onClick={() => router.push("/register")} style={{ background: "none", border: "none", color: "#c4b5fd", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>👤 新規登録はこちら</button>
                        <button onClick={() => router.push("/reset-password")} style={{ background: "none", border: "none", color: "#c4b5fd", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>🔑 パスワードを忘れた方</button>
                    </div>
                </div>

                <p style={{ fontSize: 13, color: "#a78bfa", margin: "24px 0 2px", fontWeight: 700, letterSpacing: 1 }}>✦ 成長をゲームに。 ✦</p>
                <p style={{ fontSize: 10, color: "#6b5f8a", margin: 0, letterSpacing: 2 }}>INTERN QUEST</p>
            </div>
        </div>
    );
}
