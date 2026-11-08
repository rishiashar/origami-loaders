import type { Vec2 } from './math';

/**
 * A crease pattern: the flat sheet cut into convex faces along every line it
 * will ever be folded on. Coordinates are in the sheet's own plane; the
 * standard sheet is the square [-1, 1]². The front (coloured) side faces +z.
 */
export interface PatternSpec {
  /** Named vertices in flat-sheet coordinates. */
  vertices: Record<string, Vec2>;
  /** Named convex faces as lists of vertex names (any winding). */
  faces: Record<string, string[]>;
  /** Named crease lines, each a list of edges given as vertex-name pairs. */
  creases: Record<string, [string, string][]>;
}

export interface Edge {
  a: number;
  b: number;
  /** The one (boundary) or two (crease) faces that share this edge. */
  faces: number[];
  /** Index into `Pattern.creaseNames`, or -1 for boundary / unnamed edges. */
  crease: number;
}

export interface Pattern {
  vertexNames: string[];
  coords: Vec2[];
  faceNames: string[];
  /** Vertex indices per face, counter-clockwise when seen from the front. */
  faces: number[][];
  /** Edge index per face side: faceEdges[f][i] joins faces[f][i] → faces[f][i+1]. */
  faceEdges: number[][];
  edges: Edge[];
  creaseNames: string[];
  /** Edge indices per crease. */
  creaseEdges: number[][];
}

const key = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function buildPattern(spec: PatternSpec): Pattern {
  const vertexNames = Object.keys(spec.vertices);
  const vIndex = new Map(vertexNames.map((n, i) => [n, i]));
  const coords = vertexNames.map((n) => spec.vertices[n]);
  const vi = (n: string) => {
    const i = vIndex.get(n);
    if (i === undefined) throw new Error(`origami: unknown vertex "${n}"`);
    return i;
  };

  const faceNames = Object.keys(spec.faces);
  const faces = faceNames.map((name) => {
    const f = spec.faces[name].map(vi);
    // shoelace: make every face counter-clockwise from the front
    let area = 0;
    for (let i = 0; i < f.length; i++) {
      const p = coords[f[i]], q = coords[f[(i + 1) % f.length]];
      area += p[0] * q[1] - q[0] * p[1];
    }
    if (Math.abs(area) < 1e-12) throw new Error(`origami: face "${name}" is degenerate`);
    return area < 0 ? f.reverse() : f;
  });

  const edges: Edge[] = [];
  const edgeIndex = new Map<string, number>();
  const faceEdges = faces.map((f, fi) =>
    f.map((a, i) => {
      const b = f[(i + 1) % f.length];
      const k = key(a, b);
      let e = edgeIndex.get(k);
      if (e === undefined) {
        e = edges.length;
        edgeIndex.set(k, e);
        edges.push({ a, b, faces: [], crease: -1 });
      }
      edges[e].faces.push(fi);
      return e;
    }),
  );

  const creaseNames = Object.keys(spec.creases);
  const creaseEdges = creaseNames.map((name, ci) =>
    spec.creases[name].map(([a, b]) => {
      const e = edgeIndex.get(key(vi(a), vi(b)));
      if (e === undefined || edges[e].faces.length !== 2) {
        throw new Error(`origami: crease "${name}" uses ${a}–${b}, which is not an interior edge`);
      }
      if (edges[e].crease !== -1) {
        throw new Error(`origami: edge ${a}–${b} belongs to two creases`);
      }
      edges[e].crease = ci;
      return e;
    }),
  );

  return { vertexNames, coords, faceNames, faces, faceEdges, edges, creaseNames, creaseEdges };
}
