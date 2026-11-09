import { apply, rotation, type Vec3 } from '../math';
import type { P2 } from '../geom';

/**
 * Small 3D helpers for compound folds worked out exactly (waterbomb base,
 * rabbit ear, squash): where a point goes when the paper turns about a crease,
 * and how far to turn so it lands somewhere.
 */

export const v3 = (p: P2 | Vec3): Vec3 => [p[0], p[1], p[2] ?? 0];
export const sub = (p: Vec3, q: Vec3): Vec3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
export const dot = (p: Vec3, q: Vec3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
export const cross = (p: Vec3, q: Vec3): Vec3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
export const unit = (p: Vec3): Vec3 => { const n = Math.hypot(p[0], p[1], p[2]); return [p[0] / n, p[1] / n, p[2] / n]; };

/** Where p goes when the paper turns `deg` (right-handed) about the crease from → to. */
export function turn(from: P2 | Vec3, to: P2 | Vec3, deg: number, p: Vec3): Vec3 {
  const R = rotation(v3(from), unit(sub(v3(to), v3(from))), (deg * Math.PI) / 180);
  return apply(R, p[0], p[1], p[2]);
}

/** Degrees to turn `from` about the crease o → e (right-handed) so it lands on `to`. */
export function angleAbout(o: P2 | Vec3, e: P2 | Vec3, from: Vec3, to: Vec3): number {
  const u = unit(sub(v3(e), v3(o)));
  const flat = (p: Vec3) => { const r = sub(p, v3(o)); const k = dot(r, u); return sub(r, [u[0] * k, u[1] * k, u[2] * k]); };
  const r0 = flat(from), t = flat(to);
  return (Math.atan2(dot(u, cross(r0, t)), dot(r0, t)) * 180) / Math.PI;
}

/**
 * Follow a root of f(x) = 0 as a parameter runs from 0 to 1, starting at x0:
 * a table of x at evenly spaced parameter values, each found near the last
 * (scan a window for a sign change, then bisect). For one-degree-of-freedom
 * folds where the angle of one crease decides another's.
 */
export function track(f: (t: number, x: number) => number, x0: number, o: { samples?: number; window?: number; step?: number; ok?: (t: number, x: number) => boolean } = {}): (t: number) => number {
  const n = o.samples ?? 181, win = o.window ?? 30, step = o.step ?? 0.25;
  const xs = new Float64Array(n);
  xs[0] = x0;
  for (let i = 1; i < n; i++) {
    const t = i / (n - 1), prev = xs[i - 1];
    let best = prev, bestD = Infinity;
    for (let d = -win; d < win; d += step) {
      const a = prev + d, b = a + step;
      const fa = f(t, a), fb = f(t, b);
      if (fa === 0 || fa * fb < 0) {
        let lo = a, hi = b, flo = fa;
        for (let k = 0; k < 40; k++) {
          const mid = (lo + hi) / 2, fm = f(t, mid);
          if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; }
        }
        const x = (lo + hi) / 2;
        if (o.ok && !o.ok(t, x)) continue;
        if (Math.abs(x - prev) < bestD) { bestD = Math.abs(x - prev); best = x; }
      }
    }
    xs[i] = best;
  }
  return (t: number) => {
    const x = Math.min(1, Math.max(0, t)) * (n - 1);
    const i = Math.min(n - 2, Math.floor(x));
    return xs[i] + (xs[i + 1] - xs[i]) * (x - i);
  };
}
