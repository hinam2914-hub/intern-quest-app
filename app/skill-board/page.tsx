"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { evaluateUser, syncUnlocks, requestCheck, type EvalResult, type NodeState } from "../lib/skills";
import SkillWorld from "./SkillWorld";
import DetailPanel from "./DetailPanel";
import { AREAS, NODE_POS, START, AREA_COLOR, type Pt } from "./world";

export default function SkillBoardPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [res, setRes] = useState<EvalResult | null>(null);
  const [sel, setSel] = useState<NodeState | null>(null);
  const [focusTo, setFocusTo] = useState<{ key: number; target: Pt } | undefined>();
  const [unlockQueue, setUnlockQueue] = useState<{ title: string; sub: string; icon: string; key: boolean }[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  async function load(withSync = true) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUid(user.id);
    const { data: prof } = await supabase.from("profiles").select("avatar_config").eq("id", user.id).single();
    setAvatarId((prof as any)?.avatar_config?.id ?? null);
    let r = await evaluateUser(supabase, user.id);
    if (withSync) {
      const { newNodes, newJobs } = await syncUnlocks(supabase, user.id, r);
      if (newNodes.length || newJobs.length) {
        setUnlockQueue([
          ...newNodes.map((n) => ({ title: n.name, sub: "SKILL UNLOCKED", icon: n.icon ?? "✨", key: n.kind === "key" })),
          ...newJobs.map((j) => ({ title: j.name, sub: "JOB UNLOCKED", icon: j.icon ?? "🏅", key: true })),
        ]);
        r = await evaluateUser(supabase, user.id);
      }
    }
    setRes(r);
    if (sel) setSel(r.nodes.find((n) => n.id === sel.id) ?? null);
  }
  useEffect(() => { load(); const f = () => setIsMobile(window.innerWidth < 640); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onRequestCheck(n: NodeState) {
    if (!uid) return;
    const ok = await requestCheck(supabase, uid, n.id);
    alert(ok ? "メンター認定を申請しました！" : "すでに申請中です");
    await load(false);
  }
  async function onClaim(n: NodeState, text: string, url: string) {
    if (!uid || !text.trim()) { alert("内容を入力してください"); return; }
    await supabase.from("skill_claims").insert({ user_id: uid, node_id: n.id, description: text.trim(), url: url.trim() || null });
    alert("申告しました！メンターの承認を待ってね");
    await load(false);
  }
  function jumpTo(p: Pt) { setFocusTo({ key: Date.now(), target: p }); }
  function jumpToAvatar() {
    if (!res) return;
    const last = [...res.nodes].filter((n) => n.status === "unlocked" && n.unlocked_at).sort((a, b) => (b.unlocked_at! > a.unlocked_at! ? 1 : -1))[0];
    jumpTo(last ? NODE_POS[last.id] : START);
  }

  if (!res) return <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#8fd3ff,#e6f6ff)", display: "flex", alignItems: "center", justifyContent: "center", color: "#1e3a5f", fontWeight: 800 }}>🌱 スキルワールドを読み込み中...</div>;
  const total = res.nodes.filter((n) => n.status === "unlocked").length;

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <SkillWorld res={res} avatarId={avatarId} selectedId={sel?.id ?? null} onSelect={setSel} focusTo={focusTo} />

      {/* HUD 上 */}
      <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 8, alignItems: "center", zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ border: "none", background: "rgba(255,255,255,.92)", borderRadius: 999, padding: "8px 14px", fontWeight: 900, fontSize: 13, color: "#1e3a5f", cursor: "pointer", boxShadow: "0 3px 10px rgba(0,0,0,.15)" }}>← 戻る</button>
        <div style={{ background: "rgba(255,255,255,.92)", borderRadius: 999, padding: "8px 16px", fontWeight: 900, fontSize: 13, color: "#1e3a5f", boxShadow: "0 3px 10px rgba(0,0,0,.15)" }}>🌱 SKILL WORLD <span style={{ color: "#8b5cf6", marginLeft: 6 }}>{total} / {res.nodes.length}</span></div>
      </div>

      {/* HUD 下：エリアジャンプ・現在地 */}
      <div style={{ position: "absolute", bottom: isMobile ? 14 : 18, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6, zIndex: 40, background: "rgba(255,255,255,.9)", borderRadius: 999, padding: 6, boxShadow: "0 6px 18px rgba(0,0,0,.18)", maxWidth: "96vw", overflowX: "auto" }}>
        <button onClick={jumpToAvatar} style={{ border: "none", background: "linear-gradient(135deg,#8b5cf6,#6366f1)", color: "#fff", borderRadius: 999, padding: "8px 12px", fontWeight: 900, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>📍 現在地</button>
        {AREAS.map((a) => (
          <button key={a.key} onClick={() => jumpTo({ x: a.x + a.w / 2, y: a.y + a.h / 2 })} style={{ border: `2px solid ${AREA_COLOR[a.key]}`, background: "#fff", color: AREA_COLOR[a.key], borderRadius: 999, padding: "6px 10px", fontWeight: 900, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>{a.emoji}{isMobile ? "" : " " + a.label}</button>
        ))}
      </div>

      {sel && <DetailPanel node={sel} jobs={res.jobs} isMobile={isMobile} onClose={() => setSel(null)} onRequestCheck={onRequestCheck} onClaim={onClaim} />}

      {/* UNLOCK 演出（明るい版） */}
      {unlockQueue.length > 0 && (
        <div onClick={() => setUnlockQueue((q) => q.slice(1))} style={{ position: "fixed", inset: 0, background: "rgba(255,255,255,.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, cursor: "pointer" }}>
          <div style={{ textAlign: "center", background: "linear-gradient(135deg,#fffbeb,#fef3c7)", borderRadius: 28, padding: "32px 40px", boxShadow: "0 20px 60px rgba(200,150,0,.35)", animation: "swPop .5s ease-out" }}>
            <div style={{ fontSize: 12, letterSpacing: 4, color: unlockQueue[0].key ? "#b45309" : "#7c3aed", fontWeight: 900 }}>{unlockQueue[0].sub}</div>
            <div style={{ fontSize: unlockQueue[0].key ? 96 : 76, margin: "8px 0", filter: "drop-shadow(0 0 24px #fbbf24)" }}>{unlockQueue[0].icon}</div>
            <div style={{ fontSize: unlockQueue[0].key ? 30 : 24, fontWeight: 900, color: "#1e293b" }}>{unlockQueue[0].title}</div>
            <div style={{ fontSize: 11, color: "#92400e", marginTop: 16 }}>タップして閉じる（あと{unlockQueue.length}）</div>
          </div>
          <style>{`@keyframes swPop{0%{transform:scale(.5);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}`}</style>
        </div>
      )}
    </div>
  );
}
