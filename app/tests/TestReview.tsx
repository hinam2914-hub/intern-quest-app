"use client";
// 結果詳細：自分の受験1回分の「成績サマリー」と「問題ごとの結果（自分の回答・正解・解説）」。
// データはサーバーの test_review() だけから受け取る（本人の受験しか返らない。回答の記録が無い過去の受験は、推測せず「記録なし」と表示する）。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { TEST_IMG, formatDate } from "./meta";

type Item = { no: number; section: string | null; question: string; options: string[]; your: number | null; correct: number; is_correct: boolean; explanation: string | null; pitfall: string | null; related_url: string | null };
type Review = { attempt_id: string; test_key: string; score: number; passed: boolean; created_at: string; total: number; has_answers: boolean; correct_count: number | null; items: Item[] };

export default function TestReview({ attemptId, title, prevCorrect, retryPath, retryAt }: {
    attemptId: string; title: string;
    prevCorrect?: number | null;      // 1つ前の受験の正解数（点数比較用。無ければ出さない）
    retryPath?: string;               // 「もう一度挑戦する」の行き先
    retryAt?: Date | null;            // 再受験できる時刻（まだなら待ち時間を表示）
}) {
    const router = useRouter();
    const [rv, setRv] = useState<Review | null>(null);
    const [err, setErr] = useState("");
    const [onlyWrong, setOnlyWrong] = useState(true);
    const [open, setOpen] = useState<Set<number>>(new Set());

    useEffect(() => {
        let alive = true;
        setRv(null); setErr(""); setOpen(new Set());
        (async () => {
            const { data, error } = await supabase.rpc("test_review", { p_attempt: attemptId });
            if (!alive) return;
            if (error || !data) { setErr("結果の読み込みに失敗しました"); return; }
            setRv(data as Review);
        })();
        return () => { alive = false; };
    }, [attemptId]);

    if (err) return <div className="tv-note">{err}</div>;
    if (!rv) return <div className="tv-note">結果を読み込んでいます...</div>;

    const go = (url: string) => { if (url.startsWith("/")) router.push(url); else window.open(url, "_blank", "noopener"); };
    const waiting = !!retryAt && retryAt.getTime() > Date.now();
    const waitText = waiting ? (() => { const m = Math.ceil((retryAt!.getTime() - Date.now()) / 60000); return m >= 60 ? `あと約${Math.ceil(m / 60)}時間` : `あと約${m}分`; })() : "";
    const Retry = () => !rv.passed && retryPath ? (
        <button className={"tv-btn" + (waiting ? " off" : "")} disabled={waiting} onClick={() => router.push(retryPath)}>
            <img src={TEST_IMG.challenge} alt="" />{waiting ? `再受験は${waitText}` : "もう一度挑戦する"}
        </button>
    ) : null;

    // 回答の記録が無い受験（この機能より前の受験）：分かっている点数だけ出し、間違えた問題は推測しない
    if (!rv.has_answers) return (
        <div className="tv">
            <style>{CSS}</style>
            <div className="tv-note">📜 この受験は回答の記録がありません（{formatDate(rv.created_at)} 受験）。<br />次に受験すると、間違えた問題と解説をここで確認できます。</div>
            <div className="tv-actions"><Retry /></div>
        </div>
    );

    const correct = rv.correct_count ?? 0; const wrong = rv.total - correct; const rate = rv.total ? Math.round((correct / rv.total) * 100) : 0;
    const need = rv.total - correct;   // 合格基準は全問正解
    const list = onlyWrong ? rv.items.filter((i) => !i.is_correct) : rv.items;
    const R = 46, C = 2 * Math.PI * R;
    const toggle = (no: number) => setOpen((s) => { const n = new Set(s); if (n.has(no)) n.delete(no); else n.add(no); return n; });
    const opt = (it: Item, i: number | null) => (i === null || i < 0 || i >= it.options.length ? "（未回答）" : it.options[i]);

    return (
        <div className="tv">
            <style>{CSS}</style>
            <div className="tv-grid">
                <section className={"tv-sum" + (rv.passed ? " ok" : "")}>
                    <div className="tv-h"><img src={TEST_IMG.crown} alt="" />結果詳細</div>
                    <div className="tv-sumbody">
                        <svg viewBox="0 0 110 110" className="tv-ring" role="img" aria-label={`${correct}/${rv.total}`}>
                            <circle cx="55" cy="55" r={R} fill="none" stroke="#f1e4e6" strokeWidth="9" />
                            <circle cx="55" cy="55" r={R} fill="none" stroke={rv.passed ? "#16a34a" : "#e5486a"} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${C * (correct / Math.max(1, rv.total))} ${C}`} transform="rotate(-90 55 55)" />
                            <text x="55" y="62" textAnchor="middle" fontSize="25" fontWeight="900" fill="#2a2f52">{correct}<tspan fontSize="14">/{rv.total}</tspan></text>
                        </svg>
                        <div className="tv-rows">
                            <div><span>テスト</span><b>{title}</b></div>
                            <div><span>合否</span><b className={rv.passed ? "g" : "r"}>{rv.passed ? "✅ 合格" : "❌ 不合格"}</b></div>
                            <div><span>✅ 正解</span><b>{correct}問</b></div>
                            <div><span>❌ 不正解</span><b>{wrong}問</b></div>
                            <div><span>正答率</span><b>{rate}%</b></div>
                            {!rv.passed && <div><span>合格まで</span><b className="r">あと{need}問</b></div>}
                            {typeof prevCorrect === "number" && <div><span>前回との比較</span><b className={correct > prevCorrect ? "g" : correct < prevCorrect ? "r" : ""}>{prevCorrect}問 → {correct}問（{correct - prevCorrect >= 0 ? "+" : ""}{correct - prevCorrect}）</b></div>}
                            <div><span>受験日時</span><b>{formatDate(rv.created_at)}</b></div>
                        </div>
                    </div>
                </section>

                <section className="tv-list">
                    <div className="tv-h"><img src={TEST_IMG.book} alt="" />{onlyWrong ? "間違えた問題と解説" : "全問題の結果"}
                        <span className="tv-sw">
                            <button className={onlyWrong ? "on" : ""} onClick={() => setOnlyWrong(true)}>間違えた問題だけ</button>
                            <button className={!onlyWrong ? "on" : ""} onClick={() => setOnlyWrong(false)}>全問題</button>
                        </span>
                    </div>
                    {list.length === 0 && <div className="tv-note">{onlyWrong ? "間違えた問題はありません 🎉" : "問題がありません"}</div>}
                    {list.map((it) => {
                        const isOpen = open.has(it.no);
                        return (
                            <div key={it.no} className={"tv-item" + (it.is_correct ? " ok" : "")}>
                                <button className="tv-q" onClick={() => toggle(it.no)} aria-expanded={isOpen}>
                                    <span className="tv-mark">{it.is_correct ? "✓" : "✕"}</span>
                                    <span className="tv-qmid">
                                        <span className="tv-qt"><b>Q{it.no}</b>{it.question.replace(/^Q\d+[.．]\s*/, "")}</span>
                                        <span className="tv-chips">
                                            <span className={"tv-chip" + (it.is_correct ? " c" : " y")}>あなたの回答：{opt(it, it.your)}</span>
                                            {!it.is_correct && <span className="tv-chip c">正解：{opt(it, it.correct)}</span>}
                                        </span>
                                    </span>
                                    <span className="tv-caret">{isOpen ? "▲" : "▼"}</span>
                                </button>
                                {isOpen && (
                                    <div className="tv-body">
                                        <div className="tv-opts">
                                            {it.options.map((o, i) => <div key={i} className={i === it.correct ? "c" : i === it.your ? "y" : ""}>{o}{i === it.correct && <em>正解</em>}{i === it.your && i !== it.correct && <em>あなたの回答</em>}</div>)}
                                        </div>
                                        <div className="tv-exp">
                                            <b>📖 解説</b>
                                            {it.explanation ? <p>{it.explanation}</p> : <p className="none">この問題の解説は準備中です</p>}
                                            {it.pitfall && <><b>⚠️ 間違えやすい理由</b><p>{it.pitfall}</p></>}
                                        </div>
                                        {it.related_url && <button className="tv-rel" onClick={() => go(it.related_url!)}>📚 関連する教材で学習する ›</button>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </section>
            </div>
            <div className="tv-actions">
                {!rv.passed && <button className="tv-btn sub" onClick={() => router.push("/learn")}><img src={TEST_IMG.book} alt="" />学習ページで復習する</button>}
                <Retry />
            </div>
        </div>
    );
}

const CSS = `
.tv{margin-top:12px}
.tv-grid{display:grid;grid-template-columns:minmax(260px,330px) 1fr;gap:12px;align-items:start}
.tv-grid>*{min-width:0}
.tv-sum{background:linear-gradient(180deg,#fff3f4,#fde8ea);border:2px solid #f3c6cd;border-radius:14px;padding:12px}
.tv-sum.ok{background:linear-gradient(180deg,#f1fbf4,#e3f6ea);border-color:#b7e3c5}
.tv-list{background:#fbf6ea;border:2px solid #ead9b0;border-radius:14px;padding:12px}
.tv-h{display:flex;align-items:center;gap:7px;font-size:14.5px;font-weight:900;color:#2a2f52;margin-bottom:10px;flex-wrap:wrap}
.tv-h img{width:26px;height:26px;object-fit:contain}
.tv-sw{margin-left:auto;display:inline-flex;border:2px solid #d9c489;border-radius:999px;overflow:hidden;background:#fff}
.tv-sw button{border:none;background:none;padding:6px 12px;font-size:11.5px;font-weight:900;color:#8a6a3a;cursor:pointer}
.tv-sw button.on{background:#1f4fb0;color:#fff}
.tv-sumbody{display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:center}
.tv-ring{width:118px;height:118px;flex-shrink:0}
.tv-rows{flex:1;min-width:150px}
.tv-rows div{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px dashed rgba(120,90,60,.25);font-size:12.5px}
.tv-rows div:last-child{border-bottom:none}
.tv-rows span{color:#7a6a4a;font-weight:800;white-space:nowrap}
.tv-rows b{color:#2a2f52;text-align:right}
.tv-rows b.g{color:#15803d}.tv-rows b.r{color:#dc2626}
.tv-item{background:#fff;border:2px solid #f0c9cf;border-radius:12px;margin-bottom:8px;overflow:hidden}
.tv-item.ok{border-color:#cfe8d6}
.tv-q{display:flex;align-items:flex-start;gap:10px;width:100%;text-align:left;border:none;background:none;padding:11px 12px;cursor:pointer;min-height:48px}
.tv-mark{flex-shrink:0;width:24px;height:24px;border-radius:50%;background:#e5486a;color:#fff;font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;margin-top:1px}
.tv-item.ok .tv-mark{background:#22a35a}
.tv-qmid{flex:1;min-width:0}
.tv-qt{display:block;font-size:14px;font-weight:800;color:#23284a;line-height:1.5;overflow-wrap:anywhere}
.tv-qt b{margin-right:8px;color:#1f4fb0}
.tv-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.tv-chip{font-size:12px;font-weight:800;border-radius:8px;padding:3px 9px;overflow-wrap:anywhere}
.tv-chip.y{background:#fdecee;color:#b4233f}
.tv-chip.c{background:#e1f6e6;color:#166534}
.tv-caret{color:#b79a5a;font-size:11px;margin-top:5px}
.tv-body{padding:2px 12px 12px 46px}
.tv-opts div{font-size:13px;color:#4a4a5a;border:1.5px solid #ece6d6;border-radius:9px;padding:7px 10px;margin-bottom:5px;display:flex;justify-content:space-between;gap:8px;overflow-wrap:anywhere}
.tv-opts div.c{background:#e9f8ed;border-color:#8fd3a5;color:#14532d;font-weight:800}
.tv-opts div.y{background:#fdeff1;border-color:#f0a9b5;color:#9f1d38;font-weight:800}
.tv-opts em{font-style:normal;font-size:10.5px;font-weight:900;white-space:nowrap}
.tv-exp{margin-top:8px;background:#f4f7ff;border:1.5px solid #c9d6f5;border-radius:10px;padding:10px 12px}
.tv-exp b{display:block;font-size:12.5px;color:#1f4fb0;margin-top:6px}
.tv-exp b:first-child{margin-top:0}
.tv-exp p{margin:4px 0 0;font-size:13.5px;line-height:1.75;color:#2a2f52;white-space:pre-wrap;overflow-wrap:anywhere}
.tv-exp p.none{color:#8a8fa8}
.tv-rel{margin-top:8px;border:2px solid #1f4fb0;background:#fff;color:#1f4fb0;font-weight:900;font-size:13px;border-radius:999px;padding:9px 16px;cursor:pointer;min-height:44px}
.tv-note{background:#fff;border:2px dashed #d9c489;border-radius:12px;padding:14px;font-size:13px;font-weight:800;color:#6b5a33;line-height:1.7;text-align:center}
.tv-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px}
.tv-btn{display:inline-flex;align-items:center;gap:8px;border:3px solid #F5D77E;background:linear-gradient(180deg,#3b78e0,#1454B8);color:#fff;font-weight:900;font-size:14.5px;border-radius:999px;padding:10px 22px;cursor:pointer;min-height:48px;box-shadow:0 5px 12px rgba(16,47,112,.3)}
.tv-btn img{width:26px;height:26px;object-fit:contain}
.tv-btn.sub{background:linear-gradient(180deg,#fffdf4,#f1e1bd);color:#17397d;border-color:#D9A441}
.tv-btn.off{background:#cbbf9f;border-color:#e3d9bd;box-shadow:none;cursor:not-allowed}
@media (max-width:760px){
  .tv-grid{grid-template-columns:1fr}
  .tv-body{padding-left:12px}
  .tv-sw{margin-left:0;width:100%}
  .tv-sw button{flex:1}
  .tv-actions{flex-direction:column}
  .tv-btn{justify-content:center}
}
`;
