import { Component, OnInit, OnDestroy, Input, ViewChild, ElementRef } from '@angular/core';
import { Chart } from 'chart.js';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BalanceOptimizerService, ParamUpdate } from '../../../core/usecases/balance-optimizer.service';
import { BattleSimulatorService } from '../../../core/usecases/battle-simulator.service';
import { AnalyticsService } from '../../../core/usecases/analytics.service';
import { AnalyticsComponent } from '../analytics/analytics.component';
import { Subscription } from 'rxjs';
import { FirebaseService } from '../../../core/services/firebase.service';

@Component({
  selector: 'app-optimizer',
  standalone: true,
  imports: [CommonModule, FormsModule, AnalyticsComponent],
  template: `
    <div class="optimizer-layout">
      
      <ng-container *ngIf="viewMode === 'engine'">
        <!-- Page Context Banner -->
        <div class="welcome-banner md-card">
          <div class="banner-icon">⚖️</div>
          <div class="banner-text">
            <h2>Auto-Balancer Engine</h2>
            <p>Halaman ini menjalankan algoritma pencarian otomatis untuk menemukan kombinasi statistik kartu paling seimbang antar faksi, lalu menyimpan hasilnya sebagai riwayat parameter.</p>
          </div>
        </div>

        <!-- 1. Top Panel: Balance Status & Presets Grid -->
        <div class="top-row-grid">
          <!-- Balance Status Card -->
          <div class="balance-status-card md-card">
            <h3>Meta Balance Assessment</h3>
            <div class="status-badge-container">
              <span class="status-badge md-badge" [ngClass]="getBalanceStatusClass()">
                {{ getBalanceStatusText() }}
              </span>
            </div>
            <p class="status-description">{{ getBalanceStatusDesc() }}</p>
            <div class="loss-display-row">
              <span class="loss-lbl">Skor Ketidakseimbangan (Loss, 0 = sempurna seimbang):</span>
              <span class="loss-val" [class.unbalanced]="loss > 500" [class.balanced]="loss <= 100">
                {{ loss <= 100 ? '✓' : '⚠' }} {{ loss.toFixed(2) }}
              </span>
            </div>
          </div>

          <!-- Presets Card -->
          <div class="presets-section md-card">
            <h3>Pilih Skema Meta Default (Preset)</h3>
            <p class="section-desc">Pilih arketipe taktis untuk menerapkan parameter awal faksi secara cepat:</p>
            <div class="presets-grid">
              <div 
                *ngFor="let preset of presets" 
                (click)="applyPreset(preset)" 
                class="preset-card"
                [class.active]="selectedPresetName === preset.name">
                <div class="preset-header">
                  <span class="preset-name">{{ preset.name }}</span>
                  <span class="preset-loss-badge">Loss: {{ preset.loss.toFixed(1) }}</span>
                </div>
                <p class="preset-desc">{{ preset.description }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Balancer Actions (GA/PSO Run) -->
        <div class="action-panel md-card">
          <h3>Optimasikan Faksi Secara Real-Time</h3>
          <p class="section-desc">Jalankan algoritma optimasi untuk mencari parameter keseimbangan ideal otomatis:</p>
          <div class="controls-row" style="align-items: flex-start; flex-wrap: wrap;">
            <div class="algo-btn-group">
              <button
                [disabled]="isOptimizing"
                (click)="runGeneticAlgorithm()"
                class="md-btn md-btn-primary">
                🧬 Run GA Balancer
              </button>
              <p class="algo-btn-caption">Algoritma Genetika — meniru seleksi alam, mencoba banyak kombinasi lalu menyilangkan yang paling seimbang.</p>
            </div>
            <div class="algo-btn-group">
              <button
                [disabled]="isOptimizing"
                (click)="runParticleSwarm()"
                class="md-btn md-btn-secondary">
                🛰️ Run PSO Balancer
              </button>
              <p class="algo-btn-caption">Particle Swarm — meniru kawanan burung mencari makanan, saling berbagi arah pencarian terbaik.</p>
            </div>
          </div>

          <!-- Optimization Progress Loading Overlay -->
          <div class="progress-bar-container" *ngIf="isOptimizing">
            <div class="spinner"></div>
            <div class="progress-text">
              Mengoptimasi menggunakan <strong>{{ activeAlgo }}</strong>... Langkah {{ optStep }}
            </div>
          </div>
        </div>

        <!-- Batch Simulation Runner -->
        <div class="batch-runner-card md-card" style="margin-top: 24px;">
          <h3>📊 Batch Simulation Runner</h3>
          <p class="section-desc">
            Simulasikan ribuan pertandingan instan dengan faksi dan parameter terpilih saat ini untuk melihat keakuratan win rate faksi:
          </p>
          <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 16px;">
            <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 150px;">
              <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin: 0;">Player 1 Faction</label>
              <select [(ngModel)]="p1FactionSelect" class="md-select">
                <option value="SATWIKA">Satwika (Pandawa)</option>
                <option value="RAJASIKA">Rajasika (Balarama dkk)</option>
                <option value="TAMASIKA">Tamasika (Kurawa)</option>
              </select>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 150px;">
              <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin: 0;">Player 2 Faction</label>
              <select [(ngModel)]="p2FactionSelect" class="md-select">
                <option value="SATWIKA">Satwika (Pandawa)</option>
                <option value="RAJASIKA">Rajasika (Balarama dkk)</option>
                <option value="TAMASIKA">Tamasika (Kurawa)</option>
              </select>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; flex: 0.8; min-width: 120px;">
              <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin: 0;">Match Size</label>
              <select [(ngModel)]="batchCount" class="md-select">
                <option [ngValue]="1000">1.000 Matches</option>
                <option [ngValue]="2000">2.000 Matches</option>
                <option [ngValue]="5000">5.000 Matches</option>
              </select>
            </div>
            <div style="display: flex; align-items: flex-end; padding-top: 18px;">
              <button [disabled]="isSimulatingBatch" (click)="runBatch()" class="md-btn md-btn-primary">
                {{ isSimulatingBatch ? 'Running...' : '⚡ Run Match Batch' }}
              </button>
            </div>
          </div>
          
          <div [style.display]="batchResult ? 'grid' : 'none'" style="background: rgba(0,0,0,0.01); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; align-items: center; margin-top: 12px;">
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                <span style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">Player 1 ({{ p1FactionSelect | titlecase }}) Win Rate:</span>
                <strong style="color: var(--primary-color); font-size: 16px;">{{ ((batchResult?.p1Wins || 0) / batchCount * 100).toFixed(1) }}%</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                <span style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">Player 2 ({{ p2FactionSelect | titlecase }}) Win Rate:</span>
                <strong style="color: var(--warning-color); font-size: 16px;">{{ ((batchResult?.p2Wins || 0) / batchCount * 100).toFixed(1) }}%</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                <span style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">Draw Rate (Seri):</span>
                <strong style="color: var(--text-muted); font-size: 16px;">{{ ((batchResult?.draws || 0) / batchCount * 100).toFixed(1) }}%</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">Rata-rata Durasi Laga:</span>
                <strong style="color: var(--text-main); font-size: 16px;">{{ batchResult?.avgTurns }} turns</strong>
              </div>
            </div>
            
            <!-- Dynamic Bar Chart canvas container -->
            <div style="height: 160px; position: relative;">
              <canvas #batchChartCanvas></canvas>
            </div>
          </div>
        </div>

        <!-- Dynamic Visual Analytics -->
        <div style="margin-top: 32px; border-top: 1px solid var(--border-color); padding-top: 32px;">
          <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 4px; font-family: 'Outfit', sans-serif;">📈 Visual Analytics Ekuilibrium</h2>
          <p class="section-desc" style="margin-bottom: 24px;">Analisis sensitivitas bifurcation, kompleksitas waktu eksekusi, tren power spike faksi, dan klasterisasi model taktis:</p>
          <app-analytics></app-analytics>
        </div>

        <!-- Parameter History Table -->
        <div class="md-card" style="margin-top: 32px; padding: 24px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            📜 Riwayat Progress Parameter & Optimasi
          </h3>
          <p class="section-desc" style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
            Daftar snapshot parameter yang tersimpan otomatis di Firebase Firestore setiap kali preset diterapkan atau algoritma penyeimbang dijalankan.
          </p>

          <div class="error-message-banner" *ngIf="historyLoadError" style="margin-bottom: 16px;">
            Gagal memuat riwayat dari database, coba muat ulang halaman.
          </div>

          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted); font-weight: 600;">
                  <th style="padding: 10px 8px;">Waktu Penyetelan</th>
                  <th style="padding: 10px 8px;">Metode / Sumber</th>
                  <th style="padding: 10px 8px; text-align: right;">Loss Value</th>
                  <th style="padding: 10px 8px;">Cuplikan Parameter Utama</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngIf="parameterHistory.length === 0 && !historyLoadError">
                  <td colspan="4" style="padding: 20px 8px; text-align: center; color: var(--text-muted); font-style: italic;">
                    Belum ada riwayat data tersimpan di database.
                  </td>
                </tr>
                <tr *ngFor="let row of parameterHistory" style="border-bottom: 1px solid rgba(0, 0, 0, 0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.015)'" onmouseout="this.style.background='transparent'">
                  <td style="padding: 10px 8px; white-space: nowrap; color: var(--text-muted);">
                    {{ row.timestamp | date:'dd MMM yyyy HH:mm:ss' }}
                  </td>
                  <td style="padding: 10px 8px; font-weight: 600; color: var(--primary-color);">
                    {{ row.source }}
                  </td>
                  <td style="padding: 10px 8px; font-weight: 700; text-align: right;" [style.color]="row.loss <= 100 ? '#2e7d32' : '#c62828'">
                    {{ row.loss <= 100 ? '✓' : '⚠' }} {{ row.loss }}
                  </td>
                  <td style="padding: 10px 8px; font-family: monospace; font-size: 11px; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted);" [title]="formatParamsTooltip(row.params)">
                    {{ getParamsSnippet(row.params) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-container>

      <ng-container *ngIf="viewMode === 'creator'">
        <!-- Page Context Banner -->
        <div class="welcome-banner md-card">
          <div class="banner-icon">➕</div>
          <div class="banner-text">
            <h2>Card Creator</h2>
            <p>Halaman ini untuk membuat karakter kartu baru secara manual — atur nama, faksi, HP, damage, dan mekanik efeknya, lalu langsung uji coba di dalam game.</p>
          </div>
        </div>

        <!-- 2. Card Creator & Custom Mechanics Panel -->
        <div class="creator-panel md-card">
          <h3>Buat Kartu Baru</h3>
          <p class="section-desc">Tambahkan karakter baru dengan mekanik kustom ke dalam game:</p>
          <div class="creator-form">
            <div class="form-row">
              <div class="form-group">
                <label>Nama Karakter</label>
                <input type="text" [(ngModel)]="newName" placeholder="misal: Gatotkaca" class="md-input">
              </div>
              <div class="form-group">
                <label>Faksi Penempatan</label>
                <select [(ngModel)]="newFaction" class="md-select">
                  <option value="PANDAWA">Pandawa (Satwika)</option>
                  <option value="KURAWA">Kurawa/Rajasika (Tamasika)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Mekanik Efek Karakter</label>
                <select [(ngModel)]="newMechanic" class="md-select">
                  <option value="standard">Standard Damage (Serangan Murni)</option>
                  <option value="heal_bench">Heal Bench (Memulihkan Cadangan)</option>
                  <option value="mill">Mill Deck (Membuang Kartu Lawan)</option>
                  <option value="lifesteal">Lifesteal (Menghisap HP 50%)</option>
                  <option value="poison_recoil">Poison Recoil (Double Dmg, 20% Recoil)</option>
                </select>
              </div>
            </div>
            <div class="form-row sliders-row">
              <div class="form-group">
                <label>HP Awal Karakter: <strong>{{ newHp }} HP</strong></label>
                <input type="range" min="60" max="160" [(ngModel)]="newHp" class="md-slider">
              </div>
              <div class="form-group">
                <label>Damage Dasar Serangan: <strong>{{ newDmg }} DMG</strong></label>
                <input type="range" min="20" max="80" [(ngModel)]="newDmg" class="md-slider">
              </div>
              <div class="form-group action-group">
                <button (click)="createCard()" class="md-btn md-btn-primary">➕ Tambahkan Kartu</button>
              </div>
            </div>
            <div class="error-message-banner" *ngIf="errorMessage">
              {{ errorMessage }}
            </div>
            <div class="success-message-banner" *ngIf="successMessage">
              {{ successMessage }}
            </div>
          </div>
        </div>
      </ng-container>

      <ng-container *ngIf="viewMode === 'sliders'">
        <!-- Page Context Banner -->
        <div class="welcome-banner md-card">
          <div class="banner-icon">🎛️</div>
          <div class="banner-text">
            <h2>Parameter Sliders</h2>
            <p>Halaman ini untuk mengatur statistik tiap karakter secara langsung dan manual lewat slider, sebagai alternatif dari pencarian otomatis di Auto-Balancer Engine.</p>
          </div>
        </div>

        <!-- 4. Sliders Container: Dynamic Faction Slider Groups -->
        <div class="sliders-container" *ngIf="params">
          <!-- Pandawa (Satwika) -->
          <div class="faction-group md-card">
            <h3 class="faction-title satwika-color">Pandawa (Satwika)</h3>
            <div class="sliders-grid">
              <div class="slider-row" *ngFor="let key of getPandawaKeys()">
                <div class="slider-labels">
                  <span class="slider-name">{{ getLabel(key) }}</span>
                  <span class="slider-val">{{ params[key] }}</span>
                </div>
                <input 
                  type="range" 
                  [min]="getBounds(key).min" 
                  [max]="getBounds(key).max" 
                  [value]="params[key]" 
                  [disabled]="isOptimizing"
                  (input)="onSliderChange(key, $event)" 
                  class="md-slider">
              </div>
            </div>
          </div>

          <!-- Rajasika -->
          <div class="faction-group md-card">
            <h3 class="faction-title rajasika-color">Rajasika (Aggro)</h3>
            <div class="sliders-grid">
              <div class="slider-row" *ngFor="let key of getRajasikaKeys()">
                <div class="slider-labels">
                  <span class="slider-name">{{ getLabel(key) }}</span>
                  <span class="slider-val">{{ params[key] }}</span>
                </div>
                <input 
                  type="range" 
                  [min]="getBounds(key).min" 
                  [max]="getBounds(key).max" 
                  [value]="params[key]" 
                  [disabled]="isOptimizing"
                  (input)="onSliderChange(key, $event)" 
                  class="md-slider">
              </div>
            </div>
          </div>

          <!-- Kurawa (Tamasika) -->
          <div class="faction-group md-card">
            <h3 class="faction-title tamasika-color">Kurawa (Tamasika)</h3>
            <div class="sliders-grid">
              <div class="slider-row" *ngFor="let key of getKurawaKeys()">
                <div class="slider-labels">
                  <span class="slider-name">{{ getLabel(key) }}</span>
                  <span class="slider-val">{{ params[key] }}</span>
                </div>
                <input 
                  type="range" 
                  [min]="getBounds(key).min" 
                  [max]="getBounds(key).max" 
                  [value]="params[key]" 
                  [disabled]="isOptimizing"
                  (input)="onSliderChange(key, $event)" 
                  class="md-slider">
              </div>
            </div>
          </div>
        </div>
      </ng-container>

    </div>
  `
})
export class OptimizerComponent implements OnInit, OnDestroy {
  @Input() viewMode: 'engine' | 'creator' | 'sliders' = 'engine';

