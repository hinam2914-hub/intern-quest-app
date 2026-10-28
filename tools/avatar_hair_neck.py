#!/usr/bin/env python3
"""前髪レイヤー（ブラウン）に残った素体の首〜肩の輪郭線（細い濃い線）を除去。
髪の塊に接している線（髪自身の輪郭）は残し、周囲に髪の塗りがない孤立した線だけ消す。
使い方: python3 tools/avatar_hair_neck.py <hairId>...（省略時は全髪型）→ clean/recolor で他色再生成"""
import sys, glob
from PIL import Image
import numpy as np
from scipy import ndimage
TOP=200
ids=sys.argv[1:] or sorted({f.split("/")[-1].split("__")[0] for f in glob.glob("public/avatar/hair_front/*__brown.png")})
for h in ids:
    body=np.array(Image.open(f"public/avatar/body/{h[0]}__light.png"))[:,:,3]>120
    edge=ndimage.binary_dilation(body,iterations=16)&~ndimage.binary_erosion(body,iterations=16)
    f=f"public/avatar/hair_front/{h}__brown.png"
    a=np.array(Image.open(f).convert("RGBA")).astype(int); al=a[:,:,3]; lum=(a[:,:,:3]*[0.299,0.587,0.114]).sum(2)
    m=np.zeros(al.shape,bool); m[TOP:]=edge
    yy=np.arange(al.shape[0])[:,None]; band=m&(yy>=TOP+470)&(yy<=TOP+620)
    thick=ndimage.binary_opening(al>80,structure=np.ones((9,9)))   # 髪の塊
    near=ndimage.binary_dilation(thick,iterations=5)
    # 帯の中で、髪の塊に接していない細い画素（色を問わず）＝素体の輪郭線・肌の縁
    kill=band&(al>80)&~thick&~near
    kill=ndimage.binary_dilation(kill,iterations=2)&~thick&band&~near
    a[:,:,3][kill]=0
    Image.fromarray(a.astype(np.uint8)).save(f); print(h,"removed",int(kill.sum()))
