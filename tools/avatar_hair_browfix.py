#!/usr/bin/env python3
"""眉透け髪型用：素体の眉のすぐ上に残る元絵の眉の線を周囲の髪色で消し、素体の眉の位置をくり抜く。
使い方: python3 tools/avatar_hair_browfix.py <hairId>...（ブラウンに適用 → clean/recolor）"""
import sys
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage
TOP=200
def brow_mask(bodyfile):
    body=np.array(Image.open(bodyfile).convert("RGBA")).astype(int)
    lum=(body[:,:,:3]*[0.299,0.587,0.114]).sum(2); vis=body[:,:,3]>200
    reg=np.zeros_like(vis); reg[250:330,360:660]=True
    brow=(lum<150)&vis&reg
    lab,n=ndimage.label(brow); keep=[i+1 for i,s in enumerate(ndimage.sum(brow,lab,range(1,n+1))) if s>100]
    m=np.zeros((1024+TOP,1024),bool); m[TOP:]=ndimage.binary_dilation(np.isin(lab,keep),iterations=2); return m
for h in sys.argv[1:]:
    mask=brow_mask(f"public/avatar/body/{h[0]}__light.png")
    f=f"public/avatar/hair_front/{h}__brown.png"
    a=np.array(Image.open(f).convert("RGBA")).astype(int); al=a[:,:,3]
    lum=(a[:,:,:3]*[0.299,0.587,0.114]).sum(2)
    m=ndimage.binary_dilation(mask,iterations=12)
    dark=m&(al>150)&(lum<110)
    _,idx=ndimage.distance_transform_edt(dark|(al<=150),return_indices=True)
    rgb=a[:,:,:3].copy(); rgb[dark]=a[:,:,:3][idx[0][dark],idx[1][dark]]
    out=a.copy(); out[:,:,:3]=rgb; im=Image.fromarray(out.astype(np.uint8))
    bl=im.filter(ImageFilter.GaussianBlur(1.5)); mk=Image.fromarray((ndimage.binary_dilation(dark,iterations=2)*255).astype(np.uint8))
    im=Image.composite(bl,im,mk); a2=np.array(im); a2[mask,3]=0; Image.fromarray(a2).save(f); print(h,"browfix")
