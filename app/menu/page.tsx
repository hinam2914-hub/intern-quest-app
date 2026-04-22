"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function MenuPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [points, setPoints] = useState(0);
    const [isAdmin, setIsAdmin] = useState(false);
    const [userRole, setUserRole] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            const { data: profile } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();
            const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", user.id).single();
            setName(profile?.name || "");
            setPoints(pointRow?.points || 0);
            const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map(e => e.trim());
            setIsAdmin(!!user.email && adminEmails.includes(user.email));
            setUserRole((profile as any)?.role || "");
            setLoading(false); setLoading(false);
        };
        load();
    }, [router]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    const menuItems = [
        { icon: "🏠", label: "マイページ", desc: "ホーム・ステータス確認", path: "/mypage", color: "#6366f1" },
        { icon: "📋", label: "日報提出", desc: "今日の活動を記録してポイント獲得", path: "/report", color: "#8b5cf6" },
        { icon: "📸", label: "プロフィール写真", desc: "顔写真をアップロードする", path: "/profile", color: "#ec4899" },
        { icon: "📚", label: "学習コンテンツ", desc: "動画・記事を学習してポイント獲得", path: "/learn", color: "#06b6d4" },
        { icon: "🎉", label: "サンキュー", desc: "感謝を伝えてポイントをプレゼント", path: "/thanks", color: "#f59e0b" },
        { icon: "📊", label: "月次KPI", desc: "月次実績を入力してポイント獲得", path: "/kpi", color: "#06b6d4" },
        { icon: "🛍️", label: "ポイントショップ", desc: "ポイントでアイテムと交換", path: "/shop", color: "#10b981" },
        { icon: "🏆", label: "ランキング", desc: "全員のポイントランキングを確認", path: "/ranking", color: "#ef4444" },
        { icon: "📜", label: "ポイント履歴", desc: "獲得・使用したポイントの履歴", path: "/history", color: "#6b7280" },
        { icon: "📖", label: "使い方", desc: "Intern Questの使い方を確認する", path: "/onboarding", color: "#34d399" },
        { icon: "📁", label: "参考資料BOX", desc: "業務に役立つ資料・リンクをまとめています", path: "/resources", color: "#34d399" },
        { icon: "📖", label: "用語集", desc: "社内・就活用語をまとめました", path: "/wiki", color: "#6366f1" },
        { icon: "🎯", label: "ライフチャレンジ", desc: "人生の経験値を積んでスタンプを集めよう", path: "/challenge", color: "#f59e0b" },
        { icon: "💼", label: "就活ボックス", desc: "大学別・企業別の就活情報をチェック", path: "/career", color: "#ec4899" },
        { icon: "📊", label: "自分の実績", desc: "累計データ・ランク・順位を確認", path: "/stats", color: "#06b6d4" },
        ...(["Manager", "Owner"].includes(userRole) ? [{ icon: "🎖️", label: "マネージャーテスト", desc: "マネージャー認定のための価値観テスト", path: "/manager-test", color: "#ec4899" }] : []),
    ];

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.08) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto" }}>

                {/* ヘッダー */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
                    <div>
                        {/* ✅ ロゴクリックでホームへ */}
                        <div
                            onClick={() => router.push("/mypage")}
                            style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer" }}
                        >
                            INTERN QUEST
                        </div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>{name || "名前未設定"}</h1>
                    </div>
                    <div style={{ padding: "10px 20px", borderRadius: 12, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", fontSize: 18, fontWeight: 800, color: "#818cf8" }}>
                        {points.toLocaleString()} pt
                    </div>
                </div>

                {/* メニューグリッド */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    {menuItems.map((item) => (
                        <button
                            key={item.path}
                            onClick={() => router.push(item.path)}
                            style={{ padding: "20px 24px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.borderColor = `${item.color}40`; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${item.color}20`, border: `1px solid ${item.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                                    {item.icon}
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb" }}>{item.label}</div>
                            </div>
                            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{item.desc}</div>
                        </button>
                    ))}
                </div>

                {/* 管理者メニュー */}
                {isAdmin && (
                    <button
                        onClick={() => router.push("/admin")}
                        style={{ width: "100%", padding: "20px 24px", borderRadius: 16, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.08)", cursor: "pointer", textAlign: "left", marginBottom: 16 }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>⚙️</div>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: "#818cf8" }}>管理者ダッシュボード</div>
                                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>ユーザー管理・KPI・コンテンツ・申請管理</div>
                            </div>
                        </div>
                    </button>
                )}

                {/* ログアウト */}
                <button
                    onClick={handleLogout}
                    style={{ width: "100%", padding: "14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "#6b7280", fontWeight: 600, cursor: "pointer", fontSize: 14 }}
                >
                    ログアウト
                </button>
            </div>
        </main>
    );
}