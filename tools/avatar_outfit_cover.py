#!/usr/bin/env python3
"""衣装レイヤーの後ろから素体の腕・インナーが見える問題の修正。
 1) 首より上（y<NECK）に残った髪などを消す
 2) 素体の見える画素のうち衣装で覆われていないもの（袖の脇の肌など）を、最寄りの衣装画素の色で埋めて隠す
使い方: python3 tools/avatar_outfit_cover.py <outfit.png> [--body public/avatar/body/m__light.png] [--neck 470] [--reach 24]"""
import argparse
from PIL import Image
import numpy as np
from scipy import ndimage
ap=argparse.ArgumentParser(); ap.add_argument("src"); ap.add_argument("--body",default="public/avatar/body/m__light.png")
ap.add_argument("--neck",type=int,default=470); ap.add_argument("--reach",type=int,default=24)
a=ap.parse_args()
im=Image.open(a.src).convert("RGBA"); A=np.array(im); al=A[:,:,3].astype(int)
vis=np.array(Image.open(a.body).convert("RGBA"))[:,:,3]>120
yy=np.broadcast_to(np.arange(al.shape[0])[:,None],al.shape)
# 1) 首より上は全部捨てる（頭は素体＋髪レイヤーに任せる）
al[yy<a.neck]=0
# 頭の横（首〜肩の上）で素体の外側にある画素は髪の残り → 捨てる
side=(yy<a.neck+50)&~ndimage.binary_dilation(vis,iterations=3); al[side]=0
# 2) 衣装に覆われていない素体画素を埋める：内側は袖の内部色、外縁は衣装の輪郭色
B=np.array(Image.open(a.body).convert("RGBA")); bal=B[:,:,3].astype(int)
cov=al>100
hole=vis&~cov&(yy>=a.neck)
dist,idx=ndimage.distance_transform_edt(~cov,return_indices=True)
fill=hole&(dist<=a.reach)
inner=ndimage.binary_erosion(cov,iterations=5)
_,idx2=ndimage.distance_transform_edt(~inner,return_indices=True)
rgb=A[:,:,:3].copy()
rgb[fill]=A[:,:,:3][idx2[0][fill],idx2[1][fill]]
# 外縁 3px は輪郭色（最寄りの衣装画素＝輪郭線）
outside=~(vis|cov)
edge=fill&ndimage.binary_dilation(outside,iterations=3)
rgb[edge]=A[:,:,:3][idx[0][edge],idx[1][edge]]
A[:,:,:3]=rgb
al[fill]=np.maximum(al[fill],bal[fill])
A[:,:,3]=al.astype(np.uint8); Image.fromarray(A).save(a.src)
print("saved",a.src,"filled",int(fill.sum()))
