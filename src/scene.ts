import { DEG, apply, dot, mul, normalize, rotX, rotY, rotZ, scale, sub, translate, type Mat, type Vec3 } from './math';
import { ccw, centroid, clipConvex, hull, signedArea, type P2 } from './geom';
import type { Folded } from './fold';
import type { Frame } from './player';
import type { Pose } from './motion';

/**
 * 3D → SVG. The camera sits on +z, looking at the origin. Faces that lie flat
 * against each other along an unbent crease are drawn together as one panel
 * (one fill, one set of lines, one texture mapping). SVG has no depth buffer,
 * so panels are painted back-to-front: plane tests for every pair that
 * overlaps on screen, then a topological sort.
 */

export interface Camera {
  /** Distance from the model origin; smaller = stronger perspective. */
  distance: number;
  /** Direction toward the light. */
  light: Vec3;
}

export const defaultCamera: Camera = { distance: 5, light: normalize([-0.45, 0.7, 0.75]) };

export function poseMatrix(p: Pose): Mat {
  return mul(translate(p.tx, p.ty, p.tz), mul(rotZ(p.spin * DEG), mul(scale(p.s), mul(rotX(p.rx * DEG), mul(rotY(p.ry * DEG), rotZ(p.rz * DEG))))));
}

export interface Panel {
  faces: number[];
  pts: Vec3[];
  scr: P2[];
  /** Screen outline of each face, counter-clockwise. */
  polys: P2[][];
  normal: Vec3;
  center: Vec3;
  depth: number;
  box: number[];
}

const PLANE_EPS = 1e-6;

/** +1: all of `b` is on the camera's side of `a`'s plane; −1: all beyond it; 0: straddles or coplanar. */
function planeSide(a: Panel, b: Panel, eye: Vec3): number {
  const n = a.normal;
  const cam = dot(n, sub(eye, a.center)) >= 0 ? 1 : -1;
  let pos = false, neg = false;
  for (const v of b.pts) {
    const d = dot(n, sub(v, a.center)) * cam;
    if (d > PLANE_EPS) pos = true;
    else if (d < -PLANE_EPS) neg = true;
    if (pos && neg) return 0;
  }
  return pos ? 1 : neg ? -1 : 0;
}

function overlaps(p: P2[], q: P2[]): boolean {
  for (const poly of [p, q]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const nx = a[1] - b[1], ny = b[0] - a[0];
      const len = Math.hypot(nx, ny);
      if (len < 1e-9) continue;
      let p0 = Infinity, p1 = -Infinity, q0 = Infinity, q1 = -Infinity;
      for (const v of p) { const d = (v[0] * nx + v[1] * ny) / len; if (d < p0) p0 = d; if (d > p1) p1 = d; }
      for (const v of q) { const d = (v[0] * nx + v[1] * ny) / len; if (d < q0) q0 = d; if (d > q1) q1 = d; }
      if (p1 <= q0 + 1e-4 || q1 <= p0 + 1e-4) return false;
    }
  }
  return true;
}

/**
 * When neither plane separates two panels, look where they really overlap on
 * screen and see which is nearer there. 0 when they only touch.
 */
function overlapSide(a: Panel, b: Panel, D: number): number {
  let best = 0, at: P2 | undefined;
  for (const p of a.polys) {
    for (const q of b.polys) {
      const inter = clipConvex(p, q);
      if (inter.length < 3) continue;
      const area = Math.abs(signedArea(inter));
      if (area > best) { best = area; at = centroid(inter); }
    }
  }
  if (!at || best < 1e-7) return 0;
  const dir: Vec3 = [at[0], -at[1], -D];
  const reach = (p: Panel) => {
    const den = dot(p.normal, dir);
    return Math.abs(den) < 1e-12 ? Infinity : (p.normal[0] * p.center[0] + p.normal[1] * p.center[1] + p.normal[2] * (p.center[2] - D)) / den;
  };
  const da = reach(a), db = reach(b);
  if (!isFinite(da) || !isFinite(db) || da === db) return 0;
  return db < da ? 1 : -1;
}

/** Back-to-front order of panels. */
export function paintOrder(panels: Panel[], cam: Camera = defaultCamera): number[] {
  const eye: Vec3 = [0, 0, cam.distance];
  const n = panels.length;
  const hulls = panels.map((p) => hull(p.scr));
  const after: number[][] = panels.map(() => []);
  const indeg = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const a = panels[i];
    for (let j = i + 1; j < n; j++) {
      const b = panels[j];
      if (a.box[2] <= b.box[0] || b.box[2] <= a.box[0] || a.box[3] <= b.box[1] || b.box[3] <= a.box[1]) continue;
      if (!overlaps(hulls[i], hulls[j])) continue;
      let c = -planeSide(a, b, eye);
      if (!c) c = planeSide(b, a, eye);
      if (!c) c = -overlapSide(a, b, cam.distance);
      if (!c) continue;
      if (c < 0) { after[i].push(j); indeg[j]++; } else { after[j].push(i); indeg[i]++; }
    }
  }
  const order: number[] = [];
  const done = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    let pick = -1;
    for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0 && (pick < 0 || panels[i].depth > panels[pick].depth)) pick = i;
    if (pick < 0) for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || panels[i].depth > panels[pick].depth)) pick = i;
    done[pick] = 1;
    order.push(pick);
    for (const j of after[pick]) indeg[j]--;
  }
  return order;
}

