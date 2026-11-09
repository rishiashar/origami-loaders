import { Folder, type Face, type Filter, type StepBuilder } from '../fold';
import { eases, type EaseName, type Pose } from '../motion';
import { apply, rotation, type Vec3 } from '../math';
import type { P2 } from '../geom';

/**
 * The traditional jumping frog, from a 1 : 2 rectangle.
 *
 * The top square is creased with an X and a horizontal line and collapsed into
 * a waterbomb base. Its front corners fold up to the top point for the front
 * legs; the sides of the rest fold to the centre, the bottom folds up, and back
 * down again in half: that pleat is the spring. Turned over, it hops.
 *
 * Sheet coordinates: x ∈ [−0.5, 0.5], y ∈ [−1, 1], coloured side down, so the
 * colour comes out on the frog's back when it turns over at the end.
 */

const a = 0.5;
const O: P2 = [0, 0.5];            // centre of the top square: the top point of the waterbomb base
const A: P2 = [-a, 1], B: P2 = [a, 1], C: P2 = [a, 0], D: P2 = [-a, 0];
const E: P2 = [-a, 0.5], Fp: P2 = [a, 0.5];
const H: P2 = [0, 0];
/** How far the spring's folds open when the frog sits, and how much a hop squashes them (degrees). */
const SPRING = 35;
const SQUASH = 28;
/** Which way each front leg points once folded: forward (+y), 25° out to its side. */
const LEG_OUT = 25;
/**
 * The leg's fold runs from the bottom of the head, H, at half the angle between where the corner
 * is (180° on the left) and where it should point (90° + LEG_OUT): 147.5°, mirrored on the right.
 */
const LEG = (σ: number): P2 => {
  const a = (((180 + 90 + LEG_OUT) / 2) * Math.PI) / 180;
  return [-σ * Math.cos(a), Math.sin(a)];
};

/** Which part of the top square a sheet point is in: the four triangles of the X, the sides split by the horizontal. */
type Sector = 'top' | 'bottom' | 'upL' | 'lowL' | 'upR' | 'lowR' | 'body';
function sector([x, y]: P2): Sector {
  if (y < 0) return 'body';
  const u = x - O[0], v = y - O[1];
  if (v > Math.abs(u)) return 'top';
  if (v < -Math.abs(u)) return 'bottom';
  if (u < 0) return v > 0 ? 'upL' : 'lowL';
  return v > 0 ? 'upR' : 'lowR';
}
const inSector = (...names: Sector[]): Filter => (f) => names.includes(sector(f.sheet));

