"use client";
// 冒険マップ（入社〜営業配属の7STEP）の判定と申請カード。
// 旧 /journey ページの中身をそのまま切り出したもの：判定・保存先（journey_submissions）・営業ライセンス付与は一切変えていない。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const GATE_BLOCKS = ["①コミュ基礎", "②研修・同行"];

export type StepState = "done" | "now" | "lock";
export type Step = {
    no: number;
    displayNo?: number;
    key: string;
    img: string;
    title: string;
    desc: string;
    reward: number;
    unlock?: string[];
    musts?: { label: string; state: "ok" | "doing" | "wait" }[];
    ctaLabel?: string;
    ctaPath?: string;
};

export function useJourney() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [rookieDone, setRookieDone] = useState<Record<string, number>>({});
    const [rookieTotal, setRookieTotal] = useState<Record<string, number>>({});
    const [subs, setSubs] = useState<Record<number, { status: string; review: string; scheduled_date: string }>>({});
    const [userId, setUserId] = useState<string>("");
    const [salesLicensed, setSalesLicensed] = useState(false);
    const [passedTests, setPassedTests] = useState<Set<string>>(new Set());
    const [stepContents, setStepContents] = useState<Record<number, any[]>>({});
    const [doneContentIds, setDoneContentIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const [{ data: challenges }, { data: subs }, { data: jsubs }, { data: jcontents }, { data: ccomps }, { data: tattempts }, { data: prof }] = await Promise.all([
                supabase.from("rookie_challenges").select("id, block, title").eq("is_active", true),
                supabase.from("rookie_submissions").select("challenge_id, status").eq("user_id", user.id).eq("status", "approved"),
                supabase.from("journey_submissions").select("step_no, status, scheduled_date, review, mtg_attended, mtg_date, event_no_cancel, event_date").eq("user_id", user.id).in("step_no", [1, 2, 3, 4, 5, 7]),
                supabase.from("contents").select("id, title, journey_step").gt("journey_step", 0).eq("is_active", true),
                supabase.from("content_completions").select("content_id").eq("user_id", user.id),
                supabase.from("test_attempts").select("test_key, passed").eq("user_id", user.id).eq("passed", true),
                supabase.from("profiles").select("quiz_passed, licenses").eq("id", user.id).maybeSingle(),
            ]);
            const byStep: Record<number, any[]> = {};
            (jcontents || []).forEach((c: any) => { (byStep[c.journey_step] = byStep[c.journey_step] || []).push(c); });
            setStepContents(byStep);
            setSalesLicensed(!!((prof as any)?.licenses?.sales));
            setDoneContentIds(new Set((ccomps || []).map((c: any) => c.content_id)));
            const pt = new Set<string>((tattempts || []).map((t: any) => t.test_key));
            if ((prof as any)?.quiz_passed) pt.add("quiz");
            setPassedTests(pt);
            // ブロック別の全項目数
            const total: Record<string, number> = {};
            (challenges || []).forEach((c: any) => { if (c.title === "1面談を作れる") return; total[c.block] = (total[c.block] || 0) + 1; });
            // 承認済みのchallenge_id → block を引いて集計
            const idToBlock: Record<string, string> = {};
            (challenges || []).forEach((c: any) => { if (c.title === "1面談を作れる") return; idToBlock[c.id] = c.block; });
            const done: Record<string, number> = {};
            (subs || []).forEach((s: any) => {
                const b = idToBlock[s.challenge_id];
                if (b) done[b] = (done[b] || 0) + 1;
            });
            setRookieDone(done);
            setRookieTotal(total);
            const subMap: Record<number, any> = {};
            (jsubs || []).forEach((r: any) => { subMap[r.step_no] = { status: r.status || "none", review: r.review || "", scheduled_date: r.scheduled_date || "", mtg_attended: !!r.mtg_attended, mtg_date: r.mtg_date || "", event_no_cancel: !!r.event_no_cancel, event_date: r.event_date || "" }; });
            setSubs(subMap);
            setLoading(false);
        };
        load();
    }, [router]);

    // STEP3判定：①②が全項目達成でクリア
    const gateOk = GATE_BLOCKS.every(b => (rookieDone[b] || 0) >= (rookieTotal[b] || 0) && (rookieTotal[b] || 0) > 0);
    const b1ok = (rookieDone["①コミュ基礎"] || 0) >= (rookieTotal["①コミュ基礎"] || 0) && (rookieTotal["①コミュ基礎"] || 0) > 0;
    const b2ok = (rookieDone["②研修・同行"] || 0) >= (rookieTotal["②研修・同行"] || 0) && (rookieTotal["②研修・同行"] || 0) > 0;

    const steps: Step[] = [
        { no: 1, key: "village", img: "/island/house/sm/0_tent.png", title: "入社", desc: "入社日を登録しよう", reward: 10 },
        { no: 2, key: "hut", img: "/island/house/sm/1_cabin.png", title: "キックオフ研修", desc: "学習コンテンツを視聴して基礎を固める", reward: 10 },
        { no: 7, key: "rookie", img: "/island/house/sm/2_house.png", title: "一人前チャレンジ研修", desc: "確認ワーク・即レス・常識デリカシーのテストに合格しよう", reward: 15 },
        { no: 3, key: "crystal", img: "/island/house/sm/3_big.png", title: "プレイヤー昇格", desc: "全体MTG出席・研修/イベント当日キャンセルなしを提出", reward: 20 },
        { no: 4, key: "dm", img: "/island/house/sm/2_house.png", title: "DRMスタート", desc: "DRM研修に参加して申請", reward: 20, unlock: ["STEP3をクリア", "プレイヤー昇格の承認"] },
        { no: 5, key: "temple", img: "/island/house/sm/4_mansion.png", title: "キャリア面談・配属", desc: "キャリア面談を受けて申請しよう", reward: 20, unlock: ["STEP4をクリア", "DRM研修の承認"] },
        { no: 6, key: "castle", img: "/island/house/sm/5_castle.png", title: "営業配属", desc: "営業学習コンテンツ・デビューテスト・コミュ基礎でゴール！", reward: 30, unlock: ["STEP5をクリア"] },
    ];
    steps.forEach((st, i) => { st.displayNo = i + 1; });

    // ステップ状態を決める
    // そのSTEPのコンテンツを全部視聴済みか
    const contentDone = (no: number): boolean => {
        const list = stepContents[no] || [];
        if (list.length === 0) return true;
        return list.every((c: any) => doneContentIds.has(c.id));
    };
    // そのSTEPのテストを全部合格済みか（テストがあるのはSTEP2のみ）
    const STEP_TESTS: Record<number, string[]> = { 7: ["quiz", "quick_response", "common_sense"], 6: ["sales"] };
    const testsDone = (no: number): boolean => {
        const keys = STEP_TESTS[no] || [];
        return keys.every((k) => passedTests.has(k));
    };
    // 申請承認 + コンテンツ全消化 + テスト全合格 で完了
    const stepClear = (no: number): boolean => {
        return subs[no]?.status === "approved" && contentDone(no) && testsDone(no);
    };
    const stateOf = (no: number): StepState => {
        if (no === 1) return stepClear(1) ? "done" : "now"; // 入社：報告承認で完了
        if (no === 2) {
            if (stateOf(1) !== "done") return "lock";   // STEP1未完なら施錠
            return stepClear(2) ? "done" : "now"; // 登竜門：承認+コンテンツ+テスト
        }
        if (no === 7) {
            if (stateOf(2) !== "done") return "lock";   // STEP2(キックオフ)未完なら施錠
            return (contentDone(7) && testsDone(7)) ? "done" : "now"; // 一人前チャレンジ：テスト合格
        }
        if (no === 3) {
            if (stateOf(7) !== "done") return "lock";   // 一人前チャレンジ未完なら施錠
            return stepClear(3) ? "done" : "now"; // プレイヤー昇格：承認+コンテンツ
        }
        if (no === 4) {
            if (stateOf(3) !== "done") return "lock"; // STEP3未完なら施錠
            return stepClear(4) ? "done" : "now"; // DRM：承認+コンテンツ
        }
        if (no === 5) {
            if (stateOf(4) !== "done") return "lock";
            return stepClear(5) ? "done" : "now"; // 面談：承認+コンテンツ
        }
        if (no === 6) {
            if (stateOf(5) !== "done") return "lock";
            return (contentDone(6) && testsDone(6) && b1ok) ? "done" : "now"; // 営業配属：ゴール
        }
        return "lock";                                   // 5,6はまだ
    };

    const doneCount = steps.filter(s => stateOf(s.no) === "done").length;
    const pct = Math.round((doneCount / steps.length) * 100);
    const step6Done = stateOf(6) === "done";
    useEffect(() => {
        if (!userId || !step6Done || salesLicensed) return;
        (async () => {
            const { data: p } = await supabase.from("profiles").select("licenses").eq("id", userId).maybeSingle();
            const cur = ((p as any)?.licenses || {}) as Record<string, boolean>;
            if (cur.sales) { setSalesLicensed(true); return; }
            const next = { ...cur, sales: true };
            const { error } = await supabase.from("profiles").update({ licenses: next }).eq("id", userId);
            if (!error) setSalesLicensed(true);
        })();
    }, [userId, step6Done, salesLicensed]);
    const EMPTY = { status: "none", review: "", scheduled_date: "", mtg_attended: false, mtg_date: "", event_no_cancel: false, event_date: "" };
    const subOf = (no: number) => subs[no] || EMPTY;
    const saveSub = (no: number, st: any) => setSubs(prev => ({ ...prev, [no]: { ...(prev[no] || EMPTY), ...st } }));
    // 今いるSTEP（最初の「今ここ」。全部完了なら最後のSTEP）
    const currentNo = (steps.find(s => stateOf(s.no) === "now") || steps[steps.length - 1]).no;
    return { loading, userId, steps, stateOf, subOf, saveSub, stepContents, doneContentIds, passedTests, b1ok, doneCount, pct, currentNo };
}
export type Journey = ReturnType<typeof useJourney>;

