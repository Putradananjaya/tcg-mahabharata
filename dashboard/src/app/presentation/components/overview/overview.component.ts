import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LanguageService } from '../../../core/services/language.service';
import { HeroCardsComponent } from './hero-cards.component';
import { ResearcherProfileComponent } from './researcher-profile.component';

/** A piece of text in both languages. */
interface Txt {
  id: string;
  en: string;
}

interface Item {
  title: Txt;
  desc: Txt;
}

interface IconItem extends Item {
  icon: string;
}

interface ResearchQuestion {
  code: string;
  question: Txt;
  method: Txt;
}

interface MethodStep {
  icon: string;
  title: Txt;
  desc: Txt;
  tags: string[];
}

interface PageLink {
  path: string;
  icon: string;
  title: Txt;
  desc: Txt;
}

/**
 * Research overview: background, objectives, questions, method and expected
 * outcomes. Deliberately qualitative — every quantitative result lives on the
 * Balancing Results / Visual Analytics pages, which read results/*.json.
 */
@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, RouterModule, HeroCardsComponent, ResearcherProfileComponent],
  template: `
    <div class="o-page">

      <!-- Hero -->
      <section class="o-hero">
        <div class="o-stars" aria-hidden="true"></div>
        <div class="o-hero-body">
          <span class="o-eyebrow">{{ t('Draf Proposal Penelitian', 'Research Proposal Draft') }}</span>
          <h2 class="o-title">{{ t('Balancing Otomatis', 'Automated Balancing of') }} <span>{{ t('Trading Card Game Asimetris', 'an Asymmetric Trading Card Game') }}</span></h2>
          <p class="o-lead">{{ t(
            'Studi kasus: Mahabharata TCG — tiga faksi dengan gaya main berbeda. Kami meneliti bagaimana menyeimbangkan parameter kartu secara otomatis memakai simulasi, optimasi, dan agen AI, dengan standar statistik yang ketat, sambil tetap setia pada cerita (lore) Mahabharata.',
            'Case study: Mahabharata TCG — three factions with different play styles. We study how to balance card parameters automatically using simulation, optimization and AI agents, with strict statistical standards, while staying faithful to the Mahabharata story (lore).') }}</p>
          <p class="o-story">
            <span>📜</span>
            {{ t('Terinspirasi epos Mahabharata: perang besar di Kurukshetra antara Pandawa dan Kurawa, dihidupkan kembali sebagai permainan kartu tiga faksi.',
                 'Inspired by the Mahabharata epic: the great war at Kurukshetra between the Pandawa and the Kurawa, retold as a three-faction card game.') }}
          </p>
          <div class="o-cta">
            <a routerLink="/balancer" class="o-btn o-btn-gold">🔬 {{ t('Lihat Hasil Riset', 'See the Results') }}</a>
            <a routerLink="/simulator/tcg" class="o-btn o-btn-ghost">⚔️ {{ t('Coba Mainkan', 'Try the Game') }}</a>
          </div>
        </div>
        <app-hero-cards class="o-hero-cards"></app-hero-cards>
      </section>

      <!-- 1. Background -->
      <section class="o-section">
        <header class="o-head">
          <span class="o-kicker">01 · {{ t('Latar Belakang', 'Background') }}</span>
          <h3>{{ t('Mengapa penelitian ini perlu?', 'Why is this research needed?') }}</h3>
        </header>
        <div class="o-grid o-grid-2">
          <article class="o-card" *ngFor="let b of background">
            <span class="o-card-icon">{{ b.icon }}</span>
            <div>
              <strong>{{ tx(b.title) }}</strong>
              <p>{{ tx(b.desc) }}</p>
            </div>
          </article>
        </div>
        <div class="o-testbed">
          <h4>{{ t('Objek penelitian: Mahabharata TCG', 'Test bed: Mahabharata TCG') }}</h4>
          <p>{{ t(
            'Tiga faksi dinamai dari tiga guna (sattva, rajas, tamas). Setiap faksi punya dua karakter dan mekanik khas. Total 25 parameter numerik (HP, damage, biaya prana, nilai efek) menjadi ruang pencarian balancing.',
            'The three factions are named after the three guṇa (sattva, rajas, tamas). Each faction has two characters and a signature mechanic. In total, 25 numerical parameters (HP, damage, prana cost, effect values) form the balancing search space.') }}</p>
          <div class="o-factions">
            <div class="o-faction f-satwika"><strong>Satwika</strong><span>Pandawa · Yudhistira, Arjuna</span><em>{{ t('Damage reduction, bonus dari Bench', 'Damage reduction, Bench bonus') }}</em></div>
            <div class="o-faction f-rajasika"><strong>Rajasika</strong><span>Balarama, Karna</span><em>{{ t('Serangan besar dengan recoil', 'Heavy attacks with recoil') }}</em></div>
            <div class="o-faction f-tamasika"><strong>Tamasika</strong><span>Kurawa · Sengkuni, Duryodana</span><em>{{ t('Mill deck lawan, bonus dari discard', 'Mill the opponent deck, discard bonus') }}</em></div>
          </div>
        </div>
      </section>

      <!-- 2. Objectives -->
      <section class="o-section">
        <header class="o-head">
          <span class="o-kicker">02 · {{ t('Tujuan Penelitian', 'Research Objectives') }}</span>
          <h3>{{ t('Apa yang ingin kami capai?', 'What do we want to achieve?') }}</h3>
        </header>
        <ol class="o-objectives">
          <li *ngFor="let o of objectives; let i = index">
            <span class="o-num">{{ i + 1 }}</span>
            <div>
              <strong>{{ tx(o.title) }}</strong>
              <p>{{ tx(o.desc) }}</p>
            </div>
          </li>
        </ol>
      </section>

      <!-- 3. Research questions -->
      <section class="o-section">
        <header class="o-head">
          <span class="o-kicker">03 · {{ t('Pertanyaan Riset', 'Research Questions') }}</span>
          <h3>{{ t('Pertanyaan yang ingin dijawab', 'Questions we set out to answer') }}</h3>
        </header>
        <div class="o-rq-list">
          <div class="o-rq" *ngFor="let q of questions">
            <span class="o-rq-code">{{ q.code }}</span>
            <div>
              <strong>{{ tx(q.question) }}</strong>
              <p><span class="o-rq-label">{{ t('Cara menjawab', 'How') }}:</span> {{ tx(q.method) }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. Method -->
      <section class="o-section">
        <header class="o-head">
          <span class="o-kicker">04 · {{ t('Metode', 'Methodology') }}</span>
          <h3>{{ t('Apa yang kami lakukan?', 'What do we do?') }}</h3>
          <p>{{ t('Pipeline riset ditulis dalam Python; setiap tahap menghasilkan file hasil yang bisa diulang.', 'The research pipeline is written in Python; every stage produces a reproducible result file.') }}</p>
        </header>
        <ol class="o-steps">
          <li *ngFor="let s of steps; let i = index" [style.animation-delay.ms]="i * 80">
            <div class="o-step-node"><span>{{ s.icon }}</span></div>
            <div class="o-step-body">
              <span class="o-step-num">{{ t('Tahap', 'Step') }} {{ i + 1 }}</span>
              <strong>{{ tx(s.title) }}</strong>
              <p>{{ tx(s.desc) }}</p>
              <div class="o-tags"><span *ngFor="let tag of s.tags">{{ tag }}</span></div>
            </div>
          </li>
        </ol>
      </section>

      <!-- 5. Expected outcomes -->
      <section class="o-section">
        <header class="o-head">
          <span class="o-kicker">05 · {{ t('Target Capaian', 'Expected Outcomes') }}</span>
          <h3>{{ t('Kontribusi yang diharapkan', 'Intended contributions') }}</h3>
        </header>
        <div class="o-grid o-grid-2">
          <article class="o-card" *ngFor="let c of contributions">
            <span class="o-card-icon">{{ c.icon }}</span>
            <div>
              <strong>{{ tx(c.title) }}</strong>
              <p>{{ tx(c.desc) }}</p>
            </div>
          </article>
        </div>
      </section>

      <!-- 6. Findings so far -->
      <section class="o-section">
        <header class="o-head">
          <span class="o-kicker">06 · {{ t('Temuan Sementara', 'Findings So Far') }}</span>
          <h3>{{ t('Apa yang sudah kami pelajari', 'What we have learned so far') }}</h3>
          <p>{{ t(
            'Ringkasan kualitatif. Angka lengkap beserta n dan 95% CI ada di halaman Hasil Riset Balancing dan Visual Analytics, dibaca langsung dari results/*.json.',
            'A qualitative summary. Full numbers with n and 95% CI are on the Balancing Results and Visual Analytics pages, read directly from results/*.json.') }}</p>
        </header>
        <ul class="o-findings">
          <li *ngFor="let f of findings">
            <span class="o-finding-icon">{{ f.icon }}</span>
            <div>
              <strong>{{ tx(f.title) }}</strong>
              <p>{{ tx(f.desc) }}</p>
            </div>
          </li>
        </ul>
      </section>

      <!-- 7. Principles -->
      <section class="o-principles">
        <h4>⚖️ {{ t('Prinsip riset', 'Research principles') }}</h4>
        <ul>
          <li *ngFor="let p of principles">{{ tx(p) }}</li>
        </ul>
      </section>

      <!-- 8. Dashboard map -->
      <section class="o-section">
        <header class="o-head">
          <span class="o-kicker">07 · {{ t('Peta Dashboard', 'Dashboard Map') }}</span>
          <h3>{{ t('Cara membaca aplikasi ini', 'How to read this application') }}</h3>
        </header>
        <div class="o-grid o-grid-3">
          <a class="o-link" *ngFor="let l of pages" [routerLink]="l.path">
            <span class="o-card-icon">{{ l.icon }}</span>
            <div>
              <strong>{{ tx(l.title) }}</strong>
              <p>{{ tx(l.desc) }}</p>
            </div>
          </a>
        </div>
        <p class="o-footnote">{{ t(
          'Catatan: simulasi interaktif di dashboard ini memakai port TypeScript dari engine riset dan hanya untuk demonstrasi. Angka yang dikutip di paper selalu berasal dari pipeline Python (results/ dan CLAIMS_LEDGER.md).',
          'Note: the interactive simulations in this dashboard use a TypeScript port of the research engine and are for demonstration only. Numbers cited in the paper always come from the Python pipeline (results/ and CLAIMS_LEDGER.md).') }}</p>
      </section>

      <!-- 9. About the researcher -->
      <section class="o-section">
        <header class="o-head">
          <span class="o-kicker">08 · {{ t('Tentang Peneliti', 'About the Researcher') }}</span>
          <h3>{{ t('Siapa di balik penelitian ini?', 'Who is behind this research?') }}</h3>
        </header>
        <app-researcher-profile></app-researcher-profile>
      </section>

    </div>
  `,
  styles: [`
    :host { display: block; --gold: #e8b54a; --gold-soft: #f6dc9a; --gold-deep: #b07d1a; --night: #0d0b1f; --ink: #1b1535; --line: #ece6d6; }
    .o-page { display: flex; flex-direction: column; gap: 44px; padding-bottom: 40px; }
    p { margin: 0; }

    /* Hero */
    .o-hero { position: relative; overflow: hidden; border-radius: 20px; padding: 44px 40px 40px 48px;
      display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 24px;
      background: radial-gradient(ellipse at 80% 20%, #5b2a86 0%, transparent 55%), radial-gradient(ellipse at 10% 90%, #7a1f2b 0%, transparent 50%), linear-gradient(135deg, var(--night), var(--ink));
      box-shadow: 0 24px 60px -20px rgba(27, 21, 53, .55); }
    .o-stars { position: absolute; inset: 0; opacity: .7;
      background-image: radial-gradient(1px 1px at 12% 22%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 32% 68%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 58% 14%, var(--gold-soft) 50%, transparent 51%), radial-gradient(1px 1px at 74% 58%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 90% 30%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 46% 88%, #fff 50%, transparent 51%); }
    .o-hero-body { position: relative; max-width: 640px; animation: o-rise .7s ease-out both; }
    .o-hero-cards { position: relative; }
    .o-story { display: flex; gap: 10px; align-items: flex-start; margin-top: 16px !important; padding: 12px 16px; border-radius: 12px;
      font-size: 13.5px; line-height: 1.6; font-style: italic; color: var(--gold-soft);
      background: rgba(232, 181, 74, .08); border-left: 3px solid var(--gold); }
    .o-story span { font-style: normal; }
    .o-eyebrow, .o-kicker { font-size: 11px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; color: var(--gold); }
    .o-title { font-family: 'Cinzel', serif; font-size: clamp(28px, 4.2vw, 46px); line-height: 1.12; margin: 10px 0 16px; color: #fff; }
    .o-title span { display: block; background: linear-gradient(90deg, var(--gold), var(--gold-soft)); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .o-lead { color: rgba(255, 255, 255, .8); font-size: 15px; line-height: 1.75; }
    .o-cta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 26px; }
    .o-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px; border-radius: 999px; font-size: 14px; font-weight: 700; text-decoration: none; transition: transform .2s, background .2s; }
    .o-btn:hover { transform: translateY(-2px); }
    .o-btn-gold { background: linear-gradient(135deg, var(--gold), #c98a1c); color: var(--night); box-shadow: 0 8px 24px -8px rgba(232, 181, 74, .8); }
    .o-btn-ghost { color: #fff; border: 1px solid rgba(255, 255, 255, .3); background: rgba(255, 255, 255, .06); }
    .o-btn-ghost:hover { background: rgba(255, 255, 255, .14); }

    /* Section heads */
    .o-head { max-width: 760px; margin: 0 0 20px; }
    .o-head .o-kicker { color: var(--gold-deep); }
    .o-head h3 { font-family: 'Cinzel', serif; font-size: 26px; margin: 6px 0 8px; color: var(--ink); }
    .o-head p { font-size: 14px; line-height: 1.6; }

    /* Cards */
    .o-grid { display: grid; gap: 16px; }
    .o-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .o-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .o-card, .o-link { display: flex; gap: 14px; padding: 18px 20px; border-radius: 14px; border: 1px solid var(--line); background: linear-gradient(180deg, #fffdf7, #fff); }
    .o-link { text-decoration: none; color: inherit; transition: border-color .2s, transform .2s, box-shadow .2s; }
    .o-link:hover { border-color: var(--gold); transform: translateY(-2px); box-shadow: 0 10px 24px -16px rgba(176, 125, 26, .6); }
    .o-card-icon { flex: none; font-size: 24px; line-height: 1.2; }
    .o-card strong, .o-link strong { display: block; font-size: 15px; color: var(--ink); margin-bottom: 4px; }
    .o-card p, .o-link p { font-size: 13.5px; line-height: 1.65; }

    /* Test bed */
    .o-testbed { margin-top: 16px; padding: 20px 22px; border-radius: 16px; background: #fffaf0; border-left: 3px solid var(--gold); }
    .o-testbed h4 { margin: 0 0 6px; font-family: 'Cinzel', serif; font-size: 17px; color: var(--ink); }
    .o-testbed > p { font-size: 13.5px; line-height: 1.65; }
    .o-factions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
    .o-faction { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border-radius: 12px; color: #fff; }
    .o-faction strong { font-family: 'Cinzel', serif; font-size: 17px; }
    .o-faction span { font-size: 12px; opacity: .85; }
    .o-faction em { font-size: 12px; font-style: italic; opacity: .9; margin-top: 4px; }
    .f-satwika { background: linear-gradient(160deg, #2b4c9a, #1a2a5e); }
    .f-rajasika { background: linear-gradient(160deg, #d0512a, #7c1d1d); }
    .f-tamasika { background: linear-gradient(160deg, #3d2360, #140c24); }

    /* Objectives */
    .o-objectives { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
    .o-objectives li { display: flex; gap: 16px; align-items: flex-start; padding: 16px 20px; border-radius: 14px; background: #fff; border: 1px solid var(--line); }
    .o-num { flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font: 800 14px 'Inter', sans-serif;
      color: var(--gold-soft); background: radial-gradient(circle at 30% 30%, #2d2356, var(--night)); border: 2px solid var(--gold); }
    .o-objectives strong { display: block; font-size: 15px; color: var(--ink); margin: 4px 0; }
    .o-objectives p { font-size: 13.5px; line-height: 1.65; }

    /* Research questions */
    .o-rq-list { display: grid; gap: 12px; }
    .o-rq { display: flex; gap: 16px; align-items: flex-start; padding: 16px 20px; border-radius: 14px; background: linear-gradient(90deg, #f6f3ff, #fff); border: 1px solid #e4dcf5; }
    .o-rq-code { flex: none; padding: 4px 10px; border-radius: 8px; font: 800 13px 'Inter', sans-serif; color: #fff; background: #5b2a86; }
    .o-rq strong { display: block; font-size: 15px; color: var(--ink); margin-bottom: 6px; line-height: 1.45; }
    .o-rq p { font-size: 13px; line-height: 1.6; }
    .o-rq-label { font-weight: 700; color: #5b2a86; }

    /* Steps */
    .o-steps { list-style: none; margin: 0; padding: 0; position: relative; max-width: 900px; }
    .o-steps::before { content: ''; position: absolute; left: 27px; top: 28px; bottom: 40px; width: 2px; background: linear-gradient(var(--gold), #5b2a86); opacity: .5; }
    .o-steps li { display: flex; gap: 20px; padding-bottom: 16px; animation: o-rise .6s ease-out both; }
    .o-step-node { flex: none; width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; font-size: 22px; position: relative; z-index: 1;
      background: radial-gradient(circle at 30% 30%, #2d2356, var(--night)); border: 2px solid var(--gold); box-shadow: 0 0 0 5px rgba(232, 181, 74, .12); }
    .o-step-body { flex: 1; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 16px 20px; }
    .o-step-num { display: block; font-size: 10px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: var(--gold-deep); }
    .o-step-body strong { display: block; font-size: 16px; color: var(--ink); margin: 2px 0 6px; }
    .o-step-body p { font-size: 13.5px; line-height: 1.65; }
    .o-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .o-tags span { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; background: #f3efe4; color: #7a4f0c; }

    /* Findings */
    .o-findings { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .o-findings li { display: flex; gap: 12px; padding: 16px 18px; border-radius: 14px; background: #fff; border: 1px solid var(--line); }
    .o-finding-icon { flex: none; font-size: 20px; }
    .o-findings strong { display: block; font-size: 14.5px; color: var(--ink); margin-bottom: 4px; }
    .o-findings p { font-size: 13px; line-height: 1.6; }

    /* Principles */
    .o-principles { padding: 22px 26px; border-radius: 16px; color: #fff; background: linear-gradient(135deg, var(--night), var(--ink)); }
    .o-principles h4 { margin: 0 0 10px; font-family: 'Cinzel', serif; font-size: 18px; color: var(--gold-soft); }
    .o-principles ul { margin: 0; padding-left: 20px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 28px; }
    .o-principles li { font-size: 13.5px; line-height: 1.6; color: rgba(255, 255, 255, .85); }

    .o-footnote { margin-top: 16px; font-size: 12.5px; line-height: 1.6; color: var(--text-muted, #64748b); }

    @keyframes o-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

    @media (max-width: 1100px) {
      .o-hero { grid-template-columns: minmax(0, 1fr); justify-items: center; }
      .o-hero-body { max-width: none; justify-self: stretch; }
    }
    @media (max-width: 1000px) {
      .o-grid-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 760px) {
      .o-grid-2, .o-grid-3, .o-factions, .o-findings, .o-principles ul { grid-template-columns: minmax(0, 1fr); }
      .o-hero { padding: 36px 22px; }
      .o-rq, .o-objectives li { padding: 14px 16px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .o-hero-body, .o-steps li { animation: none; }
    }
  `]
})
export class OverviewComponent {
  private readonly i18n = inject(LanguageService);
  readonly t = this.i18n.t;

