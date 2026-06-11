import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass     } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass     } from 'three/addons/postprocessing/ShaderPass.js';
import { CFG } from './config.js';

export const threeCv = document.getElementById('three');
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(CFG.CAM.fov, innerWidth / innerHeight, .1, 2000);
camera.position.z = CFG.CAM.z;

export const renderer = new THREE.WebGLRenderer({ canvas: threeCv, antialias: true, alpha: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

export const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
export const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  CFG.BLOOM.strength,
  CFG.BLOOM.radius,
  CFG.BLOOM.threshold
);
composer.addPass(bloom);

/* — chromatic aberration + vignette + grade combined pass — */
const GradePass = {
  uniforms: {
    tDiffuse: { value: null },
    uChroma: { value: 0 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uTime: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uChroma; uniform vec3 uTint; uniform float uTime;
    varying vec2 vUv;
    float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){
      vec2 d = vUv-.5;
      float dist = length(d);
      vec2 off = normalize(d+1e-5) * dist * uChroma * .012;
      float r = texture2D(tDiffuse, vUv+off).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv-off).b;
      vec3 c = vec3(r,g,b) * uTint;
      c += (h(vUv*1024.+uTime)-.5) * .04;
      c *= smoothstep(1.1,.35,dist);
      gl_FragColor = vec4(c,1.);
    }`,
};
export const gradePass = new ShaderPass(GradePass);
composer.addPass(gradePass);

export function resizeThree(w, h) {
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
}

/* utility: screen px → world coords at z=0 */
export function s2w(sx, sy) {
  const fov = camera.fov * Math.PI / 180;
  const hH = camera.position.z * Math.tan(fov / 2);
  const hW = hH * camera.aspect;
  return new THREE.Vector3(
    ((sx / innerWidth) - .5) * 2 * hW,
    -((sy / innerHeight) - .5) * 2 * hH, 0);
}
export function w2s(v) {
  const fov = camera.fov * Math.PI / 180;
  const hH = camera.position.z * Math.tan(fov / 2);
  const hW = hH * camera.aspect;
  return { x: (v.x / (2 * hW) + .5) * innerWidth, y: (-v.y / (2 * hH) + .5) * innerHeight };
}

/* PARTICLE SHADERS */
const PARTICLE_VS = `
attribute float aSize;
attribute vec3  aColor;
attribute float aAlpha;
varying vec3 vColor; varying float vAlpha;
uniform float uPR;
void main(){
  vec4 mv = modelViewMatrix * vec4(position,1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPR * (220./max(1.,-mv.z));
  vColor = aColor; vAlpha = aAlpha;
}`;
const PARTICLE_FS = `
varying vec3 vColor; varying float vAlpha;
void main(){
  vec2 uv = gl_PointCoord*2.-1.;
  float d = length(uv);
  if (d>1.) discard;
  float core = pow(max(0.,1.-d), 2.5);
  float halo = exp(-d*3.0)*.45;
  float i = core*1.6 + halo;
  vec3 c = vColor + core*.5;
  gl_FragColor = vec4(c, i*vAlpha);
}`;

function makePointSystem(count) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const siz = new Float32Array(count);
  const al = new Float32Array(count);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(al, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPR: { value: Math.min(devicePixelRatio, 2) } },
    vertexShader: PARTICLE_VS,
    fragmentShader: PARTICLE_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.visible = false;
  scene.add(pts);
  return {
    pts, geo, count, pos, col, siz, al,
    tPos: new Float32Array(count * 3),
    tCol: new Float32Array(count * 3),
    tSiz: new Float32Array(count),
    tAl: new Float32Array(count),
    worldPos: new THREE.Vector3(),
    targetPos: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    shape: '', visible: false, opacity: 0,
  };
}

/* Shape generators */
export function shapeShikai(s) {
  const c = CFG.COLORS.shikai;
  for (let i = 0; i < s.count; i++) {
    const t = i / s.count;
    const inCore = t < .18;
    let x, y, z, r = c.r, g = c.g, b = c.b, sz = 1.0;
    if (inCore) {
      const ρ = Math.random() * 5;
      const θ = Math.random() * 6.28, φ = Math.acos(2 * Math.random() - 1);
      x = ρ * Math.sin(φ) * Math.cos(θ);
      y = ρ * Math.sin(φ) * Math.sin(θ);
      z = ρ * Math.cos(φ);
      sz = 2.0 + Math.random() * 1.5;
    } else {
      const arm = i % 4;
      const a = t * 11 + arm * Math.PI * .5;
      const rad = 3 + t * 22;
      x = rad * Math.cos(a); y = rad * Math.sin(a);
      z = (Math.random() - .5) * 9 * t;
      const f = .55 + Math.random() * .55;
      r *= f; g *= f; b *= f * .95;
      sz = .55 + Math.random() * .6;
    }
    s.tPos[i * 3] = x; s.tPos[i * 3 + 1] = y; s.tPos[i * 3 + 2] = z;
    s.tCol[i * 3] = r; s.tCol[i * 3 + 1] = g; s.tCol[i * 3 + 2] = b;
    s.tSiz[i] = sz; s.tAl[i] = 1;
  }
}

export function shapeBankai(s) {
  const c = CFG.COLORS.bankai, e = CFG.COLORS.bankaiE;
  for (let i = 0; i < s.count; i++) {
    const t = i / s.count;
    let x, y, z, R, G, B, sz;
    if (t < .12) {
      const ρ = Math.random() * 7;
      const θ = Math.random() * 6.28, φ = Math.acos(2 * Math.random() - 1);
      x = ρ * Math.sin(φ) * Math.cos(θ);
      y = ρ * Math.sin(φ) * Math.sin(θ);
      z = ρ * Math.cos(φ);
      const rim = ρ / 7;
      R = c.r + e.r * rim * .4; G = c.g + e.g * rim * .4; B = c.b + e.b * rim * .4;
      sz = 2.5 + Math.random() * 1.5;
    } else {
      const arm = i % 6;
      const a = -(t * 16) + arm * Math.PI / 3;
      const rad = 4 + t * 38;
      x = rad * Math.cos(a); y = rad * Math.sin(a);
      z = (Math.random() - .5) * 14 * t;
      const isEdge = Math.random() > .82;
      if (isEdge) { R = e.r; G = e.g; B = e.b; sz = 1.4 + Math.random() * .6; }
      else { R = c.r; G = c.g; B = c.b; sz = .7 + Math.random() * .6; }
    }
    s.tPos[i * 3] = x; s.tPos[i * 3 + 1] = y; s.tPos[i * 3 + 2] = z;
    s.tCol[i * 3] = R; s.tCol[i * 3 + 1] = G; s.tCol[i * 3 + 2] = B;
    s.tSiz[i] = sz; s.tAl[i] = 1;
  }
}

export function shapeQuincy(s) {
  const c = CFG.COLORS.quincy;
  for (let i = 0; i < s.count; i++) {
    const t = i / s.count;
    let x, y, z, sz = .8 + Math.random() * .7;
    let R = c.r, G = c.g, B = c.b;
    if (t < .22) {
      x = (Math.random() - .5) * 36; y = (Math.random() - .5) * 4;
      z = (Math.random() - .5) * 2;
    } else if (t < .44) {
      x = (Math.random() - .5) * 4; y = (Math.random() - .5) * 36;
      z = (Math.random() - .5) * 2;
    } else if (t < .85) {
      const a = t * Math.PI * 2 * 3;
      const r = 18 + (Math.random() - .5) * 1.8;
      x = r * Math.cos(a); y = r * Math.sin(a); z = (Math.random() - .5) * 4;
      sz = .6 + Math.random() * .5;
    } else {
      const a = Math.random() * Math.PI * 2;
      const r = 22 + Math.random() * 8;
      x = r * Math.cos(a); y = r * Math.sin(a); z = (Math.random() - .5) * 6;
      const f = .4 + Math.random() * .6;
      R *= f; G *= f; B *= f;
    }
    s.tPos[i * 3] = x; s.tPos[i * 3 + 1] = y; s.tPos[i * 3 + 2] = z;
    s.tCol[i * 3] = R; s.tCol[i * 3 + 1] = G; s.tCol[i * 3 + 2] = B;
    s.tSiz[i] = sz; s.tAl[i] = 1;
  }
}

export function shapeHollow(s) {
  const c = CFG.COLORS.hollow;
  for (let i = 0; i < s.count; i++) {
    const t = i / s.count;
    let x, y, z, sz, R = c.r, G = c.g, B = c.b;
    if (t < .2) {
      const ρ = Math.random() * 6;
      const θ = Math.random() * 6.28, φ = Math.acos(2 * Math.random() - 1);
      x = ρ * Math.sin(φ) * Math.cos(θ);
      y = ρ * Math.sin(φ) * Math.sin(θ);
      z = ρ * Math.cos(φ);
      sz = 2.2 + Math.random() * 1.2;
    } else {
      const arm = i % 5;
      const a = t * 18 + arm * Math.PI * .4;
      const rad = 3 + t * 28;
      x = rad * Math.cos(a); y = rad * Math.sin(a);
      z = (Math.random() - .5) * 9 * t;
      const f = .6 + Math.random() * .7;
      R *= f; G *= f * (.8 + Math.random() * .4); B *= .3;
      sz = .6 + Math.random() * .7;
    }
    s.tPos[i * 3] = x; s.tPos[i * 3 + 1] = y; s.tPos[i * 3 + 2] = z;
    s.tCol[i * 3] = R; s.tCol[i * 3 + 1] = G; s.tCol[i * 3 + 2] = B;
    s.tSiz[i] = sz; s.tAl[i] = 1;
  }
}

export function shapeGetsuga(s) {
  const c = CFG.COLORS.getsuga;
  for (let i = 0; i < s.count; i++) {
    const t = i / s.count;
    const a = -Math.PI * .55 + t * Math.PI * 1.1;
    const radius = 14 + (Math.random() - .5) * 7;
    const isEdge = radius > 18.5 || radius < 9.5;
    const x = radius * Math.cos(a), y = radius * Math.sin(a);
    const z = (Math.random() - .5) * 5;
    const f = isEdge ? 1 : .15;
    s.tPos[i * 3] = x; s.tPos[i * 3 + 1] = y; s.tPos[i * 3 + 2] = z;
    s.tCol[i * 3] = c.r * f; s.tCol[i * 3 + 1] = c.g * f; s.tCol[i * 3 + 2] = c.b * f;
    s.tSiz[i] = isEdge ? 2.2 : .8;
    s.tAl[i] = 1;
  }
}

export function shapeCero(s) {
  const c = CFG.COLORS.cero;
  for (let i = 0; i < s.count; i++) {
    const t = i / s.count;
    const a = Math.random() * Math.PI * 2;
    const r = (1 + Math.random() * 4) * (1 + t * .2);
    const x = r * Math.cos(a), y = r * Math.sin(a);
    const z = -t * 60;
    const isCore = r < 1.5;
    const f = isCore ? 1.3 : (.5 + Math.random() * .6);
    s.tPos[i * 3] = x; s.tPos[i * 3 + 1] = y; s.tPos[i * 3 + 2] = z;
    s.tCol[i * 3] = c.r * f; s.tCol[i * 3 + 1] = c.g * f; s.tCol[i * 3 + 2] = c.b * f;
    s.tSiz[i] = isCore ? 2.5 : .9;
    s.tAl[i] = 1 - t * .6;
  }
}

export function shapeBakudo(s) {
  const c = CFG.COLORS.bakudo;
  for (let i = 0; i < s.count; i++) {
    const t = i / s.count;
    let x, y, z, sz;
    if (t < .65) {
      const bar = i % 6;
      const θ = bar * Math.PI / 3;
      const u = (Math.random() - .5) * 28;
      const v = (Math.random() - .5) * 1.4;
      x = u * Math.cos(θ) - v * Math.sin(θ);
      y = u * Math.sin(θ) + v * Math.cos(θ);
      z = (Math.random() - .5) * 1.5;
      sz = 1.4 + Math.random() * .6;
    } else {
      const a = t * Math.PI * 2 * 3;
      const r = 16 + Math.random() * 2;
      x = r * Math.cos(a); y = r * Math.sin(a); z = (Math.random() - .5) * 3;
      sz = .7;
    }
    s.tPos[i * 3] = x; s.tPos[i * 3 + 1] = y; s.tPos[i * 3 + 2] = z;
    s.tCol[i * 3] = c.r; s.tCol[i * 3 + 1] = c.g; s.tCol[i * 3 + 2] = c.b;
    s.tSiz[i] = sz; s.tAl[i] = 1;
  }
}

export function shapeMugetsu(s) {
  const dark = CFG.COLORS.mugetsu, edge = CFG.COLORS.mugetsuE;
  for (let i = 0; i < s.count; i++) {
    const t = i / s.count;
    let x, y, z, R, G, B, sz;
    if (t < .4) {
      const ρ = Math.random() * 22;
      const θ = Math.random() * 6.28, φ = Math.acos(2 * Math.random() - 1);
      x = ρ * Math.sin(φ) * Math.cos(θ);
      y = ρ * Math.sin(φ) * Math.sin(θ);
      z = ρ * Math.cos(φ) * .4;
      R = dark.r; G = dark.g; B = dark.b;
      sz = 1.5 + Math.random() * 1.2;
    } else {
      const a = -Math.PI * .6 + t * Math.PI * 1.2;
      const rad = 32 + (Math.random() - .5) * 4;
      x = rad * Math.cos(a); y = rad * Math.sin(a);
      z = (Math.random() - .5) * 8;
      const isEdge = Math.random() > .82;
      if (isEdge) { R = edge.r; G = edge.g; B = edge.b; sz = 2.0; }
      else { R = dark.r; G = dark.g; B = dark.b; sz = .9; }
    }
    s.tPos[i * 3] = x; s.tPos[i * 3 + 1] = y; s.tPos[i * 3 + 2] = z;
    s.tCol[i * 3] = R; s.tCol[i * 3 + 1] = G; s.tCol[i * 3 + 2] = B;
    s.tSiz[i] = sz; s.tAl[i] = 1;
  }
}

export const sysL = makePointSystem(CFG.N_REISHI);
export const sysR = makePointSystem(CFG.N_REISHI);
export const sysC = makePointSystem(CFG.N_TRAIL);

/* GEOMETRIC OVERLAYS — blade, beam, lightning, ring */
function makeBlade() {
  const blade = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(.6, 18, .25);
  const bladeMat = new THREE.MeshBasicMaterial({ color: 0x050508, transparent: true, opacity: .95 });
  const body = new THREE.Mesh(bladeGeo, bladeMat);
  body.position.y = 8;
  blade.add(body);

  const edgeGeo = new THREE.BoxGeometry(.7, 18.2, .05);
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: .9, blending: THREE.AdditiveBlending });
  const edge = new THREE.Mesh(edgeGeo, edgeMat);
  edge.position.set(.4, 8, 0);
  blade.add(edge);

  const hiltGeo = new THREE.SphereGeometry(.6, 12, 12);
  const hiltMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  blade.add(new THREE.Mesh(hiltGeo, hiltMat));
  blade.visible = false;
  scene.add(blade);
  return blade;
}
export const blade = makeBlade();

function makeCeroBeam() {
  const len = 70;
  const geo = new THREE.CylinderGeometry(2.2, 2.6, len, 24, 1, true);
  geo.translate(0, len / 2, 0);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: CFG.COLORS.cero }, uIntensity: { value: 1 } },
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uColor; uniform float uIntensity;
      varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9,78.2)))*43758.);}
      void main(){
        float r = abs(vUv.x-.5)*2.;
        float core = pow(1.-r, 3.);
        float noise = h(vec2(vUv.y*30., uTime*5.))*.4 + .6;
        float along = smoothstep(0.,.1,vUv.y) * smoothstep(1.,.9,vUv.y);
        float a = (core*1.5 + (1.-r)*.4) * noise * along * uIntensity;
        gl_FragColor = vec4(uColor*(1.+core*1.5), a);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.visible = false;
  scene.add(m);
  return m;
}
export const ceroBeam = makeCeroBeam();

function makeBakudoRing() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(14, .35, 16, 80),
    new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: .85, blending: THREE.AdditiveBlending })
  );
  g.add(ring);
  for (let i = 0; i < 6; i++) {
    const θ = i * Math.PI / 3;
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(.18, .18, 28, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe28a, transparent: true, opacity: .9, blending: THREE.AdditiveBlending })
    );
    bar.rotation.z = θ + Math.PI / 2;
    g.add(bar);
  }
  g.visible = false;
  scene.add(g);
  return g;
}
export const bakudoRing = makeBakudoRing();

function makeQuincyCross() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: .85, blending: THREE.AdditiveBlending });
  g.add(new THREE.Mesh(new THREE.PlaneGeometry(36, 1.4), mat));
  g.add(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 36), mat));
  g.visible = false;
  scene.add(g);
  return g;
}
export const quincyCross = makeQuincyCross();

const lightningGeo = new THREE.BufferGeometry();
const lightningPos = new Float32Array(64 * 3);
lightningGeo.setAttribute('position', new THREE.BufferAttribute(lightningPos, 3));
export const lightning = new THREE.LineSegments(
  lightningGeo,
  new THREE.LineBasicMaterial({ color: 0xaaccff, transparent: true, opacity: .85, blending: THREE.AdditiveBlending })
);
lightning.visible = false;
scene.add(lightning);

export function updateLightning(a, b, intensity = 1) {
  if (!a || !b || intensity < .05) { lightning.visible = false; return; }
  lightning.visible = true;
  const segs = 12;
  for (let i = 0; i < segs; i++) {
    const t1 = i / segs, t2 = (i + 1) / segs;
    const j = .9 * intensity;
    const p1x = a.x + (b.x - a.x) * t1 + (Math.random() - .5) * j;
    const p1y = a.y + (b.y - a.y) * t1 + (Math.random() - .5) * j;
    const p2x = a.x + (b.x - a.x) * t2 + (Math.random() - .5) * j;
    const p2y = a.y + (b.y - a.y) * t2 + (Math.random() - .5) * j;
    const idx = i * 6;
    lightningPos[idx] = p1x; lightningPos[idx + 1] = p1y; lightningPos[idx + 2] = 0;
    lightningPos[idx + 3] = p2x; lightningPos[idx + 4] = p2y; lightningPos[idx + 5] = 0;
  }
  lightningGeo.attributes.position.needsUpdate = true;
}

export function updateSys(s) {
  if (!s.visible && s.opacity <= 0) { s.pts.visible = false; return; }
  s.pts.visible = true;
  s.worldPos.lerp(s.targetPos, CFG.ANIM.lerpPos);
  s.pts.position.copy(s.worldPos);
  const fm = Math.max(0, s.opacity);
  for (let i = 0; i < s.count * 3; i++) {
    s.pos[i] += (s.tPos[i] - s.pos[i]) * CFG.ANIM.lerpMorph;
    s.col[i] += (s.tCol[i] - s.col[i]) * CFG.ANIM.lerpMorph;
  }
  for (let i = 0; i < s.count; i++) {
    s.siz[i] += (s.tSiz[i] - s.siz[i]) * CFG.ANIM.lerpMorph;
    s.al[i] += (s.tAl[i] * fm - s.al[i]) * CFG.ANIM.lerpMorph;
  }
  s.geo.attributes.position.needsUpdate = true;
  s.geo.attributes.aColor.needsUpdate = true;
  s.geo.attributes.aSize.needsUpdate = true;
  s.geo.attributes.aAlpha.needsUpdate = true;
}

import { Bus } from './event-bus.js';
import { TECHS } from './config.js';

Bus.on('tech:change', ({ current }) => {
  const T = TECHS[current] || TECHS.neutral;
  bloom.strength = T.bloom;
  gradePass.uniforms.uChroma.value = T.chroma;
  gradePass.uniforms.uTint.value.setRGB(...T.tint);
});

