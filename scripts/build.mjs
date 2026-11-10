// Build the library bundles, type declarations and the self-contained demo page.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...parts) => resolve(root, ...parts);

const shared = {
  entryPoints: [p('src/index.ts')],
  bundle: true,
  minify: true,
  target: 'es2020',
  legalComments: 'none',
  logLevel: 'warning',
};

async function main() {
  rmSync(p('dist'), { recursive: true, force: true });
  rmSync(p('demo/dist'), { recursive: true, force: true });

  // ESM: Paper Shaders' paper texture lands in its own chunk, loaded only when a loader needs grain.
  await build({
    ...shared, format: 'esm', splitting: true, outdir: p('dist'),
    entryNames: 'origami-loaders', chunkNames: 'chunks/[name]-[hash]',
  });
  // The fold check, for people writing their own models: its own bundle, so the loader stays small.
  await build({ ...shared, entryPoints: [p('src/check.ts')], format: 'esm', outfile: p('dist/check.js') });
  await build({
    ...shared,
    format: 'iife',
    globalName: 'OrigamiLoaders',
    outfile: p('dist/origami-loaders.iife.js'),
  });

  // Type declarations only (esbuild does not emit them).
  const tsc = p('node_modules/typescript/bin/tsc');
  execFileSync(process.execPath, [tsc, '-p', p('tsconfig.build.json')], { stdio: 'inherit' });

  // Demo: inline the IIFE bundle into a single self-contained HTML file.
  const iife = readFileSync(p('dist/origami-loaders.iife.js'), 'utf8');
  let html = readFileSync(p('demo/index.html'), 'utf8');
  if (!html.includes('<!-- OL_SCRIPT -->')) throw new Error('demo/index.html is missing <!-- OL_SCRIPT -->');
  // Dev-only tag that loads the bundle from ../dist; the inlined copy replaces it.
  html = html.replace(/[ \t]*<script\b[^>]*\bdata-dev\b[^>]*><\/script>[ \t]*\r?\n?/g, '');
  // Function replacer: bundle contains `$` sequences that must not be interpreted.
  const inline = `<script>\n${iife.replace(/<\/script/gi, '<\\/script')}\n</script>`;
  html = html.replace('<!-- OL_SCRIPT -->', () => inline);
  mkdirSync(p('demo/dist'), { recursive: true });
  writeFileSync(p('demo/dist/index.html'), html);
  // Example backgrounds: ASCII-baked photos and Paper Shaders grain panels.
  cpSync(p('demo/assets'), p('demo/dist/assets'), { recursive: true });

  const esm = readFileSync(p('dist/origami-loaders.js'));
  const unminified = await build({ ...shared, minify: false, format: 'esm', splitting: true, write: false, outdir: 'out' });
  const raw = unminified.outputFiles.find((f) => f.path.endsWith('index.js'))?.contents.length ?? unminified.outputFiles[0].contents.length;
  const gz = gzipSync(esm, { level: 9 }).length;
  const kb = (n) => (n / 1024).toFixed(2) + ' kB';
  console.log(`dist/origami-loaders.js   ${esm.length} B (${kb(esm.length)}) minified (${raw} B unminified), ${gz} B (${kb(gz)}) gzip`);
  for (const f of readdirSync(p('dist/chunks'))) {
    const buf = readFileSync(p('dist/chunks', f));
    console.log(`dist/chunks/${f}   ${(buf.length / 1024).toFixed(2)} kB minified, ${(gzipSync(buf, { level: 9 }).length / 1024).toFixed(2)} kB gzip (loaded on demand)`);
  }
  console.log(`demo: ${p('demo/dist/index.html')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
