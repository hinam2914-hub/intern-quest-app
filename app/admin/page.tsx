"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AdminPage() {
    const [userCount, setUserCount] = useState(0);
    const [todayReports, setTodayReports] = useState(0);
    const [submitRate, setSubmitRate] = useState(0);
    const [topUsers, setTopUsers] = useState<any[]>([]);
    const [notSubmittedUsers, setNotSubmittedUsers] = useState<any[]>([]);
    const [copied, setCopied] = useState(false);
    const copyText = notSubmittedUsers
        .map((u) => u.name || "名前未設定")
        .join("\n");
    const sortedNotSubmitted = [...notSubmittedUsers].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
    );
    useEffect(() => {
        const load = async () => {
            // ■全ユーザー取得
            const { data: allUsers } = await supabase
                .from("profiles")
                .select("id, name");

            const users = allUsers || [];
            const [period, setPeriod] = useState<"today" | "week" | "month">("today");


            setUserCount(users.length);

            // ■今日の日報
            const today = new Date().toISOString().slice(0, 10);

            const { data: reports } = await supabase
                .from("submissions")
                .select("user_id")
                .eq("created_at", today);

            const reportList = reports || [];

            setTodayReports(reportList.length);

            // ■提出率
            const rate =
                users.length === 0
                    ? 0
                    : Math.round((reportList.length / users.length) * 100);

            setSubmitRate(rate);

            // ■提出済みユーザーID
            const submittedIds = reportList.map((r) => r.user_id);

            // ■未提出者
            const notSubmitted = users.filter(
                (u) => !submittedIds.includes(u.id)
            );

            setNotSubmittedUsers(notSubmitted);

            // ■上位3人
            const { data: pointRows } = await supabase
                .from("user_points")
                .select("id, points")
                .order("points", { ascending: false })
                .limit(3);

            if (!pointRows) return;

            const ids = pointRows.map((u) => u.id);

            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, name")
                .in("id", ids);

            const merged = pointRows.map((row) => {
                const p = profiles?.find((x) => x.id === row.id);
                return {
                    name: p?.name || "名前未設定",
                    points: row.points,

                    const { data: reports } = await supabase
                        .from("submissions")
                        .select("user_id")
                        .gte("created_at", from.toISOString());
                };
            });

            setTopUsers(merged);
        };

        load();
    }, []);

    return (
        <main style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
            <h1 style={{ fontSize: 40, fontWeight: "bold", marginBottom: 24 }}>
                管理ダッシュボード
            </h1>

            {/* KPI */}
            <div style={{ marginBottom: 24 }}>
                <p>総ユーザー数：{userCount}人</p>
                <p>今日の日報提出数：{todayReports}件</p>
                <p>日報提出率：{submitRate}%</p>
            </div>

            {/* 未提出者 */}
            <div style={{ marginBottom: 24 }}>
                <h2>未提出者</h2>

                {notSubmittedUsers.length > 0 ? (
                    notSubmittedUsers.map((u) => (
                        <div key={u.id}>
                            ・{u.name || "名前未設定"}
                        </div>
                    ))
                ) : (
                    <p>全員提出済み</p>
                )}
            </div>

            {/* TOP3 */}
            <div>
                <h2 style={{ marginBottom: 12 }}>ポイント上位</h2>

                {topUsers.map((u, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                        {i + 1}位：{u.name}（{u.points}pt）
                    </div>
                ))}
            </div>
            <button
                onClick={async () => {
                    await navigator.clipboard.writeText(copyText);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                }}
                style={{
                    marginTop: 8,
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    cursor: "pointer",
                }}
            >
                未提出者をコピー
            </button>

            {copied && <p style={{ fontSize: 12 }}>コピーしました</p>}
            {notSubmittedUsers.map((u) => (
                <div
                    key={u.id}
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                    }}
                >
                    <span>・{u.name || "名前未設定"}</span>

                    <a
                        href={`https://line.me/R/msg/text/?${encodeURIComponent(
                            `${u.name || ""}さん、日報の提出をお願いします。`
                        )}`}
                        target="_blank"
                        style={{ fontSize: 12 }}
                    >
                        連絡
                    </a>
                </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button onClick={() => setPeriod("today")}>今日</button>
                <button onClick={() => setPeriod("week")}>今週</button>
                <button onClick={() => setPeriod("month")}>今月</button>
            </div>
        </main>
    );
}