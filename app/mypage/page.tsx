"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

type PointHistory = {
    id: string;
    user_id: string;
    change: number;
    reason: string;
    created_at: string;
};

const getTodayJST = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

export default function MyPage() {
    const router = useRouter();

    const [name, setName] = useState("");
    const [points, setPoints] = useState(0);
    const [rank, setRank] = useState(0);
    const [streak, setStreak] = useState(1);
    const [loginBonusDone, setLoginBonusDone] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [history, setHistory] = useState<PointHistory[]>([]);

    useEffect(() => {
        const loadPage = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            const today = getTodayJST();

            // 名前取得
            const { data: profile } = await supabase
                .from("profiles")
                .select("name")
                .eq("id", user.id)
                .single();

            setName(profile?.name || "自分");

            // ポイント取得
            const { data: pointData } = await supabase
                .from("user_points")
                .select("points")
                .eq("id", user.id)
                .single();

            const currentPoints = pointData?.points || 0;
            setPoints(currentPoints);

            // 順位取得
            const { data: rankingRows } = await supabase
                .from("user_points")
                .select("id, points")
                .order("points", { ascending: false });

            if (rankingRows) {
                const myRank = rankingRows.findIndex((row) => row.id === user.id) + 1;
                setRank(myRank);
            }

            // 履歴取得
            const { data: historyData } = await supabase
                .from("points_history")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(5);

            setHistory(historyData || []);

            // 連続ログイン
            const savedStreak = localStorage.getItem("loginStreak");
            const lastLoginDate = localStorage.getItem("lastLoginDate");

            let newStreak = 1;

            if (lastLoginDate) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const y = yesterday.getFullYear();
                const m = String(yesterday.getMonth() + 1).padStart(2, "0");
                const d = String(yesterday.getDate()).padStart(2, "0");
                const yesterdayStr = `${y}-${m}-${d}`;

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
            setLoginBonusDone(lastBonusDate === today);

            // 日報提出判定
            const { data: report } = await supabase
                .from("submissions")
                .select("id")
                .eq("user_id", user.id)
                .eq("created_at", today)
                .maybeSingle();

            setIsSubmitted(!!report);
        };

        loadPage();
    }, [router]);

    const handleSaveName = async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        await supabase.from("profiles").upsert({
            id: user.id,
            name,
        });
    };

    const handleLoginBonus = async () => {
        const today = getTodayJST();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        let bonus = 20;

        // ▼連続ボーナス
        if (streak === 3) bonus += 30;
        if (streak === 7) bonus += 100;

        const newPoints = points + bonus;
        setPoints(newPoints);

        await supabase
            .from("user_points")
            .update({ points: newPoints })
            .eq("id", user.id);

        await supabase.from("points_history").insert({
            user_id: user.id,
            change: bonus,
            reason: "login_bonus",
        });

        localStorage.setItem("lastLoginBonusDate", today);
        setLoginBonusDone(true);

        // 履歴即反映
        setHistory((prev) =>
            [
                {
                    id: crypto.randomUUID(),
                    user_id: user.id,
                    change: bonus,
                    reason: "login_bonus",
                    created_at: new Date().toISOString(),
                },
                ...prev,
            ].slice(0, 5)
        );
    };

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

        await supabase.from("points_history").insert({
            user_id: user.id,
            change: 10,
            reason: "manual_add",
        });

        setHistory((prev) =>
            [
                {
                    id: crypto.randomUUID(),
                    user_id: user.id,
                    change: 10,
                    reason: "manual_add",
                    created_at: new Date().toISOString(),
                },
                ...prev,
            ].slice(0, 5)
        );
    };
    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    const level = Math.floor(points / 100) + 1;
    const exp = points % 100;

    const badge =
        points >= 300
            ? "上級者"
            : points >= 200
                ? "成長中"
                : points >= 100
                    ? "継続力あり"
                    : "これから";

    const nextAction =
        points < 50
            ? "日報を書いてみましょう"
            : points < 100
                ? "ランキングを確認しましょう"
                : "学習コンテンツを進めましょう";

    const formatReason = (reason: string) => {
        switch (reason) {
            case "login_bonus":
                return "ログインボーナス";
            case "manual_add":
                return "手動追加";
            case "report_submit":
                return "日報提出";
            default:
                return reason;
        }
    };

    return (
        <main
            style={{
                padding: 24,
                maxWidth: 520,
                margin: "0 auto",
            }}
        >
            <h1 style={{ fontSize: 48, fontWeight: "bold", marginBottom: 32 }}>
                マイページ
            </h1>

            <p style={{ marginBottom: 8, fontWeight: "bold" }}>名前</p>

            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                        flex: 1,
                        padding: "10px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: 8,
                        fontSize: 16,
                    }}
                />
                <button
                    onClick={handleSaveName}
                    style={{
                        background: "#ffffff",
                        color: "#111827",
                        fontWeight: "bold",
                        padding: "10px 14px",
                        border: "1px solid #d1d5db",
                        borderRadius: 8,
                        cursor: "pointer",
                    }}
                >
                    名前を保存
                </button>
            </div>

            <div
                style={{
                    background: "#ffffff",
                    borderRadius: 20,
                    padding: 28,
                    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                    marginTop: 12,
                }}
            >
                <p style={{ fontSize: 20, fontWeight: "bold", marginTop: 0 }}>
                    現在ポイント：{points}pt
                </p>

                <p style={{ marginTop: 24, marginBottom: 0 }}>
                    今日のログインボーナス：
                    <span
                        style={{
                            marginLeft: 8,
                            color: loginBonusDone ? "#2e7d32" : "#ef4444",
                            fontWeight: "bold",
                        }}
                    >
                        {loginBonusDone ? "受取済み" : "未受取"}
                    </span>
                </p>

                {!loginBonusDone && (
                    <button
                        onClick={handleLoginBonus}
                        style={{
                            marginTop: 14,
                            background: "#56b87e",
                            color: "#ffffff",
                            fontWeight: "bold",
                            padding: "12px 16px",
                            border: "none",
                            borderRadius: 10,
                            cursor: "pointer",
                        }}
                    >
                        ログインボーナス受取（+20pt）
                    </button>
                )}

                <p style={{ marginTop: 26 }}>現在順位：{rank}位</p>
                <p style={{ marginTop: 22 }}>
                    連続ログイン：{streak}日
                    {streak === 3 && "（+30ボーナス）"}
                    {streak === 7 && "（+100ボーナス）"}
                </p>

                <p
                    style={{
                        marginTop: 28,
                        fontWeight: "bold",
                        fontSize: 22,
                    }}
                >
                    Level：{level}
                </p>

                <p style={{ marginTop: 20 }}>
                    バッジ：
                    <span
                        style={{
                            marginLeft: 8,
                            padding: "6px 14px",
                            background: "#0f172a",
                            color: "#ffffff",
                            borderRadius: 999,
                            fontWeight: "bold",
                            display: "inline-block",
                        }}
                    >
                        {badge}
                    </span>
                </p>

                <p style={{ marginTop: 26, fontSize: 18 }}>EXP：{exp}/100</p>

                <div
                    style={{
                        width: "100%",
                        background: "#e5e7eb",
                        height: 14,
                        borderRadius: 999,
                        overflow: "hidden",
                        marginTop: 12,
                        marginBottom: 24,
                    }}
                >
                    <div
                        style={{
                            width: `${exp}%`,
                            background: "linear-gradient(90deg, #5b5ce2, #9b83ea)",
                            height: "100%",
                            borderRadius: 999,
                            transition: "width 0.4s ease",
                        }}
                    />
                </div>

                <p style={{ fontSize: 18 }}>今日のアクション：{nextAction}</p>

                <p
                    style={{
                        marginTop: 24,
                        color: isSubmitted ? "#2e7d32" : "#ef4444",
                        fontWeight: "bold",
                        fontSize: 18,
                    }}
                >
                    今日の日報：{isSubmitted ? "提出済み" : "未提出"}
                </p>
            </div>

            <div
                style={{
                    marginTop: 26,
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                }}
            >
                <button
                    onClick={handleAddPoint}
                    style={{
                        background: "linear-gradient(90deg, #5b5ce2, #6d63f5)",
                        color: "#ffffff",
                        fontWeight: "bold",
                        padding: "12px 18px",
                        border: "none",
                        borderRadius: 12,
                        cursor: "pointer",
                    }}
                >
                    +10ポイント
                </button>

                <button
                    onClick={() => router.push("/ranking")}
                    style={{
                        background: "#0f172a",
                        color: "#ffffff",
                        fontWeight: "bold",
                        padding: "12px 18px",
                        border: "none",
                        borderRadius: 12,
                        cursor: "pointer",
                    }}
                >
                    ランキングを見る
                </button>

                <button
                    onClick={() => router.push("/report")}
                    style={{
                        background: "#e85b52",
                        color: "#ffffff",
                        fontWeight: "bold",
                        padding: "12px 18px",
                        border: "none",
                        borderRadius: 12,
                        cursor: "pointer",
                    }}
                >
                    日報を書く
                </button>

                <button
                    onClick={() => router.push("/history")}
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
                    履歴を見る
                </button>

                <button
                    onClick={handleLogout}
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
                    ログアウト
                </button>
            </div>

            <div style={{ marginTop: 32 }}>
                <h2 style={{ fontSize: 22, fontWeight: "bold", marginBottom: 12 }}>
                    ポイント履歴
                </h2>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {history.map((item, index) => (
                        <div
                            key={index}
                            style={{
                                background: "#ffffff",
                                border: "1px solid #e5e7eb",
                                borderRadius: 12,
                                padding: 12,
                                display: "flex",
                                justifyContent: "space-between",
                            }}
                        >
                            <div>
                                <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
                                    {formatReason(item.reason)}
                                </p>

                                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#9ca3af" }}>
                                    {new Date(item.created_at).toLocaleString("ja-JP")}
                                </p>
                            </div>

                            <div style={{ fontWeight: "bold" }}>
                                {item.change > 0 ? `+${item.change}` : item.change}pt
                            </div>
                        </div>
                    ))}

                    {history.length === 0 && (
                        <div
                            style={{
                                background: "#ffffff",
                                border: "1px solid #e5e7eb",
                                borderRadius: 12,
                                padding: 12,
                                color: "#6b7280",
                            }}
                        >
                            まだ履歴がありません
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}