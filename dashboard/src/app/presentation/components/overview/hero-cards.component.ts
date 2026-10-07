import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { LanguageService } from '../../../core/services/language.service';
import { ParamUpdate, SandboxService } from '../../../core/usecases/sandbox.service';
import { CHARACTERS, FactionTheme } from '../character-art/character-art.component';
import { CharacterEmblemComponent } from '../character-art/character-emblem.component';

interface HeroCard {
  key: string;
  /** Parameter keys holding this character's HP and signature-attack damage. */
  hpKey: string;
  dmgKey: string;
  /** Fan slot: rotation (deg) and offset (px) from the fan's centre. */
  rot: number;
  x: number;
  y: number;
}

/** Same faction labels as the Parameter Sliders page. */
const FACTION_LABEL: Record<FactionTheme, string> = {
  satwika: 'Pandawa (Satwika)',
  rajasika: 'Rajasika',
  tamasika: 'Kurawa (Tamasika)',
};

/** Pandawa on the left, Kurawa on the right, as on the field of Kurukshetra. */
const CARDS: HeroCard[] = [
  { key: 'yudhistira', hpKey: 'stw_yudhistira_hp', dmgKey: 'stw_yudhistira_dmg', rot: -21, x: -130, y: 30 },
  { key: 'arjuna', hpKey: 'stw_arjuna_hp', dmgKey: 'stw_arjuna_pasupati_dmg', rot: -12.5, x: -78, y: 11 },
  { key: 'balarama', hpKey: 'rjs_balarama_hp', dmgKey: 'rjs_balarama_dmg', rot: -4, x: -26, y: 0 },
  { key: 'karna', hpKey: 'rjs_karna_hp', dmgKey: 'rjs_karna_dmg', rot: 4, x: 26, y: 0 },
  { key: 'sengkuni', hpKey: 'tms_sengkuni_hp', dmgKey: 'tms_sengkuni_dmg', rot: 12.5, x: 78, y: 11 },
  { key: 'duryodana', hpKey: 'tms_duryodana_hp', dmgKey: 'tms_duryodana_angkara_dmg', rot: 21, x: 130, y: 30 },
];

/** Display pacing only: when the spotlight starts moving and how long it stays on each card. */
const DEAL_DONE_MS = 2600;
const SPOTLIGHT_MS = 2600;
const EMBER_COUNT = 14;

/**
 * Decorative hero animation for the overview page: the six character cards
 * are dealt face-down from a deck, flip over into a fan in front of a turning
 * chariot wheel (the war at Kurukshetra), and a spotlight then cycles through
 * them. HP/damage on the cards are the live sandbox parameters, shown only
 * once data/ga_balanced_params.json has loaded — nothing is invented.
 */
