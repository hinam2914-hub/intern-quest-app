"use client";
// HOME の案内カード：ES・ロードマップが未記入／途中の人にだけ出す。書き終えると自動で消える。読み取りだけ。
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { esStatus, roadmapStatus, type DocStatus } from "../lib/careerDocs";

export default function CareerDocNudge() {
    const router = useRouter();
    const [st, setSt] = useState<{ es: DocStatus; rm: DocStatus } | null>(null);
    useEffect(() => {
        let alive = true;
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const [e, r] = await Promise.all([
                supabase.from("user_es").select("*").eq("user_id", user.id).maybeSingle(),
                supabase.from("roadmaps").select("*").eq("user_id", user.id).maybeSingle(),
            ]);
            if (e.error || r.error) return;   // 読めないときは出さない（誤って「未記入」と出さない）
            if (alive) setSt({ es: esStatus(e.data), rm: roadmapStatus(r.data) });
        })();
        return () => { alive = false; };
    }, []);
    if (!st) return null;
    const items = [
        { key: "es", name: "ES", s: st.es, href: "/es", sub: st.es.state === "none" ? "まだ書かれていません" : `あと${st.es.total - st.es.filled}項目で完成` },
        { key: "rm", name: "ロードマップ", s: st.rm, href: "/roadmap", sub: st.rm.state === "none" ? "まだ書かれていません" : `完成度 ${st.rm.filled * 10}%` },
    ].filter((i) => i.s.state !== "done");
    if (items.length === 0) return null;
    return (
        <div className="cdn">
            <style>{CSS}</style>
            <div className="cdn-hd"><img src="/home/icon_report.webp" alt="" />書いておこう<span>あなたの成長の土台になります</span></div>
            {items.map((i) => (
                <button key={i.key} className="cdn-row" onClick={() => router.push(i.href)}>
                    <span className="cdn-mid"><b>{i.name}</b><span>{i.sub}</span><i><u style={{ width: `${Math.round((i.s.filled / i.s.total) * 100)}%` }} /></i></span>
                    <span className="cdn-go">{i.s.state === "none" ? "書きはじめる" : "つづきを書く"} →</span>
                </button>
            ))}
        </div>
    );
}

const CSS = `
.cdn{width:100%;box-sizing:border-box;margin-top:14px;background:linear-gradient(180deg,#fffdf4,#fbeecb);border:2.5px solid #e2bf63;border-radius:16px;padding:10px 12px 6px;box-shadow:0 6px 16px rgba(16,47,112,.16)}
.cdn-hd{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:900;color:#17397d;padding-bottom:6px;border-bottom:1.5px solid rgba(190,160,110,.4)}
.cdn-hd img{width:26px;height:26px;object-fit:contain}
.cdn-hd span{font-size:10.5px;font-weight:800;color:#8a6a3a;margin-left:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cdn-row{display:flex;align-items:center;gap:10px;width:100%;min-height:52px;padding:8px 2px;border:none;border-bottom:1px solid rgba(190,160,110,.28);background:transparent;cursor:pointer;font-family:inherit;text-align:left}
.cdn-row:last-child{border-bottom:none}
.cdn-mid{flex:1;min-width:0;display:block}
.cdn-mid b{font-size:13.5px;font-weight:900;color:#17397d;margin-right:8px}
.cdn-mid>span{font-size:11px;font-weight:800;color:#8a6a3a}
.cdn-mid i{display:block;height:6px;border-radius:999px;background:rgba(23,57,125,.13);overflow:hidden;margin-top:5px}
.cdn-mid u{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#ffd76e,#f0b429)}
.cdn-go{flex:none;font-size:11.5px;font-weight:900;color:#fff;background:linear-gradient(180deg,#4b7ae0,#1d3f96);border:1.5px solid #e2bf63;border-radius:999px;padding:7px 12px;white-space:nowrap}
`;
