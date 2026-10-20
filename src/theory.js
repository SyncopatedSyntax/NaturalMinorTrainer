// ════════════════════════════════════════════════════════════════════════
//  Scale theory, shared by Natural Minor, Harmonic Minor and Major Scale
//  Trainer (this file is identical in all three repos; src/scale.js picks
//  which scale the app is about). Pure: no React, no DOM.
//
//  The five CAGED shapes come from Zak's charts (charts.js) — ground truth,
//  transposed but never regenerated. The major shapes are his natural minor
//  charts read from the relative major. Everything else (3-notes-per-string,
//  full neck, modes, chords, grips, drills) is generated from the formulas,
//  and scripts/verify.mjs re-derives all of it independently.
// ════════════════════════════════════════════════════════════════════════
import { CHARTS } from './charts.js';

export const OPEN_MIDI = [40, 45, 50, 55, 59, 64];   // s0 = low E … s5 = high e
export const STR_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
export const pc = n => ((n % 12) + 12) % 12;
export const midiAt = (s, f) => OPEN_MIDI[s] + f;
export const ckey = (s, f) => s + '_' + f;
export const unkey = k => k.split('_').map(Number);
const keysOf = cs => new Set(cs.map(c => ckey(c.s, c.f)));
export const pretty = d => String(d).replace(/bb/g, '𝄫').replace(/b/g, '♭').replace(/#/g, '♯');

// ── The scales ───────────────────────────────────────────────────────────
// The three the apps are about, plus the ones they are compared with. Always
// the PARALLEL scale: same root. `family` decides how keys are named;
// `title` is how a key reads ("A natural minor", "C major"). Five-note scales
// carry their own degree names.
export const SCALES = {
  natural:  { id: 'natural',  family: 'minor', title: 'natural minor',  name: 'Natural minor',    short: 'Natural',    iv: [0, 2, 3, 5, 7, 8, 10] },
  harmonic: { id: 'harmonic', family: 'minor', title: 'harmonic minor', name: 'Harmonic minor',   short: 'Harmonic',   iv: [0, 2, 3, 5, 7, 8, 11] },
  melodic:  { id: 'melodic',  family: 'minor', title: 'melodic minor',  name: 'Melodic minor',    short: 'Melodic',    iv: [0, 2, 3, 5, 7, 9, 11] },
  minpent:  { id: 'minpent',  family: 'minor', title: 'minor pentatonic', name: 'Minor pentatonic', short: 'Min pent', iv: [0, 3, 5, 7, 10], labels: ['R', 'b3', '4', '5', 'b7'] },
  major:    { id: 'major',    family: 'major', title: 'major',          name: 'Major scale',      short: 'Major',      iv: [0, 2, 4, 5, 7, 9, 11] },
  majpent:  { id: 'majpent',  family: 'major', title: 'major pentatonic', name: 'Major pentatonic', short: 'Maj pent', iv: [0, 2, 4, 7, 9], labels: ['R', '2', '3', '5', '6'] },
  mixo:     { id: 'mixo',     family: 'major', title: 'Mixolydian',     name: 'Mixolydian',       short: 'Mixolydian', iv: [0, 2, 4, 5, 7, 9, 10] },
  lydian:   { id: 'lydian',   family: 'major', title: 'Lydian',         name: 'Lydian',           short: 'Lydian',     iv: [0, 2, 4, 6, 7, 9, 11] },
};
export const COMPARE_FOR = {
  natural: ['harmonic', 'melodic', 'minpent', 'major'],
  harmonic: ['natural', 'melodic', 'minpent', 'major'],
  major: ['majpent', 'mixo', 'lydian'],
};

// ── Degree names ─────────────────────────────────────────────────────────
// A seven-note scale has degrees 1..7 in order; each one is named by how far
// it sits from the major scale's degree of the same number. That is what
// makes Lydian ♯2's third note a ♯2 (not a ♭3) and Ultralocrian's last one a
// 𝄫7 (not a 6). Root is 'R', as in the toolbox's other trainers.
const MAJ = [0, 2, 4, 5, 7, 9, 11];
const ACC = { '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##' };
export function degreeLabels(ivs) {
  return ivs.map((iv, n) => n === 0 ? 'R' : ACC[String(iv - MAJ[n] > 6 ? iv - MAJ[n] - 12 : iv - MAJ[n])] + (n + 1));
}
const LABELS = Object.fromEntries(Object.values(SCALES).map(S => [S.id, S.labels || degreeLabels(S.iv)]));
export const degOfScale = (scaleId, iv) => LABELS[scaleId][SCALES[scaleId].iv.indexOf(pc(iv))];
const degNumOf = label => label === 'R' ? 1 : Number(label.replace(/\D/g, ''));

// ── Keys and spelling ────────────────────────────────────────────────────
// Keys as usually named: minor keys C♯ and G♯ (not D♭ and A♭ minor), major
// keys D♭ and A♭ (not C♯ and G♯ major). F♯ in both.
const KEY_NAMES_OF = {
  minor: ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'],
  major: ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'],
};
export const keyNames = scaleId => KEY_NAMES_OF[SCALES[scaleId].family];
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'], LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const PLAIN = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
// Spell the note `iv` above a root named `rootName` (pitch class `root`) as
// degree `degNum` (1..7) counted from that root's letter. Single accidentals
// are kept even when unusual — G♯ harmonic minor's 7 is F𝄪 in theory, but C♯
// harmonic minor's B♯ is simply correct. Only a double accidental falls back
// to the plain name.
export function spellDeg(rootName, root, iv, degNum) {
  const target = pc(root + iv);
  const L = (LETTERS.indexOf(rootName[0]) + degNum - 1) % 7;
  let acc = pc(target - LETTER_PC[L]); if (acc > 6) acc -= 12;
  if (acc === 0) return LETTERS[L];
  if (acc === 1) return LETTERS[L] + '♯';
  if (acc === -1) return LETTERS[L] + '♭';
  return PLAIN[target];
}
// A note of a scale, spelled from that scale's degree number. The root is
// named as the APP names its keys (`home`): the minor apps compare G♯ minor
// with G♯ major, not with A♭ major.
export function spellIn(scaleId, root, iv, home = scaleId) {
  return spellOn(keyNames(home)[root], root, scaleId, iv);
}
// The same, from a root already named — a mode's root, say: C♯ Phrygian's
// parallel major is spelled from C♯ even in a key that would call it D♭.
export function spellOn(rootName, root, scaleId, iv) {
  const i = SCALES[scaleId].iv.indexOf(pc(iv));
  return i >= 0 ? spellDeg(rootName, root, iv, degNumOf(LABELS[scaleId][i])) : PLAIN[pc(root + iv)];
}

// ── Modes ────────────────────────────────────────────────────────────────
// Mode k starts on degree k of the parent scale. Its intervals are the parent
// rotated; its degree names follow (degreeLabels). The app keeps the KEY as
// the parent key, so choosing a mode relabels the same shapes from a
// different root — the shapes stay where they are on the neck.
// Each mode carries `use` (what it goes over), `char` (the degree, or two,
// that gives it its sound) and `sound` (one sentence on that). The char
// degree is the one that separates the mode from its nearest neighbour —
// Dorian from Aeolian by the 6, Lydian from Ionian by the ♯4 — and
// verify.mjs checks each one against that neighbour's written formula.
const CHURCH = {
  Ionian:     { char: [], sound: 'The yardstick: every other mode is named by how it differs from this one. Its 4 and 7 are the notes its neighbours change (Lydian raises the 4, Mixolydian lowers the 7).' },
  Dorian:     { char: ['6'], sound: 'The natural 6. Dorian is minor — ♭3 and ♭7 — but its 6 is the major scale\'s, not Aeolian\'s ♭6. That one note makes it the brighter, jazzier minor.' },
  Phrygian:   { char: ['b2'], sound: 'The ♭2, a half step above the root. Lower Aeolian\'s 2 and you have Phrygian\'s dark, Spanish sound.' },
  Lydian:     { char: ['#4'], sound: 'The ♯4. Major with one note raised: the 4 that rubs against a major chord becomes a floating ♯11.' },
  Mixolydian: { char: ['b7'], sound: 'The ♭7. Major with one note lowered — the dominant 7th sound of blues, rock and every V chord.' },
  Aeolian:    { char: ['b6'], sound: 'The ♭6. It is what separates Aeolian from Dorian, and gives the plain minor key its sad pull down to the 5.' },
  Locrian:    { char: ['b5'], sound: 'The ♭5 — the only one of the seven without a perfect 5th, which is why its home chord is m7♭5 and it never quite settles.' },
};
export const MODE_INFO = {
  natural: [
    { name: 'Aeolian (natural minor)', short: 'Aeolian', use: 'The minor key itself: over the i chord, and over iv–v–i or i–♭VI–♭VII rock and pop progressions.', ...CHURCH.Aeolian },
    { name: 'Locrian', short: 'Locrian', use: 'Over the iiø (m7♭5) of a minor ii–V.', ...CHURCH.Locrian },
    { name: 'Ionian (major)', short: 'Ionian', use: 'Over ♭III — the relative major. Same notes, centred on the major chord.', ...CHURCH.Ionian },
    { name: 'Dorian', short: 'Dorian', use: 'Over the iv chord, or any m7 you want brighter than Aeolian.', ...CHURCH.Dorian },
    { name: 'Phrygian', short: 'Phrygian', use: 'Over the v minor chord, and in flamenco and metal riffs.', ...CHURCH.Phrygian },
    { name: 'Lydian', short: 'Lydian', use: 'Over ♭VI maj7 — the dreamiest of the seven.', ...CHURCH.Lydian },
    { name: 'Mixolydian', short: 'Mixolydian', use: 'Over ♭VII7, the dominant that leads back to i in rock (♭VI–♭VII–i).', ...CHURCH.Mixolydian },
  ],
  harmonic: [
    { name: 'Harmonic minor', short: 'Harmonic', use: 'Over the i chord, especially i m(maj7), and for lines that resolve onto i.', char: ['7'], sound: 'The 7 — Aeolian\'s ♭7 raised to a leading tone a half step under the root. The three-fret jump from the ♭6 up to it is the scale\'s exotic sound.' },
    { name: 'Locrian ♮6', short: 'Locrian ♮6', use: 'Over the iiø of a minor ii–V–i.', char: ['6'], sound: 'The natural 6: Locrian with its ♭6 raised. The ♭2 and ♭5 are still there.' },
    { name: 'Ionian ♯5', short: 'Ionian ♯5', use: 'Over ♭III+maj7, the augmented major 7th chord.', char: ['#5'], sound: 'The ♯5: major with the 5th raised, which makes its home chord an augmented +maj7.' },
    { name: 'Dorian ♯4', short: 'Dorian ♯4', use: 'Over the iv m7 when you want an exotic ♯11: Ukrainian Dorian.', char: ['#4'], sound: 'The ♯4: Dorian with the 4 raised. The three-fret jump from the ♭3 up to it is the Ukrainian, klezmer sound.' },
    { name: 'Phrygian dominant', short: 'Phryg. dom.', use: 'Over V7(♭9) resolving to the minor i — the classic minor ii–V–i sound.', char: ['3'], sound: 'The major 3: Phrygian with its ♭3 raised. Above the ♭2 it leaves a three-fret jump — the flamenco and Middle-Eastern sound.' },
    { name: 'Lydian ♯2', short: 'Lydian ♯2', use: 'Over ♭VI maj7 when you want a ♯9 and ♯11: bright and exotic.', char: ['#2'], sound: 'The ♯2: Lydian with the 2 raised, a three-fret jump up from the root, on top of Lydian\'s ♯4.' },
    { name: 'Ultralocrian', short: 'Ultralocrian', use: 'Over vii°7, the diminished chord that stands in for V7♭9.', char: ['b4', 'bb7'], sound: 'The ♭4 and 𝄫7: Locrian with two more notes lowered. They sound like a major 3rd and a 6th, which is why its home chord is a diminished 7th.' },
  ],
  major: [
    { name: 'Ionian (major)', short: 'Ionian', use: 'The major key itself: over the Imaj7 chord, and anything that sits on the home chord.', ...CHURCH.Ionian },
    { name: 'Dorian', short: 'Dorian', use: 'Over the ii m7 — the ii of a ii–V–I.', ...CHURCH.Dorian },
    { name: 'Phrygian', short: 'Phrygian', use: 'Over the iii m7.', ...CHURCH.Phrygian },
    { name: 'Lydian', short: 'Lydian', use: 'Over IVmaj7.', ...CHURCH.Lydian },
    { name: 'Mixolydian', short: 'Mixolydian', use: 'Over V7, the dominant — blues, rock and the V of a ii–V–I.', ...CHURCH.Mixolydian },
    { name: 'Aeolian (natural minor)', short: 'Aeolian', use: 'Over the vi m7 — the relative minor. Same notes, centred on the minor chord.', ...CHURCH.Aeolian },
    { name: 'Locrian', short: 'Locrian', use: 'Over viiø7 (m7♭5), the half-diminished chord.', ...CHURCH.Locrian },
  ],
};
export function modeIvs(scaleId, k) {
  const S = SCALES[scaleId].iv;
  return S.map((_, i) => pc(S[(k + i) % 7] - S[k])).sort((a, b) => a - b);
}
export function mode(scaleId, k) {
  const ivs = modeIvs(scaleId, k);
  return { k, scale: scaleId, offset: SCALES[scaleId].iv[k], ivs, labels: degreeLabels(ivs), ...MODE_INFO[scaleId][k] };
}
// The degree label of a pitch in mode k of the scale in `key`.
export function modeDeg(scaleId, key, k, midiOrPc) {
  const m = mode(scaleId, k);
  return m.labels[m.ivs.indexOf(pc(midiOrPc - key - m.offset))];
}

// ── Chords of the key (7th chords in thirds) ─────────────────────────────
const QUAL = {
  '4,7,11': { q: 'maj7', sym: 'maj7' }, '4,7,10': { q: '7', sym: '7' }, '3,7,10': { q: 'm7', sym: 'm7' },
  '3,7,11': { q: 'mMaj7', sym: 'm(maj7)' }, '3,6,10': { q: 'm7b5', sym: 'm7♭5' }, '3,6,9': { q: 'dim7', sym: '°7' },
  '4,8,11': { q: '+maj7', sym: '+maj7' },
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
export function chordOf(scaleId, k) {
  const S = SCALES[scaleId].iv, root = S[k];
  const tones = [0, 2, 4, 6].map(j => pc(S[(k + j) % 7] - root));
  const qual = QUAL[tones.slice(1).join(',')];
  const label = LABELS[scaleId][k];
  const acc = label.startsWith('b') ? '♭' : label.startsWith('#') ? '♯' : '';
  const minorish = tones[1] === 3;
  let rn = ROMAN[k]; if (minorish) rn = rn.toLowerCase();
  const suffix = qual.q === 'm7b5' ? 'ø7' : qual.q === 'dim7' ? '°7' : qual.q === '+maj7' ? '+maj7'
    : qual.q === 'maj7' ? 'maj7' : qual.q === 'mMaj7' ? '(maj7)' : qual.q === '7' ? '7' : '7';
  return { k, rootIv: root, tones, ...qual, numeral: acc + rn + suffix };
}
export const chordName = (scaleId, key, k) => {
  const c = chordOf(scaleId, k);
  return spellIn(scaleId, key, c.rootIv) + c.sym;
};
// The chord's four notes, by interval above the chord root: the root named as
// the key spells it, then letters stacked in thirds (1, 3, 5, 7) from there.
export function chordSpell(scaleId, key, k) {
  const c = chordOf(scaleId, k);
  const rootName = spellIn(scaleId, key, c.rootIv), croot = pc(key + c.rootIv);
  return Object.fromEntries(c.tones.map((t, j) => [t, spellDeg(rootName, croot, t, [1, 3, 5, 7][j])]));
}
// A playable grip for chord k: a drop-2 voicing on the A–D–G–B strings, root
// in the bass (R, 5th, 7th, 3rd from low to high). Every quality the two
// scales produce fits under the hand within four frets; verify.mjs checks it.
export function grip(scaleId, key, k) {
  const c = chordOf(scaleId, k);
  const rootPc = pc(key + c.rootIv);
  let r = pc(rootPc - OPEN_MIDI[1]); if (r < 3) r += 12;
  const want = [[1, 0], [2, c.tones[2]], [3, c.tones[3]], [4, c.tones[1]]];   // [string, interval above root]
  return want.map(([s, iv]) => {
    const p = pc(rootPc + iv);
    let best = null;
    for (let f = r - 2; f <= r + 4; f++) if (pc(midiAt(s, f)) === p && (best === null || Math.abs(f - r - 1) < Math.abs(best - r - 1))) best = f;
    return { s, f: best, iv };
  });
}

// ── The five CAGED shapes (from the charts) ──────────────────────────────
// Named by the chord shape they are built around — minor for the minor
// scales, major for the major scale — in the order they climb the neck. A
// shape is the same picture in every key; it sits as low as it can with no
// fret below 0.
//
// The major shapes ARE the natural minor charts, read from the relative major
// a minor 3rd up: A minor's E shape is C major's G shape, dot for dot. Each
// is renamed after the open major chord shape it contains (verify.mjs checks
// that). The minor degree labels inside those charts are not used.
export const MAJOR_FROM_MINOR = { E: 'G', D: 'E', C: 'D', A: 'C', G: 'A' };
const CHART_SETS = {
  natural: CHARTS.natural,
  harmonic: CHARTS.harmonic,
  major: Object.fromEntries(Object.entries(CHARTS.natural).map(([id, ch]) => [MAJOR_FROM_MINOR[id], { root: pc(ch.root + 3), cells: ch.cells }])),
};
export const SHAPES_OF = {
  natural: ['E', 'D', 'C', 'A', 'G'],
  harmonic: ['E', 'D', 'C', 'A', 'G'],
  major: ['G', 'E', 'D', 'C', 'A'],
};
export const shapeName = id => `${id} shape`;
// How far chart `id` moves to sit in `key`: the interval up from the chart's
// key, then whole octaves until its lowest fret is 0..11.
export function chartShift(chartSet, key, id) {
  const ch = CHART_SETS[chartSet][id];
  const mn0 = Math.min(...Object.values(ch.cells).flat().map(([f]) => f));
  let d = pc(key - ch.root);
  while (mn0 + d >= 12) d -= 12;
  while (mn0 + d < 0) d += 12;
  return d;
}
export function shapeCells(chartSet, key, id, shift = chartShift(chartSet, key, id)) {
  return Object.entries(CHART_SETS[chartSet][id].cells)
    .flatMap(([s, a]) => a.map(([f]) => ({ s: Number(s), f: f + shift })))
    .sort((a, b) => a.s - b.s || a.f - b.f);
}
// The natural and harmonic versions of one shape, placed TOGETHER: the
// natural shape's place, moved up an octave only if the harmonic one would
// need a fret below 0 (A minor's open A shape has no room for the 7 under
// the open A). Comparing the two must never compare shapes an octave apart.
export function pairShift(key, id) {
  let d = chartShift('natural', key, id);
  const hmin = Math.min(...Object.values(CHARTS.harmonic[id].cells).flat().map(([f]) => f));
  if (hmin + d < 0) d += 12;
  return d;
}
// Label cells for mode k of `scaleId` in `key`; `blue`-style flags are not
// needed here, but the parent degree is kept for drills.
function labelled(cells, scaleId, key, k) {
  return cells.map(c => {
    const m = midiAt(c.s, c.f);
    return { ...c, deg: modeDeg(scaleId, key, k, m), pdeg: degOfScale(scaleId, pc(m - key)) };
  });
}
function finish(cells, meta) {
  const fs = cells.map(c => c.f);
  return { ...meta, cells, lo: Math.min(...fs), hi: Math.max(...fs) };
}
export function cagedShape(scaleId, key, id, k = 0) {
  const shift = chartShift(scaleId, key, id);
  return finish(labelled(shapeCells(scaleId, key, id, shift), scaleId, key, k), { id, kind: 'caged', name: shapeName(id), scale: scaleId, key, k, shift });
}
// ── Three notes per string (generated) ───────────────────────────────────
// Pattern n starts on degree n of the parent scale on the low E, then takes
// the next 18 scale notes three to a string. Numbered by that degree, so the
// number names the same grip in every key.
export function tnpsShape(scaleId, key, n, k = 0) {
  const S = new Set(SCALES[scaleId].iv.map(i => pc(key + i)));
  const startPc = pc(key + SCALES[scaleId].iv[n - 1]);
  const build = f0 => {
    const seq = [];
    for (let m = OPEN_MIDI[0] + f0; seq.length < 18; m++) if (S.has(pc(m))) seq.push(m);
    const cells = [];
    for (let s = 0; s < 6; s++) for (const m of seq.slice(3 * s, 3 * s + 3)) cells.push({ s, f: m - OPEN_MIDI[s] });
    return cells;
  };
  let f0 = pc(startPc - OPEN_MIDI[0]);
  let cells = build(f0);
  if (Math.min(...cells.map(c => c.f)) < 0) cells = build(f0 + 12);
  return finish(labelled(cells, scaleId, key, k), { id: 'T' + n, kind: 'tnps', name: `Pattern ${n}`, scale: scaleId, key, k });
}
export function fullNeck(scaleId, key, k = 0, lo = 0, hi = 15) {
  const S = new Set(SCALES[scaleId].iv.map(i => pc(key + i))), cells = [];
  for (let s = 0; s < 6; s++) for (let f = lo; f <= hi; f++) if (S.has(pc(midiAt(s, f)))) cells.push({ s, f });
  return finish(labelled(cells, scaleId, key, k), { id: 'N', kind: 'neck', name: 'Full neck', scale: scaleId, key, k });
}
// In neck order. Sorting reorders; it never renames.
export function getShapes(scaleId, key, kind = 'caged', k = 0) {
  const list = kind === 'tnps' ? [1, 2, 3, 4, 5, 6, 7].map(n => tnpsShape(scaleId, key, n, k)) : SHAPES_OF[scaleId].map(id => cagedShape(scaleId, key, id, k));
  return list.sort((a, b) => a.lo - b.lo);
}

// One octave of a shape: its lowest root up to the next one (parent root).
export function rootSpan(sh) {
  const roots = [...new Set(sh.cells.filter(c => pc(midiAt(c.s, c.f) - sh.key) === 0).map(c => midiAt(c.s, c.f)))].sort((a, b) => a - b);
  if (roots.length < 2) return [];
  return sh.cells.filter(c => { const m = midiAt(c.s, c.f); return m >= roots[0] && m <= roots[1]; });
}

// ── Comparison ───────────────────────────────────────────────────────────
// This scale against another with the same root, inside one shape's frets:
// shared, only-in-this-scale, and the other scale's extra notes at every
// fret the shape covers. Same rule as Blues Scale Trainer.
//
// One exception. Natural against harmonic inside one of the five shapes uses
// the OTHER CHART, placed at the same spot: Zak drew both, and his harmonic
// shapes do not use every 7 the span happens to hold — they put one a fret
// BELOW the natural shape when that is where the root is. Comparing by span
// would contradict both his charts and the Natural → harmonic drill. (Where
// the other chart would need a fret below 0 — the open A shape in A — that
// note is simply not on the neck.)
const CHART_PAIR = { natural: 'harmonic', harmonic: 'natural' };
//
// `root` moves the other scale's root: a mode is compared with the major
// scale on the MODE's root (D Dorian against D major), while the shape's own
// notes are still the parent key's.
export function compareIn(sh, targetId, root = sh.key) {
  const tp = new Set(SCALES[targetId].iv.map(i => pc(root + i)));
  const bp = new Set(SCALES[sh.scale].iv.map(i => pc(sh.key + i)));
  const shared = [], only = [], extra = [];
  for (const c of sh.cells) (tp.has(pc(midiAt(c.s, c.f))) ? shared : only).push(c);
  if (sh.kind === 'caged' && CHART_PAIR[sh.scale] === targetId && root === sh.key) {
    const mine = keysOf(sh.cells);
    for (const c of shapeCells(targetId, sh.key, sh.id, sh.shift))
      if (c.f >= 0 && !mine.has(ckey(c.s, c.f))) extra.push({ ...c, deg: degOfScale(targetId, midiAt(c.s, c.f) - sh.key) });
    return { shared, only, extra };
  }
  for (let s = 0; s < 6; s++) for (let f = sh.lo; f <= sh.hi; f++) {
    const p = pc(midiAt(s, f));
    if (tp.has(p) && !bp.has(p)) extra.push({ s, f, deg: degOfScale(targetId, p - root) });
  }
  return { shared, only, extra };
}
// In intervals from the root being compared: the scale's own (k = 0) or mode
// k's, against the other scale built on that same root.
export function compareDegrees(scaleId, targetId, k = 0) {
  const b = modeIvs(scaleId, k), t = SCALES[targetId].iv;
  return { shared: b.filter(i => t.includes(i)), only: b.filter(i => !t.includes(i)), extra: t.filter(i => !b.includes(i)) };
}

// ── Practice drills ──────────────────────────────────────────────────────
// Shape cards are `shape|drill` for the five CAGED shapes; mode cards are
// `M1..M7|drill`. Every fretboard drill is answered by selecting the
// COMPLETE set and pressing Check (exact grading — Altered Trainer's lesson).
export const MODE_IDS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];
export const DRILLS = ['root', 'fill', 'octave', 'build', 'spot7', 'spot67', 'spot47', 'nat2har', 'tomel', 'tomix', 'tolyd', 'mwhich', 'mchord'];
export const BLANK = new Set(['octave', 'build']);
export const KEY_DRILLS = new Set(['octave', 'build']);
export const MODE_DRILLS = new Set(['mwhich', 'mchord']);
export const DRILL_FAMILY = { root: 'shape', fill: 'shape', octave: 'shape', build: 'shape', spot7: 'sig', spot67: 'sig', spot47: 'sig', nat2har: 'sig', tomel: 'sig', tomix: 'sig', tolyd: 'sig', mwhich: 'mode', mchord: 'mode' };
// Which drills each trainer offers, and which are on by default.
export const SCALE_DRILLS = {
  natural:  { all: ['root', 'fill', 'octave', 'build', 'spot67', 'nat2har', 'tomel', 'mwhich', 'mchord'], on: ['root', 'fill', 'octave', 'build', 'spot67', 'nat2har', 'mwhich', 'mchord'] },
  harmonic: { all: ['root', 'fill', 'octave', 'build', 'spot7', 'nat2har', 'tomel', 'mwhich', 'mchord'], on: ['root', 'fill', 'octave', 'build', 'spot7', 'nat2har', 'tomel', 'mwhich', 'mchord'] },
  major:    { all: ['root', 'fill', 'octave', 'build', 'spot47', 'tomix', 'tolyd', 'mwhich', 'mchord'], on: ['root', 'fill', 'octave', 'build', 'spot47', 'tomix', 'tolyd', 'mwhich', 'mchord'] },
};
// The morph drills that turn the shape into a neighbouring scale by the span
// rule (cross out what is not in it, add what is, inside the shape's frets).
const MORPH_TO = { tomel: 'melodic', tomix: 'mixo', tolyd: 'lydian' };
export const drillAppliesTo = (drill, cardShape) => MODE_DRILLS.has(drill) ? cardShape[0] === 'M' : cardShape[0] !== 'M';

export const WIN_W = 8;
// The push is capped by the room the shape leaves: a harmonic shape can span
// six frets, so it can only be pushed two in.
export const blankWin = (sh, k = 0) => {
  const push = Math.max(0, Math.min(k, sh.lo, WIN_W - (sh.hi - sh.lo + 1)));
  return { lo: sh.lo - push, hi: sh.lo - push + WIN_W - 1 };
};
export const FILL_BLANKS = 5;
export function blanksFor(sh, n, seed) {
  const idx = sh.cells.map((_, i) => i);
  let x = seed >>> 0;
  for (let i = idx.length - 1; i > 0; i--) { x = (x * 1664525 + 1013904223) >>> 0; const j = x % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, Math.min(n, sh.cells.length)).map(i => sh.cells[i]);
}

// What a fretboard drill draws, in which window, and the exact answer.
//   nat2har — Zak's own charts, as an exercise: the NATURAL shape is drawn;
//             cross out every ♭7 and place every 7. Each 7 sits one fret
//             below a root (verify.mjs proves this of every chart), which is
//             how to find them. The answer is the chart difference exactly.
export function drillSpec(scaleId, drill, key, shapeId, { off = 0, seed = 1 } = {}) {
  const sh = cagedShape(scaleId, key, shapeId);
  if (BLANK.has(drill)) {
    const win = blankWin(sh, off);
    return { sh, shown: [], win, ok: keysOf(drill === 'build' ? sh.cells : rootSpan(sh)), remove: new Set() };
  }
  const win = { lo: sh.lo, hi: sh.hi };
  const isRoot = c => pc(midiAt(c.s, c.f) - key) === 0;
  if (drill === 'root') return { sh, shown: sh.cells, win, ok: keysOf(sh.cells.filter(isRoot)), remove: new Set() };
  if (drill === 'fill') {
    const bk = keysOf(blanksFor(sh, FILL_BLANKS, seed));
    return { sh, shown: sh.cells.filter(c => !bk.has(ckey(c.s, c.f))), win, ok: bk, remove: new Set() };
  }
  if (drill === 'spot7') return { sh, shown: sh.cells, win, ok: keysOf(sh.cells.filter(c => c.pdeg === '7')), remove: new Set() };
  if (drill === 'spot67') return { sh, shown: sh.cells, win, ok: keysOf(sh.cells.filter(c => c.pdeg === 'b6' || c.pdeg === 'b7')), remove: new Set() };
  if (drill === 'spot47') return { sh, shown: sh.cells, win, ok: keysOf(sh.cells.filter(c => c.pdeg === '4' || c.pdeg === '7')), remove: new Set() };
  if (drill === 'nat2har') {
    const d = pairShift(key, shapeId);
    const nat = finish(labelled(shapeCells('natural', key, shapeId, d), 'natural', key, 0), { id: shapeId, scale: 'natural', key, k: 0 });
    const har = finish(labelled(shapeCells('harmonic', key, shapeId, d), 'harmonic', key, 0), { id: shapeId, scale: 'harmonic', key, k: 0 });
    const nk = keysOf(nat.cells), hk = keysOf(har.cells);
    const remove = new Set([...nk].filter(k => !hk.has(k))), add = [...hk].filter(k => !nk.has(k));
    return { sh: nat, shown: nat.cells, win: { lo: Math.min(nat.lo, har.lo), hi: Math.max(nat.hi, har.hi) }, ok: new Set([...remove, ...add]), remove, target: 'harmonic' };
  }
  if (MORPH_TO[drill]) {
    const { only, extra } = compareIn(sh, MORPH_TO[drill]);
    const remove = keysOf(only);
    return { sh, shown: sh.cells, win, ok: new Set([...remove, ...keysOf(extra)]), remove, target: MORPH_TO[drill] };
  }
  return null;
}

// Mode questions. `mwhich`: a chord of the key is named — which mode fits?
// `mchord`: a mode is named — which chord of the key does it go over? Four
// choices, the right one among them, fixed by the seed.
export function modeQuestion(scaleId, drill, key, modeId, seed = 1) {
  const k = Number(modeId.slice(1)) - 1;
  let x = seed >>> 0;
  const rnd = n => { x = (x * 1664525 + 1013904223) >>> 0; return x % n; };
  const others = [0, 1, 2, 3, 4, 5, 6].filter(i => i !== k);
  for (let i = others.length - 1; i > 0; i--) { const j = rnd(i + 1); [others[i], others[j]] = [others[j], others[i]]; }
  const picks = [k, ...others.slice(0, 3)];
  for (let i = picks.length - 1; i > 0; i--) { const j = rnd(i + 1); [picks[i], picks[j]] = [picks[j], picks[i]]; }
  const chordLabel = i => `${chordName(scaleId, key, i)} (${chordOf(scaleId, i).numeral})`;
  return drill === 'mwhich'
    ? { prompt: { kind: 'chord', text: chordLabel(k) }, options: picks.map(i => ({ i, text: MODE_INFO[scaleId][i].name })), answer: k }
    : { prompt: { kind: 'mode', text: `${spellIn(scaleId, key, SCALES[scaleId].iv[k])} ${MODE_INFO[scaleId][k].name}` }, options: picks.map(i => ({ i, text: chordLabel(i) })), answer: k };
}
