"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Course = { id: string; name: string; description: string | null; icon: string; max_level: number; attend_points: number; teach_points: number; sort_order: number; is_active: boolean };
type Stamp = { id: string; user_id: string; course_id: string; level: number; stamp_type: string; status: string; note: string | null; created_at: string; userName?: string; courseName?: string; points?: number };

export default function CourseManageTab() {
  const [tab, setTab] = useState<"pending" | "courses" | "history">("pending");
  const [courses, setCourses] = useState<Course[]>([]);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  // 新規講座フォーム
  const [nName, setNName] = useState("");
  const [nDesc, setNDesc] = useState("");
  const [nIcon, setNIcon] = useState("🎓");
  const [nLevel, setNLevel] = useState(3);
  const [nAttend, setNAttend] = useState(10);
  const [nTeach, setNTeach] = useState(30);

  const load = async () => {
    setLoading(true);
    const { data: cs } = await supabase.from("courses").select("*").order("sort_order");
    const list = (cs || []) as Course[];
    setCourses(list);
    const { data: st } = await supabase.from("course_stamps").select("*").order("created_at", { ascending: false }).limit(300);
    const rows = (st || []) as Stamp[];
    const ids = [...new Set(rows.map(r => r.user_id))];
    const names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,name").in("id", ids);
      (profs || []).forEach((p: any) => { names[p.id] = p.name; });
    }
    const cmap: Record<string, Course> = {};
    list.forEach(c => { cmap[c.id] = c; });
    setStamps(rows.map(r => ({ ...r, userName: names[r.user_id] || "不明", courseName: cmap[r.course_id]?.name || "?", points: r.stamp_type === "受講" ? cmap[r.course_id]?.attend_points : cmap[r.course_id]?.teach_points })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const approve = async (s: Stamp) => {
    if (busy) return;
    setBusy(s.id);
    const pt = s.points || 0;
    const { data: up } = await supabase.from("user_points").select("points").eq("id", s.user_id).single();
    if (up) await supabase.from("user_points").update({ points: (up.points || 0) + pt }).eq("id", s.user_id);
    await supabase.from("points_history").insert({ user_id: s.user_id, change: pt, reason: `course_${s.stamp_type}_${s.courseName}_Lv${s.level}` });
    await supabase.from("course_stamps").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", s.id);
    setBusy(null); load();
  };
  const reject = async (s: Stamp) => {
    if (busy) return;
    setBusy(s.id);
    await supabase.from("course_stamps").update({ status: "rejected", approved_at: new Date().toISOString() }).eq("id", s.id);
    setBusy(null); load();
  };
  const addCourse = async () => {
    if (!nName.trim()) { setMsg("講座名を入力してください"); return; }
    await supabase.from("courses").insert({ name: nName.trim(), description: nDesc.trim() || null, icon: nIcon || "🎓", max_level: nLevel, attend_points: nAttend, teach_points: nTeach, sort_order: courses.length + 1, is_active: true });
    setNName(""); setNDesc(""); setNIcon("🎓"); setNLevel(3); setNAttend(10); setNTeach(30);
    setMsg("✅ 講座を追加しました");
    load();
  };
  const toggleActive = async (c: Course) => {
    await supabase.from("courses").update({ is_active: !c.is_active }).eq("id", c.id);
    load();
  };

  const pending = stamps.filter(s => s.status === "pending");
  const history = stamps.filter(s => s.status !== "pending");
  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>🎓 講座スタンプ管理</h2>
      <div style={{ display: "flex", gap: 8 }}>
        {[{ k: "pending", l: `承認待ち${pending.length > 0 ? ` (${pending.length})` : ""}` }, { k: "courses", l: "講座マスタ" }, { k: "history", l: "履歴" }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)} style={{ padding: "9px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800, background: tab === t.k ? "linear-gradient(135deg, #8b5cf6, #6366f1)" : "rgba(255,255,255,0.06)", color: tab === t.k ? "#fff" : "#9ca3af" }}>{t.l}</button>
        ))}
      </div>
      {msg && <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>{msg}</div>}

      {loading ? <p style={{ color: "#9ca3af", fontSize: 13 }}>読み込み中...</p> : tab === "courses" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ padding: 20, borderRadius: 14, background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.25)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#a78bfa", marginBottom: 14 }}>NEW COURSE</div>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10, marginBottom: 10 }}>
              <input value={nIcon} onChange={e => setNIcon(e.target.value)} placeholder="🎓" style={{ ...inp, textAlign: "center", fontSize: 20 }} />
              <input value={nName} onChange={e => setNName(e.target.value)} placeholder="講座名（例：AI授業 / 営業講座）" style={inp} />
            </div>
            <input value={nDesc} onChange={e => setNDesc(e.target.value)} placeholder="説明" style={{ ...inp, marginBottom: 10 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div><div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>レベル数</div><input type="number" min={1} max={10} value={nLevel} onChange={e => setNLevel(parseInt(e.target.value) || 1)} style={inp} /></div>
              <div><div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>受講pt</div><input type="number" value={nAttend} onChange={e => setNAttend(parseInt(e.target.value) || 0)} style={inp} /></div>
              <div><div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>講師pt</div><input type="number" value={nTeach} onChange={e => setNTeach(parseInt(e.target.value) || 0)} style={inp} /></div>
            </div>
            <button onClick={addCourse} style={{ padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>講座を追加</button>
          </div>
          {courses.map(c => (
            <div key={c.id} style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", opacity: c.is_active ? 1 : 0.5 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{c.icon} {c.name}</div>
                <div style={{ fontSize: 11, color: "#8b8fa8", marginTop: 3 }}>Lv.1〜{c.max_level} ／ 受講+{c.attend_points}pt ／ 講師+{c.teach_points}pt</div>
              </div>
              <button onClick={() => toggleActive(c)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 800, background: c.is_active ? "rgba(248,113,113,0.15)" : "rgba(52,211,153,0.15)", color: c.is_active ? "#f87171" : "#34d399" }}>{c.is_active ? "非公開にする" : "公開する"}</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(tab === "pending" ? pending : history).length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 13 }}>{tab === "pending" ? "承認待ちの申請はありません" : "履歴はありません"}</p>
          ) : (tab === "pending" ? pending : history).map(s => (
            <div key={s.id} style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                  {s.userName} <span style={{ color: "#a78bfa" }}>／ {s.courseName} Lv.{s.level}「{s.stamp_type}」</span> <span style={{ color: "#fbbf24" }}>+{s.points}pt</span>
                </div>
                {s.note && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>📝 {s.note}</div>}
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{new Date(s.created_at).toLocaleString("ja-JP")}</div>
              </div>
              {tab === "pending" ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => approve(s)} disabled={busy === s.id} style={{ padding: "9px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800, background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", opacity: busy === s.id ? 0.5 : 1 }}>✅ 承認</button>
                  <button onClick={() => reject(s)} disabled={busy === s.id} style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", fontSize: 13, fontWeight: 800, background: "rgba(255,255,255,0.05)", color: "#f87171", opacity: busy === s.id ? 0.5 : 1 }}>却下</button>
                </div>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 800, color: s.status === "approved" ? "#34d399" : "#f87171" }}>{s.status === "approved" ? "承認済み" : "却下"}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
