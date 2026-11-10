// Generated from src/models/heart.ts in origami-loaders by `npm run skill`. Do not edit here.
import { Folder } from 'origami-loaders';
import type { Pose } from 'origami-loaders';
import type { P2 } from 'origami-loaders';

/**
 * The classic paper heart: fold the top corner to the centre and the bottom
 * corner up to the top edge, fold both sides up along the centre line, then
 * blunt the four corners behind. No turning over: the side you fold on is the
 * heart. It beats, then floats away.
 *
 * Sheet coordinates: the diamond with corners (0, ±1) and (±1, 0), coloured side
 * down.
 */

const TOP = 0.5;          // the top corner folds down to the centre, leaving this edge
const BASE = -0.25;       // the bottom corner folds up to the top edge along this line
const TIP: P2 = [0, BASE];
/** How much of each corner folds behind to round the lobes. */
const ROUND = 0.12;

/** Lub-dub: two quick swells, then rest. */
const beat = (u: number): Partial<Pose> => {
  const pulse = (c: number, w: number, a: number) => a * Math.exp(-(((u - c) / w) ** 2));
  return { s: pulse(0.18, 0.06, 0.09) + pulse(0.36, 0.07, 0.06) };
};

export function buildHeart() {
  const F = new Folder({ rx: -16, ry: 180, ty: 0.6, tz: 0.4, o: 0 }, [[0, -1], [1, 0], [0, 1], [-1, 0]]);

  F.step({ diagram: 1, label: 'Start with a square', duration: 0.7, phase: 'intro', ease: 'out', pose: { ty: 0, tz: 0, o: 1 }, arc: { rz: -4 } });

  F.step({ diagram: 2, label: 'Fold the top corner to the centre', duration: 0.7 }, (s) => {
    s.fold([-1, TOP], [1, TOP], { side: [0, 1], toward: -1, at: [0.05, 1] });
  });

  F.step({ diagram: 3, label: 'Fold the bottom corner up', duration: 0.8 }, (s) => {
    s.fold([-1, BASE], [1, BASE], { side: [0, -1], toward: -1 });
  });

  F.step({ diagram: 4, label: 'Fold the sides up to the centre', duration: 1.0, pose: { s: 1.3, ty: -0.2 } }, (s) => {
    s.fold(TIP, [-1, BASE + 1], { side: [-0.9, -0.05], toward: -1, at: [0, 0.7] });
    s.fold(TIP, [1, BASE + 1], { side: [0.9, -0.05], toward: -1, at: [0.3, 1] });
  });

  // Round the lobes: the two top points and the two side points fold behind.
  F.step({ diagram: 5, label: 'Fold the corners behind', duration: 0.9, pose: { s: 1.55, ty: -0.4 } }, (s) => {
    const corners: { p: P2; a: P2; b: P2; top: boolean }[] = [];
    for (const σ of [-1, 1]) {
      const top: P2 = [σ * 0.25, 0.75];
      const side: P2 = [σ * 0.625, 0.375];
      const notch: P2 = [0, TOP];
      corners.push({ p: top, a: notch, b: side, top: true }, { p: side, a: top, b: TIP, top: false });
    }
    corners.forEach(({ p, a, b, top }, i) => {
      const toward = (q: P2): P2 => {
        const d = [q[0] - p[0], q[1] - p[1]];
        const n = Math.hypot(d[0], d[1]);
        return [p[0] + (d[0] / n) * ROUND, p[1] + (d[1] / n) * ROUND];
      };
      // The two top folds lie on one line: keep each to its own lobe.
      const lobe = Math.sign(p[0]);
      s.fold(toward(a), toward(b), { where: top ? (f) => f.model[0] * lobe > -0.1 : undefined, side: p, toward: 1, at: [i * 0.12, 0.64 + i * 0.12] });
    });
  });

  F.step({ diagram: 5, label: 'Beat', duration: 1.1, ease: 'linear', path: beat });
  F.step({ diagram: 5, label: 'Beat again', duration: 1.1, ease: 'linear', path: beat });
  F.step({ diagram: 5, label: 'Float away', duration: 1.0, phase: 'outro', ease: 'in', pose: { ty: 0.4, s: 1.35, o: 0 } });
  return F.compile();
}
