"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Item = { name: string; text: string; sub: string; icon: string; when: string; key: string; uid: string; avatar: string | null; cat: string; ts: number };

const LABEL = (r: string): { text: string; icon: string; cat: string } | null => {
  if (r.includes("challenge_complete")) return { text: "ライフチャレンジを達成！", icon: "🎯", cat: "other" };
  if (r.includes("es_first_completed")) return { text: "ESを完成させた！", icon: "📝", cat: "learn" };
  if (r.includes("thinking_ippon_received")) return { text: "IPPONを獲得！", icon: "🎤", cat: "other" };
  if (r.startsWith("course_受講")) return { text: "講座を受講！", icon: "🎓", cat: "learn" };
  if (r.startsWith("course_講師")) return { text: "講師デビュー！", icon: "🧑‍🏫", cat: "learn" };
  if (r.includes("recruit_入社")) return { text: "新メンバーを入社に導いた！", icon: "🎉", cat: "sales" };
  if (r.includes("recruit_採用面談")) return { text: "採用面談を実施！", icon: "🤝", cat: "sales" };
  if (r.includes("content_complete")) return { text: "学習コンテンツを完了！", icon: "📚", cat: "learn" };
  if (r.includes("kpi")) return { text: "月間KPIを達成！", icon: "🏆", cat: "sales" };
  return null;
};
const EMOJIS = ["👏", "🔥", "🎉", "💪"];
const CAT_STYLE: Record<string, { color: string; label: string }> = {
  sales: { color: "#f59e0b", label: "営業成果" },
  learn: { color: "#22d3ee", label: "学習" },
  other: { color: "#a78bfa", label: "達成" },
};
const PLACEHOLDERS = ["例：初受注を達成しました！", "例：テレアポで5件アポ獲得！", "例：学習コンテンツを完了しました！", "例：日報を7日連続達成！"];

