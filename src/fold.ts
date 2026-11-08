import { DEG, apply, identity, mul, normalize, rotation, translate, type Mat, type Vec3 } from './math';
import { ccw, centroid, clipConvex, side, signedArea, splitConvex, type P2 } from './geom';
import { defaultPose, eases, type EaseName, type Pose } from './motion';

/**
 * The folding engine.
 *
 * A model is written the way origami is taught: one step at a time, against
 * the paper as it currently lies. Each step cuts the faces it folds along the
 * fold line (so the crease pattern emerges by itself), then attaches the
 * moving faces to joints — hinges about a line, in-plane swings, or moves.
 *
 * Compound folds (square base, petal fold) chain several joints and leave
 * some angles free; `pin` says which corners must stay together, and a small
 * Gauss–Newton solver works out the free angles along the motion so the paper
 * never tears.
 *
 * After every step the stacking order of the paper is recomputed: where two
 * faces overlap, the one that ended up nearer the viewer is above. That order
 * becomes a per-face layer height, so flat stacks have real (tiny) thickness
 * and paint back-to-front correctly.
 *
 * `compile()` returns everything the runtime needs to play the sequence.
 */

export interface Joint {
  /** Rotation about an axis, or a straight move. */
  rot: boolean;
  /** Axis point and unit direction (rotation), or the full offset (move). */
  p: Vec3;
  u: Vec3;
  /** Angle at full progress, radians. */
  angle: number;
  /** Index of a solved angle, or -1. */
  free: number;
  /** Portion of the step this joint moves in. */
  at: [number, number];
  ease: EaseName;
}

export interface StepMeta {
  /** Number of the matching step on the classic paper diagram. */
  diagram: number;
  label: string;
  /** Seconds. */
  duration: number;
  /** Pose targets reached by the end of the step. */
  pose?: Partial<Pose>;
  /** Pose offsets that swell and return within the step. */
  arc?: Partial<Pose>;
  /** Pose offsets as any function of the step's progress (0–1), for flight paths. */
  path?: (u: number) => Partial<Pose>;
  /** Easing for the pose, layer heights and solved joints. */
  ease?: EaseName;
  /** Intro/outro steps are skipped when `progress` maps onto the sequence. */
  phase?: 'intro' | 'outro';
}

export interface Step extends StepMeta {
  joints: Joint[];
  /** Solved angles per free variable, sampled evenly over the step's progress. */
  table: Float64Array[];
}

/** One face during one step: where it starts, which joints carry it, and its layer height. */
export interface Track { T: Mat; chain: number[]; z0: number; z1: number }

export interface Edge { a: number; b: number; faces: number[]; born: number }

export interface Folded {
  steps: Step[];
  starts: number[];
  duration: number;
  /** Time span that `progress` 0–1 maps onto. */
  content: [number, number];
  pose: Pose;
  verts: P2[];
  /** Vertex indices per face, counter-clockwise on the sheet. */
  faces: number[][];
  /** tracks[face][step] */
  tracks: Track[][];
  edges: Edge[];
  faceEdges: number[][];
}

export interface FaceInfo {
  /** Centroid on the flat sheet. */
  sheet: P2;
  /** Centroid where the face lies now. */
  model: P2;
  /** Lying flat in the model plane. */
  flat: boolean;
  /** Front of the paper facing +z. */
  up: boolean;
}
export type Filter = (f: FaceInfo) => boolean;

/** Height of one paper layer, in sheet units (a 15 cm sheet of 0.1 mm paper). */
export const LAYER = 0.0015;
const SAMPLES = 41;
const NEAR_END = 0.9;

interface Sim { id: number; poly: P2[]; T: Mat; level: number; rank: number; hist: Track[] }
/** A piece of paper while a model is being folded. */
export type Face = Readonly<Sim>;

export function jointMatrix(j: Joint, d: number, free: number): Mat {
  if (!j.rot) return translate(j.u[0] * d, j.u[1] * d, j.u[2] * d);
  return rotation(j.p, j.u, j.free >= 0 ? free : j.angle * d);
}

function invRigid(T: Mat): Mat {
  const r = [T[0], T[4], T[8], 0, T[1], T[5], T[9], 0, T[2], T[6], T[10], 0];
  r[3] = -(r[0] * T[3] + r[1] * T[7] + r[2] * T[11]);
  r[7] = -(r[4] * T[3] + r[5] * T[7] + r[6] * T[11]);
  r[11] = -(r[8] * T[3] + r[9] * T[7] + r[10] * T[11]);
  return r;
}

