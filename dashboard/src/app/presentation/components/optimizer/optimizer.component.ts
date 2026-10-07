import { Component, OnInit, OnDestroy, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CustomCardEffect, CustomCardSpec, ParamUpdate, SandboxService } from '../../../core/usecases/sandbox.service';
import { ResearchResultsService } from '../../../core/services/research-results.service';
import { Match, mulberry32 } from '../../../core/engine/research-engine';
import { BOUNDS, CYCLE_MATCHUPS, Faction } from '../../../core/engine/research-params';
import { WilsonInterval, wilsonCi } from '../../../core/engine/stats';
import { CharacterArtComponent } from '../character-art/character-art.component';
import { LanguageService } from '../../../core/services/language.service';

interface MatchupResult {
  row: Faction;
  col: Faction;
  ci: WilsonInterval;
  turnCapEndings: number;
  meanTurns: number;
}

interface ReferenceCell {
  row: Faction;
  col: Faction;
  winRate: number;
  lower: number;
  upper: number;
  n: number;
}

const FACTION_LABEL: { [f: string]: string } = {
  SATWIKA: 'Pandawa (Satwika)',
  RAJASIKA: 'Rajasika',
  TAMASIKA: 'Kurawa (Tamasika)',
};

const LABELS: { [key: string]: string } = {
  stw_yudhistira_hp: 'Yudhistira HP',
  stw_yudhistira_dmg: 'Sabda Rahayu Damage',
  stw_yudhistira_dr: 'Damage Reduction Value',
  stw_yudhistira_heal: 'Sabda Rahayu Heal Value',
  stw_yudhistira_cost_satwika: 'Yudhistira Satwika Cost',
  stw_yudhistira_cost_univ: 'Yudhistira Universal Cost',
  stw_arjuna_hp: 'Arjuna HP',
  stw_arjuna_pasupati_dmg: 'Panah Pasupati Damage',
  stw_arjuna_pasupati_cost: 'Pasupati Satwika Cost',
  rjs_balarama_hp: 'Balarama HP',
  rjs_balarama_dmg: 'Nanggala Damage',
  rjs_balarama_cost: 'Balarama Rajasika Cost',
  rjs_karna_hp: 'Karna HP',
  rjs_karna_dmg: 'Senjata Konta Damage',
  rjs_karna_recoil: 'Karna Recoil Damage',
  rjs_karna_cost: 'Karna Rajasika Cost',
  tms_sengkuni_hp: 'Sengkuni HP',
  tms_sengkuni_dmg: 'Hasutan Amarta Damage',
  tms_sengkuni_mill: 'Hasutan Amarta Mill Count',
  tms_sengkuni_cost_tamasika: 'Sengkuni Tamasika Cost',
  tms_sengkuni_cost_univ: 'Sengkuni Universal Cost',
  tms_duryodana_hp: 'Duryodana HP',
  tms_duryodana_angkara_dmg: 'Angkara Base Damage',
  tms_duryodana_scale_value: 'Angkara Discard Scaling',
  tms_duryodana_angkara_cost: 'Duryodana Tamasika Cost',
};

