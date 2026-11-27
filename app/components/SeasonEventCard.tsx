"use client";
// HOME のシーズンイベントカード。サーバー側の関数 event_sync()（season_event.sql）を呼ぶだけ。
// ボーナスの計算と付与はすべてサーバー側（実際の記録から計算・二重付与なし）。関数が未導入／開催していないときは何も出さない。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Ev = {
    active: boolean; key: string; name: string; subtitle: string | null; status: "upcoming" | "running" | "ended";
    starts_at: string; ends_at: string; multiplier: number; rookie_bonus?: number; new_points: number; bonus_total: number;
    counts: Record<string, number>; main_done: number; main_total: number; es_done: boolean;
    weapon_ready?: boolean; weapon_owned?: boolean; weapon_granted?: boolean; joined?: boolean; gear_granted?: string[];
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

export default function SeasonEventCard({ onActive }: { onActive?: (on: boolean) => void } = {}) {
    const router = useRouter();
    const [ev, setEv] = useState<Ev | null>(null);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const { data, error } = await supabase.rpc("event_sync");
                if (error || !data || !(data as Ev).active) return;
                if (alive) { setEv(data as Ev); onActive?.(true); }
            } catch { /* イベント未導入 */ }
        })();
        return () => { alive = false; };
    }, []);
    if (!ev) return null;

    const now = Date.now();
    const period = `${md(ev.starts_at)}〜${md(ev.ends_at, -1000)}`;
    const daysLeft = Math.max(0, Math.ceil((new Date(ev.ends_at).getTime() - now) / 86400e3));
    const daysTo = Math.max(1, Math.ceil((new Date(ev.starts_at).getTime() - now) / 86400e3));
    const mainAll = ev.main_total > 0 && ev.main_done >= ev.main_total;
    const pct = ev.main_total > 0 ? Math.round((ev.main_done / ev.main_total) * 100) : 0;
    // 次の一手：考えなくていいように、やることを1つだけ出す
    const next = !mainAll ? { label: "学習コンテンツの「次に見る1本」へ", href: "/learn" } : !ev.es_done ? { label: "ESを書く", href: "/es" } : { label: "テストに挑戦する", href: "/tests" };
    const c = ev.counts || {};

    return (
        <div className="sev">
            <style>{CSS}</style>
            <div className="sev-top">
                <span className="sev-tag">{ev.status === "upcoming" ? "まもなく開催" : ev.status === "running" ? "開催中" : "終了"}</span>
                <span className="sev-season">❄ WINTER EVENT</span>
                <span className="sev-period">{period}{ev.status === "running" && <b>あと{daysLeft}日</b>}{ev.status === "upcoming" && <b>あと{daysTo}日で開始</b>}</span>
            </div>
            <div className="sev-name">{ev.name}</div>
            <div className="sev-sub">学習・ES・テスト・チャレンジのポイントが <b>{ev.multiplier}倍</b></div>

            {ev.status !== "upcoming" && ev.new_points > 0 && <div className="sev-new" role="status">イベントボーナス <b>+{ev.new_points}pt</b> を受け取りました</div>}

            {ev.weapon_granted && <div className="sev-new" role="status">達成おめでとう！ 限定武器 <b>「聖夜の杖」</b> を受け取りました</div>}

            {(ev.gear_granted || []).length > 0 && <div className="sev-new" role="status">達成おめでとう！ <b>{(ev.gear_granted || []).map((k) => k === "event_santa_hat" ? "サンタ帽" : "聖夜のマント").join("・")}</b> を受け取りました</div>}

            <div className="sev-prog">
                <div className="sev-row"><span>学習メインルート（STEP1〜6）</span><b>{mainAll ? "✓ 制覇" : `${ev.main_done} / ${ev.main_total}本`}</b></div>
                <div className="sev-bar"><i style={{ width: `${pct}%` }} /></div>
                <div className="sev-row"><span>ES</span><b>{ev.es_done ? "✓ 完成" : "未完成"}</b></div>
                {ev.weapon_ready && <div className="sev-row"><span>限定武器「聖夜の杖」</span><b>{ev.weapon_owned ? "✓ 所持" : ev.status === "running" ? (ev.joined ? "購入できます" : "参加すると購入可") : "未所持"}</b></div>}
                {ev.status !== "upcoming" && <div className="sev-row"><span>これまでのイベントボーナス</span><b>+{ev.bonus_total}pt</b></div>}
            </div>

            {ev.status === "running" && <button className="sev-btn" onClick={() => router.push(next.href)}>▶ 次の一手：{next.label}</button>}
            {ev.status === "upcoming" && <div className="sev-wait">{md(ev.starts_at)}の0時にスタート！ はじまったら、ここに「次の一手」が出ます</div>}

            {ev.weapon_ready && !ev.weapon_owned && <button className="sev-btn ghost" onClick={() => router.push("/shop")}>限定武器「聖夜の杖」を見る</button>}

            <button className="sev-btn ghost" onClick={() => router.push("/event")}>イベントの詳細を見る →</button>
            <button className="sev-more" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "ルールを閉じる ▲" : "ルールを見る ▼"}</button>
            {open && (
                <div className="sev-rule">
                    <p><b>期間</b>：{period}</p>
                    <p><b>ポイント{ev.multiplier}倍</b>：期間中に、学習コンテンツの完了報告が承認されたとき／ESを初めて完成させたとき／テストに合格したとき／チャレンジが承認されたとき、いつものポイントと同じ額がボーナスで付きます。{(ev.rookie_bonus || 0) > 0 && `一人前チャレンジは、期間中に提出して承認された1項目ごとに +${ev.rookie_bonus}pt が付きます。`}ボーナスはHOMEを開いたときに自動で受け取ります。</p>
                    {ev.weapon_ready && <p><b>限定武器「聖夜の杖」</b>：島バトルの武器。学習コンテンツを1本修了するごとに攻撃力+1（40→最大60）、この杖で城を落とすと奪えるポイントが1.5倍。期間中だけショップで買えます（買えるのはイベントに参加した人＝期間中に学習・ES・テスト・チャレンジのどれかを1つ以上達成した人だけ。買えば期間後も使えます）。「学習メインルート制覇」か「ES完成」を達成した人は無料でもらえます。</p>}
                    <p><b>達成報酬（限定装備）</b>：「学習メインルート制覇」か「ES完成」のどちらかでサンタ帽、両方で聖夜のマント。達成すると自動で届き、アバター編集で着けられます。</p>
                    {ev.status !== "upcoming" && <p><b>ボーナスの内訳</b>：学習 {c.content || 0}本／ES {c.es || 0}件／テスト {c.test || 0}件／チャレンジ {c.challenge || 0}件{(ev.rookie_bonus || 0) > 0 ? `／一人前チャレンジ ${c.rookie || 0}項目` : ""}</p>}
                </div>
            )}
        </div>
    );
}

