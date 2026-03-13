export default function RankingPage() {
    const users = [
        { name: "田中", points: 120 },
        { name: "佐藤", points: 95 },
        { name: "山本", points: 80 },
    ];

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