@Component({
  selector: 'app-optimizer',
  standalone: true,
  imports: [CommonModule, FormsModule, CharacterArtComponent],
  template: `
    <div class="optimizer-layout">

      <div class="research-error" *ngIf="loadError">
        {{ t('Gagal memuat parameter riset', 'Failed to load the research parameters') }} (data/ga_balanced_params.json): {{ loadError }}.
        {{ t('Sandbox tidak bisa dipakai tanpa parameter ini — tidak ada nilai cadangan yang dipakai diam-diam.', 'The sandbox cannot be used without these parameters — no fallback values are silently used.') }}
      </div>

      <!-- ===================== CARD CREATOR ===================== -->
      <ng-container *ngIf="viewMode === 'creator'">
        <div class="welcome-banner md-card">
          <div class="banner-icon">➕</div>
          <div class="banner-text">
            <h2>Card Creator (Sandbox)</h2>
            @if (i18n.isEn()) {
            <p>
              Add a new card type to a faction's deck, then try it in the Game Simulator or test it in Parameter Sliders.
              Custom cards <strong>exist only in this browser session</strong> (they disappear when the page is reloaded) and do not
              affect the research results.
            </p>
            } @else {
            <p>
              Tambahkan jenis kartu baru ke deck sebuah faksi, lalu coba di Game Simulator atau uji di Parameter Sliders.
              Kartu kustom <strong>hanya ada di sesi browser ini</strong> (hilang saat halaman di-reload) dan tidak
              memengaruhi hasil riset.
            </p>
            }
          </div>
        </div>

        <div class="creator-panel md-card">
          <h3>{{ t('Buat Kartu Baru', 'Create a New Card') }}</h3>
          <div class="creator-form">
            <div class="form-row">
              <div class="form-group">
                <label>{{ t('Nama Karakter', 'Character Name') }}</label>
                <input type="text" [(ngModel)]="newName" [placeholder]="t('misal: Gatotkaca', 'e.g. Gatotkaca')" class="md-input">
              </div>
              <div class="form-group">
                <label>{{ t('Faksi', 'Faction') }}</label>
                <select [(ngModel)]="newFaction" class="md-select">
                  <option *ngFor="let f of factions" [value]="f">{{ factionLabel(f) }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>{{ t('Efek Serangan', 'Attack Effect') }}</label>
                <select [(ngModel)]="newEffect" class="md-select">
                  <option value="none">{{ t('Tanpa efek (damage saja)', 'No effect (damage only)') }}</option>
                  <option value="mill_enemy_deck">{{ t('Mill — buang kartu deck lawan', 'Mill — discard cards from the opponent deck') }}</option>
                  <option value="recoil_damage">{{ t('Recoil — penyerang ikut terluka', 'Recoil — the attacker is hurt too') }}</option>
                  <option value="heal_bench_card">{{ t('Heal Bench — catatan: selalu 0 di engine ini', 'Heal Bench — note: always 0 in this engine') }}</option>
                </select>
              </div>
            </div>
            <div class="form-row sliders-row">
              <div class="form-group">
                <label>HP: <strong>{{ newHp }}</strong></label>
                <input type="range" min="60" max="160" [(ngModel)]="newHp" class="md-slider">
              </div>
              <div class="form-group">
                <label>Damage: <strong>{{ newDamage }}</strong></label>
                <input type="range" min="20" max="80" [(ngModel)]="newDamage" class="md-slider">
              </div>
              <div class="form-group">
                <label>{{ t('Biaya Prana', 'Prana Cost') }} {{ pranaOf(newFaction) }}: <strong>{{ newCost }}</strong></label>
                <input type="range" min="0" max="3" [(ngModel)]="newCost" class="md-slider">
              </div>
              <div class="form-group" *ngIf="newEffect !== 'none'">
                <label>{{ t('Nilai efek', 'Effect value') }}: <strong>{{ newEffectValue }}</strong></label>
                <input type="range" min="1" max="30" [(ngModel)]="newEffectValue" class="md-slider">
              </div>
              <div class="form-group action-group">
                <button (click)="createCard()" [disabled]="!params" class="md-btn md-btn-primary">➕ {{ t('Tambahkan Kartu', 'Add Card') }}</button>
              </div>
            </div>
            <div class="error-message-banner" *ngIf="errorMessage">{{ errorMessage }}</div>
            <div class="success-message-banner" *ngIf="successMessage">{{ successMessage }}</div>
          </div>

          <div class="research-caveat" style="margin-top: 16px;">
            {{ t('Cara engine memakai kartu ini: setiap jenis kartu dimasukkan 20 salinan ke deck (deck riset asli berisi 2 jenis kartu). Karakter aktif dipilih otomatis dari 7 kartu awal dengan prioritas Yudhistira, Patih Sengkuni, lalu Karna — jadi kartu kustom biasanya mulai di Bench dan baru bertarung setelah karakter di depannya gugur.',
                 'How the engine uses this card: each card type is put into the deck as 20 copies (the original research decks have 2 card types). The active character is picked automatically from the 7 opening cards with priority Yudhistira, Patih Sengkuni, then Karna — so a custom card usually starts on the Bench and only fights after the character in front of it is knocked out.') }}
          </div>
        </div>

        <div class="md-card research-section" *ngIf="customCards.length">
          <h3>{{ t('Kartu kustom di sesi ini', 'Custom cards in this session') }} ({{ customCards.length }})</h3>
          <table class="research-table">
            <thead><tr><th>{{ t('Nama', 'Name') }}</th><th>{{ t('Faksi', 'Faction') }}</th><th>HP</th><th>Damage</th><th>{{ t('Biaya', 'Cost') }}</th><th>{{ t('Efek', 'Effect') }}</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let c of customCards; let i = index">
                <td>{{ c.name }}</td>
                <td>{{ factionLabel(c.faction) }}</td>
                <td>{{ c.hp }}</td>
                <td>{{ c.damage }}</td>
                <td>{{ c.cost }} {{ pranaOf(c.faction) }}</td>
                <td>{{ effectLabel(c.effect) }}{{ c.effect !== 'none' ? ' (' + c.effectValue + ')' : '' }}</td>
                <td><button class="md-btn md-btn-outlined" (click)="removeCustomCard(i)">{{ t('Hapus', 'Remove') }}</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </ng-container>

      <!-- ===================== PARAMETER SLIDERS ===================== -->
      <ng-container *ngIf="viewMode === 'sliders'">
        <div class="welcome-banner md-card">
          <div class="banner-icon">🎛️</div>
          <div class="banner-text">
            <h2>Parameter Sliders (Sandbox)</h2>
            @if (i18n.isEn()) {
            <p>
              Set the 25 research parameters by hand, then test the result with real matches. Starting values come
              from <code>data/ga_balanced_params.json</code> (parameters found by the GA) and the slider ranges follow the
              research parameter space (<code>BOUNDS</code> in <code>src/simulator/fitness.py</code>).
            </p>
            } @else {
            <p>
              Atur 25 parameter riset secara manual, lalu uji hasilnya dengan pertandingan sungguhan. Nilai awal diambil
              dari <code>data/ga_balanced_params.json</code> (parameter hasil optimasi GA) dan rentang slider mengikuti
              ruang parameter riset (<code>BOUNDS</code> di <code>src/simulator/fitness.py</code>).
            </p>
            }
          </div>
        </div>

        <!-- Real sandbox test: plays the 3-matchup cycle with the research-engine port. -->
        <div class="md-card research-section" *ngIf="params">
          <div class="research-section-head">
            <h3>{{ t('Uji parameter ini', 'Test these parameters') }}</h3>
            <span class="research-source">{{ t('engine: port TS dari engine riset Python', 'engine: TS port of the Python research engine') }}</span>
          </div>
          <p class="section-desc">
            {{ t('Menjalankan pertandingan sungguhan untuk 3 matchup siklus yang sama dengan riset (Satwika vs Tamasika, Tamasika vs Rajasika, Rajasika vs Satwika). Skor ketidakseimbangan = Σ(win rate − 50)² atas 3 matchup — rumus yang sama dengan fungsi loss riset; 0 = seimbang sempurna.',
                 'Plays real matches for the same 3 cycle matchups as the research (Satwika vs Tamasika, Tamasika vs Rajasika, Rajasika vs Satwika). Imbalance score = Σ(win rate − 50)² over the 3 matchups — the same formula as the research loss function; 0 = perfectly balanced.') }}
            <span *ngIf="changedParamCount() > 0"><strong>{{ changedParamCount() }}</strong> {{ t('parameter berbeda dari parameter riset.', 'parameter(s) differ from the research parameters.') }}</span>
          </p>

          <div class="sandbox-controls">
            <label>{{ t('Jumlah pertandingan per matchup', 'Games per matchup') }}
              <select [(ngModel)]="testN" class="md-select" [disabled]="testRunning">
                <option [ngValue]="1000">{{ t('1.000 (cepat, CI ±3 pp)', '1,000 (fast, CI ±3 pp)') }}</option>
                <option [ngValue]="5000">{{ t('5.000 (CI ±1,4 pp)', '5,000 (CI ±1.4 pp)') }}</option>
                <option [ngValue]="20000">{{ t('20.000 (standar riset, CI ±0,7 pp)', '20,000 (research standard, CI ±0.7 pp)') }}</option>
              </select>
            </label>
            <label>Seed
              <input type="number" [(ngModel)]="testSeed" class="md-input" [disabled]="testRunning" style="width: 120px;">
            </label>
            <button class="md-btn md-btn-primary" (click)="runSandboxTest()" [disabled]="testRunning">
              {{ testRunning ? t('Menjalankan… ', 'Running… ') + (testProgress * 100 | number:'1.0-0') + '%' : t('▶ Uji sekarang', '▶ Test now') }}
            </button>
            <button class="md-btn md-btn-outlined" (click)="resetParams()" [disabled]="testRunning || changedParamCount() === 0">
              ↺ {{ t('Kembalikan ke parameter riset', 'Reset to research parameters') }}
            </button>
          </div>

          <ng-container *ngIf="testResults">
            <table class="research-table">
              <thead>
                <tr>
                  <th>{{ t('Matchup (baris menang vs kolom)', 'Matchup (row wins vs column)') }}</th>
                  <th>Sandbox: win rate</th><th>95% CI (Wilson)</th><th>n</th>
                  <th>{{ t('Referensi riset (Python, parameter riset)', 'Research reference (Python, research parameters)') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of testResults; let i = index">
                  <td>{{ r.row }} vs {{ r.col }}</td>
                  <td><strong>{{ r.ci.pHat * 100 | number:'1.1-1' }}%</strong></td>
                  <td class="ci">[{{ r.ci.lower * 100 | number:'1.1-1' }}, {{ r.ci.upper * 100 | number:'1.1-1' }}]</td>
                  <td>{{ r.ci.n | number }}</td>
                  <td class="ci">
                    <ng-container *ngIf="referenceCells">
                      {{ referenceCells[i].winRate * 100 | number:'1.1-1' }}%
                      [{{ referenceCells[i].lower * 100 | number:'1.1-1' }}, {{ referenceCells[i].upper * 100 | number:'1.1-1' }}],
                      n = {{ referenceCells[i].n | number }}
                    </ng-container>
                    <span *ngIf="!referenceCells">{{ t('tidak tersedia', 'not available') }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="paired-grid">
              <div class="paired-card">
                <h4>{{ t('Skor ketidakseimbangan — parameter kamu (sandbox)', 'Imbalance score — your parameters (sandbox)') }}</h4>
                <div class="paired-value">{{ testLoss | number:'1.1-1' }}</div>
                <p class="paired-stats">
                  Seed {{ testedSeed }}, {{ testResults[0].ci.n | number }} {{ t('pertandingan/matchup.', 'games/matchup.') }}
                  <span *ngIf="turnCapTotal() > 0">{{ turnCapTotal() }} {{ t('pertandingan berakhir di batas 100 giliran (pemenang lewat HP).', 'games ended at the 100-turn cap (winner decided by HP).') }}</span>
                </p>
              </div>
              <div class="paired-card" *ngIf="referenceLoss !== null">
                <h4>{{ t('Skor ketidakseimbangan — parameter riset (engine Python)', 'Imbalance score — research parameters (Python engine)') }}</h4>
                <div class="paired-value">{{ referenceLoss | number:'1.1-1' }}</div>
                <p class="paired-stats">{{ t('Dari', 'From') }} <code>results/exp03_balance_matrix.json</code> (ga_balanced), n = {{ referenceCells?.[0]?.n | number }}/matchup.</p>
              </div>
            </div>
            @if (i18n.isEn()) {
            <p class="payoff-caption">
              Noise note: even if all three matchups were exactly 50%, the average score would still be about
              <strong>{{ noiseFloor(testResults[0].ci.n) | number:'1.2-2' }}</strong> purely from sampling randomness at
              n = {{ testResults[0].ci.n | number }} (= 3 × 10,000 × 0.25 / n). A score around that value cannot yet be told apart
              from balanced — increase n before comparing two settings. "Balanced" here is measured with the engine's built-in
              automatic attack choice.
            </p>
            } @else {
            <p class="payoff-caption">
              Catatan noise: walaupun ketiga matchup benar-benar 50%, skor rata-rata tetap sekitar
              <strong>{{ noiseFloor(testResults[0].ci.n) | number:'1.2-2' }}</strong> hanya karena acak sampel pada
              n = {{ testResults[0].ci.n | number }} (= 3 × 10.000 × 0,25 / n). Skor di sekitar angka itu belum bisa dibedakan
              dari seimbang — naikkan n sebelum membandingkan dua pengaturan. "Seimbang" di sini diukur dengan pemilihan
              serangan otomatis bawaan engine.
            </p>
            }
          </ng-container>
        </div>

        <div class="sliders-container" *ngIf="params">
          <div class="faction-group md-card" *ngFor="let f of sliderFactions">
            <h3 class="faction-title" [ngClass]="f.cssClass">
              {{ factionLabel(f.faction) }} &mdash; {{ getCharacterGroups(f.prefix).length }} {{ t('karakter', 'characters') }}
              <span *ngIf="customCountFor(f.faction)"> + {{ customCountFor(f.faction) }} {{ t('kartu kustom', 'custom cards') }}</span>
            </h3>
            <div class="character-group" *ngFor="let group of getCharacterGroups(f.prefix)">
              <app-character-art
                [key]="group.characterName.toLowerCase()"
                [hp]="statOf(group.keys, '_hp')"
                [damage]="statOf(group.keys, '_dmg')">
              </app-character-art>
              <div class="sliders-grid">
                <div class="slider-row" *ngFor="let key of group.keys">
                  <div class="slider-labels">
                    <span class="slider-name">{{ getLabel(key) }}</span>
                    <span class="slider-val" [class.changed-val]="isChanged(key)">{{ params[key] }}</span>
                  </div>
                  <p class="slider-desc">{{ getStatDescription(key) }}</p>
                  <input
                    type="range"
                    [min]="sliderMin(key)"
                    [max]="sliderMax(key)"
                    [value]="params[key]"
                    [disabled]="testRunning"
                    (input)="onSliderChange(key, $event)"
                    class="md-slider">
                  <p class="slider-warning" *ngIf="isOutOfBounds(key)">
                    {{ t('Nilai', 'Value') }} {{ params[key] }} {{ t('di luar rentang riset', 'is outside the research range') }} [{{ bounds(key)[0] }}, {{ bounds(key)[1] }}] —
                    {{ t('nilai ini berasal dari ga_balanced_params.json apa adanya.', 'this value comes from ga_balanced_params.json as is.') }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

    </div>
  `
})
export class OptimizerComponent implements OnInit, OnDestroy {
  @Input() viewMode: 'creator' | 'sliders' = 'sliders';

