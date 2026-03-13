"use client";

import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();

    return (
        <main>
            <h1>ログイン</h1>

            <div>
                <input placeholder="メールアドレス" />
            </div>

            <div>
                <input type="password" placeholder="パスワード" />
            </div>

            <button onClick={() => router.push("/mypage")}>
                ログイン
            </button>
        </main>
    );
}