export interface Attack {
  name: string;
  prana_cost: { [key: string]: number };
  base_damage: number;
  effect?: string;
  value?: number;
  bench_scaling?: number;
  scale_value?: number;
}

export interface Card {
  id: string;
  name: string;
  type: string;
  stage: string;
  hp: number;
  retreat_cost: number;
  damage_reduction?: number;
  attacks: Attack[];
}

export interface FactionData {
  faction: string;
  cards: Card[];
}
