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
            const lastLoginDate = localStorage.getItem("lastLoginDate");
            const loginToday = new Date().toISOString().slice(0, 10);

            let newStreak = 1;

            if (lastLoginDate) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().slice(0, 10);

                if (lastLoginDate === yesterdayStr) {
                    newStreak = Number(savedStreak || "0") + 1;
                } else if (lastLoginDate === loginToday) {
                    newStreak = Number(savedStreak || "1");
                }
            }

            setStreak(newStreak);
            localStorage.setItem("loginStreak", String(newStreak));
            localStorage.setItem("lastLoginDate", loginToday);
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
                .maybeSingle();

            setReportDone(!!submission);

            if (lastLoginBonusDate === today) {
                setLoginBonusDone(true);
            } else {
                setLoginBonusDone(false);
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

    const saveName = async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        await supabase.from("profiles").upsert({
            id: user.id,
            name: name,
        });
    };

    const addPoints = () => {
        const oldLevel = Math.floor(points / 100) + 1;
        const newPoints = points + 10;
        const newLevel = Math.floor(newPoints / 100) + 1;

        setPoints(newPoints);
        localStorage.setItem("myPoints", String(newPoints));

        if (newLevel > oldLevel) {
            setLevelUpMessage("レベルアップしました");
            setTimeout(() => setLevelUpMessage(""), 2000);
        }
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

    return (
        <main
            style={{
                padding: 20,
                maxWidth: 500,
                margin: "0 auto",
            }}
        >
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
                <p>現在ポイント：{points}pt</p>

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

                {!loginBonusDone && (
                    <button
                        onClick={() => {
                            const today = new Date().toISOString().slice(0, 10);
                            const newPoints = points + 20;

                            setPoints(newPoints);
                            localStorage.setItem("myPoints", String(newPoints));

                            localStorage.setItem("lastLoginBonusDate", today);
                            setLoginBonusDone(true);
                        }}
                        style={{
                            marginTop: 10,
                            background: "#10b981",
                            color: "#fff",
                            padding: "8px 12px",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                        }}
                    >
                        ログインボーナス受取（+20pt）
                    </button>
                )}

                <p>現在順位：{rank}位</p>
                <p>連続ログイン：{streak}日</p>

                <p style={{ fontWeight: "bold" }}>Level：{level}</p>

                <p>
                    バッジ：
                    <span
                        style={{
                            marginLeft: 8,
                            padding: "4px 10px",
                            background: "#111827",
                            color: "#fff",
                            borderRadius: "999px",
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
                    }}
                >
                    <div
                        style={{
                            width: `${exp}%`,
                            background: "#6366f1",
                            height: "100%",
                        }}
                    />
                </div>

                {levelUpMessage && <p>{levelUpMessage}</p>}

                <p style={{ marginTop: 10 }}>
                    今日の日報：{reportDone ? "提出済み" : "未提出"}
                </p>
            </div>

            <div style={{ marginTop: 20 }}>
                <button onClick={addPoints}>+10ポイント</button>
                <button onClick={() => router.push("/ranking")}>
                    ランキング
                </button>
                <button onClick={() => router.push("/report")}>
                    日報を書く
                </button>
                <button onClick={logout}>ログアウト</button>
            </div>
        </main>
    );
}