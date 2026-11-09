import { Folder } from '../fold';
import type { Pose } from '../motion';
import type { P2 } from '../geom';

/**
 * The traditional swan: a kite, turned over and narrowed into a second kite;
 * the narrow point folds up to become the neck, the model folds in half, and
 * the neck and head swing up. It drifts on the water, then glides away.
 *
 * Sheet coordinates: the diamond with corners (0, ±1) and (±1, 0), coloured side
 * down. The bottom point becomes the neck, the top point the tail.
 */

const B: P2 = [0, -1];
/** A point `r` from the bottom point, `deg` off the centre line, on side σ. */
const along = (deg: number, σ: number, r = 3): P2 => {
  const a = (deg * Math.PI) / 180;
  return [σ * r * Math.sin(a), -1 + r * Math.cos(a)];
};
/** How far along the raised neck the head bends. */
const HEAD = 0.8;
const NECK_UP = 100;
const HEAD_DOWN = 100;

const drift = (u: number): Partial<Pose> => ({
  ty: 0.03 * Math.sin(u * Math.PI * 2),
  rz: 1.5 * Math.sin(u * Math.PI * 2 + 0.8),
});

export function buildSwan() {
  const F = new Folder({ rx: -20, ry: 180, ty: 0.6, tz: 0.4, o: 0 }, [[0, -1], [1, 0], [0, 1], [-1, 0]]);

  F.step({ diagram: 1, label: 'Start with a square', duration: 0.7, phase: 'intro', ease: 'out', pose: { ty: 0, tz: 0, o: 1 }, arc: { rz: -4 } });

  F.step({ diagram: 2, label: 'Fold the edges to the centre', duration: 0.9 }, (s) => {
    s.fold(B, along(22.5, -1), { side: [-1, 0], toward: -1, at: [0, 0.7] });
    s.fold(B, along(22.5, 1), { side: [1, 0], toward: -1, at: [0.3, 1] });
  });

  F.step({ diagram: 3, label: 'Turn over', duration: 0.7, ease: 'inOut', pose: { ry: 360 }, arc: { tz: 0.3 } });

  F.step({ diagram: 4, label: 'Fold the edges to the centre again', duration: 0.9, pose: { s: 1.1 } }, (s) => {
    s.fold(B, along(11.25, -1), { side: along(17, -1, 0.75), toward: 1, at: [0, 0.7] });
    s.fold(B, along(11.25, 1), { side: along(17, 1, 0.75), toward: 1, at: [0.3, 1] });
  });

  F.step({ diagram: 5, label: 'Fold the point up for the neck', duration: 0.8, pose: { s: 1.25, ty: -0.3 } }, (s) => {
    s.fold([-1, 0], [1, 0], { side: B, toward: 1 });
  });

  // Fold in half away from you, and turn it on its side: the keel is the water line.
  F.step({ diagram: 6, label: 'Fold in half', duration: 0.9, ease: 'inOut', pose: { rz: -90, rx: -10, s: 1.5, tx: -0.6, ty: -0.25 } }, (s) => {
    s.fold([0, -1], [0, 1], { side: [0.5, 0.5], toward: -1 });
  });

  F.step({ diagram: 7, label: 'Pull the neck up', duration: 0.9, ease: 'inOut', pose: { s: 1.55, ty: -0.45 } }, (s) => {
    s.attach(s.select((f) => f.sheet[1] < 0), s.swing([0, 0], NECK_UP, { ease: 'inOut' }));
  });

  F.step({ diagram: 8, label: 'Bend the head', duration: 0.7, ease: 'inOut' }, (s) => {
    const a = (NECK_UP * Math.PI) / 180;
    const dir: P2 = [-Math.sin(a), Math.cos(a)];
    const hp: P2 = [dir[0] * HEAD, dir[1] * HEAD];
    const across: P2 = [hp[0] - dir[1], hp[1] + dir[0]];
    const parts = s.split(s.select((f) => f.sheet[1] < 0 && f.flat), hp, across);
    const head = parts.filter((f) => {
      const m = s.info(f).model;
      return (m[0] - hp[0]) * dir[0] + (m[1] - hp[1]) * dir[1] > 0;
    });
    s.attach(head, s.swing(hp, HEAD_DOWN, { ease: 'inOut' }));
  });

  F.step({ diagram: 8, label: 'Drift', duration: 2.4, ease: 'linear', path: drift });
  F.step({ diagram: 8, label: 'Glide away', duration: 1.1, phase: 'outro', ease: 'in', pose: { tx: -2.0, o: 0 } });
  return F.compile();
}
