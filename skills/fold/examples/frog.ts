// Generated from src/models/frog.ts in origami-loaders by `npm run skill`. Do not edit here.
import { Folder, type Face, type Filter, type StepBuilder } from 'origami-loaders';
import { eases, type EaseName, type Pose } from 'origami-loaders';
import type { P2 } from 'origami-loaders';
import type { Vec3 } from 'origami-loaders';
import { angleAbout, dot, sub, turn, unit, v3 } from 'origami-loaders';

/**
 * The traditional jumping frog, folded as origami.me teaches it, from the
 * 1 : 2 rectangle their tip allows (half a square, starting at their step 3).
 *
 * The top square collapses into a waterbomb base and its front flaps fold up
 * as the front legs. The bottom folds up, the sides fold to the centre, then
 * the bottom is pushed up again and its side flaps squash out: folded down and
 * narrowed, they are the back legs. The bottom folds up and back down in half,
 * and that pleat is the spring. Turned over, it hops.
 *
 * Sheet coordinates: x ∈ [−0.5, 0.5], y ∈ [−1, 1], coloured side down, so the
 * colour comes out on the frog's back when it turns over at the end.
 */

const a = 0.5;
const O: P2 = [0, 0.5];            // centre of the top square: the top point of the waterbomb base
const A: P2 = [-a, 1], B: P2 = [a, 1], C: P2 = [a, 0], D: P2 = [-a, 0];
const E: P2 = [-a, 0.5], Fp: P2 = [a, 0.5];
const H: P2 = [0, 0];              // bottom of the head, where the legs all meet
/** How far the spring's folds open when the frog sits, and how much a hop squashes them (degrees). */
const SPRING = 55;
const SQUASH = 42;
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
/**
 * Each back leg's fold runs from H halfway between the flap's inner edge (straight down) and its
 * outer edge (45° out), so the inner edge lands on the outer one: 22.5° out from straight down.
 */
const BACK_LEG = (σ: number): P2 => [σ * Math.sin(Math.PI / 8), -Math.cos(Math.PI / 8)];
/** Where the spring's two folds are: the bottom folds up at the head, then down at half its height. */
const PLEAT = 0.125;

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

/**
 * The body below the head, once its bottom has folded up (so the two layers lie over each other)
 * and its sides have folded to the centre. The middle stays as the frog's back up top and rises
 * below; each side flap is three triangles about the point P halfway down its hinge.
 */
type Piece = 'back' | 'rise' | 'upper' | 'middle' | 'lower';
/** Where a body point lay once the bottom folded up: the bottom quarter mirrors onto the one above. */
const lifted = ([x, y]: P2): P2 => [x, y > -0.5 ? y : -1 - y];
function piece(p: P2): Piece {
  const [x, y] = lifted(p), ax = Math.abs(x);
  if (ax < 0.25) return y > -0.25 ? 'back' : 'rise';
  // Unfolded, a side flap is the square ax ∈ [0.25, 0.5], y ∈ [−0.5, 0]; its creases run from P to the outer corners.
  if (y > ax - 0.5) return 'upper';
  if (y < -ax) return 'lower';
  return 'middle';
}
const sideOf = (p: P2) => (p[0] < 0 ? -1 : 1);
const isBody: Filter = (f) => f.sheet[1] < 0;
/** Body faces in the named pieces, on side σ (0 for both sides). */
const inPiece = (σ: number, ...names: Piece[]): Filter => (f) =>
  isBody(f) && names.includes(piece(f.sheet)) && (σ === 0 || sideOf(f.sheet) === σ);

// The waterbomb collapse, worked out exactly so no crease stretches: as each lower side
// triangle turns in by θ about its diagonal, the top triangle comes down by
// γ = 2·atan(tan(θ/2)/√2), and the upper side triangle follows between them.
const θ = (d: number) => 180 * eases.inOut(d);
const γ = (d: number) => {
  const t = θ(d);
  return t >= 180 - 1e-9 ? 180 : (2 * Math.atan(Math.tan(((t / 2) * Math.PI) / 180) / Math.SQRT2) * 180) / Math.PI;
};
/** The upper side triangle's turn about the horizontal crease, relative to the lower one, on side σ. */
const upper = (σ: number) => (d: number) => {
  const corner = σ < 0 ? A : B, low = σ < 0 ? D : C, mid = σ < 0 ? E : Fp;
  const sign = σ < 0 ? -1 : 1;
  // Where the top triangle has brought the corner, seen from the lower side triangle (undo its turn).
  const target = turn(O, [O[0] + 1, O[1]], γ(d), v3(corner));
  const local = turn(O, low, -sign * θ(d), target);
  return angleAbout(O, mid, v3(corner), local);
};

