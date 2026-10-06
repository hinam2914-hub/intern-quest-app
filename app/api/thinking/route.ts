import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SYSTEM = `あなたはインターン生の思考を深める「作戦会議」の相手です。答えを教えず、本人に考えさせる質問を1つだけ返します。
ルール：
- 日報の中で思考が浅い部分（原因が書かれていない・抽象的・根拠がない）を1つ選び、具体的に考えさせる
- 質問は1問だけ。短く（60字以内）。友達のような口調だが軽すぎない
- 1問目：原因や要因を3つ挙げさせる系。2問目：その中で一番影響が大きいものと理由。3問目：明日何を変えて試すか
- 本人の答えが曖昧なら、同じ段階でもう一段具体化を促してよいが、合計3問で終える
- 出力はJSONのみ：{"question":"...","stage":1|2|3}`;

const REPORT = `以下は日報と、AIとの3往復の作戦会議です。簡潔にまとめてください。
出力はJSONのみ：
{"good":"良かった考え方（40字以内）","insight":"今回気づいたこと（50字以内）","next":"次に試すこと（50字以内・具体的な行動1つ）","skills":["hypothesis"|"cause"|"verbal"|"improve"|"self" を1〜3個]}
skillsの意味：hypothesis=仮説思考, cause=原因分析, verbal=言語化, improve=改善思考, self=自走力`;

async function callOpenAI(messages: { role: string; content: string }[]) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", temperature: 0.4, response_format: { type: "json_object" }, messages }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const j = await res.json();
    return JSON.parse(j.choices[0].message.content);
}

export async function POST(req: Request) {
    try {
        const auth = req.headers.get("authorization") || "";
        const token = auth.replace(/^Bearer\s+/i, "");
        if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        const { data: { user }, error } = await sb.auth.getUser(token);
        if (error || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

        const body = await req.json();
        const { mode, report, turns } = body as { mode: "question" | "report"; report: string; turns: { role: "ai" | "user"; text: string }[] };
        const transcript = (turns || []).map(t => `${t.role === "ai" ? "AI" : "本人"}：${t.text}`).join("\n");

        if (mode === "question") {
            const stage = (turns || []).filter(t => t.role === "ai").length + 1;
            const out = await callOpenAI([
                { role: "system", content: SYSTEM },
                { role: "user", content: `【日報】\n${report}\n\n【これまでの会話】\n${transcript || "（なし）"}\n\n次は${stage}問目です。` },
            ]);
            return NextResponse.json({ question: out.question, stage: out.stage || stage });
        }
        if (mode === "report") {
            const out = await callOpenAI([
                { role: "system", content: REPORT },
                { role: "user", content: `【日報】\n${report}\n\n【作戦会議】\n${transcript}` },
            ]);
            const allowed = ["hypothesis", "cause", "verbal", "improve", "self"];
            out.skills = (Array.isArray(out.skills) ? out.skills : []).filter((s: string) => allowed.includes(s)).slice(0, 3);
            if (out.skills.length === 0) out.skills = ["cause"];
            return NextResponse.json(out);
        }
        return NextResponse.json({ error: "bad mode" }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "error" }, { status: 500 });
    }
}
