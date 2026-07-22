"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type ShopItem = { id: string; title: string; description: string; cost: number; category: string };
type Request = { id: string; shop_item_id: string; cost: number; status: string; created_at: string; itemTitle?: string };
type AvatarItem = { id: string; image_id: string; name: string; description: string | null; price: number; rarity: string };

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
    const [shopTab, setShopTab] = useState<"gift" | "avatar">("gift");
    const [avatarItems, setAvatarItems] = useState<AvatarItem[]>([]);
    const [ownedAvatars, setOwnedAvatars] = useState<string[]>([]);
    const [pendingAvatars, setPendingAvatars] = useState<string[]>([]);
    const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
    const [buyTarget, setBuyTarget] = useState<AvatarItem | null>(null);
    const [buyingAvatar, setBuyingAvatar] = useState(false);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);

            const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", user.id).single();
            setPoints(pointRow?.points || 0);
            const [{ data: profRow }, { data: avItems }, { data: avPur }] = await Promise.all([
                supabase.from("profiles").select("avatar_config").eq("id", user.id).maybeSingle(),
                supabase.from("avatar_items").select("*").eq("is_active", true).order("sort_order"),
                supabase.from("avatar_purchases").select("item_id,status").eq("user_id", user.id),
            ]);
            setSelectedAvatar((profRow as any)?.avatar_config?.id || null);
            setAvatarItems((avItems || []) as AvatarItem[]);
            setOwnedAvatars((avPur || []).filter((p: any) => p.status === "approved").map((p: any) => p.item_id));
            setPendingAvatars((avPur || []).filter((p: any) => p.status === "pending").map((p: any) => p.item_id));

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

    const requestBuyAvatar = async () => {
        if (!buyTarget || !userId || buyingAvatar) return;
        if (points < buyTarget.price) { setSuccess(false); setMessage("ポイントが足りません"); setBuyTarget(null); setTimeout(() => setMessage(""), 3000); return; }
        setBuyingAvatar(true);
        await supabase.from("avatar_purchases").insert({ user_id: userId, item_id: buyTarget.id, status: "pending" });
        setPendingAvatars([...pendingAvatars, buyTarget.id]);
        setBuyingAvatar(false);
        setBuyTarget(null);
        setSuccess(true); setMessage("✅ アバターの購入を申請しました！承認をお待ちください");
        setTimeout(() => setMessage(""), 4000);
    };
    const equipAvatar = async (imageId: string) => {
        if (!userId) return;
        await supabase.from("profiles").update({ avatar_config: { type: "preset", id: imageId } }).eq("id", userId);
        setSelectedAvatar(imageId);
        setSuccess(true); setMessage("✅ アバターを変更しました！");
        setTimeout(() => setMessage(""), 3000);
    };

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

                {/* ===== ヘッダー（統一） ===== */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 32 }}>
                    <div>
                        <div onClick={() => router.push("/home")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>🛍️ ポイントショップ</h1>
                        <p style={{ color: "#6b7280", fontSize: 14, margin: "8px 0 0" }}>ポイントを使ってアイテムを交換しよう</p>
                    </div>
                    {/* 残高表示は残す */}
                    <div style={{ padding: "10px 20px", borderRadius: 12, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", fontWeight: 800, color: "#fbbf24", flexShrink: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, opacity: 0.7, marginBottom: 2 }}>💰 残高</div>
                        <div style={{ fontSize: 18 }}>{points.toLocaleString()} pt</div>
                        {requests.filter(r => r.status === "pending").length > 0 && (
                            <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>
                                審査中: -{requests.filter(r => r.status === "pending").reduce((sum, r) => sum + r.cost, 0)}pt
                            </div>
                        )}
                    </div>
                </div>

                {message && (
                    <div style={{ marginBottom: 20, padding: "14px 20px", background: success ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${success ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`, borderRadius: 12, color: success ? "#34d399" : "#f87171", fontWeight: 600, fontSize: 14 }}>
                        {message}
                    </div>
                )}

                {/* タブ */}
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    <button onClick={() => setShopTab("gift")} style={{ padding: "10px 20px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 800, background: shopTab === "gift" ? "linear-gradient(135deg, #ffb45c, #ff8a3d)" : "rgba(255,255,255,0.06)", color: shopTab === "gift" ? "#fff" : "#9ca3af" }}>🎁 景品</button>
                    <button onClick={() => setShopTab("avatar")} style={{ padding: "10px 20px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 800, background: shopTab === "avatar" ? "linear-gradient(135deg, #a78bfa, #8b5cf6)" : "rgba(255,255,255,0.06)", color: shopTab === "avatar" ? "#fff" : "#9ca3af" }}>👗 アバター</button>
                </div>

                {shopTab === "avatar" ? (
                  <div style={{ marginBottom: 32 }}>
                    {avatarItems.length === 0 ? (
                      <div style={{ textAlign: "center", color: "#6b7280", fontSize: 13, padding: 40 }}>まだアバターがありません</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
                        {avatarItems.map((it) => {
                          const owned = ownedAvatars.includes(it.id);
                          const pending = pendingAvatars.includes(it.id);
                          const isOn = selectedAvatar === it.image_id;
                          const rc = it.rarity === "legend" ? "#f59e0b" : it.rarity === "epic" ? "#a855f7" : it.rarity === "rare" ? "#3b82f6" : "#9ca3af";
                          return (
                            <div key={it.id} onClick={() => { if (owned) equipAvatar(it.image_id); else if (!pending) setBuyTarget(it); }}
                              style={{ background: "rgba(255,255,255,0.03)", borderRadius: 18, padding: "14px 10px 12px", textAlign: "center", cursor: "pointer", position: "relative", border: isOn ? "3px solid #ff8a3d" : `2px solid ${owned ? "rgba(255,255,255,0.08)" : rc + "44"}` }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={`/avatars/${it.image_id}.png`} alt={it.name} style={{ width: "100%", height: 120, objectFit: "contain", filter: owned ? "none" : "grayscale(1) opacity(.45)" }} />
                              {!owned && <div style={{ position: "absolute", top: "34%", left: 0, right: 0, fontSize: 28 }}>{pending ? "⏳" : "🔒"}</div>}
                              <div style={{ fontSize: 12.5, fontWeight: 800, color: owned ? (isOn ? "#ff8a3d" : "#e5e7eb") : "#f9fafb", marginTop: 6 }}>{isOn ? "✓ " : ""}{it.name}</div>
                              <div style={{ fontSize: 11, fontWeight: 800, color: owned ? "#34d399" : pending ? "#f59e0b" : rc, marginTop: 3 }}>{owned ? "獲得済み" : pending ? "承認待ち" : `${it.price.toLocaleString()}pt`}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                <>
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

                {/* ===== メニューへ戻るボタン（統一） ===== */}
                <div style={{ display: "flex", justifyContent: "center", marginTop: 48, marginBottom: 32 }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>
                        メニューへ戻る
                    </button>
                </div>
            </div>
            {buyTarget && (
                <div onClick={() => setBuyTarget(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 20001 }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a1a2e", borderRadius: 20, padding: 24, width: "100%", maxWidth: 360, textAlign: "center", border: "1px solid rgba(139,92,246,0.3)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/avatars/${buyTarget.image_id}.png`} alt={buyTarget.name} style={{ width: 140, height: 140, objectFit: "contain" }} />
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#f9fafb", marginTop: 8 }}>{buyTarget.name}</div>
                        {buyTarget.description && <div style={{ fontSize: 12.5, color: "#9ca3af", marginTop: 4 }}>{buyTarget.description}</div>}
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#fbbf24", margin: "14px 0 4px" }}>{buyTarget.price.toLocaleString()}pt</div>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 18 }}>所持 {points.toLocaleString()}pt → 残り {(points - buyTarget.price).toLocaleString()}pt</div>
                        <button onClick={requestBuyAvatar} disabled={buyingAvatar} style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", background: "linear-gradient(135deg, #a78bfa, #8b5cf6)", color: "#fff", fontSize: 15, fontWeight: 900, cursor: "pointer", opacity: buyingAvatar ? 0.6 : 1 }}>{buyingAvatar ? "申請中..." : "購入を申請する"}</button>
                        <button onClick={() => setBuyTarget(null)} style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 14, border: "none", background: "transparent", color: "#9ca3af", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>やめる</button>
                    </div>
                </div>
            )}
        </main>
    );
}