#!/usr/bin/env python3
"""Measure the mix without ears.

Serves nothing itself: run `python3 -m http.server 8770` in the project first. Then:

    python3 tools/measure_mix.py http://127.0.0.1:8770/index.html out.json [seconds-per-station]

Plays every station in a headless Chrome (needs playwright and a Chrome), samples each bus
(voices, music, static, room) ten times a second, and writes levels per station in dBFS.
"""
import asyncio, json, sys
from playwright.async_api import async_playwright

URL, OUT = sys.argv[1], sys.argv[2]
SECS = float(sys.argv[3]) if len(sys.argv) > 3 else 24

async def sample(pg, secs):
    rows = []
    for _ in range(int(secs * 10)):
        rows.append(await pg.evaluate("()=>window.__m()"))
        await pg.wait_for_timeout(100)
    return rows

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome",
                                    args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required", "--no-proxy-server"])
        pg = await b.new_page(viewport={"width": 390, "height": 800})
        await pg.goto(URL); await pg.wait_for_timeout(1200)
        await pg.click("#lamp", force=True); await pg.click("#lamp", force=True)
        await pg.click("#set", force=True); await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{window.__m=HB.sound.meter();hollowband.power(true);}")
        state = await pg.evaluate("()=>[HB.sound.ctx().state,HB.sound.ctx().currentTime]")
        res = {"ctx": state, "stations": {}}
        res["static_far"] = (await pg.evaluate("()=>hollowband.tune(3600)"), await sample(pg, 4))[1]
        res["static_near"] = (await pg.evaluate("()=>hollowband.tune(6060)"), await sample(pg, 4))[1]
        ids = await pg.evaluate("()=>HB.radio.LIVING.filter(s=>!s.listener).map(s=>[s.id,s.f])")
        ids.append(["engineer", 16661])
        for sid, f in ids:
            await pg.evaluate("f=>hollowband.tune(f)", f); await pg.wait_for_timeout(2500)
            res["stations"][sid] = await sample(pg, SECS)
            print(sid, "done", flush=True)
        await pg.evaluate("()=>hollowband.power(false)")
        for sid, f in await pg.evaluate("()=>HB.radio.DEAD.filter(s=>!s.door).map(s=>[s.id,s.f])"):
            await pg.evaluate("f=>hollowband.tune(f)", f); await pg.wait_for_timeout(2500)
            res["stations"][sid] = await sample(pg, SECS * 0.75)
            print(sid, "done", flush=True)
        await pg.click("#leanback", force=True); await pg.wait_for_timeout(1500)
        res["room_quiet"] = await sample(pg, 5)
        await pg.click("#win", force=True); await pg.wait_for_timeout(800)
        res["room_window_open"] = await sample(pg, 8)
        json.dump(res, open(OUT, "w"))
        await b.close()

asyncio.run(main())
