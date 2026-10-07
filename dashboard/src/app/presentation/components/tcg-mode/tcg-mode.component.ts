import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SandboxService } from '../../../core/usecases/sandbox.service';
import { Faction } from '../../../core/engine/research-params';
import { AttackDef, mulberry32 } from '../../../core/engine/research-engine';
import { InPlay, TcgAction, TcgGame, TcgLog, TCG_MODE_CONFIG, costMet, isCharacter, remainingHp } from '../../../core/engine/tcg-mode-engine';
import { chooseBotAction } from '../../../core/engine/tcg-mode-bot';
import { SoundService } from '../../../core/services/sound.service';
import { SimulatorModeSwitchComponent } from '../simulator/simulator-mode-switch.component';
import { PlayMode, TcgMatchSettings, TcgModeSession } from './tcg-mode-session.service';
import { LanguageService } from '../../../core/services/language.service';

const HUMAN = 0;
/** Base pause between bot actions so a person can follow them. Display pacing only. */
const BOT_DELAY_MS: { [speed: string]: number } = { 'sangat lambat': 3200, lambat: 2200, sedang: 1400, cepat: 500 };
const DEFAULT_SPEED = 'lambat';
/** Display names of the bot speeds (keys of BOT_DELAY_MS): [Indonesian, English]. */
const SPEED_LABEL: { [speed: string]: [string, string] } = {
  'sangat lambat': ['sangat lambat', 'very slow'], lambat: ['lambat', 'slow'], sedang: ['sedang', 'medium'], cepat: ['cepat', 'fast'],
};
/** Longer pause after events worth watching (multiplies the base pause); others use 1. */
const PAUSE_AFTER: { [fx: string]: number } = { hit: 1.6, ko: 2.2, turn: 1.2 };
/** Animation lengths in ms; keep in step with the keyframe durations in the styles below. */
const FX_MS = { float: 1600, shake: 450, lunge: 450, ko: 900, pulse: 800, glow: 900, banner: 1400, endBanner: 3200, coinSpin: 1500, coinResult: 1400 };
/** Log kinds shown as the "last action" caption. */
const CAPTION_KINDS: TcgLog['kind'][] = ['action', 'energy', 'damage', 'knockout', 'prize'];
const FACTION_LABEL: { [f in Faction]: string } = { SATWIKA: 'Satwika', RAJASIKA: 'Rajasika', TAMASIKA: 'Tamasika' };
const ENERGY_LETTER: { [type: string]: string } = { Satwika: 'S', Rajasika: 'R', Tamasika: 'T', Universal: 'U' };
const SEED_RANGE = 2 ** 31;

interface HandAction { label: string; enabled: boolean; }
interface Float { id: number; player: number; uid: number | null; target: 'active' | 'card' | 'deck' | 'prize'; text: string; kind: string; }
interface Banner { id: number; title: string; sub: string; kind: 'turn' | 'win' | 'tie'; }
interface Caption { id: number; text: string; kind: string; }

function randomSeed(): number {
  return Math.floor(Math.random() * SEED_RANGE);
}

