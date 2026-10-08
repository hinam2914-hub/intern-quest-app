// SKILL BOARD 判定エンジン
// 使い方: const r = await evaluateUser(supabase, userId); await syncUnlocks(supabase, userId, r);
import type { SupabaseClient } from "@supabase/supabase-js";

export type SkillNode = {
  id: string; category: string; order_no: number; name: string;
  kind: "active" | "passive" | "key"; icon: string | null; description: string | null;
  requires: string[]; is_hidden: boolean; is_active: boolean;
};
export type SkillCondition = {
  id: string; node_id: string; stage: "learn" | "practice" | "prove" | "check";
  type: string; param: string | null; threshold: number; label: string; order_no: number;
};
export type Job = {
  id: string; name: string; icon: string | null; description: string | null;
  requires: string[]; is_obtainable: boolean; order_no: number;
};
export type CondState = SkillCondition & { current: number; done: boolean };
export type NodeState = SkillNode & {
  status: "locked" | "available" | "unlocked";
  unlocked_at: string | null;
  conds: CondState[];
  allDone: boolean;          // 条件を全て満たしている（未反映含む）
  progress: number;          // 0..1
  pendingCheck: boolean;     // メンター認定/申告が審査待ち
};
export type JobState = Job & { unlocked: boolean; unlocked_at: string | null; missing: string[] };
export type EvalResult = {
  nodes: NodeState[]; jobs: JobState[];
  levels: Record<string, number>;         // category -> Lv
  countsByCat: Record<string, number>;    // category -> 取得数
};

export const CATEGORIES: { key: string; label: string; en: string; color: string }[] = [
  { key: "sales", label: "営業力", en: "SALES", color: "#ef4444" },
  { key: "comm", label: "コミュニケーション", en: "COMMUNICATION", color: "#f59e0b" },
  { key: "think", label: "思考力", en: "THINKING", color: "#8b5cf6" },
  { key: "mgmt", label: "マネジメント", en: "MANAGEMENT", color: "#10b981" },
  { key: "ai", label: "AIスキル", en: "AI SKILL", color: "#3b82f6" },
];
export const STAGE_LABEL: Record<string, string> = { learn: "LEARN", practice: "PRACTICE", prove: "PROVE", check: "CHECK" };

export function levelFromCount(n: number) {
  if (n >= 6) return 5; if (n >= 5) return 4; if (n >= 3) return 3; if (n >= 1) return 2; return 1;
}

const GOOD_RESULTS = new Set(["good", "better", "improved", "良くなった", "success"]);
const APPROVED = new Set(["approved", "done", "completed", "ok"]);

type Metrics = {
  profile: Record<string, unknown> | null;
  scriptTest: Record<string, unknown> | null;
  contentCat: Record<string, number>;
  journeyMax: number;
  rookieApproved: Set<string>;
  rookieByBlock: Record<string, string[]>;   // block -> challenge ids
  skillLogCount: Record<string, number>;
  skillExp: Record<string, number>;
  thinkingSessions: number;
  exp: { created: number; reviewed: number; good: number; ai: number; aiGood: number; fromFb: number };
  sales: number;
  reportDays: number;
  fbRequested: number; fbResponded: number; questsIssued: number;
  thanksSent: number; thanksReceived: number;
  personalDone: number;
  routineStreak: number;
  referralHire: number;
  checks: Set<string>;       // approved node ids
  claims: Set<string>;
  pendingChecks: Set<string>;
};

