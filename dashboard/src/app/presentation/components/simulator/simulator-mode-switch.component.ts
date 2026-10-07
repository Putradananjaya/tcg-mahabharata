import { Component, Input, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LanguageService } from '../../../core/services/language.service';

/** Switch between the research-engine replay (/simulator) and the Pokemon-style Mode TCG (/simulator/tcg). */
@Component({
  selector: 'app-simulator-mode-switch',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="sim-mode-switch" role="tablist" [attr.aria-label]="t('Mode simulator', 'Simulator mode')">
      <a routerLink="/simulator" role="tab" [class.on]="active === 'research'" [attr.aria-selected]="active === 'research'">
        <strong>🔬 {{ t('Engine Riset', 'Research Engine') }}</strong>
        <span>{{ t('Aturan persis seperti simulator Python di paper; serangan dipilih otomatis', 'Same rules as the Python simulator in the paper; attacks are chosen automatically') }}</span>
      </a>
      <a routerLink="/simulator/tcg" role="tab" [class.on]="active === 'tcg'" [attr.aria-selected]="active === 'tcg'">
        <strong>🃏 {{ t('Mode TCG', 'TCG Mode') }} <em>{{ t('prototipe', 'prototype') }}</em></strong>
        <span>{{ t('Aturan mirip Pokémon TCG; bisa dimainkan (Kamu vs Bot) atau ditonton (Bot vs Bot)', 'Pokémon-TCG-like rules; play it (You vs Bot) or watch it (Bot vs Bot)') }}</span>
      </a>
    </div>
  `,
  styles: [`
    .sim-mode-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
    a {
      display: flex; flex-direction: column; gap: 2px; padding: 12px 16px; border-radius: 14px;
      border: 1px solid var(--border-color); background: var(--bg-surface); text-decoration: none;
      color: var(--text-main); font-size: 13px; transition: border-color .2s, box-shadow .2s, background .2s;
    }
    a strong { font-family: 'Cinzel', serif; font-size: 15px; }
    a span { font-size: 11px; color: var(--text-muted); }
    a em { font-style: normal; font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700; color: var(--gold-deep, #b07d1a); text-transform: uppercase; margin-left: 4px; }
    a.on { border-color: transparent; color: #fff; background: var(--night-gradient, #1b1535); box-shadow: 0 0 0 2px var(--gold, #e8b54a), 0 12px 28px -16px rgba(13, 11, 31, .8); }
    a.on span { color: rgba(255, 255, 255, .72); }
    a.on em { color: var(--gold-soft, #f6dc9a); }
    a:hover:not(.on) { border-color: var(--gold, #e8b54a); }
    a:focus-visible { outline: 2px solid var(--gold, #e8b54a); outline-offset: 2px; }
    @media (max-width: 640px) { .sim-mode-switch { grid-template-columns: 1fr; } }
  `],
})
export class SimulatorModeSwitchComponent {
  @Input() active: 'research' | 'tcg' = 'research';
  readonly t = inject(LanguageService).t;
}