@Component({
  selector: 'app-tcg-mode',
  standalone: true,
  imports: [CommonModule, FormsModule, SimulatorModeSwitchComponent],
  template: `
    <div class="tcg-banner" *ngFor="let b of bannerList; trackBy: byId" [ngClass]="'b-' + b.kind" data-testid="tcg-banner">
      <strong>{{ b.title }}</strong><span>{{ b.sub }}</span>
    </div>

    <app-simulator-mode-switch active="tcg"></app-simulator-mode-switch>

    <div class="md-card tcg-controls">
      <h2>🃏 {{ t('Mode TCG', 'TCG Mode') }} <span class="md-badge warning">{{ t('prototipe', 'prototype') }}</span></h2>
      <div class="engine-note tcg-note">
        @if (i18n.isEn()) {
        The turn structure mimics the Pokémon TCG: draw 1 card each turn, attach at most 1 energy per turn,
        energy stays attached after attacking, retreat by discarding energy, {{ config.prizeCards }} prize cards.
        Cards and their numbers use the sandbox parameters (change them in <strong>Parameter Sliders</strong> / <strong>Card Creator</strong>).
        <strong>This is not the research engine</strong>: match results here are not used in the paper and are not compared with <code>results/</code>.
        Not yet implemented: weakness/resistance, trainer cards, evolution, special conditions.
        <span class="tcg-note-diff">A difference that changes card strength: in this mode knocked-out characters and discarded energy go to the discard pile,
          so <em>Angkara 100 Kurawa</em> (bonus damage per card in the opponent's discard) can be much stronger than in the research engine,
          whose discard pile is only filled by the Mill effect.</span>
        } @else {
        Struktur giliran meniru Pokémon TCG: ambil 1 kartu tiap giliran, tempel maksimal 1 energi per giliran,
        energi tetap menempel setelah menyerang, retreat dengan membuang energi, {{ config.prizeCards }} kartu prize.
        Kartu dan angkanya memakai parameter sandbox (ubah di <strong>Parameter Sliders</strong> / <strong>Card Creator</strong>).
        <strong>Ini bukan engine riset</strong>: hasil pertandingan di sini tidak dipakai di paper dan tidak dibandingkan dengan <code>results/</code>.
        Belum ada: weakness/resistance, kartu trainer, evolusi, special condition.
        <span class="tcg-note-diff">Perbedaan yang mengubah kekuatan kartu: di mode ini karakter yang gugur dan energi yang dibuang masuk discard pile,
          jadi <em>Angkara 100 Kurawa</em> (bonus damage per kartu di discard lawan) bisa jauh lebih kuat daripada di engine riset,
          yang discard pile-nya hanya terisi lewat efek Mill.</span>
        }
        <span *ngIf="loadError" class="engine-note-error">{{ t('Gagal memuat parameter riset', 'Failed to load the research parameters') }}: {{ loadError }}</span>
      </div>

      <div class="tcg-control-row">
        <div class="tcg-segmented" role="group" [attr.aria-label]="t('Pemain', 'Players')">
          <button type="button" [class.on]="playMode === 'human'" (click)="playMode = 'human'">👤 {{ t('Kamu vs Bot', 'You vs Bot') }}</button>
          <button type="button" [class.on]="playMode === 'bots'" (click)="playMode = 'bots'">🤖 Bot vs Bot</button>
        </div>
        <label>{{ playMode === 'human' ? t('Faksi kamu', 'Your faction') : t('Faksi Bot A', 'Bot A faction') }}
          <select class="md-select" [(ngModel)]="p1Faction">
            <option *ngFor="let f of factions" [value]="f">{{ factionLabel[f] }}</option>
          </select>
        </label>
        <label>{{ playMode === 'human' ? t('Faksi bot', 'Bot faction') : t('Faksi Bot B', 'Bot B faction') }}
          <select class="md-select" [(ngModel)]="p2Faction">
            <option *ngFor="let f of factions" [value]="f">{{ factionLabel[f] }}</option>
          </select>
        </label>
        <label>{{ t('Seed kocokan deck', 'Deck shuffle seed') }}
          <input class="md-input tcg-seed" type="number" min="0" [(ngModel)]="seed">
        </label>
        <label>{{ t('Kecepatan bot', 'Bot speed') }}
          <select class="md-select" [(ngModel)]="speed" (change)="onSpeedChange()">
            <option *ngFor="let s of speeds" [value]="s">{{ speedLabel(s) }}</option>
          </select>
        </label>
        <button type="button" class="md-btn md-btn-outlined" (click)="randomizeSeed()" [title]="t('Acak seed tanpa memulai pertandingan', 'Randomize the seed without starting a match')">🎲 {{ t('Acak seed', 'Random seed') }}</button>
        <button type="button" class="md-btn md-btn-primary" [disabled]="!paramsReady" (click)="start()" data-testid="tcg-start">
          {{ game ? t('🔄 Mulai pertandingan baru', '🔄 Start a new match') : t('▶ Mulai pertandingan', '▶ Start match') }}
        </button>
        <button type="button" class="md-btn md-btn-outlined" (click)="toggleSound()" [attr.aria-pressed]="soundOn">{{ soundOn ? t('🔊 Suara', '🔊 Sound') : t('🔇 Suara mati', '🔇 Sound off') }}</button>
      </div>
      <div class="tcg-pending-note" *ngIf="game && settingsChanged()" data-testid="tcg-pending">
        {{ t('Pengaturan di atas berbeda dari pertandingan yang sedang berjalan. Pengaturan baru berlaku setelah kamu menekan "Mulai pertandingan baru".', 'The settings above differ from the match in progress. New settings take effect after you press "Start a new match".') }}
      </div>
      <div class="tcg-control-row" *ngIf="game && gameMode === 'bots'">
        <button type="button" class="md-btn md-btn-secondary" [disabled]="game.phase === 'over'" (click)="toggleAuto()">
          {{ autoRunning ? t('⏸️ Jeda', '⏸️ Pause') : t('▶️ Jalan otomatis', '▶️ Run automatically') }}
        </button>
        <button type="button" class="md-btn md-btn-outlined" [disabled]="autoRunning || game.phase === 'over'" (click)="botStep()">➡️ {{ t('Satu aksi', 'One action') }}</button>
        <span class="tcg-hint">{{ t('Bot memakai heuristik sederhana (bukan agen hasil training): tempel energi ke karakter yang belum cukup energi, retreat bila HP ≤ 30%, lalu pilih serangan dengan damage terbesar. Jeda setelah serangan dan KO dibuat lebih panjang agar efeknya bisa diikuti.',
          'The bots use a simple heuristic (not a trained agent): attach energy to a character that still needs it, retreat when HP ≤ 30%, then choose the attack with the most damage. The pause after attacks and KOs is longer so the effects can be followed.') }}</span>
      </div>
    </div>

    <div *ngIf="!game" class="md-card tcg-lobby" data-testid="tcg-lobby">
      <ng-container *ngIf="paramsReady; else loadingParams">
        <div class="tcg-lobby-coin">🪙</div>
        <h3>{{ t('Siap bertanding?', 'Ready to battle?') }}</h3>
        <p>
          <strong>{{ playMode === 'human' ? t('Kamu', 'You') : 'Bot A' }} ({{ factionLabel[p1Faction] }})</strong> {{ t('melawan', 'versus') }}
          <strong>{{ playMode === 'human' ? 'Bot' : 'Bot B' }} ({{ factionLabel[p2Faction] }})</strong>.
          {{ t('Atur mode dan faksi di atas. Pertandingan dimulai dengan lempar koin untuk menentukan siapa yang jalan duluan.', 'Set the mode and factions above. The match starts with a coin toss to decide who goes first.') }}
        </p>
        <button type="button" class="md-btn md-btn-primary tcg-lobby-start" (click)="start()">{{ t('▶ Mulai pertandingan', '▶ Start match') }}</button>
        <div class="tcg-error" *ngIf="actionError">{{ actionError }}</div>
      </ng-container>
      <ng-template #loadingParams>{{ t('Memuat parameter kartu…', 'Loading card parameters…') }}</ng-template>
    </div>

    <ng-container *ngIf="game as g">
      <div class="tcg-arena" #arena>
        <div class="tcg-coin-overlay" *ngIf="coin" (click)="skipCoin()" data-testid="tcg-coin" [title]="t('Klik untuk lewati', 'Click to skip')">
          <div class="coin-container">
            <div class="coin" [class.flip-p1]="coin.player === 0" [class.flip-p2]="coin.player === 1">
              <div class="side-a"><span class="tcg-coin-icon">⚔️</span><div class="tcg-coin-label">{{ coin.names[0] }}</div></div>
              <div class="side-b"><span class="tcg-coin-icon">🛡️</span><div class="tcg-coin-label">{{ coin.names[1] }}</div></div>
            </div>
            <div class="coin-status">
              <h3 *ngIf="!coin.landed" class="tcg-coin-title">{{ t('Lempar koin: siapa jalan duluan?', 'Coin toss: who goes first?') }}</h3>
              <div *ngIf="coin.landed" class="fade-in-text">
                <h3 class="tcg-coin-result">{{ coin.names[coin.player] }} {{ t('jalan duluan', 'goes first') }}</h3>
                <p class="tcg-coin-sub">{{ t('tapi belum boleh menyerang di giliran pertamanya', 'but may not attack on their first turn') }}</p>
              </div>
            </div>
          </div>
        </div>
      <div class="tcg-status" [class.over]="g.phase === 'over'" [class.mine]="humanWaiting()" data-testid="tcg-status">
        <div class="tcg-status-text">{{ statusText() }}</div>
        <div class="tcg-checklist" *ngIf="g.phase === 'main'">
          <span [class.done]="g.energyAttached">⚡ {{ g.energyAttached ? t('Energi sudah ditempel', 'Energy attached') : t('Energi belum ditempel', 'Energy not attached yet') }}</span>
          <span [class.done]="g.retreated">↔ {{ g.retreated ? t('Retreat sudah dipakai', 'Retreat used') : t('Retreat belum dipakai', 'Retreat not used yet') }}</span>
          <span *ngIf="g.isFirstTurn()" class="locked">🚫 {{ t('Giliran pertama: tidak boleh menyerang', 'First turn: no attacking') }}</span>
        </div>
        <div class="tcg-status-actions">
          <button type="button" class="md-btn md-btn-primary" *ngIf="humanCan('endTurn')" (click)="act({ type: 'endTurn' })">⏭ {{ t('Akhiri giliran', 'End turn') }}</button>
          <button type="button" class="md-btn md-btn-primary" *ngIf="humanCan('setupDone')" (click)="act({ type: 'setupDone' })">✅ {{ t('Selesai setup', 'Finish setup') }}</button>
          <ng-container *ngIf="g.phase === 'over'">
            <button type="button" class="md-btn md-btn-primary" (click)="start()">{{ t('Main lagi (seed sama)', 'Play again (same seed)') }}</button>
            <button type="button" class="md-btn md-btn-outlined" (click)="newSeed()">{{ t('Main lagi (seed baru)', 'Play again (new seed)') }}</button>
          </ng-container>
        </div>
        <div class="tcg-error" *ngIf="actionError">{{ actionError }}</div>
      </div>
      <div class="tcg-caption-wrap" aria-live="polite">
        <div class="tcg-caption" *ngFor="let c of captionList; trackBy: byId" [ngClass]="'k-' + c.kind" data-testid="tcg-caption">{{ c.text }}</div>
      </div>

      <div class="tcg-layout">
        <div class="tcg-board">
          <section *ngFor="let p of boardOrder" class="tcg-side md-card" [class.is-turn]="isTurnOf(p)" [attr.data-player]="p">
            <header class="tcg-side-head">
              <div class="tcg-side-name">{{ p === 1 ? '▲' : '▼' }} {{ g.players[p].name }}</div>
              <div class="tcg-counters">
                <span class="tcg-counter" [title]="t('Ambil semua kartu prize untuk menang', 'Take all prize cards to win')" [class.fx-pulse]="fxOn('pulse-prize', p)">
                  <span class="tcg-float" *ngFor="let f of counterFloats(p, 'prize'); let fi = index; trackBy: byId" [ngClass]="f.kind" [style.top.px]="floatTop(fi)">{{ f.text }}</span>
                  🏆 Prize
                  <ng-container *ngIf="g.phase !== 'setup'; else prizeLater">
                    <span class="tcg-prize-backs"><i *ngFor="let _ of g.players[p].prizes"></i></span> {{ g.players[p].prizes.length }}
                  </ng-container>
                  <ng-template #prizeLater><small>{{ t('disisihkan setelah setup', 'set aside after setup') }}</small></ng-template>
                </span>
                <span class="tcg-counter" [title]="t('Kalah bila tidak bisa mengambil kartu di awal giliran', 'You lose if you cannot draw a card at the start of your turn')" [class.fx-pulse]="fxOn('pulse-deck', p)">
                  <span class="tcg-float" *ngFor="let f of counterFloats(p, 'deck'); let fi = index; trackBy: byId" [ngClass]="f.kind" [style.top.px]="floatTop(fi)">{{ f.text }}</span>
                  📚 Deck {{ g.players[p].deck.length }}
                </span>
                <span class="tcg-counter">✋ {{ t('Tangan', 'Hand') }} {{ g.players[p].hand.length }}</span>
                <span class="tcg-counter" [title]="t('Karakter gugur, energi terbuang, kartu terkena Mill', 'Knocked-out characters, discarded energy, milled cards')">
                  🗑 Discard {{ g.players[p].discard.length }}
                  <small>({{ discardCharacters(p) }} {{ t('karakter', 'characters') }}, {{ g.players[p].discard.length - discardCharacters(p) }} {{ t('energi', 'energy') }})</small>
                </span>
              </div>
            </header>

            <div class="tcg-zones">
              <div class="tcg-zone tcg-zone-active">
                <div class="tcg-zone-label">{{ t('Aktif', 'Active') }}</div>
                <div class="tcg-active-slot" [ngClass]="activeFxClasses(p)" [attr.data-fx]="activeFxAttr(p)">
                  <span class="tcg-float big" *ngFor="let f of zoneFloats(p); let fi = index; trackBy: byId" [ngClass]="f.kind" [style.top.px]="floatTop(fi)">{{ f.text }}</span>
                  <ng-container *ngTemplateOutlet="charTpl; context: { $implicit: g.players[p].active, p: p, idx: -1 }"></ng-container>
                </div>
              </div>
              <div class="tcg-zone tcg-zone-bench">
                <div class="tcg-zone-label">Bench ({{ g.players[p].bench.length }}/{{ config.benchCap }})</div>
                <div class="tcg-bench-row">
                  <ng-container *ngFor="let b of g.players[p].bench; let i = index">
                    <ng-container *ngTemplateOutlet="charTpl; context: { $implicit: b, p: p, idx: i }"></ng-container>
                  </ng-container>
                  <div class="tcg-slot-empty" *ngIf="g.players[p].bench.length === 0">{{ t('kosong', 'empty') }}</div>
                </div>
              </div>
            </div>

            <div class="tcg-hand">
              <div class="tcg-zone-label">{{ t('Tangan', 'Hand') }}</div>
              <div class="tcg-hand-row" *ngIf="handVisible(p); else hiddenHand">
                <div *ngFor="let c of g.players[p].hand; let i = index" class="tcg-hand-card"
                     [class.energy]="c.kind === 'energy'" [class.selected]="p === HUMAN && selectedEnergy === i">
                  <ng-container *ngIf="c.kind === 'energy'; else handChar">
                    <span class="tcg-energy big" [ngClass]="'e-' + c.energyType">{{ letter(c.energyType) }}</span>
                    <span>{{ t('Energi', 'Energy') }} {{ c.energyType }}</span>
                  </ng-container>
                  <ng-template #handChar>
                    <strong>{{ charDef(c).name }}</strong>
                    <span>{{ charDef(c).hp }} HP</span>
                  </ng-template>
                  <ng-container *ngIf="p === HUMAN && gameMode === 'human'">
                    <button type="button" *ngIf="handAction(i) as a" class="tcg-mini-btn" [disabled]="!a.enabled" (click)="onHandClick(i)">{{ a.label }}</button>
                  </ng-container>
                </div>
                <div class="tcg-slot-empty" *ngIf="g.players[p].hand.length === 0">{{ t('kosong', 'empty') }}</div>
              </div>
              <ng-template #hiddenHand>
                <div class="tcg-hand-row"><div class="tcg-back" *ngFor="let _ of g.players[p].hand"></div></div>
              </ng-template>
            </div>
          </section>
        </div>

        <aside class="md-card tcg-log">
          <h3>{{ t('Log pertandingan', 'Match log') }}</h3>
          <div class="tcg-log-box" #logBox>
            <div *ngFor="let e of g.log" class="tcg-log-line" [ngClass]="'k-' + e.kind">
              <span class="tcg-log-turn">{{ t('G', 'T') }}{{ e.turn }}</span>
              <span>{{ e.message }}<em *ngIf="showSecret(e)"> ({{ t('kartu', 'card') }}: {{ e.secret }})</em></span>
            </div>
          </div>
        </aside>
      </div>
      </div>

      <details class="md-card tcg-rules">
        @if (i18n.isEn()) {
        <summary>Full TCG Mode rules and how they differ from the research engine</summary>
        <ul>
          <li><strong>Deck:</strong> {{ config.copiesPerCharacter }} copies of each faction character + {{ config.energyCards }} faction energy cards
            (official Pokémon uses 60 cards; here the deck size follows the number of characters).</li>
          <li><strong>Setup:</strong> coin toss, draw {{ config.handSize }} cards. No character in hand = mulligan (reshuffle and draw again), and the opponent
            may draw 1 extra card per mulligan. Choose 1 Active character and at most {{ config.benchCap }} on the Bench (face down until both players are done),
            then the top {{ config.prizeCards }} deck cards become prizes.</li>
          <li><strong>Turn:</strong> draw 1 card → play characters to the Bench (any number) → attach at most 1 energy to any character →
            retreat at most once (discard energy equal to the retreat cost) → attack (ends the turn) or end the turn.
            The first player may not attack on their first turn.</li>
          <li><strong>Attack cost:</strong> faction energy (S/R/T) must match; U (Universal) can be paid with any energy. Energy is <em>not</em> used up by attacking.</li>
          <li><strong>Knockout (KO):</strong> the character and its energy go to the discard pile, the opponent takes 1 prize into their hand, and the owner must promote a character from the Bench.
            Recoil that knocks out the attacker also gives the opponent 1 prize.</li>
          <li><strong>Winning:</strong> take your last prize, the opponent has no character on the Bench when their Active is knocked out, or the opponent cannot draw (empty deck).
            Safeguard: after {{ config.turnCap }} turns, the player with fewer prizes left wins (equal = draw).</li>
          <li><strong>Card effects</strong> are the same as in the research engine (Mill, Recoil, Bench bonus max {{ config.benchScalingMax }}, bonus per discard card, damage reduction),
            except <em>Heal</em>: here Bench characters can be damaged (after a retreat), so Heal restores the most damaged Bench character.</li>
          <li><strong>The research engine differs:</strong> there, energy (prana) is generated automatically and used up when spent, and there is no per-turn draw, no retreat and no player decision.</li>
        </ul>
        } @else {
        <summary>Aturan lengkap Mode TCG dan bedanya dengan engine riset</summary>
        <ul>
          <li><strong>Deck:</strong> {{ config.copiesPerCharacter }} salinan tiap karakter faksi + {{ config.energyCards }} kartu energi faksi
            (Pokémon resmi memakai 60 kartu; di sini ukuran deck mengikuti jumlah karakter).</li>
          <li><strong>Setup:</strong> lempar koin, ambil {{ config.handSize }} kartu. Tidak ada karakter di tangan = mulligan (kocok ulang, ambil lagi) dan lawan
            boleh mengambil 1 kartu tambahan per mulligan. Pilih 1 karakter Aktif dan maksimal {{ config.benchCap }} di Bench (tertutup sampai kedua pemain selesai),
            lalu {{ config.prizeCards }} kartu teratas deck menjadi prize.</li>
          <li><strong>Giliran:</strong> ambil 1 kartu → mainkan karakter ke Bench (bebas) → tempel maksimal 1 energi ke karakter mana pun →
            retreat maksimal 1× (buang energi sebanyak retreat cost) → serang (giliran selesai) atau akhiri giliran.
            Pemain pertama tidak boleh menyerang di giliran pertamanya.</li>
          <li><strong>Biaya serangan:</strong> energi faksi (S/R/T) harus cocok; U (Universal) bisa dibayar energi apa pun. Energi <em>tidak</em> habis setelah menyerang.</li>
          <li><strong>Gugur (KO):</strong> karakter dan energinya masuk discard, lawan mengambil 1 prize ke tangannya, pemilik wajib memajukan karakter dari Bench.
            Recoil yang membuat penyerang gugur juga memberi lawan 1 prize.</li>
          <li><strong>Menang:</strong> ambil prize terakhir, lawan tidak punya karakter di Bench saat Aktifnya gugur, atau lawan tidak bisa mengambil kartu (deck habis).
            Pengaman: setelah {{ config.turnCap }} giliran, pemain dengan prize tersisa lebih sedikit menang (sama = seri).</li>
          <li><strong>Efek kartu</strong> sama dengan engine riset (Mill, Recoil, bonus Bench maks {{ config.benchScalingMax }}, bonus per kartu discard, damage reduction),
            kecuali <em>Heal</em>: di sini karakter Bench bisa terluka (setelah retreat), jadi Heal memulihkan karakter Bench yang paling terluka.</li>
          <li><strong>Engine riset berbeda:</strong> di sana energi (prana) dihasilkan otomatis dan habis dipakai, tidak ada draw per giliran, retreat, maupun keputusan pemain.</li>
        </ul>
        }
      </details>

      <ng-template #charTpl let-slot let-p="p" let-idx="idx">
        <div class="tcg-back tcg-back-lg" [class.bench]="idx >= 0" *ngIf="faceDown(p)" [title]="t('Tertutup sampai kedua pemain selesai setup', 'Face down until both players finish setup')"></div>
        <ng-container *ngIf="!faceDown(p)">
          <div class="tcg-slot-empty tcg-card" *ngIf="!slot">{{ t('belum ada', 'none yet') }}</div>
          <div class="tcg-card" *ngIf="slot" [class.bench]="idx >= 0" [class.target]="canAttachHere(p, idx)" [class.fx-glow]="fxOn('glow', slot.card.uid)">
            <span class="tcg-float" *ngFor="let f of cardFloats(slot.card.uid); let fi = index; trackBy: byId" [ngClass]="f.kind" [style.top.px]="floatTop(fi)">{{ f.text }}</span>
            <div class="tcg-card-head">
              <strong>{{ slot.card.def.name }}</strong>
              <span class="tcg-hp">{{ hp(slot) }}/{{ slot.card.def.hp }} HP</span>
            </div>
            <div class="tcg-hp-bar"><div [style.width.%]="hpPct(slot)" [ngClass]="hpClass(slot)"></div></div>
            <div class="tcg-energy-row">
              <span *ngFor="let e of slot.energies" class="tcg-energy" [ngClass]="'e-' + e.energyType" [title]="t('Energi ', 'Energy ') + e.energyType">{{ letter(e.energyType) }}</span>
              <span class="tcg-muted" *ngIf="slot.energies.length === 0">{{ t('tanpa energi', 'no energy') }}</span>
            </div>
            <div class="tcg-meta">
              Retreat {{ slot.card.def.retreat_cost }}<span *ngIf="slot.card.def.damage_reduction"> · DR {{ slot.card.def.damage_reduction }}</span>
            </div>
            <div class="tcg-attacks">
              <div class="tcg-attack" *ngFor="let a of slot.card.def.attacks; let ai = index">
                <div class="tcg-attack-head">
                  <span>{{ a.name }}</span>
                  <span class="tcg-cost">
                    <span *ngFor="let c of costList(a)" class="tcg-energy sm" [ngClass]="'e-' + c.type">{{ letter(c.type) }}</span>
                  </span>
                  <strong>{{ a.base_damage }}</strong>
                </div>
                <div class="tcg-attack-effect" *ngIf="effectText(a)">{{ effectText(a) }}</div>
                <ng-container *ngIf="idx === -1 && isHumanMain(p)">
                  <button type="button" class="tcg-mini-btn attack" [disabled]="!g.canAttack(p, ai)" (click)="act({ type: 'attack', attackIndex: ai })">
                    ⚔️ {{ t('Serang', 'Attack') }}: {{ g.previewDamage(p, a) }} damage
                  </button>
                  <div class="tcg-why" *ngIf="!g.canAttack(p, ai)">{{ attackBlockReason(p, ai) }}</div>
                </ng-container>
              </div>
            </div>
            <ng-container *ngIf="p === HUMAN && gameMode === 'human'">
              <button type="button" class="tcg-mini-btn energy" *ngIf="canAttachHere(p, idx)" (click)="attachTo(idx)">⚡ {{ t('Tempel energi di sini', 'Attach energy here') }}</button>
              <ng-container *ngIf="idx >= 0 && isHumanMain(p)">
                <button type="button" class="tcg-mini-btn" [disabled]="!g.canRetreat(p, idx)" (click)="act({ type: 'retreat', benchIndex: idx })">
                  ↔ {{ t('Retreat: majukan ini', 'Retreat: promote this one') }}
                </button>
                <div class="tcg-why" *ngIf="!g.canRetreat(p, idx)">{{ retreatBlockReason(p) }}</div>
              </ng-container>
              <button type="button" class="tcg-mini-btn attack" *ngIf="idx >= 0 && g.canPromote(p, idx)" (click)="act({ type: 'promote', benchIndex: idx })">
                ⬆ {{ t('Majukan jadi Aktif', 'Promote to Active') }}
              </button>
            </ng-container>
          </div>
        </ng-container>
      </ng-template>
    </ng-container>
  `,
  styles: [`
    :host { display: block; }
    .tcg-coin-icon { font-size: 32px; }
    .tcg-coin-label { font-size: 10px; font-weight: 800; color: #b45309; margin-top: 2px; max-width: 80px; text-align: center; line-height: 1.1; }
    .tcg-coin-title { color: #fff; font-size: 18px; margin: 0; text-shadow: 0 2px 8px rgba(0,0,0,0.6); }
    .tcg-coin-result { color: #fcd34d; font-size: 22px; margin: 0 0 4px; font-weight: 800; text-shadow: 0 2px 10px rgba(251,191,36,0.6); }
    .tcg-coin-sub { color: #fff; font-size: 13px; margin: 0; }

    .tcg-banner { position: fixed; left: 50%; top: 22%; z-index: 60; pointer-events: none; min-width: 220px;
      padding: 14px 28px; border-radius: 14px; background: rgba(15, 23, 42, 0.9); color: #fff; text-align: center;
      display: flex; flex-direction: column; gap: 2px; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.35);
      transform: translateX(-50%); animation: tcgBanner 1.4s ease-out forwards; }
    .tcg-banner strong { font-size: 22px; letter-spacing: -0.01em; }
    .tcg-banner span { font-size: 13px; opacity: 0.85; }
    .tcg-banner.b-win { background: linear-gradient(135deg, #047857, #10b981); animation-duration: 3.2s; }
    .tcg-banner.b-tie { background: #334155; animation-duration: 3.2s; }
    @keyframes tcgBanner {
      0% { opacity: 0; transform: translate(-50%, -12px) scale(0.92); }
      12% { opacity: 1; transform: translate(-50%, 0) scale(1); }
      80% { opacity: 1; transform: translate(-50%, 0) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -6px) scale(0.98); }
    }

    .tcg-caption-wrap { min-height: 38px; margin: -4px 0 12px; }
    .tcg-caption { padding: 8px 14px; border-radius: 8px; background: var(--bg-surface); border: 1px solid var(--border-color);
      border-left: 4px solid var(--primary-color); font-size: 13px; font-weight: 600; animation: tcgCaption 0.35s ease-out; }
    .tcg-caption.k-damage { border-left-color: var(--danger-color); }
    .tcg-caption.k-knockout { border-left-color: #0f172a; }
    .tcg-caption.k-energy { border-left-color: var(--warning-color); }
    .tcg-caption.k-prize { border-left-color: var(--success-color); }
    @keyframes tcgCaption { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

    .tcg-active-slot { position: relative; }
    .tcg-float { position: absolute; right: 8px; z-index: 5; pointer-events: none; white-space: nowrap;
      font-weight: 900; font-size: 13px; padding: 1px 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.18); animation: tcgFloat 1.6s ease-out forwards; }
    .tcg-float.big { font-size: 20px; padding: 2px 10px; }
    .tcg-float.damage { color: var(--danger-color); }
    .tcg-float.heal { color: var(--success-color); }
    .tcg-float.energy { color: #b45309; }
    .tcg-float.info { color: var(--primary-color); }
    .tcg-float.mill { color: #7c3aed; }
    .tcg-float.prize { color: #b45309; }
    .tcg-float.ko { color: #fff; background: #0f172a; }
    @keyframes tcgFloat {
      0% { opacity: 0; transform: translateY(8px) scale(0.8); }
      15% { opacity: 1; transform: translateY(-4px) scale(1.15); }
      75% { opacity: 1; transform: translateY(-22px) scale(1); }
      100% { opacity: 0; transform: translateY(-32px) scale(0.95); }
    }
    .fx-shake { animation: tcgShake 0.45s cubic-bezier(.36,.07,.19,.97) both; }
    .fx-shake .tcg-card { box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.55); }
    @keyframes tcgShake {
      10%, 90% { transform: translateX(-2px); }
      20%, 80% { transform: translateX(4px); }
      30%, 50%, 70% { transform: translateX(-6px); }
      40%, 60% { transform: translateX(6px); }
    }
    .fx-lunge-up { animation: tcgLungeUp 0.45s ease-out; }
    .fx-lunge-down { animation: tcgLungeDown 0.45s ease-out; }
    @keyframes tcgLungeUp { 40% { transform: translateY(-18px) scale(1.03); } }
    @keyframes tcgLungeDown { 40% { transform: translateY(18px) scale(1.03); } }
    .fx-ko { animation: tcgKo 0.9s ease-out; }
    @keyframes tcgKo { 0% { filter: none; } 30% { filter: grayscale(1) brightness(0.6); transform: scale(0.96); } 100% { filter: none; } }
    .fx-pulse { animation: tcgPulse 0.8s ease-out; }
    @keyframes tcgPulse { 30% { transform: scale(1.12); background: rgba(245, 158, 11, 0.2); } }
    .fx-glow { animation: tcgGlow 0.9s ease-out; }
    @keyframes tcgGlow { 30% { box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.45); } }
    .tcg-counter { position: relative; }
    @media (prefers-reduced-motion: reduce) {
      .tcg-float, .tcg-banner, .tcg-caption, .fx-shake, .fx-lunge-up, .fx-lunge-down, .fx-ko, .fx-pulse, .fx-glow { animation: none !important; }
    }
    .tcg-controls { margin-bottom: 16px; padding: 16px 20px; }
    .tcg-controls h2 { display: flex; align-items: center; gap: 8px; font-size: 18px; }
    .tcg-note { border: 1px solid var(--border-color); border-radius: 8px; margin: 8px 0 12px; }
    .tcg-note-diff { display: block; margin-top: 4px; color: var(--text-main); }
    .tcg-control-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; margin-top: 8px; }
    .tcg-control-row label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 600; color: var(--text-muted); }
    .tcg-control-row .md-select, .tcg-control-row .md-input { height: 36px; font-size: 12px; min-width: 110px; }
    .tcg-seed { width: 120px; }
    .tcg-hint { font-size: 11px; color: var(--text-muted); max-width: 520px; }
    .tcg-segmented { display: inline-flex; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; height: 36px; }
    .tcg-segmented button { border: 0; background: var(--bg-surface); padding: 0 14px; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--text-muted); }
    .tcg-segmented button.on { background: var(--primary-color); color: #fff; }
    .tcg-lobby { text-align: center; padding: 32px 24px; }
    .tcg-lobby-coin { font-size: 40px; line-height: 1; margin-bottom: 8px; }
    .tcg-lobby p { max-width: 560px; margin: 0 auto 16px; }
    .tcg-lobby-start { height: 44px; padding: 0 28px; font-size: 15px; }
    .tcg-pending-note { margin-top: 10px; font-size: 12px; color: #92400e; background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 8px; padding: 6px 10px; }
    .tcg-arena { position: relative; scroll-margin-top: 12px; }
    .tcg-coin-overlay { position: absolute; inset: -6px; z-index: 40; border-radius: 14px; cursor: pointer;
      background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      display: flex; justify-content: center; align-items: flex-start; padding-top: 120px; }

    .tcg-status { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 12px 16px; margin-bottom: 12px;
      border-radius: 10px; border: 1px solid var(--border-color); background: var(--bg-surface); }
    .tcg-status.mine { border-color: var(--primary-color); background: rgba(79, 70, 229, 0.05); }
    .tcg-status.over { border-color: var(--success-color); background: rgba(16, 185, 129, 0.07); }
    .tcg-status-text { font-weight: 700; font-size: 14px; flex: 1 1 320px; }
    .tcg-checklist { display: flex; gap: 6px; flex-wrap: wrap; font-size: 11px; }
    .tcg-checklist span { padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border-color); color: var(--text-muted); }
    .tcg-checklist span.done { color: var(--success-color); border-color: rgba(16, 185, 129, 0.4); }
    .tcg-checklist span.locked { color: var(--danger-color); border-color: rgba(239, 68, 68, 0.3); }
    .tcg-status-actions { display: flex; gap: 8px; }
    .tcg-error { flex-basis: 100%; color: var(--danger-color); font-size: 12px; font-weight: 600; }

    .tcg-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 12px; align-items: start; }
    @media (max-width: 1200px) { .tcg-layout { grid-template-columns: 1fr; } }
    .tcg-board { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
    .tcg-side { padding: 12px 14px; }
    .tcg-side.is-turn { border-color: var(--primary-color); box-shadow: 0 0 0 1px var(--primary-color); }
    .tcg-side-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; margin-bottom: 8px; }
    .tcg-side-name { font-weight: 800; font-size: 14px; }
    .tcg-counters { display: flex; flex-wrap: wrap; gap: 6px; font-size: 11px; }
    .tcg-counter { padding: 2px 8px; border-radius: 6px; background: var(--bg-primary); border: 1px solid var(--border-color); display: inline-flex; gap: 4px; align-items: center; }
    .tcg-counter small { color: var(--text-muted); }
    .tcg-prize-backs { display: inline-flex; gap: 2px; }
    .tcg-prize-backs i { width: 8px; height: 11px; border-radius: 2px; background: linear-gradient(135deg, #b45309, #f59e0b); display: inline-block; }

    .tcg-zones { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 12px; }
    @media (max-width: 720px) { .tcg-zones { grid-template-columns: 1fr; } }
    .tcg-zone-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-light); margin-bottom: 4px; }
    .tcg-bench-row, .tcg-hand-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .tcg-card { border: 1px solid var(--border-color); border-radius: 10px; padding: 8px; background: var(--bg-surface); font-size: 12px;
      display: flex; flex-direction: column; gap: 4px; box-sizing: border-box; position: relative; }
    .tcg-zone-active .tcg-card { width: 100%; min-height: 120px; }
    .tcg-card.bench { width: 170px; }
    .tcg-card.target { border-color: var(--warning-color); box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.35); }
    .tcg-card-head { display: flex; justify-content: space-between; gap: 6px; }
    .tcg-hp { font-weight: 700; font-size: 11px; white-space: nowrap; }
    .tcg-hp-bar { height: 5px; border-radius: 3px; background: var(--border-color); overflow: hidden; }
    .tcg-hp-bar div { height: 100%; }
    .tcg-hp-bar .ok { background: var(--success-color); }
    .tcg-hp-bar .mid { background: var(--warning-color); }
    .tcg-hp-bar .low { background: var(--danger-color); }
    .tcg-energy-row { display: flex; flex-wrap: wrap; gap: 3px; min-height: 18px; align-items: center; }
    .tcg-muted { color: var(--text-light); font-size: 11px; }
    .tcg-meta { font-size: 11px; color: var(--text-muted); }
    .tcg-energy { width: 16px; height: 16px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
      font-size: 9px; font-weight: 800; color: #fff; flex: none; }
    .tcg-energy.sm { width: 13px; height: 13px; font-size: 8px; }
    .tcg-energy.big { width: 22px; height: 22px; font-size: 11px; }
    .e-Satwika { background: var(--primary-color); }
    .e-Rajasika { background: var(--warning-color); }
    .e-Tamasika { background: var(--danger-color); }
    .e-Universal { background: var(--text-light); }
    .tcg-attacks { display: flex; flex-direction: column; gap: 4px; border-top: 1px dashed var(--border-color); padding-top: 4px; }
    .tcg-attack-head { display: flex; align-items: center; gap: 6px; }
    .tcg-attack-head span:first-child { flex: 1; font-weight: 600; }
    .tcg-cost { display: inline-flex; gap: 2px; }
    .tcg-attack-effect { font-size: 10px; color: var(--text-muted); }
    .tcg-mini-btn { font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 6px; cursor: pointer;
      border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-main); }
    .tcg-mini-btn:hover:not(:disabled) { border-color: var(--primary-color); color: var(--primary-color); }
    .tcg-mini-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .tcg-mini-btn.attack { background: var(--primary-color); border-color: var(--primary-color); color: #fff; }
    .tcg-mini-btn.attack:hover:not(:disabled) { background: var(--primary-hover); color: #fff; }
    .tcg-mini-btn.energy { background: rgba(245, 158, 11, 0.12); border-color: var(--warning-color); }
    .tcg-why { font-size: 10px; color: var(--text-muted); }
    .tcg-slot-empty { color: var(--text-light); font-size: 11px; border: 1px dashed var(--border-color); border-radius: 10px; padding: 12px; text-align: center; }

    .tcg-hand { margin-top: 10px; }
    .tcg-hand-card { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 96px; padding: 6px 8px;
      border: 1px solid var(--border-color); border-radius: 8px; font-size: 11px; background: var(--bg-surface); }
    .tcg-hand-card.energy { background: var(--bg-primary); }
    .tcg-hand-card.selected { border-color: var(--warning-color); box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.35); }
    .tcg-back { width: 34px; height: 46px; border-radius: 5px; background: repeating-linear-gradient(45deg, #1e293b, #1e293b 4px, #334155 4px, #334155 8px); border: 2px solid #475569; }
    .tcg-back-lg { width: 100%; height: 120px; box-sizing: border-box; }
    .tcg-back-lg.bench { width: 170px; }

    .tcg-log { padding: 12px; position: sticky; top: 12px; }
    .tcg-log h3 { font-size: 14px; }
    .tcg-log-box { max-height: 640px; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; font-size: 11px; }
    .tcg-log-line { display: flex; gap: 6px; line-height: 1.4; }
    .tcg-log-line em { color: var(--text-muted); }
    .tcg-log-turn { color: var(--text-light); font-variant-numeric: tabular-nums; flex: none; width: 30px; }
    .k-damage { color: #b91c1c; }
    .k-knockout { color: var(--danger-color); font-weight: 700; }
    .k-prize { color: var(--success-color); font-weight: 800; }
    .k-energy { color: #92400e; }
    .tcg-rules { margin-top: 12px; padding: 12px 16px; font-size: 12px; }
    .tcg-rules summary { cursor: pointer; font-weight: 700; }
    .tcg-rules li { margin: 4px 0; color: var(--text-muted); }
    .tcg-rules li strong { color: var(--text-main); }
  `],
})
export class TcgModeComponent implements OnInit, OnDestroy, AfterViewChecked {
  readonly HUMAN = HUMAN;
  readonly config = TCG_MODE_CONFIG;
  readonly factions: Faction[] = ['SATWIKA', 'RAJASIKA', 'TAMASIKA'];
  readonly factionLabel = FACTION_LABEL;
  readonly speeds = Object.keys(BOT_DELAY_MS);
  /** Player 2 on top, player 1 (you) at the bottom. */
  readonly boardOrder = [1, 0];

