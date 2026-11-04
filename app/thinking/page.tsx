"use client";
// Intern Quest 2.0｜思考の試練（THINKING GUILD）。HOME と同じ明るい世界観（青空・大理石・ロイヤルブルー×金）。
// 6種類の思考力を曜日替わりで鍛える。日曜は大喜利グランプリ（既存機能をそのまま維持）。
// ポイントは従来ルールのまま：1問につき初回投稿のみ +5pt（points_history の reason で重複防止）、
// 「なるほど／IPPON」を受けた人に +3pt。新しい付与量は追加していない。
// 出題は thinking_schedule（日付→問題の固定記録）を最優先。テーブル未作成の環境でも従来の
// last_shown_date 方式にフォールバックして動く。設定は app/lib/thinking2.ts に集約。
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { THINK_CATS, DAY_TO_CAT, catOf, growthOf, serializeAnswer, type CatDef } from "@/app/lib/thinking2";

interface Question { id: string; content: string; type: string; created_at: string; category?: string | null; hint?: string | null; last_shown_date?: string | null; is_active?: boolean; }
interface Answer { id: string; question_id: string; user_id: string; content: string; created_at: string; name: string; ippon: number; }
type Tab = "thinking" | "oogiri";

function getTodayJST(): string {
    const jst = new Date(Date.now() + 9 * 3600 * 1000);
    return jst.toISOString().slice(0, 10);
}
function toJSTDateOnly(value: string): string {
    return new Date(new Date(value).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

const CSS = `
.tk-page{min-height:100vh;overflow-x:clip;background:url(/thinking/bg_mobile.webp) center top / cover no-repeat fixed, url(/home/bg_mobile.webp) center top / cover no-repeat fixed, #bfe3f5;display:flex;flex-direction:column;align-items:center;padding:14px 14px 80px;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#1f2a44}
.tk-col{width:100%;max-width:520px;display:flex;flex-direction:column}
@media (min-width:700px){ .tk-page{background-image:url(/thinking/bg_pc.webp), url(/home/bg_pc.webp)} .tk-col{max-width:680px} }
.tk-back{align-self:flex-start;border:2px solid #e8c45a;background:rgba(255,253,245,.92);color:#17397d;font-weight:900;font-size:13px;border-radius:999px;padding:8px 16px;cursor:pointer;font-family:inherit;box-shadow:0 3px 8px rgba(40,60,120,.15)}
.tk-title{position:relative;width:min(88%,480px);margin:10px auto 0;container-type:inline-size}
.tk-title img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 14px rgba(20,40,90,.3))}
.tk-title>div{position:absolute;inset:14% 8% 8%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;pointer-events:none}
.tk-title .t1{font-size:clamp(16px,6.2cqw,26px);font-weight:900;letter-spacing:.1em;text-shadow:0 2px 4px rgba(10,25,70,.55)}
.tk-title .t2{font-size:clamp(8px,2.3cqw,11px);font-weight:800;letter-spacing:.34em;color:#cfe0ff;margin-top:1%}
.tk-tabs{display:flex;gap:8px;margin-top:14px}
.tk-tab{flex:1;border:2px solid #e2bf63;background:rgba(255,253,245,.9);color:#8a6a3a;font-weight:900;font-size:13.5px;border-radius:999px;padding:11px 6px;cursor:pointer;font-family:inherit}
.tk-tab.on{background:linear-gradient(180deg,#4d9af5,#2458c7);border-color:#1d4fae;color:#fff;box-shadow:0 4px 12px rgba(30,70,170,.35)}
.tk-tab.on.gold{background:linear-gradient(180deg,#ffd76a,#f0a92d);border-color:#c98a00;color:#5a3a06;box-shadow:0 4px 12px rgba(170,110,20,.35)}
.tk-panel{position:relative;margin-top:14px;padding:14px;background:linear-gradient(180deg,#fffdf4,#f8efdb);border:3px solid #d8b55e;border-radius:18px;box-shadow:0 0 0 3px rgba(255,255,255,.4),0 8px 20px rgba(40,60,120,.15)}
.tk-head{display:flex;align-items:center;gap:10px;white-space:nowrap;min-width:0;overflow:hidden;background:linear-gradient(180deg,#3b70d4,#1d3f96);border:2px solid #e2bf63;border-radius:12px;padding:6px 12px;color:#fff;font-weight:900;font-size:13.5px;box-shadow:inset 0 2px 0 rgba(255,255,255,.25)}
.tk-head small{font-weight:800;font-size:10px;color:#cfe0ff;margin-left:auto;text-align:right}
.tk-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:10px}
@media (min-width:480px){ .tk-stats{grid-template-columns:repeat(3,1fr)} }
.tk-stat{position:relative;background:rgba(255,255,251,.9);border:2px solid rgba(190,160,110,.4);border-radius:14px;padding:9px 8px;text-align:center;cursor:pointer;font-family:inherit}
.tk-stat.today{border-color:#2f6fd6;box-shadow:0 0 0 2px rgba(47,111,214,.25)}
.tk-stat.open{background:#fff;border-color:#e0a62e}
.tk-stat .tdy{position:absolute;top:-9px;left:50%;transform:translateX(-50%);white-space:nowrap;background:linear-gradient(180deg,#4d9af5,#2458c7);color:#fff;font-size:9px;font-weight:900;border-radius:999px;padding:1px 8px;border:1px solid #e2bf63}
.tk-stat .em{font-size:26px;line-height:1.2}
.tk-stat .nm{font-size:12px;font-weight:900;color:#17397d;margin-top:2px}
.tk-stat .ct{font-size:11px;font-weight:800;color:#8a93a6;margin-top:2px}
.tk-badge{display:inline-block;margin-top:4px;border-radius:999px;padding:2px 10px;font-size:10.5px;font-weight:900;color:#fff}
.tk-q{background:rgba(255,255,251,.92);border:2px solid rgba(190,160,110,.45);border-radius:14px;padding:14px;margin-top:10px}
.tk-q .cat{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:900}
.tk-q .body{font-size:16.5px;font-weight:900;color:#1f2a44;line-height:1.75;margin-top:8px}
.tk-steps{display:flex;gap:6px;justify-content:center;margin-top:12px}
.tk-dot{width:10px;height:10px;border-radius:50%;background:#ddd2b8;border:1.5px solid #c9b88e}
.tk-dot.on{background:linear-gradient(180deg,#4d9af5,#2458c7);border-color:#1d4fae}
.tk-dot.done{background:#8ee04a;border-color:#4aad22}
.tk-lbl{font-size:13px;font-weight:900;color:#7a5a1a;margin-top:12px}
.tk-ta{width:100%;box-sizing:border-box;min-height:110px;margin-top:8px;border:2px solid #e2bf63;border-radius:14px;background:#fffdf6;padding:12px 14px;font-size:14.5px;font-weight:700;color:#1f2a44;line-height:1.7;outline:none;resize:vertical;font-family:inherit}
.tk-nav{display:flex;gap:10px;margin-top:12px}
.tk-btn{flex:1;border-radius:999px;padding:13px;font-weight:900;font-size:14.5px;cursor:pointer;font-family:inherit}
.tk-btn.gold{border:2px solid #e8c45a;background:linear-gradient(180deg,#ffd76a,#f0a92d);color:#5a3a06;box-shadow:0 4px 12px rgba(170,110,20,.3),inset 0 2px 0 rgba(255,255,255,.6)}
.tk-btn.plain{border:2px solid #c9cfdb;background:#fff;color:#5a6b85}
.tk-btn:disabled{opacity:.5;cursor:default}
.tk-hint{display:flex;align-items:flex-start;gap:10px;margin-top:12px}
.tk-hint img{width:56px;flex:none;filter:drop-shadow(0 4px 8px rgba(30,40,90,.3))}
.tk-hint .bub{flex:1;background:url(/home/luku_bubble.webp);background-size:100% 100%;padding:12px 14px 18px 16px;font-weight:800;font-size:13px;color:#4a3519;line-height:1.7}
.tk-lock{margin-top:12px;background:#fff8e6;border:2px dashed #e2bf63;border-radius:14px;padding:14px;text-align:center;font-size:12.5px;font-weight:800;color:#8a6a3a;line-height:1.7}
.tk-row{background:rgba(255,255,251,.92);border:2px solid rgba(190,160,110,.4);border-radius:14px;padding:11px 13px;margin-top:10px}
.tk-row .meta{display:flex;justify-content:space-between;gap:8px;font-size:12px;font-weight:900;color:#17397d}
.tk-row .meta small{color:#8a93a6;font-weight:700}
.tk-row .body{font-size:13.5px;font-weight:700;color:#3a3a4a;line-height:1.75;white-space:pre-wrap;word-break:break-word;margin-top:6px}
.tk-vote{border:2px solid #e2bf63;background:#fffdf6;color:#8a6207;font-weight:900;font-size:12px;border-radius:999px;padding:6px 14px;cursor:pointer;font-family:inherit}
.tk-vote.on{background:linear-gradient(180deg,#ffd76a,#f0a92d);border-color:#c98a00;color:#5a3a06}
.tk-vote:disabled{opacity:.4;cursor:default}
.tk-cbtn{border:2px solid #c9cfdb;background:#fff;color:#5a6b85;font-weight:900;font-size:11.5px;border-radius:999px;padding:6px 12px;cursor:pointer;font-family:inherit;margin-left:auto}
.tk-cin{flex:1;border:2px solid #e2bf63;border-radius:999px;background:#fffdf6;padding:8px 14px;font-size:13px;font-weight:700;color:#1f2a44;outline:none;font-family:inherit;min-width:0}
.tk-msg{margin-top:10px;padding:10px 14px;border-radius:12px;background:#e9f7ec;border:2px solid #9fd7ae;color:#2e7d4f;font-weight:900;font-size:13px;text-align:center}
.tk-past{width:100%;text-align:left;border:none;background:transparent;padding:12px 4px;cursor:pointer;font-family:inherit;display:flex;justify-content:space-between;gap:10px;align-items:center;border-bottom:1px solid rgba(190,160,110,.25);font-size:13px;font-weight:800;color:#3a4256}
.tk-grow{display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid rgba(190,160,110,.25)}
.tk-grow .em{font-size:20px;width:28px;text-align:center}
.tk-grow .nm{flex:1;font-size:13px;font-weight:900;color:#17397d}
.tk-grow .ct{font-size:11.5px;font-weight:800;color:#8a93a6;white-space:nowrap}
`;

export default function ThinkingPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState("");
    const [tab, setTab] = useState<Tab>("thinking");
    const [question, setQuestion] = useState<Question | null>(null);
    const [answers, setAnswers] = useState<Answer[]>([]);
    const [myAnswered, setMyAnswered] = useState(false);
    const [myVote, setMyVote] = useState<string | null>(null);
    const [comments, setComments] = useState<Record<string, { id: string; content: string; name: string; created_at: string }[]>>({});
    const [openComment, setOpenComment] = useState<string | null>(null);
    const [commentText, setCommentText] = useState("");
    const [pastQuestions, setPastQuestions] = useState<Question[]>([]);
    const [openPast, setOpenPast] = useState<string | null>(null);
    const [pastAnswers, setPastAnswers] = useState<Record<string, { id: string; content: string; name: string }[]>>({});
    const [stepIdx, setStepIdx] = useState(0);
    const [vals, setVals] = useState<Record<string, string>>({});
    const [oogiriText, setOogiriText] = useState("");
    const [showHint, setShowHint] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [stats, setStats] = useState<Record<string, { total: number; last30: number }>>({});
    const [streakDays, setStreakDays] = useState(0);
    const [myHistory, setMyHistory] = useState<{ id: string; date: string; quest: string; content: string; catKey: string }[]>([]);
    const [openCat, setOpenCat] = useState<string | null>(null);   // カテゴリ一覧で開いている詳細
    const [openHistory, setOpenHistory] = useState<string | null>(null);

    const todayStr = getTodayJST();
    const todayCat = DAY_TO_CAT[new Date(Date.now() + 9 * 3600 * 1000).getUTCDay()];
    const cat: CatDef | null = tab === "thinking" ? (question ? catOf(question.category) : null) : null;

    /** 今日の問題に対する回答・リアクション・コメントを読み込む */
    const loadAnswers = useCallback(async (q: Question, uid: string) => {
        const { data: aRows } = await supabase.from("thinking_answers")
            .select("id, question_id, user_id, content, created_at")
            .eq("question_id", q.id).order("created_at", { ascending: false }).limit(200);
        const rows = (aRows || []) as Omit<Answer, "name" | "ippon">[];
        const answerIds = rows.map(r => r.id);
        const ids = Array.from(new Set(rows.map(r => r.user_id)));
        const nameMap: Record<string, string> = {};
        if (ids.length > 0) {
            const { data: profs } = await supabase.from("profiles").select("id, name").in("id", ids);
            (profs || []).forEach((p: any) => { nameMap[p.id] = p.name || "名前未設定"; });
        }
        const ipponCount: Record<string, number> = {};
        let mine: string | null = null;
        if (answerIds.length > 0) {
            const { data: votes } = await supabase.from("thinking_ippon").select("answer_id, user_id").in("answer_id", answerIds);
            (votes || []).forEach((v: any) => {
                ipponCount[v.answer_id] = (ipponCount[v.answer_id] || 0) + 1;
                if (v.user_id === uid) mine = v.answer_id;
            });
        }
        setMyVote(mine);
        const withMeta = rows.map(r => ({ ...r, name: nameMap[r.user_id] || "名前未設定", ippon: ipponCount[r.id] || 0 }));
        withMeta.sort((a, b) => b.ippon - a.ippon || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setAnswers(withMeta);
        setMyAnswered(withMeta.some(r => r.user_id === uid));
        if (answerIds.length > 0) {
            const { data: cRows } = await supabase.from("thinking_comments")
                .select("id, target_id, user_id, content, created_at")
                .eq("target_type", "thinking").in("target_id", answerIds)
                .order("created_at", { ascending: true });
            const clist = (cRows || []) as any[];
            const cIds = Array.from(new Set(clist.map((c) => c.user_id)));
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
        } else setComments({});
    }, []);

    /** 思考の試練：今日の問題（thinking_schedule で日付固定。無ければ従来方式にフォールバック） */
    const loadThinking = useCallback(async (uid: string) => {
        setLoading(true); setShowHint(false); setStepIdx(0); setVals({});
        const { data: allRows } = await supabase.from("thinking_questions").select("*").eq("type", "thinking").order("created_at", { ascending: true });
        const all = (allRows || []) as Question[];
        const pool = all.filter(q => q.is_active);
        let q: Question | null = null;
        let schedOk = true;
        try {
            const r = await supabase.from("thinking_schedule").select("question_id").eq("date", todayStr).maybeSingle();
            if (r.error) throw r.error;
            if (r.data) q = all.find(x => x.id === (r.data as any).question_id) || null;
        } catch { schedOk = false; }
        if (!q && todayCat !== "oogiri" && pool.length > 0) {
            // 今日の種別 → 無ければ未分類 → それも無ければ全体から、最も長く出していない問題を選ぶ
            const byCat = pool.filter(p => p.category === todayCat);
            const byNull = pool.filter(p => !p.category);
            const cand = byCat.length ? byCat : (byNull.length ? byNull : pool);
            const sorted = [...cand].sort((a, b) => {
                const da = a.last_shown_date || "", db = b.last_shown_date || "";
                if (da === db) return a.created_at < b.created_at ? -1 : 1;
                return da < db ? -1 : 1;
            });
            q = sorted.find(x => x.last_shown_date === todayStr) || sorted[0];
            if (schedOk && q) {
                await supabase.from("thinking_schedule").insert({ date: todayStr, question_id: q.id } as any).then(() => {});
                const again = await supabase.from("thinking_schedule").select("question_id").eq("date", todayStr).maybeSingle();
                if (again.data) q = all.find(x => x.id === (again.data as any).question_id) || q;   // 同時アクセス時は先勝ち
            }
            if (q && q.last_shown_date !== todayStr) {
                await supabase.from("thinking_questions").update({ last_shown_date: todayStr }).eq("id", q.id);
                q.last_shown_date = todayStr;
            }
        }
        setQuestion(q);
        setAnswers([]); setMyAnswered(false); setMyVote(null);
        if (q) await loadAnswers(q, uid);
        // 過去のお題（出題済み・今日以外）
        const past = all.filter(pq => pq.last_shown_date && (!q || pq.id !== q.id))
            .sort((a, b) => (b.last_shown_date || "").localeCompare(a.last_shown_date || ""));
        setPastQuestions(past); setOpenPast(null); setPastAnswers({});
        // 成長記録（自分の挑戦実績：種別ごとの回数・直近30日・継続日数・過去回答）
        const { data: mineRows } = await supabase.from("thinking_answers").select("id, question_id, content, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(1000);
        const mine = (mineRows || []) as any[];
        const qmap = new Map(all.map(x => [x.id, x]));
        const st: Record<string, { total: number; last30: number }> = {};
        THINK_CATS.forEach(c => { st[c.key] = { total: 0, last30: 0 }; });
        const cutoff = Date.now() - 30 * 86400000;
        const hist: { id: string; date: string; quest: string; content: string; catKey: string }[] = [];
        const dateSet = new Set<string>();
        mine.forEach(a => {
            const qq = qmap.get(a.question_id);
            if (!qq) return;                                   // 大喜利などは対象外
            const c = catOf(qq.category);
            st[c.key].total += 1;
            if (new Date(a.created_at).getTime() >= cutoff) st[c.key].last30 += 1;
            dateSet.add(toJSTDateOnly(a.created_at));
            if (hist.length < 40) hist.push({ id: a.id, date: toJSTDateOnly(a.created_at), quest: `${c.quest}（${c.skill}）`, content: a.content, catKey: c.key });
        });
        // 継続日数（今日または昨日から連続した挑戦日数）
        let streak = 0;
        const d = new Date(`${todayStr}T00:00:00+09:00`);
        if (!dateSet.has(todayStr)) d.setDate(d.getDate() - 1);
        for (; ;) {
            const ymd = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
            if (dateSet.has(ymd)) { streak++; d.setDate(d.getDate() - 1); } else break;
        }
        setStats(st); setStreakDays(streak); setMyHistory(hist);
        setLoading(false);
    }, [loadAnswers, todayStr, todayCat]);

    /** 大喜利：従来の出題ロジックのまま */
    const loadOogiri = useCallback(async (uid: string) => {
        setLoading(true);
        const { data: qRows } = await supabase.from("thinking_questions").select("*").eq("is_active", true).eq("type", "oogiri").order("created_at", { ascending: true });
        const pool = (qRows || []) as Question[];
        let q = pool.find(pq => pq.last_shown_date === todayStr);
        if (!q && pool.length > 0) {
            const sorted = [...pool].sort((a, b) => {
                const da = a.last_shown_date || "", db = b.last_shown_date || "";
                if (da === db) return a.created_at < b.created_at ? -1 : 1;
                return da < db ? -1 : 1;
            });
            q = sorted[0];
            await supabase.from("thinking_questions").update({ last_shown_date: todayStr }).eq("id", q.id);
            q.last_shown_date = todayStr;
        }
        setQuestion(q || null);
        setAnswers([]); setMyAnswered(false); setMyVote(null);
        if (q) await loadAnswers(q, uid);
        const past = pool.filter(pq => pq.last_shown_date && (!q || pq.id !== q.id))
            .sort((a, b) => (b.last_shown_date || "").localeCompare(a.last_shown_date || ""));
        setPastQuestions(past); setOpenPast(null); setPastAnswers({});
        setLoading(false);
    }, [loadAnswers, todayStr]);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const first: Tab = todayCat === "oogiri" ? "oogiri" : "thinking";
            setTab(first);
            if (first === "thinking") await loadThinking(user.id); else await loadOogiri(user.id);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const switchTab = (t: Tab) => {
        setTab(t); setMessage(""); setOogiriText("");
        if (t === "thinking") loadThinking(userId); else loadOogiri(userId);
    };

    /** 投稿（従来の +5pt／重複防止ロジックをそのまま使用） */
    const grantFirstPostPt = async (qid: string): Promise<boolean> => {
        const reason = `thinking_post:${qid}`;
        const { data: already } = await supabase.from("points_history").select("id").eq("user_id", userId).eq("reason", reason).limit(1);
        if (already && already.length > 0) return false;
        const { data: pr } = await supabase.from("user_points").select("points").eq("id", userId).single();
        await supabase.from("user_points").update({ points: (pr?.points || 0) + 5 }).eq("id", userId);
        await supabase.from("points_history").insert({ user_id: userId, change: 5, reason });
        return true;
    };

    const handleSubmit = async () => {
        if (!question || submitting) return;
        const body = tab === "oogiri" ? oogiriText.trim() : serializeAnswer(cat!, vals);
        if (!body || (cat && cat.steps.some(s => !(vals[s.key] || "").trim() && tab === "thinking"))) return;
        setSubmitting(true);
        const { error } = await supabase.from("thinking_answers").insert({ question_id: question.id, user_id: userId, content: body });
        if (error) { setMessage("投稿に失敗しました"); setSubmitting(false); return; }
        const gained = await grantFirstPostPt(question.id);
        setOogiriText(""); setVals({}); setStepIdx(0);
        setMessage((tab === "oogiri" ? "ナイスボケ！🎤" : "試練クリア！みんなの考えが見られるようになったよ") + (gained ? " +5pt獲得！" : ""));
        if (tab === "thinking") await loadThinking(userId); else await loadOogiri(userId);
        setSubmitting(false);
        setTimeout(() => setMessage(""), 3500);
    };

    const submitComment = async (answerId: string) => {
        if (!commentText.trim()) return;
        await supabase.from("thinking_comments").insert({ target_type: "thinking", target_id: answerId, user_id: userId, content: commentText.trim() });
        setCommentText("");
        if (question) await loadAnswers(question, userId);
    };

    /** なるほど／IPPON（従来ロジックのまま：1人1票・付け替え、受けた人に+3pt） */
    const handleVote = async (answerId: string, answerOwner: string) => {
        if (answerOwner === userId) return;
        if (myVote === answerId) {
            await supabase.from("thinking_ippon").delete().eq("answer_id", answerId).eq("user_id", userId);
        } else {
            if (myVote) await supabase.from("thinking_ippon").delete().eq("answer_id", myVote).eq("user_id", userId);
            await supabase.from("thinking_ippon").insert({ answer_id: answerId, user_id: userId });
            const { data: pr } = await supabase.from("user_points").select("points").eq("id", answerOwner).single();
            await supabase.from("user_points").update({ points: (pr?.points || 0) + 3 }).eq("id", answerOwner);
            await supabase.from("points_history").insert({ user_id: answerOwner, change: 3, reason: "thinking_ippon_received" });
        }
        if (question) await loadAnswers(question, userId);
    };

    const togglePast = async (qid: string) => {
        if (openPast === qid) { setOpenPast(null); return; }
        setOpenPast(qid);
        if (!pastAnswers[qid]) {
            const { data: aRows } = await supabase.from("thinking_answers").select("id, user_id, content").eq("question_id", qid).order("created_at", { ascending: false }).limit(100);
            const rows = (aRows || []) as any[];
            const ids = Array.from(new Set(rows.map(r => r.user_id)));
            const nameMap: Record<string, string> = {};
            if (ids.length > 0) {
                const { data: profs } = await supabase.from("profiles").select("id, name").in("id", ids);
                (profs || []).forEach((pf: any) => { nameMap[pf.id] = pf.name || "名前未設定"; });
            }
            setPastAnswers(prev => ({ ...prev, [qid]: rows.map(r => ({ id: r.id, content: r.content, name: nameMap[r.user_id] || "名前未設定" })) }));
        }
    };

    const isOogiri = tab === "oogiri";
    const voteLabel = isOogiri ? "IPPON" : "なるほど！";
    const voteEmoji = isOogiri ? "🎤" : "💡";
    const hintText = question?.hint || cat?.defaultHint || "";
    const step = cat ? cat.steps[stepIdx] : null;
    const stepOk = step ? !!(vals[step.key] || "").trim() : false;
    const allOk = cat ? cat.steps.every(s => !!(vals[s.key] || "").trim()) : false;
    const myRow = answers.find(a => a.user_id === userId);

    return (
        <div className="tk-page">
            <style>{CSS}</style>
            <div className="tk-col">
                <button className="tk-back" onClick={() => router.push("/home")}>← HOMEへ</button>
                <div className="tk-title">
                    <img src="/home/title_plate.webp" alt="" width={1200} height={374} />
                    <div><span className="t1">思考の試練</span><span className="t2">THINKING GUILD</span></div>
                </div>

                <div className="tk-tabs">
                    <button className={"tk-tab" + (tab === "thinking" ? " on" : "")} onClick={() => switchTab("thinking")}>🧠 思考の試練</button>
                    <button className={"tk-tab" + (tab === "oogiri" ? " on gold" : "")} onClick={() => switchTab("oogiri")}>🎤 大喜利グランプリ{todayCat === "oogiri" ? "（本日！）" : ""}</button>
                </div>

                {/* 思考力ステータス（挑戦実績にもとづく習熟段階。点数評価ではない） */}
                {tab === "thinking" && (
                    <div className="tk-panel">
                        <div className="tk-head">📜 思考力ステータス<small>{streakDays > 0 ? `🔥 ${streakDays}日連続` : "挑戦で段階UP"}</small></div>
                        <div className="tk-stats">
                            {THINK_CATS.map(c => {
                                const st = stats[c.key] || { total: 0, last30: 0 };
                                const g = growthOf(st.total);
                                const isToday = todayCat === c.key;
                                const open = openCat === c.key;
                                return (
                                    <button key={c.key} type="button" className={"tk-stat" + (isToday ? " today" : "") + (open ? " open" : "")} onClick={() => setOpenCat(open ? null : c.key)}>
                                        {isToday && <div className="tdy">本日の試練</div>}
                                        <div className="em">{c.emoji}</div>
                                        <div className="nm">{c.quest}</div>
                                        <div className="ct">{c.skill}｜挑戦 {st.total} 回</div>
                                        <span className="tk-badge" style={{ background: g.color }}>{g.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {openCat && (() => {
                            const c = THINK_CATS.find(x => x.key === openCat)!;
                            const st = stats[c.key] || { total: 0, last30: 0 };
                            const g = growthOf(st.total);
                            const myCatHist = myHistory.filter(h => h.catKey === c.key);
                            return (
                                <div className="tk-q" style={{ borderColor: c.color }}>
                                    <div className="cat" style={{ color: c.color }}><span style={{ fontSize: 18 }}>{c.emoji}</span>{c.quest}｜鍛える力：{c.skill}</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "#3a4256", lineHeight: 1.75, marginTop: 6 }}>{c.desc}</div>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8a6a3a", marginTop: 8 }}>
                                        段階：<span className="tk-badge" style={{ background: g.color, marginTop: 0 }}>{g.name}</span>　累計 {st.total} 回・直近30日 {st.last30} 回
                                        {todayCat === c.key ? "　⚔️ 今日はこの試練の日！" : ""}
                                    </div>
                                    {myCatHist.length > 0 ? (
                                        <div style={{ marginTop: 8 }}>
                                            <div style={{ fontSize: 12, fontWeight: 900, color: "#7a5a1a" }}>自分の挑戦記録</div>
                                            {myCatHist.slice(0, 5).map(h => (
                                                <div key={h.id}>
                                                    <button className="tk-past" onClick={() => setOpenHistory(openHistory === h.id ? null : h.id)}>
                                                        <span>{h.date.replaceAll("-", ".")}</span><span style={{ color: "#b09a6a" }}>{openHistory === h.id ? "−" : "+"}</span>
                                                    </button>
                                                    {openHistory === h.id && <div style={{ padding: "8px 4px 10px", fontSize: 13, fontWeight: 700, color: "#3a3a4a", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{h.content}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 12, fontWeight: 800, color: "#8a93a6", marginTop: 8 }}>まだ挑戦記録がありません。{todayCat === c.key ? "今日の試練に挑もう！" : "この試練の曜日に挑戦しよう！"}</div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {loading ? (
                    <div className="tk-panel" style={{ textAlign: "center", fontWeight: 800, color: "#5a6b85" }}>読み込み中...</div>
                ) : !question ? (
                    <div className="tk-panel" style={{ textAlign: "center", fontWeight: 800, color: "#5a6b85", lineHeight: 1.8 }}>
                        {tab === "thinking" && todayCat === "oogiri" ? "今日は日曜日！思考の試練はおやすみ。🎤 大喜利グランプリに挑戦しよう！" : "今出題中のお題はありません。"}
                    </div>
                ) : (
                    <>
                        {/* 今日の試練 */}
                        <div className="tk-panel">
                            <div className="tk-head" style={isOogiri ? { background: "linear-gradient(180deg,#e0a62e,#b07a08)" } : undefined}>
                                {isOogiri ? "🎤 本日の大喜利" : "⚔️ 今日の試練"}<small>{todayStr.replaceAll("-", ".")}</small>
                            </div>
                            <div className="tk-q">
                                {!isOogiri && cat && (
                                    <div className="cat" style={{ color: cat.color }}>
                                        <span style={{ fontSize: 18 }}>{cat.emoji}</span>{cat.quest}｜鍛える力：{cat.skill}
                                    </div>
                                )}
                                <div className="body">{question.content}</div>
                            </div>

                            {/* 回答フォーム（STEP式）／大喜利は一発回答 */}
                            {!myAnswered && (isOogiri ? (
                                <>
                                    <textarea className="tk-ta" value={oogiriText} onChange={e => setOogiriText(e.target.value)} placeholder="ここでボケる！🎤" style={{ minHeight: 80 }} />
                                    <button className="tk-btn gold" style={{ width: "100%", marginTop: 10 }} onClick={handleSubmit} disabled={submitting || !oogiriText.trim()}>{submitting ? "送信中..." : "🎤 ボケを投稿する"}</button>
                                </>
                            ) : cat && (
                                <>
                                    {cat.steps.length > 1 && (
                                        <div className="tk-steps">
                                            {cat.steps.map((s, i) => <div key={s.key} className={"tk-dot" + (i === stepIdx ? " on" : (vals[s.key] || "").trim() ? " done" : "")} />)}
                                        </div>
                                    )}
                                    {step && (
                                        <>
                                            <div className="tk-lbl">{cat.steps.length > 1 ? `STEP ${stepIdx + 1} / ${cat.steps.length}｜` : ""}{step.label}</div>
                                            {cat.key === "decision" && step.key === "choice" && (
                                                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                                    {["Aを選ぶ", "Bを選ぶ"].map(t => (
                                                        <button key={t} className="tk-btn plain" style={{ padding: 9, fontSize: 13, borderColor: vals[step.key] === t ? "#2f6fd6" : undefined, color: vals[step.key] === t ? "#17397d" : undefined }} onClick={() => setVals(v => ({ ...v, [step.key]: t }))}>{t}</button>
                                                    ))}
                                                </div>
                                            )}
                                            <textarea className="tk-ta" value={vals[step.key] || ""} onChange={e => setVals(v => ({ ...v, [step.key]: e.target.value }))} placeholder={step.ph} />
                                        </>
                                    )}
                                    <div className="tk-nav">
                                        {stepIdx > 0 && <button className="tk-btn plain" onClick={() => setStepIdx(i => i - 1)}>← 戻る</button>}
                                        {stepIdx < cat.steps.length - 1
                                            ? <button className="tk-btn gold" onClick={() => setStepIdx(i => i + 1)} disabled={!stepOk}>次のSTEPへ →</button>
                                            : <button className="tk-btn gold" onClick={handleSubmit} disabled={submitting || !allOk}>{submitting ? "送信中..." : "⚔️ 試練に挑む（投稿）"}</button>}
                                    </div>
                                    {/* ルクのヒント */}
                                    {hintText && (
                                        <>
                                            <button className="tk-btn plain" style={{ width: "100%", marginTop: 12, fontSize: 13 }} onClick={() => setShowHint(h => !h)}>{showHint ? "ヒントを閉じる" : "🦊 ルクのヒントを見る"}</button>
                                            {showHint && (
                                                <div className="tk-hint">
                                                    <img src="/onboarding/luku.png" alt="ルク" />
                                                    <div className="bub">{hintText}</div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            ))}
                            {myAnswered && myRow && (
                                <div className="tk-row" style={{ borderColor: "#9fd7ae", background: "#f4faf4" }}>
                                    <div className="meta"><span>✅ あなたの回答（提出済み）</span><small>{toJSTDateOnly(myRow.created_at).replaceAll("-", ".")}</small></div>
                                    <div className="body">{myRow.content}</div>
                                </div>
                            )}
                            {message && <div className="tk-msg">{message}</div>}
                        </div>

                        {/* みんなの考え（思考の試練は、自分が投稿するまで本文は見えない） */}
                        <div className="tk-panel">
                            <div className="tk-head">{isOogiri ? `🎤 みんなのボケ（${answers.length}）` : `💬 みんなの考え（${answers.length}）`}</div>
                            {!isOogiri && !myAnswered ? (
                                <div className="tk-lock">🔒 まずは自分の考えを投稿しよう！<br />投稿すると みんなの考え（{answers.length}件）が読めるようになるよ</div>
                            ) : answers.length === 0 ? (
                                <div style={{ padding: 14, textAlign: "center", fontSize: 13, fontWeight: 800, color: "#8a93a6" }}>{isOogiri ? "まだボケがありません。トップバッターになろう！🎤" : "まだ回答がありません。最初の一人になろう！"}</div>
                            ) : (
                                answers.map((a, idx) => {
                                    const isMine = a.user_id === userId;
                                    const voted = myVote === a.id;
                                    const isTop = idx === 0 && a.ippon > 0;
                                    return (
                                        <div key={a.id} className="tk-row" style={isTop ? { borderColor: "#e0a62e" } : undefined}>
                                            <div className="meta"><span>{isTop ? "👑 " : ""}{a.name}{isMine ? "（自分）" : ""}</span><small>{new Date(a.created_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}</small></div>
                                            <div className="body">{a.content}</div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                                                <button className={"tk-vote" + (voted ? " on" : "")} onClick={() => handleVote(a.id, a.user_id)} disabled={isMine}>{voteEmoji} {voteLabel}</button>
                                                <span style={{ fontSize: 13, fontWeight: 900, color: a.ippon > 0 ? "#b07a08" : "#8a93a6" }}>{a.ippon}</span>
                                                <button className="tk-cbtn" onClick={() => setOpenComment(openComment === a.id ? null : a.id)}>💬 {(comments[a.id]?.length || 0)}</button>
                                            </div>
                                            {openComment === a.id && (
                                                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(190,160,110,.3)" }}>
                                                    {(comments[a.id] || []).map(c => (
                                                        <div key={c.id} style={{ marginBottom: 6, fontSize: 13 }}><b style={{ color: "#17397d", marginRight: 6 }}>{c.name}</b><span style={{ color: "#3a3a4a", fontWeight: 700 }}>{c.content}</span></div>
                                                    ))}
                                                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                                                        <input className="tk-cin" value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="コメントする..." />
                                                        <button className="tk-btn gold" style={{ flex: "none", padding: "8px 16px", fontSize: 12.5 }} onClick={() => submitComment(a.id)} disabled={!commentText.trim()}>送信</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </>
                )}

                {/* 過去の冒険記録（自分の回答履歴） */}
                {tab === "thinking" && !loading && myHistory.length > 0 && (
                    <div className="tk-panel">
                        <div className="tk-head">📖 過去の冒険記録<small>自分の考え方の変化を見返そう</small></div>
                        {myHistory.map(h => (
                            <div key={h.id}>
                                <button className="tk-past" onClick={() => setOpenHistory(openHistory === h.id ? null : h.id)}>
                                    <span>{h.date.replaceAll("-", ".")}　{h.quest}</span><span style={{ color: "#b09a6a" }}>{openHistory === h.id ? "−" : "+"}</span>
                                </button>
                                {openHistory === h.id && <div style={{ padding: "8px 4px 12px", fontSize: 13, fontWeight: 700, color: "#3a3a4a", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{h.content}</div>}
                            </div>
                        ))}
                    </div>
                )}

                {/* 過去のお題 */}
                {!loading && pastQuestions.length > 0 && (
                    <div className="tk-panel">
                        <div className="tk-head">📜 過去のお題（{pastQuestions.length}）</div>
                        {pastQuestions.map(pq => (
                            <div key={pq.id}>
                                <button className="tk-past" onClick={() => togglePast(pq.id)}>
                                    <span>{!isOogiri && <b style={{ color: catOf(pq.category).color, marginRight: 6 }}>{catOf(pq.category).emoji}</b>}{pq.content}</span>
                                    <span style={{ color: "#b09a6a", flexShrink: 0 }}>{openPast === pq.id ? "−" : "+"}</span>
                                </button>
                                {openPast === pq.id && (
                                    <div style={{ padding: "4px 4px 10px" }}>
                                        {(pastAnswers[pq.id] || []).length === 0 ? (
                                            <div style={{ fontSize: 12.5, fontWeight: 800, color: "#8a93a6", padding: "6px 0" }}>回答はありませんでした。</div>
                                        ) : (pastAnswers[pq.id] || []).map(a => (
                                            <div key={a.id} style={{ padding: "8px 0", borderTop: "1px solid rgba(190,160,110,.2)", fontSize: 13 }}>
                                                <b style={{ color: "#17397d", marginRight: 8 }}>{a.name}</b>
                                                <span style={{ color: "#3a3a4a", fontWeight: 700, whiteSpace: "pre-wrap" }}>{a.content}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
