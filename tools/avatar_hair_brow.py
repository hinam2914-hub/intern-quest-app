#!/usr/bin/env python3
"""髪レイヤー（ブラウン）に紛れ込んだ元画像の眉（顔の中の細い孤立した筋）を除去。
使い方: python3 tools/avatar_hair_brow.py <hairId> [--body public/avatar/body/f__light.png] [--dry]
その後 tools/avatar_hair_clean.py → tools/avatar_recolor.py で他色を再生成する。"""
import argparse
from PIL import Image
import numpy as np
from scipy import ndimage
ap=argparse.ArgumentParser(); ap.add_argument("hair"); ap.add_argument("--body",default="public/avatar/body/f__light.png"); ap.add_argument("--dry",action="store_true")
a=ap.parse_args()
f=f"public/avatar/hair_front/{a.hair}__brown.png"
A=np.array(Image.open(f).convert("RGBA")); al=A[:,:,3].astype(int)
vis=np.array(Image.open(a.body).convert("RGBA"))[:,:,3]>200
TOP=al.shape[0]-1024
face=np.zeros(al.shape,bool); face[TOP:]=ndimage.binary_erosion(vis,iterations=12)
yy=np.arange(al.shape[0])[:,None]; face&=(yy>TOP+320)&(yy<TOP+560)
m=al>80
op=ndimage.binary_opening(m,structure=np.ones((5,5)))
lab,n=ndimage.label(m&~op)
kill=np.zeros_like(m)
for i in range(1,n+1):
    c=lab==i
    if (c&face).sum()==0: continue
    # 太い部分（毛束）に繋がっている細い毛先は残す。孤立した細い筋＝眉
    if (ndimage.binary_dilation(c,iterations=1)&op).sum()<8: kill|=c
print(a.hair,"kill px",int(kill.sum()))
if not a.dry and kill.any():
    al[kill]=0; A[:,:,3]=al.astype(np.uint8); Image.fromarray(A).save(f); print("saved",f)
