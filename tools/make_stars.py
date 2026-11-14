#!/usr/bin/env python3
"""Build js/stars.js from the d3-celestial star catalogue (stars to magnitude 6) and constellation lines.

    curl -LO https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/stars.6.json
    curl -LO https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json
    python3 tools/make_stars.py stars.6.json constellations.lines.json

Stars are stored as flat integers: right ascension and declination in hundredths of a degree,
magnitude and colour index (B-V) in tenths. Only what can rise at 50 degrees north is kept.
"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
stars = json.load(open(sys.argv[1]))["features"]
lines = json.load(open(sys.argv[2]))["features"]
flat = []
for f in sorted(stars, key=lambda f: f["properties"]["mag"]):
    lon, dec = f["geometry"]["coordinates"]
    mag = f["properties"]["mag"]
    if mag > 5.7 or dec < -41:
        continue
    try:
        bv = float(f["properties"].get("bv") or 0.5)
    except ValueError:
        bv = 0.5
    flat += [round((lon % 360) * 100), round(dec * 100), round(mag * 10), round(bv * 10)]
polys = []
for f in lines:
    for line in f["geometry"]["coordinates"]:
        if max(p[1] for p in line) < -41:
            continue
        polys.append([v for p in line for v in (round((p[0] % 360) * 10), round(p[1] * 10))])
with open(os.path.join(ROOT, "js", "stars.js"), "w") as out:
    out.write("/* The real sky: stars to magnitude 5.7 and the constellation figures.\n"
              "   Built by tools/make_stars.py from d3-celestial data (c) 2015 Olaf Frohn, BSD-3-Clause; see docs/CREDITS.md. */\n")
    out.write("window.HB_STARS=" + json.dumps({"s": flat, "l": polys}, separators=(",", ":")) + ";\n")
print("%d stars, %d figure lines, %.0f KB" % (len(flat) // 4, len(polys), os.path.getsize(os.path.join(ROOT, "js", "stars.js")) / 1024))
