"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type EsData = {
    gakuchika_what: string;
    gakuchika_goal: string;
    gakuchika_issue: string;
    gakuchika_improvement: string;
    gakuchika_result: string;
    axis_industry: string;
    axis_industry_why: string;
    axis_role: string;
    axis_role_why: string;
    axis_other: string;
    axis_other_why: string;
    goal_value: string;
    goal_role: string;
    goal_why: string;
    goal_skills: string;
    pr_strength: string;
    pr_experience: string;
    pr_reproducibility: string;
    failure_what: string;
    failure_overcome: string;
};

const INITIAL_ES: EsData = {
    gakuchika_what: "", gakuchika_goal: "", gakuchika_issue: "", gakuchika_improvement: "", gakuchika_result: "",
    axis_industry: "", axis_industry_why: "", axis_role: "", axis_role_why: "", axis_other: "", axis_other_why: "",
    goal_value: "", goal_role: "", goal_why: "", goal_skills: "",
    pr_strength: "", pr_experience: "", pr_reproducibility: "",
    failure_what: "", failure_overcome: ""
};

const REQUIRED_FIELDS: (keyof EsData)[] = Object.keys(INITIAL_ES) as (keyof EsData)[];

function isComplete(data: EsData): boolean {
    return REQUIRED_FIELDS.every(key => (data[key] || "").trim().length > 0);
}

