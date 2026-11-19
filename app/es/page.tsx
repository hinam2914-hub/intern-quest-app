"use client";
// 総合ES。見た目を王国RPG調にしただけで、データは従来のまま：
// ・保存先 user_es（1人1行・20項目）／保存のたびに user_es_history に1行
// ・ポイント：20項目すべて記入して初めて保存した時 +100pt（1回だけ）／完成後、前回保存と違う月に保存すると +20pt
// ・5カテゴリの入力は1つの state に持つので、タブを切り替えても入力は消えない。保存は全カテゴリまとめて行う

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type EsData = {
    gakuchika_what: string;
    gakuchika_goal: string;
    gakuchika_issue: string;
    gakuchika_improvement: string;
    gakuchika_result: string;
    axis_industry: string;
    axis_industry_why: string;
    axis_role: string;
    axis_role_why: string;
    axis_other: string;
    axis_other_why: string;
    goal_value: string;
    goal_role: string;
    goal_why: string;
    goal_skills: string;
    pr_strength: string;
    pr_experience: string;
    pr_reproducibility: string;
    failure_what: string;
    failure_overcome: string;
};

const INITIAL_ES: EsData = {
    gakuchika_what: "", gakuchika_goal: "", gakuchika_issue: "", gakuchika_improvement: "", gakuchika_result: "",
    axis_industry: "", axis_industry_why: "", axis_role: "", axis_role_why: "", axis_other: "", axis_other_why: "",
    goal_value: "", goal_role: "", goal_why: "", goal_skills: "",
    pr_strength: "", pr_experience: "", pr_reproducibility: "",
    failure_what: "", failure_overcome: ""
};

const REQUIRED_FIELDS: (keyof EsData)[] = Object.keys(INITIAL_ES) as (keyof EsData)[];

function isComplete(data: EsData): boolean {
    return REQUIRED_FIELDS.every(key => (data[key] || "").trim().length > 0);
}