async function loadMetrics(sb: SupabaseClient, uid: string): Promise<Metrics> {
  const [
    prof, st, contents, comps, journey, rookieCh, rookieSub, logs, sessions, exps, sales, subs,
    fbReq, fbRes, thSent, thRecv, ptasks, rchecks, recruit, checks, claims,
  ] = await Promise.all([
    sb.from("profiles").select("*").eq("id", uid).maybeSingle(),
    sb.from("script_test_progress").select("*").eq("user_id", uid).maybeSingle(),
    sb.from("contents").select("id, category").eq("is_active", true),
    sb.from("content_completions").select("content_id, status").eq("user_id", uid),
    sb.from("journey_submissions").select("step_no, status").eq("user_id", uid),
    sb.from("rookie_challenges").select("id, block").eq("is_active", true),
    sb.from("rookie_submissions").select("challenge_id, status").eq("user_id", uid),
    sb.from("thinking_skill_logs").select("skill, exp").eq("user_id", uid),
    sb.from("thinking_sessions").select("id", { count: "exact", head: true }).eq("user_id", uid),
    sb.from("experiments").select("result, reviewed_at, used_ai, fb_request_id").eq("user_id", uid),
    sb.from("sales").select("id", { count: "exact", head: true }).eq("user_id", uid),
    sb.from("submissions").select("created_at").eq("user_id", uid),
    sb.from("fb_requests").select("id", { count: "exact", head: true }).eq("user_id", uid),
    sb.from("fb_requests").select("issue_quest, responded_at").eq("responder_id", uid),
    sb.from("thanks").select("id", { count: "exact", head: true }).eq("from_user_id", uid),
    sb.from("thanks").select("id", { count: "exact", head: true }).eq("to_user_id", uid),
    sb.from("personal_tasks").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("is_done", true),
    sb.from("routine_checks").select("check_date").eq("user_id", uid),
    sb.from("recruit_progress").select("count, status").eq("user_id", uid).eq("action_type", "hire"),
    sb.from("skill_checks").select("node_id, status").eq("user_id", uid),
    sb.from("skill_claims").select("node_id, status").eq("user_id", uid),
  ]);

  const catOf: Record<string, string> = {};
  (contents.data ?? []).forEach((c: any) => { catOf[c.id] = c.category ?? ""; });
  const contentCat: Record<string, number> = {};
  const seen = new Set<string>();
  (comps.data ?? []).forEach((c: any) => {
    if (!APPROVED.has(String(c.status)) || seen.has(c.content_id)) return;
    seen.add(c.content_id);
    const cat = catOf[c.content_id]; if (!cat) return;
    contentCat[cat] = (contentCat[cat] ?? 0) + 1;
  });

  let journeyMax = 0;
  (journey.data ?? []).forEach((j: any) => { if (APPROVED.has(String(j.status))) journeyMax = Math.max(journeyMax, j.step_no ?? 0); });

  const rookieByBlock: Record<string, string[]> = {};
  (rookieCh.data ?? []).forEach((c: any) => { (rookieByBlock[c.block] ??= []).push(c.id); });
  const rookieApproved = new Set<string>();
  (rookieSub.data ?? []).forEach((s: any) => { if (APPROVED.has(String(s.status))) rookieApproved.add(s.challenge_id); });

  const skillLogCount: Record<string, number> = {}; const skillExp: Record<string, number> = {};
  (logs.data ?? []).forEach((l: any) => { skillLogCount[l.skill] = (skillLogCount[l.skill] ?? 0) + 1; skillExp[l.skill] = (skillExp[l.skill] ?? 0) + (l.exp ?? 0); });

  const exp = { created: 0, reviewed: 0, good: 0, ai: 0, aiGood: 0, fromFb: 0 };
  (exps.data ?? []).forEach((e: any) => {
    exp.created++;
    const reviewed = !!e.reviewed_at || !!e.result; if (reviewed) exp.reviewed++;
    const good = GOOD_RESULTS.has(String(e.result)); if (good) exp.good++;
    if (e.used_ai) { exp.ai++; if (good) exp.aiGood++; }
    if (e.fb_request_id) exp.fromFb++;
  });

  const days = new Set<string>();
  (subs.data ?? []).forEach((s: any) => days.add(String(s.created_at).slice(0, 10)));

  let fbResponded = 0, questsIssued = 0;
  (fbRes.data ?? []).forEach((r: any) => { if (r.responded_at) fbResponded++; if (r.issue_quest) questsIssued++; });

  // ルーティン：日付の最長連続
  const dates = Array.from(new Set((rchecks.data ?? []).map((r: any) => String(r.check_date).slice(0, 10)))).sort();
  let routineStreak = 0, run = 0, prev: number | null = null;
  for (const d of dates) {
    const t = new Date(d + "T00:00:00Z").getTime() / 86400000;
    run = prev !== null && t - prev === 1 ? run + 1 : 1; prev = t; routineStreak = Math.max(routineStreak, run);
  }

  let referralHire = 0;
  (recruit.data ?? []).forEach((r: any) => { if (String(r.status) !== "rejected") referralHire += r.count ?? 1; });

  const checksSet = new Set<string>(), pending = new Set<string>(), claimsSet = new Set<string>();
  (checks.data ?? []).forEach((c: any) => { if (c.status === "approved") checksSet.add(c.node_id); else if (c.status === "pending") pending.add(c.node_id); });
  (claims.data ?? []).forEach((c: any) => { if (c.status === "approved") claimsSet.add(c.node_id); else if (c.status === "pending") pending.add(c.node_id); });

  return {
    profile: prof.data ?? null, scriptTest: st.data ?? null, contentCat, journeyMax, rookieApproved, rookieByBlock,
    skillLogCount, skillExp, thinkingSessions: sessions.count ?? 0, exp, sales: sales.count ?? 0,
    reportDays: days.size, fbRequested: fbReq.count ?? 0, fbResponded, questsIssued,
    thanksSent: thSent.count ?? 0, thanksReceived: thRecv.count ?? 0, personalDone: ptasks.count ?? 0,
    routineStreak, referralHire, checks: checksSet, claims: claimsSet, pendingChecks: pending,
  };
}

