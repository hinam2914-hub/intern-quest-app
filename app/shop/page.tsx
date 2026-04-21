"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type ShopItem = { id: string; title: string; description: string; cost: number; category: string };
type Request = { id: string; shop_item_id: string; cost: number; status: string; created_at: string; itemTitle?: string };

const categoryIcon: Record<string, string> = { gift: "🎁", book: "📚", sauna: "♨️", title: "👑" };
const categoryLabel: Record<string, string> = { gift: "ギフト", book: "書籍", sauna: "サウナ", title: "称号" };
const statusLabel: Record<string, { label: string; color: string }> = {
    pending: { label: "審査中", color: "#f59e0b" },
    approved: { label: "承認済", color: "#34d399" },
    rejected: { label: "却下", color: "#f87171" },
};

export default function ShopPage() {
    const router = useRouter();
    const [userId, setUserId] = useState("");
    const [points, setPoints] = useState(0);
    const [items, setItems] = useState<ShopItem[]>([]);
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    const [success, setSuccess] = useState(false);
    const [note, setNote] = useState<Record<string, string>>({});

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);

            const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", user.id).single();
            setPoints(pointRow?.points || 0);

            const { data: itemRows } = await supabase.from("shop_items").select("*").eq("is_active", true).order("cost");
            setItems((itemRows || []) as ShopItem[]);

            const { data: reqRows } = await supabase.from("point_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
            const enriched = ((reqRows || []) as Request[]).map(r => ({
                ...r,
                itemTitle: itemRows?.find((i: any) => i.id === r.shop_item_id)?.title || "不明",
            }));
            setRequests(enriched);
            setLoading(false);
        };
        load();
    }, [router]);

    const handleApply = async (item: ShopItem) => {
        if (points < item.cost) { setMessage("ポイントが足りません"); setSuccess(false); return; }
        setApplying(item.id);
        await supabase.from("point_requests").insert({
            user_id: userId,
            shop_item_id: item.id,
            cost: item.cost,
            status: "pending",
            note: note[item.id] || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        setSuccess(true);
        setMessage(`✅ 「${item.title}」を申請しました！管理者の承認をお待ちください。`);
        const { data: reqRows } = await supabase.from("point_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false });
        const enriched = ((reqRows || []) as Request[]).map(r => ({
            ...r,
            itemTitle: items.find(i => i.id === r.shop_item_id)?.title || "不明",
        }));
        setRequests(enriched);
        setApplying(null);
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
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(251,191,36,0.06) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto" }}>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                    <div>
                        <div onClick={() => router.push("/menu")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer" }}>INTERN QUEST</div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>🛍️ ポイントショップ</h1>
                        <p style={{ color: "#6b7280", fontSize: 14, margin: "8px 0 0" }}>ポイントを使ってアイテムを交換しよう</p>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ padding: "10px 20px", borderRadius: 12, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", fontSize: 18, fontWeight: 800, color: "#fbbf24" }}>
                            {points.toLocaleString()} pt
                            {requests.filter(r => r.status === "pending").length > 0 && (
                                <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>
                                    審査中: -{requests.filter(r => r.status === "pending").reduce((sum, r) => sum + r.cost, 0)}pt
                                </div>
                            )}
                        </div>
                        <button onClick={() => router.push("/mypage")} style={{ background: "rgba(255,255,255,0.05)", color: "#d1d5db", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>マイページ</button>
                    </div>
                </div>

                {message && (
                    <div style={{ marginBottom: 20, padding: "14px 20px", background: success ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${success ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`, borderRadius: 12, color: success ? "#34d399" : "#f87171", fontWeight: 600, fontSize: 14 }}>
                        {message}
                    </div>
                )}

                {/* ショップアイテム */}
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>SHOP ITEMS</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
                    {items.map((item) => {
                        const canAfford = points >= item.cost;
                        const hasPending = requests.some(r => r.shop_item_id === item.id && r.status === "pending");
                        return (
                            <div key={item.id} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${canAfford ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)"}`, borderRadius: 16, padding: 24, opacity: canAfford ? 1 : 0.6 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                    <div style={{ fontSize: 32 }}>{categoryIcon[item.category] || "🎁"}</div>
                                    <div style={{ padding: "4px 12px", borderRadius: 8, background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", fontSize: 13, fontWeight: 800, color: "#fbbf24" }}>
                                        {item.cost} pt
                                    </div>
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>{item.title}</div>
                                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{categoryLabel[item.category]}</div>
                                {item.description && <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16, lineHeight: 1.5 }}>{item.description}</div>}
                                <input
                                    value={note[item.id] || ""}
                                    onChange={(e) => setNote(prev => ({ ...prev, [item.id]: e.target.value }))}
                                    placeholder="備考（任意）"
                                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
                                />
                                <button
                                    onClick={() => handleApply(item)}
                                    disabled={!canAfford || applying === item.id || hasPending}
                                    style={{ width: "100%", padding: "10px", borderRadius: 10, border: "none", background: hasPending ? "rgba(245,158,11,0.2)" : canAfford ? "linear-gradient(135deg, #f59e0b, #fbbf24)" : "rgba(255,255,255,0.05)", color: hasPending ? "#f59e0b" : canAfford ? "#0a0a0f" : "#6b7280", fontWeight: 700, cursor: canAfford && !hasPending ? "pointer" : "not-allowed", fontSize: 14 }}
                                >
                                    {hasPending ? "⏳ 審査中" : applying === item.id ? "申請中..." : canAfford ? "申請する" : "ポイント不足"}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* 申請履歴 */}
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>MY REQUESTS</div>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                    {requests.length === 0 ? (
                        <div style={{ color: "#6b7280", fontSize: 14 }}>申請履歴はありません</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {requests.map((req) => {
                                const status = statusLabel[req.status] || { label: req.status, color: "#6b7280" };
                                return (
                                    <div key={req.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: "#f9fafb" }}>{req.itemTitle}</div>
                                            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{new Date(req.created_at).toLocaleDateString("ja-JP")}</div>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24" }}>{req.cost} pt</div>
                                            <div style={{ padding: "4px 12px", borderRadius: 8, background: `${status.color}20`, border: `1px solid ${status.color}50`, color: status.color, fontSize: 12, fontWeight: 700 }}>{status.label}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}