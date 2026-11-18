"use client";
// ペイフォワード報告。見た目を王国RPG調にしただけで、データの読み書きは従来のまま：
// ・後輩の候補＝profiles（is_active=true、自分以外、名前順）
// ・報告＝mentor_reports に status:"pending" で追加（後輩・内容・写真が必須。カテゴリの内部値 meal/sales/meeting/study/play は不変）
// ・写真＝storage「avatars」の mentor-reports/<uid>/<時刻>.<拡張子>
// ・承認／差し戻しは管理画面（MentorReportTab）で status を approved / rejected に更新。承認件数がリーダースコアに使われる（このページでは計算しない）
// ・状態は pending / approved / rejected の3つだけ。差し戻し理由の列は無いので表示しない
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Member = { id: string; name: string };
type Report = { id: string; target_user_id: string; category: string; comment: string | null; image_url: string | null; status: string; created_at: string };

const CATEGORIES = [
    { key: "meal", img: "/mentor/cat_meal.webp", label: "ご飯" },
    { key: "sales", img: "/mentor/cat_sales.webp", label: "営業同行" },
    { key: "meeting", img: "/mentor/cat_meeting.webp", label: "面談・1on1" },
    { key: "study", img: "/mentor/cat_study.webp", label: "勉強会・研修" },
    { key: "play", img: "/mentor/cat_play.webp", label: "遊び" },
];
const PAGE = 10;
const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function MentorReportPage() {
    const router = useRouter();
    const [userId, setUserId] = useState("");
    const [members, setMembers] = useState<Member[]>([]);
    const [extraNames, setExtraNames] = useState<Record<string, string>>({});
    const [reports, setReports] = useState<Report[]>([]);
    const [targetId, setTargetId] = useState("");
    const [category, setCategory] = useState("meal");
    const [comment, setComment] = useState("");
    const [image, setImage] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [phase, setPhase] = useState("");
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);
    const [loading, setLoading] = useState(true);
    const [shown, setShown] = useState(PAGE);
    const [zoom, setZoom] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const lock = useRef(false);

    // 候補に居ない相手（無効化された人など）の名前も、過去の報告に出せるように補う
    const fillNames = async (rows: Report[], known: Member[]) => {
        const miss = Array.from(new Set(rows.map((r) => r.target_user_id))).filter((id) => id && !known.some((m) => m.id === id));
        if (miss.length === 0) return;
        const { data } = await supabase.from("profiles").select("id, name").in("id", miss);
        const map: Record<string, string> = {};
        (data || []).forEach((p: any) => { if (p.name) map[p.id] = p.name; });
        setExtraNames(map);
    };

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const { data: profs } = await supabase.from("profiles").select("id, name").eq("is_active", true).neq("id", user.id).order("name");
            const ms = (profs || []) as Member[];
            setMembers(ms);
            const { data: reportRows } = await supabase.from("mentor_reports").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
            const rs = (reportRows || []) as Report[];
            setReports(rs);
            setLoading(false);
            fillNames(rs, ms);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    useEffect(() => {
        if (!image) { setPreview(null); return; }
        const url = URL.createObjectURL(image);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [image]);

    const pick = (f: File | null) => {
        setError("");
        if (f && !f.type.startsWith("image/")) { setError("画像ファイルを選んでください"); return; }
        setImage(f);
    };
    const clearImage = () => { setImage(null); if (fileRef.current) fileRef.current.value = ""; };

    const handleSubmit = async () => {
        if (lock.current) return;
        if (!targetId) { setError("後輩を選んでください"); return; }
        if (!comment.trim()) { setError("内容を入力してください"); return; }
        if (!image) { setError("写真を選択してください"); return; }
        lock.current = true;
        setSending(true); setError(""); setDone(false);
        try {
            setPhase("写真をアップロード中…");
            const ext = image.name.split(".").pop();
            const filePath = `mentor-reports/${userId}/${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, image, { upsert: true });
            if (uploadError) { setError("写真のアップロードに失敗しました。通信状況を確認して、もう一度お試しください。（" + uploadError.message + "）"); return; }
            const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
            setPhase("報告を送信中…");
            const { error: insertError } = await supabase.from("mentor_reports").insert({
                user_id: userId,
                target_user_id: targetId,
                category,
                comment: comment.trim(),
                image_url: publicUrl,
                status: "pending",
            });
            if (insertError) { setError("送信に失敗しました: " + insertError.message); return; }
            const { data: reportRows } = await supabase.from("mentor_reports").select("*").eq("user_id", userId).order("created_at", { ascending: false });
            const rs = (reportRows || []) as Report[];
            setReports(rs);
            fillNames(rs, members);
            setTargetId(""); setComment(""); clearImage();
            setDone(true);
        } finally {
            setSending(false); setPhase(""); lock.current = false;
        }
    };

    const nameOf = (id: string) => members.find((m) => m.id === id)?.name || extraNames[id] || "不明";
    const catOf = (key: string) => CATEGORIES.find((c) => c.key === key) || { key, img: "", label: key };
    const status = (s: string) => s === "approved" ? { c: "ok", l: "承認済み" } : s === "rejected" ? { c: "ng", l: "差し戻し" } : { c: "wait", l: "承認待ち" };

    if (loading) return <main className="pf-root pf-loading"><style>{CSS}</style>読み込み中…</main>;

    return (
        <main className="pf-root">
            <style>{CSS}</style>
            <div className="pf-wrap">
                <button className="pf-brand" onClick={() => router.push("/home")}>INTERN QUEST</button>
                <div className="pf-ribbon"><img src="/mentor/title_ribbon.webp" alt="" /><h1>ペイフォワード報告</h1></div>
                <div className="pf-lead">
                    <b>後輩の成長を支える行動を、冒険の記録として残そう。</b>
                    <p>営業同行・面談・研修・交流など、後輩のために行った取り組みを報告できます。承認された報告は、リーダースコアに反映されます。</p>
                </div>

                <section className="pf-panel">
                    <div className="pf-field">
                        <label className="pf-tag" htmlFor="pf-target">👥 後輩を選ぶ</label>
                        <div className={`pf-select${targetId ? " on" : ""}`}>
                            <select id="pf-target" value={targetId} onChange={(e) => { setTargetId(e.target.value); setError(""); }} disabled={sending}>
                                <option value="">選択してください</option>
                                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="pf-field">
                        <div className="pf-tag">🚩 活動の種類</div>
                        <div className="pf-cats" role="radiogroup" aria-label="活動の種類">
                            {CATEGORIES.map((c) => (
                                <button key={c.key} type="button" role="radio" aria-checked={category === c.key} className={`pf-cat${category === c.key ? " on" : ""}`} onClick={() => setCategory(c.key)} disabled={sending}>
                                    <img src={c.img} alt="" />{c.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pf-field">
                        <label className="pf-tag" htmlFor="pf-comment">✒️ 活動内容</label>
                        <textarea id="pf-comment" value={comment} onChange={(e) => { setComment(e.target.value); setError(""); }} disabled={sending} placeholder="例：後輩とランチに行き、最近の悩みや今後の目標について話しました。" />
                        <div className="pf-hint">何をしたか・後輩にどんな変化があったかを具体的に書いてみましょう。</div>
                    </div>

                    <div className="pf-field">
                        <div className="pf-tag">🖼️ 写真を添付<i>必須</i></div>
                        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0] || null)} />
                        {image && preview ? (
                            <div className="pf-photo">
                                <img src={preview} alt="選択した写真" />
                                <div className="pf-photo-i">
                                    <b>{image.name}</b>
                                    <div>
                                        <button type="button" onClick={() => fileRef.current?.click()} disabled={sending}>選び直す</button>
                                        <button type="button" className="x" onClick={clearImage} disabled={sending}>解除する</button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <button type="button" className="pf-drop" onClick={() => fileRef.current?.click()} disabled={sending}>
                                <span aria-hidden>⬆</span><b>写真を選ぶ</b><em>タップして写真を選択してください</em>
                            </button>
                        )}
                    </div>

                    {error && <div className="pf-err" role="alert">{error}</div>}
                    {done && (
                        <div className="pf-done" role="status">
                            <span className="s s1">✦</span><span className="s s2">✦</span><span className="s s3">✦</span>
                            報告を受け付けました！承認されるまでお待ちください。
                        </div>
                    )}
                    <button type="button" className="pf-submit" onClick={handleSubmit} disabled={sending}>{sending ? (phase || "送信中…") : "✉️ 報告を送信"}</button>
                </section>

                <div className="pf-h2"><img src="/rookie/section_quill.webp" alt="" /><h2>これまでの報告</h2><span /></div>
                {reports.length === 0 ? (
                    <div className="pf-empty">まだ報告がありません。最初の記録を残してみよう。</div>
                ) : (
                    <div className="pf-list">
                        {reports.slice(0, shown).map((r) => {
                            const c = catOf(r.category); const st = status(r.status);
                            return (
                                <article key={r.id} className="pf-card">
                                    <div className="pf-card-h">
                                        <div className="pf-card-t">{c.img && <img src={c.img} alt="" />}{c.label} → {nameOf(r.target_user_id)}</div>
                                        <span className={`pf-st ${st.c}`}>{st.c === "ok" && <img src="/mentor/approved_emblem.webp" alt="" />}{st.l}</span>
                                    </div>
                                    <div className="pf-card-b">
                                        {r.image_url && <button type="button" className="pf-thumb" onClick={() => setZoom(r.image_url)} aria-label="写真を拡大"><img src={r.image_url} alt="添付写真" loading="lazy" /></button>}
                                        <div className="pf-card-m">
                                            {r.comment && <p>{r.comment}</p>}
                                            <time>{fmt(r.created_at)}</time>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                        {reports.length > shown && <button type="button" className="pf-more" onClick={() => setShown(shown + PAGE)}>もっと見る（残り{reports.length - shown}件）</button>}
                    </div>
                )}
            </div>

            {zoom && <div className="pf-zoom" onClick={() => setZoom(null)}><img src={zoom} alt="添付写真" /><button type="button" aria-label="閉じる">✕</button></div>}

            <div className="pf-nav">
                <div className="band" />
                {[{ k: "home", l: "ホーム", h: "/home", img: "/home/nav_home_active.webp" }, { k: "rank", l: "ランキング", h: "/ranking", img: "/home/nav_trophy.webp" }, { k: "house", l: "おうち", h: "/mypage", img: "/home/nav_house.webp" }, { k: "menu", l: "メニュー", h: "/menu", img: "" }].map((t) => (
                    <button key={t.k} onClick={() => router.push(t.h)}>{t.img ? <img src={t.img} alt="" /> : <span>☰</span>}<i>{t.l}</i></button>
                ))}
            </div>
        </main>
    );
}

const CSS = `
.pf-root{min-height:100vh;min-height:100dvh;overflow-x:clip;background:url(/home/bg_mobile.webp) center top / cover no-repeat fixed,#bfe3f5;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416;padding:10px 10px calc(108px + env(safe-area-inset-bottom));box-sizing:border-box}
@media (min-width:700px){ .pf-root{background-image:url(/home/bg_pc.webp);padding-top:18px} }
.pf-root *{box-sizing:border-box}
.pf-loading{display:flex;align-items:center;justify-content:center;font-weight:900;color:#17397d}
.pf-wrap{max-width:820px;margin:0 auto}
.pf-brand{display:block;margin:0 auto 6px;border:none;background:none;color:#b98a1e;font-size:12px;font-weight:900;letter-spacing:.28em;cursor:pointer;min-height:28px;font-family:inherit;text-shadow:0 1px 0 #fff}
.pf-ribbon{position:relative;max-width:640px;margin:0 auto;container-type:inline-size}
.pf-ribbon img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 12px rgba(16,47,112,.35))}
.pf-ribbon h1{position:absolute;left:28%;right:19%;top:33%;bottom:27%;margin:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:clamp(14px,5.4cqw,34px);font-weight:900;letter-spacing:.04em;text-shadow:0 2px 4px rgba(10,25,70,.6);white-space:nowrap}
.pf-lead{margin:2px auto 0;max-width:720px;background:rgba(255,253,246,.95);border:2px solid #e2bf63;border-radius:14px;padding:11px 18px;text-align:center;box-shadow:0 6px 14px rgba(16,47,112,.18)}
.pf-lead b{display:block;font-size:15px;font-weight:900;color:#17397d;line-height:1.6}
.pf-lead p{margin:4px 0 0;font-size:13px;font-weight:700;line-height:1.75;color:#4a3f26}
.pf-panel{margin-top:14px;background:linear-gradient(180deg,#fffdf6,#f8eed8);border:3px solid #e2bf63;border-radius:22px;padding:22px 26px 24px;box-shadow:inset 0 0 0 2px #fff,0 12px 28px rgba(16,47,112,.3)}
.pf-field{margin-bottom:18px;min-width:0}
.pf-tag{display:inline-flex;align-items:center;gap:6px;margin-bottom:9px;padding:5px 18px 5px 12px;background:linear-gradient(180deg,#2a4aa6,#172f78);color:#fff;font-size:14px;font-weight:900;border-radius:8px 18px 18px 8px;border-bottom:2px solid #e2bf63;box-shadow:0 3px 6px rgba(16,47,112,.25)}
.pf-tag i{font-style:normal;font-size:10.5px;background:#f1cf6b;color:#4a3305;border-radius:999px;padding:1px 8px;margin-left:4px}
.pf-select{position:relative;border:2px solid #e3d3a4;border-radius:999px;background:#fff;box-shadow:inset 0 2px 4px rgba(120,80,20,.08)}
.pf-select.on{border-color:#2a4aa6;box-shadow:0 0 0 3px rgba(42,74,166,.16)}
.pf-select::after{content:"";position:absolute;right:20px;top:50%;width:9px;height:9px;border-right:3px solid #17397d;border-bottom:3px solid #17397d;transform:translateY(-70%) rotate(45deg);pointer-events:none}
.pf-select select{width:100%;min-height:50px;padding:0 46px 0 20px;border:none;background:transparent;border-radius:999px;font-size:16px;font-weight:800;color:#23284a;appearance:none;-webkit-appearance:none;outline:none;font-family:inherit;cursor:pointer}
.pf-cats{display:flex;flex-wrap:wrap;gap:9px}
.pf-cat{display:inline-flex;align-items:center;gap:7px;min-height:48px;padding:8px 18px;border:2.5px solid #e2c98c;border-radius:14px;background:linear-gradient(180deg,#fff,#fbf2de);color:#2a2f52;font-size:15px;font-weight:900;cursor:pointer;box-shadow:0 3px 7px rgba(120,80,20,.16);font-family:inherit;white-space:nowrap;transition:transform .12s}
.pf-cat img{width:30px;height:30px;object-fit:contain;flex-shrink:0}
.pf-cat:active{transform:scale(.97)}
.pf-cat.on{background:linear-gradient(180deg,#3b78e0,#1746b0);border-color:#f5d77e;color:#fff;box-shadow:0 0 0 2px #1746b0,0 5px 12px rgba(16,47,112,.4)}
.pf-root textarea{display:block;width:100%;min-height:112px;padding:12px 16px;border:2px solid #e3d3a4;border-radius:14px;background:#fff;color:#23284a;font-size:16px;line-height:1.7;font-family:inherit;resize:vertical;outline:none;box-shadow:inset 0 2px 4px rgba(120,80,20,.08)}
.pf-root textarea:focus{border-color:#2a4aa6;box-shadow:0 0 0 3px rgba(42,74,166,.16)}
.pf-root textarea::placeholder{color:#a79f8e}
.pf-hint{margin-top:6px;font-size:12.5px;font-weight:700;color:#7a6a45;line-height:1.6}
.pf-drop{width:100%;display:flex;flex-direction:column;align-items:center;gap:2px;padding:16px 10px;min-height:92px;border:2.5px dashed #d9b85a;border-radius:14px;background:#fffdf7;color:#17397d;cursor:pointer;font-family:inherit}
.pf-drop span{width:34px;height:34px;border-radius:50%;background:linear-gradient(180deg,#3b78e0,#1746b0);color:#fff;font-size:17px;display:flex;align-items:center;justify-content:center;border:2px solid #f5d77e}
.pf-drop b{font-size:15px;font-weight:900;margin-top:4px}
.pf-drop em{font-style:normal;font-size:12px;font-weight:700;color:#8a7a55}
.pf-photo{display:flex;gap:12px;align-items:center;padding:10px;border:2.5px solid #e2c98c;border-radius:14px;background:#fff;min-width:0}
.pf-photo>img{width:96px;height:96px;object-fit:cover;border-radius:10px;border:2px solid #e2bf63;flex-shrink:0}
.pf-photo-i{min-width:0;flex:1}
.pf-photo-i b{display:block;font-size:13px;color:#23284a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pf-photo-i div{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.pf-photo-i button{min-height:44px;padding:6px 14px;border:2px solid #7f95d6;border-radius:999px;background:#fff;color:#17397d;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit}
.pf-photo-i button.x{border-color:#e6b3b3;color:#a33a3a}
.pf-err{margin-bottom:12px;padding:10px 14px;border:2px solid #f0a9b5;border-radius:12px;background:#fff5f5;color:#9f1d38;font-size:13.5px;font-weight:800;line-height:1.6;word-break:break-word}
.pf-done{position:relative;margin-bottom:12px;padding:13px 16px;border:2.5px solid #e2bf63;border-radius:14px;background:linear-gradient(180deg,#f2fff5,#dff6e6);color:#14602f;font-size:14.5px;font-weight:900;text-align:center;line-height:1.6;animation:pf-pop .45s ease}
.pf-done .s{position:absolute;color:#f1c84e;font-size:18px;animation:pf-tw 1.3s ease-in-out 3;text-shadow:0 0 6px #fff}
.pf-done .s1{left:10px;top:-11px}.pf-done .s2{right:14px;top:-9px;animation-delay:.25s}.pf-done .s3{right:38%;bottom:-11px;animation-delay:.5s}
@keyframes pf-pop{from{transform:scale(.94);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes pf-tw{0%,100%{transform:scale(.6) rotate(0);opacity:.4}50%{transform:scale(1.35) rotate(40deg);opacity:1}}
.pf-submit{display:block;width:100%;max-width:520px;margin:4px auto 0;min-height:60px;padding:12px 20px;border:3px solid #f5d77e;border-radius:999px;background:linear-gradient(180deg,#3b78e0,#1746b0 55%,#12358f);color:#fff;font-size:19px;font-weight:900;letter-spacing:.08em;cursor:pointer;box-shadow:inset 0 2px 0 rgba(255,255,255,.3),0 8px 18px rgba(16,47,112,.4);font-family:inherit;text-shadow:0 2px 3px rgba(10,25,70,.5)}
.pf-submit:disabled{background:linear-gradient(180deg,#8f9bb8,#6b7896);border-color:#d8d2bd;cursor:not-allowed;font-size:15px;letter-spacing:0}
.pf-root button:disabled,.pf-root select:disabled,.pf-root textarea:disabled{opacity:.75}
.pf-submit:disabled{opacity:1}
.pf-h2{display:flex;align-items:center;gap:8px;margin:26px 0 12px}
.pf-h2 img{width:50px;height:auto;flex-shrink:0;margin-right:-22px;position:relative;z-index:1;filter:drop-shadow(0 3px 5px rgba(16,47,112,.3))}
.pf-h2 h2{margin:0;padding:8px 24px 8px 30px;background:linear-gradient(180deg,#2a4aa6,#172f78);border:2px solid #f1cf6b;border-radius:10px 22px 22px 10px;color:#fff;font-size:17px;font-weight:900;letter-spacing:.05em;white-space:nowrap;box-shadow:0 5px 12px rgba(16,47,112,.3)}
.pf-h2 span{flex:1;height:2px;background:linear-gradient(90deg,#e2bf63,rgba(226,191,99,0))}
.pf-empty{background:rgba(255,253,246,.94);border:2px solid #ecd9a6;border-radius:14px;padding:18px;text-align:center;font-size:14px;font-weight:800;color:#6b5a33}
.pf-list{display:flex;flex-direction:column;gap:10px}
.pf-card{background:linear-gradient(180deg,#fffefa,#fbf2de);border:2.5px solid #ecd9a6;border-radius:16px;padding:12px 16px;box-shadow:0 4px 10px rgba(16,47,112,.16);min-width:0}
.pf-card-h{display:flex;align-items:center;gap:10px;justify-content:space-between}
.pf-card-t{min-width:0;font-size:15.5px;font-weight:900;color:#1b2a5e;line-height:1.5;overflow-wrap:anywhere}
.pf-card-t img{width:26px;height:26px;object-fit:contain;vertical-align:-6px;margin-right:6px}
.pf-st{flex-shrink:0;display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:900;white-space:nowrap}
.pf-st.ok{background:linear-gradient(180deg,#34b45e,#1a8a41);color:#fff;border:2px solid #f1cf6b;box-shadow:0 2px 5px rgba(20,96,47,.35)}
.pf-st.ok{padding-left:5px}
.pf-st.ok img{width:24px;height:26px;object-fit:contain;margin:-6px 0}
.pf-st.wait{background:#fff4d6;color:#8a5a00;border:2px solid #e9b949}
.pf-st.wait::before{content:"⏳"}
.pf-st.ng{background:#fdecec;color:#a33a3a;border:2px solid #e6b3b3}
.pf-st.ng::before{content:"↩"}
.pf-card-b{display:flex;gap:12px;margin-top:8px;align-items:flex-start}
.pf-thumb{flex-shrink:0;width:72px;height:72px;padding:0;border:2px solid #e2bf63;border-radius:10px;overflow:hidden;background:#fff;cursor:pointer}
.pf-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.pf-card-m{min-width:0;flex:1}
.pf-card-m p{margin:0;font-size:14px;font-weight:600;line-height:1.7;color:#3b3524;white-space:pre-wrap;overflow-wrap:anywhere}
.pf-card-m time{display:block;margin-top:4px;font-size:12px;font-weight:700;color:#8a7a55}
.pf-more{align-self:center;min-height:48px;padding:8px 26px;border:2.5px solid #7f95d6;border-radius:999px;background:#fff;color:#17397d;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 3px 8px rgba(16,47,112,.2)}
.pf-zoom{position:fixed;inset:0;z-index:300;background:rgba(10,25,70,.82);display:flex;align-items:center;justify-content:center;padding:16px}
.pf-zoom img{max-width:100%;max-height:100%;border-radius:12px;border:3px solid #f1cf6b}
.pf-zoom button{position:absolute;top:14px;right:14px;width:46px;height:46px;border-radius:50%;border:2px solid #e2bf63;background:#fff;color:#17397d;font-size:17px;font-weight:900;cursor:pointer}
.pf-nav{position:fixed;left:0;bottom:0;width:100%;max-width:100vw;z-index:50;display:flex;height:calc(86px + env(safe-area-inset-bottom));padding:0 10px calc(10px + env(safe-area-inset-bottom));overflow:hidden}
.pf-nav .band{position:absolute;inset:6px 8px calc(8px + env(safe-area-inset-bottom));background:url(/home/nav_bar.webp);background-size:100% 100%;pointer-events:none}
.pf-nav button{position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;padding-bottom:calc(17px + env(safe-area-inset-bottom));background:transparent;border:none;cursor:pointer;color:#fff;font-family:inherit}
.pf-nav img{height:30px}
.pf-nav span{font-size:20px;line-height:30px}
.pf-nav i{font-style:normal;font-size:10.5px;font-weight:800}
@media (max-width:640px){
  .pf-lead{padding:9px 12px;text-align:left}
  .pf-lead b{font-size:14px}
  .pf-lead p{font-size:12.5px;line-height:1.7}
  .pf-panel{padding:16px 13px 18px;border-radius:18px}
  .pf-field{margin-bottom:16px}
  .pf-cats{gap:8px}
  .pf-cat{padding:7px 12px 7px 9px;font-size:14.5px}
  .pf-submit{max-width:none}
  .pf-card{padding:11px 12px}
  .pf-card-h{align-items:flex-start}
}
@media (max-width:350px){
  .pf-cat{padding:8px 11px;font-size:14px}
  .pf-photo>img{width:76px;height:76px}
  .pf-thumb{width:60px;height:60px}
}
@media (prefers-reduced-motion: reduce){ .pf-done,.pf-done .s{animation:none} }
`;
