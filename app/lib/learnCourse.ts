// 学習コンテンツを見る順番（コース）。
// contents.course_code / course_no を learn_course.sql で入れる。未設定のあいだは従来どおり新しい順で表示する。
export type CourseDef = { code: string; label: string; name: string; kind: "main" | "free"; note: string };

export const COURSES: CourseDef[] = [
  { code: "s1", label: "STEP1", name: "はじめの必修", kind: "main", note: "まず全員がここから。仕事への向き合い方の土台" },
  { code: "s2", label: "STEP2", name: "社会人の当たり前", kind: "main", note: "挨拶・言葉遣い → 敬語 → 報連相 → 仕事の姿勢" },
  { code: "s3", label: "STEP3", name: "社会人基礎", kind: "main", note: "給料の出どころ → 人間関係 → 議事録・資料" },
  { code: "s4", label: "STEP4", name: "営業の基本", kind: "main", note: "なぜ営業か → 基本・実践・心構え → 営業の種類" },
  { code: "s5", label: "STEP5", name: "思考法・仕事術", kind: "main", note: "現在地 → 時間 → 目的と手段 → 努力の仕方 → 伝え方" },
  { code: "s6", label: "STEP6", name: "マインド", kind: "main", note: "基本姿勢 → 量と努力 → 落ち込んだとき → スピーチ集" },
  { code: "a", label: "選択A", name: "AI・スキル", kind: "free", note: "入門 → Claude Code → アプリ開発 → 事例" },
  { code: "b", label: "選択B", name: "就活・キャリア", kind: "free", note: "20代の考え方 → 軸・自己分析 → ES・ガクチカ → 資格" },
  { code: "c", label: "選択C", name: "教養・その他", kind: "free", note: "仕事観 → お金 → 幸せ → 人物 → 名言集" },
];

type Row = { id: string; course_code?: string | null; course_no?: number | null; created_at?: string | null };
const IDX: Record<string, number> = Object.fromEntries(COURSES.map((c, i) => [c.code, i]));

/** コースの順番が1本でも入っているか（SQL未実行なら false） */
export const hasCourse = (rows: Row[]) => rows.some((r) => !!r.course_code && r.course_code in IDX);

/** コース順に並べる。順番が入っていないものは後ろ（新しい順）に回す */
export function sortByCourse<T extends Row>(rows: T[]): T[] {
  const key = (r: Row) => (r.course_code && r.course_code in IDX ? IDX[r.course_code] : 99);
  return [...rows].sort((a, b) => key(a) - key(b) || (a.course_no ?? 9999) - (b.course_no ?? 9999) || String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
}