const isFlat = (T: Mat) => Math.abs(T[10]) > 1 - 1e-6 && Math.abs(T[11]) < 1e-5;

/** Remove numerical drift from a transform that ends (nearly) flat in the model plane. */
function settle(T: Mat): Mat {
  if (Math.abs(T[10]) < 1 - 1e-4 || Math.abs(T[11]) > 1e-3) return T;
  const σ = T[10] > 0 ? 1 : -1;
  const a = Math.atan2(T[4], T[0]);
  let c = Math.cos(a), s = Math.sin(a);
  for (const v of [0, 1, -1]) { if (Math.abs(c - v) < 1e-12) c = v; if (Math.abs(s - v) < 1e-12) s = v; }
  return [c, -σ * s, 0, T[3], s, σ * c, 0, T[7], 0, 0, σ, 0];
}

export function sampleTable(table: Float64Array, d: number): number {
  const x = Math.min(1, Math.max(0, d)) * (table.length - 1);
  const i = Math.min(table.length - 2, Math.floor(x));
  return table[i] + (table[i + 1] - table[i]) * (x - i);
}

function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c] || 1e-18;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / piv;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-18));
}

function gaussNewton(x0: number[], f: (x: number[]) => number[]): number[] {
  let x = x0.slice();
  let r = f(x);
  let err = r.reduce((s, v) => s + v * v, 0);
  const n = x.length;
  for (let it = 0; it < 60 && err > 1e-24; it++) {
    const J: number[][] = [];
    for (let j = 0; j < n; j++) {
      const xp = x.slice();
      xp[j] += 1e-7;
      J.push(f(xp).map((v, i) => (v - r[i]) / 1e-7));
    }
    const A = J.map((a) => J.map((b) => a.reduce((s, v, i) => s + v * b[i], 0)));
    const g = J.map((a) => -a.reduce((s, v, i) => s + v * r[i], 0));
    const damp = 1e-10 + 1e-8 * Math.max(...A.map((row, i) => row[i]));
    A.forEach((row, i) => (row[i] += damp));
    const dx = solveLinear(A, g);
    let t = 1, ok = false;
    for (let ls = 0; ls < 12; ls++) {
      const xn = x.map((v, i) => v + t * dx[i]);
      const rn = f(xn);
      const en = rn.reduce((s, v) => s + v * v, 0);
      if (en < err) { x = xn; r = rn; err = en; ok = true; break; }
      t /= 2;
    }
    if (!ok) break;
  }
  return x;
}

export class Folder {
  faces: Sim[];
  readonly steps: Step[] = [];
  readonly chords: { a: P2; b: P2; step: number }[] = [];
  nextId = 1;
  readonly pose: Pose;

