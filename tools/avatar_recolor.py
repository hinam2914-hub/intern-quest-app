#!/usr/bin/env python3
"""ブラウン髪のレイヤーから他の髪色を生成（明度・ツヤはそのまま、色相と彩度を目標色へ）。"""
import sys, glob, os
from PIL import Image
import numpy as np, cv2
COLORS={"black":"#2b2630","darkbrown":"#5a3a26","beige":"#d9b98f","pink":"#ee7fa6","ash":"#a8a4ad","blue":"#4c6fe0"}
BASE="#8a5a3a"
def hexrgb(h): return tuple(int(h[i:i+2],16) for i in (1,3,5))
def recolor(img,target):
    a=np.array(img.convert("RGBA")); rgb=a[:,:,:3].astype(np.uint8)
    # 元画像を「明るさだけ」にして（ハイライトの色味を捨てる）、目標色を乗せる
    gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY).astype(float)/255.0
    tr,tg,tb=[c/255.0 for c in hexrgb(target)]
    base=np.array([c/255.0 for c in hexrgb(BASE)]); bl=0.299*base[0]+0.587*base[1]+0.114*base[2]
    tl=0.299*tr+0.587*tg+0.114*tb
    # 明るさを目標色の明るさに合わせて圧縮（暗い色でもハイライトが残るようガンマ）
    ratio=tl/max(bl,0.05)
    if ratio<1: L=(gray**(1.0/(0.55+0.45*ratio)))*(0.55+0.45*ratio)
    else: L=np.clip(gray*ratio,0,1)
    # 色乗せ：目標色の比率で L を配分（soft light 風）
    t=np.array([tr,tg,tb]); tn=t/max(tl,0.05)
    out=np.clip(L[:,:,None]*tn[None,None,:],0,1)
    # 白飛び防止：L が高いところは白へ寄せる
    hi=np.clip((L-0.82)/0.18,0,1)[:,:,None]
    out=out*(1-hi)+np.minimum(out+0.18,1)*hi
    a[:,:,:3]=(out*255).astype(np.uint8)
    al=a[:,:,3].astype(float); edge=(al>0)&(al<200)
    a[:,:,3]=np.where(edge,np.clip(al*1.25,0,255),al).astype(np.uint8)
    return Image.fromarray(a)
for layer in ("hair_front","hair_back"):
    for f in glob.glob(f"public/avatar/{layer}/*__brown.png"):
        im=Image.open(f)
        for name,hx in COLORS.items():
            recolor(im,hx).save(f.replace("__brown.png",f"__{name}.png"))
print("done")
