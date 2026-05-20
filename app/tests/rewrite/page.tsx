"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

// 各テストの記述問題マスター
const WRITTEN_QUESTIONS_MAP: Record<string, { title: string; questions: string[] }> = {
    common_sense: { title: "🧠 常識・デリカシー", questions: ["Q16. 最近自分が\"基準低かったな\"と感じた行動を書いてください", "Q17. \"社会人として恥ずかしい行動\"とは何か書いてください", "Q18. 「これくらいいいや」と妥協した経験を書いてください", "Q19. デリカシーがない人の特徴を書いてください", "Q20. 自分の常識基準を上げるために必要なことを書いてください", "Q21. 今後、自分が改善したい行動を3つ書いてください"] },
    social_standard: { title: "🎯 社会人基準・現実認識", questions: ["Q16. 学生気分が抜けていないと思う部分を書いてください", "Q17. \"社会人として求められる基準\"を書いてください", "Q18. 「自分はできてる」と思っていた部分を書いてください", "Q19. 社会人基準が高い人の特徴を書いてください", "Q20. 今の自分に足りないと思う部分を書いてください", "Q21. 今後、自分が上げていきたい基準を書いてください"] },
    long_term_thinking: { title: "📈 長期思考・複利思考", questions: ["Q16. 短期快楽を選んでしまった経験を書いてください", "Q17. 長期視点が弱い人の特徴を書いてください", "Q18. 自分が複利で積み上げたい習慣を書いてください", "Q19. 5年後の自分を想像して書いてください", "Q20. 今すぐやるべき長期投資を書いてください", "Q21. 今後絶対に続けたい行動を3つ書いてください"] },
    profit_thinking: { title: "💰 利益思考・判断センス", questions: ["Q16. 感情で判断してしまった経験を書いてください", "Q17. 利益思考が弱い人の特徴を書いてください", "Q18. 自分が利益で動くために必要なことを書いてください", "Q19. 「これは利益にならない」と判断した経験を書いてください", "Q20. 利益と感情のバランスについて書いてください", "Q21. 今後、利益視点で見直したい部分を書いてください"] },
    essence_thinking: { title: "🔍 本質思考・タスク整理", questions: ["Q16. 今の自分が無駄にやっていることを書いてください", "Q17. やらなくていい仕事の特徴を書いてください", "Q18. 自分が忙しいだけになっている部分を書いてください", "Q19. 今の自分の成果に最も直結する行動を3つ書いてください", "Q20. 余計なことを減らすメリットを説明してください", "Q21. 今後やらないことを3つ決めてください"] },
    standard_keeping: { title: "⚖️ 基準維持・妥協耐性", questions: ["Q16. 妥協しそうになった経験を書いてください", "Q17. \"基準を下げる人\"の特徴を書いてください", "Q18. 自分が妥協しやすい場面を書いてください", "Q19. 基準を維持するために必要なことを書いてください", "Q20. \"基準が高い人\"の特徴を書いてください", "Q21. 今後絶対に妥協したくない基準を3つ書いてください"] },
    market_value: { title: "💪 市場価値認識", questions: ["Q16. 「選ばれる人」と「選ばれない人」の差を書いてください", "Q17. 自分が市場価値を上げるために必要なことを書いてください", "Q18. 今の自分の弱みを書いてください", "Q19. 市場で求められる人材像を書いてください", "Q20. 今後身につけたいスキルを3つ書いてください", "Q21. 自分の差別化ポイントを書いてください"] },
    teiou: { title: "👑 Dot.A 帝王学", questions: ["Q16. リーダーとして必要な覚悟を書いてください", "Q17. \"思想がある人\"の特徴を書いてください", "Q18. 自分が判断で迷う場面を書いてください", "Q19. 影響力を持つために必要なことを書いてください", "Q20. 自分が真似したい経営者・リーダーを書いてください", "Q21. 今後、自分が背負いたい責任を書いてください"] },
    standard_raising: { title: "🚀 基準上昇・人生現実", questions: ["Q16. 今の自分が\"基準低い\"と思う部分を書いてください", "Q17. 親世代と同じ生活をするために必要だと思うことを書いてください", "Q18. 5年後に差がつくと思う日常習慣を書いてください", "Q19. 「基準が高い人」の特徴を書いてください", "Q20. 今の自分が\"楽に流されている部分\"を書いてください", "Q21. 今後、自分が上げていきたい基準を3つ書いてください"] },
    management_collab: { title: "🤝 マネジメント・協働価値", questions: ["Q16. 「マネジメント力」とは何か、自分の言葉で説明してください", "Q17. 最近、他人との連携不足で起きた問題を書いてください", "Q18. \"協働が弱い人\"の特徴を書いてください", "Q19. 今の自分が\"自分視点\"になっている部分を書いてください", "Q20. 「周囲を動かせる人」の特徴を書いてください", "Q21. 今後、自分が強化すべき\"協働力\"を書いてください"] },
    cert_market_value: { title: "💎 資格依存・市場価値現実", questions: ["Q16. 「資格」と「市場価値」の違いを書いてください", "Q17. 今の時代に価値が高い人材の特徴を書いてください", "Q18. 自分が\"勉強した気\"になっている部分を書いてください", "Q19. 実務経験が重要な理由を書いてください", "Q20. 今後AI時代で価値が上がる能力を書いてください", "Q21. 今後、自分が積むべき\"経験\"を書いてください"] },
    improvement_force: { title: "🔧 改善力・逃避防止", questions: ["Q16. 最近受けた指摘と、その後どう改善したかを書いてください", "Q17. 「改善できない人」の特徴を書いてください", "Q18. \"宣言だけで終わった経験\"を書いてください", "Q19. 今後繰り返したくないミスと、その対策を書いてください", "Q20. 「改善力が高い人」の特徴を書いてください", "Q21. 今の自分が\"口だけになっている部分\"を書いてください"] },
    apology_escape: { title: "🪞 謝罪逃避・責任転嫁防止", questions: ["Q16. 最近\"謝って終わった\"と思う経験を書いてください", "Q17. 「謝罪だけで終わる人」の特徴を書いてください", "Q18. 同じミスを防ぐために必要なことを書いてください", "Q19. 最近受けた指摘と、その改善策を書いてください", "Q20. 「信頼される人」の特徴を書いてください", "Q21. 今の自分が\"言葉だけになっている部分\"を書いてください"] },
    logical_thinking: { title: "🧮 論理思考・感情逃避防止", questions: ["Q16. 最近、自分が\"感情で話してしまった\"経験を書いてください", "Q17. 「論理が弱い人」の特徴を書いてください", "Q18. 「自分はこう思う」を論理的に説明するには何が必要か書いてください", "Q19. 最近納得できなかったことを、\"感情\"ではなく\"構造\"で説明してください", "Q20. 論理的に話せる人の特徴を書いてください", "Q21. 今の自分が\"勢いでごまかしている部分\"を書いてください"] },
    progress_update: { title: "📡 進捗更新・ケアレスミス改善", questions: ["Q16. 最近\"進捗共有不足\"で困った経験を書いてください", "Q17. 「報連相が弱い人」の特徴を書いてください", "Q18. 最近したケアレスミスと、その原因を書いてください", "Q19. ケアレスミスを減らすための仕組みを3つ書いてください", "Q20. 「信頼される進捗更新」とは何か説明してください", "Q21. 今の自分が\"雑になっている部分\"を書いてください"] },
    life_improvement: { title: "⏰ 生活改善・時間価値", questions: ["Q16. 最近、自分が無駄にした時間を書いてください", "Q17. 「堕落しやすい人」の特徴を書いてください", "Q18. 今の自分が改善すべき生活習慣を書いてください", "Q19. 5年後に差がつくと思う日常習慣を3つ書いてください", "Q20. 時間を無駄にしないための工夫を書いてください", "Q21. 今後\"絶対に積み上げたい習慣\"を書いてください"] },
    market_eval: { title: "📊 市場価値・評価認識", questions: ["Q16. 「市場価値」とは何か、自分の言葉で説明してください", "Q17. 今の自分が\"自己評価基準\"になっている部分を書いてください", "Q18. 「評価される人」の特徴を書いてください", "Q19. 自分が今後、社会で価値を上げるために必要なことを書いてください", "Q20. 「頑張った」と「価値提供」の違いを書いてください", "Q21. 今の自分が\"相場感覚不足\"だと思う部分を書いてください"] },
    quick_response: { title: "⚡ 即レス・反応速度", questions: ["Q16. 最近\"返信遅れ\"で困った経験を書いてください", "Q17. 「返信が早い人」の特徴を書いてください", "Q18. 自分が返信を後回しにする原因を書いてください", "Q19. 即レスを習慣化する方法を書いてください", "Q20. \"返信速度\"が信頼に影響する理由を書いてください", "Q21. 今後、自分が改善したい\"レスポンス習慣\"を書いてください"] },
    self_protection: { title: "🛡️ 保身・自己防衛過剰改善", questions: ["Q16. 最近、自分が\"保身に走った\"と思う経験を書いてください", "Q17. 「保身が強い人」の特徴を書いてください", "Q18. 自分が言い訳しやすい場面を書いてください", "Q19. \"責任感が強い人\"の特徴を書いてください", "Q20. 保身を減らすために必要なことを書いてください", "Q21. 今の自分が\"逃げている部分\"を書いてください"] },
};

function RewriteContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const testKey = searchParams.get("test_key") || "";
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string>("");
    const [lastAttempt, setLastAttempt] = useState<any>(null);
    const [writtenAnswers, setWrittenAnswers] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const testConfig = WRITTEN_QUESTIONS_MAP[testKey];

    useEffect(() => {
        (async () => {
            if (!testConfig) { setLoading(false); return; }
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);

            // 最新の test_attempt を取得
            const { data: attempt } = await supabase
                .from("test_attempts")
                .select("*")
                .eq("user_id", user.id)
                .eq("test_key", testKey)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (attempt) {
                setLastAttempt(attempt);
                // 過去の記述を初期値にセット
                const rawWritten = (attempt as any).written_answers;
                if (rawWritten) {
                    if (Array.isArray(rawWritten)) {
                        setWrittenAnswers(rawWritten.map((x: any) => typeof x === "string" ? x : (x.answer || "")));
                    } else if (typeof rawWritten === "object") {
                        setWrittenAnswers(testConfig.questions.map(q => rawWritten[q] || ""));
                    }
                }
            }
            if (writtenAnswers.length === 0) {
                setWrittenAnswers(new Array(testConfig.questions.length).fill(""));
            }
            setLoading(false);
        })();
    }, [router, testKey, testConfig]);

    const handleSubmit = async () => {
        if (!testConfig) return;
        if (writtenAnswers.some(w => !w.trim() || w.trim().length < 10)) {
            alert("全ての記述問題に10文字以上で回答してください");
            return;
        }
        if (!confirm("記述を再提出しますか？\n\nadminが新たに評価します。\n高評価+30pt / 中評価+10pt の可能性があります。")) return;
        setSubmitting(true);

        const writtenObj: Record<string, string> = {};
        testConfig.questions.forEach((q, i) => { writtenObj[q] = writtenAnswers[i]; });

        // 新規レコード: 選択式は満点だったので passed=true, score=15
        await supabase.from("test_attempts").insert({
            user_id: userId,
            test_key: testKey,
            score: lastAttempt?.score || 15,
            passed: true,
            written_answers: writtenObj,
        });

        alert("✅ 記述を再提出しました！\n\nadminの再評価をお待ちください。");
        router.push("/notifications");
    };

    if (loading) return <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Loading...</main>;

    if (!testConfig) return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}>
            <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", padding: 60 }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>❓</div>
                <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>テストが見つかりません</h1>
                <button onClick={() => router.push("/tests")} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>テスト一覧に戻る</button>
            </div>
        </main>
    );

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", color: "#f9fafb" }}>
            <div style={{ maxWidth: 720, margin: "0 auto" }}>
                <button onClick={() => router.push("/notifications")} style={{ background: "transparent", border: "1px solid #374151", color: "#9ca3af", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, marginBottom: 16 }}>← 通知に戻る</button>

                <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>{testConfig.title}</h1>
                <div style={{ fontSize: 14, color: "#a5b4fc", marginBottom: 24 }}>📝 記述だけ再提出</div>

                <div style={{ padding: 16, background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: 12, marginBottom: 32, fontSize: 13, color: "#fde68a", lineHeight: 1.6 }}>
                    🪞 admin評価で「評価なし」となりました。<br />
                    記述を見直して再提出してください。<br />
                    高評価で +30pt / 中評価で +10pt の可能性があります。
                </div>

                {testConfig.questions.map((q, i) => (
                    <div key={i} style={{ marginBottom: 20, padding: 20, background: "#111827", borderRadius: 12, border: "1px solid #1f2937" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{q}</div>
                        <textarea
                            value={writtenAnswers[i] || ""}
                            onChange={e => {
                                const w = [...writtenAnswers];
                                w[i] = e.target.value;
                                setWrittenAnswers(w);
                            }}
                            placeholder="10文字以上で記入..."
                            style={{ width: "100%", minHeight: 100, padding: 10, borderRadius: 8, border: "1px solid #374151", background: "#0f172a", color: "#f9fafb", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
                        />
                    </div>
                ))}

                <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: 16, marginTop: 24, borderRadius: 12, border: "none", background: submitting ? "#374151" : "linear-gradient(135deg, #f59e0b, #ef4444)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer" }}>{submitting ? "提出中..." : "📤 記述を再提出する"}</button>
            </div>
        </main>
    );
}

export default function RewritePage() {
    return (
        <Suspense fallback={<main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Loading...</main>}>
            <RewriteContent />
        </Suspense>
    );
}
