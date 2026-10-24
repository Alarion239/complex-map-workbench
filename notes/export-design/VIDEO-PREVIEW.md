# Video preview in the Export dialog (2026-10-24)

The user wrote (2026-10-24):

> When i export figure as movie, it does not show preview moving: it is a still image that updates only on click.

Built in `work/xvv` (a copy of the published v15, `notes/v15-candidate`). The main tree is not touched.

## What it does now

With Format = Video, the dialog plays the video as it will be saved:

- **Poster first.** The still frame at the screen's t shows as before, as soon as it is drawn. Then the video takes
  over in the same place, at the same size, and plays on from that same frame, so the picture does not jump.
- **The whole timeline.** The holds (1.2 s at the ends, 0.6 s between steps), Once, Loop (three runs and the fades
  back to t = 0) and Bounce (there and back), the look (Light or Print), the paths and the t label. It plays at the
  video's frame rate (30 or 60 fps) and starts again at the end.
- **Controls under the picture.** A play/pause button, a scrubber and the time ("3.3 / 7.0 s", t = 1.00). The
  scrubber takes the keyboard: arrows move one frame, Home and End go to the ends. Its `aria-valuetext` reads
  "3.3 s of 7.0 s, t = 1.00". Using the scrubber pauses. A click on the picture plays or pauses.
- **Reduced motion.** When the system asks for reduced motion, the preview waits on the poster frame, paused. The
  scrubber stands at that frame. The note says "Paused: reduced motion is on. Press Play to watch." Only that frame is
  drawn. A scrub draws the frames it lands on, and the note stops asking for Play. Play draws all of them.
- **Paused stays paused.** When you pause and then change an option, the new preview stays paused. Between the
  change and the new frames the bar is dimmed and empty, and Play or Pause there is kept for the new preview.
- **The note under the bar** says what you see: "Preview: drawing the frames, 40 %", then "Preview: the frames of
  the video itself, scaled to fit here (the video is 1920 × 1080)". When the frames are kept compressed it says
  "scaled to fit here and lightly compressed". When they are kept at full size: "the frames of the video itself".
- **A bigger window** (or a sharper screen) draws the frames again at the new size. The picture stays in view, and the
  position and play state hold.
- The top line is now "1280 × 720 · 30 fps · 7.0 s". The old "this frame: t = …" is gone, because the bar shows t.

## The frames are the video's frames

- Each frame is drawn by `videoFrame` with the video's own plan, at the video's own size. This is exactly the
  picture `makeVideo` encodes.
