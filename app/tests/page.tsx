"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type TestItem = {
    key: string;
    label: string;
    desc: string;
    path: string;
    icon: string;
    color: string;
    passedField?: string;
    rewardText: string;
};

const TESTS: TestItem[] = [
    { key: "quiz", label: "確認ワークテスト", desc: "価値観と仕事の基本をチェック", path: "/quiz", icon: "🧠", color: "#a78bfa", passedField: "quiz_passed", rewardText: "合格で +500pt" },
    { key: "marketer", label: "マーケター適性テスト", desc: "売れる仕組みを作れるか", path: "/tests/marketer", icon: "📊", color: "#06b6d4", passedField: "marketer_passed", rewardText: "Aランクで +500pt" },
    { key: "sales", label: "営業デビュー適性テスト", desc: "現場に出る準備ができているか", path: "/tests/sales", icon: "💼", color: "#8b5cf6", passedField: "sales_passed", rewardText: "Aランクで +500pt" },
    { key: "mentor", label: "メンターテスト", desc: "育成者としての思考判定", path: "/tests/mentor", icon: "🌱", color: "#10b981", passedField: "mentor_passed", rewardText: "合格で +500pt" },
    { key: "planner", label: "企画職適性テスト", desc: "売上責任を持つ設計者か", path: "/tests/planner", icon: "💡", color: "#ec4899", passedField: "planner_passed", rewardText: "Aランクで +500pt" },
    { key: "entrepreneur", label: "起業適性テスト", desc: "今やるべきか、まだやるな", path: "/tests/entrepreneur", icon: "🚀", color: "#f59e0b", passedField: "entrepreneur_passed", rewardText: "Aランクで +500pt" },
    { key: "manager", label: "マネージャーテスト", desc: "チームで勝つための思考", path: "/manager-test", icon: "👔", color: "#6366f1", rewardText: "合格で +500pt" },
    { key: "retention", label: "Dot.A 雇用テスト", desc: "雇用継続の判定テスト", path: "/tests/retention", icon: "🔥", color: "#ef4444", passedField: "retention_passed", rewardText: "合格で +1000pt" },
];

export default function TestsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
            setProfile(p);
            setLoading(false);
        };
        load();
    }, [router]);

    if (loading) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
        </main>
    );

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 800, margin: "0 auto" }}>
                <div onClick={() => router.push("/menu")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", marginBottom: 8 }}>INTERN QUEST</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "0 0 4px" }}>📝 テスト一覧</h1>
                <p style={{ color: "#9ca3af", fontSize: 14, margin: "0 0 32px" }}>あなたの価値観・適性・覚悟を測る8種類のテスト</p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {TESTS.map(t => {
                        const passed = t.passedField ? (profile?.[t.passedField] || false) : false;
                        return (
                            <div key={t.key} onClick={() => router.push(t.path)} style={{ padding: "20px 24px", borderRadius: 14, background: passed ? "rgba(16,185,129,0.05)" : "rgba(255,255,255,0.03)", border: `1px solid ${passed ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)"}`, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 16 }}>
                                <div style={{ width: 56, height: 56, borderRadius: 12, background: `${t.color}20`, border: `1px solid ${t.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>{t.icon}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb" }}>{t.label}</div>
                                        {passed && <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(16,185,129,0.2)", color: "#10b981", fontSize: 11, fontWeight: 700 }}>✅ 合格済</span>}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>{t.desc}</div>
                                    <div style={{ fontSize: 11, color: t.color, fontWeight: 600 }}>{t.rewardText}</div>
                                </div>
                                <div style={{ fontSize: 20, color: "#6b7280" }}>›</div>
                            </div>
                        );
                    })}
                </div>

                <div style={{ marginTop: 40, textAlign: "center" }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>メニューへ戻る</button>
                </div>
            </div>
        </main>
    );
}
