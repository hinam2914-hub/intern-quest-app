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
                    gridTemplateColumns: "260px 1fr 280px",
                    gap: 32,
                    alignItems: "start",
                }}
            >
                <div
                    style={{
                        fontSize: 24,
                        fontWeight: 700,
                        marginBottom: 16,
                        color: "#111827",
                    }}
                >
                    マイページ
                </div>
                {/* 左カラム */}
                <button
                    onClick={handleSaveName}
                    style={{
                        marginTop: 12,
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        transition: "all 0.2s ease",
                        background: "#ffffff",
                        cursor: "pointer",
                        fontWeight: 600,
                    }}
                >
                    名前を保存
                </button> <div
                    style={{
                        background: "#ffffff",
                        borderRadius: 20,
                        padding: 24,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                        border: "1px solid #f1f5f9",
                        transition: "all 0.2s ease",
                    }}
                >
                    <div style={{ fontSize: 14, color: "#6b7280" }}>名前</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                        {name || "未設定"}
                    </div>
                </div>
                <div
                    style={{
                        background: "#ffffff",
                        borderRadius: 20,
                        padding: 24,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                        border: "1px solid #f1f5f9",
                        transition: "all 0.2s ease",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 16,
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                            marginBottom: 28,
                        }}
                    >
                        <div>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 14,
                                    color: "#6b7280",
                                }}
                            >
                                マイページ
                            </p>
                            <h1
                                style={{
                                    margin: "8px 0 0 0",
                                    fontSize: 40,
                                    fontWeight: 700,
                                    color: "#111827",
                                }}
                            >
                                {name || "名前未設定"}
                            </h1>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                gap: 10,
                                flexWrap: "wrap",
                                justifyContent: "flex-end",
                            }}
                        >
                            <button
                                onClick={handleAddPoint}
                                style={{
                                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                    color: "#ffffff",
                                    padding: "12px 18px",
                                    borderRadius: 12,
                                    border: "none",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                }}
                            >
                                +10ポイント
                            </button>

                            <button
                                onClick={() => router.push("/ranking")}
                                style={{
                                    background: "#0f172a",
                                    color: "#ffffff",
                                    padding: "12px 18px",
                                    borderRadius: 12,
                                    border: "none",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                }}
                            >
                                ランキングを見る
                            </button>

                            <button
                                onClick={() => router.push("/report")}
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
                                日報を書く
                            </button>

                            <button
                                onClick={() => router.push("/history")}
                                style={{
                                    background: "#ffffff",
                                    color: "#111827",
                                    padding: "12px 18px",
                                    borderRadius: 12,
                                    border: "1px solid #d1d5db",
                                    transition: "all 0.2s ease",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                }}
                            >
                                履歴を見る
                            </button>

                            <button
                                onClick={handleLogout}
                                style={{
                                    background: "#ffffff",
                                    color: "#111827",
                                    padding: "12px 18px",
                                    borderRadius: 12,
                                    border: "1px solid #d1d5db",
                                    transition: "all 0.2s ease",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                }}
                            >
                                ログアウト
                            </button>
                        </div>
                    </div>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)",
                            gap: 16,
                            marginBottom: 20,
                        }}

                    >
                        <div
                            style={{
                                background: "#f9fafb",
                                borderRadius: 16,
                                padding: 18,
                                border: "1px solid #e5e7eb",
                                transition: "all 0.2s ease",
                            }}
                        >
                            <p
                                style={{
                                    margin: "0 0 8px 0",
                                    fontSize: 13,
                                    color: "#6b7280",
                                    fontWeight: 600,
                                }}
                            >
                                名前
                            </p>

                            <input
                                value={inputName}
                                onChange={(e) => setInputName(e.target.value)}
                                placeholder="名前を入力"
                                style={{
                                    width: "100%",
                                    padding: "12px 14px",
                                    borderRadius: 12,
                                    border: "1px solid #d1d5db",
                                    transition: "all 0.2s ease",
                                    fontSize: 15,
                                    outline: "none",
                                    boxSizing: "border-box",
                                }}
                            />

                            <button
                                onClick={handleSaveName}
                                style={{
                                    marginTop: 10,
                                    width: "100%",
                                    background: "#ffffff",
                                    color: "#111827",
                                    padding: "12px 14px",
                                    borderRadius: 12,
                                    border: "1px solid #d1d5db",
                                    transition: "all 0.2s ease",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                }}
                            >
                                名前を保存
                            </button>
                        </div>

                        <div
                            style={{
                                background: "#ffffff",
                                borderRadius: 20,
                                padding: 32, // ←ここ重要（他より大きい）
                                boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                                border: "1px solid #f1f5f9",
                                transition: "all 0.2s ease",
                            }}
                        >
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                    gap: 14,
                                    marginBottom: 20,
                                }}
                            >
                                <div
                                    style={{
                                        background: "#f9fafb",
                                        borderRadius: 14,
                                        padding: 16,
                                        border: "1px solid #e5e7eb",
                                        transition: "all 0.2s ease",
                                    }}
                                >
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 12,
                                            color: "#6b7280",
                                        }}
                                    >
                                        現在ポイント
                                    </p>
                                    <div style={{ marginTop: 16 }}>
                                        <div style={{ fontSize: 14, color: "#6b7280" }}>
                                            今日のログインボーナス
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 16,
                                                fontWeight: 700,
                                                color: loginBonusDone ? "#10b981" : "#ef4444",
                                            }}
                                        >
                                            {loginBonusDone ? "受取済み" : "未受取"}
                                        </div>
                                    </div>
                                    <p
                                        style={{
                                            margin: "8px 0 0 0",
                                            fontSize: 34,
                                            fontWeight: 700,
                                            color: "#111827",
                                        }}
                                    >
                                        {points}pt
                                    </p>
                                </div>

                                <div
                                    style={{
                                        background: "#f9fafb",
                                        borderRadius: 14,
                                        padding: 16,
                                        border: "1px solid #e5e7eb",
                                        transition: "all 0.2s ease",
                                    }}
                                >
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 12,
                                            color: "#6b7280",
                                        }}
                                    >
                                        現在順位
                                    </p>
                                    <p
                                        style={{
                                            margin: "8px 0 0 0",
                                            fontSize: 34,
                                            fontWeight: 700,
                                            color: "#111827",
                                        }}
                                    >
                                        {rank ? `${rank}位` : "-"}
                                    </p>
                                </div>
                            </div>

                            <div style={{ marginBottom: 18 }}>
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 15,
                                        color: "#111827",
                                        fontWeight: 600,
                                    }}
                                >
                                    今日のログインボーナス：
                                    <span
                                        style={{
                                            marginLeft: 8,
                                            color: loginBonusDone ? "#16a34a" : "#dc2626",
                                        }}
                                    >
                                        {loginBonusDone ? "受取済み" : "未受取"}
                                    </span>
                                </p>

                                {!loginBonusDone && (
                                    <button
                                        onClick={handleLoginBonus}
                                        style={{
                                            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                            color: "#fff",
                                            padding: "12px 18px",
                                            borderRadius: 12,
                                            border: "none",
                                            cursor: "pointer",
                                            fontWeight: 700,
                                            boxShadow: "0 10px 20px rgba(99,102,241,0.25)",
                                        }}
                                    >
                                        ログインボーナス受取（+20pt）
                                    </button>
                                )}
                            </div>

                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                    gap: 14,
                                    marginBottom: 22,
                                }}
                            >
                                <div
                                    style={{
                                        background: "#f9fafb",
                                        borderRadius: 14,
                                        padding: 16,
                                        border: "1px solid #e5e7eb",
                                        transition: "all 0.2s ease",
                                    }}
                                >
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 12,
                                            color: "#6b7280",
                                        }}
                                    >
                                        連続提出
                                    </p>
                                    <p
                                        style={{
                                            margin: "8px 0 0 0",
                                            fontSize: 30,
                                            fontWeight: 700,
                                            color: "#111827",
                                        }}
                                    >
                                        {streak}日
                                    </p>
                                </div>

                                <div
                                    style={{
                                        background: "#f9fafb",
                                        borderRadius: 14,
                                        padding: 16,
                                        border: "1px solid #e5e7eb",
                                        transition: "all 0.2s ease",
                                    }}
                                >
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 12,
                                            color: "#6b7280",
                                        }}
                                    >
                                        バッジ
                                    </p>
                                    <div style={{ marginTop: 8 }}>
                                        <span
                                            style={{
                                                display: "inline-block",
                                                background: "#0f172a",
                                                color: "#ffffff",
                                                padding: "8px 14px",
                                                borderRadius: 999,
                                                fontWeight: 700,
                                                fontSize: 14,
                                            }}
                                        >
                                            {badge}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginBottom: 18 }}>
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 18,
                                        fontWeight: 700,
                                        color: "#111827",
                                    }}
                                >
                                    Level : {level}
                                </p>

                                <p
                                    style={{
                                        margin: "14px 0 8px 0",
                                        fontSize: 15,
                                        color: "#111827",
                                        fontWeight: 600,
                                    }}
                                >
                                    EXP : {exp}/100
                                </p>
                                <div
                                    style={{
                                        marginTop: 8,
                                        height: 8,
                                        background: "#e5e7eb",
                                        borderRadius: 999,
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${exp}%`,
                                            height: "100%",
                                            background: "#4f46e5",
                                        }}
                                    />
                                </div>
                                <div
                                    style={{
                                        width: "100%",
                                        height: 14,
                                        background: "#e5e7eb",
                                        borderRadius: 999,
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${exp}%`,
                                            height: "100%",
                                            background:
                                                "linear-gradient(90deg, #6366f1 0%, #a78bfa 100%)",
                                            borderRadius: 999,
                                        }}
                                    />
                                </div>
                            </div>

                            <div
                                style={{
                                    background: "#f9fafb",
                                    borderRadius: 14,
                                    padding: 18,
                                    border: "1px solid #e5e7eb",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 14,
                                        color: "#6b7280",
                                        fontWeight: 600,
                                    }}
                                >
                                    今日のアクション
                                </p>
                                <p
                                    style={{
                                        margin: "10px 0 0 0",
                                        fontSize: 28,
                                        lineHeight: 1.5,
                                        fontWeight: 700,
                                        color: "#111827",
                                    }}
                                >
                                    {actionMessage}
                                </p>

                                <p
                                    style={{
                                        margin: "18px 0 0 0",
                                        fontSize: 15,
                                        fontWeight: 700,
                                        color: isSubmitted ? "#16a34a" : "#ef4444",
                                    }}
                                >
                                    今日の日報：{isSubmitted ? "提出済み" : "未提出"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {message && (
                        <div
                            style={{
                                marginTop: 18,
                                padding: "14px 16px",
                                borderRadius: 12,
                                background: "#eff6ff",
                                border: "1px solid #bfdbfe",
                                transition: "all 0.2s ease",
                                color: "#1d4ed8",
                                fontWeight: 600,
                            }}
                        >
                            {message}
                        </div>
                    )}
                </div>

                <div
                    style={{
                        background: "#ffffff",
                        borderRadius: 24,
                        padding: 28,
                        boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
                        border: "1px solid #e5e7eb",
                        transition: "all 0.2s ease",
                    }}
                >
                    <h2
                        style={{
                            margin: 0,
                            fontSize: 30,
                            fontWeight: 700,
                            color: "#111827",
                        }}
                    >
                        ポイント履歴
                    </h2>

                    <div style={{ marginTop: 18 }}>
                        {history.length > 0 ? (
                            history.map((item, index) => (
                                <div
                                    key={`${item.created_at}-${index}`}
                                    style={{
                                        background: "#ffffff",
                                        border: "1px solid #e5e7eb",
                                        transition: "all 0.2s ease",
                                        borderRadius: 16,
                                        padding: 18,
                                        marginBottom: 12,
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "flex-start",
                                            gap: 12,
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
                </div>
            </div>
        </main>
    );
}