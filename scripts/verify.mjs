// Correctness gate for Natural Minor, Harmonic Minor and Major Scale Trainer
// (identical in all three repos — it checks all three scales).
//
//   node scripts/verify.mjs
//
// It imports the app's functions to TEST them, never to produce an
// expectation. Expected values come from: the tuning (pitch names), scale
// formulas written as degree names, Zak's charts (pinned by checksum), and
// arithmetic on those.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { CHARTS } from '../src/charts.js';
import * as T from '../src/theory.js';
import * as R from '../src/srs.js';

let failures = 0, assertions = 0;
const check = (name, fn) => { try { fn(); console.log(`  ✓ ${name}`); } catch (e) { failures++; console.log(`  ✗ ${name}\n      ${e.message}`); } };
const fail = m => { throw new Error(m); };
const eq = (got, want, what) => { assertions++; if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`); };
const ok = (c, what) => { assertions++; if (!c) fail(what); };
const setEq = (a, b, what) => eq([...a].sort(), [...b].sort(), what);

// ── First principles ─────────────────────────────────────────────────────
const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midiOf = n => { const m = n.match(/^([A-G])(\d)$/); return 12 * (+m[2] + 1) + LETTER[m[1]]; };
const TUNING = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'].map(midiOf);
const at = (s, f) => TUNING[s] + f;
const mod = n => ((n % 12) + 12) % 12;
const MAJOR = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 };
const semis = d => { if (d === 'R' || d === '1') return 0; const m = String(d).match(/^(bb|b|#|)(\d)$/); return mod(MAJOR[m[2]] + ({ bb: -2, b: -1, '#': 1, '': 0 })[m[1]]); };
const FORMULA = {
  natural: ['1', '2', 'b3', '4', '5', 'b6', 'b7'],
  harmonic: ['1', '2', 'b3', '4', '5', 'b6', '7'],
  melodic: ['1', '2', 'b3', '4', '5', '6', '7'],
  minpent: ['1', 'b3', '4', '5', 'b7'],
  major: ['1', '2', '3', '4', '5', '6', '7'],
  majpent: ['1', '2', '3', '5', '6'],
  mixo: ['1', '2', '3', '4', '5', '6', 'b7'],
  lydian: ['1', '2', '3', '#4', '5', '6', '7'],
};
const IV = Object.fromEntries(Object.entries(FORMULA).map(([k, v]) => [k, v.map(semis)]));
const pcs = (id, key) => new Set(IV[id].map(i => mod(key + i)));
const KEYS = [...Array(12).keys()];
const SC = ['natural', 'harmonic', 'major'];
const MINORS = ['natural', 'harmonic'];
const MINOR_IDS = ['E', 'D', 'C', 'A', 'G'];
// The major shapes, built here from the natural charts by hand: the relative
// major is a minor 3rd up, and each is named after the open major chord shape
// it holds (checked below, from the chord grips typed in).
const REL = { E: 'G', D: 'E', C: 'D', A: 'C', G: 'A' };
const CH = { natural: CHARTS.natural, harmonic: CHARTS.harmonic, major: {} };
for (const [id, ch] of Object.entries(CHARTS.natural)) CH.major[REL[id]] = { root: mod(ch.root + 3), cells: ch.cells };
const IDS = { natural: MINOR_IDS, harmonic: MINOR_IDS, major: ['G', 'E', 'D', 'C', 'A'] };
const keysOf = cs => cs.map(c => `${c.s}_${c.f}`);

console.log('\nThe charts (ground truth)');
check('pinned: Zak’s ten charts have not been edited or regenerated', () => {
  const h = createHash('sha256').update(JSON.stringify(CHARTS)).digest('hex').slice(0, 16);
  eq(h, 'dff062051f94d2ee', 'charts checksum');
});
check('every dot on every chart is the note its label says, in the chart’s key', () => {
  for (const set of MINORS) for (const [id, ch] of Object.entries(CHARTS[set])) for (const [s, arr] of Object.entries(ch.cells)) for (const [f, d] of arr) {
    eq(mod(at(+s, f) - ch.root), semis(d), `${set} ${id} string ${s} fret ${f} (${d})`);
    ok(pcs(set, ch.root).has(mod(at(+s, f))), `${set} ${id} ${s}/${f} is in the scale`);
  }
});
check('every chart holds every degree of its scale at least once, and roots in two octaves', () => {
  for (const set of SC) for (const [id, ch] of Object.entries(CH[set])) {
    const cells = Object.entries(ch.cells).flatMap(([s, a]) => a.map(([f]) => at(+s, f)));
    setEq([...new Set(cells.map(m => mod(m - ch.root)))].map(String), IV[set].map(String), `${set} ${id} degrees`);
    ok(new Set(cells.filter(m => mod(m - ch.root) === 0)).size >= 2, `${set} ${id}: two roots`);
  }
});
check('harmonic chart = natural chart with every ♭7 swapped for a 7 (nothing else moves)', () => {
  for (const id of MINOR_IDS) {
    const n = CHARTS.natural[id], h = CHARTS.harmonic[id];
    eq(h.root, n.root, `${id} same key`);
    const list = (ch, keep) => Object.entries(ch.cells).flatMap(([s, a]) => a.filter(([, d]) => keep(d)).map(([f]) => `${s}_${f}`)).sort();
    eq(list(h, d => d !== '7'), list(n, d => d !== 'b7'), `${id}: every other note unchanged`);
    const b7 = Object.entries(n.cells).flatMap(([s, a]) => a.filter(([, d]) => d === 'b7').map(([f]) => at(+s, f)));
    const s7 = Object.entries(h.cells).flatMap(([s, a]) => a.filter(([, d]) => d === '7').map(([f]) => at(+s, f)));
    for (const m of b7) ok(s7.includes(m + 1), `${id}: the ♭7 at midi ${m} has its 7 a half step up`);
  }
});
check('in every harmonic chart, each 7 sits one fret below a root on the same string (the leading tone)', () => {
  for (const [id, ch] of Object.entries(CHARTS.harmonic)) for (const [s, arr] of Object.entries(ch.cells)) for (const [f, d] of arr)
    if (d === '7') eq(mod(at(+s, f + 1) - ch.root), 0, `${id} string ${s} fret ${f}`);
});
check('the only 7 that is not a replaced ♭7 is the E shape’s low E, 4th fret (A minor)', () => {
  const extra = [];
  for (const id of MINOR_IDS) {
    const b7 = Object.entries(CHARTS.natural[id].cells).flatMap(([s, a]) => a.filter(([, d]) => d === 'b7').map(([f]) => at(+s, f)));
    for (const [s, a] of Object.entries(CHARTS.harmonic[id].cells)) for (const [f, d] of a) if (d === '7' && !b7.includes(at(+s, f) - 1)) extra.push(`${id}:${s}/${f}`);
  }
  eq(extra, ['E:0/4'], 'extra 7s');
});
check('each major shape holds the open major chord it is named after, and no other', () => {
  // Open chord grips, low E to high e (-1 = not played), and the chord's root.
  const GRIPS = { C: [0, [-1, 3, 2, 0, 1, 0]], A: [9, [-1, 0, 2, 2, 2, 0]], G: [7, [3, 2, 0, 0, 0, 3]], E: [4, [0, 2, 2, 1, 0, 0]], D: [2, [-1, -1, 0, 2, 3, 2]] };
  for (const [id, ch] of Object.entries(CH.major)) {
    const cells = new Set(Object.entries(ch.cells).flatMap(([s, a]) => a.map(([f]) => `${s}_${f}`)));
    const holds = Object.entries(GRIPS).filter(([, [r, fr]]) => [-12, 0, 12].some(o => { const d = mod(ch.root - r) + o; return fr.every((f, s) => f < 0 || cells.has(`${s}_${f + d}`)); })).map(([g]) => g);
    eq(holds, [id], `major ${id} shape holds`);
  }
});
check('the major shapes are the natural minor charts read from the relative major', () => {
  for (const [mi, ma] of Object.entries(REL)) for (const key of KEYS) {
    const a = T.cagedShape('natural', key, mi), b = T.cagedShape('major', mod(key + 3), ma);
    setEq(keysOf(b.cells), keysOf(a.cells), `${mi} in ${key} minor = ${ma} in its relative major`);
  }
});

console.log('\nShapes in every key');
check('every shape, every scale, all 12 keys: right notes, right labels, same picture, as low as it fits', () => {
  for (const set of SC) for (const id of IDS[set]) {
    const ref = T.cagedShape(set, 0, id);
    const pic = sh => sh.cells.map(c => `${c.s}:${c.f - sh.lo}`).join(' ');
    for (const key of KEYS) {
      const sh = T.cagedShape(set, key, id);
      eq(pic(sh), pic(ref), `${set} ${id} key ${key}: same picture`);
      ok(sh.lo >= 0 && sh.lo < 12, `${set} ${id} key ${key}: lowest fret ${sh.lo} in 0..11`);
      for (const c of sh.cells) {
        ok(pcs(set, key).has(mod(at(c.s, c.f))), `${set} ${id} ${key}: ${c.s}/${c.f} in scale`);
        eq(semis(c.deg), mod(at(c.s, c.f) - key), `${set} ${id} ${key} ${c.s}/${c.f} label`);
      }
      // the chart itself, moved by a whole number of semitones
      const ch = CH[set][id], d = sh.cells[0].f - ch.cells[sh.cells[0].s][0][0];
      ok(mod(d - (key - ch.root)) === 0, `${set} ${id} ${key}: moved by the key interval`);
    }
  }
});
check('in one key the five shapes climb the neck in the CAGED order and overlap their neighbours', () => {
  for (const set of SC) for (const key of KEYS) {
    const order = T.getShapes(set, key).map(s => s.id);
    const i = order.indexOf(IDS[set][0]);
    const cyc = [...order.slice(i), ...order.slice(0, i)];
    eq(cyc.join(''), set === 'major' ? 'GEDCA' : 'EDCAG', `${set} key ${key} neck order`);
    eq(T.SHAPES_OF[set], IDS[set], `${set} ladder order`);
  }
  for (const set of SC) for (const key of KEYS) {
    const sh = IDS[set].map(id => T.cagedShape(set, key, id));
    for (let j = 0; j < 5; j++) {
      const a = sh[j], b = sh[(j + 1) % 5];
      const bLo = b.lo < a.lo ? b.lo + 12 : b.lo;
      ok(bLo <= a.hi + 1, `${set} key ${key}: ${a.id} (${a.lo}-${a.hi}) and ${b.id} (${b.lo}) leave no gap`);
    }
  }
});
check('natural and harmonic versions of a shape, placed together, line up (no octave apart)', () => {
  for (const key of KEYS) for (const id of MINOR_IDS) {
    const d = T.pairShift(key, id);
    const n = T.shapeCells('natural', key, id, d), h = T.shapeCells('harmonic', key, id, d);
    ok(Math.min(...h.map(c => c.f)) >= 0, `${id} key ${key}: harmonic on the neck`);
    const common = keysOf(n).filter(k => keysOf(h).includes(k));
    ok(common.length >= n.length - 3, `${id} key ${key}: share all but the ♭7s`);
  }
});

console.log('\nThree notes per string and the full neck');
check('pattern n starts on degree n, three scale notes a string, rising, in every key', () => {
  for (const set of SC) for (const key of KEYS) for (let n = 1; n <= 7; n++) {
    const sh = T.tnpsShape(set, key, n);
    for (let s = 0; s < 6; s++) eq(sh.cells.filter(c => c.s === s).length, 3, `${set} ${key} P${n} string ${s}`);
    const ps = [...sh.cells].sort((a, b) => a.s - b.s || a.f - b.f).map(c => at(c.s, c.f));
    for (let i = 1; i < ps.length; i++) ok(ps[i] > ps[i - 1], `${set} ${key} P${n} rising`);
    ok(ps.every(p => pcs(set, key).has(mod(p))), `${set} ${key} P${n} in scale`);
    eq(mod(ps[0] - key), IV[set][n - 1], `${set} ${key} P${n} starts on degree ${n}`);
    ok(sh.lo >= 0, 'on the neck');
  }
});
check('full neck: every scale note on frets 0-15, nothing else', () => {
  for (const set of SC) for (const key of KEYS) {
    const want = []; for (let s = 0; s < 6; s++) for (let f = 0; f <= 15; f++) if (pcs(set, key).has(mod(at(s, f)))) want.push(`${s}_${f}`);
    setEq(keysOf(T.fullNeck(set, key).cells), want, `${set} ${key}`);
  }
});

console.log('\nModes');
const MODE_FORMULA = {
  natural: [['1 2 b3 4 5 b6 b7', 'Aeolian'], ['1 b2 b3 4 b5 b6 b7', 'Locrian'], ['1 2 3 4 5 6 7', 'Ionian'], ['1 2 b3 4 5 6 b7', 'Dorian'], ['1 b2 b3 4 5 b6 b7', 'Phrygian'], ['1 2 3 #4 5 6 7', 'Lydian'], ['1 2 3 4 5 6 b7', 'Mixolydian']],
  major: [['1 2 3 4 5 6 7', 'Ionian'], ['1 2 b3 4 5 6 b7', 'Dorian'], ['1 b2 b3 4 5 b6 b7', 'Phrygian'], ['1 2 3 #4 5 6 7', 'Lydian'], ['1 2 3 4 5 6 b7', 'Mixolydian'], ['1 2 b3 4 5 b6 b7', 'Aeolian'], ['1 b2 b3 4 b5 b6 b7', 'Locrian']],
  harmonic: [['1 2 b3 4 5 b6 7', 'Harmonic minor'], ['1 b2 b3 4 b5 6 b7', 'Locrian'], ['1 2 3 4 #5 6 7', 'Ionian'], ['1 2 b3 #4 5 6 b7', 'Dorian'], ['1 b2 3 4 5 b6 b7', 'Phrygian dominant'], ['1 #2 3 #4 5 6 7', 'Lydian'], ['1 b2 b3 b4 b5 b6 bb7', 'Ultralocrian']],
};
check('each mode’s intervals and degree names, from the written formulas', () => {
  for (const set of SC) MODE_FORMULA[set].forEach(([f, name], k) => {
    const m = T.mode(set, k);
    eq(m.ivs, f.split(' ').map(semis), `${set} mode ${k + 1} intervals`);
    eq(m.labels.join(' '), f.replace(/^1/, 'R'), `${set} mode ${k + 1} names`);
    ok(m.name.startsWith(name), `${set} mode ${k + 1} is ${name} (got ${m.name})`);
    eq(m.offset, IV[set][k], 'starts on degree k');
  });
});
// The degree that gives each mode its sound, and the neighbour it is told
// apart from — written as formulas here, so the claim is checked, not copied.
const F = {
  Ionian: '1 2 3 4 5 6 7', Dorian: '1 2 b3 4 5 6 b7', Phrygian: '1 b2 b3 4 5 b6 b7', Lydian: '1 2 3 #4 5 6 7',
  Mixolydian: '1 2 3 4 5 6 b7', Aeolian: '1 2 b3 4 5 b6 b7', Locrian: '1 b2 b3 4 b5 b6 b7',
};
const CHAR = {
  //            char degrees        neighbour it differs from   three-fret jump (low, high) the text claims
  natural:  [[['b6'], F.Dorian], [['b5'], F.Phrygian], [[], null], [['6'], F.Aeolian], [['b2'], F.Aeolian], [['#4'], F.Ionian], [['b7'], F.Ionian]],
  major:    [[[], null], [['6'], F.Aeolian], [['b2'], F.Aeolian], [['#4'], F.Ionian], [['b7'], F.Ionian], [['b6'], F.Dorian], [['b5'], F.Phrygian]],
  harmonic: [[['7'], F.Aeolian, ['b6', '7']], [['6'], F.Locrian], [['#5'], F.Ionian], [['#4'], F.Dorian, ['b3', '#4']], [['3'], F.Phrygian, ['b2', '3']], [['#2'], F.Lydian, ['R', '#2']], [['b4', 'bb7'], F.Locrian]],
};
check('each mode’s sound: its char degree is exactly what separates it from its neighbour', () => {
  for (const set of SC) CHAR[set].forEach(([char, nb, jump], k) => {
    const m = T.mode(set, k);
    eq(m.char, char, `${set} mode ${k + 1} (${m.short}) char`);
    ok(typeof m.sound === 'string' && m.sound.length > 20, `${set} mode ${k + 1} has a sound line`);
    for (const d of char) ok(m.labels.includes(d), `${set} ${m.short}: ${d} is one of its degrees`);
    for (const d of char) ok(m.sound.includes(T.pretty(d === 'R' ? 'R' : d.replace(/^(?=\d)/, ''))), `${set} ${m.short}: the sound line names ${d}`);
    if (nb) {
      const mine = MODE_FORMULA[set][k][0].split(' '), theirs = nb.split(' ');
      const differ = mine.filter((d, n) => d !== theirs[n]).map(d => d.replace(/^1$/, 'R'));
      eq(differ, char, `${set} ${m.short} vs its neighbour: differs exactly at`);
    }
    if (jump) eq(semis(jump[1]) - semis(jump[0]), 3, `${set} ${m.short}: ${jump.join('→')} is a three-fret jump`);
  });
});
check('choosing a mode relabels the same dots from the new root', () => {
  for (const set of SC) for (const key of KEYS) for (let k = 0; k < 7; k++) {
    const a = T.cagedShape(set, key, IDS[set][0], 0), b = T.cagedShape(set, key, IDS[set][0], k);
    eq(keysOf(b.cells), keysOf(a.cells), 'same dots');
    for (const c of b.cells) eq(semis(c.deg), mod(at(c.s, c.f) - key - IV[set][k]), `${set} ${key} mode ${k + 1} label`);
  }
});

console.log('\nChords of the key');
const CHORDS = {
  natural: ['i7 m7', 'iiø7 m7b5', '♭IIImaj7 maj7', 'iv7 m7', 'v7 m7', '♭VImaj7 maj7', '♭VII7 7'],
  harmonic: ['i(maj7) mMaj7', 'iiø7 m7b5', '♭III+maj7 +maj7', 'iv7 m7', 'V7 7', '♭VImaj7 maj7', 'vii°7 dim7'],
  major: ['Imaj7 maj7', 'ii7 m7', 'iii7 m7', 'IVmaj7 maj7', 'V7 7', 'vi7 m7', 'viiø7 m7b5'],
};
const QTONES = { maj7: [0, 4, 7, 11], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], mMaj7: [0, 3, 7, 11], m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9], '+maj7': [0, 4, 8, 11] };
check('the seven chords of each key, built in thirds', () => {
  for (const set of SC) CHORDS[set].forEach((want, k) => {
    const c = T.chordOf(set, k), [num, q] = want.split(' ');
    eq(c.numeral, num, `${set} chord ${k + 1} numeral`); eq(c.q, q, `${set} chord ${k + 1} quality`);
    // every tone is in the scale
    for (const t of QTONES[q]) ok(IV[set].includes(mod(IV[set][k] + t)), `${set} chord ${k + 1} tone ${t} in scale`);
  });
  eq(T.chordName('harmonic', 9, 4), 'E7', 'A harmonic minor: V7 is E7');
  eq(T.chordName('harmonic', 9, 6), 'G♯°7', 'and vii°7 is G♯°7');
  eq(T.chordName('natural', 9, 6), 'G7', 'A natural minor: ♭VII7 is G7');
  eq([0, 1, 2, 3, 4, 5, 6].map(k => T.chordName('major', 0, k)).join(' '), 'Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bm7♭5', 'C major');
  eq([0, 1, 2, 3, 4, 5, 6].map(k => T.chordName('major', 1, k)).join(' '), 'D♭maj7 E♭m7 Fm7 G♭maj7 A♭7 B♭m7 Cm7♭5', 'D♭ major');
});
check('every grip: the right four notes, root in the bass on the A string, within four frets', () => {
  for (const set of SC) for (const key of KEYS) for (let k = 0; k < 7; k++) {
    const g = T.grip(set, key, k), q = T.chordOf(set, k).q;
    const root = mod(key + IV[set][k]);
    ok(g.every(x => Number.isInteger(x.f) && x.f >= 0), `${set} ${key} ${k}: all fretted`);
    eq(g.map(x => x.s), [1, 2, 3, 4], 'strings A D G B');
    eq(mod(at(g[0].s, g[0].f)), root, `${set} ${key} ${k}: root in the bass`);
    setEq(g.map(x => mod(at(x.s, x.f) - root)).map(String), QTONES[q].map(String), `${set} ${key} ${k} tones`);
    const fs = g.map(x => x.f); ok(Math.max(...fs) - Math.min(...fs) <= 3, `${set} ${key} ${k}: span ${Math.max(...fs) - Math.min(...fs) + 1} frets`);
  }
});

console.log('\nSpelling');
const NAT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pitch = n => mod(NAT[n[0]] + (n.includes('♯') ? 1 : 0) - (n.includes('♭') ? 1 : 0));
const LETTERS = 'CDEFGAB';
check('keys are named as usual: C♯ and G♯ minor, D♭ and A♭ major', () => {
  eq(KEYS.map(k => T.keyNames('natural')[k]).join(' '), 'C C♯ D E♭ E F F♯ G G♯ A B♭ B', 'minor keys');
  eq(KEYS.map(k => T.keyNames('major')[k]).join(' '), 'C D♭ D E♭ E F F♯ G A♭ A B♭ B', 'major keys');
  for (const fam of ['natural', 'major']) KEYS.forEach(k => eq(pitch(T.keyNames(fam)[k]), k, `${fam} key ${k} name`));
});
check('every note of every key is spelled with the right pitch; one letter per degree', () => {
  let fallbacks = 0;
  for (const set of SC) for (const key of KEYS) {
    const names = IV[set].map(i => T.spellIn(set, key, i));
    eq(names[0], T.keyNames(set)[key], `${set} ${key}: the root is the key's name`);
    names.forEach((n, i) => eq(pitch(n), mod(key + IV[set][i]), `${set} ${key} degree ${i + 1}`));
    if (new Set(names.map(n => n[0])).size !== 7) fallbacks++;
  }
  eq(fallbacks, 1, 'only G♯ harmonic minor needs a double accidental (its 7 is F𝄪, shown as G); no major key does');
  eq(IV.major.map(i => T.spellIn('major', 6, i)).join(' '), 'F♯ G♯ A♯ B C♯ D♯ E♯', 'F♯ major');
  eq(IV.major.map(i => T.spellIn('major', 1, i)).join(' '), 'D♭ E♭ F G♭ A♭ B♭ C', 'D♭ major');
  eq(IV.lydian.map(i => T.spellIn('lydian', 0, i, 'major')).join(' '), 'C D E F♯ G A B', 'C Lydian: the ♯4 is F♯, not G♭');
  eq(IV.majpent.map(i => T.spellIn('majpent', 0, i, 'major')).join(' '), 'C D E G A', 'C major pentatonic');
  eq(IV.harmonic.map(i => T.spellIn('harmonic', 9, i)).join(' '), 'A B C D E F G♯', 'A harmonic minor');
  eq(IV.natural.map(i => T.spellIn('natural', 0, i)).join(' '), 'C D E♭ F G A♭ B♭', 'C natural minor');
  // Compared scales are spelled from the app's own key name.
  eq(T.spellIn('major', 8, 4, 'harmonic'), 'B♯', 'G♯ minor app, major 3rd: B♯ (from G♯, not C from A♭)');
});
check('chord notes: the right pitches, letters stacked in thirds from the chord root', () => {
  for (const set of SC) for (const key of KEYS) for (let k = 0; k < 7; k++) {
    const c = T.chordOf(set, k), sp = T.chordSpell(set, key, k), root = mod(key + IV[set][k]);
    const names = c.tones.map(t => sp[t]);
    eq(names[0], T.spellIn(set, key, IV[set][k]), `${set} ${key} chord ${k + 1}: root named as in the key`);
    c.tones.forEach((t, j) => eq(pitch(names[j]), mod(root + t), `${set} ${key} chord ${k + 1} tone ${t}`));
    const L = LETTERS.indexOf(names[0][0]);
    names.forEach((n, j) => {
      const want = LETTERS[(L + 2 * j) % 7];
      if (n[0] === want) return;
      // Only allowed where the right letter needs a double accidental — and
      // that only happens in G♯ harmonic minor (F𝄪).
      let acc = mod(pitch(n) - NAT[want]); if (acc > 6) acc -= 12;
      ok(Math.abs(acc) === 2 && set === 'harmonic' && key === 8, `${set} ${key} chord ${k + 1}: ${names.join(' ')} not in thirds`);
    });
  }
  eq(Object.values(T.chordSpell('natural', 0, 5)).join(' '), 'A♭ C E♭ G', 'C minor ♭VImaj7 = A♭ C E♭ G (not G♯ …)');
  eq(Object.values(T.chordSpell('harmonic', 9, 6)).join(' '), 'G♯ B D F', 'A harmonic minor vii°7');
});

