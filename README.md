# 死神 REIATSU SYSTEM

> A real-time, gesture-controlled BLEACH spiritual-pressure visualizer.  
> Wave your hands. Channel your reiatsu. Unleash Bankai. Fire Getsuga Tenshou.  
> All in your browser, all from your webcam.

---

## 📜 Table of Contents

- [Overview](#-overview)
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

**REIATSU SYSTEM** is an in-browser BLEACH-themed AR experience. It uses **MediaPipe Hands** to track your fingers in real time, then renders GPU-accelerated particle systems (Three.js + custom shaders) that morph between iconic BLEACH techniques:

- Shikai, Bankai, Quincy Letzt Stil, Hollowfication
- Getsuga Tenshou, and the legendary **Mugetsu**

All driven by what your hands are doing.

---

## 🏛 Architecture

The project is built around decoupled cooperating components, each with a single responsibility:

- **EventBus**: Decouples modules. Enables clean publish-subscribe communications.
- **GestureEngine**: Wraps MediaPipe landmark updates. Evaluates gesture definitions and applies temporal smoothing.
- **StateMachine**: Holds the current technique state. Validates transitions and publishes state change events.
- **ParticleField**: Manages three particle systems (left, right, special effect trails). Handles shape morphs, color mixing, and shader updates.
- **AudioEngine**: Synthesizes chimes, sweeps, LFO drones, and impact sounds at runtime.
- **FXLayer**: Manages 2D canvas drawings for aura rings, ink splatters, skeletons, and audio FFT visualizer.
- **UIManager**: Modifies the DOM HUD, indicators, banners, and charges.
- **App**: Bootstrapping layer that connects gestures, state transitions, audio, and loops.

---

## ✋ Gesture Vocabulary

All gestures are detected in real-time with temporal smoothing to eliminate jitter.

| Gesture | Hands | Description | Triggers |
|---|---|---|---|
| 👐 Left palm open | L | All 5 fingers extended | Shikai (始解) |
| 👐 Right palm open | R | All 5 fingers extended | Bankai (卍解) |
| 👐👐 Both palms open | L + R | Both fully extended | Quincy Letzt Stil (滅却師) |
| ✊✊ Both fists | L + R | All fingers folded | Hollowfication (虚化) |
| ☝️ Index point | L or R | Index extended, others folded | Getsuga Tenshou (月牙天衝) — fires along index direction |
| ✌️ Three-finger point (both hands) | L + R | Index + middle + ring up, pinky down — held for charging | Mugetsu (無月) |
| 🤝 Palms close together | L + R within threshold | Shikai + Bankai within range | Fusion → spirals into Hollowfication |

---

## 🗡 Techniques

Each technique is a fully-realized audio-visual identity:

### 始解 — Shikai (Initial Release)
- **Color:** Bone-white core, pale gold spiral arms
- **Shape:** 4-armed Fibonacci spiral
- **Audio:** C-major chime cluster
- **Trigger:** Left palm open

### 卍解 — Bankai (Final Release)
- **Color:** Black core with bone-white edge highlights
- **Shape:** 6-armed inverted spiral, breathing scale
- **Audio:** deep low-frequency drone
- **Trigger:** Right palm open

### 滅却師 — Quincy Letzt Stil
- **Color:** Electric sapphire blue
- **Shape:** Cross + ring (Quincy emblem)
- **Audio:** Major-7th bell chord
- **Trigger:** Both palms open

### 虚化 — Hollowfication
- **Color:** Hollow-orange / blood red
- **Shape:** 5-armed chaotic spiral with red flicker
- **Audio:** White noise burst + sub-bass impact
- **Trigger:** Both fists

### 月牙天衝 — Getsuga Tenshou
- **Color:** Bone-white crescent edge, near-black interior
- **Shape:** 1.2π-radian arc traveling along the aim vector
- **Audio:** Impact + decay sweep
- **Trigger:** Point with index finger (aim vector determines direction)

### 無月 — Mugetsu (Final Getsuga Tenshou)
- **Color:** Pure black, with cinder-white edge particles
- **Shape:** Horizontal warp-tunnel leading into an 8-armed black galaxy
- **Audio:** sub-bass sweep + reverb tail
- **Trigger:** Three-point gesture on both hands, held to charge
- **Effect:** Screen darkens, maximum bloom, shake, and chromatic aberration

### 解放 — Fusion
- **Trigger:** Bring active Shikai + Bankai close together
- **Behavior:** Particles orbit a common center, accelerating and shrinking until collision → explosion → Hollowfication

---

## 🎨 Visual Pipeline

```
Webcam → contrast/brightness adjustments
        ↓
   Three.js scene
   ├─ Particle systems (additive blending)
   └─ EffectComposer
       ├─ RenderPass
       ├─ UnrealBloomPass    (strength varies based on state)
       └─ ChromaticPass      (radial RGB split + film grain + vignette)
        ↓
   2D Canvas overlays (mix-blend-mode)
   ├─ Aura rings
   ├─ Ink splatters
   └─ Skeleton debug
        ↓
   DOM UI (kanji, banners, bars, HUD)
```

### Custom Particle Shader

Each particle is rendered using custom vertex and fragment shaders. The fragment shader produces a soft radial falloff with energy-driven brightness and a sharp core to preserve shape details.

---

## 🔊 Audio Engine

All audio is procedurally synthesized at runtime with no static sample files:

- **Tone synthesis** — sine/saw/square waveforms with ADSR envelopes
- **Noise synthesis** — white noise sweeps
- **Chord synthesis** — additive harmonic stacks
- **Ambient hum** — oscillator structures anchored to technique transitions
- **Spectrum visualizer** — 256-bin FFT drawn onto a canvas overlay

---

## ⚙️ Configuration Reference

All tunable values reside in the `CFG` object inside `js/config.js`:

- `N_REISHI`: Particle count per hand cloud
- `N_TRAIL`: Particle count in getsuga/cero trails
- `CAM`: Camera dimensions, z-depth, and field-of-view
- `BLOOM`: Default bloom strength, radius, and threshold
- `DETECT`: Gesture detection thresholds, landmark filters, and charge limits
- `ANIM`: Lerp and morph rates

---

## 🚀 Setup

### Requirements

- A modern browser with **WebGL 2** and `getUserMedia` (Chrome, Edge, Firefox, Safari)
- A webcam
- **HTTPS or localhost** (camera permission requirement)

### Run Locally

Serve the directory using a local web server (no compilation steps needed):

```bash
# Python server
python3 -m http.server 8000
# or Node server
npx serve .
```

Open `http://localhost:8000` (or `http://localhost:3000`) and grant webcam access.

### Dependencies (loaded via CDN)

- `three@0.160.0` (3D rendering)
- `@mediapipe/hands` (landmark extraction)
- `@mediapipe/camera_utils` (webcam capture helper)
---

## 📊 Performance

The application is built for high-performance desktop systems:
- **Uncapped Real-Time Tracking**: MediaPipe hand-tracking and Three.js coordinate updates run in real-time at full camera/frame rate for immediate response.
- **GPU-Accelerated Visuals**: WebGL 2 renders particle morphing and post-processing filters at the monitor's native refresh rate (60FPS+).
---

## 📄 License

**MIT.**
