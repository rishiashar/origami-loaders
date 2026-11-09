import { Folder } from '../fold';
import type { Pose } from '../motion';

/**
 * A sailboat in three folds: the square folded on its diagonal is the sail,
 * a band folded up from the bottom is the hull, and a small corner folded
 * behind slants the stern to match the bow. It rocks on the water, then sails off.
 *
 * Sheet coordinates: the square [-1, 1]², mast along the right edge (seen from
 * behind, so it stands on the left with the bow to the right).
 */

const DECK = -0.3;       // where the hull meets the sail
const KEEL = -0.65;      // the fold under the hull
const band = KEEL - DECK; // negative: how far below the deck the keel sits

/** Rocking on small waves: two swells per loop. */
const rock = (u: number): Partial<Pose> => ({
  rz: 3.5 * Math.sin(u * Math.PI * 4),
  ty: 0.025 * Math.sin(u * Math.PI * 4 + 1.2),
});

export function buildBoat() {
  // Coloured side down, as on a table: every fold comes toward you and shows the colour.
  const F = new Folder({ rx: -24, ry: 190, ty: 0.6, tz: 0.4, o: 0 });

  F.step({ diagram: 1, label: 'Start with a square', duration: 0.8, phase: 'intro', ease: 'out', pose: { ty: 0, tz: 0, o: 1 }, arc: { rz: -4 } });

  F.step({ diagram: 2, label: 'Fold in half diagonally', duration: 0.8 }, (s) => {
    s.fold([-1, -1], [1, 1], { side: [-1, 1], toward: -1, at: [0.05, 1] });
  });

  F.step({ diagram: 3, label: 'Fold the bottom up for the hull', duration: 0.8, pose: { s: 1.1, ty: 0.12 } }, (s) => {
    s.fold([-1, KEEL], [1, KEEL], { side: [0, -0.9], toward: -1 });
  });

  // The fold under the hull leaves a slanted bow; match it with a slanted stern.
  F.step({ diagram: 4, label: 'Fold the stern corner behind', duration: 0.7, pose: { s: 1.2, ty: 0.18 } }, (s) => {
    s.fold([1, KEEL - band * 0.62], [1 + band * 0.62, KEEL], { side: [1, KEEL], toward: 1 });
  });

  F.step({ diagram: 5, label: 'Afloat', duration: 2.4, ease: 'linear', path: rock });
  F.step({ diagram: 5, label: 'Sail away', duration: 1.0, phase: 'outro', ease: 'in', pose: { tx: 1.5, s: 1.05, o: 0 }, arc: { rz: -3 } });
  return F.compile();
}
