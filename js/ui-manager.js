import { TECHS } from './config.js';
import { Bus } from './event-bus.js';

export const ui = {
  techJP: document.getElementById('techJP'),
  techEN: document.getElementById('techEN'),
  techBox: document.getElementById('tech'),
  zan: document.getElementById('zan'),
  banner: document.getElementById('banner'),
  bannerEp: document.getElementById('bannerEp'),
  bannerDesc: document.getElementById('bannerDesc'),
  cam: document.getElementById('cam'),
  hudFPS: document.getElementById('hudFPS'),
  hudTech: document.getElementById('hudTech'),
  hudHands: document.getElementById('hudHands'),
  hudGest: document.getElementById('hudGest'),
  hudConf: document.getElementById('hudConf'),
  charge: document.getElementById('charge'),
  chargeFill: document.getElementById('chargeFill'),
  chargeLabel: document.getElementById('chargeLabel'),
  avis: document.getElementById('avis'),
  pulse: document.getElementById('pulse'),
  mug: document.getElementById('mug'),
  bars: ['reiatsu', 'bankai', 'hollow', 'quincy', 'kido'].reduce((o, k) => {
    o[k] = { fill: document.getElementById('b-' + k), num: document.getElementById('n-' + k) }; return o;
  }, {}),
};

let showBannerTimeout = null;
export function showBanner(ep, desc, dur = 2200) {
  ui.bannerEp.textContent = ep;
  ui.bannerDesc.textContent = desc;
  ui.banner.style.opacity = '1';
  clearTimeout(showBannerTimeout);
  showBannerTimeout = setTimeout(() => ui.banner.style.opacity = '0', dur);
}

let showZanTimeout = null;
export function showZan(name, dur = 1700) {
  ui.zan.textContent = name;
  ui.zan.classList.add('live');
  clearTimeout(showZanTimeout);
  showZanTimeout = setTimeout(() => ui.zan.classList.remove('live'), dur);
}

export function showCharge(label, p) {
  ui.charge.style.opacity = p > 0 ? '1' : '0';
  ui.chargeLabel.textContent = label;
  ui.chargeFill.style.width = (Math.min(1, p) * 100) + '%';
  const hue = Math.round(60 - p * 60); // gold→red
  ui.chargeFill.style.background = `hsl(${hue},100%,75%)`;
  ui.chargeFill.style.boxShadow = `0 0 12px hsl(${hue},100%,75%)`;
}

// React to technique change to update DOM UI elements
Bus.on('tech:change', ({ current }) => {
  const T = TECHS[current] || TECHS.neutral;
  ui.techJP.textContent = T.jp;
  ui.techEN.textContent = T.en;
  ui.techJP.style.color = T.color;
  ui.techJP.style.textShadow = `0 0 22px ${T.color}aa`;
  ui.techEN.style.color = T.color + 'aa';
  ui.techBox.classList.toggle('live', current !== 'neutral');

  for (const k of Object.keys(ui.bars)) {
    ui.bars[k].fill.style.width = T.bars[k] + '%';
    ui.bars[k].num.textContent = T.bars[k];
  }

  ui.cam.className = T.camCls;
  ui.avis.style.opacity = current !== 'neutral' ? '1' : '0';
  ui.mug.style.opacity = current === 'mugetsu' ? '.92' : '0';
  ui.hudTech.textContent = current.toUpperCase();

  // Trigger pulse effect
  ui.pulse.style.opacity = '.9';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ui.pulse.style.opacity = '0';
    });
  });
});
