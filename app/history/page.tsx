"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type PointHistory = {
    id: string;
    user_id: string;
    change: number;
    reason: string;
    created_at: string;
};

export default function HistoryPage() {
    const router = useRouter();
    const [history, setHistory] = useState<PointHistory[]>([]);
    const [loading, setLoading] = useState(true);

    const formatReason = (reason: string) => {
        switch (reason) {
            case "login_bonus":
                return "ログインボーナス";
            case "manual_add":
                return "手動追加";
            case "report_submit":
                return "日報提出";
            default:
                return reason;
        }
    };

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

            if (error) {
                console.error(error);
                setLoading(false);
                return;
            }

            setHistory(data || []);
            setLoading(false);
        };

        loadHistory();
    }, [router]);

    return (
        <main
            style={{
                padding: 24,
                maxWidth: 720,
                margin: "0 auto",
            }}
        >
            <h1
                style={{
                    fontSize: 48,
                    fontWeight: "bold",
                    marginBottom: 32,
                }}
            >
                ポイント履歴
            </h1>

            {loading ? (
                <p>読み込み中...</p>
            ) : history.length === 0 ? (
                <div
                    style={{
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 16,
                        padding: 20,
                        color: "#6b7280",
                    }}
                >
                    まだ履歴がありません
                </div>
            ) : (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                    }}
                >
                    {history.map((item) => (
                        <div
                            key={item.id}
                            style={{
                                background: "#ffffff",
                                border: "1px solid #e5e7eb",
                                borderRadius: 16,
                                padding: 16,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                            }}
                        >
                            <div>
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 16,
                                        fontWeight: "bold",
                                        color: "#111827",
                                    }}
                                >
                                    {formatReason(item.reason)}
                                </p>

                                <p
                                    style={{
                                        margin: "6px 0 0 0",
                                        fontSize: 13,
                                        color: "#9ca3af",
                                    }}
                                >
                                    {new Date(item.created_at).toLocaleString("ja-JP")}
                                </p>
                            </div>

                            <div
                                style={{
                                    fontWeight: "bold",
                                    fontSize: 20,
                                    color: item.change >= 0 ? "#111827" : "#ef4444",
                                }}
                            >
                                {item.change > 0 ? `+${item.change}` : item.change}pt
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div
                style={{
                    marginTop: 24,
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                }}
            >
                <button
                    onClick={() => router.push("/mypage")}
                    style={{
                        background: "#0f172a",
                        color: "#ffffff",
                        fontWeight: "bold",
                        padding: "12px 18px",
                        border: "none",
                        borderRadius: 12,
                        cursor: "pointer",
                    }}
                >
                    マイページに戻る
                </button>

                <button
                    onClick={() => router.push("/ranking")}
                    style={{
                        background: "#ffffff",
                        color: "#111827",
                        fontWeight: "bold",
                        padding: "12px 18px",
                        border: "1px solid #d1d5db",
                        borderRadius: 12,
                        cursor: "pointer",
                    }}
                >
                    ランキングを見る
                </button>
            </div>
        </main>
    );
}