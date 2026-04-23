// Global State
let state = {
  hunterName: '',
  credits: 0,
  bountiesClaimed: 0,
  hasBoerboel: false,
  hasCoffee: false,
  multiplier: 1,
  currentQuest: null,
  selectedCar: 'hypercar',
  timeLeft: 0
};

// --- Hyper-Fidelity Audio System ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.gain.value = 0.2;
masterGain.connect(audioCtx.destination);

const sounds = {
  playLaser: () => {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  },
  playExplosion: () => {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const bufferSize = audioCtx.sampleRate * 0.5;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(1.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start();
  },
  engineNode: null,
  startEngine: () => {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    if(sounds.engineNode) return;
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 50;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.0;
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    sounds.engineNode = { osc, gain };
  },
  updateEngine: (speedRatio) => {
    if(!sounds.engineNode) return;
    const targetFreq = 40 + speedRatio * 100;
    const targetGain = speedRatio * 0.2;
    sounds.engineNode.osc.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.1);
    sounds.engineNode.gain.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.1);
  }
};
document.addEventListener('click', () => { if(audioCtx.state === 'suspended') audioCtx.resume(); sounds.startEngine(); }, {once:true});


// DOM Elements
const authOverlay = document.getElementById('auth-overlay');
const carSelectOverlay = document.getElementById('car-select-overlay');
const btnJoin = document.getElementById('btn-join');
const btnLaunch = document.getElementById('btn-launch');
const inputHandle = document.getElementById('input-handle');
const uiLayer = document.getElementById('ui-layer');

const hudBounties = document.getElementById('hud-bounties');
const hudCredits = document.getElementById('hud-credits');
const hudTarget = document.getElementById('hud-target');
const hudTimer = document.getElementById('hud-timer');
const hitFlash = document.getElementById('hit-flash');
const radarBlips = document.getElementById('radar-blips');
const viewChase = document.getElementById('view-chase');
const btnTheme = document.getElementById('btn-theme');

// Keyboard Controls
const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false };
let usingKeyboard = false;

window.addEventListener('keydown', (e) => {
  if (keys.hasOwnProperty(e.key)) {
    keys[e.key] = true;
    usingKeyboard = true;
  }
});
window.addEventListener('keyup', (e) => {
  if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

// --- Three.js Setup (Martian Dawn & Deep Space Themes) ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

let isNight = false;

// Procedural Building Textures for High Fidelity
const bldgCanvas = document.createElement('canvas');
bldgCanvas.width = 256; bldgCanvas.height = 256;
const bCtx = bldgCanvas.getContext('2d');
bCtx.fillStyle = '#050505'; bCtx.fillRect(0,0,256,256);
bCtx.fillStyle = '#1a1a1a';
for(let i=0; i<256; i+=16) {
  bCtx.fillRect(0, i, 256, 3);
  bCtx.fillRect(i, 0, 3, 256);
}
const bldgTex = new THREE.CanvasTexture(bldgCanvas);
bldgTex.wrapS = THREE.RepeatWrapping; bldgTex.wrapT = THREE.RepeatWrapping;

// --- Procedural Carbon Fiber Texture ---
const cfCanvas = document.createElement('canvas');
cfCanvas.width = 512; cfCanvas.height = 512;
const cfCtx = cfCanvas.getContext('2d');
cfCtx.fillStyle = '#111111'; cfCtx.fillRect(0,0,512,512);
cfCtx.fillStyle = '#333333';
for(let i=0; i<512; i+=8) {
  for(let j=0; j<512; j+=8) {
    if((Math.floor(i/8)+Math.floor(j/8))%2 === 0) {
      cfCtx.fillRect(i, j, 8, 4);
    } else {
      cfCtx.fillRect(i+4, j, 4, 8);
    }
  }
}
const cfTex = new THREE.CanvasTexture(cfCanvas);
cfTex.wrapS = THREE.RepeatWrapping; cfTex.wrapT = THREE.RepeatWrapping;
cfTex.repeat.set(12, 12);

// --- Static Shader for Reptilians ---
const staticShaderMat = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0.0 },
    color: { value: new THREE.Color(0x00ffaa) }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform vec3 color;
    varying vec2 vUv;
    float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }
    void main() {
      float staticNoise = rand(vUv * time * 10.0);
      float scan = sin(vUv.y * 100.0 + time * 10.0) * 0.5 + 0.5;
      vec3 finalCol = mix(color, vec3(1.0), staticNoise * 0.5) * scan;
      gl_FragColor = vec4(finalCol, 0.8 + staticNoise * 0.2);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide
});

// Shared Materials
const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a0505, roughness: 0.9, metalness: 0.1 });
const bldgMats = [];
const baseColors = [0x113355, 0x551122, 0x115533, 0x444444, 0x224455, 0x554422, 0x111111, 0x662211, 0x221166];
for(let i=0; i<baseColors.length; i++) {
  bldgMats.push(new THREE.MeshStandardMaterial({
    color: baseColors[i], roughness: 0.4, metalness: 0.6,
    map: bldgTex,
    emissive: 0x000000, emissiveIntensity: 0
  }));
}
const roofMats = [
  new THREE.MeshBasicMaterial({ color: 0x00f3ff }),
  new THREE.MeshBasicMaterial({ color: 0xff003c }),
  new THREE.MeshBasicMaterial({ color: 0xb026ff })
];

scene.fog = new THREE.FogExp2(0x3a0d14, 0.0015);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 4000);
camera.position.set(0, 5, 25);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
bldgTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
let envMapTexture;

// Global Dynamic Entities Arrays
const animatableObjects = [];
const shockwaves = [];
const shockwaveGeo = new THREE.SphereGeometry(1, 32, 32);
const shockwaveMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, wireframe: true });

// Lighting
const ambientLight = new THREE.AmbientLight(0xffaa88, 0.6);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xff4400, 2.5);
sunLight.position.set(500, 1000, 200);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 100;
sunLight.shadow.camera.far = 2000;
sunLight.shadow.camera.left = -500;
sunLight.shadow.camera.right = 500;
sunLight.shadow.camera.top = 500;
sunLight.shadow.camera.bottom = -500;
scene.add(sunLight);

// Massive Floor
const worldFloor = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), floorMat);
worldFloor.rotation.x = -Math.PI / 2;
worldFloor.receiveShadow = true;
scene.add(worldFloor);

// --- Cosmic Skybox (Stars & Galaxies) ---
const skyGroup = new THREE.Group();
scene.add(skyGroup);

