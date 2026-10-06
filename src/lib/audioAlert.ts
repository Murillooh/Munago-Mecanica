// Audio alert generator using Web Audio API (gentle, harmonic notification chimes)

class SoundAlertManager {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /**
   * Plays a smooth, gentle two-tone harmonic chime for low stock alerts.
   * Designed to be subtle, professional, and pleasant.
   */
  public playLowStockChime(volume: number = 0.25) {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Master gain node with smooth fade-out
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(Math.min(0.4, Math.max(0.05, volume)), now + 0.04);
      masterGain.connect(ctx.destination);

      // Lowpass filter for smooth warmth (anti-harshness)
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.connect(masterGain);

      // Note 1: Soft warm base tone (523.25 Hz - C5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      osc1.frequency.exponentialRampToValueAtTime(530, now + 0.3);

      gain1.gain.setValueAtTime(0.7, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(filter);

      osc1.start(now);
      osc1.stop(now + 0.5);

      // Note 2: Harmonic pleasant chime (783.99 Hz - G5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.12);
      osc2.frequency.exponentialRampToValueAtTime(790, now + 0.55);

      gain2.gain.setValueAtTime(0, now);
      gain2.gain.setValueAtTime(0.8, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(filter);

      osc2.start(now + 0.12);
      osc2.stop(now + 0.75);

      // Note 3: Sub-harmonic sparkle (1046.50 Hz - C6, very subtle)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(1046.50, now + 0.15);

      gain3.gain.setValueAtTime(0, now);
      gain3.gain.setValueAtTime(0.3, now + 0.15);
      gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
      osc3.connect(gain3);
      gain3.connect(filter);

      osc3.start(now + 0.15);
      osc3.stop(now + 0.7);
    } catch (e) {
      console.warn('Could not play audio alert:', e);
    }
  }
}

export const soundManager = new SoundAlertManager();

export const LOCAL_STORAGE_SOUND_ALERT_KEY = 'munago_sound_alerts_enabled';

export function getStoredSoundAlertsEnabled(): boolean {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_SOUND_ALERT_KEY);
    return saved !== null ? JSON.parse(saved) : true; // Enabled by default
  } catch {
    return true;
  }
}

export function setStoredSoundAlertsEnabled(enabled: boolean) {
  try {
    localStorage.setItem(LOCAL_STORAGE_SOUND_ALERT_KEY, JSON.stringify(enabled));
  } catch (e) {
    console.warn('Could not save sound alert preference:', e);
  }
}

export function playLowStockAlertIfEnabled(isEnabled?: boolean) {
  const active = typeof isEnabled === 'boolean' ? isEnabled : getStoredSoundAlertsEnabled();
  if (active) {
    soundManager.playLowStockChime();
  }
}
