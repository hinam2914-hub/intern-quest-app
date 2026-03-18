"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type User = {
    name: string;
    points: number;
};

export default function RankingPage() {
    const router = useRouter();

    const [users, setUsers] = useState<User[]>([]);
    const [myName, setMyName] = useState("自分");
    const [myRank, setMyRank] = useState(0);

    useEffect(() => {
        const loadRanking = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("name")
                .eq("id", user.id)
                .single();

            const currentName = profile?.name || "自分";
            const currentPoints = Number(localStorage.getItem("myPoints") || "0");

            const rankingUsers: User[] = [
                { name: currentName, points: currentPoints },
                { name: "田中", points: 120 },
                { name: "佐藤", points: 95 },
                { name: "鈴木", points: 80 },
                { name: "高橋", points: 60 },
            ].sort((a, b) => b.points - a.points);

            setUsers(rankingUsers);
            setMyName(currentName);

            const rank =
                rankingUsers.findIndex((userItem) => userItem.name === currentName) + 1;
            setMyRank(rank);
        };

        loadRanking();
    }, [router]);

    const getMedal = (index: number) => {
        if (index === 0) return "1";
        if (index === 1) return "2";
        if (index === 2) return "3";
        return index + 1;
    };

    return (
        <main
            style={{
                padding: 20,
                maxWidth: 600,
                margin: "0 auto",
            }}
        >
            <h1>ランキング</h1>

            <div
                style={{
                    background: "#ffffff",
                    borderRadius: 16,
                    padding: 20,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    marginTop: 20,
                    marginBottom: 20,
                }}
            >
                <p style={{ margin: 0, fontWeight: "bold", fontSize: 18 }}>
                    あなたの順位：{myRank}位
                </p>
            </div>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                }}
            >
                {users.map((user, index) => (
                    <div
                        key={index}
                        style={{
                            background: user.name === myName ? "#eef2ff" : "#ffffff",
                            border: user.name === myName ? "2px solid #6366f1" : "1px solid #e5e7eb",
                            borderRadius: 14,
                            padding: 16,
                            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <div>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 14,
                                    color: "#6b7280",
                                }}
                            >
                                {getMedal(index)}位
                            </p>

                            <p
                                style={{
                                    margin: "6px 0 0 0",
                                    fontWeight: "bold",
                                    fontSize: 18,
                                    color: user.name === myName ? "#4338ca" : "#111827",
                                }}
                            >
                                {user.name}
                            </p>
                        </div>

                        <div
                            style={{
                                fontWeight: "bold",
                                fontSize: 18,
                                color: "#111827",
                            }}
                        >
                            {user.points}pt
                        </div>
                    </div>
                ))}
            </div>

            <div
                style={{
                    marginTop: 20,
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                }}
            >
                <button
                    onClick={() => router.push("/mypage")}
                    style={{
                        background: "#111827",
                        color: "#ffffff",
                        fontWeight: "bold",
                        padding: "10px 14px",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                    }}
                >
                    マイページに戻る
                </button>

                <button
                    onClick={() => router.push("/report")}
                    style={{
                        background: "#ef4444",
                        color: "#ffffff",
                        fontWeight: "bold",
                        padding: "10px 14px",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                    }}
                >
                    日報を書く
                </button>
            </div>
        </main>
    );
}