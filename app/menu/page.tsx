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

function getTodayJSTRange() {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear(), m = jst.getUTCMonth(), d = jst.getUTCDate();
    const start = new Date(Date.UTC(y, m, d) - 9 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString(), ymd: jst.toISOString().slice(0, 10) };
}

function formatAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 60) return `${Math.max(1, min)}分前`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}時間前`;
    return `${Math.floor(hr / 24)}日前`;
}

function formatReason(reason: string): string {
    const map: Record<string, string> = {
        report_submit: "日報を提出", streak_bonus: "連続提出ボーナス", maru_streak_bonus: "連続達成ボーナス",
        thinking_answer: "思考クエストに回答", thinking_ippon_received: "IPPON獲得", thanks_send: "サンキューを送信",
        thanks_received: "サンキューをもらった", learning_complete: "学習を完了", challenge_clear: "チャレンジ達成",
        gacha: "ガチャ", login_bonus: "ログインボーナス", task_report_approved: "タスク報告書承認",
    };
    return map[reason] || reason;
}

export default function MenuPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [openCat, setOpenCat] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [totalEarned, setTotalEarned] = useState(0);
    const [balance, setBalance] = useState<number | null>(null);
    const [streak, setStreak] = useState(0);
    const [weekPt, setWeekPt] = useState(0);
    const [missions, setMissions] = useState({ report: false, schedule: false, thinking: false, thanks: false });
    const [recent, setRecent] = useState<{ reason: string; change: number; created_at: string }[]>([]);
    const [myBadges, setMyBadges] = useState<{ icon: string; name: string }[]>([]);

    const level = Math.max(1, Math.floor(totalEarned / 100) + 1);
    const exp = totalEarned % 100;
    const doneCount = [missions.report, missions.schedule, missions.thinking, missions.thanks].filter(Boolean).length;

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);
            if (user.email && adminEmails.includes(user.email)) setIsAdmin(true);

            const { start, end, ymd } = getTodayJSTRange();
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

            const [profileRes, pointsRes, histRes, weekRes, subRes, schedRes, thinkRes, thanksRes, badgeRes] = await Promise.all([
                supabase.from("profiles").select("name, streak").eq("id", user.id).single(),
                supabase.from("user_points").select("*").eq("user_id", user.id).maybeSingle(),
                supabase.from("points_history").select("reason, change, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
                supabase.from("points_history").select("change").eq("user_id", user.id).gte("created_at", weekAgo),
                supabase.from("submissions").select("id").eq("user_id", user.id).gte("created_at", start).lt("created_at", end).limit(1),
                supabase.from("daily_schedules").select("id").eq("user_id", user.id).eq("date", ymd).maybeSingle(),
                supabase.from("thinking_answers").select("id").eq("user_id", user.id).gte("created_at", start).lt("created_at", end).limit(1),
                supabase.from("thanks").select("id").eq("from_user_id", user.id).gte("created_at", start).lt("created_at", end).limit(1),
                supabase.from("user_badges").select("badge_id, badges(name, icon)").eq("user_id", user.id).limit(4),
            ]);

            setName((profileRes.data as any)?.name || "");
            setStreak((profileRes.data as any)?.streak || 0);
            const pr: any = pointsRes.data;
            setTotalEarned(pr?.total_earned || 0);
            setBalance(typeof pr?.points === "number" ? pr.points : (typeof pr?.balance === "number" ? pr.balance : null));
            setRecent((histRes.data as any[]) || []);
            setWeekPt(((weekRes.data as any[]) || []).filter(r => r.change > 0).reduce((a, r) => a + r.change, 0));
            setMissions({
                report: !!(subRes.data && (subRes.data as any[]).length > 0),
                schedule: !!schedRes.data,
                thinking: !!(thinkRes.data && (thinkRes.data as any[]).length > 0),
                thanks: !!(thanksRes.data && (thanksRes.data as any[]).length > 0),
            });
            setMyBadges((((badgeRes.data as any[]) || []).map(b => ({ icon: b.badges?.icon || "🏅", name: b.badges?.name || "バッジ" }))));
            setLoading(false);
        };
        init();
    }, [router]);

    const card: React.CSSProperties = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.22)", borderRadius: 20, padding: 22 };
    const label: React.CSSProperties = { fontSize: 11, color: "#8b8ba7", fontWeight: 800, letterSpacing: 2, marginBottom: 14 };

    if (loading) return <div style={{ minHeight: "100vh", background: "#0b0b16", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b8ba7" }}>読み込み中...</div>;

    const MISSION_CARDS = [
        { key: "report", icon: "📋", labelText: "日報提出", pt: "+2pt", href: "/report", done: missions.report },
        { key: "schedule", icon: "☀️", labelText: "今日の予定", pt: "", href: "/today-schedule", done: missions.schedule },
        { key: "thinking", icon: "🧠", labelText: "思考クエスト", pt: "+5pt", href: "/thinking", done: missions.thinking },
        { key: "thanks", icon: "🙏", labelText: "サンキュー", pt: "+1pt", href: "/thanks", done: missions.thanks },
    ];

    return (
        <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 30% 0%, #17172e 0%, #0b0b16 55%)", padding: "26px 16px 90px" }}>
            <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
                {/* トップバー */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                        <div onClick={() => router.push("/home")} style={{ fontSize: 12, color: "#a78bfa", fontWeight: 900, letterSpacing: 3, cursor: "pointer" }}>✦ INTERN QUEST</div>
                        <div style={{ fontSize: 11, color: "#6b6b85", marginTop: 2 }}>今日も経験値を積もう</div>
                    </div>
                    <button onClick={() => router.push("/home")} style={{ border: "1px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.12)", borderRadius: 12, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#c4b5fd", cursor: "pointer" }}>🏝️ 島へ戻る</button>
                </div>

                {/* ① Hero Header */}
                <div style={{ ...card, background: "linear-gradient(150deg, rgba(139,92,246,0.16), rgba(99,102,241,0.06) 60%, rgba(255,255,255,0.02))", border: "1px solid rgba(139,92,246,0.35)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 16 }}>
                        <div style={{ width: 76, height: 76, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #8b5cf6, #4c1d95)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "0 0 24px rgba(139,92,246,0.5)", flexShrink: 0 }}>
                            <div style={{ fontSize: 10, color: "#ddd6fe", fontWeight: 700, lineHeight: 1 }}>Lv.</div>
                            <div style={{ fontSize: 30, color: "#fff", fontWeight: 900, lineHeight: 1 }}>{level}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: "#8b8ba7", fontWeight: 700 }}>{name || "プレイヤー"} — 次のレベルまで</div>
                            <div style={{ fontSize: 30, fontWeight: 900, color: "#c4b5fd", lineHeight: 1.15 }}>あと {100 - exp}<span style={{ fontSize: 15, color: "#8b8ba7" }}> pt</span></div>
                            <div style={{ marginTop: 8, height: 10, borderRadius: 999, background: "rgba(255,255,255,0.07)" }}>
                                <div style={{ height: "100%", width: `${exp}%`, borderRadius: 999, background: "linear-gradient(90deg, #8b5cf6, #c4b5fd)", boxShadow: "0 0 12px rgba(139,92,246,0.6)" }} />
                            </div>
                            <div style={{ marginTop: 5, fontSize: 11, color: "#6b6b85", textAlign: "right" }}>{totalEarned.toLocaleString()} pt 累計 / EXP {exp}/100</div>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", fontSize: 12.5, fontWeight: 800, color: "#fca5a5" }}>🔥 連続 {streak}日</div>
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", fontSize: 12.5, fontWeight: 800, color: "#fcd34d" }}>⚡ 今週 +{weekPt}pt</div>
                    </div>
                </div>

                {/* ② 今日のミッション */}
                <div style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div style={{ ...label, marginBottom: 0 }}>✦ 今日のミッション</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#a78bfa" }}>{doneCount} / 4 完了</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                        {MISSION_CARDS.map((m) => (
                            <div key={m.key} onClick={() => { if (!m.done) router.push(m.href); }} style={{
                                padding: "14px 4px 12px", borderRadius: 14, textAlign: "center", cursor: m.done ? "default" : "pointer",
                                background: m.done ? "rgba(52,211,153,0.07)" : "rgba(139,92,246,0.1)",
                                border: m.done ? "1px solid rgba(52,211,153,0.35)" : "1.5px solid rgba(139,92,246,0.55)",
                                boxShadow: m.done ? "none" : "0 0 16px rgba(139,92,246,0.25)",
                            }}>
                                <div style={{ fontSize: 24, marginBottom: 5, opacity: m.done ? 0.6 : 1 }}>{m.icon}</div>
                                <div style={{ fontSize: 10.5, fontWeight: 800, color: m.done ? "#6ee7b7" : "#e0d7ff", lineHeight: 1.3, marginBottom: 5 }}>{m.labelText}</div>
                                {m.done
                                    ? <div style={{ fontSize: 14, color: "#34d399", fontWeight: 900 }}>✓</div>
                                    : <div style={{ fontSize: 10, fontWeight: 800, color: "#c4b5fd", background: "rgba(139,92,246,0.25)", borderRadius: 999, padding: "2px 0", margin: "0 6px" }}>{m.pt || "未完了"}</div>}
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 12, textAlign: "center", fontSize: 12, fontWeight: 800, color: doneCount >= 4 ? "#fcd34d" : "#6b6b85" }}>
                        {doneCount >= 4 ? "🎉 デイリーコンプリート！おみごと！" : `🎁 すべて達成でコンプリート！ あと${4 - doneCount}つ`}
                    </div>
                </div>

                {/* ③ おすすめショートカット */}
                <div>
                    <div style={label}>⚡ おすすめショートカット</div>
                    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch" }}>
                        {SHORTCUTS.map((s) => (
                            <div key={s.path + s.label} onClick={() => router.push(s.path)} style={{ flexShrink: 0, width: 84, padding: "12px 4px 10px", borderRadius: 14, textAlign: "center", cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(139,92,246,0.25)" }}>
                                <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
                                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#c7c7de" }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ④ カテゴリ（アコーディオン） */}
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

                {/* ⑦ ポイントショップ */}
                <div onClick={() => router.push("/shop")} style={{ ...card, cursor: "pointer", display: "flex", alignItems: "center", gap: 16, background: "linear-gradient(140deg, rgba(252,211,77,0.1), rgba(139,92,246,0.06))", border: "1px solid rgba(252,211,77,0.35)" }}>
                    <div style={{ fontSize: 34 }}>🎁</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: "#8b8ba7", fontWeight: 700, letterSpacing: 1 }}>ポイントショップ</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: "#fcd34d", lineHeight: 1.2 }}>{balance !== null ? `${balance.toLocaleString()} pt` : "ショップへ"}</div>
                        <div style={{ fontSize: 11, color: "#8b8ba7", marginTop: 2 }}>{balance !== null ? "交換可能なアイテムがあります" : "貯めたptでアイテムと交換"}</div>
                    </div>
                    <div style={{ fontSize: 14, color: "#fcd34d", fontWeight: 800 }}>→</div>
                </div>

                {/* ⑥ 獲得バッジ */}
                <div style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div style={{ ...label, marginBottom: 0 }}>🎖️ 獲得バッジ</div>
                        <div onClick={() => router.push("/badges")} style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", cursor: "pointer" }}>すべて見る →</div>
                    </div>
                    {myBadges.length > 0 ? (
                        <div style={{ display: "flex", gap: 12 }}>
                            {myBadges.map((b, i) => (
                                <div key={i} style={{ flex: 1, textAlign: "center", padding: "12px 4px", borderRadius: 14, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)" }}>
                                    <div style={{ fontSize: 26, marginBottom: 4 }}>{b.icon}</div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#c7c7de", lineHeight: 1.3 }}>{b.name}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ fontSize: 12, color: "#6b6b85" }}>まだバッジがありません。活動して集めよう！</div>
                    )}
                </div>

                {/* ⑤ 最近の活動 */}
                <div style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ ...label, marginBottom: 0 }}>📜 最近の活動</div>
                        <div onClick={() => router.push("/history")} style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", cursor: "pointer" }}>すべて見る →</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {recent.map((r, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                <div>
                                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#d6d6e7" }}>{formatReason(r.reason)}</div>
                                    <div style={{ fontSize: 10.5, color: "#6b6b85", marginTop: 1 }}>{formatAgo(r.created_at)}</div>
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 900, color: r.change >= 0 ? "#34d399" : "#f87171" }}>{r.change > 0 ? `+${r.change}` : r.change}pt</div>
                            </div>
                        ))}
                        {recent.length === 0 && <div style={{ fontSize: 12, color: "#6b6b85" }}>まだ活動履歴がありません</div>}
                    </div>
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
