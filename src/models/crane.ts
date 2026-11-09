import { Folder, type Face, type Filter } from '../fold';
import type { P2 } from '../geom';

/**
 * The traditional paper crane, following the classic 14-step diagram.
 *
 * Sheet coordinates: the square [-1, 1]², coloured side toward +z. The four
 * quadrants become the four points of the crane: top-right and bottom-left are
 * the wings, top-left the neck, bottom-right the tail.
 *
 * After the square base everything happens in one frame: the diamond stands on
 * its corners with the closed point at the top.
 */

const h = Math.SQRT1_2;                 // half-diagonal of the square base
const c: P2 = [0, h];                   // closed point (centre of the sheet)
const B0: P2 = [0, -h];                 // open point (the four corners)
const VR: P2 = [h, 0];
const VL: P2 = [-h, 0];
const yw = 1 - h;                       // the waist, where the top triangle folds down
const XR: P2 = [Math.SQRT2 - 1, yw];
const XL: P2 = [1 - Math.SQRT2, yw];
const narrow = (s: number): P2 => [s * Math.sin(Math.PI / 16), -h + Math.cos(Math.PI / 16)];
const NR = narrow(1), NL = narrow(-1);

/** Where the right narrowing line leaves the lifted petal: the wing fold runs through it. */
const yWing = (() => {
  const top: P2 = [0, 2 - h];
  const d = [NR[0] - B0[0], NR[1] - B0[1]], e = [top[0] - XR[0], top[1] - XR[1]];
  const den = d[0] * e[1] - d[1] * e[0];
  const s = ((XR[0] - B0[0]) * e[1] - (XR[1] - B0[1]) * e[0]) / den;
  return B0[1] + d[1] * s;
})();
/** Where the legs meet the body. */
const yLeg = 0.263;
/**
 * The reverse-fold crease across each leg slopes this much (radians). As on the diagram, the
 * legs swing almost straight up beside the body: the neck and tail rise at about 72°.
 */
const NECK_SLOPE = (9 * Math.PI) / 180;
/** The head: how far from the tip of the neck, and the way it hooks (radians from +x): down and forward. */
const HEAD = 0.26;
const HEAD_DIR = (-55 * Math.PI) / 180;

/** Mirror image of p across the line a→b. */
function mirror(p: P2, [a, b]: [P2, P2]): P2 {
  const d = [b[0] - a[0], b[1] - a[1]];
  const t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / (d[0] * d[0] + d[1] * d[1]);
  return [2 * (a[0] + d[0] * t) - p[0], 2 * (a[1] + d[1] * t) - p[1]];
}

// Regions of the sheet, by face centroid.
const TR = ([u, v]: P2) => u > 0 && v > 0;
const TL = ([u, v]: P2) => u < 0 && v > 0;
const BR = ([u, v]: P2) => u > 0 && v < 0;
const BL = ([u, v]: P2) => u < 0 && v < 0;
const topQ = ([u, v]: P2) => v > Math.abs(u);
const rightQ = ([u, v]: P2) => u > Math.abs(v);
const bottomQ = ([u, v]: P2) => v < -Math.abs(u);
const leftQ = ([u, v]: P2) => u < -Math.abs(v);

/** The two flaps facing the viewer: σ = +1 is the +z side, −1 the −z side. */
const flapR = (σ: number) => (σ > 0 ? topQ : leftQ);
const flapL = (σ: number) => (σ > 0 ? rightQ : bottomQ);
const outer = (σ: number) => (σ > 0 ? TR : BL);
const innerR = (σ: number) => (σ > 0 ? (p: P2) => topQ(p) && p[0] < 0 : (p: P2) => leftQ(p) && p[1] > 0);
const innerL = (σ: number) => (σ > 0 ? (p: P2) => rightQ(p) && p[1] < 0 : (p: P2) => bottomQ(p) && p[0] > 0);
/** Sheet point that lands on the right / left corner of the square base, per side. */
const cornerR = (σ: number): P2 => (σ > 0 ? [0, 1] : [-1, 0]);
const cornerL = (σ: number): P2 => (σ > 0 ? [1, 0] : [0, -1]);

