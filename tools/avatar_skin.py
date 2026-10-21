#!/usr/bin/env python3
"""ライト肌の素体から他の肌色を生成（肌色の画素だけ色を置き換え。目・口・インナーは維持）。"""
import glob
from PIL import Image
import numpy as np, cv2
from scipy import ndimage
SKINS={"fair":"#f5d3b4","tan":"#d9a97e","deep":"#9c6a46"}; BASE="#fde7d2"
hexrgb=lambda h: tuple(int(h[i:i+2],16) for i in (1,3,5))
def tint(img,target):
    a=np.array(img.convert("RGBA")); rgb=a[:,:,:3].astype(np.uint8)
    r,g,b=[rgb[:,:,i].astype(int) for i in range(3)]
    skin=(r>150)&(r-b>15)&(r-b<120)&(g>=b-5)&(r>=g)&(a[:,:,3]>10)&~((r>235)&(g>228)&(b>218))  # 白インナーは除く
    skin=ndimage.binary_closing(skin,iterations=2)
    hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV).astype(float)
    bh,bs,bv=cv2.cvtColor(np.uint8([[hexrgb(BASE)]]),cv2.COLOR_RGB2HSV)[0,0].astype(float)
    th,ts,tv=cv2.cvtColor(np.uint8([[hexrgb(target)]]),cv2.COLOR_RGB2HSV)[0,0].astype(float)
    hsv[:,:,0][skin]=(hsv[:,:,0][skin]+(th-bh))%180
    hsv[:,:,1][skin]=np.clip(hsv[:,:,1][skin]*(ts/max(bs,1)),0,255)
    hsv[:,:,2][skin]=np.clip(hsv[:,:,2][skin]*(tv/max(bv,1)),0,255)
    out=cv2.cvtColor(hsv.astype(np.uint8),cv2.COLOR_HSV2RGB); a[:,:,:3]=out; return Image.fromarray(a)
for f in glob.glob("public/avatar/body/*__light.png"):
    im=Image.open(f)
    for n,hx in SKINS.items(): tint(im,hx).save(f.replace("__light.png",f"__{n}.png"))
print("done")
