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

            // 累計ランキング
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

            // 今週ランキング用データ取得
            // まずは確実に取るため直近50件を取得
            const { data: weeklyData, error: weeklyError } = await supabase
                .from("points_history")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(50);

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

            const weeklyRankingBase = Object.entries(weeklyTotals)
                .map(([id, points]) => ({
                    id,
                    points,
                }))
                .sort((a, b) => b.points - a.points);

            const weeklyMergedUsers: WeeklyRankingUser[] = weeklyRankingBase.map(
                (row) => {
                    const profile = profileRows?.find((p) => p.id === row.id);

                    return {
                        id: row.id,
                        name: profile?.name || "名前未設定",
                        points: row.points,
                    };
                }
            );

            setWeeklyUsers(weeklyMergedUsers);
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
                                {index === 0 ? "1位 " : index === 1 ? "2位 " : index === 2 ? "3位 " : ""}
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

            <h2
                style={{
                    fontSize: 32,
                    fontWeight: "bold",
                    marginTop: 40,
                    marginBottom: 20,
                }}
            >
                今週ランキング
            </h2>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                }}
            >
                {weeklyUsers.map((user, index) => (
                    <div
                        key={user.id}
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
                                    fontSize: 22,
                                    color: "#111827",
                                }}
                            >
                                {user.name}
                            </p>
                        </div>

                        <div
                            style={{
                                fontWeight: "bold",
                                fontSize: 22,
                                color: "#111827",
                            }}
                        >
                            {user.points}pt
                        </div>
                    </div>
                ))}

                {weeklyUsers.length === 0 && (
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