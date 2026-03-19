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
    const [message, setMessage] = useState("");

    const handleSubmit = async () => {
        if (!text) {
            setMessage("日報を書いてください");
            return;
        }

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setMessage("ログイン情報がありません");
            return;
        }

        const today = getTodayJST();

        const { data: existing } = await supabase
            .from("submissions")
            .select("id")
            .eq("user_id", user.id)
            .eq("created_at", today)
            .maybeSingle();

        if (existing) {
            setMessage("今日はすでに提出済みです");
            return;
        }

        const { error: insertError } = await supabase.from("submissions").insert({
            user_id: user.id,
            content: text,
            created_at: today,
        });

        if (insertError) {
            setMessage("日報の保存に失敗しました");
            return;
        }

        const { data: userPoint, error: pointError } = await supabase
            .from("user_points")
            .select("points")
            .eq("id", user.id)
            .single();

        if (pointError) {
            setMessage("ポイント取得に失敗しました");
            return;
        }

        const currentPoints = userPoint?.points || 0;

        const { error: updateError } = await supabase
            .from("user_points")
            .update({ points: currentPoints + 10 })
            .eq("id", user.id);

        if (updateError) {
            setMessage("ポイント更新に失敗しました");
            return;
        }

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
                日報を書く
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
                    resize: "vertical",
                }}
            />

            <div
                style={{
                    marginTop: 12,
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                }}
            >
                <button
                    onClick={handleSubmit}
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
                    提出
                </button>

                <button
                    onClick={() => router.push("/mypage")}
                    style={{
                        background: "#ffffff",
                        color: "#111827",
                        fontWeight: "bold",
                        padding: "12px 18px",
                        border: "1px solid #d1d5db",
                        borderRadius: 12,
                        cursor: "pointer",
                    }}
                >
                    マイページへ戻る
                </button>
            </div>

            {message && (
                <p style={{ marginTop: 14, fontWeight: "bold" }}>
                    {message}
                </p>
            )}
        </main>
    );
}