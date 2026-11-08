import type { Folded } from '../fold';
import { Player } from '../player';
import { buildCrane } from './crane';

/** A model is a function that folds it, run once on first use. */
export type ModelBuilder = () => Folded;

const registry = new Map<string, ModelBuilder>([['crane', buildCrane]]);
const players = new Map<string, Player>();

/** Add a model so `<origami-loader model="name">` can use it. */
export function registerModel(name: string, build: ModelBuilder): void {
  registry.set(name, build);
  players.delete(name);
}

export function getModel(name: string): Player | undefined {
  let p = players.get(name);
  if (!p) {
    const build = registry.get(name);
    if (!build) return undefined;
    p = new Player(build());
    players.set(name, p);
  }
  return p;
}

export { buildCrane };