function evalOne(m: Metrics, nodeId: string, type: string, param: string | null, threshold: number): number {
  const p = param ?? "";
  switch (type) {
    case "content_category": return m.contentCat[p] ?? 0;
    case "test_flag": return m.profile?.[p] ? 1 : 0;
    case "script_test": return m.scriptTest?.[p] ? 1 : 0;
    case "journey_step": return m.journeyMax;
    case "rookie_block": {
      const blocks = Object.keys(m.rookieByBlock).filter((b) => b.includes(p));
      const ids = blocks.flatMap((b) => m.rookieByBlock[b]);
      if (ids.length === 0) return 0;
      return ids.every((id) => m.rookieApproved.has(id)) ? 1 : 0;
    }
    case "skill_log_count": return m.skillLogCount[p] ?? 0;
    case "skill_exp": return m.skillExp[p] ?? 0;
    case "thinking_sessions": return m.thinkingSessions;
    case "experiments_created": return m.exp.created;
    case "experiments_reviewed": return m.exp.reviewed;
    case "experiments_good": return m.exp.good;
    case "experiments_ai": return m.exp.ai;
    case "experiments_ai_good": return m.exp.aiGood;
    case "experiments_from_fb": return m.exp.fromFb;
    case "sales_count": return m.sales;
    case "report_days": return m.reportDays;
    case "fb_requested": return m.fbRequested;
    case "fb_responded": return m.fbResponded;
    case "quests_issued": return m.questsIssued;
    case "thanks_sent": return m.thanksSent;
    case "thanks_received": return m.thanksReceived;
    case "profile_filled": {
      const pr = m.profile ?? {};
      return pr.mbti && (pr.club || pr.club_category) && pr.hobby_category ? 1 : 0;
    }
    case "personal_tasks_done": return m.personalDone;
    case "routine_streak": return m.routineStreak;
    case "license": {
      const lic = (m.profile?.licenses ?? {}) as Record<string, boolean>;
      return p.split("|").some((k) => lic[k]) ? 1 : 0;
    }
    case "referral_hire": return m.referralHire;
    case "mentor_check": return m.checks.has(nodeId) ? 1 : 0;
    case "claim_approved": return m.claims.has(nodeId) ? 1 : 0;
    case "any_of": {
      // "script_test:test1_passed|test_flag:sales_passed"
      return p.split("|").some((s) => { const [t, q] = s.split(":"); return evalOne(m, nodeId, t, q ?? null, 1) >= 1; }) ? 1 : 0;
    }
    default: return 0;
  }
}

