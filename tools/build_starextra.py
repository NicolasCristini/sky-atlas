#!/usr/bin/env python3
"""Build data/starextra.json: proper motion, distance and spectral type for the stars in data/stars.6.json.

Source: HYG database (https://github.com/astronexus/HYG-Database), CSV with columns hip, pmra, pmdec (mas/yr,
pmra already includes the cos(dec) factor), dist (parsecs, 100000 = unknown) and spect.

  curl -L -o hyg.csv https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv
  python3 -I tools/build_starextra.py hyg.csv            # writes data/starextra.json

Output is column-oriented to stay compact: {hip:[], pmra:[], pmdec:[], ly:[], spect:[]} (ly = null if unknown).
"""
import csv
import json
import os
import sys

PC_TO_LY = 3.26156
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    with open(os.path.join(root, 'data', 'stars.6.json')) as f:
        ids = [int(x['id']) for x in json.load(f)['features']]
    wanted = set(ids)
    rows = {}
    with open(sys.argv[1], newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if r['hip'] and int(r['hip']) in wanted:
                rows[int(r['hip'])] = r
    out = {'hip': [], 'pmra': [], 'pmdec': [], 'ly': [], 'spect': []}
    for h in ids:
        r = rows.get(h)
        if not r:
            continue
        try:
            pmra, pmdec = float(r['pmra']), float(r['pmdec'])
        except ValueError:
            pmra = pmdec = 0.0
        try:
            d = float(r['dist'])
        except ValueError:
            d = 1e5
        ly = None if d >= 99999 or d <= 0 else (round(d * PC_TO_LY, 1) if d < 100 else int(round(d * PC_TO_LY)))
        spect = (r['spect'] or '').strip().split(' ')[0].replace('...', '')
        out['hip'].append(h)
        out['pmra'].append(round(pmra, 1))
        out['pmdec'].append(round(pmdec, 1))
        out['ly'].append(ly)
        out['spect'].append(spect)
    path = os.path.join(root, 'data', 'starextra.json')
    with open(path, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(f'{len(out["hip"])} of {len(ids)} stars matched; {sum(1 for x in out["ly"] if x is not None)} with distance; wrote {path} ({os.path.getsize(path)} bytes)')


main()
