// シビュラシステム 計算ロジック（admin と本人用ページで共用）
// ============ シビュラシステム用マスター＆計算関数 ============
export const MBTI_SCORES: Record<string, { cog: number; grit: number; social: number; drive: number; create: number }> = {
    "INTJ": { cog: 10, grit: 8, social: 3, drive: 2, create: 9 },
    "INTP": { cog: 10, grit: 6, social: 2, drive: 2, create: 10 },
    "ENTJ": { cog: 9, grit: 9, social: 7, drive: 8, create: 7 },
    "ENTP": { cog: 9, grit: 6, social: 7, drive: 8, create: 10 },
    "INFJ": { cog: 8, grit: 7, social: 8, drive: 3, create: 9 },
    "INFP": { cog: 7, grit: 5, social: 7, drive: 3, create: 10 },
    "ENFJ": { cog: 7, grit: 7, social: 10, drive: 7, create: 8 },
    "ENFP": { cog: 6, grit: 5, social: 9, drive: 9, create: 9 },
    "ISTJ": { cog: 7, grit: 9, social: 4, drive: 3, create: 3 },
    "ISFJ": { cog: 5, grit: 8, social: 7, drive: 3, create: 3 },
    "ESTJ": { cog: 7, grit: 9, social: 6, drive: 7, create: 4 },
    "ESFJ": { cog: 5, grit: 7, social: 9, drive: 6, create: 4 },
    "ISTP": { cog: 7, grit: 7, social: 3, drive: 9, create: 6 },
    "ISFP": { cog: 4, grit: 4, social: 6, drive: 6, create: 7 },
    "ESTP": { cog: 6, grit: 8, social: 7, drive: 10, create: 5 },
    "ESFP": { cog: 4, grit: 5, social: 9, drive: 10, create: 6 },
};

export const CLUB_SCORES: Record<string, { grit: number; drive: number; social: number }> = {
    "運動部": { grit: 8, drive: 8, social: 6 },
    "文化部": { grit: 5, drive: 4, social: 5 },
    "帰宅部": { grit: 2, drive: 2, social: 2 },
};

// 旧分類→新3分類の互換マッピング（未移行データ対策）
export const CLUB_LEGACY_MAP: Record<string, string> = {
    "野球部": "運動部",
    "体育会系（全国レベル）": "運動部",
    "体育会系（一般）": "運動部",
    "チームスポーツ系": "運動部",
    "個人競技系": "運動部",
    "文化部（発表系）": "文化部",
    "文化部（創作系）": "文化部",
};

export const HOBBY_SCORES: Record<string, { cog: number; social: number; drive: number; create: number }> = {
    "読書・勉強": { cog: 9, social: 2, drive: 2, create: 5 },
    "ゲーム": { cog: 6, social: 4, drive: 7, create: 4 },
    "スポーツ": { cog: 3, social: 7, drive: 9, create: 3 },
    "音楽": { cog: 4, social: 5, drive: 3, create: 6 },
    "アート・ものづくり": { cog: 5, social: 3, drive: 3, create: 10 },
    "旅行・アウトドア": { cog: 4, social: 7, drive: 7, create: 5 },
    "グルメ": { cog: 3, social: 7, drive: 4, create: 4 },
    "映画・ドラマ": { cog: 5, social: 4, drive: 2, create: 6 },
    "推し活": { cog: 2, social: 5, drive: 3, create: 3 },
    "SNS・配信": { cog: 3, social: 6, drive: 3, create: 4 },
    "買い物・ファッション": { cog: 3, social: 7, drive: 5, create: 7 },
    "ペット・動物": { cog: 3, social: 6, drive: 3, create: 4 },
    "サウナ": { cog: 3, social: 4, drive: 3, create: 2 },
    "寝ること・休む": { cog: 2, social: 1, drive: 1, create: 1 },
};

// 旧分類→新分類の互換マッピング
export const HOBBY_LEGACY_MAP: Record<string, string> = {
    "ゲーム（戦略）": "ゲーム",
    "ゲーム（アクション）": "ゲーム",
    "スポーツ・運動": "スポーツ",
    "音楽・楽器": "音楽",
    "アート・創作": "アート・ものづくり",
    "旅行": "旅行・アウトドア",
    "アウトドア": "旅行・アウトドア",
    "グルメ・食べ歩き": "グルメ",
    "映画・ドラマ鑑賞": "映画・ドラマ",
};

