
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TestResultsTab from "./components/TestResultsTab";
import { supabase } from "../lib/supabase";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

type UserRow = { id: string; name: string | null };
type TopUser = { name: string; points: number };
type TopSubmitter = { name: string; count: number };
type ReportRow = { id: string; user_id: string; content: string; created_at: string; userName?: string };
type UserDetail = {
    id: string; name: string; points: number; streak: number; role: string; editingName?: string; submissionCount: number; thanksCount: number; kpiCount: number; activeDays: number; education: string; mbti?: string; club_category?: string; hobby_category?: string; team_id?: string; avatar_url?: string; department_id?: string; deptName?: string; deptCode?: string; position?: string; growthStatus?: string; growthRank?: string;
    growthGrade?: string; onboardingDone?: boolean; createdAt?: string; approvedKpiCount?: number; kkcApprovedCount?: number; esUpdateCount?: number;
};
type GraphData = { date: string; points: number };
type SubmitGraphData = { date: string; count: number };
type AnnounceRow = { id: string; title: string; content: string; created_at: string; is_active: boolean };
type RequestRow = { id: string; user_id: string; shop_item_id: string; cost: number; status: string; note: string | null; created_at: string; userName?: string; itemTitle?: string };
type KpiStatus = { userId: string; userName: string; kpiId: string; kpiTitle: string; unit: string; target: number; value: number };
type ThanksRow = { id: string; from_user_id: string; to_user_id: string; message: string; created_at: string; fromName?: string; toName?: string };
type ContentCompletion = { id: string; userId: string; userName: string; contentId: string; contentTitle: string; created_at: string; status: string; review: string | null };
type Team = { id: string; name: string; color: string; leader_id?: string };
type Department = { id: string; name: string; code: string };
type MonthlyKpiRow = { id: string; user_id: string; department_id: string; year_month: string; target: number; result: number; approved: boolean; points_awarded: number; userName?: string; deptName?: string; officialTarget?: number; };
type DeptReport = { id: string; department_id: string; year_month: string; content: string; created_at: string; deptName?: string; };
type Resource = { id: string; title: string; description: string | null; resource_type: string; url: string | null; category: string | null; is_active: boolean; created_at: string; };
type Challenge = { id: string; title: string; description: string | null; category: string | null; points: number; icon: string; is_active: boolean; };
type ShopItem = { id: string; title: string; description: string; cost: number; category: string; };
type ChallengeSubmission = { id: string; user_id: string; challenge_id: string; comment: string | null; image_url: string | null; status: string; created_at: string; userName?: string; challengeTitle?: string; challengeIcon?: string; challengeCategory?: string; challengePoints?: number; };
type WikiTerm = { id: string; term: string; description: string; category: string | null; created_at: string; };
type CareerItem = { id: string; title: string; description: string | null; category: string; url: string | null; created_at: string; };