console.log('\nComparison');
check('shared / only / extra, re-derived for every shape, key and target', () => {
  for (const set of SC) for (const key of KEYS) for (const id of IDS[set]) for (const t of T.COMPARE_FOR[set]) {
    const sh = T.cagedShape(set, key, id), c = T.compareIn(sh, t);
    for (const x of c.extra) eq(semis(x.deg), mod(at(x.s, x.f) - key), `${set} ${key} ${id} vs ${t}: extra labelled in ${t}'s own degree names`);
    for (const x of c.extra) ok(FORMULA[t].includes(x.deg === 'R' ? '1' : x.deg), `${set} vs ${t}: ${x.deg} is a degree of ${t}`);
    setEq(keysOf(c.shared), keysOf(sh.cells.filter(x => pcs(t, key).has(mod(at(x.s, x.f))))), `${set} ${key} ${id} vs ${t} shared`);
    setEq(keysOf(c.only), keysOf(sh.cells.filter(x => !pcs(t, key).has(mod(at(x.s, x.f))))), 'only');
    if ((set === 'natural' && t === 'harmonic') || (set === 'harmonic' && t === 'natural')) continue;   // chart-based, below
    const want = []; for (let s = 0; s < 6; s++) for (let f = sh.lo; f <= sh.hi; f++) { const p = mod(at(s, f)); if (pcs(t, key).has(p) && !pcs(set, key).has(p)) want.push(`${s}_${f}`); }
    setEq(keysOf(c.extra), want, 'extra');
  }
});
// What each mode is compared with: the major scale if its 3rd is major, the
// natural minor if it is ♭3; nothing when the mode IS that scale.
const PARALLEL = {
  natural:  [null, 'natural', null, 'natural', 'natural', 'major', 'major'],          // k=0 uses the neighbour list
  major:    [null, 'natural', 'natural', 'major', 'major', null, 'natural'],
  harmonic: [null, 'natural', 'major', 'natural', 'major', 'major', 'natural'],
};
check('a mode against the major or natural minor scale on the mode’s own root', () => {
  for (const set of SC) for (let k = 1; k < 7; k++) {
    const want = PARALLEL[set][k], mf = MODE_FORMULA[set][k][0].split(' ');
    eq(T.parallelOf(set, k), want, `${set} mode ${k + 1} (${mf.join(' ')}) is compared with`);
    if (!want) { ok(mf.join(' ') === F.Ionian || mf.join(' ') === F.Aeolian, `${set} mode ${k + 1}: nothing to compare only when it IS major or natural minor`); continue; }
    eq(mf[2] === '3' ? 'major' : 'natural', want, `${set} mode ${k + 1}: chosen by its 3rd`);
    const mr = IV[set][k];
    const mine = IV[set].map(i => mod(i - mr)).sort((a, b) => a - b);
    const d = T.compareDegrees(set, want, k);
    setEq(d.shared.map(String), mine.filter(i => IV[want].includes(i)).map(String), `${set} mode ${k + 1} shared`);
    setEq(d.only.map(String), mine.filter(i => !IV[want].includes(i)).map(String), 'only');
    setEq(d.extra.map(String), IV[want].filter(i => !mine.includes(i)).map(String), 'extra');
    for (const key of KEYS) for (const id of IDS[set]) {
      const root = mod(key + mr), sh = T.cagedShape(set, key, id, k), c = T.compareIn(sh, want, root);
      setEq(keysOf(c.only), keysOf(sh.cells.filter(x => !pcs(want, root).has(mod(at(x.s, x.f))))), `${set} ${key} ${id} mode ${k + 1}: only`);
      const ex = []; for (let s = 0; s < 6; s++) for (let f = sh.lo; f <= sh.hi; f++) { const p = mod(at(s, f)); if (pcs(want, root).has(p) && !pcs(set, key).has(p)) ex.push(`${s}_${f}`); }
      setEq(keysOf(c.extra), ex, 'extra');
      for (const x of c.extra) eq(semis(x.deg), mod(at(x.s, x.f) - root), 'extras labelled from the mode root');
    }
  }
  // The point of choosing by the 3rd: the char note is what is left over.
  eq(T.compareDegrees('major', 'natural', 1).only.join(' '), '9', 'D Dorian vs D natural minor: only the 6');
  eq(T.compareDegrees('major', 'natural', 2).only.join(' '), '1', 'E Phrygian vs E natural minor: only the ♭2');
  eq(T.compareDegrees('major', 'major', 3).only.join(' '), '6', 'F Lydian vs F major: only the ♯4');
  eq(T.compareDegrees('major', 'major', 4).only.join(' '), '10', 'G Mixolydian vs G major: only the ♭7');
  eq(T.compareDegrees('major', 'natural', 6).only.join(' '), '1 6', 'B Locrian vs B natural minor: the ♭2 and ♭5');
  eq(T.compareDegrees('harmonic', 'major', 4).only.join(' '), '1 8 10', 'Phrygian dominant vs major: ♭2 ♭6 ♭7');
  eq([4, 11].map(i => T.spellOn('C♯', 1, 'major', i)).join(' '), 'E♯ B♯', 'C♯ Phrygian (A major) vs C♯ major: spelled from C♯');
});
check('natural vs harmonic inside a shape = the other chart at the same spot (what Zak drew, and what nat2har grades)', () => {
  for (const [set, t] of [['natural', 'harmonic'], ['harmonic', 'natural']]) for (const key of KEYS) for (const id of MINOR_IDS) {
    const sh = T.cagedShape(set, key, id), c = T.compareIn(sh, t);
    const fs = sh.cells.map(x => x.f), lo = Math.min(...fs);
    // the other chart, moved by the same amount as this one, every fret on the neck
    const chart = CHARTS[t][id], mine = CHARTS[set][id];
    const myMin = Math.min(...Object.values(mine.cells).flat().map(([f]) => f));
    const shift = lo - myMin;
    const other = Object.entries(chart.cells).flatMap(([s, a]) => a.map(([f]) => `${s}_${f + shift}`)).filter(k => +k.split('_')[1] >= 0);
    const result = new Set([...keysOf(sh.cells).filter(k => !keysOf(c.only).includes(k)), ...keysOf(c.extra)]);
    setEq([...result], other, `${set} ${key} ${id} vs ${t}: shape − only + extra = the other chart`);
    for (const x of c.extra) eq(mod(at(x.s, x.f) - key), set === 'natural' ? 11 : 10, 'extras are the 7s / the ♭7s');
    for (const x of c.extra) ok(x.f >= lo - 1 && x.f <= Math.max(...fs) + 1, 'inside the board window (one fret either side)');
  }
});
check('harmonic vs natural, in the harmonic shapes: the dashed ♭7s fall exactly where Zak greyed them out', () => {
  for (const id of MINOR_IDS) {
    const ch = CHARTS.natural[id];
    const sh = T.cagedShape('harmonic', ch.root, id), c = T.compareIn(sh, 'natural');
    const greyed = Object.entries(ch.cells).flatMap(([s, a]) => a.filter(([, d]) => d === 'b7').map(([f]) => `${s}_${f}`));
    // shapes sit at the chart's own frets in the chart's key
    for (const g of greyed) ok(keysOf(c.extra).includes(g), `${id}: greyed ♭7 at ${g} is shown`);
  }
});

