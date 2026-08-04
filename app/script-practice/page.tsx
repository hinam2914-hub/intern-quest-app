"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Progress = {
    id: string; user_id: string;
    test1_passed: boolean; test2_passed: boolean; test3_passed: boolean;
};
type Report = {
    id: string; user_id: string; day_no: number; practice_type: string;
    content: string; minutes: number | null; created_at: string;
};

// 7日間の練習プラン
const DAY_PLAN = [
    { day: 1, type: "self", icon: "🗣️", label: "セルフ練習", desc: "スクリプトを音読して体に入れる" },
    { day: 2, type: "self", icon: "🗣️", label: "セルフ練習", desc: "つまらず最後まで言えるように" },
    { day: 3, type: "self", icon: "🗣️", label: "セルフ練習", desc: "感情を乗せて自然に話す" },
    { day: 4, type: "phone", icon: "📞", label: "電話練習", desc: "先輩と電話でロープレ" },
    { day: 5, type: "self", icon: "🗣️", label: "セルフ練習", desc: "電話練習の指摘を反映" },
    { day: 6, type: "mock", icon: "🎭", label: "模擬練習", desc: "本番想定の通しロープレ" },
    { day: 7, type: "test", icon: "🏆", label: "テスト挑戦", desc: "テスト①②③に挑戦！" },
];
const TYPE_LABEL: Record<string, string> = { self: "🗣️ セルフ練習", phone: "📞 電話練習", mock: "🎭 模擬練習", test: "🏆 テスト" };

