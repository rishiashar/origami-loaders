/**
 * Quick, browser-free checks that a model looks right as it folds.
 *
 *   import { inspect, describeIssues } from 'origami-loaders/check';
 *   const issues = inspect(buildTulip());
 *   if (issues.length) throw new Error(describeIssues('tulip', issues));
 *
 * An empty list means the paper behaves. Run it on every model you write; it
 * takes well under a second.
 *
 * For a handful of moments in every step this lays the frame out exactly as
 * the renderer does (same panels, same paint order) and looks for:
 *
 * - order: two faces overlap on screen and the one further away is painted
 *   over the nearer one, so the wrong side or layer of the paper shows.
 * - cancel: a face rides joints that undo each other within one step. That is
 *   almost always a fold line running on into a flap it was not meant for.
 * - tear:  two faces that share a crease drift apart. Paper never does this,
 *   so every crease is checked at many moments of every step, with no
 *   exceptions.
 */
import { apply, mul, type Mat, type Vec3 } from './math';
import { ccw, centroid, clipConvex, signedArea, type P2 } from './geom';
import { jointMatrix, type Folded } from './fold';
import { Player } from './player';
import { defaultCamera, layoutFrame } from './scene';

export interface Issue {
  kind: 'order' | 'cancel' | 'tear';
  step: number;
  label: string;
  /** Progress through the step. */
  at: number;
  detail: string;
}

/** Moments sampled in every step, through the fold to its very end. */
export const MOMENTS = [0.25, 0.5, 0.75, 0.999];
/** Smallest on-screen overlap worth checking, in sheet units². */
const MIN_AREA = 2e-4;
/** Depth difference below which two faces count as touching, not stacked. */
const MIN_DEPTH = 2e-5;

/** Moments sampled in every step for tearing alone, which is cheap to check. */
const TEAR_MOMENTS = Array.from({ length: 40 }, (_, i) => ((i + 1) / 40) * 0.999);
/** Largest gap between two faces along a shared crease that still counts as joined. */
const MAX_GAP = 2e-3;

function sameMat(a: Mat, b: Mat, eps = 1e-7) {
  for (let i = 0; i < 12; i++) if (Math.abs(a[i] - b[i]) > eps) return false;
  return true;
}

/** Distance along the eye ray through a screen point to a face's plane (∞ if edge-on). */
function depthAt(p0: Vec3, n: Vec3, sx: number, sy: number, D: number): number {
  const dir: Vec3 = [sx, -sy, -D];
  const den = n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2];
  if (Math.abs(den) < 1e-9) return Infinity;
  return (n[0] * p0[0] + n[1] * p0[1] + n[2] * (p0[2] - D)) / den;
}

export function inspect(m: Folded, moments = MOMENTS): Issue[] {
  const player = new Player(m);
  const issues: Issue[] = [];
  const D = defaultCamera.distance;
  const edgeGap = (T: Mat[], i: number) => {
    const e = m.edges[i];
    let gap = 0;
    for (const v of [e.a, e.b]) {
      const [x, y] = m.verts[v];
      const a = apply(T[e.faces[0]], x, y, 0), b = apply(T[e.faces[1]], x, y, 0);
      gap = Math.max(gap, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
    }
    return gap;
  };

  m.steps.forEach((step, k) => {
    // Joints that cancel: a face moves during the step but ends exactly where it began,
    // without any out-and-back easing to explain it.
    const outAndBack = step.joints.some((j) => j.ease === 'breathe' || j.ease === 'flap');
    if (!outAndBack && step.table.length === 0) {
      m.tracks.forEach((tr, f) => {
        const { chain, T } = tr[k];
        if (chain.length < 2) return;
        let M: Mat = T;
        for (const j of chain) M = mul(jointMatrix(step.joints[j], 1, 0), M);
        if (sameMat(M, T)) issues.push({ kind: 'cancel', step: k, label: step.label, at: 1, detail: `face ${f} rides joints ${chain.join(', ')} that undo each other` });
      });
    }

    for (const u of moments) {
      const t = m.starts[k] + step.duration * u;
      const frame = player.evaluate(t);
      const { W, pts, scr, panels, order } = layoutFrame(m, frame);
      const panelOf = new Int32Array(m.faces.length);
      panels.forEach((p, i) => p.faces.forEach((f) => (panelOf[f] = i)));
      const rank = new Int32Array(panels.length);
      order.forEach((p, i) => (rank[p] = i));

      // Overlaps painted in the wrong order.
      const polys = scr.map((s) => ccw(s.slice()));
      const boxes = polys.map((poly) => {
        const b = [Infinity, Infinity, -Infinity, -Infinity];
        for (const [x, y] of poly) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
        return b;
      });
      const normals: Vec3[] = W.map((w) => [w[2], w[6], w[10]]);
      let worst: { f: number; g: number; gap: number } | undefined;
      let count = 0;
      for (let f = 0; f < polys.length; f++) {
        for (let g = f + 1; g < polys.length; g++) {
          if (panelOf[f] === panelOf[g]) continue;
          const A = boxes[f], B = boxes[g];
          if (A[2] <= B[0] || B[2] <= A[0] || A[3] <= B[1] || B[3] <= A[1]) continue;
          const inter = clipConvex(polys[f], polys[g]);
          if (inter.length < 3 || Math.abs(signedArea(inter)) < MIN_AREA) continue;
          const [sx, sy] = centroid(inter);
          const df = depthAt(pts[f][0], normals[f], sx, sy, D);
          const dg = depthAt(pts[g][0], normals[g], sx, sy, D);
          if (!isFinite(df) || !isFinite(dg) || Math.abs(df - dg) < MIN_DEPTH * Math.max(1, Math.abs(df))) continue;
          const near = df < dg ? f : g, far = near === f ? g : f;
          if (rank[panelOf[near]] > rank[panelOf[far]]) continue;
          count++;
          const gap = Math.abs(df - dg);
          if (!worst || gap > worst.gap) worst = { f: near, g: far, gap };
        }
      }
      if (worst) {
        issues.push({ kind: 'order', step: k, label: step.label, at: u, detail: `${count} overlap(s) painted back to front, e.g. face ${worst.g} drawn over nearer face ${worst.f}` });
      }

    }

    // Tearing: no crease may open at any moment.
    for (const u of TEAR_MOMENTS) {
      const frame = player.evaluate(m.starts[k] + step.duration * u);
      let gap = 0, at = -1;
      m.edges.forEach((e, i) => {
        if (e.faces.length < 2) return;
        const g = edgeGap(frame.T, i);
        if (g > gap) { gap = g; at = i; }
      });
      if (gap > MAX_GAP) { issues.push({ kind: 'tear', step: k, label: step.label, at: u, detail: `crease ${at} opens by ${gap.toFixed(4)}` }); break; }
    }
  });
  return issues;
}

export const describeIssues = (name: string, issues: Issue[]) =>
  issues.map((i) => `${name} · step ${i.step} "${i.label}" @${i.at}: ${i.kind}: ${i.detail}`).join('\n');
