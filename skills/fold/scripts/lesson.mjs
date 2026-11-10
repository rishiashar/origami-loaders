#!/usr/bin/env node
// Build a standalone lesson page for a model: one HTML file with the package and the
// model inside it, which opens anywhere (no server, no network) and teaches the fold
// step by step. With --frames, also screenshot every step into a contact sheet.
//
//   node lesson.mjs origami/tulip.ts --name tulip [--out tulip-lesson.html]
//        [--title "Fold a tulip"] [--intro "One square of paper, eight folds."]
//        [--look paper|ink|graphite|blueprint] [--theme light|dark]
//        [--frames frames/]   (needs Playwright: npm i -D playwright)
//
// The model file must be one file whose only imports are from 'origami-loaders'.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const file = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
if (!file) {
  console.error('usage: node lesson.mjs <model.ts> --name <name> [--out page.html] [--title ...] [--intro ...] [--look paper] [--theme light] [--frames dir]');
  process.exit(2);
}
const path = resolve(file);
const name = opt('name', basename(file, extname(file)));
const out = resolve(opt('out', `${name}-lesson.html`));
const look = opt('look', 'paper');
const theme = opt('theme', 'light');
const title = opt('title', `Fold a ${name}`);
const intro = opt('intro', '');
const frames = opt('frames');

const req = createRequire(path);
let iifePath, mainPath;
try {
  iifePath = req.resolve('origami-loaders/iife');
  mainPath = req.resolve('origami-loaders');
} catch {
  console.error('origami-loaders 0.2.0 or later is not installed in this project. Run: npm i origami-loaders');
  process.exit(2);
}

// The model, as JavaScript.
let code = readFileSync(path, 'utf8');
if (/\.(m|c)?ts$/.test(path)) {
  if (typeof stripTypeScriptTypes !== 'function') {
    console.error('Building a lesson from a .ts file needs Node 22.13 or later.');
    process.exit(2);
  }
  // Node marks this experimental and warns on every use; the warning is noise here.
  const warn = process.emitWarning;
  process.emitWarning = () => {};
  code = stripTypeScriptTypes(code);
  process.emitWarning = warn;
}
const imports = [...code.matchAll(/^\s*import\b[^;]*?from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
const foreign = imports.filter((s) => s !== 'origami-loaders');
if (foreign.length) {
  console.error(`The model imports ${foreign.join(', ')}. A lesson page needs a model in one file that imports only from 'origami-loaders'.`);
  process.exit(2);
}

// In the page, 'origami-loaders' is the inlined script-tag build, re-exported as a module.
const pkg = await import(pathToFileURL(mainPath).href);
const names = Object.keys(pkg).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k));
const shim = `const L = globalThis.OrigamiLoaders; export const { ${names.join(', ')} } = L;`;
const dataUrl = (js) => `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
const importMap = { imports: { 'origami-loaders': dataUrl(shim), 'fold-model': dataUrl(code) } };
const iife = readFileSync(iifePath, 'utf8').replace(/<\/script/gi, '<\\/script');
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dark = theme === 'dark';

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: ${dark ? 'dark' : 'light'}; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: ${dark ? '#0f0f11' : '#fafaf8'};
    color: ${dark ? '#f2f2f0' : '#1b1b1d'}; font: 17px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { width: min(30rem, 100% - 2.5rem); padding: 2.5rem 0; }
  h1 { font-size: 1.5rem; margin: 0 0 .3rem; letter-spacing: -.01em; }
  p.intro { margin: 0 0 1.5rem; opacity: .7; }
  origami-lesson { --ol-bg: ${dark ? '#0f0f11' : '#fafaf8'}; }
  footer { margin-top: 2rem; font-size: .8rem; opacity: .5; }
  footer a { color: inherit; }
</style>
<script>${iife}</script>
<script type="importmap">${JSON.stringify(importMap)}</script>
</head>
<body>
<main>
  <h1>${esc(title)}</h1>
  ${intro ? `<p class="intro">${esc(intro)}</p>` : ''}
  <div id="lesson"></div>
  <footer>Use Next or the → key to fold each step, and Replay to watch it again. Folded with <a href="https://origami-loaders.vercel.app">origami-loaders</a>.</footer>
</main>
<script type="module">
  import { registerModel } from 'origami-loaders';
  import * as model from 'fold-model';
  const build = Object.entries(model).find(([k, v]) => typeof v === 'function' && (/^build/.test(k) || k === 'default'));
  if (!build) throw new Error('The model exports no build function.');
  registerModel(${JSON.stringify(name)}, build[1]);
  const lesson = document.createElement('origami-lesson');
  lesson.setAttribute('model', ${JSON.stringify(name)});
  lesson.setAttribute('look', ${JSON.stringify(look)});
  lesson.setAttribute('theme', ${JSON.stringify(theme)});
  document.getElementById('lesson').append(lesson);
  lesson.focus();
</script>
</body>
</html>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Lesson page: ${out} (${(html.length / 1024).toFixed(0)} kB, opens offline)`);

