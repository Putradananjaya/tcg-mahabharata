/**
 * TypeScript port of the research simulator: src/domain/models.py (Player,
 * Card) plus src/simulator/fitness.py (build_faction_decks,
 * run_simulation_multi). Rules follow the Python code line for line —
 * including its quirks (heal_bench_card is a no-op, a character whose best
 * attack is unaffordable skips its turn unless in panic, bench_scaling is
 * capped at +15) — so sandbox numbers are comparable with results/*.json.
 * Randomness cannot match Python bit-for-bit, only statistically; parity is
 * checked by tools/verify-engine-parity.mjs against exp03_balance_matrix.json.
 *
 * One deliberate difference: winners are identified by player position,
 * not by name, so mirror matches need no relabeling (rules_spec.md 4.5).
 */

import { tr } from './lang';

export interface AttackDef {
  name: string;
  prana_cost: { [prana: string]: number };
  base_damage: number;
  effect?: string;
  value?: number;
  bench_scaling?: number;
  scale_value?: number;
}

export interface CardDef {
  id: string;
  name: string;
  type: string;
  stage: string;
  hp: number;
  retreat_cost: number;
  damage_reduction?: number;
  attacks: AttackDef[];
}

export interface FactionDeck {
  faction: string;
  cards: CardDef[];
}

export type Rng = () => number;

export const TURN_CAP = 100;
export const DECK_COPIES = 20;
export const STARTING_HAND = 7;
export const BENCH_CAP = 5;
export const STARTING_SASMITA = 3;
export const PANIC_HP_FRACTION = 0.4;
const PRIORITY_LEADS = ['Yudhistira', 'Patih Sengkuni', 'Karna'];

/** Seedable PRNG (mulberry32) so sandbox runs are reproducible. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: Rng): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

export class CardInstance {
  readonly hp: number;
  currentHp: number;
  readonly damageReduction: number;

  constructor(readonly def: CardDef) {
    this.hp = def.hp ?? 0;
    this.currentHp = this.hp;
    this.damageReduction = def.damage_reduction ?? 0;
  }

  get name(): string {
    return this.def.name;
  }
}

export class PlayerSim {
  deck: CardInstance[] = [];
  hand: CardInstance[] = [];
  active: CardInstance | null = null;
  bench: CardInstance[] = [];
  discard: CardInstance[] = [];
  // Key order matters: pay_prana drains Universal costs in this order.
  prana: { [prana: string]: number } = { Satwika: 0, Tamasika: 0, Rajasika: 0, Universal: 0 };
  sasmita = STARTING_SASMITA;
  attackLog: string[] = [];

  constructor(readonly name: string) {}

  loadDeck(data: FactionDeck, rng: Rng, copies = DECK_COPIES): void {
    this.deck = [];
    for (let i = 0; i < copies; i++) {
      for (const card of data.cards) this.deck.push(new CardInstance(card));
    }
    shuffle(this.deck, rng);
  }

  setupPhase(): void {
    for (let i = 0; i < STARTING_HAND && this.deck.length > 0; i++) {
      this.hand.push(this.deck.shift()!);
    }
  }

  private isBasicTokoh(card: CardInstance): boolean {
    return card.def.type === 'Tokoh' && card.def.stage === 'Basic';
  }

  playBasicToActive(): boolean {
    const lead = this.hand.find((c) => this.isBasicTokoh(c) && PRIORITY_LEADS.includes(c.name))
      ?? this.hand.find((c) => this.isBasicTokoh(c));
    if (!lead) return false;
    this.active = lead;
    this.hand.splice(this.hand.indexOf(lead), 1);
    return true;
  }

  playBasicToBench(): void {
    const benched: CardInstance[] = [];
    for (const card of this.hand) {
      if (this.isBasicTokoh(card) && this.bench.length < BENCH_CAP) {
        benched.push(card);
        this.bench.push(card);
      }
    }
    this.hand = this.hand.filter((c) => !benched.includes(c));
  }

  /** The Prana type attach_prana() adds: first non-Universal cost key found. */
  pranaTypeForActive(): string {
    for (const attack of this.active?.def.attacks ?? []) {
      const element = Object.keys(attack.prana_cost ?? {}).find((k) => k !== 'Universal');
      if (element) return element;
    }
    return 'Universal';
  }

  attachPrana(): string | null {
    if (!this.active) return null;
    const type = this.pranaTypeForActive();
    this.prana[type] = (this.prana[type] ?? 0) + 1;
    return type;
  }

  canAfford(cost: { [prana: string]: number }): boolean {
    const pool = { ...this.prana };
    for (const [type, amount] of Object.entries(cost)) {
      if (type === 'Universal') continue;
      if ((pool[type] ?? 0) >= amount) pool[type] -= amount;
      else return false;
    }
    const universalNeeded = cost['Universal'] ?? 0;
    return Object.values(pool).reduce((a, b) => a + b, 0) >= universalNeeded;
  }

  payPrana(cost: { [prana: string]: number }): void {
    for (const [type, amount] of Object.entries(cost)) {
      if (type !== 'Universal') this.prana[type] = (this.prana[type] ?? 0) - amount;
    }
    for (let i = 0; i < (cost['Universal'] ?? 0); i++) {
      const type = Object.keys(this.prana).find((t) => this.prana[t] > 0);
      if (type) this.prana[type] -= 1;
    }
  }

  /** check_knockout(self, opponent): self claims a prize if opponent's active is KO'd. */
  checkKnockout(opponent: PlayerSim): { knockedOut: CardInstance | null, gameOver: boolean, replacement: CardInstance | null } {
    const target = opponent.active;
    if (!target || target.currentHp > 0) return { knockedOut: null, gameOver: false, replacement: null };
    opponent.active = null;
    this.sasmita -= 1;
    if (this.sasmita <= 0) return { knockedOut: target, gameOver: true, replacement: null };
    if (opponent.bench.length > 0) {
      opponent.active = opponent.bench.shift()!;
      return { knockedOut: target, gameOver: false, replacement: opponent.active };
    }
    return { knockedOut: target, gameOver: true, replacement: null };
  }
}

