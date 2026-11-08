import type { Model } from './index';

/**
 * The traditional paper crane.
 *
 * Status: steps 1–3 of the classic 14-step diagram (pre-creasing the sheet).
 * The crease pattern below is the preliminary-base pattern — the same creases
 * collapse into the square base in step 4.
 *
 *   tl ── t ── tr
 *   │ ╲   │   ╱ │
 *   l ─── c ─── r
 *   │ ╱   │   ╲ │
 *   bl ── b ── br
 */
export const crane: Model = {
  pattern: {
    vertices: {
      c: [0, 0],
      tl: [-1, 1], t: [0, 1], tr: [1, 1], r: [1, 0],
      br: [1, -1], b: [0, -1], bl: [-1, -1], l: [-1, 0],
    },
    faces: {
      'top-left': ['c', 't', 'tl'],
      'left-top': ['c', 'tl', 'l'],
      'left-bottom': ['c', 'l', 'bl'],
      'bottom-left': ['c', 'bl', 'b'],
      'bottom-right': ['c', 'b', 'br'],
      'right-bottom': ['c', 'br', 'r'],
      'right-top': ['c', 'r', 'tr'],
      'top-right': ['c', 'tr', 't'],
    },
    creases: {
      // diagonal from top-left to bottom-right: the top-right corner folds onto the bottom-left
      diagA: [['tl', 'c'], ['c', 'br']],
      diagB: [['bl', 'c'], ['c', 'tr']],
      vertical: [['t', 'c'], ['c', 'b']],
      horizontal: [['l', 'c'], ['c', 'r']],
    },
  },
  sequence: {
    name: 'crane',
    // Bottom-left of the sheet stays on the table; everything folds onto it.
    root: 'left-bottom',
    // Sheet lying on a table, seen from slightly above and to the side.
    pose: { rx: -32, ry: 10, rz: 0, ty: 0.75, tz: 0.6, o: 0 },
    steps: [
      {
        diagram: 1, label: 'Start with a square', duration: 1.0, phase: 'intro', ease: 'out',
        pose: { ty: 0, tz: 0, o: 1 }, arc: { rz: -6 },
      },
      {
        diagram: 2, label: 'Fold in half diagonally', duration: 0.8,
        folds: [{ crease: 'diagA', to: 180, at: [0.1, 1], ease: 'fold' }],
      },
      {
        diagram: 2, label: 'Unfold', duration: 0.5,
        folds: [{ crease: 'diagA', to: 0, ease: 'inOut' }],
      },
      {
        diagram: 2, label: 'Fold the other diagonal', duration: 0.8,
        folds: [{ crease: 'diagB', to: 180, at: [0.1, 1], ease: 'fold' }],
      },
      {
        diagram: 2, label: 'Unfold', duration: 0.5,
        folds: [{ crease: 'diagB', to: 0, ease: 'inOut' }],
      },
      {
        diagram: 3, label: 'Turn the paper over', duration: 0.9, ease: 'inOut',
        pose: { rx: 148 }, arc: { tz: 0.5 },
      },
      {
        // seen from the back now, so folding toward us is a mountain fold on the front
        diagram: 3, label: 'Fold in half', duration: 0.8,
        folds: [{ crease: 'vertical', to: -180, at: [0.1, 1], ease: 'fold' }],
      },
      {
        diagram: 3, label: 'Unfold', duration: 0.5,
        folds: [{ crease: 'vertical', to: 0, ease: 'inOut' }],
      },
      {
        diagram: 3, label: 'Fold in half the other way', duration: 0.8,
        folds: [{ crease: 'horizontal', to: -180, at: [0.1, 1], ease: 'fold' }],
      },
      {
        diagram: 3, label: 'Unfold', duration: 0.5,
        folds: [{ crease: 'horizontal', to: 0, ease: 'inOut' }],
      },
      {
        // placeholder for the finished crane flying off
        diagram: 3, label: 'Ready for step 4', duration: 0.9, phase: 'outro', ease: 'in',
        pose: { ty: 0.9, tz: 0.6, o: 0 },
      },
    ],
  },
};
