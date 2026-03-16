"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function MyPage() {
    const router = useRouter();
    const [name, setName] = useState("自分");
    const [points, setPoints] = useState(0);
    const [streak, setStreak] = useState(0);

    useEffect(() => {
        const loggedIn = localStorage.getItem("loggedIn");
        if (!loggedIn) {
            router.push("/login");
            return;
        }
        const savedStreak = localStorage.getItem("loginStreak");
        if (savedStreak) {
            setStreak(Number(savedStreak));
        }

        const savedName = localStorage.getItem("myName");
        const savedPoints = localStorage.getItem("myPoints");

        if (savedName) {
            setName(savedName);
        }

        if (savedPoints) {
            setPoints(Number(savedPoints));
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

    return (
        <main>
            <h1>マイページ</h1>

            <div style={{ marginBottom: 16 }}>
                <p>名前</p>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ marginRight: 8 }}
                />
                <button onClick={saveName}>名前を保存</button>
            </div>

            <p>現在ポイント：{points}pt</p>

            <button onClick={addPoints} style={{ marginRight: 8 }}>
                +10ポイント
            </button>
            <button onClick={() => router.push("/ranking")}>
                ランキングを見る
            </button>
            <button onClick={() => router.push("/report")}>
                日報を書く
            </button>
            <button onClick={logout}>ログアウト</button>
        </main>
    );
}