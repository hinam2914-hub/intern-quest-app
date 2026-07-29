"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Rookie = {
    id: string;
    block: string;
    title: string;
    description: string | null;
    order_no: number;
    requires_photo: boolean;
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

// ブロックの表示定義（順序・色・アイコン・説明）
const BLOCKS: { key: string; label: string; desc: string; icon: string; color: string }[] = [
    { key: "①コミュ基礎", label: "コミュ基礎", desc: "チャット・報連相の型を身につける", icon: "💬", color: "#8b5cf6" },
    { key: "②研修・同行", label: "研修・同行", desc: "研修と同行で学ぶ姿勢をつくる", icon: "📝", color: "#06b6d4" },
    { key: "③初稼働まで", label: "初稼働まで", desc: "現場に出る準備を整える", icon: "🚀", color: "#f59e0b" },
    { key: "④人間力", label: "人間力", desc: "信頼される人になる", icon: "🌱", color: "#10b981" },
];

export default function RookiePage() {
    const router = useRouter();
    const [userId, setUserId] = useState("");
    const [items, setItems] = useState<Rookie[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Rookie | null>(null);
    const [comment, setComment] = useState("");
    const [image, setImage] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState("");
    const [activeBlock, setActiveBlock] = useState("①コミュ基礎");
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const { data: itemRows } = await supabase.from("rookie_challenges").select("*").eq("is_active", true).order("order_no");
            setItems((itemRows || []) as Rookie[]);
            const { data: subRows } = await supabase.from("rookie_submissions").select("*").eq("user_id", user.id);
            setSubmissions((subRows || []) as Submission[]);
            setLoading(false);
        };
        load();
    }, []);

    const getSubmission = (itemId: string) => {
        const subs = submissions.filter(s => s.challenge_id === itemId);
        return subs.find(s => s.status === "approved") || subs[0];
    };

    const handleFileSelect = (file: File) => {
        if (!file.type.startsWith("image/")) return;
        setImage(file);
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        if (!selected) return;
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

        // 自己申告なので即 approved
        await supabase.from("rookie_submissions").insert({
            user_id: userId,
            challenge_id: selected.id,
            comment: comment.trim(),
            image_url: imageUrl,
            status: "approved",
        });

        const { data: subRows } = await supabase.from("rookie_submissions").select("*").eq("user_id", userId);
        setSubmissions((subRows || []) as Submission[]);

        setMessage("✅ 達成しました！");
        setComment("");
        setImage(null);
        setPreview(null);
        setSelected(null);
        setSending(false);
    };

    // 達成の取り消し
    const handleUndo = async (itemId: string) => {
        await supabase.from("rookie_submissions").delete().eq("user_id", userId).eq("challenge_id", itemId);
        const { data: subRows } = await supabase.from("rookie_submissions").select("*").eq("user_id", userId);
        setSubmissions((subRows || []) as Submission[]);
    };

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    const completedCount = submissions.filter(s => s.status === "approved").length;
    const totalCount = items.length;
    const blockItems = items
        .filter(i => i.block === activeBlock)
        .sort((a, b) => a.order_no - b.order_no);
    const activeBlockDef = BLOCKS.find(b => b.key === activeBlock) || BLOCKS[0];

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(139,92,246,0.08) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto" }}>

                {/* ===== ヘッダー ===== */}
                <div style={{ marginBottom: 24 }}>
                    <div onClick={() => router.push("/home")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>🏅 一人前チャレンジ</h1>
                    <p style={{ color: "#9ca3af", fontSize: 14, margin: "8px 0 0" }}>項目をクリアして、一人前への道を進もう！</p>
                </div>

                {/* ===== 全体進捗 ===== */}
                <div style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa" }}>🏆 達成状況</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#a78bfa" }}>{completedCount} / {totalCount}</div>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
                        <div style={{ height: "100%", width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`, background: "linear-gradient(90deg, #8b5cf6, #a78bfa)", borderRadius: 999, transition: "width 0.8s ease" }} />
                    </div>
                </div>

                {/* ===== ブロック切り替えタブ ===== */}
                <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                    {BLOCKS.map(b => {
                        const count = items.filter(i => i.block === b.key).length;
                        const done = submissions.filter(s => {
                            const it = items.find(i => i.id === s.challenge_id);
                            return it && it.block === b.key && s.status === "approved";
                        }).length;
                        const active = activeBlock === b.key;
                        if (count === 0) return null;
                        return (
                            <button key={b.key} onClick={() => setActiveBlock(b.key)}
                                style={{
                                    display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12,
                                    background: active ? `${b.color}22` : "rgba(255,255,255,0.03)",
                                    border: `1px solid ${active ? b.color : "rgba(255,255,255,0.08)"}`,
                                    color: active ? "#f9fafb" : "#9ca3af", cursor: "pointer", transition: "all 0.15s",
                                    fontWeight: active ? 800 : 600, fontSize: 14,
                                }}>
                                <span style={{ fontSize: 18 }}>{b.icon}</span>
                                <span>{b.label}</span>
                                <span style={{ fontSize: 11, color: active ? b.color : "#6b7280", fontWeight: 700 }}>{done}/{count}</span>
                            </button>
                        );
                    })}
                </div>

                {/* ===== ブロック説明 ===== */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, color: "#9ca3af" }}>{activeBlockDef.desc}</div>
                </div>

                {/* ===== 項目グリッド ===== */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                    {blockItems.map(item => {
                        const submission = getSubmission(item.id);
                        const isDone = submission?.status === "approved";
                        const color = activeBlockDef.color;
                        return (
                            <div key={item.id}
                                onClick={() => !isDone && setSelected(item)}
                                style={{
                                    background: isDone ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.03)",
                                    border: `1px solid ${isDone ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.08)"}`,
                                    borderRadius: 16, padding: 18, cursor: isDone ? "default" : "pointer",
                                    position: "relative", transition: "all 0.2s",
                                }}>
                                {isDone && (
                                    <div style={{ position: "absolute", top: 12, right: 12, width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #34d399, #10b981)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✓</div>
                                )}
                                <div style={{ fontSize: 14, fontWeight: 700, color: isDone ? "#34d399" : "#f9fafb", marginBottom: 6, paddingRight: 28 }}>{item.title}</div>
                                {item.description && <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 8 }}>{item.description}</div>}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                                    {item.requires_photo
                                        ? <span style={{ fontSize: 11, color: color, fontWeight: 600 }}>📸 写真＋エピソード</span>
                                        : <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>📝 エピソード</span>}
                                    {isDone && (
                                        <button onClick={(e) => { e.stopPropagation(); handleUndo(item.id); }}
                                            style={{ fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                                            取り消す
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ===== 達成モーダル ===== */}
                {selected && (
                    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                        <div style={{ background: "#0f0f1a", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 20, padding: 40, width: "100%", maxWidth: 500 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f9fafb", margin: "0 0 8px", textAlign: "center" }}>{selected.title}</h2>
                            <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", margin: "0 0 24px" }}>
                                {selected.requires_photo ? "写真とエピソードで達成を記録しよう" : "エピソードを書いて達成を記録しよう"}
                            </p>

                            {/* コメント（任意） */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>エピソード（必須）<span style={{ color: "#f87171", marginLeft: 4 }}>*</span></div>
                                <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="いつ・どんな場面でやったか具体的に（例：8/1の朝、グループに挨拶を投稿した）" style={{ width: "100%", height: 80, padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                            </div>

                            {/* 写真（requires_photoのときだけ表示） */}
                            {selected.requires_photo && (
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>写真（必須）</div>
                                    {preview ? (
                                        <div style={{ position: "relative" }}>
                                            <img src={preview} alt="preview" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 10 }} />
                                            <button onClick={() => { setImage(null); setPreview(null); }} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", cursor: "pointer", fontSize: 16 }}>×</button>
                                        </div>
                                    ) : (
                                        <div onClick={() => fileInputRef.current?.click()} style={{ border: "2px dashed rgba(139,92,246,0.4)", borderRadius: 10, padding: "24px", textAlign: "center", cursor: "pointer" }}>
                                            <div style={{ fontSize: 24, marginBottom: 8 }}>📸</div>
                                            <div style={{ fontSize: 13, color: "#9ca3af" }}>クリックして写真を選択</div>
                                        </div>
                                    )}
                                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
                                </div>
                            )}

                            {message && <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: message.includes("✅") ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${message.includes("✅") ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`, color: message.includes("✅") ? "#34d399" : "#f87171", fontSize: 13, fontWeight: 600 }}>{message}</div>}

                            <div style={{ display: "flex", gap: 10 }}>
                                <button onClick={() => { setSelected(null); setComment(""); setImage(null); setPreview(null); setMessage(""); }} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>キャンセル</button>
                                <button onClick={handleSubmit} disabled={sending} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: sending ? "rgba(139,92,246,0.4)" : "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, cursor: sending ? "not-allowed" : "pointer", fontSize: 14 }}>
                                    {sending ? "記録中..." : "🏅 達成する"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== メニューへ戻る ===== */}
                <div style={{ display: "flex", justifyContent: "center", marginTop: 48, marginBottom: 32 }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>
                        メニューへ戻る
                    </button>
                </div>
            </div>
        </main>
    );
}
