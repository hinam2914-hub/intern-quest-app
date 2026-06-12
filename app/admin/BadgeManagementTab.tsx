"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

type Badge = { id: string; name: string; icon: string | null; description: string | null; category: string | null; sort_order: number };
type Profile = { id: string; name: string };
type UserBadge = { id: string; user_id: string; badge_id: string };
type Category = { id: string; name: string; sort_order: number };

export default function BadgeManagementTab() {
    const [badges, setBadges] = useState<Badge[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");

    const [name, setName] = useState("");
    const [icon, setIcon] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [sortOrder, setSortOrder] = useState(0);

    const [newCategory, setNewCategory] = useState("");
    const [grantBadgeId, setGrantBadgeId] = useState("");
    const [grantUserId, setGrantUserId] = useState("");

    const load = useCallback(async () => {
        const { data: cat } = await supabase.from("badge_categories").select("*").order("sort_order");
        setCategories((cat || []) as Category[]);
        const { data: b } = await supabase.from("badges").select("*").order("sort_order");
        setBadges((b || []) as Badge[]);
        const { data: p } = await supabase.from("profiles").select("id, name").eq("is_active", true).order("name");
        setProfiles((p || []) as Profile[]);
        const { data: ub } = await supabase.from("user_badges").select("id, user_id, badge_id");
        setUserBadges((ub || []) as UserBadge[]);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleAddCategory = async () => {
        if (!newCategory.trim()) { setMsg("❌ カテゴリ名を入力してください"); return; }
        const maxOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order)) : 0;
        const { error } = await supabase.from("badge_categories").insert({ name: newCategory.trim(), sort_order: maxOrder + 10 });
        if (error) { setMsg("❌ 追加失敗: " + error.message); return; }
        setMsg("✅ カテゴリを追加しました");
        setNewCategory("");
        load();
    };

    const moveCategory = async (cat: Category, dir: -1 | 1) => {
        const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
        const idx = sorted.findIndex((c) => c.id === cat.id);
        const swapIdx = idx + dir;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;
        const other = sorted[swapIdx];
        await supabase.from("badge_categories").update({ sort_order: other.sort_order }).eq("id", cat.id);
        await supabase.from("badge_categories").update({ sort_order: cat.sort_order }).eq("id", other.id);
        load();
    };

    const handleDeleteCategory = async (cat: Category) => {
        const used = badges.filter((b) => b.category === cat.name).length;
        if (used > 0) { setMsg(`❌ このカテゴリは${used}個のバッジで使用中です。先にバッジを移動/削除してください`); return; }
        if (!confirm(`カテゴリ「${cat.name}」を削除しますか？`)) return;
        await supabase.from("badge_categories").delete().eq("id", cat.id);
        setMsg("🗑️ カテゴリを削除しました");
        load();
    };

    const handleCreate = async () => {
        if (!name.trim()) { setMsg("❌ バッジ名を入力してください"); return; }
        if (!category) { setMsg("❌ カテゴリを選んでください"); return; }
        const { error } = await supabase.from("badges").insert({
            name: name.trim(), icon: icon.trim() || null, description: description.trim() || null, category, sort_order: sortOrder,
        });
        if (error) { setMsg("❌ 作成失敗: " + error.message); return; }
        setMsg("✅ バッジを作成しました");
        setName(""); setIcon(""); setDescription(""); setSortOrder(0);
        load();
    };

    const handleDelete = async (id: string, badgeName: string) => {
        if (!confirm("「" + badgeName + "」を削除しますか？（保有記録も消えます）")) return;
        await supabase.from("badges").delete().eq("id", id);
        setMsg("🗑️ バッジを削除しました");
        load();
    };

    const handleGrant = async () => {
        if (!grantBadgeId || !grantUserId) { setMsg("❌ バッジとメンバーを選んでください"); return; }
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("user_badges").insert({ user_id: grantUserId, badge_id: grantBadgeId, granted_by: user?.id || null });
        if (error) {
            if (error.code === "23505") setMsg("⚠️ その人はすでにこのバッジを持っています");
            else setMsg("❌ 付与失敗: " + error.message);
            return;
        }
        setMsg("✅ バッジを付与しました");
        setGrantUserId("");
        load();
    };

    const handleRevoke = async (userId: string, badgeId: string) => {
        await supabase.from("user_badges").delete().eq("user_id", userId).eq("badge_id", badgeId);
        setMsg("↩️ 付与を取り消しました");
        load();
    };

    const holderCount = (badgeId: string) => userBadges.filter((ub) => ub.badge_id === badgeId).length;

    if (loading) return <div style={{ color: "#9ca3af", padding: 20 }}>Loading...</div>;

    const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" as const };
    const labelStyle = { fontSize: 11, color: "#9ca3af", marginBottom: 4, display: "block" };
    const cardStyle = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 20, marginBottom: 20 };

    return (
        <div style={{ color: "#f9fafb" }}>
            {msg && <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", marginBottom: 16, fontSize: 13 }}>{msg}</div>}

            <div style={cardStyle}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>📂 カテゴリ管理</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 14 }}>↑↓で並び順を変更。表示順は自動で管理されます。</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    {categories.map((cat, i) => (
                        <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: "8px 12px" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{cat.name}</span>
                            <span style={{ fontSize: 11, color: "#6b7280" }}>{badges.filter((b) => b.category === cat.name).length}個</span>
                            <button onClick={() => moveCategory(cat, -1)} disabled={i === 0} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: i === 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)", color: i === 0 ? "#4b5563" : "#9ca3af", cursor: i === 0 ? "default" : "pointer", fontSize: 13 }}>↑</button>
                            <button onClick={() => moveCategory(cat, 1)} disabled={i === categories.length - 1} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: i === categories.length - 1 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)", color: i === categories.length - 1 ? "#4b5563" : "#9ca3af", cursor: i === categories.length - 1 ? "default" : "pointer", fontSize: 13 }}>↓</button>
                            <button onClick={() => handleDeleteCategory(cat)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>削除</button>
                        </div>
                    ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <input style={{ ...inputStyle, flex: 1 }} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="新しいカテゴリ名" />
                    <button onClick={handleAddCategory} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }}>＋ 追加</button>
                </div>
            </div>

            <div style={cardStyle}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>🏅 新しいバッジを作る</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 120px", gap: 12, marginBottom: 12 }}>
                    <div><label style={labelStyle}>バッジ名</label><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="高単価クローザー" /></div>
                    <div><label style={labelStyle}>アイコン</label><input style={inputStyle} value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="💎" /></div>
                    <div><label style={labelStyle}>表示順</label><input type="number" style={inputStyle} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 12, marginBottom: 12 }}>
                    <div><label style={labelStyle}>説明</label><input style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="500万円以上を成約した人" /></div>
                    <div><label style={labelStyle}>カテゴリ</label>
                        <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
                            <option value="">選択してください</option>
                            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                </div>
                <button onClick={handleCreate} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>＋ バッジを作成</button>
            </div>

            <div style={cardStyle}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>🎖️ メンバーにバッジを付与</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
                    <div><label style={labelStyle}>バッジ</label>
                        <select style={inputStyle} value={grantBadgeId} onChange={(e) => setGrantBadgeId(e.target.value)}>
                            <option value="">選択してください</option>
                            {badges.map((b) => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}
                        </select>
                    </div>
                    <div><label style={labelStyle}>メンバー</label>
                        <select style={inputStyle} value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)}>
                            <option value="">選択してください</option>
                            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <button onClick={handleGrant} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }}>付与する</button>
                </div>
            </div>

            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>📋 バッジ一覧（{badges.length}個）</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {badges.map((b) => (
                    <div key={b.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ fontSize: 26 }}>{b.icon || "🏅"}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>{b.name} <span style={{ fontSize: 10, color: "#818cf8", marginLeft: 6 }}>{b.category}</span></div>
                                <div style={{ fontSize: 11, color: "#9ca3af" }}>{b.description}</div>
                            </div>
                            <div style={{ fontSize: 11, color: "#34d399", fontWeight: 700, whiteSpace: "nowrap" }}>{holderCount(b.id)}人が保有</div>
                            <button onClick={() => handleDelete(b.id, b.name)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>削除</button>
                        </div>
                        {holderCount(b.id) > 0 && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {userBadges.filter((ub) => ub.badge_id === b.id).map((ub) => {
                                    const pname = profiles.find((p) => p.id === ub.user_id)?.name;
                                    if (!pname) return null;
                                    return (
                                        <span key={ub.id} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "rgba(99,102,241,0.15)", color: "#c7d2fe", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                            {pname}<span onClick={() => handleRevoke(ub.user_id, b.id)} style={{ cursor: "pointer", color: "#f87171", fontWeight: 700 }}>×</span>
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