export interface AttackReport {
  attacker: string;
  attackName: string;
  baseDamage: number;
  benchBonus: number;
  discardBonus: number;
  reduction: number;
  finalDamage: number;
  defender: string;
  defenderHpAfter: number;
}

export interface EffectReport {
  effect: string;
  detail: string;
}

export interface KnockoutReport {
  knockedOut: string;
  byRecoil: boolean;
  claimant: string;
  claimantSasmita: number;
  replacement: string | null;
}

export interface ActionReport {
  turn: number;
  actor: PlayerSim;
  pranaType: string | null;
  attack: AttackReport | null;
  skipReason: string | null;
  effect: EffectReport | null;
  knockouts: KnockoutReport[];
  gameOver: boolean;
}

/**
 * One match, set up exactly like fitness.run_simulation_multi. Each player's
 * turn is exposed as four sub-steps (prana, attack, effect, knockouts) that
 * run in the same order as Player.attack(), so the interactive simulator can
 * reveal them one at a time without changing the outcome.
 */
export class Match {
  readonly players: [PlayerSim, PlayerSim];
  readonly order: [PlayerSim, PlayerSim];
  turn = 1;
  winnerIndex: 0 | 1 | null = null;
  endedByTurnCap = false;

  private actorSlot: 0 | 1 = 0;
  private pendingAttack: AttackDef | null = null;

  constructor(deck1: FactionDeck, deck2: FactionDeck, name1: string, name2: string, private rng: Rng) {
    const p1 = new PlayerSim(name1);
    const p2 = new PlayerSim(name2);
    p1.loadDeck(deck1, rng);
    p2.loadDeck(deck2, rng);
    p1.setupPhase();
    p2.setupPhase();
    p1.playBasicToActive();
    p2.playBasicToActive();
    p1.playBasicToBench();
    p2.playBasicToBench();
    this.players = [p1, p2];
    const shuffled: [PlayerSim, PlayerSim] = [p1, p2];
    shuffle(shuffled, rng);
    this.order = shuffled;
  }

