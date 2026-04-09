"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function ProfileUploadPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [userId, setUserId] = useState("");
    const [name, setName] = useState("");
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const { data: profile } = await supabase.from("profiles").select("name, avatar_url").eq("id", user.id).single();
            if (profile) {
                setName(profile.name || "");
                setAvatarUrl(profile.avatar_url || null);
            }
            setLoading(false);
        };
        load();
    }, []);

    const handleFile = (file: File) => {
        if (!file.type.startsWith("image/")) {
            setMessage("❌ 画像ファイルを選択してください");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setMessage("❌ ファイルサイズは5MB以下にしてください");
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleUpload = async () => {
        if (!preview || !userId) return;
        setUploading(true);
        setMessage("");

        const file = fileInputRef.current?.files?.[0];
        if (!file) { setUploading(false); return; }

        const ext = file.name.split(".").pop();
        const filePath = `${userId}/avatar.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(filePath, file, { upsert: true });

        if (uploadError) {
            setMessage("❌ アップロードに失敗しました: " + uploadError.message);
            setUploading(false);
            return;
        }

        const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
        const urlWithCache = `${publicUrl}?t=${Date.now()}`;

        await supabase.from("profiles").update({ avatar_url: urlWithCache }).eq("id", userId);
        setAvatarUrl(urlWithCache);
        setMessage("✅ プロフィール写真を更新しました！");
        setUploading(false);
    };

    const handleDelete = async () => {
        if (!userId) return;
        await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
        setAvatarUrl(null);
        setPreview(null);
        setMessage("🗑️ 写真を削除しました");
    };

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    const currentImage = preview || avatarUrl;

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.06) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 480, margin: "0 auto" }}>

                {/* ヘッダー */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                    <div>
                        <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>INTERN QUEST</div>
                        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>プロフィール写真</h1>
                    </div>
                    <button
                        onClick={() => router.push("/mypage")}
                        style={{ background: "rgba(255,255,255,0.05)", color: "#d1d5db", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
                    >
                        ← 戻る
                    </button>
                </div>

                {/* 現在の写真 */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 32, marginBottom: 16, textAlign: "center" }}>
                    <div style={{ marginBottom: 24 }}>
                        {currentImage ? (
                            <img
                                src={currentImage}
                                alt="プロフィール写真"
                                style={{ width: 120, height: 120, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(99,102,241,0.5)", margin: "0 auto", display: "block" }}
                            />
                        ) : (
                            <div style={{ width: 120, height: 120, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, fontWeight: 700, color: "#fff", margin: "0 auto" }}>
                                {name ? name.charAt(0) : "?"}
                            </div>
                        )}
                        <div style={{ marginTop: 16, fontSize: 16, fontWeight: 700, color: "#f9fafb" }}>{name || "名前未設定"}</div>
                    </div>

                    {/* ドラッグ＆ドロップエリア */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragging(false);
                            const file = e.dataTransfer.files[0];
                            if (file) handleFile(file);
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            border: `2px dashed ${dragging ? "rgba(99,102,241,0.8)" : "rgba(255,255,255,0.12)"}`,
                            borderRadius: 12,
                            padding: "32px 20px",
                            cursor: "pointer",
                            background: dragging ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
                            transition: "all 0.2s ease",
                            marginBottom: 16,
                        }}
                    >
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#d1d5db", marginBottom: 4 }}>クリックまたはドラッグして写真を選択</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>JPG・PNG・GIF対応 / 最大5MB</div>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFile(file);
                        }}
                    />

                    <div style={{ display: "flex", gap: 10 }}>
                        <button
                            onClick={handleUpload}
                            disabled={!preview || uploading}
                            style={{
                                flex: 1, padding: "12px", borderRadius: 10, border: "none",
                                background: preview && !uploading ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)",
                                color: preview && !uploading ? "#fff" : "#6b7280",
                                fontWeight: 700, cursor: preview && !uploading ? "pointer" : "not-allowed", fontSize: 14,
                                transition: "all 0.2s ease",
                            }}
                        >
                            {uploading ? "アップロード中..." : "📤 保存する"}
                        </button>
                        {avatarUrl && (
                            <button
                                onClick={handleDelete}
                                style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)", color: "#f87171", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
                            >
                                🗑️
                            </button>
                        )}
                    </div>

                    {message && (
                        <div style={{ marginTop: 16, padding: "10px 16px", borderRadius: 8, background: message.includes("✅") ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${message.includes("✅") ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`, fontSize: 13, color: message.includes("✅") ? "#34d399" : "#f87171", fontWeight: 600 }}>
                            {message}
                        </div>
                    )}
                </div>

                <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center", lineHeight: 1.8 }}>
                    アップロードした写真は管理者画面のユーザー一覧に表示されます
                </div>
            </div>
        </main>
    );
}