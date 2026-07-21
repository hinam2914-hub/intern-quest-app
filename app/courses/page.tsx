"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Course = { id: string; name: string; description: string | null; icon: string; max_level: number; attend_points: number; teach_points: number; is_active: boolean };
type Stamp = { id: string; course_id: string; level: number; stamp_type: string; status: string; created_at: string };

export default function CoursesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [selected, setSelected] = useState<Course | null>(null);
  const [modal, setModal] = useState<{ level: number; type: string } | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async (uid: string) => {
    const { data: cs } = await supabase.from("courses").select("*").eq("is_active", true).order("sort_order");
    setCourses((cs || []) as Course[]);
    if (!selected && cs && cs.length > 0) setSelected(cs[0] as Course);
    const { data: st } = await supabase.from("course_stamps").select("*").eq("user_id", uid);
    setStamps((st || []) as Stamp[]);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      await load(user.id);
      setLoading(false);
    })();
  }, []);

  const getStamp = (courseId: string, level: number, type: string) => {
    const list = stamps.filter(s => s.course_id === courseId && s.level === level && s.stamp_type === type);
    return list.find(s => s.status === "approved") || list.find(s => s.status === "pending") || list[0];
  };

  const submit = async () => {
    if (!modal || !selected || sending) return;
    setSending(true);
    await supabase.from("course_stamps").insert({ user_id: userId, course_id: selected.id, level: modal.level, stamp_type: modal.type, note: note.trim() || null, status: "pending" });
    await load(userId);
    setModal(null); setNote(""); setSending(false);
    setMessage("✅ 申請しました！承認をお待ちください");
    setTimeout(() => setMessage(""), 4000);
  };

  if (loading) return <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center" }}>読み込み中...</div>;

  const levels = selected ? Array.from({ length: selected.max_level }, (_, i) => i + 1) : [];
  const approvedCount = selected ? stamps.filter(s => s.course_id === selected.id && s.status === "approved").length : 0;
  const totalStamps = selected ? selected.max_level * 2 : 0;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #0c0a1e, #0a0a0f 60%)", color: "#e5e7eb", padding: "0 0 60px" }}>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "28px 20px" }}>
        <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 800, letterSpacing: 3 }}>INTERN QUEST</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#fff", margin: "6px 0 20px" }}>🎓 講座スタンプラリー</h1>

        {/* 講座タブ */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {courses.map(c => (
            <button key={c.id} onClick={() => setSelected(c)} style={{ padding: "9px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800, background: selected?.id === c.id ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.06)", color: selected?.id === c.id ? "#fff" : "#9ca3af" }}>{c.icon} {c.name}</button>
          ))}
        </div>

        {message && <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399", fontSize: 13.5, fontWeight: 700 }}>{message}</div>}

        {selected && (
          <>
            <div style={{ padding: "18px 20px", borderRadius: 16, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.25)", marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{selected.icon} {selected.name}</div>
              {selected.description && <div style={{ fontSize: 12.5, color: "#9ca3af", lineHeight: 1.6 }}>{selected.description}</div>}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 800, marginBottom: 5 }}>
                  <span style={{ color: "#c7c9dd" }}>進捗</span>
                  <span style={{ color: "#818cf8" }}>{approvedCount} / {totalStamps} スタンプ</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
                  <div style={{ height: "100%", width: `${totalStamps ? (approvedCount / totalStamps) * 100 : 0}%`, borderRadius: 999, background: "linear-gradient(90deg,#6366f1,#8b5cf6)", transition: "width .8s ease" }} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {levels.map(lv => {
                const attend = getStamp(selected.id, lv, "受講");
                const teach = getStamp(selected.id, lv, "講師");
                const attendOk = attend?.status === "approved";
                const cards = [
                  { type: "受講", icon: "🎓", pt: selected.attend_points, stamp: attend, locked: false, lockMsg: "" },
                  { type: "講師", icon: "🧑‍🏫", pt: selected.teach_points, stamp: teach, locked: !attendOk, lockMsg: "受講スタンプ獲得後に解放" },
                ];
                return (
                  <div key={lv} style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#c4b5fd", marginBottom: 12 }}>Level {lv}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {cards.map(c => {
                        const done = c.stamp?.status === "approved";
                        const pending = c.stamp?.status === "pending";
                        return (
                          <div key={c.type} onClick={() => { if (!done && !pending && !c.locked) setModal({ level: lv, type: c.type }); }}
                            style={{ padding: "14px 12px", borderRadius: 12, textAlign: "center", cursor: (!done && !pending && !c.locked) ? "pointer" : "default", opacity: c.locked ? 0.4 : 1,
                              background: done ? "rgba(52,211,153,0.1)" : pending ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.03)",
                              border: `1.5px solid ${done ? "rgba(52,211,153,0.4)" : pending ? "rgba(251,191,36,0.35)" : "rgba(255,255,255,0.08)"}` }}>
                            <div style={{ fontSize: 26, marginBottom: 6 }}>{done ? "✅" : c.locked ? "🔒" : c.icon}</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: done ? "#6ee7b7" : "#f9fafb" }}>{c.type}</div>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: done ? "#34d399" : pending ? "#fbbf24" : "#6b7280", marginTop: 4 }}>
                              {done ? "獲得済み" : pending ? "承認待ち" : c.locked ? c.lockMsg : `+${c.pt}pt`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <button onClick={() => router.push("/menu")} style={{ display: "block", margin: "32px auto 0", padding: "13px 40px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 15, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>メニューへ戻る</button>
      </div>

      {modal && selected && (
        <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#15132b", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 18, padding: 24, width: "100%", maxWidth: 400 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", marginBottom: 6 }}>{selected.name} Lv.{modal.level}「{modal.type}」を申請</div>
            <div style={{ fontSize: 12.5, color: "#9ca3af", marginBottom: 16 }}>承認されると +{modal.type === "受講" ? selected.attend_points : selected.teach_points}pt</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={modal.type === "受講" ? "学んだことを一言（任意）" : "誰に何を教えたか（任意）"} style={{ width: "100%", height: 90, padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 14 }} />
            <button onClick={submit} disabled={sending} style={{ width: "100%", padding: 13, borderRadius: 10, border: "none", cursor: "pointer", fontSize: 15, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", opacity: sending ? 0.6 : 1 }}>{sending ? "送信中..." : "申請する"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
