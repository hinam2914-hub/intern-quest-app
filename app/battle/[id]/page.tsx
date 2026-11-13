"use client";
// 島バトル画面（Phase 1 デモ版）
// ・実データは一切変更しない：HP・攻撃回数・獲得ポイントはすべて画面内のデモ表示
// ・読み取りのみ：相手/自分の profiles・user_points（名前・職業・レベル・城の成長段階の表示に使用）
// ・城の「成長段階（見た目）」は従来どおり total_earned 由来。バトル用HPは battle.ts の castleBaseHp で完全に別管理
// ・数値・属性・武器は app/lib/battle.ts に集約（Phase 2 でサーバー側計算へ移行）
// ・素材：ChatGPT制作の既存素材（/jobs/*.webp・castle-stage-*.webp・job-selection-bg.webp）のみ使用。
//   属性・武器・宝箱アイコンは納品までの仮として絵文字＋CSS（battle.ts の img にパスを入れると画像に切替）
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getLevel } from "../../lib/island";
import { getCastleStage } from "../../lib/castle";
import { JOBS, type JobKey } from "../../onboarding/job/page";
import AvatarLayered from "../../components/AvatarLayered";
import type { AvatarConfig } from "../../lib/avatar/catalog";
import {
    BATTLE_CONFIG, ELEMENTS, ELEMENT_ORDER, ADVANTAGE, WEAPONS, SKILLS, CHEST_IMG, loadWeaponShop, canUseWeapon, type WeaponShop,
    calcDamage, castleElementOf, elementMultiplier, DEMO_ATTACK_KEY, readBattleLog, writeBattleLog,
    type WeaponDef, type SkillKey,
} from "../../lib/battle";

type Who = { id: string; name: string; job: JobKey; level: number; totalEarned: number; cfg: AvatarConfig | null };

const jobName = (j: JobKey) => (JOBS.find((x) => x.key === j)?.name || "ナイト");
const todayStr = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }); // YYYY-MM-DD

type Pop = { id: number; text: string; kind: "dmg" | "crit" | "burn" | "heal" };
type Banner = { id: number; text: string; color: string; emoji: string };

