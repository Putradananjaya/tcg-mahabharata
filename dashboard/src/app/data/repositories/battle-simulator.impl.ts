import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { BattleSimulatorService } from '../../core/usecases/battle-simulator.service';
import { PlayerState, GameLog, CharacterState } from '../../core/domain/match-state.model';
import { Card } from '../../core/domain/card.model';

@Injectable({
  providedIn: 'root'
})
export class BattleSimulatorImpl implements BattleSimulatorService {
  private p1State$ = new BehaviorSubject<PlayerState>({
    name: 'PANDAWA (Satwika)',
    activeCharacter: null,
    bench: [],
    prana: {},
    sasmita: 3
  });

  private p2State$ = new BehaviorSubject<PlayerState>({
    name: 'KURAWA (Tamasika)',
    activeCharacter: null,
    bench: [],
    prana: {},
    sasmita: 3
  });

  private logs$ = new BehaviorSubject<GameLog[]>([]);
  private winner$ = new BehaviorSubject<string | null>(null);
  private isRunning$ = new BehaviorSubject<boolean>(false);
  private turnCount$ = new BehaviorSubject<number>(1);
  private activePhase$ = new BehaviorSubject<string>('PRANA');
  private activePlayerIndex$ = new BehaviorSubject<number>(0);

  private currentPhase: 'PRANA' | 'ATTACK' | 'EFFECT' | 'EVALUATION' = 'PRANA';
  private pendingAttack: {
    attacker: CharacterState;
    defender: CharacterState;
    isP1: boolean;
    netDmg: number;
    attack: any;
  } | null = null;

  private turn = 1;
  private p1Deck: Card[] = [];
  private p2Deck: Card[] = [];
  private p1Active: CharacterState | null = null;
  private p2Active: CharacterState | null = null;
  private p1Bench: CharacterState[] = [];
  private p2Bench: CharacterState[] = [];
  private p1Sasmita = 3;
  private p2Sasmita = 3;
  private p1Prana: { [key: string]: number } = {};
  private p2Prana: { [key: string]: number } = {};
  private activePlayerIndex = 0; // 0 for p1, 1 for p2
  private p1DiscardCount = 0;
  private p2DiscardCount = 0;

  private getFactionName(deck: Card[]): string {
    if (!deck || deck.length === 0) return 'UNKNOWN';
    const id = deck[0].id;
    if (id.startsWith('stw_')) return 'SATWIKA';
    if (id.startsWith('rjs_')) return 'RAJASIKA';
    if (id.startsWith('tms_')) return 'TAMASIKA';
    return 'MIXED';
  }

  startSimulation(p1Deck: Card[], p2Deck: Card[]): void {
    this.p1Deck = p1Deck;
    this.p2Deck = p2Deck;
    this.turn = 1;
    this.p1Sasmita = 3;
    this.p2Sasmita = 3;
    this.p1Prana = { 'Satwika': 0, 'Universal': 0 };
    this.p2Prana = { 'Tamasika': 0, 'Universal': 0 };
    this.winner$.next(null);
    this.logs$.next([]);
    this.turnCount$.next(1);
    this.currentPhase = 'PRANA';
    this.activePhase$.next('PRANA');
    this.pendingAttack = null;
    this.activePlayerIndex = Math.random() < 0.5 ? 0 : 1;
    this.activePlayerIndex$.next(this.activePlayerIndex);
    this.p1DiscardCount = 0;
    this.p2DiscardCount = 0;

    if (p1Deck && p1Deck.length > 0) {
      this.p1Active = {
        name: p1Deck[0].name,
        maxHp: p1Deck[0].hp,
        currentHp: p1Deck[0].hp
      };
      this.p1Bench = p1Deck.slice(1).map(c => ({
        name: c.name,
        maxHp: c.hp,
        currentHp: c.hp
      }));
    } else {
      this.p1Active = null;
      this.p1Bench = [];
    }

    if (p2Deck && p2Deck.length > 0) {
      this.p2Active = {
        name: p2Deck[0].name,
        maxHp: p2Deck[0].hp,
        currentHp: p2Deck[0].hp
      };
      this.p2Bench = p2Deck.slice(1).map(c => ({
        name: c.name,
        maxHp: c.hp,
        currentHp: c.hp
      }));
    } else {
      this.p2Active = null;
      this.p2Bench = [];
    }

    this.addLog(`=== MEMULAI PERTANDINGAN TCG MAHABHARATA ===`, 'info');
    this.addLog(`Lempar Koin: Player ${this.activePlayerIndex === 0 ? 'Pandawa' : 'Kurawa'} jalan pertama.`, 'info');

    this.updateStates();
    this.isRunning$.next(true);
  }

