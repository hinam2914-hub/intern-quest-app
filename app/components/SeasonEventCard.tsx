"use client";
// HOME のシーズンイベントカード。サーバー側の関数 event_sync()（season_event.sql）を呼ぶだけ。
// ボーナスの計算と付与はすべてサーバー側（実際の記録から計算・二重付与なし）。関数が未導入／開催していないときは何も出さない。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { sortByCourse } from "../lib/learnCourse";

type Ev = {
    active: boolean; key: string; name: string; subtitle: string | null; status: "upcoming" | "running" | "ended";
    starts_at: string; ends_at: string; multiplier: number; rookie_bonus?: number; new_points: number; bonus_total: number;
    counts: Record<string, number>; main_done: number; main_total: number; es_done: boolean;
    weapon_ready?: boolean; weapon_owned?: boolean; weapon_granted?: boolean; joined?: boolean; gear_granted?: string[]; gear_owned?: string[];
};
const md = (iso: string, shift = 0) => { const d = new Date(new Date(iso).getTime() + 9 * 3600e3 + shift); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };

/** いまのシーズンイベントの状態だけを軽く調べる（バッジ表示用）。未導入・開催なしは null */
export async function seasonEventBadge(): Promise<"開催中！" | "まもなく開催" | null> {
    try {
        const { data, error } = await supabase.from("season_events").select("starts_at, ends_at").eq("is_active", true).order("starts_at").limit(5);
        if (error || !data) return null;
        const now = Date.now();
        if ((data as any[]).some((e) => new Date(e.starts_at).getTime() <= now && now < new Date(e.ends_at).getTime())) return "開催中！";
        if ((data as any[]).some((e) => now < new Date(e.starts_at).getTime())) return "まもなく開催";
    } catch { /* 未導入 */ }
    return null;
}

/** 細い案内バナー（学習ページなど用）。開催前〜開催中だけ出て、押すとイベントの詳細ページへ */
export function SeasonEventBanner() {
    const router = useRouter();
    const [e, setE] = useState<{ name: string; label: string } | null>(null);
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const { data, error } = await supabase.from("season_events").select("name, starts_at, ends_at").eq("is_active", true).order("starts_at").limit(5);
                if (error || !data) return;
                const now = Date.now();
                const run = (data as any[]).find((x) => new Date(x.starts_at).getTime() <= now && now < new Date(x.ends_at).getTime());
                const up = (data as any[]).find((x) => now < new Date(x.starts_at).getTime());
                const x = run || up; if (!x || !alive) return;
                setE({ name: x.name, label: run ? `開催中・あと${Math.max(0, Math.ceil((new Date(x.ends_at).getTime() - now) / 86400e3))}日` : `${md(x.starts_at)}から開催` });
            } catch { /* 未導入 */ }
        })();
        return () => { alive = false; };
    }, []);
    if (!e) return null;
    return (
        <button className="sevb" onClick={() => router.push("/event")}>
            <style>{`.sevb{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;min-height:48px;margin-top:10px;padding:8px 14px;border-radius:999px;border:2px solid #e2bf63;background:linear-gradient(180deg,#2f5fc4,#1d3f96);color:#fff;cursor:pointer;font-family:inherit;text-align:left;box-shadow:0 5px 14px rgba(16,47,112,.28)}
.sevb .t{flex:none;font-size:10px;font-weight:900;letter-spacing:.1em;background:linear-gradient(180deg,#e25563,#b3202f);border:1px solid #ffd9dd;border-radius:999px;padding:3px 8px}
.sevb .m{flex:1;min-width:0;font-size:13px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sevb .m small{font-size:11px;font-weight:800;color:#ffe08a;margin-left:6px}
.sevb .g{flex:none;font-size:11.5px;font-weight:900;color:#ffe08a;white-space:nowrap}
@media (max-width:420px){.sevb .t{display:none}}`}</style>
            <span className="t">❄ EVENT</span>
            <span className="m">{e.name}：学習のポイント2倍<small>{e.label}</small></span>
            <span className="g">詳しく →</span>
        </button>
    );
}

