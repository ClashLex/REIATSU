import * as THREE from 'three';
import { CFG, TECHS } from './config.js';
import { Bus } from './event-bus.js';
import { StateMachine } from './state-machine.js';
import { AudioEngine } from './audio-engine.js';
import { HandFilter, lmPx, isPoint, isThreeUp, isCurled, isFist, isOpen, pointDir, conf } from './gesture-engine.js';
import {
  scene, camera, renderer, composer, bloom, gradePass, resizeThree, s2w, w2s,
  sysL, sysR, sysC, blade, ceroBeam, bakudoRing, quincyCross, lightning,
  updateLightning, updateSys, threeCv
} from './particle-system.js';
import {
  resizeCanvases, spawnAura, updateAuras, spawnInk, updateInk, drawAudioVis, drawSkeleton
} from './fx-renderer.js';
import { ui, showBanner, showZan, showCharge } from './ui-manager.js';

/* ════════════════════════════════════════════════════════════════════════════
   STATE
   ════════════════════════════════════════════════════════════════════════════ */
let frame = 0, fps = 0, fpsT = performance.now(), fpsF = 0;
let shake = 0;
let getsugaActive = false, getsugaTimer = 0, getsugaSys = null;
let ceroActive = false, ceroTimer = 0, ceroOrigin = new THREE.Vector3(), ceroDir = new THREE.Vector3();
let mugetsuPhase = 0, mugetsuTimer = 0;
let bakudoActive = false, bakudoTimer = 0;
let fusionActive = false, fusionPhase = 0, fusionTimer = 0, fusionAngle = 0, fusionR = 18, fusionSpeed = .07;
let fusionCenter = new THREE.Vector3();
let pointHold = 0, pointCool = 0;
let chargeM = 0, chargeB = 0;
let lastL = null, lastR = null;

let currentTech = 'neutral';
Bus.on('tech:change', ({ current }) => {
  currentTech = current;
});

/* ════════════════════════════════════════════════════════════════════════════
   RESIZING COORDINATOR
   ════════════════════════════════════════════════════════════════════════════ */
function resizeAll() {
  const w = window.innerWidth, h = window.innerHeight;
  resizeThree(w, h);
  resizeCanvases(w, h);
}
resizeAll();
window.addEventListener('resize', resizeAll);

/* ════════════════════════════════════════════════════════════════════════════
   MEDIAPIPE AND GESTURE DELEGATES
   ════════════════════════════════════════════════════════════════════════════ */
const hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
hands.setOptions({
  maxNumHands: 2, modelComplexity: 1,
  minDetectionConfidence: CFG.DETECT.minDetect,
  minTrackingConfidence: CFG.DETECT.minTrack,
});
hands.onResults(onResults);

