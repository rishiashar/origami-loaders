import { Folder, type Face } from '../fold';
import { eases, type Pose } from '../motion';
import type { P2 } from '../geom';

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

const LOOP = 0.6;
const RADIUS = 0.42;
function flight(u: number): Partial<Pose> {
  if (u < LOOP) {
    const θ = 2 * Math.PI * eases.inOut(u / LOOP);
    // Shrink a little over the top so the loop stays inside the loader's box.
    const top = (1 - Math.cos(θ)) / 2; // 0 at the start and end of the loop, 1 at the top
    return { tx: RADIUS * Math.sin(θ), ty: (2 * RADIUS - 0.3) * top, rz: (θ * 180) / Math.PI, s: -0.22 * top };
  }
  const b = eases.in((u - LOOP) / (1 - LOOP));
  return { tx: 2.6 * b, ty: 0.9 * b, tz: 0.3 * b, rz: 360 + 14 * b, o: -b };
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

  F.step({ diagram: 7, label: 'Open the wings', duration: 1.2, ease: 'inOut', pose: { rx: -38, ry: 30, rz: -62, s: 1.3, ty: -0.2 } }, (s) => {
    s.attach(front, s.hinge(nose, wing, [-0.6, -0.8], -1, 90, { ease: 'inOut' }));
    s.attach(back, s.hinge(nose, wing, [-0.6, -0.8], 1, 90, { ease: 'inOut' }));
  });
  F.step({ diagram: 7, label: 'Ready to fly', duration: 0.6, ease: 'inOut' });
  // One loop-the-loop, nose pitching all the way round, then off up and away.
  F.step({ diagram: 7, label: 'Fly', duration: 2.1, phase: 'outro', ease: 'linear', path: flight });

  return F.compile();
}
