import { Folder, type Face } from '../fold';
import type { Pose } from '../motion';
import type { P2 } from '../geom';

/**
 * The traditional whale: a kite with its narrow point as the tail, the wide
 * point folded back for a blunt head, the model folded in half along its belly,
 * and the tail lifted with an outside reverse fold. It swims with a flick of the
 * tail, then dives.
 *
 * Sheet coordinates: the diamond with corners (0, ±1) and (±1, 0), coloured side
 * down. The left corner becomes the tail.
 */

const L: P2 = [-1, 0];
const HEAD = 0.55;     // the wide point folds back along this line
const TAIL = -0.5;     // where the tail's crease starts, on the belly
const TAIL_DIR = 118;  // which way the lifted tail points (degrees; it lay along the belly at 180)
const FLICK = -16;

const kite = (σ: number): P2 => {
  const a = Math.PI / 8;
  return [L[0] + 3 * Math.cos(a), σ * 3 * Math.sin(a)];
};

const swim = (u: number): Partial<Pose> => ({
  ty: 0.04 * Math.sin(u * Math.PI * 2),
  rz: 2.5 * Math.sin(u * Math.PI * 2 - 0.6),
});

export function buildWhale() {
  const F = new Folder({ rx: -18, ry: 180, ty: 0.6, tz: 0.4, o: 0 }, [[0, -1], [1, 0], [0, 1], [-1, 0]]);

  F.step({ diagram: 1, label: 'Start with a square', duration: 0.7, phase: 'intro', ease: 'out', pose: { ty: 0, tz: 0, o: 1 }, arc: { rz: -4 } });

  F.step({ diagram: 2, label: 'Fold the edges to the centre', duration: 0.9 }, (s) => {
    s.fold(L, kite(1), { side: [0, 1], toward: -1, at: [0, 0.7] });
    s.fold(L, kite(-1), { side: [0, -1], toward: -1, at: [0.3, 1] });
  });

  F.step({ diagram: 3, label: 'Fold the wide point back', duration: 0.7, pose: { s: 1.1 } }, (s) => {
    s.fold([HEAD, -1], [HEAD, 1], { side: [1, 0], toward: -1 });
  });

  // In half along the belly, the bottom half behind, so the back curves up to the head.
  F.step({ diagram: 4, label: 'Fold in half', duration: 0.8, ease: 'inOut', pose: { s: 1.45, ty: -0.25 } }, (s) => {
    s.fold([-1, 0], [1, 0], { side: [0, -1], toward: 1 });
  });

  let tail: Face[] = [];
  F.step({ diagram: 5, label: 'Lift the tail', duration: 0.8, ease: 'inOut', pose: { s: 1.5, ty: -0.35, tx: 0.08 } }, (s) => {
    const a = (((180 + TAIL_DIR) / 2) * Math.PI) / 180;
    const crease: [P2, P2] = [[TAIL, 0], [TAIL + Math.cos(a), Math.sin(a)]];
    // The crease runs across the tail only: on its far side there is no paper.
    const end = s.select((f) => f.flat);
    // Folded in half toward you, the bottom half of the sheet is the front.
    tail = s.reverse(end, crease, { side: L, axis: [[TAIL, 0], L], front: (f) => f.sheet[1] < 0, kind: 'outside', roll: 'last', book: true });
  });

  F.step({ diagram: 5, label: 'Swim', duration: 1.4, ease: 'linear', path: swim }, (s) => {
    s.attach(tail, s.swing([TAIL, 0], FLICK, { ease: 'breathe' }));
  });
  F.step({ diagram: 5, label: 'Swim on', duration: 1.4, ease: 'linear', path: swim });
  F.step({ diagram: 5, label: 'Dive', duration: 1.0, phase: 'outro', ease: 'in', pose: { ty: -0.9, rz: -22, o: 0 } });
  return F.compile();
}
