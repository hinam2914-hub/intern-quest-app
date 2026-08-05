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
    const [step2Status, setStep2Status] = useState<string>("none"); // none/pending/approved
    const [scheduledDate, setScheduledDate] = useState<string>("");
    const [userId, setUserId] = useState<string>("");
    const [selectedNo, setSelectedNo] = useState(3);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const [{ data: challenges }, { data: subs }, { data: jsub }] = await Promise.all([
                supabase.from("rookie_challenges").select("id, block").eq("is_active", true),
                supabase.from("rookie_submissions").select("challenge_id, status").eq("user_id", user.id).eq("status", "approved"),
                supabase.from("journey_submissions").select("status, scheduled_date").eq("user_id", user.id).eq("step_no", 2).maybeSingle(),
            ]);
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
            setStep2Status((jsub as any)?.status || "none");
            setScheduledDate((jsub as any)?.scheduled_date || "");
            setLoading(false);
        };
        load();
    }, [router]);

    // STEP3判定：①②が全項目達成でクリア
    const gateOk = GATE_BLOCKS.every(b => (rookieDone[b] || 0) >= (rookieTotal[b] || 0) && (rookieTotal[b] || 0) > 0);
    const block1 = `${rookieDone["①コミュ基礎"] || 0}/${rookieTotal["①コミュ基礎"] || 0}`;
    const block2 = `${rookieDone["②研修・同行"] || 0}/${rookieTotal["②研修・同行"] || 0}`;
    const b1ok = (rookieDone["①コミュ基礎"] || 0) >= (rookieTotal["①コミュ基礎"] || 0) && (rookieTotal["①コミュ基礎"] || 0) > 0;
    const b2ok = (rookieDone["②研修・同行"] || 0) >= (rookieTotal["②研修・同行"] || 0) && (rookieTotal["②研修・同行"] || 0) > 0;

    const steps: Step[] = [
        { no: 1, key: "village", img: "/journey/step1_village.png", title: "入社・スラック研修", desc: "アカウント登録・アバター設定・MY GOALS宣言", reward: 10 },
        { no: 2, key: "hut", img: "/journey/step2_hut.png", title: "登竜門キックオフ研修", desc: "学習コンテンツを視聴して基礎を固める", reward: 10 },
        {
            no: 3, key: "crystal", img: "/journey/step3_crystal.png", title: "一人前チャレンジ",
            desc: "①コミュ基礎・②研修同行をクリアすると営業研修に進めます", reward: 20,
            musts: [
                { label: `①コミュ基礎 ${block1}`, state: b1ok ? "ok" : "doing" },
                { label: `②研修・同行 ${block2}`, state: b2ok ? "ok" : "doing" },
            ],
            ctaLabel: "一人前チャレンジを進める", ctaPath: "/rookie",
        },
        { no: 4, key: "dm", img: "/journey/step4_dm.png", title: "DM研修", desc: "採用DMを送って対人の型を身につける", reward: 20, unlock: ["STEP3をクリア", "一人前チャレンジ①②完了"] },
        { no: 5, key: "temple", img: "/journey/step5_temple.png", title: "キャリア面談・配属", desc: "CB（テレアポ）かIP（訪販）か。適性を見て配属先を決める", reward: 20, unlock: ["STEP4をクリア", "DM研修完了"] },
        { no: 6, key: "castle", img: "/journey/step6_castle.png", title: "営業デビュー", desc: "営業デビューテスト合格・スクリプト練習 → 現場へ！", reward: 30, unlock: ["STEP5をクリア", "キャリア面談完了"] },
    ];

    // ステップ状態を決める
    const stateOf = (no: number): StepState => {
        if (no === 1) return "done";                    // 入社は完了扱い
        if (no === 2) return step2Status === "approved" ? "done" : "now"; // 登竜門：参加申請の承認で解錠
        if (no === 3) {
            if (stateOf(2) !== "done") return "lock";   // STEP2未完なら施錠
            return gateOk ? "done" : "now";             // 一人前チャレンジ
        }
        if (no === 4) return gateOk ? "now" : "lock";   // ①②クリアで解放
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
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>6ステップ中 {doneCount}つ完了{!gateOk && "・今はSTEP3に挑戦中！"}</div>
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
                        <StepCard step={selected} state={selState} onCta={(path) => router.push(path)} step2Status={step2Status} userId={userId} onApplied={() => setStep2Status("pending")} scheduledDate={scheduledDate} onDate={setScheduledDate} />

                        {/* 冒険のヒント */}
                        {!gateOk && (
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

function StepCard({ step, state, onCta, step2Status, userId, onApplied }: { step: Step; state: StepState; onCta: (path: string) => void; step2Status: string; userId: string; onApplied: () => void; scheduledDate: string; onDate: (d: string) => void }) {
    const isNow = state === "now";
    const isLock = state === "lock";
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
            {step.no === 2 && (state === "now" || state === "done") && (
                <div style={{ marginTop: 18, padding: "13px 16px", borderRadius: 14, background: "rgba(167,139,250,.1)", border: "1px solid rgba(167,139,250,.25)", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#c4b5fd", whiteSpace: "nowrap" }}>📅 登竜門研修日</span>
                    <input type="date" value={scheduledDate} onChange={async (e) => {
                        const d = e.target.value;
                        onDate(d);
                        if (!userId) return;
                        await supabase.from("journey_submissions").upsert({ user_id: userId, step_no: 2, scheduled_date: d || null }, { onConflict: "user_id,step_no" });
                    }} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(167,139,250,.4)", background: "rgba(0,0,0,.3)", color: "#fff", fontSize: 14 }} />
                </div>
            )}
            {isNow && step.no === 2 && step2Status !== "approved" && (
                step2Status === "pending" ? (
                    <div style={{ width: "100%", marginTop: 18, padding: "15px", borderRadius: 999, textAlign: "center", background: "rgba(167,139,250,.15)", color: "#c4b5fd", fontSize: 14, fontWeight: 800, border: "1px solid rgba(167,139,250,.4)" }}>
                        ⏳ 参加申請中（承認待ち）
                    </div>
                ) : (
                    <button onClick={async () => {
                        if (!userId) return;
                        const { error } = await supabase.from("journey_submissions").insert({ user_id: userId, step_no: 2, status: "pending" });
                        if (error) { alert("申請に失敗しました: " + error.message); return; }
                        onApplied();
                    }} style={{ width: "100%", marginTop: 18, padding: "15px", borderRadius: 999, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #a78bfa, #7c5cf0)", color: "#fff", fontSize: 15, fontWeight: 900, boxShadow: "0 6px 22px rgba(139,92,246,.5)", letterSpacing: 1 }}>
                        ⛩️ 登竜門に参加した
                    </button>
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
