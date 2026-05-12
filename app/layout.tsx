"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./lib/supabase";

const TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8時間
const LOGIN_TIME_KEY = "intern_quest_login_time";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    // セッション期限チェック
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        localStorage.removeItem(LOGIN_TIME_KEY);
        return;
      }

      const loginTime = localStorage.getItem(LOGIN_TIME_KEY);
      if (!loginTime) {
        // ログイン時刻が未記録なら今を記録
        localStorage.setItem(LOGIN_TIME_KEY, Date.now().toString());
        return;
      }

      const elapsed = Date.now() - parseInt(loginTime, 10);

      if (elapsed >= TIMEOUT_MS) {
        // 8時間経過 → 強制ログアウト
        await supabase.auth.signOut();
        localStorage.removeItem(LOGIN_TIME_KEY);
        alert("セッションの有効期限が切れました。再度ログインしてください。");
        router.push("/login");
      }
    };

    // 初回チェック
    checkSession();

    // 1分ごとにチェック
    const intervalId = setInterval(checkSession, 60 * 1000);

    // ログイン/ログアウトのイベント監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        // ログイン時に時刻を記録
        localStorage.setItem(LOGIN_TIME_KEY, Date.now().toString());
      } else if (event === "SIGNED_OUT") {
        localStorage.removeItem(LOGIN_TIME_KEY);
      }
    });

    return () => {
      clearInterval(intervalId);
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <html lang="ja">
      <body>
        {children}
      </body>
    </html>
  );
}