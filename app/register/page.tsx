"use client";
// Intern Quest 2.0｜冒険者登録（新規登録）画面
// 添付デザイン画像（PC: /register/bg_pc.webp / スマホ: /register/bg_mobile.webp）をそのまま背景に使い、
// 画像内のフォーム位置に実際の入力フォーム（HTML）を重ねる。
// 登録処理は従来と同じ：signUp → profiles 作成 → user_points 作成 → /onboarding。
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { computeStage, panelRect, type ArtSet, type Stage } from "@/app/lib/artStage";

const ARTS: ArtSet = {
    pc: { src: "/register/bg_pc.webp", w: 1672, h: 941, panel: { l: 0.598, t: 0.197, w: 0.332, h: 0.653 } },
    mobile: { src: "/register/bg_mobile.webp", w: 941, h: 1672, panel: { l: 0.170, t: 0.359, w: 0.659, h: 0.344 } },
};

const CSS = `
.iq-root{position:fixed;inset:0;overflow:hidden;background:#7fc3ef;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416}
.iq-blur{position:absolute;inset:-40px;background-size:cover;background-position:center;filter:blur(24px);opacity:.9}
.iq-stage{position:absolute;background-size:100% 100%;background-repeat:no-repeat}
.iq-card{box-sizing:border-box;position:absolute;background:linear-gradient(180deg,#fffdf6,#f9f1dc);border:2px solid #d8b55e;border-radius:14px;padding:28px 26px 18px;
  box-shadow:0 0 0 5px rgba(255,255,255,.6),0 24px 50px rgba(30,60,120,.28);display:flex;flex-direction:column;justify-content:center;overflow:auto;-webkit-overflow-scrolling:touch}
.iq-card .corner{position:absolute;width:20px;height:20px;border:3px solid #d8b55e;border-radius:2px}
.iq-card .corner.tl{left:8px;top:8px;border-right:none;border-bottom:none}.iq-card .corner.tr{right:8px;top:8px;border-left:none;border-bottom:none}
.iq-card .corner.bl{left:8px;bottom:8px;border-right:none;border-top:none}.iq-card .corner.br{right:8px;bottom:8px;border-left:none;border-top:none}
.iq-compass{position:absolute;left:50%;top:-20px;transform:translateX(-50%);width:40px;height:40px}
.iq-field{position:relative;margin-bottom:12px}
.iq-field .ic{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:20px;height:20px;opacity:.75}
.iq-input{box-sizing:border-box;width:100%;height:50px;padding:0 46px 0 44px;border-radius:10px;border:1.5px solid #cdbf9c;background:#fffffb;color:#2b2416;font-size:16px;outline:none;font-family:inherit;transition:border-color .15s,box-shadow .15s}
.iq-input::placeholder{color:#9c927c}
.iq-input:focus{border-color:#2f6fd6;box-shadow:0 0 0 4px rgba(47,111,214,.18)}
.iq-input.err{border-color:#d33}
.iq-eye{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:36px;height:36px;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:.8;border-radius:8px}
.iq-eye:hover{background:rgba(0,0,0,.05)}
.iq-btn{box-sizing:border-box;width:100%;height:54px;border-radius:999px;border:2px solid #e8c45a;cursor:pointer;font-size:18px;font-weight:900;letter-spacing:.08em;color:#fff;font-family:inherit;margin-top:6px;
  background:linear-gradient(180deg,#4d9af5 0%,#2f6fd6 50%,#1d4fb3 100%);box-shadow:0 0 0 2px #fff6d0,0 8px 18px rgba(36,88,199,.4),inset 0 2px 0 rgba(255,255,255,.45);
  display:flex;align-items:center;justify-content:center;position:relative;transition:transform .08s,filter .12s}
.iq-btn .arrow{position:absolute;right:20px;top:50%;transform:translateY(-50%);font-size:21px;line-height:1}
.iq-btn:hover{filter:brightness(1.06)}
.iq-btn:active{transform:translateY(2px)}
.iq-btn:disabled{opacity:.7;cursor:default;transform:none}
.iq-link{background:none;border:none;color:#1f5fcc;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;padding:6px 0;text-decoration:underline;text-underline-offset:3px;display:block;margin:12px auto 0}
.iq-msg{margin-top:10px;font-size:13px;text-align:center;font-weight:800;border-radius:10px;padding:8px 10px;line-height:1.5}
.iq-msg.ok{color:#14532d;background:#dcfce7}.iq-msg.ng{color:#991b1b;background:#fee2e2}
.iq-done{text-align:center}
.iq-done h2{margin:0 0 8px;font-size:18px;font-weight:900;color:#1d3f8c}
.iq-done p{margin:0 0 14px;font-size:13.5px;line-height:1.7;color:#4b3f2a;font-weight:700}
.iq-card.m{padding:20px 16px 14px;border-radius:12px}
.iq-card.m .iq-input{height:46px}.iq-card.m .iq-btn{height:52px}.iq-card.m .iq-field{margin-bottom:10px}
@media (prefers-reduced-motion:reduce){.iq-btn{transition:none}}
`;

