"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type UserOption = { id: string; name: string };
type ThanksRow = {
    id: string;
    from_user_id: string;
    to_user_id: string;
    message: string;
    created_at: string;
    from_name?: string;
    to_name?: string;
};

function formatDateTime(value: string): string {
    const date = new Date(value);
    return date.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
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

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setMyId(user.id);

            const { data: profileRows } = await supabase.from("profiles").select("id, name");
            const allUsers = (profileRows || []).map((p: any) => ({ id: p.id, name: p.name || "名前未設定" }));
            setMyName(allUsers.find(u => u.id === user.id)?.name || "");
            setUsers(allUsers.filter(u => u.id !== user.id));

            // サンキュー履歴取得
            const { data: thanksRows } = await supabase
                .from("thanks")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(30);

            if (thanksRows) {
                const enriched = thanksRows.map((row: any) => ({
                    ...row,
                    from_name: allUsers.find(u => u.id === row.from_user_id)?.name || "名前未設定",
                    to_name: allUsers.find(u => u.id === row.to_user_id)?.name || "名前未設定",
                }));
                setThanksList(enriched);
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

        const todayYmd = getTodayJST();

        // 今日すでに同じ人に送っているか確認
        const { data: existingRows } = await supabase
            .from("thanks")
            .select("created_at")
            .eq("from_user_id", myId)
            .eq("to_user_id", toUserId);

        const alreadySent = existingRows?.some(row => isSameJSTDay(row.created_at, todayYmd));
        if (alreadySent) {
            setResult("今日はすでにこの人にサンキューを送りました");
            setSending(false);
            return;
        }

        const nowIso = new Date().toISOString();

        // thanksテーブルに保存
        const { error: thanksError } = await supabase.from("thanks").insert({
            from_user_id: myId,
            to_user_id: toUserId,
            message: message.trim(),
            created_at: nowIso,
        });

        if (thanksError) {
            setResult("送信に失敗しました");
            setSending(false);
            return;
        }

        // 受け取った人にポイント付与
        const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", toUserId).single();
        const current = pointRow?.points || 0;
        await supabase.from("user_points").update({ points: current + 1 }).eq("id", toUserId);
        await supabase.from("points_history").insert({
            user_id: toUserId,
            change: 1,
            reason: "thanks_received",
            created_at: nowIso,
        });

        setSuccess(true);
        setResult(`✅ ${users.find(u => u.id === toUserId)?.name}さんにサンキューを送りました！+1pt 付与しました`);
        setMessage("");
        setToUserId("");

        // 履歴を更新
        const { data: thanksRows } = await supabase.from("thanks").select("*").order("created_at", { ascending: false }).limit(30);
        const allUsers = [...users, { id: myId, name: myName }];
        if (thanksRows) {
            setThanksList(thanksRows.map((row: any) => ({
                ...row,
                from_name: allUsers.find(u => u.id === row.from_user_id)?.name || "名前未設定",
                to_name: allUsers.find(u => u.id === row.to_user_id)?.name || "名前未設定",
            })));
        }
        setSending(false);
    };

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

                {/* 送信フォーム */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 28, marginBottom: 24 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>SEND THANKS</div>

                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>送り先</div>
                        <select
                            value={toUserId}
                            onChange={(e) => setToUserId(e.target.value)}
                            style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: toUserId ? "#f9fafb" : "#6b7280", fontSize: 15, outline: "none", cursor: "pointer" }}
                        >
                            <option value="" style={{ background: "#0f0f1a" }}>選んでください</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id} style={{ background: "#0f0f1a", color: "#f9fafb" }}>{u.name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>メッセージ</div>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="感謝のメッセージを書いてください..."
                            style={{ width: "100%", height: 120, padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.6 }}
                        />
                    </div>

                    <div style={{ padding: "10px 16px", borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", marginBottom: 16 }}>
                        <span style={{ fontSize: 13, color: "#fbbf24" }}>🎁 送ると相手に +1pt プレゼント！（1日1人まで）</span>
                    </div>
                    <button onClick={() => router.push("/shop")} style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(251,191,36,0.3)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>🛍️ ショップ</button>
                    <button
                        onClick={handleSend}
                        disabled={sending}
                        style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: sending ? "rgba(251,191,36,0.3)" : "linear-gradient(135deg, #f59e0b, #fbbf24)", color: "#0a0a0f", fontWeight: 800, cursor: sending ? "not-allowed" : "pointer", fontSize: 16 }}
                    >
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
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>THANKS HISTORY</div>
                    {thanksList.length === 0 ? (
                        <div style={{ color: "#6b7280", fontSize: 14 }}>まだサンキューはありません</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {thanksList.map((item) => (
                                <div key={item.id} style={{ padding: "14px 16px", borderRadius: 12, background: item.to_user_id === myId ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${item.to_user_id === myId ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.05)"}` }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <div>
                                            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 4 }}>
                                                <span style={{ color: "#818cf8", fontWeight: 700 }}>{item.from_name}</span>
                                                <span> → </span>
                                                <span style={{ color: item.to_user_id === myId ? "#fbbf24" : "#34d399", fontWeight: 700 }}>{item.to_name}</span>
                                                {item.to_user_id === myId && <span style={{ marginLeft: 8, fontSize: 11, color: "#fbbf24" }}>（あなたへ）</span>}
                                            </div>
                                            <div style={{ fontSize: 14, color: "#d1d5db", lineHeight: 1.6 }}>{item.message}</div>
                                        </div>
                                        <div style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap", marginLeft: 12 }}>{formatDateTime(item.created_at)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}