"use client";
// 一人前チャレンジ。見た目を王国RPG調にしただけで、データの読み書きは従来のまま：
// ・項目＝rookie_challenges（block / title / description / requires_photo）。ここでは項目の内容を一切書き換えない
// ・提出＝rookie_submissions に status:"pending" で追加（エピソード必須、写真は項目ごとに必須）→ 管理者の承認で達成（approved）
// ・取り消し＝自分のその項目の提出を削除（従来どおり、達成済みの項目だけ取り消せる）
// ・ポイント・EXP・レベルには一切影響しない
// 説明文：description＝何をする？。「なぜ必要？」（why）と「達成条件」（condition）の列が登録されていれば表示し、無い項目は出さない（文章を作らない）
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import AvatarLayered from "../components/AvatarLayered";

type Rookie = {
    id: string; block: string; title: string; description: string | null; order_no: number; requires_photo: boolean; is_active: boolean;
    why?: string | null; condition?: string | null; icon?: string | null;
};
type Submission = { id: string; user_id: string; challenge_id: string; comment: string | null; image_url: string | null; status: string; created_at: string };

const IMG = { ribbon: "/rookie/title_ribbon.webp", done: "/rookie/done_emblem.webp", quill: "/rookie/section_quill.webp" };
// カテゴリ（既存の block の値はそのまま。表示名・説明・アイコンだけ定義）
const BLOCKS: { key: string; label: string; desc: string; img: string }[] = [
    { key: "①コミュ基礎", label: "コミュ基礎", desc: "仲間との信頼関係を築くための基本を身につけよう", img: "/rookie/cat_comm.webp" },
    { key: "②研修・同行", label: "研修・同行", desc: "研修と先輩への同行を通して仕事の基礎を学ぼう", img: "/rookie/cat_training.webp" },
    { key: "③初稼働まで", label: "初稼働まで", desc: "準備を整え、初めての現場に挑戦しよう", img: "/rookie/cat_first.webp" },
    { key: "⑤中間チャレンジ", label: "中間チャレンジ", desc: "学んだことを実践し、次の成長を目指そう", img: "/rookie/cat_mid.webp" },
    { key: "④人間力", label: "人間力", desc: "周囲から信頼される社会人としての姿勢を磨こう", img: "/rookie/cat_human.webp" },
];
const fmtDate = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };

