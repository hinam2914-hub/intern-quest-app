"use client";
// Intern Quest 2.0｜冒険者情報の登録（新規登録 → この画面 → 既存オンボーディング）
// 添付デザイン画像を背景に敷き、画像内の「冒険者名簿」位置に実フォームを重ねる（ログイン・登録画面と同方式）。
// 5項目の選択肢・保存先は既存アプリ（/mypage・/profile）と同じ：
//   事業部 → departments テーブル → profiles.department_id
//   大学名 → 自由入力（既存仕様）    → profiles.education
//   MBTI   → 16タイプ                → profiles.mbti
//   高校の部活 → 運動部/文化部/帰宅部 → profiles.club と profiles.club_category（既存どおり両方）
//   趣味   → 13種                     → profiles.hobby_category
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { computeStage, panelRect, type ArtSet, type Stage } from "@/app/lib/artStage";

const ARTS: ArtSet = {
    pc: { src: "/onboarding/profile_pc.webp", w: 1672, h: 941, panel: { l: 0.462, t: 0.205, w: 0.470, h: 0.635 } },
    mobile: { src: "/onboarding/profile_mobile.webp", w: 941, h: 1672, panel: { l: 0.125, t: 0.372, w: 0.750, h: 0.350 } },
};
// 既存の選択肢（/mypage・/profile と同一。変更禁止）
const MBTI = ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"];
const CLUBS = ["運動部", "文化部", "帰宅部"];
const HOBBIES = ["読書・勉強", "ゲーム", "スポーツ", "音楽", "アート・ものづくり", "旅行・アウトドア", "グルメ", "映画・ドラマ", "推し活", "SNS・配信", "買い物・ファッション", "ペット・動物", "サウナ"];

const CSS = `
.iq-root{position:fixed;inset:0;overflow:hidden;background:#7fc3ef;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416}
.iq-blur{position:absolute;inset:-40px;background-size:cover;background-position:center;filter:blur(24px);opacity:.9}
.iq-stage{position:absolute;background-size:100% 100%;background-repeat:no-repeat}
.iq-card{box-sizing:border-box;position:absolute;background:linear-gradient(180deg,#fdf6e3,#f3e6c8);border:2px solid #c9a24a;border-radius:10px;padding:22px 28px 20px;
  box-shadow:0 0 0 4px rgba(255,248,225,.55),0 20px 40px rgba(60,40,10,.3),inset 0 0 50px rgba(190,150,80,.25);display:flex;flex-direction:column;justify-content:center;overflow:auto;-webkit-overflow-scrolling:touch}
.iq-card .corner{position:absolute;width:18px;height:18px;border:3px solid #c9a24a;border-radius:2px}
.iq-card .corner.tl{left:7px;top:7px;border-right:none;border-bottom:none}.iq-card .corner.tr{right:7px;top:7px;border-left:none;border-bottom:none}
.iq-card .corner.bl{left:7px;bottom:7px;border-right:none;border-top:none}.iq-card .corner.br{right:7px;bottom:7px;border-left:none;border-top:none}
.iq-h{text-align:center;margin:0 0 2px;font-size:22px;font-weight:900;color:#2b2416;letter-spacing:.3em}
.iq-sub{text-align:center;margin:0 0 12px;font-size:12px;font-weight:700;color:#5b4a2a}
.iq-row{display:grid;grid-template-columns:150px 1fr;align-items:center;gap:12px;padding:7px 0;border-bottom:1px solid rgba(160,120,60,.25)}
.iq-row:last-of-type{border-bottom:none}
.iq-lab{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:900;color:#2b2416}
.iq-lab svg{width:24px;height:24px;flex-shrink:0;fill:#5a4320}
.iq-ctl{position:relative}
.iq-sel,.iq-in{box-sizing:border-box;width:100%;height:46px;padding:0 40px 0 14px;border-radius:9px;border:1.5px solid #cdbf9c;background:#fffdf7;color:#2b2416;font-size:15px;outline:none;font-family:inherit;appearance:none;-webkit-appearance:none}
.iq-sel:focus,.iq-in:focus{border-color:#2f6fd6;box-shadow:0 0 0 4px rgba(47,111,214,.18)}
.iq-sel.ph{color:#9c927c}
.iq-sel.err,.iq-in.err{border-color:#d33}
.iq-ctl .tail{position:absolute;right:12px;top:50%;transform:translateY(-50%);width:20px;height:20px;pointer-events:none;fill:none;stroke:#555;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.iq-btn{box-sizing:border-box;width:100%;height:54px;border-radius:999px;border:2px solid #e8c45a;cursor:pointer;font-size:18px;font-weight:900;letter-spacing:.08em;color:#fff;font-family:inherit;margin-top:14px;
  background:linear-gradient(180deg,#4d9af5 0%,#2f6fd6 50%,#1d4fb3 100%);box-shadow:0 0 0 2px #fff6d0,0 8px 18px rgba(36,88,199,.4),inset 0 2px 0 rgba(255,255,255,.45);
  display:flex;align-items:center;justify-content:center;position:relative;transition:transform .08s,filter .12s}
.iq-btn .arrow{position:absolute;right:20px;top:50%;transform:translateY(-50%);font-size:21px;line-height:1}
.iq-btn:hover{filter:brightness(1.06)}.iq-btn:active{transform:translateY(2px)}.iq-btn:disabled{opacity:.7;cursor:default;transform:none}
.iq-msg{margin-top:10px;font-size:13px;text-align:center;font-weight:800;border-radius:10px;padding:8px 10px;line-height:1.5}
.iq-msg.ok{color:#14532d;background:#dcfce7}.iq-msg.ng{color:#991b1b;background:#fee2e2}
.iq-card.m{padding:14px 14px 12px;border-radius:8px}
.iq-card.m .iq-h,.iq-card.m .iq-sub{display:none}
.iq-card.m .iq-row{grid-template-columns:96px 1fr;gap:6px;padding:5px 0}
.iq-card.m .iq-lab{font-size:12.5px;gap:5px;white-space:nowrap}.iq-card.m .iq-lab svg{width:20px;height:20px}
.iq-card.m .iq-sel,.iq-card.m .iq-in{height:44px;font-size:14px;padding:0 34px 0 10px}
.iq-card.m .iq-btn{height:50px;font-size:16px;margin-top:10px}
@media (prefers-reduced-motion:reduce){.iq-btn{transition:none}}
`;

