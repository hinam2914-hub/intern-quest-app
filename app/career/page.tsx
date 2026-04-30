"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type CareerItem = { id: string; title: string; description: string | null; category: string; url: string | null; };

export default function CareerPage() {
    const router = useRouter();
    const [items, setItems] = useState<CareerItem[]>([]);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase.from("career_items").select("*").order("category").order("created_at", { ascending: false });
            setItems((data || []) as CareerItem[]);
            setLoading(false);
        };
        load();
    }, []);

    const categories = [...new Set(items.map(i => i.category))];
    const filtered = items.filter(i =>
        (selectedCategory === "all" || i.category === selectedCategory) &&
        (search === "" || i.title.includes(search) || (i.description || "").includes(search))
    );

    if (loading) return (
        <main style={{ minHeight: "100vh", background: "#fdf6f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
        </main>
    );

    return (
        <main style={{ minHeight: "100vh", background: "#fdf6f0", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 800, margin: "0 auto" }}>

                {/* ===== ヘッダー（統一） ===== */}
                <div style={{ marginBottom: 32 }}>
                    <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block", marginBottom: 4 }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "#1a1a2e", margin: "4px 0 0" }}>💼 就活ボックス</h1>
                    <p style={{ color: "#6b7280", fontSize: 14, margin: "8px 0 0" }}>大学別・企業別の就活情報をまとめました</p>
                </div>

                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 検索..." style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", background: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 16 }} />

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
                    <button onClick={() => setSelectedCategory("all")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", background: selectedCategory === "all" ? "#6366f1" : "#fff", color: selectedCategory === "all" ? "#fff" : "#6b7280", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>すべて</button>
                    {categories.map(cat => (
                        <button key={cat} onClick={() => setSelectedCategory(cat)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", background: selectedCategory === cat ? "#6366f1" : "#fff", color: selectedCategory === cat ? "#fff" : "#6b7280", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>{cat}</button>
                    ))}
                </div>

                {filtered.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#6b7280", fontSize: 14, padding: 40 }}>該当する情報がありません</div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {filtered.map(item => (
                            <div key={item.id}
                                style={{ padding: "16px 20px", borderRadius: 12, background: "#fff", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", cursor: item.url ? "pointer" : "default" }}
                                onMouseEnter={(e) => {
                                    const el = e.currentTarget as HTMLDivElement;
                                    el.style.transform = "translateY(-4px)";
                                    el.style.boxShadow = "0 12px 24px rgba(99,102,241,0.15), 0 4px 8px rgba(99,102,241,0.1)";
                                    el.style.borderColor = "rgba(99,102,241,0.3)";
                                }}
                                onMouseLeave={(e) => {
                                    const el = e.currentTarget as HTMLDivElement;
                                    el.style.transform = "translateY(0)";
                                    el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
                                    el.style.borderColor = "rgba(0,0,0,0.06)";
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                    <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(99,102,241,0.1)", color: "#6366f1", fontSize: 11, fontWeight: 600 }}>{item.category}</span>
                                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}>{item.title}</span>
                                </div>
                                {item.description && <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7, marginBottom: 8 }}>{item.description}</div>}
                                {item.url && <a href={item.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#6366f1", textDecoration: "none", fontWeight: 600 }}>🔗 詳細を見る →</a>}
                            </div>
                        ))}
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