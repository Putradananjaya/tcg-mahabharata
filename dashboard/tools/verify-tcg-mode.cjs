#!/usr/bin/env node
/**
 * Rules checks for Mode TCG (src/app/core/engine/tcg-mode-engine.ts), a
 * Pokemon-TCG-style prototype that is separate from the research engine.
 * Run: npm run verify:tcg
 *
 *   1. Scenario tests: one targeted check per rule (energy cost, first-turn
 *      attack ban, 1 energy per turn, retreat cost, energy not consumed, KO ->
 *      discard + prize to hand + promote, deck-out, empty bench, last prize,
 *      mulligan).
 *   2. Soak test: bot vs bot on every faction pairing; every game must end,
 *      no action may throw, and no card may appear or vanish (per-player card
 *      count is checked after every action).
 *
 * The soak statistics printed at the end are prototype diagnostics, not
 * research results.
 */
const path = require('path');
const BUILD = path.resolve(__dirname, '..', '.engine-build');
const { buildFactionDecks, mulberry32 } = require(path.join(BUILD, 'research-engine.js'));
const { TcgGame, TCG_MODE_CONFIG, costMet, isCharacter } = require(path.join(BUILD, 'tcg-mode-engine.js'));
const { chooseBotAction } = require(path.join(BUILD, 'tcg-mode-bot.js'));

const params = require(path.resolve(__dirname, '..', '..', 'data', 'ga_balanced_params.json'));
const DECKS = buildFactionDecks(params);
const FACTIONS = ['SATWIKA', 'RAJASIKA', 'TAMASIKA'];

let failures = 0;
const report = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); };

let fakeUid = 1e6;
const energy = (energyType) => ({ kind: 'energy', uid: ++fakeUid, energyType });
const energies = (type, n) => Array.from({ length: n }, () => energy(type));

/** A game advanced past setup by the bot, now in turn 1 of the first player. */
function freshGame(seed, a = 'SATWIKA', b = 'TAMASIKA') {
  const g = new TcgGame(DECKS[a], DECKS[b], a, b, mulberry32(seed));
  while (g.phase === 'setup') for (const p of g.waitingFor()) g.apply(p, chooseBotAction(g, p));
  return g;
}
const energyTypeOf = (g, p) => DECKS[g.players[p].name].faction;
/** Affordable attack of p's Active with the highest damage right now (damage reduction can zero out weak attacks). */
function strongestAffordable(g, p) {
  let best = -1;
  g.players[p].active.card.def.attacks.forEach((a, i) => {
    if (g.canAttack(p, i) && (best < 0 || g.previewDamage(p, a) > g.previewDamage(p, g.players[p].active.card.def.attacks[best]))) best = i;
  });
  return best;
}

// ---------------------------------------------------------------- 1. scenarios
report(costMet({ Satwika: 2, Universal: 1 }, energies('Satwika', 3)), 'costMet: 2 typed + 1 Universal covered by 3 matching energy');
report(!costMet({ Satwika: 2, Universal: 1 }, energies('Satwika', 2)), 'costMet: not enough energy for the Universal part');
report(costMet({ Universal: 2 }, energies('Tamasika', 2)), 'costMet: Universal payable by any type');
report(!costMet({ Satwika: 1 }, energies('Tamasika', 2)), 'costMet: typed cost not payable by another type');

{
  const g = freshGame(1);
  const p = g.current;
  g.players[p].active.energies.push(...energies(energyTypeOf(g, p), 5));
  const anyAttack = g.players[p].active.card.def.attacks.some((_, i) => g.canAttack(p, i));
  report(g.turn === 1 && p === g.firstPlayer && !anyAttack, 'first player cannot attack on turn 1 even with energy attached');
  g.apply(p, { type: 'endTurn' });
  const q = g.current;
  g.players[q].active.energies.push(...energies(energyTypeOf(g, q), 5));
  report(g.turn === 2 && g.players[q].active.card.def.attacks.some((_, i) => g.canAttack(q, i)), 'second player can attack on turn 2');
}

{
  const g = freshGame(2);
  const p = g.current;
  const type = energyTypeOf(g, p);
  g.players[p].hand.push(energy(type), energy(type));
  const first = g.players[p].hand.findIndex((c) => c.kind === 'energy');
  g.apply(p, { type: 'attachEnergy', handIndex: first, target: -1 });
  const second = g.players[p].hand.findIndex((c) => c.kind === 'energy');
  report(!g.canAttachEnergy(p, second, -1), 'only one energy may be attached per turn');
}

