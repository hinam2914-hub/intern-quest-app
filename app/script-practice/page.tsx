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
        { key: "test1", label: "テスト① 3分スクリプト", passed: progress?.test1_passed },
        { key: "test2", label: "テスト② 5分スクリプト", passed: progress?.test2_passed },
        { key: "test3", label: "テスト③ バインダー対面", passed: progress?.test3_passed },
    ];
    const passedCount = tests.filter(t => t.passed).length;

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(139,92,246,0.08) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "relative", zIndex: 1, maxWidth: 760, margin: "0 auto" }}>

                {/* ヘッダー */}
                <div style={{ marginBottom: 22 }}>
                    <div onClick={() => router.push("/home")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>🎤 スクリプト練習クエスト</h1>
                    <p style={{ color: "#9ca3af", fontSize: 13, margin: "8px 0 0" }}>7日間の練習でテスト合格を目指そう！</p>
                </div>

                {msg && <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(52,211,153,.1)", border: "1px solid rgba(52,211,153,.3)", color: "#34d399", fontSize: 13, fontWeight: 700 }}>{msg}</div>}

                {/* テスト合格状況 */}
                <div style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#a78bfa" }}>🏆 テスト合格状況</div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: "#a78bfa" }}>{passedCount} / 3</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {tests.map(t => (
                            <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: t.passed ? "rgba(52,211,153,.08)" : "rgba(0,0,0,.25)", border: `1px solid ${t.passed ? "rgba(52,211,153,.3)" : "rgba(255,255,255,.06)"}` }}>
                                <span style={{ fontSize: 16 }}>{t.passed ? "✅" : "🔒"}</span>
                                <span style={{ fontSize: 13.5, fontWeight: 700, color: t.passed ? "#34d399" : "#9ca3af" }}>{t.label}</span>
                                {t.passed && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: "#34d399" }}>合格！</span>}
                            </div>
                        ))}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 10 }}>※テストの合格判定はメンター・管理者が行います</div>
                </div>

                {/* 今日の練習 */}
                <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(139,92,246,.4)", borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: "0 0 24px rgba(139,92,246,.12)" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#a78bfa", marginBottom: 6 }}>📅 練習 {currentDay} 日目</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        <span style={{ fontSize: 32 }}>{todayPlan.icon}</span>
                        <div>
                            <div style={{ fontSize: 17, fontWeight: 900, color: "#f9fafb" }}>{todayPlan.label}</div>
                            <div style={{ fontSize: 12.5, color: "#9ca3af", marginTop: 2 }}>{todayPlan.desc}</div>
                        </div>
                    </div>
                    {!showForm ? (
                        <button onClick={() => { setPType(todayPlan.type === "test" ? "mock" : todayPlan.type); setShowForm(true); }}
                            style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontSize: 14, fontWeight: 800, boxShadow: "0 4px 14px rgba(139,92,246,.35)" }}>
                            ✍️ 今日の練習を報告する
                        </button>
                    ) : (
                        <div>
                            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                                    <button key={k} onClick={() => setPType(k)}
                                        style={{ padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", background: pType === k ? "rgba(139,92,246,.25)" : "rgba(255,255,255,.04)", border: `1px solid ${pType === k ? "#8b5cf6" : "rgba(255,255,255,.1)"}`, color: pType === k ? "#c4b5fd" : "#9ca3af" }}>
                                        {v}
                                    </button>
                                ))}
                            </div>
                            <textarea value={content} onChange={(e) => setContent(e.target.value)}
                                placeholder="今日の練習内容・気づき・詰まったところなど"
                                style={{ width: "100%", height: 100, padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.05)", color: "#f9fafb", fontSize: 14, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 10 }} />
                            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
                                <input value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ""))} placeholder="練習時間"
                                    style={{ width: 110, padding: "10px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.05)", color: "#f9fafb", fontSize: 13, outline: "none" }} />
                                <span style={{ fontSize: 12, color: "#9ca3af" }}>分（任意）</span>
                            </div>
                            <div style={{ display: "flex", gap: 10 }}>
                                <button onClick={() => { setShowForm(false); setContent(""); setMinutes(""); }} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.05)", color: "#9ca3af", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>キャンセル</button>
                                <button onClick={submit} disabled={sending} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: sending ? "rgba(139,92,246,.4)" : "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 800, cursor: sending ? "not-allowed" : "pointer", fontSize: 13 }}>
                                    {sending ? "記録中..." : "🎤 報告する"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 7日間ロードマップ */}
                <div style={{ marginBottom: 22 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8b8fa8", letterSpacing: 2, marginBottom: 12 }}>🗺️ 7日間の流れ</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {DAY_PLAN.map(d => {
                            const done = currentDay > d.day;
                            const isToday = currentDay === d.day;
                            return (
                                <div key={d.day} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, background: isToday ? "rgba(139,92,246,.12)" : "rgba(255,255,255,.02)", border: `1px solid ${isToday ? "#8b5cf6" : done ? "rgba(52,211,153,.25)" : "rgba(255,255,255,.06)"}` }}>
                                    <span style={{ fontSize: 12, fontWeight: 900, color: done ? "#34d399" : isToday ? "#a78bfa" : "#6b7280", width: 44, flexShrink: 0 }}>Day {d.day}</span>
                                    <span style={{ fontSize: 16 }}>{d.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: done ? "#34d399" : isToday ? "#f9fafb" : "#9ca3af" }}>{d.label}</span>
                                        <span style={{ fontSize: 11.5, color: "#6b7280", marginLeft: 8 }}>{d.desc}</span>
                                    </div>
                                    {done && <span style={{ fontSize: 13, color: "#34d399" }}>✓</span>}
                                    {isToday && <span style={{ fontSize: 10, fontWeight: 900, color: "#a78bfa", background: "rgba(139,92,246,.15)", border: "1px solid rgba(139,92,246,.4)", borderRadius: 6, padding: "2px 8px" }}>今日</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 練習履歴 */}
                <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8b8fa8", letterSpacing: 2, marginBottom: 12 }}>📜 練習の記録（{reports.length}件）</div>
                    {reports.length === 0 ? (
                        <div style={{ fontSize: 13, color: "#6b7280", padding: "16px 0", textAlign: "center" }}>まだ記録がありません。今日から始めよう！</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {reports.map(r => (
                                <div key={r.id} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "12px 16px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
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
