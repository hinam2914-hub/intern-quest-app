"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function MyPage() {
    const router = useRouter();

    const [name, setName] = useState("自分");
    const [points, setPoints] = useState(0);
    const [reportDone, setReportDone] = useState(false);
    const [levelUpMessage, setLevelUpMessage] = useState("");
    const [loginBonusDone, setLoginBonusDone] = useState(false);

    // 初期読み込み
    useEffect(() => {
        const savedName = localStorage.getItem("myName");
        const savedPoints = localStorage.getItem("myPoints");
        const lastSubmit = localStorage.getItem("lastReportDate");

        const today = new Date().toISOString().slice(0, 10);

        if (savedName) setName(savedName);
        if (savedPoints) setPoints(Number(savedPoints));

        if (lastSubmit === today) {
            setReportDone(true);
            const lastLoginBonusDate = localStorage.getItem("lastLoginBonusDate");

            if (lastLoginBonusDate === today) {
                setLoginBonusDone(true);
            }
        }
    }, []);

    // レベルアップ表示を消す
    useEffect(() => {
        if (levelUpMessage) {
            const timer = setTimeout(() => {
                setLevelUpMessage("");
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [levelUpMessage]);

    const saveName = () => {
        localStorage.setItem("myName", name);
    };

    const addPoints = () => {
        const newPoints = points + 10;
        setPoints(newPoints);
        localStorage.setItem("myPoints", String(newPoints));

        const newLevel = Math.floor(newPoints / 100) + 1;
        const oldLevel = Math.floor(points / 100) + 1;

        if (newLevel > oldLevel) {
            setLevelUpMessage("🎉 レベルアップしました！");
        }
    };

    const logout = () => {
        localStorage.removeItem("loggedIn");
        router.push("/login");
    };

    const level = Math.floor(points / 100) + 1;
    const exp = points % 100;

    const getBadge = () => {
        if (level >= 10) return "🏆 プロ";
        if (level >= 5) return "🥇 上級者";
        if (level >= 3) return "🥈 中級者";
        return "🥉 初心者";
    };

    return (
        <main style={{ padding: 20 }}>
            <h1>マイページ</h1>

            <p>名前</p>
            <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ marginRight: 8 }}
            />
            <button onClick={saveName}>名前を保存</button>

            <p style={{ marginTop: 20 }}>現在ポイント：{points}pt</p>
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

            <p>Level：{level}</p>
            <p>バッジ：{getBadge()}</p>
            <p>EXP：{exp}/100</p>

            {/* EXPバー */}
            <div style={{ width: "100%", background: "#ddd", height: 10 }}>
                <div
                    style={{
                        width: `${exp}%`,
                        background: "skyblue",
                        height: "100%",
                        transition: "width 0.5s ease",
                    }}
                />
            </div>

            {/* レベルアップ表示 */}
            {levelUpMessage && (
                <p style={{ color: "orange", fontWeight: "bold" }}>
                    {levelUpMessage}
                </p>
            )}

            <p style={{ marginTop: 20 }}>
                今日の日報：
                <span style={{ color: reportDone ? "green" : "red", fontWeight: "bold" }}>
                    {reportDone ? "提出済み" : "未提出"}
                </span>
            </p>

            <button onClick={addPoints}>+10ポイント</button>

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
                        marginLeft: 10,
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