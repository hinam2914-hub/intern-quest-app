"use client";
// Intern Quest 2.0｜サンキュー（感謝を送り合う）。HOME と同じ世界観（青空・浮島・羊皮紙・金縁）。
// ポイントルールは従来どおり「受け取った相手に +1pt（points のみ・EXPなし）」で変更しない。
// 連投防止：同じ相手には1日1回（従来仕様）＋送信後30秒のクールダウン。クエスト達成は当日の最初の1件のみ（HOME側が thanks テーブルで判定）。
// メッセージの閲覧は本人の送受信のみ（管理者タブを除く）。DB の RLS 強化は別途提案。
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { formatJSTShort } from "../lib/date";
import { createNotification } from "../lib/createNotification";
import AvatarLayered from "../components/AvatarLayered";
import type { AvatarConfig } from "../lib/avatar/catalog";
import { JOBS, type JobKey } from "../onboarding/job/page";

type UserOption = { id: string; name: string; avatar_url: string | null; deptName: string; layered: { cfg: AvatarConfig; job: JobKey } | null; active: boolean };
type ThanksRow = { id: string; from_user_id: string; to_user_id: string; message: string; reason?: string | null; created_at: string };

const REASONS = ["助けてもらった", "教えてもらった", "挑戦を応援してくれた", "一緒に頑張ってくれた", "その他"];
const MAX_LEN = 200;
const MIN_LEN = 20;          // 従来からの品質ルール（20文字以上）を踏襲
const COOLDOWN_MS = 30_000;  // 連投防止：送信後30秒は次を送れない

function getTodayJST(): string {
    const jst = new Date(Date.now() + 9 * 3600 * 1000);
    return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}
