"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const PT = { dm: 3, mentsuna: 15, interview: 30, hire: 100 };
const DM_UNIT = 10;
const CAMPAIGN = { start: "", end: "", host: "人事部 採用チーム" };  // 日程が決まったら start/end に入れる
const RECRUIT_INFO = {
    job: "長期インターン（営業・企画・マーケなど）",
    place: "新宿オフィス / リモート可",
    type: "インターン",
    flow: "DM → カジュアル面談 → 面談 → 最終面談 → 内定",
};

type Progress = { action_type: string; count: number; points: number; status: string };
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
        const { data: mine } = await supabase.from("recruit_progress").select("action_type, count, points, status").eq("user_id", uid);
        const agg = { dm: 0, mentsuna: 0, interview: 0, hire: 0, points: 0, pending: 0 };
        (mine as Progress[] || []).forEach(r => {
            if (r.status === "pending") { agg.pending += 1; return; }
            if (r.status === "rejected") return;
            if (r.action_type === "dm") agg.dm += r.count;
            if (r.action_type === "mentsuna") agg.mentsuna += r.count;
            if (r.action_type === "interview") agg.interview += r.count;
            if (r.action_type === "hire") agg.hire += r.count;
            agg.points += r.points;
        });
        setMyStats(agg);

        const { data: all } = await supabase.from("recruit_progress").select("user_id, points, status").eq("status", "approved");
        const map: Record<string, number> = {};
        (all as { user_id: string; points: number }[] || []).forEach(r => { map[r.user_id] = (map[r.user_id] || 0) + r.points; });
        const ids = Object.keys(map);
        let names: Record<string, string> = {};
        if (ids.length > 0) {
            const { data: profs } = await supabase.from("profiles").select("id, name").in("id", ids);
            (profs as { id: string; name: string }[] || []).forEach(p => { names[p.id] = p.name; });
        }
        setRanking(ids.map(id => ({ user_id: id, name: names[id] || "名無し", total: map[id] })).sort((a, b) => b.total - a.total).slice(0, 20));

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
        } catch { flash("エラーが発生しました"); }
        setBusy(false);
    };
    const requestApproval = async (actionType: string, count: number, points: number, note?: string) => {
        if (busy) return;
        setBusy(true);
        try {
            await supabase.from("recruit_progress").insert([{ user_id: userId, action_type: actionType, count, points, note: note || null, status: "pending" }]);
            flash("申請しました！マネージャーの承認待ちです");
            await loadAll(userId);
        } catch { flash("エラーが発生しました"); }
        setBusy(false);
    };

    const recordDM = () => {
        const units = Math.floor(dmInput / DM_UNIT);
        if (units < 1) { flash(`${DM_UNIT}通以上で記録できます`); return; }
        awardNow("dm", dmInput, units * PT.dm, `${dmInput}通 (LINE報告済み)`);
    };

    const postRequest = async () => {
        if (!candNote.trim() || busy) return;
        setBusy(true);
        await supabase.from("interview_requests").insert([{ requester_id: userId, requester_name: userName, candidate_note: candNote.trim(), status: "open" }]);
        setCandNote(""); setShowReqForm(false);
        flash("面談官を募集しました！");
        await loadAll(userId);
        setBusy(false);
    };
    const acceptRequest = async (req: Req) => {
        if (busy) return;
        setBusy(true);
        await supabase.from("interview_requests").update({ status: "assigned", assignee_id: userId, assignee_name: userName, updated_at: new Date().toISOString() }).eq("id", req.id);
        flash("引き受けました！面談後に「面談完了」を押してね");
        await loadAll(userId);
        setBusy(false);
    };
    const completeRequest = async (req: Req) => {
        if (busy) return;
        setBusy(true);
        await supabase.from("interview_requests").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", req.id);
        await requestApproval("interview", 1, PT.interview, "募集経由の面談実施");
        setBusy(false);
    };

    // 明るい採用LP調のスタイル
    const CARD: React.CSSProperties = { background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 4px 20px rgba(30,41,80,.06)", border: "1px solid #eef1f7" };
    const SEC_TITLE: React.CSSProperties = { fontSize: 16, fontWeight: 900, color: "#1e2950", marginBottom: 4 };

    if (loading) return <div style={{ minHeight: "100vh", background: "#f4f6fb", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>読み込み中...</div>;

    const openReqs = requests.filter(r => r.status !== "done");

    return (
        <div style={{ minHeight: "100vh", background: "#f4f6fb", paddingBottom: 60 }}>
            {/* ===== ヒーローバナー ===== */}
            <div style={{ position: "relative", minHeight: 280, background: "linear-gradient(90deg, rgba(15,23,50,.15) 0%, rgba(15,23,50,.35) 45%, rgba(15,23,50,.9) 100%), url(/island/recruit_hero.png) center / cover no-repeat", padding: "28px 24px 32px", overflow: "hidden" }}>
                <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                        <button onClick={() => router.push("/menu")} style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.25)", color: "#fff", borderRadius: 10, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", backdropFilter: "blur(8px)" }}>← メニュー</button>
                        <button onClick={() => router.push("/home")} style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.25)", color: "#fff", borderRadius: 10, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", backdropFilter: "blur(8px)" }}>🏝️ 島へ戻る</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
                        <div>
                            <div style={{ fontSize: 34, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: 10 }}>🔥 HRキャンペーン</div>
                            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginTop: 6 }}>採用で島を大きくしよう！</div>
                            <div style={{ fontSize: 13, color: "rgba(255,255,255,.85)", marginTop: 10, lineHeight: 1.7, maxWidth: 480 }}>最高の仲間との出会いが、未来のチームをつくります。<br />積極的に採用活動を進めましょう！</div>
                            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                                <div style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 10, padding: "7px 14px", fontSize: 12.5, color: "#fff", fontWeight: 700, backdropFilter: "blur(8px)" }}>📅 {CAMPAIGN.start && CAMPAIGN.end ? `${CAMPAIGN.start} 〜 ${CAMPAIGN.end}` : "日程調整中"}</div>
                                <div style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 10, padding: "7px 14px", fontSize: 12.5, color: "#fff", fontWeight: 700, backdropFilter: "blur(8px)" }}>🏆 採用ランキング開催中！</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: 1200, margin: "-16px auto 0", padding: "0 20px", position: "relative", zIndex: 2, display: "flex", flexDirection: "column", gap: 18 }}>
                {/* ===== 採用スコアサマリー ===== */}
                <div style={CARD}>
                    <div style={SEC_TITLE}>あなたの採用スコア</div>
                    <div style={{ fontSize: 12, color: "#8a93a8", marginBottom: 18 }}>アクションでスコアを獲得しよう！{myStats.pending > 0 && <span style={{ color: "#f59e0b", fontWeight: 700 }}> ・ ⏳ 承認待ち {myStats.pending}件</span>}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
                        {[
                            { icon: "📩", label: "DM送信", value: myStats.dm, unit: "通", color: "#3b82f6" },
                            { icon: "🤝", label: "メンツナ", value: myStats.mentsuna, unit: "件", color: "#8b5cf6" },
                            { icon: "🎤", label: "面談", value: myStats.interview, unit: "件", color: "#ec4899" },
                            { icon: "🎉", label: "入社", value: myStats.hire, unit: "人", color: "#f59e0b" },
                            { icon: "⭐", label: "獲得pt", value: myStats.points, unit: "pt", color: "#10b981", highlight: true },
                        ].map((s, i) => (
                            <div key={i} style={{ textAlign: "center", padding: "16px 8px", borderRadius: 16, background: s.highlight ? "linear-gradient(160deg,#ecfdf5,#d1fae5)" : "#f8fafc", border: `1px solid ${s.highlight ? "#a7f3d0" : "#eef1f7"}` }}>
                                <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
                                <div style={{ fontSize: 26, fontWeight: 900, color: s.highlight ? "#059669" : "#1e2950", lineHeight: 1 }}>{s.value.toLocaleString()}</div>
                                <div style={{ fontSize: 11, color: "#8a93a8", fontWeight: 700, marginTop: 4 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ===== アクション記録 ===== */}
                <div style={CARD}>
                    <div style={SEC_TITLE}>アクションを記録してポイントを獲得しよう</div>
                    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                        {/* DM */}
                        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", borderRadius: 14, background: "#f8fafc", border: "1px solid #eef1f7" }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📩</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 15, fontWeight: 800, color: "#1e2950" }}>DM送信</div>
                                <div style={{ fontSize: 11.5, color: "#8a93a8", marginTop: 2 }}>{DM_UNIT}通ごとに +{PT.dm}pt（LINE報告済み前提）</div>
                            </div>
                            <input type="number" value={dmInput} min={DM_UNIT} step={DM_UNIT} onChange={(e) => setDmInput(parseInt(e.target.value) || 0)} style={{ width: 70, padding: "9px", borderRadius: 10, border: "1px solid #d5dbe8", background: "#fff", color: "#1e2950", fontSize: 15, textAlign: "center", fontWeight: 700 }} />
                            <button onClick={recordDM} disabled={busy} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>記録する</button>
                        </div>
                        {/* メンツナ/面談/入社 */}
                        {[
                            { key: "mentsuna", icon: "🤝", bg: "#ede9fe", label: "メンツナ（面談設定）", pt: PT.mentsuna },
                            { key: "interview", icon: "🎤", bg: "#fce7f3", label: "面談を実施した", pt: PT.interview },
                            { key: "hire", icon: "🎉", bg: "#fef3c7", label: "入社が決まった！", pt: PT.hire, gold: true },
                        ].map((a) => (
                            <div key={a.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", borderRadius: 14, background: a.gold ? "linear-gradient(120deg,#fffbeb,#fef3c7)" : "#f8fafc", border: `1px solid ${a.gold ? "#fde68a" : "#eef1f7"}` }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{a.icon}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: "#1e2950" }}>{a.label}</div>
                                    <div style={{ fontSize: 11.5, color: "#8a93a8", marginTop: 2 }}>1件ごとに +{a.pt}pt</div>
                                </div>
                                <button onClick={() => requestApproval(a.key, 1, a.pt, "自己申告")} disabled={busy} style={{ padding: "10px 18px", borderRadius: 10, border: a.gold ? "none" : "1.5px solid #c7cfe0", background: a.gold ? "linear-gradient(135deg,#f59e0b,#d97706)" : "#fff", color: a.gold ? "#fff" : "#4b5675", fontWeight: 800, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>申請する</button>
                                <div style={{ fontSize: 14, fontWeight: 900, color: a.gold ? "#d97706" : "#8b5cf6", whiteSpace: "nowrap" }}>+{a.pt}pt</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ===== 下段2カラム（おすすめ＋ランキング / 募集情報） ===== */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
                    {/* おすすめアクション */}
                    <div style={CARD}>
                        <div style={SEC_TITLE}>💡 おすすめアクション</div>
                        <div style={{ fontSize: 12, color: "#8a93a8", marginBottom: 14 }}>積極的に動くことで、採用成功に近づきます！</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                            {[
                                { icon: "📩", label: `DMを${DM_UNIT}通送る`, pt: PT.dm },
                                { icon: "🤝", label: "メンツナを設定する", pt: PT.mentsuna },
                                { icon: "🎤", label: "面談を実施する", pt: PT.interview },
                            ].map((a, i) => (
                                <div key={i} style={{ padding: "14px", borderRadius: 14, background: "#f8fafc", border: "1px solid #eef1f7", textAlign: "center" }}>
                                    <div style={{ fontSize: 22, marginBottom: 6 }}>{a.icon}</div>
                                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1e2950", lineHeight: 1.4 }}>{a.label}</div>
                                    <div style={{ fontSize: 13, fontWeight: 900, color: "#10b981", marginTop: 6 }}>+{a.pt}pt</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ランキング */}
                    <div style={CARD}>
                        <div style={SEC_TITLE}>🏆 採用ランキング</div>
                        <div style={{ fontSize: 12, color: "#8a93a8", marginBottom: 14 }}>社内の採用活動ランキング</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {ranking.length === 0 && <div style={{ fontSize: 12.5, color: "#8a93a8" }}>まだ記録がありません。一番乗りを目指そう！</div>}
                            {ranking.map((r, i) => (
                                <div key={r.user_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 12, background: r.user_id === userId ? "#eff6ff" : "#f8fafc", border: `1px solid ${r.user_id === userId ? "#bfdbfe" : "#eef1f7"}` }}>
                                    <div style={{ fontSize: 18, width: 28, textAlign: "center" }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span style={{ fontSize: 13, fontWeight: 800, color: "#8a93a8" }}>{i + 1}</span>}</div>
                                    <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#1e2950" }}>{r.name}{r.user_id === userId && " (あなた)"}</div>
                                    <div style={{ fontSize: 15, fontWeight: 900, color: "#1e2950" }}>{r.total.toLocaleString()}<span style={{ fontSize: 11, color: "#8a93a8" }}>pt</span></div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 面談官の案内 */}
                    <div style={CARD}>
                        <div style={SEC_TITLE}>🎤 面談官を募集中！</div>
                        <div style={{ fontSize: 13.5, color: "#4b5675", lineHeight: 1.9, marginTop: 10 }}>
                            採用面談をやってみたい人は、<span style={{ fontWeight: 800, color: "#1e2950" }}>人事まで連絡ください</span>。<br />
                            面談を実施すると <span style={{ color: "#10b981", fontWeight: 900 }}>+30pt</span> もらえます！
                        </div>
                    </div>
                </div>
            </div>

            {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1e2950", color: "#fff", padding: "12px 24px", borderRadius: 999, fontSize: 14, fontWeight: 800, zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>{toast}</div>}
        </div>
    );
}
