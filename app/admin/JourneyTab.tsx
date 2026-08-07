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

// STEP定義（島アイコン付き）
const STEPS = [
    { no: 1, icon: "🏘️", title: "入社・スラック研修" },
    { no: 2, icon: "⛩️", title: "登竜門キックオフ" },
    { no: 3, icon: "🔮", title: "プレイヤー昇格" },
    { no: 4, icon: "📨", title: "DRMスタート" },
    { no: 5, icon: "🏛️", title: "キャリア面談・配属" },
    { no: 6, icon: "🏆", title: "営業デビュー" },
];

export default function JourneyTab() {
    const [subs, setSubs] = useState<Sub[]>([]);
    const [totalInterns, setTotalInterns] = useState(0);
    const [reachedByStep, setReachedByStep] = useState<Record<number, number>>({});
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        const [{ data: subRows }, { data: userRows }] = await Promise.all([
            supabase.from("journey_submissions").select("id, user_id, step_no, status, scheduled_date, review, created_at, mtg_date, event_date, mtg_attended, event_no_cancel").in("step_no", [1, 2, 3, 4, 5]).order("created_at", { ascending: false }),
            supabase.from("profiles").select("id, name").eq("is_active", true),
        ]);
        const nameMap: Record<string, string> = {};
        (userRows || []).forEach((u: any) => { nameMap[u.id] = u.name; });
        const merged = (subRows || []).map((s: any) => ({ ...s, name: nameMap[s.user_id] || "(不明)" }));
        setSubs(merged as Sub[]);
        setTotalInterns((userRows || []).length);

        // 各ユーザーの最大承認済みSTEPを算出
        const maxApproved: Record<string, number> = {};
        (subRows || []).forEach((s: any) => {
            if (s.status === "approved") {
                maxApproved[s.user_id] = Math.max(maxApproved[s.user_id] || 0, s.step_no);
            }
        });
        // STEP到達人数（そのSTEP以上を承認済み = そのSTEPに到達）
        const reached: Record<number, number> = {};
        for (let step = 1; step <= 6; step++) {
            reached[step] = Object.values(maxApproved).filter((m) => m >= step - 1 && m >= 1 ? m >= step - 1 : false).length;
        }
        // 到達 = 「前STEPまで承認済み」= maxApproved >= step-1（step-1を完了していればstepに到達）
        const reached2: Record<number, number> = {};
        for (let step = 1; step <= 6; step++) {
            reached2[step] = Object.values(maxApproved).filter((m) => m >= step - 1).length;
        }
        // STEP1到達 = 全員（誰でもSTEP1にはいる）。ここでは「承認記録がある人」ベースで簡易に。
        setReachedByStep(maxApproved as any);
        // 完了人数（そのstepを承認済み）を別途持つ
        const doneByStep: Record<number, number> = {};
        for (let step = 1; step <= 5; step++) {
            doneByStep[step] = Object.values(maxApproved).filter((m) => m >= step).length;
        }
        setReachedByStep(doneByStep);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const approve = async (s: Sub) => {
        if (!confirm(s.name + " さんの「" + STEP_LABEL[s.step_no] + "」を承認しますか？（+" + STEP_PT[s.step_no] + "pt）")) return;
        const { error } = await supabase.from("journey_submissions").update({ status: "approved" }).eq("id", s.id);
        if (error) { alert("承認に失敗: " + error.message); return; }
        if (s.status !== "approved") {
            const { error: phErr } = await supabase.from("points_history").insert({ user_id: s.user_id, change: STEP_PT[s.step_no], reason: STEP_LABEL[s.step_no] + " 完了" });
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

    // KPI算出
    const doneAll = reachedByStep[5] || 0; // STEP5完了=ほぼゴール手前
    const inProgress = Object.keys(subs.reduce((acc: any, s) => { acc[s.user_id] = 1; return acc; }, {})).length;
    const step3reach = reachedByStep[3] || 0;
    const salesDebut = reachedByStep[5] || 0;
    const completeRate = totalInterns > 0 ? Math.round((doneAll / totalInterns) * 100) : 0;

    const kpiCard = (label: string, value: string, sub: string, accent: string) => (
        <div style={{ flex: "1 1 180px", padding: "20px 22px", borderRadius: 20, background: "linear-gradient(145deg, rgba(139,92,246,.18), rgba(30,27,58,.6))", border: "1px solid rgba(167,139,250,.25)", boxShadow: "0 4px 24px rgba(139,92,246,.15)", backdropFilter: "blur(8px)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: accent, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, color: "#8b8fa8", marginTop: 6 }}>{sub}</div>
        </div>
    );

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
            <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: "#f9fafb", margin: "0 0 4px" }}>🗺️ 冒険マップ 司令室</h2>
                <p style={{ fontSize: 13, color: "#8b8fa8", margin: 0 }}>インターン全体の育成状況を一目で把握</p>
            </div>

            {/* KPIカード */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
                {kpiCard("全体完了率", completeRate + "%", "STEP5到達 " + doneAll + " / " + totalInterns + "名", "#a78bfa")}
                {kpiCard("進行中インターン", inProgress + "名", "冒険マップ開始済み", "#818cf8")}
                {kpiCard("STEP3到達", step3reach + "名", "プレイヤー昇格以上", "#34d399")}
                {kpiCard("営業デビュー", salesDebut + "名", "キャリア面談まで完了", "#fbbf24")}
            </div>

            {/* STEP全体進捗 */}
            <div style={{ fontSize: 13, fontWeight: 800, color: "#c4b5fd", marginBottom: 12, letterSpacing: 1 }}>ステップ別 到達状況</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
                {STEPS.map((st) => {
                    const cnt = st.no <= 5 ? (reachedByStep[st.no] || 0) : (reachedByStep[5] || 0);
                    const rate = totalInterns > 0 ? Math.round((cnt / totalInterns) * 100) : 0;
                    return (
                        <div key={st.no} style={{ flex: "1 1 140px", minWidth: 130, padding: "16px 14px", borderRadius: 18, textAlign: "center", background: "linear-gradient(160deg, rgba(30,27,58,.7), rgba(16,14,32,.7))", border: "1px solid rgba(139,92,246,.2)" }}>
                            <div style={{ fontSize: 30, marginBottom: 6 }}>{st.icon}</div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa" }}>{st.no <= 5 ? "STEP " + st.no : "GOAL"}</div>
                            <div style={{ fontSize: 11.5, color: "#c2b8ee", margin: "2px 0 8px", lineHeight: 1.3, minHeight: 30 }}>{st.title}</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: "#f9fafb" }}>{cnt}<span style={{ fontSize: 12, color: "#8b8fa8", fontWeight: 700 }}>名</span></div>
                            <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,.08)", marginTop: 8, overflow: "hidden" }}>
                                <div style={{ width: rate + "%", height: "100%", background: "linear-gradient(90deg, #a78bfa, #7c5cf0)" }} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 承認セクション */}
            <div style={{ fontSize: 13, fontWeight: 800, color: "#c4b5fd", marginBottom: 12, letterSpacing: 1 }}>参加報告の承認</div>
            {pending.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#fbbf24", marginBottom: 10 }}>⏳ 承認待ち（{pending.length}）</div>
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
