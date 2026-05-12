"use client";

import { useRouter } from "next/navigation";

export default function SpecPage() {
    const router = useRouter();

    const sections = [
        {
            id: "purpose",
            title: "🎯 アプリの目的・基本理念",
            color: "#6366f1",
            content: (
                <>
                    <p style={{ lineHeight: 1.8, marginBottom: 12 }}>
                        <strong style={{ color: "#a78bfa" }}>Intern Quest</strong> は、メンバーの日々の行動・成長・成果を可視化し、市場価値の高い人材育成を支援するゲーミフィケーション型プラットフォームです。
                    </p>
                    <div style={{ padding: 16, borderRadius: 10, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                        <div style={{ fontWeight: 700, color: "#a78bfa", marginBottom: 8 }}>💡 何を評価するか</div>
                        <ul style={{ paddingLeft: 20, lineHeight: 1.8, color: "#d1d5db" }}>
                            <li>日々の継続力（日報・KPI）</li>
                            <li>思考力（KKC課題解決）</li>
                            <li>リーダーシップ（サンキュー、メンタリング）</li>
                            <li>アウトプット力（ES、テスト）</li>
                            <li>市場価値（就活ランク）</li>
                        </ul>
                    </div>
                </>
            ),
        },
        {
            id: "points",
            title: "💰 ポイント獲得ロジック",
            color: "#10b981",
            content: (
                <>
                    <p style={{ marginBottom: 16, color: "#9ca3af" }}>累計ポイントは「総獲得pt」として記録され、レベル・ランクの算出に使われます。</p>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: "2px solid rgba(16,185,129,0.3)" }}>
                                <th style={{ padding: 10, textAlign: "left", color: "#34d399" }}>項目</th>
                                <th style={{ padding: 10, textAlign: "right", color: "#34d399" }}>ポイント</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["🔐 ログインボーナス", "+1pt / 日"],
                                ["📋 日報提出", "+2pt / 回"],
                                ["🔥 連続提出ボーナス", "継続日数で加算"],
                                ["📚 学習コンテンツ完了", "+2pt / 回"],
                                ["🎉 サンキュー受け取り", "+1pt / 件"],
                                ["📊 月次KPI達成", "+30pt 〜"],
                                ["💡 KKC課題解決承認", "+変動pt"],
                                ["📝 各種テスト合格", "+100 〜 1000pt"],
                                ["💌 アドバイス承認（送信者）", "+2pt"],
                            ].map(([label, pts], i) => (
                                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                    <td style={{ padding: 10, color: "#e5e7eb" }}>{label}</td>
                                    <td style={{ padding: 10, textAlign: "right", color: "#34d399", fontWeight: 700 }}>{pts}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            ),
        },
        {
            id: "level",
            title: "🎮 レベルシステム",
            color: "#a78bfa",
            content: (
                <>
                    <div style={{ padding: 16, borderRadius: 10, background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>計算式</div>
                        <div style={{ fontFamily: "monospace", fontSize: 16, color: "#c084fc", fontWeight: 700 }}>
                            Level = floor(累計pt / 100) + 1
                        </div>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
                            例: 0pt → Lv.1 / 100pt → Lv.2 / 1500pt → Lv.16
                        </div>
                    </div>
                    <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8, fontWeight: 700 }}>🏷️ 称号バッジ</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {[
                            { range: "Lv.1 〜 Lv.4", label: "初級者", color: "#6b7280" },
                            { range: "Lv.5 〜 Lv.9", label: "中級者", color: "#06b6d4" },
                            { range: "Lv.10 〜 Lv.14", label: "上級者", color: "#a78bfa" },
                            { range: "Lv.15 〜", label: "達人", color: "#f59e0b" },
                        ].map((b, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)" }}>
                                <span style={{ color: "#d1d5db", fontSize: 13 }}>{b.range}</span>
                                <span style={{ color: b.color, fontWeight: 700, fontSize: 13 }}>{b.label}</span>
                            </div>
                        ))}
                    </div>
                </>
            ),
        },
        {
            id: "effort_rank",
            title: "🏆 EFFORT RANK（7軸評価）",
            color: "#f59e0b",
            content: (
                <>
                    <p style={{ marginBottom: 16, color: "#9ca3af" }}>7つの観点から総合スコア（最大100点）を算出し、SS〜Dランクで判定します。</p>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 16 }}>
                        <thead>
                            <tr style={{ borderBottom: "2px solid rgba(245,158,11,0.3)" }}>
                                <th style={{ padding: 10, textAlign: "left", color: "#fbbf24" }}>評価軸</th>
                                <th style={{ padding: 10, textAlign: "right", color: "#fbbf24" }}>満点</th>
                                <th style={{ padding: 10, textAlign: "left", color: "#fbbf24" }}>基準</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["🎓 学歴", "10点", "大学レベルで自動算出"],
                                ["📅 アクティブ日数", "15点", "730日（2年）で満点"],
                                ["📊 KPI承認数", "15点", "20件で満点"],
                                ["💡 KKC承認数", "20点", "20件で満点"],
                                ["🎉 サンキュー数", "10点", "200件で満点"],
                                ["📝 ES更新数", "20点", "200件で満点"],
                                ["🎮 レベル", "10点", "Lv.37で満点"],
                            ].map(([axis, max, std], i) => (
                                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                    <td style={{ padding: 10, color: "#e5e7eb" }}>{axis}</td>
                                    <td style={{ padding: 10, textAlign: "right", color: "#fbbf24", fontWeight: 700 }}>{max}</td>
                                    <td style={{ padding: 10, color: "#9ca3af", fontSize: 12 }}>{std}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8, fontWeight: 700 }}>🏅 ランク判定</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                        {[
                            { rank: "SS", range: "90点以上", color: "#f59e0b" },
                            { rank: "S", range: "80-89点", color: "#a855f7" },
                            { rank: "A", range: "70-79点", color: "#6366f1" },
                            { rank: "B", range: "60-69点", color: "#06b6d4" },
                            { rank: "C", range: "50-59点", color: "#84cc16" },
                            { rank: "D", range: "49点以下", color: "#6b7280" },
                        ].map((r) => (
                            <div key={r.rank} style={{ padding: 12, borderRadius: 10, background: `${r.color}15`, border: `1px solid ${r.color}40`, textAlign: "center" }}>
                                <div style={{ fontSize: 22, fontWeight: 900, color: r.color }}>{r.rank}</div>
                                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{r.range}</div>
                            </div>
                        ))}
                    </div>
                </>
            ),
        },
        {
            id: "education",
            title: "🎓 学歴スコア基準",
            color: "#06b6d4",
            content: (
                <>
                    <p style={{ marginBottom: 16, color: "#9ca3af" }}>プロフィールに登録された学歴から自動算出されます（最大10点）。</p>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: "2px solid rgba(6,182,212,0.3)" }}>
                                <th style={{ padding: 10, textAlign: "left", color: "#22d3ee" }}>カテゴリ</th>
                                <th style={{ padding: 10, textAlign: "left", color: "#22d3ee" }}>対象大学</th>
                                <th style={{ padding: 10, textAlign: "right", color: "#22d3ee" }}>スコア</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["旧帝大", "東大・京大・阪大・名大・東北大・九大・北大", "10点"],
                                ["早慶上智", "早稲田・慶應・上智", "8点"],
                                ["GMARCH", "学習院・明治・青学・立教・中央・法政", "6点"],
                                ["成成明学獨國武", "成城・成蹊・明治学院・獨協・國學院・武蔵", "5点"],
                                ["日東駒専", "日大・東洋・駒澤・専修", "4点"],
                                ["その他", "上記以外", "2点"],
                            ].map(([cat, schools, pts], i) => (
                                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                    <td style={{ padding: 10, color: "#e5e7eb", fontWeight: 700 }}>{cat}</td>
                                    <td style={{ padding: 10, color: "#9ca3af", fontSize: 12 }}>{schools}</td>
                                    <td style={{ padding: 10, textAlign: "right", color: "#22d3ee", fontWeight: 700 }}>{pts}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            ),
        },
        {
            id: "career_rank",
            title: "🎯 就活市場ランク（4軸評価）",
            color: "#fbbf24",
            content: (
                <>
                    <p style={{ marginBottom: 16, color: "#9ca3af" }}>就活市場での競争力を4軸で評価し、A〜Eランクで判定します（admin評価）。</p>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 16 }}>
                        <thead>
                            <tr style={{ borderBottom: "2px solid rgba(251,191,36,0.3)" }}>
                                <th style={{ padding: 10, textAlign: "left", color: "#fbbf24" }}>評価軸</th>
                                <th style={{ padding: 10, textAlign: "right", color: "#fbbf24" }}>満点</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["📝 ES", "5点"],
                                ["🤝 人間性", "5点"],
                                ["💬 面談力", "5点"],
                                ["🎓 学歴", "5点"],
                            ].map(([axis, max], i) => (
                                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                    <td style={{ padding: 10, color: "#e5e7eb" }}>{axis}</td>
                                    <td style={{ padding: 10, textAlign: "right", color: "#fbbf24", fontWeight: 700 }}>{max}</td>
                                </tr>
                            ))}
                            <tr style={{ borderTop: "2px solid rgba(251,191,36,0.3)" }}>
                                <td style={{ padding: 10, color: "#fbbf24", fontWeight: 800 }}>合計</td>
                                <td style={{ padding: 10, textAlign: "right", color: "#fbbf24", fontWeight: 800 }}>20点満点</td>
                            </tr>
                        </tbody>
                    </table>
                    <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8, fontWeight: 700 }}>🏅 ランク判定</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                        {[
                            { rank: "A 🏆", range: "17点以上", desc: "最上位", color: "#fbbf24" },
                            { rank: "B 🥈", range: "13-16点", desc: "上位", color: "#a855f7" },
                            { rank: "C 🥉", range: "9-12点", desc: "中位", color: "#06b6d4" },
                            { rank: "D 🔻", range: "5-8点", desc: "下位", color: "#f97316" },
                            { rank: "E 🔻", range: "4点以下", desc: "要改善", color: "#6b7280" },
                        ].map((r) => (
                            <div key={r.rank} style={{ padding: 12, borderRadius: 10, background: `${r.color}15`, border: `1px solid ${r.color}40`, textAlign: "center" }}>
                                <div style={{ fontSize: 18, fontWeight: 900, color: r.color }}>{r.rank}</div>
                                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{r.range}</div>
                                <div style={{ fontSize: 10, color: r.color, marginTop: 2 }}>{r.desc}</div>
                            </div>
                        ))}
                    </div>
                </>
            ),
        },
        {
            id: "shop",
            title: "🛍️ ショップ商品・換算ルール",
            color: "#ec4899",
            content: (
                <>
                    <div style={{ padding: 16, borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", marginBottom: 16 }}>
                        <div style={{ fontSize: 13, color: "#fbbf24", fontWeight: 700, marginBottom: 4 }}>⚠️ 現在仮設定</div>
                        <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.6 }}>
                            ショップ商品の値段は現在仮設定中です。本リリース時に正式な換算ルールを定める予定です。
                        </div>
                    </div>
                    <p style={{ color: "#9ca3af", lineHeight: 1.8 }}>
                        ポイントは現金化できず、社内インセンティブとして換金不可です。<br />
                        商品との交換のみ可能で、ショップで会社が用意した商品リストから選択できます。
                    </p>
                </>
            ),
        },
        {
            id: "yearly",
            title: "📅 年間設計（前提）",
            color: "#10b981",
            content: (
                <>
                    <div style={{ padding: 24, borderRadius: 12, background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,182,212,0.08))", border: "1px solid rgba(16,185,129,0.3)" }}>
                        <div style={{ fontSize: 14, color: "#34d399", fontWeight: 700, marginBottom: 12 }}>🎯 想定する標準的な成長ペース</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: "rgba(0,0,0,0.2)" }}>
                                <span style={{ color: "#d1d5db" }}>1日の最低活動</span>
                                <span style={{ color: "#34d399", fontWeight: 700 }}>5pt</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: "rgba(0,0,0,0.2)" }}>
                                <span style={{ color: "#d1d5db" }}>年間活動日数</span>
                                <span style={{ color: "#34d399", fontWeight: 700 }}>300日</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, background: "rgba(0,0,0,0.2)" }}>
                                <span style={{ color: "#d1d5db" }}>年間獲得目安</span>
                                <span style={{ color: "#34d399", fontWeight: 700 }}>1,500pt</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", borderRadius: 8, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
                                <span style={{ color: "#34d399", fontWeight: 700 }}>到達レベル目標</span>
                                <span style={{ color: "#34d399", fontWeight: 800, fontSize: 16 }}>Lv.15（達人）🎉</span>
                            </div>
                        </div>
                    </div>
                </>
            ),
        },
    ];

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}>
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
                {/* 戻るボタン */}
                <button onClick={() => router.push("/mypage")} style={{ marginBottom: 24, padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    🏠 ホームに戻る
                </button>

                {/* ヘッダー */}
                <div style={{ marginBottom: 40 }}>
                    <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, marginBottom: 4 }}>INTERN QUEST</div>
                    <h1 style={{ fontSize: 32, fontWeight: 900, color: "#f9fafb", margin: "0 0 12px" }}>📖 制度・評価ロジック</h1>
                    <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.8 }}>
                        Intern Questで使われているポイント獲得、レベル、ランクの算出ロジックを公開します。<br />
                        制度の透明性を高め、メンバー全員が納得して取り組める環境を目指します。
                    </p>
                </div>

                {/* 目次 */}
                <div style={{ marginBottom: 32, padding: 20, borderRadius: 12, background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.2)" }}>
                    <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>📑 目次</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {sections.map((s, i) => (
                            <a key={s.id} href={`#${s.id}`} style={{ color: "#d1d5db", textDecoration: "none", padding: "6px 0", fontSize: 13, transition: "color 0.2s" }}
                                onMouseEnter={(e) => e.currentTarget.style.color = s.color}
                                onMouseLeave={(e) => e.currentTarget.style.color = "#d1d5db"}
                            >
                                {i + 1}. {s.title}
                            </a>
                        ))}
                    </div>
                </div>

                {/* 各セクション */}
                <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                    {sections.map((s, i) => (
                        <section key={s.id} id={s.id} style={{ padding: 28, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}30`, scrollMarginTop: 20 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 800, color: s.color, marginBottom: 20, paddingBottom: 12, borderBottom: `2px solid ${s.color}20` }}>
                                {i + 1}. {s.title}
                            </h2>
                            <div style={{ color: "#d1d5db", fontSize: 14, lineHeight: 1.7 }}>
                                {s.content}
                            </div>
                        </section>
                    ))}
                </div>

                {/* フッター */}
                <div style={{ marginTop: 40, padding: 20, borderRadius: 12, background: "rgba(0,0,0,0.3)", textAlign: "center", fontSize: 12, color: "#6b7280", lineHeight: 1.8 }}>
                    📝 この仕様書は随時更新されます<br />
                    質問やフィードバックがあれば管理者までご連絡ください
                </div>
            </div>
        </main>
    );
}