function isSameJSTDay(value: string, ymd: string): boolean {
    const jst = new Date(new Date(value).getTime() + 9 * 3600 * 1000);
    return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}` === ymd;
}

const CSS = `
.tq-page{min-height:100vh;overflow-x:clip;background:url(/home/bg_mobile.webp) center top / cover no-repeat fixed, #bfe3f5;display:flex;flex-direction:column;align-items:center;padding:16px 14px 90px;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#1f2a44}
@media (min-width:700px){ .tq-page{background-image:url(/home/bg_pc.webp)} .tq-col{max-width:640px} }
.tq-col{width:100%;max-width:480px;display:flex;flex-direction:column}
.tq-back{align-self:flex-start;border:2px solid #e8c45a;background:rgba(255,253,245,.9);color:#17397d;font-weight:900;font-size:13px;border-radius:999px;padding:8px 16px;cursor:pointer;font-family:inherit;box-shadow:0 3px 8px rgba(40,60,120,.15)}
.tq-title{position:relative;width:min(88%,480px);margin:14px auto 0;container-type:inline-size;z-index:2}
.tq-title img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 14px rgba(20,40,90,.3))}
.tq-title>div{position:absolute;inset:14% 8% 8%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;pointer-events:none}
.tq-title .t1{font-size:clamp(16px,6.4cqw,26px);font-weight:900;letter-spacing:.1em;text-shadow:0 2px 4px rgba(10,25,70,.55)}
.tq-title .t2{font-size:clamp(8px,2.3cqw,11px);font-weight:800;letter-spacing:.42em;color:#cfe0ff;margin-top:1%}
.tq-luku{display:flex;align-items:center;gap:10px;margin-top:14px}
.tq-luku img{width:64px;flex:none;filter:drop-shadow(0 4px 8px rgba(30,40,90,.3))}
.tq-luku .bub{flex:1;background:url(/home/luku_bubble.webp);background-size:100% 100%;padding:14px 16px 20px 18px;font-weight:800;font-size:13px;color:#4a3519;line-height:1.6}
.tq-stats{display:flex;gap:10px;margin-top:12px}
.tq-stat{flex:1;background:linear-gradient(180deg,#fffdf4,#f6ead0);border:2px solid #d8b55e;border-radius:16px;padding:10px 12px;text-align:center;box-shadow:0 3px 10px rgba(140,100,30,.15)}
.tq-stat .n{font-size:22px;font-weight:900;color:#17397d}
.tq-stat .l{font-size:11px;font-weight:800;color:#8a6a3a}
.tq-panel{position:relative;margin-top:14px;padding:18px 16px;background:linear-gradient(180deg,#fffdf4,#f8efdb);border:3px solid #d8b55e;border-radius:22px;box-shadow:0 0 0 3px rgba(255,255,255,.45),0 10px 26px rgba(40,60,120,.18),inset 0 2px 0 rgba(255,255,255,.8);display:flex;flex-direction:column;gap:14px;container-type:inline-size}
.tq-h{align-self:center;display:flex;align-items:center;gap:8px;background:linear-gradient(180deg,#fffdf4,#f8efdb);border:2px solid #e2bf63;border-radius:999px;padding:4px 20px;font-weight:900;color:#7a5a1a;font-size:clamp(12px,3.4cqw,14px)}
.tq-lbl{font-size:12.5px;font-weight:900;color:#7a5a1a}
.tq-search{width:100%;box-sizing:border-box;border:2px solid #e2bf63;border-radius:12px;background:#fffdf6;padding:10px 14px;font-size:14px;font-weight:700;color:#1f2a44;outline:none;font-family:inherit}
.tq-users{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;max-height:264px;overflow-y:auto;padding:2px}
.tq-user{border:2px solid rgba(190,160,110,.4);background:rgba(255,255,251,.85);border-radius:14px;padding:8px 4px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;font-family:inherit}
.tq-user.on{border-color:#2f6fd6;background:#eaf2ff;box-shadow:0 0 0 2px rgba(47,111,214,.25)}
.tq-user .nm{font-size:11.5px;font-weight:900;color:#1f2a44;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tq-user .dp{font-size:9.5px;font-weight:800;color:#8a93a6;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tq-chips{display:flex;gap:8px;flex-wrap:wrap}
.tq-chip{border:2px solid #e2bf63;background:#fffdf6;color:#7a5a1a;font-weight:900;font-size:12.5px;border-radius:999px;padding:8px 14px;cursor:pointer;font-family:inherit}
.tq-chip.on{background:linear-gradient(180deg,#4d9af5,#2458c7);border-color:#1d4fae;color:#fff}
.tq-ta{width:100%;box-sizing:border-box;min-height:110px;border:2px solid #e2bf63;border-radius:14px;background:#fffdf6;padding:12px 14px;font-size:14px;font-weight:700;color:#1f2a44;line-height:1.7;outline:none;resize:vertical;font-family:inherit}
.tq-cnt{text-align:right;font-size:11.5px;font-weight:800;color:#8a93a6}
.tq-send{border:2px solid #e8c45a;background:linear-gradient(180deg,#ffd76a,#f0a92d);color:#5a3a06;font-weight:900;font-size:16px;border-radius:999px;padding:14px;cursor:pointer;font-family:inherit;box-shadow:0 5px 14px rgba(170,110,20,.35),inset 0 2px 0 rgba(255,255,255,.6)}
.tq-send:disabled{opacity:.5;cursor:not-allowed}
.tq-err{background:#fdecec;border:2px solid #f0b4b4;color:#b0413e;font-weight:800;font-size:13px;border-radius:12px;padding:10px 14px}
.tq-tabs{display:flex;gap:6px;align-self:center;background:rgba(255,255,251,.8);border:2px solid #e2bf63;border-radius:999px;padding:3px}
.tq-tab{border:none;background:transparent;color:#8a6a3a;font-weight:900;font-size:12.5px;border-radius:999px;padding:7px 16px;cursor:pointer;font-family:inherit}
.tq-tab.on{background:linear-gradient(180deg,#4d9af5,#2458c7);color:#fff}
.tq-row{background:rgba(255,255,251,.92);border:2px solid rgba(190,160,110,.4);border-radius:14px;padding:10px 12px;display:flex;gap:10px;align-items:flex-start}
.tq-row .meta{font-size:11.5px;font-weight:800;color:#8a93a6}
.tq-row .msg{font-size:13.5px;font-weight:700;color:#3a3a4a;line-height:1.7;margin-top:3px;word-break:break-word}
.tq-row .rsn{display:inline-block;background:#fff3cf;border:1.5px solid #e2bf63;color:#8a6207;font-weight:900;font-size:10.5px;border-radius:999px;padding:2px 9px;margin-right:6px}
.tq-modal{position:fixed;inset:0;background:rgba(10,20,50,.55);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}
.tq-card{width:100%;max-width:420px;background:linear-gradient(180deg,#fffdf4,#f6ead0);border:3px solid #d8b55e;border-radius:22px;padding:22px;box-shadow:0 18px 50px rgba(10,25,70,.4)}
.tq-card h3{margin:0 0 12px;font-size:16px;font-weight:900;color:#17397d;text-align:center}
.tq-kv{background:#fffdf6;border:1.5px solid #e7dcc0;border-radius:12px;padding:10px 14px;margin-bottom:8px;font-size:13px;font-weight:800;color:#3a3a4a}
.tq-kv small{display:block;font-size:10.5px;color:#8a6a3a;font-weight:900;margin-bottom:2px}
.tq-btn2{display:flex;gap:10px;margin-top:14px}
.tq-btn2 button{flex:1;border-radius:999px;padding:12px;font-weight:900;font-size:14px;cursor:pointer;font-family:inherit}
@keyframes tqConfetti { 0% { transform: translateY(-10px) rotate(0deg); opacity: 1; } 100% { transform: translateY(70vh) rotate(540deg); opacity: .6; } }
@keyframes tqPop { 0%{transform:scale(.5);opacity:0} 70%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
`;

export default function ThanksPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [myId, setMyId] = useState("");
    const [myName, setMyName] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [meUser, setMeUser] = useState<UserOption | null>(null);
    const [q, setQ] = useState("");
    const [toUserId, setToUserId] = useState("");
    const [reason, setReason] = useState("");
    const [message, setMessage] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [sending, setSending] = useState(false);
    const [celebrated, setCelebrated] = useState<string | null>(null);   // 送信成功：相手の名前
    const [err, setErr] = useState("");
    const [list, setList] = useState<ThanksRow[]>([]);
    const [allList, setAllList] = useState<ThanksRow[] | null>(null);    // 管理者タブ用
    const [sentCount, setSentCount] = useState(0);
    const [receivedCount, setReceivedCount] = useState(0);
    const [tab, setTab] = useState<"sent" | "received" | "all">("sent");
    const lastSentAt = useRef(0);

    const nameOf = (id: string) => (id === myId ? myName || "自分" : users.find((u) => u.id === id)?.name || "名前未設定");
    const userOf = (id: string) => (id === myId ? meUser : users.find((u) => u.id === id) || null);

    const loadHistory = async (uid: string) => {
        const { data } = await supabase.from("thanks").select("*").or(`from_user_id.eq.${uid},to_user_id.eq.${uid}`).order("created_at", { ascending: false }).limit(300);
        setList((data as any) || []);
        const [{ count: s }, { count: r }] = await Promise.all([
            supabase.from("thanks").select("*", { count: "exact", head: true }).eq("from_user_id", uid),
            supabase.from("thanks").select("*", { count: "exact", head: true }).eq("to_user_id", uid),
        ]);
        setSentCount(s || 0); setReceivedCount(r || 0);
    };

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setMyId(user.id);
            const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
            setIsAdmin(!!user.email && adminEmails.includes(user.email));
            const [{ data: profs }, { data: depts }] = await Promise.all([
                supabase.from("profiles").select("id, name, avatar_url, avatar_config, job_class, department_id, is_active"),
                supabase.from("departments").select("id, name"),
            ]);
            const dmap: Record<string, string> = {}; (depts || []).forEach((d: any) => { dmap[d.id] = d.name; });
            const all: UserOption[] = (profs || []).map((p: any) => {
                const ac = p.avatar_config, jc = p.job_class;
                const layered = ac?.type === "layered" && jc && JOBS.some((j) => j.key === jc) ? { cfg: ac as AvatarConfig, job: jc as JobKey } : null;
                return { id: p.id, name: p.name || "名前未設定", avatar_url: p.avatar_url || null, deptName: dmap[p.department_id] || "", layered, active: p.is_active !== false };
            });
            setMyName(all.find((u) => u.id === user.id)?.name || "");
            setMeUser(all.find((u) => u.id === user.id) || null);
            setUsers(all.filter((u) => u.id !== user.id));   // 自分は送信対象に出さない
            await loadHistory(user.id);
            setLoading(false);
        })();
    }, [router]);

    const filtered = useMemo(() => {
        const pool = users.filter((u) => u.active);   // 送信先は在籍者（is_active=false の離職者は出さない）
        const k = q.trim().toLowerCase();
        const base = k ? pool.filter((u) => u.name.toLowerCase().includes(k) || u.deptName.toLowerCase().includes(k)) : pool;
        return base.slice(0, 60);
    }, [q, users]);

    const canOpenConfirm = !!toUserId && !!reason && message.trim().length >= MIN_LEN && message.trim().length <= MAX_LEN;

    const doSend = async () => {
        if (sending) return;
        setErr("");
        if (Date.now() - lastSentAt.current < COOLDOWN_MS) { setErr("少し時間をおいてから送ってね（連投防止・30秒）"); setConfirming(false); return; }
        if (!toUserId || toUserId === myId) { setErr("送り先を選んでください"); setConfirming(false); return; }
        const toU = users.find((u) => u.id === toUserId);
        if (toU && !toU.active) { setErr("この相手には送れません（在籍していません）"); setConfirming(false); return; }
        setSending(true);
        // 同じ相手には1日1回（従来仕様のまま）
        const todayYmd = getTodayJST();
        const { data: existingRows } = await supabase.from("thanks").select("created_at").eq("from_user_id", myId).eq("to_user_id", toUserId);
        if (existingRows?.some((row: any) => isSameJSTDay(row.created_at, todayYmd))) {
            setErr("今日はすでにこの人にサンキューを送っています（同じ相手には1日1回）");
            setSending(false); setConfirming(false); return;
        }
        const nowIso = new Date().toISOString();
        const msg = message.trim();
        // reason 列が未追加の環境でも送信できるようフォールバック
        let { error } = await supabase.from("thanks").insert({ from_user_id: myId, to_user_id: toUserId, message: msg, message_type: "text", reason, created_at: nowIso } as any);
        if (error && /reason/.test(error.message)) {
            ({ error } = await supabase.from("thanks").insert({ from_user_id: myId, to_user_id: toUserId, message: `【${reason}】${msg}`, message_type: "text", created_at: nowIso } as any));
        }
        if (error) { setErr("送信に失敗しました: " + error.message); setSending(false); setConfirming(false); return; }

        // ポイントは従来ルールのまま：受け取った相手に +1pt（points のみ）。ここ以外で付与しない（二重付与防止）
        const { data: pointRow } = await supabase.from("user_points").select("points").eq("id", toUserId).single();
        await supabase.from("user_points").update({ points: ((pointRow as any)?.points || 0) + 1 }).eq("id", toUserId);
        await supabase.from("points_history").insert({ user_id: toUserId, change: 1, reason: "thanks_received", created_at: nowIso });
        await createNotification({ userId: toUserId, type: "thanks", title: `💌 ${myName || "メンバー"}さんからサンキューが届きました`, message: msg, link: "/thanks", icon: "💌" });

        lastSentAt.current = Date.now();
        const toName = nameOf(toUserId);
        setMessage(""); setReason(""); setToUserId(""); setQ("");
        setConfirming(false); setSending(false);
        setCelebrated(toName);
        await loadHistory(myId);
    };

    const loadAll = async () => {
        if (allList) return;
        const { data } = await supabase.from("thanks").select("*").order("created_at", { ascending: false }).limit(300);
        setAllList((data as any) || []);
    };

    const Face = ({ u, size }: { u: UserOption; size: number }) => u.layered ? (
        <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", position: "relative", background: "radial-gradient(circle at 50% 35%, #fdfbf2, #efe6d2)", flexShrink: 0, border: "2px solid #e2bf63", boxSizing: "border-box" }}>
            <div style={{ position: "absolute", left: "-25%", top: "-27%", width: "151%" }}><AvatarLayered config={u.layered.cfg} job={u.layered.job} showFallback={false} /></div>
        </div>
    ) : u.avatar_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={u.avatar_url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", objectPosition: "top", flexShrink: 0, border: "2px solid #e2bf63", boxSizing: "border-box", background: "#fff" }} />
    ) : (
        <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#9db7e8,#5d7fc9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 900, color: "#fff", flexShrink: 0 }}>{u.name.charAt(0)}</div>
    );

    const rows = tab === "all" ? (allList || []) : list.filter((r) => (tab === "sent" ? r.from_user_id === myId : r.to_user_id === myId));
    const selected = userOf(toUserId);

    if (loading) return <div className="tq-page" style={{ justifyContent: "center" }}><style>{CSS}</style><div style={{ fontWeight: 800, color: "#5a6b85" }}>読み込み中...</div></div>;

    return (
        <div className="tq-page">
            <style>{CSS}</style>
            <div className="tq-col">
                <button className="tq-back" onClick={() => router.push("/home")}>← HOMEへ</button>

                <div className="tq-title">
                    <img src="/home/title_plate.webp" alt="" width={1200} height={374} />
                    <div><span className="t1">サンキュー</span><span className="t2">THANKS</span></div>
                </div>

                {/* ルクの案内 */}
                <div className="tq-luku">
                    <img src="/onboarding/luku.png" alt="ルク" />
                    <div className="bub">仲間に「ありがとう」を届けよう！送ると相手に +1pt のプレゼントになるよ（同じ相手には1日1回）</div>
                </div>

                <div className="tq-stats">
                    <div className="tq-stat"><div className="n">{sentCount}</div><div className="l">送った数</div></div>
                    <div className="tq-stat"><div className="n">{receivedCount}</div><div className="l">受け取った数</div></div>
                </div>

                {/* 送信フォーム */}
                <div className="tq-panel">
                    <div className="tq-h">💌 サンキューを送る</div>
                    <div>
                        <div className="tq-lbl" style={{ marginBottom: 6 }}>1. 送る相手をえらぶ</div>
                        <input className="tq-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="名前・事業部でさがす" />
                        <div className="tq-users" style={{ marginTop: 8 }}>
                            {filtered.map((u) => (
                                <button key={u.id} type="button" className={"tq-user" + (toUserId === u.id ? " on" : "")} onClick={() => setToUserId(u.id === toUserId ? "" : u.id)}>
                                    <Face u={u} size={46} />
                                    <span className="nm">{u.name}</span>
                                    <span className="dp">{u.deptName || "　"}</span>
                                </button>
                            ))}
                            {filtered.length === 0 && <div style={{ gridColumn: "1 / -1", fontSize: 12.5, fontWeight: 800, color: "#8a93a6", padding: 10 }}>見つかりませんでした</div>}
                        </div>
                    </div>
                    <div>
                        <div className="tq-lbl" style={{ marginBottom: 6 }}>2. 感謝の理由</div>
                        <div className="tq-chips">
                            {REASONS.map((r) => <button key={r} type="button" className={"tq-chip" + (reason === r ? " on" : "")} onClick={() => setReason(r)}>{r}</button>)}
                        </div>
                    </div>
                    <div>
                        <div className="tq-lbl" style={{ marginBottom: 6 }}>3. メッセージ（{MIN_LEN}〜{MAX_LEN}文字）</div>
                        <textarea className="tq-ta" value={message} maxLength={MAX_LEN} onChange={(e) => setMessage(e.target.value)} placeholder="どんなところに感謝してる？具体的に書くと気持ちがもっと伝わるよ" />
                        <div className="tq-cnt" style={{ color: message.trim().length >= MIN_LEN ? "#2e7d4f" : "#8a93a6" }}>{message.trim().length} / {MAX_LEN}</div>
                    </div>
                    {err && <div className="tq-err">{err}</div>}
                    <button className="tq-send" disabled={!canOpenConfirm || sending} onClick={() => { setErr(""); setConfirming(true); }}>💌 内容を確認して送る</button>
                </div>

                {/* 履歴 */}
                <div className="tq-panel">
                    <div className="tq-h">📖 サンキューのきろく</div>
                    <div className="tq-tabs">
                        <button className={"tq-tab" + (tab === "sent" ? " on" : "")} onClick={() => setTab("sent")}>送った</button>
                        <button className={"tq-tab" + (tab === "received" ? " on" : "")} onClick={() => setTab("received")}>受け取った</button>
                        {isAdmin && <button className={"tq-tab" + (tab === "all" ? " on" : "")} onClick={() => { setTab("all"); loadAll(); }}>全員（管理）</button>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
                        {rows.length === 0 && <div style={{ fontSize: 12.5, fontWeight: 800, color: "#8a93a6", textAlign: "center", padding: 14 }}>まだサンキューはありません</div>}
                        {rows.map((r) => {
                            const from = userOf(r.from_user_id); const isRecv = r.to_user_id === myId;
                            return (
                                <div key={r.id} className="tq-row">
                                    {from ? <Face u={from} size={38} /> : <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#dfe6f2", flexShrink: 0 }} />}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className="meta"><b style={{ color: "#17397d" }}>{nameOf(r.from_user_id)}</b> → <b style={{ color: isRecv ? "#b06000" : "#17397d" }}>{nameOf(r.to_user_id)}</b>　{formatJSTShort(r.created_at)}</div>
                                        <div className="msg">{r.reason && <span className="rsn">{r.reason}</span>}{r.message}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 送信前の確認 */}
            {confirming && (
                <div className="tq-modal" onClick={() => !sending && setConfirming(false)}>
                    <div className="tq-card" onClick={(e) => e.stopPropagation()}>
                        <h3>この内容で送る？</h3>
                        <div className="tq-kv"><small>送る相手</small>{selected ? `${selected.name}${selected.deptName ? `（${selected.deptName}）` : ""}` : ""}</div>
                        <div className="tq-kv"><small>感謝の理由</small>{reason}</div>
                        <div className="tq-kv"><small>メッセージ</small><span style={{ whiteSpace: "pre-wrap" }}>{message.trim()}</span></div>
                        <div className="tq-btn2">
                            <button style={{ border: "2px solid #c9cfdb", background: "#fff", color: "#5a6b85" }} onClick={() => setConfirming(false)} disabled={sending}>直す</button>
                            <button style={{ border: "2px solid #e8c45a", background: "linear-gradient(180deg,#ffd76a,#f0a92d)", color: "#5a3a06" }} onClick={doSend} disabled={sending}>{sending ? "送信中..." : "送る！"}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 送信成功：ルクのお祝い */}
            {celebrated && (
                <div className="tq-modal" onClick={() => setCelebrated(null)}>
                    {["#fbbf24", "#f472b6", "#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#fbbf24"].map((c, i) => (
                        <div key={i} style={{ position: "absolute", top: 0, left: `${8 + i * 11}%`, width: 9, height: 9, borderRadius: 2, background: c, animation: `tqConfetti ${2 + (i % 3) * 0.5}s linear ${(i % 4) * 0.25}s infinite` }} />
                    ))}
                    <div className="tq-card" style={{ textAlign: "center", animation: "tqPop .45s ease-out" }} onClick={(e) => e.stopPropagation()}>
                        <img src="/home/icon_thanks.webp" alt="" style={{ width: 92, margin: "0 auto 6px", display: "block", filter: "drop-shadow(0 6px 10px rgba(170,110,20,.35))" }} />
                        <h3>サンキューを届けたよ！</h3>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: "#fffdf6", border: "1.5px solid #e7dcc0", borderRadius: 14, padding: "10px 12px" }}>
                            <img src="/onboarding/luku.png" alt="ルク" style={{ width: 52, flexShrink: 0 }} />
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#4a3519", lineHeight: 1.7 }}>{celebrated}さんに気持ちが届いたよ！✨ 相手に +1pt プレゼント。今日のクエストも達成！</div>
                        </div>
                        <div className="tq-btn2">
                            <button style={{ border: "2px solid #c9cfdb", background: "#fff", color: "#5a6b85" }} onClick={() => setCelebrated(null)}>つづけて送る</button>
                            <button style={{ border: "2px solid #e8c45a", background: "linear-gradient(180deg,#ffd76a,#f0a92d)", color: "#5a3a06" }} onClick={() => router.push("/home")}>HOMEへ戻る</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
