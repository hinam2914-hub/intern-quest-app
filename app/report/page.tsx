"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const getTodayJST = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

export default function ReportPage() {
    const router = useRouter();

    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleSubmit = async () => {
        if (!text) {
            setMessage("日報を書いてください");
            return;
        }

        setLoading(true);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setMessage("ログインエラー");
            setLoading(false);
            return;
        }

        const today = getTodayJST();

        // 連続提出用
        const lastReportDate = localStorage.getItem("lastReportDate") ?? "";
        const reportStreak = Number(localStorage.getItem("reportStreak") ?? "0");

        let newStreak = 1;

        if (lastReportDate) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const y = yesterday.toISOString().slice(0, 10);

            if (lastReportDate === y) {
                newStreak = reportStreak + 1;
            } else {
                newStreak = 1;
            }
        }

        // 同日提出チェック
        const { data: existing } = await supabase
            .from("submissions")
            .select("id")
            .eq("user_id", user.id)
            .eq("created_at", today)
            .maybeSingle();

        if (existing) {
            setMessage("今日はすでに提出済みです");
            setLoading(false);
            return;
        }

        // 日報保存
        const { error: insertError } = await supabase.from("submissions").insert({
            user_id: user.id,
            content: text,
            created_at: today,
        });

        if (insertError) {
            setMessage("日報保存失敗");
            setLoading(false);
            return;
        }

        // 現在ポイント取得
        const { data: userPoint, error: pointError } = await supabase
            .from("user_points")
            .select("points")
            .eq("id", user.id)
            .single();

        if (pointError) {
            setMessage("ポイント取得失敗");
            setLoading(false);
            return;
        }

        let bonus = 10;

        if (newStreak === 2) bonus += 20;
        if (newStreak === 3) bonus += 30;
        if (newStreak === 5) bonus += 50;

        const currentPoints = userPoint?.points || 0;
        const newPoints = currentPoints + bonus;

        // ポイント更新
        const { error: updateError } = await supabase
            .from("user_points")
            .update({ points: newPoints })
            .eq("id", user.id);

        if (updateError) {
            setMessage("ポイント更新失敗");
            setLoading(false);
            return;
        }

        // 履歴保存
        await supabase.from("points_history").insert({
            user_id: user.id,
            change: bonus,
            reason: "report_submit",
        });

        // 連続提出記録
        localStorage.setItem("lastReportDate", today);
        localStorage.setItem("reportStreak", String(newStreak));

        setLoading(false);
        router.push("/mypage");
    };

    return (
        <main
            style={{
                padding: 24,
                maxWidth: 600,
                margin: "0 auto",
            }}
        >
            <h1 style={{ fontSize: 40, fontWeight: "bold", marginBottom: 24 }}>
                日報提出
            </h1>

            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="今日やったことを書いてください"
                rows={8}
                style={{
                    width: "100%",
                    padding: 14,
                    borderRadius: 12,
                    border: "1px solid #d1d5db",
                    fontSize: 16,
                }}
            />

            <div style={{ marginTop: 16 }}>
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                        background: "#111827",
                        color: "#ffffff",
                        fontWeight: "bold",
                        padding: "12px 18px",
                        border: "none",
                        borderRadius: 12,
                        cursor: "pointer",
                    }}
                >
                    {loading ? "送信中..." : "提出する"}
                </button>

                <button
                    onClick={() => router.push("/mypage")}
                    style={{
                        marginLeft: 10,
                        background: "#ffffff",
                        color: "#111827",
                        fontWeight: "bold",
                        padding: "12px 18px",
                        border: "1px solid #d1d5db",
                        borderRadius: 12,
                        cursor: "pointer",
                    }}
                >
                    戻る
                </button>
            </div>

            {message && (
                <p style={{ marginTop: 14, fontWeight: "bold", color: "#ef4444" }}>
                    {message}
                </p>
            )}
        </main>
    );
}