"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
    const router = useRouter();

    const [message, setMessage] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = () => {
        const today = new Date().toISOString().slice(0, 10);
        const lastLoginBonusDate = localStorage.getItem("lastLoginBonusDate");

        if (lastLoginBonusDate !== today) {
            const currentPoints = Number(localStorage.getItem("myPoints") || "0");
            const newPoints = currentPoints + 5;

            localStorage.setItem("myPoints", String(newPoints));
            localStorage.setItem("lastLoginBonusDate", today);
            setMessage("本日のログインボーナス +5pt");
        } else {
            setMessage("本日のログインボーナスは受取済みです");
        }

        localStorage.setItem("loggedIn", "true");

        setTimeout(() => {
            router.push("/mypage");
        }, 1000);
    };

    return (
        <main style={{ padding: 20 }}>
            <h1>ログイン</h1>

            <div style={{ marginBottom: 12 }}>
                <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="メールアドレス"
                />
            </div>

            <div style={{ marginBottom: 12 }}>
                <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="パスワード"
                />
            </div>

            <button onClick={handleLogin}>ログイン</button>

            <p>{message}</p>
        </main>
    );
}