function onResults(res) {
  const handCount = res.multiHandLandmarks?.length || 0;
  ui.hudHands.textContent = handCount;

  if (pointCool > 0) pointCool--;

  if (handCount === 0) {
    fadeOut(sysL); fadeOut(sysR);
    HandFilter.clear('L'); HandFilter.clear('R');
    pointHold = 0; chargeM = 0; chargeB = 0;
    showCharge('', 0);
    if (!fusionActive && !getsugaActive && !ceroActive && mugetsuPhase === 0 && !bakudoActive) {
      StateMachine.transitionTo('neutral');
    }
    ui.hudGest.textContent = '--';
    ui.hudConf.textContent = '0%';
    return;
  }

  AudioEngine.init();
  drawSkeleton(res, isPoint, pointDir);

  let L = null, R = null;
  for (let i = 0; i < handCount; i++) {
    const label = res.multiHandedness[i].label;
    const filtered = HandFilter.update(label === 'Left' ? 'R' : 'L', res.multiHandLandmarks[i]);
    if (label === 'Left') R = filtered; else L = filtered;
  }
  lastL = L; lastR = R;

  // Lock during ongoing techniques
  if (fusionActive || getsugaActive || ceroActive || mugetsuPhase > 0) {
    ui.hudGest.textContent = 'LOCKED';
    return;
  }

  // ── MUGETSU charge: both hands 3-fingers ──
  const bothThree = L && R && isThreeUp(L) && isThreeUp(R);
  conf.ring('threeBoth', bothThree);
  if (conf.threeBoth > .7) {
    chargeM++;
    showCharge('無月 · MUGETSU', chargeM / CFG.DETECT.chargeMugetsu);
    ui.hudGest.textContent = 'MUGETSU CHARGE';
    if (chargeM >= CFG.DETECT.chargeMugetsu) { triggerMugetsu(); chargeM = 0; }
    return;
  } else { chargeM = 0; }

  // ── BAKUDO charge: both hands curled ──
  const bothCurled = L && R && isCurled(L) && isCurled(R);
  conf.ring('curl', bothCurled);
  if (conf.curl > .7 && !bakudoActive) {
    chargeB++;
    showCharge('縛道六十一 · BAKUDŌ', chargeB / CFG.DETECT.chargeBakudo);
    ui.hudGest.textContent = 'BAKUDŌ CHARGE';
    if (chargeB >= CFG.DETECT.chargeBakudo) { triggerBakudo(L, R); chargeB = 0; }
    return;
  } else { chargeB = 0; }
  showCharge('', 0);

  // ── HOLLOW (both fists) ──
  const bothFist = L && R && isFist(L) && isFist(R);
  conf.ring('hollow', bothFist);
  if (conf.hollow > .7) {
    activateHollow(L, R);
    ui.hudGest.textContent = 'HOLLOW';
    ui.hudConf.textContent = Math.round(conf.hollow * 100) + '%';
    return;
  }

  // ── TWO-POINT (CERO) — both hands point at each other or forward ──
  const lPoint = L && isPoint(L), rPoint = R && isPoint(R);
  conf.ring('twoPoint', lPoint && rPoint);
  if (conf.twoPoint > .65 && pointCool <= 0) {
    triggerCero(L, R);
    pointCool = CFG.DETECT.pointCooldown;
    return;
  }

  // ── SINGLE POINT → GETSUGA (must have reiatsu visible) ──
  if (pointCool <= 0 && (lPoint || rPoint) && !(lPoint && rPoint)) {
    pointHold++;
    ui.hudGest.textContent = 'POINT · ' + pointHold;
    if (pointHold >= CFG.DETECT.pointHold && (sysL.visible || sysR.visible)) {
      triggerGetsuga(rPoint ? R : L);
      pointCool = CFG.DETECT.pointCooldown;
      pointHold = 0;
      return;
    }
  } else {
    pointHold = 0;
  }

  // ── QUINCY (both open) ──
  const bothOpen = L && R && isOpen(L) && isOpen(R);
  conf.ring('quincy', bothOpen);
  if (conf.quincy > .7) {
    activateQuincy(L, R);
    ui.hudGest.textContent = 'QUINCY';
    ui.hudConf.textContent = Math.round(conf.quincy * 100) + '%';
    return;
  }

  // ── Single-hand SHIKAI / BANKAI ──
  const lOpen = L && isOpen(L), rOpen = R && isOpen(R);
  conf.ring('shikai', lOpen);
  conf.ring('bankai', rOpen);

  if (lOpen) activateShikai(lmPx(L[9]));
  else fadeOut(sysL);

  if (rOpen) activateBankai(lmPx(R[9]));
  else fadeOut(sysR);

  // FUSION when both palms come close
  if (sysL.visible && sysR.visible && lOpen && rOpen) {
    const lp = lmPx(L[9]), rp = lmPx(R[9]);
    const d = Math.hypot(lp.x - rp.x, lp.y - rp.y);
    if (d < 110) { triggerFusion(lp, rp); ui.hudGest.textContent = 'FUSION'; return; }
    StateMachine.transitionTo('shikai');
    ui.hudGest.textContent = 'SHIKAI+BANKAI';
  } else if (sysL.visible) { StateMachine.transitionTo('shikai'); ui.hudGest.textContent = 'SHIKAI'; }
  else if (sysR.visible) { StateMachine.transitionTo('bankai'); ui.hudGest.textContent = 'BANKAI'; }
  else { StateMachine.transitionTo('neutral'); ui.hudGest.textContent = 'IDLE'; }

  ui.hudConf.textContent = Math.round(Math.max(conf.shikai, conf.bankai) * 100) + '%';
}

/* ════════════════════════════════════════════════════════════════════════════
   ACTIVATORS
   ════════════════════════════════════════════════════════════════════════════ */