/** Everything a frame needs before drawing: faces in world and screen space, which creases are flat, panels and their paint order. */
export interface Layout {
  W: Mat[];
  pts: Vec3[][];
  scr: P2[][];
  flat: Uint8Array;
  panels: Panel[];
  /** Panel indices, back to front. */
  order: number[];
}

export function layoutFrame(m: Folded, frame: Frame, cam: Camera = defaultCamera): Layout {
  const nF = m.faces.length;
  const M = poseMatrix(frame.pose);
  const D = cam.distance;
  const eye: Vec3 = [0, 0, D];

  // Faces in world space.
  const W: Mat[] = new Array(nF);
  const pts: Vec3[][] = new Array(nF);
  const scr: P2[][] = new Array(nF);
  const nModel: Vec3[] = new Array(nF);
  for (let f = 0; f < nF; f++) {
    const T = frame.T[f];
    nModel[f] = [T[2], T[6], T[10]];
    W[f] = mul(M, mul(translate(0, 0, frame.z[f]), T));
    pts[f] = m.faces[f].map((v) => apply(W[f], m.verts[v][0], m.verts[v][1], 0));
    scr[f] = pts[f].map(([x, y, z]) => { const k = D / (D - z); return [x * k, -y * k] as P2; });
  }

  // Crease states and panels.
  const parent = Int32Array.from({ length: nF }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const flat = new Uint8Array(m.edges.length);
  m.edges.forEach((e, i) => {
    if (e.faces.length !== 2) return;
    const [f, g] = e.faces;
    if (dot(nModel[f], nModel[g]) > 1 - 1e-9) {
      flat[i] = 1;
      if (Math.abs(frame.z[f] - frame.z[g]) < 1e-9) parent[find(f)] = find(g);
    }
  });
  const groups = new Map<number, number[]>();
  for (let f = 0; f < nF; f++) {
    const k = find(f);
    const g = groups.get(k);
    if (g) g.push(f); else groups.set(k, [f]);
  }
  const panels: Panel[] = [];
  for (const faces of groups.values()) {
    const P: Vec3[] = [], S: P2[] = [];
    const center: Vec3 = [0, 0, 0];
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const f of faces) {
      for (let i = 0; i < pts[f].length; i++) {
        P.push(pts[f][i]); S.push(scr[f][i]);
        const [x, y] = scr[f][i];
        if (x < box[0]) box[0] = x; if (x > box[2]) box[2] = x;
        if (y < box[1]) box[1] = y; if (y > box[3]) box[3] = y;
      }
    }
    for (const p of P) { center[0] += p[0] / P.length; center[1] += p[1] / P.length; center[2] += p[2] / P.length; }
    const w = W[faces[0]];
    const d = sub(eye, center);
    panels.push({ faces, pts: P, scr: S, polys: faces.map((f) => ccw(scr[f].slice())), normal: normalize([w[2], w[6], w[10]]), center, depth: Math.hypot(d[0], d[1], d[2]), box });
  }

  return { W, pts, scr, flat, panels, order: paintOrder(panels, cam) };
}

const SVG = 'http://www.w3.org/2000/svg';
const r = (v: number) => Math.round(v * 1000) / 1000;

interface Slot {
  fill: SVGPathElement;
  tex: SVGPathElement;
  pattern: SVGPatternElement;
  lines: SVGGElement;
  mem: SVGPathElement;
  act: SVGPathElement;
  edge: SVGPathElement;
  cache: string[];
}

/**
 * Draws one frame into an <svg> group. Looks are pure CSS: the scene supplies
 * geometry, which side of the paper is showing (`.front` / `.back`), a light
 * percentage per panel (`--f`), and an optional paper texture.
 */
export class SvgScene {
  private slots: Slot[] = [];
  private defs: SVGDefsElement;
  private image: SVGImageElement;
  private uid = Math.random().toString(36).slice(2, 8);

  constructor(private root: SVGGElement, private m: Folded, private cam: Camera = defaultCamera) {
    root.textContent = '';
    this.defs = document.createElementNS(SVG, 'defs');
    this.image = document.createElementNS(SVG, 'image');
    this.image.id = `${this.uid}-img`;
    for (const [k, v] of [['width', '2'], ['height', '2'], ['preserveAspectRatio', 'none']]) this.image.setAttribute(k, v);
    this.defs.appendChild(this.image);
    root.appendChild(this.defs);
  }

  /** Paper grain image (data: or blob: URL), mapped onto the sheet. */
  setTexture(href: string): void {
    this.image.setAttribute('href', href);
  }

