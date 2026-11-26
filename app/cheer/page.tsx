"use client";
// 応援掲示板（王国の応援ギルド）。見た目を変えただけで、データは従来のまま：
// ・載るもの＝直近7日の「自動の達成」（points_history の理由から判定）＋本人の投稿（cheer_posts）。新しい順で最大120件
// ・MVP＝リアクション合計がいちばん多い1件（0件なら出さない）。HOT＝その次の3件
// ・リアクション＝achievement_reactions、コメント＝achievement_comments、投稿＝cheer_posts（どれも保存先・形式は不変）
// ・画像は既存素材だけを使う（背景・青い飾り板・王冠・巻物・小旗など）。新しい画像は足していない
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { CHEER_LABEL as LABEL } from "../lib/cheer";
import BattleFeed from "../components/BattleFeed";
import AvatarFace, { OldAvatarFace, unifiedFaceSource, type FaceSource } from "../components/AvatarFace";

type Item = { name: string; text: string; sub: string; icon: string; when: string; key: string; uid: string; avatar: string | null; face: FaceSource | null; cat: string; ts: number };

const EMOJIS = ["👏", "🔥", "🎉", "💪"];
const CAT_STYLE: Record<string, { color: string; label: string }> = {
  sales: { color: "#f59e0b", label: "営業成果" },
  learn: { color: "#22d3ee", label: "学習" },
  other: { color: "#a78bfa", label: "達成" },
};
const PLACEHOLDERS = ["例：初受注を達成しました！", "例：テレアポで5件アポ獲得！", "例：学習コンテンツを完了しました！", "例：日報を7日連続達成！"];