function activateShikai(px) {
  if (sysL.shape !== 'shikai') {
    shapeShikai(sysL); sysL.shape = 'shikai';
    showZan('斬月'); showBanner('始解', 'INITIAL RELEASE — ZANGETSU');
    AudioEngine.play('shikai', .8);
    spawnInk(px.x, px.y, 1.6, '#ece4d4');
  }
  sysL.targetPos.copy(s2w(px.x, px.y));
  sysL.visible = true; sysL.pts.visible = true;
  sysL.opacity = Math.min(1, sysL.opacity + CFG.ANIM.fadeIn);
}

function activateBankai(px) {
  if (sysR.shape !== 'bankai') {
    shapeBankai(sysR); sysR.shape = 'bankai';
    showZan('天鎖斬月'); showBanner('卍解', 'TENSA ZANGETSU');
    AudioEngine.play('bankai', .9);
    spawnInk(px.x, px.y, 2.2, '#888888');
    blade.visible = true;
  }
  sysR.targetPos.copy(s2w(px.x, px.y));
  sysR.visible = true; sysR.pts.visible = true;
  sysR.opacity = Math.min(1, sysR.opacity + CFG.ANIM.fadeIn);
  blade.position.copy(sysR.worldPos);
}

function activateQuincy(L, R) {
  const lp = lmPx(L[9]), rp = lmPx(R[9]);
  const cx = (lp.x + rp.x) / 2, cy = (lp.y + rp.y) / 2;
  if (sysL.shape !== 'quincy') { shapeQuincy(sysL); sysL.shape = 'quincy'; }
  if (sysR.shape !== 'quincy') { shapeQuincy(sysR); sysR.shape = 'quincy'; }
  const wp = s2w(cx, cy);
  sysL.targetPos.copy(wp); sysR.targetPos.copy(wp);
  sysL.visible = sysR.visible = true;
  sysL.pts.visible = sysR.pts.visible = true;
  sysL.opacity = Math.min(1, sysL.opacity + CFG.ANIM.fadeIn);
  sysR.opacity = Math.min(1, sysR.opacity + CFG.ANIM.fadeIn);
  quincyCross.visible = true;
  quincyCross.position.copy(wp);
  if (StateMachine.get() !== 'quincy') {
    StateMachine.transitionTo('quincy');
    showZan('光翼'); showBanner('滅却師', 'HEILIG BOGEN — LETZT STIL');
    AudioEngine.play('quincy', .8);
    spawnInk(cx, cy, 2.2, '#5aa8ff');
    spawnAura(wp.x, wp.y, '#5aa8ff', 1.4);
  }
}

function activateHollow(L, R) {
  const lp = lmPx(L[9]), rp = lmPx(R[9]);
  const cx = (lp.x + rp.x) / 2, cy = (lp.y + rp.y) / 2;
  if (sysL.shape !== 'hollow') { shapeHollow(sysL); sysL.shape = 'hollow'; }
  if (sysR.shape !== 'hollow') { shapeHollow(sysR); sysR.shape = 'hollow'; }
  const wp = s2w(cx, cy);
  sysL.targetPos.copy(new THREE.Vector3(wp.x - 9, wp.y, 0));
  sysR.targetPos.copy(new THREE.Vector3(wp.x + 9, wp.y, 0));
  sysL.visible = sysR.visible = true;
  sysL.pts.visible = sysR.pts.visible = true;
  sysL.opacity = Math.min(1, sysL.opacity + CFG.ANIM.fadeIn);
  sysR.opacity = Math.min(1, sysR.opacity + CFG.ANIM.fadeIn);
  if (StateMachine.get() !== 'hollow') {
    StateMachine.transitionTo('hollow');
    showZan('滅月'); showBanner('虚化', 'HOLLOW MASK RESONANCE');
    AudioEngine.play('hollow', .9);
    spawnInk(cx, cy, 3.2, '#ff5a00');
    spawnAura(wp.x, wp.y, '#ff5a00', 1.6);
  }
}

