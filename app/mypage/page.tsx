"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function MyPage() {
    const router = useRouter();

    const [name, setName] = useState("自分");
    const [points, setPoints] = useState(0);
    const [streak, setStreak] = useState(0);
    const exp = points % 100;
    const level = Math.floor(points / 100) + 1;

    useEffect(() => {
        const loggedIn = localStorage.getItem("loggedIn");
        if (!loggedIn) {
            router.push("/login");
            return;
        }

        const savedName = localStorage.getItem("myName");
        const savedPoints = localStorage.getItem("myPoints");
        const savedStreak = localStorage.getItem("loginStreak");

        if (savedName) {
            setName(savedName);
        }

        if (savedPoints) {
            setPoints(Number(savedPoints));
        }

        if (savedStreak) {
            setStreak(Number(savedStreak));
        }
    }, [router]);

    const saveName = () => {
        localStorage.setItem("myName", name);
    };

    const addPoints = () => {
        const newPoints = points + 10;
        setPoints(newPoints);
        localStorage.setItem("myPoints", String(newPoints));
    };

    const logout = () => {
        localStorage.removeItem("loggedIn");
        router.push("/login");
    };

    const badge =
        points >= 300 ? "🏆 上級者" :
            points >= 200 ? "🥇 成長中" :
                points >= 100 ? "🥈 継続力あり" :
                    "🥉 これから";
    const nextAction =
        points < 50 ? "日報を書いてみましょう" :
            points < 100 ? "ランキングを確認しましょう" :
                "学習コンテンツを進めましょう";
    return (
        <main>
            <h1>マイページ</h1>

            <div>
                <p>名前</p>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <button onClick={saveName}>名前を保存</button>
            </div>

            <p>現在ポイント：{points}pt</p>

            <p>連続ログイン：{streak}日</p>
            <p>Level：{level}</p>
            <p>バッジ：{badge}</p>
            <p>EXP：{exp}/100</p>
            <p>今日のアクション：{nextAction}</p>

            <div style={{
                width: "200px",
                height: "10px",
                background: "#ddd",
                borderRadius: "5px"
            }}>
                <div style={{
                    width: `${exp * 2}px`,
                    height: "10px",
                    background: "deepskyblue",
                    borderRadius: "5px"
                }} />
            </div>
            <button onClick={addPoints}>
                +10ポイント
            </button>

            <br />

            <button onClick={() => router.push("/ranking")}>
                ランキングを見る
            </button>

            <button onClick={() => router.push("/report")}>
                日報を書く
            </button>

            <br />

            <button onClick={logout}>
                ログアウト
            </button>
        </main>
    );
}