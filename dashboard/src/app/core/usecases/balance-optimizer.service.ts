import { Observable } from 'rxjs';
import { Card } from '../domain/card.model';

export interface ParamUpdate {
  [key: string]: number;
}

export abstract class BalanceOptimizerService {
  abstract getParams(): Observable<ParamUpdate>;
  abstract getLoss(): Observable<number>;
  abstract updateParam(key: string, value: number): void;
  abstract runGAOptimization(): Observable<{ step: number, loss: number, params: ParamUpdate }>;
  abstract runPSOOptimization(): Observable<{ step: number, loss: number, params: ParamUpdate }>;
  abstract getPandawaDeck(): Card[];
  abstract getKurawaDeck(): Card[];
  abstract getDeckByFaction(faction: 'SATWIKA' | 'RAJASIKA' | 'TAMASIKA'): Card[];
  abstract addCustomCard(faction: 'PANDAWA' | 'KURAWA', name: string, hp: number, dmg: number, cost: number, mechanic: string): void;
}
