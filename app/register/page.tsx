"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function RegisterPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [mbti, setMbti] = useState("");
    const [club, setClub] = useState("");
    const [hobby, setHobby] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [success, setSuccess] = useState(false);

    const handleRegister = async () => {
        if (!name.trim()) { setMessage("名前を入力してください"); return; }
        if (!email.trim()) { setMessage("メールアドレスを入力してください"); return; }
        if (password.length < 6) { setMessage("パスワードは6文字以上にしてください"); return; }
        if (password !== confirm) { setMessage("パスワードが一致しません"); return; }

        setLoading(true);
        setMessage("");

        // 1. auth.usersに登録
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
            if (error.message.includes("already registered") || error.message.includes("already exists")) {
                setMessage("このメールアドレスはすでに登録されています。ログインページからログインしてください。");
            } else {
                setMessage("登録に失敗しました：" + error.message);
            }
            setLoading(false);
            return;
        }

        const user = data.user;
        if (!user) {
            setMessage("ユーザー作成に失敗しました");
            setLoading(false);
            return;
        }

        // 2. profilesに名前を保存
        const { error: profileError } = await supabase.from("profiles").insert({
            id: user.id,
            name: name.trim(),
            role: "Member",
            mbti: mbti || null,
            club_category: club || null,
            hobby_category: hobby || null,
        });

        if (profileError) {
            // すでにprofileがある場合はupdateで対応
            await supabase.from("profiles").update({ name: name.trim() }).eq("id", user.id);
        }

        // 3. user_pointsに初期ポイントを作成
        await supabase.from("user_points").insert({ id: user.id, points: 0 });

        setSuccess(true);
        setMessage("登録完了！ログインページに移動します...");
        setTimeout(() => router.push("/onboarding"), 2000);
        setLoading(false);
    };

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", padding: 24 }}>

            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.12) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 440 }}>

                {/* ロゴ */}
                <div style={{ textAlign: "center", marginBottom: 40 }}>
                    <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", marginBottom: 8 }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 32, fontWeight: 900, color: "#f9fafb", margin: 0 }}>アカウント登録</h1>
                    <p style={{ color: "#6b7280", fontSize: 14, margin: "8px 0 0" }}>情報を入力して登録してください</p>
                </div>

                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 32, backdropFilter: "blur(10px)" }}>

                    {/* 名前 */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>NAME</div>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="例：田中太郎"
                            style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                        />
                    </div>

                    {/* メール */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>EMAIL</div>
                        <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            type="email"
                            style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                        />
                    </div>

                    {/* パスワード */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>PASSWORD</div>
                        <input
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="6文字以上"
                            type="password"
                            style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                        />
                    </div>

                    {/* パスワード確認 */}
                    <div style={{ marginBottom: 28 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>CONFIRM PASSWORD</div>
                        <input
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            placeholder="もう一度入力"
                            type="password"
                            onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                            style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                        />
                    </div>

                    {/* MBTI */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>MBTI（任意）</div>
                        <select value={mbti} onChange={(e) => setMbti(e.target.value)} style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}>
                            <option value="">選択してください</option>
                            <option value="INTJ">INTJ（建築家）</option>
                            <option value="INTP">INTP（論理学者）</option>
                            <option value="ENTJ">ENTJ（指揮官）</option>
                            <option value="ENTP">ENTP（討論者）</option>
                            <option value="INFJ">INFJ（提唱者）</option>
                            <option value="INFP">INFP（仲介者）</option>
                            <option value="ENFJ">ENFJ（主人公）</option>
                            <option value="ENFP">ENFP（運動家）</option>
                            <option value="ISTJ">ISTJ（管理者）</option>
                            <option value="ISFJ">ISFJ（擁護者）</option>
                            <option value="ESTJ">ESTJ（幹部）</option>
                            <option value="ESFJ">ESFJ（領事官）</option>
                            <option value="ISTP">ISTP（巨匠）</option>
                            <option value="ISFP">ISFP（冒険家）</option>
                            <option value="ESTP">ESTP（起業家）</option>
                            <option value="ESFP">ESFP（エンターテイナー）</option>
                        </select>
                    </div>

                    {/* 部活 */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>高校の部活（任意）</div>
                        <select value={club} onChange={(e) => setClub(e.target.value)} style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}>
                            <option value="">選択してください</option>
                            <option value="野球部">⚾ 野球部</option>
                            <option value="体育会系（全国レベル）">体育会系（全国レベル）</option>
                            <option value="体育会系（一般）">体育会系（一般）</option>
                            <option value="チームスポーツ系">チームスポーツ系（サッカー・バスケ等）</option>
                            <option value="個人競技系">個人競技系（テニス・陸上・水泳等）</option>
                            <option value="文化部（発表系）">文化部（吹奏楽・演劇等）</option>
                            <option value="文化部（創作系）">文化部（美術・文芸等）</option>
                            <option value="帰宅部">帰宅部</option>
                        </select>
                    </div>

                    {/* 趣味 */}
                    <div style={{ marginBottom: 28 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>趣味（任意）</div>
                        <select value={hobby} onChange={(e) => setHobby(e.target.value)} style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}>
                            <option value="">選択してください</option>
                            <option value="読書・勉強">📚 読書・勉強</option>
                            <option value="ゲーム（戦略）">🎮 ゲーム（戦略・RPG）</option>
                            <option value="ゲーム（アクション）">🎮 ゲーム（アクション・FPS）</option>
                            <option value="スポーツ・運動">🏃 スポーツ・運動</option>
                            <option value="音楽・楽器">🎸 音楽・楽器</option>
                            <option value="アート・創作">🎨 アート・創作</option>
                            <option value="旅行">✈️ 旅行</option>
                            <option value="グルメ・食べ歩き">🍜 グルメ・食べ歩き</option>
                            <option value="映画・ドラマ鑑賞">🎬 映画・ドラマ鑑賞</option>
                            <option value="アウトドア">⛺ アウトドア</option>
                            <option value="SNS・配信">📱 SNS・配信</option>
                        </select>
                    </div>

                    <button
                        onClick={handleRegister}
                        disabled={loading}
                        style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: loading ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 16 }}
                    >
                        {loading ? "登録中..." : "登録する →"}
                    </button>

                    {message && (
                        <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: success ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${success ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`, color: success ? "#34d399" : "#f87171", fontSize: 14, fontWeight: 600 }}>
                            {message}
                        </div>
                    )}

                    <div style={{ marginTop: 20, textAlign: "center" }}>
                        <span style={{ fontSize: 13, color: "#6b7280" }}>すでにアカウントをお持ちの方は </span>
                        <button onClick={() => router.push("/login")} style={{ background: "none", border: "none", color: "#818cf8", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>ログイン</button>
                    </div>
                </div>

                <p style={{ textAlign: "center", color: "#4b5563", fontSize: 12, marginTop: 24 }}>
                    Intern Quest — 成長が可視化されるゲームOS
                </p>
            </div>
        </main>
    );
}