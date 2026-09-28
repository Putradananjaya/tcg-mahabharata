import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CustomCardSpec, ParamUpdate, SandboxService } from '../../core/usecases/sandbox.service';
import { CardDef, FactionDeck, buildFactionDecks } from '../../core/engine/research-engine';
import { Faction } from '../../core/engine/research-params';
import { ResearchResultsService } from '../../core/services/research-results.service';

const PRANA_OF: { [faction: string]: string } = { SATWIKA: 'Satwika', RAJASIKA: 'Rajasika', TAMASIKA: 'Tamasika' };

@Injectable({ providedIn: 'root' })
export class SandboxImpl implements SandboxService {
  private research$ = new BehaviorSubject<ParamUpdate | null>(null);
  private params$ = new BehaviorSubject<ParamUpdate | null>(null);
  private error$ = new BehaviorSubject<string | null>(null);
  private custom$ = new BehaviorSubject<CustomCardSpec[]>([]);

  constructor(research: ResearchResultsService) {
    research.loadData<ParamUpdate>('ga_balanced_params')
      .then((params) => {
        this.research$.next({ ...params });
        this.params$.next({ ...params });
      })
      .catch((err) => this.error$.next(err?.message ?? String(err)));
  }

  getParams(): Observable<ParamUpdate | null> { return this.params$.asObservable(); }
  getResearchParams(): Observable<ParamUpdate | null> { return this.research$.asObservable(); }
  getLoadError(): Observable<string | null> { return this.error$.asObservable(); }
  getCustomCards(): Observable<CustomCardSpec[]> { return this.custom$.asObservable(); }

  updateParam(key: string, value: number): void {
    const current = this.params$.value;
    if (!current) return;
    this.params$.next({ ...current, [key]: value });
  }

  resetToResearchParams(): void {
    const research = this.research$.value;
    if (research) this.params$.next({ ...research });
  }

  getDeck(faction: Faction): FactionDeck | null {
    const params = this.params$.value;
    if (!params) return null;
    const base = buildFactionDecks(params)[faction];
    const custom = this.custom$.value
      .map((spec, index) => ({ spec, index }))
      .filter(({ spec }) => spec.faction === faction)
      .map(({ spec, index }) => this.toCardDef(spec, index));
    return { faction: base.faction, cards: [...base.cards, ...custom] };
  }

  addCustomCard(spec: CustomCardSpec): void {
    this.custom$.next([...this.custom$.value, { ...spec }]);
  }

  removeCustomCard(index: number): void {
    this.custom$.next(this.custom$.value.filter((_, i) => i !== index));
  }

  private toCardDef(spec: CustomCardSpec, index: number): CardDef {
    return {
      id: `CUSTOM-${index}`,
      name: spec.name,
      type: 'Tokoh',
      stage: 'Basic',
      hp: spec.hp,
      retreat_cost: 1,
      attacks: [{
        name: `Serangan ${spec.name}`,
        prana_cost: { [PRANA_OF[spec.faction]]: spec.cost },
        base_damage: spec.damage,
        ...(spec.effect !== 'none' ? { effect: spec.effect, value: spec.effectValue } : {}),
      }],
    };
  }
}