  playMode: PlayMode = 'human';
  /** Mode of the game on the board (playMode only takes effect on restart). */
  gameMode: PlayMode = 'human';
  p1Faction: Faction = 'SATWIKA';
  p2Faction: Faction = 'TAMASIKA';
  seed = randomSeed();
  speed = DEFAULT_SPEED;
  game: TcgGame | null = null;
  autoRunning = false;
  selectedEnergy: number | null = null;
  actionError: string | null = null;
  paramsReady = false;
  loadError: string | null = null;

  // Effects: derived from the engine's structured log events (TcgLog.fx), never from parsing text.
  soundOn = true;
  coin: { player: number; names: string[]; landed: boolean } | null = null;
  bannerList: Banner[] = [];
  captionList: Caption[] = [];
  floats: Float[] = [];

  @ViewChild('logBox') private logBox?: ElementRef<HTMLElement>;
  @ViewChild('arena') private arena?: ElementRef<HTMLElement>;
  /** Settings the game on the board was started with. */
  private started: TcgMatchSettings | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private subs: Subscription[] = [];
  private scrolledLogLength = 0;
  private fxKeys = new Set<string>();
  private fxTimers = new Set<ReturnType<typeof setTimeout>>();
  private fxIndex = 0;
  private fxSeq = 0;
  private nextPause = 1;
  private coinUntil = 0;