  tx(text: Txt): string {
    return this.i18n.t(text.id, text.en);
  }

  readonly background: IconItem[] = [
    {
      icon: '⚖️',
      title: { id: 'Balancing game asimetris itu sulit', en: 'Balancing asymmetric games is hard' },
      desc: {
        id: 'Jika setiap faksi punya mekanik berbeda, perubahan kecil pada satu angka (mis. HP satu karakter) bisa menggeser peluang menang semua matchup. Parameternya saling berinteraksi, sehingga sulit disetel satu per satu.',
        en: 'When every faction has different mechanics, a small change to one number (e.g. one character\'s HP) can shift the win odds of every matchup. Parameters interact, so they are hard to tune one at a time.',
      },
    },
    {
      icon: '🧪',
      title: { id: 'Playtest manual lambat dan subjektif', en: 'Manual playtesting is slow and subjective' },
      desc: {
        id: 'Desainer biasanya menyeimbangkan game lewat uji coba berulang oleh manusia. Cara ini mahal, lambat, dan hasilnya sulit diukur secara objektif.',
        en: 'Designers usually balance games through repeated human playtests. This is costly and slow, and the outcome is hard to measure objectively.',
      },
    },
    {
      icon: '📉',
      title: { id: 'Klaim "seimbang" sering tanpa bukti statistik', en: '"Balanced" claims often lack statistical evidence' },
      desc: {
        id: 'Balancing otomatis berbasis simulasi sudah ada, tetapi hasilnya sering dilaporkan sebagai satu angka win rate — tanpa rentang ketidakpastian, tanpa pembanding (baseline), dan hanya diuji dengan satu gaya bermain.',
        en: 'Simulation-based automated balancing exists, but results are often reported as a single win-rate number — with no uncertainty interval, no baseline comparison, and tested under only one play style.',
      },
    },
    {
      icon: '📜',
      title: { id: 'Game bertema budaya harus setia pada cerita', en: 'Culture-themed games must stay true to the story' },
      desc: {
        id: 'Game yang seimbang tetapi mengkhianati cerita kehilangan identitasnya — misalnya jika panah Pasupati milik Arjuna menjadi serangan lemah. Balancing perlu memperhitungkan kendala naratif (lore), dan "harga" kendala itu belum banyak diukur.',
        en: 'A balanced game that betrays its story loses its identity — for example, if Arjuna\'s Pasupati arrow became a weak attack. Balancing must respect narrative (lore) constraints, and the "price" of those constraints is rarely measured.',
      },
    },
  ];

