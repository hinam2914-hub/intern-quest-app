"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type MenuItem = { icon: string; label: string; path: string };
type Category = { key: string; icon: string; title: string; desc: string; items: MenuItem[] };

const SHORTCUTS: MenuItem[] = [
    { icon: "📋", label: "日報", path: "/report" },
    { icon: "☀️", label: "予定", path: "/today-schedule" },
    { icon: "🧠", label: "思考", path: "/thinking" },
    { icon: "🎯", label: "チャレンジ", path: "/challenge" },
    { icon: "📚", label: "学習", path: "/learn" },
];

const CATEGORIES: Category[] = [
    {
        key: "daily", icon: "📅", title: "デイリー", desc: "毎日の業務・記録", items: [
            { icon: "☀️", label: "今日の予定", path: "/today-schedule" },
            { icon: "📋", label: "日報", path: "/report" },
            { icon: "✅", label: "マイタスク", path: "/my-tasks" },
            { icon: "🔁", label: "マイルーティン", path: "/routine" },
        ]
    },
    {
        key: "learn", icon: "🎓", title: "学ぶ・挑戦", desc: "学習・テスト・クエスト", items: [
            { icon: "📚", label: "学習コンテンツ", path: "/learn" },
            { icon: "📝", label: "テスト", path: "/tests" },
            { icon: "🧠", label: "思考クエスト", path: "/thinking" },
            { icon: "🎯", label: "ライフチャレンジ", path: "/challenge" },
            { icon: "📖", label: "Wiki・用語集", path: "/wiki" },
            { icon: "📂", label: "資料", path: "/resources" },
        ]
    },
    {
        key: "rank", icon: "🏆", title: "実績・ランキング", desc: "ポイント・バッジ・実績", items: [
            { icon: "🏆", label: "ランキング", path: "/ranking" },
            { icon: "👑", label: "昨日の〇〇王", path: "/kings" },
            { icon: "🎖️", label: "バッジ", path: "/badges" },
            { icon: "📜", label: "ポイント履歴", path: "/history" },
            { icon: "🎰", label: "ガチャ", path: "/gacha" },
        ]
    },
    {
        key: "commu", icon: "💬", title: "コミュニケーション", desc: "サンキュー・報告・共有", items: [
            { icon: "🙏", label: "サンキュー", path: "/thanks" },
            { icon: "🐟", label: "メダカBOX", path: "/medaka" },
            { icon: "📄", label: "MTGレポート", path: "/mtg-report" },
            { icon: "🧑‍🏫", label: "メンター報告", path: "/mentor-report" },
            { icon: "🗳️", label: "アンケート", path: "/surveys" },
        ]
    },
    {
        key: "career", icon: "💼", title: "就活・キャリア", desc: "ES・ロードマップ・KPI", items: [
            { icon: "✍️", label: "ES", path: "/es" },
            { icon: "📈", label: "就活市場ランク", path: "/rank" },
            { icon: "🗺️", label: "ロードマップ", path: "/roadmap" },
            { icon: "💼", label: "キャリアBOX", path: "/career" },
            { icon: "🎯", label: "月次KPI", path: "/kpi" },
        ]
    },
    {
        key: "setting", icon: "⚙️", title: "設定・サポート", desc: "プロフィール・通知", items: [
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
    const [balance, setBalance] = useState<number | null>(null);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);
            if (user.email && adminEmails.includes(user.email)) setIsAdmin(true);
            const { data: pr } = await supabase.from("user_points").select("*").eq("id", user.id).maybeSingle();
            const p: any = pr;
            setBalance(typeof p?.points === "number" ? p.points : (typeof p?.balance === "number" ? p.balance : null));
            setLoading(false);
        };
        init();
    }, [router]);

    const label: React.CSSProperties = { fontSize: 11, color: "#8b8ba7", fontWeight: 800, letterSpacing: 2, marginBottom: 10 };

    if (loading) return <div style={{ minHeight: "100vh", background: "#0b0b16", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b8ba7" }}>読み込み中...</div>;

    return (
        <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 30% 0%, #17172e 0%, #0b0b16 55%)", padding: "26px 16px 90px" }}>
            <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
                {/* トップバー */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                        <div onClick={() => router.push("/home")} style={{ fontSize: 12, color: "#a78bfa", fontWeight: 900, letterSpacing: 3, cursor: "pointer" }}>✦ INTERN QUEST</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "#e5e5f2", marginTop: 2 }}>☰ メニュー</div>
                    </div>
                    <button onClick={() => router.push("/home")} style={{ border: "1px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.12)", borderRadius: 12, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#c4b5fd", cursor: "pointer" }}>🏝️ 島へ戻る</button>
                </div>

                {/* よく使う */}
                <div>
                    <div style={label}>⚡ よく使う</div>
                    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch" }}>
                        {SHORTCUTS.map((s) => (
                            <div key={s.path + s.label} onClick={() => router.push(s.path)} style={{ flexShrink: 0, width: 88, padding: "14px 4px 12px", borderRadius: 14, textAlign: "center", cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(139,92,246,0.3)" }}>
                                <div style={{ fontSize: 24, marginBottom: 5 }}>{s.icon}</div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#c7c7de" }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* カテゴリ（アコーディオン） */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {CATEGORIES.map((cat) => {
                        const open = openCat === cat.key;
                        return (
                            <div key={cat.key} style={{ borderRadius: 16, overflow: "hidden", background: "rgba(255,255,255,0.03)", border: open ? "1px solid rgba(139,92,246,0.45)" : "1px solid rgba(255,255,255,0.07)" }}>
                                <div onClick={() => setOpenCat(open ? null : cat.key)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <span style={{ fontSize: 20 }}>{cat.icon}</span>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 800, color: "#e5e5f2" }}>{cat.title}</div>
                                            <div style={{ fontSize: 10.5, color: "#6b6b85", marginTop: 1 }}>{cat.desc}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontSize: 11, fontWeight: 800, color: "#c4b5fd", background: "rgba(139,92,246,0.2)", borderRadius: 999, padding: "2px 9px" }}>{cat.items.length}</span>
                                        <span style={{ fontSize: 11, color: "#8b8ba7", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
                                    </div>
                                </div>
                                {open && (
                                    <div style={{ borderTop: "1px solid rgba(139,92,246,0.2)", padding: "6px 8px 10px" }}>
                                        {cat.items.map((item) => (
                                            <div key={item.path + item.label} onClick={() => router.push(item.path)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 10, cursor: "pointer" }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.12)"; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                                            >
                                                <span style={{ fontSize: 18 }}>{item.icon}</span>
                                                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#c7c7de" }}>{item.label}</span>
                                                <span style={{ fontSize: 12, color: "#6b6b85" }}>→</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ポイントショップ */}
                <div onClick={() => router.push("/shop")} style={{ borderRadius: 20, padding: 22, cursor: "pointer", display: "flex", alignItems: "center", gap: 16, background: "linear-gradient(140deg, rgba(252,211,77,0.1), rgba(139,92,246,0.06))", border: "1px solid rgba(252,211,77,0.35)" }}>
                    <div style={{ fontSize: 34 }}>🎁</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: "#8b8ba7", fontWeight: 700, letterSpacing: 1 }}>ポイントショップ</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: "#fcd34d", lineHeight: 1.2 }}>{balance !== null ? `${balance.toLocaleString()} pt` : "ショップへ"}</div>
                        <div style={{ fontSize: 11, color: "#8b8ba7", marginTop: 2 }}>{balance !== null ? "交換可能なアイテムがあります" : "貯めたptでアイテムと交換"}</div>
                    </div>
                    <div style={{ fontSize: 14, color: "#fcd34d", fontWeight: 800 }}>→</div>
                </div>

                {/* 管理者・ログアウト */}
                {isAdmin && (
                    <div onClick={() => router.push("/admin")} style={{ borderRadius: 14, padding: "13px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)" }}>
                        <span style={{ fontSize: 18 }}>🛠️</span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: "#a5b4fc" }}>管理者ページ</span>
                        <span style={{ fontSize: 12, color: "#8b8ba7" }}>→</span>
                    </div>
                )}
                <button onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }} style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.06)", color: "#f87171", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>ログアウト</button>
            </div>
        </div>
    );
}