  readonly i18n = inject(LanguageService);
  readonly t = this.i18n.t;

  constructor(private sandbox: SandboxService, private sound: SoundService, private session: TcgModeSession) {}

  speedLabel(speed: string): string {
    const label = SPEED_LABEL[speed];
    return label ? this.t(label[0], label[1]) : speed;
  }

  ngOnInit(): void {
    this.restoreSession();
    this.subs.push(
      this.sandbox.getParams().subscribe((params) => this.paramsReady = !!params),
      this.sandbox.getLoadError().subscribe((err) => this.loadError = err),
    );
  }

  ngAfterViewChecked(): void {
    const box = this.logBox?.nativeElement;
    const length = this.game?.log.length ?? 0;
    if (box && length !== this.scrolledLogLength) {
      box.scrollTop = box.scrollHeight;
      this.scrolledLogLength = length;
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.clearFx();
    this.subs.forEach((s) => s.unsubscribe());
    this.session.snapshot = {
      settings: this.currentSettings(), speed: this.speed, soundOn: this.soundOn, game: this.game, started: this.started,
    };
  }

  /** Continues the match left when the user navigated away; its past events are not replayed. */
  private restoreSession(): void {
    const snap = this.session.snapshot;
    if (!snap) return;
    ({ playMode: this.playMode, p1Faction: this.p1Faction, p2Faction: this.p2Faction, seed: this.seed } = snap.settings);
    this.speed = snap.speed;
    this.soundOn = snap.soundOn;
    this.game = snap.game;
    this.started = snap.started;
    if (!this.game || !this.started) return;
    this.gameMode = this.started.playMode;
    this.fxIndex = this.game.log.length;
    // Bot vs Bot resumes paused; in Kamu vs Bot a waiting bot carries on.
    this.scheduleBot();
  }

  // ---------------------------------------------------------------- game control

  start(): void {
    this.stopTimer();
    this.clearFx();
    this.sound.init();
    this.autoRunning = false;
    this.selectedEnergy = null;
    this.actionError = null;
    const deck1 = this.sandbox.getDeck(this.p1Faction);
    const deck2 = this.sandbox.getDeck(this.p2Faction);
    if (!deck1 || !deck2) return;
    this.started = this.currentSettings();
    this.gameMode = this.playMode;
    const [n1, n2] = this.gameMode === 'human' ? [this.t('Kamu', 'You'), 'Bot'] : ['Bot A', 'Bot B'];
    try {
      this.game = new TcgGame(deck1, deck2,
        `${n1} (${FACTION_LABEL[this.p1Faction]})`, `${n2} (${FACTION_LABEL[this.p2Faction]})`,
        mulberry32(this.started.seed));
    } catch (e) {
      this.game = null;
      this.actionError = (e as Error).message;
      return;
    }
    this.scrolledLogLength = 0;
    // Bot vs Bot runs by itself once the coin has landed.
    this.autoRunning = this.gameMode === 'bots';
    this.processFx();
    this.scheduleBot();
    this.later(() => this.arena?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  /** Starts a new match with a fresh seed (used after a match ends). */
  newSeed(): void {
    this.randomizeSeed();
    this.start();
  }

  randomizeSeed(): void {
    this.seed = randomSeed();
  }

  /** True when the controls no longer match the match on the board. */
  settingsChanged(): boolean {
    const now = this.currentSettings();
    const s = this.started;
    return !!s && (s.playMode !== now.playMode || s.p1Faction !== now.p1Faction || s.p2Faction !== now.p2Faction || s.seed !== now.seed);
  }

  private currentSettings(): TcgMatchSettings {
    return { playMode: this.playMode, p1Faction: this.p1Faction, p2Faction: this.p2Faction, seed: Math.trunc(Number(this.seed)) >>> 0 };
  }

  toggleSound(): void {
    this.soundOn = !this.soundOn;
    this.sound.init();
  }

  skipCoin(): void {
    this.coin = null;
    this.coinUntil = 0;
    if (this.timer) this.scheduleBot();
  }

  toggleAuto(): void {
    this.sound.init();
    this.autoRunning = !this.autoRunning;
    if (this.autoRunning) this.scheduleBot();
    else this.stopTimer();
  }

  onSpeedChange(): void {
    if (this.timer) this.scheduleBot();
  }

  /** Applies one action for the first bot the game is waiting on. */
  botStep(): void {
    const g = this.game;
    if (!g) return;
    const p = g.waitingFor().find((x) => this.isBot(x));
    if (p === undefined) return;
    try {
      if (g.phase === 'setup') {
        // Setup is simultaneous and face down, so each bot places its whole setup in one step.
        for (const b of g.waitingFor().filter((x) => this.isBot(x))) {
          while (g.phase === 'setup' && !g.players[b].setupDone) g.apply(b, chooseBotAction(g, b));
        }
      } else {
        g.apply(p, chooseBotAction(g, p));
      }
    } catch (e) {
      this.actionError = this.t('Bot melakukan aksi tidak sah', 'The bot made an illegal action') + `: ${(e as Error).message}`;
      this.autoRunning = false;
      return;
    }
    this.processFx();
    this.scheduleBot();
  }

  /** Applies an action for the human player. */
  act(action: TcgAction): void {
    const g = this.game;
    if (!g) return;
    this.actionError = null;
    try {
      g.apply(HUMAN, action);
    } catch (e) {
      this.actionError = (e as Error).message;
      return;
    }
    this.selectedEnergy = null;
    this.processFx();
    this.scheduleBot();
  }

  private scheduleBot(): void {
    this.stopTimer();
    const g = this.game;
    if (!g || g.phase === 'over') {
      this.autoRunning = false;
      return;
    }
    if (!g.waitingFor().some((p) => this.isBot(p))) return;
    if (this.gameMode === 'bots' && !this.autoRunning) return;
    const delay = Math.max(BOT_DELAY_MS[this.speed] * this.nextPause, this.coinUntil - Date.now());
    this.timer = setTimeout(() => {
      this.timer = null;
      this.botStep();
    }, delay);
  }

  private stopTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private isBot(p: number): boolean {
    return this.gameMode === 'bots' || p !== HUMAN;
  }

  // ---------------------------------------------------------------- human input

  humanWaiting(): boolean {
    return !!this.game && this.gameMode === 'human' && this.game.waitingFor().includes(HUMAN);
  }

  humanCan(what: 'endTurn' | 'setupDone'): boolean {
    const g = this.game;
    if (!g || this.gameMode !== 'human') return false;
    return what === 'endTurn' ? g.canEndTurn(HUMAN) : g.canSetupDone(HUMAN);
  }

  isHumanMain(p: number): boolean {
    return p === HUMAN && this.gameMode === 'human' && !!this.game && this.game.phase === 'main' && this.game.current === HUMAN;
  }

  handAction(i: number): HandAction | null {
    const g = this.game!;
    const pl = g.players[HUMAN];
    const card = pl.hand[i];
    if (g.phase === 'setup' && !pl.setupDone) {
      if (!isCharacter(card)) return null;
      if (!pl.active) return { label: this.t('Jadikan Aktif', 'Make Active'), enabled: g.canSetupActive(HUMAN, i) };
      return { label: pl.bench.length < this.config.benchCap ? this.t('Taruh di Bench', 'Put on Bench') : this.t('Bench penuh', 'Bench full'), enabled: g.canSetupBench(HUMAN, i) };
    }
    if (!this.isHumanMain(HUMAN)) return null;
    if (isCharacter(card)) {
      return { label: g.canPlayBasic(HUMAN, i) ? this.t('Mainkan ke Bench', 'Play to Bench') : this.t('Bench penuh', 'Bench full'), enabled: g.canPlayBasic(HUMAN, i) };
    }
    if (g.energyAttached) return { label: this.t('Sudah tempel energi giliran ini', 'Energy already attached this turn'), enabled: false };
    return { label: this.selectedEnergy === i ? this.t('Batal pilih', 'Deselect') : this.t('Pilih untuk ditempel', 'Select to attach'), enabled: true };
  }

  onHandClick(i: number): void {
    const g = this.game!;
    const pl = g.players[HUMAN];
    const card = pl.hand[i];
    if (g.phase === 'setup') {
      this.act(pl.active ? { type: 'setupBench', handIndex: i } : { type: 'setupActive', handIndex: i });
    } else if (isCharacter(card)) {
      this.act({ type: 'playBasic', handIndex: i });
    } else {
      this.selectedEnergy = this.selectedEnergy === i ? null : i;
    }
  }

  canAttachHere(p: number, target: number): boolean {
    return p === HUMAN && this.gameMode === 'human' && this.selectedEnergy !== null
      && !!this.game && this.game.canAttachEnergy(HUMAN, this.selectedEnergy, target);
  }

  attachTo(target: number): void {
    if (this.selectedEnergy === null) return;
    this.act({ type: 'attachEnergy', handIndex: this.selectedEnergy, target });
  }

  attackBlockReason(p: number, attackIndex: number): string {
    const g = this.game!;
    const active = g.players[p].active!;
    const attack = active.card.def.attacks[attackIndex];
    if (g.isFirstTurn()) return this.t('Giliran pertama: pemain yang jalan duluan belum boleh menyerang.', 'First turn: the player who goes first may not attack yet.');
    if (!costMet(attack.prana_cost ?? {}, active.energies)) return this.t(`Energi kurang: butuh ${this.costText(attack)}.`, `Not enough energy: needs ${this.costText(attack)}.`);
    return '';
  }

  retreatBlockReason(p: number): string {
    const g = this.game!;
    if (g.retreated) return this.t('Retreat sudah dipakai giliran ini.', 'Retreat already used this turn.');
    const active = g.players[p].active;
    return active
      ? this.t(`Aktif butuh ${active.card.def.retreat_cost} energi untuk retreat (punya ${active.energies.length}).`,
        `The Active needs ${active.card.def.retreat_cost} energy to retreat (has ${active.energies.length}).`)
      : '';
  }

  // ---------------------------------------------------------------- effects

  /** Turns the log entries added since the last call into animations, captions and sound, and sets the next bot pause. */
  private processFx(): void {
    const g = this.game;
    if (!g) return;
    let pause = 1;
    for (; this.fxIndex < g.log.length; this.fxIndex++) {
      const entry = g.log[this.fxIndex];
      const fx = entry.fx;
      if (CAPTION_KINDS.includes(entry.kind) || fx?.type === 'pass') {
        this.captionList = [{ id: ++this.fxSeq, text: entry.message, kind: entry.kind }];
      }
      if (!fx) continue;
      pause = Math.max(pause, PAUSE_AFTER[fx.type] ?? 1);
      switch (fx.type) {
        case 'coin': this.showCoin(fx.player); break;
        case 'turn': this.banner(this.t(`Giliran ${entry.turn}`, `Turn ${entry.turn}`), g.players[fx.player].name, 'turn', FX_MS.banner); break;
        case 'play': this.cardFx(fx.uid, fx.player, this.t('＋ masuk Bench', '＋ to Bench'), 'info'); this.sfx(() => this.sound.playCardPlay()); break;
        case 'energy': this.cardFx(fx.uid, fx.player, `+⚡ ${this.letter(fx.energyType)}`, 'energy'); this.sfx(() => this.sound.playCardPlay()); break;
        case 'retreat': this.cardFx(fx.uid, fx.player, this.t('↔ maju (retreat)', '↔ steps up (retreat)'), 'info'); this.sfx(() => this.sound.playCardPlay()); break;
        case 'promote': this.cardFx(fx.uid, fx.player, this.t('⬆ jadi Aktif', '⬆ now Active'), 'info'); this.sfx(() => this.sound.playCardPlay()); break;
        case 'pass': this.addFloat(fx.player, null, 'active', this.t('⏭ lewat', '⏭ pass'), 'info'); break;
        case 'hit':
          if (fx.by !== fx.player) this.flash(`lunge-${fx.by}`, FX_MS.lunge);
          this.flash(`shake-${fx.player}`, FX_MS.shake);
          this.addFloat(fx.player, null, 'active', fx.by === fx.player ? `-${fx.amount} recoil` : `-${fx.amount}`, 'damage');
          this.sfx(() => this.sound.playAttack());
          break;
        case 'heal': this.cardFx(fx.uid, fx.player, `+${fx.amount} HP`, 'heal'); this.sfx(() => this.sound.playHeal()); break;
        case 'mill':
          this.flash(`pulse-deck-${fx.player}`, FX_MS.pulse);
          this.addFloat(fx.player, null, 'deck', this.t(`-${fx.count} kartu (Mill)`, `-${fx.count} cards (Mill)`), 'mill');
          break;
        case 'ko': {
          const taker = g.opponentOf(fx.player);
          this.flash(`ko-${fx.player}`, FX_MS.ko);
          this.addFloat(fx.player, null, 'active', '💥 KO!', 'ko');
          this.flash(`pulse-prize-${taker}`, FX_MS.pulse);
          this.addFloat(taker, null, 'prize', '+1 prize', 'prize');
          break;
        }
        case 'win':
          this.banner(this.t(`🏆 ${g.players[fx.player].name} menang`, `🏆 ${g.players[fx.player].name} wins`), g.endReason, 'win', FX_MS.endBanner);
          this.sfx(() => this.sound.playVictory());
          break;
        case 'tie': this.banner(this.t('Seri', 'Draw'), g.endReason, 'tie', FX_MS.endBanner); break;
      }
    }
    this.nextPause = pause;
  }

  private showCoin(player: number): void {
    const names = this.game!.players.map((pl) => pl.name.split(' (')[0]);
    this.coin = { player, names, landed: false };
    this.coinUntil = Date.now() + FX_MS.coinSpin + FX_MS.coinResult;
    this.sfx(() => this.sound.playCoinToss());
    this.later(() => { if (this.coin) this.coin.landed = true; }, FX_MS.coinSpin);
    this.later(() => { this.coin = null; }, FX_MS.coinSpin + FX_MS.coinResult);
  }

  private banner(title: string, sub: string, kind: Banner['kind'], ms: number): void {
    const b = { id: ++this.fxSeq, title, sub, kind };
    this.bannerList = [b];
    this.later(() => { this.bannerList = this.bannerList.filter((x) => x !== b); }, ms);
  }

  private cardFx(uid: number, player: number, text: string, kind: string): void {
    this.flash(`glow-${uid}`, FX_MS.glow);
    this.addFloat(player, uid, 'card', text, kind);
  }

  private addFloat(player: number, uid: number | null, target: Float['target'], text: string, kind: string): void {
    const f: Float = { id: ++this.fxSeq, player, uid, target, text, kind };
    this.floats = [...this.floats, f];
    this.later(() => { this.floats = this.floats.filter((x) => x !== f); }, FX_MS.float);
  }

  /** Adds a CSS-class key for `ms`, restarting the animation if it is already running. */
  private flash(key: string, ms: number): void {
    this.fxKeys.delete(key);
    this.later(() => {
      this.fxKeys.add(key);
      this.later(() => this.fxKeys.delete(key), ms);
    }, 0);
  }

  private sfx(play: () => void): void {
    if (this.soundOn) play();
  }

  private later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      this.fxTimers.delete(t);
      fn();
    }, ms);
    this.fxTimers.add(t);
  }

