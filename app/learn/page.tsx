// v3
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
};

export default function LearnPage() {
    const router = useRouter();
    const [userId, setUserId] = useState("");
    const [contents, setContents] = useState<Content[]>([]);
    const [completions, setCompletions] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [completing, setCompleting] = useState<string | null>(null);
    const [selected, setSelected] = useState<Content | null>(null);
    const [message, setMessage] = useState("");

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const { data: contentRows } = await supabase.from("contents").select("*").eq("is_active", true).order("created_at", { ascending: false });
            setContents((contentRows || []) as Content[]);
            const { data: completionRows } = await supabase.from("content_completions").select("content_id").eq("user_id", user.id);
            setCompletions((completionRows || []).map((r: any) => r.content_id));
            setLoading(false);
        };
        load();
    }, [router]);

    const handleComplete = async (contentId: string) => {
        if (completions.includes(contentId)) return;
        setCompleting(contentId);
        await supabase.from("content_completions").insert({ user_id: userId, content_id: contentId });
        const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", userId).single();
        const current = pointRow?.points || 0;
        await supabase.from("user_points").update({ points: current + 2 }).eq("id", userId);
        await supabase.from("points_history").insert({ user_id: userId, change: 2, reason: "content_complete" });
        setCompletions(prev => [...prev, contentId]);
        setMessage("✅ +2pt 獲得しました！");
        setTimeout(() => setMessage(""), 3000);
        setCompleting(null);
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

    const videos = contents.filter(c => c.content_type === "video");
    const articles = contents.filter(c => c.content_type !== "video");

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", fontFamily: "'Inter', sans-serif" }}>

            {/* ヒーローヘッダー */}
            <div style={{ padding: "40px 32px 24px", background: "linear-gradient(180deg, rgba(99,102,241,0.15) 0%, transparent 100%)" }}>
                <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", marginBottom: 8 }}>INTERN QUEST</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                        <h1 style={{ fontSize: 32, fontWeight: 900, color: "#f9fafb", margin: 0 }}>学習コンテンツ</h1>
                        <p style={{ color: "#9ca3af", fontSize: 14, margin: "8px 0 0" }}>視聴・読了で <span style={{ color: "#818cf8", fontWeight: 700 }}>+2pt</span> 獲得！　{completions.length} / {contents.length} 完了</p>
                    </div>
                    <button onClick={() => router.push("/menu")} style={{ background: "rgba(255,255,255,0.08)", color: "#d1d5db", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>← メニュー</button>
                </div>
            </div>

            {message && (
                <div style={{ margin: "0 32px 16px", padding: "12px 20px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 10, color: "#34d399", fontSize: 14, fontWeight: 600 }}>
                    {message}
                </div>
            )}

            {contents.length === 0 ? (
                <div style={{ textAlign: "center", padding: 80, color: "#6b7280" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
                    <div>コンテンツはまだありません</div>
                </div>
            ) : (
                <div style={{ paddingBottom: 64 }}>

                    {/* 動画セクション */}
                    {videos.length > 0 && (
                        <div style={{ marginBottom: 40 }}>
                            <div style={{ padding: "24px 32px 16px", fontSize: 20, fontWeight: 800, color: "#f9fafb" }}>
                                ▶️ 動画
                            </div>
                            <div style={{ display: "flex", gap: 16, overflowX: "auto", padding: "0 32px 16px", scrollbarWidth: "none" }}>
                                {videos.map(content => {
                                    const isDone = completions.includes(content.id);
                                    const thumb = getThumbnail(content);
                                    return (
                                        <div
                                            key={content.id}
                                            onClick={() => setSelected(content)}
                                            style={{ flexShrink: 0, width: 260, cursor: "pointer", borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: `1px solid ${isDone ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.08)"}`, transition: "transform 0.2s", position: "relative" }}
                                            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = "scale(1.03)"}
                                            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"}
                                        >
                                            {/* サムネイル */}
                                            <div style={{ width: "100%", height: 146, background: "rgba(99,102,241,0.15)", position: "relative", overflow: "hidden" }}>
                                                {thumb ? (
                                                    <img src={thumb} alt={content.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                ) : (
                                                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>▶️</div>
                                                )}
                                                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>▶</div>
                                                </div>
                                                {isDone && (
                                                    <div style={{ position: "absolute", top: 8, right: 8, background: "#34d399", color: "#0a0a0f", fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6 }}>✅ 完了</div>
                                                )}
                                            </div>
                                            <div style={{ padding: "12px 14px" }}>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 4, lineHeight: 1.4 }}>{content.title}</div>
                                                {content.description && <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{content.description}</div>}
                                                <div style={{ marginTop: 8, fontSize: 12, color: isDone ? "#34d399" : "#818cf8", fontWeight: 700 }}>{isDone ? "✅ 視聴済み" : "+2pt"}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 記事セクション */}
                    {articles.length > 0 && (
                        <div>
                            <div style={{ padding: "0 32px 16px", fontSize: 20, fontWeight: 800, color: "#f9fafb" }}>
                                📄 記事・資料
                            </div>
                            <div style={{ display: "flex", gap: 16, overflowX: "auto", padding: "0 32px 16px", scrollbarWidth: "none" }}>
                                {articles.map(content => {
                                    const isDone = completions.includes(content.id);
                                    return (
                                        <div
                                            key={content.id}
                                            onClick={() => setSelected(content)}
                                            style={{ flexShrink: 0, width: 220, cursor: "pointer", borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: `1px solid ${isDone ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.08)"}`, transition: "transform 0.2s" }}
                                            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = "scale(1.03)"}
                                            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"}
                                        >
                                            <div style={{ width: "100%", height: 120, background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, position: "relative" }}>
                                                📄
                                                {isDone && (
                                                    <div style={{ position: "absolute", top: 8, right: 8, background: "#34d399", color: "#0a0a0f", fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6 }}>✅ 完了</div>
                                                )}
                                            </div>
                                            <div style={{ padding: "12px 14px" }}>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 4, lineHeight: 1.4 }}>{content.title}</div>
                                                {content.description && <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{content.description}</div>}
                                                <div style={{ marginTop: 8, fontSize: 12, color: isDone ? "#34d399" : "#818cf8", fontWeight: 700 }}>{isDone ? "✅ 読了済み" : "+2pt"}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* コンテンツ詳細モーダル */}
            {selected && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setSelected(null)}>
                    <div onClick={e => e.stopPropagation()} style={{ background: "#0f0f1a", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 20, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}>
                        {/* 動画プレイヤー or 記事ヘッダー */}
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
                                <div style={{ fontSize: 15, color: "#c7d2fe", lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 24, padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                    {selected.body}
                                </div>
                            )}

                            {selected.url && !getYouTubeId(selected.url) && (
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>🔗 参考リンク</div>
                                    <a href={selected.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 12, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", textDecoration: "none", transition: "all 0.2s" }}
                                        onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = "rgba(99,102,241,0.15)"}
                                        onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = "rgba(99,102,241,0.08)"}
                                    >
                                        <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🌐</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", marginBottom: 2 }}>記事を読む</div>
                                            <div style={{ fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.url}</div>
                                        </div>
                                        <div style={{ fontSize: 16, color: "#818cf8", flexShrink: 0 }}>→</div>
                                    </a>
                                </div>
                            )}

                            <div style={{ display: "flex", gap: 10 }}>
                                <button onClick={() => setSelected(null)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>閉じる</button>
                                {!completions.includes(selected.id) ? (
                                    <button
                                        onClick={() => handleComplete(selected.id)}
                                        disabled={completing === selected.id}
                                        style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #10b981, #34d399)", color: "#0a0a0f", fontWeight: 800, cursor: "pointer", fontSize: 14 }}
                                    >
                                        {completing === selected.id ? "処理中..." : "✅ 完了！+2pt 獲得"}
                                    </button>
                                ) : (
                                    <div style={{ flex: 2, padding: "12px", borderRadius: 10, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399", fontWeight: 700, fontSize: 14, textAlign: "center" }}>✅ 完了済み</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}