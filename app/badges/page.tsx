"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import BackToMenuButton from "../components/BackToMenuButton";

type Badge = { id: string; name: string; icon: string | null; description: string | null; category: string | null; sort_order: number };
type Profile = { id: string; name: string };
type UserBadge = { user_id: string; badge_id: string };

export default function BadgesPage() {
    const router = useRouter();
    const [badges, setBadges] = useState<Badge[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
    const [catOrder, setCatOrder] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState<string | null>(null);

    const load = useCallback(async () => {
        const { data: b } = await supabase.from("badges").select("*").order("category").order("sort_order");
        setBadges((b || []) as Badge[]);
        const { data: p } = await supabase.from("profiles").select("id, name").eq("is_active", true);
        setProfiles((p || []) as Profile[]);
        const { data: ub } = await supabase.from("user_badges").select("user_id, badge_id");
        setUserBadges((ub || []) as UserBadge[]);
        const { data: cat } = await supabase.from("badge_categories").select("name").order("sort_order");
        setCatOrder((cat || []).map((r: any) => r.name));
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const holders = (badgeId: string) =>
        userBadges.filter((ub) => ub.badge_id === badgeId)
            .map((ub) => profiles.find((p) => p.id === ub.user_id)?.name)
            .filter(Boolean) as string[];

    const totalActive = profiles.length;

    const rarityLabel = (count: number) => {
        if (count === 0) return { text: "まだ誰も持っていない", color: "#6b7280" };
        if (count === 1) return { text: "★ 激レア（1人だけ）", color: "#f59e0b" };
        if (count <= 3) return { text: "レア", color: "#a78bfa" };
        if (totalActive > 0 && count / totalActive >= 0.3) return { text: "よく見るバッジ", color: "#9ca3af" };
        return { text: `${count}人が保有`, color: "#34d399" };
    };

    if (loading) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Loading...</main>
    );

    const categories = catOrder.filter((cat) => badges.some((b) => b.category === cat));

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 700, margin: "0 auto" }}>
                <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>← INTERN QUEST</div>
                <h1 style={{ fontSize: 26, fontWeight: 900, margin: "4px 0 4px" }}>📖 みんなのバッジ図鑑</h1>
                <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 24 }}>各バッジを持っている人と、レア度が見られるよ。タップで保有者を表示。</p>

                {badges.length === 0 && <div style={{ color: "#9ca3af", fontSize: 14 }}>まだバッジがありません。</div>}

                {categories.map((cat) => (
                    <div key={cat} style={{ marginBottom: 28 }}>
                        <div style={{ fontSize: 13, color: "#818cf8", fontWeight: 700, marginBottom: 12 }}>{cat}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {badges.filter((b) => b.category === cat).map((b) => {
                                const h = holders(b.id);
                                const r = rarityLabel(h.length);
                                const isOpen = openId === b.id;
                                return (
                                    <div key={b.id} style={{ background: h.length === 1 ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${h.length === 1 ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 12, padding: "12px 16px", cursor: h.length > 0 ? "pointer" : "default" }} onClick={() => { if (h.length > 0) setOpenId(isOpen ? null : b.id); }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                            <div style={{ fontSize: 30 }}>{b.icon || "🏅"}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 14, color: "#f9fafb", fontWeight: 700 }}>{b.name}</div>
                                                <div style={{ fontSize: 11, color: "#9ca3af" }}>{b.description}</div>
                                            </div>
                                            <div style={{ textAlign: "right" }}>
                                                <div style={{ fontSize: 11, color: r.color, fontWeight: 700, whiteSpace: "nowrap" }}>{r.text}</div>
                                                {h.length > 0 && <div style={{ fontSize: 10, color: "#6b7280" }}>{isOpen ? "▲ 閉じる" : "▼ 保有者を見る"}</div>}
                                            </div>
                                        </div>
                                        {isOpen && h.length > 0 && (
                                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexWrap: "wrap", gap: 6 }}>
                                                {h.map((name, i) => (
                                                    <span key={i} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, background: "rgba(99,102,241,0.15)", color: "#c7d2fe" }}>{name}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                <BackToMenuButton />
            </div>
        </main>
    );
}