  readonly objectives: Item[] = [
    {
      title: { id: 'Mengukur balance secara ketat dan dapat diulang', en: 'Measure balance rigorously and reproducibly' },
      desc: {
        id: 'Membangun simulator Python dengan aturan formal dan seed tetap, lalu mengukur balance memakai matriks menang-kalah 3×3 lengkap dengan 95% CI (Wilson).',
        en: 'Build a Python simulator with formal rules and fixed seeds, then measure balance with a full 3×3 win-rate (payoff) matrix and 95% Wilson confidence intervals.',
      },
    },
    {
      title: { id: 'Menemukan parameter seimbang secara otomatis', en: 'Find balanced parameters automatically' },
      desc: {
        id: 'Membandingkan beberapa algoritma optimasi secara adil (anggaran evaluasi sama, banyak seed) terhadap baseline random search, termasuk optimasi multi-objektif.',
        en: 'Compare several optimization algorithms fairly (same evaluation budget, many seeds) against a random-search baseline, including multi-objective optimization.',
      },
    },
    {
      title: { id: 'Menguji seberapa kuat hasil "seimbang"', en: 'Test how robust "balanced" really is' },
      desc: {
        id: 'Memeriksa apakah balance tetap berlaku jika pemain memakai strategi lain (agen AI), jika parameter sedikit digeser, dan parameter mana yang paling berpengaruh.',
        en: 'Check whether balance still holds when players use other strategies (AI agents), when parameters are nudged slightly, and which parameters matter most.',
      },
    },
    {
      title: { id: 'Memasukkan kendala cerita (lore)', en: 'Incorporate story (lore) constraints' },
      desc: {
        id: 'Menerjemahkan narasi Mahabharata menjadi kendala matematis pada parameter, lalu mengukur berapa "biaya" kesetiaan cerita terhadap balance.',
        en: 'Translate the Mahabharata narrative into mathematical constraints on the parameters, then measure what story fidelity "costs" in balance.',
      },
    },
    {
      title: { id: 'Mengurangi biaya komputasi', en: 'Reduce computational cost' },
      desc: {
        id: 'Menguji apakah model pengganti (surrogate) dapat menggantikan sebagian simulasi yang mahal, dengan menghitung biaya secara jujur, termasuk biaya persiapan.',
        en: 'Test whether surrogate models can replace part of the expensive simulation, accounting for cost honestly, including set-up cost.',
      },
    },
  ];

