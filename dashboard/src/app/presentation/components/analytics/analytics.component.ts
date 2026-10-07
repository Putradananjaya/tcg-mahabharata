import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { ResearchResultsService } from '../../../core/services/research-results.service';
import { LanguageService } from '../../../core/services/language.service';

Chart.register(...registerables);

const MATCHUP_COLORS: { [key: string]: string } = {
  SATWIKA_vs_TAMASIKA: '79, 70, 229',
  TAMASIKA_vs_RAJASIKA: '239, 68, 68',
  RAJASIKA_vs_SATWIKA: '245, 158, 11',
};

const METHOD_STYLE: { [key: string]: { label: string, labelEn?: string, rgb: string } } = {
  ga_only: { label: 'GA saja', labelEn: 'GA only', rgb: '79, 70, 229' },
  pso_only: { label: 'PSO saja', labelEn: 'PSO only', rgb: '16, 185, 129' },
  hybrid_ga_pso: { label: 'Hybrid GA+PSO', rgb: '245, 158, 11' },
  cma_es: { label: 'CMA-ES', rgb: '59, 130, 246' },
  random_search: { label: 'Random Search (baseline)', rgb: '100, 116, 139' },
  bayesian_optimization: { label: 'Bayesian Optimization', rgb: '239, 68, 68' },
};

const TOP_PARAMETERS = 10;
/** Suffixes of the invisible CI-band datasets, hidden from the legend by these markers. */
const CI_UPPER = 'CI ↑';
const CI_LOWER = 'CI ↓';

/** Label only exact powers of ten on log axes, so ticks don't pile up. */
function powerOfTenTick(value: string | number): string {
  const n = Number(value);
  const exponent = Math.log10(n);
  return Math.abs(exponent - Math.round(exponent)) < 1e-9 ? n.toLocaleString('en-US') : '';
}

interface ChartCard {
  file: string;
  error: string | null;
  loaded: boolean;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      <div class="welcome-banner md-card">
        <div class="banner-icon">📊</div>
        <div class="banner-text">
          <h2>{{ t('Visual Analytics (Hasil Riset)', 'Visual Analytics (Research Results)') }}</h2>
          @if (i18n.isEn()) {
          <p>
            Every chart is drawn when the page opens, from the Python experiment result files in <code>results/</code> — the
            file name is shown on each chart. Two old charts ("Power Spike Trend" and "K-Means Playstyle Clusters") were removed
            because no experiment in this repository produces their data.
          </p>
          } @else {
          <p>
            Setiap chart dibuat saat halaman dibuka dari file hasil eksperimen Python di <code>results/</code> — nama
            file tertera di tiap chart. Dua chart lama ("Power Spike Trend" dan "K-Means Playstyle Clusters") dihapus
            karena tidak ada eksperimen di repo ini yang menghasilkan datanya.
          </p>
          }
        </div>
        <div style="display: flex; gap: 8px; margin-left: auto;">
          <button (click)="setColumns(1)" class="md-btn" [class.md-btn-primary]="columns === 1" [class.md-btn-outlined]="columns !== 1">{{ t('1 kolom', '1 column') }}</button>
          <button (click)="setColumns(2)" class="md-btn" [class.md-btn-primary]="columns === 2" [class.md-btn-outlined]="columns !== 2">{{ t('2 kolom', '2 columns') }}</button>
        </div>
      </div>

      <div class="analytics-grid" [style.grid-template-columns]="columns === 1 ? '1fr' : 'repeat(auto-fit, minmax(420px, 1fr))'" style="display: grid; gap: 24px;">

