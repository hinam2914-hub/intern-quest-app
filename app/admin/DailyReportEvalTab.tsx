"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

interface Submission {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    eval_points: number;
    name?: string;
}

export default function DailyReportEvalTab() {
    const [adminId, setAdminId] = useState("");
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [showEvaluated, setShowEvaluated] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setAdminId(user.id);

        // 日報を新しい順に取得（直近100件）
        const { data: subRows } = await supabase
            .from("submissions")
            .select("id, user_id, content, created_at, eval_points")
            .order("created_at", { ascending: false })
            .limit(100);
        const subs = (subRows || []) as Submission[];

        // 名前を引く
        const userIds = Array.from(new Set(subs.map(s => s.user_id)));
        if (userIds.length > 0) {
            const { data: profs } = await supabase.from("profiles").select("id, name").in("id", userIds);
            const nameMap: { [id: string]: string } = {};
            (profs || []).forEach((p: { id: string; name: string }) => { nameMap[p.id] = p.name; });
            subs.forEach(s => { s.name = nameMap[s.user_id] || "（不明）"; });
        }
        setSubmissions(subs);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // +10pt ボーナスを付与
    const giveBonus = async (sub: Submission) => {
        if (sub.eval_points > 0) return; // 二重防止
        if (!adminId) return;
        setSaving(sub.id);
        const BONUS = 10;

        // 1. submissions に評価を記録
        const { error: evalErr } = await supabase
            .from("submissions")
            .update({ eval_points: BONUS, evaluated_by: adminId })
            .eq("id", sub.id);
        if (evalErr) { alert("評価の記録に失敗しました: " + evalErr.message); setSaving(null); return; }

        // 2. user_points を加算（id 参照）
        const { data: up } = await supabase.from("user_points").select("points").eq("id", sub.user_id).single();
        const current = up?.points || 0;
        await supabase.from("user_points").update({ points: current + BONUS }).eq("id", sub.user_id);

        // 3. points_history に記録（user_id 参照、change カラム）
        await supabase.from("points_history").insert({ user_id: sub.user_id, change: BONUS, reason: "report_bonus" });

        // 画面更新
        setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, eval_points: BONUS } : s));
        setSaving(null);
    };

    if (loading) {
        return <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>読み込み中...</div>;
    }

    const unevaluated = submissions.filter(s => s.eval_points === 0);
    const evaluated = submissions.filter(s => s.eval_points > 0);
    const list = showEvaluated ? evaluated : unevaluated;

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 13, color: "#9ca3af", fontWeight: 700 }}>
                    📝 日報評価（内容が良ければ +10pt）
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setShowEvaluated(false)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", background: !showEvaluated ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: !showEvaluated ? "#fff" : "#9ca3af" }}>未評価 ({unevaluated.length})</button>
                    <button onClick={() => setShowEvaluated(true)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", background: showEvaluated ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: showEvaluated ? "#fff" : "#9ca3af" }}>評価済み ({evaluated.length})</button>
                </div>
            </div>

            {list.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
                    {showEvaluated ? "まだ評価した日報はありません" : "未評価の日報はありません"}
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {list.map(sub => (
                        <div key={sub.id} style={{ padding: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>{sub.name}</div>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>{new Date(sub.created_at).toLocaleString("ja-JP")}</div>
                            </div>
                            <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 12 }}>{sub.content}</div>
                            {sub.eval_points > 0 ? (
                                <div style={{ fontSize: 12, color: "#34d399", fontWeight: 700 }}>✓ +{sub.eval_points}pt 評価済み</div>
                            ) : (
                                <button onClick={() => giveBonus(sub)} disabled={saving === sub.id} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #f59e0b, #f97316)", color: "#fff", fontWeight: 700, cursor: saving === sub.id ? "not-allowed" : "pointer", fontSize: 13 }}>
                                    {saving === sub.id ? "付与中..." : "⭐ +10pt 評価する"}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
