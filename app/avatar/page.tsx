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

export default function AvatarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("avatar_config").eq("id", user.id).single();
      const cfg = (profile as any)?.avatar_config;
      if (cfg?.id) setSelected(cfg.id);
      setLoading(false);
    };
    load();
  }, [router]);

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

        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "14px 20px 24px", background: "linear-gradient(180deg, rgba(253,253,251,0), #fdfdfb 40%)" }}>
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <button onClick={handleSave} disabled={!selected || saving} style={{ width: "100%", padding: 16, borderRadius: 16, border: "none", background: selected ? "linear-gradient(135deg, #ffb45c, #ff8a3d)" : "#e5e7eb", color: selected ? "#fff" : "#9ca3af", fontSize: 16, fontWeight: 900, cursor: selected ? "pointer" : "default", boxShadow: selected ? "0 10px 24px rgba(255,138,61,.35)" : "none" }}>
              {saving ? "保存中..." : "これにする！"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
