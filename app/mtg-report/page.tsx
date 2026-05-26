"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function isLateNight(endTime: string): boolean {
    const hour = parseInt(endTime.split(":")[0], 10);
    return !isNaN(hour) && hour >= 24;
}

const fieldStyle = {
    width: "100%", padding: 14, borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
    color: "#f9fafb", fontSize: 14, lineHeight: 1.8, outline: "none",
    resize: "vertical" as const, boxSizing: "border-box" as const, fontFamily: "inherit",
    minHeight: 80,
};
const labelStyle = { fontSize: 13, fontWeight: 700, color: "#a5b4fc", display: "block" as const, marginBottom: 6, marginTop: 16 };

export default function MtgReportPage() {
    const router = useRouter();
    const [userId, setUserId] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [done, setDone] = useState(false);

    const [mtgDate, setMtgDate] = useState(getTodayJST());
    const [participants, setParticipants] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [purpose, setPurpose] = useState("");
    const [discussion, setDiscussion] = useState("");
    const [decision, setDecision] = useState("");
    const [nextAction, setNextAction] = useState("");

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            setLoading(false);
        })();
    }, [router]);

    const handleSubmit = async () => {
        if (!mtgDate) { setMessage("MTG実施日を入力してください"); return; }
        if (!participants.trim()) { setMessage("参加者を入力してください"); return; }
        if (!startTime.trim() || !endTime.trim()) { setMessage("開始時刻と終了時刻を入力してください"); return; }
        const bodyLength = purpose.trim().length + discussion.trim().length + decision.trim().length + nextAction.trim().length;
        if (bodyLength < 100) { setMessage(`報告内容は合計100文字以上で書いてください（現在${bodyLength}文字）`); return; }
        const combinedContent = `【目的・議題】\n${purpose.trim()}\n\n【議論した内容】\n${discussion.trim()}\n\n【決定事項（着地点）】\n${decision.trim()}\n\n【ネクストアクション】\n${nextAction.trim()}`;
        setSubmitting(true);
        setMessage("");
        const { error } = await supabase.from("mtg_reports").insert({
            user_id: userId,
            mtg_date: mtgDate,
            participants: participants.trim(),
            start_time: startTime.trim(),
            end_time: endTime.trim(),
            content: combinedContent,
            status: "pending",
        });
        if (error) { setMessage("提出に失敗しました: " + error.message); setSubmitting(false); return; }
        setDone(true);
        setSubmitting(false);
    };

    if (loading) {
        return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f1a", color: "#9ca3af" }}>読み込み中...</div>;
    }

    if (done) {
        return (
            <div style={{ minHeight: "100vh", background: "#0f0f1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#f9fafb", padding: 20 }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>MTG報告書を提出しました</h2>
                    <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24 }}>管理者の確認をお待ちください。差し戻しがあった場合は対応をお願いします。</p>
                    <button onClick={() => router.push("/mypage")} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>マイページに戻る</button>
                </div>
            </div>
        );
    }

    const lateWarning = isLateNight(endTime);
    const bodyLen = purpose.trim().length + discussion.trim().length + decision.trim().length + nextAction.trim().length;

    return (
        <div style={{ minHeight: "100vh", background: "#0f0f1a", padding: "32px 20px", color: "#f9fafb" }}>
            <div style={{ maxWidth: 600, margin: "0 auto" }}>
                <button onClick={() => router.push("/mypage")} style={{ background: "none", border: "none", color: "#818cf8", cursor: "pointer", fontSize: 14, marginBottom: 20 }}>← マイページに戻る</button>

                <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>📋 MTG報告書（議事録）</h1>
                <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>MTGの議事録をまとめて提出します。管理者が確認し、着地していない場合はフィードバック付きで差し戻されます。</p>

                <label style={labelStyle}>MTG実施日</label>
                <input type="date" value={mtgDate} onChange={(e) => setMtgDate(e.target.value)} style={{ ...fieldStyle, minHeight: 0, padding: "10px 12px" }} />

                <label style={labelStyle}>参加者</label>
                <input value={participants} onChange={(e) => setParticipants(e.target.value)} placeholder="例：中島、柴崎、Koki" style={{ ...fieldStyle, minHeight: 0, padding: "10px 12px" }} />

                <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle}>開始時刻</label>
                        <input value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="例：21:00" style={{ ...fieldStyle, minHeight: 0, padding: "10px 12px" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={labelStyle}>終了時刻</label>
                        <input value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="例：22:30（深夜は25:00等）" style={{ ...fieldStyle, minHeight: 0, padding: "10px 12px", border: `1px solid ${lateWarning ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.1)"}` }} />
                    </div>
                </div>

                {lateWarning && (
                    <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", marginTop: 12 }}>
                        <span style={{ fontSize: 13, color: "#f87171", fontWeight: 600 }}>⚠️ 終了が24時を超えています。深夜の長時間MTGは翌日のパフォーマンスに影響します。</span>
                    </div>
                )}

                <label style={labelStyle}>① 目的・議題</label>
                <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="何のためのMTGだったか" style={fieldStyle} />

                <label style={labelStyle}>② 議論した内容</label>
                <textarea value={discussion} onChange={(e) => setDiscussion(e.target.value)} placeholder="どんな議論をしたか" style={fieldStyle} />

                <label style={labelStyle}>③ 決定事項（着地点）</label>
                <textarea value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="結局どう決まったか。ここが空欄・曖昧だと差し戻されます" style={fieldStyle} />

                <label style={labelStyle}>④ ネクストアクション</label>
                <textarea value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="誰が・何を・いつまでに" style={fieldStyle} />

                <div style={{ fontSize: 12, color: bodyLen >= 100 ? "#34d399" : "#6b7280", marginTop: 8, marginBottom: 16 }}>①〜④合計 {bodyLen} 文字（100文字以上）</div>

                {message && <div style={{ fontSize: 13, color: "#f87171", marginBottom: 12 }}>{message}</div>}

                <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: submitting ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", fontSize: 15 }}>
                    {submitting ? "提出中..." : "報告書を提出する"}
                </button>
            </div>
        </div>
    );
}
