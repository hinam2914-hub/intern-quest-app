"use client";

import { useEffect, useState, useCallback } from "react";
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

const STATUS_INFO: Record<string, { label: string; color: string }> = {
    open: { label: "🔵 受付中", color: "#06b6d4" },
    acknowledged: { label: "🟡 確認済み", color: "#fbbf24" },
    resolved: { label: "🟢 解決済み", color: "#10b981" },
};

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
        if (!title.trim() || !body.trim()) {
            alert("タイトルと内容を入力してください");
            return;
        }
        setSubmitting(true);
        await supabase.from("medaka_box").insert({
            user_id: userId,
            post_type: postType,
            title: title.trim(),
            body: body.trim(),
        });
        setTitle("");
        setBody("");
        setShowForm(false);
        setSubmitting(false);
        await loadData(userId);
    };

    const handleStatusChange = async (postId: string, newStatus: string) => {
        const { error } = await supabase.from("medaka_box").update({ status: newStatus }).eq("id", postId);
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
        const alreadyLiked = likedIds.has(post.id);
        if (alreadyLiked) {
            await supabase.from("medaka_likes").delete().eq("post_id", post.id).eq("user_id", userId);
            await supabase.from("medaka_box").update({ like_count: Math.max(0, post.like_count - 1) }).eq("id", post.id);
            setLikedIds(prev => { const n = new Set(prev); n.delete(post.id); return n; });
            setPosts(prev => prev.map(p => p.id === post.id ? { ...p, like_count: Math.max(0, p.like_count - 1) } : p));
        } else {
            await supabase.from("medaka_likes").insert({ post_id: post.id, user_id: userId });
            await supabase.from("medaka_box").update({ like_count: post.like_count + 1 }).eq("id", post.id);
            setLikedIds(prev => new Set(prev).add(post.id));
            setPosts(prev => prev.map(p => p.id === post.id ? { ...p, like_count: p.like_count + 1 } : p));
        }
    };

    const filtered = posts.filter(p => filter === "all" || p.post_type === filter);

    if (loading) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Loading...</main>
    );

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", color: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 640, margin: "0 auto" }}>
                <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                <h1 style={{ fontSize: 28, fontWeight: 900, margin: "4px 0 6px" }}>🐟 メダカBOX</h1>
                <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 24px" }}>匿名で意見や課題を投稿できる掲示板です。みんなの「気づき」を共有しましょう。</p>

                {/* 投稿ボタン */}
                {!showForm && (
                    <button onClick={() => setShowForm(true)} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", marginBottom: 24 }}>
                        ✏️ 新しく投稿する
                    </button>
                )}

                {/* 投稿フォーム */}
                {showForm && (
                    <div style={{ padding: 20, borderRadius: 14, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)", marginBottom: 24 }}>
                        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                            {[
                                { key: "opinion", label: "💬 意見・要望" },
                                { key: "issue", label: "🔧 現場の課題" },
                            ].map(t => (
                                <button key={t.key} onClick={() => setPostType(t.key as any)} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: `1px solid ${postType === t.key ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.1)"}`, background: postType === t.key ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.03)", color: postType === t.key ? "#fff" : "#9ca3af", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="タイトル"
                            maxLength={60}
                            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, marginBottom: 10, boxSizing: "border-box" }}
                        />
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            placeholder="内容を書いてください（匿名で投稿されます）"
                            style={{ width: "100%", minHeight: 100, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, fontFamily: "inherit", resize: "vertical", marginBottom: 12, boxSizing: "border-box" }}
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => { setShowForm(false); setTitle(""); setBody(""); }} style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>キャンセル</button>
                            <button onClick={handleSubmit} disabled={submitting} style={{ flex: 2, padding: 12, borderRadius: 8, border: "none", background: submitting ? "#374151" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: submitting ? "not-allowed" : "pointer" }}>
                                {submitting ? "投稿中..." : "🐟 投稿する"}
                            </button>
                        </div>
                    </div>
                )}

                {/* フィルタ */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    {[
                        { key: "all", label: "すべて" },
                        { key: "opinion", label: "💬 意見" },
                        { key: "issue", label: "🔧 課題" },
                    ].map(f => (
                        <button key={f.key} onClick={() => setFilter(f.key as any)} style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: filter === f.key ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.03)", color: filter === f.key ? "#fff" : "#9ca3af", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* 投稿一覧 */}
                {filtered.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 48, color: "#6b7280" }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>🐟</div>
                        <p>まだ投稿がありません。最初の一匹になろう！</p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {filtered.map(post => {
                            const isIssue = post.post_type === "issue";
                            const liked = likedIds.has(post.id);
                            const statusInfo = STATUS_INFO[post.status] || STATUS_INFO.open;
                            return (
                                <div key={post.id} style={{ padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${isIssue ? "rgba(249,115,22,0.25)" : "rgba(99,102,241,0.2)"}` }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                                        <span style={{ padding: "2px 8px", borderRadius: 6, background: isIssue ? "rgba(249,115,22,0.15)" : "rgba(99,102,241,0.15)", color: isIssue ? "#fb923c" : "#a5b4fc", fontSize: 11, fontWeight: 700 }}>
                                            {isIssue ? "🔧 課題" : "💬 意見"}
                                        </span>
                                        <span style={{ fontSize: 11, color: statusInfo.color, fontWeight: 700 }}>{statusInfo.label}</span>
                                        <span style={{ fontSize: 10, color: "#6b7280", marginLeft: "auto" }}>{new Date(post.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })} ・ 匿名のメダカさん</span>
                                    </div>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: "#f9fafb", marginBottom: 6 }}>{post.title}</div>
                                    <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 12 }}>{post.body}</div>

                                    {post.admin_response && (
                                        <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
                                            <div style={{ fontSize: 11, color: "#34d399", fontWeight: 700, marginBottom: 4 }}>💬 運営からの返信</div>
                                            <div style={{ fontSize: 13, color: "#d1fae5", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{post.admin_response}</div>
                                        </div>
                                    )}

                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <button onClick={() => handleLike(post)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${liked ? "rgba(244,63,94,0.5)" : "rgba(255,255,255,0.1)"}`, background: liked ? "rgba(244,63,94,0.15)" : "transparent", color: liked ? "#fb7185" : "#9ca3af", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                                            {liked ? "❤️" : "🤍"} {post.like_count}
                                        </button>
                                        {isIssue && (
                                            <button onClick={() => setOpenCommentPostId(openCommentPostId === post.id ? null : post.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.1)", color: "#a5b4fc", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                                                💡 解決案を考える {(comments[post.id]?.length || 0) > 0 ? `(${comments[post.id].length})` : ""} {openCommentPostId === post.id ? "▲" : "▼"}
                                            </button>
                                        )}
                                        {isIssue && (
                                            <button onClick={() => router.push("/kkc")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(249,115,22,0.4)", background: "rgba(249,115,22,0.1)", color: "#fb923c", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                                                ✅ 解決したらKKCへ →
                                            </button>
                                        )}
                                    </div>
                                    {isAdmin && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700 }}>運営：ステータス変更</span>
                                            {[
                                                { key: "open", label: "🔵 受付中" },
                                                { key: "acknowledged", label: "🟡 確認済み" },
                                                { key: "resolved", label: "🟢 解決済み" },
                                            ].map((s) => (
                                                <button key={s.key} onClick={() => handleStatusChange(post.id, s.key)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${post.status === s.key ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.1)"}`, background: post.status === s.key ? "rgba(99,102,241,0.2)" : "transparent", color: post.status === s.key ? "#fff" : "#9ca3af", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                                    {s.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {isIssue && openCommentPostId === post.id && (
                                        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                            <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, marginBottom: 8 }}>💡 解決案・アイデア</div>
                                            {(comments[post.id] || []).length === 0 ? (
                                                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>まだ解決案がありません。最初のアイデアを出してみましょう。</div>
                                            ) : (
                                                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                                                    {(comments[post.id] || []).map((c) => (
                                                        <div key={c.id} style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)" }}>
                                                            <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>💡 匿名のメダカさん ・ {new Date(c.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}</div>
                                                            <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.body}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div style={{ display: "flex", gap: 8 }}>
                                                <input
                                                    value={openCommentPostId === post.id ? commentText : ""}
                                                    onChange={(e) => setCommentText(e.target.value)}
                                                    placeholder="解決案・アイデアを書く（匿名）"
                                                    style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none" }}
                                                />
                                                <button onClick={() => handleCommentSubmit(post.id)} disabled={commentSubmitting || !commentText.trim()} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: commentSubmitting || !commentText.trim() ? "#374151" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: commentSubmitting || !commentText.trim() ? "not-allowed" : "pointer" }}>投稿</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}
