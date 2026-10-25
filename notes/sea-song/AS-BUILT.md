# As built: "In the Hall of the Mountain King" (v15.2 sea song)

Built in `work/xvsea` (v15.1 plus the v15.2 sound), following `CHOICE.md` (the whirlpool proposal), then fixed for
the review (`review-music.json`, `review-ui.json`, `ledger.json`) and its verification (`review-verify.json`). Frozen
for the merge in `work/xvsea-final-snap`; how to merge: `MERGE-NOTES.md`.

- **The music:** Edvard Grieg, *Peer Gynt* (1875; Grieg died in 1907, so it is public domain). The adaptation is our own,
  made from the theme. No arrangement, transcription or film music was used.
- **How to put another melody on a curve:** `README.md`.

## What you get

- **The example.** "In the Hall of the Mountain King" (Russian «В пещере горного короля»), the last item in the
  Examples menu.
  - F(z) = z^(−1+24i), one `powa` step with its cut at 174.7011°.
  - One freehand curve of 1200 points spiralling in toward 0, named Spiral / «Спираль» in the Shapes list and menus.
  - It opens on the Phase view with the Plain style, the whole spiral in view above the style bar, desktop and phone.
    X → Y fits the spiral the first time it is opened. The cut handle sits inside the innermost turn.
  - The description: "Edvard Grieg, Peer Gynt (1875). Choose Listen along in the spiral's menu (right-click, or hold on
    touch): …". Its first sentence works on every device. Only this gallery line has a tooltip, and only when it is cut.
