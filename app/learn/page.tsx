"use client";
// Intern Quest 2.0｜学習コンテンツ「魔法図書館」
// HOME と同じ世界観（青空・ロイヤルブルー×金・羊皮紙）。
// ★既存機能は維持：contents/content_completions の取得、レビュー提出（insert/update→pending）、
//   承認フロー・+2pt付与（管理者側）・YouTube埋め込み・資料リンク・?open= 直接表示・カテゴリ構成。
// ★おすすめは既存ロジック（未完了教材から日替わり）を継続。
// ★今週の学習数・連続学習日数・完了日は content_completions.created_at から実算出（仮数値なし）。
// ★背景・魔導書装飾・専用パネル素材は ChatGPT 素材待ち（public/learn/）。届くまで既存素材＋CSS仮組み。
//   浮遊島アイコンは既存 public/categories/cat_*.png を再利用。
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

type Content = {
    id: string;
    title: string;
    description: string | null;
    content_type: string;
    url: string | null;
    body: string | null;
    category?: string | null;
    is_required?: boolean;
};
type Completion = {
    id: string;
    content_id: string;
    status: string;
    review: string | null;
    feedback?: string | null;
    created_at?: string | null;
};

// カテゴリ定義（既存の island 画像を再利用。構成・名称は既存データ準拠）
const CATEGORY_DEF: { name: string; img?: string; emoji?: string; color: string }[] = [
    { name: "配属前必修", img: "/categories/cat_haizoku.png", color: "#a78bfa" },
    { name: "必修", img: "/categories/cat_hisshu.png", color: "#8b5cf6" },
    { name: "マインド", img: "/categories/cat_mind.png", color: "#f87171" },
    { name: "社会人の当たり前", img: "/categories/cat_atarimae.png", color: "#fbbf24" },
    { name: "就活・キャリア", img: "/categories/cat_career.png", color: "#38bdf8" },
    { name: "社会人基礎", img: "/categories/cat_kiso.png", color: "#34d399" },
    { name: "AI・スキル", img: "/categories/cat_ai.png", color: "#818cf8" },
    { name: "マインドセット", img: "/categories/cat_mind.png", color: "#fb923c" },
    { name: "思考法・仕事術", img: "/categories/cat_shikou.png", color: "#fcd34d" },
    { name: "営業・ビジネス", img: "/categories/cat_eigyo.png", color: "#a78bfa" },
    { name: "教養・その他", img: "/categories/cat_kyoyo.png", color: "#94a3b8" },
];

