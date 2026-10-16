// デザイン画像（PC/スマホ）を画面いっぱいに敷き、画像内のパネル位置に実フォームを重ねるための配置計算。
// /login と /register で共用。
export type Art = { src: string; w: number; h: number; panel: { l: number; t: number; w: number; h: number } };
export type ArtSet = { pc: Art; mobile: Art };
export type Stage = { kind: "pc" | "mobile"; s: number; x: number; y: number; vw: number; vh: number };
export const MOBILE_MAX = 900;

export function computeStage(arts: ArtSet, vw: number, vh: number): Stage {
    const kind = vw < MOBILE_MAX ? "mobile" : "pc";
    const a = arts[kind];
    let s = Math.max(vw / a.w, vh / a.h);                       // cover
    // パネルが画面外に出るときは縮める（横長PCで窓が狭いとき等）
    const pr = a.panel.l + a.panel.w, pb = a.panel.t + a.panel.h;
    s = Math.min(s, vw / (2 * a.w * Math.max(pr - 0.5, 0.01)), vh / (2 * a.h * Math.max(pb - 0.5, 0.01)));
    s = Math.min(s, vw / (2 * a.w * Math.max(0.5 - a.panel.l, 0.01)));
    const sw = a.w * s, sh = a.h * s;
    return { kind, s, x: (vw - sw) / 2, y: (vh - sh) / 2, vw, vh };
}

/** パネル（フォーム）の画面上の位置・大きさ */
export function panelRect(arts: ArtSet, st: Stage) {
    const a = arts[st.kind];
    const left = st.x + a.panel.l * a.w * st.s, top = st.y + a.panel.t * a.h * st.s;
    return { left, top, width: a.panel.w * a.w * st.s, minHeight: a.panel.h * a.h * st.s, maxHeight: st.vh - top - 8 };
}
