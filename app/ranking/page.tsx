"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type RankingUser = {
    id: string;
    name: string;
    points: number;
};

function getOneWeekAgoISO(): string {
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);
    return oneWeekAgo.toISOString();
}

function getRankLabel(index: number): string {
    return `${index + 1}位`;
}

export default function RankingPage() {
    const router = useRouter();

    const [users, setUsers] = useState<RankingUser[]>([]);
    const [weeklyUsers, setWeeklyUsers] = useState<RankingUser[]>([]);
    const [myId, setMyId] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadRanking = async () => {
            setLoading(true);

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

            if (pointError) {
                console.error(pointError);
                setLoading(false);
                return;
            }

            const totalRows = pointRows || [];
            const ids = totalRows.map((row) => row.id);

            const { data: profileRows, error: profileError } = await supabase
                .from("profiles")
                .select("id, name")
                .in("id", ids);

            if (profileError) {
                console.error(profileError);
                setLoading(false);
                return;
            }

            const mergedUsers: RankingUser[] = totalRows.map((pointRow) => {
                const profile = profileRows?.find((p) => p.id === pointRow.id);

                return {
                    id: pointRow.id,
                    name: profile?.name || "名前未設定",
                    points: pointRow.points || 0,
                };
            });

            setUsers(mergedUsers);

            // 今週ランキング
            const { data: weeklyData, error: weeklyError } = await supabase
                .from("points_history")
                .select("user_id, change, created_at")
                .gte("created_at", getOneWeekAgoISO());

            if (weeklyError) {
                console.error(weeklyError);
                setLoading(false);
                return;
            }

            const weeklyTotals: Record<string, number> = {};

            (weeklyData || []).forEach((item) => {
                weeklyTotals[item.user_id] = (weeklyTotals[item.user_id] || 0) + item.change;
            });

            const weeklyIds = Object.keys(weeklyTotals);

            if (weeklyIds.length === 0) {
                setWeeklyUsers([]);
                setLoading(false);
                return;
            }

            const { data: weeklyProfiles, error: weeklyProfileError } = await supabase
                .from("profiles")
                .select("id, name")
                .in("id", weeklyIds);

            if (weeklyProfileError) {
                console.error(weeklyProfileError);
                setLoading(false);
                return;
            }

            const weeklyMergedUsers: RankingUser[] = weeklyIds
                .map((id) => {
                    const profile = weeklyProfiles?.find((p) => p.id === id);

                    return {
                        id,
                        name: profile?.name || "名前未設定",
                        points: weeklyTotals[id] || 0,
                    };
                })
                .sort((a, b) => b.points - a.points);

            setWeeklyUsers(weeklyMergedUsers);
            setLoading(false);
        };

        loadRanking();
    }, [router]);

    const pageStyle: React.CSSProperties = {
        minHeight: "100vh",
        background: "#f3f4f6",
        padding: "48px 24px 64px",
    };

    const containerStyle: React.CSSProperties = {
        maxWidth: 960,
        margin: "0 auto",
        background: "#ffffff",
        borderRadius: 24,
        padding: 32,
        boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
        border: "1px solid #e5e7eb",
    };

    const titleStyle: React.CSSProperties = {
        margin: 0,
        fontSize: 36,
        fontWeight: 700,
        color: "#111827",
    };

    const sectionTitleStyle: React.CSSProperties = {
        margin: "0 0 14px 0",
        fontSize: 28,
        fontWeight: 700,
        color: "#111827",
    };

    const rankCardStyle = (
        highlightMine: boolean,
        index: number
    ): React.CSSProperties => ({
        background:
            index === 0
                ? "#fef3c7"
                : highlightMine
                    ? "#eef2ff"
                    : "#ffffff",
        border:
            index === 0
                ? "1px solid #f59e0b"
                : highlightMine
                    ? "2px solid #6366f1"
                    : "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 18,
        marginBottom: 12,
        boxShadow: "0 6px 18px rgba(0,0,0,0.04)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
    });

    const renderRankingList = (list: RankingUser[]) => {
        if (list.length === 0) {
            return (
                <div
                    style={{
                        background: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        borderRadius: 16,
                        padding: 18,
                        color: "#6b7280",
                    }}
                >
                    データがありません
                </div>
            );
        }

        return list.map((user, index) => {
            const highlightMine = user.id === myId;

            return (
                <div key={user.id} style={rankCardStyle(highlightMine, index)}>
                    <div>
                        <p
                            style={{
                                margin: 0,
                                fontSize: 13,
                                color: "#6b7280",
                                fontWeight: 600,
                            }}
                        >
                            {getRankLabel(index)}
                        </p>

                        <p
                            style={{
                                margin: "8px 0 0 0",
                                fontSize: 24,
                                fontWeight: 700,
                                color: highlightMine ? "#4338ca" : "#111827",
                            }}
                        >
                            {user.name}
                        </p>
                    </div>

                    <p
                        style={{
                            margin: 0,
                            fontSize: 28,
                            fontWeight: 700,
                            color: "#111827",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {user.points}pt
                    </p>
                </div>
            );
        });
    };

    if (loading) {
        return (
            <main
                style={{
                    minHeight: "100vh",
                    background: "#f3f4f6",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    color: "#6b7280",
                    fontSize: 16,
                }}
            >
                読み込み中...
            </main>
        );
    }

    return (
        <main style={pageStyle}>
            <div style={containerStyle}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        flexWrap: "wrap",
                        alignItems: "flex-start",
                        marginBottom: 28,
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
                            ランキング
                        </p>
                        <h1 style={titleStyle}>ランキング</h1>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                        }}
                    >
                        <button
                            onClick={() => router.push("/mypage")}
                            style={{
                                background: "#ffffff",
                                color: "#111827",
                                padding: "12px 18px",
                                borderRadius: 12,
                                border: "1px solid #d1d5db",
                                cursor: "pointer",
                                fontWeight: 700,
                            }}
                        >
                            マイページに戻る
                        </button>

                        <button
                            onClick={() => router.push("/report")}
                            style={{
                                background: "#ef5b4d",
                                color: "#ffffff",
                                padding: "12px 18px",
                                borderRadius: 12,
                                border: "none",
                                cursor: "pointer",
                                fontWeight: 700,
                            }}
                        >
                            日報を書く
                        </button>

                        <button
                            onClick={() => router.push("/admin")}
                            style={{
                                background: "#0f172a",
                                color: "#ffffff",
                                padding: "12px 18px",
                                borderRadius: 12,
                                border: "none",
                                cursor: "pointer",
                                fontWeight: 700,
                            }}
                        >
                            管理画面へ
                        </button>
                    </div>
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 24,
                    }}
                >
                    <section>
                        <h2 style={sectionTitleStyle}>累計ランキング</h2>
                        {renderRankingList(users)}
                    </section>

                    <section>
                        <h2 style={sectionTitleStyle}>今週ランキング</h2>
                        {renderRankingList(weeklyUsers)}
                    </section>
                </div>
            </div>
        </main>
    );
}