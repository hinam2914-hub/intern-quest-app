"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Sub = {
    id: string;
    user_id: string;
    step_no: number;
    status: string;
    scheduled_date: string | null;
    mtg_date: string | null;
    event_date: string | null;
    mtg_attended: boolean | null;
    event_no_cancel: boolean | null;
    review: string | null;
    created_at: string;
    name?: string;
};

const STEP_LABEL: Record<number, string> = { 1: "STEP1 入社・スラック研修", 2: "STEP2 登竜門キックオフ研修", 3: "STEP3 プレイヤー昇格", 4: "STEP4 DRMスタート", 5: "STEP5 キャリア面談・配属" };
const STEP_PT: Record<number, number> = { 1: 10, 2: 10, 3: 20, 4: 20, 5: 20 };

export default function JourneyTab() {
    const [subs, setSubs] = useState<Sub[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        const { data: subRows } = await supabase
            .from("journey_submissions")
            .select("id, user_id, step_no, status, scheduled_date, review, created_at, mtg_date, event_date, mtg_attended, event_no_cancel")
            .in("step_no", [1, 2, 3, 4, 5])
            .order("created_at", { ascending: false });
        const { data: userRows } = await supabase.from("profiles").select("id, name").eq("is_active", true);
        const nameMap: Record<string, string> = {};
        (userRows || []).forEach((u: any) => { nameMap[u.id] = u.name; });
        const merged = (subRows || []).map((s: any) => ({ ...s, name: nameMap[s.user_id] || "(不明)" }));
        setSubs(merged as Sub[]);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const approve = async (s: Sub) => {
        if (!confirm(s.name + " さんの「" + STEP_LABEL[s.step_no] + "」を承認しますか？（+" + STEP_PT[s.step_no] + "pt）")) return;
        const { error } = await supabase.from("journey_submissions").update({ status: "approved" }).eq("id", s.id);
        if (error) { alert("承認に失敗: " + error.message); return; }
        if (s.status !== "approved") {
            const { error: phErr } = await supabase.from("points_history").insert({
                user_id: s.user_id,
                change: STEP_PT[s.step_no],
                reason: STEP_LABEL[s.step_no] + " 完了",
            });
            if (phErr) alert("ポイント付与に失敗: " + phErr.message);
        }
        await load();
    };

    const revoke = async (s: Sub) => {
        if (!confirm(s.name + " さんの「" + STEP_LABEL[s.step_no] + "」の承認を取り消しますか？")) return;
        const { error } = await supabase.from("journey_submissions").update({ status: "pending" }).eq("id", s.id);
        if (error) { alert("取り消しに失敗: " + error.message); return; }
        await load();
    };

    if (loading) return <div style={{ padding: 40, color: "#8b8fa8" }}>集計中...</div>;

    const pending = subs.filter(s => s.status === "pending");
    const approved = subs.filter(s => s.status === "approved");

    const row = (s: Sub) => (
        <div key={s.id} style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid rgba(139,92,246,.15)", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#f9fafb" }}>{s.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", background: "rgba(167,139,250,.12)", padding: "3px 10px", borderRadius: 999 }}>{STEP_LABEL[s.step_no]}</span>
                {s.scheduled_date && <span style={{ fontSize: 12, color: "#8b8fa8" }}>📅 {s.scheduled_date}</span>}
                {s.step_no === 3 && s.mtg_date && <span style={{ fontSize: 12, color: "#8b8fa8" }}>🗣 MTG {s.mtg_date}</span>}
                {s.step_no === 3 && s.event_date && <span style={{ fontSize: 12, color: "#8b8fa8" }}>🎪 イベント {s.event_date}</span>}
                {s.status === "pending"
                    ? <span style={{ fontSize: 11, fontWeight: 800, color: "#fbbf24", background: "rgba(251,191,36,.12)", padding: "3px 10px", borderRadius: 999 }}>⏳ 承認待ち</span>
                    : <span style={{ fontSize: 11, fontWeight: 800, color: "#34d399", background: "rgba(52,211,153,.12)", padding: "3px 10px", borderRadius: 999 }}>✅ 承認済み</span>}
            </div>
            {s.review && <div style={{ fontSize: 13, color: "#c2b8ee", lineHeight: 1.6, whiteSpace: "pre-wrap", padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,.2)", marginBottom: 10 }}>{s.review}</div>}
            <div style={{ display: "flex", gap: 8 }}>
                {s.status === "pending"
                    ? <button onClick={() => approve(s)} style={{ padding: "9px 20px", borderRadius: 999, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #34d399, #10b981)", color: "#fff", fontSize: 13, fontWeight: 800 }}>承認する（+{STEP_PT[s.step_no]}pt）</button>
                    : <button onClick={() => revoke(s)} style={{ padding: "9px 20px", borderRadius: 999, border: "1px solid rgba(248,113,113,.4)", cursor: "pointer", background: "transparent", color: "#f87171", fontSize: 13, fontWeight: 800 }}>承認を取り消す</button>}
            </div>
        </div>
    );

    return (
        <div style={{ padding: "8px 0" }}>
            <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: "#f9fafb", margin: "0 0 4px" }}>🗺️ 冒険マップ 進捗（STEP1・STEP2）</h2>
                <p style={{ fontSize: 13, color: "#8b8fa8", margin: 0 }}>承認待ち {pending.length}件｜ 新人の参加報告を確認して承認してください</p>
            </div>
            {pending.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#fbbf24", marginBottom: 10 }}>⏳ 承認待ち</div>
                    {pending.map(row)}
                </div>
            )}
            <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#34d399", marginBottom: 10 }}>✅ 承認済み（{approved.length}）</div>
                {approved.length === 0 ? <div style={{ fontSize: 13, color: "#6b7280" }}>まだありません</div> : approved.map(row)}
            </div>
        </div>
    );
}
