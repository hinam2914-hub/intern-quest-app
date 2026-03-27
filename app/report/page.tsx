"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function ReportPage() {
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleSubmit = async () => {
        if (!text) {
            setMessage("日報を書いてください");
            return;
        }

        setLoading(true);

        // ① ユーザー取得（1回だけ）
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setMessage("ログインエラー");
            setLoading(false);
            return;
        }

        // ② 今日の開始時間
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // ③ すでに提出済みかチェック
        const { data: existing } = await supabase
            .from("points_history")
            .select("*")
            .eq("user_id", user.id)
            .gte("created_at", todayStart.toISOString());

        if (existing && existing.length > 0) {
            setMessage("今日はすでに提出済みです");
            setLoading(false);
            return;
        }

        // ④ 日報保存（reportsテーブル）
        await supabase.from("reports").insert({
            user_id: user.id,
            content: text,
            created_at: new Date().toISOString(),
        });

        // ⑤ ポイント付与
        await supabase.from("points_history").insert({
            user_id: user.id,
            change: 10,
            created_at: new Date().toISOString(),
        });

        setMessage("送信完了");
        setText("");
        setLoading(false);
        // ⑥ プロフィール取得
        const { data: profile } = await supabase
            .from("profiles")
            .select("streak, last_report_date")
            .eq("id", user.id)
            .single();

        // 今日（0時）
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 昨日（0時）
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        let newStreak = 1;
        let bonus = 0;

        if (profile?.last_report_date) {
            const last = new Date(profile.last_report_date);
            last.setHours(0, 0, 0, 0);

            if (last.getTime() === yesterday.getTime()) {
                // 連続
                newStreak = (profile.streak || 0) + 1;
            } else if (last.getTime() === today.getTime()) {
                // 今日すでにやってる（基本ここには来ない）
                newStreak = profile.streak || 1;
            } else {
                // 途切れ
                newStreak = 1;
            }
        }

        // ボーナス設定
        if (newStreak === 3) bonus = 20;
        if (newStreak === 7) bonus = 50;

        // ⑦ プロフィール更新
        await supabase.from("profiles").update({
            streak: newStreak,
            last_report_date: new Date().toISOString(),
        }).eq("id", user.id);

        // ⑧ ボーナスポイント付与（あれば）
        if (bonus > 0) {
            await supabase.from("points_history").insert({
                user_id: user.id,
                change: bonus,
                created_at: new Date().toISOString(),
            });
        }
    };

    return (
        <main style={{ padding: 24 }}>
            <h1>日報提出</h1>

            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="今日やったことを書いてください"
                style={{
                    width: "100%",
                    height: 120,
                    marginTop: 12,
                    padding: 8,
                }}
            />

            <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                    marginTop: 12,
                    padding: "8px 16px",
                    cursor: "pointer",
                }}
            >
                {loading ? "送信中..." : "送信"}
            </button>

            {message && (
                <p style={{ marginTop: 12 }}>
                    {message}
                </p>
            )}
        </main>
    );
}