  readonly factions: Faction[] = ['SATWIKA', 'RAJASIKA', 'TAMASIKA'];
  readonly sliderFactions = [
    { faction: 'SATWIKA' as Faction, prefix: 'stw_', cssClass: 'satwika-color' },
    { faction: 'RAJASIKA' as Faction, prefix: 'rjs_', cssClass: 'rajasika-color' },
    { faction: 'TAMASIKA' as Faction, prefix: 'tms_', cssClass: 'tamasika-color' },
  ];

  params: ParamUpdate | null = null;
  researchParams: ParamUpdate | null = null;
  loadError: string | null = null;
  customCards: CustomCardSpec[] = [];

  // Card Creator form
  newName = '';
  newFaction: Faction = 'SATWIKA';
  newHp = 100;
  newDamage = 40;
  newCost = 1;
  newEffect: CustomCardEffect = 'none';
  newEffectValue = 10;
  successMessage = '';
  errorMessage = '';

  // Sandbox test
  testN = 1000;
  testSeed = 20260801;
  testedSeed = 0;
  testRunning = false;
  testProgress = 0;
  testResults: MatchupResult[] | null = null;
  testLoss = 0;
  referenceCells: ReferenceCell[] | null = null;
  referenceLoss: number | null = null;

  private subs: Subscription[] = [];

