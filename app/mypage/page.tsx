"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function MyPage() {
    const router = useRouter();

    const [name, setName] = useState("自分");
    const [points, setPoints] = useState(0);
    const [rank, setRank] = useState(0);
    const [streak, setStreak] = useState(0);
    const [reportDone, setReportDone] = useState(false);
    const [loginBonusDone, setLoginBonusDone] = useState(false);
    const [levelUpMessage, setLevelUpMessage] = useState("");

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

            const currentName = profile?.name || "自分";
            const savedPoints = localStorage.getItem("myPoints");
            const savedStreak = localStorage.getItem("loginStreak");
            const lastLoginBonusDate = localStorage.getItem("lastLoginBonusDate");

            const today = new Date().toISOString().slice(0, 10);
            const currentPoints = savedPoints ? Number(savedPoints) : 0;

            setName(currentName);
            setPoints(currentPoints);

            if (savedStreak) {
                setStreak(Number(savedStreak));
            }

            const { data: submission } = await supabase
                .from("submissions")
                .select("id")
                .eq("user_id", user.id)
                .eq("created_at", today)
                .maybeSingle();

            if (submission) {
                setReportDone(true);
            }

            if (lastLoginBonusDate === today) {
                setLoginBonusDone(true);
            }

            const rankingUsers = [
                { name: currentName, points: currentPoints },
                { name: "田中", points: 120 },
                { name: "佐藤", points: 95 },
            ].sort((a, b) => b.points - a.points);

            const myRank =
                rankingUsers.findIndex((userItem) => userItem.name === currentName) + 1;

            setRank(myRank);
        };

        loadPage();
    }, [router]);

    useEffect(() => {
        if (levelUpMessage) {
            const timer = setTimeout(() => {
                setLevelUpMessage("");
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [levelUpMessage]);

    const saveName = async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        await supabase.from("profiles").upsert({
            id: user.id,
            name: name,
        });

        const currentPoints = Number(localStorage.getItem("myPoints") || "0");

        const rankingUsers = [
            { name, points: currentPoints },
            { name: "田中", points: 120 },
            { name: "佐藤", points: 95 },
        ].sort((a, b) => b.points - a.points);

        const myRank =
            rankingUsers.findIndex((userItem) => userItem.name === name) + 1;

        setRank(myRank);
    };

    const addPoints = () => {
        const oldLevel = Math.floor(points / 100) + 1;
        const newPoints = points + 10;
        const newLevel = Math.floor(newPoints / 100) + 1;

        setPoints(newPoints);
        localStorage.setItem("myPoints", String(newPoints));

        if (newLevel > oldLevel) {
            setLevelUpMessage("レベルアップしました");
        }

        const rankingUsers = [
            { name, points: newPoints },
            { name: "田中", points: 120 },
            { name: "佐藤", points: 95 },
        ].sort((a, b) => b.points - a.points);

        const myRank =
            rankingUsers.findIndex((userItem) => userItem.name === name) + 1;

        setRank(myRank);
    };

    const logout = async () => {
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
        <main style={{ padding: 20, maxWidth: 600 }}>
            <h1>マイページ</h1>

            <p>名前</p>
            <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ marginRight: 8 }}
            />
            <button onClick={saveName}>名前を保存</button>

            <div
                style={{
                    background: "#ffffff",
                    borderRadius: 16,
                    padding: 20,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    marginTop: 20,
                }}
            >
                <p style={{ marginTop: 0 }}>現在ポイント：{points}pt</p>

                <p>
                    今日のログインボーナス：
                    <span
                        style={{
                            color: loginBonusDone ? "green" : "red",
                            fontWeight: "bold",
                        }}
                    >
                        {loginBonusDone ? "受取済み" : "未受取"}
                    </span>
                </p>

                <p>現在順位：{rank}位</p>

                <p>連続ログイン：{streak}日</p>

                <p style={{ fontWeight: "bold", fontSize: 18 }}>
                    Level：{level}
                </p>

                <p style={{ marginTop: 8 }}>
                    バッジ：
                    <span
                        style={{
                            marginLeft: 8,
                            padding: "4px 10px",
                            background: "#111827",
                            color: "#ffffff",
                            borderRadius: "999px",
                            fontSize: 12,
                            display: "inline-block",
                        }}
                    >
                        {badge}
                    </span>
                </p>

                <p>EXP：{exp}/100</p>

                <div
                    style={{
                        width: "100%",
                        background: "#e5e7eb",
                        height: 12,
                        borderRadius: 999,
                        overflow: "hidden",
                        marginTop: 8,
                        marginBottom: 16,
                    }}
                >
                    <div
                        style={{
                            width: `${exp}%`,
                            background: "linear-gradient(90deg, #6366f1, #a78bfa)",
                            height: "100%",
                            transition: "width 0.5s ease",
                            borderRadius: 999,
                        }}
                    />
                </div>

                {levelUpMessage && (
                    <p style={{ color: "orange", fontWeight: "bold" }}>
                        {levelUpMessage}
                    </p>
                )}

                <p>今日のアクション：{nextAction}</p>

                <p
                    style={{
                        color: reportDone ? "green" : "red",
                        fontWeight: "bold",
                    }}
                >
                    今日の日報：{reportDone ? "提出済み" : "未提出"}
                </p>
            </div>

            <button onClick={addPoints} style={{ marginTop: 20 }}>
                +10ポイント
            </button>

            <div style={{ marginTop: 20 }}>
                <button onClick={() => router.push("/ranking")}>
                    ランキングを見る
                </button>

                <button
                    onClick={() => router.push("/report")}
                    disabled={reportDone}
                    style={{
                        background: reportDone ? "#ccc" : "red",
                        color: reportDone ? "black" : "white",
                        fontWeight: "bold",
                        padding: "8px 12px",
                        border: "none",
                        borderRadius: "5px",
                        marginTop: "10px",
                        marginLeft: "10px",
                        cursor: reportDone ? "not-allowed" : "pointer",
                        opacity: reportDone ? 0.7 : 1,
                    }}
                >
                    日報を書く
                </button>
            </div>

            <div style={{ marginTop: 20 }}>
                <button onClick={logout}>ログアウト</button>
            </div>
        </main>
    );
}