- **Hearing it is one action.**
  - Desktop: right-click the curve, then **Listen along**. Phone: long-press it, then **Listen along**.
  - Keyboard: Tab to the X plane, then **L** (the example makes this curve the plane's last one).
  - The guide: the **Open and play "In the Hall of the Mountain King"** button.

  It plays for 21.85 s and rings to about 24 s. It speeds up (quarter = 100, 130, 169, 219 at beats 0, 16, 32, 48) and
  grows louder (main-note velocity 0.44 → 0.90). The cut ticks are the drum. Pointer moves and a theme toggle do not
  stop it. Esc, L again, **Stop listening**, deleting or editing the curve, changing the chain, or opening another
  example stop it.
- **If sound is off.** The menu item stays. Choosing it shows a toast (desktop: "Sound is off: turn it on here, or with
  Sound in the top bar (⇧M)"; phone: "… or in the ⋯ menu"; Mathematical events off: "Mathematical events are off in the
  Sound menu: turn them on here"). Its **Turn on and listen** button turns sound on and plays the piece.
- **The guide.** The Sound section has a paragraph, "A curve as a melody": arg F is the pitch; each phase line plucks
  its string, crossing back plucks it again, a leap runs over the strings between; |F| sets the register; a closed
  loop's last note is its winding number; the Mountain King curve speeds up by itself, the cut is the drum, and the
  example sets its own register and dynamics. Below it: the example's thumbnail and the play button. EN and RU.

## The adaptation and how it sounds

- **Score** (unchanged from `CHOICE.md`): C♯ → B, repeated, in bars 1 and 3; E♯ C♯ E♯ → E D E, then E C E → E B E, in
  bar 2. Three statements and a coda of three rolled B-minor crashes. 159 crossings: 81 main notes and 78 graces that
  the five strings force.
- **Register:** the piece sets its own (`listen.reg`, one value per crossing). The loudest copy is the written note an
  octave up for every theme note, so the contour is Grieg's at every step. A piece's Ds carry no D4 accent string
  (verify-2), so on the main Ds the leading copy is at least 3.0 dB over the next pitch (it was 0.7 dB).
- **Graces:** 0.12× a passing grace, 0.08× a re-pluck, ×0.6 on a D. The flams and the coda's E and A are silent (under
  velocity 0.02 the harp skips the crossing): 150 of the 159 crossings sound.
- **Drum:** one pluck a tick, rising with the theme (`listen.tick`).
- **Coda:** B minor (B, D, F♯), low register.
- **Strings:** a piece keeps up to 24 at once; no main note loses its loudest string before the next one starts.

## Engine and app changes (`work/xvsea`)

- **`src/sound.js`**
  - `harpStep` takes `o.vel` (one velocity per crossing, `st.k`; it replaces the rate rules and the D-only thinning;
    under 0.02 the crossing is silent), `o.reg` (the register per crossing, in place of ln|F|) and `o.cap`.
  - `harpNote` takes `cap` and `piece`; a piece's D has no D4 accent.
  - The engine's string cap is `c.cap || 12`. The `cut` cue takes `o.one` (first pluck only).
  - `harpAlong` passes `vel`, `reg`, `cap`, and plays the ticks at `tickDb` (one pluck each) when given.
  - New `Sound.alongCount(phi, closed)`: the crossings Listen along would play, silently. `alongSeat` is shared.
  - The pointer's harp and every other curve are unchanged (`t_sound.js` 122/122).
- **`src/app.js`**: `sndListen`, `sndListenOf` (the guard: the stored points' key, the exact chain, X the z-plane, no
  deformation), `sndListenAsk` (the toast), `sndPlayPiece` (the guide button); the curve menu offers Listen along on a
  melody curve with sound off; L replays the example's curve; `sndSample` puts each tick at the crossing itself;
  the gallery thumbnail draws the curve in X; `loadExample` attaches `listen`, honours `ex.fit` and sets L's curve;
  stopping on delete, edit, chain change and example change; `shapeName` (Spiral); the guide paragraph. The test hook
  `__cmwSound().listenHarp` reports `dur` and `piece` (test build only).
- **`src/seasong.js`** (new, generated by `tools/melody_curve.js` from `tools/melodies/mountain-king.json`), bundled
  before `app.js` by `build.py`.
- **Strings:** `notes/i18n/ru/v152-seasong.json`, 10 strings, read by `tools/make_ru_table.py` (`V152_HERE`).
  «Слушать вдоль кривой «{name}»» now quotes the name, like the integral item in the same menu (verify-4).

## Checks (final sources)

| Test | Result |
|---|---|
| `t_seasong.js` | 51/51 (new: the Ds' lead, verify-2; it fails at 0.7 dB without the fix) |
| `t_sound.js` | 122/122 |
| `t_i18n.js`, `t_i18n_keys.js`, `t_i18n_english.js` | 18249 pass, 4754 pass, byte-identical |
| `t_tour.js` | 1101/1103, the same 2 failures as the base (`splitOffer`, `formula-split`) |
| `make_ru_table.py --strict` | 0 unresolved, 15 collisions (as the base) |
| `seasong_cmd.js` (CDP, port 9309) | every check passes except the four 60 fps checks, see below |
| Build | twice, same bytes; no test hooks, machine paths or emails in `complex-map-workbench.html` |

**Frame rate.** On this machine today the app runs at 12.9 fps idle (p95 116 ms) in headless Chrome, as slow as during
playback (desktop 16.8 fps): another agent's headless Chrome and GeForce NOW were running, load average 5.3 to 5.9.
The earlier quiet run measured 60 fps while playing (p95 17.2 to 18.6 ms, desktop and phone). Re-run `seasong_cmd.js`
and `v15_phone_cmd.js` on a quiet machine before the release. No perf baseline, `accepted.json` or golden image changed.

## The recording: `mountain-king.m4a`

Re-recorded after the verify-2 fix: the app as it plays the piece (example opened, Listen along from the curve's
menu), volume 0.7, worklet engine, sample-exact (`test/sound_rec.js`), 48 kHz, then AAC; WAV and f32 deleted.

- 25.2 s, 48 kHz stereo, 328 KB. 150 onsets, worst 7.5 ms from the score; late 0, gaps 0, at most 24 strings.
- Peak −21.2 dBFS (−18.9 before the fix: the Ds lost their accent string). Main-note peaks by statement −30.7, −26.9,
  −24.2, −22.8 dBFS.
- RMS: statement 1 −43.3, statement 2 −39.1, statement 3 −35.8, coda −38.4 dBFS (the coda window includes the
  ring-out). Statement 1 is as loud as before the fix (−43.2).

The default output here was Bluetooth earbuds at 16 kHz, so this run forced the page's AudioContext to 48 kHz (a
test-only script added before the page loads, as `sound_rec.js` is). To make it again: run `test/seasong_rec_cmd.js` in
the CDP daemon (on a 16 kHz output device, prepend that override), `node test/seasong_wav.js <f32> out.wav`,
`afconvert -f m4af -d aac out.wav mountain-king.m4a`, delete the WAV and the f32.

## Screenshots: `shots/`

Desktop EN (`desk_en_light`, `desk_en_dark`, `desk_en_menu`, `desk_en_playing`, `desk_en_soundoff`, `desk_en_gallery`,
`desk_en_guide`, `desk_en_xy`), desktop RU (`desk_ru_light`, `desk_ru_menu`, `desk_ru_guide`), phone (`phone_en_light`,
`phone_en_light_menu`, `phone_en_light_playing`, `phone_en_dark`, `phone_ru_dark`). `desk_ru_menu.png` predates the
quoted name in «Слушать вдоль кривой «Спираль»».

## Open items

- **The listening check on the Android phone** (verify-6): is the theme instantly recognizable, do the graces stay in
  the background, is statement 1 audible on the phone's speaker, and do the Ds now read as the written octave.
- **The spiral crosses itself** (verify-1, ui-2): 31 self-crossings, radius 0.544 to 1.529; corners are fixed (at most
  11.2°). It comes from F. More space between turns would remove the crossings; the user's decision.
- **60 fps on a quiet machine** (verify-5): re-measure before the release.
- **Not done (optional):** the tour's Sound step does not point to the example.
