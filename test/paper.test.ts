import { describe, expect, it } from 'vitest';
import { buildModel, listModels } from '../src/models/index';
import { BENDS, describeIssues, inspect, MOMENTS } from './inspect';

// Every model, all the way through every step: the right layer shows, no fold
// undoes itself, and no crease ever comes apart.
describe('paper looks right', () => {
  for (const name of listModels()) {
    it(name, () => {
      const issues = inspect(buildModel(name)!, MOMENTS, BENDS[name]);
      expect(describeIssues(name, issues)).toBe('');
    });
  }
});

// The checker itself: without its allowance, the crane's reverse folds are caught opening.
describe('the tear check', () => {
  it('catches a crease that opens mid-fold', () => {
    const issues = inspect(buildModel('crane')!, MOMENTS, []);
    expect(issues.filter((i) => i.kind === 'tear').map((i) => i.label)).toEqual(BENDS.crane);
  });
});
