"use client";
// Intern Quest 2.0｜人生の冒険図鑑（ライフチャレンジ）
// HOME と同じ世界観（青空・ロイヤルブルー×金・羊皮紙）。
// ★既存機能は維持：challenges / challenge_submissions の取得、申請（コメント必須＋写真必須→pending）、
//   承認/却下フロー・報酬pt・再申請は却下時のみ・カテゴリはDB実データ。ポイント処理には一切触れない。
// ★冒険者ランクは達成件数の節目による「表示だけの称号」（ptに影響しない）。節目は RANKS 1か所で管理。
// ★島ベース・カテゴリアイコン・達成スタンプ等は ChatGPT 素材待ち（public/challenge/）。届くまで既存素材＋CSS仮組み。
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Challenge = {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    points: number;
    icon: string;
    is_active: boolean;
};

type Submission = {
    id: string;
    user_id: string;
    challenge_id: string;
    comment: string | null;
    image_url: string | null;
    status: string;
    created_at: string;
    approved_at?: string | null;
    feedback?: string | null;
};

// 冒険者ランク（達成件数の節目。表示のみ・ptに影響なし。調整はここだけでOK）
const RANKS = [
    { min: 0, name: "見習い冒険者" },
    { min: 10, name: "挑戦者" },
    { min: 30, name: "開拓者" },
    { min: 60, name: "熟練冒険者" },
    { min: 100, name: "冒険の達人" },
];

