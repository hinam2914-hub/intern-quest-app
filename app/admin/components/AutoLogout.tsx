"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const SESSION_DURATION_HOURS = 8;
const LOGIN_TIME_KEY = "intern_quest_login_time";

export default function AutoLogout() {
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
            const limitMs = SESSION_DURATION_HOURS * 60 * 60 * 1000;

            if (elapsed >= limitMs) {
                // 8時間経過 → 強制ログアウト
                await supabase.auth.signOut();
                localStorage.removeItem(LOGIN_TIME_KEY);
                alert("セッションの有効期限が切れました。再度ログインしてください。");
                router.push("/login");
            }
        };

        checkSession();

        // 1分ごとにチェック
        const intervalId = setInterval(checkSession, 60 * 1000);

        // Supabaseのauth状態変化を監視
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

    return null;
}