"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AdminPage() {
    const [userCount, setUserCount] = useState(0);
    const [todayReports, setTodayReports] = useState(0);
    const [submitRate, setSubmitRate] = useState(0);
    const [topUsers, setTopUsers] = useState<any[]>([]);

    useEffect(() => {
        const load = async () => {
            // ユーザー数
            const { count: users } = await supabase
                .from("profiles")
                .select("*", { count: "exact", head: true });

            // 今日の日報
            const today = new Date().toISOString().slice(0, 10);

            const { count: reports } = await supabase
                .from("submissions")
                .select("*", { count: "exact", head: true })
                .eq("created_at", today);

            setUserCount(users || 0);
            setTodayReports(reports || 0);

            // 提出率（ここが今回の追加）
            const rate =
                (users || 0) === 0
                    ? 0
                    : Math.round(((reports || 0) / (users || 0)) * 100);

            setSubmitRate(rate);

            // 上位3人
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

            <div style={{ marginBottom: 24 }}>
                <p>総ユーザー数：{userCount}人</p>
                <p>今日の日報提出数：{todayReports}件</p>
                <p>日報提出率：{submitRate}%</p>
            </div>

            <div>
                <h2 style={{ marginBottom: 12 }}>ポイント上位</h2>

                {topUsers.map((u, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                        {i + 1}位：{u.name}（{u.points}pt）
                    </div>
                ))}
            </div>
        </main>
    );
}