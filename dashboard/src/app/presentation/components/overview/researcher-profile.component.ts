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

interface Metric {
  label: Txt;
  value: number;
}

interface Publication {
  title: string;
  authors: string;
  /** Venue as Google Scholar prints it (long names are cut off there with "…"). */
  venue: string;
  year: number;
  /** "Cited by" count on Google Scholar; 0 when the column is empty. */
  cites: number;
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
  { icon: '🎓', label: { id: 'Google Scholar', en: 'Google Scholar' }, value: 'Md Wira Putra Dananjaya', href: 'https://scholar.google.com/citations?user=I67XTIYAAAAJ' },
];

/** Google Scholar profile, copied from the page export of 8 Oct 2026, in Scholar's own order. */
const SCHOLAR_URL = 'https://scholar.google.com/citations?user=I67XTIYAAAAJ';
const SCHOLAR_AS_OF: Txt = { id: '8 Okt 2026', en: '8 Oct 2026' };

const METRICS: Metric[] = [
  { label: { id: 'Kutipan', en: 'Citations' }, value: 53 },
  { label: { id: 'indeks-h', en: 'h-index' }, value: 5 },
  { label: { id: 'indeks-i10', en: 'i10-index' }, value: 2 },
];

/** How many publications are listed before "show all". */
const PUBS_COLLAPSED = 6;

