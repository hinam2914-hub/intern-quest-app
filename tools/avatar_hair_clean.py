#!/usr/bin/env python3
"""ブラウン髪レイヤーの縁に残った肌色・明るいカス（他色に変えたとき縁取りになる）を除去。"""
import glob
from PIL import Image
import numpy as np
from scipy import ndimage
for f in glob.glob("public/avatar/hair_*/*__brown.png"):
    im=Image.open(f).convert("RGBA"); a=np.array(im); r,g,b,al=[a[:,:,i].astype(int) for i in range(4)]
    # 肌・明るい色（茶の髪ではない）
    light=(r>170)&(g>125)&(b>100)&(r-b<110)&(g>=b-5)   # 肌色帯
    # 不透明な髪の内側（縁から 3px 以上内側）は守る
    core=ndimage.binary_erosion(al>200,iterations=3)
    kill=light&~core&(al>0)
    al2=al.copy(); al2[kill]=0
    # 半透明の縁は少し締める
    edge=(al2>0)&(al2<120); al2[edge]=0
    a[:,:,3]=al2.astype(np.uint8); Image.fromarray(a).save(f)
print("cleaned")
