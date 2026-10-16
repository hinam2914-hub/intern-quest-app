import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://mbrpygezvxwfsrfpnvgv.supabase.co";
const supabaseAnonKey = "sb_publishable_O7066TM80LqKCtnPfaKMxw_fAV-bTfw";

/**
 * 「ログイン状態を保持する」用のストレージ。
 * 既定（フラグ未設定 or "1"）は従来どおり localStorage（ブラウザを閉じても8時間は保持）。
 * ログイン画面でチェックを外したとき（"0"）だけ sessionStorage に保存し、タブを閉じると消える。
 * 読み取りは両方を見るので、既存ユーザーのセッションはそのまま引き継がれる。
 */
export const KEEP_LOGIN_KEY = "iq_keep_login";
function makeStorage() {
    if (typeof window === "undefined") return undefined;
    const keep = () => window.localStorage.getItem(KEEP_LOGIN_KEY) !== "0";
    return {
        getItem: (k: string) => window.localStorage.getItem(k) ?? window.sessionStorage.getItem(k),
        setItem: (k: string, v: string) => { (keep() ? window.localStorage : window.sessionStorage).setItem(k, v); },
        removeItem: (k: string) => { window.localStorage.removeItem(k); window.sessionStorage.removeItem(k); },
    };
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        storage: makeStorage(),
        autoRefreshToken: true,
    },
});
