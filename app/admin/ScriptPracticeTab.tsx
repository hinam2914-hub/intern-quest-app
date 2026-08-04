"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type User = { id: string; name: string; department_id: string | null };
type Dept = { id: string; code: string };
type Progress = {
    id: string; user_id: string;
    test1_passed: boolean; test2_passed: boolean; test3_passed: boolean;
    started_at: string;
};
type Report = {
    id: string; user_id: string; day_no: number; practice_type: string;
    content: string; minutes: number | null; created_at: string;
};

const TYPE_LABEL: Record<string, string> = { self: "🗣️ セルフ", phone: "📞 電話", mock: "🎭 模擬", test: "🏆 テスト" };
const TESTS = [
    { key: "test1_passed", atKey: "test1_passed_at", label: "① 3分" },
    { key: "test2_passed", atKey: "test2_passed_at", label: "② 5分" },
    { key: "test3_passed", atKey: "test3_passed_at", label: "③ 対面" },
];

export default function ScriptPracticeTab() {
    const [users, setUsers] = useState<User[]>([]);
    const [departments, setDepartments] = useState<Dept[]>([]);
    const [progresses, setProgresses] = useState<Progress[]>([]);
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [openUser, setOpenUser] = useState<string | null>(null);

    const load = async () => {
        const [{ data: u }, { data: d }, { data: p }, { data: r }] = await Promise.all([
            supabase.from("profiles").select("id, name, department_id").eq("is_active", true),
            supabase.from("departments").select("id, code"),
            supabase.from("script_test_progress").select("*"),
            supabase.from("practice_reports").select("*").order("created_at", { ascending: false }),
        ]);
        setUsers((u || []) as User[]);
        setDepartments((d || []) as Dept[]);
        setProgresses((p || []) as Progress[]);
        setReports((r || []) as Report[]);
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const deptCode: Record<string, string> = {};
    departments.forEach(d => { deptCode[d.id] = d.code; });

    // 練習を始めている人（progressがある人）だけ表示
    const practicing = progresses.map(pr => {
        const user = users.find(u => u.id === pr.user_id);
        const myReports = reports.filter(r => r.user_id === pr.user_id);
        const lastReport = myReports[0];
        const daysSinceLast = lastReport ? Math.floor((Date.now() - new Date(lastReport.created_at).getTime()) / 86400000) : 99;
        const passedCount = [pr.test1_passed, pr.test2_passed, pr.test3_passed].filter(Boolean).length;
        return { pr, user, myReports, lastReport, daysSinceLast, passedCount };
    }).filter(x => x.user);

    // 並び順: 離脱リスク（報告が途切れてる）順 → 進捗少ない順
    const sorted = [...practicing].sort((a, b) => b.daysSinceLast - a.daysSinceLast);

    const alertCount = practicing.filter(x => x.daysSinceLast >= 3 && x.passedCount < 3).length;

    const toggleTest = async (pr: Progress, testKey: string, current: boolean) => {
        const update: any = { [testKey]: !current };
        update[testKey.replace("_passed", "_passed_at")] = !current ? new Date().toISOString() : null;
        await supabase.from("script_test_progress").update(update).eq("id", pr.id);
        await load();
    };

    if (loading) return <div style={{ padding: 40, color: "#8b8fa8" }}>集計中...</div>;

    return (
        <div style={{ padding: "8px 0" }}>
            <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: "#f9fafb", margin: "0 0 4px" }}>🎤 スクリプト練習 進捗</h2>
                <p style={{ fontSize: 13, color: "#8b8fa8", margin: 0 }}>練習中 {practicing.length}名 ｜ テスト①②③の合格チェックはここで行います</p>
            </div>

            {alertCount > 0 && (
                <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 12, background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.35)" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#f87171" }}>🚨 3日以上報告が止まっている人が {alertCount}名 います。声かけ推奨</span>
                </div>
            )}

            {practicing.length === 0 && (
                <div style={{ padding: 32, textAlign: "center", color: "#6b7280", fontSize: 13 }}>まだ練習を始めたメンバーがいません</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sorted.map(({ pr, user, myReports, lastReport, daysSinceLast, passedCount }) => {
                    const isOpen = openUser === pr.user_id;
                    const stalled = daysSinceLast >= 3 && passedCount < 3;
                    const complete = passedCount === 3;
                    return (
                        <div key={pr.id} style={{ borderRadius: 12, background: "rgba(18,18,36,.7)", border: `1px solid ${complete ? "rgba(52,211,153,.4)" : stalled ? "rgba(248,113,113,.4)" : "rgba(255,255,255,.08)"}`, overflow: "hidden", flexShrink: 0 }}>
                            <div onClick={() => setOpenUser(isOpen ? null : pr.user_id)} style={{ cursor: "pointer", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        <span style={{ fontSize: 14, fontWeight: 800, color: "#f9fafb" }}>{user!.name}</span>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: "#8b8fa8" }}>{deptCode[user!.department_id || ""] || "-"}</span>
                                        {complete && <span style={{ fontSize: 10, fontWeight: 900, color: "#34d399", background: "rgba(52,211,153,.15)", border: "1px solid rgba(52,211,153,.4)", borderRadius: 6, padding: "2px 8px" }}>🎉 全テスト合格</span>}
                                        {stalled && <span style={{ fontSize: 10, fontWeight: 900, color: "#f87171", background: "rgba(248,113,113,.15)", border: "1px solid rgba(248,113,113,.4)", borderRadius: 6, padding: "2px 8px" }}>⚠️ {daysSinceLast}日報告なし</span>}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#8b8fa8", marginTop: 4 }}>
                                        報告 {myReports.length}件
                                        {lastReport && ` ｜ 最終: ${new Date(lastReport.created_at).toLocaleDateString("ja-JP")}`}
                                    </div>
                                </div>
                                {/* テスト合格チェック */}
                                <div style={{ display: "flex", gap: 6 }}>
                                    {TESTS.map(t => {
                                        const passed = (pr as any)[t.key] as boolean;
                                        return (
                                            <button key={t.key}
                                                onClick={(e) => { e.stopPropagation(); toggleTest(pr, t.key, passed); }}
                                                style={{
                                                    padding: "6px 12px", borderRadius: 8, fontSize: 11.5, fontWeight: 800, cursor: "pointer",
                                                    background: passed ? "rgba(52,211,153,.18)" : "rgba(255,255,255,.04)",
                                                    border: `1px solid ${passed ? "#34d399" : "rgba(255,255,255,.12)"}`,
                                                    color: passed ? "#34d399" : "#9ca3af",
                                                }}>
                                                {passed ? "✅" : "○"} {t.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 展開: 練習報告の履歴 */}
                            {isOpen && (
                                <div style={{ padding: "0 16px 14px", borderTop: "1px solid rgba(255,255,255,.06)" }}>
                                    {myReports.length === 0 ? (
                                        <div style={{ fontSize: 12, color: "#6b7280", padding: "12px 0" }}>報告がまだありません</div>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                                            {myReports.map(r => (
                                                <div key={r.id} style={{ background: "rgba(0,0,0,.25)", borderRadius: 10, padding: "10px 14px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                                        <span style={{ fontSize: 10.5, fontWeight: 900, color: "#a78bfa" }}>Day {r.day_no}</span>
                                                        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#c7c9dd" }}>{TYPE_LABEL[r.practice_type] || r.practice_type}</span>
                                                        {r.minutes && <span style={{ fontSize: 10.5, color: "#6b7280" }}>⏱ {r.minutes}分</span>}
                                                        <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#6b7280" }}>{new Date(r.created_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                                    </div>
                                                    <div style={{ fontSize: 12.5, color: "#d1d5db", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{r.content}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
