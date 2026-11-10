import { describe, expect, it } from 'vitest';
import { Folder, type Filter, type StepBuilder } from '../src/fold';
import type { P2 } from '../src/geom';
import { buildModel, listModels } from '../src/models/index';
import { describeIssues, inspect } from '../src/check';

// Every model, all the way through every step: the right layer shows, no fold
// undoes itself, and no crease ever comes apart.
describe('paper looks right', () => {
  for (const name of listModels()) {
    it(name, () => {
      const issues = inspect(buildModel(name)!);
      expect(describeIssues(name, issues)).toBe('');
    });
  }
});

// A sheet folded in half, then its lower corner reverse folded in between the two halves.
describe('an inside reverse fold', () => {
  const crease: [P2, P2] = [[0, -0.2], [-1, -0.6]];
  const front: Filter = (f) => f.sheet[0] > 0;
  const flap = (reverse: (s: StepBuilder) => void) => {
    const F = new Folder();
    F.step({ diagram: 1, label: 'Fold in half', duration: 1 }, (s) => { s.fold([0, -1], [0, 1], { side: [1, 0], toward: 1 }); });
    F.step({ diagram: 2, label: 'Reverse fold', duration: 1 }, reverse);
    return inspect(F.compile()).filter((i) => i.kind === 'tear').map((i) => i.label);
  };

  it('opens its crease on the way when the paper cannot flex', () => {
    const tears = flap((s) => { s.reverse(s.select(), crease, { side: [-0.5, -0.9], axis: [[-0.35, -0.3], [-0.35, -1]], front, kind: 'inside' }); });
    expect(tears).toEqual(['Reverse fold']);
  });

  it('never comes apart when it can', () => {
    const tears = flap((s) => { s.insideReverse(s.select(), crease, { side: [-0.5, -0.9], spine: [[0, -1], [0, 1]], front }); });
    expect(tears).toEqual([]);
  });

  it('refuses a fold that would land the point outside its own sides', () => {
    const outside: [P2, P2] = [[0, -0.2], [-1, 0.2]];
    expect(() => flap((s) => { s.insideReverse(s.select(), outside, { side: [-0.5, -0.9], spine: [[0, -1], [0, 1]], front }); })).toThrow(/outside/);
  });
});
