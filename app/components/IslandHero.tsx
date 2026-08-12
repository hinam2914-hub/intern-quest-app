"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getHouseStage } from "./DotHouse";

const STEP_TITLE: Record<number, string> = { 0: "冒険の始まり", 1: "入社・研修", 2: "登竜門", 3: "プレイヤー昇格", 4: "DRMスタート", 5: "キャリア面談", 6: "営業デビュー" };
const HOUSE_IMG: Record<number, string> = { 0: "/island/house/0_tent.png", 1: "/island/house/1_cabin.png", 2: "/island/house/2_house.png", 3: "/island/house/3_big.png", 4: "/island/house/4_mansion.png", 5: "/island/house/5_castle.png" };
const HOUSE_W: Record<number, number> = { 0: 100, 1: 116, 2: 130, 3: 142, 4: 158, 5: 152 };
const TIRED_WORDS = ["疲れ", "つかれ", "しんど", "だるい", "ねむい", "眠い"];

function jstYesterday(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000);
    return jst.toISOString().slice(0, 10);
}
function yesterdayRangeUTC(): { start: string; end: string } {
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = jstNow.getUTCFullYear(), m = jstNow.getUTCMonth(), d = jstNow.getUTCDate();
    const todayJst0_utc = Date.UTC(y, m, d) - 9 * 60 * 60 * 1000;
    const start = new Date(todayJst0_utc - 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(todayJst0_utc).toISOString();
    return { start, end };
}
function countEmoji(s: string): number {
    const m = s.match(/\p{Extended_Pictographic}/gu);
    return m ? m.length : 0;
}
function seededPick<T>(arr: T[], seedStr: string): T | null {
    if (!arr.length) return null;
    let h = 0;
    for (let i = 0; i < seedStr.length; i++) { h = (h * 31 + seedStr.charCodeAt(i)) >>> 0; }
    return arr[h % arr.length];
}

export default function IslandHero({ userId, name, avatarId, streak, totalEarned }: { userId: string; name: string; avatarId: string; streak: number; totalEarned: number }) {
    const [stepNo, setStepNo] = useState(0);
    const [titles, setTitles] = useState<string[]>([]);

    useEffect(() => {
        (async () => {
            const { data: jsubs } = await supabase.from("journey_submissions").select("step_no").eq("user_id", userId).eq("status", "approved");
            let mx = 0;
            (jsubs || []).forEach((s: any) => { mx = Math.max(mx, s.step_no); });
            setStepNo(mx);

            const ymd = jstYesterday();
            const range = yesterdayRangeUTC();
            const [{ data: thanksRows }, { data: subs }] = await Promise.all([
                supabase.from("thanks").select("to_user_id, created_at").gte("created_at", range.start).lt("created_at", range.end),
                supabase.from("submissions").select("user_id, created_at, content").gte("created_at", range.start).lt("created_at", range.end).order("created_at", { ascending: true }),
            ]);
            const daySubs = subs || [];
            const dayThanks = thanksRows || [];
            const t: string[] = [];

            const zoro = daySubs.filter((s: any) => {
                const jst = new Date(new Date(s.created_at).getTime() + 9 * 60 * 60 * 1000);
                return jst.getUTCMinutes() % 11 === 0;
            });
            const zoroPick = seededPick(zoro, ymd + "zoro");
            if (zoroPick && (zoroPick as any).user_id === userId) t.push("🕛 ゾロ目王");

            const thanksCount: Record<string, number> = {};
            dayThanks.forEach((r: any) => { if (r.to_user_id) thanksCount[r.to_user_id] = (thanksCount[r.to_user_id] || 0) + 1; });
            const byThanks = Object.entries(thanksCount).sort((a, b) => b[1] - a[1]);
            if (byThanks.length && byThanks[0][0] === userId) t.push("🙏 サンキュー王");

            if (daySubs.length) {
                if ((daySubs[0] as any).user_id === userId) t.push("⚡ 一番乗り王");
                if ((daySubs[daySubs.length - 1] as any).user_id === userId) t.push("🔚 ラストマン王");
                const byLen = [...daySubs].sort((a: any, b: any) => (b.content?.length || 0) - (a.content?.length || 0));
                if ((byLen[0] as any).user_id === userId) t.push("💬 長文王");
                if ((byLen[byLen.length - 1] as any).user_id === userId) t.push("🏃 瞬速王");
                const byEmoji = daySubs.map((s: any) => ({ uid: s.user_id, n: countEmoji(s.content || "") })).sort((a, b) => b.n - a.n);
                if (byEmoji[0].n > 0 && byEmoji[0].uid === userId) t.push("🎨 絵文字職人");
            }

            const tired = daySubs.filter((s: any) => TIRED_WORDS.some(w => (s.content || "").includes(w)));
            const tiredPick = seededPick(tired, ymd + "tired");
            if (tiredPick && (tiredPick as any).user_id === userId) t.push("😴 おつかれ王");

            const activeIds = Array.from(new Set([
                ...dayThanks.map((r: any) => r.to_user_id),
                ...daySubs.map((r: any) => r.user_id),
            ]));
            if (activeIds.length) {
                if (seededPick(activeIds, ymd + "lucky") === userId) t.push("🎲 ラッキー王");
                if (seededPick(activeIds, ymd + "star") === userId) t.push("🃏 本日の主役");
            }

            setTitles(t.slice(0, 3));
        })();
    }, [userId]);

    const stage = getHouseStage(totalEarned);
    const level = Math.floor(totalEarned / 100) + 1;
    const bubble = titles.length ? "👑 昨日の" + titles.map(s => s.slice(s.indexOf(" ") + 1)).join("・") + "！" : "ようこそ、" + name + "の島へ！";

    return (
        <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", marginBottom: 20, background: "radial-gradient(circle at 50% 15%, #221b45 0%, #0d0b1c 75%)", border: "1px solid rgba(139,92,246,.25)" }}>
            {/* 星 */}
            {Array.from({ length: 26 }, (_, i) => (
                <div key={i} style={{ position: "absolute", left: ((i * 137) % 100) + "%", top: ((i * 53) % 55) + "%", width: 1 + (i % 3), height: 1 + (i % 3), borderRadius: "50%", background: "#fff", opacity: .55, animation: `ihTwinkle ${2 + (i % 4)}s ease-in-out ${(i % 30) / 10}s infinite` }} />
            ))}
            <style>{`
                @keyframes ihTwinkle { 0%,100%{opacity:.1} 50%{opacity:.85} }
                @keyframes ihBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
                @keyframes ihBubble { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
            `}</style>

            {/* 吹き出し */}
            <div style={{ position: "relative", textAlign: "center", paddingTop: 22, zIndex: 3, animation: "ihBubble 3s ease-in-out infinite" }}>
                <div style={{ display: "inline-block", position: "relative", maxWidth: "86%", padding: "10px 18px", borderRadius: 16, background: "rgba(255,255,255,.95)", color: "#3b2f66", fontSize: 13.5, fontWeight: 800, boxShadow: "0 6px 20px rgba(0,0,0,.35)" }}>
                    {bubble}
                    <div style={{ position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "9px solid transparent", borderRight: "9px solid transparent", borderTop: "9px solid rgba(255,255,255,.95)" }} />
                </div>
            </div>

            {/* 島シーン */}
            <div style={{ position: "relative", height: 235, display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "ihBob 5s ease-in-out infinite" }}>
                <div style={{ position: "absolute", bottom: 26, left: "50%", transform: "translateX(-50%)", width: 260, height: 62, borderRadius: "50%", background: "linear-gradient(180deg, #4ade80, #22a05a)", boxShadow: "inset 0 -10px 14px rgba(0,0,0,.25)" }} />
                <div style={{ position: "absolute", bottom: -14, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "88px solid transparent", borderRight: "88px solid transparent", borderTop: "72px solid #6b4a34" }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={HOUSE_IMG[stage.idx]} alt="house" style={{ width: HOUSE_W[stage.idx], position: "relative", zIndex: 1, marginBottom: 52, filter: "drop-shadow(0 8px 14px rgba(0,0,0,.45))" }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={"/avatars/" + avatarId + ".png"} alt={name} style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(26px)", width: 64, height: 64, objectFit: "cover", borderRadius: "50%", zIndex: 2, border: "2px solid rgba(255,255,255,.55)", boxShadow: "0 4px 10px rgba(0,0,0,.45)" }} />
            </div>

            {/* ステータス帯 */}
            <div style={{ position: "relative", padding: "14px 16px 16px", background: "rgba(13,11,28,.7)", borderTop: "1px solid rgba(139,92,246,.2)", backdropFilter: "blur(4px)" }}>
                <div style={{ textAlign: "center", fontSize: 12, fontWeight: 800, color: "#c4b5fd", marginBottom: 8 }}>
                    {stage.label}「{stage.name}」{stepNo >= 6 ? "　🏆 営業デビュー" : "　STEP" + stepNo + " " + (STEP_TITLE[stepNo] || "")}
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 10 }}>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                        <span key={n} style={{ width: 9, height: 9, borderRadius: "50%", background: n <= stepNo ? "#a78bfa" : "rgba(255,255,255,.14)", boxShadow: n === stepNo && stepNo > 0 ? "0 0 9px #a78bfa" : "none" }} />
                    ))}
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 900, color: "#fbbf24", background: "rgba(251,191,36,.12)", border: "1px solid rgba(251,191,36,.3)", padding: "3px 11px", borderRadius: 999 }}>Lv.{level}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: "#a5b4fc", background: "rgba(99,102,241,.12)", border: "1px solid rgba(99,102,241,.3)", padding: "3px 11px", borderRadius: 999 }}>{totalEarned.toLocaleString()}pt</span>
                    {streak > 0 && <span style={{ fontSize: 11.5, fontWeight: 800, color: "#fb923c", background: "rgba(251,146,60,.1)", border: "1px solid rgba(251,146,60,.3)", padding: "3px 11px", borderRadius: 999 }}>🔥 {streak}日連続</span>}
                </div>
            </div>
        </div>
    );
}
