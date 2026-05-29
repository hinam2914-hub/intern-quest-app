"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Sale = {
    id: string;
    user_id: string;
    amount: number;
    sale_date: string;
    created_at: string;
};

type Profile = {
    id: string;
    name: string;
};

export default function SalesManagementTab() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [selectedUserId, setSelectedUserId] = useState("");
    const [amount, setAmount] = useState("");
    const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const { data: profileRows } = await supabase.from("profiles").select("id, name").eq("is_active", true).order("name");
        setProfiles((profileRows || []) as Profile[]);
        const { data: saleRows } = await supabase.from("sales").select("*").order("sale_date", { ascending: false }).limit(100);
        setSales((saleRows || []) as Sale[]);
    };

    const handleSave = async () => {
        if (!selectedUserId) { setMessage("メンバーを選択してください"); return; }
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setMessage("金額を正しく入力してください"); return; }
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("sales").insert({
            user_id: selectedUserId,
            amount: Number(amount),
            sale_date: saleDate,
            created_by: user?.id || null,
        });
        if (error) { setMessage("保存失敗: " + error.message); setSaving(false); return; }
        setMessage("✅ 保存しました");
        setSelectedUserId("");
        setAmount("");
        setSaleDate(new Date().toISOString().slice(0, 10));
        setSaving(false);
        await loadData();
    };

    const handleDelete = async (id: string) => {
        if (!confirm("削除しますか？")) return;
        const { error } = await supabase.from("sales").delete().eq("id", id);
        if (error) { alert("削除失敗: " + error.message); return; }
        await loadData();
    };

    const getName = (uid: string) => profiles.find(p => p.id === uid)?.name || "（不明）";
    const formatAmount = (yen: number) => `${Math.round(yen / 10000).toLocaleString()}万円`;

    return (
        <div style={{ padding: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f9fafb", marginBottom: 16 }}>💰 販売額管理</h2>
            
            {/* 入力フォーム */}
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>新規登録</h3>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
                    <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 14 }}>
                        <option value="">メンバーを選択</option>
                        {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="金額（円）" style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 14 }} />
                    <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 14 }} />
                    <button onClick={handleSave} disabled={saving} style={{ padding: 10, borderRadius: 8, border: "none", background: "linear-gradient(135deg, #f59e0b, #ef4444)", color: "#fff", fontWeight: 700, cursor: saving ? "wait" : "pointer", fontSize: 14 }}>
                        {saving ? "保存中..." : "保存"}
                    </button>
                </div>
                {message && <div style={{ marginTop: 8, fontSize: 13, color: message.startsWith("✅") ? "#10b981" : "#ef4444" }}>{message}</div>}
            </div>

            {/* 一覧 */}
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>登録履歴（直近100件）</h3>
                {sales.length === 0 ? (
                    <div style={{ padding: 24, textAlign: "center", color: "#6b7280", fontSize: 13 }}>まだ登録がありません</div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {sales.map(s => (
                            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 12, padding: "10px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, alignItems: "center" }}>
                                <div style={{ fontSize: 13, color: "#f9fafb", fontWeight: 600 }}>{getName(s.user_id)}</div>
                                <div style={{ fontSize: 13, color: "#f59e0b", fontWeight: 700 }}>{formatAmount(s.amount)}</div>
                                <div style={{ fontSize: 12, color: "#9ca3af" }}>{s.sale_date}</div>
                                <button onClick={() => handleDelete(s.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 11, cursor: "pointer" }}>削除</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}