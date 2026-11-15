#!/usr/bin/env python3
"""Render the Sky Atlas app icons into icons/ (pure stdlib: no Pillow needed).

Design: dark-blue night sky, a glowing planetary horizon arc, one gold star above it (same star as the favicon).
  python3 tools/make_icons.py
Writes apple-touch-icon.png (180), icon-192.png, icon-512.png, icon-maskable-512.png (content inside the 80% safe zone).
"""
import math, os, struct, zlib

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')

def hexc(h): return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
BG_IN, BG_OUT = hexc('#12234a'), hexc('#04060c')
LIMB, GLOW, PLANET, GOLD = hexc('#9cc8ff'), hexc('#3f7bd8'), hexc('#070c1a'), hexc('#f2c14e')

# five-point star, same proportions as the favicon (outer 1, inner 0.4)
STAR_C, STAR_R = (0.5, 0.385), 0.185
STAR = []
for i in range(10):
    a = -math.pi / 2 + i * math.pi / 5; r = STAR_R * (1 if i % 2 == 0 else 0.41)
    STAR.append((STAR_C[0] + r * math.cos(a), STAR_C[1] + r * math.sin(a)))
DOTS = [(0.2, 0.2, 0.011, .7), (0.80, 0.27, 0.013, .85), (0.31, 0.47, 0.008, .5), (0.72, 0.12, 0.008, .55), (0.11, 0.42, 0.007, .45)]
ARC_C, ARC_R = (0.5, 1.62), 1.02          # horizon = top of a big circle (centre below the canvas)

def inside(poly, x, y):
    c = False; n = len(poly); j = n - 1
    for i in range(n):
        xi, yi = poly[i]; xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: c = not c
        j = i
    return c

def mix(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

def shade(u, v):
    # background: soft radial glow low in the sky
    d = math.hypot(u - 0.5, (v - 0.78) * 0.9)
    c = mix(BG_IN, BG_OUT, min(1, d / 0.95) ** 0.9)
    for (x, y, r, a) in DOTS:
        k = math.hypot(u - x, v - y)
        if k < r * 2.2: c = mix(c, (1, 1, 1), a * max(0, 1 - k / (r * 2.2)) ** 1.5)
    # gold glow behind the star
    k = math.hypot(u - STAR_C[0], v - STAR_C[1])
    if k < 0.42: c = mix(c, GOLD, 0.30 * (1 - k / 0.42) ** 2.2)
    if inside(STAR, u, v): c = GOLD
    # horizon: atmosphere glow above the limb, dark planet below, bright rim
    dist = math.hypot(u - ARC_C[0], v - ARC_C[1]) - ARC_R          # >0 outside the planet
    if dist > 0: c = mix(c, GLOW, 0.55 * math.exp(-dist / 0.035))
    else: c = mix(PLANET, GLOW, 0.20 * math.exp(dist / 0.10))
    rim = math.exp(-((dist + 0.004) / 0.0075) ** 2)
    c = mix(c, LIMB, min(1, rim))
    return c

def render(size, ss, scale=1.0):
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            r = g = b = 0.0
            for sy in range(ss):
                for sx in range(ss):
                    u = (px + (sx + .5) / ss) / size; v = (py + (sy + .5) / ss) / size
                    if scale != 1.0:      # shrink the artwork towards the centre (maskable safe zone)
                        u = 0.5 + (u - 0.5) / scale; v = 0.5 + (v - 0.5) / scale
                    c = shade(u, v); r += c[0]; g += c[1]; b += c[2]
            n = ss * ss
            row += bytes((int(min(255, r / n * 255 + .5)), int(min(255, g / n * 255 + .5)), int(min(255, b / n * 255 + .5))))
        rows.append(bytes(row))
    return rows

def png(path, rows, size):
    raw = b''.join(b'\x00' + r for r in rows)
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, size, ss, scale in (('apple-touch-icon.png', 180, 3, 1.0), ('icon-192.png', 192, 3, 1.0), ('icon-512.png', 512, 2, 1.0), ('icon-maskable-512.png', 512, 2, 0.78)):
        png(os.path.join(OUT, name), render(size, ss, scale), size); print('wrote', name)
