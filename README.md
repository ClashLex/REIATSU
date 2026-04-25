# 死神 REIATSU SYSTEM v3 — Complete Rebuild

> A real-time, gesture-controlled BLEACH spiritual-pressure visualizer.  
> Wave your hands. Channel your reiatsu. Unleash Bankai. Fire Getsuga Tenshou.  
> All in your browser, all from your webcam.

🔗 **Live Demo:** [clashlex.github.io/bleach](https://clashlex.github.io/bleach/)

---

## 📜 Table of Contents

- [Overview](#-overview)
- [What's New in v3](#-whats-new-in-v3)
- [Architecture](#-architecture)
- [Gesture Vocabulary](#-gesture-vocabulary)
- [Techniques](#-techniques)
- [Visual Pipeline](#-visual-pipeline)
- [Audio Engine](#-audio-engine)
- [Configuration Reference](#️-configuration-reference)
- [Setup](#-setup)
- [Performance](#-performance)
- [Troubleshooting](#️-troubleshooting)
- [Credits](#-credits)
- [License](#-license)

---

## 🌑 Overview

**REIATSU SYSTEM v3** is a complete, ground-up rewrite of an in-browser BLEACH-themed AR experience. It uses **MediaPipe Hands** to track your fingers in real time, then renders GPU-accelerated particle systems (Three.js + custom shaders) that morph between iconic BLEACH techniques:

- Shikai, Bankai, Quincy Letzt Stil, Hollowfication
- Getsuga Tenshou, and the legendary **Mugetsu**

All driven by what your hands are doing.

> *It is part toy, part demo, part love letter to Tite Kubo's manga.*

---

## ⚡ What's New in v3

The v2 codebase was a ~1,000-line monolith with tangled state, fragile gestures, and a single `animate()` God-loop. **v3 is a modular, deterministic, machine-driven rebuild** that surpasses v2 in every dimension.

| Aspect | v2 | v3 |
|---|---|---|
| **Architecture** | Single `<script>`, global state | Modular classes, dependency-injected, event-driven |
| **State management** | Boolean flags scattered across closures | Formal Finite State Machine with guarded transitions |
| **Gesture detection** | Threshold-based, jittery, false positives | Temporal smoothing + Kalman-like filtering + hold-frames |
| **Particle system** | 12k particles, CPU lerp | 24k particles, GPU-friendly typed arrays, custom GLSL point shader with per-particle rotation, twinkle, energy |
| **Shape generators** | 6 hardcoded shapes | 9 shapes including procedural Mugetsu warp-tunnel and dual-orbit fusion |
| **Audio** | Synth-only, fire-and-forget | Synth + convolution reverb + ducking + spectral visualizer + ambient drone bed |
| **Post-processing** | Bloom + chromatic aberration | Bloom + chroma + film grain + scanlines + radial blur on Mugetsu |
| **UI** | Static panels | Animated, technique-reactive, with kanji morph transitions |
| **Aim system** | Z-axis only Getsuga | True 2D-aimed Getsuga following index-finger vector |
| **Performance** | ~45 fps on mid hardware | 60 fps locked via adaptive quality + frame budget |
| **Code size** | ~950 lines | ~1,400 lines but fully documented & class-based |
| **Resilience** | Crashes if MediaPipe slow | Graceful degradation, frame skipping, fallback paths |

---

## 🏛 Architecture

v3 is built around **eight cooperating modules**, each with a single responsibility:

```
┌─────────────────────────────────────────────────────────────┐
│                      EventBus (pub/sub)                     │
└─────────────────────────────────────────────────────────────┘
         ↑              ↑              ↑              ↑
    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐
    │ Gesture │    │  State  │    │ Particle│    │  Audio  │
    │ Engine  │───▶│ Machine │───▶│  Field  │    │ Engine  │
    └─────────┘    └─────────┘    └─────────┘    └─────────┘
         ↑                              │              │
    ┌────┴────┐                    ┌────┴────┐    ┌────┴────┐
    │MediaPipe│                    │ Three.js│    │WebAudio │
    │  Hands  │                    │ Renderer│    │ Context │
    └─────────┘                    └─────────┘    └─────────┘
                                        │
                                   ┌────┴────┐
                                   │   FX    │  (ink, aura, banner, HUD)
                                   │ Layers  │
                                   └─────────┘
```

### Module Responsibilities

| Module | Role |
|---|---|
| **EventBus** | Decouples modules. Anyone can `emit('technique:change', payload)`; anyone can `on()` it. |
| **GestureEngine** | Wraps MediaPipe. Outputs intents (e.g. `OPEN_PALM_LEFT`), not raw landmarks. Applies temporal smoothing. |
| **StateMachine** | Holds the current technique. Validates transitions (you can't go directly Mugetsu → Shikai). Emits enter/exit events. |
| **ParticleField** | Owns the three particle systems (left, right, mugetsu). Handles morphing, color blending, GPU updates. |
| **AudioEngine** | Synthesizes sounds, manages the ambient hum, runs the spectrum analyzer. |
| **FXLayer** | 2D canvas effects: ink splatters, aura rings, screen shake. |
| **UIManager** | Updates DOM panels, kanji, banners, charge bars. |
| **App** | The thin glue layer that wires it all together. |

---

## ✋ Gesture Vocabulary

All gestures are detected at **30 fps** with a **3-frame minimum hold** to eliminate jitter.

| Gesture | Hands | Description | Triggers |
|---|---|---|---|
| 👐 Left palm open | L | All 5 fingers extended | Shikai (始解) |
| 👐 Right palm open | R | All 5 fingers extended | Bankai (卍解) |
| 👐👐 Both palms open | L + R | Both fully extended | Quincy Letzt Stil (滅却師) |
| ✊✊ Both fists | L + R | All fingers folded | Hollowfication (虚化) |
| ☝️ Index point | L or R | Index extended, others folded, held 3+ frames | Getsuga Tenshou (月牙天衝) — fires along index direction |
| ✌️ Three-finger point (both hands) | L + R | Index + middle + ring up, pinky down — held for 50 frames | Mugetsu (無月) |
| 🤝 Palms close together | L + R within 120px | Shikai + Bankai within range | Fusion → spirals into Hollowfication |

### Why It's Reliable

v2's "snap" gesture was unreliable because MediaPipe's thumb tracking is noisy. v3's point-thrust uses **three independent y-axis evidence channels**:

1. Index tip clearly above PIP joint and MCP base (`> 0.04` normalized units)
2. Middle, ring, pinky tips below their PIPs (`> 0.015`)
3. Held for ≥ 3 consecutive frames before firing

> The thumb is deliberately ignored, eliminating the #1 source of false negatives.

---

## 🗡 Techniques

Each technique is a fully-realized audio-visual identity.

### 始解 — Shikai (Initial Release)
- **Color:** Bone-white core, pale gold spiral arms
- **Shape:** 4-armed Fibonacci spiral, 12k particles
- **Audio:** C-major chime cluster (523 / 659 / 784 / 1047 Hz)
- **Trigger:** Left palm open

### 卍解 — Bankai (Final Release)
- **Color:** Black core with bone-white edge highlights
- **Shape:** 6-armed inverted spiral, breathing scale
- **Audio:** 110 Hz sawtooth drone
- **Trigger:** Right palm open

### 滅却師 — Quincy Letzt Stil
- **Color:** Electric sapphire blue
- **Shape:** Cross + ring (Quincy emblem)
- **Audio:** Major-7th bell chord (880 / 1108 / 1318 / 1760 Hz)
- **Trigger:** Both palms open

### 虚化 — Hollowfication
- **Color:** Hollow-orange / blood
- **Shape:** 5-armed chaotic spiral with red flicker
- **Audio:** White noise burst + sub-bass impact
- **Trigger:** Both fists

### 月牙天衝 — Getsuga Tenshou
- **Color:** Bone-white crescent edge, near-black interior
- **Shape:** 1.2π-radian arc that travels along your aim vector
- **Audio:** Impact + decay
- **Trigger:** Point with index finger
- **Special:** True 2D aiming — fires where you point

### 無月 — Mugetsu (Final Getsuga Tenshou)
- **Color:** Pure black, with rare cinder-white edge particles
- **Shape:** Two phases — (1) horizontal warp-tunnel, (2) 8-armed black galaxy
- **Audio:** 60 Hz sub-bass + reverb tail (3 seconds)
- **Trigger:** Three-point gesture on both hands, held for 50 frames (~1.6 seconds)
- **Effect:** Screen darkens to near-black, max bloom, max shake, max chromatic aberration

### 解放 — Fusion
- **Trigger:** Bring active Shikai + Bankai within 120 px
- **Behavior:** Particles orbit a common center, accelerating and shrinking until collision → explosion → Hollowfication

---

## 🎨 Visual Pipeline

```
Webcam → desaturate/contrast filter (CSS)
        ↓
   Three.js scene
   ├─ Particle systems (additive blending, screen mix-blend)
   └─ EffectComposer
       ├─ RenderPass
       ├─ UnrealBloomPass    (strength varies 1.6 → 7.0)
       ├─ ChromaticPass      (radial RGB split, custom shader)
       └─ FilmGrainPass      (subtle, technique-reactive)
        ↓
   2D Canvas overlays (mix-blend-mode)
   ├─ Aura rings (screen)
   ├─ Ink splatters (multiply)
   └─ Skeleton debug (normal, low opacity)
        ↓
   DOM UI (kanji, banners, bars, HUD)
        ↓
   Vignette + scanlines (final atmospheric pass)
```

### Custom Particle Shader

Each particle has:

- `position` (vec3)
- `color` (vec3, HDR > 1.0 for bloom)
- `size` (float, scaled by viewport height)
- `seed` (float, drives per-particle twinkle)

The fragment shader produces a soft radial falloff with energy-driven brightness.

---

## 🔊 Audio Engine

v3's audio is **fully procedural** — no sample files, everything synthesized at runtime:

- **Tone synthesis** — sine / saw / square with ADSR envelopes
- **Noise synthesis** — band-limited white noise with attack/release
- **Chord synthesis** — additive sine stacks with exponential decay
- **Impact synthesis** — noise + damped sine sub-bass
- **Convolution reverb** — runtime-generated impulse response (3-second exponential decay)
- **Ambient hum** — single oscillator with smooth ramp in/out, anchors each technique
- **Spectrum visualizer** — 256-bin FFT, redrawn every frame, technique-colored

All audio is gain-staged through a master node and fed into both the analyzer and the destination.

---

## ⚙️ Configuration Reference

All tunable values live in the `CFG` object at the top of the script:

```js
CFG = {
  N: 24000,              // particle count per system
  SHIKAI: { ... },       // per-technique color, shape, bloom
  BANKAI: { ... },
  QUINCY: { ... },
  HOLLOW: { ... },
  GETSUGA: { ... },
  MUGETSU: { ... },
  FUSION: { ... },
  BLOOM:  { defaultStrength: 1.6, radius: 0.5, threshold: 0.8 },
  DETECT: {
    pointHoldFrames: 3,        // debounce
    pointTipMargin: 0.04,      // index extension threshold
    pointFoldMargin: 0.015,    // other-finger fold threshold
    mugetsuFrames: 50,         // hold frames for Mugetsu
    minDetect: 0.7,
    minTrack: 0.6,
  },
  ANIM: { lerpPos: 0.45, lerpMorph: 0.09, fadeIn: 0.07, fadeOut: 0.05 },
  CAM:  { w: 1280, h: 720, z: 60, fov: 70 },
}
```

---

## 🚀 Setup

### Requirements

- A modern browser with **WebGL 2** and `getUserMedia` (Chrome, Edge, Firefox 90+, Safari 16+)
- A webcam
- **HTTPS or localhost** (camera permission requirement)

### Run Locally

```bash
# Just serve the directory — no build step needed
python3 -m http.server 8000
# or
npx serve .
```

Open `http://localhost:8000` and grant camera access.

### Dependencies (all CDN, no `npm install`)

| Package | Purpose |
|---|---|
| `three@0.160.0` | Rendering |
| `@mediapipe/hands` | Hand tracking |
| `@mediapipe/camera_utils` | Webcam helper |
| Google Fonts: Noto Serif JP, Share Tech Mono | Typography |

---

## 📊 Performance

| Hardware | FPS | Notes |
|---|---|---|
| M1 MacBook Air | 60 | Locked, plenty of headroom |
| Ryzen 5 + GTX 1660 | 60 | Locked |
| Intel UHD 620 (laptop iGPU) | 35–45 | Adaptive quality kicks in |
| Pixel 6 (mobile Chrome) | 28–35 | Reduce `N` to 12000 |

### Optimization Levers

- **Lower `CFG.N`** (particle count) — biggest single win
- **Disable `bloomPass`** — saves ~3 ms
- **Disable `chromaPass`** — saves ~1 ms
- **Set `renderer.setPixelRatio(1)`** — saves significant fillrate on Retina

---

## 🛠️ Troubleshooting

| Issue | Solution |
|---|---|
| Camera shows but no particles | Open the console. MediaPipe may be loading slowly. Wait 5 seconds. |
| Gestures not registering | Lighting matters. MediaPipe needs your hands clearly separable from the background. Avoid backlight. |
| Stuttering / low fps | Reduce `CFG.N` to 12000 or lower. Disable bloom in `composer.passes`. |
| No sound | Browsers require a user click before audio. The audio engine initializes on first detected hand. |
| Mugetsu won't trigger | The 3-finger pose must be held on **both hands** for ~1.6 seconds. Watch the charge bar. |
| False Getsuga firings | Increase `CFG.DETECT.pointHoldFrames` from `3` to `5`. |

---

## 🙏 Credits

- **Tite Kubo** — for BLEACH, the source of all this nonsense
- **MediaPipe team @ Google** — for hand tracking that actually works in a browser
- **Three.js contributors** — for making WebGL bearable
- **Studio Pierrot** — for the visual language we're paying homage to

---

## 📄 License

**MIT.** Use it, fork it, remix it, ship it. If you build something cool, tag it `#reiatsu`.

---

> *"The moment of death is fleeting, like a shooting star.*  
> *And so, the reiatsu we leave behind must burn brighter."*  
> — fictional quote, but it sounds about right.

---

**死神 — REIATSU SYSTEM v3**  
*Built with caffeine, photons, and an unhealthy amount of respect for Ichigo Kurosaki.*
