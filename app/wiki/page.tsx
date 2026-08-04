"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type WikiTerm = { id: string; term: string; description: string; category: string | null; };
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

const RES_CATEGORY_COLORS: Record<string, string> = {
    "営業資料": "#6366f1",
    "研修資料": "#06b6d4",
    "マニュアル": "#10b981",
    "テンプレート": "#f59e0b",
    "その他": "#6b7280",
};
const TYPE_ICON: Record<string, string> = { pdf: "📄", image: "🖼️", link: "🔗" };

export default function WikiPage() {
    const router = useRouter();
    const [tab, setTab] = useState<"terms" | "resources">("terms");
    const [terms, setTerms] = useState<WikiTerm[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const [{ data: t }, { data: r }] = await Promise.all([
                supabase.from("wiki_terms").select("*").order("category").order("term"),
                supabase.from("resources").select("*").eq("is_active", true).order("category").order("created_at", { ascending: false }),
            ]);
            setTerms((t || []) as WikiTerm[]);
            setResources((r || []) as Resource[]);
            setLoading(false);
        };
        load();
    }, []);

    const filteredTerms = terms.filter(t =>
        search === "" || t.term.includes(search) || t.description.includes(search) || (t.category || "").includes(search)
    );
    const termCategories = [...new Set(filteredTerms.map(t => t.category || "その他"))];

    const filteredRes = resources.filter(r =>
        search === "" || r.title.includes(search) || (r.description || "").includes(search) || (r.category || "").includes(search)
    );
    const resCategories = [...new Set(filteredRes.map(r => r.category || "その他"))];

    if (loading) return (
        <main style={{ minHeight: "100vh", background: "#fdf6f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
        </main>
    );

    return (
        <main style={{ minHeight: "100vh", background: "#fdf6f0", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 800, margin: "0 auto" }}>
                {/* ===== ヘッダー（統一） ===== */}
                <div style={{ marginBottom: 20 }}>
                    <div onClick={() => router.push("/home")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, color: "#3b3b46", margin: "4px 0 0" }}>📖 Wiki</h1>
                    <p style={{ color: "#8a8a96", fontSize: 13, margin: "6px 0 0" }}>用語集と資料をまとめて検索できます</p>
                </div>

                {/* ===== タブ ===== */}
                <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                    {[
                        { key: "terms", icon: "📖", label: "用語集", count: terms.length },
                        { key: "resources", icon: "📂", label: "資料", count: resources.length },
                    ].map(t => {
                        const active = tab === t.key;
                        return (
                            <button key={t.key} onClick={() => setTab(t.key as any)}
                                style={{
                                    display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12,
                                    background: active ? "#6366f1" : "#fff",
                                    border: `1px solid ${active ? "#6366f1" : "#e5e0d8"}`,
                                    color: active ? "#fff" : "#6b6b78", cursor: "pointer",
                                    fontWeight: active ? 800 : 600, fontSize: 14, transition: "all .15s",
                                    boxShadow: active ? "0 4px 12px rgba(99,102,241,.25)" : "none",
                                }}>
                                <span>{t.icon}</span><span>{t.label}</span>
                                <span style={{ fontSize: 11, opacity: .75, fontWeight: 700 }}>{t.count}</span>
                            </button>
                        );
                    })}
                </div>

                {/* ===== 検索 ===== */}
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder={tab === "terms" ? "用語を検索..." : "資料を検索..."}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid #e5e0d8", background: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 22 }} />

                {/* ===== 用語集タブ ===== */}
                {tab === "terms" && (
                    termCategories.length === 0 ? (
                        <div style={{ textAlign: "center", color: "#8a8a96", fontSize: 14, padding: "32px 0" }}>該当する用語がありません</div>
                    ) : (
                        termCategories.map(cat => (
                            <div key={cat} style={{ marginBottom: 26 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: "#6366f1", marginBottom: 10, letterSpacing: 1 }}>{cat}</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {filteredTerms.filter(t => (t.category || "その他") === cat).map(t => (
                                        <div key={t.id} style={{ background: "#fff", borderRadius: 14, padding: "14px 18px", border: "1px solid #efe9e0", boxShadow: "0 2px 8px rgba(0,0,0,.03)" }}>
                                            <div style={{ fontSize: 15, fontWeight: 800, color: "#3b3b46", marginBottom: 4 }}>{t.term}</div>
                                            <div style={{ fontSize: 13, color: "#6b6b78", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{t.description}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )
                )}

                {/* ===== 資料タブ ===== */}
                {tab === "resources" && (
                    resCategories.length === 0 ? (
                        <div style={{ textAlign: "center", color: "#8a8a96", fontSize: 14, padding: "32px 0" }}>該当する資料がありません</div>
                    ) : (
                        resCategories.map(cat => {
                            const color = RES_CATEGORY_COLORS[cat] || "#6b7280";
                            return (
                                <div key={cat} style={{ marginBottom: 26 }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color, marginBottom: 10, letterSpacing: 1 }}>{cat}</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                        {filteredRes.filter(r => (r.category || "その他") === cat).map(r => (
                                            <a key={r.id} href={r.url || "#"} target="_blank" rel="noreferrer"
                                                style={{ textDecoration: "none", background: "#fff", borderRadius: 14, padding: "14px 18px", border: "1px solid #efe9e0", boxShadow: "0 2px 8px rgba(0,0,0,.03)", display: "flex", alignItems: "center", gap: 12 }}>
                                                <span style={{ fontSize: 22, flexShrink: 0 }}>{TYPE_ICON[r.resource_type] || "📄"}</span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 14.5, fontWeight: 800, color: "#3b3b46" }}>{r.title}</div>
                                                    {r.description && <div style={{ fontSize: 12.5, color: "#8a8a96", marginTop: 2, lineHeight: 1.5 }}>{r.description}</div>}
                                                </div>
                                                <span style={{ fontSize: 12, color, fontWeight: 700, flexShrink: 0 }}>開く →</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    )
                )}

                {/* ===== メニューへ戻る ===== */}
                <div style={{ display: "flex", justifyContent: "center", marginTop: 44 }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>
                        メニューへ戻る
                    </button>
                </div>
            </div>
        </main>
    );
}
