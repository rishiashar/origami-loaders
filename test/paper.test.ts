import { describe, expect, it } from 'vitest';
import { buildModel, listModels } from '../src/models/index';
import { describeIssues, inspect } from './inspect';

// Every model, mid-fold and at the end of every step: the right layer shows,
// no fold undoes itself, and creases stay joined.
describe('paper looks right', () => {
  for (const name of listModels()) {
    it(name, () => {
      const issues = inspect(buildModel(name)!);
      expect(describeIssues(name, issues)).toBe('');
    });
  }
});
