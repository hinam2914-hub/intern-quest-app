"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Ach = { name: string; text: string; icon: string; when: string; key: string; uid: string };

const LABEL = (r: string): { text: string; icon: string } | null => {
  if (r.includes("challenge_complete")) return { text: "ライフチャレンジを達成", icon: "🎯" };
  if (r.includes("es_first_completed")) return { text: "ESを完成させた", icon: "📝" };
  if (r.includes("thinking_ippon_received")) return { text: "IPPONを獲得", icon: "🎤" };
  if (r.startsWith("course_受講")) return { text: "講座を受講", icon: "🎓" };
  if (r.startsWith("course_講師")) return { text: "講師デビュー", icon: "🧑‍🏫" };
  if (r.includes("recruit_入社")) return { text: "新メンバーを入社に導いた", icon: "🎉" };
  if (r.includes("recruit_採用面談")) return { text: "採用面談を実施", icon: "🤝" };
  if (r.includes("avatar_")) return { text: "新しいアバターを手に入れた", icon: "👗" };
  if (r.includes("kpi")) return { text: "月間KPIを達成", icon: "🏆" };
  if (r.includes("content_complete")) return { text: "学習コンテンツを完了", icon: "📚" };
  return null;
};

export default function CheerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [myName, setMyName] = useState("");
  const [items, setItems] = useState<Ach[]>([]);
  const [reactions, setReactions] = useState<Record<string, { emoji: string; count: number; mine: boolean }[]>>({});
  const [comments, setComments] = useState<Record<string, { name: string; body: string }[]>>({});
  const [input, setInput] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      const { data: me } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
      setMyName((me as any)?.name || "");
      const d3 = new Date(Date.now() - 3 * 86400000).toISOString();
      const { data: ph } = await supabase.from("points_history").select("user_id,reason,created_at").gt("change", 0).gte("created_at", d3).order("created_at", { ascending: false }).limit(400);
      const picked = (ph || []).map((p: any) => ({ uid: p.user_id, created_at: p.created_at, ...LABEL(p.reason || "") })).filter((p: any) => p.text);
      const uniq: any[] = [];
      const seen = new Set<string>();
      for (const p of picked) {
        const k = p.uid + p.text + (p.created_at || "").slice(0, 10);
        if (seen.has(k)) continue;
        seen.add(k); uniq.push(p);
        if (uniq.length >= 40) break;
      }
      const ids = [...new Set(uniq.map((u: any) => u.uid))];
      const nameMap: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,name").in("id", ids);
        (profs || []).forEach((p: any) => { nameMap[p.id] = p.name; });
      }
      const list: Ach[] = uniq.map((u: any) => {
        const diff = Math.floor((Date.now() - new Date(u.created_at).getTime()) / 3600000);
        const when = diff < 1 ? "さっき" : diff < 24 ? `${diff}時間前` : `${Math.floor(diff / 24)}日前`;
        return { name: nameMap[u.uid] || "メンバー", text: u.text, icon: u.icon, when, key: u.text + "_" + (u.created_at || "").slice(0, 10), uid: u.uid };
      });
      setItems(list);
      const keys = list.map(l => l.key);
      if (keys.length) {
        const [{ data: rs }, { data: cs }] = await Promise.all([
          supabase.from("achievement_reactions").select("*").in("target_key", keys),
          supabase.from("achievement_comments").select("*").in("target_key", keys).order("created_at"),
        ]);
        const rMap: Record<string, { emoji: string; count: number; mine: boolean }[]> = {};
        (rs || []).forEach((r: any) => {
          const k = r.target_user_id + "|" + r.target_key;
          rMap[k] = rMap[k] || [];
          const f = rMap[k].find(x => x.emoji === r.emoji);
          if (f) { f.count++; if (r.user_id === user.id) f.mine = true; }
          else rMap[k].push({ emoji: r.emoji, count: 1, mine: r.user_id === user.id });
        });
        setReactions(rMap);
        const cIds = [...new Set((cs || []).map((c: any) => c.user_id))];
        const cNames: Record<string, string> = {};
        if (cIds.length) {
          const { data: cp } = await supabase.from("profiles").select("id,name").in("id", cIds);
          (cp || []).forEach((p: any) => { cNames[p.id] = p.name; });
        }
        const cMap: Record<string, { name: string; body: string }[]> = {};
        (cs || []).forEach((c: any) => {
          const k = c.target_user_id + "|" + c.target_key;
          cMap[k] = cMap[k] || [];
          cMap[k].push({ name: cNames[c.user_id] || "メンバー", body: c.body });
        });
        setComments(cMap);
      }
      setLoading(false);
    })();
  }, [router]);

  const toggle = async (uid: string, key: string, emoji: string) => {
    if (!userId) return;
    const mk = uid + "|" + key;
    const list = reactions[mk] || [];
    const f = list.find(r => r.emoji === emoji);
    if (f?.mine) {
      await supabase.from("achievement_reactions").delete().eq("target_user_id", uid).eq("target_key", key).eq("user_id", userId).eq("emoji", emoji);
      setReactions({ ...reactions, [mk]: list.map(r => r.emoji === emoji ? { ...r, count: Math.max(0, r.count - 1), mine: false } : r).filter(r => r.count > 0) });
    } else {
      await supabase.from("achievement_reactions").insert({ target_user_id: uid, target_key: key, user_id: userId, emoji });
      setReactions({ ...reactions, [mk]: f ? list.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r) : [...list, { emoji, count: 1, mine: true }] });
    }
  };
  const send = async (uid: string, key: string) => {
    const mk = uid + "|" + key;
    const body = (input[mk] || "").trim();
    if (!body || !userId) return;
    await supabase.from("achievement_comments").insert({ target_user_id: uid, target_key: key, user_id: userId, body });
    setComments({ ...comments, [mk]: [...(comments[mk] || []), { name: myName || "あなた", body }] });
    setInput({ ...input, [mk]: "" });
  };

  if (loading) return <div style={{ minHeight: "100vh", background: "#fdfdfb", display: "flex", alignItems: "center", justifyContent: "center", color: "#8a94a0" }}>読み込み中...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #fff7ed, #fdfdfb 40%)", padding: "0 0 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", position: "sticky", top: 0, background: "rgba(255,247,237,.92)", backdropFilter: "blur(8px)", zIndex: 10 }}>
        <span style={{ fontSize: 17, fontWeight: 900, color: "#2b3440" }}>📣 みんなの活躍</span>
        <button onClick={() => router.push("/mypage")} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,.08)", background: "#fff", color: "#6f7a86", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>← 戻る</button>
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "8px 16px" }}>
        <div style={{ fontSize: 12.5, color: "#6f7a86", marginBottom: 16 }}>ここ3日間のみんなの達成です。スタンプやコメントで応援しよう！</div>
        {items.length === 0 ? (
          <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: 40 }}>まだ達成がありません</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map((a, i) => {
              const mk = a.uid + "|" + a.key;
              const rs = reactions[mk] || [];
              const cs = comments[mk] || [];
              const isOpen = open === mk;
              return (
                <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", boxShadow: "0 3px 12px rgba(43,52,64,.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{a.icon}</span>
                    <span style={{ flex: 1, fontSize: 13.5, color: "#2b3440", lineHeight: 1.5 }}>
                      <strong style={{ fontWeight: 800 }}>{a.name}</strong>さんが{a.text}
                    </span>
                    <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{a.when}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    {["👏", "🔥", "🎉", "💪"].map(em => {
                      const r = rs.find(x => x.emoji === em);
                      return (
                        <button key={em} onClick={() => toggle(a.uid, a.key, em)} style={{ padding: "5px 11px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontWeight: 700, border: `1px solid ${r?.mine ? "rgba(255,138,61,.5)" : "rgba(0,0,0,.07)"}`, background: r?.mine ? "rgba(255,138,61,.12)" : "#fff", color: "#2b3440" }}>
                          {em}{r && r.count > 0 ? ` ${r.count}` : ""}
                        </button>
                      );
                    })}
                    <button onClick={() => setOpen(isOpen ? null : mk)} style={{ padding: "5px 11px", borderRadius: 20, cursor: "pointer", fontSize: 12.5, fontWeight: 700, border: "1px solid rgba(0,0,0,.07)", background: "#fff", color: "#6f7a86" }}>
                      💬{cs.length > 0 ? ` ${cs.length}` : ""}
                    </button>
                  </div>
                  {(isOpen || cs.length > 0) && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
                      {cs.map((c, ci) => (
                        <div key={ci} style={{ fontSize: 12.5, color: "#2b3440", padding: "7px 11px", borderRadius: 10, background: "#f7f8fa" }}>
                          <strong style={{ fontWeight: 800 }}>{c.name}</strong>: {c.body}
                        </div>
                      ))}
                      {isOpen && (
                        <div style={{ display: "flex", gap: 7 }}>
                          <input value={input[mk] || ""} onChange={(e) => setInput({ ...input, [mk]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && send(a.uid, a.key)} placeholder="応援コメントを送る" style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,.08)", fontSize: 13, outline: "none", color: "#2b3440" }} />
                          <button onClick={() => send(a.uid, a.key)} style={{ padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 800, background: "linear-gradient(135deg,#ffb45c,#ff8a3d)", color: "#fff" }}>送信</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
