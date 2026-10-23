#!/usr/bin/env python3
"""髪レイヤーを顔の中心を軸に縮小（ボリュームが大きすぎる髪型の調整）。
使い方: python3 tools/avatar_hair_shrink.py <hairId> <scale>   例: m_wolf 0.88"""
import sys, glob
from PIL import Image
hid=sys.argv[1]; s=float(sys.argv[2])
CX,CY=512,385+200   # 顔の中心（目の位置）。キャンバスは上に200px余白つき
for f in glob.glob(f"public/avatar/hair_*/{hid}__*.png"):
    im=Image.open(f).convert("RGBA"); W,H=im.size
    sm=im.resize((int(round(W*s)),int(round(H*s))),Image.LANCZOS)
    out=Image.new("RGBA",(W,H),(0,0,0,0)); out.alpha_composite(sm,(int(round(CX-CX*s)),int(round(CY-CY*s))))
    out.save(f)
print("ok",hid,s)