export function getEducationSibyl(education: string): { cog: number; grit: number } {
    if (!education) return { cog: 0, grit: 0 };
    const e = education;
    if (/東京大学|^東大|京都大学|^京大/.test(e)) return { cog: 18, grit: 9 };
    if (/大阪大学|^阪大|名古屋大学|^名大|東北大学|九州大学|^九大|北海道大学|^北大|一橋|東京工業|東工大|神戸大学|筑波大学/.test(e)) return { cog: 16, grit: 8 };
    if (/早稲田|慶應|慶応/.test(e)) return { cog: 15, grit: 8 };
    if (/上智|東京理科大学|理科大|ICU|国際基督教/.test(e)) return { cog: 13, grit: 7 };
    if (/学習院|明治大学|^明大|青山学院|立教|中央大学|^中大|法政|関西大学|関西学院|同志社|立命館/.test(e)) return { cog: 12, grit: 6 };
    if (/成城|成蹊|明治学院|獨協|國學院|国学院|武蔵大学|武蔵大|芝浦工業|東京都立|埼玉大学|千葉大学|横浜国立|静岡大学|新潟大学|信州大学|岡山大学|広島大学|熊本大学/.test(e)) return { cog: 10, grit: 6 };
    if (/日本大学|^日大|東洋大学|^東洋|駒澤|駒沢|専修|京都産業|近畿大学|甲南|龍谷/.test(e)) return { cog: 7, grit: 5 };
    if (/大東文化|東海大学|亜細亜|帝京|国士舘|神奈川大学|工学院|東京電機|拓殖|玉川|文化学園|大妻|実践女子|共立女子/.test(e)) return { cog: 5, grit: 4 };
    if (/専門学校|高等学校|高校卒|高卒/.test(e)) return { cog: 2, grit: 3 };
    return { cog: 3, grit: 3 };
}


export function calculateSibyl(params: { mbti: string; education: string; club: string; hobby: string }): { cog: number; grit: number; social: number; drive: number; create: number } {
    const m = MBTI_SCORES[params.mbti] || { cog: 0, grit: 0, social: 0, drive: 0, create: 0 };
    const e = getEducationSibyl(params.education);
    const c = CLUB_SCORES[CLUB_LEGACY_MAP[params.club] || params.club] || { grit: 0, drive: 0, social: 0 };
    const h = HOBBY_SCORES[HOBBY_LEGACY_MAP[params.hobby] || params.hobby] || { cog: 0, social: 0, drive: 0, create: 0 };

    // 学歴を全軸のベースにする（学歴 > 性格の原則）
    const base = {
        cog: Math.round(e.cog * 1.2 + m.cog * 0.4 + h.cog * 0.2),
        grit: Math.round(e.cog * 0.5 + m.grit * 0.4 + c.grit * 0.7 + e.grit * 0.3),
        social: Math.round(e.cog * 0.3 + m.social * 0.7 + c.social * 0.4 + h.social * 0.3),
        drive: Math.round(e.cog * 0.3 + m.drive * 0.7 + c.drive * 0.5 + h.drive * 0.3),
        create: Math.round(e.cog * 0.4 + m.create * 0.6 + h.create * 0.5),
    };

    // 気質×学歴×部活の組織適性補正
    const color = getMbtiColor(params.mbti);
    let mult = 1.0;
    if (color === "紫") mult = 1.10;
    else if (color === "黄") mult = 1.08;
    else if (color === "青") mult = 1.00;
    else if (color === "緑") mult = 0.85;
    // ニッコマ以下の紫は頭脳型として不足
    if (color === "紫" && e.cog <= 7) mult *= 0.85;
    // 実データに基づく個別補正
    if (params.mbti === "ISFP") mult *= 0.82;
    if (params.mbti === "INFP") mult *= 0.85;
    // 部活による継続力の証明
    const clubKey = CLUB_LEGACY_MAP[params.club] || params.club;
    if (clubKey === "運動部") mult *= 1.08;
    else if (clubKey === "帰宅部") mult *= 0.95;

    return {
        cog: Math.min(Math.round(base.cog * mult), 20),
        grit: Math.min(Math.round(base.grit * mult), 20),
        social: Math.min(Math.round(base.social * mult), 20),
        drive: Math.min(Math.round(base.drive * mult), 20),
        create: Math.min(Math.round(base.create * mult), 20),
    };
}


