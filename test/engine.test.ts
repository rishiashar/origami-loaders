import { describe, expect, it } from 'vitest';
import { Folder } from '../src/fold';
import { apply } from '../src/math';
import { buildCrane } from '../src/models/crane';
import { buildPlane } from '../src/models/plane';
import { Player } from '../src/player';

const crane = buildCrane();
const player = new Player(crane);

const stepEnd = (label: string) => {
  const k = crane.steps.findIndex((s) => s.label.startsWith(label));
  if (k < 0) throw new Error(`no step "${label}"`);
  return crane.starts[k] + crane.steps[k].duration - 1e-9;
};

/** Where a sheet point is at time t (taken from a face that holds it). */
function at(t: number, x: number, y: number) {
  const f = player.evaluate(t);
  const fi = crane.faces.findIndex((face) => face.some((v) => Math.hypot(crane.verts[v][0] - x, crane.verts[v][1] - y) < 1e-7));
  return apply(f.T[fi], x, y, 0).map((v) => Math.round(v * 1000) / 1000 + 0);
}

describe('folding engine', () => {
  it('valley-folds toward +z and stacks the flap on top', () => {
    const F = new Folder();
    F.step({ diagram: 1, label: 'fold', duration: 1 }, (s) => { s.fold([-1, 1], [1, -1], { side: [1, 1], toward: 1 }); });
    const m = F.compile();
    const mid = new Player(m).evaluate(0.5);
    const flap = m.faces.findIndex((face) => face.some((v) => m.verts[v][0] === 1 && m.verts[v][1] === 1));
    expect(apply(mid.T[flap], 1, 1, 0)[2]).toBeGreaterThan(1);
    expect(m.tracks[flap][0].z1).toBeGreaterThan(m.tracks[1 - flap][0].z1);
  });
});

describe('crane', () => {
  it('builds quickly into a modest number of faces', () => {
    const t0 = performance.now();
    buildCrane();
    expect(performance.now() - t0).toBeLessThan(500);
    expect(crane.faces.length).toBeLessThan(200);
  });

  it('collapses every corner to the open end of the square base', () => {
    const t = stepEnd('Collapse');
    for (const [x, y] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) expect(at(t, x, y)).toEqual([0, -0.707, 0]);
  });

  it('petal folds lift one corner on each side to the top', () => {
    expect(at(stepEnd('Petal fold: lift'), -1, -1)).toEqual([0, 1.293, 0]);
    expect(at(stepEnd('Petal fold the back'), 1, 1)).toEqual([0, 1.293, 0]);
  });

  it('lands solved folds exactly flat', () => {
    for (const s of crane.steps) for (const t of s.table) expect(Math.abs(Math.abs(t[t.length - 1]) - Math.PI)).toBeLessThan(1e-9);
  });

  it('swings the neck and tail up and spreads the wings', () => {
    const t = stepEnd('Spread');
    expect(at(t, 1, -1)[1]).toBeGreaterThan(1);   // tail
    expect(at(t, -1, 1)[1]).toBeGreaterThan(0.5); // neck, head folded down
    expect(at(t, 1, 1)[2]).toBeGreaterThan(0.5);  // front wing out toward +z
    expect(at(t, -1, -1)[2]).toBeLessThan(-0.5);  // back wing toward −z
  });

  it('never tears the paper in a real fold', () => {
    const firstSwing = crane.steps.findIndex((s) => s.label.startsWith('Reverse fold'));
    let worst = 0;
    for (let k = 0; k < firstSwing; k++) {
      for (const u of [0.2, 0.5, 0.8]) {
        const f = player.evaluate(crane.starts[k] + crane.steps[k].duration * u);
        for (const e of crane.edges) {
          if (e.faces.length < 2) continue;
          for (const v of [e.a, e.b]) {
            const [x, y] = crane.verts[v];
            const A = apply(f.T[e.faces[0]], x, y, 0), B = apply(f.T[e.faces[1]], x, y, 0);
            worst = Math.max(worst, Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]));
          }
        }
      }
    }
    expect(worst).toBeLessThan(2e-3);
  });
});

describe('plane', () => {
  const plane = buildPlane();
  const pp = new Player(plane);

  it('starts from an A4-proportioned sheet', () => {
    const xs = plane.verts.map((v) => v[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(Math.SQRT2);
  });

  it('never tears the paper, start to finish', () => {
    let worst = 0;
    for (let k = 0; k < plane.steps.length; k++) {
      for (const u of [0.2, 0.5, 0.8, 1]) {
        const f = pp.evaluate(plane.starts[k] + plane.steps[k].duration * u - 1e-9);
        for (const e of plane.edges) {
          if (e.faces.length < 2) continue;
          for (const v of [e.a, e.b]) {
            const [x, y] = plane.verts[v];
            const A = apply(f.T[e.faces[0]], x, y, 0), B = apply(f.T[e.faces[1]], x, y, 0);
            worst = Math.max(worst, Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]));
          }
        }
      }
    }
    expect(worst).toBeLessThan(1e-6);
  });

  it('opens the wings to either side of the body', () => {
    const k = plane.steps.findIndex((s) => s.label === 'Open the wings');
    const f = pp.evaluate(plane.starts[k] + plane.steps[k].duration - 1e-9);
    const zs = f.T.map((T) => T[10]);
    expect(zs.some((nz) => Math.abs(nz) < 0.2)).toBe(true); // body faces stand on edge…
    expect(zs.filter((nz) => Math.abs(nz) > 0.9).length).toBeGreaterThan(0); // …wings lie flat
  });
});