function triggerGetsuga(lm) {
  const dir = pointDir(lm);
  const wp = s2w(dir.originX, dir.originY);
  getsugaActive = true; getsugaTimer = 0;
  getsugaSys = sysC;
  shapeGetsuga(getsugaSys); getsugaSys.shape = 'getsuga';
  getsugaSys.pos.set(getsugaSys.tPos);
  getsugaSys.col.set(getsugaSys.tCol);
  getsugaSys.siz.set(getsugaSys.tSiz);
  getsugaSys.al.set(getsugaSys.tAl);
  getsugaSys.geo.attributes.position.needsUpdate = true;
  getsugaSys.geo.attributes.aColor.needsUpdate = true;
  getsugaSys.geo.attributes.aSize.needsUpdate = true;
  getsugaSys.geo.attributes.aAlpha.needsUpdate = true;
  getsugaSys.visible = true; getsugaSys.pts.visible = true; getsugaSys.opacity = 1;
  getsugaSys.worldPos.copy(wp); getsugaSys.targetPos.copy(wp);
  getsugaSys.pts.position.copy(wp);
  getsugaSys.velocity.set(dir.x, -dir.y, .5).normalize();
  getsugaSys.pts.rotation.z = Math.atan2(-dir.y, dir.x);
  StateMachine.transitionTo('getsuga');
  showBanner('月牙天衝', 'GETSUGA TENSHŌ');
  AudioEngine.play('getsuga', 1);
  spawnInk(dir.originX, dir.originY, 2.5, '#ece4d4');
  spawnAura(wp.x, wp.y, '#ece4d4', 2);
  shake = 1;
}

function triggerCero(L, R) {
  const lp = lmPx(L[9]), rp = lmPx(R[9]);
  const cx = (lp.x + rp.x) / 2, cy = (lp.y + rp.y) / 2;
  const dl = pointDir(L), dr = pointDir(R);
  const dx = (dl.x + dr.x) / 2, dy = (dl.y + dr.y) / 2;
  const len = Math.hypot(dx, dy) || 1;
  ceroActive = true; ceroTimer = 0;
  ceroOrigin.copy(s2w(cx, cy));
  ceroDir.set(dx / len, -dy / len, .3).normalize();
  ceroBeam.visible = true;
  ceroBeam.position.copy(ceroOrigin);
  ceroBeam.lookAt(ceroOrigin.clone().add(ceroDir.clone().multiplyScalar(10)));
  StateMachine.transitionTo('cero');
  showBanner('虚閃', 'CERO');
  AudioEngine.play('cero', 1);
  spawnInk(cx, cy, 3, '#ff5a00');
  spawnAura(ceroOrigin.x, ceroOrigin.y, '#ff5a00', 2.2);
  shake = 1.2;
}

function triggerBakudo(L, R) {
  bakudoActive = true; bakudoTimer = 0;
  const lp = lmPx(L[9]), rp = lmPx(R[9]);
  const cx = (lp.x + rp.x) / 2, cy = (lp.y + rp.y) / 2;
  const wp = s2w(cx, cy);
  bakudoRing.visible = true;
  bakudoRing.position.copy(wp);
  bakudoRing.rotation.set(0, 0, 0);
  StateMachine.transitionTo('bakudo');
  showZan('六杖光牢'); showBanner('縛道·六十一', 'RIKUJŌKŌRŌ');
  AudioEngine.play('bakudo', 1);
  spawnInk(cx, cy, 2.2, '#ffd060');
  spawnAura(wp.x, wp.y, '#ffd060', 1.5);
}

function triggerMugetsu() {
  mugetsuPhase = 1; mugetsuTimer = 0;
  shapeMugetsu(sysC); sysC.shape = 'mugetsu';
  sysC.pos.set(sysC.tPos); sysC.col.set(sysC.tCol);
  sysC.siz.set(sysC.tSiz); sysC.al.set(sysC.tAl);
  sysC.geo.attributes.position.needsUpdate = true;
  sysC.geo.attributes.aColor.needsUpdate = true;
  sysC.geo.attributes.aSize.needsUpdate = true;
  sysC.geo.attributes.aAlpha.needsUpdate = true;
  sysC.visible = true; sysC.pts.visible = true; sysC.opacity = 1;
  sysC.worldPos.set(0, 0, 0); sysC.targetPos.set(0, 0, 0);
  sysC.pts.position.set(0, 0, 0); sysC.pts.scale.set(1, 1, 1); sysC.pts.rotation.set(0, 0, 0);
  StateMachine.transitionTo('mugetsu');
  showZan('無月'); showBanner('無月', 'FINAL GETSUGA TENSHŌ', 3500);
  AudioEngine.play('mugetsu', 1);
  spawnInk(window.innerWidth / 2, window.innerHeight / 2, 6, '#222222');
  shake = 2.0;
}

function triggerFusion(lp, rp) {
  if (fusionActive) return;
  fusionActive = true; fusionPhase = 1; fusionTimer = 0;
  fusionAngle = 0; fusionR = 18; fusionSpeed = .07;
  fusionCenter.copy(s2w((lp.x + rp.x) / 2, (lp.y + rp.y) / 2));
  StateMachine.transitionTo('fusing');
  showBanner('解放', 'REIATSU CONVERGENCE');
  AudioEngine.play('fusion', 1);
  shake = .6;
}