export default function BattlePage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const oppId = String(params?.id || "");

    const [me, setMe] = useState<Who | null>(null);
    const [opp, setOpp] = useState<Who | null>(null);
    const [loading, setLoading] = useState(true);

    // ---- デモ用バトル状態（保存されない） ----
    const [hp, setHp] = useState<number>(BATTLE_CONFIG.castleBaseHp);
    const [attacksUsed, setAttacksUsed] = useState(0);
    const [weaponKey, setWeaponKey] = useState(WEAPONS[0].key);
    const [wshop, setWshop] = useState<WeaponShop>({ enabled: false, prices: {}, owned: new Set() });  // 武器ショップ（未導入なら全武器使用可）
    const [busy, setBusy] = useState(false);
    const [victory, setVictory] = useState(false);
    const [boosted, setBoosted] = useState(false);     // 攻撃2倍（次の1回）
    const [burnLeft, setBurnLeft] = useState(0);       // 相手のやけど残りターン
    const [pops, setPops] = useState<Pop[]>([]);
    const [banners, setBanners] = useState<Banner[]>([]);
    const [attacking, setAttacking] = useState(false); // キャラの攻撃モーション
    const [castleHit, setCastleHit] = useState(false); // 城の被弾シェイク
    const [beam, setBeam] = useState<string | null>(null); // 属性エフェクトの色
    const idRef = useRef(1);
    // サーバー保存モード：battle_server.sql が適用済みなら true（未適用の環境では従来の端末内デモで動く）
    const [server, setServer] = useState(false);
    const [shieldUntil, setShieldUntil] = useState<string | null>(null);

    const weapon = useMemo(() => WEAPONS.find((w) => w.key === weaponKey) || WEAPONS[0], [weaponKey]);
    const oppElement = useMemo(() => (oppId ? castleElementOf(oppId) : "fire"), [oppId]);
    const attacksLeft = Math.max(0, BATTLE_CONFIG.attacksPerDay - attacksUsed);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            if (user.id === oppId) { router.push("/islands"); return; } // 自分の島には攻撃できない
            const [{ data: profs }, { data: pts }] = await Promise.all([
                supabase.from("profiles").select("id, name, job_class, avatar_config").in("id", [user.id, oppId]),
                supabase.from("user_points").select("id, total_earned").in("id", [user.id, oppId]),
            ]);
            const pmap: Record<string, any> = {}; (profs || []).forEach((p: any) => { pmap[p.id] = p; });
            const tmap: Record<string, number> = {}; (pts || []).forEach((p: any) => { tmap[p.id] = p.total_earned || 0; });
            if (!pmap[oppId]) { router.push("/islands"); return; }
            const mk = (id: string): Who => {
                const job = (pmap[id]?.job_class as JobKey) || "knight";
                const ac = pmap[id]?.avatar_config;
                return {
                    id,
                    name: pmap[id]?.name || "名無し",
                    job,
                    level: getLevel(tmap[id] || 0),
                    totalEarned: tmap[id] || 0,
                    // 編集済みアバター（layered）があればそれを表示。なければ職業キャラにフォールバック
                    cfg: ac?.type === "layered" && JOBS.some((j) => j.key === job) ? (ac as AvatarConfig) : null,
                };
            };
            setMe(mk(user.id)); setOpp(mk(oppId));
            // 城の状態をサーバーから取得（HP・シールド・今日の残り攻撃回数）。関数が無ければ端末内デモにフォールバック
            const { data: st, error: stErr } = await supabase.rpc("battle_castle_state", { p_defender: oppId });
            if (!stErr && st) {
                setServer(true);
                setHp(Number((st as any).hp));
                setAttacksUsed(BATTLE_CONFIG.attacksPerDay - Number((st as any).attacks_left));
                setShieldUntil((st as any).shield_until || null);
            } else {
                try { setAttacksUsed(Number(localStorage.getItem(DEMO_ATTACK_KEY(todayStr())) || 0)); } catch {}
            }
            // 島探索ギルドの「装備して挑戦」から来た場合：?w=武器キー を事前選択
            // 持っている武器だけ選べる（未購入の武器は事前選択もしない）
            const ws = await loadWeaponShop(supabase, user.id);
            setWshop(ws);
            try { const w = new URLSearchParams(window.location.search).get("w"); if (w && WEAPONS.some((x) => x.key === w) && canUseWeapon(ws, w)) setWeaponKey(w); } catch {}
            setLoading(false);
        };
        load();
    }, [router, oppId]);

    const pushPop = (text: string, kind: Pop["kind"]) => {
        const id = idRef.current++;
        setPops((p) => [...p, { id, text, kind }]);
        setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1400);
    };
    const pushBanner = (text: string, color: string, emoji: string) => {
        const id = idRef.current++;
        setBanners((b) => [...b, { id, text, color, emoji }]);
        setTimeout(() => setBanners((b) => b.filter((x) => x.id !== id)), 1700);
    };

    const shieldActive = !!shieldUntil && new Date(shieldUntil).getTime() > Date.now();

    const useAttack = async () => {
        if (busy || victory || attacksLeft <= 0 || !opp || shieldActive) return;
        setBusy(true);

        // ---- 結果を決める：サーバー保存モードはサーバーが計算（クライアントの値は使わない）／未適用環境は端末内デモ ----
        let r: { dmg: number; mult: number; crit: boolean; skill: SkillKey | null; hits: number; next: number; used: number; boostedNow: boolean; burnTick: boolean };
        if (server) {
            const { data, error } = await supabase.rpc("battle_attack", { p_defender: oppId, p_weapon: weapon.key });
            if (error || !data) {
                const m = error?.message || "";
                if (m.includes("SHIELD")) { pushBanner("この城は保護シールド中です", "#38bdf8", "🛡️"); setShieldUntil(new Date(Date.now() + 60000).toISOString()); }
                else if (m.includes("NOT_OWNED")) { pushBanner("この武器はまだ持っていません", "#94a3b8", "🔒"); setWeaponKey(WEAPONS[0].key); }
                else if (m.includes("DAILY_LIMIT")) { pushBanner("今日の攻撃回数を使い切りました", "#94a3b8", "🌙"); setAttacksUsed(BATTLE_CONFIG.attacksPerDay); }
                else pushBanner("通信に失敗しました。もう一度お試しください", "#94a3b8", "⚠️");
                setBusy(false);
                return;
            }
            const d = data as any;
            r = { dmg: d.damage, mult: Number(d.mult), crit: !!d.crit, skill: (d.skill as SkillKey) || null, hits: d.hits, next: d.hp_after, used: BATTLE_CONFIG.attacksPerDay - d.attacks_left, boostedNow: false, burnTick: false };
            if (d.won) setShieldUntil(new Date(Date.now() + BATTLE_CONFIG.shieldHours * 3600 * 1000).toISOString());
        } else {
            const res = calcDamage(weapon, oppElement);
            const dmg = boosted ? res.dmg * 2 : res.dmg;
            const extra = burnLeft > 0 ? BATTLE_CONFIG.burnDamage : 0;
            const used = attacksUsed + 1;
            try { localStorage.setItem(DEMO_ATTACK_KEY(todayStr()), String(used)); } catch {}
            r = { dmg, mult: res.mult, crit: res.crit, skill: res.skillFired, hits: res.hits, next: Math.max(0, hp - dmg - extra), used, boostedNow: boosted, burnTick: extra > 0 };
        }

        setAttacksUsed(r.used);
        setAttacking(true);
        setBeam(weapon.element ? ELEMENTS[weapon.element].glow : "rgba(255,255,255,.85)");

        // 演出：キャラ攻撃 → エフェクト → 着弾
        setTimeout(() => {
            setAttacking(false); setBeam(null); setCastleHit(true);
            setTimeout(() => setCastleHit(false), 450);

            if (r.mult > 1) pushBanner(`属性有利！ダメージ×${BATTLE_CONFIG.multAdvantage.toFixed(1)}`, "#f472b6", ELEMENTS[weapon.element!].emoji);
            if (r.mult < 1) pushBanner(`属性不利… ダメージ×${BATTLE_CONFIG.multDisadvantage.toFixed(1)}`, "#94a3b8", "💨");
            if (r.boostedNow) { pushBanner("攻撃2倍 発動中！", "#f59e0b", "🌟"); setBoosted(false); }
            if (r.crit) { pushBanner(`クリティカル！ -${r.dmg}`, "#ef4444", "💥"); pushPop(`-${r.dmg}`, "crit"); }
            else pushPop(`-${r.dmg}`, "dmg");
            if (r.skill && r.skill !== "double") pushBanner(`${SKILLS[r.skill].name} 発動！`, SKILLS[r.skill].color, SKILLS[r.skill].emoji);
            if (r.hits === 2) pushBanner("2回攻撃！", "#64748b", "⚔️");
            if (r.skill === "burn" && !server) setBurnLeft(BATTLE_CONFIG.burnTurns);
            if (r.skill === "heal") pushPop(`+${BATTLE_CONFIG.healAmount}`, "heal");
            if (r.burnTick) {
                setBurnLeft((t) => Math.max(0, t - 1));
                setTimeout(() => pushPop(`-${BATTLE_CONFIG.burnDamage} やけど`, "burn"), 500);
            }

            setHp(r.next);
            if (r.next <= 0) setTimeout(() => setVictory(true), 900);
            // 攻略ミッション用の記録（この端末内）：挑戦回数／勝利／連続勝利。回数を使い切って落とせなければ連勝リセット
            const log = readBattleLog(oppId);
            log.attempts += 1;
            if (r.next <= 0) { log.wins += 1; log.streak += 1; log.bestStreak = Math.max(log.bestStreak, log.streak); }
            else if (r.used >= BATTLE_CONFIG.attacksPerDay) { log.streak = 0; }
            writeBattleLog(oppId, log);
            setTimeout(() => setBusy(false), 650); // アニメ後は必ず操作可能に戻す
        }, 620);
    };

    const previewSkill = (k: SkillKey) => {
        if (busy) return;
        const s = SKILLS[k];
        if (k === "boost" && !server) { setBoosted(true); pushBanner("攻撃2倍！次の攻撃が強化される", s.color, s.emoji); return; }
        if (k === "heal") { pushBanner(`回復魔法！城のHPが${BATTLE_CONFIG.healAmount}回復`, s.color, s.emoji); return; }
        if (k === "guard") { pushBanner(`防御魔法発動！ダメージ${Math.round(BATTLE_CONFIG.guardCut * 100)}%カット`, s.color, s.emoji); return; }
        pushBanner(`${s.name}！ ${s.desc}`, s.color, s.emoji);
    };

    const resetDemo = () => {
        setHp(BATTLE_CONFIG.castleBaseHp); setVictory(false); setBurnLeft(0); setBoosted(false);
        setAttacksUsed(0);
        try { localStorage.setItem(DEMO_ATTACK_KEY(todayStr()), "0"); } catch {}
    };

    if (loading || !me || !opp) {
        return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#7fc3ef", color: "#fff", fontWeight: 900 }}>⚔️ バトル準備中...</div>;
    }

    const castle = getCastleStage(opp.totalEarned); // 見た目は従来の成長段階（HPとは別管理）
    const oppEl = ELEMENTS[oppElement];

    const elIcon = (k: keyof typeof ELEMENTS, size = 15) => {
        const e = ELEMENTS[k];
        return e.img ? <img src={e.img} alt={e.name} style={{ width: size, height: size, verticalAlign: "-2px" }} /> : <span>{e.emoji}</span>;
    };
    const wIcon = (w: WeaponDef, size = 34) => w.img ? <img src={w.img} alt={w.name} style={{ width: size, height: size, objectFit: "contain" }} /> : <span style={{ fontSize: size * 0.8 }}>{w.emoji}</span>;

    return (
        <div className="bt-root">
            <style>{CSS}</style>

            {/* ヘッダー */}
            <div className="bt-head">
                <button className="bt-back" onClick={() => router.push("/islands")}>← 島一覧へ</button>
                <div className="bt-logo"><span className="bt-logo-main">⚔️ 島バトル</span><span className="bt-logo-sub">ISLAND WARS</span></div>
            </div>
            <div className="bt-catch">島を攻めてポイントを奪おう！<span>武器・属性・スキルを選んで、相手の城を攻撃！</span></div>

            <div className="bt-grid">
                {/* ===== 左：自分の情報 ===== */}
                <aside className="bt-left">
                    <div className="bt-panel bt-mecard">
                        <img className="bt-meface" src={`/jobs/${me.job}.webp`} alt="" />
                        <div>
                            <div className="bt-mename">{me.name}</div>
                            <div className="bt-mejob">{jobName(me.job)} <b>Lv.{me.level}</b></div>
                        </div>
                    </div>
                    <div className="bt-panel">
                        <div className="bt-row"><span>🪙 バトルポイント</span><b>ー</b></div>
                        <div className="bt-row"><span>💎 バトルコイン</span><b>ー</b></div>
                        <div className="bt-row"><span>🗡️ 装備中の武器</span><b>{weapon.name}</b></div>
                        <div className="bt-row"><span>⚡ 残り攻撃回数</span><b className={attacksLeft === 0 ? "bt-zero" : ""}>{attacksLeft} / {BATTLE_CONFIG.attacksPerDay} 回</b></div>
                    </div>
                    <div className="bt-panel bt-menu">
                        <div className="bt-menu-title">今後のメニュー</div>
                        {["🏰 自分の島（育成・防衛）", "🛒 武器ショップ", "🏆 ランキング", "📜 バトル履歴", "🎁 報酬・シーズン"].map((m) => (
                            <div key={m} className="bt-menu-item">{m}<span>準備中</span></div>
                        ))}
                    </div>
                </aside>

                {/* ===== 中央：バトル演出 ===== */}
                <main className="bt-center">
                    {/* VS ヘッダー */}
                    <div className="bt-vs">
                        <div className="bt-vs-side">
                            <img src={`/jobs/${me.job}.webp`} alt="" />
                            <div><div className="bt-vs-name">自分の島 <b>Lv.{me.level}</b></div><div className="bt-vs-pt">⭐ バトルポイント —</div></div>
                        </div>
                        <div className="bt-vs-mark">VS</div>
                        <div className="bt-vs-side bt-vs-right">
                            <div><div className="bt-vs-name">{opp.name}の島 <b>Lv.{opp.level}</b></div><div className="bt-vs-pt">⭐ バトルポイント —</div></div>
                            <img src={`/jobs/${opp.job}.webp`} alt="" />
                        </div>
                    </div>

                    {/* ステージ */}
                    <div className="bt-stage">
                        {/* 敵城HP */}
                        <div className="bt-hpwrap">
                            <div className="bt-hplabel">敵の城HP <b>{hp} / {BATTLE_CONFIG.castleBaseHp}</b>{burnLeft > 0 && <span className="bt-burn">🔥やけど{burnLeft}</span>}</div>
                            <div className="bt-hpbar"><div className="bt-hpfill" style={{ width: (hp / BATTLE_CONFIG.castleBaseHp) * 100 + "%", background: hp > 50 ? "linear-gradient(90deg,#4ade80,#22c55e)" : hp > 20 ? "linear-gradient(90deg,#fbbf24,#f59e0b)" : "linear-gradient(90deg,#f87171,#ef4444)" }} /></div>
                        </div>

                        {/* 自キャラ：設定済みアバター（なければ職業キャラ） */}
                        <div className={"bt-hero" + (attacking ? " bt-hero-atk" : "")}>
                            {me.cfg
                                ? <AvatarLayered config={me.cfg} job={me.job} size="100%" />
                                : <img src={`/jobs/${me.job}.webp`} alt="" style={{ width: "100%", display: "block" }} />}
                        </div>

                        {/* 属性エフェクト（仮素材：CSS光弾。画像納品後に差し替え） */}
                        {beam && <div className="bt-beam" style={{ background: `radial-gradient(circle, #fff, ${beam})`, boxShadow: `0 0 18px 6px ${beam}` }} />}

                        {/* 敵の浮遊島と城 */}
                        <div className={"bt-islet" + (castleHit ? " bt-islet-hit" : "")}>
                            <img className="bt-castle" src={castle.img} alt="" style={{ width: castle.w * 1.15 }} />
                            <div className="bt-ground" />
                            <div className="bt-elbadge" style={{ borderColor: oppEl.color, color: oppEl.color }}>{elIcon(oppElement, 14)} {oppEl.name}属性</div>
                        </div>

                        {/* ダメージ数値 */}
                        <div className="bt-pops">
                            {pops.map((p) => <div key={p.id} className={"bt-pop bt-pop-" + p.kind}>{p.text}</div>)}
                        </div>
                        {/* 中央バナー（特殊効果・相性） */}
                        <div className="bt-banners">
                            {banners.map((b) => <div key={b.id} className="bt-banner" style={{ borderColor: b.color, color: b.color }}>{b.emoji} {b.text}</div>)}
                        </div>

                        {/* 勝利演出 */}
                        {victory && (
                            <div className="bt-win">
                                <div className="bt-win-rays" />
                                <div className="bt-win-chest">{CHEST_IMG ? <img src={CHEST_IMG} alt="" style={{ width: 150, height: 150, objectFit: "contain" }} /> : "🎁"}</div>
                                <div className="bt-win-title">VICTORY!</div>
                                <div className="bt-win-sub">城を落とした！</div>
                                <div className="bt-win-reward">🛡️ 相手の城に{BATTLE_CONFIG.shieldHours}時間の保護シールド{server && <><br />📣 {opp.name}さんに通知が届きました</>}</div>
                                {server
                                    ? <button className="bt-win-btn" onClick={() => router.push("/islands")}>島一覧へもどる</button>
                                    : <button className="bt-win-btn" onClick={resetDemo}>もう一度バトルする</button>}
                            </div>
                        )}
                    </div>

                    {/* スキル一覧（タップでデモ演出） */}
                    <div className="bt-skills">
                        {(Object.keys(SKILLS) as SkillKey[]).map((k) => (
                            <button key={k} className="bt-skill" onClick={() => previewSkill(k)} title={SKILLS[k].desc} style={{ borderColor: SKILLS[k].color }}>
                                <span className="bt-skill-ico">{SKILLS[k].img ? <img src={SKILLS[k].img!} alt="" /> : SKILLS[k].emoji}</span>
                                <span className="bt-skill-name">{SKILLS[k].name}</span>
                            </button>
                        ))}
                    </div>

                    {/* 攻撃ボタン */}
                    <button className={"bt-attack" + (busy || victory || attacksLeft <= 0 || shieldActive ? " bt-attack-off" : "")} onClick={useAttack}>
                        ⚔️ 攻撃する
                        <span>{shieldActive && !victory ? "🛡️ この城は保護シールド中です" : <>本日の残り {attacksLeft}/{BATTLE_CONFIG.attacksPerDay} 回{attacksLeft <= 0 && "（また明日！）"}</>}</span>
                    </button>
                </main>

                {/* ===== 右：武器・相性 ===== */}
                <aside className="bt-right">
                    <div className="bt-panel">
                        <div className="bt-ptitle">🗡️ 武器を選択</div>
                        <div className="bt-weapons">
                            {WEAPONS.map((w) => canUseWeapon(wshop, w.key) ? (
                                <button key={w.key} className={"bt-weapon" + (w.key === weaponKey ? " bt-weapon-on" : "")} onClick={() => setWeaponKey(w.key)}>
                                    <span className="bt-weapon-ico">{wIcon(w)}</span>
                                    <span className="bt-weapon-name">{w.name}</span>
                                    <span className="bt-weapon-el" style={{ color: w.element ? ELEMENTS[w.element].color : "#94a3b8" }}>
                                        {w.element ? <>{elIcon(w.element, 12)} {ELEMENTS[w.element].name}</> : "無"}
                                    </span>
                                </button>
                            ) : (
                                <button key={w.key} className="bt-weapon bt-weapon-lock" onClick={() => router.push("/shop")} title="ショップで購入すると使えます">
                                    <span className="bt-weapon-ico">{wIcon(w)}</span>
                                    <span className="bt-weapon-name">{w.name}</span>
                                    <span className="bt-weapon-el" style={{ color: "#a16207" }}>🔒 {(wshop.prices[w.key] ?? 0).toLocaleString()}pt</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="bt-panel">
                        <div className="bt-ptitle">🔮 属性の相性</div>
                        <div className="bt-cycle">
                            {(["fire", "wind", "thunder", "water"] as const).map((k, i) => (
                                <span key={k} className="bt-cyc-item">
                                    <span className="bt-cyc-el" style={{ borderColor: ELEMENTS[k].color }}>{elIcon(k, 16)}<i>{ELEMENTS[k].name}</i></span>
                                    <span className="bt-cyc-arrow">→</span>
                                </span>
                            ))}
                            <span className="bt-cyc-el" style={{ borderColor: ELEMENTS.fire.color }}>{elIcon("fire", 16)}<i>炎</i></span>
                        </div>
                        <div className="bt-cycle" style={{ marginTop: 6 }}>
                            <span className="bt-cyc-el" style={{ borderColor: ELEMENTS.light.color }}>{elIcon("light", 16)}<i>光</i></span>
                            <span className="bt-cyc-arrow">⇄</span>
                            <span className="bt-cyc-el" style={{ borderColor: ELEMENTS.dark.color }}>{elIcon("dark", 16)}<i>闇</i></span>
                            <span className="bt-cyc-note">たがいに有利</span>
                        </div>
                        <div className="bt-legend">
                            <span style={{ color: "#ef4444" }}>◎ 有利 ×{BATTLE_CONFIG.multAdvantage.toFixed(1)}</span>
                            <span style={{ color: "#3b82f6" }}>○ 通常 ×{BATTLE_CONFIG.multNormal.toFixed(1)}</span>
                            <span style={{ color: "#64748b" }}>✕ 不利 ×{BATTLE_CONFIG.multDisadvantage.toFixed(1)}</span>
                        </div>
                    </div>
                    <div className="bt-panel">
                        <div className="bt-ptitle">📖 武器の効果（{weapon.name}）</div>
                        <div className="bt-wdetail">
                            <div className="bt-row"><span>攻撃力</span><b>{weapon.atk}</b></div>
                            <div className="bt-row"><span>属性</span><b style={{ color: weapon.element ? ELEMENTS[weapon.element].color : "#94a3b8" }}>{weapon.element ? <>{elIcon(weapon.element, 13)} {ELEMENTS[weapon.element].name}</> : "無属性"}</b></div>
                            <div className="bt-row"><span>相手の城への相性</span><b>×{elementMultiplier(weapon.element, oppElement).toFixed(1)}</b></div>
                            <div className="bt-wdesc">{weapon.desc}{weapon.skill ? `（発動率${Math.round(weapon.skillRate * 100)}%）` : ""}</div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

const CSS = `
.bt-root{min-height:100vh;min-height:100dvh;background:#7fc3ef url(/images/onboarding/job-selection-bg.webp) center 30%/cover no-repeat fixed;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#2b2416;padding:14px 16px calc(28px + env(safe-area-inset-bottom));box-sizing:border-box}
.bt-head{display:flex;align-items:center;gap:12px;max-width:1240px;margin:0 auto;flex-wrap:wrap}
.bt-back{border:1.5px solid rgba(30,58,138,.35);background:rgba(255,255,255,.85);color:#1e3a8a;font-weight:900;font-size:12.5px;border-radius:999px;padding:8px 14px;cursor:pointer}
.bt-logo{background:linear-gradient(180deg,#1e3a8a,#172a63);border:2px solid #fcd34d;border-radius:14px;padding:6px 16px;display:flex;flex-direction:column;align-items:center;box-shadow:0 4px 14px rgba(23,42,99,.35)}
.bt-logo-main{color:#fde68a;font-weight:900;font-size:17px;letter-spacing:1px}
.bt-logo-sub{color:#93c5fd;font-weight:800;font-size:8.5px;letter-spacing:3px}
.bt-demo-badge{margin-left:auto;background:rgba(255,243,199,.95);border:1px solid #f59e0b;color:#92400e;font-weight:900;font-size:11px;border-radius:999px;padding:6px 12px}
.bt-catch{max-width:1240px;margin:12px auto 14px;text-align:center;background:rgba(255,255,255,.88);border:2px solid #fcd34d;border-radius:16px;padding:10px 14px;font-weight:900;font-size:17px;color:#b45309;box-shadow:0 4px 16px rgba(120,80,0,.12)}
.bt-catch span{display:block;font-size:11.5px;color:#6b5a33;font-weight:700;margin-top:2px}
.bt-grid{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:250px 1fr 290px;gap:14px;align-items:start}
.bt-panel{background:rgba(255,252,240,.94);border:2px solid #e7cf96;border-radius:16px;padding:12px 14px;box-shadow:0 4px 14px rgba(120,80,0,.1);margin-bottom:12px}
.bt-ptitle{font-size:13px;font-weight:900;color:#1e3a8a;background:linear-gradient(180deg,#dbeafe,#bfdbfe);border:1px solid #93c5fd;border-radius:999px;padding:4px 12px;display:inline-block;margin-bottom:10px}
.bt-row{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;font-weight:800;color:#5b4a23;padding:5px 0}
.bt-row b{color:#1f2a44}
.bt-row i{font-size:9.5px;color:#a16207;font-style:normal}
.bt-zero{color:#dc2626!important}
.bt-mecard{display:flex;align-items:center;gap:10px}
.bt-meface{width:62px;height:62px;border-radius:50%;object-fit:cover;object-position:top;border:2.5px solid #fcd34d;background:#dbeafe}
.bt-mename{font-size:15px;font-weight:900;color:#1f2a44}
.bt-mejob{font-size:11.5px;font-weight:800;color:#6b5a33;margin-top:2px}
.bt-mejob b{color:#b45309}
.bt-menu-title{font-size:11px;font-weight:900;color:#a16207;margin-bottom:6px}
.bt-menu-item{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:800;color:#9a8a5c;padding:7px 10px;border:1px dashed #e7cf96;border-radius:10px;margin-bottom:6px;background:rgba(255,255,255,.5)}
.bt-menu-item span{font-size:9.5px;color:#c2a86a;font-weight:900}
.bt-vs{display:flex;align-items:center;justify-content:space-between;gap:8px;background:linear-gradient(180deg,#1e3a8a,#25449c);border:2px solid #fcd34d;border-radius:16px;padding:8px 14px;color:#fff;box-shadow:0 6px 18px rgba(23,42,99,.35)}
.bt-vs-side{display:flex;align-items:center;gap:9px;min-width:0;flex:1}
.bt-vs-side>div{min-width:0}
.bt-vs-side img{width:44px;height:44px;border-radius:50%;object-fit:cover;object-position:top;border:2px solid #fcd34d;background:#dbeafe}
.bt-vs-name{font-size:13px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-vs-name b{color:#fde68a}
.bt-vs-pt{font-size:10.5px;font-weight:800;color:#bfdbfe;margin-top:1px}
.bt-vs-right{text-align:right}
.bt-vs-mark{font-size:21px;font-weight:900;color:#fde68a;text-shadow:0 2px 8px rgba(0,0,0,.4);flex-shrink:0}
.bt-stage{position:relative;margin-top:12px;height:400px;border-radius:20px;border:3px solid #fcd34d;overflow:hidden;background:linear-gradient(180deg,#8ecdf3 0%,#aedcf7 45%,#cfeafc 100%);box-shadow:0 8px 24px rgba(23,42,99,.25)}
.bt-hpwrap{position:absolute;top:12px;right:14px;width:min(46%,250px);z-index:6}
.bt-hplabel{display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:900;color:#7f1d1d;background:rgba(255,255,255,.9);border:1.5px solid #fca5a5;border-radius:8px 8px 0 0;padding:3px 8px}
.bt-burn{color:#dc2626;font-size:9.5px}
.bt-hpbar{height:13px;background:rgba(60,20,20,.75);border:1.5px solid #fca5a5;border-top:none;border-radius:0 0 8px 8px;overflow:hidden}
.bt-hpfill{height:100%;transition:width .5s ease}
.bt-hero{position:absolute;left:4%;bottom:6%;width:min(34%,205px);filter:drop-shadow(0 14px 14px rgba(30,40,80,.35));transition:transform .18s ease;z-index:4}
.bt-hero-atk{transform:translateX(26px) rotate(-4deg) scale(1.04)}
.bt-beam{position:absolute;left:30%;bottom:36%;width:26px;height:26px;border-radius:50%;z-index:5;animation:btBeam .62s ease-in forwards}
@keyframes btBeam{0%{transform:translate(0,0) scale(.7);opacity:.2}15%{opacity:1}100%{transform:translate(min(34vw,420px),-40px) scale(1.25);opacity:1}}
.bt-islet{position:absolute;right:5%;bottom:10%;width:min(42%,300px);text-align:center;z-index:3}
.bt-islet-hit{animation:btShake .42s ease}
@keyframes btShake{0%,100%{transform:translate(0,0)}20%{transform:translate(-7px,2px) rotate(-1deg)}40%{transform:translate(6px,-2px) rotate(1deg)}60%{transform:translate(-5px,1px)}80%{transform:translate(4px,-1px)}}
.bt-castle{display:block;margin:0 auto -8px;filter:drop-shadow(0 16px 14px rgba(30,40,80,.35));position:relative;z-index:2}
.bt-ground{height:44px;margin:0 6%;border-radius:50% 50% 46% 46%/60% 60% 40% 40%;background:linear-gradient(180deg,#7ec46a 0%,#5da54f 40%,#8a6a43 75%,#6e5234 100%);box-shadow:0 22px 24px rgba(30,40,80,.3)}
.bt-elbadge{display:inline-flex;align-items:center;gap:4px;margin-top:8px;background:rgba(255,255,255,.92);border:1.5px solid;border-radius:999px;padding:3px 11px;font-size:11px;font-weight:900}
.bt-pops{position:absolute;right:16%;top:26%;z-index:7;pointer-events:none}
.bt-pop{animation:btPop 1.35s ease forwards;font-weight:900;text-shadow:0 2px 0 #fff,0 3px 10px rgba(0,0,0,.25)}
.bt-pop-dmg{font-size:34px;color:#dc2626}
.bt-pop-crit{font-size:44px;color:#b91c1c;-webkit-text-stroke:1.5px #fde68a}
.bt-pop-burn{font-size:20px;color:#ea580c}
.bt-pop-heal{font-size:26px;color:#059669}
@keyframes btPop{0%{transform:translateY(14px) scale(.6);opacity:0}18%{transform:translateY(0) scale(1.12);opacity:1}70%{transform:translateY(-26px) scale(1);opacity:1}100%{transform:translateY(-44px);opacity:0}}
.bt-banners{position:absolute;left:0;right:0;top:16%;display:flex;flex-direction:column;align-items:center;gap:7px;z-index:8;pointer-events:none}
.bt-banner{background:rgba(255,255,255,.95);border:2px solid;border-radius:999px;padding:7px 20px;font-size:15px;font-weight:900;box-shadow:0 6px 18px rgba(0,0,0,.18);animation:btBanner 1.65s ease forwards}
@keyframes btBanner{0%{transform:scale(.5);opacity:0}14%{transform:scale(1.08);opacity:1}24%{transform:scale(1)}80%{opacity:1}100%{opacity:0;transform:translateY(-8px)}}
.bt-win{position:absolute;inset:0;z-index:10;background:rgba(30,25,60,.55);backdrop-filter:blur(2px);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:16px}
.bt-win-rays{position:absolute;width:560px;height:560px;background:conic-gradient(from 0deg,rgba(253,230,138,.35) 0 14deg,transparent 14deg 30deg,rgba(253,230,138,.35) 30deg 44deg,transparent 44deg 60deg,rgba(253,230,138,.35) 60deg 74deg,transparent 74deg 90deg,rgba(253,230,138,.35) 90deg 104deg,transparent 104deg 120deg,rgba(253,230,138,.35) 120deg 134deg,transparent 134deg 150deg,rgba(253,230,138,.35) 150deg 164deg,transparent 164deg 180deg,rgba(253,230,138,.35) 180deg 194deg,transparent 194deg 210deg,rgba(253,230,138,.35) 210deg 224deg,transparent 224deg 240deg,rgba(253,230,138,.35) 240deg 254deg,transparent 254deg 270deg,rgba(253,230,138,.35) 270deg 284deg,transparent 284deg 300deg,rgba(253,230,138,.35) 300deg 314deg,transparent 314deg 330deg,rgba(253,230,138,.35) 330deg 344deg,transparent 344deg 360deg);border-radius:50%;animation:btSpin 14s linear infinite}
@keyframes btSpin{to{transform:rotate(360deg)}}
.bt-win-chest{font-size:74px;position:relative;animation:btChest .8s cubic-bezier(.2,1.6,.4,1) both;filter:drop-shadow(0 8px 16px rgba(0,0,0,.35))}
@keyframes btChest{0%{transform:translateY(40px) scale(.3);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
.bt-win-title{position:relative;font-size:42px;font-weight:900;color:#fde68a;text-shadow:0 3px 0 #b45309,0 8px 22px rgba(0,0,0,.45);letter-spacing:2px}
.bt-win-sub{position:relative;color:#fff;font-weight:800;font-size:13px;margin-top:4px}
.bt-win-reward{position:relative;margin-top:12px;background:rgba(255,252,240,.95);border:2px solid #fcd34d;border-radius:14px;padding:10px 18px;font-size:13px;font-weight:800;color:#5b4a23;line-height:1.9}
.bt-win-btn{position:relative;margin-top:14px;border:none;border-radius:999px;padding:12px 30px;font-size:15px;font-weight:900;color:#fff;background:linear-gradient(135deg,#f59e0b,#d97706);box-shadow:0 6px 18px rgba(217,119,6,.5);cursor:pointer}
.bt-skills{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;justify-content:center}
.bt-skill{display:flex;flex-direction:column;align-items:center;gap:2px;border:2px solid;border-radius:14px;background:rgba(255,252,240,.94);padding:7px 10px;cursor:pointer;min-width:64px;box-shadow:0 3px 10px rgba(120,80,0,.12)}
.bt-skill:active{transform:scale(.94)}
.bt-skill-ico{font-size:21px}
.bt-skill-ico img{width:24px;height:24px;object-fit:contain}
.bt-skill-name{font-size:10px;font-weight:900;color:#5b4a23}
.bt-attack{display:block;width:min(360px,100%);margin:14px auto 0;border:3px solid #fde68a;border-radius:999px;padding:13px 10px 11px;font-size:20px;font-weight:900;color:#fff;background:linear-gradient(180deg,#ef4444,#b91c1c);box-shadow:0 8px 22px rgba(185,28,28,.45);cursor:pointer;transition:transform .15s ease}
.bt-attack:hover{transform:translateY(-2px)}
.bt-attack span{display:block;font-size:11px;font-weight:800;color:#fecaca;margin-top:2px}
.bt-attack-off{filter:grayscale(.75);opacity:.7;cursor:not-allowed;transform:none!important}
.bt-note{text-align:center;margin-top:10px;font-size:11px;font-weight:800;color:#6b5a33;background:rgba(255,255,255,.75);border-radius:999px;padding:6px 12px;display:table;margin-left:auto;margin-right:auto}
.bt-reset{border:none;background:none;color:#1d4ed8;font-weight:900;font-size:11px;cursor:pointer;text-decoration:underline;padding:0}
.bt-weapons{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.bt-weapon{display:flex;flex-direction:column;align-items:center;gap:2px;border:2px solid #e7cf96;border-radius:14px;background:#fff;padding:9px 6px;cursor:pointer;transition:all .15s ease}
.bt-weapon-lock{background:#f3ecd9;border-style:dashed}
.bt-weapon-lock .bt-weapon-ico,.bt-weapon-lock .bt-weapon-name{opacity:.45;filter:grayscale(.8)}
.bt-weapon-on{border-color:#2563eb;background:#eff6ff;box-shadow:0 0 0 2px rgba(37,99,235,.25)}
.bt-weapon-ico{font-size:24px;height:28px;display:flex;align-items:center}
.bt-weapon-name{font-size:11px;font-weight:900;color:#1f2a44}
.bt-weapon-el{font-size:9.5px;font-weight:900;display:flex;align-items:center;gap:2px}
.bt-cycle{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.bt-cyc-item{display:flex;align-items:center;gap:4px}
.bt-cyc-el{display:inline-flex;flex-direction:column;align-items:center;border:2px solid;border-radius:12px;background:#fff;padding:4px 7px 2px;line-height:1.1}
.bt-cyc-el i{font-style:normal;font-size:9px;font-weight:900;color:#5b4a23}
.bt-cyc-arrow{font-weight:900;color:#b45309;font-size:13px}
.bt-cyc-note{font-size:9.5px;font-weight:900;color:#8b5cf6;margin-left:4px}
.bt-legend{display:flex;gap:10px;margin-top:9px;font-size:10.5px;font-weight:900;flex-wrap:wrap}
.bt-wdesc{font-size:11px;font-weight:700;color:#6b5a33;margin-top:6px;line-height:1.6;background:rgba(255,255,255,.6);border-radius:8px;padding:7px 9px}
@media (max-width:980px){
  .bt-grid{grid-template-columns:1fr}
  .bt-left{order:3}
  .bt-center{order:1}
  .bt-right{order:2}
  .bt-stage{height:330px}
  .bt-hero{width:38%;left:2%}
  .bt-islet{width:48%;right:3%}
  .bt-castle{max-width:100%}
  .bt-pop-dmg{font-size:28px}
  .bt-pop-crit{font-size:36px}
  .bt-demo-badge{margin-left:0}
  .bt-vs{padding:8px 10px}
  .bt-vs-side img{width:38px;height:38px}
  .bt-vs-name{font-size:11.5px}
}
@media (prefers-reduced-motion: reduce){
  .bt-beam,.bt-islet-hit,.bt-win-rays,.bt-win-chest{animation:none!important}
  .bt-pop{animation-duration:.9s}
  .bt-hpfill{transition:none}
}
`;