// The waterbomb collapse, worked out exactly so no crease stretches: as each lower side
// triangle turns in by θ about its diagonal, the top triangle comes down by
// γ = 2·atan(tan(θ/2)/√2), and the upper side triangle follows between them.
const θ = (d: number) => 180 * eases.inOut(d);
const γ = (d: number) => {
  const t = θ(d);
  return t >= 180 - 1e-9 ? 180 : (2 * Math.atan(Math.tan(((t / 2) * Math.PI) / 180) / Math.SQRT2) * 180) / Math.PI;
};
const v3 = (p: P2): Vec3 => [p[0], p[1], 0];
const sub = (p: Vec3, q: Vec3): Vec3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot = (p: Vec3, q: Vec3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const cross = (p: Vec3, q: Vec3): Vec3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
const unit = (p: Vec3): Vec3 => { const n = Math.hypot(p[0], p[1], p[2]); return [p[0] / n, p[1] / n, p[2] / n]; };
const turnTo = (axisFrom: P2, axisTo: P2, deg: number, p: Vec3): Vec3 => {
  const u = unit(sub(v3(axisTo), v3(axisFrom)));
  const R = rotation(v3(axisFrom), u, (deg * Math.PI) / 180);
  return apply(R, p[0], p[1], p[2]);
};
/** Degrees to turn `from` about the axis o→e (right-handed) so it lands on `to`. */
function angleAbout(o: P2, e: P2, from: Vec3, to: Vec3): number {
  const u = unit(sub(v3(e), v3(o)));
  const flat = (p: Vec3) => { const r = sub(p, v3(o)); const k = dot(r, u); return sub(r, [u[0] * k, u[1] * k, u[2] * k]); };
  const r0 = flat(from), t = flat(to);
  return (Math.atan2(dot(u, cross(r0, t)), dot(r0, t)) * 180) / Math.PI;
}
/** The upper side triangle's turn about the horizontal crease, relative to the lower one, on side σ. */
const upper = (σ: number) => (d: number) => {
  const corner = σ < 0 ? A : B, low = σ < 0 ? D : C, mid = σ < 0 ? E : Fp;
  const sign = σ < 0 ? -1 : 1;
  // Where the top triangle has brought the corner, seen from the lower side triangle (undo its turn).
  const target = turnTo(O, [O[0] + 1, O[1]], γ(d), v3(corner));
  const local = turnTo(O, low, -sign * θ(d), target);
  return angleAbout(O, mid, v3(corner), local);
};

/** Hop: crouch on the spring, leap, land. */
const hop = (u: number): Partial<Pose> => {
  const crouch = u < 0.18 ? Math.sin((u / 0.18) * Math.PI) : 0;
  const air = u > 0.18 ? Math.min(1, (u - 0.18) / 0.62) : 0;
  const land = u > 0.8 ? Math.sin(((u - 0.8) / 0.2) * Math.PI) : 0;
  return { ty: 0.5 * Math.sin(air * Math.PI) - 0.03 * crouch, rx: -14 * Math.sin(air * Math.PI), s: -0.05 * (crouch + land) };
};
const away = (u: number): Partial<Pose> => {
  const bounce = Math.abs(Math.sin(u * Math.PI * 2));
  return { ty: 0.45 * bounce, tz: 0.9 * u, o: -Math.max(0, (u - 0.35) / 0.65) };
};

export function buildFrog() {
  const F = new Folder({ rx: -28, s: 0.92, ty: 0.6, tz: 0.4, o: 0 }, [[-a, -1], [a, -1], [a, 1], [-a, 1]]);

  const precrease = (diagram: number, label: string, p: P2, q: P2, side: P2, toward: number) => {
    let moved: Face[] = [];
    F.step({ diagram, label, duration: 0.6 }, (s) => { moved = s.fold(p, q, { side, toward, at: [0, 1] }); });
    F.step({ diagram, label: 'Unfold', duration: 0.38, ease: 'inOut' }, (s) => { s.attach(moved, s.hinge(p, q, side, -toward, 180, { ease: 'inOut' })); });
  };

  F.step({ diagram: 1, label: 'Start with a 1 : 2 rectangle', duration: 0.7, phase: 'intro', ease: 'out', pose: { ty: 0, tz: 0, o: 1 }, arc: { rz: -4 } });
  precrease(2, 'Fold the corner to the far edge', B, D, A, 1);
  precrease(2, 'And the other corner', A, C, B, 1);
  precrease(3, 'Fold the top behind', E, Fp, [0, 0.9], -1);

  // The waterbomb base: the sides fold in on the diagonals and the top comes down in front.
  F.step({ diagram: 4, label: 'Collapse into a waterbomb base', duration: 1.3, ease: 'inOut', pose: { s: 1.15, ty: -0.25 } }, (s) => {
    const lowL = s.rot(O, D, (d) => -θ(d));
    const lowR = s.rot(O, C, (d) => θ(d));
    const top = s.rot(O, [O[0] + 1, O[1]], γ);
    const upL = s.rot(O, E, upper(-1));
    const upR = s.rot(O, Fp, upper(1));
    const q = (n: Sector) => s.select(inSector(n));
    s.attach(q('lowL'), lowL);
    s.attach(q('upL'), upL, lowL);
    s.attach(q('lowR'), lowR);
    s.attach(q('upR'), upR, lowR);
    s.attach(q('top'), top);
    s.layer(q('top'), [...q('upL'), ...q('upR')]);
    s.layer([...q('upL'), ...q('upR')], [...q('lowL'), ...q('lowR')]);
    s.layer([...q('lowL'), ...q('lowR')], q('bottom'));
  });

  // Front legs, as on origami.me: each front flap's corner folds up in one fold, on a line from the
  // bottom of the head, so the leg points forward and a little out, as long as the head is tall.
  let legs: Face[] = [];
  F.step({ diagram: 5, label: 'Fold the front legs up', duration: 1.0, pose: { s: 1.25 } }, (s) => {
    legs = [
      ...s.fold(H, LEG(-1), { where: inSector('top', 'upL'), side: D, toward: 1, at: [0, 0.7] }),
      ...s.fold(H, LEG(1), { where: inSector('top', 'upR'), side: C, toward: 1, at: [0.3, 1] }),
    ];
  });

  // The body: sides to the centre. At the top the fold carries on through the back layers of the
  // head (the same paper), and tucks under the front legs.
  F.step({ diagram: 7, label: 'Fold the sides to the centre', duration: 0.9, pose: { s: 1.3, ty: 0.05 } }, (s) => {
    const left = s.fold([-0.25, -1], [-0.25, 1], { where: inSector('body', 'bottom', 'lowL'), side: [-0.5, -0.5], toward: 1, at: [0, 0.7] });
    const right = s.fold([0.25, -1], [0.25, 1], { where: inSector('body', 'bottom', 'lowR'), side: [0.5, -0.5], toward: 1, at: [0.3, 1] });
    const live = new Set(s.select());
    s.layer(legs.filter((f) => live.has(f)), [...left, ...right]);
  });

  // The spring: the bottom up to the head, then back down in half.
  F.step({ diagram: 8, label: 'Fold the bottom up', duration: 0.8 }, (s) => {
    s.fold([-1, -0.5], [1, -0.5], { where: inSector('body'), side: [0, -1], toward: 1 });
  });
  F.step({ diagram: 9, label: 'Fold it back down in half', duration: 0.8 }, (s) => {
    s.fold([-1, -0.25], [1, -0.25], { where: (f) => sector(f.sheet) === 'body' && f.sheet[1] < -0.5, side: [0, 0], toward: 1 });
  });

  // The pleat is a spring. Let go, its two folds open a little into a Z and the frog sits up on it;
  // press its back and the spring flattens, then throws it into the air.
  /** Open the spring's two folds by `deg` more, from `open` degrees already open. */
  const spring = (s: StepBuilder, deg: number, open: number, o: { ease?: EaseName; at?: [number, number] } = {}) => {
    const low = s.select((f) => sector(f.sheet) === 'body' && f.sheet[1] < -0.5 && f.sheet[1] > -0.75);
    const up = s.select((f) => sector(f.sheet) === 'body' && f.sheet[1] < -0.75);
    // The second fold rides up with the first: find where it is now.
    const r = (open * Math.PI) / 180;
    const y = -0.5 + 0.25 * Math.cos(r), z = 0.25 * Math.sin(r);
    const h1 = s.rot([-1, -0.5, 0], [1, -0.5, 0], deg, o);
    const h2 = s.rot([-1, y, z], [1, y, z], -deg, o);
    s.attach(low, h1);
    s.attach(up, h2, h1);
  };
  F.step({ diagram: 10, label: 'Turn over', duration: 1.0, ease: 'inOut', pose: { ry: 200, rx: -62, rz: 10, s: 1.35, ty: 0.05 }, arc: { tz: 0.3 } }, (s) => {
    spring(s, SPRING, 0, { ease: 'inOut', at: [0.4, 1] });
  });
  F.step({ diagram: 10, label: 'Hop', duration: 1.0, ease: 'linear', path: hop }, (s) => spring(s, -SQUASH, SPRING, { ease: 'breathe', at: [0, 0.36] }));
  F.step({ diagram: 10, label: 'Hop again', duration: 1.0, ease: 'linear', path: hop }, (s) => spring(s, -SQUASH, SPRING, { ease: 'breathe', at: [0, 0.36] }));
  F.step({ diagram: 10, label: 'Hop away', duration: 1.2, phase: 'outro', ease: 'linear', path: away });
  return F.compile({ colourDown: true });
}