console.log('\nDrills');
check('fretboard drill answers, re-derived', () => {
  for (const set of SC) for (const key of KEYS) for (const id of IDS[set]) {
    const sh = T.cagedShape(set, key, id);
    const spec = d => T.drillSpec(set, d, key, id, { off: 2, seed: 11 });
    const morphed = (sp, target) => {
      const res = new Set([...keysOf(sh.cells).filter(k => !sp.remove.has(k)), ...[...sp.ok].filter(k => !sp.remove.has(k))]);
      const want = []; for (let s = 0; s < 6; s++) for (let fr = sh.lo; fr <= sh.hi; fr++) if (pcs(target, key).has(mod(at(s, fr)))) want.push(`${s}_${fr}`);
      setEq([...res], want.filter(k => keysOf(sh.cells).includes(k) || !pcs(set, key).has(mod(at(+k.split('_')[0], +k.split('_')[1])))), `${set} ${key} ${id} → ${target}`);
    };
    setEq([...spec('root').ok], keysOf(sh.cells.filter(c => mod(at(c.s, c.f) - key) === 0)), `${set} ${key} ${id} root`);
    setEq([...spec('build').ok], keysOf(sh.cells), 'build');
    const f = spec('fill'); eq(f.ok.size + f.shown.length, sh.cells.length, 'fill partitions');
    if (set === 'harmonic') setEq([...spec('spot7').ok], keysOf(sh.cells.filter(c => mod(at(c.s, c.f) - key) === 11)), 'spot7 = every 7');
    if (set === 'natural') setEq([...spec('spot67').ok], keysOf(sh.cells.filter(c => [8, 10].includes(mod(at(c.s, c.f) - key)))), 'spot67 = every ♭6 and ♭7');
    if (set === 'major') {
      setEq([...spec('spot47').ok], keysOf(sh.cells.filter(c => [5, 11].includes(mod(at(c.s, c.f) - key)))), 'spot47 = every 4 and 7');
      const mx = spec('tomix'), ly = spec('tolyd');
      morphed(mx, 'mixo'); morphed(ly, 'lydian');
      for (const k of mx.remove) eq(mod(at(...k.split('_').map(Number)) - key), 11, 'Mixolydian: only the 7s go');
      for (const k of [...mx.ok].filter(k => !mx.remove.has(k))) eq(mod(at(...k.split('_').map(Number)) - key), 10, 'and only ♭7s come in');
      for (const k of ly.remove) eq(mod(at(...k.split('_').map(Number)) - key), 5, 'Lydian: only the 4s go');
      for (const k of [...ly.ok].filter(k => !ly.remove.has(k))) eq(mod(at(...k.split('_').map(Number)) - key), 6, 'and only ♯4s come in');
      continue;   // nat2har and tomel belong to the minor apps
    }
    // nat2har: the natural shape becomes exactly the harmonic chart
    const n2h = spec('nat2har');
    const d = T.pairShift(key, id);
    const nat = keysOf(T.shapeCells('natural', key, id, d)), har = keysOf(T.shapeCells('harmonic', key, id, d));
    const after = new Set([...nat.filter(k => !n2h.remove.has(k)), ...[...n2h.ok].filter(k => !n2h.remove.has(k))]);
    setEq([...after], har, `${set} ${key} ${id}: nat2har lands on the harmonic chart`);
    for (const k of n2h.remove) { const [s, f] = k.split('_').map(Number); eq(mod(at(s, f) - key), 10, 'only ♭7s are removed'); }
    for (const k of n2h.ok) { const [s, f] = k.split('_').map(Number); ok(f >= n2h.win.lo && f <= n2h.win.hi, 'answer on screen'); }
    // tomel: within the shape's frets, the result is exactly melodic minor
    morphed(spec('tomel'), 'melodic');
  }
});
check('blank-neck drills: an 8-fret window holding the whole shape, offset 0-3', () => {
  for (const set of SC) for (const key of KEYS) for (const id of IDS[set]) for (let off = 0; off <= 3; off++) {
    const sp = T.drillSpec(set, 'build', key, id, { off }), sh = sp.sh;
    eq(sp.win.hi - sp.win.lo + 1, 8, 'eight frets'); ok(sp.win.lo <= sh.lo && sp.win.hi >= sh.hi, `${set} ${key} ${id} off ${off} fits`);
    eq(sh.lo - sp.win.lo, Math.min(off, sh.lo, 8 - (sh.hi - sh.lo + 1)), 'the push is capped by the room the shape leaves');
  }
});
check('root to root: one octave, the seven notes plus the top root, no pitch twice', () => {
  for (const set of SC) for (const key of KEYS) for (const id of IDS[set]) {
    const ps = T.rootSpan(T.cagedShape(set, key, id)).map(c => at(c.s, c.f)).sort((a, b) => a - b);
    eq(ps.length, 8, `${set} ${key} ${id} count`); eq(new Set(ps).size, 8, 'unique'); eq(ps[7] - ps[0], 12, 'an octave');
  }
});
check('mode questions: the right answer is always one of four different choices', () => {
  for (const set of SC) for (const key of [0, 4, 9]) for (const m of T.MODE_IDS) for (const d of ['mwhich', 'mchord']) for (const seed of [1, 7, 99]) {
    const q = T.modeQuestion(set, d, key, m, seed);
    eq(q.options.length, 4, 'four'); eq(new Set(q.options.map(o => o.i)).size, 4, 'distinct');
    ok(q.options.some(o => o.i === q.answer), 'answer offered'); eq(q.answer, Number(m.slice(1)) - 1, 'answer is the mode');
    eq(JSON.stringify(T.modeQuestion(set, d, key, m, seed)), JSON.stringify(q), 'fixed by the seed');
  }
  eq(T.modeQuestion('harmonic', 'mwhich', 9, 'M5', 3).prompt.text, 'E7 (V7)', 'A harmonic minor, mode 5: over E7');
  eq(T.modeQuestion('major', 'mwhich', 0, 'M5', 3).prompt.text, 'G7 (V7)', 'C major, mode 5: over G7');
  eq(T.modeQuestion('major', 'mchord', 0, 'M2', 3).prompt.text, 'D Dorian', 'C major, mode 2: D Dorian');
});

