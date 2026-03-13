"use client";

export default function RankingPage() {
    const users = [
        { name: "自分", points: 50 },
        { name: "田中", points: 120 },
        { name: "佐藤", points: 95 },
    ];

    return (
        <main>
            <h1>ランキング</h1>

            <ul>
                {users
                    .sort((a, b) => b.points - a.points)
                    .map((user, index) => (
                        <li key={index}>
                            {index + 1}位：{user.name}（{user.points}pt）
                        </li>
                    ))}
            </ul>
        </main>
    );
}