const PUBLICATIONS: Publication[] = [
  { title: 'User-Centered Design Approach in Developing User Interface and User Experience of Sculptify Mobile Application', authors: 'MWP Dananjaya, GH Prathama, K Darmaastawan', venue: '', year: 2024, cites: 10 },
  { title: 'Perancangan Tampilan Aplikasi Pembelajaran Pinandita dengan Metode Five Planes, Heuristic Evaluation, Concurrent Think Aloud, Serta Cognitive Walkthrough', authors: 'MWP Dananjaya, G Indrawan, S Sariyasa', venue: 'JURIKOM (Jurnal Riset Komputer) 9 (1), 93', year: 2022, cites: 10 },
  { title: 'E-Learning Pinandita Berbasis Website Studi Kasus Pasraman Brahma Vidya Samgraha Buleleng', authors: 'WP Dananjaya, PW Buana, GAA Putri', venue: 'Jurnal Ilmiah Merpati 8 (2), 146-155', year: 2020, cites: 6 },
  { title: 'Rancang Bangun Aplikasi Produksi Pertanian & Perkebunan Berbasis Website Dengan Menggunakan Framework Laravel', authors: 'MWP Dananjaya', venue: 'J. Teknol. Inf. dan Komput 10 (1), 1-9', year: 2024, cites: 5 },
  { title: 'Perancangan Tampilan Aplikasi Dompet Digital Berbasis Mobile Dengan Pendekatan Human-Centered Design', authors: 'MWP Dananjaya, PG Pujayanti', venue: 'Jurnal Informatika Dan Teknik Elektro Terapan 12 (1)', year: 2024, cites: 5 },
  { title: 'Application of Machine Learning for Academic Outcome Prediction: A Methodological Comparative Study', authors: 'MWP Dananjaya, PG Pujayanti', venue: 'Journal of Innovation Information Technology and Application', year: 2025, cites: 3 },
  { title: 'PERANCANGAN ANTARMUKA APLIKASI KEUANGAN BADAN USAHA MILIK DESA BERBASIS WEBSITE MENGGUNAKAN METODE FIVE PLANES', authors: 'MWP Dananjaya', venue: 'Jurnal Teknologi Informasi dan Komputer 9 (3)', year: 2023, cites: 3 },
  { title: 'Analisis Determinan Karakter Siswa Menggunakan Explainable Machine Learning (SHAP) dan Klasterisasi Profil Sekolah Studi Kasus Rapor Pendidikan Provinsi Bali', authors: 'MWP Dananjaya, NNK Krisnawijaya, GH Prathama, IGND Paramartha, …', venue: 'Jurnal Kridatama Sains dan Teknologi 7 (02), 936-948', year: 2025, cites: 2 },
  { title: 'Analisis Penggunaan Regresi Linier Sederhana dalam Memprediksi Nilai Matematika Berdasarkan Faktor Demografi dan Akademik', authors: 'MWP Dananjaya', venue: 'Jurnal on Education', year: 2024, cites: 2 },
  { title: 'A System Architecture for Early Wilt Detection in Hydroponic Crops: An Implementation and Assessment', authors: 'I Wayan Aditya Suranata, I Putu Widia Prasetia, I Nengah Riana, …', venue: 'IOP Conference Series: Earth and Environmental Science 1395 (1), 012027', year: 2024, cites: 2 },
  { title: 'Model Machine Learning yang Dioptimalkan untuk Prediksi Penyakit Jantung Menggunakan R Shiny', authors: 'YD Amritha, NLPI Candrawengi, MWP Dananjaya, MAR Dayanti', venue: 'Jurnal Kridatama Sains dan Teknologi 8 (01), 1-10', year: 2026, cites: 1 },
  { title: 'Towards Robust SSH Anomaly Detection: A Deep Learning Comparative Analysis', authors: 'MWP Dananjaya, NLPI Candrawengi, IWA Suranata, IGND Paramartha', venue: '2025 IEEE 2nd International Conference on Cryptography, Informatics, and …', year: 2025, cites: 1 },
  { title: 'Development of User Interface and User Experience of the Nusantara Green Arts Application with the User Centered Design Method', authors: 'AAAW Putra, IKA Saputra, NLPI Candrawengi, IW Sukadana, …', venue: '2025 International Conference on Smart-Green Technology in Electrical and …', year: 2025, cites: 1 },
  { title: 'Towards user friendly smart precision farming: assessing thingsboard as an interface for IoT based farming system using system usability scale', authors: 'K Darmaastawan, IWA Suranata, IGND Paramartha, MWP Dananjaya', venue: '2024 10th International Conference on Smart Computing and Communication …', year: 2024, cites: 1 },
  { title: 'Machine Learning Approaches for Search Intent-Driven Website Optimization', authors: 'NLPI Candrawengi, MWP Dananjaya', venue: '2024 10th International Conference on Smart Computing and Communication …', year: 2024, cites: 1 },
  { title: 'Pengembangan Gim Peracikan Jamu sebagai Media Edukasi dan Pelestarian dengan Unity dan WebGL', authors: 'IGEPD Putra, MWP Dananjaya, AWO Gama, IW Sukadana', venue: 'Indonesian Journal of Innovation Multidisipliner Research 4 (3), 9292-9303', year: 2026, cites: 0 },
  { title: 'Adaptive User Interfaces: A Systematic Literature Review', authors: 'IGND Paramartha, MWP Dananjaya, AWO Gama, GPL Permana', venue: 'Krisnadana Journal 5 (3), 582-597', year: 2026, cites: 0 },
  { title: 'Hyperparameter Optimization on Bidirectional LSTM Model for High Resolution Solar Radiation Prediction: A Case Study in North Bali.', authors: 'MWP Dananjaya, PG Pujayanti', venue: 'International Journal on Advanced Science, Engineering & Information …', year: 2026, cites: 0 },
  { title: 'Beyond Binary Classification: Time-to-Event Modeling for Player Retention Using Cox Proportional Hazards and Ensemble Learning', authors: 'MWP Dananjaya', venue: 'Journal of Computers and Digital Business 5 (1), 1-5', year: 2026, cites: 0 },
  { title: 'Analisis Prediksi Produksi Telur Menggunakan Algoritma Decision Tree Regression', authors: 'MWP Dananjaya, PG Pujayanti', venue: 'JUSTIN (Jurnal Sistem dan Teknologi Informasi) 14 (1), 29-35', year: 2026, cites: 0 },
  { title: 'Pendekatan Transformer Deep Learning dalam Meramalkan Harga Minyak Sumatran Light Crude', authors: 'NLPI Candrawengi, YD Amritha, MWP Dananjaya', venue: 'Jurnal Kridatama Sains dan Teknologi 7 (02), 962-972', year: 2025, cites: 0 },
  { title: 'Synth-Pharm: a generative adversarial network (GAN) approach for creating high-fidelity synthetic pharmacy datasets', authors: 'MWP Dananjaya, M Dhrik, PDM Kurnianta, PG Pujayanti, MP Nugraha', venue: 'IET Conference Proceedings CP960 2025 (59), 124-129', year: 2025, cites: 0 },
  { title: 'A hybrid econometric and machine learning approach for analyzing the impact of local budgets on food security: a case study of Bali province', authors: 'MWP Dananjaya, PG Pujayanti, NLPI Candrawengi, YD Amritha, …', venue: 'IET Conference Proceedings CP960 2025 (59), 118-123', year: 2025, cites: 0 },
  { title: 'Unsupervised anomaly detection of rainfall patterns using LSTM autoencoder and isolation forest', authors: 'NLPI Candrawengi, IGNP Dharmayasa, NNK Krisnawijaya, …', venue: 'IET Conference Proceedings CP960 2025 (59), 199-205', year: 2025, cites: 0 },
  { title: 'Application of deep learning transformer architecture for inflation forecasting: an empirical and comparative study in Indonesia', authors: 'MWP Dananjaya, PG Pujayanti, PAT Febrianty, NDP Cahyadi, …', venue: 'International Conference on Green Energy, Computing and Intelligent …', year: 2025, cites: 0 },
  { title: 'Machine Learning-Based Intrusion Detection System for Network Security: Evaluation Using R and the UNSW-NB15 Dataset', authors: 'YD Amritha, NLPI Candrawengi, MWP Dananjaya', venue: '2025 IEEE 2nd International Conference on Cryptography, Informatics, and …', year: 2025, cites: 0 },
  { title: 'Advancing Rainfall Forecasting Through LSTM and ED-LSTM Approach with CHIRPS Satellite Data', authors: 'NLPI Candrawengi, MWP Dananjaya, YD Amritha', venue: '2025 IEEE 2nd International Conference on Cryptography, Informatics, and …', year: 2025, cites: 0 },
  { title: 'Data-Driven Earthquake Prediction in Bali Province Using Spatio-Temporal Deep Learning Techniques', authors: 'NLPI Candrawengi, YD Amritha, MWP Dananjaya, MAR Dayanti, …', venue: '2025 International Conference on Smart-Green Technology in Electrical and …', year: 2025, cites: 0 },
  { title: 'Deep Learning for Short-Term Precipitation Prediction: A Case Study for a Disaster Early Warning System in a Tropical Region', authors: 'MWP Dananjaya, IGNP Dharmayasa, YD Amritha, GH Prathama, …', venue: '2025 International Conference on Smart-Green Technology in Electrical and …', year: 2025, cites: 0 },
  { title: 'PENGARUH KONSUMSI KAFEIN TERHADAP KUALITAS TIDUR DENGAN MENGGUNAKAN ANALISIS REGRESI SEDERHANA', authors: 'MWP Dananjaya', venue: 'Jurnal Teknologi Informasi dan Komputer 10 (3)', year: 2024, cites: 0 },
  { title: 'Software Development Based on Sign Language Video Integration to Increase Accessibility of Port Information for the Deaf in Sanur-Bali', authors: 'DC Indrashwara, MWP Dananjaya, IGFS Tapa, INI Kumara, …', venue: '2024 10th International Conference on Smart Computing and Communication …', year: 2024, cites: 0 },
  { title: 'PERANCANGAN DATABASE PENDAFTARAN IMUNISASI BAYI BERBASIS ONLINE', authors: 'MWP Dananjaya, YD Amritha, NLPI Candrawengi, PG Pujayanti', venue: 'Jurnal Teknologi Informasi dan Komputer 10 (2)', year: 2024, cites: 0 },
  { title: 'ANALISIS TIPOGRAFI PADA LOGO SECRET GARDEN VILLAGE', authors: 'AA Asokawati, MWP Dananjaya', venue: 'Aptekmas Jurnal Pengabdian pada Masyarakat 7 (3), 140-149', year: 2024, cites: 0 },
  { title: 'PERANCANGAN ANTARMUKA APLIKASI KEUANGAN BADAN USAHA MILIK DESA BERBASIS WEBSITE MENGGUNAKAN METODE FIVE PLANES', authors: 'WPD MD', venue: 'Jurnal Teknologi Informasi dan Komputer, Universitas Dhyana Pura …', year: 2023, cites: 0 },
  { title: 'Website-Based Tourism Village Application Interface Design Case Study of Sambangan Buleleng Tourism Village', authors: 'MWP Dananjaya', venue: 'INFOKUM 10 (5), 424-433', year: 2022, cites: 0 },
  { title: 'PERANCANGAN TAMPILAN APLIKASI PEMBELAJARAN PINANDITA DENGAN METODE FIVE PLANES, HEURISTIC EVALUATION, CONCURRENT THINK ALOUD, SERTA COGNITIVE WALKTHROUGH', authors: 'M Wira Putra Dananjaya', venue: 'Universitas Pendidikan Ganesha', year: 2022, cites: 0 },
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

      <div class="rp-block rp-pubs">
        <div class="rp-pubs-head">
          <h5>📚 {{ t('Publikasi', 'Publications') }}</h5>
          <a class="rp-scholar" [href]="scholarUrl" target="_blank" rel="noopener noreferrer">{{ t('Lihat di Google Scholar', 'View on Google Scholar') }} ↗</a>
        </div>
        <div class="rp-metrics">
          <div class="rp-metric" *ngFor="let m of metrics">
            <span class="rp-metric-val">{{ m.value }}</span>
            <span class="rp-metric-lbl">{{ tx(m.label) }}</span>
          </div>
        </div>
        <p class="rp-asof">{{ t('Sumber: Google Scholar, per', 'Source: Google Scholar, as of') }} {{ tx(scholarAsOf) }} · {{ publications.length }} {{ t('entri, urutan sesuai Scholar', 'entries, in Scholar order') }}</p>
        <ol class="rp-publist">
          <li *ngFor="let p of visiblePubs">
            <div class="rp-pub-main">
              <strong>{{ p.title }}</strong>
              <span class="rp-org">{{ p.authors }}</span>
              <span class="rp-meta"><ng-container *ngIf="p.venue">{{ p.venue }} · </ng-container>{{ p.year }}</span>
            </div>
            <span class="rp-cites" *ngIf="p.cites > 0" [attr.title]="t('Dikutip oleh', 'Cited by') + ' ' + p.cites">{{ p.cites }}<em>{{ t('kutipan', 'cites') }}</em></span>
          </li>
        </ol>
        <button type="button" class="rp-more" *ngIf="publications.length > collapsedCount" (click)="showAllPubs = !showAllPubs" [attr.aria-expanded]="showAllPubs">
          {{ showAllPubs ? t('Tampilkan lebih sedikit', 'Show fewer') : t('Tampilkan semua', 'Show all') + ' (' + publications.length + ')' }}
        </button>
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

    /* Publications */
    .rp-pubs-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 16px; margin-bottom: 14px; }
    .rp-pubs-head h5 { margin: 0; }
    .rp-scholar { font-size: 13px; font-weight: 700; color: var(--gold-deep); text-decoration: none; }
    .rp-scholar:hover { text-decoration: underline; }
    .rp-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; max-width: 480px; }
    .rp-metric { display: flex; flex-direction: column; align-items: center; padding: 12px 8px; border-radius: 12px; color: #fff;
      background: radial-gradient(circle at 30% 20%, #2d2356, var(--night)); border: 1px solid rgba(232, 181, 74, .45); }
    .rp-metric-val { font: 800 26px 'Cinzel', serif; line-height: 1.1; color: var(--gold-soft); }
    .rp-metric-lbl { margin-top: 2px; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: rgba(255, 255, 255, .75); }
    .rp-asof { margin: 8px 0 14px !important; font-size: 12px; color: var(--text-muted, #64748b); }
    .rp-publist { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; }
    .rp-publist li { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--line); background: #fff; }
    .rp-pub-main { flex: 1; min-width: 0; }
    .rp-publist strong { font-size: 13.5px; overflow-wrap: anywhere; }
    .rp-cites { flex: none; display: flex; flex-direction: column; align-items: center; min-width: 44px; padding: 4px 6px; border-radius: 10px;
      font: 800 15px 'Inter', sans-serif; color: #7a4f0c; background: #f3efe4; }
    .rp-cites em { font-style: normal; font-size: 9.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .rp-more { margin-top: 14px; padding: 9px 18px; border-radius: 999px; font: 700 13px 'Inter', sans-serif; cursor: pointer;
      color: var(--ink); background: #fffaf0; border: 1px solid var(--gold); transition: background .2s; }
    .rp-more:hover { background: #fdf0d2; }

    @media (max-width: 1000px) {
      .rp-publist { grid-template-columns: minmax(0, 1fr); }
    }
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
  readonly scholarUrl = SCHOLAR_URL;
  readonly scholarAsOf = SCHOLAR_AS_OF;
  readonly metrics = METRICS;
  readonly publications = PUBLICATIONS;
  readonly collapsedCount = PUBS_COLLAPSED;

  showAllPubs = false;

  get visiblePubs(): Publication[] {
    return this.showAllPubs ? this.publications : this.publications.slice(0, this.collapsedCount);
  }

  tx(text: Txt): string {
    return this.i18n.t(text.id, text.en);
  }
}
