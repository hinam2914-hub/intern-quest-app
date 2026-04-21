"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type HistoryItem = {
    id: number;
    change: number;
    created_at: string;
    reason: string;
};

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric", month: "numeric", day: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

function getReasonLabel(reason: string): string {
    switch (reason) {
        case "report_submit": return "日報提出";
        case "streak_bonus": return "連続ボーナス";
        case "login_bonus": return "ログインボーナス";
        case "manual_add": return "手動追加";
        case "content_complete": return "学習完了";
        case "thanks_received": return "サンキュー受領";
        case "shop_purchase": return "ショップ購入";
        case "admin_edit": return "管理者編集";
        default: return "その他";
    }
}

function getReasonIcon(reason: string): string {
    switch (reason) {
        case "report_submit": return "📋";
        case "streak_bonus": return "🔥";
        case "login_bonus": return "🎁";
        case "manual_add": return "⚡";
        case "content_complete": return "📚";
        case "thanks_received": return "🎉";
        case "shop_purchase": return "🛍️";
        case "admin_edit": return "⚙️";
        default: return "✨";
    }
}

export default function HistoryPage() {
    const router = useRouter();
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalPoints, setTotalPoints] = useState(0);

    useEffect(() => {
        const loadHistory = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }

            const { data, error } = await supabase
                .from("points_history").select("*").eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (!error && data) {
                setHistory(data);
                setTotalPoints(data.reduce((sum, item) => sum + (item.change > 0 ? item.change : 0), 0));
            }
            setLoading(false);
        };
        loadHistory();
    }, [router]);

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>

            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.06) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto" }}>

                {/* ヘッダー */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                    <div>
                        <div onClick={() => router.push("/menu")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer" }}>INTERN QUEST</div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>ポイント履歴</h1>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => router.push("/mypage")} style={{ background: "rgba(255,255,255,0.05)", color: "#d1d5db", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>マイページ</button>
                        <button onClick={() => router.push("/ranking")} style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", padding: "8px 16px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>ランキング</button>
                    </div>
                </div>

                {/* サマリーカード */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>TOTAL EARNED</div>
                        <div style={{ fontSize: 36, fontWeight: 800, color: "#f9fafb" }}>{totalPoints.toLocaleString()}</div>
                        <div style={{ fontSize: 14, color: "#6366f1", fontWeight: 600 }}>pt</div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>TOTAL ACTIONS</div>
                        <div style={{ fontSize: 36, fontWeight: 800, color: "#f9fafb" }}>{history.length}</div>
                        <div style={{ fontSize: 14, color: "#34d399", fontWeight: 600 }}>回</div>
                    </div>
                </div>

                {/* 履歴リスト */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>ACTIVITY LOG</div>

                    {history.length === 0 ? (
                        <div style={{ color: "#6b7280", fontSize: 14, padding: 16 }}>履歴がありません</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {history.map((item) => (
                                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                                            {getReasonIcon(item.reason)}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: "#d1d5db" }}>{getReasonLabel(item.reason)}</div>
                                            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{formatDate(item.created_at)}</div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: item.change > 0 ? "#34d399" : "#f87171" }}>
                                        {item.change > 0 ? `+${item.change}` : item.change}pt
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