import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Line-art emblem of one character's signature weapon/attack, drawn in the
 * inherited `--accent` colour. Shared by the character-art banner and the
 * overview hero cards. Unknown keys (custom cards) get a generic sigil.
 */
@Component({
  selector: 'app-character-emblem',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg viewBox="0 0 120 120" aria-hidden="true" [ngSwitch]="key">
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
  `,
  styles: [`
    :host { display: block; }
    svg { display: block; width: 100%; height: 100%; }
    .line { fill: none; stroke: var(--accent); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    .line.thick { stroke-width: 5; }
    .line.thin { stroke-width: 1.6; }
    .fill { fill: var(--accent); }
    .fill.soft { opacity: .55; }
    .fill.softer { opacity: .3; }
    .fill-dim { fill: rgba(255, 255, 255, .08); }
    .halo { fill: none; stroke: var(--accent); stroke-width: 1; stroke-dasharray: 3 5; opacity: .6; }
    .rays { opacity: .8; }
  `]
})
export class CharacterEmblemComponent {
  /** Lowercase character key, e.g. "arjuna". */
  @Input({ required: true }) key = '';

  readonly rays = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
}
