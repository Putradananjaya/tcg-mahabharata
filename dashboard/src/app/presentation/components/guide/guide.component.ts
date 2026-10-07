import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LanguageService } from '../../../core/services/language.service';

interface Faction {
  key: string;
  name: string;
  house: string;
  icon: string;
  trait: string;
  desc: string;
}

interface Phase {
  icon: string;
  title: string;
  desc: string;
}

interface Term {
  icon: string;
  name: string;
  desc: string;
}

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="g-page">

      <!-- Hero -->
      <section class="g-hero">
        <div class="g-stars" aria-hidden="true"></div>
        <svg class="g-mandala" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="96" />
          <circle cx="100" cy="100" r="78" />
          <circle cx="100" cy="100" r="40" />
          <g *ngFor="let a of spokes" [attr.transform]="'rotate(' + a + ' 100 100)'">
            <path d="M100 22 C112 50 112 70 100 100 C88 70 88 50 100 22Z" />
          </g>
        </svg>
        <div class="g-hero-body">
          <span class="g-eyebrow">{{ t('Panduan Bermain', 'How to Play') }}</span>
          <h2 class="g-title">Mahabharata <span>TCG</span></h2>
          <p class="g-lead">{{ t('Selamat datang di Research & Balancing Dashboard Mahabharata TCG. Halaman ini menjelaskan aturan main dasar, alur per giliran, dan makna filosofis dari metrik faksi asimetris.', 'Welcome to the Mahabharata TCG Research & Balancing Dashboard. This page explains the basic rules, the flow of each turn, and the philosophical meaning behind the asymmetric faction metrics.') }}</p>
          <div class="g-cta">
            <a routerLink="/simulator/tcg" class="g-btn g-btn-gold">⚔️ {{ t('Mulai Bertarung', 'Start a Battle') }}</a>
            <a routerLink="/balancer" class="g-btn g-btn-ghost">🔬 {{ t('Hasil Riset Balancing', 'Balancing Results') }}</a>
          </div>
        </div>
      </section>

      <!-- Factions -->
      <section class="g-section">
        <header class="g-head">
          <span class="g-kicker">{{ t('Tiga Faksi', 'Three Factions') }}</span>
          <h3>{{ t('Pilih Jalan Faksimu', "Choose Your Faction's Path") }}</h3>
        </header>
        <div class="g-factions">
          <article *ngFor="let f of factions; let i = index" class="g-faction" [ngClass]="'f-' + f.key" [style.animation-delay.ms]="i * 120">
            <div class="g-sigil">{{ f.icon }}</div>
            <h4>{{ f.name }}</h4>
            <span class="g-house">{{ f.house }}</span>
            <p class="g-trait">{{ f.trait }}</p>
            <p>{{ f.desc }}</p>
          </article>
        </div>
      </section>

      <!-- Turn flow -->
      <section class="g-section">
        <header class="g-head">
          <span class="g-kicker">{{ t('Alur Giliran', 'Turn Flow') }}</span>
          <h3>{{ t('Cara & Alur Permainan', 'How the Game Is Played') }}</h3>
          <p>{{ t('Mahabharata TCG dimainkan secara giliran bergiliran antara dua faksi:', 'Mahabharata TCG is played in alternating turns between two factions:') }}</p>
        </header>
        <ol class="g-timeline">
          <li *ngFor="let p of phases; let i = index" [style.animation-delay.ms]="i * 90">
            <div class="g-node"><span>{{ p.icon }}</span></div>
            <div class="g-step">
              <span class="g-num">{{ t('Fase', 'Phase') }} {{ i + 1 }}</span>
              <strong>{{ p.title }}</strong>
              <p>{{ p.desc }}</p>
            </div>
          </li>
        </ol>
      </section>

      <!-- Glossary -->
      <section class="g-section">
        <header class="g-head">
          <span class="g-kicker">{{ t('Glosarium', 'Glossary') }}</span>
          <h3>{{ t('Makna Istilah', 'Key Terms') }}</h3>
          <p>{{ t('Penjelasan metrik dan unsur spiritual dalam game Mahabharata TCG:', 'The metrics and spiritual elements of the Mahabharata TCG:') }}</p>
        </header>
        <div class="g-terms">
          <div *ngFor="let term of terms" class="g-term">
            <span class="g-term-icon">{{ term.icon }}</span>
            <div>
              <strong>{{ term.name }}</strong>
              <p>{{ term.desc }}</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  `,
  styles: [`
    :host { display: block; --gold: #e8b54a; --gold-soft: #f6dc9a; --night: #0d0b1f; --ink: #1b1535; }
    .g-page { display: flex; flex-direction: column; gap: 40px; padding-bottom: 40px; }
    p { margin: 0; }

    /* Hero */
    .g-hero { position: relative; overflow: hidden; border-radius: 20px; padding: 56px 48px; min-height: 300px; display: flex; align-items: center;
      background: radial-gradient(ellipse at 80% 20%, #5b2a86 0%, transparent 55%), radial-gradient(ellipse at 10% 90%, #7a1f2b 0%, transparent 50%), linear-gradient(135deg, var(--night), var(--ink));
      box-shadow: 0 24px 60px -20px rgba(27, 21, 53, .55); }
    .g-stars { position: absolute; inset: 0; opacity: .7;
      background-image: radial-gradient(1px 1px at 12% 22%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 32% 68%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 58% 14%, var(--gold-soft) 50%, transparent 51%), radial-gradient(1px 1px at 74% 58%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 90% 30%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 46% 88%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 22% 48%, var(--gold-soft) 50%, transparent 51%);
      animation: g-twinkle 5s ease-in-out infinite alternate; }
    .g-mandala { position: absolute; right: -60px; top: 50%; width: 420px; height: 420px; margin-top: -210px; fill: none; stroke: var(--gold); stroke-width: .6; opacity: .35; animation: g-spin 90s linear infinite; }
    .g-hero-body { position: relative; max-width: 620px; animation: g-rise .8s ease-out both; }
    .g-eyebrow, .g-kicker { font-size: 11px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; color: var(--gold); }
    .g-title { font-family: 'Cinzel', serif; font-size: clamp(34px, 5vw, 54px); line-height: 1.05; margin: 10px 0 16px; color: #fff; letter-spacing: .02em; }
    .g-title span { background: linear-gradient(90deg, var(--gold), var(--gold-soft)); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .g-lead { color: rgba(255, 255, 255, .78); font-size: 15px; line-height: 1.7; }
    .g-cta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
    .g-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px; border-radius: 999px; font-size: 14px; font-weight: 700; text-decoration: none; transition: transform .2s, box-shadow .2s, background .2s; }
    .g-btn:hover { transform: translateY(-2px); }
    .g-btn-gold { background: linear-gradient(135deg, var(--gold), #c98a1c); color: var(--night); box-shadow: 0 8px 24px -8px rgba(232, 181, 74, .8); }
    .g-btn-ghost { color: #fff; border: 1px solid rgba(255, 255, 255, .3); background: rgba(255, 255, 255, .06); }
    .g-btn-ghost:hover { background: rgba(255, 255, 255, .14); }

    /* Section heads */
    .g-head { text-align: center; max-width: 640px; margin: 0 auto 24px; }
    .g-head .g-kicker { color: #b07d1a; }
    .g-head h3 { font-family: 'Cinzel', serif; font-size: 28px; margin: 6px 0 8px; color: var(--ink); }
    .g-head p { font-size: 14px; }

    /* Factions */
    .g-factions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .g-faction { position: relative; overflow: hidden; border-radius: 18px; padding: 28px 24px; color: #fff; animation: g-rise .7s ease-out both; transition: transform .3s, box-shadow .3s; }
    .g-faction::after { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 50% 0%, rgba(255, 255, 255, .22), transparent 60%); pointer-events: none; }
    .g-faction:hover { transform: translateY(-6px); }
    .g-faction h4 { font-family: 'Cinzel', serif; font-size: 22px; margin: 14px 0 2px; color: #fff; }
    .g-faction p { color: rgba(255, 255, 255, .82); font-size: 13px; line-height: 1.65; }
    .g-sigil { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; font-size: 26px; background: rgba(255, 255, 255, .14); border: 1px solid rgba(255, 255, 255, .3); }
    .g-house { font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; opacity: .75; }
    .g-trait { margin: 12px 0 8px !important; font-style: italic; color: #fff !important; }
    .f-satwika { background: linear-gradient(160deg, #2b4c9a, #1a2a5e); }
    .f-satwika:hover { box-shadow: 0 20px 40px -14px rgba(59, 99, 199, .7); }
    .f-rajasika { background: linear-gradient(160deg, #d0512a, #7c1d1d); }
    .f-rajasika:hover { box-shadow: 0 20px 40px -14px rgba(208, 81, 42, .7); }
    .f-tamasika { background: linear-gradient(160deg, #3d2360, #140c24); }
    .f-tamasika:hover { box-shadow: 0 20px 40px -14px rgba(106, 58, 160, .7); }

    /* Timeline */
    .g-timeline { list-style: none; margin: 0 auto; padding: 0; max-width: 760px; position: relative; }
    .g-timeline::before { content: ''; position: absolute; left: 27px; top: 28px; bottom: 46px; width: 2px; background: linear-gradient(var(--gold), #5b2a86); opacity: .5; }
    .g-timeline li { display: flex; gap: 20px; padding-bottom: 18px; animation: g-rise .6s ease-out both; }
    .g-node { flex: none; width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; font-size: 22px; position: relative; z-index: 1;
      background: radial-gradient(circle at 30% 30%, #2d2356, var(--night)); border: 2px solid var(--gold); box-shadow: 0 0 0 5px rgba(232, 181, 74, .12); }
    .g-step { flex: 1; background: #fff; border: 1px solid #ece6d6; border-radius: 14px; padding: 16px 20px; transition: border-color .2s, box-shadow .2s; }
    .g-step:hover { border-color: var(--gold); box-shadow: 0 10px 24px -14px rgba(176, 125, 26, .6); }
    .g-num { display: block; font-size: 10px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #b07d1a; }
    .g-step strong { display: block; font-size: 16px; color: var(--ink); margin: 2px 0 6px; }
    .g-step p { font-size: 13.5px; line-height: 1.65; }

    /* Terms */
    .g-terms { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .g-term { display: flex; gap: 14px; background: linear-gradient(180deg, #fffdf7, #fff); border: 1px solid #ece6d6; border-radius: 14px; padding: 18px; }
    .g-term-icon { flex: none; font-size: 24px; }
    .g-term strong { display: block; font-family: 'Cinzel', serif; font-size: 16px; color: var(--ink); margin-bottom: 4px; }
    .g-term p { font-size: 13px; line-height: 1.6; }

    @keyframes g-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
    @keyframes g-spin { to { transform: rotate(360deg); } }
    @keyframes g-twinkle { from { opacity: .45; } to { opacity: .9; } }

    @media (max-width: 900px) {
      .g-factions, .g-terms { grid-template-columns: 1fr; }
      .g-hero { padding: 40px 24px; }
      .g-mandala { opacity: .18; }
    }
    @media (prefers-reduced-motion: reduce) {
      .g-mandala, .g-stars, .g-hero-body, .g-faction, .g-timeline li { animation: none; }
    }
  `]
})
export class GuideComponent {
  private readonly i18n = inject(LanguageService);
  readonly t = this.i18n.t;
  readonly spokes = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  get factions(): Faction[] {
    return this.i18n.isEn() ? FACTIONS_EN : FACTIONS_ID;
  }

  get phases(): Phase[] {
    return this.i18n.isEn() ? PHASES_EN : PHASES_ID;
  }

  get terms(): Term[] {
    return this.i18n.isEn() ? TERMS_EN : TERMS_ID;
  }
}

const FACTIONS_ID: Faction[] = [
  {
    key: 'satwika', name: 'Satwika', house: 'Pandawa', icon: '✨',
    trait: 'Sifat tenang, mulia, dan murni.',
    desc: 'Faksi Pandawa berfokus pada ketahanan (Damage Reduction) dan regenerasi HP berlanjut di Bench.'
  },
  {
    key: 'rajasika', name: 'Rajasika', house: 'Aggro', icon: '🔥',
    trait: 'Sifat aktif, bergelora, dan agresif.',
    desc: 'Faksi Rajasika berfokus pada serangan eksplosif cepat di awal laga namun memiliki resiko recoil damage diri sendiri.'
  },
  {
    key: 'tamasika', name: 'Tamasika', house: 'Kurawa', icon: '🌪️',
    trait: 'Sifat gelap, destruktif, dan culas.',
    desc: 'Faksi Kurawa berfokus pada taktik memperlambat tempo (Stall), membuang deck lawan (Mill), dan scaling damage berbasis kartu mati di makam.'
  }
];

const FACTIONS_EN: Faction[] = [
  {
    key: 'satwika', name: 'Satwika', house: 'Pandawa', icon: '✨',
    trait: 'Calm, noble and pure.',
    desc: 'The Pandawa faction focuses on endurance (Damage Reduction) and ongoing HP regeneration on the Bench.'
  },
  {
    key: 'rajasika', name: 'Rajasika', house: 'Aggro', icon: '🔥',
    trait: 'Active, passionate and aggressive.',
    desc: 'The Rajasika faction focuses on fast, explosive attacks early in the match, at the risk of recoil damage to itself.'
  },
  {
    key: 'tamasika', name: 'Tamasika', house: 'Kurawa', icon: '🌪️',
    trait: 'Dark, destructive and cunning.',
    desc: 'The Kurawa faction focuses on slowing the tempo (Stall), discarding the opponent\'s deck (Mill), and damage that scales with the cards in the graveyard.'
  }
];

const PHASES_ID: Phase[] = [
  { icon: '🃏', title: 'Fase Persiapan Deck', desc: 'Setiap pemain bersiap dengan deck tokoh faksi aktif. Salah satu tokoh masuk ke Arena Aktif, cadangan bersiaga di Bench.' },
  { icon: '📜', title: 'Fase Ambil Kartu (Draw Phase)', desc: 'Giliran dimulai dengan menarik kartu dari deck. Jika dek habis, pemain dinyatakan kalah terkena penalti Deck Out.' },
  { icon: '🔮', title: 'Akumulasi Prana', desc: 'Karakter aktif mengundi prana spiritual setiap turn (sesuai elemen faksi/Universal) sebagai resource melancarkan serangan.' },
  { icon: '⚔️', title: 'Fase Aksi (Combat / Heal)', desc: 'Pemain menyerang karakter aktif lawan atau menggunakan skill penyembuhan (seperti Yudhistira) jika prana mencukupi.' },
  { icon: '🛡️', title: 'Fase Retreat (Tactical Retreat)', desc: 'Karakter aktif yang sekarat dapat retreat ke Bench dengan membayar cost agar tidak tereliminasi oleh lawan.' },
  { icon: '🏆', title: 'Victory Check (Sasmita Drop)', desc: 'Ketika kamu berhasil membuat karakter aktif lawan gugur (HP habis), Sasmita milikmu berkurang 1 (kamu mengklaim satu prize). Faksi yang Sasmita-nya lebih dulu mencapai 0 menang!' }
];

const PHASES_EN: Phase[] = [
  { icon: '🃏', title: 'Deck Preparation', desc: 'Each player prepares a deck of their faction\'s characters. One character enters the Active Arena; the reserves wait on the Bench.' },
  { icon: '📜', title: 'Draw Phase', desc: 'A turn starts by drawing a card from the deck. If the deck is empty, the player loses by the Deck Out penalty.' },
  { icon: '🔮', title: 'Prana Accumulation', desc: 'Every turn the active character gains spiritual prana (of its faction element or Universal), the resource used to launch attacks.' },
  { icon: '⚔️', title: 'Action Phase (Combat / Heal)', desc: 'The player attacks the opponent\'s active character, or uses a healing skill (such as Yudhistira\'s) if there is enough prana.' },
  { icon: '🛡️', title: 'Retreat Phase (Tactical Retreat)', desc: 'A badly wounded active character can retreat to the Bench by paying a cost, so it is not eliminated by the opponent.' },
  { icon: '🏆', title: 'Victory Check (Sasmita Drop)', desc: 'When you knock out the opponent\'s active character (HP reaches 0), your Sasmita drops by 1 (you claim one prize). The faction whose Sasmita reaches 0 first wins!' }
];

const TERMS_ID: Term[] = [
  { icon: '🛡️', name: 'Sasmita', desc: 'Hitungan prize card faksi (mulai dari 3, bukan life total). Setiap kali kamu berhasil mengalahkan karakter aktif lawan, Sasmita milikmu berkurang 1. Faksi yang lebih dulu mencapai Sasmita 0 menang.' },
  { icon: '🔮', name: 'Prana', desc: 'Energi spiritual/sumber daya faksi yang diundi setiap giliran untuk mengaktifkan serangan atau skill dari kartu tokoh.' },
  { icon: '👤', name: 'Bench (Cadangan)', desc: 'Area siaga untuk karakter cadangan. Karakter di bench aman dari serangan aktif lawan dan dapat dipulihkan secara bertahap.' }
];

const TERMS_EN: Term[] = [
  { icon: '🛡️', name: 'Sasmita', desc: 'A faction\'s prize-card count (starts at 3; it is not a life total). Each time you defeat the opponent\'s active character, your Sasmita drops by 1. The faction that reaches Sasmita 0 first wins.' },
  { icon: '🔮', name: 'Prana', desc: 'Spiritual energy, the faction resource gained every turn to power the attacks and skills of character cards.' },
  { icon: '👤', name: 'Bench (Reserve)', desc: 'The waiting area for reserve characters. Characters on the Bench are safe from the opponent\'s attacks and can be healed gradually.' }
];
