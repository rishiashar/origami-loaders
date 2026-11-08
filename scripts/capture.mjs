// Capture review material from the built demo (run `npm run build` first).
//   node scripts/capture.mjs [--out captures] [--big] [--times 0,1.5,3] [--frames 8] [--no-video]
// Outputs: grid-<n>.png (paused frames via seek()), demo.mp4, demo.gif.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

// Playwright is not a dependency; resolve it via require so NODE_PATH installs work too (ESM import ignores NODE_PATH).
const { chromium } = createRequire(import.meta.url)('playwright');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const o = { out: 'captures', big: false, times: null, frames: 8, video: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = argv[++i];
    else if (a === '--big') o.big = true;
    else if (a === '--times') o.times = argv[++i].split(',').map(Number);
    else if (a === '--frames') o.frames = Number(argv[++i]);
    else if (a === '--no-video') o.video = false;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (o.times && o.times.some(Number.isNaN)) throw new Error('--times must be comma-separated numbers (seconds)');
  if (!Number.isInteger(o.frames) || o.frames < 1) throw new Error('--frames must be a positive integer');
  return o;
}

const opts = parseArgs(process.argv.slice(2));
const outDir = resolve(opts.out);
const page_url = pathToFileURL(join(root, 'demo/dist/index.html')).href;
if (!existsSync(join(root, 'demo/dist/index.html'))) {
  console.error('demo/dist/index.html not found. Run `npm run build` first.');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const targetSelector = opts.big ? '#stage' : '#grid';
const SIZE = { width: 1280, height: 720 };
const produced = [];

async function load(page) {
  await page.goto(page_url);
  await page.waitForFunction(() => customElements.get('origami-loader'), null, { timeout: 10000 });
  await page.evaluate(() => customElements.whenDefined('origami-loader'));
  await page.locator(targetSelector).scrollIntoViewIfNeeded();
  await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center' }), targetSelector);
}

const raf2 = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

const browser = await chromium.launch();
try {
  // 1. Screenshots at fixed moments.
  const shotCtx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
  const page = await shotCtx.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('console error:', m.text()));
  await load(page);

  const duration = await page.evaluate(() => document.querySelector('origami-loader').duration);
  if (!(duration > 0)) throw new Error(`Unexpected el.duration: ${duration}`);
  console.log(`duration: ${duration}s`);

  const times = opts.times ?? Array.from({ length: opts.frames }, (_, i) => ((i + 0.5) / opts.frames) * duration);
  await page.evaluate(() => document.querySelectorAll('origami-loader').forEach((el) => el.setAttribute('paused', '')));
  for (const [n, t] of times.entries()) {
    await page.evaluate((s) => document.querySelectorAll('origami-loader').forEach((el) => el.seek(s)), t);
    await raf2(page);
    const file = join(outDir, `grid-${n + 1}.png`);
    await page.locator(targetSelector).screenshot({ path: file });
    produced.push(`${file}  (t=${t.toFixed(2)}s)`);
  }
  await shotCtx.close();

  // 2. Video of live playback.
  if (opts.video) {
    const tmp = mkdtempSync(join(tmpdir(), 'ol-video-'));
    const ctx = await browser.newContext({ viewport: SIZE, recordVideo: { dir: tmp, size: SIZE } });
    const vpage = await ctx.newPage();
    await load(vpage);
    await vpage.waitForTimeout((duration + 1) * 1000);
    const video = vpage.video();
    await ctx.close(); // flushes the webm
    const webm = await video.path();

    const mp4 = join(outDir, 'demo.mp4');
    const gif = join(outDir, 'demo.gif');
    const ff = (args) => execFileSync('/usr/bin/ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
    ff(['-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', mp4]);
    ff([
      '-i', webm,
      '-vf', 'fps=15,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse',
      gif,
    ]);
    rmSync(tmp, { recursive: true, force: true });
    produced.push(mp4, gif);
  }
} finally {
  await browser.close();
}

console.log('\nProduced:');
for (const p of produced) console.log('  ' + p);