  private clearFx(): void {
    this.fxTimers.forEach((t) => clearTimeout(t));
    this.fxTimers.clear();
    this.fxKeys.clear();
    this.floats = [];
    this.bannerList = [];
    this.captionList = [];
    this.coin = null;
    this.coinUntil = 0;
    this.fxIndex = 0;
    this.nextPause = 1;
  }

  fxOn(kind: string, id: number): boolean {
    return this.fxKeys.has(`${kind}-${id}`);
  }

  activeFxClasses(p: number): { [cls: string]: boolean } {
    const lunge = this.fxOn('lunge', p);
    return {
      'fx-shake': this.fxOn('shake', p),
      'fx-ko': this.fxOn('ko', p),
      // Player 2 sits on top and attacks downward; player 1 attacks upward.
      'fx-lunge-down': lunge && p === 1,
      'fx-lunge-up': lunge && p === 0,
    };
  }

  /** Active animations as text, for tests. */
  activeFxAttr(p: number): string {
    return ['shake', 'ko', 'lunge'].filter((k) => this.fxOn(k, p)).join(' ');
  }

  zoneFloats(p: number): Float[] {
    return this.floats.filter((f) => f.target === 'active' && f.player === p);
  }

  cardFloats(uid: number): Float[] {
    return this.floats.filter((f) => f.target === 'card' && f.uid === uid);
  }

