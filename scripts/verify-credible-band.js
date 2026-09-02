#!/usr/bin/env node
/* ============================================================
   verify-credible-band.js

   The hero legend claims a 95% credible band. This checks that the
   claim is true, and tells you what Z95 should be if you have changed
   the process.

     node scripts/verify-credible-band.js            # ~5s
     node scripts/verify-credible-band.js --samples 20000000

   It does not re-implement the model. It reads js/glass.js, pulls out
   the two blocks between the `verified:` markers, and runs that exact
   code — so if the drawing and the check ever disagree, this fails.

   What it checks:

     - The weights are normalised so Var[noise(x)] = 1 at every x. The
       whole construction rests on this: it is what makes the marginal
       at each x a known distribution, which is what lets the band be
       analytic instead of a shape traced around the outermost paths.
     - The 95% interval of that marginal, by Monte Carlo, against the
       Z95 the page ships. The process is NOT Gaussian — a sum of K
       random-phase cosines is platykurtic — so this is deliberately
       not 1.95996.
     - Actual coverage: the fraction of sample-path points that land
       inside the band as drawn, which is the claim a visitor reads.
     - That the line labelled "posterior mean" is the model's mean and
       not just one more draw.

   Exits non-zero if any of them is off, so it can gate a commit.

   Requires node (no packages). The uv/Python toolchain in this repo is
   only for the dev server and is not involved here.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const GLASS = path.join(__dirname, '..', 'js', 'glass.js');

// Tolerances. Monte Carlo noise at the default sample count is well
// under these; anything larger means the model actually changed.
const TOL_VAR = 0.02;      // |Var[noise] - 1|
const TOL_Z = 0.004;       // |shipped Z95 - measured|
const TOL_COVER = 0.15;    // |coverage - 95| in percentage points

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : fallback;
};
const SAMPLES = argOf('--samples', 4000000);
const PATHS_MC = argOf('--paths', 20000);

/* ---------- pull the shipped model out of glass.js ---------- */

function block(src, begin) {
  const a = src.indexOf(begin);
  if (a < 0) throw new Error(`marker ${begin} not found in js/glass.js`);
  // Both markers sit inside comments, so start after the opening
  // comment closes and stop where the closing one opens.
  const from = src.indexOf('*/', a) + 2;
  const b = src.indexOf('verified:end', from);
  if (b < 0) throw new Error(`no verified:end after ${begin} in js/glass.js`);
  return src.slice(from, src.lastIndexOf('/*', b));
}

const src = fs.readFileSync(GLASS, 'utf8');
const consts = block(src, 'verified:constants');
const model = block(src, 'verified:model');

// PATHS is declared in the constants block; override it so the Monte
// Carlo can draw far more paths than the seven the page renders.
const body = consts.replace(/const PATHS\s*=\s*\d+;/, 'const PATHS = PATHS_MC;') +
  '\n' + model + '\n' +
  'return { NOW, PATHS, K, SIG_OBS, SIG_FAR, Z95, W, FREQ, mean, sigma, noise, samplePath, bandEdge };';

let m;
try {
  m = new Function('PATHS_MC', '"use strict";' + body)(PATHS_MC);
} catch (e) {
  console.error('Could not evaluate the extracted model:', e.message);
  process.exit(2);
}

const fail = [];
const mark = (ok) => (ok ? 'ok  ' : 'FAIL');

console.log(`model: K=${m.K}  Z95=${m.Z95}  sigma ${m.SIG_OBS} -> ${m.SIG_FAR}  now=${m.NOW}`);
console.log(`monte carlo: ${SAMPLES.toLocaleString()} samples, ${PATHS_MC.toLocaleString()} paths\n`);

/* ---------- 1. the variance identity ---------- */

const sumW2 = m.W.reduce((a, w) => a + w * w, 0);
console.log('1. weight normalisation');
console.log(`   sum(W^2) = ${sumW2.toFixed(9)}  (must be 2, so that Var = 1)  ${mark(Math.abs(sumW2 - 2) < 1e-9)}`);
if (Math.abs(sumW2 - 2) > 1e-9) fail.push('weights are not normalised to sum(W^2) = 2');

