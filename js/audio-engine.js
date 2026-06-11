import { TECHS } from './config.js';
import { Bus } from './event-bus.js';

export const AudioEngine = (() => {
  let ctx, master, analyser, ready = false, drone = null;
  const buffers = {};

  async function init() {
    if (ready) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    master = ctx.createGain();
    master.gain.value = .85;
    analyser.connect(master);
    master.connect(ctx.destination);
    buildBuffers();
    ready = true;
  }

  function makeBuf(dur, rate = 44100) {
    return ctx.createBuffer(1, Math.max(1, Math.floor(dur * rate)), rate);
  }

  function buildBuffers() {
    function chime(roots, dur, gain = .28) {
      const buf = makeBuf(dur), d = buf.getChannelData(0), sr = buf.sampleRate;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const env = Math.exp(-t * 2.5) * Math.min(1, t * 30);
        let s = 0;
        for (const f of roots) {
          s += Math.sin(2 * Math.PI * f * t)
             + Math.sin(2 * Math.PI * f * 2 * t) * .4
             + Math.sin(2 * Math.PI * f * 3 * t) * .18;
        }
        s += (Math.random() * 2 - 1) * Math.exp(-t * 1.5) * .08;
        d[i] = (s / roots.length) * env * gain;
      }
      return buf;
    }

    function impact(dur = .7, gain = .55) {
      const buf = makeBuf(dur), d = buf.getChannelData(0), sr = buf.sampleRate;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr, env = Math.exp(-t * 8);
        const sub = Math.sin(2 * Math.PI * 48 * t) * Math.exp(-t * 15);
        const body = Math.sin(2 * Math.PI * 120 * t * (1 - t * .6)) * Math.exp(-t * 6);
        const air = (Math.random() * 2 - 1) * Math.exp(-t * 4) * .5;
        d[i] = (sub * 1.2 + body * .6 + air) * env * gain;
      }
      return buf;
    }

    function beam(dur = 1.2, gain = .45) {
      const buf = makeBuf(dur), d = buf.getChannelData(0), sr = buf.sampleRate;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const env = Math.min(1, t * 15) * Math.exp(-Math.max(0, t - .4) * 3);
        const f = 80 + Math.sin(t * 15) * 20;
        const s = Math.sin(2 * Math.PI * f * t) * .6
                + Math.sin(2 * Math.PI * f * 1.5 * t) * .3
                + (Math.random() * 2 - 1) * .4;
        d[i] = s * env * gain;
      }
      return buf;
    }

    function dark(dur = 2.0, gain = .5) {
      const buf = makeBuf(dur), d = buf.getChannelData(0), sr = buf.sampleRate;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const env = Math.min(1, t * 2) * Math.exp(-Math.max(0, t - .6) * 1.2);
        const f = 38 - t * 4;
        const s = Math.sin(2 * Math.PI * f * t)
                + (2 * (t * f - Math.floor(t * f + .5))) * .3
                + (Math.random() * 2 - 1) * .15;
        d[i] = s * env * gain;
      }
      return buf;
    }

    function noise(dur = 1.0, gain = .25) {
      const buf = makeBuf(dur), d = buf.getChannelData(0), sr = buf.sampleRate;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr, env = Math.min(1, t * 30) * Math.exp(-t * 2);
        d[i] = (Math.random() * 2 - 1) * env * gain;
      }
      return buf;
    }

    buffers.shikai  = chime([523, 659, 784, 1047, 1318], 1.8, .26);
    buffers.bankai  = impact(1.2, .65);
    buffers.quincy  = chime([880, 1108, 1318, 1760, 2093], 2.0, .22);
    buffers.hollow  = noise(1.5, .35);
    buffers.getsuga = impact(.85, .65);
    buffers.cero    = beam(1.4, .55);
    buffers.bakudo  = chime([330, 415, 494, 659], 1.4, .25);
    buffers.mugetsu = dark(3.5, .55);
    buffers.fusion  = impact(1.5, .7);
    buffers.pulse   = impact(.3, .35);
  }

  function play(name, vol = 1) {
    if (!ready || !buffers[name]) return;
    const src = ctx.createBufferSource();
    src.buffer = buffers[name];
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(analyser);
    src.start(0);
  }

  let droneTimeout = null;
  function startDrone(freq, vol = .05) {
    if (!ready) return;
    stopDrone();
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    const g = ctx.createGain();
    o1.type = 'sine';
    o2.type = 'sawtooth';
    o1.frequency.value = freq;
    o2.frequency.value = freq * 2.01;
    lfo.frequency.value = .35;
    lfoG.gain.value = freq * .012;
    lfo.connect(lfoG);
    lfoG.connect(o1.frequency);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + .4);
    o1.connect(g);
    o2.connect(g);
    g.connect(analyser);
    o1.start();
    o2.start();
    lfo.start();
    drone = { o1, o2, lfo, g };
  }

  function stopDrone() {
    if (!drone) return;
    const d = drone;
    drone = null;
    if (droneTimeout) {
      clearTimeout(droneTimeout);
      droneTimeout = null;
    }
    try {
      d.g.gain.cancelScheduledValues(ctx.currentTime);
      d.g.gain.linearRampToValueAtTime(0, ctx.currentTime + .3);
      droneTimeout = setTimeout(() => {
        try {
          d.o1.stop();
          d.o2.stop();
          d.lfo.stop();
        } catch (e) {}
        droneTimeout = null;
      }, 350);
    } catch (e) {}
  }

  function freqData() {
    if (!analyser) return new Uint8Array(128);
    const a = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(a);
    return a;
  }

  // Set up tech event listeners to handle drone and pulse automatically
  Bus.on('tech:change', ({ current }) => {
    if (!ready) return;
    const T = TECHS[current] || TECHS.neutral;
    if (T.drone > 0) {
      startDrone(T.drone, T.droneVol);
    } else {
      stopDrone();
    }
    play('pulse', .3);
  });

  return {
    init,
    play,
    startDrone,
    stopDrone,
    freqData,
    get ready() { return ready; }
  };
})();
export default AudioEngine;
