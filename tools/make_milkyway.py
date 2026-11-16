#!/usr/bin/env python3
"""Build img/milkyway-4k.jpg and img/milkyway-2k.jpg for the Sky Atlas Milky Way.

Source (NASA SVS 4851 "Deep Star Maps 2020", public domain; Gaia DR2: ESA/Gaia/DPAC):
  https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/milkyway_2020_8k.exr   (8192x4096 float16 RGB, 131 MB)
  Equirectangular plate carree, celestial J2000: centred on RA 0h, RA increases to the LEFT, top row = Dec +90.
  (The "Milky Way only" map: bright Hipparcos/Tycho stars are omitted, so the app's catalogue stars are not doubled.)

Needs (in a throw-away venv, never global): pip install numpy pillow scipy openexr
Usage:  python3 -I tools/make_milkyway.py <path/to/milkyway_2020_8k.exr> [out_dir=img]

Processing: area-average down to 4096x2048 (kills the Gaia pixel noise), extra horizontal smoothing that grows
towards the poles (the map is oversampled there), subtract a black point (sky background / zodiacal noise floor),
blend a vertically blurred copy in near the poles (row-to-row noise streaks), normalise to the 99.7th percentile, store gamma 0.45 (8-bit keeps the faint halo; the shader does pow(x, 2.2)),
desaturate a little, write JPEG (4:2:0). The 2048x1024 phone texture is a further 2x2 area average.
"""
import sys, os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter1d, gaussian_filter
import OpenEXR

src = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else 'img'
a = OpenEXR.File(src).channels()['RGB'].pixels.astype(np.float32)
H, W, _ = a.shape
a = a.reshape(H // 2, 2, W // 2, 2, 3).mean((1, 3))           # 4096 x 2048
H, W, _ = a.shape
# pole smoothing: sigma (px) along x grows as 1/cos(dec), capped; do it in a few latitude bands
dec = 90 - (np.arange(H) + 0.5) / H * 180
sig = np.clip(0.55 / np.maximum(np.cos(np.radians(dec)), 0.05) - 0.55, 0, 40)
for lo, hi in [(0.4, 1.2), (1.2, 3), (3, 8), (8, 20), (20, 41)]:
    rows = (sig >= lo) & (sig < hi)
    if rows.any(): a[rows] = gaussian_filter1d(a[rows], sigma=(lo + hi) / 2, axis=1, mode='wrap')
a = gaussian_filter(a, sigma=(0.6, 0.6, 0), mode=('nearest', 'wrap', 'nearest'))
# near the poles the rows are independent noise: blend in a vertically blurred copy and lift the black point there
w = np.clip((np.abs(dec) - 76) / 11, 0, 1)[:, None, None]
w = w * w * (3 - 2 * w)
a = a * (1 - w) + gaussian_filter(a, sigma=(6, 2, 0), mode=('nearest', 'wrap', 'nearest')) * w
# faint regions (outer halo, background) are mostly noise: blend in a smoother copy there, keep the bright structure sharp
sm = gaussian_filter(a, sigma=(2.0, 2.0, 0), mode=('nearest', 'wrap', 'nearest'))
t = np.clip((sm.mean(2, keepdims=True) - 0.008) / 0.04, 0, 1)
t = t * t * (3 - 2 * t)
a = sm * (1 - t) + a * t
lum = a.mean(2)
bp = 0.0035
hi = np.percentile(np.clip(lum - bp, 0, None), 99.7)
x = np.clip(a - (bp + 0.004 * w), 0, None) / hi
x = np.clip(x, 0, 1)
l = x.mean(2, keepdims=True)
x = l + (x - l) * 0.85                                         # slight desaturation
enc = (np.clip(x, 0, 1) ** 0.45 * 255 + 0.5).astype(np.uint8)
os.makedirs(out, exist_ok=True)
img = Image.fromarray(enc)
img.save(os.path.join(out, 'milkyway-4k.jpg'), quality=82, optimize=True, progressive=True, subsampling=2)
img.resize((2048, 1024), Image.BOX).save(os.path.join(out, 'milkyway-2k.jpg'), quality=80, optimize=True, progressive=True, subsampling=2)
for f in ('milkyway-4k.jpg', 'milkyway-2k.jpg'): print(f, os.path.getsize(os.path.join(out, f)), 'bytes')