  counterFloats(p: number, target: 'deck' | 'prize'): Float[] {
    return this.floats.filter((f) => f.target === target && f.player === p);
  }

  /** Stacks simultaneous floats on one element so they don't overlap. */
  floatTop(i: number): number {
    return -8 + i * 24;
  }

  byId(_: number, item: { id: number }): number {
    return item.id;
  }

  // ---------------------------------------------------------------- display

  statusText(): string {
    const g = this.game!;
    const t = this.t;
    const name = (p: number) => g.players[p].name;
    if (g.phase === 'over') {
      return g.isDraw ? t(`Seri. ${g.endReason}`, `Draw. ${g.endReason}`) : t(`🏆 ${name(g.winner!)} menang. ${g.endReason}`, `🏆 ${name(g.winner!)} wins. ${g.endReason}`);
    }
    if (this.gameMode === 'bots' && !this.autoRunning) {
      return t(`⏸ Dijeda (giliran ${g.turn}). Tekan "Jalan otomatis" untuk melanjutkan, atau "Satu aksi" untuk maju satu langkah.`,
        `⏸ Paused (turn ${g.turn}). Press "Run automatically" to continue, or "One action" to advance one step.`);
    }
    if (g.phase === 'setup') {
      if (this.gameMode === 'bots') return t('Setup: kedua bot memilih karakter Aktif dan Bench.', 'Setup: both bots choose their Active and Bench characters.');
      const me = g.players[HUMAN];
      if (me.setupDone) return t('Menunggu bot selesai setup…', 'Waiting for the bot to finish setup…');
      if (me.mulligans > 0 && !me.active) {
        return t(`Kamu mulligan ${me.mulligans}× (tidak ada karakter di tangan). Pilih karakter Aktif.`,
          `You mulliganed ${me.mulligans}× (no character in hand). Choose an Active character.`);
      }
      return me.active
        ? t('Setup: taruh karakter lain di Bench bila mau, lalu tekan "Selesai setup".', 'Setup: put other characters on the Bench if you like, then press "Finish setup".')
        : t('Setup: klik "Jadikan Aktif" pada salah satu karakter di tanganmu.', 'Setup: click "Make Active" on one of the characters in your hand.');
    }
    if (g.phase === 'promote') {
      const p = g.waitingFor()[0];
      return this.gameMode === 'human' && p === HUMAN
        ? t('Karaktermu gugur. Pilih "Majukan jadi Aktif" pada salah satu kartu Bench.', 'Your character was knocked out. Choose "Promote to Active" on one of your Bench cards.')
        : t(`${name(p)} memajukan karakter dari Bench…`, `${name(p)} is promoting a character from the Bench…`);
    }
    if (this.gameMode === 'human' && g.current === HUMAN) {
      return this.selectedEnergy !== null
        ? t(`Giliran ${g.turn} — giliranmu. Klik "Tempel energi di sini" pada karakter tujuan.`, `Turn ${g.turn} — your turn. Click "Attach energy here" on the target character.`)
        : t(`Giliran ${g.turn} — giliranmu. Mainkan kartu, tempel energi, lalu serang atau akhiri giliran.`, `Turn ${g.turn} — your turn. Play cards, attach energy, then attack or end your turn.`);
    }
    return t(`Giliran ${g.turn} — ${name(g.current)} sedang berpikir…`, `Turn ${g.turn} — ${name(g.current)} is thinking…`);
  }

