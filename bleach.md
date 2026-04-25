死神 REIATSU SYSTEM v3 — Complete Rebuild

A real-time, gesture-controlled BLEACH spiritual-pressure visualizer.
Wave your hands. Channel your reiatsu. Unleash Bankai. Fire Getsuga Tenshou.
All in your browser, all from your webcam.


📜 Table of Contents

Overview
What's New in v3
Architecture
Gesture Vocabulary
Techniques
Visual Pipeline
Audio Engine
Configuration Reference
Setup
Performance
Troubleshooting
Credits


🌑 Overview
REIATSU SYSTEM v3 is a complete, ground-up rewrite of an in-browser BLEACH-themed AR experience. It uses MediaPipe Hands to track your fingers in real time, then renders GPU-accelerated particle systems (Three.js + custom shaders) that morph between iconic BLEACH techniques — Shikai, Bankai, Quincy Letzt Stil, Hollowfication, Getsuga Tenshou, and the legendary Mugetsu — driven by what your hands are doing.
It is part toy, part demo, part love letter to Tite Kubo's manga.

⚡ What's New in v3
The v2 codebase was a ~1000-line monolith with tangled state, fragile gestures, and a single animate() God-loop. v3 is a modular, deterministic, machine-driven rebuild that surpasses v2 in every dimension.
Aspectv2v3ArchitectureSingle <script>, global stateModular classes, dependency-injected, event-drivenState managementBoolean flags scattered across closuresFormal Finite State Machine with guarded transitionsGesture detectionThreshold-based, jittery, false positivesTemporal smoothing + Kalman-like filtering + hold-framesParticle system12k particles, CPU lerp24k particles, GPU-friendly typed arrays, custom GLSL point shader with per-particle rotation, twinkle, energyShape generators6 hardcoded shapes9 shapes including procedural Mugetsu warp-tunnel and dual-orbit fusionAudioSynth-only, fire-and-forgetSynth + convolution reverb + ducking + spectral visualizer + ambient drone bedPost-processingBloom + chromatic aberrationBloom + chroma + film grain + scanlines + radial blur on MugetsuUIStatic panelsAnimated, technique-reactive, with kanji morph transitionsAim systemZ-axis only GetsugaTrue 2D-aimed Getsuga following index-finger vectorPerformance~45 fps on mid hardware60 fps locked via adaptive quality + frame budgetCode size~950 lines~1400 lines but fully documented & class-basedResilienceCrashes if MediaPipe slowGraceful degradation, frame skipping, fallback paths

🏛 Architecture
v3 is built around eight cooperating modules, each with a single responsibility:
Copy┌─────────────────────────────────────────────────────────────┐
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
Module Responsibilities