const Compass = () => (
    <svg className="iq-compass" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="17" fill="#fffdf5" stroke="#d8b55e" strokeWidth="2" />
        <path d="M20 5 L23 17 L35 20 L23 23 L20 35 L17 23 L5 20 L17 17 Z" fill="#e2b84f" stroke="#9a7420" strokeWidth="1" />
        <circle cx="20" cy="20" r="3" fill="#2f6fd6" />
    </svg>
);
const UserIcon = () => (<svg className="ic" viewBox="0 0 24 24" fill="#333"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" /></svg>);
const MailIcon = () => (<svg className="ic" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>);
const LockIcon = () => (<svg className="ic" viewBox="0 0 24 24" fill="#333"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#333" strokeWidth="2" /></svg>);
const EyeIcon = ({ off }: { off: boolean }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" fill="#333" stroke="none" />
        {off && <path d="M4 4l16 16" />}
    </svg>
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [showPw2, setShowPw2] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [errField, setErrField] = useState<string>("");
    const [done, setDone] = useState<"redirect" | "confirm" | null>(null);
    const [stage, setStage] = useState<Stage | null>(null);
    const lastRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

    // 画面サイズに合わせて画像の配置を計算（スマホのキーボード表示による高さ減少は無視）
    useEffect(() => {
        const update = () => {
            const w = window.innerWidth; let h = window.innerHeight;
            const last = lastRef.current;
            if (last.w === w && h < last.h && h > last.h * 0.5) h = last.h;
            lastRef.current = { w, h };
            setStage(computeStage(ARTS, w, h));
        };
        update();
        window.addEventListener("resize", update);
        window.addEventListener("orientationchange", update);
        return () => { window.removeEventListener("resize", update); window.removeEventListener("orientationchange", update); };
    }, []);

    const fail = (field: string, msg: string) => { setErrField(field); setMessage(msg); };

    const handleRegister = async () => {
        if (loading) return;
        setErrField(""); setMessage("");
        if (!name.trim()) return fail("name", "名前を入力してください");
        if (!email.trim()) return fail("email", "メールアドレスを入力してください");
        if (!EMAIL_RE.test(email.trim())) return fail("email", "メールアドレスの形式が正しくありません");
        if (password.length < 6) return fail("password", "パスワードは6文字以上にしてください");
        if (password !== confirm) return fail("confirm", "パスワードと確認用パスワードが一致しません");

        setLoading(true);
        // 1. auth.users に登録（従来どおり）
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) {
            const m = error.message || "";
            if (/already registered|already exists|already been registered/i.test(m)) fail("email", "このメールアドレスはすでに登録されています。ログインページからログインしてください。");
            else if (/password/i.test(m)) fail("password", "パスワードが条件を満たしていません：" + m);
            else if (/fetch|network|timeout|504|502/i.test(m)) fail("", "サーバーに接続できませんでした。時間をおいて再度お試しください");
            else fail("", "登録に失敗しました：" + m);
            setLoading(false);
            return;
        }
        const user = data.user;
        if (!user) { fail("", "ユーザー作成に失敗しました"); setLoading(false); return; }

        // 2. profiles に名前を保存（従来どおり。MBTI 等は後続画面で設定）
        const { error: profileError } = await supabase.from("profiles").insert({ id: user.id, name: name.trim(), role: "Member", mbti: null, club_category: null, hobby_category: null });
        if (profileError) {
            await supabase.from("profiles").update({ name: name.trim() }).eq("id", user.id);
        }
        // 3. user_points に初期ポイント（従来どおり）
        await supabase.from("user_points").insert({ id: user.id, points: 0 });

        if (!data.session) {
            // メール確認が必要な設定のとき：セッションが無いので確認案内を出す
            setDone("confirm");
        } else {
            setDone("redirect");
            setTimeout(() => router.push("/onboarding/profile"), 1800);
        }
        setLoading(false);
    };

    const art = stage ? ARTS[stage.kind] : null;
    const cardStyle = stage ? panelRect(ARTS, stage) : undefined;

    return (
        <>
            <style>{CSS}</style>
            <div className="iq-root">
                {stage && art && (
                    <>
                        <div className="iq-blur" style={{ backgroundImage: `url(${art.src})` }} />
                        <div className="iq-stage" role="img" aria-label="INTERN QUEST 冒険者登録 あなたの冒険を、ここから記録しよう。"
                            style={{ left: stage.x, top: stage.y, width: art.w * stage.s, height: art.h * stage.s, backgroundImage: `url(${art.src})` }} />
                        <section className={"iq-card" + (stage.kind === "mobile" ? " m" : "")} style={cardStyle} aria-live="polite">
                            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
                            <Compass />
                            {done === "confirm" ? (
                                <div className="iq-done">
                                    <h2>確認メールを送りました</h2>
                                    <p>{email.trim()} 宛てに確認メールを送信しました。<br />メール内のリンクを開いて登録を完了してください。</p>
                                    <button className="iq-btn" type="button" onClick={() => router.push("/login")}>ログイン画面へ<span className="arrow">→</span></button>
                                </div>
                            ) : done === "redirect" ? (
                                <div className="iq-done">
                                    <h2>登録完了！</h2>
                                    <p>ようこそ、{name.trim()} さん。<br />冒険の準備へ移動します…</p>
                                </div>
                            ) : (
                                <form onSubmit={(e) => { e.preventDefault(); handleRegister(); }} noValidate>
                                    <div className="iq-field">
                                        <UserIcon />
                                        <input className={"iq-input" + (errField === "name" ? " err" : "")} value={name} onChange={(e) => setName(e.target.value)} placeholder="名前" type="text" autoComplete="name" aria-label="名前" />
                                    </div>
                                    <div className="iq-field">
                                        <MailIcon />
                                        <input className={"iq-input" + (errField === "email" ? " err" : "")} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="メールアドレス" type="email" autoComplete="email" inputMode="email" aria-label="メールアドレス" />
                                    </div>
                                    <div className="iq-field">
                                        <LockIcon />
                                        <input className={"iq-input" + (errField === "password" ? " err" : "")} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワード" type={showPw ? "text" : "password"} autoComplete="new-password" aria-label="パスワード" />
                                        <button className="iq-eye" type="button" aria-label={showPw ? "パスワードを隠す" : "パスワードを表示"} aria-pressed={showPw} onClick={() => setShowPw(!showPw)}><EyeIcon off={showPw} /></button>
                                    </div>
                                    <div className="iq-field">
                                        <LockIcon />
                                        <input className={"iq-input" + (errField === "confirm" ? " err" : "")} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="パスワード（確認）" type={showPw2 ? "text" : "password"} autoComplete="new-password" aria-label="パスワード（確認）" />
                                        <button className="iq-eye" type="button" aria-label={showPw2 ? "パスワードを隠す" : "パスワードを表示"} aria-pressed={showPw2} onClick={() => setShowPw2(!showPw2)}><EyeIcon off={showPw2} /></button>
                                    </div>
                                    <button className="iq-btn" type="submit" disabled={loading}>{loading ? "登録中…" : "冒険者登録"}<span className="arrow">→</span></button>
                                    {message && <div className="iq-msg ng">{message}</div>}
                                    <button className="iq-link" type="button" onClick={() => router.push("/login")}>すでにアカウントをお持ちの方はこちら</button>
                                </form>
                            )}
                        </section>
                    </>
                )}
            </div>
        </>
    );
}
