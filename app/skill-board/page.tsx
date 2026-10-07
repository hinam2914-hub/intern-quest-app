"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { evaluateUser, syncUnlocks, requestCheck, getFocus, focusOp, nextQuestCandidates, questText, pickQuestCond, type EvalResult, type NodeState, type Focus } from "../lib/skills";
import SkillWorld, { type Walk } from "./SkillWorld";
import DetailPanel from "./DetailPanel";
import { AREAS, NODE_POS, START, AREA_COLOR, type Pt } from "./world";

type Celebration = { id?: string; title: string; sub: string; icon: string; key: boolean };

export default function SkillBoardPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const [uid, setUid] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [res, setRes] = useState<EvalResult | null>(null);
  const [focus, setFocus] = useState<Focus>({ current: null, subs: [] });
  const [locId, setLocId] = useState<string | null>(null);
  const [sel, setSel] = useState<NodeState | null>(null);
  const [focusTo, setFocusTo] = useState<{ key: number; target: Pt } | undefined>();
  const [celebrate, setCelebrate] = useState<Celebration[]>([]);
  const [walk, setWalk] = useState<Walk | null>(null);
  const pendingWalks = useRef<string[]>([]);
  const [chooser, setChooser] = useState<{ node: NodeState; reason: string }[] | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const locRef = useRef<string | null>(null);

  function lastUnlockedId(r: EvalResult) {
    return [...r.nodes].filter((n) => n.status === "unlocked" && n.unlocked_at).sort((a, b) => (b.unlocked_at! > a.unlocked_at! ? 1 : -1))[0]?.id ?? null;
  }
  async function refreshFocus(u: string, r: EvalResult) {
    let f = await getFocus(supabase, u);
    // 取得済みが残っていれば除去（サーバーで再採番）
    for (const id of [f.current, ...f.subs]) { if (id && r.nodes.find((n) => n.id === id)?.status === "unlocked") await focusOp(supabase, "remove", id); }
    f = await getFocus(supabase, u); setFocus(f); return f;
  }

  async function load(initial = false) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUid(user.id);
    const { data: prof } = await supabase.from("profiles").select("avatar_config").eq("id", user.id).single();
    setAvatarId((prof as any)?.avatar_config?.id ?? null);
    let r = await evaluateUser(supabase, user.id);
    if (initial) { const l = lastUnlockedId(r); setLocId(l); locRef.current = l; }
    const { newNodes, newJobs } = await syncUnlocks(supabase, user.id, r);
    if (newNodes.length || newJobs.length) {
      r = await evaluateUser(supabase, user.id);
      setCelebrate([
        ...newNodes.map((n) => ({ id: n.id, title: n.name, sub: "SKILL UNLOCKED", icon: n.icon ?? "✨", key: n.kind === "key" })),
        ...newJobs.map((j) => ({ title: j.name, sub: "JOB UNLOCKED", icon: j.icon ?? "🏅", key: true })),
      ]);
      pendingWalks.current = newNodes.map((n) => n.id);
    }
    setRes(r);
    const f = newNodes.length ? await getFocus(supabase, user.id) : await refreshFocus(user.id, r);
    if (newNodes.length) setFocus(f);
    if (initial && sp.get("focus") === "1" && f.current && NODE_POS[f.current]) setTimeout(() => setFocusTo({ key: Date.now(), target: NODE_POS[f.current!] }), 50);
    if (sel) setSel(r.nodes.find((n) => n.id === sel.id) ?? null);
  }
  useEffect(() => { load(true); const f = () => setIsMobile(window.innerWidth < 640); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 演出を閉じたら歩行開始
  function closeCelebration() {
    const rest = celebrate.slice(1); setCelebrate(rest);
    if (rest.length === 0 && pendingWalks.current.length) startNextWalk();
  }
  function startNextWalk() {
    const id = pendingWalks.current.shift(); if (!id) { finishWalks(); return; }
    const from = locRef.current && NODE_POS[locRef.current] ? NODE_POS[locRef.current] : START;
    setFocusTo({ key: Date.now(), target: NODE_POS[id] });
    setWalk({ key: Date.now(), from, to: NODE_POS[id] });
    locRef.current = id;
  }
  function onWalkEnd() { setLocId(locRef.current); setWalk(null); if (pendingWalks.current.length) setTimeout(startNextWalk, 300); else finishWalks(); }
  async function finishWalks() {
    if (!uid || !res) return;
    const wasCurrent = focus.current;
    const f = await refreshFocus(uid, res);
    const justId = locRef.current ?? undefined;
    if (!f.current || (wasCurrent && wasCurrent === justId)) {
      const cands = nextQuestCandidates(res, [f.current, ...f.subs].filter(Boolean) as string[], justId);
      if (cands.length) setChooser(cands);
    }
  }

  async function onChallenge(n: NodeState) {
    if (!uid) return;
    let r = await focusOp(supabase, "add", n.id);
    if (!r.ok && r.error === "full") {
      const oldest = focus.subs[focus.subs.length - 1];
      if (!confirm("挑戦中のスキルが3つあります。一番古いサブクエストと入れ替えますか？")) return;
      if (oldest) await focusOp(supabase, "remove", oldest);
      r = await focusOp(supabase, "add", n.id);
    }
    if (!r.ok) { alert("登録できませんでした：" + r.error); return; }
    const f = await getFocus(supabase, uid); setFocus(f);
    if (f.current === n.id) setFocusTo({ key: Date.now(), target: NODE_POS[n.id] });
  }
  async function onPromote(n: NodeState) { if (!uid) return; await focusOp(supabase, "promote", n.id); setFocus(await getFocus(supabase, uid)); }
  async function onRemoveFocus(n: NodeState) { if (!uid) return; await focusOp(supabase, "remove", n.id); setFocus(await getFocus(supabase, uid)); }
  async function chooseNext(n: NodeState) { if (!uid) return; await focusOp(supabase, "add", n.id); await focusOp(supabase, "promote", n.id); setFocus(await getFocus(supabase, uid)); setChooser(null); setFocusTo({ key: Date.now(), target: NODE_POS[n.id] }); }

  async function onRequestCheck(n: NodeState) { if (!uid) return; const ok = await requestCheck(supabase, uid, n.id); alert(ok ? "メンター認定を申請しました！" : "すでに申請中です"); await load(); }
  async function onClaim(n: NodeState, text: string, url: string) {
    if (!uid || !text.trim()) { alert("内容を入力してください"); return; }
    await supabase.from("skill_claims").insert({ user_id: uid, node_id: n.id, description: text.trim(), url: url.trim() || null });
    alert("申告しました！メンターの承認を待ってね"); await load();
  }
  function jumpTo(p: Pt) { setFocusTo({ key: Date.now(), target: p }); }
  function jumpToAvatar() { jumpTo(locId && NODE_POS[locId] ? NODE_POS[locId] : START); }

  if (!res) return <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#8fd3ff,#e6f6ff)", display: "flex", alignItems: "center", justifyContent: "center", color: "#1e3a5f", fontWeight: 800 }}>🌱 スキルワールドを読み込み中...</div>;
  const total = res.nodes.filter((n) => n.status === "unlocked").length;
  const focusState = sel ? (focus.current === sel.id ? "current" : focus.subs.includes(sel.id) ? "sub" : "none") : "none";
  const nextNode = sel ? res.nodes.find((n) => n.category === sel.category && n.order_no === sel.order_no + 1) ?? null : null;
  const curNode = focus.current ? res.nodes.find((n) => n.id === focus.current) : null;

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <SkillWorld res={res} avatarId={avatarId} selectedId={sel?.id ?? null} onSelect={setSel} focusTo={focusTo} focus={focus} locNodeId={locId} walk={walk} onWalkEnd={onWalkEnd} />

      <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 8, alignItems: "center", zIndex: 40, flexWrap: "wrap" }}>
        <button onClick={() => router.back()} style={{ border: "none", background: "rgba(255,255,255,.92)", borderRadius: 999, padding: "8px 14px", fontWeight: 900, fontSize: 13, color: "#1e3a5f", cursor: "pointer", boxShadow: "0 3px 10px rgba(0,0,0,.15)" }}>← 戻る</button>
        <div style={{ background: "rgba(255,255,255,.92)", borderRadius: 999, padding: "8px 16px", fontWeight: 900, fontSize: 13, color: "#1e3a5f", boxShadow: "0 3px 10px rgba(0,0,0,.15)" }}>🌱 SKILL WORLD <span style={{ color: "#8b5cf6", marginLeft: 6 }}>{total} / {res.nodes.length}</span></div>
        {curNode && !isMobile && <button onClick={() => jumpTo(NODE_POS[curNode.id])} style={{ border: "2px solid #fbbf24", background: "#fffbeb", borderRadius: 999, padding: "6px 14px", fontWeight: 900, fontSize: 12, color: "#92400e", cursor: "pointer", boxShadow: "0 3px 10px rgba(0,0,0,.12)" }}>🎯 {curNode.name}：{questText(pickQuestCond(curNode))}</button>}
      </div>

      <div style={{ position: "absolute", bottom: isMobile ? 14 : 18, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6, zIndex: 40, background: "rgba(255,255,255,.9)", borderRadius: 999, padding: 6, boxShadow: "0 6px 18px rgba(0,0,0,.18)", maxWidth: "96vw", overflowX: "auto" }}>
        <button onClick={jumpToAvatar} style={{ border: "none", background: "linear-gradient(135deg,#8b5cf6,#6366f1)", color: "#fff", borderRadius: 999, padding: "8px 12px", fontWeight: 900, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>📍 現在地</button>
        {curNode && <button onClick={() => jumpTo(NODE_POS[curNode.id])} style={{ border: "none", background: "linear-gradient(135deg,#fbbf24,#f59e0b)", color: "#fff", borderRadius: 999, padding: "8px 12px", fontWeight: 900, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>🎯 クエスト</button>}
        {AREAS.map((a) => (
          <button key={a.key} onClick={() => jumpTo({ x: a.x + a.w / 2, y: a.y + a.h / 2 })} style={{ border: `2px solid ${AREA_COLOR[a.key]}`, background: "#fff", color: AREA_COLOR[a.key], borderRadius: 999, padding: "6px 10px", fontWeight: 900, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>{a.emoji}{isMobile ? "" : " " + a.label}</button>
        ))}
      </div>

      {sel && <DetailPanel node={sel} jobs={res.jobs} isMobile={isMobile} onClose={() => setSel(null)} onRequestCheck={onRequestCheck} onClaim={onClaim} focusState={focusState} nextNode={nextNode} onChallenge={async (n) => { await onChallenge(n); setSel(null); }} onPromote={async (n) => { await onPromote(n); setSel(null); }} onRemoveFocus={async (n) => { await onRemoveFocus(n); setSel(null); }} />}

      {/* SKILL UNLOCKED 演出 */}
      {celebrate.length > 0 && (
        <div onClick={closeCelebration} style={{ position: "fixed", inset: 0, background: "rgba(255,255,255,.72)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, cursor: "pointer" }}>
          <div style={{ textAlign: "center", background: "linear-gradient(135deg,#fffbeb,#fef3c7)", borderRadius: 28, padding: "32px 44px", boxShadow: "0 20px 60px rgba(200,150,0,.35)", animation: "swPop .5s ease-out" }}>
            <div style={{ fontSize: 13, letterSpacing: 4, color: celebrate[0].key ? "#b45309" : "#7c3aed", fontWeight: 900 }}>✨ {celebrate[0].sub} ✨</div>
            <div style={{ fontSize: celebrate[0].key ? 96 : 76, margin: "8px 0", filter: "drop-shadow(0 0 24px #fbbf24)" }}>{celebrate[0].icon}</div>
            <div style={{ fontSize: celebrate[0].key ? 30 : 24, fontWeight: 900, color: "#1e293b" }}>《{celebrate[0].title}》</div>
            <div style={{ fontSize: 11, color: "#92400e", marginTop: 16 }}>タップして進む{celebrate.length > 1 ? `（あと${celebrate.length - 1}）` : ""}</div>
          </div>
          <style>{`@keyframes swPop{0%{transform:scale(.5);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}`}</style>
        </div>
      )}

      {/* 次の冒険 */}
      {chooser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(30,41,59,.35)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 90 }} onClick={() => setChooser(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "linear-gradient(180deg,#fff,#f0f9ff)", borderRadius: "24px 24px 0 0", padding: "20px 18px 28px", boxShadow: "0 -10px 40px rgba(0,0,0,.2)" }}>
            <div style={{ fontWeight: 900, fontSize: 17, color: "#1e293b", marginBottom: 4 }}>🧭 次はどこへ向かう？</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>次のCURRENT QUESTを選ぼう</div>
            {chooser.map((c) => (
              <div key={c.node.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: `2px solid ${AREA_COLOR[c.node.category]}44`, borderRadius: 14, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ fontSize: 28 }}>{c.node.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 14, color: "#1e293b" }}>{c.node.name}</div>
                  <div style={{ fontSize: 11, color: AREA_COLOR[c.node.category], fontWeight: 800 }}>{c.reason} ・ {Math.round(c.node.progress * 100)}%</div>
                </div>
                <button onClick={() => chooseNext(c.node)} style={{ border: "none", background: "linear-gradient(135deg,#fbbf24,#f59e0b)", color: "#fff", borderRadius: 10, padding: "8px 10px", fontWeight: 900, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>向かう</button>
              </div>
            ))}
            <button onClick={() => setChooser(null)} style={{ width: "100%", marginTop: 4, padding: 10, borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>あとで決める</button>
          </div>
        </div>
      )}
    </div>
  );
}
