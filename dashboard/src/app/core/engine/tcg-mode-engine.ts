/**
 * "Mode TCG": a Pokemon-TCG-style rules prototype for playing with the
 * Mahabharata cards. It is NOT the research simulator (research-engine.ts);
 * its results are never compared with results/*.json.
 *
 * Rules implemented (official Pokemon TCG turn structure, adapted):
 *   setup: coin flip, draw 7, mulligan until a character is in hand (the
 *          opponent draws 1 extra card per mulligan), choose Active + Bench,
 *          set prize cards from the top of the deck.
 *   turn:  draw 1 (cannot draw = lose) -> any number of Basic characters to
 *          the Bench, attach at most 1 energy card to one character, retreat
 *          at most once (discard attached energy = retreat cost) -> attack
 *          (ends the turn) or end the turn. The first player cannot attack on
 *          turn 1. Attacking does not consume attached energy.
 *   KO:    the card and its attached energy go to the discard pile; the
 *          opponent takes 1 prize card into their hand; the owner promotes a
 *          Bench character, or loses if the Bench is empty.
 *   win:   take the last prize card, opponent has no character left, or the
 *          opponent cannot draw at the start of their turn.
 * Not implemented yet (needs card design): weakness/resistance, trainer
 * cards, evolution, special conditions.
 */
import { AttackDef, CardDef, FactionDeck, Rng } from './research-engine';

export const TCG_MODE_CONFIG = {
  copiesPerCharacter: 10,
  energyCards: 20,
  handSize: 7,
  prizeCards: 3,
  benchCap: 5,
  // Official rules have no turn limit; this only stops a stalled game.
  turnCap: 200,
  // The research cards' own attack mechanics, unchanged.
  benchScalingPerCard: 5,
  benchScalingMax: 15,
};

export type EnergyType = 'Satwika' | 'Rajasika' | 'Tamasika';

export interface EnergyCard { kind: 'energy'; uid: number; energyType: EnergyType; }
export interface CharacterCard { kind: 'character'; uid: number; def: CardDef; }
export type TcgCard = EnergyCard | CharacterCard;

export interface InPlay {
  card: CharacterCard;
  damage: number;
  energies: EnergyCard[];
}

export interface TcgPlayer {
  name: string;
  deck: TcgCard[];
  hand: TcgCard[];
  active: InPlay | null;
  bench: InPlay[];
  discard: TcgCard[];
  prizes: TcgCard[];
  mulligans: number;
  setupDone: boolean;
  totalCards: number;
}

export type TcgAction =
  | { type: 'setupActive'; handIndex: number }
  | { type: 'setupBench'; handIndex: number }
  | { type: 'setupDone' }
  | { type: 'playBasic'; handIndex: number }
  | { type: 'attachEnergy'; handIndex: number; target: number } // target -1 = Active, >= 0 = Bench index
  | { type: 'retreat'; benchIndex: number }
  | { type: 'attack'; attackIndex: number }
  | { type: 'endTurn' }
  | { type: 'promote'; benchIndex: number };

export type TcgPhase = 'setup' | 'main' | 'promote' | 'over';

/**
 * Structured event behind a log line, for animations and sound. `player` is
 * the owner of the card or zone the event happens to (for `hit`, the side
 * that takes the damage; `by` is the attacking side).
 */
export type TcgFx =
  | { type: 'coin' | 'turn' | 'pass' | 'win'; player: number }
  | { type: 'tie' }
  | { type: 'play' | 'retreat' | 'promote' | 'ko'; player: number; uid: number }
  | { type: 'energy'; player: number; uid: number; energyType: EnergyType }
  | { type: 'hit'; player: number; uid: number; amount: number; by: number }
  | { type: 'heal'; player: number; uid: number; amount: number }
  | { type: 'mill'; player: number; count: number };

export interface TcgLog {
  turn: number;
  player: number | null;
  message: string;
  kind: 'info' | 'action' | 'energy' | 'damage' | 'knockout' | 'prize';
  /** Hidden information (e.g. the card drawn); show only to whoever may see `player`'s hand. */
  secret?: string;
  fx?: TcgFx;
}

export function remainingHp(p: InPlay): number {
  return p.card.def.hp - p.damage;
}

export function isCharacter(card: TcgCard): card is CharacterCard {
  return card.kind === 'character';
}

