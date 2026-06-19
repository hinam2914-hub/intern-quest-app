"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

const TEMPLATE_CATEGORIES: { label: string; items: string[] }[] = [
    { label: "💼 仕事・営業", items: [
        "アポが取れないとき、どう気持ちを切り替えてますか？",
        "トークが噛んでしまいます。練習以外に効く方法はありますか？",
        "断られ続けるとへこみます。みなさんはどう乗り越えてましたか？",
    ]},
    { label: "📈 成長・キャリア", items: [
        "今の自分に一番足りないものって、客観的にどう見えてますか？",
        "成果を出してる先輩は、1年目の頃どんな動きをしてましたか？",
        "このまま続けて、半年後どうなっていたら理想ですか？",
    ]},
    { label: "🧠 考え方・マインド", items: [
        "モチベが続かないとき、どうやって立て直してますか？",
        "失敗したとき、引きずらないコツはありますか？",
        "自信がないまま動くのが怖いです。どうしたらいいですか？",
    ]},
    { label: "🤝 人間関係・チーム", items: [
        "メンバーともっと仲良くなるには、何から始めるといいですか？",
        "年上の人とどう接したらいいか迷います。",
        "相談したいけど忙しそうで声をかけづらいです。どうしたら？",
    ]},
    { label: "🌱 なんでも・雑談", items: [
        "最近モヤモヤしてることがあって聞いてほしいです。",
        "みなさんの息抜きの方法を教えてください。",
        "働くうえで大事にしてる価値観ってありますか？",
    ]},
];

interface Q {
    id: string; user_id: string; content: string;
    admin_answer: string | null; answered_at: string | null;
    created_at: string; name: string; sympathy: number;
}

