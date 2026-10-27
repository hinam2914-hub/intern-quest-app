#!/usr/bin/env python3
"""前髪レイヤー（ブラウン）に残った素体の首〜肩の輪郭線（細い濃い線）を除去。
使い方: python3 tools/avatar_hair_neck.py <hairId>...（省略時は全髪型）→ clean/recolor で他色再生成"""
import sys, glob
from PIL import Image
import numpy as np
from scipy import ndimage
TOP=200
ids=sys.argv[1:] or sorted({f.split("/")[-1].split("__")[0] for f in glob.glob("public/avatar/hair_front/*__brown.png")})
for h in ids:
    body=np.array(Image.open(f"public/avatar/body/{h[0]}__light.png"))[:,:,3]>120
    edge=ndimage.binary_dilation(body,iterations=7)&~ndimage.binary_erosion(body,iterations=7)
    f=f"public/avatar/hair_front/{h}__brown.png"
    a=np.array(Image.open(f).convert("RGBA")).astype(int); al=a[:,:,3]; lum=(a[:,:,:3]*[0.299,0.587,0.114]).sum(2)
    m=np.zeros(al.shape,bool); m[TOP:]=edge
    yy=np.arange(al.shape[0])[:,None]; band=m&(yy>=TOP+470)&(yy<=TOP+620)
    thick=ndimage.binary_opening(al>80,structure=np.ones((9,9)))
    kill=band&(al>80)&(lum<105)&~thick
    kill=ndimage.binary_dilation(kill,iterations=2)&~thick&band
    a[:,:,3][kill]=0
    Image.fromarray(a.astype(np.uint8)).save(f); print(h,"removed",int(kill.sum()))
