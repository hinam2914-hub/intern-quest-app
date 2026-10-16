"use client";
// Intern Quest 2.0｜タイトル / ログイン画面
// 認証処理・遷移先の判定（is_active / name / onboarding_done）は従来の /login と同じ。
// 変わったのは見た目だけ：青空と浮島のシーン（TitleScene）＋羊皮紙のカード。
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import TitleScene from "./TitleScene";

/** ログイン後の行き先。従来の判定ロジックをそのまま関数化したもの。 */
async function resolveDestination(userId: string): Promise<{ to: string } | { blocked: true }> {
    const { data: profile } = await supabase
        .from("profiles")
        .select("name, onboarding_done, is_active")
        .eq("id", userId)
        .single();
    if (profile && (profile as any).is_active === false) return { blocked: true };
    const to = (!profile?.name || profile.name.trim() === "") ? "/register" : ((profile as any)?.onboarding_done ? "/home" : "/onboarding");
    return { to };
}

const CSS = `
.iq-page{box-sizing:border-box;position:relative;z-index:1;min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 16px 32px;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416}
.iq-wrap{width:100%;max-width:1040px;display:grid;grid-template-columns:1.1fr .9fr;gap:36px;align-items:center}
.iq-hero{text-align:center;display:flex;flex-direction:column;align-items:center}
.iq-brand{margin:0;line-height:1;letter-spacing:.02em;font-weight:900;font-size:62px;color:#fff;
  text-shadow:0 2px 0 #c9922b,0 4px 0 #a9761c,0 10px 24px rgba(20,60,120,.35);-webkit-text-stroke:1.5px rgba(120,80,10,.25)}
.iq-brand small{display:inline-block;vertical-align:top;margin:6px 0 0 8px;font-size:20px;font-weight:900;color:#1d3f8c;background:linear-gradient(180deg,#ffe99a,#f3c84c);border:2px solid #fff;border-radius:999px;padding:4px 12px;text-shadow:none;-webkit-text-stroke:0;box-shadow:0 4px 10px rgba(60,40,0,.25)}
.iq-copy{margin:16px 0 0;font-size:18px;font-weight:800;color:#163a7a;background:rgba(255,255,255,.72);border:1.5px solid rgba(255,255,255,.9);border-radius:999px;padding:8px 20px;box-shadow:0 6px 18px rgba(40,80,140,.15);backdrop-filter:blur(4px)}
.iq-castle{width:min(420px,78vw);height:auto;margin-top:22px;filter:drop-shadow(0 26px 22px rgba(20,50,110,.35));animation:iqFloat 6s ease-in-out infinite}
.iq-card{box-sizing:border-box;position:relative;background:linear-gradient(180deg,#fff9ea,#f6e9c9);border:3px solid #d8b56a;border-radius:26px;padding:26px 26px 20px;
  box-shadow:0 24px 50px rgba(30,60,120,.28),inset 0 2px 0 rgba(255,255,255,.9),inset 0 0 0 6px rgba(255,255,255,.35)}
.iq-card::before{content:"";position:absolute;left:18px;right:18px;top:-3px;height:10px;border-radius:0 0 10px 10px;background:linear-gradient(180deg,#2d5fc4,#1f49a0);box-shadow:0 3px 6px rgba(0,0,0,.2)}
.iq-card h2{margin:6px 0 18px;font-size:17px;font-weight:900;color:#1d3f8c;text-align:center;letter-spacing:.04em}
.iq-label{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:#6b4f1d;margin-bottom:6px}
.iq-input{box-sizing:border-box;width:100%;padding:13px 44px 13px 14px;border-radius:14px;border:2px solid #d9c59a;background:#fffdf7;color:#2b2416;font-size:16px;outline:none;font-family:inherit;transition:border-color .15s,box-shadow .15s}
.iq-input:focus{border-color:#3b6fd6;box-shadow:0 0 0 4px rgba(59,111,214,.18)}
.iq-eye{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:17px;opacity:.65;padding:4px}
.iq-btn{box-sizing:border-box;width:100%;padding:15px 0;border-radius:16px;border:2px solid #fff;cursor:pointer;font-size:17px;font-weight:900;letter-spacing:.06em;color:#fff;font-family:inherit;
  background:linear-gradient(180deg,#4f8cf5,#2458c7);box-shadow:0 6px 0 #173f93,0 14px 26px rgba(36,88,199,.35);transition:transform .08s,box-shadow .08s;display:flex;align-items:center;justify-content:center;gap:8px}
.iq-btn:hover{filter:brightness(1.05)}
.iq-btn:active{transform:translateY(4px);box-shadow:0 2px 0 #173f93,0 6px 12px rgba(36,88,199,.3)}
.iq-btn:disabled{opacity:.75;cursor:default;transform:none}
.iq-btn.gold{background:linear-gradient(180deg,#ffd45c,#e9a72a);color:#4a2f05;border-color:#fff3c4;box-shadow:0 6px 0 #b67a12,0 14px 26px rgba(200,140,20,.35)}
.iq-btn.gold:active{box-shadow:0 2px 0 #b67a12,0 6px 12px rgba(200,140,20,.3)}
.iq-link{background:none;border:none;color:#1f49a0;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;padding:6px 4px;text-decoration:underline;text-decoration-color:rgba(31,73,160,.35);text-underline-offset:3px}
.iq-link:hover{text-decoration-color:#1f49a0}
.iq-msg{margin-top:12px;font-size:13.5px;text-align:center;font-weight:800;border-radius:10px;padding:8px 10px}
.iq-msg.ok{color:#14532d;background:#dcfce7}.iq-msg.ng{color:#991b1b;background:#fee2e2}
.iq-sep{height:2px;background:linear-gradient(90deg,transparent,#d8b56a,transparent);margin:16px 0 10px}
.iq-foot{margin-top:18px;font-size:11px;letter-spacing:.3em;color:#fff;text-shadow:0 1px 4px rgba(20,60,120,.6);font-weight:800;text-align:center}
.iq-welcome{text-align:center}
.iq-welcome .name{font-size:22px;font-weight:900;color:#1d3f8c;margin:4px 0 14px}
@media (max-width:860px){
  .iq-page{justify-content:flex-start;padding:18px 14px 20px}
  .iq-wrap{grid-template-columns:1fr;gap:12px;max-width:420px}
  .iq-brand{font-size:34px;white-space:nowrap}
  .iq-brand small{font-size:13px;padding:2px 8px;margin:1px 0 0 6px}
  .iq-copy{font-size:13.5px;padding:6px 14px;margin-top:10px}
  .iq-castle{width:min(176px,46vw);margin-top:8px}
  .iq-card{padding:16px 16px 12px;border-radius:20px}
  .iq-card h2{font-size:15px;margin:4px 0 12px}
  .iq-input{padding:11px 40px 11px 12px}
  .iq-btn{padding:13px 0;font-size:16px}
  .iq-sep{margin:12px 0 6px}
  .iq-foot{margin-top:12px}
}
@media (prefers-reduced-motion:reduce){.iq-castle{animation:none}.iq-btn{transition:none}}
`;

