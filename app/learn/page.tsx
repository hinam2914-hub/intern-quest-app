// v4
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Content = {
    id: string;
    title: string;
    description: string | null;
    content_type: string;
    url: string | null;
    body: string | null;
    is_active: boolean;
    category?: string | null;
    is_required?: boolean;
    deadline?: string | null;
};

type Completion = {
    id: string;
    content_id: string;
    status: string;
    review: string | null;
    feedback: string | null;
};

export default function LearnPage() {
    const router = useRouter();
    const [userId, setUserId] = useState("");
    const [contents, setContents] = useState<Content[]>([]);
    const [completions, setCompletions] = useState<Completion[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Content | null>(null);
    const [review, setReview] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const { data: contentRows } = await supabase.from("contents").select("*").eq("is_active", true).order("created_at", { ascending: false });
            setContents((contentRows || []) as Content[]);
            const { data: completionRows } = await supabase.from("content_completions").select("id, content_id, status, review, feedback").eq("user_id", user.id);
            setCompletions((completionRows || []) as Completion[]);
            setLoading(false);
        };
        load();
    }, [router]);

    const getCompletion = (contentId: string) => completions.find(c => c.content_id === contentId);

    const handleSubmitReview = async () => {
        if (!selected || !review.trim()) return;
        setSubmitting(true);

        const existing = getCompletion(selected.id);
        if (existing) {
            await supabase.from("content_completions").update({ review: review.trim(), status: "pending" }).eq("id", existing.id);
            setCompletions(prev => prev.map(c => c.id === existing.id ? { ...c, review: review.trim(), status: "pending" } : c));
        } else {
            const { data } = await supabase.from("content_completions").insert({
                user_id: userId,
                content_id: selected.id,
                review: review.trim(),
                status: "pending",
            }).select().single();
            if (data) setCompletions(prev => [...prev, data as Completion]);
        }

        setMessage("✅ レビューを提出しました！管理者の承認をお待ちください。");
        setTimeout(() => setMessage(""), 4000);
        setReview("");
        setSelected(null);
        setSubmitting(false);
    };

    const getYouTubeId = (url: string) => {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
        return match ? match[1] : null;
    };

    const getThumbnail = (content: Content) => {
        if (content.url) {
            const ytId = getYouTubeId(content.url);
            if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
        }
        return null;
    };

    const getStatusBadge = (completion: Completion | undefined) => {
        if (!completion) return null;
        if (completion.status === "approved") return { label: "✅ 承認済み", color: "#34d399", bg: "rgba(52,211,153,0.15)", border: "rgba(52,211,153,0.3)" };
        if (completion.status === "pending") return { label: "⏳ 審査中", color: "#f59e0b", bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.3)" };
        if (completion.status === "rejected") return { label: "❌ 却下", color: "#f87171", bg: "rgba(248,113,113,0.15)", border: "rgba(248,113,113,0.3)" };
        return null;
    };

    const approvedIds = completions.filter(c => c.status === "approved").map(c => c.content_id);
    const [catFilter, setCatFilter] = useState<string>("all");
    const categories = [...new Set(contents.map(c => c.category).filter(Boolean))] as string[];
    const filtered = catFilter === "all" ? contents : contents.filter(c => c.category === catFilter);
    const videos = filtered.filter(c => c.content_type === "video");
    const articles = filtered.filter(c => c.content_type !== "video");

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", fontFamily: "'Inter', sans-serif" }}>
            {/* ===== ヘッダー（統一） ===== */}
            <div style={{ padding: "40px 32px 24px", background: "linear-gradient(180deg, rgba(99,102,241,0.15) 0%, transparent 100%)" }}>
                <div onClick={() => router.push("/home")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block", marginBottom: 4 }}>INTERN QUEST</div>
                <h1 style={{ fontSize: 32, fontWeight: 900, color: "#f9fafb", margin: "4px 0 0" }}>📚 学習コンテンツ</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, margin: "8px 0 0" }}>視聴・読了してレビューを提出すると <span style={{ color: "#818cf8", fontWeight: 700 }}>+2pt</span>！　{approvedIds.length} / {contents.length} 完了</p>
            </div>

            {categories.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 32px", marginBottom: 20 }}>
                    <button onClick={() => setCatFilter("all")} style={{ padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 800, background: catFilter === "all" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.06)", color: catFilter === "all" ? "#fff" : "#9ca3af" }}>すべて</button>
                    {categories.map(cat => (
                        <button key={cat} onClick={() => setCatFilter(cat)} style={{ padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 800, background: catFilter === cat ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.06)", color: catFilter === cat ? "#fff" : "#9ca3af" }}>{cat}</button>
                    ))}
                </div>
            )}
            {message && (
                <div style={{ margin: "0 32px 16px", padding: "12px 20px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 10, color: "#34d399", fontSize: 14, fontWeight: 600 }}>
                    {message}
                </div>
            )}

            {(() => {
                const required = contents.filter(c => c.is_required);
                if (required.length === 0) return null;
                const doneIds = new Set(completions.filter(cp => cp.status === "approved" || cp.status === "pending").map(cp => cp.content_id));
                const sorted = [...required].sort((a, b) => {
                    const ad = doneIds.has(a.id) ? 1 : 0, bd = doneIds.has(b.id) ? 1 : 0;
                    if (ad !== bd) return ad - bd;
                    return (a.deadline || "9999") < (b.deadline || "9999") ? -1 : 1;
                });
                const doneCount = required.filter(c => doneIds.has(c.id)).length;
                return (
                    <div style={{ margin: "0 32px 28px", padding: "20px 22px", borderRadius: 16, background: "rgba(248,113,113,0.06)", border: "1.5px solid rgba(248,113,113,0.3)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 6 }}>
                            <span style={{ fontSize: 16, fontWeight: 900, color: "#fca5a5" }}>📌 あなたの必修コンテンツ</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: doneCount === required.length ? "#34d399" : "#fca5a5" }}>{doneCount} / {required.length} 完了</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {sorted.map(c => {
                                const done = doneIds.has(c.id);
                                const days = c.deadline ? Math.ceil((new Date(c.deadline + "T23:59:59").getTime() - Date.now()) / 86400000) : null;
                                const urgent = !done && days !== null && days <= 3;
                                return (
                                    <div key={c.id} onClick={() => { const el = document.getElementById("learn-" + c.id); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, cursor: "pointer", background: done ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.04)", border: "1px solid " + (done ? "rgba(52,211,153,0.25)" : urgent ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.08)"), opacity: done ? 0.65 : 1 }}>
                                        <span style={{ fontSize: 16 }}>{done ? "✅" : c.content_type === "video" ? "▶️" : "📄"}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13.5, fontWeight: 800, color: done ? "#86efac" : "#f9fafb", textDecoration: done ? "line-through" : "none" }}>{c.title}</div>
                                            {c.category && <span style={{ fontSize: 10, fontWeight: 700, color: "#a5b4fc" }}>{c.category}</span>}
                                        </div>
                                        {c.deadline && !done && (
                                            <span style={{ fontSize: 11.5, fontWeight: 900, whiteSpace: "nowrap", color: urgent ? "#f87171" : "#9ca3af" }}>
                                                {days !== null && days < 0 ? "期限切れ" : days === 0 ? "今日まで！" : `あと${days}日`}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}
            {contents.length === 0 ? (
                <div style={{ textAlign: "center", padding: 80, color: "#6b7280" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
                    <div>コンテンツはまだありません</div>
                </div>
            ) : (
                <div style={{ paddingBottom: 32 }}>
                    {videos.length > 0 && (
                        <div style={{ marginBottom: 40 }}>
                            <div style={{ padding: "24px 32px 16px", fontSize: 20, fontWeight: 800, color: "#f9fafb" }}>▶️ 動画</div>
                            <div style={{ display: "flex", gap: 16, overflowX: "auto", padding: "0 32px 16px", scrollbarWidth: "none" }}>
                                {videos.map(content => {
                                    const completion = getCompletion(content.id);
                                    const badge = getStatusBadge(completion);
                                    const thumb = getThumbnail(content);
                                    return (
                                        <div key={content.id} id={"learn-" + content.id} onClick={() => { setSelected(content); setReview(completion?.review || ""); }}
                                            style={{ flexShrink: 0, width: 260, cursor: "pointer", borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: `1px solid ${completion?.status === "approved" ? "rgba(52,211,153,0.4)" : completion?.status === "pending" ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}`, transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", position: "relative", boxShadow: "0 0 0 rgba(99,102,241,0)" }}
                                            onMouseEnter={e => {
                                                const el = e.currentTarget as HTMLDivElement;
                                                el.style.transform = "scale(1.08) translateY(-4px)";
                                                el.style.boxShadow = "0 20px 40px rgba(99,102,241,0.4), 0 0 30px rgba(139,92,246,0.3)";
                                                el.style.zIndex = "10";
                                                el.style.borderColor = "rgba(99,102,241,0.6)";
                                            }}
                                            onMouseLeave={e => {
                                                const el = e.currentTarget as HTMLDivElement;
                                                el.style.transform = "scale(1) translateY(0)";
                                                el.style.boxShadow = "0 0 0 rgba(99,102,241,0)";
                                                el.style.zIndex = "1";
                                                el.style.borderColor = completion?.status === "approved" ? "rgba(52,211,153,0.4)" : completion?.status === "pending" ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)";
                                            }}
                                        >
                                            <div style={{ width: "100%", height: 146, background: "rgba(99,102,241,0.15)", position: "relative", overflow: "hidden" }}>
                                                {thumb ? <img src={thumb} alt={content.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>▶️</div>}
                                                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>▶</div>
                                                </div>
                                                {badge && <div style={{ position: "absolute", top: 8, right: 8, background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color, fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6 }}>{badge.label}</div>}
                                            </div>
                                            <div style={{ padding: "12px 14px" }}>
                                                <div style={{ display: "flex", gap: 5, marginBottom: 5, flexWrap: "wrap" }}>
                                                    {content.is_required && <span style={{ fontSize: 9.5, fontWeight: 900, color: "#fca5a5", background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 5, padding: "2px 7px" }}>📌 必修</span>}
                                                    {content.category && <span style={{ fontSize: 9.5, fontWeight: 800, color: "#a5b4fc", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 5, padding: "2px 7px" }}>{content.category}</span>}
                                                </div>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 4, lineHeight: 1.4 }}>{content.title}</div>
                                                {content.description && <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{content.description}</div>}
                                                <div style={{ marginTop: 8, fontSize: 12, color: completion?.status === "approved" ? "#34d399" : "#818cf8", fontWeight: 700 }}>
                                                    {completion?.status === "approved" ? "✅ 承認済み +2pt" : completion?.status === "pending" ? "⏳ レビュー審査中" : completion?.status === "rejected" ? "❌ 差戻し（タップして修正）" : "レビューを書いて +2pt"}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {articles.length > 0 && (
                        <div>
                            <div style={{ padding: "0 32px 16px", fontSize: 20, fontWeight: 800, color: "#f9fafb" }}>📄 記事・資料</div>
                            <div style={{ display: "flex", gap: 16, overflowX: "auto", padding: "0 32px 16px", scrollbarWidth: "none" }}>
                                {articles.map(content => {
                                    const completion = getCompletion(content.id);
                                    const badge = getStatusBadge(completion);
                                    return (
                                        <div key={content.id} id={"learn-" + content.id} onClick={() => { setSelected(content); setReview(completion?.review || ""); }}
                                            style={{ flexShrink: 0, width: 220, cursor: "pointer", borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: `1px solid ${completion?.status === "approved" ? "rgba(52,211,153,0.4)" : completion?.status === "pending" ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}`, transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", position: "relative", boxShadow: "0 0 0 rgba(99,102,241,0)" }}
                                            onMouseEnter={e => {
                                                const el = e.currentTarget as HTMLDivElement;
                                                el.style.transform = "scale(1.08) translateY(-4px)";
                                                el.style.boxShadow = "0 20px 40px rgba(99,102,241,0.4), 0 0 30px rgba(139,92,246,0.3)";
                                                el.style.zIndex = "10";
                                                el.style.borderColor = "rgba(99,102,241,0.6)";
                                            }}
                                            onMouseLeave={e => {
                                                const el = e.currentTarget as HTMLDivElement;
                                                el.style.transform = "scale(1) translateY(0)";
                                                el.style.boxShadow = "0 0 0 rgba(99,102,241,0)";
                                                el.style.zIndex = "1";
                                                el.style.borderColor = completion?.status === "approved" ? "rgba(52,211,153,0.4)" : completion?.status === "pending" ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)";
                                            }}
                                        >
                                            <div style={{ width: "100%", height: 120, background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, position: "relative" }}>
                                                📄
                                                {badge && <div style={{ position: "absolute", top: 8, right: 8, background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color, fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6 }}>{badge.label}</div>}
                                            </div>
                                            <div style={{ padding: "12px 14px" }}>
                                                <div style={{ display: "flex", gap: 5, marginBottom: 5, flexWrap: "wrap" }}>
                                                    {content.is_required && <span style={{ fontSize: 9.5, fontWeight: 900, color: "#fca5a5", background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 5, padding: "2px 7px" }}>📌 必修</span>}
                                                    {content.category && <span style={{ fontSize: 9.5, fontWeight: 800, color: "#a5b4fc", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 5, padding: "2px 7px" }}>{content.category}</span>}
                                                </div>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 4, lineHeight: 1.4 }}>{content.title}</div>
                                                {content.description && <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{content.description}</div>}
                                                <div style={{ marginTop: 8, fontSize: 12, color: completion?.status === "approved" ? "#34d399" : "#818cf8", fontWeight: 700 }}>
                                                    {completion?.status === "approved" ? "✅ 承認済み +2pt" : completion?.status === "pending" ? "⏳ レビュー審査中" : completion?.status === "rejected" ? "❌ 差戻し（タップして修正）" : "レビューを書いて +2pt"}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ===== メニューへ戻るボタン（統一） ===== */}
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 16, paddingBottom: 48 }}>
                <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>
                    メニューへ戻る
                </button>
            </div>

            {/* モーダル */}
            {selected && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setSelected(null)}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "#0f0f1a", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 20, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}>
                        {selected.content_type === "video" && selected.url && getYouTubeId(selected.url) ? (
                            <div style={{ borderRadius: "20px 20px 0 0", overflow: "hidden", aspectRatio: "16/9" }}>
                                <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${getYouTubeId(selected.url)}`} title={selected.title} style={{ border: "none", display: "block", aspectRatio: "16/9" }} allowFullScreen />
                            </div>
                        ) : (
                            <div style={{ height: 120, background: "linear-gradient(135deg, rgba(99,102,241,0.4), rgba(139,92,246,0.4))", borderRadius: "20px 20px 0 0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>📄</div>
                        )}

                        <div style={{ padding: 28 }}>
                            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#f9fafb", margin: "0 0 8px" }}>{selected.title}</h2>
                            {selected.description && <p style={{ fontSize: 14, color: "#9ca3af", margin: "0 0 20px" }}>{selected.description}</p>}

                            {selected.body && (
                                selected.body.startsWith("http") ? (
                                    <div style={{ marginBottom: 20 }}>
                                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>🔗 参考リンク</div>
                                        <a href={selected.body.trim()} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 12, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", textDecoration: "none" }}>
                                            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🌐</div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", marginBottom: 2 }}>記事を読む →</div>
                                                <div style={{ fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.body.trim()}</div>
                                            </div>
                                        </a>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: 15, color: "#c7d2fe", lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 24, padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                        {selected.body}
                                    </div>
                                )
                            )}

                            {selected.url && !getYouTubeId(selected.url) && (
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>🔗 参考リンク</div>
                                    <a href={selected.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 12, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", textDecoration: "none" }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🌐</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", marginBottom: 2 }}>記事を読む →</div>
                                            <div style={{ fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.url}</div>
                                        </div>
                                    </a>
                                </div>
                            )}

                            {/* レビューセクション */}
                            {(() => {
                                const completion = getCompletion(selected.id);
                                if (completion?.status === "approved") {
                                    return (
                                        <div style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", marginBottom: 16 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399", marginBottom: 8 }}>✅ 承認済み +2pt獲得！</div>
                                            <div style={{ fontSize: 13, color: "#9ca3af" }}>あなたのレビュー：{completion.review}</div>
                                        </div>
                                    );
                                }
                                if (completion?.status === "pending") {
                                    return (
                                        <div style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", marginBottom: 16 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", marginBottom: 8 }}>⏳ 管理者の承認待ちです</div>
                                            <div style={{ fontSize: 13, color: "#9ca3af" }}>提出したレビュー：{completion.review}</div>
                                        </div>
                                    );
                                }
                                return (
                                    <div style={{ marginBottom: 16 }}>
                                        {completion?.status === "rejected" && completion?.feedback && (
                                            <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", marginBottom: 12 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: "#f87171", marginBottom: 6 }}>❌ 差戻しされました</div>
                                                <div style={{ fontSize: 11, color: "#fca5a5", fontWeight: 600, marginBottom: 4 }}>💬 管理者からのコメント</div>
                                                <div style={{ fontSize: 13, color: "#fef3f3", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{completion.feedback}</div>
                                            </div>
                                        )}
                                        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>📝 視聴・読了レビュー（必須）</div>
                                        <textarea
                                            value={review}
                                            onChange={e => setReview(e.target.value)}
                                            placeholder="感想・学んだことを書いてください（承認されると+2pt獲得！）"
                                            style={{ width: "100%", height: 100, padding: "12px 14px", borderRadius: 10, border: `1px solid ${review.trim().length >= 20 ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.1)"}`, background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                                        />
                                        <div style={{ fontSize: 12, color: review.trim().length >= 20 ? "#34d399" : "#6b7280", textAlign: "right", marginTop: 4 }}>
                                            {review.trim().length} / 20文字以上
                                        </div>
                                    </div>
                                );
                            })()}

                            <div style={{ display: "flex", gap: 10 }}>
                                <button onClick={() => setSelected(null)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>閉じる</button>
                                {!getCompletion(selected.id) || getCompletion(selected.id)?.status === "rejected" ? (
                                    <button
                                        onClick={handleSubmitReview}
                                        disabled={submitting || review.trim().length < 20}
                                        style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: review.trim().length >= 20 ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(99,102,241,0.3)", color: "#fff", fontWeight: 800, cursor: review.trim().length >= 20 ? "pointer" : "not-allowed", fontSize: 14 }}
                                    >
                                        {submitting ? "提出中..." : "📝 レビューを提出する"}
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}