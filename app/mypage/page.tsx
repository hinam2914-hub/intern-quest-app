"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function MyPage() {
    const router = useRouter();

    const [name, setName] = useState("");
    const [points, setPoints] = useState(0);
    const [streak, setStreak] = useState(1);
    const [loginBonusDone, setLoginBonusDone] = useState(false);

    useEffect(() => {
        const loadPage = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("name")
                .eq("id", user.id)
                .single();

            const { data: pointData } = await supabase
                .from("user_points")
                .select("points")
                .eq("id", user.id)
                .single();

            const currentName = profile?.name || "自分";
            const currentPoints = pointData?.points || 0;

            setName(currentName);
            setPoints(currentPoints);

            const savedStreak = localStorage.getItem("loginStreak");
            const lastLoginDate = localStorage.getItem("lastLoginDate");
            const lastBonusDate = localStorage.getItem("lastLoginBonusDate");
            const today = new Date().toISOString().slice(0, 10);

            let newStreak = 1;

            if (lastLoginDate) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().slice(0, 10);

                if (lastLoginDate === yesterdayStr) {
                    newStreak = Number(savedStreak || "0") + 1;
                } else if (lastLoginDate === today) {
                    newStreak = Number(savedStreak || "1");
                }
            }

            setStreak(newStreak);
            localStorage.setItem("loginStreak", String(newStreak));
            localStorage.setItem("lastLoginDate", today);

            if (lastBonusDate === today) {
                setLoginBonusDone(true);
            } else {
                setLoginBonusDone(false);
            }
        };

        loadPage();
    }, [router]);

    const handleSaveName = async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        await supabase.from("profiles").upsert({
            id: user.id,
            name,
        });
    };

    const handleLoginBonus = async () => {
        const today = new Date().toISOString().slice(0, 10);
        const newPoints = points + 20;

        setPoints(newPoints);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        await supabase
            .from("user_points")
            .update({ points: newPoints })
            .eq("id", user.id);

        localStorage.setItem("lastLoginBonusDate", today);
        setLoginBonusDone(true);
    };

    const handleAddPoint = async () => {
        const newPoints = points + 10;
        setPoints(newPoints);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        await supabase
            .from("user_points")
            .update({ points: newPoints })
            .eq("id", user.id);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    const level = Math.floor(points / 100) + 1;
    const exp = points % 100;

    const badge =
        points >= 300
            ? "🏆 上級者"
            : points >= 200
                ? "🥇 成長中"
                : points >= 100
                    ? "🥈 継続力あり"
                    : "🥉 これから";

    const nextAction =
        points < 50
            ? "日報を書いてみましょう"
            : points < 100
                ? "ランキングを確認しましょう"
                : "学習コンテンツを進めましょう";

    return (
        <main
            style={{
                padding: 24,
                maxWidth: 520,
                margin: "0 auto",
            }}
        >
            <h1 style={{ fontSize: 48, fontWeight: "bold", marginBottom: 32 }}>
                マイページ
            </h1>

            <p style={{ marginBottom: 8, fontWeight: "bold" }}>名前</p>

            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                        flex: 1,
                        padding: "10px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: 8,
                        fontSize: 16,
                    }}
                />
                <button
                    onClick={handleSaveName}
                    style={{
                        background: "#ffffff",
                        color: "#111827",
                        fontWeight: "bold",
                        padding: "10px 14px",
                        border: "1px solid #d1d5db",
                        borderRadius: 8,
                        cursor: "pointer",
                    }}
                >
                    名前を保存
                </button>
            </div>

            <div
                style={{
                    background: "#ffffff",
                    borderRadius: 20,
                    padding: 28,
                    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                    marginTop: 12,
                }}
            >
                <p style={{ fontSize: 20, fontWeight: "bold", marginTop: 0 }}>
                    現在ポイント：{points}pt
                </p>

                <p style={{ marginTop: 24, marginBottom: 0 }}>
                    今日のログインボーナス：
                    <span
                        style={{
                            marginLeft: 8,
                            color: loginBonusDone ? "#2e7d32" : "#ef4444",
                            fontWeight: "bold",
                        }}
                    >
                        {loginBonusDone ? "受取済み" : "未受取"}
                    </span>
                </p>

                {!loginBonusDone && (
                    <button
                        onClick={handleLoginBonus}
                        style={{
                            marginTop: 14,
                            background: "#56b87e",
                            color: "#ffffff",
                            fontWeight: "bold",
                            padding: "12px 16px",
                            border: "none",
                            borderRadius: 10,
                            cursor: "pointer",
                        }}
                    >
                        ログインボーナス受取（+20pt）
                    </button>
                )}

                <p style={{ marginTop: 26 }}>現在順位：3位</p>

                <p style={{ marginTop: 22 }}>連続ログイン：{streak}日</p>

                <p
                    style={{
                        marginTop: 28,
                        fontWeight: "bold",
                        fontSize: 22,
                    }}
                >
                    Level：{level}
                </p>

                <p style={{ marginTop: 20 }}>
                    バッジ：
                    <span
                        style={{
                            marginLeft: 8,
                            padding: "6px 14px",
                            background: "#0f172a",
                            color: "#ffffff",
                            borderRadius: 999,
                            fontWeight: "bold",
                            display: "inline-block",
                        }}
                    >
                        {badge}
                    </span>
                </p>

                <p style={{ marginTop: 26, fontSize: 18 }}>EXP：{exp}/100</p>

                <div
                    style={{
                        width: "100%",
                        background: "#e5e7eb",
                        height: 14,
                        borderRadius: 999,
                        overflow: "hidden",
                        marginTop: 12,
                        marginBottom: 24,
                    }}
                >
                    <div
                        style={{
                            width: `${exp}%`,
                            background: "linear-gradient(90deg, #5b5ce2, #9b83ea)",
                            height: "100%",
                            borderRadius: 999,
                            transition: "width 0.4s ease",
                        }}
                    />
                </div>

                <p style={{ fontSize: 18 }}>今日のアクション：{nextAction}</p>

                <p
                    style={{
                        marginTop: 24,
                        color: "#ef4444",
                        fontWeight: "bold",
                        fontSize: 18,
                    }}
                >
                    今日の日報：未提出
                </p>
            </div>

            <div
                style={{
                    marginTop: 26,
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                }}
            >
                <button
                    onClick={handleAddPoint}
                    style={{
                        background: "linear-gradient(90deg, #5b5ce2, #6d63f5)",
                        color: "#ffffff",
                        fontWeight: "bold",
                        padding: "12px 18px",
                        border: "none",
                        borderRadius: 12,
                        cursor: "pointer",
                    }}
                >
                    +10ポイント
                </button>

                <button
                    onClick={() => router.push("/ranking")}
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
                    ランキングを見る
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

                <button
                    onClick={handleLogout}
                    style={{
                        background: "#ffffff",
                        color: "#111827",
                        fontWeight: "bold",
                        padding: "12px 18px",
                        border: "1px solid #d1d5db",
                        borderRadius: 12,
                        cursor: "pointer",
                    }}
                >
                    ログアウト
                </button>
            </div>
        </main>
    );
}