"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

const TARGETS = [
    { key: "mentor", icon: "✅", title: "担当メンター", desc: "いつも見てくれているメンター" },
    { key: "leader", icon: "👤", title: "チームリーダー", desc: "チーム全体の視点で見てほしい" },
    { key: "any", icon: "🎲", title: "おまかせ", desc: "適切なメンターにお願いする" },
] as const;

function FbInner() {
    const router = useRouter();
    const sp = useSearchParams();
    const sid = sp.get("sid");
    const tsid = sp.get("tsid");
    const [target, setTarget] = useState<"mentor" | "leader" | "any">("mentor");
    const [focus, setFocus] = useState("");
    const [sending, setSending] = useState(false);
    const [done, setDone] = useState(false);

    const send = async () => {
        if (sending) return;
        setSending(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }
        const { data: prof } = await supabase.from("profiles").select("mentor_id, leader_id").eq("id", user.id).single();
        const assignee = target === "mentor" ? (prof as any)?.mentor_id : target === "leader" ? (prof as any)?.leader_id : null;
        await supabase.from("fb_requests").insert({ user_id: user.id, submission_id: sid, thinking_session_id: tsid, target, focus: focus.trim() || null, assignee_id: assignee || null });
        setDone(true);
        setSending(false);
        setTimeout(() => router.push("/home"), 1600);
    };

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
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", marginTop: 10 }}>メンターに届けました</div>
                        <div style={{ fontSize: 13, color: "#c4b5fd", marginTop: 6 }}>返事が来たら島でお知らせします</div>
                    </div>
                ) : (
                    <>
                        <div style={{ fontSize: 13, color: "#c4b5fd", marginBottom: 10 }}>誰にお願いしますか？</div>
                        <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
                            {TARGETS.map(t => (
                                <button key={t.key} onClick={() => setTarget(t.key)} style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 16, cursor: "pointer", border: target === t.key ? "1.5px solid #a78bfa" : "1px solid rgba(255,255,255,0.1)", background: target === t.key ? "rgba(139,92,246,0.22)" : "rgba(255,255,255,0.04)" }}>
                                    <span style={{ fontSize: 22 }}>{t.icon}</span>
                                    <div><div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{t.title}</div><div style={{ fontSize: 12, color: "#9ca3af" }}>{t.desc}</div></div>
                                </button>
                            ))}
                        </div>
                        <div style={{ fontSize: 13, color: "#c4b5fd", marginBottom: 8 }}>特に見てほしいこと（任意）</div>
                        <textarea value={focus} onChange={e => setFocus(e.target.value.slice(0, 200))} placeholder="例：アポが取れなかった原因について、自分の考え方が合っているか見てほしいです。" style={{ width: "100%", minHeight: 110, borderRadius: 14, padding: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
                        <div style={{ textAlign: "right", fontSize: 11, color: "#6b7280", marginTop: 4 }}>{focus.length}/200</div>
                        <button onClick={send} disabled={sending} style={{ width: "100%", marginTop: 16, padding: "14px 0", borderRadius: 14, border: "none", background: "linear-gradient(90deg,#8b5cf6,#a78bfa)", color: "#fff", fontSize: 15, fontWeight: 900, cursor: "pointer", boxShadow: "0 8px 24px rgba(139,92,246,0.45)" }}>{sending ? "送信中..." : "FBをお願いする"}</button>
                    </>
                )}
            </div>
        </div>
    );
}

export default function FbRequestPage() {
    return <Suspense fallback={null}><FbInner /></Suspense>;
}
