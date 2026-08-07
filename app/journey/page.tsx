"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const GATE_BLOCKS = ["①コミュ基礎", "②研修・同行"];

type StepState = "done" | "now" | "lock";
type Step = {
    no: number;
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

export default function JourneyPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [rookieDone, setRookieDone] = useState<Record<string, number>>({});
    const [rookieTotal, setRookieTotal] = useState<Record<string, number>>({});
    const [subs, setSubs] = useState<Record<number, { status: string; review: string; scheduled_date: string }>>({});
    const [userId, setUserId] = useState<string>("");
    const [passedTests, setPassedTests] = useState<Set<string>>(new Set());
    const [stepContents, setStepContents] = useState<Record<number, any[]>>({});
    const [doneContentIds, setDoneContentIds] = useState<Set<string>>(new Set());
    const [selectedNo, setSelectedNo] = useState(3);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const [{ data: challenges }, { data: subs }, { data: jsubs }, { data: jcontents }, { data: ccomps }, { data: tattempts }, { data: prof }] = await Promise.all([
                supabase.from("rookie_challenges").select("id, block").eq("is_active", true),
                supabase.from("rookie_submissions").select("challenge_id, status").eq("user_id", user.id).eq("status", "approved"),
                supabase.from("journey_submissions").select("step_no, status, scheduled_date, review, mtg_attended, mtg_date, event_no_cancel, event_date").eq("user_id", user.id).in("step_no", [1, 2, 3, 4, 5]),
                supabase.from("contents").select("id, title, journey_step").gt("journey_step", 0).eq("is_active", true),
                supabase.from("content_completions").select("content_id").eq("user_id", user.id),
                supabase.from("test_attempts").select("test_key, passed").eq("user_id", user.id).eq("passed", true),
                supabase.from("profiles").select("quiz_passed").eq("id", user.id).maybeSingle(),
            ]);
            const byStep: Record<number, any[]> = {};
            (jcontents || []).forEach((c: any) => { (byStep[c.journey_step] = byStep[c.journey_step] || []).push(c); });
            setStepContents(byStep);
            setDoneContentIds(new Set((ccomps || []).map((c: any) => c.content_id)));
            const pt = new Set<string>((tattempts || []).map((t: any) => t.test_key));
            if ((prof as any)?.quiz_passed) pt.add("quiz");
            setPassedTests(pt);
            // ブロック別の全項目数
            const total: Record<string, number> = {};
            (challenges || []).forEach((c: any) => { total[c.block] = (total[c.block] || 0) + 1; });
            // 承認済みのchallenge_id → block を引いて集計
            const idToBlock: Record<string, string> = {};
            (challenges || []).forEach((c: any) => { idToBlock[c.id] = c.block; });
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
        { no: 1, key: "village", img: "/journey/step1_village.png", title: "入社・スラック研修", desc: "アカウント登録・アバター設定・MY GOALS宣言", reward: 10 },
        { no: 2, key: "hut", img: "/journey/step2_hut.png", title: "登竜門キックオフ研修", desc: "学習コンテンツを視聴して基礎を固める", reward: 10 },
        { no: 3, key: "crystal", img: "/journey/step3_crystal.png", title: "プレイヤー昇格", desc: "全体MTG出席・研修/イベント当日キャンセルなしを提出", reward: 20 },
        { no: 4, key: "dm", img: "/journey/step4_dm.png", title: "DRMスタート", desc: "DRM研修に参加して申請", reward: 20, unlock: ["STEP3をクリア", "プレイヤー昇格の承認"] },
        { no: 5, key: "temple", img: "/journey/step5_temple.png", title: "キャリア面談・配属", desc: "キャリア面談を受けて申請しよう", reward: 20, unlock: ["STEP4をクリア", "DRM研修の承認"] },
        { no: 6, key: "castle", img: "/journey/step6_castle.png", title: "営業配属", desc: "営業学習コンテンツ・デビューテスト・コミュ基礎でゴール！", reward: 30, unlock: ["STEP5をクリア"] },
    ];

    // ステップ状態を決める
    // そのSTEPのコンテンツを全部視聴済みか
    const contentDone = (no: number): boolean => {
        const list = stepContents[no] || [];
        if (list.length === 0) return true;
        return list.every((c: any) => doneContentIds.has(c.id));
    };
    // そのSTEPのテストを全部合格済みか（テストがあるのはSTEP2のみ）
    const STEP_TESTS: Record<number, string[]> = { 2: ["quiz", "quick_response", "common_sense"], 6: ["sales"] };
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
        if (no === 3) {
            if (stateOf(2) !== "done") return "lock";   // STEP2未完なら施錠
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
    const selected = steps.find(s => s.no === selectedNo) || steps[2];
    const selState = stateOf(selected.no);

    if (loading) return (
        <main style={{ minHeight: "100vh", background: "#0b0b14", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "#a78bfa", fontSize: 18, fontWeight: 700 }}>Loading...</div>
        </main>
    );

    return (
        <main style={{ minHeight: "100vh", background: "#0b0b14", padding: "36px 20px 64px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 30% 10%, rgba(139,92,246,0.12) 0%, transparent 55%)", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto" }}>

                {/* ヘッダー */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 22 }}>
                    <div>
                        <div onClick={() => router.push("/home")} style={{ fontSize: 12, color: "#a78bfa", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer" }}>INTERN QUEST</div>
                        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#f9fafb", margin: "4px 0 0" }}>🗺️ あなたの冒険マップ</h1>
                        <p style={{ fontSize: 13, color: "#9ca3af", margin: "8px 0 0" }}>営業デビューまでの道のり。今いる場所と、次にやることが一目で分かる</p>
                    </div>
                    {/* 全体進捗 */}
                    <div style={{ minWidth: 260, background: "linear-gradient(140deg, rgba(58,31,110,.6), rgba(15,11,40,.7))", border: "1px solid rgba(167,139,250,.4)", borderRadius: 18, padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13 }}>⭐</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: "#c2b8ee" }}>全体の進捗</span>
                            <span style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginLeft: "auto" }}>{pct}%</span>
                        </div>
                        <div style={{ height: 9, borderRadius: 999, background: "rgba(255,255,255,.1)", marginTop: 10, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#a78bfa,#7c5cf0)", borderRadius: 999 }} />
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>6ステップ中 {doneCount}つ完了{subs[3]?.status !== "approved" && "・今はSTEP3に挑戦中！"}</div>
                    </div>
                </div>

                {/* 本体：左マップ + 右詳細 */}
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>

                    {/* 左：島の縦マップ */}
                    <div style={{ flex: "0 0 auto", width: 150, position: "relative", margin: "0 auto" }}>
                        {steps.map((s, i) => {
                            const st = stateOf(s.no);
                            const isSel = selectedNo === s.no;
                            return (
                                <div key={s.no} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", marginBottom: i < steps.length - 1 ? 4 : 0 }}>
                                    {/* 道（次の島へ） */}
                                    {i < steps.length - 1 && (
                                        <div style={{ position: "absolute", top: 100, left: "50%", width: 4, height: 44, background: st === "done" ? "linear-gradient(#34d399,#34d39955)" : "rgba(255,255,255,.1)", transform: "translateX(-50%)", zIndex: 0 }} />
                                    )}
                                    {/* 島 */}
                                    <div onClick={() => setSelectedNo(s.no)} style={{ cursor: "pointer", position: "relative", zIndex: 1, textAlign: "center" }}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={s.img} alt={s.title} style={{
                                            width: s.no === 3 ? 128 : 108, height: s.no === 3 ? 128 : 108, objectFit: "contain",
                                            filter: st === "lock" ? "grayscale(.7) brightness(.55)" : "none",
                                            transform: isSel ? "scale(1.08)" : "scale(1)", transition: "transform .15s",
                                        }} />
                                        {/* 番号バッジ */}
                                        <div style={{ position: "absolute", top: 4, left: 4, width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff", background: st === "done" ? "linear-gradient(135deg,#34d399,#10b981)" : st === "now" ? "linear-gradient(135deg,#a78bfa,#7c5cf0)" : "rgba(40,40,60,.9)", border: isSel ? "2px solid #fff" : "2px solid rgba(0,0,0,.3)" }}>
                                            {st === "done" ? "✓" : st === "lock" ? "🔒" : s.no}
                                        </div>
                                        {/* 状態ラベル */}
                                        <div style={{ fontSize: 10, fontWeight: 800, marginTop: -6, color: st === "done" ? "#34d399" : st === "now" ? "#a78bfa" : "#6b7280" }}>
                                            {st === "done" ? "完了" : st === "now" ? "今ここ" : "未解放"}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 右：選択中ステップの詳細 */}
                    <div style={{ flex: "1 1 400px", minWidth: 300 }}>
                        <StepCard step={selected} state={selState} onCta={(path) => router.push(path)} sub={subs[selected.no] || { status: "none", review: "", scheduled_date: "", mtg_attended: false, mtg_date: "", event_no_cancel: false, event_date: "" }} userId={userId} onSaved={(st) => setSubs(prev => ({ ...prev, [selected.no]: { ...(prev[selected.no] || { status: "none", review: "", scheduled_date: "", mtg_attended: false, mtg_date: "", event_no_cancel: false, event_date: "" }), ...st } }))} stepContents={stepContents} doneContentIds={doneContentIds} onOpenContent={(id) => router.push("/learn?open=" + id)} passedTests={passedTests} onGoTest={(p) => router.push(p)} b1ok={b1ok} />

                        {/* 冒険のヒント */}
                        {subs[3]?.status !== "approved" && (
                            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 16, background: "rgba(139,92,246,.08)", border: "1px solid rgba(139,92,246,.25)" }}>
                                <span style={{ fontSize: 26 }}>🧭</span>
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 900, color: "#a78bfa" }}>冒険のヒント</div>
                                    <div style={{ fontSize: 13, color: "#e4dcff", marginTop: 2 }}>
                                        {!b1ok ? "①コミュ基礎を進めよう！" : "②研修・同行を進めよう！同行回数を増やすと営業デビューがぐっと近づくよ"}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* メニューへ戻る */}
                <div style={{ display: "flex", justifyContent: "center", marginTop: 44 }}>
                    <button onClick={() => router.push("/menu")} style={{ padding: "12px 32px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>
                        メニューへ戻る
                    </button>
                </div>
            </div>
        </main>
    );
}

function StepCard({ step, state, onCta, sub, userId, onSaved, stepContents, doneContentIds, onOpenContent, passedTests, onGoTest, b1ok }: { step: Step; state: StepState; onCta: (path: string) => void; sub: { status: string; review: string; scheduled_date: string; mtg_attended?: boolean; mtg_date?: string; event_no_cancel?: boolean; event_date?: string }; userId: string; onSaved: (st: any) => void; stepContents: Record<number, any[]>; doneContentIds: Set<string>; onOpenContent: (id: string) => void; passedTests: Set<string>; onGoTest: (path: string) => void; b1ok: boolean }) {
    const isNow = state === "now";
    const isLock = state === "lock";
    const [reviewText, setReviewText] = useState("");
    const [sending, setSending] = useState(false);
    const isDone = state === "done";
    return (
        <div style={{
            borderRadius: 22, padding: "24px 26px", position: "relative", overflow: "hidden",
            background: isNow ? "linear-gradient(140deg, #3a1f6e 0%, #241452 55%, #0f0b28 100%)" : isLock ? "rgba(255,255,255,.02)" : "rgba(52,211,153,.04)",
            border: `1.5px solid ${isNow ? "rgba(167,139,250,.55)" : isLock ? "rgba(255,255,255,.08)" : "rgba(52,211,153,.3)"}`,
            boxShadow: isNow ? "0 8px 40px rgba(124,74,220,.3)" : "none",
        }}>
            {isNow && <><span style={{ position: "absolute", top: 16, right: 30, fontSize: 12, opacity: .7 }}>✦</span><span style={{ position: "absolute", top: 44, right: 90, fontSize: 9, opacity: .5 }}>⭐</span></>}

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: isNow ? "#c4b5fd" : "#8b8fa8" }}>STEP {step.no}</span>
                {isNow && <span style={{ fontSize: 10, fontWeight: 900, color: "#fff", background: "#7c5cf0", borderRadius: 999, padding: "2px 10px" }}>今ここ</span>}
                {isDone && <span style={{ fontSize: 10, fontWeight: 900, color: "#34d399", background: "rgba(52,211,153,.15)", border: "1px solid rgba(52,211,153,.4)", borderRadius: 999, padding: "2px 10px" }}>✓ 完了</span>}
                {isLock && <span style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af" }}>🔒 未解放</span>}
                <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, color: "#a78bfa" }}>💎 +{step.reward}pt</span>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 900, color: isLock ? "#9ca3af" : "#fff", margin: "0 0 8px" }}>{step.title}</h2>
            <p style={{ fontSize: 13.5, color: isLock ? "#6b7280" : "#c2b8ee", lineHeight: 1.6, margin: 0 }}>{step.desc}</p>

            {/* 必修チップ（STEP3など） */}
            {step.musts && !isLock && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                    {step.musts.map((m, i) => (
                        <span key={i} style={{
                            fontSize: 11.5, fontWeight: 700, padding: "6px 12px", borderRadius: 8,
                            background: m.state === "ok" ? "rgba(52,211,153,.1)" : "rgba(139,92,246,.12)",
                            border: `1px solid ${m.state === "ok" ? "rgba(52,211,153,.35)" : "rgba(139,92,246,.4)"}`,
                            color: m.state === "ok" ? "#34d399" : "#c4b5fd",
                        }}>{m.state === "ok" ? "✓ " : "▶ "}{m.label}</span>
                    ))}
                </div>
            )}

            {/* 解放条件（施錠ステップ） */}
            {isLock && step.unlock && (
                <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 12, background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.08)" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#8b8fa8", marginBottom: 8 }}>🔓 解放条件</div>
                    {step.unlock.map((u, i) => (
                        <div key={i} style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>・{u}</div>
                    ))}
                </div>
            )}

            {/* CTA（今ここのステップだけ） */}
            {isNow && step.no === 3 && sub.status !== "approved" && (
                sub.status === "pending" ? (
                    <div style={{ marginTop: 18, padding: "13px 16px", borderRadius: 12, textAlign: "center", background: "rgba(167,139,250,.15)", color: "#c4b5fd", fontSize: 14, fontWeight: 800, border: "1px solid rgba(167,139,250,.4)" }}>
                        ⏳ 提出済み（承認待ち）
                    </div>
                ) : (
                    <Step3Form userId={userId} sub={sub} onSaved={onSaved} />
                )
            )}
            {(step.no === 1 || step.no === 2 || step.no === 4 || step.no === 5) && (state === "now" || state === "done") && (
                <div style={{ marginTop: 18, padding: "13px 16px", borderRadius: 14, background: "rgba(167,139,250,.1)", border: "1px solid rgba(167,139,250,.25)", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#c4b5fd", whiteSpace: "nowrap" }}>📅 {step.no === 1 ? "入社・研修日" : step.no === 4 ? "DRM研修参加日" : step.no === 5 ? "キャリア面談日" : "登竜門研修日"}</span>
                    <input type="date" value={sub.scheduled_date} onChange={async (e) => {
                        const d = e.target.value;
                        onSaved({ scheduled_date: d });
                        if (!userId) return;
                        const { data: upd } = await supabase.from("journey_submissions").update({ scheduled_date: d || null }).eq("user_id", userId).eq("step_no", step.no).select();
                        if (!upd || upd.length === 0) {
                            await supabase.from("journey_submissions").insert({ user_id: userId, step_no: step.no, scheduled_date: d || null, status: "none" });
                        }
                    }} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(167,139,250,.4)", background: "rgba(0,0,0,.3)", color: "#fff", fontSize: 14 }} />
                </div>
            )}
            {isNow && (step.no === 4 || step.no === 5) && sub.status !== "approved" && (
                sub.status === "pending" ? (
                    <div style={{ marginTop: 18, padding: "13px 16px", borderRadius: 12, textAlign: "center", background: "rgba(167,139,250,.15)", color: "#c4b5fd", fontSize: 14, fontWeight: 800, border: "1px solid rgba(167,139,250,.4)" }}>
                        ⏳ 申請中（承認待ち）
                    </div>
                ) : (
                    <button disabled={!sub.scheduled_date} onClick={async () => {
                        if (!userId || !sub.scheduled_date) return;
                        const { data: upd } = await supabase.from("journey_submissions").update({ status: "pending" }).eq("user_id", userId).eq("step_no", step.no).select();
                        if (!upd || upd.length === 0) { await supabase.from("journey_submissions").insert({ user_id: userId, step_no: step.no, status: "pending", scheduled_date: sub.scheduled_date }); }
                        onSaved({ status: "pending" });
                    }} style={{ width: "100%", marginTop: 14, padding: "15px", borderRadius: 999, border: "none", cursor: sub.scheduled_date ? "pointer" : "not-allowed", opacity: sub.scheduled_date ? 1 : 0.5, background: "linear-gradient(135deg, #a78bfa, #7c5cf0)", color: "#fff", fontSize: 15, fontWeight: 900, boxShadow: "0 6px 22px rgba(139,92,246,.5)", letterSpacing: 1 }}>
                        {step.no === 4 ? "📨 DRM研修に参加した" : "🎤 面談を受けた"}
                    </button>
                )
            )}
            {step.no === 5 && !isLock && (
                <button onClick={() => onGoTest("/thanks")} style={{ width: "100%", marginTop: 12, padding: "13px", borderRadius: 999, border: "1px solid rgba(251,191,36,.4)", cursor: "pointer", background: "rgba(251,191,36,.08)", color: "#fbbf24", fontSize: 14, fontWeight: 800 }}>
                    💌 サンキューを送る
                </button>
            )}
            {step.no === 6 && state === "done" && (
                <div style={{ marginTop: 18, padding: "22px 20px", borderRadius: 16, background: "linear-gradient(135deg, rgba(251,191,36,.15), rgba(167,139,250,.15))", border: "1px solid rgba(251,191,36,.4)", textAlign: "center" }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>🎉</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#fbbf24", marginBottom: 10 }}>営業デビュー、おめでとう！</div>
                    <div style={{ fontSize: 13.5, color: "#e5e0ff", lineHeight: 1.8 }}>ここからが本番。学んだことを現場でフルに使って、自分だけの実績を積み上げよう。<br />営業で数字と行動を積めば、それがそのまま語れるガクチカ（=あなたの武器）になる。🔥</div>
                </div>
            )}
            {step.no === 6 && !isLock && state !== "done" && (
                <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#c4b5fd", marginBottom: 10, letterSpacing: 1 }}>🏆 ゴール条件</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div onClick={() => onGoTest("/tests/sales")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, cursor: "pointer", background: passedTests.has("sales") ? "rgba(52,211,153,.1)" : "rgba(167,139,250,.08)", border: passedTests.has("sales") ? "1px solid rgba(52,211,153,.3)" : "1px solid rgba(167,139,250,.2)" }}>
                            <span style={{ fontSize: 15 }}>{passedTests.has("sales") ? "✅" : "○"}</span>
                            <span style={{ fontSize: 13, color: passedTests.has("sales") ? "#a7f3d0" : "#e5e0ff", fontWeight: 600, flex: 1 }}>営業デビューテストに合格</span>
                            <span style={{ fontSize: 12, color: "#a78bfa" }}>{passedTests.has("sales") ? "合格済" : "受ける"} ›</span>
                        </div>
                        <div onClick={() => onGoTest("/rookie")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, cursor: "pointer", background: b1ok ? "rgba(52,211,153,.1)" : "rgba(167,139,250,.08)", border: b1ok ? "1px solid rgba(52,211,153,.3)" : "1px solid rgba(167,139,250,.2)" }}>
                            <span style={{ fontSize: 15 }}>{b1ok ? "✅" : "○"}</span>
                            <span style={{ fontSize: 13, color: b1ok ? "#a7f3d0" : "#e5e0ff", fontWeight: 600, flex: 1 }}>一人前チャレンジ コミュ基礎を制覇</span>
                            <span style={{ fontSize: 12, color: "#a78bfa" }}>{b1ok ? "達成" : "進める"} ›</span>
                        </div>
                    </div>
                    <div style={{ fontSize: 11, color: "#8b8fa8", marginTop: 8 }}>※ 上のコンテンツ・テスト・コミュ基礎をすべて達成するとゴール！</div>
                </div>
            )}
            {!isLock && (stepContents[step.no] || []).length > 0 && (
                <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#c4b5fd", marginBottom: 10, letterSpacing: 1 }}>📚 このフェーズで見る</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(stepContents[step.no] || []).map((c: any) => {
                            const done = doneContentIds.has(c.id);
                            return (
                                <div key={c.id} onClick={() => onOpenContent(c.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, cursor: "pointer", background: done ? "rgba(52,211,153,.1)" : "rgba(167,139,250,.08)", border: done ? "1px solid rgba(52,211,153,.3)" : "1px solid rgba(167,139,250,.2)" }}>
                                    <span style={{ fontSize: 15, flexShrink: 0 }}>{done ? "✅" : "○"}</span>
                                    <span style={{ fontSize: 13, color: done ? "#a7f3d0" : "#e5e0ff", fontWeight: 600, lineHeight: 1.4, flex: 1 }}>{c.title}</span>
                                    <span style={{ fontSize: 12, color: "#a78bfa", flexShrink: 0 }}>見る ›</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {step.no === 2 && (state === "now" || state === "done") && (
                <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#c4b5fd", marginBottom: 10, letterSpacing: 1 }}>📝 このフェーズで受けるテスト</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[{ label: "確認ワークテスト", path: "/quiz", key: "quiz" }, { label: "即レス", path: "/tests/quick-response", key: "quick_response" }, { label: "常識・デリカシーテスト", path: "/tests/common-sense", key: "common_sense" }].map((t) => {
                            const passed = passedTests.has(t.key);
                            return (
                                <div key={t.key} onClick={() => onGoTest(t.path)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, cursor: "pointer", background: passed ? "rgba(52,211,153,.1)" : "rgba(167,139,250,.08)", border: passed ? "1px solid rgba(52,211,153,.3)" : "1px solid rgba(167,139,250,.2)" }}>
                                    <span style={{ fontSize: 15, flexShrink: 0 }}>{passed ? "✅" : "○"}</span>
                                    <span style={{ fontSize: 13, color: passed ? "#a7f3d0" : "#e5e0ff", fontWeight: 600, lineHeight: 1.4, flex: 1 }}>{t.label}</span>
                                    <span style={{ fontSize: 12, color: "#a78bfa", flexShrink: 0 }}>{passed ? "合格済" : "受ける"} ›</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {isNow && (step.no === 1 || step.no === 2) && sub.status !== "approved" && (
                sub.status === "pending" ? (
                    <div style={{ marginTop: 18 }}>
                        <div style={{ padding: "13px 16px", borderRadius: 12, textAlign: "center", background: "rgba(167,139,250,.15)", color: "#c4b5fd", fontSize: 14, fontWeight: 800, border: "1px solid rgba(167,139,250,.4)" }}>
                            ⏳ 報告を送信済み（承認待ち）
                        </div>
                        {sub.review && (
                            <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(167,139,250,.15)", fontSize: 13, color: "#c2b8ee", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{sub.review}</div>
                        )}
                    </div>
                ) : (
                    <div style={{ marginTop: 18 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#c4b5fd", marginBottom: 8 }}>{step.no === 1 ? "入社・研修の感想" : "登竜門の感想"}を書いて送信（必須）</div>
                        <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="学んだこと・目標などを書こう" rows={4} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(167,139,250,.4)", background: "rgba(0,0,0,.3)", color: "#fff", fontSize: 14, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                        <button disabled={sending || !reviewText.trim()} onClick={async () => {
                            if (!userId || !reviewText.trim()) return;
                            setSending(true);
                            const { error } = await supabase.from("journey_submissions").upsert({ user_id: userId, step_no: step.no, status: "pending", review: reviewText.trim() }, { onConflict: "user_id,step_no" });
                            setSending(false);
                            if (error) { alert("送信に失敗しました: " + error.message); return; }
                            onSaved({ status: "pending", review: reviewText.trim() });
                        }} style={{ width: "100%", marginTop: 12, padding: "15px", borderRadius: 999, border: "none", cursor: (sending || !reviewText.trim()) ? "not-allowed" : "pointer", opacity: (sending || !reviewText.trim()) ? 0.5 : 1, background: "linear-gradient(135deg, #a78bfa, #7c5cf0)", color: "#fff", fontSize: 15, fontWeight: 900, boxShadow: "0 6px 22px rgba(139,92,246,.5)", letterSpacing: 1 }}>
                            ⛩️ 報告を送信
                        </button>
                    </div>
                )
            )}
            {isNow && step.ctaLabel && step.ctaPath && (
                <button onClick={() => onCta(step.ctaPath!)} style={{ width: "100%", marginTop: 18, padding: "15px", borderRadius: 999, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #a78bfa, #7c5cf0)", color: "#fff", fontSize: 15, fontWeight: 900, boxShadow: "0 6px 22px rgba(139,92,246,.5)", letterSpacing: 1 }}>
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
    const rowStyle = (on: boolean): any => ({ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, cursor: "pointer", background: on ? "rgba(52,211,153,.1)" : "rgba(167,139,250,.08)", border: on ? "1px solid rgba(52,211,153,.3)" : "1px solid rgba(167,139,250,.2)", marginBottom: 8 });
    const dateStyle: any = { width: "100%", marginTop: 6, marginBottom: 8, padding: "9px 11px", borderRadius: 8, border: "1px solid rgba(167,139,250,.4)", background: "rgba(0,0,0,.3)", color: "#fff", fontSize: 14 };
    return (
        <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#c4b5fd", marginBottom: 10 }}>完了したらチェックして日付を入力・提出（必須）</div>
            <div onClick={() => setMtg(!mtg)} style={rowStyle(mtg)}>
                <span style={{ fontSize: 16 }}>{mtg ? "✅" : "○"}</span>
                <span style={{ fontSize: 13.5, color: "#e5e0ff", fontWeight: 700 }}>全体MTGに出席</span>
            </div>
            <input type="date" value={mtgDate} onClick={(e) => e.stopPropagation()} onChange={(e) => setMtgDate(e.target.value)} style={dateStyle} />
            <div onClick={() => setEvt(!evt)} style={rowStyle(evt)}>
                <span style={{ fontSize: 16 }}>{evt ? "✅" : "○"}</span>
                <span style={{ fontSize: 13.5, color: "#e5e0ff", fontWeight: 700 }}>研修・イベント当日キャンセルなし</span>
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
            }} style={{ width: "100%", marginTop: 6, padding: "15px", borderRadius: 999, border: "none", cursor: (sending || !ready) ? "not-allowed" : "pointer", opacity: (sending || !ready) ? 0.5 : 1, background: "linear-gradient(135deg, #a78bfa, #7c5cf0)", color: "#fff", fontSize: 15, fontWeight: 900, boxShadow: "0 6px 22px rgba(139,92,246,.5)", letterSpacing: 1 }}>
                📋 提出する
            </button>
        </div>
    );
}
