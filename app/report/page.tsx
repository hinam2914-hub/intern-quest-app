"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

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
            router.push("/login");
            return;
        }

        const today = new Date().toISOString().slice(0, 10);

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

        await supabase.from("submissions").insert({
            user_id: user.id,
            content: text,
            created_at: today,
        });

        const { data: pointRow } = await supabase
            .from("user_points")
            .select("points")
            .eq("id", user.id)
            .single();

        const currentPoints = pointRow?.points || 0;
        const newPoints = currentPoints + 20;

        await supabase
            .from("user_points")
            .update({ points: newPoints })
            .eq("id", user.id);

        setMessage("日報提出完了 +20pt");
        setText("");
    };

    return (
        <main style={{ padding: 20, maxWidth: 600, margin: "0 auto" }}>
            <h1>日報</h1>

            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="今日やったことを書く"
                rows={6}
                cols={40}
                style={{ width: "100%", padding: 12, borderRadius: 8 }}
            />

            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                <button
                    onClick={handleSubmit}
                    style={{
                        background: "#111827",
                        color: "#fff",
                        fontWeight: "bold",
                        padding: "10px 14px",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                    }}
                >
                    提出
                </button>

                <button
                    onClick={() => router.push("/mypage")}
                    style={{
                        background: "#fff",
                        color: "#111827",
                        fontWeight: "bold",
                        padding: "10px 14px",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        cursor: "pointer",
                    }}
                >
                    マイページへ戻る
                </button>
            </div>

            <p style={{ marginTop: 12 }}>{message}</p>
        </main>
    );
}