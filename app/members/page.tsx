"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Department = {
    id: string;
    code: string;
    name: string;
};

type Member = {
    id: string;
    name: string | null;
    avatar_url: string | null;
    department_id: string | null;
    education: string | null;
    mbti: string | null;
    growth_rank: string | null;
    growth_grade: string | null;
    // テスト合格フラグ
    quiz_passed: boolean | null;
    mentor_passed: boolean | null;
    retention_passed: boolean | null;
    entrepreneur_passed: boolean | null;
    marketer_passed: boolean | null;
    sales_passed: boolean | null;
    planner_passed: boolean | null;
    common_sense_passed: boolean | null;
    profit_thinking_passed: boolean | null;
    long_term_thinking_passed: boolean | null;
    social_standard_passed: boolean | null;
    teiou_passed: boolean | null;
    essence_thinking_passed: boolean | null;
    standard_keeping_passed: boolean | null;
    market_value_passed: boolean | null;
    manager_certified: boolean | null;
    points?: number;
    challenge_count?: number;
    test_count?: number;
};

const DEPT_THEMES: Record<string, { icon: string; color: string; bgColor: string; borderColor: string }> = {
    CB: { icon: "📞", color: "#a5b4fc", bgColor: "rgba(99,102,241,0.05)", borderColor: "rgba(99,102,241,0.2)" },
    IP: { icon: "💻", color: "#6ee7b7", bgColor: "rgba(16,185,129,0.05)", borderColor: "rgba(16,185,129,0.2)" },
    SP: { icon: "📱", color: "#fde68a", bgColor: "rgba(251,191,36,0.05)", borderColor: "rgba(251,191,36,0.2)" },
    HR: { icon: "🌸", color: "#fbcfe8", bgColor: "rgba(236,72,153,0.05)", borderColor: "rgba(236,72,153,0.2)" },
    MK: { icon: "📊", color: "#c4b5fd", bgColor: "rgba(139,92,246,0.05)", borderColor: "rgba(139,92,246,0.2)" },
    UNASSIGNED: { icon: "🌌", color: "#9ca3af", bgColor: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" },
};

const TEST_KEYS: (keyof Member)[] = [
    "quiz_passed", "mentor_passed", "retention_passed", "entrepreneur_passed",
    "marketer_passed", "sales_passed", "planner_passed", "manager_certified",
    "common_sense_passed", "social_standard_passed", "profit_thinking_passed",
    "long_term_thinking_passed", "essence_thinking_passed", "standard_keeping_passed",
    "market_value_passed", "teiou_passed",
];

export default function MembersPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [members, setMembers] = useState<Member[]>([]);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/login");
                return;
            }

            // 部署一覧
            const { data: deptData } = await supabase
                .from("departments")
                .select("id, code, name")
                .order("code");

            // メンバー一覧
            const { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .order("name");

            // ポイント一覧
            const { data: pointsData } = await supabase
                .from("user_points")
                .select("id, points");
            const pointsMap = new Map((pointsData || []).map((p: any) => [p.id, p.points || 0]));

            // チャレンジ承認数
            const { data: chData } = await supabase
                .from("challenge_submissions")
                .select("user_id")
                .eq("status", "approved");
            const chCountMap = new Map<string, number>();
            (chData || []).forEach((c: any) => {
                chCountMap.set(c.user_id, (chCountMap.get(c.user_id) || 0) + 1);
            });

            // 各メンバーの統計を計算
            const enriched: Member[] = (profileData || []).map((p: any) => {
                const testCount = TEST_KEYS.filter(k => p[k] === true).length;
                return {
                    ...p,
                    points: pointsMap.get(p.id) || 0,
                    challenge_count: chCountMap.get(p.id) || 0,
                    test_count: testCount,
                };
            });

            setDepartments(deptData || []);
            setMembers(enriched);
            setLoading(false);
        })();
    }, [router]);

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    // 部署ごとにグループ化
    const grouped: { dept: Department | null; members: Member[]; theme: typeof DEPT_THEMES[string] }[] = [];
    departments.forEach(d => {
        const deptMembers = members.filter(m => m.department_id === d.id);
        if (deptMembers.length > 0) {
            grouped.push({ dept: d, members: deptMembers, theme: DEPT_THEMES[d.code] || DEPT_THEMES.UNASSIGNED });
        }
    });
    const unassigned = members.filter(m => !m.department_id);
    if (unassigned.length > 0) {
        grouped.push({ dept: null, members: unassigned, theme: DEPT_THEMES.UNASSIGNED });
    }

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.06) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto" }}>
                {/* ヘッダー */}
                <div style={{ marginBottom: 32 }}>
                    <div onClick={() => router.push("/menu")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 4px" }}>👥 メンバー一覧</h1>
                    <div style={{ fontSize: 13, color: "#9ca3af" }}>全{members.length}名のインターン生</div>
                </div>

                {/* 部署別セクション */}
                {grouped.map(({ dept, members: deptMembers, theme }) => (
                    <div key={dept?.id || "unassigned"} style={{ background: theme.bgColor, border: `1px solid ${theme.borderColor}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                            <span style={{ fontSize: 22 }}>{theme.icon}</span>
                            <div style={{ fontSize: 16, fontWeight: 700, color: theme.color }}>
                                {dept ? dept.name : "未配属"}
                            </div>
                            <span style={{ fontSize: 11, color: "#6b7280", padding: "2px 8px", background: "rgba(255,255,255,0.05)", borderRadius: 10 }}>{deptMembers.length}名</span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                            {deptMembers.map(m => (
                                <div
                                    key={m.id}
                                    onClick={() => router.push(`/profile/${m.id}`)}
                                    style={{
                                        padding: 14,
                                        background: "rgba(255,255,255,0.03)",
                                        border: "1px solid rgba(255,255,255,0.08)",
                                        borderRadius: 10,
                                        cursor: "pointer",
                                        transition: "transform 0.2s, background 0.2s, border-color 0.2s",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = "translateY(-2px)";
                                        e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                                        e.currentTarget.style.borderColor = theme.borderColor.replace("0.2", "0.4");
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = "translateY(0)";
                                        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                                    }}
                                >
                                    {/* アバター */}
                                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                                        {m.avatar_url ? (
                                            <img src={m.avatar_url} alt={m.name || ""} style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: `2px solid ${theme.borderColor.replace("0.2", "0.4")}` }} />
                                        ) : (
                                            <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg, ${theme.color}40, ${theme.color}20)`, display: "flex", alignItems: "center", justifyContent: "center", color: theme.color, fontSize: 22, fontWeight: 700, border: `2px solid ${theme.borderColor.replace("0.2", "0.4")}` }}>
                                                {(m.name || "?").charAt(0)}
                                            </div>
                                        )}
                                    </div>

                                    {/* 名前 */}
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb", textAlign: "center", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {m.name || "名前未設定"}
                                    </div>

                                    {/* 学歴 / MBTI */}
                                    {(m.education || m.mbti) && (
                                        <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "center", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {m.mbti && <span style={{ color: "#a5b4fc", fontWeight: 600 }}>{m.mbti}</span>}
                                            {m.mbti && m.education && " · "}
                                            {m.education}
                                        </div>
                                    )}

                                    {/* ポイント */}
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", textAlign: "center", marginBottom: 8 }}>
                                        💎 {(m.points || 0).toLocaleString()}pt
                                    </div>

                                    {/* バッジ */}
                                    <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                                        <div style={{ padding: "2px 6px", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 4, fontSize: 10, color: "#c4b5fd", fontWeight: 600 }}>
                                            🏆 {m.test_count}
                                        </div>
                                        <div style={{ padding: "2px 6px", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 4, fontSize: 10, color: "#6ee7b7", fontWeight: 600 }}>
                                            🎯 {m.challenge_count}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {/* メニューへ戻る */}
                <div style={{ display: "flex", justifyContent: "center", marginTop: 48 }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>
                        メニューへ戻る
                    </button>
                </div>
            </div>
        </main>
    );
}