export default function CheerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [myName, setMyName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [reactions, setReactions] = useState<Record<string, { emoji: string; count: number; mine: boolean }[]>>({});
  const [comments, setComments] = useState<Record<string, { name: string; body: string }[]>>({});
  const [input, setInput] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "sales" | "learn" | "other">("all");
  const [postBody, setPostBody] = useState("");
  const [postCat, setPostCat] = useState("sales");
  const [posting, setPosting] = useState(false);

  const load = async (uid: string) => {
    const d7 = new Date(Date.now() - 7 * 86400000).toISOString();
    const [{ data: ph }, { data: posts }] = await Promise.all([
      supabase.from("points_history").select("user_id,reason,created_at").gt("change", 0).gte("created_at", d7).order("created_at", { ascending: false }).limit(400),
      supabase.from("cheer_posts").select("*").gte("created_at", d7).order("created_at", { ascending: false }).limit(100),
    ]);
    const auto = (ph || []).map((p: any) => ({ uid: p.user_id, created_at: p.created_at, manual: false, body: "", ...LABEL(p.reason || "") })).filter((p: any) => p.text);
    const uniq: any[] = [];
    const seen = new Set<string>();
    for (const p of auto) {
      const k = p.uid + p.text + (p.created_at || "").slice(0, 10);
      if (seen.has(k)) continue;
      seen.add(k); uniq.push(p);
    }
    const manual = (posts || []).map((p: any) => ({ uid: p.user_id, created_at: p.created_at, manual: true, text: p.body, icon: p.category === "sales" ? "💼" : p.category === "learn" ? "📖" : "✨", cat: p.category || "other", postId: p.id }));
    const merged = [...uniq, ...manual].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 120);
    const ids = [...new Set(merged.map((u: any) => u.uid))];
    const profMap: Record<string, { name: string; avatar: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,name,avatar_config").in("id", ids);
      (profs || []).forEach((p: any) => { profMap[p.id] = { name: p.name, avatar: p.avatar_config?.id || null }; });
    }
    const list: Item[] = merged.map((u: any) => {
      const diff = Math.floor((Date.now() - new Date(u.created_at).getTime()) / 3600000);
      const when = diff < 1 ? "さっき" : diff < 24 ? `${diff}時間前` : `${Math.floor(diff / 24)}日前`;
      const key = u.manual ? "post_" + u.postId : u.text + "_" + (u.created_at || "").slice(0, 10);
      return { name: profMap[u.uid]?.name || "メンバー", text: u.text, sub: "", icon: u.icon, when, key, uid: u.uid, avatar: profMap[u.uid]?.avatar || null, cat: u.cat, ts: new Date(u.created_at).getTime() };
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
        if (f) { f.count++; if (r.user_id === uid) f.mine = true; }
        else rMap[k].push({ emoji: r.emoji, count: 1, mine: r.user_id === uid });
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
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      const { data: me } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
      setMyName((me as any)?.name || "");
      await load(user.id);
      setLoading(false);
    })();
  }, [router]);

  const rTotal = (it: Item) => (reactions[it.uid + "|" + it.key] || []).reduce((s, r) => s + r.count, 0);
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
  const submitPost = async () => {
    const body = postBody.trim();
    if (!body || posting || !userId) return;
    setPosting(true);
    await supabase.from("cheer_posts").insert({ user_id: userId, body, category: postCat });
    setPostBody("");
    await load(userId);
    setPosting(false);
  };

  if (loading) return <div style={{ minHeight: "100vh", background: "#0a0a14", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b8fa8" }}>読み込み中...</div>;

  const filtered = tab === "all" ? items : items.filter(i => i.cat === tab);
  const sorted = [...items].sort((a, b) => rTotal(b) - rTotal(a));
  const mvp = sorted[0] && rTotal(sorted[0]) > 0 ? sorted[0] : null;
  const hot = sorted.filter(i => rTotal(i) > 0 && i !== mvp).slice(0, 3);
  const AV = (a: Item, size: number) => a.avatar
    ? <img src={`/avatars/${a.avatar}.png`} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", objectPosition: "top", background: "#1e1b3a", border: "2px solid rgba(139,92,246,.4)" }} />
    : <div style={{ width: size, height: size, borderRadius: "50%", background: "#1e1b3a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5, border: "2px solid rgba(139,92,246,.4)" }}>👤</div>;

  const CARD: React.CSSProperties = { background: "rgba(18,16,40,.8)", border: "1px solid rgba(139,92,246,.25)", borderRadius: 16 };

  return (
    <div style={{ minHeight: "100vh", color: "#e5e7eb", padding: "0 0 80px", position: "relative" }}>
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(165deg, #0c0a1e, #08081a 60%)", zIndex: -1 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 20px", position: "sticky", top: 0, background: "rgba(8,8,26,.92)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(139,92,246,.2)", zIndex: 10 }}>
        <span style={{ fontSize: 17, fontWeight: 900, color: "#fff" }}>📣 応援掲示板 <span style={{ fontSize: 11.5, fontWeight: 700, color: "#a78bfa", marginLeft: 6 }}>みんなの活躍を応援しよう！</span></span>
        <button onClick={() => router.push("/mypage")} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.05)", color: "#9ca3af", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>← 戻る</button>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "18px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* MVP */}
        {mvp && (
          <div style={{ ...CARD, background: "linear-gradient(135deg, rgba(139,92,246,.2), rgba(18,16,40,.9))", border: "1px solid rgba(167,139,250,.45)", padding: "22px 24px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, color: "#c4b5fd", marginBottom: 8 }}>TODAY'S MVP</div>
              {AV(mvp, 72)}
              <div style={{ marginTop: 8, padding: "3px 12px", borderRadius: 20, background: "linear-gradient(135deg,#8b5cf6,#6366f1)", fontSize: 10.5, fontWeight: 900, color: "#fff" }}>本日のMVP</div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 21, fontWeight: 900, color: "#fff", marginBottom: 4 }}>🏆 {mvp.text}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#c4b5fd", marginBottom: 8 }}>{mvp.name} さん</div>
              <div style={{ fontSize: 13, color: "#8b8fa8" }}>応援数 <span style={{ fontSize: 20, fontWeight: 900, color: "#34d399" }}>{rTotal(mvp)}</span></div>
            </div>
          </div>
        )}

        {/* HOT */}
        {hot.length > 0 && (
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 900, color: "#f9a8d4", marginBottom: 10 }}>🔥 HOT！みんなが注目している活躍</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {hot.map((h, i) => (
                <div key={h.key} style={{ ...CARD, padding: "14px 14px", border: `1px solid ${i === 0 ? "rgba(251,191,36,.5)" : "rgba(139,92,246,.35)"}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: i === 0 ? "#f59e0b" : "#6d28d9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#fff", flexShrink: 0 }}>{i + 1}</div>
                    {AV(h, 42)}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, color: "#c7c9dd" }}>{h.name} さん</div>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", lineHeight: 1.35 }}>{h.text}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    {(reactions[h.uid + "|" + h.key] || []).map(r => (
                      <span key={r.emoji} style={{ fontSize: 11.5, fontWeight: 800, color: "#c7c9dd", padding: "3px 8px", borderRadius: 12, background: "rgba(255,255,255,.06)" }}>{r.emoji} {r.count}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 投稿フォーム */}
        <div style={{ ...CARD, padding: "16px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#a78bfa", marginBottom: 10, textShadow: "0 0 8px rgba(139,92,246,.4)" }}>⚔️ クエスト達成報告</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {[{ k: "sales", l: "💼 営業成果" }, { k: "learn", l: "📖 学習" }, { k: "other", l: "✨ その他" }].map(c => (
              <button key={c.k} onClick={() => setPostCat(c.k)} style={{ padding: "6px 13px", borderRadius: 16, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 800, background: postCat === c.k ? "linear-gradient(135deg,#8b5cf6,#6366f1)" : "rgba(255,255,255,.06)", color: postCat === c.k ? "#fff" : "#9ca3af" }}>{c.l}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={postBody} onChange={(e) => setPostBody(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitPost()} placeholder={PLACEHOLDERS[Math.floor(Date.now() / 60000) % PLACEHOLDERS.length]} style={{ flex: 1, padding: "11px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.12)", background: "rgba(0,0,0,.3)", color: "#f9fafb", fontSize: 13.5, outline: "none" }} />
            <button onClick={submitPost} disabled={posting} style={{ padding: "11px 20px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 900, background: "linear-gradient(135deg,#8b5cf6,#6366f1)", color: "#fff", opacity: posting ? 0.6 : 1 }}>{posting ? "送信中..." : "成果をシェアする 🚀"}</button>
          </div>
        </div>

        {/* 成長ログ */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 900, color: "#a78bfa" }}>📜 みんなの成長ログ</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[{ k: "all", l: "すべて" }, { k: "sales", l: "営業成果" }, { k: "learn", l: "学習" }, { k: "other", l: "その他" }].map(t => (
                <button key={t.k} onClick={() => setTab(t.k as any)} style={{ padding: "6px 12px", borderRadius: 14, border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 800, background: tab === t.k ? "rgba(139,92,246,.35)" : "rgba(255,255,255,.05)", color: tab === t.k ? "#e9d5ff" : "#8b8fa8" }}>{t.l}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "58vh", overflowY: "auto", paddingRight: 6 }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", color: "#6b7280", fontSize: 13, padding: 30 }}>まだ投稿がありません</div>
            ) : filtered.map((a) => {
              const mk = a.uid + "|" + a.key;
              const rs = reactions[mk] || [];
              const cs = comments[mk] || [];
              const isOpen = open === mk;
              const catSt = CAT_STYLE[a.cat] || CAT_STYLE.other;
              const total = rs.reduce((sum, r) => sum + r.count, 0);
              const isHotCard = total >= 3;
              return (
                <div key={mk} style={{ ...CARD, padding: "13px 15px", position: "relative", border: `1px solid ${isHotCard ? catSt.color + "88" : "rgba(139,92,246,.25)"}`, boxShadow: isHotCard ? `0 0 14px ${catSt.color}33` : "none" }}>
                  {isHotCard && <span style={{ position: "absolute", top: -9, right: 12, padding: "2px 10px", borderRadius: 10, background: "linear-gradient(135deg,#f97316,#ec4899)", fontSize: 9.5, fontWeight: 900, color: "#fff" }}>🔥 HOT</span>}
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: catSt.color + "22", border: `1px solid ${catSt.color}55` }}>
                      <span style={{ fontSize: 16, lineHeight: 1 }}>{a.icon}</span>
                      <span style={{ fontSize: 7.5, fontWeight: 900, color: catSt.color, marginTop: 1 }}>{catSt.label}</span>
                    </div>
                    {AV(a, 38)}
                    <span style={{ flex: 1, fontSize: 13, color: "#e5e7eb", lineHeight: 1.5, minWidth: 0 }}>
                      <strong style={{ fontWeight: 800, color: "#c4b5fd" }}>{a.name}</strong> さんが <strong style={{ fontWeight: 800 }}>{a.text}</strong>
                    </span>
                    <span style={{ fontSize: 10.5, color: "#6b7280", flexShrink: 0 }}>{a.when}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                    {EMOJIS.map(em => {
                      const r = rs.find(x => x.emoji === em);
                      return (
                        <button key={em} onClick={() => toggle(a.uid, a.key, em)} onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = "scale(1.12)"; }} onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = "scale(1)"; }} style={{ padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontWeight: 800, transition: "transform .12s ease, box-shadow .12s ease", border: `1.5px solid ${r?.mine ? "rgba(167,139,250,.7)" : "rgba(255,255,255,.12)"}`, background: r?.mine ? "rgba(139,92,246,.3)" : "rgba(255,255,255,.03)", color: "#e5e7eb", boxShadow: r?.mine ? "0 0 8px rgba(139,92,246,.35)" : "none" }}>
                          {em}{r && r.count > 0 ? ` ${r.count}` : ""}
                        </button>
                      );
                    })}
                    <button onClick={() => setOpen(isOpen ? null : mk)} style={{ padding: "4px 10px", borderRadius: 18, cursor: "pointer", fontSize: 12, fontWeight: 700, border: "1px solid rgba(255,255,255,.1)", background: "transparent", color: "#8b8fa8" }}>
                      💬{cs.length > 0 ? ` ${cs.length}` : ""}
                    </button>
                  </div>
                  {(isOpen || cs.length > 0) && (
                    <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 6 }}>
                      {cs.map((c, ci) => (
                        <div key={ci} style={{ fontSize: 12, color: "#e5e7eb", padding: "7px 11px", borderRadius: 9, background: "rgba(255,255,255,.05)" }}>
                          <strong style={{ fontWeight: 800, color: "#c4b5fd" }}>{c.name}</strong>: {c.body}
                        </div>
                      ))}
                      {isOpen && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <input value={input[mk] || ""} onChange={(e) => setInput({ ...input, [mk]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && send(a.uid, a.key)} placeholder="応援コメントを送る" style={{ flex: 1, padding: "8px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,.12)", background: "rgba(0,0,0,.3)", color: "#f9fafb", fontSize: 12.5, outline: "none" }} />
                          <button onClick={() => send(a.uid, a.key)} style={{ padding: "8px 15px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 800, background: "linear-gradient(135deg,#8b5cf6,#6366f1)", color: "#fff" }}>送信</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...CARD, textAlign: "center", padding: "18px", background: "linear-gradient(135deg, rgba(49,32,95,.5), rgba(16,14,42,.85))" }}>
          <div style={{ fontSize: 12, color: "#c7c9dd", marginBottom: 4 }}>一人ひとりの挑戦が、チーム全体の力になります。</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#c4b5fd" }}>さあ、今日も一緒に最高の未来へ進もう！🚀</div>
        </div>
      </div>
    </div>
  );
}
