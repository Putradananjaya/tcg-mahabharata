import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../../core/services/language.service';
import { CharacterEmblemComponent } from './character-emblem.component';

export type FactionTheme = 'satwika' | 'rajasika' | 'tamasika';

export interface CharacterMeta {
  title: string;
  faction: FactionTheme;
  /** Signature attack name, copied from data/<faction>.json. */
  signature: string;
}

/**
 * Decorative card-art banner for one character: faction-themed backdrop plus
 * an emblem drawn from the character's signature weapon/attack. Purely
 * presentational -- the stat pills show whatever values the caller passes in.
 */
export const CHARACTERS: Record<string, CharacterMeta> = {
  yudhistira: { title: 'Yudhistira', faction: 'satwika', signature: 'Sabda Rahayu' },
  arjuna: { title: 'Raden Arjuna', faction: 'satwika', signature: 'Panah Pasupati' },
  balarama: { title: 'Balarama', faction: 'rajasika', signature: 'Hantaman Nanggala' },
  karna: { title: 'Karna', faction: 'rajasika', signature: 'Senjata Konta' },
  sengkuni: { title: 'Patih Sengkuni', faction: 'tamasika', signature: 'Hasutan Amarta' },
  duryodana: { title: 'Duryodana', faction: 'tamasika', signature: 'Angkara 100 Kurawa' },
};

const FACTION_LABEL: Record<FactionTheme, string> = {
  satwika: 'Satwika',
  rajasika: 'Rajasika',
  tamasika: 'Tamasika',
};

@Component({
  selector: 'app-character-art',
  standalone: true,
  imports: [CommonModule, CharacterEmblemComponent],
  template: `
    <div class="art" [ngClass]="'t-' + theme" role="img" [attr.aria-label]="title + t(', faksi ', ', faction ') + factionLabel">
      <svg class="rings" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="96" /><circle cx="100" cy="100" r="74" /><circle cx="100" cy="100" r="52" />
      </svg>

      <app-character-emblem class="emblem" [key]="key"></app-character-emblem>

      <div class="info">
        <span class="faction">{{ factionLabel }}</span>
        <strong class="name">{{ title }}</strong>
        <span class="sig">✦ {{ signature }}</span>
      </div>

      <div class="stats" *ngIf="hp !== null || damage !== null">
        <span *ngIf="hp !== null" class="pill hp">HP {{ hp }}</span>
        <span *ngIf="damage !== null" class="pill dmg">DMG {{ damage }}</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; --gold: #e8b54a; --gold-soft: #f6dc9a; }
    .art { position: relative; overflow: hidden; height: 132px; border-radius: 12px; color: #fff; isolation: isolate;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .12), 0 12px 24px -16px rgba(13, 11, 31, .8); }
    .art::before { content: ''; position: absolute; inset: 0; z-index: -1; background: radial-gradient(circle at 78% 45%, rgba(255, 255, 255, .22), transparent 50%); }
    .t-satwika { background: linear-gradient(135deg, #1a2a5e, #2b4c9a 60%, #3d67c4); --accent: var(--gold-soft); }
    .t-rajasika { background: linear-gradient(135deg, #5a1414, #a33a1f 55%, #d0512a); --accent: #ffd27a; }
    .t-tamasika { background: linear-gradient(135deg, #0d0b1f, #2a1745 55%, #4a2a74); --accent: #d9b8ff; }

    .rings { position: absolute; right: -34px; top: 50%; width: 200px; height: 200px; margin-top: -100px; fill: none; stroke: var(--accent); stroke-width: .8; opacity: .25; z-index: -1; }
    .emblem { position: absolute; right: 10px; top: 50%; width: 112px; height: 112px; margin-top: -56px; filter: drop-shadow(0 0 8px rgba(255, 255, 255, .25)); transition: transform .4s ease; }
    :host(:hover) .emblem, .art:hover .emblem { transform: scale(1.06) rotate(-3deg); }

    .info { position: absolute; left: 16px; bottom: 14px; right: 120px; display: flex; flex-direction: column; gap: 1px; }
    .faction { font-size: 10px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: var(--accent); opacity: .9; }
    .name { font-family: 'Cinzel', serif; font-size: 19px; line-height: 1.15; color: #fff; text-shadow: 0 2px 10px rgba(0, 0, 0, .45); }
    .sig { font-size: 11px; font-style: italic; color: rgba(255, 255, 255, .78); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .stats { position: absolute; left: 16px; top: 12px; display: flex; gap: 6px; }
    .pill { font: 700 10.5px 'Inter', sans-serif; letter-spacing: .04em; padding: 3px 9px; border-radius: 999px; background: rgba(0, 0, 0, .35); border: 1px solid rgba(255, 255, 255, .2); backdrop-filter: blur(4px); }
    .pill.hp { color: #b8f5d0; }
    .pill.dmg { color: #ffc9a8; }

    @media (prefers-reduced-motion: reduce) { .emblem { transition: none; } }
  `]
})
export class CharacterArtComponent {
  readonly t = inject(LanguageService).t;
  /** Lowercase character key as used in param names, e.g. "yudhistira" for stw_yudhistira_hp. */
  @Input({ required: true }) key = '';
  @Input() hp: number | null = null;
  @Input() damage: number | null = null;

  private get meta(): CharacterMeta | undefined {
    return CHARACTERS[this.key];
  }

  get theme(): FactionTheme {
    return this.meta?.faction ?? 'tamasika';
  }

  get title(): string {
    return this.meta?.title ?? this.key.charAt(0).toUpperCase() + this.key.slice(1);
  }

  get factionLabel(): string {
    return FACTION_LABEL[this.theme];
  }

  get signature(): string {
    return this.meta?.signature ?? '';
  }
}