@Component({
  selector: 'app-hero-cards',
  standalone: true,
  imports: [CommonModule, CharacterEmblemComponent],
  template: `
    <div class="stage" role="img"
         [attr.aria-label]="t('Enam kartu karakter Mahabharata TCG: Yudhistira, Arjuna, Balarama, Karna, Sengkuni, dan Duryodana', 'Six Mahabharata TCG character cards: Yudhistira, Arjuna, Balarama, Karna, Sengkuni and Duryodana')">
      <!-- Chariot wheel of Kurukshetra -->
      <svg class="chakra" viewBox="0 0 400 400" aria-hidden="true">
        <circle cx="200" cy="200" r="190" class="rim" />
        <circle cx="200" cy="200" r="172" class="rim thin" />
        <circle cx="200" cy="200" r="34" class="rim" />
        <circle cx="200" cy="200" r="14" class="hub" />
        <g *ngFor="let a of spokes" [attr.transform]="'rotate(' + a + ' 200 200)'">
          <line x1="200" y1="34" x2="200" y2="166" class="spoke" />
          <circle cx="200" cy="20" r="4" class="hub" />
        </g>
      </svg>
      <div class="glow" aria-hidden="true"></div>

      <!-- Arrows in flight -->
      <svg *ngFor="let a of arrows" class="arrow" [style.animation-delay.s]="a.delay" [style.top.%]="a.top"
           viewBox="0 0 160 16" aria-hidden="true">
        <line x1="10" y1="8" x2="146" y2="8" />
        <path d="M146 2 L160 8 L146 14Z" />
        <path d="M10 8 L0 1 M10 8 L0 15 M18 8 L8 1 M18 8 L8 15" class="fletch" />
      </svg>

      <!-- Embers -->
      <span *ngFor="let e of embers" class="ember" aria-hidden="true"
            [style.left.%]="e.left" [style.animation-delay.s]="e.delay" [style.animation-duration.s]="e.duration"></span>

      <!-- Card fan -->
      <div class="fan" (mouseleave)="resume()">
        <div *ngFor="let c of cards; let i = index" class="slot" [class.active]="i === active"
             [style.--i]="i" [style.--rot]="c.rot + 'deg'" [style.--x]="c.x + 'px'" [style.--y]="c.y + 'px'"
             [style.z-index]="i === active ? 20 : i + 1"
             (mouseenter)="focus(i)">
          <div class="card" [ngClass]="'t-' + faction(c)">
            <div class="face front">
              <div class="top"><strong>{{ title(c) }}</strong></div>
              <div class="art">
                <span class="hp" *ngIf="params">HP {{ params[c.hpKey] }}</span>
                <svg class="rings" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" /><circle cx="50" cy="50" r="34" /></svg>
                <app-character-emblem class="emblem" [key]="c.key"></app-character-emblem>
              </div>
              <div class="bottom">
                <span class="faction">{{ factionLabel(c) }}</span>
                <span class="attack">
                  <em>{{ signature(c) }}</em>
                  <b *ngIf="params">{{ params[c.dmgKey] }}</b>
                </span>
              </div>
            </div>
            <div class="face back" aria-hidden="true">
              <svg viewBox="0 0 100 140">
                <rect x="6" y="6" width="88" height="128" rx="8" class="frame" />
                <g transform="translate(50 70)">
                  <circle r="30" class="frame" /><circle r="20" class="frame" />
                  <path *ngFor="let a of petals" [attr.transform]="'rotate(' + a + ')'" d="M0 -30 C6 -18 6 -10 0 0 C-6 -10 -6 -18 0 -30Z" class="petal" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="caption" aria-hidden="true">
      <span class="dot" [ngClass]="'d-' + faction(cards[active])"></span>
      <strong>{{ title(cards[active]) }}</strong>
      <span>{{ factionLabel(cards[active]) }} · <em>{{ signature(cards[active]) }}</em></span>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; align-items: center; --gold: #e8b54a; --gold-soft: #f6dc9a; --night: #0d0b1f; }
    .stage { position: relative; width: 460px; height: 380px; }

    /* Backdrop */
    .chakra { position: absolute; left: 50%; top: 46%; width: 380px; height: 380px; margin: -190px 0 0 -190px; animation: spin 48s linear infinite; opacity: .5; }
    .rim { fill: none; stroke: var(--gold); stroke-width: 2; }
    .rim.thin { stroke-width: 1; stroke-dasharray: 4 6; }
    .spoke { stroke: var(--gold); stroke-width: 2.4; opacity: .7; }
    .hub { fill: var(--gold); opacity: .8; }
    .glow { position: absolute; left: 50%; top: 52%; width: 340px; height: 340px; margin: -170px 0 0 -170px; border-radius: 50%;
      background: radial-gradient(circle, rgba(232, 181, 74, .35), rgba(232, 181, 74, 0) 65%); animation: pulse 4s ease-in-out infinite; }

    .arrow { position: absolute; left: 0; width: 150px; height: 14px; opacity: 0; fill: var(--gold-soft); stroke: var(--gold-soft); stroke-width: 2;
      filter: drop-shadow(0 0 6px rgba(246, 220, 154, .9)); animation: fly 6.5s cubic-bezier(.4, 0, .6, 1) infinite; }
    .arrow .fletch { fill: none; stroke-width: 1.6; }
    .ember { position: absolute; bottom: 10%; width: 4px; height: 4px; border-radius: 50%; background: var(--gold-soft);
      box-shadow: 0 0 8px 2px rgba(232, 181, 74, .8); opacity: 0; animation: rise linear infinite; }

    /* Fan */
    .fan { position: absolute; left: 50%; top: 50%; width: 0; height: 0; animation: bob 6s ease-in-out 2.4s infinite; }
    .slot { position: absolute; left: -66px; top: -96px; width: 132px; height: 186px; transform-origin: 50% 120%;
      transform: translate(var(--x), var(--y)) rotate(var(--rot));
      transition: transform .6s cubic-bezier(.2, .8, .2, 1), filter .6s;
      animation: deal .9s cubic-bezier(.2, .8, .2, 1) backwards; animation-delay: calc(var(--i) * 150ms + 200ms); cursor: pointer; }
    .slot.active { transform: translate(var(--x), calc(var(--y) - 40px)) rotate(calc(var(--rot) * .35)) scale(1.14); }
    .fan:hover .slot:not(.active) { filter: brightness(.75); }

    .card { position: relative; width: 100%; height: 100%; transform-style: preserve-3d;
      animation: flip .8s ease-out backwards; animation-delay: calc(var(--i) * 150ms + 700ms); }
    .face { position: absolute; inset: 0; border-radius: 12px; backface-visibility: hidden; -webkit-backface-visibility: hidden; overflow: hidden; }
    .back { transform: rotateY(180deg); background: radial-gradient(circle at 50% 45%, #3b2470, var(--night) 75%); border: 2px solid var(--gold);
      box-shadow: 0 14px 30px -12px rgba(0, 0, 0, .8); }
    .back svg { width: 100%; height: 100%; }
    .back .frame { fill: none; stroke: var(--gold); stroke-width: 1; opacity: .7; }
    .back .petal { fill: var(--gold); opacity: .35; }

    .front { display: flex; flex-direction: column; padding: 6px; gap: 5px; color: #fff; border: 2px solid var(--gold);
      box-shadow: 0 16px 34px -14px rgba(0, 0, 0, .85), inset 0 0 0 1px rgba(255, 255, 255, .18); }
    .front::after { content: ''; position: absolute; inset: 0; pointer-events: none;
      background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, .28) 45%, transparent 60%); background-size: 250% 100%; background-position: 120% 0; }
    .slot.active .front::after { animation: shine 1.4s ease-out; }
    .slot.active .front { box-shadow: 0 0 0 2px var(--gold-soft), 0 0 34px 4px rgba(232, 181, 74, .55), 0 20px 40px -14px rgba(0, 0, 0, .9); }
    .t-satwika { --accent: var(--gold-soft); --card-bg: linear-gradient(160deg, #3d67c4, #1a2a5e); }
    .t-rajasika { --accent: #ffd27a; --card-bg: linear-gradient(160deg, #d0512a, #5a1414); }
    .t-tamasika { --accent: #d9b8ff; --card-bg: linear-gradient(160deg, #4a2a74, #0d0b1f); }
    .front { background: var(--card-bg); }

    .top { text-align: center; }
    .top strong { display: block; font-family: 'Cinzel', serif; font-size: 11px; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hp { position: absolute; top: 4px; right: 5px; z-index: 1; font: 800 9.5px 'Inter', sans-serif; color: #b8f5d0;
      padding: 1px 6px; border-radius: 999px; background: rgba(0, 0, 0, .45); }
    .art { position: relative; flex: 1; border-radius: 8px; background: rgba(0, 0, 0, .28); border: 1px solid rgba(255, 255, 255, .18); overflow: hidden; }
    .rings { position: absolute; inset: 6px; fill: none; stroke: var(--accent); stroke-width: .8; opacity: .3; }
    .emblem { position: absolute; inset: 8px; filter: drop-shadow(0 0 6px rgba(255, 255, 255, .35)); }
    .bottom { display: flex; flex-direction: column; gap: 1px; }
    .faction { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font: 700 7.5px 'Inter', sans-serif; letter-spacing: .18em; text-transform: uppercase; color: var(--accent); }
    .attack { display: flex; justify-content: space-between; gap: 4px; font-size: 10px; }
    .attack em { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: rgba(255, 255, 255, .85); }
    .attack b { flex: none; color: #ffc9a8; }


    .caption { margin-top: 18px; display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-radius: 999px; font-size: 13px;
      color: rgba(255, 255, 255, .85); background: rgba(255, 255, 255, .07); border: 1px solid rgba(232, 181, 74, .35); backdrop-filter: blur(4px); }
    .caption strong { font-family: 'Cinzel', serif; color: var(--gold-soft); }
    .dot { width: 9px; height: 9px; border-radius: 50%; }
    .d-satwika { background: #6d95ff; } .d-rajasika { background: #ff8a4d; } .d-tamasika { background: #b98cff; }

    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%, 100% { opacity: .55; transform: scale(.95); } 50% { opacity: 1; transform: scale(1.05); } }
    @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
    @keyframes deal { from { transform: translate(0, 250px) rotate(0deg) scale(.5); opacity: 0; } }
    @keyframes flip { from { transform: rotateY(180deg); } }
    @keyframes shine { from { background-position: 120% 0; } to { background-position: -40% 0; } }
    @keyframes fly {
      0% { transform: translate(-180px, 80px) rotate(-16deg); opacity: 0; }
      8% { opacity: 1; }
      30% { transform: translate(560px, -80px) rotate(-16deg); opacity: 0; }
      100% { transform: translate(560px, -80px) rotate(-16deg); opacity: 0; }
    }
    @keyframes rise {
      0% { transform: translateY(0) scale(1); opacity: 0; }
      15% { opacity: .9; }
      100% { transform: translateY(-300px) scale(.3); opacity: 0; }
    }

    /* zoom (not transform) so the layout box shrinks with the picture and never forces a horizontal scroll. */
    @media (max-width: 1400px) { .stage { zoom: .88; } }
    @media (max-width: 1100px) { .stage { zoom: 1; } }
    @media (max-width: 560px) {
      .stage { zoom: .7; }
      .caption { font-size: 11.5px; padding: 6px 12px; }
    }
    @media (max-width: 380px) { .stage { zoom: .6; } }
    @media (prefers-reduced-motion: reduce) {
      .chakra, .glow, .arrow, .ember, .fan, .slot, .card, .slot.active .front::after { animation: none !important; }
      .arrow, .ember { display: none; }
    }
  `],
})
export class HeroCardsComponent implements OnInit, OnDestroy {
  private readonly i18n = inject(LanguageService);
  private readonly sandbox = inject(SandboxService);
  readonly t = this.i18n.t;

