"use client";
// Intern Quest 2.0｜ログイン画面
// 添付デザイン画像（PC: bg_pc.webp / スマホ: bg_mobile.webp）をそのまま背景に使い、
// 画像内のフォーム位置に実際の入力フォーム（HTML）をぴったり重ねる。
// 認証は既存の Supabase Auth（signInWithPassword）。遷移先の判定（is_active / name / onboarding_done）も従来どおり。
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase, KEEP_LOGIN_KEY } from "@/app/lib/supabase";

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

// 画像サイズと、画像内のフォームパネルの位置（割合）。画像を差し替えたらここを直す。
const ART = {
    pc: { src: "/login/bg_pc.webp", w: 1672, h: 941, panel: { l: 0.656, t: 0.310, w: 0.299, h: 0.495 } },
    mobile: { src: "/login/bg_mobile.webp", w: 941, h: 1672, panel: { l: 0.189, t: 0.440, w: 0.620, h: 0.284 } },
};
const MOBILE_MAX = 900;

type Stage = { kind: "pc" | "mobile"; s: number; x: number; y: number; vw: number; vh: number };
function computeStage(vw: number, vh: number): Stage {
    const kind = vw < MOBILE_MAX ? "mobile" : "pc";
    const a = ART[kind];
    let s = Math.max(vw / a.w, vh / a.h);                       // cover
    // フォームパネルが画面外に出るときは縮める（横長PCで窓が狭いとき等）
    const pr = a.panel.l + a.panel.w, pb = a.panel.t + a.panel.h;
    s = Math.min(s, vw / (2 * a.w * Math.max(pr - 0.5, 0.01)), vh / (2 * a.h * Math.max(pb - 0.5, 0.01)));
    s = Math.min(s, vw / (2 * a.w * Math.max(0.5 - a.panel.l, 0.01)));
    const sw = a.w * s, sh = a.h * s;
    return { kind, s, x: (vw - sw) / 2, y: (vh - sh) / 2, vw, vh };
}

const CSS = `
.iq-root{position:fixed;inset:0;overflow:hidden;background:#7fc3ef;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416}
.iq-blur{position:absolute;inset:-40px;background-size:cover;background-position:center;filter:blur(24px);opacity:.9}
.iq-stage{position:absolute;background-size:100% 100%;background-repeat:no-repeat}
.iq-card{box-sizing:border-box;position:absolute;background:linear-gradient(180deg,#fffdf6,#f9f1dc);border:2px solid #d8b55e;border-radius:14px;padding:28px 26px 18px;
  box-shadow:0 0 0 5px rgba(255,255,255,.6),0 24px 50px rgba(30,60,120,.28);display:flex;flex-direction:column;justify-content:center;overflow:auto}
.iq-card .corner{position:absolute;width:20px;height:20px;border:3px solid #d8b55e;border-radius:2px}
.iq-card .corner.tl{left:8px;top:8px;border-right:none;border-bottom:none}.iq-card .corner.tr{right:8px;top:8px;border-left:none;border-bottom:none}
.iq-card .corner.bl{left:8px;bottom:8px;border-right:none;border-top:none}.iq-card .corner.br{right:8px;bottom:8px;border-left:none;border-top:none}
.iq-compass{position:absolute;left:50%;top:-20px;transform:translateX(-50%);width:40px;height:40px}
.iq-field{position:relative;margin-bottom:12px}
.iq-field .ic{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:20px;height:20px;opacity:.75}
.iq-input{box-sizing:border-box;width:100%;height:50px;padding:0 46px 0 44px;border-radius:10px;border:1.5px solid #cdbf9c;background:#fffffb;color:#2b2416;font-size:16px;outline:none;font-family:inherit;transition:border-color .15s,box-shadow .15s}
.iq-input::placeholder{color:#9c927c}
.iq-input:focus{border-color:#2f6fd6;box-shadow:0 0 0 4px rgba(47,111,214,.18)}
.iq-eye{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:36px;height:36px;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:.8;border-radius:8px}
.iq-eye:hover{background:rgba(0,0,0,.05)}
.iq-row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:0 0 14px;flex-wrap:nowrap}
.iq-check{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:#2b2416;cursor:pointer;user-select:none;white-space:nowrap}
.iq-check input{width:17px;height:17px;accent-color:#2458c7;margin:0;cursor:pointer}
.iq-link{background:none;border:none;color:#1f5fcc;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;padding:4px 0;text-decoration:underline;text-underline-offset:3px;white-space:nowrap}
.iq-btn{box-sizing:border-box;width:100%;height:54px;border-radius:999px;border:2px solid #e8c45a;cursor:pointer;font-size:18px;font-weight:900;letter-spacing:.08em;color:#fff;font-family:inherit;
  background:linear-gradient(180deg,#4d9af5 0%,#2f6fd6 50%,#1d4fb3 100%);box-shadow:0 0 0 2px #fff6d0,0 8px 18px rgba(36,88,199,.4),inset 0 2px 0 rgba(255,255,255,.45);
  display:flex;align-items:center;justify-content:center;position:relative;transition:transform .08s,filter .12s}
.iq-btn .arrow{position:absolute;right:20px;top:50%;transform:translateY(-50%);font-size:21px;line-height:1}
.iq-btn:hover{filter:brightness(1.06)}
.iq-btn:active{transform:translateY(2px)}
.iq-btn:disabled{opacity:.7;cursor:default;transform:none}
.iq-btn.gold{background:linear-gradient(180deg,#ffd45c,#e9a72a);color:#4a2f05;border-color:#fff3c4}
.iq-msg{margin-top:10px;font-size:13px;text-align:center;font-weight:800;border-radius:10px;padding:8px 10px}
.iq-msg.ok{color:#14532d;background:#dcfce7}.iq-msg.ng{color:#991b1b;background:#fee2e2}
.iq-sep{display:flex;align-items:center;gap:10px;margin:14px 0 4px;color:#8a7a56;font-size:11px;font-weight:800}
.iq-sep::before,.iq-sep::after{content:"";flex:1;height:1px;background:#d9c9a0}
.iq-welcome{text-align:center}
.iq-welcome h2{margin:0 0 4px;font-size:16px;font-weight:900;color:#1d3f8c}
.iq-welcome .name{font-size:22px;font-weight:900;color:#17397d;margin:0 0 16px}
.iq-card.m{padding:20px 16px 14px;border-radius:12px}
.iq-card.m .iq-input{height:48px}.iq-card.m .iq-btn{height:52px}
.iq-card.m .iq-check,.iq-card.m .iq-link{font-size:12px}
@media (prefers-reduced-motion:reduce){.iq-btn{transition:none}}
`;

