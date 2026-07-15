"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import DotKun from "../components/DotKun";

// よく使うQuest（クイック追加用）
const QUICK_QUESTS = [
    "📞 テレアポ", "🚪 ピンポン", "🤝 商談・面談", "📝 資料作成", "💬 MTG・1on1",
    "🎓 授業・学校", "✍️ 課題・勉強", "📚 学習コンテンツ", "🎯 ライフチャレンジ",
    "🧠 思考クエスト", "📋 日報を提出", "📖 読書", "💪 運動・筋トレ", "🎮 趣味・遊び",
];

type Quest = { id: string; label: string; done: boolean };
type Slots = { morning: Quest[]; afternoon: Quest[]; night: Quest[] };
type Period = "morning" | "afternoon" | "night";

const PERIODS: { key: Period; icon: string; title: string; sub: string; time: string; grad: string }[] = [
    { key: "morning", icon: "🌅", title: "MORNING QUEST", sub: "朝の時間", time: "06:00 - 12:00", grad: "linear-gradient(135deg, rgba(251,146,60,.18), rgba(139,92,246,.08))" },
    { key: "afternoon", icon: "☁️", title: "AFTERNOON QUEST", sub: "昼の時間", time: "12:00 - 18:00", grad: "linear-gradient(135deg, rgba(96,165,250,.18), rgba(139,92,246,.08))" },
    { key: "night", icon: "🌙", title: "NIGHT QUEST", sub: "夜の時間", time: "18:00 - 24:00", grad: "linear-gradient(135deg, rgba(167,139,250,.2), rgba(76,29,149,.12))" },
];

function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().slice(0, 10);
}
const uid = () => Math.random().toString(36).slice(2, 9);

// 旧形式(配列)を新形式に変換 or 空を返す
function normalizeSlots(raw: any): Slots {
    if (raw && !Array.isArray(raw) && (raw.morning || raw.afternoon || raw.night)) {
        return { morning: raw.morning || [], afternoon: raw.afternoon || [], night: raw.night || [] };
    }
    return { morning: [], afternoon: [], night: [] };
}

