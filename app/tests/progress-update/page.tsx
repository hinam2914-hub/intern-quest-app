"use client";
// 進捗更新・ケアレスミス改善テスト。問題・正解はDB（test_questions）にあり、このファイルには置かない。受験画面は共通の TestRunner。
import TestRunner, { type RunnerConfig } from "../TestRunner";

const CONFIG: RunnerConfig = {
    "testKey": "progress_update",
    "title": "進捗更新・ケアレスミス改善テスト",
    "path": "/tests/progress-update",
    "written": [
        "Q16. 最近\"進捗共有不足\"で困った経験を書いてください",
        "Q17. 「報連相が弱い人」の特徴を書いてください",
        "Q18. 最近したケアレスミスと、その原因を書いてください",
        "Q19. ケアレスミスを減らすための仕組みを3つ書いてください",
        "Q20. 「信頼される進捗更新」とは何か説明してください",
        "Q21. 今の自分が\"雑になっている部分\"を書いてください"
    ],
    "writtenFormat": "qmap",
    "writtenRule": "all"
};

export default function Page() {
    return <TestRunner cfg={CONFIG} />;
}