        <!-- 1. Karna HP sweep -->
        <section class="md-card research-section">
          <div class="research-section-head">
            <h3>{{ t('Sensitivitas win rate terhadap HP Karna', "Win-rate sensitivity to Karna's HP") }}</h3>
            <span class="research-source">results/exp09_karna_hp_ci.json</span>
          </div>
          <div class="research-error" *ngIf="cards['karna'].error">{{ t('Gagal memuat data', 'Failed to load data') }}: {{ cards['karna'].error }}</div>
          <ng-container *ngIf="karna">
          @if (i18n.isEn()) {
          <p class="section-desc">
            Karna's HP is moved from {{ karna.hp_range[0] }} to {{ karna.hp_range[karna.hp_range.length - 1] }}; all
            other parameters stay as in <code>ga_balanced_params.json</code>. {{ karna.num_runs }} games per point,
            band = 95% CI (Wilson). The Satwika vs Tamasika matchup does not involve Karna, yet it still moves
            <strong>{{ karna.control_check_satwika_vs_tamasika_range_pp | number:'1.1-1' }} pp</strong> from sampling
            noise alone — a change that small on the other lines is not necessarily an effect of Karna's HP.
          </p>
          } @else {
          <p class="section-desc">
            HP Karna digeser dari {{ karna.hp_range[0] }} ke {{ karna.hp_range[karna.hp_range.length - 1] }}; semua
            parameter lain tetap dari <code>ga_balanced_params.json</code>. {{ karna.num_runs }} pertandingan per titik,
            pita = 95% CI (Wilson). Matchup Satwika vs Tamasika tidak melibatkan Karna, tetapi tetap bergeser
            <strong>{{ karna.control_check_satwika_vs_tamasika_range_pp | number:'1.1-1' }} pp</strong> hanya karena
            noise sampel — perubahan sekecil itu pada garis lain belum tentu efek HP Karna.
          </p>
          }
          </ng-container>
          <div class="research-chart" [style.display]="cards['karna'].loaded ? 'block' : 'none'"><canvas #karnaCanvas></canvas></div>
        </section>

        <!-- 2. Global sensitivity -->
        <section class="md-card research-section">
          <div class="research-section-head">
            <h3>{{ t('Parameter mana yang paling berpengaruh? (Sobol)', 'Which parameters matter most? (Sobol)') }}</h3>
            <span class="research-source">results/exp09_sensitivity_indices.json</span>
          </div>
          <div class="research-error" *ngIf="cards['sobol'].error">{{ t('Gagal memuat data', 'Failed to load data') }}: {{ cards['sobol'].error }}</div>
          <ng-container *ngIf="sobol">
          @if (i18n.isEn()) {
          <p class="section-desc">
            The {{ topParameterCount }} of {{ sobol.sobol.param_names.length }} parameters with the largest total Sobol index (ST)
            — how much of the variation in the balance score a parameter is involved in, including through interactions
            with other parameters. Sum of ST = {{ sobol.sum_ST | number:'1.2-2' }} is far above sum of S1 =
            {{ sobol.sum_S1 | number:'1.2-2' }}, meaning the interaction effects between parameters are large. In theory Sobol
            indices are ≥ 0; negative S1 values below are estimator noise, not a real effect.
          </p>
          } @else {
          <p class="section-desc">
            {{ topParameterCount }} dari {{ sobol.sobol.param_names.length }} parameter dengan indeks total (ST) Sobol
            terbesar — seberapa besar variasi skor balance yang ikut dipengaruhi parameter itu, termasuk lewat interaksi
            dengan parameter lain. Jumlah ST = {{ sobol.sum_ST | number:'1.2-2' }} jauh di atas jumlah S1 =
            {{ sobol.sum_S1 | number:'1.2-2' }}, artinya efek interaksi antar-parameter besar. Secara teori indeks
            Sobol ≥ 0; nilai S1 negatif di bawah adalah noise estimator, bukan efek nyata.
          </p>
          }
          </ng-container>
          <div class="research-caveat" *ngIf="sobol">⚠️ {{ t('Catatan dari artefak', 'Note from the artifact') }}: {{ sobol.caveat }}</div>
          <div class="research-chart" [style.display]="cards['sobol'].loaded ? 'block' : 'none'"><canvas #sobolCanvas></canvas></div>
        </section>

