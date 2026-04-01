"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type UserRow = {
    id: string;
    name: string | null;
};

type TopUser = {
    name: string;
    points: number;
};

type TopSubmitter = {
    name: string;
    count: number;
};

function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export default function AdminPage() {
    const router = useRouter();

    const [userCount, setUserCount] = useState(0);
    const [reportCount, setReportCount] = useState(0);
    const [submitRate, setSubmitRate] = useState(0);
    const [topUsers, setTopUsers] = useState<TopUser[]>([]);
    const [topSubmitters, setTopSubmitters] = useState<TopSubmitter[]>([]);
    const [notSubmittedUsers, setNotSubmittedUsers] = useState<UserRow[]>([]);
    const [copied, setCopied] = useState(false);
    const [period, setPeriod] = useState<"today" | "week" | "month">("today");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);

            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            const adminEmails = ["hinam2914@gmail.com"];

            if (!user.email || !adminEmails.includes(user.email)) {
                router.push("/mypage");
                return;
            }

            const { data: profileRows, error: profileError } = await supabase
                .from("profiles")
                .select("id, name");

            if (profileError) {
                console.error(profileError);
                setLoading(false);
                return;
            }

            const users = (profileRows || []) as UserRow[];
            setUserCount(users.length);

            const now = new Date();
            let from = new Date();

            if (period === "week") {
                from.setDate(now.getDate() - 7);
            } else if (period === "month") {
                from.setMonth(now.getMonth() - 1);
            }

            const todayYmd = getTodayJST();

            const { data: submissionRows, error: submissionError } =
                period === "today"
                    ? await supabase
                        .from("submissions")
                        .select("user_id, created_at")
                        .gte("created_at", `${todayYmd}T00:00:00`)
                    : await supabase
                        .from("submissions")
                        .select("user_id, created_at")
                        .gte("created_at", from.toISOString());

            if (submissionError) {
                console.error(submissionError);
                setLoading(false);
                return;
            }

            const submissions = submissionRows || [];
            const submittedIds = [...new Set(submissions.map((row) => row.user_id))];

            setReportCount(submittedIds.length);

            const rate =
                users.length === 0 ? 0 : Math.round((submittedIds.length / users.length) * 100);

            setSubmitRate(rate);

            const notSubmitted = users.filter((u) => !submittedIds.includes(u.id));
            setNotSubmittedUsers(notSubmitted);

            const { data: pointRows, error: pointError } = await supabase
                .from("user_points")
                .select("id, points")
                .order("points", { ascending: false })
                .limit(3);

            if (pointError) {
                console.error(pointError);
                setLoading(false);
                return;
            }

            if (pointRows && pointRows.length > 0) {
                const ids = pointRows.map((u) => u.id);

                const { data: pointProfiles, error: pointProfilesError } = await supabase
                    .from("profiles")
                    .select("id, name")
                    .in("id", ids);

                if (pointProfilesError) {
                    console.error(pointProfilesError);
                    setLoading(false);
                    return;
                }

                const merged: TopUser[] = pointRows.map((row) => {
                    const profile = pointProfiles?.find((p) => p.id === row.id);
                    return {
                        name: profile?.name || "名前未設定",
                        points: row.points || 0,
                    };
                });

                setTopUsers(merged);
            } else {
                setTopUsers([]);
            }

            const countMap: Record<string, number> = {};
            submissions.forEach((row) => {
                countMap[row.user_id] = (countMap[row.user_id] || 0) + 1;
            });

            const sortedSubmitters = Object.entries(countMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);

            const submitterResult: TopSubmitter[] = sortedSubmitters.map(([id, count]) => {
                const profile = users.find((u) => u.id === id);
                return {
                    name: profile?.name || "名前未設定",
                    count,
                };
            });

            setTopSubmitters(submitterResult);
            setLoading(false);
        };

        load();
    }, [period, router]);

    const periodLabel =
        period === "today" ? "今日" : period === "week" ? "今週" : "今月";

    const submitRateColor =
        submitRate >= 80 ? "#16a34a" : submitRate >= 50 ? "#f59e0b" : "#dc2626";

    const copyText = useMemo(() => {
        return notSubmittedUsers.map((u) => u.name || "名前未設定").join("\n");
    }, [notSubmittedUsers]);

    const reminderText = useMemo(() => {
        return `${periodLabel}の日報が未提出の方へ

${notSubmittedUsers.map((u) => `・${u.name || "名前未設定"}`).join("\n")}

確認のうえ、ご対応をお願いいたします。`;
    }, [notSubmittedUsers, periodLabel]);

    const pageStyle: React.CSSProperties = {
        minHeight: "100vh",
        background: "#f3f4f6",
        padding: "48px 24px 64px",
    };

    const containerStyle: React.CSSProperties = {
        maxWidth: 980,
        margin: "0 auto",
        background: "#ffffff",
        borderRadius: 24,
        padding: 32,
        boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
        border: "1px solid #e5e7eb",
    };

    const sectionStyle: React.CSSProperties = {
        marginTop: 32,
    };

    const cardStyle: React.CSSProperties = {
        background: "#ffffff",
        borderRadius: 16,
        padding: 20,
        border: "1px solid #e5e7eb",
        boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
    };

    const labelStyle: React.CSSProperties = {
        fontSize: 12,
        color: "#6b7280",
        margin: 0,
        fontWeight: 600,
    };

    const valueStyle: React.CSSProperties = {
        fontSize: 28,
        fontWeight: 700,
        margin: "8px 0 0 0",
        color: "#111827",
    };

    const primaryButton: React.CSSProperties = {
        background: "#111827",
        color: "#ffffff",
        padding: "10px 16px",
        borderRadius: 10,
        border: "none",
        cursor: "pointer",
        fontWeight: 600,
    };

    const secondaryButton: React.CSSProperties = {
        background: "#ffffff",
        color: "#111827",
        padding: "10px 16px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        cursor: "pointer",
        fontWeight: 600,
    };

    const periodButtonBase: React.CSSProperties = {
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        cursor: "pointer",
        fontWeight: 600,
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
                }}
            >
                読み込み中...
            </main>
        );
    }

    return (
        <main style={pageStyle}>
            <div style={containerStyle}>
                <h1
                    style={{
                        margin: 0,
                        fontSize: 36,
                        fontWeight: 700,
                        color: "#111827",
                    }}
                >
                    管理ダッシュボード
                </h1>

                <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                    <button
                        onClick={() => setPeriod("today")}
                        style={{
                            ...periodButtonBase,
                            background: period === "today" ? "#111827" : "#ffffff",
                            color: period === "today" ? "#ffffff" : "#111827",
                        }}
                    >
                        今日
                    </button>

                    <button
                        onClick={() => setPeriod("week")}
                        style={{
                            ...periodButtonBase,
                            background: period === "week" ? "#111827" : "#ffffff",
                            color: period === "week" ? "#ffffff" : "#111827",
                        }}
                    >
                        今週
                    </button>

                    <button
                        onClick={() => setPeriod("month")}
                        style={{
                            ...periodButtonBase,
                            background: period === "month" ? "#111827" : "#ffffff",
                            color: period === "month" ? "#ffffff" : "#111827",
                        }}
                    >
                        今月
                    </button>
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: 16,
                        marginTop: 24,
                    }}
                >
                    <div style={cardStyle}>
                        <p style={labelStyle}>総ユーザー</p>
                        <p style={valueStyle}>{userCount}</p>
                    </div>

                    <div style={cardStyle}>
                        <p style={labelStyle}>提出数</p>
                        <p style={valueStyle}>{reportCount}</p>
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

                <div style={sectionStyle}>
                    <h2
                        style={{
                            margin: "0 0 12px 0",
                            fontSize: 28,
                            fontWeight: 700,
                            color: "#111827",
                        }}
                    >
                        {periodLabel}の未提出者
                    </h2>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                            onClick={async () => {
                                await navigator.clipboard.writeText(copyText);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 1500);
                            }}
                            style={secondaryButton}
                        >
                            未提出者をコピー
                        </button>

                        <button
                            onClick={async () => {
                                await navigator.clipboard.writeText(reminderText);
                            }}
                            style={primaryButton}
                        >
                            リマインド文をコピー
                        </button>
                    </div>

                    {copied && (
                        <p style={{ marginTop: 10, color: "#6b7280" }}>コピーしました</p>
                    )}

                    <div style={{ marginTop: 18 }}>
                        {notSubmittedUsers.length > 0 ? (
                            notSubmittedUsers.map((u) => (
                                <div
                                    key={u.id}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "12px 14px",
                                        borderRadius: 12,
                                        border: "1px solid #fca5a5",
                                        background: "#fff5f5",
                                        marginBottom: 10,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontWeight: 600,
                                            color: "#7f1d1d",
                                        }}
                                    >
                                        {u.name || "名前未設定"}
                                    </span>

                                    <a
                                        href={`https://line.me/R/msg/text/?${encodeURIComponent(
                                            `${u.name || ""}さん、日報の提出をお願いします。`
                                        )}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                            fontSize: 12,
                                            color: "#2563eb",
                                            textDecoration: "underline",
                                        }}
                                    >
                                        連絡
                                    </a>
                                </div>
                            ))
                        ) : (
                            <div
                                style={{
                                    padding: 16,
                                    borderRadius: 12,
                                    background: "#f9fafb",
                                    color: "#6b7280",
                                    border: "1px solid #e5e7eb",
                                }}
                            >
                                全員提出済み（{periodLabel}）
                            </div>
                        )}
                    </div>
                </div>

                <div style={sectionStyle}>
                    <h2
                        style={{
                            margin: "0 0 12px 0",
                            fontSize: 28,
                            fontWeight: 700,
                            color: "#111827",
                        }}
                    >
                        ポイント上位
                    </h2>

                    {topUsers.length > 0 ? (
                        topUsers.map((u, i) => (
                            <div
                                key={i}
                                style={{
                                    padding: "12px 14px",
                                    borderRadius: 12,
                                    border: "1px solid #e5e7eb",
                                    background: "#ffffff",
                                    marginBottom: 10,
                                }}
                            >
                                {i + 1}位：{u.name}（{u.points}pt）
                            </div>
                        ))
                    ) : (
                        <div
                            style={{
                                padding: 16,
                                borderRadius: 12,
                                background: "#f9fafb",
                                color: "#6b7280",
                                border: "1px solid #e5e7eb",
                            }}
                        >
                            データがありません
                        </div>
                    )}
                </div>

                <div style={sectionStyle}>
                    <h2
                        style={{
                            margin: "0 0 12px 0",
                            fontSize: 28,
                            fontWeight: 700,
                            color: "#111827",
                        }}
                    >
                        提出数ランキング
                    </h2>

                    {topSubmitters.length > 0 ? (
                        topSubmitters.map((u, i) => (
                            <div
                                key={i}
                                style={{
                                    padding: "12px 14px",
                                    borderRadius: 12,
                                    border: "1px solid #e5e7eb",
                                    background: "#ffffff",
                                    marginBottom: 10,
                                }}
                            >
                                {i + 1}位：{u.name}（{u.count}回）
                            </div>
                        ))
                    ) : (
                        <div
                            style={{
                                padding: 16,
                                borderRadius: 12,
                                background: "#f9fafb",
                                color: "#6b7280",
                                border: "1px solid #e5e7eb",
                            }}
                        >
                            データがありません
                        </div>
                    )}
                </div>

                <div style={sectionStyle}>
                    <button onClick={() => router.push("/ranking")} style={primaryButton}>
                        ランキングを見る
                    </button>
                </div>
            </div>
        </main>
    );
}