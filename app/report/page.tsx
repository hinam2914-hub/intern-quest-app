"use client";
// Intern Quest 2.0｜冒険の記録（日報）。HOME と同じ世界観（青空・浮島・大理石・ロイヤルブルー×金）。
// 提出処理・ポイント（+2pt／連続ボーナス）・streak・KPI保存・実験・ガチャ・サンキュー誘導は従来ロジックのまま。
// 成長ランクは従来からある「今日のQuest達成率」ルール（90%↑S / 80%↑A / 60%↑B / 40%↑C / 未満D）をそのまま盾に表示。
// 記入欄は「成果・課題・学び・明日の一手」の4項目（保存は submissions.content への連結のままで DB 変更なし）。
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { computeReportStreak } from "../lib/date";
import TodayScheduleReview, { TodayScheduleReviewHandle } from "../components/TodayScheduleReview";
import { generateDotKunFeedback, DotKunFeedback } from "../lib/dotkunFeedback";

type KpiItem = { id: string; title: string; unit: string; target_value: number };

function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function toJSTDateOnly(value: string): string {
    const date = new Date(value);
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

/** KPI項目名 → アイコン素材（該当なしは星） */
function kpiIcon(title: string): string {
    const t = title.toUpperCase();
    if (t.includes("コール") || t.includes("架電") || t.includes("電話")) return "/report/icon_call.webp";
    if (t.includes("ピンポン") || t.includes("インターホン") || t.includes("訪問")) return "/report/icon_pingpong.webp";
    if (t.includes("DM")) return "/report/icon_dm.webp";
    return "/report/icon_star.webp";
}

const CSS = `
.rp-page{min-height:100vh;overflow-x:clip;background:url(/home/bg_mobile.webp) center top / cover no-repeat fixed, #bfe3f5;display:flex;flex-direction:column;align-items:center;padding:14px 14px 80px;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#1f2a44}
.rp-col{width:100%;max-width:520px;display:flex;flex-direction:column}
@media (min-width:700px){ .rp-page{background-image:url(/home/bg_pc.webp)} .rp-col{max-width:680px} }
.rp-back{align-self:flex-start;border:2px solid #e8c45a;background:rgba(255,253,245,.92);color:#17397d;font-weight:900;font-size:13px;border-radius:999px;padding:8px 16px;cursor:pointer;font-family:inherit;box-shadow:0 3px 8px rgba(40,60,120,.15)}
.rp-title{position:relative;width:min(96%,560px);margin:10px auto 0;container-type:inline-size}
.rp-title img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 14px rgba(20,40,90,.3))}
.rp-title>div{position:absolute;inset:16% 12% 14% 26%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;pointer-events:none}
.rp-title .t1{font-size:clamp(17px,6.4cqw,28px);font-weight:900;letter-spacing:.12em;text-shadow:0 2px 4px rgba(10,25,70,.55)}
.rp-title .t2{font-size:clamp(8px,2.4cqw,12px);font-weight:800;letter-spacing:.3em;color:#cfe0ff;margin-top:1%}
.rp-date{align-self:center;display:flex;align-items:center;gap:8px;margin-top:10px;background:linear-gradient(180deg,#fffdf4,#f6ead0);border:2px solid #d8b55e;border-radius:999px;padding:7px 22px;font-weight:900;color:#17397d;font-size:14px;box-shadow:0 3px 8px rgba(140,100,30,.18)}
.rp-hero{display:flex;gap:10px;margin-top:14px;align-items:stretch}
.rp-shield{flex:none;width:37%;max-width:200px;position:relative;container-type:inline-size}
.rp-shield img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 14px rgba(20,40,90,.3))}
.rp-shield .lb{position:absolute;top:-2%;left:50%;transform:translateX(-50%);white-space:nowrap;background:linear-gradient(180deg,#3b70d4,#1d3f96);border:1.5px solid #e2bf63;border-radius:999px;color:#fff;font-weight:900;font-size:clamp(9px,5.4cqw,12px);padding:2px 10px;box-shadow:0 2px 6px rgba(20,40,90,.35)}
.rp-shield .rk{position:absolute;left:0;right:0;top:20%;height:48%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:clamp(34px,36cqw,74px);color:#ffe9a8;text-shadow:0 2px 0 rgba(120,80,0,.4),0 0 24px rgba(255,220,120,.8)}
.rp-stats{flex:1;min-width:0;background:linear-gradient(180deg,#fffdf4,#f8efdb);border:3px solid #d8b55e;border-radius:18px;box-shadow:0 0 0 3px rgba(255,255,255,.4),0 8px 20px rgba(40,60,120,.15);display:flex;flex-direction:column;justify-content:space-around;padding:10px 12px;gap:6px}
.rp-stat{display:flex;align-items:center;gap:10px}
.rp-stat img{height:30px;width:auto;flex:none}
.rp-stat .k{flex:1;font-size:11.5px;font-weight:900;color:#8a6a3a;line-height:1.3;min-width:0}.rp-stat .k small{font-size:9px;font-weight:800}
.rp-stat .v{font-size:17px;font-weight:900;color:#17397d;white-space:nowrap}
.rp-stat .v small{font-size:11px;color:#8a93a6;font-weight:800}
.rp-panel{position:relative;margin-top:14px;padding:14px;background:linear-gradient(180deg,#fffdf4,#f8efdb);border:3px solid #d8b55e;border-radius:18px;box-shadow:0 0 0 3px rgba(255,255,255,.4),0 8px 20px rgba(40,60,120,.15)}
.rp-head{display:flex;align-items:center;gap:10px;background:linear-gradient(180deg,#3b70d4,#1d3f96);border:2px solid #e2bf63;border-radius:12px;padding:6px 12px;color:#fff;font-weight:900;font-size:13.5px;box-shadow:inset 0 2px 0 rgba(255,255,255,.25)}
.rp-head img{height:26px;width:auto}
.rp-head small{font-weight:800;font-size:10px;color:#cfe0ff;margin-left:auto;text-align:right;line-height:1.3}
.rp-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
.rp-kpi{background:rgba(255,255,251,.9);border:2px solid rgba(190,160,110,.4);border-radius:14px;padding:9px 8px;text-align:center}
.rp-kpi img{height:32px;width:auto}
.rp-kpi .t{font-size:11px;font-weight:900;color:#5a6b85;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rp-kpi input{width:56px;padding:4px 4px;border-radius:8px;border:2px solid #e2bf63;background:#fffdf6;color:#17397d;font-size:16px;font-weight:900;outline:none;text-align:center;font-family:inherit}
.rp-kpi .tg{font-size:11px;color:#8a93a6;font-weight:800}
.rp-kpi .bar{height:6px;border-radius:999px;background:#e8e2d2;overflow:hidden;margin-top:6px}
.rp-kpi .bar>div{height:100%;border-radius:999px;background:linear-gradient(90deg,#5db2ff,#1f7be0)}
.rp-kpi .bar>div.ok{background:linear-gradient(90deg,#8ee04a,#4aad22)}
.rp-field{margin-top:12px}
.rp-ta{width:100%;box-sizing:border-box;min-height:84px;margin-top:8px;border:2px solid #e2bf63;border-radius:14px;background:#fffdf6;padding:11px 13px;font-size:14px;font-weight:700;color:#1f2a44;line-height:1.7;outline:none;resize:vertical;font-family:inherit}
.rp-cnt{text-align:right;font-size:11px;font-weight:800;color:#8a93a6;margin-top:3px}
.rp-submit{position:relative;margin-top:16px;border:none;background:transparent;padding:0;cursor:pointer;width:100%;container-type:inline-size;font-family:inherit}
.rp-submit img{display:block;width:100%;height:auto;filter:drop-shadow(0 8px 18px rgba(20,40,90,.35))}
.rp-submit span{position:absolute;inset:10% 8% 14% 20%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:clamp(15px,4.6cqw,24px);letter-spacing:.14em;text-shadow:0 2px 4px rgba(10,25,70,.6)}
.rp-submit:disabled{opacity:.6;cursor:default}
.rp-note{text-align:center;font-size:11.5px;font-weight:800;color:#5a6b85;margin-top:6px}
.rp-msg{margin-top:12px;padding:12px 16px;border-radius:14px;font-weight:900;font-size:13.5px;text-align:center}
.rp-luku{display:flex;align-items:flex-end;margin-top:14px;container-type:inline-size}
.rp-luku .lk{width:24%;max-width:104px;flex:none}
.rp-luku .lk img{width:100%;display:block;filter:drop-shadow(0 6px 10px rgba(30,40,90,.3))}
.rp-luku .bw{flex:1;min-width:0;display:flex;flex-direction:column;margin-bottom:3%}
.rp-luku .pl{width:28%;min-width:84px;position:relative;margin-left:5%;z-index:2}
.rp-luku .pl img{display:block;width:100%;height:auto}
.rp-luku .pl span{position:absolute;inset:0 0 6% 0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:clamp(11px,3cqw,14px);letter-spacing:.2em;text-shadow:0 1px 3px rgba(10,25,70,.6)}
.rp-luku .bub{margin-top:-4%;background:url(/home/luku_bubble.webp);background-size:100% 100%;padding:6% 7% 9% 8.5%;font-weight:800;color:#4a3519;font-size:clamp(12px,3.3cqw,14px);line-height:1.7}
.rp-gold{border:2px solid #e8c45a;background:linear-gradient(180deg,#ffd76a,#f0a92d);color:#5a3a06;font-weight:900;border-radius:999px;padding:12px;cursor:pointer;font-family:inherit;font-size:14px;box-shadow:0 4px 12px rgba(170,110,20,.3),inset 0 2px 0 rgba(255,255,255,.6)}
.rp-gold:disabled{opacity:.5;cursor:default}
.rp-sub2{font-size:11.5px;color:#8a6a3a;font-weight:800}
.rp-lamp{position:fixed;right:22px;bottom:18px;width:150px;z-index:1;pointer-events:none;filter:drop-shadow(0 10px 18px rgba(20,40,90,.3))}
@media (max-width:999px){ .rp-lamp{display:none} }
`;

export default function ReportPage() {
    const router = useRouter();
    const reviewRef = useRef<TodayScheduleReviewHandle>(null);
    const [factText, setFactText] = useState("");        // 今日の成果（旧:今日のGood）
    const [issueText, setIssueText] = useState("");      // 今日の課題
    const [learnText, setLearnText] = useState("");      // 今日の学び
    const [submittedId, setSubmittedId] = useState<string | null>(null);
    const [expPlan, setExpPlan] = useState("");
    const [expAi, setExpAi] = useState(false);
    const [expSaved, setExpSaved] = useState(false);
    const [yesterdayExp, setYesterdayExp] = useState<{ id: string; plan: string } | null>(null);
    const [yResult, setYResult] = useState<"better" | "same" | "worse" | null>(null);
    const [yReflect, setYReflect] = useState("");
    const [yDone, setYDone] = useState(false);
    const [fbList, setFbList] = useState<{ id: string; fb_good: string | null; fb_think: string | null; fb_next: string | null; responded_at: string; responder: string; issue_quest: boolean }[]>([]);
    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from("experiments").select("id, plan, fb_request_id").eq("user_id", user.id).lte("target_date", getTodayJST()).is("result", null).order("target_date", { ascending: false }).limit(1);
            if (data && data.length > 0) setYesterdayExp(data[0] as any);
            // メンターからのFB（直近7日・返信済み）
            {
                const since = new Date(Date.now() - 7 * 86400000).toISOString();
                const { data: fbs } = await supabase.from("fb_requests").select("id, fb_good, fb_think, fb_next, responded_at, responder_id, issue_quest").eq("user_id", user.id).eq("status", "done").gte("responded_at", since).order("responded_at", { ascending: false }).limit(3);
                const rids = [...new Set((fbs || []).map((f: any) => f.responder_id).filter(Boolean))];
                const { data: rps } = rids.length ? await supabase.from("profiles").select("id, name").in("id", rids) : { data: [] as any[] };
                const rm = new Map((rps || []).map((r: any) => [r.id, r.name]));
                setFbList((fbs || []).map((f: any) => ({ ...f, responder: rm.get(f.responder_id) || "メンター" })));
            }
            // 今日すでに提出済みなら、内容と完了画面を復元（新4項目→旧2項目の順で解釈）
            const { data: todayRows } = await supabase.from("submissions").select("id, content, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3);
            const todayRow = (todayRows || []).find((r: any) => toJSTDateOnly(r.created_at) === getTodayJST());
            if (todayRow) {
                const c: string = (todayRow as any).content || "";
                const g2 = c.match(/【今日の成果】\n([\s\S]*?)\n\n【今日の課題】/);
                const i2 = c.match(/【今日の課題】\n([\s\S]*?)\n\n【今日の学び】/);
                const l2 = c.match(/【今日の学び】\n([\s\S]*?)\n\n【明日の一手】/);
                const a2 = c.match(/【明日の一手】\n([\s\S]*)$/);
                if (g2 || a2) {
                    setFactText(g2 ? g2[1] : ""); setIssueText(i2 ? i2[1] : ""); setLearnText(l2 ? l2[1] : ""); setActionText(a2 ? a2[1] : "");
                } else {
                    const g = c.match(/【今日のGood】[^\n]*\n([\s\S]*?)\n\n【明日のQuest】/);
                    const a = c.match(/【明日のQuest】[^\n]*\n([\s\S]*)$/);
                    setFactText(g ? g[1] : c); setActionText(a ? a[1] : "");
                }
                setSubmittedId((todayRow as any).id); setReportDone(true); setSuccess(true);
                const { data: ex } = await supabase.from("experiments").select("id").eq("submission_id", (todayRow as any).id).limit(1);
                if (ex && ex.length > 0) setExpSaved(true);
            }
        })();
    }, []);
    const saveExperiment = async () => {
        if (!expPlan.trim() || expSaved) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const t = new Date(`${getTodayJST()}T00:00:00+09:00`); t.setDate(t.getDate() + 1);
        const target = t.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
        const { data: newExp } = await supabase.from("experiments").insert({ user_id: user.id, submission_id: submittedId, plan: expPlan.trim(), target_date: target, used_ai: expAi }).select("id").single();
        await supabase.from("thinking_skill_logs").insert([{ user_id: user.id, skill: "hypothesis", exp: 5, source: "experiment_plan", source_id: newExp?.id ?? null }]);
        setExpSaved(true);
    };
    const saveYesterday = async () => {
        if (!yesterdayExp || !yResult || yDone) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from("experiments").update({ result: yResult, reflection: yReflect.trim() || null, reviewed_at: new Date().toISOString() }).eq("id", yesterdayExp.id);
        await supabase.from("thinking_skill_logs").insert([{ user_id: user.id, skill: "improve", exp: 10, source: "experiment_review", source_id: yesterdayExp.id }]);
        // 代替EXP：結果が良ければ仮説+5、FBをもとにした実験なら原因分析+5
        if (yResult === "better") await supabase.from("thinking_skill_logs").insert([{ user_id: user.id, skill: "hypothesis", exp: 5, source: "experiment_good", source_id: yesterdayExp.id }]);
        if ((yesterdayExp as any).fb_request_id) await supabase.from("thinking_skill_logs").insert([{ user_id: user.id, skill: "cause", exp: 5, source: "experiment_fb", source_id: yesterdayExp.id }]);
        setYDone(true);
    };
    const [actionText, setActionText] = useState("");    // 明日の一手（旧:明日のQuest）
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [dotkunFb, setDotkunFb] = useState<DotKunFeedback | null>(null);
    const [kpiItems, setKpiItems] = useState<KpiItem[]>([]);
    const [kpiValues, setKpiValues] = useState<Record<string, number>>({});
    const [gachaSpinning, setGachaSpinning] = useState(false);
    const [gachaResult, setGachaResult] = useState<number | null>(null);
    const [reportDone, setReportDone] = useState(false);
    const [showThanksPopup, setShowThanksPopup] = useState(false);
    const [questDone, setQuestDone] = useState(0);
    const [questTotal, setQuestTotal] = useState(0);
    const [streakNow, setStreakNow] = useState(0);
    const [monthRate, setMonthRate] = useState<number | null>(null);

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase.from("kpi_items").select("*").eq("is_active", true).order("created_at");
            setKpiItems((data || []) as KpiItem[]);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const todayYmd = getTodayJST();
                const { data: subs } = await supabase.from("submissions").select("created_at").eq("user_id", user.id);
                const submittedToday = (subs || []).some((row: any) => toJSTDateOnly(row.created_at) === todayYmd);
                const { data: gachas } = await supabase.from("gacha_history").select("created_at").eq("user_id", user.id).eq("cost", 0);
                const gachaToday = (gachas || []).some((row: any) => toJSTDateOnly(row.created_at) === todayYmd);
                if (submittedToday && !gachaToday) setReportDone(true);
                // 連続提出・今月の提出率（表示用・読み取りのみ）
                const { data: profRow } = await supabase.from("profiles").select("streak").eq("id", user.id).maybeSingle();
                setStreakNow((profRow as any)?.streak || 0);
                const ym = todayYmd.slice(0, 7);
                const daysPassed = Number(todayYmd.slice(8, 10));
                const monthDays = new Set((subs || []).map((r: any) => toJSTDateOnly(r.created_at)).filter((d: string) => d.startsWith(ym)));
                setMonthRate(Math.min(100, Math.round((monthDays.size / daysPassed) * 100)));
            }
        };
        load();
    }, []);

    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const combinedText = `【今日の成果】\n${factText.trim()}\n\n【今日の課題】\n${issueText.trim()}\n\n【今日の学び】\n${learnText.trim()}\n\n【明日の一手】\n${actionText.trim()}`;
            const totalLength = factText.trim().length + issueText.trim().length + learnText.trim().length + actionText.trim().length;
            if (totalLength === 0) { setMessage("今日の振り返りを書いてください"); setSubmitting(false); return; }
            if (totalLength < 100) { setMessage(`合計100文字以上で提出できます（現在${totalLength}文字）`); setSubmitting(false); return; }
            setMessage("");

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setMessage("ログインエラー"); setLoading(false); return; }
            const todayYmd = getTodayJST();

            const { data: todaySubmissionRows } = await supabase.from("submissions").select("id, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
            if (todaySubmissionRows?.some((row) => toJSTDateOnly(row.created_at) === todayYmd)) {
                setMessage("今日はすでに提出済みです");
                setLoading(false);
                return;
            }

            const { data: insertedSub, error: submissionError } = await supabase.from("submissions").insert({ user_id: user.id, content: combinedText }).select("id").single();
            // 代替EXP：日報の振り返りで原因分析+2（1提出につき1回）
            if (insertedSub?.id) await supabase.from("thinking_skill_logs").insert([{ user_id: user.id, skill: "cause", exp: 2, source: "report", source_id: insertedSub.id }]);
            if (submissionError) { setMessage("提出に失敗しました"); setLoading(false); return; }

            const nowIso = new Date().toISOString();
            const kpiLogs = Object.entries(kpiValues).filter(([, v]) => v > 0).map(([kpi_item_id, value]) => ({ user_id: user.id, kpi_item_id, value }));
            if (kpiLogs.length > 0) await supabase.from("kpi_logs").insert(kpiLogs);

            const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", user.id).single();
            const currentPoints = pointRow?.points || 0;

            const { data: streakRows } = await supabase.from("submissions").select("created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(400);
            const newStreak = computeReportStreak((streakRows || []).map((r: any) => r.created_at));

            let bonus = 0;
            if (newStreak >= 3) bonus = 5;
            if (newStreak >= 7) bonus = 10;
            const addPoints = 2 + bonus;

            await supabase.from("user_points").update({ points: currentPoints + addPoints }).eq("id", user.id);
            const historyInserts = [{ user_id: user.id, change: 2, reason: "report_submit" }];
            if (bonus > 0) historyInserts.push({ user_id: user.id, change: bonus, reason: "streak_bonus" });
            await supabase.from("points_history").insert(historyInserts);
            await supabase.from("profiles").update({ streak: newStreak, last_report_date: nowIso }).eq("id", user.id);
            setStreakNow(newStreak);

            // Quest振り返りを保存
            const reviewResult = await reviewRef.current?.saveReview(user.id);

            // 全達成なら累計＆連続ボーナス
            if (reviewResult?.isAllMaru) {
                const { data: schedRow } = await supabase.from("daily_schedules").select("streak_rewarded, schedule_status").eq("user_id", user.id).eq("date", todayYmd).maybeSingle();
                if (schedRow && !(schedRow as any).streak_rewarded && (schedRow as any).schedule_status !== "rejected") {
                    const { data: profMaru } = await supabase.from("profiles").select("total_maru_days").eq("id", user.id).single();
                    const newTotal = ((profMaru as any)?.total_maru_days || 0) + 1;
                    await supabase.from("profiles").update({ total_maru_days: newTotal }).eq("id", user.id);

                    let maruStreak = 1;
                    for (let i = 1; i <= 30; i++) {
                        const past = new Date(`${todayYmd}T00:00:00+09:00`);
                        past.setDate(past.getDate() - i);
                        const pastYmd = past.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
                        const { data: pastRow } = await supabase.from("daily_schedules").select("slots").eq("user_id", user.id).eq("date", pastYmd).maybeSingle();
                        const pastSlots = (pastRow as any)?.slots;
                        // 新3分割Quest構造で全達成判定
                        let pastAllMaru = false;
                        if (pastSlots && !Array.isArray(pastSlots)) {
                            const allQ = [...(pastSlots.morning || []), ...(pastSlots.afternoon || []), ...(pastSlots.night || [])];
                            pastAllMaru = allQ.length > 0 && allQ.every((q: any) => q.done);
                        }
                        if (pastAllMaru) maruStreak++;
                        else break;
                    }

                    let maruBonus = 0;
                    if (maruStreak === 3) maruBonus = 5;
                    else if (maruStreak === 7) maruBonus = 10;
                    if (maruBonus > 0) {
                        const { data: ptNow } = await supabase.from("user_points").select("points").eq("id", user.id).single();
                        await supabase.from("user_points").update({ points: ((ptNow as any)?.points || 0) + maruBonus }).eq("id", user.id);
                        await supabase.from("points_history").insert([{ user_id: user.id, change: maruBonus, reason: "maru_streak_bonus" }]);
                    }
                    await supabase.from("daily_schedules").update({ streak_rewarded: true }).eq("user_id", user.id).eq("date", todayYmd);
                }
            }

            setSuccess(true);
            setMessage(bonus > 0 ? `+${addPoints}pt 獲得！連続ボーナス +${bonus}pt も獲得 🎉` : `+${addPoints}pt 獲得しました！`);
            setDotkunFb(generateDotKunFeedback({ factText, interpText: learnText, actionText, streak: newStreak }));
            setLoading(false);
            setReportDone(true);
            setSubmittedId((insertedSub as any)?.id || null);
            setShowThanksPopup(true);
        } finally {
            setSubmitting(false);
        }
    };

    const handleGachaSpin = async () => {
        if (gachaSpinning || gachaResult !== null) return;
        setGachaSpinning(true);
        const prizes = [
            { pt: 1, weight: 5 }, { pt: 2, weight: 10 }, { pt: 3, weight: 20 },
            { pt: 4, weight: 20 }, { pt: 5, weight: 20 }, { pt: 6, weight: 10 },
            { pt: 7, weight: 5 }, { pt: 8, weight: 5 }, { pt: 9, weight: 3 }, { pt: 10, weight: 2 },
        ];
        const totalWeight = prizes.reduce((s, p) => s + p.weight, 0);
        let random = Math.random() * totalWeight;
        let selectedPt = 1;
        for (const prize of prizes) { random -= prize.weight; if (random <= 0) { selectedPt = prize.pt; break; } }
        await new Promise(resolve => setTimeout(resolve, 1500));
        setGachaResult(selectedPt);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: ptRow } = await supabase.from("user_points").select("points").eq("id", user.id).maybeSingle();
            const currentPt = (ptRow as any)?.points || 0;
            await supabase.from("user_points").upsert({ id: user.id, points: currentPt + selectedPt });
            await supabase.from("gacha_history").insert({ user_id: user.id, cost: 0, reward: selectedPt, rarity: selectedPt === 10 ? "LEGEND" : selectedPt >= 7 ? "RARE" : "COMMON" });
        }
        setGachaSpinning(false);
    };

    // Quest結果の計算（従来ルールのまま：達成率→ランク）
    const rate = questTotal > 0 ? Math.round((questDone / questTotal) * 100) : 0;
    const rank = rate >= 90 ? "S" : rate >= 80 ? "A" : rate >= 60 ? "B" : rate >= 40 ? "C" : "D";
    const rankDisp = questTotal > 0 ? rank : "–";

    const todayYmd = getTodayJST();
    const dateLabel = `${todayYmd.slice(0, 4)}.${todayYmd.slice(5, 7)}.${todayYmd.slice(8, 10)}（${WEEK[new Date(`${todayYmd}T00:00:00+09:00`).getDay()]}）`;
    const totalLen = factText.trim().length + issueText.trim().length + learnText.trim().length + actionText.trim().length;

    const FIELDS = [
        { icon: "/report/icon_result.webp", title: "今日の成果", sub: "できたこと・うまくいったこと", ph: "例）初めて自分だけでアポを獲得できた！", v: factText, set: setFactText },
        { icon: "/report/icon_issue.webp", title: "今日の課題", sub: "うまくいかなかったこと・その原因", ph: "例）断られた際の切り返しができなかった。", v: issueText, set: setIssueText },
        { icon: "/report/icon_learn.webp", title: "今日の学び", sub: "今日の経験から得た気づき", ph: "例）相手の悩みを深掘りすると、ニーズが見えてくると感じた。", v: learnText, set: setLearnText },
        { icon: "/report/icon_flag.webp", title: "明日の一手", sub: "明日、具体的に試す行動", ph: "例）断り文句への切り返しを3パターン練習する。", v: actionText, set: setActionText },
    ];

    return (
        <div className="rp-page">
            <style>{CSS}</style>
            <img className="rp-lamp" src="/report/lamp.webp" alt="" />
            <div className="rp-col">
                <button className="rp-back" onClick={() => router.push("/home")}>← HOMEへ</button>

                <div className="rp-title">
                    <img src="/report/plate_title.webp" alt="" width={1400} height={410} />
                    <div><span className="t1">冒険の記録</span><span className="t2">- DAILY REPORT -</span></div>
                </div>
                <div className="rp-date">📅 {dateLabel}</div>

                {/* 成長ランク（従来の達成率ルール）＋ 今日のステータス */}
                <div className="rp-hero">
                    <div className="rp-shield">
                        <img src="/report/rank_shield.webp" alt="" />
                        <div className="lb">本日の成長ランク</div>
                        <div className="rk">{rankDisp}</div>
                    </div>
                    <div className="rp-stats">
                        <div className="rp-stat"><img src="/report/icon_star.webp" alt="" /><span className="k">獲得ポイント<br /><small style={{ color: "#b09a6a" }}>連続提出でボーナス</small></span><span className="v">+2<small> pt〜</small></span></div>
                        <div className="rp-stat"><img src="/report/icon_streak.webp" alt="" /><span className="k">連続提出</span><span className="v">{streakNow}<small> 日</small></span></div>
                        <div className="rp-stat"><img src="/report/icon_rate.webp" alt="" /><span className="k">今月の提出率</span><span className="v">{monthRate === null ? "–" : monthRate}<small> %</small></span></div>
                    </div>
                </div>

                {/* 今日の活動実績（KPI。項目は管理画面の設定と連動） */}
                {kpiItems.length > 0 && !reportDone && (
                    <div className="rp-panel">
                        <div className="rp-head">📊 今日の活動実績<small>数字を入れて提出しよう</small></div>
                        <div className="rp-kpis" style={{ gridTemplateColumns: `repeat(${Math.min(kpiItems.length, 3)}, 1fr)` }}>
                            {kpiItems.map((item) => {
                                const val = kpiValues[item.id] || 0;
                                const pct = item.target_value > 0 ? Math.min(Math.round((val / item.target_value) * 100), 100) : 0;
                                const done = val > 0 && val >= item.target_value;
                                return (
                                    <div key={item.id} className="rp-kpi">
                                        <img src={kpiIcon(item.title)} alt="" />
                                        <div className="t">{item.title}</div>
                                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4, marginTop: 4 }}>
                                            <input type="number" min={0} value={kpiValues[item.id] ?? ""} onChange={(e) => setKpiValues(prev => ({ ...prev, [item.id]: Number(e.target.value) }))} placeholder="0" />
                                            <span className="tg">/ {item.target_value}</span>
                                        </div>
                                        <div className="bar"><div className={done ? "ok" : ""} style={{ width: `${pct}%` }} /></div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 昨日の学び（振り返り）：昨日決めた実験の結果 */}
                {yesterdayExp && !reportDone && (
                    <div className="rp-panel">
                        <div className="rp-head"><img src="/report/icon_streak.webp" alt="" />昨日の学び（振り返り）</div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: "#17397d", margin: "10px 2px 10px", lineHeight: 1.6 }}>🧪 {yesterdayExp.plan}</div>
                        {yDone ? (
                            <div style={{ fontSize: 13, color: "#2e7d4f", fontWeight: 900 }}>振り返り完了！ 🔄 改善力EXP +10</div>
                        ) : (
                            <>
                                <div className="rp-sub2" style={{ marginBottom: 8 }}>結果はどうでしたか？</div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 10 }}>
                                    {([["better", "◎ 良くなった", "#2e7d4f"], ["same", "○ 変わらなかった", "#5a6b85"], ["worse", "△ 悪くなった", "#b0413e"]] as const).map(([k, l, c]) => (
                                        <button key={k} onClick={() => setYResult(k)} style={{ padding: "10px 4px", borderRadius: 12, fontSize: 12.5, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", border: yResult === k ? `2px solid ${c}` : "2px solid rgba(190,160,110,.4)", background: yResult === k ? "#fff" : "rgba(255,255,251,.7)", color: c }}>{l}</button>
                                    ))}
                                </div>
                                <div className="rp-sub2">なぜこの結果になったと思いますか？</div>
                                <textarea className="rp-ta" value={yReflect} onChange={e => setYReflect(e.target.value.slice(0, 300))} placeholder="振り返ってみましょう…" style={{ minHeight: 64 }} />
                                <button className="rp-gold" onClick={saveYesterday} disabled={!yResult} style={{ width: "100%", marginTop: 10 }}>振り返りを完了する</button>
                            </>
                        )}
                    </div>
                )}

                {/* Questの振り返り（既存部品） */}
                <div className="rp-panel">
                    <div className="rp-head">✨ Questの振り返り<small>達成率がランクになる（S:90%〜 A:80%〜 B:60%〜 C:40%〜）</small></div>
                    <div style={{ marginTop: 10 }}>
                        <TodayScheduleReview ref={reviewRef} onProgressChange={(d, t) => { setQuestDone(d); setQuestTotal(t); }} />
                    </div>
                </div>

                {/* メンターからのFB */}
                {fbList.length > 0 && (
                    <div className="rp-panel">
                        <div className="rp-head">💌 メンターからのFB</div>
                        {fbList.map(f => (
                            <div key={f.id} style={{ padding: "10px 2px", borderBottom: "1px solid rgba(190,160,110,.25)" }}>
                                <div style={{ fontSize: 11.5, color: "#8a93a6", fontWeight: 800, marginBottom: 5 }}>{f.responder}さん　{new Date(f.responded_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}</div>
                                {f.fb_good && <div style={{ fontSize: 13.5, color: "#3a4256", marginBottom: 4, lineHeight: 1.6, fontWeight: 700 }}><b style={{ color: "#2e7d4f" }}>👍 GOOD　</b>{f.fb_good}</div>}
                                {f.fb_think && <div style={{ fontSize: 13.5, color: "#3a4256", marginBottom: 4, lineHeight: 1.6, fontWeight: 700 }}><b style={{ color: "#b07a08" }}>🧠 THINK　</b>{f.fb_think}</div>}
                                {f.fb_next && <div style={{ fontSize: 13.5, color: "#3a4256", lineHeight: 1.6, fontWeight: 700 }}><b style={{ color: "#17397d" }}>⚔️ NEXT　</b>{f.fb_next}{f.issue_quest && <span style={{ fontSize: 11, color: "#8a93a6", marginLeft: 6 }}>（クエスト）</span>}</div>}
                            </div>
                        ))}
                    </div>
                )}

                {/* 提出済み：今日の内容 */}
                {reportDone && (
                    <div className="rp-panel">
                        <div className="rp-head">✅ 今日の冒険の記録は提出済み</div>
                        {FIELDS.map((f) => (f.v.trim() ? (
                            <div key={f.title} style={{ marginTop: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><img src={f.icon} alt="" style={{ height: 24 }} /><b style={{ fontSize: 13.5, color: "#17397d" }}>{f.title}</b></div>
                                <div style={{ fontSize: 14, color: "#3a4256", whiteSpace: "pre-wrap", lineHeight: 1.7, fontWeight: 700, marginTop: 4, background: "rgba(255,255,251,.8)", border: "1.5px solid rgba(190,160,110,.35)", borderRadius: 12, padding: "9px 12px" }}>{f.v}</div>
                            </div>
                        ) : null))}
                    </div>
                )}

                {/* 記入欄（4項目） */}
                {!reportDone && (<>
                    <div className="rp-panel">
                        {FIELDS.map((f) => (
                            <div key={f.title} className="rp-field">
                                <div className="rp-head" style={{ background: "linear-gradient(180deg,#4a7de0,#2451ad)" }}><img src={f.icon} alt="" />{f.title}<small>{f.sub}</small></div>
                                <textarea className="rp-ta" value={f.v} maxLength={300} onChange={(e) => f.set(e.target.value)} placeholder={f.ph} />
                                <div className="rp-cnt">{f.v.length} / 300</div>
                            </div>
                        ))}
                        <div className="rp-cnt" style={{ color: totalLen >= 100 ? "#2e7d4f" : "#8a93a6", fontSize: 12.5 }}>{totalLen >= 100 ? "✅ " : ""}合計 {totalLen} / 100文字以上で提出できます</div>
                    </div>

                    <button className="rp-submit" onClick={handleSubmit} disabled={loading || submitting}>
                        <img src="/report/submit_bar.webp" alt="" width={1200} height={368} />
                        <span>{submitting ? "送信中..." : "冒険の記録を提出する ▶"}</span>
                    </button>
                    <div className="rp-note">提出すると +2pt（連続提出でボーナスあり）</div>
                </>)}

                {/* メッセージ */}
                {message && (
                    <div className="rp-msg" style={{ background: success ? "#e9f7ec" : "#fdecec", border: `2px solid ${success ? "#9fd7ae" : "#f0b4b4"}`, color: success ? "#2e7d4f" : "#b0413e" }}>
                        {message}
                        {success && <button onClick={() => router.push("/mypage")} style={{ marginLeft: 10, padding: "5px 14px", borderRadius: 999, border: "2px solid #9fd7ae", background: "#fff", color: "#2e7d4f", fontSize: 12, cursor: "pointer", fontWeight: 900, fontFamily: "inherit" }}>マイページで確認 →</button>}
                    </div>
                )}

                {/* ルクの応援 */}
                <div className="rp-luku">
                    <div className="lk"><img src="/onboarding/luku.png" alt="ルク" /></div>
                    <div className="bw">
                        <div className="pl"><img src="/home/luku_plate.webp" alt="" /><span>ルク</span></div>
                        <div className="bub">{reportDone ? "今日もよく頑張ったね！小さな改善の積み重ねが、大きな成長につながるよ✨" : "今日の冒険を記録しよう！書くと頭が整理されて、明日の一手が見えてくるよ📖"}</div>
                    </div>
                </div>

                {/* 提出完了：次の行動を選ぶ（既存機能） */}
                {reportDone && (
                    <div className="rp-panel">
                        <div className="rp-head">🎉 今日の冒険、お疲れさまでした！<small>さらに成長するためにやってみよう</small></div>
                        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: "2px solid rgba(190,160,110,.35)", background: "rgba(255,255,251,.7)", opacity: 0.6 }}>
                                <span style={{ fontSize: 24 }}>🧠</span>
                                <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 900, color: "#17397d" }}>AIと作戦会議</div><div className="rp-sub2">今日の行動をAIと一緒に深掘りする</div></div>
                                <span style={{ fontSize: 10, fontWeight: 900, color: "#8a6a3a", border: "1.5px solid #e2bf63", borderRadius: 6, padding: "2px 6px", whiteSpace: "nowrap" }}>COMING SOON</span>
                            </div>
                            <button onClick={() => router.push(`/report/fb${submittedId ? `?sid=${submittedId}` : ""}`)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: "2px solid #9db7e8", background: "#f3f7ff", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                                <span style={{ fontSize: 24 }}>💌</span>
                                <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 900, color: "#17397d" }}>FBをお願いする</div><div className="rp-sub2">メンターから別の視点をもらう</div></div>
                                <span style={{ color: "#17397d", fontWeight: 900 }}>›</span>
                            </button>
                            <div style={{ padding: "12px 14px", borderRadius: 14, border: "2px solid #9fd7ae", background: "#f2faf3" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <span style={{ fontSize: 24 }}>🧪</span>
                                    <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 900, color: "#17397d" }}>明日の実験を決める</div><div className="rp-sub2">今日の学びを明日の行動に変える。1つだけ</div></div>
                                </div>
                                {expSaved ? (
                                    <div style={{ marginTop: 10, fontSize: 13, color: "#2e7d4f", fontWeight: 900 }}>明日の実験に登録しました！ 💡 仮説思考EXP +5　明日の日報で結果を振り返ろう</div>
                                ) : (
                                    <>
                                        <textarea className="rp-ta" value={expPlan} onChange={e => setExpPlan(e.target.value.slice(0, 200))} placeholder="例：DMを送る時間帯を18〜20時に固定して、返信率を比較する" style={{ minHeight: 60 }} />
                                        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12.5, color: "#5a6b85", cursor: "pointer", fontWeight: 800 }}><input type="checkbox" checked={expAi} onChange={e => setExpAi(e.target.checked)} style={{ width: 16, height: 16 }} />🤖 AIを使って実験する（AIスキルの条件に加算）</label>
                                        <button className="rp-gold" onClick={saveExperiment} disabled={!expPlan.trim()} style={{ width: "100%", marginTop: 8 }}>明日の実験に登録</button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 提出後: ガチャ（既存機能） */}
                {reportDone && (
                    <div className="rp-panel" style={{ textAlign: "center", background: "linear-gradient(180deg,#fff7df,#ffe9b8)" }}>
                        <div style={{ fontSize: 11, color: "#8a6a3a", fontWeight: 900, letterSpacing: 3, marginBottom: 4 }}>✨ 日報提出ボーナス ✨</div>
                        <div style={{ fontSize: 17, color: "#17397d", fontWeight: 900, marginBottom: 12 }}>🎰 今日の運試し！</div>
                        <button className="rp-gold" onClick={handleGachaSpin} disabled={gachaSpinning || gachaResult !== null} style={{ padding: "14px 40px", fontSize: 17 }}>
                            {gachaSpinning ? "🎲 ぐるぐる..." : gachaResult !== null ? `🎁 +${gachaResult}pt 獲得済み` : "🎁 ガチャを引く！"}
                        </button>
                        <div className="rp-sub2" style={{ marginTop: 8 }}>ランダムで 1〜10pt 獲得！</div>
                    </div>
                )}
            </div>

            {/* 提出後：サンキュー誘導（既存機能） */}
            {showThanksPopup && (
                <div onClick={() => setShowThanksPopup(false)} style={{ position: "fixed", inset: 0, background: "rgba(10,20,50,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2100, padding: 20, cursor: "pointer" }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: "linear-gradient(180deg,#fffdf4,#f6ead0)", border: "3px solid #d8b55e", borderRadius: 22, padding: "24px 22px", width: "100%", maxWidth: 360, textAlign: "center", cursor: "default", boxShadow: "0 18px 50px rgba(10,25,70,.4)" }}>
                        <img src="/home/icon_thanks.webp" alt="" style={{ width: 84, display: "block", margin: "0 auto 4px" }} />
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#17397d" }}>日報おつかれさま！</div>
                        <div style={{ fontSize: 13.5, color: "#5a6b85", lineHeight: 1.75, marginTop: 10, fontWeight: 800 }}>今日がんばった自分と、<br />支えてくれた仲間に<br />「サンキュー」を伝えよう💛</div>
                        <button className="rp-gold" onClick={() => router.push("/thanks")} style={{ width: "100%", marginTop: 16 }}>💌 サンキューを送る</button>
                        <button onClick={() => setShowThanksPopup(false)} style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 999, border: "2px solid #c9cfdb", background: "#fff", color: "#5a6b85", fontSize: 13, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>あとで</button>
                    </div>
                </div>
            )}
        </div>
    );
}
