"use client";
// テスト受験の共通画面。問題はサーバーの test_start() から受け取る（正解は画面に来ない）。
// 提出は test_submit()：採点・回答の保存・合格フラグ・合格ポイント付与はすべてサーバー側。画面は結果を表示するだけ。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import TestReview from "./TestReview";
import { TEST_IMG } from "./meta";

export type RunnerConfig = {
    testKey: string;
    title: string;
    path: string;
    written: (string | { id: number; q: string })[];
    /** 記述回答の保存形式（これまでの保存形式を維持：管理画面の表示と互換） qmap={設問:回答} / qa=[{question,answer}] / list=[回答] / idmap={id:回答} */
    writtenFormat: "qmap" | "qa" | "list" | "idmap";
    /** 記述の必須条件（これまでと同じ） all=全問必須 / any=1問以上 / min10=全問10文字以上 / none=任意 */
    writtenRule: "all" | "any" | "min10" | "none";
    rank?: boolean;   // A/B/Cランク表示のあるテスト（合格はAランク＝全問正解。これまでと同じ）
};
type Q = { no: number; section: string | null; question: string; options: string[] };
type Result = { attempt_id: string; correct: number; total: number; passed: boolean; reward_points: number };

export default function TestRunner({ cfg }: { cfg: RunnerConfig }) {
    const router = useRouter();
    const [phase, setPhase] = useState<"loading" | "error" | "passed" | "cooldown" | "form" | "result">("loading");
    const [errText, setErrText] = useState("");
    const [qs, setQs] = useState<Q[]>([]);
    const [reward, setReward] = useState(0);
    const [cool, setCool] = useState<Date | null>(null);
    const [answers, setAnswers] = useState<number[]>([]);
    const [written, setWritten] = useState<string[]>(cfg.written.map(() => ""));
    const [ask, setAsk] = useState(false);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");
    const [result, setResult] = useState<Result | null>(null);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            const { data, error } = await supabase.rpc("test_start", { p_test: cfg.testKey });
            if (error || !data) { setErrText("このテストはただいま準備中です。しばらくしてからもう一度お試しください"); setPhase("error"); return; }
            const d = data as any;
            if (d.already_passed) { setPhase("passed"); return; }
            if (d.cooldown_until) { setCool(new Date(d.cooldown_until)); setPhase("cooldown"); return; }
            const list = (d.questions || []) as Q[];
            if (!list.length) { setErrText("問題が登録されていません"); setPhase("error"); return; }
            setQs(list); setAnswers(list.map(() => -1)); setReward(Number(d.reward_points || 0)); setPhase("form");
        })();
    }, [router, cfg.testKey]);

    const wText = (w: string | { id: number; q: string }) => (typeof w === "string" ? w : w.q);
    const validate = (): string => {
        const left = answers.filter((a) => a === -1).length;
        if (left > 0) return `選択問題があと${left}問残っています`;
        if (cfg.writtenRule === "all" && written.some((w) => !w.trim())) return "記述問題はすべて回答してください";
        if (cfg.writtenRule === "any" && cfg.written.length > 0 && written.every((w) => !w.trim())) return "記述問題は少なくとも1問回答してください";
        if (cfg.writtenRule === "min10" && written.some((w) => w.trim().length < 10)) return "記述問題はすべて10文字以上で回答してください";
        return "";
    };
    const writtenPayload = () => {
        if (cfg.writtenFormat === "qa") return cfg.written.map((w, i) => ({ question: wText(w), answer: written[i] || "" }));
        if (cfg.writtenFormat === "list") return written;
        const o: Record<string, string> = {};
        cfg.written.forEach((w, i) => { o[cfg.writtenFormat === "idmap" && typeof w !== "string" ? String(w.id) : wText(w)] = written[i] || ""; });
        return o;
    };
    const submit = async () => {
        if (busy) return;
        setBusy(true);
        const { data, error } = await supabase.rpc("test_submit", { p_test: cfg.testKey, p_answers: answers, p_written: writtenPayload(), p_link: cfg.path });
        setBusy(false); setAsk(false);
        if (error || !data) {
            const m = error?.message || "";
            setMsg(m.includes("COOLDOWN") ? "前回の受験から24時間たっていません" : m.includes("ALREADY_PASSED") ? "このテストはすでに合格しています" : "送信に失敗しました。通信環境を確認して、もう一度お試しください");
            return;
        }
        setResult(data as Result); setPhase("result");
        try { window.scrollTo({ top: 0 }); } catch {}
    };

    // ※コンポーネントにせず関数として呼ぶ（入力中に画面が作り直されてフォーカスが外れるのを防ぐ）
    const shell = (children: React.ReactNode) => (
        <div className="tr-root">
            <style>{CSS}</style>
            <header className="tr-head">
                <button className="tr-back" onClick={() => router.push("/tests")}>← テスト一覧</button>
                <div className="tr-title">{cfg.title}</div>
            </header>
            <main className="tr-main">{children}</main>
        </div>
    );

    if (phase === "loading") return shell(<><div className="tr-center">📜 問題を準備しています...</div></>);
    if (phase === "error") return shell(<><div className="tr-center">{errText}<br /><button className="tr-btn" onClick={() => router.push("/tests")}>テスト一覧へもどる</button></div></>);
    if (phase === "passed") return shell(<><div className="tr-center"><img src={TEST_IMG.crown} alt="" className="tr-big" /><h2 className="g">合格済み</h2><p>このテストにはすでに合格しています</p><button className="tr-btn" onClick={() => router.push("/tests")}>テスト一覧へもどる</button></div></>);
    if (phase === "cooldown") {
        const m = cool ? Math.max(1, Math.ceil((cool.getTime() - Date.now()) / 60000)) : 0;
        return shell(<><div className="tr-center"><img src={TEST_IMG.book} alt="" className="tr-big" /><h2>再受験まで {m >= 60 ? `あと約${Math.ceil(m / 60)}時間` : `あと約${m}分`}</h2><p>不合格のあとは24時間あけてから再受験できます。<br />そのあいだに、間違えた問題と解説を確認しておきましょう。</p><button className="tr-btn" onClick={() => router.push(`/tests?open=${cfg.testKey}`)}>間違えた問題を復習する</button></div></>);
    }

    if (phase === "result" && result) {
        const rate = result.correct / Math.max(1, result.total);
        const rank = rate >= 1 ? "A" : rate >= 0.7 ? "B" : "C";
        return shell(
            <>
                <div className={"tr-result" + (result.passed ? " ok" : "")}>
                    <img src={result.passed ? TEST_IMG.crown : TEST_IMG.book} alt="" className="tr-big" />
                    <h2 className={result.passed ? "g" : "r"}>{result.passed ? "合格！" : "不合格"}</h2>
                    <div className="tr-score">{result.correct}<i>/{result.total}</i>{cfg.rank && <em>ランク {rank}</em>}</div>
                    {result.passed
                        ? <p>{result.reward_points > 0 && <b>+{result.reward_points}pt を獲得しました。</b>}{cfg.written.length > 0 && <><br />記述回答は管理者が評価します（評価により 高+30pt／中+10pt）</>}</p>
                        : <p>合格には全問正解が必要です（あと{result.total - result.correct}問）。<br />下で間違えた問題と解説を確認して、24時間後にもう一度挑戦しましょう。</p>}
                </div>
                <TestReview attemptId={result.attempt_id} title={cfg.title} retryPath={cfg.path} retryAt={result.passed ? null : new Date(Date.now() + 24 * 3600 * 1000)} />
                <div style={{ textAlign: "center", marginTop: 16 }}><button className="tr-btn sub" onClick={() => router.push("/tests")}>テスト一覧へもどる</button></div>
            </>
        );
    }

    const answered = answers.filter((a) => a !== -1).length;
    let lastSection: string | null = null;
    return shell(
        <>
            <div className="tr-intro">
                <img src={TEST_IMG.challenge} alt="" />
                <span>選択問題 全{qs.length}問{cfg.written.length > 0 && <>＋記述 {cfg.written.length}問</>}。<b>全問正解で合格{reward > 0 && <>（+{reward}pt）</>}</b>。不合格の場合は24時間後に再受験できます。提出後に、自分の回答・正解・解説を確認できます。</span>
            </div>
            {qs.map((q, i) => {
                const head = q.section && q.section !== lastSection ? q.section : null; lastSection = q.section;
                return (
                    <div key={q.no}>
                        {head && <div className="tr-sec">{head}</div>}
                        <div className={"tr-q" + (answers[i] !== -1 ? " done" : "")}>
                            <div className="tr-qt"><b>Q{q.no}</b>{q.question.replace(/^Q\d+[.．]\s*/, "")}</div>
                            <div className="tr-opts">
                                {q.options.map((o, oi) => (
                                    <button key={oi} className={answers[i] === oi ? "on" : ""} onClick={() => setAnswers((a) => { const n = [...a]; n[i] = oi; return n; })}>{o}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })}
            {cfg.written.length > 0 && <div className="tr-sec">記述問題{cfg.writtenRule === "none" ? "（任意）" : ""}</div>}
            {cfg.written.map((w, i) => (
                <div key={i} className="tr-q">
                    <div className="tr-qt">{wText(w)}</div>
                    <textarea value={written[i]} onChange={(e) => setWritten((s) => { const n = [...s]; n[i] = e.target.value; return n; })} rows={4} placeholder="ここに回答を書いてください" />
                </div>
            ))}
            {msg && <div className="tr-msg">⚠️ {msg}</div>}
            <div className="tr-submit">
                <span>回答済み {answered}/{qs.length}</span>
                <button className="tr-btn" onClick={() => { const v = validate(); setMsg(v); if (!v) setAsk(true); }}>提出する</button>
            </div>
            {ask && (
                <div className="tr-modal-bg" onClick={() => !busy && setAsk(false)}>
                    <div className="tr-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>提出しますか？</h3>
                        <p>提出すると採点され、やり直しはできません。<br />全問正解で合格です。{cfg.written.length > 0 && "記述回答は管理者が評価します。"}</p>
                        <div><button className="tr-btn sub" disabled={busy} onClick={() => setAsk(false)}>もどる</button><button className="tr-btn" disabled={busy} onClick={submit}>{busy ? "採点中..." : "提出する"}</button></div>
                    </div>
                </div>
            )}
        </>
    );
}

const CSS = `
.tr-root{min-height:100vh;min-height:100dvh;background:#7fc3ef url(/images/onboarding/job-selection-bg.webp) center 22%/cover no-repeat fixed;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416;padding:14px 12px calc(60px + env(safe-area-inset-bottom));box-sizing:border-box}
.tr-head{max-width:820px;margin:0 auto 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.tr-back{border:2px solid #F5D77E;background:rgba(255,249,237,.96);color:#102F70;font-weight:900;font-size:12.5px;border-radius:999px;padding:10px 15px;cursor:pointer;min-height:44px}
.tr-title{flex:1;min-width:0;background:linear-gradient(180deg,#3f66b8,#162c66);border:3px solid #F5D77E;border-radius:16px;padding:10px 18px;color:#fff;font-size:19px;font-weight:900;text-align:center;box-shadow:0 5px 0 #0d1c45,0 10px 20px rgba(16,47,112,.35);overflow-wrap:anywhere}
.tr-main{max-width:820px;margin:0 auto;background:rgba(255,250,240,.97);border:3px solid #E8C876;border-radius:18px;padding:16px 16px 20px;box-shadow:0 12px 30px rgba(10,20,60,.35)}
.tr-center{text-align:center;padding:40px 10px;font-size:14.5px;font-weight:800;color:#5b4a23;line-height:1.9}
.tr-center h2,.tr-result h2{margin:6px 0;font-size:26px;font-weight:900;color:#17397d}
.tr-center h2.g,.tr-result h2.g{color:#15803d}.tr-result h2.r{color:#dc2626}
.tr-big{width:110px;height:110px;object-fit:contain}
.tr-intro{display:flex;align-items:center;gap:12px;background:#eef4ff;border:2px solid #c3d4f7;border-radius:14px;padding:10px 14px;font-size:13px;line-height:1.7;color:#27365f;margin-bottom:14px}
.tr-intro img{width:52px;height:52px;object-fit:contain;flex-shrink:0}
.tr-sec{display:inline-block;background:linear-gradient(180deg,#2f6ad1,#1454B8);border:2px solid #F5D77E;border-radius:999px;padding:5px 18px;color:#fff;font-size:13.5px;font-weight:900;margin:10px 0 10px}
.tr-q{background:#fff;border:2px solid #ead9b0;border-radius:14px;padding:14px;margin-bottom:10px}
.tr-q.done{border-color:#9db9ee}
.tr-qt{font-size:15.5px;font-weight:800;color:#23284a;line-height:1.6;margin-bottom:10px;overflow-wrap:anywhere}
.tr-qt b{color:#1f4fb0;margin-right:8px}
.tr-opts{display:grid;gap:8px}
.tr-opts button{text-align:left;border:2px solid #e3dccb;background:#fbf8f0;border-radius:11px;padding:12px 14px;font-size:14.5px;font-weight:700;color:#3a3a4a;cursor:pointer;min-height:48px;overflow-wrap:anywhere}
.tr-opts button:hover{border-color:#9db9ee}
.tr-opts button.on{border-color:#1f4fb0;background:#e6efff;color:#12306e;font-weight:900;box-shadow:0 0 0 2px rgba(31,79,176,.18)}
.tr-q textarea{width:100%;box-sizing:border-box;border:2px solid #e3dccb;border-radius:11px;padding:10px 12px;font-size:14.5px;line-height:1.7;font-family:inherit;resize:vertical;background:#fbf8f0;color:#23284a}
.tr-msg{background:#fdecee;border:2px solid #f0a9b5;color:#9f1d38;font-weight:900;font-size:13.5px;border-radius:12px;padding:10px 14px;margin:10px 0}
.tr-submit{position:sticky;bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:12px;background:rgba(255,253,244,.97);border:2px solid #D9A441;border-radius:999px;padding:8px 8px 8px 20px;margin-top:14px;box-shadow:0 6px 18px rgba(16,47,112,.3);font-size:13.5px;font-weight:900;color:#5b4a23}
.tr-btn{border:3px solid #F5D77E;background:linear-gradient(180deg,#3b78e0,#1454B8);color:#fff;font-weight:900;font-size:15px;border-radius:999px;padding:11px 28px;cursor:pointer;min-height:48px;box-shadow:0 5px 12px rgba(16,47,112,.3)}
.tr-btn.sub{background:linear-gradient(180deg,#fffdf4,#f1e1bd);color:#17397d;border-color:#D9A441}
.tr-btn:disabled{opacity:.6;cursor:not-allowed}
.tr-result{text-align:center;padding:14px 8px 6px;background:linear-gradient(180deg,#fff3f4,#fde8ea);border:2px solid #f3c6cd;border-radius:16px}
.tr-result.ok{background:linear-gradient(180deg,#f1fbf4,#e3f6ea);border-color:#b7e3c5}
.tr-result p{font-size:13.5px;font-weight:700;color:#4b4530;line-height:1.8;margin:6px 0 10px}
.tr-score{font-size:44px;font-weight:900;color:#2a2f52;line-height:1.1}
.tr-score i{font-style:normal;font-size:22px}
.tr-score em{display:block;font-style:normal;font-size:14px;color:#8a6a3a;margin-top:4px}
.tr-modal-bg{position:fixed;inset:0;z-index:300;background:rgba(16,47,112,.55);display:flex;align-items:center;justify-content:center;padding:18px}
.tr-modal{width:100%;max-width:380px;background:linear-gradient(180deg,#fffdf4,#f6e7c8);border:3px solid #D9A441;border-radius:20px;padding:20px 18px;text-align:center}
.tr-modal h3{margin:0 0 8px;font-size:19px;font-weight:900;color:#17397d}
.tr-modal p{margin:0 0 14px;font-size:13.5px;font-weight:700;color:#5b4a23;line-height:1.8}
.tr-modal div{display:flex;gap:8px}
.tr-modal .tr-btn{flex:1;padding:11px 8px}
@media (max-width:640px){ .tr-title{font-size:15.5px;padding:8px 10px;flex-basis:100%} .tr-main{padding:12px 10px 16px} .tr-qt{font-size:14.5px} }
`;