  /**
   * @param pose  Starting pose of the model.
   * @param sheet The paper, counter-clockwise, inside [-1, 1]² (that square is
   *              what the paper texture covers). Defaults to the full square.
   */
  constructor(pose: Partial<Pose> = {}, sheet: P2[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    this.pose = { ...defaultPose, ...pose };
    this.faces = [{ id: 0, poly: ccw(sheet), T: identity(), level: 0, rank: 0, hist: [] }];
  }

  step(meta: StepMeta, build?: (s: StepBuilder) => void): this {
    const s = new StepBuilder(this, meta);
    build?.(s);
    s.finish();
    return this;
  }

  compile(): Folded {
    const verts: P2[] = [];
    const index = new Map<string, number>();
    const vid = (p: P2) => {
      const k = `${Math.round(p[0] * 1e7)},${Math.round(p[1] * 1e7)}`;
      let i = index.get(k);
      if (i === undefined) { i = verts.length; verts.push(p); index.set(k, i); }
      return i;
    };
    let faces = this.faces.map((f) => {
      const ids = ccw(f.poly).map(vid);
      return ids.filter((v, i) => v !== ids[(i + 1) % ids.length]);
    });
    // Conform: put every vertex that lies on another face's edge into that edge (no T-junctions).
    faces = faces.map((poly) => {
      const out: number[] = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        out.push(a);
        const A = verts[a], B = verts[b];
        const dx = B[0] - A[0], dy = B[1] - A[1], len2 = dx * dx + dy * dy;
        const on: [number, number][] = [];
        for (let v = 0; v < verts.length; v++) {
          if (v === a || v === b) continue;
          const P = verts[v];
          const t = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / len2;
          if (t <= 1e-9 || t >= 1 - 1e-9) continue;
          if (Math.abs(side(A, B, P)) / Math.sqrt(len2) < 1e-7) on.push([t, v]);
        }
        on.sort((x, y) => x[0] - y[0]);
        for (const [, v] of on) out.push(v);
      }
      return out;
    });

    const edges: Edge[] = [];
    const ekey = new Map<string, number>();
    const faceEdges = faces.map((poly, fi) =>
      poly.map((a, i) => {
        const b = poly[(i + 1) % poly.length];
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        let e = ekey.get(k);
        if (e === undefined) { e = edges.length; ekey.set(k, e); edges.push({ a, b, faces: [], born: Infinity }); }
        edges[e].faces.push(fi);
        return e;
      }),
    );
    const onChord = (P: P2, c: { a: P2; b: P2 }) => {
      const dx = c.b[0] - c.a[0], dy = c.b[1] - c.a[1], len2 = dx * dx + dy * dy;
      const t = ((P[0] - c.a[0]) * dx + (P[1] - c.a[1]) * dy) / len2;
      return t > -1e-7 && t < 1 + 1e-7 && Math.abs(side(c.a, c.b, P)) / Math.sqrt(len2) < 1e-7;
    };
    for (const e of edges) {
      if (e.faces.length < 2) continue;
      for (const c of this.chords) {
        if (c.step < e.born && onChord(verts[e.a], c) && onChord(verts[e.b], c)) e.born = c.step;
      }
    }

    const starts: number[] = [];
    let t = 0, c0 = 0, c1 = 0;
    for (const s of this.steps) {
      starts.push(t);
      if (s.phase === 'intro') c0 = t + s.duration;
      if (s.phase !== 'outro') c1 = t + s.duration;
      t += s.duration;
    }
    return {
      steps: this.steps, starts, duration: t, content: [c0, c1], pose: this.pose,
      verts, faces, tracks: this.faces.map((f) => f.hist), edges, faceEdges,
    };
  }
}

export class StepBuilder {
  readonly joints: Joint[] = [];
  private chains = new Map<Sim, number[]>();
  private pins: { a: Sim; b: Sim; pt: P2 }[] = [];
  private layers: { above: Sim[]; below: Sim[] }[] = [];
  private nFree = 0;

  constructor(private F: Folder, private meta: StepMeta) {}

  private get index() { return this.F.steps.length; }

  info(f: Sim): FaceInfo {
    const c = centroid(f.poly);
    const m = apply(f.T, c[0], c[1], 0);
    return { sheet: c, model: [m[0], m[1]], flat: isFlat(f.T), up: f.T[10] > 0 };
  }

  /** Faces of the paper matching a filter. */
  select(where?: Filter): Sim[] {
    return this.F.faces.filter((f) => !where || where(this.info(f)));
  }

  /** Cut flat faces along a model-space line. Returns what the given faces became. */
  split(faces: Sim[], a: P2, b: P2): Sim[] {
    const want = new Set(faces);
    const out: Sim[] = [];
    const next: Sim[] = [];
    for (const f of this.F.faces) {
      if (!want.has(f)) { next.push(f); continue; }
      if (!isFlat(f.T)) { next.push(f); out.push(f); continue; }
      const inv = invRigid(f.T);
      const pa = apply(inv, a[0], a[1], 0), pb = apply(inv, b[0], b[1], 0);
      const { left, right, chord } = splitConvex(f.poly, [pa[0], pa[1]], [pb[0], pb[1]]);
      if (!left || !right || Math.abs(signedArea(left)) < 1e-10 || Math.abs(signedArea(right)) < 1e-10) {
        next.push(f); out.push(f); continue;
      }
      if (chord) this.F.chords.push({ a: chord[0], b: chord[1], step: this.index });
      const chain = this.chains.get(f);
      this.chains.delete(f);
      for (const poly of [left, right]) {
        const g: Sim = { ...f, id: this.F.nextId++, poly, hist: f.hist.slice() };
        if (chain) this.chains.set(g, chain);
        next.push(g);
        out.push(g);
      }
    }
    this.F.faces = next;
    return out;
  }

  /** A rotation about the axis a→b (right-handed), by `deg`, or a solved angle. */
  rot(a: P2 | Vec3, b: P2 | Vec3, deg: number | 'free', o: { at?: [number, number]; ease?: EaseName; free?: number } = {}): number {
    const p: Vec3 = [a[0], a[1], a[2] ?? 0];
    const q: Vec3 = [b[0], b[1], b[2] ?? 0];
    let free = -1;
    if (deg === 'free') {
      free = o.free ?? this.nFree;
      this.nFree = Math.max(this.nFree, free + 1);
    }
    this.joints.push({
      rot: true, p, u: normalize([q[0] - p[0], q[1] - p[1], q[2] - p[2]]),
      angle: deg === 'free' ? 0 : deg * DEG, free,
      at: o.at ?? [0, 1], ease: o.ease ?? 'fold',
    });
    return this.joints.length - 1;
  }

