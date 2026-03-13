"use client";

import { useEffect, useState } from "react";

export default function MyPage() {
    const [name, setName] = useState("自分");
    const [points, setPoints] = useState(0);

    useEffect(() => {
        const savedName = localStorage.getItem("myName");
        const savedPoints = localStorage.getItem("myPoints");

        if (savedName) {
            setName(savedName);
        }

        if (savedPoints) {
            setPoints(Number(savedPoints));
        }
    }, []);

    const saveName = () => {
        localStorage.setItem("myName", name);
    };

    const addPoints = () => {
        const newPoints = points + 10;
        setPoints(newPoints);
        localStorage.setItem("myPoints", String(newPoints));
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

            <button onClick={addPoints}>+10ポイント</button>
        </main>
    );
}