if (frames) await shoot(resolve(frames));

/** Screenshot every step, mid-fold and finished, into frames/ and one contact sheet. */
async function shoot(dir) {
  let chromium;
  // The project's Playwright, then this script's, then a global install.
  const { execSync } = await import('node:child_process');
  let globalRoot = '';
  try { globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim(); } catch {}
  const places = [req, createRequire(import.meta.url), ...(globalRoot ? [createRequire(join(globalRoot, 'noop.js'))] : [])];
  for (const from of places) {
    try { ({ chromium } = from('playwright')); break; } catch {}
  }
  if (!chromium) {
    console.error('Frames need Playwright: npm i -D playwright && npx playwright install chromium');
    process.exit(3);
  }
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 520, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(pathToFileURL(out).href);
  await page.waitForFunction(() => document.querySelector('origami-lesson')?.steps?.length > 0, null, { timeout: 15000 }).catch(() => {});
  if (errors.length) {
    console.error(`The lesson page has errors:\n${errors.join('\n')}`);
    await browser.close();
    process.exit(1);
  }
  const steps = await page.evaluate(() => document.querySelector('origami-lesson').steps);
  // The paper only, at a moment within a step: the lesson's own loader, paused and sought.
  const at = async (t) => page.evaluate((time) => {
    const ld = document.querySelector('origami-lesson').shadowRoot.querySelector('origami-loader');
    ld.setAttribute('paused', '');
    ld.removeAttribute('progress');
    ld.seek(time);
  }, t);
  const stage = page.locator('origami-lesson').locator('[part=stage]');
  const tiles = [];
  for (const s of steps) {
    const tile = { n: s.number, label: s.label, shots: [] };
    const moments = s.number === 1 ? [[1, 'done']] : [[0.5, 'mid-fold'], [1, 'done']];
    for (const [u, what] of moments) {
      await at(s.start + (s.end - s.start) * u - (u === 1 ? 1e-3 : 0));
      await page.waitForTimeout(60);
      const png = join(dir, `step-${String(s.number).padStart(2, '0')}-${what}.png`);
      await stage.screenshot({ path: png });
      tile.shots.push({ what, png });
    }
    tiles.push(tile);
  }
  // The contact sheet: every step in order, its label, mid-fold beside the result.
  const cells = tiles.map((t) => `<figure><div>${t.shots.map((s) => `<img src="${pathToFileURL(s.png).href}" title="${s.what}">`).join('')}</div>
    <figcaption><b>${t.n}.</b> ${esc(t.label)}</figcaption></figure>`).join('');
  const sheet = join(dir, 'contact-sheet.html');
  writeFileSync(sheet, `<!doctype html><meta charset="utf-8"><style>
    body{margin:16px;font:13px system-ui;background:#fff;color:#111;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    figure{margin:0;border:1px solid #ddd;border-radius:8px;padding:6px}figure div{display:flex;gap:4px}
    img{width:calc(50% - 2px);background:#fafaf8;border-radius:4px}figcaption{margin-top:4px}</style>${cells}`);
  const sp = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  await sp.goto(pathToFileURL(sheet).href);
  await sp.waitForTimeout(200);
  await sp.screenshot({ path: join(dir, 'contact-sheet.png'), fullPage: true });
  await browser.close();
  console.log(`Frames: ${dir}/ (${tiles.reduce((n, t) => n + t.shots.length, 0)} pictures). Look at ${join(dir, 'contact-sheet.png')}: every step, mid-fold on the left, done on the right.`);
}