  readonly questions: ResearchQuestion[] = [
    {
      code: 'RQ1',
      question: {
        id: 'Dapatkah simulasi dan optimasi menemukan parameter kartu yang seimbang secara statistik, baik rata-rata per faksi maupun per pasangan matchup?',
        en: 'Can simulation and optimization find card parameters that are statistically balanced, both on average per faction and for every pairwise matchup?',
      },
      method: {
        id: 'Matriks menang-kalah 3×3 dengan 95% CI; GA, PSO, hybrid, CMA-ES, Bayesian Optimization vs random search; NSGA-II.',
        en: '3×3 payoff matrix with 95% CI; GA, PSO, hybrid, CMA-ES, Bayesian Optimization vs random search; NSGA-II.',
      },
    },
    {
      code: 'RQ2',
      question: {
        id: 'Seberapa kuat hasil balance tersebut terhadap strategi pemain, noise, dan perubahan parameter — dan parameter mana yang paling menentukan?',
        en: 'How robust is that balance to player strategy, noise and parameter changes — and which parameters matter most?',
      },
      method: {
        id: '9 kebijakan agen (acak, greedy, scripted, Q-learning, MCTS); analisis sensitivitas global Sobol & Morris; uji basin of attraction dan multi-start.',
        en: '9 agent policies (random, greedy, scripted, Q-learning, MCTS); Sobol & Morris global sensitivity analysis; basin-of-attraction and multi-start tests.',
      },
    },
    {
      code: 'RQ3',
      question: {
        id: 'Apakah titik seimbang masih ada ketika ruang parameter dibatasi kendala cerita (lore), dan berapa "harga" kendala tersebut?',
        en: 'Does a balanced equilibrium still exist when the parameter space is restricted by story (lore) constraints, and what is the "price" of those constraints?',
      },
      method: {
        id: '18 kendala dari teks Mahabharata; NSGA-II dengan constraint-domination dibandingkan berpasangan dengan versi tanpa kendala.',
        en: '18 constraints drawn from the Mahabharata text; constraint-domination NSGA-II compared pairwise with the unconstrained version.',
      },
    },
    {
      code: 'RQ4',
      question: {
        id: 'Dapatkah model surrogate mempercepat balancing tanpa mengorbankan keandalan hasil?',
        en: 'Can surrogate models speed up balancing without sacrificing the reliability of the result?',
      },
      method: {
        id: 'Ensemble MLP dibandingkan dengan baseline konstan, regresi linear, dan gradient boosting; uji kalibrasi; perhitungan biaya per tahap dan titik impas.',
        en: 'MLP ensemble compared with constant, linear-regression and gradient-boosting baselines; calibration check; per-phase cost accounting and break-even point.',
      },
    },
  ];

