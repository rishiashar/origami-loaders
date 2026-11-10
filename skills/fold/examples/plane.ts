// Generated from src/models/plane.ts in origami-loaders by `npm run skill`. Do not edit here.
import { Folder, type Face } from 'origami-loaders';
import { eases, type Pose } from 'origami-loaders';
import type { P2 } from 'origami-loaders';

/**
 * The classic paper dart, from an A4-proportioned sheet (1 : √2), in seven
 * steps. Every fold is a plain valley or mountain fold, so nothing is solved
 * or approximated.
 *
 * Sheet coordinates: x ∈ [−a, a], y ∈ [−1, 1], nose at the top (0, 1).
 */

const a = Math.SQRT1_2;
const nose: P2 = [0, 1];
const t225 = Math.tan(Math.PI / 8);
const t1125 = Math.tan(Math.PI / 16);
/** Second fold: the slanted edge onto the centre line, 22.5° off the keel. */
const edgeL: P2 = [-a, 1 - a / t225];
const edgeR: P2 = [a, 1 - a / t225];
/** Wing fold: 11.25° off the keel, so the wing's top edge lands on the keel. */
const wing: P2 = [-2 * t1125, -1];

const LOOP = 0.62;
const RADIUS = 0.42;
/** Heading on screen in the final, top-down view (spin −40°). */
const HEADING = (50 * Math.PI) / 180;
const d0 = [Math.cos(HEADING), Math.sin(HEADING)];
const n0 = [-d0[1], d0[0]];

/** One banked circle seen from above, then off along the heading, growing smaller. */
function flight(u: number): Partial<Pose> {
  if (u < LOOP) {
    const θ = 2 * Math.PI * eases.inOut(u / LOOP);
    const c = Math.cos(θ), s = Math.sin(θ);
    const rn = [n0[0] * c - n0[1] * s, n0[0] * s + n0[1] * c];
    // Pull the far side of the circle back toward the start so it stays inside the box.
    const far = (1 - c) / 2;
    return {
      tx: RADIUS * (n0[0] - rn[0] - n0[0] * far),
      ty: RADIUS * (n0[1] - rn[1] - n0[1] * far),
      spin: (θ * 180) / Math.PI,
      rz: 14 * Math.sin(θ), // a little bank into the turn
    };
  }
  const b = eases.in((u - LOOP) / (1 - LOOP));
  return { tx: 2.6 * b * d0[0], ty: 2.6 * b * d0[1], spin: 360, s: -0.35 * b, o: -b };
}

export function buildPlane() {
  const F = new Folder({ rx: -30, ry: 12, ty: 0.7, tz: 0.5, o: 0 }, [[-a, -1], [a, -1], [a, 1], [-a, 1]]);

  F.step({ diagram: 1, label: 'Start with a sheet of paper', duration: 1.0, phase: 'intro', ease: 'out', pose: { ty: 0, tz: 0, o: 1 }, arc: { rz: -4 } });

  let half: Face[] = [];
  F.step({ diagram: 2, label: 'Fold in half lengthwise', duration: 0.65 }, (s) => {
    half = s.fold([0, -1], [0, 1], { side: [0.3, 0], toward: 1, at: [0.06, 1] });
  });
  F.step({ diagram: 2, label: 'Unfold', duration: 0.4, ease: 'inOut' }, (s) => {
    s.attach(half, s.hinge([0, -1], [0, 1], [0.3, 0], -1, 180, { ease: 'inOut' }));
  });

  F.step({ diagram: 3, label: 'Fold the top corners to the centre', duration: 0.95 }, (s) => {
    s.fold(nose, [-a, 1 - a], { side: [-a + 0.05, 0.98], toward: 1, at: [0, 0.7] });
    s.fold(nose, [a, 1 - a], { side: [a - 0.05, 0.98], toward: 1, at: [0.3, 1] });
  });

  F.step({ diagram: 4, label: 'Fold the edges to the centre again', duration: 0.95, pose: { s: 1.05 } }, (s) => {
    s.fold(nose, edgeL, { side: [-0.65, 0.2], toward: 1, at: [0, 0.7] });
    s.fold(nose, edgeR, { side: [0.65, 0.2], toward: 1, at: [0.3, 1] });
  });

  // Fold in half away from you so the flaps stay outside; turn it nose-first.
  F.step({ diagram: 5, label: 'Fold the plane in half', duration: 1.0, ease: 'inOut', pose: { rz: -90, s: 1.25, ty: -0.3, tx: 0 } }, (s) => {
    s.fold([0, -1], [0, 1], { side: [0.3, 0], toward: -1 });
  });

  let front: Face[] = [], back: Face[] = [];
  F.step({ diagram: 6, label: 'Fold the wings down', duration: 1.0, ease: 'inOut' }, (s) => {
    front = s.fold(nose, wing, { where: (f) => f.sheet[0] < 0, side: [-0.6, -0.8], toward: 1, at: [0, 0.65] });
    back = s.fold(nose, wing, { where: (f) => f.sheet[0] > 0, side: [-0.6, -0.8], toward: -1, at: [0.35, 1] });
  });

  // Open the wings into a slight V, and turn to the view from above: the shape everyone knows.
  F.step({ diagram: 7, label: 'Open the wings', duration: 1.3, ease: 'inOut', pose: { rx: -30, ry: 90, rz: 0, spin: -40, s: 1.25, ty: 0, tx: 0 } }, (s) => {
    s.attach(front, s.hinge(nose, wing, [-0.6, -0.8], -1, 82, { ease: 'inOut' }));
    s.attach(back, s.hinge(nose, wing, [-0.6, -0.8], 1, 82, { ease: 'inOut' }));
  });
  F.step({ diagram: 7, label: 'Ready to fly', duration: 0.6, ease: 'inOut' });
  F.step({ diagram: 7, label: 'Fly', duration: 2.1, phase: 'outro', ease: 'linear', path: flight });

  return F.compile({ colourDown: true });
}
