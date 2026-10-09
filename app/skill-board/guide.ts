// スキルの説明文と、条件ごとの「やり方・行き先」ガイド（表示専用。判定には関与しない）
import type { CondState } from "../lib/skills";

/** スキルの説明（DB の skill_nodes.description が空のときのフォールバック） */
export const SKILL_DESC: Record<string, string> = {
  sales_1: "営業の流れと基本の型を知る。「なぜこの順番で話すのか」を説明できる状態。",
  sales_2: "相手の状況・困りごとを質問で引き出せる。話すより聞く時間のほうが長くなる。",
  sales_3: "聞いた内容から「本当の課題」を見つけ、原因を自分の言葉で言語化できる。",
  sales_4: "相手の課題に合わせて提案を組み立て、初めての獲得にたどり着く。",
  sales_5: "迷っている相手の背中を押して決めてもらう力。安定して獲得できる。",
  sales_6: "営業免許を持ち、数字で結果を出し続けるクローザーの証明。",
  comm_1: "自分のことを短く、印象に残る形で伝えられる。冒険の最初の一歩。",
  comm_2: "「何を聞きたいか」を言葉にできる。FBを頼むとき、見てほしい点を具体的に書ける。",
  comm_3: "相手の話やFBを最後まで受け止められる。社会人として当たり前の姿勢を身につける。",
  comm_4: "感謝を伝え、仲間との信頼を積み上げる。コミュニケーションの基礎が一通り身についた状態。",
  comm_5: "もらったFBを行動に変える。「言われたこと」を次の実験にできる。",
  comm_6: "常識とデリカシーを備え、まわりから信頼される存在。メンターへの入口。",
  think_1: "1日の経験を日報で振り返り、次に試すことを決められる。",
  think_2: "結果の「なぜ？」を掘り下げて、原因を特定できる。",
  think_3: "「こうすれば良くなるはず」という仮説を立てて、実験として試せる。",
  think_4: "実験の結果を確かめ、何が効いたのかを判断できる。",
  think_5: "本質を見抜き、改善を繰り返して実際に結果を良くできる。",
  think_6: "長期と利益の視点で物事を考えられる。マネージャーに必要な思考力。",
  mgmt_1: "毎日の予定を自分で立て、やり切るリズムを作れる。",
  mgmt_2: "FBの受け方・求め方を知り、メンターの基礎を身につける。",
  mgmt_3: "仲間の日報にFBを返し、成長を後押しできる。",
  mgmt_4: "FBとクエスト発行でチームを前に進められる。",
  mgmt_5: "マネージャーテストに合格し、プロジェクトを任される準備ができている。",
  mgmt_6: "仲間を迎え入れ（リファラル採用）、組織を大きくできる。",
  ai_1: "AIで何ができて、何ができないかを知っている。",
  ai_2: "AIへの指示を工夫し、実際の実験で使ってみる。",
  ai_3: "日々の業務でAIを当たり前に使いこなしている。",
  ai_4: "AIを使った実験で、実際に結果を良くできる。",
  ai_5: "繰り返しの業務を1つ、AIで自動化した実績がある。",
  ai_6: "AIの仕組み（ツール・フロー）を自分で作り上げた。隠された称号。",
};

export type CondGuide = { how: string; href?: string; cta?: string };

const EXP_JA: Record<string, string> = { cause: "原因分析", hypothesis: "仮説思考", improve: "改善力" };

