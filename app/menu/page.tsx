"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type MenuItem = { icon: string; label: string; path: string };
type Category = { key: string; icon: string; title: string; items: MenuItem[] };

const SHORTCUTS: MenuItem[] = [
    { icon: "📋", label: "日報を書く", path: "/report" },
    { icon: "☀️", label: "今日の予定", path: "/today-schedule" },
    { icon: "🧠", label: "思考クエスト", path: "/thinking" },
    { icon: "🎯", label: "ライフチャレンジ", path: "/challenge" },
    { icon: "📚", label: "学習する", path: "/learn" },
];

const CATEGORIES: Category[] = [
    {
        key: "daily", icon: "📅", title: "デイリー", items: [
            { icon: "☀️", label: "今日の予定", path: "/today-schedule" },
            { icon: "📋", label: "日報", path: "/report" },
            { icon: "✅", label: "マイタスク", path: "/my-tasks" },
            { icon: "🔁", label: "マイルーティン", path: "/routine" },
        ]
    },
    {
        key: "learn", icon: "🎓", title: "学ぶ・挑戦", items: [
            { icon: "📚", label: "学習コンテンツ", path: "/learn" },
            { icon: "📝", label: "テスト", path: "/tests" },
            { icon: "🧠", label: "思考クエスト", path: "/thinking" },
            { icon: "🎯", label: "ライフチャレンジ", path: "/challenge" },
            { icon: "📖", label: "Wiki・用語集", path: "/wiki" },
            { icon: "📂", label: "資料", path: "/resources" },
        ]
    },
    {
        key: "rank", icon: "🏆", title: "実績・ランキング", items: [
            { icon: "🏆", label: "ランキング", path: "/ranking" },
            { icon: "👑", label: "昨日の〇〇王", path: "/kings" },
            { icon: "🎖️", label: "バッジ", path: "/badges" },
            { icon: "📜", label: "ポイント履歴", path: "/history" },
            { icon: "🎰", label: "ガチャ", path: "/gacha" },
        ]
    },
    {
        key: "commu", icon: "💬", title: "コミュニケーション", items: [
            { icon: "🙏", label: "サンキュー", path: "/thanks" },
            { icon: "🐟", label: "メダカBOX", path: "/medaka" },
            { icon: "📄", label: "MTGレポート", path: "/mtg-report" },
            { icon: "🧑‍🏫", label: "メンター報告", path: "/mentor-report" },
            { icon: "🗳️", label: "アンケート", path: "/surveys" },
        ]
    },
    {
        key: "career", icon: "💼", title: "就活・キャリア", items: [
            { icon: "✍️", label: "ES", path: "/es" },
            { icon: "📈", label: "就活市場ランク", path: "/rank" },
            { icon: "🗺️", label: "ロードマップ", path: "/roadmap" },
            { icon: "💼", label: "キャリアBOX", path: "/career" },
            { icon: "🎯", label: "月次KPI", path: "/kpi" },
        ]
    },
    {
        key: "setting", icon: "⚙️", title: "設定・サポート", items: [
            { icon: "🧍", label: "アバター", path: "/avatar" },
            { icon: "🔔", label: "通知", path: "/notifications" },
            { icon: "🐡", label: "ドットくんとは", path: "/dotkun" },
        ]
    },
];

