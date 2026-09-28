import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BattleSimulatorService } from '../../../core/usecases/battle-simulator.service';
import { SandboxService } from '../../../core/usecases/sandbox.service';
import { CardDef } from '../../../core/engine/research-engine';
import { Faction } from '../../../core/engine/research-params';
import { PlayerState, GameLog } from '../../../core/domain/match-state.model';
import { SoundService } from '../../../core/services/sound.service';
import { Subscription } from 'rxjs';
import { SimulatorModeSwitchComponent } from './simulator-mode-switch.component';

@Component({
  selector: 'app-simulator',
  standalone: true,
  imports: [CommonModule, FormsModule, SimulatorModeSwitchComponent],
  template: `
    <app-simulator-mode-switch active="research"></app-simulator-mode-switch>
    <div class="arena-vertical-layout">
      <!-- 3D Coin Flip Overlay -->
      <div class="coin-flip-overlay" *ngIf="showCoinFlip">
        <div class="coin-container">
          <div class="coin" [class.flip-p1]="activePlayerIndex === 0" [class.flip-p2]="activePlayerIndex === 1">
            <div class="side-a">
              <span style="font-size: 36px;">⚔️</span>
              <div style="font-size: 11px; font-weight: 800; color: #b45309; margin-top: 4px;">P1 (HEADS)</div>
            </div>
            <div class="side-b">
              <span style="font-size: 36px;">🛡️</span>
              <div style="font-size: 11px; font-weight: 800; color: #b45309; margin-top: 4px;">P2 (TAILS)</div>
            </div>
          </div>
          
          <div class="coin-status">
            <h3 *ngIf="!coinResult" style="color: #ffffff; text-shadow: 0 2px 8px rgba(0,0,0,0.6); font-size: 18px; margin: 0; font-family: 'Inter', sans-serif;">Melempar Koin Pengundian...</h3>
            <div *ngIf="coinResult" class="fade-in-text">
              <h3 style="color: #fcd34d; font-size: 22px; text-shadow: 0 2px 10px rgba(251,191,36,0.6); margin: 0 0 4px 0; font-family: 'Outfit', sans-serif; font-weight: 800;">{{ coinResult }}</h3>
              <p style="color: #ffffff; font-weight: 700; font-size: 14px; margin: 0; text-shadow: 0 2px 6px rgba(0,0,0,0.6);">Menang Undian & Jalan Pertama!</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Side: Battlefield Arena (Full Width) -->
      <div class="battlefield-area md-card">
        <div class="battlefield-header">
          <h2>⚔️ Live TCG Battle Arena</h2>
          <div class="controls-row">
            <span *ngIf="isRunning" class="md-badge" [ngClass]="{
              'primary': activePhase === 'PRANA',
              'warning': activePhase === 'ATTACK',
              'error': activePhase === 'EFFECT',
              'success': activePhase === 'EVALUATION'
            }" style="font-weight: 700; text-transform: uppercase; padding: 4px 8px; font-size: 12px; letter-spacing: 0.5px;">
              Fase: {{ activePhase }}
            </span>
            <select [(ngModel)]="p1FactionSelect" (change)="onFactionChange()" class="md-select" style="min-width: 130px; font-size: 12px; height: 36px; padding: 0 8px;">
              <option value="SATWIKA">P1: Satwika</option>
              <option value="RAJASIKA">P1: Rajasika</option>
              <option value="TAMASIKA">P1: Tamasika</option>
            </select>
            <span style="font-weight: 500; color: var(--text-light); font-size: 11px;">VS</span>
            <select [(ngModel)]="p2FactionSelect" (change)="onFactionChange()" class="md-select" style="min-width: 130px; font-size: 12px; height: 36px; padding: 0 8px;">
              <option value="TAMASIKA">P2: Tamasika</option>
              <option value="SATWIKA">P2: Satwika</option>
              <option value="RAJASIKA">P2: Rajasika</option>
            </select>
            <button (click)="startNewGame()" class="md-btn md-btn-primary" style="height: 36px; line-height: 36px; padding: 0 16px;">🔄 Reset & Start Match</button>
            <button [disabled]="!isRunning || winner" (click)="stepGame()" class="md-btn md-btn-outlined" style="height: 36px; line-height: 36px; padding: 0 16px;">➡️ Next Step</button>
            <button [disabled]="!isRunning || winner" (click)="toggleAutoPlay()" class="md-btn md-btn-secondary" style="height: 36px; line-height: 36px; padding: 0 16px;">
              {{ autoPlayInterval ? '⏸️ Pause' : '▶️ Auto Play' }}
            </button>
          </div>
        </div>

        <div class="engine-note">
          Engine: port TypeScript dari engine riset Python (divalidasi terhadap <code>results/exp03_balance_matrix.json</code>,
          lihat <code>npm run verify:engine</code>). Parameter kartu = parameter sandbox saat ini — ubah di halaman
          <strong>Parameter Sliders</strong>. Serangan dipilih otomatis oleh engine (tidak ada keputusan pemain).
          <span *ngIf="loadError" class="engine-note-error">Gagal memuat parameter riset: {{ loadError }}</span>
        </div>

        <!-- Material TCG Board Layout -->
        <div class="board-arena" *ngIf="p1State && p2State">
          
          <!-- TOP SIDE: Player 2 (Kurawa / Tamasika) -->
          <div class="faksi-board p2" [class.active-turn-board]="isRunning && activePlayerIndex === 1">
            <div class="faksi-title-bar" style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
              <span class="faksi-name" style="font-size: 15px; font-weight: 700;">☠️ {{ p2State.name }}</span>
              <div class="prana-row" style="display: flex; align-items: center; gap: 6px; font-size: 11px;">
                <span style="color: var(--text-muted);">Energi Prana (Resource Turn):</span>
                <span class="md-badge" [ngClass]="p.key === 'Satwika' ? 'primary' : p.key === 'Tamasika' ? 'error' : p.key === 'Rajasika' ? 'warning' : 'outlined'" *ngFor="let p of p2State.prana | keyvalue" style="font-size: 12px; font-weight: 700; margin-left: 2px;">
                  {{ p.key }}: {{ p.value }}
                </span>
              </div>
              <div class="prana-row" style="font-size: 11px; color: var(--text-muted);">
                Sasmita (prize tersisa): <strong>{{ p2State.sasmita }}</strong> ·
                Deck: <strong>{{ p2State.deckCount }}</strong> ·
                Discard pile: <strong>{{ p2State.discardCount }}</strong>
              </div>
            </div>
            
            <div class="cards-row">
              <div class="active-card-wrapper">
                <span class="wrapper-label">Arena Aktif</span>
                <div class="active-card-slot">
                  <!-- Active Card (Kurawa) -->
                  <div class="tcg-card-flat" *ngIf="p2State.activeCharacter">
                    <ng-container *ngIf="getCardDetails(p2State.activeCharacter.name) as card">
                      <!-- Floating Damage/Heal animations -->
                      <div class="floating-overlay-p2" *ngIf="floatingP2Text" [ngClass]="floatingP2Type">
                        {{ floatingP2Text }}
                      </div>
                      <div class="tcg-header">
                        <span class="tcg-name">{{ p2State.activeCharacter.name }}</span>
                        <span class="tcg-hp-badge" [ngClass]="getHpClass(p2State.activeCharacter.currentHp, p2State.activeCharacter.maxHp)">
                          {{ p2State.activeCharacter.currentHp }} / {{ p2State.activeCharacter.maxHp }} HP
                        </span>
                      </div>
                      <div class="hp-container">
                        <div class="hp-bar-outer">
                          <div class="hp-bar-inner" 
                               [ngClass]="getHpClass(p2State.activeCharacter.currentHp, p2State.activeCharacter.maxHp)"
                               [style.width.%]="(p2State.activeCharacter.currentHp / p2State.activeCharacter.maxHp) * 100">
                          </div>
                        </div>
                      </div>
                      
                      <!-- Card Attributes -->
                      <div class="card-detail-info" style="font-size: 12px; margin-top: 6px; display: flex; flex-direction: column; gap: 3px; border-top: 1px dashed var(--border-color); padding-top: 6px;">
                        <div style="display: flex; justify-content: space-between;">
                          <span style="color: var(--text-light)">🛡️ Pertahanan (DR):</span>
                          <strong>{{ card.damage_reduction || 0 }} HP</strong>
                        </div>
                        
                        <!-- Attack / Skill details -->
                        <div *ngFor="let atk of card.attacks" style="margin-top: 4px; padding: 4px 6px; background: rgba(0,0,0,0.02); border-radius: 4px; display: flex; flex-direction: column; gap: 2px;">
                          <div style="display: flex; justify-content: space-between; font-weight: 700; color: var(--primary-color); font-size: 12px;">
                            <span>⚔️ {{ atk.name }}</span>
                            <span>{{ atk.base_damage }} DMG</span>
                          </div>
                          <div style="font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
                            <span>Syarat Prana:</span>
                            <strong style="color: var(--secondary-color);">{{ getPranaCostText(atk.prana_cost) }}</strong>
                          </div>
                          <div *ngIf="getEffectDescription(atk)" style="font-size: 11px; color: var(--success-color); margin-top: 2px; font-style: italic; line-height: 1.2;">
                            Efek: {{ getEffectDescription(atk) }}
                          </div>
                        </div>
                      </div>
                    </ng-container>
                  </div>
                  <div class="tcg-card-flat" *ngIf="!p2State.activeCharacter" style="display:flex;align-items:center;justify-content:center;border-style:dashed;">
                    <span style="font-size:12px;color:var(--text-light)">Knocked Out</span>
                  </div>
                </div>
              </div>

              <div class="bench-cards-wrapper">
                <span class="wrapper-label">Bench (Cadangan)</span>
                <div class="bench-cards-slot">
                      <div class="tcg-card-flat" *ngFor="let b of p2State.bench">
                        <ng-container *ngIf="getCardDetails(b.name) as card">
                          <div class="tcg-header">
                            <span class="tcg-name">{{ b.name }}</span>
                            <span class="tcg-hp-badge" style="color: var(--success-color);">{{ b.currentHp }} / {{ b.maxHp }} HP</span>
                          </div>
                          <div class="hp-container">
                            <div class="hp-bar-outer">
                              <div class="hp-bar-inner bg-emerald" [style.width.%]="(b.currentHp / b.maxHp) * 100"></div>
                            </div>
                          </div>
                          <!-- Bench Card stats -->
                          <div class="card-detail-info" style="font-size: 12px; margin-top: 4px; display: flex; flex-direction: column; gap: 3px; border-top: 1px dashed var(--border-color); padding-top: 4px;">
                            <div style="display: flex; justify-content: space-between;">
                              <span style="color: var(--text-light)">🛡️ DR:</span>
                              <strong>{{ card.damage_reduction || 0 }} HP</strong>
                            </div>
                            <div *ngFor="let atk of card.attacks" style="margin-top: 3px; padding: 3px 5px; background: rgba(0,0,0,0.015); border-radius: 4px; display: flex; flex-direction: column; gap: 1px;">
                              <div style="display: flex; justify-content: space-between; font-weight: 700; color: var(--primary-color); font-size: 11px;">
                                <span>⚔️ {{ atk.name }}</span>
                                <span>{{ atk.base_damage }} DMG</span>
                              </div>
                              <div style="font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between;">
                                <span>Prana:</span>
                                <strong>{{ getPranaCostText(atk.prana_cost) }}</strong>
                              </div>
                              <div *ngIf="getEffectDescription(atk)" style="font-size: 11px; color: var(--success-color); font-style: italic; line-height: 1.1;">
                                {{ getEffectDescription(atk) }}
                              </div>
                            </div>
                          </div>
                        </ng-container>
                      </div>
                  <div *ngIf="p2State.bench.length === 0" style="font-size:11px;color:var(--text-light);padding:12px;">
                    Tidak ada cadangan
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- BOTTOM SIDE: Player 1 (Pandawa / Satwika) -->
          <div class="faksi-board p1" [class.active-turn-board]="isRunning && activePlayerIndex === 0">
            <div class="faksi-title-bar" style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
              <span class="faksi-name" style="font-size: 15px; font-weight: 700;">🛡️ {{ p1State.name }}</span>
              <div class="prana-row" style="display: flex; align-items: center; gap: 6px; font-size: 11px;">
                <span style="color: var(--text-muted);">Energi Prana (Resource Turn):</span>
                <span class="md-badge" [ngClass]="p.key === 'Satwika' ? 'primary' : p.key === 'Tamasika' ? 'error' : p.key === 'Rajasika' ? 'warning' : 'outlined'" *ngFor="let p of p1State.prana | keyvalue" style="font-size: 12px; font-weight: 700; margin-left: 2px;">
                  {{ p.key }}: {{ p.value }}
                </span>
              </div>
              <div class="prana-row" style="font-size: 11px; color: var(--text-muted);">
                Sasmita (prize tersisa): <strong>{{ p1State.sasmita }}</strong> ·
                Deck: <strong>{{ p1State.deckCount }}</strong> ·
                Discard pile: <strong>{{ p1State.discardCount }}</strong>
              </div>
            </div>
            
            <div class="cards-row">
              <div class="active-card-wrapper">
                <span class="wrapper-label">Arena Aktif</span>
                <div class="active-card-slot">
                  <!-- Active Card (Pandawa) -->
                  <div class="tcg-card-flat" *ngIf="p1State.activeCharacter">
                    <ng-container *ngIf="getCardDetails(p1State.activeCharacter.name) as card">
                      <!-- Floating Damage/Heal animations -->
                      <div class="floating-overlay-p1" *ngIf="floatingP1Text" [ngClass]="floatingP1Type">
                        {{ floatingP1Text }}
                      </div>
                      <div class="tcg-header">
                        <span class="tcg-name">{{ p1State.activeCharacter.name }}</span>
                        <span class="tcg-hp-badge" [ngClass]="getHpClass(p1State.activeCharacter.currentHp, p1State.activeCharacter.maxHp)">
                          {{ p1State.activeCharacter.currentHp }} / {{ p1State.activeCharacter.maxHp }} HP
                        </span>
                      </div>
                      <div class="hp-container">
                        <div class="hp-bar-outer">
                          <div class="hp-bar-inner" 
                               [ngClass]="getHpClass(p1State.activeCharacter.currentHp, p1State.activeCharacter.maxHp)"
                               [style.width.%]="(p1State.activeCharacter.currentHp / p1State.activeCharacter.maxHp) * 100">
                          </div>
                        </div>
                      </div>
                      
                      <!-- Card Attributes -->
                      <div class="card-detail-info" style="font-size: 12px; margin-top: 6px; display: flex; flex-direction: column; gap: 3px; border-top: 1px dashed var(--border-color); padding-top: 6px;">
                        <div style="display: flex; justify-content: space-between;">
                          <span style="color: var(--text-light)">🛡️ Pertahanan (DR):</span>
                          <strong>{{ card.damage_reduction || 0 }} HP</strong>
                        </div>
                        
                        <!-- Attack / Skill details -->
                        <div *ngFor="let atk of card.attacks" style="margin-top: 4px; padding: 4px 6px; background: rgba(0,0,0,0.02); border-radius: 4px; display: flex; flex-direction: column; gap: 2px;">
                          <div style="display: flex; justify-content: space-between; font-weight: 700; color: var(--primary-color); font-size: 12px;">
                            <span>⚔️ {{ atk.name }}</span>
                            <span>{{ atk.base_damage }} DMG</span>
                          </div>
                          <div style="font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
                            <span>Syarat Prana:</span>
                            <strong style="color: var(--secondary-color);">{{ getPranaCostText(atk.prana_cost) }}</strong>
                          </div>
                          <div *ngIf="getEffectDescription(atk)" style="font-size: 11px; color: var(--success-color); margin-top: 2px; font-style: italic; line-height: 1.2;">
                            Efek: {{ getEffectDescription(atk) }}
                          </div>
                        </div>
                      </div>
                    </ng-container>
                  </div>
                  <div class="tcg-card-flat" *ngIf="!p1State.activeCharacter" style="display:flex;align-items:center;justify-content:center;border-style:dashed;">
                    <span style="font-size:12px;color:var(--text-light)">Knocked Out</span>
                  </div>
                </div>
              </div>

              <div class="bench-cards-wrapper">
                <span class="wrapper-label">Bench (Cadangan)</span>
                <div class="bench-cards-slot">
                      <div class="tcg-card-flat" *ngFor="let b of p1State.bench">
                        <ng-container *ngIf="getCardDetails(b.name) as card">
                          <div class="tcg-header">
                            <span class="tcg-name">{{ b.name }}</span>
                            <span class="tcg-hp-badge" style="color: var(--success-color);">{{ b.currentHp }} / {{ b.maxHp }} HP</span>
                          </div>
                          <div class="hp-container">
                            <div class="hp-bar-outer">
                              <div class="hp-bar-inner bg-emerald" [style.width.%]="(b.currentHp / b.maxHp) * 100"></div>
                            </div>
                          </div>
                          <!-- Bench Card stats -->
                          <div class="card-detail-info" style="font-size: 12px; margin-top: 4px; display: flex; flex-direction: column; gap: 3px; border-top: 1px dashed var(--border-color); padding-top: 4px;">
                            <div style="display: flex; justify-content: space-between;">
                              <span style="color: var(--text-light)">🛡️ DR:</span>
                              <strong>{{ card.damage_reduction || 0 }} HP</strong>
                            </div>
                            <div *ngFor="let atk of card.attacks" style="margin-top: 3px; padding: 3px 5px; background: rgba(0,0,0,0.015); border-radius: 4px; display: flex; flex-direction: column; gap: 1px;">
                              <div style="display: flex; justify-content: space-between; font-weight: 700; color: var(--primary-color); font-size: 11px;">
                                <span>⚔️ {{ atk.name }}</span>
                                <span>{{ atk.base_damage }} DMG</span>
                              </div>
                              <div style="font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between;">
                                <span>Prana:</span>
                                <strong>{{ getPranaCostText(atk.prana_cost) }}</strong>
                              </div>
                              <div *ngIf="getEffectDescription(atk)" style="font-size: 11px; color: var(--success-color); font-style: italic; line-height: 1.1;">
                                {{ getEffectDescription(atk) }}
                              </div>
                            </div>
                          </div>
                        </ng-container>
                      </div>
                  <div *ngIf="p1State.bench.length === 0" style="font-size:11px;color:var(--text-light);padding:12px;">
                    Tidak ada cadangan
                  </div>
                </div>
              </div>
            </div>
                 </div>
      </div>

      <!-- Bottom Side: Batch Simulator, Match Logs & Glossary -->
      <div class="simulator-bottom-grid">
        
        <!-- Match Logs Feed -->
        <div class="simulation-logs-panel md-card" style="margin-top: 0;">
          <div class="logs-header">
            <h2>📜 Match Logs</h2>
            <span class="md-badge primary" *ngIf="isRunning">Turn {{ turnCount }}</span>
          </div>

          <div class="log-viewport" #logContainer>
            <div class="log-placeholder" *ngIf="logs.length === 0" style="display:flex;align-items:center;justify-content:center;height:100%;font-size:12px;color:var(--text-light);">
              Klik "🔄 Reset & Start Match" untuk memulai simulasi per giliran.
            </div>
            <div 
              *ngFor="let log of logs" 
              class="log-row" 
              [ngClass]="log.type">
              <span class="log-turn">T{{ log.turn }}:</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
            <div class="md-card success" *ngIf="winner" style="margin-top: 16px; padding: 12px; border-color: var(--success-color); background: rgba(76,175,80,0.06); text-align: center; font-weight: 700; color: var(--success-color)">
              🏆 PEMENANG: {{ winner }}
            </div>
          </div>
        </div>

        <!-- Glossary Panel -->
        <div class="glossary-panel md-card" style="margin-top: 0; min-height: 480px; display: flex; flex-direction: column;">
          <!-- Tabs Header -->
          <div style="display: flex; gap: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 12px;">
            <button (click)="activeTab = 'glossary'" 
                    [class.md-btn-primary]="activeTab === 'glossary'"
                    [class.md-btn-outlined]="activeTab !== 'glossary'"
                    class="md-btn" style="height: 32px; padding: 0 12px; font-size: 11px;">
              📖 Glosarium Istilah
            </button>
            <button (click)="activeTab = 'flow'" 
                    [class.md-btn-primary]="activeTab === 'flow'"
                    [class.md-btn-outlined]="activeTab !== 'flow'"
                    class="md-btn" style="height: 32px; padding: 0 12px; font-size: 11px;">
              🎮 Alur Fase Giliran
            </button>
          </div>

          <!-- Tab Content 1: Glossary -->
          <div *ngIf="activeTab === 'glossary'" class="glossary-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
            <div class="glossary-item">
              <strong style="color: var(--primary-color);">🛡️ SATWIKA (Pandawa)</strong>
              <p>Sifat kebaikan & kedamaian. Yudhistira punya Damage Reduction (mengurangi damage yang diterima); Arjuna mendapat bonus damage dari jumlah Bench. Efek heal Sabda Rahayu ada di data kartu, tapi di engine ini <b>tidak pernah memulihkan apa pun</b> — karakter di Bench tidak pernah terluka.</p>
            </div>
            <div class="glossary-item">
              <strong style="color: var(--warning-color);">⚔️ RAJASIKA (Aggro/Rajas)</strong>
              <p>Sifat aksi, agresi & nafsu. Serangan Karna kuat tapi ia terkena Recoil Damage sendiri setiap menyerang — kalau recoil membuatnya gugur, lawan yang mendapat prize.</p>
            </div>
            <div class="glossary-item">
              <strong style="color: var(--danger-color);">☠️ TAMASIKA (Kurawa/Tamas)</strong>
              <p>Sifat kegelapan & kelambatan. Sengkuni membuang kartu deck lawan (Mill); Angkara Duryodana mendapat bonus damage per kartu di discard pile lawan.</p>
            </div>
            <div class="glossary-item">
              <strong>💠 Sasmita (Prize Cards)</strong>
              <p>Hitungan prize faksi (mulai dari 3, bukan nyawa tim). Setiap kali karakter aktif lawan gugur, Sasmita milikmu berkurang 1. Menang jika Sasmita-mu mencapai 0, atau jika lawan tidak punya cadangan di Bench saat karakter aktifnya gugur. Kalau sampai 100 giliran belum ada pemenang, yang HP karakter aktifnya lebih tinggi menang.</p>
            </div>
            <div class="glossary-item">
              <strong>🧪 Prana (Energi)</strong>
              <p>Di awal tiap giliran, +1 Prana sesuai tipe karakter aktif. Prana yang belum terpakai tetap tersimpan untuk giliran berikutnya, dan dipakai untuk membayar biaya serangan.</p>
            </div>
            <div class="glossary-item">
              <strong>🪦 Makam (Discard Pile)</strong>
              <p>Hanya berisi kartu deck yang dibuang oleh efek Mill (karakter yang gugur tidak masuk ke sini). Makin banyak isinya, makin besar bonus Angkara Duryodana.</p>
            </div>
          </div>

          <!-- Tab Content 2: Turn Flow -->
          <div *ngIf="activeTab === 'flow'" style="display: flex; flex-direction: column; gap: 10px; max-height: 400px; overflow-y: auto; padding-right: 4px; font-size: 11px;">
            <div class="glossary-item" style="border-left: 3px solid var(--primary-color); background: #f8fafc;">
              <strong>1. Fase Prana (Resource Phase)</strong>
              <p style="margin-top: 4px;">Pemain yang sedang jalan memperoleh +1 Prana sesuai tipe karakter aktifnya. Prana menumpuk sampai dipakai.</p>
            </div>
            <div class="glossary-item" style="border-left: 3px solid var(--primary-color); background: #f8fafc;">
              <strong>2. Fase Aksi & Serang (Combat Phase)</strong>
              <p style="margin-top: 4px;">Engine memilih serangan dengan damage tertinggi. Kalau Prana belum cukup, karakter menunggu — kecuali HP-nya ≤ 40%, maka ia memakai serangan terkuat yang terjangkau. Damage dikurangi DR (Damage Reduction) lawan.</p>
            </div>
            <div class="glossary-item" style="border-left: 3px solid var(--primary-color); background: #f8fafc;">
              <strong>3. Fase Efek Senjata (Effect Phase)</strong>
              <p style="margin-top: 4px;">Setelah damage diterapkan, efek serangan dipicu: Mill (buang kartu deck lawan), Recoil (penyerang terluka sendiri), atau Heal Bench (selalu 0 di engine ini).</p>
            </div>
            <div class="glossary-item" style="border-left: 3px solid var(--primary-color); background: #f8fafc;">
              <strong>4. Fase Eliminasi & Sasmita (Victory Check)</strong>
              <p style="margin-top: 4px;">Jika HP karakter aktif ≤ 0, ia gugur dan faksi yang menjatuhkannya mengklaim 1 prize (Sasmita −1). Karakter pertama di Bench maju. Tidak ada retreat di engine ini.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  `
})
export class SimulatorComponent implements OnInit, OnDestroy {
  p1State: PlayerState | null = null;
  p2State: PlayerState | null = null;
  logs: GameLog[] = [];
  turnCount = 1;
  isRunning = false;
  winner: string | null = null;
  autoPlayInterval: any = null;