/** silent=true：画面には何も出さず、イベントボーナスと達成報酬の受け取り（サーバー側の event_sync）だけ行う。HOME用 */
export default function SeasonEventCard({ onActive, silent }: { onActive?: (on: boolean) => void; silent?: boolean } = {}) {
    const router = useRouter();
    const [ev, setEv] = useState<Ev | null>(null);
    const [open, setOpen] = useState(false);          // ルール（折りたたみ）
    const [detail, setDetail] = useState<string | null>(null);   // 報酬の詳細（タップで開く）
    const [nextId, setNextId] = useState<string | null>(null);   // 次に見る学習コンテンツ
    const [barOn, setBarOn] = useState(false);
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const { data, error } = await supabase.rpc("event_sync");
                if (error || !data || !(data as Ev).active) return;
                if (!alive) return;
                setEv(data as Ev); onActive?.(true);
                setTimeout(() => { if (alive) setBarOn(true); }, 250);
                if (silent) return;
                // 次に見る1本（学習コンテンツの順番どおり。メインルートの未着手のうち最初のもの）
                const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
                const [cs, cp] = await Promise.all([
                    supabase.from("contents").select("*").eq("is_active", true),
                    supabase.from("content_completions").select("content_id, status").eq("user_id", user.id),
                ]);
                const seen = new Set(((cp.data ?? []) as any[]).filter((r) => r.status === "approved" || r.status === "pending").map((r) => r.content_id));
                const nx = sortByCourse(((cs.data ?? []) as any[]).filter((c) => /^s[1-6]$/.test(c.course_code || ""))).find((c) => !seen.has(c.id));
                if (alive) setNextId(nx ? nx.id : null);
            } catch { /* イベント未導入 */ }
        })();
        return () => { alive = false; };
    }, []);
    if (!ev || silent) return null;

    // ---- 日付はすべて日本時間で数える ----
    const J = 9 * 3600e3, DAY = 86400e3;
    const jd = (ms: number) => Math.floor((ms + J) / DAY);
    const today = jd(Date.now()), startD = jd(new Date(ev.starts_at).getTime()), lastD = jd(new Date(ev.ends_at).getTime() - 1);
    const wd = (iso: string, shift = 0) => { const d = new Date(new Date(iso).getTime() + J + shift); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${"日月火水木金土"[d.getUTCDay()]})`; };
    const remain = ev.status === "upcoming" ? `開催まであと${Math.max(1, startD - today)}日` : ev.status === "running" ? (lastD - today <= 0 ? "本日最終日！" : `終了まであと${lastD - today}日`) : "イベント終了";

    const mainAll = ev.main_total > 0 && ev.main_done >= ev.main_total;
    const pct = ev.main_total > 0 ? Math.round((ev.main_done / ev.main_total) * 100) : 0;
    const achieved = (mainAll ? 1 : 0) + (ev.es_done ? 1 : 0);
    const gear = ev.gear_owned || [];
    const hatOwn = gear.includes("event_santa_hat"), capeOwn = gear.includes("event_xmas_cape");
    const complete = mainAll && ev.es_done;
    const m = ev.multiplier;
    // 次のクエスト：進み具合から、やることを1つだけ出す
    const next = !mainAll ? { step: "学習", text: "未完了の学習コンテンツに挑戦しよう！", href: nextId ? `/learn?open=${nextId}` : "/learn" }
        : !ev.es_done ? { step: "ES", text: "ESを完成させて、聖夜のマントを手に入れよう！", href: "/es" }
        : { step: "テスト", text: "テストやチャレンジで、2倍のポイントを集めよう！", href: "/tests" };
    const rwState = (own: boolean, ok: boolean) => own ? { t: "✓ 獲得済み", c: "own" } : ev.status === "upcoming" ? { t: "開催前", c: "" } : ok ? { t: "まもなく届きます", c: "can" } : { t: "未達成", c: "" };
    const hatS = rwState(hatOwn, achieved >= 1), capeS = rwState(capeOwn, achieved >= 2);
    const granted = [...(ev.gear_granted || []).map((k) => (k === "event_santa_hat" ? "サンタ帽" : "聖夜のマント")), ...(ev.weapon_granted ? ["聖夜の杖"] : [])];
    const DECO = [["/island/deco/deco_santa.webp", "サンタ"], ["/island/animals/animal_tonakai.webp", "トナカイ"], ["/island/trees/tree_xmas.webp", "クリスマスツリー"], ["/island/deco/deco_present.webp", "プレゼントの山"]];
    const BUY = "買えるのは、期間中に学習コンテンツを1本以上見て完了報告を出した人か、学習メインルートをすでに全部修了している人です。";

    return (
        <div className="sev">
            <style>{CSS}</style>

            {/* 1) イベントバナー（イベント名は絵の中）＋ 開催期間のプレート */}
            <div className="sev-bn">
                <img src="/event/winter_main.webp" alt={ev.name} />
                <div className="sev-snow" aria-hidden>{Array.from({ length: 14 }).map((_, i) => <i key={i} style={{ left: `${(i * 7.3 + 3) % 100}%`, animationDelay: `${(i * 0.83) % 7}s`, animationDuration: `${7 + (i % 5)}s`, width: 4 + (i % 3) * 2, height: 4 + (i % 3) * 2 }} />)}</div>
            </div>
            <div className="sev-plate"><span>開催期間</span><b>{wd(ev.starts_at)}〜{wd(ev.ends_at, -1000)}</b><em className={ev.status}>{remain}</em></div>

            <div className="sev-body">
                {granted.length > 0 && <div className="sev-get" role="status">🎉 達成おめでとう！ <b>{granted.join("・")}</b> を受け取りました</div>}
                {ev.status !== "upcoming" && ev.new_points > 0 && <div className="sev-get" role="status">イベントボーナス <b>+{ev.new_points}pt</b> を受け取りました</div>}

                {/* 2) ポイント2倍の告知 */}
                <div className="sev-catch">
                    <div className="c1"><span>学ぶほど強くなる、</span><span>冬だけのお祭り</span></div>
                    <div className="c2"><span>学習コンテンツ・ES・</span><span>テスト・チャレンジの</span><span>ポイントが <b>{m}倍！</b></span></div>
                </div>

                {/* 3) 限定報酬 */}
                <div className="sev-rw">
                    <section className="sev-rc">
                        <h4>限定武器</h4>
                        <button className="sev-item big" onClick={() => setDetail(detail === "weapon" ? null : "weapon")} aria-expanded={detail === "weapon"}>
                            <span className="im"><img src="/battle/weapons/wisdom_staff.webp" alt="" /></span>
                            <span className="nm">聖夜の杖</span>
                            <span className={"st " + (ev.weapon_owned ? "own" : "")}>{ev.weapon_owned ? "✓ 獲得済み" : "未所持"}</span>
                        </button>
                    </section>
                    <section className="sev-rc">
                        <h4>達成報酬</h4>
                        <div className="sev-two">
                            <button className="sev-item" onClick={() => setDetail(detail === "hat" ? null : "hat")} aria-expanded={detail === "hat"}>
                                <span className="im"><img src="/event/reward_hat.webp" alt="" /></span><span className="nm">サンタ帽</span><span className={"st " + hatS.c}>{hatS.t}</span>
                            </button>
                            <button className="sev-item" onClick={() => setDetail(detail === "cape" ? null : "cape")} aria-expanded={detail === "cape"}>
                                <span className="im"><img src="/event/reward_cape.webp" alt="" /></span><span className="nm">聖夜のマント</span><span className={"st " + capeS.c}>{capeS.t}</span>
                            </button>
                        </div>
                    </section>
                    <section className="sev-rc">
                        <h4>島の限定デコ</h4>
                        <button className="sev-item big" onClick={() => setDetail(detail === "deco" ? null : "deco")} aria-expanded={detail === "deco"}>
                            <span className="sev-deco">{DECO.map(([src, n]) => <img key={n} src={src} alt={n} />)}</span>
                            <span className="nm">サンタ・トナカイ・ツリー・プレゼント</span>
                            <span className="st">期間中だけショップに登場</span>
                        </button>
                    </section>
                </div>
                {detail && (
                    <div className="sev-dt" role="region">
                        {detail === "weapon" && <><b>聖夜の杖（島バトルの武器）</b><p>学習コンテンツを1本修了するごとに攻撃力+1（40→最大60）。この杖で城を落とすと、奪えるポイントが1.5倍。</p><p>期間中だけショップで800pt。{BUY}「学習メインルート制覇」か「ES完成」を達成した人は、無料でもらえます。</p>{!ev.weapon_owned && <button className="sev-mini" onClick={() => router.push("/shop")}>ショップで見る →</button>}</>}
                        {detail === "hat" && <><b>サンタ帽（アバターの頭装備）</b><p>達成条件：「学習メインルート（STEP1〜6）制覇」か「ES完成」のどちらか。達成すると自動で届き、どの職業でも着けられます。</p>{hatOwn && <button className="sev-mini" onClick={() => router.push("/onboarding/avatar?from=mypage")}>アバター編集で着ける →</button>}</>}
                        {detail === "cape" && <><b>聖夜のマント（アバターのマント）</b><p>達成条件：「学習メインルート（STEP1〜6）制覇」と「ES完成」の両方。達成すると自動で届き、どの職業でも着けられます。</p>{capeOwn && <button className="sev-mini" onClick={() => router.push("/onboarding/avatar?from=mypage")}>アバター編集で着ける →</button>}</>}
                        {detail === "deco" && <><b>島に置けるクリスマスの飾り</b><p>サンタ・クリスマスツリー・トナカイ・プレゼントの山が、期間中だけショップの「島」に並びます。買った飾りは、イベントが終わっても島に置けます。</p><p>{BUY}</p><button className="sev-mini" onClick={() => router.push("/shop")}>ショップで見る →</button></>}
                    </div>
                )}

                {/* 4) イベントの進め方 */}
                <div className="sev-how">
                    <h4>イベントの進め方</h4>
                    <ol>
                        <li><i>1</i><img src="/tests/book.webp" alt="" /><span>学習・ES・テスト・<br />チャレンジに取り組む</span></li>
                        <li><i>2</i><span className="coin" aria-hidden><u>P</u><s>×{m}</s></span><span>期間中はポイントが<br /><b>{m}倍！</b></span></li>
                        <li><i>3</i><img src="/island/deco/deco_present.webp" alt="" /><span>限定報酬をGET！</span></li>
                    </ol>
                </div>

                {/* 5) あなたのイベント進捗 */}
                <div className="sev-prog">
                    <h4>あなたのイベント進捗</h4>
                    <div className="sev-row"><span><i className={mainAll ? "ck on" : "ck"} />学習メインルート（STEP1〜6）</span><b>{ev.main_done} / {ev.main_total}本（{pct}%）</b></div>
                    <div className="sev-bar"><i style={{ width: barOn ? `${pct}%` : 0 }} /></div>
                    <div className="sev-row"><span><i className={ev.es_done ? "ck on" : "ck"} />ES</span><b>{ev.es_done ? "完成" : "未完成"}</b></div>
                    <div className="sev-row"><span><i className={ev.weapon_owned ? "ck on" : "ck"} />限定武器「聖夜の杖」</span><b>{ev.weapon_owned ? "獲得済み" : "未所持"}</b></div>
                    <div className="sev-row"><span><i className={hatOwn && capeOwn ? "ck on" : "ck"} />達成報酬</span><b>{(hatOwn ? 1 : 0) + (capeOwn ? 1 : 0)} / 2（サンタ帽 {hatOwn ? "✓" : "—"}・マント {capeOwn ? "✓" : "—"}）</b></div>
                    {ev.status !== "upcoming" && <div className="sev-row"><span><i className={ev.bonus_total > 0 ? "ck on" : "ck"} />受け取ったイベントボーナス</span><b>+{ev.bonus_total}pt</b></div>}
                </div>

                {/* 6) 次のクエスト */}
                {ev.status === "upcoming" && (
                    <div className="sev-next wait"><small>次のクエスト</small><div className="t">{wd(ev.starts_at).replace(/\(.*/, "").replace("/", "月")}日スタート！</div><p>はじまったら、ここに次にやることが1つだけ出ます。ボタンを押して進めるだけでOK。</p></div>
                )}
                {ev.status === "running" && !complete && (
                    <div className="sev-next"><small>次のクエスト</small><div className="t">{next.text}</div>
                        <button className="sev-btn" onClick={() => router.push(next.href)}>次のクエストへ進む →</button>
                    </div>
                )}
                {ev.status === "running" && complete && (
                    <div className="sev-next done">
                        <div className="sev-conf" aria-hidden>{Array.from({ length: 16 }).map((_, i) => <i key={i} style={{ left: `${(i * 6.4 + 2) % 100}%`, animationDelay: `${(i * 0.21) % 2.4}s`, background: ["#f0c04f", "#e25563", "#4b7ae0", "#34d399"][i % 4] }} />)}</div>
                        <small>COMPLETE</small><div className="t">達成条件をすべてクリア！</div><p>サンタ帽と聖夜のマントを手に入れました。残りの期間も、ポイント{m}倍でどんどん集めよう。</p>
                        <button className="sev-btn" onClick={() => router.push(next.href)}>テスト・チャレンジへ進む →</button>
                    </div>
                )}
                {ev.status === "ended" && <div className="sev-next wait"><small>イベント終了</small><div className="t">ご参加ありがとうございました</div><p>手に入れた武器・装備・飾りは、これからも使えます。</p></div>}

                <button className="sev-btn sub" onClick={() => router.push("/event")}>イベントの詳細を見る →</button>

                <button className="sev-more" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "ルールを閉じる ▲" : "ルールを見る ▼"}</button>
                {open && (
                    <div className="sev-rule">
                        <p><b>期間</b>：{wd(ev.starts_at)}〜{wd(ev.ends_at, -1000)}</p>
                        <p><b>ポイント{m}倍</b>：期間中に、学習コンテンツの完了報告が承認されたとき／ESを初めて完成させたとき／テストに合格したとき／チャレンジが承認されたとき、いつものポイントと同じ額がボーナスで付きます。ボーナスと達成報酬は、ホームかこのページを開いたときに自動で受け取ります。</p>
                        <p><b>達成報酬</b>：「学習メインルート制覇」か「ES完成」のどちらかでサンタ帽、両方で聖夜のマント。</p>
                        <p><b>期間限定の品</b>：聖夜の杖と島のクリスマス飾りは、期間中だけショップで買えます。{BUY}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

const CSS = `
.sev{position:relative;width:100%;max-width:980px;margin:14px auto 0;box-sizing:border-box;border-radius:22px;border:3px solid #e2bf63;background:linear-gradient(180deg,#fffdf6,#f8efdb);box-shadow:0 0 0 3px rgba(255,255,255,.5),0 12px 28px rgba(16,47,112,.25);overflow:hidden;color:#3a4256}
.sev h4{margin:0;font-family:inherit}
/* バナー */
.sev-bn{position:relative;height:clamp(150px,44vw,200px);overflow:hidden;background:#2f5fc4}
@media (min-width:768px){.sev-bn{height:260px}}
.sev-bn img{display:block;width:100%;height:100%;object-fit:cover;object-position:center top}
.sev-snow i{position:absolute;top:-10px;border-radius:50%;background:#fff;opacity:.9;box-shadow:0 0 6px rgba(255,255,255,.9);animation:sevSnow linear infinite}
@keyframes sevSnow{0%{transform:translate3d(0,-10px,0)}100%{transform:translate3d(18px,290px,0)}}
.sev-plate{position:relative;z-index:2;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px 12px;width:fit-content;max-width:calc(100% - 20px);margin:-22px auto 0;padding:8px 20px;border-radius:999px;border:2.5px solid #e2bf63;background:linear-gradient(180deg,#3567cf,#1d3f96);color:#fff;box-shadow:0 5px 14px rgba(16,47,112,.4),inset 0 2px 0 rgba(255,255,255,.25);text-align:center}
.sev-plate span{font-size:11.5px;font-weight:900;color:#ffe08a;letter-spacing:.08em}
.sev-plate b{font-size:15px;font-weight:900;letter-spacing:.03em;white-space:nowrap}
.sev-plate em{font-style:normal;font-size:11.5px;font-weight:900;color:#5a3d08;background:linear-gradient(180deg,#ffe9a8,#f0c04f);border-radius:999px;padding:2px 10px;white-space:nowrap}
.sev-plate em.ended{background:#cbd5e1;color:#334155}
.sev-body{padding:14px 14px 12px;display:flex;flex-direction:column;gap:14px}
@media (min-width:768px){.sev-body{padding:16px 22px 16px}}
.sev-get{border-radius:14px;border:2px solid #e2bf63;background:linear-gradient(180deg,#fffbe6,#fdeeb8);padding:9px 12px;font-size:13px;font-weight:800;color:#5a3d08;text-align:center;animation:sevPop .5s ease both}
.sev-get b{color:#b45309;font-size:15px}
@keyframes sevPop{0%{transform:scale(.94);opacity:0}100%{transform:scale(1);opacity:1}}
/* 2倍の告知 */
.sev-catch{border-radius:18px;border:2px solid #e2c97a;background:linear-gradient(180deg,#fffef9,#fbf3df);padding:12px 12px 11px;text-align:center;box-shadow:inset 0 0 0 3px rgba(255,255,255,.7),0 3px 10px rgba(120,90,30,.12)}
.sev-catch .c1{font-size:clamp(15px,4.4vw,21px);font-weight:900;color:#6b3410;letter-spacing:.06em}
.sev-catch .c2{margin-top:4px;font-size:clamp(12px,3.3vw,14.5px);font-weight:800;color:#3a4256;line-height:1.7}
.sev-catch span{display:inline-block}
.sev-catch .c2 b{display:inline-block;margin-left:4px;font-size:clamp(24px,7vw,34px);font-weight:900;font-style:italic;white-space:nowrap;line-height:1;vertical-align:-3px;background:linear-gradient(100deg,#b3202f 0%,#e25563 35%,#ffd76e 50%,#e25563 65%,#b3202f 100%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-stroke:.4px rgba(120,20,30,.25);animation:sevSheen 3.6s ease-in-out infinite}
@keyframes sevSheen{0%,100%{background-position:100% 0}50%{background-position:0 0}}
/* 報酬 */
.sev-rw{display:grid;grid-template-columns:minmax(0,1fr);gap:22px 12px;margin-top:10px}
@media (min-width:768px){.sev-rw{grid-template-columns:minmax(0,1fr) minmax(0,1.25fr) minmax(0,1.25fr)}}
.sev-rc{position:relative;border-radius:18px;border:2px solid #e2c97a;background:radial-gradient(circle at 50% 40%,#fff,#eaf1ff 70%,#dbe7fb);padding:20px 8px 8px;box-shadow:0 4px 12px rgba(40,60,120,.14)}
.sev-rc h4{position:absolute;left:50%;top:-13px;transform:translateX(-50%);white-space:nowrap;font-size:13px;font-weight:900;letter-spacing:.1em;color:#fff;padding:4px 20px;background:linear-gradient(180deg,#3d6fd6,#1d3f96);border:2px solid #e2bf63;border-radius:6px;box-shadow:0 3px 8px rgba(16,47,112,.35);clip-path:polygon(0 0,100% 0,calc(100% - 9px) 50%,100% 100%,0 100%,9px 50%)}
.sev-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.sev-item{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;width:100%;min-height:44px;padding:4px 4px 6px;border:none;background:transparent;cursor:pointer;font-family:inherit;border-radius:12px}
.sev-item:active{transform:scale(.98)}
.sev-item .im{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:118px}
.sev-item.big .im{height:132px}
.sev-item .im img{max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 6px 8px rgba(40,60,120,.28))}
.sev-item .im::before,.sev-item .im::after{content:"";position:absolute;width:12px;height:12px;background:radial-gradient(circle,#fff 0,#ffe9a8 40%,transparent 70%);border-radius:50%;animation:sevTw 2.6s ease-in-out infinite}
.sev-item .im::before{left:14%;top:14%}
.sev-item .im::after{right:12%;bottom:20%;animation-delay:1.3s}
@keyframes sevTw{0%,100%{transform:scale(.3);opacity:.2}50%{transform:scale(1.25);opacity:1}}
.sev-deco{display:flex;align-items:flex-end;justify-content:center;gap:2px;width:100%;height:132px}
.sev-deco img{flex:1;min-width:0;max-height:100%;object-fit:contain;filter:drop-shadow(0 5px 6px rgba(40,60,120,.25))}
.sev-item .nm{font-size:12.5px;font-weight:900;color:#17397d;background:linear-gradient(180deg,#fffaf0,#f3e3bd);border:1.5px solid #dcc27a;border-radius:6px;padding:2px 12px;max-width:100%;overflow-wrap:anywhere;text-align:center;line-height:1.4}
.sev-item .st{font-size:11px;font-weight:900;color:#8a7a5c}
.sev-item .st.own{color:#1e7a45}
.sev-item .st.can{color:#b3202f}
.sev-dt{border-radius:14px;border:2px solid #cdb87e;background:#fffef8;padding:10px 12px;animation:sevPop .25s ease both}
.sev-dt b{font-size:13.5px;font-weight:900;color:#17397d}
.sev-dt p{margin:4px 0 0;font-size:12px;font-weight:700;line-height:1.75;color:#5b4a23}
.sev-mini{margin-top:8px;min-height:38px;padding:7px 16px;border-radius:999px;border:1.5px solid #e2bf63;background:linear-gradient(180deg,#4b7ae0,#1d3f96);color:#fff;font-size:12.5px;font-weight:900;cursor:pointer;font-family:inherit}
/* 進め方 */
.sev-how{border-radius:18px;border:2.5px solid #e2bf63;background:linear-gradient(180deg,#2f5fc4,#1d3f96 60%,#172f78);padding:10px 12px 14px;box-shadow:inset 0 2px 0 rgba(255,255,255,.2)}
.sev-how h4{text-align:center;font-size:15px;font-weight:900;color:#fff;letter-spacing:.14em;padding-bottom:8px}
.sev-how ol{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);gap:26px}
@media (min-width:768px){.sev-how ol{grid-template-columns:repeat(3,minmax(0,1fr));gap:34px}}
.sev-how li{position:relative;display:flex;align-items:center;gap:10px;border-radius:14px;border:2px solid #e2c97a;background:linear-gradient(180deg,#fffdf6,#f6ead0);padding:10px 12px 10px 16px;min-height:62px}
.sev-how li>i{position:absolute;left:-9px;top:-9px;width:26px;height:26px;border-radius:50%;background:linear-gradient(180deg,#3d6fd6,#1d3f96);border:2px solid #e2bf63;color:#fff;font-style:normal;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center}
.sev-how li>img{flex:none;width:46px;height:46px;object-fit:contain}
.sev-how li>span:last-child{flex:1;min-width:0;font-size:12.5px;font-weight:900;color:#3a4256;line-height:1.5}
.sev-how li b{color:#b3202f;font-size:17px;font-style:italic}
.sev-how li:not(:last-child)::after{content:"";position:absolute;left:50%;bottom:-19px;width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-top:11px solid #f0c04f;transform:translateX(-50%)}
@media (min-width:768px){.sev-how li:not(:last-child)::after{left:auto;right:-24px;bottom:auto;top:50%;border-top:9px solid transparent;border-bottom:9px solid transparent;border-left:11px solid #f0c04f;border-right:none;transform:translateY(-50%)}}
.sev-how .coin{position:relative;flex:none;width:46px;height:46px;margin-right:14px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3b8,#f0b429 60%,#c98a12);border:2.5px solid #a97c16;box-shadow:inset 0 0 0 3px rgba(255,255,255,.35),0 3px 6px rgba(120,80,10,.35);display:flex;align-items:center;justify-content:center}
.sev-how .coin u{text-decoration:none;font-size:22px;font-weight:900;color:#8a5a06;text-shadow:0 1px 0 #ffe9a8}
.sev-how .coin s{position:absolute;right:-12px;top:-7px;text-decoration:none;font-size:13px;font-weight:900;color:#b3202f;-webkit-text-stroke:.6px #fff;paint-order:stroke fill}
/* 進捗 */
.sev-prog{border-radius:18px;border:2px solid #e2c97a;background:#fffef8;padding:11px 14px 9px}
.sev-prog h4,.sev-next small{display:block;font-size:13.5px;font-weight:900;color:#17397d;letter-spacing:.06em;padding-bottom:6px;margin-bottom:5px;border-bottom:2px solid rgba(190,160,110,.35)}
.sev-row{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:2px 8px;font-size:12.5px;font-weight:800;color:#5b4a23;padding:4px 0}
.sev-row>span{display:flex;align-items:center;gap:7px;flex:0 0 auto;max-width:100%}
.sev-row b{color:#17397d;text-align:right;font-size:12.5px;margin-left:auto}
.sev-row .ck{flex:none;width:18px;height:18px;border-radius:50%;border:2px solid #cdb87e;background:#fff;position:relative}
.sev-row .ck.on{background:#2e9d5f;border-color:#2e9d5f}
.sev-row .ck.on::after{content:"";position:absolute;left:5px;top:1.5px;width:4px;height:8px;border:solid #fff;border-width:0 2.5px 2.5px 0;transform:rotate(45deg)}
.sev-bar{height:10px;border-radius:999px;background:rgba(23,57,125,.13);overflow:hidden;margin:2px 0 6px}
.sev-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#ffd76e,#f0b429);transition:width 1.2s cubic-bezier(.2,.8,.2,1)}
/* 次のクエスト */
.sev-next{position:relative;overflow:hidden;border-radius:18px;border:2.5px solid #e2bf63;background:linear-gradient(180deg,#fffbe9,#fdeec0);padding:11px 14px 14px;text-align:center;box-shadow:0 4px 12px rgba(120,90,30,.15)}
.sev-next small{border-bottom:none;margin:0;padding:0;color:#b3202f;letter-spacing:.14em}
.sev-next .t{font-size:clamp(15px,4.2vw,18px);font-weight:900;color:#17397d;line-height:1.5;margin:2px 0 4px}
.sev-next p{margin:0 0 4px;font-size:12px;font-weight:700;color:#6b5a36;line-height:1.7}
.sev-next.done{background:linear-gradient(180deg,#fff8d6,#ffe9a8);box-shadow:0 0 0 3px rgba(255,233,168,.6),0 0 26px rgba(240,192,79,.7)}
.sev-conf i{position:absolute;top:-12px;width:7px;height:12px;border-radius:2px;opacity:.9;animation:sevConf 2.6s linear infinite}
@keyframes sevConf{0%{transform:translate3d(0,-12px,0) rotate(0)}100%{transform:translate3d(-14px,220px,0) rotate(540deg);opacity:.2}}
/* ボタン */
.sev-btn{display:block;width:100%;max-width:520px;min-height:50px;margin:8px auto 0;padding:11px 14px;border-radius:999px;border:2.5px solid #fff3c9;background:linear-gradient(180deg,#ffe9a8,#f0c04f 60%,#dfa52c);color:#4a3206;font-size:15px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 5px 0 #a97c16,0 8px 14px rgba(120,80,10,.25),inset 0 2px 0 rgba(255,255,255,.6)}
.sev-btn:active{transform:translateY(4px);box-shadow:0 1px 0 #a97c16}
.sev-btn.sub{margin-top:0;min-height:46px;font-size:14px}
.sev-more{display:block;margin:0 auto;border:none;background:none;color:#6b5a36;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;padding:6px 12px;min-height:36px}
.sev-rule{border-radius:12px;border:1.5px solid #dcc27a;background:#fff;padding:8px 12px}
.sev-rule p{font-size:12px;line-height:1.75;margin:4px 0;font-weight:600;color:#3a4256}
.sev-rule b{color:#17397d}
@media (prefers-reduced-motion:reduce){.sev-snow,.sev-conf{display:none}.sev *{animation:none!important}.sev-bar i{transition:none}}
`;
