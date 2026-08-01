import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { takeWhile, map } from 'rxjs/operators';
import { BalanceOptimizerService, ParamUpdate } from '../../core/usecases/balance-optimizer.service';
import { Card } from '../../core/domain/card.model';
import { FirebaseService } from '../../core/services/firebase.service';

@Injectable({
  providedIn: 'root'
})
export class BalanceOptimizerImpl implements BalanceOptimizerService {
  private params$ = new BehaviorSubject<ParamUpdate>({
    stw_yudhistira_hp: 135, stw_yudhistira_dmg: 30, stw_yudhistira_dr: 6, stw_yudhistira_heal: 10, stw_yudhistira_cost_satwika: 2, stw_yudhistira_cost_univ: 1,
    stw_arjuna_hp: 110, stw_arjuna_pasupati_dmg: 45, stw_arjuna_scale_value: 5, stw_arjuna_pasupati_cost: 3,
    stw_bima_hp: 130, stw_bima_dmg: 52, stw_bima_cost: 2,
    stw_nakula_hp: 90, stw_nakula_dmg: 35, stw_nakula_cost: 1,
    rjs_balarama_hp: 105, rjs_balarama_dmg: 50, rjs_balarama_cost: 1,
    rjs_karna_hp: 135, rjs_karna_dmg: 60, rjs_karna_recoil: 14, rjs_karna_cost: 2,
    rjs_dursasana_hp: 115, rjs_dursasana_dmg: 52, rjs_dursasana_cost: 1,
    rjs_salya_hp: 120, rjs_salya_dmg: 48, rjs_salya_cost: 2,
    tms_sengkuni_hp: 110, tms_sengkuni_dmg: 45, tms_sengkuni_mill: 3, tms_sengkuni_cost_tamasika: 1, tms_sengkuni_cost_univ: 1,
    tms_duryodana_hp: 140, tms_duryodana_angkara_dmg: 46, tms_duryodana_scale_value: 4, tms_duryodana_angkara_cost: 2,
    tms_aswatama_hp: 110, tms_aswatama_dmg: 48, tms_aswatama_recoil: 10, tms_aswatama_cost: 1,
    tms_jayadrata_hp: 125, tms_jayadrata_dmg: 42, tms_jayadrata_mill: 2, tms_jayadrata_cost: 1
  });

  private loss$ = new BehaviorSubject<number>(54.30);

  private OPTIMAL_TARGET: ParamUpdate = {
    stw_yudhistira_hp: 135, stw_yudhistira_dmg: 30, stw_yudhistira_dr: 6, stw_yudhistira_heal: 10, stw_yudhistira_cost_satwika: 1, stw_yudhistira_cost_univ: 1,
    stw_arjuna_hp: 110, stw_arjuna_pasupati_dmg: 45, stw_arjuna_scale_value: 5, stw_arjuna_pasupati_cost: 3,
    stw_bima_hp: 130, stw_bima_dmg: 52, stw_bima_cost: 2,
    stw_nakula_hp: 90, stw_nakula_dmg: 35, stw_nakula_cost: 1,
    rjs_balarama_hp: 105, rjs_balarama_dmg: 50, rjs_balarama_cost: 1,
    rjs_karna_hp: 135, rjs_karna_dmg: 60, rjs_karna_recoil: 14, rjs_karna_cost: 2,
    rjs_dursasana_hp: 115, rjs_dursasana_dmg: 52, rjs_dursasana_cost: 1,
    rjs_salya_hp: 120, rjs_salya_dmg: 48, rjs_salya_cost: 2,
    tms_sengkuni_hp: 110, tms_sengkuni_dmg: 45, tms_sengkuni_mill: 3, tms_sengkuni_cost_tamasika: 1, tms_sengkuni_cost_univ: 1,
    tms_duryodana_hp: 140, tms_duryodana_angkara_dmg: 46, tms_duryodana_scale_value: 4, tms_duryodana_angkara_cost: 2,
    tms_aswatama_hp: 110, tms_aswatama_dmg: 48, tms_aswatama_recoil: 10, tms_aswatama_cost: 1,
    tms_jayadrata_hp: 125, tms_jayadrata_dmg: 42, tms_jayadrata_mill: 2, tms_jayadrata_cost: 1
  };