const sheet = (test: (p: P2) => boolean): Filter => (f) => test(f.sheet);
const left = (a: P2, b: P2, p: P2) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) > 0;

function withVertex(faces: Face[], pt: P2): Face {
  const f = faces.find((g) => g.poly.some((q) => Math.hypot(q[0] - pt[0], q[1] - pt[1]) < 1e-7));
  if (!f) throw new Error(`crane: no face holds sheet point ${pt}`);
  return f;
}

export function buildCrane() {
  const F = new Folder({ rx: -30, ry: 12, ty: 0.7, tz: 0.5, o: 0 });

  /** A fold and its unfold, as two steps. */
  const precrease = (diagram: number, label: string, a: P2, b: P2, side: P2, toward: number, extra = {}) => {
    let moved: Face[] = [];
    F.step({ diagram, label, duration: 0.7, ...extra }, (s) => { moved = s.fold(a, b, { side, toward, at: [0.06, 1] }); });
    F.step({ diagram, label: 'Unfold', duration: 0.42, ease: 'inOut' }, (s) => { s.attach(moved, s.hinge(a, b, side, -toward, 180, { ease: 'inOut' })); });
  };

  F.step({ diagram: 1, label: 'Start with a square', duration: 1.1, phase: 'intro', ease: 'out', pose: { ty: 0, tz: 0, o: 1 }, arc: { rz: -4 } });

  precrease(2, 'Fold in half diagonally', [-1, 1], [1, -1], [1, 1], 1);
  precrease(2, 'Fold the other diagonal', [-1, -1], [1, 1], [1, -1], 1);

  F.step({ diagram: 3, label: 'Turn the paper over', duration: 0.8, ease: 'inOut', pose: { ry: 192 }, arc: { tz: 0.35 } });
  // Seen from the back now: folding toward us is a mountain fold on the front.
  precrease(3, 'Fold in half', [0, -1], [0, 1], [-0.5, 0], -1);
  precrease(3, 'Fold in half the other way', [-1, 0], [1, 0], [0, 0.5], -1);

  // 4. Collapse: midlines mountain, one diagonal valley, the other stays flat.
  F.step({ diagram: 4, label: 'Collapse into a square base', duration: 1.4, ease: 'inOut', pose: { s: 1.22 } }, (s) => {
    const o: P2 = [0, 0];
    const jT = s.hinge(o, [0, 1], [-0.3, 0.8], -1);
    const jTL = s.rot(o, [-1, 1], 'free', { free: 0 });
    const jL = s.hinge(o, [-1, 0], [-0.8, -0.3], -1);
    const jB = s.hinge(o, [0, -1], [0.3, -0.8], -1);
    const jBR = s.rot(o, [1, -1], 'free', { free: 0 });
    const spin = s.rot([0, 0, 0], [0, 0, 1], -135);
    const lift = s.move([0, h, 0]);
    const q = (t: (p: P2) => boolean) => s.select(sheet(t));
    const rightTop = q((p) => rightQ(p) && p[1] > 0);
    const rightBottom = q((p) => rightQ(p) && p[1] < 0);
    s.attach(q(TR), spin, lift);
    s.attach(q((p) => topQ(p) && p[0] < 0), jT, spin, lift);
    s.attach(q((p) => leftQ(p) && p[1] > 0), jTL, jT, spin, lift);
    s.attach(q(BL), jL, jTL, jT, spin, lift);
    s.attach(q((p) => bottomQ(p) && p[0] > 0), jB, jL, jTL, jT, spin, lift);
    s.attach(rightBottom, jBR, jB, jL, jTL, jT, spin, lift);
    s.pin(withVertex(rightBottom, [1, 0]), withVertex(rightTop, [1, 0]), [1, 0]);
  });

  /** Steps 5–7 on the side facing the viewer. */
  const petalSide = (σ: number, repeat: boolean) => {
    const pace = repeat ? 0.8 : 1;
    let kR: Face[] = [], kL: Face[] = [], top: Face[] = [];
    F.step({ diagram: 5, label: repeat ? 'Repeat: edges to the centre' : 'Fold the edges to the centre', duration: 0.95 * pace }, (s) => {
      kR = s.fold(B0, XR, { where: sheet(flapR(σ)), side: VR, toward: σ, at: [0, 0.72] });
      kL = s.fold(B0, XL, { where: sheet(flapL(σ)), side: VL, toward: σ, at: [0.28, 1] });
    });
    F.step({ diagram: 6, label: repeat ? 'Fold the top down' : 'Fold the top triangle down', duration: 0.65 * pace }, (s) => {
      // Every layer meets at the closed point, so this folds through all of them.
      top = s.fold(XL, XR, { side: c, toward: σ });
    });
    F.step({ diagram: 6, label: 'Unfold the last three folds', duration: 0.8 * pace, ease: 'inOut' }, (s) => {
      s.attach(top, s.hinge(XL, XR, c, -σ, 180, { at: [0, 0.6], ease: 'inOut' }));
      s.attach(kR, s.hinge(B0, XR, VR, -σ, 180, { at: [0.3, 1], ease: 'inOut' }));
      s.attach(kL, s.hinge(B0, XL, VL, -σ, 180, { at: [0.3, 1], ease: 'inOut' }));
    });
    F.step({ diagram: 7, label: repeat ? 'Petal fold the back' : 'Petal fold: lift the bottom point', duration: 1.3 * pace, ease: 'inOut', pose: { s: 1.2, ty: -0.33 } }, (s) => {
      const below = (t: (p: P2) => boolean, m: (p: P2) => boolean) => s.select((f) => t(f.sheet) && f.model[1] < yw && m(f.model));
      const between = (p: P2) => left(B0, XR, p) && !left(B0, XL, p);
      const C = below(outer(σ), between);
      const SR = below(outer(σ), (p) => !left(B0, XR, p));
      const SL = below(outer(σ), (p) => left(B0, XL, p));
      const IR = below(innerR(σ), (p) => !left(B0, XR, p));
      const IL = below(innerL(σ), (p) => left(B0, XL, p));
      const jh = s.hinge(XL, XR, B0, σ);
      const jsR = s.rot(B0, XR, 'free'), jsL = s.rot(B0, XL, 'free');
      const jiR = s.rot(B0, XR, 'free'), jiL = s.rot(B0, XL, 'free');
      s.attach(C, jh);
      s.attach(SR, jsR, jh);
      s.attach(SL, jsL, jh);
      s.attach(IR, jiR);
      s.attach(IL, jiL);
      s.pin(withVertex(SR, cornerR(σ)), withVertex(IR, cornerR(σ)), cornerR(σ));
      s.pin(withVertex(SL, cornerL(σ)), withVertex(IL, cornerL(σ)), cornerL(σ));
    });
  };

  // The collapse leaves the −z side facing us.
  petalSide(-1, false);
  F.step({ diagram: 7, label: 'Turn over', duration: 0.8, ease: 'inOut', pose: { ry: 372 }, arc: { tz: 0.3 } });
  petalSide(1, true);

  const narrowSide = (σ: number, diagram: number, label: string) =>
    F.step({ diagram, label, duration: 1.0, ease: 'inOut', pose: { s: 1.3, ty: -0.36 } }, (s) => {
      s.fold(B0, NR, { where: sheet(flapR(σ)), side: [0.35, 0.1], toward: σ, at: [0, 0.7] });
      s.fold(B0, NL, { where: sheet(flapL(σ)), side: [-0.35, 0.1], toward: σ, at: [0.3, 1] });
    });
  narrowSide(1, 8, 'Narrow the legs');
  F.step({ diagram: 9, label: 'Turn over', duration: 0.8, ease: 'inOut', pose: { ry: 552 }, arc: { tz: 0.3 } });
  narrowSide(-1, 9, 'Narrow the other side');

  // Inside reverse folds, as on the real crane: each leg is mirrored up across a crease
  // where it meets the body, so it turns inside out and rises between the body's layers.
  const front = sheet((p) => topQ(p) || rightQ(p));
  /** The leg below the waist, from its tip to the middle of its top. */
  const legAxis = (σ: number): [P2, P2] => [B0, [σ * 0.097, yLeg]];
  const legCrease = (σ: number): [P2, P2] => [[0, yLeg], [σ * Math.cos(NECK_SLOPE), yLeg - Math.sin(NECK_SLOPE)]];
  const reverseLeg = (diagram: number, label: string, quadrant: (p: P2) => boolean, σ: number) => {
    let moved: Face[] = [];
    F.step({ diagram, label, duration: 1.0, ease: 'inOut', pose: { s: 1.45, ty: -0.95 } }, (s) => {
      moved = s.reverse(s.select((f) => quadrant(f.sheet) && f.flat && f.model[1] < yLeg), legCrease(σ), { side: B0, axis: legAxis(σ), front, kind: 'inside' });
    });
    return () => moved;
  };
  const neck = reverseLeg(10, 'Reverse fold the neck up', TL, 1);
  reverseLeg(11, 'Reverse fold the tail up', BR, -1);
  // Where the neck ended up: its tip and axis, mirrored across the crease.
  const neckTip = mirror(B0, legCrease(1));
  const neckBase = mirror(legAxis(1)[1], legCrease(1));

  let wingF: Face[] = [], wingB: Face[] = [];
  const wingA: P2 = [-1, yWing], wingB2: P2 = [1, yWing], tip: P2 = [0, 1.2];
  F.step({ diagram: 12, label: 'Fold the wings down', duration: 0.9, ease: 'inOut', pose: { s: 1.55, ty: -0.8 } }, (s) => {
    wingF = s.fold(wingA, wingB2, { where: sheet((p) => TR(p) && p[0] + p[1] > 2 - Math.SQRT2), side: tip, toward: 1, at: [0, 0.7] });
    wingB = s.fold(wingA, wingB2, { where: sheet((p) => BL(p) && p[0] + p[1] < Math.SQRT2 - 2), side: tip, toward: -1, at: [0.3, 1] });
  });

  // Head: a small inside reverse fold near the tip of the neck, mirrored so it points forward and a little down.
  F.step({ diagram: 13, label: 'Reverse fold the head', duration: 0.8, ease: 'inOut' }, (s) => {
    const dx = neckTip[0] - neckBase[0], dy = neckTip[1] - neckBase[1];
    const len = Math.hypot(dx, dy);
    const dir = Math.atan2(dy, dx);
    const at: P2 = [neckTip[0] - (dx / len) * HEAD, neckTip[1] - (dy / len) * HEAD];
    const lineAngle = (dir + HEAD_DIR) / 2;
    const crease: [P2, P2] = [at, [at[0] + Math.cos(lineAngle), at[1] + Math.sin(lineAngle)]];
    s.reverse(neck(), crease, { side: neckTip, axis: [neckBase, neckTip], front, kind: 'inside' });
  });

  F.step({ diagram: 14, label: 'Spread the wings', duration: 1.5, ease: 'inOut', pose: { ry: 585, rx: -14, s: 1.7, ty: -0.9 } }, (s) => {
    s.attach(wingF, s.hinge(wingA, wingB2, tip, -1, 95, { ease: 'inOut' }));
    s.attach(wingB, s.hinge(wingA, wingB2, tip, 1, 95, { ease: 'inOut' }));
  });
  F.step({ diagram: 14, label: 'Finished crane', duration: 0.9, ease: 'inOut' });
  F.step({ diagram: 14, label: 'Fly', duration: 1.0, phase: 'outro', ease: 'in', pose: { ty: 0.7, tx: -0.6, tz: 0.8, s: 1.5, o: 0 } }, (s) => {
    s.attach(wingF, s.hinge(wingA, wingB2, tip, 1, 28, { ease: 'flap' }));
    s.attach(wingB, s.hinge(wingA, wingB2, tip, -1, 28, { ease: 'flap' }));
  });

  return F.compile();
}
