# Why round 1 sounds out of tune

Measured on round 1's recording, `notes/sea-song/r2/round1.m4a` (removed, see git history at 099e5f1; a copy of the old `mountain-king.m4a`, 25.2 s,
48 kHz). Method:

- Decode the recording to WAV and align it with round 1's score. The best offset is 0.179 s, found by correlating
  spectral flux with the 150 sounding onsets.
- For each onset, take the spectrum after the onset minus the spectrum before it. The strongest new peak, between
  120 and 2600 Hz, is the note that was added; its frequency gives the note, the octave and the cents.
- To see beating, take long windows over notes that ring alone and list every peak.

The scripts and their results are in `measure/` (`pitch_onsets.py`, `beat.py`, `written_pitch.py`, `r1_notes.json`). The written notes come from round 1's generator
(`work/xvsea-final-snap`).

## What was found

| # | Cause | Measured | Real? |
|---|---|---|---|
| 1 | Wrong notes by design: substitutions | 18 of the 78 theme notes sound a different note. C♯4 became B (6), D (3) or D; E♯4 became E (6); C4 became B (3). | **Yes, the main cause** |
| 2 | Forced crossings sound | 60 of the 63 grace crossings in the theme sound, 18 to 26 dB under their note: 60 notes Grieg did not write. The coda rolls add 9 more. | **Yes** |
| 3 | Octave copies | Every note is 3 or 4 strings an octave apart (123 notes have 4, 27 have 3). The loudest copy leads the next by a median of only 4.4 dB. The loudest new component is the written note +1 octave on 69 notes, +2 octaves on 3, and the written octave on 4, so the heard octave jumps. | **Yes** |
| 4 | Stretched partials and a separate random detune for each string | See the beating measurements below this table. | **Yes** |
| 5 | Timing | Onsets were at most 7.5 ms from the score (round 1's own measure), so timing is not a cause. Strings were capped at 24, with no main note cut short. The low-pass shifts no harmonic. | No |

Details for cause 4, from the ring-out after the last chord (2.35 s alone):

- The two B4 copies are at 494.15 Hz (+0.9 cents) and 495.78 Hz (+6.7 cents): they beat at 1.6 Hz.
- The D5 copies are at 587.57 and 589.50 Hz: they beat at 1.9 Hz.
- The B5 copies are at 988.2 and 990.6 Hz: they beat at 2.4 Hz.

On the A4 half note of statement 1:

- The A5 copy is at 879.4 Hz.
- The A4 string's 2nd partial is at 883.7 Hz. That is 8.5 cents apart, so they beat at about 4 Hz.
- The A4 string's partials 3 and 5 are +14.8 and +21 cents sharp of equal temperament (the formula gives +12.5 and
  +35 cents).

The fundamentals of the loudest copies are on average +1.5 cents sharp (SD 2.7, range −7.9 to +7.2). This matches the
formula's +1.4 cents on partial 1 plus each string's own ±3 cents.

### In short

What the user hears as "out of tune" is, in order of weight:

1. 18 wrong notes a play, on purpose (the five strings).
2. About 70 soft notes that are not in the score.
3. Each note is a chord of octaves that beat against each other at 1.5 to 4.5 Hz.
4. The loudest octave moves between notes.

Timing is fine.

## What round 2 does about each

1. **Its own strings.** The piece gets its own lines of the Phase key: line L at arg F = 30°·L plucks D + L semitones.
   It uses exactly the pitch classes Grieg writes: B, C, C♯, D, E, E♯ (= F), F♯ and A, which are lines 9, 10, 11, 0,
   2, 3, 4 and 7. No note is substituted. The pointer harp keeps its five strings (0, 2, 4, 7, 9).
2. **Silent crossings.** In a piece, every crossing that is not a written note has velocity 0 and takes no string.
   Only the written notes, the coda's chord notes and the drum sound.
3. **One clear octave.** A piece's note is one string at the written pitch (MIDI, from the score), plus one soft string
   an octave above (−10 dB, a pure octave) for small speakers. There are no Gaussian copies.
4. **An in-tune pluck, for the harp only.** Harp partials get harp-like small inharmonicity: fn = f·n·√((1 + B n²)/(1 + B))
   with B = 1e-4, which is +0.3, +0.7, +1.3 and +2.1 cents at partials 2 to 5, and 0 cents on partial 1. One detune
   (±1.5 cents) is shared by every string of a note, so octaves are pure. This also applies to the pointer harp. The
   other palette-B cues that use `pluck` (the branch-cut cue, which is also the piece's drum) keep their old pluck
   unchanged.

## Result

The same measurement on round 2's recording is in `AS-BUILT.md`:

- All 90 onsets are written notes.
- All 90 are within ±2.2 cents of the written pitch, in the written octave.
- The ring-out has no beating doublets.
