"use client";

import { useEffect, useState } from "react";

export default function RankingPage() {
    const [myPoints, setMyPoints] = useState(0);

    useEffect(() => {
        const savedPoints = localStorage.getItem("myPoints");
        if (savedPoints) {
            setMyPoints(Number(savedPoints));
        }
    }, []);

    const users = [
        { name: "自分", points: myPoints },
        { name: "田中", points: 120 },
        { name: "佐藤", points: 95 },
    ];

    const sortedUsers = [...users].sort((a, b) => b.points - a.points);

    return (
        <main>
            <h1>ランキング</h1>

            <ul>
                {sortedUsers.map((user, index) => (
                    <li key={index}>
                        {index + 1}位：{user.name}（{user.points}pt）
                    </li>
                ))}
            </ul>
        </main>
    );
}