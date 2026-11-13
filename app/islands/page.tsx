"use client";
// みんなの島へ行く「島探索ギルド」：島を探す→分析する→クエストで育つ→バトルに挑む、の循環をつくるページ。
// ・島とアバターはHOMEと同じ描画（DayIslandScene / AvatarLayered）を再利用し、育成状態と完全一致させる
// ・攻略情報（弱点属性・推奨武器・難易度）は app/lib/battle.ts の実計算だけを使う（UI独自の相性表を持たない）
// ・クエスト提案は実在報酬のみ：チャレンジ=challenges.points／思考クエスト=+5pt/問／学習=+2pt/完了承認
// ・バトルランクとシーズンは未実装のため全員「未ランク」。攻略目標はDB承認前のためブラウザ内保存（localStorage）
// ・読み取り専用ページ：DBへの書き込みは一切しない
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import DayIslandScene from "../components/DayIslandScene";
import AvatarLayered from "../components/AvatarLayered";
import { STEP_TITLE, getLevel, type IslandConfig } from "../lib/island";
import { getCastleStage } from "../lib/castle";
import { JOBS, type JobKey } from "../onboarding/job/page";
import type { AvatarConfig } from "../lib/avatar/catalog";
import {
    BATTLE_CONFIG, ELEMENTS, ADVANTAGE, WEAPONS, SKILLS,
    castleElementOf, elementMultiplier, type ElementKey, type WeaponDef,
} from "../lib/battle";

type GIsland = {
    id: string; name: string; streak: number;
    job: JobKey; cfg: AvatarConfig | null;
    islandCfg: IslandConfig; licenses: Record<string, boolean>;
    level: number; stepNo: number; totalEarned: number;
    element: ElementKey;
};
type Challenge = { id: string; title: string; category: string | null; points: number; icon: string };

const jobName = (j: JobKey) => (JOBS.find((x) => x.key === j)?.name || "ナイト");
const TARGET_KEY = "iq_guild_target";

// ギルド素材（ChatGPT制作）。ランクメダルはランク機能実装時に bronze〜master を使用
const GUILD_IMG = {
    emblem: "/guild/guild_emblem.webp",
    target: "/guild/target.webp",
    rankNone: "/guild/rank_none.webp",
    rank: { bronze: "/guild/rank_bronze.webp", silver: "/guild/rank_silver.webp", gold: "/guild/rank_gold.webp", platinum: "/guild/rank_platinum.webp", diamond: "/guild/rank_diamond.webp", master: "/guild/rank_master.webp" },
} as const;

/** 城の属性に対して×2.0が取れる属性（ADVANTAGE＝battle.ts正本から逆引き） */
const weakOf = (castleEl: ElementKey): ElementKey =>
    (Object.keys(ADVANTAGE) as ElementKey[]).find((e) => ADVANTAGE[e].includes(castleEl)) || castleEl;

/** 推奨武器：期待ダメージ（atk×相性倍率）の高い順TOP3。battle.tsの実計算のみ */
function recommendWeapons(castleEl: ElementKey) {
    return WEAPONS
        .map((w) => {
            const mult = elementMultiplier(w.element, castleEl);
            return { w, mult, dmg: Math.round(w.atk * mult) };
        })
        .sort((a, b) => b.dmg - a.dmg)
        .slice(0, 3);
}

/** 攻略難易度：最強武器での必要攻撃回数から算出（HP・倍率はBATTLE_CONFIG準拠） */
function difficultyOf(castleEl: ElementKey) {
    const best = recommendWeapons(castleEl)[0];
    const hits = Math.ceil(BATTLE_CONFIG.castleBaseHp / best.dmg);
    const star = hits <= 1 ? 1 : hits === 2 ? 2 : hits === 3 ? 3 : hits <= 5 ? 4 : 5;
    const label = ["", "とても簡単", "簡単", "普通", "難しい", "非常に難しい"][star];
    return { star, label, hits, best };
}

const ElIco = ({ k, size = 16 }: { k: ElementKey; size?: number }) => {
    const e = ELEMENTS[k];
    return e.img ? <img src={e.img} alt={e.name} style={{ width: size, height: size, verticalAlign: "-3px" }} /> : <span>{e.emoji}</span>;
};
const WIco = ({ w, size = 40 }: { w: WeaponDef; size?: number }) =>
    w.img ? <img src={w.img} alt={w.name} style={{ width: size, height: size, objectFit: "contain" }} /> : <span style={{ fontSize: size * 0.7 }}>{w.emoji}</span>;

