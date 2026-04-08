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
    const [expanded, setExpanded] = useState<string | null>(null);
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

        const nowIso = new Date().toISOString();
        await supabase.from("content_completions").insert({ user_id: userId, content_id: contentId, created_at: nowIso });

        const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", userId).single();
        const current = pointRow?.points || 0;
        await supabase.from("user_points").update({ points: current + 2 }).eq("id", userId);
        await supabase.from("points_history").insert({ user_id: userId, change: 2, reason: "content_complete", created_at: nowIso });

        setCompletions(prev => [...prev, contentId]);
        setMessage("✅ +2pt 獲得しました！");
        setTimeout(() => setMessage(""), 3000);
        setCompleting(null);
    };

    const getYouTubeId = (url: string) => {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
        return match ? match[1] : null;
    };

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.08) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto" }}>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                    <div>
                        <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>INTERN QUEST</div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>📚 学習コンテンツ</h1>
                        <p style={{ color: "#6b7280", fontSize: 14, margin: "8px 0 0" }}>完了すると +2pt 獲得！</p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <div style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", fontSize: 13, color: "#818cf8", fontWeight: 700 }}>
                            {completions.length} / {contents.length} 完了
                        </div>
                        <button onClick={() => router.push("/mypage")} style={{ background: "rgba(255,255,255,0.05)", color: "#d1d5db", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>マイページ</button>
                    </div>
                </div>

                {message && (
                    <div style={{ marginBottom: 16, padding: "12px 20px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 10, color: "#34d399", fontSize: 14, fontWeight: 600 }}>
                        {message}
                    </div>
                )}

                {contents.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 80, color: "#6b7280", fontSize: 16 }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
                        <div>コンテンツはまだありません</div>
                        <div style={{ fontSize: 13, marginTop: 8 }}>管理者がコンテンツを追加すると表示されます</div>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {contents.map((content) => {
                            const isDone = completions.includes(content.id);
                            const isExpanded = expanded === content.id;
                            const ytId = content.url ? getYouTubeId(content.url) : null;

                            return (
                                <div key={content.id} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${isDone ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 16, overflow: "hidden" }}>
                                    <div onClick={() => setExpanded(isExpanded ? null : content.id)} style={{ padding: "20px 24px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                            <div style={{ width: 44, height: 44, borderRadius: 12, background: content.content_type === "video" ? "rgba(239,68,68,0.15)" : "rgba(99,102,241,0.15)", border: `1px solid ${content.content_type === "video" ? "rgba(239,68,68,0.3)" : "rgba(99,102,241,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                                                {content.content_type === "video" ? "▶️" : "📄"}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb" }}>{content.title}</div>
                                                {content.description && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{content.description}</div>}
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            {isDone ? (
                                                <div style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399", fontSize: 12, fontWeight: 700 }}>✅ 完了</div>
                                            ) : (
                                                <div style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#818cf8", fontSize: 12, fontWeight: 700 }}>+2pt</div>
                                            )}
                                            <span style={{ color: "#6b7280", fontSize: 14 }}>{isExpanded ? "▲" : "▼"}</span>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "24px" }}>
                                            {content.content_type === "video" && ytId && (
                                                <div style={{ marginBottom: 20, borderRadius: 12, overflow: "hidden", aspectRatio: "16/9" }}>
                                                    <iframe
                                                        width="100%" height="100%"
                                                        src={`https://www.youtube.com/embed/${ytId}`} title={content.title}
                                                        style={{ border: "none", display: "block", aspectRatio: "16/9" }}
                                                        allowFullScreen
                                                    />
                                                </div>
                                            )}
                                            {content.content_type === "video" && content.url && !ytId && (
                                                <div style={{ marginBottom: 20 }}>
                                                    <a href={content.url} target="_blank" rel="noreferrer" style={{ color: "#818cf8", textDecoration: "none", fontWeight: 600 }}>🔗 動画を見る →</a>
                                                </div>
                                            )}
                                            {content.body && (
                                                <div style={{ fontSize: 15, color: "#c7d2fe", lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 20 }}>{content.body}</div>
                                            )}
                                            {!isDone && (
                                                <button
                                                    onClick={() => handleComplete(content.id)}
                                                    disabled={completing === content.id}
                                                    style={{ padding: "12px 28px", borderRadius: 10, border: "none", background: completing === content.id ? "rgba(52,211,153,0.3)" : "linear-gradient(135deg, #10b981, #34d399)", color: "#0a0a0f", fontWeight: 800, cursor: "pointer", fontSize: 15 }}
                                                >
                                                    {completing === content.id ? "処理中..." : "✅ 完了！+2pt 獲得"}
                                                </button>
                                            )}
                                            {isDone && <div style={{ fontSize: 14, color: "#34d399", fontWeight: 700 }}>✅ このコンテンツは完了済みです</div>}
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