export default function RookiePage() {
    const router = useRouter();
    const [userId, setUserId] = useState("");
    const [items, setItems] = useState<Rookie[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [me, setMe] = useState<{ cfg: any; job: string } | null>(null);
    const [selected, setSelected] = useState<Rookie | null>(null);
    const [comment, setComment] = useState("");
    const [image, setImage] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState("");
    const [toast, setToast] = useState("");
    const [askUndo, setAskUndo] = useState(false);
    const [activeBlock, setActiveBlock] = useState("①コミュ基礎");
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const [{ data: itemRows }, { data: subRows }, { data: prof }] = await Promise.all([
                supabase.from("rookie_challenges").select("*").eq("is_active", true).order("order_no"),
                supabase.from("rookie_submissions").select("*").eq("user_id", user.id),
                supabase.from("profiles").select("job_class, avatar_config").eq("id", user.id).maybeSingle(),
            ]);
            setItems((itemRows || []) as Rookie[]);
            setSubmissions((subRows || []) as Submission[]);
            const ac = (prof as any)?.avatar_config;
            setMe({ cfg: ac && ac.type === "layered" ? ac : null, job: (prof as any)?.job_class || "knight" });
            setLoading(false);
        };
        load();
    }, [router]);

    const getSubmission = (itemId: string) => {
        const subs = submissions.filter(s => s.challenge_id === itemId);
        return subs.find(s => s.status === "approved") || subs.find(s => s.status === "pending") || subs[0];
    };
    const closeDetail = () => { setSelected(null); setComment(""); setImage(null); setPreview(null); setMessage(""); setAskUndo(false); };

    const handleFileSelect = (file: File) => {
        if (!file.type.startsWith("image/")) return;
        setImage(file);
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        if (!selected || sending) return;
        // エピソード（コメント）は全項目必須
        if (!comment.trim()) { setMessage("エピソードを入力してください（いつ・どんな場面で）"); return; }
        // 写真対象の項目は写真も必須
        if (selected.requires_photo && !image) { setMessage("この項目は写真の提出が必要です"); return; }
        setSending(true);
        setMessage("");

        let imageUrl: string | null = null;
        if (image) {
            const ext = image.name.split(".").pop();
            const filePath = `rookie/${userId}/${selected.id}.${ext}`;
            const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, image, { upsert: true });
            if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
                imageUrl = publicUrl;
            }
        }
        // 提出すると「承認待ち」。管理者の承認で達成になる
        const { error } = await supabase.from("rookie_submissions").insert({ user_id: userId, challenge_id: selected.id, comment: comment.trim(), image_url: imageUrl, status: "pending" });
        if (error) { setMessage("提出できませんでした。もう一度お試しください"); setSending(false); return; }
        const { data: subRows } = await supabase.from("rookie_submissions").select("*").eq("user_id", userId);
        setSubmissions((subRows || []) as Submission[]);
        setSending(false);
        closeDetail();
        setToast("📨 提出しました！承認をお待ちください"); setTimeout(() => setToast(""), 3500);
    };

    // 達成の取り消し
    const handleUndo = async (itemId: string) => {
        if (sending) return;
        setSending(true);
        await supabase.from("rookie_submissions").delete().eq("user_id", userId).eq("challenge_id", itemId);
        const { data: subRows } = await supabase.from("rookie_submissions").select("*").eq("user_id", userId);
        setSubmissions((subRows || []) as Submission[]);
        setSending(false);
        closeDetail();
        setToast("達成を取り消しました"); setTimeout(() => setToast(""), 3000);
    };

    if (loading) return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#bfe3f5", color: "#17397d", fontWeight: 900 }}>📜 チャレンジを読み込んでいます...</main>;

    const itemIds = new Set(items.map((i) => i.id));
    const doneIds = new Set(submissions.filter((s) => s.status === "approved" && itemIds.has(s.challenge_id)).map((s) => s.challenge_id));
    const completedCount = doneIds.size;
    const totalCount = items.length;
    const rate = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
    const blockItems = items.filter(i => i.block === activeBlock).sort((a, b) => a.order_no - b.order_no);
    const blockDef = BLOCKS.find(b => b.key === activeBlock) || BLOCKS[0];
    const how = (it: Rookie) => (it.requires_photo ? "📷 写真＋エピソード" : "✏️ エピソード");
    const statusOf = (it: Rookie) => { const s = getSubmission(it.id); return s?.status === "approved" ? "done" : s?.status === "pending" ? "pending" : "todo"; };

    const sel = selected; const selSub = sel ? getSubmission(sel.id) : null; const selStatus = sel ? statusOf(sel) : "todo";

    return (
        <main className="rk-root">
            <style>{CSS}</style>
            <div className="rk-wrap">
                <header className="rk-top">
                    <div className="rk-hero">
                        <div className="rk-ava" onClick={() => router.push("/onboarding/avatar?from=mypage")}>
                            {me?.cfg ? <AvatarLayered config={me.cfg} job={me.job as any} size="100%" /> : <img src={`/jobs/${me?.job || "knight"}.webp`} alt="" style={{ width: "100%", display: "block" }} />}
                        </div>
                        <div className="rk-heromid">
                            <div className="rk-ribbon"><img src={IMG.ribbon} alt="" /><h1>一人前チャレンジ</h1></div>
                            <div className="rk-sub">新人から“一人前”を目指す、はじめのチャレンジ</div>
                            <p className="rk-lead">インターンに必要な基本姿勢やコミュニケーション、研修・初稼働までのステップを、ミッションを通して身につけよう！<span>小さな行動を積み重ね、できることを一つずつ増やして、一人前の冒険者を目指そう。</span></p>
                        </div>
                    </div>
                    <div className="rk-prog">
                        <div className="rk-prog-h"><span>🏆 達成状況</span><b>{completedCount}<i> / {totalCount}</i></b></div>
                        <div className="rk-bar"><div style={{ width: `${rate}%` }} /></div>
                        <div className="rk-rate">達成率 {rate}%</div>
                    </div>
                </header>

                <nav className="rk-tabs">
                    {BLOCKS.map((b) => {
                        const total = items.filter(i => i.block === b.key).length;
                        const done = items.filter(i => i.block === b.key && doneIds.has(i.id)).length;
                        return (
                            <button key={b.key} className={"rk-tab" + (activeBlock === b.key ? " on" : "")} onClick={() => setActiveBlock(b.key)}>
                                <img src={b.img} alt="" /><span>{b.label}</span><i>{done}/{total}</i>
                            </button>
                        );
                    })}
                </nav>

                <section className="rk-panel">
                    <div className="rk-panel-h"><img src={IMG.quill} alt="" /><h2>{blockDef.label}</h2><p>{blockDef.desc}</p></div>
                    {blockItems.length === 0 && <div className="rk-empty">このカテゴリの項目はまだありません</div>}
                    <div className="rk-grid">
                        {blockItems.map((it) => {
                            const st = statusOf(it);
                            return (
                                <button key={it.id} className={"rk-card rk-" + st} onClick={() => { setMessage(""); setAskUndo(false); setSelected(it); }}>
                                    <img className="rk-ico" src={blockDef.img} alt="" />
                                    <span className="rk-cmid">
                                        <span className="rk-ctitle">{it.title}</span>
                                        {it.description && <span className="rk-cdesc">{it.description}</span>}
                                        <span className="rk-cfoot"><em>{how(it)}</em>{st === "done" ? <b className="g">達成済み</b> : st === "pending" ? <b className="p">⏳ 承認待ち</b> : <b className="t">挑戦する ›</b>}</span>
                                    </span>
                                    {st === "done" && <img className="rk-emb" src={IMG.done} alt="達成" />}
                                </button>
                            );
                        })}
                    </div>
                </section>
            </div>

            {/* ミッション詳細（スマホ＝下から開くシート／PC＝中央のウィンドウ） */}
            {sel && (
                <div className="rk-bg" onClick={() => !sending && closeDetail()}>
                    <div className="rk-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                        <div className="rk-sheet-h">
                            <img src={blockDef.img} alt="" />
                            <div><small>{blockDef.label}</small><h3>{sel.title}</h3></div>
                            <button className="rk-x" onClick={closeDetail} aria-label="とじる">✕</button>
                        </div>
                        <div className="rk-scroll">
                            <div className={"rk-state rk-" + selStatus}>
                                {selStatus === "done" ? <><img src={IMG.done} alt="" />達成済み{selSub && <i>{fmtDate(selSub.created_at)} 提出</i>}</> : selStatus === "pending" ? <>⏳ 承認待ち{selSub && <i>{fmtDate(selSub.created_at)} 提出</i>}</> : <>まだ挑戦していません</>}
                            </div>
                            {sel.description && <div className="rk-sec"><b>🧭 何をする？</b><p>{sel.description}</p></div>}
                            {sel.why && <div className="rk-sec"><b>💡 なぜ必要？</b><p>{sel.why}</p></div>}
                            {sel.condition && <div className="rk-sec"><b>✅ 達成条件</b><p>{sel.condition}</p></div>}
                            <div className="rk-sec"><b>📮 提出方法</b><p>{sel.requires_photo ? "写真とエピソード（いつ・どんな場面で行ったか）を提出します。" : "エピソード（いつ・どんな場面で行ったか）を提出します。"}提出後、承認されると達成になります。</p></div>

                            {selSub && (
                                <div className="rk-sec rk-past"><b>📝 あなたの提出内容</b>
                                    {selSub.comment && <p>{selSub.comment}</p>}
                                    {selSub.image_url && <img src={selSub.image_url} alt="提出した写真" />}
                                </div>
                            )}

                            {selStatus === "todo" && (
                                <div className="rk-form">
                                    {sel.requires_photo && (
                                        <div className="rk-photo">
                                            <span>📷 写真（必須）</span>
                                            {preview
                                                ? <div className="rk-prev"><img src={preview} alt="preview" /><button onClick={() => { setImage(null); setPreview(null); }} aria-label="写真を外す">✕</button></div>
                                                : <button className="rk-pick" onClick={() => fileInputRef.current?.click()}>📷 写真をえらぶ</button>}
                                            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
                                        </div>
                                    )}
                                    <label><span>✏️ エピソード（必須）</span>
                                        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} placeholder="いつ・どんな場面で行ったかを書いてください" />
                                    </label>
                                    {message && <div className="rk-msg">⚠️ {message}</div>}
                                    <button className="rk-btn" disabled={sending} onClick={handleSubmit}>{sending ? "送信中..." : "提出する"}</button>
                                </div>
                            )}
                            {selStatus === "pending" && <div className="rk-note">承認されると「達成済み」になります。承認までしばらくお待ちください。</div>}
                            {selStatus === "done" && (askUndo
                                ? <div className="rk-ask"><b>この達成を取り消しますか？</b><p>提出した写真とエピソードの記録も消えます。</p><div><button className="rk-btn sub" disabled={sending} onClick={() => setAskUndo(false)}>やめる</button><button className="rk-btn red" disabled={sending} onClick={() => handleUndo(sel.id)}>{sending ? "処理中..." : "取り消す"}</button></div></div>
                                : <button className="rk-undo" onClick={() => setAskUndo(true)}>達成を取り消す</button>)}
                        </div>
                    </div>
                </div>
            )}

            {/* 下部ナビ（HOMEと同じ4項目） */}
            <div className="rk-nav">
                <div className="band" />
                {[{ k: "home", l: "ホーム", h: "/home", img: "/home/nav_home_active.webp" }, { k: "rank", l: "ランキング", h: "/ranking", img: "/home/nav_trophy.webp" }, { k: "house", l: "おうち", h: "/mypage", img: "/home/nav_house.webp" }, { k: "menu", l: "メニュー", h: "/menu", img: "" }].map((t) => (
                    <button key={t.k} onClick={() => router.push(t.h)}>{t.img ? <img src={t.img} alt="" /> : <span>☰</span>}<i>{t.l}</i></button>
                ))}
            </div>
            {toast && <div className="rk-toast">{toast}</div>}
        </main>
    );
}