        <!-- 3. Optimizer convergence -->
        <section class="md-card research-section">
          <div class="research-section-head">
            <h3>{{ t('Konvergensi optimizer', 'Optimizer convergence') }}</h3>
            <span class="research-source">results/exp07_optimizer_ablation.json</span>
          </div>
          <div class="research-error" *ngIf="cards['convergence'].error">{{ t('Gagal memuat data', 'Failed to load data') }}: {{ cards['convergence'].error }}</div>
          <ng-container *ngIf="ablation">
          @if (i18n.isEn()) {
          <p class="section-desc">
            Best objective value so far (lower is better) against the number of evaluations, mean of
            {{ ablation.num_seeds }} seeds with a 95% CI band, budget {{ ablation.budget }} evaluations. The vertical axis is
            log-scaled, so CI lower bounds ≤ 0 are drawn at the bottom of the chart.
          </p>
          } @else {
          <p class="section-desc">
            Nilai objektif terbaik sejauh ini (makin rendah makin baik) terhadap jumlah evaluasi, rata-rata
            {{ ablation.num_seeds }} seed dengan pita 95% CI, anggaran {{ ablation.budget }} evaluasi. Sumbu tegak skala log,
            jadi batas bawah CI yang ≤ 0 digambar di dasar grafik.
          </p>
          }
          </ng-container>
          <div class="research-chart" [style.display]="cards['convergence'].loaded ? 'block' : 'none'"><canvas #convergenceCanvas></canvas></div>
        </section>