  get finished(): boolean {
    return this.winnerIndex !== null;
  }

  get actor(): PlayerSim {
    return this.order[this.actorSlot];
  }

  private get opponent(): PlayerSim {
    return this.order[1 - this.actorSlot];
  }

  stepPrana(): string | null {
    return this.actor.attachPrana();
  }

  /** Selection, payment and damage — the part of Player.attack() before effects. */
  stepAttack(): { attack: AttackReport | null, skipReason: string | null } {
    const self = this.actor;
    const opponent = this.opponent;
    this.pendingAttack = null;
    if (!self.active) return { attack: null, skipReason: tr('Tidak ada karakter aktif.', 'No active character.') };
    const attacks = self.active.def.attacks ?? [];
    if (attacks.length === 0) return { attack: null, skipReason: tr('Karakter tidak punya serangan.', 'The character has no attacks.') };

    const sorted = [...attacks].sort((a, b) => (b.base_damage ?? 0) - (a.base_damage ?? 0));
    const best = sorted[0];
    const inPanic = self.active.currentHp <= self.active.hp * PANIC_HP_FRACTION;
    let chosen: AttackDef | null = null;
    if (self.canAfford(best.prana_cost ?? {})) {
      chosen = best;
    } else if (inPanic) {
      chosen = sorted.find((a) => self.canAfford(a.prana_cost ?? {})) ?? null;
    } else {
      return { attack: null, skipReason: tr(`Prana belum cukup untuk '${best.name}' — menunggu giliran berikutnya.`, `Not enough Prana for '${best.name}' — waiting for the next turn.`) };
    }
    if (!chosen) return { attack: null, skipReason: tr('Panik, tetapi tidak ada serangan yang terjangkau.', 'Panicking, but no attack is affordable.') };

    self.payPrana(chosen.prana_cost ?? {});
    self.attackLog.push(chosen.name);

    const benchBonus = chosen.bench_scaling ? Math.min(self.bench.length * 5, 15) : 0;
    const discardBonus = chosen.effect === 'scaled_damage_per_discard_tamasika'
      ? opponent.discard.length * (chosen.scale_value ?? 0) : 0;
    const reduction = opponent.active?.damageReduction ?? 0;
    const finalDamage = Math.max(0, (chosen.base_damage ?? 0) + benchBonus + discardBonus - reduction);

    if (!opponent.active) return { attack: null, skipReason: tr('Lawan tidak punya karakter aktif.', 'The opponent has no active character.') };
    opponent.active.currentHp -= finalDamage;
    this.pendingAttack = chosen;
    return {
      attack: {
        attacker: self.active.name, attackName: chosen.name,
        baseDamage: chosen.base_damage ?? 0, benchBonus, discardBonus, reduction, finalDamage,
        defender: opponent.active.name, defenderHpAfter: opponent.active.currentHp,
      },
      skipReason: null,
    };
  }

  /** trigger_attack_effect(). No-op when stepAttack() didn't land an attack. */
  stepEffect(): EffectReport | null {
    const attack = this.pendingAttack;
    if (!attack?.effect) return null;
    const self = this.actor;
    const opponent = this.opponent;
    const value = attack.value ?? 0;

    if (attack.effect === 'mill_enemy_deck') {
      let milled = 0;
      for (let i = 0; i < value && opponent.deck.length > 0; i++) {
        opponent.discard.push(opponent.deck.shift()!);
        milled++;
      }
      return { effect: attack.effect, detail: tr(`${milled} kartu deck lawan dibuang ke discard pile (discard lawan: ${opponent.discard.length}).`, `${milled} opponent deck cards sent to the discard pile (opponent discard: ${opponent.discard.length}).`) };
    }
    if (attack.effect === 'heal_bench_card') {
      if (self.bench.length === 0) return { effect: attack.effect, detail: tr('Bench kosong, tidak ada yang dipulihkan.', 'Bench is empty, nothing to restore.') };
      const target = self.bench[Math.floor(this.rng() * self.bench.length)];
      const healed = Math.min(value, target.hp - target.currentHp);
      target.currentHp += healed;
      return { effect: attack.effect, detail: tr(`Memulihkan ${healed} HP ${target.name} di Bench (karakter di Bench tidak pernah terluka di engine ini, jadi hasilnya selalu 0).`, `Restores ${healed} HP to ${target.name} on the Bench (Bench characters are never hurt in this engine, so this is always 0).`) };
    }
    if (attack.effect === 'recoil_damage') {
      if (self.active) self.active.currentHp -= value;
      return { effect: attack.effect, detail: tr(`${self.active?.name ?? 'Penyerang'} menerima ${value} recoil damage (sisa HP: ${self.active?.currentHp ?? 0}).`, `${self.active?.name ?? 'The attacker'} takes ${value} recoil damage (HP left: ${self.active?.currentHp ?? 0}).`) };
    }
    return null;
  }

