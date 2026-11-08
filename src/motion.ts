/** Easing curves and the global pose of the model. */

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x, d = dx(t);
      if (Math.abs(e) < 1e-7 || Math.abs(d) < 1e-7) break;
      t -= e / d;
    }
    if (t < 0 || t > 1 || Math.abs(sx(t) - x) > 1e-5) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 30; i++) { t = (lo + hi) / 2; if (sx(t) < x) lo = t; else hi = t; }
    }
    return sy(t);
  };
}

export type EaseName = 'linear' | 'in' | 'out' | 'inOut' | 'fold' | 'drop' | 'flap';

export const eases: Record<EaseName, (t: number) => number> = {
  linear: (t) => t,
  // Exits: quiet, quick to leave (ease-in-cubic).
  in: bezier(0.55, 0.055, 0.675, 0.19),
  // Entrances: immediate response, long settle (ease-out-quint).
  out: bezier(0.23, 1, 0.32, 1),
  // Paper moving on screen (ease-in-out-cubic).
  inOut: bezier(0.645, 0.045, 0.355, 1),
  // A decisive hand fold: crisp lift, fast swing, soft landing (ease-in-out-quart).
  fold: bezier(0.77, 0, 0.175, 1),
  // A sheet dropped onto a table: lands, then settles with a whisper of bounce.
  drop: (t) => 1 - Math.exp(-7.5 * t) * Math.cos(8.5 * t) * (1 - t),
  // Two wing beats that fade out.
  flap: (t) => Math.sin(t * Math.PI * 4) * (1 - t * 0.6),
};

/** Global placement of the model: rotations in degrees, offsets in sheet units. */
export interface Pose {
  rx: number; ry: number; rz: number;
  tx: number; ty: number; tz: number;
  s: number;
  /** Opacity, 0–1. */
  o: number;
}

export const defaultPose: Pose = { rx: 0, ry: 0, rz: 0, tx: 0, ty: 0, tz: 0, s: 1, o: 1 };
export const POSE_KEYS = Object.keys(defaultPose) as (keyof Pose)[];
