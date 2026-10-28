// Intern Quest 2.0｜マイページの見た目（青・白・金のゲームUI）。データ処理は page.tsx 側をそのまま使う。
// 背景・アイコンは GPT 素材が届くまで既存素材／絵文字で仮置き（public/mypage/ に置けば差し替え）。
export const MYPAGE_CSS = `
.mp-root{background:#c9a97a url(/mypage/room_pc.webp) center top/cover no-repeat fixed;color:#2b2416}
.mp-root *{box-sizing:border-box}
.mp-header{position:sticky;top:0;z-index:40;margin:0 -16px 14px;padding:10px 16px calc(10px);display:flex;align-items:center;gap:14px;background:linear-gradient(180deg,#1f3f8f,#15306f);border-bottom:3px solid #e8c45a;box-shadow:0 6px 16px rgba(10,30,80,.35)}
.mp-logo{font-family:Georgia,"Times New Roman",serif;font-weight:900;font-size:15px;line-height:1;color:#ffe08a;text-shadow:0 1px 0 #7a4e05;border:2px solid #e8c45a;border-radius:10px;padding:5px 8px;background:rgba(0,0,0,.2)}
.mp-htitle{flex:1;font-size:20px;font-weight:900;color:#fff;letter-spacing:.06em;line-height:1}
.mp-htitle small{display:block;font-size:10px;letter-spacing:.3em;color:#bcd3ff;margin-top:3px}
.mp-hbtns{display:flex;gap:8px}
.mp-hbtns button{position:relative;width:40px;height:40px;border-radius:50%;border:2px solid #e8c45a;background:#fff;font-size:18px;cursor:pointer}
.mp-hbtns button i{position:absolute;top:2px;right:2px;width:10px;height:10px;border-radius:50%;background:#ef4444;border:2px solid #fff}
.mp-ribbon{display:inline-block;background:linear-gradient(180deg,#4d9af5,#2458c7);color:#fff;font-weight:900;font-size:15px;letter-spacing:.06em;border:2px solid #e8c45a;border-radius:12px;padding:6px 20px;box-shadow:0 4px 10px rgba(36,88,199,.35);margin:-26px 0 12px 6px;position:relative}
.mp-ribbon small{font-size:9px;letter-spacing:.25em;margin-left:8px;color:#dbe8ff}
.mp-panel{position:relative;background:linear-gradient(180deg,#fffdf4,#f6ead0);border:3px solid #d8b55e;border-radius:22px;padding:22px 16px 16px;box-shadow:0 0 0 3px rgba(255,255,255,.5),0 12px 26px rgba(30,60,120,.22);margin:26px 0 0}
.mp-noav{color:#8a6a2b;font-weight:900;text-align:center;padding:30px 0;font-size:13px}
.mp-edit-av{margin-top:10px;border:2px solid #e8c45a;background:linear-gradient(180deg,#fffdf4,#f6ead0);color:#17397d;font-weight:900;border-radius:999px;padding:9px 18px;cursor:pointer;font-family:inherit;font-size:14px;box-shadow:0 4px 10px rgba(30,60,120,.25)}
.mp-shield{flex:none;width:86px;height:96px;background:linear-gradient(160deg,#9b6cf0,#5b2bb8);border:3px solid #e8c45a;border-radius:16px 16px 44px 44px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;box-shadow:0 6px 14px rgba(60,20,140,.35)}
.mp-shield span{font-size:11px;font-weight:900;opacity:.9}.mp-shield b{font-size:26px;font-weight:900;line-height:1.05}
.mp-name{font-size:clamp(20px,2.2vw,28px);font-weight:900;color:#2b2416}.mp-name span{font-size:.6em;margin-left:4px}
.mp-jobchip{display:inline-block;margin-top:6px;background:linear-gradient(180deg,#1f3f8f,#15306f);color:#fff;font-weight:900;font-size:13px;border:2px solid #e8c45a;border-radius:999px;padding:4px 14px}
.mp-exp{display:flex;align-items:baseline;gap:8px;margin-top:10px;font-weight:900;flex-wrap:wrap}.mp-exp span{white-space:nowrap}.mp-exp b{color:#1f9e4e;font-size:13px}.mp-exp span{font-size:15px;color:#2b2416}.mp-exp em{font-style:normal;font-size:11px;color:#8a6a2b;margin-left:auto}
.mp-expbar{height:14px;border-radius:999px;background:#e6dcc4;border:2px solid #d8b55e;overflow:hidden;margin-top:6px}.mp-expbar>div{height:100%;background:linear-gradient(90deg,#4bd37b,#1f9e4e);transition:width 1s ease}

.mp-grid{display:grid;grid-template-columns:1fr 1fr minmax(220px,300px);gap:16px;align-items:start;margin-top:6px}
.mp-p-profile{grid-column:1}.mp-p-status{grid-column:2}.mp-p-growth{grid-column:1}.mp-p-col{grid-column:2}
.mp-side{grid-column:3;grid-row:1 / span 2;display:flex;flex-direction:column;gap:10px;align-items:stretch;position:sticky;top:76px}
.mp-side-luku{width:62%;align-self:center;filter:drop-shadow(0 8px 8px rgba(0,0,0,.25));animation:mp-bob 2.4s ease-in-out infinite}
.mp-sidebtn{height:50px;border-radius:999px;border:3px solid #e8c45a;background:linear-gradient(180deg,#fffdf4,#f6ead0);color:#17397d;font-weight:900;font-size:16px;cursor:pointer;font-family:inherit;box-shadow:0 6px 14px rgba(30,60,120,.22)}
.mp-sidebtn:hover{filter:brightness(1.03)}
.mp-side .mp-bigbtn{margin:0;height:50px;font-size:17px}
.mp-side .mp-tiles{grid-template-columns:1fr;gap:8px;margin-top:4px;background:linear-gradient(180deg,#fffdf4,#f6ead0);border:3px solid #d8b55e;border-radius:18px;padding:10px;box-shadow:0 8px 18px rgba(30,60,120,.18)}
.mp-side .mp-tile{flex-direction:row;justify-content:flex-start;gap:12px;padding:10px 12px;border-width:2px;box-shadow:none;border-radius:14px}
.mp-side .mp-tile-ic{font-size:26px}.mp-side .mp-tile-l{font-size:14.5px}
.mp-prof{display:grid;grid-template-columns:minmax(140px,46%) 1fr;gap:12px;align-items:center}
.mp-prof-av{width:100%;filter:drop-shadow(0 8px 8px rgba(0,0,0,.2))}
.mp-prof-info{display:flex;flex-direction:column;gap:6px;min-width:0}
.mp-colgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.mp-colitem{background:#fffffb;border:2px solid #e7dcc0;border-radius:14px;padding:10px 4px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px}
.mp-colitem span{font-size:28px;line-height:1}.mp-colitem small{font-size:10.5px;font-weight:900;color:#5a3d12;line-height:1.2}
.mp-colfoot{display:flex;justify-content:space-between;align-items:center;margin-top:10px}.mp-colfoot>span{font-size:13px;font-weight:900;color:#2458c7}.mp-colfoot .mp-smallbtn{margin-top:0}
.mp-p-profile .mp-shield{width:70px;height:78px}.mp-p-profile .mp-shield b{font-size:22px}
.mp-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.mp-stat{background:#fffffb;border:2px solid #e7dcc0;border-radius:16px;padding:12px 6px;text-align:center}
.mp-stat-ic{font-size:28px;line-height:1}.mp-stat-l{font-size:11px;font-weight:900;color:#5a3d12;margin-top:6px}.mp-stat-v{font-size:clamp(15px,1.4vw,20px);font-weight:900;color:#2b2416;margin-top:2px}
.mp-growth>div>button:last-child{display:none}
.mp-growth>div{background:transparent!important;box-shadow:none!important;border:0!important;margin-bottom:0!important;padding:0!important}
.mp-bigbtn{display:block;width:100%;max-width:640px;margin:12px auto 0;height:54px;border-radius:999px;border:3px solid #e8c45a;font-family:inherit;font-weight:900;font-size:18px;letter-spacing:.06em;color:#fff;cursor:pointer;background:linear-gradient(180deg,#4d9af5 0%,#2f6fd6 50%,#1d4fb3 100%);box-shadow:0 0 0 2px #fff6d0,0 8px 18px rgba(36,88,199,.4);transition:transform .08s}
.mp-bigbtn:hover{filter:brightness(1.06)}.mp-bigbtn:active{transform:scale(.98)}
.mp-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:18px}
.mp-tile{position:relative;background:linear-gradient(180deg,#fffdf4,#f6ead0);border:3px solid #d8b55e;border-radius:18px;padding:16px 8px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;font-family:inherit;box-shadow:0 8px 18px rgba(30,60,120,.18);transition:transform .08s}
.mp-tile:hover{transform:translateY(-2px)}.mp-tile.on{border-color:#2f6fd6;box-shadow:0 0 0 3px rgba(47,111,214,.25),0 8px 18px rgba(30,60,120,.18)}
.mp-tile.ev{background:linear-gradient(180deg,#ffe9f3,#f7d4e6)}
.mp-tile-ic{font-size:40px;line-height:1}.mp-tile-l{font-size:14px;font-weight:900;color:#2b2416}
.mp-tile-badge{position:absolute;top:-10px;right:8px;background:#ef4444;color:#fff;font-size:11px;font-weight:900;border-radius:999px;padding:3px 10px;border:2px solid #fff}
.mp-detail{margin-top:30px}
.mp-detail-raw{margin-top:14px;background:linear-gradient(180deg,#fffdf4,#f6ead0);border:3px solid #d8b55e;border-radius:22px;padding:14px;box-shadow:0 0 0 3px rgba(255,255,255,.5),0 12px 26px rgba(30,60,120,.22)}
.mp-kv{display:flex;flex-direction:column;gap:6px}
.mp-kv-row{display:flex;justify-content:space-between;align-items:center;gap:12px;background:#fffffb;border:2px solid #e7dcc0;border-radius:12px;padding:9px 14px;font-family:inherit;width:100%;text-align:left}
.mp-kv-row span{font-size:12.5px;font-weight:800;color:#8a6a2b}.mp-kv-row b{font-size:14px;font-weight:900;color:#2b2416;text-align:right}
.mp-link{cursor:pointer}.mp-link:hover{background:#e8f0ff}
.mp-smallbtn{margin-top:12px;border:2px solid #2f6fd6;background:#e8f0ff;color:#1d3f8c;font-weight:900;border-radius:999px;padding:9px 16px;cursor:pointer;font-family:inherit;font-size:13px}
.mp-colgrid .mp-empty{grid-column:1 / -1}
.mp-empty{font-size:13px;font-weight:800;color:#8a6a2b;text-align:center;padding:14px}
.mp-event .mp-ribbon{background:linear-gradient(180deg,#f472b6,#be185d)}
.mp-nav{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:none;background:transparent;color:#5a3d12;cursor:pointer;font-family:inherit}
.mp-nav.on{color:#17397d}.mp-nav.on>div:first-child{background:linear-gradient(180deg,#4d9af5,#2458c7);border:2px solid #e8c45a;border-radius:999px;padding:4px 14px;color:#fff}
@keyframes mp-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@media (max-width:860px){
  .mp-root{background-image:url(/mypage/room_mobile.webp)}
  .mp-grid{grid-template-columns:1fr;gap:12px}
  .mp-p-profile,.mp-p-status,.mp-p-growth,.mp-p-col,.mp-side{grid-column:1;grid-row:auto}
  .mp-side{display:contents}.mp-side-luku{display:none}
  .mp-p-profile{order:1}.mp-side .mp-sidebtn{order:2}.mp-p-status{order:3}.mp-p-growth{order:4}.mp-side .mp-bigbtn{order:5}.mp-p-col{order:6}.mp-side .mp-tiles{order:7}
  .mp-side .mp-tiles{grid-template-columns:1fr 1fr}.mp-side .mp-tile{flex-direction:column;gap:6px;padding:12px 6px}
  .mp-prof{grid-template-columns:minmax(110px,40%) 1fr}
  .mp-stats{grid-template-columns:repeat(2,1fr)}
  .mp-colgrid{grid-template-columns:repeat(4,1fr)}.mp-colitem span{font-size:24px}
  .mp-tile-ic{font-size:34px}
  .mp-ribbon{font-size:13.5px;padding:5px 14px;white-space:nowrap}.mp-ribbon small{display:none}
  .mp-exp{flex-wrap:wrap}.mp-exp em{width:100%;margin-left:0}
  .mp-shield{width:72px;height:82px}.mp-shield b{font-size:22px}
  .mp-header{margin-bottom:10px}
}
`;
