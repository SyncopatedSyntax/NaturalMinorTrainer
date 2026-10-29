import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AppHeader, TabBar, ProgressBackup } from '@fretworks/design';
import {
  pc, midiAt, ckey, unkey, pretty, keyNames, SCALES, COMPARE_FOR, degOfScale, spellIn, spellOn, parallelOf,
  modeParent, spellMode, modeShapes, carryShape,
  mode, MODE_INFO, chordOf, chordName, chordSpell, grip, SHAPES_OF, MODE_IDS, shapeName, getShapes, fullNeck,
  compareIn, compareDegrees, DRILL_FAMILY, BLANK, MODE_DRILLS, SCALE_DRILLS, drillAppliesTo, drillSpec, modeQuestion,
} from './theory.js';
import {
  todayStr, updateSRS, isLearned, ri, cardId, buildCards, shapeProgress, drillProgress, weakestDrills,
  nextUp, forecastStacked, buildQueue, READY_REPS, READY_KEYS, WEAK_MIN_SEEN, WEAK_ACC, cardShapes,
} from './srs.js';
import { playMidis, strum } from './audio.js';
import Fretboard, { DC, txtOn } from './Fretboard.jsx';
import { SCALE_ID, TOOL_KEY, PREFIX, ACCENT as ACC, ICON_TEXT } from './scale.js';

// ════════════════════════════════════════════════════════════════════════
//  Scale trainer — shared by Natural Minor, Harmonic Minor and Major Scale
//  Trainer. src/scale.js says which one this is; everything that differs is
//  looked up from it here. The five shapes are Zak's charts (charts.js).
// ════════════════════════════════════════════════════════════════════════

const S = SCALES[SCALE_ID];
const NAT = SCALE_ID === 'natural', MAJ = SCALE_ID === 'major';
const by = o => o[SCALE_ID];   // pick this app's version of a per-scale value
const OTHER = by({ natural: 'harmonic', harmonic: 'natural', major: null });   // the scale whose charts pair with this one
const KEYS = keyNames(SCALE_ID);
const SHAPE_IDS = SHAPES_OF[SCALE_ID], CARD_SHAPES = cardShapes(SCALE_ID);
const HOME_KEY = MAJ ? 0 : 9;                                          // C major / A minor
const COMMON_KEYS = MAJ ? [0, 7, 2, 9, 4, 5, 10] : [9, 4, 2, 11, 7, 0, 5];
const COMMON_TEXT = MAJ ? 'C, G, D, A, E, F and B♭ major' : 'A, E, D, B, G, C and F minor';
const RELATIVE = MAJ ? { label: 'relative minor', iv: 9 } : { label: 'relative major', iv: 3 };
// "Only mixolydian" reads wrong; the modes keep their capital.
const shortOf = id => ['mixo', 'lydian'].includes(id) ? SCALES[id].short : SCALES[id].short.toLowerCase();
const DRILL_SET = SCALE_DRILLS[SCALE_ID];
const ON_DARK = '#0b0b16';
// Card borders as longhands: overriding borderColor on a reused element with
// the `border` shorthand turns the border white (see Blues/Altered).
const card = { background: '#13121f', borderWidth: 1, borderStyle: 'solid', borderColor: '#2a2840', borderRadius: 12, padding: '12px 13px', marginBottom: 12 };
const frame = { background: '#13121f', borderWidth: 1, borderStyle: 'solid', borderColor: '#2a2840', borderRadius: 12 };
const hd = { fontSize: 11, color: '#888', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 };
const primary = { width: '100%', background: ACC, color: ON_DARK, border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 800, cursor: 'pointer', minHeight: 48, touchAction: 'manipulation' };
const ghost = { width: '100%', background: 'transparent', color: '#aaa', border: '1px solid #2a2840', borderRadius: 9, padding: '10px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', minHeight: 44, touchAction: 'manipulation', marginTop: 8 };
const seg = on => ({ flex: 1, padding: '8px 4px', background: on ? ACC : 'transparent', color: on ? ON_DARK : '#aaa', border: `1px solid ${on ? ACC : '#2a2840'}`, borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', minHeight: 40, touchAction: 'manipulation' });
const pill = on => ({ padding: '6px 11px', borderRadius: 16, fontSize: 12, fontWeight: 800, cursor: 'pointer', minHeight: 36, border: `1.5px solid ${on ? ACC : '#2a2840'}`, background: on ? ACC : 'transparent', color: on ? ON_DARK : '#aaa', touchAction: 'manipulation', whiteSpace: 'nowrap' });
const navBtn = { background: 'transparent', border: '1px solid #2a2840', color: '#ccc', borderRadius: 8, padding: '9px 16px', fontSize: 16, fontWeight: 700, cursor: 'pointer', minHeight: 44, minWidth: 48, touchAction: 'manipulation' };
const keyTitle = root => `${KEYS[root]} ${S.title}`;
// A mode on your root ("C Mixolydian") and the scale whose notes it uses
// ("F major"). Mode 0 is the scale itself, so it reads as the key.
const modeTitle = (root, k) => k ? `${KEYS[root]} ${mode(SCALE_ID, k).name.replace(/ \(.*\)$/, '')}` : keyTitle(root);
const parentTitleOf = (root, k) => `${spellMode(SCALE_ID, KEYS[root], root, k, pc(modeParent(SCALE_ID, root, k) - root))} ${S.title}`;
const ROOT_MIDI = root => 48 + root;   // where "hear it" starts (C3..B3)
const noteOfFor = root => m => spellIn(SCALE_ID, root, pc(m - root));
const MORPHS = new Set(['nat2har', 'tomel', 'tomix', 'tolyd']);
const sortedPitches = cells => [...new Set(cells.map(c => midiAt(c.s, c.f)))].sort((a, b) => a - b);
// One octave from the lowest root of the CURRENT labelling (the mode's root).
const modeRootSpan = cells => {
  const roots = sortedPitches(cells.filter(c => c.deg === 'R'));
  return roots.length < 2 ? [] : sortedPitches(cells).filter(m => m >= roots[0] && m <= roots[1]);
};
const playMode = (root, k) => { const m = mode(SCALE_ID, k), base = ROOT_MIDI(root) + m.offset; playMidis([...m.ivs.map(i => base + i), base + 12], 0.2); };

function PlayBtn({ onClick, label = '▶ Play', small }) {
  const [hot, setHot] = useState(false);
  return <button onClick={() => { setHot(true); onClick(); setTimeout(() => setHot(false), 500); }}
    style={{ background: hot ? ACC + '22' : 'transparent', border: `1px solid ${hot ? ACC : '#2a2840'}`, color: hot ? ACC : '#bbb', borderRadius: 8, padding: small ? '5px 10px' : '8px 13px', fontSize: small ? 11.5 : 12, fontWeight: 700, cursor: 'pointer', minHeight: small ? 36 : 42, touchAction: 'manipulation' }}>{label}</button>;
}
function Chip({ deg, note, dashed, ringed }) {
  const col = DC[deg] || '#888';
  if (dashed) return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontWeight: 800, fontSize: 11.5, border: '1.5px dashed #b7b5cf', color: '#d4d2e8', margin: '2px 4px 2px 0' }}>{pretty(deg)}{note ? ` · ${note}` : ''}</span>;
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontWeight: 800, fontSize: 11.5, background: col, color: txtOn(col), margin: '2px 4px 2px 0', boxShadow: ringed ? `0 0 0 2px #0f0e17, 0 0 0 3.5px ${ACC}` : 'none' }}>{pretty(deg)}{note ? ` · ${note}` : ''}</span>;
}
// The degree that gives mode `m` its sound, and why. `spell(iv)` names the
// note `iv` above the mode's root — on Positions the root is yours; in the
// Modes tab it is the mode's degree of your key.
function SoundLine({ m, spell, style }) {
  const noteOf = d => spell(m.ivs[m.labels.indexOf(d)]);
  return (
    <div style={{ fontSize: 12, color: '#bbb', lineHeight: 1.6, ...style }}>
      <b style={{ color: '#fff' }}>Its sound{m.char.length ? ':' : ''}</b>{' '}
      {m.char.map(d => <Chip key={d} deg={d} note={noteOf(d)} />)}
      {m.char.length ? ' ' : ' — '}{m.sound}
    </div>
  );
}
function Row({ label, children }) {
  return <div style={{ display: 'flex', gap: 8 }}><span style={{ color: '#888', flex: '0 0 92px', lineHeight: 1.35, paddingTop: 5 }}>{label}</span><span style={{ flex: 1 }}>{children}</span></div>;
}

// ════════════════════════════════════════════════════════════════════════
//  POSITIONS
// ════════════════════════════════════════════════════════════════════════
function ModeChips({ modeK, setModeK }) {
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
      {MODE_INFO[SCALE_ID].map((m, k) => <button key={k} onClick={() => setModeK(k)} style={pill(modeK === k)}>{k + 1}. {m.short}</button>)}
    </div>
  );
}

