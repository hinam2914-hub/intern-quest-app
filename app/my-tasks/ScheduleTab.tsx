"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

interface Routine {
    id: string;
    title: string;
    sort_order: number;
    start_time: string | null;
}

// "9:00" を分に変換（並び替え用）。空・不正は末尾へ
function timeToMinutes(t: string | null): number {
    if (!t) return 99999;
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return 99999;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export default function ScheduleTab() {
    const [userId, setUserId] = useState("");
    const [todayYmd, setTodayYmd] = useState("");
    const [routines, setRoutines] = useState<Routine[]>([]);
    const [checkedIds, setCheckedIds] = useState<string[]>([]);
    const [newTitle, setNewTitle] = useState("");
    const [newTime, setNewTime] = useState("");
    const [openCheckId, setOpenCheckId] = useState<string | null>(null);
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    const load = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);
        const now = new Date();
        const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const ymd = jst.toISOString().slice(0, 10);
        setTodayYmd(ymd);

        const { data: routineRows } = await supabase
            .from("routines")
            .select("id, title, sort_order, start_time")
            .eq("user_id", user.id)
            .eq("is_active", true);
        setRoutines((routineRows || []) as Routine[]);

        const { data: checkRows } = await supabase
            .from("routine_checks")
            .select("routine_id")
            .eq("user_id", user.id)
            .eq("check_date", ymd);
        setCheckedIds((checkRows || []).map((r: { routine_id: string }) => r.routine_id));
    }, []);

    useEffect(() => { load(); }, [load]);

    const sorted = [...routines].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
    const doneCount = sorted.filter(r => checkedIds.includes(r.id)).length;

    // 項目を追加
    const addRoutine = async () => {
        if (!newTitle.trim()) { setMessage("項目名を入力してください"); return; }
        if (!newTime.trim()) { setMessage("時刻を入力してください"); return; }
        if (routines.length >= 10) { setMessage("スケジュールは10個までです"); return; }
        setSaving(true);
        setMessage("");
        const nextOrder = routines.length > 0 ? Math.max(...routines.map(r => r.sort_order)) + 1 : 0;
        const { data, error } = await supabase
            .from("routines")
            .insert({ user_id: userId, title: newTitle.trim(), sort_order: nextOrder, start_time: newTime })
            .select("id, title, sort_order, start_time")
            .single();
        if (error) { setMessage("追加に失敗しました: " + error.message); setSaving(false); return; }
        if (data) setRoutines([...routines, data as Routine]);
        setNewTitle("");
        setNewTime("");
        setSaving(false);
    };

    // 項目を削除（is_active を false に）
    const deleteRoutine = async (id: string) => {
        if (!confirm("このスケジュール項目を削除しますか？")) return;
        setSaving(true);
        const { error } = await supabase.from("routines").update({ is_active: false }).eq("id", id);
        if (error) { setMessage("削除に失敗しました: " + error.message); setSaving(false); return; }
        setRoutines(routines.filter(r => r.id !== id));
        setSaving(false);
    };

    // チェック（一言メモ必須）
    const check = async (routineId: string) => {
        if (!userId || !todayYmd) { return; }
        if (!note.trim()) { alert("一言コメントを入力してください"); return; }
        setSaving(true);
        const { error } = await supabase.from("routine_checks").insert({
            user_id: userId,
            routine_id: routineId,
            check_date: todayYmd,
            note: note.trim(),
        });
        if (error) { alert("チェックに失敗しました: " + error.message); setSaving(false); return; }
        setCheckedIds(prev => [...prev, routineId]);
        setOpenCheckId(null);
        setNote("");
        setSaving(false);
    };

    // チェック解除（5/26の全消えバグ対策：userId/todayYmd が空なら何もしない）
    const uncheck = async (routineId: string) => {
        if (!userId || !todayYmd) { return; }
        setSaving(true);
        const { error } = await supabase.from("routine_checks")
            .delete()
            .eq("user_id", userId)
            .eq("routine_id", routineId)
            .eq("check_date", todayYmd);
        if (error) { alert("解除に失敗しました: " + error.message); setSaving(false); return; }
        setCheckedIds(prev => prev.filter(id => id !== routineId));
        setSaving(false);
    };

    return (
        <section style={{ marginBottom: 32, padding: 24, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, letterSpacing: 2 }}>🗓️ スケジュール（毎日のルーティン）</div>
                <div style={{ fontSize: 12, color: "#34d399", fontWeight: 700 }}>{doneCount} / {sorted.length} 完了</div>
            </div>

            {/* 一覧（時刻順） */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {sorted.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: "#6b7280", fontSize: 13 }}>スケジュールがありません。下の入力欄から追加できます</div>
                ) : sorted.map(r => {
                    const done = checkedIds.includes(r.id);
                    return (
                        <div key={r.id} style={{ padding: "12px 16px", borderRadius: 12, background: done ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${done ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.08)"}` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ fontSize: 14, color: r.start_time ? "#a5b4fc" : "#6b7280", fontWeight: 700, minWidth: 52 }}>{r.start_time || "—"}</span>
                                <span style={{ flex: 1, fontSize: 15, color: done ? "#34d399" : "#f9fafb" }}>{r.title}</span>
                                {done ? (
                                    <button onClick={() => uncheck(r.id)} disabled={saving} style={{ background: "none", border: "1px solid rgba(52,211,153,0.4)", color: "#34d399", cursor: "pointer", fontSize: 12, padding: "4px 10px", borderRadius: 6 }}>✓ 完了</button>
                                ) : (
                                    <button onClick={() => setOpenCheckId(openCheckId === r.id ? null : r.id)} disabled={saving} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "#9ca3af", cursor: "pointer", fontSize: 12, padding: "4px 10px", borderRadius: 6 }}>チェック</button>
                                )}
                                <button onClick={() => deleteRoutine(r.id)} disabled={saving} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 14, padding: 4 }} title="削除">🗑️</button>
                            </div>
                            {openCheckId === r.id && !done && (
                                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="一言メモ（必須）" style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f9fafb", fontSize: 13 }} />
                                    <button onClick={() => check(r.id)} disabled={saving || !note.trim()} style={{ padding: "8px 16px", borderRadius: 8, background: note.trim() ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", border: "none", color: "#fff", fontWeight: 700, cursor: note.trim() ? "pointer" : "not-allowed", fontSize: 13 }}>完了にする</button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 追加フォーム */}
            <div style={{ display: "flex", gap: 8 }}>
                <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} style={{ width: 110, padding: "10px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f9fafb", fontSize: 13 }} />
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRoutine()} placeholder="例: 朝のメール確認" style={{ flex: 1, padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f9fafb", fontSize: 13 }} />
                <button onClick={addRoutine} disabled={saving || !newTitle.trim()} style={{ padding: "10px 16px", borderRadius: 8, background: newTitle.trim() ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", border: "none", color: "#fff", fontWeight: 700, cursor: newTitle.trim() ? "pointer" : "not-allowed", fontSize: 13 }}>+ 追加</button>
            </div>
            {message && <div style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>{message}</div>}
        </section>
    );
}