export async function evaluateUser(sb: SupabaseClient, uid: string): Promise<EvalResult> {
  const [nodesQ, condsQ, jobsQ, ownedQ, ownedJobsQ, m] = await Promise.all([
    sb.from("skill_nodes").select("*").eq("is_active", true).order("category").order("order_no"),
    sb.from("skill_conditions").select("*").order("order_no"),
    sb.from("jobs").select("*").order("order_no"),
    sb.from("user_skills").select("node_id, unlocked_at").eq("user_id", uid),
    sb.from("user_jobs").select("job_id, unlocked_at").eq("user_id", uid),
    loadMetrics(sb, uid),
  ]);
  const nodes = (nodesQ.data ?? []) as SkillNode[];
  const conds = (condsQ.data ?? []) as SkillCondition[];
  const owned = new Map<string, string>();
  (ownedQ.data ?? []).forEach((o: any) => owned.set(o.node_id, o.unlocked_at));
  const ownedJobs = new Map<string, string>();
  (ownedJobsQ.data ?? []).forEach((o: any) => ownedJobs.set(o.job_id, o.unlocked_at));

  const states: NodeState[] = nodes.map((n) => {
    const cs: CondState[] = conds.filter((c) => c.node_id === n.id).map((c) => {
      const current = evalOne(m, n.id, c.type, c.param, c.threshold);
      return { ...c, current, done: current >= c.threshold };
    });
    const allDone = cs.length > 0 && cs.every((c) => c.done);
    const prereqOk = (n.requires ?? []).every((r) => owned.has(r));
    const unlocked = owned.has(n.id) || (prereqOk && allDone);
    const progress = cs.length ? cs.reduce((a, c) => a + Math.min(1, c.current / Math.max(1, c.threshold)), 0) / cs.length : 0;
    return {
      ...n, conds: cs, allDone, progress,
      status: unlocked ? "unlocked" : prereqOk ? "available" : "locked",
      unlocked_at: owned.get(n.id) ?? null,
      pendingCheck: m.pendingChecks.has(n.id),
    };
  });

  const countsByCat: Record<string, number> = {}; const levels: Record<string, number> = {};
  CATEGORIES.forEach((c) => { countsByCat[c.key] = states.filter((s) => s.category === c.key && s.status === "unlocked").length; levels[c.key] = levelFromCount(countsByCat[c.key]); });

  const unlockedIds = new Set(states.filter((s) => s.status === "unlocked").map((s) => s.id));
  const jobs: JobState[] = ((jobsQ.data ?? []) as Job[]).map((j) => {
    const missing = (j.requires ?? []).filter((r) => !unlockedIds.has(r));
    const unlocked = ownedJobs.has(j.id) || (j.is_obtainable && missing.length === 0);
    return { ...j, unlocked, unlocked_at: ownedJobs.get(j.id) ?? null, missing };
  });

  return { nodes: states, jobs, levels, countsByCat };
}

/** 新規解放を user_skills / user_jobs に書き込み、今回新しく解放されたものを返す（演出用） */
export async function syncUnlocks(sb: SupabaseClient, uid: string, r: EvalResult) {
  const newNodes = r.nodes.filter((n) => n.status === "unlocked" && !n.unlocked_at);
  const newJobs = r.jobs.filter((j) => j.unlocked && !j.unlocked_at);
  if (newNodes.length) await sb.from("user_skills").upsert(newNodes.map((n) => ({ user_id: uid, node_id: n.id })), { onConflict: "user_id,node_id" });
  if (newJobs.length) await sb.from("user_jobs").upsert(newJobs.map((j) => ({ user_id: uid, job_id: j.id })), { onConflict: "user_id,job_id" });
  return { newNodes, newJobs };
}

/** メンター認定を申請（pending があれば何もしない） */
export async function requestCheck(sb: SupabaseClient, uid: string, nodeId: string) {
  const { data } = await sb.from("skill_checks").select("id").eq("user_id", uid).eq("node_id", nodeId).eq("status", "pending").maybeSingle();
  if (data) return false;
  await sb.from("skill_checks").insert({ user_id: uid, node_id: nodeId });
  return true;
}

// ====================== Phase 2-2: CHALLENGING / CURRENT QUEST ======================
export type Focus = { current: string | null; subs: string[] };