export default function CheerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [myName, setMyName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [reactions, setReactions] = useState<Record<string, { emoji: string; count: number; mine: boolean }[]>>({});
  const [comments, setComments] = useState<Record<string, { name: string; body: string }[]>>({});
  const [input, setInput] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "sales" | "learn" | "other">("all");
  const [postBody, setPostBody] = useState("");
  const [postCat, setPostCat] = useState("sales");
  const [posting, setPosting] = useState(false);
  const [postMsg, setPostMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyKeys, setBusyKeys] = useState<Record<string, boolean>>({});   // 押した直後のリアクション（連打での二重処理を防ぐ）
  const lock = useRef<Record<string, boolean>>({});
  const [shown, setShown] = useState(20);

  const load = async (uid: string) => {
    const d7 = new Date(Date.now() - 7 * 86400000).toISOString();
    const [{ data: ph }, { data: posts }] = await Promise.all([
      supabase.from("points_history").select("user_id,reason,created_at").gt("change", 0).gte("created_at", d7).order("created_at", { ascending: false }).limit(400),
      supabase.from("cheer_posts").select("*").gte("created_at", d7).order("created_at", { ascending: false }).limit(100),
    ]);
    const auto = (ph || []).map((p: any) => ({ uid: p.user_id, created_at: p.created_at, manual: false, body: "", ...LABEL(p.reason || "") })).filter((p: any) => p.text);
    const uniq: any[] = [];
    const seen = new Set<string>();
    for (const p of auto) {
      const k = p.uid + p.text + (p.created_at || "").slice(0, 10);
      if (seen.has(k)) continue;
      seen.add(k); uniq.push(p);
    }
    const manual = (posts || []).map((p: any) => ({ uid: p.user_id, created_at: p.created_at, manual: true, text: p.body, icon: p.category === "sales" ? "💼" : p.category === "learn" ? "📖" : "✨", cat: p.category || "other", postId: p.id }));
    const merged = [...uniq, ...manual].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 120);
    const ids = [...new Set(merged.map((u: any) => u.uid))];
    const profMap: Record<string, { name: string; avatar: string | null; face: FaceSource }> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,name,avatar_config,job_class").in("id", ids);
      (profs || []).forEach((p: any) => { profMap[p.id] = { name: p.name, avatar: p.avatar_config?.id || null, face: unifiedFaceSource(p) }; });
    }
    const list: Item[] = merged.map((u: any) => {
      const diff = Math.floor((Date.now() - new Date(u.created_at).getTime()) / 3600000);
      const when = diff < 1 ? "さっき" : diff < 24 ? `${diff}時間前` : `${Math.floor(diff / 24)}日前`;
      const key = u.manual ? "post_" + u.postId : u.text + "_" + (u.created_at || "").slice(0, 10);
      return { name: profMap[u.uid]?.name || "メンバー", text: u.text, sub: "", icon: u.icon, when, key, uid: u.uid, avatar: profMap[u.uid]?.avatar || null, face: profMap[u.uid]?.face || null, cat: u.cat, ts: new Date(u.created_at).getTime() };
    });
    setItems(list);
    const keys = list.map(l => l.key);
    if (keys.length) {
      const [{ data: rs }, { data: cs }] = await Promise.all([
        supabase.from("achievement_reactions").select("*").in("target_key", keys),
        supabase.from("achievement_comments").select("*").in("target_key", keys).order("created_at"),
      ]);
      const rMap: Record<string, { emoji: string; count: number; mine: boolean }[]> = {};
      (rs || []).forEach((r: any) => {
        const k = r.target_user_id + "|" + r.target_key;
        rMap[k] = rMap[k] || [];
        const f = rMap[k].find(x => x.emoji === r.emoji);
        if (f) { f.count++; if (r.user_id === uid) f.mine = true; }
        else rMap[k].push({ emoji: r.emoji, count: 1, mine: r.user_id === uid });
      });
      setReactions(rMap);
      const cIds = [...new Set((cs || []).map((c: any) => c.user_id))];
      const cNames: Record<string, string> = {};
      if (cIds.length) {
        const { data: cp } = await supabase.from("profiles").select("id,name").in("id", cIds);
        (cp || []).forEach((p: any) => { cNames[p.id] = p.name; });
      }
      const cMap: Record<string, { name: string; body: string }[]> = {};
      (cs || []).forEach((c: any) => {
        const k = c.target_user_id + "|" + c.target_key;
        cMap[k] = cMap[k] || [];
        cMap[k].push({ name: cNames[c.user_id] || "メンバー", body: c.body });
      });
      setComments(cMap);
    }
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      const { data: me } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
      setMyName((me as any)?.name || "");
      await load(user.id);
      setLoading(false);
    })();
  }, [router]);

  const rTotal = (it: Item) => (reactions[it.uid + "|" + it.key] || []).reduce((s, r) => s + r.count, 0);
  const toggle = async (uid: string, key: string, emoji: string) => {
    if (!userId) return;
    const mk = uid + "|" + key;
    const lk = mk + "|" + emoji;
    if (lock.current[lk]) return;          // 処理中の同じボタンは受け付けない
    lock.current[lk] = true; setBusyKeys(b => ({ ...b, [lk]: true }));
    try {
      const list = reactions[mk] || [];
      const f = list.find(r => r.emoji === emoji);
      // サーバー側で処理（もらった人に+5pt。同じ投稿には1人1回分だけ）。関数が未導入の環境だけ従来の処理（ポイントなし）に戻す
      const { data: rr, error: rpcErr } = await supabase.rpc("cheer_react", { p_target: uid, p_key: key, p_emoji: emoji });
      if (!rpcErr) {
        const on = !!(rr as any)?.reacted;
        setReactions(prev => { const l = prev[mk] || []; const g = l.find(r => r.emoji === emoji);
          return { ...prev, [mk]: on ? (g ? l.map(r => r.emoji === emoji ? { ...r, count: r.count + (r.mine ? 0 : 1), mine: true } : r) : [...l, { emoji, count: 1, mine: true }]) : l.map(r => r.emoji === emoji ? { ...r, count: Math.max(0, r.count - (r.mine ? 1 : 0)), mine: false } : r).filter(r => r.count > 0) }; });
        return;
      }
      if (rpcErr.code !== "PGRST202" && rpcErr.code !== "42883") return;
      if (f?.mine) {
        const { error } = await supabase.from("achievement_reactions").delete().eq("target_user_id", uid).eq("target_key", key).eq("user_id", userId).eq("emoji", emoji);
        if (error) return;
        setReactions(prev => { const l = prev[mk] || []; return { ...prev, [mk]: l.map(r => r.emoji === emoji ? { ...r, count: Math.max(0, r.count - 1), mine: false } : r).filter(r => r.count > 0) }; });
      } else {
        const { error } = await supabase.from("achievement_reactions").insert({ target_user_id: uid, target_key: key, user_id: userId, emoji });
        if (error) return;
        setReactions(prev => { const l = prev[mk] || []; const g = l.find(r => r.emoji === emoji); return { ...prev, [mk]: g ? l.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r) : [...l, { emoji, count: 1, mine: true }] }; });
      }
    } finally {
      lock.current[lk] = false; setBusyKeys(b => { const n = { ...b }; delete n[lk]; return n; });
    }
  };
  const send = async (uid: string, key: string) => {
    const mk = uid + "|" + key;
    const body = (input[mk] || "").trim();
    if (!body || !userId || lock.current["c|" + mk]) return;
    lock.current["c|" + mk] = true;
    try {
      const { error } = await supabase.from("achievement_comments").insert({ target_user_id: uid, target_key: key, user_id: userId, body });
      if (error) { alert("コメントを送れませんでした。もう一度お試しください。"); return; }
      setComments(prev => ({ ...prev, [mk]: [...(prev[mk] || []), { name: myName || "あなた", body }] }));
      setInput(prev => ({ ...prev, [mk]: "" }));
    } finally { lock.current["c|" + mk] = false; }
  };
  const submitPost = async () => {
    const body = postBody.trim();
    if (!body || posting || !userId) return;
    setPosting(true); setPostMsg(null);
    const { error } = await supabase.from("cheer_posts").insert({ user_id: userId, body, category: postCat });
    if (error) { setPosting(false); setPostMsg({ ok: false, text: "シェアできませんでした。入力はそのまま残っています。もう一度お試しください。" }); return; }
    setPostBody("");
    await load(userId);
    setPosting(false); setPostMsg({ ok: true, text: "成果をシェアしました！" });
  };

  if (loading) return <main className="ch-root ch-loading"><style>{CSS}</style>読み込み中…</main>;

  const filtered = tab === "all" ? items : items.filter(i => i.cat === tab);
  const sorted = [...items].sort((a, b) => rTotal(b) - rTotal(a));
  const mvp = sorted[0] && rTotal(sorted[0]) > 0 ? sorted[0] : null;
  const hot = sorted.filter(i => rTotal(i) > 0 && i !== mvp).slice(0, 3);
  // 顔アイコン：①本人のアバター ②職業キャラ ③昔の固定アバター画像 ④人型マーク（アプリ共通の優先順）
  const AV = (a: Item, size: number) => (
    <AvatarFace src={a.face} size={size} border="2.5px solid #E2BF63" fallback={a.avatar
      ? <OldAvatarFace id={a.avatar} size={size} border="2.5px solid #E2BF63" />
      : <div style={{ width: size, height: size, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5, border: "2.5px solid #E2BF63", boxSizing: "border-box" }}>👤</div>} />
  );
  const CATS = [{ k: "sales", l: "営業成果", e: "💼" }, { k: "learn", l: "学習", e: "📖" }, { k: "other", l: "その他", e: "✨" }];

  return (
    <main className="ch-root">
      <style>{CSS}</style>
      <div className="ch-wrap">
        {/* ヘッダー */}
        <header className="ch-head">
          <div className="ch-title">
            <img src="/career/card_emblem.webp" alt="" />
            <h1>応援掲示板</h1>
            <p>みんなの活躍を応援しよう！</p>
          </div>
          <button className="ch-back" onClick={() => (window.history.length > 1 ? router.back() : router.push("/islands"))}>← 戻る</button>
        </header>

        {/* MVP */}
        {mvp && (
          <section className="ch-mvp">
            <i className="ch-gem" aria-hidden />
            <div className="ch-mvp-l">
              <div className="ch-mvp-tag">👑 TODAY&apos;S MVP</div>
              <div className="ch-mvp-av">
                <img className="crown" src="/tests/crown.webp" alt="" />
                {AV(mvp, 92)}
              </div>
              <div className="ch-mvp-pill">本日のMVP</div>
            </div>
            <div className="ch-mvp-r">
              <div className="ch-mvp-text">🏆 {mvp.text}</div>
              <div className="ch-mvp-name">🌿 {mvp.name} さん 🌿</div>
              <div className="ch-mvp-cnt"><span>応援数</span><b>{rTotal(mvp)}</b></div>
            </div>
          </section>
        )}

        {/* HOT */}
        {hot.length > 0 && (
          <section>
            <div className="ch-h2"><h2>🔥 HOT！みんなが注目している活躍</h2></div>
            <div className="ch-hot">
              {hot.map((h, i) => (
                <div key={h.uid + "|" + h.key} className={"ch-hot-c" + (i === 0 ? " top" : "")}>
                  <div className="ch-hot-h">
                    <span className="no">{i + 1}</span>
                    {AV(h, 44)}
                    <div className="tx"><small>{h.name} さん</small><b>{h.text}</b></div>
                  </div>
                  <div className="ch-hot-r">
                    {(reactions[h.uid + "|" + h.key] || []).map(r => <span key={r.emoji}>{r.emoji} {r.count}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 島バトルの履歴（全員ぶん） */}
        <BattleFeed />

        {/* 投稿フォーム */}
        <section className="ch-panel">
          <div className="ch-ph"><img src="/tests/challenge.webp" alt="" /><h2>クエスト達成報告</h2></div>
          <div className="ch-cats" role="group" aria-label="カテゴリ">
            {CATS.map(c => (
              <button key={c.k} type="button" className={"ch-cat" + (postCat === c.k ? " on" : "")} aria-pressed={postCat === c.k} onClick={() => setPostCat(c.k)}>{c.e} {c.l}</button>
            ))}
          </div>
          <div className="ch-note">👏 リアクションをもらうと +5pt（同じ投稿には1人1回分）</div>
          <div className="ch-form">
            <input value={postBody} onChange={(e) => { setPostBody(e.target.value); if (postMsg) setPostMsg(null); }} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) submitPost(); }} placeholder={PLACEHOLDERS[Math.floor(Date.now() / 60000) % PLACEHOLDERS.length]} aria-label="達成したこと" disabled={posting} />
            <button type="button" className="ch-send" onClick={submitPost} disabled={posting || !postBody.trim()}>{posting ? "送信中…" : "成果をシェアする 🚀"}</button>
          </div>
          {postMsg && <div className={"ch-msg " + (postMsg.ok ? "ok" : "ng")} role="status">{postMsg.ok ? "✓ " : ""}{postMsg.text}</div>}
        </section>

        {/* 成長ログ */}
        <section>
          <div className="ch-h2 bar">
            <img src="/rookie/section_quill.webp" alt="" />
            <h2>みんなの成長ログ</h2>
            <div className="ch-filter" role="group" aria-label="絞り込み">
              {[{ k: "all", l: "すべて" }, ...CATS].map(t => (
                <button key={t.k} type="button" className={tab === t.k ? "on" : ""} aria-pressed={tab === t.k} onClick={() => { setTab(t.k as any); setShown(20); }}>{t.l}</button>
              ))}
            </div>
          </div>
          <div className="ch-list">
            {filtered.length === 0 ? (
              <div className="ch-empty">まだ投稿がありません</div>
            ) : filtered.slice(0, shown).map((a) => {
              const mk = a.uid + "|" + a.key;
              const rs = reactions[mk] || [];
              const cs = comments[mk] || [];
              const isOpen = open === mk;
              const catSt = CAT_STYLE[a.cat] || CAT_STYLE.other;
              const total = rs.reduce((sum, r) => sum + r.count, 0);
              const isHotCard = total >= 3;
              return (
                <article key={mk} className={"ch-card" + (isHotCard ? " hot" : "")}>
                  {isHotCard && <span className="ch-hotbadge">🔥 HOT</span>}
                  <div className="ch-card-h">
                    <span className={"ch-badge c-" + (CAT_STYLE[a.cat] ? a.cat : "other")}>{a.icon} {catSt.label}</span>
                    <time>{a.when}</time>
                  </div>
                  <div className="ch-card-b">
                    {AV(a, 44)}
                    <p><strong className="nm">{a.name}</strong> さんが <strong>{a.text}</strong></p>
                  </div>
                  <div className="ch-reacts">
                    {EMOJIS.map(em => {
                      const r = rs.find(x => x.emoji === em);
                      return (
                        <button key={em} type="button" className={"ch-re" + (r?.mine ? " mine" : "")} aria-pressed={!!r?.mine} aria-label={`${em} で応援${r?.mine ? "（応援済み）" : ""}`} disabled={!!busyKeys[mk + "|" + em]} onClick={() => toggle(a.uid, a.key, em)}>
                          <span>{em}</span>{r && r.count > 0 ? <b>{r.count}</b> : null}
                        </button>
                      );
                    })}
                    <button type="button" className={"ch-re cm" + (isOpen ? " mine" : "")} aria-expanded={isOpen} aria-label="コメント" onClick={() => setOpen(isOpen ? null : mk)}>
                      <span>💬</span>{cs.length > 0 ? <b>{cs.length}</b> : null}
                    </button>
                  </div>
                  {(isOpen || cs.length > 0) && (
                    <div className="ch-cms">
                      {cs.map((c, ci) => <div key={ci} className="ch-cm"><strong>{c.name}</strong>: {c.body}</div>)}
                      {isOpen && (
                        <div className="ch-cmform">
                          <input value={input[mk] || ""} onChange={(e) => setInput({ ...input, [mk]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) send(a.uid, a.key); }} placeholder="応援コメントを送る" aria-label="応援コメント" />
                          <button type="button" onClick={() => send(a.uid, a.key)} disabled={!(input[mk] || "").trim()}>送信</button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
            {filtered.length > shown && <button type="button" className="ch-more" onClick={() => setShown(shown + 20)}>もっと見る（残り{filtered.length - shown}件）</button>}
          </div>
        </section>

        {/* フッター */}
        <footer className="ch-foot">
          <p>一人ひとりの挑戦が、チーム全体の力になります。</p>
          <b>さあ、今日も一緒に最高の未来へ進もう！🚀</b>
        </footer>
      </div>

      <div className="ch-nav">
        <div className="band" />
        {[{ k: "home", l: "ホーム", h: "/home", img: "/home/nav_home_active.webp" }, { k: "rank", l: "ランキング", h: "/ranking", img: "/home/nav_trophy.webp" }, { k: "house", l: "おうち", h: "/mypage", img: "/home/nav_house.webp" }, { k: "menu", l: "メニュー", h: "/menu", img: "" }].map((t) => (
          <button key={t.k} onClick={() => router.push(t.h)}>{t.img ? <img src={t.img} alt="" /> : <span>☰</span>}<i>{t.l}</i></button>
        ))}
      </div>
    </main>
  );
}

const CSS = `
.ch-root{min-height:100vh;min-height:100dvh;overflow-x:clip;background:url(/home/bg_mobile.webp) center top / cover no-repeat fixed,#bfe3f5;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#23284a;padding:12px 10px calc(108px + env(safe-area-inset-bottom));box-sizing:border-box}
@media (min-width:700px){ .ch-root{background-image:url(/home/bg_pc.webp);padding-top:20px} }
.ch-root *{box-sizing:border-box}
.ch-loading{display:flex;align-items:center;justify-content:center;font-weight:900;color:#17397d}
.ch-wrap{max-width:960px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
.ch-head{display:flex;align-items:center;gap:12px}
.ch-title{flex:1;min-width:0;display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:10px 26px 10px 16px;background:linear-gradient(180deg,#fffefa,#f8eed8);border:3px solid #e2bf63;border-radius:20px;box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 4px rgba(226,191,99,.35),0 8px 18px rgba(16,47,112,.3)}
.ch-title img{width:44px;height:auto;flex-shrink:0;margin:-18px 0 -14px;filter:drop-shadow(0 3px 5px rgba(16,47,112,.35))}
.ch-title h1{margin:0;font-size:clamp(22px,5.6vw,32px);font-weight:900;color:#17307a;letter-spacing:.08em;white-space:nowrap}
.ch-title p{margin:0;padding-left:14px;border-left:2px solid #e2c98c;font-size:clamp(12.5px,3.3vw,16px);font-weight:800;color:#2a4aa6}
.ch-back{flex-shrink:0;min-height:48px;padding:8px 20px;border:3px solid #f5d77e;border-radius:14px;background:linear-gradient(180deg,#3b78e0,#1746b0 55%,#12358f);color:#fff;font-size:15px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:inset 0 2px 0 rgba(255,255,255,.3),0 6px 14px rgba(16,47,112,.4);white-space:nowrap}
.ch-mvp{position:relative;display:flex;align-items:center;gap:26px;padding:22px 30px 20px;background:radial-gradient(ellipse at 80% 20%,rgba(255,236,170,.55),rgba(255,236,170,0) 55%),linear-gradient(180deg,#fffefa,#f6e9c8);border:4px solid #e2bf63;border-radius:24px;box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 5px rgba(226,191,99,.4),0 12px 28px rgba(16,47,112,.35)}
.ch-gem{position:absolute;left:50%;top:-14px;width:24px;height:24px;transform:translateX(-50%) rotate(45deg);background:linear-gradient(135deg,#8fd0ff,#2f6ad1 55%,#17397d);border:2.5px solid #f1cf6b;border-radius:4px;box-shadow:0 2px 6px rgba(16,47,112,.4)}
.ch-mvp-l{flex-shrink:0;display:flex;flex-direction:column;align-items:center}
.ch-mvp-tag{padding:5px 18px;background:linear-gradient(180deg,#2a4aa6,#172f78);border:2px solid #f1cf6b;border-radius:999px;color:#fff;font-size:14px;font-weight:900;letter-spacing:.12em;white-space:nowrap;box-shadow:0 4px 10px rgba(16,47,112,.3)}
.ch-mvp-av{position:relative;margin-top:34px}
.ch-mvp-av .crown{position:absolute;left:50%;top:-40px;width:64px;height:auto;transform:translateX(-50%);z-index:2;filter:drop-shadow(0 3px 5px rgba(16,47,112,.35));pointer-events:none}
.ch-mvp-pill{margin-top:-10px;position:relative;z-index:2;padding:4px 20px;background:linear-gradient(180deg,#3b78e0,#1746b0);border:2px solid #f5d77e;border-radius:999px;color:#fff;font-size:12.5px;font-weight:900;box-shadow:0 3px 8px rgba(16,47,112,.3)}
.ch-mvp-r{flex:1;min-width:0}
.ch-mvp-text{font-size:clamp(18px,4.2vw,26px);font-weight:900;color:#17307a;line-height:1.4;overflow-wrap:anywhere}
.ch-mvp-name{margin-top:6px;font-size:17px;font-weight:900;color:#1746b0}
.ch-mvp-cnt{display:inline-flex;align-items:center;margin-top:12px;border:2px solid #e2bf63;border-radius:999px;background:#fff;overflow:hidden;box-shadow:0 3px 8px rgba(16,47,112,.18)}
.ch-mvp-cnt span{padding:6px 14px;font-size:14px;font-weight:900;color:#3a2f12}
.ch-mvp-cnt b{padding:2px 22px;background:linear-gradient(180deg,#2a4aa6,#172f78);color:#ffd95e;font-size:26px;font-weight:900;line-height:1.3}
.ch-h2{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.ch-h2 h2{margin:0;padding:6px 18px;background:rgba(255,253,246,.95);border:2px solid #e2bf63;border-radius:999px;font-size:15px;font-weight:900;color:#9a3412;box-shadow:0 4px 10px rgba(16,47,112,.18)}
.ch-h2.bar{flex-wrap:wrap;padding:8px 12px 8px 8px;background:linear-gradient(180deg,#2a4aa6,#172f78);border:2.5px solid #f1cf6b;border-radius:16px;box-shadow:0 6px 14px rgba(16,47,112,.3)}
.ch-h2.bar img{width:40px;height:auto;margin:-10px 0 -8px;flex-shrink:0}
.ch-h2.bar h2{flex:1;min-width:0;padding:0 4px;background:none;border:none;box-shadow:none;color:#fff;font-size:17px;letter-spacing:.05em;white-space:nowrap}
.ch-filter{display:flex;gap:6px;flex-wrap:wrap}
.ch-filter button{min-height:40px;padding:6px 15px;border:2px solid rgba(255,255,255,.35);border-radius:999px;background:rgba(255,255,255,.1);color:#e7ecff;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit;white-space:nowrap}
.ch-filter button.on{background:linear-gradient(180deg,#5a9bf5,#2f6ad1);border-color:#f5d77e;color:#fff;box-shadow:0 0 0 2px rgba(245,215,126,.35)}
.ch-hot{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.ch-hot-c{padding:12px 14px;background:linear-gradient(180deg,#fffefb,#fbf2de);border:2.5px solid #ecd9a6;border-radius:16px;box-shadow:0 4px 10px rgba(16,47,112,.16);min-width:0}
.ch-hot-c.top{border-color:#f0b63c}
.ch-hot-h{display:flex;align-items:center;gap:10px}
.ch-hot-h .no{flex-shrink:0;width:26px;height:26px;border-radius:8px;background:#2a4aa6;color:#fff;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center}
.ch-hot-c.top .no{background:#e69a12}
.ch-hot-h .tx{min-width:0}
.ch-hot-h small{display:block;font-size:12px;font-weight:800;color:#7a6a45}
.ch-hot-h b{display:block;font-size:13.5px;font-weight:900;color:#17307a;line-height:1.4;overflow-wrap:anywhere}
.ch-hot-r{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.ch-hot-r span{padding:2px 9px;border-radius:999px;background:#f6e7bd;font-size:12px;font-weight:900;color:#5a4a22}
.ch-panel{padding:18px 24px 20px;background:linear-gradient(180deg,#fffdf6,#f8eed8);border:3px solid #e2bf63;border-radius:22px;box-shadow:inset 0 0 0 2px #fff,0 10px 24px rgba(16,47,112,.28)}
.ch-ph{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.ch-ph img{width:44px;height:44px;object-fit:contain;margin:-6px 0;filter:drop-shadow(0 2px 4px rgba(16,47,112,.25))}
.ch-ph h2{margin:0;font-size:19px;font-weight:900;color:#17307a;letter-spacing:.04em}
.ch-cats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.ch-cat{min-height:44px;padding:7px 18px;border:2.5px solid #e2c98c;border-radius:999px;background:linear-gradient(180deg,#fff,#fbf2de);color:#5a4a22;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;white-space:nowrap}
.ch-cat.on{background:linear-gradient(180deg,#4a6ee8,#3a2fb5);border-color:#f5d77e;color:#fff;box-shadow:0 0 0 2px #2a2390,0 4px 10px rgba(16,47,112,.35)}
.ch-note{margin:-4px 0 10px;font-size:12.5px;font-weight:800;color:#8a6a1e}
.ch-form{display:flex;gap:10px;align-items:stretch}
.ch-form input{flex:1;min-width:0;min-height:52px;padding:0 18px;border:2px solid #e2bf63;border-radius:14px;background:#fff;color:#23284a;font-size:16px;font-weight:600;outline:none;font-family:inherit;box-shadow:inset 0 2px 4px rgba(120,80,20,.08)}
.ch-form input:focus,.ch-cmform input:focus{border-color:#2a4aa6;box-shadow:0 0 0 3px rgba(42,74,166,.16)}
.ch-form input::placeholder,.ch-cmform input::placeholder{color:#a79f8e}
.ch-send{flex-shrink:0;min-height:52px;padding:8px 24px;border:3px solid #f5d77e;border-radius:14px;background:linear-gradient(180deg,#3b78e0,#1746b0 55%,#12358f);color:#fff;font-size:15.5px;font-weight:900;cursor:pointer;font-family:inherit;white-space:nowrap;box-shadow:inset 0 2px 0 rgba(255,255,255,.3),0 6px 14px rgba(16,47,112,.35)}
.ch-send:disabled{background:linear-gradient(180deg,#9aa6c2,#74819f);border-color:#ddd6bf;cursor:not-allowed;box-shadow:none}
.ch-msg{margin-top:10px;padding:9px 14px;border-radius:12px;font-size:13.5px;font-weight:900;line-height:1.6}
.ch-msg.ok{background:#e3f7e8;border:2px solid #9bd8ab;color:#14602f}
.ch-msg.ng{background:#fff5f5;border:2px solid #f0a9b5;color:#9f1d38}
.ch-list{display:flex;flex-direction:column;gap:10px}
.ch-empty{padding:30px 16px;text-align:center;font-size:14px;font-weight:800;color:#6b5a33;background:rgba(255,253,246,.95);border:2px dashed #e2c98c;border-radius:16px}
.ch-card{position:relative;padding:14px 20px 14px;background:linear-gradient(180deg,#fffefb,#fdf6e6);border:2.5px solid #e2bf63;border-radius:18px;box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 3px rgba(226,191,99,.3),0 5px 12px rgba(16,47,112,.16);min-width:0}
.ch-card.hot{border-color:#f0a23c;box-shadow:inset 0 0 0 2px #fff,0 0 0 3px rgba(240,162,60,.25),0 5px 12px rgba(16,47,112,.16)}
.ch-hotbadge{position:absolute;top:-11px;right:16px;padding:2px 12px;border-radius:999px;background:linear-gradient(135deg,#f97316,#ec4899);border:2px solid #fff;color:#fff;font-size:11px;font-weight:900}
.ch-card-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.ch-badge{padding:3px 12px;border-radius:999px;border:1.5px solid #f5d77e;color:#fff;font-size:12px;font-weight:900;white-space:nowrap;background:linear-gradient(180deg,#5a63e6,#3a2fb5)}
.ch-badge.c-sales{background:linear-gradient(180deg,#3b78e0,#1746b0)}
.ch-badge.c-learn{background:linear-gradient(180deg,#22a6c4,#0e7490)}
.ch-card-h time{font-size:12px;font-weight:800;color:#8a7a55;white-space:nowrap}
.ch-card-b{display:flex;align-items:center;gap:12px}
.ch-card-b p{margin:0;min-width:0;flex:1;font-size:15px;line-height:1.7;color:#2c3147;overflow-wrap:anywhere;white-space:pre-wrap}
.ch-card-b strong{font-weight:900;color:#17307a}
.ch-card-b .nm{color:#1746b0}
.ch-reacts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.ch-re{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:46px;height:46px;padding:0 10px;border:2.5px solid #e2c98c;border-radius:999px;background:radial-gradient(circle at 35% 30%,#fff,#f6ecd2);cursor:pointer;font-family:inherit;box-shadow:0 3px 6px rgba(120,80,20,.18);transition:transform .12s}
.ch-re span{font-size:19px;line-height:1}
.ch-re b{font-size:13.5px;font-weight:900;color:#5a4a22}
.ch-re:active{transform:scale(.94)}
.ch-re.mine{background:radial-gradient(circle at 35% 30%,#6f9df2,#1f55c0);border-color:#f5d77e;box-shadow:0 0 0 2px #1746b0,0 3px 8px rgba(16,47,112,.4)}
.ch-re.mine b{color:#fff}
.ch-re:disabled{opacity:.6;cursor:wait}
.ch-re.cm{border-color:#b9c6ee}
.ch-cms{margin-top:10px;display:flex;flex-direction:column;gap:6px}
.ch-cm{padding:8px 12px;border-radius:12px;background:#f3ecd6;font-size:13.5px;line-height:1.6;color:#2c3147;overflow-wrap:anywhere}
.ch-cm strong{font-weight:900;color:#1746b0}
.ch-cmform{display:flex;gap:8px}
.ch-cmform input{flex:1;min-width:0;min-height:46px;padding:0 14px;border:2px solid #e2c98c;border-radius:12px;background:#fff;color:#23284a;font-size:16px;outline:none;font-family:inherit}
.ch-cmform button{flex-shrink:0;min-height:46px;padding:6px 18px;border:2px solid #f5d77e;border-radius:12px;background:linear-gradient(180deg,#3b78e0,#1746b0);color:#fff;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit}
.ch-cmform button:disabled{opacity:.5;cursor:not-allowed}
.ch-more{align-self:center;min-height:46px;padding:8px 26px;border:2.5px solid #7f95d6;border-radius:999px;background:#fff;color:#17397d;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 3px 8px rgba(16,47,112,.2)}
.ch-foot{position:relative;padding:18px 20px 20px;text-align:center;background:linear-gradient(180deg,#2a4aa6,#172f78 60%,#12266a);border:3px solid #f1cf6b;border-radius:20px;box-shadow:inset 0 0 0 2px rgba(255,255,255,.16),0 8px 18px rgba(16,47,112,.35);color:#fff}
.ch-foot::before,.ch-foot::after{content:"";position:absolute;top:50%;width:14px;height:14px;transform:translateY(-50%) rotate(45deg);background:linear-gradient(135deg,#8fd0ff,#2f6ad1);border:2px solid #f1cf6b;border-radius:3px}
.ch-foot::before{left:-9px}.ch-foot::after{right:-9px}
.ch-foot p{margin:0 0 4px;font-size:13.5px;font-weight:700;color:#dbe6ff}
.ch-foot b{display:block;font-size:clamp(15px,3.6vw,20px);font-weight:900;letter-spacing:.04em;text-shadow:0 2px 4px rgba(10,25,70,.6)}
.ch-root button:focus-visible{outline:3px solid #2a4aa6;outline-offset:2px}
.ch-nav{position:fixed;left:0;bottom:0;width:100%;max-width:100vw;z-index:50;display:flex;height:calc(86px + env(safe-area-inset-bottom));padding:0 10px calc(10px + env(safe-area-inset-bottom));overflow:hidden}
.ch-nav .band{position:absolute;inset:6px 8px calc(8px + env(safe-area-inset-bottom));background:url(/home/nav_bar.webp);background-size:100% 100%;pointer-events:none}
.ch-nav button{position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;padding-bottom:calc(17px + env(safe-area-inset-bottom));background:transparent;border:none;cursor:pointer;color:#fff;font-family:inherit}
.ch-nav img{height:30px}
.ch-nav span{font-size:20px;line-height:30px}
.ch-nav i{font-style:normal;font-size:10.5px;font-weight:800}
@media (max-width:640px){
  .ch-wrap{gap:14px}
  .ch-title{padding:8px 12px 8px 10px;gap:4px 10px;border-radius:16px}
  .ch-title img{width:34px;margin:-10px 0 -8px}
  .ch-title p{flex-basis:100%;padding-left:0;border-left:none}
  .ch-back{padding:8px 13px;font-size:14px}
  .ch-mvp{flex-direction:column;gap:12px;padding:22px 14px 18px;text-align:center}
  .ch-mvp-r{width:100%}
  .ch-panel{padding:14px 13px 16px;border-radius:18px}
  .ch-form{flex-direction:column}
  .ch-send{width:100%}
  .ch-h2.bar h2{flex-basis:calc(100% - 60px)}
  .ch-filter{width:100%;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
  .ch-filter::-webkit-scrollbar{display:none}
  .ch-filter button{flex:1 0 auto}
  .ch-card{padding:13px 13px 12px;border-radius:16px}
  .ch-card-b{align-items:flex-start}
  .ch-foot{padding:16px 16px 18px}
}
`;
