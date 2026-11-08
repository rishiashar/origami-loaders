import { DEG, apply, dot, mul, normalize, rotX, rotY, rotZ, scale, sub, translate, type Mat, type Vec3 } from './math';
import type { Pattern } from './pattern';
import { EDGE_ACTIVE, EDGE_FOLDED, EDGE_MEMORY, type Frame, type Pose } from './timeline';

/**
 * 3D → 2D. The camera sits on +z at distance `camera`, looking at the origin.
 * SVG has no depth buffer, so faces are ordered back-to-front with plane tests
 * (Newell-style) for every pair that overlaps on screen, then topologically sorted.
 */

export interface View {
  /** Model-space corners. */
  pts: Vec3[];
  /** Projected corners in viewBox units (y down). */
  scr: [number, number][];
  /** Normal of the front side. */
  normal: Vec3;
  center: Vec3;
  /** Distance of the centroid from the camera. */
  depth: number;
  /** True when we are looking at the front (coloured) side. */
  front: boolean;
  /** Lambert term for the visible side, 0–1. */
  light: number;
  box: [number, number, number, number];
}

export interface Camera {
  /** Distance from the model origin; smaller = stronger perspective. */
  distance: number;
  /** Direction *toward* the light. */
  light: Vec3;
}

export const defaultCamera: Camera = { distance: 5, light: normalize([-0.45, 0.7, 0.75]) };

export function poseMatrix(p: Pose): Mat {
  return mul(translate(p.tx, p.ty, p.tz), mul(scale(p.s), mul(rotX(p.rx * DEG), mul(rotY(p.ry * DEG), rotZ(p.rz * DEG)))));
}

export function project(p: Pattern, transforms: Mat[], pose: Pose, cam: Camera = defaultCamera): View[] {
  const M = poseMatrix(pose);
  const D = cam.distance;
  const eye: Vec3 = [0, 0, D];
  return p.faces.map((face, f) => {
    const T = mul(M, transforms[f]);
    const pts = face.map((v) => apply(T, p.coords[v][0], p.coords[v][1], 0));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const scr = pts.map(([x, y, z]) => {
      const k = D / (D - z);
      const sx = x * k, sy = -y * k;
      if (sx < minX) minX = sx; if (sx > maxX) maxX = sx;
      if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
      return [sx, sy] as [number, number];
    });
    const center: Vec3 = [0, 0, 0];
    for (const q of pts) { center[0] += q[0]; center[1] += q[1]; center[2] += q[2]; }
    center[0] /= pts.length; center[1] /= pts.length; center[2] /= pts.length;
    const normal = normalize([T[2], T[6], T[10]]);
    const toEye = sub(eye, center);
    const front = dot(normal, toEye) > 0;
    const vis: Vec3 = front ? normal : [-normal[0], -normal[1], -normal[2]];
    const light = Math.max(0, dot(vis, cam.light));
    return {
      pts, scr, normal, center, front, light,
      depth: Math.hypot(toEye[0], toEye[1], toEye[2]),
      box: [minX, minY, maxX, maxY],
    };
  });
}

type Plane = { pts: Vec3[]; normal: Vec3; center: Vec3; depth: number };

const PLANE_EPS = 1e-6;
const SCREEN_EPS = 1e-4;

/** +1: all of `b` is on the camera's side of `a`'s plane; -1: all beyond it; 0: straddles or coplanar. */
function side(a: Plane, b: Plane, eye: Vec3): number {
  const n = a.normal;
  const cam = dot(n, sub(eye, a.center)) >= 0 ? 1 : -1;
  let pos = false, neg = false;
  for (const v of b.pts) {
    const d = dot(n, sub(v, a.center)) * cam;
    if (d > PLANE_EPS) pos = true;
    else if (d < -PLANE_EPS) neg = true;
  }
  return pos && !neg ? 1 : neg && !pos ? -1 : 0;
}