export async function getFocus(sb: SupabaseClient, uid: string): Promise<Focus> {
  const { data } = await sb.from("user_skill_focus").select("node_id, priority").eq("user_id", uid).order("priority");
  const ids = (data ?? []).map((r: any) => r.node_id as string);
  return { current: ids[0] ?? null, subs: ids.slice(1) };
}
/** add / remove / promote / clear（サーバー側で1,2,3に再採番） */
export async function focusOp(sb: SupabaseClient, action: "add" | "remove" | "promote" | "clear", nodeId?: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await sb.rpc("skill_focus_op", { p_node_id: nodeId ?? null, p_action: action });
  if (error) return { ok: false, error: error.message.includes("focus_full") ? "full" : error.message };
  return { ok: true };
}

const STAGE_ORDER: Record<string, number> = { learn: 0, practice: 1, prove: 2, check: 3 };
/** 次に行動すべき未達成条件を1件：LEARN→PRACTICE→PROVE→CHECK、同stage内は達成に近いもの */
export function pickQuestCond(n: NodeState): CondState | null {
  const undone = n.conds.filter((c) => !c.done);
  if (!undone.length) return null;
  undone.sort((a, b) => {
    const s = (STAGE_ORDER[a.stage] ?? 9) - (STAGE_ORDER[b.stage] ?? 9); if (s) return s;
    const ra = a.threshold > 0 ? Math.min(a.current, a.threshold) / a.threshold : 0, rb = b.threshold > 0 ? Math.min(b.current, b.threshold) / b.threshold : 0;
    if (rb !== ra) return rb - ra; return a.order_no - b.order_no;
  });
  return undone[0];
}
/** 条件→短いクエスト文 */
export function questText(c: CondState | null): string {
  if (!c) return "";
  const left = Math.max(0, c.threshold - Math.min(c.current, c.threshold));
  const p = c.param ?? "";
  switch (c.type) {
    case "report_days": return `あと日報${left}日！`;
    case "experiments_created": return `あと実験${left}回！`;
    case "experiments_reviewed": return `あと振り返り${left}回！`;
    case "experiments_good": return `実験で「良くなった」あと${left}回！`;
    case "experiments_ai": return `AIを使った実験あと${left}回！`;
    case "experiments_ai_good": return `AI実験で「良くなった」あと${left}回！`;
    case "experiments_from_fb": return "FBをもとに実験してみよう！";
    case "sales_count": return `あと獲得${left}件！`;
    case "personal_tasks_done": return `あと個人タスク${left}件！`;
    case "routine_streak": return `ルーティンあと${left}日！`;
    case "thanks_sent": return `サンキューあと${left}件送ろう！`;
    case "thanks_received": return `サンキューあと${left}件もらおう！`;
    case "fb_requested": return `FB依頼あと${left}回！`;
    case "fb_responded": return `FB返信あと${left}件！`;
    case "quests_issued": return `クエスト発行あと${left}件！`;
    case "content_category": return `${p}の学習あと${left}本！`;
    case "thinking_sessions": return `AI作戦会議あと${left}回！`;
    case "skill_log_count": return `${p === "cause" ? "原因分析" : p === "hypothesis" ? "仮説" : "振り返り"}あと${left}回！`;
    case "skill_exp": return `${p === "cause" ? "原因分析" : p === "hypothesis" ? "仮説思考" : p === "improve" ? "改善力" : "思考"}EXPあと${left}！`;
    case "test_flag": case "script_test": case "any_of": return `${c.label.replace(/に合格$/, "").replace(/合格.*$/, "")}をクリアしよう！`;
    case "journey_step": return `冒険マップSTEP${c.threshold}へ進もう！`;
    case "rookie_block": return `一人前「${p}」をクリアしよう！`;
    case "profile_filled": return "プロフィールを入力しよう！";
    case "license": return "営業免許を取ろう！";
    case "referral_hire": return `リファラル採用あと${left}人！`;
    case "mentor_check": return "メンター認定を申請しよう！";
    case "claim_approved": return "申告してみよう！";
    default: return c.threshold > 1 ? `${c.label} あと${left}！` : `${c.label}！`;
  }
}
/** 次の冒険候補（ルールベース、最大3） */
export function nextQuestCandidates(r: EvalResult, excludeIds: string[], justUnlockedId?: string): { node: NodeState; reason: string }[] {
  const out: { node: NodeState; reason: string }[] = [];
  const ex = new Set(excludeIds);
  const avail = r.nodes.filter((n) => n.status === "available" && !ex.has(n.id));
  const push = (n: NodeState | undefined, reason: string) => { if (n && !out.some((o) => o.node.id === n.id)) out.push({ node: n, reason }); };
  if (justUnlockedId) {
    const j = r.nodes.find((n) => n.id === justUnlockedId);
    if (j) push(avail.find((n) => n.category === j.category && n.order_no === j.order_no + 1), "今取ったスキルの次のステップ");
  }
  push([...avail].sort((a, b) => b.progress - a.progress)[0], "あと少しで解放できる");
  const nearJob = r.jobs.filter((j) => j.is_obtainable && !j.unlocked).sort((a, b) => a.missing.length - b.missing.length)[0];
  if (nearJob) push(avail.filter((n) => nearJob.missing.includes(n.id)).sort((a, b) => b.progress - a.progress)[0], `${nearJob.name}への最短ルート`);
  return out.slice(0, 3);
}
/** 一番近いJOB（目標JOB表示用） */
export function nearestJob(r: EvalResult): JobState | null {
  return r.jobs.filter((j) => j.is_obtainable && !j.unlocked).sort((a, b) => a.missing.length - b.missing.length)[0] ?? r.jobs.find((j) => j.unlocked) ?? null;
}

