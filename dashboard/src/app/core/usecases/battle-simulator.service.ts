import { Observable } from 'rxjs';
import { Card } from '../domain/card.model';

export abstract class BattleSimulatorService {
  abstract startSimulation(p1Deck: Card[], p2Deck: Card[]): void;
  abstract getPlayer1State(): Observable<PlayerState>;
  abstract getPlayer2State(): Observable<PlayerState>;
  abstract getLogs(): Observable<GameLog[]>;
  abstract getWinner(): Observable<string | null>;
  abstract getIsRunning(): Observable<boolean>;
  abstract getActivePhase(): Observable<string>;
  abstract getActivePlayerIndex(): Observable<number>;
  abstract stepSimulation(): boolean;
  abstract getTurnCount(): Observable<number>;
  abstract runBatchSimulation(p1Deck: Card[], p2Deck: Card[], matchCount: number): { p1Wins: number, p2Wins: number, draws: number, avgTurns: number };
}

import { PlayerState, GameLog } from '../domain/match-state.model';