const I = {
    dept: <svg viewBox="0 0 24 24"><path d="M3 21V7l9-4 9 4v14h-6v-5h-6v5H3zm4-9h2V9H7v3zm4 0h2V9h-2v3zm4 0h2V9h-2v3z" /></svg>,
    uni: <svg viewBox="0 0 24 24"><path d="M12 3 1 9l11 6 9-4.9V17h2V9L12 3zm-6 9.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-3.5l-6 3.3-6-3.3z" /></svg>,
    mbti: <svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3" /><circle cx="16" cy="8" r="3" /><path d="M2 19c0-3 2.7-5 6-5s6 2 6 5H2zm8 0c0-2 .8-3.6 2.2-4.6 1-.3 2.2-.4 3.8-.4 3.3 0 6 2 6 5H10z" /></svg>,
    club: <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 0 1 6.3 3.1L15 9l-3-1-3 1-3.3-1.9A8 8 0 0 1 12 4zm-7.9 9h4.4l1.5 3-2.2 3.4A8 8 0 0 1 4.1 13zm8.9 7-2.5-3.5L12 13l1.5 3.5L11 20h2zm3.1-1.6L13.9 16l1.5-3h4.5a8 8 0 0 1-3.8 5.4z" /></svg>,
    hobby: <svg viewBox="0 0 24 24"><path d="M6 7h12a5 5 0 0 1 5 5v1a4 4 0 0 1-7.2 2.4L15 15H9l-.8.4A4 4 0 0 1 1 13v-1a5 5 0 0 1 5-5zm1 3v2H5v2h2v2h2v-2h2v-2H9v-2H7zm9 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm2 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" /></svg>,
};
const Chev = () => <svg className="tail" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>;
const Mag = () => <svg className="tail" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M16 16l5 5" /></svg>;

