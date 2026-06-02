import { supabase } from "./supabase";

type Slot = { start: string; end: string; content: string; result: "ok" | "ng" | null };

// JSTのYYYY-MM-DDを返す（days日前も指定可）
function ymdJST(offsetDays = 0): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000 - offsetDays * 24 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

// その日が「全丸」か判定：内容ありコマが1つ以上 & その全てが ok
function isAllMaru(slots: Slot[]): boolean {
  const filled = (slots || []).filter((s) => s.content && s.content.trim() !== "");
  if (filled.length === 0) return false;
  return filled.every((s) => s.result === "ok");
}

// 複数ユーザーの「全丸連続日数」をまとめて計算して Map で返す
// userIds: 対象ユーザー, lookbackDays: 何日遡るか（既定30）
export async function getAllMaruStreaks(
  userIds: string[],
  lookbackDays = 30
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (userIds.length === 0) return result;

  const since = ymdJST(lookbackDays);

  // 対象期間の全スケジュールを一括取得
  const { data } = await supabase
    .from("daily_schedules")
    .select("user_id, date, slots")
    .gte("date", since)
    .in("user_id", userIds);

  // user_id -> (date -> 全丸かどうか)
  const byUser = new Map<string, Map<string, boolean>>();
  (data || []).forEach((row: any) => {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, new Map());
    byUser.get(row.user_id)!.set(row.date, isAllMaru(row.slots));
  });

  // 各ユーザーごとに今日から遡って連続をカウント
  for (const uid of userIds) {
    const dayMap = byUser.get(uid) || new Map<string, boolean>();
    let streak = 0;
    for (let i = 1; i <= lookbackDays; i++) {
      const d = ymdJST(i);
      if (dayMap.get(d) === true) {
        streak++;
      } else {
        break; // 全丸でない日（未入力・×あり含む）が来たら途切れる
      }
    }
    result.set(uid, streak);
  }

  return result;
}