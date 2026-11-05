"use client";
// 装備ショップ管理（アバター装備のポイント購入）。島ショップと同じ承認フロー：
// 承認した時点で残高チェック→ポイント減算→points_history記録。却下なら減算なし。
// アイテム管理で価格変更・公開/非公開を切り替えられる（素材が届いた部位から公開する運用を想定）。
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Item = { id: string; gear_key: string; job: string; slot: string; name: string; price: number; rarity: string; sort_order: number; is_active: boolean };
type Purchase = { id: string; user_id: string; item_id: string; status: string; created_at: string; userName?: string; itemName?: string; price?: number; jobName?: string };

const JOB_LABEL: Record<string, string> = { knight: "🛡️ ナイト", mage: "🪄 魔法使い", archer: "🏹 アーチャー", healer: "✨ ヒーラー", rogue: "🗡️ ローグ", paladin: "⚔️ パラディン" };
const SLOT_LABEL: Record<string, string> = { outfit: "衣装", head: "帽子・頭飾り", cape: "マント", weapon: "武器", accessory: "アクセサリー" };

export default function GearShopTab() {
  const [tab, setTab] = useState<"pending" | "items" | "history">("pending");
  const [items, setItems] = useState<Item[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [jobFilter, setJobFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data: its, error } = await supabase.from("gear_items").select("*").order("sort_order");
    if (error) { setMsg("gear_items が見つかりません。gear_shop.sql を実行してください（" + error.message + "）"); setLoading(false); return; }
    const list = (its || []) as Item[];
    setItems(list);
    const { data: prs } = await supabase.from("gear_purchases").select("*").order("created_at", { ascending: false }).limit(200);
    const rows = (prs || []) as Purchase[];
    const uids = [...new Set(rows.map(r => r.user_id))];
    const names: Record<string, string> = {};
    if (uids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,name").in("id", uids);
      (profs || []).forEach((p: any) => { names[p.id] = p.name; });
    }
    const imap: Record<string, Item> = {};
    list.forEach(i => { imap[i.id] = i; });
    setPurchases(rows.map(r => ({ ...r, userName: names[r.user_id] || "不明", itemName: imap[r.item_id]?.name || "?", price: imap[r.item_id]?.price || 0, jobName: JOB_LABEL[imap[r.item_id]?.job || ""] || imap[r.item_id]?.job })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // 承認＝ここでポイント減算（島ショップと同一処理）
  const approve = async (p: Purchase) => {
    if (busy) return;
    setBusy(p.id);
    const cost = p.price || 0;
    const { data: up } = await supabase.from("user_points").select("points").eq("id", p.user_id).single();
    const cur = (up as any)?.points || 0;
    if (cur < cost) { setMsg("ポイント不足のため承認できません"); setBusy(null); setTimeout(() => setMsg(""), 3000); return; }
    await supabase.from("user_points").update({ points: cur - cost }).eq("id", p.user_id);
    await supabase.from("points_history").insert({ user_id: p.user_id, change: -cost, reason: `gear_${p.itemName}` });
    await supabase.from("gear_purchases").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", p.id);
    setBusy(null); load();
  };
  const reject = async (p: Purchase) => {
    if (busy) return;
    setBusy(p.id);
    await supabase.from("gear_purchases").update({ status: "rejected", approved_at: new Date().toISOString() }).eq("id", p.id);
    setBusy(null); load();
  };
  const toggleActive = async (it: Item) => {
    await supabase.from("gear_items").update({ is_active: !it.is_active }).eq("id", it.id);
    load();
  };
  const editPrice = async (it: Item) => {
    const v = prompt(`「${it.name}」の価格（pt）`, String(it.price));
    if (v === null) return;
    const n = parseInt(v, 10);
    if (!Number.isFinite(n) || n < 0) { setMsg("価格は0以上の数字で入力してください"); setTimeout(() => setMsg(""), 3000); return; }
    await supabase.from("gear_items").update({ price: n }).eq("id", it.id);
    load();
  };

  const pending = purchases.filter(p => p.status === "pending");
  const history = purchases.filter(p => p.status !== "pending");
  const shownItems = jobFilter === "all" ? items : items.filter(i => i.job === jobFilter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>⚔️ 装備ショップ管理</h2>
      <div style={{ display: "flex", gap: 8 }}>
        {[{ k: "pending", l: `承認待ち${pending.length > 0 ? ` (${pending.length})` : ""}` }, { k: "items", l: "アイテム管理" }, { k: "history", l: "履歴" }].map(t => (
        <button key={t.k} onClick={() => setTab(t.k as any)} style={{ padding: "9px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800, background: tab === t.k ? "linear-gradient(135deg, #f59e0b, #d97706)" : "rgba(255,255,255,0.06)", color: tab === t.k ? "#fff" : "#9ca3af" }}>{t.l}</button>
        ))}
      </div>
      {msg && <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>{msg}</div>}

      {loading ? <p style={{ color: "#9ca3af", fontSize: 13 }}>読み込み中...</p> : tab === "items" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11.5, color: "#8b8fa8", padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
            「価格」をタップで変更できます。非公開にすると編集画面に価格が表示されず購入できません（画像素材が届いた装備から公開する運用がおすすめ）。購入済みユーザーの装備は非公開にしても外れません。
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["all", "すべて"], ...Object.entries(JOB_LABEL)].map(([k, l]) => (
              <button key={k} onClick={() => setJobFilter(k)} style={{ padding: "5px 12px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: jobFilter === k ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.06)", color: jobFilter === k ? "#fde68a" : "#9ca3af" }}>{l}</button>
            ))}
          </div>
          {shownItems.map(it => (
            <div key={it.id} style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", opacity: it.is_active ? 1 : 0.5 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{it.name}</div>
                <div style={{ fontSize: 11, color: "#8b8fa8" }}>{JOB_LABEL[it.job] || it.job} ／ {SLOT_LABEL[it.slot] || it.slot} ／ {it.gear_key}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => editPrice(it)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(251,191,36,0.4)", cursor: "pointer", fontSize: 12.5, fontWeight: 800, background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>{it.price.toLocaleString()}pt ✏️</button>
                <button onClick={() => toggleActive(it)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 800, background: it.is_active ? "rgba(248,113,113,0.15)" : "rgba(52,211,153,0.15)", color: it.is_active ? "#f87171" : "#34d399" }}>{it.is_active ? "非公開" : "公開"}</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(tab === "pending" ? pending : history).length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 13 }}>{tab === "pending" ? "承認待ちの申請はありません" : "履歴はありません"}</p>
          ) : (tab === "pending" ? pending : history).map(p => (
            <div key={p.id} style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{p.userName} <span style={{ color: "#fbbf24" }}>／ {p.itemName}</span> <span style={{ color: "#fde68a" }}>{(p.price || 0).toLocaleString()}pt</span></div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{p.jobName}　{new Date(p.created_at).toLocaleString("ja-JP")}</div>
              </div>
              {tab === "pending" ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => approve(p)} disabled={busy === p.id} style={{ padding: "9px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800, background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", opacity: busy === p.id ? 0.5 : 1 }}>✅ 承認（pt減算）</button>
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