  readonly steps: MethodStep[] = [
    {
      icon: '📐',
      title: { id: 'Formalisasi aturan & simulator', en: 'Formal rules & simulator' },
      desc: {
        id: 'Aturan permainan ditulis sebagai spesifikasi formal dan diimplementasikan sebagai simulator Python yang deterministik (seed tercatat), sehingga setiap pertandingan bisa diulang persis.',
        en: 'The game rules are written as a formal specification and implemented as a deterministic Python simulator (seeds recorded), so every match can be replayed.',
      },
      tags: ['Python', 'rules_spec.md', 'seed'],
    },
    {
      icon: '📊',
      title: { id: 'Mengukur balance', en: 'Measure balance' },
      desc: {
        id: 'Setiap konfigurasi diuji dengan 20.000 pertandingan per matchup — jumlah yang ditentukan lewat analisis power statistik — dan dilaporkan sebagai win rate dengan 95% CI (Wilson).',
        en: 'Each configuration is tested with 20,000 games per matchup — a size set by statistical power analysis — and reported as a win rate with a 95% Wilson CI.',
      },
      tags: ['Payoff matrix 3×3', 'Wilson CI', 'Nash averaging'],
    },
    {
      icon: '🧬',
      title: { id: 'Optimasi parameter', en: 'Optimize parameters' },
      desc: {
        id: 'Algoritma optimasi mencari 25 parameter yang meminimalkan ketidakseimbangan. Semua metode diberi anggaran evaluasi yang sama dan diulang dengan banyak seed. NSGA-II menyeimbangkan tiga tujuan sekaligus: balance, power creep, dan identitas faksi.',
        en: 'Optimizers search the 25 parameters to minimize imbalance. Every method gets the same evaluation budget and is repeated over many seeds. NSGA-II trades off three goals at once: balance, power creep and faction identity.',
      },
      tags: ['GA', 'PSO', 'CMA-ES', 'Bayesian Opt.', 'NSGA-II', 'Random search (baseline)'],
    },
    {
      icon: '🤖',
      title: { id: 'Uji ketahanan', en: 'Stress-test the result' },
      desc: {
        id: 'Parameter hasil optimasi dimainkan oleh berbagai agen AI, diuji dengan gangguan acak, dan dianalisis sensitivitasnya untuk melihat apakah "seimbang" hanya kebetulan.',
        en: 'The optimized parameters are played by different AI agents, perturbed randomly, and analysed for sensitivity, to see whether "balanced" is just luck.',
      },
      tags: ['Random', 'Greedy', 'Q-learning', 'MCTS', 'Sobol', 'Morris'],
    },
    {
      icon: '📜',
      title: { id: 'Kendala cerita (lore)', en: 'Story (lore) constraints' },
      desc: {
        id: 'Hubungan antar-karakter dalam Mahabharata (mis. Pasupati Arjuna termasuk serangan terkuat, Karna lebih rapuh dari Yudhistira) diubah menjadi kendala. Optimasi diulang di dalam ruang yang setia cerita dan dibandingkan dengan versi bebas.',
        en: 'Relationships between characters in the Mahabharata (e.g. Arjuna\'s Pasupati is among the strongest attacks, Karna is more fragile than Yudhistira) become constraints. Optimization is repeated inside the story-faithful space and compared with the free version.',
      },
      tags: ['18 constraints', 'Constraint-domination', 'Hypervolume'],
    },
    {
      icon: '⚡',
      title: { id: 'Model surrogate & biaya', en: 'Surrogate models & cost' },
      desc: {
        id: 'Model machine learning dilatih untuk memprediksi win rate tanpa simulasi penuh. Model wajib mengalahkan baseline sederhana, diuji di dalam dan di luar distribusi data latih, dan biayanya dihitung per tahap.',
        en: 'Machine-learning models are trained to predict win rates without a full simulation. A model must beat simple baselines, is tested in and out of the training distribution, and its cost is accounted per phase.',
      },
      tags: ['MLP ensemble', 'Gradient boosting', 'Calibration', 'Break-even'],
    },
  ];

