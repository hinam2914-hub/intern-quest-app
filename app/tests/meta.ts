// テスト一覧のマスタ（表示名・カテゴリ・並び順・満点）。問題と正解はDB（test_questions）にあり、ここには無い。
export const TEST_MAX_SCORES: Record<string, number> = {
    quiz: 15,
    common_sense: 15,
    social_standard: 15,
    profit_thinking: 15,
    long_term_thinking: 15,
    essence_thinking: 15,
    standard_keeping: 15,
    market_value: 15,
    teiou: 15,
    mentor: 100,
    retention: 100,
    entrepreneur: 100,
    marketer: 100,
    sales: 100,
    planner: 100,
    manager: 100,
    standard_raising: 15,
    management_collab: 15,
    cert_market_value: 15,
    improvement_force: 15,
    apology_escape: 15,
    logical_thinking: 15,
    progress_update: 15,
    life_improvement: 15,
    market_eval: 15,
    quick_response: 15,
    self_protection: 15,
};
export type TestItem = {
    key: string;
    label: string;
    desc: string;
    path: string;
    icon: string;
    color: string;
    passedField?: string;
    rewardText: string;
    table: "quiz_attempts" | "test_attempts" | "manual";
    category?: "mind" | "conduct" | "aptitude" | "market";
};

export const CATEGORY_ORDER = [
    { key: "mind", label: "マインド・価値観", desc: "土台となる思考をつくる", icon: "🧠", color: "#a78bfa" },
    { key: "conduct", label: "素行・改善", desc: "行動のクセを整える", icon: "📋", color: "#f97316" },
    { key: "aptitude", label: "職種適性", desc: "自分に向いた道を知る", icon: "💼", color: "#8b5cf6" },
    { key: "market", label: "市場価値・キャリア認識", desc: "評価される基準を知る", icon: "📈", color: "#ef4444" },
];

export const TEST_ORDER: Record<string, number> = {
    quiz: 1, common_sense: 2, social_standard: 3, standard_keeping: 4, standard_raising: 5,
    long_term_thinking: 6, profit_thinking: 7, essence_thinking: 8, logical_thinking: 9, teiou: 10,
    quick_response: 1, progress_update: 2, improvement_force: 3, apology_escape: 4,
    self_protection: 5, life_improvement: 6, management_collab: 7,
    sales: 1, marketer: 2, planner: 3, mentor: 4, manager: 5, entrepreneur: 6,
    market_eval: 1, cert_market_value: 2, retention: 3,
};

export type Attempt = {
    score: number;
    passed: boolean;
    created_at: string;
    written_answers?: any;
    id?: string;
    answers?: any;
    written_evaluation?: "high" | "mid" | "none" | null;
    written_points_awarded?: number;
};

