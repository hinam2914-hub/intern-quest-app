"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Member = {
    id: string;
    name: string;
    department_id: string | null;
    deptName?: string;
    avatar_url?: string | null;
};

const CATEGORIES = [
    { value: "late", label: "⏰ 遅刻", desc: "遅刻が続いている、時間にルーズ" },
    { value: "absence", label: "❌ 欠勤", desc: "無断欠勤、連絡なしの休み" },
    { value: "mistake", label: "💼 仕事のミス", desc: "業務上のミス、品質の問題" },
    { value: "communication", label: "💬 コミュニケーション", desc: "報連相不足、対応の悪さ" },
    { value: "other", label: "📝 その他", desc: "上記以外の気づき" },
];

export default function AdvicePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string>("");
    const [members, setMembers] = useState<Member[]>([]);
    const [selectedReceiver, setSelectedReceiver] = useState<string>("");
    const [category, setCategory] = useState<string>("late");
    const [message, setMessage] = useState<string>("");
    const [sending, setSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const [myAdviceHistory, setMyAdviceHistory] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<"send" | "history">("send");

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);

            // メンバー一覧（自分以外）
            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, name, department_id, avatar_url")
                .neq("id", user.id)
                .order("name");

            const { data: depts } = await supabase.from("departments").select("id, name");
            const deptMap = new Map((depts || []).map((d: any) => [d.id, d.name]));

            const enriched = (profiles || []).map((p: any) => ({
                ...p,
                deptName: p.department_id ? deptMap.get(p.department_id) : "未所属",
            }));
            setMembers(enriched);

            // 自分の送信履歴
            const { data: history } = await supabase
                .from("advice_logs")
                .select("*")
                .eq("sender_id", user.id)
                .order("created_at", { ascending: false });
            setMyAdviceHistory(history || []);

            setLoading(false);
        };
        load();
    }, [router]);

    const handleSend = async () => {
        if (!selectedReceiver) {
            alert("送信先のメンバーを選んでください");
            return;
        }
        if (!message.trim()) {
            alert("メッセージを入力してください");
            return;
        }
        if (!confirm("送信してよろしいですか？\n\n※管理者の承認後、相手に届きます\n※承認時に+2pt獲得")) return;

        setSending(true);
        const { error } = await supabase.from("advice_logs").insert({
            sender_id: userId,
            receiver_id: selectedReceiver,
            category: category,
            message: message.trim(),
            status: "pending",
            sender_is_admin: false,
            points_awarded: 0,
        });

        if (error) {
            alert("送信失敗: " + error.message);
            setSending(false);
            return;
        }

        alert("✅ アドバイスを送信しました\n管理者の承認後、相手に通知されます");
        setSelectedReceiver("");
        setMessage("");
        setCategory("late");

        // 履歴を再読込
        const { data: history } = await supabase
            .from("advice_logs")
            .select("*")
            .eq("sender_id", userId)
            .order("created_at", { ascending: false });
        setMyAdviceHistory(history || []);
        setActiveTab("history");
        setSending(false);
    };

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    const filteredMembers = members.filter(m =>
        searchQuery === "" || m.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}>
            <div style={{ maxWidth: 720, margin: "0 auto" }}>
                {/* 戻るボタン */}
                <button onClick={() => router.push("/menu")} style={{ marginBottom: 16, padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    ← メニューに戻る
                </button>

                {/* ヘッダー */}
                <div style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(249,115,22,0.12))", border: "2px solid rgba(245,158,11,0.4)", borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: "0 0 30px rgba(245,158,11,0.15)" }}>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fbbf24", margin: "0 0 8px" }}>💌 アドバイスポイント</h1>
                    <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6 }}>
                        メンバーの行動について、改善のための気づきを匿名で送ることができます。<br />
                        管理者の承認後、相手に通知され、あなたには <strong style={{ color: "#fbbf24" }}>+2pt</strong> 付与されます。
                    </div>
                </div>

                {/* タブ */}
                <div style={{ display: "flex", gap: 6, marginBottom: 16, padding: 4, borderRadius: 10, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", width: "fit-content" }}>
                    <button onClick={() => setActiveTab("send")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: activeTab === "send" ? "linear-gradient(135deg, #f59e0b, #f97316)" : "transparent", color: activeTab === "send" ? "#fff" : "#9ca3af", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        ✏️ 送信する
                    </button>
                    <button onClick={() => setActiveTab("history")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: activeTab === "history" ? "linear-gradient(135deg, #f59e0b, #f97316)" : "transparent", color: activeTab === "history" ? "#fff" : "#9ca3af", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        📜 送信履歴 ({myAdviceHistory.length})
                    </button>
                </div>

                {activeTab === "send" && (
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                        {/* 受信者選択 */}
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, marginBottom: 8 }}>📬 送信先メンバー</div>
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="🔍 名前で検索..."
                                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 13, marginBottom: 8, outline: "none" }}
                            />
                            <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, padding: 4 }}>
                                {filteredMembers.length === 0 ? (
                                    <div style={{ padding: 16, textAlign: "center", color: "#6b7280", fontSize: 13 }}>該当するメンバーがいません</div>
                                ) : (
                                    filteredMembers.map(m => (
                                        <button key={m.id} onClick={() => setSelectedReceiver(m.id)} style={{ padding: "10px 14px", borderRadius: 8, border: selectedReceiver === m.id ? "2px solid #f59e0b" : "1px solid rgba(255,255,255,0.08)", background: selectedReceiver === m.id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.02)", color: "#f9fafb", fontSize: 13, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: m.avatar_url ? `url(${m.avatar_url}) center/cover` : "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                                                {!m.avatar_url && m.name.charAt(0)}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700 }}>{m.name}</div>
                                                <div style={{ fontSize: 11, color: "#6b7280" }}>🏢 {m.deptName}</div>
                                            </div>
                                            {selectedReceiver === m.id && <span style={{ color: "#fbbf24", fontSize: 18 }}>✓</span>}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* カテゴリ選択 */}
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, marginBottom: 8 }}>📋 カテゴリ</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                {CATEGORIES.map(c => (
                                    <button key={c.value} onClick={() => setCategory(c.value)} style={{ padding: "10px 14px", borderRadius: 8, border: category === c.value ? "1px solid #f59e0b" : "1px solid rgba(255,255,255,0.1)", background: category === c.value ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.02)", color: category === c.value ? "#fbbf24" : "#d1d5db", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                                        <div>{c.label}</div>
                                        <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 500, marginTop: 2 }}>{c.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* メッセージ */}
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, marginBottom: 8 }}>✏️ メッセージ</div>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="例: 最近遅刻が続いているので、改善のため一緒に対策を考えませんか？"
                                style={{ width: "100%", minHeight: 140, padding: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none" }}
                            />
                            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>※ 相手の名前・送信者の名前は表示されません（完全匿名）</div>
                        </div>

                        {/* 送信ボタン */}
                        <button
                            onClick={handleSend}
                            disabled={sending || !selectedReceiver || !message.trim()}
                            style={{ width: "100%", padding: "14px 24px", borderRadius: 10, border: "none", background: sending || !selectedReceiver || !message.trim() ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #f59e0b, #f97316)", color: sending || !selectedReceiver || !message.trim() ? "#6b7280" : "#fff", fontSize: 14, fontWeight: 700, cursor: sending || !selectedReceiver || !message.trim() ? "not-allowed" : "pointer", boxShadow: sending || !selectedReceiver || !message.trim() ? "none" : "0 0 20px rgba(245,158,11,0.3)" }}
                        >
                            {sending ? "送信中..." : "💌 送信する"}
                        </button>
                    </div>
                )}

                {activeTab === "history" && (
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                        {myAdviceHistory.length === 0 ? (
                            <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 13 }}>まだ送信履歴がありません</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {myAdviceHistory.map(a => {
                                    const cat = CATEGORIES.find(c => c.value === a.category);
                                    const sb: Record<string, { label: string; color: string; bg: string }> = {
                                        pending: { label: "🟡 審査中", color: "#fbbf24", bg: "rgba(245,158,11,0.15)" },
                                        approved: { label: "✅ 承認 (+2pt)", color: "#34d399", bg: "rgba(52,211,153,0.15)" },
                                        rejected: { label: "❌ 却下", color: "#f87171", bg: "rgba(239,68,68,0.15)" },
                                    };
                                    const s = sb[a.status];
                                    return (
                                        <div key={a.id} style={{ padding: 16, borderRadius: 10, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                                                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                                    <span style={{ padding: "3px 8px", borderRadius: 4, background: s.bg, color: s.color, fontSize: 10, fontWeight: 700 }}>{s.label}</span>
                                                    <span style={{ padding: "3px 8px", borderRadius: 4, background: "rgba(245,158,11,0.1)", color: "#fbbf24", fontSize: 10, fontWeight: 600 }}>{cat?.label}</span>
                                                </div>
                                                <span style={{ fontSize: 10, color: "#6b7280" }}>{new Date(a.created_at).toLocaleString("ja-JP")}</span>
                                            </div>
                                            <div style={{ fontSize: 13, color: "#d1d5db", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{a.message}</div>
                                            {a.admin_comment && (
                                                <div style={{ marginTop: 8, padding: 10, borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                                                    <div style={{ fontSize: 10, color: "#f87171", fontWeight: 700, marginBottom: 2 }}>却下理由</div>
                                                    <div style={{ fontSize: 11, color: "#fca5a5" }}>{a.admin_comment}</div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}