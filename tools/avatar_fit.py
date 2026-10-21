#!/usr/bin/env python3
"""GPT が「素体に着せた」画像から、衣装レイヤーを切り出す。
使い方: python3 tools/avatar_fit.py <dressed.png> <out.png> [--body public/avatar/body/f__light.png] [--neck 470]
 1) 1024 に揃え、足元・左右中心を素体に合わせて拡縮  2) 素体と同じ画素（肌など）と首より上を透明化"""
import sys, argparse
from PIL import Image, ImageFilter
import numpy as np
ap=argparse.ArgumentParser(); ap.add_argument("src"); ap.add_argument("dst"); ap.add_argument("--body",default="public/avatar/body/f__light.png"); ap.add_argument("--neck",type=int,default=470); ap.add_argument("--keep-head",action="store_true")
a=ap.parse_args()
src=Image.open(a.src).convert("RGBA"); d=src.resize((1024,1024),Image.LANCZOS); bd=Image.open(a.body).convert("RGBA")
import cv2
# 顔（両目）のテンプレートで拡縮と位置を求める（GPT は顔を変えないので、これが最も正確）
bg=np.array(bd.convert("RGB")); ty0,ty1,tx0,tx1=330,440,360,660
tpl=cv2.cvtColor(bg[ty0:ty1,tx0:tx1],cv2.COLOR_RGB2GRAY)
sq=Image.new("RGBA",(max(src.size),)*2,(0,0,0,0)); sq.paste(src,((sq.width-src.width)//2,(sq.height-src.height)//2))
dg=np.array(sq.resize((1024,1024),Image.LANCZOS).convert("RGB")); best=None
for s_ in np.arange(0.70,1.12,0.01):
    w=int(round(1024*s_)); g=cv2.cvtColor(cv2.resize(dg,(w,w),interpolation=cv2.INTER_AREA),cv2.COLOR_RGB2GRAY)
    if g.shape[0]<tpl.shape[0]: continue
    r=cv2.matchTemplate(g,tpl,cv2.TM_CCOEFF_NORMED); _,mv,_,ml=cv2.minMaxLoc(r)
    if best is None or mv>best[0]: best=(mv,s_,ml)
_,s,(mx,my)=best; w=int(round(1024*s)); sm=sq.resize((w,w),Image.LANCZOS)
fit=Image.new("RGBA",(1024,1024),(0,0,0,0)); fit.alpha_composite(sm,(tx0-mx,ty0-my))
A=np.array(fit).astype(int); B=np.array(bd).astype(int); vis=B[:,:,3]>200
skinB=(B[:,:,0]>170)&(B[:,:,0]-B[:,:,2]>20)&(B[:,:,1]>=B[:,:,2])   # 素体の肌色だけ
same=vis&skinB&(np.abs(A[:,:,:3]-B[:,:,:3]).sum(axis=2)<60)
# 首より下は GPT が描いた画素をすべて残す（露出した肩などが素体のインナーを隠す）。頭だけ素体に任せる
mask=np.zeros_like(same) if a.keep_head else ((np.arange(1024)[:,None]<a.neck)&vis)
al=A[:,:,3].copy(); al[mask]=0
fit.putalpha(Image.fromarray(al.astype("uint8")).filter(ImageFilter.MedianFilter(3)))
fit.save(a.dst); print("saved",a.dst,"scale",round(s,3))
