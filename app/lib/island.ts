// 島まわりの共通定数（Phase 1：islands / IslandHero / HomeIsland で重複していたものを集約）
// 表示サイズなど画面ごとに違う値はここに置かず、各コンポーネントの preset に持たせる

export { getHouseStage } from "../components/DotHouse";

/** 冒険マップ STEP の名前（0〜6） */
export const STEP_TITLE: Record<number, string> = { 0: "冒険の始まり", 1: "入社・研修", 2: "登竜門", 3: "プレイヤー昇格", 4: "DRMスタート", 5: "キャリア面談", 6: "営業デビュー" };

/** 家6段階の画像（getHouseStage().idx で引く） */
export const HOUSE_IMG: string[] = ["/island/house/0_tent.png", "/island/house/1_cabin.png", "/island/house/2_house.png", "/island/house/3_big.png", "/island/house/4_mansion.png", "/island/house/5_castle.png"];

/** 累計pt → レベル（100pt で 1Lv） */
export function getLevel(totalEarned: number): number { return Math.floor((totalEarned || 0) / 100) + 1; }

export const DEFAULT_AVATAR_ID = "girl_bob_brown";
export function avatarIdOf(avatarConfig: any): string { return avatarConfig && avatarConfig.id ? String(avatarConfig.id) : DEFAULT_AVATAR_ID; }
export function avatarSrc(avatarId: string): string { return "/avatars/" + avatarId + ".png"; }

/** island_config のキー → 絵文字（画像が無いアイテムの表示用） */
export const TREE_EMOJI: Record<string, string> = { tree_sakura: "🌸", tree_yashi: "🌴", tree_momi: "🎄", tree_momiji: "🍁" };
export const DECO_EMOJI: Record<string, string> = { deco_funsui: "⛲", deco_bench: "🪑", deco_gaitou: "💡", deco_yukidaruma: "⛄", deco_torii: "⛩️" };
export const SKY_EMOJI: Record<string, string> = { sky_niji: "🌈", sky_chocho: "🦋", sky_fuusen: "🎈" };
export const ANIMAL_EMOJI: Record<string, string> = { animal_neko: "🐈", animal_inu: "🐕" };
export const ANIMAL_NAME: Record<string, string> = { animal_neko: "ねこ", animal_inu: "いぬ" };

/** 夜の島（みんなの島・プロフィール）の地面グラデーション */
export const GROUND_BG: Record<string, string> = {
    ground_hanabatake: "linear-gradient(180deg, #86efac, #4ade80)",
    ground_yukihara: "linear-gradient(180deg, #f8fafc, #cbd5e1)",
    ground_sunahama: "linear-gradient(180deg, #fde68a, #f59e0b)",
    ground_momiji: "linear-gradient(180deg, #fdba74, #ea580c)",
};
/** 昼の島（home）の上面グラデーション */
export const GROUND_TOP: Record<string, string> = {
    ground_hanabatake: "linear-gradient(180deg, #a3e88a, #6cc255)",
    ground_yukihara: "linear-gradient(180deg, #f4f9ff, #d3e3f2)",
    ground_sunahama: "linear-gradient(180deg, #fbe6a8, #ecc264)",
    ground_momiji: "linear-gradient(180deg, #f6b878, #e07d3a)",
};

/** 画像があるアイテム（home の島とショップ一覧で使用） */
export const TREE_IMG: Record<string, string> = { tree_sakura: "/island/trees/tree_sakura.png" };
export const DECO_IMG: Record<string, string> = { deco_funsui: "/island/deco/deco_funsui.png" };
export const SKY_IMG: Record<string, string> = { sky_niji: "/island/sky/sky_niji.png" };
export const GROUND_IMG: Record<string, string> = { ground_hanabatake: "/island/ground/ground_hanabatake.png" };
export const ANIMAL_IMG: Record<string, string> = { animal_neko: "/island/animals/cat.png", animal_inu: "/island/animals/dog.png" };
export const ITEM_IMG: Record<string, string> = { ...TREE_IMG, ...DECO_IMG, ...SKY_IMG, ...GROUND_IMG, ...ANIMAL_IMG };

export type IslandConfig = Record<string, string>;
