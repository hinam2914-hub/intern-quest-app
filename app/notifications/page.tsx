"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string | null;
    link: string | null;
    icon: string | null;
    is_read: boolean;
    created_at: string;
}

export default function NotificationsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string>("");
    const [notifications, setNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const nowIso = new Date().toISOString();
            const { data } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", user.id)
                .lte("created_at", nowIso)  // 未来日の通知は表示しない（クールダウン明け前など）
                .order("created_at", { ascending: false })
                .limit(50);
            setNotifications((data || []) as Notification[]);
            setLoading(false);
        })();
    }, [router]);

    const handleClick = async (n: Notification) => {
        if (!n.is_read) {
            await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
        }
        if (n.link) router.push(n.link);
    };

    const handleMarkAllRead = async () => {
        if (!confirm("すべての通知を既読にしますか？")) return;
        await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
        setNotifications(prev => prev.map(x => ({ ...x, is_read: true })));
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    if (loading) return <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Loading...</main>;

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", color: "#f9fafb" }}>
            <div style={{ maxWidth: 720, margin: "0 auto" }}>
                <button onClick={() => router.push("/home")} style={{ background: "transparent", border: "1px solid #374151", color: "#9ca3af", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, marginBottom: 16 }}>← ホームに戻る</button>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <h1 style={{ fontSize: 28, fontWeight: 900 }}>🔔 通知{unreadCount > 0 && <span style={{ fontSize: 14, color: "#ef4444", marginLeft: 12, fontWeight: 700 }}>({unreadCount}件未読)</span>}</h1>
                    {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead} style={{ background: "transparent", border: "1px solid #374151", color: "#9ca3af", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>すべて既読にする</button>
                    )}
                </div>

                {notifications.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                        <p>通知はまだありません</p>
                    </div>
                ) : (
                    notifications.map(n => {
                        const isClickable = !!n.link;
                        return (
                            <div
                                key={n.id}
                                onClick={() => handleClick(n)}
                                style={{
                                    padding: 16,
                                    marginBottom: 10,
                                    borderRadius: 12,
                                    background: n.is_read ? "#111827" : "rgba(99,102,241,0.1)",
                                    border: n.is_read ? "1px solid #1f2937" : "1px solid rgba(99,102,241,0.4)",
                                    cursor: isClickable ? "pointer" : "default",
                                    display: "flex",
                                    gap: 12,
                                    alignItems: "flex-start",
                                }}
                            >
                                <div style={{ fontSize: 24, flexShrink: 0 }}>{n.icon || "🔔"}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: n.is_read ? "#9ca3af" : "#f9fafb" }}>
                                        {!n.is_read && <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#ef4444", marginRight: 8 }} />}
                                        {n.title}
                                    </div>
                                    {n.message && <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.5, marginBottom: 6 }}>{n.message}</div>}
                                    <div style={{ fontSize: 10, color: "#6b7280" }}>
                                        {new Date(n.created_at).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </main>
    );
}