// 1. Starfield
const starCount = 8000;
const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(starCount * 3);
const starColors = new Float32Array(starCount * 3);
for(let i=0; i<starCount; i++) {
  const r = 2500 + Math.random() * 1000;
  const theta = 2 * Math.PI * Math.random();
  const phi = Math.acos(2 * Math.random() - 1);
  starPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
  starPos[i*3+1] = Math.abs(r * Math.cos(phi)); 
  starPos[i*3+2] = r * Math.sin(phi) * Math.sin(theta);

  const colorType = Math.random();
  let c = new THREE.Color(0xffffff);
  if (colorType > 0.8) c.setHex(0xaaccff);
  else if (colorType > 0.6) c.setHex(0xffddaa);
  
  const intensity = 0.5 + Math.random() * 0.5;
  starColors[i*3] = c.r * intensity;
  starColors[i*3+1] = c.g * intensity;
  starColors[i*3+2] = c.b * intensity;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
const starMat = new THREE.PointsMaterial({ size: 1.5, vertexColors: true, transparent: true, opacity: 0.8, fog: false, sizeAttenuation: false });
const stars = new THREE.Points(starGeo, starMat);
skyGroup.add(stars);

// 2. Procedural Galaxies
const galaxyMats = [];
function createGalaxy(color1, color2, scale, posX, posY, posZ, rotX, rotY, rotZ) {
  const gCount = 4000;
  const gGeo = new THREE.BufferGeometry();
  const gPos = new Float32Array(gCount * 3);
  const gCol = new Float32Array(gCount * 3);
  const c1 = new THREE.Color(color1);
  const c2 = new THREE.Color(color2);

  for(let i=0; i<gCount; i++) {
    const radius = Math.random() * scale;
    const angle = radius * 0.05 + Math.random() * Math.PI * 2;
    const spread = (scale - radius) * 0.15 * (Math.random() - 0.5);
    
    gPos[i*3] = Math.cos(angle) * radius + spread;
    gPos[i*3+1] = (Math.random() - 0.5) * scale * 0.1;
    gPos[i*3+2] = Math.sin(angle) * radius + spread;

    const mixRatio = radius / scale;
    const pColor = c1.clone().lerp(c2, mixRatio);
    gCol[i*3] = pColor.r;
    gCol[i*3+1] = pColor.g;
    gCol[i*3+2] = pColor.b;
  }
  gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  gGeo.setAttribute('color', new THREE.BufferAttribute(gCol, 3));
  const gMat = new THREE.PointsMaterial({ size: 2.5, vertexColors: true, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: false });
  galaxyMats.push(gMat);
  const galaxy = new THREE.Points(gGeo, gMat);
  galaxy.position.set(posX, posY, posZ);
  galaxy.rotation.set(rotX, rotY, rotZ);
  skyGroup.add(galaxy);
  return galaxy;
}

createGalaxy(0xb026ff, 0x00f3ff, 800, -1200, 1200, -2000, 0.4, -0.2, 0.5);
createGalaxy(0xff4400, 0xffaa88, 600, 1500, 900, -1800, -0.2, 0.5, 0.1);
createGalaxy(0x00ffaa, 0x0055ff, 500, 0, 1800, 1500, 0.8, 0.0, -0.3);

// "Tear in the Sky" Background Anomaly
const tearGroup = new THREE.Group();
const tearMat1 = new THREE.MeshBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const tearMat2 = new THREE.MeshBasicMaterial({ color: 0xb026ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const tGeo1 = new THREE.PlaneGeometry(800, 30);
const tGeo2 = new THREE.PlaneGeometry(1200, 15);
const tMesh1 = new THREE.Mesh(tGeo1, tearMat1);
const tMesh2 = new THREE.Mesh(tGeo2, tearMat2);
tMesh2.position.z = -20;
tearGroup.add(tMesh1, tMesh2);
tearGroup.position.set(0, 350, -3000);
tearGroup.rotation.z = Math.PI / 8;
scene.add(tearGroup);

function applyTheme() {
  const btnThemeEl = document.getElementById('btn-theme');
  if (isNight) {
    scene.background = new THREE.Color(0x05000a);
    scene.fog.color.setHex(0x05000a);
    scene.fog.density = 0.0012;
    ambientLight.color.setHex(0x401060);
    ambientLight.intensity = 0.5;
    sunLight.color.setHex(0x88bbff);
    sunLight.intensity = 0.8;
    floorMat.color.setHex(0x110515); // dark asphalt
    bldgMats.forEach((m, i) => {
      m.emissive.setHex(i % 2 === 0 ? 0x00f3ff : 0xb026ff);
      m.emissiveIntensity = 0.6 + Math.random() * 0.4;
    });
    if(btnThemeEl) btnThemeEl.textContent = "Theme: Deep Space";
  } else {
    scene.background = new THREE.Color(0x2a0d0a);
    scene.fog.color.setHex(0x2a0d0a);
    scene.fog.density = 0.0006; 
    ambientLight.color.setHex(0xff8866);
    ambientLight.intensity = 0.3; 
    sunLight.color.setHex(0xff3300);
    sunLight.intensity = 4.0;
    sunLight.position.set(2000, 500, 1000);
    floorMat.color.setHex(0x3a1a0a); // base red dirt
    bldgMats.forEach(m => {
      m.emissive.setHex(0x000000);
      m.emissiveIntensity = 0.0;
    });
    if(btnThemeEl) btnThemeEl.textContent = "Theme: Martian Dawn";
  }
  
  if (typeof starMat !== 'undefined') {
    starMat.opacity = isNight ? 1.0 : 0.4;
    galaxyMats.forEach(m => m.opacity = isNight ? 0.9 : 0.3);
  }

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(isNight ? 0x05000a : 0x2a0d0a);
  const s = new THREE.Mesh(new THREE.SphereGeometry(100,16,16), new THREE.MeshBasicMaterial({color: isNight ? 0x88bbff : 0xff3300}));
  s.position.set(isNight ? 500 : 2000, isNight ? 1000 : 500, isNight ? 200 : 1000);
  envScene.add(s);
  if(envMapTexture) envMapTexture.dispose();
  envMapTexture = pmremGenerator.fromScene(envScene).texture;
  scene.environment = envMapTexture;
}
applyTheme();

if (btnTheme) {
  btnTheme.addEventListener('click', () => {
    isNight = !isNight;
    applyTheme();
  });
}

// City Grid Generation
const blockSize = 1200;
const roadWidth = 260; // Over a quarter kilometer between structural quadrants
const cityGroup = new THREE.Group();
scene.add(cityGroup);
const activeBlocks = new Map();

function buildCityBlock(cx, cz) {
  const group = new THREE.Group();
  group.position.set(cx * blockSize, 0, cz * blockSize);

  // Add the clear "Earth Road" planes over the base floor
  const earthMat = new THREE.MeshStandardMaterial({ color: 0x5a4b3d, roughness: 1.0, metalness: 0.0 }); // Earth tone
  
  const roadH = new THREE.Mesh(new THREE.PlaneGeometry(blockSize, roadWidth), earthMat);
  roadH.rotation.x = -Math.PI/2; roadH.position.y = 0.1; roadH.receiveShadow = true;
  
  const roadV = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, blockSize), earthMat);
  roadV.rotation.x = -Math.PI/2; roadV.position.y = 0.1; roadV.receiveShadow = true;
  
  // Neon Road Edges for 4K Cyberpunk Polish
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.4 });
  const roadEdgeL = new THREE.Mesh(new THREE.BoxGeometry(blockSize, 1, 4), edgeMat);
  roadEdgeL.position.set(0, 0.5, roadWidth/2);
  const roadEdgeR = new THREE.Mesh(new THREE.BoxGeometry(blockSize, 1, 4), edgeMat);
  roadEdgeR.position.set(0, 0.5, -roadWidth/2);
  const roadEdgeT = new THREE.Mesh(new THREE.BoxGeometry(4, 1, blockSize), edgeMat);
  roadEdgeT.position.set(roadWidth/2, 0.5, 0);
  const roadEdgeB = new THREE.Mesh(new THREE.BoxGeometry(4, 1, blockSize), edgeMat);
  roadEdgeB.position.set(-roadWidth/2, 0.5, 0);

  group.add(roadH, roadV, roadEdgeL, roadEdgeR, roadEdgeT, roadEdgeB);

  // First residential complex -> Hyper-Polished "Mobius Braid"
  if (cx === 1 && cz === -1 || (Math.abs(cx) % 4 === 0 && Math.abs(cz) % 4 === 0 && (cx !== 0 || cz !== 0))) {
    const mobiusBraidGrp = new THREE.Group();
    const bMat = bldgMats[Math.floor(Math.random() * bldgMats.length)];
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, wireframe: true, transparent: true, opacity: 0.8 });
    
    const mobius1 = new THREE.Mesh(new THREE.TorusKnotGeometry(180, 30, 256, 32, 2, 5), bMat);
    const mobius2 = new THREE.Mesh(new THREE.TorusKnotGeometry(160, 15, 256, 32, 3, 4), new THREE.MeshBasicMaterial({ color: 0xb026ff, wireframe: true }));
    const core = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 32), coreMat);
    
    mobiusBraidGrp.add(mobius1, mobius2, core);
    mobiusBraidGrp.position.set(0, 350, 0);
    
    const pillarGeo = new THREE.CylinderGeometry(20, 20, 300);
    const p1 = new THREE.Mesh(pillarGeo, bMat); p1.position.set(150, 150, 0);
    const p2 = new THREE.Mesh(pillarGeo, bMat); p2.position.set(-150, 150, 0);
    
    const landmarkGrp = new THREE.Group();
    landmarkGrp.add(mobiusBraidGrp, p1, p2);
    landmarkGrp.position.set(300, 0, 300);
    group.add(landmarkGrp);
    
    animatableObjects.push({ obj: mobiusBraidGrp, speed: 0.5 });
    animatableObjects.push({ obj: mobius2, speed: -1.0 });
    
    return group;
  }

  const qOffset = roadWidth / 2;
  const bSize = (blockSize - roadWidth) / 2;
  
  // 4 Quadrants of Buildings
  const quadrants = [
    { x: qOffset, z: qOffset },
    { x: -qOffset - bSize, z: qOffset },
    { x: qOffset, z: -qOffset - bSize },
    { x: -qOffset - bSize, z: -qOffset - bSize }
  ];

  quadrants.forEach(q => {
    // Generate 1-3 buildings per quadrant
    const numBldgs = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numBldgs; i++) {
      const w = bSize * (0.4 + Math.random() * 0.4);
      const d = bSize * (0.4 + Math.random() * 0.4);
      const h = 50 + Math.random() * 300;
      
      const bMat = bldgMats[Math.floor(Math.random() * bldgMats.length)];
      // Use standard box for monolithic brutalist/sci-fi buildings
      const bldg = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bMat);
      
      const px = q.x + (Math.random() * (bSize - w));
      const pz = q.z + (Math.random() * (bSize - d));
      
      bldg.position.set(px + w/2, h/2, pz + d/2);
      bldg.castShadow = true;
      bldg.receiveShadow = true;
      group.add(bldg);

      // Neon Roof
      const rMat = roofMats[Math.floor(Math.random() * roofMats.length)];
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w - 4, 2, d - 4), rMat);
      roof.position.set(px + w/2, h + 1, pz + d/2);
      group.add(roof);
    }
  });

  // Intersection Features (Roundabouts)
  const isRoundabout = Math.abs(Math.sin(cx * 12.9898 + cz * 78.233)) > 0.75;
  if (isRoundabout) {
    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(roadWidth * 0.35, roadWidth * 0.35, 1, 32),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
    );
    island.position.y = 0.5;
    island.receiveShadow = true;
    group.add(island);

    const holo = new THREE.Mesh(
      new THREE.OctahedronGeometry(15),
      new THREE.MeshBasicMaterial({ color: 0x00f3ff, wireframe: true, transparent: true, opacity: 0.8 })
    );
    holo.position.y = 25;
    holo.userData.isHolo = true;
    group.add(holo);
  }

  return group;
}

