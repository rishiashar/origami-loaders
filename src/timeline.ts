import { DEG, clamp, lerp } from './math';
import type { Pattern } from './pattern';

export type EaseName = 'linear' | 'in' | 'out' | 'inOut' | 'fold' | 'settle';

export const eases: Record<EaseName, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - (1 - t) ** 3,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  // A hand fold: hesitant lift, quick swing, soft landing.
  fold: (t) => {
    const u = t ** 1.2;
    return u < 0.5 ? 8 * u ** 4 : 1 - (-2 * u + 2) ** 4 / 2;
  },
  // Overshoots slightly, like paper springing open.
  settle: (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2,
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

export interface FoldSpec {
  /** Crease name from the pattern. */
  crease: string;
  /** Target angle in degrees. Positive = valley (toward the front), negative = mountain. */
  to: number;
  /** Portion of the step this fold occupies, as [start, end] fractions. Default [0, 1]. */
  at?: [number, number];
  ease?: EaseName;
}

export interface StepSpec {
  /** Number of the matching step on the classic paper diagram. */
  diagram: number;
  label: string;
  /** Seconds. */
  duration: number;
  folds?: FoldSpec[];
  /** Pose targets reached by the end of the step. */
  pose?: Partial<Pose>;
  /** Pose offsets that swell and return within the step (e.g. lifting the sheet while turning it over). */
  arc?: Partial<Pose>;
  ease?: EaseName;
  /** Intro/outro steps are skipped when a determinate `progress` is mapped onto the sequence. */
  phase?: 'intro' | 'outro';
}

export interface Sequence {
  name: string;
  /** Face that stays still while everything else folds around it. */
  root: string;
  pose?: Partial<Pose>;
  /** Paper never quite closes flat — keeps layers apart for depth sorting. Degrees. Default 1.5. */
  springback?: number;
  steps: StepSpec[];
}

export const EDGE_MEMORY = 1; // creased earlier, now flat: faint line
export const EDGE_FOLDED = 2; // currently bent: full line
export const EDGE_ACTIVE = 4; // part of the fold happening right now

export interface Frame {
  /** Fold angle per edge, radians. */
  edgeAngles: Float64Array;
  /** EDGE_* bit flags per edge. */
  edgeState: Uint8Array;
  pose: Pose;
  step: number;
  /** Progress through the current step, 0–1. */
  local: number;
}

interface Snapshot { angles: Float64Array; creased: Uint8Array; pose: Pose }

const POSE_KEYS = Object.keys(defaultPose) as (keyof Pose)[];

export class Timeline {
  readonly steps: StepSpec[];
  readonly starts: number[] = [];
  readonly duration: number;
  /** Time span that `progress` 0–1 maps onto (excludes intro/outro). */
  readonly content: [number, number];
  private snaps: Snapshot[] = [];
  private stepFolds: { crease: number; from: number; to: number; at: [number, number]; ease: (t: number) => number }[][] = [];
  private active: Uint8Array[] = [];

  constructor(readonly pattern: Pattern, seq: Sequence) {
    this.steps = seq.steps;
    const nC = pattern.creaseNames.length;
    const cIndex = new Map(pattern.creaseNames.map((n, i) => [n, i]));
    let state: Snapshot = {
      angles: new Float64Array(nC),
      creased: new Uint8Array(nC),
      pose: { ...defaultPose, ...seq.pose },
    };
    let t = 0;
    let contentStart = 0, contentEnd = 0;
    for (const step of seq.steps) {
      this.starts.push(t);
      this.snaps.push(state);
      if (step.phase === 'intro') contentStart = t + step.duration;
      if (step.phase !== 'outro') contentEnd = t + step.duration;
      t += step.duration;

      const next: Snapshot = {
        angles: state.angles.slice(),
        creased: state.creased.slice(),
        pose: { ...state.pose, ...step.pose },
      };
      const active = new Uint8Array(nC);
      const folds = (step.folds ?? []).map((f) => {
        const c = cIndex.get(f.crease);
        if (c === undefined) throw new Error(`origami: step "${step.label}" folds unknown crease "${f.crease}"`);
        const to = f.to * DEG;
        next.angles[c] = to;
        next.creased[c] = 1;
        active[c] = 1;
        return { crease: c, from: state.angles[c], to, at: f.at ?? [0, 1], ease: eases[f.ease ?? 'inOut'] };
      });
      this.stepFolds.push(folds);
      this.active.push(active);
      state = next;
    }
    this.duration = t;
    this.content = [contentStart, contentEnd];
  }

  /** Index of the step playing at time `t`. */
  stepAt(t: number): number {
    let k = 0;
    while (k < this.starts.length - 1 && this.starts[k + 1] <= t) k++;
    return k;
  }

  evaluate(t: number, out?: Frame): Frame {
    const p = this.pattern;
    const frame: Frame = out ?? {
      edgeAngles: new Float64Array(p.edges.length),
      edgeState: new Uint8Array(p.edges.length),
      pose: { ...defaultPose },
      step: 0,
      local: 0,
    };
    t = clamp(t, 0, this.duration);
    const k = this.stepAt(t);
    const step = this.steps[k];
    const local = step.duration > 0 ? clamp((t - this.starts[k]) / step.duration) : 1;
    const snap = this.snaps[k];

    const angles = snap.angles.slice();
    for (const f of this.stepFolds[k]) {
      const u = clamp((local - f.at[0]) / Math.max(1e-6, f.at[1] - f.at[0]));
      angles[f.crease] = lerp(f.from, f.to, f.ease(u));
    }

    const active = this.active[k];
    for (let c = 0; c < angles.length; c++) {
      const a = angles[c];
      let s = 0;
      if (Math.abs(a) > DEG) s |= EDGE_FOLDED;
      if (snap.creased[c]) s |= EDGE_MEMORY;
      if (active[c]) s |= EDGE_ACTIVE;
      for (const e of p.creaseEdges[c]) {
        frame.edgeAngles[e] = a;
        frame.edgeState[e] = s;
      }
    }

    const e = eases[step.ease ?? 'inOut'](local);
    const arc = Math.sin(Math.PI * local);
    for (const key of POSE_KEYS) {
      const from = snap.pose[key];
      const to = step.pose?.[key];
      frame.pose[key] = (to === undefined ? from : lerp(from, to, e)) + (step.arc?.[key] ?? 0) * arc;
    }
    frame.step = k;
    frame.local = local;
    return frame;
  }
}
