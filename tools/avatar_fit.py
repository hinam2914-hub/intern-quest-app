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
def bb(i):
    m=np.array(i)[:,:,3]>10; ys,xs=np.where(m); return xs.min(),xs.max(),ys.min(),ys.max()
bx,dx=bb(bd),bb(d); s=(bx[3]-bx[2])/(dx[3]-dx[2]); w=int(round(1024*s)); sm=src.resize((w,w),Image.LANCZOS)
cxb=(bx[0]+bx[1])/2; cxd=(dx[0]+dx[1])/2*s
fit=Image.new("RGBA",(1024,1024),(0,0,0,0)); fit.alpha_composite(sm,(int(round(cxb-cxd)),int(round(bx[3]-dx[3]*s))))
A=np.array(fit).astype(int); B=np.array(bd).astype(int); vis=B[:,:,3]>200
same=vis&(np.abs(A[:,:,:3]-B[:,:,:3]).sum(axis=2)<60)
mask=same if a.keep_head else (same|((np.arange(1024)[:,None]<a.neck)&vis))
al=A[:,:,3].copy(); al[mask]=0
fit.putalpha(Image.fromarray(al.astype("uint8")).filter(ImageFilter.MedianFilter(3)))
fit.save(a.dst); print("saved",a.dst,"scale",round(s,3))
