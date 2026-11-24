"use client";
// 応援掲示板の小窓。直近7日の「みんなの活躍」から新しい3件だけ見せて、応援掲示板（/cheer）へ案内する。
// 読むだけで、ここからは何も書き込まない（リアクション・コメント・投稿は応援掲示板で行う）。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { CHEER_LABEL, cheerWhen } from "../lib/cheer";
import AvatarFace, { OldAvatarFace, unifiedFaceSource, type FaceSource } from "./AvatarFace";

type Row = { key: string; uid: string; face: FaceSource | null; old: string | null; name: string; icon: string; text: string; when: string; manual: boolean; reacts: number; comments: number };

export default function CheerTeaser({ limit = 3 }: { limit?: number }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d7 = new Date(Date.now() - 7 * 86400000).toISOString();
        const [{ data: ph }, { data: posts }] = await Promise.all([
          supabase.from("points_history").select("user_id,reason,created_at").gt("change", 0).gte("created_at", d7).order("created_at", { ascending: false }).limit(200),
          supabase.from("cheer_posts").select("*").gte("created_at", d7).order("created_at", { ascending: false }).limit(20),
        ]);
        const seen = new Set<string>(); const auto: any[] = [];
        (ph || []).forEach((p: any) => {
          const l = CHEER_LABEL(p.reason || ""); if (!l) return;
          const k = p.user_id + l.text + (p.created_at || "").slice(0, 10); if (seen.has(k)) return; seen.add(k);
          auto.push({ uid: p.user_id, created_at: p.created_at, manual: false, text: l.text, icon: l.icon, key: l.text + "_" + (p.created_at || "").slice(0, 10) });
        });
        const manual = (posts || []).map((p: any) => ({ uid: p.user_id, created_at: p.created_at, manual: true, text: p.body, icon: p.category === "sales" ? "💼" : p.category === "learn" ? "📖" : "✨", key: "post_" + p.id }));
        const top = [...auto, ...manual].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit);
        const ids = [...new Set(top.map((t) => t.uid))]; const keys = top.map((t) => t.key);
        const [{ data: profs }, { data: rs }, { data: cs }] = await Promise.all([
          ids.length ? supabase.from("profiles").select("id,name,avatar_config,job_class").in("id", ids) : Promise.resolve({ data: [] as any[] }),
          keys.length ? supabase.from("achievement_reactions").select("target_user_id,target_key").in("target_key", keys) : Promise.resolve({ data: [] as any[] }),
          keys.length ? supabase.from("achievement_comments").select("target_user_id,target_key").in("target_key", keys) : Promise.resolve({ data: [] as any[] }),
        ]);
        const nameOf: Record<string, string> = {}; const faceOf: Record<string, FaceSource> = {}; const oldOf: Record<string, string | null> = {}; (profs || []).forEach((p: any) => { nameOf[p.id] = p.name; faceOf[p.id] = unifiedFaceSource(p); oldOf[p.id] = p.avatar_config?.id || null; });
        const cnt = (list: any[] | null, t: any) => (list || []).filter((r: any) => r.target_key === t.key && r.target_user_id === t.uid).length;
        if (alive) setRows(top.map((t) => ({ key: t.uid + "|" + t.key, uid: t.uid, face: faceOf[t.uid] || null, old: oldOf[t.uid] || null, name: nameOf[t.uid] || "メンバー", icon: t.icon, text: t.text, when: cheerWhen(t.created_at), manual: t.manual, reacts: cnt(rs as any, t), comments: cnt(cs as any, t) })));
      } catch { if (alive) setRows([]); }
    })();
    return () => { alive = false; };
  }, [limit]);

  return (
    <section style={{ marginTop: 14, background: "rgba(255,249,237,.95)", border: "2px solid #D9A441", borderRadius: 18, padding: 14, boxShadow: "0 6px 18px rgba(16,47,112,.15)", color: "#2b2416", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#17397d" }}>📣 応援掲示板<span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 800, color: "#8a6a1e" }}>みんなの最近の活躍</span></div>
        <button onClick={() => router.push("/cheer")} style={{ flexShrink: 0, minHeight: 40, padding: "7px 14px", borderRadius: 999, border: "2px solid #F5D77E", background: "linear-gradient(180deg,#2f6ad1,#1454B8)", color: "#fff", fontSize: 12.5, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 10px rgba(16,47,112,.3)", whiteSpace: "nowrap" }}>応援しに行く →</button>
      </div>
      {rows === null ? (
        <div style={{ fontSize: 13, fontWeight: 700, color: "#8a7a55", padding: "8px 2px" }}>読み込み中…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 13, fontWeight: 700, color: "#6b5a33", padding: "8px 2px", lineHeight: 1.7 }}>この7日間の投稿はまだありません。最初の活躍を応援掲示板に書いてみよう。</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 8 }}>
          {rows.map((r) => (
            <button key={r.key} onClick={() => router.push("/cheer")} style={{ textAlign: "left", display: "flex", gap: 9, alignItems: "flex-start", padding: "10px 12px", borderRadius: 14, border: "2px solid #ecd9a6", background: "linear-gradient(180deg,#fffefa,#fbf2de)", cursor: "pointer", fontFamily: "inherit", color: "inherit", minWidth: 0 }}>
              <span style={{ position: "relative", flexShrink: 0, display: "block", width: 44, height: 44 }}>
                <AvatarFace src={r.face} size={44} border="2px solid #E2BF63" fallback={r.old ? <OldAvatarFace id={r.old} size={44} border="2px solid #E2BF63" /> : <span style={{ width: 44, height: 44, borderRadius: "50%", background: "#dbeafe", border: "2px solid #E2BF63", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxSizing: "border-box" }} aria-hidden>👤</span>} />
                <span style={{ position: "absolute", right: -5, bottom: -5, width: 22, height: 22, borderRadius: "50%", background: "#fff", border: "1.5px solid #E2BF63", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, lineHeight: 1 }} aria-hidden>{r.icon}</span>
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 11.5, fontWeight: 800, color: "#8a7a55" }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}さん{r.manual ? "" : "が"}</span><span style={{ flexShrink: 0 }}>{r.when}</span></span>
                <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 13.5, fontWeight: 900, color: "#1b2a5e", lineHeight: 1.5, marginTop: 2, overflowWrap: "anywhere" } as any}>{r.text}</span>
                <span style={{ display: "block", marginTop: 4, fontSize: 11.5, fontWeight: 800, color: "#8a6a1e" }}>👏 {r.reacts}　💬 {r.comments}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
