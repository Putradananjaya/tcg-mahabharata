import { Observable } from 'rxjs';
import { FactionDeck } from '../engine/research-engine';
import { PlayerState, GameLog } from '../domain/match-state.model';

export abstract class BattleSimulatorService {
  abstract startSimulation(deck1: FactionDeck, deck2: FactionDeck, name1: string, name2: string): void;
  abstract getPlayer1State(): Observable<PlayerState>;
  abstract getPlayer2State(): Observable<PlayerState>;
  abstract getLogs(): Observable<GameLog[]>;
  abstract getWinner(): Observable<string | null>;
  abstract getIsRunning(): Observable<boolean>;
  abstract getActivePhase(): Observable<string>;
  abstract getActivePlayerIndex(): Observable<number>;
  abstract stepSimulation(): boolean;
  abstract getTurnCount(): Observable<number>;
}