function updateCityGrid(playerPos) {
  const gridX = Math.round(playerPos.x / blockSize);
  const gridZ = Math.round(playerPos.z / blockSize);
  const radius = 2;
  
  const currentKeys = new Set();
  
  for(let dx = -radius; dx <= radius; dx++) {
    for(let dz = -radius; dz <= radius; dz++) {
      const cx = gridX + dx;
      const cz = gridZ + dz;
      const key = `${cx},${cz}`;
      currentKeys.add(key);
      
      if (!activeBlocks.has(key)) {
        const block = buildCityBlock(cx, cz);
        cityGroup.add(block);
        activeBlocks.set(key, block);
      }
    }
  }
  
  for (const [key, block] of activeBlocks.entries()) {
    if (!currentKeys.has(key)) {
      cityGroup.remove(block);
      activeBlocks.delete(key);
    }
  }
}

function buildDriver(isPlayer, isAmbient = false) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.7, 8), new THREE.MeshStandardMaterial({color: 0x111111}));
  body.position.y = 0.35;
  
  let headColor = 0xff003c;
  if (isPlayer) headColor = 0x00f3ff;
  else if (isAmbient) headColor = 0x00f3ff;
  
  const headMat = new THREE.MeshStandardMaterial({
    color: headColor, 
    metalness: 0.8, 
    roughness: 0.2,
    emissive: headColor,
    emissiveIntensity: 0.6
  });
  
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), headMat);
  head.position.y = 0.8;
  g.add(body, head);
  return g;
}

