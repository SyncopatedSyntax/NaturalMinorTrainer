// The ONE file that differs between natural-minor-trainer,
// harmonic-minor-trainer and major-scale-trainer. Everything else in src/ and
// scripts/ is shared and must be kept identical in all three repos.
export const SCALE_ID = 'natural';
export const TOOL_KEY = 'nm';          // @fretworks/design registry key
export const PREFIX = 'nm_';           // localStorage prefix (sync + backup use it)
export const ACCENT = '#f472b6';       // rose pink
export const APP_NAME = 'Natural Minor Trainer';
