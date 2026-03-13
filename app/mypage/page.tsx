"use client";

import { useState } from "react";

export default function MyPage() {
    const [points, setPoints] = useState(0);

    return (
        <main>
            <h1>マイページ</h1>
            <p>現在ポイント：{points}pt</p>

            <button onClick={() => setPoints(points + 10)}>
                +10ポイント
            </button>
        </main>
    );
}