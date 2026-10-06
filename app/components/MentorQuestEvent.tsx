"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Quest = { id: string; fb_next: string; fb_good: string | null; fb_think: string | null; responded_at: string | null };

export default function MentorQuestEvent() {
    const [quest, setQuest] = useState<Quest | null>(null);
    const [phase, setPhase] = useState<"envelope" | "card" | "done">("envelope");
    const [claiming, setClaiming] = useState(false);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from("fb_requests").select("id, fb_next, fb_good, fb_think, responded_at")
                .eq("user_id", user.id).eq("status", "done").eq("issue_quest", true).is("quest_claimed_at", null)
                .order("responded_at", { ascending: true }).limit(1);
            if (data && data.length > 0) setQuest(data[0] as Quest);
        })();
    }, []);

    const start = async () => {
        if (!quest || claiming) return;
        setClaiming(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from("fb_requests").update({ quest_claimed_at: new Date().toISOString() }).eq("id", quest.id);
        const { data: pt } = await supabase.from("user_points").select("points").eq("id", user.id).single();
        await supabase.from("user_points").update({ points: ((pt as any)?.points || 0) + 20 }).eq("id", user.id);
        await supabase.from("points_history").insert([{ user_id: user.id, change: 20, reason: "mentor_quest" }]);
        await supabase.from("thinking_skill_logs").insert([{ user_id: user.id, skill: "hypothesis", exp: 10, source: "mentor_quest", source_id: quest.id }]);
        setPhase("done");
        setTimeout(() => setQuest(null), 1800);
    };

    if (!quest) return null;
    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(5,5,16,0.82)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <style>{`
              @keyframes mqDrop { 0% { opacity:0; transform: translateY(-60px) scale(0.6); } 60% { opacity:1; transform: translateY(8px) scale(1.08); } 100% { transform: translateY(0) scale(1); } }
              @keyframes mqGlow { 0%,100% { box-shadow: 0 0 24px rgba(139,92,246,0.35); } 50% { box-shadow: 0 0 56px rgba(167,139,250,0.75); } }
              @keyframes mqShake { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
              @keyframes mqFade { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }
            `}</style>
            {phase === "envelope" && (
                <div onClick={() => setPhase("card")} style={{ textAlign: "center", cursor: "pointer", animation: "mqDrop .7s ease-out" }}>
                    <div style={{ fontSize: 96, animation: "mqShake 1.2s ease-in-out infinite", filter: "drop-shadow(0 0 30px rgba(167,139,250,0.8))" }}>💌</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginTop: 10 }}>メンターから新しいクエストが届きました！</div>
                    <div style={{ fontSize: 13, color: "#c4b5fd", marginTop: 6 }}>タップして開く</div>
                </div>
            )}
            {phase === "card" && (
                <div style={{ width: "min(92vw, 420px)", borderRadius: 24, padding: 22, background: "linear-gradient(160deg, rgba(139,92,246,0.28), rgba(11,11,20,0.95))", border: "1.5px solid rgba(167,139,250,0.55)", animation: "mqFade .4s ease-out, mqGlow 2.4s ease-in-out infinite" }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "#c4b5fd", letterSpacing: 3 }}>NEW QUEST</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", margin: "6px 0 14px" }}>⚔️ メンタークエスト</div>
                    {quest.fb_good && <div style={{ fontSize: 12.5, color: "#34d399", marginBottom: 8 }}>👍 {quest.fb_good}</div>}
                    {quest.fb_think && <div style={{ fontSize: 12.5, color: "#fbbf24", marginBottom: 8 }}>🧠 {quest.fb_think}</div>}
                    <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(167,139,250,0.35)", borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.6 }}>{quest.fb_next}</div>
                    <div style={{ display: "flex", gap: 10, marginTop: 14, fontSize: 13, fontWeight: 800 }}>
                        <span style={{ color: "#a78bfa" }}>💎 +20pt</span>
                        <span style={{ color: "#f59e0b" }}>🧠 仮説思考EXP +10</span>
                    </div>
                    <button onClick={start} disabled={claiming} style={{ width: "100%", marginTop: 16, padding: "13px 0", borderRadius: 14, border: "none", background: "linear-gradient(90deg,#8b5cf6,#a78bfa)", color: "#fff", fontSize: 15, fontWeight: 900, cursor: "pointer", boxShadow: "0 8px 24px rgba(139,92,246,0.45)" }}>{claiming ? "..." : "クエストを開始する"}</button>
                </div>
            )}
            {phase === "done" && (
                <div style={{ textAlign: "center", animation: "mqDrop .5s ease-out" }}>
                    <div style={{ fontSize: 64 }}>⚔️</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>クエスト開始！</div>
                    <div style={{ fontSize: 14, color: "#a78bfa", marginTop: 6 }}>💎 +20pt　🧠 仮説思考EXP +10</div>
                </div>
            )}
        </div>
    );
}
