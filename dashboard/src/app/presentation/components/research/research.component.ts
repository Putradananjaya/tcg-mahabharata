import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { ResearchResultsService } from '../../../core/services/research-results.service';
import { LanguageService } from '../../../core/services/language.service';

Chart.register(...registerables);

const FACTIONS = ['SATWIKA', 'RAJASIKA', 'TAMASIKA'];
const ALPHA = 0.05;

const METHOD_LABELS: { [key: string]: [string, string] } = {
  ga_only: ['GA saja', 'GA only'],
  pso_only: ['PSO saja', 'PSO only'],
  hybrid_ga_pso: ['Hybrid GA+PSO', 'Hybrid GA+PSO'],
  random_search: ['Random Search (baseline)', 'Random Search (baseline)'],
  cma_es: ['CMA-ES', 'CMA-ES'],
  bayesian_optimization: ['Bayesian Optimization', 'Bayesian Optimization'],
};

interface Section<T> {
  data: T | null;
  error: string | null;
}

interface AblationRow {
  key: string;
  mean: number;
  lower: number;
  upper: number;
}

function emptySection<T>(): Section<T> {
  return { data: null, error: null };
}

@Component({
  selector: 'app-research',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="research-layout">
      <div class="welcome-banner md-card">
        <div class="banner-icon">🔬</div>
        <div class="banner-text">
          <h2>{{ t('Hasil Riset Balancing', 'Balancing Research Results') }}</h2>
          @if (i18n.isEn()) {
          <p>
            Every number on this page is read directly from the Python research pipeline's result files
            (<code>results/*.json</code>) when the page opens — nothing is recomputed or typed in by hand
            in the dashboard. The source file is shown in each section. The numbers only change if the
            experiment is re-run (see <code>REPRODUCE.md</code>).
          </p>
          } @else {
          <p>
            Semua angka di halaman ini dibaca langsung dari file hasil pipeline riset Python
            (<code>results/*.json</code>) saat halaman dibuka — tidak ada yang dihitung ulang atau ditulis
            tangan di dashboard. Nama file sumber tertera di tiap bagian. Angka hanya berubah kalau
            eksperimennya dijalankan ulang (lihat <code>REPRODUCE.md</code>).
          </p>
          }
        </div>
      </div>

      <!-- 1. Before vs after balancing -->
      <section class="md-card research-section">
        <div class="research-section-head">
          <h3>1. {{ t('Sebelum vs sesudah balancing', 'Before vs after balancing') }}</h3>
          <span class="research-source">results/exp03_balance_matrix.json</span>
        </div>
        @if (i18n.isEn()) {
        <p class="section-desc">
          Win-rate (payoff) matrix of the 3 factions. Each cell = the probability that the <strong>row</strong> faction beats
          the <strong>column</strong> faction, with a 95% (Wilson) confidence interval. The diagonal is the mirror match (a faction
          against itself) — it should be ~50%, as a check that the engine is not lopsided.
        </p>
        } @else {
        <p class="section-desc">
          Matriks menang-kalah 3 faksi. Setiap sel = peluang faksi di <strong>baris</strong> menang melawan
          faksi di <strong>kolom</strong>, dengan rentang kepercayaan 95% (Wilson). Diagonal adalah mirror match (faksi lawan dirinya sendiri) —
          harus ~50%, sebagai cek bahwa engine tidak berat sebelah.
        </p>
        }

        <div class="research-error" *ngIf="exp03.error">{{ t('Gagal memuat data', 'Failed to load data') }}: {{ exp03.error }}</div>
        <div class="research-loading" *ngIf="!exp03.data && !exp03.error">{{ t('Memuat…', 'Loading…') }}</div>

        <div class="payoff-pair" *ngIf="exp03.data">
          <div class="payoff-block" *ngFor="let variant of payoffVariants">
            <h4>{{ t(variant.title, variant.titleEn) }}</h4>
            <p class="payoff-caption">{{ t(variant.caption, variant.captionEn) }} n = {{ exp03.data[variant.key].N_MATCH | number }} {{ t('pertandingan per sel.', 'games per cell.') }}</p>
            <table class="payoff-table">
              <thead>
                <tr>
                  <th>{{ t('Baris ↓ vs kolom →', 'Row ↓ vs column →') }}</th>
                  <th *ngFor="let col of factions">{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of factions">
                  <th>{{ row }}</th>
                  <td *ngFor="let col of factions"
                      [ngClass]="cellClass(exp03.data[variant.key].payoff_matrix[row + '_vs_' + col].win_rate)"
                      [class.mirror-cell]="row === col">
                    <strong>{{ pct(exp03.data[variant.key].payoff_matrix[row + '_vs_' + col].win_rate) }}</strong>
                    <span class="ci">
                      [{{ pct(exp03.data[variant.key].payoff_matrix[row + '_vs_' + col].wilson_ci_95.lower) }},
                      {{ pct(exp03.data[variant.key].payoff_matrix[row + '_vs_' + col].wilson_ci_95.upper) }}]
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="payoff-marginal">
              {{ t('Rata-rata menang melawan dua faksi lain:', 'Average win rate against the other two factions:') }}
              <span *ngFor="let f of factions; let last = last">
                {{ f }} <strong>{{ pct(exp03.data[variant.key].marginal_win_rates[f]) }}</strong>{{ last ? '' : ' · ' }}
              </span>
            </p>
          </div>
        </div>

        <div class="payoff-legend" *ngIf="exp03.data">
          <span class="legend-chip cell-even">≤ 2 pp {{ t('dari 50%', 'from 50%') }}</span>
          <span class="legend-chip cell-mild">2–5 pp</span>
          <span class="legend-chip cell-skewed">&gt; 5 pp</span>
        </div>

        <div class="research-caveat" *ngIf="exp04.data">
          @if (i18n.isEn()) {
          ⚠️ "Balanced" above is measured with the engine's built-in automatic attack policy. When the same parameters
          are played by {{ agentDeviations.length }} other agent policies (random, greedy, scripted, Q-learning, MCTS), the largest
          deviation per agent ranges from <strong>{{ minAgentDeviation | number:'1.1-1' }}–{{ maxAgentDeviation | number:'1.1-1' }} pp</strong>
          from 50% — so the balance claim only holds for the built-in policy.
          } @else {
          ⚠️ "Seimbang" di atas diukur dengan kebijakan serangan otomatis bawaan engine. Saat parameter yang sama
          dimainkan oleh {{ agentDeviations.length }} kebijakan agen lain (acak, greedy, scripted, Q-learning, MCTS), deviasi
          terbesar per agen berkisar <strong>{{ minAgentDeviation | number:'1.1-1' }}–{{ maxAgentDeviation | number:'1.1-1' }} pp</strong>
          dari 50% — jadi klaim seimbang hanya berlaku untuk kebijakan bawaan.
          }
          <span class="research-source">results/exp04_policy_dependence.json</span>
        </div>
        <div class="research-error" *ngIf="exp04.error">{{ t('Gagal memuat data kebijakan agen', 'Failed to load the agent policy data') }}: {{ exp04.error }}</div>
      </section>

      <!-- 2. Optimizer ablation -->
      <section class="md-card research-section">
        <div class="research-section-head">
          <h3>2. {{ t('Optimizer mana yang paling efektif?', 'Which optimizer is most effective?') }}</h3>
          <span class="research-source">results/exp07_optimizer_ablation.json</span>
        </div>

        <div class="research-error" *ngIf="exp07a.error">{{ t('Gagal memuat data', 'Failed to load data') }}: {{ exp07a.error }}</div>
        <div class="research-loading" *ngIf="!exp07a.data && !exp07a.error">{{ t('Memuat…', 'Loading…') }}</div>

        <ng-container *ngIf="exp07a.data">
          @if (i18n.isEn()) {
          <p class="section-desc">
            {{ exp07a.data.methods.length }} methods get the same budget — {{ exp07a.data.budget }} evaluations,
            {{ exp07a.data.num_runs }} games per matchup per evaluation — and each is repeated
            {{ exp07a.data.num_seeds }} times (different seeds). Value = final objective (balance deviation +
            power-creep penalty); <strong>lower is better</strong>. Bar = 95% confidence interval across seeds.
          </p>
          } @else {
          <p class="section-desc">
            {{ exp07a.data.methods.length }} metode diberi anggaran yang sama — {{ exp07a.data.budget }} evaluasi,
            {{ exp07a.data.num_runs }} pertandingan per matchup per evaluasi — dan masing-masing diulang
            {{ exp07a.data.num_seeds }} kali (seed berbeda). Angka = nilai objektif akhir (deviasi balance +
            penalti power creep); <strong>makin rendah makin baik</strong>. Bar = rentang kepercayaan 95% antar-seed.
          </p>
          }

          <table class="research-table">
            <thead>
              <tr><th>{{ t('Metode', 'Method') }}</th><th>{{ t('Rata-rata', 'Mean') }}</th><th>95% CI</th><th class="bar-col">{{ t('Sebaran', 'Spread') }} (0 – {{ ablationMax | number:'1.0-0' }})</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let m of ablationRows; let first = first" [class.best-row]="first">
                <td>{{ methodLabel(m.key) }}</td>
                <td><strong>{{ m.mean | number:'1.1-1' }}</strong></td>
                <td class="ci">[{{ m.lower | number:'1.1-1' }}, {{ m.upper | number:'1.1-1' }}]</td>
                <td class="bar-col">
                  <div class="ci-track">
                    <div class="ci-range" [style.left.%]="barPct(m.lower)" [style.width.%]="barPct(m.upper) - barPct(m.lower)"></div>
                    <div class="ci-mean" [style.left.%]="barPct(m.mean)"></div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div class="research-verdict">
            <strong>{{ t('Apakah hybrid GA+PSO lebih baik dari GA saja?', 'Is hybrid GA+PSO better than GA alone?') }}</strong>
            {{ exp07a.data.acceptance_criterion_hybrid_vs_ga_only.hybrid_significantly_better
                ? t('Ya, lebih baik secara signifikan', 'Yes, significantly better')
                : t('Tidak — perbedaannya tidak signifikan secara statistik', 'No — the difference is not statistically significant') }}
            (Wilcoxon p = {{ exp07a.data.acceptance_criterion_hybrid_vs_ga_only.p_value | number:'1.3-3' }},
            effect size r = {{ exp07a.data.acceptance_criterion_hybrid_vs_ga_only.rank_biserial_r | number:'1.2-2' }},
            n = {{ exp07a.data.num_seeds }} {{ t('seed', 'seeds') }}).
            {{ t('Metode dengan rata-rata terendah', 'Method with the lowest mean') }}: <strong>{{ methodLabel(ablationRows[0].key) }}</strong>.
          </div>
        </ng-container>
      </section>

      <!-- 3. NSGA-II Pareto front -->
      <section class="md-card research-section">
        <div class="research-section-head">
          <h3>3. {{ t('Trade-off multi-objektif (NSGA-II)', 'Multi-objective trade-off (NSGA-II)') }}</h3>
          <span class="research-source">results/exp07_nsga2_power_balance.json</span>
        </div>

        <div class="research-error" *ngIf="exp07n.error">{{ t('Gagal memuat data', 'Failed to load data') }}: {{ exp07n.error }}</div>
        <div class="research-loading" *ngIf="!exp07n.data && !exp07n.error">{{ t('Memuat…', 'Loading…') }}</div>

        <ng-container *ngIf="exp07n.data">
          @if (i18n.isEn()) {
          <p class="section-desc">
            NSGA-II searches for parameters with 3 goals at once: <strong>balance deviation</strong> (smaller = more
            balanced), <strong>power creep</strong> (smaller = less "everything gets stronger"), and
            <strong>faction identity</strong> (larger = more distinct play styles between factions). The result is not one
            answer but {{ exp07n.data.pareto_front.length }} solutions, none of which can be improved on one goal
            without getting worse on another. Re-validated with {{ exp07n.data.validation_num_runs }}
            games per matchup.
          </p>
          } @else {
          <p class="section-desc">
            NSGA-II mencari parameter dengan 3 tujuan sekaligus: <strong>deviasi balance</strong> (makin kecil makin
            seimbang), <strong>power creep</strong> (makin kecil makin tidak "semua jadi kuat"), dan
            <strong>identitas faksi</strong> (makin besar makin berbeda gaya main antar-faksi). Hasilnya bukan satu
            jawaban, tapi {{ exp07n.data.pareto_front.length }} solusi yang masing-masing tidak bisa diperbaiki di satu
            tujuan tanpa memburuk di tujuan lain. Divalidasi ulang dengan {{ exp07n.data.validation_num_runs }}
            pertandingan per matchup.
          </p>
          }
          <table class="research-table">
            <thead>
              <tr>
                <th>#</th><th>{{ t('Deviasi balance', 'Balance deviation') }} ↓</th><th>Power creep ↓</th><th>{{ t('Identitas faksi', 'Faction identity') }} ↑</th>
                <th>Satwika vs Tamasika</th><th>Tamasika vs Rajasika</th><th>Rajasika vs Satwika</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of paretoRows; let i = index" [class.best-row]="i === 0">
                <td>{{ i + 1 }}</td>
                <td><strong>{{ p.f1_balance | number:'1.1-1' }}</strong></td>
                <td>{{ p.f2_power_creep | number:'1.5-5' }}</td>
                <td>{{ -p.f3_neg_identity | number:'1.3-3' }}</td>
                <td>{{ p.rates.SATWIKA_vs_TAMASIKA | number:'1.1-1' }}%</td>
                <td>{{ p.rates.TAMASIKA_vs_RAJASIKA | number:'1.1-1' }}%</td>
                <td>{{ p.rates.RAJASIKA_vs_SATWIKA | number:'1.1-1' }}%</td>
              </tr>
            </tbody>
          </table>
          <p class="payoff-caption">
            {{ t('Baris teratas = solusi paling seimbang. Perhatikan: solusi paling seimbang bukan yang identitas faksinya paling kuat — itulah trade-off-nya. Deviasi balance = Σ(win rate − 50)² atas 3 matchup.',
                 'Top row = the most balanced solution. Note: the most balanced solution is not the one with the strongest faction identity — that is the trade-off. Balance deviation = Σ(win rate − 50)² over the 3 matchups.') }}
          </p>
        </ng-container>
      </section>

      <!-- 4. Lore constraints -->
      <section class="md-card research-section">
        <div class="research-section-head">
          <h3>4. {{ t('Apakah kesetiaan pada cerita (lore) mengorbankan balance?', 'Does staying true to the story (lore) sacrifice balance?') }}</h3>
          <span class="research-source">results/exp09_lore_constrained.json</span>
        </div>

        <div class="research-error" *ngIf="exp09.error">{{ t('Gagal memuat data', 'Failed to load data') }}: {{ exp09.error }}</div>
        <div class="research-loading" *ngIf="!exp09.data && !exp09.error">{{ t('Memuat…', 'Loading…') }}</div>

        <ng-container *ngIf="exp09.data">
          @if (i18n.isEn()) {
          <p class="section-desc">
            18 constraints from the Mahabharata narrative (e.g. Arjuna's Pasupati must be among the strongest attacks, Karna is
            more fragile than Yudhistira) shrink the parameter space to
            <strong>{{ exp09.data.feasibility_sampling_check.feasibility_rate_pct | number:'1.1-1' }}%</strong> of
            all combinations ({{ exp09.data.feasibility_sampling_check.n_samples | number }} random samples). NSGA-II
            is run twice — without and with the constraints — on the same {{ exp09.data.config.seeds.length }} seeds,
            and the results are compared pairwise per seed.
          </p>
          } @else {
          <p class="section-desc">
            18 kendala dari narasi Mahabharata (mis. Pasupati Arjuna harus termasuk serangan terkuat, Karna lebih
            rapuh dari Yudhistira) mempersempit ruang parameter menjadi
            <strong>{{ exp09.data.feasibility_sampling_check.feasibility_rate_pct | number:'1.1-1' }}%</strong> dari
            semua kombinasi ({{ exp09.data.feasibility_sampling_check.n_samples | number }} sampel acak). NSGA-II
            dijalankan dua kali — tanpa dan dengan kendala — pada {{ exp09.data.config.seeds.length }} seed yang sama,
            lalu hasilnya dibandingkan berpasangan per seed.
          </p>
          }

          <div class="paired-grid">
            <div class="paired-card" *ngFor="let m of pairedMetrics">
              <h4>{{ t(m.title, m.titleEn) }}</h4>
              <p class="payoff-caption">{{ t(m.caption, m.captionEn) }}</p>
              <div class="paired-value">
                {{ paired(m.key).mean_diff_constrained_minus_unconstrained | number:m.format }}
                <span class="ci">[{{ paired(m.key).diff_ci95_lower | number:m.format }}, {{ paired(m.key).diff_ci95_upper | number:m.format }}]</span>
              </div>
              <p class="paired-stats">
                {{ t('Selisih rata-rata (dengan kendala − tanpa kendala), 95% CI.', 'Mean difference (constrained − unconstrained), 95% CI.') }}
                Wilcoxon p = {{ paired(m.key).wilcoxon_p_value | number:'1.4-4' }},
                r = {{ paired(m.key).rank_biserial_r | number:'1.2-2' }}, n = {{ paired(m.key).wilcoxon_n_pairs }} {{ t('pasang', 'pairs') }},
                {{ t('batas signifikansi', 'significance level') }} α = {{ alpha }}.
              </p>
              <span class="md-badge" [ngClass]="paired(m.key).wilcoxon_p_value < alpha ? 'warning' : 'success'">
                {{ paired(m.key).wilcoxon_p_value < alpha ? t('Berbeda signifikan', 'Significantly different') : t('Tidak berbeda signifikan', 'Not significantly different') }}
              </span>
            </div>
          </div>

          <div class="research-caveat">
            {{ t('Catatan cara membaca: ruang dengan kendala adalah bagian dari ruang tanpa kendala, jadi secara teori balance terbaik dengan kendala tidak mungkin lebih baik dari tanpa kendala. Kalau selisih deviasi balance di atas bernilai negatif, artinya pencarian tanpa kendala belum menemukan optimum sejatinya dalam anggaran yang sama — bukan berarti kendala "menghemat" sesuatu.',
                 'How to read this: the constrained space is a subset of the unconstrained space, so in theory the best constrained balance cannot beat the unconstrained one. If the balance-deviation difference above is negative, the unconstrained search has not yet found its true optimum within the same budget — it does not mean the constraints "save" anything.') }}
          </div>

          <h4 class="chart-title">{{ t('Pareto front seed', 'Pareto front, seed') }} {{ exp09.data.base_seed_detail.seed }}: {{ t('tanpa vs dengan kendala', 'unconstrained vs constrained') }}</h4>
        </ng-container>
        <div class="research-chart" [style.display]="exp09.data ? 'block' : 'none'">
          <canvas #loreChart></canvas>
        </div>
      </section>
    </div>
  `,
})
export class ResearchComponent implements OnInit, OnDestroy {
  @ViewChild('loreChart') private loreChartCanvas!: ElementRef<HTMLCanvasElement>;
  private loreChart: Chart | null = null;

  readonly factions = FACTIONS;
  readonly alpha = ALPHA;

  exp03: Section<any> = emptySection();
  exp04: Section<any> = emptySection();
  exp07a: Section<any> = emptySection();
  exp07n: Section<any> = emptySection();
  exp09: Section<any> = emptySection();

  readonly payoffVariants = [
    { key: 'smart_start', title: 'Sebelum: SMART_START', titleEn: 'Before: SMART_START', caption: 'Parameter awal buatan tangan, sebelum optimasi.', captionEn: 'Hand-made starting parameters, before optimization.' },
    { key: 'ga_balanced', title: 'Sesudah: ga_balanced_params.json', titleEn: 'After: ga_balanced_params.json', caption: 'Parameter hasil optimasi Genetic Algorithm.', captionEn: 'Parameters found by the Genetic Algorithm.' },
  ];

  readonly pairedMetrics = [
    {
      key: 'empirical_cost_at_budget', format: '1.2-2',
      title: 'Deviasi balance terbaik', titleEn: 'Best balance deviation',
      caption: 'Seberapa seimbang solusi terbaik yang ditemukan (makin kecil makin seimbang).',
      captionEn: 'How balanced the best solution found is (smaller = more balanced).',
    },
    {
      key: 'hypervolume_paired_diff', format: '1.3-3',
      title: 'Luas trade-off (hypervolume)', titleEn: 'Trade-off area (hypervolume)',
      caption: 'Seberapa luas pilihan solusi yang tersedia (makin besar makin banyak pilihan).',
      captionEn: 'How wide the range of available solutions is (larger = more choice).',
    },
  ];

  // Derived views are computed once per load, never per render: returning
  // fresh arrays from template-bound methods made *ngFor rebuild the rows on
  // every change-detection pass, which fed back into the chart's resize
  // observer and locked the page.
  agentDeviations: number[] = [];
  minAgentDeviation = 0;
  maxAgentDeviation = 0;
  ablationRows: AblationRow[] = [];
  ablationMax = 1;
  paretoRows: any[] = [];

  readonly i18n = inject(LanguageService);
  readonly t = this.i18n.t;

  constructor(private research: ResearchResultsService, private zone: NgZone) {
    // Chart.js labels are baked in at render time, so redraw on a language switch.
    effect(() => {
      this.i18n.lang();
      untracked(() => { if (this.exp09.data) this.renderLoreChart(); });
    });
  }

  ngOnInit(): void {
    this.load(this.exp03, () => this.research.loadResult('exp03_balance_matrix'));
    this.load(this.exp04, () => this.research.loadResult('exp04_policy_dependence'), (data) => {
      this.agentDeviations = Object.values(data.per_agent_max_deviation_pp) as number[];
      this.minAgentDeviation = Math.min(...this.agentDeviations);
      this.maxAgentDeviation = Math.max(...this.agentDeviations);
    });
    this.load(this.exp07a, () => this.research.loadResult('exp07_optimizer_ablation'), (data) => {
      this.ablationRows = data.methods
        .map((key: string) => ({
          key,
          mean: data.summary[key].mean_final_value,
          lower: data.summary[key].ci95_lower,
          upper: data.summary[key].ci95_upper,
        }))
        .sort((a: AblationRow, b: AblationRow) => a.mean - b.mean);
      this.ablationMax = Math.max(...this.ablationRows.map((r) => r.upper));
    });
    this.load(this.exp07n, () => this.research.loadResult('exp07_nsga2_power_balance'), (data) => {
      this.paretoRows = [...data.pareto_front].sort((a, b) => a.f1_balance - b.f1_balance);
    });
    this.load(this.exp09, () => this.research.loadResult('exp09_lore_constrained'), () => {
      setTimeout(() => this.renderLoreChart());
    });
  }

  ngOnDestroy(): void {
    this.loreChart?.destroy();
  }

  private load(section: Section<any>, fetcher: () => Promise<any>, onLoaded?: (data: any) => void): void {
    fetcher()
      .then((data) => {
        if (onLoaded) onLoaded(data);
        section.data = data;
      })
      .catch((err) => {
        section.error = err?.message ?? String(err);
      });
  }

  pct(x: number): string {
    return `${(x * 100).toFixed(1)}%`;
  }

  cellClass(winRate: number): string {
    const deviation = Math.abs(winRate - 0.5);
    if (deviation <= 0.02) return 'cell-even';
    if (deviation <= 0.05) return 'cell-mild';
    return 'cell-skewed';
  }

  methodLabel(key: string): string {
    const labels = METHOD_LABELS[key];
    return labels ? this.t(labels[0], labels[1]) : key;
  }

  barPct(value: number): number {
    return Math.max(0, Math.min(100, (value / this.ablationMax) * 100));
  }

  paired(key: string): any {
    return this.exp09.data.summary_across_seeds[key];
  }

  private renderLoreChart(): void {
    const ctx = this.loreChartCanvas?.nativeElement.getContext('2d');
    if (!ctx) return;

    const detail = this.exp09.data.base_seed_detail;
    const toPoints = (front: any[]) =>
      front.map((p) => ({ x: p.f1_balance, y: -p.f3_neg_identity }));
    const unconstrained = toPoints(detail.arm_a_front);
    const constrained = toPoints(detail.arm_b_front);
    const allPositive = [...unconstrained, ...constrained].every((p) => p.x > 0);

    this.loreChart?.destroy();
    // Outside Angular's zone so Chart.js animation frames and resize
    // callbacks don't trigger app-wide change detection.
    this.loreChart = this.zone.runOutsideAngular(() => new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          { label: this.t(`Tanpa kendala (${unconstrained.length} solusi)`, `Unconstrained (${unconstrained.length} solutions)`), data: unconstrained, backgroundColor: 'rgba(79, 70, 229, 0.75)', pointRadius: 6 },
          { label: this.t(`Dengan kendala lore (${constrained.length} solusi)`, `With lore constraints (${constrained.length} solutions)`), data: constrained, backgroundColor: 'rgba(239, 68, 68, 0.75)', pointRadius: 6, pointStyle: 'triangle' },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: allPositive ? 'logarithmic' : 'linear',
            title: { display: true, text: this.t('Deviasi balance (makin kiri makin seimbang', 'Balance deviation (further left = more balanced') + (allPositive ? this.t(', skala log)', ', log scale)') : ')') },
          },
          y: { title: { display: true, text: this.t('Identitas faksi (makin atas makin berbeda)', 'Faction identity (higher = more distinct)') } },
        },
      },
    }));
  }
}
