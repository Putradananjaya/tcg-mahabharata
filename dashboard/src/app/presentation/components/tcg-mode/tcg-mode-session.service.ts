import { Injectable } from '@angular/core';
import { Faction } from '../../../core/engine/research-params';
import { TcgGame } from '../../../core/engine/tcg-mode-engine';

export type PlayMode = 'human' | 'bots';

/** Settings that define a match; changing them only takes effect on the next start. */
export interface TcgMatchSettings {
  playMode: PlayMode;
  p1Faction: Faction;
  p2Faction: Faction;
  seed: number;
}

export interface TcgModeSnapshot {
  settings: TcgMatchSettings;
  speed: string;
  soundOn: boolean;
  game: TcgGame | null;
  /** Settings the game on the board was started with. */
  started: TcgMatchSettings | null;
}

/**
 * Keeps the Mode TCG match while the user visits other pages: the router
 * destroys TcgModeComponent on navigation, and coming back must continue the
 * same match instead of starting (and coin-flipping) a new one.
 */
@Injectable({ providedIn: 'root' })
export class TcgModeSession {
  snapshot: TcgModeSnapshot | null = null;
}
