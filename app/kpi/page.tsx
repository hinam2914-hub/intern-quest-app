"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Department = { id: string; name: string; code: string; main_metric: string; unit: string };
type MonthlyKpi = { id: string; department_id: string; year_month: string; target: number; result: number; approved: boolean; points_awarded: number };

function getYearMonth(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getAchievementRate(target: number, result: number): number {
    if (target === 0) return 0;
    return Math.round((result / target) * 100);
}

function getPoints(rate: number): number {
    if (rate >= 120) return 50;
    if (rate >= 100) return 30;
    if (rate >= 80) return 20;
    if (rate >= 60) return 10;
    return 0;
}

function getRateColor(rate: number): string {
    if (rate >= 100) return "#34d399";
    if (rate >= 80) return "#f59e0b";
    if (rate >= 60) return "#f97316";
    return "#f87171";
}

export default function KpiPage() {
    const router = useRouter();
    const [userId, setUserId] = useState("");
    const [departments, setDepartments] = useState<Department[]>([]);
    const [myDeptId, setMyDeptId] = useState("");
    const [kpiList, setKpiList] = useState<MonthlyKpi[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [selectedMonth, setSelectedMonth] = useState(getYearMonth());

    // HR面談数（全員共通）
    const [hrResult, setHrResult] = useState(0);
    const [hrTarget, setHrTarget] = useState(0);
    const [hrSaving, setHrSaving] = useState(false);

    // メインKPI
    const [mainTarget, setMainTarget] = useState(0);
    const [mainResult, setMainResult] = useState(0);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);

            const { data: depts } = await supabase.from("departments").select("*").order("created_at");
            setDepartments((depts || []) as Department[]);

            const { data: profile } = await supabase.from("profiles").select("department_id").eq("id", user.id).single();
            setMyDeptId(profile?.department_id || "");

            const { data: kpiRows } = await supabase.from("monthly_kpi")
                .select("*")
                .eq("user_id", user.id)
                .eq("year_month", selectedMonth);
            setKpiList((kpiRows || []) as MonthlyKpi[]);

            // 既存データをフォームに反映
            if (kpiRows) {
                const hrDept = (depts || []).find((d: any) => d.code === "HR");
                const hrKpi = kpiRows.find((k: any) => k.department_id === hrDept?.id);
                if (hrKpi) { setHrResult(hrKpi.result); setHrTarget(hrKpi.target); }

                const mainKpi = kpiRows.find((k: any) => k.department_id === profile?.department_id);
                if (mainKpi) { setMainResult(mainKpi.result); setMainTarget(mainKpi.target); }
            }

            setLoading(false);
        };
        load();
    }, [selectedMonth, router]);

    const handleSaveMain = async () => {
        if (!myDeptId) { setMessage("事業部が設定されていません。マイページで設定してください。"); return; }
        setSaving(true);
        const rate = getAchievementRate(mainTarget, mainResult);
        const pts = getPoints(rate);
        await supabase.from("monthly_kpi").upsert({
            user_id: userId,
            department_id: myDeptId,
            year_month: selectedMonth,
            target: mainTarget,
            result: mainResult,
            points_awarded: pts,
        }, { onConflict: "user_id,department_id,year_month" });
        setMessage(`✅ メインKPIを保存しました！達成率${rate}% → 獲得予定 ${pts}pt`);
        setSaving(false);
    };

    const handleSaveHr = async () => {
        const hrDept = departments.find(d => d.code === "HR");
        if (!hrDept) return;
        setHrSaving(true);
        const rate = getAchievementRate(hrTarget, hrResult);
        const pts = getPoints(rate);
        await supabase.from("monthly_kpi").upsert({
            user_id: userId,
            department_id: hrDept.id,
            year_month: selectedMonth,
            target: hrTarget,
            result: hrResult,
            points_awarded: pts,
        }, { onConflict: "user_id,department_id,year_month" });
        setMessage(`✅ HR面談数を保存しました！達成率${rate}% → 獲得予定 ${pts}pt`);
        setHrSaving(false);
    };

    const myDept = departments.find(d => d.id === myDeptId);
    const mainRate = getAchievementRate(mainTarget, mainResult);
    const mainPts = getPoints(mainRate);
    const hrRate = getAchievementRate(hrTarget, hrResult);
    const hrPts = getPoints(hrRate);

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.08) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto" }}>

                {/* ヘッダー */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                    <div>
                        <div onClick={() => router.push("/menu")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, cursor: "pointer" }}>INTERN QUEST</div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>📊 月次KPI</h1>
                        <p style={{ color: "#6b7280", fontSize: 14, margin: "8px 0 0" }}>月次実績を入力してポイントを獲得しよう</p>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#1a1a2e", color: "#f9fafb", fontSize: 13, outline: "none" }}
                        >
                            {Array.from({ length: 6 }, (_, i) => {
                                const d = new Date();
                                d.setMonth(d.getMonth() - i);
                                const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                                return <option key={ym} value={ym}>{ym}</option>;
                            })}
                        </select>
                        <button onClick={() => router.push("/mypage")} style={{ background: "rgba(255,255,255,0.05)", color: "#d1d5db", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>マイページ</button>
                    </div>
                </div>

                {message && (
                    <div style={{ marginBottom: 20, padding: "14px 20px", background: message.includes("✅") ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${message.includes("✅") ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`, borderRadius: 12, color: message.includes("✅") ? "#34d399" : "#f87171", fontWeight: 600, fontSize: 14 }}>
                        {message}
                    </div>
                )}

                {/* ポイント早見表 */}
                <div style={{ marginBottom: 24, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>POINT TABLE</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                        {[
                            { label: "120%以上", pt: "50pt", color: "#34d399" },
                            { label: "100%以上", pt: "30pt", color: "#6366f1" },
                            { label: "80%以上", pt: "20pt", color: "#f59e0b" },
                            { label: "60%以上", pt: "10pt", color: "#f97316" },
                        ].map((item) => (
                            <div key={item.label} style={{ padding: "10px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
                                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{item.label}</div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.pt}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* メインKPI */}
                <div style={{ marginBottom: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>
                        MAIN KPI {myDept ? `— ${myDept.name}（${myDept.main_metric}）` : ""}
                    </div>

                    {!myDeptId ? (
                        <div style={{ padding: "16px", borderRadius: 10, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24", fontSize: 14 }}>
                            💡 事業部が設定されていません。マイページのプロフィールから事業部を選択してください。
                        </div>
                    ) : (
                        <>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>目標 ({myDept?.unit})</div>
                                    <input
                                        type="number"
                                        value={mainTarget}
                                        onChange={(e) => setMainTarget(Number(e.target.value))}
                                        min={0}
                                        style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 16, outline: "none", boxSizing: "border-box" }}
                                    />
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>実績 ({myDept?.unit})</div>
                                    <input
                                        type="number"
                                        value={mainResult}
                                        onChange={(e) => setMainResult(Number(e.target.value))}
                                        min={0}
                                        style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 16, outline: "none", boxSizing: "border-box" }}
                                    />
                                </div>
                            </div>

                            {/* 達成率プレビュー */}
                            <div style={{ marginBottom: 20, padding: "16px 20px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <span style={{ fontSize: 13, color: "#9ca3af" }}>達成率</span>
                                    <span style={{ fontSize: 24, fontWeight: 800, color: getRateColor(mainRate) }}>{mainRate}%</span>
                                </div>
                                <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)", marginBottom: 8 }}>
                                    <div style={{ height: "100%", width: `${Math.min(mainRate, 100)}%`, background: getRateColor(mainRate), borderRadius: 999, transition: "width 0.4s ease" }} />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: 13, color: "#9ca3af" }}>獲得予定ポイント</span>
                                    <span style={{ fontSize: 20, fontWeight: 800, color: mainPts > 0 ? "#818cf8" : "#6b7280" }}>{mainPts}pt</span>
                                </div>
                            </div>

                            <button
                                onClick={handleSaveMain}
                                disabled={saving}
                                style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: saving ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontSize: 15 }}
                            >
                                {saving ? "保存中..." : "💾 メインKPIを保存"}
                            </button>
                        </>
                    )}
                </div>

                {/* HR面談数（全員共通） */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>HR KPI — 採用面談数（全員入力）</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                        <div>
                            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>目標（件）</div>
                            <input
                                type="number"
                                value={hrTarget}
                                onChange={(e) => setHrTarget(Number(e.target.value))}
                                min={0}
                                style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 16, outline: "none", boxSizing: "border-box" }}
                            />
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>実績（件）</div>
                            <input
                                type="number"
                                value={hrResult}
                                onChange={(e) => setHrResult(Number(e.target.value))}
                                min={0}
                                style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 16, outline: "none", boxSizing: "border-box" }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: 20, padding: "16px 20px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <span style={{ fontSize: 13, color: "#9ca3af" }}>達成率</span>
                            <span style={{ fontSize: 24, fontWeight: 800, color: getRateColor(hrRate) }}>{hrRate}%</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)", marginBottom: 8 }}>
                            <div style={{ height: "100%", width: `${Math.min(hrRate, 100)}%`, background: getRateColor(hrRate), borderRadius: 999, transition: "width 0.4s ease" }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 13, color: "#9ca3af" }}>獲得予定ポイント</span>
                            <span style={{ fontSize: 20, fontWeight: 800, color: hrPts > 0 ? "#818cf8" : "#6b7280" }}>{hrPts}pt</span>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveHr}
                        disabled={hrSaving}
                        style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: hrSaving ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #f59e0b, #fbbf24)", color: "#0a0a0f", fontWeight: 700, cursor: hrSaving ? "not-allowed" : "pointer", fontSize: 15 }}
                    >
                        {hrSaving ? "保存中..." : "💾 HR面談数を保存"}
                    </button>
                </div>
            </div>
        </main>
    );
}