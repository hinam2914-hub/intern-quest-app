"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface RoutineItem { id: string; user_id: string; title: string; is_active: boolean; }
interface CheckRow { id: string; user_id: string; routine_id: string; check_date: string; note: string | null; created_at: string; }
interface UserRow { id: string; name: string | null; }

// 全項目達成が何日連続かを計算（マイページと同じ割り切り：今の項目数基準）
function calcStreak(checks: CheckRow[], itemCount: number): number {
    if (itemCount === 0) return 0;
    const countByDate: Record<string, number> = {};
    checks.forEach((c) => { countByDate[c.check_date] = (countByDate[c.check_date] || 0) + 1; });
    const isFullDay = (ymd: string) => (countByDate[ymd] || 0) >= itemCount;
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    let streak = 0;
    const cursor = new Date();
    if (!isFullDay(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (isFullDay(fmt(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
    return streak;
}

export default function RoutineTab() {
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState<"timeline" | "by_user">("timeline");
    const [routines, setRoutines] = useState<RoutineItem[]>([]);
    const [checks, setChecks] = useState<CheckRow[]>([]);
    const [users, setUsers] = useState<UserRow[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>("");

    useEffect(() => {
        (async () => {
            const { data: routineRows } = await supabase.from("routines").select("id, user_id, title, is_active");
            const { data: checkRows } = await supabase.from("routine_checks").select("id, user_id, routine_id, check_date, note, created_at").order("created_at", { ascending: false });
            const { data: userRows } = await supabase.from("profiles").select("id, name");
            setRoutines((routineRows || []) as RoutineItem[]);
            setChecks((checkRows || []) as CheckRow[]);
            setUsers((userRows || []) as UserRow[]);
            setLoading(false);
        })();
    }, []);

    const userName = (uid: string) => users.find((u) => u.id === uid)?.name || "名前未設定";
    const routineTitle = (rid: string) => routines.find((r) => r.id === rid)?.title || "(削除された項目)";

    if (loading) return <div style={{ color: "#9ca3af", fontSize: 14, padding: 20 }}>読み込み中...</div>;

    return (
        <div>
            <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 16, padding: 24, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>🔁 ルーティンチェック状況</div>
                <div style={{ fontSize: 13, color: "#9ca3af" }}>メンバーのデイリールーティンの設定と、毎日のチェック状況・一言メモを確認できます。</div>
            </div>

            {/* モード切替 */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button onClick={() => setMode("timeline")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", background: mode === "timeline" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: mode === "timeline" ? "#fff" : "#9ca3af" }}>全員時系列</button>
                <button onClick={() => setMode("by_user")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", background: mode === "by_user" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: mode === "by_user" ? "#fff" : "#9ca3af" }}>ユーザーごと</button>
            </div>

            {/* 全員時系列 */}
            {mode === "timeline" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {checks.length === 0 ? (
                        <div style={{ color: "#6b7280", fontSize: 14, padding: 16 }}>まだチェック記録がありません。</div>
                    ) : checks.map((c) => (
                        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <span style={{ fontSize: 12, color: "#6b7280", minWidth: 90 }}>{c.check_date}</span>
                            <span style={{ fontSize: 13, color: "#e5e7eb", fontWeight: 600, minWidth: 110 }}>{userName(c.user_id)}</span>
                            <span style={{ fontSize: 13, color: "#a5b4fc", minWidth: 140 }}>{routineTitle(c.routine_id)}</span>
                            <span style={{ fontSize: 13, color: "#9ca3af", flex: 1 }}>{c.note || "（メモなし）"}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ユーザーごと */}
            {mode === "by_user" && (
                <div>
                    <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, background: "#1f2937", color: "#f9fafb", border: "1px solid rgba(255,255,255,0.1)", fontSize: 13, marginBottom: 16 }}>
                        <option value="">-- ユーザーを選択 --</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.name || "名前未設定"}</option>)}
                    </select>

                    {selectedUserId && (() => {
                        const myItems = routines.filter((r) => r.user_id === selectedUserId && r.is_active);
                        const myChecks = checks.filter((c) => c.user_id === selectedUserId);
                        const streak = calcStreak(myChecks, myItems.length);
                        return (
                            <div>
                                <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                                    <div style={{ padding: "10px 16px", borderRadius: 10, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)" }}>
                                        <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700 }}>連続達成</div>
                                        <div style={{ fontSize: 20, fontWeight: 800, color: "#a5b4fc" }}>{streak}<span style={{ fontSize: 12 }}>日</span></div>
                                    </div>
                                    <div style={{ padding: "10px 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>ルーティン項目数</div>
                                        <div style={{ fontSize: 20, fontWeight: 800, color: "#e5e7eb" }}>{myItems.length}<span style={{ fontSize: 12 }}>個</span></div>
                                    </div>
                                </div>

                                <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, marginBottom: 6 }}>設定中のルーティン</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                                    {myItems.length === 0 ? <span style={{ fontSize: 13, color: "#6b7280" }}>未設定</span> : myItems.map((r) => (
                                        <span key={r.id} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "rgba(99,102,241,0.15)", color: "#a5b4fc", fontWeight: 600 }}>{r.title}</span>
                                    ))}
                                </div>

                                <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, marginBottom: 6 }}>チェック履歴</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {myChecks.length === 0 ? <span style={{ fontSize: 13, color: "#6b7280" }}>まだチェック記録がありません。</span> : myChecks.map((c) => (
                                        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                            <span style={{ fontSize: 12, color: "#6b7280", minWidth: 90 }}>{c.check_date}</span>
                                            <span style={{ fontSize: 13, color: "#a5b4fc", minWidth: 140 }}>{routineTitle(c.routine_id)}</span>
                                            <span style={{ fontSize: 13, color: "#9ca3af", flex: 1 }}>{c.note || "（メモなし）"}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}