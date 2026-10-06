"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Turn = { role: "ai" | "user"; text: string };
type Report = { good: string; insight: string; next: string; skills: string[] };
const SKILL_LABEL: Record<string, string> = { hypothesis: "💡 仮説思考", cause: "🔍 原因分析", verbal: "🗣 言語化", improve: "🔄 改善思考", self: "🚀 自走力" };

function AiInner() {
    const router = useRouter();
    const sp = useSearchParams();
    const sid = sp.get("sid");
    const [reportText, setReportText] = useState("");
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [turns, setTurns] = useState<Turn[]>([]);
    const [input, setInput] = useState("");
    const [thinking, setThinking] = useState(false);
    const [report, setReport] = useState<Report | null>(null);
    const [error, setError] = useState("");
    const [expSaved, setExpSaved] = useState(false);
    const [questMade, setQuestMade] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    const callApi = async (mode: "question" | "report", t: Turn[], rep: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/thinking", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` }, body: JSON.stringify({ mode, report: rep, turns: t }) });
        if (!res.ok) throw new Error((await res.json()).error || "error");
        return res.json();
    };

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            let content = "";
            if (sid) {
                const { data } = await supabase.from("submissions").select("content").eq("id", sid).single();
                content = (data as any)?.content || "";
            } else {
                const { data } = await supabase.from("submissions").select("content").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
                content = (data?.[0] as any)?.content || "";
            }
            if (!content) { setError("日報が見つかりません"); return; }
            setReportText(content);
            // 既存セッション（同じ日報）があれば復元
            const { data: ex } = sid ? await supabase.from("thinking_sessions").select("*").eq("user_id", user.id).eq("submission_id", sid).order("created_at", { ascending: false }).limit(1) : { data: [] as any[] };
            if (ex && ex.length > 0) {
                const s = ex[0] as any;
                setSessionId(s.id); setTurns(s.turns || []);
                if (s.report) { setReport(s.report); setExpSaved(true); return; }
                if ((s.turns || []).length > 0 && (s.turns as Turn[])[s.turns.length - 1].role === "ai") return;
            }
            const { data: ins } = ex && ex.length > 0 ? { data: ex[0] } : await supabase.from("thinking_sessions").insert({ user_id: user.id, submission_id: sid, turns: [] }).select("id").single();
            const id = (ins as any)?.id; setSessionId(id);
            try {
                setThinking(true);
                const q = await callApi("question", [], content);
                const t: Turn[] = [{ role: "ai", text: q.question }];
                setTurns(t);
                await supabase.from("thinking_sessions").update({ turns: t }).eq("id", id);
            } catch (e: any) { setError(e.message); } finally { setThinking(false); }
        })();
    }, []);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, report, thinking]);

    const send = async () => {
        if (!input.trim() || thinking || !sessionId) return;
        const t: Turn[] = [...turns, { role: "user", text: input.trim() }];
        setTurns(t); setInput(""); setThinking(true);
        try {
            const aiCount = t.filter(x => x.role === "ai").length;
            if (aiCount >= 3) {
                const rep: Report = await callApi("report", t, reportText);
                setReport(rep);
                await supabase.from("thinking_sessions").update({ turns: t, report: rep, status: "done" }).eq("id", sessionId);
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase.from("thinking_skill_logs").insert(rep.skills.map(sk => ({ user_id: user.id, skill: sk, exp: 10, source: "thinking_session", source_id: sessionId })));
                    await supabase.from("thinking_skill_logs").insert([{ user_id: user.id, skill: "verbal", exp: 5, source: "thinking_session", source_id: sessionId }]);
                }
                setExpSaved(true);
            } else {
                const q = await callApi("question", t, reportText);
                const t2: Turn[] = [...t, { role: "ai", text: q.question }];
                setTurns(t2);
                await supabase.from("thinking_sessions").update({ turns: t2 }).eq("id", sessionId);
            }
        } catch (e: any) { setError(e.message); } finally { setThinking(false); }
    };

    const makeQuest = async () => {
        if (!report || questMade) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const t = new Date(Date.now() + 9 * 3600000); t.setUTCDate(t.getUTCDate() + 1);
        const target = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
        await supabase.from("experiments").insert({ user_id: user.id, submission_id: sid, plan: report.next, target_date: target });
        setQuestMade(true);
    };

    const stage = turns.filter(x => x.role === "ai").length;
    return (
        <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% 0%, #1a1030 0%, #0b0b16 55%)", padding: "24px 16px 120px" }}>
            <style>{`@keyframes aiPop { 0% { opacity:0; transform: translateY(10px) scale(.96); } 100% { opacity:1; transform: none; } } @keyframes expUp { 0% { opacity:0; transform: translateY(8px); } 30% { opacity:1; } 100% { opacity:1; transform: translateY(0); } }`}</style>
            <div style={{ maxWidth: 560, margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <button onClick={() => router.push("/report")} style={{ border: "none", background: "transparent", color: "#c4b5fd", fontSize: 20, cursor: "pointer" }}>←</button>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>🧠 AIと作戦会議</div>
                    {!report && <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>{[1, 2, 3].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: 4, background: i <= stage ? "#a78bfa" : "rgba(255,255,255,0.15)" }} />)}</div>}
                </div>
                <div style={{ fontSize: 12.5, color: "#8b8fa8", marginBottom: 16, paddingLeft: 34 }}>答えは出さない。3問だけ、一緒に考える</div>
                {error && <div style={{ color: "#f87171", fontSize: 13, padding: 12, borderRadius: 10, background: "rgba(248,113,113,0.1)", marginBottom: 12 }}>{error}</div>}

                {turns.map((t, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: t.role === "ai" ? "flex-start" : "flex-end", marginBottom: 10, animation: "aiPop .3s ease-out" }}>
                        {t.role === "ai" && <div style={{ fontSize: 24, marginRight: 8 }}>🤖</div>}
                        <div style={{ maxWidth: "82%", padding: "12px 14px", borderRadius: 16, fontSize: 14, lineHeight: 1.6, color: "#fff", background: t.role === "ai" ? "rgba(255,255,255,0.06)" : "rgba(139,92,246,0.3)", border: t.role === "ai" ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(167,139,250,0.4)", whiteSpace: "pre-wrap" }}>
                            {t.role === "ai" && i === 0 && <div style={{ fontSize: 10, fontWeight: 900, color: "#c4b5fd", letterSpacing: 2, marginBottom: 4 }}>THINKING QUEST</div>}
                            {t.text}
                        </div>
                    </div>
                ))}
                {thinking && <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#8b8fa8", fontSize: 13, marginBottom: 10 }}><span style={{ fontSize: 24 }}>🤖</span> 考え中…</div>}

                {report && (
                    <div style={{ marginTop: 16, borderRadius: 22, padding: 20, background: "linear-gradient(160deg, rgba(139,92,246,0.25), rgba(11,11,20,0.8))", border: "1.5px solid rgba(167,139,250,0.5)", animation: "aiPop .4s ease-out" }}>
                        <div style={{ fontSize: 11, fontWeight: 900, color: "#c4b5fd", letterSpacing: 3 }}>AI 思考レポート</div>
                        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                            <div style={{ padding: 12, borderRadius: 12, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)" }}><div style={{ fontSize: 11, fontWeight: 900, color: "#34d399" }}>GOOD</div><div style={{ fontSize: 14, color: "#fff", marginTop: 3 }}>{report.good}</div></div>
                            <div style={{ padding: 12, borderRadius: 12, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)" }}><div style={{ fontSize: 11, fontWeight: 900, color: "#fbbf24" }}>INSIGHT</div><div style={{ fontSize: 14, color: "#fff", marginTop: 3 }}>{report.insight}</div></div>
                            <div style={{ padding: 12, borderRadius: 12, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)" }}><div style={{ fontSize: 11, fontWeight: 900, color: "#38bdf8" }}>NEXT</div><div style={{ fontSize: 14, color: "#fff", marginTop: 3 }}>{report.next}</div></div>
                        </div>
                        <div style={{ fontSize: 12, color: "#c4b5fd", marginTop: 14, marginBottom: 6 }}>今回使った思考スキル</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {report.skills.map((s, i) => <div key={s} style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(167,139,250,0.35)", fontSize: 12.5, fontWeight: 800, color: "#fff", animation: `expUp .5s ease-out ${i * 0.15}s both` }}>{SKILL_LABEL[s]} <span style={{ color: "#a78bfa" }}>+10 EXP</span></div>)}
                            <div style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(167,139,250,0.35)", fontSize: 12.5, fontWeight: 800, color: "#fff", animation: "expUp .5s ease-out .5s both" }}>🗣 言語化 <span style={{ color: "#a78bfa" }}>+5 EXP</span></div>
                        </div>
                        <button onClick={makeQuest} disabled={questMade} style={{ width: "100%", marginTop: 16, padding: "13px 0", borderRadius: 14, border: "none", background: questMade ? "rgba(52,211,153,0.2)" : "linear-gradient(90deg,#8b5cf6,#a78bfa)", color: questMade ? "#34d399" : "#fff", fontSize: 14.5, fontWeight: 900, cursor: questMade ? "default" : "pointer" }}>{questMade ? "🧪 明日の実験に登録しました" : "🧪 この内容を明日の実験にする"}</button>
                        <button onClick={() => router.push(`/report/fb?${sid ? `sid=${sid}&` : ""}tsid=${sessionId}`)} style={{ width: "100%", marginTop: 8, padding: "12px 0", borderRadius: 14, border: "1px solid rgba(167,139,250,0.4)", background: "rgba(139,92,246,0.12)", color: "#c4b5fd", fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}>もう少し相談したい（メンターにFBをお願いする）</button>
                        <button onClick={() => router.push("/home")} style={{ width: "100%", marginTop: 8, padding: "11px 0", borderRadius: 14, border: "none", background: "transparent", color: "#8b8fa8", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>島へ戻る</button>
                    </div>
                )}
                <div ref={endRef} />
            </div>

            {!report && !error && (
                <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "12px 16px 20px", background: "linear-gradient(180deg, rgba(11,11,20,0), rgba(11,11,20,0.95) 30%)" }}>
                    <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", gap: 8 }}>
                        <textarea value={input} onChange={e => setInput(e.target.value.slice(0, 400))} onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }} placeholder="考えを入力してください…" rows={2} style={{ flex: 1, borderRadius: 14, padding: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", fontSize: 14, resize: "none", boxSizing: "border-box" }} />
                        <button onClick={send} disabled={thinking || !input.trim()} style={{ width: 56, borderRadius: 14, border: "none", background: input.trim() && !thinking ? "linear-gradient(135deg,#8b5cf6,#a78bfa)" : "rgba(255,255,255,0.08)", color: "#fff", fontSize: 20, cursor: "pointer" }}>➤</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AiPage() { return <Suspense fallback={null}><AiInner /></Suspense>; }
