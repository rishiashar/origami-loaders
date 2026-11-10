#!/usr/bin/env node
// Check a model file with the fold check, and list the steps its lesson will teach.
//
//   node check.mjs origami/tulip.ts [--build buildTulip]
//
// The model is a TypeScript (or JavaScript) file in a project that has origami-loaders
// installed. It exports one or more build functions (buildTulip, ...) that return
// `F.compile()`. Exit code 0 means every build function passed; 1 means at least one did not.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--build');
const only = args.includes('--build') ? args[args.indexOf('--build') + 1] : undefined;
if (!file) {
  console.error('usage: node check.mjs <model.ts> [--build buildName]');
  process.exit(2);
}
const path = resolve(file);
if (!existsSync(path)) {
  console.error(`No such file: ${path}`);
  process.exit(2);
}

// The package, resolved from the model's own project, not from wherever this skill is installed.
const req = createRequire(path);
let checkPath, mainPath;
try {
  checkPath = req.resolve('origami-loaders/check');
  mainPath = req.resolve('origami-loaders');
} catch {
  console.error('origami-loaders 0.2.0 or later is not installed in this project. Run: npm i origami-loaders');
  process.exit(2);
}

let model;
try {
  model = await import(pathToFileURL(path).href);
} catch (e) {
  // Node 22.6 to 22.17 can run TypeScript only behind a flag: run again with it.
  if (e?.code === 'ERR_UNKNOWN_FILE_EXTENSION' && !process.execArgv.includes('--experimental-strip-types')) {
    const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', ...process.argv.slice(1)], { stdio: 'inherit' });
    process.exit(r.status ?? 1);
  }
  console.error(`Could not load ${file}: ${e?.message ?? e}`);
  if (e?.code === 'ERR_UNKNOWN_FILE_EXTENSION') console.error('Running a .ts file needs Node 22.6 or later.');
  if (/Cannot find module '\.{1,2}\//.test(e?.message ?? '')) console.error('Keep the model in one file, or import its helpers with their .ts extension.');
  process.exit(2);
}

const { inspect, describeIssues } = await import(pathToFileURL(checkPath).href);
const { Player, lessonSteps } = await import(pathToFileURL(mainPath).href);

const builds = Object.entries(model).filter(([k, v]) => typeof v === 'function' && (only ? k === only : /^build/.test(k) || k === 'default'));
if (!builds.length) {
  console.error(only ? `${file} has no export named ${only}.` : `${file} exports no build function. Export one named build<Model>() that returns F.compile().`);
  process.exit(2);
}

let failed = false;
for (const [name, build] of builds) {
  const t0 = performance.now();
  let m;
  try {
    m = build();
  } catch (e) {
    console.log(`✗ ${name}: the engine stopped while folding: ${e?.message ?? e}`);
    failed = true;
    continue;
  }
  const ms = performance.now() - t0;
  const issues = inspect(m);
  const steps = lessonSteps(new Player(m));

  // A step that neither folds, turns nor moves the paper ends the lesson there. Say so if folding goes on after it.
  const warnings = [];
  const lastLesson = steps[steps.length - 1];
  const after = m.steps.findIndex((s, k) => m.starts[k] >= (lastLesson?.end ?? 0) - 1e-9 && s.joints.length > 0 && !s.path && s.phase !== 'outro');
  if (after >= 0) {
    const stop = m.steps.findIndex((s, k) => m.starts[k] >= (lastLesson?.end ?? 0) - 1e-9);
    warnings.push(`the lesson stops at step ${stop} "${m.steps[stop].label}" (it neither folds nor turns the paper, or moves along a path), but step ${after} "${m.steps[after].label}" folds after it. Give that step a pose change, or fold in it, or move it after the folding.`);
  }
  const unlabelled = m.steps.filter((s) => !s.label?.trim());
  if (unlabelled.length) warnings.push(`${unlabelled.length} step(s) have no label; the lesson shows each label as the instruction.`);

  console.log(`${issues.length ? '✗' : '✓'} ${name}: ${m.steps.length} steps, ${m.faces.length} faces, ${m.duration.toFixed(1)} s a loop, folded in ${ms.toFixed(0)} ms`);
  if (issues.length) {
    failed = true;
    console.log(describeIssues(basename(file), issues).split('\n').map((l) => `  ${l}`).join('\n'));
  }
  for (const w of warnings) console.log(`  ! ${w}`);
  console.log(`  Lesson (${steps.length} steps):`);
  for (const s of steps) console.log(`    ${String(s.number).padStart(2)}. ${s.label}`);
}
process.exit(failed ? 1 : 0);