/** Is `cost` covered by the energy attached to a character? Typed costs first, Universal from the rest. */
export function costMet(cost: { [type: string]: number }, energies: EnergyCard[]): boolean {
  const counts: { [type: string]: number } = {};
  for (const e of energies) counts[e.energyType] = (counts[e.energyType] ?? 0) + 1;
  let remaining = energies.length;
  for (const [type, amount] of Object.entries(cost)) {
    if (type === 'Universal' || amount <= 0) continue;
    if ((counts[type] ?? 0) < amount) return false;
    remaining -= amount;
  }
  return remaining >= (cost['Universal'] ?? 0);
}

function shuffle<T>(items: T[], rng: Rng): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

export function buildTcgDeck(faction: FactionDeck, nextUid: () => number, config = TCG_MODE_CONFIG): TcgCard[] {
  const energyType = faction.faction as EnergyType;
  const deck: TcgCard[] = [];
  for (const def of faction.cards) {
    for (let i = 0; i < config.copiesPerCharacter; i++) deck.push({ kind: 'character', uid: nextUid(), def });
  }
  for (let i = 0; i < config.energyCards; i++) deck.push({ kind: 'energy', uid: nextUid(), energyType });
  return deck;
}

export class TcgGame {
  readonly players: [TcgPlayer, TcgPlayer];
  readonly firstPlayer: 0 | 1;
  phase: TcgPhase = 'setup';
  current: 0 | 1;
  turn = 0;
  energyAttached = false;
  retreated = false;
  promotePending: number[] = [];
  winner: 0 | 1 | null = null;
  isDraw = false;
  endReason = '';
  log: TcgLog[] = [];

  private uid = 0;

  constructor(deck1: FactionDeck, deck2: FactionDeck, name1: string, name2: string, private rng: Rng, readonly config = TCG_MODE_CONFIG) {
    const nextUid = () => ++this.uid;
    const make = (name: string, deck: FactionDeck): TcgPlayer => {
      const cards = buildTcgDeck(deck, nextUid, config);
      shuffle(cards, rng);
      return { name, deck: cards, hand: [], active: null, bench: [], discard: [], prizes: [], mulligans: 0, setupDone: false, totalCards: cards.length };
    };
    this.players = [make(name1, deck1), make(name2, deck2)];
    this.firstPlayer = rng() < 0.5 ? 0 : 1;
    this.current = this.firstPlayer;
    this.addLog(null, `Lempar koin: ${this.players[this.firstPlayer].name} jalan duluan.`, 'info', { fx: { type: 'coin', player: this.firstPlayer } });

    for (const [i, p] of this.players.entries()) {
      if (!p.deck.some(isCharacter)) throw new Error(`Deck ${p.name} tidak berisi kartu karakter; mulligan tidak akan pernah selesai.`);
      this.draw(p, config.handSize);
      while (!p.hand.some(isCharacter)) {
        p.mulligans++;
        this.addLog(i, `${p.name} mulligan (tidak ada karakter di tangan): kartu dikocok kembali, ambil ${config.handSize} baru.`, 'info');
        p.deck.push(...p.hand);
        p.hand = [];
        shuffle(p.deck, rng);
        this.draw(p, config.handSize);
      }
    }
    for (const [i, p] of this.players.entries()) {
      const extra = this.players[1 - i].mulligans;
      if (extra > 0) {
        this.draw(p, extra);
        this.addLog(i, `${p.name} mengambil ${extra} kartu tambahan karena lawan mulligan ${extra}×.`, 'info');
      }
    }
  }

  // ---------------------------------------------------------------- queries

  opponentOf(p: number): 0 | 1 {
    return (1 - p) as 0 | 1;
  }

  isFirstTurn(): boolean {
    return this.turn === 1;
  }

  canSetupActive(p: number, handIndex: number): boolean {
    const pl = this.players[p];
    const card = pl.hand[handIndex];
    return this.phase === 'setup' && !pl.setupDone && !pl.active && !!card && isCharacter(card);
  }

  canSetupBench(p: number, handIndex: number): boolean {
    const pl = this.players[p];
    const card = pl.hand[handIndex];
    return this.phase === 'setup' && !pl.setupDone && !!pl.active && pl.bench.length < this.config.benchCap && !!card && isCharacter(card);
  }

  canSetupDone(p: number): boolean {
    return this.phase === 'setup' && !this.players[p].setupDone && !!this.players[p].active;
  }

  private isMyMainTurn(p: number): boolean {
    return this.phase === 'main' && this.current === p;
  }

