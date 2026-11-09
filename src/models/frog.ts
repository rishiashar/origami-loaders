import { Folder } from '../fold';
import type { Pose } from '../motion';
import type { P2 } from '../geom';

/**
 * A frog's face, folded from a square held as a diamond: fold it in half, bring
 * both corners down, fold their tips back up past the top for the eyes, blunt the
 * eyes behind, and tuck the chin. It hops in place, then hops away.
 *
 * Sheet coordinates: the diamond with corners (0, ±1) and (±1, 0), coloured side
 * down (seen from behind), so every fold comes toward you.
 */

const O: P2 = [0, 0];
const B: P2 = [0, -1];
/**
 * Each eye folds on a line from the flap's outer corner to this height on the
 * centre line. Starting at the corner keeps the fold off the flap's hinge.
 */
const EYE_LINE = -0.38;
/** How much of each eye tip folds behind, to round it. */
const PUPIL = 0.15;
const CHIN = -0.62;

const eyeLine = (σ: number): [P2, P2] => [[σ * 0.5, -0.5], [0, EYE_LINE]];

/** Mirror image of p across the line a→b. */
function reflect(p: P2, [a, b]: [P2, P2]): P2 {
  const d = [b[0] - a[0], b[1] - a[1]];
  const t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / (d[0] * d[0] + d[1] * d[1]);
  const f = [a[0] + d[0] * t, a[1] + d[1] * t];
  return [2 * f[0] - p[0], 2 * f[1] - p[1]];
}

const leftQ = (p: P2) => p[0] < -Math.abs(p[1]);
const rightQ = (p: P2) => p[0] > Math.abs(p[1]);

/** One hop: up and back down, squashing a little on landing. */
const hop = (u: number): Partial<Pose> => {
  const air = Math.min(1, u / 0.7);
  const land = u > 0.7 ? Math.sin(((u - 0.7) / 0.3) * Math.PI) : 0;
  return { ty: 0.42 * Math.sin(air * Math.PI), s: -0.06 * land + 0.03 * Math.sin(air * Math.PI), rz: 4 * Math.sin(air * Math.PI * 2) };
};

/** Hop off to the right in two bounds, fading out. */
const away = (u: number): Partial<Pose> => {
  const bounce = Math.abs(Math.sin(u * Math.PI * 2));
  return { tx: 1.6 * u, ty: 0.38 * bounce, rz: -8 * u, o: -Math.max(0, (u - 0.4) / 0.6) };
};

export function buildFrog() {
  const F = new Folder({ rx: -18, ry: 180, s: 1.15, ty: 0.6, tz: 0.4, o: 0 }, [[0, -1], [1, 0], [0, 1], [-1, 0]]);

  F.step({ diagram: 1, label: 'Start with a square', duration: 0.7, phase: 'intro', ease: 'out', pose: { ty: 0, tz: 0, o: 1 }, arc: { rz: -4 } });

  F.step({ diagram: 2, label: 'Fold the top corner down', duration: 0.7 }, (s) => {
    s.fold([-1, 0], [1, 0], { side: [0, 1], toward: -1, at: [0.05, 1] });
  });

  F.step({ diagram: 3, label: 'Fold the corners to the bottom', duration: 0.9, pose: { s: 1.45, ty: 0.25 } }, (s) => {
    s.fold(O, [-0.5, -0.5], { side: [-1, 0], toward: -1, at: [0, 0.7] });
    s.fold(O, [0.5, -0.5], { side: [1, 0], toward: -1, at: [0.3, 1] });
  });

  F.step({ diagram: 4, label: 'Fold the tips up for eyes', duration: 0.9, pose: { s: 1.6, ty: 0.1 } }, (s) => {
    s.fold(...eyeLine(-1), { where: (f) => leftQ(f.sheet), side: B, toward: -1, at: [0, 0.7] });
    s.fold(...eyeLine(1), { where: (f) => rightQ(f.sheet), side: B, toward: -1, at: [0.3, 1] });
  });

  F.step({ diagram: 5, label: 'Round off the eyes', duration: 0.7, pose: { s: 1.65 } }, (s) => {
    for (const σ of [-1, 1]) {
      const e = reflect(B, eyeLine(σ));
      const d = [e[0] - B[0], e[1] - B[1]];
      const n = Math.hypot(d[0], d[1]);
      const u: P2 = [d[0] / n, d[1] / n];
      const c: P2 = [e[0] - u[0] * PUPIL, e[1] - u[1] * PUPIL];
      const across: P2 = [c[0] - u[1], c[1] + u[0]];
      s.fold(c, across, { where: (f) => (σ < 0 ? leftQ : rightQ)(f.sheet), side: e, toward: 1, at: σ < 0 ? [0, 0.6] : [0.2, 0.8] });
    }
  });

  F.step({ diagram: 6, label: 'Tuck the chin behind', duration: 0.7, pose: { s: 1.75, ty: 0.32 } }, (s) => {
    s.fold([-1, CHIN], [1, CHIN], { side: B, toward: 1 });
  });

  F.step({ diagram: 7, label: 'Hop', duration: 0.9, ease: 'linear', path: hop });
  F.step({ diagram: 7, label: 'Hop again', duration: 0.9, ease: 'linear', path: hop });
  F.step({ diagram: 7, label: 'Hop away', duration: 1.2, phase: 'outro', ease: 'linear', path: away });
  return F.compile();
}