const Compass = () => (
    <svg className="iq-compass" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="17" fill="#fffdf5" stroke="#d8b55e" strokeWidth="2" />
        <path d="M20 5 L23 17 L35 20 L23 23 L20 35 L17 23 L5 20 L17 17 Z" fill="#e2b84f" stroke="#9a7420" strokeWidth="1" />
        <circle cx="20" cy="20" r="3" fill="#2f6fd6" />
    </svg>
);
const MailIcon = () => (<svg className="ic" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>);
const LockIcon = () => (<svg className="ic" viewBox="0 0 24 24" fill="#333"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#333" strokeWidth="2" /></svg>);
const EyeIcon = ({ off }: { off: boolean }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" fill="#333" stroke="none" />
        {off && <path d="M4 4l16 16" />}
    </svg>
);

export default function LoginPage() {
    const router = useRouter();
    const [message, setMessage] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const [keep, setKeep] = useState(true);
    const [stage, setStage] = useState<Stage | null>(null);
    const lastRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
    // ログイン済みでこの画面を開いたとき：名前つきの「つづける」を出す（既存のリダイレクト判定を維持）
    const [session, setSession] = useState<{ userId: string; name: string } | null | undefined>(undefined);

    // 画面サイズに合わせて画像の配置を計算（スマホのキーボード表示による高さ減少は無視する）
    useEffect(() => {
        const update = () => {
            const w = window.innerWidth; let h = window.innerHeight;
            const last = lastRef.current;
            if (last.w === w && h < last.h && h > last.h * 0.5) h = last.h;
            lastRef.current = { w, h };
            setStage(computeStage(w, h));
        };
        update();
        window.addEventListener("resize", update);
        window.addEventListener("orientationchange", update);
        return () => { window.removeEventListener("resize", update); window.removeEventListener("orientationchange", update); };
    }, []);

    useEffect(() => {
        try { setKeep(localStorage.getItem(KEEP_LOGIN_KEY) !== "0"); } catch { }
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
        if (!email.trim() || !password) { setMessage("メールアドレスとパスワードを入力してください"); return; }
        setLoading(true);
        setMessage("");
        try { localStorage.setItem(KEEP_LOGIN_KEY, keep ? "1" : "0"); } catch { }
        const { error, data } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
            const m = error.message || "";
            setMessage(/invalid|credentials/i.test(m) ? "メールアドレスまたはパスワードが正しくありません"
                : /fetch|network|timeout|504|502/i.test(m) ? "サーバーに接続できませんでした。時間をおいて再度お試しください"
                    : "ログインに失敗しました");
            setLoading(false);
            return;
        }
        setMessage("✅ ログイン成功！");
        const to = await go(data.user.id);
        if (to) setTimeout(() => router.push(to), 900);
        else setLoading(false);
    };

    const handleContinue = async () => {
        if (!session || loading) return;
        setLoading(true);
        const to = await go(session.userId);
        if (to) router.push(to); else setLoading(false);
    };

    const handleSwitch = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setMessage("");
    };

    const art = stage ? ART[stage.kind] : null;
    const cardStyle: React.CSSProperties | undefined = stage && art ? {
        left: stage.x + art.panel.l * art.w * stage.s,
        top: stage.y + art.panel.t * art.h * stage.s,
        width: art.panel.w * art.w * stage.s,
        minHeight: art.panel.h * art.h * stage.s,
        maxHeight: stage.vh - (stage.y + art.panel.t * art.h * stage.s) - 8,
    } : undefined;

    return (
        <>
            <style>{CSS}</style>
            <div className="iq-root">
                {stage && art && (
                    <>
                        <div className="iq-blur" style={{ backgroundImage: `url(${art.src})` }} />
                        <div className="iq-stage" role="img" aria-label="INTERN QUEST 現実の成長が、冒険の力になる。"
                            style={{ left: stage.x, top: stage.y, width: art.w * stage.s, height: art.h * stage.s, backgroundImage: `url(${art.src})` }} />
                        <section className={"iq-card" + (stage.kind === "mobile" ? " m" : "")} style={cardStyle} aria-live="polite">
                            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
                            <Compass />
                            {session === undefined ? (
                                <div style={{ textAlign: "center", padding: "28px 0", color: "#8a6d2f", fontWeight: 800 }}>冒険者証を確認中…</div>
                            ) : session ? (
                                <div className="iq-welcome">
                                    <h2>おかえりなさい</h2>
                                    <div className="name">{session.name ? `${session.name} さん` : "冒険者さん"}</div>
                                    <button className="iq-btn gold" onClick={handleContinue} disabled={loading}>{loading ? "準備中…" : "冒険をつづける"}<span className="arrow">→</span></button>
                                    {message && <div className="iq-msg ng">{message}</div>}
                                    <div className="iq-sep">または</div>
                                    <button className="iq-link" onClick={handleSwitch}>別のアカウントでログイン</button>
                                </div>
                            ) : (
                                <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} noValidate>
                                    <div className="iq-field">
                                        <MailIcon />
                                        <input className="iq-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="メールアドレス" type="email" autoComplete="email" inputMode="email" aria-label="メールアドレス" />
                                    </div>
                                    <div className="iq-field">
                                        <LockIcon />
                                        <input className="iq-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワード" type={showPw ? "text" : "password"} autoComplete="current-password" aria-label="パスワード" />
                                        <button className="iq-eye" type="button" aria-label={showPw ? "パスワードを隠す" : "パスワードを表示"} aria-pressed={showPw} onClick={() => setShowPw(!showPw)}><EyeIcon off={showPw} /></button>
                                    </div>
                                    <div className="iq-row">
                                        <label className="iq-check"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />ログイン状態を保持する</label>
                                        <button className="iq-link" type="button" onClick={() => router.push("/reset-password")}>パスワードを忘れた方</button>
                                    </div>
                                    <button className="iq-btn" type="submit" disabled={loading}>{loading ? "接続中…" : "ログイン"}<span className="arrow">→</span></button>
                                    {message && <div className={"iq-msg " + (message.startsWith("✅") ? "ok" : "ng")}>{message}</div>}
                                    <div className="iq-sep">または</div>
                                    <div style={{ textAlign: "center" }}>
                                        <button className="iq-link" type="button" onClick={() => router.push("/register")}>新規登録はこちら</button>
                                    </div>
                                </form>
                            )}
                        </section>
                    </>
                )}
            </div>
        </>
    );
}