  /** check_knockout() plus the recoil-suicide check, then advance the turn order. */
  stepKnockouts(): { knockouts: KnockoutReport[], gameOver: boolean } {
    const self = this.actor;
    const opponent = this.opponent;
    const knockouts: KnockoutReport[] = [];
    let gameOver = false;

    if (this.pendingAttack) {
      const direct = self.checkKnockout(opponent);
      if (direct.knockedOut) {
        knockouts.push({ knockedOut: direct.knockedOut.name, byRecoil: false, claimant: self.name, claimantSasmita: self.sasmita, replacement: direct.replacement?.name ?? null });
      }
      if (direct.gameOver) {
        gameOver = true;
        this.winnerIndex = this.players.indexOf(self) as 0 | 1;
      } else if (self.active && self.active.currentHp <= 0) {
        const suicide = opponent.checkKnockout(self);
        if (suicide.knockedOut) {
          knockouts.push({ knockedOut: suicide.knockedOut.name, byRecoil: true, claimant: opponent.name, claimantSasmita: opponent.sasmita, replacement: suicide.replacement?.name ?? null });
        }
        if (suicide.gameOver) {
          gameOver = true;
          this.winnerIndex = this.players.indexOf(opponent) as 0 | 1;
        }
      }
    }
    this.pendingAttack = null;

    if (!gameOver) {
      if (this.actorSlot === 0) {
        this.actorSlot = 1;
      } else {
        this.actorSlot = 0;
        this.turn++;
        if (this.turn > TURN_CAP) this.resolveTurnCap();
      }
    }
    return { knockouts, gameOver: this.finished };
  }

  /** Turn-cap tie-break (rules_spec.md 1.6): higher active HP wins, ties go to player 1. */
  private resolveTurnCap(): void {
    const [p1, p2] = this.players;
    const hp1 = p1.active?.currentHp ?? 0;
    const hp2 = p2.active?.currentHp ?? 0;
    this.winnerIndex = hp1 >= hp2 ? 0 : 1;
    this.endedByTurnCap = true;
  }

  stepAction(): ActionReport {
    const turn = this.turn;
    const actor = this.actor;
    const pranaType = this.stepPrana();
    const { attack, skipReason } = this.stepAttack();
    const effect = this.stepEffect();
    const { knockouts, gameOver } = this.stepKnockouts();
    return { turn, actor, pranaType, attack, skipReason, effect, knockouts, gameOver };
  }

  runToEnd(): void {
    while (!this.finished) this.stepAction();
  }
}

