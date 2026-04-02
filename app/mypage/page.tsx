"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type PointHistory = {
    id?: string;
    user_id: string;
    change: number;
    created_at: string;
    reason?: string | null;
};

type ProfileRow = {
    id: string;
    name?: string | null;
    streak?: number | null;
    last_report_date?: string | null;
};

function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function isSameJSTDay(value: string, targetYmd: string): boolean {
    const date = new Date(value);
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}` === targetYmd;
}

function formatDateTimeJST(value: string): string {
    const date = new Date(value);
    return date.toLocaleString("ja-JP", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatReason(reason?: string | null): string {
    if (!reason) return "ポイント追加";
    if (reason === "manual_add") return "手動追加";
    if (reason === "login_bonus") return "ログインボーナス";
    if (reason === "report_submit") return "日報提出";
    if (reason === "streak_bonus") return "連続提出ボーナス";
    return reason;
}

function getLevel(points: number): number {
    return Math.max(1, Math.floor(points / 100) + 1);
}

function getExp(points: number): number {
    return points % 100;
}

function getBadge(level: number): string {
    if (level >= 15) return "達人";
    if (level >= 10) return "上級者";
    if (level >= 5) return "中級者";
    return "初級者";
}

function getActionMessage(isSubmitted: boolean, streak: number): string {
    if (!isSubmitted) return "日報を提出してポイントを獲得しましょう";
    if (streak >= 7) return "連続提出が素晴らしいです。この調子で継続しましょう";
    if (streak >= 3) return "継続できています。次は上位を狙いましょう";
    return "学習コンテンツを進めましょう";
}

export default function MyPage() {
    const router = useRouter();

    const [userId, setUserId] = useState("");
    const [name, setName] = useState("");
    const [inputName, setInputName] = useState("");
    const [points, setPoints] = useState(0);
    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };
    const [rank, setRank] = useState<number | null>(null);
    const [streak, setStreak] = useState(1);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [loginBonusDone, setLoginBonusDone] = useState(false);
    const [history, setHistory] = useState<PointHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");

    const todayYmd = getTodayJST();
    const level = getLevel(points);
    const exp = getExp(points);
    const badge = getBadge(level);
    const actionMessage = getActionMessage(isSubmitted, streak);

    const loadPage = async () => {
        setLoading(true);
        setMessage("");

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            router.push("/login");
            return;
        }

        if (!user) {
            router.push("/login");
            return;
        }

        setUserId(user.id);

        const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        if (!profileError && profileData) {
            const profile = profileData as ProfileRow;
            setName(profile.name || "");
            setInputName(profile.name || "");
            setStreak(profile.streak || 1);
        } else {
            setName("");
            setInputName("");
            setStreak(1);
        }

        const { data: pointRow } = await supabase
            .from("user_points")
            .select("points")
            .eq("id", user.id)
            .single();

        setPoints(pointRow?.points || 0);

        const { data: rankingRows } = await supabase
            .from("user_points")
            .select("id, points")
            .order("points", { ascending: false });

        if (rankingRows) {
            const myRank = rankingRows.findIndex((row) => row.id === user.id);
            setRank(myRank >= 0 ? myRank + 1 : null);
        }

        const { data: historyRows } = await supabase
            .from("points_history")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20);

        const historyList = (historyRows || []) as PointHistory[];
        setHistory(historyList);

        const bonusReceivedToday = historyList.some(
            (item) =>
                item.reason === "login_bonus" && isSameJSTDay(item.created_at, todayYmd)
        );
        setLoginBonusDone(bonusReceivedToday);

        const { data: submissionRows } = await supabase
            .from("submissions")
            .select("created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20);

        const submittedToday =
            submissionRows?.some((row) => isSameJSTDay(row.created_at, todayYmd)) ||
            false;

        setIsSubmitted(submittedToday);
        setLoading(false);
    };

    useEffect(() => {
        loadPage();
    }, []);

    const handleSaveName = async () => {
        if (!userId) return;
        if (!inputName.trim()) {
            setMessage("名前を入力してください");
            return;
        }

        const { error } = await supabase
            .from("profiles")
            .update({ name: inputName.trim() })
            .eq("id", userId);

        if (error) {
            setMessage("名前の保存に失敗しました");
            return;
        }

        setName(inputName.trim());
        setMessage("名前を保存しました");
    };

    const addPointWithHistory = async (amount: number, reason: string) => {
        if (!userId) return;

        const { data: pointRow } = await supabase
            .from("user_points")
            .select("points")
            .eq("id", userId)
            .single();

        const current = pointRow?.points || 0;
        const next = current + amount;

        const { error: updateError } = await supabase
            .from("user_points")
            .update({ points: next })
            .eq("id", userId);

        if (updateError) {
            setMessage("ポイント更新に失敗しました");
            return false;
        }

        const { error: historyError } = await supabase
            .from("points_history")
            .insert({
                user_id: userId,
                change: amount,
                reason,
                created_at: new Date().toISOString(),
            });

        if (historyError) {
            setMessage("履歴保存に失敗しました");
            return false;
        }

        return true;
    };

    const handleAddPoint = async () => {
        const ok = await addPointWithHistory(10, "manual_add");
        if (!ok) return;

        setMessage("+10ポイント追加しました");
        await loadPage();
    };

    const handleLoginBonus = async () => {
        if (!userId) return;

        setMessage("");

        const todayYmd = getTodayJST();

        // ① 今日ログボ済みか確認
        const { data: historyRows, error: historyError } = await supabase
            .from("points_history")
            .select("created_at, reason")
            .eq("user_id", userId)
            .eq("reason", "login_bonus");

        if (historyError) {
            setMessage("履歴確認に失敗しました");
            return;
        }

        const alreadyReceived =
            historyRows?.some(
                (row) => isSameJSTDay(row.created_at, todayYmd)
            ) || false;

        if (alreadyReceived) {
            setMessage("今日のログインボーナスは受取済みです");
            return;
        }

        // ② 現在ポイント取得
        const { data: pointRow, error: pointError } = await supabase
            .from("user_points")
            .select("points")
            .eq("id", userId)
            .single();

        if (pointError) {
            setMessage("ポイント取得に失敗しました");
            return;
        }

        const currentPoints = pointRow?.points || 0;
        const add = 20;

        // ③ user_points 更新
        const { error: updateError } = await supabase
            .from("user_points")
            .update({ points: currentPoints + add })
            .eq("id", userId);

        if (updateError) {
            setMessage("ポイント更新に失敗しました");
            return;
        }

        // ④ 履歴保存
        const { error: insertError } = await supabase
            .from("points_history")
            .insert({
                user_id: userId,
                change: add,
                reason: "login_bonus",
                created_at: new Date().toISOString(),
            });

        if (insertError) {
            setMessage("履歴保存に失敗しました");
            return;
        }

        setMessage("ログインボーナス +20pt 獲得しました");

        // ⑤ 再読み込み（UI反映）
        await loadPage();
    };
    return (
        <main
            style={{
                minHeight: "100vh",
                background: "#f3f4f6",
                padding: "48px 24px 64px",
            }}
        >
            <div
                style={{
                    maxWidth: 1200,
                    margin: "0 auto",
                    display: "grid",
                    gridTemplateColumns: "280px 1fr 320px",
                    gap: 24,
                    alignItems: "start",
                }}
            >
                {/* 左カラム */}
                <div
                    style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                        marginTop: 24,
                    }}
                >
                    <div
                        style={{
                            fontSize: 24,
                            fontWeight: 700,
                            color: "#111827",
                        }}
                    >
                        マイページ
                    </div>

                    <div
                        style={{
                            background: "#ffffff",
                            borderRadius: 16,
                            padding: 20,
                        }}
                    >
                        <div style={{ fontSize: 14, color: "#6b7280" }}>名前</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>
                            {name || "未設定"}
                        </div>

                        <button
                            onClick={handleSaveName}
                            style={{
                                marginTop: 12,
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: "1px solid #e5e7eb",
                                background: "#fff",
                                cursor: "pointer",
                                fontWeight: 600,
                            }}
                        >
                            名前を保存
                        </button>
                    </div>
                </div>

                {/* 中央 */}
                <div
                    style={{
                        background: "#ffffff",
                        borderRadius: 20,
                        padding: 32,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                    }}
                >
                    <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
                        {name || "名前未設定"}
                    </h1>

                    <div
                        style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            marginTop: 24,
                        }}
                    >
                        <button
                            onClick={handleAddPoint}
                            style={{
                                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                color: "#fff",
                                padding: "10px 16px",
                                borderRadius: 10,
                                border: "none",
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            +10pt
                        </button>

                        <button
                            onClick={() => router.push("/ranking")}
                            style={{
                                background: "#0f172a",
                                color: "#fff",
                                padding: "10px 16px",
                                borderRadius: 10,
                                border: "none",
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            ランキング
                        </button>

                        <button
                            onClick={() => router.push("/report")}
                            style={{
                                background: "#ef4444",
                                color: "#fff",
                                padding: "10px 16px",
                                borderRadius: 10,
                                border: "none",
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            日報
                        </button>

                        <button
                            onClick={() => router.push("/history")}
                            style={{
                                background: "#ffffff",
                                color: "#111827",
                                padding: "10px 16px",
                                borderRadius: 10,
                                border: "1px solid #d1d5db",
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            履歴
                        </button>

                        <button
                            onClick={handleLogout}
                            style={{
                                background: "#ffffff",
                                color: "#111827",
                                padding: "10px 16px",
                                borderRadius: 10,
                                border: "1px solid #d1d5db",
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            ログアウト
                        </button>
                    </div>

                    <div
                        style={{
                            marginTop: 24,
                            background: "#f9fafb",
                            padding: 16,
                            borderRadius: 12,
                        }}
                    >
                        <p>ポイント: {points}</p>
                        <p>順位: {rank || "-"}</p>
                        <p>連続提出: {streak}日</p>
                    </div>

                    {message && <p>{message}</p>}
                </div>

                {/* 右カラム */}
                <div
                    style={{
                        background: "#ffffff",
                        borderRadius: 16,
                        padding: 20,
                    }}
                >
                    <h2>ポイント履歴</h2>

                    {history.map((item, i) => (
                        <div key={i} style={{ marginTop: 10 }}>
                            <div>{formatReason(item.reason)}</div>
                            <div>{formatDateTimeJST(item.created_at)}</div>
                            <div>{item.change}pt</div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );

    <div style={{ marginTop: 18 }}>
        {history.length > 0 ? (
            history.map((item, index) => (
                <div
                    key={`${item.created_at}-${index}`}
                    style={{
                        background: "#ffffff",
                        borderRadius: 24,
                        padding: 32,
                        boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
                        border: "1px solid #e5e7eb",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            marginTop: 24,
                        }}
                    >
                        <div>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: "#111827",
                                }}
                            >
                                {formatReason(item.reason)}
                            </p>
                            <p
                                style={{
                                    margin: "8px 0 0 0",
                                    fontSize: 13,
                                    color: "#6b7280",
                                    lineHeight: 1.5,
                                }}
                            >
                                {formatDateTimeJST(item.created_at)}
                            </p>
                        </div>

                        <p
                            style={{
                                margin: 0,
                                fontSize: 28,
                                fontWeight: 700,
                                color: item.change >= 0 ? "#111827" : "#dc2626",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {item.change > 0 ? `+${item.change}` : item.change}pt
                        </p>
                    </div>
                </div>
            ))
        ) : (
            <div
                style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    transition: "all 0.2s ease",
                    borderRadius: 16,
                    padding: 18,
                    color: "#6b7280",
                }}
            >
                履歴がありません
            </div>
        )}
    </div>
}