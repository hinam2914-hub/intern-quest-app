"use client";

import { useEffect, useState } from "react";

type User = {
    name: string;
    points: number;
};

export default function RankingPage() {
    const [users, setUsers] = useState<User[]>([
        { name: "田中", points: 120 },
        { name: "佐藤", points: 95 },
    ]);
    const [myName, setMyName] = useState("自分");

    useEffect(() => {
        const savedName = localStorage.getItem("myName");
        const savedPoints = localStorage.getItem("myPoints");

        if (savedName) {
            setMyName(savedName);
        }

        if (savedName && savedPoints) {
            const me = { name: savedName, points: Number(savedPoints) };
            const updated = [...users, me].sort((a, b) => b.points - a.points);
            setUsers(updated);
        }
    }, []);

    const getMedal = (index: number) => {
        if (index === 0) return "🥇";
        if (index === 1) return "🥈";
        if (index === 2) return "🥉";
        return "";
    };

    return (
        <main>
            <h1>ランキング</h1>

            <ul>
                {users.map((user, index) => (
                    <li
                        key={index}
                        style={{
                            fontWeight: user.name === myName ? "bold" : "normal",
                            color: user.name === myName ? "deepskyblue" : "inherit",
                        }}
                    >
                        {getMedal(index)} {index + 1}位：{user.name}（{user.points}pt）
                    </li>
                ))}
            </ul>
        </main>
    );
}