  getPlayer1State(): Observable<PlayerState> { return this.p1State$.asObservable(); }
  getPlayer2State(): Observable<PlayerState> { return this.p2State$.asObservable(); }
  getLogs(): Observable<GameLog[]> { return this.logs$.asObservable(); }
  getWinner(): Observable<string | null> { return this.winner$.asObservable(); }
  getIsRunning(): Observable<boolean> { return this.isRunning$.asObservable(); }
  getTurnCount(): Observable<number> { return this.turnCount$.asObservable(); }
  getActivePhase(): Observable<string> { return this.activePhase$.asObservable(); }
  getActivePlayerIndex(): Observable<number> { return this.activePlayerIndex$.asObservable(); }

  stepSimulation(): boolean {
    if (this.winner$.value || !this.isRunning$.value) return false;

    const isP1Turn = this.activePlayerIndex === 0;
    const attackerName = isP1Turn ? this.getFactionName(this.p1Deck) : this.getFactionName(this.p2Deck);
    const attackerActive = isP1Turn ? this.p1Active : this.p2Active;
    const defenderActive = isP1Turn ? this.p2Active : this.p1Active;
    const attackerPrana = isP1Turn ? this.p1Prana : this.p2Prana;

    if (!attackerActive || !defenderActive) return false;

    if (this.currentPhase === 'PRANA') {
      this.addLog(`--- TURN ${this.turn} | GILIRAN ${attackerName} ---`, 'info');

      // 1. Resource Phase
      const factionPrana = isP1Turn ? 'Satwika' : 'Tamasika';
      attackerPrana[factionPrana] = (attackerPrana[factionPrana] || 0) + 1;
      this.addLog(`[FASE PRANA] Menambahkan +1 Prana ${factionPrana} ke ${attackerActive.name} (Total: ${attackerPrana[factionPrana]}).`, 'action');

      this.currentPhase = 'ATTACK';
      this.activePhase$.next('ATTACK');

    } else if (this.currentPhase === 'ATTACK') {
      // 2. Attack Phase
      this.addLog(`[FASE MENYERANG] ${attackerActive.name} bersiap menyerang ${defenderActive.name}.`, 'action');
      this.executeAttackDamage(attackerActive, defenderActive, isP1Turn);

      this.currentPhase = 'EFFECT';
      this.activePhase$.next('EFFECT');

    } else if (this.currentPhase === 'EFFECT') {
      // 3. Effect Phase
      this.addLog(`[FASE EFEK] Memicu kemampuan pasif/senjata tokoh...`, 'action');
      this.executeAttackEffect();

      this.currentPhase = 'EVALUATION';
      this.activePhase$.next('EVALUATION');

    } else if (this.currentPhase === 'EVALUATION') {
      // 4. Evaluation / End Phase
      this.addLog(`[FASE EVALUASI] Memeriksa status kesehatan karakter di arena...`, 'info');
      this.checkKnockouts();

      // Clean up
      this.pendingAttack = null;

      // Switch Turns
      this.activePlayerIndex = 1 - this.activePlayerIndex;
      this.activePlayerIndex$.next(this.activePlayerIndex);
      this.turn++;
      this.turnCount$.next(this.turn);

      this.currentPhase = 'PRANA';
      this.activePhase$.next('PRANA');

      if (this.turn > 9999 && !this.winner$.value) {
        const hp1 = this.p1Active?.currentHp || 0;
        const hp2 = this.p2Active?.currentHp || 0;
        const finalWinner = hp1 >= hp2 ? this.getFactionName(this.p1Deck) : this.getFactionName(this.p2Deck);
        this.winner$.next(finalWinner);
        this.isRunning$.next(false);
        this.addLog(`=== PERTANDINGAN BERAKHIR: TURN LIMIT. Pemenang: ${finalWinner} ===`, 'info');
      }
    }

    this.updateStates();
    return !this.winner$.value;
  }

