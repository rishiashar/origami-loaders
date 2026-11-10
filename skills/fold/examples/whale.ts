// Generated from src/models/whale.ts in origami-loaders by `npm run skill`. Do not edit here.
import { Folder, type Face, type Filter } from 'origami-loaders';
import { eases, type Pose } from 'origami-loaders';
import { side, type P2 } from 'origami-loaders';
import { track, turn, v3 } from 'origami-loaders';

/**
 * The traditional whale, folded as origami.me teaches it: crease both kite
 * pairs, collapse into a fish base (each side corner becomes a rabbit ear that
 * lies down along the centre), fold the tip back for the head, turn over, fold
 * the side corners in, fold in half, fold the ears down as flippers, and
 * mountain fold the tail up. It swims with a flick of the tail, then dives.
 *
 * Sheet coordinates: the diamond with corners (0, ±1) and (±1, 0), white side
 * toward you (seen from −z), so folds toward you go to −z until it turns over.
 * The top corner becomes the head, the bottom corner the tail.
 */

const t = Math.SQRT2 - 1;                    // tan 22.5°: where the kite creases meet the horizontal diagonal
const T: P2 = [0, 1], Bt: P2 = [0, -1], O: P2 = [0, 0];
/** The centre of the rabbit ear on side σ: both kite creases on that side meet here. */
const V = (σ: number): P2 => [σ * t, 0];
const corner = (σ: number): P2 => [σ, 0];
/** Where each ear's base crease meets the sheet's edge, above and below the diagonal. */
const QU = (σ: number): P2 => [σ * Math.SQRT1_2, 1 - Math.SQRT1_2];
const QL = (σ: number): P2 => [σ * Math.SQRT1_2, Math.SQRT1_2 - 1];

/** How far in the side corners fold (step 7), where the head folds back, and where the tail's crease starts. */
const CORNER_IN = 0.3;
const HEAD = (1 + t) / 2;
const TAIL_AT = -0.7;
/** Which way the folded tail points: up over the back (+x), leaning back a little (degrees, model space). */
const TAIL_DIR = 350;
/** How far the tail's fold opens in a flick (degrees). */
const FLICK = 28;

type Region = 'centre' | 'upMain' | 'upEar' | 'lowEar' | 'lowMain';
/** Which part of the fish base a sheet point belongs to. */
function region([x, y]: P2): Region {
  if (Math.abs(x) / t + Math.abs(y) < 1) return 'centre';
  const σ = x < 0 ? -1 : 1;
  const up = y > 0;
  const v = V(σ), q = up ? QU(σ) : QL(σ);
  const ear = Math.sign(side(v, q, [x, y])) === Math.sign(side(v, q, corner(σ)));
  return ear ? (up ? 'upEar' : 'lowEar') : (up ? 'upMain' : 'lowMain');
}
const inRegion = (...names: Region[]): Filter => (f) => names.includes(region(f.sheet));
const isEar = inRegion('upEar', 'lowEar');

/** The sign that turns `p` toward you (−z) about the crease a → b. */
const towardYou = (a: P2, b: P2, p: P2) => (turn(a, b, 10, v3(p))[2] < 0 ? 1 : -1);

// The rabbit ear, worked out exactly. Each kite flap turns in by θ about its crease; the ear's two
// halves turn about their base creases by whatever keeps the ear's spine (the horizontal diagonal)
// in the plane between them, so the two halves meet back to back and stand up together.
const θ = (d: number) => 180 * eases.inOut(d);
function earAngle(σ: number, up: boolean) {
  const kite = up ? T : Bt, q = up ? QU(σ) : QL(σ);
  const s = towardYou(V(σ), kite, corner(σ));
  const spine = (u: number, φ: number) => turn(V(σ), kite, s * 180 * u, turn(V(σ), q, φ, v3(corner(σ))));
  const φ = track((u, x) => spine(u, x)[1], 0, { ok: (u, x) => spine(u, x)[2] <= 1e-9 });
  return { kite: (d: number) => s * θ(d), ear: (d: number) => φ(θ(d) / 180) };
}

const swim = (u: number): Partial<Pose> => ({
  ty: 0.04 * Math.sin(u * Math.PI * 2),
  rz: 2.5 * Math.sin(u * Math.PI * 2 - 0.6),
});

