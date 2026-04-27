"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Challenge = {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    points: number;
    icon: string;
    is_active: boolean;
};

type Submission = {
    id: string;
    user_id: string;
    challenge_id: string;
    comment: string | null;
    image_url: string | null;
    status: string;
    created_at: string;
};

const CATEGORY_COLORS: Record<string, string> = {
    "食": "#f59e0b",
    "旅": "#06b6d4",
    "スポーツ": "#34d399",
    "文化": "#8b5cf6",
    "仕事": "#6366f1",
    "その他": "#6b7280",
};

export default function ChallengePage() {
    const router = useRouter();
    const [userId, setUserId] = useState("");
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
    const [comment, setComment] = useState("");
    const [image, setImage] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);

            const { data: challengeRows } = await supabase.from("challenges").select("*").eq("is_active", true).order("created_at");
            setChallenges((challengeRows || []) as Challenge[]);

            const { data: submissionRows } = await supabase.from("challenge_submissions").select("*").eq("user_id", user.id);
            setSubmissions((submissionRows || []) as Submission[]);

            setLoading(false);
        };
        load();
    }, []);

    const getSubmission = (challengeId: string) => submissions.find(s => s.challenge_id === challengeId);

    const handleFileSelect = (file: File) => {
        if (!file.type.startsWith("image/")) return;
        setImage(file);
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        if (!selectedChallenge) return;
        if (!comment.trim()) { setMessage("コメントを入力してください"); return; }
        // ✅ 写真必須チェック
        if (!image) { setMessage("写真を選択してください"); return; }
        setSending(true);
        setMessage("");

        let imageUrl: string | null = null;
        if (image) {
            const ext = image.name.split(".").pop();
            const filePath = `challenges/${userId}/${selectedChallenge.id}.${ext}`;
            const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, image, { upsert: true });
            if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
                imageUrl = publicUrl;
            }
        }

        await supabase.from("challenge_submissions").insert({
            user_id: userId,
            challenge_id: selectedChallenge.id,
            comment: comment.trim(),
            image_url: imageUrl,
            status: "pending",
        });

        const { data: submissionRows } = await supabase.from("challenge_submissions").select("*").eq("user_id", userId);
        setSubmissions((submissionRows || []) as Submission[]);

        setMessage("✅ 申請を送信しました！承認をお待ちください。");
        setComment("");
        setImage(null);
        setPreview(null);
        setSelectedChallenge(null);
        setSending(false);
    };

    const categories = ["all", ...new Set(challenges.map(c => c.category || "その他"))];
    const filteredChallenges = selectedCategory === "all" ? challenges : challenges.filter(c => (c.category || "その他") === selectedCategory);
    const completedCount = submissions.filter(s => s.status === "approved").length;

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(245,158,11,0.08) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto" }}>

                {/* ===== ヘッダー（統一） ===== */}
                <div style={{ marginBottom: 24 }}>
                    <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>🎯 ライフチャレンジ</h1>
                    <p style={{ color: "#6b7280", fontSize: 14, margin: "8px 0 0" }}>人生の経験値を積んでスタンプを集めよう！</p>
                </div>

                <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>🏆 達成スタンプ</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#fbbf24" }}>{completedCount} / {challenges.length}</div>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
                        <div style={{ height: "100%", width: `${challenges.length > 0 ? (completedCount / challenges.length) * 100 : 0}%`, background: "linear-gradient(90deg, #f59e0b, #fbbf24)", borderRadius: 999, transition: "width 0.8s ease" }} />
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
                        申請中: {submissions.filter(s => s.status === "pending").length}件　却下: {submissions.filter(s => s.status === "rejected").length}件
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                    {categories.map(cat => (
                        <button key={cat} onClick={() => setSelectedCategory(cat)} style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer", fontSize: 12, background: selectedCategory === cat ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: selectedCategory === cat ? "#fff" : "#9ca3af" }}>
                            {cat === "all" ? `すべて (${challenges.length})` : `${cat} (${challenges.filter(c => (c.category || "その他") === cat).length})`}
                        </button>
                    ))}
                </div>

                {filteredChallenges.length === 0 ? (
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 60, textAlign: "center" }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
                        <div style={{ color: "#6b7280", fontSize: 16 }}>チャレンジがまだありません</div>
                    </div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                        {filteredChallenges.map(challenge => {
                            const submission = getSubmission(challenge.id);
                            const isApproved = submission?.status === "approved";
                            const isPending = submission?.status === "pending";
                            const catColor = CATEGORY_COLORS[challenge.category || "その他"] || "#6b7280";

                            return (
                                <div key={challenge.id}
                                    onClick={() => !isApproved && !isPending && setSelectedChallenge(challenge)}
                                    style={{ background: isApproved ? "rgba(52,211,153,0.08)" : isPending ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${isApproved ? "rgba(52,211,153,0.3)" : isPending ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 16, padding: 20, cursor: isApproved || isPending ? "default" : "pointer", position: "relative", transition: "all 0.2s" }}
                                    onMouseEnter={(e) => { if (!isApproved && !isPending) (e.currentTarget as HTMLDivElement).style.borderColor = `${catColor}60`; }}
                                    onMouseLeave={(e) => { if (!isApproved && !isPending) (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
                                >
                                    <div style={{ fontSize: 40, marginBottom: 12, filter: isApproved ? "none" : "grayscale(0.3)", opacity: isApproved ? 1 : isPending ? 0.7 : 0.6 }}>
                                        {challenge.icon}
                                    </div>
                                    {isApproved && (
                                        <div style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #34d399, #10b981)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✓</div>
                                    )}
                                    {isPending && (
                                        <div style={{ position: "absolute", top: 12, right: 12, padding: "3px 8px", borderRadius: 6, background: "rgba(251,191,36,0.2)", color: "#fbbf24", fontSize: 10, fontWeight: 700 }}>申請中</div>
                                    )}
                                    <div style={{ fontSize: 14, fontWeight: 700, color: isApproved ? "#34d399" : "#f9fafb", marginBottom: 6 }}>{challenge.title}</div>
                                    {challenge.description && <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 8 }}>{challenge.description}</div>}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        {challenge.category && <span style={{ fontSize: 11, color: catColor, fontWeight: 600 }}>{challenge.category}</span>}
                                        <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8" }}>+{challenge.points}pt</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {selectedChallenge && (
                    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                        <div style={{ background: "#0f0f1a", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 20, padding: 40, width: "100%", maxWidth: 500 }}>
                            <div style={{ fontSize: 40, marginBottom: 12, textAlign: "center" }}>{selectedChallenge.icon}</div>
                            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f9fafb", margin: "0 0 8px", textAlign: "center" }}>{selectedChallenge.title}</h2>
                            <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center", margin: "0 0 24px" }}>達成報告をして +{selectedChallenge.points}pt ゲット！</p>

                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>コメント（必須）</div>
                                <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="どんな経験でしたか？感想を書いてください" style={{ width: "100%", height: 100, padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                {/* ✅ 任意 → 必須 に変更 */}
                                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>写真（必須）</div>
                                {preview ? (
                                    <div style={{ position: "relative" }}>
                                        <img src={preview} alt="preview" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 10 }} />
                                        <button onClick={() => { setImage(null); setPreview(null); }} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", cursor: "pointer", fontSize: 16 }}>×</button>
                                    </div>
                                ) : (
                                    <div onClick={() => fileInputRef.current?.click()} style={{ border: "2px dashed rgba(99,102,241,0.4)", borderRadius: 10, padding: "24px", textAlign: "center", cursor: "pointer" }}>
                                        <div style={{ fontSize: 24, marginBottom: 8 }}>📸</div>
                                        <div style={{ fontSize: 13, color: "#9ca3af" }}>クリックして写真を選択<span style={{ color: "#f87171", marginLeft: 4 }}>*</span></div>
                                    </div>
                                )}
                                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
                            </div>

                            {message && <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: message.includes("✅") ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${message.includes("✅") ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`, color: message.includes("✅") ? "#34d399" : "#f87171", fontSize: 13, fontWeight: 600 }}>{message}</div>}

                            <div style={{ display: "flex", gap: 10 }}>
                                <button onClick={() => { setSelectedChallenge(null); setComment(""); setImage(null); setPreview(null); setMessage(""); }} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>キャンセル</button>
                                <button onClick={handleSubmit} disabled={sending} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: sending ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: sending ? "not-allowed" : "pointer", fontSize: 14 }}>
                                    {sending ? "送信中..." : "🎯 達成報告する"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== メニューへ戻るボタン（統一） ===== */}
                <div style={{ display: "flex", justifyContent: "center", marginTop: 48, marginBottom: 32 }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>
                        メニューへ戻る
                    </button>
                </div>
            </div>
        </main>
    );
}