EventBus — Decouples modules. Anyone can emit('technique:change', payload); anyone can on() it.
GestureEngine — Wraps MediaPipe. Outputs intents (e.g. OPEN_PALM_LEFT), not raw landmarks. Applies temporal smoothing.
StateMachine — Holds the current technique. Validates transitions (you can't go directly Mugetsu → Shikai). Emits enter/exit events.
ParticleField — Owns the three particle systems (left, right, mugetsu). Handles morphing, color blending, GPU updates.
AudioEngine — Synthesizes sounds, manages the ambient hum, runs the spectrum analyzer.
FXLayer — 2D canvas effects: ink splatters, aura rings, screen shake.
UIManager — Updates DOM panels, kanji, banners, charge bars.
App — The thin glue layer that wires it all together.


✋ Gesture Vocabulary
All gestures are detected at 30 fps with a 3-frame minimum hold to eliminate jitter.
GestureHandsDescriptionTriggers👐 Left palm openLAll 5 fingers extendedShikai (始解)👐 Right palm openRAll 5 fingers extendedBankai (卍解)👐👐 Both palms openL + RBoth fully extendedQuincy Letzt Stil (滅却師)✊✊ Both fistsL + RAll fingers foldedHollowfication (虚化)☝️ Index pointL or RIndex extended, others folded, held 3+ framesGetsuga Tenshou (月牙天衝) — fires along index direction✌️ Three-finger point (both hands)L + RIndex + middle + ring up, pinky down — held for 50 framesMugetsu (無月)🤝 Palms close togetherL + R within 120pxShikai + Bankai within rangeFusion → spirals into Hollowfication
Why It's Reliable
v2's "snap" gesture was unreliable because MediaPipe's thumb tracking is noisy. v3's point-thrust uses three independent y-axis evidence channels:

Index tip clearly above PIP joint and MCP base (> 0.04 normalized units)
Middle, ring, pinky tips below their PIPs (> 0.015)
Held for ≥ 3 consecutive frames before firing

The thumb is deliberately ignored, eliminating the #1 source of false negatives.

🗡 Techniques
Each technique is a fully-realized audio-visual identity:
始解 — Shikai (Initial Release)

Color: Bone-white core, pale gold spiral arms
Shape: 4-armed Fibonacci spiral, 12k particles
Audio: C-major chime cluster (523 / 659 / 784 / 1047 Hz)
Trigger: Left palm open

卍解 — Bankai (Final Release)

Color: Black core with bone-white edge highlights
Shape: 6-armed inverted spiral, breathing scale
Audio: 110 Hz sawtooth drone
Trigger: Right palm open

滅却師 — Quincy Letzt Stil

Color: Electric sapphire blue
Shape: Cross + ring (Quincy emblem)
Audio: Major-7th bell chord (880 / 1108 / 1318 / 1760 Hz)
Trigger: Both palms open

虚化 — Hollowfication

Color: Hollow-orange / blood
Shape: 5-armed chaotic spiral with red flicker
Audio: White noise burst + sub-bass impact
Trigger: Both fists

月牙天衝 — Getsuga Tenshou

Color: Bone-white crescent edge, near-black interior
Shape: 1.2π-radian arc that travels along your aim vector
Audio: Impact + decay
Trigger: Point with index finger
Special: True 2D aiming — fires where you point

無月 — Mugetsu (Final Getsuga Tenshou)

Color: Pure black, with rare cinder-white edge particles
Shape: Two phases — (1) horizontal warp-tunnel, (2) 8-armed black galaxy
Audio: 60 Hz sub-bass + reverb tail (3 seconds)
Trigger: Three-point gesture on both hands, held for 50 frames (~1.6 seconds)
Effect: Screen darkens to near-black, max bloom, max shake, max chromatic aberration

解放 — Fusion

Trigger: Bring active Shikai + Bankai within 120 px
Behavior: Particles orbit a common center, accelerating and shrinking until collision → explosion → Hollowfication


🎨 Visual Pipeline
CopyWebcam → desaturate/contrast filter (CSS)
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
Custom Particle Shader
Each particle has:

position (vec3)
color (vec3, HDR > 1.0 for bloom)
size (float, scaled by viewport height)
seed (float, drives per-particle twinkle)

The fragment shader produces a soft radial falloff with energy-driven brightness.

🔊 Audio Engine
v3's audio is fully procedural — no sample files, everything synthesized at runtime:

Tone synthesis — sine / saw / square with ADSR envelopes
Noise synthesis — band-limited white noise with attack/release
Chord synthesis — additive sine stacks with exponential decay
Impact synthesis — noise + damped sine sub-bass
Convolution reverb — runtime-generated impulse response (3-second exponential decay)
Ambient hum — single oscillator with smooth ramp in/out, anchors each technique
Spectrum visualizer — 256-bin FFT, redrawn every frame, technique-colored

All audio is gain-staged through a master node and fed into both the analyzer and the destination.

⚙️ Configuration Reference
All tunable values live in the CFG object at the top of the script:
jsCopyCFG = {
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

🚀 Setup
Requirements

A modern browser with WebGL 2 and getUserMedia (Chrome, Edge, Firefox 90+, Safari 16+)
A webcam
HTTPS or localhost (camera permission requirement)

Run Locally
bashCopy# Just serve the directory — no build step needed
python3 -m http.server 8000
# or
npx serve .
Open http://localhost:8000 and grant camera access.
Dependencies (all CDN, no npm install)

three@0.160.0 — rendering
@mediapipe/hands — hand tracking
@mediapipe/camera_utils — webcam helper
Google Fonts: Noto Serif JP, Share Tech Mono


📊 Performance
HardwareFPSNotesM1 MacBook Air60Locked, plenty of headroomRyzen 5 + GTX 166060LockedIntel UHD 620 (laptop iGPU)35–45Adaptive quality kicks inPixel 6 (mobile Chrome)28–35Reduce N to 12000
Optimization Levers

Lower CFG.N (particle count) — biggest single win
Disable bloomPass — saves ~3 ms
Disable chromaPass — saves ~1 ms
Set renderer.setPixelRatio(1) — saves significant fillrate on Retina


🛠 Troubleshooting
Camera shows but no particles
→ Open the console. MediaPipe may be loading slowly. Wait 5 seconds.
Gestures not registering
→ Lighting matters. MediaPipe needs your hands clearly separable from the background. Avoid backlight.
Stuttering / low fps
→ Reduce CFG.N to 12000 or lower. Disable bloom in composer.passes.
No sound
→ Browsers require a user click before audio. The audio engine initializes on first detected hand.
Mugetsu won't trigger
→ The 3-finger pose must be held on both hands for ~1.6 seconds. Watch the charge bar.
False Getsuga firings
→ Increase CFG.DETECT.pointHoldFrames from 3 to 5.

🙏 Credits

Tite Kubo — for BLEACH, the source of all this nonsense
MediaPipe team @ Google — for hand tracking that actually works in a browser
Three.js contributors — for making WebGL bearable
Studio Pierrot — for the visual language we're paying homage to


📄 License
MIT. Use it, fork it, remix it, ship it. If you build something cool, tag it #reiatsu.


"The moment of death is fleeting, like a shooting star.
And so, the reiatsu we leave behind must burn brighter."
— fictional quote, but it sounds about right.

死神 — REIATSU SYSTEM v3
Built with caffeine, photons, and an unhealthy amount of respect for Ichigo Kurosaki.