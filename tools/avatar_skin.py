#!/usr/bin/env python3
"""ライト肌の素体から他の肌色を生成（肌色の画素だけ色を置き換え。目・口・インナーは維持）。"""
import glob
from PIL import Image
import numpy as np, cv2
from scipy import ndimage
SKINS={"fair":"#f5d3b4","tan":"#d9a97e","deep":"#9c6a46"}; BASE="#fde7d2"
hexrgb=lambda h: tuple(int(h[i:i+2],16) for i in (1,3,5))
def tint(img,target,vmin=130):
    a=np.array(img.convert("RGBA")); rgb=a[:,:,:3].astype(np.uint8)
    r,g,b=[rgb[:,:,i].astype(int) for i in range(3)]
    hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV).astype(float)
    H,S,V=hsv[:,:,0],hsv[:,:,1],hsv[:,:,2]
    # 肌：オレンジ寄りの色相、彩度は中くらい（白目・白インナー・金装飾は除外）
    skin=(a[:,:,3]>10)&(H>=3)&(H<=17)&(S>=38)&(S<=125)&(V>=vmin)
    skin=ndimage.binary_opening(skin,iterations=1); skin=ndimage.binary_closing(skin,iterations=2)
    bh,bs,bv=cv2.cvtColor(np.uint8([[hexrgb(BASE)]]),cv2.COLOR_RGB2HSV)[0,0].astype(float)
    th,ts,tv=cv2.cvtColor(np.uint8([[hexrgb(target)]]),cv2.COLOR_RGB2HSV)[0,0].astype(float)
    hsv[:,:,0][skin]=(hsv[:,:,0][skin]+(th-bh))%180
    hsv[:,:,1][skin]=np.clip(hsv[:,:,1][skin]*(ts/max(bs,1)),0,255)
    hsv[:,:,2][skin]=np.clip(hsv[:,:,2][skin]*(tv/max(bv,1)),0,255)
    out=cv2.cvtColor(hsv.astype(np.uint8),cv2.COLOR_HSV2RGB); a[:,:,:3]=out; return Image.fromarray(a)
import sys
only=sys.argv[1:]   # 例: python3 tools/avatar_skin.py archer_default__m → その衣装だけ
def body_skin_mask(bodyfile):
    b=np.array(Image.open(bodyfile).convert("RGBA")); rgb=b[:,:,:3].astype(np.uint8)
    hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV); H,S,V=hsv[:,:,0],hsv[:,:,1],hsv[:,:,2]
    m=(b[:,:,3]>200)&(H>=3)&(H<=17)&(S>=38)&(S<=125)&(V>=130)
    return ndimage.binary_dilation(m,iterations=6)
if not only:
    for f in glob.glob("public/avatar/body/*__light.png"):
        im=Image.open(f)
        for n,hx in SKINS.items(): tint(im,hx).save(f.replace("__light.png",f"__{n}.png"))
# 衣装に描かれた手・脚・首の肌も同じ色に（<id>__<base>__<skin>.png）。素体の肌がある場所だけ色替え（革・木など茶系の装備を守る）
for f in glob.glob("public/avatar/outfit_front/*_default__?.png"):
    oid=f.split("/")[-1][:-4]
    if only and oid not in only: continue
    im=Image.open(f); base=oid[-1]; bm=body_skin_mask(f"public/avatar/body/{base}__light.png")
    src=np.array(im.convert("RGBA"))
    for n,hx in SKINS.items():
        t=np.array(tint(im,hx,vmin=170)); keep=~bm; t[keep]=src[keep]; Image.fromarray(t).save(f.replace(".png",f"__{n}.png"))
print("done")