console.log('\nSpaced repetition');
check('cards: shape drills on the five shapes, mode drills on the seven modes', () => {
  for (const set of SC) {
    const cards = R.buildCards(['root', 'build', 'nat2har', 'mwhich', 'mchord'], R.cardShapes(set));
    eq(cards.length, 5 * 3 + 7 * 2, `${set} count`);
    ok(cards.every(c => c.id === `${c.shape}|${c.drill}`), 'ids');
    eq([...new Set(cards.filter(c => c.drill === 'root').map(c => c.shape))], IDS[set], `${set}: the shape cards are its own shapes`);
  }
  for (const set of SC) for (const d of T.SCALE_DRILLS[set].all) ok(T.DRILLS.includes(d), `${set} drill ${d} is known`);
});
check('SM-2 behaves as everywhere else in the toolbox', () => {
  let c = R.updateSRS(undefined, true); eq(c.interval, 1, 'first'); c = R.updateSRS(c, true); eq(c.interval, 6, 'second');
  c = R.updateSRS(c, false); eq(c.reps, 0, 'miss resets');
});
check('readiness: shapes need six keys on the blank-neck drills; mode cards only reps', () => {
  const good = keys => ({ reps: 3, interval: 6, nextDue: '2099-01-01', keysSeen: keys });
  eq(R.shapeProgress('E', { 'E|root': good(0), 'E|build': good(0b111111) }, ['root', 'build']).ready, true, 'six keys');
  eq(R.shapeProgress('E', { 'E|root': good(0), 'E|build': good(0b11111) }, ['root', 'build']).ready, false, 'five is not enough');
  eq(R.shapeProgress('M5', { 'M5|mwhich': good(0) }, ['root', 'build', 'mwhich']).ready, true, 'mode card on reps');
});
check('due-only is exact; a narrow pool is three reps; forecast counts every card once', () => {
  const td = R.todayStr();
  const cards = R.buildCards(['root', 'mwhich'], R.cardShapes('major'));
  const srs = { [cards[0].id]: { reps: 1, interval: 1, nextDue: td } };
  eq(R.buildQueue(cards, srs, 12, () => 0, { dueOnly: true }).length, 1, 'due only');
  eq(R.buildQueue(cards.slice(0, 1), {}, 12, () => 0).length, R.READY_REPS, 'narrow');
  const f = R.forecastStacked(cards, srs);
  eq(f.newCount + f.buckets.reduce((a, b) => a + b.total, 0), cards.length, 'every card once');
  eq(f.buckets[0].byKind.shape, 1, 'stacked shape / mode');
});

