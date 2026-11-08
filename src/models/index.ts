import { createKinematics, type Kinematics } from '../kinematics';
import { buildPattern, type Pattern, type PatternSpec } from '../pattern';
import { Timeline, type Sequence } from '../timeline';
import { crane } from './crane';

/** A foldable model: a crease pattern plus the sequence that folds it. */
export interface Model {
  pattern: PatternSpec;
  sequence: Sequence;
}

export interface CompiledModel {
  pattern: Pattern;
  timeline: Timeline;
  kinematics: Kinematics;
  /** Max fold angle in radians (π minus springback). */
  maxFold: number;
}

const registry = new Map<string, Model>([['crane', crane]]);
const compiled = new Map<string, CompiledModel>();

/** Add a model so `<origami-loader model="name">` can use it. */
export function registerModel(name: string, model: Model): void {
  registry.set(name, model);
  compiled.delete(name);
}

export function compileModel(model: Model): CompiledModel {
  const pattern = buildPattern(model.pattern);
  const root = pattern.faceNames.indexOf(model.sequence.root);
  if (root < 0) throw new Error(`origami: root face "${model.sequence.root}" not found`);
  return {
    pattern,
    timeline: new Timeline(pattern, model.sequence),
    kinematics: createKinematics(pattern, root),
    maxFold: Math.PI - ((model.sequence.springback ?? 1.5) * Math.PI) / 180,
  };
}

export function getModel(name: string): CompiledModel | undefined {
  let c = compiled.get(name);
  if (!c) {
    const m = registry.get(name);
    if (!m) return undefined;
    c = compileModel(m);
    compiled.set(name, c);
  }
  return c;
}

export { crane };