export function calculateDepartmentMatch(s: { cog: number; grit: number; social: number; drive: number; create: number }, opts?: { mbti?: string; education?: string }): { dept: string; score: number }[] {
    const results = [
        { dept: "訪販", score: s.drive * 2 + s.grit * 2 + s.social * 1 },
        { dept: "テレアポ", score: s.social * 2 + s.drive * 2 + s.grit * 1 },
        { dept: "クローザー", score: s.social * 2 + s.drive * 2 + s.create * 1 },
        { dept: "人事", score: s.social * 2 + s.cog * 2 + s.create * 1 },
        { dept: "管理マネージャー", score: s.grit * 2 + s.cog * 2 + s.social * 1 },
    ];
    const color = opts?.mbti ? getMbtiColor(opts.mbti) : null;
    const high = opts?.education ? isHighEducation(opts.education) : false;
    const isE = opts?.mbti ? opts.mbti[0] === "E" : false;
    const boost = (dept: string, mult: number) => {
        const r = results.find(x => x.dept === dept);
        if (r) r.score = Math.round(r.score * mult);
    };
    if (color === "緑") {
        if (high) boost("テレアポ", 1.3); else boost("訪販", 1.3);
        boost("人事", 1.15);
    } else if (color === "紫") {
        boost("テレアポ", 1.3);
        boost("管理マネージャー", 1.15);
        if (isE) boost("クローザー", 1.2); else boost("クローザー", 0.85);
    } else if (color === "青") {
        boost("クローザー", 0.5);
        if (high) boost("管理マネージャー", 1.3); else boost("訪販", 1.3);
    } else if (color === "黄") {
        boost("訪販", 1.25);
        boost("クローザー", 1.25);
        boost("管理マネージャー", 0.85);
    }
    results.sort((a, b) => b.score - a.score);
    return results;
}

// ============ シビュラシステムここまで ============

// ============ 育成コース診断 ============
export type GrowthCourse = { color: string; colorCode: string; courseName: string; entry: string; process: string; goal: string; ngJobs: string[]; roleModel: string; level: string; };
export function getMbtiColor(mbti: string): "緑" | "紫" | "青" | "黄" | null {
    if (!mbti || mbti.length < 4) return null;
    if (mbti[1] === "N" && mbti[2] === "F") return "緑";
    if (mbti[1] === "N" && mbti[2] === "T") return "紫";
    if (mbti[1] === "S" && mbti[3] === "J") return "青";
    if (mbti[1] === "S" && mbti[3] === "P") return "黄";
    return null;
}
export function isHighEducation(education: string): boolean { return getEducationSibyl(education).cog >= 7; }
export function calculateGrowthCourse(params: { mbti: string; education: string; sibyl: { cog: number; grit: number; social: number; drive: number; create: number }; }): GrowthCourse | null {
    const color = getMbtiColor(params.mbti);
    if (!color) return null;
    const high = isHighEducation(params.education);
    const s = params.sibyl;
    const isE = params.mbti[0] === "E";
    const total = s.cog + s.grit + s.social + s.drive + s.create;
    const level = total >= 70 ? "トップ" : total >= 50 ? "ミドル" : "スタンダード";
    if (color === "緑") return { color, colorCode: "#2E7D5B", courseName: "外交官タイプ｜人を導き、支える", entry: high ? "テレアポ" : "訪販", process: "メンターとして新人と伴走。共感力を活かし、遊びにも誘いながら同属性メンバーの離職を防止する", goal: "Aランク企業内定→就活アドバイザーまたは人事へ。愛社精神を軸に卒業後もDot.Aに残留し中核を担う", ngJobs: [], roleModel: "学生＝向井／社会人＝寺内", level };
    if (color === "紫") return { color, colorCode: "#6A4C9C", courseName: "分析家タイプ｜戦略と仕組みで価値を生む", entry: high ? "テレアポ" : "テレアポまたはインフラ業務", process: "テレアポで対人の型を習得しつつ、仕組み化・データ分析で組織に貢献する", goal: "AIチーム・戦略管理マネージャー" + (isE ? "（外向型はクローザーも適性あり）" : ""), ngJobs: [], roleModel: "中島・高崎・前田・小守谷", level };
    if (color === "青") return { color, colorCode: "#2B6CB0", courseName: "番人タイプ｜地道に、確実にやり切る", entry: high ? "管理・マネジメント" : "訪販", process: "型を身につけ、継続力で安定成果を積み上げる。瞬発勝負より確実な運用で信頼を得る", goal: high ? "管理マネージャーとして運用を統括する" : "鉄人・牧田コース。訪販で圧倒的な件数を取り続ける", ngJobs: ["クローザー"], roleModel: high ? "（現在不在）" : "牧田", level };
    return { color, colorCode: "#C99A00", courseName: "探検家タイプ｜瞬発力と華で勝負する", entry: "訪販またはクローザー", process: "現場で瞬発力と華を発揮し、短期の達成を積み上げてトップセールスの型を作る", goal: "トップクローザーとして売りまくる、またはコミュニティプレジデント", ngJobs: [], roleModel: "クローザー＝小林／ディレクター＝清原", level };
}
// ============ 育成コース診断ここまで ============