  isTurnOf(p: number): boolean {
    const g = this.game!;
    return (g.phase === 'main' && g.current === p) || (g.phase === 'promote' && g.waitingFor()[0] === p);
  }

  handVisible(p: number): boolean {
    return this.gameMode === 'bots' || p === HUMAN;
  }

  /** The opponent's setup is placed face down until both players are ready. */
  faceDown(p: number): boolean {
    return this.gameMode === 'human' && p !== HUMAN && this.game!.phase === 'setup';
  }

  showSecret(e: TcgLog): boolean {
    return !!e.secret && e.player !== null && this.handVisible(e.player);
  }

  discardCharacters(p: number): number {
    return this.game!.players[p].discard.filter(isCharacter).length;
  }

  charDef(card: unknown) {
    return (card as { def: InPlay['card']['def'] }).def;
  }

  hp(slot: InPlay): number {
    return Math.max(0, remainingHp(slot));
  }

  hpPct(slot: InPlay): number {
    return (this.hp(slot) / slot.card.def.hp) * 100;
  }

  hpClass(slot: InPlay): string {
    const pct = this.hpPct(slot);
    return pct > 50 ? 'ok' : pct > 25 ? 'mid' : 'low';
  }

  letter(type: string): string {
    return ENERGY_LETTER[type] ?? '?';
  }

