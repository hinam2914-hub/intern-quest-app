"use client";
// テスト一覧「試練の間」。合格／不合格／未受験を区別し、不合格のテストは結果詳細（間違えた問題と解説）→復習→再受験へ進める。
// 一覧に出す成績は自分の受験履歴（test_attempts / quiz_attempts）だけ。問題・正解・解説は TestReview がサーバーから本人の分だけ受け取る。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import TestReview from "./TestReview";
import { TESTS, CATEGORY_ORDER, TEST_ORDER, TEST_MAX_SCORES, TEST_IMG, formatDate, type TestItem, type Attempt } from "./meta";

const EVAL_LABEL: Record<string, string> = { high: "記述評価：高", mid: "記述評価：中", none: "記述評価：なし" };

export default function TestsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [byKey, setByKey] = useState<Record<string, Attempt[]>>({});
    const [cat, setCat] = useState<string>("mind");
    const [openKey, setOpenKey] = useState<string | null>(null);
    const [pick, setPick] = useState<string | null>(null);   // 結果詳細を見ている受験（既定は最新）
    const [showW, setShowW] = useState<string | null>(null);  // 記述回答を開いている受験

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            const [{ data: p }, { data: quiz }, { data: tests }] = await Promise.all([
                supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
                supabase.from("quiz_attempts").select("score, passed, created_at, written_answers, written_evaluation, written_points_awarded").eq("user_id", user.id).order("created_at", { ascending: false }),
                supabase.from("test_attempts").select("id, test_key, score, passed, created_at, written_answers, written_evaluation, written_points_awarded").eq("user_id", user.id).order("created_at", { ascending: false }),
            ]);
            setProfile(p);
            const m: Record<string, Attempt[]> = { quiz: (quiz || []) as Attempt[] };
            (tests || []).forEach((a: any) => { (m[a.test_key] = m[a.test_key] || []).push({ ...a, id: String(a.id) }); });
            setByKey(m);
            // ?open=テストキー で、そのテストの結果詳細を開いた状態にする（受験画面の「復習する」から来たとき）
            try {
                const k = new URLSearchParams(window.location.search).get("open");
                const t = k ? TESTS.find((x) => x.key === k) : null;
                if (t) { setCat(t.category || "mind"); setOpenKey(t.key); }
            } catch {}
            setLoading(false);
        })();
    }, [router]);

    if (loading) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#7fc3ef", color: "#fff", fontWeight: 900 }}>📜 試練の間を開いています...</div>;

    const list = TESTS.filter((t) => t.category === cat).sort((a, b) => (TEST_ORDER[a.key] || 99) - (TEST_ORDER[b.key] || 99));
    const max = (k: string) => TEST_MAX_SCORES[k] || 15;
    const info = (t: TestItem) => {
        const at = byKey[t.key] || [];
        const passed = !!(t.passedField && profile?.[t.passedField]) || at.some((a) => a.passed);
        const last = at[0] || null;
        const retryAt = last && !last.passed ? new Date(new Date(last.created_at).getTime() + 24 * 3600 * 1000) : null;
        return { at, passed, last, status: passed ? "pass" : at.length ? "fail" : "none", best: at.length ? Math.max(...at.map((a) => a.score)) : null, retryAt };
    };
    const waitText = (d: Date | null) => { if (!d || d.getTime() <= Date.now()) return ""; const m = Math.ceil((d.getTime() - Date.now()) / 60000); return m >= 60 ? `あと約${Math.ceil(m / 60)}時間` : `あと約${m}分`; };
    const toggle = (k: string) => { setPick(null); setShowW(null); setOpenKey((o) => (o === k ? null : k)); };

    return (
        <div className="tq-root">
            <style>{CSS}</style>
            <header className="tq-head">
                <div className="tq-left"><button className="tq-back" onClick={() => router.push("/menu")}>← メニュー</button><span className="tq-logo">INTERN<br />QUEST</span></div>
                <div className="tq-sign">📝 テスト一覧</div>
                <div className="tq-right" />
            </header>
            <p className="tq-copy"><span>あなたの価値観・適性・覚悟を測るテスト</span></p>

            <nav className="tq-tabs">
                {CATEGORY_ORDER.map((c) => (
                    <button key={c.key} className={"tq-tab" + (cat === c.key ? " on" : "")} onClick={() => { setCat(c.key); setOpenKey(null); }}>
                        <span>{c.icon}</span>{c.label}<i>{TESTS.filter((t) => t.category === c.key).length}</i>
                    </button>
                ))}
            </nav>

            <main className="tq-main">
                {list.map((t) => {
                    const s = info(t); const isOpen = openKey === t.key; const mx = max(t.key);
                    const manual = t.table === "manual";
                    const cur = s.at.find((a) => a.id && a.id === pick) || s.last;
                    const curIdx = cur ? s.at.indexOf(cur) : -1;
                    const prev = curIdx >= 0 ? s.at[curIdx + 1] : null;
                    // 正解数で保存しているテストだけ前回比較を出す（正答率保存のテストは問題数に戻せる場合のみ）
                    const prevCorrect = prev ? (mx === 100 ? null : prev.score) : null;
                    const wait = waitText(s.retryAt);
                    return (
                        <article key={t.key} className={"tq-card tq-" + s.status + (isOpen ? " open" : "")}>
                            <div className="tq-row">
                                <span className="tq-ico" style={{ background: `${t.color}26`, borderColor: `${t.color}66` }}>{t.icon}</span>
                                <div className="tq-mid">
                                    <div className="tq-name">{t.label}
                                        {s.status === "pass" && <em className="tq-badge g">✅ 合格</em>}
                                        {s.status === "fail" && <em className="tq-badge r">✕ 不合格</em>}
                                        {s.status === "none" && <em className="tq-badge n">未受験</em>}
                                    </div>
                                    <div className="tq-desc">{t.desc}<i>{t.rewardText}</i></div>
                                    {s.at.length > 0 && s.last && (
                                        <div className="tq-stats">
                                            <span>📊 受験 <b>{s.at.length}回</b></span>
                                            <span>🏆 最高 <b>{s.best}/{mx}</b></span>
                                            <span>🗓️ 前回 <b>{s.last.score}/{mx}</b></span>
                                            <span className="d">{formatDate(s.last.created_at)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="tq-side">
                                    {s.best !== null && (
                                        <div className={"tq-score" + (s.status === "pass" ? " g" : "")}>
                                            {s.status === "pass" && <img src={TEST_IMG.crown} alt="" />}
                                            <b>{s.status === "pass" ? s.best : s.last?.score}</b><i>/{mx}</i>
                                        </div>
                                    )}
                                    {s.status === "none" && <button className="tq-btn" onClick={() => router.push(t.path)}><img src={TEST_IMG.challenge} alt="" />挑戦する</button>}
                                    {s.status === "pass" && !manual && <button className="tq-btn sub" onClick={() => toggle(t.key)}>📜 {isOpen ? "とじる" : "履歴を見る"}</button>}
                                    {s.status === "fail" && <button className="tq-btn" onClick={() => toggle(t.key)}><img src={TEST_IMG.book} alt="" />{isOpen ? "とじる" : "復習して再受験"}</button>}
                                </div>
                            </div>

                            {isOpen && (
                                <div className="tq-detail">
                                    {cur?.id
                                        ? <TestReview attemptId={cur.id} title={t.label} prevCorrect={prevCorrect} retryPath={s.status === "fail" ? t.path : undefined} retryAt={s.retryAt} />
                                        : <div className="tq-note">このテストは、問題ごとの結果表示にまだ対応していません（点数と履歴のみ表示します）
                                            {s.status === "fail" && <div style={{ marginTop: 10 }}><button className="tq-btn" disabled={!!wait} onClick={() => router.push(t.path)}>{wait ? `再受験は${wait}` : "もう一度挑戦する"}</button></div>}
                                        </div>}

                                    <div className="tq-hist">
                                        <div className="tq-hh">🗂️ 受験履歴（{s.at.length}回）</div>
                                        {s.at.map((a, i) => (
                                            <div key={a.id || i} className={"tq-hrow" + (cur === a ? " cur" : "")}>
                                                <button className="tq-hmain" onClick={() => a.id && setPick(a.id)} disabled={!a.id}>
                                                    <span className="d">{formatDate(a.created_at)}</span>
                                                    <b>{a.score}/{mx}</b>
                                                    <em className={a.passed ? "g" : "r"}>{a.passed ? "合格" : "不合格"}</em>
                                                    {a.written_evaluation && <em className="e">{EVAL_LABEL[a.written_evaluation] || ""}{a.written_points_awarded ? `（+${a.written_points_awarded}pt）` : ""}</em>}
                                                </button>
                                                {a.written_answers && <button className="tq-wbtn" onClick={() => setShowW(showW === (a.id || String(i)) ? null : (a.id || String(i)))}>記述回答 {showW === (a.id || String(i)) ? "▲" : "▼"}</button>}
                                                {showW === (a.id || String(i)) && a.written_answers && (
                                                    <div className="tq-written">
                                                        {(Array.isArray(a.written_answers)
                                                            ? a.written_answers.map((w: any, j: number) => (typeof w === "string" ? [`記述${j + 1}`, w] : [w?.question || `記述${j + 1}`, w?.answer || ""]))
                                                            : Object.entries(a.written_answers as Record<string, string>)
                                                        ).map(([q, ans]: any, j: number) => <div key={j}><b>{String(q)}</b><p>{String(ans || "（未回答）")}</p></div>)}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </article>
                    );
                })}
            </main>
        </div>
    );
}

const CSS = `
.tq-root{min-height:100vh;min-height:100dvh;background:#7fc3ef url(/images/onboarding/job-selection-bg.webp) center 22%/cover no-repeat fixed;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416;padding:14px 14px calc(44px + env(safe-area-inset-bottom));box-sizing:border-box}
.tq-head{max-width:1180px;margin:0 auto;display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.tq-left,.tq-right{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:8px}
.tq-back{border:2px solid #F5D77E;background:rgba(255,249,237,.96);color:#102F70;font-weight:900;font-size:12.5px;border-radius:999px;padding:10px 15px;cursor:pointer;min-height:44px}
.tq-logo{font-family:Georgia,"Times New Roman",serif;font-size:21px;line-height:1.05;font-weight:700;letter-spacing:2px;color:#f6dc9a;text-shadow:0 2px 0 #7a5516,0 3px 8px rgba(16,47,112,.55)}
.tq-sign{border-radius:22px;padding:13px 56px 15px;background:linear-gradient(180deg,#3f66b8,#1d3a82 55%,#162c66);border:3px solid #F5D77E;box-shadow:0 0 0 2px #b98a35,0 6px 0 #0d1c45,0 14px 26px rgba(16,47,112,.45),inset 0 2px 0 rgba(255,255,255,.35);font-size:34px;font-weight:900;color:#fff;letter-spacing:5px;text-shadow:0 2px 0 #0a1f4a;white-space:nowrap}
.tq-copy{max-width:1180px;margin:-4px auto 0;text-align:center;position:relative;z-index:1}
.tq-copy span{display:inline-block;background:linear-gradient(180deg,#fffdf6,#f3e9d2);color:#4a3b1c;border:2px solid #e2c98c;border-radius:6px;padding:6px 34px;font-size:15px;font-weight:900;letter-spacing:1px;box-shadow:0 4px 10px rgba(16,47,112,.25)}
.tq-tabs{max-width:1180px;margin:16px auto 0;display:flex;gap:12px;justify-content:center;position:relative;z-index:2}
.tq-tab{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;border:3px solid #D9A441;border-radius:999px;padding:11px 20px;font-size:15.5px;font-weight:900;cursor:pointer;background:linear-gradient(180deg,#fffef9,#f3ead6);color:#3b3524;box-shadow:0 0 0 2px #fff6dc inset,0 5px 12px rgba(16,47,112,.3);min-height:48px}
.tq-tab span{font-size:19px}
.tq-tab i{font-style:normal;font-size:13px;color:#8a6a3a;margin-left:2px}
.tq-tab.on{background:linear-gradient(180deg,#3d8af0,#1554c4 55%,#0f3f9c);border-color:#F5D77E;color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.35) inset,0 0 22px rgba(90,160,255,.95),0 5px 12px rgba(16,47,112,.4)}
.tq-tab.on i{color:#dbe7ff}
.tq-main{max-width:1180px;margin:-24px auto 0;padding:44px 22px 22px;border-radius:14px;background:linear-gradient(180deg,rgba(38,52,104,.93),rgba(27,38,82,.95));border:3px solid #E8C876;box-shadow:0 0 0 2px #9c7430,inset 0 0 0 2px rgba(232,200,118,.35),0 14px 36px rgba(10,20,60,.45)}
.tq-card{background:linear-gradient(180deg,#fffdf6,#f8eed8);border:3px solid #e9d6a6;border-radius:16px;margin-bottom:12px;box-shadow:inset 0 0 0 2px #fff,0 5px 12px rgba(8,14,44,.35)}
.tq-card.open{border-color:#E8C876}
.tq-row{display:flex;align-items:center;gap:14px;padding:14px 16px}
.tq-ico{flex-shrink:0;width:62px;height:62px;border-radius:14px;border:2px solid;display:flex;align-items:center;justify-content:center;font-size:32px;background:#fff}
.tq-mid{flex:1;min-width:0}
.tq-name{font-size:20px;font-weight:900;color:#17307a;display:flex;align-items:center;gap:10px;flex-wrap:wrap;overflow-wrap:anywhere}
.tq-badge{font-style:normal;font-size:12.5px;font-weight:900;border-radius:999px;padding:3px 12px;color:#fff;white-space:nowrap}
.tq-badge.g{background:linear-gradient(180deg,#34c06b,#1c9a4e)}
.tq-badge.r{background:linear-gradient(180deg,#f0506e,#d42a4c)}
.tq-badge.n{background:#b9b2a0}
.tq-desc{font-size:13px;font-weight:700;color:#6b5a33;margin-top:2px}
.tq-desc i{font-style:normal;font-size:11.5px;color:#a16207;margin-left:10px;white-space:nowrap}
.tq-stats{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(217,164,65,.45);font-size:13px;color:#5b4a23;font-weight:700}
.tq-stats b{color:#23284a;font-size:14.5px}
.tq-stats .d{color:#8a7a55}
.tq-side{display:flex;align-items:center;gap:14px;flex-shrink:0}
.tq-score{position:relative;display:flex;align-items:baseline;justify-content:center;min-width:92px;padding:6px 14px;border-radius:999px;background:#fff;border:2px solid #e7dcc2;color:#2a2f52}
.tq-score b{font-size:28px;font-weight:900}
.tq-score i{font-style:normal;font-size:16px;font-weight:900}
.tq-score.g{border-color:#E8C876;background:linear-gradient(180deg,#fffdf0,#fbefc4);color:#8a5a0a;padding-left:46px}
.tq-score img{position:absolute;left:4px;top:50%;transform:translateY(-50%);width:40px;height:40px;object-fit:contain}
.tq-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:3px solid #F5D77E;background:linear-gradient(180deg,#3b78e0,#1454B8);color:#fff;font-weight:900;font-size:14.5px;border-radius:999px;padding:9px 20px;cursor:pointer;min-height:48px;white-space:nowrap;box-shadow:0 5px 12px rgba(16,47,112,.3)}
.tq-btn img{width:26px;height:26px;object-fit:contain}
.tq-btn.sub{background:linear-gradient(180deg,#fffdf4,#f1e1bd);color:#17397d;border-color:#D9A441}
.tq-btn:disabled{background:#cbbf9f;border-color:#e3d9bd;box-shadow:none;cursor:not-allowed}
.tq-detail{padding:0 16px 16px}
.tq-note{background:#fff;border:2px dashed #d9c489;border-radius:12px;padding:14px;font-size:13px;font-weight:800;color:#6b5a33;text-align:center;margin-top:10px}
.tq-hist{margin-top:14px;background:#fff;border:2px solid #ead9b0;border-radius:14px;padding:10px 12px}
.tq-hh{font-size:13.5px;font-weight:900;color:#2a2f52;margin-bottom:6px}
.tq-hrow{border-top:1px dashed rgba(217,164,65,.5);padding:4px 0}
.tq-hrow.cur{background:#f2f6ff;border-radius:8px}
.tq-hmain{display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap;border:none;background:none;padding:8px 6px;cursor:pointer;font-size:13px;color:#4b4530;min-height:44px;text-align:left}
.tq-hmain:disabled{cursor:default}
.tq-hmain b{font-size:15px;color:#23284a}
.tq-hmain em{font-style:normal;font-size:11.5px;font-weight:900;border-radius:999px;padding:2px 9px}
.tq-hmain em.g{background:#e1f6e6;color:#166534}.tq-hmain em.r{background:#fdecee;color:#b4233f}.tq-hmain em.e{background:#eef2ff;color:#3730a3}
.tq-wbtn{border:1.5px solid #d9c489;background:#fffaf0;color:#8a6a3a;font-size:12px;font-weight:900;border-radius:999px;padding:6px 12px;cursor:pointer;margin-left:6px;min-height:36px}
.tq-written{margin:6px 6px 8px;background:#fbf8f0;border-radius:10px;padding:10px 12px}
.tq-written b{display:block;font-size:12.5px;color:#1f4fb0;margin-top:8px;overflow-wrap:anywhere}
.tq-written b:first-child{margin-top:0}
.tq-written p{margin:3px 0 0;font-size:13.5px;line-height:1.7;color:#2a2f52;white-space:pre-wrap;overflow-wrap:anywhere}
@media (max-width:820px){
  .tq-root{padding:10px 10px calc(40px + env(safe-area-inset-bottom))}
  .tq-head{flex-wrap:wrap;align-items:center}
  .tq-left{flex-direction:row;align-items:center}
  .tq-right{display:none}
  .tq-logo{font-size:12px;letter-spacing:1px}
  .tq-sign{order:3;width:100%;box-sizing:border-box;text-align:center;font-size:22px;letter-spacing:3px;padding:8px 10px 10px}
  .tq-copy{margin-top:8px}
  .tq-copy span{font-size:11.5px;padding:5px 10px;letter-spacing:0}
  .tq-tabs{justify-content:flex-start;overflow-x:auto;gap:8px;margin-top:12px;padding:4px 2px 10px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
  .tq-tabs::-webkit-scrollbar{display:none}
  .tq-tab{font-size:13.5px;padding:9px 14px;flex-shrink:0}
  .tq-main{margin-top:0;padding:12px 8px}
  .tq-row{flex-wrap:wrap;padding:12px;gap:10px}
  .tq-ico{width:48px;height:48px;font-size:25px}
  .tq-mid{flex-basis:calc(100% - 60px)}
  .tq-name{font-size:16.5px;gap:6px}
  .tq-desc i{display:block;margin-left:0}
  .tq-side{width:100%;justify-content:space-between}
  .tq-side .tq-btn{flex:1}
  .tq-detail{padding:0 8px 12px}
}
`;
