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
    hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV).astype(float)
    bh,bs,bv=cv2.cvtColor(np.uint8([[hexrgb(BASE)]]),cv2.COLOR_RGB2HSV)[0,0].astype(float)
    th,ts,tv=cv2.cvtColor(np.uint8([[hexrgb(target)]]),cv2.COLOR_RGB2HSV)[0,0].astype(float)
    hsv[:,:,0]=th
    hsv[:,:,1]=np.clip(hsv[:,:,1]*(ts/max(bs,1)),0,255)
    hsv[:,:,2]=np.clip(hsv[:,:,2]*(tv/max(bv,1)),0,255)
    out=cv2.cvtColor(hsv.astype(np.uint8),cv2.COLOR_HSV2RGB); a[:,:,:3]=out
    return Image.fromarray(a)
for layer in ("hair_front","hair_back"):
    for f in glob.glob(f"public/avatar/{layer}/*__brown.png"):
        im=Image.open(f)
        for name,hx in COLORS.items():
            recolor(im,hx).save(f.replace("__brown.png",f"__{name}.png"))
print("done")
