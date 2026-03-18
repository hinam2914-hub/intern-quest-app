"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function MyPage() {
    const [name, setName] = useState("");
    const [points, setPoints] = useState(0);
    const [streak, setStreak] = useState(1);
    const [loginBonusDone, setLoginBonusDone] = useState(false);

    useEffect(() => {
        const loadPage = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) return;

            // 名前取得
            const { data: profile } = await supabase
                .from("profiles")
                .select("name")
                .eq("id", user.id)
                .single();

            setName(profile?.name || "自分");

            // ポイント取得（←ここがDB）
            const { data: pointData } = await supabase
                .from("user_points")
                .select("points")
                .eq("id", user.id)
                .single();

            setPoints(pointData?.points || 0);

            // ストリーク（localStorageのままでOK）
            const savedStreak = localStorage.getItem("loginStreak");
            const lastLoginDate = localStorage.getItem("lastLoginDate");

            const today = new Date().toISOString().slice(0, 10);

            let newStreak = 1;

            if (lastLoginDate) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().slice(0, 10);

                if (lastLoginDate === yesterdayStr) {
                    newStreak = Number(savedStreak || "0") + 1;
                } else if (lastLoginDate === today) {
                    newStreak = Number(savedStreak || "1");
                }
            }

            setStreak(newStreak);

            localStorage.setItem("loginStreak", String(newStreak));
            localStorage.setItem("lastLoginDate", today);

            // ログインボーナス判定
            const lastBonusDate = localStorage.getItem("lastLoginBonusDate");

            if (lastBonusDate === today) {
                setLoginBonusDone(true);
            }
        };

        loadPage();
    }, []);

    // ログインボーナス
    const handleLoginBonus = async () => {
        const today = new Date().toISOString().slice(0, 10);

        const newPoints = points + 20;
        setPoints(newPoints);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        await supabase
            .from("user_points")
            .update({ points: newPoints })
            .eq("id", user.id);

        localStorage.setItem("lastLoginBonusDate", today);
        setLoginBonusDone(true);
    };

    // +10ポイント
    const handleAddPoint = async () => {
        const newPoints = points + 10;
        setPoints(newPoints);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        await supabase
            .from("user_points")
            .update({ points: newPoints })
            .eq("id", user.id);
    };

    return (
        <div style={{ padding: "20px" }}>
            <h1>マイページ</h1>

            <p>名前：{name}</p>
            <p>現在ポイント：{points} pt</p>

            <p>
                今日のログインボーナス：
                {loginBonusDone ? "受取済み" : "未受取"}
            </p>

            {!loginBonusDone && (
                <button onClick={handleLoginBonus}>
                    ログインボーナス受取（+20pt）
                </button>
            )}

            <p>連続ログイン：{streak}日</p>

            <button onClick={handleAddPoint}>+10ポイント</button>
        </div>
    );
}