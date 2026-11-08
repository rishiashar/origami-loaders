import { Folder } from '../fold';
import type { P2 } from '../geom';

/**
 * A square pleated like an accordion that breathes in and out, with a wave
 * running from the middle pleat outward. Made for "thinking" and other waits
 * with no end in sight: simple enough to read at 24 px.
 *
 * Five panels; the middle one stays put and the rest hang off it on both
 * sides, each crease alternating valley and mountain.
 */
const PANELS = 5;
const W = 2 / PANELS;
const MID = (PANELS - 1) / 2;
const DEPTH = 84;
const BREATHS = 6;

const crease = (k: number): [P2, P2] => [[-1 + k * W, -1], [-1 + k * W, 1]];

export function buildPleat() {
  const F = new Folder({ rx: -42, ry: 28, ty: 0.55, tz: 0.4, o: 0 });

  F.step({ diagram: 1, label: 'Start with a square', duration: 0.6, phase: 'intro', ease: 'out', pose: { ty: 0, tz: 0, o: 1 } });

  // Crease every pleat once, so the breaths below are pure motion.
  F.step({ diagram: 2, label: 'Crease the pleats', duration: 0.01 }, (s) => {
    for (let k = 1; k < PANELS; k++) s.split(s.select(), ...crease(k));
  });

  for (let n = 0; n < BREATHS; n++) {
    F.step({ diagram: 2, label: 'Pleat', duration: 1.45, ease: 'breathe' }, (s) => {
      const joints: number[] = [];
      for (let k = 1; k < PANELS; k++) {
        const [a, b] = crease(k);
        const outward = k > MID ? 1 : -1;
        const side: P2 = [a[0] + 0.1 * outward, 0];
        const delay = 0.16 * Math.abs(k - (MID + 0.5)) / MID;
        joints[k] = s.hinge(a, b, side, k % 2 ? 1 : -1, DEPTH, { at: [delay, 0.84 + delay], ease: 'breathe' });
      }
      const panel = (i: number) => s.select((f) => Math.floor((f.sheet[0] + 1) / W) === i);
      for (let i = 0; i < PANELS; i++) {
        if (i === MID) continue;
        // Inner first: the crease next to this panel, out to the one next to the middle.
        const chain: number[] = [];
        if (i > MID) for (let k = i; k > MID; k--) chain.push(joints[k]);
        else for (let k = i + 1; k <= MID; k++) chain.push(joints[k]);
        s.attach(panel(i), ...chain);
      }
    });
  }

  F.step({ diagram: 2, label: 'Done', duration: 0.5, phase: 'outro', ease: 'in', pose: { o: 0, s: 0.92 } });
  return F.compile();
}