export default function LoginPage() {
    const router = useRouter();
    const [message, setMessage] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPw, setShowPw] = useState(false);
    // ログイン済みでこの画面を開いたとき：名前つきの「つづける」を出す
    const [session, setSession] = useState<{ userId: string; name: string } | null | undefined>(undefined);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const { data: { session: s } } = await supabase.auth.getSession();
                if (!s?.user) { if (alive) setSession(null); return; }
                const { data: p } = await supabase.from("profiles").select("name").eq("id", s.user.id).single();
                if (alive) setSession({ userId: s.user.id, name: (p?.name || "").trim() });
            } catch { if (alive) setSession(null); }
        })();
        return () => { alive = false; };
    }, []);

    const go = async (userId: string) => {
        const r = await resolveDestination(userId);
        if ("blocked" in r) {
            await supabase.auth.signOut();
            setSession(null);
            setMessage("このアカウントは現在ご利用いただけません。運営にお問い合わせください。");
            return false;
        }
        return r.to;
    };

    const handleLogin = async () => {
        if (loading) return;
        setLoading(true);
        setMessage("");
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setMessage("ログインに失敗しました");
            setLoading(false);
            return;
        }
        setMessage("✅ ログイン成功！");
        const to = await go(data.user.id);
        if (to) setTimeout(() => router.push(to), 1200);
        setLoading(false);
    };

    const handleContinue = async () => {
        if (!session || loading) return;
        setLoading(true);
        const to = await go(session.userId);
        if (to) router.push(to);
        setLoading(false);
    };

    const handleSwitch = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setMessage("");
    };

    return (
        <>
            <TitleScene />
            <style>{CSS}</style>
            <main className="iq-page">
                <div className="iq-wrap">
                    {/* 左：タイトル */}
                    <section className="iq-hero">
                        <h1 className="iq-brand">Intern Quest<small>2.0</small></h1>
                        <p className="iq-copy">現実の成長が、冒険の力になる。</p>
                        <img className="iq-castle" src="/login/castle.webp" alt="" decoding="async" fetchPriority="high" />
                    </section>

                    {/* 右：羊皮紙のカード */}
                    <section className="iq-card" aria-live="polite">
                        {session === undefined ? (
                            <div style={{ textAlign: "center", padding: "28px 0", color: "#8a6d2f", fontWeight: 800 }}>冒険者証を確認中…</div>
                        ) : session ? (
                            <div className="iq-welcome">
                                <h2>おかえりなさい</h2>
                                <div className="name">{session.name ? `${session.name} さん` : "冒険者さん"}</div>
                                <button className="iq-btn gold" onClick={handleContinue} disabled={loading}>{loading ? "準備中…" : "冒険をつづける"} <span>→</span></button>
                                {message && <div className="iq-msg ng">{message}</div>}
                                <div className="iq-sep" />
                                <button className="iq-link" onClick={handleSwitch}>別のアカウントでログイン</button>
                            </div>
                        ) : (
                            <>
                                <h2>今日も冒険を始めよう</h2>
                                <div style={{ marginBottom: 14 }}>
                                    <div className="iq-label">✉️ メールアドレス</div>
                                    <input className="iq-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="メールアドレスを入力" type="email" autoComplete="email" inputMode="email" onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
                                </div>
                                <div style={{ marginBottom: 18 }}>
                                    <div className="iq-label">🔒 パスワード</div>
                                    <div style={{ position: "relative" }}>
                                        <input className="iq-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワードを入力" type={showPw ? "text" : "password"} autoComplete="current-password" onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
                                        <button className="iq-eye" type="button" aria-label={showPw ? "パスワードを隠す" : "パスワードを表示"} onClick={() => setShowPw(!showPw)}>{showPw ? "🙈" : "👁"}</button>
                                    </div>
                                </div>
                                <button className="iq-btn" onClick={handleLogin} disabled={loading}>{loading ? "接続中…" : "はじめる"} <span>→</span></button>
                                {message && <div className={"iq-msg " + (message.startsWith("✅") ? "ok" : "ng")}>{message}</div>}
                                <div className="iq-sep" />
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                    <button className="iq-link" onClick={() => router.push("/register")}>👤 新規登録はこちら</button>
                                    <button className="iq-link" onClick={() => router.push("/reset-password")}>🔑 パスワードを忘れた方</button>
                                </div>
                            </>
                        )}
                    </section>
                </div>
                <div className="iq-foot">INTERN QUEST 2.0</div>
            </main>
        </>
    );
}
