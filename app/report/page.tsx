"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function toJSTDateOnly(value: string): string {
    const date = new Date(value);
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export default function ReportPage() {
    const router = useRouter();
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleSubmit = async () => {
        if (!text.trim()) {
            setMessage("日報を書いてください");
            return;
        }

        setLoading(true);
        setMessage("");

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setMessage("ログインエラー");
            setLoading(false);
            return;
        }

        const todayYmd = getTodayJST();
        const nowIso = new Date().toISOString();

        // 1. 今日すでに提出済みか確認
        const { data: todaySubmissionRows, error: todaySubmissionError } =
            await supabase
                .from("submissions")
                .select("id, created_at")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

        if (todaySubmissionError) {
            setMessage("提出状況の確認に失敗しました");
            setLoading(false);
            return;
        }

        const alreadySubmittedToday =
            todaySubmissionRows?.some(
                (row) => toJSTDateOnly(row.created_at) === todayYmd
            ) || false;

        if (alreadySubmittedToday) {
            setMessage("今日はすでに提出済みです");
            setLoading(false);
            return;
        }

        // 2. submissions に保存
        const { error: submissionError } = await supabase.from("submissions").insert({
            user_id: user.id,
            content: text.trim(),
            created_at: nowIso,
        });

        if (submissionError) {
            setMessage("日報の保存に失敗しました");
            setLoading(false);
            return;
        }

        // 3. 現在ポイント取得
        const { data: pointRow, error: pointFetchError } = await supabase
            .from("user_points")
            .select("points")
            .eq("id", user.id)
            .single();

        if (pointFetchError) {
            setMessage("ポイント取得に失敗しました");
            setLoading(false);
            return;
        }

        let addPoints = 10;
        const currentPoints = pointRow?.points || 0;

        // 4. streak 計算
        const { data: profileRow, error: profileError } = await supabase
            .from("profiles")
            .select("streak, last_report_date")
            .eq("id", user.id)
            .single();

        if (profileError) {
            setMessage("プロフィール取得に失敗しました");
            setLoading(false);
            return;
        }

        let newStreak = 1;
        let bonus = 0;

        if (profileRow?.last_report_date) {
            const lastYmd = toJSTDateOnly(profileRow.last_report_date);

            const todayDate = new Date(todayYmd);
            const yesterdayDate = new Date(todayDate);
            yesterdayDate.setDate(todayDate.getDate() - 1);

            const yesterdayYmd = `${yesterdayDate.getFullYear()}-${String(
                yesterdayDate.getMonth() + 1
            ).padStart(2, "0")}-${String(yesterdayDate.getDate()).padStart(2, "0")}`;

            if (lastYmd === yesterdayYmd) {
                newStreak = (profileRow.streak || 0) + 1;
            } else {
                newStreak = 1;
            }
        }

        if (newStreak === 3) bonus = 20;
        if (newStreak === 7) bonus = 50;

        addPoints += bonus;

        // 5. user_points 更新
        const { error: pointUpdateError } = await supabase
            .from("user_points")
            .update({
                points: currentPoints + addPoints,
            })
            .eq("id", user.id);

        if (pointUpdateError) {
            setMessage("ポイント更新に失敗しました");
            setLoading(false);
            return;
        }

        // 6. points_history に通常ポイント追加
        const historyInserts: {
            user_id: string;
            change: number;
            created_at: string;
            reason: string;
        }[] = [
                {
                    user_id: user.id,
                    change: 10,
                    created_at: nowIso,
                    reason: "report_submit",
                },
            ];

        if (bonus > 0) {
            historyInserts.push({
                user_id: user.id,
                change: bonus,
                created_at: nowIso,
                reason: "streak_bonus",
            });
        }

        const { error: historyError } = await supabase
            .from("points_history")
            .insert(historyInserts);

        if (historyError) {
            setMessage("ポイント履歴の保存に失敗しました");
            setLoading(false);
            return;
        }

        // 7. profiles の streak 更新
        const { error: profileUpdateError } = await supabase
            .from("profiles")
            .update({
                streak: newStreak,
                last_report_date: nowIso,
            })
            .eq("id", user.id);

        if (profileUpdateError) {
            setMessage("連続提出情報の更新に失敗しました");
            setLoading(false);
            return;
        }

        // 8. 完了メッセージ
        if (bonus > 0) {
            setMessage(
                `日報を提出しました。+10pt、連続提出ボーナス +${bonus}pt を獲得しました`
            );
        } else {
            setMessage("日報を提出しました。+10pt 獲得しました");
        }

        setText("");
        setLoading(false);
    };

    return (
        <main
            style={{
                minHeight: "100vh",
                background: "#f3f4f6",
                padding: "48px 24px",
            }}
        >
            <div
                style={{
                    maxWidth: 760,
                    margin: "0 auto",
                    background: "#ffffff",
                    borderRadius: 24,
                    padding: 32,
                    boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
                    border: "1px solid #e5e7eb",
                }}
            >
                <h1
                    style={{
                        margin: 0,
                        fontSize: 36,
                        fontWeight: 700,
                        color: "#111827",
                    }}
                >
                    日報提出
                </h1>

                <p
                    style={{
                        margin: "10px 0 0 0",
                        color: "#6b7280",
                        fontSize: 15,
                    }}
                >
                    今日やったことを記録してください
                </p>

                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="今日やったことを書いてください"
                    style={{
                        width: "100%",
                        height: 220,
                        marginTop: 20,
                        padding: 16,
                        borderRadius: 16,
                        border: "1px solid #d1d5db",
                        fontSize: 15,
                        lineHeight: 1.7,
                        outline: "none",
                        resize: "vertical",
                        boxSizing: "border-box",
                    }}
                />

                <div
                    style={{
                        display: "flex",
                        gap: 12,
                        marginTop: 20,
                        flexWrap: "wrap",
                    }}
                >
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        style={{
                            background: "#ef5b4d",
                            color: "#ffffff",
                            padding: "12px 18px",
                            borderRadius: 12,
                            border: "none",
                            cursor: "pointer",
                            fontWeight: 700,
                        }}
                    >
                        {loading ? "送信中..." : "日報を送信"}
                    </button>

                    <button
                        onClick={() => router.push("/mypage")}
                        style={{
                            background: "#ffffff",
                            color: "#111827",
                            padding: "12px 18px",
                            borderRadius: 12,
                            border: "1px solid #d1d5db",
                            cursor: "pointer",
                            fontWeight: 700,
                        }}
                    >
                        マイページに戻る
                    </button>
                </div>

                {message && (
                    <div
                        style={{
                            marginTop: 18,
                            padding: "14px 16px",
                            borderRadius: 12,
                            background: "#eff6ff",
                            border: "1px solid #bfdbfe",
                            color: "#1d4ed8",
                            fontWeight: 600,
                        }}
                    >
                        {message}
                    </div>
                )}
            </div>
        </main>
    );
}