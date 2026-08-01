export interface CharacterState {
  name: string;
  maxHp: number;
  currentHp: number;
}

export interface PlayerState {
  name: string;
  activeCharacter: CharacterState | null;
  bench: CharacterState[];
  prana: { [key: string]: number };
  sasmita: number;
}

export interface GameLog {
  turn: number;
  message: string;
  type: 'action' | 'damage' | 'heal' | 'recoil' | 'knockout' | 'info';
}
