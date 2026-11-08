/**
 * Tiny 3D math kit. Affine transforms are stored row-major as 12 numbers:
 *   [m00 m01 m02 tx | m10 m11 m12 ty | m20 m21 m22 tz]
 */
export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Mat = number[];

export const DEG = Math.PI / 180;

export const identity = (): Mat => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

/** a ∘ b — apply `b` first, then `a`. */
export function mul(a: Mat, b: Mat): Mat {
  const r: Mat = new Array(12);
  for (let i = 0; i < 12; i += 4) {
    const a0 = a[i], a1 = a[i + 1], a2 = a[i + 2];
    r[i] = a0 * b[0] + a1 * b[4] + a2 * b[8];
    r[i + 1] = a0 * b[1] + a1 * b[5] + a2 * b[9];
    r[i + 2] = a0 * b[2] + a1 * b[6] + a2 * b[10];
    r[i + 3] = a0 * b[3] + a1 * b[7] + a2 * b[11] + a[i + 3];
  }
  return r;
}

export function apply(m: Mat, x: number, y: number, z: number): Vec3 {
  return [
    m[0] * x + m[1] * y + m[2] * z + m[3],
    m[4] * x + m[5] * y + m[6] * z + m[7],
    m[8] * x + m[9] * y + m[10] * z + m[11],
  ];
}

/** Rotation by `angle` (radians, right-handed) about the axis through `p` with unit direction `u`. */
export function rotation(p: Vec3, u: Vec3, angle: number): Mat {
  const [x, y, z] = u;
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  const m: Mat = [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y, 0,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x, 0,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c, 0,
  ];
  // translation = p - R·p, so points on the axis stay put
  for (let i = 0; i < 12; i += 4) {
    m[i + 3] = p[i / 4] - (m[i] * p[0] + m[i + 1] * p[1] + m[i + 2] * p[2]);
  }
  return m;
}

export const rotX = (a: number): Mat => rotation([0, 0, 0], [1, 0, 0], a);
export const rotY = (a: number): Mat => rotation([0, 0, 0], [0, 1, 0], a);
export const rotZ = (a: number): Mat => rotation([0, 0, 0], [0, 0, 1], a);
export const translate = (x: number, y: number, z: number): Mat => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
export const scale = (s: number): Mat => [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0];

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
