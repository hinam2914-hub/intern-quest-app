"use client";
// HOME のシーズンイベントカード。サーバー側の関数 event_sync()（season_event.sql）を呼ぶだけ。
// ボーナスの計算と付与はすべてサーバー側（実際の記録から計算・二重付与なし）。関数が未導入／開催していないときは何も出さない。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Ev = {
    active: boolean; key: string; name: string; subtitle: string | null; status: "upcoming" | "running" | "ended";
    starts_at: string; ends_at: string; multiplier: number; new_points: number; bonus_total: number;
    counts: Record<string, number>; main_done: number; main_total: number; es_done: boolean;
};
const md = (iso: string, shift = 0) => { const d = new Date(new Date(iso).getTime() + 9 * 3600e3 + shift); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };

export default function SeasonEventCard() {
    const router = useRouter();
    const [ev, setEv] = useState<Ev | null>(null);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const { data, error } = await supabase.rpc("event_sync");
                if (error || !data || !(data as Ev).active) return;
                if (alive) setEv(data as Ev);
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
                <span className="sev-period">{period}{ev.status === "running" && <b>あと{daysLeft}日</b>}{ev.status === "upcoming" && <b>あと{daysTo}日で開始</b>}</span>
            </div>
            <div className="sev-name">{ev.name}</div>
            <div className="sev-sub">学習コンテンツ・ES・テストのポイントが <b>{ev.multiplier}倍</b></div>

            {ev.status !== "upcoming" && ev.new_points > 0 && <div className="sev-new" role="status">イベントボーナス <b>+{ev.new_points}pt</b> を受け取りました</div>}

            <div className="sev-prog">
                <div className="sev-row"><span>学習メインルート（STEP1〜6）</span><b>{mainAll ? "✓ 制覇" : `${ev.main_done} / ${ev.main_total}本`}</b></div>
                <div className="sev-bar"><i style={{ width: `${pct}%` }} /></div>
                <div className="sev-row"><span>ES</span><b>{ev.es_done ? "✓ 完成" : "未完成"}</b></div>
                {ev.status !== "upcoming" && <div className="sev-row"><span>これまでのイベントボーナス</span><b>+{ev.bonus_total}pt</b></div>}
            </div>

            {ev.status === "running" && <button className="sev-btn" onClick={() => router.push(next.href)}>▶ 次の一手：{next.label}</button>}
            {ev.status === "upcoming" && <button className="sev-btn ghost" onClick={() => router.push("/learn")}>学習コンテンツを先に見ておく</button>}

            <button className="sev-more" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "ルールを閉じる ▲" : "ルールを見る ▼"}</button>
            {open && (
                <div className="sev-rule">
                    <p><b>期間</b>：{period}</p>
                    <p><b>ポイント{ev.multiplier}倍</b>：期間中に、学習コンテンツの完了報告が承認されたとき／ESを初めて完成させたとき／テストに合格したとき、いつものポイントと同じ額がボーナスで付きます。ボーナスはHOMEを開いたときに自動で受け取ります。</p>
                    <p><b>達成報酬（限定装備）</b>：「学習メインルート制覇」か「ES完成」のどちらかで1つ、両方でもう1つ。装備は準備中で、できあがり次第お知らせします。</p>
                    {ev.status !== "upcoming" && <p><b>ボーナスの内訳</b>：学習 {c.content || 0}本／ES {c.es || 0}件／テスト {c.test || 0}件</p>}
                </div>
            )}
        </div>
    );
}

const CSS = `
.sev{width:100%;box-sizing:border-box;margin-top:14px;border-radius:18px;border:2.5px solid #e2bf63;background:linear-gradient(180deg,#2f5fc4,#1d3f96 55%,#172f78);color:#fff;padding:12px 14px 10px;box-shadow:0 8px 20px rgba(16,47,112,.3),inset 0 2px 0 rgba(255,255,255,.22)}
.sev-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sev-tag{font-size:10.5px;font-weight:900;color:#5a3d08;background:linear-gradient(180deg,#ffe9a8,#f0c04f);border:1px solid #fff3c9;border-radius:999px;padding:3px 10px}
.sev-period{font-size:11.5px;font-weight:800;color:#dbe7ff}
.sev-period b{margin-left:8px;color:#ffe9a8}
.sev-name{font-size:19px;font-weight:900;letter-spacing:.04em;margin-top:6px;text-shadow:0 2px 0 rgba(10,25,70,.5)}
.sev-sub{font-size:12.5px;font-weight:800;color:#e6eeff;margin-top:2px}
.sev-sub b{color:#ffe08a;font-size:15px}
.sev-new{margin-top:9px;background:rgba(255,233,168,.16);border:1.5px solid #ffe08a;border-radius:12px;padding:7px 10px;font-size:12.5px;font-weight:800;color:#fff7d6}
.sev-new b{color:#ffe08a;font-size:15px}
.sev-prog{margin-top:9px;background:rgba(10,25,70,.3);border:1px solid rgba(255,233,168,.35);border-radius:12px;padding:8px 10px}
.sev-row{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;font-weight:800;color:#dbe7ff;padding:2px 0}
.sev-row b{color:#fff;white-space:nowrap}
.sev-bar{height:8px;border-radius:999px;background:rgba(10,25,70,.5);overflow:hidden;margin:3px 0 5px}
.sev-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#ffd76e,#f0b429)}
.sev-btn{display:block;width:100%;min-height:46px;margin-top:10px;padding:10px 12px;border-radius:999px;border:2px solid #fff3c9;background:linear-gradient(180deg,#ffe9a8,#f0c04f);color:#4a3206;font-size:13.5px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 4px 0 #a97c16}
.sev-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #a97c16}
.sev-btn.ghost{background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,233,168,.7);box-shadow:none}
.sev-more{display:block;margin:8px auto 0;border:none;background:none;color:#dbe7ff;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit;padding:6px 10px}
.sev-rule{background:rgba(255,255,255,.95);color:#3a4256;border-radius:12px;padding:8px 12px;margin-top:4px}
.sev-rule p{font-size:12px;line-height:1.7;margin:4px 0;font-weight:600}
.sev-rule b{color:#17397d}
`;
