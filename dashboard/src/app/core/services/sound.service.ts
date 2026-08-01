import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  private audioCtx: AudioContext | null = null;

  constructor() {
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  public init() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, vol: number = 0.1) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

    gainNode.gain.setValueAtTime(vol, this.audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    osc.start();
    osc.stop(this.audioCtx.currentTime + duration);
  }

  public playCardPlay() {
    this.playTone(400, 'sine', 0.1, 0.2);
    setTimeout(() => this.playTone(600, 'sine', 0.2, 0.2), 50);
  }

  public playAttack() {
    // A noise-like crash sound or low frequency punch
    this.playTone(100, 'square', 0.3, 0.4);
    setTimeout(() => this.playTone(50, 'sawtooth', 0.2, 0.4), 50);
  }

  public playHeal() {
    // Ascending chime
    this.playTone(400, 'sine', 0.3, 0.1);
    setTimeout(() => this.playTone(600, 'sine', 0.3, 0.1), 100);
    setTimeout(() => this.playTone(800, 'sine', 0.4, 0.1), 200);
  }

  public playCoinToss() {
    this.playTone(800, 'sine', 0.1, 0.1);
    setTimeout(() => this.playTone(850, 'sine', 0.1, 0.1), 100);
    setTimeout(() => this.playTone(900, 'sine', 0.1, 0.1), 200);
    setTimeout(() => this.playTone(1200, 'triangle', 0.4, 0.2), 300); // Result lands
  }

  public playVictory() {
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.5, 0.2), i * 150);
    });
  }
}