// Hyper-fidelity Procedural Generation
function buildCar(isPlayer, isBoss = false, isAmbient = false, typeOverride = null, isReptilian = false) {
  let vType = isPlayer ? state.selectedCar : 'hypercar';
  if (typeOverride) vType = typeOverride;
  const group = new THREE.Group();
  
  let pColor = 0x1a0033;
  if (isPlayer) {
    if (vType === 'bike') pColor = 0x3a0055;
    else if (vType === 'horse') pColor = 0x552200;
    else if (vType === 'jet') pColor = 0x550000;
  } else if (isAmbient) {
    const colors = [0x1a0033, 0x113355, 0x334455, 0x114422, 0x555555];
    pColor = colors[Math.floor(Math.random() * colors.length)];
  } else {
    pColor = isBoss ? 0x000000 : 0x2a0011;
  }

  let paintMat;
  if (isReptilian) {
    paintMat = staticShaderMat;
  } else if (vType === 'hypercar') {
    paintMat = new THREE.MeshPhysicalMaterial({
      color: 0x150022,
      metalness: 0.9,
      roughness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      bumpMap: cfTex,
      bumpScale: 0.02
    });
  } else {
    paintMat = new THREE.MeshStandardMaterial({ color: pColor, metalness: 0.95, roughness: 0.1 });
  }
  
  const bodyGrp = new THREE.Group();
  
  let driverY = 1.1;
  let driverZ = -0.2;
  
  if (vType === 'jet') {
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.8, 8, 8), paintMat);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.position.y = 1.0;
    const wings = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 3), paintMat);
    wings.position.set(0, 1.0, 1);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 2), paintMat);
    tail.position.set(0, 2.0, 3);
    
    const thrusterMat = new THREE.MeshBasicMaterial({color: 0x00f3ff});
    const thrustL = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 8), thrusterMat);
    thrustL.rotation.x = Math.PI/2; thrustL.position.set(1.5, 1.0, 4);
    const thrustR = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 8), thrusterMat);
    thrustR.rotation.x = Math.PI/2; thrustR.position.set(-1.5, 1.0, 4);
    
    bodyGrp.add(fuselage, wings, tail, thrustL, thrustR);
    group.position.y = 12; // Flying high
    driverY = 1.8;
    driverZ = -1.5;
  } 
  else if (vType === 'bike') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 3.5), paintMat);
    body.position.y = 1.0;
    bodyGrp.add(body);
    driverY = 1.6;
    driverZ = 0;
  }
  else if (vType === 'horse') {
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 3), paintMat);
    torso.position.y = 2.5;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), paintMat);
    neck.position.set(0, 3.5, -1.5);
    neck.rotation.x = Math.PI/6;
    const head = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 1.5), paintMat);
    head.position.set(0, 4.2, -2.0);
    bodyGrp.add(torso, neck, head);
    
    const legGeo = new THREE.BoxGeometry(0.4, 2.5, 0.4);
    const lf = new THREE.Mesh(legGeo, paintMat); lf.position.set(0.8, 1.25, -1.2); lf.rotation.x = 0.2;
    const rf = new THREE.Mesh(legGeo, paintMat); rf.position.set(-0.8, 1.25, -1.2); rf.rotation.x = -0.2;
    const lb = new THREE.Mesh(legGeo, paintMat); lb.position.set(0.8, 1.25, 1.2); lb.rotation.x = -0.2;
    const rb = new THREE.Mesh(legGeo, paintMat); rb.position.set(-0.8, 1.25, 1.2); rb.rotation.x = 0.2;
    bodyGrp.add(lf, rf, lb, rb);
    driverY = 3.6;
    driverZ = 0;
  }
  else {
    // EXACT DARK PURPLE GEOMETRIC HYPERCAR
    const hyperPaintMat = new THREE.MeshPhysicalMaterial({ 
      color: 0x140026, metalness: 0.95, roughness: 0.5, 
      clearcoat: 1.0, clearcoatRoughness: 0.1,
      bumpMap: cfTex, bumpScale: 0.015
    });

    const coreBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.6, 5.0), hyperPaintMat);
    coreBody.position.y = 1.0; coreBody.castShadow = true;
    bodyGrp.add(coreBody);

    const noseGeo = new THREE.ConeGeometry(1.8, 2.5, 4);
    const nose = new THREE.Mesh(noseGeo, hyperPaintMat);
    nose.rotation.x = -Math.PI / 2; nose.rotation.y = Math.PI / 4;
    nose.scale.set(1, 1, 0.4); nose.position.set(0, 1.0, -3.75);
    nose.castShadow = true; bodyGrp.add(nose);
    
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 0.8), hyperPaintMat);
    spoiler.position.set(0, 1.8, 2.5); spoiler.castShadow = true;
    const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.4), hyperPaintMat);
    strutL.position.set(-1.4, 1.5, 2.5);
    const strutR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.4), hyperPaintMat);
    strutR.position.set(1.4, 1.5, 2.5);
    bodyGrp.add(spoiler, strutL, strutR);

    const crystalMat = new THREE.MeshPhysicalMaterial({ 
      color: 0x88eebb, metalness: 0.2, roughness: 0.0, 
      transmission: 0.95, opacity: 1, transparent: true,
      ior: 1.6, thickness: 1.0
    });
    const canopyGeo = new THREE.ConeGeometry(1.3, 3.5, 4);
    const canopy = new THREE.Mesh(canopyGeo, crystalMat);
    canopy.rotation.x = -Math.PI / 2; canopy.rotation.y = Math.PI / 4;
    canopy.scale.set(1, 1, 0.35); canopy.position.set(0, 1.6, -0.8);
    bodyGrp.add(canopy);
  }

  if (vType === 'jet') {
    const glassMat = new THREE.MeshStandardMaterial({ 
      color: 0x88ccff, metalness: 1.0, roughness: 0.0, 
      transparent: true, opacity: 0.5 
    });
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 1.2, 2.2, 4), glassMat);
    canopy.rotation.y = Math.PI / 4; canopy.scale.set(1, 0.5, 1.5);
    canopy.position.set(0, 1.8, -1.5);
    bodyGrp.add(canopy);
  }

  // Neon-cyan "Legendrian Braid" Logic pathways
  let neonColor = (isPlayer || isAmbient) ? 0x00f3ff : 0xff003c;
  if (isBoss) neonColor = 0xb026ff;
  if (isReptilian) neonColor = 0x00ffaa;
  if (vType === 'hypercar') neonColor = 0x00f3ff;
  
  const neonMat = new THREE.MeshStandardMaterial({ 
    color: neonColor, emissive: neonColor, emissiveIntensity: 2.0 
  });
  
  if (vType === 'hypercar') {
    const braidL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 7.0), neonMat); braidL.position.set(-1.0, 1.32, -0.5);
    const braidR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 7.0), neonMat); braidR.position.set(1.0, 1.32, -0.5);
    const braidT = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.05), neonMat); braidT.position.set(0, 1.32, -2.5);
    const braidB = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.05), neonMat); braidB.position.set(0, 1.32, 1.5);
    const under = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 5.0), neonMat); under.rotation.x = -Math.PI/2; under.position.y = 0.6;
    bodyGrp.add(braidL, braidR, braidT, braidB, under);
  } else if (vType === 'horse') {
    const braidEye = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), neonMat); braidEye.position.set(0, 4.3, -2.5);
    const braidSpine = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 3.0), neonMat); braidSpine.position.set(0, 3.1, 0);
    bodyGrp.add(braidEye, braidSpine);
  } else if (vType === 'bike') {
    const braidSide = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 3.5), neonMat); braidSide.position.set(0, 1.5, 0);
    bodyGrp.add(braidSide);
  } else if (vType === 'jet') {
    const braidWingL = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.05, 0.05), neonMat); braidWingL.position.set(-2.5, 1.1, 1);
    const braidWingR = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.05, 0.05), neonMat); braidWingR.position.set(2.5, 1.1, 1);
    bodyGrp.add(braidWingL, braidWingR);
  }

  if (isPlayer) {
    if (vType === 'jet') bodyGrp.scale.set(1.5, 1.5, 1.5);
    else if (vType === 'bike') bodyGrp.scale.set(1.2, 1.2, 1.2);
    else if (vType === 'horse') bodyGrp.scale.set(1.0, 1.0, 1.0);
    else bodyGrp.scale.set(1.0, 1.0, 1.0);
  }

  group.add(bodyGrp);

  const driver = buildDriver(isPlayer, isAmbient);
  if (vType === 'bike') { driver.position.set(0, driverY, driverZ); driver.rotation.x = -Math.PI/6; }
  else if (vType === 'horse') { driver.position.set(0, driverY, driverZ); }
  else { driver.position.set(0.5, driverY, driverZ); }
  group.add(driver);

  if (vType !== 'jet' && vType !== 'horse') {
    const wheelGeo = new THREE.CylinderGeometry(0.9, 0.9, 1.0, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 });
    
    const rimMat = new THREE.MeshStandardMaterial({ 
      color: 0x111111, metalness: 0.8, roughness: 0.2, 
      emissive: neonColor, emissiveIntensity: 0.6 
    });
    
    function createWheel(x, z, sizeObj = null) {
      const wGroup = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, tireMat); tire.castShadow = true;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 8).rotateZ(Math.PI/2), rimMat);
      wGroup.add(tire, rim);
      wGroup.position.set(x, 0.9, z);
      if(sizeObj) wGroup.scale.set(sizeObj, sizeObj, sizeObj);
      return wGroup;
    }

    if (vType === 'bike') {
      group.add(createWheel(0, -2.0, 1.2)); // Front
      group.add(createWheel(0, 2.0, 1.2));  // Back
    } else {
      let wX = 2.0;
      group.add(createWheel(-wX, 2.5));
      group.add(createWheel(wX, 2.5));
      group.add(createWheel(-wX, -3.0));
      group.add(createWheel(wX, -3.0));
    }
  }

  // Lights
  const headLight = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 0.1), neonMat);
  if(vType === 'jet') headLight.position.set(0, 1.0, -4.0);
  else headLight.position.set(0, 1.0, -4.0);
  group.add(headLight);

  if (isPlayer) {
    const hl = new THREE.SpotLight(neonColor, 3, 400, Math.PI/4, 0.5, 1);
    hl.position.set(0, 1.5, -4);
    hl.target.position.set(0, 0, -50);
    group.add(hl);
    group.add(hl.target);
  }

  group.scale.set(0.7, 0.7, 0.7);
  if (isBoss) group.scale.set(1.0, 1.0, 1.0);
  return group;
}

