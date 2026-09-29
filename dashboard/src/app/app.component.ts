import { Component, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

// Inject implementations into abstract tokens for Clean Architecture
import { BattleSimulatorService } from './core/usecases/battle-simulator.service';
import { BattleSimulatorImpl } from './data/repositories/battle-simulator.impl';
import { SandboxService } from './core/usecases/sandbox.service';
import { SandboxImpl } from './data/repositories/sandbox.impl';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

const NAV_COLLAPSED_KEY = 'mtcg.navCollapsed';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule
  ],
  providers: [
    { provide: BattleSimulatorService, useClass: BattleSimulatorImpl },
    { provide: SandboxService, useClass: SandboxImpl },
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  readonly navItems: NavItem[] = [
    { path: '/guide', icon: '🕹️', label: 'Panduan Bermain' },
    { path: '/simulator', icon: '🎮', label: 'Game Simulator' },
    { path: '/balancer', icon: '🔬', label: 'Hasil Riset Balancing' },
    { path: '/creator', icon: '🎴', label: 'Card Creator' },
    { path: '/tuning', icon: '🎛️', label: 'Parameter Sliders' },
    { path: '/analytics', icon: '📊', label: 'Visual Analytics' },
    { path: '/flow', icon: '⚙️', label: 'Flow & Schema' },
  ];

  navCollapsed = readNavCollapsed();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    inject(Router).events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => requestAnimationFrame(() => this.centerActiveNavItem()));
  }

  /**
   * On narrow screens the nav is a horizontal tab strip; keep the active tab
   * in view. No-op when the nav does not scroll (desktop sidebar).
   */
  private centerActiveNavItem(): void {
    const nav = this.host.nativeElement.querySelector<HTMLElement>('.dashboard-nav');
    const active = nav?.querySelector<HTMLElement>('.nav-btn.active');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const left = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    nav.scrollTo({ left, behavior: 'smooth' });
  }

  /** Toggles the sidebar between full and icon-only width, remembered per browser. */
  toggleNav(): void {
    this.navCollapsed = !this.navCollapsed;
    try {
      localStorage.setItem(NAV_COLLAPSED_KEY, String(this.navCollapsed));
    } catch {
      // Storage may be unavailable (private mode); the toggle still works for this session.
    }
  }
}

function readNavCollapsed(): boolean {
  try {
    return localStorage.getItem(NAV_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}