const CSS = `
.sev{width:100%;box-sizing:border-box;margin-top:14px;border-radius:18px;border:2.5px solid #e2bf63;background:linear-gradient(180deg,#2f5fc4,#1d3f96 55%,#172f78);color:#fff;padding:12px 14px 10px;box-shadow:0 8px 20px rgba(16,47,112,.3),inset 0 2px 0 rgba(255,255,255,.22)}
.sev-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sev-tag{font-size:10.5px;font-weight:900;color:#5a3d08;background:linear-gradient(180deg,#ffe9a8,#f0c04f);border:1px solid #fff3c9;border-radius:999px;padding:3px 10px}
.sev-season{font-size:10px;font-weight:900;letter-spacing:.12em;color:#fff;background:linear-gradient(180deg,#e25563,#b3202f);border:1px solid #ffd9dd;border-radius:999px;padding:3px 9px}
.sev-period{font-size:11.5px;font-weight:800;color:#dbe7ff}
.sev-period b{margin-left:8px;color:#ffe9a8}
.sev-name{font-size:19px;font-weight:900;letter-spacing:.04em;margin-top:6px;text-shadow:0 2px 0 rgba(10,25,70,.5)}
.sev-sub{font-size:12.5px;font-weight:800;color:#e6eeff;margin-top:2px}
.sev-sub b{color:#ffe08a;font-size:15px;white-space:nowrap}
.sev-new{margin-top:9px;background:rgba(255,233,168,.16);border:1.5px solid #ffe08a;border-radius:12px;padding:7px 10px;font-size:12.5px;font-weight:800;color:#fff7d6}
.sev-new b{color:#ffe08a;font-size:15px}
.sev-prog{margin-top:9px;background:rgba(10,25,70,.3);border:1px solid rgba(255,233,168,.35);border-radius:12px;padding:8px 10px}
.sev-row{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;font-weight:800;color:#dbe7ff;padding:2px 0}
.sev-row b{color:#fff;white-space:nowrap}
.sev-bar{height:8px;border-radius:999px;background:rgba(10,25,70,.5);overflow:hidden;margin:3px 0 5px}
.sev-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#ffd76e,#f0b429)}
.sev-btn{display:block;width:100%;min-height:46px;margin-top:10px;padding:10px 12px;border-radius:999px;border:2px solid #fff3c9;background:linear-gradient(180deg,#ffe9a8,#f0c04f);color:#4a3206;font-size:13.5px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 4px 0 #a97c16}
.sev-wait{margin-top:9px;font-size:12.5px;font-weight:800;color:#ffe08a;line-height:1.6;text-align:center}
.sev-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #a97c16}
.sev-btn.ghost{background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,233,168,.7);box-shadow:none}
.sev-more{display:block;margin:8px auto 0;border:none;background:none;color:#dbe7ff;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit;padding:6px 10px}
.sev-rule{background:rgba(255,255,255,.95);color:#3a4256;border-radius:12px;padding:8px 12px;margin-top:4px}
.sev-rule p{font-size:12px;line-height:1.7;margin:4px 0;font-weight:600}
.sev-rule b{color:#17397d}
`;