- That picture is scaled down once, to the size the dialog shows it at in device pixels (never less; never more
  than the video's own size). At DPR 2 in a 1440 px window that is 1486 × 836.
- A hold shows its kept frame again. A Loop fade blends two kept frames, the same way `makeVideo` does.
- The test compares preview frame k with frame k decoded back from the saved MP4, both at the preview's size. The
  mean absolute difference is 0.3 to 2.3 of 255. That is the H.264 loss. Against the exact render, scaled the same
  way, it is 0 to 0.04.
- **Memory.** If all the frames fit in 192 MB as plain bitmaps (64 MB on a phone, a tablet, or a device with 4 GB
  or less), they are kept that way, exactly. If not, each frame is kept as a WebP at quality 0.92 (JPEG where the
  browser cannot encode WebP). About 12 frames around the playhead are decoded ahead with `createImageBitmap`. The
  encoding and decoding run off the main thread. So the timeline's length no longer makes the picture smaller.
  Example: 1920 × 1080, 60 fps, 6 s per step, Loop has 721 different frames. They are now kept at 743 × 418 (was
  344 × 194), about 26 KB each. At DPR 2 a 1486 × 836 frame is about 75 KB.
- Compressed frames against the exact render: a mean difference of 1.3 of 255. The saved H.264 video differs from
  the exact render by about the same amount (1.3 to 2.3). Plain frames: 0 to 0.04.

## How it stays smooth

- **One frame per animation frame.** Frames are drawn one at a time, each just after the screen has painted. A
  frame takes 5 to 15 ms, so it fits before the next paint.
- **Coarse to fine.** The order is: the frame in view, both ends, every 16th frame, then every 8th, and so on down
  to every frame. The motion shows at once and fills in. Until a frame is drawn, its nearest drawn neighbour stands
  in. In the test, 121 frames take about 2 s.
- **Cancel and restart.** On an option change the preview stops at once: the stale frames are hidden, the old
  poster dims, and the old bitmaps are freed. When the new poster is drawn, a new preview starts.
- **When it stops.** It stops when the format is not Video and when the dialog closes (also through the
  MutationObserver). While the page is hidden, no frames are drawn. Drawing goes on when the page is shown again. While Save video runs, the preview stops drawing new frames and keeps playing the ones it has.
  After Save video or Cancel, the same frames keep playing; they are not drawn again.
- **Measured** (headless Chrome, 1280 × 720, Phase, while the preview fills and plays; 3 runs): no task of 50 ms
  or more. Animation frames: median 16.7 ms, 95th percentile 16.9 to 17.6 ms, longest 17.6 to 32 ms.

- **Screen readers.** While the video plays, the scrubber does not move when it has focus, and its
  `aria-valuetext` changes at most once a second. A screen reader on it does not read out every frame. A key on it
  starts from the frame in view.

## Review fixes (review-video-preview.json)

| Finding | Fix |
|---|---|
| vp-1 frames softer than the video | Kept at the shown size in device pixels. Too many for memory: WebP 0.92, decoded ahead. The note names the video's size |
| vp-2 Play lost during a restart | With no preview running, the button and scrubber change only the wish. The next preview starts with it. The bar is dimmed and cleared |
| vp-3 resize keeps small frames | `pv.resize`: more than 1.25× the kept width → frames drawn again. The picture, position and play state are kept |
| vp-4 poster, then a jump to t = 0 | Playback starts at the poster's frame |
| vp-5 reduced motion draws everything; stale note | Lazy: only the frame in view, then the frames a scrub needs. Play draws the rest. The note refreshes when the picture shows |
| vp-6 scrubber chatter | While playing, the focused scrubber stays still. `aria-valuetext` changes at most once a second. The t text node is reused |
| vp-7 192 MB on phones; hidden tab drawing | 64 MB of plain frames on a phone, tablet or device with ≤ 4 GB (else compressed). A hidden page waits for `visibilitychange` |
| vp-8 test gap | Section 5b: DPR 2, a 60 fps Loop, and `pw >= min(W, cssW × dpr)` |

Found while fixing, and fixed: a scrubber key read its value only after Pause had reset it, so Right did nothing.
The value is now read first.

## Code

- `src/figure.js`
  - `makePreview(canvas, ui)` (after `videoScreenCheck`): the player. It handles the kept frames, the fill order,
    the clock, play/pause/seek/stop. `pvStats` exists for the tests.
  - The dialog: the `.xf-pv` box (poster, canvas, bar, note), `fitPv`, `poster()` (now starts the preview),
    `posterSoon()` (stops it), `syncFmt` and `close` (stop it).
  - New CSS in `CSS3`. New icons `ICON.play` and `ICON.pause`.
  - `pvRaw()` (the plain-frame budget), `pvMime()` (WebP or JPEG), `pvKeptW()`; the player's `resize`.
  - Test hooks: `dialog().preview` (state, frame(i) (async), entry(i), note, opts) and `__cmwFig.previewStats()`.
- **Strings.** 11 new strings (the review replaced "scaled to {w} × {h}" with three notes that name the video's size);
  Play and Pause reuse the app's own. Russian is in
  `notes/i18n/ru/v15-video-preview.json`, a new file so that `v15-export.json` stays as it is.
  `python3 tools/make_ru_table.py --strict`: unresolved 0.
- **Tests.** `test/export_cmd.js` has a new section 5, and 5b for the review. `CMW_ONLY=preview` runs only those.

## Checks

| Check | Result |
|---|---|
| `export_cmd.js`, whole, after the review fixes (port 9033) | **pass, 0 failures**: 80 figures, the videos, the dialog, section 5 and 5b |
| 5b in detail | DPR 2: frames kept at 1486 × 836, WebP, 12 decoded. The first picture is at t = 1.20. It plays at 29.9 fps (p95 frame 19.1 ms, max 37.6, no long task). Frame k against the MP4: 1.36, against the exact render: 1.27. 60 fps Loop: 721 frames at 743 × 418, plays at 59.6 fps while filling (p95 16.9 ms, max 39.7, no long task). Hidden page: 0 frames drawn in 0.9 s, then it goes on. Restart: the button shows Play, then Pause after the click, and the new preview plays. The focused scrubber's value and text stay still for 1.3 s while it plays. Right steps and pauses. 390 → 1440 px: the frames are drawn again at 743 px (were 306), still playing. Reduced motion: 1 frame drawn, 5 after a scrub, all 121 after Play. 4 GB device: compressed |
| section 5 in detail | The poster shows in about 0.2 s, then the video plays. It runs at 30 to 31 frames a second at 30 fps. Every frame is drawn (a 211-frame timeline, 121 different frames). Frames match the saved MP4 for Once (k = 94), a Loop fade (k = 217) and Bounce on the globe on its way back (k = 269). The button pauses. The keyboard works: Right, End, Home, Space. Save video leaves the preview playing, with no new frames drawn. An option change restarts it. PDF stops it, and back on Video it plays again. Closing the dialog stops it: nothing is drawn after. Reduced motion: it waits paused at t = 1.20 with Play, and Play plays it. No long task |
| first full run | one failure, not in the preview: a 109 ms task in the first plane video of the page. That video was made by `makeVideo` with the dialog closed. The unchanged v15 build had the same kind of task, 50-66 ms, in its first plane video (measured here before any change). This is the open item in ROUND3.md. The second run passed |
| Russian, 360 px light and 760 px dark | the bar and the note fit; no horizontal scroll (`video-preview/pv-ru-*.png`) |
| Node: `t_i18n*.js`, `t_cyr.js`, `t_views.js`, `t_figure_chevron.js` | pass. After the browser run, the two new Russian notes got a no-break space before the em dash. `t_i18n.js` checks this. Only the Russian data changed |
| `make_ru_table.py --strict` | unresolved 0; `src/i18n_ru.js` differs from v15 only by the 9 new strings |

Look at these, in `video-preview/`: `pv-dpr2-compressed-frame.png` (a compressed frame kept at DPR 2, 1486 px),
`export-pv-playing-1440.png` (playing), `export-pv-reduced-1440.png` (reduced
motion, waiting on the poster), `pv-ru-360-light.png` and `pv-ru-760-dark.png`. Also `pv-once-frame.png`,
`pv-loop-fade-frame.png` and `pv-globe-bounce-frame.png`: the preview frames that the test compared with the MP4.

## Open

- The preview shows each frame at the size it is shown, not at the video's full size. The note says so and names the
  video's size. Compressed frames are lossy (about as close to the exact render as the H.264 file is).
- Not measured on iOS/iPadOS Safari (headless Chrome only). Safari cannot encode WebP from a canvas, so it gets JPEG
  at 0.92. The 64 MB budget for touch devices is an estimate, not a measurement.
- The hidden PDF draft is still built when the dialog opens on Video. That was already so; it is not part of this
  change.
- **Merge note.** `notes/i18n/ru/v15-tour-phone.json` appeared in the shared notes during this work (another copy).
  This copy's `src/i18n_ru.js` was made without it, so the patch carries only the preview's strings.
- Changed files: `src/figure.js`, `src/i18n_ru.js` (generated), `tools/ru_report.json` (generated),
  `test/export_cmd.js`, and the new `notes/i18n/ru/v15-video-preview.json` (shared notes; `work/xvv/notes` is a link to them).