/** The sign that turns `p` toward you (+z) about the crease a → b. */
const towardYou = (a: P2, b: P2, p: P2) => (turn(a, b, 10, v3(p))[2] > 0 ? 1 : -1);

/**
 * The squash, worked out exactly. The bottom of the middle rises about y = −0.25 and comes up in
 * front; each side flap's middle triangle turns over about its upper crease (P → H) onto the upper
 * triangle, which stays put; the lower triangle, hinged to the rising bottom, swings out between
 * them. Its two creases meet at 45°, so the middle triangle turns by whatever keeps that angle,
 * and the lower one by whatever keeps its far corner on the middle one's.
 */
function squash(σ: number) {
  const P: P2 = [σ * 0.25, -0.25], tip: P2 = [0, -0.5], hinge: P2 = [σ * 0.25, -0.5];
  const r0: P2 = [-1, -0.25], r1: P2 = [1, -0.25];
  const sR = towardYou(r0, r1, tip), sM = towardYou(P, H, tip);
  const rise = (u: number) => turn(r0, r1, sR * 180 * u, v3(hinge));
  const mid = (x: number) => turn(P, H, sM * x, v3(tip));
  const dir = (q: Vec3) => unit(sub(q, v3(P)));
  // The middle triangle's edge sweeps cos x·w + sin x·up; it must stay 45° from the rising hinge e:
  // (e·w) cos x + (e·up) sin x = cos 45°. Take the root that leads, so it is clear before the bottom arrives.
  const w = dir(v3(tip)), up = dir(mid(90));
  const β = (u: number) => {
    const e = dir(rise(u)), ew = dot(e, w), eu = dot(e, up);
    let φ = Math.atan2(eu, ew);
    if (φ < -Math.PI / 2) φ += 2 * Math.PI;   // runs 0 → 180°, and lands there exactly
    return ((φ + Math.acos(Math.min(1, Math.SQRT1_2 / Math.hypot(ew, eu)))) * 180) / Math.PI;
  };
  // The lower triangle's turn about its hinge, inside the rising bottom, so its far corner meets the middle one's.
  const n = 181, gs = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const u = i / (n - 1);
    const target = turn(r0, r1, -sR * 180 * u, mid(β(u)));
    let g = angleAbout(P, hinge, v3(tip), target);
    while (g - gs[i - 1] > 180) g -= 360;
    while (g - gs[i - 1] < -180) g += 360;
    gs[i] = g;
  }
  const g = (u: number) => {
    const x = Math.min(1, Math.max(0, u)) * (n - 1), i = Math.min(n - 2, Math.floor(x));
    return gs[i] + (gs[i + 1] - gs[i]) * (x - i);
  };
  const e = eases.inOut;
  return { rise: (d: number) => sR * 180 * e(d), mid: (d: number) => sM * β(e(d)), low: (d: number) => g(e(d)), P, hinge };
}

/** Hop: crouch on the spring, leap, land. */
const hop = (u: number): Partial<Pose> => {
  const crouch = u < 0.18 ? Math.sin((u / 0.18) * Math.PI) : 0;
  const air = u > 0.18 ? Math.min(1, (u - 0.18) / 0.62) : 0;
  const land = u > 0.8 ? Math.sin(((u - 0.8) / 0.2) * Math.PI) : 0;
  // Nose up as it leaves the ground: it faces left, so that is a turn clockwise on screen.
  return { ty: 0.5 * Math.sin(air * Math.PI) - 0.03 * crouch, spin: -12 * Math.sin(air * Math.PI), s: -0.05 * (crouch + land) };
};
const away = (u: number): Partial<Pose> => {
  const bounce = Math.abs(Math.sin(u * Math.PI * 2));
  return { ty: 0.45 * bounce, tx: -1.3 * u, o: -Math.max(0, (u - 0.35) / 0.65) };
};

