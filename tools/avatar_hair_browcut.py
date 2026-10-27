#!/usr/bin/env python3
"""前髪レイヤーから素体の眉の位置をくり抜く（眉が前髪の上に見える＝眉透け）。
元画像の眉と素体の眉が少しずれて二重に見える問題の対策。全色のファイルに適用する。
使い方: python3 tools/avatar_hair_browcut.py            # 全髪型（f_* は f 素体、m_* は m 素体）
        python3 tools/avatar_hair_browcut.py f_bun     # 1 髪型だけ"""
import sys, glob
from PIL import Image
import numpy as np
from scipy import ndimage
TOP=200
def brow_mask(bodyfile):
    body=np.array(Image.open(bodyfile).convert("RGBA")).astype(int)
    lum=(body[:,:,:3]*[0.299,0.587,0.114]).sum(2); vis=body[:,:,3]>200
    reg=np.zeros_like(vis); reg[250:330,360:660]=True      # 目の上の帯
    brow=(lum<150)&vis&reg
    lab,n=ndimage.label(brow); keep=[i+1 for i,s in enumerate(ndimage.sum(brow,lab,range(1,n+1))) if s>100]
    m=np.zeros((1024+TOP,1024),bool); m[TOP:]=ndimage.binary_dilation(np.isin(lab,keep),iterations=2); return m
masks={"f":brow_mask("public/avatar/body/f__light.png"),"m":brow_mask("public/avatar/body/m__light.png")}
ids=sys.argv[1:] or sorted({f.split("/")[-1].split("__")[0] for f in glob.glob("public/avatar/hair_front/*.png")})
for hid in ids:
    m=masks[hid[0]]
    for f in glob.glob(f"public/avatar/hair_front/{hid}__*.png"):
        a=np.array(Image.open(f).convert("RGBA"))
        if a.shape[0]!=m.shape[0]: print("skip",f); continue
        a[m,3]=0; Image.fromarray(a).save(f)
    print("cut",hid)
