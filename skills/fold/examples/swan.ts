// Generated from src/models/swan.ts in origami-loaders by `npm run skill`. Do not edit here.
import { Folder, type Face, type Filter, type StepBuilder } from 'origami-loaders';
import { eases, type Pose } from 'origami-loaders';
import { side, type P2 } from 'origami-loaders';
import { angleAbout, cross, turn, unit, v3 } from 'origami-loaders';

/**
 * The traditional swan, folded as origami.me teaches it: a kite, turned over
 * and narrowed into a second kite; the narrow point folds up to the top for the
 * neck and its tip folds back for the head; the model folds in half; then the
 * neck is pulled up and flattened, and the head the same. It drifts on the
 * water, then glides away.
 *
 * Sheet coordinates: the diamond with corners (0, ±1) and (±1, 0), coloured side
 * down. The bottom point becomes the neck, the top point the tail.
 *
 * Once folded in half the fold is the swan's back: the line x = 0, with the body
 * hanging below it on the −x side, the neck's root at y = 0 (the front) and the
 * tail at y = 1. The open edges, and the white inside, end up at the waterline.
 * Directions in that plane are degrees from +x (up), turning toward +y (the tail).
 */

const B: P2 = [0, -1];
/** A point `r` from the bottom point, `deg` off the centre line, on side σ. */
const along = (deg: number, σ: number, r = 3): P2 => {
  const a = (deg * Math.PI) / 180;
  return [σ * r * Math.sin(a), -1 + r * Math.cos(a)];
};
const rad = (deg: number) => (deg * Math.PI) / 180;
const dir = (deg: number): P2 => [Math.cos(rad(deg)), Math.sin(rad(deg))];
const from = (p: P2, deg: number, r = 1): P2 => [p[0] + r * Math.cos(rad(deg)), p[1] + r * Math.sin(rad(deg))];
/** Which way the neck ends up pointing: up, leaning back a little more than the tilt, so it stands almost upright. */
const NECK_DIR = 15;
/** Which way the head points: forward (−y), raised by about the tilt so it ends up level. */
const HEAD_DIR = 278;
/** The swan tips back by the angle of its open edges (the second kite fold), so they sit level on the water. */
const TILT = 11.25;
/** How much of the neck's tip folds back for the head: origami.me's fold is a little over a quarter of the way down. */
const HEAD = 0.29;

