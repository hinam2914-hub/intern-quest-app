"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const calcRank = (total: number) => {
    if (total >= 17) return { rank: "A", color: "#fbbf24", bg: "rgba(251,191,36,0.15)", desc: "最上位（S難易度）", emoji: "🏆" };
    if (total >= 13) return { rank: "B", color: "#a855f7", bg: "rgba(168,85,247,0.15)", desc: "上位（A難易度）", emoji: "🥈" };
    if (total >= 9) return { rank: "C", color: "#06b6d4", bg: "rgba(6,182,212,0.15)", desc: "中位（B〜C難易度）", emoji: "🥉" };
    if (total >= 5) return { rank: "D", color: "#f97316", bg: "rgba(249,115,22,0.15)", desc: "下位（C〜D難易度）", emoji: "🔻" };
    return { rank: "E", color: "#6b7280", bg: "rgba(107,114,128,0.15)", desc: "要改善", emoji: "🔻" };
};

interface RankUser {
    id: string;
    name: string;
    es: number;
    personality: number;
    interview: number;
    education: number;
    total: number;
    rank: string;
    department_id?: string;
    mbti?: string;
    education_str?: string;
}
interface Company {
    id: string;
    name: string;
    website_url: string | null;
    industry: string | null;
    tier: string;
}