  p1FactionSelect: 'SATWIKA' | 'RAJASIKA' | 'TAMASIKA' = 'SATWIKA';
  p2FactionSelect: 'SATWIKA' | 'RAJASIKA' | 'TAMASIKA' = 'TAMASIKA';

  floatingP1Text: string | null = null;
  floatingP1Type: 'damage' | 'heal' | 'defeat' = 'damage';
  floatingP2Text: string | null = null;
  floatingP2Type: 'damage' | 'heal' | 'defeat' = 'damage';

  activeTab: 'glossary' | 'flow' = 'glossary';
  activePhase = 'PRANA';
  activePlayerIndex = 0;
  showCoinFlip = false;
  coinResult: string | null = null;

  private subs: Subscription[] = [];

  loadError: string | null = null;
  private readonly factions: Faction[] = ['SATWIKA', 'RAJASIKA', 'TAMASIKA'];

  getCardDetails(name: string): CardDef | null {
    for (const faction of this.factions) {
      const card = this.sandbox.getDeck(faction)?.cards.find(c => c.name === name);
      if (card) return card;
    }
    return null;
  }

  getPranaCostText(pranaCost: { [key: string]: number }): string {
    if (!pranaCost) return 'Gratis';
    return Object.entries(pranaCost).map(([k, v]) => `${v} ${k[0]}`).join(', ');
  }

