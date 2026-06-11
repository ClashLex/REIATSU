import { CFG } from './config.js';

export const HandFilter = {
  L: null,
  R: null,
  update(label, lm) {
    const slot = label; // 'L' or 'R'
    if (!this[slot]) {
      this[slot] = lm.map(p => ({ ...p }));
    } else {
      const k = CFG.DETECT.landmarkLerp;
      for (let i = 0; i < lm.length; i++) {
        this[slot][i].x += (lm[i].x - this[slot][i].x) * k;
        this[slot][i].y += (lm[i].y - this[slot][i].y) * k;
        this[slot][i].z += (lm[i].z - this[slot][i].z) * k;
      }
    }
    return this[slot];
  },
  clear(slot) { this[slot] = null; }
};

export const lmPx = lm => ({ x: (1 - lm.x) * innerWidth, y: lm.y * innerHeight });

export const fingerUp = (lm, t, p) => lm[t].y < lm[p].y;

export function countFingers(lm) {
  let c = 0;
  for (const [t, p] of [[8, 6], [12, 10], [16, 14], [20, 18]]) {
    if (fingerUp(lm, t, p)) c++;
  }
  if (Math.abs(lm[4].x - lm[3].x) > .045) c++;
  return c;
}

export const isOpen = lm => countFingers(lm) >= 4;
export const isFist = lm => countFingers(lm) === 0;
export const isCurled = lm => countFingers(lm) <= 1 &&
                              Math.abs(lm[8].x - lm[5].x) < .07 &&
                              lm[8].y > lm[6].y - .005;

export function isPoint(lm) {
  const M = .035, F = .012;
  return (lm[6].y - lm[8].y) > M &&
         (lm[5].y - lm[8].y) > M &&
         (lm[12].y - lm[10].y) > F &&
         (lm[16].y - lm[14].y) > F &&
         (lm[20].y - lm[18].y) > F;
}

export const isThreeUp = lm => fingerUp(lm, 8, 6) &&
                               fingerUp(lm, 12, 10) &&
                               fingerUp(lm, 16, 14) &&
                               !fingerUp(lm, 20, 18);

export function pointDir(lm) {
  const wx = (1 - lm[0].x) * innerWidth, wy = lm[0].y * innerHeight;
  const tx = (1 - lm[8].x) * innerWidth, ty = lm[8].y * innerHeight;
  let dx = tx - wx, dy = ty - wy;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len, originX: tx, originY: ty };
}

export const conf = {
  shikai: 0, bankai: 0, quincy: 0, hollow: 0, point: 0, twoPoint: 0,
  curl: 0, threeBoth: 0, fusion: 0,
  ring(name, on) {
    const k = CFG.DETECT.confLerp;
    this[name] += ((on ? 1 : 0) - this[name]) * k;
    return this[name];
  },
  reset() {
    for (const k of Object.keys(this)) {
      if (typeof this[k] === 'number') this[k] = 0;
    }
  }
};