  /** A hinge on the line a→b that swings the `sidePt` side `deg` degrees toward +z (toward = 1) or −z. */
  hinge(a: P2, b: P2, sidePt: P2, toward = 1, deg = 180, o: { at?: [number, number]; ease?: EaseName } = {}): number {
    return this.rot(a, b, deg * toward * Math.sign(side(a, b, sidePt)), o);
  }

  /** An in-plane swing about a point (used for reverse folds). Positive = counter-clockwise. */
  swing(pivot: P2, deg: number, o: { at?: [number, number]; ease?: EaseName } = {}): number {
    return this.rot([pivot[0], pivot[1], 0], [pivot[0], pivot[1], 1], deg, o);
  }

  /** A straight move. */
  move(v: Vec3, o: { at?: [number, number]; ease?: EaseName } = {}): number {
    this.joints.push({ rot: false, p: [0, 0, 0], u: v, angle: 0, free: -1, at: o.at ?? [0, 1], ease: o.ease ?? 'fold' });
    return this.joints.length - 1;
  }

  /** Fold: cut the matching faces on a→b and swing the side containing `side` over. */
  fold(a: P2, b: P2, o: { where?: Filter; side: P2; toward?: number; deg?: number; at?: [number, number]; ease?: EaseName }): Sim[] {
    const faces = this.split(this.select(o.where).filter((f) => isFlat(f.T)), a, b);
    const s = Math.sign(side(a, b, o.side));
    const moved = faces.filter((f) => Math.sign(side(a, b, this.info(f).model)) === s);
    this.attach(moved, this.hinge(a, b, o.side, o.toward ?? 1, o.deg ?? 180, o));
    return moved;
  }

  /** Carry faces on joints, innermost first. Appends to any joints they already ride. */
  attach(faces: Sim[], ...joints: number[]): void {
    for (const f of faces) this.chains.set(f, [...(this.chains.get(f) ?? []), ...joints]);
  }

  /** Keep a sheet point shared by two faces together while solving free angles. */
  pin(a: Sim, b: Sim, pt: P2): void {
    this.pins.push({ a, b, pt });
  }

  /** Force `above` faces to stack over `below` faces wherever they overlap. */
  layer(above: Sim[], below: Sim[]): void {
    this.layers.push({ above, below });
  }

  /**
   * Joints composed at progress d. With `eased`, each joint's own easing is
   * applied (so an out-and-back ease like 'breathe' really ends where it began);
   * solved steps always share one progress value.
   */
  private compose(chain: number[], d: number, free: number[], eased = false): Mat {
    let M = identity();
    for (const j of chain) {
      const J = this.joints[j];
      const dj = eased && this.nFree === 0 ? eases[J.ease](d) : d;
      M = mul(jointMatrix(J, dj, free[J.free] ?? 0), M);
    }
    return M;
  }

  private place(f: Sim, d: number, free: number[], eased = false): Mat {
    const ch = this.chains.get(f);
    return ch ? mul(this.compose(ch, d, free, eased), f.T) : f.T;
  }

