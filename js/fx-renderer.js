import { w2s } from './particle-system.js';
import { AudioEngine } from './audio-engine.js';

const fxC = document.getElementById('fx'), fxX = fxC.getContext('2d');
const inkC = document.getElementById('ink'), inkX = inkC.getContext('2d');
const dbgC = document.getElementById('dbg'), dbgX = dbgC.getContext('2d');
const avisC = document.getElementById('avisC'), avisX = avisC.getContext('2d');

export { fxC, inkC, dbgC, avisC, fxX, inkX, dbgX, avisX };

export function resizeCanvases(w, h) {
  [fxC, inkC, dbgC].forEach(c => { c.width = w; c.height = h; });
  avisC.width = avisC.offsetWidth;
  avisC.height = avisC.offsetHeight;
}

const auras = [];
export function spawnAura(wx, wy, color, intensity = 1) {
  const s = w2s(new THREE.Vector3(wx, wy, 0));
  auras.push({
    x: s.x, y: s.y, r: 8, maxR: 60 + Math.random() * 70 * intensity,
    alpha: .7 * intensity, color, w: 2
  });
}

export function updateAuras() {
  fxX.clearRect(0, 0, fxC.width, fxC.height);
  for (let i = auras.length - 1; i >= 0; i--) {
    const a = auras[i];
    a.r += (a.maxR - a.r) * .07;
    a.alpha *= .94;
    if (a.alpha < .01) { auras.splice(i, 1); continue; }
    fxX.beginPath();
    fxX.arc(a.x, a.y, a.r, 0, Math.PI * 2);
    fxX.strokeStyle = a.color + Math.floor(a.alpha * 255).toString(16).padStart(2, '0');
    fxX.lineWidth = a.w;
    fxX.stroke();
  }
}

const inks = [];
export function spawnInk(x, y, intensity, color = '#ece4d4') {
  const n = 3 + Math.floor(intensity * 4);
  for (let i = 0; i < n; i++) {
    inks.push({
      x: x + (Math.random() - .5) * intensity * 45,
      y: y + (Math.random() - .5) * intensity * 45,
      r: 12 + Math.random() * intensity * 55,
      a: .45 + Math.random() * .35, life: 1,
      decay: .0025 + Math.random() * .005, color
    });
  }
}

export function updateInk() {
  inkX.clearRect(0, 0, inkC.width, inkC.height);
  for (let i = inks.length - 1; i >= 0; i--) {
    const s = inks[i]; s.life -= s.decay;
    if (s.life <= 0) { inks.splice(i, 1); continue; }
    const a = s.a * s.life * .25;
    inkX.beginPath();
    inkX.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    inkX.fillStyle = s.color + Math.floor(a * 255).toString(16).padStart(2, '0');
    inkX.fill();
  }
}

export function drawAudioVis(color) {
  if (!AudioEngine.ready) return;
  const f = AudioEngine.freqData();
  const W = avisC.width, H = avisC.height;
  avisX.clearRect(0, 0, W, H);
  const bins = Math.floor(f.length / 2.5), bw = W / bins;
  for (let i = 0; i < bins; i++) {
    const v = f[i] / 255; const h = v * H;
    const a = .25 + v * .7;
    avisX.fillStyle = color + Math.floor(a * 255).toString(16).padStart(2, '0');
    avisX.fillRect(i * bw, H - h, Math.max(1, bw - 1), h);
  }
}

const CONN = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
export function drawSkeleton(res, isPointCheck, pointDirCheck) {
  const W = dbgC.width, H = dbgC.height;
  dbgX.clearRect(0, 0, dbgC.width, dbgC.height);
  const handCount = res.multiHandLandmarks?.length || 0;
  if (handCount === 0) return;

  for (let h = 0; h < res.multiHandLandmarks.length; h++) {
    const lm = res.multiHandLandmarks[h];
    const label = res.multiHandedness[h].label;
    const c = label === 'Left' ? '#5aa8ff' : '#ece4d4';
    const isP = isPointCheck(lm);
    dbgX.strokeStyle = (isP ? '#ffd060' : c) + '99';
    dbgX.lineWidth = isP ? 2.5 : 1.4;
    for (const [a, b] of CONN) {
      dbgX.beginPath();
      dbgX.moveTo((1 - lm[a].x) * W, lm[a].y * H);
      dbgX.lineTo((1 - lm[b].x) * W, lm[b].y * H);
      dbgX.stroke();
    }
    for (let i = 0; i < lm.length; i++) {
      dbgX.beginPath();
      const r = (i === 8 && isP) ? 7 : (i === 0 ? 5 : 3);
      dbgX.arc((1 - lm[i].x) * W, lm[i].y * H, r, 0, Math.PI * 2);
      dbgX.fillStyle = i === 8 ? (isP ? '#ffd060' : '#fff') : c;
      dbgX.fill();
    }
    if (isP) {
      const d = pointDirCheck(lm);
      dbgX.strokeStyle = '#ffd060cc'; dbgX.lineWidth = 2;
      dbgX.beginPath();
      dbgX.moveTo(d.originX, d.originY);
      dbgX.lineTo(d.originX + d.x * 200, d.originY + d.y * 200);
      dbgX.stroke();
    }
  }
}
