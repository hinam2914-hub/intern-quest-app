"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { evaluateUser, syncUnlocks, requestCheck, CATEGORIES, STAGE_LABEL, type EvalResult, type NodeState, type JobState } from "../lib/skills";

export default function SkillBoardPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [res, setRes] = useState<EvalResult | null>(null);
  const [cat, setCat] = useState("sales");
  const [sel, setSel] = useState<NodeState | null>(null);
  const [unlockQueue, setUnlockQueue] = useState<{ title: string; sub: string; icon: string; key: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimText, setClaimText] = useState("");
  const [claimUrl, setClaimUrl] = useState("");

  async function load(withSync = true) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUid(user.id);
    const r = await evaluateUser(supabase, user.id);
    if (withSync) {
      const { newNodes, newJobs } = await syncUnlocks(supabase, user.id, r);
      const q = [
        ...newNodes.map((n) => ({ title: n.name, sub: "SKILL UNLOCKED", icon: n.icon ?? "✨", key: n.kind === "key" })),
        ...newJobs.map((j) => ({ title: j.name, sub: "JOB UNLOCKED", icon: j.icon ?? "🏅", key: true })),
      ];
      if (q.length) setUnlockQueue(q);
      if (newNodes.length || newJobs.length) {
        const r2 = await evaluateUser(supabase, user.id); setRes(r2);
      } else setRes(r);
    } else setRes(r);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const nodes = res?.nodes.filter((n) => n.category === cat) ?? [];
  const catInfo = CATEGORIES.find((c) => c.key === cat)!;
  const totalUnlocked = res?.nodes.filter((n) => n.status === "unlocked").length ?? 0;

  async function onRequestCheck(n: NodeState) {
    if (!uid) return;
    const ok = await requestCheck(supabase, uid, n.id);
    alert(ok ? "メンター認定を申請しました！" : "すでに申請中です");
    await load(false); setSel(null);
  }
  async function onClaim(n: NodeState) {
    if (!uid || !claimText.trim()) { alert("内容を入力してください"); return; }
    await supabase.from("skill_claims").insert({ user_id: uid, node_id: n.id, description: claimText.trim(), url: claimUrl.trim() || null });
    alert("申告しました！メンターの承認を待ってね");
    setClaimText(""); setClaimUrl(""); await load(false); setSel(null);
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>読み込み中...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#0f172a,#1e1b4b)", color: "#e2e8f0", padding: "16px 12px 80px", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 14, cursor: "pointer", padding: 0, marginBottom: 8 }}>← 戻る</button>
        <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2, margin: "0 0 2px" }}>🗺️ SKILL BOARD</h1>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>取得スキル {totalUnlocked} / {res?.nodes.length ?? 30}</div>

        {/* 能力Lv */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, marginBottom: 16 }}>
          {CATEGORIES.map((c) => {
            const lv = res?.levels[c.key] ?? 1; const active = c.key === cat;
            return (
              <button key={c.key} onClick={() => setCat(c.key)} style={{ background: active ? c.color : "rgba(255,255,255,0.06)", border: `1px solid ${active ? c.color : "rgba(255,255,255,0.1)"}`, borderRadius: 10, padding: "8px 4px", color: "#fff", cursor: "pointer" }}>
                <div style={{ fontSize: 9, letterSpacing: 1, opacity: 0.8 }}>{c.en}</div>
                <div style={{ fontSize: 16, fontWeight: 900 }}>Lv.{lv}</div>
                <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 3 }}>
                  {[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ width: 6, height: 6, borderRadius: 3, background: i <= lv ? "#fff" : "rgba(255,255,255,0.25)" }} />)}
                </div>
              </button>
            );
          })}
        </div>

        {/* 盤面 */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${catInfo.color}55`, borderRadius: 16, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: catInfo.color, marginBottom: 10, letterSpacing: 1 }}>{catInfo.en} ／ {catInfo.label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {nodes.map((n, i) => {
              const u = n.status === "unlocked", a = n.status === "available", hidden = n.is_hidden && !u && !a;
              return (
                <div key={n.id}>
                  <button onClick={() => !hidden && setSel(n)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, cursor: hidden ? "default" : "pointer",
                    background: u ? `${catInfo.color}22` : a ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.02)",
                    border: u ? `1.5px solid ${catInfo.color}` : a ? "1.5px solid rgba(255,255,255,0.25)" : "1px dashed rgba(255,255,255,0.12)", color: "#fff", opacity: u || a ? 1 : 0.55 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: u ? catInfo.color : "rgba(255,255,255,0.08)", boxShadow: u ? `0 0 14px ${catInfo.color}88` : "none", flexShrink: 0 }}>
                      {hidden ? "？" : u ? n.icon : a ? n.icon : "🔒"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>{hidden ? "？？？" : n.name}</span>
                        {n.kind === "key" && !hidden && <span style={{ fontSize: 9, fontWeight: 900, padding: "1px 6px", borderRadius: 6, background: "#fbbf24", color: "#1e1b4b" }}>KEY</span>}
                        {n.kind === "passive" && <span style={{ fontSize: 9, fontWeight: 900, padding: "1px 6px", borderRadius: 6, background: "rgba(255,255,255,0.15)" }}>PASSIVE</span>}
                        {n.pendingCheck && <span style={{ fontSize: 9, fontWeight: 900, padding: "1px 6px", borderRadius: 6, background: "#f59e0b", color: "#1e1b4b" }}>審査中</span>}
                      </div>
                      {!hidden && !u && (
                        <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.12)", marginTop: 6, overflow: "hidden" }}>
                          <div style={{ width: `${Math.round(n.progress * 100)}%`, height: "100%", background: catInfo.color }} />
                        </div>
                      )}
                      {u && <div style={{ fontSize: 11, color: catInfo.color, marginTop: 2 }}>✓ UNLOCKED</div>}
                    </div>
                  </button>
                  {i < nodes.length - 1 && <div style={{ width: 2, height: 12, marginLeft: 33, background: u ? catInfo.color : "rgba(255,255,255,0.12)" }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* JOB */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(251,191,36,0.4)", borderRadius: 16, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fbbf24", marginBottom: 10, letterSpacing: 1 }}>🏅 JOB</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {res?.jobs.map((j: JobState) => (
              <div key={j.id} style={{ borderRadius: 12, padding: "10px 8px", textAlign: "center", background: j.unlocked ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.04)", border: j.unlocked ? "1.5px solid #fbbf24" : "1px dashed rgba(255,255,255,0.15)", opacity: j.is_obtainable || j.unlocked ? 1 : 0.5 }}>
                <div style={{ fontSize: 26 }}>{j.unlocked ? j.icon : j.is_obtainable ? "🔒" : "❓"}</div>
                <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: 1 }}>{j.name}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{j.unlocked ? "取得済み" : j.is_obtainable ? `あと ${j.missing.length} スキル` : "？？？"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 詳細モーダル */}
      {sel && (
        <div onClick={() => setSel(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: "#1e293b", borderRadius: "20px 20px 0 0", padding: "18px 18px 32px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 34 }}>{sel.icon}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{sel.name}</div>
                <div style={{ fontSize: 11, color: catInfo.color }}>{catInfo.en} ・ {sel.kind.toUpperCase()}</div>
              </div>
            </div>
            {sel.status === "locked" && <div style={{ fontSize: 12, color: "#fbbf24", marginBottom: 10 }}>🔒 前のスキルを取得すると挑戦できます</div>}
            {(["learn", "practice", "prove", "check"] as const).map((st) => {
              const cs = sel.conds.filter((c) => c.stage === st); if (!cs.length) return null;
              return (
                <div key={st} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, color: "#94a3b8", marginBottom: 4 }}>{STAGE_LABEL[st]}</div>
                  {cs.map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 10, background: c.done ? `${catInfo.color}22` : "rgba(255,255,255,0.05)", marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>{c.done ? "✅" : "⬜"}</span>
                      <span style={{ flex: 1, fontSize: 13 }}>{c.label}</span>
                      {c.threshold > 1 && <span style={{ fontSize: 12, color: "#94a3b8" }}>{Math.min(c.current, c.threshold)}/{c.threshold}</span>}
                    </div>
                  ))}
                </div>
              );
            })}
            {sel.status !== "unlocked" && sel.conds.some((c) => c.type === "mentor_check" && !c.done) && (
              sel.pendingCheck
                ? <div style={{ textAlign: "center", fontSize: 13, color: "#f59e0b", marginTop: 8 }}>⏳ メンター認定 審査中</div>
                : <button disabled={!sel.conds.filter((c) => c.type !== "mentor_check").every((c) => c.done)} onClick={() => onRequestCheck(sel)}
                    style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, border: "none", fontWeight: 900, fontSize: 14, cursor: "pointer", background: catInfo.color, color: "#fff", opacity: sel.conds.filter((c) => c.type !== "mentor_check").every((c) => c.done) ? 1 : 0.4 }}>
                    🙋 メンター認定を申請する
                  </button>
            )}
            {sel.status !== "unlocked" && sel.conds.some((c) => c.type === "claim_approved" && !c.done) && !sel.pendingCheck && (
              <div style={{ marginTop: 8 }}>
                <textarea value={claimText} onChange={(e) => setClaimText(e.target.value)} placeholder="何をどう自動化／どんな仕組みを作った？" rows={3} style={{ width: "100%", borderRadius: 10, border: "1px solid #334155", background: "#0f172a", color: "#fff", padding: 10, fontSize: 13, boxSizing: "border-box" }} />
                <input value={claimUrl} onChange={(e) => setClaimUrl(e.target.value)} placeholder="URLがあれば（任意）" style={{ width: "100%", marginTop: 6, borderRadius: 10, border: "1px solid #334155", background: "#0f172a", color: "#fff", padding: 10, fontSize: 13, boxSizing: "border-box" }} />
                <button onClick={() => onClaim(sel)} style={{ width: "100%", marginTop: 6, padding: 12, borderRadius: 12, border: "none", fontWeight: 900, fontSize: 14, cursor: "pointer", background: catInfo.color, color: "#fff" }}>📨 申告してメンターに見てもらう</button>
              </div>
            )}
            {sel.pendingCheck && sel.conds.some((c) => c.type === "claim_approved") && <div style={{ textAlign: "center", fontSize: 13, color: "#f59e0b", marginTop: 8 }}>⏳ 申告を審査中</div>}
          </div>
        </div>
      )}

      {/* UNLOCK 演出 */}
      {unlockQueue.length > 0 && (
        <div onClick={() => setUnlockQueue((q) => q.slice(1))} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, cursor: "pointer" }}>
          <div style={{ textAlign: "center", animation: "pop .5s ease-out" }}>
            <div style={{ fontSize: 12, letterSpacing: 4, color: unlockQueue[0].key ? "#fbbf24" : "#a5b4fc", fontWeight: 900 }}>{unlockQueue[0].sub}</div>
            <div style={{ fontSize: unlockQueue[0].key ? 96 : 72, margin: "10px 0", filter: `drop-shadow(0 0 30px ${unlockQueue[0].key ? "#fbbf24" : "#818cf8"})` }}>{unlockQueue[0].icon}</div>
            <div style={{ fontSize: unlockQueue[0].key ? 30 : 24, fontWeight: 900, color: "#fff" }}>{unlockQueue[0].title}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 20 }}>タップして閉じる（あと{unlockQueue.length}）</div>
          </div>
          <style>{`@keyframes pop{0%{transform:scale(.5);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}`}</style>
        </div>
      )}
    </div>
  );
}
