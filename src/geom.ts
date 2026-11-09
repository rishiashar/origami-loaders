/** 2D polygon helpers. Every face is a convex polygon. */
export type P2 = [number, number];

/** Twice the signed area of triangle o-a-b; > 0 when b is left of o→a. */
export const side = (o: P2, a: P2, p: P2) => (a[0] - o[0]) * (p[1] - o[1]) - (a[1] - o[1]) * (p[0] - o[0]);

/** Where the line a→b meets the line c→d, or undefined if they are parallel. */
export function intersect(a: P2, b: P2, c: P2, d: P2): P2 | undefined {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-12) return undefined;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  return [a[0] + r[0] * t, a[1] + r[1] * t];
}

export function signedArea(poly: P2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function centroid(poly: P2[]): P2 {
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const c = p[0] * q[1] - q[0] * p[1];
    a += c; x += (p[0] + q[0]) * c; y += (p[1] + q[1]) * c;
  }
  if (Math.abs(a) < 1e-14) {
    for (const p of poly) { x += p[0]; y += p[1]; }
    return [x / poly.length, y / poly.length];
  }
  return [x / (3 * a), y / (3 * a)];
}

export const ccw = (poly: P2[]) => (signedArea(poly) < 0 ? poly.slice().reverse() : poly);

/**
 * Cut a convex polygon with the line a→b. Returns the pieces left and right of
 * the line (null when a side is empty) and the chord where the line crosses it.
 */
export function splitConvex(poly: P2[], a: P2, b: P2, eps = 1e-9) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const s = poly.map((p) => side(a, b, p) / len);
  if (!s.some((v) => v < -eps)) return { left: poly, right: null, chord: null };
  if (!s.some((v) => v > eps)) return { left: null, right: poly, chord: null };
  const left: P2[] = [], right: P2[] = [], chord: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const p = poly[i], q = poly[j], sp = s[i], sq = s[j];
    if (sp >= -eps) left.push(p);
    if (sp <= eps) right.push(p);
    if (Math.abs(sp) <= eps) chord.push(p);
    if ((sp > eps && sq < -eps) || (sp < -eps && sq > eps)) {
      const t = sp / (sp - sq);
      const x: P2 = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      left.push(x); right.push(x); chord.push(x);
    }
  }
  return { left, right, chord: chord.length >= 2 ? ([chord[0], chord[1]] as [P2, P2]) : null };
}

/** Intersection of two counter-clockwise convex polygons. */
export function clipConvex(subject: P2[], clipper: P2[]): P2[] {
  let out = subject;
  for (let i = 0; i < clipper.length && out.length; i++) {
    const a = clipper[i], b = clipper[(i + 1) % clipper.length];
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j], q = input[(j + 1) % input.length];
      const sp = side(a, b, p), sq = side(a, b, q);
      if (sp >= 0) out.push(p);
      if (sp >= 0 !== sq >= 0) {
        const t = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return out;
}

/** Convex hull (monotone chain), counter-clockwise. */
export function hull(points: P2[]): P2[] {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const lower: P2[] = [], upper: P2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && side(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && side(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