// ============ 気質別育成方針 ============
export function getIkuseiGuide(mbti: string): { color: string; colorCode: string; tag: string; talk: string; avoid: string; grow: string } | null {
    const color = getMbtiColor(mbti);
    if (!color) return null;
    if (color === "緑") return { color, colorCode: "#2E7D5B", tag: "意味とつながりで動く",
        talk: "行動の先にある価値を言語化して伝える。プロセスや姿勢も頻繁に承認する。1on1で感情面に触れる。",
        avoid: "数字だけを詰める／競争を煽る／放置する／他人と比較する。静かに離脱させる要因になる。",
        grow: "比較ではなく『先週の自分より』で評価。同気質の先輩をメンターにつけ安心を確保した上で挑戦させる。" };
    if (color === "紫") return { color, colorCode: "#6A4C9C", tag: "論理と仕組みで動く",
        talk: "理由と背景をセットで伝える。裁量を与えて自分で設計させる。知的に面白い課題を渡すと燃える。",
        avoid: "理由なき命令／マイクロマネジメント／感情だけの叱責。納得できないルールの押し付けで冷める。",
        grow: "裁量と責任を渡して考える余地を作る。苦手な対人・感情は緑タイプとの協働で補わせる。" };
    if (color === "青") return { color, colorCode: "#2B6CB0", tag: "秩序と継続で動く",
        talk: "やるべきことを具体的・明確に示す。手順や基準をはっきりさせる。地道な継続そのものを認める。",
        avoid: "曖昧な指示／頻繁な方針変更／丸投げ。先が読めない状態が続くと不安で動けなくなる。",
        grow: "型を与え安定させた上で、少しずつ『なぜ』や応用を足して視座を上げる。小さな成功体験を積ませる。" };
    return { color, colorCode: "#C99A00", tag: "行動と臨機応変で動く",
        talk: "理屈を長く語るより、やらせて体で覚えさせる。即時のフィードバックと小刻みな達成で乗せる。",
        avoid: "長い座学／細かい計画の強制／反復だけ。退屈すると熱が冷める。ムラは継続の仕組みでフォロー。",
        grow: "瞬発力を活かしつつ、青タイプの型や継続の仕組みでムラを減らす。短期の達成を積み上げさせる。" };
}
// ============ 気質別育成方針ここまで ============

// ============ メンター相性 ============
export function mentorCompat(menteeMbti: string, mentorMbti: string): { label: string; note: string; rank: number } | null {
    const m = getMbtiColor(menteeMbti);
    const t = getMbtiColor(mentorMbti);
    if (!m || !t) return null;
    const table: Record<string, Record<string, [string, string, number]>> = {
        "緑": { "緑": ["最適", "価値観が通じ感情ケア可", 3], "紫": ["成長軸", "視座が上がる/感情へ翻訳を", 1], "青": ["良好", "情熱を継続で支える", 2], "黄": ["要橋渡し", "学びの定着に工夫を", 0] },
        "紫": { "緑": ["成長軸", "感情の機微を学べる", 1], "紫": ["最適", "論理が通じ話が早い", 3], "青": ["良好", "構想を実行に落とす", 2], "黄": ["要橋渡し", "抽象と具体ですれ違い", 0] },
        "青": { "緑": ["良好", "意味づけで動機を温める", 2], "紫": ["成長軸", "背景と戦略を学べる", 1], "青": ["最適", "手順が明確で安心", 3], "黄": ["要橋渡し", "進め方の好みが逆", 0] },
        "黄": { "緑": ["良好", "承認で乗せ感情を支える", 2], "紫": ["要橋渡し", "座学的/動かして教える", 0], "青": ["良好", "型と継続でムラを減らす", 2], "黄": ["最適", "現場で背中を見せる", 3] },
    };
    const r = table[m][t];
    return { label: r[0], note: r[1], rank: r[2] };
}
// ============ メンター相性ここまで ============