export default function IslandsGuildPage() {
    const router = useRouter();
    const [islands, setIslands] = useState<GIsland[]>([]);
    const [loading, setLoading] = useState(true);
    const [myId, setMyId] = useState("");
    const [myPoints, setMyPoints] = useState(0);
    const [search, setSearch] = useState("");
    const [fl, setFl] = useState<"osusume" | "battle" | "level" | "streak">("osusume");
    const [selId, setSelId] = useState<string>("");
    const [tab, setTab] = useState<"guide" | "battle" | "growth" | "quest">("guide");
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [doneChId, setDoneChId] = useState<Set<string>>(new Set());
    const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
    const centerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setMyId(user.id);
            const [{ data: profiles }, { data: points }, { data: jsubs }, { data: chs }, { data: mySubs }] = await Promise.all([
                supabase.from("profiles").select("id, name, streak, avatar_config, island_config, licenses, job_class").eq("is_active", true),
                supabase.from("user_points").select("id, points, total_earned"),
                supabase.from("journey_submissions").select("user_id, step_no, status").eq("status", "approved"),
                supabase.from("challenges").select("id, title, category, points, icon").eq("is_active", true),
                supabase.from("challenge_submissions").select("challenge_id, status").eq("user_id", user.id),
            ]);
            const ptMap: Record<string, { points: number; te: number }> = {};
            (points || []).forEach((p: any) => { ptMap[p.id] = { points: p.points || 0, te: p.total_earned || 0 }; });
            const stepMap: Record<string, number> = {};
            (jsubs || []).forEach((s: any) => { stepMap[s.user_id] = Math.max(stepMap[s.user_id] || 0, s.step_no); });
            const list: GIsland[] = (profiles || []).map((p: any) => {
                const te = ptMap[p.id]?.te || 0;
                const job = (p.job_class as JobKey) || "knight";
                const ac = p.avatar_config;
                return {
                    id: p.id, name: p.name || "名無し", streak: p.streak || 0,
                    job, cfg: ac?.type === "layered" ? (ac as AvatarConfig) : null,
                    islandCfg: (p.island_config || {}) as IslandConfig,
                    licenses: (p.licenses || {}) as Record<string, boolean>,
                    level: getLevel(te), stepNo: stepMap[p.id] || 0, totalEarned: te,
                    element: castleElementOf(p.id),
                };
            });
            setIslands(list);
            setMyPoints(ptMap[user.id]?.points || 0);
            setChallenges((chs || []) as Challenge[]);
            setDoneChId(new Set((mySubs || []).filter((s: any) => s.status === "approved").map((s: any) => s.challenge_id)));
            // 攻略目標（ブラウザ内保存）
            let tgt: { id: string; name: string } | null = null;
            try { tgt = JSON.parse(localStorage.getItem(TARGET_KEY) || "null"); } catch {}
            if (tgt && list.some((i) => i.id === tgt!.id)) setTarget(tgt);
            const firstOther = list.filter((i) => i.id !== user.id).sort((a, b) => b.stepNo - a.stepNo || b.level - a.level)[0];
            setSelId(tgt && list.some((i) => i.id === tgt!.id) ? tgt.id : firstOther?.id || list[0]?.id || "");
            setLoading(false);
        };
        load();
    }, [router]);

    const filtered = useMemo(() => {
        let l = islands.filter((i) => i.name.includes(search));
        if (fl === "battle") l = l.filter((i) => i.id !== myId);
        return [...l].sort((a, b) =>
            fl === "level" ? b.level - a.level :
            fl === "streak" ? b.streak - a.streak :
            b.stepNo - a.stepNo || b.level - a.level);
    }, [islands, search, fl, myId]);

    const sel = islands.find((i) => i.id === selId) || null;
    const isSelf = sel?.id === myId;

    const pick = (id: string) => {
        setSelId(id);
        if (typeof window !== "undefined" && window.innerWidth < 980) {
            setTimeout(() => centerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
        }
    };
    const randomPick = () => {
        const pool = filtered.filter((i) => i.id !== myId);
        if (pool.length) pick(pool[Math.floor(Math.random() * pool.length)].id);
    };
    const saveTarget = () => {
        if (!sel || isSelf) return;
        const t = { id: sel.id, name: sel.name };
        setTarget(t);
        try { localStorage.setItem(TARGET_KEY, JSON.stringify(t)); } catch {}
    };
    const clearTarget = () => { setTarget(null); try { localStorage.removeItem(TARGET_KEY); } catch {} };

    // ===== 攻略情報（battle.ts 準拠） =====
    const guide = useMemo(() => {
        if (!sel) return null;
        const weak = weakOf(sel.element);
        // ×0.5しか通らない属性＝城の属性が一方的に有利を取る属性（光⇔闇のような相互有利ペアには存在しない）
        const resist = ADVANTAGE[sel.element].find((e) => elementMultiplier(e, sel.element) < 1) ?? null;
        const recs = recommendWeapons(sel.element);
        const dif = difficultyOf(sel.element);
        const castle = getCastleStage(sel.totalEarned);
        const advice: string[] = [
            `この城は${ELEMENTS[weak].name}属性の攻撃に弱い（ダメージ×${BATTLE_CONFIG.multAdvantage.toFixed(1)}）。「${recs[0].w.name}」で攻めると有利です`,
        ];
        if (resist) advice.push(`${ELEMENTS[resist].name}属性の攻撃は×${BATTLE_CONFIG.multDisadvantage.toFixed(1)}しか通らないので避けましょう`);
        else advice.push(`${ELEMENTS[sel.element].name}と${ELEMENTS[weak].name}はたがいに有利。${ELEMENTS[weak].name}武器なら大ダメージが狙えます`);
        advice.push(`城HP${BATTLE_CONFIG.castleBaseHp}を削るには「${dif.best.w.name}」で約${dif.hits}回の攻撃が必要（1日${BATTLE_CONFIG.attacksPerDay}回まで）`);
        if (recs[0].w.skill) advice.push(`「${recs[0].w.name}」は確率で${SKILLS[recs[0].w.skill!].name}（${SKILLS[recs[0].w.skill!].desc}）が発動します`);
        return { weak, resist, recs, dif, castle, advice };
    }, [sel]);

    // ===== クエスト提案（実在報酬のみ） =====
    const questRecs = useMemo(() => {
        return challenges
            .filter((c) => !doneChId.has(c.id))
            .sort((a, b) => (b.points || 0) - (a.points || 0))
            .slice(0, 3);
    }, [challenges, doneChId]);
    const questSum = questRecs.reduce((s, c) => s + (c.points || 0), 0);

    if (loading) {
        return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#7fc3ef", color: "#fff", fontWeight: 900, fontSize: 16 }}>🏝️ ギルドの地図をひらいています...</div>;
    }

    const Face = ({ i, size }: { i: GIsland; size: number }) => (
        <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", border: "2px solid #F5D77E", background: "#dbeafe", flexShrink: 0 }}>
            <img src={`/jobs/${i.job}.webp`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
        </div>
    );

    return (
        <div className="gx-root">
            <style>{CSS}</style>

            {/* ヘッダー */}
            <div className="gx-head">
                <div className="gx-title">
                    <img className="gx-emblem" src={GUILD_IMG.emblem} alt="" />
                    <div>
                        <h1>みんなの島へ行く</h1>
                        <p>仲間の島を訪問し、交流・バトル・攻略を楽しもう</p>
                    </div>
                </div>
                <div className="gx-head-r">
                    {target && (
                        <button className="gx-target-chip" onClick={() => pick(target.id)} title="攻略目標の島を表示">
                            <img src={GUILD_IMG.target} alt="" style={{ width: 17, height: 17, verticalAlign: "-3px" }} /> 目標：{target.name}の島 <span onClick={(e) => { e.stopPropagation(); clearTarget(); }}>×</span>
                        </button>
                    )}
                    <button className="gx-head-btn" onClick={() => router.push("/ranking")}>🏆 ランキング</button>
                    <button className="gx-head-btn" onClick={() => router.push("/home")}>🏠 ホームへ</button>
                </div>
            </div>

            <div className="gx-grid">
                {/* ===== 左：島探索パネル ===== */}
                <aside className="gx-left">
                    <div className="gx-panel gx-search">
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 ユーザー名で検索" />
                        <div className="gx-chips">
                            {([["osusume", "⭐ おすすめ"], ["battle", "⚔️ バトル対象"], ["level", "📈 レベル順"], ["streak", "🔥 連続記録順"]] as const).map(([k, l]) => (
                                <button key={k} className={"gx-chip" + (fl === k ? " gx-chip-on" : "")} onClick={() => setFl(k)}>{l}</button>
                            ))}
                            <button className="gx-chip gx-chip-rand" onClick={randomPick}>🎲 ランダム</button>
                        </div>
                    </div>
                    <div className="gx-list">
                        {filtered.map((i) => {
                            const castle = getCastleStage(i.totalEarned);
                            return (
                                <button key={i.id} className={"gx-card" + (i.id === selId ? " gx-card-on" : "")} onClick={() => pick(i.id)}>
                                    <Face i={i} size={46} />
                                    <span className="gx-card-mid">
                                        <span className="gx-card-name">{i.name}{i.id === myId && <i className="gx-you">自分</i>}</span>
                                        <span className="gx-card-sub">Lv.{i.level}・{jobName(i.job)}</span>
                                        <span className="gx-card-sub2"><span className="gx-rank"><img src={GUILD_IMG.rankNone} alt="" />未ランク</span><span style={{ color: ELEMENTS[i.element].color, fontWeight: 900 }}><ElIco k={i.element} size={12} /> {ELEMENTS[i.element].name}</span></span>
                                    </span>
                                    <span className="gx-card-castle">
                                        <img src={castle.img} alt="" />
                                        <i>第{castle.stage}段階</i>
                                    </span>
                                </button>
                            );
                        })}
                        {filtered.length === 0 && <div className="gx-empty">見つかりませんでした</div>}
                    </div>
                </aside>

                {/* ===== 中央：選択した島 ===== */}
                <main className="gx-center" ref={centerRef}>
                    {sel && (
                        <div className="gx-panel gx-sel">
                            <div className="gx-sel-head">
                                <div className="gx-sel-ava">
                                    {sel.cfg
                                        ? <AvatarLayered config={sel.cfg} job={sel.job} size="100%" />
                                        : <img src={`/jobs/${sel.job}.webp`} alt="" style={{ width: "100%", display: "block" }} />}
                                </div>
                                <div className="gx-sel-info">
                                    <div className="gx-sel-name">👑 {sel.name} <span>の島</span></div>
                                    <div className="gx-sel-chips">
                                        <span className="gx-pill gx-pill-lv">Lv.{sel.level}</span>
                                        <span className="gx-pill gx-pill-job">{jobName(sel.job)}</span>
                                        <span className="gx-pill gx-pill-rank"><img src={GUILD_IMG.rankNone} alt="" style={{ width: 16, height: 16 }} />未ランク</span>
                                        <span className="gx-pill" style={{ color: ELEMENTS[sel.element].color, borderColor: ELEMENTS[sel.element].color }}><ElIco k={sel.element} size={13} /> {ELEMENTS[sel.element].name}属性の城</span>
                                    </div>
                                    <div className="gx-sel-meta">🔥 連続 {sel.streak}日 ／ 🏰 城 第{getCastleStage(sel.totalEarned).stage}段階 ／ 📍 {STEP_TITLE[sel.stepNo] || STEP_TITLE[0]}</div>
                                </div>
                            </div>

                            {/* HOMEと同じ島（DayIslandScene＝育成状態がそのまま反映される） */}
                            <div className="gx-island">
                                <DayIslandScene config={sel.islandCfg} totalEarned={sel.totalEarned} width="min(92%, 400px)" />
                            </div>

                            <div className="gx-btns">
                                <button className="gx-btn gx-btn-visit" onClick={() => router.push("/profile/" + sel.id)}>🏰 島を訪問<span>ホームを見る</span></button>
                                {!isSelf && <button className="gx-btn gx-btn-battle" onClick={() => router.push("/battle/" + sel.id)}>⚔️ バトルに挑む<span>城を攻めよう</span></button>}
                                {!isSelf && (target?.id === sel.id
                                    ? <button className="gx-btn gx-btn-target gx-btn-target-on" onClick={clearTarget}><img src={GUILD_IMG.target} alt="" style={{ width: 18, height: 18, verticalAlign: "-3px" }} /> 攻略目標 設定中<span>タップで解除</span></button>
                                    : <button className="gx-btn gx-btn-target" onClick={saveTarget}><img src={GUILD_IMG.target} alt="" style={{ width: 18, height: 18, verticalAlign: "-3px" }} /> 攻略目標にする<span>この端末に保存</span></button>)}
                            </div>
                        </div>
                    )}
                </main>

                {/* ===== 右：攻略情報タブ ===== */}
                <aside className="gx-right">
                    <div className="gx-tabs">
                        {([["guide", "攻略情報"], ["battle", "バトル情報"], ["growth", "成長状況"], ["quest", "クエスト提案"]] as const).map(([k, l]) => (
                            <button key={k} className={"gx-tab" + (tab === k ? " gx-tab-on" : "")} onClick={() => setTab(k)}>{l}</button>
                        ))}
                    </div>

                    {sel && guide && tab === "guide" && (
                        <div className="gx-panel">
                            <div className="gx-sec">🧭 攻略サマリー</div>
                            <div className="gx-rows">
                                <div className="gx-row"><span>攻略難易度</span><b>{"★".repeat(guide.dif.star)}{"☆".repeat(5 - guide.dif.star)} {guide.dif.label}</b></div>
                                <div className="gx-row"><span>城の属性</span><b style={{ color: ELEMENTS[sel.element].color }}><ElIco k={sel.element} size={14} /> {ELEMENTS[sel.element].name}</b></div>
                                <div className="gx-row"><span>弱点属性</span><b style={{ color: ELEMENTS[guide.weak].color }}><ElIco k={guide.weak} size={14} /> {ELEMENTS[guide.weak].name}（×{BATTLE_CONFIG.multAdvantage.toFixed(1)}）</b></div>
                                {guide.resist && <div className="gx-row"><span>通りにくい属性</span><b style={{ color: "#94a3b8" }}><ElIco k={guide.resist} size={14} /> {ELEMENTS[guide.resist].name}（×{BATTLE_CONFIG.multDisadvantage.toFixed(1)}）</b></div>}
                                <div className="gx-row"><span>城HP</span><b>{BATTLE_CONFIG.castleBaseHp}</b></div>
                                <div className="gx-row"><span>推奨武器</span><b>{guide.recs[0].w.name}</b></div>
                            </div>

                            <div className="gx-sec" style={{ marginTop: 14 }}>⚔️ おすすめ武器</div>
                            {guide.recs.map((r, idx) => (
                                <div key={r.w.key} className="gx-wcard">
                                    <WIco w={r.w} size={42} />
                                    <span className="gx-wmid">
                                        <span className="gx-wname">{r.w.name}{idx === 0 && <i>イチオシ</i>}</span>
                                        <span className="gx-wsub">攻撃 {r.w.atk}・{r.w.element ? <span style={{ color: ELEMENTS[r.w.element].color, fontWeight: 900 }}><ElIco k={r.w.element} size={11} /> {ELEMENTS[r.w.element].name}</span> : "無属性"}{r.w.skill && <>・{SKILLS[r.w.skill].name}</>}</span>
                                        <span className="gx-wreason">{r.mult > 1 ? `属性有利で期待ダメージ${r.dmg}` : r.mult < 1 ? "属性不利（非推奨）" : `安定の期待ダメージ${r.dmg}`}</span>
                                    </span>
                                    <span className={"gx-wmult" + (r.mult > 1 ? " gx-wmult-adv" : r.mult < 1 ? " gx-wmult-dis" : "")}>×{r.mult.toFixed(1)}</span>
                                </div>
                            ))}
                            <div className="gx-note">✅ 武器はすべて使用可能です（武器ショップ・バトルコインは今後のアップデートで導入予定）</div>

                            <div className="gx-sec" style={{ marginTop: 14 }}>💡 攻略アドバイス</div>
                            <ul className="gx-advice">
                                {guide.advice.map((a, i) => <li key={i}>{a}</li>)}
                            </ul>
                        </div>
                    )}

                    {sel && tab === "battle" && (
                        <div className="gx-panel">
                            <div className="gx-sec">⚔️ バトルのルール</div>
                            <div className="gx-rows">
                                <div className="gx-row"><span>城の基本HP</span><b>{BATTLE_CONFIG.castleBaseHp}</b></div>
                                <div className="gx-row"><span>攻撃回数</span><b>1日 {BATTLE_CONFIG.attacksPerDay}回まで</b></div>
                                <div className="gx-row"><span>クリティカル</span><b>×{BATTLE_CONFIG.critMult}</b></div>
                                <div className="gx-row"><span>勝利報酬</span><b>相手BPの{Math.round(BATTLE_CONFIG.lootRate * 100)}%（上限{BATTLE_CONFIG.lootCap}pt）</b></div>
                                <div className="gx-row"><span>敗北側の保護</span><b>シールド{BATTLE_CONFIG.shieldHours}時間</b></div>
                            </div>
                            <div className="gx-sec" style={{ marginTop: 14 }}>🔮 属性の相性（×{BATTLE_CONFIG.multAdvantage.toFixed(1)} 有利）</div>
                            <div className="gx-cycle">
                                {(["fire", "wind", "thunder", "water"] as const).map((k) => (
                                    <span key={k} className="gx-cyc"><span className="gx-cyc-el" style={{ borderColor: ELEMENTS[k].color }}><ElIco k={k} size={15} /><i>{ELEMENTS[k].name}</i></span><b>→</b></span>
                                ))}
                                <span className="gx-cyc-el" style={{ borderColor: ELEMENTS.fire.color }}><ElIco k="fire" size={15} /><i>炎</i></span>
                            </div>
                            <div className="gx-cycle" style={{ marginTop: 6 }}>
                                <span className="gx-cyc-el" style={{ borderColor: ELEMENTS.light.color }}><ElIco k="light" size={15} /><i>光</i></span>
                                <b style={{ color: "#b45309" }}>⇄</b>
                                <span className="gx-cyc-el" style={{ borderColor: ELEMENTS.dark.color }}><ElIco k="dark" size={15} /><i>闇</i></span>
                                <span style={{ fontSize: 10, fontWeight: 900, color: "#8b5cf6" }}>たがいに有利</span>
                            </div>
                            <div className="gx-note">🛠️ 報酬ポイントの付与・ランク戦は、次のアップデートで有効になります（今は城HPや戦績は記録されません）</div>
                        </div>
                    )}

                    {sel && tab === "growth" && (
                        <div className="gx-panel">
                            <div className="gx-sec">🌱 成長状況</div>
                            <div className="gx-rows">
                                <div className="gx-row"><span>レベル</span><b>Lv.{sel.level}</b></div>
                                <div className="gx-row"><span>冒険STEP</span><b>{STEP_TITLE[sel.stepNo] || STEP_TITLE[0]}</b></div>
                                <div className="gx-row"><span>連続記録</span><b>🔥 {sel.streak}日</b></div>
                                <div className="gx-row"><span>城の成長段階</span><b>第{getCastleStage(sel.totalEarned).stage}段階 / 5{getCastleStage(sel.totalEarned).isMax && "（MAX）"}</b></div>
                                <div className="gx-row"><span>バトル実績</span><b>未ランク（ランク戦は準備中）</b></div>
                            </div>
                            {(sel.licenses.ip || sel.licenses.cb || sel.licenses.sales) && (
                                <>
                                    <div className="gx-sec" style={{ marginTop: 14 }}>🎖️ 取得ライセンス</div>
                                    <div className="gx-lics">
                                        {sel.licenses.ip && <span className="gx-lic"><img src="/island/licenses/license_ip.png" alt="" />IP免許</span>}
                                        {sel.licenses.cb && <span className="gx-lic"><img src="/island/licenses/license_cb.png" alt="" />CB免許</span>}
                                        {sel.licenses.sales && <span className="gx-lic"><img src="/island/licenses/license_sales.png" alt="" />営業昇格</span>}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {sel && tab === "quest" && (
                        <div className="gx-panel">
                            <div className="gx-sec">📜 クエストで成長しよう</div>
                            <div className="gx-mypt">🪙 いまの所持ポイント <b>{myPoints.toLocaleString()}pt</b></div>
                            {questRecs.length > 0 && (
                                <>
                                    <div className="gx-qlabel">おすすめチャレンジ（達成で実際にptがもらえる）</div>
                                    {questRecs.map((c) => (
                                        <div key={c.id} className="gx-qcard">
                                            <span className="gx-qicon">{c.icon || "🏆"}</span>
                                            <span className="gx-qmid">
                                                <span className="gx-qname">{c.title}</span>
                                                <span className="gx-qsub">{c.category || "チャレンジ"}・承認で +{c.points}pt</span>
                                            </span>
                                            <button className="gx-qgo" onClick={() => router.push("/challenge")}>挑戦する</button>
                                        </div>
                                    ))}
                                    <div className="gx-qsum">上の{questRecs.length}件を達成すると合計 <b>+{questSum.toLocaleString()}pt</b></div>
                                </>
                            )}
                            <div className="gx-qlabel" style={{ marginTop: 10 }}>毎日コツコツ系</div>
                            <div className="gx-qcard">
                                <span className="gx-qicon">🧠</span>
                                <span className="gx-qmid"><span className="gx-qname">思考の試練</span><span className="gx-qsub">1問クリアごとに +5pt</span></span>
                                <button className="gx-qgo" onClick={() => router.push("/thinking")}>挑戦する</button>
                            </div>
                            <div className="gx-qcard">
                                <span className="gx-qicon">📚</span>
                                <span className="gx-qmid"><span className="gx-qname">魔法の図書館（学習）</span><span className="gx-qsub">コンテンツ完了の承認で +2pt</span></span>
                                <button className="gx-qgo" onClick={() => router.push("/learn")}>挑戦する</button>
                            </div>
                            {!isSelf && <div className="gx-note" style={{ marginTop: 10 }}>🎯 「攻略目標にする」で{sel.name}さんの島を保存すると、次に来たときもすぐ続きから確認できます</div>}
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}

const CSS = `
.gx-root{min-height:100vh;min-height:100dvh;background:#7fc3ef url(/images/onboarding/job-selection-bg.webp) center 26%/cover no-repeat fixed;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416;padding:16px 16px calc(40px + env(safe-area-inset-bottom));box-sizing:border-box}
.gx-head{max-width:1340px;margin:0 auto 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.gx-title{display:flex;align-items:center;gap:11px}
.gx-emblem{width:54px;height:54px;filter:drop-shadow(0 4px 10px rgba(16,47,112,.45))}
.gx-title h1{margin:0;font-size:24px;font-weight:900;color:#fff;text-shadow:0 2px 0 #1e3a8a,0 4px 14px rgba(16,47,112,.5)}
.gx-title p{margin:3px 0 0;font-size:12px;font-weight:800;color:#f0f6ff;text-shadow:0 1px 6px rgba(16,47,112,.6)}
.gx-head-r{display:flex;gap:8px;flex-wrap:wrap}
.gx-head-btn{padding:9px 16px;border-radius:999px;border:2px solid #F5D77E;background:linear-gradient(180deg,#2f6ad1,#1454B8);color:#fff;font-size:12.5px;font-weight:900;cursor:pointer;box-shadow:0 4px 12px rgba(16,47,112,.4)}
.gx-target-chip{padding:9px 14px;border-radius:999px;border:2px solid #F5D77E;background:linear-gradient(180deg,#9b6ae0,#7a3fd0);color:#fff;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 4px 12px rgba(122,63,208,.4)}
.gx-target-chip span{margin-left:6px;opacity:.85}
.gx-grid{max-width:1340px;margin:0 auto;display:grid;grid-template-columns:300px minmax(0,1fr) 360px;gap:14px;align-items:start}
.gx-left,.gx-center,.gx-right{min-width:0}
.gx-panel{background:rgba(255,249,237,.95);border:2px solid #D9A441;border-radius:18px;padding:14px;box-shadow:0 6px 18px rgba(16,47,112,.15)}
.gx-search input{width:100%;box-sizing:border-box;padding:11px 14px;border-radius:12px;border:2px solid #e7cf96;background:#fff;font-size:13px;font-weight:700;color:#2b2416;outline:none}
.gx-search input:focus{border-color:#1454B8}
.gx-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}
.gx-chip{padding:7px 11px;border-radius:999px;border:1.5px solid #e7cf96;background:#fff;font-size:11px;font-weight:900;color:#6b5a33;cursor:pointer}
.gx-chip-on{background:linear-gradient(180deg,#2f6ad1,#1454B8);border-color:#F5D77E;color:#fff}
.gx-chip-rand{border-color:#D9A441;color:#a16207;background:#fdf6e3}
.gx-list{margin-top:10px;display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 290px);overflow-y:auto;padding-right:2px}
.gx-list::-webkit-scrollbar{width:6px}
.gx-list::-webkit-scrollbar-thumb{background:rgba(217,164,65,.5);border-radius:999px}
.gx-card{display:flex;align-items:center;gap:9px;background:rgba(255,249,237,.96);border:2px solid #e7cf96;border-radius:15px;padding:9px 10px;cursor:pointer;text-align:left;transition:transform .13s,border-color .13s;width:100%;box-sizing:border-box}
.gx-card:hover{transform:translateY(-2px)}
.gx-card-on{border-color:#1454B8;box-shadow:0 0 0 2px rgba(20,84,184,.3),0 6px 14px rgba(16,47,112,.2)}
.gx-card-mid{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.gx-card-name{font-size:13px;font-weight:900;color:#1f2a44;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gx-you{font-style:normal;margin-left:5px;font-size:9px;font-weight:900;color:#15803d;background:#dcfce7;border-radius:999px;padding:1px 7px}
.gx-card-sub{font-size:10.5px;font-weight:800;color:#6b5a33}
.gx-card-sub2{display:flex;gap:7px;align-items:center;font-size:10px}
.gx-rank{display:inline-flex;align-items:center;gap:3px;font-weight:900;color:#64748b;background:#f1f5f9;border-radius:999px;padding:1px 7px;font-size:9px}
.gx-rank img{width:13px;height:13px}
.gx-card-castle{display:flex;flex-direction:column;align-items:center;gap:1px;flex-shrink:0}
.gx-card-castle img{width:44px;height:38px;object-fit:contain}
.gx-card-castle i{font-style:normal;font-size:8.5px;font-weight:900;color:#a16207}
.gx-empty{text-align:center;font-size:12px;font-weight:800;color:#8b7b4f;padding:14px}
.gx-sel-head{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.gx-sel-ava{width:92px;flex-shrink:0}
.gx-sel-info{flex:1;min-width:200px}
.gx-sel-name{font-size:19px;font-weight:900;color:#1f2a44}
.gx-sel-name span{font-size:13px;color:#6b5a33}
.gx-sel-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.gx-pill{display:inline-flex;align-items:center;gap:4px;padding:4px 11px;border-radius:999px;border:1.5px solid #e7cf96;background:#fff;font-size:11px;font-weight:900;color:#5b4a23}
.gx-pill-lv{background:#fdf6e3;border-color:#D9A441;color:#a16207}
.gx-pill-job{background:#eff6ff;border-color:#93c5fd;color:#1454B8}
.gx-pill-rank{background:#f1f5f9;border-color:#cbd5e1;color:#64748b}
.gx-sel-meta{margin-top:7px;font-size:11.5px;font-weight:800;color:#6b5a33}
.gx-island{margin-top:4px;display:flex;justify-content:center}
.gx-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:6px}
.gx-btn{min-width:150px;padding:12px 18px;border-radius:999px;border:2.5px solid #F5D77E;color:#fff;font-size:14.5px;font-weight:900;cursor:pointer;transition:transform .13s;text-align:center}
.gx-btn:hover{transform:translateY(-2px)}
.gx-btn span{display:block;font-size:10px;font-weight:800;opacity:.85;margin-top:1px}
.gx-btn-visit{background:linear-gradient(180deg,#2f6ad1,#1454B8);box-shadow:0 6px 16px rgba(16,47,112,.4)}
.gx-btn-battle{background:linear-gradient(180deg,#ef4444,#b91c1c);box-shadow:0 6px 16px rgba(185,28,28,.4)}
.gx-btn-target{background:linear-gradient(180deg,#9b6ae0,#7a3fd0);box-shadow:0 6px 16px rgba(122,63,208,.4)}
.gx-btn-target-on{filter:saturate(.7);border-color:#fff}
.gx-tabs{display:flex;gap:5px;margin-bottom:10px;flex-wrap:wrap}
.gx-tab{flex:1;min-width:76px;padding:10px 6px;border-radius:13px 13px 0 0;border:2px solid #e7cf96;border-bottom:none;background:rgba(255,249,237,.75);font-size:12px;font-weight:900;color:#8b7b4f;cursor:pointer}
.gx-tab-on{background:linear-gradient(180deg,#2f6ad1,#1454B8);border-color:#F5D77E;color:#fff}
.gx-sec{display:inline-block;background:linear-gradient(180deg,#dbeafe,#bfdbfe);border:1.5px solid #93c5fd;border-radius:999px;padding:4px 13px;font-size:12px;font-weight:900;color:#1e3a8a;margin-bottom:9px}
.gx-rows{display:flex;flex-direction:column;gap:2px}
.gx-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px dashed rgba(217,164,65,.35);font-size:12px}
.gx-row span{font-weight:800;color:#6b5a33}
.gx-row b{color:#1f2a44;text-align:right}
.gx-wcard{display:flex;align-items:center;gap:9px;background:#fff;border:1.5px solid #e7cf96;border-radius:13px;padding:9px 11px;margin-bottom:7px}
.gx-wmid{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.gx-wname{font-size:12.5px;font-weight:900;color:#1f2a44}
.gx-wname i{font-style:normal;margin-left:6px;font-size:9px;font-weight:900;color:#b45309;background:#fdf6e3;border:1px solid #D9A441;border-radius:999px;padding:1px 7px}
.gx-wsub{font-size:10.5px;font-weight:800;color:#6b5a33}
.gx-wreason{font-size:10px;font-weight:800;color:#15803d}
.gx-wmult{font-size:13px;font-weight:900;color:#64748b;flex-shrink:0}
.gx-wmult-adv{color:#dc2626}
.gx-wmult-dis{color:#94a3b8}
.gx-note{margin-top:9px;background:rgba(219,234,254,.6);border:1.5px solid #93c5fd;border-radius:11px;padding:8px 11px;font-size:10.5px;font-weight:800;color:#1e3a8a;line-height:1.65}
.gx-advice{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px}
.gx-advice li{font-size:11.5px;font-weight:800;color:#5b4a23;line-height:1.6}
.gx-cycle{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.gx-cyc{display:flex;align-items:center;gap:4px}
.gx-cyc b{color:#b45309}
.gx-cyc-el{display:inline-flex;flex-direction:column;align-items:center;border:2px solid;border-radius:11px;background:#fff;padding:3px 7px 1px;line-height:1.1}
.gx-cyc-el i{font-style:normal;font-size:8.5px;font-weight:900;color:#5b4a23}
.gx-lics{display:flex;gap:12px;flex-wrap:wrap}
.gx-lic{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;font-weight:900;color:#5b4a23}
.gx-lic img{width:46px;height:46px}
.gx-mypt{background:#fdf6e3;border:1.5px solid #D9A441;border-radius:11px;padding:8px 12px;font-size:12px;font-weight:900;color:#6b5a33;margin-bottom:10px}
.gx-mypt b{color:#a16207;font-size:15px}
.gx-qlabel{font-size:10.5px;font-weight:900;color:#8b7b4f;margin-bottom:6px}
.gx-qcard{display:flex;align-items:center;gap:9px;background:#fff;border:1.5px solid #e7cf96;border-radius:13px;padding:9px 11px;margin-bottom:7px}
.gx-qicon{font-size:22px;flex-shrink:0}
.gx-qmid{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.gx-qname{font-size:12.5px;font-weight:900;color:#1f2a44}
.gx-qsub{font-size:10.5px;font-weight:800;color:#b45309}
.gx-qgo{flex-shrink:0;padding:8px 13px;border-radius:999px;border:2px solid #F5D77E;background:linear-gradient(180deg,#2f6ad1,#1454B8);color:#fff;font-size:11px;font-weight:900;cursor:pointer}
.gx-qsum{text-align:center;background:#dcfce7;border:1.5px solid #86efac;border-radius:11px;padding:7px 10px;font-size:11.5px;font-weight:900;color:#15803d}
@media (max-width:1180px){
  .gx-grid{grid-template-columns:290px minmax(0,1fr)}
  .gx-right{grid-column:2}
}
@media (max-width:980px){
  .gx-grid{grid-template-columns:1fr}
  .gx-right{grid-column:1}
  .gx-list{max-height:none;flex-direction:row;overflow-x:auto;overflow-y:hidden;padding-bottom:6px;scroll-snap-type:x mandatory}
  .gx-card{min-width:235px;scroll-snap-align:start}
  .gx-title h1{font-size:20px}
  .gx-sel-ava{width:76px}
  .gx-btn{flex:1;min-width:130px;font-size:13px}
}
`;
