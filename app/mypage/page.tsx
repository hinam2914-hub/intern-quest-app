"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { computeReportStreak } from "../lib/date";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";
import { AnimatePresence, motion } from "framer-motion";
import DotKun from "../components/DotKun";

type PointHistory = {
    id?: string;
    user_id: string;
    change: number;
    created_at: string;
    reason?: string | null;
};

type ProfileRow = {
    id: string;
    name?: string | null;
    streak?: number | null;
    last_report_date?: string | null;
    education?: string | null;
    started_at?: string | null;
    birthday?: string | null;
};

type GraphData = { date: string; points: number };

type Badge = {
    id: string;
    icon: string;
    name: string;
    description: string;
    unlocked: boolean;
};

type Trophy = {
    id: string;
    icon: string;
    name: string;
    description: string;
    rarity: "common" | "rare" | "epic" | "legendary";
    unlocked: boolean;
};

type UserTag = { id: string; tag: string; };

// パーティクル型
type Particle = {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    life: number;
    maxLife: number;
    shape: "circle" | "star" | "rect" | "sparkle";
};

// フローティングポイント型
type FloatingPoint = {
    id: number;
    x: number;
    y: number;
    value: number;
};

function jstYesterday(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}
function yesterdayRangeUTC(): { start: string; end: string } {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jstNow.getUTCFullYear(), m = jstNow.getUTCMonth(), d = jstNow.getUTCDate();
  const todayJst0_utc = Date.UTC(y, m, d) - 9 * 60 * 60 * 1000;
  const start = new Date(todayJst0_utc - 24 * 60 * 60 * 1000).toISOString();
  const end = new Date(todayJst0_utc).toISOString();
  return { start, end };
}
function countEmojiKing(s: string): number {
  const m = s.match(/\p{Extended_Pictographic}/gu);
  return m ? m.length : 0;
}
type MyKing = { emoji: string; title: string; dotkun: string };
function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function isSameJSTDay(value: string, targetYmd: string): boolean {
    const date = new Date(value);
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(jst.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}` === targetYmd;
}

function formatDateTimeJST(value: string): string {
    const date = new Date(value);
    return date.toLocaleString("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatReason(reason?: string | null): string {
    if (!reason) return "ポイント追加";
    if (reason === "manual_add") return "手動追加";
    if (reason === "login_bonus") return "ログインボーナス";
    if (reason === "report_submit") return "日報提出";
    if (reason === "streak_bonus") return "連続提出ボーナス";
    if (reason === "content_complete") return "学習完了";
    if (reason === "thanks_received") return "サンキュー受領";
    if (reason === "shop_purchase") return "ショップ購入";
    if (reason === "gacha_spend") return "🎰 ガチャ消費";
    if (reason === "gacha_reward") return "🎰 ガチャ獲得";
    if (reason === "admin_edit") return "管理者編集";
    if (reason === "team_achievement") return "チーム達成ボーナス";
    return reason;
}

function getLevel(points: number): number { return Math.max(1, Math.floor(points / 100) + 1); }
function getExp(points: number): number { return points % 100; }
function getBadgeLabel(level: number): string {
    if (level >= 15) return "達人";
    if (level >= 10) return "上級者";
    if (level >= 5) return "中級者";
    return "初級者";
}
function getBadgeColor(level: number): string {
    if (level >= 15) return "linear-gradient(135deg, #f59e0b, #ef4444)";
    if (level >= 10) return "linear-gradient(135deg, #6366f1, #8b5cf6)";
    if (level >= 5) return "linear-gradient(135deg, #06b6d4, #3b82f6)";
    return "linear-gradient(135deg, #374151, #6b7280)";
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
    if (rank === "SS") return "linear-gradient(135deg, #f59e0b, #ef4444)";
    if (rank === "S") return "linear-gradient(135deg, #a855f7, #ec4899)";
    if (rank === "A") return "linear-gradient(135deg, #6366f1, #3b82f6)";
    if (rank === "B") return "linear-gradient(135deg, #06b6d4, #10b981)";
    if (rank === "C") return "linear-gradient(135deg, #84cc16, #22c55e)";
    return "linear-gradient(135deg, #374151, #6b7280)";
}
function getEducationScore(education: string): number {
    if (!education) return 0;
    const e = education;
    // 旧帝大 10点
    if (/東京大学|^東大|京都大学|^京大|大阪大学|^阪大|名古屋大学|^名大|東北大学|九州大学|^九大|北海道大学|^北大/.test(e)) return 10;
    // 早慶上 8点
    if (/早稲田|慶應|慶応|上智/.test(e)) return 8;
    // GMARCH 6点
    if (/学習院|明治大学|^明大|青山学院|立教|中央大学|^中大|法政/.test(e)) return 6;
    // 成成明学獨國武 5点
    if (/成城|成蹊|明治学院|獨協|國學院|国学院|武蔵大学|武蔵大/.test(e)) return 5;
    // 日東駒専 4点
    if (/日本大学|^日大|東洋大学|^東洋|駒澤|駒沢|専修/.test(e)) return 4;
    return 2; // それ以下
}
function getRankScore(params: {
    level: number; thanksCount: number; activeDays: number; education: string;
    approvedKpiCount: number; kkcApprovedCount: number; esUpdateCount: number; mentorCount: number;
}): number {
    const { level, thanksCount, activeDays, education, approvedKpiCount, kkcApprovedCount, esUpdateCount, mentorCount } = params;
    const eduScore = getEducationScore(education);
    const activityScore = Math.min(activeDays * (15 / 730), 15);
    const kpiScore = Math.min(approvedKpiCount * 0.75, 15);
    const thinkingScore = Math.min(kkcApprovedCount, 20);
    const leaderScore = Math.min(Math.floor((thanksCount + mentorCount) / 20), 10);
    const outputScore = Math.min(Math.floor(esUpdateCount / 10), 20);
    const metaScore = Math.min(level * (4 / 15), 10);
    return Math.min(Math.round(eduScore + activityScore + kpiScore + thinkingScore + leaderScore + outputScore + metaScore), 100);
}
function getNextRankInfo(rank: string): string {
    if (rank === "SS") return "最高ランク到達！";
    if (rank === "S") return "あと少しでSS到達";
    if (rank === "A") return "Sランクを目指そう";
    if (rank === "B") return "Aランクを目指そう";
    if (rank === "C") return "Bランクを目指そう";
    return "Cランクを目指そう";
}
function getActionMessage(isSubmitted: boolean, streak: number): string {
    if (!isSubmitted) return "📋 日報を提出しよう";
    if (streak >= 7) return "🔥 連続提出が素晴らしい。この調子で継続しましょう";
    if (streak >= 3) return "⚡ 継続できています。次は上位を狙いましょう";
    return "📚 学習コンテンツを進めましょう";
}
function generateAIComment(params: { name: string; level: number; rank2: string; rankScore: number; streak: number; isSubmitted: boolean; points: number; hasScheduleToday: boolean }): string {
    const { name, level, rank2, streak, isSubmitted, points, hasScheduleToday } = params;
    const hour = new Date().getHours();
    // 朝（〜10時）：スケジュール設計へ誘導
    if (hour < 10) {
        if (!hasScheduleToday) return `${name}さん、おはよう！まずは今日のスケジュールを立てよう。何をやるか決めると、1日がぐっと動きやすくなるよ。`;
        return `${name}さん、おはよう！もう今日のスケジュールを立てたんだね、えらい！あとはひとつずつ進めていこう。`;
    }
    // 夜（18時〜）：振り返りと日報へ誘導
    if (hour >= 18) {
        if (!isSubmitted) return `${name}さん、今日もお疲れさま。今日のスケジュールを振り返って、日報を書こう。1日の終わりに記録を残すと、明日の自分がラクになるよ。`;
        return `${name}さん、今日もしっかりやりきったね、えらい！日報も提出済み。ゆっくり休んでね。`;
    }
    // 日中：軽く励ます（未提出でもまだ催促しすぎない）
    if (hour >= 10 && hour < 18 && !isSubmitted && streak >= 3) {
        return `${name}さん、${streak}日連続提出中だね。今日も夜には振り返りと日報、忘れずに。その調子！`;
    }
    if (!isSubmitted && streak <= 1) return `${name}さん、今日はまだ日報が未提出です。小さな一歩でも記録することで成長が加速します。今すぐ提出しましょう！`;
    if (streak >= 7) return `${name}さん、${streak}日連続提出は本物の習慣力の証です。この継続力こそが市場価値を高める最大の武器。ランク${rank2}はあなたの実力を正しく示しています。`;
    if (streak >= 3) return `${name}さん、${streak}日連続で素晴らしい！継続は最強のスキルです。このペースを維持すればランクアップも近いです。`;
    if (rank2 === "SS" || rank2 === "S") return `${name}さん、ランク${rank2}到達おめでとうございます！トップクラスの成長速度です。`;
    if (level >= 10) return `${name}さん、Lv.${level}まで成長しました。${points}ptという実績はあなたの努力の証。`;
    if (points < 100) return `${name}さん、まだ始まったばかりです。毎日の日報提出を続けることで、一気に成長できます。`;
    return `${name}さん、着実に成長しています。日報の継続とKPI達成を意識することで、さらに上のランクが見えてきます。`;
}

function getDotKunSuggestion(p: { thanksCount: number; mentorCount: number; kkcApprovedCount: number; esUpdateCount: number; approvedKpiCount: number; challengeCount: number; contentCompletionCount: number; points: number }): string {
    const stats = [
        { count: p.thanksCount, msg: `💖 サンキューを${p.thanksCount}回も受け取ってるね。周りから感謝される人だ。` },
        { count: p.esUpdateCount, msg: `✍️ ESを${p.esUpdateCount}回も更新してる。自己分析の努力家だね。` },
        { count: p.challengeCount, msg: `🎯 ライフチャレンジを${p.challengeCount}個も達成。挑戦する姿勢が素敵だ。` },
        { count: p.contentCompletionCount, msg: `📚 学習コンテンツを${p.contentCompletionCount}本完了。学び続ける力がすごい。` },
        { count: p.kkcApprovedCount, msg: `💡 メダカBOXで${p.kkcApprovedCount}件も貢献。組織を良くする視点を持ってるね。` },
        { count: p.mentorCount, msg: `🤝 ペイフォワードを${p.mentorCount}回。後輩思いの先輩だ。` },
        { count: p.approvedKpiCount, msg: `📊 KPIを${p.approvedKpiCount}回も達成。成果で示せる人だ。` },
    ];
    const top = stats.filter((s) => s.count > 0).sort((a, b) => b.count - a.count)[0];
    if (top) return top.msg;
    return "🌱 これから色々な活動に挑戦していこう。ドットくんが応援してるよ！";
}
function getDailyMission(p: { hour: number; hasScheduleToday: boolean; isSubmitted: boolean; todayThanksDone: boolean; todayLearnDone: boolean; todayKpiDone: boolean; challengeCount: number; mentorCount: number; kkcApprovedCount: number }): string {
    if (p.hour < 12 && !p.hasScheduleToday) return "まずは今日のスケジュールを立てよう。何をやるか決めると一日が動きやすくなるよ。";
    if (!p.todayThanksDone) return "誰かにサンキューを送ってみよう。感謝を伝えると、自分もちょっと嬉しくなるよ。";
    if (!p.todayLearnDone) return "学習コンテンツを1つ進めよう。今日の小さな一歩が未来の武器になるよ。";
    if (!p.todayKpiDone) return "今日の数字（KPI）を記録しよう。成果は数で見えると面白くなるよ。";
    if (p.challengeCount < 1) return "ライフチャレンジに挑戦してみよう。小さな目標を立てると毎日が変わるよ。";
    if (p.kkcApprovedCount < 1) return "メダカBOXに気づきや課題を投稿してみよう。きみの声が組織を動かすよ。";
    if (p.mentorCount < 1) return "後輩を連れて行ったら、ペイフォワード報告をしてみよう。誰かを助けると自分も伸びるよ。";
    return "今日のミッションは全部クリア！本当によくがんばったね。ゆっくり休んでね。";
}

type Suggestion = { icon: string; text: string; href: string; cta: string };
function getSuggestions(p: { thinkingAnswerCount: number; challengeCount: number; mbti: string; points: number; isSubmitted: boolean; streak: number; contentCompletionCount: number; education: string; kkcApprovedCount: number }): Suggestion[] {
    const list: Suggestion[] = [];
    if (p.thinkingAnswerCount === 0) list.push({ icon: "🧠", text: "今日の思考クエストで一緒に頭を動かそうよ！きみの考え、聞かせてほしいな", href: "/thinking", cta: "答える" });
    if (!p.mbti) list.push({ icon: "🔮", text: "プロフィールを埋めてくれたら、シビュラできみの適性を占えるよ！", href: "/mypage", cta: "入力する" });
    if (p.challengeCount === 0) list.push({ icon: "🎯", text: "ライフチャレンジ、まだ見てないでしょ？楽しみながらポイント貯まるよ！", href: "/challenge", cta: "見てみる" });
    if (p.points < 500) list.push({ icon: "💰", text: "ライフチャレンジやテストで、ポイントどんどん貯められるよ！一緒にやろう", href: "/challenge", cta: "稼ぐ" });
    if (p.contentCompletionCount === 0) list.push({ icon: "📚", text: "学習コンテンツで新しい武器を手に入れちゃおう！きみならできる", href: "/learn", cta: "学ぶ" });
    if (!p.education) list.push({ icon: "🎓", text: "学歴を教えてくれると、シビュラの診断がもっと当たるようになるよ！", href: "/mypage", cta: "入力する" });
    if (p.kkcApprovedCount === 0) list.push({ icon: "🐟", text: "メダカBOXにきみの気づき、投稿してみてよ！組織を動かす一言になるかも", href: "/medaka", cta: "投稿する" });
    if (p.thinkingAnswerCount > 0 && p.thinkingAnswerCount < 5) list.push({ icon: "🧠", text: "思考クエスト、いい感じ！この調子でどんどん答えていこう", href: "/thinking", cta: "答える" });
    if (p.challengeCount > 0 && p.challengeCount < 3) list.push({ icon: "🎯", text: "ライフチャレンジ、もっと増やしていこうよ！応援してるね", href: "/challenge", cta: "見てみる" });
    return list;
}
function buildGraphData(history: PointHistory[]): GraphData[] {
    const dayMap: Record<string, number> = {};
    [...history].reverse().forEach((item) => {
        const date = new Date(item.created_at);
        const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
        const key = `${jst.getUTCMonth() + 1}/${jst.getUTCDate()}`;
        dayMap[key] = (dayMap[key] || 0) + item.change;
    });
    let cumulative = 0;
    return Object.entries(dayMap).map(([date, pts]) => {
        cumulative += pts;
        return { date, points: cumulative };
    });
}

type ProfileFlags = {
    quiz_passed?: boolean;
    mentor_passed?: boolean;
    marketer_passed?: boolean;
    sales_passed?: boolean;
    planner_passed?: boolean;
    entrepreneur_passed?: boolean;
    manager_passed?: boolean;
    retention_passed?: boolean;
};

function getBadges(points: number, streak: number, esCompleted: boolean, flags: ProfileFlags, contentCompletionCount: number): Badge[] {
    return [
        // テスト合格バッジ（8個）
        { id: "quiz_passed", icon: "🧠", name: "確認ワーク合格", description: "確認ワークテスト合格", unlocked: !!flags.quiz_passed },
        { id: "mentor_passed", icon: "🌱", name: "メンター合格", description: "メンターテスト合格", unlocked: !!flags.mentor_passed },
        { id: "marketer_passed", icon: "📊", name: "マーケター適性", description: "マーケター適性テストAランク", unlocked: !!flags.marketer_passed },
        { id: "sales_passed", icon: "💼", name: "営業デビュー", description: "営業デビュー適性テストAランク", unlocked: !!flags.sales_passed },
        { id: "planner_passed", icon: "💡", name: "企画職適性", description: "企画職適性テストAランク", unlocked: !!flags.planner_passed },
        { id: "entrepreneur_passed", icon: "🚀", name: "起業適性", description: "起業適性テストAランク", unlocked: !!flags.entrepreneur_passed },
        { id: "manager_passed", icon: "👔", name: "マネージャー", description: "マネージャーテスト合格", unlocked: !!flags.manager_passed },
        { id: "retention_passed", icon: "🔥", name: "Dot.A雇用", description: "Dot.A雇用テスト合格", unlocked: !!flags.retention_passed },
        // ポイント達成系（3個）
        { id: "newbie", icon: "🌟", name: "新人", description: "100pt達成", unlocked: points >= 100 },
        { id: "growing", icon: "⭐", name: "成長中", description: "500pt達成", unlocked: points >= 500 },
        { id: "ace", icon: "🏆", name: "エース", description: "1000pt達成", unlocked: points >= 1000 },
        // 継続・基本系（4個）
        { id: "first_step", icon: "🔥", name: "はじめの一歩", description: "3日連続提出", unlocked: streak >= 3 },
        { id: "keep_going", icon: "⚡", name: "継続の力", description: "7日連続提出", unlocked: streak >= 7 },
        { id: "es_writer", icon: "📝", name: "ES記入者", description: "総合ES初回完成", unlocked: esCompleted },
        { id: "learn_debut", icon: "📚", name: "学習デビュー", description: "学習コンテンツ初完了", unlocked: contentCompletionCount >= 1 },
    ];
}

function getTrophies(params: { points: number; streak: number; submissionCount: number; thanksCount: number; rank2: string; contentCompletionCount: number; challengeCount: number; approvedKpiCount: number; kkcApprovedCount: number; esUpdateCount: number; }): Trophy[] {
    const { points, streak, submissionCount, thanksCount, rank2, contentCompletionCount, challengeCount, approvedKpiCount, kkcApprovedCount, esUpdateCount } = params;
    return [
        // LEGENDARY（2個）
        { id: "legend_intern", icon: "🏆", name: "伝説のインターン", description: "5000pt達成", rarity: "legendary" as const, unlocked: points >= 5000 },
        { id: "hundred_days", icon: "🌟", name: "百日修行", description: "100日連続提出", rarity: "legendary" as const, unlocked: streak >= 100 },
        // EPIC（5個）
        { id: "ss_ranker", icon: "💎", name: "SSランカー", description: "ランクSS到達", rarity: "epic" as const, unlocked: rank2 === "SS" },
        { id: "s_ranker", icon: "⭐", name: "Sランカー", description: "ランクS到達", rarity: "epic" as const, unlocked: rank2 === "S" || rank2 === "SS" },
        { id: "streak_master", icon: "🔥", name: "連続投稿マスター", description: "30日連続提出", rarity: "epic" as const, unlocked: streak >= 30 },
        { id: "point_hunter", icon: "💰", name: "ポイントハンター", description: "3000pt達成", rarity: "epic" as const, unlocked: points >= 3000 },
        { id: "thanks_master", icon: "💖", name: "サンキューマスター", description: "サンキュー50件受領", rarity: "epic" as const, unlocked: thanksCount >= 50 },
        // RARE（8個）
        { id: "a_ranker", icon: "🎖️", name: "A級ランカー", description: "ランクA到達", rarity: "rare" as const, unlocked: ["A", "S", "SS"].includes(rank2) },
        { id: "output_king", icon: "📋", name: "アウトプット王", description: "日報50件提出", rarity: "rare" as const, unlocked: submissionCount >= 50 },
        { id: "thanks_hero", icon: "🎉", name: "感謝の人", description: "サンキュー10件受領", rarity: "rare" as const, unlocked: thanksCount >= 10 },
        { id: "learn_master", icon: "📚", name: "学びの達人", description: "学習コンテンツ20本完了", rarity: "rare" as const, unlocked: contentCompletionCount >= 20 },
        { id: "challenge_master", icon: "🎯", name: "ライフチャレンジマスター", description: "チャレンジ10個達成", rarity: "rare" as const, unlocked: challengeCount >= 10 },
        { id: "kkc_contributor", icon: "💡", name: "KKCコントリビューター", description: "KKC承認10件", rarity: "rare" as const, unlocked: kkcApprovedCount >= 10 },
        { id: "kpi_king", icon: "📊", name: "KPI達成王", description: "月次KPI承認10回", rarity: "rare" as const, unlocked: approvedKpiCount >= 10 },
        { id: "es_expert", icon: "✍️", name: "ES熟練者", description: "ES更新10回", rarity: "rare" as const, unlocked: esUpdateCount >= 10 },
    ];
}

function getRarityStyle(rarity: Trophy["rarity"]) {
    if (rarity === "legendary") return { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.5)", color: "#f59e0b", label: "LEGENDARY" };
    if (rarity === "epic") return { bg: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.5)", color: "#8b5cf6", label: "EPIC" };
    if (rarity === "rare") return { bg: "rgba(6,182,212,0.15)", border: "rgba(6,182,212,0.5)", color: "#06b6d4", label: "RARE" };
    return { bg: "rgba(107,114,128,0.15)", border: "rgba(107,114,128,0.4)", color: "#9ca3af", label: "COMMON" };
}
// ========== パーティクルエフェクト Hook (究極派手派手版v4) ==========
function useParticleEffect() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const animFrameRef = useRef<number>(0);
    const particleIdRef = useRef(0);
    const [flashOpacity, setFlashOpacity] = useState(0);
    const [overlayOpacity, setOverlayOpacity] = useState(0);
    // 虹色＋ネオン20色
    const COLORS = [
        "#ff006e", "#fb5607", "#ffbe0b", "#8338ec", "#3a86ff",
        "#06ffa5", "#ff4081", "#ffd700", "#00d9ff", "#a855f7",
        "#f472b6", "#34d399", "#fbbf24", "#06b6d4", "#ec4899",
        "#10b981", "#ff1493", "#00ff7f", "#ff6347", "#7fffd4"
    ];

    const spawnParticles = useCallback((x: number, y: number, count = 60) => {
        // 🔥 5倍化（最大1000個）
        const actualCount = Math.min(1000, Math.floor(count * 5));

        // 🌑 暗いオーバーレイで背景を一瞬隠す（パーティクルを目立たせる）
        setOverlayOpacity(0.7);
        setTimeout(() => setOverlayOpacity(0.5), 200);
        setTimeout(() => setOverlayOpacity(0.3), 500);
        setTimeout(() => setOverlayOpacity(0.15), 1000);
        setTimeout(() => setOverlayOpacity(0), 1800);

        // 🌈 虹色フラッシュ（白じゃなくてビビッド）
        setFlashOpacity(0.7);
        setTimeout(() => setFlashOpacity(0.4), 80);
        setTimeout(() => setFlashOpacity(0.2), 250);
        setTimeout(() => setFlashOpacity(0), 500);

        // 第1波: 爆発（速い・四方八方）
        const burstCount = Math.floor(actualCount * 0.5);
        for (let i = 0; i < burstCount; i++) {
            const angle = (Math.PI * 2 * i) / burstCount + (Math.random() - 0.5) * 0.3;
            const speed = 10 + Math.random() * 20;
            particlesRef.current.push({
                id: particleIdRef.current++,
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - Math.random() * 8,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                size: 8 + Math.random() * 16, // さらに大きく
                life: 1,
                maxLife: 2 + Math.random() * 2,
                shape: (["circle", "star", "rect", "sparkle"] as any)[Math.floor(Math.random() * 4)],
            });
        }

        // 第2波: 舞い散り
        const floatCount = Math.floor(actualCount * 0.3);
        for (let i = 0; i < floatCount; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
            const speed = 4 + Math.random() * 8;
            particlesRef.current.push({
                id: particleIdRef.current++,
                x: x + (Math.random() - 0.5) * 150,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 10,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                size: 5 + Math.random() * 12,
                life: 1,
                maxLife: 2.5 + Math.random() * 2,
                shape: (["circle", "star", "sparkle"] as any)[Math.floor(Math.random() * 3)],
            });
        }

        // 第3波: キラキラ
        const sparkleCount = Math.floor(actualCount * 0.2);
        for (let i = 0; i < sparkleCount; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
            const speed = 2 + Math.random() * 4;
            particlesRef.current.push({
                id: particleIdRef.current++,
                x: x + (Math.random() - 0.5) * 200,
                y: y + (Math.random() - 0.5) * 100,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 4,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                size: 4 + Math.random() * 8,
                life: 1,
                maxLife: 3 + Math.random() * 2,
                shape: "sparkle" as any,
            });
        }
    }, []);

    const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const outer = (i * Math.PI * 2) / 5 - Math.PI / 2;
            const inner = outer + Math.PI / 5;
            if (i === 0) ctx.moveTo(x + Math.cos(outer) * size, y + Math.sin(outer) * size);
            else ctx.lineTo(x + Math.cos(outer) * size, y + Math.sin(outer) * size);
            ctx.lineTo(x + Math.cos(inner) * size * 0.4, y + Math.sin(inner) * size * 0.4);
        }
        ctx.closePath();
        ctx.fill();
    };

    const drawSparkle = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillRect(-size / 8, -size, size / 4, size * 2);
        ctx.fillRect(-size, -size / 8, size * 2, size / 4);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-size / 8, -size * 0.7, size / 4, size * 1.4);
        ctx.fillRect(-size * 0.7, -size / 8, size * 1.4, size / 4);
        ctx.restore();
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener("resize", resize);
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particlesRef.current = particlesRef.current.filter(p => p.life > 0);
            particlesRef.current.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.15;
                p.vx *= 0.99;
                p.life -= 0.008;

                const alpha = Math.max(0, Math.pow(p.life, 0.6));
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 30; // さらに眩しく

                if (p.shape === "circle") {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                } else if (p.shape === "star") {
                    drawStar(ctx, p.x, p.y, p.size / 2);
                } else if (p.shape === "sparkle") {
                    drawSparkle(ctx, p.x, p.y, p.size / 2);
                } else {
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.life * 15);
                    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
                    ctx.restore();
                }
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
            });
            animFrameRef.current = requestAnimationFrame(animate);
        };
        animate();
        return () => {
            window.removeEventListener("resize", resize);
            cancelAnimationFrame(animFrameRef.current);
        };
    }, []);

    return { canvasRef, spawnParticles, flashOpacity, overlayOpacity };
}
export default function MyPage() {
    const router = useRouter();
    const [userId, setUserId] = useState("");
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [inputName, setInputName] = useState("");
    const [myKpis, setMyKpis] = useState<{ deptName: string; target: number; result: number; rate: number; pts: number; approved: boolean }[]>([]);
    const [education, setEducation] = useState("");
    const [departmentId, setDepartmentId] = useState("");
    const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
    const [points, setPoints] = useState(0);
    const [totalEarned, setTotalEarned] = useState(0);
    const [rank, setRank] = useState<number | null>(null);
    const [streak, setStreak] = useState(0);
    const [monthPt, setMonthPt] = useState(0);
    const [days30Pt, setDays30Pt] = useState(0);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [showSadModal, setShowSadModal] = useState(false);
    const [anniversaryYears, setAnniversaryYears] = useState(0);
    const [showBirthday, setShowBirthday] = useState(false);
    const [myKings, setMyKings] = useState<MyKing[]>([]);
    const [showKingPopup, setShowKingPopup] = useState(false);
    const [hasScheduleToday, setHasScheduleToday] = useState(false);
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);
    const [history, setHistory] = useState<PointHistory[]>([]);
    const [graphData, setGraphData] = useState<GraphData[]>([]);
    const [kpiDepts, setKpiDepts] = useState<{ id: string; name: string; main_metric: string; unit: string }[]>([]);
    const [monthlyKpis, setMonthlyKpis] = useState<{ department_id: string; year_month: string; result: number }[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState<string>("");
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const hour = new Date().getHours();
        if (hour >= 18 && !isSubmitted && !loading) setShowSadModal(true);
    }, [isSubmitted, loading]);
    const [message, setMessage] = useState("");
    const [showNameModal, setShowNameModal] = useState(false);
    const [announcements, setAnnouncements] = useState<{ id: string; title: string; content: string }[]>([]);
    const [closedAnnouncements, setClosedAnnouncements] = useState<string[]>([]);
    const [levelUpShow, setLevelUpShow] = useState(false);
    const [prevLevel, setPrevLevel] = useState(0);
    const [submissionCount, setSubmissionCount] = useState(0);
    const [contentCompletionCount, setContentCompletionCount] = useState(0);
    const [esCompleted, setEsCompleted] = useState(false);
    const [thanksCount, setThanksCount] = useState(0);
    const [kpiCount, setKpiCount] = useState(0);
    const [approvedKpiCount, setApprovedKpiCount] = useState(0);
    const [kkcApprovedCount, setKkcApprovedCount] = useState(0);
    const [thinkingAnswerCount, setThinkingAnswerCount] = useState(0);
    const [mentorCount, setMentorCount] = useState(0);
    const [esUpdateCount, setEsUpdateCount] = useState(0);
    const [activeDays, setActiveDays] = useState(0);
    const [profileFlags, setProfileFlags] = useState<ProfileFlags>({});
    const [challengeCount, setChallengeCount] = useState(0);
    const [startedAt, setStartedAt] = useState("");
    const [birthday, setBirthday] = useState("");
    const [todayKpiDone, setTodayKpiDone] = useState(false);
    const [todayThanksDone, setTodayThanksDone] = useState(false);
    const [todayLearnDone, setTodayLearnDone] = useState(false);
    const [routines, setRoutines] = useState<{ id: string; title: string }[]>([]);
    const [routineCheckedIds, setRoutineCheckedIds] = useState<string[]>([]);
    const [routineStreak, setRoutineStreak] = useState(0);
    const [openRoutineId, setOpenRoutineId] = useState<string | null>(null);
    const [routineNote, setRoutineNote] = useState("");
    const [routineSaving, setRoutineSaving] = useState(false);
    const [mbti, setMbti] = useState("");
    const [club, setClub] = useState("");
    const [hobby, setHobby] = useState("");
    const [growthRank, setGrowthRank] = useState("");
    const [growthGrade, setGrowthGrade] = useState("");
    const [themeColor, setThemeColor] = useState("#6366f1");
    const [bgColor, setBgColor] = useState("#0a0a0f");
    const [fontFamily, setFontFamily] = useState("'Inter', sans-serif");

    // タグ state
    const [userTags, setUserTags] = useState<UserTag[]>([]);
    const [pendingSurveys, setPendingSurveys] = useState<{ id: string; title: string; reward_points: number; question_count: number }[]>([]);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [unreadAdvices, setUnreadAdvices] = useState<{ id: string; category: string; message: string; created_at: string }[]>([]);
    const [pendingAdminTasks, setPendingAdminTasks] = useState<{ id: string; title: string; deadline: string | null }[]>([]);
    const [deadlineAlertCount, setDeadlineAlertCount] = useState(0);
    const [personalTasks, setPersonalTasks] = useState<{ id: string; title: string; is_done: boolean }[]>([]);
    const [newQuickTask, setNewQuickTask] = useState("");
    const [savingQuick, setSavingQuick] = useState(false);
    const [loginBonusReceived, setLoginBonusReceived] = useState<boolean | null>(null);
    const [gachaSpinning, setGachaSpinning] = useState(false);
    const [gachaResult, setGachaResult] = useState<number | null>(null);
    const [anniversaryClaimed, setAnniversaryClaimed] = useState<number[]>([]);
    const [goshugiResult, setGoshugiResult] = useState<{ milestone: number; reward: number } | null>(null);
    const [goshugiSpinning, setGoshugiSpinning] = useState(false);
    const [showGachaModal, setShowGachaModal] = useState(false);
    const [showTrophies, setShowTrophies] = useState(false);
    const [showTagEdit, setShowTagEdit] = useState(false);
    const [showAllCollection, setShowAllCollection] = useState(false);
    const [showBadges, setShowBadges] = useState(false);
    const [achieveBadges, setAchieveBadges] = useState<{ id: string; name: string; icon: string | null; description: string | null; category: string | null }[]>([]);
    const [myBadgeIds, setMyBadgeIds] = useState<string[]>([]);
    const [badgeCatOrder, setBadgeCatOrder] = useState<string[]>([]);
    const [showAchieve, setShowAchieve] = useState(false);
    const [newTag, setNewTag] = useState("");
    const [tagSaving, setTagSaving] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // エフェクト用 state
    const [floatingPoints, setFloatingPoints] = useState<FloatingPoint[]>([]);
    const floatingIdRef = useRef(0);
    const pointsCardRef = useRef<HTMLDivElement>(null);
    const { canvasRef, spawnParticles, flashOpacity, overlayOpacity } = useParticleEffect();
    useEffect(() => {
        if (!startedAt || loading) return;
        const start = new Date(startedAt);
        const now = new Date();
        const isAnniv = start.getMonth() === now.getMonth() && start.getDate() === now.getDate();
        const years = now.getFullYear() - start.getFullYear();
        if (isAnniv && years >= 1) {
            setAnniversaryYears(years);
            setTimeout(() => spawnParticles(window.innerWidth / 2, window.innerHeight / 3, 120), 600);
        }
    }, [startedAt, loading, spawnParticles]);
    useEffect(() => {
        if (!birthday || loading) return;
        const b = new Date(birthday);
        const now = new Date();
        if (b.getMonth() === now.getMonth() && b.getDate() === now.getDate()) {
            setShowBirthday(true);
            setTimeout(() => spawnParticles(window.innerWidth / 2, window.innerHeight / 3, 120), 600);
        }
    }, [birthday, loading, spawnParticles]);
    const GOSHUGI_MILESTONES = [
        { days: 30, min: 10, max: 20 },
        { days: 100, min: 20, max: 40 },
        { days: 180, min: 30, max: 60 },
        { days: 365, min: 50, max: 100 },
        { days: 730, min: 100, max: 200 },
        { days: 1095, min: 200, max: 300 },
    ];
    const handleGoshugiGacha = async (milestone: number) => {
        if (goshugiSpinning) return;
        const ms = GOSHUGI_MILESTONES.find((m) => m.days === milestone);
        if (!ms) return;
        setGoshugiSpinning(true);
        const reward = Math.floor(Math.random() * (ms.max - ms.min + 1)) + ms.min;
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const { data: { user: gUser } } = await supabase.auth.getUser();
        if (gUser) {
            const { error: insErr } = await supabase.from("anniversary_gacha").insert({
                user_id: gUser.id, milestone, reward,
            });
            if (insErr) { setGoshugiSpinning(false); alert("すでに受け取り済みか、エラーが発生しました"); return; }
            const { data: ptRow } = await supabase.from("user_points").select("points").eq("id", gUser.id).maybeSingle();
            const currentPt = (ptRow as any)?.points || 0;
            await supabase.from("user_points").upsert({ id: gUser.id, points: currentPt + reward });
            await supabase.from("points_history").insert({
                user_id: gUser.id, change: reward, reason: "anniversary_gacha", created_at: new Date().toISOString(),
            });
            setAnniversaryClaimed((prev) => [...prev, milestone]);
            setGoshugiResult({ milestone, reward });
        }
        setGoshugiSpinning(false);
    };
    const handleGachaSpin = async () => {
        if (gachaSpinning || loginBonusReceived) return;
        setGachaSpinning(true);
        setShowGachaModal(true);
        const prizes = [
            { pt: 1, weight: 5 },
            { pt: 2, weight: 10 },
            { pt: 3, weight: 20 },
            { pt: 4, weight: 20 },
            { pt: 5, weight: 20 },
            { pt: 6, weight: 10 },
            { pt: 7, weight: 5 },
            { pt: 8, weight: 5 },
            { pt: 9, weight: 3 },
            { pt: 10, weight: 2 },
        ];
        const totalWeight = prizes.reduce((s, p) => s + p.weight, 0);
        let random = Math.random() * totalWeight;
        let selectedPt = 1;
        for (const prize of prizes) {
            random -= prize.weight;
            if (random <= 0) {
                selectedPt = prize.pt;
                break;
            }
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        setGachaResult(selectedPt);
        const { data: { user: gachaUser } } = await supabase.auth.getUser();
        if (gachaUser) {
            // user_points 更新（total_earnedはトリガーで自動）
            const { data: ptRow } = await supabase.from("user_points").select("points").eq("id", gachaUser.id).maybeSingle();
            const currentPt = (ptRow as any)?.points || 0;
            await supabase.from("user_points").upsert({ 
                id: gachaUser.id, 
                points: currentPt + selectedPt
            });
            await supabase.from("points_history").insert({
                user_id: gachaUser.id,
                change: selectedPt,
                reason: "login_bonus",
                created_at: new Date().toISOString(),
            });
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            if (selectedPt === 10) spawnParticles(cx, cy, 100);
            else if (selectedPt >= 7) spawnParticles(cx, cy, 60);
            else spawnParticles(cx, cy, 30);
        }
        setGachaSpinning(false);
        setLoginBonusReceived(true);
    };
    // 画面幅検出（スマホ判定用）
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);
    const isLightBg = useMemo(() =>
        ["#fce4ec", "#f3e5f5", "#e8f5e9", "#e3f2fd", "#fff9e6"].includes(bgColor),
        [bgColor]);

    const cardBg = isLightBg ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.03)";
    const cardBorder = isLightBg ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.08)";
    const inputBg = isLightBg ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.05)";
    const textPrimary = isLightBg ? "#1a1a2e" : "#f9fafb";
    const textSecondary = isLightBg ? "#4b5563" : "#9ca3af";
    const textMuted = isLightBg ? "#6b7280" : "#6b7280";
    const barBg = isLightBg ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.06)";

    const todayYmd = getTodayJST();
    const level = getLevel(totalEarned);
    const exp = getExp(totalEarned);
    const badgeLabel = getBadgeLabel(level);
    const badgeColor = getBadgeColor(level);
    const actionMessage = getActionMessage(isSubmitted, streak);
    const rankScore = getRankScore({ level, thanksCount, activeDays, education, approvedKpiCount, kkcApprovedCount, esUpdateCount, mentorCount });
    const rank2 = getRank(rankScore);
    const rankColor = getRankColor(rank2);
    const nextRankInfo = getNextRankInfo(rank2);
    const aiComment = generateAIComment({ name, level, rank2, rankScore, streak, isSubmitted, points, hasScheduleToday });
    const dotKunSuggestion = getDotKunSuggestion({ thanksCount, mentorCount, kkcApprovedCount, esUpdateCount, approvedKpiCount, challengeCount, contentCompletionCount, points });
    const suggestions = getSuggestions({ thinkingAnswerCount, challengeCount, mbti, points, isSubmitted, streak, contentCompletionCount, education, kkcApprovedCount }).slice(0, 3);
    const dailyMission = getDailyMission({ hour: new Date().getHours(), hasScheduleToday, isSubmitted, todayThanksDone, todayLearnDone, todayKpiDone, challengeCount, mentorCount, kkcApprovedCount });
    const badges = getBadges(totalEarned, streak, esCompleted, profileFlags, contentCompletionCount);
    const trophies = getTrophies({ points: totalEarned, streak, submissionCount, thanksCount, rank2, contentCompletionCount, challengeCount, approvedKpiCount, kkcApprovedCount, esUpdateCount });
    const unlockedTrophies = trophies.filter(t => t.unlocked);
    const topTrophy = [...unlockedTrophies].sort((a, b) => {
        const order = { legendary: 4, epic: 3, rare: 2, common: 1 };
        return order[b.rarity] - order[a.rarity];
    })[0];

    // ポイント獲得エフェクト発火
    const triggerPointEffect = useCallback((amount: number, prevPoints: number) => {
        if (amount <= 0) return;

        // フローティング +Xpt テキスト
        const card = pointsCardRef.current;
        const x = card ? card.getBoundingClientRect().left + card.offsetWidth / 2 : window.innerWidth / 2;
        const y = card ? card.getBoundingClientRect().top + card.offsetHeight / 2 : window.innerHeight / 2;

        const newFloat: FloatingPoint = { id: floatingIdRef.current++, x, y, value: amount };
        setFloatingPoints(prev => [...prev, newFloat]);
        setTimeout(() => {
            setFloatingPoints(prev => prev.filter(f => f.id !== newFloat.id));
        }, 1500);

        // パーティクル
        spawnParticles(x, y, amount >= 100 ? 100 : amount >= 10 ? 60 : 30);
    }, [spawnParticles]);

    const loadPage = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }
        setUserId(user.id);

        const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (profileData) {
            const profile = profileData as ProfileRow;
            setName(profile.name || "");
            setInputName(profile.name || "");
            // streak は submissions から算出（loadPage 下部で設定）
            setEducation(profile.education || "");
            setDepartmentId((profileData as any)?.department_id || "");
            setAvatarUrl((profileData as any)?.avatar_url || null);
            setThemeColor((profileData as any)?.theme_color || "#6366f1");
            setBgColor((profileData as any)?.bg_color || "#0a0a0f");
            setFontFamily((profileData as any)?.font_family || "'Inter', sans-serif");
            setGrowthRank((profileData as any)?.growth_rank || "");
            setGrowthGrade((profileData as any)?.growth_grade || "");
            setMbti((profileData as any)?.mbti || "");
            setClub((profileData as any)?.club_category || (profileData as any)?.club || "");
            setHobby((profileData as any)?.hobby_category || "");
            setProfileFlags({
                quiz_passed: !!(profileData as any)?.quiz_passed,
                mentor_passed: !!(profileData as any)?.mentor_passed,
                marketer_passed: !!(profileData as any)?.marketer_passed,
                sales_passed: !!(profileData as any)?.sales_passed,
                planner_passed: !!(profileData as any)?.planner_passed,
                entrepreneur_passed: !!(profileData as any)?.entrepreneur_passed,
                manager_passed: !!(profileData as any)?.manager_passed,
                retention_passed: !!(profileData as any)?.retention_passed,
            });
            if (profile.started_at) {
                const start = new Date(profile.started_at);
                const now = new Date();
                const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                setActiveDays(days);
                setStartedAt(profile.started_at.slice(0, 10));
            }
            if (profile.birthday) {
                setBirthday(profile.birthday.slice(0, 10));
            }
            const { data: annivRows } = await supabase.from("anniversary_gacha").select("milestone").eq("user_id", user.id);
            setAnniversaryClaimed((annivRows || []).map((r: any) => r.milestone));
        }

        const { data: badgeDefs } = await supabase.from("badges").select("id, name, icon, description, category").order("category").order("sort_order");
        setAchieveBadges((badgeDefs || []) as any);
        const { data: myBadges } = await supabase.from("user_badges").select("badge_id").eq("user_id", user.id);
        setMyBadgeIds((myBadges || []).map((r: any) => r.badge_id));
        const { data: catRows } = await supabase.from("badge_categories").select("name").order("sort_order");
        setBadgeCatOrder((catRows || []).map((r: any) => r.name));
        const { data: pointRow } = await supabase.from("user_points").select("points, total_earned").eq("id", user.id).single();
        const newPoints = pointRow?.points || 0;
        const newTotalEarned = (pointRow as any)?.total_earned || newPoints;
        setPoints(newPoints);
        setTotalEarned(newTotalEarned);

        // ページを開いたら必ずエフェクト発火（0pt以上なら）
        if (newPoints > 0) {
            setTimeout(() => triggerPointEffect(newPoints, 0), 800);
        }

        const { data: rankingRows } = await supabase.from("user_points").select("id, total_earned").order("total_earned", { ascending: false });
        if (rankingRows) {
            const myRank = rankingRows.findIndex((row) => row.id === user.id);
            setRank(myRank >= 0 ? myRank + 1 : null);
        }

        const { data: historyRows } = await supabase.from("points_history").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
        const hist = (historyRows || []) as PointHistory[];
        setHistory(hist);
        setGraphData(buildGraphData(hist));
        // 月次KPI（事業部別）と部署マスタを取得
        const { data: kpiDeptMaster } = await supabase.from("departments").select("id, name, main_metric, unit");
        const { data: monthlyKpiRows } = await supabase.from("monthly_kpi").select("department_id, year_month, result").eq("user_id", user.id).order("year_month", { ascending: true });
        const usedDeptIds = Array.from(new Set((monthlyKpiRows || []).map((r: any) => r.department_id)));
        const usedDepts = (kpiDeptMaster || []).filter((d: any) => usedDeptIds.includes(d.id));
        setKpiDepts(usedDepts as any);
        setMonthlyKpis((monthlyKpiRows || []) as any);
        if (usedDepts.length > 0) setSelectedDeptId((usedDepts[0] as any).id);
        const { data: submissionRows } = await supabase.from("submissions").select("created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(400);
        setIsSubmitted(submissionRows?.some((row) => isSameJSTDay(row.created_at, todayYmd)) || false);
        setStreak(computeReportStreak((submissionRows || []).map((r: any) => r.created_at)));
        // 成長カード用: 今月＋過去30日の獲得pt
        try {
            const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
            const monthStart = new Date(Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth(), 1) - 9 * 60 * 60 * 1000).toISOString();
            const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const { data: growRows } = await supabase.from("points_history").select("change, created_at").eq("user_id", user.id).gte("created_at", d30 < monthStart ? d30 : monthStart);
            const rows = (growRows || []) as any[];
            setMonthPt(rows.filter(r => r.created_at >= monthStart && r.change > 0).reduce((a, r) => a + r.change, 0));
            setDays30Pt(rows.filter(r => r.created_at >= d30 && r.change > 0).reduce((a, r) => a + r.change, 0));
        } catch {}

        if (!profileData?.name) setShowNameModal(true);

        const newLevel = Math.max(1, Math.floor(newPoints / 100) + 1);
        if (prevLevel > 0 && newLevel > prevLevel) {
            setLevelUpShow(true);
            setTimeout(() => setLevelUpShow(false), 4000);
        }
        setPrevLevel(newLevel);

        const { count: subCount } = await supabase.from("submissions").select("*", { count: "exact", head: true }).eq("user_id", user.id);
        setSubmissionCount(subCount || 0);

        const { count: tCount } = await supabase.from("thanks").select("*", { count: "exact", head: true }).eq("to_user_id", user.id);
        setThanksCount(tCount || 0);

        const { count: cCount } = await supabase.from("content_completions").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved");
        setContentCompletionCount(cCount || 0);

        const { data: esRow } = await supabase.from("user_es").select("*").eq("user_id", user.id).maybeSingle();
        if (esRow) {
            const fields = ["gakuchika_1", "gakuchika_2", "gakuchika_3", "gakuchika_4", "axis_1", "axis_2", "axis_3", "axis_4", "future_1", "future_2", "future_3", "future_4", "pr_1", "pr_2", "pr_3", "pr_4", "fail_1", "fail_2", "fail_3", "fail_4"];
            const allFilled = fields.every(f => ((esRow as any)[f] || "").trim().length > 0);
            setEsCompleted(allFilled);
        }

        const { count: kCount } = await supabase.from("kpi_logs").select("*", { count: "exact", head: true }).eq("user_id", user.id);
        setKpiCount(kCount || 0);

        const { count: approvedKpiCnt } = await supabase.from("monthly_kpi").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("approved", true);
        setApprovedKpiCount(approvedKpiCnt || 0);
        const { count: kkcCnt } = await supabase.from("problem_solutions").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved");
        const { count: thinkingCnt } = await supabase.from("thinking_answers").select("*", { count: "exact", head: true }).eq("user_id", user.id);
        setThinkingAnswerCount(thinkingCnt || 0);
        const { count: chalCnt } = await supabase.from("challenge_submissions").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved");
        setChallengeCount(chalCnt || 0);
        setKkcApprovedCount(kkcCnt || 0);
        const { count: mentorCnt } = await supabase.from("mentor_reports").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved");
        setMentorCount(mentorCnt || 0);
        const { count: esCnt } = await supabase.from("user_es_history").select("*", { count: "exact", head: true }).eq("user_id", user.id);
        setEsUpdateCount(esCnt || 0);

        const { data: announceRows } = await supabase.from("announcements").select("*").eq("is_active", true).order("created_at", { ascending: false });
        setAnnouncements((announceRows || []) as { id: string; title: string; content: string }[]);

        const { data: todayKpiRows } = await supabase.from("kpi_logs").select("created_at").eq("user_id", user.id);
        setTodayKpiDone(todayKpiRows?.some(r => isSameJSTDay(r.created_at, todayYmd)) || false);

        const { data: todayThanksRows } = await supabase.from("thanks").select("created_at").eq("from_user_id", user.id);
        setTodayThanksDone(todayThanksRows?.some(r => isSameJSTDay(r.created_at, todayYmd)) || false);

        const { data: todayLearnRows } = await supabase.from("content_completions").select("created_at").eq("user_id", user.id);
        setTodayLearnDone(todayLearnRows?.some(r => isSameJSTDay(r.created_at, todayYmd)) || false);
        const { data: schedToday } = await supabase
            .from("daily_schedules")
            .select("id")
            .eq("user_id", user.id)
            .eq("date", todayYmd)
            .maybeSingle();
        setHasScheduleToday(!!schedToday);
        // 自作ルーティン項目と、今日のチェック状況を取得
        const { data: routineRows } = await supabase.from("routines").select("id, title").eq("user_id", user.id).eq("is_active", true).order("sort_order", { ascending: true });
        setRoutines((routineRows || []) as { id: string; title: string }[]);
        const { data: routineCheckRows } = await supabase.from("routine_checks").select("routine_id").eq("user_id", user.id).eq("check_date", todayYmd);
        setRoutineCheckedIds((routineCheckRows || []).map((r: any) => r.routine_id));
        await calcRoutineStreak(user.id, (routineRows || []) as { id: string }[]);

        const { data: deptRows } = await supabase.from("departments").select("id, name, code").order("created_at");
        setDepartments((deptRows || []) as { id: string; name: string; code: string }[]);

        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const { data: kpiRows } = await supabase.from("monthly_kpi").select("*").eq("user_id", user.id).eq("year_month", ym);
        const { data: kpiDeptRows } = await supabase.from("departments").select("*");
        const { data: targetRows } = await supabase.from("monthly_targets").select("*").eq("year_month", ym).eq("user_id", user.id);

        if (kpiRows && kpiDeptRows) {
            const kpis = kpiRows.map((k: any) => {
                const dept = kpiDeptRows.find((d: any) => d.id === k.department_id);
                const officialTarget = targetRows?.find((t: any) => t.department_id === k.department_id)?.target || k.target;
                const rate = officialTarget > 0 ? Math.round((k.result / officialTarget) * 100) : 0;
                const pts = rate >= 120 ? 50 : rate >= 100 ? 30 : rate >= 80 ? 20 : rate >= 60 ? 10 : 0;
                return { deptName: dept?.name || "不明", target: officialTarget, result: k.result, rate, pts, approved: k.approved };
            });
            setMyKpis(kpis);
        }
        // 未回答アンケート取得
        const { data: surveyRows } = await supabase
            .from("surveys")
            .select("*")
            .eq("is_active", true);
        const { data: myResponses } = await supabase
            .from("survey_responses")
            .select("survey_id")
            .eq("user_id", user.id);
        const { data: allQuestions } = await supabase
            .from("survey_questions")
            .select("survey_id");
        const respondedIds = new Set((myResponses || []).map((r: any) => r.survey_id));
        const nowDate = new Date();
        const pending = (surveyRows || [])
            .filter((s: any) => !respondedIds.has(s.id))
            .filter((s: any) => {
                if (s.starts_at && new Date(s.starts_at) > nowDate) return false;
                if (s.ends_at && new Date(s.ends_at) < nowDate) return false;
                return true;
            })
            .map((s: any) => ({
                id: s.id,
                title: s.title,
                reward_points: s.reward_points,
                question_count: (allQuestions || []).filter((q: any) => q.survey_id === s.id).length,
            }));
        setPendingSurveys(pending);
        // タグ取得
        const { data: tagRows } = await supabase.from("user_tags").select("*").eq("user_id", user.id).order("created_at");
        setUserTags((tagRows || []) as UserTag[]);

        // 未読アドバイス取得（is_read=falseのみ）
        const { data: adviceRows } = await supabase
            .from("advice_logs")
            .select("id, category, message, created_at")
            .eq("receiver_id", user.id)
            .eq("status", "approved")
            .eq("is_read", false)
            .order("created_at", { ascending: false })
            .limit(5);
        setUnreadAdvices((adviceRows || []) as any);
        // ログインボーナス受取状況をチェック
        const todayStr = new Date().toISOString().split("T")[0];
        const { data: bonusHistory } = await supabase.from("points_history")
            .select("id")
            .eq("user_id", user.id)
            .eq("reason", "login_bonus")
            .gte("created_at", todayStr)
            .limit(1);
        setLoginBonusReceived((bonusHistory?.length || 0) > 0);
        // 個人タスク（未完了）取得 - クイックタスク用
        const { data: personalTaskData } = await supabase
            .from("personal_tasks")
            .select("*")
            .eq("user_id", user.id)
            .eq("is_done", false)
            .order("created_at", { ascending: false })
            .limit(3);
        setPersonalTasks(personalTaskData || []);
        // 通知件数取得
                const nowIso = new Date().toISOString();
                const { count: notifCount } = await supabase
                    .from("notifications")
                    .select("*", { count: "exact", head: true })
                    .eq("user_id", user.id)
                    .eq("is_read", false)
                    .lte("created_at", nowIso);
                setUnreadNotifCount(notifCount || 0);
                // adminタスク取得（未提出 + 差戻しのみ）
        const { data: profileForDept } = await supabase
            .from("profiles")
            .select("department_id")
            .eq("id", user.id)
            .single();
        const deptId = profileForDept?.department_id || null;

        let taskQuery = supabase.from("admin_tasks").select("id, title, deadline");
        if (deptId) {
            taskQuery = taskQuery.or(`assignee_user_id.eq.${user.id},assignee_department_id.eq.${deptId}`);
        } else {
            taskQuery = taskQuery.eq("assignee_user_id", user.id);
        }
        const { data: adminTaskList } = await taskQuery;
        const allTasks = (adminTaskList || []) as { id: string; title: string; deadline: string | null }[];

        if (allTasks.length > 0) {
            const taskIds = allTasks.map(t => t.id);
            const { data: myReports } = await supabase
                .from("task_reports")
                .select("task_id, status")
                .eq("user_id", user.id)
                .in("task_id", taskIds);

            const reportMap = new Map<string, string>();
            (myReports || []).forEach((r: { task_id: string; status: string }) => {
                reportMap.set(r.task_id, r.status);
            });

            const pending = allTasks.filter(t => {
                const status = reportMap.get(t.id);
                return !status || status === "rejected";
            });

            pending.sort((a, b) => {
                if (!a.deadline && !b.deadline) return 0;
                if (!a.deadline) return 1;
                if (!b.deadline) return -1;
                return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
            });

            setPendingAdminTasks(pending);

            // 期日アラート：未完了の自分タスク（個人＋未提出/差戻しのadminタスク）から「期限切れ・今日・明日」を数える
            const { data: dueP } = await supabase
                .from("personal_tasks")
                .select("deadline")
                .eq("user_id", user.id)
                .eq("is_done", false)
                .not("deadline", "is", null);
            const today2 = new Date(); today2.setHours(0, 0, 0, 0);
            const tomorrow2 = new Date(today2.getTime() + 86400000);
            const isNear2 = (dl: string) => {
                const due = new Date(dl); due.setHours(0, 0, 0, 0);
                return due.getTime() <= tomorrow2.getTime();
            };
            const personalDue = (dueP || []).filter((t: any) => t.deadline && isNear2(t.deadline)).length;
            const adminDue = pending.filter((t: any) => t.deadline && isNear2(t.deadline)).length;
            setDeadlineAlertCount(personalDue + adminDue);
        }
        // 昨日の王判定（自分が該当する称号をポップアップで祝う）
        try {
            const kingRange = yesterdayRangeUTC();
            const myKingList: MyKing[] = [];
            const { data: kThanks } = await supabase.from("thanks").select("to_user_id").gte("created_at", kingRange.start).lt("created_at", kingRange.end);
            if (kThanks && kThanks.length > 0) {
                const cnt: Record<string, number> = {};
                (kThanks as any[]).forEach(t => { cnt[t.to_user_id] = (cnt[t.to_user_id] || 0) + 1; });
                const maxCnt = Math.max(...Object.values(cnt));
                if (maxCnt > 0 && cnt[user.id] === maxCnt) myKingList.push({ emoji: "🙏", title: "サンキュー王", dotkun: "昨日いちばんサンキューをもらったよ！みんなから感謝されてる、人徳だね🙏✨" });
            }
            const { data: kSubs } = await supabase.from("submissions").select("user_id, content, created_at").gte("created_at", kingRange.start).lt("created_at", kingRange.end).order("created_at", { ascending: true });
            if (kSubs && kSubs.length > 0) {
                const subs = kSubs as any[];
                if (subs[0].user_id === user.id) myKingList.push({ emoji: "📝", title: "一番乗り王", dotkun: "昨日いちばん早く日報を出したね！さすがの仕事の速さ⚡" });
                let longest = subs[0];
                subs.forEach(s => { if ((s.content?.length || 0) > (longest.content?.length || 0)) longest = s; });
                if (longest.user_id === user.id) myKingList.push({ emoji: "💬", title: "長文王", dotkun: "昨日いちばん熱のこもった長い日報だったよ！熱意、伝わってる📖" });
            }
            if (myKingList.length > 0) {
                const lastSeen = localStorage.getItem("kingPopupSeen");
                if (lastSeen !== todayYmd) {
                    setMyKings(myKingList);
                    setShowKingPopup(true);
                }
            }
        } catch (e) { /* 王判定は失敗してもマイページ本体に影響させない */ }

        setLoading(false);
    };

    useEffect(() => { loadPage(); }, []);

    const handleSaveProfile = async () => {
        if (!userId) return;
        setSavingProfile(true);
        await supabase.from("profiles").update({
            name: inputName.trim(),
            education: education.trim(),
            department_id: departmentId || null,
            started_at: startedAt || null,
            birthday: birthday || null,
            mbti: mbti || null,
            club: club || null,
            club_category: club || null,
            hobby_category: hobby || null,
        }).eq("id", userId);
        // activeDaysを再計算
        if (startedAt) {
            const start = new Date(startedAt);
            setActiveDays(Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
        }
        setName(inputName.trim());
        setSavingProfile(false);
        setSaveSuccess(true);
        setMessage("✅ プロフィールを保存しました");
        setTimeout(() => setSaveSuccess(false), 2000);
    };

    const handleAddTag = async () => {
        if (!newTag.trim() || !userId) return;
        setTagSaving(true);
        const { data } = await supabase.from("user_tags").insert({ user_id: userId, tag: newTag.trim(), created_by: userId }).select().single();
        if (data) setUserTags(prev => [...prev, data as UserTag]);
        setNewTag("");
        setTagSaving(false);
    };

    const handleDeleteTag = async (tagId: string) => {
        await supabase.from("user_tags").delete().eq("id", tagId);
        setUserTags(prev => prev.filter(t => t.id !== tagId));
    };

    // ===== クイックタスク =====
    const handleAddQuick = async () => {
        if (!newQuickTask.trim() || savingQuick || !userId) return;
        setSavingQuick(true);
        await supabase.from("personal_tasks").insert({
            user_id: userId,
            title: newQuickTask.trim(),
            requires_report: false,
        });
        setNewQuickTask("");
        // 再取得
        const { data: refresh } = await supabase
            .from("personal_tasks")
            .select("id, title, is_done")
            .eq("user_id", userId)
            .eq("is_done", false)
            .order("created_at", { ascending: false })
            .limit(3);
        setPersonalTasks(refresh || []);
        setSavingQuick(false);
    };

    const handleCompleteQuick = async (taskId: string) => {
        await supabase
            .from("personal_tasks")
            .update({ is_done: true, done_at: new Date().toISOString() })
            .eq("id", taskId);
        setPersonalTasks(prev => prev.filter(t => t.id !== taskId));
    };
const handleRoutineCheck = async (routineId: string) => {
    if (!userId) { return; }
        if (!routineNote.trim()) { alert("一言コメントを入力してください"); return; }
        setRoutineSaving(true);
        const { error } = await supabase.from("routine_checks").insert({
            user_id: userId,
            routine_id: routineId,
            check_date: todayYmd,
            note: routineNote.trim(),
        });
        if (error) { alert("チェックに失敗しました: " + error.message); setRoutineSaving(false); return; }
        setRoutineCheckedIds(prev => [...prev, routineId]);
        setOpenRoutineId(null);
        setRoutineNote("");
        await calcRoutineStreak(userId, routines);
        setRoutineSaving(false);
    };
    const handleRoutineUncheck = async (routineId: string) => {
        if (!userId || !todayYmd) { return; }
        setRoutineSaving(true);
        const { error } = await supabase.from("routine_checks")
            .delete()
            .eq("user_id", userId)
            .eq("routine_id", routineId)
            .eq("check_date", todayYmd);
        if (error) { alert("解除に失敗しました: " + error.message); setRoutineSaving(false); return; }
        setRoutineCheckedIds(prev => prev.filter(id => id !== routineId));
        setRoutineSaving(false);
    };
    // ルーティンのストリーク（全項目達成が何日連続か）を計算し、節目報酬を付与
    const calcRoutineStreak = async (uid: string, routineItems: { id: string }[]) => {
        const itemCount = routineItems.length;
        if (itemCount === 0) { setRoutineStreak(0); return; }
        const { data: allChecks } = await supabase
            .from("routine_checks")
            .select("check_date, routine_id")
            .eq("user_id", uid);
        if (!allChecks) { setRoutineStreak(0); return; }
        // 日付ごとのチェック数を集計
        const countByDate: Record<string, number> = {};
        allChecks.forEach((c: any) => {
            countByDate[c.check_date] = (countByDate[c.check_date] || 0) + 1;
        });
        // その日が「全項目達成」か（今の項目数基準・割り切り設計）
        const isFullDay = (ymd: string) => (countByDate[ymd] || 0) >= itemCount;
        // 今日から過去にさかのぼって連続日数を数える
        // 今日が未達成でも、昨日までの連続は生かす
        let streak = 0;
        const cursor = new Date();
        const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (!isFullDay(fmt(cursor))) {
            cursor.setDate(cursor.getDate() - 1); // 今日未達成なら昨日から数え始める
        }
        while (isFullDay(fmt(cursor))) {
            streak++;
            cursor.setDate(cursor.getDate() - 1);
        }
        setRoutineStreak(streak);
        // 節目報酬（3/7/30）。まだ受け取っていないものだけ付与
        const REWARDS: Record<number, number> = { 3: 5, 7: 15, 30: 50 };
        const { data: gotRewards } = await supabase
            .from("routine_rewards")
            .select("milestone")
            .eq("user_id", uid);
        const gotSet = new Set((gotRewards || []).map((r: any) => r.milestone));
        for (const ms of [3, 7, 30]) {
            if (streak >= ms && !gotSet.has(ms)) {
                const { error: rwErr } = await supabase
                    .from("routine_rewards")
                    .insert({ user_id: uid, milestone: ms });
                if (rwErr) continue; // ユニーク制約で弾かれた＝既に付与済み。スキップ
                const pt = REWARDS[ms];
                const { data: up } = await supabase.from("user_points").select("points").eq("id", uid).single();
                const current = (up as any)?.points || 0;
                await supabase.from("user_points").update({ points: current + pt }).eq("id", uid);
                await supabase.from("points_history").insert({ user_id: uid, points: pt, reason: "routine_streak" });
                alert(`🔥 ルーティン${ms}日連続達成！ +${pt}ptを獲得しました`);
            }
        }
    };
    if (loading) {
        return (
            <main style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#6366f1", fontSize: 18, fontWeight: 700 }}>Loading...</div>
            </main>
        );
    }

    return (
        <main style={{ minHeight: "100vh", background: bgColor || "#0a0a0f", padding: "40px 24px 110px", fontFamily: fontFamily, color: textPrimary }}>

            {/* ===== パーティクルキャンバス ===== */}
            <canvas
                ref={canvasRef}
                style={{
                    position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                    pointerEvents: "none", zIndex: 9999,
                }}
            />
           {/* 🎰 ガチャ結果モーダル */}
            {showBirthday && (
                <div onClick={() => setShowBirthday(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2100, padding: 20, cursor: "pointer" }}>
                    <div style={{ background: "linear-gradient(135deg, #fdf2f8, #fce7f3)", borderRadius: 24, padding: "36px 28px", maxWidth: 360, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
                        <div style={{ fontSize: 52, marginBottom: 8 }}>🎂</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#db2777", marginBottom: 6 }}>お誕生日おめでとう！</div>
                        <div style={{ fontSize: 14, color: "#9d174d", marginBottom: 20, lineHeight: 1.7 }}>素敵な1年になりますように。今日はあなたの特別な日だね！</div>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><DotKun size={90} mood="cheer" /></div>
                        <div style={{ fontSize: 12, color: "#be185d" }}>タップして閉じる</div>
                    </div>
                </div>
            )}
            {showKingPopup && myKings.length > 0 && (
                <div onClick={() => { localStorage.setItem("kingPopupSeen", getTodayJST()); setShowKingPopup(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2100, padding: 20, cursor: "pointer" }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: "linear-gradient(135deg, #fffbeb, #fef3c7)", borderRadius: 24, padding: "32px 28px", maxWidth: 380, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", cursor: "default" }}>
                        <div style={{ fontSize: 40, marginBottom: 4 }}>👑</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "#b45309", marginBottom: 4 }}>昨日の称号発表！</div>
                        <div style={{ fontSize: 13, color: "#92400e", marginBottom: 20 }}>きみ、こんなにすごかったんだよ</div>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><DotKun size={80} mood="cheer" /></div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                            {myKings.map((k, i) => (
                                <div key={i} style={{ background: "rgba(255,255,255,0.7)", borderRadius: 14, padding: "14px 16px", textAlign: "left", display: "flex", alignItems: "flex-start", gap: 12 }}>
                                    <div style={{ fontSize: 32, flexShrink: 0 }}>{k.emoji}</div>
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: "#b45309", marginBottom: 3 }}>{k.title}</div>
                                        <div style={{ fontSize: 12, color: "#78350f", lineHeight: 1.6 }}>{k.dotkun}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => { localStorage.setItem("kingPopupSeen", getTodayJST()); setShowKingPopup(false); }} style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>ありがとう！</button>
                    </div>
                </div>
            )}
            {anniversaryYears > 0 && (
                <div onClick={() => setAnniversaryYears(0)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2100, padding: 20, cursor: "pointer" }}>
                    <div style={{ background: "linear-gradient(135deg, #fff7ed, #ffedd5)", borderRadius: 24, padding: "36px 28px", maxWidth: 360, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
                        <div style={{ fontSize: 52, marginBottom: 8 }}>🎉</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#ea580c", marginBottom: 6 }}>入社{anniversaryYears}周年おめでとう！</div>
                        <div style={{ fontSize: 14, color: "#9a3412", marginBottom: 20, lineHeight: 1.7 }}>{anniversaryYears}年間、本当におつかれさま。これからもドットくんが応援してるよ！</div>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><DotKun size={90} mood="cheer" /></div>
                        <div style={{ fontSize: 12, color: "#c2410c" }}>タップして閉じる</div>
                    </div>
                </div>
            )}
            {showSadModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 20 }}>
                    <div style={{ background: "#fff", borderRadius: 24, padding: "32px 28px", maxWidth: 360, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><DotKun size={140} mood="sad" /></div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#1f2937", marginBottom: 8 }}>今日まだ日報を書いてないよ…</div>
                        <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 24, lineHeight: 1.7 }}>1日の終わりに振り返ると、明日の自分がラクになるよ。ドットくんと一緒に書こう？</div>
                        <button onClick={() => router.push("/report")} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", marginBottom: 10 }}>✏️ 日報を書く</button>
                        <button onClick={() => setShowSadModal(false)} style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: "transparent", color: "#9ca3af", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>あとで</button>
                    </div>
                </div>
            )}
            {showGachaModal && (
                <div
                    onClick={() => !gachaSpinning && setShowGachaModal(false)}
                    style={{
                        position: "fixed",
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: "rgba(0,0,0,0.85)",
                        zIndex: 20000,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: gachaSpinning ? "wait" : "pointer",
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: "linear-gradient(135deg, #1f1f2e, #2a1f3d)",
                            padding: 60,
                            borderRadius: 24,
                            textAlign: "center",
                            border: gachaResult === 10 ? "3px solid #fbbf24" : "2px solid rgba(255,255,255,0.1)",
                            maxWidth: 400,
                            boxShadow: gachaResult === 10 ? "0 0 80px rgba(251,191,36,0.5)" : "0 20px 60px rgba(0,0,0,0.5)",
                        }}
                    >
                        {gachaSpinning ? (
                            <>
                                <div style={{ fontSize: 80, marginBottom: 16, animation: "gachaSpin 1s linear infinite" }}>🎰</div>
                                <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>運命のガチャを引いています...</div>
                            </>
                        ) : (
                            <>
                                <div style={{ fontSize: 80, marginBottom: 16 }}>
                                    {gachaResult === 10 ? "🎉" : gachaResult && gachaResult >= 7 ? "✨" : "🎁"}
                                </div>
                                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, letterSpacing: 3, marginBottom: 8 }}>
                                    {gachaResult === 10 ? "🌟 大当たり！" : gachaResult && gachaResult >= 7 ? "✨ ラッキー！" : "GET!"}
                                </div>
                                <div style={{
                                    color: gachaResult === 10 ? "#fbbf24" : "#ec4899",
                                    fontSize: 72,
                                    fontWeight: 900,
                                    marginBottom: 8,
                                    textShadow: gachaResult === 10 ? "0 0 40px #fbbf24" : "none",
                                }}>
                                    +{gachaResult}
                                </div>
                                <div style={{ color: "#fff", fontSize: 20, fontWeight: 800, marginBottom: 24 }}>pt 獲得！</div>
                                <button
                                    onClick={() => setShowGachaModal(false)}
                                    style={{
                                        padding: "12px 40px",
                                        borderRadius: 10,
                                        border: "none",
                                        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                        color: "#fff",
                                        fontWeight: 700,
                                        fontSize: 16,
                                        cursor: "pointer",
                                    }}
                                >
                                    OK
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
            {/* 🌑 暗いオーバーレイ（パーティクルを目立たせる） */}
<div style={{
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "#000",
    opacity: overlayOpacity,
    pointerEvents: "none",
    zIndex: 9998,
    transition: "opacity 0.3s ease-out"
}} />
{/* 🌈 虹色フラッシュ */}
<div style={{
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "radial-gradient(circle at center, #fff 0%, #ffbe0b 20%, #ff006e 45%, #8338ec 70%, transparent 100%)",
    opacity: flashOpacity,
    pointerEvents: "none",
    zIndex: 10000,
    transition: "opacity 0.2s ease-out",
    mixBlendMode: "screen"
}} />

            {/* ===== フローティング +Xpt テキスト ===== */}
            <AnimatePresence>
                {/* ===== アドバイス通知バナー（コンパクト版） ===== */}
                {unreadAdvices.length > 0 && (
                    <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto 24px" }}>
                        <div
                            onClick={() => router.push("/advice?tab=received")}
                            style={{
                                padding: "20px 24px",
                                borderRadius: 16,
                                background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(249,115,22,0.12))",
                                border: "2px solid rgba(245,158,11,0.4)",
                                boxShadow: "0 0 30px rgba(245,158,11,0.2)",
                                cursor: "pointer",
                                transition: "all 0.3s",
                                position: "relative",
                                overflow: "hidden",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "translateY(-2px)";
                                e.currentTarget.style.boxShadow = "0 6px 40px rgba(245,158,11,0.3)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 0 30px rgba(245,158,11,0.2)";
                            }}
                        >
                            {/* キラキラ装飾 */}
                            <div style={{ position: "absolute", top: -20, right: -20, fontSize: 80, opacity: 0.1 }}>💌</div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                        <span style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(251,191,36,0.2)", color: "#fbbf24", fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>💌 NEW</span>
                                        <span style={{ fontSize: 16, fontWeight: 800, color: "#f9fafb" }}>
                                            あなたへのアドバイスが{unreadAdvices.length}件あります
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 13, color: "#fcd34d", marginBottom: 6 }}>
                                        💡 改善のヒントが届いています
                                    </div>
                                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                        <span style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(245,158,11,0.25)", color: "#fbbf24", fontSize: 12, fontWeight: 800 }}>
                                            🎁 成長のヒント
                                        </span>
                                        <span style={{ fontSize: 11, color: "#9ca3af" }}>完全匿名で届いています</span>
                                    </div>
                                </div>
                                <div style={{
                                    flexShrink: 0,
                                    padding: "12px 20px",
                                    borderRadius: 10,
                                    background: "linear-gradient(135deg, #f59e0b, #f97316)",
                                    color: "#fff",
                                    fontWeight: 800,
                                    fontSize: 14,
                                    whiteSpace: "nowrap",
                                    boxShadow: "0 4px 12px rgba(245,158,11,0.4)",
                                }}>
                                    確認する →
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* ===== 未回答アンケートバナー ===== */}
                {/* ===== 期日アラートバナー ===== */}
                {deadlineAlertCount > 0 && (
                    <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto 24px" }}>
                        <div onClick={() => router.push("/my-tasks")} style={{
                            padding: "16px 24px",
                            background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(248,113,113,0.10))",
                            border: "2px solid rgba(245,158,11,0.4)",
                            borderRadius: 16,
                            cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                        }}>
                            <span style={{ fontSize: 28 }}>⏰</span>
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#f9fafb" }}>期日が近いタスクが{deadlineAlertCount}件あります</div>
                                <div style={{ fontSize: 13, color: "#fbbf24", marginTop: 2 }}>期限切れ・今日・明日が締切のタスクがあります。タップして確認 →</div>
                            </div>
                        </div>
                    </div>
                )}
                {/* ===== adminタスク通知バナー ===== */}
                {pendingAdminTasks.length > 0 && (
                    <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto 24px" }}>
                        <div onClick={() => router.push("/my-tasks")} style={{
                            padding: "20px 24px",
                            background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.10))",
                            border: "2px solid rgba(99,102,241,0.4)",
                            borderRadius: 16,
                            boxShadow: "0 0 30px rgba(99,102,241,0.2)",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            position: "relative",
                            overflow: "hidden",
                        }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "translateY(-2px)";
                                e.currentTarget.style.boxShadow = "0 6px 40px rgba(99,102,241,0.3)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 0 30px rgba(99,102,241,0.2)";
                            }}
                        >
                            <div style={{ position: "absolute", top: -20, right: -20, fontSize: 80, opacity: 0.1 }}>📋</div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, position: "relative", zIndex: 1, flexWrap: "wrap" }}>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                                        <span style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(99,102,241,0.2)", color: "#818cf8", fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>📋 NEW</span>
                                        <span style={{ fontSize: 16, fontWeight: 800, color: "#f9fafb" }}>
                                            adminからのタスクが{pendingAdminTasks.length}件あります
                                        </span>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                                        {pendingAdminTasks.slice(0, 3).map((task) => {
                                            const isOverdue = task.deadline && new Date(task.deadline) < new Date();
                                            const isNearDeadline = task.deadline && !isOverdue && (new Date(task.deadline).getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000;
                                            return (
                                                <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#c7d2fe", flexWrap: "wrap" }}>
                                                    <span>📌</span>
                                                    <span style={{ fontWeight: 700 }}>{task.title}</span>
                                                    {task.deadline && (
                                                        <span style={{ padding: "2px 8px", borderRadius: 4, background: isOverdue ? "rgba(248,113,113,0.2)" : isNearDeadline ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.1)", color: isOverdue ? "#f87171" : isNearDeadline ? "#fbbf24" : "#9ca3af", fontSize: 11, fontWeight: 700 }}>
                                                            ⏰ 締切: {new Date(task.deadline).toLocaleDateString("ja-JP")}{isOverdue && " (超過)"}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {pendingAdminTasks.length > 3 && (
                                            <div style={{ fontSize: 12, color: "#9ca3af" }}>...他 {pendingAdminTasks.length - 3} 件</div>
                                        )}
                                    </div>
                                    <span style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(99,102,241,0.25)", color: "#818cf8", fontSize: 12, fontWeight: 800 }}>
                                        🎁 +1pt / タスク
                                    </span>
                                </div>
                                <div style={{
                                    flexShrink: 0,
                                    padding: "12px 20px",
                                    borderRadius: 10,
                                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                    color: "#fff",
                                    fontWeight: 800,
                                    fontSize: 14,
                                    whiteSpace: "nowrap",
                                    boxShadow: "0 4px 12px rgba(99,102,241,0.4)",
                                }}>
                                    確認する →
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* ===== 日報ガチャ誘導バナー（非表示） ===== */}
                {false && !isSubmitted && (
                    <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto 24px" }}>
                        <div
                            onClick={() => router.push("/report")}
                            style={{
                                padding: "11px 18px",
                                background: "linear-gradient(135deg, #fbbf24 0%, #ec4899 50%, #8b5cf6 100%)",
                                borderRadius: 16,
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 12,
                                boxShadow: "0 8px 24px rgba(236,72,153,0.25)",
                            }}
                        >
                            <div>
                                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#fff" }}>📋 今日の日報がまだ！提出でガチャ1回</div>
                                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 5 }}>
                                    <span style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(255,255,255,0.25)", color: "#fff", fontSize: 12, fontWeight: 800 }}>🎁 +2pt 獲得</span>
                                    {streak > 0 && (
                                        <span style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(255,255,255,0.25)", color: "#fff", fontSize: 12, fontWeight: 800 }}>🔥 連続{streak}日記録更新中</span>
                                    )}
                                </div>
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 800, color: "#fff", whiteSpace: "nowrap" }}>日報を書く →</span>
                        </div>
                    </div>
                )}
                {/* ===== 🔔 通知バナー ===== */}
                {unreadNotifCount > 0 && (
                    <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto 24px" }}>
                        <div onClick={() => router.push("/notifications")} style={{
                            padding: "16px 20px",
                            background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.10))",
                            border: "2px solid rgba(99,102,241,0.4)",
                            borderRadius: 16,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            transition: "all 0.2s ease",
                        }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ fontSize: 28 }}>🔔</div>
                                <div>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: "#f9fafb", marginBottom: 2 }}>
                                        新しい通知が {unreadNotifCount} 件あります
                                    </div>
                                    <div style={{ fontSize: 12, color: "#a5b4fc" }}>
                                        タップして確認 →
                                    </div>
                                </div>
                            </div>
                            <div style={{ background: "#ef4444", color: "#fff", padding: "4px 12px", borderRadius: 999, fontSize: 13, fontWeight: 800 }}>
                                {unreadNotifCount}
                            </div>
                        </div>
                    </div>
                )}
                {pendingSurveys.length > 0 && (
                    <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto 24px" }}>
                        <div
                            onClick={() => router.push(pendingSurveys.length === 1 ? `/surveys/${pendingSurveys[0].id}` : "/surveys")}
                            style={{
                                cursor: "pointer",
                                padding: "20px 24px",
                                borderRadius: 16,
                                background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))",
                                border: "2px solid rgba(168,85,247,0.5)",
                                position: "relative",
                                overflow: "hidden",
                                transition: "all 0.2s ease",
                                boxShadow: "0 0 30px rgba(168,85,247,0.2)",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "translateY(-2px)";
                                e.currentTarget.style.boxShadow = "0 4px 40px rgba(168,85,247,0.4)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "0 0 30px rgba(168,85,247,0.2)";
                            }}
                        >
                            {/* キラキラ装飾 */}
                            <div style={{ position: "absolute", top: -20, right: -20, fontSize: 80, opacity: 0.1 }}>📋</div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                        <span style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(251,191,36,0.2)", color: "#fbbf24", fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>📢 NEW</span>
                                        <span style={{ fontSize: 16, fontWeight: 800, color: "#f9fafb" }}>
                                            未回答のアンケートが{pendingSurveys.length}件あります
                                        </span>
                                    </div>
                                    {pendingSurveys.length === 1 ? (
                                        <div style={{ fontSize: 13, color: "#c7d2fe", marginBottom: 6 }}>
                                            📋 {pendingSurveys[0].title}（{pendingSurveys[0].question_count}問）
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 13, color: "#c7d2fe", marginBottom: 6 }}>
                                            📋 タップして一覧を確認
                                        </div>
                                    )}
                                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                        <span style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(168,85,247,0.25)", color: "#c084fc", fontSize: 12, fontWeight: 800 }}>
                                            🎁 +{pendingSurveys.reduce((sum, s) => sum + s.reward_points, 0)}pt 獲得可能
                                        </span>
                                        <span style={{ fontSize: 11, color: "#9ca3af" }}>所要時間: 約3〜5分</span>
                                    </div>
                                </div>
                                <div style={{
                                    flexShrink: 0,
                                    padding: "12px 20px",
                                    borderRadius: 10,
                                    background: "linear-gradient(135deg, #6366f1, #a855f7)",
                                    color: "#fff",
                                    fontWeight: 800,
                                    fontSize: 14,
                                    whiteSpace: "nowrap",
                                    boxShadow: "0 4px 12px rgba(99,102,241,0.4)",
                                }}>
                                    回答する →
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {floatingPoints.map(fp => (
                    <motion.div
                        key={fp.id}
                        initial={{ opacity: 1, y: 0, scale: 0.5, x: fp.x - 40 }}
                        animate={{ opacity: 0, y: -120, scale: 1.4 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.4, ease: "easeOut" }}
                        style={{
                            position: "fixed",
                            top: fp.y - 30,
                            left: 0,
                            zIndex: 9998,
                            pointerEvents: "none",
                            fontSize: 28,
                            fontWeight: 900,
                            color: "#fbbf24",
                            textShadow: "0 0 20px rgba(251,191,36,0.8), 0 0 40px rgba(251,191,36,0.4)",
                            letterSpacing: 1,
                        }}
                    >
                        +{fp.value}pt ✨
                    </motion.div>
                ))}
            </AnimatePresence>

            {showNameModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ background: "#0f0f1a", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 20, padding: 40, width: 400 }}>
                        <div style={{ fontSize: 12, color: themeColor, fontWeight: 700, letterSpacing: 3, marginBottom: 8 }}>INTERN QUEST</div>
                        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#f9fafb", margin: "0 0 8px" }}>名前を教えてください</h2>
                        <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 24px" }}>ランキングや管理画面に表示されます</p>
                        <input value={inputName} onChange={(e) => setInputName(e.target.value)} placeholder="例：田中太郎" onKeyDown={(e) => e.key === "Enter" && handleSaveProfile()} style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f9fafb", fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 16 }} />
                        <button onClick={async () => { await handleSaveProfile(); setShowNameModal(false); }} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 16 }}>登録する →</button>
                    </div>
                </div>
            )}

            {/* ===== レベルアップ演出（派手バージョン） ===== */}
            <AnimatePresence>
                {levelUpShow && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{
                            position: "fixed", inset: 0, zIndex: 9990,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            pointerEvents: "none",
                            background: "radial-gradient(ellipse at center, rgba(99,102,241,0.3) 0%, transparent 70%)",
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0, rotate: -20 }}
                            animate={{ scale: [0, 1.3, 1.1, 1.2], rotate: [0, 5, -3, 0] }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: "spring", bounce: 0.6, duration: 0.8 }}
                            style={{
                                background: "linear-gradient(135deg, #1a1a3e, #0f0f2a)",
                                border: "2px solid rgba(99,102,241,0.8)",
                                borderRadius: 32,
                                padding: "48px 80px",
                                textAlign: "center",
                                boxShadow: "0 0 120px rgba(99,102,241,0.7), 0 0 60px rgba(139,92,246,0.5), inset 0 0 40px rgba(99,102,241,0.1)",
                            }}
                        >
                            <motion.div
                                animate={{ rotate: [0, 15, -15, 10, -10, 0] }}
                                transition={{ duration: 0.6, delay: 0.3 }}
                                style={{ fontSize: 64, marginBottom: 8 }}
                            >
                                🎉
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                style={{ fontSize: 13, color: "#818cf8", fontWeight: 800, letterSpacing: 5, marginBottom: 8 }}
                            >
                                LEVEL UP!
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3, type: "spring", bounce: 0.5 }}
                                style={{
                                    fontSize: 80, fontWeight: 900, color: "#fff",
                                    lineHeight: 1,
                                    textShadow: "0 0 40px rgba(139,92,246,0.8), 0 0 20px rgba(99,102,241,0.6)",
                                }}
                            >
                                Lv.{level}
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                style={{ fontSize: 16, color: "#c7d2fe", marginTop: 12, fontWeight: 600 }}
                            >
                                おめでとうございます！🚀
                            </motion.div>

                            {/* 周囲を回るリング */}
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                style={{
                                    position: "absolute", inset: -20,
                                    borderRadius: 48,
                                    border: "2px dashed rgba(99,102,241,0.4)",
                                    pointerEvents: "none",
                                }}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: `radial-gradient(ellipse at 20% 50%, ${themeColor}08 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, ${themeColor}05 0%, transparent 60%)`, pointerEvents: "none", zIndex: 0 }} />

           <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "none", marginBottom: 16, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 16, padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div onClick={() => router.push("/dotkun")} title="ドットくんのことを知る" style={{ width: 64, height: 64, borderRadius: 16, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><DotKun size={58} stage={level >= 70 ? 5 : level >= 50 ? 4 : level >= 30 ? 3 : level >= 10 ? 2 : 1} mood={isSubmitted ? "happy" : streak >= 1 ? "happy" : "sad"} /></div>
                            <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 2 }}>ドットくんより</div>
                        </div>
                        <div style={{ fontSize: 12, color: textMuted }}>{new Date().toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}</div>
                    </div>
                    <p style={{ margin: "0 0 16px", fontSize: 15, color: isLightBg ? "#4b5563" : "#c7d2fe", lineHeight: 1.8, fontWeight: 500 }}>{aiComment}</p>
                    <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", fontSize: 13, color: "#818cf8", fontWeight: 600 }}>
                        {dotKunSuggestion}
                    </div>
                    <div style={{ marginTop: 10, padding: "12px 16px", borderRadius: 10, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.25)" }}>
                        <div style={{ fontSize: 11, color: "#f43f5e", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>🎯 まずはこれをやってみよう</div>
                        <div style={{ fontSize: 14, color: isLightBg ? "#4b5563" : "#fda4af", fontWeight: 600, lineHeight: 1.6 }}>{dailyMission}</div>
                    </div>
                    {suggestions.length > 0 && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, letterSpacing: 1, marginBottom: 2 }}>💡 ドットくんからのおすすめ</div>
                        {suggestions.map((sg, i) => (
                            <div key={i} onClick={() => router.push(sg.href)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)", cursor: "pointer" }}>
                                <div style={{ fontSize: 22 }}>{sg.icon}</div>
                                <div style={{ flex: 1, fontSize: 13, color: isLightBg ? "#4b5563" : "#c7d2fe", fontWeight: 600, lineHeight: 1.5 }}>{sg.text}</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", padding: "6px 14px", borderRadius: 20, whiteSpace: "nowrap" }}>{sg.cta}</div>
                            </div>
                        ))}
                    </div>
                    )}
                </div>
                
                <div style={{ order: -3, display: "none", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 16 : 0, marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        {avatarUrl ? (
                            <img src={avatarUrl} alt={name} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", display: "block", border: "3px solid rgba(99,102,241,0.6)" }} />
                        ) : (
                            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                                {name ? name.charAt(0) : "?"}
                            </div>
                        )}
                        <div>
                            <div onClick={() => router.push("/home")} style={{ fontSize: 11, color: themeColor, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 4, cursor: "pointer" }}>INTERN QUEST</div>
                            <h1 style={{ fontSize: 26, fontWeight: 800, color: textPrimary, margin: 0, lineHeight: 1 }}>{name || "名前未設定"}</h1>
                            {topTrophy && (
                                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ fontSize: 15 }}>{topTrophy.icon}</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: getRarityStyle(topTrophy.rarity).color }}>{topTrophy.name}</span>
                                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: getRarityStyle(topTrophy.rarity).bg, border: `1px solid ${getRarityStyle(topTrophy.rarity).border}`, color: getRarityStyle(topTrophy.rarity).color, fontWeight: 700 }}>{getRarityStyle(topTrophy.rarity).label}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0, justifyContent: isMobile ? "flex-start" : "flex-end", flexWrap: "wrap" }}>
                        <button onClick={() => setShowProfileModal(true)} style={{ background: cardBg, color: textPrimary, padding: "8px 10px", borderRadius: 8, border: `1px solid ${cardBorder}`, fontWeight: 600, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>✏️ プロフィール</button>
                        <button onClick={() => router.push("/report")} style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}aa)`, color: "#fff", padding: "8px 12px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>📋 日報</button>
                        <button onClick={() => router.push("/menu")} style={{ background: cardBg, color: textPrimary, padding: "8px 10px", borderRadius: 8, border: `1px solid ${cardBorder}`, fontWeight: 600, cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" }}>☰ メニュー</button>
                    </div>
                </div>

                {/* ===== プロフィールヒーロー（統合版） ===== */}
                <div style={{ order: -2, position: "relative", marginBottom: 22, borderRadius: 28, padding: "72px 20px 18px", background: "linear-gradient(180deg, rgba(255,253,246,0) 0%, rgba(255,251,240,.5) 52%, rgba(255,251,240,.95) 100%), url(/island/room_bg.png) center top / cover no-repeat", border: "1.5px solid rgba(190,170,130,.35)", boxShadow: "0 10px 30px rgba(120,100,60,.16)", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 8, zIndex: 2 }}>
                        <button onClick={() => router.push("/home")} style={{ width: 36, height: 36, borderRadius: "50%", border: "1.5px solid rgba(190,170,130,.4)", background: "rgba(255,255,255,.85)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>🏝️</button>
                        <button onClick={() => setShowProfileModal(true)} style={{ width: 36, height: 36, borderRadius: "50%", border: "1.5px solid rgba(190,170,130,.4)", background: "rgba(255,255,255,.85)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>⚙️</button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                        <div style={{ position: "relative", flexShrink: 0 }}>
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={name} style={{ width: 84, height: 84, borderRadius: "50%", objectFit: "cover", display: "block", border: "3px solid rgba(167,139,250,.7)", boxShadow: "0 0 22px rgba(139,92,246,.35)" }} />
                            ) : (
                                <div style={{ width: 84, height: 84, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #a78bfa, #6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 900, color: "#fff", boxShadow: "0 0 22px rgba(139,92,246,.4)" }}>{name ? name.charAt(0) : "?"}</div>
                            )}
                            <div style={{ position: "absolute", bottom: -4, right: -6, borderRadius: 999, padding: "3px 9px", background: "linear-gradient(135deg, #8b5cf6, #6d28d9)", color: "#fff", fontSize: 12, fontWeight: 900, boxShadow: "0 2px 8px rgba(109,40,217,.5)", border: "2px solid #fffdf6" }}>Lv.{level}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color: "#3d3355", lineHeight: 1.2 }}>{name || "名前未設定"}</div>
                            {topTrophy && <div style={{ fontSize: 12, fontWeight: 800, color: "#b0641f", marginTop: 2 }}>{topTrophy.icon} {topTrophy.name}</div>}

                        </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, borderRadius: 18, background: "rgba(255,255,255,.9)", boxShadow: "0 6px 18px rgba(120,100,60,.14)", overflow: "hidden" }}>
                        {[
                            { label: "レベル", value: `Lv.${level}` },
                            { label: "累計獲得pt", value: `${totalEarned.toLocaleString()}pt` },
                            { label: "ランキング", value: rank ? `${rank}位` : "-" },
                            { label: "連続記録", value: `${streak}日` },
                        ].map((it, i) => (
                            <div key={i} style={{ textAlign: "center", padding: "13px 2px 11px", borderLeft: i > 0 ? "1px solid rgba(120,100,60,.14)" : "none" }}>
                                <div style={{ fontSize: 15, fontWeight: 900, color: "#4a3f66", lineHeight: 1.2 }}>{it.value}</div>
                                <div style={{ fontSize: 9.5, fontWeight: 700, color: "#9a8fb0", marginTop: 2 }}>{it.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
                {/* ===== レベルカード（分離） ===== */}
                <div style={{ order: -1, marginBottom: 16, borderRadius: 20, padding: "18px 20px", background: "rgba(255,253,246,.75)", border: "1px solid rgba(190,170,130,.22)", boxShadow: "0 4px 14px rgba(120,100,60,.08)", display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                            <div style={{ fontSize: 15, fontWeight: 900, color: "#4a3f66" }}>Lv.{level}<span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg, #a78bfa, #7c5ce0)", borderRadius: 8, padding: "2px 8px", marginLeft: 8 }}>達人</span></div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "#b0641f" }}>あと{100 - exp}ptで Lv.{level + 1}！</div>
                        </div>
                        <div style={{ height: 9, borderRadius: 999, background: "rgba(120,100,150,.14)" }}>
                            <div style={{ height: "100%", width: `${exp}%`, borderRadius: 999, background: "linear-gradient(90deg, #8b5cf6, #c4b5fd)", transition: "width 1s ease" }} />
                        </div>
                        <div style={{ marginTop: 9, fontSize: 11.5, fontWeight: 700, color: "#8a7fa5" }}>次のレベルで解放されるもの<span style={{ marginLeft: 8, color: "#6b5f8a" }}>・称号  ・バッジの獲得チャンス</span></div>
                    </div>
                    <div style={{ fontSize: 40, flexShrink: 0 }}>🎁</div>
                </div>
                {/* ===== 努力ランクカード（モック準拠） ===== */}
                {(() => {
                    const AXES = [
                        { axis: "学歴", value: getEducationScore(education), full: 20 },
                        { axis: "活動期間", value: Math.min(activeDays * (15 / 730), 15), full: 20 },
                        { axis: "実績KPI", value: Math.min(approvedKpiCount * 0.75, 15), full: 20 },
                        { axis: "メタ認知", value: Math.min(level * (4 / 15), 10), full: 20 },
                        { axis: "アウトプット", value: Math.min(Math.floor(esUpdateCount / 10), 20), full: 20 },
                        { axis: "リーダー", value: Math.min(Math.floor((thanksCount + mentorCount) / 20), 10), full: 20 },
                        { axis: "思考力", value: Math.min(Math.floor(thinkingAnswerCount / 5), 20), full: 20 },
                    ];
                    const sorted = [...AXES].sort((a, b) => (b.value / b.full) - (a.value / a.full));
                    const best = sorted[0], worst = sorted[sorted.length - 1];
                    return (
                        <div style={{ order: -1, marginBottom: 16, borderRadius: 20, padding: "18px 20px", background: "rgba(255,253,246,.8)", border: "1px solid rgba(190,170,130,.22)", boxShadow: "0 4px 14px rgba(120,100,60,.08)" }}>
                            <div style={{ fontSize: 13.5, fontWeight: 900, color: "#4a3f66", marginBottom: 14 }}>努力ランク</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                                    <div style={{ width: 52, height: 60, borderRadius: 12, background: "linear-gradient(150deg, #8b5cf6, #6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: "#fff", boxShadow: "0 4px 12px rgba(109,40,217,.35)" }}>{rank2 || "-"}</div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: "#9a8fb0" }}>スコア</div>
                                        <div style={{ fontSize: 26, fontWeight: 900, color: "#4a3f66", lineHeight: 1.1 }}>{rankScore}<span style={{ fontSize: 12, color: "#9a8fb0", fontWeight: 700 }}>/100</span></div>
                                    </div>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "#9a8fb0" }}><span>⭐</span><span>あなたの強み</span></div>
                                    <div style={{ fontSize: 14, fontWeight: 900, color: "#b0641f", marginBottom: 8, marginLeft: 2 }}>{best.axis}</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "#9a8fb0" }}><span>🔹</span><span>次に伸ばすと良い項目</span></div>
                                    <div style={{ fontSize: 14, fontWeight: 900, color: "#5a7fb0", marginLeft: 2 }}>{worst.axis}</div>
                                </div>
                            </div>
                            <div style={{ marginTop: 12, height: 6, borderRadius: 999, background: "rgba(120,100,150,.14)" }}>
                                <div style={{ height: "100%", width: `${rankScore}%`, borderRadius: 999, background: "linear-gradient(90deg, #a78bfa, #7c5ce0)" }} />
                            </div>
                            <div style={{ marginTop: 7, fontSize: 11, fontWeight: 700, color: "#9a8fb0", textAlign: "right" }}>{nextRankInfo}</div>
                        </div>
                    );
                })()}
                {/* ===== 成長カード ===== */}
                <div style={{ order: -1, marginBottom: 16, borderRadius: 20, padding: "16px 20px", background: "rgba(255,255,255,.65)", border: "1.5px solid rgba(190,170,130,.3)", boxShadow: "0 4px 14px rgba(120,100,60,.1)" }}>
                    <div style={{ fontSize: 11, color: "#9a8fb0", fontWeight: 800, letterSpacing: 2, marginBottom: 10 }}>📈 成長のきろく</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div style={{ textAlign: "center", padding: "12px 6px", borderRadius: 14, background: "linear-gradient(160deg, rgba(139,92,246,.1), rgba(139,92,246,.04))", border: "1px solid rgba(139,92,246,.25)" }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: "#6d5aa8", lineHeight: 1.2 }}>+{monthPt.toLocaleString()}<span style={{ fontSize: 12 }}>pt</span></div>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9a8fb0", marginTop: 3 }}>今月の獲得</div>
                        </div>
                        <div style={{ textAlign: "center", padding: "12px 6px", borderRadius: 14, background: "linear-gradient(160deg, rgba(52,180,120,.1), rgba(52,180,120,.04))", border: "1px solid rgba(52,180,120,.3)" }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: "#3a8a5f", lineHeight: 1.2 }}>+{days30Pt.toLocaleString()}<span style={{ fontSize: 12 }}>pt</span></div>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8aa595", marginTop: 3 }}>過去30日</div>
                        </div>
                    </div>
                </div>
                {/* ===== 開催中イベント ===== */}
                {[
                    { key: "hr_campaign", icon: "🔥", title: "HRキャンペーン開催中！", desc: "DM +3pt ／ メンツナ +15pt ／ 面談 +30pt ／ 入社 +100pt", path: "/recruit", from: "#f97316", to: "#ec4899" },
                ].map((ev) => (
                    <div key={ev.key} onClick={() => router.push(ev.path)} style={{ marginBottom: 12, borderRadius: 18, padding: "14px 18px", cursor: "pointer", position: "relative", overflow: "hidden", background: `linear-gradient(120deg, ${ev.from}, ${ev.to})`, boxShadow: "0 6px 18px rgba(236,72,153,.3)", border: "1.5px solid rgba(255,255,255,.35)" }}>
                        <div style={{ position: "absolute", top: -18, right: -12, fontSize: 72, opacity: .2, transform: "rotate(-12deg)" }}>{ev.icon}</div>
                        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2.5, color: "rgba(255,255,255,.85)", marginBottom: 4 }}>🎪 EVENT</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,.15)" }}>{ev.icon} {ev.title}</div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,.9)", marginTop: 4 }}>{ev.desc}</div>
                        <div style={{ marginTop: 8, display: "inline-block", padding: "5px 14px", borderRadius: 999, background: "rgba(255,255,255,.25)", border: "1px solid rgba(255,255,255,.4)", fontSize: 11.5, fontWeight: 800, color: "#fff" }}>参加する →</div>
                    </div>
                ))}
                {announcements.filter(a => !closedAnnouncements.includes(a.id)).map((a) => (
                    <div key={a.id} style={{ marginBottom: 12, padding: "14px 20px", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", marginBottom: 4 }}>📢 {a.title}</div>
                            <div style={{ fontSize: 13, color: isLightBg ? "#4b5563" : "#c7d2fe", lineHeight: 1.6 }}>{a.content}</div>
                        </div>
                        <button onClick={() => setClosedAnnouncements(prev => [...prev, a.id])} style={{ marginLeft: 16, background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18 }}>×</button>
                    </div>
                ))}

                {message && <div style={{ marginBottom: 20, padding: "12px 20px", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, color: "#a5b4fc", fontSize: 14 }}>{message}</div>}

                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                    <div className="status-cards" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                        {[
                            {
                                title: "TOTAL POINTS", tip: "獲得したポイントの累計です", ref: pointsCardRef, content: (
                                    <div>
                                        <div style={{ fontSize: 36, fontWeight: 800, color: textPrimary, lineHeight: 1 }}>{totalEarned.toLocaleString()}</div>
                                        <div style={{ fontSize: 16, color: themeColor, fontWeight: 600, marginTop: 4 }}>pt</div>
                                        <div style={{ marginTop: 12, padding: "6px 12px", background: "rgba(99,102,241,0.1)", borderRadius: 6, display: "inline-block" }}>
                                            <span style={{ fontSize: 12, color: "#818cf8" }}>🏆 順位 {rank || "-"}位</span>
                                        </div>
                                    </div>
                                )
                            },
                            {
                                title: "LEVEL", tip: "ポイントが100pt貯まるごとにレベルアップします", ref: undefined, content: (
                                    <div>
                                        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                                            <div style={{ fontSize: 48, fontWeight: 800, color: textPrimary, lineHeight: 1 }}>Lv.{level}</div>
                                            <div style={{ padding: "4px 10px", borderRadius: 6, background: badgeColor, fontSize: 12, fontWeight: 700, color: "#fff" }}>{badgeLabel}</div>
                                        </div>
                                        <div style={{ marginTop: 16 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: textMuted, marginBottom: 6 }}>
                                                <span>EXP {exp}/100</span><span>次まで {100 - exp}</span>
                                            </div>
                                            <div style={{ height: 6, borderRadius: 999, background: barBg }}>
                                                <div style={{ height: "100%", width: `${exp}%`, background: `linear-gradient(90deg, ${themeColor}, ${themeColor}aa)`, borderRadius: 999 }} />
                                            </div>
                                            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: textMuted, fontWeight: 600 }}>
                                                <span>🎁</span><span>レベルが上がると: 称号・バッジの獲得チャンス</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            },
                        ].filter((card) => !["TOTAL POINTS", "LEVEL", "EFFORT RANK"].includes(card.title)).map((card) => (
                            <div key={card.title} ref={card.ref} style={{ position: "relative" }}
                                onMouseEnter={() => { const t = document.getElementById(`tip-card-${card.title}`); if (t) t.style.display = "block"; }}
                                onMouseLeave={() => { const t = document.getElementById(`tip-card-${card.title}`); if (t) t.style.display = "none"; }}
                            >
                                <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: "16px 12px", height: "100%", boxSizing: "border-box" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                        <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2 }}>{card.title}</div>
                                        <div style={{ fontSize: 12, color: textMuted, cursor: "help" }}>💡</div>
                                    </div>
                                    {card.content}
                                </div>
                                <div id={`tip-card-${card.title}`} style={{ display: "none", position: "absolute", top: -44, left: 0, background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#c7d2fe", whiteSpace: "nowrap", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
                                    {card.tip}
                                </div>
                            </div>
                        ))}
                    </div>

                   {GOSHUGI_MILESTONES.filter((m) => {
                        if (activeDays < m.days) return false; // まだ到達していない
                        if (anniversaryClaimed.includes(m.days)) return false; // 取得済み
                        // 機能導入日（2026-06-09）以降に到達した節目だけ祝う
                        if (!startedAt) return false;
                        const reachMs = new Date(startedAt).getTime() + m.days * 24 * 60 * 60 * 1000;
                        const launchMs = new Date("2026-06-09").getTime();
                        return reachMs >= launchMs;
                    }).map((m) => (
                        <div key={m.days} style={{ background: "linear-gradient(135deg, #f43f5e, #ec4899)", borderRadius: 16, padding: 20, marginBottom: 16, textAlign: "center" }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 4 }}>🎉 入社{m.days}日おめでとう！</div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginBottom: 12 }}>節目を記念して、ご祝儀ガチャを引けます</div>
                            <button onClick={() => handleGoshugiGacha(m.days)} disabled={goshugiSpinning} style={{ padding: "12px 32px", borderRadius: 100, border: "3px solid #fff", background: "#fff", color: "#e11d48", fontSize: 16, fontWeight: 900, cursor: goshugiSpinning ? "wait" : "pointer" }}>
                                {goshugiSpinning ? "🧧 ..." : "🧧 ご祝儀ガチャを引く"}
                            </button>
                        </div>
                    ))}
                    {goshugiResult && (
                        <div onClick={() => setGoshugiResult(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, cursor: "pointer" }}>
                            <div style={{ background: "linear-gradient(135deg, #1f1f2e, #2a1f3d)", padding: 48, borderRadius: 24, textAlign: "center", border: "2px solid #f43f5e", maxWidth: 360 }}>
                                <div style={{ fontSize: 48, marginBottom: 8 }}>🧧</div>
                                <div style={{ fontSize: 16, color: "#fff", fontWeight: 800, marginBottom: 4 }}>入社{goshugiResult.milestone}日 ご祝儀</div>
                                <div style={{ fontSize: 56, fontWeight: 900, color: "#fb7185", marginBottom: 8 }}>+{goshugiResult.reward}<span style={{ fontSize: 24 }}>pt</span></div>
                                <div style={{ fontSize: 12, color: "#9ca3af" }}>タップして閉じる</div>
                            </div>
                        </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                        {[
                            {
                                title: "EFFORT RANK", tip: "日々の活動量・質を7軸で総合評価したランクです", content: (
                                    <div>
                                        {/* スコアセクション */}
                                        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                                            <div style={{ width: 72, height: 72, borderRadius: 16, background: rankColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: "#fff" }}>{rank2}</div>
                                            <div>
                                                <div style={{ fontSize: 13, color: textMuted, marginBottom: 4 }}>スコア</div>
                                                <div style={{ fontSize: 28, fontWeight: 800, color: textPrimary }}>{rankScore}</div>
                                                <div style={{ fontSize: 11, color: textMuted }}>/100</div>
                                            </div>
                                        </div>

                                        {/* レーダーチャート + 軸バー（PCは2列、スマホは縦並び） */}
                                        <div style={{ display: "none", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, alignItems: "center", marginBottom: 12 }}>
                                            <ResponsiveContainer width="100%" height={220}>
                                                <RadarChart data={[
                                                    { axis: "学歴", value: getEducationScore(education), fullMark: 20 },
                                                    { axis: "活動期間", value: Math.min(activeDays * (15 / 730), 15), fullMark: 20 },
                                                    { axis: "実績KPI", value: Math.min(approvedKpiCount * 0.75, 15), fullMark: 20 },

                                                    { axis: "メタ認知", value: Math.min(level * (4 / 15), 10), fullMark: 20 },
                                                    { axis: "アウトプット", value: Math.min(Math.floor(esUpdateCount / 10), 20), fullMark: 20 },
                                                    { axis: "リーダー", value: Math.min(Math.floor((thanksCount + mentorCount) / 20), 10), fullMark: 20 },
                                                    { axis: "思考力", value: Math.min(Math.floor(thinkingAnswerCount / 5), 20), fullMark: 20 },
                                                ]}>
                                                    <PolarGrid stroke={barBg} />
                                                    <PolarAngleAxis dataKey="axis" tick={{ fill: textMuted, fontSize: 10, fontWeight: 600 }} />
                                                    <Radar name="スコア" dataKey="value" stroke={themeColor} fill={themeColor} fillOpacity={0.3} strokeWidth={2} />
                                                </RadarChart>
                                            </ResponsiveContainer>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                                {[
                                                    { label: "学歴", value: getEducationScore(education), max: 10, color: "#6366f1" },
                                                    { label: "活動期間", value: Math.min(activeDays * (15 / 730), 15), max: 15, color: "#8b5cf6" },
                                                    { label: "実績KPI", value: Math.min(approvedKpiCount * 0.75, 15), max: 15, color: "#06b6d4" },
                                                    { label: "思考力", value: Math.min(Math.floor(thinkingAnswerCount / 5), 20), max: 20, color: "#f59e0b" },
                                                    { label: "リーダー", value: Math.min(Math.floor((thanksCount + mentorCount) / 20), 10), max: 10, color: "#ec4899" },
                                                    { label: "アウトプット", value: Math.min(Math.floor(esUpdateCount / 10), 20), max: 20, color: "#10b981" },
                                                    { label: "メタ認知", value: Math.min(level * (4 / 15), 10), max: 10, color: "#f97316" },
                                                ].map((axis) => (
                                                    <div key={axis.label}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
                                                            <span style={{ color: textMuted }}>{axis.label}</span>
                                                            <span style={{ color: axis.color, fontWeight: 700 }}>{Math.round(axis.value)}/{axis.max}</span>
                                                        </div>
                                                        <div style={{ height: 3, borderRadius: 999, background: barBg }}>
                                                            <div style={{ height: "100%", width: `${(axis.value / axis.max) * 100}%`, background: axis.color, borderRadius: 999 }} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 総合スコアバー */}
                                        <div style={{ height: 4, borderRadius: 999, background: barBg }}>
                                            <div style={{ height: "100%", width: `${rankScore}%`, background: rankColor, borderRadius: 999 }} />
                                        </div>
                                        <div style={{ fontSize: 12, color: textMuted, marginTop: 8 }}>{nextRankInfo}</div>
                                    </div>
                                )
                            },
                        ].filter((card) => card.title !== "EFFORT RANK").map((card) => (
                            <div key={card.title} style={{ position: "relative" }}
                                onMouseEnter={() => { const t = document.getElementById(`tip-card-${card.title}`); if (t) t.style.display = "block"; }}
                                onMouseLeave={() => { const t = document.getElementById(`tip-card-${card.title}`); if (t) t.style.display = "none"; }}
                            >
                                <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: "16px 12px", height: "100%", boxSizing: "border-box" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                        <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2 }}>{card.title}</div>
                                        <div style={{ fontSize: 12, color: textMuted, cursor: "help" }}>💡</div>
                                    </div>
                                    {card.content}
                                </div>
                                <div id={`tip-card-${card.title}`} style={{ display: "none", position: "absolute", top: -44, left: 0, background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#c7d2fe", whiteSpace: "nowrap", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
                                    {card.tip}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>


                {/* ===== タグ ===== */}
                <div style={{ marginBottom: 16, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2 }}>🏷️ MY TAGS</div>
                        <button onClick={() => setShowTagEdit(!showTagEdit)} style={{ padding: "4px 14px", borderRadius: 8, border: `1px solid ${cardBorder}`, background: showTagEdit ? `${themeColor}22` : "transparent", color: showTagEdit ? themeColor : textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{showTagEdit ? "完了" : "編集"}</button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                        {mbti && <div style={{ padding: "4px 11px", borderRadius: 20, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", fontSize: 11.5, color: "#818cf8", fontWeight: 700 }}>🧠 {mbti}</div>}
                        {club && <div style={{ padding: "4px 11px", borderRadius: 20, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", fontSize: 11.5, color: "#f59e0b", fontWeight: 700 }}>⚽ {club}</div>}
                        {userTags.map(tag => (
                            <div key={tag.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 20, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", fontSize: 11.5, color: "#34d399", fontWeight: 700 }}>
                                {tag.tag}
                                {showTagEdit && <button onClick={() => handleDeleteTag(tag.id)} style={{ background: "none", border: "none", color: "#34d399", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1, opacity: 0.7 }}>×</button>}
                            </div>
                        ))}
                        {userTags.length === 0 && !mbti && !club && <div style={{ fontSize: 13, color: textMuted }}>タグがありません。追加してみましょう！</div>}
                    </div>
                    {showTagEdit && <div style={{ display: "flex", gap: 8 }}>
                        <input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddTag()} placeholder="例：🏢 新宿オフィス、💼 営業担当" style={{ flex: 1, padding: "8px 14px", borderRadius: 10, border: `1px solid ${cardBorder}`, background: inputBg, color: textPrimary, fontSize: 13, outline: "none" }} />
                        <button onClick={handleAddTag} disabled={tagSaving || !newTag.trim()} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: newTag.trim() ? `linear-gradient(135deg, ${themeColor}, ${themeColor}aa)` : "rgba(255,255,255,0.1)", color: "#fff", fontWeight: 700, cursor: newTag.trim() ? "pointer" : "not-allowed", fontSize: 13 }}>追加</button>
                    </div>}
                </div>

                {/* ===== コレクション（統合サマリー） ===== */}
                <div style={{ marginBottom: 16, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2 }}>🎖️ バッジ & コレクション</div>
                        <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 600 }}>{unlockedTrophies.length + badges.filter(b => b.unlocked).length + myBadgeIds.length} / {trophies.length + badges.length + achieveBadges.length} 獲得</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch" }}>
                        {[
                            ...badges.filter(b => b.unlocked).map(b => ({ icon: b.icon, name: b.name })),
                            ...achieveBadges.filter(b => myBadgeIds.includes(b.id)).map(b => ({ icon: b.icon || "🏅", name: b.name })),
                            ...unlockedTrophies.map(t => ({ icon: t.icon, name: t.name })),
                        ].slice(0, 8).map((item, i) => (
                            <div key={i} style={{ flexShrink: 0, width: 92, textAlign: "center", padding: "14px 6px 12px", borderRadius: 14, background: "linear-gradient(160deg, rgba(255,255,255,.85), rgba(245,238,255,.85))", border: "1.5px solid rgba(140,120,200,.25)", boxShadow: "0 3px 10px rgba(100,80,160,.12)" }}>
                                <div style={{ fontSize: 30, marginBottom: 5 }}>{item.icon}</div>
                                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#4a3f66", lineHeight: 1.3 }}>{item.name}</div>
                            </div>
                        ))}
                        {(unlockedTrophies.length + badges.filter(b => b.unlocked).length + myBadgeIds.length) === 0 && (
                            <div style={{ fontSize: 12, color: textMuted, padding: "8px 0" }}>まだ獲得したものがありません。活動して集めよう！</div>
                        )}
                    </div>
                    <button onClick={() => setShowAllCollection(!showAllCollection)} style={{ width: "100%", marginTop: 10, padding: "9px 0", borderRadius: 10, border: `1px solid ${cardBorder}`, background: "transparent", color: "#818cf8", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{showAllCollection ? "▲ 閉じる" : "▼ コレクションをすべて見る"}</button>
                </div>
                {/* ===== トロフィー ===== */}
                <div style={{ display: showAllCollection ? undefined : "none", marginBottom: 16, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24 }}>
                    <div onClick={() => setShowTrophies(!showTrophies)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showTrophies ? 16 : 0, cursor: "pointer", userSelect: "none" }}>
                        <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2 }}>🏆 TROPHIES & 称号 {showTrophies ? "▲" : "▼"}</div>
                        <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 600 }}>{unlockedTrophies.length} / {trophies.length} 獲得</div>
                    </div>
                    {showTrophies && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                        {[...trophies].sort((a, b) => { const order = { legendary: 4, epic: 3, rare: 2, common: 1 }; return order[b.rarity] - order[a.rarity]; }).map(trophy => {
                            const s = getRarityStyle(trophy.rarity);
                            return (
                                <div key={trophy.id} style={{ padding: "14px 16px", borderRadius: 12, background: trophy.unlocked ? s.bg : "rgba(255,255,255,0.02)", border: `1px solid ${trophy.unlocked ? s.border : "rgba(255,255,255,0.06)"}`, opacity: trophy.unlocked ? 1 : 0.4 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <span style={{ fontSize: 28, filter: trophy.unlocked ? "none" : "grayscale(1)" }}>{trophy.icon}</span>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: trophy.unlocked ? textPrimary : textMuted }}>{trophy.name}</div>
                                            <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>{trophy.description}</div>
                                            <div style={{ marginTop: 4, fontSize: 10, padding: "1px 6px", borderRadius: 4, display: "inline-block", background: trophy.unlocked ? s.bg : "rgba(255,255,255,0.05)", border: `1px solid ${trophy.unlocked ? s.border : "rgba(255,255,255,0.1)"}`, color: trophy.unlocked ? s.color : textMuted, fontWeight: 700 }}>{s.label}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>}
                </div>

                {/* ===== バッジ ===== */}
                <div style={{ display: showAllCollection ? undefined : "none", marginBottom: 16, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24 }}>
                    <div onClick={() => setShowBadges(!showBadges)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showBadges ? 16 : 0, cursor: "pointer", userSelect: "none" }}>
                        <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2 }}>🎖️ BADGES {showBadges ? "▲" : "▼"}</div>
                        <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 600 }}>{badges.filter(b => b.unlocked).length} / {badges.length} 解除済み</div>
                    </div>
                    {showBadges && <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        {badges.map(badge => (
                            <div key={badge.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, background: badge.unlocked ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)", border: `1px solid ${badge.unlocked ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}`, opacity: badge.unlocked ? 1 : 0.4 }}>
                                <span style={{ fontSize: 22, filter: badge.unlocked ? "none" : "grayscale(1)" }}>{badge.icon}</span>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: badge.unlocked ? textPrimary : textMuted }}>{badge.name}</div>
                                    <div style={{ fontSize: 11, color: textMuted }}>{badge.description}</div>
                                </div>
                                {badge.unlocked && <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700, marginLeft: 4 }}>✅</span>}
                            </div>
                        ))}
                    </div>}
                </div>
                {/* ===== 実績バッジ ===== */}
                <div style={{ display: showAllCollection ? undefined : "none", marginBottom: 16, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24 }}>
                    <div onClick={() => setShowAchieve(!showAchieve)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showAchieve ? 16 : 0, cursor: "pointer", userSelect: "none" }}>
                        <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2 }}>🏅 実績バッジ {showAchieve ? "▲" : "▼"}</div>
                        <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 600 }}>{myBadgeIds.length} / {achieveBadges.length} 獲得</div>
                    </div>
                    {showAchieve && achieveBadges.length === 0 && <div style={{ fontSize: 12, color: textMuted }}>まだバッジがありません</div>}
                    {showAchieve && badgeCatOrder.filter(cat => achieveBadges.some(b => b.category === cat)).map(cat => (
                        <div key={cat} style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 700, marginBottom: 8 }}>{cat}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
                                {achieveBadges.filter(b => b.category === cat).map(b => {
                                    const owned = myBadgeIds.includes(b.id);
                                    return (
                                        <div key={b.id} style={{ padding: "12px 6px", borderRadius: 12, textAlign: "center", background: owned ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)", border: `1px solid ${owned ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}`, opacity: owned ? 1 : 0.45 }}>
                                            <div style={{ fontSize: 28, filter: owned ? "none" : "grayscale(1) brightness(0.6)" }}>{b.icon || "\ud83c\udfc5"}</div>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: owned ? textPrimary : textMuted, marginTop: 4 }}>{b.name}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
                {false && myKpis.length > 0 && (
                    <div style={{ marginBottom: 16, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2 }}>MONTHLY KPI</div>
                            <div style={{ fontSize: 12, color: textMuted }}>{new Date().getFullYear()}/{new Date().getMonth() + 1}月</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {myKpis.map((kpi, i) => {
                                const rateColor = kpi.rate >= 100 ? "#34d399" : kpi.rate >= 80 ? "#f59e0b" : kpi.rate >= 60 ? "#f97316" : "#f87171";
                                return (
                                    <div key={i} style={{ padding: "16px 20px", borderRadius: 12, background: isLightBg ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.02)", border: `1px solid ${kpi.approved ? "rgba(52,211,153,0.3)" : cardBorder}` }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ padding: "2px 10px", borderRadius: 6, background: "rgba(99,102,241,0.2)", color: "#818cf8", fontSize: 12, fontWeight: 700 }}>{kpi.deptName}</span>
                                                {kpi.approved && <span style={{ fontSize: 12, color: "#34d399", fontWeight: 600 }}>✅ 承認済</span>}
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                                <span style={{ fontSize: 13, color: textMuted }}>{kpi.result} / {kpi.target}件</span>
                                                <span style={{ fontSize: 20, fontWeight: 800, color: rateColor }}>{kpi.rate}%</span>
                                                <span style={{ fontSize: 16, fontWeight: 700, color: kpi.pts > 0 ? "#818cf8" : textMuted }}>{kpi.approved ? `+${kpi.pts}pt` : `予定${kpi.pts}pt`}</span>
                                            </div>
                                        </div>
                                        <div style={{ height: 8, borderRadius: 999, background: barBg }}>
                                            <div style={{ height: "100%", width: `${Math.min(kpi.rate, 100)}%`, background: rateColor, borderRadius: 999 }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <button onClick={() => router.push("/kpi")} style={{ marginTop: 16, width: "100%", padding: "12px", borderRadius: 10, border: `1px solid ${cardBorder}`, background: cardBg, color: textSecondary, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>📊 KPIを入力・更新する</button>
                    </div>
                )}

                {/* ===== クイックタスク（超目立つ版） ===== */}
                <div style={{
                    display: "none",
                    marginBottom: 20,
                    background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(99,102,241,0.06))",
                    border: "2px solid rgba(139,92,246,0.4)",
                    borderRadius: 20,
                    padding: 28,
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 28 }}>⚡</span>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", lineHeight: 1.2 }}>クイックタスク</div>
                                <div style={{ fontSize: 11, color: "#c4b5fd", fontWeight: 600, marginTop: 2 }}>思いついた瞬間に書く / タップで完了</div>
                            </div>
                        </div>
                        <button onClick={() => router.push("/my-tasks")} style={{ fontSize: 11, color: "#c4b5fd", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700 }}>すべて見る →</button>
                    </div>

                    <div style={{ display: "flex", gap: 10, marginBottom: personalTasks.length > 0 ? 16 : 0 }}>
                        <input
                            type="text"
                            value={newQuickTask}
                            onChange={(e) => setNewQuickTask(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleAddQuick(); }}
                            placeholder="例: Slack削除する、田中さんに連絡..."
                            style={{ flex: 1, padding: "14px 18px", borderRadius: 12, border: "2px solid rgba(139,92,246,0.3)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 15, outline: "none", fontWeight: 500 }}
                        />
                        <button
                            onClick={handleAddQuick}
                            disabled={!newQuickTask.trim() || savingQuick}
                            style={{
                                padding: "14px 22px",
                                borderRadius: 12,
                                border: "none",
                                background: !newQuickTask.trim() ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #ec4899, #8b5cf6, #6366f1)",
                                color: "#fff",
                                fontSize: 15,
                                fontWeight: 900,
                                cursor: !newQuickTask.trim() ? "not-allowed" : "pointer",
                                whiteSpace: "nowrap",
                                boxShadow: newQuickTask.trim() ? "0 4px 16px rgba(139,92,246,0.5)" : "none",
                            }}
                        >
                            {savingQuick ? "..." : "+ 追加"}
                        </button>
                    </div>

                    {personalTasks.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {personalTasks.map((task) => (
                                <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(139,92,246,0.2)" }}>
                                    <button
                                        onClick={() => handleCompleteQuick(task.id)}
                                        style={{ width: 24, height: 24, borderRadius: 8, border: "2px solid rgba(236,72,153,0.5)", background: "transparent", cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(236,72,153,0.2)"}
                                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                    />
                                    <span style={{ flex: 1, color: "#f9fafb", fontSize: 14, fontWeight: 500 }}>{task.title}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div style={{ display: "none", marginBottom: 16, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2 }}>🎯 今日のミッション</div>
                        <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 600 }}>{[true, isSubmitted, todayThanksDone, todayLearnDone].filter(Boolean).length + routineCheckedIds.length} / {4 + routines.length} 完了</div>
                    </div>

                    {/* STREAK表示 */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 12, background: streak > 0 ? "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.10))" : isLightBg ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.02)", border: `1px solid ${streak > 0 ? "rgba(245,158,11,0.3)" : cardBorder}`, marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: 24 }}>🔥</span>
                            <div>
                                <div style={{ fontSize: 11, color: textMuted, fontWeight: 600, letterSpacing: 1 }}>連続提出</div>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                                    <span style={{ fontSize: 24, fontWeight: 800, color: streak > 0 ? "#f59e0b" : textMuted, lineHeight: 1 }}>{streak}</span>
                                    <span style={{ fontSize: 12, color: streak > 0 ? "#f59e0b" : textMuted, fontWeight: 600 }}>日</span>
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: 11, color: textSecondary, textAlign: "right", lineHeight: 1.4, maxWidth: 200 }}>{actionMessage}</div>
                    </div>
                    {/* ルーティンのストリーク表示 */}
                    {false && routines.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 12, background: routineStreak > 0 ? "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.10))" : isLightBg ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.02)", border: `1px solid ${routineStreak > 0 ? "rgba(99,102,241,0.3)" : cardBorder}`, marginBottom: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{ fontSize: 24 }}>🔁</span>
                                <div>
                                    <div style={{ fontSize: 11, color: textMuted, fontWeight: 600, letterSpacing: 1 }}>ルーティン連続達成</div>
                                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                                        <span style={{ fontSize: 24, fontWeight: 800, color: routineStreak > 0 ? "#818cf8" : textMuted, lineHeight: 1 }}>{routineStreak}</span>
                                        <span style={{ fontSize: 12, color: routineStreak > 0 ? "#818cf8" : textMuted, fontWeight: 600 }}>日</span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ fontSize: 11, color: textSecondary, textAlign: "right", lineHeight: 1.4, maxWidth: 200 }}>
                                {routineStreak >= 30 ? "30日達成！素晴らしい習慣です" : routineStreak >= 7 ? `あと${30 - routineStreak}日で30日達成` : routineStreak >= 3 ? `あと${7 - routineStreak}日で7日達成` : `あと${3 - routineStreak}日で最初の報酬`}
                            </div>
                        </div>
                    )}
{(() => { return null; })()}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                            { icon: "🔐", label: "ログインする", done: true, pt: "+1pt", path: null },
                            { icon: "📋", label: "日報を提出する", done: isSubmitted, pt: "+2pt", path: "/report" },
                            { icon: "🎉", label: "サンキューを送る", done: todayThanksDone, pt: "✨", path: "/thanks" },
                            { icon: "📚", label: "学習を完了する", done: todayLearnDone, pt: "+2pt", path: "/learn" },
                        ].map((mission) => (
                            <div key={mission.label} onClick={() => mission.path && !mission.done && router.push(mission.path)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 12, background: mission.done ? "rgba(52,211,153,0.08)" : isLightBg ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.02)", border: `1px solid ${mission.done ? "rgba(52,211,153,0.3)" : cardBorder}`, cursor: mission.path && !mission.done ? "pointer" : "default" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <span style={{ fontSize: 20 }}>{mission.done ? "✅" : mission.icon}</span>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: mission.done ? "#34d399" : textPrimary, textDecoration: mission.done ? "line-through" : "none" }}>{mission.label}</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: mission.done ? "#34d399" : textMuted }}>{mission.pt}</span>
                                    {!mission.done && mission.path && <span style={{ fontSize: 12, color: themeColor, fontWeight: 700 }}>→</span>}
                                </div>
                            </div>
                        ))}
                        {/* 自作ルーティン：タップでメモ入力→チェック */}
                        {routines.map((r) => {
                            const checked = routineCheckedIds.includes(r.id);
                            const isOpen = openRoutineId === r.id;
                            return (
                                <div key={r.id} style={{ borderRadius: 12, background: checked ? "rgba(52,211,153,0.08)" : isLightBg ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.02)", border: `1px solid ${checked ? "rgba(52,211,153,0.3)" : cardBorder}` }}>
                                    <div
                                        onClick={() => {
                                            if (checked) { handleRoutineUncheck(r.id); return; }
                                            setOpenRoutineId(isOpen ? null : r.id);
                                            setRoutineNote("");
                                        }}
                                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", cursor: "pointer" }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <span style={{ fontSize: 20 }}>{checked ? "✅" : "🔁"}</span>
                                            <span style={{ fontSize: 14, fontWeight: 600, color: checked ? "#34d399" : textPrimary, textDecoration: checked ? "line-through" : "none" }}>{r.title}</span>
                                        </div>
                                        <span style={{ fontSize: 11, color: textMuted, fontWeight: 600 }}>{checked ? "タップで解除" : "マイルーティン"}</span>
                                    </div>
                                    {isOpen && !checked && (
                                        <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                                            <input
                                                value={routineNote}
                                                onChange={(e) => setRoutineNote(e.target.value)}
                                                placeholder="今日どうだった？一言で（例：架電32件できた）"
                                                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                                            />
                                            <button
                                                onClick={() => handleRoutineCheck(r.id)}
                                                disabled={routineSaving}
                                                style={{ padding: "10px", borderRadius: 8, border: "none", background: routineSaving ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: routineSaving ? "not-allowed" : "pointer" }}
                                            >
                                                完了にする
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {/* マイルーティン設定への入口 */}
                        <div
                            onClick={() => router.push("/routine")}
                            style={{ display: "none", justifyContent: "center", alignItems: "center", gap: 8, padding: "11px 16px", borderRadius: 12, background: isLightBg ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", border: `1px dashed ${cardBorder}`, cursor: "pointer", marginTop: 2 }}
                        >
                            <span style={{ fontSize: 14 }}>⚙️</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: textMuted }}>マイルーティンを追加・編集する</span>
                            <span style={{ fontSize: 12, color: themeColor, fontWeight: 700 }}>→</span>
                        </div>
                    </div>
                </div>
                <div style={{ display: "none", marginBottom: 16, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24 }}>
                    <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>POINT GROWTH</div>
                    {graphData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={graphData}>
                                <XAxis dataKey="date" stroke={isLightBg ? "#9ca3af" : "#4b5563"} tick={{ fill: textMuted, fontSize: 11 }} />
                                <YAxis stroke={isLightBg ? "#9ca3af" : "#4b5563"} tick={{ fill: textMuted, fontSize: 11 }} />
                                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#f9fafb" }} formatter={(value: unknown) => [`${value}pt`, "累計ポイント"]} />
                                <Line type="monotone" dataKey="points" stroke={themeColor} strokeWidth={2} dot={{ fill: themeColor, r: 4 }} activeDot={{ r: 6, fill: themeColor }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ color: textMuted, fontSize: 14, textAlign: "center", padding: 40 }}>データが蓄積されるとグラフが表示されます</div>
                    )}
                </div>

                <div style={{ display: "none", marginBottom: 16, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
                        <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2 }}>KPI GROWTH</div>
                        {kpiDepts.length > 0 && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {kpiDepts.map((dept) => (
                                    <button key={dept.id} onClick={() => setSelectedDeptId(dept.id)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${selectedDeptId === dept.id ? themeColor : cardBorder}`, background: selectedDeptId === dept.id ? `${themeColor}20` : "transparent", color: selectedDeptId === dept.id ? themeColor : textMuted, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{dept.main_metric}</button>
                                ))}
                            </div>
                        )}
                    </div>
                    {kpiDepts.length > 0 && selectedDeptId ? (() => {
                        const filtered = monthlyKpis.filter(m => m.department_id === selectedDeptId).sort((a, b) => a.year_month.localeCompare(b.year_month));
                        const data = filtered.map(m => ({
                            date: m.year_month,
                            value: m.result || 0,
                        }));
                        const selectedDept = kpiDepts.find(d => d.id === selectedDeptId);
                        const unit = selectedDept?.unit || "件";
                        const metricName = selectedDept?.main_metric || "";
                        return data.length > 0 ? (
                            <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={data}>
                                    <XAxis dataKey="date" stroke={isLightBg ? "#9ca3af" : "#4b5563"} tick={{ fill: textMuted, fontSize: 11 }} />
                                    <YAxis stroke={isLightBg ? "#9ca3af" : "#4b5563"} tick={{ fill: textMuted, fontSize: 11 }} />
                                    <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#f9fafb" }} formatter={(value: unknown) => [`${value}${unit}`, `当月${metricName}`]} />
                                    <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 4 }} activeDot={{ r: 6, fill: "#10b981" }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ color: textMuted, fontSize: 14, textAlign: "center", padding: 40 }}>このKPIのデータがまだありません</div>
                        );
                    })() : (
                        <div style={{ color: textMuted, fontSize: 14, textAlign: "center", padding: 40 }}>月次KPIを入力すると累計推移グラフが表示されます</div>
                    )}
                </div>

                {/* プロフィール編集モーダル */}
                {showProfileModal && (
                    <div onClick={() => setShowProfileModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20001, padding: 20 }}>
                        <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a1a2e", border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24, paddingBottom: 100, maxWidth: 480, width: "100%", maxHeight: "82vh", overflowY: "auto", position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
                            <button onClick={() => setShowProfileModal(false)} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: textMuted, cursor: "pointer", fontSize: 24 }}>×</button>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#f9fafb", marginBottom: 20 }}>✏️ プロフィール編集</div>
                            <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>PROFILE</div>
                            {(mbti || club) && (
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                                    {mbti && <div style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", fontSize: 12, color: "#818cf8", fontWeight: 700 }}>🧠 {mbti}</div>}
                                    {club && <div style={{ padding: "4px 12px", borderRadius: 6, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", fontSize: 12, color: "#f59e0b", fontWeight: 700 }}>⚽ {club}</div>}
                                </div>
                            )}
                            <input value={inputName} onChange={(e) => setInputName(e.target.value)} placeholder="名前を入力" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
                            <input value={education} onChange={(e) => setEducation(e.target.value)} placeholder="学歴を入力（例：〇〇大学）" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
                            <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 11, color: textMuted, marginBottom: 4 }}>🧠 MBTI（シビュラ診断に使われるよ）</div>
                                <select value={mbti} onChange={(e) => setMbti(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: isLightBg ? "rgba(240,240,240,0.8)" : "#1a1a2e", color: textPrimary, fontSize: 14, outline: "none", boxSizing: "border-box" }}>
                                    <option value="">未設定</option>
                                    <option value="INTJ">INTJ</option>
                                    <option value="INTP">INTP</option>
                                    <option value="ENTJ">ENTJ</option>
                                    <option value="ENTP">ENTP</option>
                                    <option value="INFJ">INFJ</option>
                                    <option value="INFP">INFP</option>
                                    <option value="ENFJ">ENFJ</option>
                                    <option value="ENFP">ENFP</option>
                                    <option value="ISTJ">ISTJ</option>
                                    <option value="ISFJ">ISFJ</option>
                                    <option value="ESTJ">ESTJ</option>
                                    <option value="ESFJ">ESFJ</option>
                                    <option value="ISTP">ISTP</option>
                                    <option value="ISFP">ISFP</option>
                                    <option value="ESTP">ESTP</option>
                                    <option value="ESFP">ESFP</option>
                                </select>
                            </div>
                            <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 11, color: textMuted, marginBottom: 4 }}>⚽ 高校の部活</div>
                                <select value={club} onChange={(e) => setClub(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: isLightBg ? "rgba(240,240,240,0.8)" : "#1a1a2e", color: textPrimary, fontSize: 14, outline: "none", boxSizing: "border-box" }}>
                                    <option value="">未設定</option>
                                    <option value="運動部">🏃 運動部</option>
                                    <option value="文化部">🎨 文化部</option>
                                    <option value="帰宅部">🏠 帰宅部</option>
                                </select>
                            </div>
                            <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 11, color: textMuted, marginBottom: 4 }}>🎯 趣味</div>
                                <select value={hobby} onChange={(e) => setHobby(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: isLightBg ? "rgba(240,240,240,0.8)" : "#1a1a2e", color: textPrimary, fontSize: 14, outline: "none", boxSizing: "border-box" }}>
                                    <option value="">未設定</option>
                                    <option value="読書・勉強">読書・勉強</option>
                                    <option value="ゲーム">ゲーム</option>
                                    <option value="スポーツ">スポーツ</option>
                                    <option value="音楽">音楽</option>
                                    <option value="アート・ものづくり">アート・ものづくり</option>
                                    <option value="旅行・アウトドア">旅行・アウトドア</option>
                                    <option value="グルメ">グルメ</option>
                                    <option value="映画・ドラマ">映画・ドラマ</option>
                                    <option value="推し活">推し活</option>
                                    <option value="SNS・配信">SNS・配信</option>
                                    <option value="買い物・ファッション">買い物・ファッション</option>
                                    <option value="ペット・動物">ペット・動物</option>
                                    <option value="サウナ">サウナ</option>
                                    <option value="寝ること・休む">寝ること・休む</option>
                                </select>
                            </div>
                            <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 11, color: textMuted, marginBottom: 4 }}>📅 入社日</div>
                                <input type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box", colorScheme: "dark" }} />
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 11, color: textMuted, marginBottom: 4 }}>🎂 誕生日（任意・お祝いに使われるよ）</div>
                                <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#f9fafb", fontSize: 14, outline: "none", boxSizing: "border-box", colorScheme: "dark" }} />
                            </div>
                            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${cardBorder}`, background: isLightBg ? "rgba(240,240,240,0.8)" : "#1a1a2e", color: textPrimary, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }}>
                                <option value="">事業部を選択</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSaveProfile(); }} disabled={savingProfile} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: saveSuccess ? "linear-gradient(135deg, #10b981, #34d399)" : `linear-gradient(135deg, ${themeColor}, ${themeColor}aa)`, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14, transition: "all 0.3s" }}>{savingProfile ? "保存中..." : saveSuccess ? "✅ 保存しました！" : "保存"}</button>
                        </div>
                    </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>

                    <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 24 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: 2 }}>RECENT ACTIVITY</div>
                            <button onClick={() => router.push("/history")} style={{ background: "none", border: "none", color: themeColor, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>履歴を見る →</button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {history.slice(0, 5).map((item, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: isLightBg ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.02)", border: `1px solid ${cardBorder}` }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{formatReason(item.reason)}</div>
                                        <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>{formatDateTimeJST(item.created_at)}</div>
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: item.change >= 0 ? "#34d399" : "#f87171" }}>
                                        {item.change > 0 ? `+${item.change}` : item.change}pt
                                    </div>
                                </div>
                            ))}
                            {history.length === 0 && <div style={{ color: textMuted, fontSize: 14 }}>履歴がありません</div>}
                        </div>
                    </div>
                </div>
            </div>
            {/* 下部固定ナビ（島の木製バー） */}
            <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 88, display: "flex", zIndex: 50, paddingBottom: 6 }}>
                <div style={{ position: "absolute", inset: "4px 6px 10px", background: "url(/island/nav_wood.png) center / 100% 100% no-repeat", zIndex: 0, pointerEvents: "none" }} />
                {[
                    { ic: "🏝️", label: "ホーム", href: "/home", active: false },
                    { ic: "🏆", label: "ランキング", href: "/ranking", active: false },
                    { ic: "🏠", label: "おうち", href: "/mypage", active: true },
                    { ic: "☰", label: "メニュー", href: "/menu", active: false },
                ].map((t) => (
                    <button key={t.href} onClick={() => router.push(t.href)} style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, paddingBottom: 4, background: "transparent", border: "none", cursor: "pointer", color: t.active ? "#fff" : "rgba(255,255,255,.7)", textShadow: "0 1px 2px rgba(90,55,20,.6)" }}>
                        <div style={{ fontSize: 20 }}>{t.ic}</div>
                        <div style={{ fontSize: 10, fontWeight: t.active ? 900 : 700 }}>{t.label}</div>
                    </button>
                ))}
            </div>
        </main>
    );
}