"use client";
// Intern Quest 2.0 タイトル画面の背景シーン。
// 既存の利用許諾済み素材（public/world/*）を軽量化した public/login/*.webp を使う。
// 文字・ボタンは一切含まない（HTML 側で描く）。動きは雲の流れと浮島のわずかな上下だけで、
// prefers-reduced-motion のときはすべて静止する。

const CSS = `
.iq-scene{position:fixed;inset:0;overflow:hidden;background:#79c0ee;z-index:0;pointer-events:none}
.iq-sky{position:absolute;inset:0;background:url(/login/sky.webp) center 30%/cover no-repeat}
.iq-sky::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,0) 55%,rgba(255,248,225,.55) 100%)}
.iq-far{position:absolute;width:150px;height:auto;opacity:.9;filter:saturate(.9)}
.iq-far.a{left:3%;top:9%;width:120px;animation:iqBob 9s ease-in-out infinite}
.iq-far.b{right:4%;top:14%;width:140px;animation:iqBob 11s ease-in-out infinite reverse}
.iq-far.c{left:12%;top:58%;width:110px;opacity:.75;animation:iqBob 10s ease-in-out infinite 1.5s}
.iq-cloud{position:absolute;height:auto;opacity:.95;will-change:transform}
.iq-cloud.c1{width:360px;top:6%;left:-10%;animation:iqDrift 70s linear infinite}
.iq-cloud.c2{width:240px;top:40%;left:-8%;opacity:.8;animation:iqDrift 95s linear infinite 20s}
.iq-cloud.c3{width:300px;top:70%;left:-12%;opacity:.9;animation:iqDrift 80s linear infinite 45s}
.iq-cloud.w1{width:260px;top:24%;left:-5%;opacity:.7;animation:iqDrift 60s linear infinite 10s}
.iq-ground{position:absolute;left:0;right:0;bottom:-6vh;height:38vh;background:url(/login/cloud.webp) center bottom/120% auto no-repeat;opacity:.9}
@keyframes iqDrift{from{transform:translateX(0)}to{transform:translateX(125vw)}}
@keyframes iqBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes iqFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@media (max-width:640px){
  .iq-far.a{width:84px;top:7%}.iq-far.b{width:96px;top:11%}.iq-far.c{display:none}
  .iq-cloud.c1{width:220px}.iq-cloud.c2{width:160px;top:46%}.iq-cloud.c3{width:200px;top:66%}.iq-cloud.w1{width:180px}
  .iq-ground{height:26vh;background-size:160% auto}
}
@media (prefers-reduced-motion:reduce){
  .iq-far,.iq-cloud,.iq-castle{animation:none !important}
  .iq-cloud.c1{left:8%}.iq-cloud.c2{left:62%}.iq-cloud.c3{left:30%}.iq-cloud.w1{left:55%}
}
`;

export default function TitleScene() {
    return (
        <div className="iq-scene" aria-hidden="true">
            <style>{CSS}</style>
            <div className="iq-sky" />
            <img className="iq-far a" src="/login/far_a.webp" alt="" decoding="async" />
            <img className="iq-far b" src="/login/far_b.webp" alt="" decoding="async" />
            <img className="iq-far c" src="/login/far_c.webp" alt="" decoding="async" />
            <img className="iq-cloud w1" src="/login/wisp.webp" alt="" decoding="async" />
            <img className="iq-cloud c1" src="/login/cloud.webp" alt="" decoding="async" />
            <img className="iq-cloud c2" src="/login/cloud.webp" alt="" decoding="async" />
            <img className="iq-cloud c3" src="/login/cloud.webp" alt="" decoding="async" />
            <div className="iq-ground" />
        </div>
    );
}