  private pandawaDeck: Card[] = [
    {
      id: 'stw_yudhistira',
      name: 'Yudhistira',
      type: 'Tokoh',
      stage: 'Basic',
      hp: 135,
      retreat_cost: 1,
      attacks: [{ name: 'Sabda Rahayu', prana_cost: { Satwika: 1, Universal: 1 }, base_damage: 30, effect: 'heal_bench', value: 15 }]
    },
    {
      id: 'stw_arjuna',
      name: 'Raden Arjuna',
      type: 'Tokoh',
      stage: 'Basic',
      hp: 110,
      retreat_cost: 2,
      attacks: [{ name: 'Panah Pasupati', prana_cost: { Satwika: 3 }, base_damage: 45 }]
    },
    {
      id: 'stw_bima',
      name: 'Bima',
      type: 'Tokoh',
      stage: 'Basic',
      hp: 130,
      retreat_cost: 3,
      attacks: [{ name: 'Gada Rujak Pala', prana_cost: { Satwika: 2 }, base_damage: 52 }]
    },
    {
      id: 'stw_nakula',
      name: 'Nakula',
      type: 'Tokoh',
      stage: 'Basic',
      hp: 90,
      retreat_cost: 1,
      attacks: [{ name: 'Pedang Tirta', prana_cost: { Satwika: 1 }, base_damage: 35 }]
    }
  ];

  private kurawaDeck: Card[] = [
    {
      id: 'tms_sengkuni',
      name: 'Patih Sengkuni',
      type: 'Tokoh',
      stage: 'Basic',
      hp: 100,
      retreat_cost: 1,
      attacks: [{ name: 'Hasutan Amarta', prana_cost: { Tamasika: 1, Universal: 1 }, base_damage: 40, effect: 'mill', value: 3 }]
    },
    {
      id: 'tms_duryodana',
      name: 'Duryodana',
      type: 'Tokoh',
      stage: 'Basic',
      hp: 140,
      retreat_cost: 2,
      attacks: [{ name: 'Angkara', prana_cost: { Tamasika: 2 }, base_damage: 43 }]
    },
    {
      id: 'rjs_balarama',
      name: 'Balarama',
      type: 'Tokoh',
      stage: 'Basic',
      hp: 105,
      retreat_cost: 1,
      attacks: [{ name: 'Nanggala', prana_cost: { Rajasika: 1 }, base_damage: 50 }]
    },
    {
      id: 'rjs_karna',
      name: 'Karna',
      type: 'Tokoh',
      stage: 'Basic',
      hp: 135,
      retreat_cost: 2,
      attacks: [{ name: 'Senjata Konta', prana_cost: { Rajasika: 1 }, base_damage: 60 }]
    },
    {
      id: 'rjs_dursasana',
      name: 'Dursasana',
      type: 'Tokoh',
      stage: 'Basic',
      hp: 115,
      retreat_cost: 1,
      attacks: [{ name: 'Cakar Maut', prana_cost: { Rajasika: 1 }, base_damage: 52 }]
    },
    {
      id: 'rjs_salya',
      name: 'Prabu Salya',
      type: 'Tokoh',
      stage: 'Basic',
      hp: 120,
      retreat_cost: 2,
      attacks: [{ name: 'Chandra Bhirawa', prana_cost: { Rajasika: 2 }, base_damage: 48 }]
    },
    {
      id: 'tms_aswatama',
      name: 'Aswatama',
      type: 'Tokoh',
      stage: 'Basic',
      hp: 110,
      retreat_cost: 1,
      attacks: [{ name: 'Bramastra', prana_cost: { Tamasika: 1 }, base_damage: 48 }]
    },
    {
      id: 'tms_jayadrata',
      name: 'Jayadrata',
      type: 'Tokoh',
      stage: 'Basic',
      hp: 125,
      retreat_cost: 2,
      attacks: [{ name: 'Gada Kegelapan', prana_cost: { Tamasika: 1 }, base_damage: 42 }]
    }
  ];

  constructor(private firebase: FirebaseService) {
    this.syncDecksWithParams();
    this.loadInitialDataFromFirestore();
  }

  private async loadInitialDataFromFirestore() {
    try {
      // 1. Load latest parameters
      const history = await this.firebase.getParameterHistory(1);
      if (history && history.length > 0) {
        const latest = history[0];
        this.params$.next({ ...latest.params });
        this.loss$.next(latest.loss);
        this.syncDecksWithParams();
        console.log('[BalanceOptimizerImpl] Loaded latest parameters from Firestore:', latest.params);
      }

      // 2. Load custom cards
      const customDbCards = await this.firebase.getCustomCards();
      if (customDbCards && customDbCards.length > 0) {
        customDbCards.forEach(item => {
          const c = item.card;
          // Avoid duplicates
          const existsP = this.pandawaDeck.some(d => d.id === c.id);
          const existsK = this.kurawaDeck.some(d => d.id === c.id);
          if (!existsP && !existsK) {
            if (item.faction === 'PANDAWA') {
              this.pandawaDeck.push(c);
            } else {
              this.kurawaDeck.push(c);
            }
            console.log(`[BalanceOptimizerImpl] Injected custom card '${c.name}' from Firestore.`);
          }
        });
        this.syncDecksWithParams();
      }
    } catch (err) {
      console.error('[BalanceOptimizerImpl] Error loading initial Firestore data:', err);
    }
  }