export default function OnboardingProfilePage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
    const [dept, setDept] = useState("");
    const [education, setEducation] = useState("");
    const [mbti, setMbti] = useState("");
    const [club, setClub] = useState("");
    const [hobby, setHobby] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [errField, setErrField] = useState("");
    const [stage, setStage] = useState<Stage | null>(null);
    const lastRef = useRef({ w: 0, h: 0 });

    useEffect(() => {
        const update = () => {
            const w = window.innerWidth; let h = window.innerHeight;
            const last = lastRef.current;
            if (last.w === w && h < last.h && h > last.h * 0.5) h = last.h;
            lastRef.current = { w, h };
            setStage(computeStage(ARTS, w, h));
        };
        update();
        window.addEventListener("resize", update); window.addEventListener("orientationchange", update);
        return () => { window.removeEventListener("resize", update); window.removeEventListener("orientationchange", update); };
    }, []);

    // ログイン必須。入力済みの値があれば初期表示に反映（途中離脱からの再開）
    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const [{ data: p }, { data: d }] = await Promise.all([
                supabase.from("profiles").select("department_id, education, mbti, club, club_category, hobby_category, onboarding_done").eq("id", user.id).single(),
                supabase.from("departments").select("id, name, code").order("created_at"),
            ]);
            setDepartments((d || []) as any);
            if (p) {
                setDept((p as any).department_id || ""); setEducation((p as any).education || ""); setMbti((p as any).mbti || "");
                setClub((p as any).club_category || (p as any).club || ""); setHobby((p as any).hobby_category || "");
            }
        })();
    }, [router]);

    const fail = (f: string, m: string) => { setErrField(f); setMessage(m); };
    const handleSave = async () => {
        if (loading || !userId) return;
        setErrField(""); setMessage("");
        if (!dept) return fail("dept", "事業部を選択してください");
        if (!education.trim()) return fail("uni", "大学名を入力してください");
        if (!mbti) return fail("mbti", "MBTIを選択してください");
        if (!club) return fail("club", "高校の部活を選択してください");
        if (!hobby) return fail("hobby", "趣味を選択してください");
        setLoading(true);
        // 保存形式は /mypage の handleSaveProfile と同じ
        const { error } = await supabase.from("profiles").update({
            department_id: dept, education: education.trim(), mbti, club, club_category: club, hobby_category: hobby,
        }).eq("id", userId);
        if (error) {
            fail("", "保存に失敗しました。もう一度お試しください（" + error.message + "）");
            setLoading(false);
            return;
        }
        setMessage("✅ 登録しました！");
        // 次：職業選択（未実装）→ 当面は既存のオンボーディング画面へ
        setTimeout(() => router.push("/onboarding"), 700);
    };

    const art = stage ? ARTS[stage.kind] : null;
    const cardStyle = stage ? panelRect(ARTS, stage) : undefined;
    const selCls = (f: string, v: string) => "iq-sel" + (v ? "" : " ph") + (errField === f ? " err" : "");

    return (
        <>
            <style>{CSS}</style>
            <div className="iq-root">
                {stage && art && (
                    <>
                        <div className="iq-blur" style={{ backgroundImage: `url(${art.src})` }} />
                        <div className="iq-stage" role="img" aria-label="INTERN QUEST 冒険者情報の登録"
                            style={{ left: stage.x, top: stage.y, width: art.w * stage.s, height: art.h * stage.s, backgroundImage: `url(${art.src})` }} />
                        <section className={"iq-card" + (stage.kind === "mobile" ? " m" : "")} style={cardStyle} aria-live="polite">
                            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
                            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} noValidate>
                                <h2 className="iq-h">冒険者名簿</h2>
                                <p className="iq-sub">下の項目を入力して、あなたのプロフィールを登録してください。</p>
                                <div className="iq-row"><div className="iq-lab">{I.dept}事業部</div><div className="iq-ctl">
                                    <select className={selCls("dept", dept)} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="事業部">
                                        <option value="">選択してください</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select><Chev /></div></div>
                                <div className="iq-row"><div className="iq-lab">{I.uni}大学名</div><div className="iq-ctl">
                                    <input className={"iq-in" + (errField === "uni" ? " err" : "")} value={education} onChange={(e) => setEducation(e.target.value)} placeholder="大学名を入力してください" aria-label="大学名" /><Mag /></div></div>
                                <div className="iq-row"><div className="iq-lab">{I.mbti}MBTI</div><div className="iq-ctl">
                                    <select className={selCls("mbti", mbti)} value={mbti} onChange={(e) => setMbti(e.target.value)} aria-label="MBTI">
                                        <option value="">選択してください</option>{MBTI.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select><Chev /></div></div>
                                <div className="iq-row"><div className="iq-lab">{I.club}高校の部活</div><div className="iq-ctl">
                                    <select className={selCls("club", club)} value={club} onChange={(e) => setClub(e.target.value)} aria-label="高校の部活">
                                        <option value="">選択してください</option>{CLUBS.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select><Chev /></div></div>
                                <div className="iq-row"><div className="iq-lab">{I.hobby}趣味</div><div className="iq-ctl">
                                    <select className={selCls("hobby", hobby)} value={hobby} onChange={(e) => setHobby(e.target.value)} aria-label="趣味">
                                        <option value="">選択してください</option>{HOBBIES.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select><Chev /></div></div>
                                <button className="iq-btn" type="submit" disabled={loading || !userId}>{loading ? "登録中…" : "冒険者情報を登録する"}<span className="arrow">→</span></button>
                                {message && <div className={"iq-msg " + (message.startsWith("✅") ? "ok" : "ng")}>{message}</div>}
                            </form>
                        </section>
                    </>
                )}
            </div>
        </>
    );
}