  readonly cards = CARDS;
  readonly spokes = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  readonly petals = [0, 45, 90, 135, 180, 225, 270, 315];
  readonly arrows = [{ top: 30, delay: 1.6 }, { top: 58, delay: 3.8 }, { top: 18, delay: 5.6 }];
  /** Evenly spread, fixed positions so the page looks the same on every load. */
  readonly embers = Array.from({ length: EMBER_COUNT }, (_, i) => ({
    left: 6 + (i * 88) / (EMBER_COUNT - 1),
    delay: (i * 0.73) % 5,
    duration: 5 + (i % 4),
  }));

  active = 1;
  params: ParamUpdate | null = null;

  private paused = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private startTimer: ReturnType<typeof setTimeout> | null = null;
  private sub: Subscription | null = null;

  ngOnInit(): void {
    this.sub = this.sandbox.getParams().subscribe((p) => this.params = p);
    this.startTimer = setTimeout(() => {
      this.timer = setInterval(() => {
        if (!this.paused) this.active = (this.active + 1) % this.cards.length;
      }, SPOTLIGHT_MS);
    }, DEAL_DONE_MS);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.startTimer) clearTimeout(this.startTimer);
    if (this.timer) clearInterval(this.timer);
  }

  focus(i: number): void {
    this.paused = true;
    this.active = i;
  }

  resume(): void {
    this.paused = false;
  }

  faction(c: HeroCard): FactionTheme {
    return CHARACTERS[c.key].faction;
  }

  title(c: HeroCard): string {
    return CHARACTERS[c.key].title;
  }

  signature(c: HeroCard): string {
    return CHARACTERS[c.key].signature;
  }

  factionLabel(c: HeroCard): string {
    return FACTION_LABEL[this.faction(c)];
  }
}