export function buildWhale() {
  const F = new Folder({ rx: -20, ry: 180, ty: 0.6, tz: 0.4, o: 0 }, [[0, -1], [1, 0], [0, 1], [-1, 0]]);

  F.step({ diagram: 1, label: 'Start with a square', duration: 0.7, phase: 'intro', ease: 'out', pose: { ty: 0, tz: 0, o: 1 }, arc: { rz: -4 } });

  /** Crease a kite pair: fold both edges to the centre line, then unfold. */
  const kites = (diagram: number, label: string, tip: P2) => {
    let moved: Face[][] = [];
    F.step({ diagram, label, duration: 0.8 }, (s) => {
      moved = [-1, 1].map((σ) => s.fold(tip, V(σ), { side: corner(σ), toward: -1, at: σ < 0 ? [0, 0.7] : [0.3, 1] }));
    });
    F.step({ diagram, label: 'Unfold', duration: 0.45, ease: 'inOut' }, (s) => {
      [-1, 1].forEach((σ, i) => s.attach(moved[i], s.hinge(tip, V(σ), corner(σ), 1, 180, { ease: 'inOut' })));
    });
  };
  kites(2, 'Fold the bottom edges to the centre', Bt);
  kites(3, 'Fold the top edges to the centre', T);

  // The fish base: all four edges come in at once and each side corner rises as a rabbit ear...
  F.step({ diagram: 4, label: 'Collapse into a fish base', duration: 1.4, ease: 'inOut', pose: { s: 1.1 } }, (s) => {
    for (const σ of [-1, 1]) {
      const outside = (f: Face) => region(s.info(f).sheet) !== 'centre' && σ * s.info(f).sheet[0] > 0;
      s.split(s.select().filter(outside), [-1, 0], [1, 0]);
      s.split(s.select(inRegion('upMain', 'upEar')).filter(outside), V(σ), QU(σ));
      s.split(s.select(inRegion('lowMain', 'lowEar')).filter(outside), V(σ), QL(σ));
      for (const up of [true, false]) {
        const kite = up ? T : Bt, q = up ? QU(σ) : QL(σ);
        const a = earAngle(σ, up);
        const main = s.rot(V(σ), kite, a.kite);
        const ear = s.rot(V(σ), q, a.ear);
        const mine = (n: Region) => s.select(inRegion(n)).filter((f) => σ * s.info(f).sheet[0] > 0);
        s.attach(mine(up ? 'upMain' : 'lowMain'), main);
        s.attach(mine(up ? 'upEar' : 'lowEar'), ear, main);
      }
    }
  });
  // ...then the ears lie down along the centre, pointing to the tail.
  F.step({ diagram: 4, label: 'Flatten the ears down', duration: 0.8, ease: 'inOut' }, (s) => {
    for (const σ of [-1, 1]) {
      const tip = turn(V(σ), O, 90, [0, 0, -t]);
      const deg = tip[1] < 0 ? 90 : -90;
      s.attach(s.select(isEar).filter((f) => σ * s.info(f).sheet[0] > 0), s.rot(v3(V(σ)), v3(O), deg, { ease: 'inOut' }));
    }
    // Standing, the ear's halves are back to back in one plane; lying down toward the tail, the upper
    // half ends on top, nearer you (−z), and the lower half under it.
    s.layer(s.select(inRegion('lowEar')), s.select(inRegion('upEar')));
  });

  F.step({ diagram: 5, label: 'Fold the tip back', duration: 0.7 }, (s) => {
    s.fold([-1, HEAD], [1, HEAD], { side: T, toward: 1 });
  });
  F.step({ diagram: 5, label: 'Turn over', duration: 0.8, ease: 'inOut', pose: { ry: 360 }, arc: { tz: 0.3 } });

  // Facing you now: folds toward you go to +z.
  F.step({ diagram: 6, label: 'Fold the corners in', duration: 0.7, pose: { s: 1.15 } }, (s) => {
    for (const σ of [-1, 1]) s.fold([σ * CORNER_IN, -1], [σ * CORNER_IN, 1], { side: corner(σ), toward: 1, at: σ < 0 ? [0, 0.7] : [0.3, 1] });
  });

  // In half, the right half over the left, and on its side: the fold is the whale's back, the head on the left.
  F.step({ diagram: 7, label: 'Fold in half', duration: 0.9, ease: 'inOut', pose: { rz: 90, rx: -12, s: 1.45, tx: 0.2, ty: -0.05 } }, (s) => {
    s.fold([0, -1], [0, 1], { side: [0.3, 0], toward: 1 });
  });

  // The ears, now on the outside of each half, fold down below the belly as flippers.
  F.step({ diagram: 8, label: 'Fold the flippers down', duration: 0.8 }, (s) => {
    s.fold(O, [-1, -1], { where: (f) => isEar(f) && f.sheet[0] > 0, side: [0, -t], toward: 1, at: [0, 0.7] });
    s.fold(O, [-1, -1], { where: (f) => isEar(f) && f.sheet[0] < 0, side: [0, -t], toward: -1, at: [0.3, 1] });
  });

  // The tail: a mountain fold near the tip. Both layers go behind together and the tip stands up over the back.
  const a = (((270 + TAIL_DIR) / 2) * Math.PI) / 180;
  const tailCrease: [P2, P2] = [[0, TAIL_AT], [-Math.cos(a), TAIL_AT - Math.sin(a)]];
  let tail: Face[] = [];
  F.step({ diagram: 10, label: 'Fold the tail up', duration: 0.9, ease: 'inOut', pose: { s: 1.5 } }, (s) => {
    tail = s.fold(tailCrease[0], tailCrease[1], { where: (f) => !isEar(f), side: Bt, toward: -1 });
  });

  // It swims with a flick of the tail: the fold opens a little and closes again.
  F.step({ diagram: 10, label: 'Swim', duration: 1.4, ease: 'linear', path: swim }, (s) => {
    s.attach(tail, s.hinge(tailCrease[0], tailCrease[1], Bt, 1, FLICK, { ease: 'breathe' }));
  });
  F.step({ diagram: 10, label: 'Swim on', duration: 1.4, ease: 'linear', path: swim });
  F.step({ diagram: 10, label: 'Dive', duration: 1.0, phase: 'outro', ease: 'in', pose: { ty: -0.9, rz: 112, o: 0 } });
  return F.compile();
}
