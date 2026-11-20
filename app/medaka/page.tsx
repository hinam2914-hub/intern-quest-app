"use client";
// メダカBOX（冒険者の意見箱）。見た目を変えただけで、データは従来のまま：
// ・投稿＝medaka_box（新しい順100件）／いいね＝medaka_likes＋medaka_box.like_count／解決案＝medaka_comments
// ・画面には投稿者を一切出さない（「匿名のメダカさん」固定）
// ・ステータス変更のボタンは管理者だけに表示。実際に変更できるかはDB側の権限（RLS）が決める
// ・画像は既存素材だけ（HOMEの背景、就活ボックスのタイトル枠、総合ESの本とランタン・羽根ペン）

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

interface Post {
    id: string;
    post_type: string;
    title: string;
    body: string;
    status: string;
    admin_response: string | null;
    like_count: number;
    created_at: string;
}

const STATUS = [
    { key: "open", label: "受付中" },
    { key: "acknowledged", label: "確認済み" },
    { key: "resolved", label: "解決済み" },
];
const day = (iso: string) => new Date(iso).toLocaleDateString("ja-JP", { month: "short", day: "numeric" });

export default function MedakaPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState("");
    const [posts, setPosts] = useState<Post[]>([]);
    const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState<"all" | "opinion" | "issue">("all");
    const [showForm, setShowForm] = useState(false);
    const [postType, setPostType] = useState<"opinion" | "issue">("opinion");
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [comments, setComments] = useState<Record<string, { id: string; body: string; created_at: string }[]>>({});
    const [openCommentPostId, setOpenCommentPostId] = useState<string | null>(null);
    const [commentText, setCommentText] = useState("");
    const [commentSubmitting, setCommentSubmitting] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [formErr, setFormErr] = useState("");
    const [notice, setNotice] = useState("");
    const [busyLike, setBusyLike] = useState<Record<string, boolean>>({});
    const [busyStatus, setBusyStatus] = useState("");
    const lock = useRef<Record<string, boolean>>({});

    const loadData = useCallback(async (uid: string) => {
        const { data: postData } = await supabase
            .from("medaka_box")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100);
        setPosts((postData || []) as Post[]);
        const { data: likeData } = await supabase
            .from("medaka_likes")
            .select("post_id")
            .eq("user_id", uid);
        setLikedIds(new Set((likeData || []).map((l: any) => l.post_id)));
        const { data: commentData } = await supabase
            .from("medaka_comments")
            .select("id, post_id, body, created_at")
            .order("created_at", { ascending: true });
        const byPost: Record<string, { id: string; body: string; created_at: string }[]> = {};
        (commentData || []).forEach((c: any) => {
            if (!byPost[c.post_id]) byPost[c.post_id] = [];
            byPost[c.post_id].push({ id: c.id, body: c.body, created_at: c.created_at });
        });
        setComments(byPost);
    }, []);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map((e) => e.trim());
            setIsAdmin(!!user.email && adminEmails.includes(user.email));
            await loadData(user.id);
            setLoading(false);
        })();
    }, [router, loadData]);

    const handleSubmit = async () => {
        if (submitting) return;
        if (!title.trim() || !body.trim()) { setFormErr("タイトルと内容を入力してください"); return; }
        setSubmitting(true); setFormErr(""); setNotice("");
        const { error } = await supabase.from("medaka_box").insert({
            user_id: userId,
            post_type: postType,
            title: title.trim(),
            body: body.trim(),
        });
        if (error) { setSubmitting(false); setFormErr("投稿できませんでした。入力はそのまま残っています。もう一度お試しください。（" + error.message + "）"); return; }
        setTitle("");
        setBody("");
        setShowForm(false);
        setSubmitting(false);
        setNotice("投稿しました！匿名で掲示されています。");
        await loadData(userId);
    };

    const handleStatusChange = async (postId: string, newStatus: string) => {
        if (busyStatus) return;
        setBusyStatus(postId);
        const { error } = await supabase.from("medaka_box").update({ status: newStatus }).eq("id", postId);
        setBusyStatus("");
        if (error) { alert("ステータス変更に失敗しました: " + error.message); return; }
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, status: newStatus } : p));
    };
    const handleCommentSubmit = async (postId: string) => {
        if (!commentText.trim() || commentSubmitting) return;
        setCommentSubmitting(true);
        const { data, error } = await supabase
            .from("medaka_comments")
            .insert({ post_id: postId, user_id: userId, body: commentText.trim() })
            .select("id, post_id, body, created_at")
            .single();
        setCommentSubmitting(false);
        if (error) { alert("投稿に失敗しました: " + error.message); return; }
        if (data) {
            setComments((prev) => ({
                ...prev,
                [postId]: [...(prev[postId] || []), { id: (data as any).id, body: (data as any).body, created_at: (data as any).created_at }],
            }));
            setCommentText("");
        }
    };
    const handleLike = async (post: Post) => {
        if (lock.current[post.id]) return;       // 連打での二重処理を防ぐ
        lock.current[post.id] = true; setBusyLike(b => ({ ...b, [post.id]: true }));
        try {
            const alreadyLiked = likedIds.has(post.id);
            if (alreadyLiked) {
                const { error } = await supabase.from("medaka_likes").delete().eq("post_id", post.id).eq("user_id", userId);
                if (error) return;
                await supabase.from("medaka_box").update({ like_count: Math.max(0, post.like_count - 1) }).eq("id", post.id);
                setLikedIds(prev => { const n = new Set(prev); n.delete(post.id); return n; });
                setPosts(prev => prev.map(p => p.id === post.id ? { ...p, like_count: Math.max(0, p.like_count - 1) } : p));
            } else {
                const { error } = await supabase.from("medaka_likes").insert({ post_id: post.id, user_id: userId });
                if (error) return;
                await supabase.from("medaka_box").update({ like_count: post.like_count + 1 }).eq("id", post.id);
                setLikedIds(prev => new Set(prev).add(post.id));
                setPosts(prev => prev.map(p => p.id === post.id ? { ...p, like_count: p.like_count + 1 } : p));
            }
        } finally {
            lock.current[post.id] = false; setBusyLike(b => { const n = { ...b }; delete n[post.id]; return n; });
        }
    };

    const filtered = posts.filter(p => filter === "all" || p.post_type === filter);

    if (loading) return <main className="mk-root mk-loading"><style>{CSS}</style>読み込み中…</main>;

    return (
        <main className="mk-root">
            <style>{CSS}</style>
            <div className="mk-wrap">
                <header className="mk-head">
                    <img className="mk-deco" src="/es/deco_books.webp" alt="" />
                    <div className="mk-title">
                        <img src="/career/title_frame.webp" alt="" />
                        <div className="mk-title-t">
                            <button className="mk-brand" onClick={() => router.push("/home")}>INTERN QUEST</button>
                            <h1><span aria-hidden>🐟</span>メダカBOX</h1>
                        </div>
                        <p className="in">匿名で意見や課題を投稿できる掲示板です。</p>
                    </div>
                </header>
                <p className="mk-lead"><span>匿名で意見や課題を投稿できる掲示板です。</span>みんなの「気づき」を共有しましょう。</p>

                {/* 投稿ボタン */}
                {!showForm && (
                    <button className="mk-new" onClick={() => { setShowForm(true); setNotice(""); }}>
                        <img src="/es/cat_gakuchika.webp" alt="" />新しく投稿する
                    </button>
                )}
                {notice && <div className="mk-ok" role="status">✓ {notice}</div>}

                {/* 投稿フォーム */}
                {showForm && (
                    <section className="mk-form">
                        <div className="mk-types" role="group" aria-label="投稿の種類">
                            {[{ key: "opinion", label: "💬 意見・要望" }, { key: "issue", label: "🔧 現場の課題" }].map(t => (
                                <button key={t.key} type="button" className={postType === t.key ? "on" : ""} aria-pressed={postType === t.key} onClick={() => setPostType(t.key as any)}>{t.label}</button>
                            ))}
                        </div>
                        <input type="text" value={title} onChange={e => { setTitle(e.target.value); setFormErr(""); }} placeholder="タイトル" maxLength={60} aria-label="タイトル" disabled={submitting} />
                        <textarea value={body} onChange={e => { setBody(e.target.value); setFormErr(""); }} placeholder="内容を書いてください（匿名で投稿されます）" aria-label="内容" disabled={submitting} />
                        {formErr && <div className="mk-err" role="alert">{formErr}</div>}
                        <div className="mk-form-b">
                            <button type="button" className="cancel" disabled={submitting} onClick={() => { setShowForm(false); setTitle(""); setBody(""); setFormErr(""); }}>キャンセル</button>
                            <button type="button" className="go" onClick={handleSubmit} disabled={submitting}>{submitting ? "投稿中…" : "🐟 投稿する"}</button>
                        </div>
                    </section>
                )}

                {/* フィルタ */}
                <div className="mk-tabs" role="group" aria-label="絞り込み">
                    {[{ key: "all", label: "すべて" }, { key: "opinion", label: "💬 意見" }, { key: "issue", label: "🔧 課題" }].map(f => (
                        <button key={f.key} type="button" className={filter === f.key ? "on" : ""} aria-pressed={filter === f.key} onClick={() => setFilter(f.key as any)}>{f.label}</button>
                    ))}
                </div>

                {/* 投稿一覧 */}
                {filtered.length === 0 ? (
                    <div className="mk-empty"><div aria-hidden>🐟</div>まだ投稿がありません。最初の一匹になろう！</div>
                ) : (
                    <div className="mk-list">
                        {filtered.map(post => {
                            const isIssue = post.post_type === "issue";
                            const liked = likedIds.has(post.id);
                            const st = STATUS.find(x => x.key === post.status) || STATUS[0];
                            const cs = comments[post.id] || [];
                            return (
                                <article key={post.id} className="mk-card">
                                    <div className="mk-card-h">
                                        <span className={"mk-type" + (isIssue ? " issue" : "")}>{isIssue ? "🔧 課題" : "💬 意見"}</span>
                                        <span className={"mk-st s-" + st.key}>{st.label}</span>
                                        <span className="mk-meta">{day(post.created_at)}・匿名のメダカさん</span>
                                    </div>
                                    <h2>{post.title}</h2>
                                    <p className="mk-body">{post.body}</p>

                                    {post.admin_response && (
                                        <div className="mk-reply"><b>💬 運営からの返信</b>{post.admin_response}</div>
                                    )}

                                    <div className="mk-acts">
                                        <button type="button" className={"mk-like" + (liked ? " on" : "")} aria-pressed={liked} aria-label={liked ? "いいね済み" : "いいね"} disabled={!!busyLike[post.id]} onClick={() => handleLike(post)}>
                                            <span>{liked ? "♥" : "♡"}</span>{post.like_count}
                                        </button>
                                        {isIssue && (
                                            <button type="button" className="mk-sub" aria-expanded={openCommentPostId === post.id} onClick={() => { setOpenCommentPostId(openCommentPostId === post.id ? null : post.id); setCommentText(""); }}>
                                                💡 解決案を考える{cs.length > 0 ? `（${cs.length}）` : ""} {openCommentPostId === post.id ? "▲" : "▼"}
                                            </button>
                                        )}
                                        {isIssue && <button type="button" className="mk-sub kkc" onClick={() => router.push("/kkc")}>✅ 解決したらKKCへ →</button>}
                                    </div>

                                    {isAdmin && (
                                        <div className="mk-admin">
                                            <span>運営：ステータス変更</span>
                                            {STATUS.map((s) => (
                                                <button key={s.key} type="button" className={"s-" + s.key + (post.status === s.key ? " on" : "")} aria-pressed={post.status === s.key} disabled={busyStatus === post.id} onClick={() => handleStatusChange(post.id, s.key)}>{s.label}</button>
                                            ))}
                                        </div>
                                    )}

                                    {isIssue && openCommentPostId === post.id && (
                                        <div className="mk-ideas">
                                            <b>💡 解決案・アイデア</b>
                                            {cs.length === 0 ? (
                                                <div className="none">まだ解決案がありません。最初のアイデアを出してみましょう。</div>
                                            ) : cs.map((c) => (
                                                <div key={c.id} className="idea"><small>💡 匿名のメダカさん・{day(c.created_at)}</small>{c.body}</div>
                                            ))}
                                            <div className="mk-idea-f">
                                                <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="解決案・アイデアを書く（匿名）" aria-label="解決案" />
                                                <button type="button" onClick={() => handleCommentSubmit(post.id)} disabled={commentSubmitting || !commentText.trim()}>{commentSubmitting ? "…" : "送信"}</button>
                                            </div>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="mk-nav">
                <div className="band" />
                {[{ k: "home", l: "ホーム", h: "/home", img: "/home/nav_home_active.webp" }, { k: "rank", l: "ランキング", h: "/ranking", img: "/home/nav_trophy.webp" }, { k: "house", l: "おうち", h: "/mypage", img: "/home/nav_house.webp" }, { k: "menu", l: "メニュー", h: "/menu", img: "" }].map((t) => (
                    <button key={t.k} onClick={() => router.push(t.h)}>{t.img ? <img src={t.img} alt="" /> : <span>☰</span>}<i>{t.l}</i></button>
                ))}
            </div>
        </main>
    );
}

const CSS = `
.mk-root{min-height:100vh;min-height:100dvh;overflow-x:clip;background:url(/home/bg_mobile.webp) center top / cover no-repeat fixed,#bfe3f5;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#23284a;padding:14px 10px calc(108px + env(safe-area-inset-bottom));box-sizing:border-box}
@media (min-width:700px){ .mk-root{background-image:url(/home/bg_pc.webp);padding-top:22px} }
.mk-root *{box-sizing:border-box}
.mk-loading{display:flex;align-items:center;justify-content:center;font-weight:900;color:#17397d}
.mk-wrap{max-width:1040px;margin:0 auto}
.mk-head{display:flex;align-items:flex-end;justify-content:center}
.mk-deco{flex-shrink:0;width:160px;height:auto;margin-right:-34px;margin-bottom:14px;position:relative;z-index:2;filter:drop-shadow(0 6px 8px rgba(16,47,112,.3))}
.mk-title{position:relative;flex:0 1 640px;min-width:0;container-type:inline-size;margin-right:126px}
.mk-title>img{display:block;width:100%;height:auto;filter:drop-shadow(0 8px 14px rgba(16,47,112,.3))}
.mk-title-t{position:absolute;left:11%;right:11%;top:27%;bottom:32%;display:flex;flex-direction:column;align-items:center;justify-content:center}
.mk-brand{border:none;background:none;color:#3160d2;font-size:clamp(8px,2cqw,13px);font-weight:900;letter-spacing:.3em;cursor:pointer;font-family:inherit;padding:2px 8px;line-height:1.2}
.mk-title h1{margin:0;font-size:clamp(20px,8cqw,50px);font-weight:900;color:#17307a;letter-spacing:.06em;line-height:1.15;white-space:nowrap}
.mk-title h1 span{margin-right:.15em;font-size:.8em}
.mk-title p.in{position:absolute;left:21%;right:21%;top:75.5%;bottom:10%;margin:0;display:flex;align-items:center;justify-content:center;font-size:clamp(8.5px,2.5cqw,15px);font-weight:900;color:#5a4a22;white-space:nowrap}
.mk-lead{width:fit-content;max-width:100%;margin:8px auto 0;padding:7px 18px;background:rgba(255,253,246,.95);border:2px solid #e2bf63;border-radius:14px;font-size:13.5px;font-weight:800;color:#3a2f12;line-height:1.7;text-align:center;box-shadow:0 4px 10px rgba(16,47,112,.16)}
.mk-new{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;max-width:760px;margin:14px auto 0;min-height:62px;padding:8px 20px;border:3px solid #f5d77e;border-radius:18px;background:linear-gradient(180deg,#3b78e0,#1746b0 55%,#12358f);color:#fff;font-size:20px;font-weight:900;letter-spacing:.1em;cursor:pointer;font-family:inherit;box-shadow:inset 0 2px 0 rgba(255,255,255,.35),inset 0 0 0 2px rgba(255,255,255,.12),0 8px 18px rgba(16,47,112,.4);text-shadow:0 2px 3px rgba(10,25,70,.5);transition:transform .12s,filter .12s}
.mk-new img{width:38px;height:38px;object-fit:contain;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))}
.mk-new:hover{filter:brightness(1.08)}
.mk-new:active{transform:scale(.985)}
.mk-ok{max-width:760px;margin:10px auto 0;padding:10px 14px;border:2px solid #9bd8ab;border-radius:12px;background:#e3f7e8;color:#14602f;font-size:14px;font-weight:900;text-align:center}
.mk-form{max-width:760px;margin:14px auto 0;padding:18px 20px;background:linear-gradient(180deg,#fffdf6,#f8eed8);border:3px solid #e2bf63;border-radius:20px;box-shadow:inset 0 0 0 2px #fff,0 10px 24px rgba(16,47,112,.28)}
.mk-types{display:flex;gap:8px;margin-bottom:12px}
.mk-types button{flex:1;min-height:46px;padding:6px;border:2.5px solid #e2c98c;border-radius:12px;background:linear-gradient(180deg,#fff,#fbf2de);color:#5a4a22;font-size:14.5px;font-weight:900;cursor:pointer;font-family:inherit}
.mk-types button.on,.mk-tabs button.on{background:linear-gradient(180deg,#3b78e0,#1746b0);border-color:#f5d77e;color:#fff;box-shadow:0 0 0 2px #1746b0,0 4px 10px rgba(16,47,112,.35)}
.mk-form input,.mk-form textarea{display:block;width:100%;padding:12px 14px;border:2px solid #e3d3a4;border-radius:12px;background:#fff;color:#23284a;font-size:16px;font-family:inherit;outline:none;margin-bottom:10px;box-shadow:inset 0 2px 4px rgba(120,80,20,.08)}
.mk-form textarea{min-height:120px;line-height:1.7;resize:vertical}
.mk-form input:focus,.mk-form textarea:focus,.mk-idea-f input:focus{border-color:#2a4aa6;box-shadow:0 0 0 3px rgba(42,74,166,.16)}
.mk-root ::placeholder{color:#a79f8e}
.mk-err{margin-bottom:10px;padding:9px 12px;border:2px solid #f0a9b5;border-radius:12px;background:#fff5f5;color:#9f1d38;font-size:13.5px;font-weight:800;line-height:1.6;overflow-wrap:anywhere}
.mk-form-b{display:flex;gap:8px}
.mk-form-b button{min-height:50px;border-radius:999px;font-size:15px;font-weight:900;cursor:pointer;font-family:inherit}
.mk-form-b .cancel{flex:1;border:2px solid #d8c9a0;background:#fff;color:#6b5a33}
.mk-form-b .go{flex:2;border:3px solid #f5d77e;background:linear-gradient(180deg,#3b78e0,#1746b0);color:#fff;box-shadow:0 5px 12px rgba(16,47,112,.3)}
.mk-form-b button:disabled{opacity:.6;cursor:not-allowed}
.mk-tabs{display:flex;gap:8px;margin:18px 0 12px;flex-wrap:wrap}
.mk-tabs button{min-height:48px;padding:8px 22px;border:2.5px solid #e2c98c;border-radius:14px;background:linear-gradient(180deg,#fff,#fbf2de);color:#2a2f52;font-size:15px;font-weight:900;cursor:pointer;font-family:inherit;white-space:nowrap;box-shadow:0 3px 7px rgba(120,80,20,.16)}
.mk-empty{padding:40px 16px;text-align:center;font-size:14.5px;font-weight:800;color:#6b5a33;background:rgba(255,253,246,.95);border:2px dashed #e2c98c;border-radius:18px}
.mk-empty div{font-size:40px;margin-bottom:8px}
.mk-list{display:flex;flex-direction:column;gap:14px}
.mk-card{position:relative;padding:18px 26px 16px;background:linear-gradient(180deg,#fffefb,#fdf6e6);border:2.5px solid #e2bf63;border-radius:20px;box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 3px rgba(226,191,99,.3),0 6px 14px rgba(16,47,112,.18);min-width:0}
.mk-card::before,.mk-card::after{content:"";position:absolute;width:16px;height:16px;border:2px solid #e2bf63;pointer-events:none;opacity:.8}
.mk-card::before{left:7px;top:7px;border-right:none;border-bottom:none;border-radius:8px 0 0 0}
.mk-card::after{right:7px;bottom:7px;border-left:none;border-top:none;border-radius:0 0 8px 0}
.mk-card-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.mk-type{padding:3px 12px;border-radius:999px;background:linear-gradient(180deg,#7b86e8,#5560cf);color:#fff;font-size:12.5px;font-weight:900;white-space:nowrap}
.mk-type.issue{background:linear-gradient(180deg,#f29a4a,#d9731a)}
.mk-st{display:inline-flex;align-items:center;gap:5px;padding:3px 12px;border-radius:999px;font-size:12.5px;font-weight:900;white-space:nowrap;border:1.5px solid}
.mk-st::before,.mk-admin button::before{content:"";width:9px;height:9px;border-radius:50%;flex-shrink:0}
.mk-st.s-open{background:#e3efff;border-color:#8fb8f5;color:#1746b0}
.s-open::before{background:#2f6ad1}
.mk-st.s-acknowledged{background:#fff3cf;border-color:#e9b949;color:#8a5a00}
.s-acknowledged::before{background:#eab308}
.mk-st.s-resolved{background:#dff6e6;border-color:#86d49c;color:#14602f}
.s-resolved::before{background:#22a84f}
.mk-meta{margin-left:auto;font-size:12.5px;font-weight:700;color:#8a7a55;white-space:nowrap}
.mk-card h2{margin:0 0 6px;font-size:19px;font-weight:900;color:#17307a;line-height:1.5;overflow-wrap:anywhere}
.mk-body{margin:0 0 12px;font-size:15.5px;line-height:1.9;color:#33384c;white-space:pre-wrap;overflow-wrap:anywhere}
.mk-reply{margin-bottom:12px;padding:10px 14px;border-radius:12px;background:#e9f8ee;border:1.5px solid #a9dcb8;font-size:14.5px;line-height:1.75;color:#1d4d2d;white-space:pre-wrap;overflow-wrap:anywhere}
.mk-reply b{display:block;font-size:12.5px;color:#14602f;margin-bottom:2px}
.mk-acts{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mk-like{display:inline-flex;align-items:center;gap:6px;min-width:64px;min-height:44px;justify-content:center;padding:6px 16px;border:2.5px solid #e2c98c;border-radius:999px;background:radial-gradient(circle at 35% 30%,#fff,#f6ecd2);color:#5a4a22;font-size:15px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 3px 6px rgba(120,80,20,.18);transition:transform .15s}
.mk-like span{font-size:19px;line-height:1;color:#b08a3a}
.mk-like:active{transform:scale(1.14)}
.mk-like.on{background:radial-gradient(circle at 35% 30%,#fff0f3,#ffd3dc);border-color:#f08aa0;color:#b0123a}
.mk-like.on span{color:#e11d48}
.mk-like:disabled{opacity:.6;cursor:wait}
.mk-sub{min-height:44px;padding:6px 14px;border:2px solid #9fb2ea;border-radius:999px;background:#f1f5ff;color:#1746b0;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit}
.mk-sub.kkc{border-color:#f0b98a;background:#fff4e8;color:#b4530f}
.mk-admin{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:1.5px dashed #e2c98c}
.mk-admin>span{font-size:12px;font-weight:800;color:#7a6a45;margin-right:4px}
.mk-admin button{display:inline-flex;align-items:center;gap:5px;min-height:40px;padding:5px 14px;border:2px solid #e2c98c;border-radius:999px;background:#fff;color:#3a2f12;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit}
.mk-admin button.on{background:linear-gradient(180deg,#2a4aa6,#172f78);border-color:#f5d77e;color:#fff}
.mk-admin button:disabled{opacity:.6;cursor:wait}
.mk-ideas{margin-top:12px;padding:12px 14px;border-radius:14px;background:#f5efdc;border:1.5px solid #e2c98c}
.mk-ideas>b{display:block;font-size:13px;color:#1746b0;margin-bottom:8px}
.mk-ideas .none{font-size:13.5px;font-weight:700;color:#7a6a45;margin-bottom:10px}
.mk-ideas .idea{padding:8px 12px;border-radius:10px;background:#fffdf7;margin-bottom:6px;font-size:14.5px;line-height:1.7;color:#33384c;white-space:pre-wrap;overflow-wrap:anywhere}
.mk-ideas .idea small{display:block;font-size:11.5px;font-weight:700;color:#8a7a55}
.mk-idea-f{display:flex;gap:8px;margin-top:4px}
.mk-idea-f input{flex:1;min-width:0;min-height:46px;padding:0 14px;border:2px solid #e2c98c;border-radius:12px;background:#fff;color:#23284a;font-size:16px;outline:none;font-family:inherit}
.mk-idea-f button{flex-shrink:0;min-height:46px;padding:6px 18px;border:2px solid #f5d77e;border-radius:12px;background:linear-gradient(180deg,#3b78e0,#1746b0);color:#fff;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit}
.mk-idea-f button:disabled{opacity:.5;cursor:not-allowed}
.mk-root button:focus-visible{outline:3px solid #2a4aa6;outline-offset:2px}
.mk-nav{position:fixed;left:0;bottom:0;width:100%;max-width:100vw;z-index:50;display:flex;height:calc(86px + env(safe-area-inset-bottom));padding:0 10px calc(10px + env(safe-area-inset-bottom));overflow:hidden}
.mk-nav .band{position:absolute;inset:6px 8px calc(8px + env(safe-area-inset-bottom));background:url(/home/nav_bar.webp);background-size:100% 100%;pointer-events:none}
.mk-nav button{position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;padding-bottom:calc(17px + env(safe-area-inset-bottom));background:transparent;border:none;cursor:pointer;color:#fff;font-family:inherit}
.mk-nav img{height:30px}
.mk-nav span{font-size:20px;line-height:30px}
.mk-nav i{font-style:normal;font-size:10.5px;font-weight:800}
.mk-lead span{display:none}
@media (max-width:900px){ .mk-deco{display:none} .mk-title{margin-right:0} }
@media (max-width:640px){
  .mk-title{flex-basis:100%}
  .mk-title p.in{display:none}
  .mk-lead{margin-top:-4px;font-size:13px;text-align:left}
  .mk-lead span{display:inline}
  .mk-new{font-size:18px;min-height:58px}
  .mk-form{padding:14px 13px}
  .mk-tabs button{flex:1;padding:8px 6px}
  .mk-card{padding:15px 15px 14px;border-radius:16px}
  .mk-meta{margin-left:0;flex-basis:100%;white-space:normal}
  .mk-card h2{font-size:17.5px}
  .mk-body{font-size:15.5px;line-height:1.85}
  .mk-admin>span{flex-basis:100%}
  .mk-admin button{flex:1;justify-content:center;padding:5px 6px}
}
`;
