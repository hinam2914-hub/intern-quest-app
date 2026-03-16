"use client";

import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();

    const handleLogin = () => {
        const today = new Date().toLocaleDateString();
        const lastLoginDate = localStorage.getItem("lastLoginDate");
        const streak = Number(localStorage.getItem("loginStreak") || "0");

        if (lastLoginDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayText = yesterday.toLocaleDateString();

            if (lastLoginDate === yesterdayText) {
                localStorage.setItem("loginStreak", String(streak + 1));
            } else {
                localStorage.setItem("loginStreak", "1");
            }

            localStorage.setItem("lastLoginDate", today);
        }

        localStorage.setItem("loggedIn", "true");
        router.push("/mypage");
    };

    return (
        <main>
            <h1>ログイン</h1>

            <div>
                <input placeholder="メールアドレス" />
            </div>

            <div>
                <input type="password" placeholder="パスワード" />
            </div>

            <button onClick={handleLogin}>ログイン</button>
        </main>
    );
}