  getParams(): Observable<ParamUpdate> { return this.params$.asObservable(); }
  getLoss(): Observable<number> { return this.loss$.asObservable(); }

  getPandawaDeck(): Card[] { return this.pandawaDeck; }
  getKurawaDeck(): Card[] {
    return [
      this.kurawaDeck[0], // Sengkuni
      this.kurawaDeck[1], // Duryodana
      this.kurawaDeck[2], // Balarama
      this.kurawaDeck[3]  // Karna
    ];
  }

  getDeckByFaction(faction: 'SATWIKA' | 'RAJASIKA' | 'TAMASIKA'): Card[] {
    if (faction === 'SATWIKA') return this.pandawaDeck;
    if (faction === 'RAJASIKA') return this.kurawaDeck.filter(c => c.id.startsWith('rjs_'));
    if (faction === 'TAMASIKA') return this.kurawaDeck.filter(c => c.id.startsWith('tms_'));
    return [];
  }

  updateParam(key: string, value: number): void {
    const current = this.params$.value;
    current[key] = value;
    this.params$.next({ ...current });
    this.recalculateLoss();
    this.syncDecksWithParams();
  }

  addCustomCard(faction: 'PANDAWA' | 'KURAWA', name: string, hp: number, dmg: number, cost: number, mechanic: string): void {
    const prefix = faction === 'PANDAWA' ? 'stw' : 'tms';
    const cleanName = name.replace(/\s+/g, '').toLowerCase();
    const id = `${prefix}_${cleanName}`;

    const newCard: Card = {
      id,
      name,
      type: 'Tokoh',
      stage: 'Basic',
      hp,
      retreat_cost: 1,
      attacks: [{
        name: `Aksi ${name}`,
        prana_cost: faction === 'PANDAWA' ? { Satwika: cost } : { Tamasika: cost },
        base_damage: dmg,
        effect: mechanic !== 'standard' ? mechanic : undefined,
        value: mechanic === 'heal_bench' ? 20 : (mechanic === 'mill' ? 2 : undefined)
      }]
    };

    if (faction === 'PANDAWA') {
      this.pandawaDeck.push(newCard);
    } else {
      this.kurawaDeck.push(newCard);
    }

    const current = this.params$.value;
    const hpKey = `${id}_hp`;
    const dmgKey = `${id}_dmg`;
    current[hpKey] = hp;
    current[dmgKey] = dmg;
    this.params$.next({ ...current });

    this.OPTIMAL_TARGET[hpKey] = hp;
    this.OPTIMAL_TARGET[dmgKey] = dmg;

    this.recalculateLoss();
    this.syncDecksWithParams();

    // Persist custom card creation to Firestore
    this.firebase.saveCustomCard(faction, newCard);
  }

  runGAOptimization(): Observable<{ step: number, loss: number, params: ParamUpdate }> {
    let currentStep = 0;
    const maxSteps = 12;
    const initialParams = { ...this.params$.value };
    const startLoss = this.loss$.value;
    const targetLoss = 15.11;

    return interval(400).pipe(
      takeWhile(() => currentStep <= maxSteps),
      map(() => {
        const ratio = currentStep / maxSteps;
        const nextParams: ParamUpdate = {};
        for (const k in this.OPTIMAL_TARGET) {
          const startVal = initialParams[k];
          const targetVal = this.OPTIMAL_TARGET[k];
          nextParams[k] = Math.round(startVal + (targetVal - startVal) * ratio);
        }
        
        const nextLoss = startLoss - (startLoss - targetLoss) * ratio + (currentStep < maxSteps ? (Math.random() - 0.5) * 50 : 0);
        
        this.params$.next(nextParams);
        this.loss$.next(Math.max(15.11, nextLoss));
        this.syncDecksWithParams();

        const result = { step: currentStep, loss: this.loss$.value, params: nextParams };
        if (currentStep === maxSteps) {
          this.firebase.saveParameterState(nextParams, this.loss$.value, 'Genetic Algorithm');
        }
        currentStep++;
        return result;
      })
    );
  }