export const TESTS: TestItem[] = [
    { key: "common_sense", label: "常識・デリカシーテスト", desc: "人として基本のキ", path: "/tests/common-sense", icon: "🧠", color: "#a78bfa", passedField: "common_sense_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "mind" },
    { key: "social_standard", label: "社会人基準・現実認識", desc: "“まだまだ”を理解する基準テスト", path: "/tests/social-standard", icon: "🎯", color: "#ec4899", passedField: "social_standard_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "mind" },
    { key: "long_term_thinking", label: "長期思考・複利思考", desc: "未来の自分を優先できるか", path: "/tests/long-term-thinking", icon: "📈", color: "#3b82f6", passedField: "long_term_thinking_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "mind" },
    { key: "profit_thinking", label: "利益思考・判断センス", desc: "感情ではなく利益で動けるか", path: "/tests/profit-thinking", icon: "💰", color: "#10b981", passedField: "profit_thinking_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "mind" },
    { key: "essence_thinking", label: "本質思考・タスク整理", desc: "“余計なことを増やさない人”になる", path: "/tests/essence-thinking", icon: "🔍", color: "#06b6d4", passedField: "essence_thinking_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "mind" },
    { key: "standard_keeping", label: "基準維持・妥協耐性", desc: "“すぐ妥協しない人”になる", path: "/tests/standard-keeping", icon: "⚖️", color: "#f97316", passedField: "standard_keeping_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "mind" },
    { key: "quiz", label: "確認ワークテスト", desc: "価値観と仕事の基本をチェック", path: "/quiz", icon: "🧠", color: "#a78bfa", passedField: "quiz_passed", rewardText: "合格で +10pt", table: "quiz_attempts", category: "mind" },
    { key: "teiou", label: "Dot.A 帝王学", desc: "思想・判断・覚悟の最高ランク", path: "/tests/teiou", icon: "👑", color: "#fbbf24", passedField: "teiou_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "mind" },
    { key: "marketer", label: "マーケター適性テスト", desc: "売れる仕組みを作れるか", path: "/tests/marketer", icon: "📊", color: "#06b6d4", passedField: "marketer_passed", rewardText: "満点合格で +10pt", table: "test_attempts", category: "aptitude" },
    { key: "sales", label: "営業デビュー適性テスト", desc: "現場に出る準備ができているか", path: "/tests/sales", icon: "💼", color: "#8b5cf6", passedField: "sales_passed", rewardText: "満点合格で +10pt", table: "test_attempts", category: "aptitude" },
    { key: "mentor", label: "メンターテスト", desc: "育成者としての思考判定", path: "/tests/mentor", icon: "🌱", color: "#10b981", passedField: "mentor_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "aptitude" },
    { key: "planner", label: "企画職適性テスト", desc: "売上責任を持つ設計者か", path: "/tests/planner", icon: "💡", color: "#ec4899", passedField: "planner_passed", rewardText: "満点合格で +10pt", table: "test_attempts", category: "aptitude" },
    { key: "entrepreneur", label: "起業適性テスト", desc: "今やるべきか、まだやるな", path: "/tests/entrepreneur", icon: "🚀", color: "#f59e0b", passedField: "entrepreneur_passed", rewardText: "満点合格で +10pt", table: "test_attempts", category: "aptitude" },
    { key: "manager", label: "マネージャーテスト", desc: "チームで勝つための思考", path: "/manager-test", icon: "👔", color: "#6366f1", rewardText: "合格で +10pt", table: "manual", category: "aptitude" },
    { key: "retention", label: "Dot.A 雇用テスト", desc: "雇用継続の判定テスト", path: "/tests/retention", icon: "🔥", color: "#ef4444", passedField: "retention_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "market" },
    { key: "standard_raising", label: "基準上昇・人生現実テスト", desc: "親世代と同じ生活基準を理解する", path: "/tests/standard-raising", icon: "🚀", color: "#f43f5e", passedField: "standard_raising_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "mind" },
    { key: "management_collab", label: "マネジメント・協働価値テスト", desc: "他人と成果を作れる人になる", path: "/tests/management-collab", icon: "🤝", color: "#06b6d4", passedField: "management_collab_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "conduct" },
    { key: "cert_market_value", label: "資格依存・市場価値現実テスト", desc: "資格より実務価値を理解する", path: "/tests/cert-market-value", icon: "💎", color: "#14b8a6", passedField: "cert_market_value_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "market" },
    { key: "improvement_force", label: "改善力・逃避防止テスト", desc: "宣言だけで終わらない人になる", path: "/tests/improvement-force", icon: "🔧", color: "#f97316", passedField: "improvement_force_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "conduct" },
    { key: "apology_escape", label: "謝罪逃避・責任転嫁防止テスト", desc: "謝って終わる人にならない", path: "/tests/apology-escape", icon: "🪞", color: "#eab308", passedField: "apology_escape_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "conduct" },
    { key: "logical_thinking", label: "論理思考・感情逃避防止テスト", desc: "感情論で押し切らない判断力", path: "/tests/logical-thinking", icon: "🧮", color: "#6366f1", passedField: "logical_thinking_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "mind" },
    { key: "progress_update", label: "進捗更新・ケアレスミス改善テスト", desc: "報連相と確認力の徹底", path: "/tests/progress-update", icon: "📡", color: "#84cc16", passedField: "progress_update_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "conduct" },
    { key: "life_improvement", label: "生活改善・時間価値テスト", desc: "堕落せず積み上げ続ける", path: "/tests/life-improvement", icon: "⏰", color: "#d946ef", passedField: "life_improvement_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "conduct" },
    { key: "market_eval", label: "市場価値・評価認識テスト", desc: "評価は自分で決めるものではない", path: "/tests/market-eval", icon: "📊", color: "#ef4444", passedField: "market_eval_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "market" },
    { key: "quick_response", label: "即レス・反応速度テスト", desc: "相手の時間を止めない意識", path: "/tests/quick-response", icon: "⚡", color: "#facc15", passedField: "quick_response_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "conduct" },
    { key: "self_protection", label: "保身・自己防衛過剰改善テスト", desc: "自分を守るより問題と向き合う", path: "/tests/self-protection", icon: "🛡️", color: "#a855f7", passedField: "self_protection_passed", rewardText: "合格で +10pt", table: "test_attempts", category: "conduct" },
];


export function formatDate(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
/** 受け取った素材（ChatGPT制作）。差し替えるときはここのパスだけ変える */
export const TEST_IMG = { book: "/tests/book.webp", crown: "/tests/crown.webp", challenge: "/tests/challenge.webp" };