// ── Dates, in every timezone ─────────────────────────────────────────────
// Due dates are UTC calendar days (todayStr), so addDays/dayDiff have to be
// plain calendar arithmetic wherever the phone is. They were not: local-time
// arithmetic made "tomorrow" today anywhere east of Greenwich, and lost a day
// whenever a gap crossed a clock change. One run of this script only sees this
// machine's timezone, so the app's own helpers are run in a child process
// under each zone below and compared with arithmetic done in UTC alone.
const DATE_ZONES = ['UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'Pacific/Auckland', 'Asia/Kolkata'];
function dateErrors(file) {
  const text = readFileSync(new URL(file, import.meta.url), 'utf8');
  const grab = id => (text.match(new RegExp(`^\\s*(?:export\\s+)?const\\s+${id}\\s*=.*$`, 'm')) || [''])[0].replace(/^\s*export\s+/, '');
  const src = [grab('addDays'), grab('dayDiff')].filter(Boolean).join('\n');
  if (!src.includes('addDays')) return [`addDays not found in ${file}`];
  const probe = `const f = new Function(process.argv[1] + '; return { addDays, dayDiff: typeof dayDiff === "undefined" ? null : dayDiff };')();
const ref = (s, n) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
let out = '';
for (let i = 0; i < 730 && !out; i++) { const s = ref('2026-01-01', i);
  for (const n of [-1, 1, 6, 15, 38, 95, 238]) { const w = ref(s, n);
    if (f.addDays(s, n) !== w) { out = 'addDays(' + s + ', ' + n + ') = ' + f.addDays(s, n) + ', expected ' + w; break; }
    if (f.dayDiff && f.dayDiff(s, w) !== n) { out = 'dayDiff(' + s + ', ' + w + ') = ' + f.dayDiff(s, w) + ', expected ' + n; break; } } }
process.stdout.write(out);`;
  return DATE_ZONES
    .map(tz => [tz, execFileSync(process.execPath, ['-e', probe, src], { env: { ...process.env, TZ: tz } }).toString()])
    .filter(([, e]) => e).map(([tz, e]) => `${tz}: ${e}`);
}

console.log('\ndates — every timezone');
check('due dates are calendar arithmetic in every timezone', () => {
  const e = dateErrors('../src/srs.js');
  if (e.length) fail(e.join('\n      '));
});

console.log(failures === 0 ? `\nAll checks passed. ${assertions} assertions.\n` : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