  readonly i18n = inject(LanguageService);
  readonly t = this.i18n.t;

  constructor(private sandbox: SandboxService, private research: ResearchResultsService) { }

  ngOnInit(): void {
    this.subs.push(
      this.sandbox.getParams().subscribe((p) => this.params = p),
      this.sandbox.getResearchParams().subscribe((p) => this.researchParams = p),
      this.sandbox.getLoadError().subscribe((e) => this.loadError = e),
      this.sandbox.getCustomCards().subscribe((c) => this.customCards = c),
    );
    this.research.loadResult('exp03_balance_matrix')
      .then((exp03) => {
        const matrix = exp03.ga_balanced.payoff_matrix;
        this.referenceCells = CYCLE_MATCHUPS.map(([row, col]) => {
          const cell = matrix[`${row}_vs_${col}`];
          return { row, col, winRate: cell.win_rate, lower: cell.wilson_ci_95.lower, upper: cell.wilson_ci_95.upper, n: cell.n };
        });
        this.referenceLoss = this.referenceCells.reduce((s, c) => s + (c.winRate * 100 - 50) ** 2, 0);
      })
      .catch(() => { this.referenceCells = null; this.referenceLoss = null; });
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  factionLabel(f: Faction): string {
    return FACTION_LABEL[f] ?? f;
  }

  pranaOf(f: Faction): string {
    return f.charAt(0) + f.slice(1).toLowerCase();
  }

  effectLabel(effect: CustomCardEffect): string {
    return {
      none: this.t('Tanpa efek', 'No effect'), mill_enemy_deck: 'Mill', recoil_damage: 'Recoil',
      heal_bench_card: this.t('Heal Bench (selalu 0)', 'Heal Bench (always 0)'),
    }[effect];
  }

  customCountFor(f: Faction): number {
    return this.customCards.filter(c => c.faction === f).length;
  }

  // Groups a faction's param keys by character (2nd underscore segment, e.g. "stw_arjuna_hp" -> "Arjuna").
  getCharacterGroups(prefix: string): { characterName: string, keys: string[] }[] {
    const groups: { characterName: string, keys: string[] }[] = [];
    const indexByName: { [name: string]: number } = {};
    for (const key of Object.keys(this.params ?? {}).filter(k => k.startsWith(prefix))) {
      const rawName = key.split('_')[1] || key;
      const characterName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      if (!(characterName in indexByName)) {
        indexByName[characterName] = groups.length;
        groups.push({ characterName, keys: [] });
      }
      groups[indexByName[characterName]].keys.push(key);
    }
    return groups;
  }

  /** Current value of the first param in `keys` ending with `suffix`, or null if none. */
  statOf(keys: string[], suffix: string): number | null {
    const key = keys.find(k => k.endsWith(suffix));
    return key && this.params ? this.params[key] : null;
  }

  getLabel(key: string): string {
    return LABELS[key] ?? key;
  }

  bounds(key: string): [number, number] {
    return BOUNDS[key] ?? [0, 100];
  }

  sliderMin(key: string): number {
    return Math.min(this.bounds(key)[0], this.params?.[key] ?? Infinity);
  }

  sliderMax(key: string): number {
    return Math.max(this.bounds(key)[1], this.params?.[key] ?? -Infinity);
  }

  isOutOfBounds(key: string): boolean {
    const value = this.params?.[key];
    const [low, high] = this.bounds(key);
    return value !== undefined && (value < low || value > high);
  }

  isChanged(key: string): boolean {
    return !!this.researchParams && this.params?.[key] !== this.researchParams[key];
  }

  changedParamCount(): number {
    return Object.keys(this.params ?? {}).filter(k => this.isChanged(k)).length;
  }

  // Plain-language caption shown under every slider, describing what research-engine.ts actually does with it.
  getStatDescription(key: string): string {
    const t = this.t;
    if (key === 'stw_arjuna_pasupati_dmg') {
      return t('Damage dasar Panah Pasupati. Engine menambah +5 per karakter di Bench sendiri (maks +15) — bonus itu tetap, bukan parameter.',
        'Base damage of Panah Pasupati. The engine adds +5 per character on your own Bench (max +15) — that bonus is fixed, not a parameter.');
    }
    if (key === 'tms_duryodana_scale_value') {
      return t('Bonus damage Angkara per kartu di discard pile lawan (discard pile hanya terisi oleh Mill Sengkuni).',
        'Angkara bonus damage per card in the opponent discard pile (the discard pile is only filled by Sengkuni\'s Mill).');
    }
    if (key === 'stw_yudhistira_heal') {
      return t('Jumlah HP yang coba dipulihkan ke Bench. Di engine ini selalu 0, karena karakter di Bench tidak pernah terluka — slider ini tidak mengubah hasil.',
        'HP the attack tries to restore on the Bench. Always 0 in this engine, because Bench characters are never damaged — this slider does not change the result.');
    }
    if (key.endsWith('_cost_univ')) return t('Biaya Prana Universal (boleh dibayar Prana tipe apa pun) untuk serangan ini.', 'Universal Prana cost (payable with any Prana type) for this attack.');
    if (key.includes('cost')) return t('Biaya Prana tipe faksi untuk serangan ini. Kalau belum cukup, karakter menunggu (kecuali HP ≤ 40%).', 'Faction-type Prana cost for this attack. If there is not enough yet, the character waits (unless HP ≤ 40%).');
    if (key.endsWith('_hp')) return t('Nyawa karakter. Habis = gugur, lawan mengklaim 1 prize (Sasmita).', 'Character hit points. At 0 = knocked out, and the opponent claims 1 prize (Sasmita).');
    if (key.endsWith('_dr')) return t('Mengurangi setiap damage yang diterima karakter ini.', 'Reduces every hit of damage this character takes.');
    if (key.includes('recoil')) return t('Damage yang diterima penyerang sendiri setiap kali serangan ini dipakai.', 'Damage the attacker takes itself every time this attack is used.');
    if (key.includes('mill')) return t('Jumlah kartu deck lawan yang dibuang ke discard pile setiap serangan.', 'Number of opponent deck cards sent to the discard pile with each attack.');
    if (key.includes('dmg')) return t('Damage dasar serangan ini, sebelum dikurangi DR lawan.', 'Base damage of this attack, before the opponent\'s DR is subtracted.');
    return '';
  }

  onSliderChange(key: string, event: Event) {
    this.sandbox.updateParam(key, parseInt((event.target as HTMLInputElement).value, 10));
  }

  resetParams() {
    this.sandbox.resetToResearchParams();
  }

  /** Expected loss from sampling noise alone when every cycle matchup is exactly 50%: 3 * 10000 * 0.25 / n. */
  noiseFloor(n: number): number {
    return (CYCLE_MATCHUPS.length * 10000 * 0.25) / n;
  }

  turnCapTotal(): number {
    return (this.testResults ?? []).reduce((s, r) => s + r.turnCapEndings, 0);
  }

  async runSandboxTest(): Promise<void> {
    if (this.testRunning) return;
    const decks = Object.fromEntries(this.factions.map(f => [f, this.sandbox.getDeck(f)]));
    if (this.factions.some(f => !decks[f])) return;

    this.testRunning = true;
    this.testProgress = 0;
    const n = this.testN;
    const seed = Number(this.testSeed) || 0;
    const rng = mulberry32(seed);
    const chunk = 500;
    const results: MatchupResult[] = [];
    const total = n * CYCLE_MATCHUPS.length;
    let done = 0;

    for (const [row, col] of CYCLE_MATCHUPS) {
      let wins = 0;
      let turnCapEndings = 0;
      let turns = 0;
      for (let i = 0; i < n; i++) {
        const match = new Match(decks[row]!, decks[col]!, row, col, rng);
        match.runToEnd();
        if (match.winnerIndex === 0) wins++;
        if (match.endedByTurnCap) turnCapEndings++;
        turns += Math.min(match.turn, 100);
        if (++done % chunk === 0) {
          this.testProgress = done / total;
          await new Promise(resolve => setTimeout(resolve));
        }
      }
      results.push({ row, col, ci: wilsonCi(wins, n), turnCapEndings, meanTurns: turns / n });
    }

    this.testResults = results;
    this.testLoss = results.reduce((s, r) => s + (r.ci.pHat * 100 - 50) ** 2, 0);
    this.testedSeed = seed;
    this.testRunning = false;
  }

  createCard() {
    const name = this.newName.trim();
    if (!name) {
      this.flash('error', this.t('Masukkan nama karakter terlebih dahulu.', 'Enter a character name first.'));
      return;
    }
    const taken = this.factions.some(f => this.sandbox.getDeck(f)?.cards.some(c => c.name.toLowerCase() === name.toLowerCase()));
    if (taken) {
      this.flash('error', this.t(`Nama '${name}' sudah dipakai kartu lain. Pilih nama yang berbeda.`, `The name '${name}' is already used by another card. Choose a different name.`));
      return;
    }
    this.sandbox.addCustomCard({
      faction: this.newFaction, name, hp: Number(this.newHp), damage: Number(this.newDamage),
      cost: Number(this.newCost), effect: this.newEffect, effectValue: Number(this.newEffectValue),
    });
    this.flash('success', this.t(`'${name}' ditambahkan ke deck ${this.factionLabel(this.newFaction)} untuk sesi ini.`, `'${name}' was added to the ${this.factionLabel(this.newFaction)} deck for this session.`));
    this.newName = '';
  }

  removeCustomCard(index: number) {
    this.sandbox.removeCustomCard(index);
  }

  private flash(kind: 'error' | 'success', message: string) {
    if (kind === 'error') {
      this.errorMessage = message;
      setTimeout(() => this.errorMessage = '', 5000);
    } else {
      this.successMessage = message;
      setTimeout(() => this.successMessage = '', 5000);
    }
  }
}