  params: ParamUpdate = {};
  loss = 54.30;
  isOptimizing = false;
  activeAlgo: string | null = null;
  optStep = 0;
  selectedPresetName = 'Balanced Meta (Default)';

  // Batch Runner properties
  batchCount = 1000;
  p1FactionSelect: 'SATWIKA' | 'RAJASIKA' | 'TAMASIKA' = 'SATWIKA';
  p2FactionSelect: 'SATWIKA' | 'RAJASIKA' | 'TAMASIKA' = 'TAMASIKA';
  batchResult: { p1Wins: number, p2Wins: number, draws: number, avgTurns: number } | null = null;
  isSimulatingBatch = false;

  @ViewChild('batchChartCanvas') private batchChartCanvas!: ElementRef<HTMLCanvasElement>;
  private batchChart: Chart | null = null;

  // Firebase History list
  parameterHistory: any[] = [];

  // Card Creator fields
  newName = '';
  newFaction: 'PANDAWA' | 'KURAWA' = 'PANDAWA';
  newHp = 100;
  newDmg = 40;
  newCost = 1;
  newMechanic = 'standard';
  successMessage = '';
  errorMessage = '';
  historyLoadError = false;

  presets = [
    {
      name: 'Balanced Meta (Default)',
      description: 'Parameter optimal berimbang hasil kalkulasi ekuilibrium GA.',
      loss: 54.30,
      params: {
        stw_yudhistira_hp: 135, stw_yudhistira_dmg: 30, stw_yudhistira_dr: 6, stw_yudhistira_heal: 10,
        stw_arjuna_hp: 110, stw_arjuna_pasupati_dmg: 45, stw_arjuna_scale_value: 5,
        stw_bima_hp: 130, stw_bima_dmg: 52,
        stw_nakula_hp: 90, stw_nakula_dmg: 35,
        rjs_balarama_hp: 105, rjs_balarama_dmg: 50,
        rjs_karna_hp: 135, rjs_karna_dmg: 60, rjs_karna_recoil: 14,
        tms_sengkuni_hp: 110, tms_sengkuni_dmg: 45, tms_sengkuni_mill: 3,
        tms_duryodana_hp: 140, tms_duryodana_angkara_dmg: 46, tms_duryodana_scale_value: 4
      }
    },
    {
      name: 'Aggressive Rush Meta',
      description: 'Rajasika sangat dominan. Balarama & Karna memiliki damage sangat masif dengan HP tipis.',
      loss: 1840.12,
      params: {
        stw_yudhistira_hp: 110, stw_yudhistira_dmg: 25, stw_yudhistira_dr: 10, stw_yudhistira_heal: 15,
        stw_arjuna_hp: 90, stw_arjuna_pasupati_dmg: 40, stw_arjuna_scale_value: 5,
        stw_bima_hp: 110, stw_bima_dmg: 50,
        stw_nakula_hp: 70, stw_nakula_dmg: 30,
        rjs_balarama_hp: 80, rjs_balarama_dmg: 65,
        rjs_karna_hp: 95, rjs_karna_dmg: 85, rjs_karna_recoil: 15,
        tms_sengkuni_hp: 80, tms_sengkuni_dmg: 30, tms_sengkuni_mill: 1,
        tms_duryodana_hp: 110, tms_duryodana_angkara_dmg: 30, tms_duryodana_scale_value: 3
      }
    },
    {
      name: 'Defensive Stall/Heal Meta',
      description: 'Pandawa & Kurawa sangat tebal. Yudhistira menyembuhkan terus-menerus. Durasi laga panjang.',
      loss: 2154.50,
      params: {
        stw_yudhistira_hp: 160, stw_yudhistira_dmg: 20, stw_yudhistira_dr: 30, stw_yudhistira_heal: 35,
        stw_arjuna_hp: 130, stw_arjuna_pasupati_dmg: 35, stw_arjuna_scale_value: 5,
        stw_bima_hp: 160, stw_bima_dmg: 40,
        stw_nakula_hp: 110, stw_nakula_dmg: 25,
        rjs_balarama_hp: 120, rjs_balarama_dmg: 30,
        rjs_karna_hp: 130, rjs_karna_dmg: 50, rjs_karna_recoil: 5,
        tms_sengkuni_hp: 110, tms_sengkuni_dmg: 25, tms_sengkuni_mill: 3,
        tms_duryodana_hp: 160, tms_duryodana_angkara_dmg: 30, tms_duryodana_scale_value: 8
      }
    },
    {
      name: 'Glass Cannon Chaos',
      description: 'Pertempuran instan mematikan. Semua kartu memiliki damage ekstrem dengan HP serendah mungkin.',
      loss: 3410.22,
      params: {
        stw_yudhistira_hp: 70, stw_yudhistira_dmg: 60, stw_yudhistira_dr: 5, stw_yudhistira_heal: 5,
        stw_arjuna_hp: 60, stw_arjuna_pasupati_dmg: 80,
        rjs_balarama_hp: 60, rjs_balarama_dmg: 75,
        rjs_karna_hp: 60, rjs_karna_dmg: 80, rjs_karna_recoil: 20,
        tms_sengkuni_hp: 60, tms_sengkuni_dmg: 65, tms_sengkuni_mill: 5,
        tms_duryodana_hp: 70, tms_duryodana_angkara_dmg: 80, tms_duryodana_scale_value: 12
      }
    }
  ];

