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