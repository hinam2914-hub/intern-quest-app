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

// STEP色分け: 1緑 2青 3紫 4オレンジ 5金
const STEP_COLOR: Record<number, { fg: string; bg: string; bd: string }> = {
    1: { fg: "#34d399", bg: "rgba(52,211,153,.12)", bd: "rgba(52,211,153,.35)" },
    2: { fg: "#60a5fa", bg: "rgba(96,165,250,.12)", bd: "rgba(96,165,250,.35)" },
    3: { fg: "#a78bfa", bg: "rgba(167,139,250,.12)", bd: "rgba(167,139,250,.35)" },
    4: { fg: "#fb923c", bg: "rgba(251,146,60,.12)", bd: "rgba(251,146,60,.35)" },
    5: { fg: "#fbbf24", bg: "rgba(251,191,36,.12)", bd: "rgba(251,191,36,.35)" },
};

// 提出タイプアイコン
const stepIcon = (n: number) => n === 1 ? "🏘️" : n === 2 ? "📚" : n === 3 ? "🎁" : n === 4 ? "📞" : "🤝";

const STEPS = [
    { no: 1, icon: "🏘️", title: "入社・スラック研修" },
    { no: 2, icon: "⛩️", title: "登竜門キックオフ" },
    { no: 3, icon: "🔮", title: "プレイヤー昇格" },
    { no: 4, icon: "📨", title: "DRMスタート" },
    { no: 5, icon: "🏛️", title: "キャリア面談・配属" },
    { no: 6, icon: "🏆", title: "営業デビュー" },
];

// 経過時間の表示（🟢新しい 🟡数時間 🔴3日以上）
function timeAgo(iso: string): { label: string; color: string } {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 60) return { label: min <= 1 ? "たった今" : min + "分前", color: "#34d399" };
    const hr = Math.floor(min / 60);
    if (hr < 24) return { label: hr + "時間前", color: "#fbbf24" };
    const day = Math.floor(hr / 24);
    return { label: day + "日前", color: day >= 3 ? "#ef4444" : "#fbbf24" };
}

type Filter = "all" | "pending" | "approved" | 1 | 2 | 3 | 4 | 5;

