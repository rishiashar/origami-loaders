// Copy the ten models into the /fold skill as examples, written against the package
// (`from 'origami-loaders'`), so each one runs as is in someone's own project.
//   node scripts/sync-skill.mjs          write skills/fold/examples/
//   node scripts/sync-skill.mjs --check  exit 1 if they are out of date (the tests run this)
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src/models');
const out = join(root, 'skills/fold/examples');
/** Engine-internal modules a model imports; all of them are exported from the package. */
const INTERNAL = /from '(?:\.\.\/(?:fold|motion|geom|math|player)|\.\/kinematics)'/g;

/** The examples, by file name, as they should read. */
export function examples() {
  const files = {};
  for (const f of readdirSync(src).sort()) {
    if (!f.endsWith('.ts') || f === 'index.ts' || f === 'kinematics.ts') continue;
    const body = readFileSync(join(src, f), 'utf8').replace(INTERNAL, "from 'origami-loaders'");
    files[f] = `// Generated from src/models/${f} in origami-loaders by \`npm run skill\`. Do not edit here.\n${body}`;
  }
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const want = examples();
  if (process.argv.includes('--check')) {
    const stale = Object.keys(want).filter((f) => !existsSync(join(out, f)) || readFileSync(join(out, f), 'utf8') !== want[f]);
    if (stale.length) {
      console.error(`skills/fold/examples is out of date (${stale.join(', ')}). Run: npm run skill`);
      process.exit(1);
    }
  } else {
    mkdirSync(out, { recursive: true });
    for (const [f, body] of Object.entries(want)) writeFileSync(join(out, f), body);
    console.log(`wrote ${Object.keys(want).length} examples to skills/fold/examples`);
  }
}
