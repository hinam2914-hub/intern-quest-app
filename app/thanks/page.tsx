"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type UserOption = { id: string; name: string; avatar_url?: string | null };
type ThanksRow = {
    id: string;
    from_user_id: string;
    to_user_id: string;
    message: string;
    created_at: string;
    from_name?: string;
    to_name?: string;
    from_avatar?: string | null;
    to_avatar?: string | null;
};

function formatDateTime(value: string): string {
    const date = new Date(value);
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return jst.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function isSameJSTDay(value: string, targetYmd: string): boolean {
    const date = new Date(value);
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}` === targetYmd;
}

export default function ThanksPage() {
    const router = useRouter();
    const [myId, setMyId] = useState("");
    const [myName, setMyName] = useState("");
    const [users, setUsers] = useState<UserOption[]>([]);
    const [toUserId, setToUserId] = useState("");
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState("");
    const [success, setSuccess] = useState(false);
    const [thanksList, setThanksList] = useState<ThanksRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [historyTab, setHistoryTab] = useState<"all" | "sent" | "received">("sent");
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setMyId(user.id);
            const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map(e => e.trim());
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            setIsAdmin(!!currentUser?.email && adminEmails.includes(currentUser.email));
            const { data: profileRows } = await supabase.from("profiles").select("id, name, avatar_url");
            const allUsers = (profileRows || []).map((p: any) => ({ id: p.id, name: p.name || "名前未設定", avatar_url: p.avatar_url || null }));
            setMyName(allUsers.find(u => u.id === user.id)?.name || "");
            setUsers(allUsers.filter(u => u.id !== user.id));

            const { data: thanksRows } = await supabase.from("thanks").select("*").order("created_at", { ascending: false }).limit(50);
            if (thanksRows) {
                setThanksList(thanksRows.map((row: any) => ({
                    ...row,
                    from_name: allUsers.find(u => u.id === row.from_user_id)?.name || "名前未設定",
                    to_name: allUsers.find(u => u.id === row.to_user_id)?.name || "名前未設定",
                    from_avatar: allUsers.find(u => u.id === row.from_user_id)?.avatar_url || null,
                    to_avatar: allUsers.find(u => u.id === row.to_user_id)?.avatar_url || null,
                })));
            }
            setLoading(false);
        };
        load();
    }, [router]);

    const handleSend = async () => {
        if (!toUserId) { setResult("送り先を選んでください"); return; }
        if (!message.trim()) { setResult("メッセージを入力してください"); return; }
        if (toUserId === myId) { setResult("自分自身には送れません"); return; }

        setSending(true);
        setResult("");
        setSuccess(false);

        const todayYmd = getTodayJST();
        const { data: existingRows } = await supabase.from("thanks").select("created_at").eq("from_user_id", myId).eq("to_user_id", toUserId);
        const alreadySent = existingRows?.some(row => isSameJSTDay(row.created_at, todayYmd));
        if (alreadySent) {
            setResult("今日はすでにこの人にサンキューを送りました");
            setSending(false);
            return;
        }

        const nowIso = new Date().toISOString();
        const { error: thanksError } = await supabase.from("thanks").insert({ from_user_id: myId, to_user_id: toUserId, message: message.trim(), created_at: nowIso });
        if (thanksError) { setResult("送信に失敗しました: " + thanksError.message); setSending(false); return; }

        const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", toUserId).single();
        const current = pointRow?.points || 0;
        await supabase.from("user_points").update({ points: current + 1 }).eq("id", toUserId);
        await supabase.from("points_history").insert({ user_id: toUserId, change: 1, reason: "thanks_received", created_at: nowIso });

        setSuccess(true);
        const toName = users.find(u => u.id === toUserId)?.name || "相手";
        setResult(`✅ ${toName}さんにサンキューを送りました！+1pt 付与しました`);
        setMessage("");
        setToUserId("");

        const { data: thanksRows } = await supabase.from("thanks").select("*").order("created_at", { ascending: false }).limit(50);
        const allUsers = [...users, { id: myId, name: myName }];
        if (thanksRows) {
            setThanksList(thanksRows.map((row: any) => ({
                ...row,
                from_name: allUsers.find(u => u.id === row.from_user_id)?.name || "名前未設定",
                to_name: allUsers.find(u => u.id === row.to_user_id)?.name || "名前未設定",
                from_avatar: users.find(u => u.id === row.from_user_id)?.avatar_url || null,
                to_avatar: users.find(u => u.id === row.to_user_id)?.avatar_url || null,
            })));
        }
        setSending(false);
    };

    const renderAvatar = (avatarUrl: string | null | undefined, name: string, size: number = 36) => {
        if (avatarUrl) {
            return <img src={avatarUrl} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
        }
        return (
            <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                {name.charAt(0)}
            </div>
        );
    };

    const filteredList = thanksList.filter(item => {
        if (historyTab === "sent") return item.from_user_id === myId;
        if (historyTab === "received") return item.to_user_id === myId;
        return true;
    });

    const sentCount = thanksList.filter(i => i.from_user_id === myId).length;
    const receivedCount = thanksList.filter(i => i.to_user_id === myId).length;

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(251,191,36,0.06) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto" }}>

                {/* ヘッダー */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                    <div>
                        <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>INTERN QUEST</div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>🎉 サンキュー</h1>
                        <p style={{ color: "#6b7280", fontSize: 14, margin: "8px 0 0" }}>感謝を伝えてポイントをプレゼント！</p>
                    </div>
                    <button onClick={() => router.push("/mypage")} style={{ background: "rgba(255,255,255,0.05)", color: "#d1d5db", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>マイページ</button>
                </div>

                {/* 自分の統計 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
                    <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>送った数</div>
                        <div style={{ fontSize: 32, fontWeight: 800, color: "#818cf8" }}>{sentCount}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>件</div>
                    </div>
                    <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>受け取った数</div>
                        <div style={{ fontSize: 32, fontWeight: 800, color: "#fbbf24" }}>{receivedCount}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>件</div>
                    </div>
                </div>

                {/* 送信フォーム */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 28, marginBottom: 24 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>SEND THANKS</div>

                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>送り先</div>
                        <select value={toUserId} onChange={(e) => setToUserId(e.target.value)} style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: toUserId ? "#f9fafb" : "#6b7280", fontSize: 15, outline: "none", cursor: "pointer" }}>
                            <option value="" style={{ background: "#0f0f1a" }}>選んでください</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id} style={{ background: "#0f0f1a", color: "#f9fafb" }}>{u.name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>メッセージ</div>
                        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="感謝のメッセージを書いてください..." style={{ width: "100%", height: 120, padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.6 }} />
                    </div>

                    <div style={{ padding: "10px 16px", borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", marginBottom: 16 }}>
                        <span style={{ fontSize: 13, color: "#fbbf24" }}>🎁 送ると相手に +1pt プレゼント！（1日1人まで）</span>
                    </div>
                    <button onClick={handleSend} disabled={sending} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: sending ? "rgba(251,191,36,0.3)" : "linear-gradient(135deg, #f59e0b, #fbbf24)", color: "#0a0a0f", fontWeight: 800, cursor: sending ? "not-allowed" : "pointer", fontSize: 16 }}>
                        {sending ? "送信中..." : "🎉 サンキューを送る"}
                    </button>

                    {result && (
                        <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: success ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", border: `1px solid ${success ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`, color: success ? "#34d399" : "#f87171", fontSize: 14, fontWeight: 600 }}>
                            {result}
                        </div>
                    )}
                </div>

                {/* サンキュー履歴 */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2 }}>THANKS HISTORY</div>
                        {/* タブ */}
                        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 3 }}>
                            {[
                                ...(isAdmin ? [{ key: "all", label: "全員" }] : []),
                                { key: "sent", label: "送った" },
                                { key: "received", label: "受け取った" },
                            ].map((tab) => (
                                <button key={tab.key} onClick={() => setHistoryTab(tab.key as any)} style={{ padding: "5px 12px", borderRadius: 6, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 12, background: historyTab === tab.key ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "transparent", color: historyTab === tab.key ? "#fff" : "#6b7280", transition: "all 0.2s" }}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filteredList.length === 0 ? (
                        <div style={{ color: "#6b7280", fontSize: 14, textAlign: "center", padding: 24 }}>まだサンキューはありません</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {filteredList.map((item) => {
                                const isReceived = item.to_user_id === myId;
                                const isSent = item.from_user_id === myId;
                                return (
                                    <div key={item.id} style={{ padding: "14px 16px", borderRadius: 12, background: isReceived ? "rgba(251,191,36,0.06)" : isSent ? "rgba(99,102,241,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${isReceived ? "rgba(251,191,36,0.2)" : isSent ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.05)"}` }}>
                                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                            {/* 送り主アバター */}
                                            {renderAvatar(item.from_avatar, item.from_name || "", 36)}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                                    <div style={{ fontSize: 13, color: "#9ca3af" }}>
                                                        <span style={{ color: isSent ? "#818cf8" : "#d1d5db", fontWeight: 700 }}>{item.from_name}</span>
                                                        <span style={{ margin: "0 6px" }}>→</span>
                                                        <span style={{ color: isReceived ? "#fbbf24" : "#d1d5db", fontWeight: 700 }}>{item.to_name}</span>
                                                        {isReceived && <span style={{ marginLeft: 6, fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>あなたへ</span>}
                                                        {isSent && <span style={{ marginLeft: 6, fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>あなたから</span>}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap", marginLeft: 12 }}>{formatDateTime(item.created_at)}</div>
                                                </div>
                                                <div style={{ fontSize: 14, color: "#d1d5db", lineHeight: 1.6, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 12px" }}>
                                                    {item.message}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}