/** Port of fitness.build_faction_decks(params). */
export function buildFactionDecks(p: { [key: string]: number }): { SATWIKA: FactionDeck, RAJASIKA: FactionDeck, TAMASIKA: FactionDeck } {
  const int = (key: string) => Math.trunc(p[key]);
  return {
    SATWIKA: {
      faction: 'Satwika',
      cards: [
        {
          id: 'STW-001', name: 'Yudhistira', type: 'Tokoh', stage: 'Basic',
          hp: int('stw_yudhistira_hp'), retreat_cost: 1, damage_reduction: int('stw_yudhistira_dr'),
          attacks: [{
            name: 'Sabda Rahayu',
            prana_cost: { Satwika: int('stw_yudhistira_cost_satwika'), Universal: int('stw_yudhistira_cost_univ') },
            base_damage: int('stw_yudhistira_dmg'), effect: 'heal_bench_card', value: int('stw_yudhistira_heal'),
          }],
        },
        {
          id: 'STW-002', name: 'Raden Arjuna', type: 'Tokoh', stage: 'Basic',
          hp: int('stw_arjuna_hp'), retreat_cost: 2,
          attacks: [
            { name: 'Panah Kendali', prana_cost: { Satwika: 1 }, base_damage: 20 },
            {
              name: 'Panah Pasupati', prana_cost: { Satwika: int('stw_arjuna_pasupati_cost') },
              base_damage: int('stw_arjuna_pasupati_dmg'), bench_scaling: 20,
            },
          ],
        },
      ],
    },
    RAJASIKA: {
      faction: 'Rajasika',
      cards: [
        {
          id: 'RJS-001', name: 'Balarama', type: 'Tokoh', stage: 'Basic',
          hp: int('rjs_balarama_hp'), retreat_cost: 2,
          attacks: [{ name: 'Hantaman Nanggala', prana_cost: { Rajasika: int('rjs_balarama_cost') }, base_damage: int('rjs_balarama_dmg') }],
        },
        {
          id: 'RJS-002', name: 'Karna', type: 'Tokoh', stage: 'Basic',
          hp: int('rjs_karna_hp'), retreat_cost: 1,
          attacks: [{
            name: 'Senjata Konta', prana_cost: { Rajasika: int('rjs_karna_cost') },
            base_damage: int('rjs_karna_dmg'), effect: 'recoil_damage', value: int('rjs_karna_recoil'),
          }],
        },
      ],
    },
    TAMASIKA: {
      faction: 'Tamasika',
      cards: [
        {
          id: 'TMS-001', name: 'Patih Sengkuni', type: 'Tokoh', stage: 'Basic',
          hp: int('tms_sengkuni_hp'), retreat_cost: 1,
          attacks: [{
            name: 'Hasutan Amarta',
            prana_cost: { Tamasika: int('tms_sengkuni_cost_tamasika'), Universal: int('tms_sengkuni_cost_univ') },
            base_damage: int('tms_sengkuni_dmg'), effect: 'mill_enemy_deck', value: int('tms_sengkuni_mill'),
          }],
        },
        {
          id: 'TMS-002', name: 'Duryodana', type: 'Tokoh', stage: 'Basic',
          hp: int('tms_duryodana_hp'), retreat_cost: 3,
          attacks: [
            { name: 'Gada Kelana', prana_cost: { Universal: 2 }, base_damage: 20 },
            {
              name: 'Angkara 100 Kurawa', prana_cost: { Tamasika: int('tms_duryodana_angkara_cost') },
              base_damage: int('tms_duryodana_angkara_dmg'), effect: 'scaled_damage_per_discard_tamasika',
              scale_value: int('tms_duryodana_scale_value'),
            },
          ],
        },
      ],
    },
  };
}

export interface BatchResult {
  n: number;
  wins1: number;
  turnCapEndings: number;
  meanTurns: number;
}

/** n independent matches of deck1 (player 1) vs deck2; counts player-1 wins. */
export function simulateMatches(deck1: FactionDeck, deck2: FactionDeck, n: number, rng: Rng): BatchResult {
  let wins1 = 0;
  let turnCapEndings = 0;
  let totalTurns = 0;
  for (let i = 0; i < n; i++) {
    const match = new Match(deck1, deck2, 'P1', 'P2', rng);
    match.runToEnd();
    if (match.winnerIndex === 0) wins1++;
    if (match.endedByTurnCap) turnCapEndings++;
    totalTurns += Math.min(match.turn, TURN_CAP);
  }
  return { n, wins1, turnCapEndings, meanTurns: totalTurns / n };
}
