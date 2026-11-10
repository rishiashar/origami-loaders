import { describe, expect, it } from 'vitest';
// @ts-expect-error: a plain .mjs script, without types
import { stale } from '../scripts/sync-skill.mjs';

// The /fold skill ships the ten models as examples; they must match src/models.
describe('the /fold skill examples', () => {
  it('match src/models (run `npm run skill` to update them)', () => {
    expect(stale()).toEqual([]);
  });
});
