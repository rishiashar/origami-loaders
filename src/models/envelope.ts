import { Folder } from '../fold';
import type { P2 } from '../geom';

/**
 * An envelope: the four corners of a square folded to the centre (a blintz),
 * seen as a diamond so the result stands upright. Four plain folds, so
 * progress maps neatly onto it: a quarter of the work, one corner.
 */
const folds: { label: string; line: [P2, P2]; corner: P2 }[] = [
  { label: 'Fold the top corner down', line: [[1, 0], [0, 1]], corner: [1, 1] },
  { label: 'Fold the bottom corner up', line: [[-1, 0], [0, -1]], corner: [-1, -1] },
  { label: 'Fold the right corner in', line: [[0, -1], [1, 0]], corner: [1, -1] },
  { label: 'Fold the left corner in', line: [[0, 1], [-1, 0]], corner: [-1, 1] },
];

export function buildEnvelope() {
  const F = new Folder({ rx: -26, ry: 8, rz: 45, s: 0.92, ty: 0.55, tz: 0.4, o: 0 });

  F.step({ diagram: 1, label: 'Start with a square', duration: 0.7, phase: 'intro', ease: 'out', pose: { ty: 0, tz: 0, o: 1 } });

  folds.forEach(({ label, line, corner }, i) => {
    const pose = i === 3 ? { s: 1.3 } : i === 1 ? { s: 1.08 } : undefined;
    F.step({ diagram: i + 2, label, duration: 0.6, pose }, (s) => {
      s.fold(line[0], line[1], { side: corner, toward: 1, at: [0.05, 1] });
    });
  });

  F.step({ diagram: 5, label: 'Sealed', duration: 0.7, ease: 'inOut', arc: { s: -0.05 } });
  F.step({ diagram: 5, label: 'Into the inbox', duration: 0.6, phase: 'outro', ease: 'in', pose: { ty: -0.5, s: 1.0, o: 0 } });
  return F.compile();
}