const CSS = `
.rk-root{min-height:100vh;min-height:100dvh;overflow-x:clip;background:url(/home/bg_mobile.webp) center top / cover no-repeat fixed,#bfe3f5;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416;padding:12px 12px calc(104px + env(safe-area-inset-bottom));box-sizing:border-box}
@media (min-width:700px){ .rk-root{background-image:url(/home/bg_pc.webp)} }
.rk-wrap{max-width:1180px;margin:0 auto}
.rk-top{display:flex;gap:16px;align-items:stretch}
.rk-hero{flex:1;min-width:0;display:flex;gap:6px;align-items:flex-start}
.rk-ava{flex-shrink:0;width:180px;cursor:pointer;margin-top:0;filter:drop-shadow(0 6px 10px rgba(16,47,112,.3))}
.rk-heromid{flex:1;min-width:0}
.rk-ribbon{position:relative;max-width:560px;margin:0 auto;container-type:inline-size}
.rk-ribbon img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 12px rgba(16,47,112,.35))}
.rk-ribbon h1{position:absolute;left:31%;right:17%;top:26%;bottom:28%;margin:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:clamp(15px,5.5cqw,31px);font-weight:900;letter-spacing:.04em;text-shadow:0 2px 4px rgba(10,25,70,.6);white-space:nowrap}
.rk-sub{width:fit-content;max-width:100%;margin:-10px auto 0;position:relative;background:linear-gradient(180deg,#fffdf6,#f3e9d2);border:2px solid #e2c98c;border-radius:6px;padding:5px 26px;font-size:13.5px;font-weight:900;color:#4a3b1c;box-shadow:0 4px 10px rgba(16,47,112,.2);text-align:center}
.rk-lead{margin:10px 0 0;background:rgba(255,253,246,.94);border:2px solid #e2bf63;border-radius:16px;padding:10px 16px;font-size:13px;font-weight:700;line-height:1.75;color:#3b3524;box-shadow:0 6px 14px rgba(16,47,112,.18)}
.rk-lead span{display:block}
.rk-prog{flex:0 0 340px;align-self:center;background:linear-gradient(180deg,#fffdf6,#f8eed8);border:3px solid #e2bf63;border-radius:20px;padding:16px 20px;box-shadow:inset 0 0 0 2px #fff,0 10px 24px rgba(16,47,112,.28)}
.rk-prog-h{display:flex;align-items:baseline;justify-content:space-between;gap:8px;border-bottom:2px solid rgba(226,191,99,.5);padding-bottom:8px}
.rk-prog-h span{font-size:16px;font-weight:900;color:#2a2f52}
.rk-prog-h b{font-size:34px;font-weight:900;color:#6d3fe0;line-height:1}
.rk-prog-h i{font-style:normal;font-size:18px;color:#7a6f58}
.rk-bar{height:22px;border-radius:999px;background:#e3e1ea;margin-top:12px;overflow:hidden;box-shadow:inset 0 2px 4px rgba(0,0,0,.15)}
.rk-bar div{height:100%;border-radius:999px;background:linear-gradient(90deg,#8b5cf6,#3b82f6);transition:width .6s ease;min-width:0}
.rk-rate{margin-top:6px;text-align:right;font-size:12px;font-weight:900;color:#6b5a33}
.rk-tabs{display:flex;gap:10px;margin-top:16px;justify-content:center;flex-wrap:wrap}
.rk-tab{display:inline-flex;align-items:center;gap:7px;border:3px solid #7f95d6;background:linear-gradient(180deg,#2a4aa6,#172f78);color:#fff;border-radius:999px;padding:7px 16px 7px 10px;font-size:14.5px;font-weight:900;cursor:pointer;min-height:50px;white-space:nowrap;box-shadow:0 5px 12px rgba(16,47,112,.35);font-family:inherit}
.rk-tab img{width:32px;height:32px;object-fit:contain}
.rk-tab i{font-style:normal;font-size:13px;color:#cfdcff}
.rk-tab.on{border-color:#F5D77E;background:linear-gradient(180deg,#4f8dfa,#2059d6);box-shadow:0 0 0 2px rgba(255,255,255,.4) inset,0 0 22px rgba(90,160,255,.95),0 5px 12px rgba(16,47,112,.4)}
.rk-tab.on i{color:#fff}
.rk-panel{margin-top:14px;background:linear-gradient(180deg,rgba(255,253,246,.97),rgba(250,241,220,.97));border:3px solid #e2bf63;border-radius:20px;padding:16px 18px 20px;box-shadow:inset 0 0 0 2px #fff,0 12px 30px rgba(16,47,112,.28)}
.rk-panel-h{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.rk-panel-h img{width:52px;height:52px;object-fit:contain}
.rk-panel-h h2{margin:0;font-size:25px;font-weight:900;color:#17307a;letter-spacing:2px}
.rk-panel-h p{margin:0;font-size:13.5px;font-weight:700;color:#5b4a23;border-left:2px solid #e2bf63;padding-left:12px}
.rk-empty{text-align:center;font-size:13px;font-weight:800;color:#8a7f66;padding:24px 0}
.rk-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.rk-card{position:relative;display:flex;align-items:flex-start;gap:10px;text-align:left;background:linear-gradient(180deg,#fffefa,#fbf2de);border:2.5px solid #ecd9a6;border-radius:14px;padding:12px 44px 10px 12px;cursor:pointer;min-height:92px;box-shadow:0 3px 8px rgba(120,80,20,.14);transition:transform .15s,box-shadow .15s;font-family:inherit;min-width:0}
.rk-card:hover{transform:translateY(-3px);box-shadow:0 8px 16px rgba(120,80,20,.22)}
.rk-card.rk-done{border-color:#e2bf63;box-shadow:0 0 0 2px rgba(245,215,126,.55),0 3px 10px rgba(180,130,20,.25)}
.rk-card.rk-pending{border-color:#f3c96a;background:linear-gradient(180deg,#fffdf2,#fdf1cf)}
.rk-ico{width:36px;height:36px;object-fit:contain;flex-shrink:0;margin-top:1px}
.rk-cmid{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.rk-ctitle{font-size:15px;font-weight:900;color:#17307a;line-height:1.4;overflow-wrap:anywhere}
.rk-cdesc{font-size:12px;font-weight:700;color:#6b5a33;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}
.rk-cfoot{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:3px;font-size:11.5px;font-weight:900}
.rk-cfoot em{font-style:normal;color:#6d3fe0}
.rk-cfoot b.g{color:#15803d}.rk-cfoot b.p{color:#b45309}.rk-cfoot b.t{color:#1454B8}
.rk-emb{position:absolute;top:8px;right:6px;width:36px;height:auto}
.rk-bg{position:fixed;inset:0;z-index:300;background:rgba(16,47,112,.55);display:flex;align-items:center;justify-content:center;padding:18px}
.rk-sheet{width:100%;max-width:520px;max-height:88dvh;display:flex;flex-direction:column;background:linear-gradient(180deg,#fffdf6,#f8eed8);border:3px solid #e2bf63;border-radius:22px;box-shadow:0 18px 50px rgba(10,20,60,.5);animation:rkUp .25s ease-out}
@keyframes rkUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}
.rk-sheet-h{display:flex;align-items:center;gap:10px;padding:12px 12px 10px 14px;border-bottom:2px dashed rgba(226,191,99,.6)}
.rk-sheet-h>img{width:40px;height:40px;object-fit:contain;flex-shrink:0}
.rk-sheet-h>div{flex:1;min-width:0}
.rk-sheet-h small{display:block;font-size:11px;font-weight:900;color:#8a6a3a}
.rk-sheet-h h3{margin:0;font-size:17.5px;font-weight:900;color:#17307a;line-height:1.4;overflow-wrap:anywhere}
.rk-x{width:44px;height:44px;border-radius:50%;border:2px solid #e2bf63;background:#fff;color:#17397d;font-size:17px;font-weight:900;cursor:pointer;flex-shrink:0;font-family:inherit}
.rk-scroll{overflow-y:auto;padding:12px 14px calc(16px + env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch}
.rk-state{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-radius:12px;padding:9px 12px;font-size:13.5px;font-weight:900;background:#eef2ff;color:#3b4a7a;margin-bottom:10px}
.rk-state img{width:28px;height:auto}
.rk-state i{font-style:normal;font-size:11.5px;font-weight:800;margin-left:auto;opacity:.8}
.rk-state.rk-done{background:#e7f8ec;color:#166534}
.rk-state.rk-pending{background:#fff4d6;color:#92400e}
.rk-sec{background:#fff;border:2px solid #efe2c0;border-radius:12px;padding:10px 12px;margin-bottom:8px}
.rk-sec b{display:block;font-size:12.5px;font-weight:900;color:#1454B8;margin-bottom:3px}
.rk-sec p{margin:0;font-size:14px;line-height:1.75;color:#3b3524;white-space:pre-wrap;overflow-wrap:anywhere}
.rk-past img{display:block;max-width:100%;max-height:220px;border-radius:10px;margin-top:8px}
.rk-form{margin-top:10px;display:flex;flex-direction:column;gap:10px}
.rk-form label span,.rk-photo>span{display:block;font-size:12.5px;font-weight:900;color:#5b4a23;margin-bottom:5px}
.rk-form textarea{width:100%;box-sizing:border-box;border:2px solid #e3dccb;border-radius:11px;padding:10px 12px;font-size:16px;line-height:1.7;font-family:inherit;resize:vertical;background:#fff;color:#23284a}
.rk-pick{width:100%;border:2px dashed #b9a2f2;background:#f7f3ff;color:#6d3fe0;font-weight:900;font-size:14px;border-radius:11px;padding:18px 10px;cursor:pointer;min-height:56px;font-family:inherit}
.rk-prev{position:relative}
.rk-prev img{display:block;width:100%;max-height:200px;object-fit:cover;border-radius:11px}
.rk-prev button{position:absolute;top:8px;right:8px;width:36px;height:36px;border-radius:50%;border:none;background:rgba(0,0,0,.6);color:#fff;font-size:15px;cursor:pointer}
.rk-msg{background:#fdecee;border:2px solid #f0a9b5;color:#9f1d38;font-weight:900;font-size:13px;border-radius:11px;padding:9px 12px}
.rk-btn{border:3px solid #F5D77E;background:linear-gradient(180deg,#3b78e0,#1454B8);color:#fff;font-weight:900;font-size:15.5px;border-radius:999px;padding:12px 20px;cursor:pointer;min-height:50px;box-shadow:0 5px 12px rgba(16,47,112,.3);font-family:inherit}
.rk-btn.sub{background:linear-gradient(180deg,#fffdf4,#f1e1bd);color:#17397d;border-color:#D9A441;box-shadow:none}
.rk-btn.red{background:linear-gradient(180deg,#ef4444,#b91c1c)}
.rk-btn:disabled{opacity:.6;cursor:not-allowed}
.rk-note{margin-top:8px;background:#fff8e6;border:2px solid #f3d489;border-radius:12px;padding:10px 12px;font-size:13px;font-weight:800;color:#7a5a12}
.rk-undo{display:block;margin:12px auto 0;border:none;background:none;color:#8a6a3a;font-size:13px;font-weight:900;text-decoration:underline;cursor:pointer;min-height:44px;font-family:inherit}
.rk-ask{margin-top:10px;background:#fff;border:2px solid #f0a9b5;border-radius:14px;padding:12px;text-align:center}
.rk-ask b{font-size:14.5px;color:#9f1d38}
.rk-ask p{margin:4px 0 10px;font-size:12.5px;font-weight:700;color:#5b4a23}
.rk-ask div{display:flex;gap:8px}
.rk-ask .rk-btn{flex:1;padding:11px 8px}
.rk-nav{position:fixed;left:0;bottom:0;width:100%;max-width:100vw;box-sizing:border-box;z-index:50;display:flex;height:calc(86px + env(safe-area-inset-bottom));padding:0 10px calc(10px + env(safe-area-inset-bottom));overflow:hidden}
.rk-nav .band{position:absolute;inset:6px 8px calc(8px + env(safe-area-inset-bottom));background:url(/home/nav_bar.webp);background-size:100% 100%;pointer-events:none}
.rk-nav button{position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;padding-bottom:calc(17px + env(safe-area-inset-bottom));background:transparent;border:none;cursor:pointer;color:#fff;font-family:inherit}
.rk-nav img{height:30px}
.rk-nav span{font-size:20px;line-height:30px}
.rk-nav i{font-style:normal;font-size:10.5px;font-weight:800}
.rk-toast{position:fixed;left:50%;bottom:calc(100px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:400;background:#166534;color:#fff;font-size:13.5px;font-weight:900;border-radius:999px;padding:11px 20px;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:92vw;text-align:center}
@media (max-width:1023px){
  .rk-top{flex-direction:column;gap:10px}
  .rk-prog{flex:none;align-self:stretch;padding:10px 14px}
  .rk-prog-h b{font-size:26px}
  .rk-bar{height:16px;margin-top:8px}
  .rk-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rk-tabs{flex-wrap:nowrap;justify-content:flex-start;overflow-x:auto;padding:4px 2px 8px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
  .rk-tabs::-webkit-scrollbar{display:none}
  .rk-tab{flex-shrink:0}
}
@media (max-width:640px){
  .rk-root{padding:8px 8px calc(104px + env(safe-area-inset-bottom))}
  .rk-ava{width:74px;margin-top:0}
  .rk-sub{font-size:11px;padding:4px 10px;margin-top:-6px}
  .rk-lead{font-size:12px;padding:8px 12px;line-height:1.65;margin-left:-80px}
  .rk-lead span{display:none}
  .rk-tab{font-size:13px;padding:6px 12px 6px 8px;min-height:46px}
  .rk-tab img{width:26px;height:26px}
  .rk-panel{padding:12px 10px 14px}
  .rk-panel-h img{width:38px;height:38px}
  .rk-panel-h h2{font-size:20px}
  .rk-panel-h p{font-size:12px;border-left:none;padding-left:0;flex-basis:100%}
  .rk-grid{grid-template-columns:1fr;gap:9px}
  .rk-card{min-height:76px}
  .rk-bg{align-items:flex-end;padding:0}
  .rk-sheet{max-width:none;border-radius:22px 22px 0 0;border-bottom:none;max-height:90dvh}
}
@media (prefers-reduced-motion: reduce){ .rk-sheet{animation:none} .rk-bar div{transition:none} }
`;
