import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { ResearchResultsService } from '../../../core/services/research-results.service';

Chart.register(...registerables);

const MATCHUP_COLORS: { [key: string]: string } = {
  SATWIKA_vs_TAMASIKA: '79, 70, 229',
  TAMASIKA_vs_RAJASIKA: '239, 68, 68',
  RAJASIKA_vs_SATWIKA: '245, 158, 11',
};

const METHOD_STYLE: { [key: string]: { label: string, rgb: string } } = {
  ga_only: { label: 'GA saja', rgb: '79, 70, 229' },
  pso_only: { label: 'PSO saja', rgb: '16, 185, 129' },
  hybrid_ga_pso: { label: 'Hybrid GA+PSO', rgb: '245, 158, 11' },
  cma_es: { label: 'CMA-ES', rgb: '59, 130, 246' },
  random_search: { label: 'Random Search (baseline)', rgb: '100, 116, 139' },
  bayesian_optimization: { label: 'Bayesian Optimization', rgb: '239, 68, 68' },
};

const TOP_PARAMETERS = 10;

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
          <h2>Visual Analytics (Hasil Riset)</h2>
          <p>
            Setiap chart dibuat saat halaman dibuka dari file hasil eksperimen Python di <code>results/</code> — nama
            file tertera di tiap chart. Dua chart lama ("Power Spike Trend" dan "K-Means Playstyle Clusters") dihapus
            karena tidak ada eksperimen di repo ini yang menghasilkan datanya.
          </p>
        </div>
        <div style="display: flex; gap: 8px; margin-left: auto;">
          <button (click)="setColumns(1)" class="md-btn" [class.md-btn-primary]="columns === 1" [class.md-btn-outlined]="columns !== 1">1 kolom</button>
          <button (click)="setColumns(2)" class="md-btn" [class.md-btn-primary]="columns === 2" [class.md-btn-outlined]="columns !== 2">2 kolom</button>
        </div>
      </div>

      <div class="analytics-grid" [style.grid-template-columns]="columns === 1 ? '1fr' : 'repeat(auto-fit, minmax(420px, 1fr))'" style="display: grid; gap: 24px;">

        <!-- 1. Karna HP sweep -->
        <section class="md-card research-section">
          <div class="research-section-head">
            <h3>Sensitivitas win rate terhadap HP Karna</h3>
            <span class="research-source">results/exp09_karna_hp_ci.json</span>
          </div>
          <div class="research-error" *ngIf="cards['karna'].error">Gagal memuat data: {{ cards['karna'].error }}</div>
          <p class="section-desc" *ngIf="karna">
            HP Karna digeser dari {{ karna.hp_range[0] }} ke {{ karna.hp_range[karna.hp_range.length - 1] }}; semua
            parameter lain tetap dari <code>ga_balanced_params.json</code>. {{ karna.num_runs }} pertandingan per titik,
            pita = 95% CI (Wilson). Matchup Satwika vs Tamasika tidak melibatkan Karna, tetapi tetap bergeser
            <strong>{{ karna.control_check_satwika_vs_tamasika_range_pp | number:'1.1-1' }} pp</strong> hanya karena
            noise sampel — perubahan sekecil itu pada garis lain belum tentu efek HP Karna.
          </p>
          <div class="research-chart" [style.display]="cards['karna'].loaded ? 'block' : 'none'"><canvas #karnaCanvas></canvas></div>
        </section>

        <!-- 2. Global sensitivity -->
        <section class="md-card research-section">
          <div class="research-section-head">
            <h3>Parameter mana yang paling berpengaruh? (Sobol)</h3>
            <span class="research-source">results/exp09_sensitivity_indices.json</span>
          </div>
          <div class="research-error" *ngIf="cards['sobol'].error">Gagal memuat data: {{ cards['sobol'].error }}</div>
          <p class="section-desc" *ngIf="sobol">
            {{ topParameterCount }} dari {{ sobol.sobol.param_names.length }} parameter dengan indeks total (ST) Sobol
            terbesar — seberapa besar variasi skor balance yang ikut dipengaruhi parameter itu, termasuk lewat interaksi
            dengan parameter lain. Jumlah ST = {{ sobol.sum_ST | number:'1.2-2' }} jauh di atas jumlah S1 =
            {{ sobol.sum_S1 | number:'1.2-2' }}, artinya efek interaksi antar-parameter besar. Secara teori indeks
            Sobol ≥ 0; nilai S1 negatif di bawah adalah noise estimator, bukan efek nyata.
          </p>
          <div class="research-caveat" *ngIf="sobol">⚠️ Catatan dari artefak: {{ sobol.caveat }}</div>
          <div class="research-chart" [style.display]="cards['sobol'].loaded ? 'block' : 'none'"><canvas #sobolCanvas></canvas></div>
        </section>

        <!-- 3. Optimizer convergence -->
        <section class="md-card research-section">
          <div class="research-section-head">
            <h3>Konvergensi optimizer</h3>
            <span class="research-source">results/exp07_optimizer_ablation.json</span>
          </div>
          <div class="research-error" *ngIf="cards['convergence'].error">Gagal memuat data: {{ cards['convergence'].error }}</div>
          <p class="section-desc" *ngIf="ablation">
            Nilai objektif terbaik sejauh ini (makin rendah makin baik) terhadap jumlah evaluasi, rata-rata
            {{ ablation.num_seeds }} seed dengan pita 95% CI, anggaran {{ ablation.budget }} evaluasi. Sumbu tegak skala log,
            jadi batas bawah CI yang ≤ 0 digambar di dasar grafik.
          </p>
          <div class="research-chart" [style.display]="cards['convergence'].loaded ? 'block' : 'none'"><canvas #convergenceCanvas></canvas></div>
        </section>

        <!-- 4. Surrogate cost vs dimension -->
        <section class="md-card research-section">
          <div class="research-section-head">
            <h3>Biaya satu evaluasi surrogate vs jumlah parameter</h3>
            <span class="research-source">results/exp08_dimension_scaling.json</span>
          </div>
          <div class="research-error" *ngIf="cards['scaling'].error">Gagal memuat data: {{ cards['scaling'].error }}</div>
          <p class="section-desc" *ngIf="scaling">
            Waktu satu evaluasi model surrogate (MLP, hidden = {{ scaling.hidden_dim }}) saat jumlah parameter d bertambah.
            Kurvanya tampak datar sampai d ≈ {{ scaling.d_task_specified_max | number }}, lalu naik — pertama kali melewati
            2× biaya awal di d = {{ scaling.first_d_exceeding_2x_baseline | number }}. Jadi biayanya <strong>bukan O(1)</strong>.
            Garis putus-putus = satu evaluasi simulator sungguhan ({{ scaling.monte_carlo_n_match_per_eval }} pertandingan/matchup)
            sebagai pembanding. Kedua sumbu skala log.
          </p>
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

  constructor(private research: ResearchResultsService, private zone: NgZone) {}

  ngOnInit(): void {
    this.load('karna', (d) => this.karna = d, () => this.karnaChart());
    this.load('sobol', (d) => this.sobol = d, () => this.sobolChart());
    this.load('convergence', (d) => this.ablation = d, () => this.convergenceChart());
    this.load('scaling', (d) => this.scaling = d, () => this.scalingChart());
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
      this.cards[key].error = `data tidak sesuai format yang diharapkan (${err?.message ?? err})`;
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
        { label: `${label} (batas atas CI)`, data: ci.map((c: any) => c.upper), borderColor: 'transparent', backgroundColor: `rgba(${rgb}, 0.12)`, pointRadius: 0, fill: '+1' },
        { label: `${label} (batas bawah CI)`, data: ci.map((c: any) => c.lower), borderColor: 'transparent', pointRadius: 0, fill: false },
        { label, data: d.matchup_win_rates[matchup], borderColor: `rgb(${rgb})`, backgroundColor: `rgb(${rgb})`, pointRadius: 2, borderWidth: 2, fill: false },
      );
    }
    return {
      type: 'line',
      data: { labels: d.hp_range, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { filter: (item: any) => !item.text.includes('batas') } } },
        scales: {
          x: { title: { display: true, text: 'HP Karna' } },
          y: { title: { display: true, text: 'Win rate baris (%)' }, suggestedMin: 0, suggestedMax: 100 },
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
          { label: 'ST (total, termasuk interaksi)', data: top.map((n: string) => s.ST[n]), backgroundColor: 'rgba(79, 70, 229, 0.8)' },
          { label: 'S1 (efek langsung saja)', data: top.map((n: string) => s.S1[n]), backgroundColor: 'rgba(245, 158, 11, 0.8)' },
        ],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        scales: { x: { title: { display: true, text: 'Indeks Sobol' } } },
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
      const style = METHOD_STYLE[method] ?? { label: method, rgb: '100, 116, 139' };
      const c = curves[method];
      const points = (ys: number[]) => c.checkpoints.map((x: number, i: number) => ({ x, y: ys[i] }));
      datasets.push(
        { label: `${style.label} (CI atas)`, data: points(c.ci95_upper), borderColor: 'transparent', backgroundColor: `rgba(${style.rgb}, 0.10)`, pointRadius: 0, fill: '+1' },
        { label: `${style.label} (CI bawah)`, data: points(c.ci95_lower.map((v: number) => Math.max(v, floor))), borderColor: 'transparent', pointRadius: 0, fill: false },
        { label: style.label, data: points(c.mean), borderColor: `rgb(${style.rgb})`, pointRadius: 0, borderWidth: 2, fill: false },
      );
    }
    return {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true, maintainAspectRatio: false, parsing: false as any,
        plugins: { legend: { labels: { filter: (item: any) => !item.text.includes('CI') } } },
        scales: {
          x: { type: 'linear', title: { display: true, text: 'Evaluasi terpakai' } },
          y: { type: 'logarithmic', min: floor, ticks: { callback: powerOfTenTick }, title: { display: true, text: 'Objektif terbaik sejauh ini (log)' } },
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
            label: `Simulator sungguhan (${d.monte_carlo_n_match_per_eval} pertandingan/matchup)`,
            data: [d.d_values[0], d.d_values[d.d_values.length - 1]].map((x: number) => ({ x, y: toMicro(d.monte_carlo_reference_seconds) })),
            borderColor: 'rgb(239, 68, 68)', borderDash: [6, 4], pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { type: 'logarithmic', ticks: { callback: powerOfTenTick }, title: { display: true, text: 'Jumlah parameter d (log)' } },
          y: { type: 'logarithmic', ticks: { callback: powerOfTenTick }, title: { display: true, text: 'Waktu per evaluasi (µs, log)' } },
        },
      },
    };
  }
}