/** Negative when `a` must be painted before (behind) `b`. */
function compare(a: Plane, b: Plane, eye: Vec3): number {
  const s = side(a, b, eye);
  if (s) return -s;
  const t = side(b, a, eye);
  if (t) return t;
  return b.depth - a.depth;
}

function overlaps(p: [number, number][], q: [number, number][]): boolean {
  for (const poly of [p, q]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const nx = a[1] - b[1], ny = b[0] - a[0];
      const len = Math.hypot(nx, ny);
      if (len < 1e-9) continue;
      let p0 = Infinity, p1 = -Infinity, q0 = Infinity, q1 = -Infinity;
      for (const v of p) { const d = (v[0] * nx + v[1] * ny) / len; if (d < p0) p0 = d; if (d > p1) p1 = d; }
      for (const v of q) { const d = (v[0] * nx + v[1] * ny) / len; if (d < q0) q0 = d; if (d > q1) q1 = d; }
      if (p1 <= q0 + SCREEN_EPS || q1 <= p0 + SCREEN_EPS) return false;
    }
  }
  return true;
}

/** Faces joined by unbent edges form one rigid, coplanar panel. */
export function panels(p: Pattern, edgeAngles: ArrayLike<number>): number[][] {
  const parent = p.faces.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  p.edges.forEach((e, i) => {
    if (e.faces.length === 2 && Math.abs(edgeAngles[i] || 0) < 1e-9) parent[find(e.faces[0])] = find(e.faces[1]);
  });
  const groups = new Map<number, number[]>();
  p.faces.forEach((_, f) => {
    const root = find(f);
    const g = groups.get(root);
    if (g) g.push(f); else groups.set(root, [f]);
  });
  return [...groups.values()];
}

interface Group { faces: number[]; pts: Vec3[]; normal: Vec3; center: Vec3; depth: number; box: number[] }

/**
 * Back-to-front paint order of panels (groups of coplanar faces). Panels are
 * painted whole — all fills, then all lines — so a neighbouring face in the
 * same panel can never cover another's edge.
 */
export function paintOrder(views: View[], groups: number[][] = views.map((_, i) => [i]), cam: Camera = defaultCamera): number[][] {
  const eye: Vec3 = [0, 0, cam.distance];
  const gs: Group[] = groups.map((faces) => {
    const pts = faces.flatMap((f) => views[f].pts);
    const center: Vec3 = [0, 0, 0];
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const f of faces) {
      const v = views[f];
      for (let k = 0; k < 3; k++) center[k] += v.center[k] / faces.length;
      box[0] = Math.min(box[0], v.box[0]); box[1] = Math.min(box[1], v.box[1]);
      box[2] = Math.max(box[2], v.box[2]); box[3] = Math.max(box[3], v.box[3]);
    }
    const d = sub(eye, center);
    return { faces, pts, normal: views[faces[0]].normal, center, depth: Math.hypot(d[0], d[1], d[2]), box };
  });
  const hit = (a: number[], b: number[]) => a[2] > b[0] && b[2] > a[0] && a[3] > b[1] && b[3] > a[1];
  const n = gs.length;
  const after: number[][] = gs.map(() => []);
  const indeg = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = gs[i], b = gs[j];
      if (!hit(a.box, b.box)) continue;
      const touching = a.faces.some((f) => b.faces.some((g) =>
        hit(views[f].box, views[g].box) && overlaps(views[f].scr, views[g].scr)));
      if (!touching) continue;
      if (compare(a, b, eye) < 0) { after[i].push(j); indeg[j]++; }
      else { after[j].push(i); indeg[i]++; }
    }
  }
  // Kahn's algorithm; among free panels take the farthest first. Cycles fall back to depth.
  const order: number[][] = [];
  const done = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    let pick = -1;
    for (let i = 0; i < n; i++) {
      if (!done[i] && indeg[i] === 0 && (pick < 0 || gs[i].depth > gs[pick].depth)) pick = i;
    }
    if (pick < 0) {
      for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || gs[i].depth > gs[pick].depth)) pick = i;
    }
    done[pick] = 1;
    order.push(gs[pick].faces);
    for (const j of after[pick]) indeg[j]--;
  }
  return order;
}

