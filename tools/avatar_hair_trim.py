#!/usr/bin/env python3
"""前髪レイヤーのうち、肩より下で体の内側（素体シルエットの内側）にかかる房を落とす（横に落ちる髪は残す）。
使い方: python3 tools/avatar_hair_trim.py <hairId> <base f|m> [y_from=640]"""
import sys, glob
from PIL import Image
import numpy as np
from scipy import ndimage
hid=sys.argv[1]; base=sys.argv[2]; y0=int(sys.argv[3]) if len(sys.argv)>3 else 640
vis=np.array(Image.open(f"public/avatar/body/{base}__light.png").convert("RGBA"))[:,:,3]>200
body=ndimage.binary_dilation(vis,iterations=4)
TOP=200
for f in glob.glob(f"public/avatar/hair_front/{hid}__*.png"):
    im=Image.open(f).convert("RGBA"); a=np.array(im); al=a[:,:,3]
    H=al.shape[0]; yy=np.arange(H)[:,None]
    m=np.zeros_like(al,bool); m[TOP:TOP+1024]=body
    kill=(yy>=y0+TOP)&m
    al[kill]=0; a[:,:,3]=al; Image.fromarray(a).save(f)
print("trimmed",hid)
