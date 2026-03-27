"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

type PointHistory = {
    id: string;
    user_id: string;
    change: number;
    reason: string;
    created_at: string;
};

export default function HistoryPage() {
    const router = useRouter();

    useEffect(() => {
        const checkUser = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }
        };

        checkUser();
    }, [router]);
    const [history, setHistory] = useState<PointHistory[]>([]);
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

            const { data } = await supabase
                .from("points_history")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            setHistory(data || []);
            setLoading(false);
        };

        loadHistory();
    }, [router]);

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

    return (
        <main
            style={{
                padding: 24,
                maxWidth: 520,
                margin: "0 auto",
            }}
        >
            <h1 style={{ fontSize: 36, fontWeight: "bold", marginBottom: 24 }}>
                ポイント履歴
            </h1>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {loading && <p>読み込み中...</p>}

                {!loading && history.length === 0 && (
                    <div
                        style={{
                            background: "#ffffff",
                            border: "1px solid #e5e7eb",
                            borderRadius: 12,
                            padding: 16,
                            color: "#6b7280",
                        }}
                    >
                        まだ履歴がありません
                    </div>
                )}

                {history.map((item, index) => (
                    <div
                        key={index}
                        style={{
                            background: "#ffffff",
                            border: "1px solid #e5e7eb",
                            borderRadius: 14,
                            padding: 16,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <div>
                            <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
                                {formatReason(item.reason)}
                            </p>

                            <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "#9ca3af" }}>
                                {new Date(item.created_at).toLocaleString("ja-JP")}
                            </p>
                        </div>

                        <div
                            style={{
                                fontWeight: "bold",
                                fontSize: 16,
                                color: item.change > 0 ? "#2563eb" : "#ef4444",
                            }}
                        >
                            {item.change > 0 ? `+${item.change}` : item.change}pt
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={() => router.push("/mypage")}
                style={{
                    marginTop: 24,
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
        </main>
    );
}