function fadeOut(sys) {
  sys.opacity -= CFG.ANIM.fadeOut;
  if (sys.opacity <= 0) {
    sys.opacity = 0; sys.visible = false; sys.pts.visible = false; sys.shape = '';
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   ANIMATION TICK LOOP
   ════════════════════════════════════════════════════════════════════════════ */
function animate() {
  requestAnimationFrame(animate);
  frame++;
  const t = performance.now();
  fpsF++;
  if (t - fpsT > 800) {
    fps = Math.round(fpsF * 1000 / (t - fpsT));
    ui.hudFPS.textContent = fps;
    fpsF = 0; fpsT = t;
  }
  gradePass.uniforms.uTime.value = t * 0.001;
  ceroBeam.material.uniforms.uTime.value = t * 0.001;

  // ── Fusion progression ──
  if (fusionActive) {
    if (fusionPhase === 1 || fusionPhase === 2) {
      fusionAngle += fusionSpeed;
      fusionSpeed *= 1.025; fusionR *= .976;
      if (fusionPhase === 1 && fusionR < 12) fusionPhase = 2;
      const rx = fusionCenter.x + Math.cos(fusionAngle) * fusionR;
      const ry = fusionCenter.y + Math.sin(fusionAngle) * fusionR;
      const bx = fusionCenter.x + Math.cos(fusionAngle + Math.PI) * fusionR;
      const by = fusionCenter.y + Math.sin(fusionAngle + Math.PI) * fusionR;
      sysL.worldPos.set(rx, ry, 0); sysL.targetPos.set(rx, ry, 0); sysL.pts.position.set(rx, ry, 0);
      sysR.worldPos.set(bx, by, 0); sysR.targetPos.set(bx, by, 0); sysR.pts.position.set(bx, by, 0);
      sysL.pts.rotation.z += .15; sysR.pts.rotation.z -= .15;

      const a = w2s(sysL.worldPos), b = w2s(sysR.worldPos);
      const fxX = document.getElementById('fx').getContext('2d');
      fxX.strokeStyle = '#ffffffcc'; fxX.lineWidth = 1.2;
      fxX.beginPath();
      const segs = 14;
      for (let i = 0; i < segs; i++) {
        const t1 = i / segs, t2 = (i + 1) / segs;
        const j = 18 * (1 - t1 * .5);
        const x1 = a.x + (b.x - a.x) * t1 + (Math.random() - .5) * j;
        const y1 = a.y + (b.y - a.y) * t1 + (Math.random() - .5) * j;
        const x2 = a.x + (b.x - a.x) * t2 + (Math.random() - .5) * j;
        const y2 = a.y + (b.y - a.y) * t2 + (Math.random() - .5) * j;
        if (i === 0) fxX.moveTo(x1, y1); else fxX.lineTo(x1, y1);
      }
      fxX.stroke();
      if (frame % 6 === 0) { spawnAura(rx, ry, '#ece4d4'); spawnAura(bx, by, '#888888'); }
      if (fusionR < 1.5) {
        fusionPhase = 3; fusionTimer = 0;
        shapeHollow(sysL); shapeHollow(sysR);
        sysL.shape = sysR.shape = 'hollow';
        for (let i = 0; i < sysL.count * 3; i++) {
          const j1 = (Math.random() - .5) * 70, j2 = (Math.random() - .5) * 70;
          sysL.pos[i] += j1; sysL.tPos[i] += j1;
          sysR.pos[i] += j2; sysR.tPos[i] += j2;
        }
        sysL.geo.attributes.position.needsUpdate = true;
        sysR.geo.attributes.position.needsUpdate = true;
        sysL.worldPos.copy(fusionCenter); sysR.worldPos.copy(fusionCenter);
        sysL.targetPos.copy(fusionCenter); sysR.targetPos.copy(fusionCenter);
        showBanner('解放完了', 'TRANSCENDENCE');
        showZan('滅月');
        AudioEngine.play('fusion', 1);
        for (let k = 0; k < 8; k++) {
          spawnAura(fusionCenter.x + (Math.random() - .5) * 30, fusionCenter.y + (Math.random() - .5) * 20, '#ff5a00', 2);
        }
        spawnInk(window.innerWidth / 2, window.innerHeight / 2, 4, '#ff5a00');
        shake = 2;
      }
    } else if (fusionPhase === 3) {
      fusionTimer++;
      const p = fusionTimer / 55;
      shake = 2 * (1 - p);
      if (fusionTimer >= 55) {
        fusionActive = false; fusionPhase = 0;
        StateMachine.transitionTo('hollow');
      }
    }
  }

  // ── Getsuga ──
  if (getsugaActive && getsugaSys) {
    getsugaTimer++;
    const p = getsugaTimer / 85;
    const speed = 22 * (1 + p * 5);
    const v = getsugaSys.velocity;
    getsugaSys.worldPos.x += v.x * speed * .6;
    getsugaSys.worldPos.y += v.y * speed * .6;
    getsugaSys.worldPos.z += speed * .7;
    getsugaSys.targetPos.copy(getsugaSys.worldPos);
    getsugaSys.pts.position.copy(getsugaSys.worldPos);
    const sc = 1 + p * 4.5;
    getsugaSys.pts.scale.set(sc, sc, sc);
    shake = 1 * (1 - p);
    if (frame % 3 === 0) spawnAura(getsugaSys.worldPos.x, getsugaSys.worldPos.y, '#ece4d4', 1.5);
    if (getsugaTimer > 85 || getsugaSys.worldPos.z > CFG.CAM.z + 30) {
      getsugaSys.visible = false; getsugaSys.pts.visible = false;
      getsugaSys.opacity = 0; getsugaSys.shape = '';
      getsugaSys.pts.scale.set(1, 1, 1); getsugaSys.pts.rotation.set(0, 0, 0);
      getsugaSys.worldPos.set(0, 0, 0); getsugaSys.targetPos.set(0, 0, 0);
      getsugaSys = null; getsugaActive = false;
      StateMachine.transitionTo('neutral');
    }
  }

  // ── Cero ──
  if (ceroActive) {
    ceroTimer++;
    const p = ceroTimer / 95;
    const intensity = Math.min(1, p * 4) * (1 - Math.max(0, p - .7) / .3);
    ceroBeam.material.uniforms.uIntensity.value = intensity;
    const sc = .4 + p * 3.5;
    ceroBeam.scale.set(1 + sc * .6, 1 + sc * .6, 1 + sc * 1.4);
    shake = 1.2 * (1 - p * .7);
    if (frame % 4 === 0) {
      const fwd = ceroOrigin.clone().add(ceroDir.clone().multiplyScalar(20 + p * 40));
      spawnAura(fwd.x, fwd.y, '#ff5a00', 1.4);
    }
    if (ceroTimer > 95) {
      ceroActive = false;
      ceroBeam.visible = false;
      ceroBeam.scale.set(1, 1, 1);
      StateMachine.transitionTo('neutral');
    }
  }

  // ── Bakudo ──
  if (bakudoActive) {
    bakudoTimer++;
    bakudoRing.rotation.z += .025;
    bakudoRing.rotation.x = Math.sin(bakudoTimer * .05) * .15;
    if (bakudoTimer > 200) {
      bakudoActive = false;
      bakudoRing.visible = false;
      StateMachine.transitionTo('neutral');
    }
  } else {
    if (StateMachine.get() !== 'bakudo') bakudoRing.visible = false;
  }

  // ── Mugetsu ──
  if (mugetsuPhase === 1) {
    mugetsuTimer++;
    sysC.pts.rotation.z -= .005;
    if (frame % 4 === 0) spawnAura((Math.random() - .5) * 30, (Math.random() - .5) * 20, '#aaa', 1.5);
    shake = 2 * Math.exp(-mugetsuTimer * .015);
    if (mugetsuTimer > 200) { mugetsuPhase = 2; mugetsuTimer = 0; }
  } else if (mugetsuPhase === 2) {
    sysC.opacity -= .015;
    if (sysC.opacity <= 0) {
      sysC.opacity = 0; sysC.visible = false; sysC.pts.visible = false;
      sysC.shape = ''; mugetsuPhase = 0;
      StateMachine.transitionTo('neutral');
    }
  }

  // ── Hide overlay meshes when not in those modes ──
  if (StateMachine.get() !== 'bankai' && !fusionActive) blade.visible = false;
  else if (sysR.visible && !fusionActive) {
    blade.visible = true;
    blade.position.copy(sysR.worldPos);
    blade.position.y += 4;
    blade.rotation.z = Math.sin(frame * .04) * .15 - .3;
  }
  if (StateMachine.get() !== 'quincy') quincyCross.visible = false;
  else {
    quincyCross.rotation.z += .008;
    quincyCross.rotation.y += .004;
  }

  // ── Lightning between hands during shikai+bankai ──
  if (sysL.visible && sysR.visible && !fusionActive && !getsugaActive && !ceroActive
      && (StateMachine.get() === 'shikai' || StateMachine.get() === 'bankai')) {
    updateLightning(sysL.worldPos, sysR.worldPos, .5);
    lightning.material.opacity = .4 + Math.random() * .4;
  } else { lightning.visible = false; }

  // ── Idle rotations ──
  if (!fusionActive && !getsugaActive && !ceroActive && mugetsuPhase === 0) {
    const rotMap = {
      shikai: [.055, -.055], bankai: [-.07, .085], quincy: [.04, -.04],
      hollow: [-.10, .12], bakudo: [.015, .015],
      neutral: [CFG.ANIM.neutralRot, -CFG.ANIM.neutralRot],
    };
    const r = rotMap[StateMachine.get()] || rotMap.neutral;
    sysL.pts.rotation.z += r[0];
    sysR.pts.rotation.z += r[1];
  }
  // Bankai pulse scale
  if (StateMachine.get() === 'bankai' && !fusionActive) {
    const p = 1 + Math.sin(frame * .05) * .06;
    sysR.pts.scale.set(p, p, p);
  } else if (StateMachine.get() !== 'getsuga') sysR.pts.scale.set(1, 1, 1);

  // ── Auras for active states ──
  if (frame % 18 === 0) {
    if (sysL.visible && StateMachine.get() !== 'getsuga' && StateMachine.get() !== 'cero') {
      spawnAura(sysL.worldPos.x, sysL.worldPos.y,
        StateMachine.get() === 'hollow' ? '#ff5a00' : '#ece4d4', .8);
    }
    if (sysR.visible && StateMachine.get() !== 'getsuga' && StateMachine.get() !== 'cero') {
      spawnAura(sysR.worldPos.x, sysR.worldPos.y,
        StateMachine.get() === 'hollow' ? '#ff5a00' : '#dddddd', .8);
    }
  }

  // ── Update systems ──
  updateSys(sysL); updateSys(sysR); updateSys(sysC);
  updateInk(); updateAuras();
  drawAudioVis((TECHS[StateMachine.get()] || TECHS.neutral).color);

  // ── Camera shake ──
  if (shake > .01) {
    const s = shake * 14;
    threeCv.style.transform = `translate(${(Math.random() - .5) * s}px,${(Math.random() - .5) * s}px)`;
    ui.cam.style.transform = `scaleX(-1) translate(${(Math.random() - .5) * s * .3}px,${(Math.random() - .5) * s * .3}px)`;
    shake *= .92;
  } else {
    threeCv.style.transform = '';
    ui.cam.style.transform = 'scaleX(-1)';
    shake = 0;
  }

  composer.render();
}
animate();

/* ════════════════════════════════════════════════════════════════════════════
   CAMERA AND INTERACTION BOOTSTRAP
   ════════════════════════════════════════════════════════════════════════════ */
const vid = document.getElementById('cam');
function startCamera() {
  if (typeof Camera !== 'undefined') {
    try {
      new Camera(vid, {
        onFrame: async () => {
          await hands.send({ image: vid });
        },
        width: CFG.CAM.w, height: CFG.CAM.h,
      }).start();
      return;
    } catch (e) { console.warn('Camera helper failed', e); }
  }
  
  navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: CFG.CAM.w }, height: { ideal: CFG.CAM.h }, facingMode: 'user' }
  }).then(stream => {
    vid.srcObject = stream; vid.play();
    let busy = false;
    async function tick() {
      if (vid.readyState >= 2 && !busy) {
        busy = true;
        try { await hands.send({ image: vid }); } catch (e) {}
        busy = false;
      }
      requestAnimationFrame(tick);
    }
    vid.addEventListener('loadeddata', tick);
  }).catch(err => console.error('Camera error', err));
}
startCamera();

// User-gesture audio unlock
addEventListener('pointerdown', () => AudioEngine.init(), { once: false });
addEventListener('keydown', () => AudioEngine.init(), { once: false });
