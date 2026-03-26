"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type RankingUser = {
    id: string;
    name: string;
    points: number;
};

type WeeklyRankingUser = {
    id: string;
    name: string;
    points: number;
};

export default function RankingPage() {
    const router = useRouter();

    const [users, setUsers] = useState<RankingUser[]>([]);
    const [weeklyUsers, setWeeklyUsers] = useState<WeeklyRankingUser[]>([]);
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

            const { data: pointRows, error: pointError } = await supabase
                .from("user_points")
                .select("id, points")
                .order("points", { ascending: false });

            if (pointError || !pointRows) {
                console.error(pointError);
                return;
            }

            const ids = pointRows.map((row) => row.id);

            const { data: profileRows, error: profileError } = await supabase
                .from("profiles")
                .select("id, name")
                .in("id", ids);

            if (profileError) {
                console.error(profileError);
                return;
            }

            const mergedUsers: RankingUser[] = pointRows.map((pointRow) => {
                const profile = profileRows?.find((p) => p.id === pointRow.id);

                return {
                    id: pointRow.id,
                    name: profile?.name || "名前未設定",
                    points: pointRow.points || 0,
                };
            });

            setUsers(mergedUsers);

            const now = new Date();
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);

            const { data: weeklyData, error: weeklyError } = await supabase
                .from("points_history")
                .select("*")
                .gte("created_at", oneWeekAgo.toISOString());

            if (weeklyError) {
                console.error(weeklyError);
                return;
            }

            const weeklyTotals: Record<string, number> = {};

            weeklyData?.forEach((item) => {
                if (!weeklyTotals[item.user_id]) {
                    weeklyTotals[item.user_id] = 0;
                }
                weeklyTotals[item.user_id] += item.change;
            });

            const weeklyIds = Object.keys(weeklyTotals);

            const { data: weeklyProfiles, error: weeklyProfileError } = await supabase
                .from("profiles")
                .select("id, name")
                .in("id", weeklyIds);

            if (weeklyProfileError) {
                console.error(weeklyProfileError);
                return;
            }

            const weeklyMergedUsers: WeeklyRankingUser[] = weeklyIds
                .map((id) => {
                    const profile = weeklyProfiles?.find((p) => p.id === id);

                    return {
                        id,
                        name: profile?.name || "名前未設定",
                        points: weeklyTotals[id],
                    };
                })
                .sort((a, b) => b.points - a.points);

            setWeeklyUsers(weeklyMergedUsers);
        };

        loadRanking();
    }, [router]);

    const getRankLabel = (index: number) => {
        if (index === 0) return "1位";
        if (index === 1) return "2位";
        if (index === 2) return "3位";
        return `${index + 1}位`;
    };

    const renderRankingCard = (
        user: { id: string; name: string; points: number },
        index: number,
        highlightMine = false
    ) => (
        <div
            key={user.id}
            style={{
                background: highlightMine ? "#eef2ff" : "#ffffff",
                border: highlightMine ? "2px solid #6366f1" : "1px solid #e5e7eb",
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
                    {getRankLabel(index)}
                </p>

                <p
                    style={{
                        margin: "6px 0 0 0",
                        fontWeight: "bold",
                        fontSize: 24,
                        color: highlightMine ? "#4338ca" : "#111827",
                    }}
                >
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
    );

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

            <section style={{ marginTop: 12 }}>
                <h2
                    style={{
                        fontSize: 32,
                        fontWeight: "bold",
                        marginBottom: 16,
                    }}
                >
                    累計ランキング
                </h2>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {users.map((user, index) =>
                        renderRankingCard(user, index, user.id === myId)
                    )}
                </div>
            </section>

            <section style={{ marginTop: 42 }}>
                <h2
                    style={{
                        fontSize: 32,
                        fontWeight: "bold",
                        marginBottom: 16,
                    }}
                >
                    今週ランキング
                </h2>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {weeklyUsers.length > 0 ? (
                        weeklyUsers.map((user, index) =>
                            renderRankingCard(user, index, user.id === myId)
                        )
                    ) : (
                        <div
                            style={{
                                background: "#ffffff",
                                border: "1px solid #e5e7eb",
                                borderRadius: 16,
                                padding: 16,
                                color: "#6b7280",
                            }}
                        >
                            今週ランキングのデータがありません
                        </div>
                    )}
                </div>
            </section>

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