import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { BattleSimulatorService } from '../../core/usecases/battle-simulator.service';
import { PlayerState, GameLog, CharacterState } from '../../core/domain/match-state.model';
import { CardInstance, FactionDeck, Match, PlayerSim, TURN_CAP } from '../../core/engine/research-engine';
import { tr } from '../../core/engine/lang';

type Phase = 'PRANA' | 'ATTACK' | 'EFFECT' | 'EVALUATION';

const EMPTY_STATE: PlayerState = {
  name: '-', activeCharacter: null, bench: [], prana: {}, sasmita: 3, deckCount: 0, discardCount: 0,
};

/**
 * Step-by-step view of one research-engine Match. Each "Next Step" runs one
 * of the four sub-steps of a player's turn (prana, attack, effect,
 * knockouts) in the same order as Player.attack(), so the outcome is exactly
 * what a batch run of the same match would produce.
 */
@Injectable({ providedIn: 'root' })
export class BattleSimulatorImpl implements BattleSimulatorService {
  private p1State$ = new BehaviorSubject<PlayerState>(EMPTY_STATE);
  private p2State$ = new BehaviorSubject<PlayerState>(EMPTY_STATE);
  private logs$ = new BehaviorSubject<GameLog[]>([]);
  private winner$ = new BehaviorSubject<string | null>(null);
  private isRunning$ = new BehaviorSubject<boolean>(false);
  private turnCount$ = new BehaviorSubject<number>(1);
  private activePhase$ = new BehaviorSubject<string>('PRANA');
  private activePlayerIndex$ = new BehaviorSubject<number>(0);

  private match: Match | null = null;
  private phase: Phase = 'PRANA';

  getPlayer1State(): Observable<PlayerState> { return this.p1State$.asObservable(); }
  getPlayer2State(): Observable<PlayerState> { return this.p2State$.asObservable(); }
  getLogs(): Observable<GameLog[]> { return this.logs$.asObservable(); }
  getWinner(): Observable<string | null> { return this.winner$.asObservable(); }
  getIsRunning(): Observable<boolean> { return this.isRunning$.asObservable(); }
  getTurnCount(): Observable<number> { return this.turnCount$.asObservable(); }
  getActivePhase(): Observable<string> { return this.activePhase$.asObservable(); }
  getActivePlayerIndex(): Observable<number> { return this.activePlayerIndex$.asObservable(); }

  startSimulation(deck1: FactionDeck, deck2: FactionDeck, name1: string, name2: string): void {
    const [label1, label2] = name1 === name2 ? [`${name1} (P1)`, `${name2} (P2)`] : [name1, name2];
    this.match = new Match(deck1, deck2, label1, label2, Math.random);
    this.phase = 'PRANA';
    this.logs$.next([]);
    this.winner$.next(null);

    const first = this.match.order[0];
    this.addLog(tr(`=== PERTANDINGAN DIMULAI (engine riset, batas ${TURN_CAP} giliran) ===`,
      `=== MATCH STARTED (research engine, ${TURN_CAP}-turn cap) ===`), 'info');
    for (const p of this.match.players) {
      this.addLog(tr(`${p.name}: aktif ${p.active?.name ?? '-'}, bench ${p.bench.length} kartu (${this.benchSummary(p)}), deck tersisa ${p.deck.length}.`,
        `${p.name}: active ${p.active?.name ?? '-'}, bench ${p.bench.length} cards (${this.benchSummary(p)}), ${p.deck.length} left in deck.`), 'info');
    }
    this.addLog(tr(`Lempar koin: ${first.name} jalan duluan di setiap giliran.`, `Coin toss: ${first.name} goes first every turn.`), 'info');

    this.activePhase$.next('PRANA');
    this.isRunning$.next(true);
    this.publish();
  }

