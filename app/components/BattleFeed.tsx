"use client";
// バトル速報：島バトルの履歴を全員ぶん、新しい順に表示する（応援掲示板に置く）。
// 読み取りだけ。サーバー側の関数 battle_feed（battle_feed.sql）から取る。関数が未導入・履歴0件のときは何も表示しない。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { WEAPONS } from "../lib/battle";
import { cheerWhen } from "../lib/cheer";
import AvatarFace, { unifiedFaceSource, type FaceSource } from "./AvatarFace";

type Row = { id: string; attacker_id: string; defender_id: string; weapon_key: string; damage: number; hp_after: number; is_crit: boolean; won: boolean; loot?: number | null; created_at: string };
type Who = { name: string; face: FaceSource };

export default function BattleFeed() {
    const router = useRouter();
    const [rows, setRows] = useState<Row[]>([]);
    const [who, setWho] = useState<Record<string, Who>>({});
    const [more, setMore] = useState(false);

    useEffect(() => {
        let alive = true;
        (async () => {
            const { data, error } = await supabase.rpc("battle_feed", { p_limit: 30 });
            if (!alive || error || !Array.isArray(data) || data.length === 0) return;
            const list = data as Row[];
            const ids = [...new Set(list.flatMap((r) => [r.attacker_id, r.defender_id]))];
            const { data: profs } = await supabase.from("profiles").select("id, name, job_class, avatar_config").in("id", ids);
            if (!alive) return;
            const w: Record<string, Who> = {};
            ((profs || []) as any[]).forEach((p) => { w[p.id] = { name: p.name || "名前未設定", face: unifiedFaceSource(p) }; });
            setWho(w); setRows(list);
        })();
        return () => { alive = false; };
    }, []);

    if (rows.length === 0) return null;
    const shown = more ? rows : rows.slice(0, 5);
    const nameOf = (id: string) => who[id]?.name || "だれか";
    const face = (id: string, size: number) => <AvatarFace src={who[id]?.face || { job: null, cfg: null }} size={size} border="2px solid #e2bf63" fallback={<span style={{ width: size, height: size, borderRadius: "50%", background: "#dbeafe", border: "2px solid #e2bf63", boxSizing: "border-box", flexShrink: 0 }} />} />;

    return (
        <section className="bf-panel" aria-label="バトル速報">
            <div className="bf-h">
                <img src="/battle/weapons/fire_sword.webp" alt="" />
                <h2>バトル速報</h2>
                <button onClick={() => router.push("/islands")}>島バトルへ →</button>
            </div>
            <ul className="bf-list">
                {shown.map((r) => {
                    const wp = WEAPONS.find((x) => x.key === r.weapon_key);
                    return (
                        <li key={r.id} className={"bf-row" + (r.won ? " won" : "")}>
                            <div className="bf-faces">{face(r.attacker_id, 40)}<i aria-hidden>▶</i>{face(r.defender_id, 40)}</div>
                            <div className="bf-tx">
                                <b>{nameOf(r.attacker_id)}さんが、{nameOf(r.defender_id)}さんの城{r.won ? "を落としました" : "を攻撃"}</b>
                                <small>{wp ? wp.name + "で " : ""}{r.damage}ダメージ{r.is_crit ? "（クリティカル）" : ""}{r.won ? "" : `　城の残りHP ${r.hp_after}`}</small>
                                {r.won && (r.loot || 0) > 0 && <em className="bf-loot">{r.loot}pt うばいました</em>}
                            </div>
                            <time>{cheerWhen(r.created_at)}</time>
                        </li>
                    );
                })}
            </ul>
            {rows.length > 5 && <button className="bf-more" aria-expanded={more} onClick={() => setMore(!more)}>{more ? "▲ 閉じる" : `▼ もっと見る（直近${rows.length}件）`}</button>}
            <style>{`
.bf-panel{padding:16px 24px 18px;background:linear-gradient(180deg,#fffdf6,#f8eed8);border:3px solid #e2bf63;border-radius:22px;box-shadow:inset 0 0 0 2px #fff,0 10px 24px rgba(16,47,112,.28)}
.bf-h{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.bf-h img{width:40px;height:40px;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(16,47,112,.25))}
.bf-h h2{flex:1;margin:0;font-size:19px;font-weight:900;color:#17307a;letter-spacing:.04em}
.bf-h button,.bf-more{min-height:40px;padding:6px 14px;border-radius:999px;border:2px solid #c9a94e;background:#fff;color:#17397d;font-size:12.5px;font-weight:900;cursor:pointer;font-family:inherit}
.bf-list{list-style:none;margin:0;padding:0;display:grid;gap:7px}
.bf-row{display:flex;align-items:center;gap:12px;padding:8px 12px;border-radius:14px;background:#fff;border:1.5px solid rgba(190,160,110,.5)}
.bf-row.won{background:#fff6d6;border-color:#e2bf63}
.bf-faces{display:flex;align-items:center;gap:4px;flex-shrink:0}
.bf-faces i{font-style:normal;font-size:11px;color:#b9812a}
.bf-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.bf-tx b{font-size:13.5px;font-weight:900;color:#17307a;overflow-wrap:anywhere;line-height:1.45}
.bf-row.won .bf-tx b{color:#8a4a08}
.bf-tx small{font-size:12px;font-weight:700;color:#5a6488}
.bf-loot{align-self:flex-start;font-style:normal;margin-top:2px;padding:1px 10px;border-radius:999px;background:#fff;border:1.5px solid #e2bf63;font-size:12.5px;font-weight:900;color:#a8690a}
.bf-row time{flex-shrink:0;font-size:11.5px;font-weight:700;color:#6b7591;white-space:nowrap}
.bf-more{display:block;margin:10px auto 0}
.bf-h button:focus-visible,.bf-more:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}
@media (max-width:640px){
  .bf-panel{padding:13px 12px 14px;border-radius:18px}
  .bf-row{flex-wrap:wrap;gap:6px 10px;padding:8px 10px}
  .bf-tx{flex:1 1 170px}
  .bf-row time{margin-left:auto}
}
            `}</style>
        </section>
    );
}
