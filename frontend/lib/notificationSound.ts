/**
 * Zvuk nove narudžbe — sintetizovan Web Audio API-jem (dvotonski "ding-dong"),
 * bez audio fajla. Browser blokira zvuk do prve korisničke interakcije,
 * zato postoji unlock() koji se zove na klik "Uključi zvuk".
 */

let ctx: AudioContext | null = null;

export function unlockAudio(): boolean {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return true;
  } catch {
    return false;
  }
}

export function playNewOrderChime() {
  if (!ctx || ctx.state !== 'running') return;

  const now = ctx.currentTime;
  const notes: [number, number][] = [
    [880, 0], // A5
    [1174.66, 0.18], // D6
  ];

  for (const [freq, delay] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(0.35, now + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.9);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 1);
  }
}
