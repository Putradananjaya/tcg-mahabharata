#!/usr/bin/env node
/**
 * Checks that the dashboard's TypeScript sandbox engine (src/app/core/engine)
 * reproduces the research simulator. Run: npm run verify:engine
 *
 *   1. wilsonCi matches the Python reference values in tests/test_winrate.py.
 *   2. BOUNDS in research-params.ts matches src/simulator/fitness.py exactly.
 *   3. For SMART_START and data/ga_balanced_params.json, every cell of the 3x3
 *      payoff matrix simulated by the TS engine agrees with the Python engine's
 *      cell in results/exp03_balance_matrix.json (two-proportion z-test, same n).
 *
 * Exits non-zero on any failure. Randomness differs from Python's, so parity
 * is statistical: |z| above the Bonferroni-corrected threshold fails.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BUILD = path.resolve(__dirname, '..', '.engine-build');
const { Match, buildFactionDecks, mulberry32 } = require(path.join(BUILD, 'research-engine.js'));
const { wilsonCi, twoProportionZ } = require(path.join(BUILD, 'stats.js'));
const { BOUNDS } = require(path.join(BUILD, 'research-params.js'));

const SEED = 20260801;
const FACTIONS = ['SATWIKA', 'RAJASIKA', 'TAMASIKA'];
let failures = 0;
const report = (ok, msg) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
};

// 1. Wilson CI reference values (same cases as tests/test_winrate.py).
const WILSON_REFERENCE = [
  [1, 1, 0.2065493143772375, 1.0],
  [50, 100, 0.4038315303659957, 0.5961684696340044],
  [0, 10, 0.0, 0.27753279986288903],
  [9, 10, 0.5958499732047616, 0.982123786904927],
  [740, 783, 0.9268442775862556, 0.9589758481664633],
];
for (const [wins, n, lo, hi] of WILSON_REFERENCE) {
  const ci = wilsonCi(wins, n);
  report(Math.abs(ci.lower - lo) < 1e-12 && Math.abs(ci.upper - hi) < 1e-12,
    `wilsonCi(${wins}, ${n}) = [${ci.lower}, ${ci.upper}] vs Python [${lo}, ${hi}]`);
}

// 2. BOUNDS / SMART_START drift against fitness.py.
const fitnessPy = fs.readFileSync(path.join(ROOT, 'src/simulator/fitness.py'), 'utf8');
function parsePyDict(name, valuePattern) {
  const block = fitnessPy.match(new RegExp(`^${name} = \\{([\\s\\S]*?)^\\}`, 'm'));
  if (!block) throw new Error(`${name} not found in fitness.py`);
  const out = {};
  for (const m of block[1].matchAll(new RegExp(`"(\\w+)":\\s*${valuePattern}`, 'g'))) out[m[1]] = m.slice(2).map(Number);
  return out;
}
const pyBounds = parsePyDict('BOUNDS', '\\((\\d+),\\s*(\\d+)\\)');
const pySmartStart = Object.fromEntries(Object.entries(parsePyDict('SMART_START', '(\\d+)')).map(([k, v]) => [k, v[0]]));
const tsKeys = Object.keys(BOUNDS).sort().join(',');
report(tsKeys === Object.keys(pyBounds).sort().join(','), `BOUNDS keys match fitness.py (${Object.keys(pyBounds).length} dimensions)`);
const mismatched = Object.keys(pyBounds).filter((k) => !BOUNDS[k] || BOUNDS[k][0] !== pyBounds[k][0] || BOUNDS[k][1] !== pyBounds[k][1]);
report(mismatched.length === 0, `BOUNDS ranges match fitness.py${mismatched.length ? ': ' + mismatched.join(', ') : ''}`);

// 3. Engine parity against the Python payoff matrices.
const exp03 = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/exp03_balance_matrix.json'), 'utf8'));
const variants = {
  smart_start: pySmartStart,
  ga_balanced: JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ga_balanced_params.json'), 'utf8')),
};
const cellCount = Object.keys(variants).length * FACTIONS.length * FACTIONS.length;
// Bonferroni for 18 two-sided tests at family-wise alpha 0.05: NormalDist().inv_cdf(1 - 0.05/36).
const Z_LIMIT = 2.991316115183781;

const rng = mulberry32(SEED);
const t0 = Date.now();
for (const [variant, params] of Object.entries(variants)) {
  const decks = buildFactionDecks(params);
  for (const row of FACTIONS) {
    for (const col of FACTIONS) {
      const py = exp03[variant].payoff_matrix[`${row}_vs_${col}`];
      let wins = 0;
      for (let i = 0; i < py.n; i++) {
        const match = new Match(decks[row], decks[col], `${row}__A`, `${col}__B`, rng);
        match.runToEnd();
        if (match.winnerIndex === 0) wins++;
      }
      const z = twoProportionZ(wins, py.n, py.wins, py.n);
      report(Math.abs(z) < Z_LIMIT,
        `${variant.padEnd(11)} ${`${row}_vs_${col}`.padEnd(20)} TS ${(wins / py.n * 100).toFixed(2).padStart(6)}%  ` +
        `Python ${(py.win_rate * 100).toFixed(2).padStart(6)}%  n=${py.n}  z=${z.toFixed(2)}`);
    }
  }
}
console.log(`\n${cellCount} cells simulated in ${((Date.now() - t0) / 1000).toFixed(1)}s (seed ${SEED}, |z| limit ${Z_LIMIT}).`);
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
