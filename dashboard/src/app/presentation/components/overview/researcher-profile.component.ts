import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../../core/services/language.service';

/** A piece of text in both languages. */
interface Txt {
  id: string;
  en: string;
}

interface Role {
  title: Txt;
  org: string;
  /** Employment type, e.g. full-time / part-time; omitted when not stated. */
  type?: Txt;
  period: Txt;
  place?: Txt;
  /** Roles still held are highlighted on the timeline. */
  current: boolean;
}

interface Degree {
  degree: Txt;
  school: string;
  period: string;
}

interface Contact {
  icon: string;
  label: Txt;
  value: string;
  href: string;
}

/** Profile as listed on the author's LinkedIn page (exported 8 Oct 2026). */
const NAME = 'Md Wira Putra Dananjaya';
const INITIALS = 'PD';

const HEADLINE: Txt = {
  id: 'Dosen · Universitas Pendidikan Nasional (Undiknas)',
  en: 'Lecturer · Universitas Pendidikan Nasional (Undiknas)',
};

const LOCATION: Txt = { id: 'Denpasar, Bali, Indonesia', en: 'Denpasar, Bali, Indonesia' };

const ABOUT: Txt = {
  id: 'Teknologi informasi berbasis pengetahuan yang dipadukan dengan seni dan budaya; tertarik mengembangkan UI/UX aplikasi mobile serta menggambar digital.',
  en: 'Knowledge-based information technology combined with arts and culture, interested in developing UI/UX mobile applications and also digital drawing.',
};

const ROLES: Role[] = [
  {
    title: { id: 'Quality Engineer', en: 'Quality Engineer' },
    org: 'Sync Design Technologies',
    type: { id: 'Purnawaktu', en: 'Full-time' },
    period: { id: 'Sep 2026 – Sekarang', en: 'Sep 2026 – Present' },
    place: { id: 'Area London, Inggris · Jarak jauh', en: 'London Area, UK · Remote' },
    current: true,
  },
  {
    title: { id: 'Dosen', en: 'Lecturer' },
    org: 'Universitas Pendidikan Nasional',
    period: { id: 'Agt 2022 – Sekarang', en: 'Aug 2022 – Present' },
    current: true,
  },
  {
    title: { id: 'Junior Programmer', en: 'Junior Programmer' },
    org: 'Universitas Pendidikan Nasional',
    period: { id: 'Jan 2025 – Sekarang', en: 'Jan 2025 – Present' },
    place: { id: 'Denpasar, Bali · Di lokasi', en: 'Denpasar, Bali · On-site' },
    current: true,
  },
  {
    title: { id: 'Pengajar', en: 'Teacher' },
    org: 'timedoor',
    type: { id: 'Paruh waktu', en: 'Part-time' },
    period: { id: 'Jul 2022 – Sekarang', en: 'Jul 2022 – Present' },
    current: true,
  },
  {
    title: { id: 'Information Technology Product Manager', en: 'Information Technology Product Manager' },
    org: 'A1Balihub',
    period: { id: 'Jun 2023 – Jan 2025', en: 'Jun 2023 – Jan 2025' },
    current: false,
  },
  {
    title: { id: 'Dosen Paruh Waktu', en: 'Part-time Lecturer' },
    org: 'Politeknik Ganesha Guru',
    type: { id: 'Paruh waktu', en: 'Part-time' },
    period: { id: 'Agt 2022 – Mar 2023', en: 'Aug 2022 – Mar 2023' },
    place: { id: 'Singaraja, Bali · Jarak jauh', en: 'Singaraja, Bali · Remote' },
    current: false,
  },
];

const DEGREES: Degree[] = [
  { degree: { id: 'Magister (S2), Ilmu Komputer', en: "Master's degree, Computer Science" }, school: 'Universitas Pendidikan Ganesha', period: '2020 – 2022' },
  { degree: { id: 'Sarjana (S1), Teknologi Informasi', en: "Bachelor's degree, Information Technology" }, school: 'Universitas Udayana', period: '2016 – 2020' },
];