export default function TodaySchedulePage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [slots, setSlots] = useState<Slots>({ morning: [], afternoon: [], night: [] });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [inputs, setInputs] = useState<Record<Period, string>>({ morning: "", afternoon: "", night: "" });
    const [pickerFor, setPickerFor] = useState<Period | null>(null);
    const [toast, setToast] = useState("");
    const date = getTodayJST();

    const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2000); };

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const { data } = await supabase.from("daily_schedules").select("slots").eq("user_id", user.id).eq("date", date).maybeSingle();
            setSlots(normalizeSlots((data as any)?.slots));
            setLoading(false);
        };
        init();
    }, [router, date]);

    const addQuest = (p: Period, label: string) => {
        const t = label.trim();
        if (!t) return;
        setSlots(prev => ({ ...prev, [p]: [...prev[p], { id: uid(), label: t, done: false }] }));
        setInputs(prev => ({ ...prev, [p]: "" }));
        setPickerFor(null);
    };
    const toggleQuest = (p: Period, id: string) => {
        setSlots(prev => ({ ...prev, [p]: prev[p].map(q => q.id === id ? { ...q, done: !q.done } : q) }));
    };
    const removeQuest = (p: Period, id: string) => {
        setSlots(prev => ({ ...prev, [p]: prev[p].filter(q => q.id !== id) }));
    };

    const totalCount = slots.morning.length + slots.afternoon.length + slots.night.length;

    const handleSave = async () => {
        if (!userId) return;
        setSaving(true);
        const { error } = await supabase.from("daily_schedules").upsert({
            user_id: userId, date, slots, updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,date" });
        setSaving(false);
        if (error) { flash("保存に失敗しました"); return; }
        flash("今日のQuestを確定しました！");
        setTimeout(() => router.push("/home"), 1000);
    };

    if (loading) return <div style={{ minHeight: "100vh", background: "#0b0b16", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b8ba7" }}>読み込み中...</div>;

    return (
        <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 30% 0%, #1a1030 0%, #0b0b16 55%)", padding: "24px 16px 110px" }}>
            <div style={{ maxWidth: 1080, margin: "0 auto" }}>
                {/* ヘッダー */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ animation: "floaty 2.6s ease-in-out infinite" }}><DotKun size={56} stage={5} mood="cheer" /></div>
                        <div>
                            <div style={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>今日のQuestを設定しよう！</div>
                            <div style={{ fontSize: 12.5, color: "#c4b5fd", marginTop: 3 }}>3つの時間帯に、今日やることをセットしよう！</div>
                        </div>
                    </div>
                    <button onClick={() => router.push("/home")} style={{ border: "1px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.12)", borderRadius: 12, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, color: "#c4b5fd", cursor: "pointer" }}>🏝️ 島へ</button>
                </div>

                {/* ドットくんの一言 */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 16, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", marginBottom: 20 }}>
                    <div style={{ fontSize: 22 }}>💡</div>
                    <div style={{ flex: 1, fontSize: 13, color: "#e0d7ff", fontWeight: 600, lineHeight: 1.6 }}>計画を立てることが、成長の第一歩だよ！朝・昼・夜の3つに分けて、今日のQuestを決めていこう。</div>
                </div>

                {/* 3分割Quest */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 22 }}>
                    {PERIODS.map((P) => (
                        <div key={P.key} style={{ borderRadius: 20, padding: 18, background: P.grad, border: "1px solid rgba(139,92,246,0.25)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                                <div style={{ fontSize: 26 }}>{P.icon}</div>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", letterSpacing: 1 }}>{P.title}</div>
                                    <div style={{ fontSize: 11, color: "#c4b5fd" }}>{P.sub} ・ {P.time}</div>
                                </div>
                            </div>
                            {/* Questリスト */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                                {slots[P.key].length === 0 && <div style={{ fontSize: 12, color: "#8b8ba7", padding: "8px 4px" }}>まだQuestがありません</div>}
                                {slots[P.key].map((q) => (
                                    <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 12, background: q.done ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${q.done ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.08)"}` }}>
                                        <div onClick={() => toggleQuest(P.key, q.id)} style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: q.done ? "linear-gradient(135deg,#34d399,#10b981)" : "transparent", border: q.done ? "none" : "2px solid rgba(255,255,255,0.25)", color: "#fff", fontSize: 13, fontWeight: 900 }}>{q.done ? "✓" : ""}</div>
                                        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: q.done ? "#6ee7b7" : "#e0d7ff", textDecoration: q.done ? "line-through" : "none" }}>{q.label}</div>
                                        <button onClick={() => removeQuest(P.key, q.id)} style={{ background: "none", border: "none", color: "#6b6b85", cursor: "pointer", fontSize: 15, padding: 0 }}>×</button>
                                    </div>
                                ))}
                            </div>
                            {/* 追加入力 */}
                            <input value={inputs[P.key]} onChange={(e) => setInputs(prev => ({ ...prev, [P.key]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addQuest(P.key, inputs[P.key])} placeholder="やることを入力..." style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(139,92,246,0.3)", background: "rgba(20,12,40,0.5)", color: "#fff", fontSize: 13, boxSizing: "border-box", marginBottom: 8 }} />
                            <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => addQuest(P.key, inputs[P.key])} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "1px dashed rgba(139,92,246,0.5)", background: "transparent", color: "#c4b5fd", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>+ 追加</button>
                                <button onClick={() => setPickerFor(pickerFor === P.key ? null : P.key)} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.12)", color: "#c4b5fd", fontSize: 12.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>よく使う</button>
                            </div>
                            {/* クイック追加ピッカー */}
                            {pickerFor === P.key && (
                                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {QUICK_QUESTS.map((qq) => (
                                        <button key={qq} onClick={() => addQuest(P.key, qq)} style={{ padding: "6px 11px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#c7c7de", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>{qq}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* おすすめ案内 */}
                <div style={{ borderRadius: 20, padding: "20px 24px", background: "linear-gradient(135deg, rgba(139,92,246,0.18), rgba(99,102,241,0.06))", border: "1px solid rgba(139,92,246,0.35)", marginBottom: 22 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#c4b5fd", letterSpacing: 1, marginBottom: 10 }}>💡 今日のおすすめ</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                        {["📚 学習コンテンツを1つ", "🎯 ライフチャレンジを1つ", "🧠 思考クエスト", "📋 日報を提出"].map((t, i) => (
                            <div key={i} style={{ padding: "8px 14px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12.5, color: "#e0d7ff", fontWeight: 700 }}>{t}</div>
                        ))}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>ぜんぶやると 1日で最低 <span style={{ fontSize: 22, fontWeight: 900, color: "#fcd34d" }}>19pt</span> 獲得！</div>
                </div>

                {/* 確定ボタン */}
                <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "16px 0", borderRadius: 16, border: "none", cursor: saving ? "default" : "pointer", background: "linear-gradient(135deg, #a78bfa, #7c3aed)", color: "#fff", fontSize: 16, fontWeight: 900, letterSpacing: 1, boxShadow: "0 8px 24px rgba(124,58,237,0.4)", opacity: saving ? 0.7 : 1 }}>{saving ? "保存中..." : `✨ 今日のQuestを確定する！（${totalCount}件）`}</button>
                <div style={{ textAlign: "center", fontSize: 11.5, color: "#6b6b85", marginTop: 10 }}>いつでも編集・追加できるよ</div>
            </div>

            {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(30,20,55,0.95)", border: "1px solid rgba(139,92,246,0.5)", color: "#fff", padding: "12px 24px", borderRadius: 999, fontSize: 14, fontWeight: 800, zIndex: 100 }}>{toast}</div>}
            <style>{`@keyframes floaty { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>
        </div>
    );
}
