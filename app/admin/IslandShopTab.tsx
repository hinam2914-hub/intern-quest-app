"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Item = { id: string; name: string; category: string; emoji: string | null; css_key: string; price: number; rarity: string; sort_order: number; is_active: boolean };
type Purchase = { id: string; user_id: string; item_id: string; status: string; created_at: string; userName?: string; itemName?: string; price?: number; emoji?: string | null };

const CAT_LABEL: Record<string, string> = { ground: "🌍 地面", tree: "🌲 木", deco: "🪑 デコ", sky: "✨ 空", animal: "🐾 どうぶつ" };

export default function IslandShopTab() {
  const [tab, setTab] = useState<"pending" | "items" | "history">("pending");
  const [items, setItems] = useState<Item[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: its } = await supabase.from("island_items").select("*").order("sort_order");
    const list = (its || []) as Item[];
    setItems(list);
    const { data: prs } = await supabase.from("island_purchases").select("*").order("created_at", { ascending: false }).limit(200);
    const rows = (prs || []) as Purchase[];
    const uids = [...new Set(rows.map(r => r.user_id))];
    const names: Record<string, string> = {};
    if (uids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,name").in("id", uids);
      (profs || []).forEach((p: any) => { names[p.id] = p.name; });
    }
    const imap: Record<string, Item> = {};
    list.forEach(i => { imap[i.id] = i; });
    setPurchases(rows.map(r => ({ ...r, userName: names[r.user_id] || "不明", itemName: imap[r.item_id]?.name || "?", price: imap[r.item_id]?.price || 0, emoji: imap[r.item_id]?.emoji })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const approve = async (p: Purchase) => {
    if (busy) return;
    setBusy(p.id);
    const cost = p.price || 0;
    const { data: up } = await supabase.from("user_points").select("points").eq("id", p.user_id).single();
    const cur = (up as any)?.points || 0;
    if (cur < cost) { setMsg("ポイント不足のため承認できません"); setBusy(null); setTimeout(() => setMsg(""), 3000); return; }
    await supabase.from("user_points").update({ points: cur - cost }).eq("id", p.user_id);
    await supabase.from("points_history").insert({ user_id: p.user_id, change: -cost, reason: `island_${p.itemName}` });
    await supabase.from("island_purchases").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", p.id);
    setBusy(null); load();
  };
  const reject = async (p: Purchase) => {
    if (busy) return;
    setBusy(p.id);
    await supabase.from("island_purchases").update({ status: "rejected", approved_at: new Date().toISOString() }).eq("id", p.id);
    setBusy(null); load();
  };
  const toggleActive = async (it: Item) => {
    await supabase.from("island_items").update({ is_active: !it.is_active }).eq("id", it.id);
    load();
  };

  const pending = purchases.filter(p => p.status === "pending");
  const history = purchases.filter(p => p.status !== "pending");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>🏝️ 島ショップ管理</h2>
      <div style={{ display: "flex", gap: 8 }}>
        {[{ k: "pending", l: `承認待ち${pending.length > 0 ? ` (${pending.length})` : ""}` }, { k: "items", l: "アイテム管理" }, { k: "history", l: "履歴" }].map(t => (
        <button key={t.k} onClick={() => setTab(t.k as any)} style={{ padding: "9px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800, background: tab === t.k ? "linear-gradient(135deg, #34d399, #10b981)" : "rgba(255,255,255,0.06)", color: tab === t.k ? "#fff" : "#9ca3af" }}>{t.l}</button>
        ))}
      </div>
      {msg && <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>{msg}</div>}

      {loading ? <p style={{ color: "#9ca3af", fontSize: 13 }}>読み込み中...</p> : tab === "items" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11.5, color: "#8b8fa8", padding: "10px 14px", borderRadius: 10, background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)" }}>新規アイテムは描画実装が必要なため、追加は開発側（SQL＋描画パッチ）で行います</div>
          {items.map(it => (
            <div key={it.id} style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, opacity: it.is_active ? 1 : 0.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 30, width: 44, textAlign: "center" }}>{it.emoji || "🎁"}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{it.name}</div>
                  <div style={{ fontSize: 11, color: "#8b8fa8" }}>{CAT_LABEL[it.category] || it.category} ／ {it.css_key} ／ {it.price}pt ／ {it.rarity}</div>
                </div>
              </div>
              <button onClick={() => toggleActive(it)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 800, background: it.is_active ? "rgba(248,113,113,0.15)" : "rgba(52,211,153,0.15)", color: it.is_active ? "#f87171" : "#34d399" }}>{it.is_active ? "非公開" : "公開"}</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(tab === "pending" ? pending : history).length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 13 }}>{tab === "pending" ? "承認待ちの申請はありません" : "履歴はありません"}</p>
          ) : (tab === "pending" ? pending : history).map(p => (
            <div key={p.id} style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 26, width: 40, textAlign: "center" }}>{p.emoji || "🎁"}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{p.userName} <span style={{ color: "#34d399" }}>／ {p.itemName}</span> <span style={{ color: "#fbbf24" }}>{p.price}pt</span></div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{new Date(p.created_at).toLocaleString("ja-JP")}</div>
                </div>
              </div>
              {tab === "pending" ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => approve(p)} disabled={busy === p.id} style={{ padding: "9px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800, background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", opacity: busy === p.id ? 0.5 : 1 }}>✅ 承認</button>
                  <button onClick={() => reject(p)} disabled={busy === p.id} style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", fontSize: 13, fontWeight: 800, background: "rgba(255,255,255,0.05)", color: "#f87171", opacity: busy === p.id ? 0.5 : 1 }}>却下</button>
                </div>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 800, color: p.status === "approved" ? "#34d399" : "#f87171" }}>{p.status === "approved" ? "承認済み" : "却下"}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
