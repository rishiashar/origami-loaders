import { clamp, identity, lerp, mul, type Mat } from './math';
import { jointMatrix, sampleTable, type Folded } from './fold';
import { POSE_KEYS, defaultPose, eases, type Pose } from './motion';

export interface Frame {
  /** Transform per face (sheet → model), without layer height. */
  T: Mat[];
  /** Layer height per face. */
  z: Float64Array;
  /** Joint chain id per face for this step; faces moving differently get different ids. */
  group: Int32Array;
  pose: Pose;
  step: number;
  /** Progress through the step, 0–1. */
  local: number;
}

/** Plays a compiled fold sequence: evaluates every face at any time. */
export class Player {
  private groupIds: Int32Array[];

  constructor(readonly model: Folded) {
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
      T: new Array(n), z: new Float64Array(n), group: new Int32Array(n),
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
    const zEase = eases.inOut(local);
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
    }
    frame.group.set(this.groupIds[k]);

    const pe = eases[step.ease ?? 'inOut'](local);
    const arc = Math.sin(Math.PI * local);
    const from = this.poseAt(k);
    for (const key of POSE_KEYS) {
      const to = step.pose?.[key];
      frame.pose[key] = (to === undefined ? from[key] : lerp(from[key], to, pe)) + (step.arc?.[key] ?? 0) * arc;
    }
    frame.step = k;
    frame.local = local;
    return frame;
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
