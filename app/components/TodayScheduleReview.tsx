"use client";
import { useEffect, useImperativeHandle, useState, forwardRef } from "react";
import { supabase } from "../lib/supabase";

type Quest = { id: string; label: string; done: boolean };
type Slots = { morning: Quest[]; afternoon: Quest[]; night: Quest[] };
type Period = "morning" | "afternoon" | "night";

const PERIODS: { key: Period; icon: string; title: string; sub: string }[] = [
    { key: "morning", icon: "🌅", title: "MORNING", sub: "朝の時間" },
    { key: "afternoon", icon: "☁️", title: "AFTERNOON", sub: "昼の時間" },
    { key: "night", icon: "🌙", title: "NIGHT", sub: "夜の時間" },
];

function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().slice(0, 10);
}
function normalizeSlots(raw: any): Slots {
    if (raw && !Array.isArray(raw) && (raw.morning || raw.afternoon || raw.night)) {
        return { morning: raw.morning || [], afternoon: raw.afternoon || [], night: raw.night || [] };
    }
    return { morning: [], afternoon: [], night: [] };
}

export type TodayScheduleReviewHandle = {
    saveReview: (userId: string) => Promise<{ isAllMaru: boolean; hasSchedule: boolean }>;
};

const TodayScheduleReview = forwardRef<TodayScheduleReviewHandle, { onProgressChange?: (done: number, total: number) => void }>((props, ref) => {
    const [slots, setSlots] = useState<Slots>({ morning: [], afternoon: [], night: [] });
    const [loading, setLoading] = useState(true);
    const [hasSchedule, setHasSchedule] = useState(false);
    const today = getTodayJST();

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setLoading(false); return; }
            const { data } = await supabase.from("daily_schedules").select("slots").eq("user_id", user.id).eq("date", today).maybeSingle();
            const s = normalizeSlots((data as any)?.slots);
            setSlots(s);
            const total = s.morning.length + s.afternoon.length + s.night.length;
            setHasSchedule(total > 0);
            setLoading(false);
        };
        load();
    }, [today]);

    useEffect(() => {
        const done = [...slots.morning, ...slots.afternoon, ...slots.night].filter(q => q.done).length;
        const total = slots.morning.length + slots.afternoon.length + slots.night.length;
        props.onProgressChange?.(done, total);
    }, [slots, props]);

    const toggle = (p: Period, id: string) => {
        setSlots(prev => ({ ...prev, [p]: prev[p].map(q => q.id === id ? { ...q, done: !q.done } : q) }));
    };

    useImperativeHandle(ref, () => ({
        saveReview: async (userId: string) => {
            const total = slots.morning.length + slots.afternoon.length + slots.night.length;
            if (total === 0) return { isAllMaru: false, hasSchedule: false };
            // 保存
            await supabase.from("daily_schedules").update({ slots, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("date", today);
            // 全Quest done なら全丸
            const allDone = [...slots.morning, ...slots.afternoon, ...slots.night].every(q => q.done);
            return { isAllMaru: allDone, hasSchedule: true };
        },
    }));

    if (loading) return null;
    if (!hasSchedule) return (
        <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: 13, background: "rgba(255,255,255,0.03)", borderRadius: 12 }}>
            今日のQuestが未設定です。次回は予定を立ててから振り返ろう！
        </div>
    );

    const doneCount = [...slots.morning, ...slots.afternoon, ...slots.night].filter(q => q.done).length;
    const totalCount = slots.morning.length + slots.afternoon.length + slots.night.length;

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 700 }}>タップして達成したQuestにチェック</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#34d399" }}>{doneCount} / {totalCount} 達成</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                {PERIODS.map((P) => (
                    slots[P.key].length > 0 && (
                        <div key={P.key} style={{ borderRadius: 14, padding: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.2)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                <span style={{ fontSize: 18 }}>{P.icon}</span>
                                <div style={{ fontSize: 12, fontWeight: 800, color: "#c4b5fd" }}>{P.title}</div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {slots[P.key].map((q) => (
                                    <div key={q.id} onClick={() => toggle(P.key, q.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 10, cursor: "pointer", background: q.done ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${q.done ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.07)"}` }}>
                                        <div style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: q.done ? "linear-gradient(135deg,#34d399,#10b981)" : "transparent", border: q.done ? "none" : "2px solid rgba(255,255,255,0.25)", color: "#fff", fontSize: 12, fontWeight: 900 }}>{q.done ? "✓" : ""}</div>
                                        <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: q.done ? "#6ee7b7" : "#d1d5db", textDecoration: q.done ? "line-through" : "none" }}>{q.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                ))}
            </div>
        </div>
    );
});

TodayScheduleReview.displayName = "TodayScheduleReview";
export default TodayScheduleReview;