function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function formatDateTime(value: string): string {
    const date = new Date(value);
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return jst.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
// ============ シビュラシステム用マスター＆計算関数 ============
const MBTI_SCORES: Record<string, { cog: number; grit: number; social: number; drive: number; create: number }> = {
    "INTJ": { cog: 10, grit: 8, social: 3, drive: 2, create: 9 },
    "INTP": { cog: 10, grit: 6, social: 2, drive: 2, create: 10 },
    "ENTJ": { cog: 9, grit: 9, social: 7, drive: 8, create: 7 },
    "ENTP": { cog: 9, grit: 6, social: 7, drive: 8, create: 10 },
    "INFJ": { cog: 8, grit: 7, social: 8, drive: 3, create: 9 },
    "INFP": { cog: 7, grit: 5, social: 7, drive: 3, create: 10 },
    "ENFJ": { cog: 7, grit: 7, social: 10, drive: 7, create: 8 },
    "ENFP": { cog: 6, grit: 5, social: 9, drive: 9, create: 9 },
    "ISTJ": { cog: 7, grit: 9, social: 4, drive: 3, create: 3 },
    "ISFJ": { cog: 5, grit: 8, social: 7, drive: 3, create: 3 },
    "ESTJ": { cog: 7, grit: 9, social: 6, drive: 7, create: 4 },
    "ESFJ": { cog: 5, grit: 7, social: 9, drive: 6, create: 4 },
    "ISTP": { cog: 7, grit: 7, social: 3, drive: 9, create: 6 },
    "ISFP": { cog: 4, grit: 4, social: 6, drive: 6, create: 7 },
    "ESTP": { cog: 6, grit: 8, social: 7, drive: 10, create: 5 },
    "ESFP": { cog: 4, grit: 5, social: 9, drive: 10, create: 6 },
};

const CLUB_SCORES: Record<string, { grit: number; drive: number; social: number }> = {
    "野球部": { grit: 10, drive: 10, social: 9 },
    "体育会系（全国レベル）": { grit: 9, drive: 9, social: 7 },
    "体育会系（一般）": { grit: 8, drive: 7, social: 6 },
    "チームスポーツ系": { grit: 7, drive: 7, social: 8 },
    "個人競技系": { grit: 8, drive: 8, social: 3 },
    "文化部（発表系）": { grit: 6, drive: 5, social: 7 },
    "文化部（創作系）": { grit: 4, drive: 3, social: 3 },
    "帰宅部": { grit: 2, drive: 2, social: 2 },
};

const HOBBY_SCORES: Record<string, { cog: number; social: number; drive: number; create: number }> = {
    "読書・勉強": { cog: 9, social: 2, drive: 2, create: 5 },
    "ゲーム（戦略）": { cog: 8, social: 4, drive: 5, create: 5 },
    "ゲーム（アクション）": { cog: 4, social: 4, drive: 9, create: 3 },
    "スポーツ・運動": { cog: 3, social: 7, drive: 9, create: 3 },
    "音楽・楽器": { cog: 5, social: 6, drive: 5, create: 9 },
    "アート・創作": { cog: 5, social: 3, drive: 3, create: 10 },
    "旅行": { cog: 4, social: 7, drive: 5, create: 6 },
    "グルメ・食べ歩き": { cog: 3, social: 8, drive: 5, create: 5 },
    "映画・ドラマ鑑賞": { cog: 5, social: 4, drive: 2, create: 6 },
    "アウトドア": { cog: 3, social: 7, drive: 8, create: 4 },
    "SNS・配信": { cog: 5, social: 9, drive: 6, create: 7 },
};

function getEducationSibyl(education: string): { cog: number; grit: number } {
    if (!education) return { cog: 0, grit: 0 };
    const e = education;
    if (/東京大学|^東大|京都大学|^京大|大阪大学|^阪大|名古屋大学|^名大|東北大学|九州大学|^九大|北海道大学|^北大/.test(e)) return { cog: 10, grit: 6 };
    if (/早稲田|慶應|慶応|上智/.test(e)) return { cog: 9, grit: 5 };
    if (/学習院|明治大学|^明大|青山学院|立教|中央大学|^中大|法政/.test(e)) return { cog: 7, grit: 5 };
    if (/成城|成蹊|明治学院|獨協|國學院|国学院|武蔵大学|武蔵大/.test(e)) return { cog: 6, grit: 4 };
    if (/日本大学|^日大|東洋大学|^東洋|駒澤|駒沢|専修/.test(e)) return { cog: 5, grit: 4 };
    return { cog: 3, grit: 3 };
}

function calculateSibyl(params: { mbti: string; education: string; club: string; hobby: string }): { cog: number; grit: number; social: number; drive: number; create: number } {
    const m = MBTI_SCORES[params.mbti] || { cog: 0, grit: 0, social: 0, drive: 0, create: 0 };
    const e = getEducationSibyl(params.education);
    const c = CLUB_SCORES[params.club] || { grit: 0, drive: 0, social: 0 };
    const h = HOBBY_SCORES[params.hobby] || { cog: 0, social: 0, drive: 0, create: 0 };

    return {
        cog: Math.min(Math.round(m.cog * 0.5 + e.cog * 0.5 + h.cog * 0.3), 20),
        grit: Math.min(Math.round(m.grit * 0.5 + e.grit * 0.3 + c.grit * 0.8), 20),
        social: Math.min(Math.round(m.social * 0.8 + c.social * 0.4 + h.social * 0.4), 20),
        drive: Math.min(Math.round(m.drive * 0.8 + c.drive * 0.6 + h.drive * 0.4), 20),
        create: Math.min(Math.round(m.create * 1.0 + h.create * 0.8), 20),
    };
}

function calculateDepartmentMatch(s: { cog: number; grit: number; social: number; drive: number; create: number }): { dept: string; score: number }[] {
    const results = [
        { dept: "IP", score: s.grit * 2 + s.drive * 2 + s.social * 1 },
        { dept: "クローザー", score: s.social * 2 + s.drive * 2 + s.grit * 1 },
        { dept: "マネージャー", score: s.social * 2 + s.grit * 2 + s.cog * 1 },
        { dept: "コンサル", score: s.cog * 2 + s.create * 2 + s.social * 1 },
        { dept: "テレアポ", score: s.social * 2 + s.cog * 2 + s.create * 1 + s.grit * 1 },
        { dept: "人事", score: s.social * 2 + s.cog * 2 + s.create * 1 },
    ];
    results.sort((a, b) => b.score - a.score);
    const maxScore = results[0]?.score || 0;
    if (maxScore < 60) {
        results.push({ dept: "マーケ", score: Math.round((s.cog + s.create) * 2) });
    }
    return results;
}
// ============ シビュラシステムここまで ============
function getEducationScore(education: string): number {
    if (!education) return 0;
    const e = education;
    if (/東京大学|^東大|京都大学|^京大|大阪大学|^阪大|名古屋大学|^名大|東北大学|九州大学|^九大|北海道大学|^北大/.test(e)) return 10;
    if (/早稲田|慶應|慶応|上智/.test(e)) return 8;
    if (/学習院|明治大学|^明大|青山学院|立教|中央大学|^中大|法政/.test(e)) return 6;
    if (/成城|成蹊|明治学院|獨協|國學院|国学院|武蔵大学|武蔵大/.test(e)) return 5;
    if (/日本大学|^日大|東洋大学|^東洋|駒澤|駒沢|専修/.test(e)) return 4;
    return 2;
}
function getRankScore(params: { level: number; thanksCount: number; activeDays: number; education: string; approvedKpiCount: number; kkcApprovedCount: number; esUpdateCount: number; }): number {
    const { level, thanksCount, activeDays, education, approvedKpiCount, kkcApprovedCount, esUpdateCount } = params;
    const eduScore = getEducationScore(education);
    const activityScore = Math.min(activeDays * (15 / 730), 15);
    const kpiScore = Math.min(approvedKpiCount * 0.75, 15);
    const thinkingScore = Math.min(kkcApprovedCount, 20);
    const leaderScore = Math.min(Math.floor(thanksCount / 20), 10);
    const outputScore = Math.min(Math.floor(esUpdateCount / 10), 20);
    const metaScore = Math.min(level * (4 / 15), 10);
    return Math.min(Math.round(eduScore + activityScore + kpiScore + thinkingScore + leaderScore + outputScore + metaScore), 100);
}

function getRank(score: number): string {
    if (score >= 90) return "SS";
    if (score >= 80) return "S";
    if (score >= 70) return "A";
    if (score >= 60) return "B";
    if (score >= 50) return "C";
    return "D";
}

function getRankColor(rank: string): string {
    if (rank === "SS") return "#f59e0b";
    if (rank === "S") return "#a855f7";
    if (rank === "A") return "#6366f1";
    if (rank === "B") return "#06b6d4";
    if (rank === "C") return "#84cc16";
    return "#6b7280";
}
type MtgSession = { id: string; title: string; mtg_date: string; mtg_type: string; created_at: string; };
type MtgAttendance = { id: string; session_id: string; user_id: string; status: string; reason: string | null; userName?: string; };
export default function AdminPage() {
    const router = useRouter();
    const [userCount, setUserCount] = useState(0);
    const [reportCount, setReportCount] = useState(0);
    const [submitRate, setSubmitRate] = useState(0);
    const [topUsers, setTopUsers] = useState<TopUser[]>([]);
    const [topSubmitters, setTopSubmitters] = useState<TopSubmitter[]>([]);
    const [notSubmittedUsers, setNotSubmittedUsers] = useState<UserRow[]>([]);
    const [reports, setReports] = useState<ReportRow[]>([]);
    const [userDetails, setUserDetails] = useState<UserDetail[]>([]);
    const [pointGraphData, setPointGraphData] = useState<GraphData[]>([]);
    const [submitGraphData, setSubmitGraphData] = useState<SubmitGraphData[]>([]);
    const [copied, setCopied] = useState(false);
    const [period, setPeriod] = useState<"today" | "week" | "month">("today");
    const [loading, setLoading] = useState(true);
    const [expandedReport, setExpandedReport] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "announce" | "kpi" | "contents" | "requests" | "teams" | "monthly_kpi" | "dept_stats" | "resources" | "challenges" | "shop" | "mtg" | "wiki" | "career" | "manager_test" | "es" | "kkc" | "sibyl" | "tests">("dashboard");
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [editingPoints, setEditingPoints] = useState<number>(0);
    const [savingUser, setSavingUser] = useState<string | null>(null);
    const [announceTitle, setAnnounceTitle] = useState("");
    const [announceContent, setAnnounceContent] = useState("");
    const [announceList, setAnnounceList] = useState<AnnounceRow[]>([]);
    const [announceSending, setAnnounceSending] = useState(false);
    const [announceMessage, setAnnounceMessage] = useState("");
    const [editingAnnounceId, setEditingAnnounceId] = useState<string | null>(null);
    const [editAnnounceTitle, setEditAnnounceTitle] = useState("");
    const [editAnnounceContent, setEditAnnounceContent] = useState("");
    const [kpiItems, setKpiItems] = useState<{ id: string; title: string; unit: string; target_value: number; is_active: boolean }[]>([]);
    const [kpiTitle, setKpiTitle] = useState("");
    const [kpiUnit, setKpiUnit] = useState("件");
    const [kpiTarget, setKpiTarget] = useState(0);
    const [kpiSaving, setKpiSaving] = useState(false);
    const [kpiMessage, setKpiMessage] = useState("");
    const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
    const [editKpiTitle, setEditKpiTitle] = useState("");
    const [editKpiUnit, setEditKpiUnit] = useState("件");
    const [editKpiTarget, setEditKpiTarget] = useState(0);
    const [contentsList, setContentsList] = useState<{ id: string; title: string; description: string; content_type: string; url: string; body: string; is_active: boolean }[]>([]);
    const [contentTitle, setContentTitle] = useState("");
    const [contentDesc, setContentDesc] = useState("");
    const [contentType, setContentType] = useState<"video" | "article">("video");
    const [contentUrl, setContentUrl] = useState("");
    const [contentBody, setContentBody] = useState("");
    const [contentSaving, setContentSaving] = useState(false);
    const [contentMessage, setContentMessage] = useState("");
    const [editingContentId, setEditingContentId] = useState<string | null>(null);
    const [editContentTitle, setEditContentTitle] = useState("");
    const [editContentDesc, setEditContentDesc] = useState("");
    const [editContentUrl, setEditContentUrl] = useState("");
    const [editContentBody, setEditContentBody] = useState("");
    const [requestsList, setRequestsList] = useState<RequestRow[]>([]);
    const [processingRequest, setProcessingRequest] = useState<string | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [selectedDept, setSelectedDept] = useState<string>("all");
    const [showInactiveOnly, setShowInactiveOnly] = useState(false);
    const [allMonthlyKpis, setAllMonthlyKpis] = useState<MonthlyKpiRow[]>([]);
    const [monthlyKpis, setMonthlyKpis] = useState<MonthlyKpiRow[]>([]);
    const [kpiMonth, setKpiMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    });
    const [approvingKpi, setApprovingKpi] = useState<string | null>(null);
    const [targetInputs, setTargetInputs] = useState<Record<string, number>>({});
    const [monthlyTargets, setMonthlyTargets] = useState<{ user_id: string; department_id: string; year_month: string; target: number }[]>([]);
    const [teamName, setTeamName] = useState("");
    const [teamMessage, setTeamMessage] = useState("");
    const [teamSaving, setTeamSaving] = useState(false);
    const [kpiStatuses, setKpiStatuses] = useState<KpiStatus[]>([]);
    const [thanksList, setThanksList] = useState<ThanksRow[]>([]);
    const [contentCompletions, setContentCompletions] = useState<ContentCompletion[]>([]);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviting, setInviting] = useState(false);
    const [inviteMessage, setInviteMessage] = useState("");
    const [deptReports, setDeptReports] = useState<DeptReport[]>([]);
    const [reportDeptId, setReportDeptId] = useState("");
    const [reportMonth, setReportMonth] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; });
    const [reportContent, setReportContent] = useState("");
    const [reportSaving, setReportSaving] = useState(false);
    const [reportMessage, setReportMessage] = useState("");
    const [resources, setResources] = useState<Resource[]>([]);
    const [resourceTitle, setResourceTitle] = useState("");
    const [resourceDesc, setResourceDesc] = useState("");
    const [resourceType, setResourceType] = useState<"pdf" | "image" | "link">("link");
    const [resourceUrl, setResourceUrl] = useState("");
    const [resourceCategory, setResourceCategory] = useState("");
    const [resourceSaving, setResourceSaving] = useState(false);
    const [resourceMessage, setResourceMessage] = useState("");
    const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
    const [editResourceTitle, setEditResourceTitle] = useState("");
    const [editResourceDesc, setEditResourceDesc] = useState("");
    const [editResourceUrl, setEditResourceUrl] = useState("");
    const [editResourceCategory, setEditResourceCategory] = useState("");
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [problemCases, setProblemCases] = useState<any[]>([]);
    const [problemSolutions, setProblemSolutions] = useState<any[]>([]);
    const [challengeSubmissions, setChallengeSubmissions] = useState<ChallengeSubmission[]>([]);
    const [challengeTitle, setChallengeTitle] = useState("");
    const [challengeDesc, setChallengeDesc] = useState("");
    const [challengeCategory, setChallengeCategory] = useState("");
    const [challengePoints, setChallengePoints] = useState(10);
    const [challengeIcon, setChallengeIcon] = useState("🎯");
    const [challengeSaving, setChallengeSaving] = useState(false);
    const [challengeMessage, setChallengeMessage] = useState("");
    const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);
    const [editChallengeTitle, setEditChallengeTitle] = useState("");
    const [editChallengeDesc, setEditChallengeDesc] = useState("");
    const [editChallengeCategory, setEditChallengeCategory] = useState("");
    const [editChallengePoints, setEditChallengePoints] = useState(10);
    const [editChallengeIcon, setEditChallengeIcon] = useState("🎯");
    const [mtgSessions, setMtgSessions] = useState<MtgSession[]>([]);
    const [mtgAttendances, setMtgAttendances] = useState<MtgAttendance[]>([]);
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const [mtgTitle, setMtgTitle] = useState("");
    const [mtgDate, setMtgDate] = useState("");
    const [mtgType, setMtgType] = useState<"monthly" | "special">("monthly");
    const [mtgSaving, setMtgSaving] = useState(false);
    const [mtgMessage, setMtgMessage] = useState("");
    const [wikiTerms, setWikiTerms] = useState<WikiTerm[]>([]);
    const [wikiTerm, setWikiTerm] = useState("");
    const [wikiDesc, setWikiDesc] = useState("");
    const [wikiCategory, setWikiCategory] = useState("");
    const [wikiSaving, setWikiSaving] = useState(false);
    const [wikiMessage, setWikiMessage] = useState("");
    const [wikiSearch, setWikiSearch] = useState("");
    const [editingWikiId, setEditingWikiId] = useState<string | null>(null);
    const [editWikiTerm, setEditWikiTerm] = useState("");
    const [editWikiDesc, setEditWikiDesc] = useState("");
    const [editWikiCategory, setEditWikiCategory] = useState("");
    const [shopItems, setShopItems] = useState<ShopItem[]>([]);
    const [shopTitle, setShopTitle] = useState("");
    const [shopDesc, setShopDesc] = useState("");
    const [shopCost, setShopCost] = useState(100);
    const [shopCategory, setShopCategory] = useState("");
    const [shopSaving, setShopSaving] = useState(false);
    const [shopMessage, setShopMessage] = useState("");
    const [editingShopId, setEditingShopId] = useState<string | null>(null);
    const [editShopTitle, setEditShopTitle] = useState("");
    const [editShopDesc, setEditShopDesc] = useState("");
    const [editShopCost, setEditShopCost] = useState(100);
    const [editShopCategory, setEditShopCategory] = useState("");
    const [careerItems, setCareerItems] = useState<CareerItem[]>([]);
    const [careerTitle, setCareerTitle] = useState("");
    const [careerDesc, setCareerDesc] = useState("");
    const [careerCategory, setCareerCategory] = useState("");
    const [careerUrl, setCareerUrl] = useState("");
    const [careerSaving, setCareerSaving] = useState(false);
    const [careerMessage, setCareerMessage] = useState("");
    const [careerSearch, setCareerSearch] = useState("");
    const [editingCareerId, setEditingCareerId] = useState<string | null>(null);
    const [editCareerTitle, setEditCareerTitle] = useState("");
    const [editCareerDesc, setEditCareerDesc] = useState("");
    const [editCareerCategory, setEditCareerCategory] = useState("");
    const [editCareerUrl, setEditCareerUrl] = useState("");
    const [managerTests, setManagerTests] = useState<any[]>([]);
    const [managerTestDetail, setManagerTestDetail] = useState<Record<string, { choices: any[]; written: any[] }>>({});
    const [managerTestFilter, setManagerTestFilter] = useState<"pending" | "all">("pending");
    const [esList, setEsList] = useState<any[]>([]);
    const [selectedEsUserId, setSelectedEsUserId] = useState<string | null>(null);

    // ✅ Fix 1: useEffect は load 関数を内部定義して即呼び出す正しい構造
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map(e => e.trim());
            if (!user.email || !adminEmails.includes(user.email)) { router.push("/mypage"); return; }

            const { data: profileRows } = await supabase.from("profiles").select("id, name, role, streak, started_at, education, department_id, team_id, avatar_url, growth_rank, growth_grade, growth_status, mbti, club_category, hobby_category, onboarding_done, created_at, position");
            const users = (profileRows || []) as UserRow[];
            setUserCount(users.length);

            const { data: pointRows } = await supabase.from("user_points").select("id, points, total_earned");
            const { data: thanksSentRows } = await supabase.from("thanks").select("to_user_id");
            const { data: kpiLogRows } = await supabase.from("kpi_logs").select("user_id");
            const { data: subCountRows } = await supabase.from("submissions").select("user_id");

            const { data: deptRows } = await supabase.from("departments").select("*");
            setDepartments((deptRows || []) as Department[]);

            const details: UserDetail[] = (profileRows || []).map((p: any) => {
                const activeDays = p.started_at ? Math.floor((Date.now() - new Date(p.started_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                return {
                    id: p.id,
                    name: p.name || "名前未設定",
                    points: pointRows?.find((pt: any) => pt.id === p.id)?.total_earned || pointRows?.find((pt: any) => pt.id === p.id)?.points || 0,
                    streak: p.streak || 0,
                    role: p.role || "Owner",
                    submissionCount: subCountRows?.filter((r: any) => r.user_id === p.id).length || 0,
                    thanksCount: thanksSentRows?.filter((r: any) => r.to_user_id === p.id).length || 0,
                    kpiCount: kpiLogRows?.filter((r: any) => r.user_id === p.id).length || 0,
                    activeDays,
                    education: p.education || "",
                    mbti: p.mbti || "",
                    club_category: p.club_category || "",
                    hobby_category: p.hobby_category || "",
                    team_id: p.team_id || "",
                    avatar_url: p.avatar_url || null,
                    department_id: p.department_id || "",
                    deptName: deptRows?.find((d: any) => d.id === p.department_id)?.name || "",
                    deptCode: deptRows?.find((d: any) => d.id === p.department_id)?.code || "",
                    position: p.position || "",
                    growthStatus: p.growth_status || "Onboarding",
                    growthRank: p.growth_rank || "",
                    growthGrade: p.growth_grade || "",
                    onboardingDone: p.onboarding_done || false,
                    createdAt: p.created_at || "",
                    approvedKpiCount: 0,
                    kkcApprovedCount: 0,
                    esUpdateCount: 0,
                };
            });
            setUserDetails(details);

            const { data: allHistory } = await supabase.from("points_history").select("change, created_at").order("created_at", { ascending: true }).limit(200);
            if (allHistory) {
                const dayMap: Record<string, number> = {};
                allHistory.forEach((item) => {
                    const date = new Date(item.created_at);
                    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
                    const key = `${jst.getUTCMonth() + 1}/${jst.getUTCDate()}`;
                    dayMap[key] = (dayMap[key] || 0) + item.change;
                });
                let cum = 0;
                setPointGraphData(Object.entries(dayMap).map(([date, pts]) => { cum += pts; return { date, points: cum }; }));
            }

            const now = new Date();
            const from = new Date();
            if (period === "week") from.setDate(now.getDate() - 7);
            else if (period === "month") from.setMonth(now.getMonth() - 1);
            const todayYmd = getTodayJST();

            const { data: submissionRows } = period === "today"
                ? await supabase.from("submissions").select("id, user_id, content, created_at").gte("created_at", `${todayYmd}T00:00:00`).order("created_at", { ascending: false })
                : await supabase.from("submissions").select("id, user_id, content, created_at").gte("created_at", from.toISOString()).order("created_at", { ascending: false });

            const submissions = submissionRows || [];
            const submittedIds = [...new Set(submissions.map((row) => row.user_id))];
            setReportCount(submittedIds.length);
            setSubmitRate(users.length === 0 ? 0 : Math.round((submittedIds.length / users.length) * 100));
            setNotSubmittedUsers(users.filter((u) => !submittedIds.includes(u.id)));
            setReports(submissions.map((row) => ({ ...row, userName: users.find((u) => u.id === row.user_id)?.name || "名前未設定" })));

            const submitDayMap: Record<string, number> = {};
            submissions.forEach((row) => {
                const date = new Date(row.created_at);
                const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
                const key = `${jst.getUTCMonth() + 1}/${jst.getUTCDate()}`;
                submitDayMap[key] = (submitDayMap[key] || 0) + 1;
            });
            setSubmitGraphData(Object.entries(submitDayMap).map(([date, count]) => ({ date, count })));

            const top3Point = [...(pointRows || [])].sort((a, b) => b.points - a.points).slice(0, 3);
            const { data: pointProfiles } = await supabase.from("profiles").select("id, name").in("id", top3Point.map((u) => u.id));
            setTopUsers(top3Point.map((row) => ({ name: pointProfiles?.find((p) => p.id === row.id)?.name || "名前未設定", points: row.points || 0 })));

            const countMap: Record<string, number> = {};
            submissions.forEach((row) => { countMap[row.user_id] = (countMap[row.user_id] || 0) + 1; });
            setTopSubmitters(Object.entries(countMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, count]) => ({ name: users.find((u) => u.id === id)?.name || "名前未設定", count })));

            const { data: announceRows } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
            setAnnounceList((announceRows || []) as AnnounceRow[]);

            const { data: kpiRows } = await supabase.from("kpi_items").select("*").order("created_at", { ascending: false });
            setKpiItems(kpiRows || []);

            const { data: contentsRows } = await supabase.from("contents").select("*").order("created_at", { ascending: false });
            setContentsList(contentsRows || []);

            const { data: shopItemRows } = await supabase.from("shop_items").select("*").order("cost", { ascending: true });
            setShopItems((shopItemRows || []) as ShopItem[]);
            const { data: shopItems } = await supabase.from("shop_items").select("id, title");
            const { data: reqRows } = await supabase.from("point_requests").select("*").order("created_at", { ascending: false });
            setRequestsList((reqRows || []).map((r: any) => ({
                ...r,
                userName: users.find(u => u.id === r.user_id)?.name || "名前未設定",
                itemTitle: shopItems?.find((s: any) => s.id === r.shop_item_id)?.title || "不明",
            })));

            const { data: kpiLogs } = await supabase.from("kpi_logs").select("*").order("created_at", { ascending: false });
            if (kpiLogs && kpiRows) {
                const statuses: KpiStatus[] = kpiLogs.map((log: any) => ({
                    userId: log.user_id,
                    userName: users.find(u => u.id === log.user_id)?.name || "名前未設定",
                    kpiId: log.kpi_item_id,
                    kpiTitle: kpiRows.find((k: any) => k.id === log.kpi_item_id)?.title || "不明",
                    unit: kpiRows.find((k: any) => k.id === log.kpi_item_id)?.unit || "件",
                    target: kpiRows.find((k: any) => k.id === log.kpi_item_id)?.target_value || 0,
                    value: log.value,
                }));
                setKpiStatuses(statuses);
            }

            const { data: thanksRows } = await supabase.from("thanks").select("*").order("created_at", { ascending: false }).limit(20);
            if (thanksRows) {
                setThanksList(thanksRows.map((r: any) => ({
                    ...r,
                    fromName: users.find(u => u.id === r.from_user_id)?.name || "名前未設定",
                    toName: users.find(u => u.id === r.to_user_id)?.name || "名前未設定",
                })));
            }

            const { data: completionRows } = await supabase.from("content_completions").select("*").order("created_at", { ascending: false });
            if (completionRows && contentsRows) {
                setContentCompletions(completionRows.map((r: any) => ({
                    id: r.id,
                    userId: r.user_id,
                    userName: users.find(u => u.id === r.user_id)?.name || "名前未設定",
                    contentId: r.content_id,
                    contentTitle: contentsRows.find((c: any) => c.id === r.content_id)?.title || "不明",
                    created_at: r.created_at,
                    status: r.status || "pending",
                    review: r.review || null,
                })));
            }

            const { data: teamRows } = await supabase.from("teams").select("*").order("created_at");
            setTeams((teamRows || []) as Team[]);

            const { data: allMonthlyKpiRows } = await supabase.from("monthly_kpi").select("*").order("year_month", { ascending: false });
            const { data: allTargetRows } = await supabase.from("monthly_targets").select("*");
            setMonthlyTargets((allTargetRows || []) as { user_id: string; department_id: string; year_month: string; target: number }[]);

            const enrichedAll = (allMonthlyKpiRows || []).map((k: any) => ({
                ...k,
                userName: users.find(u => u.id === k.user_id)?.name || "名前未設定",
                deptName: deptRows?.find((d: any) => d.id === k.department_id)?.name || "不明",
            }));
            setAllMonthlyKpis(enrichedAll);

            const now2 = new Date();
            const currentYm = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, "0")}`;
            setMonthlyKpis(enrichedAll.filter((k: any) => k.year_month === currentYm));

            const { data: deptReportRows } = await supabase.from("dept_reports").select("*").order("year_month", { ascending: false });
            setDeptReports((deptReportRows || []).map((r: any) => ({
                ...r,
                deptName: deptRows?.find((d: any) => d.id === r.department_id)?.name || "不明",
            })));

            const { data: resourceRows } = await supabase.from("resources").select("*").order("created_at", { ascending: false });
            setResources((resourceRows || []) as Resource[]);

            const { data: challengeRows } = await supabase.from("challenges").select("*").order("created_at");
            setChallenges((challengeRows || []) as Challenge[]);

            const { data: pcRows } = await supabase.from("problem_cases").select("*").order("created_at", { ascending: false });
            setProblemCases(pcRows || []);
            const { data: psRows } = await supabase.from("problem_solutions").select("*").order("created_at", { ascending: false });
            setProblemSolutions(psRows || []);

            const { data: challengeSubRows } = await supabase.from("challenge_submissions").select("*").order("created_at", { ascending: false });
            setChallengeSubmissions((challengeSubRows || []).map((s: any) => ({
                ...s,
                userName: users.find(u => u.id === s.user_id)?.name || "名前未設定",
                challengeTitle: (challengeRows || [])?.find((c: any) => c.id === s.challenge_id)?.title || "不明なチャレンジ",
                challengeIcon: (challengeRows || [])?.find((c: any) => c.id === s.challenge_id)?.icon || "🎯",
                challengeCategory: (challengeRows || [])?.find((c: any) => c.id === s.challenge_id)?.category || "",
                challengePoints: (challengeRows || [])?.find((c: any) => c.id === s.challenge_id)?.points || 0,
            })) as ChallengeSubmission[]);
            const { data: mtgSessionRows } = await supabase.from("mtg_sessions").select("*").order("mtg_date", { ascending: false });
            setMtgSessions((mtgSessionRows || []) as MtgSession[]);
            const { data: wikiRows } = await supabase.from("wiki_terms").select("*").order("category").order("term");
            setWikiTerms((wikiRows || []) as WikiTerm[]);
            const { data: careerRows } = await supabase.from("career_items").select("*").order("category").order("created_at", { ascending: false });
            setCareerItems((careerRows || []) as CareerItem[]);
            // マネージャーテスト（提出済み一覧）
            const { data: testRows } = await supabase.from("manager_tests").select("*").eq("status", "submitted").order("submitted_at", { ascending: false });
            if (testRows && testRows.length > 0) {
                const testsWithUsers = await Promise.all((testRows as any[]).map(async (t: any) => {
                    const { data: prof } = await supabase.from("profiles").select("name").eq("id", t.user_id).single();
                    return { ...t, userName: (prof as any)?.name || "名前未設定" };
                }));
                setManagerTests(testsWithUsers);

                const detailMap: Record<string, { choices: any[]; written: any[] }> = {};
                for (const test of testsWithUsers) {
                    const { data: choices } = await supabase.from("manager_test_choice_answers").select("*").eq("test_id", test.id).order("question_num");
                    const { data: written } = await supabase.from("manager_test_written_answers").select("*").eq("test_id", test.id).order("question_num");
                    detailMap[test.id] = { choices: choices || [], written: written || [] };
                }
                setManagerTestDetail(detailMap);
            }
            // 総合ES一覧
            const { data: esRows } = await supabase.from("user_es").select("*").order("last_updated_at", { ascending: false });
            if (esRows && esRows.length > 0) {
                const esWithUsers = await Promise.all((esRows as any[]).map(async (e: any) => {
                    const { data: prof } = await supabase.from("profiles").select("name").eq("id", e.user_id).single();
                    return { ...e, userName: (prof as any)?.name || "名前未設定" };
                }));
                setEsList(esWithUsers);
            }
            setLoading(false);
        };
        // ✅ Fix 2: load() の呼び出しは useEffect コールバック内、load 定義の直後
        load();
    }, [period, router]);

    useEffect(() => {
        setMonthlyKpis(allMonthlyKpis.filter(k => k.year_month === kpiMonth));
    }, [kpiMonth, allMonthlyKpis]);

    const handleSaveUser = async (userId: string) => {
        setSavingUser(userId);
        const u = userDetails.find(u2 => u2.id === userId);
        if (!u) return;
        const newName = (u.editingName ?? u.name).trim();
        if (newName) await supabase.from("profiles").update({ name: newName }).eq("id", userId);
        await supabase.from("user_points").update({ points: editingPoints }).eq("id", userId);
        await supabase.from("points_history").insert({ user_id: userId, change: 0, reason: "admin_edit", created_at: new Date().toISOString() });
        setUserDetails((prev) => prev.map((u2) => u2.id === userId ? { ...u2, name: newName, points: editingPoints } : u2));
        setEditingUser(null);
        setSavingUser(null);
    };

    const handleAddPoints = async (userId: string, amount: number) => {
        const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", userId).single();
        const current = pointRow?.points || 0;
        await supabase.from("user_points").update({ points: current + amount }).eq("id", userId);
        await supabase.from("points_history").insert({ user_id: userId, change: amount, reason: "manual_add", created_at: new Date().toISOString() });
        setUserDetails(prev => prev.map(u => u.id === userId ? { ...u, points: current + amount } : u));
    };

    const handleCreateTeam = async () => {
        if (!teamName.trim()) { setTeamMessage("チーム名を入力してください"); return; }
        setTeamSaving(true);
        const colors = ["#6366f1", "#f59e0b", "#34d399", "#ec4899", "#06b6d4", "#f97316"];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        await supabase.from("teams").insert({ name: teamName.trim(), color: randomColor });
        const { data: rows } = await supabase.from("teams").select("*").order("created_at");
        setTeams((rows || []) as Team[]);
        setTeamName("");
        setTeamMessage("✅ チームを作成しました！");
        setTeamSaving(false);
    };

    const handleApproveKpi = async (kpi: MonthlyKpiRow) => {
        setApprovingKpi(kpi.id);
        const nowIso = new Date().toISOString();
        await supabase.from("monthly_kpi").update({ approved: true, approved_at: nowIso, points_awarded: kpi.points_awarded }).eq("id", kpi.id);

        const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", kpi.user_id).single();
        const current = pointRow?.points || 0;
        await supabase.from("user_points").update({ points: current + kpi.points_awarded }).eq("id", kpi.user_id);
        await supabase.from("points_history").insert({ user_id: kpi.user_id, change: kpi.points_awarded, reason: "kpi_achievement", created_at: nowIso });

        const rate = kpi.target > 0 ? Math.round((kpi.result / kpi.target) * 100) : 0;
        if (rate >= 100) {
            const { data: profileRow } = await supabase.from("profiles").select("team_id").eq("id", kpi.user_id).single();
            const teamId = profileRow?.team_id;
            if (teamId) {
                const team = teams.find(t => t.id === teamId);
                const isLeader = team?.leader_id === kpi.user_id;
                const bonusPt = isLeader ? 10 : 3;

                const { data: bonusPointRow } = await supabase.from("user_points").select("points").eq("id", kpi.user_id).single();
                const bonusCurrent = bonusPointRow?.points || 0;
                await supabase.from("user_points").update({ points: bonusCurrent + bonusPt }).eq("id", kpi.user_id);
                await supabase.from("points_history").insert({ user_id: kpi.user_id, change: bonusPt, reason: "team_achievement", created_at: nowIso });
            }
        }

        setMonthlyKpis(prev => prev.map(k => k.id === kpi.id ? { ...k, approved: true } : k));
        setAllMonthlyKpis(prev => prev.map(k => k.id === kpi.id ? { ...k, approved: true } : k));
        setApprovingKpi(null);
    };

    const handleSetTarget = async (userId: string, deptId: string, target: number) => {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("monthly_targets").upsert({ user_id: userId, department_id: deptId, year_month: kpiMonth, target, set_by: user?.id }, { onConflict: "user_id,department_id,year_month" });
    };

    const handleAssignTeam = async (userId: string, teamId: string) => {
        await supabase.from("profiles").update({ team_id: teamId || null }).eq("id", userId);
        setUserDetails(prev => prev.map(u => u.id === userId ? { ...u, team_id: teamId } : u));
    };

    const handleInvite = async () => {
        if (!inviteEmail.trim()) { setInviteMessage("メールアドレスを入力してください"); return; }
        setInviting(true);
        setInviteMessage("");
        const res = await fetch("/api/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail.trim() }) });
        const data = await res.json();
        if (data.error) { setInviteMessage("招待に失敗しました: " + data.error); } else { setInviteMessage(`✅ ${inviteEmail} に招待メールを送信しました！`); setInviteEmail(""); }
        setInviting(false);
    };

    const handlePostAnnounce = async () => {
        if (!announceTitle.trim() || !announceContent.trim()) { setAnnounceMessage("タイトルと内容を入力してください"); return; }
        setAnnounceSending(true);
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("announcements").insert({ title: announceTitle.trim(), content: announceContent.trim(), created_by: user?.id, is_active: true });
        const { data: rows } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
        setAnnounceList((rows || []) as AnnounceRow[]);
        setAnnounceTitle(""); setAnnounceContent("");
        setAnnounceMessage("✅ 投稿しました！");
        setAnnounceSending(false);
    };

    const handlePostKpi = async () => {
        if (!kpiTitle.trim()) { setKpiMessage("KPI名を入力してください"); return; }
        setKpiSaving(true);
        await supabase.from("kpi_items").insert({ title: kpiTitle.trim(), unit: kpiUnit || "件", target_value: kpiTarget, is_active: true });
        const { data: rows } = await supabase.from("kpi_items").select("*").order("created_at", { ascending: false });
        setKpiItems(rows || []);
        setKpiTitle(""); setKpiUnit("件"); setKpiTarget(0);
        setKpiMessage("✅ KPI項目を追加しました！");
        setKpiSaving(false);
    };

    const handleApproveRequest = async (req: RequestRow, approve: boolean) => {
        setProcessingRequest(req.id);
        const nowIso = new Date().toISOString();
        await supabase.from("point_requests").update({ status: approve ? "approved" : "rejected", updated_at: nowIso }).eq("id", req.id);
        if (approve) {
            const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", req.user_id).single();
            const current = pointRow?.points || 0;
            await supabase.from("user_points").update({ points: current - req.cost }).eq("id", req.user_id);
            await supabase.from("points_history").insert({ user_id: req.user_id, change: -req.cost, reason: "shop_purchase", created_at: nowIso });
        }
        setRequestsList(prev => prev.map(r => r.id === req.id ? { ...r, status: approve ? "approved" : "rejected" } : r));
        setProcessingRequest(null);
    };

    const periodLabel = period === "today" ? "今日" : period === "week" ? "今週" : "今月";
    const copyText = useMemo(() => notSubmittedUsers.map((u) => u.name || "名前未設定").join("\n"), [notSubmittedUsers]);
    const reminderText = useMemo(() => `${periodLabel}の日報が未提出の方へ\n\n${notSubmittedUsers.map((u) => `・${u.name || "名前未設定"}`).join("\n")}\n\n確認のうえ、ご対応をお願いいたします。`, [notSubmittedUsers, periodLabel]);
    const rankMedals = ["🥇", "🥈", "🥉"];
    const pendingCount = requestsList.filter(r => r.status === "pending").length;
    // ===== ハイブリッドダッシュボード用の集計 =====
    const dashboardStats = useMemo(() => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        // アクティブ：7日以内に何かしらアクションあり
        const activeUserCount = userDetails.filter(u => u.submissionCount > 0).length;

        // 3日以上未提出 = 直近3日に提出がない人（簡易判定: submissionCount=0）
        const inactive3Days = userDetails.filter(u => {
            if (!u.createdAt) return false;
            const accountAge = Date.now() - new Date(u.createdAt).getTime();
            return accountAge > 3 * 24 * 60 * 60 * 1000 && u.submissionCount === 0;
        }).length;

        // 未承認の申請
        const pendingRequests = requestsList.filter(r => r.status === "pending").length;
        const pendingChallenges = challengeSubmissions.filter(s => s.status === "pending").length;
        const pendingKkc = problemSolutions.filter(s => s.status === "pending").length;

        // 今月のKPI達成率（事業部別）
        const now = new Date();
        const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const thisMonthKpis = allMonthlyKpis.filter(k => k.year_month === currentYm);
        const kpiAchievementRate = (() => {
            if (thisMonthKpis.length === 0) return 0;
            const rates = thisMonthKpis.map(k => {
                const officialTarget = monthlyTargets.find(t => t.user_id === k.user_id && t.department_id === k.department_id && t.year_month === currentYm)?.target || k.target;
                return officialTarget > 0 ? Math.round((k.result / officialTarget) * 100) : 0;
            });
            return Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
        })();

        // KPI60%以下のメンバー
        const lowKpiUsers = (() => {
            const userRates: { userId: string; userName: string; rate: number }[] = [];
            const userIds = [...new Set(thisMonthKpis.map(k => k.user_id))];
            userIds.forEach(uid => {
                const userKpis = thisMonthKpis.filter(k => k.user_id === uid);
                const rates = userKpis.map(k => {
                    const officialTarget = monthlyTargets.find(t => t.user_id === k.user_id && t.department_id === k.department_id && t.year_month === currentYm)?.target || k.target;
                    return officialTarget > 0 ? Math.round((k.result / officialTarget) * 100) : 0;
                });
                const avgRate = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
                if (avgRate < 60 && avgRate > 0) {
                    const u = userDetails.find(u => u.id === uid);
                    if (u) userRates.push({ userId: uid, userName: u.name, rate: avgRate });
                }
            });
            return userRates;
        })();

        // 今週のサンキュー数
        const weeklyThanks = thanksList.filter(t => new Date(t.created_at) > oneWeekAgo).length;
        const lastWeekThanks = thanksList.filter(t => {
            const d = new Date(t.created_at);
            return d > twoWeeksAgo && d < oneWeekAgo;
        }).length;
        const thanksDelta = weeklyThanks - lastWeekThanks;

        // 今週の合格者
        const weeklyTestPasses = (() => {
            // userDetails には quiz_passed_at 等がないので、簡易的に算出
            // ここはダミー（後で正確なロジックに置き換え可能）
            return 0;
        })();

        // 部署別KPI達成率
        const deptStats = departments.map(dept => {
            const deptKpis = thisMonthKpis.filter(k => k.department_id === dept.id);
            const rates = deptKpis.map(k => {
                const officialTarget = monthlyTargets.find(t => t.user_id === k.user_id && t.department_id === k.department_id && t.year_month === currentYm)?.target || k.target;
                return officialTarget > 0 ? Math.round((k.result / officialTarget) * 100) : 0;
            });
            const avgRate = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
            return { id: dept.id, name: dept.name, rate: avgRate, count: deptKpis.length };
        });

        // KPI100%超え事業部
        const topDept = deptStats.filter(d => d.rate >= 100).sort((a, b) => b.rate - a.rate)[0];

        return {
            activeUserCount,
            inactive3Days,
            pendingRequests,
            pendingChallenges,
            pendingKkc,
            kpiAchievementRate,
            lowKpiUsers,
            weeklyThanks,
            thanksDelta,
            weeklyTestPasses,
            deptStats,
            topDept,
        };
    }, [userDetails, requestsList, challengeSubmissions, problemSolutions, allMonthlyKpis, monthlyTargets, thanksList, departments]);
    const filteredUsers = useMemo(() => {
        const sorted = [...userDetails].sort((a, b) => b.points - a.points);
        let result = selectedDept === "all" ? sorted : sorted.filter(u => u.department_id === selectedDept);
        if (showInactiveOnly) {
            const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
            result = result.filter(u => {
                const registeredLongAgo = u.createdAt && (Date.now() - new Date(u.createdAt).getTime()) > oneWeekMs;
                const noReports = u.submissionCount === 0;
                const onboardingIncomplete = !u.onboardingDone;
                return (registeredLongAgo && noReports) || onboardingIncomplete;
            });
        }
        return result;
    }, [userDetails, selectedDept, showInactiveOnly]);

    const deptStats = useMemo(() => {
        const deptIds = [...new Set(allMonthlyKpis.map(k => k.department_id))];
        return deptIds.map(deptId => {
            const deptKpis = allMonthlyKpis.filter(k => k.department_id === deptId);
            const deptName = deptKpis[0]?.deptName || "不明";
            const months = [...new Set(deptKpis.map(k => k.year_month))].sort();
            const monthlyStats = months.map(ym => {
                const ymKpis = deptKpis.filter(k => k.year_month === ym);
                const rates = ymKpis.map(k => {
                    const officialTarget = monthlyTargets.find(t => t.user_id === k.user_id && t.department_id === k.department_id && t.year_month === k.year_month)?.target || k.target;
                    return officialTarget > 0 ? Math.round((k.result / officialTarget) * 100) : 0;
                });
                const avgRate = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
                const achievedCount = rates.filter(r => r >= 100).length;
                return { ym, avgRate, achievedCount, total: ymKpis.length, approved: ymKpis.filter(k => k.approved).length };
            });
            const overallAvg = monthlyStats.length > 0 ? Math.round(monthlyStats.reduce((sum, m) => sum + m.avgRate, 0) / monthlyStats.length) : 0;
            return { deptId, deptName, monthlyStats, overallAvg };
        }).sort((a, b) => b.overallAvg - a.overallAvg);
    }, [allMonthlyKpis, monthlyTargets]);

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    return (
        <main style={{ minHeight: "100vh", background: "#0a0a0f", padding: "40px 24px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.06) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto" }}>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                    <div>
                        <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>INTERN QUEST</div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f9fafb", margin: "4px 0 0" }}>管理ダッシュボード</h1>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => router.push("/mypage")} style={{ background: "rgba(255,255,255,0.05)", color: "#d1d5db", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>マイページ</button>
                        <button onClick={() => router.push("/ranking")} style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", padding: "8px 16px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>ランキング</button>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                    {[
                        { key: "dashboard", label: "ダッシュボード" },
                        { key: "users", label: "ユーザー一覧" },
                        { key: "announce", label: "お知らせ" },
                        { key: "kpi", label: "KPI設定" },
                        { key: "contents", label: "コンテンツ" },
                        { key: "teams", label: "チーム" },
                        { key: "monthly_kpi", label: "月次KPI" },
                        { key: "dept_stats", label: "部署別成績" },
                        { key: "resources", label: "資料管理" },
                        { key: "challenges", label: "チャレンジ" },
                        { key: "shop", label: "ショップ" },
                        { key: "mtg", label: "MTG管理" },
                        { key: "wiki", label: "用語集" },
                        { key: "career", label: "就活ボックス" },
                        { key: "es", label: "総合ES" },
                        { key: "kkc", label: "KKC" },
                        { key: "sibyl", label: "シビュラ" },
                        { key: "tests", label: "テスト結果" },

                        { key: "requests", label: `申請${pendingCount > 0 ? `(${pendingCount})` : ""}` },
                    ].map((tab) => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer", fontSize: 12, background: activeTab === tab.key ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : tab.key === "requests" && pendingCount > 0 ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.05)", color: activeTab === tab.key ? "#fff" : tab.key === "requests" && pendingCount > 0 ? "#fbbf24" : "#9ca3af" }}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === "users" && (
                    <div>
                        <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 16, padding: 24, marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>📧 新規メンバー招待</div>
                            <div style={{ display: "flex", gap: 12 }}>
                                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleInvite()} placeholder="招待するメールアドレス" type="email" style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none" }} />
                                <button onClick={handleInvite} disabled={inviting} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: inviting ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: inviting ? "not-allowed" : "pointer", fontSize: 14, whiteSpace: "nowrap" }}>
                                    {inviting ? "送信中..." : "招待を送る"}
                                </button>
                            </div>
                            {inviteMessage && <div style={{ marginTop: 12, fontSize: 13, color: inviteMessage.includes("✅") ? "#34d399" : "#f87171", fontWeight: 600 }}>{inviteMessage}</div>}
                        </div>

                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2 }}>
                                    USER MANAGEMENT <span style={{ color: "#818cf8", marginLeft: 8 }}>{filteredUsers.length}人</span>
                                </div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    <button onClick={() => setShowInactiveOnly(!showInactiveOnly)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", fontWeight: 700, cursor: "pointer", fontSize: 12, background: showInactiveOnly ? "linear-gradient(135deg, #ef4444, #f87171)" : "rgba(239,68,68,0.1)", color: showInactiveOnly ? "#fff" : "#f87171" }}>⚠️ 未活動層のみ</button>
                                    <button onClick={() => setSelectedDept("all")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer", fontSize: 12, background: selectedDept === "all" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: selectedDept === "all" ? "#fff" : "#9ca3af" }}>全員</button>
                                    {departments.map(dept => (
                                        <button key={dept.id} onClick={() => setSelectedDept(dept.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer", fontSize: 12, background: selectedDept === dept.id ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: selectedDept === dept.id ? "#fff" : "#9ca3af" }}>{dept.name}</button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {filteredUsers.map((u, i) => {
                                    const level = Math.max(1, Math.floor(u.points / 100) + 1);
                                    const score = getRankScore({ level, thanksCount: u.thanksCount, activeDays: u.activeDays, education: u.education, approvedKpiCount: u.approvedKpiCount || 0, kkcApprovedCount: u.kkcApprovedCount || 0, esUpdateCount: u.esUpdateCount || 0 });
                                    const rank = getRank(score);
                                    const rankColor = getRankColor(rank);
                                    return (
                                        <div key={u.id} style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                            {editingUser === u.id ? (
                                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                            <span style={{ fontSize: 12, color: "#6b7280" }}>名前:</span>
                                                            <input type="text" value={u.editingName ?? u.name} onChange={(e) => setUserDetails(prev => prev.map(u2 => u2.id === u.id ? { ...u2, editingName: e.target.value } : u2))} style={{ width: 160, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.1)", color: "#f9fafb", fontSize: 14, outline: "none" }} />
                                                        </div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                            <span style={{ fontSize: 12, color: "#6b7280" }}>ポイント:</span>
                                                            <input type="number" value={editingPoints} onChange={(e) => setEditingPoints(Number(e.target.value))} style={{ width: 100, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.1)", color: "#f9fafb", fontSize: 14, outline: "none" }} />
                                                        </div>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 8 }}>
                                                        <button onClick={() => handleSaveUser(u.id)} disabled={savingUser === u.id} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{savingUser === u.id ? "保存中..." : "保存"}</button>
                                                        <button onClick={() => setEditingUser(null)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 12, cursor: "pointer" }}>キャンセル</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                                    {u.avatar_url ? (
                                                        <img src={u.avatar_url} alt={u.name} style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(99,102,241,0.4)", flexShrink: 0 }} />
                                                    ) : (
                                                        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{u.name.charAt(0)}</div>
                                                    )}
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                                            <span style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb" }}>{u.name}</span>
                                                            {u.deptName && <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)", fontSize: 11, color: "#06b6d4", fontWeight: 600 }}>{u.deptName}</span>}
                                                            {u.education && <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>🎓 {u.education}</span>}
                                                        </div>
                                                        <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6b7280" }}>
                                                            <span>🔥 {u.streak}日連続</span>
                                                            <span>📋 {u.submissionCount}件</span>
                                                            <span>🎉 {u.thanksCount}件</span>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                        <div style={{ textAlign: "center" }}>
                                                            <div style={{ width: 40, height: 40, borderRadius: 10, background: rankColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#fff" }}>{rank}</div>
                                                            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{score}pt</div>
                                                        </div>
                                                        <div style={{ textAlign: "right" }}>
                                                            <div style={{ fontSize: 20, fontWeight: 800, color: "#818cf8" }}>{u.points.toLocaleString()}pt</div>
                                                            <div style={{ fontSize: 11, color: "#6b7280" }}>{i + 1}位</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 4 }}>
                                                        {(u.deptCode === "CB" || u.deptCode === "SP") ? (
                                                            <select
                                                                value={u.position || ""}
                                                                onChange={async (e) => {
                                                                    const val = e.target.value;
                                                                    await supabase.from("profiles").update({ position: val || null }).eq("id", u.id);
                                                                    setUserDetails(prev => prev.map(u2 => u2.id === u.id ? { ...u2, position: val } : u2));
                                                                }}
                                                                style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${u.position ? "rgba(236,72,153,0.5)" : "rgba(251,191,36,0.4)"}`, background: u.position ? "rgba(236,72,153,0.1)" : "rgba(251,191,36,0.08)", color: u.position ? "#f9fafb" : "#fbbf24", fontSize: 12, outline: "none", cursor: "pointer", fontWeight: 700 }}
                                                            >
                                                                <option value="">⚠️ 未設定</option>
                                                                <option value="appointer">📞 アポ</option>
                                                                <option value="closer">💼 クロ</option>
                                                            </select>
                                                        ) : (
                                                            <div style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", color: "#6b7280", fontSize: 11, fontWeight: 600 }}>─</div>
                                                        )}
                                                        <select
                                                            value={u.growthRank || ""}
                                                            onChange={async (e) => {
                                                                const val = e.target.value;
                                                                await supabase.from("profiles").update({ growth_rank: val }).eq("id", u.id);
                                                                setUserDetails(prev => prev.map(u2 => u2.id === u.id ? { ...u2, growthRank: val } : u2));
                                                            }}
                                                            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#1a1a2e", color: "#f9fafb", fontSize: 12, outline: "none", cursor: "pointer" }}
                                                        >
                                                            <option value="">ランク</option>
                                                            {["S1", "S2", "S3", "S4", "P1", "P2", "P3", "P4"].map(r => (
                                                                <option key={r} value={r}>{r}</option>
                                                            ))}
                                                        </select>
                                                        <select
                                                            value={u.growthGrade || ""}
                                                            onChange={async (e) => {
                                                                const val = e.target.value;
                                                                await supabase.from("profiles").update({ growth_grade: val }).eq("id", u.id);
                                                                setUserDetails(prev => prev.map(u2 => u2.id === u.id ? { ...u2, growthGrade: val } : u2));
                                                            }}
                                                            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#1a1a2e", color: "#f9fafb", fontSize: 12, outline: "none", cursor: "pointer" }}
                                                        >
                                                            <option value="">グレード</option>
                                                            <option value="Junior">Junior</option>
                                                            <option value="Middle">Middle</option>
                                                            <option value="Senior">Senior</option>
                                                        </select>
                                                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                                            <button onClick={() => router.push(`/admin/user/${u.id}`)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.1)", color: "#818cf8", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>詳細</button>
                                                            {[10, 50, 100].map(amount => (
                                                                <button key={amount} onClick={() => handleAddPoints(u.id, amount)} style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "rgba(52,211,153,0.15)", color: "#34d399", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>+{amount}</button>
                                                            ))}
                                                            <button onClick={() => { setEditingUser(u.id); setEditingPoints(u.points); setUserDetails(prev => prev.map(u2 => u2.id === u.id ? { ...u2, editingName: u.name } : u2)); }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#d1d5db", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>編集</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "announce" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>NEW ANNOUNCEMENT</div>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>タイトル</div>
                                <input value={announceTitle} onChange={(e) => setAnnounceTitle(e.target.value)} placeholder="例：今週のMTGについて" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>内容</div>
                                <textarea value={announceContent} onChange={(e) => setAnnounceContent(e.target.value)} placeholder="お知らせの内容を入力してください..." style={{ width: "100%", height: 120, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                            </div>
                            <button onClick={handlePostAnnounce} disabled={announceSending} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                                {announceSending ? "投稿中..." : "📢 投稿する"}
                            </button>
                            {announceMessage && <div style={{ marginTop: 12, fontSize: 13, color: "#34d399" }}>{announceMessage}</div>}
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>ANNOUNCEMENTS</div>
                            {announceList.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>お知らせはありません</div> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {announceList.map((item) => (
                                        <div key={item.id} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${item.is_active ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)"}` }}>
                                            {editingAnnounceId === item.id ? (
                                                /* ===== 編集モード ===== */
                                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                                    <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>📝 編集中</div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>タイトル</div>
                                                        <input value={editAnnounceTitle} onChange={(e) => setEditAnnounceTitle(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>内容</div>
                                                        <textarea value={editAnnounceContent} onChange={(e) => setEditAnnounceContent(e.target.value)} style={{ width: "100%", height: 120, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                                                    </div>
                                                    <div style={{ display: "flex", gap: 8 }}>
                                                        <button onClick={async () => {
                                                            await supabase.from("announcements").update({
                                                                title: editAnnounceTitle.trim(),
                                                                content: editAnnounceContent.trim(),
                                                            }).eq("id", item.id);
                                                            setAnnounceList(prev => prev.map(a => a.id === item.id ? { ...a, title: editAnnounceTitle.trim(), content: editAnnounceContent.trim() } : a));
                                                            setEditingAnnounceId(null);
                                                        }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>💾 保存</button>
                                                        <button onClick={() => setEditingAnnounceId(null)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>キャンセル</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* ===== 通常モード ===== */
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: 14, fontWeight: 700, color: item.is_active ? "#f9fafb" : "#6b7280", marginBottom: 4 }}>{item.title}</div>
                                                        <div style={{ fontSize: 13, color: item.is_active ? "#9ca3af" : "#4b5563", lineHeight: 1.6 }}>{item.content}</div>
                                                        <div style={{ fontSize: 11, color: "#4b5563", marginTop: 6 }}>{formatDateTime(item.created_at)}</div>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 6, marginLeft: 12 }}>
                                                        <button onClick={() => {
                                                            setEditingAnnounceId(item.id);
                                                            setEditAnnounceTitle(item.title || "");
                                                            setEditAnnounceContent(item.content || "");
                                                        }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 11, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                            ✏️ 編集
                                                        </button>
                                                        <button onClick={async () => { await supabase.from("announcements").update({ is_active: !item.is_active }).eq("id", item.id); setAnnounceList(prev => prev.map(a => a.id === item.id ? { ...a, is_active: !a.is_active } : a)); }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: item.is_active ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)", color: item.is_active ? "#f87171" : "#34d399", fontSize: 11, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                            {item.is_active ? "非表示" : "表示する"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "kpi" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>NEW KPI ITEM</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px", gap: 12, marginBottom: 16 }}>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>KPI名</div>
                                    <input value={kpiTitle} onChange={(e) => setKpiTitle(e.target.value)} placeholder="例：架電数" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>単位</div>
                                    <input value={kpiUnit} onChange={(e) => setKpiUnit(e.target.value)} placeholder="件" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>目標値</div>
                                    <input type="number" value={kpiTarget} onChange={(e) => setKpiTarget(Number(e.target.value))} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                </div>
                            </div>
                            <button onClick={handlePostKpi} disabled={kpiSaving} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                                {kpiSaving ? "追加中..." : "📊 追加する"}
                            </button>
                            {kpiMessage && <div style={{ marginTop: 12, fontSize: 13, color: "#34d399" }}>{kpiMessage}</div>}
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>KPI ITEMS</div>
                            {kpiItems.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>KPI項目がありません</div> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {kpiItems.map((item) => (
                                        <div key={item.id} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${item.is_active ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)"}` }}>
                                            {editingKpiId === item.id ? (
                                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                                    <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>📝 編集中</div>
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px", gap: 8 }}>
                                                        <div>
                                                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>KPI名</div>
                                                            <input value={editKpiTitle} onChange={(e) => setEditKpiTitle(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>単位</div>
                                                            <input value={editKpiUnit} onChange={(e) => setEditKpiUnit(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>目標値</div>
                                                            <input type="number" value={editKpiTarget} onChange={(e) => setEditKpiTarget(Number(e.target.value))} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                        </div>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 8 }}>
                                                        <button onClick={async () => {
                                                            await supabase.from("kpi_items").update({
                                                                title: editKpiTitle.trim(),
                                                                unit: editKpiUnit.trim() || "件",
                                                                target_value: editKpiTarget,
                                                            }).eq("id", item.id);
                                                            setKpiItems(prev => prev.map(k => k.id === item.id ? { ...k, title: editKpiTitle.trim(), unit: editKpiUnit.trim() || "件", target_value: editKpiTarget } : k));
                                                            setEditingKpiId(null);
                                                        }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>💾 保存</button>
                                                        <button onClick={() => setEditingKpiId(null)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>キャンセル</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <div>
                                                        <div style={{ fontSize: 14, fontWeight: 700, color: item.is_active ? "#f9fafb" : "#6b7280" }}>{item.title}</div>
                                                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>単位: {item.unit}　目標: {item.target_value}{item.unit}</div>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 6 }}>
                                                        <button onClick={() => {
                                                            setEditingKpiId(item.id);
                                                            setEditKpiTitle(item.title || "");
                                                            setEditKpiUnit(item.unit || "件");
                                                            setEditKpiTarget(item.target_value || 0);
                                                        }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                                                            ✏️ 編集
                                                        </button>
                                                        <button onClick={async () => { await supabase.from("kpi_items").update({ is_active: !item.is_active }).eq("id", item.id); setKpiItems(prev => prev.map(k => k.id === item.id ? { ...k, is_active: !k.is_active } : k)); }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: item.is_active ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)", color: item.is_active ? "#f87171" : "#34d399", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                                                            {item.is_active ? "無効にする" : "有効にする"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "contents" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>NEW CONTENT</div>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>タイプ</div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button onClick={() => setContentType("video")} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer", fontSize: 13, background: contentType === "video" ? "linear-gradient(135deg, #ef4444, #f97316)" : "rgba(255,255,255,0.05)", color: contentType === "video" ? "#fff" : "#9ca3af" }}>▶️ 動画</button>
                                    <button onClick={() => setContentType("article")} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer", fontSize: 13, background: contentType === "article" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: contentType === "article" ? "#fff" : "#9ca3af" }}>📄 記事</button>
                                </div>
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>タイトル</div>
                                <input value={contentTitle} onChange={(e) => setContentTitle(e.target.value)} placeholder="例：営業の基本" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>説明</div>
                                <input value={contentDesc} onChange={(e) => setContentDesc(e.target.value)} placeholder="簡単な説明" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                            </div>
                            {contentType === "video" && (
                                <div style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>YouTube URL</div>
                                    <input value={contentUrl} onChange={(e) => setContentUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                </div>
                            )}
                            {contentType === "article" && (
                                <div style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: 600 }}>本文</div>
                                    <textarea value={contentBody} onChange={(e) => setContentBody(e.target.value)} placeholder="記事の内容を書いてください..." style={{ width: "100%", height: 160, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                                </div>
                            )}
                            <button onClick={async () => {
                                if (!contentTitle.trim()) { setContentMessage("タイトルを入力してください"); return; }
                                setContentSaving(true);
                                const { data: { user } } = await supabase.auth.getUser();
                                await supabase.from("contents").insert({ title: contentTitle.trim(), description: contentDesc.trim(), content_type: contentType, url: contentUrl.trim() || null, body: contentBody.trim() || null, is_active: true, created_by: user?.id });
                                const { data: rows } = await supabase.from("contents").select("*").order("created_at", { ascending: false });
                                setContentsList(rows || []);
                                setContentTitle(""); setContentDesc(""); setContentUrl(""); setContentBody("");
                                setContentMessage("✅ コンテンツを追加しました！");
                                setContentSaving(false);
                            }} disabled={contentSaving} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                                {contentSaving ? "追加中..." : "📚 追加する"}
                            </button>
                            {contentMessage && <div style={{ marginTop: 12, fontSize: 13, color: "#34d399" }}>{contentMessage}</div>}
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2 }}>📝 レビュー承認</div>
                                <div style={{ fontSize: 12, color: "#fbbf24", fontWeight: 600 }}>審査中: {contentCompletions.filter(c => c.status === "pending" && c.review).length}件</div>
                            </div>
                            {contentCompletions.filter(c => c.status === "pending" && c.review).length === 0 ? (
                                <div style={{ color: "#6b7280", fontSize: 14 }}>審査中のレビューはありません</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {contentCompletions.filter(c => c.status === "pending" && c.review).map((c) => (
                                        <div key={c.id} style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                                        <span style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>{c.userName}</span>
                                                        <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(99,102,241,0.2)", color: "#818cf8", fontSize: 11, fontWeight: 600 }}>{c.contentTitle}</span>
                                                    </div>
                                                    <div style={{ fontSize: 13, color: "#c7d2fe", padding: "10px 14px", borderRadius: 8, background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)" }}>{c.review}</div>
                                                </div>
                                                <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 16 }}>
                                                    <button onClick={async () => {
                                                        const nowIso = new Date().toISOString();
                                                        await supabase.from("content_completions").update({ status: "approved" }).eq("id", c.id);
                                                        const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", c.userId).single();
                                                        const current = (pointRow as any)?.points || 0;
                                                        await supabase.from("user_points").update({ points: current + 2 }).eq("id", c.userId);
                                                        await supabase.from("points_history").insert({ user_id: c.userId, change: 2, reason: "content_complete", created_at: nowIso });
                                                        setContentCompletions(prev => prev.map(cc => cc.id === c.id ? { ...cc, status: "approved" } : cc));
                                                    }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #10b981, #34d399)", color: "#0a0a0f", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✅ 承認 +2pt</button>
                                                    <button onClick={async () => {
                                                        await supabase.from("content_completions").update({ status: "rejected" }).eq("id", c.id);
                                                        setContentCompletions(prev => prev.map(cc => cc.id === c.id ? { ...cc, status: "rejected" } : cc));
                                                    }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "rgba(248,113,113,0.2)", color: "#f87171", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>❌ 却下</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>CONTENTS</div>
                            {contentsList.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>コンテンツがありません</div> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {contentsList.map((item) => (
                                        <div key={item.id} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${item.is_active ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)"}` }}>
                                            {editingContentId === item.id ? (
                                                /* ===== 編集モード ===== */
                                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                                    <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>📝 編集中</div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>タイトル</div>
                                                        <input value={editContentTitle} onChange={(e) => setEditContentTitle(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>説明</div>
                                                        <input value={editContentDesc} onChange={(e) => setEditContentDesc(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                    </div>
                                                    {item.content_type === "video" && (
                                                        <div>
                                                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>YouTube URL</div>
                                                            <input value={editContentUrl} onChange={(e) => setEditContentUrl(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                        </div>
                                                    )}
                                                    {item.content_type === "article" && (
                                                        <div>
                                                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>本文</div>
                                                            <textarea value={editContentBody} onChange={(e) => setEditContentBody(e.target.value)} style={{ width: "100%", height: 140, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                                                        </div>
                                                    )}
                                                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                                                        <button onClick={async () => {
                                                            await supabase.from("contents").update({
                                                                title: editContentTitle.trim(),
                                                                description: editContentDesc.trim(),
                                                                url: editContentUrl.trim() || null,
                                                                body: editContentBody.trim() || null,
                                                            }).eq("id", item.id);
                                                            setContentsList(prev => prev.map(c => c.id === item.id ? { ...c, title: editContentTitle.trim(), description: editContentDesc.trim(), url: editContentUrl.trim(), body: editContentBody.trim() } : c));
                                                            setEditingContentId(null);
                                                        }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>💾 保存</button>
                                                        <button onClick={() => setEditingContentId(null)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>キャンセル</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* ===== 通常モード ===== */
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                            <span>{item.content_type === "video" ? "▶️" : "📄"}</span>
                                                            <span style={{ fontSize: 14, fontWeight: 700, color: item.is_active ? "#f9fafb" : "#6b7280" }}>{item.title}</span>
                                                        </div>
                                                        {item.description && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{item.description}</div>}
                                                    </div>
                                                    <div style={{ display: "flex", gap: 6 }}>
                                                        <button onClick={() => {
                                                            setEditingContentId(item.id);
                                                            setEditContentTitle(item.title || "");
                                                            setEditContentDesc(item.description || "");
                                                            setEditContentUrl(item.url || "");
                                                            setEditContentBody(item.body || "");
                                                        }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 11, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                            ✏️ 編集
                                                        </button>
                                                        <button onClick={async () => { await supabase.from("contents").update({ is_active: !item.is_active }).eq("id", item.id); setContentsList(prev => prev.map(c => c.id === item.id ? { ...c, is_active: !c.is_active } : c)); }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: item.is_active ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)", color: item.is_active ? "#f87171" : "#34d399", fontSize: 11, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                            {item.is_active ? "非表示" : "表示する"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "requests" && (
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>POINT REQUESTS</div>
                        {requestsList.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>申請はありません</div> : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {requestsList.map((req) => (
                                    <div key={req.id} style={{ padding: "16px 20px", borderRadius: 12, background: req.status === "pending" ? "rgba(251,191,36,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${req.status === "pending" ? "rgba(251,191,36,0.3)" : req.status === "approved" ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}` }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                                    <span style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>{req.userName}</span>
                                                    <span style={{ fontSize: 12, color: "#6b7280" }}>→</span>
                                                    <span style={{ fontSize: 14, fontWeight: 600, color: "#c7d2fe" }}>{req.itemTitle}</span>
                                                </div>
                                                <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6b7280" }}>
                                                    <span>{req.cost} pt</span>
                                                    <span>{formatDateTime(req.created_at)}</span>
                                                    {req.note && <span>備考: {req.note}</span>}
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                {req.status === "pending" ? (
                                                    <>
                                                        <button onClick={() => handleApproveRequest(req, true)} disabled={processingRequest === req.id} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #10b981, #34d399)", color: "#0a0a0f", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✅ 承認</button>
                                                        <button onClick={() => handleApproveRequest(req, false)} disabled={processingRequest === req.id} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "rgba(248,113,113,0.2)", color: "#f87171", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>❌ 却下</button>
                                                    </>
                                                ) : (
                                                    <div style={{ padding: "6px 14px", borderRadius: 8, background: req.status === "approved" ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)", color: req.status === "approved" ? "#34d399" : "#f87171", fontSize: 13, fontWeight: 700 }}>
                                                        {req.status === "approved" ? "✅ 承認済" : "❌ 却下"}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "teams" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>👥 新規チーム作成</div>
                            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                                <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="代理店名を入力（例：〇〇代理店）" style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none" }} />
                                <button onClick={handleCreateTeam} disabled={teamSaving} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                                    {teamSaving ? "作成中..." : "作成"}
                                </button>
                            </div>
                            {teamMessage && <div style={{ fontSize: 13, color: "#34d399", fontWeight: 600 }}>{teamMessage}</div>}
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>メンバー割り当て</div>
                            {teams.length === 0 ? (
                                <div style={{ color: "#6b7280", fontSize: 14 }}>チームがありません。先にチームを作成してください。</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {userDetails.map((u) => (
                                        <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                {u.avatar_url ? (
                                                    <img src={u.avatar_url} alt={u.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", border: "2px solid rgba(99,102,241,0.4)" }} />
                                                ) : (
                                                    <div style={{ width: 36, height: 36, borderRadius: 8, background: teams.find(t => t.id === u.team_id)?.color || "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>{u.name.charAt(0)}</div>
                                                )}
                                                <div style={{ fontSize: 14, fontWeight: 600, color: "#f9fafb" }}>{u.name}</div>
                                            </div>
                                            <select value={u.team_id || ""} onChange={(e) => handleAssignTeam(u.id, e.target.value)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#1a1a2e", color: "#f9fafb", fontSize: 13, outline: "none", cursor: "pointer" }}>
                                                <option value="">チームなし</option>
                                                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                            </select>
                                            <button
                                                onClick={async () => {
                                                    const userTeam = teams.find(t => t.id === u.team_id);
                                                    if (!userTeam) return;
                                                    await supabase.from("teams").update({ leader_id: u.id }).eq("id", userTeam.id);
                                                    setTeams(prev => prev.map(t => t.id === userTeam.id ? { ...t, leader_id: u.id } : t));
                                                }}
                                                style={{
                                                    padding: "6px 12px", borderRadius: 8, border: "none",
                                                    background: teams.find(t => t.id === u.team_id)?.leader_id === u.id ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.05)",
                                                    color: teams.find(t => t.id === u.team_id)?.leader_id === u.id ? "#f59e0b" : "#6b7280",
                                                    fontSize: 12, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap"
                                                }}
                                            >
                                                {teams.find(t => t.id === u.team_id)?.leader_id === u.id ? "👑 リーダー" : "リーダーにする"}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>🏆 チームランキング</div>
                            {teams.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>チームがありません</div> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {teams.map((team) => {
                                        const members = userDetails.filter(u => u.team_id === team.id);
                                        const totalPoints = members.reduce((sum, u) => sum + u.points, 0);
                                        return { ...team, members, totalPoints };
                                    }).sort((a, b) => b.totalPoints - a.totalPoints).map((team, i) => (
                                        <div key={team.id} style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${team.color}40` }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: team.color }} />
                                                    <span style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb" }}>{["🥇", "🥈", "🥉"][i] || `${i + 1}.`} {team.name}</span>
                                                    <span style={{ fontSize: 12, color: "#6b7280" }}>{team.members.length}人</span>
                                                </div>
                                                <span style={{ fontSize: 20, fontWeight: 800, color: team.color }}>{team.totalPoints.toLocaleString()}pt</span>
                                            </div>
                                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                {team.members.map(m => (
                                                    <div key={m.id} style={{ padding: "4px 10px", borderRadius: 6, background: `${team.color}20`, border: `1px solid ${team.color}40`, fontSize: 12, color: "#d1d5db" }}>{m.name} {m.points}pt</div>
                                                ))}
                                                {team.members.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>メンバーなし</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "dashboard" && (
                    <>
                        {/* ========== 📊 今週のサマリー ========== */}
                        <div style={{ marginBottom: 32, padding: "24px", borderRadius: 16, background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))", border: "1px solid rgba(99,102,241,0.2)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                <div style={{ fontSize: 14, fontWeight: 800, color: "#f9fafb", letterSpacing: 1 }}>📊 今週のサマリー</div>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>3秒で状況把握</div>
                            </div>

                            {/* スコアカード（4枚） */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                                <div style={{ padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, marginBottom: 6 }}>アクティブ</div>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: "#818cf8", lineHeight: 1 }}>{dashboardStats.activeUserCount}人</div>
                                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>全{userCount}人中</div>
                                </div>
                                <div style={{ padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, marginBottom: 6 }}>日報提出率</div>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: submitRate >= 80 ? "#34d399" : submitRate >= 50 ? "#f59e0b" : "#f87171", lineHeight: 1 }}>{submitRate}%</div>
                                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{periodLabel}基準</div>
                                </div>
                                <div style={{ padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, marginBottom: 6 }}>KPI達成率</div>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: dashboardStats.kpiAchievementRate >= 100 ? "#34d399" : dashboardStats.kpiAchievementRate >= 80 ? "#f59e0b" : "#f87171", lineHeight: 1 }}>{dashboardStats.kpiAchievementRate}%</div>
                                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>今月平均</div>
                                </div>
                                <div style={{ padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, marginBottom: 6 }}>サンキュー</div>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: "#fbbf24", lineHeight: 1 }}>{dashboardStats.weeklyThanks}件</div>
                                    <div style={{ fontSize: 11, color: dashboardStats.thanksDelta >= 0 ? "#34d399" : "#f87171", marginTop: 4 }}>
                                        {dashboardStats.thanksDelta >= 0 ? "↑" : "↓"} 前週比{dashboardStats.thanksDelta >= 0 ? "+" : ""}{dashboardStats.thanksDelta}
                                    </div>
                                </div>
                            </div>

                            {/* 🔴 要対応セクション */}
                            {(dashboardStats.inactive3Days > 0 || dashboardStats.pendingRequests > 0 || dashboardStats.pendingChallenges > 0 || dashboardStats.pendingKkc > 0) && (
                                <div style={{ marginBottom: 16, padding: "16px 20px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>🔴 要対応</div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {dashboardStats.inactive3Days > 0 && (
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "rgba(0,0,0,0.2)" }}>
                                                <span style={{ fontSize: 13, color: "#d1d5db" }}>3日以上未提出のメンバー</span>
                                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                    <span style={{ fontSize: 14, fontWeight: 700, color: "#f87171" }}>{dashboardStats.inactive3Days}人</span>
                                                    <button onClick={() => { setActiveTab("users"); setShowInactiveOnly(true); }} style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "rgba(239,68,68,0.2)", color: "#f87171", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>確認 →</button>
                                                </div>
                                            </div>
                                        )}
                                        {dashboardStats.pendingRequests > 0 && (
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "rgba(0,0,0,0.2)" }}>
                                                <span style={{ fontSize: 13, color: "#d1d5db" }}>未承認のショップ申請</span>
                                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                    <span style={{ fontSize: 14, fontWeight: 700, color: "#f87171" }}>{dashboardStats.pendingRequests}件</span>
                                                    <button onClick={() => setActiveTab("requests")} style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "rgba(239,68,68,0.2)", color: "#f87171", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>処理する →</button>
                                                </div>
                                            </div>
                                        )}
                                        {dashboardStats.pendingChallenges > 0 && (
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "rgba(0,0,0,0.2)" }}>
                                                <span style={{ fontSize: 13, color: "#d1d5db" }}>承認待ちチャレンジ</span>
                                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                    <span style={{ fontSize: 14, fontWeight: 700, color: "#f87171" }}>{dashboardStats.pendingChallenges}件</span>
                                                    <button onClick={() => setActiveTab("challenges")} style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "rgba(239,68,68,0.2)", color: "#f87171", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>確認 →</button>
                                                </div>
                                            </div>
                                        )}
                                        {dashboardStats.pendingKkc > 0 && (
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "rgba(0,0,0,0.2)" }}>
                                                <span style={{ fontSize: 13, color: "#d1d5db" }}>KKC審査待ち</span>
                                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                    <span style={{ fontSize: 14, fontWeight: 700, color: "#f87171" }}>{dashboardStats.pendingKkc}件</span>
                                                    <button onClick={() => setActiveTab("kkc")} style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "rgba(239,68,68,0.2)", color: "#f87171", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>審査 →</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 🟡 要注意セクション */}
                            {dashboardStats.lowKpiUsers.length > 0 && (
                                <div style={{ marginBottom: 16, padding: "16px 20px", borderRadius: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>🟡 要注意</div>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "rgba(0,0,0,0.2)" }}>
                                        <span style={{ fontSize: 13, color: "#d1d5db" }}>KPI達成率60%以下のメンバー</span>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24" }}>{dashboardStats.lowKpiUsers.length}人</span>
                                    </div>
                                </div>
                            )}

                            {/* 🟢 グッドニュース */}
                            {(dashboardStats.thanksDelta > 0 || dashboardStats.topDept) && (
                                <div style={{ marginBottom: 16, padding: "16px 20px", borderRadius: 12, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.3)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399" }} />
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>🟢 今週のグッドニュース</div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {dashboardStats.topDept && (
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "rgba(0,0,0,0.2)" }}>
                                                <span style={{ fontSize: 13, color: "#d1d5db" }}>{dashboardStats.topDept.name}がKPI100%超え達成中</span>
                                                <span style={{ fontSize: 14, fontWeight: 700, color: "#34d399" }}>{dashboardStats.topDept.rate}% ⭐</span>
                                            </div>
                                        )}
                                        {dashboardStats.thanksDelta > 0 && (
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "rgba(0,0,0,0.2)" }}>
                                                <span style={{ fontSize: 13, color: "#d1d5db" }}>サンキューが活発化</span>
                                                <span style={{ fontSize: 14, fontWeight: 700, color: "#34d399" }}>+{dashboardStats.thanksDelta}件 📈</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 部署別KPI進捗バー */}
                            {dashboardStats.deptStats.length > 0 && (
                                <div style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                    <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>📈 事業部別KPI（今月）</div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                                        {dashboardStats.deptStats.map(d => {
                                            const c = d.rate >= 100 ? "#34d399" : d.rate >= 80 ? "#f59e0b" : d.rate >= 60 ? "#f97316" : d.rate > 0 ? "#f87171" : "#6b7280";
                                            return (
                                                <div key={d.id} style={{ padding: 12, borderRadius: 8, background: "rgba(0,0,0,0.2)" }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                                        <span style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb" }}>{d.name}</span>
                                                        <span style={{ fontSize: 16, fontWeight: 800, color: c }}>{d.count > 0 ? `${d.rate}%` : "—"}</span>
                                                    </div>
                                                    <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.05)" }}>
                                                        <div style={{ height: "100%", width: `${Math.min(d.rate, 100)}%`, background: c, borderRadius: 999 }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                            {(["today", "week", "month"] as const).map((p) => (
                                <button key={p} onClick={() => setPeriod(p)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer", fontSize: 13, background: period === p ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)", color: period === p ? "#fff" : "#9ca3af" }}>
                                    {p === "today" ? "今日" : p === "week" ? "今週" : "今月"}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                            {[
                                { label: "TOTAL USERS", value: userCount, unit: "人", color: "#818cf8" },
                                { label: "SUBMISSIONS", value: reportCount, unit: "件", color: "#34d399" },
                                { label: `${periodLabel.toUpperCase()} RATE`, value: `${submitRate}%`, unit: "", color: submitRate >= 80 ? "#34d399" : submitRate >= 50 ? "#f59e0b" : "#f87171" },
                                { label: "NOT SUBMITTED", value: notSubmittedUsers.length, unit: "人", color: "#f87171" },
                            ].map((card, i) => (
                                <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>{card.label}</div>
                                    <div style={{ fontSize: 40, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                                    {card.unit && <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>{card.unit}</div>}
                                </div>
                            ))}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>TOTAL POINT GROWTH</div>
                                {pointGraphData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={160}>
                                        <LineChart data={pointGraphData}>
                                            <XAxis dataKey="date" stroke="#4b5563" tick={{ fill: "#6b7280", fontSize: 10 }} />
                                            <YAxis stroke="#4b5563" tick={{ fill: "#6b7280", fontSize: 10 }} />
                                            <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#f9fafb" }} formatter={(value: unknown) => [`${value}pt`, "累計"]} />
                                            <Line type="monotone" dataKey="points" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 3 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : <div style={{ color: "#6b7280", fontSize: 14, textAlign: "center", padding: 40 }}>データがありません</div>}
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>DAILY SUBMISSIONS</div>
                                {submitGraphData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={160}>
                                        <BarChart data={submitGraphData}>
                                            <XAxis dataKey="date" stroke="#4b5563" tick={{ fill: "#6b7280", fontSize: 10 }} />
                                            <YAxis stroke="#4b5563" tick={{ fill: "#6b7280", fontSize: 10 }} />
                                            <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 8, color: "#f9fafb" }} formatter={(value: unknown) => [`${value}件`, "提出数"]} />
                                            <Bar dataKey="count" fill="#34d399" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : <div style={{ color: "#6b7280", fontSize: 14, textAlign: "center", padding: 40 }}>データがありません</div>}
                            </div>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>KPI ACHIEVEMENT</div>
                            {kpiStatuses.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>KPIデータがありません</div> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {kpiStatuses.slice(0, 10).map((s, i) => (
                                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${s.value >= s.target ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.05)"}` }}>
                                            <div>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: "#d1d5db" }}>{s.userName}</span>
                                                <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>- {s.kpiTitle}</span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ fontSize: 14, fontWeight: 700, color: s.value >= s.target ? "#34d399" : "#f9fafb" }}>{s.value}{s.unit}</span>
                                                <span style={{ fontSize: 12, color: "#6b7280" }}>/ {s.target}{s.unit}</span>
                                                {s.value >= s.target && <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700 }}>✅ 達成</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>LEARNING COMPLETIONS</div>
                                {contentCompletions.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>完了記録がありません</div> : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {contentCompletions.slice(0, 8).map((c, i) => (
                                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.15)" }}>
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#d1d5db" }}>{c.userName}</div>
                                                    <div style={{ fontSize: 11, color: "#6b7280" }}>{c.contentTitle}</div>
                                                </div>
                                                <div style={{ fontSize: 11, color: "#34d399", fontWeight: 700 }}>✅ 完了</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>THANKS HISTORY</div>
                                {thanksList.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>サンキューはありません</div> : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {thanksList.slice(0, 8).map((t) => (
                                            <div key={t.id} style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)" }}>
                                                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 2 }}>
                                                    <span style={{ color: "#818cf8", fontWeight: 600 }}>{t.fromName}</span>
                                                    <span> → </span>
                                                    <span style={{ color: "#fbbf24", fontWeight: 600 }}>{t.toName}</span>
                                                </div>
                                                <div style={{ fontSize: 13, color: "#d1d5db" }}>{t.message}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24, marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>REPORT CONTENTS</div>
                            {reports.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>{periodLabel}の日報はまだありません</div> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {reports.map((report) => (
                                        <div key={report.id} style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                            <div onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(255,255,255,0.02)", cursor: "pointer" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>{report.userName?.charAt(0) || "?"}</div>
                                                    <div>
                                                        <div style={{ fontSize: 14, fontWeight: 600, color: "#d1d5db" }}>{report.userName}</div>
                                                        <div style={{ fontSize: 11, color: "#6b7280" }}>{formatDateTime(report.created_at)}</div>
                                                    </div>
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <div style={{ fontSize: 12, color: "#9ca3af", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{report.content}</div>
                                                    <span style={{ color: "#6b7280", fontSize: 12 }}>{expandedReport === report.id ? "▲" : "▼"}</span>
                                                </div>
                                            </div>
                                            {expandedReport === report.id && (
                                                <div style={{ padding: "16px", background: "rgba(99,102,241,0.05)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                                                    <p style={{ margin: 0, fontSize: 14, color: "#c7d2fe", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{report.content}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2 }}>MISSING REPORTS</div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button onClick={async () => { await navigator.clipboard.writeText(copyText); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#d1d5db", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>{copied ? "✅ コピー済" : "名前コピー"}</button>
                                        <button onClick={async () => { await navigator.clipboard.writeText(reminderText); }} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>リマインド文</button>
                                    </div>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {notSubmittedUsers.length > 0 ? notSubmittedUsers.map((u) => (
                                        <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
                                            <span style={{ fontWeight: 600, color: "#fca5a5", fontSize: 14 }}>{u.name || "名前未設定"}</span>
                                            <a href={`https://line.me/R/msg/text/?${encodeURIComponent(`${u.name || ""}さん、日報の提出をお願いします。`)}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#818cf8", textDecoration: "none", fontWeight: 600 }}>連絡 →</a>
                                        </div>
                                    )) : <div style={{ padding: 16, borderRadius: 10, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399", fontSize: 14, fontWeight: 600 }}>✅ 全員提出済み（{periodLabel}）</div>}
                                </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>POINT RANKING</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {topUsers.length > 0 ? topUsers.map((u, i) => (
                                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                                <span style={{ fontSize: 14, color: "#d1d5db", fontWeight: 600 }}>{rankMedals[i]} {u.name}</span>
                                                <span style={{ fontSize: 16, fontWeight: 700, color: "#818cf8" }}>{u.points.toLocaleString()}pt</span>
                                            </div>
                                        )) : <div style={{ color: "#6b7280", fontSize: 14 }}>データがありません</div>}
                                    </div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>SUBMISSION RANKING</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {topSubmitters.length > 0 ? topSubmitters.map((u, i) => (
                                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                                <span style={{ fontSize: 14, color: "#d1d5db", fontWeight: 600 }}>{rankMedals[i]} {u.name}</span>
                                                <span style={{ fontSize: 16, fontWeight: 700, color: "#34d399" }}>{u.count}回</span>
                                            </div>
                                        )) : <div style={{ color: "#6b7280", fontSize: 14 }}>データがありません</div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === "dept_stats" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
                            {[
                                { label: "CB事業部", path: "/admin/cb", color: "#6366f1" },
                                { label: "IP事業部", path: "/admin/ip", color: "#06b6d4" },
                                { label: "SP事業部", path: "/admin/sp", color: "#34d399" },
                                { label: "HR事業部", path: "/admin/hr", color: "#f59e0b" },
                            ].map((dept) => (
                                <button
                                    key={dept.path}
                                    onClick={() => router.push(dept.path)}
                                    style={{ padding: "10px 24px", borderRadius: 10, border: `1px solid ${dept.color}50`, background: `${dept.color}15`, color: dept.color, fontWeight: 700, cursor: "pointer", fontSize: 14 }}
                                >
                                    📊 {dept.label}
                                </button>
                            ))}
                        </div>
                        <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>📝 月次レポート投稿</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>事業部</div>
                                    <select
                                        value={reportDeptId}
                                        onChange={(e) => setReportDeptId(e.target.value)}
                                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#1a1a2e", color: reportDeptId ? "#f9fafb" : "#6b7280", fontSize: 14, outline: "none" }}
                                    >
                                        <option value="">選択してください</option>
                                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>対象月</div>
                                    <select
                                        value={reportMonth}
                                        onChange={(e) => setReportMonth(e.target.value)}
                                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#1a1a2e", color: "#f9fafb", fontSize: 14, outline: "none" }}
                                    >
                                        {Array.from({ length: 12 }, (_, i) => {
                                            const d = new Date();
                                            d.setMonth(d.getMonth() - i);
                                            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                                            return <option key={ym} value={ym}>{ym}</option>;
                                        })}
                                    </select>
                                </div>
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>レポート内容</div>
                                <textarea
                                    value={reportContent}
                                    onChange={(e) => setReportContent(e.target.value)}
                                    placeholder="月次レポートをここに貼り付けてください..."
                                    style={{ width: "100%", height: 200, padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "monospace", lineHeight: 1.8 }}
                                />
                            </div>
                            <button
                                onClick={async () => {
                                    if (!reportDeptId) { setReportMessage("事業部を選択してください"); return; }
                                    if (!reportContent.trim()) { setReportMessage("内容を入力してください"); return; }
                                    setReportSaving(true);
                                    setReportMessage("");
                                    const { data: { user } } = await supabase.auth.getUser();
                                    await supabase.from("dept_reports").insert({
                                        department_id: reportDeptId,
                                        year_month: reportMonth,
                                        content: reportContent.trim(),
                                        created_by: user?.id,
                                    });
                                    const { data: rows } = await supabase.from("dept_reports").select("*").order("year_month", { ascending: false });
                                    const { data: deptRows } = await supabase.from("departments").select("*");
                                    setDeptReports((rows || []).map((r: any) => ({ ...r, deptName: deptRows?.find((d: any) => d.id === r.department_id)?.name || "不明" })));
                                    setReportContent("");
                                    setReportMessage("✅ レポートを投稿しました！");
                                    setReportSaving(false);
                                }}
                                disabled={reportSaving}
                                style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: reportSaving ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: reportSaving ? "not-allowed" : "pointer", fontSize: 14 }}
                            >
                                {reportSaving ? "投稿中..." : "📤 投稿する"}
                            </button>
                            {reportMessage && <div style={{ marginTop: 12, fontSize: 13, color: reportMessage.includes("✅") ? "#34d399" : "#f87171", fontWeight: 600 }}>{reportMessage}</div>}
                        </div>

                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2 }}>🏢 部署別成績（全期間）</div>

                        {deptStats.length === 0 ? (
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
                                KPIデータがありません
                            </div>
                        ) : deptStats.map((dept, di) => {
                            const overallColor = dept.overallAvg >= 100 ? "#34d399" : dept.overallAvg >= 80 ? "#f59e0b" : dept.overallAvg >= 60 ? "#f97316" : "#f87171";
                            const thisReports = deptReports.filter(r => r.department_id === dept.deptId);

                            return (
                                <div key={dept.deptId} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <div style={{ fontSize: 20 }}>{["🥇", "🥈", "🥉"][di] || "🏢"}</div>
                                                <div>
                                                    <div style={{ fontSize: 18, fontWeight: 800, color: "#f9fafb" }}>{dept.deptName}</div>
                                                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{dept.monthlyStats.length}ヶ月のデータ</div>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: "right" }}>
                                                <div style={{ fontSize: 32, fontWeight: 900, color: overallColor }}>{dept.overallAvg}%</div>
                                                <div style={{ fontSize: 12, color: "#6b7280" }}>全期間平均達成率</div>
                                            </div>
                                        </div>

                                        <div style={{ overflowX: "auto" }}>
                                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                                <thead>
                                                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                                                        {["月", "平均達成率", "100%達成", "承認済", "達成状況"].map(h => (
                                                            <th key={h} style={{ padding: "8px 12px", fontSize: 11, color: "#6b7280", fontWeight: 700, textAlign: "left", letterSpacing: 1 }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {dept.monthlyStats.map(m => {
                                                        const rc = m.avgRate >= 100 ? "#34d399" : m.avgRate >= 80 ? "#f59e0b" : m.avgRate >= 60 ? "#f97316" : "#f87171";
                                                        return (
                                                            <tr key={m.ym} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                                <td style={{ padding: "12px", fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>{m.ym}</td>
                                                                <td style={{ padding: "12px" }}>
                                                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                                        <div style={{ width: 100, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
                                                                            <div style={{ height: "100%", width: `${Math.min(m.avgRate, 100)}%`, background: rc, borderRadius: 999 }} />
                                                                        </div>
                                                                        <span style={{ fontSize: 14, fontWeight: 700, color: rc }}>{m.avgRate}%</span>
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: "12px", fontSize: 13, color: m.achievedCount > 0 ? "#34d399" : "#6b7280", fontWeight: 700 }}>{m.achievedCount}/{m.total}件</td>
                                                                <td style={{ padding: "12px", fontSize: 13, color: "#818cf8", fontWeight: 700 }}>{m.approved}/{m.total}件</td>
                                                                <td style={{ padding: "12px" }}>
                                                                    <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: m.avgRate >= 100 ? "rgba(52,211,153,0.15)" : m.avgRate >= 80 ? "rgba(245,158,11,0.15)" : "rgba(248,113,113,0.15)", color: m.avgRate >= 100 ? "#34d399" : m.avgRate >= 80 ? "#f59e0b" : "#f87171" }}>
                                                                        {m.avgRate >= 100 ? "✅ 達成" : m.avgRate >= 80 ? "⚡ 惜しい" : "📉 要改善"}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {thisReports.length > 0 && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingLeft: 16 }}>
                                            {thisReports.map(report => (
                                                <div key={report.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                            <span style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(99,102,241,0.2)", color: "#818cf8", fontSize: 12, fontWeight: 700 }}>{report.deptName}</span>
                                                            <span style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb" }}>{report.year_month}</span>
                                                        </div>
                                                        <button
                                                            onClick={async () => {
                                                                await supabase.from("dept_reports").delete().eq("id", report.id);
                                                                setDeptReports(prev => prev.filter(r => r.id !== report.id));
                                                            }}
                                                            style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(248,113,113,0.15)", color: "#f87171", fontSize: 11, cursor: "pointer", fontWeight: 700 }}
                                                        >
                                                            削除
                                                        </button>
                                                    </div>
                                                    <pre style={{ margin: 0, fontSize: 13, color: "#d1d5db", lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{report.content}</pre>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {deptReports.filter(r => !deptStats.find(d => d.deptId === r.department_id)).length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2 }}>その他のレポート</div>
                                {[...new Set(deptReports.filter(r => !deptStats.find(d => d.deptId === r.department_id)).map(r => r.department_id))].map(deptId => {
                                    const reports = deptReports.filter(r => r.department_id === deptId);
                                    const deptName = reports[0]?.deptName || "不明";
                                    return (
                                        <div key={deptId} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                                            <div style={{ fontSize: 16, fontWeight: 800, color: "#f9fafb", marginBottom: 16 }}>🏢 {deptName}</div>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                                {reports.map(report => (
                                                    <div key={report.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                                            <span style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb" }}>{report.year_month}</span>
                                                            <button onClick={async () => { await supabase.from("dept_reports").delete().eq("id", report.id); setDeptReports(prev => prev.filter(r => r.id !== report.id)); }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(248,113,113,0.15)", color: "#f87171", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>削除</button>
                                                        </div>
                                                        <pre style={{ margin: 0, fontSize: 13, color: "#d1d5db", lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{report.content}</pre>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ✅ Fix 3: monthly_kpi タブの <select> から challenges の JSX を分離 */}
                {activeTab === "monthly_kpi" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2 }}>月次KPI管理</div>
                            <select value={kpiMonth} onChange={(e) => setKpiMonth(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#1a1a2e", color: "#f9fafb", fontSize: 13, outline: "none" }}>
                                {Array.from({ length: 12 }, (_, i) => {
                                    const d = new Date();
                                    d.setMonth(d.getMonth() - i);
                                    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                                    return <option key={ym} value={ym}>{ym}</option>;
                                })}
                            </select>
                        </div>

                        {(() => {
                            const deptIds = [...new Set(monthlyKpis.map(k => k.department_id))];
                            if (deptIds.length === 0) return null;
                            const deptSummaries = deptIds.map(deptId => {
                                const deptKpis = monthlyKpis.filter(k => k.department_id === deptId);
                                const deptName = deptKpis[0]?.deptName || "不明";
                                const userCount = [...new Set(deptKpis.map(k => k.user_id))].length;
                                const rates = deptKpis.map(kpi => {
                                    const officialTarget = monthlyTargets.find(t => t.user_id === kpi.user_id && t.department_id === kpi.department_id && t.year_month === kpiMonth)?.target || kpi.target;
                                    return officialTarget > 0 ? Math.round((kpi.result / officialTarget) * 100) : 0;
                                });
                                const avgRate = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
                                const achievedCount = rates.filter(r => r >= 100).length;
                                const totalPts = deptKpis.filter(k => k.approved).reduce((sum, k) => {
                                    const officialTarget = monthlyTargets.find(t => t.user_id === k.user_id && t.department_id === k.department_id && t.year_month === kpiMonth)?.target || k.target;
                                    const rate = officialTarget > 0 ? Math.round((k.result / officialTarget) * 100) : 0;
                                    const pts = rate >= 120 ? 50 : rate >= 100 ? 30 : rate >= 80 ? 20 : rate >= 60 ? 10 : 0;
                                    return sum + pts;
                                }, 0);
                                const rateColor = avgRate >= 100 ? "#34d399" : avgRate >= 80 ? "#f59e0b" : avgRate >= 60 ? "#f97316" : "#f87171";
                                return { deptId, deptName, userCount, avgRate, achievedCount, totalPts, rateColor, kpiCount: deptKpis.length };
                            }).sort((a, b) => b.avgRate - a.avgRate);

                            return (
                                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>🏢 事業部別ダッシュボード</div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
                                        {deptSummaries.map((dept, i) => (
                                            <div key={dept.deptId} style={{ padding: "16px 20px", borderRadius: 12, background: `${dept.rateColor}10`, border: `1px solid ${dept.rateColor}40`, position: "relative", overflow: "hidden" }}>
                                                {i === 0 && <div style={{ position: "absolute", top: 8, right: 10, fontSize: 16 }}>🥇</div>}
                                                <div style={{ fontSize: 13, fontWeight: 800, color: "#f9fafb", marginBottom: 4 }}>{dept.deptName}</div>
                                                <div style={{ fontSize: 32, fontWeight: 900, color: dept.rateColor, lineHeight: 1, marginBottom: 4 }}>{dept.avgRate}%</div>
                                                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>平均達成率</div>
                                                <div style={{ height: 4, borderRadius: 999, background: "rgba(255,255,255,0.08)", marginBottom: 10 }}>
                                                    <div style={{ height: "100%", width: `${Math.min(dept.avgRate, 100)}%`, background: dept.rateColor, borderRadius: 999 }} />
                                                </div>
                                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af" }}>
                                                    <span>{dept.userCount}人参加</span>
                                                    <span style={{ color: "#818cf8" }}>{dept.totalPts}pt付与</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ overflowX: "auto" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                            <thead>
                                                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                                                    {["事業部", "参加人数", "平均達成率", "100%達成", "承認済pt", "達成状況"].map(h => (
                                                        <th key={h} style={{ padding: "8px 12px", fontSize: 11, color: "#6b7280", fontWeight: 700, textAlign: "left", letterSpacing: 1 }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {deptSummaries.map(dept => (
                                                    <tr key={dept.deptId} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                        <td style={{ padding: "12px", fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>{dept.deptName}</td>
                                                        <td style={{ padding: "12px", fontSize: 13, color: "#9ca3af" }}>{dept.userCount}人</td>
                                                        <td style={{ padding: "12px" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                                <div style={{ width: 80, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
                                                                    <div style={{ height: "100%", width: `${Math.min(dept.avgRate, 100)}%`, background: dept.rateColor, borderRadius: 999 }} />
                                                                </div>
                                                                <span style={{ fontSize: 14, fontWeight: 700, color: dept.rateColor }}>{dept.avgRate}%</span>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: "12px", fontSize: 13, color: "#9ca3af" }}>
                                                            <span style={{ color: dept.achievedCount > 0 ? "#34d399" : "#6b7280", fontWeight: 700 }}>{dept.achievedCount}/{dept.kpiCount}件</span>
                                                        </td>
                                                        <td style={{ padding: "12px", fontSize: 14, fontWeight: 700, color: "#818cf8" }}>{dept.totalPts}pt</td>
                                                        <td style={{ padding: "12px" }}>
                                                            <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: dept.avgRate >= 100 ? "rgba(52,211,153,0.15)" : dept.avgRate >= 80 ? "rgba(245,158,11,0.15)" : "rgba(248,113,113,0.15)", color: dept.avgRate >= 100 ? "#34d399" : dept.avgRate >= 80 ? "#f59e0b" : "#f87171" }}>
                                                                {dept.avgRate >= 100 ? "✅ 達成" : dept.avgRate >= 80 ? "⚡ 惜しい" : "📉 要改善"}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })()}

                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>🎯 目標設定</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {userDetails.map((u) => (
                                    <div key={u.id} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>{u.name}</div>
                                                <div style={{ fontSize: 12, color: "#6b7280" }}>役割: {u.role}</div>
                                            </div>
                                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                                {monthlyKpis.filter(k => k.user_id === u.id).map(kpi => {
                                                    const key = `${u.id}_${kpi.department_id}`;
                                                    const currentTarget = monthlyTargets.find(t => t.user_id === u.id && t.department_id === kpi.department_id && t.year_month === kpiMonth)?.target || kpi.target;
                                                    return (
                                                        <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                            <span style={{ fontSize: 12, color: "#9ca3af" }}>{kpi.deptName}目標:</span>
                                                            <input type="number" defaultValue={currentTarget} onChange={(e) => setTargetInputs(prev => ({ ...prev, [key]: Number(e.target.value) }))} style={{ width: 70, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none" }} />
                                                            <button onClick={async () => {
                                                                const val = targetInputs[key] ?? currentTarget;
                                                                await handleSetTarget(u.id, kpi.department_id, val);
                                                                setMonthlyTargets(prev => {
                                                                    const exists = prev.find(t => t.user_id === u.id && t.department_id === kpi.department_id && t.year_month === kpiMonth);
                                                                    if (exists) return prev.map(t => t.user_id === u.id && t.department_id === kpi.department_id && t.year_month === kpiMonth ? { ...t, target: val } : t);
                                                                    return [...prev, { user_id: u.id, department_id: kpi.department_id, year_month: kpiMonth, target: val }];
                                                                });
                                                            }} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>設定</button>
                                                        </div>
                                                    );
                                                })}
                                                {monthlyKpis.filter(k => k.user_id === u.id).length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>KPI未入力</div>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>✅ KPI承認</div>
                            {monthlyKpis.length === 0 ? (
                                <div style={{ textAlign: "center", color: "#6b7280", fontSize: 14, padding: 20 }}>{kpiMonth}のKPIデータがありません</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {monthlyKpis.map((kpi) => {
                                        const officialTarget = monthlyTargets.find(t => t.user_id === kpi.user_id && t.department_id === kpi.department_id && t.year_month === kpiMonth)?.target || kpi.target;
                                        const rate = officialTarget > 0 ? Math.round((kpi.result / officialTarget) * 100) : 0;
                                        const pts = rate >= 120 ? 50 : rate >= 100 ? 30 : rate >= 80 ? 20 : rate >= 60 ? 10 : 0;
                                        const rateColor = rate >= 100 ? "#34d399" : rate >= 80 ? "#f59e0b" : rate >= 60 ? "#f97316" : "#f87171";
                                        return (
                                            <div key={kpi.id} style={{ padding: "20px 24px", borderRadius: 16, background: kpi.approved ? "rgba(52,211,153,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${kpi.approved ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.08)"}` }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                                            <span style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb" }}>{kpi.userName}</span>
                                                            <span style={{ padding: "2px 10px", borderRadius: 6, background: "rgba(99,102,241,0.2)", color: "#818cf8", fontSize: 12, fontWeight: 700 }}>{kpi.deptName}</span>
                                                            {kpi.approved && <span style={{ padding: "2px 10px", borderRadius: 6, background: "rgba(52,211,153,0.15)", color: "#34d399", fontSize: 12, fontWeight: 700 }}>✅ 承認済</span>}
                                                        </div>
                                                        <div style={{ display: "flex", gap: 20, fontSize: 13, color: "#9ca3af" }}>
                                                            <span>目標: <strong style={{ color: "#f9fafb" }}>{officialTarget}件</strong></span>
                                                            <span>実績: <strong style={{ color: "#f9fafb" }}>{kpi.result}件</strong></span>
                                                            <span>達成率: <strong style={{ color: rateColor }}>{rate}%</strong></span>
                                                            <span>獲得予定: <strong style={{ color: "#818cf8" }}>{pts}pt</strong></span>
                                                        </div>
                                                        <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", width: 300 }}>
                                                            <div style={{ height: "100%", width: `${Math.min(rate, 100)}%`, background: rateColor, borderRadius: 999 }} />
                                                        </div>
                                                    </div>
                                                    {!kpi.approved && (
                                                        <button onClick={() => handleApproveKpi({ ...kpi, target: officialTarget, points_awarded: pts })} disabled={approvingKpi === kpi.id} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: pts > 0 ? "linear-gradient(135deg, #10b981, #34d399)" : "rgba(255,255,255,0.1)", color: pts > 0 ? "#0a0a0f" : "#6b7280", fontWeight: 700, cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" }}>
                                                            {approvingKpi === kpi.id ? "処理中..." : `承認 +${pts}pt`}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "resources" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>📁 新規資料追加</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>タイトル</div>
                                    <input value={resourceTitle} onChange={(e) => setResourceTitle(e.target.value)} placeholder="資料のタイトル" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>カテゴリ</div>
                                    <input value={resourceCategory} onChange={(e) => setResourceCategory(e.target.value)} placeholder="例：営業資料・研修資料" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                </div>
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>説明</div>
                                <input value={resourceDesc} onChange={(e) => setResourceDesc(e.target.value)} placeholder="資料の説明（任意）" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>タイプ</div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    {[{ key: "link", label: "🔗 リンク" }, { key: "pdf", label: "📄 PDF" }, { key: "image", label: "🖼️ 画像" }].map(t => (
                                        <button key={t.key} onClick={() => setResourceType(t.key as any)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer", fontSize: 13, background: resourceType === t.key ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.05)", color: resourceType === t.key ? "#fff" : "#9ca3af" }}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>URL</div>
                                <input value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder="https://..." style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <button onClick={async () => {
                                if (!resourceTitle.trim()) { setResourceMessage("タイトルを入力してください"); return; }
                                setResourceSaving(true);
                                const { data: { user } } = await supabase.auth.getUser();
                                await supabase.from("resources").insert({ title: resourceTitle.trim(), description: resourceDesc.trim() || null, resource_type: resourceType, url: resourceUrl.trim() || null, category: resourceCategory.trim() || null, is_active: true, created_by: user?.id });
                                const { data: rows } = await supabase.from("resources").select("*").order("created_at", { ascending: false });
                                setResources((rows || []) as Resource[]);
                                setResourceTitle(""); setResourceDesc(""); setResourceUrl(""); setResourceCategory("");
                                setResourceMessage("✅ 資料を追加しました！");
                                setResourceSaving(false);
                            }} disabled={resourceSaving} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                                {resourceSaving ? "追加中..." : "📁 追加する"}
                            </button>
                            {resourceMessage && <div style={{ marginTop: 12, fontSize: 13, color: "#34d399", fontWeight: 600 }}>{resourceMessage}</div>}
                        </div>

                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>RESOURCES</div>
                            {resources.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>資料がありません</div> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {resources.map(r => (
                                        <div key={r.id} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${r.is_active ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                                    <span style={{ fontSize: 14, fontWeight: 700, color: r.is_active ? "#f9fafb" : "#6b7280" }}>{r.title}</span>
                                                    {r.category && <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 11, fontWeight: 600 }}>{r.category}</span>}
                                                    <span style={{ fontSize: 11, color: "#6b7280" }}>{r.resource_type}</span>
                                                </div>
                                                {r.description && <div style={{ fontSize: 12, color: "#6b7280" }}>{r.description}</div>}
                                            </div>
                                            <button onClick={async () => {
                                                await supabase.from("resources").update({ is_active: !r.is_active }).eq("id", r.id);
                                                setResources(prev => prev.map(res => res.id === r.id ? { ...res, is_active: !res.is_active } : res));
                                            }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: r.is_active ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)", color: r.is_active ? "#f87171" : "#34d399", fontSize: 11, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                {r.is_active ? "非表示" : "表示する"}
                                            </button>
                                        </div>
                                    ))}{resources.map(r => (
                                        <div key={r.id} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${r.is_active ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)"}` }}>
                                            {editingResourceId === r.id ? (
                                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                                    <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>📝 編集中</div>
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                                        <div>
                                                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>タイトル</div>
                                                            <input value={editResourceTitle} onChange={(e) => setEditResourceTitle(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>カテゴリ</div>
                                                            <input value={editResourceCategory} onChange={(e) => setEditResourceCategory(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>説明</div>
                                                        <input value={editResourceDesc} onChange={(e) => setEditResourceDesc(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>URL</div>
                                                        <input value={editResourceUrl} onChange={(e) => setEditResourceUrl(e.target.value)} placeholder="https://..." style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                    </div>
                                                    <div style={{ display: "flex", gap: 8 }}>
                                                        <button onClick={async () => {
                                                            await supabase.from("resources").update({
                                                                title: editResourceTitle.trim(),
                                                                description: editResourceDesc.trim() || null,
                                                                url: editResourceUrl.trim() || null,
                                                                category: editResourceCategory.trim() || null,
                                                            }).eq("id", r.id);
                                                            setResources(prev => prev.map(res => res.id === r.id ? { ...res, title: editResourceTitle.trim(), description: editResourceDesc.trim() || null, url: editResourceUrl.trim() || null, category: editResourceCategory.trim() || null } : res));
                                                            setEditingResourceId(null);
                                                        }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>💾 保存</button>
                                                        <button onClick={() => setEditingResourceId(null)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>キャンセル</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                                            <span style={{ fontSize: 14, fontWeight: 700, color: r.is_active ? "#f9fafb" : "#6b7280" }}>{r.title}</span>
                                                            {r.category && <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 11, fontWeight: 600 }}>{r.category}</span>}
                                                            <span style={{ fontSize: 11, color: "#6b7280" }}>{r.resource_type}</span>
                                                        </div>
                                                        {r.description && <div style={{ fontSize: 12, color: "#6b7280" }}>{r.description}</div>}
                                                    </div>
                                                    <div style={{ display: "flex", gap: 6 }}>
                                                        <button onClick={() => {
                                                            setEditingResourceId(r.id);
                                                            setEditResourceTitle(r.title || "");
                                                            setEditResourceDesc(r.description || "");
                                                            setEditResourceUrl(r.url || "");
                                                            setEditResourceCategory(r.category || "");
                                                        }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 11, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                            ✏️ 編集
                                                        </button>
                                                        <button onClick={async () => {
                                                            await supabase.from("resources").update({ is_active: !r.is_active }).eq("id", r.id);
                                                            setResources(prev => prev.map(res => res.id === r.id ? { ...res, is_active: !res.is_active } : res));
                                                        }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: r.is_active ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)", color: r.is_active ? "#f87171" : "#34d399", fontSize: 11, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                            {r.is_active ? "非表示" : "表示する"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === "es" && (
                    <div>
                        <div style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 16, padding: 24, marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: "#a78bfa", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>📝 総合ES 一覧</div>
                            <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7 }}>各ユーザーのエントリーシート状況を確認できます。クリックで詳細を閲覧できます。</div>
                        </div>

                        {selectedEsUserId ? (
                            <div>
                                <button onClick={() => setSelectedEsUserId(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: 600, marginBottom: 16 }}>← 一覧に戻る</button>
                                {(() => {
                                    const es = esList.find((e: any) => e.user_id === selectedEsUserId);
                                    if (!es) return <div style={{ color: "#6b7280", fontSize: 13 }}>データが見つかりません</div>;

                                    const sections = [
                                        {
                                            title: "① 学生時代に力を入れたこと（ガクチカ）", fields: [
                                                { label: "何を頑張ったのか", value: es.gakuchika_what },
                                                { label: "目標", value: es.gakuchika_goal },
                                                { label: "課題", value: es.gakuchika_issue },
                                                { label: "改善", value: es.gakuchika_improvement },
                                                { label: "結果", value: es.gakuchika_result },
                                            ]
                                        },
                                        {
                                            title: "② 就活の軸", fields: [
                                                { label: "どんな仕事（業界）に関わりたいか", value: es.axis_industry },
                                                { label: "↑ なぜか", value: es.axis_industry_why },
                                                { label: "どんな業務に就きたいか", value: es.axis_role },
                                                { label: "↑ なぜか", value: es.axis_role_why },
                                                { label: "他に大事にしたいこと", value: es.axis_other },
                                                { label: "↑ なぜか", value: es.axis_other_why },
                                            ]
                                        },
                                        {
                                            title: "③ 将来どうなりたいか", fields: [
                                                { label: "どんな価値を出す人になりたいか", value: es.goal_value },
                                                { label: "どんな役割の人になりたいか", value: es.goal_role },
                                                { label: "なぜそうなりたいか", value: es.goal_why },
                                                { label: "必要なスキル・経験", value: es.goal_skills },
                                            ]
                                        },
                                        {
                                            title: "④ 自己PR", fields: [
                                                { label: "強み", value: es.pr_strength },
                                                { label: "発揮された経験", value: es.pr_experience },
                                                { label: "再現性", value: es.pr_reproducibility },
                                            ]
                                        },
                                        {
                                            title: "⑤ 失敗経験・挫折経験", fields: [
                                                { label: "何が失敗だったか", value: es.failure_what },
                                                { label: "どう乗り越えたか", value: es.failure_overcome },
                                            ]
                                        },
                                    ];

                                    return (
                                        <div>
                                            <div style={{ padding: "20px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 16 }}>
                                                <div style={{ color: "#f9fafb", fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{es.userName}</div>
                                                <div style={{ color: "#6b7280", fontSize: 12 }}>
                                                    {es.first_completed_at && <span style={{ marginRight: 12 }}>初回完成: {new Date(es.first_completed_at).toLocaleDateString("ja-JP")}</span>}
                                                    <span>最終更新: {new Date(es.last_updated_at).toLocaleString("ja-JP")}</span>
                                                    <span style={{ marginLeft: 12 }}>更新回数: {es.total_updates}</span>
                                                </div>
                                            </div>
                                            {sections.map((sec, si) => (
                                                <div key={si} style={{ padding: "20px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 12 }}>
                                                    <div style={{ color: "#a78bfa", fontSize: 14, fontWeight: 800, marginBottom: 12 }}>{sec.title}</div>
                                                    {sec.fields.map((f, fi) => (
                                                        <div key={fi} style={{ marginBottom: 12 }}>
                                                            <div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{f.label}</div>
                                                            <div style={{ color: f.value ? "#d1d5db" : "#4b5563", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", padding: "10px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.04)" }}>{f.value || "（未記入）"}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {esList.length === 0 ? (
                                    <div style={{ textAlign: "center", color: "#6b7280", fontSize: 13, padding: 32 }}>まだ誰もESを作成していません</div>
                                ) : (
                                    esList.map((es: any) => {
                                        const fields = ["gakuchika_what", "gakuchika_goal", "gakuchika_issue", "gakuchika_improvement", "gakuchika_result", "axis_industry", "axis_industry_why", "axis_role", "axis_role_why", "axis_other", "axis_other_why", "goal_value", "goal_role", "goal_why", "goal_skills", "pr_strength", "pr_experience", "pr_reproducibility", "failure_what", "failure_overcome"];
                                        const filled = fields.filter(f => (es[f] || "").trim().length > 0).length;
                                        const progress = Math.round((filled / fields.length) * 100);
                                        const isComplete = filled === fields.length;
                                        return (
                                            <div key={es.user_id} onClick={() => setSelectedEsUserId(es.user_id)} style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                                    <div>
                                                        <div style={{ color: "#f9fafb", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{es.userName}</div>
                                                        <div style={{ color: "#6b7280", fontSize: 11 }}>最終更新: {new Date(es.last_updated_at).toLocaleString("ja-JP")}　更新 {es.total_updates} 回</div>
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                        {isComplete && <span style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(52,211,153,0.15)", color: "#34d399", fontSize: 11, fontWeight: 700 }}>✅ 完成</span>}
                                                        <div style={{ color: isComplete ? "#34d399" : "#818cf8", fontSize: 18, fontWeight: 800 }}>{progress}%</div>
                                                    </div>
                                                </div>
                                                <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                                                    <div style={{ width: `${progress}%`, height: "100%", background: isComplete ? "#34d399" : "linear-gradient(90deg, #6366f1, #8b5cf6)" }} />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                )}
                {/* ✅ Fix 4: challenges タブを独立した条件分岐として正しい位置に配置 */}
                {activeTab === "career" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>💼 新規追加</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>タイトル</div>
                                    <input value={careerTitle} onChange={(e) => setCareerTitle(e.target.value)} placeholder="例：慶應義塾大学 → 〇〇商事" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>カテゴリ</div>
                                    <input value={careerCategory} onChange={(e) => setCareerCategory(e.target.value)} placeholder="例：大学別・企業別・資料" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                </div>
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>説明</div>
                                <textarea value={careerDesc} onChange={(e) => setCareerDesc(e.target.value)} placeholder="詳細情報を入力してください..." style={{ width: "100%", height: 100, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>URL（任意）</div>
                                <input value={careerUrl} onChange={(e) => setCareerUrl(e.target.value)} placeholder="https://..." style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <button onClick={async () => {
                                if (!careerTitle.trim() || !careerCategory.trim()) { setCareerMessage("タイトルとカテゴリを入力してください"); return; }
                                setCareerSaving(true);
                                const { data: { user } } = await supabase.auth.getUser();
                                await supabase.from("career_items").insert({ title: careerTitle.trim(), description: careerDesc.trim() || null, category: careerCategory.trim(), url: careerUrl.trim() || null, created_by: user?.id });
                                const { data: rows } = await supabase.from("career_items").select("*").order("category").order("created_at", { ascending: false });
                                setCareerItems((rows || []) as CareerItem[]);
                                setCareerTitle(""); setCareerDesc(""); setCareerCategory(""); setCareerUrl("");
                                setCareerMessage("追加しました");
                                setCareerSaving(false);
                            }} disabled={careerSaving} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                                {careerSaving ? "追加中..." : "💼 追加する"}
                            </button>
                            {careerMessage && <div style={{ marginTop: 12, fontSize: 13, color: "#34d399", fontWeight: 600 }}>{careerMessage}</div>}
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2 }}>就活ボックス一覧</div>
                                <input value={careerSearch} onChange={(e) => setCareerSearch(e.target.value)} placeholder="検索..." style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", width: 200 }} />
                            </div>
                            {careerItems.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>データがありません</div> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {[...new Set(careerItems.map(c => c.category))].map(cat => {
                                        const filtered = careerItems.filter(c => c.category === cat && (
                                            careerSearch === "" || c.title.includes(careerSearch) || (c.description || "").includes(careerSearch)
                                        ));
                                        if (filtered.length === 0) return null;
                                        return (
                                            <div key={cat} style={{ marginBottom: 12 }}>
                                                <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>{cat.toUpperCase()}</div>
                                                {filtered.map(c => (
                                                    <div key={c.id} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 6 }}>
                                                        {editingCareerId === c.id ? (
                                                            /* ===== 編集モード ===== */
                                                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                                                <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>📝 編集中</div>
                                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                                                    <div>
                                                                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>タイトル</div>
                                                                        <input value={editCareerTitle} onChange={(e) => setEditCareerTitle(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                                    </div>
                                                                    <div>
                                                                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>カテゴリ</div>
                                                                        <input value={editCareerCategory} onChange={(e) => setEditCareerCategory(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>説明</div>
                                                                    <textarea value={editCareerDesc} onChange={(e) => setEditCareerDesc(e.target.value)} style={{ width: "100%", height: 80, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>URL</div>
                                                                    <input value={editCareerUrl} onChange={(e) => setEditCareerUrl(e.target.value)} placeholder="https://..." style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                                </div>
                                                                <div style={{ display: "flex", gap: 8 }}>
                                                                    <button onClick={async () => {
                                                                        await supabase.from("career_items").update({
                                                                            title: editCareerTitle.trim(),
                                                                            description: editCareerDesc.trim() || null,
                                                                            category: editCareerCategory.trim(),
                                                                            url: editCareerUrl.trim() || null,
                                                                        }).eq("id", c.id);
                                                                        setCareerItems(prev => prev.map(x => x.id === c.id ? { ...x, title: editCareerTitle.trim(), description: editCareerDesc.trim() || null, category: editCareerCategory.trim(), url: editCareerUrl.trim() || null } : x));
                                                                        setEditingCareerId(null);
                                                                    }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>💾 保存</button>
                                                                    <button onClick={() => setEditingCareerId(null)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>キャンセル</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            /* ===== 通常モード ===== */
                                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>{c.title}</div>
                                                                    {c.description && <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.6, marginBottom: 4 }}>{c.description}</div>}
                                                                    {c.url && <a href={c.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#818cf8", textDecoration: "none" }}>🔗 リンクを開く</a>}
                                                                </div>
                                                                <div style={{ display: "flex", gap: 6, marginLeft: 12, flexShrink: 0 }}>
                                                                    <button onClick={() => {
                                                                        setEditingCareerId(c.id);
                                                                        setEditCareerTitle(c.title || "");
                                                                        setEditCareerDesc(c.description || "");
                                                                        setEditCareerCategory(c.category || "");
                                                                        setEditCareerUrl(c.url || "");
                                                                    }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 11, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                                        ✏️ 編集
                                                                    </button>
                                                                    <button onClick={async () => {
                                                                        await supabase.from("career_items").delete().eq("id", c.id);
                                                                        setCareerItems(prev => prev.filter(x => x.id !== c.id));
                                                                    }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(248,113,113,0.2)", color: "#f87171", fontSize: 11, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>削除</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === "wiki" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>📖 用語追加</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 12, marginBottom: 12 }}>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>用語</div>
                                    <input value={wikiTerm} onChange={(e) => setWikiTerm(e.target.value)} placeholder="例：架電" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>カテゴリ</div>
                                    <input value={wikiCategory} onChange={(e) => setWikiCategory(e.target.value)} placeholder="例：営業用語・社内用語" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                </div>
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>説明</div>
                                <textarea value={wikiDesc} onChange={(e) => setWikiDesc(e.target.value)} placeholder="用語の説明を入力してください..." style={{ width: "100%", height: 100, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                            </div>
                            <button onClick={async () => {
                                if (!wikiTerm.trim() || !wikiDesc.trim()) { setWikiMessage("用語と説明を入力してください"); return; }
                                setWikiSaving(true);
                                const { data: { user } } = await supabase.auth.getUser();
                                await supabase.from("wiki_terms").insert({ term: wikiTerm.trim(), description: wikiDesc.trim(), category: wikiCategory.trim() || null, created_by: user?.id });
                                const { data: rows } = await supabase.from("wiki_terms").select("*").order("category").order("term");
                                setWikiTerms((rows || []) as WikiTerm[]);
                                setWikiTerm(""); setWikiDesc(""); setWikiCategory("");
                                setWikiMessage("追加しました");
                                setWikiSaving(false);
                            }} disabled={wikiSaving} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                                {wikiSaving ? "追加中..." : "📖 追加する"}
                            </button>
                            {wikiMessage && <div style={{ marginTop: 12, fontSize: 13, color: "#34d399", fontWeight: 600 }}>{wikiMessage}</div>}
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2 }}>用語一覧</div>
                                <input value={wikiSearch} onChange={(e) => setWikiSearch(e.target.value)} placeholder="検索..." style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", width: 200 }} />
                            </div>
                            {wikiTerms.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>用語がありません</div> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {[...new Set(wikiTerms.map(t => t.category || "その他"))].map(cat => {
                                        const filtered = wikiTerms.filter(t => (t.category || "その他") === cat && (
                                            wikiSearch === "" || t.term.includes(wikiSearch) || t.description.includes(wikiSearch)
                                        ));
                                        if (filtered.length === 0) return null;
                                        return (
                                            <div key={cat} style={{ marginBottom: 12 }}>
                                                <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>{cat.toUpperCase()}</div>
                                                {filtered.map(t => (
                                                    <div key={t.id} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 6 }}>
                                                        {editingWikiId === t.id ? (
                                                            /* ===== 編集モード ===== */
                                                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                                                <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>📝 編集中</div>
                                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                                                    <div>
                                                                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>用語</div>
                                                                        <input value={editWikiTerm} onChange={(e) => setEditWikiTerm(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                                    </div>
                                                                    <div>
                                                                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>カテゴリ</div>
                                                                        <input value={editWikiCategory} onChange={(e) => setEditWikiCategory(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>説明</div>
                                                                    <textarea value={editWikiDesc} onChange={(e) => setEditWikiDesc(e.target.value)} style={{ width: "100%", height: 80, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                                                                </div>
                                                                <div style={{ display: "flex", gap: 8 }}>
                                                                    <button onClick={async () => {
                                                                        await supabase.from("wiki_terms").update({
                                                                            term: editWikiTerm.trim(),
                                                                            description: editWikiDesc.trim(),
                                                                            category: editWikiCategory.trim() || null,
                                                                        }).eq("id", t.id);
                                                                        setWikiTerms(prev => prev.map(w => w.id === t.id ? { ...w, term: editWikiTerm.trim(), description: editWikiDesc.trim(), category: editWikiCategory.trim() || null } : w));
                                                                        setEditingWikiId(null);
                                                                    }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>💾 保存</button>
                                                                    <button onClick={() => setEditingWikiId(null)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>キャンセル</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            /* ===== 通常モード ===== */
                                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>{t.term}</div>
                                                                    <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.6 }}>{t.description}</div>
                                                                </div>
                                                                <div style={{ display: "flex", gap: 6, marginLeft: 12, flexShrink: 0 }}>
                                                                    <button onClick={() => {
                                                                        setEditingWikiId(t.id);
                                                                        setEditWikiTerm(t.term || "");
                                                                        setEditWikiDesc(t.description || "");
                                                                        setEditWikiCategory(t.category || "");
                                                                    }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 11, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                                        ✏️ 編集
                                                                    </button>
                                                                    <button onClick={async () => {
                                                                        await supabase.from("wiki_terms").delete().eq("id", t.id);
                                                                        setWikiTerms(prev => prev.filter(w => w.id !== t.id));
                                                                    }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(248,113,113,0.2)", color: "#f87171", fontSize: 11, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>削除</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === "mtg" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>📅 MTG作成</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 12, marginBottom: 16 }}>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>タイトル</div>
                                    <input value={mtgTitle} onChange={(e) => setMtgTitle(e.target.value)} placeholder="例：4月度全体MTG" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>日付</div>
                                    <input type="date" value={mtgDate} onChange={(e) => setMtgDate(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>種別</div>
                                    <select value={mtgType} onChange={(e) => setMtgType(e.target.value as any)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#1a1a2e", color: "#f9fafb", fontSize: 14, outline: "none" }}>
                                        <option value="monthly">月次定例</option>
                                        <option value="special">特別開催</option>
                                    </select>
                                </div>
                            </div>
                            <button onClick={async () => {
                                if (!mtgTitle.trim() || !mtgDate) { setMtgMessage("タイトルと日付を入力してください"); return; }
                                setMtgSaving(true);
                                const { data: newSession } = await supabase.from("mtg_sessions").insert({ title: mtgTitle.trim(), mtg_date: mtgDate, mtg_type: mtgType }).select().single();
                                if (newSession) {
                                    await Promise.all(userDetails.map(u =>
                                        supabase.from("mtg_attendances").insert({ session_id: newSession.id, user_id: u.id, status: "absent", reason: null })
                                    ));
                                }
                                const { data: rows } = await supabase.from("mtg_sessions").select("*").order("mtg_date", { ascending: false });
                                setMtgSessions((rows || []) as MtgSession[]);
                                setMtgTitle(""); setMtgDate(""); setMtgType("monthly");
                                setMtgMessage("MTGを作成しました");
                                setSelectedSession(newSession?.id || null);
                                setMtgSaving(false);
                            }} disabled={mtgSaving} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                                {mtgSaving ? "作成中..." : "📅 作成する"}
                            </button>
                            {mtgMessage && <div style={{ marginTop: 12, fontSize: 13, color: "#34d399", fontWeight: 600 }}>{mtgMessage}</div>}
                        </div>

                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>MTG一覧</div>
                            {mtgSessions.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>MTGがありません</div> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {mtgSessions.map(s => (
                                        <button key={s.id} onClick={async () => {
                                            setSelectedSession(s.id);
                                            const { data: rows } = await supabase.from("mtg_attendances").select("*").eq("session_id", s.id);
                                            setMtgAttendances((rows || []).map((r: any) => ({
                                                ...r,
                                                userName: userDetails.find(u => u.id === r.user_id)?.name || "名前未設定"
                                            })));
                                        }} style={{ padding: "14px 16px", borderRadius: 12, background: selectedSession === s.id ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.02)", border: `1px solid ${selectedSession === s.id ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}`, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", textAlign: "left" }}>
                                            <div>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>{s.title}</div>
                                                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{s.mtg_date} · {s.mtg_type === "monthly" ? "月次定例" : "特別開催"}</div>
                                            </div>
                                            <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 600 }}>出欠入力 →</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {selectedSession && (
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                                <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>出欠入力</div>
                                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
                                    出席: {mtgAttendances.filter(a => a.status === "present").length}名
                                    欠席: {mtgAttendances.filter(a => a.status === "absent").length}名
                                    除外: {mtgAttendances.filter(a => a.status === "excluded").length}名
                                    出席率: {(() => {
                                        const valid = mtgAttendances.filter(a => a.status !== "excluded");
                                        const present = mtgAttendances.filter(a => a.status === "present").length;
                                        return valid.length > 0 ? Math.round((present / valid.length) * 100) : 0;
                                    })()}%
                                </div>
                                {[...teams, { id: "none", name: "チームなし", color: "#6b7280" }].map(team => {
                                    const teamUserIds = team.id === "none"
                                        ? userDetails.filter(u => !u.team_id).map(u => u.id)
                                        : userDetails.filter(u => u.team_id === team.id).map(u => u.id);
                                    const teamAttendances = mtgAttendances.filter(a => teamUserIds.includes(a.user_id));
                                    if (teamAttendances.length === 0) return null;
                                    const validCount = teamAttendances.filter(a => a.status !== "excluded").length;
                                    const presentCount = teamAttendances.filter(a => a.status === "present").length;
                                    const rate = validCount > 0 ? Math.round((presentCount / validCount) * 100) : 0;
                                    return (
                                        <div key={team.id} style={{ marginBottom: 20 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: team.color }} />
                                                <span style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb" }}>{team.name}</span>
                                                <span style={{ fontSize: 12, color: "#6b7280" }}>{presentCount}/{validCount}人 · {rate}%</span>
                                            </div>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 20 }}>
                                                {teamAttendances.map(a => (
                                                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                                        <div style={{ fontSize: 14, fontWeight: 600, color: "#f9fafb", flex: 1 }}>{a.userName}</div>
                                                        <div style={{ display: "flex", gap: 6 }}>
                                                            {[
                                                                { value: "present", label: "⭕️ 出席", color: "#34d399" },
                                                                { value: "absent", label: "❌ 欠席", color: "#f87171" },
                                                                { value: "excluded", label: "➖ 除外", color: "#6b7280" },
                                                            ].map(opt => (
                                                                <button key={opt.value} onClick={async () => {
                                                                    await supabase.from("mtg_attendances").update({ status: opt.value }).eq("id", a.id);
                                                                    setMtgAttendances(prev => prev.map(x => x.id === a.id ? { ...x, status: opt.value } : x));
                                                                }} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: a.status === opt.value ? `${opt.color}30` : "rgba(255,255,255,0.05)", color: a.status === opt.value ? opt.color : "#6b7280", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                                                                    {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <input value={a.reason || ""} onChange={async (e) => {
                                                            const val = e.target.value;
                                                            await supabase.from("mtg_attendances").update({ reason: val }).eq("id", a.id);
                                                            setMtgAttendances(prev => prev.map(x => x.id === a.id ? { ...x, reason: val } : x));
                                                        }} placeholder="欠席理由" style={{ width: 140, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 12, outline: "none" }} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
                {activeTab === "shop" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>🛍️ 新規景品追加</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>タイトル</div>
                                    <input value={shopTitle} onChange={(e) => setShopTitle(e.target.value)} placeholder="例：Amazonギフト券 500円" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>カテゴリ</div>
                                    <input value={shopCategory} onChange={(e) => setShopCategory(e.target.value)} placeholder="例：gift / book / title" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                </div>
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>説明</div>
                                <input value={shopDesc} onChange={(e) => setShopDesc(e.target.value)} placeholder="景品の説明" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>必要ポイント</div>
                                <input type="number" value={shopCost} onChange={(e) => setShopCost(Number(e.target.value))} style={{ width: 120, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none" }} />
                            </div>
                            <button onClick={async () => {
                                if (!shopTitle.trim()) { setShopMessage("タイトルを入力してください"); return; }
                                setShopSaving(true);
                                await supabase.from("shop_items").insert({ title: shopTitle.trim(), description: shopDesc.trim(), cost: shopCost, category: shopCategory.trim() || "other" });
                                const { data: rows } = await supabase.from("shop_items").select("*").order("cost", { ascending: true });
                                setShopItems((rows || []) as ShopItem[]);
                                setShopTitle(""); setShopDesc(""); setShopCost(100); setShopCategory("");
                                setShopMessage("✅ 景品を追加しました");
                                setShopSaving(false);
                            }} disabled={shopSaving} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                                {shopSaving ? "追加中..." : "🛍️ 追加する"}
                            </button>
                            {shopMessage && <div style={{ marginTop: 12, fontSize: 13, color: "#34d399", fontWeight: 600 }}>{shopMessage}</div>}
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>SHOP ITEMS</div>
                            {shopItems.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>景品がありません</div> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {shopItems.map((item) => (
                                        <div key={item.id} style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                            {editingShopId === item.id ? (
                                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                                    <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>📝 編集中</div>
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                                        <div>
                                                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>タイトル</div>
                                                            <input value={editShopTitle} onChange={(e) => setEditShopTitle(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>カテゴリ</div>
                                                            <input value={editShopCategory} onChange={(e) => setEditShopCategory(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>説明</div>
                                                        <input value={editShopDesc} onChange={(e) => setEditShopDesc(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>必要ポイント</div>
                                                        <input type="number" value={editShopCost} onChange={(e) => setEditShopCost(Number(e.target.value))} style={{ width: 120, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none" }} />
                                                    </div>
                                                    <div style={{ display: "flex", gap: 8 }}>
                                                        <button onClick={async () => {
                                                            await supabase.from("shop_items").update({
                                                                title: editShopTitle.trim(),
                                                                description: editShopDesc.trim(),
                                                                cost: editShopCost,
                                                                category: editShopCategory.trim() || "other",
                                                            }).eq("id", item.id);
                                                            setShopItems(prev => prev.map(s => s.id === item.id ? { ...s, title: editShopTitle.trim(), description: editShopDesc.trim(), cost: editShopCost, category: editShopCategory.trim() || "other" } : s));
                                                            setEditingShopId(null);
                                                        }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>💾 保存</button>
                                                        <button onClick={() => setEditingShopId(null)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>キャンセル</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                                            <span style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>{item.title}</span>
                                                            {item.category && <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 11, fontWeight: 600 }}>{item.category}</span>}
                                                        </div>
                                                        {item.description && <div style={{ fontSize: 12, color: "#6b7280" }}>{item.description}</div>}
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                        <span style={{ fontSize: 18, fontWeight: 800, color: "#818cf8" }}>{item.cost}pt</span>
                                                        <button onClick={() => {
                                                            setEditingShopId(item.id);
                                                            setEditShopTitle(item.title || "");
                                                            setEditShopDesc(item.description || "");
                                                            setEditShopCost(item.cost || 0);
                                                            setEditShopCategory(item.category || "");
                                                        }} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>✏️ 編集</button>
                                                        <button onClick={async () => {
                                                            await supabase.from("shop_items").delete().eq("id", item.id);
                                                            setShopItems(prev => prev.filter(s => s.id !== item.id));
                                                        }} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "rgba(248,113,113,0.2)", color: "#f87171", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>削除</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === "challenges" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>🎯 新規チャレンジ追加</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>タイトル</div>
                                    <input value={challengeTitle} onChange={(e) => setChallengeTitle(e.target.value)} placeholder="例：有名なラーメンを食べる" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>カテゴリ</div>
                                    <input value={challengeCategory} onChange={(e) => setChallengeCategory(e.target.value)} placeholder="例：食・旅・スポーツ" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 12, marginBottom: 16 }}>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>説明</div>
                                    <input value={challengeDesc} onChange={(e) => setChallengeDesc(e.target.value)} placeholder="チャレンジの説明（任意）" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>アイコン</div>
                                    <input value={challengeIcon} onChange={(e) => setChallengeIcon(e.target.value)} placeholder="🎯" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 20, outline: "none", boxSizing: "border-box", textAlign: "center" }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, fontWeight: 600 }}>ポイント</div>
                                    <input type="number" value={challengePoints} onChange={(e) => setChallengePoints(Number(e.target.value))} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                                </div>
                            </div>
                            <button onClick={async () => {
                                if (!challengeTitle.trim()) { setChallengeMessage("タイトルを入力してください"); return; }
                                setChallengeSaving(true);
                                await supabase.from("challenges").insert({ title: challengeTitle.trim(), description: challengeDesc.trim() || null, category: challengeCategory.trim() || null, points: challengePoints, icon: challengeIcon || "🎯", is_active: true });
                                const { data: rows } = await supabase.from("challenges").select("*").order("created_at");
                                setChallenges((rows || []) as Challenge[]);
                                setChallengeTitle(""); setChallengeDesc(""); setChallengeCategory(""); setChallengePoints(10); setChallengeIcon("🎯");
                                setChallengeMessage("✅ チャレンジを追加しました！");
                                setChallengeSaving(false);
                            }} disabled={challengeSaving} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                                {challengeSaving ? "追加中..." : "🎯 追加する"}
                            </button>
                            {challengeMessage && <div style={{ marginTop: 12, fontSize: 13, color: "#34d399", fontWeight: 600 }}>{challengeMessage}</div>}
                        </div>

                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>📋 達成申請一覧</div>
                            {challengeSubmissions.filter(s => s.status === "pending").length === 0 ? (
                                <div style={{ color: "#6b7280", fontSize: 14 }}>申請中の達成報告はありません</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {challengeSubmissions.filter(s => s.status === "pending").map(sub => (
                                        <div key={sub.id} style={{ padding: "20px", borderRadius: 12, background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                                                <div style={{ flex: 1, minWidth: 280 }}>
                                                    {/* チャレンジ情報を強調表示 */}
                                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)" }}>
                                                        <span style={{ fontSize: 24 }}>{sub.challengeIcon || "🎯"}</span>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: 14, fontWeight: 800, color: "#f9fafb" }}>{sub.challengeTitle}</div>
                                                            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                                                                {sub.challengeCategory && <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(168,85,247,0.2)", color: "#a855f7", fontSize: 11, fontWeight: 600 }}>{sub.challengeCategory}</span>}
                                                                <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(52,211,153,0.2)", color: "#34d399", fontSize: 11, fontWeight: 700 }}>+{sub.challengePoints || 0}pt</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* ユーザー情報 */}
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                                        <span style={{ fontSize: 13, color: "#9ca3af" }}>👤 申請者:</span>
                                                        <span style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb" }}>{sub.userName}</span>
                                                        <span style={{ fontSize: 11, color: "#6b7280" }}>{formatDateTime(sub.created_at)}</span>
                                                    </div>

                                                    {/* コメント */}
                                                    {sub.comment && (
                                                        <div style={{ marginBottom: 8, padding: "10px 14px", borderRadius: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>💬 コメント</div>
                                                            <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{sub.comment}</div>
                                                        </div>
                                                    )}

                                                    {/* 写真 */}
                                                    {sub.image_url && (
                                                        <div>
                                                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 6 }}>📷 達成写真</div>
                                                            <a href={sub.image_url} target="_blank" rel="noreferrer" style={{ display: "inline-block" }}>
                                                                <img src={sub.image_url} alt="達成写真" style={{ maxWidth: 240, maxHeight: 180, objectFit: "cover", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }} />
                                                            </a>
                                                            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>クリックで拡大表示</div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                                                    <button onClick={async () => {
                                                        const nowIso = new Date().toISOString();
                                                        await supabase.from("challenge_submissions").update({ status: "approved", approved_at: nowIso }).eq("id", sub.id);
                                                        const challenge = challenges.find(c => c.id === sub.challenge_id);
                                                        if (challenge) {
                                                            const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", sub.user_id).single();
                                                            const current = pointRow?.points || 0;
                                                            await supabase.from("user_points").update({ points: current + challenge.points }).eq("id", sub.user_id);
                                                            await supabase.from("points_history").insert({ user_id: sub.user_id, change: challenge.points, reason: "challenge_complete", created_at: nowIso });
                                                        }
                                                        setChallengeSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: "approved" } : s));
                                                    }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #10b981, #34d399)", color: "#0a0a0f", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✅ 承認</button>
                                                    <button onClick={async () => {
                                                        await supabase.from("challenge_submissions").update({ status: "rejected" }).eq("id", sub.id);
                                                        setChallengeSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: "rejected" } : s));
                                                    }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "rgba(248,113,113,0.2)", color: "#f87171", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>❌ 却下</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>CHALLENGES</div>
                            {challenges.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>チャレンジがありません</div> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {challenges.map(c => (
                                        <div key={c.id} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${c.is_active ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)"}` }}>
                                            {editingChallengeId === c.id ? (
                                                /* ===== 編集モード ===== */
                                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                                    <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>📝 編集中</div>
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                                        <div>
                                                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>タイトル</div>
                                                            <input value={editChallengeTitle} onChange={(e) => setEditChallengeTitle(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>カテゴリ</div>
                                                            <input value={editChallengeCategory} onChange={(e) => setEditChallengeCategory(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>説明</div>
                                                        <input value={editChallengeDesc} onChange={(e) => setEditChallengeDesc(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                    </div>
                                                    <div style={{ display: "grid", gridTemplateColumns: "80px 80px", gap: 8 }}>
                                                        <div>
                                                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>アイコン</div>
                                                            <input value={editChallengeIcon} onChange={(e) => setEditChallengeIcon(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 18, outline: "none", boxSizing: "border-box", textAlign: "center" }} />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>ポイント</div>
                                                            <input type="number" value={editChallengePoints} onChange={(e) => setEditChallengePoints(Number(e.target.value))} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.05)", color: "#f9fafb", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                                        </div>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 8 }}>
                                                        <button onClick={async () => {
                                                            await supabase.from("challenges").update({
                                                                title: editChallengeTitle.trim(),
                                                                description: editChallengeDesc.trim() || null,
                                                                category: editChallengeCategory.trim() || null,
                                                                points: editChallengePoints,
                                                                icon: editChallengeIcon || "🎯",
                                                            }).eq("id", c.id);
                                                            setChallenges(prev => prev.map(ch => ch.id === c.id ? { ...ch, title: editChallengeTitle.trim(), description: editChallengeDesc.trim(), category: editChallengeCategory.trim(), points: editChallengePoints, icon: editChallengeIcon || "🎯" } : ch));
                                                            setEditingChallengeId(null);
                                                        }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>💾 保存</button>
                                                        <button onClick={() => setEditingChallengeId(null)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>キャンセル</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* ===== 通常モード ===== */
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                        <span style={{ fontSize: 24 }}>{c.icon}</span>
                                                        <div>
                                                            <div style={{ fontSize: 14, fontWeight: 700, color: c.is_active ? "#f9fafb" : "#6b7280" }}>{c.title}</div>
                                                            <div style={{ fontSize: 12, color: "#6b7280" }}>{c.category} · +{c.points}pt</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 6 }}>
                                                        <button onClick={() => {
                                                            setEditingChallengeId(c.id);
                                                            setEditChallengeTitle(c.title || "");
                                                            setEditChallengeDesc(c.description || "");
                                                            setEditChallengeCategory(c.category || "");
                                                            setEditChallengePoints(c.points || 0);
                                                            setEditChallengeIcon(c.icon || "🎯");
                                                        }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 11, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                            ✏️ 編集
                                                        </button>
                                                        <button onClick={async () => {
                                                            await supabase.from("challenges").update({ is_active: !c.is_active }).eq("id", c.id);
                                                            setChallenges(prev => prev.map(ch => ch.id === c.id ? { ...ch, is_active: !ch.is_active } : ch));
                                                        }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: c.is_active ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)", color: c.is_active ? "#f87171" : "#34d399", fontSize: 11, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                            {c.is_active ? "非表示" : "表示する"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === "kkc" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        <div style={{ padding: "20px 24px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>💡 KKC 課題解決案box</div>
                            <div style={{ fontSize: 12, color: "#9ca3af" }}>ユーザーが投稿した「課題・解決案・結果」を審査。承認すると +1pt 付与されます。</div>
                        </div>

                        <div>
                            <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>⏳ 審査待ち（{problemSolutions.filter(s => s.status === "pending").length}件）</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {problemSolutions.filter(s => s.status === "pending").map((s: any) => {
                                    const submitter = userDetails.find((u: any) => u.id === s.user_id);
                                    return (
                                        <div key={s.id} style={{ padding: 16, borderRadius: 10, background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)" }}>
                                            <div style={{ fontSize: 12, color: "#fbbf24", fontWeight: 700, marginBottom: 4 }}>👤 {submitter?.name || "不明"}</div>
                                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>{new Date(s.created_at).toLocaleString("ja-JP")}</div>

                                            {s.problem_description && (
                                                <div style={{ marginBottom: 8 }}>
                                                    <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 700, letterSpacing: 1, marginBottom: 2 }}>① 課題</div>
                                                    <div style={{ fontSize: 13, color: "#f9fafb", whiteSpace: "pre-wrap", lineHeight: 1.6, padding: 8, borderRadius: 6, background: "rgba(0,0,0,0.2)" }}>{s.problem_description}</div>
                                                </div>
                                            )}
                                            <div style={{ marginBottom: 8 }}>
                                                <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 700, letterSpacing: 1, marginBottom: 2 }}>② 解決案</div>
                                                <div style={{ fontSize: 13, color: "#f9fafb", whiteSpace: "pre-wrap", lineHeight: 1.6, padding: 8, borderRadius: 6, background: "rgba(0,0,0,0.2)" }}>{s.solution}</div>
                                            </div>
                                            {s.result && (
                                                <div style={{ marginBottom: 10 }}>
                                                    <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 700, letterSpacing: 1, marginBottom: 2 }}>③ 結果</div>
                                                    <div style={{ fontSize: 13, color: "#f9fafb", whiteSpace: "pre-wrap", lineHeight: 1.6, padding: 8, borderRadius: 6, background: "rgba(0,0,0,0.2)" }}>{s.result}</div>
                                                </div>
                                            )}

                                            <textarea id={`pc-cmt-${s.id}`} placeholder="コメント（任意）" style={{ width: "100%", minHeight: 50, padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 12, resize: "vertical", fontFamily: "inherit", marginBottom: 8, boxSizing: "border-box" }} />
                                            <div style={{ display: "flex", gap: 8 }}>
                                                <button onClick={async () => {
                                                    const cmtEl = document.getElementById(`pc-cmt-${s.id}`) as HTMLTextAreaElement;
                                                    const nowIso = new Date().toISOString();
                                                    await supabase.from("problem_solutions").update({ status: "approved", admin_comment: cmtEl.value.trim() || null, reviewed_at: nowIso }).eq("id", s.id);
                                                    const { data: ptRow } = await supabase.from("user_points").select("points").eq("id", s.user_id).maybeSingle();
                                                    const currentPt = ptRow?.points || 0;
                                                    await supabase.from("user_points").upsert({ id: s.user_id, points: currentPt + 1 });
                                                    await supabase.from("points_history").insert({ user_id: s.user_id, change: 1, reason: "KKC 解決案承認" });
                                                    setProblemSolutions(prev => prev.map(p => p.id === s.id ? { ...p, status: "approved", admin_comment: cmtEl.value.trim() || null, reviewed_at: nowIso } : p));
                                                }} style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✅ 承認 (+1pt)</button>
                                                <button onClick={async () => {
                                                    const cmtEl = document.getElementById(`pc-cmt-${s.id}`) as HTMLTextAreaElement;
                                                    const nowIso = new Date().toISOString();
                                                    await supabase.from("problem_solutions").update({ status: "rejected", admin_comment: cmtEl.value.trim() || null, reviewed_at: nowIso }).eq("id", s.id);
                                                    setProblemSolutions(prev => prev.map(p => p.id === s.id ? { ...p, status: "rejected", admin_comment: cmtEl.value.trim() || null, reviewed_at: nowIso } : p));
                                                }} style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "rgba(239,68,68,0.2)", color: "#f87171", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>❌ 却下</button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {problemSolutions.filter(s => s.status === "pending").length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#6b7280", fontSize: 13 }}>審査待ちの投稿はありません</div>}
                            </div>
                        </div>

                        <div>
                            <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>📚 処理済み（承認 {problemSolutions.filter(s => s.status === "approved").length}件 / 却下 {problemSolutions.filter(s => s.status === "rejected").length}件）</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {problemSolutions.filter(s => s.status !== "pending").slice(0, 20).map((s: any) => {
                                    const submitter = userDetails.find((u: any) => u.id === s.user_id);
                                    const statusColor = s.status === "approved" ? "#10b981" : "#ef4444";
                                    const statusBg = s.status === "approved" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)";
                                    return (
                                        <div key={s.id} style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                                <span style={{ fontSize: 12, color: "#f9fafb", fontWeight: 700 }}>👤 {submitter?.name || "不明"}</span>
                                                <span style={{ padding: "2px 8px", borderRadius: 4, background: statusBg, color: statusColor, fontSize: 11, fontWeight: 700 }}>{s.status === "approved" ? "承認" : "却下"}</span>
                                            </div>
                                            <div style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{s.problem_description || s.solution}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === "sibyl" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        <div style={{ padding: "20px 24px", borderRadius: 14, background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.2)" }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>👁️ シビュラシステム</div>
                            <div style={{ fontSize: 12, color: "#9ca3af" }}>学歴・MBTI・部活・趣味をもとに5軸評価（地頭・胆力・対人・瞬発・創造）を算出し、事業部適性を診断します。</div>
                        </div>

                        {userDetails.map((u: any) => {
                            const sibyl = calculateSibyl({ mbti: u.mbti || "", education: u.education || "", club: u.club_category || "", hobby: u.hobby_category || "" });
                            const matches = calculateDepartmentMatch(sibyl);
                            const hasData = u.mbti || u.education || u.club_category || u.hobby_category;

                            return (
                                <div key={u.id} style={{ padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb" }}>👤 {u.name}</div>
                                        {!hasData && <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(248,113,113,0.15)", color: "#f87171", fontSize: 11, fontWeight: 700 }}>データ未入力</span>}
                                    </div>

                                    {/* 5軸スコア */}
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 16 }}>
                                        {[
                                            { label: "地頭", value: sibyl.cog, color: "#6366f1" },
                                            { label: "胆力", value: sibyl.grit, color: "#ef4444" },
                                            { label: "対人", value: sibyl.social, color: "#10b981" },
                                            { label: "瞬発", value: sibyl.drive, color: "#f59e0b" },
                                            { label: "創造", value: sibyl.create, color: "#a855f7" },
                                        ].map(ax => (
                                            <div key={ax.label} style={{ padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.3)", textAlign: "center" }}>
                                                <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700, marginBottom: 4 }}>{ax.label}</div>
                                                <div style={{ fontSize: 18, fontWeight: 800, color: ax.color }}>{ax.value}</div>
                                                <div style={{ fontSize: 9, color: "#6b7280" }}>/20</div>
                                                <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                                                    <div style={{ height: "100%", width: `${(ax.value / 20) * 100}%`, background: ax.color }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* 事業部マッチング */}
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontSize: 11, color: "#a78bfa", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>🎯 事業部マッチング</div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            {matches.map((m, idx) => {
                                                const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "  ";
                                                const barColor = idx === 0 ? "#10b981" : idx === 1 ? "#6366f1" : idx === 2 ? "#f59e0b" : "#6b7280";
                                                const maxPossible = 100;
                                                return (
                                                    <div key={m.dept} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                        <div style={{ width: 30, fontSize: 14 }}>{medal}</div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#d1d5db", marginBottom: 2 }}>
                                                                <span>{m.dept}</span>
                                                                <span style={{ color: barColor }}>{m.score}点</span>
                                                            </div>
                                                            <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                                                                <div style={{ height: "100%", width: `${Math.min((m.score / maxPossible) * 100, 100)}%`, background: barColor }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 入力データ編集フォーム */}
                                    <details style={{ marginTop: 12 }}>
                                        <summary style={{ fontSize: 12, color: "#9ca3af", cursor: "pointer", fontWeight: 600, padding: "6px 0" }}>📝 データを編集（{[u.mbti, u.education, u.club_category, u.hobby_category].filter(Boolean).length}/4項目入力済み）</summary>
                                        <div style={{ marginTop: 10, padding: 12, borderRadius: 8, background: "rgba(0,0,0,0.2)" }}>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                                                <div>
                                                    <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>MBTI</div>
                                                    <select id={`sibyl-mbti-${u.id}`} defaultValue={u.mbti || ""} style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 12 }}>
                                                        <option value="">未入力</option>
                                                        {Object.keys(MBTI_SCORES).map(k => <option key={k} value={k}>{k}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>学歴</div>
                                                    <input id={`sibyl-edu-${u.id}`} defaultValue={u.education || ""} placeholder="例：青山学院大学" style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 12, boxSizing: "border-box" }} />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>部活</div>
                                                    <select id={`sibyl-club-${u.id}`} defaultValue={u.club_category || ""} style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 12 }}>
                                                        <option value="">未入力</option>
                                                        {Object.keys(CLUB_SCORES).map(k => <option key={k} value={k}>{k}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, marginBottom: 4 }}>趣味</div>
                                                    <select id={`sibyl-hobby-${u.id}`} defaultValue={u.hobby_category || ""} style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 12 }}>
                                                        <option value="">未入力</option>
                                                        {Object.keys(HOBBY_SCORES).map(k => <option key={k} value={k}>{k}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <button onClick={async () => {
                                                const mbtiEl = document.getElementById(`sibyl-mbti-${u.id}`) as HTMLSelectElement;
                                                const eduEl = document.getElementById(`sibyl-edu-${u.id}`) as HTMLInputElement;
                                                const clubEl = document.getElementById(`sibyl-club-${u.id}`) as HTMLSelectElement;
                                                const hobbyEl = document.getElementById(`sibyl-hobby-${u.id}`) as HTMLSelectElement;
                                                await supabase.from("profiles").update({
                                                    mbti: mbtiEl.value || null,
                                                    education: eduEl.value || null,
                                                    club_category: clubEl.value || null,
                                                    hobby_category: hobbyEl.value || null,
                                                }).eq("id", u.id);
                                                alert("保存しました。ページを再読込して反映を確認してください。");
                                            }} style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>💾 保存</button>
                                        </div>
                                    </details>
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeTab === "tests" && <TestResultsTab />}
            </div>
        </main>
    );
}