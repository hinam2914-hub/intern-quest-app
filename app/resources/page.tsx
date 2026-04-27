"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Resource = {
    id: string;
    title: string;
    description?: string;
    resource_type: "pdf" | "image" | "link";
    url?: string;
    category?: string;
    created_at: string;
    is_active: boolean;
};

const CATEGORY_COLORS: Record<string, string> = {
    "営業資料": "#6366f1",
    "研修資料": "#06b6d4",
    "マニュアル": "#34d399",
    "その他": "#6b7280",
};

const TYPE_ICONS: Record<string, string> = {
    pdf: "📄",
    image: "🖼️",
    link: "🔗",
};

export default function ResourcesPage() {
    const router = useRouter();
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [categories, setCategories] = useState<string[]>([]);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }

            const { data: rows } = await supabase.from("resources").select("*").eq("is_active", true).order("created_at", { ascending: false });
            const list = (rows || []) as Resource[];
            setResources(list);

            const cats = [...new Set(list.map(r => r.category || "その他"))];
            setCategories(cats);
            setLoading(false);
        };
        load();
    }, []);

    const filteredResources = resources.filter(r =>
        selectedCategory === "all" || (r.category || "その他") === selectedCategory
    );

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

                {/* ===== ヘッダー ===== */}
                <div style={{ marginBottom: 32 }}>
                    <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>📁 参考資料BOX</h1>
                    <p style={{ color: "#6b7280", fontSize: 14, margin: "8px 0 0" }}>業務に役立つ資料・リンク集</p>
                </div>

                {/* カテゴリフィルター */}
                <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                    <button onClick={() => setSelectedCategory("all")} style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer", fontSize: 13, background: selectedCategory === "all" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: selectedCategory === "all" ? "#fff" : "#9ca3af" }}>
                        すべて
                    </button>
                    {categories.map(cat => (
                        <button key={cat} onClick={() => setSelectedCategory(cat)} style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer", fontSize: 13, background: selectedCategory === cat ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: selectedCategory === cat ? "#fff" : "#9ca3af" }}>
                            {cat}
                        </button>
                    ))}
                </div>

                {filteredResources.length === 0 ? (
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 60, textAlign: "center" }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                        <div style={{ fontSize: 16, color: "#6b7280" }}>まだ資料がありません</div>
                    </div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                        {filteredResources.map((resource) => {
                            const catColor = CATEGORY_COLORS[resource.category || "その他"] || "#6b7280";
                            return (
                                <div key={resource.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <div style={{ width: 48, height: 48, borderRadius: 12, background: `${catColor}20`, border: `1px solid ${catColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                                            {TYPE_ICONS[resource.resource_type] || "📁"}
                                        </div>
                                        <span style={{ padding: "4px 10px", borderRadius: 6, background: `${catColor}20`, color: catColor, fontSize: 11, fontWeight: 700 }}>
                                            {resource.category || "その他"}
                                        </span>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb", marginBottom: 6 }}>{resource.title}</div>
                                        {resource.description && <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{resource.description}</div>}
                                    </div>
                                    {resource.url && (
                                        <a href={resource.url} target="_blank" rel="noreferrer" style={{ display: "block", padding: "10px 16px", borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, fontSize: 14, textAlign: "center", textDecoration: "none", marginTop: "auto" }}>
                                            {resource.resource_type === "link" ? "🔗 開く" : resource.resource_type === "pdf" ? "📄 PDFを見る" : "🖼️ 画像を見る"}
                                        </a>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ===== メニューへ戻るボタン ===== */}
                <div style={{ display: "flex", justifyContent: "center", marginTop: 48, marginBottom: 32 }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>
                        メニューへ戻る
                    </button>
                </div>
            </div>
        </main>
    );
}