  costList(attack: AttackDef): { type: string }[] {
    const chips: { type: string }[] = [];
    const cost = attack.prana_cost ?? {};
    for (const type of Object.keys(cost).sort((a, b) => Number(a === 'Universal') - Number(b === 'Universal'))) {
      for (let i = 0; i < cost[type]; i++) chips.push({ type });
    }
    return chips;
  }

  costText(attack: AttackDef): string {
    return Object.entries(attack.prana_cost ?? {}).filter(([, n]) => n > 0).map(([type, n]) => `${n} ${type}`).join(' + ') || this.t('gratis', 'free');
  }

  effectText(attack: AttackDef): string {
    const v = attack.value ?? 0;
    switch (attack.effect) {
      case 'mill_enemy_deck': return this.t(`Mill: buang ${v} kartu teratas deck lawan.`, `Mill: discard the top ${v} cards of the opponent deck.`);
      case 'recoil_damage': return this.t(`Recoil: penyerang menerima ${v} damage.`, `Recoil: the attacker takes ${v} damage.`);
      case 'heal_bench_card': return this.t(`Heal: pulihkan ${v} HP karakter Bench yang paling terluka.`, `Heal: restore ${v} HP to the most damaged Bench character.`);
      case 'scaled_damage_per_discard_tamasika': return this.t(`+${attack.scale_value ?? 0} damage per kartu di discard lawan.`, `+${attack.scale_value ?? 0} damage per card in the opponent discard.`);
    }
    if (attack.bench_scaling) {
      return this.t(`+${this.config.benchScalingPerCard} per karakter di Bench-mu (maks +${this.config.benchScalingMax}).`,
        `+${this.config.benchScalingPerCard} per character on your Bench (max +${this.config.benchScalingMax}).`);
    }
    return '';
  }
}
