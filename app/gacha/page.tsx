"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

// ガチャ景品テーブル（消費50pt・期待値約23.5pt = 回すほど損する健全設計）
const PRIZES = [
    { reward: 1000, weight: 0.05, rarity: "LEGEND", emoji: "🌈", color: "#f43f5e", label: "大当たり！" },
    { reward: 300, weight: 1, rarity: "EPIC", emoji: "🟡", color: "#fbbf24", label: "EPIC!" },
    { reward: 100, weight: 4, rarity: "RARE", emoji: "🟣", color: "#a855f7", label: "RARE!" },
    { reward: 50, weight: 10, rarity: "UNCOMMON", emoji: "🔵", color: "#06b6d4", label: "チャラ！" },
    { reward: 30, weight: 20, rarity: "COMMON", emoji: "⚪", color: "#10b981", label: "COMMON" },
    { reward: 10, weight: 35, rarity: "COMMON", emoji: "⚪", color: "#9ca3af", label: "COMMON" },
    { reward: 5, weight: 29.95, rarity: "MISS", emoji: "⚫", color: "#6b7280", label: "ざんねん..." },
];

const GACHA_COST = 50;
const DAILY_LIMIT = 10;

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
    const [todayCount, setTodayCount] = useState(0);

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

        // 今日の回数カウント（JST 0時基準）
        const now = new Date();
        const jstOffset = 9 * 60 * 60 * 1000;
        const jstNow = new Date(now.getTime() + jstOffset);
        const jstMidnight = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - jstOffset);
        const { count } = await supabase
            .from("gacha_history")
            .select("*", { count: "exact", head: true })
            .eq("user_id", uid)
            .gte("created_at", jstMidnight.toISOString());
        setTodayCount(count || 0);
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
        if (spinning || points < GACHA_COST || todayCount >= DAILY_LIMIT) return;
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

        // ポイント更新: user_points.points を直接増減（total_earnedには影響させない）
        const netChange = selected.reward - GACHA_COST;
        // user_points.points をDB側で増分更新（古い値の上書き事故を防ぐ）
        await supabase.rpc("increment_user_points", { uid: userId, delta: netChange });

        // ⚠️ points_history には記録しない（gacha_rewardがtotal_earnedに加算されるのを防ぐ）
        // ガチャの履歴は gacha_history テーブルにのみ記録する
        await supabase.from("gacha_history").insert({
            user_id: userId,
            cost: GACHA_COST,
            reward: selected.reward,
            rarity: selected.rarity,
        });

        setResult(selected);
        setSpinning(false);
        await loadData(userId);
    };

    if (loading) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Loading...</main>
    );

    const limitReached = todayCount >= DAILY_LIMIT;
    const canSpin = points >= GACHA_COST && !spinning && !limitReached;

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", color: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 560, margin: "0 auto" }}>
                <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                <h1 style={{ fontSize: 28, fontWeight: 900, margin: "4px 0 24px" }}>🎰 ポイントガチャ</h1>

                {/* ポイント残高 */}
                <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#a5b4fc", fontWeight: 700 }}>所持ポイント</span>
                    <span style={{ fontSize: 24, fontWeight: 900, color: "#f9fafb" }}>{points.toLocaleString()} pt</span>
                </div>

                {/* 本日の回数 */}
                <div style={{ padding: "10px 20px", borderRadius: 12, background: limitReached ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${limitReached ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.08)"}`, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: limitReached ? "#f87171" : "#9ca3af", fontWeight: 700 }}>本日のガチャ回数</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: limitReached ? "#f87171" : "#d1d5db" }}>{todayCount} / {DAILY_LIMIT} 回</span>
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
                        {spinning ? "抽選中..." : limitReached ? "本日の上限に達しました" : points < GACHA_COST ? "ポイント不足" : `🎰 ${GACHA_COST}pt で回す`}
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
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            ※ 1回 {GACHA_COST}pt 消費・1日{DAILY_LIMIT}回まで。ガチャの増減はランキング(累計ポイント)には影響しません。
                        </div>
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
