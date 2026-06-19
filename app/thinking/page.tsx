"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

interface Question { id: string; content: string; type: string; created_at: string; }
interface Answer { id: string; question_id: string; user_id: string; content: string; created_at: string; name: string; ippon: number; }
type Tab = "thinking" | "oogiri";

const cList_uids = (list: any[]): string[] => list.map((c) => c.user_id);

export default function ThinkingPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState("");
    const [tab, setTab] = useState<Tab>("thinking");
    const [question, setQuestion] = useState<Question | null>(null);
    const [answers, setAnswers] = useState<Answer[]>([]);
    const [myVote, setMyVote] = useState<string | null>(null); // 自分がIPPONした answer_id（このお題内）
    const [comments, setComments] = useState<Record<string, { id: string; content: string; name: string; created_at: string }[]>>({});
    const [openComment, setOpenComment] = useState<string | null>(null);
    const [commentText, setCommentText] = useState("");
    const [myAnswer, setMyAnswer] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");

    const loadData = useCallback(async (t: Tab, uid: string) => {
        setLoading(true);
        const { data: qRows } = await supabase
            .from("thinking_questions").select("*")
            .eq("is_active", true).eq("type", t)
            .order("created_at", { ascending: true });
        const pool = (qRows || []) as Question[];
        // 今日(JST)の通算日数で、お題プールから1問を決定的に選ぶ（毎日自動で切り替わる）
        const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
        const dayNumber = Math.floor(jstNow.getTime() / 86400000); // 1970年からの日数(JST)
        const q = pool.length > 0 ? pool[dayNumber % pool.length] : undefined;
        setQuestion(q || null);
        setAnswers([]); setMyVote(null);
        if (q) {
            const { data: aRows } = await supabase
                .from("thinking_answers")
                .select("id, question_id, user_id, content, created_at")
                .eq("question_id", q.id)
                .order("created_at", { ascending: false }).limit(200);
            const rows = (aRows || []) as Omit<Answer, "name" | "ippon">[];
            const answerIds = rows.map(r => r.id);

            // 名前
            const ids = Array.from(new Set(rows.map(r => r.user_id)));
            const nameMap: Record<string, string> = {};
            if (ids.length > 0) {
                const { data: profs } = await supabase.from("profiles").select("id, name").in("id", ids);
                (profs || []).forEach((p: any) => { nameMap[p.id] = p.name || "名前未設定"; });
            }
            // IPPON集計
            const ipponCount: Record<string, number> = {};
            let mine: string | null = null;
            if (answerIds.length > 0) {
                const { data: votes } = await supabase
                    .from("thinking_ippon").select("answer_id, user_id").in("answer_id", answerIds);
                (votes || []).forEach((v: any) => {
                    ipponCount[v.answer_id] = (ipponCount[v.answer_id] || 0) + 1;
                    if (v.user_id === uid) mine = v.answer_id;
                });
            }
            setMyVote(mine);
            const withMeta = rows.map(r => ({ ...r, name: nameMap[r.user_id] || "名前未設定", ippon: ipponCount[r.id] || 0 }));
            withMeta.sort((a, b) => b.ippon - a.ippon || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setAnswers(withMeta);
            // コメント取得
            if (answerIds.length > 0) {
                const { data: cRows } = await supabase
                    .from("thinking_comments")
                    .select("id, target_id, user_id, content, created_at")
                    .eq("target_type", "thinking").in("target_id", answerIds)
                    .order("created_at", { ascending: true });
                const clist = (cRows || []) as any[];
                const cIds = Array.from(new Set(cList_uids(clist)));
                const cNameMap: Record<string, string> = {};
                if (cIds.length > 0) {
                    const { data: cp } = await supabase.from("profiles").select("id, name").in("id", cIds);
                    (cp || []).forEach((pf: any) => { cNameMap[pf.id] = pf.name || "名前未設定"; });
                }
                const byTarget: Record<string, any[]> = {};
                clist.forEach((c: any) => {
                    if (!byTarget[c.target_id]) byTarget[c.target_id] = [];
                    byTarget[c.target_id].push({ id: c.id, content: c.content, name: cNameMap[c.user_id] || "名前未設定", created_at: c.created_at });
                });
                setComments(byTarget);
            } else {
                setComments({});
            }
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            await loadData("thinking", user.id);
        })();
    }, [loadData, router]);

    const switchTab = (t: Tab) => { setTab(t); setMyAnswer(""); setMessage(""); loadData(t, userId); };

    const handleSubmit = async () => {
        if (!myAnswer.trim() || !question || submitting) return;
        setSubmitting(true);
        const { error } = await supabase.from("thinking_answers").insert({
            question_id: question.id, user_id: userId, content: myAnswer.trim(),
        });
        if (error) { setMessage("投稿に失敗しました"); setSubmitting(false); return; }

        // 投稿ポイント：このお題で初投稿のときだけ +5pt
        const reason = `thinking_post:${question.id}`;
        const { data: already } = await supabase
            .from("points_history").select("id")
            .eq("user_id", userId).eq("reason", reason).limit(1);
        let gainedPt = false;
        if (!already || already.length === 0) {
            const { data: pr } = await supabase.from("user_points").select("points").eq("id", userId).single();
            const cur = pr?.points || 0;
            await supabase.from("user_points").update({ points: cur + 5 }).eq("id", userId);
            await supabase.from("points_history").insert({ user_id: userId, change: 5, reason });
            gainedPt = true;
        }

        setMyAnswer("");
        setMessage((tab === "oogiri" ? "ナイスボケ！🎤" : "投稿しました！") + (gainedPt ? " +5pt獲得" : ""));
        await loadData(tab, userId);
        setSubmitting(false);
        setTimeout(() => setMessage(""), 2500);
    };

    // コメント投稿
    const submitComment = async (answerId: string) => {
        if (!commentText.trim()) return;
        await supabase.from("thinking_comments").insert({ target_type: "thinking", target_id: answerId, user_id: userId, content: commentText.trim() });
        setCommentText("");
        await loadData(tab, userId);
    };

    // IPPON（1人1票・お題内で付け替え。自分のボケには押せない）
    const handleVote = async (answerId: string, answerOwner: string) => {
        if (answerOwner === userId) return; // 自分のには投票不可
        if (myVote === answerId) {
            // 取り消し
            await supabase.from("thinking_ippon").delete().eq("answer_id", answerId).eq("user_id", userId);
        } else {
            // このお題で既に押してた票を消してから付け替え
            if (myVote) await supabase.from("thinking_ippon").delete().eq("answer_id", myVote).eq("user_id", userId);
            await supabase.from("thinking_ippon").insert({ answer_id: answerId, user_id: userId });
            // ボケ主へ +3pt（押されたら加点。取り消しでは減点しない）
            const { data: pr } = await supabase.from("user_points").select("points").eq("id", answerOwner).single();
            const cur = pr?.points || 0;
            await supabase.from("user_points").update({ points: cur + 3 }).eq("id", answerOwner);
            await supabase.from("points_history").insert({ user_id: answerOwner, change: 3, reason: "thinking_ippon_received" });
        }
        await loadData(tab, userId);
    };

    const isOogiri = tab === "oogiri";
    const bg = isOogiri ? "#0d0a04" : "#0a0a0f";
    const accent = isOogiri ? "#f5c542" : "#818cf8";
    const accentGrad = isOogiri ? "linear-gradient(135deg, #f5c542, #d4a017)" : "linear-gradient(135deg, #6366f1, #8b5cf6)";
    const voteLabel = isOogiri ? "IPPON" : "なるほど";
    const voteEmoji = isOogiri ? "🎤" : "💡";

    return (
        <div style={{ minHeight: "100vh", background: bg, padding: "32px 20px", transition: "background 0.3s" }}>
            <div style={{ maxWidth: 680, margin: "0 auto" }}>
                <div onClick={() => router.push("/menu")} style={{ fontSize: 12, color: accent, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", display: "inline-block" }}>INTERN QUEST</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 20px" }}>{isOogiri ? "🎤 大喜利グランプリ" : "🧠 思考クエスト"}</h1>

                <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                    {([["thinking", "🧠 思考クエスト"], ["oogiri", "🎤 大喜利"]] as [Tab, string][]).map(([t, label]) => (
                        <button key={t} onClick={() => switchTab(t)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, background: tab === t ? (t === "oogiri" ? "linear-gradient(135deg, #f5c542, #d4a017)" : "linear-gradient(135deg, #6366f1, #8b5cf6)") : "rgba(255,255,255,0.05)", color: tab === t ? (t === "oogiri" ? "#1a1206" : "#fff") : "#9ca3af" }}>{label}</button>
                    ))}
                </div>

                {loading ? (
                    <div style={{ color: "#9ca3af", textAlign: "center", padding: 40 }}>読み込み中...</div>
                ) : !question ? (
                    <div style={{ padding: 24, borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af" }}>今出題中のお題はありません。</div>
                ) : (
                    <>
                        {isOogiri ? (
                            <div style={{ borderRadius: 16, background: "#f2d025", marginBottom: 24, textAlign: "center", padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}>
                                <div style={{ fontSize: 30, fontWeight: 900, color: "#111", lineHeight: 1.45, letterSpacing: 1, fontFamily: "'Hiragino Sans', 'Yu Gothic', sans-serif" }}>{question.content}</div>
                            </div>
                        ) : (
                            <div style={{ padding: "24px", borderRadius: 16, background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))", border: "1px solid rgba(99,102,241,0.3)", marginBottom: 24 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", marginBottom: 8 }}>今日のお題</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: "#f9fafb", lineHeight: 1.6 }}>{question.content}</div>
                            </div>
                        )}

                        <div style={{ marginBottom: 28 }}>
                            <textarea value={myAnswer} onChange={(e) => setMyAnswer(e.target.value)} placeholder={isOogiri ? "ここでボケる！🎤" : "自分の考えを書いてみよう..."} rows={isOogiri ? 2 : 4} style={{ width: "100%", padding: "14px", borderRadius: 12, border: `1px solid ${isOogiri ? "rgba(245,197,66,0.4)" : "rgba(99,102,241,0.4)"}`, background: isOogiri ? "rgba(245,197,66,0.06)" : "rgba(99,102,241,0.08)", color: "#f9fafb", fontSize: 15, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.6 }} />
                            <button onClick={handleSubmit} disabled={submitting || !myAnswer.trim()} style={{ marginTop: 10, width: "100%", padding: "14px", borderRadius: 12, border: "none", background: submitting || !myAnswer.trim() ? "rgba(120,120,120,0.4)" : accentGrad, color: isOogiri ? "#1a1206" : "#fff", fontWeight: 800, cursor: submitting || !myAnswer.trim() ? "not-allowed" : "pointer", fontSize: 15 }}>
                                {submitting ? "送信中..." : isOogiri ? "ボケを投稿する🎤" : "考えを投稿する"}
                            </button>
                            {message && <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 10, background: isOogiri ? "rgba(245,197,66,0.12)" : "rgba(52,211,153,0.1)", border: `1px solid ${isOogiri ? "rgba(245,197,66,0.4)" : "rgba(52,211,153,0.3)"}`, color: isOogiri ? "#f5c542" : "#34d399", fontWeight: 700, fontSize: 14 }}>{message}</div>}
                        </div>

                        <div style={{ fontSize: 14, fontWeight: 700, color: "#9ca3af", marginBottom: 12 }}>{isOogiri ? `みんなのボケ（${answers.length}）` : `みんなの考え（${answers.length}）`}</div>
                        {answers.length === 0 ? (
                            <div style={{ padding: 20, color: "#6b7280", fontSize: 14, textAlign: "center" }}>{isOogiri ? "まだボケがありません。トップバッターになろう！🎤" : "まだ回答がありません。最初の一人になろう！"}</div>
                        ) : (
                            answers.map((a, idx) => {
                                const isMine = a.user_id === userId;
                                const voted = myVote === a.id;
                                const isTop = idx === 0 && a.ippon > 0;
                                return (
                                    <div key={a.id} style={{ padding: "16px 18px", borderRadius: 12, background: isOogiri ? "rgba(245,197,66,0.05)" : "rgba(255,255,255,0.03)", border: isTop ? `1.5px solid ${accent}` : `1px solid ${isOogiri ? "rgba(245,197,66,0.15)" : "rgba(255,255,255,0.06)"}`, marginBottom: 12 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{isTop ? "👑 " : ""}{a.name}</span>
                                            <span style={{ fontSize: 11, color: "#6b7280" }}>{new Date(a.created_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}</span>
                                        </div>
                                        <div style={{ fontSize: isOogiri ? 16 : 14, fontWeight: isOogiri ? 700 : 400, color: "#e5e7eb", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 12 }}>{a.content}</div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <button onClick={() => handleVote(a.id, a.user_id)} disabled={isMine} style={{ padding: "6px 14px", borderRadius: 20, border: voted ? "none" : `1px solid ${accent}`, cursor: isMine ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 800, background: voted ? accentGrad : "transparent", color: voted ? (isOogiri ? "#1a1206" : "#fff") : accent, opacity: isMine ? 0.35 : 1 }}>
                                                {voteEmoji} {voteLabel}
                                            </button>
                                            <span style={{ fontSize: 14, fontWeight: 800, color: a.ippon > 0 ? accent : "#6b7280" }}>{a.ippon}</span>
                                            {isMine && <span style={{ fontSize: 11, color: "#6b7280" }}>（自分の投稿）</span>}
                                            <button onClick={() => setOpenComment(openComment === a.id ? null : a.id)} style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#9ca3af", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>💬 {(comments[a.id]?.length || 0)}</button>
                                        </div>
                                        {openComment === a.id && (
                                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                                                {(comments[a.id] || []).map((c) => (
                                                    <div key={c.id} style={{ marginBottom: 8 }}>
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: accent, marginRight: 8 }}>{c.name}</span>
                                                        <span style={{ fontSize: 13, color: "#d1d5db" }}>{c.content}</span>
                                                    </div>
                                                ))}
                                                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                                    <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="コメントする..." style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.2)", color: "#f9fafb", fontSize: 13, outline: "none" }} />
                                                    <button onClick={() => submitComment(a.id)} disabled={!commentText.trim()} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: commentText.trim() ? accentGrad : "rgba(120,120,120,0.4)", color: isOogiri ? "#1a1206" : "#fff", fontWeight: 700, fontSize: 13, cursor: commentText.trim() ? "pointer" : "not-allowed" }}>送信</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </>
                )}

                <button onClick={() => router.push("/menu")} style={{ marginTop: 32, padding: "12px 32px", borderRadius: 10, background: accentGrad, color: isOogiri ? "#1a1206" : "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>メニューへ戻る</button>
            </div>
        </div>
    );
}
