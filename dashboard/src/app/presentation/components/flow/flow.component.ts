import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../../core/services/language.service';

type Tone = 'start' | 'gold' | 'green' | 'purple' | 'blue' | 'end';

interface FlowNode {
  icon: string;
  title: string;
  /** May contain <code> markup; rendered via [innerHTML] (Angular-sanitized). */
  desc: string;
  tone?: Tone;
}

interface FlowTab {
  id: string;
  icon: string;
  label: string;
  heading: string;
  summary: string;
  nodes: FlowNode[];
}

@Component({
  selector: 'app-flow',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="f-page">

      <section class="f-banner">
        <div class="f-stars" aria-hidden="true"></div>
        <div class="f-banner-body">
          <span class="f-kicker">Flow &amp; Schema</span>
          <h2>{{ tr('Diagram Arsitektur Interaktif', 'Interactive Architecture Diagrams') }}</h2>
          <div class="f-tabs" role="tablist">
            <button *ngFor="let t of tabs" type="button" role="tab" class="f-tab"
                    [class.active]="activeTab === t.id" [attr.aria-selected]="activeTab === t.id"
                    (click)="activeTab = t.id">
              <span>{{ t.icon }}</span> {{ t.label }}
            </button>
          </div>
        </div>
      </section>

      <div class="f-layout">
        <ng-container *ngFor="let t of tabs">
          <section *ngIf="activeTab === t.id" class="f-diagram" role="tabpanel">
            <p class="f-summary"><strong>{{ t.heading }}:</strong> {{ t.summary }}</p>
            <div *ngIf="t.id === 'tcg'" class="f-terminal">{{ tr('Mulai Giliran', 'Start of Turn') }}</div>
            <ol class="f-flow">
              <li *ngFor="let n of t.nodes; let i = index" [style.animation-delay.ms]="i * 90">
                <div class="f-node" [ngClass]="'tone-' + (n.tone || 'gold')">
                  <span class="f-icon">{{ n.icon }}</span>
                  <div>
                    <strong>{{ n.title }}</strong>
                    <p [innerHTML]="n.desc"></p>
                  </div>
                </div>
              </li>
            </ol>
          </section>
        </ng-container>

        <aside class="f-schemas">
          <header>
            <span class="f-kicker">Data</span>
            <h3>{{ tr('Format Struktur Data', 'Data Structure Formats') }}</h3>
            <p>{{ tr('Format pertukaran data yang digunakan antar-faksi:', 'Data exchange formats used across factions:') }}</p>
          </header>
          <div class="f-code">
            <div class="f-code-head"><span class="f-dots"><i></i><i></i><i></i></span>Card Schema Format (JSON)</div>
            <pre><code>{{ cardJsonSchema }}</code></pre>
          </div>
          <div class="f-code">
            <div class="f-code-head"><span class="f-dots"><i></i><i></i><i></i></span>Tournament Outcome Logs (CSV)</div>
            <pre><code>{{ tournamentCsvSchema }}</code></pre>
          </div>
        </aside>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; --gold: #e8b54a; --gold-soft: #f6dc9a; --night: #0d0b1f; --ink: #1b1535; }
    .f-page { display: flex; flex-direction: column; gap: 28px; padding-bottom: 40px; }
    p { margin: 0; }
    .f-kicker { font-size: 11px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; color: var(--gold); }

    /* Banner + tabs */
    .f-banner { position: relative; overflow: hidden; border-radius: 20px; padding: 36px 40px;
      background: radial-gradient(ellipse at 85% 10%, #5b2a86 0%, transparent 55%), radial-gradient(ellipse at 5% 100%, #7a1f2b 0%, transparent 50%), linear-gradient(135deg, var(--night), var(--ink));
      box-shadow: 0 24px 60px -24px rgba(27, 21, 53, .55); }
    .f-stars { position: absolute; inset: 0; opacity: .6;
      background-image: radial-gradient(1px 1px at 14% 30%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 38% 75%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 62% 18%, var(--gold-soft) 50%, transparent 51%), radial-gradient(1px 1px at 80% 60%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 93% 25%, #fff 50%, transparent 51%); }
    .f-banner-body { position: relative; }
    .f-banner h2 { font-family: 'Cinzel', serif; font-size: clamp(24px, 3.4vw, 34px); color: #fff; margin: 8px 0 22px; }
    .f-tabs { display: flex; flex-wrap: wrap; gap: 8px; }
    .f-tab { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: 999px; cursor: pointer; font: 600 13px 'Inter', sans-serif;
      color: rgba(255, 255, 255, .78); background: rgba(255, 255, 255, .06); border: 1px solid rgba(255, 255, 255, .16); transition: background .2s, color .2s, border-color .2s; }
    .f-tab:hover { background: rgba(255, 255, 255, .12); color: #fff; }
    .f-tab:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
    .f-tab.active { background: linear-gradient(135deg, var(--gold), #c98a1c); color: var(--night); border-color: transparent; box-shadow: 0 8px 20px -8px rgba(232, 181, 74, .8); }

    /* Layout */
    .f-layout { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 24px; align-items: start; }

    /* Diagram */
    .f-diagram { background: #fff; border: 1px solid #ece6d6; border-radius: 18px; padding: 28px; }
    .f-summary { font-size: 14px; line-height: 1.65; padding: 14px 18px; border-radius: 12px; background: #fffaf0; border-left: 3px solid var(--gold); margin-bottom: 24px; }
    .f-summary strong { color: var(--ink); }
    .f-terminal { width: fit-content; margin: 0 auto 0 0; padding: 8px 20px; border-radius: 999px; font: 700 12px 'Inter', sans-serif; letter-spacing: .12em; text-transform: uppercase;
      color: var(--gold-soft); background: var(--ink); border: 1px solid var(--gold); }
    .f-flow { list-style: none; margin: 0; padding: 0; }
    .f-flow li { position: relative; padding-top: 28px; animation: f-rise .5s ease-out both; }
    .f-flow li::before { content: ''; position: absolute; left: 28px; top: 0; height: 28px; width: 2px;
      background: repeating-linear-gradient(to bottom, var(--gold) 0 5px, transparent 5px 9px); background-size: 2px 18px; animation: f-flowline 1s linear infinite; }
    .f-flow li:first-child::before { display: none; }
    .f-flow li:first-child { padding-top: 0; }
    .f-diagram .f-terminal + .f-flow li:first-child { padding-top: 28px; }
    .f-diagram .f-terminal + .f-flow li:first-child::before { display: block; }
    .f-node { display: flex; gap: 16px; align-items: flex-start; padding: 14px 18px 14px 10px; border-radius: 14px; border: 1px solid #ece6d6; background: #fff; transition: border-color .2s, box-shadow .2s, transform .2s; }
    .f-node:hover { transform: translateX(3px); border-color: var(--accent); box-shadow: 0 10px 24px -16px var(--accent); }
    .f-icon { flex: none; width: 36px; height: 36px; display: grid; place-items: center; font-size: 17px; border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, #2d2356, var(--night)); border: 2px solid var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 15%, transparent); }
    .f-node strong { display: block; font-size: 15px; color: var(--ink); margin: 2px 0 4px; }
    .f-node p { font-size: 13px; line-height: 1.6; color: #64748b; }
    .f-node p ::ng-deep code { font-size: 12px; padding: 1px 6px; border-radius: 4px; background: #f3efe4; color: #7a4f0c; }
    .tone-gold, .tone-start { --accent: #e8b54a; }
    .tone-green, .tone-end { --accent: #10b981; }
    .tone-purple { --accent: #9b5de5; }
    .tone-blue { --accent: #3b82f6; }
    .tone-end { background: linear-gradient(90deg, #f0fdf7, #fff); }
    .tone-start { background: linear-gradient(90deg, #fffaf0, #fff); }

    /* Schemas */
    .f-schemas { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 16px; }
    .f-schemas header .f-kicker { color: #b07d1a; }
    .f-schemas h3 { font-family: 'Cinzel', serif; font-size: 22px; color: var(--ink); margin: 6px 0 4px; }
    .f-schemas header p { font-size: 13px; }
    .f-code { border-radius: 14px; overflow: hidden; background: var(--night); border: 1px solid rgba(232, 181, 74, .25); box-shadow: 0 16px 36px -22px rgba(13, 11, 31, .8); }
    .f-code-head { display: flex; align-items: center; gap: 12px; padding: 10px 14px; font: 600 12px 'Inter', sans-serif; color: var(--gold-soft); background: rgba(255, 255, 255, .04); border-bottom: 1px solid rgba(232, 181, 74, .18); }
    .f-dots { display: inline-flex; gap: 5px; }
    .f-dots i { width: 9px; height: 9px; border-radius: 50%; background: #7a1f2b; }
    .f-dots i:nth-child(2) { background: #c98a1c; }
    .f-dots i:nth-child(3) { background: #3d6b4f; }
    .f-code pre { margin: 0; padding: 16px; overflow-x: auto; font: 12px/1.6 'SFMono-Regular', Menlo, Consolas, monospace; color: #e7e2f5; }

    @keyframes f-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
    @keyframes f-flowline { to { background-position: 0 18px; } }

    @media (max-width: 1100px) {
      .f-layout { grid-template-columns: minmax(0, 1fr); }
      .f-schemas { position: static; }
    }
    @media (max-width: 600px) {
      .f-banner { padding: 28px 20px; }
      .f-diagram { padding: 18px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .f-flow li, .f-flow li::before { animation: none; }
    }
  `]
})
export class FlowComponent {
  private readonly i18n = inject(LanguageService);
  /** Named `tr` because the template already uses `t` for the current tab. */
  readonly tr = this.i18n.t;
  activeTab = 'tcg';

  get tabs(): FlowTab[] {
    return this.i18n.isEn() ? TABS_EN : TABS_ID;
  }

  cardJsonSchema = `{
  "id": "stw_yudhistira",
  "name": "Yudhistira",
  "type": "Tokoh",
  "stage": "Basic",
  "hp": 130,
  "retreat_cost": 1,
  "damage_reduction": 20,
  "attacks": [
    {
      "name": "Sabda Rahayu",
      "prana_cost": {
        "Satwika": 1,
        "Universal": 1
      },
      "base_damage": 30,
      "effect": "heal_bench",
      "value": 10
    }
  ]
}`;

  tournamentCsvSchema = `turn,active_player,active_character,action,damage_dealt,healing_done,p1_sasmita,p2_sasmita
1,PANDAWA,Yudhistira,attach_prana,0,0,3,3
1,PANDAWA,Yudhistira,attack_sabda_rahayu,30,10,3,3
2,KURAWA,Sengkuni,attach_prana,0,0,3,3
2,KURAWA,Sengkuni,attack_hasutan_amarta,35,0,3,3
...`;
}

const TABS_ID: FlowTab[] = [
  {
    id: 'tcg', icon: '🕹️', label: 'Turn Logic', heading: 'Core TCG Turn Loop',
    summary: 'Alur eksekusi per giliran pemain oleh game engine simulator.',
    nodes: [
      { icon: '🎴', title: 'Ambil Kartu (Draw Phase)', desc: 'Pemain aktif mengambil kartu dari deck. Jika deck kosong, Kurawa memenangkan penalti mill.' },
      { icon: '🔮', title: 'Akumulasi Prana', desc: 'Setiap pemain mengundi prana faksi (Satwika/Rajasika/Tamasika) dan Universal sesuai karakter aktif.' },
      { icon: '⚔️', title: 'Fase Penyerangan (Action Phase)', desc: 'Karakter aktif mengeksekusi serangan atau skill penyembuhan jika syarat prana cost terpenuhi.' },
      { icon: '🔄', title: 'Fase Retreat (Opsional)', desc: 'Karakter aktif dapat retreat ke Bench dengan membayar cost untuk digantikan cadangan jika HP sekarat.' },
      { icon: '⚖️', title: 'Cek Kematian (Sasmita Claim)', desc: 'Berhasil membuat karakter aktif lawan gugur mengurangi Sasmita milikmu (-1, klaim prize). Jika Sasmita-mu = 0, kamu menang!', tone: 'end' }
    ]
  },
  {
    id: 'opt', icon: '🧬', label: 'Balancer Loop', heading: 'Optimization Loop',
    summary: 'Siklus komputasi penyesuaian parameter menggunakan Genetic Algorithm (GA) dan Particle Swarm (PSO).',
    nodes: [
      { icon: '📂', title: 'Inisialisasi Parameter Awal', desc: 'Memuat HP, damage, dr, dan heal kartu TCG dari file JSON default.', tone: 'start' },
      { icon: '💻', title: 'Simulasi 1.500 Pertandingan', desc: 'Mengeksekusi pertempuran acak asimetris untuk menguji kekuatan mutan parameter secara statistik.' },
      { icon: '🎚️', title: 'Evaluasi Fungsi Kebugaran (Loss)', desc: 'Menghitung deviasi win rate antar faksi terhadap target seimbang 50:50.' },
      { icon: '🧬', title: 'Operator Optimasi (GA / PSO)', desc: 'Menggunakan Seleksi & Mutasi (GA) atau Penyesuaian Vektor Kecepatan Swarm (PSO) untuk membuat generasi baru.' },
      { icon: '💾', title: 'Ekspor File Parameter Seimbang', desc: 'Menyimpan file parameter optimal baru ke folder <code>data/</code> saat tingkat deviasi mendekati nol.', tone: 'end' }
    ]
  },
  {
    id: 'ml', icon: '🤖', label: 'ML Pipeline', heading: 'AI & ML Pipeline',
    summary: 'Arsitektur integrasi data log hasil sim, model prediksi, dan pembelajaran reward taktis.',
    nodes: [
      { icon: '🏟️', title: 'Data Logger (Simulator & Game Engine)', desc: 'Mengekspor state per giliran, prana, HP, damage, dan hasil akhir pertempuran ke <code>hasil_riset.csv</code>.' },
      { icon: '📊', title: 'Metode Regresi Random Forest', desc: 'Membaca CSV untuk mencari feature importance dari setiap parameter dan korelasi HP terhadap peluang menang.', tone: 'green' },
      { icon: '🧠', title: 'Deep Surrogate Model (MLP Classifier)', desc: 'Melatih Multi-Layer Perceptron (MLP) 4-layer untuk bertindak sebagai fungsi aproksimasi loss pengganti simulator.', tone: 'purple' },
      { icon: '🤖', title: 'Self-Play Reinforcement Learning (Q-Learning)', desc: 'Melatih agen cerdas melawan dirinya sendiri untuk menemukan pola giliran (turn sequence) optimal tiap faksi.', tone: 'end' }
    ]
  },
  {
    id: 'clean', icon: '🏰', label: 'Clean Arch', heading: 'Clean Architecture Layers',
    summary: 'Batasan antar-layar kode untuk memisahkan domain inti dari UI.',
    nodes: [
      { icon: '🖥️', title: 'Presentation Layer (UI/View)', desc: 'Komponen Angular Standalone: Panel Arena Simulator, Tuning Sliders, dan Canvas Chart.js.', tone: 'blue' },
      { icon: '⚙️', title: 'Use Cases Layer (Business Services)', desc: "Layanan abstrak 'BattleSimulatorService', 'BalanceOptimizerService', dan 'AnalyticsService'.", tone: 'purple' },
      { icon: '📦', title: 'Data Repository / Driver Layer', desc: 'Implementasi konkrit log simulator per giliran murni TypeScript dan pencari loss fungsi.', tone: 'green' },
      { icon: '💎', title: 'Core Domain Layer', desc: "Entitas murni 'Card' dan 'PlayerState' yang terbebas dari library eksternal.", tone: 'end' }
    ]
  }
];

const TABS_EN: FlowTab[] = [
  {
    id: 'tcg', icon: '🕹️', label: 'Turn Logic', heading: 'Core TCG Turn Loop',
    summary: 'How the simulator game engine executes each player turn.',
    nodes: [
      { icon: '🎴', title: 'Draw Phase', desc: 'The active player draws a card from the deck. If the deck is empty, Kurawa wins by the mill penalty.' },
      { icon: '🔮', title: 'Prana Accumulation', desc: 'Each player gains faction prana (Satwika/Rajasika/Tamasika) and Universal prana according to the active character.' },
      { icon: '⚔️', title: 'Attack Phase (Action Phase)', desc: 'The active character executes an attack or healing skill if its prana cost is met.' },
      { icon: '🔄', title: 'Retreat Phase (Optional)', desc: 'A badly wounded active character can retreat to the Bench by paying a cost, to be replaced by a reserve.' },
      { icon: '⚖️', title: 'Knockout Check (Sasmita Claim)', desc: 'Knocking out the opponent\'s active character lowers your Sasmita (-1, claim a prize). If your Sasmita reaches 0, you win!', tone: 'end' }
    ]
  },
  {
    id: 'opt', icon: '🧬', label: 'Balancer Loop', heading: 'Optimization Loop',
    summary: 'The compute cycle that adjusts parameters using a Genetic Algorithm (GA) and Particle Swarm Optimization (PSO).',
    nodes: [
      { icon: '📂', title: 'Initialize Starting Parameters', desc: 'Loads the TCG cards\' HP, damage, DR and heal values from the default JSON file.', tone: 'start' },
      { icon: '💻', title: 'Simulate 1,500 Matches', desc: 'Runs randomized asymmetric battles to test the strength of mutated parameters statistically.' },
      { icon: '🎚️', title: 'Evaluate the Fitness (Loss) Function', desc: 'Computes how far the factions\' win rates deviate from the balanced 50:50 target.' },
      { icon: '🧬', title: 'Optimization Operators (GA / PSO)', desc: 'Uses Selection & Mutation (GA) or swarm velocity-vector updates (PSO) to create a new generation.' },
      { icon: '💾', title: 'Export the Balanced Parameter File', desc: 'Saves the new optimal parameter file to the <code>data/</code> folder once the deviation approaches zero.', tone: 'end' }
    ]
  },
  {
    id: 'ml', icon: '🤖', label: 'ML Pipeline', heading: 'AI & ML Pipeline',
    summary: 'How simulation log data, prediction models and tactical reward learning fit together.',
    nodes: [
      { icon: '🏟️', title: 'Data Logger (Simulator & Game Engine)', desc: 'Exports per-turn state, prana, HP, damage and the final battle result to <code>hasil_riset.csv</code>.' },
      { icon: '📊', title: 'Random Forest Regression', desc: 'Reads the CSV to find each parameter\'s feature importance and how HP correlates with the chance of winning.', tone: 'green' },
      { icon: '🧠', title: 'Deep Surrogate Model (MLP Classifier)', desc: 'Trains a 4-layer Multi-Layer Perceptron (MLP) to act as an approximate loss function in place of the simulator.', tone: 'purple' },
      { icon: '🤖', title: 'Self-Play Reinforcement Learning (Q-Learning)', desc: 'Trains an agent against itself to discover the best turn sequence for each faction.', tone: 'end' }
    ]
  },
  {
    id: 'clean', icon: '🏰', label: 'Clean Arch', heading: 'Clean Architecture Layers',
    summary: 'Boundaries between code layers that keep the core domain separate from the UI.',
    nodes: [
      { icon: '🖥️', title: 'Presentation Layer (UI/View)', desc: 'Standalone Angular components: Simulator Arena panel, Tuning Sliders and Chart.js canvases.', tone: 'blue' },
      { icon: '⚙️', title: 'Use Cases Layer (Business Services)', desc: "Abstract services 'BattleSimulatorService', 'BalanceOptimizerService' and 'AnalyticsService'.", tone: 'purple' },
      { icon: '📦', title: 'Data Repository / Driver Layer', desc: 'Concrete implementations: the pure-TypeScript turn-by-turn simulator log and the loss-function search.', tone: 'green' },
      { icon: '💎', title: 'Core Domain Layer', desc: "Pure 'Card' and 'PlayerState' entities, free of external libraries.", tone: 'end' }
    ]
  }
];