  private subs: Subscription[] = [];

  constructor(
    private optimizer: BalanceOptimizerService,
    private simulator: BattleSimulatorService,
    private analytics: AnalyticsService,
    private firebase: FirebaseService
  ) { }

  ngOnInit(): void {
    this.subs.push(
      this.optimizer.getParams().subscribe((p: any) => this.params = p),
      this.optimizer.getLoss().subscribe((l: any) => {
        this.loss = l;
        this.analytics.recalculateAnalytics(l, undefined, undefined, this.p1FactionSelect, this.p2FactionSelect);
      })
    );
    this.loadHistory();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // Balance Validator Helpers
  getBalanceStatusText(): string {
    if (this.loss <= 100) return '✅ Faksi Seimbang';
    if (this.loss <= 500) return '⚠️ Deviasi Moderat';
    return '🚨 Meta Timpang';
  }

  getBalanceStatusClass(): string {
    if (this.loss <= 100) return 'success';
    if (this.loss <= 500) return 'warning';
    return 'error';
  }

  getBalanceStatusDesc(): string {
    if (this.loss <= 100) {
      return 'Tingkat deviasi win rate antar-faksi berada di dalam batas aman (< 5%). Parameter seimbang dan adil untuk rilis.';
    }
    if (this.loss <= 500) {
      return 'Faksi memiliki perbedaan kekuatan tempo minor. Jalankan auto-balancer untuk meredam deviasi lebih lanjut.';
    }
    return 'Salah satu faksi memiliki dominasi ekstrem (> 70% win rate). Segera jalankan GA atau PSO untuk auto-balancing!';
  }

  // Dynamic Slider groups
  getPandawaKeys(): string[] {
    return Object.keys(this.params).filter(k => k.startsWith('stw_'));
  }

  getRajasikaKeys(): string[] {
    return Object.keys(this.params).filter(k => k.startsWith('rjs_'));
  }

  getKurawaKeys(): string[] {
    return Object.keys(this.params).filter(k => k.startsWith('tms_'));
  }

  // Card Creator Action
  createCard() {
    if (!this.newName.trim()) {
      this.errorMessage = 'Masukkan nama karakter terlebih dahulu!';
      setTimeout(() => this.errorMessage = '', 5000);
      return;
    }
    this.errorMessage = '';
    this.optimizer.addCustomCard(
      this.newFaction,
      this.newName,
      this.newHp,
      this.newDmg,
      this.newCost,
      this.newMechanic
    );
    this.selectedPresetName = 'Custom (New Card Added)';
    this.successMessage = `Sukses menambahkan karakter kustom '${this.newName}' ke dalam faksi ${this.newFaction === 'PANDAWA' ? 'Pandawa' : 'Kurawa'}! Sliders HP & DMG baru otomatis dibuat di bawah.`;

    this.newName = '';
    setTimeout(() => this.successMessage = '', 6000);
  }

  applyPreset(preset: any) {
    this.selectedPresetName = preset.name;
    Object.keys(preset.params).forEach(key => {
      this.optimizer.updateParam(key, preset.params[key]);
    });
    this.firebase.saveParameterState(preset.params, preset.loss, `Preset: ${preset.name}`);
    setTimeout(() => this.loadHistory(), 500);
  }

  onSliderChange(key: string, event: Event) {
    const target = event.target as HTMLInputElement;
    this.selectedPresetName = 'Custom (Manual Tuning)';
    this.optimizer.updateParam(key, parseInt(target.value));
  }

  runGeneticAlgorithm() {
    this.isOptimizing = true;
    this.activeAlgo = 'Genetic Algorithm (GA)';
    this.optStep = 0;
    this.selectedPresetName = 'Optimizing...';

    const op$ = this.optimizer.runGAOptimization().subscribe({
      next: (res: any) => {
        this.optStep = res.step;
      },
      complete: () => {
        this.isOptimizing = false;
        this.activeAlgo = null;
        this.selectedPresetName = 'Custom (GA Optimized)';
        op$.unsubscribe();
        setTimeout(() => this.loadHistory(), 1000);
      }
    });
  }

  runParticleSwarm() {
    this.isOptimizing = true;
    this.activeAlgo = 'Particle Swarm Optimization (PSO)';
    this.optStep = 0;
    this.selectedPresetName = 'Optimizing...';

    const op$ = this.optimizer.runPSOOptimization().subscribe({
      next: (res: any) => {
        this.optStep = res.step;
      },
      complete: () => {
        this.isOptimizing = false;
        this.activeAlgo = null;
        this.selectedPresetName = 'Custom (PSO Optimized)';
        op$.unsubscribe();
        setTimeout(() => this.loadHistory(), 1000);
      }
    });
  }

  runBatch() {
    this.isSimulatingBatch = true;
    this.batchResult = null;

    setTimeout(() => {
      const p1Deck = this.optimizer.getDeckByFaction(this.p1FactionSelect);
      const p2Deck = this.optimizer.getDeckByFaction(this.p2FactionSelect);
      const result = this.simulator.runBatchSimulation(p1Deck, p2Deck, this.batchCount);
      this.batchResult = result;
      this.isSimulatingBatch = false;

      // Update Visual Analytics using dynamic batch simulation outcomes
      const p1WR = (result.p1Wins / this.batchCount) * 100;
      this.analytics.recalculateAnalytics(this.loss, p1WR, result.avgTurns);

      // Render the result bar chart
      setTimeout(() => {
        this.renderBatchChart(result);
      }, 50);
    }, 100);
  }

  private renderBatchChart(res: any) {
    if (this.batchChart) {
      this.batchChart.destroy();
    }

    const ctx = this.batchChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const p1Pct = (res.p1Wins / this.batchCount) * 100;
    const p2Pct = (res.p2Wins / this.batchCount) * 100;
    const drawPct = (res.draws / this.batchCount) * 100;

    this.batchChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['P1 Win %', 'P2 Win %', 'Draw %'],
        datasets: [{
          data: [p1Pct, p2Pct, drawPct],
          backgroundColor: [
            'rgba(79, 70, 229, 0.85)', // Indigo
            'rgba(245, 158, 11, 0.85)', // Amber
            'rgba(148, 163, 184, 0.85)' // Slate
          ],
          borderColor: [
            '#4f46e5',
            '#f59e0b',
            '#94a3b8'
          ],
          borderWidth: 1.5,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          x: {
            ticks: { font: { size: 10, weight: 'bold' } },
            grid: { display: false }
          }
        }
      }
    });
  }

  getLabel(key: string): string {
    const mapping: { [key: string]: string } = {
      stw_yudhistira_hp: 'Yudhistira HP',
      stw_yudhistira_dmg: 'Sabda Rahayu Damage',
      stw_yudhistira_dr: 'Damage Reduction Value',
      stw_yudhistira_heal: 'Sabda Rahayu Heal Value',
      stw_yudhistira_cost_satwika: 'Yudhistira Satwika Cost',
      stw_yudhistira_cost_univ: 'Yudhistira Universal Cost',
      stw_arjuna_hp: 'Arjuna HP',
      stw_arjuna_pasupati_dmg: 'Panah Pasupati Damage',
      stw_arjuna_scale_value: 'Pasupati Scaling / Bench',
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
      tms_duryodana_angkara_cost: 'Duryodana Tamasika Cost'
    };
    if (mapping[key]) return mapping[key];

    const parts = key.split('_');
    if (parts.length >= 3) {
      const cardName = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
      const statName = parts[2].toUpperCase();
      return `${cardName} ${statName}`;
    }
    return key;
  }

  getBounds(key: string): { min: number, max: number } {
    if (key.includes('hp')) return { min: 60, max: 160 };
    if (key.includes('dmg')) return { min: 20, max: 80 };
    if (key.includes('cost')) return { min: 0, max: 3 };
    if (key.includes('dr') || key.includes('heal') || key.includes('recoil')) return { min: 5, max: 35 };
    if (key.includes('mill') || key.includes('scale')) return { min: 1, max: 15 };
    return { min: 0, max: 100 };
  }

  async loadHistory() {
    try {
      this.parameterHistory = await this.firebase.getParameterHistory(20);
      this.historyLoadError = false;
    } catch (err) {
      console.error('Error loading param history:', err);
      this.historyLoadError = true;
    }
  }

  getParamsSnippet(params: any): string {
    if (!params) return '-';
    const parts: string[] = [];
    if (params.stw_yudhistira_dr !== undefined) parts.push(`Yudhis-DR: ${params.stw_yudhistira_dr}`);
    if (params.stw_yudhistira_heal !== undefined) parts.push(`Yudhis-Heal: ${params.stw_yudhistira_heal}`);
    if (params.tms_sengkuni_hp !== undefined) parts.push(`Sengkuni-HP: ${params.tms_sengkuni_hp}`);
    if (params.tms_duryodana_hp !== undefined) parts.push(`Duryodana-HP: ${params.tms_duryodana_hp}`);
    return parts.join(', ');
  }

  formatParamsTooltip(params: any): string {
    if (!params) return '';
    return Object.keys(params)
      .map(k => `${k}: ${params[k]}`)
      .join('\n');
  }
}