function getYearMonth(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function EsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userId, setUserId] = useState("");
    const [name, setName] = useState("");
    const [es, setEs] = useState<EsData>(INITIAL_ES);
    const [firstCompletedAt, setFirstCompletedAt] = useState<string | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    const [activeSection, setActiveSection] = useState<1 | 2 | 3 | 4 | 5>(1);
    const [error, setError] = useState("");
    const [savedJson, setSavedJson] = useState(JSON.stringify(INITIAL_ES));   // 最後に保存できた内容（未保存の判定用）
    const lock = useRef(false);
    const formRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);

            const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
            setName(profile?.name || "");

            const { data: esRow } = await supabase.from("user_es").select("*").eq("user_id", user.id).maybeSingle();
            if (esRow) {
                const row: any = esRow;
                setEs({
                    gakuchika_what: row.gakuchika_what || "",
                    gakuchika_goal: row.gakuchika_goal || "",
                    gakuchika_issue: row.gakuchika_issue || "",
                    gakuchika_improvement: row.gakuchika_improvement || "",
                    gakuchika_result: row.gakuchika_result || "",
                    axis_industry: row.axis_industry || "",
                    axis_industry_why: row.axis_industry_why || "",
                    axis_role: row.axis_role || "",
                    axis_role_why: row.axis_role_why || "",
                    axis_other: row.axis_other || "",
                    axis_other_why: row.axis_other_why || "",
                    goal_value: row.goal_value || "",
                    goal_role: row.goal_role || "",
                    goal_why: row.goal_why || "",
                    goal_skills: row.goal_skills || "",
                    pr_strength: row.pr_strength || "",
                    pr_experience: row.pr_experience || "",
                    pr_reproducibility: row.pr_reproducibility || "",
                    failure_what: row.failure_what || "",
                    failure_overcome: row.failure_overcome || "",
                });
                setFirstCompletedAt(row.first_completed_at);
                setLastUpdatedAt(row.last_updated_at);
                const snap: any = {}; (Object.keys(INITIAL_ES) as (keyof EsData)[]).forEach((k) => { snap[k] = row[k] || ""; });
                setSavedJson(JSON.stringify(snap));
            }
            setLoading(false);
        };
        load();
    }, [router]);

    const handleSave = async () => {
        if (lock.current) return;          // 二重押しでポイントが2回付かないように
        lock.current = true;
        setSaving(true);
        setMessage(""); setError("");
        const fail = (m: string) => { setError("保存できませんでした。入力内容はそのまま残っています。通信状況を確認して、もう一度「保存する」を押してください。（" + m + "）"); };
        try {
            const nowIso = new Date().toISOString();
            const currentlyComplete = isComplete(es);
            let awardedPoints = 0;
            let pointReason = "";

            const { data: existing, error: readErr } = await supabase.from("user_es").select("*").eq("user_id", userId).maybeSingle();
            if (readErr) { fail(readErr.message); return; }

            if (!existing) {
                // 新規作成
                const payload: any = { ...es, user_id: userId, last_updated_at: nowIso, total_updates: 1 };
                if (currentlyComplete) {
                    payload.first_completed_at = nowIso;
                    awardedPoints = 100;
                    pointReason = "es_first_completed";
                }
                const { error: insErr } = await supabase.from("user_es").insert(payload);
                if (insErr) { fail(insErr.message); return; }
                await supabase.from("user_es_history").insert({ user_id: userId });
            } else {
                // 更新
                const wasComplete = !!existing.first_completed_at;
                const payload: any = { ...es, last_updated_at: nowIso, total_updates: (existing.total_updates || 0) + 1 };

                if (!wasComplete && currentlyComplete) {
                    payload.first_completed_at = nowIso;
                    awardedPoints = 100;
                    pointReason = "es_first_completed";
                } else if (wasComplete) {
                    // 月1アップデート判定
                    const lastYm = existing.last_updated_at ? getYearMonth(new Date(existing.last_updated_at)) : "";
                    const nowYm = getYearMonth(new Date());
                    if (lastYm !== nowYm) {
                        awardedPoints = 20;
                        pointReason = "es_monthly_update";
                    }
                }
                const { error: updErr } = await supabase.from("user_es").update(payload).eq("user_id", userId);
                if (updErr) { fail(updErr.message); return; }
                await supabase.from("user_es_history").insert({ user_id: userId });
            }
            setSavedJson(JSON.stringify(es));

            // ポイント付与
            if (awardedPoints > 0) {
                const { data: pt } = await supabase.from("user_points").select("points").eq("id", userId).single();
                const newPoints = ((pt as any)?.points || 0) + awardedPoints;
                await supabase.from("user_points").upsert({ id: userId, points: newPoints });
                await supabase.from("points_history").insert({ user_id: userId, change: awardedPoints, reason: pointReason });
            }

            // 再取得
            const { data: updated } = await supabase.from("user_es").select("*").eq("user_id", userId).maybeSingle();
            if (updated) {
                setFirstCompletedAt((updated as any).first_completed_at);
                setLastUpdatedAt((updated as any).last_updated_at);
            }

            setMessage(awardedPoints > 0 ? `保存しました！ +${awardedPoints}pt 獲得` : "保存しました");
        } catch (e: any) {
            fail(e?.message || "通信エラー");
        } finally {
            setSaving(false); lock.current = false;
        }
    };

    const dirty = JSON.stringify(es) !== savedJson;
    // 未保存のままページを閉じる・再読み込みする時は、ブラウザの確認を出す
    useEffect(() => {
        if (!dirty) return;
        const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
        window.addEventListener("beforeunload", h);
        return () => window.removeEventListener("beforeunload", h);
    }, [dirty]);
    // 入力欄の高さを内容に合わせる（タブを切り替えた時・読み込み後）
    useEffect(() => {
        formRef.current?.querySelectorAll("textarea").forEach((t) => { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; });
    }, [activeSection, loading]);

    if (loading) return <main className="es-root es-loading"><style>{CSS}</style>読み込み中…</main>;

    const filledCount = REQUIRED_FIELDS.filter(k => (es[k] || "").trim().length > 0).length;
    const progress = Math.round((filledCount / REQUIRED_FIELDS.length) * 100);
    const leave = (path: string) => { if (dirty && !window.confirm("保存していない入力があります。このまま移動しますか？")) return; router.push(path); };
    const go = (n: number) => { setActiveSection(n as 1 | 2 | 3 | 4 | 5); setMessage(""); window.scrollTo({ top: Math.max(0, (formRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 90), behavior: "smooth" }); };

    const field = (key: keyof EsData, label: string, placeholder: string = "", rows: number = 3) => (
        <div className="es-f" key={key}>
            <label htmlFor={"es-" + key}><i aria-hidden>✒</i>{label}</label>
            <textarea id={"es-" + key} value={es[key]} rows={rows} placeholder={placeholder} disabled={saving}
                onChange={(e) => { const t = e.target; setEs(prev => ({ ...prev, [key]: t.value })); setMessage(""); t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; }} />
        </div>
    );
    const TABS = [
        { n: 1, label: "ガクチカ", img: "/es/cat_gakuchika.webp", keys: ["gakuchika_what", "gakuchika_goal", "gakuchika_issue", "gakuchika_improvement", "gakuchika_result"] },
        { n: 2, label: "就活の軸", img: "/es/cat_axis.webp", keys: ["axis_industry", "axis_industry_why", "axis_role", "axis_role_why", "axis_other", "axis_other_why"] },
        { n: 3, label: "将来像", img: "/es/cat_future.webp", keys: ["goal_value", "goal_role", "goal_why", "goal_skills"] },
        { n: 4, label: "自己PR", img: "/es/cat_pr.webp", keys: ["pr_strength", "pr_experience", "pr_reproducibility"] },
        { n: 5, label: "失敗経験", img: "/es/cat_failure.webp", keys: ["failure_what", "failure_overcome"] },
    ] as { n: 1 | 2 | 3 | 4 | 5; label: string; img: string; keys: (keyof EsData)[] }[];
    const NUM = ["", "①", "②", "③", "④", "⑤"];
    const head = (title: string, sub: string) => (
        <div className="es-ph"><img className="ic" src={TABS[activeSection - 1].img} alt="" /><div><h2>{title}</h2><p>{sub}</p></div><img className="deco" src="/es/deco_books.webp" alt="" /></div>
    );

    return (
        <main className="es-root">
            <style>{CSS}</style>
            <div className="es-wrap">
                <button className="es-brand" onClick={() => leave("/home")}>INTERN QUEST</button>
                <div className="es-title"><img src="/es/title_ribbon.webp" alt="" /><h1>総合ES</h1></div>
                <div className="es-name"><small>あなたの経験を、未来につながる物語に。</small><b>{name ? `${name}さんのエントリーシート` : "エントリーシート"}</b></div>

                <div className="es-top">
                    <section className="es-prog">
                        <div className="es-prog-h"><b>記入進捗</b><span>{filledCount} / {REQUIRED_FIELDS.length}<em>（{progress}%）</em></span></div>
                        <div className="es-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress}%` }} /></div>
                        {(firstCompletedAt || lastUpdatedAt) && (
                            <div className="es-dates">
                                {firstCompletedAt && <span>初回完成：{new Date(firstCompletedAt).toLocaleDateString("ja-JP")}</span>}
                                {lastUpdatedAt && <span>最終更新：{new Date(lastUpdatedAt).toLocaleString("ja-JP")}</span>}
                            </div>
                        )}
                    </section>
                    <section className="es-reward">
                        <img src="/island/deco/deco_takarabako.webp" alt="" />
                        <div><p>初回完成で <b>+100pt</b></p><p>月1アップデートで <b>+20pt</b></p></div>
                    </section>
                </div>

                <div className="es-tabs" role="tablist" aria-label="ESのカテゴリ">
                    {TABS.map(t => {
                        const done = t.keys.filter(k => (es[k] || "").trim().length > 0).length;
                        return (
                            <button key={t.n} role="tab" aria-selected={activeSection === t.n} className={`es-tab${activeSection === t.n ? " on" : ""}`} onClick={() => { setActiveSection(t.n); setMessage(""); }}>
                                <img src={t.img} alt="" /><span>{NUM[t.n]}{t.label}</span><small>{done === t.keys.length ? "✓" : `${done}/${t.keys.length}`}</small>
                            </button>
                        );
                    })}
                </div>

                <div className="es-panel" ref={formRef}>
                    {activeSection === 1 && (<>
                        {head("① 学生時代に力を入れたこと（ガクチカ）", "課題→改善→結果の流れで書きましょう")}
                        {field("gakuchika_what", "何を頑張ったのか", "例）長期インターンでの訪問販売の営業", 2)}
                        {field("gakuchika_goal", "目標（数字で分かるもの）", "例）フォロワー数・契約数など", 2)}
                        {field("gakuchika_issue", "課題", "当初は数件程度。分析の結果、課題が〇〇と〇〇だった。")}
                        {field("gakuchika_improvement", "改善", "〇〇の改善のため、△△を行い、〇〇の改善のため、▽▽をした。")}
                        {field("gakuchika_result", "結果", "何がどう変わってどんな成果に繋がったか（数字で）")}
                    </>)}
                    {activeSection === 2 && (<>
                        {head("② 就活の軸", "なぜそう思うかまで掘り下げましょう")}
                        {field("axis_industry", "どんな仕事（業界）に関わりたいか")}
                        {field("axis_industry_why", "↑ なぜか")}
                        {field("axis_role", "その仕事の中でどんな業務に就きたいか")}
                        {field("axis_role_why", "↑ なぜか")}
                        {field("axis_other", "上記2つを満たす企業で他に大事にしたいこと")}
                        {field("axis_other_why", "↑ なぜか")}
                    </>)}
                    {activeSection === 3 && (<>
                        {head("③ 将来どうなりたいか", "原体験と接続して書きましょう")}
                        {field("goal_value", "どんな価値を出す人になりたいか")}
                        {field("goal_role", "どんな役割の人になりたいか")}
                        {field("goal_why", "なぜそうなりたいか（過去経験・成功体験・違和感）", "原体験と接続", 4)}
                        {field("goal_skills", "そのためにどんなスキル・経験が必要か", "スキル（営業力・分析力など）／経験（顧客対応・企画など）")}
                    </>)}
                    {activeSection === 4 && (<>
                        {head("④ 自己PR", "「あなたはどんな人？」の核心")}
                        {field("pr_strength", "強み")}
                        {field("pr_experience", "それが発揮された経験")}
                        {field("pr_reproducibility", "再現性（仕事でも活きるか）")}
                    </>)}
                    {activeSection === 5 && (<>
                        {head("⑤ 失敗経験・挫折経験", "再現性と耐性を見られます")}
                        {field("failure_what", "何が失敗だったか", "", 4)}
                        {field("failure_overcome", "どう乗り越えたか", "", 4)}
                    </>)}
                </div>

                {error && <div className="es-err" role="alert">{error}</div>}
                {message && <div className="es-ok" role="status">✓ {message}</div>}
                {!message && !error && dirty && <div className="es-dirty">保存していない入力があります（カテゴリを切り替えても入力は残ります）</div>}

                <div className="es-btns">
                    {activeSection > 1 && <button className="es-sub" onClick={() => go(activeSection - 1)}>← 前へ</button>}
                    <button className="es-save" onClick={handleSave} disabled={saving}>{saving ? "保存中…" : "保存する"}</button>
                    {activeSection < 5 && <button className="es-sub" onClick={() => go(activeSection + 1)}>次へ →</button>}
                </div>
                <button className="es-back" onClick={() => leave("/menu")}>メニューへ戻る</button>
            </div>

            <div className="es-nav">
                <div className="band" />
                {[{ k: "home", l: "ホーム", h: "/home", img: "/home/nav_home_active.webp" }, { k: "rank", l: "ランキング", h: "/ranking", img: "/home/nav_trophy.webp" }, { k: "house", l: "おうち", h: "/mypage", img: "/home/nav_house.webp" }, { k: "menu", l: "メニュー", h: "/menu", img: "" }].map((t) => (
                    <button key={t.k} onClick={() => leave(t.h)}>{t.img ? <img src={t.img} alt="" /> : <span>☰</span>}<i>{t.l}</i></button>
                ))}
            </div>
        </main>
    );
}

