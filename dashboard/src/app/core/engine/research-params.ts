/**
 * Mirror of src/simulator/fitness.py BOUNDS — the research parameter space.
 * tools/verify-engine-parity.mjs parses fitness.py and fails if these drift.
 * The starting parameter values are NOT kept here: they are loaded at runtime
 * from data/ga_balanced_params.json (ResearchResultsService.loadData).
 */
export const BOUNDS: { [key: string]: [number, number] } = {
  stw_yudhistira_hp: [90, 150],
  stw_yudhistira_dmg: [20, 45],
  stw_yudhistira_dr: [10, 30],
  stw_yudhistira_heal: [15, 35],
  stw_yudhistira_cost_satwika: [1, 2],
  stw_yudhistira_cost_univ: [0, 1],
  stw_arjuna_hp: [80, 125],
  stw_arjuna_pasupati_dmg: [40, 65],
  stw_arjuna_pasupati_cost: [2, 3],
  rjs_balarama_hp: [60, 95],
  rjs_balarama_dmg: [25, 45],
  rjs_balarama_cost: [1, 2],
  rjs_karna_hp: [70, 110],
  rjs_karna_dmg: [45, 65],
  rjs_karna_recoil: [5, 20],
  rjs_karna_cost: [1, 2],
  tms_sengkuni_hp: [75, 105],
  tms_sengkuni_dmg: [20, 40],
  tms_sengkuni_mill: [1, 3],
  tms_sengkuni_cost_tamasika: [1, 2],
  tms_sengkuni_cost_univ: [0, 1],
  tms_duryodana_hp: [110, 150],
  tms_duryodana_angkara_dmg: [30, 50],
  tms_duryodana_scale_value: [3, 8],
  tms_duryodana_angkara_cost: [2, 3],
};

export type Faction = 'SATWIKA' | 'RAJASIKA' | 'TAMASIKA';

/** The 3-matchup cycle every research balance loss is computed over (fitness.evaluate_chromosome). */
export const CYCLE_MATCHUPS: [Faction, Faction][] = [
  ['SATWIKA', 'TAMASIKA'],
  ['TAMASIKA', 'RAJASIKA'],
  ['RAJASIKA', 'SATWIKA'],
];
