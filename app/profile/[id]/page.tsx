"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Profile = {
    id: string;
    name: string;
    avatar_url: string | null;
    bio: string | null;
    position: string | null;
    education: string | null;
    mbti: string | null;
    club: string | null;
    club_category: string | null;
    hobby_category: string | null;
    growth_rank: string | null;
    growth_status: string | null;
    department_id: string | null;
    rank_score_es: number | null;
    rank_score_personality: number | null;
    rank_score_interview: number | null;
    rank_score_education: number | null;
    [key: string]: any; // *_passed フラグ用
};

type Department = {
    id: string;
    name: string;
    code: string;
    color?: string;
};

type Challenge = {
    id: string;
    title: string;
    points: number | null;
    category: string | null;
    icon: string | null;
};

type ChallengeSubmission = {
    id: string;
    challenge_id: string;
    comment: string | null;
    image_url: string | null;
    status: string;
    created_at: string;
    challenges: Challenge | null;
};

// テスト定義（合格フラグカラム名 → 表示名）
const TEST_LIST = [
    { key: "quiz_passed", label: "確認ワーク", icon: "📚", color: "#6366f1" },
    { key: "common_sense_passed", label: "常識・デリカシー", icon: "🧠", color: "#a78bfa" },
    { key: "social_standard_passed", label: "社会人基準", icon: "🎯", color: "#ec4899" },
    { key: "long_term_thinking_passed", label: "長期思考", icon: "📈", color: "#3b82f6" },
    { key: "profit_thinking_passed", label: "利益思考", icon: "💰", color: "#10b981" },
    { key: "essence_thinking_passed", label: "本質思考", icon: "🔍", color: "#06b6d4" },
    { key: "standard_keeping_passed", label: "基準維持", icon: "⚖️", color: "#f97316" },
    { key: "market_value_passed", label: "市場価値認識", icon: "💪", color: "#0891b2" },
    { key: "teiou_passed", label: "Dot.A帝王学", icon: "👑", color: "#fbbf24" },
    { key: "mentor_passed", label: "メンター", icon: "🌱", color: "#10b981" },
    { key: "retention_passed", label: "Dot.A雇用", icon: "🔥", color: "#ef4444" },
    { key: "entrepreneur_passed", label: "起業", icon: "🚀", color: "#f59e0b" },
    { key: "marketer_passed", label: "マーケター", icon: "📊", color: "#06b6d4" },
    { key: "sales_passed", label: "営業デビュー", icon: "💼", color: "#8b5cf6" },
    { key: "planner_passed", label: "企画", icon: "💡", color: "#ec4899" },
    { key: "manager_certified", label: "マネージャー", icon: "👔", color: "#fbbf24" },
    { key: "standard_raising_passed", label: "基準上昇", icon: "🚀", color: "#f43f5e" },
    { key: "management_collab_passed", label: "マネジメント協働", icon: "🤝", color: "#06b6d4" },
    { key: "cert_market_value_passed", label: "資格依存改善", icon: "��", color: "#14b8a6" },
    { key: "improvement_force_passed", label: "改善力", icon: "🔧", color: "#f97316" },
    { key: "apology_escape_passed", label: "謝罪逃避防止", icon: "🪞", color: "#eab308" },
    { key: "logical_thinking_passed", label: "論理思考", icon: "🧮", color: "#6366f1" },
    { key: "progress_update_passed", label: "進捗更新", icon: "📡", color: "#84cc16" },
    { key: "life_improvement_passed", label: "生活改善", icon: "⏰", color: "#d946ef" },
    { key: "market_eval_passed", label: "市場価値・評価認識", icon: "📊", color: "#ef4444" },
    { key: "quick_response_passed", label: "即レス", icon: "⚡", color: "#facc15" },
    { key: "self_protection_passed", label: "保身防止", icon: "🛡️", color: "#a855f7" },
];

// 就活市場ランク計算
const calcRank = (total: number) => {
    if (total >= 17) return { label: "A", color: "#fbbf24", icon: "🏆" };
    if (total >= 13) return { label: "B", color: "#a855f7", icon: "🥈" };
    if (total >= 9) return { label: "C", color: "#06b6d4", icon: "🥉" };
    if (total >= 5) return { label: "D", color: "#f97316", icon: "" };
    return { label: "E", color: "#6b7280", icon: "" };
};

