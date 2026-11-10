import { describe, expect, it } from 'vitest';
import { lessonSteps } from '../src/lesson';
import { getModel, listModels } from '../src/models/index';

const labels = (name: string) => lessonSteps(getModel(name)!).map((s) => s.label);

describe('lesson steps', () => {
  it('start on the flat sheet and stop before the model shows off', () => {
    expect(labels('boat')).toEqual(['Start with a square', 'Fold in half diagonally', 'Fold the bottom up for the hull', 'Fold the stern corner behind']);
    const heart = labels('heart');
    expect(heart[heart.length - 1]).toBe('Fold the corners behind');
  });

  it('keep turning the paper over, which is a real step', () => {
    const crane = labels('crane');
    expect(crane).toContain('Turn the paper over');
    expect(crane[crane.length - 1]).toBe('Spread the wings');
  });

  it('teach every model, numbered from 1 in order of time', () => {
    for (const name of listModels()) {
      const steps = lessonSteps(getModel(name)!);
      expect(steps.length, name).toBeGreaterThan(1);
      steps.forEach((s, i) => {
        expect(s.number).toBe(i + 1);
        expect(s.end).toBeGreaterThan(s.start);
        if (i) expect(s.start).toBeGreaterThanOrEqual(steps[i - 1].end - 1e-9);
      });
    }
  });
});