export default function JourneyTab() {
    const [subs, setSubs] = useState<Sub[]>([]);
    const [totalInterns, setTotalInterns] = useState(0);
    const [doneByStep, setDoneByStep] = useState<Record<number, number>>({});
    const [loading, setLoading] = useState(true);
    const [showApproved, setShowApproved] = useState(false);
    const [filter, setFilter] = useState<Filter>("all");
    const [menuOpen, setMenuOpen] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        const [{ data: subRows }, { data: userRows }] = await Promise.all([
            supabase.from("journey_submissions").select("id, user_id, step_no, status, scheduled_date, review, created_at, mtg_date, event_date, mtg_attended, event_no_cancel").in("step_no", [1, 2, 3, 4, 5]).order("created_at", { ascending: false }),
            supabase.from("profiles").select("id, name").eq("is_active", true),
        ]);
        const nameMap: Record<string, string> = {};
        (userRows || []).forEach((u: any) => { nameMap[u.id] = u.name; });
        setSubs(((subRows || []).map((s: any) => ({ ...s, name: nameMap[s.user_id] || "(不明)" }))) as Sub[]);
        setTotalInterns((userRows || []).length);
        const maxApproved: Record<string, number> = {};
        (subRows || []).forEach((s: any) => {
            if (s.status === "approved") maxApproved[s.user_id] = Math.max(maxApproved[s.user_id] || 0, s.step_no);
        });
        const d: Record<number, number> = {};
        for (let st = 1; st <= 5; st++) d[st] = Object.values(maxApproved).filter((m) => m >= st).length;
        setDoneByStep(d);
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
        setMenuOpen(null);
        if (!confirm(s.name + " さんの「" + STEP_LABEL[s.step_no] + "」の承認を取り消しますか？")) return;
        const { error } = await supabase.from("journey_submissions").update({ status: "pending" }).eq("id", s.id);
        if (error) { alert("取り消しに失敗: " + error.message); return; }
        await load();
    };

    if (loading) return <div style={{ padding: 40, color: "#8b8fa8" }}>集計中...</div>;

    const pending = subs.filter(s => s.status === "pending");
    const approved = subs.filter(s => s.status === "approved");

    const doneAll = doneByStep[5] || 0;
    const inProgress = new Set(subs.map(s => s.user_id)).size;
    const step3reach = doneByStep[3] || 0;
    const completeRate = totalInterns > 0 ? Math.round((doneAll / totalInterns) * 100) : 0;

    const applyFilter = (list: Sub[]) => {
        if (filter === "all") return list;
        if (filter === "pending") return list.filter(s => s.status === "pending");
        if (filter === "approved") return list.filter(s => s.status === "approved");
        return list.filter(s => s.step_no === filter);
    };

    const kpiCard = (label: string, value: string, sub: string, accent: string) => (
        <div style={{ flex: "1 1 180px", padding: "20px 22px", borderRadius: 24, background: "linear-gradient(145deg, rgba(139,92,246,.18), rgba(30,27,58,.6))", border: "1px solid rgba(167,139,250,.25)", boxShadow: "0 4px 24px rgba(139,92,246,.15)", backdropFilter: "blur(8px)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: accent, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, color: "#8b8fa8", marginTop: 6 }}>{sub}</div>
        </div>
    );

    const feedCard = (s: Sub) => {
        const c = STEP_COLOR[s.step_no];
        const t = timeAgo(s.created_at);
        return (
            <div key={s.id} style={{ padding: "18px 20px", borderRadius: 24, background: "linear-gradient(160deg, rgba(30,27,58,.75), rgba(14,12,28,.75))", border: "1px solid rgba(139,92,246,.18)", boxShadow: "0 4px 18px rgba(0,0,0,.25)", marginBottom: 16, backdropFilter: "blur(6px)" }}>
                {/* ヘッダー行 */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, background: c.bg, border: "2px solid " + c.bd, flexShrink: 0 }}>{stepIcon(s.step_no)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: "#f9fafb" }}>{s.name}</span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: c.fg, background: c.bg, border: "1px solid " + c.bd, padding: "2px 10px", borderRadius: 999 }}>{STEP_LABEL[s.step_no]}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3, fontSize: 11.5, color: "#8b8fa8", flexWrap: "wrap" }}>
                            <span style={{ color: t.color, fontWeight: 700 }}>● {t.label}</span>
                            {s.scheduled_date && <span>📅 {s.scheduled_date}</span>}
                            {s.step_no === 3 && s.mtg_date && <span>🗣 MTG {s.mtg_date}</span>}
                            {s.step_no === 3 && s.event_date && <span>🎪 {s.event_date}</span>}
                        </div>
                    </div>
                    {/* 右アクション */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, position: "relative" }}>
                        <button onClick={() => alert("コメント機能は準備中です")} style={{ padding: "7px 14px", borderRadius: 999, border: "1px solid rgba(167,139,250,.35)", cursor: "pointer", background: "transparent", color: "#a78bfa", fontSize: 12, fontWeight: 800 }}>💬</button>
                        {s.status === "pending"
                            ? <button onClick={() => approve(s)} style={{ padding: "8px 18px", borderRadius: 999, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #34d399, #10b981)", color: "#fff", fontSize: 12.5, fontWeight: 800, boxShadow: "0 2px 12px rgba(52,211,153,.35)" }}>✔ 承認</button>
                            : <span style={{ fontSize: 12, fontWeight: 800, color: "#34d399" }}>✔ 承認済み</span>}
                        <button onClick={() => setMenuOpen(menuOpen === s.id ? null : s.id)} style={{ padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer", background: "transparent", color: "#8b8fa8", fontSize: 16, fontWeight: 900 }}>⋯</button>
                        {menuOpen === s.id && (
                            <div style={{ position: "absolute", top: "110%", right: 0, zIndex: 10, background: "#1a1830", border: "1px solid rgba(139,92,246,.3)", borderRadius: 12, padding: 6, boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}>
                                {s.status === "approved" && <button onClick={() => revoke(s)} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", background: "transparent", color: "#f87171", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>承認を取り消す</button>}
                                <button onClick={() => { setMenuOpen(null); alert("詳細画面は準備中です"); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", background: "transparent", color: "#c2b8ee", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>👀 詳細</button>
                            </div>
                        )}
                    </div>
                </div>
                {/* 提出内容 */}
                {s.review && <div style={{ fontSize: 13, color: "#c2b8ee", lineHeight: 1.7, whiteSpace: "pre-wrap", padding: "12px 14px", borderRadius: 14, background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.04)" }}>{s.review}</div>}
            </div>
        );
    };

    const chip = (label: string, val: Filter) => (
        <button key={String(val)} onClick={() => setFilter(val)} style={{ padding: "7px 16px", borderRadius: 999, border: filter === val ? "1px solid rgba(167,139,250,.6)" : "1px solid rgba(255,255,255,.1)", cursor: "pointer", background: filter === val ? "rgba(139,92,246,.25)" : "rgba(255,255,255,.03)", color: filter === val ? "#e5e0ff" : "#8b8fa8", fontSize: 12.5, fontWeight: 800 }}>{label}</button>
    );

    const filteredPending = applyFilter(pending);
    const filteredApproved = applyFilter(approved);

    return (
        <div style={{ padding: "8px 0" }}>
            <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: "#f9fafb", margin: "0 0 4px" }}>🗺️ 冒険マップ 司令室</h2>
                <p style={{ fontSize: 13, color: "#8b8fa8", margin: 0 }}>インターン全員の成長ログをリアルタイムで管理</p>
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
                {kpiCard("全体完了率", completeRate + "%", "STEP5到達 " + doneAll + " / " + totalInterns + "名", "#a78bfa")}
                {kpiCard("進行中インターン", inProgress + "名", "冒険マップ開始済み", "#818cf8")}
                {kpiCard("STEP3到達", step3reach + "名", "プレイヤー昇格以上", "#34d399")}
                {kpiCard("営業デビュー", doneAll + "名", "キャリア面談まで完了", "#fbbf24")}
            </div>

            <div style={{ fontSize: 13, fontWeight: 800, color: "#c4b5fd", marginBottom: 12, letterSpacing: 1 }}>ステップ別 到達状況</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
                {STEPS.map((st) => {
                    const cnt = st.no <= 5 ? (doneByStep[st.no] || 0) : (doneByStep[5] || 0);
                    const rate = totalInterns > 0 ? Math.round((cnt / totalInterns) * 100) : 0;
                    return (
                        <div key={st.no} style={{ flex: "1 1 140px", minWidth: 130, padding: "16px 14px", borderRadius: 20, textAlign: "center", background: "linear-gradient(160deg, rgba(30,27,58,.7), rgba(16,14,32,.7))", border: "1px solid rgba(139,92,246,.2)" }}>
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

            {/* フィルター */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                {chip("すべて", "all")}
                {chip("⏳ 承認待ち", "pending")}
                {chip("✔ 承認済み", "approved")}
                {chip("STEP1", 1)}
                {chip("STEP2", 2)}
                {chip("STEP3", 3)}
                {chip("STEP4", 4)}
                {chip("STEP5", 5)}
            </div>

            {/* 活動フィード：承認待ち優先 */}
            {filteredPending.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#fbbf24", marginBottom: 12 }}>🟡 承認待ち（{filteredPending.length}）</div>
                    {filteredPending.map(feedCard)}
                </div>
            )}
            {filteredPending.length === 0 && filter !== "approved" && (
                <div style={{ padding: "18px 20px", borderRadius: 16, background: "rgba(52,211,153,.06)", border: "1px solid rgba(52,211,153,.2)", color: "#34d399", fontSize: 13, fontWeight: 700, marginBottom: 24 }}>✔ 承認待ちはありません</div>
            )}

            {/* 承認済み（折りたたみ） */}
            <div>
                <button onClick={() => setShowApproved(!showApproved)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,.08)", cursor: "pointer", background: "rgba(255,255,255,.03)", color: "#8b8fa8", fontSize: 13, fontWeight: 800, marginBottom: 14 }}>
                    <span style={{ color: "#34d399" }}>✔ 承認済み</span>
                    <span>{showApproved ? "▲" : "▼"} {filteredApproved.length}件</span>
                </button>
                {showApproved && (filteredApproved.length === 0 ? <div style={{ fontSize: 13, color: "#6b7280" }}>まだありません</div> : filteredApproved.map(feedCard))}
            </div>
        </div>
    );
}
