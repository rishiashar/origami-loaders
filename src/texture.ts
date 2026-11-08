/**
 * Paper grain, generated once per page and shared by every loader.
 *
 * First choice is Paper Shaders' paper-texture shader (WebGL, loaded lazily
 * from its own chunk, see paper-shader.ts). Where WebGL is unavailable, a tiny
 * CPU "shader" pass builds a height field — fine tooth plus pressed-in
 * fibres — lights its bumps like a relief, adds low-frequency cloudiness (the
 * uneven density of real paper), and bakes it into an image of light/dark
 * grain with alpha. The scene maps that image onto every face in sheet space,
 * so the grain is stuck to the paper and folds with it.
 *
 * Texture resolution follows the loader's on-screen size so the grain stays
 * about the same size in device pixels and never shimmers when it moves.
 */

const cache = new Map<string, Promise<string>>();

/** Texture edge length in pixels for a sheet drawn `sheetPx` device pixels wide. */
export const textureSize = (sheetPx: number) => (sheetPx <= 220 ? 256 : sheetPx <= 460 ? 512 : 1024);

export type TextureKind = 'paper' | 'grain';

export function paperTexture(size: number, kind: TextureKind = 'paper'): Promise<string> {
  const key = `${kind}:${size}`;
  let p = cache.get(key);
  if (!p) {
    const cpu = () => new Promise<string>((resolve) => setTimeout(() => generate(size, resolve), 0));
    p = kind === 'grain' ? cpu() : import('./paper-shader')
      .then((m) => m.renderPaperShader(size))
      .catch(() => undefined)
      .then((href) => href ?? cpu());
    cache.set(key, p);
  }
  return p;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise sampled over the whole texture with `cells` lattice cells per side. */
function valueNoise(size: number, cells: number, rand: () => number): Float32Array {
  const n = cells + 1;
  const lattice = new Float32Array(n * n);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
  const out = new Float32Array(size * size);
  const k = cells / size;
  for (let y = 0; y < size; y++) {
    const gy = y * k, iy = gy | 0, fy = gy - iy, sy = fy * fy * (3 - 2 * fy);
    for (let x = 0; x < size; x++) {
      const gx = x * k, ix = gx | 0, fx = gx - ix, sx = fx * fx * (3 - 2 * fx);
      const i = iy * n + ix;
      const top = lattice[i] + (lattice[i + 1] - lattice[i]) * sx;
      const bot = lattice[i + n] + (lattice[i + n + 1] - lattice[i + n]) * sx;
      out[y * size + x] = top + (bot - top) * sy;
    }
  }
  return out;
}

function generate(size: number, done: (href: string) => void): void {
  if (typeof document === 'undefined') return done('');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return done('');
  const rand = mulberry32(0x0f01d);
  const s = size / 512;
  const N = size * size;

  // Fibres: short, slightly curved strands, rasterised by the canvas.
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.lineCap = 'round';
  const fibres = Math.round(420 * s * s);
  for (let i = 0; i < fibres; i++) {
    const x = rand() * size, y = rand() * size, a = rand() * Math.PI;
    const len = (6 + rand() * rand() * 70) * s, bend = (rand() - 0.5) * len * 0.9;
    const cx = Math.cos(a), sy = Math.sin(a);
    ctx.strokeStyle = `rgba(255,255,255,${0.12 + rand() * 0.4})`;
    ctx.lineWidth = (0.5 + rand() * 1.2) * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (cx * len) / 2 - sy * bend, y + (sy * len) / 2 + cx * bend, x + cx * len, y + sy * len);
    ctx.stroke();
  }
  const fibre = ctx.getImageData(0, 0, size, size).data;

  // Tooth: blurred white noise plus fine value noise.
  const white = new Float32Array(N);
  for (let i = 0; i < N; i++) white[i] = rand();
  const fine = valueNoise(size, Math.round(110 * s), rand);
  const height = new Float32Array(N);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let b = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = Math.min(size - 1, Math.max(0, y + dy)) * size;
        for (let dx = -1; dx <= 1; dx++) b += white[yy + Math.min(size - 1, Math.max(0, x + dx))];
      }
      const i = y * size + x;
      height[i] = (b / 9) * 0.55 + fine[i] * 0.45 + (fibre[i * 4] / 255) * 0.9;
    }
  }

  // Cloudiness: a few octaves of soft noise.
  const o1 = valueNoise(size, 3, rand), o2 = valueNoise(size, 7, rand), o3 = valueNoise(size, 16, rand);

  // Light the relief from the upper left, combine, and encode as light/dark grain.
  const img = ctx.createImageData(size, size);
  const px = img.data;
  const lx = -0.62, ly = -0.78;
  for (let y = 0; y < size; y++) {
    const up = Math.max(0, y - 1) * size, dn = Math.min(size - 1, y + 1) * size;
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const l = Math.max(0, x - 1), r = Math.min(size - 1, x + 1);
      const gx = height[y * size + r] - height[y * size + l];
      const gy = height[dn + x] - height[up + x];
      const relief = -(gx * lx + gy * ly) * 0.55;
      const cloud = (o1[i] * 0.5 + o2[i] * 0.3 + o3[i] * 0.2 - 0.5) * 0.16;
      const strand = (fibre[i * 4] / 255) * 0.05;
      const v = relief + cloud + strand;
      const a = Math.min(1, Math.abs(v)) * 255;
      const c = v > 0 ? 255 : 0;
      px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = c;
      px[i * 4 + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  // A blob URL keeps half a megabyte of base64 out of every loader's DOM.
  if (canvas.toBlob && typeof URL !== 'undefined' && URL.createObjectURL) {
    canvas.toBlob((blob) => done(blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png')), 'image/png');
  } else {
    done(canvas.toDataURL('image/png'));
  }
}
