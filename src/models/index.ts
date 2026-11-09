import type { Folded } from '../fold';
import { Player } from '../player';
import { buildCrane } from './crane';
import { buildPlane } from './plane';
import { buildPleat } from './pleat';
import { buildEnvelope } from './envelope';
import { buildBoat } from './boat';
import { buildFrog } from './frog';
import { buildSwan } from './swan';
import { buildHeart } from './heart';
import { buildWhale } from './whale';
import { buildFox } from './fox';

/** A model is a function that folds it, run once on first use. */
export type ModelBuilder = () => Folded;

const registry = new Map<string, ModelBuilder>([
  ['crane', buildCrane],
  ['plane', buildPlane],
  ['pleat', buildPleat],
  ['envelope', buildEnvelope],
  ['boat', buildBoat],
  ['frog', buildFrog],
  ['swan', buildSwan],
  ['heart', buildHeart],
  ['whale', buildWhale],
  ['fox', buildFox],
]);
const players = new Map<string, Player>();

/** Names of every model `<origami-loader model>` accepts. */
export function listModels(): string[] {
  return [...registry.keys()];
}

/** Builds a model fresh, without the shared cache. */
export function buildModel(name: string) {
  return registry.get(name)?.();
}

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

export { buildCrane, buildPlane, buildPleat, buildEnvelope, buildBoat, buildFrog, buildSwan, buildHeart, buildWhale, buildFox };