export default function ProfilePage() {
    const params = useParams();
    const router = useRouter();
    const userId = params.id as string;

    const [profile, setProfile] = useState<Profile | null>(null);
    const [department, setDepartment] = useState<Department | null>(null);
    const [userPoints, setUserPoints] = useState<{ points: number; total_earned: number } | null>(null);
    const [challenges, setChallenges] = useState<ChallengeSubmission[]>([]);
    const [thanksCount, setThanksCount] = useState(0);
    const [isMyself, setIsMyself] = useState(false);
    const [loading, setLoading] = useState(true);
    const [expandedChallenge, setExpandedChallenge] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            // 自分のIDを取得してisMyself判定
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/login");
                return;
            }
            setIsMyself(user.id === userId);

            // profileデータ取得（全カラム）
            const { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .single();

            if (!profileData) {
                setLoading(false);
                return;
            }
            setProfile(profileData as Profile);

            // department取得
            if (profileData.department_id) {
                const { data: deptData } = await supabase
                    .from("departments")
                    .select("*")
                    .eq("id", profileData.department_id)
                    .single();
                if (deptData) setDepartment(deptData as Department);
            }

            // user_points取得
            const { data: pointsData } = await supabase
                .from("user_points")
                .select("points, total_earned")
                .eq("id", userId)
                .single();
            if (pointsData) setUserPoints(pointsData);

            // ライフチャレンジ承認済み取得
            const { data: challengesData } = await supabase
                .from("challenge_submissions")
                .select("*, challenges(id, title, points, category, icon)")
                .eq("user_id", userId)
                .eq("status", "approved")
                .order("created_at", { ascending: false });
            setChallenges((challengesData as ChallengeSubmission[]) || []);

            // サンキュー受信数
            const { count } = await supabase
                .from("thanks")
                .select("*", { count: "exact", head: true })
                .eq("to_user_id", userId);
            setThanksCount(count || 0);

            setLoading(false);
        };
        load();
    }, [userId, router]);

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    if (!profile) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
                <div style={{ color: "#ef4444", fontSize: 18, fontWeight: 700 }}>ユーザーが見つかりません</div>
                <button onClick={() => router.back()} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", cursor: "pointer" }}>戻る</button>
            </main>
        );
    }

    const totalEarned = userPoints?.total_earned || 0;
    const level = Math.floor(totalEarned / 100) + 1;
    const rankTotal = (profile.rank_score_es || 0) + (profile.rank_score_personality || 0) + (profile.rank_score_interview || 0) + (profile.rank_score_education || 0);
    const rank = calcRank(rankTotal);

    // 合格テスト一覧（passedフラグがtrueのもののみ）
    const passedTests = TEST_LIST.filter(t => profile[t.key] === true);

    const renderAvatar = (size: number) => {
        if (profile.avatar_url) {
            return <img src={profile.avatar_url} alt={profile.name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />;
        }
        return (
            <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 700, color: "#fff" }}>
                {profile.name?.charAt(0) || "?"}
            </div>
        );
    };

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "24px 16px", color: "#f9fafb" }}>
            <div style={{ maxWidth: 800, margin: "0 auto" }}>
                {/* ヘッダー */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                    <div onClick={() => router.push("/mypage")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                </div>

                {/* 基本情報カード */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
                    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                        {renderAvatar(96)}
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{profile.name}</div>
                            {profile.position && (
                                <div style={{ fontSize: 14, color: "#9ca3af", marginBottom: 8 }}>{profile.position}</div>
                            )}
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {department && (
                                    <span style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", fontSize: 12, color: "#a5b4fc", fontWeight: 600 }}>
                                        {department.name || department.code}
                                    </span>
                                )}
                                {profile.growth_rank && (
                                    <span style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", fontSize: 12, color: "#fde68a", fontWeight: 600 }}>
                                        {profile.growth_rank}
                                    </span>
                                )}
                                {isMyself && (
                                    <span style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", fontSize: 12, color: "#6ee7b7", fontWeight: 600 }}>
                                        YOU
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    {profile.bio && (
                        <div style={{ marginTop: 16, padding: 12, background: "rgba(255,255,255,0.02)", borderRadius: 8, fontSize: 14, color: "#d1d5db", lineHeight: 1.6 }}>
                            {profile.bio}
                        </div>
                    )}
                </div>

                {/* 数値ステータス */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                    <div style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.05))", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: 16, textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, letterSpacing: 1 }}>TOTAL POINTS</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#a5b4fc" }}>{totalEarned.toLocaleString()}<span style={{ fontSize: 12, marginLeft: 2 }}>pt</span></div>
                    </div>
                    <div style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.05))", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 12, padding: 16, textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, letterSpacing: 1 }}>LEVEL</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#fde68a" }}>Lv.{level}</div>
                    </div>
                    <div style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.15), rgba(244,114,182,0.05))", border: "1px solid rgba(236,72,153,0.2)", borderRadius: 12, padding: 16, textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, letterSpacing: 1 }}>💌 THANKS</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#f9a8d4" }}>{thanksCount}<span style={{ fontSize: 12, marginLeft: 2 }}>件</span></div>
                    </div>
                </div>

                {/* 個性セクション */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#d1d5db" }}>🎓 個性</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {profile.education && (
                            <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 13 }}>
                                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>学歴</div>
                                <div style={{ color: "#f9fafb" }}>{profile.education}</div>
                            </div>
                        )}
                        {profile.mbti && (
                            <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 13 }}>
                                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>MBTI</div>
                                <div style={{ color: "#f9fafb" }}>{profile.mbti}</div>
                            </div>
                        )}
                        {(profile.club_category || profile.club) && (
                            <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 13 }}>
                                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>部活</div>
                                <div style={{ color: "#f9fafb" }}>{profile.club_category || profile.club}</div>
                            </div>
                        )}
                        {profile.hobby_category && (
                            <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 13 }}>
                                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>趣味</div>
                                <div style={{ color: "#f9fafb" }}>{profile.hobby_category}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* テスト合格履歴 */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#d1d5db" }}>
                        🏆 合格テスト ({passedTests.length}/{TEST_LIST.length})
                    </div>
                    {passedTests.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {passedTests.map(test => (
                                <div key={test.key} style={{ padding: "6px 10px", background: `${test.color}15`, border: `1px solid ${test.color}40`, borderRadius: 8, fontSize: 12, color: test.color, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                                    <span>{test.icon}</span>
                                    <span>{test.label}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", padding: "16px 0" }}>まだ合格したテストはありません</div>
                    )}
                </div>

                {/* ライフチャレンジ承認履歴 */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#d1d5db" }}>
                        🎯 ライフチャレンジ達成 ({challenges.length})
                    </div>
                    {challenges.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {challenges.map(c => {
                                const isExpanded = expandedChallenge === c.id;
                                const hasDetail = c.comment || c.image_url;
                                return (
                                    <div
                                        key={c.id}
                                        onClick={() => hasDetail && setExpandedChallenge(isExpanded ? null : c.id)}
                                        style={{
                                            padding: 12,
                                            background: "rgba(16,185,129,0.05)",
                                            border: `1px solid rgba(16,185,129,${isExpanded ? "0.3" : "0.15"})`,
                                            borderRadius: 8,
                                            cursor: hasDetail ? "pointer" : "default",
                                            transition: "border-color 0.2s",
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: 14 }}>✅</span>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: "#6ee7b7", flex: 1, minWidth: 0 }}>{c.challenges?.title || "チャレンジ"}</div>
                                            {c.challenges?.category && (
                                                <span style={{ padding: "2px 6px", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 4, fontSize: 10, color: "#a5b4fc", fontWeight: 600 }}>
                                                    {c.challenges.category}
                                                </span>
                                            )}
                                            {c.challenges?.points && (
                                                <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 700 }}>+{c.challenges.points}pt</span>
                                            )}
                                            {hasDetail && (
                                                <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 4 }}>{isExpanded ? "▲" : "▼"}</span>
                                            )}
                                        </div>
                                        {isExpanded && (
                                            <>
                                                {c.comment && (
                                                    <div style={{ fontSize: 12, color: "#d1d5db", marginTop: 8, paddingLeft: 22, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.comment}</div>
                                                )}
                                                {c.image_url && (
                                                    <div style={{ marginTop: 8, marginLeft: 22 }}>
                                                        <img src={c.image_url} alt={c.challenges?.title || "チャレンジ画像"} style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 6, display: "block" }} />
                                                    </div>
                                                )}
                                                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 8, paddingLeft: 22 }}>{new Date(c.created_at).toLocaleDateString("ja-JP")}</div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", padding: "16px 0" }}>まだ達成したチャレンジはありません</div>
                    )}
                </div>

                {/* 🔒 本人のみ：就活市場ランク */}
                {isMyself && rankTotal > 0 && (
                    <div style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#fde68a" }}>🔒 就活市場ランク</span>
                            <span style={{ fontSize: 10, color: "#9ca3af", padding: "2px 8px", background: "rgba(255,255,255,0.05)", borderRadius: 4 }}>本人のみ表示</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                            <div style={{ fontSize: 48, fontWeight: 900, color: rank.color }}>{rank.label}</div>
                            <div>
                                <div style={{ fontSize: 12, color: "#9ca3af" }}>合計スコア</div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>{rankTotal} / 20</div>
                            </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 12 }}>
                                <div style={{ color: "#9ca3af" }}>ES</div>
                                <div style={{ fontWeight: 700 }}>{profile.rank_score_es || 0} / 5</div>
                            </div>
                            <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 12 }}>
                                <div style={{ color: "#9ca3af" }}>人間性</div>
                                <div style={{ fontWeight: 700 }}>{profile.rank_score_personality || 0} / 5</div>
                            </div>
                            <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 12 }}>
                                <div style={{ color: "#9ca3af" }}>面談力</div>
                                <div style={{ fontWeight: 700 }}>{profile.rank_score_interview || 0} / 5</div>
                            </div>
                            <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 12 }}>
                                <div style={{ color: "#9ca3af" }}>学歴</div>
                                <div style={{ fontWeight: 700 }}>{profile.rank_score_education || 0} / 5</div>
                            </div>
                        </div>
                    </div>
                )}
                {/* ===== メニューへ戻るボタン（統一） ===== */}
                <div style={{ display: "flex", justifyContent: "center", marginTop: 48, marginBottom: 32 }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>
                        メニューへ戻る
                    </button>
                </div>
            </div>
        </main>
    );
}