# Natural Minor Trainer

Part of [Fretworks](https://fretworks.vercel.app) — live at
[fretworks.vercel.app/natural-minor](https://fretworks.vercel.app/natural-minor/).

Learn the natural minor scale in five CAGED shapes, three-notes-per-string and
the full neck; its seven modes and the seven chords of the key; and where it
differs from harmonic and melodic minor. Spaced-repetition practice with shape,
signature-note and mode drills.

Shares its code with [Harmonic Minor Trainer](https://github.com/SyncopatedSyntax/HarmonicMinorTrainer)
and [Major Scale Trainer](https://github.com/SyncopatedSyntax/MajorScaleTrainer)
— only `src/scale.js` differs.

```
npm install
npm run dev      # http://localhost:5188/natural-minor/
npm run verify   # correctness gate — every shape re-derived from first principles
npm run build
```

See `CLAUDE.md` for how it is built and why.
