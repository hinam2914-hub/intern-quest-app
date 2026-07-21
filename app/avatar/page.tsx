"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const AVATARS = [
  { id: "girl_bob_brown", label: "ボブ・茶" },
  { id: "boy_short_black", label: "ショート・黒" },
  { id: "girl_pony_brown", label: "ポニーテール・茶" },
  { id: "girl_long_black", label: "ロング・黒" },
  { id: "boy_mash_brown", label: "マッシュ・茶" },
  { id: "boy_perm_black", label: "パーマ・黒" },
  { id: "girl_bun_brown", label: "おだんご・茶" },
];

type ShopItem = { id: string; image_id: string; name: string; description: string | null; price: number; rarity: string };

export default function AvatarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [ownedIds, setOwnedIds] = useState<string[]>([]);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [myPoints, setMyPoints] = useState(0);
  const [buyTarget, setBuyTarget] = useState<ShopItem | null>(null);
  const [buying, setBuying] = useState(false);
  const [msg, setMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("avatar_config").eq("id", user.id).single();
      const cfg = (profile as any)?.avatar_config;
      if (cfg?.id) setSelected(cfg.id);
      const [{ data: items }, { data: purchases }, { data: pt }] = await Promise.all([
        supabase.from("avatar_items").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("avatar_purchases").select("item_id,status").eq("user_id", user.id),
        supabase.from("user_points").select("points").eq("id", user.id).maybeSingle(),
      ]);
      setShopItems((items || []) as ShopItem[]);
      setOwnedIds((purchases || []).filter((p: any) => p.status === "approved").map((p: any) => p.item_id));
      setPendingIds((purchases || []).filter((p: any) => p.status === "pending").map((p: any) => p.item_id));
      setMyPoints((pt as any)?.points || 0);
      setLoading(false);
    };
    load();
  }, [router]);

  const requestBuy = async () => {
    if (!buyTarget || !userId || buying) return;
    if (myPoints < buyTarget.price) { setMsg("ポイントが足りません"); setBuyTarget(null); setTimeout(() => setMsg(""), 3000); return; }
    setBuying(true);
    await supabase.from("avatar_purchases").insert({ user_id: userId, item_id: buyTarget.id, status: "pending" });
    setPendingIds([...pendingIds, buyTarget.id]);
    setBuying(false);
    setBuyTarget(null);
    setMsg("✅ 購入申請しました！承認をお待ちください");
    setTimeout(() => setMsg(""), 4000);
  };

  const handleSave = async () => {
    if (!selected || !userId || saving) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ avatar_config: { type: "preset", id: selected } }).eq("id", userId);
    setSaving(false);
    if (error) { alert("保存に失敗しました。もう一度お試しください"); return; }
    router.push("/home");
  };

  if (loading) return <div style={{ minHeight: "100vh", background: "#fdfdfb", display: "flex", alignItems: "center", justifyContent: "center", color: "#8a94a0" }}>読み込み中...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#fdfdfb", padding: "40px 20px 120px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#2b3440", marginBottom: 6 }}>きみの分身をえらぼう</div>
          <div style={{ fontSize: 13, color: "#6f7a86" }}>ホームや村に登場する、きみのアバターだよ。あとからいつでも変えられる！</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {AVATARS.map((a) => {
            const isOn = selected === a.id;
            return (
              <div key={a.id} onClick={() => setSelected(a.id)} style={{ background: "#fff", borderRadius: 20, padding: "14px 10px 12px", textAlign: "center", cursor: "pointer", border: isOn ? "3px solid #ff8a3d" : "3px solid transparent", boxShadow: isOn ? "0 8px 24px rgba(255,138,61,.25)" : "0 4px 14px rgba(43,52,64,.07)", transform: isOn ? "scale(1.02)" : "scale(1)", transition: "all .15s ease" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/avatars/${a.id}.png`} alt={a.label} style={{ width: "100%", height: 140, objectFit: "contain" }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: isOn ? "#e8590c" : "#6f7a86", marginTop: 6 }}>{isOn ? "✓ " : ""}{a.label}</div>
              </div>
            );
          })}
        </div>

        {shopItems.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#2b3440" }}>🛍 アバターショップ</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#e8590c" }}>所持 {myPoints.toLocaleString()}pt</div>
            </div>
            <div style={{ fontSize: 12, color: "#6f7a86", marginBottom: 14 }}>ポイントで特別なアバターを解放できるよ（承認制）</div>
            {msg && <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.35)", color: "#0f9d69", fontSize: 13, fontWeight: 700 }}>{msg}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
              {shopItems.map((it) => {
                const owned = ownedIds.includes(it.id);
                const pending = pendingIds.includes(it.id);
                const isOn = selected === it.image_id;
                const rarityColor = it.rarity === "legend" ? "#f59e0b" : it.rarity === "epic" ? "#a855f7" : it.rarity === "rare" ? "#3b82f6" : "#9ca3af";
                return (
                  <div key={it.id} onClick={() => { if (owned) setSelected(it.image_id); else if (!pending) setBuyTarget(it); }}
                    style={{ background: "#fff", borderRadius: 20, padding: "14px 10px 12px", textAlign: "center", cursor: "pointer", position: "relative", border: isOn ? "3px solid #ff8a3d" : `3px solid ${owned ? "transparent" : rarityColor + "44"}`, boxShadow: isOn ? "0 8px 24px rgba(255,138,61,.25)" : "0 4px 14px rgba(43,52,64,.07)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/avatars/${it.image_id}.png`} alt={it.name} style={{ width: "100%", height: 140, objectFit: "contain", filter: owned ? "none" : "grayscale(1) opacity(.45)" }} />
                    {!owned && <div style={{ position: "absolute", top: "38%", left: 0, right: 0, fontSize: 30 }}>{pending ? "⏳" : "🔒"}</div>}
                    <div style={{ fontSize: 12, fontWeight: 800, color: owned ? (isOn ? "#e8590c" : "#6f7a86") : "#2b3440", marginTop: 6 }}>{isOn ? "✓ " : ""}{it.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: owned ? "#10b981" : pending ? "#f59e0b" : rarityColor, marginTop: 3 }}>
                      {owned ? "獲得済み" : pending ? "承認待ち" : `${it.price.toLocaleString()}pt`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "14px 20px 24px", background: "linear-gradient(180deg, rgba(253,253,251,0), #fdfdfb 40%)" }}>
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <button onClick={handleSave} disabled={!selected || saving} style={{ width: "100%", padding: 16, borderRadius: 16, border: "none", background: selected ? "linear-gradient(135deg, #ffb45c, #ff8a3d)" : "#e5e7eb", color: selected ? "#fff" : "#9ca3af", fontSize: 16, fontWeight: 900, cursor: selected ? "pointer" : "default", boxShadow: selected ? "0 10px 24px rgba(255,138,61,.35)" : "none" }}>
              {saving ? "保存中..." : "これにする！"}
            </button>
          </div>
        </div>
      </div>
      {buyTarget && (
        <div onClick={() => setBuyTarget(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 20001 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 360, textAlign: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/avatars/${buyTarget.image_id}.png`} alt={buyTarget.name} style={{ width: 140, height: 140, objectFit: "contain" }} />
            <div style={{ fontSize: 18, fontWeight: 900, color: "#2b3440", marginTop: 8 }}>{buyTarget.name}</div>
            {buyTarget.description && <div style={{ fontSize: 12.5, color: "#6f7a86", marginTop: 4 }}>{buyTarget.description}</div>}
            <div style={{ fontSize: 22, fontWeight: 900, color: "#e8590c", margin: "14px 0 4px" }}>{buyTarget.price.toLocaleString()}pt</div>
            <div style={{ fontSize: 12, color: "#6f7a86", marginBottom: 18 }}>所持 {myPoints.toLocaleString()}pt → 残り {(myPoints - buyTarget.price).toLocaleString()}pt</div>
            <button onClick={requestBuy} disabled={buying} style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", background: "linear-gradient(135deg, #ffb45c, #ff8a3d)", color: "#fff", fontSize: 15, fontWeight: 900, cursor: "pointer", opacity: buying ? 0.6 : 1 }}>{buying ? "申請中..." : "購入を申請する"}</button>
            <button onClick={() => setBuyTarget(null)} style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 14, border: "none", background: "transparent", color: "#9ca3af", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>やめる</button>
          </div>
        </div>
      )}
    </div>
  );
}
