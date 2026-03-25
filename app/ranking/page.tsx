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

            // ===== 累計ランキング =====
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

            // ===== 今週ランキング =====
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

            const { data: weeklyProfiles } = await supabase
                .from("profiles")
                .select("id, name")
                .in("id", weeklyIds);

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

    return (
        <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
            <h1 style={{ fontSize: 40, fontWeight: "bold", marginBottom: 24 }}>
                ランキング
            </h1>

            {/* 累計 */}
            <h2 style={{ marginTop: 24 }}>累計ランキング</h2>
            {users.map((user, index) => (
                <div
                    key={user.id}
                    style={{
                        padding: 12,
                        border: "1px solid #ddd",
                        marginTop: 8,
                        background: user.id === myId ? "#eef2ff" : "#fff",
                    }}
                >
                    {index + 1}位：{user.name}（{user.points}pt）
                </div>
            ))}

            {/* 今週 */}
            <h2 style={{ marginTop: 32 }}>今週ランキング</h2>
            {weeklyUsers.map((user, index) => (
                <div
                    key={user.id}
                    style={{
                        padding: 12,
                        border: "1px solid #ddd",
                        marginTop: 8,
                        background: user.id === myId ? "#eef2ff" : "#fff",
                    }}
                >
                    {index + 1}位：{user.name}（{user.points}pt）
                </div>
            ))}

            <button
                onClick={() => router.push("/mypage")}
                style={{ marginTop: 24 }}
            >
                マイページに戻る
            </button>
        </main>
    );
}