// Generated from src/models/fox.ts in origami-loaders by `npm run skill`. Do not edit here.
import { Folder, type Face } from 'origami-loaders';
import type { Pose } from 'origami-loaders';
import type { P2 } from 'origami-loaders';

/**
 * A fox's face: fold the square in half to a triangle, bring both corners down
 * to the bottom point, then fold them back up past the top at an angle so they
 * stand up as ears. The bottom point is the snout, its very tip tucked behind.
 * While it waits it tilts its head and twitches its ears; then it trots off.
 *
 * Sheet coordinates: the diamond with corners (0, ±1) and (±1, 0), coloured side
 * down.
 */

const O: P2 = [0, 0];
const B: P2 = [0, -1];
/** Each ear folds on a line from the flap's outer corner to this height on the centre line. */
const EAR_LINE = -0.3;
const NOSE = -0.9;
const TWITCH = 28;

const leftQ = (p: P2) => p[0] < -Math.abs(p[1]);
const rightQ = (p: P2) => p[0] > Math.abs(p[1]);
const earLine = (σ: number): [P2, P2] => [[σ * 0.5, -0.5], [0, EAR_LINE]];

/** A curious tilt one way, then the other. */
const tilt = (u: number): Partial<Pose> => ({ rz: 9 * Math.sin(u * Math.PI * 2) * Math.sin(u * Math.PI) });

export function buildFox() {
  const F = new Folder({ rx: -14, ry: 180, ty: 0.6, tz: 0.4, o: 0 }, [[0, -1], [1, 0], [0, 1], [-1, 0]]);

  F.step({ diagram: 1, label: 'Start with a square', duration: 0.7, phase: 'intro', ease: 'out', pose: { ty: 0, tz: 0, o: 1 }, arc: { rz: -4 } });

  F.step({ diagram: 2, label: 'Fold the top corner down', duration: 0.7 }, (s) => {
    s.fold([-1, 0], [1, 0], { side: [0, 1], toward: -1, at: [0.05, 1] });
  });

  F.step({ diagram: 3, label: 'Fold the corners to the bottom', duration: 0.9, pose: { s: 1.4, ty: 0.25 } }, (s) => {
    s.fold(O, [-0.5, -0.5], { side: [-1, 0], toward: -1, at: [0, 0.7] });
    s.fold(O, [0.5, -0.5], { side: [1, 0], toward: -1, at: [0.3, 1] });
  });

  let ears: Face[][] = [];
  F.step({ diagram: 4, label: 'Fold the ears up', duration: 1.0, pose: { s: 1.55, ty: 0.2 } }, (s) => {
    ears = [-1, 1].map((σ, i) =>
      s.fold(...earLine(σ), { where: (f) => (σ < 0 ? leftQ : rightQ)(f.sheet), side: B, toward: -1, at: i ? [0.3, 1] : [0, 0.7] }));
  });

  F.step({ diagram: 5, label: 'Tuck the nose behind', duration: 0.6, pose: { s: 1.6, ty: 0.28 } }, (s) => {
    s.fold([-1, NOSE], [1, NOSE], { side: B, toward: 1 });
  });

  F.step({ diagram: 6, label: 'Tilt the head', duration: 1.6, ease: 'linear', path: tilt });
  F.step({ diagram: 6, label: 'Twitch the ears', duration: 0.9, ease: 'linear' }, (s) => {
    ears.forEach((faces, i) => {
      const σ = i ? 1 : -1;
      const [a, b] = earLine(σ);
      s.attach(faces, s.hinge(a, b, [σ * 0.6, 0.3], -1, TWITCH, { ease: 'breathe', at: i ? [0.25, 1] : [0, 0.75] }));
    });
  });
  F.step({ diagram: 6, label: 'Trot off', duration: 0.9, phase: 'outro', ease: 'in', pose: { tx: -1.4, o: 0 }, arc: { ty: 0.08 } });
  return F.compile();
}
