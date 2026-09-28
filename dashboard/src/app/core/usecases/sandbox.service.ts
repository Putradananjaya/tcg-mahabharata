import { Observable } from 'rxjs';
import { FactionDeck } from '../engine/research-engine';
import { Faction } from '../engine/research-params';

export interface ParamUpdate {
  [key: string]: number;
}

export type CustomCardEffect = 'none' | 'mill_enemy_deck' | 'recoil_damage' | 'heal_bench_card';

export interface CustomCardSpec {
  faction: Faction;
  name: string;
  hp: number;
  damage: number;
  cost: number;
  effect: CustomCardEffect;
  effectValue: number;
}

/**
 * Sandbox state shared by Game Simulator, Parameter Sliders and Card
 * Creator: the 25 research parameters (starting from
 * data/ga_balanced_params.json) plus session-only custom cards. Decks are
 * built by the research-engine port of fitness.build_faction_decks.
 */
export abstract class SandboxService {
  /** Emits null until data/ga_balanced_params.json has loaded. */
  abstract getParams(): Observable<ParamUpdate | null>;
  abstract getResearchParams(): Observable<ParamUpdate | null>;
  abstract getLoadError(): Observable<string | null>;
  abstract updateParam(key: string, value: number): void;
  abstract resetToResearchParams(): void;
  /** Research cards for the faction plus any custom cards; null until params load. */
  abstract getDeck(faction: Faction): FactionDeck | null;
  abstract getCustomCards(): Observable<CustomCardSpec[]>;
  abstract addCustomCard(spec: CustomCardSpec): void;
  abstract removeCustomCard(index: number): void;
}
