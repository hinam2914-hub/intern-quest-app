import { supabase } from "./supabase";

type NotificationInput = {
  userId: string;       // 宛先
  type: string;         // "thanks" | "approval" | "rejection" など
  title: string;
  message?: string | null;
  link?: string | null;
  icon?: string | null;
};

// 通知を1件作成する
export async function createNotification(input: NotificationInput) {
  await supabase.from("notifications").insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    message: input.message ?? null,
    link: input.link ?? null,
    icon: input.icon ?? null,
    is_read: false,
  });
}