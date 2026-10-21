#!/usr/bin/env python3
"""GPT の髪シート（左：正面に髪を乗せた素体、右：後ろ姿）から hair_front / hair_back を切り出す。
使い方: python3 tools/avatar_hair.py <sheet.png> <hairId> <color> [--body public/avatar/body/f__light.png]
 front: 左半分を素体に拡縮合わせ → 素体と同じ画素を透明化（＝髪だけ）
 back : 右半分を同様に合わせ、正面の髪と重ならない「頭の輪郭の外側＋肩より下」部分を後ろ髪として採用"""
import argparse
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage
ap=argparse.ArgumentParser(); ap.add_argument("src"); ap.add_argument("hair"); ap.add_argument("color"); ap.add_argument("--body",default="public/avatar/body/f__light.png")
a=ap.parse_args()
sh=Image.open(a.src).convert("RGBA"); W,H=sh.size
left=sh.crop((0,0,W//2,H)); right=sh.crop((W//2,0,W,H))
bd=Image.open(a.body).convert("RGBA"); B=np.array(bd).astype(int); vis=B[:,:,3]>200
def bb(i):
    m=np.array(i)[:,:,3]>10; ys,xs=np.where(m); return xs.min(),xs.max(),ys.min(),ys.max()
def fit(img):
    # 正方形キャンバスに置いてから、足元・中心を素体に合わせる
    sq=Image.new("RGBA",(max(img.size),)*2,(0,0,0,0)); sq.paste(img,((sq.width-img.width)//2,(sq.height-img.height)//2))
    d=sq.resize((1024,1024),Image.LANCZOS); bx,dx=bb(bd),bb(d); s=(bx[3]-bx[2])/(dx[3]-dx[2]); w=int(round(1024*s)); sm=d.resize((w,w),Image.LANCZOS)
    cxb=(bx[0]+bx[1])/2; cxd=(dx[0]+dx[1])/2*s
    out=Image.new("RGBA",(1024,1024),(0,0,0,0)); out.alpha_composite(sm,(int(round(cxb-cxd)),int(round(bx[3]-dx[3]*s)))); return out
# 髪は頭頂より上に伸びるので、足元基準の拡縮のため bbox 上端は髪込み。足元と左右中心だけ使う → fit 内で高さ比に髪が入るのを避けるため、素体の高さ比は使わず幅で合わせ直す
import cv2
def fit_w(img):
    """素体の顔（両目）をテンプレートにして、拡縮＋平行移動を推定する"""
    sq=Image.new("RGBA",(max(img.size),)*2,(0,0,0,0)); sq.paste(img,((sq.width-img.width)//2,(sq.height-img.height)//2))
    d=sq.resize((1024,1024),Image.LANCZOS)
    bg=np.array(bd.convert("RGB")); dg=np.array(d.convert("RGB"))
    # 素体の目領域（固定）：目の周り
    ty0,ty1,tx0,tx1=330,440,360,660
    tpl=cv2.cvtColor(bg[ty0:ty1,tx0:tx1],cv2.COLOR_RGB2GRAY)
    best=None
    for s in np.arange(0.70,1.12,0.01):
        w=int(round(1024*s)); dr=cv2.resize(dg,(w,w),interpolation=cv2.INTER_AREA); g=cv2.cvtColor(dr,cv2.COLOR_RGB2GRAY)
        if g.shape[0]<tpl.shape[0] or g.shape[1]<tpl.shape[1]: continue
        r=cv2.matchTemplate(g,tpl,cv2.TM_CCOEFF_NORMED); _,mv,_,ml=cv2.minMaxLoc(r)
        if best is None or mv>best[0]: best=(mv,s,ml)
    mv,s,(mx,my)=best; return place(img,s,(tx0-mx,ty0-my)),(round(float(s),3),(tx0-mx,ty0-my))
def place(img,s,off):
    sq=Image.new("RGBA",(max(img.size),)*2,(0,0,0,0)); sq.paste(img,((sq.width-img.width)//2,(sq.height-img.height)//2))
    w=int(round(1024*s)); sm=sq.resize((w,w),Image.LANCZOS)
    out=Image.new("RGBA",(1024,1024),(0,0,0,0)); out.alpha_composite(sm,off); return out
F,(sF,off)=fit_w(left)
# 後ろ姿：シート内の左右位置が揃っていないので、同じ拡縮で「足元と左右中心」を素体に合わせる
def place_back(img,s):
    sq=Image.new("RGBA",(max(img.size),)*2,(0,0,0,0)); sq.paste(img,((sq.width-img.width)//2,(sq.height-img.height)//2))
    w=int(round(1024*s)); sm=sq.resize((w,w),Image.LANCZOS)
    m=np.array(sm)[:,:,3]>10; ys=np.where(m.any(axis=1))[0]; fy=ys.max(); band=m[fy-30:fy]; xs=np.where(band.any(axis=0))[0]; fcx=(xs.min()+xs.max())/2
    bys=np.where(vis.any(axis=1))[0]; bfy=bys.max(); bband=vis[bfy-30:bfy]; bxs=np.where(bband.any(axis=0))[0]; bcx=(bxs.min()+bxs.max())/2
    out=Image.new("RGBA",(1024,1024),(0,0,0,0)); out.alpha_composite(sm,(int(round(bcx-fcx)),int(round(bfy-fy)))); return out
R=place_back(right,sF); sR=sF
def hair_only(img):
    A=np.array(img).astype(int); same=vis&(np.abs(A[:,:,:3]-B[:,:,:3]).sum(axis=2)<70)
    al=A[:,:,3].copy(); al[same]=0
    m=ndimage.binary_opening(al>40,iterations=2); lab,k=ndimage.label(m)
    if k: sizes=ndimage.sum(m,lab,range(1,k+1)); keep=np.isin(lab,[i+1 for i,s in enumerate(sizes) if s>1500]); al[~keep]=0
    out=img.copy(); out.putalpha(Image.fromarray(al.astype("uint8")).filter(ImageFilter.MedianFilter(3))); return out
front=hair_only(F)
# 後ろ髪：後ろ姿画像のうち、正面髪で覆われていない部分（素体の頭の内側は除く＝素体で隠れるので不要）
RA=np.array(R).astype(int); fa=np.array(front)[:,:,3]>30
# 後ろ姿は素体の肌も見える（耳など）：素体と同色を除く
same=vis&(np.abs(RA[:,:,:3]-B[:,:,:3]).sum(axis=2)<70)
r,g,b_=RA[:,:,0],RA[:,:,1],RA[:,:,2]
skin=(r>185)&(g>140)&(b_>115)&(r-b_>20)&(r-b_<95)&(g>=b_)&(r>=g)          # 肌・白インナーは後ろ髪に不要
white=(r>225)&(g>220)&(b_>210)
al=RA[:,:,3].copy(); al[same|skin|white]=0; al[fa]=0
# 髪色の判定：後ろ髪は髪色に近い画素だけ残す（素体の輪郭線・肌の縁取りを除去）
hairish=(np.abs(r-g)>12)|(r<150)   # 茶系：赤>緑 の差がある、または暗い
al[~hairish]=0
# 頭の内側（素体で隠れる領域）は落として軽くする
head=ndimage.binary_erosion(vis,iterations=6); al[head]=0
# 頭の輪郭のすぐ外側（耳の縁取りが残る帯）：頭の高さ範囲では素体から 14px 膨らませた分も落とす
yy=np.arange(1024)[:,None]; ring=ndimage.binary_dilation(vis,iterations=14)&(yy<520); al[ring]=0
m=ndimage.binary_opening(al>40,iterations=2); lab,k=ndimage.label(m)
# 細い弧（後ろ姿の耳の輪郭）を除去：面積が小さい、または塗りつぶし率が低い成分は捨てる
if k:
    keep_ids=[]
    for i in range(1,k+1):
        comp=lab==i; area=comp.sum()
        if area<2500: continue
        ys,xs=np.where(comp); fill=area/((ys.max()-ys.min()+1)*(xs.max()-xs.min()+1))
        if area<12000 and fill<0.35: continue
        keep_ids.append(i)
    keep=np.isin(lab,keep_ids); al[~keep]=0
back=R.copy(); back.putalpha(Image.fromarray(al.astype("uint8")).filter(ImageFilter.MedianFilter(3)))
front.save(f"public/avatar/hair_front/{a.hair}__{a.color}.png"); back.save(f"public/avatar/hair_back/{a.hair}__{a.color}.png")
print("saved",a.hair,a.color,"scale",round(sF,3),round(sR,3))
