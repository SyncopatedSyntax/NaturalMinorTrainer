# Natural Minor · Harmonic Minor · Major Scale Trainer — project context

**Three apps, one codebase.** `natural-minor-trainer` (repo
NaturalMinorTrainer), `harmonic-minor-trainer` (repo HarmonicMinorTrainer) and
`major-scale-trainer` (repo MajorScaleTrainer) share every file in `src/` and
`scripts/` except **`src/scale.js`**, which says which scale the app is about.
This CLAUDE.md is the same in all three repos. **A change to a shared file is
made in all three repos**, or they drift; check with
`for f in src/*.js* scripts/verify.mjs; do cmp $f ../<other>/$f; done`
(only `scale.js` may differ). The app component is `src/ScaleTrainer.jsx`
(it was `MinorTrainer.jsx` before Major joined).

Each teaches its scale in Zak's five CAGED shapes, plus generated
three-notes-per-string patterns and the full neck. It covers the scale's seven
modes and the seven chords of the key (Scale Map), compares the scale with
its neighbours (see Comparison), and drills it all with spaced repetition.
Part of the **Fretworks** toolbox; the practice side is Altered / Blues
Trainer's design. Single dev + end user: Zak.

- Toolbox-wide conventions (git-dep workflow, multi-zone, single PWA,
  verify-in-prod, accounts + sync rules, naming): the Fretworks root
  `CLAUDE.md` (fretworks-docs).

## Commands
- `npm install`, `npm run dev` (natural 5188, harmonic 5189, major 5190),
  `npm run build`
- `npm run verify` — **the correctness gate** (41,307 assertions; checks
  all three scales, so it is the same script in every repo). Must pass.

## Integration
| | Natural | Harmonic | Major |
|---|---|---|---|
| registry key | `nm` | `hm` | `major` |
| path / Vite base | `/natural-minor/` | `/harmonic-minor/` | `/major/` |
| accent | rose pink `#f472b6` | lime `#a3e635` | sky cyan `#22d3ee` |
| emoji | 🌙 | 🎻 | ☀️ |
| storage prefix | `nm_` | `hm_` | `mj_` |
| Vercel project | natural-minor-trainer | harmonic-minor-trainer | major-scale-trainer (domain `-murex`) |
| home key | A minor | A minor | C major |

Learning path: Blues → **Major → Natural → Harmonic** → Melodic Minor.
Keys (all JSON, written by `jstore`): `root`, `label`, `settings`, `view`
(`{view, shape, tn}`), `mode`, `focus`, `srs`, `ios_hint` (device-only).
Read synchronously in `useState` initialisers — never at module load (sync
rule 1).

## Files
- `src/scale.js` — the one per-app file.
- `src/charts.js` — **ground truth**: Zak's ten charts (5 natural + 5
  harmonic), transcribed dot for dot and confirmed by him. Identical in all
  three repos. Pinned by checksum in verify.mjs. **Never regenerate or
  "correct".** There are no major charts — see "The major shapes".
- `src/theory.js` — pure: scales, degree names, spelling, modes, chords,
  grips, shapes, comparison, drill answers.