// ====================== Phase 2-3: RECOMMENDED（おすすめルート） ======================
export type Reco = { nodeId: string; reason: string; source: "ai" | "mentor"; by?: string; id?: string };

const CAT_JA: Record<string, string> = { sales: "営業力", comm: "コミュニケーション", think: "思考力", mgmt: "マネジメント", ai: "AIスキル" };
/** ルールベースのおすすめ（APIなし）。最大2件 */
export function ruleRecommendations(r: EvalResult, excludeIds: string[]): Reco[] {
  const ex = new Set(excludeIds);
  const avail = r.nodes.filter((n) => n.status === "available" && !ex.has(n.id));
  const out: Reco[] = [];
  const push = (n: NodeState | undefined, reason: string) => { if (n && !out.some((o) => o.nodeId === n.id)) out.push({ nodeId: n.id, reason, source: "ai" }); };
  const best = [...avail].sort((a, b) => b.progress - a.progress)[0];
  if (best && best.progress >= 0.5) push(best, "あと少しで解放できます");
  const job = r.jobs.filter((j) => j.is_obtainable && !j.unlocked).sort((a, b) => a.missing.length - b.missing.length)[0];
  if (job) push(avail.filter((n) => job.missing.includes(n.id)).sort((a, b) => b.progress - a.progress)[0], `${job.name}への最短ルートです`);
  const hotCat = Object.entries(r.countsByCat).sort((a, b) => b[1] - a[1])[0];
  if (hotCat && hotCat[1] > 0) push(avail.filter((n) => n.category === hotCat[0]).sort((a, b) => a.order_no - b.order_no)[0], `伸びている${CAT_JA[hotCat[0]] ?? hotCat[0]}の次のスキルです`);
  if (!out.length && best) push(best, "最初の一歩におすすめ");
  return out.slice(0, 2);
}
/** メンターからのおすすめ（取得済み・却下済みは除外） */
export async function getMentorRecommendations(sb: SupabaseClient, uid: string, r: EvalResult): Promise<Reco[]> {
  const { data } = await sb.from("skill_recommendations").select("id, node_id, reason, created_by").eq("user_id", uid).eq("dismissed", false).order("created_at", { ascending: false });
  const rows = (data ?? []).filter((x: any) => r.nodes.find((n) => n.id === x.node_id)?.status !== "unlocked");
  const ids = Array.from(new Set(rows.map((x: any) => x.created_by).filter(Boolean)));
  const names = new Map<string, string>();
  if (ids.length) { const { data: ps } = await sb.from("profiles").select("id, name").in("id", ids); (ps ?? []).forEach((p: any) => names.set(p.id, p.name)); }
  return rows.map((x: any) => ({ id: x.id, nodeId: x.node_id, reason: x.reason ?? "", source: "mentor" as const, by: names.get(x.created_by) ?? "メンター" }));
}
