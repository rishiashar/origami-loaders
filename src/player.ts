import { clamp, identity, lerp, mul, type Mat } from './math';
import { jointMatrix, sampleTable, type Folded } from './fold';
import { POSE_KEYS, defaultPose, eases, type Pose } from './motion';

export interface Frame {
  /** Transform per face (sheet → model), without layer height. */
  T: Mat[];
  /** Layer height per face. */
  z: Float64Array;
  /**
   * Layer offset per face (x, y, z for each), in model space. Flat paper stacks along z;
   * paper that stands up (a crane's spread wings) keeps its stacking, turned with it.
   */
  lift: Float64Array;
  /** Joint chain id per face for this step; faces moving differently get different ids. */
  group: Int32Array;
  pose: Pose;
  step: number;
  /** Progress through the step, 0–1. */
  local: number;
}

/** Plays a compiled fold sequence: evaluates every face at any time. */
const isFlat = (T: Mat) => Math.abs(T[10]) > 1 - 1e-6;

export class Player {
  private groupIds: Int32Array[];
  /** Per step and face: the rotation the face had when it last lay flat (where its layer height was set). */
  private anchors: Mat[][];
  /** Per step and face: whether the face lies flat when the step ends. */
  private endsFlat: Uint8Array[];

  constructor(readonly model: Folded) {
    const n = model.faces.length;
    this.anchors = model.steps.map(() => new Array(n));
    this.endsFlat = model.steps.map(() => new Uint8Array(n));
    for (let f = 0; f < n; f++) {
      let anchor = model.tracks[f][0].T;
      model.steps.forEach((step, k) => {
        const tr = model.tracks[f][k];
        if (isFlat(tr.T)) anchor = tr.T;
        this.anchors[k][f] = anchor;
        const next = model.tracks[f][k + 1];
        let end = next?.T;
        if (!end) {
          end = tr.T;
          for (const j of tr.chain) end = mul(jointMatrix(step.joints[j], 1, step.table.length ? sampleTable(step.table[step.joints[j].free] ?? new Float64Array(2), 1) : 0), end);
        }
        this.endsFlat[k][f] = isFlat(end) ? 1 : 0;
      });
    }
    // Faces that share a step's joint chain move as one rigid group.
    this.groupIds = model.steps.map((_, k) => {
      const ids = new Map<string, number>();
      return Int32Array.from(model.tracks.map((tr) => {
        const key = tr[k].chain.join(',');
        let id = ids.get(key);
        if (id === undefined) { id = ids.size; ids.set(key, id); }
        return id;
      }));
    });
  }

  get duration() { return this.model.duration; }

  stepAt(t: number): number {
    const s = this.model.starts;
    let k = 0;
    while (k < s.length - 1 && s[k + 1] <= t) k++;
    return k;
  }

  evaluate(t: number, out?: Frame): Frame {
    const m = this.model;
    const n = m.faces.length;
    const frame: Frame = out ?? {
      T: new Array(n), z: new Float64Array(n), lift: new Float64Array(3 * n), group: new Int32Array(n),
      pose: { ...defaultPose }, step: 0, local: 0,
    };
    t = clamp(t, 0, m.duration);
    const k = this.stepAt(t);
    const step = m.steps[k];
    const local = step.duration > 0 ? clamp((t - m.starts[k]) / step.duration) : 1;
    const main = eases[step.ease ?? 'fold'](local);
    const solved = step.table.length > 0;
    const free = step.table.map((tb) => sampleTable(tb, main));
    const J = step.joints.map((j) => {
      const d = solved ? main : eases[j.ease](clamp((local - j.at[0]) / Math.max(1e-6, j.at[1] - j.at[0])));
      return jointMatrix(j, d, free[j.free] ?? 0);
    });
    const chains = new Map<string, Mat>();
    const [r0, r1] = step.restack ?? [0, 1];
    const zEase = eases.inOut(clamp((local - r0) / Math.max(1e-6, r1 - r0)));
    for (let f = 0; f < n; f++) {
      const tr = m.tracks[f][k];
      if (tr.chain.length) {
        const key = tr.chain.join(',');
        let C = chains.get(key);
        if (!C) {
          C = identity();
          for (const j of tr.chain) C = mul(J[j], C);
          chains.set(key, C);
        }
        frame.T[f] = mul(C, tr.T);
      } else {
        frame.T[f] = tr.T;
      }
      frame.z[f] = lerp(tr.z0, tr.z1, zEase);
      this.lift(frame, f, k, tr.chain.length > 0);
    }
    frame.group.set(this.groupIds[k]);

    const pe = eases[step.ease ?? 'inOut'](local);
    const arc = Math.sin(Math.PI * local);
    const from = this.poseAt(k);
    for (const key of POSE_KEYS) {
      const to = step.pose?.[key];
      frame.pose[key] = (to === undefined ? from[key] : lerp(from[key], to, pe)) + (step.arc?.[key] ?? 0) * arc;
    }
    if (step.path) {
      const off = step.path(local);
      for (const key of POSE_KEYS) frame.pose[key] += off[key] ?? 0;
    }
    frame.step = k;
    frame.local = local;
    return frame;
  }

  /** Where a face's layer offset points: along z while it lies flat, turned with the paper when it stands up. */
  private lift(frame: Frame, f: number, k: number, moving: boolean) {
    const tr = this.model.tracks[f][k];
    const T = frame.T[f], L = frame.lift, i = 3 * f;
    // Flat paper, and folds from flat to flat, stack along z as they always have.
    const flatToFlat = isFlat(tr.T) && this.endsFlat[k][f];
    if ((!moving && isFlat(T)) || (moving && flatToFlat)) { L[i] = 0; L[i + 1] = 0; L[i + 2] = frame.z[f]; return; }
    // The stacking direction is model z at the anchor, carried by every rotation since: R·Aᵀ·ẑ.
    const A = this.anchors[k][f];
    const ax = A[8], ay = A[9], az = A[10];
    const dx = T[0] * ax + T[1] * ay + T[2] * az;
    const dy = T[4] * ax + T[5] * ay + T[6] * az;
    const dz = T[8] * ax + T[9] * ay + T[10] * az;
    // Stacking along z still holds the layers apart until the paper turns past about 75°;
    // beyond that it would squeeze them into one plane, or flip them, so turn the stack with the paper.
    const s = Math.min(1, Math.max(0, (0.3 - dz) / 0.2));
    const z = frame.z[f];
    L[i] = s * tr.z0 * dx;
    L[i + 1] = s * tr.z0 * dy;
    L[i + 2] = (1 - s) * z + s * tr.z0 * dz;
  }

  private poses?: Pose[];
  /** Pose at the start of step k. */
  private poseAt(k: number): Pose {
    if (!this.poses) {
      let p = { ...this.model.pose };
      this.poses = this.model.steps.map((s) => {
        const start = p;
        p = { ...p, ...s.pose };
        return start;
      });
    }
    return this.poses[k];
  }
}