let playerCar;
let maxPlayerSpeed = 140; 
let currentSpeed = 0;

function applyCarSelection() {
  if (playerCar) scene.remove(playerCar);
  playerCar = buildCar(true);
  playerCar.position.set(0, 0, 0);
  playerCar.rotation.set(0, 0, 0);
  scene.add(playerCar);
  
  currentSpeed = 0;

  let camY = 5, camZ = 12;
  if(state.selectedCar === 'jet') { camY = 8; camZ = 15; maxPlayerSpeed = 300; }
  else if(state.selectedCar === 'bike') { camY = 4; camZ = 10; maxPlayerSpeed = 180; }
  else if(state.selectedCar === 'horse') { camY = 7; camZ = 14; maxPlayerSpeed = 100; }
  else { maxPlayerSpeed = 160; }

  const idealOffset = new THREE.Vector3(0, camY, camZ);
  idealOffset.applyQuaternion(playerCar.quaternion);
  idealOffset.add(playerCar.position);
  camera.position.copy(idealOffset);
  
  const idealLookat = new THREE.Vector3(0, state.selectedCar === 'jet' ? 10 : 0, -30);
  idealLookat.applyQuaternion(playerCar.quaternion);
  idealLookat.add(playerCar.position);
  camera.lookAt(idealLookat);
}
applyCarSelection();

let enemies = [];
let ambientCars = [];
let mouseTargetX = 0;
let cameraTrauma = 0;

// Glowing Dust Particles
const particleCount = 100;
const particleGeo = new THREE.BufferGeometry();
const pPositions = new Float32Array(particleCount * 3);
for(let i=0; i<particleCount*3; i++) pPositions[i] = -1000;
particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
const particleMat = new THREE.PointsMaterial({ color: 0xff4400, size: 3.5, transparent: true, blending: THREE.AdditiveBlending });
const particleSystem = new THREE.Points(particleGeo, particleMat);
scene.add(particleSystem);
let particleLifespan = 0;

function spawnEnemy() {
  if (!state.currentQuest) return;

  const isBoss = state.currentQuest === 'draconian';
  const isMS = state.currentQuest === 'ms';
  const isReptilian = state.currentQuest === 'reptilian';
  
  const car = buildCar(false, isBoss, false, null, isReptilian);
  const spawnDist = 800 + Math.random() * 400;
  const angle = Math.random() * Math.PI * 2;
  
  car.position.set(
    playerCar.position.x + Math.sin(angle) * spawnDist,
    0,
    playerCar.position.z + Math.cos(angle) * spawnDist
  );

  if (Math.random() > 0.5) {
    car.position.x = Math.round(car.position.x / blockSize) * blockSize;
  } else {
    car.position.z = Math.round(car.position.z / blockSize) * blockSize;
  }
  
  car.lookAt(playerCar.position);
  car.rotation.y = Math.round(car.rotation.y / (Math.PI/2)) * (Math.PI/2);
  
  car.userData = {
    ...(car.userData || {}),
    speed: isBoss ? 125 : (isMS ? 115 : 95),
    hp: isBoss ? 5 : (isMS ? 2 : 1),
    maxHp: isBoss ? 5 : (isMS ? 2 : 1),
    type: state.currentQuest,
    inInter: false
  };
  
  scene.add(car);
  enemies.push(car);
}

