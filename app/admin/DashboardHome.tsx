"use client";
import React from "react";

type Stats = {
    notSubmitted: number;
    submitRate: number;
    pendingCount: number;
    userCount: number;
    pendingChallenge?: number;
    pendingTask?: number;
    pendingKkc?: number;
    pendingAdvice?: number;
    pendingMedaka?: number;
    pendingMentor?: number;
    pendingMtg?: number;
    pendingTest?: number;
    pendingRecruit?: number;
};

type Card = { key: string; icon: string; title: string; desc: string; badgeKey?: string };

const CATEGORIES: { label: string; icon: string; cards: Card[] }[] = [
    {
        label: "メンバー管理", icon: "👥",
        cards: [
            { key: "users", icon: "🧑", title: "ユーザー一覧", desc: "メンバーの一覧と詳細" },
            { key: "teams", icon: "👨‍👩‍👧", title: "チーム", desc: "チームの作成と管理" },
            { key: "sibyl", icon: "🔮", title: "シビュラ", desc: "AI分析と適性診断" },
            { key: "talent_archive", icon: "📇", title: "人材アーカイブ", desc: "過去のメンバー管理" },
        ],
    },
    {
        label: "業務管理", icon: "📋",
        cards: [
            { key: "reports", icon: "📝", title: "日報", desc: "日報の確認と管理" },
            { key: "schedule", icon: "🗓️", title: "スケジュール", desc: "Questの確認" },
            { key: "mtg_report", icon: "📄", title: "MTG報告書", desc: "会議の記録", badgeKey: "pendingMtg" },
            { key: "task_management", icon: "✅", title: "タスク管理", desc: "タスクの進捗", badgeKey: "pendingTask" },
            { key: "es", icon: "📑", title: "総合ES", desc: "総合ESの管理" },
            { key: "roadmap", icon: "🛤️", title: "ロードマップ", desc: "進捗管理" },
            { key: "challenges", icon: "🎯", title: "チャレンジ", desc: "チャレンジ承認", badgeKey: "pendingChallenge" },
            { key: "tests", icon: "📊", title: "テスト結果", desc: "テストの確認", badgeKey: "pendingTest" },
            { key: "thanks_history", icon: "💌", title: "サンキュー履歴", desc: "感謝の記録" },
        ],
    },
    {
        label: "コミュニティ", icon: "💬",
        cards: [
            { key: "announce", icon: "📢", title: "お知らせ", desc: "お知らせの配信" },
            { key: "survey", icon: "📋", title: "アンケート", desc: "作成と集計" },
            { key: "kkc", icon: "✨", title: "KKC", desc: "称賛と表彰", badgeKey: "pendingKkc" },
            { key: "advice", icon: "🚀", title: "アドバイス", desc: "アドバイス管理", badgeKey: "pendingAdvice" },
            { key: "questions_box", icon: "❓", title: "質問クエスト", desc: "Q&Aの管理" },
            { key: "mentor_report", icon: "🤝", title: "ペイフォワード", desc: "循環管理", badgeKey: "pendingMentor" },
            { key: "badge", icon: "🏅", title: "バッジ", desc: "バッジの設定" },
            { key: "medaka_manage", icon: "🐟", title: "メダカBOX", desc: "匿名意見箱", badgeKey: "pendingMedaka" },
            { key: "thinking_manage", icon: "🧠", title: "思考・大喜利", desc: "思考クエスト" },
        ],
    },
    {
        label: "コンテンツ管理", icon: "📚",
        cards: [
            { key: "contents", icon: "🎬", title: "学習コンテンツ", desc: "学習の管理" },
            { key: "resources", icon: "📁", title: "資料管理", desc: "社内資料" },
            { key: "wiki", icon: "📖", title: "用語集", desc: "用語の管理" },
            { key: "shop", icon: "🛒", title: "ショップ", desc: "ショップの管理" },
            { key: "career", icon: "💼", title: "就活ボックス", desc: "就活情報" },
            { key: "companies", icon: "🏢", title: "企業管理", desc: "企業情報" },
        ],
    },
    {
        label: "KPI・分析", icon: "📈",
        cards: [
            { key: "kpi", icon: "🎯", title: "KPI設定", desc: "KPIの設定" },
            { key: "monthly_kpi", icon: "📅", title: "月次KPI", desc: "月次の目標" },
            { key: "sales", icon: "💰", title: "販売額管理", desc: "売上の管理" },
        ],
    },
    {
        label: "申請・承認", icon: "📮",
        cards: [
            { key: "requests", icon: "📥", title: "申請", desc: "各種申請の承認", badgeKey: "pendingCount" },
            { key: "recruit", icon: "🔥", title: "HRキャンペーン承認", desc: "採用アクションの承認", badgeKey: "pendingRecruit" },
        ],
    },
];

export default function DashboardHome({ stats, onNavigate }: { stats: Stats; onNavigate: (key: string) => void }) {
    const summary = [
        { label: "未提出日報", value: stats.notSubmitted, unit: "人", color: "#f87171" },
        { label: "日報提出率", value: stats.submitRate, unit: "%", color: stats.submitRate >= 80 ? "#34d399" : stats.submitRate >= 50 ? "#f59e0b" : "#f87171" },
        { label: "承認待ち申請", value: stats.pendingCount, unit: "件", color: "#a78bfa" },
        { label: "全メンバー", value: stats.userCount, unit: "人", color: "#818cf8" },
    ];

    return (
        <div>
            {/* サマリー */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 28 }}>
                {summary.map((s, i) => (
                    <div key={i} style={{ padding: "18px 20px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: 11.5, color: "#9ca3af", fontWeight: 700, marginBottom: 8 }}>{s.label}</div>
                        <div style={{ fontSize: 30, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}<span style={{ fontSize: 15, color: "#6b7280", marginLeft: 2 }}>{s.unit}</span></div>
                    </div>
                ))}
            </div>

            {/* カテゴリ別カード */}
            {CATEGORIES.map((cat) => (
                <div key={cat.label} style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#e5e7eb", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{cat.icon}</span>{cat.label}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                        {cat.cards.map((card: any) => {
                            const badge = card.badgeKey ? (stats as any)[card.badgeKey] || 0 : 0;
                            return (
                                <button key={card.key} onClick={() => onNavigate(card.key)} style={{ position: "relative", textAlign: "left", padding: "16px 18px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", transition: "all .15s", display: "flex", alignItems: "center", gap: 12 }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.12)"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.4)"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
                                    <div style={{ fontSize: 24, flexShrink: 0 }}>{card.icon}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13.5, fontWeight: 800, color: "#f9fafb" }}>{card.title}</div>
                                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{card.desc}</div>
                                    </div>
                                    {badge > 0 && <div style={{ flexShrink: 0, minWidth: 22, height: 22, borderRadius: 999, background: "#f59e0b", color: "#fff", fontSize: 11.5, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{badge}</div>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
