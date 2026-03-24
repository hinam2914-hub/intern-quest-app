"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type RankingUser = {
    id: string;
    name: string;
    points: number;
};

export default function RankingPage() {
    const router = useRouter();

    const [users, setUsers] = useState<RankingUser[]>([]);
    const [myId, setMyId] = useState("");

    useEffect(() => {
        const loadRanking = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            setMyId(user.id);

            const { data: pointRows } = await supabase
                .from("user_points")
                .select("id, points")
                .order("points", { ascending: false });

            if (!pointRows) return;

            const ids = pointRows.map((row) => row.id);

            const { data: profileRows } = await supabase
                .from("profiles")
                .select("id, name")
                .in("id", ids);

            const mergedUsers: RankingUser[] = pointRows.map((pointRow) => {
                const profile = profileRows?.find((p) => p.id === pointRow.id);

                return {
                    id: pointRow.id,
                    name: profile?.name || "名前未設定",
                    points: pointRow.points || 0,
                };
            });

            setUsers(mergedUsers);
        };

        loadRanking();
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
                ランキング
            </h1>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                }}
            >
                {users.map((user, index) => (
                    <div
                        key={user.id}
                        style={{
                            background: user.id === myId ? "#eef2ff" : "#ffffff",
                            border:
                                user.id === myId
                                    ? "2px solid #6366f1"
                                    : "1px solid #e5e7eb",
                            borderRadius: 16,
                            padding: 18,
                            boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <div>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 14,
                                    color: "#6b7280",
                                }}
                            >
                                {index + 1}位
                            </p>

                            <p
                                style={{
                                    margin: "6px 0 0 0",
                                    fontWeight: "bold",
                                    fontSize: 24,
                                    color: user.id === myId ? "#4338ca" : "#111827",
                                }}
                            >
                                {index === 0 ? "🥇 " : index === 1 ? "🥈 " : index === 2 ? "🥉 " : ""}
                                {user.name}
                            </p>
                        </div>

                        <div
                            style={{
                                fontWeight: "bold",
                                fontSize: 28,
                                color: "#111827",
                            }}
                        >
                            {user.points}pt
                        </div>
                    </div>
                ))}
            </div>

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
                    onClick={() => router.push("/report")}
                    style={{
                        background: "#e85b52",
                        color: "#ffffff",
                        fontWeight: "bold",
                        padding: "12px 18px",
                        border: "none",
                        borderRadius: 12,
                        cursor: "pointer",
                    }}
                >
                    日報を書く
                </button>
            </div>
        </main>
    );
}