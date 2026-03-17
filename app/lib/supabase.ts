import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://mbrpygezvxwfsrfpnvgv.supabase.co";
const supabaseAnonKey = "sb_publishable_O7066TM80LqKCtnPfaKMxw_fAV-bTfw";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);