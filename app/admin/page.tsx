"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type UserRow = {
    id: string;
    name: string | null;
};

type TopUser = {
    name: string;
    points: number;
};

export default function AdminPage() {
    const [userCount, setUserCount] = useState(0);
    const [todayReports, setTodayReports] = useState(0);
    const [submitRate, setSubmitRate] = useState(0);
    const [topUsers, setTopUsers] = useState<TopUser[]>([]);
    const [notSubmittedUsers, setNotSubmittedUsers] = useState<UserRow[]>([]);
    const [copied, setCopied] = useState(false);
    const [period, setPeriod] = useState<"today" | "week" | "month">("today");

    useEffect(() => {
        const load = async () => {
            const { data: allUsers } = await supabase
                .from("profiles")
                .select("id, name");

            const users = (allUsers || []) as UserRow[];
            setUserCount(users.length);

            const now = new Date();
            let from = new Date();

            if (period === "week") {
                from.setDate(now.getDate() - 7);
            } else if (period === "month") {
                from.setMonth(now.getMonth() - 1);
            }

            const today = now.toISOString().slice(0, 10);

            const { data: reports } =
                period === "today"
                    ? await supabase
                        .from("submissions")
                        .select("user_id")
                        .eq("created_at", today)
                    : await supabase
                        .from("submissions")
                        .select("user_id")
                        .gte("created_at", from.toISOString());

            const reportList = reports || [];
            setTodayReports(reportList.length);

            const rate =
                users.length === 0
                    ? 0
                    : Math.round((reportList.length / users.length) * 100);

            setSubmitRate(rate);

            const submittedIds = reportList.map((r) => r.user_id);
            const notSubmitted = users.filter((u) => !submittedIds.includes(u.id));
            setNotSubmittedUsers(notSubmitted);

            const { data: pointRows } = await supabase
                .from("user_points")
                .select("id, points")
                .order("points", { ascending: false })
                .limit(3);

            if (!pointRows) {
                setTopUsers([]);
                return;
            }

            const ids = pointRows.map((u) => u.id);

            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, name")
                .in("id", ids);

            const merged: TopUser[] = pointRows.map((row) => {
                const profile = profiles?.find((p) => p.id === row.id);
                return {
                    name: profile?.name || "名前未設定",
                    points: row.points || 0,
                };
            });

            setTopUsers(merged);
        };

        load();
    }, [period]);

    const copyText = notSubmittedUsers
        .map((u) => u.name || "名前未設定")
        .join("\n");

    const periodLabel =
        period === "today" ? "今日" : period === "week" ? "今週" : "今月";

    const cardStyle: React.CSSProperties = {
        flex: 1,
        background: "#f9fafb",
        borderRadius: 12,
        padding: 16,
        border: "1px solid #e5e7eb",
    };

    const labelStyle: React.CSSProperties = {
        fontSize: 12,
        color: "#6b7280",
        margin: 0,
    };

    const valueStyle: React.CSSProperties = {
        fontSize: 24,
        fontWeight: "bold",
        margin: "6px 0 0 0",
    };
    const submitRateColor =
        submitRate >= 80 ? "#16a34a" : submitRate >= 50 ? "#f59e0b" : "#dc2626";
    return (
        <main
            style={{
                padding: 24,
                maxWidth: 760,
                margin: "0 auto",
            }}
        >
            <div
                style={{
                    background: "#ffffff",
                    padding: 28,
                    borderRadius: 16,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                }}
            >
                <h1 style={{ fontSize: 42, fontWeight: "bold", marginBottom: 20 }}>
                    管理ダッシュボード
                </h1>

                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <button onClick={() => setPeriod("today")}>今日</button>
                    <button onClick={() => setPeriod("week")}>今週</button>
                    <button onClick={() => setPeriod("month")}>今月</button>
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                    <div style={cardStyle}>
                        <p style={labelStyle}>総ユーザー</p>
                        <p style={valueStyle}>{userCount}</p>
                    </div>

                    <div style={cardStyle}>
                        <p style={labelStyle}>提出数</p>
                        <p style={valueStyle}>{todayReports}</p>
                    </div>

                    <div style={cardStyle}>
                        <p style={labelStyle}>{periodLabel}提出率</p>
                        <p style={{ ...valueStyle, color: submitRateColor }}>{submitRate}%</p>
                    </div>
                    <div style={cardStyle}>
                        <p style={labelStyle}>未提出者数</p>
                        <p style={{ ...valueStyle, color: "#dc2626" }}>
                            {notSubmittedUsers.length}
                        </p>
                    </div>
                </div>

                <div style={{ marginTop: 28, marginBottom: 28 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            marginBottom: 12,
                            flexWrap: "wrap",
                        }}
                    >
                        <h2 style={{ margin: 0 }}>{periodLabel}の未提出者</h2>

                        <button
                            onClick={async () => {
                                await navigator.clipboard.writeText(copyText);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 1500);
                            }}
                            style={{
                                background: "#ffffff",
                                color: "#111827",
                                fontWeight: "bold",
                                padding: "10px 14px",
                                border: "1px solid #d1d5db",
                                borderRadius: 10,
                                cursor: "pointer",
                            }}
                        >
                            未提出者をコピー
                        </button>
                    </div>

                    {copied && <p style={{ marginTop: 8 }}>コピーしました</p>}

                    <div style={{ marginTop: 16 }}>
                        {notSubmittedUsers.length > 0 ? (
                            notSubmittedUsers.map((u) => (
                                <div
                                    key={u.id}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        background: "#fef2f2",      // 薄い赤
                                        border: "1px solid #dc2626", // 赤枠
                                        borderRadius: 10,
                                        padding: "10px 12px",
                                        marginBottom: 8,
                                    }}
                                >
                                    <span style={{ fontWeight: "bold", color: "#7f1d1d" }}>
                                        {u.name || "名前未設定"}
                                    </span>

                                    <a
                                        href={`https://line.me/R/msg/text/?${encodeURIComponent(
                                            `${u.name || ""}さん、日報の提出をお願いします。`
                                        )}`}
                                        target="_blank"
                                    >
                                        連絡
                                    </a>
                                </div>
                            ))
                        ) : (
                            <p style={{ color: "#6b7280" }}>全員提出済み（{periodLabel}）</p>
                        )}
                    </div>
                </div>

                <div>
                    <h2 style={{ marginBottom: 12 }}>ポイント上位</h2>

                    {topUsers.map((u, i) => (
                        <div
                            key={i}
                            style={{
                                background: "#fff",
                                border: "1px solid #e5e7eb",
                                borderRadius: 10,
                                padding: "10px 12px",
                                marginBottom: 8,
                            }}
                        >
                            {i + 1}位：{u.name}（{u.points}pt）
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}