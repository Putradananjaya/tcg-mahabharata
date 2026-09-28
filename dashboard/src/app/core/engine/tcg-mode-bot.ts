/**
 * Simple, explainable heuristic player for Mode TCG. Not a trained agent and
 * not tuned: it exists so a human has an opponent and Bot vs Bot can run.
 */
import { InPlay, TcgAction, TcgGame, costMet, isCharacter, remainingHp } from './tcg-mode-engine';

export const TCG_BOT_CONFIG = {
  retreatBelowHpFraction: 0.3,
  retreatTargetMinHpFraction: 0.5,
};

function strongestAttackIndex(p: InPlay): number {
  const attacks = p.card.def.attacks;
  let best = 0;
  for (let i = 1; i < attacks.length; i++) {
    if ((attacks[i].base_damage ?? 0) > (attacks[best].base_damage ?? 0)) best = i;
  }
  return best;
}

function needsEnergy(p: InPlay): boolean {
  const goal = p.card.def.attacks[strongestAttackIndex(p)];
  return !!goal && !costMet(goal.prana_cost ?? {}, p.energies);
}

export function chooseBotAction(game: TcgGame, p: number): TcgAction {
  const pl = game.players[p];

  if (game.phase === 'setup') {
    if (!pl.active) {
      let best = -1;
      let bestHp = -1;
      pl.hand.forEach((c, i) => {
        if (isCharacter(c) && c.def.hp > bestHp) { best = i; bestHp = c.def.hp; }
      });
      return { type: 'setupActive', handIndex: best };
    }
    const benchable = pl.hand.findIndex((c, i) => isCharacter(c) && game.canSetupBench(p, i));
    return benchable >= 0 ? { type: 'setupBench', handIndex: benchable } : { type: 'setupDone' };
  }

  if (game.phase === 'promote') {
    let best = 0;
    pl.bench.forEach((b, i) => {
      const cur = pl.bench[best];
      if (b.energies.length > cur.energies.length || (b.energies.length === cur.energies.length && remainingHp(b) > remainingHp(cur))) best = i;
    });
    return { type: 'promote', benchIndex: best };
  }

  const basic = pl.hand.findIndex((_, i) => game.canPlayBasic(p, i));
  if (basic >= 0) return { type: 'playBasic', handIndex: basic };

  const energy = pl.hand.findIndex((c) => c.kind === 'energy');
  if (energy >= 0 && !game.energyAttached && pl.active) {
    let target = -1;
    if (!needsEnergy(pl.active)) {
      const waiting = pl.bench.map((b, i) => ({ b, i })).filter(({ b }) => needsEnergy(b))
        .sort((x, y) => x.b.energies.length - y.b.energies.length)[0];
      if (waiting) target = waiting.i;
    }
    if (game.canAttachEnergy(p, energy, target)) return { type: 'attachEnergy', handIndex: energy, target };
  }

  if (pl.active && !game.retreated && remainingHp(pl.active) <= pl.active.card.def.hp * TCG_BOT_CONFIG.retreatBelowHpFraction) {
    const healthier = pl.bench.map((b, i) => ({ b, i }))
      .filter(({ b }) => remainingHp(b) >= b.card.def.hp * TCG_BOT_CONFIG.retreatTargetMinHpFraction && remainingHp(b) > remainingHp(pl.active!))
      .sort((x, y) => remainingHp(y.b) - remainingHp(x.b))[0];
    if (healthier && game.canRetreat(p, healthier.i)) return { type: 'retreat', benchIndex: healthier.i };
  }

  if (pl.active) {
    let best = -1;
    let bestDamage = -1;
    pl.active.card.def.attacks.forEach((attack, i) => {
      if (!game.canAttack(p, i)) return;
      const damage = game.previewDamage(p, attack);
      if (damage > bestDamage) { best = i; bestDamage = damage; }
    });
    if (best >= 0) return { type: 'attack', attackIndex: best };
  }

  return { type: 'endTurn' };
}