  private slot(i: number): Slot {
    let s = this.slots[i];
    if (s) return s;
    const el = <K extends keyof SVGElementTagNameMap>(tag: K, cls?: string) => {
      const n = document.createElementNS(SVG, tag);
      if (cls) n.setAttribute('class', cls);
      return n;
    };
    const pattern = el('pattern');
    pattern.id = `${this.uid}-t${i}`;
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('width', '2');
    pattern.setAttribute('height', '2');
    const use = el('use');
    use.setAttribute('href', `#${this.uid}-img`);
    pattern.appendChild(use);
    this.defs.appendChild(pattern);
    const fill = el('path', 'f');
    const tex = el('path', 't');
    tex.style.fill = `url(#${pattern.id})`;
    const lines = el('g');
    const mem = lines.appendChild(el('path', 'm'));
    const act = lines.appendChild(el('path', 'a'));
    const edge = lines.appendChild(el('path', 'e'));
    this.root.append(fill, tex, lines);
    s = { fill, tex, pattern, lines, mem, act, edge, cache: ['', '', '', '', '', '', '', ''] };
    this.slots[i] = s;
    return s;
  }

  render(frame: Frame): void {
    const m = this.m;
    const D = this.cam.distance;
    const eye: Vec3 = [0, 0, D];
    const { W, scr, flat, panels, order } = layoutFrame(m, frame, this.cam);
    const k = frame.step;
    for (let i = 0; i < order.length; i++) {
      const p = panels[order[i]];
      const s = this.slot(i);
      let fill = '', mem = '', act = '', edge = '';
      for (const f of p.faces) {
        const poly = scr[f];
        for (let v = 0; v < poly.length; v++) fill += (v ? 'L' : 'M') + r(poly[v][0]) + ' ' + r(poly[v][1]);
        fill += 'Z';
        m.faceEdges[f].forEach((e, v) => {
          const a = poly[v], b = poly[(v + 1) % poly.length];
          const seg = `M${r(a[0])} ${r(a[1])}L${r(b[0])} ${r(b[1])}`;
          const E = m.edges[e];
          if (E.faces.length < 2 || !flat[e]) edge += seg;
          else {
            const g = E.faces[0] === f ? E.faces[1] : E.faces[0];
            if (E.born <= k) mem += seg;
            if (frame.group[f] !== frame.group[g]) act += seg;
          }
        });
      }
      const w = W[p.faces[0]];
      const front = dot(p.normal, sub(eye, p.center)) > 0;
      const vis: Vec3 = front ? p.normal : [-p.normal[0], -p.normal[1], -p.normal[2]];
      const light = Math.max(0, dot(vis, this.cam.light));
      const side = front ? 'f' : 'b';
      const tone = `color-mix(in oklab,var(--_l${side}) ${Math.round((0.15 + 0.85 * light) * 100)}%,var(--_s${side}))`;
      const cls = front ? 'front' : 'back';
      const fv = m.faces[p.faces[0]];
      let cx = 0, cy = 0;
      for (const v of fv) { cx += m.verts[v][0] / fv.length; cy += m.verts[v][1] / fv.length; }
      const tex = textureMatrix(w, D, cx, cy);
      const c = s.cache;
      if (c[0] !== fill) { s.fill.setAttribute('d', (c[0] = fill)); s.tex.setAttribute('d', fill); }
      if (c[1] !== mem) s.mem.setAttribute('d', (c[1] = mem));
      if (c[2] !== act) s.act.setAttribute('d', (c[2] = act));
      if (c[3] !== edge) s.edge.setAttribute('d', (c[3] = edge));
      if (c[4] !== tone) s.fill.style.setProperty('--f', (c[4] = tone));
      if (c[5] !== cls) s.lines.setAttribute('class', (c[5] = cls));
      if (c[6] !== tex) s.pattern.setAttribute('patternTransform', (c[6] = tex));
      if (c[7] !== '1') { c[7] = '1'; s.fill.style.display = s.tex.style.display = s.lines.style.display = ''; }
    }
    for (let i = order.length; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s.cache[7] !== '0') { s.cache[7] = '0'; s.fill.style.display = s.tex.style.display = s.lines.style.display = 'none'; }
    }
    this.root.style.opacity = String(r(frame.pose.o));
  }
}

/**
 * Affine map from texture space (the sheet, u = x + 1, v = 1 − y, 2×2 units)
 * to the screen, linearised around sheet point (cx, cy) of this panel.
 */
function textureMatrix(w: Mat, D: number, cx: number, cy: number): string {
  const pr = (x: number, y: number): P2 => {
    const [X, Y, Z] = apply(w, x, y, 0);
    const k = D / (D - Z);
    return [X * k, -Y * k];
  };
  const h = 0.25;
  const o = pr(cx, cy), px = pr(cx + h, cy), py = pr(cx, cy + h);
  // ∂/∂u = ∂/∂x and ∂/∂v = −∂/∂y
  const a = (px[0] - o[0]) / h, b = (px[1] - o[1]) / h;
  const c = -(py[0] - o[0]) / h, d = -(py[1] - o[1]) / h;
  const u = cx + 1, v = 1 - cy;
  const e = o[0] - a * u - c * v, f = o[1] - b * u - d * v;
  return `matrix(${[a, b, c, d, e, f].map((n) => Math.round(n * 1e4) / 1e4).join(' ')})`;
}