  readonly contributions: IconItem[] = [
    {
      icon: '🧭',
      title: { id: 'Metodologi balancing yang dapat dipertanggungjawabkan', en: 'An accountable balancing methodology' },
      desc: {
        id: 'Standar pelaporan: setiap klaim seimbang menyebut n, 95% CI, kebijakan pemain yang dipakai, dan pembanding baseline.',
        en: 'A reporting standard: every balance claim states n, 95% CI, the player policy it was measured under, and a baseline comparison.',
      },
    },
    {
      icon: '📜',
      title: { id: 'Ukuran "biaya kesetiaan cerita"', en: 'A measure of the "cost of lore fidelity"' },
      desc: {
        id: 'Cara mengubah narasi menjadi kendala optimasi dan mengukur dampaknya terhadap balance — dapat dipakai untuk game bertema budaya lain.',
        en: 'A way to turn narrative into optimization constraints and measure their effect on balance — applicable to other culture-themed games.',
      },
    },
    {
      icon: '🔁',
      title: { id: 'Artefak riset yang dapat direproduksi', en: 'A reproducible research artifact' },
      desc: {
        id: 'Satu eksperimen = satu script + satu config + satu file hasil. Setiap angka di paper bisa dilacak ke file sumbernya (CLAIMS_LEDGER.md).',
        en: 'One experiment = one script + one config + one result file. Every number in the paper can be traced to its source file (CLAIMS_LEDGER.md).',
      },
    },
    {
      icon: '🖥️',
      title: { id: 'Dashboard interaktif untuk desainer', en: 'An interactive dashboard for designers' },
      desc: {
        id: 'Aplikasi ini: menampilkan hasil riset, memungkinkan mengubah parameter dan langsung mengujinya, serta memainkan game-nya.',
        en: 'This application: it shows the research results, lets you change parameters and test them immediately, and lets you play the game.',
      },
    },
  ];