function spawnAmbientCar() {
  const car = buildCar(false, false, true);
  const isAhead = Math.random() > 0.5;
  const distOffset = isAhead ? (800 + Math.random() * 400) : -(800 + Math.random() * 400);
  const dirIndex = Math.floor(Math.random() * 4);
  const angle = dirIndex * (Math.PI / 2);
  
  car.position.set(
    playerCar.position.x + Math.sin(angle) * distOffset,
    0,
    playerCar.position.z + Math.cos(angle) * distOffset
  );

  car.position.x = Math.round(car.position.x / blockSize) * blockSize;
  car.position.z = Math.round(car.position.z / blockSize) * blockSize;
  car.rotation.y = angle;
  
  car.userData = {
    speed: 60 + Math.random() * 70,
    inInter: false,
    isAmbient: true
  };
  
  scene.add(car);
  ambientCars.push(car);
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const beamMat = new THREE.LineBasicMaterial({ color: 0xff003c, linewidth: 10 });
const beamGeo = new THREE.BufferGeometry();
beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
const beam = new THREE.Line(beamGeo, beamMat);
beam.visible = false;
scene.add(beam);
let beamTimer = 0;

function fireWeapon(targetX = 0, targetY = 0, autoAim = false) {
  if (beam.visible) return;
  cameraTrauma = 0.5; 
  sounds.playLaser();
  
  if (autoAim && enemies.length > 0) {
    let closest = enemies[0];
    let minDist = closest.position.distanceTo(playerCar.position);
    for(let e of enemies) {
      let dist = e.position.distanceTo(playerCar.position);
      if(dist < minDist) { minDist = dist; closest = e; }
    }
    hitEnemy(closest);
    drawBeam(closest.position);
  } else {
    mouse.x = (targetX / window.innerWidth) * 2 - 1;
    mouse.y = -(targetY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(enemies, true); 
    
    if (intersects.length > 0) {
      let hitObj = intersects[0].object;
      while(hitObj.parent && hitObj.parent.type === 'Group') hitObj = hitObj.parent;
      if (enemies.includes(hitObj)) {
        hitEnemy(hitObj);
        drawBeam(hitObj.position);
      }
    } else {
      const targetPoint = new THREE.Vector3();
      raycaster.ray.at(1000, targetPoint);
      drawBeam(targetPoint);
    }
  }

  hitFlash.style.opacity = '1';
  setTimeout(() => hitFlash.style.opacity = '0', 50);
}

function hitEnemy(mesh) {
  mesh.userData.hp--;
  if (mesh.userData.hp <= 0) {
    destroyEnemy(mesh);
  } else {
    mesh.position.y += 1.0;
    mesh.rotation.z += (Math.random() - 0.5) * 0.5;
  }
}

function drawBeam(targetPos) {
  const origin = playerCar.position.clone();
  origin.y += 1.0; 
  const forward = new THREE.Vector3(0, 0, -4).applyQuaternion(playerCar.quaternion);
  origin.add(forward);
  
  const positions = beam.geometry.attributes.position.array;
  positions[0] = origin.x; positions[1] = origin.y; positions[2] = origin.z;
  positions[3] = targetPos.x; positions[4] = targetPos.y; positions[5] = targetPos.z;
  beam.geometry.attributes.position.needsUpdate = true;
  beam.visible = true;
  beamTimer = 10; 
}

function destroyEnemy(mesh) {
  state.bountiesClaimed++;
  let reward = 50;
  if(mesh.userData.type === 'ms') reward = 100;
  if(mesh.userData.type === 'draconian') reward = 500;
  
  state.credits += reward * state.multiplier;
  updateUI();
  cameraTrauma = 2.0;

  sounds.playExplosion();

  // Hyper-Fidelity Shockwave Explosion
  const wave = new THREE.Mesh(shockwaveGeo, shockwaveMat.clone());
  wave.position.copy(mesh.position);
  wave.userData = { life: 1.0 };
  if(mesh.userData.type === 'draconian') wave.material.color.setHex(0xff003c);
  scene.add(wave);
  shockwaves.push(wave);

  const pAttrs = particleSystem.geometry.attributes.position.array;
  for(let i=0; i<particleCount; i++) {
    pAttrs[i*3] = mesh.position.x + (Math.random()-0.5)*20;
    pAttrs[i*3+1] = mesh.position.y + (Math.random() * 5); // Spawn close to ground
    pAttrs[i*3+2] = mesh.position.z + (Math.random()-0.5)*20;
  }
  particleSystem.geometry.attributes.position.needsUpdate = true;
  particleLifespan = 40;

  scene.remove(mesh);
  enemies = enemies.filter(e => e !== mesh);
  
  if (mesh.userData.type === 'draconian') {
    state.currentQuest = null;
    document.querySelectorAll('.btn-quest').forEach(b => {
      b.classList.remove('active-quest');
      b.textContent = window.miniappI18n ? window.miniappI18n.t('app.quests.start') : "Accept Quest";
    });
    updateUI();
  }
}

viewChase.addEventListener('pointermove', (e) => {
  if (!usingKeyboard) {
    mouseTargetX = (e.clientX / window.innerWidth) * 2 - 1;
  }
});

viewChase.addEventListener('pointerdown', (e) => {
  fireWeapon(e.clientX, e.clientY);
});

let clock = new THREE.Clock();
let boerboelTimer = 0;

function applyCameraShake() {
  if(cameraTrauma > 0) {
    camera.position.x += (Math.random() - 0.5) * cameraTrauma;
    camera.position.y += (Math.random() - 0.5) * cameraTrauma;
    cameraTrauma *= 0.85;
    if(cameraTrauma < 0.01) cameraTrauma = 0;
  }
}

function processCarAI(carList, delta, isEnemy) {
  const halfRoad = roadWidth / 2;

  for (let i = carList.length - 1; i >= 0; i--) {
    let c = carList[i];
    c.translateZ(-c.userData.speed * delta);

    const cxLocal = c.position.x - Math.round(c.position.x / blockSize) * blockSize;
    const czLocal = c.position.z - Math.round(c.position.z / blockSize) * blockSize;
    const inInter = Math.abs(cxLocal) < halfRoad && Math.abs(czLocal) < halfRoad;

    if (inInter && !c.userData.inInter) {
      c.userData.inInter = true;
      
      if (isEnemy && Math.random() < 0.5) {
        const dx = playerCar.position.x - c.position.x;
        const dz = playerCar.position.z - c.position.z;
        if (Math.abs(dx) > Math.abs(dz)) {
          c.rotation.y = dx > 0 ? -Math.PI/2 : Math.PI/2;
        } else {
          c.rotation.y = dz > 0 ? Math.PI : 0;
        }
      } else {
        if(Math.random() < 0.5) c.rotation.y += (Math.random() > 0.5 ? Math.PI/2 : -Math.PI/2);
      }
      
      c.position.x = Math.round(c.position.x / blockSize) * blockSize;
      c.position.z = Math.round(c.position.z / blockSize) * blockSize;
      
    } else if (!inInter) {
      c.userData.inInter = false;
    }

    if (c.position.distanceTo(playerCar.position) > 2500) {
      scene.remove(c);
      carList.splice(i, 1);
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);

  if (typeof staticShaderMat !== 'undefined') {
    staticShaderMat.uniforms.time.value = clock.getElapsedTime();
  }

  // Update Tear in the Sky Position
  if (tearGroup) {
    tearGroup.position.x = playerCar.position.x;
    tearGroup.position.z = playerCar.position.z - 3000;
    tearGroup.scale.y = 1 + Math.sin(clock.getElapsedTime() * 3) * 0.15;
  }

  // Update Sky Group Position
  if (typeof skyGroup !== 'undefined') {
    skyGroup.position.x = playerCar.position.x;
    skyGroup.position.z = playerCar.position.z;
    skyGroup.rotation.y = clock.getElapsedTime() * 0.002;
  }

  let targetSpeed = maxPlayerSpeed;
  let steerInput = 0;

  if (usingKeyboard) {
    if (keys.s || keys.ArrowDown) targetSpeed = maxPlayerSpeed * 0.3;
    if (keys.a || keys.ArrowLeft) steerInput = 1;
    if (keys.d || keys.ArrowRight) steerInput = -1;
  } else {
    steerInput = -mouseTargetX;
  }

  currentSpeed += (targetSpeed - currentSpeed) * 2.0 * delta;
  playerCar.rotation.y += steerInput * 2.0 * delta;
  playerCar.translateZ(-currentSpeed * delta);

  sounds.updateEngine(currentSpeed / maxPlayerSpeed);

  const halfRoad = roadWidth / 2;
  const px = playerCar.position.x;
  const pz = playerCar.position.z;
  const gridX = Math.round(px / blockSize) * blockSize;
  const gridZ = Math.round(pz / blockSize) * blockSize;
  
  const localX = px - gridX;
  const localZ = pz - gridZ;

  if (Math.abs(localX) > halfRoad && Math.abs(localZ) > halfRoad) {
    const overlapX = Math.abs(localX) - halfRoad;
    const overlapZ = Math.abs(localZ) - halfRoad;
    if (overlapX < overlapZ) {
      playerCar.position.x = gridX + Math.sign(localX) * halfRoad;
    } else {
      playerCar.position.z = gridZ + Math.sign(localZ) * halfRoad;
    }
    currentSpeed *= 0.8;
  }

  let camY = 5, camZ = 12;
  if(state.selectedCar === 'jet') { camY = 8; camZ = 15; }
  else if(state.selectedCar === 'bike') { camY = 4; camZ = 10; }
  else if(state.selectedCar === 'horse') { camY = 7; camZ = 14; }

  const idealOffset = new THREE.Vector3(0, camY, camZ);
  idealOffset.applyQuaternion(playerCar.quaternion);
  idealOffset.add(playerCar.position);
  
  camera.position.lerp(idealOffset, 0.1);
  
  const idealLookat = new THREE.Vector3(0, state.selectedCar === 'jet' ? 10 : 0, -30);
  idealLookat.applyQuaternion(playerCar.quaternion);
  idealLookat.add(playerCar.position);
  camera.lookAt(idealLookat);

  // Dynamic Camera FX
  camera.fov = 65 + (currentSpeed / maxPlayerSpeed) * 25;
  camera.rotation.z = -steerInput * 0.1;
  camera.updateProjectionMatrix();
  
  applyCameraShake();
  updateCityGrid(playerCar.position);

  // Animate dynamic objects
  animatableObjects.forEach(anim => {
    anim.obj.rotation.y += anim.speed * delta;
    anim.obj.rotation.z += (anim.speed * 0.2) * delta;
  });

  cityGroup.children.forEach(block => {
    block.children.forEach(mesh => {
      if(mesh.userData.isHolo) {
        mesh.rotation.y += delta;
        mesh.rotation.x += delta * 0.5;
      }
    });
  });

  if (state.currentQuest && enemies.length === 0 && Math.random() < 0.02) spawnEnemy();
  if (ambientCars.length < 8 && Math.random() < 0.02) spawnAmbientCar();
  
  processCarAI(enemies, delta, true);
  processCarAI(ambientCars, delta, false);

  if (radarBlips && uiLayer.style.display !== 'none') {
    radarBlips.innerHTML = '';
    const angle = playerCar.rotation.y;
    
    const renderBlip = (e, colorClass) => {
      let dx = e.position.x - playerCar.position.x;
      let dz = e.position.z - playerCar.position.z;
      
      let rx = dx * Math.cos(angle) - dz * Math.sin(angle);
      let rz = dx * Math.sin(angle) + dz * Math.cos(angle);
      
      let leftPct = 50 + (rx / 1500) * 50;
      let topPct = 50 + (rz / 1500) * 50;
      
      leftPct = Math.max(5, Math.min(95, leftPct));
      topPct = Math.max(5, Math.min(95, topPct));
      
      const blip = document.createElement('div');
      blip.className = colorClass;
      blip.style.left = leftPct + '%';
      blip.style.top = topPct + '%';
      radarBlips.appendChild(blip);
    };

    enemies.forEach(e => renderBlip(e, 'radar-blip'));
    ambientCars.forEach(e => renderBlip(e, 'radar-blip-ambient'));
  }

  if (beamTimer > 0) { beamTimer--; if (beamTimer <= 0) beam.visible = false; }
  
  // Shockwave Animation
  for(let i=shockwaves.length-1; i>=0; i--) {
    let sw = shockwaves[i];
    sw.scale.addScalar(400 * delta); // Expanding huge sphere
    sw.userData.life -= delta * 1.5;
    sw.material.opacity = sw.userData.life;
    if(sw.userData.life <= 0) { scene.remove(sw); shockwaves.splice(i, 1); }
  }

  if (particleLifespan > 0) {
    const pAttrs = particleSystem.geometry.attributes.position.array;
    for(let i=0; i<particleCount; i++) {
      pAttrs[i*3] += (Math.random() - 0.5) * 8;
      pAttrs[i*3+1] += Math.random() * 8;
      pAttrs[i*3+2] += (Math.random() - 0.5) * 8;
    }
    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleLifespan--;
  } else {
    particleSystem.geometry.attributes.position.array.fill(-1000);
    particleSystem.geometry.attributes.position.needsUpdate = true;
  }

  if (state.hasBoerboel && enemies.length > 0) {
    boerboelTimer -= delta;
    if (boerboelTimer <= 0) { fireWeapon(0, 0, true); boerboelTimer = 3; }
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- UI & State Management ---

function updateUI() {
  const t = window.miniappI18n ? window.miniappI18n.t : (k, opts) => k;
  
  if (window.miniappI18n) {
    hudBounties.textContent = window.miniappI18n.t('app.hud.bounties', { count: state.bountiesClaimed });
    hudCredits.textContent = window.miniappI18n.t('app.hud.credits', { count: state.credits });
    
    let targetName = "None";
    if(state.currentQuest === 'reptilian') targetName = "Reptilian Scout";
    if(state.currentQuest === 'ms') targetName = "MS Smuggler";
    if(state.currentQuest === 'draconian') targetName = "Draconian X";
    hudTarget.textContent = window.miniappI18n.t('app.hud.target', { target: targetName });
  } else {
    hudBounties.textContent = `Bounties Claimed: ${state.bountiesClaimed}`;
    hudCredits.textContent = `Credits: ${state.credits} ₢`;
    hudTarget.textContent = `Target: ${state.currentQuest || 'None'}`;
  }

  if (state.currentQuest) {
    hudTimer.style.display = 'block';
    if (window.miniappI18n) {
      hudTimer.textContent = window.miniappI18n.t('app.hud.time', { time: state.timeLeft });
    } else {
      hudTimer.textContent = `Time: ${state.timeLeft}s`;
    }
  } else {
    hudTimer.style.display = 'none';
  }
}

let questTimerInterval = null;

function startQuest(questType) {
  state.currentQuest = questType;
  enemies.forEach(en => scene.remove(en));
  enemies = [];
  
  if(questType === 'reptilian') state.timeLeft = 60;
  else if(questType === 'ms') state.timeLeft = 90;
  else if(questType === 'draconian') state.timeLeft = 120;
  
  clearInterval(questTimerInterval);
  questTimerInterval = setInterval(() => {
    if(!state.currentQuest) {
      clearInterval(questTimerInterval);
      return;
    }
    state.timeLeft--;
    updateUI();
    if(state.timeLeft <= 0) {
      failQuest();
    }
  }, 1000);
  
  updateUI();
}

function failQuest() {
  state.currentQuest = null;
  enemies.forEach(en => scene.remove(en));
  enemies = [];
  
  hudTarget.textContent = window.miniappI18n ? window.miniappI18n.t('app.hud.failed') : "Bounty Failed!";
  
  document.querySelectorAll('.btn-quest').forEach(b => {
    b.classList.remove('active-quest');
    b.textContent = window.miniappI18n ? window.miniappI18n.t('app.quests.start') : "Accept Quest";
  });
  updateUI();
}

btnJoin.addEventListener('click', () => {
  let handle = inputHandle.value.trim();
  if (!handle) {
    handle = "Hunter_" + Math.floor(Math.random() * 9999);
    inputHandle.value = handle;
  }
  state.hunterName = handle;
  authOverlay.style.display = 'none';
  carSelectOverlay.style.display = 'block';
});

inputHandle.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') btnJoin.click();
});

const carCards = document.querySelectorAll('.car-card');
carCards.forEach(card => {
  card.addEventListener('click', () => {
    card.classList.add('clicking');
    setTimeout(() => card.classList.remove('clicking'), 150);

    carCards.forEach(c => c.classList.remove('border-cyan-400', 'border-yellow-400', 'border-green-400', 'border-purple-500', 'border-orange-500', 'border-red-500', 'shadow-[0_0_20px_rgba(0,243,255,0.5)]', 'shadow-[0_0_20px_rgba(176,38,255,0.5)]', 'shadow-[0_0_20px_rgba(255,68,0,0.5)]', 'shadow-[0_0_20px_rgba(255,0,0,0.5)]'));
    
    const carType = card.getAttribute('data-car');
    state.selectedCar = carType;
    
    let colorClass = 'border-cyan-400';
    if(carType === 'bike') colorClass = 'border-purple-500';
    if(carType === 'horse') colorClass = 'border-orange-500';
    if(carType === 'jet') colorClass = 'border-red-500';
    
    card.classList.add(colorClass, `shadow-[0_0_20px_rgba(${colorClass === 'border-red-500' ? '255,0,0' : (colorClass === 'border-orange-500' ? '255,68,0' : (colorClass === 'border-purple-500' ? '176,38,255' : '0,243,255'))},0.5)]`);
  });
});

btnLaunch.addEventListener('click', () => {
  carSelectOverlay.style.display = 'none';
  applyCarSelection();
  uiLayer.style.display = 'flex';
  saveState();
});

const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if(btn.id === 'btn-theme') return; 
    
    navBtns.forEach(b => {
        if(b.id !== 'btn-theme') b.classList.remove('active');
    });
    btn.classList.add('active');
    const target = btn.getAttribute('data-target');
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${target}`).classList.add('active');
  });
});

const questBtns = document.querySelectorAll('.btn-quest');
questBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const parent = e.target.closest('.quest-item');
    const qType = parent.getAttribute('data-quest');
    
    startQuest(qType);
    
    questBtns.forEach(b => {
      b.classList.remove('active-quest');
      b.textContent = window.miniappI18n ? window.miniappI18n.t('app.quests.start') : "Accept Quest";
    });
    
    btn.classList.add('active-quest');
    btn.textContent = window.miniappI18n ? window.miniappI18n.t('app.quests.active') : "Active Target";
  });
});

const btnBoerboel = document.getElementById('buy-boerboel');
const btnCoffee = document.getElementById('buy-coffee');

btnBoerboel.addEventListener('click', () => {
  if (state.credits >= 500 && !state.hasBoerboel) {
    state.credits -= 500;
    state.hasBoerboel = true;
    btnBoerboel.textContent = window.miniappI18n ? window.miniappI18n.t('app.garage.purchased') : "Purchased!";
    btnBoerboel.disabled = true;
    updateUI();
  }
});

btnCoffee.addEventListener('click', () => {
  if (state.credits >= 200 && !state.hasCoffee) {
    state.credits -= 200;
    state.hasCoffee = true;
    state.multiplier = 2;
    btnCoffee.textContent = window.miniappI18n ? window.miniappI18n.t('app.garage.purchased') : "Purchased!";
    btnCoffee.disabled = true;
    updateUI();
  }
});

function saveState() {
  if (window.miniappsAI && window.miniappsAI.storage) {
    const stateToSave = { ...state, currentQuest: null, timeLeft: 0 };
    window.miniappsAI.storage.setItem('bounty_hunter_state', JSON.stringify(stateToSave));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.miniappsAI && window.miniappsAI.storage) {
    window.miniappsAI.storage.getItem('bounty_hunter_state').then(data => {
      if (data) {
        Object.assign(state, JSON.parse(data));
        
        if (state.hunterName) {
          authOverlay.style.display = 'none';
          
          if (state.selectedCar) {
            applyCarSelection();
            uiLayer.style.display = 'flex';
          } else {
            carSelectOverlay.style.display = 'block';
          }
        }
        
        if(state.hasBoerboel) { btnBoerboel.textContent = "Purchased!"; btnBoerboel.disabled = true; }
        if(state.hasCoffee) { btnCoffee.textContent = "Purchased!"; btnCoffee.disabled = true; }
        
        updateUI();
      }
    });
    setInterval(saveState, 5000);
  }
  updateUI();
  animate();
});
