# Hollowband Receiver

A shortwave radio that picks up stations from places that don't exist. Ten of them are on the air tonight.
One would rather not be found. Something happens to the sky. The set does not stay the same set.

It sits on a desk in the top room at 9 Lantern Row, Cape Regret. The room was A. Pruitt's. You are his relief.
His goose, Formal, came with the room.

It is a toy, a short piece of interactive fiction, and an instrument. It runs in a browser with no build step.

## Run it

    python3 -m http.server 8000
    # then open http://localhost:8000

It must be served over http (not opened as a file) so it can load the voice audio.
You start in the room. Touch things. Touch the set to sit down at it; Lean back to get up again.
At the set: press Power, drag the dial, listen. The cog opens the mixer and the settings.

Keys, at the set: space is power, left and right tune (shift for bigger steps), up and down seek, N skips an item,
Enter on the dial knocks on the glass. Escape closes whatever you are reading.

## What is in here

| Path | What |
| --- | --- |
| `index.html` | The room and the set |
| `css/radio.css`, `css/room.css` | The set's materials; the room, its light, Formal, the cards |
| `js/script.js` | Every word anyone says on the air. Pure data. Edit this to write for the stations |
| `js/cards.js` | Every card and letter that comes through the door, and Pruitt's note and logbook. Pure content |
| `js/sound.js` | Audio graph, instruments, a theme per station, the world outside, the room's sounds, voices, your tracks and mic |
| `js/radio.js` | Tuning, the story, the tape, the indicator, the set turning into other sets, settings |
| `js/room.js` | The room: light, weather, the kettle, the door and the post, reading things, Formal |
| `js/sky.js`, `js/stars.js` | The night sky: the real stars and constellations, the moon at tonight's phase, the coast |
| `js/voices.js` | Generated: where each spoken line sits inside the voice files |
| `audio/voices/` | Generated: the voices, one small mp3 per station segment |
| `tools/` | Voice rendering, star data and track tools |
| `docs/CREDITS.md` | Third-party data and its licences |
| `docs/DIRECTION.md` | Director's notes: what this is about, the dream rules, the road ahead. **Spoilers** |

## Your own station

The eleventh station is yours.

- **Tracks.** Drop audio into `tracks/`, run `python3 tools/add_tracks.py`. Or, in the page, open the cog and use
  Add tracks (those are kept in the browser, not in the repo). Your station takes a place on the dial and plays them
  through the same narrow, breathing signal path as everything else.
- **Microphone.** When the page is served from your own machine, an On air key appears. Press it, talk, press it
  again. What you said is logged, becomes a recording on your station, and whoever you were tuned to at the time
  may have something to say about it. For a broadcast mic: the page asks the browser for raw audio (no echo
  cancelling, no noise suppression, no automatic gain), so set your level at the interface. There is a setting to hear
  yourself through the set; use headphones.
- **Call in.** No microphone needed: type to the station you are tuned to.

## Voices

The voices are rendered offline with [Piper](https://github.com/rhasspy/piper) and packed per segment. To re-render after
editing `js/script.js`:

    pip install piper-tts          # and have ffmpeg and node on the path
    node tools/dump_lines.js > /tmp/lines.json
    python3 tools/render_voices.py /tmp/lines.json /path/to/piper/voices

Casting is in `tools/cast.json`. Lines that have no rendered audio still print on the tape, and are spoken by the
browser's own voice where it has one.

To replace the voices with something better (recorded actors, another TTS, Suno): keep the same shape. Each entry in
`/tmp/lines.json` is one fragment of speech with a `sprite` (which file it belongs in), a `cast` (who says it) and a
`key`. Produce one audio file per sprite and a `js/voices.js` that maps each key to `[start_seconds, duration_seconds]`
inside its file. Nothing else needs to change.

## Poking at it

`window.hollowband` in the console is a handle on the night: `hollowband.state`, `hollowband.tune(6075)`,
`hollowband.skin(1, 0.34)` to look at a particular set or a resting point between two.
`HB.room.debug` does the same for the room: `.rain(120)`, `.fog(120)`, `.deliver({id:"dolores",how:"slot"})`, `.boil()`.

Everything the night remembers is kept in the browser (`hollowband-night`, `hollowband-room`, `hollowband-prefs` in
local storage, your tracks and recordings in IndexedDB). "Start the night over", in the settings, clears the night.