        <!-- 4. Surrogate cost vs dimension -->
        <section class="md-card research-section">
          <div class="research-section-head">
            <h3>{{ t('Biaya satu evaluasi surrogate vs jumlah parameter', 'Cost of one surrogate evaluation vs number of parameters') }}</h3>
            <span class="research-source">results/exp08_dimension_scaling.json</span>
          </div>
          <div class="research-error" *ngIf="cards['scaling'].error">{{ t('Gagal memuat data', 'Failed to load data') }}: {{ cards['scaling'].error }}</div>
          <ng-container *ngIf="scaling">
          @if (i18n.isEn()) {
          <p class="section-desc">
            Time for one evaluation of the surrogate model (MLP, hidden = {{ scaling.hidden_dim }}) as the number of parameters d grows.
            The curve looks flat up to d ≈ {{ scaling.d_task_specified_max | number }}, then rises — first exceeding
            2× the initial cost at d = {{ scaling.first_d_exceeding_2x_baseline | number }}. So the cost is <strong>not O(1)</strong>.
            Dashed line = one real simulator evaluation ({{ scaling.monte_carlo_n_match_per_eval }} games/matchup)
            for comparison. Both axes are log-scaled.
          </p>
          } @else {
          <p class="section-desc">
            Waktu satu evaluasi model surrogate (MLP, hidden = {{ scaling.hidden_dim }}) saat jumlah parameter d bertambah.
            Kurvanya tampak datar sampai d ≈ {{ scaling.d_task_specified_max | number }}, lalu naik — pertama kali melewati
            2× biaya awal di d = {{ scaling.first_d_exceeding_2x_baseline | number }}. Jadi biayanya <strong>bukan O(1)</strong>.
            Garis putus-putus = satu evaluasi simulator sungguhan ({{ scaling.monte_carlo_n_match_per_eval }} pertandingan/matchup)
            sebagai pembanding. Kedua sumbu skala log.
          </p>
          }
          </ng-container>
          <div class="research-chart" [style.display]="cards['scaling'].loaded ? 'block' : 'none'"><canvas #scalingCanvas></canvas></div>
        </section>
      </div>
    </div>
  `,
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  @ViewChild('karnaCanvas') private karnaCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sobolCanvas') private sobolCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('convergenceCanvas') private convergenceCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('scalingCanvas') private scalingCanvas!: ElementRef<HTMLCanvasElement>;

  columns = 1;
  readonly topParameterCount = TOP_PARAMETERS;
  readonly cards: { [key: string]: ChartCard } = {
    karna: { file: 'exp09_karna_hp_ci', error: null, loaded: false },
    sobol: { file: 'exp09_sensitivity_indices', error: null, loaded: false },
    convergence: { file: 'exp07_optimizer_ablation', error: null, loaded: false },
    scaling: { file: 'exp08_dimension_scaling', error: null, loaded: false },
  };

  karna: any = null;
  sobol: any = null;
  ablation: any = null;
  scaling: any = null;

  private charts: Chart[] = [];
  private readonly renderers: { [key: string]: () => ChartConfiguration } = {
    karna: () => this.karnaChart(),
    sobol: () => this.sobolChart(),
    convergence: () => this.convergenceChart(),
    scaling: () => this.scalingChart(),
  };

  readonly i18n = inject(LanguageService);
  readonly t = this.i18n.t;

  constructor(private research: ResearchResultsService, private zone: NgZone) {
    // Chart.js labels are baked in at render time, so redraw on a language switch.
    effect(() => {
      this.i18n.lang();
      untracked(() => this.redrawAll());
    });
  }

  private redrawAll(): void {
    if (!this.charts.length) return;
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
    for (const key of Object.keys(this.cards)) {
      if (this.cards[key].loaded) this.draw(key, this.renderers[key]);
    }
  }

  ngOnInit(): void {
    this.load('karna', (d) => this.karna = d, this.renderers['karna']);
    this.load('sobol', (d) => this.sobol = d, this.renderers['sobol']);
    this.load('convergence', (d) => this.ablation = d, this.renderers['convergence']);
    this.load('scaling', (d) => this.scaling = d, this.renderers['scaling']);
  }

  ngOnDestroy(): void {
    this.charts.forEach((c) => c.destroy());
  }

  setColumns(cols: number): void {
    this.columns = cols;
    setTimeout(() => this.charts.forEach((c) => c.resize()), 50);
  }

  private load(key: string, assign: (data: any) => void, render: () => ChartConfiguration): void {
    const card = this.cards[key];
    this.research.loadResult(card.file)
      .then((data) => {
        assign(data);
        card.loaded = true;
        setTimeout(() => this.draw(key, render));
      })
      .catch((err) => card.error = err?.message ?? String(err));
  }

  private draw(key: string, render: () => ChartConfiguration): void {
    const canvas = { karna: this.karnaCanvas, sobol: this.sobolCanvas, convergence: this.convergenceCanvas, scaling: this.scalingCanvas }[key];
    const ctx = canvas?.nativeElement.getContext('2d');
    if (!ctx) return;
    try {
      const config = render();
      // Outside Angular's zone so animation frames and resize callbacks don't trigger change detection.
      this.charts.push(this.zone.runOutsideAngular(() => new Chart(ctx, config)));
    } catch (err: any) {
      this.cards[key].error = this.t('data tidak sesuai format yang diharapkan', 'data is not in the expected format') + ` (${err?.message ?? err})`;
      this.cards[key].loaded = false;
    }
  }

  private karnaChart(): ChartConfiguration {
    const d = this.karna;
    const datasets: any[] = [];
    for (const matchup of Object.keys(d.matchup_win_rates)) {
      const rgb = MATCHUP_COLORS[matchup] ?? '100, 116, 139';
      const label = matchup.replace('_vs_', ' vs ');
      const ci = d.matchup_wilson_ci_95[matchup];
      datasets.push(
        { label: `${label} (${CI_UPPER})`, data: ci.map((c: any) => c.upper), borderColor: 'transparent', backgroundColor: `rgba(${rgb}, 0.12)`, pointRadius: 0, fill: '+1' },
        { label: `${label} (${CI_LOWER})`, data: ci.map((c: any) => c.lower), borderColor: 'transparent', pointRadius: 0, fill: false },
        { label, data: d.matchup_win_rates[matchup], borderColor: `rgb(${rgb})`, backgroundColor: `rgb(${rgb})`, pointRadius: 2, borderWidth: 2, fill: false },
      );
    }
    return {
      type: 'line',
      data: { labels: d.hp_range, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { filter: (item: any) => !item.text.includes(CI_UPPER) && !item.text.includes(CI_LOWER) } } },
        scales: {
          x: { title: { display: true, text: this.t('HP Karna', 'Karna HP') } },
          y: { title: { display: true, text: this.t('Win rate baris (%)', 'Row win rate (%)') }, suggestedMin: 0, suggestedMax: 100 },
        },
      },
    };
  }

  private sobolChart(): ChartConfiguration {
    const s = this.sobol.sobol;  // S1 / ST are {param_name: value} in the artifact
    const top = this.sobol.sobol_ranked_by_ST.slice(0, TOP_PARAMETERS).map((entry: [string, number]) => entry[0]);
    return {
      type: 'bar',
      data: {
        labels: top,
        datasets: [
          { label: this.t('ST (total, termasuk interaksi)', 'ST (total, incl. interactions)'), data: top.map((n: string) => s.ST[n]), backgroundColor: 'rgba(79, 70, 229, 0.8)' },
          { label: this.t('S1 (efek langsung saja)', 'S1 (direct effect only)'), data: top.map((n: string) => s.S1[n]), backgroundColor: 'rgba(245, 158, 11, 0.8)' },
        ],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        scales: { x: { title: { display: true, text: this.t('Indeks Sobol', 'Sobol index') } } },
      },
    };
  }

  private convergenceChart(): ChartConfiguration {
    const curves = this.ablation.convergence_curves;
    const methods: string[] = this.ablation.methods.filter((m: string) => curves[m]);
    // A log axis can't show values <= 0 (some CI lower bounds are negative): those are drawn at the
    // axis floor, half the smallest positive value in the data.
    const positives = methods.flatMap((m) => [...curves[m].mean, ...curves[m].ci95_lower]).filter((v: number) => v > 0);
    const floor = Math.min(...positives) / 2;
    const datasets: any[] = [];
    for (const method of methods) {
      const raw = METHOD_STYLE[method] ?? { label: method, rgb: '100, 116, 139' };
      const style = { ...raw, label: this.t(raw.label, raw.labelEn ?? raw.label) };
      const c = curves[method];
      const points = (ys: number[]) => c.checkpoints.map((x: number, i: number) => ({ x, y: ys[i] }));
      datasets.push(
        { label: `${style.label} (${CI_UPPER})`, data: points(c.ci95_upper), borderColor: 'transparent', backgroundColor: `rgba(${style.rgb}, 0.10)`, pointRadius: 0, fill: '+1' },
        { label: `${style.label} (${CI_LOWER})`, data: points(c.ci95_lower.map((v: number) => Math.max(v, floor))), borderColor: 'transparent', pointRadius: 0, fill: false },
        { label: style.label, data: points(c.mean), borderColor: `rgb(${style.rgb})`, pointRadius: 0, borderWidth: 2, fill: false },
      );
    }
    return {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true, maintainAspectRatio: false, parsing: false as any,
        plugins: { legend: { labels: { filter: (item: any) => !item.text.includes(CI_UPPER) && !item.text.includes(CI_LOWER) } } },
        scales: {
          x: { type: 'linear', title: { display: true, text: this.t('Evaluasi terpakai', 'Evaluations used') } },
          y: { type: 'logarithmic', min: floor, ticks: { callback: powerOfTenTick }, title: { display: true, text: this.t('Objektif terbaik sejauh ini (log)', 'Best objective so far (log)') } },
        },
      },
    };
  }

  private scalingChart(): ChartConfiguration {
    const d = this.scaling;
    const toMicro = (s: number) => s * 1e6;
    return {
      type: 'line',
      data: {
        datasets: [
          { label: 'Surrogate (MLP)', data: d.d_values.map((x: number, i: number) => ({ x, y: toMicro(d.surrogate_costs_seconds[i]) })), borderColor: 'rgb(79, 70, 229)', backgroundColor: 'rgb(79, 70, 229)', pointRadius: 3 },
          {
            label: this.t(`Simulator sungguhan (${d.monte_carlo_n_match_per_eval} pertandingan/matchup)`, `Real simulator (${d.monte_carlo_n_match_per_eval} games/matchup)`),
            data: [d.d_values[0], d.d_values[d.d_values.length - 1]].map((x: number) => ({ x, y: toMicro(d.monte_carlo_reference_seconds) })),
            borderColor: 'rgb(239, 68, 68)', borderDash: [6, 4], pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { type: 'logarithmic', ticks: { callback: powerOfTenTick }, title: { display: true, text: this.t('Jumlah parameter d (log)', 'Number of parameters d (log)') } },
          y: { type: 'logarithmic', ticks: { callback: powerOfTenTick }, title: { display: true, text: this.t('Waktu per evaluasi (µs, log)', 'Time per evaluation (µs, log)') } },
        },
      },
    };
  }
}
