import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="guide-container">
      
      <!-- Welcome Header Banner -->
      <div class="welcome-banner md-card">
        <div class="banner-icon">🕹️</div>
        <div class="banner-text">
          <h2>Panduan Bermain Mahabharata TCG</h2>
          <p>Selamat datang di Research & Balancing Dashboard Mahabharata TCG. Halaman ini menjelaskan aturan main dasar, alur per giliran, dan makna filosofis dari metrik faksi asimetris.</p>
        </div>
      </div>

      <!-- Main Columns Grid -->
      <div class="guide-grid">
        
        <!-- Column 1: Cara Bermain & Alur Permainan -->
        <div class="column-card md-card">
          <h3>🎮 Cara & Alur Permainan</h3>
          <p class="subtitle">Mahabharata TCG dimainkan secara giliran bergiliran antara dua faksi:</p>
          
          <div class="guide-timeline">
            <div class="timeline-item">
              <span class="timeline-step">1</span>
              <div class="timeline-body">
                <strong>Fase Persiapan Deck</strong>
                <p>Setiap pemain bersiap dengan deck tokoh faksi aktif. Salah satu tokoh masuk ke Arena Aktif, cadangan bersiaga di Bench.</p>
              </div>
            </div>

            <div class="timeline-item">
              <span class="timeline-step">2</span>
              <div class="timeline-body">
                <strong>Fase Ambil Kartu (Draw Phase)</strong>
                <p>Giliran dimulai dengan menarik kartu dari deck. Jika dek habis, pemain dinyatakan kalah terkena penalti Deck Out.</p>
              </div>
            </div>

            <div class="timeline-item">
              <span class="timeline-step">3</span>
              <div class="timeline-body">
                <strong>Akumulasi Prana</strong>
                <p>Karakter aktif mengundi prana spiritual setiap turn (sesuai elemen faksi/Universal) sebagai resource melancarkan serangan.</p>
              </div>
            </div>

            <div class="timeline-item">
              <span class="timeline-step">4</span>
              <div class="timeline-body">
                <strong>Fase Aksi (Combat / Heal)</strong>
                <p>Pemain menyerang karakter aktif lawan atau menggunakan skill penyembuhan (seperti Yudhistira) jika prana mencukupi.</p>
              </div>
            </div>

            <div class="timeline-item">
              <span class="timeline-step">5</span>
              <div class="timeline-body">
                <strong>Fase Retreat (Tactical Retreat)</strong>
                <p>Karakter aktif yang sekarat dapat retreat ke Bench dengan membayar cost agar tidak tereliminasi oleh lawan.</p>
              </div>
            </div>

            <div class="timeline-item">
              <span class="timeline-step">6</span>
              <div class="timeline-body">
                <strong>Victory Check (Sasmita Drop)</strong>
                <p>Ketika kamu berhasil membuat karakter aktif lawan gugur (HP habis), Sasmita milikmu berkurang 1 (kamu mengklaim satu prize). Faksi yang Sasmita-nya lebih dulu mencapai 0 menang!</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Column 2: Glossarium & Filosofi Faksi -->
        <div class="column-card md-card">
          <h3>📖 Glossarium & Makna Istilah</h3>
          <p class="subtitle">Penjelasan metrik dan unsur spiritual dalam game Mahabharata TCG:</p>

          <div class="glossary-list">
            <div class="glossary-item">
              <span class="glossary-term md-badge primary">🛡️ Sasmita</span>
              <p class="glossary-def">Hitungan prize card faksi (mulai dari 3, bukan life total). Setiap kali kamu berhasil mengalahkan karakter aktif lawan, Sasmita milikmu berkurang 1. Faksi yang lebih dulu mencapai Sasmita 0 menang.</p>
            </div>

            <div class="glossary-item">
              <span class="glossary-term md-badge warning">🔮 Prana</span>
              <p class="glossary-def">Energi spiritual/sumber daya faksi yang diundi setiap giliran giliran untuk mengaktifkan serangan atau skill dari kartu tokoh.</p>
            </div>

            <div class="glossary-item">
              <span class="glossary-term md-badge primary">✨ Satwika (Pandawa)</span>
              <p class="glossary-def">Sifat tenang, mulia, dan murni. Faksi Pandawa berfokus pada ketahanan (Damage Reduction) dan regenerasi HP berlanjut di Bench.</p>
            </div>

            <div class="glossary-item">
              <span class="glossary-term md-badge warning">🔥 Rajasika (Aggro)</span>
              <p class="glossary-def">Sifat aktif, bergelora, dan agresif. Faksi Rajasika berfokus pada serangan eksplosif cepat di awal laga namun memiliki resiko recoil damage diri sendiri.</p>
            </div>

            <div class="glossary-item">
              <span class="glossary-term md-badge error">🌪️ Tamasika (Kurawa)</span>
              <p class="glossary-def">Sifat gelap, destruktif, dan culas. Faksi Kurawa berfokus pada taktik memperlambat tempo (Stall), membuang deck lawan (Mill), dan scaling damage berbasis kartu mati di makam.</p>
            </div>

            <div class="glossary-item">
              <span class="glossary-term md-badge">👤 Bench (Cadangan)</span>
              <p class="glossary-def">Area siaga untuk karakter cadangan. Karakter di bench aman dari serangan aktif lawan dan dapat dipulihkan secara bertahap.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  `
})
export class GuideComponent { }
