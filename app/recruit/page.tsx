"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

// ポイント設計（後で変更可）
const PT = { dm: 3, mentsuna: 15, interview: 30, hire: 100 };
const DM_UNIT = 10; // DMは10通ごとに +3pt

type Progress = { action_type: string; count: number; points: number };
type RankRow = { user_id: string; name: string; total: number };
type Req = { id: string; requester_id: string; requester_name: string | null; candidate_note: string | null; status: string; assignee_id: string | null; assignee_name: string | null; created_at: string };

export default function RecruitPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState("");
    const [userName, setUserName] = useState("");
    const [myStats, setMyStats] = useState({ dm: 0, mentsuna: 0, interview: 0, hire: 0, points: 0, pending: 0 });
    const [ranking, setRanking] = useState<RankRow[]>([]);
    const [requests, setRequests] = useState<Req[]>([]);
    const [dmInput, setDmInput] = useState(10);
    const [candNote, setCandNote] = useState("");
    const [showReqForm, setShowReqForm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState("");

    const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2400); };

    const loadAll = useCallback(async (uid: string) => {
        // 自分の集計
        const { data: mine } = await supabase.from("recruit_progress").select("action_type, count, points, status").eq("user_id", uid);
        const agg = { dm: 0, mentsuna: 0, interview: 0, hire: 0, points: 0, pending: 0 };
        (mine as (Progress & { status: string })[] || []).forEach(r => {
            if (r.status === "pending") { agg.pending += 1; return; }
            if (r.status === "rejected") return;
            if (r.action_type === "dm") agg.dm += r.count;
            if (r.action_type === "mentsuna") agg.mentsuna += r.count;
            if (r.action_type === "interview") agg.interview += r.count;
            if (r.action_type === "hire") agg.hire += r.count;
            agg.points += r.points;
        });
        setMyStats(agg);

        // ランキング（recruit_progressのpoints合計をユーザーごとに）
        const { data: all } = await supabase.from("recruit_progress").select("user_id, points, status").eq("status", "approved");
        const map: Record<string, number> = {};
        (all as { user_id: string; points: number }[] || []).forEach(r => { map[r.user_id] = (map[r.user_id] || 0) + r.points; });
        const ids = Object.keys(map);
        let names: Record<string, string> = {};
        if (ids.length > 0) {
            const { data: profs } = await supabase.from("profiles").select("id, name").in("id", ids);
            (profs as { id: string; name: string }[] || []).forEach(p => { names[p.id] = p.name; });
        }
        const rank = ids.map(id => ({ user_id: id, name: names[id] || "名無し", total: map[id] })).sort((a, b) => b.total - a.total).slice(0, 20);
        setRanking(rank);

        // 面談官募集（openを上に、新しい順）
        const { data: reqs } = await supabase.from("interview_requests").select("*").order("created_at", { ascending: false }).limit(50);
        setRequests((reqs as Req[]) || []);
    }, []);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const { data: prof } = await supabase.from("profiles").select("name").eq("id", user.id).single();
            setUserName((prof as any)?.name || "");
            await loadAll(user.id);
            setLoading(false);
        };
        init();
    }, [router, loadAll]);

    // DMは即付与
    const awardNow = async (actionType: string, count: number, points: number, note?: string) => {
        if (busy) return;
        setBusy(true);
        try {
            await supabase.from("recruit_progress").insert([{ user_id: userId, action_type: actionType, count, points, note: note || null, status: "approved" }]);
            const { data: pr } = await supabase.from("user_points").select("points").eq("id", userId).single();
            const cur = (pr as any)?.points || 0;
            await supabase.from("user_points").update({ points: cur + points }).eq("id", userId);
            await supabase.from("points_history").insert([{ user_id: userId, change: points, reason: `recruit_${actionType}` }]);
            flash(`+${points}pt 獲得！`);
            await loadAll(userId);
        } catch (e) { flash("エラーが発生しました"); }
        setBusy(false);
    };
    // メンツナ以降は申請（pending）
    const requestApproval = async (actionType: string, count: number, points: number, note?: string) => {
        if (busy) return;
        setBusy(true);
        try {
            await supabase.from("recruit_progress").insert([{ user_id: userId, action_type: actionType, count, points, note: note || null, status: "pending" }]);
            flash("申請しました！マネージャーの承認待ちです");
            await loadAll(userId);
        } catch (e) { flash("エラーが発生しました"); }
        setBusy(false);
    };

    const recordDM = () => {
        const units = Math.floor(dmInput / DM_UNIT);
        if (units < 1) { flash(`${DM_UNIT}通以上で記録できます`); return; }
        awardNow("dm", dmInput, units * PT.dm, `${dmInput}通 (LINE報告済み)`);
    };

    // 面談官募集を投稿
    const postRequest = async () => {
        if (!candNote.trim() || busy) return;
        setBusy(true);
        await supabase.from("interview_requests").insert([{ requester_id: userId, requester_name: userName, candidate_note: candNote.trim(), status: "open" }]);
        setCandNote(""); setShowReqForm(false);
        flash("面談官を募集しました！");
        await loadAll(userId);
        setBusy(false);
    };

    // 募集を引き受ける
    const acceptRequest = async (req: Req) => {
        if (busy) return;
        setBusy(true);
        await supabase.from("interview_requests").update({ status: "assigned", assignee_id: userId, assignee_name: userName, updated_at: new Date().toISOString() }).eq("id", req.id);
        flash("引き受けました！面談後に「面談実施」を記録してね");
        await loadAll(userId);
        setBusy(false);
    };

    // 募集を完了（面談実施 → 面談官が申請）
    const completeRequest = async (req: Req) => {
        if (busy) return;
        setBusy(true);
        await supabase.from("interview_requests").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", req.id);
        await requestApproval("interview", 1, PT.interview, "募集経由の面談実施");
        setBusy(false);
    };

    const card: React.CSSProperties = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.22)", borderRadius: 20, padding: 20, marginBottom: 16 };

    if (loading) return <div style={{ minHeight: "100vh", background: "#0b0b16", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b8ba7" }}>読み込み中...</div>;

    return (
        <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 30% 0%, #2a1a3e 0%, #0b0b16 55%)", padding: "26px 16px 90px" }}>
            <div style={{ maxWidth: 520, margin: "0 auto" }}>
                {/* ヘッダー */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                    <div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>🔥 HRキャンペーン</div>
                        <div style={{ fontSize: 12, color: "#c4b5fd", marginTop: 2 }}>採用で島を大きくしよう！</div>
                    </div>
                    <button onClick={() => router.push("/home")} style={{ border: "1px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.12)", borderRadius: 12, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#c4b5fd", cursor: "pointer" }}>🏝️ 島へ</button>
                </div>

                {/* 自分のスコア */}
                <div style={{ ...card, background: "linear-gradient(150deg, rgba(139,92,246,0.16), rgba(99,102,241,0.05))", border: "1px solid rgba(139,92,246,0.4)" }}>
                    <div style={{ fontSize: 11, color: "#c4b5fd", fontWeight: 800, letterSpacing: 2, marginBottom: 12 }}>あなたの採用スコア</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
                        {[
                            { label: "DM", value: myStats.dm, unit: "通" },
                            { label: "メンツナ", value: myStats.mentsuna, unit: "件" },
                            { label: "面談", value: myStats.interview, unit: "件" },
                            { label: "入社", value: myStats.hire, unit: "人" },
                        ].map((s, i) => (
                            <div key={i} style={{ textAlign: "center", padding: "10px 2px", borderRadius: 12, background: "rgba(255,255,255,0.05)" }}>
                                <div style={{ fontSize: 20, fontWeight: 900, color: "#e0d7ff" }}>{s.value}</div>
                                <div style={{ fontSize: 9.5, color: "#8b8ba7", fontWeight: 700, marginTop: 2 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ textAlign: "center", fontSize: 13, fontWeight: 800, color: "#fcd34d" }}>獲得ポイント {myStats.points.toLocaleString()}pt</div>
                    {myStats.pending > 0 && <div style={{ textAlign: "center", fontSize: 11.5, fontWeight: 700, color: "#fbbf24", marginTop: 6 }}>⏳ 承認待ち {myStats.pending}件</div>}
                </div>

                {/* アクション記録 */}
                <div style={card}>
                    <div style={{ fontSize: 11, color: "#8b8ba7", fontWeight: 800, letterSpacing: 2, marginBottom: 14 }}>アクションを記録</div>
                    {/* DM */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "12px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#e0d7ff" }}>📩 DM送信</div>
                            <div style={{ fontSize: 10.5, color: "#8b8ba7", marginTop: 2 }}>{DM_UNIT}通ごとに +{PT.dm}pt（LINE報告済み前提）</div>
                        </div>
                        <input type="number" value={dmInput} min={DM_UNIT} step={DM_UNIT} onChange={(e) => setDmInput(parseInt(e.target.value) || 0)} style={{ width: 64, padding: "8px", borderRadius: 8, border: "1px solid rgba(139,92,246,0.35)", background: "rgba(30,20,55,0.6)", color: "#fff", fontSize: 14, textAlign: "center" }} />
                        <button onClick={recordDM} disabled={busy} style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#8b5cf6,#7c3aed)", color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>記録</button>
                    </div>
                    {/* メンツナ / 面談 / 入社 */}
                    {[
                        { key: "mentsuna", icon: "🤝", label: "メンツナ（面談設定）", pt: PT.mentsuna },
                        { key: "interview", icon: "🎤", label: "面談を実施した", pt: PT.interview },
                        { key: "hire", icon: "🎉", label: "入社が決まった！", pt: PT.hire },
                    ].map((a) => (
                        <div key={a.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "12px", borderRadius: 12, background: a.key === "hire" ? "rgba(252,211,77,0.08)" : "rgba(255,255,255,0.03)", border: a.key === "hire" ? "1px solid rgba(252,211,77,0.3)" : "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 800, color: a.key === "hire" ? "#fcd34d" : "#e0d7ff" }}>{a.icon} {a.label}</div>
                                <div style={{ fontSize: 10.5, color: "#8b8ba7", marginTop: 2 }}>1件 +{a.pt}pt</div>
                            </div>
                            <button onClick={() => requestApproval(a.key, 1, a.pt, "自己申告")} disabled={busy} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: a.key === "hire" ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#8b5cf6,#7c3aed)", color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>申請 +{a.pt}</button>
                        </div>
                    ))}
                </div>

                {/* 面談官募集 */}
                <div style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: "#8b8ba7", fontWeight: 800, letterSpacing: 2 }}>📋 面談官の募集</div>
                        <button onClick={() => setShowReqForm(!showReqForm)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.15)", color: "#c4b5fd", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{showReqForm ? "閉じる" : "+ 募集する"}</button>
                    </div>
                    {showReqForm && (
                        <div style={{ marginBottom: 14, padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.03)" }}>
                            <div style={{ fontSize: 11.5, color: "#c4b5fd", marginBottom: 8 }}>候補者の情報（学年・雰囲気・志望など）を書いて、面談してくれる人を募集しよう</div>
                            <textarea value={candNote} onChange={(e) => setCandNote(e.target.value)} placeholder="例：大学2年・営業志望・9月から動ける子です" rows={3} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid rgba(139,92,246,0.35)", background: "rgba(30,20,55,0.6)", color: "#fff", fontSize: 13, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
                            <button onClick={postRequest} disabled={busy || !candNote.trim()} style={{ width: "100%", marginTop: 8, padding: "10px 0", borderRadius: 10, border: "none", background: candNote.trim() ? "linear-gradient(135deg,#8b5cf6,#7c3aed)" : "rgba(255,255,255,0.1)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: candNote.trim() ? "pointer" : "default" }}>募集を出す</button>
                        </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {requests.filter(r => r.status !== "done").length === 0 && <div style={{ fontSize: 12, color: "#6b6b85", textAlign: "center", padding: "12px 0" }}>現在募集中の案件はありません</div>}
                        {requests.filter(r => r.status !== "done").map((r) => (
                            <div key={r.id} style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "#e0d7ff", lineHeight: 1.5 }}>{r.candidate_note}</div>
                                        <div style={{ fontSize: 10.5, color: "#8b8ba7", marginTop: 4 }}>依頼: {r.requester_name || "?"}{r.status === "assigned" && ` ・ 面談官: ${r.assignee_name || "?"}`}</div>
                                    </div>
                                    {r.status === "open" && r.requester_id !== userId && (
                                        <button onClick={() => acceptRequest(r)} disabled={busy} style={{ padding: "7px 14px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#34d399,#10b981)", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>やります</button>
                                    )}
                                    {r.status === "open" && r.requester_id === userId && (
                                        <span style={{ fontSize: 11, color: "#fcd34d", fontWeight: 700, whiteSpace: "nowrap" }}>募集中</span>
                                    )}
                                    {r.status === "assigned" && r.assignee_id === userId && (
                                        <button onClick={() => completeRequest(r)} disabled={busy} style={{ padding: "7px 12px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", fontWeight: 800, fontSize: 11.5, cursor: "pointer", whiteSpace: "nowrap" }}>面談完了 +{PT.interview}</button>
                                    )}
                                    {r.status === "assigned" && r.assignee_id !== userId && (
                                        <span style={{ fontSize: 11, color: "#8b8ba7", fontWeight: 700, whiteSpace: "nowrap" }}>対応中</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ランキング */}
                <div style={card}>
                    <div style={{ fontSize: 11, color: "#8b8ba7", fontWeight: 800, letterSpacing: 2, marginBottom: 14 }}>🏆 採用ランキング</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {ranking.length === 0 && <div style={{ fontSize: 12, color: "#6b6b85" }}>まだ記録がありません。一番乗りを目指そう！</div>}
                        {ranking.map((r, i) => (
                            <div key={r.user_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: r.user_id === userId ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.025)", border: r.user_id === userId ? "1px solid rgba(139,92,246,0.4)" : "1px solid rgba(255,255,255,0.05)" }}>
                                <div style={{ fontSize: 14, fontWeight: 900, color: i < 3 ? "#fcd34d" : "#8b8ba7", width: 24 }}>{i + 1}</div>
                                <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#e0d7ff" }}>{r.name}{r.user_id === userId && " (あなた)"}</div>
                                <div style={{ fontSize: 13, fontWeight: 900, color: "#fcd34d" }}>{r.total.toLocaleString()}pt</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(30,20,55,0.95)", border: "1px solid rgba(139,92,246,0.5)", color: "#fff", padding: "12px 24px", borderRadius: 999, fontSize: 14, fontWeight: 800, zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>{toast}</div>}
        </div>
    );
}