export default function RankPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [myData, setMyData] = useState<RankUser | null>(null);
    const [allUsers, setAllUsers] = useState<RankUser[]>([]);
    const [evaluatedAt, setEvaluatedAt] = useState<string | null>(null);
    const [companies, setCompanies] = useState<Company[]>([]);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }

            // 全ユーザーのランクスコアを取得
            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, name, rank_score_es, rank_score_personality, rank_score_interview, rank_score_education, rank_evaluated_at, department_id, mbti, education");

            const ranked: RankUser[] = (profiles || []).map((p: any) => {
                const total = (p.rank_score_es || 0) + (p.rank_score_personality || 0) + (p.rank_score_interview || 0) + (p.rank_score_education || 0);
                return {
                    id: p.id,
                    name: p.name || "名前未設定",
                    es: p.rank_score_es || 0,
                    personality: p.rank_score_personality || 0,
                    interview: p.rank_score_interview || 0,
                    education: p.rank_score_education || 0,
                    total,
                    rank: calcRank(total).rank,
                    department_id: p.department_id,
                    mbti: p.mbti,
                    education_str: p.education,
                };
            }).filter(u => u.total > 0).sort((a, b) => b.total - a.total);

            setAllUsers(ranked);

            const me = ranked.find(u => u.id === user.id);
            setMyData(me || null);

            const myProfile = profiles?.find((p: any) => p.id === user.id);
            setEvaluatedAt((myProfile as any)?.rank_evaluated_at || null);
            // 企業データ取得
            const { data: companyRows } = await supabase
                .from("companies")
                .select("*")
                .order("name");
            setCompanies(companyRows || []);

            setLoading(false);
        };
        load();
    }, [router]);

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    // 自分が未評価の場合
    if (!myData || myData.total === 0) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}>
                <div style={{ maxWidth: 720, margin: "0 auto" }}>
                    <button onClick={() => router.push("/menu")} style={{ marginBottom: 24, padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>← メニューに戻る</button>
                    <div style={{ padding: 60, textAlign: "center", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: 64, marginBottom: 16 }}>🎯</div>
                        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>就活市場ランク</h1>
                        <p style={{ color: "#9ca3af", lineHeight: 1.7 }}>あなたの就活市場ランクはまだ評価されていません。<br />adminによる評価をお待ちください。</p>
                    </div>
                </div>
            </main>
        );
    }

    const rankInfo = calcRank(myData.total);
    const myPosition = allUsers.findIndex(u => u.id === myData.id) + 1;
    const totalCount = allUsers.length;
    const percentile = totalCount > 0 ? Math.round((1 - (myPosition - 1) / totalCount) * 100) : 0;

    // 似たメンバー（同じランク、自分以外）
    const sameRankMembers = allUsers.filter(u => u.rank === myData.rank && u.id !== myData.id).slice(0, 5);

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}>
            <div style={{ maxWidth: 800, margin: "0 auto" }}>
                <button onClick={() => router.push("/menu")} style={{ marginBottom: 24, padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>← メニューに戻る</button>

                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, marginBottom: 4 }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "0 0 8px" }}>🎯 就活市場ランク</h1>
                    <p style={{ color: "#9ca3af", fontSize: 13 }}>4軸評価であなたの市場価値を可視化</p>
                </div>

                {/* メインランクカード */}
                <div style={{ marginBottom: 24, padding: 32, borderRadius: 20, background: `linear-gradient(135deg, ${rankInfo.color}15, ${rankInfo.color}08)`, border: `2px solid ${rankInfo.color}66`, textAlign: "center", boxShadow: `0 0 40px ${rankInfo.color}20` }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>{rankInfo.emoji}</div>
                    <div style={{ fontSize: 11, color: rankInfo.color, fontWeight: 700, letterSpacing: 4, marginBottom: 8 }}>YOUR RANK</div>
                    <div style={{ fontSize: 96, fontWeight: 900, color: rankInfo.color, lineHeight: 1, marginBottom: 8 }}>{rankInfo.rank}</div>
                    <div style={{ fontSize: 14, color: rankInfo.color, marginBottom: 16, fontWeight: 600 }}>{rankInfo.desc}</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: "#f9fafb", marginBottom: 4 }}>{myData.total}<span style={{ fontSize: 18, color: "#6b7280" }}>/20点</span></div>
                </div>

                {/* 順位表示 */}
                <div style={{ marginBottom: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                    <div style={{ padding: 20, borderRadius: 12, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)", textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, marginBottom: 4 }}>🏆 全体順位</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb" }}>{myPosition}<span style={{ fontSize: 14, color: "#6b7280" }}>/{totalCount}位</span></div>
                    </div>
                    <div style={{ padding: 20, borderRadius: 12, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.3)", textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "#34d399", fontWeight: 700, marginBottom: 4 }}>📊 上位パーセンタイル</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb" }}>{percentile}<span style={{ fontSize: 14, color: "#6b7280" }}>%</span></div>
                    </div>
                    <div style={{ padding: 20, borderRadius: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 700, marginBottom: 4 }}>👥 同ランクメンバー</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb" }}>{sameRankMembers.length + 1}<span style={{ fontSize: 14, color: "#6b7280" }}>人</span></div>
                    </div>
                </div>

                {/* 4軸スコア詳細 */}
                <div style={{ marginBottom: 24, padding: 24, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>📊 4軸スコア</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {[
                            { label: "📝 ES", value: myData.es, color: "#06b6d4" },
                            { label: "🤝 人間性", value: myData.personality, color: "#34d399" },
                            { label: "💬 面談力", value: myData.interview, color: "#fbbf24" },
                            { label: "🎓 学歴", value: myData.education, color: "#a855f7" },
                        ].map((axis) => (
                            <div key={axis.label}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                    <span style={{ fontSize: 13, color: "#d1d5db", fontWeight: 600 }}>{axis.label}</span>
                                    <span style={{ fontSize: 13, color: axis.color, fontWeight: 700 }}>{axis.value}<span style={{ color: "#6b7280" }}>/5</span></span>
                                </div>
                                <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${(axis.value / 5) * 100}%`, background: `linear-gradient(90deg, ${axis.color}, ${axis.color}aa)`, borderRadius: 999, transition: "width 0.5s ease" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 似たメンバー */}
                {sameRankMembers.length > 0 && (
                    <div style={{ marginBottom: 24, padding: 24, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>👥 同ランクの仲間（{rankInfo.rank}ランク）</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {sameRankMembers.map((u, i) => (
                                <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: rankInfo.bg, border: `1px solid ${rankInfo.color}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: rankInfo.color }}>{u.name.charAt(0)}</div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb" }}>{u.name}</div>
                                            <div style={{ fontSize: 11, color: "#6b7280" }}>{u.education_str || "学歴未登録"} {u.mbti && `/ ${u.mbti}`}</div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 16, fontWeight: 800, color: rankInfo.color }}>{u.total}<span style={{ fontSize: 11, color: "#6b7280" }}>点</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* 狙える企業 */}
                {(() => {
                    const tierOrder = ["E", "D", "C", "B", "A", "S"];
                    const myTierIndex = tierOrder.indexOf(myData.rank);
                    const sameTierCompanies = companies.filter(c => c.tier === myData.rank);
                    const stepUpTier = myTierIndex < tierOrder.length - 1 ? tierOrder[myTierIndex + 1] : null;
                    const stepUpCompanies = stepUpTier ? companies.filter(c => c.tier === stepUpTier) : [];

                    return (
                        <>
                            {/* 同ティア企業 */}
                            <div style={{ marginBottom: 24, padding: 24, borderRadius: 16, background: `linear-gradient(135deg, ${rankInfo.color}10, transparent)`, border: `1px solid ${rankInfo.color}40` }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                                    <div>
                                        <div style={{ fontSize: 11, color: rankInfo.color, fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>🎯 あなたが狙える企業</div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: "#f9fafb" }}>{rankInfo.rank}ランクの企業</div>
                                    </div>
                                    <div style={{ padding: "6px 12px", borderRadius: 999, background: `${rankInfo.color}20`, border: `1px solid ${rankInfo.color}66`, fontSize: 12, fontWeight: 800, color: rankInfo.color }}>
                                        {sameTierCompanies.length}社
                                    </div>
                                </div>
                                {sameTierCompanies.length === 0 ? (
                                    <div style={{ padding: 24, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
                                        まだ {rankInfo.rank} ランクの企業データはありません
                                    </div>
                                ) : (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                                        {sameTierCompanies.map(c => (
                                            <a key={c.id} href={c.website_url || "#"} target="_blank" rel="noopener noreferrer" onClick={(e) => !c.website_url && e.preventDefault()} style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", textDecoration: "none", display: "block", cursor: c.website_url ? "pointer" : "default", transition: "all 0.2s" }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                                                <div style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.industry || "業界未設定"}</div>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ステップアップ企業 */}
                            {stepUpTier && stepUpCompanies.length > 0 && (
                                <div style={{ marginBottom: 24, padding: 24, borderRadius: 16, background: "linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,191,36,0.02))", border: "1px solid rgba(251,191,36,0.3)" }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                                        <div>
                                            <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>✨ ステップアップ目標</div>
                                            <div style={{ fontSize: 18, fontWeight: 800, color: "#f9fafb" }}>{stepUpTier}ランクを目指そう</div>
                                            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>一つ上のランクで狙える企業</div>
                                        </div>
                                        <div style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(251,191,36,0.2)", border: "1px solid rgba(251,191,36,0.66)", fontSize: 12, fontWeight: 800, color: "#fbbf24" }}>
                                            {stepUpCompanies.length}社
                                        </div>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                                        {stepUpCompanies.slice(0, 12).map(c => (
                                            <a key={c.id} href={c.website_url || "#"} target="_blank" rel="noopener noreferrer" onClick={(e) => !c.website_url && e.preventDefault()} style={{ padding: 12, borderRadius: 10, background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)", textDecoration: "none", display: "block", cursor: c.website_url ? "pointer" : "default" }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                                                <div style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.industry || "業界未設定"}</div>
                                            </a>
                                        ))}
                                    </div>
                                    {stepUpCompanies.length > 12 && (
                                        <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "#9ca3af" }}>
                                            他 {stepUpCompanies.length - 12}社
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    );
                })()}
                {/* 評価日 */}
                {evaluatedAt && (
                    <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#6b7280" }}>
                        最終評価日: {new Date(evaluatedAt).toLocaleDateString("ja-JP")}
                    </div>
                )}
            </div>
        </main>
    );
}