export default function MenuPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [openCat, setOpenCat] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);
            if (user.email && adminEmails.includes(user.email)) setIsAdmin(true);
            setLoading(false);
        };
        init();
    }, [router]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    if (loading) return <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #cfe9f7, #eaf6ee)", display: "flex", alignItems: "center", justifyContent: "center", color: "#7a6a4a" }}>読み込み中...</div>;

    return (
        <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #cfe9f7 0%, #e8f4e4 55%, #f6efdd 100%)", padding: "28px 18px 96px" }}>
            <div style={{ maxWidth: 480, margin: "0 auto" }}>
                {/* ヘッダー */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                    <div>
                        <div onClick={() => router.push("/home")} style={{ fontSize: 11, color: "#b0641f", fontWeight: 800, letterSpacing: 3, cursor: "pointer" }}>INTERN QUEST</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#4a3a26" }}>☰ メニュー</div>
                    </div>
                    <button onClick={() => router.push("/home")} style={{ border: "1.5px solid rgba(160,120,60,.35)", background: "rgba(255,255,255,.8)", borderRadius: 12, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, color: "#7a5a2b", cursor: "pointer" }}>🏝️ 島へ戻る</button>
                </div>

                {/* よく使うショートカット */}
                <div style={{ fontSize: 12, fontWeight: 900, color: "#8a6a3a", letterSpacing: 1, marginBottom: 8 }}>⚡ よく使う</div>
                <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, marginBottom: 18, WebkitOverflowScrolling: "touch" }}>
                    {SHORTCUTS.map((s) => (
                        <div key={s.path + s.label} onClick={() => router.push(s.path)} style={{ flexShrink: 0, width: 108, padding: "16px 8px 14px", borderRadius: 18, textAlign: "center", cursor: "pointer", background: "linear-gradient(165deg, #fffdf4, #f7edd8)", border: "1.5px solid rgba(190,160,110,.4)", boxShadow: "0 5px 14px rgba(120,90,40,.15), inset 0 1px 0 rgba(255,255,255,.8)" }}>
                            <div style={{ fontSize: 30, marginBottom: 6 }}>{s.icon}</div>
                            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#6b5232", lineHeight: 1.3 }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* 折りたたみカテゴリ */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
                    {CATEGORIES.map((cat) => {
                        const open = openCat === cat.key;
                        return (
                            <div key={cat.key} style={{ borderRadius: 18, overflow: "hidden", background: "rgba(255,253,244,.92)", border: "1.5px solid rgba(190,160,110,.35)", boxShadow: "0 4px 12px rgba(120,90,40,.1)" }}>
                                <div onClick={() => setOpenCat(open ? null : cat.key)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", cursor: "pointer" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <span style={{ fontSize: 20 }}>{cat.icon}</span>
                                        <span style={{ fontSize: 14.5, fontWeight: 800, color: "#4a3a26" }}>{cat.title}</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg, #d8a44a, #b9843a)", borderRadius: 999, padding: "2px 9px" }}>{cat.items.length}</span>
                                        <span style={{ fontSize: 12, color: "#a08050", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
                                    </div>
                                </div>
                                {open && (
                                    <div style={{ borderTop: "1px solid rgba(190,160,110,.25)", padding: "6px 8px 10px" }}>
                                        {cat.items.map((item) => (
                                            <div key={item.path + item.label} onClick={() => router.push(item.path)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 12px", borderRadius: 12, cursor: "pointer" }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(216,164,74,.12)"; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                            >
                                                <span style={{ fontSize: 19 }}>{item.icon}</span>
                                                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: "#5a4630" }}>{item.label}</span>
                                                <span style={{ fontSize: 12, color: "#c0a070" }}>→</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ポイントショップ */}
                <div onClick={() => router.push("/shop")} style={{ borderRadius: 18, padding: "18px 20px", marginBottom: 18, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, background: "linear-gradient(150deg, #fff3d6, #ffe3b8)", border: "1.5px solid rgba(210,150,60,.45)", boxShadow: "0 5px 14px rgba(160,110,40,.18)" }}>
                    <div style={{ fontSize: 34 }}>🎁</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: "#8a5a1a" }}>ポイントショップ</div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: "#a97b3a", marginTop: 2 }}>貯めたptでアイテムと交換しよう</div>
                    </div>
                    <div style={{ fontSize: 14, color: "#b9843a", fontWeight: 800 }}>→</div>
                </div>

                {/* 管理者 */}
                {isAdmin && (
                    <div onClick={() => router.push("/admin")} style={{ borderRadius: 16, padding: "14px 18px", marginBottom: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, background: "rgba(99,102,241,.1)", border: "1.5px solid rgba(99,102,241,.35)" }}>
                        <span style={{ fontSize: 20 }}>🛠️</span>
                        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: "#5b5bd6" }}>管理者ページ</span>
                        <span style={{ fontSize: 12, color: "#8b8bd6" }}>→</span>
                    </div>
                )}

                {/* ログアウト */}
                <button onClick={handleLogout} style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "1.5px solid rgba(190,120,110,.4)", background: "rgba(255,255,255,.7)", color: "#b05a4a", fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}>ログアウト</button>
            </div>
        </div>
    );
}