  canPlayBasic(p: number, handIndex: number): boolean {
    const pl = this.players[p];
    const card = pl.hand[handIndex];
    return this.isMyMainTurn(p) && !!card && isCharacter(card) && pl.bench.length < this.config.benchCap;
  }

  canAttachEnergy(p: number, handIndex: number, target: number): boolean {
    const pl = this.players[p];
    const card = pl.hand[handIndex];
    const targetExists = target === -1 ? !!pl.active : target >= 0 && target < pl.bench.length;
    return this.isMyMainTurn(p) && !this.energyAttached && !!card && card.kind === 'energy' && targetExists;
  }

  canRetreat(p: number, benchIndex: number): boolean {
    const pl = this.players[p];
    return this.isMyMainTurn(p) && !this.retreated && !!pl.active && benchIndex >= 0 && benchIndex < pl.bench.length
      && pl.active.energies.length >= (pl.active.card.def.retreat_cost ?? 0);
  }

  canAttack(p: number, attackIndex: number): boolean {
    const pl = this.players[p];
    const attack = pl.active?.card.def.attacks[attackIndex];
    return this.isMyMainTurn(p) && !this.isFirstTurn() && !!attack && !!pl.active
      && costMet(attack.prana_cost ?? {}, pl.active.energies);
  }

  canEndTurn(p: number): boolean {
    return this.isMyMainTurn(p);
  }

  canPromote(p: number, benchIndex: number): boolean {
    return this.phase === 'promote' && this.promotePending[0] === p && benchIndex >= 0 && benchIndex < this.players[p].bench.length;
  }

  /** Whose input the game is waiting for, or null when over. */
  waitingFor(): number[] {
    if (this.phase === 'over') return [];
    if (this.phase === 'setup') return this.players.map((pl, i) => (pl.setupDone ? -1 : i)).filter((i) => i >= 0);
    if (this.phase === 'promote') return [this.promotePending[0]];
    return [this.current];
  }

  /** Damage an attack would deal right now (for display and the bot), before it is applied. */
  previewDamage(p: number, attack: AttackDef): number {
    const pl = this.players[p];
    const opp = this.players[this.opponentOf(p)];
    const benchBonus = attack.bench_scaling ? Math.min(pl.bench.length * this.config.benchScalingPerCard, this.config.benchScalingMax) : 0;
    const discardBonus = attack.effect === 'scaled_damage_per_discard_tamasika' ? opp.discard.length * (attack.scale_value ?? 0) : 0;
    const reduction = opp.active?.card.def.damage_reduction ?? 0;
    return Math.max(0, (attack.base_damage ?? 0) + benchBonus + discardBonus - reduction);
  }

  /** Every zone's card count, including attached energy — must equal totalCards (checked by verify-tcg-mode). */
  cardCount(p: number): number {
    const pl = this.players[p];
    const inPlay = [pl.active, ...pl.bench].filter((x): x is InPlay => !!x);
    return pl.deck.length + pl.hand.length + pl.discard.length + pl.prizes.length
      + inPlay.reduce((s, x) => s + 1 + x.energies.length, 0);
  }

  // ---------------------------------------------------------------- actions

