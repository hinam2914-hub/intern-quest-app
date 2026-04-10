"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

type StatRow = { id: string; year_month: string; metric_key: string; target: number; actual: number; };
type MonthData = { year_month: string;[key: string]: any };

const SP_METRICS = [
    { key: "members", label: "稼働人数", color: "#9ca3af", unit: "人" },
    { key: "appoint", label: "アポ数", color: "#6366f1", unit: "件" },
    { key: "shohо", label: "初訪数", color: "#8b5cf6", unit: "件" },
    { key: "tsuuka", label: "通過数", color: "#06b6d4", unit: "件" },
    { key: "shodan", label: "商談数", color: "#f59e0b", unit: "件" },
    { key: "jyushu", label: "受注数", color: "#34d399", unit: "件" },
    { key: "nohin", label: "納品数", color: "#ec4899", unit: "件" },
];

function getMonthList(): string[] {
    const months = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return months;
}

export default function SPStatsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<StatRow[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    });
    const [inputs, setInputs] = useState<Record<string, { target: string; actual: string }>>({});
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [deptId, setDeptId] = useState("");
    const [graphMetric, setGraphMetric] = useState("shodan");

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map(e => e.trim());
            if (!user.email || !adminEmails.includes(user.email)) { router.push("/mypage"); return; }

            const { data: deptRows } = await supabase.from("departments").select("id, name").ilike("name", "%SP%");
            const dept = deptRows?.[0];
            if (!dept) { setLoading(false); return; }
            setDeptId(dept.id);

            const { data: statRows } = await supabase.from("dept_monthly_stats").select("*").eq("department_id", dept.id).order("year_month", { ascending: true });
            setStats((statRows || []) as StatRow[]);
            setLoading(false);
        };
        load();
    }, [router]);

    useEffect(() => {
        if (!deptId) return;
        const monthStats = stats.filter(s => s.year_month === selectedMonth);
        const newInputs: Record<string, { target: string; actual: string }> = {};
        SP_METRICS.forEach(m => {
            const found = monthStats.find(s => s.metric_key === m.key);
            newInputs[m.key] = { target: found?.target?.toString() || "", actual: found?.actual?.toString() || "" };
        });
        setInputs(newInputs);
    }, [selectedMonth, stats, deptId]);

    const handleSave = async () => {
        if (!deptId) return;
        setSaving(true);
        setMessage("");
        const { data: { user } } = await supabase.auth.getUser();
        for (const m of SP_METRICS) {
            const target = parseFloat(inputs[m.key]?.target || "0") || 0;
            const actual = parseFloat(inputs[m.key]?.actual || "0") || 0;
            await supabase.from("dept_monthly_stats").upsert({
                department_id: deptId,
                year_month: selectedMonth,
                metric_key: m.key,
                target,
                actual,
                created_by: user?.id,
            }, { onConflict: "department_id,year_month,metric_key" });
        }
        const { data: statRows } = await supabase.from("dept_monthly_stats").select("*").eq("department_id", deptId).order("year_month", { ascending: true });
        setStats((statRows || []) as StatRow[]);
        setMessage("✅ 保存しました！");
        setSaving(false);
    };

    const graphData: MonthData[] = getMonthList().map(ym => {
        const row: MonthData = { year_month: ym.slice(5) };
        SP_METRICS.forEach(m => {
            const found = stats.find(s => s.year_month === ym && s.metric_key === m.key);
            row[`${m.key}_actual`] = found?.actual || 0;
            row[`${m.key}_target`] = found?.target || 0;
        });
        return row;
    }).filter(row => SP_METRICS.some(m => row[`${m.key}_actual`] > 0 || row[`${m.key}_target`] > 0));

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    const selectedMetric = SP_METRICS.find(m => m.key === graphMetric)!;

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto" }}>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                    <div>
                        <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3 }}>INTERN QUEST / 管理者</div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>SP事業部 月次成績</h1>
                    </div>
                    <button onClick={() => router.push("/admin")} style={{ background: "rgba(255,255,255,0.05)", color: "#d1d5db", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>← 管理者画面</button>
                </div>

                {/* 入力フォーム */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2 }}>📝 数値入力</div>
                        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#1a1a2e", color: "#f9fafb", fontSize: 13, outline: "none" }}>
                            {getMonthList().reverse().map(ym => (
                                <option key={ym} value={ym}>{ym}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 20 }}>
                        {SP_METRICS.map(m => {
                            const actual = parseFloat(inputs[m.key]?.actual || "0") || 0;
                            const target = parseFloat(inputs[m.key]?.target || "0") || 0;
                            const rate = target > 0 ? Math.round((actual / target) * 100) : 0;
                            const rateColor = rate >= 100 ? "#34d399" : rate >= 80 ? "#f59e0b" : "#f87171";
                            return (
                                <div key={m.key} style={{ padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${m.color}30` }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.label}</span>
                                        {target > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: rateColor }}>{rate}%</span>}
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                        <div>
                                            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>目標</div>
                                            <input type="number" value={inputs[m.key]?.target || ""} onChange={(e) => setInputs(prev => ({ ...prev, [m.key]: { ...prev[m.key], target: e.target.value } }))} placeholder="0" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>実績</div>
                                            <input type="number" value={inputs[m.key]?.actual || ""} onChange={(e) => setInputs(prev => ({ ...prev, [m.key]: { ...prev[m.key], actual: e.target.value } }))} placeholder="0" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${m.color}40`, background: `${m.color}10`, color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                        </div>
                                    </div>
                                    {target > 0 && (
                                        <div style={{ marginTop: 10, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
                                            <div style={{ height: "100%", width: `${Math.min(rate, 100)}%`, background: rateColor, borderRadius: 999 }} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <button onClick={handleSave} disabled={saving} style={{ padding: "12px 32px", borderRadius: 10, border: "none", background: saving ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontSize: 15 }}>
                        {saving ? "保存中..." : "💾 保存する"}
                    </button>
                    {message && <span style={{ marginLeft: 16, fontSize: 13, color: "#34d399", fontWeight: 600 }}>{message}</span>}
                </div>

                {/* 項目別棒グラフ */}
                {graphData.length > 0 && (
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2 }}>📊 項目別推移</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {SP_METRICS.map(m => (
                                    <button key={m.key} onClick={() => setGraphMetric(m.key)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 12, background: graphMetric === m.key ? m.color : "rgba(255,255,255,0.05)", color: graphMetric === m.key ? "#fff" : "#9ca3af" }}>
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={graphData} barGap={4}>
                                <XAxis dataKey="year_month" stroke="#4b5563" tick={{ fill: "#6b7280", fontSize: 11 }} />
                                <YAxis stroke="#4b5563" tick={{ fill: "#6b7280", fontSize: 11 }} />
                                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#f9fafb" }} formatter={(value: any, name: any) => [value + selectedMetric.unit, name === `${graphMetric}_actual` ? "実績" : "目標"]} />
                                <Legend formatter={(value: any) => value === `${graphMetric}_actual` ? "実績" : "目標"} />
                                <Bar dataKey={`${graphMetric}_target`} fill="rgba(255,255,255,0.25)" radius={[4, 4, 0, 0]} name={`${graphMetric}_target`} />
                                <Bar dataKey={`${graphMetric}_actual`} fill={selectedMetric.color} radius={[4, 4, 0, 0]} name={`${graphMetric}_actual`} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* 月別実績一覧 */}
                {graphData.length > 0 && (
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>📋 月別実績一覧</div>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                                        <th style={{ padding: "8px 12px", fontSize: 11, color: "#6b7280", fontWeight: 700, textAlign: "left" }}>月</th>
                                        {SP_METRICS.map(m => (
                                            <th key={m.key} style={{ padding: "8px 12px", fontSize: 11, color: m.color, fontWeight: 700, textAlign: "center" }}>{m.label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...graphData].reverse().map(row => (
                                        <tr key={row.year_month} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                            <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 700, color: "#f9fafb" }}>{row.year_month}</td>
                                            {SP_METRICS.map(m => {
                                                const actual = row[`${m.key}_actual`] || 0;
                                                const target = row[`${m.key}_target`] || 0;
                                                const rate = target > 0 ? Math.round((actual / target) * 100) : null;
                                                const rateColor = rate !== null ? (rate >= 100 ? "#34d399" : rate >= 80 ? "#f59e0b" : "#f87171") : "#6b7280";
                                                return (
                                                    <td key={m.key} style={{ padding: "10px 12px", textAlign: "center" }}>
                                                        <div style={{ fontSize: 14, fontWeight: 700, color: rateColor }}>{actual > 0 ? `${actual}${m.unit}` : "-"}</div>
                                                        {target > 0 && <div style={{ fontSize: 11, color: "#6b7280" }}>/{target}{m.unit}</div>}
                                                        {rate !== null && actual > 0 && <div style={{ fontSize: 11, color: rateColor }}>{rate}%</div>}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}