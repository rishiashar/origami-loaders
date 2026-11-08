import { describe, expect, it } from 'vitest';
import { apply } from '../src/math';
import { compileModel, crane } from '../src/models/index';
import { paintOrder, panels, project } from '../src/scene';
import { defaultPose } from '../src/timeline';

const model = compileModel(crane);
const { pattern, kinematics, timeline } = model;
const face = (n: string) => pattern.faceNames.indexOf(n);
const vert = (n: string) => pattern.coords[pattern.vertexNames.indexOf(n)];

function anglesFor(creases: Record<string, number>) {
  const a = new Float64Array(pattern.edges.length);
  for (const [name, deg] of Object.entries(creases)) {
    for (const e of pattern.creaseEdges[pattern.creaseNames.indexOf(name)]) a[e] = (deg * Math.PI) / 180;
  }
  return a;
}

function where(faceName: string, vertexName: string, creases: Record<string, number>) {
  const T = kinematics.solve(anglesFor(creases))[face(faceName)];
  const [x, y] = vert(vertexName);
  return apply(T, x, y, 0).map((v) => Math.round(v * 1e6) / 1e6 + 0);
}

describe('kinematics', () => {
  it('leaves the sheet flat with no folds', () => {
    expect(where('top-right', 'tr', {})).toEqual([1, 1, 0]);
  });

  it('valley-folds the top-right corner onto the bottom-left', () => {
    expect(where('top-right', 'tr', { diagA: 180 })).toEqual([-1, -1, 0]);
  });

  it('lifts a valley fold toward the front (+z) half way', () => {
    const [, , z] = where('top-right', 'tr', { diagA: 90 });
    expect(z).toBeGreaterThan(1.4); // corner is √2 from the diagonal
  });

  it('sends a mountain fold behind the sheet', () => {
    const [x, y, z] = where('right-top', 'r', { vertical: -90 });
    expect([x, y]).toEqual([0, 0]);
    expect(z).toBeCloseTo(-1);
  });

  it('keeps shared vertices together across the whole sheet', () => {
    const T = kinematics.solve(anglesFor({ diagA: 123 }));
    // the centre vertex is shared by all eight faces
    const c = vert('c');
    for (let f = 0; f < pattern.faces.length; f++) {
      expect(apply(T[f], c[0], c[1], 0).map((v) => +v.toFixed(9) + 0)).toEqual([0, 0, 0]);
    }
  });
});

describe('timeline', () => {
  it('starts flat and invisible, ends unfolded', () => {
    expect(timeline.evaluate(0).pose.o).toBe(0);
    const end = timeline.evaluate(timeline.duration);
    expect(Array.from(end.edgeAngles).every((a) => Math.abs(a) < 1e-9)).toBe(true);
  });

  it('is fully folded at the end of the first fold step', () => {
    const t = timeline.starts[1] + timeline.steps[1].duration - 1e-9;
    const f = timeline.evaluate(t);
    const e = pattern.creaseEdges[pattern.creaseNames.indexOf('diagA')][0];
    expect(f.edgeAngles[e]).toBeCloseTo(Math.PI, 3);
  });

  it('maps progress onto the content range only', () => {
    expect(timeline.content[0]).toBe(timeline.steps[0].duration);
    expect(timeline.content[1]).toBeCloseTo(timeline.duration - timeline.steps[timeline.steps.length - 1].duration);
  });
});

describe('paint order', () => {
  it('draws a folded-over flap after the face it lies on', () => {
    const T = kinematics.solve(anglesFor({ diagA: 180 }), model.maxFold);
    const views = project(pattern, T, { ...defaultPose, rx: -30 });
    const order = paintOrder(views).flat();
    // reflected across y = -x: top-right lands on left-bottom, right-top on bottom-left
    expect(order.indexOf(face('top-right'))).toBeGreaterThan(order.indexOf(face('left-bottom')));
    expect(order.indexOf(face('right-top'))).toBeGreaterThan(order.indexOf(face('bottom-left')));
  });

  it('draws the flap before the base when seen from behind', () => {
    const T = kinematics.solve(anglesFor({ diagA: 180 }), model.maxFold);
    const views = project(pattern, T, { ...defaultPose, rx: 180 });
    const order = paintOrder(views).flat();
    expect(order.indexOf(face('top-right'))).toBeLessThan(order.indexOf(face('left-bottom')));
  });
});

describe('panels', () => {
  it('treats a flat sheet as one panel and a single fold as two', () => {
    expect(panels(pattern, anglesFor({})).length).toBe(1);
    const two = panels(pattern, anglesFor({ diagA: 90 }));
    expect(two.map((g) => g.length).sort()).toEqual([4, 4]);
  });
});