{
  const g = freshGame(3);
  const p = g.current;
  const pl = g.players[p];
  if (pl.bench.length === 0) pl.bench.push({ card: pl.active.card, damage: 0, energies: [] });
  const cost = pl.active.card.def.retreat_cost;
  pl.active.energies = energies(energyTypeOf(g, p), cost + 1);
  const oldActive = pl.active;
  const discardBefore = pl.discard.length;
  g.apply(p, { type: 'retreat', benchIndex: 0 });
  report(oldActive.energies.length === 1 && pl.discard.length === discardBefore + cost && pl.bench.includes(oldActive),
    `retreat discards exactly retreat_cost (${cost}) energy and sends the old active to the Bench`);
  // Give the new Active enough energy so only the once-per-turn rule can block it.
  pl.active.energies.push(...energies(energyTypeOf(g, p), pl.active.card.def.retreat_cost));
  report(!g.canRetreat(p, 0), 'retreat is allowed only once per turn');
  g.retreated = false;
  report(g.canRetreat(p, 0), '  (control: the same retreat is legal once the per-turn flag is cleared)');
}

{
  const g = freshGame(4);
  g.apply(g.current, { type: 'endTurn' });
  const p = g.current;
  const attacker = g.players[p].active;
  attacker.energies.push(...energies(energyTypeOf(g, p), 5));
  g.players[g.opponentOf(p)].active.damage = 0;
  const before = attacker.energies.length;
  g.apply(p, { type: 'attack', attackIndex: strongestAffordable(g, p) });
  report(attacker.energies.length === before, 'attacking does not consume attached energy');
}

{
  const g = freshGame(5);
  g.apply(g.current, { type: 'endTurn' });
  const p = g.current;
  const o = g.opponentOf(p);
  const atk = g.players[p];
  const def = g.players[o];
  atk.active.energies.push(...energies(energyTypeOf(g, p), 5));
  if (def.bench.length === 0) def.bench.push({ card: def.active.card, damage: 0, energies: [] });
  def.active.damage = def.active.card.def.hp - 1;
  const koEnergy = energy(energyTypeOf(g, o));
  def.active.energies.push(koEnergy);
  const koCard = def.active.card;
  const [prizesBefore, handBefore] = [atk.prizes.length, atk.hand.length];
  g.apply(p, { type: 'attack', attackIndex: strongestAffordable(g, p) });
  const recoilKo = atk.active === null;
  report(def.discard.includes(koCard) && def.discard.includes(koEnergy) && def.active !== koCard,
    'KO: the character and its attached energy go to the discard pile');
  report(atk.prizes.length === prizesBefore - 1 && atk.hand.length === handBefore + 1,
    'KO: the attacker takes 1 prize card into their hand');
  if (!recoilKo) {
    report(g.phase === 'promote' && g.waitingFor()[0] === o, 'KO: the owner must promote a Bench character before play continues');
    g.apply(o, { type: 'promote', benchIndex: 0 });
    report(g.phase === 'main' && g.current === o && def.active !== null, 'promotion ends the attacker\'s turn and the owner plays next');
  }
}

{
  const g = freshGame(6);
  const p = g.current;
  g.players[g.opponentOf(p)].deck = [];
  g.apply(p, { type: 'endTurn' });
  report(g.phase === 'over' && g.winner === p && g.endReason.includes('deck habis'), 'deck-out: a player who cannot draw at the start of their turn loses');
}

{
  const g = freshGame(7);
  g.apply(g.current, { type: 'endTurn' });
  const p = g.current;
  const def = g.players[g.opponentOf(p)];
  g.players[p].active.energies.push(...energies(energyTypeOf(g, p), 5));
  def.bench = [];
  def.active.damage = def.active.card.def.hp - 1;
  g.apply(p, { type: 'attack', attackIndex: strongestAffordable(g, p) });
  report(g.phase === 'over' && g.winner === p, 'KO with an empty Bench: the attacker wins');
}

{
  const g = freshGame(8);
  g.apply(g.current, { type: 'endTurn' });
  const p = g.current;
  const def = g.players[g.opponentOf(p)];
  g.players[p].active.energies.push(...energies(energyTypeOf(g, p), 5));
  g.players[p].prizes = g.players[p].prizes.slice(0, 1);
  if (def.bench.length === 0) def.bench.push({ card: def.active.card, damage: 0, energies: [] });
  def.active.damage = def.active.card.def.hp - 1;
  g.apply(p, { type: 'attack', attackIndex: strongestAffordable(g, p) });
  report(g.phase === 'over' && g.winner === p && g.endReason.includes('prize terakhir'), 'taking the last prize wins');
}

