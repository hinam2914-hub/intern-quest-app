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
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(
        date.getHours()
    ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getReasonLabel(reason: string): string {
    switch (reason) {
        case "report_submit":
            return "日報提出";
        case "streak_bonus":
            return "連続ボーナス";
        case "login_bonus":
            return "ログインボーナス";
        default:
            return "その他";
    }
}

export default function HistoryPage() {
    const router = useRouter();
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadHistory = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            const { data, error } = await supabase
                .from("points_history")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (!error && data) {
                setHistory(data);
            }

            setLoading(false);
        };

        loadHistory();
    }, [router]);

    const pageStyle: React.CSSProperties = {
        minHeight: "100vh",
        background: "#f3f4f6",
        padding: "48px 24px",
    };

    const containerStyle: React.CSSProperties = {
        maxWidth: 720,
        margin: "0 auto",
        background: "#ffffff",
        borderRadius: 24,
        padding: 32,
        boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
        border: "1px solid #e5e7eb",
    };

    const cardStyle: React.CSSProperties = {
        padding: 16,
        borderRadius: 16,
        border: "1px solid #e5e7eb",
        marginBottom: 12,
        background: "#ffffff",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    };

    if (loading) {
        return (
            <main style={pageStyle}>
                <div style={{ textAlign: "center", color: "#6b7280" }}>
                    読み込み中...
                </div>
            </main>
        );
    }

    return (
        <main style={pageStyle}>
            <div style={containerStyle}>
                <h1
                    style={{
                        margin: 0,
                        fontSize: 32,
                        fontWeight: 700,
                        marginBottom: 24,
                    }}
                >
                    ポイント履歴
                </h1>

                <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
                    <button
                        onClick={() => router.push("/mypage")}
                        style={{
                            padding: "10px 16px",
                            borderRadius: 10,
                            border: "1px solid #d1d5db",
                            background: "#fff",
                            cursor: "pointer",
                        }}
                    >
                        マイページ
                    </button>

                    <button
                        onClick={() => router.push("/ranking")}
                        style={{
                            padding: "10px 16px",
                            borderRadius: 10,
                            border: "none",
                            background: "#111827",
                            color: "#fff",
                            cursor: "pointer",
                        }}
                    >
                        ランキング
                    </button>
                </div>

                {history.length === 0 && (
                    <div
                        style={{
                            padding: 20,
                            borderRadius: 12,
                            background: "#f9fafb",
                            color: "#6b7280",
                        }}
                    >
                        履歴がありません
                    </div>
                )}

                {history.map((item) => (
                    <div key={item.id} style={cardStyle}>
                        <div>
                            <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
                                {formatDate(item.created_at)}
                            </p>

                            <p
                                style={{
                                    margin: "4px 0 0 0",
                                    fontWeight: 600,
                                }}
                            >
                                {getReasonLabel(item.reason)}
                            </p>
                        </div>

                        <p
                            style={{
                                margin: 0,
                                fontSize: 20,
                                fontWeight: 700,
                                color: item.change > 0 ? "#16a34a" : "#ef4444",
                            }}
                        >
                            {item.change > 0 ? "+" : ""}
                            {item.change}pt
                        </p>
                    </div>
                ))}
            </div>
        </main>
    );
}