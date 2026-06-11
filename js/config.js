import * as THREE from 'three';

export const CFG = {
  N_REISHI: 8000,        // particles per hand cloud
  N_TRAIL:  3000,        // particles in slash/cero trail
  CAM:    { w:1280, h:720, z:55, fov:65 },
  BLOOM:  { strength:0.7, radius:.55, threshold:.78 },
  DETECT: {
    minDetect:.7, minTrack:.6,
    pointHold:3, pointCooldown:30,
    chargeMugetsu:55, chargeBakudo:35,
    confLerp:.18,           // gesture confidence smoothing
    landmarkLerp:.55,       // landmark smoothing
  },
  ANIM:   { lerpPos:.42, lerpMorph:.10, fadeIn:.08, fadeOut:.05, neutralRot:.003 },
  COLORS: {
    shikai:  new THREE.Color(.95,1.0,1.1),
    bankai:  new THREE.Color(.15,.18,.25),
    bankaiE: new THREE.Color(2.2,2.0,1.6),   // edge glow
    quincy:  new THREE.Color(.35,.7,3.0),
    hollow:  new THREE.Color(2.5,.5,.05),
    cero:    new THREE.Color(2.8,.3,.15),
    getsuga: new THREE.Color(2.2,1.9,1.4),
    bakudo:  new THREE.Color(2.2,1.7,.5),
    mugetsu: new THREE.Color(.05,.05,.08),
    mugetsuE:new THREE.Color(1.0,.85,.6),
  },
};

export const TECHS = {
  neutral:{ jp:'待機', en:'STANDBY',
    bars:{reiatsu:0,bankai:0,hollow:0,quincy:0,kido:0},
    drone:0, droneVol:0, chroma:0, tint:[1,1,1], camCls:'',
    color:'#7a7468', bloom:0.7, shake:0 },
  shikai:{ jp:'始解', en:'INITIAL · ZANGETSU',
    bars:{reiatsu:75,bankai:10,hollow:5,quincy:0,kido:25},
    drone:440, droneVol:.04, chroma:.3, tint:[1.05,1.05,1.1], camCls:'shikai',
    color:'#ece4d4', bloom:1.0, shake:.12 },
  bankai:{ jp:'卍解', en:'FINAL · TENSA ZANGETSU',
    bars:{reiatsu:100,bankai:95,hollow:18,quincy:0,kido:45},
    drone:110, droneVol:.06, chroma:.55, tint:[1.0,.95,1.05], camCls:'bankai',
    color:'#dddddd', bloom:1.2, shake:.32 },
  quincy:{ jp:'滅却師', en:'QUINCY · HEILIG BOGEN',
    bars:{reiatsu:65,bankai:0,hollow:0,quincy:100,kido:30},
    drone:880, droneVol:.045, chroma:.8, tint:[.85,.95,1.2], camCls:'quincy',
    color:'#5aa8ff', bloom:1.1, shake:.18 },
  hollow:{ jp:'虚化', en:'HOLLOWIFICATION',
    bars:{reiatsu:100,bankai:55,hollow:100,quincy:0,kido:20},
    drone:60, droneVol:.06, chroma:.45, tint:[1.2,.85,.7], camCls:'hollow',
    color:'#ff5a00', bloom:1.2, shake:.32 },
  getsuga:{ jp:'月牙天衝', en:'GETSUGA TENSHŌ',
    bars:{reiatsu:100,bankai:80,hollow:35,quincy:0,kido:60},
    drone:0, droneVol:0, chroma:.95, tint:[1.1,1.05,.95], camCls:'shikai',
    color:'#ece4d4', bloom:1.5, shake:1.0 },
  cero:{ jp:'虚閃', en:'CERO',
    bars:{reiatsu:100,bankai:30,hollow:100,quincy:0,kido:15},
    drone:0, droneVol:0, chroma:1.1, tint:[1.25,.85,.7], camCls:'cero',
    color:'#ff5a00', bloom:1.6, shake:1.2 },
  bakudo:{ jp:'縛道', en:'BAKUDŌ #61',
    bars:{reiatsu:55,bankai:0,hollow:0,quincy:0,kido:100},
    drone:330, droneVol:.04, chroma:.4, tint:[1.1,1.05,.85], camCls:'bakudo',
    color:'#ffd060', bloom:1.0, shake:.15 },
  fusing:{ jp:'解放', en:'REIATSU MERGE',
    bars:{reiatsu:100,bankai:100,hollow:75,quincy:0,kido:30},
    drone:220, droneVol:.07, chroma:.7, tint:[1.1,1.0,.95], camCls:'',
    color:'#ffffff', bloom:1.4, shake:.5 },
  mugetsu:{ jp:'無月', en:'FINAL GETSUGA · MUGETSU',
    bars:{reiatsu:100,bankai:100,hollow:100,quincy:0,kido:0},
    drone:55, droneVol:.08, chroma:1.6, tint:[.85,.85,.95], camCls:'mugetsu',
    color:'#aaaaaa', bloom:1.4, shake:2.2 },
};