  runBatchSimulation(p1Deck: Card[], p2Deck: Card[], matchCount: number): { p1Wins: number, p2Wins: number, draws: number, avgTurns: number } {
    let p1Wins = 0;
    let p2Wins = 0;
    let draws = 0;
    let totalTurns = 0;

    const p1Name = this.getFactionName(p1Deck);
    const p2Name = this.getFactionName(p2Deck);

    for (let i = 0; i < matchCount; i++) {
      let turn = 1;
      let p1Sasmita = 3;
      let p2Sasmita = 3;

      const p1Active = { name: p1Deck[0].name, maxHp: p1Deck[0].hp, currentHp: p1Deck[0].hp };
      const p1Bench = p1Deck.slice(1).map(c => ({ name: c.name, maxHp: c.hp, currentHp: c.hp }));
      const p2Active = { name: p2Deck[0].name, maxHp: p2Deck[0].hp, currentHp: p2Deck[0].hp };
      const p2Bench = p2Deck.slice(1).map(c => ({ name: c.name, maxHp: c.hp, currentHp: c.hp }));

      let activePlayerIndex = Math.random() < 0.5 ? 0 : 1;
      let p1DiscardCount = 0;
      let p2DiscardCount = 0;
      let winner: string | null = null;

      while (turn <= 9999 && !winner) {
        const isP1Turn = activePlayerIndex === 0;
        const attacker = isP1Turn ? p1Active : p2Active;
        const defender = isP1Turn ? p2Active : p1Active;
        const attackerBench = isP1Turn ? p1Bench : p2Bench;

        const card = (isP1Turn ? p1Deck : p2Deck).find(c => c.name === attacker.name);
        if (card) {
          const attack = card.attacks[0] || { name: 'Serang', base_damage: 30 };

          // Introduce +/- 10% RNG variance so the 1000 batch matches aren't completely deterministic clones
          const variance = 0.9 + (Math.random() * 0.2);
          let dmg = Math.round(attack.base_damage * variance);

          const cardDef = (isP1Turn ? p2Deck : p1Deck).find(c => c.name === defender.name);
          const attackerBench = isP1Turn ? p1Bench : p2Bench;
          const defenderDiscard = isP1Turn ? p2DiscardCount : p1DiscardCount;

          if (attacker.name === 'Raden Arjuna') {
            const scale = attack.scale_value !== undefined ? attack.scale_value : 20;
            dmg = Math.round((attack.base_damage + (attackerBench.length * scale)) * variance);
          } else if (attacker.name === 'Duryodana') {
            const scale = attack.scale_value !== undefined ? attack.scale_value : 5;
            dmg = Math.round((attack.base_damage + (defenderDiscard * scale)) * variance);
          }

          const dr = cardDef?.damage_reduction || 0;
          const netDmg = Math.max(0, dmg - dr);
          defender.currentHp -= netDmg;

          if (attack.effect === 'heal_bench') {
            const wounded = attackerBench.find(c => c.currentHp < c.maxHp);
            const val = attack.value !== undefined ? attack.value : 25;
            if (wounded) {
              wounded.currentHp = Math.min(wounded.maxHp, wounded.currentHp + val);
            }
          } else if (attack.effect === 'mill') {
            const val = attack.value !== undefined ? attack.value : 2;
            if (isP1Turn) {
              p2DiscardCount += val;
            } else {
              p1DiscardCount += val;
            }
          } else if (attack.effect === 'lifesteal') {
            const heal = Math.floor(netDmg * 0.5);
            attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + heal);
          } else if (attack.effect === 'poison_recoil') {
            const recoilPct = attack.value !== undefined ? attack.value : 20;
            const recoil = Math.floor(netDmg * (recoilPct / 100));
            attacker.currentHp -= recoil;
          }
        }

        if (p1Active.currentHp <= 0) {
          p2Sasmita--;
          if (p2Sasmita <= 0 || p1Bench.length === 0) {
            winner = p2Name;
          } else {
            const next = p1Bench.shift()!;
            p1Active.name = next.name;
            p1Active.maxHp = next.maxHp;
            p1Active.currentHp = next.currentHp;
          }
        }

        if (p2Active.currentHp <= 0 && !winner) {
          p1Sasmita--;
          if (p1Sasmita <= 0 || p2Bench.length === 0) {
            winner = p1Name;
          } else {
            const next = p2Bench.shift()!;
            p2Active.name = next.name;
            p2Active.maxHp = next.maxHp;
            p2Active.currentHp = next.currentHp;
          }
        }

        activePlayerIndex = 1 - activePlayerIndex;
        turn++;
      }

      totalTurns += turn;
      if (winner === p1Name) {
        p1Wins++;
      } else if (winner === p2Name) {
        p2Wins++;
      } else {
        const hp1 = p1Active.currentHp;
        const hp2 = p2Active.currentHp;
        if (hp1 >= hp2) {
          p1Wins++;
        } else {
          p2Wins++;
        }
      }
    }