const CONTACTS: Contact[] = [
  { icon: '✉️', label: { id: 'Email', en: 'Email' }, value: 'putradananjaya@undiknas.ac.id', href: 'mailto:putradananjaya@undiknas.ac.id' },
  { icon: '💬', label: { id: 'WhatsApp', en: 'WhatsApp' }, value: '0877-6210-0752', href: 'https://wa.me/6287762100752' },
  { icon: '🔗', label: { id: 'LinkedIn', en: 'LinkedIn' }, value: 'linkedin.com/in/wputradananjaya', href: 'https://www.linkedin.com/in/wputradananjaya' },
];

/** "About the researcher" card shown at the end of the Overview page. */
@Component({
  selector: 'app-researcher-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rp">
      <div class="rp-id">
        <div class="rp-stars" aria-hidden="true"></div>
        <div class="rp-avatar" aria-hidden="true"><span>{{ initials }}</span></div>
        <div class="rp-id-body">
          <h4 class="rp-name">{{ name }}</h4>
          <p class="rp-headline">{{ tx(headline) }}</p>
          <p class="rp-loc">📍 {{ tx(location) }}</p>
          <p class="rp-about">{{ tx(about) }}</p>
          <ul class="rp-contacts">
            <li *ngFor="let c of contacts">
              <a [href]="c.href" target="_blank" rel="noopener noreferrer" [attr.aria-label]="tx(c.label) + ': ' + c.value">
                <span class="rp-c-icon" aria-hidden="true">{{ c.icon }}</span>
                <span class="rp-c-text"><em>{{ tx(c.label) }}</em>{{ c.value }}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div class="rp-cols">
        <div class="rp-block">
          <h5>💼 {{ t('Pengalaman', 'Experience') }}</h5>
          <ol class="rp-timeline">
            <li *ngFor="let r of roles" [class.now]="r.current">
              <strong>{{ tx(r.title) }}</strong>
              <span class="rp-org">{{ r.org }}<ng-container *ngIf="r.type"> · {{ tx(r.type) }}</ng-container></span>
              <span class="rp-meta">{{ tx(r.period) }}<ng-container *ngIf="r.place"> · {{ tx(r.place) }}</ng-container></span>
            </li>
          </ol>
        </div>
        <div class="rp-block">
          <h5>🎓 {{ t('Pendidikan', 'Education') }}</h5>
          <ul class="rp-degrees">
            <li *ngFor="let d of degrees">
              <strong>{{ d.school }}</strong>
              <span class="rp-org">{{ tx(d.degree) }}</span>
              <span class="rp-meta">{{ d.period }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; --gold: #e8b54a; --gold-soft: #f6dc9a; --gold-deep: #b07d1a; --night: #0d0b1f; --ink: #1b1535; --line: #ece6d6; }
    p { margin: 0; }
    .rp { display: grid; gap: 16px; }

    /* Identity card */
    .rp-id { position: relative; overflow: hidden; display: flex; gap: 26px; align-items: flex-start; padding: 28px 30px; border-radius: 18px; color: #fff;
      background: radial-gradient(ellipse at 90% 10%, #5b2a86 0%, transparent 55%), linear-gradient(135deg, var(--night), var(--ink));
      box-shadow: 0 18px 44px -22px rgba(27, 21, 53, .6); }
    .rp-stars { position: absolute; inset: 0; opacity: .55; pointer-events: none;
      background-image: radial-gradient(1px 1px at 18% 30%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 64% 18%, var(--gold-soft) 50%, transparent 51%), radial-gradient(1px 1px at 82% 70%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 40% 84%, #fff 50%, transparent 51%); }
    .rp-avatar { position: relative; flex: none; width: 96px; height: 96px; border-radius: 50%; display: grid; place-items: center;
      background: radial-gradient(circle at 30% 30%, #2d2356, var(--night)); border: 2px solid var(--gold); box-shadow: 0 0 0 6px rgba(232, 181, 74, .14); }
    .rp-avatar span { font: 700 30px 'Cinzel', serif; letter-spacing: .04em; color: var(--gold-soft); }
    .rp-id-body { position: relative; min-width: 0; flex: 1; }
    .rp-name { margin: 0; font-family: 'Cinzel', serif; font-size: clamp(20px, 2.6vw, 26px); line-height: 1.2; color: #fff; }
    .rp-headline { margin-top: 6px !important; font-size: 14.5px; font-weight: 600; color: var(--gold-soft); }
    .rp-loc { margin-top: 4px !important; font-size: 13px; color: rgba(255, 255, 255, .7); }
    .rp-about { margin-top: 14px !important; padding: 12px 16px; border-radius: 12px; font-size: 13.5px; line-height: 1.65; font-style: italic;
      color: rgba(255, 255, 255, .85); background: rgba(232, 181, 74, .08); border-left: 3px solid var(--gold); }
    .rp-contacts { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 10px; }
    .rp-contacts a { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-radius: 12px; text-decoration: none; color: #fff;
      border: 1px solid rgba(255, 255, 255, .22); background: rgba(255, 255, 255, .06); transition: background .2s, border-color .2s, transform .2s; }
    .rp-contacts a:hover { background: rgba(255, 255, 255, .13); border-color: var(--gold); transform: translateY(-1px); }
    .rp-c-icon { font-size: 16px; }
    .rp-c-text { display: flex; flex-direction: column; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
    .rp-c-text em { font-style: normal; font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--gold); }

    /* Experience & education */
    .rp-cols { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; }
    .rp-block { padding: 20px 22px; border-radius: 16px; border: 1px solid var(--line); background: linear-gradient(180deg, #fffdf7, #fff); }
    .rp-block h5 { margin: 0 0 14px; font-family: 'Cinzel', serif; font-size: 16px; color: var(--ink); }
    .rp-timeline, .rp-degrees { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
    .rp-timeline { position: relative; padding-left: 20px; }
    .rp-timeline::before { content: ''; position: absolute; left: 5px; top: 6px; bottom: 6px; width: 2px; background: linear-gradient(var(--gold), #5b2a86); opacity: .4; }
    .rp-timeline li { position: relative; }
    .rp-timeline li::before { content: ''; position: absolute; left: -20px; top: 5px; width: 12px; height: 12px; border-radius: 50%; box-sizing: border-box;
      background: #fff; border: 2px solid #c9bfa6; }
    .rp-timeline li.now::before { background: var(--gold); border-color: var(--gold-deep); box-shadow: 0 0 0 4px rgba(232, 181, 74, .2); }
    .rp-degrees li { padding-left: 14px; border-left: 3px solid var(--gold); }
    .rp-block strong { display: block; font-size: 14.5px; color: var(--ink); line-height: 1.4; }
    .rp-org { display: block; font-size: 13px; color: #4b4566; margin-top: 2px; }
    .rp-meta { display: block; font-size: 12px; color: var(--text-muted, #64748b); margin-top: 2px; }

    @media (max-width: 760px) {
      .rp-id { flex-direction: column; align-items: center; text-align: center; padding: 26px 20px; }
      .rp-about { text-align: left; }
      .rp-contacts { justify-content: center; }
      .rp-cols { grid-template-columns: minmax(0, 1fr); }
    }
  `]
})
export class ResearcherProfileComponent {
  private readonly i18n = inject(LanguageService);
  readonly t = this.i18n.t;

  readonly name = NAME;
  readonly initials = INITIALS;
  readonly headline = HEADLINE;
  readonly location = LOCATION;
  readonly about = ABOUT;
  readonly roles = ROLES;
  readonly degrees = DEGREES;
  readonly contacts = CONTACTS;

  tx(text: Txt): string {
    return this.i18n.t(text.id, text.en);
  }
}