// A mode keeps YOUR root: with C chosen, Mixolydian is C Mixolydian — F
// major's notes and shapes, each placed where it keeps C where one of C
// major's shapes has it (theory.js modeShapes). Shapes are named as the
// parent's ("A shape (F major)"), so the name can change with the mode.
function PositionsTab({ root, labelMode, view, setView, shapeId, onShapeId, tn, setTn, modeK, onMode, focusId, onFocus, onPractise }) {
  const [cmp, setCmp] = useState('off');
  const neck = view === 'neck';
  const list = useMemo(() => modeShapes(SCALE_ID, root, view === 'tnps' ? 'tnps' : 'caged', modeK), [root, view, modeK]);
  const want = view === 'tnps' ? 'T' + tn : shapeId;
  const idx = Math.max(0, list.findIndex(s => s.id === want));
  const cur = list[idx];
  const step = d => { const n = list[(idx + d + list.length) % list.length]; if (view === 'tnps') setTn(Number(n.id.slice(1))); else onShapeId(n.id); };
  const parent = modeParent(SCALE_ID, root, modeK);
  const shape = neck ? fullNeck(SCALE_ID, parent, modeK) : cur;
  const m = mode(SCALE_ID, modeK);
  const modeRoot = KEYS[root];
  const spell = iv => spellMode(SCALE_ID, modeRoot, root, modeK, iv);
  const parentTitle = parentTitleOf(root, modeK);
  // The scale itself is compared with its neighbours; any other mode with the
  // major or natural minor scale on the mode's OWN root, whichever matches
  // its 3rd (`parallelOf`). For modes, `cmp` holds 'parallel' rather than a
  // scale id, so the choice survives stepping from a minor mode to a major one.
  const par = modeK ? parallelOf(SCALE_ID, modeK) : null;
  const cmpOptions = modeK === 0 ? COMPARE_FOR[SCALE_ID] : par ? ['parallel'] : [];
  const cmpOn = cmpOptions.includes(cmp);
  const target = cmp === 'parallel' ? par : cmp;
  const cmpRoot = root, cmpRootName = modeRoot;
  const thisName = modeTitle(root, modeK);
  const cmpData = useMemo(() => {
    if (!cmpOn) return null;
    const c = compareIn(shape, target, cmpRoot);
    return { only: new Set(c.only.map(x => ckey(x.s, x.f))), extra: c.extra };
  }, [cmpOn, target, shape, cmpRoot]);
  const diff = cmpOn ? compareDegrees(SCALE_ID, target, modeK) : null;
  const ownDeg = i => m.labels[m.ivs.indexOf(i)], ownNote = spell;
  const rm = ROOT_MIDI(root);
  const playBoth = () => {
    const a = [...m.ivs.map(i => rm + i), rm + 12], b = [...SCALES[target].iv.map(i => rm + i), rm + 12];
    playMidis(a, 0.2); setTimeout(() => playMidis(b, 0.2), a.length * 200 + 650);
  };
  // Keep comparing while stepping through the modes.
  const pickMode = k => {
    onMode(k);
    if (k === 0 ? !COMPARE_FOR[SCALE_ID].includes(cmp) : (cmp !== 'parallel' || !parallelOf(SCALE_ID, k))) setCmp('off');
  };
  const span = modeRootSpan(shape.cells);

  return (
    <div style={{ padding: '14px 12px' }}>
      <div style={{ fontSize: 9.5, color: '#777', textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 2px 5px' }}>Mode</div>
      <ModeChips modeK={modeK} setModeK={pickMode} />
      {modeK > 0 && <>
        <div style={{ fontSize: 12, color: '#bbb', lineHeight: 1.55, margin: '6px 2px 0' }}>
          <b style={{ color: ACC }}>{modeRoot} {m.name}</b> — the notes of {parentTitle}, counted from {modeRoot}, in {parentTitle}'s shapes. Switching mode keeps {modeRoot} where it was on the neck.
        </div>
        <SoundLine m={m} spell={spell} style={{ margin: '6px 2px 0' }} />
      </>}

      <div style={{ display: 'flex', gap: 6, margin: '12px 0 10px' }}>
        <button onClick={() => setView('caged')} style={seg(view === 'caged')}>5 Shapes</button>
        <button onClick={() => setView('tnps')} style={seg(view === 'tnps')}>3 per string</button>
        <button onClick={() => setView('neck')} style={seg(neck)}>Full neck</button>
      </div>

      {cmpOptions.length > 0 && <>
        <div style={{ fontSize: 9.5, color: '#777', textTransform: 'uppercase', letterSpacing: '.5px', margin: '2px 2px 5px' }}>Compare with</div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 8, WebkitOverflowScrolling: 'touch' }}>
          <button onClick={() => setCmp('off')} style={pill(!cmpOn)}>Off</button>
          {cmpOptions.map(id => <button key={id} onClick={() => setCmp(id)} style={pill(cmp === id)}>{modeK ? `${modeRoot} ${SCALES[par].title}` : SCALES[id].short}</button>)}
        </div>
      </>}

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{neck ? 'Full neck' : cur.name}{!neck && modeK > 0 && <span style={{ color: '#bbb', fontWeight: 700 }}> ({parentTitle})</span>}</div>
        {view === 'caged' && cur.id === focusId && <span style={{ fontSize: 10, fontWeight: 800, color: ACC, border: `1px solid ${ACC}66`, borderRadius: 12, padding: '2px 7px' }}>FOCUS</span>}
        {!neck && <span style={{ color: '#888', fontWeight: 600, fontSize: 11 }}>frets {cur.lo}–{cur.hi}</span>}
      </div>

      <div style={{ ...frame, padding: '8px 4px', overflowX: neck ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch' }}>
        <Fretboard cells={shape.cells} labelMode={labelMode} noteOf={mi => spell(pc(mi - root))} compare={cmpData} accent={ACC}
          win={neck ? { lo: 0, hi: 15 } : { lo: Math.max(0, cur.lo - 1), hi: cur.hi + 1 }} scroll={neck} />
      </div>

      {!neck && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 10 }}>
          <button onClick={() => step(-1)} style={navBtn} aria-label="Lower on the neck">{'‹'}</button>
          <div style={{ fontSize: 12, color: '#999', minWidth: 110, textAlign: 'center' }}>
            {cur.name}{modeK > 0 && <><br /><span style={{ fontSize: 10.5, color: '#999' }}>{parentTitle}</span></>}<br /><span style={{ fontSize: 10, color: '#666' }}>{idx + 1} of {list.length} up the neck</span>
          </div>
          <button onClick={() => step(1)} style={navBtn} aria-label="Higher on the neck">{'›'}</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <PlayBtn onClick={() => playMidis(sortedPitches(shape.cells), 0.17)} label={'▶ Play this shape'} />
        {!neck && span.length > 0 && <PlayBtn onClick={() => playMidis(span, 0.2)} label={modeK ? `▶ ${modeRoot} to ${modeRoot}` : '▶ Root to root'} />}
        {view === 'caged' && (cur.id === focusId
          ? <button onClick={onPractise} style={{ background: ACC, color: ON_DARK, border: 'none', borderRadius: 8, padding: '8px 13px', fontSize: 12, fontWeight: 800, cursor: 'pointer', minHeight: 42, touchAction: 'manipulation' }}>Practise this</button>
          : <button onClick={() => onFocus(cur.id)} style={{ background: 'transparent', color: ACC, border: `1px solid ${ACC}66`, borderRadius: 8, padding: '8px 13px', fontSize: 12, fontWeight: 800, cursor: 'pointer', minHeight: 42, touchAction: 'manipulation' }}>Make this my focus</button>)}
      </div>

      {diff ? (
        <div style={{ ...card, marginTop: 14, borderColor: ACC + '44' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.4 }}>{thisName} <span style={{ color: '#777' }}>vs</span> {cmpRootName} {SCALES[target].title}</div>
            <PlayBtn small label={'▶ Hear both'} onClick={playBoth} />
          </div>
          <div style={{ fontSize: 12, lineHeight: 2, color: '#ccc' }}>
            <Row label="Both have">{diff.shared.map(i => <Chip key={i} deg={ownDeg(i)} note={ownNote(i)} />)}</Row>
            <Row label={`Only ${modeK ? m.short : shortOf(SCALE_ID)}`}>{diff.only.length ? diff.only.map(i => <Chip key={i} deg={ownDeg(i)} note={ownNote(i)} ringed />) : <span style={{ color: '#777' }}>nothing</span>}</Row>
            <Row label={`Only ${shortOf(target)}`}>{diff.extra.length ? diff.extra.map(i => <Chip key={i} deg={degOfScale(target, i)} note={spellOn(cmpRootName, cmpRoot, target, i)} dashed />) : <span style={{ color: '#777' }}>nothing</span>}</Row>
          </div>
          <div style={{ fontSize: 11, color: '#888', lineHeight: 1.6, marginTop: 6 }}>
            On the neck: ringed = only in {thisName}; dashed = only in {cmpRootName} {SCALES[target].title}{neck ? '' : modeK === 0 && cmp === OTHER && view === 'caged' ? `, where the ${SCALES[cmp].short.toLowerCase()} version of this shape puts ${cmp === 'harmonic' ? 'its 7s' : 'them'}` : ', at every fret this shape covers'}.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14, justifyContent: 'center' }}>
          {m.labels.map((d, i) => <span key={d} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#aaa' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: DC[d] || '#888', display: 'inline-block', boxShadow: d === 'R' ? '0 0 0 1.5px #fff' : modeK > 0 && m.char.includes(d) ? `0 0 0 2px #0f0e17, 0 0 0 3.5px ${ACC}` : 'none' }} />
            <span style={modeK > 0 && m.char.includes(d) ? { color: ACC, fontWeight: 800 } : null}>{pretty(d)} {spell(m.ivs[i])}</span></span>)}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  MODES
// ════════════════════════════════════════════════════════════════════════
function ModesTab({ root, onSee }) {
  const [open, setOpen] = useState(0);
  return (
    <div style={{ padding: '14px 12px' }}>
      <div style={{ fontSize: 12.5, color: '#aaa', lineHeight: 1.65, marginBottom: 12 }}>
        Seven modes, one set of notes. Each mode starts {keyTitle(root)} on a different degree — tap one to see how it sounds and where it fits. On the neck a mode keeps your root instead, so the button shows it on {KEYS[root]}.
      </div>
      {MODE_INFO[SCALE_ID].map((info, k) => {
        const m = mode(SCALE_ID, k), c = chordOf(SCALE_ID, k), isO = open === k;
        const modeRoot = spellIn(SCALE_ID, root, m.offset);
        return (
          <div key={k} style={{ ...card, padding: 0, borderColor: isO ? ACC + '66' : '#2a2840', overflow: 'hidden' }}>
            <button onClick={() => setOpen(isO ? null : k)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 13px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', minHeight: 52, color: '#fff', touchAction: 'manipulation' }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: ACC, fontWeight: 800, width: 18 }}>{k + 1}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{modeRoot} {info.name}</span>
                <span style={{ display: 'block', fontSize: 11, color: '#888', marginTop: 2 }}>over {chordName(SCALE_ID, root, k)} · {c.numeral}</span>
              </span>
              <span style={{ color: '#555', transform: isO ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>{'▾'}</span>
            </button>
            {isO && (
              <div style={{ padding: '0 13px 13px' }}>
                <div style={{ lineHeight: 1.9, marginBottom: 6 }}>
                  {m.labels.map((d, i) => <Chip key={d} deg={d} note={spellIn(SCALE_ID, root, m.offset + m.ivs[i])} ringed={m.char.includes(d)} />)}
                </div>
                <div style={{ fontSize: 12.5, color: '#ccc', lineHeight: 1.6, marginBottom: 8 }}>{info.use}</div>
                <SoundLine m={m} spell={iv => spellIn(SCALE_ID, root, m.offset + iv)} style={{ marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <PlayBtn label={'▶ Hear it'} onClick={() => playMode(root, k)} />
                  <button onClick={() => onSee(k)} style={{ background: 'transparent', color: ACC, border: `1px solid ${ACC}66`, borderRadius: 8, padding: '8px 13px', fontSize: 12, fontWeight: 800, cursor: 'pointer', minHeight: 42, touchAction: 'manipulation' }}>See {KEYS[root]} {info.short} on the neck</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  SCALE MAP — the chords of the key, and which mode goes over each
// ════════════════════════════════════════════════════════════════════════
const CHORD_DEG = { 0: 'R', 3: 'b3', 4: '3', 6: 'b5', 7: '5', 8: '#5', 9: 'bb7', 10: 'b7', 11: '7' };
function ScaleMapTab({ root, labelMode, onSee }) {
  const [open, setOpen] = useState(SCALE_ID === 'harmonic' ? 4 : 0);
  return (
    <div style={{ padding: '14px 12px' }}>
      <div style={{ fontSize: 12.5, color: '#aaa', lineHeight: 1.65, marginBottom: 12 }}>
        The seven chords of {keyTitle(root)}, built from its notes. Over each one, the mode that starts on its root fits. Tap a chord for a grip.
      </div>
      {[0, 1, 2, 3, 4, 5, 6].map(k => {
        const c = chordOf(SCALE_ID, k), info = MODE_INFO[SCALE_ID][k], isO = open === k;
        const g = grip(SCALE_ID, root, k), fs = g.map(x => x.f);
        const croot = pc(root + c.rootIv), names = chordSpell(SCALE_ID, root, k);
        const cells = g.map(x => ({ s: x.s, f: x.f, deg: CHORD_DEG[x.iv] }));
        return (
          <div key={k} style={{ ...card, padding: 0, borderColor: isO ? ACC + '66' : '#2a2840', overflow: 'hidden' }}>
            <button onClick={() => setOpen(isO ? null : k)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', minHeight: 52, color: '#fff', touchAction: 'manipulation' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 15, minWidth: 74, color: ACC }}>{c.numeral}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{chordName(SCALE_ID, root, k)}</span>
                <span style={{ display: 'block', fontSize: 11, color: '#888', marginTop: 2 }}>{info.name}</span>
              </span>
              <span style={{ color: '#555', transform: isO ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>{'▾'}</span>
            </button>
            {isO && (
              <div style={{ padding: '0 10px 12px' }}>
                <div style={{ ...frame, padding: '6px 4px', marginBottom: 8 }}>
                  <Fretboard cells={cells} labelMode={labelMode} noteOf={m => names[pc(m - croot)]}
                    win={{ lo: Math.max(0, Math.min(...fs) - 1), hi: Math.max(...fs) + 1 }} rowH={26} accent={ACC} />
                </div>
                <div style={{ fontSize: 11.5, color: '#999', lineHeight: 1.6, marginBottom: 9, padding: '0 3px' }}>
                  Root on the A string, then the 5th, 7th and 3rd on D, G and B — the drop-2 grip. {info.use}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <PlayBtn label={'▶ Chord'} onClick={() => strum(g.map(x => midiAt(x.s, x.f)))} />
                  <PlayBtn label={`▶ ${info.short}`} onClick={() => playMode(root, k)} />
                  <button onClick={() => onSee(k)} style={{ background: 'transparent', color: ACC, border: `1px solid ${ACC}66`, borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer', minHeight: 42, touchAction: 'manipulation' }}>{KEYS[root]} {info.short} on the neck</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  PRACTICE
// ════════════════════════════════════════════════════════════════════════
const DRILL_META = {
  root: { label: 'Every root', short: 'Roots', ask: () => 'Tap every root in this shape.' },
  fill: { label: 'Fill the gaps', short: 'Gaps', ask: () => 'Dots are missing. Put them back.' },
  octave: { label: 'Root to root', short: 'Octave', ask: () => 'Empty neck. One octave of this shape, lowest root to the next.' },
  build: { label: 'Build it', short: 'Build', ask: () => 'Empty neck. Place the whole shape.' },
  spot7: { label: 'Spot the 7', short: 'Spot 7', ask: () => 'Every dot is grey. Tap every 7 — the leading tone, one fret under a root.' },
  spot67: { label: 'Spot ♭6 and ♭7', short: '♭6 ♭7', ask: () => 'Every dot is grey. Tap every ♭6 and ♭7 — the two notes harmonic and melodic minor raise.' },
  spot47: { label: 'Spot the 4 and 7', short: '4 & 7', ask: () => 'Every dot is grey. Tap every 4 and 7 — the two notes the major pentatonic leaves out.' },
  nat2har: { label: SCALE_ID === 'natural' ? 'Into harmonic minor' : 'Natural → harmonic', short: '→ Harmonic', ask: () => 'This is the natural minor shape. Make it harmonic minor: cross out every ♭7, and put a 7 one fret below each root.' },
  tomel: { label: 'Into melodic minor', short: '→ Melodic', ask: () => SCALE_ID === 'natural' ? 'Turn it into melodic minor: cross out the ♭6s and ♭7s, add the 6s and 7s in these frets.' : 'Turn it into melodic minor: cross out the ♭6s, add the 6s in these frets.' },
  tomix: { label: 'Into Mixolydian', short: '→ Mixo', ask: () => 'Turn it into Mixolydian: cross out every 7, add the ♭7s in these frets.' },
  tolyd: { label: 'Into Lydian', short: '→ Lydian', ask: () => 'Turn it into Lydian: cross out every 4, add the ♯4s in these frets.' },
  mwhich: { label: 'Which mode?', short: 'Which mode', ask: () => 'Which mode fits this chord?' },
  mchord: { label: 'Which chord?', short: 'Which chord', ask: () => 'Which chord of the key does this mode go over?' },
};
const FAMILY_NAME = { shape: 'The shape', sig: by({ natural: 'The changing notes', harmonic: 'The raised 7th', major: 'The 4 and the 7' }), mode: 'Modes' };
const FC = { shape: ACC, mode: '#c7cbff' };
const cardName = id => id[0] === 'M' ? `${Number(id.slice(1))}. ${MODE_INFO[SCALE_ID][Number(id.slice(1)) - 1].short}` : shapeName(id);
const nextShape = id => SHAPE_IDS[SHAPE_IDS.indexOf(id) + 1] || null;

function PracticeTab({ root, labelMode, settings, srs, onGrade, focusId, onFocus, onSession }) {
  const drills = (settings.drills && settings.drills.length) ? settings.drills : DRILL_SET.on;
  const sessionN = settings.sessionN || 12;
  const keyMode = settings.keyMode || 'random';
  const [queue, setQueue] = useState(null);
  const [scope, setScope] = useState(null);
  const [qi, setQi] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [tally, setTally] = useState({ ok: 0, miss: 0 });

  const pickKey = () => keyMode === 'fixed' ? root : keyMode === 'common' ? COMMON_KEYS[ri(7)] : ri(12);
  const prog = useMemo(() => shapeProgress(focusId, srs, drills), [focusId, srs, drills]);
  const ladder = useMemo(() => CARD_SHAPES.map(id => ({ id, ...shapeProgress(id, srs, drills) })), [srs, drills]);
  const focusShape = useMemo(() => getShapes(SCALE_ID, root).find(s => s.id === focusId), [root, focusId]);
  const plan = useMemo(() => nextUp(srs, drills, focusId, CARD_SHAPES), [srs, drills, focusId]);
  const weak = useMemo(() => weakestDrills(srs, drills, CARD_SHAPES), [srs, drills]);
  const focusWeak = useMemo(() => weakestDrills(srs, drills, [focusId], 1)[0] || null, [srs, drills, focusId]);
  const anyGraded = useMemo(() => drills.some(d => drillProgress(d, srs, CARD_SHAPES).seen >= WEAK_MIN_SEEN), [srs, drills]);
  const fc = useMemo(() => forecastStacked(buildCards(drills, CARD_SHAPES), srs), [srs, drills]);

  useEffect(() => { onSession?.(!!queue); }, [queue, onSession]);
  useEffect(() => () => onSession?.(false), [onSession]);

  const start = (spec = {}) => {
    const { shapes = CARD_SHAPES, only = null, dueOnly = false, label = 'Everything' } = spec;
    const cards = buildCards(drills, shapes).filter(c => !only || only.includes(c.drill));
    const q = buildQueue(cards, srs, sessionN, pickKey, { dueOnly });
    if (!q.length) return;
    setScope({ shapes, only, dueOnly, label });
    setQueue(q); setQi(0); setAnswer(null); setPicked(new Set()); setTally({ ok: 0, miss: 0 });
  };
  const quit = () => { setQueue(null); setScope(null); setAnswer(null); setPicked(new Set()); };

  // ── A running session ──────────────────────────────────────────────────
  if (queue) {
    if (qi >= queue.length) {
      const pct = Math.round((tally.ok / Math.max(1, tally.ok + tally.miss)) * 100);
      return (
        <div style={{ padding: '14px 12px' }}>
          <div style={{ ...card, textAlign: 'center', padding: '24px 14px' }}>
            <div style={{ fontSize: 34, marginBottom: 6 }}>{pct >= 80 ? '⭐' : pct >= 60 ? '🎸' : '💪'}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{tally.ok} / {tally.ok + tally.miss}</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>Every question was in its own key. That is the part that sticks.</div>
          </div>
          <button onClick={() => start({ ...scope, dueOnly: false })} style={primary}>Go again</button>
          <button onClick={quit} style={ghost}>Done</button>
        </div>
      );
    }
    const it = queue[qi];
    const meta = DRILL_META[it.drill];
    const nextQ = () => { setAnswer(null); setPicked(new Set()); setQi(i => i + 1); };
    const header = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <button onClick={quit} aria-label="End session" style={{ background: 'transparent', border: '1px solid #2a2840', color: '#aaa', borderRadius: 8, padding: '6px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 44, touchAction: 'manipulation' }}>End</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: '#888' }}>{scope?.label} · {qi + 1} / {queue.length}</div>
          <div style={{ height: 4, background: '#1a1928', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
            <div style={{ width: `${(qi / queue.length) * 100}%`, height: '100%', background: ACC }} />
          </div>
        </div>
      </div>
    );

    // Mode questions: four choices.
    if (MODE_DRILLS.has(it.drill)) {
      const q = modeQuestion(SCALE_ID, it.drill, it.root, it.shape, it.seed);
      const choose = i => {
        if (answer) return;
        const correct = i === q.answer;
        setAnswer({ correct, chosen: i });
        setTally(t => ({ ok: t.ok + (correct ? 1 : 0), miss: t.miss + (correct ? 0 : 1) }));
        onGrade(it.id, correct, it.root);
        if (correct) playMode(it.root, q.answer);
      };
      const info = MODE_INFO[SCALE_ID][q.answer];
      return (
        <div style={{ padding: '14px 12px' }}>
          {header}
          <div style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#888' }}>In {keyTitle(it.root)}</div>
            <div style={{ fontSize: 19, fontWeight: 900, color: ACC, margin: '6px 0' }}>{q.prompt.text}</div>
            <div style={{ fontSize: 13.5, color: '#ddd' }}>{meta.ask()}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {q.options.map(o => {
              const isAns = o.i === q.answer, isChosen = answer && answer.chosen === o.i;
              const col = !answer ? '#2a2840' : isAns ? '#2ed573' : isChosen ? '#ef4444' : '#2a2840';
              return <button key={o.i} onClick={() => choose(o.i)} disabled={!!answer}
                style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 10, minHeight: 50, fontSize: 14, fontWeight: 800, cursor: answer ? 'default' : 'pointer', touchAction: 'manipulation',
                  border: `1.5px solid ${col}`, background: answer && isAns ? '#2ed57318' : answer && isChosen ? '#ef444418' : 'transparent', color: '#fff' }}>
                {o.text}{answer && isAns ? ' ✓' : ''}
              </button>;
            })}
          </div>
          {answer && (
            <div style={{ ...card, marginTop: 12, borderColor: answer.correct ? '#2ed57355' : '#ef444455' }}>
              <div style={{ fontSize: 13, color: answer.correct ? '#2ed573' : '#ffb4b4', fontWeight: 700, lineHeight: 1.5 }}>
                {answer.correct ? 'Yes.' : `It’s ${info.name} over ${chordName(SCALE_ID, it.root, q.answer)}.`}
              </div>
              <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6, marginTop: 5 }}>{info.use} {info.sound}</div>
              <button onClick={nextQ} style={{ ...primary, marginTop: 10 }}>Next {'›'}</button>
            </div>
          )}
        </div>
      );
    }

    // Fretboard questions.
    const spec = drillSpec(SCALE_ID, it.drill, it.root, it.shape, { off: it.off, seed: it.seed });
    const { ok } = spec;
    const morph = MORPHS.has(it.drill);
    const blank = BLANK.has(it.drill);
    const ring = it.drill.startsWith('spot') || morph;
    const toggle = (s, f) => {
      if (answer) return;
      const k = ckey(s, f);
      setPicked(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
      playMidis([midiAt(s, f)]);
    };
    const check = () => {
      if (answer || !picked.size) return;
      const missed = [...ok].filter(k => !picked.has(k));
      const wrong = [...picked].filter(k => !ok.has(k));
      const correct = !missed.length && !wrong.length;
      const noun = it.drill === 'root' ? 'root' : it.drill === 'fill' ? 'dot' : it.drill === 'spot7' ? '7' : 'note';
      const verdict = correct ? `Yes — all ${ok.size}.`
        : !wrong.length ? `${picked.size} of ${ok.size}. ${missed.length} ${noun}${missed.length > 1 ? 's' : ''} missing, ringed.`
        : !missed.length ? `You found them all, but ${wrong.length} extra${wrong.length > 1 ? 's' : ''}.`
        : `${ok.size - missed.length} of ${ok.size} right, ${wrong.length} that should not be there.`;
      setAnswer({ correct, missed, wrong, verdict });
      setTally(t => ({ ok: t.ok + (correct ? 1 : 0), miss: t.miss + (correct ? 0 : 1) }));
      onGrade(it.id, correct, it.root);
      if (correct) {
        const after = morph ? [...spec.shown.map(c => ckey(c.s, c.f)).filter(k => !spec.remove.has(k)), ...[...ok].filter(k => !spec.remove.has(k))] : [...ok];
        playMidis([...new Set(after.map(k => { const [s, f] = unkey(k); return midiAt(s, f); }))].sort((a, b) => a - b), 0.09);
      }
    };
    const marks = [];
    if (answer) {
      for (const k of picked) { const [s, f] = unkey(k); marks.push({ s, f, kind: ok.has(k) ? 'ok' : 'bad' }); }
      for (const k of answer.missed) { const [s, f] = unkey(k); marks.push({ s, f, kind: 'reveal' }); }
    }
    return (
      <div style={{ padding: '14px 12px' }}>
        {header}
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: ACC }}>{keyTitle(it.root)}</div>
          <div style={{ fontSize: 13.5, color: '#ddd', marginTop: 6, lineHeight: 1.5 }}>
            <b>{shapeName(it.shape)}</b> — {meta.ask().charAt(0).toLowerCase() + meta.ask().slice(1)}
          </div>
          {morph && <div style={{ fontSize: 11, color: '#888', marginTop: 5 }}>a dot you tap is crossed out · an empty fret you tap is added</div>}
          {blank && <button onClick={() => playMidis([ROOT_MIDI(it.root)])}
            style={{ marginTop: 9, background: 'transparent', border: '1px solid #2a2840', color: '#aaa', borderRadius: 7, padding: '6px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', minHeight: 36, touchAction: 'manipulation' }}>{'♪'} hear the root</button>}
        </div>
        <div style={{ ...frame, padding: '8px 0', margin: '0 -12px' }}>
          <Fretboard cells={spec.shown} labelMode={labelMode} mono rootRing={ring} accent={ACC}
            win={spec.win} rowH={36} marks={marks} selected={answer ? null : picked} pickStyle={morph ? 'morph' : 'mark'}
            onTapCell={answer ? undefined : toggle} />
        </div>
        {!answer && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12 }}>
            <div style={{ minWidth: 84 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, fontFamily: 'monospace', color: picked.size === ok.size ? '#2ed573' : '#aaa' }}>{picked.size} of {ok.size}</div>
              <div style={{ fontSize: 9.5, color: '#666', letterSpacing: '.4px', marginTop: 1 }}>{morph ? 'CHANGES' : 'FOUND'}</div>
              <div style={{ height: 3, background: '#1a1928', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (picked.size / ok.size) * 100)}%`, height: '100%', background: picked.size === ok.size ? '#2ed573' : ACC, transition: 'width .15s' }} />
              </div>
            </div>
            <button onClick={() => setPicked(new Set())} disabled={!picked.size}
              style={{ background: 'transparent', border: '1px solid #2a2840', color: picked.size ? '#aaa' : '#555', borderRadius: 9, padding: '10px 12px', fontSize: 12, fontWeight: 700, cursor: picked.size ? 'pointer' : 'default', minHeight: 44, touchAction: 'manipulation' }}>Clear</button>
            <button onClick={check} disabled={!picked.size} style={{ ...primary, flex: 1, opacity: picked.size ? 1 : 0.45 }}>Check</button>
          </div>
        )}
        {answer && (
          <div style={{ ...card, marginTop: 12, borderColor: answer.correct ? '#2ed57355' : '#ef444455' }}>
            <div style={{ fontSize: 13, color: answer.correct ? '#2ed573' : '#ffb4b4', fontWeight: 700, lineHeight: 1.5 }}>{answer.verdict}</div>
            {!answer.correct && <div style={{ fontSize: 11.5, color: '#999', marginTop: 6, lineHeight: 1.6 }}>Green is right, red should not be there, dashed teal is what you missed.</div>}
            <button onClick={nextQ} style={{ ...primary, marginTop: 10 }}>Next {'›'}</button>
          </div>
        )}
      </div>
    );
  }

  // ── Idle ───────────────────────────────────────────────────────────────
  const pips = id => drills.filter(d => drillAppliesTo(d, id)).map(d => { const c = srs[cardId(id, d)]; return { d, on: isLearned(c), part: !!c && !isLearned(c) }; });
  const names = ids => ids.length <= 3 ? ids.map(cardName).join(', ') : `${ids.length} shapes and modes`;
  const fName = shapeName(focusId);
  const NEXT = {
    due: () => ({ title: `${plan.count} card${plan.count > 1 ? 's' : ''} due`, why: `across ${names(plan.shapes)}. These are the ones the schedule says you are about to forget.`, cta: '▶ Review what’s due', go: () => start({ dueOnly: true, label: 'Due today' }) }),
    'focus-new': () => ({ title: `The ${fName} has ${plan.count} drill${plan.count > 1 ? 's' : ''} you have not tried`, why: 'Nothing is due, so start the ones you have never answered.', cta: `▶ Practise the ${fName}`, go: () => start({ shapes: [focusId], label: fName }) }),
    weak: () => ({ title: `${DRILL_META[plan.drill].label} is your weakest — ${plan.right} of ${plan.seen} right`, why: 'Nothing is due and nothing is untried, so this is the thing most worth an extra pass.', cta: `▶ Drill ${DRILL_META[plan.drill].label}`, go: () => start({ only: [plan.drill], label: DRILL_META[plan.drill].label }) }),
    clear: () => ({ title: 'Nothing due today', why: plan.soonest === null ? 'Nothing scheduled yet — any session starts the clock.' : plan.soonest === 1 ? 'Next review is tomorrow. Practising early still counts.' : `Next review in ${plan.soonest} days. Practising early still counts.`, cta: `▶ Practise the ${fName} anyway`, go: () => start({ shapes: [focusId], label: fName }) }),
  }[plan.kind]();
  const nxt = nextShape(focusId);
  const modeDrillsOn = drills.some(d => MODE_DRILLS.has(d));

  const LadderRow = ({ l }) => {
    const isMode = l.id[0] === 'M', isFocus = l.id === focusId;
    const sub = isMode ? `over ${chordOf(SCALE_ID, Number(l.id.slice(1)) - 1).numeral}` : '';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 8px', borderRadius: 9, marginBottom: 5, border: `1px solid ${isFocus ? ACC : '#1f1e2e'}`, background: isFocus ? ACC + '11' : 'transparent' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>{cardName(l.id)} {sub && <span style={{ color: '#777', fontWeight: 600, fontSize: 11 }}>{sub}</span>}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', gap: 4 }}>
              {pips(l.id).map(({ d, on, part }) => <span key={d} title={DRILL_META[d].short} style={{ width: 8, height: 8, borderRadius: '50%', boxSizing: 'border-box', background: on ? '#2ed573' : part ? '#74b9ff' : 'transparent', border: `1.5px solid ${on ? '#2ed573' : part ? '#74b9ff' : '#3a3852'}` }} />)}
            </span>
            <span style={{ fontSize: 10, color: '#777' }}>
              {l.ready ? `solid${l.needsKeys ? ` · ${l.keyCount} keys` : ''}` : l.nw === l.total ? 'not started' : `${l.mastered} of ${l.total} drills${l.needsKeys ? (l.keyCount >= READY_KEYS ? ' · keys ✓' : ` · keys ${l.keyCount}/${READY_KEYS}`) : ''}`}
            </span>
            {l.due > 0 && <span style={{ fontSize: 9.5, fontWeight: 800, color: ACC, background: ACC + '18', border: `1px solid ${ACC}44`, borderRadius: 9, padding: '1px 6px', whiteSpace: 'nowrap' }}>{l.due} due</span>}
          </div>
        </div>
        <button onClick={() => start({ shapes: [l.id], label: cardName(l.id) })} aria-label={`Practise ${cardName(l.id)}`}
          style={{ background: 'transparent', border: `1px solid ${ACC}66`, color: ACC, borderRadius: 8, padding: 0, fontSize: 12, fontWeight: 800, cursor: 'pointer', minHeight: 44, minWidth: 44, touchAction: 'manipulation' }}>{'▶'}</button>
        {!isMode && <button onClick={() => onFocus(l.id)} disabled={isFocus}
          style={{ background: 'transparent', border: `1px solid ${isFocus ? ACC : '#2a2840'}`, color: isFocus ? ACC : '#888', borderRadius: 8, padding: '0 9px', fontSize: 11, fontWeight: 700, cursor: isFocus ? 'default' : 'pointer', minHeight: 44, minWidth: 44, touchAction: 'manipulation' }}>{isFocus ? 'focus' : 'set'}</button>}
      </div>
    );
  };

  return (
    <div style={{ padding: '14px 12px' }}>
      <div style={{ ...card, borderColor: plan.kind === 'due' ? ACC + '77' : '#2a2840' }}>
        <div style={hd}>Next up</div>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: '#fff', lineHeight: 1.4 }}>{NEXT.title}</div>
        <div style={{ fontSize: 11.5, color: '#8a8a9a', lineHeight: 1.6, marginTop: 5, marginBottom: 11 }}>{NEXT.why}</div>
        <button onClick={NEXT.go} style={primary}>{NEXT.cta}</button>
      </div>

      <div style={{ ...card, borderColor: ACC + '44' }}>
        <div style={hd}>Your focus</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{fName}</div>
          <div style={{ fontSize: 11.5, color: '#888' }}>frets {focusShape.lo}–{focusShape.hi} in {KEYS[root]}</div>
        </div>
        <div style={{ margin: '10px 0' }}>
          <Fretboard cells={focusShape.cells} labelMode={labelMode} noteOf={noteOfFor(root)} accent={ACC} win={{ lo: Math.max(0, focusShape.lo - 1), hi: focusShape.hi + 1 }} rowH={24} />
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 6 }}>
          {pips(focusId).map(({ d, on, part }) => (
            <button key={d} onClick={() => start({ shapes: [focusId], only: [d], label: DRILL_META[d].label })}
              style={{ fontSize: 11.5, fontWeight: 700, padding: '0 11px', borderRadius: 14, minHeight: 44, background: 'transparent', cursor: 'pointer', touchAction: 'manipulation', border: `1px solid ${on ? '#2ed573' : part ? '#74b9ff' : '#2a2840'}`, color: on ? '#2ed573' : part ? '#74b9ff' : '#999' }}>
              {on ? '●' : part ? '◐' : '○'} {DRILL_META[d].short}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10.5, color: '#666', marginBottom: 10 }}>
          Tap one to drill just that, on this shape.
          {focusWeak && <span style={{ color: ACC, fontWeight: 700 }}> Weakest here: {DRILL_META[focusWeak.drill].label} ({focusWeak.right} of {focusWeak.seen}).</span>}
        </div>
        {prog.needsKeys && <>
          <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 3, color: prog.keyCount >= READY_KEYS ? '#2ed573' : '#aaa' }}>
            {prog.keyCount >= READY_KEYS ? `✓ Played in ${prog.keyCount} keys` : `Keys ${prog.keyCount} of ${READY_KEYS}`}
          </div>
          <div style={{ fontSize: 10.5, color: '#666', lineHeight: 1.6, marginBottom: 10 }}>
            Counted on the empty-neck drills, where the key changes where the notes are. Get {READY_KEYS}, with every drill above at {READY_REPS} correct answers, and {nxt ? `the ${shapeName(nxt)}` : 'you are done with the five'} gets suggested.
          </div>
        </>}
        <button onClick={() => start({ shapes: [focusId], label: fName })} style={primary}>{'▶'} Practise the {fName}</button>
        <button onClick={() => start({ shapes: SHAPE_IDS, label: 'All five shapes' })} style={ghost}>Practise all five shapes</button>
        {modeDrillsOn && <button onClick={() => start({ shapes: MODE_IDS, label: 'Modes' })} style={ghost}>Practise the modes</button>}
      </div>

      {prog.ready && nxt && (
        <div style={{ ...card, borderColor: '#2ed57355' }}>
          <div style={{ fontSize: 13.5, color: '#2ed573', fontWeight: 800, marginBottom: 4 }}>The {fName} is solid.</div>
          <div style={{ fontSize: 12, color: '#bbb', lineHeight: 1.6, marginBottom: 10 }}>Every drill at {READY_REPS}+ correct, across {prog.keyCount} keys. Ready for the {shapeName(nxt)}?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onFocus(nxt)} style={{ ...primary, background: '#2ed573', color: '#06281f', flex: 1 }}>Move on</button>
            <button onClick={() => onFocus(focusId)} style={{ ...ghost, marginTop: 0, width: 'auto', padding: '10px 16px' }}>Not yet</button>
          </div>
        </div>
      )}

      {anyGraded && (
        <div style={card}>
          <div style={hd}>Weak spots</div>
          {weak.length === 0
            ? <div style={{ fontSize: 12, color: '#2ed573', fontWeight: 700 }}>Nothing is lagging — every drill you have practised is above {Math.round(WEAK_ACC * 100)}%.</div>
            : weak.map(w => (
              <div key={w.drill} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderTop: '1px solid #1a1928' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>{DRILL_META[w.drill].label}</div>
                  <div style={{ fontSize: 10.5, color: '#888', marginTop: 3 }}>{w.right} of {w.seen} right · {w.solid} of {w.total} solid</div>
                </div>
                <button onClick={() => start({ only: [w.drill], label: DRILL_META[w.drill].label })}
                  style={{ background: 'transparent', border: `1px solid ${ACC}66`, color: ACC, borderRadius: 8, padding: '8px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer', minHeight: 44, touchAction: 'manipulation' }}>{'▶'} drill</button>
              </div>
            ))}
        </div>
      )}

      <div style={card}>
        <div style={hd}>The five shapes</div>
        {ladder.filter(l => l.id[0] !== 'M').map(l => <LadderRow key={l.id} l={l} />)}
        {modeDrillsOn && <>
          <div style={{ ...hd, marginTop: 14 }}>The seven modes</div>
          {ladder.filter(l => l.id[0] === 'M').map(l => <LadderRow key={l.id} l={l} />)}
        </>}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10, marginTop: 9, paddingTop: 9, borderTop: '1px solid #1a1928' }}>
          <span style={{ color: '#2ed573' }}>{'●'} solid</span><span style={{ color: '#74b9ff' }}>{'●'} started</span><span style={{ color: '#777' }}>{'○'} not yet</span>
          <span style={{ color: '#555', marginLeft: 'auto' }}>one dot per drill</span>
        </div>
        <div style={{ fontSize: 10.5, color: '#666', lineHeight: 1.6, marginTop: 8 }}>Nothing is locked — the focus is a suggestion. "Solid" is not "finished": cards keep coming back on a schedule.</div>
      </div>

      {(fc.dueToday > 0 || fc.newCount > 0 || fc.soonest !== null) && (
        <div style={card}>
          <div style={hd}>Coming up</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 64, marginBottom: 6 }}>
            {fc.buckets.map((b, i) => {
              const tallest = Math.max(1, ...fc.buckets.map(x => x.total));
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', height: 52, display: 'flex', flexDirection: 'column-reverse' }}>
                    {['shape', 'mode'].map(k => b.byKind[k] === 0 ? null : <div key={k} style={{ height: `${(b.byKind[k] / tallest) * 100}%`, background: FC[k], borderRadius: 1 }} />)}
                  </div>
                  <div style={{ fontSize: 9, color: '#666' }}>{i === 0 ? 'now' : `+${i}`}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 9.5, color: '#777', paddingTop: 7, borderTop: '1px solid #1a1928' }}>
            {['shape', 'mode'].map(k => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: FC[k], display: 'inline-block' }} />{k === 'shape' ? 'Shapes' : 'Modes'}</span>)}
          </div>
          <div style={{ fontSize: 11, color: '#aaa', lineHeight: 1.7, marginTop: 8 }}>
            {fc.dueToday > 0 ? `${fc.dueToday} card${fc.dueToday > 1 ? 's' : ''} due right now.` : fc.soonest === null ? 'Nothing scheduled yet.' : fc.soonest === 1 ? 'Next review is tomorrow.' : `Next review in ${fc.soonest} days.`}
            {fc.newCount > 0 && ` ${fc.newCount} never tried.`}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  GUIDE
// ════════════════════════════════════════════════════════════════════════
// The Guide's worked example of a mode on your root, worked out by the same
// functions the Positions tab uses: C Mixolydian in Major, A Dorian in
// Natural Minor, A Phrygian dominant in Harmonic Minor.
const MODE_EX = (() => {
  const r = HOME_KEY, k = by({ natural: 3, harmonic: 4, major: 4 });
  const from = SHAPE_IDS[1], to = carryShape(SCALE_ID, r, 'caged', 0, k, from);
  return { name: modeTitle(r, k), parent: parentTitleOf(r, k), key: keyTitle(r), from, to };
})();
const GUIDE = [
  { icon: by({ natural: '🌙', harmonic: '🎻', major: '☀️' }), title: `What ${by({ natural: 'natural minor', harmonic: 'harmonic minor', major: 'the major scale' })} is`, body: by({
    natural: `Natural minor — R 2 ♭3 4 5 ♭6 ♭7 — is the minor key itself, also called Aeolian.

It has exactly the notes of its RELATIVE MAJOR, a minor 3rd up: A natural minor and C major are the same seven notes. What changes is which note is home.

Its three "minor" notes against the major scale are the ♭3, ♭6 and ♭7. The ♭6 and ♭7 are the two that the other minors change: harmonic minor raises the 7th, melodic minor raises the 6th and the 7th.`,
    harmonic: `Harmonic minor — R 2 ♭3 4 5 ♭6 7 — is natural minor with the 7th raised a half step.

That raised 7th is the LEADING TONE: it sits a half step under the root and pulls up into it. It is what turns the minor key's v chord into a V7 — so a minor ii–V–i can resolve as strongly as a major one.

Between the ♭6 and the 7 is a gap of three half steps (an augmented 2nd). That gap is the "exotic", neo-classical, Middle-Eastern sound of the scale.`,
    major: `The major scale — R 2 3 4 5 6 7 — is the one every other scale is measured against: a ♭3, a ♯4 or a ♭7 is named by how it differs from this.

It has two half steps: 3 to 4, and 7 up to the root. Those two upper notes, the 4 and the 7, are the ones that move. Lower the 7 and you have Mixolydian; raise the 4 and you have Lydian; leave both out and you have the major pentatonic.

Its RELATIVE MINOR, a minor 3rd down (on the 6th degree), has exactly the same notes: C major and A minor. What changes is which note is home.`,
  }) },
  { icon: '🖐', title: 'The five shapes', body: `${MAJ
    ? 'The five positions are CAGED shapes, named after the open major chord shape each one contains: G shape, E shape, D shape, C shape and A shape. In any key they climb the neck in that order and join end to end.\n\nThey are the natural minor charts read from the relative major — C major\'s G shape is A minor\'s E shape, dot for dot. Same notes, a different home.'
    : 'The five positions are CAGED shapes, named after the minor chord shape each one is built around: E shape, D shape, C shape, A shape and G shape. In any key they climb the neck in that order and join end to end.\n\nThey are transcribed dot for dot from a pair of reference charts — one natural minor, one harmonic minor, drawn as matching sets.'} A shape is the same grip in every key — change key and the whole shape slides, nothing inside it moves. The arrows walk up the neck, so the order you see depends on the key; the name always tells you which grip you are holding.${SCALE_ID !== 'harmonic' ? '' : `

How the 7s are placed: every 7 sits ONE FRET BELOW A ROOT on the same string. That is how each ♭7 of the natural minor shape turns into a 7 — and it is the fastest way to find them.`}` },
  { icon: '🎼', title: 'Modes', body: `Start the same seven notes from each of the seven degrees and you get seven modes. On the Positions tab a mode keeps YOUR ROOT: with ${KEYS[HOME_KEY]} chosen, ${MODE_EX.name} is the notes of ${MODE_EX.parent}, counted from ${KEYS[HOME_KEY]}. It is shown in ${MODE_EX.parent}'s shapes and named after them, and switching mode keeps the root where it was on the neck: ${MODE_EX.key}'s ${MODE_EX.from} shape becomes ${MODE_EX.parent}'s ${MODE_EX.to} shape, the one with ${KEYS[HOME_KEY]} in the same places. (One position at the nut cannot follow — that shape would need a fret below the nut — so it appears an octave up.)

The Modes tab and the Scale Map look at it the other way, as the modes of your key — the mode that fits each chord. Their buttons still show the mode on your root.

Each mode's "Its sound" line names the degree that makes it sound like itself — the one note that separates it from its nearest neighbour (Dorian's natural 6 against Aeolian's ♭6, Lydian's ♯4 against Ionian's 4). That degree is ringed in the colour key under the shape and in the Modes tab.

${by({
    natural: 'Natural minor\'s modes are the seven church modes — Aeolian, Locrian, Ionian, Dorian, Phrygian, Lydian, Mixolydian — counted from the minor.',
    harmonic: 'The most used is the 5th: Phrygian dominant, over the V7(♭9) of a minor key. The 7th, Ultralocrian, fits the diminished vii°7 that often stands in for that V7.',
    major: 'These are the seven church modes: Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian. Dorian (over ii) and Mixolydian (over V) are the two you will reach for most — with Ionian they cover a whole ii–V–I.',
  })}

The Modes tab spells each one in the current key and plays it.` },
  { icon: '🗺️', title: 'Scale Map', body: `Stack thirds on each degree and you get the seven chords of the key. Over each chord, the mode that starts on its root fits.

${by({
    natural: 'In A natural minor: Am7, Bm7♭5, Cmaj7, Dm7, Em7, Fmaj7, G7.',
    harmonic: 'In A harmonic minor: Am(maj7), Bm7♭5, C+maj7, Dm7, E7, Fmaj7, G♯°7. The E7 is the point — it has the G♯, the raised 7th.',
    major: 'In C major: Cmaj7, Dm7, Em7, Fmaj7, G7, Am7, Bm7♭5. G7 is the only dominant chord, and Dm7–G7–Cmaj7 is the ii–V–I that jazz is built on.',
  })}

Tap a chord for a grip: root on the A string, then the 5th, 7th and 3rd on D, G and B (the drop-2 voicing), always within four frets.` },
  { icon: '⚖️', title: 'Comparing scales', body: `"Compare with" lays another scale with the same root over the shape: ${COMPARE_FOR[SCALE_ID].map(id => SCALES[id].title).join(', ')}.

With a mode picked, it offers the scale that mode is a variation of, on the mode's own root: the natural minor for a mode with a ♭3, the major scale for one with a major 3rd. So D Dorian is laid against D natural minor, and the only difference left is its natural 6 — the note that gives it its sound. F Lydian against F major leaves only the ♯4.${MAJ ? ' Aeolian is the natural minor itself, so it has nothing to compare.' : NAT ? ' Ionian is the major scale itself, so it has nothing to compare.' : ''}

A normal dot is in both. A ringed dot is only in ${S.name.toLowerCase()}. A dashed circle is only in the other scale, shown at every fret the shape covers${by({
    natural: ' — except harmonic minor, which shows the harmonic chart of the same shape. Its 7s sit one fret below each root, so one can land just outside the natural shape.',
    harmonic: ' — except natural minor, which shows the natural chart of the same shape. Its ♭7s fall exactly where the harmonic charts grey them out.',
    major: '. Against Mixolydian the only change is the 7; against Lydian, only the 4. Against the major pentatonic nothing is dashed — the 4s and 7s are ringed, because the pentatonic leaves them out.',
  })}` },
  { icon: '✋', title: 'The drills', body: `Every fretboard question is answered by tapping ALL the right notes, then Check — graded exactly. The counter shows how many there are to find, and every question is in its own key.

THE SHAPE: Every root · Fill the gaps · Root to root (empty neck) · Build it (empty neck).

${by({
    natural: 'THE CHANGING NOTES: Spot ♭6 and ♭7 · Into harmonic minor (cross out the ♭7s, put a 7 one fret below each root) · Into melodic minor (off by default).',
    harmonic: 'THE RAISED 7TH: Spot the 7 · Natural → harmonic (the natural minor shape is drawn: cross out every ♭7, put a 7 one fret below each root) · Into melodic minor (cross out the ♭6s, add the 6s).',
    major: 'THE 4 AND THE 7: Spot the 4 and 7 · Into Mixolydian (cross out the 7s, add the ♭7s) · Into Lydian (cross out the 4s, add the ♯4s).',
  })}

MODES: Which mode? (a chord is named) · Which chord? (a mode is named) — four choices each.

Turn any of them on or off in Settings.` },
  { icon: '🎯', title: 'Practice, focus and when a shape is solid', body: `Practice names ONE shape as your focus. Next up offers one thing to do: anything due, then drills you have never tried, then your weakest drill.

A shape is SOLID when every drill is at three correct answers and you have placed it correctly in six different keys on an empty neck. A mode card only needs the answers. Cards keep coming back on a schedule — that is what makes them stay.

Nothing is locked: the ▶ on any row practises it without moving your focus.` },
  { icon: '⚙️', title: 'Settings and your progress', body: `Drills on or off, questions per session (8, 12 or 20), and the key for each question: all twelve, the common ones (${COMMON_TEXT}), or the key you are browsing.

Progress is stored on this device and, if you are signed in to Fretworks, synced to your other devices. Reset practice progress asks twice.` },
];
function GuideTab() {
  const [open, setOpen] = useState(0);
  return (
    <div style={{ padding: '14px 12px' }}>
      <div style={{ fontSize: 12, color: '#888', lineHeight: 1.7, marginBottom: 12 }}>What everything in this app is for, and why a few things work the way they do.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {GUIDE.map((sec, i) => {
          const isO = open === i;
          return (
            <div key={i} style={{ ...frame, borderRadius: 10, borderColor: isO ? ACC + '55' : '#2a2840', overflow: 'hidden' }}>
              <button onClick={() => setOpen(isO ? null : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 13px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', minHeight: 46, touchAction: 'manipulation' }}>
                <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{sec.icon}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#fff' }}>{sec.title}</span>
                <span style={{ color: '#555', fontSize: 14, transform: isO ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>{'▾'}</span>
              </button>
              {isO && <div style={{ padding: '0 13px 14px' }}><div style={{ fontSize: 12.5, color: '#c8c6da', lineHeight: 1.75, whiteSpace: 'pre-line' }}>{sec.body.trim()}</div></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════════════════════════
function SettingsTab({ settings, onChange, onResetProgress }) {
  const set = patch => onChange({ ...settings, ...patch });
  const [confirmReset, setConfirmReset] = useState(false);
  const [banner, setBanner] = useState('idle');
  const drills = (settings.drills && settings.drills.length) ? settings.drills : DRILL_SET.on;
  const toggleDrill = d => {
    const s = new Set(drills); s.has(d) ? s.delete(d) : s.add(d);
    if (!s.size) return;
    set({ drills: DRILL_SET.all.filter(x => s.has(x)) });
  };
  const resetBanner = () => { try { localStorage.removeItem(PREFIX + 'ios_hint'); } catch (e) {} setBanner('done'); setTimeout(() => setBanner('idle'), 1800); };
  return (
    <div style={{ padding: '14px 12px' }}>
      <a href="https://ko-fi.com/syncopatedsyntax" target="_blank" rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#FF5E5B', color: '#fff', borderRadius: 11, padding: '12px 20px', textDecoration: 'none', fontWeight: 800, fontSize: 14, boxShadow: '0 4px 14px #FF5E5B55', marginBottom: 14, touchAction: 'manipulation' }}>
        <span style={{ fontSize: 18 }}>{'☕'}</span> Buy me a coffee
      </a>
      <div style={card}>
        <div style={hd}>Practice drills</div>
        {['shape', 'sig', 'mode'].map(fam => (
          <div key={fam} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10.5, color: '#777', fontWeight: 700, margin: '4px 2px 6px' }}>{FAMILY_NAME[fam]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {DRILL_SET.all.filter(d => DRILL_FAMILY[d] === fam).map(d => {
                const on = drills.includes(d);
                return <button key={d} onClick={() => toggleDrill(d)}
                  style={{ textAlign: 'left', padding: '10px 11px', borderRadius: 9, cursor: 'pointer', minHeight: 44, touchAction: 'manipulation', border: `1px solid ${on ? ACC : '#2a2840'}`, background: on ? ACC + '18' : 'transparent', color: on ? '#fff' : '#999' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800 }}>{on ? '●' : '○'} {DRILL_META[d].label}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>{DRILL_META[d].ask()}</div>
                </button>;
              })}
            </div>
          </div>
        ))}
        <div style={{ ...hd, marginTop: 8 }}>Questions per session</div>
        <div style={{ display: 'flex', gap: 6 }}>{[8, 12, 20].map(n => <button key={n} onClick={() => set({ sessionN: n })} style={seg((settings.sessionN || 12) === n)}>{n}</button>)}</div>
        <div style={{ ...hd, marginTop: 14 }}>Key for each question</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['random', 'All 12'], ['common', 'Common'], ['fixed', 'Current key']].map(([v, l]) => <button key={v} onClick={() => set({ keyMode: v })} style={seg((settings.keyMode || 'random') === v)}>{l}</button>)}
        </div>
        <div style={{ fontSize: 10.5, color: '#666', marginTop: 8, lineHeight: 1.6 }}>A new key every question is the point — a shape you only know in one place is a picture, not a shape. "Common" is {COMMON_TEXT}.</div>
      </div>
      <div style={card}>
        <div style={hd}>Progress</div>
        <ProgressBackup toolKey={TOOL_KEY} prefix={PREFIX} />
        <button onClick={() => { if (confirmReset) { onResetProgress(); setConfirmReset(false); } else setConfirmReset(true); }}
          style={{ width: '100%', marginTop: 10, background: 'transparent', border: `1px solid ${confirmReset ? '#ef4444' : '#2a2840'}`, color: confirmReset ? '#ff8f8f' : '#888', borderRadius: 9, padding: '10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 44 }}>
          {confirmReset ? 'Tap again to erase every drill result' : 'Reset practice progress'}
        </button>
      </div>
      <div style={card}>
        <div style={hd}>Install banner</div>
        <button onClick={resetBanner} style={{ background: 'transparent', border: '1px solid #2a2840', color: banner === 'done' ? ACC : '#ccc', borderRadius: 8, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 44, touchAction: 'manipulation' }}>
          {banner === 'done' ? '✓ Reset — banner will show again' : 'Reset install banner'}
        </button>
      </div>
    </div>
  );
}

function BannerStack() {
  const [dp, setDp] = useState(null);
  const [show, setShow] = useState(false);
  const standalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  useEffect(() => {
    if (standalone) return;
    const onBip = e => { e.preventDefault(); setDp(e); setShow(true); };
    window.addEventListener('beforeinstallprompt', onBip);
    if (isIOS) { try { if (!localStorage.getItem(PREFIX + 'ios_hint')) setShow(true); } catch (e) { setShow(true); } }
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, [standalone, isIOS]);
  if (!show || standalone) return null;
  const close = () => { setShow(false); try { localStorage.setItem(PREFIX + 'ios_hint', '1'); } catch (e) {} };
  return (
    <div style={{ position: 'fixed', bottom: 'max(14px,env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 24px)', maxWidth: 406, boxSizing: 'border-box', background: '#1a1830', border: '1px solid #2a2840', borderRadius: 12, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 30px #0008', zIndex: 50 }}>
      <div style={{ fontSize: 12, color: '#ddd', flex: 1, lineHeight: 1.4 }}>{isIOS && !dp ? <>Add to Home Screen: tap <b>Share</b> then <b>Add to Home Screen</b>.</> : <>Install Fretworks for offline practice.</>}</div>
      {dp && <button onClick={async () => { dp.prompt(); await dp.userChoice; setShow(false); }} style={{ background: ACC, color: ON_DARK, border: 'none', borderRadius: 8, padding: '8px 13px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Install</button>}
      <button onClick={close} aria-label="Dismiss" style={{ background: 'transparent', color: '#888', border: 'none', fontSize: 18, cursor: 'pointer', padding: '0 4px', minWidth: 36, minHeight: 36 }}>{'×'}</button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  APP
// ════════════════════════════════════════════════════════════════════════
// Read synchronously in the initialisers and written as JSON — no async gap
// for defaults to overwrite stored values (the bug Altered once had).
const jstore = {
  get(k, d) { try { const v = localStorage.getItem(PREFIX + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) {} },
};
const okShape = id => SHAPE_IDS.includes(id);

export default function App() {
  const [root, setRoot] = useState(() => { const n = Number(jstore.get('root', HOME_KEY)); return Number.isInteger(n) && n >= 0 && n < 12 ? n : HOME_KEY; });
  const [labelMode, setLabelMode] = useState(() => jstore.get('label', 'degrees') === 'notes' ? 'notes' : 'degrees');
  const [settings, setSettings] = useState(() => {
    const s = { sessionN: 12, keyMode: 'random', ...(jstore.get('settings', {}) || {}) };
    s.drills = (Array.isArray(s.drills) ? s.drills : DRILL_SET.on).filter(d => DRILL_SET.all.includes(d));
    if (!s.drills.length) s.drills = DRILL_SET.on;
    return s;
  });
  const [pos, setPos] = useState(() => {
    const p = jstore.get('view', {}) || {};
    return { view: ['caged', 'tnps', 'neck'].includes(p.view) ? p.view : 'caged', shape: okShape(p.shape) ? p.shape : SHAPE_IDS[0], tn: p.tn >= 1 && p.tn <= 7 ? p.tn : 1 };
  });
  const [modeK, setModeK] = useState(() => { const k = Number(jstore.get('mode', 0)); return k >= 0 && k < 7 ? k : 0; });
  const [focus, setFocus] = useState(() => { const f = jstore.get('focus', null); return f && okShape(f.shape) ? f : { shape: SHAPE_IDS[0], since: null }; });
  const [srs, setSrs] = useState(() => jstore.get('srs', {}) || {});
  const [tab, setTab] = useState('positions');
  const [drilling, setDrilling] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { jstore.set('root', root); }, [root]);
  useEffect(() => { jstore.set('label', labelMode); }, [labelMode]);
  useEffect(() => { jstore.set('settings', settings); }, [settings]);
  useEffect(() => { jstore.set('view', pos); }, [pos]);
  useEffect(() => { jstore.set('mode', modeK); }, [modeK]);

  const grade = useCallback((id, correct, atRoot) => {
    setSrs(prev => {
      const p = prev[id];
      const next = { ...prev, [id]: { ...updateSRS(p, correct), keysSeen: (p?.keysSeen || 0) | (correct ? (1 << atRoot) : 0), seen: (p?.seen || 0) + 1, wrong: (p?.wrong || 0) + (correct ? 0 : 1) } };
      jstore.set('srs', next);
      return next;
    });
  }, []);
  const resetProgress = useCallback(() => { setSrs({}); jstore.set('srs', {}); const f = { shape: SHAPE_IDS[0], since: null }; setFocus(f); jstore.set('focus', f); }, []);
  const moveFocus = useCallback(id => { const f = { shape: id, since: todayStr() }; setFocus(f); jstore.set('focus', f); setPos(p => ({ ...p, view: 'caged', shape: id })); }, []);
  const go = id => { setTab(id); if (scrollRef.current) scrollRef.current.scrollTop = 0; };
  // Switch mode keeping the root where it is on the neck: the shape and the
  // 3-per-string pattern both move to their twin in the new mode (carryShape).
  const changeMode = useCallback(k => {
    setPos(p => ({ ...p,
      shape: carryShape(SCALE_ID, root, 'caged', modeK, k, p.shape),
      tn: Number(carryShape(SCALE_ID, root, 'tnps', modeK, k, 'T' + p.tn).slice(1)) }));
    setModeK(k);
  }, [root, modeK]);
  const seeMode = k => { changeMode(k); setPos(p => ({ ...p, view: p.view === 'neck' ? 'caged' : p.view })); go('positions'); };

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `*{-webkit-tap-highlight-color:transparent}body{margin:0}`;
    document.head.appendChild(style);
    const makeIcon = size => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const x = c.getContext('2d'), u = size / 512;
      x.fillStyle = '#0f0e17'; x.beginPath();
      const rr = 96 * u; x.moveTo(rr, 0); x.arcTo(size, 0, size, size, rr); x.arcTo(size, size, 0, size, rr); x.arcTo(0, size, 0, 0, rr); x.arcTo(0, 0, size, 0, rr); x.fill();
      mode(SCALE_ID, 0).labels.map(d => DC[d]).forEach((col, i) => { x.beginPath(); x.arc((86 + i * 57) * u, 300 * u, 24 * u, 0, 7); x.fillStyle = col; x.fill(); });
      x.fillStyle = ACC; x.font = `bold ${84 * u}px sans-serif`; x.textAlign = 'center'; x.fillText(ICON_TEXT, size / 2, 190 * u);
      return c.toDataURL('image/png');
    };
    const setLink = (rel, sizes, href) => { let l = document.querySelector(`link[rel="${rel}"]${sizes ? `[sizes="${sizes}"]` : ''}`); if (!l) { l = document.createElement('link'); l.rel = rel; if (sizes) l.sizes = sizes; document.head.appendChild(l); } l.href = href; };
    setLink('apple-touch-icon', '180x180', makeIcon(180)); setLink('icon', '512x512', makeIcon(512));
    const setMeta = (n, c) => { let m = document.querySelector(`meta[name="${n}"]`); if (!m) { m = document.createElement('meta'); m.name = n; document.head.appendChild(m); } m.content = c; };
    setMeta('theme-color', '#0f0e17');
    setMeta('viewport', 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover');
    setMeta('apple-mobile-web-app-capable', 'yes');
    setMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
    setMeta('apple-mobile-web-app-title', 'Fretworks');
    let ml = document.querySelector('link[rel="manifest"]'); if (!ml) { ml = document.createElement('link'); ml.rel = 'manifest'; document.head.appendChild(ml); } ml.href = '/manifest.webmanifest';
    window.scrollTo(0, 0);
    const lock = () => { if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0); };
    window.addEventListener('scroll', lock, { passive: true });
    return () => { document.head.removeChild(style); window.removeEventListener('scroll', lock); };
  }, []);

  const TABS = [
    { id: 'positions', label: 'Positions', icon: '🎸' }, { id: 'practice', label: 'Practice', icon: '🎯' },
    { id: 'modes', label: 'Modes', icon: '🎼' }, { id: 'map', label: 'Scale Map', icon: '🗺️' },
    { id: 'guide', label: 'Guide', icon: '📖' }, { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];
  const CW = 600;
  // On Positions the heading names what the neck shows — C Mixolydian, and
  // whose notes those are. Modes and Scale Map are about the key itself (D
  // Dorian is the ii of C major there), so they keep "C major".
  const onMode = tab === 'positions' && modeK > 0;

  return (
    <div style={{ background: '#0f0e17', height: '100dvh', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', color: '#fffffe', fontFamily: 'var(--font-body)', WebkitFontSmoothing: 'antialiased' }}>
      <AppHeader toolKey={TOOL_KEY}>
        <button className={`fw-header-btn${labelMode === 'degrees' ? ' is-on' : ''}`} onClick={() => setLabelMode(m => m === 'degrees' ? 'notes' : 'degrees')}>
          {labelMode === 'degrees' ? '✦ Degrees' : 'Note names'}
        </button>
      </AppHeader>
      <TabBar toolKey={TOOL_KEY} tabs={TABS} active={tab} onChange={go} />

      {!drilling && tab !== 'guide' && tab !== 'settings' && <div style={{ borderBottom: '1px solid #1a1928' }}>
        <div style={{ padding: '8px 10px', maxWidth: CW, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{onMode ? modeTitle(root, modeK) : keyTitle(root)}</div>
            <div style={{ fontSize: 10.5, color: '#777' }}>{onMode ? 'notes of' : RELATIVE.label} <span style={{ color: '#aaa', fontWeight: 700 }}>{onMode ? parentTitleOf(root, modeK) : spellIn(SCALE_ID, root, RELATIVE.iv)}</span></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 3 }}>
            {KEYS.map((n, i) => <button key={i} onClick={() => setRoot(i)}
              style={{ padding: '7px 0', borderRadius: 6, fontSize: 10.5, fontWeight: 800, cursor: 'pointer', minHeight: 34, border: `1px solid ${root === i ? ACC : '#2a2840'}`, background: root === i ? ACC : 'transparent', color: root === i ? ON_DARK : '#999', touchAction: 'manipulation' }}>{n}</button>)}
          </div>
        </div>
      </div>}

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'none' }}>
        <div style={{ maxWidth: CW, margin: '0 auto', paddingBottom: 'max(80px,env(safe-area-inset-bottom))' }}>
          {tab === 'positions' && <PositionsTab root={root} labelMode={labelMode} view={pos.view} setView={v => setPos(p => ({ ...p, view: v }))}
            shapeId={pos.shape} onShapeId={id => setPos(p => ({ ...p, shape: id }))} tn={pos.tn} setTn={n => setPos(p => ({ ...p, tn: n }))}
            modeK={modeK} onMode={changeMode} focusId={focus.shape} onFocus={moveFocus} onPractise={() => go('practice')} />}
          {tab === 'practice' && <PracticeTab root={root} labelMode={labelMode} settings={settings} srs={srs} onGrade={grade} focusId={focus.shape} onFocus={moveFocus} onSession={setDrilling} />}
          {tab === 'modes' && <ModesTab root={root} onSee={seeMode} />}
          {tab === 'map' && <ScaleMapTab root={root} labelMode={labelMode} onSee={seeMode} />}
          {tab === 'guide' && <GuideTab />}
          {tab === 'settings' && <SettingsTab settings={settings} onChange={setSettings} onResetProgress={resetProgress} />}
        </div>
      </div>
      <BannerStack />
    </div>
  );
}