  private solve(): Float64Array[] {
    if (!this.nFree) return [];
    const tables = Array.from({ length: this.nFree }, () => new Float64Array(SAMPLES));
    let x = new Array(this.nFree).fill(0);
    for (let i = 0; i < SAMPLES; i++) {
      const d = i / (SAMPLES - 1);
      x = gaussNewton(x, (v) => {
        const r: number[] = [];
        for (const { a, b, pt } of this.pins) {
          const pa = apply(this.place(a, d, v), pt[0], pt[1], 0);
          const pb = apply(this.place(b, d, v), pt[0], pt[1], 0);
          r.push(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
        }
        return r;
      });
      x.forEach((v, k) => (tables[k][i] = v));
    }
    // A flat-folded end state is singular for the solver; land it exactly.
    for (const t of tables) {
      const q = Math.round(t[SAMPLES - 1] / (Math.PI / 2)) * (Math.PI / 2);
      if (Math.abs(t[SAMPLES - 1] - q) < 1e-3) t[SAMPLES - 1] = q;
    }
    return tables;
  }

  finish(): void {
    const F = this.F;
    const table = this.solve();
    const at = (d: number) => table.map((t) => sampleTable(t, d));
    const end = at(1), near = at(NEAR_END);
    const Tend = new Map<Sim, Mat>(F.faces.map((f) => [f, settle(this.place(f, 1, end, true))]));

    // Stacking: compare every overlapping pair of faces that ends flat.
    type Item = { f: Sim; poly: P2[]; box: number[]; moved: boolean; Tn: Mat };
    const items: Item[] = [];
    for (const f of F.faces) {
      const T = Tend.get(f)!;
      if (!isFlat(T)) continue;
      const poly = ccw(f.poly.map((p) => { const q = apply(T, p[0], p[1], 0); return [q[0], q[1]] as P2; }));
      const box = [Infinity, Infinity, -Infinity, -Infinity];
      for (const [x, y] of poly) { box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y); }
      const ch = this.chains.get(f);
      // Carry the current stacking along as a tiny offset so rigidly moved stacks keep (or reverse) their order.
      const T0 = mul(translate(0, 0, f.rank * 1e-7), f.T);
      items.push({ f, poly, box, moved: !!ch, Tn: ch ? mul(this.compose(ch, NEAR_END, near, true), T0) : T0 });
    }
    const forced = new Map<string, number>();
    for (const { above, below } of this.layers) {
      for (const a of above) for (const b of below) { forced.set(`${a.id}|${b.id}`, 1); forced.set(`${b.id}|${a.id}`, -1); }
    }
    const zAt = (T: Mat, c: P2) => {
      const nz = T[10];
      if (Math.abs(nz) < 1e-3) return T[11];
      return T[11] - (T[2] * (c[0] - T[3]) + T[6] * (c[1] - T[7])) / nz;
    };
    const n = items.length;
    const ups: number[][] = items.map(() => []);
    const downs: number[][] = items.map(() => []);
    const indeg = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const A = items[i];
      for (let j = i + 1; j < n; j++) {
        const B = items[j];
        if (A.box[2] <= B.box[0] + 1e-9 || B.box[2] <= A.box[0] + 1e-9 || A.box[3] <= B.box[1] + 1e-9 || B.box[3] <= A.box[1] + 1e-9) continue;
        const inter = clipConvex(A.poly, B.poly);
        if (inter.length < 3 || Math.abs(signedArea(inter)) < 1e-8) continue;
        let o = forced.get(`${A.f.id}|${B.f.id}`);
        if (o === undefined) {
          if (!A.moved && !B.moved) o = A.f.rank > B.f.rank || (A.f.rank === B.f.rank && A.f.id > B.f.id) ? 1 : -1;
          else { const c = centroid(inter); o = zAt(A.Tn, c) > zAt(B.Tn, c) ? 1 : -1; }
        }
        const [lo, hi] = o > 0 ? [j, i] : [i, j];
        ups[lo].push(hi); downs[hi].push(lo); indeg[hi]++;
      }
    }
    const order: number[] = [];
    const done = new Uint8Array(n);
    for (let k = 0; k < n; k++) {
      let pick = -1;
      for (let i = 0; i < n; i++) {
        if (done[i] || indeg[i] > 0) continue;
        if (pick < 0 || items[i].f.rank < items[pick].f.rank || (items[i].f.rank === items[pick].f.rank && items[i].f.id < items[pick].f.id)) pick = i;
      }
      if (pick < 0) { for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || items[i].f.rank < items[pick].f.rank)) pick = i; }
      done[pick] = 1;
      order.push(pick);
      for (const u of ups[pick]) indeg[u]--;
    }
    const level = new Int32Array(n);
    const pos = new Int32Array(n);
    order.forEach((i, k) => (pos[i] = k));
    for (const i of order) for (const d of downs[i]) if (pos[d] < pos[i]) level[i] = Math.max(level[i], level[d] + 1);

    const newLevel = new Map<Sim, number>();
    const newRank = new Map<Sim, number>();
    order.forEach((i, k) => { newLevel.set(items[i].f, level[i]); newRank.set(items[i].f, k); });
    for (const f of F.faces) {
      const nl = newLevel.get(f) ?? f.level;
      f.hist.push({ T: f.T, chain: this.chains.get(f) ?? [], z0: f.level * LAYER, z1: nl * LAYER });
      f.T = Tend.get(f)!;
      f.level = nl;
      f.rank = newRank.get(f) ?? f.rank;
    }
    F.steps.push({ ...this.meta, joints: this.joints, table });
  }
}