export default function ScriptPracticePage() {
    const router = useRouter();
    const [userId, setUserId] = useState("");
    const [progress, setProgress] = useState<Progress | null>(null);
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [pType, setPType] = useState("self");
    const [content, setContent] = useState("");
    const [minutes, setMinutes] = useState("");
    const [sending, setSending] = useState(false);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const [{ data: prog }, { data: reps }] = await Promise.all([
                supabase.from("script_test_progress").select("*").eq("user_id", user.id).maybeSingle(),
                supabase.from("practice_reports").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
            ]);
            setProgress(prog as Progress | null);
            setReports((reps || []) as Report[]);
            setLoading(false);
        };
        load();
    }, [router]);

    const currentDay = Math.min(reports.length + 1, 99);
    const todayPlan = DAY_PLAN[Math.min(currentDay - 1, DAY_PLAN.length - 1)];

    const submit = async () => {
        if (!content.trim()) { setMsg("練習内容を入力してください"); return; }
        setSending(true);
        // 初回報告時に進捗レコードを作成
        if (!progress) {
            const { data: created } = await supabase.from("script_test_progress")
                .insert({ user_id: userId }).select().single();
            setProgress(created as Progress);
        }
        await supabase.from("practice_reports").insert({
            user_id: userId,
            day_no: currentDay,
            practice_type: pType,
            content: content.trim(),
            minutes: minutes ? parseInt(minutes) : null,
        });
        const { data: reps } = await supabase.from("practice_reports").select("*").eq("user_id", userId).order("created_at", { ascending: false });
        setReports((reps || []) as Report[]);
        setContent(""); setMinutes(""); setShowForm(false); setSending(false);
        setMsg("✅ 練習を記録しました！");
        setTimeout(() => setMsg(""), 3000);
    };

    if (loading) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
        </main>
    );

    const tests = [
        { key: "test1", no: "①", name: "3分スクリプト", passed: progress?.test1_passed },
        { key: "test2", no: "②", name: "5分スクリプト", passed: progress?.test2_passed },
        { key: "test3", no: "③", name: "バインダー対面", passed: progress?.test3_passed },
    ];
    const passedCount = tests.filter(t => t.passed).length;

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 20px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 50% 20%, rgba(139,92,246,0.1) 0%, transparent 55%)", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "relative", zIndex: 1, maxWidth: 860, margin: "0 auto" }}>

                {/* ヘッダー */}
                <div style={{ marginBottom: 20 }}>
                    <div onClick={() => router.push("/home")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>🎤 スクリプト練習クエスト</h1>
                    <p style={{ color: "#9ca3af", fontSize: 13, margin: "8px 0 0" }}>7日間の練習でテスト合格を目指そう！</p>
                </div>

                {msg && <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(52,211,153,.1)", border: "1px solid rgba(52,211,153,.3)", color: "#34d399", fontSize: 13, fontWeight: 700 }}>{msg}</div>}

                {/* ===== ヒーローカード（今日の練習）＋ テスト状況 ===== */}
                <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>

                    {/* 今日の練習：主役カード（夜空グラデ） */}
                    <div style={{ flex: "1 1 400px", borderRadius: 20, padding: "24px 24px 22px", position: "relative", overflow: "hidden", background: "linear-gradient(150deg, #2a1b57 0%, #1a1240 45%, #0f0b28 100%)", border: "1.5px solid rgba(139,92,246,.55)", boxShadow: "0 8px 40px rgba(99,74,214,.28)" }}>
                        {/* 星のきらめき */}
                        <div style={{ position: "absolute", top: 14, right: 90, fontSize: 12, opacity: .8 }}>✦</div>
                        <div style={{ position: "absolute", top: 40, right: 40, fontSize: 9, opacity: .5 }}>✦</div>
                        <div style={{ position: "absolute", top: 70, right: 140, fontSize: 10, opacity: .6 }}>⭐</div>
                        <div style={{ position: "absolute", bottom: 70, left: 16, fontSize: 10, opacity: .35 }}>🌲</div>
                        <div style={{ position: "absolute", bottom: 66, right: 12, fontSize: 12, opacity: .35 }}>🌲</div>

                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 999, background: "rgba(255,215,0,.14)", border: "1px solid rgba(255,215,0,.4)", marginBottom: 12 }}>
                            <span style={{ fontSize: 11 }}>⭐</span>
                            <span style={{ fontSize: 11, fontWeight: 900, color: "#ffd76a", letterSpacing: 1 }}>今日の練習</span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", lineHeight: 1.2 }}>Day {currentDay}　{todayPlan.label}</div>
                                <div style={{ fontSize: 13.5, color: "#c2b8ee", marginTop: 8 }}>{todayPlan.desc}</div>
                            </div>
                            {/* 吹き出し＋キャラ */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ background: "rgba(255,255,255,.95)", color: "#4a3d8f", fontSize: 11.5, fontWeight: 800, padding: "8px 12px", borderRadius: 14, borderBottomRightRadius: 3, whiteSpace: "nowrap" }}>よし！今日も<br />がんばろう〜！</div>
                                <div style={{ fontSize: 40 }}>{todayPlan.icon}</div>
                            </div>
                        </div>

                        {!showForm ? (
                            <button onClick={() => { setPType(todayPlan.type === "test" ? "mock" : todayPlan.type); setShowForm(true); }}
                                style={{ width: "100%", marginTop: 18, padding: "15px", borderRadius: 999, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #a78bfa, #7c5cf0)", color: "#fff", fontSize: 15, fontWeight: 900, boxShadow: "0 6px 22px rgba(139,92,246,.5)", letterSpacing: 1 }}>
                                ✍️ 今日の練習を報告する
                            </button>
                        ) : (
                            <div style={{ marginTop: 18 }}>
                                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                                    {Object.entries(TYPE_LABEL).map(([k, v]) => (
                                        <button key={k} onClick={() => setPType(k)}
                                            style={{ padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", background: pType === k ? "rgba(167,139,250,.3)" : "rgba(255,255,255,.06)", border: `1px solid ${pType === k ? "#a78bfa" : "rgba(255,255,255,.14)"}`, color: pType === k ? "#e4dcff" : "#a79fd0" }}>
                                            {v}
                                        </button>
                                    ))}
                                </div>
                                <textarea value={content} onChange={(e) => setContent(e.target.value)}
                                    placeholder="今日の練習内容・気づき・詰まったところなど"
                                    style={{ width: "100%", height: 100, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,.16)", background: "rgba(255,255,255,.07)", color: "#fff", fontSize: 14, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 10 }} />
                                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
                                    <input value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ""))} placeholder="練習時間"
                                        style={{ width: 110, padding: "10px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,.16)", background: "rgba(255,255,255,.07)", color: "#fff", fontSize: 13, outline: "none" }} />
                                    <span style={{ fontSize: 12, color: "#a79fd0" }}>分（任意）</span>
                                </div>
                                <div style={{ display: "flex", gap: 10 }}>
                                    <button onClick={() => { setShowForm(false); setContent(""); setMinutes(""); }} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.16)", background: "rgba(255,255,255,.06)", color: "#a79fd0", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>キャンセル</button>
                                    <button onClick={submit} disabled={sending} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: sending ? "rgba(139,92,246,.4)" : "linear-gradient(135deg, #a78bfa, #7c5cf0)", color: "#fff", fontWeight: 900, cursor: sending ? "not-allowed" : "pointer", fontSize: 13 }}>
                                        {sending ? "記録中..." : "🎤 報告する"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* テスト合格状況（サイド） */}
                    <div style={{ flex: "1 1 240px", minWidth: 240, borderRadius: 18, padding: "18px 18px 14px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(139,92,246,.3)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <span style={{ fontSize: 13, fontWeight: 900, color: "#a78bfa" }}>🏆 テスト合格状況</span>
                            <span style={{ fontSize: 13, fontWeight: 900, color: "#ffd76a" }}>{passedCount}/3</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {tests.map(t => (
                                <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: 12, background: t.passed ? "rgba(52,211,153,.09)" : "rgba(0,0,0,.3)", border: `1px solid ${t.passed ? "rgba(52,211,153,.35)" : "rgba(255,255,255,.07)"}` }}>
                                    <span style={{ fontSize: 15 }}>🎯</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 12.5, fontWeight: 800, color: t.passed ? "#34d399" : "#c7c9dd" }}>テスト{t.no}</div>
                                        <div style={{ fontSize: 11, color: t.passed ? "#34d399" : "#8b8fa8" }}>{t.name}</div>
                                    </div>
                                    <span style={{ fontSize: 14 }}>{t.passed ? "🏅" : "🔒"}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ fontSize: 10.5, color: "#6b7280", marginTop: 10 }}>※テストの合格判定はメンター・管理者が行います</div>
                    </div>
                </div>

                {/* ===== 7日間のクエストマップ（すごろく） ===== */}
                <div style={{ marginBottom: 26 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8b8fa8", letterSpacing: 2, marginBottom: 14 }}>🗺️ 7日間のクエストマップ</div>
                    <div style={{ borderRadius: 20, padding: "22px 16px 18px", background: "linear-gradient(160deg, rgba(26,18,64,.6), rgba(10,10,20,.8))", border: "1px solid rgba(139,92,246,.25)", overflowX: "auto" }}>
                        {/* すごろくノード列 */}
                        <div style={{ display: "flex", alignItems: "flex-start", minWidth: 620 }}>
                            {/* START旗 */}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 52, flexShrink: 0, paddingTop: 12 }}>
                                <span style={{ fontSize: 18 }}>🚩</span>
                                <span style={{ fontSize: 9, fontWeight: 900, color: "#ffd76a", letterSpacing: 1, marginTop: 2 }}>START</span>
                            </div>
                            {DAY_PLAN.map((d, i) => {
                                const done = currentDay > d.day;
                                const isToday = currentDay === d.day;
                                return (
                                    <div key={d.day} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                                        {/* 道 */}
                                        <div style={{ flex: 1, height: 4, borderRadius: 99, background: done ? "linear-gradient(90deg, #34d399, #34d39988)" : "rgba(255,255,255,.1)", minWidth: 10, marginTop: 26 }} />
                                        {/* ノード */}
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 66, flexShrink: 0 }}>
                                            <div style={{
                                                width: isToday ? 54 : 46, height: isToday ? 54 : 46, borderRadius: "50%",
                                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: isToday ? 22 : 18,
                                                background: done ? "rgba(52,211,153,.15)" : isToday ? "radial-gradient(circle, rgba(167,139,250,.4), rgba(124,92,240,.2))" : "rgba(255,255,255,.05)",
                                                border: `2px solid ${done ? "#34d399" : isToday ? "#a78bfa" : "rgba(255,255,255,.14)"}`,
                                                boxShadow: isToday ? "0 0 20px rgba(167,139,250,.65)" : "none",
                                                opacity: !done && !isToday ? .55 : 1,
                                            }}>
                                                {done ? "✅" : d.icon}
                                            </div>
                                            <div style={{ fontSize: 10.5, fontWeight: 900, color: done ? "#34d399" : isToday ? "#e4dcff" : "#8b8fa8", marginTop: 6, whiteSpace: "nowrap" }}>Day {d.day}</div>
                                            <div style={{ fontSize: 9.5, color: done ? "#34d399" : isToday ? "#c2b8ee" : "#6b7280", whiteSpace: "nowrap" }}>{d.label}</div>
                                            {isToday && <div style={{ marginTop: 4, fontSize: 9, fontWeight: 900, color: "#fff", background: "#7c5cf0", borderRadius: 999, padding: "2px 10px" }}>今日</div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* ボスゲート（テスト①②③） */}
                        <div style={{ display: "flex", gap: 12, marginTop: 22, flexWrap: "wrap" }}>
                            {tests.map(t => (
                                <div key={t.key} style={{
                                    flex: "1 1 160px", borderRadius: 16, padding: "16px 14px", textAlign: "center", position: "relative", overflow: "hidden",
                                    background: t.passed
                                        ? "linear-gradient(160deg, rgba(52,211,153,.16), rgba(10,25,18,.6))"
                                        : "linear-gradient(160deg, rgba(76,42,140,.45), rgba(20,12,40,.85))",
                                    border: `1.5px solid ${t.passed ? "rgba(52,211,153,.5)" : "rgba(139,92,246,.5)"}`,
                                    boxShadow: t.passed ? "0 0 18px rgba(52,211,153,.15)" : "0 0 18px rgba(99,74,214,.2)",
                                }}>
                                    <div style={{ position: "absolute", top: 8, left: 10, fontSize: 10, opacity: .5 }}>🏮</div>
                                    <div style={{ position: "absolute", top: 8, right: 10, fontSize: 10, opacity: .5 }}>🏮</div>
                                    <div style={{ fontSize: 26, marginBottom: 4 }}>{t.passed ? "🏆" : "💎"}</div>
                                    <div style={{ fontSize: 13, fontWeight: 900, color: t.passed ? "#34d399" : "#e4dcff" }}>テスト{t.no}</div>
                                    <div style={{ fontSize: 11, color: t.passed ? "#34d399" : "#a79fd0", marginTop: 2 }}>{t.name}</div>
                                    <div style={{ marginTop: 8, display: "inline-block", fontSize: 10, fontWeight: 900, padding: "3px 12px", borderRadius: 999, background: t.passed ? "rgba(52,211,153,.18)" : "rgba(0,0,0,.35)", border: `1px solid ${t.passed ? "rgba(52,211,153,.4)" : "rgba(255,255,255,.14)"}`, color: t.passed ? "#34d399" : "#ffd76a" }}>
                                        {t.passed ? "🎉 突破！" : "関門突破で 💎 GET！"}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ===== 練習の記録 ===== */}
                <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8b8fa8", letterSpacing: 2, marginBottom: 12 }}>📜 練習の記録（{reports.length}件）</div>
                    {reports.length === 0 ? (
                        <div style={{ fontSize: 13, color: "#6b7280", padding: "16px 0", textAlign: "center" }}>まだ記録がありません。今日から始めよう！</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {reports.map(r => (
                                <div key={r.id} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "12px 16px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                        <span style={{ fontSize: 11, fontWeight: 900, color: "#a78bfa" }}>Day {r.day_no}</span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: "#c7c9dd" }}>{TYPE_LABEL[r.practice_type] || r.practice_type}</span>
                                        {r.minutes && <span style={{ fontSize: 11, color: "#6b7280" }}>⏱ {r.minutes}分</span>}
                                        <span style={{ marginLeft: "auto", fontSize: 11, color: "#6b7280" }}>{new Date(r.created_at).toLocaleDateString("ja-JP")}</span>
                                    </div>
                                    <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{r.content}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* メニューへ戻る */}
                <div style={{ display: "flex", justifyContent: "center", marginTop: 44 }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>
                        メニューへ戻る
                    </button>
                </div>
            </div>
        </main>
    );
}
