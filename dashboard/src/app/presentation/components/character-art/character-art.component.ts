import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type FactionTheme = 'satwika' | 'rajasika' | 'tamasika';

interface CharacterMeta {
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
const CHARACTERS: Record<string, CharacterMeta> = {
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
  imports: [CommonModule],
  template: `
    <div class="art" [ngClass]="'t-' + theme" role="img" [attr.aria-label]="title + ', faksi ' + factionLabel">
      <svg class="rings" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="96" /><circle cx="100" cy="100" r="74" /><circle cx="100" cy="100" r="52" />
      </svg>

      <svg class="emblem" viewBox="0 0 120 120" aria-hidden="true" [ngSwitch]="key">
        <!-- Yudhistira: lotus of righteous speech under a halo -->
        <g *ngSwitchCase="'yudhistira'">
          <circle cx="60" cy="52" r="34" class="halo" />
          <path d="M60 30 C70 44 70 62 60 78 C50 62 50 44 60 30Z" class="fill" />
          <path d="M60 78 C44 72 34 58 34 44 C46 48 56 60 60 78Z" class="fill soft" />
          <path d="M60 78 C76 72 86 58 86 44 C74 48 64 60 60 78Z" class="fill soft" />
          <path d="M60 78 C40 80 26 72 20 62 C34 60 50 66 60 78Z" class="fill softer" />
          <path d="M60 78 C80 80 94 72 100 62 C86 60 70 66 60 78Z" class="fill softer" />
          <path d="M30 92 Q60 84 90 92" class="line" />
          <path d="M38 102 Q60 96 82 102" class="line thin" />
        </g>
        <!-- Arjuna: drawn bow with arrow (Pasupati) -->
        <g *ngSwitchCase="'arjuna'">
          <path d="M38 14 Q96 60 38 106" class="line thick" />
          <line x1="38" y1="14" x2="38" y2="106" class="line thin" />
          <line x1="22" y1="60" x2="102" y2="60" class="line" />
          <path d="M102 60 L88 52 L92 60 L88 68Z" class="fill" />
          <path d="M22 60 L14 52 M22 60 L14 68 M28 60 L20 52 M28 60 L20 68" class="line thin" />
          <circle cx="60" cy="60" r="44" class="halo" />
        </g>
        <!-- Balarama: the Nanggala plough-weapon -->
        <g *ngSwitchCase="'balarama'">
          <circle cx="60" cy="60" r="44" class="halo" />
          <line x1="30" y1="22" x2="80" y2="88" class="line thick" />
          <line x1="22" y1="30" x2="40" y2="16" class="line thick" />
          <path d="M76 82 C92 84 102 94 104 106 L84 102 C82 96 78 90 72 88Z" class="fill" />
          <circle cx="55" cy="55" r="4" class="fill" />
        </g>
        <!-- Karna: sun disc pierced by the Konta spear -->
        <g *ngSwitchCase="'karna'">
          <g class="rays">
            <line *ngFor="let a of rays" x1="60" y1="18" x2="60" y2="8" class="line" [attr.transform]="'rotate(' + a + ' 60 46)'" />
          </g>
          <circle cx="60" cy="46" r="22" class="fill soft" />
          <circle cx="60" cy="46" r="22" class="line" />
          <line x1="60" y1="20" x2="60" y2="112" class="line thick" />
          <path d="M60 4 L68 22 L60 18 L52 22Z" class="fill" />
          <line x1="50" y1="96" x2="70" y2="96" class="line" />
        </g>
        <!-- Sengkuni: the loaded dice -->
        <g *ngSwitchCase="'sengkuni'">
          <circle cx="60" cy="60" r="44" class="halo" />
          <rect x="22" y="44" width="36" height="36" rx="6" class="line fill-dim" transform="rotate(-14 40 62)" />
          <g transform="rotate(-14 40 62)" class="fill">
            <circle cx="31" cy="53" r="3.2" /><circle cx="40" cy="62" r="3.2" /><circle cx="49" cy="71" r="3.2" />
          </g>
          <rect x="60" y="34" width="36" height="36" rx="6" class="line fill-dim" transform="rotate(16 78 52)" />
          <g transform="rotate(16 78 52)" class="fill">
            <circle cx="69" cy="43" r="3.2" /><circle cx="87" cy="43" r="3.2" /><circle cx="69" cy="61" r="3.2" /><circle cx="87" cy="61" r="3.2" />
          </g>
        </g>
        <!-- Duryodana: crowned gada (mace) -->
        <g *ngSwitchCase="'duryodana'">
          <circle cx="60" cy="60" r="44" class="halo" />
          <line x1="34" y1="104" x2="66" y2="52" class="line thick" />
          <line x1="30" y1="98" x2="42" y2="106" class="line" />
          <ellipse cx="74" cy="40" rx="18" ry="22" transform="rotate(32 74 40)" class="fill soft" />
          <ellipse cx="74" cy="40" rx="18" ry="22" transform="rotate(32 74 40)" class="line" />
          <path d="M62 28 Q74 40 86 52 M66 22 Q80 34 90 44" class="line thin" />
          <path d="M14 34 L19 20 L26 29 L32 14 L38 29 L45 20 L50 34Z" class="fill" />
        </g>
        <!-- Unknown / custom card: generic sigil -->
        <g *ngSwitchDefault>
          <circle cx="60" cy="60" r="40" class="halo" />
          <path d="M60 24 L68 52 L96 60 L68 68 L60 96 L52 68 L24 60 L52 52Z" class="fill soft" />
        </g>
      </svg>

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
    .emblem .line { fill: none; stroke: var(--accent); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    .emblem .line.thick { stroke-width: 5; }
    .emblem .line.thin { stroke-width: 1.6; }
    .emblem .fill { fill: var(--accent); }
    .emblem .fill.soft { opacity: .55; }
    .emblem .fill.softer { opacity: .3; }
    .emblem .fill-dim { fill: rgba(255, 255, 255, .08); }
    .emblem .halo { fill: none; stroke: var(--accent); stroke-width: 1; stroke-dasharray: 3 5; opacity: .6; }
    .emblem .rays { opacity: .8; }

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
  /** Lowercase character key as used in param names, e.g. "yudhistira" for stw_yudhistira_hp. */
  @Input({ required: true }) key = '';
  @Input() hp: number | null = null;
  @Input() damage: number | null = null;

  readonly rays = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

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