console.log('\n2. Var[noise(x)] across the canvas (target 1)');
for (const x of [0, 0.25, 0.5, 0.75, 1]) {
  let s = 0, s2 = 0;
  for (let p = 0; p < PATHS_MC; p++) { const v = m.noise(x, 0.7, p); s += v; s2 += v * v; }
  const mu = s / PATHS_MC;
  const va = s2 / PATHS_MC - mu * mu;
  const ok = Math.abs(va - 1) < TOL_VAR;
  console.log(`   x=${x.toFixed(2)}  mean=${mu.toFixed(5)}  var=${va.toFixed(6)}  ${mark(ok)}`);
  if (!ok) fail.push(`Var[noise(${x})] = ${va.toFixed(4)}, expected 1`);
}

/* ---------- 2. the marginal's own 95% interval ---------- */

console.log('\n3. marginal of the noise process');
const s = new Float64Array(SAMPLES);
for (let i = 0; i < SAMPLES; i++) {
  let v = 0;
  for (let k = 0; k < m.K; k++) v += m.W[k] * Math.cos(Math.random() * 2 * Math.PI);
  s[i] = v;
}
s.sort();
let mu = 0, m2 = 0, m4 = 0;
for (const v of s) { mu += v; m2 += v * v; }
mu /= SAMPLES;
m2 = m2 / SAMPLES - mu * mu;
for (const v of s) m4 += (v - mu) ** 4;
const kurt = m4 / SAMPLES / (m2 * m2);
const q = (p) => s[Math.floor(p * SAMPLES)];
const measured = (q(0.975) - q(0.025)) / 2;
const zOk = Math.abs(measured - m.Z95) < TOL_Z;

console.log(`   sd        = ${Math.sqrt(m2).toFixed(6)}`);
console.log(`   kurtosis  = ${kurt.toFixed(4)}   (3 = Gaussian; below it means shorter tails)`);
console.log(`   q(2.5%)   = ${q(0.025).toFixed(5)}`);
console.log(`   q(97.5%)  = ${q(0.975).toFixed(5)}`);
console.log(`   half-width= ${measured.toFixed(5)}   vs shipped Z95 ${m.Z95}   ${mark(zOk)}`);
console.log(`   (a Gaussian would want 1.95996 — using it here would be wrong by ` +
            `${(((1.959964 / measured) - 1) * 100).toFixed(2)}%)`);
if (!zOk) fail.push(`Z95 should be ${measured.toFixed(4)}, glass.js ships ${m.Z95}`);

/* ---------- 3. coverage of the band as drawn ---------- */

console.log('\n4. coverage of the band as drawn (target 95%)');
const up = m.bandEdge(+1), lo = m.bandEdge(-1);
let total = 0, inside = 0;
for (const t of [0, 0.9, 3.4, 12.7, 41.2]) {
  let tin = 0, ttot = 0;
  for (let i = 0; i <= 120; i++) {
    const x = i / 120;
    const u = up(x, t), l = lo(x, t);
    for (let p = 0; p < PATHS_MC; p++) {
      const v = m.samplePath(p)(x, t);
      ttot++;
      if (v >= l && v <= u) tin++;
    }
  }
  total += ttot;
  inside += tin;
  console.log(`   t=${String(t).padStart(5)}   ${(100 * tin / ttot).toFixed(3)}%`);
}
const coverage = 100 * inside / total;
const covOk = Math.abs(coverage - 95) < TOL_COVER;
console.log(`   overall   ${coverage.toFixed(3)}%   over ${(total / 1e6).toFixed(1)}M points  ${mark(covOk)}`);
if (!covOk) fail.push(`band covers ${coverage.toFixed(2)}% of the paths, not 95%`);

/* ---------- 4. the mean line is the mean, not a draw ---------- */

let worst = 0;
for (let i = 0; i <= 60; i++) {
  const x = i / 60;
  let acc = 0;
  for (let p = 0; p < PATHS_MC; p++) acc += m.samplePath(p)(x, 2.2);
  worst = Math.max(worst, Math.abs(acc / PATHS_MC - m.mean(x, 2.2)));
}
const meanOk = worst < 0.02;
console.log(`\n5. drawn mean line vs empirical mean of the paths`);
console.log(`   max |difference| = ${worst.toFixed(5)}  ${mark(meanOk)}`);
if (!meanOk) fail.push(`the mean line is off the paths' mean by ${worst.toFixed(4)}`);

/* ---------- verdict ---------- */

if (fail.length) {
  console.log('\nFAILED:');
  for (const f of fail) console.log('  - ' + f);
  console.log('\nIf you changed K, FREQ or the weighting on purpose, update Z95 in');
  console.log('js/glass.js to the half-width printed above and run this again.');
  process.exit(1);
}
console.log('\nAll checks passed — the legend\'s "95% credible band" is accurate.');