  apply(p: number, action: TcgAction): void {
    const pl = this.players[p];
    switch (action.type) {
      case 'setupActive': {
        this.require(this.canSetupActive(p, action.handIndex), p, action);
        const card = pl.hand.splice(action.handIndex, 1)[0] as CharacterCard;
        pl.active = { card, damage: 0, energies: [] };
        break;
      }
      case 'setupBench': {
        this.require(this.canSetupBench(p, action.handIndex), p, action);
        const card = pl.hand.splice(action.handIndex, 1)[0] as CharacterCard;
        pl.bench.push({ card, damage: 0, energies: [] });
        break;
      }
      case 'setupDone': {
        this.require(this.canSetupDone(p), p, action);
        pl.setupDone = true;
        // Setup is face down until both players are done, so the choice is revealed in beginGame().
        this.addLog(p, `${pl.name} selesai setup.`, 'info');
        if (this.players.every((x) => x.setupDone)) this.beginGame();
        break;
      }
      case 'playBasic': {
        this.require(this.canPlayBasic(p, action.handIndex), p, action);
        const card = pl.hand.splice(action.handIndex, 1)[0] as CharacterCard;
        pl.bench.push({ card, damage: 0, energies: [] });
        this.addLog(p, `${pl.name} memainkan ${card.def.name} ke Bench.`, 'action', { fx: { type: 'play', player: p, uid: card.uid } });
        break;
      }
      case 'attachEnergy': {
        this.require(this.canAttachEnergy(p, action.handIndex, action.target), p, action);
        const energy = pl.hand.splice(action.handIndex, 1)[0] as EnergyCard;
        const target = action.target === -1 ? pl.active! : pl.bench[action.target];
        target.energies.push(energy);
        this.energyAttached = true;
        this.addLog(p, `${pl.name} menempel energi ${energy.energyType} ke ${target.card.def.name} (${target.energies.length} energi).`, 'energy',
          { fx: { type: 'energy', player: p, uid: target.card.uid, energyType: energy.energyType } });
        break;
      }
      case 'retreat': {
        this.require(this.canRetreat(p, action.benchIndex), p, action);
        const old = pl.active!;
        const cost = old.card.def.retreat_cost ?? 0;
        // Discards the most recently attached energy first.
        pl.discard.push(...old.energies.splice(old.energies.length - cost, cost));
        pl.active = pl.bench.splice(action.benchIndex, 1)[0];
        pl.bench.push(old);
        this.retreated = true;
        this.addLog(p, `${pl.name} retreat: ${old.card.def.name} mundur (buang ${cost} energi), ${pl.active.card.def.name} maju.`, 'action',
          { fx: { type: 'retreat', player: p, uid: pl.active.card.uid } });
        break;
      }
      case 'attack': {
        this.require(this.canAttack(p, action.attackIndex), p, action);
        this.resolveAttack(p, action.attackIndex);
        break;
      }
      case 'endTurn': {
        this.require(this.canEndTurn(p), p, action);
        this.addLog(p, `${pl.name} mengakhiri giliran tanpa menyerang.`, 'info', { fx: { type: 'pass', player: p } });
        this.nextTurn();
        break;
      }
      case 'promote': {
        this.require(this.canPromote(p, action.benchIndex), p, action);
        pl.active = pl.bench.splice(action.benchIndex, 1)[0];
        this.promotePending.shift();
        this.addLog(p, `${pl.name} memajukan ${pl.active.card.def.name} dari Bench.`, 'action', { fx: { type: 'promote', player: p, uid: pl.active.card.uid } });
        if (this.promotePending.length === 0) this.nextTurn();
        break;
      }
    }
  }

  private require(ok: boolean, p: number, action: TcgAction): void {
    if (!ok) throw new Error(`Aksi tidak sah untuk pemain ${p}: ${JSON.stringify(action)} (fase ${this.phase}, giliran ${this.turn})`);
  }

  private beginGame(): void {
    for (const [i, p] of this.players.entries()) {
      p.prizes = p.deck.splice(0, this.config.prizeCards);
      const bench = p.bench.map((b) => b.card.def.name).join(', ') || 'kosong';
      this.addLog(i, `${p.name} membuka kartu: aktif ${p.active!.card.def.name}, Bench: ${bench}. ${p.prizes.length} kartu prize disisihkan.`, 'info');
    }
    this.phase = 'main';
    this.current = this.firstPlayer;
    this.startTurn();
  }

  private startTurn(): void {
    this.turn++;
    this.energyAttached = false;
    this.retreated = false;
    const pl = this.players[this.current];
    if (this.turn > this.config.turnCap) {
      this.endByTurnCap();
      return;
    }
    if (pl.deck.length === 0) {
      this.finish(this.opponentOf(this.current), `${pl.name} tidak bisa mengambil kartu (deck habis).`);
      return;
    }
    const [card] = this.draw(pl, 1);
    const firstNote = this.isFirstTurn() ? ' Pemain pertama tidak boleh menyerang di giliran ini.' : '';
    const drawn = card.kind === 'energy' ? `energi ${card.energyType}` : card.def.name;
    this.addLog(this.current, `--- Giliran ${this.turn}: ${pl.name} mengambil 1 kartu.${firstNote}`, 'info',
      { secret: drawn, fx: { type: 'turn', player: this.current } });
  }

  private nextTurn(): void {
    if (this.phase === 'over') return;
    this.phase = 'main';
    this.current = this.opponentOf(this.current);
    this.startTurn();
  }