    return {
      p1Wins,
      p2Wins,
      draws,
      avgTurns: Math.round(totalTurns / matchCount)
    };
  }

  private executeAttackDamage(attacker: CharacterState, defender: CharacterState, isP1: boolean) {
    const deck = isP1 ? this.p1Deck : this.p2Deck;
    const card = deck.find(c => c.name === attacker.name);
    if (!card) return;

    const attack = card.attacks[0] || { name: 'Serang', base_damage: 30 };
    let dmg = attack.base_damage;

    const cardDef = (isP1 ? this.p2Deck : this.p1Deck).find(c => c.name === defender.name);
    const attackerBench = isP1 ? this.p1Bench : this.p2Bench;
    const defenderDiscard = isP1 ? this.p2DiscardCount : this.p1DiscardCount;

    if (attacker.name === 'Raden Arjuna') {
      const scale = attack.scale_value !== undefined ? attack.scale_value : 20;
      dmg = attack.base_damage + (attackerBench.length * scale);
      this.addLog(`  * Penskalaan Arjuna: +${attackerBench.length * scale} DMG (Bench: ${attackerBench.length} kartu).`, 'action');
    } else if (attacker.name === 'Duryodana') {
      const scale = attack.scale_value !== undefined ? attack.scale_value : 5;
      dmg = attack.base_damage + (defenderDiscard * scale);
      this.addLog(`  * Penskalaan Duryodana: +${defenderDiscard * scale} DMG (Makam musuh: ${defenderDiscard} kartu).`, 'action');
    }

    const dr = cardDef?.damage_reduction || 0;
    const netDmg = Math.max(0, dmg - dr);
    defender.currentHp -= netDmg;

    this.addLog(`  * Melancarkan jurus '${attack.name}' (Base: ${attack.base_damage} DMG).`, 'action');
    if (dr > 0) {
      this.addLog(`  * Pertahanan ${defender.name}: Mengurangi damage sebesar ${dr} HP (Damage Reduction).`, 'heal');
    }
    this.addLog(`  * Damage Bersih: ${netDmg} HP dikurangi dari ${defender.name} (Sisa HP: ${defender.currentHp}).`, 'damage');

    // Store computed details for the next phase (EFFECT)
    this.pendingAttack = {
      attacker,
      defender,
      isP1,
      netDmg,
      attack
    };
  }

  private executeAttackEffect() {
    if (!this.pendingAttack) {
      this.addLog(`  * Tidak ada efek jurus terdeteksi.`, 'info');
      return;
    }

    const { attacker, defender, isP1, netDmg, attack } = this.pendingAttack;
    const attackerBench = isP1 ? this.p1Bench : this.p2Bench;

    if (attack.effect === 'heal_bench') {
      const wounded = attackerBench.find(c => c.currentHp < c.maxHp);
      const val = attack.value !== undefined ? attack.value : 25;
      if (wounded) {
        wounded.currentHp = Math.min(wounded.maxHp, wounded.currentHp + val);
        this.addLog(`  * Efek Sabda Rahayu: Memulihkan ${val} HP ${wounded.name} di Bench (HP baru: ${wounded.currentHp}).`, 'heal');
      } else {
        this.addLog(`  * Efek Sabda Rahayu: Tidak ada karakter Bench yang terluka.`, 'info');
      }
    } else if (attack.effect === 'mill') {
      const val = attack.value !== undefined ? attack.value : 2;
      if (isP1) {
        this.p2DiscardCount += val;
      } else {
        this.p1DiscardCount += val;
      }
      const defenderName = isP1 ? this.getFactionName(this.p2Deck) : this.getFactionName(this.p1Deck);
      this.addLog(`  * Efek Hasutan Amarta: Membuang ${val} kartu ${defenderName} ke Makam!`, 'action');
    } else if (attack.effect === 'lifesteal') {
      const heal = Math.floor(netDmg * 0.5);
      attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + heal);
      this.addLog(`  * Efek Lifesteal: Menyerap nyawa dan memulihkan ${heal} HP ${attacker.name}.`, 'heal');
    } else if (attack.effect === 'poison_recoil') {
      const recoilPct = attack.value !== undefined ? attack.value : 20;
      const recoil = Math.floor(netDmg * (recoilPct / 100));
      attacker.currentHp -= recoil;
      this.addLog(`  * Efek Timbal-Balik (Recoil): ${attacker.name} menerima ${recoil} recoil damage (Sisa HP: ${attacker.currentHp}).`, 'recoil');
    } else {
      this.addLog(`  * Tidak ada efek khusus untuk jurus '${attack.name}'.`, 'info');
    }
  }

  // Sasmita = prize-card count (canonical definition, see src/simulator/rules_spec.md
  // section 5.1). Whoever's active character is knocked out — by direct damage or by
  // their own recoil — hands the OTHER player a prize: the other player's Sasmita
  // decrements, and that other player wins when their own Sasmita reaches 0 (or when
  // the knocked-out side has no bench character left to send out).
  private checkKnockouts() {
    const p1Name = this.getFactionName(this.p1Deck);
    const p2Name = this.getFactionName(this.p2Deck);

    if (this.p1Active && this.p1Active.currentHp <= 0) {
      this.p2Sasmita--;
      this.addLog(`  * GUGUR: Karakter aktif ${p1Name} (${this.p1Active.name}) kalah! Sasmita ${p2Name} tersisa: ${this.p2Sasmita}`, 'knockout');
      if (this.p2Sasmita <= 0 || this.p1Bench.length === 0) {
        this.winner$.next(p2Name);
        this.isRunning$.next(false);
        this.addLog(`=== GAME OVER: ${p2Name} MEMENANGKAN DUEL! ===`, 'info');
        this.p1Active = null;
      } else {
        this.p1Active = this.p1Bench.shift() || null;
        this.addLog(`  * Kirim Karakter: ${this.p1Active?.name} memasuki Arena Aktif dari Bench.`, 'info');
      }
    }

    if (this.p2Active && this.p2Active.currentHp <= 0) {
      this.p1Sasmita--;
      this.addLog(`  * GUGUR: Karakter aktif ${p2Name} (${this.p2Active.name}) kalah! Sasmita ${p1Name} tersisa: ${this.p1Sasmita}`, 'knockout');
      if (this.p1Sasmita <= 0 || this.p2Bench.length === 0) {
        this.winner$.next(p1Name);
        this.isRunning$.next(false);
        this.addLog(`=== GAME OVER: ${p1Name} MEMENANGKAN DUEL! ===`, 'info');
        this.p2Active = null;
      } else {
        this.p2Active = this.p2Bench.shift() || null;
        this.addLog(`  * Kirim Karakter: ${this.p2Active?.name} memasuki Arena Aktif dari Bench.`, 'info');
      }
    }
  }

  private addLog(message: string, type: 'action' | 'damage' | 'heal' | 'recoil' | 'knockout' | 'info') {
    const current = this.logs$.value;
    current.push({ turn: this.turn, message, type });
    this.logs$.next([...current]);
  }

  private updateStates() {
    const p1Name = this.getFactionName(this.p1Deck);
    const p2Name = this.getFactionName(this.p2Deck);

    this.p1State$.next({
      name: p1Name,
      activeCharacter: this.p1Active ? { ...this.p1Active } : null,
      bench: [...this.p1Bench],
      prana: { ...this.p1Prana },
      sasmita: this.p1Sasmita
    });

    this.p2State$.next({
      name: p2Name,
      activeCharacter: this.p2Active ? { ...this.p2Active } : null,
      bench: [...this.p2Bench],
      prana: { ...this.p2Prana },
      sasmita: this.p2Sasmita
    });
  }
}
