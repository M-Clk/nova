/**
 * Audio utility for playing POS sound notifications using Web Audio API.
 * Web Audio API produces zero-latency synth tones without external asset dependencies.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays the iconic market/supermarket barcode scanner double error buzz (BZZT-BZZT).
 */
export function playErrorSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Classic Market POS Scanner Error Sound (Double Square Wave Buzz)
    // First sharp pulse (180 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "square";
    osc1.frequency.setValueAtTime(200, now);

    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.setValueAtTime(0.3, now + 0.09);
    gain1.gain.linearRampToValueAtTime(0.001, now + 0.11);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.11);

    // Second lower pulse (130 Hz) - classic "Uh-oh" / "BZZT"
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "square";
    osc2.frequency.setValueAtTime(130, now + 0.14);

    gain2.gain.setValueAtTime(0.35, now + 0.14);
    gain2.gain.setValueAtTime(0.35, now + 0.28);
    gain2.gain.linearRampToValueAtTime(0.001, now + 0.32);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.32);
  } catch (err) {
    console.warn("Could not play error sound:", err);
  }
}

/**
 * Plays a pleasant high-pitch success beep.
 */
export function playSuccessSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.setValueAtTime(1760, now + 0.08); // A6

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch (err) {
    console.warn("Could not play success sound:", err);
  }
}