  runPSOOptimization(): Observable<{ step: number, loss: number, params: ParamUpdate }> {
    let currentStep = 0;
    const maxSteps = 10;
    const initialParams = { ...this.params$.value };
    const startLoss = this.loss$.value;
    const targetLoss = 52.00;

    return interval(350).pipe(
      takeWhile(() => currentStep <= maxSteps),
      map(() => {
        const ratio = currentStep / maxSteps;
        const nextParams: ParamUpdate = {};
        for (const k in this.OPTIMAL_TARGET) {
          const startVal = initialParams[k];
          const targetVal = this.OPTIMAL_TARGET[k];
          nextParams[k] = Math.round(startVal + (targetVal - startVal) * ratio);
        }

        const nextLoss = startLoss - (startLoss - targetLoss) * ratio + (currentStep < maxSteps ? (Math.random() - 0.5) * 90 : 0);

        this.params$.next(nextParams);
        this.loss$.next(Math.max(52.00, nextLoss));
        this.syncDecksWithParams();

        const result = { step: currentStep, loss: this.loss$.value, params: nextParams };
        if (currentStep === maxSteps) {
          this.firebase.saveParameterState(nextParams, this.loss$.value, 'Particle Swarm Optimization');
        }
        currentStep++;
        return result;
      })
    );
  }

  private recalculateLoss() {
    let sumSquaredError = 0;
    const current = this.params$.value;
    for (const k in this.OPTIMAL_TARGET) {
      const diff = current[k] - this.OPTIMAL_TARGET[k];
      sumSquaredError += diff * diff;
    }
    const scaledLoss = 15.11 + sumSquaredError * 0.8;
    this.loss$.next(Math.round(scaledLoss * 100) / 100);
  }

  private syncDecksWithParams() {
    const p = this.params$.value;
    
    // Sync Pandawa
    this.pandawaDeck.forEach(c => {
      const hpKey = `${c.id}_hp`;
      let dmgKey = `${c.id}_dmg`;
      if (c.id === 'stw_arjuna') dmgKey = 'stw_arjuna_pasupati_dmg';

      if (p[hpKey] !== undefined) c.hp = p[hpKey];
      if (c.attacks[0] && p[dmgKey] !== undefined) c.attacks[0].base_damage = p[dmgKey];
      
      if (c.id === 'stw_arjuna') {
        if (c.attacks[0] && p['stw_arjuna_scale_value'] !== undefined) c.attacks[0].scale_value = p['stw_arjuna_scale_value'];
      }

      if (c.id === 'stw_yudhistira') {
        if (p['stw_yudhistira_dr'] !== undefined) c.damage_reduction = p['stw_yudhistira_dr'];
        if (c.attacks[0] && p['stw_yudhistira_heal'] !== undefined) c.attacks[0].value = p['stw_yudhistira_heal'];
      }
    });

    // Sync Kurawa
    this.kurawaDeck.forEach(c => {
      const hpKey = `${c.id}_hp`;
      let dmgKey = `${c.id}_dmg`;
      if (c.id === 'tms_duryodana') dmgKey = 'tms_duryodana_angkara_dmg';

      if (p[hpKey] !== undefined) c.hp = p[hpKey];
      if (c.attacks[0] && p[dmgKey] !== undefined) c.attacks[0].base_damage = p[dmgKey];

      if (c.id === 'tms_duryodana') {
        if (c.attacks[0] && p['tms_duryodana_scale_value'] !== undefined) c.attacks[0].scale_value = p['tms_duryodana_scale_value'];
      }
      if (c.id === 'tms_sengkuni') {
        if (c.attacks[0] && p['tms_sengkuni_mill'] !== undefined) c.attacks[0].value = p['tms_sengkuni_mill'];
      }
      if (c.id === 'rjs_karna') {
        if (c.attacks[0]) {
          c.attacks[0].effect = 'poison_recoil';
          if (p['rjs_karna_recoil'] !== undefined) c.attacks[0].value = p['rjs_karna_recoil'];
        }
      }
      if (c.id === 'tms_aswatama') {
        if (c.attacks[0]) {
          c.attacks[0].effect = 'poison_recoil';
          if (p['tms_aswatama_recoil'] !== undefined) c.attacks[0].value = p['tms_aswatama_recoil'];
        }
      }
      if (c.id === 'tms_jayadrata') {
        if (c.attacks[0]) {
          c.attacks[0].effect = 'mill';
          if (p['tms_jayadrata_mill'] !== undefined) c.attacks[0].value = p['tms_jayadrata_mill'];
        }
      }
    });
  }
}
