"use client";
import { useEffect, useImperativeHandle, useState, forwardRef } from "react";
import { supabase } from "../lib/supabase";

type Quest = { id: string; label: string; done: boolean };
type Slots = { morning: Quest[]; afternoon: Quest[]; night: Quest[] };
type Period = "morning" | "afternoon" | "night";

const PERIODS: { key: Period; icon: string; title: string; sub: string }[] = [
    { key: "morning", icon: "🌅", title: "MORNING QUEST", sub: "朝の時間" },
    { key: "afternoon", icon: "☁️", title: "AFTERNOON QUEST", sub: "昼の時間" },
    { key: "night", icon: "🌙", title: "NIGHT QUEST", sub: "夜の時間" },
];
const PT_PER_QUEST = 5;

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
            setHasSchedule(s.morning.length + s.afternoon.length + s.night.length > 0);
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
            await supabase.from("daily_schedules").update({ slots, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("date", today);
            const allDone = [...slots.morning, ...slots.afternoon, ...slots.night].every(q => q.done);
            return { isAllMaru: allDone, hasSchedule: true };
        },
    }));

    if (loading) return null;
    if (!hasSchedule) return (
        <div style={{ padding: "18px", textAlign: "center", color: "#9ca3af", fontSize: 12.5, background: "rgba(255,255,255,0.03)", borderRadius: 12 }}>
            今日のQuestが未設定です。次回は予定を立ててから振り返ろう！
        </div>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {PERIODS.map((P) => {
                const quests = slots[P.key];
                if (quests.length === 0) return null;
                const done = quests.filter(q => q.done);
                const rate = Math.round((done.length / quests.length) * 100);
                const pt = done.length * PT_PER_QUEST;
                const barColor = rate === 100 ? "#34d399" : rate >= 50 ? "#a78bfa" : "#818cf8";
                return (
                    <div key={P.key} style={{ borderRadius: 16, padding: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.2)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 18 }}>{P.icon}</span>
                                <div>
                                    <div style={{ fontSize: 12.5, fontWeight: 800, color: "#c4b5fd" }}>{P.title}</div>
                                    <div style={{ fontSize: 10, color: "#8b8ba7" }}>{P.sub}</div>
                                </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 18, fontWeight: 900, color: barColor, lineHeight: 1 }}>{rate}%</div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: "#fcd34d" }}>+{pt}pt</div>
                            </div>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 12 }}>
                            <div style={{ height: "100%", width: `${rate}%`, borderRadius: 999, background: barColor, transition: "width .4s ease" }} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {quests.map((q) => (
                                <div key={q.id} onClick={() => toggle(P.key, q.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 10, cursor: "pointer", background: q.done ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.02)", border: q.done ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(255,255,255,0.06)" }}>
                                    <div style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: q.done ? "linear-gradient(135deg,#34d399,#10b981)" : "transparent", border: q.done ? "none" : "2px solid rgba(255,255,255,0.25)", color: "#fff", fontSize: 12, fontWeight: 900 }}>{q.done ? "✓" : ""}</div>
                                    <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: q.done ? "#6ee7b7" : "#d1d5db" }}>{q.label}</div>
                                    <div style={{ fontSize: 10.5, fontWeight: 700, color: q.done ? "#34d399" : "#6b7280" }}>{q.done ? "達成" : "未達成"}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
});

TodayScheduleReview.displayName = "TodayScheduleReview";
export default TodayScheduleReview;