function inside(poly: readonly P2[], p: P2): boolean {
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
/** Everything a fold moved, wherever later folds cut it: a filter on where faces came from on the sheet. */
const within = (faces: readonly Face[]): Filter => {
  const polys = faces.map((f) => f.poly);
  return (f) => polys.some((poly) => inside(poly, f.sheet));
};

/**
 * Pull a point up, as paper does it. The point lies folded back along the model, which is folded
 * in half around it; pulling it up swings the crease at its base round about the spine. The old
 * crease opens flat, a new one forms at half the angle the point turns through, and the wedge of
 * paper between the two folds over with it.
 *
 * Worked out exactly, so no crease opens on the way: on each side the wedge turns over about the
 * new crease, and the point unfolds about the old one by whatever keeps its spine in the plane
 * between the two sides. The spine is square to the old crease, so it lies along ẑ × that crease
 * wherever the wedge has carried it.
 *
 * @param o.pivot Where the old crease meets the spine.
 * @param o.crease Direction of the old crease from the pivot, across the paper (degrees).
 * @param o.turn  Which way the point lies now, and which way it should end up (degrees).
 * @param o.base  The layers the point is folded back over; the wedge is cut from them.
 * @param o.point The layers of the point itself.
 * @param o.front Which faces are on the half of the model nearer you.
 */
function pull(s: StepBuilder, o: { pivot: P2; crease: number; turn: [number, number]; base: Face[]; point: Face[]; front: Filter }) {
  const Q = o.pivot, old = from(Q, o.crease);
  let θ = o.turn[1] - o.turn[0];
  θ = ((((θ + 180) % 360) + 360) % 360) - 180;
  const fresh = from(Q, o.crease + θ / 2);
  const sgn = Math.sign(side(Q, fresh, old));
  const wedge = s.split(o.base, Q, fresh).filter((f) => Math.sign(side(Q, fresh, s.info(f).model)) === sgn);

  // Toward you (+z) for the near side; the far side mirrors it.
  const up = turn(Q, fresh, 10, v3(old))[2] > 0 ? 1 : -1;
  const lie = v3(dir(o.turn[0]));
  // Of the two directions square to the carried crease, follow the one the spine starts along.
  const n = 181, bs = new Float64Array(n);
  let spine = lie;
  for (let i = 1; i < n; i++) {
    const a = (180 * i) / (n - 1);
    const c = turn(Q, fresh, up * a, v3(old));
    let v = unit(cross([0, 0, 1], [c[0] - Q[0], c[1] - Q[1], c[2]]));
    if (v[0] * spine[0] + v[1] * spine[1] + v[2] * spine[2] < 0) v = [-v[0], -v[1], -v[2]];
    spine = v;
    // Seen from the wedge (undo its turn), how far the point has opened about the old crease.
    const target = turn(Q, fresh, -up * a, [Q[0] + v[0], Q[1] + v[1], v[2]]);
    let b = angleAbout(Q, old, [Q[0] + lie[0], Q[1] + lie[1], 0], target);
    while (b - bs[i - 1] > 180) b -= 360;
    while (b - bs[i - 1] < -180) b += 360;
    bs[i] = b;
  }
  const open = (u: number) => {
    const x = Math.min(1, Math.max(0, u)) * (n - 1), i = Math.min(n - 2, Math.floor(x));
    return bs[i] + (bs[i + 1] - bs[i]) * (x - i);
  };
  const e = eases.inOut;
  const isFront = (f: Face) => o.front(s.info(f));
  const moved: Face[] = [];
  for (const σ of [1, -1]) {
    const mine = (f: Face) => isFront(f) === σ > 0;
    const over = s.rot(Q, fresh, (d) => σ * up * 180 * e(d));
    const out = s.rot(Q, old, (d) => σ * open(e(d)));
    s.attach(wedge.filter(mine), over);
    s.attach(o.point.filter(mine), out, over);
    moved.push(...wedge.filter(mine), ...o.point.filter(mine));
  }
  // The pulled paper stays wrapped round the outside: nearest you on the near side, furthest on the far side.
  const set = new Set(moved);
  const rest = s.select().filter((f) => !set.has(f));
  const near = moved.filter(isFront), far = moved.filter((f) => !isFront(f));
  s.layer(near, rest);
  s.layer(rest, far);
  s.layer(near, far);
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

  // The neck is everything this fold lifts, and the head everything the next one does.
  let inNeck: Filter = () => false, inHead: Filter = () => false;
  F.step({ diagram: 5, label: 'Fold the point up to the top', duration: 0.8, pose: { s: 1.25, ty: -0.3 } }, (s) => {
    inNeck = within(s.fold([-1, 0], [1, 0], { side: B, toward: 1 }));
  });
  F.step({ diagram: 7, label: 'Fold the tip back for the head', duration: 0.7 }, (s) => {
    inHead = within(s.fold([-1, 1 - HEAD], [1, 1 - HEAD], { where: inNeck, side: [0, 1], toward: 1 }));
  });

  // In half away from you, and turned on its side: the fold is the swan's back.
  F.step({ diagram: 8, label: 'Fold in half', duration: 0.9, ease: 'inOut', pose: { rz: 90, rx: -10, s: 1.5, tx: 0.62, ty: 0.2 } }, (s) => {
    s.fold([0, -1], [0, 1], { side: [0.5, 0.5], toward: -1 });
  });

  const front: Filter = (f) => f.sheet[0] < 0;
  const flat = (s: StepBuilder, where: Filter) => s.select((f) => f.flat && where(f));
  // The neck lies along the back, pointing to the tail. Pulled up, its base crease swings round from the
  // front edge into the body, and the front of the body folds over with it as the swan's chest.
  // As on origami.me's diagram the swan sits on its open edges, so it tips back until they are level: the tail rises.
  F.step({ diagram: 9, label: 'Pull the neck up', duration: 1.2, ease: 'inOut', pose: { rz: 90 - TILT, s: 1.6, tx: 0.55, ty: -0.18 } }, (s) => {
    pull(s, { pivot: [0, 0], crease: 180, turn: [90, NECK_DIR], base: flat(s, (f) => !inNeck(f)), point: flat(s, inNeck), front });
  });

  // The head lies back down the neck. The same pull, at the top of the neck, brings it forward.
  F.step({ diagram: 10, label: 'Pull the head up', duration: 0.9, ease: 'inOut' }, (s) => {
    pull(s, {
      pivot: from([0, 0], NECK_DIR, 1 - HEAD), crease: NECK_DIR + 90, turn: [NECK_DIR + 180, HEAD_DIR],
      base: flat(s, (f) => inNeck(f) && !inHead(f)), point: flat(s, inHead), front,
    });
  });

  F.step({ diagram: 10, label: 'Drift', duration: 2.4, ease: 'linear', path: drift });
  F.step({ diagram: 10, label: 'Glide away', duration: 1.1, phase: 'outro', ease: 'in', pose: { tx: 2.4, o: 0 } });
  return F.compile();
}
