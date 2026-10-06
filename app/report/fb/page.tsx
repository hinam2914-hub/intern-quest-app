"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

function FbInner() {
    const router = useRouter();
    const sp = useSearchParams();
    const sid = sp.get("sid");
    const tsid = sp.get("tsid");
    const [pick, setPick] = useState<string>("any");
    const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [q, setQ] = useState("");
    const [focus, setFocus] = useState("");
    const [sending, setSending] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            const { data } = await supabase.from("profiles").select("id, name").eq("is_active", true).eq("fb_mentor", true).order("name");
            setPeople(((data || []) as any[]).filter(p => p.id !== user?.id));
            setLoaded(true);
        })();
    }, []);

    const send = async () => {
        if (sending) return;
        setSending(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }
        await supabase.from("fb_requests").insert({ user_id: user.id, submission_id: sid, thinking_session_id: tsid, target: pick === "any" ? "any" : "mentor", focus: focus.trim() || null, assignee_id: pick === "any" ? null : pick });
        setDone(true);
        setSending(false);
        setTimeout(() => router.push("/home"), 1600);
    };

    const pickedName = people.find(p => p.id === pick)?.name;
    const card = (active: boolean): React.CSSProperties => ({ textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 14, cursor: "pointer", border: active ? "1.5px solid #a78bfa" : "1px solid rgba(255,255,255,0.1)", background: active ? "rgba(139,92,246,0.22)" : "rgba(255,255,255,0.04)", width: "100%" });

    return (
        <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% 0%, #1a1030 0%, #0b0b16 55%)", padding: "24px 16px 60px" }}>
            <div style={{ maxWidth: 560, margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                    <button onClick={() => router.back()} style={{ border: "none", background: "transparent", color: "#c4b5fd", fontSize: 20, cursor: "pointer" }}>←</button>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>💌 FBリクエスト</div>
                </div>
                {done ? (
                    <div style={{ textAlign: "center", padding: "60px 0" }}>
                        <div style={{ fontSize: 64 }}>🕊️</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", marginTop: 10 }}>{pickedName ? `${pickedName}さんに届けました` : "メンターに届けました"}</div>
                        <div style={{ fontSize: 13, color: "#c4b5fd", marginTop: 6 }}>返事が来たら島でお知らせします</div>
                    </div>
                ) : (
                    <>
                        <div style={{ fontSize: 13, color: "#c4b5fd", marginBottom: 10 }}>誰にお願いしますか？</div>
                        <button onClick={() => setPick("any")} style={{ ...card(pick === "any"), marginBottom: 10 }}>
                            <span style={{ fontSize: 22 }}>🎲</span>
                            <div><div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>おまかせ</div><div style={{ fontSize: 12, color: "#9ca3af" }}>手の空いているメンターにお願いする</div></div>
                        </button>
                        <input value={q} onChange={e => setQ(e.target.value)} placeholder="名前で探す" style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 14, boxSizing: "border-box", marginBottom: 8 }} />
                        <div style={{ maxHeight: 280, overflowY: "auto", display: "grid", gap: 6, marginBottom: 20 }}>
                            {people.filter(p => !q || (p.name || "").includes(q)).map(p => (
                                <button key={p.id} onClick={() => setPick(p.id)} style={card(pick === p.id)}>
                                    <span style={{ fontSize: 18 }}>{pick === p.id ? "✅" : "👤"}</span>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{p.name}</span>
                                </button>
                            ))}
                            {loaded && people.length === 0 && <div style={{ fontSize: 12, color: "#6b7280", padding: 8 }}>指名できるメンターがまだいません。「おまかせ」で送ってください</div>}
                        </div>
                        <div style={{ fontSize: 13, color: "#c4b5fd", marginBottom: 8 }}>特に見てほしいこと（任意）</div>
                        <textarea value={focus} onChange={e => setFocus(e.target.value.slice(0, 200))} placeholder="例：アポが取れなかった原因について、自分の考え方が合っているか見てほしいです。" style={{ width: "100%", minHeight: 110, borderRadius: 14, padding: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
                        <div style={{ textAlign: "right", fontSize: 11, color: "#6b7280", marginTop: 4 }}>{focus.length}/200</div>
                        <button onClick={send} disabled={sending} style={{ width: "100%", marginTop: 16, padding: "14px 0", borderRadius: 14, border: "none", background: "linear-gradient(90deg,#8b5cf6,#a78bfa)", color: "#fff", fontSize: 15, fontWeight: 900, cursor: "pointer", boxShadow: "0 8px 24px rgba(139,92,246,0.45)" }}>{sending ? "送信中..." : pickedName ? `${pickedName}さんにFBをお願いする` : "FBをお願いする"}</button>
                    </>
                )}
            </div>
        </div>
    );
}

export default function FbRequestPage() {
    return <Suspense fallback={null}><FbInner /></Suspense>;
}
