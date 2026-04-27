"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type WikiTerm = { id: string; term: string; description: string; category: string | null; };

export default function WikiPage() {
    const router = useRouter();
    const [terms, setTerms] = useState<WikiTerm[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase.from("wiki_terms").select("*").order("category").order("term");
            setTerms((data || []) as WikiTerm[]);
            setLoading(false);
        };
        load();
    }, []);

    const filtered = terms.filter(t =>
        search === "" || t.term.includes(search) || t.description.includes(search) || (t.category || "").includes(search)
    );

    const categories = [...new Set(filtered.map(t => t.category || "その他"))];

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
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "#1a1a2e", margin: "4px 0 0" }}>📖 用語集</h1>
                    <p style={{ color: "#6b7280", fontSize: 14, margin: "8px 0 0" }}>社内・就活用語をまとめました</p>
                </div>

                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 用語を検索..." style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", background: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 24 }} />

                {filtered.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#6b7280", fontSize: 14, padding: 40 }}>該当する用語がありません</div>
                ) : (
                    categories.map(cat => (
                        <div key={cat} style={{ marginBottom: 24 }}>
                            <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>{cat.toUpperCase()}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {filtered.filter(t => (t.category || "その他") === cat).map(t => (
                                    <div key={t.id} style={{ padding: "16px 20px", borderRadius: 12, background: "#fff", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a2e", marginBottom: 6 }}>{t.term}</div>
                                        <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7 }}>{t.description}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
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