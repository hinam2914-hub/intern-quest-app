#!/usr/bin/env python3
"""髪レイヤーを顔中心基準で拡縮＋上下移動。 例: m_long 1.04 -14"""
import sys, glob
from PIL import Image
hid=sys.argv[1]; s=float(sys.argv[2]); dy=int(sys.argv[3]) if len(sys.argv)>3 else 0
CX,CY=512,385+200
for f in glob.glob(f"public/avatar/hair_*/{hid}__*.png"):
    im=Image.open(f).convert("RGBA"); W,H=im.size
    sm=im.resize((int(round(W*s)),int(round(H*s))),Image.LANCZOS)
    out=Image.new("RGBA",(W,H),(0,0,0,0)); out.alpha_composite(sm,(int(round(CX-CX*s)),int(round(CY-CY*s))+dy)); out.save(f)
print("ok",hid,s,dy)