  readonly findings: IconItem[] = [
    {
      icon: '✅',
      title: { id: 'Optimasi berhasil menyeimbangkan matchup', en: 'Optimization balanced the matchups' },
      desc: {
        id: 'Parameter hasil GA membawa kesembilan sel matriks menang-kalah mendekati 50%, dari kondisi awal yang sangat timpang.',
        en: 'The GA-tuned parameters bring all nine payoff-matrix cells close to 50%, starting from a badly imbalanced hand-made configuration.',
      },
    },
    {
      icon: '⚠️',
      title: { id: '"Seimbang" bergantung pada strategi pemain', en: '"Balanced" depends on the player strategy' },
      desc: {
        id: 'Balance itu diukur dengan pemilihan serangan otomatis engine. Saat dimainkan agen lain, beberapa matchup kembali timpang — klaim balance harus menyebut kebijakan pemainnya.',
        en: 'That balance was measured with the engine\'s automatic attack choice. Played by other agents, some matchups become lopsided again — a balance claim must name its player policy.',
      },
    },
    {
      icon: '🧬',
      title: { id: 'Hybrid GA+PSO tidak lebih baik dari GA saja', en: 'Hybrid GA+PSO is not better than GA alone' },
      desc: {
        id: 'Pada anggaran yang sama perbedaannya tidak signifikan secara statistik, sehingga klaim "hybrid" kami tarik. Hasil negatif ini tetap dilaporkan.',
        en: 'With the same budget the difference is not statistically significant, so we withdrew the "hybrid" claim. This negative result is still reported.',
      },
    },
    {
      icon: '🗺️',
      title: { id: 'Titik seimbang sempit dan tidak tunggal', en: 'The balanced point is narrow and not unique' },
      desc: {
        id: 'Gangguan kecil pada parameter sudah merusak balance, dan pencarian ulang dari titik awal berbeda menemukan banyak solusi seimbang yang berlainan.',
        en: 'Small parameter perturbations already break the balance, and restarting the search from different points finds many distinct balanced solutions.',
      },
    },
    {
      icon: '📜',
      title: { id: 'Kendala cerita tidak terbukti merugikan balance', en: 'Lore constraints showed no measurable balance cost' },
      desc: {
        id: 'Dalam pengaturan ini, pencarian dengan kendala lore menemukan solusi yang tidak kalah seimbang dibanding tanpa kendala, meski pilihan trade-off-nya lebih sempit.',
        en: 'In this setting, the lore-constrained search found a solution no less balanced than the unconstrained one, although its range of trade-offs is narrower.',
      },
    },
    {
      icon: '🧠',
      title: { id: 'Surrogate membantu, tetapi bukan yang terbaik', en: 'The surrogate helps, but is not the best model' },
      desc: {
        id: 'Ensemble MLP mengalahkan prediktor konstan, namun kalah dari gradient boosting dan ketidakpastiannya belum terkalibrasi baik.',
        en: 'The MLP ensemble beats a constant predictor, but loses to gradient boosting and its uncertainty is poorly calibrated.',
      },
    },
  ];

