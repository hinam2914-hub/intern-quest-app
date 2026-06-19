// DotKunが日報の中身を読んでゆるく返すルールベースのフィードバック生成。
// 方針: 数字を拾う / キーワードに反応 / streakで褒める / 明日の一歩を1つ / 短い・ため口。

export type DotKunFeedback = { mood: "happy" | "cheer" | "normal"; lines: string[] };

export function generateDotKunFeedback(params: {
  factText: string;
  interpText: string;
  actionText: string;
  streak: number;
}): DotKunFeedback {
  const { factText, interpText, actionText, streak } = params;
  const all = `${factText} ${interpText} ${actionText}`;
  const lines: string[] = [];
  let mood: DotKunFeedback["mood"] = "normal";

  // 1) streakを褒める（節目で強めに）
  if (streak >= 30) { lines.push(`${streak}日連続だって…！？もう完全に習慣の鬼だね、尊敬する〜`); mood = "cheer"; }
  else if (streak >= 14) { lines.push(`${streak}日連続！2週間以上続いてるの、ほんとすごいよ`); mood = "cheer"; }
  else if (streak >= 7) { lines.push(`${streak}日連続〜！1週間突破、いい流れだね`); mood = "happy"; }
  else if (streak >= 3) { lines.push(`${streak}日連続だ！この調子この調子`); mood = "happy"; }
  else if (streak === 1) { lines.push(`今日も書いてくれてありがとう！まずは1日、ここからだよ`); mood = "happy"; }
  else { lines.push(`今日もお疲れさま〜！ちゃんと書いてえらい`); mood = "happy"; }

  // 2) 数字の有無で反応（意味は読めないので件数などには踏み込まない）
  const hasNumber = /\d/.test(factText);
  if (hasNumber) {
    lines.push(`数字を入れて振り返れてるの、すごくいいね。続けてこ〜`);
  } else {
    lines.push(`次はできれば数字も1個入れてみて。振り返りが一気に鋭くなるよ`);
  }

  // 3) キーワードに反応
  if (/失敗|できなかった|ダメ|うまくいかな|難し|落ち込|凹/.test(all)) {
    lines.push(`うまくいかない日もあるよ。でも原因まで書けてるなら、それもう半分解決してるからね`);
  } else if (/達成|できた|うまく|成功|アポ|受注|契約/.test(all)) {
    lines.push(`できたこと、しっかり言葉にできてるの最高。明日もこの感覚で〜`);
    if (mood !== "cheer") mood = "happy";
  }

  // 4) 明日の一歩（actionTextの有無で出し分け）
  if (actionText.trim().length >= 10) {
    lines.push(`明日の作戦も書けてるね。1個でいいからまず試してみよ`);
  } else {
    lines.push(`明日「これ1個だけやる」を決めとくと、朝の動き出しが速くなるよ`);
  }

  return { mood, lines };
}
