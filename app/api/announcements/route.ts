// お知らせの管理API（一覧・作成・更新）。管理者だけが使える。
// ・呼び出した人のログイン情報（アクセストークン）をサーバー側で確認し、メールアドレスが管理者一覧（Vercelの環境変数）にある場合だけ処理する
// ・DBへの書き込みはサーバー専用キーで行う。一般ユーザーはRLSにより announcements を直接書き換えられない
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { NEWS_CATEGORIES, safeLink } from "../../lib/news";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mbrpygezvxwfsrfpnvgv.supabase.co";

async function adminClient(req: NextRequest) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return { error: NextResponse.json({ error: "サーバーの環境変数が設定されていません" }, { status: 500 }) };
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return { error: NextResponse.json({ error: "ログインが必要です" }, { status: 401 }) };
    const sb = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.auth.getUser(token);
    const email = (data?.user?.email || "").trim().toLowerCase();
    if (error || !data?.user || !email) return { error: NextResponse.json({ error: "ログインが必要です" }, { status: 401 }) };
    const admins = (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (!admins.includes(email)) return { error: NextResponse.json({ error: "管理者だけが操作できます" }, { status: 403 }) };
    return { sb, userId: data.user.id };
}

/** 入力の検証。作成時は全項目、更新時は送られてきた項目だけを確認する */
function clean(body: any, partial: boolean): { row?: Record<string, any>; error?: string } {
    const row: Record<string, any> = {};
    const has = (k: string) => body && Object.prototype.hasOwnProperty.call(body, k);
    if (!partial || has("title")) {
        const t = String(body?.title ?? "").trim();
        if (!t) return { error: "タイトルを入力してください" };
        if (t.length > 100) return { error: "タイトルは100文字以内にしてください" };
        row.title = t;
    }
    if (!partial || has("content")) {
        const c = String(body?.content ?? "").trim();
        if (!c) return { error: "本文を入力してください" };
        if (c.length > 4000) return { error: "本文は4000文字以内にしてください" };
        row.content = c;
    }
    if (!partial || has("category")) {
        const k = String(body?.category ?? "");
        if (!NEWS_CATEGORIES.some((c) => c.key === k)) return { error: "カテゴリが正しくありません" };
        row.category = k;
    }
    if (!partial || has("publish_at")) {
        const d = body?.publish_at ? new Date(body.publish_at) : new Date();
        if (isNaN(d.getTime())) return { error: "公開日時が正しくありません" };
        row.publish_at = d.toISOString();
    }
    if (!partial || has("is_active")) row.is_active = !!body?.is_active;
    if (!partial || has("is_important")) row.is_important = !!body?.is_important;
    if (!partial || has("link_url")) {
        const raw = String(body?.link_url ?? "").trim();
        if (raw && !safeLink(raw)) return { error: "遷移先は「/shop」のようなアプリ内のページだけ指定できます" };
        row.link_url = raw ? safeLink(raw) : null;
    }
    return { row };
}

export async function GET(req: NextRequest) {
    const a = await adminClient(req); if (a.error) return a.error;
    const { data, error } = await a.sb!.from("announcements").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data || [] });
}

export async function POST(req: NextRequest) {
    const a = await adminClient(req); if (a.error) return a.error;
    let body: any; try { body = await req.json(); } catch { return NextResponse.json({ error: "入力が正しくありません" }, { status: 400 }); }
    const v = clean(body, false); if (v.error) return NextResponse.json({ error: v.error }, { status: 400 });
    const { data, error } = await a.sb!.from("announcements").insert({ ...v.row, created_by: a.userId }).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
}

export async function PATCH(req: NextRequest) {
    const a = await adminClient(req); if (a.error) return a.error;
    let body: any; try { body = await req.json(); } catch { return NextResponse.json({ error: "入力が正しくありません" }, { status: 400 }); }
    const id = body?.id; if (id === undefined || id === null || id === "") return NextResponse.json({ error: "対象が指定されていません" }, { status: 400 });
    const v = clean(body, true); if (v.error) return NextResponse.json({ error: v.error }, { status: 400 });
    if (!v.row || Object.keys(v.row).length === 0) return NextResponse.json({ error: "変更内容がありません" }, { status: 400 });
    const { data, error } = await a.sb!.from("announcements").update({ ...v.row, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
}
