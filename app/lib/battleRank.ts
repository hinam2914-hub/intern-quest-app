// バトルランク。島バトルの実績（攻撃した回数・城を落とした回数）から決まる。
// 集計はサーバー側の battle_ranking()（battle_server.sql）の合計値だけを使う。報酬はなく、表示だけ。
// シーズン（期間ごとのリセット）は無く、累計で上がっていく。
import type { SupabaseClient } from "@supabase/supabase-js";

/** バトルポイントの付き方 */
export const BP_RULE = { attack: 1, win: 10 };

export type RankDef = { key: string; name: string; min: number; img: string; color: string };
/** min 以上でそのランク。未ランク＝まだ一度も攻撃していない */
export const BATTLE_RANKS: RankDef[] = [
  { key: "none", name: "未ランク", min: 0, img: "/guild/rank_none.webp", color: "#64748b" },
  { key: "bronze", name: "ブロンズ", min: 1, img: "/guild/rank_bronze.webp", color: "#a05a2c" },
  { key: "silver", name: "シルバー", min: 20, img: "/guild/rank_silver.webp", color: "#64748b" },
  { key: "gold", name: "ゴールド", min: 60, img: "/guild/rank_gold.webp", color: "#b7791f" },
  { key: "platinum", name: "プラチナ", min: 150, img: "/guild/rank_platinum.webp", color: "#0e7490" },
  { key: "diamond", name: "ダイヤ", min: 300, img: "/guild/rank_diamond.webp", color: "#2563eb" },
  { key: "master", name: "マスター", min: 600, img: "/guild/rank_master.webp", color: "#7c3aed" },
];

export type BattleStat = { attacks: number; wins: number; bp: number };
export const NO_STAT: BattleStat = { attacks: 0, wins: 0, bp: 0 };

export const battlePoints = (attacks: number, wins: number) => attacks * BP_RULE.attack + wins * BP_RULE.win;

export function rankOf(bp: number): RankDef {
  let r = BATTLE_RANKS[0];
  for (const d of BATTLE_RANKS) if (bp >= d.min) r = d;
  return r;
}
/** 次のランクと、そこまでの残りポイント（最高ランクなら null） */
export function nextRank(bp: number): { rank: RankDef; left: number } | null {
  const n = BATTLE_RANKS.find((d) => d.min > bp);
  return n ? { rank: n, left: n.min - bp } : null;
}

/** 全員分のバトル実績を取る。関数が未導入・履歴0件なら空（全員 未ランク） */
export async function loadBattleStats(sb: SupabaseClient): Promise<Record<string, BattleStat>> {
  const out: Record<string, BattleStat> = {};
  try {
    const { data, error } = await sb.rpc("battle_ranking");
    if (error || !data) return out;
    (data as any[]).forEach((r) => {
      const attacks = Number(r.attacks) || 0, wins = Number(r.wins) || 0;
      out[r.user_id] = { attacks, wins, bp: battlePoints(attacks, wins) };
    });
  } catch { /* バトル未導入 */ }
  return out;
}