/** STEPの詳細カード（申請・日付入力・コンテンツ・テスト）。冒険マップ単独ページ時代のものをそのまま使う */
export function StepCard({ step, state, onCta, sub, userId, onSaved, stepContents, doneContentIds, onOpenContent, passedTests, onGoTest, b1ok }: { step: Step; state: StepState; onCta: (path: string) => void; sub: { status: string; review: string; scheduled_date: string; mtg_attended?: boolean; mtg_date?: string; event_no_cancel?: boolean; event_date?: string }; userId: string; onSaved: (st: any) => void; stepContents: Record<number, any[]>; doneContentIds: Set<string>; onOpenContent: (id: string) => void; passedTests: Set<string>; onGoTest: (path: string) => void; b1ok: boolean }) {
    const isNow = state === "now";
    const isLock = state === "lock";
    const [reviewText, setReviewText] = useState("");
    const [sending, setSending] = useState(false);
    const isDone = state === "done";
    return (
        <div style={{ color: "#1e293b" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, paddingRight: 34 }}>
                <div style={{ width: 58, height: 58, borderRadius: 29, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isDone ? "#16a34a" : "#f1f5f9", border: "3px solid #16a34a", boxShadow: isDone ? "0 0 18px #16a34a88" : "none", overflow: "hidden" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={step.img} alt="" style={{ width: 44, height: 44, objectFit: "contain", filter: isLock ? "grayscale(1) opacity(.6)" : "none" }} />
                </div>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 19, fontWeight: 900 }}>{step.title}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#16a34a", letterSpacing: 1 }}>冒険マップ STEP {step.displayNo}<span style={{ marginLeft: 8, color: "#b45309" }}>💎 +{step.reward}pt</span></div>
                </div>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: "#334155", background: "#f5f3ff", borderRadius: 12, padding: "9px 12px", marginBottom: 12 }}>{step.desc}</div>
            {isDone && (
                <div style={{ background: "linear-gradient(135deg,#fef3c7,#fde68a)", borderRadius: 14, padding: 14, textAlign: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 26 }}>🎉</div>
                    <div style={{ fontWeight: 900, fontSize: 15 }}>STEP CLEAR</div>
                </div>
            )}
            {isNow && <div style={{ textAlign: "center", background: "#dcfce7", borderRadius: 12, padding: "8px 10px", fontWeight: 900, color: "#166534", fontSize: 13, marginBottom: 12 }}>📍 今ここ</div>}
            {isLock && !step.unlock && <div style={{ fontSize: 12.5, color: "#b45309", background: "#fef3c7", borderRadius: 10, padding: "8px 12px", marginBottom: 12 }}>🔒 前のSTEPをクリアするとここに来られます</div>}

            {/* 必修チップ（STEP3など） */}
            {step.musts && !isLock && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                    {step.musts.map((m, i) => (
                        <span key={i} style={{
                            fontSize: 11.5, fontWeight: 700, padding: "6px 12px", borderRadius: 8,
                            background: m.state === "ok" ? "#dcfce7" : "#fff",
                            border: `1px solid ${m.state === "ok" ? "#86efac" : "#e2e8f0"}`,
                            color: m.state === "ok" ? "#16a34a" : "#64748b",
                        }}>{m.state === "ok" ? "✓ " : "▶ "}{m.label}</span>
                    ))}
                </div>
            )}

            {/* 解放条件（施錠ステップ） */}
            {isLock && step.unlock && (
                <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 12, background: "#fef3c7", border: "1px solid #fde68a" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", marginBottom: 8 }}>🔓 解放条件</div>
                    {step.unlock.map((u, i) => (
                        <div key={i} style={{ fontSize: 12, color: "#b45309", marginBottom: 4 }}>・{u}</div>
                    ))}
                </div>
            )}

            {/* CTA（今ここのステップだけ） */}
            {isNow && step.no === 3 && sub.status !== "approved" && (
                sub.status === "pending" ? (
                    <div style={{ marginTop: 18, padding: "13px 16px", borderRadius: 12, textAlign: "center", background: "#fef3c7", color: "#b45309", fontSize: 14, fontWeight: 800, border: "1px solid #cbd5e1" }}>
                        ⏳ 提出済み（承認待ち）
                    </div>
                ) : (
                    <Step3Form userId={userId} sub={sub} onSaved={onSaved} />
                )
            )}
            {(step.no === 1 || step.no === 2 || step.no === 4 || step.no === 5 || step.no === 7) && (state === "now" || state === "done") && (
                <div style={{ marginTop: 18, padding: "13px 16px", borderRadius: 14, background: "#f5f3ff", border: "1px solid #e9e5ff", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#64748b", whiteSpace: "nowrap" }}>📅 {step.no === 1 ? "入社日" : step.no === 4 ? "DRM研修参加日" : step.no === 5 ? "キャリア面談日" : step.no === 7 ? "一人前チャレンジ研修日" : "キックオフ研修日"}</span>
                    <input type="date" value={sub.scheduled_date} onChange={async (e) => {
                        const d = e.target.value;
                        onSaved({ scheduled_date: d });
                        if (!userId) return;
                        const { data: upd } = await supabase.from("journey_submissions").update({ scheduled_date: d || null }).eq("user_id", userId).eq("step_no", step.no).select();
                        if (!upd || upd.length === 0) {
                            await supabase.from("journey_submissions").insert({ user_id: userId, step_no: step.no, scheduled_date: d || null, status: "none" });
                        }
                    }} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#1e293b", fontSize: 16 }} />
                </div>
            )}
            {isNow && (step.no === 4 || step.no === 5) && sub.status !== "approved" && (
                sub.status === "pending" ? (
                    <div style={{ marginTop: 18, padding: "13px 16px", borderRadius: 12, textAlign: "center", background: "#fef3c7", color: "#b45309", fontSize: 14, fontWeight: 800, border: "1px solid #cbd5e1" }}>
                        ⏳ 申請中（承認待ち）
                    </div>
                ) : (
                    <button disabled={!sub.scheduled_date} onClick={async () => {
                        if (!userId || !sub.scheduled_date) return;
                        const { data: upd } = await supabase.from("journey_submissions").update({ status: "pending" }).eq("user_id", userId).eq("step_no", step.no).select();
                        if (!upd || upd.length === 0) { await supabase.from("journey_submissions").insert({ user_id: userId, step_no: step.no, status: "pending", scheduled_date: sub.scheduled_date }); }
                        onSaved({ status: "pending" });
                    }} style={{ width: "100%", marginTop: 14, padding: "15px", borderRadius: 999, border: "none", cursor: sub.scheduled_date ? "pointer" : "not-allowed", opacity: sub.scheduled_date ? 1 : 0.5, background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", fontSize: 15, fontWeight: 900, boxShadow: "0 6px 22px rgba(22,163,74,.35)", letterSpacing: 1 }}>
                        {step.no === 4 ? "📨 DRM研修に参加した" : "🎤 面談を受けた"}
                    </button>
                )
            )}
            {step.no === 5 && !isLock && (
                <button onClick={() => onGoTest("/thanks")} style={{ width: "100%", marginTop: 12, padding: "13px", borderRadius: 999, border: "1px solid #fde68a", cursor: "pointer", background: "#fffbeb", color: "#b45309", fontSize: 14, fontWeight: 800 }}>
                    💌 サンキューを送る
                </button>
            )}
            {step.no === 6 && state === "done" && (
                <div style={{ marginTop: 18, padding: "22px 20px", borderRadius: 16, background: "linear-gradient(135deg,#fef3c7,#fde68a)", border: "1px solid #fde68a", textAlign: "center" }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>🎉</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#b45309", marginBottom: 10 }}>営業デビュー、おめでとう！</div>
                    <div style={{ fontSize: 13.5, color: "#1e293b", lineHeight: 1.8 }}>ここからが本番。学んだことを現場でフルに使って、自分だけの実績を積み上げよう。<br />営業で数字と行動を積めば、それがそのまま語れるガクチカ（=あなたの武器）になる。🔥</div>
                </div>
            )}
            {step.no === 6 && !isLock && state !== "done" && (
                <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 10, letterSpacing: 1 }}>🏆 ゴール条件</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div onClick={() => onGoTest("/tests/sales")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, cursor: "pointer", background: passedTests.has("sales") ? "#dcfce7" : "#fff", border: passedTests.has("sales") ? "1px solid #86efac" : "1px solid #e2e8f0" }}>
                            <span style={{ fontSize: 15 }}>{passedTests.has("sales") ? "✓" : "○"}</span>
                            <span style={{ fontSize: 13, color: passedTests.has("sales") ? "#166534" : "#1e293b", fontWeight: 600, flex: 1 }}>営業デビューテストに合格</span>
                            <span style={{ fontSize: 12, color: "#16a34a" }}>{passedTests.has("sales") ? "合格済" : "受ける"} ›</span>
                        </div>
                        <div onClick={() => onGoTest("/rookie")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, cursor: "pointer", background: b1ok ? "#dcfce7" : "#fff", border: b1ok ? "1px solid #86efac" : "1px solid #e2e8f0" }}>
                            <span style={{ fontSize: 15 }}>{b1ok ? "✓" : "○"}</span>
                            <span style={{ fontSize: 13, color: b1ok ? "#166534" : "#1e293b", fontWeight: 600, flex: 1 }}>一人前チャレンジ コミュ基礎を制覇</span>
                            <span style={{ fontSize: 12, color: "#16a34a" }}>{b1ok ? "達成" : "進める"} ›</span>
                        </div>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>※ 上のコンテンツ・テスト・コミュ基礎をすべて達成するとゴール！</div>
                </div>
            )}
            {!isLock && (stepContents[step.no] || []).length > 0 && (
                <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 10, letterSpacing: 1 }}>📚 このフェーズで見る</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(stepContents[step.no] || []).map((c: any) => {
                            const done = doneContentIds.has(c.id);
                            return (
                                <div key={c.id} onClick={() => onOpenContent(c.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, cursor: "pointer", background: done ? "#dcfce7" : "#fff", border: done ? "1px solid #86efac" : "1px solid #e2e8f0" }}>
                                    <span style={{ fontSize: 15, flexShrink: 0 }}>{done ? "✓" : "○"}</span>
                                    <span style={{ fontSize: 13, color: done ? "#166534" : "#1e293b", fontWeight: 600, lineHeight: 1.4, flex: 1 }}>{c.title}</span>
                                    <span style={{ fontSize: 12, color: "#16a34a", flexShrink: 0 }}>見る ›</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {step.no === 7 && (state === "now" || state === "done") && (
                <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 10, letterSpacing: 1 }}>📝 このフェーズで受けるテスト</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[{ label: "確認ワークテスト", path: "/quiz", key: "quiz" }, { label: "即レス", path: "/tests/quick-response", key: "quick_response" }, { label: "常識・デリカシーテスト", path: "/tests/common-sense", key: "common_sense" }].map((t) => {
                            const passed = passedTests.has(t.key);
                            return (
                                <div key={t.key} onClick={() => onGoTest(t.path)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, cursor: "pointer", background: passed ? "#dcfce7" : "#fff", border: passed ? "1px solid #86efac" : "1px solid #e2e8f0" }}>
                                    <span style={{ fontSize: 15, flexShrink: 0 }}>{passed ? "✓" : "○"}</span>
                                    <span style={{ fontSize: 13, color: passed ? "#166534" : "#1e293b", fontWeight: 600, lineHeight: 1.4, flex: 1 }}>{t.label}</span>
                                    <span style={{ fontSize: 12, color: "#16a34a", flexShrink: 0 }}>{passed ? "合格済" : "受ける"} ›</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {isNow && (step.no === 1 || step.no === 2) && sub.status !== "approved" && (
                sub.status === "pending" ? (
                    <div style={{ marginTop: 18 }}>
                        <div style={{ padding: "13px 16px", borderRadius: 12, textAlign: "center", background: "#fef3c7", color: "#b45309", fontSize: 14, fontWeight: 800, border: "1px solid #cbd5e1" }}>
                            ⏳ 報告を送信済み（承認待ち）
                        </div>
                        {sub.review && (
                            <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 13, color: "#334155", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{sub.review}</div>
                        )}
                    </div>
                ) : (
                    <div style={{ marginTop: 18 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#64748b", marginBottom: 8 }}>{step.no === 1 ? "入社・研修の感想" : "キックオフの感想"}を書いて送信（必須）</div>
                        <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="学んだこと・目標などを書こう" rows={4} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #cbd5e1", background: "#fff", color: "#1e293b", fontSize: 16, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                        <button disabled={sending || !reviewText.trim()} onClick={async () => {
                            if (!userId || !reviewText.trim()) return;
                            setSending(true);
                            const { error } = await supabase.from("journey_submissions").upsert({ user_id: userId, step_no: step.no, status: "pending", review: reviewText.trim() }, { onConflict: "user_id,step_no" });
                            setSending(false);
                            if (error) { alert("送信に失敗しました: " + error.message); return; }
                            onSaved({ status: "pending", review: reviewText.trim() });
                        }} style={{ width: "100%", marginTop: 12, padding: "15px", borderRadius: 999, border: "none", cursor: (sending || !reviewText.trim()) ? "not-allowed" : "pointer", opacity: (sending || !reviewText.trim()) ? 0.5 : 1, background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", fontSize: 15, fontWeight: 900, boxShadow: "0 6px 22px rgba(22,163,74,.35)", letterSpacing: 1 }}>
                            ⛩️ 報告を送信
                        </button>
                    </div>
                )
            )}
            {isNow && step.ctaLabel && step.ctaPath && (
                <button onClick={() => onCta(step.ctaPath!)} style={{ width: "100%", marginTop: 18, padding: "15px", borderRadius: 999, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", fontSize: 15, fontWeight: 900, boxShadow: "0 6px 22px rgba(22,163,74,.35)", letterSpacing: 1 }}>
                    ▶ {step.ctaLabel}
                </button>
            )}
        </div>
    );
}


function Step3Form({ userId, sub, onSaved }: { userId: string; sub: any; onSaved: (st: any) => void }) {
    const [mtg, setMtg] = useState<boolean>(!!sub.mtg_attended);
    const [mtgDate, setMtgDate] = useState<string>(sub.mtg_date || "");
    const [evt, setEvt] = useState<boolean>(!!sub.event_no_cancel);
    const [evtDate, setEvtDate] = useState<string>(sub.event_date || "");
    const [sending, setSending] = useState(false);
    const ready = mtg && mtgDate && evt && evtDate;
    const rowStyle = (on: boolean): any => ({ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, cursor: "pointer", background: on ? "#dcfce7" : "#fff", border: on ? "1px solid #86efac" : "1px solid #e2e8f0", marginBottom: 8 });
    const dateStyle: any = { width: "100%", marginTop: 6, marginBottom: 8, padding: "9px 11px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#1e293b", fontSize: 16 };
    return (
        <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#64748b", marginBottom: 10 }}>完了したらチェックして日付を入力・提出（必須）</div>
            <div onClick={() => setMtg(!mtg)} style={rowStyle(mtg)}>
                <span style={{ fontSize: 16 }}>{mtg ? "✓" : "○"}</span>
                <span style={{ fontSize: 13.5, color: "#1e293b", fontWeight: 700 }}>全体MTGに出席</span>
            </div>
            <input type="date" value={mtgDate} onClick={(e) => e.stopPropagation()} onChange={(e) => setMtgDate(e.target.value)} style={dateStyle} />
            <div onClick={() => setEvt(!evt)} style={rowStyle(evt)}>
                <span style={{ fontSize: 16 }}>{evt ? "✓" : "○"}</span>
                <span style={{ fontSize: 13.5, color: "#1e293b", fontWeight: 700 }}>研修・イベント当日キャンセルなし</span>
            </div>
            <input type="date" value={evtDate} onChange={(e) => setEvtDate(e.target.value)} style={dateStyle} />
            <button disabled={sending || !ready} onClick={async () => {
                if (!userId || !ready) return;
                setSending(true);
                const payload = { user_id: userId, step_no: 3, status: "pending", mtg_attended: mtg, mtg_date: mtgDate || null, event_no_cancel: evt, event_date: evtDate || null };
                const { data: upd } = await supabase.from("journey_submissions").update(payload).eq("user_id", userId).eq("step_no", 3).select();
                if (!upd || upd.length === 0) { await supabase.from("journey_submissions").insert(payload); }
                setSending(false);
                onSaved({ status: "pending", mtg_attended: mtg, mtg_date: mtgDate, event_no_cancel: evt, event_date: evtDate });
            }} style={{ width: "100%", marginTop: 6, padding: "15px", borderRadius: 999, border: "none", cursor: (sending || !ready) ? "not-allowed" : "pointer", opacity: (sending || !ready) ? 0.5 : 1, background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", fontSize: 15, fontWeight: 900, boxShadow: "0 6px 22px rgba(22,163,74,.35)", letterSpacing: 1 }}>
                📋 提出する
            </button>
        </div>
    );
}