// ============ 同僚相性 ============
export function peerCompat(a: string, b: string): { match: number; ns: boolean } | null {
    if (!a || a.length < 4 || !b || b.length < 4) return null;
    let match = 0;
    for (let i = 0; i < 4; i++) if (a[i] === b[i]) match++;
    const ns = a[1] === b[1]; // N/S軸が一致してるか
    return { match, ns };
}
// ============ 同僚相性ここまで ============


// ============ 行動スコア（実績ベース・最大50点） ============
export type ActionStats = {
    streak: number;            // 連続提出日数
    submitRate: number;        // 直近30日の日報提出率(0-100)
    testPassed: number;        // 合格テスト数
    contentDone: number;       // 学習コンテンツ完了数
    courseStamps: number;      // 講座スタンプ数
    thanksSent: number;        // サンキュー送信数
    thanksReceived: number;    // サンキュー受信数
    challengeDone: number;     // チャレンジ達成数
    kpiAchieved: number;       // KPI達成回数
    level: number;             // 現在のレベル
};

export function calculateActionScore(a: ActionStats): { total: number; breakdown: { label: string; score: number; max: number }[] } {
    // 継続力 20点
    const streakPt = Math.min(10, Math.round(a.streak / 6));
    const ratePt = Math.min(10, Math.round(a.submitRate / 10));
    const keep = streakPt + ratePt;
    // 学習量 10点
    const learn = Math.min(10, Math.round(a.testPassed * 1.2 + a.contentDone * 0.3 + a.courseStamps * 1.5));
    // 貢献 10点
    const contrib = Math.min(10, Math.round(a.thanksSent * 0.4 + a.thanksReceived * 0.5));
    // 挑戦 10点
    const challenge = Math.min(10, Math.round(a.challengeDone * 0.8 + a.kpiAchieved * 1.5));
    const total = Math.min(50, keep + learn + contrib + challenge);
    return {
        total,
        breakdown: [
            { label: "継続力", score: keep, max: 20 },
            { label: "学習量", score: learn, max: 10 },
            { label: "貢献", score: contrib, max: 10 },
            { label: "挑戦", score: challenge, max: 10 },
        ],
    };
}

// 資質(最大100) + 行動(最大50) = ポテンシャル(最大150)
export function getPotentialRank(sibylTotal: number, actionTotal: number): { rank: string; score: number; color: string; label: string } {
    const score = sibylTotal + actionTotal;
    if (score >= 110) return { rank: "S", score, color: "#a78bfa", label: "圧倒的ポテンシャル" };
    if (score >= 90) return { rank: "A", score, color: "#34d399", label: "高いポテンシャル" };
    if (score >= 70) return { rank: "B", score, color: "#38bdf8", label: "着実に伸びている" };
    if (score >= 50) return { rank: "C", score, color: "#fbbf24", label: "これから伸びる" };
    return { rank: "D", score, color: "#f87171", label: "まずは行動から" };
}


// ============ 分析対象外（経営側メンバー） ============
export const EXCLUDED_IDS: string[] = [
    "dd8dc6b9-9ead-4ff1-8c36-b948a575ba07", // 中島萌梨
    "78ea0ef2-4478-49f2-9aa9-df570ff0116a", // 小林篤央
    "989e845f-55bc-4bde-be08-b52b88bb5f6d", // 山崎亮
    "055fe655-28e8-4a1a-9a4f-cd1385fa31a2", // 川田瑞貴
    "f39e0ae1-56ae-496e-8730-6e9269e4870d", // 村上凌太
    "571a5e82-c8f2-4a23-873f-3f5800dd274b", // 柴崎航貴
    "7cb0f3ec-310d-4455-8a6a-935fc5dac1e1", // 湊敦
    "d6c76a09-c105-48ac-9621-f3d0d1b8fd21", // 田中賢
];
export const isExcluded = (id: string) => EXCLUDED_IDS.includes(id);