  // Mirrors what research-engine.ts actually does with each field, not what the name suggests.
  getEffectDescription(atk: any): string {
    const parts: string[] = [];
    if (atk?.bench_scaling) parts.push('DMG +5 per karakter di Bench sendiri (maks +15)');
    const val = atk?.value ?? 0;
    switch (atk?.effect) {
      case 'scaled_damage_per_discard_tamasika': parts.push(`DMG +${atk.scale_value ?? 0} per kartu di discard pile lawan`); break;
      case 'mill_enemy_deck': parts.push(`Buang ${val} kartu teratas deck lawan`); break;
      case 'recoil_damage': parts.push(`Penyerang terkena ${val} recoil damage`); break;
      case 'heal_bench_card': parts.push(`Heal ${val} HP ke Bench — selalu 0 di engine ini (Bench tak pernah terluka)`); break;
      case undefined: case null: case '': break;
      default: parts.push(`${atk.effect} (tidak dikenal engine, tidak berefek)`);
    }
    return parts.join(' · ');
  }

  @ViewChild('logContainer') private logContainer!: ElementRef;

  constructor(
    private simulator: BattleSimulatorService,
    private sandbox: SandboxService,
    private soundService: SoundService
  ) {
    this.soundService.init();
  }

  ngOnInit(): void {
    this.subs.push(
      this.simulator.getPlayer1State().subscribe((state: any) => this.p1State = state),
      this.simulator.getPlayer2State().subscribe((state: any) => this.p2State = state),
      this.simulator.getLogs().subscribe((logs: any) => {
        this.logs = logs;
        this.parseLastLogForAnimations(logs);
        this.scrollToBottom();
      }),
      this.simulator.getTurnCount().subscribe((turn: any) => this.turnCount = turn),
      this.simulator.getIsRunning().subscribe((running: any) => this.isRunning = running),
      this.simulator.getWinner().subscribe((w: any) => {
        if (w && this.winner !== w) {
          this.winner = w;
          this.soundService.playVictory();
        } else {
          this.winner = w;
        }
      }),
      this.simulator.getActivePhase().subscribe((phase: any) => this.activePhase = phase),
      this.simulator.getActivePlayerIndex().subscribe((idx: number) => this.activePlayerIndex = idx),
      this.sandbox.getLoadError().subscribe((err) => this.loadError = err)
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.stopAutoPlay();
  }

  getHpClass(curr: number, max: number): string {
    const pct = curr / max;
    if (pct > 0.5) return 'bg-emerald';
    if (pct > 0.25) return 'bg-yellow';
    return 'bg-red';
  }

  triggerFloating(player: 1 | 2, text: string, type: 'damage' | 'heal' | 'defeat') {
    if (player === 1) {
      this.floatingP1Text = text;
      this.floatingP1Type = type;
      setTimeout(() => this.floatingP1Text = null, 1200);
    } else {
      this.floatingP2Text = text;
      this.floatingP2Type = type;
      setTimeout(() => this.floatingP2Text = null, 1200);
    }
  }

  private parseLastLogForAnimations(logs: GameLog[]) {
    if (logs.length === 0 || !this.p1State || !this.p2State) return;
    const lastLog = logs[logs.length - 1];
    const msg = lastLog.message;

    // Find all character names in current decks
    const p1Names = [
      this.p1State.activeCharacter?.name,
      ...this.p1State.bench.map(c => c.name)
    ].filter(Boolean) as string[];

    const p2Names = [
      this.p2State.activeCharacter?.name,
      ...this.p2State.bench.map(c => c.name)
    ].filter(Boolean) as string[];

    // 1. Detect KO (Gugur)
    if (msg.includes("GUGUR") || msg.includes("kalah")) {
      const p1Dead = p1Names.find(name => msg.includes(name));
      const p2Dead = p2Names.find(name => msg.includes(name));
      if (p1Dead) {
        this.triggerFloating(1, "⚡ KO!", 'defeat');
      } else if (p2Dead) {
        this.triggerFloating(2, "⚡ KO!", 'defeat');
      }
      this.soundService.playAttack();
      return;
    }

    // 2. Detect Damage (Damage Bersih / Recoil)
    if (msg.includes("damage") || msg.includes("dikurangi dari") || msg.includes("recoil")) {
      const dmgMatch = msg.match(/(\d+)\s*(?:HP|damage|recoil)/i);
      const val = dmgMatch ? `-${dmgMatch[1]} HP` : "⚔️ Damage";

      const p1Damaged = p1Names.find(name => msg.includes(name));
      const p2Damaged = p2Names.find(name => msg.includes(name));

      if (p1Damaged) {
        this.triggerFloating(1, val, 'damage');
      } else if (p2Damaged) {
        this.triggerFloating(2, val, 'damage');
      }
      this.soundService.playAttack();
      return;
    }

    // 3. Detect Heal (Memulihkan / lifesteal)
    if (msg.includes("Memulihkan") || msg.includes("memulihkan") || msg.includes("Lifesteal")) {
      const healMatch = msg.match(/(\d+)\s*HP/i);
      const val = healMatch ? `+${healMatch[1]} HP` : "💚 Heal";

      const p1Healed = p1Names.find(name => msg.includes(name));
      const p2Healed = p2Names.find(name => msg.includes(name));

      if (p1Healed) {
        this.triggerFloating(1, val, 'heal');
      } else if (p2Healed) {
        this.triggerFloating(2, val, 'heal');
      }
      this.soundService.playHeal();
      return;
    }
  }

  startNewGame() {
    this.soundService.init();
    this.stopAutoPlay();
    const p1Deck = this.sandbox.getDeck(this.p1FactionSelect);
    const p2Deck = this.sandbox.getDeck(this.p2FactionSelect);
    if (!p1Deck || !p2Deck) return;
    this.simulator.startSimulation(p1Deck, p2Deck, this.p1FactionSelect, this.p2FactionSelect);

    // Trigger visual coin toss
    this.showCoinFlip = true;
    this.coinResult = null;
    this.soundService.playCoinToss();

    setTimeout(() => {
      const startPlayerIdx = this.activePlayerIndex;
      const startPlayerName = startPlayerIdx === 0
        ? (this.p1State?.name || 'Player 1')
        : (this.p2State?.name || 'Player 2');
      this.coinResult = startPlayerName;

      setTimeout(() => {
        this.showCoinFlip = false;
        this.soundService.playCardPlay();
      }, 1200);
    }, 1500);
  }

  onFactionChange() {
    this.startNewGame();
  }

  stepGame() {
    this.simulator.stepSimulation();
  }

  toggleAutoPlay() {
    if (this.autoPlayInterval) {
      this.stopAutoPlay();
    } else {
      this.isRunning = true;
      this.autoPlayInterval = setInterval(() => {
        if (this.winner) {
          this.stopAutoPlay();
        } else {
          this.stepGame();
        }
      }, 800);
    }
  }

  private stopAutoPlay() {
    if (this.autoPlayInterval) {
      clearInterval(this.autoPlayInterval);
      this.autoPlayInterval = null;
    }
  }

  private scrollToBottom(): void {
    try {
      setTimeout(() => {
        this.logContainer.nativeElement.scrollTop = this.logContainer.nativeElement.scrollHeight;
      }, 50);
    } catch (err) { }
  }
}
