import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';

/** Switch between the research-engine replay (/simulator) and the Pokemon-style Mode TCG (/simulator/tcg). */
@Component({
  selector: 'app-simulator-mode-switch',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="sim-mode-switch" role="tablist" aria-label="Mode simulator">
      <a routerLink="/simulator" role="tab" [class.on]="active === 'research'" [attr.aria-selected]="active === 'research'">
        <strong>🔬 Engine Riset</strong>
        <span>Aturan persis seperti simulator Python di paper; serangan dipilih otomatis</span>
      </a>
      <a routerLink="/simulator/tcg" role="tab" [class.on]="active === 'tcg'" [attr.aria-selected]="active === 'tcg'">
        <strong>🃏 Mode TCG <em>prototipe</em></strong>
        <span>Aturan mirip Pokémon TCG; bisa dimainkan (Kamu vs Bot) atau ditonton (Bot vs Bot)</span>
      </a>
    </div>
  `,
  styles: [`
    .sim-mode-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
    a {
      display: flex; flex-direction: column; gap: 2px; padding: 10px 14px; border-radius: 10px;
      border: 1px solid var(--border-color); background: var(--bg-surface); text-decoration: none;
      color: var(--text-main); font-size: 13px;
    }
    a span { font-size: 11px; color: var(--text-muted); }
    a em { font-style: normal; font-size: 10px; font-weight: 700; color: var(--warning-color); text-transform: uppercase; margin-left: 4px; }
    a.on { border-color: var(--primary-color); box-shadow: inset 0 0 0 1px var(--primary-color); background: rgba(79, 70, 229, 0.04); }
    a:hover:not(.on) { border-color: var(--text-light); }
    @media (max-width: 640px) { .sim-mode-switch { grid-template-columns: 1fr; } }
  `],
})
export class SimulatorModeSwitchComponent {
  @Input() active: 'research' | 'tcg' = 'research';
}
