"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

type UserRow = { id: string; name: string | null };
type TopUser = { name: string; points: number };
type TopSubmitter = { name: string; count: number };
type ReportRow = { id: string; user_id: string; content: string; created_at: string; userName?: string };
type UserDetail = { id: string; name: string; points: number; streak: number; role: string; editingName?: string; submissionCount: number; thanksCount: number; kpiCount: number; activeDays: number; education: string; team_id?: string; };
type GraphData = { date: string; points: number };
type SubmitGraphData = { date: string; count: number };
type AnnounceRow = { id: string; title: string; content: string; created_at: string; is_active: boolean };
type RequestRow = { id: string; user_id: string; shop_item_id: string; cost: number; status: string; note: string | null; created_at: string; userName?: string; itemTitle?: string };
type KpiStatus = { userId: string; userName: string; kpiId: string; kpiTitle: string; unit: string; target: number; value: number };
type ThanksRow = { id: string; from_user_id: string; to_user_id: string; message: string; created_at: string; fromName?: string; toName?: string };
type ContentCompletion = { userId: string; userName: string; contentId: string; contentTitle: string; created_at: string };
type Team = { id: string; name: string; color: string };
type MonthlyKpiRow = { id: string; user_id: string; department_id: string; year_month: string; target: number; result: number; approved: boolean; points_awarded: number; userName?: string; deptName?: string; officialTarget?: number; };

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
    return date.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getRankScore(params: { level: number; streak: number; submissionCount: number; thanksCount: number; kpiCount: number; activeDays: number; education: string; }): number {
    const { level, streak, submissionCount, thanksCount, kpiCount, activeDays, education } = params;
    const eduScore = education ? 8 : 0;
    const activityScore = Math.min(activeDays * 0.5, 15);
    const kpiScore = Math.min(kpiCount * 3, 15);
    const streakScore = Math.min(streak * 2, 20);
    const leaderScore = Math.min(thanksCount * 2, 10);
    const outputScore = Math.min(submissionCount * 2, 20);
    const metaScore = Math.min(level, 10);
    return Math.min(Math.round(eduScore + activityScore + kpiScore + streakScore + leaderScore + outputScore + metaScore), 100);
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
    const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "announce" | "kpi" | "contents" | "requests" | "teams" | "monthly_kpi">("dashboard");
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [editingPoints, setEditingPoints] = useState<number>(0);
    const [savingUser, setSavingUser] = useState<string | null>(null);
    const [announceTitle, setAnnounceTitle] = useState("");
    const [announceContent, setAnnounceContent] = useState("");
    const [announceList, setAnnounceList] = useState<AnnounceRow[]>([]);
    const [announceSending, setAnnounceSending] = useState(false);
    const [announceMessage, setAnnounceMessage] = useState("");
    const [kpiItems, setKpiItems] = useState<{ id: string; title: string; unit: string; target_value: number; is_active: boolean }[]>([]);
    const [kpiTitle, setKpiTitle] = useState("");
    const [kpiUnit, setKpiUnit] = useState("件");
    const [kpiTarget, setKpiTarget] = useState(0);
    const [kpiSaving, setKpiSaving] = useState(false);
    const [kpiMessage, setKpiMessage] = useState("");
    const [contentsList, setContentsList] = useState<{ id: string; title: string; description: string; content_type: string; url: string; body: string; is_active: boolean }[]>([]);
    const [contentTitle, setContentTitle] = useState("");
    const [contentDesc, setContentDesc] = useState("");
    const [contentType, setContentType] = useState<"video" | "article">("video");
    const [contentUrl, setContentUrl] = useState("");
    const [contentBody, setContentBody] = useState("");
    const [contentSaving, setContentSaving] = useState(false);
    const [contentMessage, setContentMessage] = useState("");
    const [requestsList, setRequestsList] = useState<RequestRow[]>([]);
    const [processingRequest, setProcessingRequest] = useState<string | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [monthlyKpis, setMonthlyKpis] = useState<MonthlyKpiRow[]>([]);
    const [kpiMonth, setKpiMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    });
    const [approvingKpi, setApprovingKpi] = useState<string | null>(null);
    const [targetInputs, setTargetInputs] = useState<Record<string, number>>({});
    const [monthlyTargets, setMonthlyTargets] = useState<{ user_id: string; department_id: string; target: number }[]>([]);
    const [teamName, setTeamName] = useState("");
    const [teamColor, setTeamColor] = useState("#6366f1");
    const [teamMessage, setTeamMessage] = useState("");
    const [teamSaving, setTeamSaving] = useState(false);
    const [kpiStatuses, setKpiStatuses] = useState<KpiStatus[]>([]);
    const [thanksList, setThanksList] = useState<ThanksRow[]>([]);
    const [contentCompletions, setContentCompletions] = useState<ContentCompletion[]>([]);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviting, setInviting] = useState(false);
    const [inviteMessage, setInviteMessage] = useState("");

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map(e => e.trim());
            if (!user.email || !adminEmails.includes(user.email)) { router.push("/mypage"); return; }

            const { data: profileRows } = await supabase.from("profiles").select("id, name, role, streak, started_at, education, department_id, team_id");
            const users = (profileRows || []) as UserRow[];
            setUserCount(users.length);

            const { data: pointRows } = await supabase.from("user_points").select("id, points");
            const { data: thanksSentRows } = await supabase.from("thanks").select("from_user_id");
            const { data: kpiLogRows } = await supabase.from("kpi_logs").select("user_id");
            const { data: subCountRows } = await supabase.from("submissions").select("user_id");

            const details: UserDetail[] = (profileRows || []).map((p: any) => {
                const activeDays = p.started_at
                    ? Math.floor((Date.now() - new Date(p.started_at).getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                return {
                    id: p.id,
                    name: p.name || "名前未設定",
                    points: pointRows?.find((pt: any) => pt.id === p.id)?.points || 0,
                    streak: p.streak || 0,
                    role: p.role || "Owner",
                    submissionCount: subCountRows?.filter((r: any) => r.user_id === p.id).length || 0,
                    thanksCount: thanksSentRows?.filter((r: any) => r.from_user_id === p.id).length || 0,
                    kpiCount: kpiLogRows?.filter((r: any) => r.user_id === p.id).length || 0,
                    activeDays,
                    education: p.education || "",
                    team_id: p.team_id || "",
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
                    userId: r.user_id,
                    userName: users.find(u => u.id === r.user_id)?.name || "名前未設定",
                    contentId: r.content_id,
                    contentTitle: contentsRows.find((c: any) => c.id === r.content_id)?.title || "不明",
                    created_at: r.created_at,
                })));
            }
            // チーム取得
            const { data: teamRows } = await supabase.from("teams").select("*").order("created_at");
            setTeams((teamRows || []) as Team[]);
            // 月次KPI取得
            const { data: monthlyKpiRows } = await supabase.from("monthly_kpi").select("*").eq("year_month", kpiMonth).order("created_at", { ascending: false });
            const { data: deptRows2 } = await supabase.from("departments").select("*");
            setMonthlyKpis((monthlyKpiRows || []).map((k: any) => ({
                ...k,
                userName: users.find(u => u.id === k.user_id)?.name || "名前未設定",
                deptName: deptRows2?.find((d: any) => d.id === k.department_id)?.name || "不明",
            })));
            // 月次目標取得
            const { data: targetRows } = await supabase.from("monthly_targets").select("*").eq("year_month", kpiMonth);
            setMonthlyTargets((targetRows || []) as { user_id: string; department_id: string; target: number }[]);
            setLoading(false);
        };
        load();
    }, [period, router]);

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
        await supabase.from("points_history").insert({
            user_id: userId,
            change: amount,
            reason: "manual_add",
            created_at: new Date().toISOString(),
        });
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
        const handleSetTarget = async (userId: string, deptId: string, target: number) => {
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from("monthly_targets").upsert({
                user_id: userId,
                department_id: deptId,
                year_month: kpiMonth,
                target,
                set_by: user?.id,
            }, { onConflict: "user_id,department_id,year_month" });
        };
        const nowIso = new Date().toISOString();
        await supabase.from("monthly_kpi").update({
            approved: true,
            approved_at: nowIso,
            points_awarded: kpi.points_awarded,
        }).eq("id", kpi.id);

        // ポイント付与
        const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", kpi.user_id).single();
        const current = pointRow?.points || 0;
        await supabase.from("user_points").update({ points: current + kpi.points_awarded }).eq("id", kpi.user_id);
        await supabase.from("points_history").insert({
            user_id: kpi.user_id,
            change: kpi.points_awarded,
            reason: "kpi_achievement",
            created_at: nowIso,
        });

        setMonthlyKpis(prev => prev.map(k => k.id === kpi.id ? { ...k, approved: true } : k));
        setApprovingKpi(null);
    };
    const handleSetTarget = async (userId: string, deptId: string, target: number) => {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("monthly_targets").upsert({
            user_id: userId,
            department_id: deptId,
            year_month: kpiMonth,
            target,
            set_by: user?.id,
        }, { onConflict: "user_id,department_id,year_month" });
    };
    const handleAssignTeam = async (userId: string, teamId: string) => {
        await supabase.from("profiles").update({ team_id: teamId || null }).eq("id", userId);
        setUserDetails(prev => prev.map(u => u.id === userId ? { ...u, team_id: teamId } : u));
    };
    const handleInvite = async () => {
        if (!inviteEmail.trim()) { setInviteMessage("メールアドレスを入力してください"); return; }
        setInviting(true);
        setInviteMessage("");
        const res = await fetch("/api/invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: inviteEmail.trim() }),
        });
        const data = await res.json();
        if (data.error) {
            setInviteMessage("招待に失敗しました: " + data.error);
        } else {
            setInviteMessage(`✅ ${inviteEmail} に招待メールを送信しました！`);
            setInviteEmail("");
        }
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
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>USER MANAGEMENT</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {userDetails.sort((a, b) => b.points - a.points).map((u, i) => (
                                    <div key={u.id} style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff" }}>{u.name.charAt(0)}</div>
                                                <div>
                                                    <div style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb" }}>{u.name}</div>
                                                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>役割: {u.role}</div>
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                {editingUser === u.id ? (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                            <span style={{ fontSize: 12, color: "#6b7280" }}>名前:</span>
                                                            <input type="text" value={u.editingName ?? u.name} onChange={(e) => setUserDetails(prev => prev.map(u2 => u2.id === u.id ? { ...u2, editingName: e.target.value } : u2))} style={{ width: 160, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.1)", color: "#f9fafb", fontSize: 14, outline: "none" }} />
                                                        </div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                            <span style={{ fontSize: 12, color: "#6b7280" }}>ポイント:</span>
                                                            <input type="number" value={editingPoints} onChange={(e) => setEditingPoints(Number(e.target.value))} style={{ width: 100, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.1)", color: "#f9fafb", fontSize: 14, outline: "none" }} />
                                                        </div>
                                                        <div style={{ display: "flex", gap: 8 }}>
                                                            <button onClick={() => handleSaveUser(u.id)} disabled={savingUser === u.id} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{savingUser === u.id ? "保存中..." : "保存"}</button>
                                                            <button onClick={() => setEditingUser(null)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", fontSize: 12, cursor: "pointer" }}>キャンセル</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        {(() => {
                                                            const level = Math.max(1, Math.floor(u.points / 100) + 1);
                                                            const score = getRankScore({ level, streak: u.streak, submissionCount: u.submissionCount, thanksCount: u.thanksCount, kpiCount: u.kpiCount, activeDays: u.activeDays, education: u.education });
                                                            const rank = getRank(score);
                                                            const color = getRankColor(rank);
                                                            return (
                                                                <div style={{ textAlign: "center", marginRight: 8 }}>
                                                                    <div style={{ width: 44, height: 44, borderRadius: 10, background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#fff" }}>{rank}</div>
                                                                    <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{score}pt</div>
                                                                </div>
                                                            );
                                                        })()}
                                                        <div style={{ textAlign: "right" }}>
                                                            <div style={{ fontSize: 20, fontWeight: 800, color: "#818cf8" }}>{u.points.toLocaleString()}pt</div>
                                                            <div style={{ fontSize: 11, color: "#6b7280" }}>{i + 1}位</div>
                                                        </div>
                                                        <button onClick={() => router.push(`/admin/user/${u.id}`)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.1)", color: "#818cf8", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>詳細</button>
                                                        <div style={{ display: "flex", gap: 4 }}>
                                                            {[10, 50, 100].map(amount => (
                                                                <button key={amount} onClick={() => handleAddPoints(u.id, amount)} style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "rgba(52,211,153,0.15)", color: "#34d399", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>+{amount}</button>
                                                            ))}
                                                        </div>
                                                        <button onClick={() => { setEditingUser(u.id); setEditingPoints(u.points); setUserDetails(prev => prev.map(u2 => u2.id === u.id ? { ...u2, editingName: u.name } : u2)); }} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#d1d5db", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>編集</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
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
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 14, fontWeight: 700, color: item.is_active ? "#f9fafb" : "#6b7280", marginBottom: 4 }}>{item.title}</div>
                                                    <div style={{ fontSize: 13, color: item.is_active ? "#9ca3af" : "#4b5563", lineHeight: 1.6 }}>{item.content}</div>
                                                    <div style={{ fontSize: 11, color: "#4b5563", marginTop: 6 }}>{formatDateTime(item.created_at)}</div>
                                                </div>
                                                <button onClick={async () => { await supabase.from("announcements").update({ is_active: !item.is_active }).eq("id", item.id); setAnnounceList(prev => prev.map(a => a.id === item.id ? { ...a, is_active: !a.is_active } : a)); }} style={{ marginLeft: 12, padding: "4px 10px", borderRadius: 6, border: "none", background: item.is_active ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)", color: item.is_active ? "#f87171" : "#34d399", fontSize: 11, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                    {item.is_active ? "非表示" : "表示する"}
                                                </button>
                                            </div>
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
                                        <div key={item.id} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${item.is_active ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: item.is_active ? "#f9fafb" : "#6b7280" }}>{item.title}</div>
                                                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>単位: {item.unit}　目標: {item.target_value}{item.unit}</div>
                                            </div>
                                            <button onClick={async () => { await supabase.from("kpi_items").update({ is_active: !item.is_active }).eq("id", item.id); setKpiItems(prev => prev.map(k => k.id === item.id ? { ...k, is_active: !k.is_active } : k)); }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: item.is_active ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)", color: item.is_active ? "#f87171" : "#34d399", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                                                {item.is_active ? "無効にする" : "有効にする"}
                                            </button>
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
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>CONTENTS</div>
                            {contentsList.length === 0 ? <div style={{ color: "#6b7280", fontSize: 14 }}>コンテンツがありません</div> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {contentsList.map((item) => (
                                        <div key={item.id} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${item.is_active ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <span>{item.content_type === "video" ? "▶️" : "📄"}</span>
                                                    <span style={{ fontSize: 14, fontWeight: 700, color: item.is_active ? "#f9fafb" : "#6b7280" }}>{item.title}</span>
                                                </div>
                                                {item.description && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{item.description}</div>}
                                            </div>
                                            <button onClick={async () => { await supabase.from("contents").update({ is_active: !item.is_active }).eq("id", item.id); setContentsList(prev => prev.map(c => c.id === item.id ? { ...c, is_active: !c.is_active } : c)); }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: item.is_active ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)", color: item.is_active ? "#f87171" : "#34d399", fontSize: 11, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                {item.is_active ? "非表示" : "表示する"}
                                            </button>
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
                {/* チームタブ */}
                {activeTab === "teams" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* チーム作成 */}
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>👥 新規チーム作成</div>
                            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                                <input
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    placeholder="代理店名を入力（例：〇〇代理店）"
                                    style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 14, outline: "none" }}
                                />
                                <button
                                    onClick={handleCreateTeam}
                                    disabled={teamSaving}
                                    style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
                                >
                                    {teamSaving ? "作成中..." : "作成"}
                                </button>
                            </div>
                            {teamMessage && <div style={{ fontSize: 13, color: "#34d399", fontWeight: 600 }}>{teamMessage}</div>}
                        </div>

                        {/* チーム一覧＆メンバー割り当て */}
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>メンバー割り当て</div>
                            {teams.length === 0 ? (
                                <div style={{ color: "#6b7280", fontSize: 14 }}>チームがありません。先にチームを作成してください。</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {userDetails.map((u) => (
                                        <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <div style={{ width: 36, height: 36, borderRadius: 8, background: teams.find(t => t.id === u.team_id)?.color || "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>{u.name.charAt(0)}</div>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: "#f9fafb" }}>{u.name}</div>
                                            </div>
                                            <select
                                                value={u.team_id || ""}
                                                onChange={(e) => handleAssignTeam(u.id, e.target.value)}
                                                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#1a1a2e", color: "#f9fafb", fontSize: 13, outline: "none", cursor: "pointer" }}
                                            >
                                                <option value="">チームなし</option>
                                                {teams.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* チームランキング */}
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>🏆 チームランキング</div>
                            {teams.length === 0 ? (
                                <div style={{ color: "#6b7280", fontSize: 14 }}>チームがありません</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {teams.map((team) => {
                                        const members = userDetails.filter(u => u.team_id === team.id);
                                        const totalPoints = members.reduce((sum, u) => sum + u.points, 0);
                                        return { ...team, members, totalPoints };
                                    }).sort((a, b) => b.totalPoints - a.totalPoints).map((team, i) => {
                                        const { id, name, color, members, totalPoints } = team;
                                        return (
                                            <div key={team.id} style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${team.color}40` }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: team.color }} />
                                                        <span style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb" }}>{["🥇", "🥈", "🥉"][i] || `${i + 1}.`} {team.name}</span>
                                                        <span style={{ fontSize: 12, color: "#6b7280" }}>{team.members.length}人</span>
                                                    </div>
                                                    <span style={{ fontSize: 20, fontWeight: 800, color: team.color }}>{totalPoints.toLocaleString()}pt</span>
                                                </div>
                                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                    {team.members.map(m => (
                                                        <div key={m.id} style={{ padding: "4px 10px", borderRadius: 6, background: `${team.color}20`, border: `1px solid ${team.color}40`, fontSize: 12, color: "#d1d5db" }}>
                                                            {m.name} {m.points}pt
                                                        </div>
                                                    ))}
                                                    {team.members.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>メンバーなし</div>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === "dashboard" && (
                    <>
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
                {/* 月次KPI承認タブ */}
                {activeTab === "monthly_kpi" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2 }}>月次KPI管理</div>
                            <select
                                value={kpiMonth}
                                onChange={(e) => setKpiMonth(e.target.value)}
                                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#1a1a2e", color: "#f9fafb", fontSize: 13, outline: "none" }}
                            >
                                {Array.from({ length: 6 }, (_, i) => {
                                    const d = new Date();
                                    d.setMonth(d.getMonth() - i);
                                    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                                    return <option key={ym} value={ym}>{ym}</option>;
                                })}
                            </select>
                        </div>

                        {/* 目標設定セクション */}
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>🎯 目標設定</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {userDetails.map((u) => {
                                    const dept = teams.find(t => t.id === u.team_id);
                                    const deptInfo = ([] as any[]);
                                    return (
                                        <div key={u.id} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <div>
                                                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>{u.name}</div>
                                                    <div style={{ fontSize: 12, color: "#6b7280" }}>事業部: {u.role}</div>
                                                </div>
                                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                    {/* 各事業部の目標入力 */}
                                                    {monthlyKpis.filter(k => k.user_id === u.id).map(kpi => {
                                                        const key = `${u.id}_${kpi.department_id}`;
                                                        const currentTarget = monthlyTargets.find(t => t.user_id === u.id && t.department_id === kpi.department_id)?.target || kpi.target;
                                                        return (
                                                            <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                <span style={{ fontSize: 12, color: "#9ca3af" }}>{kpi.deptName}目標:</span>
                                                                <input
                                                                    type="number"
                                                                    defaultValue={currentTarget}
                                                                    onChange={(e) => setTargetInputs(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                                                                    style={{ width: 70, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 13, outline: "none" }}
                                                                />
                                                                <button
                                                                    onClick={async () => {
                                                                        const val = targetInputs[key] ?? currentTarget;
                                                                        await handleSetTarget(u.id, kpi.department_id, val);
                                                                        setMonthlyTargets(prev => {
                                                                            const exists = prev.find(t => t.user_id === u.id && t.department_id === kpi.department_id);
                                                                            if (exists) return prev.map(t => t.user_id === u.id && t.department_id === kpi.department_id ? { ...t, target: val } : t);
                                                                            return [...prev, { user_id: u.id, department_id: kpi.department_id, target: val }];
                                                                        });
                                                                    }}
                                                                    style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                                                >
                                                                    設定
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                    {monthlyKpis.filter(k => k.user_id === u.id).length === 0 && (
                                                        <div style={{ fontSize: 12, color: "#6b7280" }}>KPI未入力</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 承認セクション */}
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 24 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, letterSpacing: 2, marginBottom: 16 }}>✅ KPI承認</div>
                            {monthlyKpis.length === 0 ? (
                                <div style={{ textAlign: "center", color: "#6b7280", fontSize: 14, padding: 20 }}>
                                    {kpiMonth}のKPIデータがありません
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {monthlyKpis.map((kpi) => {
                                        const officialTarget = monthlyTargets.find(t => t.user_id === kpi.user_id && t.department_id === kpi.department_id)?.target || kpi.target;
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
                                                        <button
                                                            onClick={() => handleApproveKpi({ ...kpi, target: officialTarget, points_awarded: pts })}
                                                            disabled={approvingKpi === kpi.id}
                                                            style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: pts > 0 ? "linear-gradient(135deg, #10b981, #34d399)" : "rgba(255,255,255,0.1)", color: pts > 0 ? "#0a0a0f" : "#6b7280", fontWeight: 700, cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" }}
                                                        >
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
            </div>
        </main>
    );
}