function fmtDate(iso?: string | null): string {
    if (!iso) return "";
    const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

const CSS = `
.ch-page{min-height:100vh;overflow-x:clip;background:url(/home/bg_mobile.webp) center top / cover no-repeat fixed, #bfe3f5;display:flex;flex-direction:column;align-items:center;padding:14px 14px 130px;font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#1f2a44}
.ch-col{width:100%;max-width:480px;display:flex;flex-direction:column}
@media (min-width:700px){ .ch-page{background-image:url(/home/bg_pc.webp)} .ch-col{max-width:880px} }

/* タイトル */
.ch-title{position:relative;width:min(88%,460px);margin:0 auto;container-type:inline-size;z-index:2}
.ch-title img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 14px rgba(20,40,90,.3))}
.ch-title>div{position:absolute;inset:25.9% 10% 11.8%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;pointer-events:none}
.ch-title .t1{font-size:clamp(15px,5.8cqw,25px);font-weight:900;letter-spacing:.08em;text-shadow:0 2px 4px rgba(10,25,70,.55)}
.ch-title .t2{font-size:clamp(8px,2.3cqw,11px);font-weight:800;letter-spacing:.3em;color:#cfe0ff;margin-top:1%}
.ch-sub{margin:8px auto 0;text-align:center;font-size:11.5px;font-weight:800;color:#2a3c66;background:rgba(255,253,245,.85);border:1.5px solid #e2bf63;border-radius:999px;padding:5px 16px;box-shadow:0 2px 6px rgba(40,60,120,.14)}

/* 見出しリボン */
.ch-h{align-self:center;display:flex;align-items:center;gap:8px;background:linear-gradient(180deg,#3b70d4,#1d3f96);border:2px solid #e2bf63;border-radius:999px;padding:6px 24px;font-weight:900;color:#fff;font-size:14px;margin:18px 0 10px;box-shadow:0 3px 8px rgba(20,40,100,.3),inset 0 2px 0 rgba(255,255,255,.25)}
.ch-h .dia{color:#ffe9a8;font-size:.8em}

/* ルク */
.ch-luku{display:flex;align-items:flex-end;container-type:inline-size;margin-top:10px;width:100%;max-width:560px;align-self:center}
.ch-luku .lk{width:24%;max-width:110px;flex:none}
.ch-luku .lk img{width:100%;display:block;filter:drop-shadow(0 6px 10px rgba(30,40,90,.3))}
.ch-luku .bw{flex:1;min-width:0;display:flex;flex-direction:column;margin-bottom:4%}
.ch-luku .pl{width:30%;min-width:88px;position:relative;margin-left:5%;z-index:2}
.ch-luku .pl img{display:block;width:100%;height:auto}
.ch-luku .pl span{position:absolute;inset:0 0 6% 0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:clamp(11px,3cqw,14px);letter-spacing:.2em;text-shadow:0 1px 3px rgba(10,25,70,.6)}
.ch-luku .bub{margin-top:-4%;background:url(/home/luku_bubble.webp);background-size:100% 100%;padding:7% 7% 10% 8.5%;font-weight:800;color:#4a3519;font-size:clamp(11.5px,3.2cqw,13.5px);line-height:1.7}

/* 冒険の記録（素材到着後: 背景を challenge/panel_record.webp に差し替え） */
.ch-rec{display:grid;grid-template-columns:1fr;gap:12px;margin-top:4px}
@media (min-width:700px){ .ch-rec{grid-template-columns:3fr 2fr;align-items:stretch} }
.ch-pn{background:linear-gradient(180deg,#fffdf4,#f8efdb);border:3px solid #d8b55e;border-radius:18px;padding:14px;box-shadow:0 0 0 3px rgba(255,255,255,.4),0 8px 20px rgba(40,60,120,.15),inset 0 2px 0 rgba(255,255,255,.8)}
.ch-pn .ph{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:900;color:#8a6a3a;letter-spacing:.1em;padding-bottom:8px;border-bottom:2px solid rgba(190,160,110,.35);margin-bottom:10px}
.ch-rec .big{display:flex;align-items:baseline;gap:6px}
.ch-rec .big .n{font-size:30px;font-weight:900;color:#17397d;line-height:1}
.ch-rec .big .t{font-size:13px;font-weight:800;color:#8a6a3a}
.ch-rec .barw{height:14px;border-radius:999px;background:rgba(120,90,30,.15);border:1.5px solid #cdb87e;overflow:hidden;margin-top:10px}
.ch-rec .bar{height:100%;border-radius:999px;background:linear-gradient(90deg,#ffd76e,#f0b429);box-shadow:0 0 8px rgba(255,210,80,.7);transition:width 1s ease}
.ch-rec .meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:9px;font-size:11px;font-weight:800;color:#8a6a3a}
.ch-rec .meta b{color:#17397d}
.ch-rank{background:linear-gradient(180deg,#3b70d4,#1d3f96);border:2.5px solid #e2bf63;border-radius:18px;padding:12px 14px;color:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.35),0 8px 18px rgba(20,40,100,.3),inset 0 2px 0 rgba(255,255,255,.25);display:flex;flex-direction:column}
.ch-rank .hd{font-size:10.5px;font-weight:900;letter-spacing:.22em;color:#ffe9a8}
.ch-rank .nm{font-size:21px;font-weight:900;margin-top:3px;text-shadow:0 2px 3px rgba(10,25,70,.5)}
.ch-rank .nx{font-size:11px;font-weight:800;color:#cfe0ff;margin-top:5px}
.ch-rank .barw{height:11px;border-radius:999px;background:rgba(10,25,70,.45);border:1.5px solid rgba(255,233,168,.6);overflow:hidden;margin-top:7px}
.ch-rank .bar{height:100%;border-radius:999px;background:linear-gradient(90deg,#ffd76e,#f0b429);box-shadow:0 0 8px rgba(255,210,80,.7);transition:width 1s ease}
.ch-shop{margin-top:auto;padding-top:9px}
.ch-shop button{width:100%;border:1.5px solid #e2bf63;background:rgba(255,253,245,.14);color:#ffe9a8;font-weight:900;font-size:11px;border-radius:999px;padding:6px 0;cursor:pointer;font-family:inherit}

/* おすすめ3件 */
.ch-rcm{display:grid;grid-template-columns:1fr;gap:10px}
@media (min-width:700px){ .ch-rcm{grid-template-columns:1fr 1fr 1fr} }
.ch-rc{position:relative;background:linear-gradient(180deg,#fffdf4,#f8efdb);border:2.5px solid #d8b55e;border-radius:16px;padding:30px 12px 12px;box-shadow:0 5px 14px rgba(40,60,120,.16),inset 0 2px 0 rgba(255,255,255,.8);display:flex;flex-direction:column}
.ch-rc .rb{position:absolute;top:-2px;left:10px;background:linear-gradient(180deg,#e05555,#b53030);color:#fff;font-size:9.5px;font-weight:900;padding:5px 9px 7px;border-radius:0 0 7px 7px;letter-spacing:.06em;box-shadow:0 3px 6px rgba(150,30,30,.35)}
.ch-rc .top{display:flex;gap:10px;align-items:flex-start}
.ch-rc .ic{flex:none;width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#eaf1ff,#d2e0f8);border:1.5px solid #cdb87e;display:flex;align-items:center;justify-content:center;font-size:28px}
.ch-rc .tt{font-size:13.5px;font-weight:900;color:#1f2a44;line-height:1.45}
.ch-rc .cat{display:inline-block;font-size:9.5px;font-weight:900;color:#17397d;background:rgba(75,122,224,.1);border:1px solid rgba(75,122,224,.35);border-radius:999px;padding:2px 8px;margin-top:4px}
.ch-rc .ds{font-size:11px;font-weight:700;color:#6a7690;line-height:1.55;margin-top:7px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ch-rc .pt{font-size:13px;font-weight:900;color:#a06a00;margin-top:8px}
.ch-btn{display:block;width:100%;margin-top:9px;padding:10px 0;border-radius:999px;border:2px solid #e2bf63;background:linear-gradient(180deg,#4b7ae0,#1d3f96);color:#fff;font-size:13px;font-weight:900;letter-spacing:.06em;cursor:pointer;font-family:inherit;box-shadow:0 4px 0 #12306e,0 7px 14px rgba(20,40,100,.3),inset 0 2px 0 rgba(255,255,255,.3);transition:transform .08s,box-shadow .08s}
.ch-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #12306e,0 3px 6px rgba(20,40,100,.3),inset 0 2px 0 rgba(255,255,255,.3)}

/* カテゴリ島（素材到着後: .iw 背景を challenge/island_base.webp＋カテゴリアイコンに差し替え） */
.ch-map{display:flex;gap:10px;overflow-x:auto;padding:14px 4px 10px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.ch-map::-webkit-scrollbar{display:none}
.ch-isl{flex:none;width:98px;background:transparent;border:none;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;-webkit-tap-highlight-color:transparent}
.ch-isl .iw{width:76px;height:76px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:36px;background:radial-gradient(circle at 50% 38%,#eaf6ff 0%,#cfe6fa 55%,#9fc48a 56%,#7ba15f 78%,#8a6a42 79%,#6e5230 100%);border:2.5px solid #cdb87e;box-shadow:0 6px 10px rgba(30,40,90,.25),inset 0 3px 6px rgba(255,255,255,.5);transition:box-shadow .2s}
.ch-isl.on .iw{box-shadow:0 0 0 3px #e2bf63,0 0 18px rgba(255,210,80,.85),0 6px 10px rgba(30,40,90,.25)}
@keyframes chfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.ch-isl .iw{animation:chfloat 4.6s ease-in-out infinite}
.ch-isl:nth-child(2n) .iw{animation-delay:-1.6s}
.ch-isl:nth-child(3n) .iw{animation-delay:-3s}
@media (prefers-reduced-motion: reduce){ .ch-isl .iw{animation:none} }
.ch-isl .np{margin-top:5px;width:100%;background:linear-gradient(180deg,#fffdf4,#f3e6c8);border:1.5px solid #cdb87e;border-radius:10px;padding:4px 3px;box-shadow:0 2px 5px rgba(140,100,30,.2)}
.ch-isl .nm{font-size:10px;font-weight:900;color:#5a4a20;line-height:1.25}
.ch-isl.on .nm{color:#17397d}
.ch-isl .ct{font-size:9px;font-weight:800;color:#a08356;margin-top:1px}

/* 絞り込み */
.ch-filter{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:4px}
.ch-chip{border:1.5px solid #cdb87e;background:rgba(255,253,245,.9);color:#8a6a3a;font-weight:900;font-size:11px;border-radius:999px;padding:6px 12px;cursor:pointer;font-family:inherit}
.ch-chip.on{background:linear-gradient(180deg,#4b7ae0,#1d3f96);color:#fff;border-color:#e2bf63;box-shadow:0 0 8px rgba(99,102,241,.45)}
.ch-search{flex:1;min-width:140px;display:flex;align-items:center;gap:6px;background:#fffef8;border:1.5px solid #cdb87e;border-radius:999px;padding:6px 12px}
.ch-search input{flex:1;min-width:0;border:none;background:transparent;outline:none;font-size:12px;font-weight:700;color:#1f2a44;font-family:inherit}
.ch-search input::placeholder{color:#b5a687}

/* 図鑑カード */
.ch-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
@media (min-width:700px){ .ch-grid{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))} }
.ch-card{position:relative;text-align:left;font-family:inherit;background:linear-gradient(180deg,#fffdf4,#f8efdb);border:2px solid #d8b55e;border-radius:16px;padding:12px;box-shadow:0 4px 10px rgba(40,60,120,.14),inset 0 2px 0 rgba(255,255,255,.8);display:flex;flex-direction:column;cursor:pointer;transition:transform .15s,box-shadow .15s}
.ch-card:hover{transform:translateY(-3px);box-shadow:0 8px 18px rgba(40,60,120,.22)}
.ch-card.done{background:linear-gradient(180deg,#fffef6,#fdf3d5);border-color:#e2bf63;box-shadow:0 0 0 2px rgba(255,220,120,.35),0 4px 12px rgba(180,140,40,.22)}
.ch-card.done,.ch-card.pend{cursor:default}
.ch-card.done:hover,.ch-card.pend:hover{transform:none;box-shadow:0 4px 10px rgba(40,60,120,.14)}
.ch-card .ic{font-size:30px;line-height:1.1}
.ch-card.pend .ic,.ch-card.rej .ic{opacity:.75}
.ch-card .tt{font-size:12.5px;font-weight:900;color:#1f2a44;line-height:1.4;margin-top:6px}
.ch-card.done .tt{color:#8a6a1a}
.ch-card .ds{font-size:10.5px;font-weight:700;color:#8a93a6;line-height:1.5;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ch-card .ft{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:auto;padding-top:8px}
.ch-card .cat{font-size:9px;font-weight:900;color:#17397d;background:rgba(75,122,224,.1);border:1px solid rgba(75,122,224,.3);border-radius:999px;padding:2px 7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ch-card .pt{font-size:12px;font-weight:900;color:#a06a00;flex:none}
.ch-card .act{margin-top:8px;padding:8px 0;border-radius:999px;border:1.5px solid #e2bf63;background:linear-gradient(180deg,#4b7ae0,#1d3f96);color:#fff;font-size:11.5px;font-weight:900;text-align:center}
.ch-card .act.re{background:linear-gradient(180deg,#e08a3a,#b5611d)}
/* 達成スタンプ（素材到着後: challenge/stamp_done.webp に差し替え） */
.ch-stamp{position:absolute;top:7px;right:7px;width:54px;height:54px;border-radius:50%;border:2.5px solid #c9a227;outline:2px solid #c9a227;outline-offset:-8px;color:#b8860b;display:flex;align-items:center;justify-content:center;transform:rotate(12deg);font-weight:900;font-size:13px;letter-spacing:.1em;background:rgba(255,250,232,.82);box-shadow:0 2px 6px rgba(160,110,20,.3)}
.ch-badge{position:absolute;top:9px;right:9px;font-size:9.5px;font-weight:900;border-radius:999px;padding:3px 8px}
.ch-badge.pend{color:#a06a00;background:rgba(255,245,220,.95);border:1.5px solid #e2a93a}
.ch-badge.rej{color:#a03030;background:rgba(255,240,238,.95);border:1.5px solid #e08a80}
.ch-card .dt{font-size:9.5px;font-weight:800;color:#b8923a;margin-top:3px}
.ch-card .rejr{font-size:10px;font-weight:800;color:#a03030;background:rgba(224,120,100,.1);border:1px solid rgba(224,120,100,.4);border-radius:8px;padding:5px 7px;margin-top:6px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}

.ch-empty{text-align:center;color:#8a6a3a;font-weight:800;font-size:13px;padding:26px 10px}
.ch-msg{margin-top:12px;padding:11px 14px;border-radius:12px;background:linear-gradient(180deg,#eefaf0,#d9f2e0);border:2px solid #7cc89a;color:#1e7a45;font-size:12.5px;font-weight:800}

/* 申請モーダル（ロジックは既存のまま・見た目のみ） */
.ch-mw{position:fixed;inset:0;background:rgba(20,30,60,.6);z-index:100;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto}
.ch-md{background:linear-gradient(180deg,#fffdf4,#f8efdb);border:3px solid #d8b55e;border-radius:20px;padding:20px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;margin:auto;box-shadow:0 0 0 3px rgba(255,255,255,.4),0 18px 50px rgba(20,30,60,.4);color:#1f2a44}
.ch-md textarea{width:100%;height:96px;padding:12px 14px;border-radius:12px;border:2px solid #cdb87e;background:#fffef8;color:#1f2a44;font-size:14px;outline:none;resize:none;box-sizing:border-box;font-family:inherit}
.ch-md textarea::placeholder{color:#b5a687}
.ch-md .lb{font-size:12px;font-weight:900;color:#8a6a3a;margin:0 0 6px}
.ch-md .drop{border:2px dashed #cdb87e;border-radius:12px;padding:20px;text-align:center;cursor:pointer;background:#fffef8}
.ch-md .cancel{flex:1;padding:12px 0;border-radius:999px;border:2px solid #cdb87e;background:rgba(255,253,245,.9);color:#8a6a3a;font-weight:900;cursor:pointer;font-size:13px;font-family:inherit}

/* 下部ナビ（共通） */
.ch-nav{position:fixed;left:0;bottom:0;width:100%;max-width:100vw;box-sizing:border-box;z-index:50;display:flex;height:calc(86px + env(safe-area-inset-bottom));padding:0 10px calc(10px + env(safe-area-inset-bottom));overflow:hidden}
.ch-nav .band{position:absolute;inset:6px 8px calc(8px + env(safe-area-inset-bottom));background:url(/home/nav_bar.webp);background-size:100% 100%;pointer-events:none}
.ch-nav button{position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;padding-bottom:calc(17px + env(safe-area-inset-bottom));background:transparent;border:none;cursor:pointer;color:#fff;text-shadow:0 1px 2px rgba(70,40,10,.7);-webkit-tap-highlight-color:transparent}
.ch-nav .lbl{font-size:10.5px;font-weight:800}
`;

export default function ChallengePage() {
    const router = useRouter();
    const [userId, setUserId] = useState("");
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
    const [comment, setComment] = useState("");
    const [image, setImage] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [statusFilter, setStatusFilter] = useState<"all" | "todo" | "done" | "pending">("all");
    const [query, setQuery] = useState("");
    const [sortPt, setSortPt] = useState(false);
    const [barOn, setBarOn] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setUserId(user.id);

            const { data: challengeRows } = await supabase.from("challenges").select("*").eq("is_active", true).order("created_at");
            setChallenges((challengeRows || []) as Challenge[]);

            const { data: submissionRows } = await supabase.from("challenge_submissions").select("*").eq("user_id", user.id);
            setSubmissions((submissionRows || []) as Submission[]);

            setLoading(false);
            setTimeout(() => setBarOn(true), 80);
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ===== 既存ロジック（申請状態の判定・申請処理）はそのまま =====
    const getSubmission = (challengeId: string) => {
        const subs = submissions.filter(s => s.challenge_id === challengeId);
        return subs.find(s => s.status === "approved") || subs.find(s => s.status === "pending") || subs[0];
    };

    const handleFileSelect = (file: File) => {
        if (!file.type.startsWith("image/")) return;
        setImage(file);
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        if (!selectedChallenge) return;
        if (!comment.trim()) { setMessage("コメントを入力してください"); return; }
        if (!image) { setMessage("写真を選択してください"); return; }
        setSending(true);
        setMessage("");

        let imageUrl: string | null = null;
        if (image) {
            const ext = image.name.split(".").pop();
            const filePath = `challenges/${userId}/${selectedChallenge.id}.${ext}`;
            const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, image, { upsert: true });
            if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
                imageUrl = publicUrl;
            }
        }

        await supabase.from("challenge_submissions").insert({
            user_id: userId,
            challenge_id: selectedChallenge.id,
            comment: comment.trim(),
            image_url: imageUrl,
            status: "pending",
        });

        const { data: submissionRows } = await supabase.from("challenge_submissions").select("*").eq("user_id", userId);
        setSubmissions((submissionRows || []) as Submission[]);

        setMessage("✨ 申請を送信しました！承認をお待ちください。");
        setComment("");
        setImage(null);
        setPreview(null);
        setSelectedChallenge(null);
        setSending(false);
    };

    if (loading) {
        return (
            <div className="ch-page" style={{ justifyContent: "center" }}>
                <style>{CSS}</style>
                <div style={{ fontWeight: 800, color: "#5a6b85" }}>読み込み中...</div>
            </div>
        );
    }

    // ===== 集計（すべて既存データから算出） =====
    const completedCount = submissions.filter(s => s.status === "approved").length;
    const pendingCount = submissions.filter(s => s.status === "pending").length;
    const rejectedCount = submissions.filter(s => s.status === "rejected").length;
    const total = challenges.length;
    const rate = total > 0 ? Math.round((completedCount / total) * 1000) / 10 : 0;
    // チャレンジで獲得したpt（承認済みチャレンジの報酬合計・表示のみ）
    const earnedPt = challenges.reduce((sum, c) => sum + (getSubmission(c.id)?.status === "approved" ? (c.points || 0) : 0), 0);

    // 冒険者ランク（表示のみ）
    const curRank = [...RANKS].reverse().find(r => completedCount >= r.min) || RANKS[0];
    const nextRank = RANKS.find(r => r.min > completedCount);
    const nextName = nextRank ? nextRank.name : "図鑑マスター";
    const nextMin = nextRank ? nextRank.min : total;
    const gap = Math.max(0, nextMin - completedCount);
    const rankPct = nextMin > curRank.min ? Math.round(((completedCount - curRank.min) / (nextMin - curRank.min)) * 100) : 100;
    const lukuLine = completedCount >= total && total > 0
        ? "全部の冒険を制覇！きみはもう伝説の冒険者だ！"
        : gap <= 5
            ? `あと${gap}件で「${nextName}」だね！新しい経験を集めよう！`
            : "まだ知らない世界がいっぱい！今日はどんな冒険に挑戦する？";

    // ===== 今日のおすすめ3件（未達成・未申請から日付固定で選出） =====
    const candidates = challenges.filter(c => {
        const s = getSubmission(c.id);
        return !s || s.status === "rejected";
    });
    const sortedByPt = [...candidates].sort((a, b) => (a.points || 0) - (b.points || 0) || a.id.localeCompare(b.id));
    const third = Math.ceil(sortedByPt.length / 3);
    const groups = [sortedByPt.slice(0, third), sortedByPt.slice(third, third * 2), sortedByPt.slice(third * 2)];
    const dayKey = Math.floor((Date.now() + 9 * 60 * 60 * 1000) / 86400000);
    const RCM_LABEL = ["🍀 気軽にチャレンジ", "🌈 あたらしい経験", "⚔️ 腕試しクエスト"];
    const recommends = groups.map((g, i) => (g.length > 0 ? { c: g[dayKey % g.length], label: RCM_LABEL[i] } : null)).filter(Boolean) as { c: Challenge; label: string }[];

    // ===== カテゴリ（DB実データ・出現順） =====
    const cats: string[] = [];
    challenges.forEach(c => { const n = c.category || "その他"; if (!cats.includes(n)) cats.push(n); });
    const catStat = (name: string) => {
        const list = challenges.filter(c => (c.category || "その他") === name);
        const done = list.filter(c => getSubmission(c.id)?.status === "approved").length;
        const icon = list[0]?.icon || "🎯";
        return { total: list.length, done, icon };
    };

    // ===== 絞り込み・検索・並び替え =====
    let shown = selectedCategory === "all" ? challenges : challenges.filter(c => (c.category || "その他") === selectedCategory);
    if (statusFilter !== "all") {
        shown = shown.filter(c => {
            const s = getSubmission(c.id);
            if (statusFilter === "done") return s?.status === "approved";
            if (statusFilter === "pending") return s?.status === "pending";
            return !s || s.status === "rejected"; // todo（却下は再申請できるので未達成扱い）
        });
    }
    if (query.trim()) {
        const q = query.trim().toLowerCase();
        shown = shown.filter(c => c.title.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q) || (c.category || "").toLowerCase().includes(q));
    }
    if (sortPt) shown = [...shown].sort((a, b) => (b.points || 0) - (a.points || 0));

    const openChallenge = (c: Challenge) => {
        const s = getSubmission(c.id);
        if (s?.status === "approved" || s?.status === "pending") return; // 重複申請防止（既存仕様）
        setSelectedChallenge(c);
    };

    return (
        <div className="ch-page">
            <style>{CSS}</style>
            <div className="ch-col">
                {/* A. タイトル */}
                <div className="ch-title">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/home/title_plate.webp" alt="" width={1200} height={374} />
                    <div><span className="t1">📖 人生の冒険図鑑</span><span className="t2">LIFE ADVENTURE</span></div>
                </div>
                <div className="ch-sub">まだ知らない世界へ。経験を集めて、冒険者として成長しよう！</div>

                {/* G. ルク（進捗でセリフ切替） */}
                <div className="ch-luku">
                    <div className="lk">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/onboarding/luku.png" alt="ルク" />
                    </div>
                    <div className="bw">
                        <div className="pl">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/home/luku_plate.webp" alt="" /><span>ルク</span>
                        </div>
                        <div className="bub">{lukuLine}</div>
                    </div>
                </div>

                {/* B. 冒険の達成状況 */}
                <div className="ch-rec">
                    <div className="ch-pn">
                        <div className="ph">🏅 冒険の記録</div>
                        <div className="big"><span className="n">{completedCount}</span><span className="t">/ {total} 達成</span><span className="t" style={{ marginLeft: "auto", color: "#a06a00" }}>達成率 {rate}%</span></div>
                        <div className="barw"><div className="bar" style={{ width: barOn ? `${rate}%` : 0 }} /></div>
                        <div className="meta">
                            <span>⏳ 申請中 <b>{pendingCount}</b>件</span>
                            <span>🔄 差し戻し <b>{rejectedCount}</b>件</span>
                            <span>💰 チャレンジで獲得 <b>{earnedPt.toLocaleString()}pt</b></span>
                        </div>
                    </div>
                    <div className="ch-rank">
                        <div className="hd">◆ 冒険者ランク ◆</div>
                        <div className="nm">🛡️ {completedCount >= total && total > 0 ? "図鑑マスター" : curRank.name}</div>
                        {completedCount < total && <>
                            <div className="nx">次のランク：{nextName}（達成 {nextMin} 件）あと{gap}件</div>
                            <div className="barw"><div className="bar" style={{ width: barOn ? `${rankPct}%` : 0 }} /></div>
                        </>}
                        <div className="ch-shop"><button onClick={() => router.push("/shop")}>💰 貯めたptでお城や島をカスタマイズ →</button></div>
                    </div>
                </div>

                {/* C. 今日のおすすめ冒険 */}
                {recommends.length > 0 && (
                    <>
                        <div className="ch-h"><span className="dia">◆</span>✨ 今日のおすすめ冒険<span className="dia">◆</span></div>
                        <div className="ch-rcm">
                            {recommends.map(({ c, label }) => (
                                <div key={c.id} className="ch-rc">
                                    <div className="rb">{label}</div>
                                    <div className="top">
                                        <div className="ic">{c.icon}</div>
                                        <div style={{ minWidth: 0 }}>
                                            <div className="tt">{c.title}</div>
                                            {c.category && <span className="cat">{c.category}</span>}
                                        </div>
                                    </div>
                                    {c.description && <div className="ds">{c.description}</div>}
                                    <div className="pt">🪙 +{c.points}pt</div>
                                    <button className="ch-btn" onClick={() => openChallenge(c)}>挑戦する ▶</button>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* D. カテゴリ別の冒険エリア（DB実データ） */}
                <div className="ch-h"><span className="dia">◆</span>カテゴリから探す<span className="dia">◆</span></div>
                <div className="ch-map">
                    <button className={`ch-isl${selectedCategory === "all" ? " on" : ""}`} onClick={() => setSelectedCategory("all")}>
                        <div className="iw">🗺️</div>
                        <div className="np"><div className="nm">すべて</div><div className="ct">{completedCount}/{total}・{rate}%</div></div>
                    </button>
                    {cats.map(name => {
                        const st = catStat(name);
                        const on = selectedCategory === name;
                        const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
                        return (
                            <button key={name} className={`ch-isl${on ? " on" : ""}`} onClick={() => setSelectedCategory(on ? "all" : name)}>
                                <div className="iw">{st.icon}</div>
                                <div className="np"><div className="nm">{name}</div><div className="ct">{st.done}/{st.total}・{pct}%</div></div>
                            </button>
                        );
                    })}
                </div>

                {/* F. 絞り込み・検索 */}
                <div className="ch-filter">
                    {([["all", "すべて"], ["todo", "未達成"], ["done", "達成済み"], ["pending", "申請中"]] as const).map(([k, l]) => (
                        <button key={k} className={`ch-chip${statusFilter === k ? " on" : ""}`} onClick={() => setStatusFilter(k)}>{l}</button>
                    ))}
                    <button className={`ch-chip${sortPt ? " on" : ""}`} onClick={() => setSortPt(v => !v)}>🪙 ポイント順</button>
                    <div className="ch-search">🔍<input value={query} onChange={e => setQuery(e.target.value)} placeholder="冒険をさがす…" /></div>
                </div>

                {message && <div className="ch-msg">{message}</div>}

                {/* E. 冒険スタンプ図鑑 */}
                <div className="ch-h"><span className="dia">◆</span>冒険スタンプ図鑑<span className="dia">◆</span></div>
                {shown.length === 0 ? (
                    <div className="ch-pn ch-empty">条件に合う冒険が見つかりませんでした🔍</div>
                ) : (
                    <div className="ch-grid">
                        {shown.map(challenge => {
                            const sub = getSubmission(challenge.id);
                            const isApproved = sub?.status === "approved";
                            const isPending = sub?.status === "pending";
                            const isRejected = !isApproved && !isPending && sub?.status === "rejected";
                            return (
                                <button key={challenge.id}
                                    className={`ch-card${isApproved ? " done" : isPending ? " pend" : isRejected ? " rej" : ""}`}
                                    onClick={() => openChallenge(challenge)}>
                                    <div className="ic">{challenge.icon}</div>
                                    {isApproved && <div className="ch-stamp">達成</div>}
                                    {isPending && <div className="ch-badge pend">⏳ 審査待ち</div>}
                                    {isRejected && <div className="ch-badge rej">🔄 差し戻し</div>}
                                    <div className="tt">{challenge.title}</div>
                                    {isApproved && <div className="dt">🗓 達成日 {fmtDate(sub?.approved_at || sub?.created_at)}</div>}
                                    {challenge.description && !isApproved && <div className="ds">{challenge.description}</div>}
                                    {isRejected && sub?.feedback && <div className="rejr">💬 {sub.feedback}</div>}
                                    <div className="ft">
                                        <span className="cat">{challenge.category || "その他"}</span>
                                        <span className="pt">🪙 {isApproved ? `+${challenge.points}pt 獲得` : `+${challenge.points}pt`}</span>
                                    </div>
                                    {!isApproved && !isPending && (
                                        <div className={`act${isRejected ? " re" : ""}`}>{isRejected ? "🔄 再申請する" : "挑戦する ▶"}</div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* 申請モーダル（既存ロジック維持） */}
                {selectedChallenge && (
                    <div className="ch-mw" onClick={() => { setSelectedChallenge(null); setComment(""); setImage(null); setPreview(null); setMessage(""); }}>
                        <div className="ch-md" onClick={(e) => e.stopPropagation()}>
                            <div style={{ fontSize: 38, textAlign: "center" }}>{selectedChallenge.icon}</div>
                            <h2 style={{ fontSize: 17, fontWeight: 900, color: "#17397d", margin: "6px 0 4px", textAlign: "center" }}>{selectedChallenge.title}</h2>
                            <p style={{ fontSize: 12, color: "#8a6a3a", textAlign: "center", margin: "0 0 16px", fontWeight: 800 }}>達成報告をして 🪙+{selectedChallenge.points}pt をゲットしよう！</p>

                            <div style={{ marginBottom: 14 }}>
                                <div className="lb">📝 コメント（必須）</div>
                                <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="どんな経験でしたか？感想を書いてください" />
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <div className="lb">📸 写真（必須）</div>
                                {preview ? (
                                    <div style={{ position: "relative" }}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={preview} alt="preview" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12, border: "2px solid #cdb87e" }} />
                                        <button onClick={() => { setImage(null); setPreview(null); }} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(40,30,10,.7)", border: "none", color: "#fff", cursor: "pointer", fontSize: 16 }}>×</button>
                                    </div>
                                ) : (
                                    <div className="drop" onClick={() => fileInputRef.current?.click()}>
                                        <div style={{ fontSize: 24, marginBottom: 6 }}>📸</div>
                                        <div style={{ fontSize: 12.5, color: "#8a6a3a", fontWeight: 800 }}>タップして写真を選択<span style={{ color: "#c04545", marginLeft: 4 }}>*</span></div>
                                    </div>
                                )}
                                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
                            </div>

                            {message && <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: message.includes("✨") ? "rgba(46,157,95,.1)" : "rgba(224,120,100,.12)", border: `2px solid ${message.includes("✨") ? "rgba(46,157,95,.4)" : "rgba(224,120,100,.5)"}`, color: message.includes("✨") ? "#1e7a45" : "#a03030", fontSize: 12.5, fontWeight: 800 }}>{message}</div>}

                            <div style={{ display: "flex", gap: 10 }}>
                                <button className="cancel" onClick={() => { setSelectedChallenge(null); setComment(""); setImage(null); setPreview(null); setMessage(""); }}>キャンセル</button>
                                <button className="ch-btn" style={{ flex: 2, width: "auto", marginTop: 0, opacity: sending ? .6 : 1 }} onClick={handleSubmit} disabled={sending}>
                                    {sending ? "送信中..." : "🏅 達成報告する"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 下部ナビ（HOME/メニューと共通） */}
            <div className="ch-nav">
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