/** 条件 → どこで何をすると進むか（タップで href へ） */
export function condGuide(c: CondState): CondGuide {
  const p = c.param ?? "";
  switch (c.type) {
    case "content_category": return { how: `学習コンテンツで「${p}」の動画・資料を見て、完了報告する`, href: "/learn", cta: "学習コンテンツへ" };
    case "test_flag": return { how: "テストページで受験する（合格で達成）", href: "/tests", cta: "テストへ" };
    case "script_test": return { how: "スクリプト練習でテストに合格する", href: "/script-practice", cta: "スクリプト練習へ" };
    case "any_of": return { how: "テストページで受験する（CBは営業テスト、IPはスクリプトテスト）", href: "/tests", cta: "テストへ" };
    case "journey_step": return { how: `冒険マップのSTEP${c.threshold}を提出して、承認をもらう`, href: "/journey", cta: "冒険マップへ" };
    case "rookie_block": return { how: `一人前チャレンジ「${p}」の課題を全部クリアする`, href: "/rookie", cta: "一人前チャレンジへ" };
    case "report_days": return { how: "日報を提出した日数。毎日の日報で進む", href: "/report", cta: "日報を書く" };
    case "experiments_created": return { how: "日報を出したあと「明日の実験」を登録すると＋1", href: "/report", cta: "日報を書く" };
    case "experiments_reviewed": return { how: "翌日の日報で、前日の実験に結果（良くなった／同じ／悪くなった）をつけると＋1", href: "/report", cta: "日報を書く" };
    case "experiments_good": return { how: "実験の結果で「良くなった」を選ぶと＋1", href: "/report", cta: "日報を書く" };
    case "experiments_ai": return { how: "実験を登録するとき「🤖 AIを使って実験する」にチェック", href: "/report", cta: "日報を書く" };
    case "experiments_ai_good": return { how: "AIを使った実験で「良くなった」を選ぶと＋1", href: "/report", cta: "日報を書く" };
    case "experiments_from_fb": return { how: "FBをもらったあと、そのFBをもとに実験を登録する", href: "/report", cta: "日報を書く" };
    case "skill_log_count": return p === "cause"
      ? { how: "日報で「うまくいかなかった原因」を書くと原因分析＋1回", href: "/report", cta: "日報を書く" }
      : { how: "日報の実験・振り返りで記録される", href: "/report", cta: "日報を書く" };
    case "skill_exp": return p === "cause" ? { how: "原因分析EXP：日報で原因を書く＋2、FBをもとにした実験＋5", href: "/report", cta: "日報を書く" }
      : p === "hypothesis" ? { how: "仮説思考EXP：実験を登録＋5、「良くなった」＋5", href: "/report", cta: "日報を書く" }
      : p === "improve" ? { how: "改善力EXP：実験の結果を記録（振り返り）＋10", href: "/report", cta: "日報を書く" }
      : { how: `${EXP_JA[p] ?? "思考"}EXPは日報の実験・振り返りでたまる`, href: "/report", cta: "日報を書く" };
    case "fb_requested": return { how: "日報を書いたあと「FBをお願いする」を押す", href: "/report", cta: "日報を書く" };
    case "fb_focused": return { how: "FB依頼のとき「特に見てほしいこと」を書いて依頼する（＝聞きたいことを言葉にする）", href: "/report", cta: "日報を書く" };
    case "fb_responded": return { how: "メンターとして、届いたFB依頼に返信する", href: "/fb/inbox", cta: "FB受信箱へ" };
    case "quests_issued": return { how: "FBを返すとき「クエストを発行」にチェック", href: "/fb/inbox", cta: "FB受信箱へ" };
    case "thanks_sent": return { how: "仲間にサンキューを送る", href: "/thanks", cta: "サンキューへ" };
    case "thanks_received": return { how: "仲間からサンキューをもらう（日々の行動が大事）", href: "/thanks", cta: "サンキューへ" };
    case "schedule_days": return { how: "「今日の予定」で朝・昼・夜のQuestを立てて確定する", href: "/today-schedule", cta: "今日の予定へ" };
    case "schedule_done_days": return { how: "立てた予定を全部◯にした日が増えると進む", href: "/today-schedule", cta: "今日の予定へ" };
    case "profile_filled": return { how: "プロフィールでMBTI・部活・趣味を入力する", href: "/profile", cta: "プロフィールへ" };
    case "sales_count": return { how: "獲得すると管理者が登録します（獲得報告を忘れずに）" };
    case "license": return { how: "営業免許は研修を受けると管理者から付与されます" };
    case "referral_hire": return { how: "友人を紹介して、採用につなげる", href: "/recruit", cta: "リファラルへ" };
    case "mentor_check": return { how: "他の条件を全部満たしたら「メンター認定を申請」。メンターが確認して承認します" };
    case "claim_approved": return { how: "やったことをテキスト／URLで申告。管理者が確認して承認します" };
    case "thinking_sessions": return { how: "AI作戦会議（現在停止中）" };
    case "personal_tasks_done": return { how: "個人タスク（現在停止中）" };
    case "routine_streak": return { how: "ルーティン（現在停止中）" };
    default: return { how: "" };
  }
}
