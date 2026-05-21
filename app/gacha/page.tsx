"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

// ガチャ景品テーブル（期待値約7.5pt）
const PRIZES = [
    { reward: 1000, weight: 0.1, rarity: "LEGEND", emoji: "🌈", color: "#f43f5e", label: "大当たり！" },
    { reward: 100, weight: 2, rarity: "EPIC", emoji: "🟡", color: "#fbbf24", label: "EPIC!" },
    { reward: 50, weight: 8, rarity: "RARE", emoji: "🟣", color: "#a855f7", label: "RARE!" },
    { reward: 20, weight: 15, rarity: "UNCOMMON", emoji: "🔵", color: "#06b6d4", label: "UNCOMMON" },
    { reward: 10, weight: 25, rarity: "COMMON", emoji: "⚪", color: "#10b981", label: "チャラ！" },
    { reward: 5, weight: 30, rarity: "COMMON", emoji: "⚪", color: "#9ca3af", label: "COMMON" },
    { reward: 1, weight: 19.9, rarity: "MISS", emoji: "⚫", color: "#6b7280", label: "ざんねん..." },
];

const GACHA_COST = 10;

interface GachaHistory {
    id: string;
    cost: number;
    reward: number;
    rarity: string;
    created_at: string;
}

export default function GachaPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState("");
    const [points, setPoints] = useState(0);
    const [spinning, setSpinning] = useState(false);
    const [result, setResult] = useState<typeof PRIZES[0] | null>(null);
    const [history, setHistory] = useState<GachaHistory[]>([]);

    const loadData = useCallback(async (uid: string) => {
        const { data: ptRow } = await supabase.from("user_points").select("points").eq("id", uid).maybeSingle();
        setPoints((ptRow as any)?.points || 0);
        const { data: hist } = await supabase
            .from("gacha_history")
            .select("*")
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .limit(10);
        setHistory((hist || []) as GachaHistory[]);
    }, []);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            await loadData(user.id);
            setLoading(false);
        })();
    }, [router, loadData]);

    const handleSpin = async () => {
        if (spinning || points < GACHA_COST) return;
        setSpinning(true);
        setResult(null);

        // 重み付き抽選
        const totalWeight = PRIZES.reduce((s, p) => s + p.weight, 0);
        let random = Math.random() * totalWeight;
        let selected = PRIZES[PRIZES.length - 1];
        for (const prize of PRIZES) {
            random -= prize.weight;
            if (random <= 0) { selected = prize; break; }
        }

        // 演出待ち（2秒）
        await new Promise(resolve => setTimeout(resolve, 2000));

        // ポイント更新: -10（消費） +reward（当選）
        const netChange = selected.reward - GACHA_COST;
        const newPoints = points + netChange;
        await supabase.from("user_points").upsert({ id: userId, points: newPoints });

        // points_history に記録（消費と獲得を別レコードで）
        await supabase.from("points_history").insert([
            { user_id: userId, change: -GACHA_COST, reason: "gacha_spend" },
            { user_id: userId, change: selected.reward, reason: "gacha_reward" },
        ]);

        // gacha_history に記録
        await supabase.from("gacha_history").insert({
            user_id: userId,
            cost: GACHA_COST,
            reward: selected.reward,
            rarity: selected.rarity,
        });

        setPoints(newPoints);
        setResult(selected);
        setSpinning(false);
        await loadData(userId);
    };

    if (loading) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Loading...</main>
    );

    const canSpin = points >= GACHA_COST && !spinning;

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", color: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 560, margin: "0 auto" }}>
                <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                <h1 style={{ fontSize: 28, fontWeight: 900, margin: "4px 0 24px" }}>🎰 ポイントガチャ</h1>

                {/* ポイント残高 */}
                <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#a5b4fc", fontWeight: 700 }}>所持ポイント</span>
                    <span style={{ fontSize: 24, fontWeight: 900, color: "#f9fafb" }}>{points.toLocaleString()} pt</span>
                </div>

                {/* ガチャ筐体 */}
                <div style={{ padding: "40px 24px", borderRadius: 20, background: "linear-gradient(135deg, rgba(244,63,94,0.1), rgba(168,85,247,0.1))", border: "1px solid rgba(168,85,247,0.3)", textAlign: "center", marginBottom: 24 }}>
                    <div style={{
                        fontSize: 80,
                        marginBottom: 16,
                        transition: "transform 0.3s",
                        transform: spinning ? "rotate(360deg) scale(1.2)" : "scale(1)",
                        animation: spinning ? "spin 0.5s linear infinite" : "none",
                    }}>
                        {spinning ? "🎰" : result ? result.emoji : "🎁"}
                    </div>

                    {/* 結果表示 */}
                    {result && !spinning && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color: result.color, marginBottom: 4 }}>{result.label}</div>
                            <div style={{ fontSize: 32, fontWeight: 900, color: "#f9fafb" }}>+{result.reward} pt</div>
                            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                                {result.reward > GACHA_COST ? `🎉 ${result.reward - GACHA_COST}pt のプラス！` : result.reward === GACHA_COST ? "±0 チャラでした" : `${result.reward - GACHA_COST}pt ...`}
                            </div>
                        </div>
                    )}

                    {spinning && <div style={{ fontSize: 16, fontWeight: 700, color: "#a5b4fc", marginBottom: 16 }}>抽選中...</div>}

                    {/* 回すボタン */}
                    <button
                        onClick={handleSpin}
                        disabled={!canSpin}
                        style={{
                            width: "100%",
                            padding: 16,
                            borderRadius: 14,
                            border: "none",
                            background: canSpin ? "linear-gradient(135deg, #f43f5e, #a855f7)" : "#374151",
                            color: "#fff",
                            fontSize: 17,
                            fontWeight: 900,
                            cursor: canSpin ? "pointer" : "not-allowed",
                        }}
                    >
                        {spinning ? "抽選中..." : points < GACHA_COST ? "ポイント不足" : `🎰 ${GACHA_COST}pt で回す`}
                    </button>
                </div>

                {/* 確率表 */}
                <details style={{ marginBottom: 24 }}>
                    <summary style={{ cursor: "pointer", fontSize: 13, color: "#818cf8", fontWeight: 700, padding: "8px 0" }}>📊 提供割合を見る</summary>
                    <div style={{ marginTop: 8, padding: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
                        {PRIZES.map((p, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: i < PRIZES.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                                <span style={{ color: p.color, fontWeight: 700 }}>{p.emoji} {p.reward}pt</span>
                                <span style={{ color: "#9ca3af" }}>{p.weight}%</span>
                            </div>
                        ))}
                    </div>
                </details>

                {/* ガチャ履歴 */}
                <div style={{ fontSize: 13, fontWeight: 700, color: "#9ca3af", marginBottom: 12 }}>📜 直近の履歴</div>
                {history.length === 0 ? (
                    <div style={{ color: "#6b7280", fontSize: 13, textAlign: "center", padding: 24 }}>まだ履歴がありません</div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {history.map(h => {
                            const prize = PRIZES.find(p => p.reward === h.reward && p.rarity === h.rarity) || PRIZES[PRIZES.length - 1];
                            const net = h.reward - h.cost;
                            return (
                                <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                    <span style={{ fontSize: 13, color: prize.color, fontWeight: 700 }}>{prize.emoji} {h.reward}pt</span>
                                    <span style={{ fontSize: 12, color: net > 0 ? "#34d399" : net < 0 ? "#f87171" : "#9ca3af", fontWeight: 700 }}>
                                        {net > 0 ? `+${net}` : net}pt
                                    </span>
                                    <span style={{ fontSize: 10, color: "#6b7280" }}>{new Date(h.created_at).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </main>
    );
}