export default function QuestionsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState("");
    const [questions, setQuestions] = useState<Q[]>([]);
    const [mySympathy, setMySympathy] = useState<Set<string>>(new Set());
    const [content, setContent] = useState("");
    const [tplCat, setTplCat] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");

    const loadData = useCallback(async (uid: string) => {
        setLoading(true);
        const { data: qRows } = await supabase
            .from("questions_box").select("*")
            .eq("status", "approved")
            .order("created_at", { ascending: false }).limit(200);
        const rows = (qRows || []) as any[];
        const ids = Array.from(new Set(rows.map(r => r.user_id)));
        const nameMap: Record<string, string> = {};
        if (ids.length > 0) {
            const { data: profs } = await supabase.from("profiles").select("id, name").in("id", ids);
            (profs || []).forEach((p: any) => { nameMap[p.id] = p.name || "名前未設定"; });
        }
        const qIds = rows.map(r => r.id);
        const symCount: Record<string, number> = {};
        const mine = new Set<string>();
        if (qIds.length > 0) {
            const { data: syms } = await supabase.from("questions_box_sympathy").select("question_id, user_id").in("question_id", qIds);
            (syms || []).forEach((sv: any) => {
                symCount[sv.question_id] = (symCount[sv.question_id] || 0) + 1;
                if (sv.user_id === uid) mine.add(sv.question_id);
            });
        }
        setMySympathy(mine);
        const withMeta: Q[] = rows.map(r => ({ ...r, name: nameMap[r.user_id] || "名前未設定", sympathy: symCount[r.id] || 0 }));
        withMeta.sort((a, b) => {
            const au = a.admin_answer ? 1 : 0, bu = b.admin_answer ? 1 : 0;
            if (au !== bu) return au - bu;
            return b.sympathy - a.sympathy || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setQuestions(withMeta);
        setLoading(false);
    }, []);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            await loadData(user.id);
        })();
    }, [loadData, router]);

    const handleSubmit = async () => {
        if (!content.trim() || submitting) return;
        setSubmitting(true);
        const { error } = await supabase.from("questions_box").insert({ user_id: userId, content: content.trim() });
        if (error) { setMessage("投稿に失敗しました"); setSubmitting(false); return; }
        setContent("");
        setMessage("質問を送信しました！承認されると公開されます。");
        await loadData(userId);
        setSubmitting(false);
        setTimeout(() => setMessage(""), 2500);
    };

    const toggleSympathy = async (qid: string) => {
        if (mySympathy.has(qid)) {
            await supabase.from("questions_box_sympathy").delete().eq("question_id", qid).eq("user_id", userId);
        } else {
            await supabase.from("questions_box_sympathy").insert({ question_id: qid, user_id: userId });
        }
        await loadData(userId);
    };

    return (
        <div style={{ minHeight: "100vh", background: "#0a0a0f", padding: "32px 20px" }}>
            <div style={{ maxWidth: 680, margin: "0 auto" }}>
                <div onClick={() => router.push("/menu")} style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 8px" }}>❓ 質問クエスト</h1>
                <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 24px" }}>上司に質問・相談ができます。回答はみんなに公開されます。</p>

                <div style={{ marginBottom: 16, padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", marginBottom: 10 }}>💡 何を聞こうか迷ったら、タップして使ってね</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                        {TEMPLATE_CATEGORIES.map((c, i) => (
                            <button key={i} onClick={() => setTplCat(i)} style={{ padding: "6px 12px", borderRadius: 16, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: tplCat === i ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: tplCat === i ? "#fff" : "#9ca3af" }}>{c.label}</button>
                        ))}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {TEMPLATE_CATEGORIES[tplCat].items.map((ex, i) => (
                            <button key={i} onClick={() => setContent(ex)} style={{ textAlign: "left", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.05)", color: "#d1d5db", fontSize: 13, cursor: "pointer", lineHeight: 1.5 }}>{ex}</button>
                        ))}
                    </div>
                </div>
                <div style={{ marginBottom: 32 }}>
                    <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="気になっていること・相談したいことを書いてみよう..." rows={3} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.08)", color: "#f9fafb", fontSize: 15, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.6 }} />
                    <button onClick={handleSubmit} disabled={submitting || !content.trim()} style={{ marginTop: 10, width: "100%", padding: "14px", borderRadius: 12, border: "none", background: submitting || !content.trim() ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 800, cursor: submitting || !content.trim() ? "not-allowed" : "pointer", fontSize: 15 }}>
                        {submitting ? "送信中..." : "質問を投稿する"}
                    </button>
                    {message && <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 10, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399", fontWeight: 700, fontSize: 14 }}>{message}</div>}
                </div>

                {loading ? (
                    <div style={{ color: "#9ca3af", textAlign: "center", padding: 40 }}>読み込み中...</div>
                ) : questions.length === 0 ? (
                    <div style={{ padding: 20, color: "#6b7280", fontSize: 14, textAlign: "center" }}>まだ質問がありません。最初の一人になろう！</div>
                ) : (
                    questions.map((q) => (
                        <div key={q.id} style={{ padding: "18px 20px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#818cf8" }}>{q.name}</span>
                                <span style={{ fontSize: 11, color: "#6b7280" }}>{new Date(q.created_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}</span>
                            </div>
                            <div style={{ fontSize: 15, color: "#f3f4f6", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 14 }}>{q.content}</div>

                            {q.admin_answer ? (
                                <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", marginBottom: 12 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#34d399", marginBottom: 6 }}>💬 回答</div>
                                    <div style={{ fontSize: 14, color: "#e5e7eb", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{q.admin_answer}</div>
                                </div>
                            ) : (
                                <div style={{ fontSize: 12, color: "#fbbf24", marginBottom: 12 }}>⏳ 回答待ち</div>
                            )}

                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <button onClick={() => toggleSympathy(q.id)} style={{ padding: "6px 14px", borderRadius: 20, border: mySympathy.has(q.id) ? "none" : "1px solid #6366f1", cursor: "pointer", fontSize: 13, fontWeight: 700, background: mySympathy.has(q.id) ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "transparent", color: mySympathy.has(q.id) ? "#fff" : "#818cf8" }}>
                                    🙋 同じ質問ある！
                                </button>
                                <span style={{ fontSize: 14, fontWeight: 800, color: q.sympathy > 0 ? "#818cf8" : "#6b7280" }}>{q.sympathy}</span>
                            </div>
                        </div>
                    ))
                )}

                <button onClick={() => router.push("/menu")} style={{ marginTop: 32, padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>メニューへ戻る</button>
            </div>
        </div>
    );
}
