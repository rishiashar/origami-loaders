import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: a plain .mjs script, without types
import { examples } from '../scripts/sync-skill.mjs';

// The /fold skill ships the ten models as examples; they must match src/models.
describe('the /fold skill examples', () => {
  it('match src/models (run `npm run skill` to update them)', () => {
    for (const [file, body] of Object.entries(examples() as Record<string, string>)) {
      const path = new URL(`../skills/fold/examples/${file}`, import.meta.url);
      expect(existsSync(path), file).toBe(true);
      expect(readFileSync(path, 'utf8'), file).toBe(body);
    }
  });
});