export function buildFrog() {
  const F = new Folder({ rx: -28, s: 0.92, ty: 0.6, tz: 0.4, o: 0 }, [[-a, -1], [a, -1], [a, 1], [-a, 1]]);

  const precrease = (diagram: number, label: string, p: P2, q: P2, side: P2, toward: number) => {
    let moved: Face[] = [];
    F.step({ diagram, label, duration: 0.6 }, (s) => { moved = s.fold(p, q, { side, toward, at: [0, 1] }); });
    F.step({ diagram, label: 'Unfold', duration: 0.38, ease: 'inOut' }, (s) => { s.attach(moved, s.hinge(p, q, side, -toward, 180, { ease: 'inOut' })); });
  };

  F.step({ diagram: 3, label: 'Start with a 1 : 2 rectangle', duration: 0.7, phase: 'intro', ease: 'out', pose: { ty: 0, tz: 0, o: 1 }, arc: { rz: -4 } });
  precrease(4, 'Fold the corner to the far edge', B, D, A, 1);
  precrease(5, 'And the other corner', A, C, B, 1);
  precrease(7, 'Fold the top behind', E, Fp, [0, 0.9], -1);

  // The waterbomb base: the sides fold in on the diagonals and the top comes down in front.
  F.step({ diagram: 9, label: 'Collapse into a waterbomb base', duration: 1.3, ease: 'inOut', pose: { s: 1.15, ty: -0.25 } }, (s) => {
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

  // Front legs: each front flap's corner folds up in one fold, on a line from the bottom of the
  // head, so the leg points forward and a little out, as long as the head is tall.
  let legs: Face[] = [];
  F.step({ diagram: 10, label: 'Fold the front legs up', duration: 1.0, pose: { s: 1.25 } }, (s) => {
    legs = [
      ...s.fold(H, LEG(-1), { where: inSector('top', 'upL'), side: D, toward: 1, at: [0, 0.7] }),
      ...s.fold(H, LEG(1), { where: inSector('top', 'upR'), side: C, toward: 1, at: [0.3, 1] }),
    ];
  });

  F.step({ diagram: 12, label: 'Fold the bottom up', duration: 0.8 }, (s) => {
    s.fold([-1, -0.5], [1, -0.5], { where: isBody, side: [0, -1], toward: 1 });
  });

  // Sides to the centre, through both layers of the body. At the top the fold carries on through
  // the back layers of the head (the same paper), and tucks under the front legs.
  F.step({ diagram: 13, label: 'Fold the sides to the centre', duration: 0.9, pose: { s: 1.3, ty: 0.05 } }, (s) => {
    const left = s.fold([-0.25, -1], [-0.25, 1], { where: inSector('body', 'bottom', 'lowL'), side: [-0.5, -0.5], toward: 1, at: [0, 0.7] });
    const right = s.fold([0.25, -1], [0.25, 1], { where: inSector('body', 'bottom', 'lowR'), side: [0.5, -0.5], toward: 1, at: [0.3, 1] });
    const live = new Set(s.select());
    s.layer(legs.filter((f) => live.has(f)), [...left, ...right]);
  });

  // The squash: push the bottom up to the head and the side flaps swing out on each side.
  F.step({ diagram: 17, label: 'Squash the bottom flaps out', duration: 1.5, ease: 'inOut', pose: { s: 1.4, ty: 0.15 } }, (s) => {
    s.split(s.select(inPiece(0, 'back', 'rise')), [-1, -0.25], [1, -0.25]);
    for (const σ of [-1, 1]) {
      const flap = inPiece(σ, 'upper', 'middle', 'lower');
      s.split(s.select(flap), [σ * 0.25, -0.25], H);
      s.split(s.select(flap), [σ * 0.25, -0.25], [0, -0.5]);
    }
    const q = (σ: number, ...n: Piece[]) => s.select(inPiece(σ, ...n));
    const [L, R] = [squash(-1), squash(1)];
    const rise = s.rot([-1, -0.25], [1, -0.25], L.rise);
    s.attach(q(0, 'rise'), rise);
    for (const [σ, k] of [[-1, L], [1, R]] as const) {
      s.attach(q(σ, 'middle'), s.rot(k.P, H, k.mid));
      s.attach(q(σ, 'lower'), s.rot(k.P, k.hinge, k.low), rise);
    }
    // The bottom comes up in front, with the lower triangles out at its sides as one sheet;
    // the middle triangles lie folded in under it, over the upper ones.
    s.layer([...q(0, 'rise'), ...q(0, 'lower')], q(0, 'middle'));
    s.layer(q(0, 'middle'), [...q(0, 'upper'), ...q(0, 'back')]);
    s.layer(q(0, 'rise'), [...q(0, 'upper'), ...q(0, 'back')]);
  });

  // Each side folds down along its crease from P to the head: the flap that swung out, the middle
  // triangle under it, and that side of the bottom.
  /** Where a piece of the risen bottom lies after the squash: mirrored up across y = −0.25. */
  const risenOn = (σ: number): Filter => (f) => {
    const [x, y] = lifted(f.sheet);
    return -0.5 - y > -σ * x;
  };
  const flaps = (σ: number): Filter => (f) => inPiece(σ, 'middle', 'lower')(f) || (inPiece(0, 'rise')(f) && risenOn(σ)(f));
  F.step({ diagram: 18, label: 'Fold the flaps down', duration: 0.9 }, (s) => {
    for (const σ of [-1, 1]) s.split(s.select(inPiece(0, 'rise')), [σ * 0.25, -0.25], H);
    s.fold([-0.25, -0.25], H, { where: flaps(-1), side: [-0.4, -0.05], toward: 1, at: [0, 0.7] });
    s.fold([0.25, -0.25], H, { where: flaps(1), side: [0.4, -0.05], toward: 1, at: [0.3, 1] });
  });

  // Back legs: each flap's inner edge folds out onto its outer edge.
  F.step({ diagram: 19, label: 'Fold the back legs out', duration: 0.9 }, (s) => {
    s.fold(H, BACK_LEG(-1), { where: flaps(-1), side: [-0.02, -0.45], toward: 1, at: [0, 0.7] });
    s.fold(H, BACK_LEG(1), { where: flaps(1), side: [0.02, -0.45], toward: 1, at: [0.3, 1] });
  });

  // The spring: everything below the head folds up, then back down in half.
  F.step({ diagram: 20, label: 'Fold the back legs up', duration: 0.8, pose: { s: 1.7, ty: -0.15 } }, (s) => {
    // Behind the legs the body runs on into the head's back layers: part them along the fold first.
    s.split(s.select(), [-1, 0], [1, 0]);
    s.fold([-1, 0], [1, 0], { where: isBody, side: [0, -0.2], toward: 1 });
  });
  let pleat: Face[] = [];
  F.step({ diagram: 21, label: 'Fold them back down in half', duration: 0.8 }, (s) => {
    pleat = s.fold([-1, PLEAT], [1, PLEAT], { where: isBody, side: [0, 0.3], toward: 1 });
  });

  // The pleat is a spring. Let go, its two folds open a little into a Z and the frog sits up on it;
  // press its back and the spring flattens, then throws it into the air.
  /** Open the spring's two folds by `deg` more, from `open` degrees already open. */
  const spring = (s: StepBuilder, deg: number, open: number, o: { ease?: EaseName; at?: [number, number] } = {}) => {
    const top = new Set(pleat);
    const body = s.select(isBody);
    // The second fold rides up with the first: find where it is now.
    const r = (open * Math.PI) / 180;
    const y = PLEAT * Math.cos(r), z = PLEAT * Math.sin(r);
    const h1 = s.rot([-1, 0, 0], [1, 0, 0], deg, o);
    const h2 = s.rot([-1, y, z], [1, y, z], -deg, o);
    s.attach(body.filter((f) => !top.has(f)), h1);
    s.attach(body.filter((f) => top.has(f)), h2, h1);
  };
  F.step({ diagram: 22, label: 'Turn over', duration: 1.0, ease: 'inOut', pose: { ry: 180, rx: -70, rz: -35, s: 2.1, ty: 0.25 }, arc: { tz: 0.3 } }, (s) => {
    spring(s, SPRING, 0, { ease: 'inOut', at: [0.4, 1] });
  });
  F.step({ diagram: 22, label: 'Hop', duration: 1.0, ease: 'linear', path: hop }, (s) => spring(s, -SQUASH, SPRING, { ease: 'breathe', at: [0, 0.36] }));
  F.step({ diagram: 22, label: 'Hop again', duration: 1.0, ease: 'linear', path: hop }, (s) => spring(s, -SQUASH, SPRING, { ease: 'breathe', at: [0, 0.36] }));
  F.step({ diagram: 22, label: 'Hop away', duration: 1.2, phase: 'outro', ease: 'linear', path: away });
  return F.compile({ colourDown: true });
}