function getYearMonth(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function EsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userId, setUserId] = useState("");
    const [name, setName] = useState("");
    const [es, setEs] = useState<EsData>(INITIAL_ES);
    const [firstCompletedAt, setFirstCompletedAt] = useState<string | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    const [activeSection, setActiveSection] = useState<1 | 2 | 3 | 4 | 5>(1);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);

            const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
            setName(profile?.name || "");

            const { data: esRow } = await supabase.from("user_es").select("*").eq("user_id", user.id).maybeSingle();
            if (esRow) {
                const row: any = esRow;
                setEs({
                    gakuchika_what: row.gakuchika_what || "",
                    gakuchika_goal: row.gakuchika_goal || "",
                    gakuchika_issue: row.gakuchika_issue || "",
                    gakuchika_improvement: row.gakuchika_improvement || "",
                    gakuchika_result: row.gakuchika_result || "",
                    axis_industry: row.axis_industry || "",
                    axis_industry_why: row.axis_industry_why || "",
                    axis_role: row.axis_role || "",
                    axis_role_why: row.axis_role_why || "",
                    axis_other: row.axis_other || "",
                    axis_other_why: row.axis_other_why || "",
                    goal_value: row.goal_value || "",
                    goal_role: row.goal_role || "",
                    goal_why: row.goal_why || "",
                    goal_skills: row.goal_skills || "",
                    pr_strength: row.pr_strength || "",
                    pr_experience: row.pr_experience || "",
                    pr_reproducibility: row.pr_reproducibility || "",
                    failure_what: row.failure_what || "",
                    failure_overcome: row.failure_overcome || "",
                });
                setFirstCompletedAt(row.first_completed_at);
                setLastUpdatedAt(row.last_updated_at);
            }
            setLoading(false);
        };
        load();
    }, [router]);

    const handleSave = async () => {
        setSaving(true);
        setMessage("");

        const nowIso = new Date().toISOString();
        const currentlyComplete = isComplete(es);
        let awardedPoints = 0;
        let pointReason = "";

        const { data: existing } = await supabase.from("user_es").select("*").eq("user_id", userId).maybeSingle();

        if (!existing) {
            // 新規作成
            const payload: any = { ...es, user_id: userId, last_updated_at: nowIso, total_updates: 1 };
            if (currentlyComplete) {
                payload.first_completed_at = nowIso;
                awardedPoints = 100;
                pointReason = "es_first_completed";
            }
            await supabase.from("user_es").insert(payload);
        } else {
            // 更新
            const wasComplete = !!existing.first_completed_at;
            const payload: any = { ...es, last_updated_at: nowIso, total_updates: (existing.total_updates || 0) + 1 };

            if (!wasComplete && currentlyComplete) {
                payload.first_completed_at = nowIso;
                awardedPoints = 100;
                pointReason = "es_first_completed";
            } else if (wasComplete) {
                // 月1アップデート判定
                const lastYm = existing.last_updated_at ? getYearMonth(new Date(existing.last_updated_at)) : "";
                const nowYm = getYearMonth(new Date());
                if (lastYm !== nowYm) {
                    awardedPoints = 20;
                    pointReason = "es_monthly_update";
                }
            }
            await supabase.from("user_es").update(payload).eq("user_id", userId);
        }

        // ポイント付与
        if (awardedPoints > 0) {
            const { data: pt } = await supabase.from("user_points").select("points").eq("id", userId).single();
            const newPoints = ((pt as any)?.points || 0) + awardedPoints;
            await supabase.from("user_points").upsert({ id: userId, points: newPoints });
            await supabase.from("points_history").insert({ user_id: userId, change: awardedPoints, reason: pointReason });
        }

        // 再取得
        const { data: updated } = await supabase.from("user_es").select("*").eq("user_id", userId).maybeSingle();
        if (updated) {
            setFirstCompletedAt((updated as any).first_completed_at);
            setLastUpdatedAt((updated as any).last_updated_at);
        }

        if (awardedPoints > 0) {
            setMessage(`✅ 保存しました！+${awardedPoints}pt 獲得`);
        } else {
            setMessage("✅ 保存しました");
        }
        setSaving(false);
    };

    if (loading) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
        </main>
    );

    const completed = isComplete(es);
    const filledCount = REQUIRED_FIELDS.filter(k => (es[k] || "").trim().length > 0).length;
    const progress = Math.round((filledCount / REQUIRED_FIELDS.length) * 100);

    const field = (key: keyof EsData, label: string, placeholder: string = "", rows: number = 3) => (
        <div style={{ marginBottom: 16 }}>
            <div style={{ color: "#d1d5db", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</div>
            <textarea value={es[key]} onChange={(e) => setEs(prev => ({ ...prev, [key]: e.target.value }))} placeholder={placeholder} rows={rows} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.6 }} />
        </div>
    );

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 80px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 800, margin: "0 auto" }}>
                <div onClick={() => router.push("/menu")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", marginBottom: 8 }}>INTERN QUEST</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div>
                        <h1 style={{ color: "#f9fafb", fontSize: 28, fontWeight: 800, margin: "0 0 4px" }}>📝 総合ES</h1>
                        <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>{name} さんのエントリーシート</p>
                    </div>
                    <button onClick={() => router.push("/menu")} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>メニューへ</button>
                </div>

                {/* 進捗表示 */}
                <div style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ color: "#818cf8", fontSize: 12, fontWeight: 700 }}>記入進捗</div>
                        <div style={{ color: "#f9fafb", fontSize: 14, fontWeight: 800 }}>{filledCount} / {REQUIRED_FIELDS.length}（{progress}%）</div>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                        <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg, #6366f1, #8b5cf6)", transition: "width 0.3s" }} />
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: "#9ca3af" }}>
                        {firstCompletedAt && <span>初回完成: {new Date(firstCompletedAt).toLocaleDateString("ja-JP")}</span>}
                        {lastUpdatedAt && <span>最終更新: {new Date(lastUpdatedAt).toLocaleString("ja-JP")}</span>}
                    </div>
                </div>

                {/* 報酬説明 */}
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", marginBottom: 24, fontSize: 12, color: "#fbbf24", lineHeight: 1.6 }}>
                    💎 初回完成で <strong>+100pt</strong>　�� 月1アップデートで <strong>+20pt</strong>
                </div>

                {/* セクション切替 */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
                    {[
                        { n: 1 as const, label: "① ガクチカ" },
                        { n: 2 as const, label: "② 就活の軸" },
                        { n: 3 as const, label: "③ 将来像" },
                        { n: 4 as const, label: "④ 自己PR" },
                        { n: 5 as const, label: "⑤ 失敗経験" },
                    ].map(t => (
                        <button key={t.n} onClick={() => setActiveSection(t.n)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer", fontSize: 12, background: activeSection === t.n ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: activeSection === t.n ? "#fff" : "#9ca3af" }}>{t.label}</button>
                    ))}
                </div>

                {/* セクション1: ガクチカ */}
                {activeSection === 1 && (
                    <div style={{ padding: "20px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ color: "#f9fafb", fontSize: 16, fontWeight: 800, marginBottom: 4 }}>① 学生時代に力を入れたこと（ガクチカ）</div>
                        <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>課題→改善→結果の流れで書きましょう</div>
                        {field("gakuchika_what", "何を頑張ったのか", "例）長期インターンでの訪問販売の営業", 2)}
                        {field("gakuchika_goal", "目標（数字で分かるもの）", "例）フォロワー数・契約数など", 2)}
                        {field("gakuchika_issue", "課題", "当初は数件程度。分析の結果、課題が〇〇と〇〇だった。")}
                        {field("gakuchika_improvement", "改善", "〇〇の改善のため、△△を行い、〇〇の改善のため、▽▽をした。")}
                        {field("gakuchika_result", "結果", "何がどう変わってどんな成果に繋がったか（数字で）")}
                    </div>
                )}

                {/* セクション2: 就活の軸 */}
                {activeSection === 2 && (
                    <div style={{ padding: "20px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ color: "#f9fafb", fontSize: 16, fontWeight: 800, marginBottom: 4 }}>② 就活の軸</div>
                        <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>なぜそう思うかまで掘り下げましょう</div>
                        {field("axis_industry", "どんな仕事（業界）に関わりたいか")}
                        {field("axis_industry_why", "↑ なぜか")}
                        {field("axis_role", "その仕事の中でどんな業務に就きたいか")}
                        {field("axis_role_why", "↑ なぜか")}
                        {field("axis_other", "上記2つを満たす企業で他に大事にしたいこと")}
                        {field("axis_other_why", "↑ なぜか")}
                    </div>
                )}

                {/* セクション3: 将来像 */}
                {activeSection === 3 && (
                    <div style={{ padding: "20px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ color: "#f9fafb", fontSize: 16, fontWeight: 800, marginBottom: 4 }}>③ 将来どうなりたいか</div>
                        <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>原体験と接続して書きましょう</div>
                        {field("goal_value", "どんな価値を出す人になりたいか")}
                        {field("goal_role", "どんな役割の人になりたいか")}
                        {field("goal_why", "なぜそうなりたいか（過去経験・成功体験・違和感）", "原体験と接続", 4)}
                        {field("goal_skills", "そのためにどんなスキル・経験が必要か", "スキル（営業力・分析力など）／経験（顧客対応・企画など）")}
                    </div>
                )}

                {/* セクション4: 自己PR */}
                {activeSection === 4 && (
                    <div style={{ padding: "20px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ color: "#f9fafb", fontSize: 16, fontWeight: 800, marginBottom: 4 }}>④ 自己PR</div>
                        <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>「あなたはどんな人？」の核心</div>
                        {field("pr_strength", "強み")}
                        {field("pr_experience", "それが発揮された経験")}
                        {field("pr_reproducibility", "再現性（仕事でも活きるか）")}
                    </div>
                )}

                {/* セクション5: 失敗経験 */}
                {activeSection === 5 && (
                    <div style={{ padding: "20px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ color: "#f9fafb", fontSize: 16, fontWeight: 800, marginBottom: 4 }}>⑤ 失敗経験・挫折経験</div>
                        <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 16 }}>再現性と耐性を見られます</div>
                        {field("failure_what", "何が失敗だったか", "", 4)}
                        {field("failure_overcome", "どう乗り越えたか", "", 4)}
                    </div>
                )}

                {message && <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399", fontSize: 13, fontWeight: 700, textAlign: "center" }}>{message}</div>}

                <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                    {activeSection > 1 && (
                        <button onClick={() => setActiveSection((activeSection - 1) as any)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#d1d5db", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>← 前へ</button>
                    )}
                    <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: saving ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "保存中..." : "保存する"}</button>
                    {activeSection < 5 && (
                        <button onClick={() => setActiveSection((activeSection + 1) as any)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#d1d5db", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>次へ →</button>
                    )}
                </div>

                <div style={{ marginTop: 32, textAlign: "center" }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "10px 28px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>メニューへ戻る</button>
                </div>
            </div>
        </main>
    );
}