  stepSimulation(): boolean {
    const match = this.match;
    if (!match || match.finished) return false;
    const actor = match.actor;

    if (this.phase === 'PRANA') {
      this.addLog(tr(`--- GILIRAN ${match.turn} | ${actor.name} ---`, `--- TURN ${match.turn} | ${actor.name} ---`), 'info');
      const type = match.stepPrana();
      if (type) {
        this.addLog(tr(`[FASE PRANA] +1 Prana ${type} untuk ${actor.active?.name} (pool: ${this.poolText(actor)}).`,
          `[PRANA PHASE] +1 ${type} Prana for ${actor.active?.name} (pool: ${this.poolText(actor)}).`), 'action');
      } else {
        this.addLog(tr(`[FASE PRANA] Tidak ada karakter aktif, tidak ada Prana.`, `[PRANA PHASE] No active character, no Prana.`), 'info');
      }
      this.phase = 'ATTACK';
    } else if (this.phase === 'ATTACK') {
      const { attack, skipReason } = match.stepAttack();
      if (attack) {
        const bonus = [
          attack.benchBonus ? tr(`+${attack.benchBonus} bonus Bench`, `+${attack.benchBonus} Bench bonus`) : '',
          attack.discardBonus ? tr(`+${attack.discardBonus} bonus discard lawan`, `+${attack.discardBonus} opponent-discard bonus`) : '',
          attack.reduction ? `−${attack.reduction} DR ${attack.defender}` : '',
        ].filter(Boolean).join(', ');
        this.addLog(tr(`[FASE SERANG] ${attack.attacker} memakai '${attack.attackName}' (base ${attack.baseDamage}${bonus ? ', ' + bonus : ''}).`,
          `[ATTACK PHASE] ${attack.attacker} uses '${attack.attackName}' (base ${attack.baseDamage}${bonus ? ', ' + bonus : ''}).`), 'action');
        this.addLog(tr(`  * Damage bersih ${attack.finalDamage} HP dikurangi dari ${attack.defender} (sisa HP: ${attack.defenderHpAfter}).`,
          `  * Net damage ${attack.finalDamage} HP dealt to ${attack.defender} (HP left: ${attack.defenderHpAfter}).`), 'damage');
      } else {
        this.addLog(`${tr('[FASE SERANG]', '[ATTACK PHASE]')} ${skipReason}`, 'info');
      }
      this.phase = 'EFFECT';
    } else if (this.phase === 'EFFECT') {
      const effect = match.stepEffect();
      if (effect) {
        const type = effect.effect === 'recoil_damage' ? 'recoil' : effect.effect === 'heal_bench_card' ? 'heal' : 'action';
        this.addLog(`${tr('[FASE EFEK]', '[EFFECT PHASE]')} ${effect.detail}`, type);
      } else {
        this.addLog(tr(`[FASE EFEK] Tidak ada efek.`, `[EFFECT PHASE] No effect.`), 'info');
      }
      this.phase = 'EVALUATION';
    } else {
      const { knockouts } = match.stepKnockouts();
      for (const ko of knockouts) {
        const cause = ko.byRecoil ? tr(' (akibat recoil sendiri)', ' (by its own recoil)') : '';
        this.addLog(tr(`  * GUGUR: ${ko.knockedOut}${cause}. ${ko.claimant} mengklaim prize, Sasmita tersisa ${ko.claimantSasmita}.`,
          `  * KNOCKED OUT: ${ko.knockedOut}${cause}. ${ko.claimant} claims a prize, Sasmita left ${ko.claimantSasmita}.`), 'knockout');
        if (ko.replacement) this.addLog(tr(`  * ${ko.replacement} maju dari Bench.`, `  * ${ko.replacement} steps up from the Bench.`), 'info');
      }
      if (!knockouts.length) this.addLog(tr(`[FASE EVALUASI] Tidak ada yang gugur.`, `[EVALUATION PHASE] Nobody was knocked out.`), 'info');
      this.phase = 'PRANA';
      if (match.finished) this.finish();
    }

    this.activePhase$.next(this.phase);
    this.publish();
    return !match.finished;
  }

  private finish(): void {
    const match = this.match!;
    const winner = match.players[match.winnerIndex!];
    if (match.endedByTurnCap) {
      this.addLog(tr(`=== BATAS ${TURN_CAP} GILIRAN: pemenang ditentukan HP karakter aktif (seri → P1). Pemenang: ${winner.name} ===`,
        `=== ${TURN_CAP}-TURN CAP: winner decided by active character HP (tie → P1). Winner: ${winner.name} ===`), 'info');
    } else {
      this.addLog(tr(`=== GAME OVER: ${winner.name} MENANG ===`, `=== GAME OVER: ${winner.name} WINS ===`), 'info');
    }
    this.winner$.next(winner.name);
    this.isRunning$.next(false);
  }

  private publish(): void {
    const match = this.match;
    if (!match) return;
    this.p1State$.next(this.toState(match.players[0]));
    this.p2State$.next(this.toState(match.players[1]));
    this.turnCount$.next(Math.min(match.turn, TURN_CAP));
    this.activePlayerIndex$.next(match.players.indexOf(match.actor));
  }

  private toState(p: PlayerSim): PlayerState {
    const character = (c: CardInstance): CharacterState => ({ name: c.name, maxHp: c.hp, currentHp: c.currentHp });
    const prana = Object.fromEntries(Object.entries(p.prana).filter(([, v]) => v > 0));
    return {
      name: p.name,
      activeCharacter: p.active ? character(p.active) : null,
      bench: p.bench.map(character),
      prana,
      sasmita: p.sasmita,
      deckCount: p.deck.length,
      discardCount: p.discard.length,
    };
  }

  private poolText(p: PlayerSim): string {
    const entries = Object.entries(p.prana).filter(([, v]) => v > 0);
    return entries.length ? entries.map(([k, v]) => `${k} ${v}`).join(', ') : tr('kosong', 'empty');
  }

  private benchSummary(p: PlayerSim): string {
    const counts = new Map<string, number>();
    for (const c of p.bench) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
    return [...counts].map(([name, n]) => `${n}× ${name}`).join(', ') || tr('kosong', 'empty');
  }

  private addLog(message: string, type: GameLog['type']): void {
    this.logs$.next([...this.logs$.value, { turn: this.match ? Math.min(this.match.turn, TURN_CAP) : 1, message, type }]);
  }
}
