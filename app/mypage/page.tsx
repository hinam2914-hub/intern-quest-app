"use client";

import { useEffect, useState } from "react";

export default function MyPage() {
    const [points, setPoints] = useState(0);

    useEffect(() => {
        const savedPoints = localStorage.getItem("myPoints");
        if (savedPoints) {
            setPoints(Number(savedPoints));
        }
    }, []);

    const addPoints = () => {
        const newPoints = points + 10;
        setPoints(newPoints);
        localStorage.setItem("myPoints", String(newPoints));
    };

    return (
        <main>
            <h1>マイページ</h1>
            <p>現在ポイント：{points}pt</p>

            <button onClick={addPoints}>+10ポイント</button>
        </main>
    );
}