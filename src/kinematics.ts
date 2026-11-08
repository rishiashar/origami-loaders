import { identity, mul, rotation, type Mat, type Vec3 } from './math';
import type { Pattern } from './pattern';

/**
 * Forward kinematics: turn fold angles into a rigid transform per face.
 *
 * Starting from a root face that stays put, we walk the face-adjacency graph
 * breadth-first. Crossing an edge folded by θ rotates everything beyond it by
 * θ about that edge (in the parent face's flat frame). Positive θ is a valley
 * fold: the far face swings toward the front (+z).
 *
 * This is exact for any fold sequence whose angles are mutually consistent —
 * single folds, folds through stacked layers, and later compound moves whose
 * angles come from a solver.
 */
export interface Kinematics {
  /** Face transforms (sheet coords → model coords) for the given edge angles (radians). */
  solve(edgeAngles: ArrayLike<number>, maxFold?: number): Mat[];
}

export function createKinematics(p: Pattern, rootFace: number): Kinematics {
  // Fixed BFS spanning tree: (child face, parent face, edge, sign) in visit order.
  const order: { child: number; parent: number; edge: number; sign: number; axisP: Vec3; axisU: Vec3 }[] = [];
  const seen = new Uint8Array(p.faces.length);
  seen[rootFace] = 1;
  const queue = [rootFace];
  while (queue.length) {
    const f = queue.shift()!;
    for (const e of p.faceEdges[f]) {
      const edge = p.edges[e];
      const g = edge.faces[0] === f ? edge.faces[1] : edge.faces[0];
      if (g === undefined || seen[g]) continue;
      seen[g] = 1;
      queue.push(g);

      const a = p.coords[edge.a], b = p.coords[edge.b];
      const ux = b[0] - a[0], uy = b[1] - a[1];
      const len = Math.hypot(ux, uy);
      // Which side of the axis is the child on? Rotating by +θ lifts a point
      // at offset d by (u × d)_z · sin θ, so flip the sign to keep valley = +z.
      let cx = 0, cy = 0;
      for (const v of p.faces[g]) { cx += p.coords[v][0]; cy += p.coords[v][1]; }
      cx /= p.faces[g].length; cy /= p.faces[g].length;
      const cross = ux * (cy - a[1]) - uy * (cx - a[0]);
      order.push({
        child: g, parent: f, edge: e,
        sign: cross >= 0 ? 1 : -1,
        axisP: [a[0], a[1], 0],
        axisU: [ux / len, uy / len, 0],
      });
    }
  }
  if (order.length !== p.faces.length - 1) {
    throw new Error('origami: crease pattern is not connected');
  }

  return {
    solve(edgeAngles, maxFold = Math.PI) {
      const T: Mat[] = new Array(p.faces.length);
      T[rootFace] = identity();
      for (const o of order) {
        let θ = edgeAngles[o.edge] || 0;
        if (θ > maxFold) θ = maxFold; else if (θ < -maxFold) θ = -maxFold;
        T[o.child] = θ === 0 ? T[o.parent] : mul(T[o.parent], rotation(o.axisP, o.axisU, θ * o.sign));
      }
      return T;
    },
  };
}