{
  // Few characters per deck -> frequent mulligans.
  const config = { ...TCG_MODE_CONFIG, copiesPerCharacter: 1, energyCards: 38 };
  let mulligans = 0;
  let consistent = true;
  for (let seed = 0; seed < 300; seed++) {
    const g = new TcgGame(DECKS.SATWIKA, DECKS.TAMASIKA, 'A', 'B', mulberry32(seed), config);
    g.players.forEach((pl, i) => {
      mulligans += pl.mulligans;
      const expectedHand = config.handSize + g.players[1 - i].mulligans;
      if (!pl.hand.some(isCharacter) || pl.hand.length !== expectedHand) consistent = false;
    });
  }
  report(consistent && mulligans > 0, `mulligan: every opening hand has a character; opponent draws 1 extra per mulligan (${mulligans} mulligans in 300 games)`);
}

// ---------------------------------------------------------------- 2. soak
/** uid -> damage of every character in play. */
function inPlayDamage(g) {
  const m = new Map();
  for (const pl of g.players) for (const x of [pl.active, ...pl.bench]) if (x) m.set(x.card.uid, x.damage);
  return m;
}
/**
 * The UI animates the structured fx events, so they must agree with the state
 * change: summed hit/heal amounts equal each in-play card's damage delta, a card
 * that left play took a 'ko' event, and damage/KO/energy lines always carry fx.
 */
function checkFx(g, before, newLogs) {
  const expected = new Map();
  const koed = new Set();
  for (const e of newLogs) {
    if (['damage', 'knockout', 'energy'].includes(e.kind) && !e.fx) throw new Error(`log without fx: ${e.message}`);
    if (!e.fx) continue;
    if (e.fx.type === 'hit') expected.set(e.fx.uid, (expected.get(e.fx.uid) ?? 0) + e.fx.amount);
    if (e.fx.type === 'heal') expected.set(e.fx.uid, (expected.get(e.fx.uid) ?? 0) - e.fx.amount);
    if (e.fx.type === 'ko') koed.add(e.fx.uid);
  }
  const after = inPlayDamage(g);
  for (const [uid, dmg] of after) {
    const delta = dmg - (before.get(uid) ?? 0);
    if (delta !== (expected.get(uid) ?? 0)) throw new Error(`fx says ${expected.get(uid) ?? 0} damage for uid ${uid}, state changed by ${delta}`);
  }
  for (const uid of before.keys()) {
    if (!after.has(uid) && !koed.has(uid)) throw new Error(`uid ${uid} left play without a ko event`);
  }
}

const GAMES_PER_PAIR = 300;
const STEP_LIMIT = 20000;
const stats = { games: 0, turns: 0, firstPlayerWins: 0, draws: 0, reasons: {} };
let soakOk = true;
const t0 = Date.now();
const rng = mulberry32(20260801);
for (const a of FACTIONS) {
  for (const b of FACTIONS) {
    for (let n = 0; n < GAMES_PER_PAIR; n++) {
      let g;
      try {
        g = new TcgGame(DECKS[a], DECKS[b], `${a}#1`, `${b}#2`, rng);
        let steps = 0;
        while (g.phase !== 'over') {
          if (++steps > STEP_LIMIT) throw new Error('step limit exceeded');
          for (const p of g.waitingFor()) {
            const before = inPlayDamage(g);
            const logStart = g.log.length;
            g.apply(p, chooseBotAction(g, p));
            checkFx(g, before, g.log.slice(logStart));
            for (const i of [0, 1]) {
              const pl = g.players[i];
              if (g.cardCount(i) !== pl.totalCards) throw new Error(`card count ${g.cardCount(i)} != ${pl.totalCards} for player ${i}`);
              if (pl.bench.length > TCG_MODE_CONFIG.benchCap) throw new Error('bench over cap');
            }
            if (g.phase === 'over') break;
          }
        }
      } catch (err) {
        soakOk = false;
        console.log(`FAIL  soak ${a} vs ${b} game ${n}: ${err.message}`);
        break;
      }
      stats.games++;
      stats.turns += g.turn;
      if (g.isDraw) stats.draws++;
      if (g.winner === g.firstPlayer) stats.firstPlayerWins++;
      const reason = g.isDraw ? 'seri (batas giliran)' : g.endReason.replace(/^.*?(prize terakhir|tidak punya karakter|deck habis|Batas).*$/, '$1');
      stats.reasons[reason] = (stats.reasons[reason] ?? 0) + 1;
    }
  }
}
report(soakOk, `soak: ${stats.games} bot-vs-bot games across 9 pairings end cleanly; card counts conserved and animation events match the state after every action (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

console.log('\nPrototype diagnostics (not research results):');
console.log(`  mean game length: ${(stats.turns / stats.games).toFixed(1)} turns`);
console.log(`  first-player win share: ${(stats.firstPlayerWins / (stats.games - stats.draws) * 100).toFixed(1)}%  draws: ${stats.draws}`);
console.log(`  how games ended: ${JSON.stringify(stats.reasons)}`);
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
