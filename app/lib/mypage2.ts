// Intern Quest 2.0｜マイページ用の読み取り専用データ取得（新デザインで必要になる集計）。
// すべて SELECT のみ。ポイント・EXP・スキル判定は既存ロジック（lib/skills.ts, lib/island.ts）を呼ぶだけで変更しない。
// 月の境界は日本時間（JST）。月が変わると自動的に新しい月の実績になる。
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateUser, CATEGORIES, type EvalResult } from "./skills";

/** JST の当月範囲（ISO 文字列）と年月キー */
export function jstMonthRange(now = new Date()) {
    const jst = new Date(now.getTime() + 9 * 3600 * 1000);
    const y = jst.getUTCFullYear(), m = jst.getUTCMonth();
    const start = new Date(Date.UTC(y, m, 1) - 9 * 3600 * 1000);
    const end = new Date(Date.UTC(y, m + 1, 1) - 9 * 3600 * 1000);
    return { start: start.toISOString(), end: end.toISOString(), ym: `${y}-${String(m + 1).padStart(2, "0")}`, year: y, month: m + 1, daysInMonth: new Date(Date.UTC(y, m + 1, 0)).getUTCDate() };
}
const jstDay = (iso: string) => { const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000); return d.getUTCDate(); };

// ---------- 今月の目標 ----------
// 全事業部共通で計測できるものだけ（スキル習得数・日報提出数）。目標値は既存の目標設定データが無いため null（＝実績のみ表示）。
// 将来：departments.main_metric と monthly_targets（事業部KPI）に接続する。
export type MonthlyGoal = { key: "skills" | "reports"; label: string; value: number; target: number | null; unit: string };
export async function fetchMonthlyGoals(sb: SupabaseClient, uid: string): Promise<{ ym: string; goals: MonthlyGoal[] }> {
    const r = jstMonthRange();
    const [subs, skills] = await Promise.all([
        sb.from("submissions").select("*", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", r.start).lt("created_at", r.end),
        sb.from("user_skills").select("*", { count: "exact", head: true }).eq("user_id", uid).gte("unlocked_at", r.start).lt("unlocked_at", r.end),
    ]);
    return {
        ym: r.ym,
        goals: [
            { key: "skills", label: "スキルを習得", value: skills.count ?? 0, target: null, unit: "個" },
            { key: "reports", label: "日報を提出", value: subs.count ?? 0, target: null, unit: "回" },
        ],
    };
}

// ---------- スキルレーダー（5分野の習得数／分野内スキル数） ----------
export type RadarAxis = { key: string; label: string; en: string; color: string; unlocked: number; total: number };
export function skillRadarFromEval(r: EvalResult): RadarAxis[] {
    return CATEGORIES.map((c) => {
        const nodes = r.nodes.filter((n: any) => n.category === c.key);
        return { key: c.key, label: c.label, en: c.en, color: c.color, unlocked: nodes.filter((n) => n.status === "unlocked").length, total: nodes.length };
    });
}
export async function fetchSkillRadar(sb: SupabaseClient, uid: string): Promise<{ axes: RadarAxis[]; unlocked: number; total: number }> {
    const r = await evaluateUser(sb, uid);     // 読み取りのみ（syncUnlocks は呼ばない）
    const axes = skillRadarFromEval(r);
    return { axes, unlocked: axes.reduce((s, a) => s + a.unlocked, 0), total: axes.reduce((s, a) => s + a.total, 0) };
}

// ---------- 活動カレンダー（当月：日報／スキル解放／学習完了 の日付） ----------
export type CalendarDay = { day: number; report: boolean; skill: boolean; learn: boolean };
export async function fetchActivityCalendar(sb: SupabaseClient, uid: string): Promise<{ year: number; month: number; days: CalendarDay[] }> {
    const r = jstMonthRange();
    const [subs, skills, learns] = await Promise.all([
        sb.from("submissions").select("created_at").eq("user_id", uid).gte("created_at", r.start).lt("created_at", r.end),
        sb.from("user_skills").select("unlocked_at").eq("user_id", uid).gte("unlocked_at", r.start).lt("unlocked_at", r.end),
        sb.from("content_completions").select("created_at").eq("user_id", uid).gte("created_at", r.start).lt("created_at", r.end),
    ]);
    const days: CalendarDay[] = Array.from({ length: r.daysInMonth }, (_, i) => ({ day: i + 1, report: false, skill: false, learn: false }));
    (subs.data ?? []).forEach((x: any) => { const d = days[jstDay(x.created_at) - 1]; if (d) d.report = true; });
    (skills.data ?? []).forEach((x: any) => { if (x.unlocked_at) { const d = days[jstDay(x.unlocked_at) - 1]; if (d) d.skill = true; } });
    (learns.data ?? []).forEach((x: any) => { const d = days[jstDay(x.created_at) - 1]; if (d) d.learn = true; });
    return { year: r.year, month: r.month, days };
}

// ---------- 装備中の称号（SKILL WORLD と同じ扱い：直近に獲得したバッジ） ----------
export async function fetchCurrentTitle(sb: SupabaseClient, uid: string): Promise<{ name: string; icon: string | null } | null> {
    const { data } = await sb.from("user_badges").select("badge_id, granted_at, badges(name, icon)").eq("user_id", uid).order("granted_at", { ascending: false }).limit(1);
    const x: any = (data ?? [])[0];
    return x?.badges?.name ? { name: x.badges.name, icon: x.badges.icon ?? null } : null;
}

// ---------- 最近の活動（points_history を日時順に。付与理由をそのまま表示） ----------
export type RecentActivity = { id: string; title: string; points: number; at: string };
export async function fetchRecentActivity(sb: SupabaseClient, uid: string, limit = 5): Promise<RecentActivity[]> {
    const { data } = await sb.from("points_history").select("id, reason, change, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(limit);
    return (data ?? []).map((x: any) => ({ id: String(x.id), title: x.reason ?? "", points: Number(x.change ?? 0), at: x.created_at }));
}
