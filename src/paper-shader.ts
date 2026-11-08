/**
 * Paper grain from Paper Shaders' paper-texture shader (https://shaders.paper.design,
 * Apache-2.0), rendered once on a hidden WebGL canvas and baked into an image.
 *
 * The shader paints paper in a flat mid-grey; everything lighter or darker than
 * that grey is relief (fibres, tooth, a few soft wrinkles). That difference is
 * re-encoded as white or black with alpha, so the grain lays over whatever
 * colour and lighting the look gives each face.
 */
import {
  ShaderFitOptions,
  ShaderMount,
  defaultPatternSizing,
  getShaderColorFromString,
  getShaderNoiseTexture,
  paperTextureFragmentShader,
} from '@paper-design/shaders';

/** Average strength of the baked grain, in alpha levels (0–255). */
const STRENGTH = 15;

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export async function renderPaperShader(size: number): Promise<string | undefined> {
  if (typeof document === 'undefined' || typeof requestAnimationFrame !== 'function') return undefined;
  const noise = getShaderNoiseTexture();
  if (!noise) return undefined;
  await noise.decode();

  // In the viewport (the mount pauses off-screen) but invisible and inert.
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;opacity:0;pointer-events:none;z-index:-1;contain:strict`;
  document.body.appendChild(host);
  let mount: ShaderMount | undefined;
  try {
    const s = defaultPatternSizing;
    mount = new ShaderMount(host, paperTextureFragmentShader, {
      u_image: undefined, u_isImage: false, u_imageAspectRatio: 1,
      u_colorBack: getShaderColorFromString('#808080'),
      u_colorPaper: getShaderColorFromString('#808080'),
      u_colorShadow: getShaderColorFromString('#000000'),
      u_blending: 0, u_distortion: 0, u_clip: false,
      u_angle: 135, u_seed: 7,
      u_roughness: 0.12, u_roughnessSize: 0.15, u_roughnessRows: 0,
      u_fiber: 0.95, u_fiberSize: 0.55,
      u_folds: 0, u_foldSizeX: 0.5, u_foldSizeY: 0.5, u_foldOffsetX: 0, u_foldOffsetY: 0,
      u_wrinkles: 0.06, u_wrinkleSize: 0.6,
      u_crumples: 0, u_crumpleCount: 5, u_drops: 0,
      u_noiseTexture: noise,
      u_fit: ShaderFitOptions[s.fit], u_scale: 1, u_rotation: 0,
      u_originX: s.originX, u_originY: s.originY, u_offsetX: 0, u_offsetY: 0,
      u_worldWidth: s.worldWidth, u_worldHeight: s.worldHeight,
    } as never, { preserveDrawingBuffer: true, antialias: false }, 0, 0, 1, size * size);

    const src = mount.canvasElement;
    for (let i = 0; i < 10 && (src.width === 0 || src.height === 0); i++) await frame();
    await frame();
    await frame();

    const out = document.createElement('canvas');
    out.width = out.height = size;
    const ctx = out.getContext('2d');
    if (!ctx || !src.width) return undefined;
    ctx.drawImage(src, 0, 0, size, size);
    const img = ctx.getImageData(0, 0, size, size);
    const px = img.data;
    const n = px.length / 4;
    const lum = new Float32Array(n);
    let mean = 0;
    for (let i = 0; i < n; i++) { lum[i] = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3; mean += lum[i] / n; }
    let spread = 0;
    for (let i = 0; i < n; i++) spread += Math.abs(lum[i] - mean) / n;
    // A blank or unreadable canvas (no WebGL, blocked readback) means: use the fallback.
    if (spread < 0.5) return undefined;
    // Centre on the sheet's own average so the grain never tints the paper, only textures it.
    const gain = STRENGTH / spread;
    for (let i = 0; i < n; i++) {
      const v = (lum[i] - mean) * gain;
      px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v > 0 ? 255 : 0;
      px[i * 4 + 3] = Math.min(255, Math.abs(v));
    }
    ctx.putImageData(img, 0, 0);
    return await new Promise<string>((resolve) =>
      out.toBlob((b) => resolve(b ? URL.createObjectURL(b) : out.toDataURL('image/png')), 'image/png'),
    );
  } catch {
    return undefined;
  } finally {
    mount?.dispose();
    host.remove();
  }
}
