// audio.js — tiny WebAudio synth: engine hum tied to throttle, wind
// noise tied to speed, a chime on ring pass, a thud on landing.
// No audio files, nothing fetched; starts on first user gesture.

export function createAudio() {
  let ctx = null, osc = null, osc2 = null, gain = null, windGain = null, muted = false;
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    gain = ctx.createGain(); gain.gain.value = 0.0; gain.connect(ctx.destination);
    osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 70;
    osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 35;
    const og2 = ctx.createGain(); og2.gain.value = 0.4;
    osc.connect(gain); osc2.connect(og2); og2.connect(gain);
    osc.start(); osc2.start();
    // Wind: looped noise buffer through a low-pass filter.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 420;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    src.connect(filt); filt.connect(windGain); windGain.connect(ctx.destination);
    src.start();
  }
  function update(s) {
    if (!ctx || muted) return;
    const t = s.throttle;
    gain.gain.value = 0.02 + t * 0.05;
    osc.frequency.value = 55 + t * 95 + s.speedKts * 0.12;
    osc2.frequency.value = 28 + t * 45;
    windGain.gain.value = Math.min(0.09, Math.max(0, (s.speedKts - 60) / 1400));
  }
  function blip(freq, dur, vol) {
    if (!ctx || muted) return;
    ensure();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  }
  return {
    ensure,
    update,
    ring: () => { blip(880, 0.18, 0.16); setTimeout(() => blip(1320, 0.25, 0.14), 90); },
    land: () => blip(220, 0.3, 0.2),
    crash: () => blip(70, 0.6, 0.25),
    toggleMute() { muted = !muted; if (gain) gain.gain.value = 0; return muted; },
  };
}
