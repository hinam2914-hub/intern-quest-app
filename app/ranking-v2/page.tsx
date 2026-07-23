"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { computeReportStreak } from "../lib/date";
import RankingView from "./RankingView";

type RankingUser = {
    id: string;
    name: string;
    points: number;
    avatar_url?: string | null;
    color?: string | null;
    subLabel?: string;
    isTeam?: boolean;
};

function getOneWeekAgoISO(): string {
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);
    return oneWeekAgo.toISOString();
}

function getYmdJST(iso: string): string {
    const d = new Date(iso);
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const day = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export default function RankingPage() {
    const router = useRouter();
    const [users, setUsers] = useState<RankingUser[]>([]);
    const [weeklyUsers, setWeeklyUsers] = useState<RankingUser[]>([]);
    const [teamRanking, setTeamRanking] = useState<RankingUser[]>([]);
    const [streakUsers, setStreakUsers] = useState<RankingUser[]>([]);
    const [sankyuUsers, setSankyuUsers] = useState<RankingUser[]>([]);
    const [sankyuSentUsers, setSankyuSentUsers] = useState<RankingUser[]>([]);
    const [challengeUsers, setChallengeUsers] = useState<RankingUser[]>([]);
    const [testUsers, setTestUsers] = useState<RankingUser[]>([]);
    const [adviceUsers, setAdviceUsers] = useState<RankingUser[]>([]);
    const [learnUsers, setLearnUsers] = useState<RankingUser[]>([]);
    const [workUsers, setWorkUsers] = useState<RankingUser[]>([]);
    const [thinkingUsers, setThinkingUsers] = useState<RankingUser[]>([]);
    const [questionUsers, setQuestionUsers] = useState<RankingUser[]>([]);
    const [ipponUsers, setIpponUsers] = useState<RankingUser[]>([]);
    const [kpiUsers, setKpiUsers] = useState<RankingUser[]>([]);
    const [salesMonthUsers, setSalesMonthUsers] = useState<RankingUser[]>([]);
    const [salesTotalUsers, setSalesTotalUsers] = useState<RankingUser[]>([]);
   const [maruTotalUsers, setMaruTotalUsers] = useState<RankingUser[]>([]);
    const [jobRankUsers, setJobRankUsers] = useState<RankingUser[]>([]);
    const [payForwardUsers, setPayForwardUsers] = useState<RankingUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [myTeamId, setMyTeamId] = useState<string | null>(null);
    const [myId, setMyId] = useState("");
    const [activeTab, setActiveTab] = useState<"total" | "weekly" | "teams" | "streak" | "sankyu" | "sankyu_sent" |"challenge" | "test" | "advice" | "learn" | "work" | "kpi" | "sales_month" | "sales_total" | "maru_total" | "job_rank" | "pay_forward" | "thinking" | "question" | "ippon">("total");

    useEffect(() => {
        const loadRanking = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setMyId(user.id);

            // 自分のteam_id取得
            const { data: myProfile } = await supabase.from("profiles").select("team_id").eq("id", user.id).single();
            setMyTeamId((myProfile as any)?.team_id || null);

            // ===== 総合ランキング =====
            const { data: pointRows } = await supabase.from("user_points").select("id, total_earned").order("total_earned", { ascending: false });
            const totalRows = pointRows || [];
            const { data: profileRows } = await supabase.from("profiles").select("id, name, avatar_url, is_active").in("id", totalRows.map((r) => r.id));
            const activeIds = new Set((profileRows || []).filter((p: any) => p.is_active).map((p: any) => p.id));
            setUsers(totalRows.filter((row) => activeIds.has(row.id)).map((row) => ({
                id: row.id,
                name: profileRows?.find((p) => p.id === row.id)?.name || "名前未設定",
                points: (row as any).total_earned || 0,
                avatar_url: profileRows?.find((p) => p.id === row.id)?.avatar_url || null,
            })));

            // ===== 週間ランキング =====
            const { data: weeklyData } = await supabase.from("points_history").select("user_id, change, created_at").gte("created_at", getOneWeekAgoISO());
            const weeklyTotals: Record<string, number> = {};
            (weeklyData || []).forEach((item) => { weeklyTotals[item.user_id] = (weeklyTotals[item.user_id] || 0) + item.change; });
            const weeklyIds = Object.keys(weeklyTotals);
            if (weeklyIds.length > 0) {
                const { data: weeklyProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").in("id", weeklyIds);
                const weeklyActiveIds = new Set((weeklyProfiles || []).filter((p: any) => p.is_active).map((p: any) => p.id));
                setWeeklyUsers(weeklyIds.filter((id) => weeklyActiveIds.has(id)).map((id) => ({
                    id,
                    name: weeklyProfiles?.find((p) => p.id === id)?.name || "名前未設定",
                    points: weeklyTotals[id] || 0,
                    avatar_url: weeklyProfiles?.find((p) => p.id === id)?.avatar_url || null,
                })).sort((a, b) => b.points - a.points));
            }

            // ===== 連続提出日数ランキング（submissionsから都度算出）=====
            // 直近180日分の提出を取得（連続180日超は非現実的なため窓を限定）
            const { data: streakProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active, streak").eq("is_active", true);
            setStreakUsers((streakProfiles || [])
                .map((row: any) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: row.streak || 0,
                }))
                .filter((u) => u.points > 0)
                .sort((a, b) => b.points - a.points));
            // ===== サンキュー受信数ランキング =====
            const { data: thanksAllRows } = await supabase.from("thanks").select("to_user_id");
            const thanksCounts: { [id: string]: number } = {};
            (thanksAllRows || []).forEach((row: any) => { if (row.to_user_id) thanksCounts[row.to_user_id] = (thanksCounts[row.to_user_id] || 0) + 1; });
            const sankyuIds = Object.keys(thanksCounts);
            if (sankyuIds.length > 0) {
                const { data: sankyuProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", sankyuIds);
                setSankyuUsers((sankyuProfiles || []).map((row: any) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: thanksCounts[row.id] || 0,
                })).sort((a, b) => b.points - a.points));
            }
            // ===== ペイフォワードランキング（承認済み報告数） =====
            const { data: pfRows } = await supabase.from("mentor_reports").select("user_id").eq("status", "approved");
            const pfCounts: { [id: string]: number } = {};
            (pfRows || []).forEach((row: any) => { if (row.user_id) pfCounts[row.user_id] = (pfCounts[row.user_id] || 0) + 1; });
            const pfIds = Object.keys(pfCounts);
            if (pfIds.length > 0) {
                const { data: pfProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", pfIds);
                setPayForwardUsers((pfProfiles || []).map((row: any) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: pfCounts[row.id] || 0,
                })).sort((a, b) => b.points - a.points));
            }
            // ===== サンキュー送信数ランキング =====
            const { data: thanksSentRows } = await supabase.from("thanks").select("from_user_id");
            const thanksSentCounts: { [id: string]: number } = {};
            (thanksSentRows || []).forEach((row: any) => { if (row.from_user_id) thanksSentCounts[row.from_user_id] = (thanksSentCounts[row.from_user_id] || 0) + 1; });
            const sankyuSentIds = Object.keys(thanksSentCounts);
            if (sankyuSentIds.length > 0) {
                const { data: sankyuSentProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", sankyuSentIds);
                setSankyuSentUsers((sankyuSentProfiles || []).map((row: any) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: thanksSentCounts[row.id] || 0,
                })).sort((a, b) => b.points - a.points));
            }
            // ===== ライフチャレンジ数ランキング =====
            const { data: challengeAllRows } = await supabase.from("challenge_submissions").select("user_id").eq("status", "approved");
            const challengeCounts: { [id: string]: number } = {};
            (challengeAllRows || []).forEach((row: any) => { if (row.user_id) challengeCounts[row.user_id] = (challengeCounts[row.user_id] || 0) + 1; });
            const challengeIds = Object.keys(challengeCounts);
            if (challengeIds.length > 0) {
                const { data: challengeProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", challengeIds);
                setChallengeUsers((challengeProfiles || []).map((row: any) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: challengeCounts[row.id] || 0,
                })).sort((a, b) => b.points - a.points));
            }
            // ===== 思考クエスト回答数ランキング =====
            const { data: thinkingAllRows } = await supabase.from("thinking_answers").select("user_id");
            const thinkingCounts: { [id: string]: number } = {};
            (thinkingAllRows || []).forEach((row: any) => { if (row.user_id) thinkingCounts[row.user_id] = (thinkingCounts[row.user_id] || 0) + 1; });
            const thinkingIds = Object.keys(thinkingCounts);
            if (thinkingIds.length > 0) {
                const { data: tProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", thinkingIds);
                setThinkingUsers((tProfiles || []).map((row: any) => ({
                    id: row.id, name: row.name, avatar_url: row.avatar_url, is_active: row.is_active,
                    points: thinkingCounts[row.id] || 0,
                })).sort((a, b) => b.points - a.points));
            }
            // ===== 質問クエスト投稿数ランキング =====
            const { data: questionAllRows } = await supabase.from("questions_box").select("user_id");
            const questionCounts: { [id: string]: number } = {};
            (questionAllRows || []).forEach((row: any) => { if (row.user_id) questionCounts[row.user_id] = (questionCounts[row.user_id] || 0) + 1; });
            const questionIds = Object.keys(questionCounts);
            if (questionIds.length > 0) {
                const { data: qProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", questionIds);
                setQuestionUsers((qProfiles || []).map((row: any) => ({
                    id: row.id, name: row.name, avatar_url: row.avatar_url, is_active: row.is_active,
                    points: questionCounts[row.id] || 0,
                })).sort((a, b) => b.points - a.points));
            }
            // ===== もらったIPPON数ランキング =====
            // IPPON記録（answer_id）を取得し、各回答の持ち主に紐付けて集計
            const { data: ipponRows } = await supabase.from("thinking_ippon").select("answer_id");
            const ipponAnswerIds = Array.from(new Set((ipponRows || []).map((r: any) => r.answer_id).filter(Boolean)));
            if (ipponAnswerIds.length > 0) {
                // answer_id → 回答者user_id の対応を取得
                const { data: ansOwners } = await supabase.from("thinking_answers").select("id, user_id").in("id", ipponAnswerIds);
                const ownerMap: { [aid: string]: string } = {};
                (ansOwners || []).forEach((a: any) => { ownerMap[a.id] = a.user_id; });
                // 回答者ごとにIPPON数を集計
                const ipponCounts: { [uid: string]: number } = {};
                (ipponRows || []).forEach((r: any) => {
                    const owner = ownerMap[r.answer_id];
                    if (owner) ipponCounts[owner] = (ipponCounts[owner] || 0) + 1;
                });
                const ipponIds = Object.keys(ipponCounts);
                if (ipponIds.length > 0) {
                    const { data: ipProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", ipponIds);
                    setIpponUsers((ipProfiles || []).map((row: any) => ({
                        id: row.id, name: row.name, avatar_url: row.avatar_url, is_active: row.is_active,
                        points: ipponCounts[row.id] || 0,
                    })).sort((a, b) => b.points - a.points));
                }
            }
            // ===== テスト合格数ランキング =====
            const { data: testProfileRows } = await supabase.from("profiles").select("*").eq("is_active", true);
            setTestUsers((testProfileRows || []).map((row: any) => {
                let passedCount = 0;
                Object.keys(row).forEach((key) => { if (key.endsWith("_passed") && row[key] === true) passedCount++; });
                return {
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: passedCount,
                };
            }).filter((u) => u.points > 0).sort((a, b) => b.points - a.points));
            // ===== アドバイス送信数ランキング（承認済みのみ） =====
            const { data: adviceAllRows } = await supabase.from("advice_logs").select("sender_id").eq("status", "approved");
            const adviceCounts: { [id: string]: number } = {};
            (adviceAllRows || []).forEach((row: { sender_id: string }) => { if (row.sender_id) adviceCounts[row.sender_id] = (adviceCounts[row.sender_id] || 0) + 1; });
            const adviceIds = Object.keys(adviceCounts);
            if (adviceIds.length > 0) {
                const { data: adviceProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", adviceIds);
                setAdviceUsers((adviceProfiles || []).map((row: { id: string; name: string; avatar_url: string; is_active: boolean }) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: adviceCounts[row.id] || 0,
                })).sort((a, b) => b.points - a.points));
            }
            // ===== 学習コンテンツ完了数ランキング（承認済みのみ） =====
            const { data: learnAllRows } = await supabase.from("content_completions").select("user_id").eq("status", "approved");
            const learnCounts: { [id: string]: number } = {};
            (learnAllRows || []).forEach((row: { user_id: string }) => { if (row.user_id) learnCounts[row.user_id] = (learnCounts[row.user_id] || 0) + 1; });
            const learnIds = Object.keys(learnCounts);
            if (learnIds.length > 0) {
                const { data: learnProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", learnIds);
                setLearnUsers((learnProfiles || []).map((row: { id: string; name: string; avatar_url: string; is_active: boolean }) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: learnCounts[row.id] || 0,
                })).sort((a, b) => b.points - a.points));
            }
            // ===== 仕事完遂量ランキング（KKC + MTG + タスク + ルーティン連続） =====
            const workCounts: { [id: string]: number } = {};
            // 1. KKC（承認済み）
            const { data: kkcRows } = await supabase.from("problem_solutions").select("user_id").eq("status", "approved");
            (kkcRows || []).forEach((row: { user_id: string }) => { if (row.user_id) workCounts[row.user_id] = (workCounts[row.user_id] || 0) + 1; });
            // 2. MTG報告書（承認済み）
            const { data: mtgRows } = await supabase.from("mtg_reports").select("user_id").eq("status", "approved");
            (mtgRows || []).forEach((row: { user_id: string }) => { if (row.user_id) workCounts[row.user_id] = (workCounts[row.user_id] || 0) + 1; });
            // 3. 個人タスク（完了）
            const { data: personalTaskRows } = await supabase.from("personal_tasks").select("user_id").eq("is_done", true);
            (personalTaskRows || []).forEach((row: { user_id: string }) => { if (row.user_id) workCounts[row.user_id] = (workCounts[row.user_id] || 0) + 1; });
            // 4. adminタスク報告書（承認済み）
            const { data: taskReportRows } = await supabase.from("task_reports").select("user_id").eq("status", "approved");
            (taskReportRows || []).forEach((row: { user_id: string }) => { if (row.user_id) workCounts[row.user_id] = (workCounts[row.user_id] || 0) + 1; });
           // 5. ルーティン完遂個数（routine_checksのチェック数を合算）
            const { data: allRoutineChecksCount } = await supabase.from("routine_checks").select("user_id");
            (allRoutineChecksCount || []).forEach((row: { user_id: string }) => {
                if (row.user_id) workCounts[row.user_id] = (workCounts[row.user_id] || 0) + 1;
            });
            const workIds = Object.keys(workCounts);
            if (workIds.length > 0) {
                const { data: workProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", workIds);
                setWorkUsers((workProfiles || []).map((row: { id: string; name: string; avatar_url: string; is_active: boolean }) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: workCounts[row.id] || 0,
                })).sort((a, b) => b.points - a.points));
            }
           // ===== KPI達成率ランキング（今月、自分の部署のメインKPI） =====
            const now = new Date();
            const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            const { data: allProfilesKpi } = await supabase.from("profiles").select("id, name, avatar_url, is_active, department_id").eq("is_active", true);
            const { data: kpiThisMonth } = await supabase.from("monthly_kpi").select("user_id, department_id, target, result").eq("year_month", thisMonth);
            const kpiByUser: { [uid: string]: number } = {};
            (allProfilesKpi || []).forEach((p: { id: string; department_id: string | null }) => {
                if (!p.department_id) { kpiByUser[p.id] = 0; return; }
                const myKpi = (kpiThisMonth || []).find((k: { user_id: string; department_id: string; target: number; result: number }) => k.user_id === p.id && k.department_id === p.department_id);
                if (!myKpi || !myKpi.target || myKpi.target <= 0) { kpiByUser[p.id] = 0; return; }
                kpiByUser[p.id] = Math.round((myKpi.result / myKpi.target) * 100);
            });
            setKpiUsers((allProfilesKpi || []).map((row: { id: string; name: string; avatar_url: string; is_active: boolean }) => ({
                id: row.id,
                name: row.name,
                avatar_url: row.avatar_url,
                is_active: row.is_active,
                points: kpiByUser[row.id] || 0,
            })).sort((a, b) => b.points - a.points));
            // ===== 販売額ランキング（今月） =====
            const nowSales = new Date();
            const monthStart = `${nowSales.getFullYear()}-${String(nowSales.getMonth() + 1).padStart(2, "0")}-01`;
            const { data: salesMonthRows } = await supabase.from("sales").select("user_id, amount").gte("sale_date", monthStart);
            const salesMonthByUser: { [uid: string]: number } = {};
            (salesMonthRows || []).forEach((row: { user_id: string; amount: number }) => {
                if (row.user_id) salesMonthByUser[row.user_id] = (salesMonthByUser[row.user_id] || 0) + (row.amount || 0);
            });
            // ===== 販売額ランキング（累計） =====
            const { data: salesTotalRows } = await supabase.from("sales").select("user_id, amount");
            const salesTotalByUser: { [uid: string]: number } = {};
            (salesTotalRows || []).forEach((row: { user_id: string; amount: number }) => {
                if (row.user_id) salesTotalByUser[row.user_id] = (salesTotalByUser[row.user_id] || 0) + (row.amount || 0);
            });
            // 販売額ランキング用のプロフィール取得
            const salesIds = Array.from(new Set([...Object.keys(salesMonthByUser), ...Object.keys(salesTotalByUser)]));
            if (salesIds.length > 0) {
                const { data: salesProfiles } = await supabase.from("profiles").select("id, name, avatar_url, is_active").eq("is_active", true).in("id", salesIds);
                setSalesMonthUsers((salesProfiles || []).map((row: { id: string; name: string; avatar_url: string; is_active: boolean }) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: Math.round((salesMonthByUser[row.id] || 0) / 10000),
                })).filter(u => u.points > 0).sort((a, b) => b.points - a.points));
                setSalesTotalUsers((salesProfiles || []).map((row: { id: string; name: string; avatar_url: string; is_active: boolean }) => ({
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: Math.round((salesTotalByUser[row.id] || 0) / 10000),
                })).filter(u => u.points > 0).sort((a, b) => b.points - a.points));
            }
            // ===== 全丸(累計)ランキング =====
            const { data: maruRows } = await supabase
                .from("profiles")
                .select("id, name, avatar_url, is_active, total_maru_days")
                .eq("is_active", true)
                .gt("total_maru_days", 0)
                .order("total_maru_days", { ascending: false });
            setMaruTotalUsers((maruRows || []).map((row: any) => ({
                id: row.id,
                name: row.name,
                avatar_url: row.avatar_url,
                is_active: row.is_active,
                points: row.total_maru_days || 0,
            })));
            // ===== 就活市場ランクランキング =====
            const { data: jobRankRows } = await supabase
                .from("profiles")
                .select("id, name, avatar_url, is_active, rank_score_es, rank_score_personality, rank_score_interview, rank_score_education")
                .eq("is_active", true);
            setJobRankUsers((jobRankRows || []).map((row: any) => {
                const total = (row.rank_score_es || 0) + (row.rank_score_personality || 0) + (row.rank_score_interview || 0) + (row.rank_score_education || 0);
                return {
                    id: row.id,
                    name: row.name,
                    avatar_url: row.avatar_url,
                    is_active: row.is_active,
                    points: total,
                };
            }).filter(u => u.points > 0).sort((a, b) => b.points - a.points));
            // ===== チーム別 日報提出率ランキング（今週） =====
            // 1. teams取得
            const { data: teamsData } = await supabase.from("teams").select("id, name, color");
            // 2. team_idがあるプロフィール取得
            const { data: teamMemberProfiles } = await supabase.from("profiles").select("id, team_id").eq("is_active", true).not("team_id", "is", null);
            // 3. 今週のsubmissions取得
            const { data: subsData } = await supabase.from("submissions").select("user_id, created_at").gte("created_at", getOneWeekAgoISO()).order("created_at", { ascending: false }).limit(100000);

            // チームごとの集計
            const teams = teamsData || [];
            const members = teamMemberProfiles || [];
            const subs = subsData || [];

            const teamStats: RankingUser[] = teams.map((team: any) => {
                // チームメンバー
                const teamMemberIds = members.filter((m: any) => m.team_id === team.id).map((m: any) => m.id);
                const memberCount = teamMemberIds.length;

                // 想定提出数 = メンバー数 × 7日
                const expected = memberCount * 7;

                // 実際の提出: (user_id × 日付)の組み合わせをユニーク化
                const submittedPairs = new Set<string>();
                subs.forEach((s: any) => {
                    if (teamMemberIds.includes(s.user_id)) {
                        const ymd = getYmdJST(s.created_at);
                        submittedPairs.add(`${s.user_id}_${ymd}`);
                    }
                });
                const actual = submittedPairs.size;

                // 提出率（メンバー0の場合は0%）
                const rate = expected > 0 ? Math.round((actual / expected) * 100) : 0;

                return {
                    id: team.id,
                    name: team.name,
                    points: rate, // 提出率を points にマッピング
                    avatar_url: null,
                    color: team.color || "#6366f1",
                    subLabel: `${actual}/${expected}日 (${memberCount}名)`,
                    isTeam: true,
                };
            }).sort((a, b) => b.points - a.points);

            setTeamRanking(teamStats);
            setLoading(false);
        };
        loadRanking();
    }, [router]);

    const renderAvatar = (user: RankingUser, size: number) => {
        if (user.isTeam) {
            // チームの場合：チームカラーの円
            return (
                <div style={{ width: size, height: size, borderRadius: "50%", background: user.color || "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5, fontWeight: 700, color: "#fff" }}>
                    👥
                </div>
            );
        }
        if (user.avatar_url) {
            return <img src={user.avatar_url} alt={user.name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }} />;
        }
        return (
            <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, color: "#fff" }}>
                {user.name.charAt(0)}
            </div>
        );
    };

    const formatPoints = (user: RankingUser): string => {
        if (user.isTeam) return `${user.points}%`;
        if (activeTab === "streak") return `${user.points}日`;
        if (activeTab === "sankyu") return `${user.points}個`;
        if (activeTab === "sankyu_sent") return `${user.points}個`;
        if (activeTab === "challenge") return `${user.points}個`;
        if (activeTab === "thinking") return `${user.points}回`;
        if (activeTab === "question") return `${user.points}件`;
        if (activeTab === "ippon") return `${user.points}IPPON`;
        if (activeTab === "test") return `${user.points}個`;
        if (activeTab === "advice") return `${user.points}件`;
        if (activeTab === "learn") return `${user.points}個`;
        if (activeTab === "work") return `${user.points}個`;
        if (activeTab === "kpi") return `${user.points}%`;
        if (activeTab === "sales_month") return `${user.points.toLocaleString()}万円`;
        if (activeTab === "sales_total") return `${user.points.toLocaleString()}万円`;
        if (activeTab === "maru_total") return `${user.points}日`;
        if (activeTab === "pay_forward") return `${user.points}件`;
        if (activeTab === "job_rank") {
            const t = user.points;
            const r = t >= 17 ? "A" : t >= 13 ? "B" : t >= 9 ? "C" : t >= 5 ? "D" : "E";
            return `${t}pt（${r}）`;
        }
        return `${user.points.toLocaleString()}pt`;
    };

    const renderPodium = (list: RankingUser[]) => {
        const top3 = list.slice(0, 3);
        const podiumOrder = [1, 0, 2];
        const podiumColors = ["#f59e0b", "#c0c0c0", "#cd7f32"];
        const podiumHeights = [160, 110, 80];
        const medals = ["🥇", "🥈", "🥉"];

        return (
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 8 }}>
                    {podiumOrder.map((rank) => {
                        const user = top3[rank];
                        if (!user) return <div key={rank} style={{ width: 140 }} />;
                        const isMe = user.isTeam ? user.id === myTeamId : user.id === myId;
                        const color = podiumColors[rank];
                        const height = podiumHeights[rank];
                        const handleClick = () => {
                            if (!user.isTeam) router.push(`/profile/${user.id}`);
                        };

                        return (
                            <div key={rank} onClick={handleClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 140, cursor: user.isTeam ? "default" : "pointer", transition: "transform 0.2s" }} onMouseEnter={(e) => { if (!user.isTeam) e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}>
                                <div style={{ position: "relative", marginBottom: 8 }}>
                                    <div style={{ width: rank === 0 ? 80 : 64, height: rank === 0 ? 80 : 64, borderRadius: "50%", border: `3px solid ${color}`, overflow: "hidden", boxShadow: `0 0 20px ${color}50` }}>
                                        {renderAvatar(user, rank === 0 ? 80 : 64)}
                                    </div>
                                    <div style={{ position: "absolute", bottom: -4, right: -4, fontSize: rank === 0 ? 24 : 18 }}>{medals[rank]}</div>
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: isMe ? "#818cf8" : "#f9fafb", marginBottom: 2, textAlign: "center", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {user.name}{isMe && <span style={{ marginLeft: 4, fontSize: 10, color: "#6366f1" }}> {user.isTeam ? "MY TEAM" : "YOU"}</span>}
                                </div>
                                <div style={{ fontSize: rank === 0 ? 16 : 13, fontWeight: 800, color, marginBottom: 2 }}>
                                    {formatPoints(user)}
                                </div>
                                {user.subLabel && (
                                    <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 6 }}>{user.subLabel}</div>
                                )}
                                <div style={{ width: "100%", height, background: `linear-gradient(180deg, ${color}30, ${color}15)`, border: `1px solid ${color}50`, borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", justifyContent: "center", marginTop: user.subLabel ? 0 : 8 }}>
                                    <div style={{ fontSize: rank === 0 ? 36 : 28, fontWeight: 900, color: `${color}60` }}>{rank + 1}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div style={{ height: 3, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)", marginBottom: 24 }} />
            </div>
        );
    };

    const renderList = (list: RankingUser[]) => {
        const rest = list.slice(3);
        if (rest.length === 0) return null;
        return (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>4位以下</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {rest.map((user, i) => {
                        const isMe = user.isTeam ? user.id === myTeamId : user.id === myId;
                        const handleClick = () => {
                            if (!user.isTeam) router.push(`/profile/${user.id}`);
                        };
                        return (
                            <div key={user.id} onClick={handleClick} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 12, background: isMe ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)", border: isMe ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.05)", cursor: user.isTeam ? "default" : "pointer", transition: "background 0.2s" }} onMouseEnter={(e) => { if (!user.isTeam) e.currentTarget.style.background = isMe ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)"; }} onMouseLeave={(e) => (e.currentTarget.style.background = isMe ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)")}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ width: 28, textAlign: "center", fontSize: 13, color: "#6b7280", fontWeight: 700 }}>{i + 4}</div>
                                    <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                                        {renderAvatar(user, 36)}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: isMe ? "#818cf8" : "#f9fafb" }}>
                                            {user.name}
                                            {isMe && <span style={{ marginLeft: 8, fontSize: 10, color: "#6366f1", fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(99,102,241,0.2)" }}>{user.isTeam ? "MY TEAM" : "YOU"}</span>}
                                        </div>
                                        {user.subLabel && (
                                            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{user.subLabel}</div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: isMe ? "#818cf8" : "#d1d5db" }}>{formatPoints(user)}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

   const currentList = activeTab === "total" ? users : activeTab === "weekly" ? weeklyUsers : activeTab === "streak" ? streakUsers : activeTab === "sankyu" ? sankyuUsers : activeTab === "sankyu_sent" ? sankyuSentUsers : activeTab === "challenge" ? challengeUsers : activeTab === "test" ? testUsers : activeTab === "advice" ? adviceUsers : activeTab === "learn" ? learnUsers : activeTab === "work" ? workUsers : activeTab === "kpi" ? kpiUsers : activeTab === "sales_month" ? salesMonthUsers : activeTab === "sales_total" ? salesTotalUsers : activeTab === "maru_total" ? maruTotalUsers : activeTab === "job_rank" ? jobRankUsers : activeTab === "pay_forward" ? payForwardUsers : activeTab === "thinking" ? thinkingUsers : activeTab === "question" ? questionUsers : activeTab === "ippon" ? ipponUsers : teamRanking;

    return (
        <RankingView
            activeTab={activeTab}
            onTabChange={(k) => setActiveTab(k as any)}
            list={currentList}
            weeklyList={weeklyUsers}
            myId={myId}
            loading={loading}
            formatPoints={formatPoints}
            onQuest={() => router.push("/my-tasks")}
        />
    );
}
