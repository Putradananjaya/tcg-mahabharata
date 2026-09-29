import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

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
          <span class="g-eyebrow">Panduan Bermain</span>
          <h2 class="g-title">Mahabharata <span>TCG</span></h2>
          <p class="g-lead">Selamat datang di Research &amp; Balancing Dashboard Mahabharata TCG. Halaman ini menjelaskan aturan main dasar, alur per giliran, dan makna filosofis dari metrik faksi asimetris.</p>
          <div class="g-cta">
            <a routerLink="/simulator/tcg" class="g-btn g-btn-gold">⚔️ Mulai Bertarung</a>
            <a routerLink="/balancer" class="g-btn g-btn-ghost">🔬 Hasil Riset Balancing</a>
          </div>
        </div>
      </section>

      <!-- Factions -->
      <section class="g-section">
        <header class="g-head">
          <span class="g-kicker">Tiga Faksi</span>
          <h3>Pilih Jalan Faksimu</h3>
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
          <span class="g-kicker">Alur Giliran</span>
          <h3>Cara &amp; Alur Permainan</h3>
          <p>Mahabharata TCG dimainkan secara giliran bergiliran antara dua faksi:</p>
        </header>
        <ol class="g-timeline">
          <li *ngFor="let p of phases; let i = index" [style.animation-delay.ms]="i * 90">
            <div class="g-node"><span>{{ p.icon }}</span></div>
            <div class="g-step">
              <span class="g-num">Fase {{ i + 1 }}</span>
              <strong>{{ p.title }}</strong>
              <p>{{ p.desc }}</p>
            </div>
          </li>
        </ol>
      </section>

      <!-- Glossary -->
      <section class="g-section">
        <header class="g-head">
          <span class="g-kicker">Glossarium</span>
          <h3>Makna Istilah</h3>
          <p>Penjelasan metrik dan unsur spiritual dalam game Mahabharata TCG:</p>
        </header>
        <div class="g-terms">
          <div *ngFor="let t of terms" class="g-term">
            <span class="g-term-icon">{{ t.icon }}</span>
            <div>
              <strong>{{ t.name }}</strong>
              <p>{{ t.desc }}</p>
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
  readonly spokes = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  readonly factions: Faction[] = [
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

  readonly phases: Phase[] = [
    { icon: '🃏', title: 'Fase Persiapan Deck', desc: 'Setiap pemain bersiap dengan deck tokoh faksi aktif. Salah satu tokoh masuk ke Arena Aktif, cadangan bersiaga di Bench.' },
    { icon: '📜', title: 'Fase Ambil Kartu (Draw Phase)', desc: 'Giliran dimulai dengan menarik kartu dari deck. Jika dek habis, pemain dinyatakan kalah terkena penalti Deck Out.' },
    { icon: '🔮', title: 'Akumulasi Prana', desc: 'Karakter aktif mengundi prana spiritual setiap turn (sesuai elemen faksi/Universal) sebagai resource melancarkan serangan.' },
    { icon: '⚔️', title: 'Fase Aksi (Combat / Heal)', desc: 'Pemain menyerang karakter aktif lawan atau menggunakan skill penyembuhan (seperti Yudhistira) jika prana mencukupi.' },
    { icon: '🛡️', title: 'Fase Retreat (Tactical Retreat)', desc: 'Karakter aktif yang sekarat dapat retreat ke Bench dengan membayar cost agar tidak tereliminasi oleh lawan.' },
    { icon: '🏆', title: 'Victory Check (Sasmita Drop)', desc: 'Ketika kamu berhasil membuat karakter aktif lawan gugur (HP habis), Sasmita milikmu berkurang 1 (kamu mengklaim satu prize). Faksi yang Sasmita-nya lebih dulu mencapai 0 menang!' }
  ];

  readonly terms: Term[] = [
    { icon: '🛡️', name: 'Sasmita', desc: 'Hitungan prize card faksi (mulai dari 3, bukan life total). Setiap kali kamu berhasil mengalahkan karakter aktif lawan, Sasmita milikmu berkurang 1. Faksi yang lebih dulu mencapai Sasmita 0 menang.' },
    { icon: '🔮', name: 'Prana', desc: 'Energi spiritual/sumber daya faksi yang diundi setiap giliran untuk mengaktifkan serangan atau skill dari kartu tokoh.' },
    { icon: '👤', name: 'Bench (Cadangan)', desc: 'Area siaga untuk karakter cadangan. Karakter di bench aman dari serangan aktif lawan dan dapat dipulihkan secara bertahap.' }
  ];
}
