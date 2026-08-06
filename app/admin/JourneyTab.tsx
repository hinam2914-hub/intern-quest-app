"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Sub = {
    id: string;
    user_id: string;
    step_no: number;
    status: string;
    scheduled_date: string | null;
    review: string | null;
    created_at: string;
    name?: string;
};

const STEP_LABEL: Record<number, string> = { 1: "STEP1 \u5165\u793E\u30FB\u30B9\u30E9\u30C3\u30AF\u7814\u4FEE", 2: "STEP2 \u767B\u7ADC\u9580\u30AD\u30C3\u30AF\u30AA\u30D5\u7814\u4FEE" };
const STEP_PT: Record<number, number> = { 1: 10, 2: 10 };

export default function JourneyTab() {
    const [subs, setSubs] = useState<Sub[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        const { data: subRows } = await supabase
            .from("journey_submissions")
            .select("id, user_id, step_no, status, scheduled_date, review, created_at")
            .in("step_no", [1, 2])
            .order("created_at", { ascending: false });
        const { data: userRows } = await supabase.from("profiles").select("id, name").eq("is_active", true);
        const nameMap: Record<string, string> = {};
        (userRows || []).forEach((u: any) => { nameMap[u.id] = u.name; });
        const merged = (subRows || []).map((s: any) => ({ ...s, name: nameMap[s.user_id] || "(\u4E0D\u660E)" }));
        setSubs(merged as Sub[]);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const approve = async (s: Sub) => {
        if (!confirm(s.name + " \u3055\u3093\u306E\u300C" + STEP_LABEL[s.step_no] + "\u300D\u3092\u627F\u8A8D\u3057\u307E\u3059\u304B\uFF1F\uFF08+" + STEP_PT[s.step_no] + "pt\uFF09")) return;
        const { error } = await supabase.from("journey_submissions").update({ status: "approved" }).eq("id", s.id);
        if (error) { alert("\u627F\u8A8D\u306B\u5931\u6557: " + error.message); return; }
        if (s.status !== "approved") {
            const { error: phErr } = await supabase.from("points_history").insert({
                user_id: s.user_id,
                change: STEP_PT[s.step_no],
                reason: STEP_LABEL[s.step_no] + " \u5B8C\u4E86",
            });
            if (phErr) alert("\u30DD\u30A4\u30F3\u30C8\u4ED8\u4E0E\u306B\u5931\u6557: " + phErr.message);
        }
        await load();
    };

    const revoke = async (s: Sub) => {
        if (!confirm(s.name + " \u3055\u3093\u306E\u300C" + STEP_LABEL[s.step_no] + "\u300D\u306E\u627F\u8A8D\u3092\u53D6\u308A\u6D88\u3057\u307E\u3059\u304B\uFF1F")) return;
        const { error } = await supabase.from("journey_submissions").update({ status: "pending" }).eq("id", s.id);
        if (error) { alert("\u53D6\u308A\u6D88\u3057\u306B\u5931\u6557: " + error.message); return; }
        await load();
    };

    if (loading) return <div style={{ padding: 40, color: "#8b8fa8" }}>\u96C6\u8A08\u4E2D...</div>;

    const pending = subs.filter(s => s.status === "pending");
    const approved = subs.filter(s => s.status === "approved");

    const row = (s: Sub) => (
        <div key={s.id} style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid rgba(139,92,246,.15)", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#f9fafb" }}>{s.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", background: "rgba(167,139,250,.12)", padding: "3px 10px", borderRadius: 999 }}>{STEP_LABEL[s.step_no]}</span>
                {s.scheduled_date && <span style={{ fontSize: 12, color: "#8b8fa8" }}>\U0001F4C5 {s.scheduled_date}</span>}
                {s.status === "pending"
                    ? <span style={{ fontSize: 11, fontWeight: 800, color: "#fbbf24", background: "rgba(251,191,36,.12)", padding: "3px 10px", borderRadius: 999 }}>\u23F3 \u627F\u8A8D\u5F85\u3061</span>
                    : <span style={{ fontSize: 11, fontWeight: 800, color: "#34d399", background: "rgba(52,211,153,.12)", padding: "3px 10px", borderRadius: 999 }}>\u2705 \u627F\u8A8D\u6E08\u307F</span>}
            </div>
            {s.review && <div style={{ fontSize: 13, color: "#c2b8ee", lineHeight: 1.6, whiteSpace: "pre-wrap", padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,.2)", marginBottom: 10 }}>{s.review}</div>}
            <div style={{ display: "flex", gap: 8 }}>
                {s.status === "pending"
                    ? <button onClick={() => approve(s)} style={{ padding: "9px 20px", borderRadius: 999, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #34d399, #10b981)", color: "#fff", fontSize: 13, fontWeight: 800 }}>\u627F\u8A8D\u3059\u308B\uFF08+{STEP_PT[s.step_no]}pt\uFF09</button>
                    : <button onClick={() => revoke(s)} style={{ padding: "9px 20px", borderRadius: 999, border: "1px solid rgba(248,113,113,.4)", cursor: "pointer", background: "transparent", color: "#f87171", fontSize: 13, fontWeight: 800 }}>\u627F\u8A8D\u3092\u53D6\u308A\u6D88\u3059</button>}
            </div>
        </div>
    );

    return (
        <div style={{ padding: "8px 0" }}>
            <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: "#f9fafb", margin: "0 0 4px" }}>\U0001F5FA\uFE0F \u5192\u967A\u30DE\u30C3\u30D7 \u9032\u6357\uFF08STEP1\u30FBSTEP2\uFF09</h2>
                <p style={{ fontSize: 13, color: "#8b8fa8", margin: 0 }}>\u627F\u8A8D\u5F85\u3061 {pending.length}\u4EF6\uFF5C \u65B0\u4EBA\u306E\u53C2\u52A0\u5831\u544A\u3092\u78BA\u8A8D\u3057\u3066\u627F\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044</p>
            </div>
            {pending.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#fbbf24", marginBottom: 10 }}>\u23F3 \u627F\u8A8D\u5F85\u3061</div>
                    {pending.map(row)}
                </div>
            )}
            <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#34d399", marginBottom: 10 }}>\u2705 \u627F\u8A8D\u6E08\u307F\uFF08{approved.length}\uFF09</div>
                {approved.length === 0 ? <div style={{ fontSize: 13, color: "#6b7280" }}>\u307E\u3060\u3042\u308A\u307E\u305B\u3093</div> : approved.map(row)}
            </div>
        </div>
    );
}