const CSS = `
.es-root{min-height:100vh;min-height:100dvh;overflow-x:clip;background:url(/home/bg_mobile.webp) center top / cover no-repeat fixed,#bfe3f5;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#23284a;padding:10px 10px calc(108px + env(safe-area-inset-bottom));box-sizing:border-box}
@media (min-width:700px){ .es-root{background-image:url(/home/bg_pc.webp);padding-top:18px} }
.es-root *{box-sizing:border-box}
.es-loading{display:flex;align-items:center;justify-content:center;font-weight:900;color:#17397d}
.es-wrap{max-width:980px;margin:0 auto}
.es-brand{display:block;margin:0 auto 6px;border:none;background:none;color:#b98a1e;font-size:12px;font-weight:900;letter-spacing:.28em;cursor:pointer;min-height:28px;font-family:inherit;text-shadow:0 1px 0 #fff}
.es-title{position:relative;max-width:620px;margin:0 auto;container-type:inline-size}
.es-title img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 12px rgba(16,47,112,.35))}
.es-title h1{position:absolute;left:30%;right:19%;top:27%;bottom:37%;margin:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:clamp(20px,8.2cqw,52px);font-weight:900;letter-spacing:.12em;text-shadow:0 2px 4px rgba(10,25,70,.6);white-space:nowrap;line-height:1}
.es-name{position:relative;width:fit-content;max-width:100%;margin:-4.5% auto 0;padding:7px 24px 8px;background:linear-gradient(180deg,#fffdf6,#f8eed8);border:2px solid #e2bf63;border-radius:18px;box-shadow:0 4px 10px rgba(16,47,112,.2);text-align:center;overflow-wrap:anywhere}
.es-name small{display:block;font-size:clamp(11.5px,3.1vw,13px);font-weight:800;color:#8a6a1e;letter-spacing:.03em}
.es-name b{display:block;font-size:15px;font-weight:900;color:#17307a;margin-top:1px}
@media (min-width:700px){ .es-name{margin-top:-30px} }
.es-top{display:flex;gap:12px;margin-top:14px;align-items:stretch}
.es-prog{flex:1;min-width:0;background:linear-gradient(180deg,#fffefa,#f8eed8);border:3px solid #e2bf63;border-radius:18px;padding:14px 20px;box-shadow:inset 0 0 0 2px #fff,0 6px 14px rgba(16,47,112,.2)}
.es-prog-h{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.es-prog-h b{font-size:16px;font-weight:900;color:#17397d}
.es-prog-h span{font-size:17px;font-weight:900;color:#23284a;white-space:nowrap}
.es-prog-h em{font-style:normal;font-size:14px;margin-left:2px}
.es-bar{height:12px;margin-top:9px;border-radius:999px;background:#e6dcc0;overflow:hidden;box-shadow:inset 0 1px 3px rgba(80,60,10,.25)}
.es-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#3b78e0,#1746b0);transition:width .3s}
.es-dates{display:flex;gap:4px 14px;flex-wrap:wrap;margin-top:8px;font-size:11.5px;font-weight:700;color:#7a6a45}
.es-reward{display:flex;align-items:center;gap:12px;padding:10px 20px 10px 14px;background:linear-gradient(180deg,#2a4aa6,#172f78);border:3px solid #f1cf6b;border-radius:18px;box-shadow:inset 0 0 0 2px rgba(255,255,255,.14),0 6px 14px rgba(16,47,112,.3);color:#fff}
.es-reward img{width:58px;height:58px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 3px 5px rgba(0,0,0,.35))}
.es-reward p{margin:2px 0;font-size:13.5px;font-weight:800;white-space:nowrap}
.es-reward b{color:#ffd95e;font-size:16px;font-weight:900}
.es-tabs{display:flex;gap:8px;margin-top:14px;overflow-x:auto;padding:4px 2px 8px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.es-tabs::-webkit-scrollbar{display:none}
.es-tab{flex:1 0 auto;display:flex;align-items:center;justify-content:center;gap:6px;min-height:50px;padding:7px 12px 7px 10px;border:2.5px solid #e2c98c;border-radius:999px;background:linear-gradient(180deg,#fff,#fbf2de);color:#2a2f52;font-size:14.5px;font-weight:900;cursor:pointer;white-space:nowrap;font-family:inherit;box-shadow:0 3px 7px rgba(120,80,20,.16)}
.es-tab img{width:28px;height:28px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 1px 2px rgba(0,0,0,.2))}
.es-tab small{font-size:11px;font-weight:900;color:#8a6a1e;background:#f6e7bd;border-radius:999px;padding:1px 7px}
.es-tab.on{background:linear-gradient(180deg,#3b78e0,#1746b0);border-color:#f5d77e;color:#fff;box-shadow:0 0 0 2px #1746b0,0 5px 12px rgba(16,47,112,.4)}
.es-tab.on small{background:rgba(255,255,255,.22);color:#fff}
.es-panel{margin-top:6px;background:linear-gradient(180deg,#fffdf6,#f8eed8);border:3px solid #e2bf63;border-radius:22px;padding:20px 26px 12px;box-shadow:inset 0 0 0 2px #fff,0 12px 28px rgba(16,47,112,.3)}
.es-ph{display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #ecd9a6}
.es-ph>div{flex:1;min-width:0}
.es-ph .ic{width:52px;height:52px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 3px 5px rgba(16,47,112,.25))}
.es-ph .deco{width:150px;height:auto;flex-shrink:0;margin:-14px -6px -12px 0;filter:drop-shadow(0 4px 6px rgba(16,47,112,.2))}
@media (max-width:820px){ .es-ph .deco{display:none} }
.es-ph h2{margin:0;font-size:19px;font-weight:900;color:#17307a;line-height:1.4}
.es-ph p{margin:2px 0 0;font-size:13px;font-weight:700;color:#7a6a45}
.es-f{display:grid;grid-template-columns:250px minmax(0,1fr);gap:6px 16px;align-items:start;margin-bottom:14px}
.es-f label{display:flex;gap:7px;font-size:15px;font-weight:900;color:#17307a;line-height:1.5;padding-top:11px}
.es-f label i{font-style:normal;color:#b98a1e;flex-shrink:0}
.es-f textarea{display:block;width:100%;min-height:52px;padding:12px 16px;border:2px solid #e3d3a4;border-radius:14px;background:#fff;color:#23284a;font-size:16px;line-height:1.75;font-family:inherit;resize:vertical;outline:none;box-shadow:inset 0 2px 4px rgba(120,80,20,.08);overflow:hidden}
.es-f textarea:focus{border-color:#2a4aa6;box-shadow:0 0 0 3px rgba(42,74,166,.16)}
.es-f textarea::placeholder{color:#a79f8e}
.es-f textarea:disabled{opacity:.7}
.es-err{margin-top:12px;padding:11px 14px;border:2px solid #f0a9b5;border-radius:12px;background:#fff5f5;color:#9f1d38;font-size:13.5px;font-weight:800;line-height:1.6;overflow-wrap:anywhere}
.es-ok{margin-top:12px;padding:12px 14px;border:2.5px solid #e2bf63;border-radius:14px;background:linear-gradient(180deg,#f2fff5,#dff6e6);color:#14602f;font-size:15px;font-weight:900;text-align:center}
.es-dirty{margin-top:12px;padding:9px 14px;border-radius:12px;background:rgba(255,253,246,.95);border:2px dashed #e2bf63;color:#7a5a12;font-size:12.5px;font-weight:800;text-align:center;line-height:1.6}
.es-btns{display:flex;gap:10px;margin-top:14px;align-items:stretch}
.es-save{flex:2;min-height:58px;padding:10px 18px;border:3px solid #f5d77e;border-radius:999px;background:linear-gradient(180deg,#5a63e6,#3a2fb5 55%,#2a2390);color:#fff;font-size:18px;font-weight:900;letter-spacing:.08em;cursor:pointer;font-family:inherit;box-shadow:inset 0 2px 0 rgba(255,255,255,.3),0 8px 18px rgba(16,47,112,.4);text-shadow:0 2px 3px rgba(10,25,70,.5)}
.es-save:disabled{background:linear-gradient(180deg,#8f9bb8,#6b7896);border-color:#d8d2bd;cursor:not-allowed}
.es-sub{flex:1;min-height:58px;padding:10px 12px;border:3px solid #e2bf63;border-radius:999px;background:linear-gradient(180deg,#fffdf6,#f6e9c6);color:#3a2f12;font-size:16px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 5px 12px rgba(16,47,112,.2);white-space:nowrap}
.es-back{display:block;margin:22px auto 0;min-height:44px;padding:8px 24px;border:2px solid #7f95d6;border-radius:999px;background:rgba(255,255,255,.92);color:#17397d;font-size:13.5px;font-weight:900;cursor:pointer;font-family:inherit}
.es-nav{position:fixed;left:0;bottom:0;width:100%;max-width:100vw;z-index:50;display:flex;height:calc(86px + env(safe-area-inset-bottom));padding:0 10px calc(10px + env(safe-area-inset-bottom));overflow:hidden}
.es-nav .band{position:absolute;inset:6px 8px calc(8px + env(safe-area-inset-bottom));background:url(/home/nav_bar.webp);background-size:100% 100%;pointer-events:none}
.es-nav button{position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;padding-bottom:calc(17px + env(safe-area-inset-bottom));background:transparent;border:none;cursor:pointer;color:#fff;font-family:inherit}
.es-nav img{height:30px}
.es-nav span{font-size:20px;line-height:30px}
.es-nav i{font-style:normal;font-size:10.5px;font-weight:800}
@media (max-width:820px){
  .es-f{grid-template-columns:1fr;gap:5px}
  .es-f label{padding-top:0}
}
@media (max-width:640px){
  .es-top{flex-direction:column;gap:10px}
  .es-prog{padding:12px 14px}
  .es-reward{padding:8px 14px}
  .es-reward img{width:48px;height:48px}
  .es-tabs{margin-left:-10px;margin-right:-10px;padding-left:10px;padding-right:10px}
  .es-tab{flex:0 0 auto}
  .es-panel{padding:16px 13px 6px;border-radius:18px}
  .es-ph .ic{width:42px;height:42px}
  .es-ph h2{font-size:17px}
  .es-btns{flex-wrap:wrap}
  .es-save{order:-1;flex:1 0 100%}
  .es-sub{min-height:52px}
}
`;
