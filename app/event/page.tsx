"use client";
// シーズンイベントの詳細ページ。お知らせ・HOME・マイページ・学習ページのイベント案内は、すべてここに飛ぶ。
// 進み具合とボーナスはサーバー側の関数 event_sync()（season_event.sql）から受け取るだけ。開催していないときは「開催していません」と出す。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Ev = {
    active: boolean; key: string; name: string; status: "upcoming" | "running" | "ended";
    starts_at: string; ends_at: string; multiplier: number; new_points: number; bonus_total: number;
    counts: Record<string, number>; main_done: number; main_total: number; es_done: boolean;
    weapon_ready?: boolean; weapon_owned?: boolean; weapon_granted?: boolean; joined?: boolean;
};
const md = (iso: string, shift = 0) => { const d = new Date(new Date(iso).getTime() + 9 * 3600e3 + shift); return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`; };

export default function EventPage() {
    const router = useRouter();
    const [ev, setEv] = useState<Ev | null>(null);
    const [state, setState] = useState<"loading" | "none" | "ok">("loading");
    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            try {
                const { data, error } = await supabase.rpc("event_sync");
                if (error || !data || !(data as Ev).active) { setState("none"); return; }
                setEv(data as Ev); setState("ok");
            } catch { setState("none"); }
        })();
    }, [router]);

    const back = <button className="evp-back" onClick={() => router.push("/home")}>← ホームへ</button>;
    if (state !== "ok" || !ev) return (
        <div className="evp-root"><style>{CSS}</style><div className="evp-col">{back}
            <div className="evp-pn" style={{ textAlign: "center", marginTop: 20 }}>{state === "loading" ? "読み込み中…" : "いま開催しているイベントはありません"}</div>
        </div></div>
    );

    const now = Date.now();
    const daysLeft = Math.max(0, Math.ceil((new Date(ev.ends_at).getTime() - now) / 86400e3));
    const daysTo = Math.max(1, Math.ceil((new Date(ev.starts_at).getTime() - now) / 86400e3));
    const mainAll = ev.main_total > 0 && ev.main_done >= ev.main_total;
    const pct = ev.main_total > 0 ? Math.round((ev.main_done / ev.main_total) * 100) : 0;
    const achieved = (mainAll ? 1 : 0) + (ev.es_done ? 1 : 0);
    const c = ev.counts || {};
    const m = ev.multiplier;
    const next = !mainAll ? { label: "学習コンテンツの「次に見る1本」へ", href: "/learn" } : !ev.es_done ? { label: "ESを書く", href: "/es" } : { label: "テストに挑戦する", href: "/tests" };
    const TARGETS = [
        { name: "学習コンテンツ", when: "完了報告が承認されたとき", base: "+2pt", ev: `+${2 * m}pt`, href: "/learn", n: c.content || 0, unit: "本" },
        { name: "ES", when: "はじめて完成させたとき", base: "+100pt", ev: `+${100 * m}pt`, href: "/es", n: c.es || 0, unit: "件" },
        { name: "テスト", when: "合格したとき", base: "+10pt", ev: `+${10 * m}pt`, href: "/tests", n: c.test || 0, unit: "件" },
        { name: "チャレンジ", when: "承認されたとき", base: "いつものpt", ev: `${m}倍`, href: "/challenge", n: c.challenge || 0, unit: "件" },
    ];

    return (
        <div className="evp-root">
            <style>{CSS}</style>
            <div className="evp-col">
                {back}
                {/* ヒーロー */}
                <div className="evp-hero">
                    <div className="evp-tags">
                        <span className="evp-season">❄ WINTER EVENT</span>
                        <span className="evp-tag">{ev.status === "upcoming" ? "まもなく開催" : ev.status === "running" ? "開催中" : "終了"}</span>
                    </div>
                    <h1>{ev.name}</h1>
                    <p className="evp-lead">クリスマスと年末の、冬だけのシーズンイベント。<br />学習・ES・テスト・チャレンジのポイントが <b>{m}倍</b>！</p>
                    <div className="evp-period">{md(ev.starts_at)} 〜 {md(ev.ends_at, -1000)}
                        <b>{ev.status === "running" ? `あと${daysLeft}日` : ev.status === "upcoming" ? `あと${daysTo}日で開始` : "終了しました"}</b>
                    </div>
                    {ev.status === "running" && <button className="evp-cta" onClick={() => router.push(next.href)}>▶ 次の一手：{next.label}</button>}
                    {ev.status === "upcoming" && <div className="evp-wait">{md(ev.starts_at)}の0時にスタート！<span>はじまったら、ここに「次の一手」ボタンが出ます。ポイント{m}倍になるのは、開始してから達成したぶんです。</span></div>}
                </div>

                {ev.status !== "upcoming" && ev.new_points > 0 && <div className="evp-note" role="status">イベントボーナス <b>+{ev.new_points}pt</b> を受け取りました</div>}
                {ev.weapon_granted && <div className="evp-note" role="status">達成おめでとう！ 限定武器 <b>「聖夜の杖」</b> を受け取りました</div>}

                {/* あなたの進み具合 */}
                <section className="evp-pn">
                    <h2>あなたの進み具合</h2>
                    <div className="evp-kv"><span>学習メインルート（STEP1〜6）</span><b>{mainAll ? "✓ 制覇" : `${ev.main_done} / ${ev.main_total}本`}</b></div>
                    <div className="evp-bar"><i style={{ width: `${pct}%` }} /></div>
                    <div className="evp-kv"><span>ES</span><b>{ev.es_done ? "✓ 完成" : "未完成"}</b></div>
                    <div className="evp-kv"><span>イベントへの参加</span><b>{ev.status === "upcoming" ? "開始前" : ev.joined ? "✓ 参加ずみ" : "まだ参加していません"}</b></div>
                    {ev.status !== "upcoming" && <div className="evp-kv"><span>これまでのイベントボーナス</span><b>+{ev.bonus_total}pt</b></div>}
                </section>

                {/* やること */}
                <section className="evp-pn">
                    <h2>やることは、これだけ</h2>
                    <ol className="evp-steps">
                        <li><b>「次の一手」を押す</b><span>いまやることが1つだけ出ます。迷わなくて大丈夫。</span></li>
                        <li><b>出てきたものを1つやる</b><span>学習コンテンツなら1本見て、完了報告を出すだけ。</span></li>
                        <li><b>ポイントが{m}倍で貯まる</b><span>ボーナスは、ホームかこのページを開いたときに自動で受け取ります。</span></li>
                    </ol>
                </section>

                {/* ポイント2倍の対象 */}
                <section className="evp-pn">
                    <h2>ポイント{m}倍の対象</h2>
                    <div className="evp-tg">
                        {TARGETS.map((t) => (
                            <button key={t.name} className="evp-tgc" onClick={() => router.push(t.href)}>
                                <b>{t.name}</b>
                                <span className="w">{t.when}</span>
                                <span className="p"><s>{t.base}</s> → <em>{t.ev}</em></span>
                                {ev.status !== "upcoming" && <span className="n">期間中の達成 {t.n}{t.unit}</span>}
                                <span className="go">ひらく →</span>
                            </button>
                        ))}
                    </div>
                    <p className="evp-small">学習コンテンツは、期間中に完了報告を出して承認されたものが対象です。ESは、はじめての完成が対象です。</p>
                </section>

                {/* 限定武器 */}
                {ev.weapon_ready && (
                    <section className="evp-pn">
                        <h2>イベント限定の武器「聖夜の杖」</h2>
                        <div className="evp-wp">
                            <div className="evp-wpimg"><img src="/battle/weapons/wisdom_staff.webp" alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /><span>🎄</span></div>
                            <ul>
                                <li><b>学ぶほど強くなる</b>：学習コンテンツを1本修了するごとに攻撃力+1（40→最大60）</li>
                                <li><b>奪えるポイント1.5倍</b>：この杖で城を落としたとき</li>
                                <li><b>買い方</b>：期間中だけショップで800pt。買えるのはイベントに参加した人だけ（期間中に学習・ES・テスト・チャレンジのどれかを1つ以上達成）</li>
                                <li><b>無料でもらえる</b>：「学習メインルート制覇」か「ES完成」を達成した人</li>
                                <li>手に入れた杖は、イベントが終わっても使えます</li>
                            </ul>
                        </div>
                        <div className="evp-kv"><span>あなたの状況</span><b>{ev.weapon_owned ? "✓ 持っています" : ev.status !== "running" ? "未所持" : ev.joined ? "ショップで買えます" : "参加すると買えます"}</b></div>
                        {!ev.weapon_owned && <button className="evp-sub" onClick={() => router.push("/shop")}>ショップで聖夜の杖を見る →</button>}
                        {ev.weapon_owned && <button className="evp-sub" onClick={() => router.push("/islands")}>島バトルで使う →</button>}
                    </section>
                )}

                {/* 達成報酬 */}
                <section className="evp-pn">
                    <h2>達成報酬（イベント限定の装備）</h2>
                    <div className="evp-kv"><span>①「学習メインルート制覇」か「ES完成」のどちらか</span><b>{achieved >= 1 ? "✓ 達成" : "未達成"}</b></div>
                    <div className="evp-kv"><span>② 両方とも達成</span><b>{achieved >= 2 ? "✓ 達成" : "未達成"}</b></div>
                    <p className="evp-small">①でサンタ帽、②でクリスマスのマントがもらえます。装備は準備中で、できあがり次第お知らせして、達成した人に届けます。</p>
                </section>

                <button className="evp-back" style={{ alignSelf: "center", marginTop: 6 }} onClick={() => router.push("/home")}>← ホームへもどる</button>
            </div>
        </div>
    );
}

const CSS = `
.evp-root{min-height:100vh;background:#cfe6ff url(/home/bg_mobile.webp) center top/cover fixed;padding:14px 12px 110px;overflow-x:clip;font-family:inherit;color:#3a4256}
@media (min-width:768px){.evp-root{background-image:url(/home/bg_pc.webp);padding:22px 20px 60px}}
.evp-col{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.evp-back{align-self:flex-start;min-height:40px;padding:8px 16px;border-radius:999px;border:2px solid #e2bf63;background:#fffdf4;color:#17397d;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 3px 8px rgba(20,40,100,.18)}
.evp-hero{border-radius:22px;border:3px solid #e2bf63;background:linear-gradient(180deg,#2f5fc4,#1d3f96 55%,#172f78);color:#fff;padding:18px 18px 16px;text-align:center;box-shadow:0 0 0 3px rgba(255,255,255,.4),0 12px 26px rgba(16,47,112,.32),inset 0 2px 0 rgba(255,255,255,.22)}
.evp-tags{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.evp-season{font-size:10.5px;font-weight:900;letter-spacing:.12em;background:linear-gradient(180deg,#e25563,#b3202f);border:1px solid #ffd9dd;border-radius:999px;padding:4px 11px}
.evp-tag{font-size:11px;font-weight:900;color:#5a3d08;background:linear-gradient(180deg,#ffe9a8,#f0c04f);border:1px solid #fff3c9;border-radius:999px;padding:4px 12px}
.evp-hero h1{font-size:clamp(24px,6.4vw,36px);font-weight:900;letter-spacing:.05em;margin:10px 0 4px;text-shadow:0 3px 0 rgba(10,25,70,.5)}
.evp-lead{font-size:13.5px;font-weight:800;line-height:1.8;color:#e6eeff;margin:0}
.evp-lead b{color:#ffe08a;font-size:17px;white-space:nowrap}
.evp-period{display:inline-flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center;margin-top:10px;background:rgba(10,25,70,.35);border:1px solid rgba(255,233,168,.45);border-radius:999px;padding:7px 16px;font-size:13px;font-weight:900}
.evp-period b{color:#ffe08a}
.evp-cta{display:block;width:100%;min-height:50px;margin-top:14px;padding:12px 14px;border-radius:999px;border:2px solid #fff3c9;background:linear-gradient(180deg,#ffe9a8,#f0c04f);color:#4a3206;font-size:14.5px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 5px 0 #a97c16}
.evp-wait{margin-top:14px;border-radius:16px;border:1.5px solid rgba(255,233,168,.6);background:rgba(10,25,70,.3);padding:11px 14px;font-size:15px;font-weight:900;color:#ffe08a}
.evp-wait span{display:block;margin-top:3px;font-size:12px;font-weight:700;line-height:1.7;color:#e6eeff}
.evp-cta:active{transform:translateY(3px);box-shadow:0 2px 0 #a97c16}
.evp-note{border-radius:14px;border:2px solid #e2bf63;background:linear-gradient(180deg,#fffbe6,#fdeeb8);padding:10px 14px;font-size:13.5px;font-weight:800;color:#5a3d08;text-align:center}
.evp-note b{color:#b45309;font-size:16px}
.evp-pn{border-radius:18px;border:2.5px solid #d8b55e;background:linear-gradient(180deg,#FFFDF6,#f8efdb);padding:14px 16px;box-shadow:0 6px 16px rgba(40,60,120,.15)}
.evp-pn h2{font-size:15px;font-weight:900;color:#17397d;margin:0 0 8px;padding-bottom:7px;border-bottom:2px solid rgba(190,160,110,.35)}
.evp-kv{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:13px;font-weight:800;color:#5b4a23;padding:5px 0}
.evp-kv b{color:#17397d;white-space:nowrap}
.evp-bar{height:10px;border-radius:999px;background:rgba(23,57,125,.13);overflow:hidden;margin:2px 0 6px}
.evp-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#ffd76e,#f0b429)}
.evp-steps{margin:0;padding:0;list-style:none;counter-reset:s}
.evp-steps li{counter-increment:s;position:relative;padding:7px 0 7px 40px;border-bottom:1px solid rgba(190,160,110,.25)}
.evp-steps li:last-child{border-bottom:none}
.evp-steps li::before{content:counter(s);position:absolute;left:0;top:8px;width:28px;height:28px;border-radius:50%;background:linear-gradient(180deg,#4b7ae0,#1d3f96);border:1.5px solid #e2bf63;color:#fff;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center}
.evp-steps b{display:block;font-size:14px;font-weight:900;color:#17397d}
.evp-steps span{display:block;font-size:12px;font-weight:700;color:#6b5a36;line-height:1.6}
.evp-tg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media (min-width:640px){.evp-tg{grid-template-columns:repeat(4,minmax(0,1fr))}}
.evp-tgc{display:flex;flex-direction:column;gap:3px;text-align:left;padding:10px 11px;border-radius:14px;border:2px solid #cdb87e;background:#fffef8;cursor:pointer;font-family:inherit;min-width:0}
.evp-tgc b{font-size:14px;font-weight:900;color:#17397d}
.evp-tgc .w{font-size:10.5px;font-weight:700;color:#8a7a5c;line-height:1.5}
.evp-tgc .p{font-size:12px;font-weight:800;color:#6b5a36}
.evp-tgc .p s{color:#a59a80}
.evp-tgc .p em{font-style:normal;color:#b3202f;font-size:15px;font-weight:900}
.evp-tgc .n{font-size:10.5px;font-weight:800;color:#1e7a45}
.evp-tgc .go{margin-top:auto;padding-top:4px;font-size:11px;font-weight:900;color:#2f66c9}
.evp-small{font-size:11.5px;font-weight:700;color:#8a7a5c;line-height:1.7;margin:8px 0 0}
.evp-wp{display:flex;gap:12px;align-items:flex-start}
.evp-wpimg{flex:none;width:84px;height:84px;border-radius:16px;border:2px solid #e2bf63;background:radial-gradient(circle at 50% 35%,#e8f0ff,#bcd2f5);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.evp-wpimg img{position:absolute;inset:6px;width:calc(100% - 12px);height:calc(100% - 12px);object-fit:contain;z-index:1;background:radial-gradient(circle at 50% 35%,#e8f0ff,#bcd2f5)}
.evp-wpimg span{font-size:44px}
.evp-wp ul{margin:0;padding-left:18px;flex:1;min-width:0}
.evp-wp li{font-size:12.5px;font-weight:700;line-height:1.7;color:#5b4a23}
.evp-wp li b{color:#17397d}
.evp-sub{display:block;width:100%;min-height:44px;margin-top:8px;padding:10px;border-radius:999px;border:2px solid #e2bf63;background:linear-gradient(180deg,#4b7ae0,#1d3f96);color:#fff;font-size:13.5px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 4px 0 #12306e}
.evp-sub:active{transform:translateY(3px);box-shadow:0 1px 0 #12306e}
`;