const SVG = 'http://www.w3.org/2000/svg';
const r = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Keeps, per face, a fill path and a group of three stroke layers (crease
 * memory, active-fold hint, edges), and updates them each frame. Looks are pure
 * CSS: the scene only supplies geometry, which side is showing, and a light
 * percentage.
 */
export class SvgScene {
  private fills: SVGPathElement[] = [];
  private lines: SVGGElement[] = [];
  private paths: SVGPathElement[][] = [];
  private cache: string[][] = [];
  private orderKey = '';

  constructor(private root: SVGGElement, private p: Pattern, private cam: Camera = defaultCamera) {
    root.textContent = '';
    const el = <K extends keyof SVGElementTagNameMap>(tag: K, cls?: string) => {
      const n = document.createElementNS(SVG, tag);
      if (cls) n.setAttribute('class', cls);
      return n;
    };
    for (let f = 0; f < p.faces.length; f++) {
      const fill = el('path', 'f');
      const g = el('g');
      const layer = ['m', 'a', 'e'].map((cls) => g.appendChild(el('path', cls)));
      root.append(fill, g);
      this.fills.push(fill);
      this.lines.push(g);
      this.paths.push(layer);
      this.cache.push(['', '', '', '', '', '']);
    }
  }

  render(frame: Frame, transforms: Mat[]): void {
    const p = this.p;
    const views = project(p, transforms, frame.pose, this.cam);
    for (let f = 0; f < views.length; f++) {
      const v = views[f];
      const face = p.faces[f];
      let fill = '', mem = '', act = '', edge = '';
      for (let i = 0; i < face.length; i++) {
        const a = v.scr[i], b = v.scr[(i + 1) % face.length];
        const seg = `M${r(a[0])} ${r(a[1])}L${r(b[0])} ${r(b[1])}`;
        fill += (i ? 'L' : 'M') + r(a[0]) + ' ' + r(a[1]);
        const e = p.faceEdges[f][i];
        const s = p.edges[e].faces.length < 2 ? EDGE_FOLDED : frame.edgeState[e];
        if (s & EDGE_FOLDED) edge += seg;
        else {
          if (s & EDGE_MEMORY) mem += seg;
          if (s & EDGE_ACTIVE) act += seg;
        }
      }
      fill += 'Z';
      const side = v.front ? 'f' : 'b';
      const tone = `color-mix(in oklab,var(--_l${side}) ${Math.round((0.15 + 0.85 * v.light) * 100)}%,var(--_s${side}))`;
      const cls = v.front ? 'front' : 'back';
      const c = this.cache[f];
      const [pm, pa, pe] = this.paths[f];
      if (c[0] !== fill) this.fills[f].setAttribute('d', (c[0] = fill));
      if (c[1] !== mem) pm.setAttribute('d', (c[1] = mem));
      if (c[2] !== act) pa.setAttribute('d', (c[2] = act));
      if (c[3] !== edge) pe.setAttribute('d', (c[3] = edge));
      if (c[4] !== tone) this.fills[f].style.setProperty('--f', (c[4] = tone));
      if (c[5] !== cls) this.lines[f].setAttribute('class', (c[5] = cls));
    }
    const order = paintOrder(views, panels(p, frame.edgeAngles), this.cam);
    const key = order.map((g) => g.join(',')).join('|');
    if (key !== this.orderKey) {
      this.orderKey = key;
      for (const g of order) {
        for (const f of g) this.root.appendChild(this.fills[f]);
        for (const f of g) this.root.appendChild(this.lines[f]);
      }
    }
    this.root.style.opacity = String(r(frame.pose.o));
  }
}
