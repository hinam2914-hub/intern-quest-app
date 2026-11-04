// 思考の試練（思考クエスト2.0）の設定を1か所に集約。
// 6種類の思考力・曜日別出題・回答STEP・成長段階はすべてここで管理する（変更はこのファイルだけでOK）。
// 「成長段階」は挑戦実績にもとづく習熟段階であり、思考力の客観評価ではない（能力スコアは出さない）。

export type ThinkCat = "idea" | "why" | "decision" | "reverse" | "persuade" | "perspective";

export type StepDef = { key: string; label: string; ph: string };

export type CatDef = {
    key: ThinkCat;
    quest: string;        // クエスト名
    skill: string;        // 鍛える思考力
    en: string;
    emoji: string;        // 素材が届くまでの仮アイコン（届き次第 img に差し替え）
    img: string | null;   // ChatGPT制作アイコン（public/thinking/）。null の間は emoji を表示
    color: string;
    steps: StepDef[];
    defaultHint: string;  // 問題に hint が無いときのルクのヒント
};

export const THINK_CATS: CatDef[] = [
    {
        key: "idea", quest: "ひらめきの試練", skill: "発想力", en: "IDEA", emoji: "💡", img: null, color: "#e89a1d",
        steps: [{ key: "answer", label: "あなたのアイデア", ph: "自由に発想してみよう。意外なアイデアも大歓迎！" }],
        defaultHint: "正解はないよ。『ふつうはやらないこと』も1つ混ぜてみよう！",
    },
    {
        key: "why", quest: "なぜなぜの迷宮", skill: "分析力", en: "ANALYSIS", emoji: "🌀", img: null, color: "#7a5cc9",
        steps: [
            { key: "cause", label: "考えられる原因", ph: "まずは思いつく原因を書き出そう" },
            { key: "deep", label: "なぜその原因が起きるのか", ph: "その原因の、さらに奥にあるものは？" },
            { key: "fix", label: "根本的な改善策", ph: "根本から変えるなら、何をする？" },
        ],
        defaultHint: "それは本当の原因かな？ もう一段「なぜ？」を重ねてみよう！",
    },
    {
        key: "decision", quest: "決断の天秤", skill: "判断力", en: "JUDGE", emoji: "⚖️", img: null, color: "#2f6fd6",
        steps: [
            { key: "choice", label: "あなたの決断（AかBか）", ph: "どちらを選ぶ？まず決めよう" },
            { key: "reason", label: "選んだ理由", ph: "なぜそちらを選んだ？" },
            { key: "risk", label: "その判断のリスク", ph: "その選択で起こりうる悪いことは？" },
            { key: "counter", label: "リスクへの対策", ph: "リスクにどう備える？" },
        ],
        defaultHint: "反対の選択をしたら、どんな未来になると思う？",
    },
    {
        key: "reverse", quest: "逆転の発想", skill: "柔軟性", en: "FLEX", emoji: "🔄", img: null, color: "#2e9d5f",
        steps: [
            { key: "bad", label: "悪い状態を作る条件", ph: "あえて最悪にするなら、何をする？" },
            { key: "found", label: "そこから見つかる問題", ph: "書き出した条件から、今の問題が見えてこない？" },
            { key: "flip", label: "逆転させた改善策", ph: "その逆をやるなら、具体的にどうする？" },
        ],
        defaultHint: "わざと最悪にする方法が分かれば、その逆が答えの種になるよ",
    },
    {
        key: "persuade", quest: "説得の試練", skill: "論理力", en: "LOGIC", emoji: "📣", img: null, color: "#c4422f",
        steps: [
            { key: "claim", label: "自分の主張", ph: "一言でいうと、何を伝えたい？" },
            { key: "ground", label: "主張の根拠", ph: "そう言える理由・事実は？" },
            { key: "concern", label: "相手の懸念", ph: "相手は何を心配している？" },
            { key: "proposal", label: "最終的な提案", ph: "懸念に応えたうえで、どう提案する？" },
        ],
        defaultHint: "相手が一番心配していることは何だろう？そこから逆算しよう",
    },
    {
        key: "perspective", quest: "視点の扉", skill: "多角的思考", en: "VIEW", emoji: "🚪", img: null, color: "#b07a08",
        steps: [
            { key: "new", label: "新人の視点", ph: "本人にはどう見えている？何を感じている？" },
            { key: "senior", label: "先輩の視点", ph: "先輩の立場からはどう見える？" },
            { key: "customer", label: "顧客の視点", ph: "お客様からはどう見える？" },
            { key: "mine", label: "すべてを踏まえた自分の考え", ph: "3つの視点を並べたうえで、あなたはどう考える？" },
        ],
        defaultHint: "相手の立場だったら、何を不安に感じるかな？",
    },
];

/** getDay()（0=日曜）→ その日の出題種別。日曜は大喜利グランプリ */
export const DAY_TO_CAT: (ThinkCat | "oogiri")[] = ["oogiri", "idea", "why", "decision", "reverse", "persuade", "perspective"];

/** 成長段階（挑戦回数ベースの習熟段階。能力の点数評価ではない） */
export const GROWTH_STAGES = [
    { min: 40, name: "達人", color: "#b84fd8" },
    { min: 20, name: "上級", color: "#e89a1d" },
    { min: 10, name: "中級", color: "#2f6fd6" },
    { min: 3, name: "初級", color: "#2e9d5f" },
    { min: 0, name: "見習い", color: "#8a93a6" },
] as const;

export function growthOf(n: number) {
    return GROWTH_STAGES.find((s) => n >= s.min) ?? GROWTH_STAGES[GROWTH_STAGES.length - 1];
}

/** category（null含む）→ 種別定義。未分類の既存問題は「ひらめきの試練（自由記述）」として扱う */
export function catOf(key: string | null | undefined): CatDef {
    return THINK_CATS.find((c) => c.key === key) ?? THINK_CATS[0];
}

/** STEP回答を1つの本文に連結（thinking_answers.content にそのまま保存できる形） */
export function serializeAnswer(cat: CatDef, values: Record<string, string>): string {
    if (cat.steps.length === 1) return (values[cat.steps[0].key] || "").trim();
    return cat.steps.map((s, i) => `【STEP${i + 1}｜${s.label}】\n${(values[s.key] || "").trim()}`).join("\n\n");
}