  private resolveAttack(p: number, attackIndex: number): void {
    const pl = this.players[p];
    const opp = this.players[this.opponentOf(p)];
    const attacker = pl.active!;
    const defender = opp.active!;
    const attack = attacker.card.def.attacks[attackIndex];
    const damage = this.previewDamage(p, attack);
    defender.damage += damage;
    this.addLog(p, `${attacker.card.def.name} memakai '${attack.name}': ${damage} damage ke ${defender.card.def.name} (sisa HP ${Math.max(0, remainingHp(defender))}).`, 'damage',
      { fx: { type: 'hit', player: this.opponentOf(p), uid: defender.card.uid, amount: damage, by: p } });

    const value = attack.value ?? 0;
    if (attack.effect === 'mill_enemy_deck') {
      const milled = opp.deck.splice(0, value);
      opp.discard.push(...milled);
      this.addLog(p, `Efek Mill: ${milled.length} kartu teratas deck ${opp.name} dibuang.`, 'action', { fx: { type: 'mill', player: this.opponentOf(p), count: milled.length } });
    } else if (attack.effect === 'recoil_damage') {
      attacker.damage += value;
      this.addLog(p, `Efek Recoil: ${attacker.card.def.name} menerima ${value} damage (sisa HP ${Math.max(0, remainingHp(attacker))}).`, 'damage',
        { fx: { type: 'hit', player: p, uid: attacker.card.uid, amount: value, by: p } });
    } else if (attack.effect === 'heal_bench_card') {
      const target = [...pl.bench].sort((a, b) => b.damage - a.damage)[0];
      const healed = target ? Math.min(value, target.damage) : 0;
      if (target) target.damage -= healed;
      this.addLog(p, target ? `Efek Heal: ${target.card.def.name} di Bench pulih ${healed} HP.` : 'Efek Heal: Bench kosong.', 'action',
        target ? { fx: { type: 'heal', player: p, uid: target.card.uid, amount: healed } } : {});
    }

    if (remainingHp(defender) <= 0) this.knockOut(this.opponentOf(p));
    if (this.phase !== 'over' && pl.active && remainingHp(pl.active) <= 0) this.knockOut(p);
    if (this.phase === 'over') return;
    if (this.promotePending.length > 0) {
      this.phase = 'promote';
      return;
    }
    this.nextTurn();
  }

  /** `owner`'s active is knocked out; the other player takes a prize. */
  private knockOut(owner: number): void {
    const pl = this.players[owner];
    const taker = this.players[this.opponentOf(owner)];
    const ko = pl.active!;
    pl.discard.push(ko.card, ...ko.energies);
    pl.active = null;
    const prize = taker.prizes.shift();
    if (prize) taker.hand.push(prize);
    this.addLog(owner, `GUGUR: ${ko.card.def.name} milik ${pl.name}. ${taker.name} mengambil 1 prize (sisa ${taker.prizes.length}).`, 'knockout',
      { fx: { type: 'ko', player: owner, uid: ko.card.uid } });

    if (taker.prizes.length === 0) {
      this.finish(this.opponentOf(owner), `${taker.name} mengambil prize terakhir.`);
    } else if (pl.bench.length === 0) {
      this.finish(this.opponentOf(owner), `${pl.name} tidak punya karakter lagi di Bench.`);
    } else {
      this.promotePending.push(owner);
    }
  }

  private endByTurnCap(): void {
    const [a, b] = this.players;
    const reason = `Batas ${this.config.turnCap} giliran tercapai (aturan resmi tidak punya batas; ini hanya pengaman).`;
    if (a.prizes.length === b.prizes.length) {
      this.phase = 'over';
      this.isDraw = true;
      this.endReason = `${reason} Prize tersisa sama — seri.`;
      this.addLog(null, `=== ${this.endReason} ===`, 'info', { fx: { type: 'tie' } });
    } else {
      this.finish(a.prizes.length < b.prizes.length ? 0 : 1, `${reason} Pemenang: prize tersisa lebih sedikit.`);
    }
  }

  private finish(winner: 0 | 1, reason: string): void {
    this.phase = 'over';
    this.winner = winner;
    this.endReason = reason;
    this.addLog(winner, `=== ${this.players[winner].name} MENANG — ${reason} ===`, 'prize', { fx: { type: 'win', player: winner } });
  }

  private draw(pl: TcgPlayer, count: number): TcgCard[] {
    const drawn = pl.deck.splice(0, count);
    pl.hand.push(...drawn);
    return drawn;
  }

  private addLog(player: number | null, message: string, kind: TcgLog['kind'], extra: { secret?: string; fx?: TcgFx } = {}): void {
    this.log.push({ turn: this.turn, player, message, kind, ...extra });
  }
}
