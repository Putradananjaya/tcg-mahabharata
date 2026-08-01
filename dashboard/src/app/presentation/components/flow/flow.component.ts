import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-flow',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flowcharts-layout">
      <!-- Left Side: Diagram Container -->
      <div class="diagram-card md-card">
        <div class="logs-header">
          <h2>Interactive Architecture Diagrams</h2>
          <div class="flow-tabs-header">
            <button (click)="activeTab = 'tcg'" [class.active]="activeTab === 'tcg'" class="flow-tab-btn">🕹️ Turn Logic</button>
            <button (click)="activeTab = 'opt'" [class.active]="activeTab === 'opt'" class="flow-tab-btn">🧬 Balancer Loop</button>
            <button (click)="activeTab = 'ml'" [class.active]="activeTab === 'ml'" class="flow-tab-btn">🤖 ML Pipeline</button>
            <button (click)="activeTab = 'clean'" [class.active]="activeTab === 'clean'" class="flow-tab-btn">🏰 Clean Arch</button>
          </div>
        </div>

        <!-- Tab 1: Core TCG Turn Logic -->
        <div class="diagram-viewport" *ngIf="activeTab === 'tcg'">
          <div class="diagram-desc">
            <strong>Core TCG Turn Loop:</strong> Alur eksekusi per giliran pemain oleh game engine simulator.
          </div>
          <div class="visual-flow">
            <div class="node-box" style="justify-content: center; font-weight: 700; background: rgba(0,0,0,0.02)">Mulai Giliran</div>
            <div class="connector"><svg width="20" height="30"><line x1="10" y1="0" x2="10" y2="30" stroke="#cbd5e1" stroke-width="2" marker-end="url(#arrow)"/></svg></div>
            
            <div class="node-box">
              <span class="node-icon">🎴</span>
              <div class="node-details">
                <strong>Ambil Kartu (Draw Phase)</strong>
                <span>Pemain aktif mengambil kartu dari deck. Jika deck kosong, Kurawa memenangkan penalti mill.</span>
              </div>
            </div>
            
            <div class="connector"><svg width="20" height="30"><line x1="10" y1="0" x2="10" y2="30" stroke="#cbd5e1" stroke-width="2" marker-end="url(#arrow)"/></svg></div>

            <div class="node-box">
              <span class="node-icon">🔮</span>
              <div class="node-details">
                <strong>Akumulasi Prana</strong>
                <span>Setiap pemain mengundi prana faksi (Satwika/Rajasika/Tamasika) dan Universal sesuai karakter aktif.</span>
              </div>
            </div>

            <div class="connector"><svg width="20" height="30"><line x1="10" y1="0" x2="10" y2="30" stroke="#cbd5e1" stroke-width="2" marker-end="url(#arrow)"/></svg></div>

            <div class="node-box">
              <span class="node-icon">⚔️</span>
              <div class="node-details">
                <strong>Fase Penyerangan (Action Phase)</strong>
                <span>Karakter aktif mengeksekusi serangan atau skill penyembuhan jika syarat prana cost terpenuhi.</span>
              </div>
            </div>

            <div class="connector"><svg width="20" height="30"><line x1="10" y1="0" x2="10" y2="30" stroke="#cbd5e1" stroke-width="2" marker-end="url(#arrow)"/></svg></div>

            <div class="node-box">
              <span class="node-icon">🔄</span>
              <div class="node-details">
                <strong>Fase Retreat (Opsional)</strong>
                <span>Karakter aktif dapat retreat ke Bench dengan membayar cost untuk digantikan cadangan jika HP sekarat.</span>
              </div>
            </div>

            <div class="connector"><svg width="20" height="30"><line x1="10" y1="0" x2="10" y2="30" stroke="#cbd5e1" stroke-width="2" marker-end="url(#arrow)"/></svg></div>

            <div class="node-box end-check">
              <span class="node-icon">⚖️</span>
              <div class="node-details">
                <strong>Cek Kematian (Sasmita Penalty)</strong>
                <span>Karakter yang gugur mengurangi Sasmita faksi (-1). Jika Sasmita = 0, faksi lawan menang!</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: Balance Optimization Loop -->
        <div class="diagram-viewport" *ngIf="activeTab === 'opt'">
          <div class="diagram-desc">
            <strong>Optimization Loop:</strong> Siklus komputasi penyesuaian parameter menggunakan Genetic Algorithm (GA) dan Particle Swarm (PSO).
          </div>
          <div class="visual-flow">
            <div class="node-box accent-box">
              <span class="node-icon">📂</span>
              <div class="node-details">
                <strong>Inisialisasi Parameter Awal</strong>
                <span>Memuat HP, damage, dr, dan heal kartu TCG dari file JSON default.</span>
              </div>
            </div>

            <div class="connector"><svg width="20" height="30"><line x1="10" y1="0" x2="10" y2="30" stroke="#cbd5e1" stroke-width="2" marker-end="url(#arrow)"/></svg></div>

            <div class="node-box">
              <span class="node-icon">💻</span>
              <div class="node-details">
                <strong>Simulasi 1.500 Pertandingan</strong>
                <span>Mengeksekusi pertempuran acak asimetris untuk menguji kekuatan mutan parameter secara statistik.</span>
              </div>
            </div>

            <div class="connector"><svg width="20" height="30"><line x1="10" y1="0" x2="10" y2="30" stroke="#cbd5e1" stroke-width="2" marker-end="url(#arrow)"/></svg></div>

            <div class="node-box">
              <span class="node-icon">🎚️</span>
              <div class="node-details">
                <strong>Evaluasi Fungsi Kebugaran (Loss)</strong>
                <span>Menghitung deviasi win rate antar faksi terhadap target seimbang 50:50.</span>
              </div>
            </div>

            <div class="connector"><svg width="20" height="30"><line x1="10" y1="0" x2="10" y2="30" stroke="#cbd5e1" stroke-width="2" marker-end="url(#arrow)"/></svg></div>

            <div class="node-box">
              <span class="node-icon">🧬</span>
              <div class="node-details">
                <strong>Operator Optimasi (GA / PSO)</strong>
                <span>Menggunakan Seleksi & Mutasi (GA) atau Penyesuaian Vektor Kecepatan Swarm (PSO) untuk membuat generasi baru.</span>
              </div>
            </div>

            <div class="connector"><svg width="20" height="30"><line x1="10" y1="0" x2="10" y2="30" stroke="#cbd5e1" stroke-width="2" marker-end="url(#arrow)"/></svg></div>

            <div class="node-box success-box">
              <span class="node-icon">💾</span>
              <div class="node-details">
                <strong>Ekspor File Parameter Seimbang</strong>
                <span>Menyimpan file parameter optimal baru ke folder <code>data/</code> saat tingkat deviasi mendekati nol.</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 3: Machine Learning Pipeline -->
        <div class="diagram-viewport" *ngIf="activeTab === 'ml'">
          <div class="diagram-desc">
            <strong>AI & ML Pipeline:</strong> Arsitektur integrasi data log hasil sim, model prediksi, dan pembelajaran reward taktis.
          </div>
          <div class="visual-flow">
            <div class="node-box">
              <span class="node-icon">🏟️</span>
              <div class="node-details">
                <strong>Data Logger (Simulator & Game Engine)</strong>
                <span>Mengekspor state per giliran, prana, HP, damage, dan hasil akhir pertempuran ke <code>hasil_riset.csv</code>.</span>
              </div>
            </div>

            <div class="connector"><svg width="20" height="30"><line x1="10" y1="0" x2="10" y2="30" stroke="#cbd5e1" stroke-width="2" marker-end="url(#arrow)"/></svg></div>

            <div class="node-box border-emerald">
              <span class="node-icon">📊</span>
              <div class="node-details">
                <strong>Metode Regresi Random Forest</strong>
                <span>Membaca CSV untuk mencari feature importance dari setiap parameter dan korelasi HP terhadap peluang menang.</span>
              </div>
            </div>

            <div class="connector"><svg width="20" height="30"><line x1="10" y1="0" x2="10" y2="30" stroke="#cbd5e1" stroke-width="2" marker-end="url(#arrow)"/></svg></div>

            <div class="node-box border-magenta">
              <span class="node-icon">🧠</span>
              <div class="node-details">
                <strong>Deep Surrogate Model (MLP Classifier)</strong>
                <span>Melatih Multi-Layer Perceptron (MLP) 4-layer untuk bertindak sebagai fungsi aproksimasi loss pengganti simulator.</span>
              </div>
            </div>

            <div class="connector"><svg width="20" height="30"><line x1="10" y1="0" x2="10" y2="30" stroke="#cbd5e1" stroke-width="2" marker-end="url(#arrow)"/></svg></div>

            <div class="node-box success-box">
              <span class="node-icon">🤖</span>
              <div class="node-details">
                <strong>Self-Play Reinforcement Learning (Q-Learning)</strong>
                <span>Melatih agen cerdas melawan dirinya sendiri untuk menemukan pola giliran (turn sequence) optimal tiap faksi.</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 4: Clean Architecture Layer Boundaries -->
        <div class="diagram-viewport" *ngIf="activeTab === 'clean'">
          <div class="diagram-desc">
            <strong>Clean Architecture Layers:</strong> Batasan antar-layar kode untuk memisahkan domain inti dari UI.
          </div>
          <div class="visual-flow">
            <div class="node-box border-cyan">
              <span class="node-icon">🖥️</span>
              <div class="node-details">
                <strong>Presentation Layer (UI/View)</strong>
                <span>Komponen Angular Standalone: Panel Arena Simulator, Tuning Sliders, dan Canvas Chart.js.</span>
              </div>
            </div>

            <div class="connector"><svg width="20" height="30"><line x1="10" y1="0" x2="10" y2="30" stroke="#cbd5e1" stroke-width="2" marker-end="url(#arrow)"/></svg></div>

            <div class="node-box border-magenta">
              <span class="node-icon">⚙️</span>
              <div class="node-details">
                <strong>Use Cases Layer (Business Services)</strong>
                <span>Layanan abstrak 'BattleSimulatorService', 'BalanceOptimizerService', dan 'AnalyticsService'.</span>
              </div>
            </div>

            <div class="connector"><svg width="20" height="30"><line x1="10" y1="0" x2="10" y2="30" stroke="#cbd5e1" stroke-width="2" marker-end="url(#arrow)"/></svg></div>

            <div class="node-box border-emerald">
              <span class="node-icon">📦</span>
              <div class="node-details">
                <strong>Data Repository / Driver Layer</strong>
                <span>Implementasi konkrit log simulator per giliran murni TypeScript dan pencari loss fungsi.</span>
              </div>
            </div>

            <div class="connector"><svg width="20" height="30"><line x1="10" y1="0" x2="10" y2="30" stroke="#cbd5e1" stroke-width="2" marker-end="url(#arrow)"/></svg></div>

            <div class="node-box success-box">
              <span class="node-icon">💎</span>
              <div class="node-details">
                <strong>Core Domain Layer</strong>
                <span>Entitas murni 'Card' dan 'PlayerState' yang terbebas dari library eksternal.</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Defs for markers -->
        <svg width="0" height="0">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
            </marker>
          </defs>
        </svg>

      </div>

      <!-- Right Side: Data Structures -->
      <div class="data-card md-card">
        <h2>Data Structure Formats</h2>
        <p class="description">Format pertukaran data yang digunakan antar-faksi:</p>
        
        <div class="schema-box">
          <h3>Card Schema Format (JSON)</h3>
          <pre><code>{{ cardJsonSchema }}</code></pre>
        </div>

        <div class="schema-box" style="margin-top: 16px;">
          <h3>Tournament Outcome Logs (CSV)</h3>
          <pre><code>{{ tournamentCsvSchema }}</code></pre>
        </div>
      </div>
    </div>
  `
})
export class FlowComponent {
  activeTab = 'tcg';

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
