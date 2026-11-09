import { Folder, type Face } from '../fold';
import type { Pose } from '../motion';
import type { P2 } from '../geom';

/**
 * The traditional swan, folded the way it is taught: a kite, turned over and
 * narrowed into a second kite; the narrow point folds up to the top for the
 * neck; the model folds in half; the neck is pulled out and up with an outside
 * reverse fold, and an inside reverse fold near its tip makes the head. It
 * drifts on the water, then glides away.
 *
 * Sheet coordinates: the diamond with corners (0, ±1) and (±1, 0), coloured side
 * down. The bottom point becomes the neck, the top point the tail.
 *
 * Once folded in half the fold is the swan's back: the line x = 0, with the body
 * hanging below it on the −x side, the neck's root at y = 0 (the front) and the
 * tail at y = 1. The open edges, and the white inside, end up at the waterline.
 */

const B: P2 = [0, -1];
/** A point `r` from the bottom point, `deg` off the centre line, on side σ. */
const along = (deg: number, σ: number, r = 3): P2 => {
  const a = (deg * Math.PI) / 180;
  return [σ * r * Math.sin(a), -1 + r * Math.cos(a)];
};
const rad = (deg: number) => (deg * Math.PI) / 180;
/** Which way the neck ends up pointing: up (+x), leaning a little forward (−y). Degrees, model space. */
const NECK_DIR = 348;
/** Which way the head points: forward, a little down. */
const HEAD_DIR = 255;
/** The neck's crease starts on the back this far behind its root, leaving a small triangle there. */
const ROOT = 0.19;
/** How much of the neck the head takes. */
const HEAD = 0.2;

/** Mirror image of p across the line a→b. */
function mirror(p: P2, [a, b]: [P2, P2]): P2 {
  const d = [b[0] - a[0], b[1] - a[1]];
  const t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / (d[0] * d[0] + d[1] * d[1]);
  return [2 * (a[0] + d[0] * t) - p[0], 2 * (a[1] + d[1] * t) - p[1]];
}
const line = (p: P2, deg: number): [P2, P2] => [p, [p[0] + Math.cos(rad(deg)), p[1] + Math.sin(rad(deg))]];

function inside(poly: P2[], p: P2): boolean {
  let sgn = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (Math.abs(c) < 1e-9) continue;
    if (sgn && Math.sign(c) !== sgn) return false;
    sgn = Math.sign(c);
  }
  return true;
}

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

  // The neck is everything this fold lifts; later folds cut it, so keep where it came from on the sheet.
  let neckSheet: P2[][] = [];
  F.step({ diagram: 5, label: 'Fold the point up to the top', duration: 0.8, pose: { s: 1.25, ty: -0.3 } }, (s) => {
    neckSheet = s.fold([-1, 0], [1, 0], { side: B, toward: 1 }).map((f) => f.poly);
  });
  const isNeck = (f: Face) => neckSheet.some((poly) => inside(poly, centroidOf(f.poly)));

  // In half away from you, and turned on its side: the fold is the swan's back.
  F.step({ diagram: 6, label: 'Fold in half', duration: 0.9, ease: 'inOut', pose: { rz: 90, rx: -10, s: 1.5, tx: 0.62, ty: 0.2 } }, (s) => {
    s.fold([0, -1], [0, 1], { side: [0.5, 0.5], toward: -1 });
  });

  // Outside reverse fold: the neck turns out and up over the back, leaving a small triangle at its root.
  // Mirroring it across a crease at half the angle it turns through sends it from along the back to NECK_DIR.
  const front = (f: { sheet: P2 }) => f.sheet[0] < 0;
  const neckCrease = line([0, ROOT], (90 + NECK_DIR) / 2);
  /** The neck's own fold, along the back: it opens and closes about this as it turns inside out. */
  const neckAxis: [P2, P2] = [[0, ROOT], [0, 1]];
  let neck: Face[] = [];
  F.step({ diagram: 7, label: 'Pull the neck up', duration: 1.1, ease: 'inOut', pose: { s: 1.45, tx: 0.42, ty: -0.32 } }, (s) => {
    neck = s.reverse(s.select((f) => f.flat).filter(isNeck), neckCrease, { side: [0, 1], axis: neckAxis, front, kind: 'outside', roll: 'last', book: true });
  });

  // Inside reverse fold near the tip: the head turns forward, tucked between the neck's layers.
  F.step({ diagram: 8, label: 'Reverse fold the head', duration: 0.8, ease: 'inOut' }, (s) => {
    const tip = mirror([0, 1], neckCrease);
    const base = mirror(neckAxis[0], neckCrease);
    const len = Math.hypot(tip[0] - base[0], tip[1] - base[1]);
    const at: P2 = [tip[0] + ((base[0] - tip[0]) / len) * HEAD, tip[1] + ((base[1] - tip[1]) / len) * HEAD];
    s.reverse(neck, line(at, (NECK_DIR + HEAD_DIR) / 2), { side: tip, axis: [base, tip], front, kind: 'inside' });
  });

  F.step({ diagram: 8, label: 'Drift', duration: 2.4, ease: 'linear', path: drift });
  F.step({ diagram: 8, label: 'Glide away', duration: 1.1, phase: 'outro', ease: 'in', pose: { tx: 2.4, o: 0 } });
  return F.compile();
}

function centroidOf(poly: readonly P2[]): P2 {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  return [x / poly.length, y / poly.length];
}