- `src/srs.js` — pure: SM-2 (Triad's), cards, readiness, Next up, weak spots,
  forecast, queue. Ported from Blues.
- `src/audio.js` — the toolbox audio stack (see Audio).
- `src/Fretboard.jsx` — the sideways neck (Blues', minus the blue-note
  diamond).
- `src/ScaleTrainer.jsx` — App and every tab. Per-scale differences are
  looked up at the top (`by({ natural, harmonic, major })`, `KEYS`,
  `SHAPE_IDS`, `HOME_KEY`, `COMMON_KEYS`, `RELATIVE`) — never `if` on the
  scale deep in a component.
- `scripts/verify.mjs` — re-derives everything from first principles.

## The shapes

Named by the minor chord shape each is built around — **E, D, C, A, G** —
and in any key they climb the neck in exactly that order, end to end
(verify.mjs proves it in all 12 keys). A shape is the same picture in every
key; `chartShift()` moves a chart to the key and then by octaves until its
lowest fret is 0–11. `getShapes()` returns them in **neck order**, so the
arrows may start on any of the five. Not a bug.

What the charts turned out to obey (all pinned in verify.mjs):
- **Harmonic chart = natural chart with every ♭7 replaced by a 7 one fret
  up**, nothing else moved — plus one extra 7: the E shape's low E, 4th fret
  (in A).
- **Every 7 sits one fret below a root on the same string.** That is how the
  drills tell you to find them.
- A harmonic shape can reach one fret below and one above the natural one, so
  harmonic shapes span up to six frets.

### The major shapes
**The natural minor charts, read from the relative major** (a minor 3rd up),
and renamed after the open major chord shape each contains:
E→**G**, D→**E**, C→**D**, A→**C**, G→**A** (`MAJOR_FROM_MINOR`). So C major's
G shape is A minor's E shape, dot for dot, and the major ladder is
**G E D C A**, climbing the neck in that order. `CHART_SETS.major` is built
from `CHARTS.natural` at load; the minor degree labels inside are unused.
verify.mjs proves each major shape holds **exactly one** open major chord
grip (C A G E D, typed in by hand) and that it is the one in its name.

Shape ids are per scale (`SHAPES_OF`), so `srs.js` takes the app's list
(`cardShapes(scaleId)`) everywhere — there is no global shape list.

`pairShift(key, id)` places the natural and harmonic versions of a shape
**together**. In A minor the natural A shape sits at the nut (frets 0–3) but
the harmonic one needs fret −1 for its 7, so `chartShift` puts the two an
octave apart. Anything that compares the two shapes must use `pairShift`.

## Modes, chords, grips
**A mode keeps the root you chose** (Zak, 2026-10 — it used to keep the
parent key, so C major → Mixolydian showed G Mixolydian). With C chosen,
Mixolydian is **C Mixolydian**: the notes of its parent, F major
(`modeParent`), counted from C, in **F major's shapes**, named after them —
"A shape (F major)" — so the name can change when the mode does (Zak's pick
over keeping "E shape").

`modeShapes(scale, root, kind, k)` places each parent shape where it keeps the
root where one of the scale's own shapes has it (`twinShape`: match on the
root's places with the fret folded into one octave, then the nearest copy),
and `carryShape` is what a mode switch calls (App `changeMode`), so the shape
you were looking at becomes the one with the root in the same places, and
switching back returns it. verify.mjs pins, for every key and mode of all
three scales: all five shapes once; root places identical (major 359/360,
natural 350/360, harmonic 340/360 — some harmonic shapes carry an extra
root); and the only moves allowed are a fret of shape-edge difference or an
octave where the twin would need a fret below the nut (≤1 / 10 / 8 cases).
Three-notes-per-string patterns are not always one-to-one; there the
parent's own list is used and only the choice of pattern follows the root.

Mode notes are spelled from **your root's name by the mode's degree
numbers** (`spellMode`): C Phrygian's 2 is D♭, D♭ Mixolydian's ♭7 is C♭.
Spelling from the parent key (the old way) would name D♭ Mixolydian's root C♯
whenever the app calls the parent F♯.

The **Modes tab and Scale Map stay the modes of the key** — D Dorian over the
ii of C major — because that is their point (which mode fits which chord).
Their buttons say what they do: "See C Dorian on the neck" sets the mode and
keeps the root (Zak chose that over moving the key to D).
On **Positions** the heading above the key buttons follows the mode — "C
Mixolydian · notes of F major" instead of "C major · relative minor A"; on
every other tab it stays the key. `modeTitle` / `parentTitleOf` build both
names, for the heading, the Positions tab and the Guide's example alike.
Degree names come from `degreeLabels()`, which measures each degree against
the major scale's degree **of the same number** — so Lydian ♯2 has a ♯2, not
a ♭3, and Ultralocrian has a 𝄫7.

Each mode in `MODE_INFO` carries `use` (what it goes over), `char` (the
degree, or two, that gives it its sound) and `sound` (one sentence on it).
`char` is defined as **the degree that separates the mode from its nearest
neighbour** — Dorian's 6 from Aeolian, Lydian's ♯4 from Ionian, Phrygian
dominant's 3 from Phrygian, Ultralocrian's ♭4 and 𝄫7 from Locrian. Ionian has
none (it is the yardstick). verify.mjs types each neighbour's formula and
checks the two differ at exactly the `char` degrees, and checks every
"three-fret jump" a sound line claims. Shown as "Its sound" under the mode
description on Positions and in the Modes tab, and ringed in the colour key
and in the Modes tab chips.

Chords are 7ths stacked in thirds:
- **Natural:** i7 iiø7 ♭IIImaj7 iv7 v7 ♭VImaj7 ♭VII7.
- **Harmonic:** i(maj7) iiø7 ♭III+maj7 iv7 V7 ♭VImaj7 vii°7.
- **Major:** Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7.

`grip()` is a drop-2 voicing: root on the A string, then the 5th, 7th and
3rd on D, G and B. It always fits within four frets.

Spelling is by degree (C minor's ♭6 is A♭). Keys are named per family
(`keyNames`): minor C♯ and G♯, major D♭ and A♭, F♯ in both. A compared scale
is spelled from the **app's** key name (`spellIn(…, home)`): G♯ minor's
parallel major is G♯ major, not A♭. Grip notes are spelled by `chordSpell`,
letters stacked in thirds from the chord root as the key names it (C minor's
♭VI is A♭ C E♭ G — it used to come out as G♯…). The only key that needs a
double accidental is G♯ harmonic minor (its 7 is F𝄪), which falls back to
the plain name G.

## Comparison
Against the **parallel** scale (same root). Inside a shape: `shared`, `only`
(ringed), `extra` (dashed — the other scale's notes **at every fret the shape
covers**, Blues' rule), labelled in the other scale's own degree names (so
Lydian's is a ♯4, not a ♭5). Lists: natural → harmonic, melodic, minor
pentatonic, major; harmonic → natural, melodic, minor pentatonic, major;
major → major pentatonic, Mixolydian, Lydian (Zak's pick — no parallel
minor).

**With a mode picked** (any but the first), the only option is the scale the
mode is a variation of, **on the mode's own root**, chosen by its 3rd
(`parallelOf`): the **major scale** if the 3rd is major, the **natural minor**
if it is ♭3. So D Dorian is laid against D natural minor and only its 6 is
left — exactly its `char` note — where against D major the ♭3 and ♭7 every
minor mode has would bury it. (Zak asked for this after a first version
compared every mode with major.) Minor-based: Dorian, Phrygian, Locrian,
Locrian ♮6, Dorian ♯4, Ultralocrian. Major-based: Lydian, Mixolydian, Ionian
♯5, Phrygian dominant, Lydian ♯2. A mode that *is* that scale (Aeolian in
Major, Ionian in Natural Minor) gets no compare row. For modes `cmp` holds
`'parallel'`, not a scale id, so stepping from a minor mode to a major one
keeps the comparison on. `compareIn(sh, target, modeRoot)` keeps the shape's
own notes in the parent key and moves only the other scale's root;
`compareDegrees(scale, target, k)` gives the chips; extras are spelled from
the mode root's name (`spellOn`), so C♯ Phrygian's parallel major would read
E♯ and B♯, not F and C. verify.mjs types the expected target for every mode.

**One exception:** natural ↔ harmonic inside one of the five shapes uses the
**other chart at the same spot**. The span rule disagreed with Zak's harmonic
charts in four of the five shapes. It marked 7s his charts do not use, and
missed the ones a fret below the natural shape. That contradicted both his
charts and the Natural → harmonic drill. verify.mjs pins that "shape − only +
extra" is exactly the other chart.

## Practice
Cards are `shape|drill` for the five shapes (E/D/C/A/G in the minor apps,
G/E/D/C/A in Major) and `M1..M7|drill` for the modes. The
key is a per-rep variable, never part of the card id.

Drills (`SCALE_DRILLS` decides which app gets which, and which are on by
default):
- **The shape:** `root`, `fill`, `octave`\*, `build`\*.
- **The signature notes:**
  - Natural: `spot67` (every ♭6 and ♭7), `nat2har`, `tomel` (off by default).
  - Harmonic: `spot7`, `nat2har`, `tomel`.
  - Major: `spot47` (every 4 and 7 — what the pentatonic leaves out),
    `tomix` (7 → ♭7), `tolyd` (4 → ♯4). All three are about the 4 and the
    7, which is what separates major from its neighbours.
- **Modes:** `mwhich` (a chord is named → which mode), `mchord` (a mode is
  named → which chord). Four choices.

How the morph drills work:
- **`nat2har`** draws the **natural** chart in both apps. You cross out every
  ♭7 and place every 7, using `pairShift` so the two charts line up. The
  answer is the chart difference exactly.
- **`tomel`, `tomix`, `tolyd`** use the span rule (`MORPH_TO`; there are no
  charts for those scales).
- In both, a tapped dot is crossed out and a tapped empty fret is added.

\* **Blank-neck drills** (`BLANK`) use an 8-fret window, with the shape
pushed 0–3 frets in. The push is capped by `8 − span`, because harmonic
shapes can be six frets wide. Only these drills count toward key coverage
(`KEY_DRILLS`).

Mode cards are ready on reps alone: they have no fretboard and no key
picture.

Everything else is Altered Trainer's design, and its CLAUDE.md explains why:
- exact-set grading, with an "N of M" counter
- a three-tier queue that cycles with modulo; `dueOnly` never pads
- narrow pools get `pool × READY_REPS` questions
- `isLearned` (reps ≥ 2) is separate from readiness (reps ≥ 3 + six keys)
- `seen`/`wrong` counters, never back-filled
- Next up priority and the Weak spots threshold
- the forecast puts new cards in no bucket

## UI notes
- Card borders are **longhands** (`borderWidth/Style/Color`, `#2a2840`).
  Never use the `border` shorthand on an element whose `borderColor` changes:
  React wipes the colour and the border renders white.
- Drill boards: `rowH={36}`, full-bleed (`margin: 0 -12px`), and the tap grid
  is the last SVG child.
- The fret number for fret 0 is not drawn (the nut is).
- The Compare row offers the app's neighbour list for mode 1, and the
  matching major or natural minor on the mode's root for the others (see
  Comparison).

## Audio
Copied from Blues/Altered. It covers the two-layer iOS silent-switch bypass,
the shared bus + limiter, and idle-suspend. See root `CLAUDE.md → Audio`;
don't regress.

## Not built yet
- Melodic minor as a fourth app on this codebase. The Melodic Minor Trainer
  already exists with its own `CAGED_MM` (ported from Altered). Merging it in
  would need its charts checked against this layout first.
- Licks / cadence phrases (a V7♭9 → i line is the obvious first one for
  harmonic minor).

## Before shipping any change
- `npm run verify` and `npm run build` must pass — **in all three repos**.
- Check at ~393px in the browser; for drills, tap accuracy on a real iPhone.
