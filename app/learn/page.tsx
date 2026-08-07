"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

type Content = {
    id: string;
    title: string;
    description: string | null;
    content_type: string;
    url: string | null;
    body: string | null;
    category?: string | null;
    is_required?: boolean;
};
type Completion = {
    id: string;
    content_id: string;
    status: string;
    review: string | null;
    feedback?: string | null;
};

// カテゴリ定義（島画像がある7つ＋絵文字島）
const CATEGORY_DEF: { name: string; img?: string; emoji?: string; color: string }[] = [
    { name: "配属前必修", img: "/categories/cat_haizoku.png", color: "#a78bfa" },
    { name: "必修", img: "/categories/cat_hisshu.png", color: "#8b5cf6" },
    { name: "マインド", img: "/categories/cat_mind.png", color: "#f87171" },
    { name: "社会人の当たり前", img: "/categories/cat_atarimae.png", color: "#fbbf24" },
    { name: "就活・キャリア", img: "/categories/cat_career.png", color: "#38bdf8" },
    { name: "社会人基礎", img: "/categories/cat_kiso.png", color: "#34d399" },
    { name: "AI・スキル", img: "/categories/cat_ai.png", color: "#818cf8" },
    { name: "マインドセット", img: "/categories/cat_mind.png", color: "#fb923c" },
    { name: "思考法・仕事術", img: "/categories/cat_shikou.png", color: "#fcd34d" },
    { name: "営業・ビジネス", img: "/categories/cat_eigyo.png", color: "#a78bfa" },
    { name: "教養・その他", img: "/categories/cat_kyoyo.png", color: "#94a3b8" },
];

function getYouTubeId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : null;
}
function getThumbnail(url: string | null): string | null {
    if (!url) return null;
    const ytId = getYouTubeId(url);
    if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    return null;
}

function LearnPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [userId, setUserId] = useState("");
    const [contents, setContents] = useState<Content[]>([]);
    const [completions, setCompletions] = useState<Completion[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Content | null>(null);
    const [review, setReview] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [catFilter, setCatFilter] = useState<string>("all");

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const { data: contentRows } = await supabase.from("contents").select("*").eq("is_active", true).order("created_at", { ascending: false });
            const cs = (contentRows || []) as Content[];
            setContents(cs);
            const { data: completionRows } = await supabase.from("content_completions").select("id,content_id, status, review, feedback").eq("user_id", user.id);
            setCompletions((completionRows || []) as Completion[]);
            const openId = searchParams.get("open");
            if (openId) {
                const target = cs.find(c => c.id === openId);
                if (target) setSelected(target);
            }
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
        setSubmitting(false);
    };

    if (loading) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
        </main>
    );

    const doneCount = completions.filter(c => c.status === "approved").length;
    const totalCount = contents.length;

    // カテゴリフィルタ適用
    const filtered = catFilter === "all" ? contents : contents.filter(c => c.category === catFilter);
    const videos = filtered.filter(c => c.content_type === "video");
    const articles = filtered.filter(c => c.content_type !== "video");

    // 今日のおすすめクエスト：未完了の必修を優先、なければ未完了の先頭
    const notDone = (c: Content) => {
        const comp = getCompletion(c.id);
        return !comp || comp.status !== "approved";
    };
    // 今日のおすすめ：未完了コンテンツから日替わりで選ぶ（必修に偏らないよう全体から）
    const undoneAll = contents.filter(notDone);
    const dayIndex = new Date().getDate();
    const todayQuest = undoneAll.length > 0 ? undoneAll[dayIndex % undoneAll.length] : contents[0];

    // 必修Quest一覧
    const requiredQuests = contents.filter(c => c.is_required);

    // 実際に使われているカテゴリだけ島表示
    const usedCats = new Set(contents.map(c => c.category).filter(Boolean));
    const shownCats = CATEGORY_DEF.filter(cd => usedCats.has(cd.name));

    // 「まずはここから」3枚
    const starterCats = [
        { name: "配属前必修", label: "配属前必修", desc: "チームの一員としての心構え", img: "/categories/cat_haizoku.png" },
        { name: "必修", label: "必修", desc: "必ず身につけたい基礎スキル", img: "/categories/cat_hisshu.png" },
        { name: "マインド", label: "マインド", desc: "成果を出すための考え方", img: "/categories/cat_mind.png" },
    ].filter(sc => usedCats.has(sc.name));

    const catColor = (name?: string | null) => CATEGORY_DEF.find(c => c.name === name)?.color || "#8b5cf6";

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "36px 18px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 50% 12%, rgba(139,92,246,0.12) 0%, transparent 55%)", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto" }}>

                {/* ヘッダー */}
                <div style={{ marginBottom: 18 }}>
                    <div onClick={() => router.push("/home")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>📚 学習コンテンツ</h1>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                        <span style={{ fontSize: 12.5, color: "#9ca3af" }}>視聴・読了してレビューを提出すると <span style={{ color: "#34d399", fontWeight: 700 }}>+2pt</span></span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#a78bfa" }}>{doneCount} / {totalCount} 完了</span>
                        <div style={{ flex: 1, maxWidth: 220, height: 8, borderRadius: 999, background: "rgba(255,255,255,.07)" }}>
                            <div style={{ height: "100%", width: `${totalCount ? (doneCount / totalCount) * 100 : 0}%`, borderRadius: 999, background: "linear-gradient(90deg,#8b5cf6,#a78bfa)" }} />
                        </div>
                    </div>
                </div>

                {/* ===== まずはここから（3枚・補助） ===== */}
                {starterCats.length > 0 && catFilter === "all" && (
                    <div style={{ marginBottom: 26 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 800, color: "#8b8fa8", letterSpacing: 2, marginBottom: 10 }}>🌱 まずはここから</div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            {starterCats.map(sc => (
                                <div key={sc.name} onClick={() => setCatFilter(sc.name)}
                                    style={{ flex: "1 1 160px", minWidth: 150, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid rgba(139,92,246,.2)" }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={sc.img} alt={sc.label} style={{ width: 44, height: 44, objectFit: "contain", flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 800, color: "#f9fafb" }}>{sc.label}</div>
                                        <div style={{ fontSize: 10.5, color: "#8b8fa8", lineHeight: 1.4, marginTop: 2 }}>{sc.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ===== ① 今日のおすすめクエスト（主役） ===== */}
                {todayQuest && catFilter === "all" && (
                    <div style={{ marginBottom: 28, borderRadius: 22, padding: "26px 26px 24px", position: "relative", overflow: "hidden", background: "linear-gradient(140deg, #3a1f6e 0%, #241452 45%, #120c30 100%)", border: "1.5px solid rgba(167,139,250,.55)", boxShadow: "0 10px 46px rgba(124,74,220,.35)" }}>
                        <div style={{ position: "absolute", top: 16, right: 30, fontSize: 13, opacity: .7 }}>✦</div>
                        <div style={{ position: "absolute", top: 50, right: 90, fontSize: 9, opacity: .5 }}>✦</div>
                        <div style={{ position: "absolute", bottom: 20, right: 20, fontSize: 60, opacity: .12 }}>📖</div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 999, background: "rgba(255,215,0,.14)", border: "1px solid rgba(255,215,0,.4)", marginBottom: 12 }}>
                            <span style={{ fontSize: 11 }}>👑</span>
                            <span style={{ fontSize: 11, fontWeight: 900, color: "#ffd76a", letterSpacing: 1 }}>今日のおすすめクエスト</span>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1.3 }}>{todayQuest.title}</div>
                        {todayQuest.description && <div style={{ fontSize: 13.5, color: "#c2b8ee", marginTop: 8, lineHeight: 1.6 }}>{todayQuest.description}</div>}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                            <span style={{ fontSize: 13 }}>💎</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#a78bfa" }}>クリア報酬 +2pt</span>
                        </div>
                        <button onClick={() => { setSelected(todayQuest); setReview(getCompletion(todayQuest.id)?.review || ""); }}
                            style={{ width: "100%", marginTop: 18, padding: "15px", borderRadius: 999, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #a78bfa, #7c5cf0)", color: "#fff", fontSize: 15, fontWeight: 900, boxShadow: "0 6px 24px rgba(139,92,246,.55)", letterSpacing: 1 }}>
                            ▶ 今すぐ学習をはじめる
                        </button>
                    </div>
                )}

                {/* ===== ② カテゴリ島（横スクロール・主役） ===== */}
                <div style={{ marginBottom: 28 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#8b8fa8", letterSpacing: 2 }}>🗺️ 学習の冒険マップ</span>
                        {catFilter !== "all" && <button onClick={() => setCatFilter("all")} style={{ fontSize: 11.5, color: "#a78bfa", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>すべて表示 ✕</button>}
                    </div>
                    <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8 }}>
                        {/* すべて島 */}
                        <div onClick={() => setCatFilter("all")} style={{ flexShrink: 0, textAlign: "center", cursor: "pointer", width: 84 }}>
                            <div style={{ width: 76, height: 76, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, background: catFilter === "all" ? "radial-gradient(circle, rgba(167,139,250,.4), rgba(124,92,240,.15))" : "rgba(255,255,255,.04)", border: `2px solid ${catFilter === "all" ? "#a78bfa" : "rgba(255,255,255,.12)"}`, boxShadow: catFilter === "all" ? "0 0 18px rgba(167,139,250,.5)" : "none", margin: "0 auto" }}>🏠</div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: catFilter === "all" ? "#e4dcff" : "#9ca3af", marginTop: 6 }}>すべて</div>
                        </div>
                        {shownCats.map(cd => {
                            const active = catFilter === cd.name;
                            return (
                                <div key={cd.name} onClick={() => setCatFilter(cd.name)} style={{ flexShrink: 0, textAlign: "center", cursor: "pointer", width: 84 }}>
                                    <div style={{ width: 76, height: 76, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: active ? `radial-gradient(circle, ${cd.color}44, transparent)` : "transparent", border: active ? `2px solid ${cd.color}` : "2px solid transparent", boxShadow: active ? `0 0 18px ${cd.color}88` : "none", margin: "0 auto" }}>
                                        {cd.img ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={cd.img} alt={cd.name} style={{ width: 72, height: 72, objectFit: "contain" }} />
                                        ) : (
                                            <span style={{ fontSize: 30 }}>{cd.emoji}</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 10.5, fontWeight: 800, color: active ? "#fff" : "#9ca3af", marginTop: 6, lineHeight: 1.2 }}>{cd.name}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {message && <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(52,211,153,.1)", border: "1px solid rgba(52,211,153,.3)", color: "#34d399", fontSize: 13, fontWeight: 700 }}>{message}</div>}

                {/* ===== ③ 必修Quest ===== */}
                {requiredQuests.length > 0 && (catFilter === "all") && (
                    <div style={{ marginBottom: 28 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#8b8fa8", letterSpacing: 2, marginBottom: 12 }}>📜 あなたの必修クエスト</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {requiredQuests.map((c, i) => {
                                const comp = getCompletion(c.id);
                                const done = comp?.status === "approved";
                                const pending = comp?.status === "pending";
                                return (
                                    <div key={c.id} onClick={() => { setSelected(c); setReview(comp?.review || ""); }}
                                        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14, background: done ? "rgba(52,211,153,.06)" : "rgba(255,255,255,.03)", border: `1px solid ${done ? "rgba(52,211,153,.3)" : "rgba(139,92,246,.28)"}` }}>
                                        <div style={{ fontSize: 22, flexShrink: 0 }}>{done ? "✅" : "📜"}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa" }}>Quest {i + 1}</div>
                                            <div style={{ fontSize: 14.5, fontWeight: 800, color: done ? "#34d399" : "#f9fafb", marginTop: 1 }}>{c.title}</div>
                                        </div>
                                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                                            <div style={{ fontSize: 11, color: "#8b8fa8" }}>報酬 +2pt</div>
                                            <div style={{ marginTop: 4, fontSize: 11, fontWeight: 900, padding: "4px 12px", borderRadius: 999, background: done ? "rgba(52,211,153,.15)" : pending ? "rgba(251,191,36,.15)" : "linear-gradient(135deg, #8b5cf6, #6366f1)", color: done ? "#34d399" : pending ? "#fbbf24" : "#fff", display: "inline-block" }}>
                                                {done ? "完了" : pending ? "審査中" : "今すぐ学習"}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ===== ④ 動画（Netflix風） ===== */}
                {videos.length > 0 && (
                    <div style={{ marginBottom: 28 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#8b8fa8", letterSpacing: 2, marginBottom: 12 }}>▶️ {catFilter === "all" ? "おすすめ動画" : catFilter}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
                            {videos.map(content => {
                                const comp = getCompletion(content.id);
                                const done = comp?.status === "approved";
                                const thumb = getThumbnail(content.url);
                                return (
                                    <div key={content.id} className="nflx-card" onClick={() => { setSelected(content); setReview(comp?.review || ""); }}
                                        style={{ cursor: "pointer", borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", transition: "transform .18s, box-shadow .18s" }}>
                                        <div style={{ position: "relative", aspectRatio: "16/9", background: "#1a1a2e" }}>
                                            {thumb && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={thumb} alt={content.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                            )}
                                            <div className="nflx-play" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.25)", opacity: 0, transition: "opacity .18s" }}>
                                                <span style={{ fontSize: 34 }}>▶️</span>
                                            </div>
                                            {done && <span style={{ position: "absolute", top: 8, left: 8, fontSize: 11, fontWeight: 900, color: "#0a0a0f", background: "#34d399", borderRadius: 6, padding: "2px 8px" }}>✓ 完了</span>}
                                        </div>
                                        <div style={{ padding: "10px 12px" }}>
                                            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#f9fafb", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{content.title}</div>
                                            {content.category && <div style={{ fontSize: 10, fontWeight: 700, color: catColor(content.category), marginTop: 6 }}>{content.category}</div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ===== 記事（article） ===== */}
                {articles.length > 0 && (
                    <div style={{ marginBottom: 28 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#8b8fa8", letterSpacing: 2, marginBottom: 12 }}>📄 読み物コンテンツ</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {articles.map(content => {
                                const comp = getCompletion(content.id);
                                const done = comp?.status === "approved";
                                const pending = comp?.status === "pending";
                                return (
                                    <div key={content.id} onClick={() => { setSelected(content); setReview(comp?.review || ""); }}
                                        style={{ cursor: "pointer", padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,.03)", border: `1px solid ${done ? "rgba(52,211,153,.3)" : "rgba(255,255,255,.08)"}` }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: 16 }}>{done ? "✅" : "📄"}</span>
                                            <span style={{ fontSize: 14, fontWeight: 800, color: done ? "#34d399" : "#f9fafb" }}>{content.title}</span>
                                            {content.is_required && <span style={{ fontSize: 9.5, fontWeight: 900, color: "#fca5a5", background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 5, padding: "2px 7px" }}>📌 必修</span>}
                                            {pending && <span style={{ fontSize: 9.5, fontWeight: 900, color: "#fbbf24", background: "rgba(251,191,36,.15)", border: "1px solid rgba(251,191,36,.4)", borderRadius: 5, padding: "2px 7px" }}>審査中</span>}
                                            {content.category && <span style={{ fontSize: 9.5, fontWeight: 800, color: catColor(content.category), marginLeft: "auto" }}>{content.category}</span>}
                                        </div>
                                        {content.description && <div style={{ fontSize: 12, color: "#8b8fa8", lineHeight: 1.5 }}>{content.description}</div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {filtered.length === 0 && (
                    <div style={{ textAlign: "center", color: "#6b7280", fontSize: 13, padding: "32px 0" }}>このカテゴリのコンテンツはまだありません</div>
                )}

                {/* ===== 詳細モーダル（既存ロジック維持） ===== */}
                {selected && (
                    <div onClick={() => { setSelected(null); setMessage(""); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }}>
                        <div onClick={(e) => e.stopPropagation()} style={{ background: "#0f0f1a", border: "1px solid rgba(139,92,246,.3)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto", margin: "auto" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
                                <h2 style={{ fontSize: 19, fontWeight: 800, color: "#f9fafb", margin: 0 }}>{selected.title}</h2>
                                <button onClick={() => { setSelected(null); setMessage(""); }} style={{ background: "none", border: "none", color: "#8b8fa8", fontSize: 24, cursor: "pointer", lineHeight: 1, flexShrink: 0 }}>×</button>
                            </div>

                            {selected.content_type === "video" && selected.url && getYouTubeId(selected.url) ? (
                                <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
                                    <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${getYouTubeId(selected.url)}`} title={selected.title} style={{ border: "none", display: "block", aspectRatio: "16/9" }} allowFullScreen />
                                </div>
                            ) : (
                                (selected.body || selected.url) && (
                                    (selected.body?.startsWith("http") || (!selected.body && selected.url)) ? (
                                        <div style={{ marginBottom: 20 }}>
                                            <a href={((selected.body?.startsWith("http") ? selected.body : selected.url) || "").trim()} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 12, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", textDecoration: "none" }}>
                                                <span style={{ fontSize: 22 }}>🔗</span>
                                                <div style={{ overflow: "hidden" }}>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: "#c7d2fe" }}>資料を開く</div>
                                                    <div style={{ fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{((selected.body?.startsWith("http") ? selected.body : selected.url) || "").trim()}</div>
                                                </div>
                                            </a>
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 15, color: "#c7d2fe", lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 24, padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                            {selected.body}
                                        </div>
                                    )
                                )
                            )}

                            {selected.description && <p style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.7, marginBottom: 20 }}>{selected.description}</p>}

                            {/* レビュー提出（既存ロジック） */}
                            {(() => {
                                const comp = getCompletion(selected.id);
                                const done = comp?.status === "approved";
                                if (done) {
                                    return (
                                        <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(52,211,153,.08)", border: "1px solid rgba(52,211,153,.3)" }}>
                                            <div style={{ fontSize: 13, fontWeight: 800, color: "#34d399", marginBottom: 6 }}>✅ 完了済み</div>
                                            {comp?.review && <div style={{ fontSize: 12.5, color: "#c7d2fe", lineHeight: 1.6 }}>あなたのレビュー: {comp.review}</div>}
                                            {comp?.feedback && <div style={{ fontSize: 12, color: "#a78bfa", marginTop: 6 }}>💬 FB: {comp.feedback}</div>}
                                        </div>
                                    );
                                }
                                return (
                                    <div>
                                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#c7c9dd", marginBottom: 8 }}>📝 学んだこと・感想を書いて提出（+2pt）</div>
                                        <textarea value={review} onChange={(e) => setReview(e.target.value)} placeholder="このコンテンツから学んだこと、意識したいことなど"
                                            style={{ width: "100%", height: 100, padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.05)", color: "#f9fafb", fontSize: 14, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 12 }} />
                                        <button onClick={handleSubmitReview} disabled={submitting || !review.trim()}
                                            style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", cursor: submitting || !review.trim() ? "not-allowed" : "pointer", background: submitting || !review.trim() ? "rgba(139,92,246,.4)" : "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontSize: 14, fontWeight: 800 }}>
                                            {submitting ? "提出中..." : "レビューを提出する"}
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {/* メニューへ戻る */}
                <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>
                        メニューへ戻る
                    </button>
                </div>
            </div>

            <style>{`
                .nflx-card:hover { transform: translateY(-4px) scale(1.03); box-shadow: 0 8px 28px rgba(139,92,246,.45); border-color: rgba(167,139,250,.6) !important; }
                .nflx-card:hover .nflx-play { opacity: 1 !important; }
            `}</style>
        </main>
    );
}

export default function LearnPage() {
    return (
        <Suspense fallback={null}>
            <LearnPageInner />
        </Suspense>
    );
}
