#!/usr/bin/env python3
"""Build data/cities.txt for Sky Atlas from GeoNames (stdlib only).

Inputs (download from https://download.geonames.org/export/dump/ into one folder):
  cities500.zip (or cities1000.zip)  admin1CodesASCII.txt  countryInfo.txt  alternateNamesV2.zip (optional, ~200 MB;
  without it the less reliable alternatenames column of cities1000 is used)
Usage:
  python3 -I tools/build_cities.py <geonames_dir> [out=data/cities.txt]

Output format (UTF-8 text, one place per line, lines grouped by "country / region"):
  line 1   JSON header {"v":1,"groups":[[country, region, count], ...], "n":rows}
  line 2.. name \t lat36 \t lon36 \t pop36 [\t ascii [\t alt1|alt2|...]]
Within a group rows are sorted by latitude; lat is stored as a base-36 delta of
round((lat+90)*1e4) from the previous row (first row: from 0), lon as base-36
round((lon+180)*1e4), population as base-36.  `ascii` is only present when it
differs from the name once diacritics are folded; `alts` only for places with
population >= 50 000 (Latin-script alternate names, e.g. Roma, Koeln, Lisboa).

Data: GeoNames, https://www.geonames.org, licence CC BY 4.0.
"""
import io, json, os, re, sys, unicodedata, zipfile

SPECIAL = str.maketrans({'ø': 'o', 'Ø': 'o', 'æ': 'ae', 'Æ': 'ae', 'œ': 'oe', 'Œ': 'oe', 'ß': 'ss', 'ł': 'l', 'Ł': 'l',
                         'đ': 'd', 'Đ': 'd', 'ð': 'd', 'Ð': 'd', 'þ': 'th', 'Þ': 'th', 'ı': 'i', 'ħ': 'h'})

def norm(s):
    s = unicodedata.normalize('NFD', s.translate(SPECIAL))
    return ''.join(c for c in s if not unicodedata.combining(c)).lower()

LATIN = re.compile(r"^[A-Za-zÀ-ÖØ-öø-ſƀ-ɏḀ-ỿ][A-Za-zÀ-ÖØ-öø-ſƀ-ɏḀ-ỿ' .\-]*$")

def b36(n):
    if n == 0: return '0'
    d = '0123456789abcdefghijklmnopqrstuvwxyz'; out = ''
    while n: n, r = divmod(n, 36); out = d[r] + out
    return out

EXO = {'de', 'fr', 'es', 'it', 'pt', 'nl'}                        # major languages whose exonyms people type
SKIP = {'link', 'post', 'iata', 'icao', 'faac', 'abbr', 'wkdt', 'unlc', 'tcid', 'phon', 'geoid', 'uic', 'lauc', 'nuts'}
DE_X = str.maketrans({'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue'})

DROP = {'PPLH', 'PPLQ', 'PPLW', 'PPLCH'}

def alt_cap(pop):
    return 12 if pop >= 1_000_000 else 8 if pop >= 200_000 else 5

def main():
    src = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'data', 'cities.txt')
    countries = {}
    for l in open(os.path.join(src, 'countryInfo.txt'), encoding='utf-8'):
        if l.startswith('#') or not l.strip(): continue
        f = l.rstrip('\n').split('\t'); countries[f[0]] = f[4]
    admin1 = {}
    for l in open(os.path.join(src, 'admin1CodesASCII.txt'), encoding='utf-8'):
        f = l.rstrip('\n').split('\t'); admin1[f[0]] = f[1]
    base = 'cities500' if os.path.exists(os.path.join(src, 'cities500.zip')) else 'cities1000'
    z = zipfile.ZipFile(os.path.join(src, base + '.zip'))
    langs = {}
    for l in open(os.path.join(src, 'countryInfo.txt'), encoding='utf-8'):
        if l.startswith('#') or not l.strip(): continue
        f = l.rstrip('\n').split('\t'); langs[f[0]] = {x.split('-')[0] for x in f[15].split(',') if x}
    places = []
    for l in io.TextIOWrapper(z.open(base + '.txt'), encoding='utf-8'):
        f = l.rstrip('\n').split('\t')
        pop = int(f[14] or 0)
        if f[7] in DROP or (f[7] == 'PPLX' and pop < 50_000): continue       # historical/abandoned places and small city quarters
        places.append((f[0], f[1], f[2], f[3], float(f[4]), float(f[5]), f[8], f[10], pop))
    big = {p[0]: p for p in places if p[8] >= 50_000}
    cand = {}                      # geonameid -> {norm: (rank, text)}
    altzip = os.path.join(src, 'alternateNamesV2.zip')
    def offer(gid, text, rank):
        a = text.strip()
        if not (2 <= len(a) <= 26) or not LATIN.match(a) or a.isupper(): return
        d = cand.setdefault(gid, {}); k = norm(a)
        if k not in d or rank < d[k][0]: d[k] = (rank, a)
    if os.path.exists(altzip):
        az = zipfile.ZipFile(altzip)
        for l in io.TextIOWrapper(az.open('alternateNamesV2.txt'), encoding='utf-8'):
            f = l.split('\t')
            if len(f) < 8 or f[1] not in big or f[7] == '1' or f[6] == '1': continue   # historic / colloquial
            lang = f[2]
            if not lang or lang in SKIP or '-' in lang: continue
            native = lang in langs.get(big[f[1]][6], ())
            if not native and lang not in EXO: continue
            rank = (0 if native else 1) * 2 + (0 if f[4] == '1' else 1)
            offer(f[1], f[3], rank)
            if lang == 'de' and any(ch in f[3] for ch in 'äöüÄÖÜ'): offer(f[1], f[3].translate(DE_X), rank + 1)
    else:
        for gid, p in big.items():
            for a in p[3].split(','): offer(gid, a, 5)
    groups = {}
    for gid, name, ascii_, _alts, lat, lon, cc, a1, pop in places:
        country = countries.get(cc, cc); region = admin1.get(cc + '.' + a1, '')
        nn = norm(name)
        asc = '' if norm(ascii_) == nn else ascii_
        al = []
        if gid in cand:
            c = [v for k, v in cand[gid].items() if k != nn and k != norm(ascii_)]
            c.sort(key=lambda v: (v[0], len(v[1]), v[1]))
            al = [v[1] for v in c[:alt_cap(pop)]]
        groups.setdefault((country, region), []).append((int(round((lat + 90) * 1e4)), int(round((lon + 180) * 1e4)), pop, name, asc, al))
    keys = sorted(groups); lines = []; hdr = []; total = 0
    for k in keys:
        rows = sorted(groups[k]); prev = 0
        hdr.append([k[0], k[1], len(rows)]); total += len(rows)
        for la, lo, pop, name, asc, al in rows:
            row = [name.replace('\t', ' '), b36(la - prev), b36(lo), b36(pop)]; prev = la
            if asc or al: row.append(asc)
            if al: row.append('|'.join(al))
            lines.append('\t'.join(row))
    with open(out, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(json.dumps({'v': 1, 'groups': hdr, 'n': total}, ensure_ascii=False, separators=(',', ':')) + '\n')
        fh.write('\n'.join(lines) + '\n')
    print(f'{total} places, {len(keys)} groups -> {out} ({os.path.getsize(out)/1e6:.2f} MB)')

if __name__ == '__main__':
    main()