function getYouTubeId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : null;
}
function getThumbnail(url: string | null): string | null {
    if (!url) return null;
    const ytId = getYouTubeId(url);
    if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    return null;
}
function ymdJST(iso: string): string {
    const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function fmtDate(iso?: string | null): string {
    if (!iso) return "";
    const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
    return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

const CSS = `
.lr-page{min-height:100vh;overflow-x:clip;background:url(/home/bg_mobile.webp) center top / cover no-repeat fixed, #bfe3f5;display:flex;flex-direction:column;align-items:center;padding:14px 14px 130px;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#1f2a44}
.lr-col{width:100%;max-width:480px;display:flex;flex-direction:column}
@media (min-width:700px){ .lr-page{background-image:url(/home/bg_pc.webp)} .lr-col{max-width:880px} }

/* タイトル */
.lr-title{position:relative;width:min(88%,460px);margin:0 auto;container-type:inline-size;z-index:2}
.lr-title img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 14px rgba(20,40,90,.3))}
.lr-title>div{position:absolute;inset:25.9% 10% 11.8%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;pointer-events:none}
.lr-title .t1{font-size:clamp(16px,6.2cqw,26px);font-weight:900;letter-spacing:.1em;text-shadow:0 2px 4px rgba(10,25,70,.55)}
.lr-title .t2{font-size:clamp(8px,2.3cqw,11px);font-weight:800;letter-spacing:.1em;color:#cfe0ff;margin-top:1%}

/* 見出しリボン */
.lr-h{align-self:center;display:flex;align-items:center;gap:8px;background:linear-gradient(180deg,#3b70d4,#1d3f96);border:2px solid #e2bf63;border-radius:999px;padding:6px 24px;font-weight:900;color:#fff;font-size:14px;margin:18px 0 10px;box-shadow:0 3px 8px rgba(20,40,100,.3),inset 0 2px 0 rgba(255,255,255,.25)}
.lr-h .dia{color:#ffe9a8;font-size:.8em}

/* ルク＋進捗 */
.lr-two{display:grid;grid-template-columns:1fr;gap:12px;margin-top:12px}
@media (min-width:700px){ .lr-two{grid-template-columns:11fr 9fr;align-items:end} }
.lr-luku{display:flex;align-items:flex-end;container-type:inline-size}
.lr-luku .lk{width:27%;max-width:120px;flex:none}
.lr-luku .lk img{width:100%;display:block;filter:drop-shadow(0 6px 10px rgba(30,40,90,.3))}
.lr-luku .bw{flex:1;min-width:0;display:flex;flex-direction:column;margin-bottom:4%}
.lr-luku .pl{width:30%;min-width:88px;position:relative;margin-left:5%;z-index:2}
.lr-luku .pl img{display:block;width:100%;height:auto}
.lr-luku .pl span{position:absolute;inset:0 0 6% 0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:clamp(11px,3cqw,14px);letter-spacing:.2em;text-shadow:0 1px 3px rgba(10,25,70,.6)}
.lr-luku .bub{margin-top:-4%;background:url(/home/luku_bubble.webp);background-size:100% 100%;padding:7% 7% 10% 8.5%;font-weight:800;color:#4a3519;font-size:clamp(11.5px,3.2cqw,13.5px);line-height:1.7}
.lr-prog{background:linear-gradient(180deg,#3b70d4,#1d3f96);border:2.5px solid #e2bf63;border-radius:18px;padding:12px 16px;color:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.35),0 8px 18px rgba(20,40,100,.3),inset 0 2px 0 rgba(255,255,255,.25)}
.lr-prog .hd{font-size:11px;font-weight:900;letter-spacing:.22em;color:#ffe9a8;margin-bottom:6px}
.lr-prog .num{font-size:24px;font-weight:900;line-height:1.1}
.lr-prog .num small{font-size:13px;font-weight:800;color:#cfe0ff}
.lr-prog .row{display:flex;align-items:center;gap:10px;margin-top:8px}
.lr-prog .barw{flex:1;height:12px;border-radius:999px;background:rgba(10,25,70,.45);border:1.5px solid rgba(255,233,168,.6);overflow:hidden}
.lr-prog .bar{height:100%;border-radius:999px;background:linear-gradient(90deg,#ffd76e,#f0b429);box-shadow:0 0 8px rgba(255,210,80,.7);transition:width 1s ease}
.lr-prog .pct{font-size:14px;font-weight:900;color:#ffe9a8}

/* 羊皮紙パネル共通 */
.lr-pn{background:linear-gradient(180deg,#fffdf4,#f8efdb);border:3px solid #d8b55e;border-radius:18px;padding:14px;box-shadow:0 0 0 3px rgba(255,255,255,.4),0 8px 20px rgba(40,60,120,.15),inset 0 2px 0 rgba(255,255,255,.8)}
.lr-pn .ph{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:900;color:#8a6a3a;letter-spacing:.1em;padding-bottom:8px;border-bottom:2px solid rgba(190,160,110,.35);margin-bottom:10px}

/* 本日のおすすめクエスト（素材到着後: 背景を learn/frame_recommend.webp に差し替え） */
.lr-rec{margin-top:4px}
.lr-rec .body{display:flex;gap:12px;align-items:flex-start}
@media (max-width:699px){ .lr-rec .body{flex-direction:column} }
.lr-rec .th{flex:none;width:200px;max-width:100%;aspect-ratio:16/9;border-radius:12px;overflow:hidden;border:2px solid #d8b55e;background:linear-gradient(135deg,#dce9ff,#b9cff5);display:flex;align-items:center;justify-content:center;font-size:40px}
@media (max-width:699px){ .lr-rec .th{width:100%} }
.lr-rec .th img{width:100%;height:100%;object-fit:cover;display:block}
.lr-rec .cat{display:inline-block;font-size:10.5px;font-weight:900;color:#fff;background:linear-gradient(180deg,#4b7ae0,#1d3f96);border:1px solid #e2bf63;border-radius:999px;padding:3px 10px}
.lr-rec .tt{font-size:16px;font-weight:900;color:#1f2a44;line-height:1.45;margin-top:6px}
.lr-rec .meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;font-size:11.5px;font-weight:800;color:#8a6a3a}
.lr-rec .desc{font-size:11.5px;font-weight:700;color:#6a7690;line-height:1.6;margin-top:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.lr-btn{display:block;width:100%;margin-top:12px;padding:13px 0;border-radius:999px;border:2px solid #e2bf63;background:linear-gradient(180deg,#4b7ae0,#1d3f96);color:#fff;font-size:14.5px;font-weight:900;letter-spacing:.06em;cursor:pointer;font-family:inherit;box-shadow:0 5px 0 #12306e,0 8px 16px rgba(20,40,100,.35),inset 0 2px 0 rgba(255,255,255,.3);transition:transform .08s,box-shadow .08s}
.lr-btn:active{transform:translateY(3px);box-shadow:0 2px 0 #12306e,0 4px 8px rgba(20,40,100,.3),inset 0 2px 0 rgba(255,255,255,.3)}

/* 冒険マップ（浮遊島） */
.lr-map{display:flex;gap:10px;overflow-x:auto;padding:14px 4px 10px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.lr-map::-webkit-scrollbar{display:none}
.lr-isl{flex:none;width:96px;background:transparent;border:none;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;-webkit-tap-highlight-color:transparent}
.lr-isl .iw{width:84px;height:84px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:box-shadow .2s}
.lr-isl.on .iw{box-shadow:0 0 0 3px #e2bf63,0 0 18px rgba(255,210,80,.85),0 0 34px rgba(255,210,80,.4);background:radial-gradient(circle,rgba(255,235,170,.55),rgba(255,235,170,0) 70%)}
.lr-isl img{width:82px;height:82px;object-fit:contain;filter:drop-shadow(0 6px 8px rgba(30,40,90,.3))}
.lr-isl .em{font-size:40px;line-height:82px;filter:drop-shadow(0 4px 5px rgba(30,40,90,.3))}
.lr-isl .np{margin-top:4px;width:100%;background:linear-gradient(180deg,#fffdf4,#f3e6c8);border:1.5px solid #cdb87e;border-radius:10px;padding:4px 4px;box-shadow:0 2px 5px rgba(140,100,30,.2)}
.lr-isl .nm{font-size:10px;font-weight:900;color:#5a4a20;line-height:1.25}
.lr-isl.on .nm{color:#17397d}
.lr-isl .ct{font-size:9px;font-weight:800;color:#a08356;margin-top:1px}
@keyframes lrfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.lr-isl .iw{animation:lrfloat 4.6s ease-in-out infinite}
.lr-isl:nth-child(2n) .iw{animation-delay:-1.6s}
.lr-isl:nth-child(3n) .iw{animation-delay:-3s}
@media (prefers-reduced-motion: reduce){ .lr-isl .iw{animation:none} }

/* 必修クエスト */
.lr-req{display:flex;align-items:center;gap:10px;width:100%;padding:10px 8px;border:none;border-bottom:1px solid rgba(190,160,110,.25);background:transparent;cursor:pointer;font-family:inherit;text-align:left;border-radius:10px}
.lr-req:last-of-type{border-bottom:none}
.lr-req .ic{font-size:19px;flex:none}
.lr-req .tt{flex:1;min-width:0;font-size:13px;font-weight:800;color:#3a4256}
.lr-req .tt .q{display:block;font-size:9.5px;font-weight:900;color:#a08356;letter-spacing:.08em}
.lr-req .st{flex:none;font-size:10.5px;font-weight:900;border-radius:999px;padding:4px 10px}
.lr-req .st.done{background:rgba(46,157,95,.14);color:#1e7a45;border:1px solid rgba(46,157,95,.4)}
.lr-req .st.pend{background:rgba(232,154,29,.14);color:#a06a00;border:1px solid rgba(232,154,29,.45)}
.lr-req .st.todo{background:linear-gradient(180deg,#4b7ae0,#1d3f96);color:#fff;border:1px solid #e2bf63}

/* 教材カード（動画） */
.lr-vgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
@media (min-width:700px){ .lr-vgrid{grid-template-columns:repeat(auto-fill,minmax(190px,1fr))} }
.lr-vc{border:2px solid #d8b55e;border-radius:14px;overflow:hidden;background:linear-gradient(180deg,#fffdf4,#f8efdb);cursor:pointer;box-shadow:0 4px 10px rgba(40,60,120,.14);transition:transform .15s,box-shadow .15s;padding:0;text-align:left;font-family:inherit}
.lr-vc:hover{transform:translateY(-3px);box-shadow:0 8px 18px rgba(40,60,120,.22)}
.lr-vc .th{position:relative;aspect-ratio:16/9;background:linear-gradient(135deg,#dce9ff,#b9cff5);display:flex;align-items:center;justify-content:center;font-size:30px}
.lr-vc .th img{width:100%;height:100%;object-fit:cover;display:block}
.lr-vc .done{position:absolute;top:6px;left:6px;font-size:10px;font-weight:900;color:#fff;background:#2e9d5f;border-radius:6px;padding:2px 7px;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.lr-vc .req{position:absolute;top:6px;right:6px;font-size:9.5px;font-weight:900;color:#8a2020;background:rgba(255,245,240,.95);border:1px solid #e0a090;border-radius:6px;padding:2px 6px}
.lr-vc .bd{padding:8px 10px 9px}
.lr-vc .tt{font-size:11.5px;font-weight:800;color:#3a4256;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.lr-vc .ct{font-size:9.5px;font-weight:800;color:#a08356;margin-top:4px}

/* 読み物 */
.lr-ar{display:flex;align-items:flex-start;gap:9px;width:100%;padding:11px 8px;border:none;border-bottom:1px solid rgba(190,160,110,.25);background:transparent;cursor:pointer;font-family:inherit;text-align:left;border-radius:10px}
.lr-ar:last-of-type{border-bottom:none}
.lr-ar .ic{font-size:17px;flex:none}
.lr-ar .mid{flex:1;min-width:0}
.lr-ar .tt{font-size:13px;font-weight:800;color:#3a4256;line-height:1.4}
.lr-ar .tt.done{color:#1e7a45}
.lr-ar .ds{font-size:10.5px;font-weight:700;color:#8a93a6;line-height:1.5;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.lr-ar .tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:3px}
.lr-tag{font-size:9px;font-weight:900;border-radius:6px;padding:1.5px 6px}
.lr-tag.req{color:#8a2020;background:rgba(224,120,100,.12);border:1px solid rgba(224,120,100,.45)}
.lr-tag.pend{color:#a06a00;background:rgba(232,154,29,.12);border:1px solid rgba(232,154,29,.45)}
.lr-tag.cat{color:#17397d;background:rgba(75,122,224,.1);border:1px solid rgba(75,122,224,.35)}

/* 最近学んだ・学習の記録 */
.lr-bot{display:grid;grid-template-columns:1fr;gap:12px;margin-top:14px}
@media (min-width:700px){ .lr-bot{grid-template-columns:3fr 2fr;align-items:start} }
.lr-rc{display:flex;align-items:center;gap:8px;width:100%;padding:8px 6px;border:none;border-bottom:1px solid rgba(190,160,110,.25);background:transparent;cursor:pointer;font-family:inherit;text-align:left;border-radius:8px}
.lr-rc:last-of-type{border-bottom:none}
.lr-rc .ic{font-size:15px;flex:none}
.lr-rc .tt{flex:1;min-width:0;font-size:12px;font-weight:800;color:#3a4256;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lr-rc .dt{flex:none;font-size:10px;font-weight:800;color:#a08356}
.lr-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.lr-stat{background:linear-gradient(180deg,#fdf6e3,#f3e6c8);border:2px solid #cdb87e;border-radius:14px;padding:10px 8px;text-align:center}
.lr-stat .lb{font-size:10px;font-weight:900;color:#8a6a3a}
.lr-stat .vl{font-size:22px;font-weight:900;color:#17397d;margin-top:3px}
.lr-stat .vl small{font-size:12px}

/* メッセージ */
.lr-msg{margin-top:12px;padding:11px 14px;border-radius:12px;background:linear-gradient(180deg,#eefaf0,#d9f2e0);border:2px solid #7cc89a;color:#1e7a45;font-size:12.5px;font-weight:800}

/* モーダル（明るい羊皮紙。既存ロジックは不変） */
.lr-mw{position:fixed;inset:0;background:rgba(20,30,60,.6);z-index:100;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto}
.lr-md{background:linear-gradient(180deg,#fffdf4,#f8efdb);border:3px solid #d8b55e;border-radius:20px;padding:20px;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;margin:auto;box-shadow:0 0 0 3px rgba(255,255,255,.4),0 18px 50px rgba(20,30,60,.4);color:#1f2a44}
.lr-md h2{font-size:17px;font-weight:900;color:#17397d;margin:0}
.lr-md textarea{width:100%;height:100px;padding:12px 14px;border-radius:12px;border:2px solid #cdb87e;background:#fffef8;color:#1f2a44;font-size:14px;outline:none;resize:none;box-sizing:border-box;font-family:inherit;margin-bottom:10px}
.lr-md textarea::placeholder{color:#b5a687}

/* 下部ナビ（共通） */
.lr-nav{position:fixed;left:0;bottom:0;width:100%;max-width:100vw;box-sizing:border-box;z-index:50;display:flex;height:calc(86px + env(safe-area-inset-bottom));padding:0 10px calc(10px + env(safe-area-inset-bottom));overflow:hidden}
.lr-nav .band{position:absolute;inset:6px 8px calc(8px + env(safe-area-inset-bottom));background:url(/home/nav_bar.webp);background-size:100% 100%;pointer-events:none}
.lr-nav button{position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;padding-bottom:calc(17px + env(safe-area-inset-bottom));background:transparent;border:none;cursor:pointer;color:#fff;text-shadow:0 1px 2px rgba(70,40,10,.7);-webkit-tap-highlight-color:transparent}
.lr-nav .lbl{font-size:10.5px;font-weight:800}
`;

function LearnPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [userId, setUserId] = useState("");
    const [contents, setContents] = useState<Content[]>([]);
    const [completions, setCompletions] = useState<Completion[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Content | null>(null);
    const [review, setReview] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [catFilter, setCatFilter] = useState<string>("all");
    const [barOn, setBarOn] = useState(false);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);
            const { data: contentRows } = await supabase.from("contents").select("*").eq("is_active", true).order("created_at", { ascending: false });
            const cs = (contentRows || []) as Content[];
            setContents(cs);
            const { data: completionRows } = await supabase.from("content_completions").select("id,content_id, status, review, feedback, created_at").eq("user_id", user.id);
            setCompletions((completionRows || []) as Completion[]);
            const openId = searchParams.get("open");
            if (openId) {
                const target = cs.find(c => c.id === openId);
                if (target) setSelected(target);
            }
            setLoading(false);
            setTimeout(() => setBarOn(true), 80);
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    const getCompletion = (contentId: string) => completions.find(c => c.content_id === contentId);

    // ===== レビュー提出（既存ロジックそのまま） =====
    const handleSubmitReview = async () => {
        if (!selected || !review.trim()) return;
        setSubmitting(true);
        const existing = getCompletion(selected.id);
        if (existing) {
            await supabase.from("content_completions").update({ review: review.trim(), status: "pending" }).eq("id", existing.id);
            setCompletions(prev => prev.map(c => c.id === existing.id ? { ...c, review: review.trim(), status: "pending" } : c));
        } else {
            const { data } = await supabase.from("content_completions").insert({
                user_id: userId,
                content_id: selected.id,
                review: review.trim(),
                status: "pending",
            }).select().single();
            if (data) setCompletions(prev => [...prev, data as Completion]);
        }
        setMessage("✨ レビューを提出しました！管理者の承認をお待ちください。");
        setTimeout(() => setMessage(""), 4000);
        setSubmitting(false);
    };

    if (loading) return (
        <div className="lr-page" style={{ justifyContent: "center" }}>
            <style>{CSS}</style>
            <div style={{ fontWeight: 800, color: "#5a6b85" }}>読み込み中...</div>
        </div>
    );

    const doneCount = completions.filter(c => c.status === "approved").length;
    const totalCount = contents.length;
    const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

    // カテゴリフィルタ適用
    const filtered = catFilter === "all" ? contents : contents.filter(c => c.category === catFilter);
    const videos = filtered.filter(c => c.content_type === "video");
    const articles = filtered.filter(c => c.content_type !== "video");

    const notDone = (c: Content) => {
        const comp = getCompletion(c.id);
        return !comp || comp.status !== "approved";
    };
    // 今日のおすすめ：未完了コンテンツから日替わり（既存ロジック維持）
    const undoneAll = contents.filter(notDone);
    const dayIndex = new Date().getDate();
    const todayQuest = undoneAll.length > 0 ? undoneAll[dayIndex % undoneAll.length] : contents[0];

    const requiredQuests = contents.filter(c => c.is_required);

    const usedCats = new Set(contents.map(c => c.category).filter(Boolean));
    const shownCats = CATEGORY_DEF.filter(cd => usedCats.has(cd.name));
    const catStats = (name: string) => {
        const list = contents.filter(c => c.category === name);
        const done = list.filter(c => getCompletion(c.id)?.status === "approved").length;
        return { total: list.length, done };
    };

    // ===== 最近学んだ教材（created_at 実データ） =====
    const recent = [...completions]
        .filter(c => c.created_at)
        .sort((a, b) => (b.created_at! > a.created_at! ? 1 : -1))
        .slice(0, 5)
        .map(c => ({ comp: c, content: contents.find(ct => ct.id === c.content_id) }))
        .filter(r => r.content);

    // ===== 学習の記録（実データから算出） =====
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekCount = completions.filter(c => c.status === "approved" && c.created_at && new Date(c.created_at).getTime() >= weekAgo).length;
    const days = new Set(completions.filter(c => c.created_at).map(c => ymdJST(c.created_at!)));
    let streak = 0;
    {
        const d = new Date();
        // 今日学習していなければ昨日から数える
        if (!days.has(ymdJST(d.toISOString()))) d.setDate(d.getDate() - 1);
        while (days.has(ymdJST(d.toISOString()))) { streak++; d.setDate(d.getDate() - 1); }
    }

    const openContent = (c: Content) => { setSelected(c); setReview(getCompletion(c.id)?.review || ""); };
    const recThumb = todayQuest ? getThumbnail(todayQuest.url) : null;

    return (
        <div className="lr-page">
            <style>{CSS}</style>
            <div className="lr-col">
                {/* A. タイトル */}
                <div className="lr-title">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/home/title_plate.webp" alt="" width={1200} height={374} />
                    <div><span className="t1">📚 学習コンテンツ</span><span className="t2">知識を集め、力に変える冒険の図書館</span></div>
                </div>

                {/* B. ルク＋学習進捗（実データ） */}
                <div className="lr-two">
                    <div className="lr-luku">
                        <div className="lk">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/onboarding/luku.png" alt="ルク" />
                        </div>
                        <div className="bw">
                            <div className="pl">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/home/luku_plate.webp" alt="" /><span>ルク</span>
                            </div>
                            <div className="bub">今日の学びのクエストはこちら！新しい知識を手に入れて、さらに成長しよう！</div>
                        </div>
                    </div>
                    <div className="lr-prog">
                        <div className="hd">📖 学習の進捗</div>
                        <div className="num">{doneCount} <small>/ {totalCount} 冊 修了</small></div>
                        <div className="row">
                            <div className="barw"><div className="bar" style={{ width: barOn ? `${pct}%` : 0 }} /></div>
                            <div className="pct">{pct}%</div>
                        </div>
                    </div>
                </div>

                {/* C. 本日のおすすめクエスト */}
                {todayQuest && (
                    <>
                        <div className="lr-h"><span className="dia">◆</span>本日のおすすめクエスト<span className="dia">◆</span></div>
                        <div className="lr-pn lr-rec">
                            <div className="body">
                                <div className="th">
                                    {recThumb ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={recThumb} alt="" />
                                    ) : (
                                        <span>{todayQuest.content_type === "video" ? "🎬" : "📖"}</span>
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    {todayQuest.category && <span className="cat">👑 {todayQuest.category}</span>}
                                    <div className="tt">{todayQuest.title}</div>
                                    <div className="meta">
                                        <span>{todayQuest.content_type === "video" ? "🎬 動画" : "📖 読み物"}</span>
                                        <span>📝 レビューで <b style={{ color: "#17397d" }}>+2pt</b></span>
                                        {todayQuest.is_required && <span style={{ color: "#8a2020" }}>📌 必修</span>}
                                    </div>
                                    {todayQuest.description && <div className="desc">{todayQuest.description}</div>}
                                </div>
                            </div>
                            <button className="lr-btn" onClick={() => openContent(todayQuest)}>▶ 今すぐ学習をはじめる</button>
                        </div>
                    </>
                )}

                {/* D. 学びの冒険マップ（既存カテゴリの浮遊島） */}
                <div className="lr-h"><span className="dia">◆</span>学びの冒険マップ<span className="dia">◆</span></div>
                <div className="lr-map">
                    <button className={`lr-isl${catFilter === "all" ? " on" : ""}`} onClick={() => setCatFilter("all")}>
                        <div className="iw"><span className="em">🏰</span></div>
                        <div className="np"><div className="nm">すべて</div><div className="ct">{doneCount}/{totalCount}冊</div></div>
                    </button>
                    {shownCats.map(cd => {
                        const st = catStats(cd.name);
                        const on = catFilter === cd.name;
                        return (
                            <button key={cd.name} className={`lr-isl${on ? " on" : ""}`} onClick={() => setCatFilter(on ? "all" : cd.name)}>
                                <div className="iw">
                                    {cd.img ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={cd.img} alt={cd.name} />
                                    ) : (
                                        <span className="em">{cd.emoji}</span>
                                    )}
                                </div>
                                <div className="np"><div className="nm">{cd.name}</div><div className="ct">{st.done}/{st.total}冊</div></div>
                            </button>
                        );
                    })}
                </div>

                {message && <div className="lr-msg">{message}</div>}

                {/* 必修クエスト（全体表示時のみ・既存機能維持） */}
                {requiredQuests.length > 0 && catFilter === "all" && (
                    <div className="lr-pn" style={{ marginTop: 14 }}>
                        <div className="ph">📜 あなたの必修クエスト</div>
                        {requiredQuests.map((c, i) => {
                            const comp = getCompletion(c.id);
                            const done = comp?.status === "approved";
                            const pending = comp?.status === "pending";
                            return (
                                <button key={c.id} className="lr-req" onClick={() => openContent(c)}>
                                    <span className="ic">{done ? "✅" : "📜"}</span>
                                    <span className="tt"><span className="q">QUEST {i + 1}・報酬 +2pt</span>{c.title}</span>
                                    <span className={`st ${done ? "done" : pending ? "pend" : "todo"}`}>{done ? "完了" : pending ? "審査中" : "今すぐ学習"}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* 教材一覧（動画） */}
                {videos.length > 0 && (
                    <div className="lr-pn" style={{ marginTop: 14 }}>
                        <div className="ph">🎬 {catFilter === "all" ? "おすすめ動画" : `${catFilter} の動画`}
                            {catFilter !== "all" && <button onClick={() => setCatFilter("all")} style={{ marginLeft: "auto", border: "none", background: "none", color: "#17397d", fontWeight: 900, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>すべて表示 ✕</button>}
                        </div>
                        <div className="lr-vgrid">
                            {videos.map(content => {
                                const comp = getCompletion(content.id);
                                const done = comp?.status === "approved";
                                const thumb = getThumbnail(content.url);
                                return (
                                    <button key={content.id} className="lr-vc" onClick={() => openContent(content)}>
                                        <div className="th">
                                            {thumb ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={thumb} alt={content.title} />
                                            ) : <span>🎬</span>}
                                            {done && <span className="done">✓ 完了</span>}
                                            {content.is_required && !done && <span className="req">📌必修</span>}
                                        </div>
                                        <div className="bd">
                                            <div className="tt">{content.title}</div>
                                            {content.category && <div className="ct">{content.category}</div>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 教材一覧（読み物） */}
                {articles.length > 0 && (
                    <div className="lr-pn" style={{ marginTop: 14 }}>
                        <div className="ph">📜 {catFilter === "all" ? "読み物コンテンツ" : `${catFilter} の読み物`}</div>
                        {articles.map(content => {
                            const comp = getCompletion(content.id);
                            const done = comp?.status === "approved";
                            const pending = comp?.status === "pending";
                            return (
                                <button key={content.id} className="lr-ar" onClick={() => openContent(content)}>
                                    <span className="ic">{done ? "✅" : "📄"}</span>
                                    <span className="mid">
                                        <span className={`tt${done ? " done" : ""}`} style={{ display: "block" }}>{content.title}</span>
                                        {content.description && <span className="ds" style={{ display: "block" }}>{content.description}</span>}
                                        <span className="tags">
                                            {content.is_required && <span className="lr-tag req">📌 必修</span>}
                                            {pending && <span className="lr-tag pend">審査中</span>}
                                            {content.category && <span className="lr-tag cat">{content.category}</span>}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {filtered.length === 0 && (
                    <div className="lr-pn" style={{ marginTop: 14, textAlign: "center", color: "#8a6a3a", fontWeight: 800, fontSize: 13 }}>このカテゴリのコンテンツはまだありません</div>
                )}

                {/* E/F. 最近学んだ教材・学習の記録（実データ） */}
                <div className="lr-bot">
                    <div className="lr-pn">
                        <div className="ph">📖 最近学んだ教材</div>
                        {recent.length === 0 ? (
                            <div style={{ fontSize: 12.5, fontWeight: 800, color: "#8a6a3a", textAlign: "center", padding: "14px 0" }}>最初の学びのクエストに挑戦しよう！✨</div>
                        ) : recent.map(({ comp, content }) => (
                            <button key={comp.id} className="lr-rc" onClick={() => openContent(content!)}>
                                <span className="ic">{comp.status === "approved" ? "✅" : comp.status === "pending" ? "⏳" : "▶️"}</span>
                                <span className="tt">{content!.title}</span>
                                <span className="dt">{comp.status === "approved" ? `修了 ${fmtDate(comp.created_at)}` : comp.status === "pending" ? "審査中" : "再挑戦"}</span>
                            </button>
                        ))}
                    </div>
                    <div className="lr-pn">
                        <div className="ph">📊 学習の記録</div>
                        <div className="lr-stats">
                            <div className="lr-stat"><div className="lb">🪶 今週の学習</div><div className="vl">{weekCount}<small> 冊</small></div></div>
                            <div className="lr-stat"><div className="lb">🔥 連続学習</div><div className="vl">{streak}<small> 日</small></div></div>
                        </div>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: "#a08356", marginTop: 8, textAlign: "center" }}>レビュー提出日をもとに算出しています</div>
                    </div>
                </div>

                {/* ===== 詳細モーダル（既存ロジック維持・見た目のみ羊皮紙化） ===== */}
                {selected && (
                    <div className="lr-mw" onClick={() => { setSelected(null); setMessage(""); }}>
                        <div className="lr-md" onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                                <h2>{selected.title}</h2>
                                <button onClick={() => { setSelected(null); setMessage(""); }} style={{ background: "none", border: "none", color: "#a08356", fontSize: 24, cursor: "pointer", lineHeight: 1, flexShrink: 0 }}>×</button>
                            </div>

                            {selected.content_type === "video" && selected.url && getYouTubeId(selected.url) ? (
                                <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: 16, border: "2px solid #d8b55e" }}>
                                    <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${getYouTubeId(selected.url)}`} title={selected.title} style={{ border: "none", display: "block", aspectRatio: "16/9" }} allowFullScreen />
                                </div>
                            ) : (
                                (selected.body || selected.url) && (
                                    (selected.body?.startsWith("http") || (!selected.body && selected.url)) ? (
                                        <div style={{ marginBottom: 16 }}>
                                            <a href={((selected.body?.startsWith("http") ? selected.body : selected.url) || "").trim()} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: 12, background: "rgba(75,122,224,.08)", border: "2px solid rgba(75,122,224,.35)", textDecoration: "none" }}>
                                                <span style={{ fontSize: 22 }}>🔗</span>
                                                <div style={{ overflow: "hidden" }}>
                                                    <div style={{ fontSize: 13, fontWeight: 800, color: "#17397d" }}>資料を開く</div>
                                                    <div style={{ fontSize: 11, color: "#8a93a6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{((selected.body?.startsWith("http") ? selected.body : selected.url) || "").trim()}</div>
                                                </div>
                                            </a>
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 14.5, color: "#3a4256", lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 18, padding: 14, borderRadius: 12, background: "#fffef8", border: "1.5px solid rgba(190,160,110,.4)" }}>
                                            {selected.body}
                                        </div>
                                    )
                                )
                            )}

                            {selected.description && <p style={{ fontSize: 12.5, color: "#6a7690", lineHeight: 1.7, marginBottom: 16, fontWeight: 700 }}>{selected.description}</p>}

                            {(() => {
                                const comp = getCompletion(selected.id);
                                const done = comp?.status === "approved";
                                if (done) {
                                    return (
                                        <div style={{ padding: "13px 16px", borderRadius: 12, background: "rgba(46,157,95,.1)", border: "2px solid rgba(46,157,95,.4)" }}>
                                            <div style={{ fontSize: 13, fontWeight: 900, color: "#1e7a45", marginBottom: 6 }}>✅ 完了済み</div>
                                            {comp?.review && <div style={{ fontSize: 12.5, color: "#3a4256", lineHeight: 1.6, fontWeight: 700 }}>あなたのレビュー: {comp.review}</div>}
                                            {comp?.feedback && <div style={{ fontSize: 12, color: "#17397d", marginTop: 6, fontWeight: 700 }}>💬 FB: {comp.feedback}</div>}
                                        </div>
                                    );
                                }
                                return (
                                    <div>
                                        <div style={{ fontSize: 12.5, fontWeight: 900, color: "#8a6a3a", marginBottom: 8 }}>📝 学んだこと・感想を書いて提出（+2pt）</div>
                                        <textarea value={review} onChange={(e) => setReview(e.target.value)} placeholder="このコンテンツから学んだこと、意識したいことなど" />
                                        <button className="lr-btn" style={{ marginTop: 0, opacity: submitting || !review.trim() ? .55 : 1 }} onClick={handleSubmitReview} disabled={submitting || !review.trim()}>
                                            {submitting ? "提出中..." : "📜 レビューを提出する"}
                                        </button>
                                        {getCompletion(selected.id)?.status === "pending" && (
                                            <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(232,154,29,.1)", border: "2px solid rgba(232,154,29,.45)", color: "#a06a00", fontSize: 12.5, fontWeight: 800, textAlign: "center" }}>⏳ 提出完了（承認待ち）</div>
                                        )}
                                        {getCompletion(selected.id)?.status === "approved" && (
                                            <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(46,157,95,.1)", border: "2px solid rgba(46,157,95,.4)", color: "#1e7a45", fontSize: 12.5, fontWeight: 800, textAlign: "center" }}>✅ 承認済み（+2pt獲得）</div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </div>

            {/* 下部ナビ（HOME/メニューと共通） */}
            <div className="lr-nav">
                <div className="band" />
                {[
                    { key: "home", label: "ホーム", href: "/home" },
                    { key: "ranking", label: "ランキング", href: "/ranking" },
                    { key: "house", label: "おうち", href: "/mypage" },
                    { key: "menu", label: "メニュー", href: "/menu" },
                ].map((t) => (
                    <button key={t.href} onClick={() => router.push(t.href)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {t.key === "home" && <img src="/home/nav_home_active.webp" alt="" style={{ height: 46, marginBottom: -2, filter: "drop-shadow(0 3px 5px rgba(30,40,90,.4))" }} />}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {t.key === "ranking" && <img src="/home/nav_trophy.webp" alt="" style={{ height: 30 }} />}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {t.key === "house" && <img src="/home/nav_house.webp" alt="" style={{ height: 30 }} />}
                        {t.key === "menu" && <div style={{ fontSize: 20, lineHeight: "30px" }}>☰</div>}
                        <div className="lbl">{t.label}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function LearnPage() {
    return (
        <Suspense fallback={null}>
            <LearnPageInner />
        </Suspense>
    );
}
