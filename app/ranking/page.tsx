"use client";

import { useEffect, useState } from "react";

export default function RankingPage() {
    const [users, setUsers] = useState([
        { name: "田中", points: 120 },
        { name: "佐藤", points: 95 },
    ]);

    useEffect(() => {
        const myName = localStorage.getItem("myName");
        const myPoints = localStorage.getItem("myPoints");

        if (myName && myPoints) {
            const me = { name: myName, points: Number(myPoints) };

            const updated = [...users, me].sort((a, b) => b.points - a.points);

            setUsers(updated);
        }
    }, []);

    return (
        <main>
            <h1>ランキング</h1>

            <ul>
                {users.map((user, index) => (
                    <li key={index}>
                        {index + 1}位：{user.name}（{user.points}pt）
                    </li>
                ))}
            </ul>
        </main>
    );
}