  readonly principles: Txt[] = [
    { id: 'Tidak ada data yang dibuat-buat; setiap angka berasal dari script dan file hasil.', en: 'No fabricated data; every number comes from a script and a result file.' },
    { id: 'Minimal 10 seed untuk hasil acak, dilaporkan sebagai rata-rata ± 95% CI.', en: 'At least 10 seeds for stochastic results, reported as mean ± 95% CI.' },
    { id: 'Setiap klaim dibandingkan dengan baseline (random search, agen acak/greedy, prediktor konstan).', en: 'Every claim is compared with a baseline (random search, random/greedy agents, constant predictor).' },
    { id: 'Klaim "A lebih baik dari B" butuh uji signifikansi dan effect size.', en: '"A is better than B" requires a significance test and an effect size.' },
    { id: 'Hasil negatif dilaporkan apa adanya, tidak disembunyikan.', en: 'Negative results are reported as they are, not hidden.' },
    { id: 'Kode, config, dan seed dicatat agar semua eksperimen bisa diulang.', en: 'Code, configs and seeds are recorded so every experiment can be repeated.' },
  ];

  readonly pages: PageLink[] = [
    { path: '/guide', icon: '🕹️', title: { id: 'Panduan Bermain', en: 'How to Play' }, desc: { id: 'Aturan dasar, tiga faksi, dan istilah dalam game.', en: 'Basic rules, the three factions, and game terms.' } },
    { path: '/simulator', icon: '🎮', title: { id: 'Game Simulator', en: 'Game Simulator' }, desc: { id: 'Tonton pertandingan langkah demi langkah dengan engine riset, atau mainkan Mode TCG melawan bot.', en: 'Watch a match step by step with the research engine, or play TCG Mode against a bot.' } },
    { path: '/balancer', icon: '🔬', title: { id: 'Hasil Riset Balancing', en: 'Balancing Results' }, desc: { id: 'Hasil utama: sebelum vs sesudah balancing, perbandingan optimizer, NSGA-II, dan kendala lore.', en: 'Main results: before vs after balancing, optimizer comparison, NSGA-II, and lore constraints.' } },
    { path: '/tuning', icon: '🎛️', title: { id: 'Parameter Sliders', en: 'Parameter Sliders' }, desc: { id: 'Ubah 25 parameter dan uji langsung dengan ribuan pertandingan.', en: 'Change the 25 parameters and test them right away with thousands of games.' } },
    { path: '/analytics', icon: '📊', title: { id: 'Visual Analytics', en: 'Visual Analytics' }, desc: { id: 'Grafik sensitivitas, konvergensi optimizer, dan biaya surrogate.', en: 'Charts of sensitivity, optimizer convergence, and surrogate cost.' } },
    { path: '/flow', icon: '⚙️', title: { id: 'Flow & Schema', en: 'Flow & Schema' }, desc: { id: 'Diagram alur giliran, loop optimasi, pipeline ML, dan arsitektur kode.', en: 'Diagrams of the turn flow, optimization loop, ML pipeline, and code architecture.' } },
  ];
}
