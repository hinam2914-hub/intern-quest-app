"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

/* ========= 型 ========= */
type HistoryItem = {
    id: string;
    change: number;
    created_at: string;
    reason: string;
};

/* ========= 日付系 ========= */
function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().slice(0, 10);
}

function isSameJSTDay(value: string, target: string) {
    const date = new Date(value);
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().slice(0, 10) === target;
}

/* ========= メイン ========= */
export default function MyPage() {
    const router = useRouter();

    const [userId, setUserId] = useState("");
    const [name, setName] = useState("");
    const [inputName, setInputName] = useState("");
    const [points, setPoints] = useState(0);
    const [exp, setExp] = useState(0);
    const [rank, setRank] = useState<number | null>(null);
    const [loginBonusDone, setLoginBonusDone] = useState(false);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");

    /* ========= 初期ロード ========= */
    const loadPage = async () => {
        setLoading(true);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            router.push("/login");
            return;
        }

        setUserId(user.id);

        /* プロフィール */
        const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", user.id)
            .single();

        setName(profile?.name || "");
        setInputName(profile?.name || "");

        /* ポイント */
        const { data: pointRow } = await supabase
            .from("user_points")
            .select("points")
            .eq("id", user.id)
            .single();

        const p = pointRow?.points || 0;
        setPoints(p);
        setExp(p % 100);

        /* ランク */
        const { data: ranking } = await supabase
            .from("user_points")
            .select("id, points")
            .order("points", { ascending: false });

        const myIndex = ranking?.findIndex((r) => r.id === user.id) ?? -1;
        setRank(myIndex >= 0 ? myIndex + 1 : null);

        /* 履歴 */
        const { data: historyRows } = await supabase
            .from("points_history")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20);

        setHistory(historyRows || []);

        /* ログボ判定 */
        const today = getTodayJST();

        const { data: loginRows } = await supabase
            .from("points_history")
            .select("created_at")
            .eq("user_id", user.id)
            .eq("reason", "login_bonus");

        const done =
            loginRows?.some((r) => isSameJSTDay(r.created_at, today)) || false;

        setLoginBonusDone(done);

        setLoading(false);
    };

    useEffect(() => {
        loadPage();
    }, []);

    /* ========= アクション ========= */

    const handleSaveName = async () => {
        if (!inputName.trim()) return;

        await supabase
            .from("profiles")
            .update({ name: inputName })
            .eq("id", userId);

        setName(inputName);
        setMessage("保存しました");
    };

    const handleLoginBonus = async () => {
        if (loginBonusDone) return;

        const { data } = await supabase
            .from("user_points")
            .select("points")
            .eq("id", userId)
            .single();

        const current = data?.points || 0;

        await supabase
            .from("user_points")
            .update({ points: current + 20 })
            .eq("id", userId);

        await supabase.from("points_history").insert({
            user_id: userId,
            change: 20,
            reason: "login_bonus",
        });

        setMessage("+20pt 獲得");
        await loadPage();
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    if (loading) return <div style={{ padding: 40 }}>読み込み中...</div>;

    /* ========= UI ========= */

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
                    maxWidth: 1200,
                    margin: "0 auto",
                    display: "grid",
                    gridTemplateColumns: "260px 1fr 280px",
                    gap: 32,
                }}
            >
                {/* 左 */}
                <div
                    style={{
                        background: "#fff",
                        borderRadius: 20,
                        padding: 24,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                    }}
                >
                    <div style={{ fontWeight: 700, marginBottom: 12 }}>
                        {name || "未設定"}
                    </div>

                    <input
                        value={inputName}
                        onChange={(e) => setInputName(e.target.value)}
                        style={{ width: "100%", padding: 10 }}
                    />

                    <button onClick={handleSaveName} style={{ marginTop: 10 }}>
                        保存
                    </button>
                </div>

                {/* 中央 */}
                <div
                    style={{
                        background: "#fff",
                        borderRadius: 20,
                        padding: 32,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                    }}
                >
                    <div>現在ポイント</div>
                    <div style={{ fontSize: 32 }}>{points}pt</div>

                    {/* ログボ */}
                    <div style={{ marginTop: 16 }}>
                        {loginBonusDone ? "受取済み" : "未受取"}
                    </div>

                    {!loginBonusDone && (
                        <button onClick={handleLoginBonus}>
                            ログインボーナス
                        </button>
                    )}

                    {/* EXP */}
                    <div style={{ marginTop: 20 }}>EXP {exp}/100</div>
                    <div style={{ height: 8, background: "#ddd" }}>
                        <div
                            style={{
                                width: `${exp}%`,
                                height: "100%",
                                background: "#4f46e5",
                            }}
                        />
                    </div>

                    <div style={{ marginTop: 20 }}>
                        ランク：{rank || "-"}
                    </div>
                </div>

                {/* 右 */}
                <div
                    style={{
                        background: "#fff",
                        borderRadius: 20,
                        padding: 24,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                    }}
                >
                    <div>履歴</div>

                    {history.map((h) => (
                        <div key={h.id}>
                            {h.change}pt
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}