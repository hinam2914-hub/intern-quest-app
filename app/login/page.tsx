"use client";

import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();

    const handleLogin = () => {
        const today = new Date().toISOString().slice(0, 10);
        const lastLoginBonusDate = localStorage.getItem("lastLoginBonusDate");

        if (lastLoginBonusDate !== today) {
            const currentPoints = Number(localStorage.getItem("myPoints") || "0");
            const newPoints = currentPoints + 5;

            localStorage.setItem("myPoints", String(newPoints));
            localStorage.setItem("lastLoginBonusDate", today);
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