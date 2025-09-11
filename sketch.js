// ===== Bobby Axe - Full Sketch with Main Menu (v0.9) =====
// ===== Mod con sistema de niveles (LEVELS[]) =====

// ---------- CANVAS ----------
let canvasWidth = 1920, canvasHeight = 1080;

// ---------- ART (actuales/activos en el nivel cargado) ----------
let IMG_BG, IMG_MG, IMG_FG;
let IMG_BOBBY_REST, IMG_BOBBY_RISE, IMG_BOBBY_THROW;
let IMG_AXE, IMG_SCORE;
let IMG_WIND;

// Mapa de imágenes precargadas por nombre de archivo (para asignarlas por nivel)
let IMG_MAP = {};

// ---------- MAIN MENU ASSETS ----------
let IMG_COVER, IMG_BTN_START, IMG_BTN_START_PRESSED;

// ---------- AUDIO ----------
let SND_AXE_THROW, SND_BUTTON, SND_GRAB_AXE, SND_LEVEL_COMPLETE;
let SND_MAIN_MUSIC, SND_POINTS_LOST, SND_TARGET, SND_WIND, SND_AMB_LVL1;

let AUDIO_VOLUME = 0.8; // 0..1
function setMasterVol(v){
  AUDIO_VOLUME = constrain(v,0,1);
  if (typeof masterVolume === 'function') masterVolume(AUDIO_VOLUME);
}
function playMainMusic() {
  if (SND_MAIN_MUSIC) {
    if (SND_MAIN_MUSIC.setLoop) SND_MAIN_MUSIC.setLoop(true);
    if (!SND_MAIN_MUSIC.isPlaying || !SND_MAIN_MUSIC.isPlaying()) {
      if (SND_MAIN_MUSIC.play) SND_MAIN_MUSIC.play();
    }
  }
}
function stopMainMusic() {
  if (SND_MAIN_MUSIC && SND_MAIN_MUSIC.isPlaying && SND_MAIN_MUSIC.isPlaying()) {
    if (SND_MAIN_MUSIC.stop) SND_MAIN_MUSIC.stop();
  }
}

// ---------- SPRITES RECORTADOS ----------
let BOB_REST = null, BOB_RISE = null, BOB_THROW = null;

// ---------- PLACEMENT ----------
let groundY = canvasHeight - 150;
let bobbyX = 250;
let desiredBobbyHeight = 300;

const POSE_SCALE = { REST:1.00, RISE:1.15, THROW:1.00 };

// ---------- FSM POSES ----------
const POSE = { REST:'REST', RISE:'RISE', THROW:'THROW' };
let currentPose = POSE.REST;

// ---------- INPUT / THROW CONTROL ----------
const THROW_HOLD_MS     = 120;
const THROW_COOLDOWN_MS = 160;
let lastThrowAt = -9999;
let isHolding = false;
let throwEndAt = 0; // ms hasta volver a REST tras THROW

// ---- GESTURE (velocidad) ----
const GESTURE_WINDOW_MS = 140; // ms
const GESTURE_VPS_MIN   = 300; // px/s
const GESTURE_VPS_MAX   = 2600;
const THROW_SPEED_MIN   = 18;  // px/frame
const THROW_SPEED_MAX   = 72;
let _inputHist = [];           // {t,x,y}
let _lastThrowSpeed = 34;

// ---------- GAME STATE ----------
const GAME = { MENU:'MENU', PLAY:'PLAY', LEVEL_END:'LEVEL_END', NEXT:'NEXT' };
let gameState = GAME.MENU;

// Nivel/Timer/Meta (estos se pisan por nivel desde LEVELS[])
let LEVEL_TIME_MS = 60000; // 60s
let LEVEL_GOAL    = 300;
let levelStartAt  = 0;
let levelEndReason = '';

// Sistema de niveles
/* ===========================================================
   LEVELS[] — Configuración por nivel
   - Puedes ajustar por nivel:
     target: { x, y }   // *Solo modifica Nivel 2 y Nivel 3* (Nivel 1 queda igual)
     gravity            // gravedad para el cálculo de trayectoria
     windPower          // intensidad del viento
     windBias           // sesgo (- izq / + der)
     windGain           // acople del viento al hacha (opcional)
     bg: { bg, mg, fg } // nombres de archivos de fondo/mid/fore por nivel
     durationSec        // tiempo límite
     scoreTarget        // puntaje objetivo
   =========================================================== */
const LEVELS = [
  // NIVEL 1 — *Conservar exactamente la posición actual del target*
  {
    name: 'Level 1',
    target: { x: 1650, y: 540 },     // <- NO CAMBIAR (mantiene el nivel 1 como está hoy)
    gravity: 0.45,
    windPower: 0.50,
    windBias: -0.80,
    windGain: 1.00,
    bg: {
      bg: 'LEVEL 1 - BACKGROUND.png',
      mg: 'LEVEL 1 - MIDGROUND.png',
      fg: 'LEVEL 1 - FOREGROUND.png',
    },
    durationSec: 60,
    scoreTarget: 300
  },

  // NIVEL 2 — Puedes ajustar target.x y target.y libremente
  {
    name: 'Level 2',
    target: { x: 1650, y: 570 },     // <-- AJUSTA AQUÍ (independiente de Nivel 1)
    gravity: 0.50,                   // un poco más de caída
    windPower: 2.00,                 // viento algo más fuerte
    windBias: -1.55,                 // menos sesgo a la izquierda
    windGain: 1.00,                  // acople estándar
    bg: {
      bg: 'LEVEL 2 - BACKGROUND.png',
      mg: 'LEVEL 2 - MIDGROUND.png',
      fg: 'LEVEL 2 - FOREGROUND.png',
    },
    durationSec: 55,                 // dificultad creciente
    scoreTarget: 450
  },

  // NIVEL 3 — También puedes ajustar target.x y target.y
  {
    name: 'Level 3',
    target: { x: 1320, y: 630 },     // <-- AJUSTA AQUÍ (independiente de Nivel 1 y 2)
    gravity: 0.56,                   // más desafiante
    windPower: 2.55,                 // ráfagas más notorias
    windBias: -3.25,                  // sesgo a la derecha
    windGain: 1.10,                  // leve aumento de acople
    bg: {
      bg: 'LEVEL 3 - BACKGROUND.png',
      mg: 'LEVEL 3 - MIDGROUND.png',
      fg: 'LEVEL 3 - FOREGROUND.png',
    },
    durationSec: 50,
    scoreTarget: 600
  }
];

let currentLevelIndex = 0; // comienza en Level 1

// High Score
let highScore = 0;

// Overlay anim
let overlay = { active:false, t:0, dur:600 };
let overlayButtons = { next:{x:0,y:0,w:0,h:0}, restart:{x:0,y:0,w:0,h:0} };

// ---------- GAME LOOP ----------
let paused = false;
let lastTime = 0; // ms
let time = 0;     // ms acumulado
const MAX_DT = 1/30;

// ---------- VIENTO ----------
let CHAOS_WIND_ON = true;
let WIND_POWER    = 2.00;
let WIND_AXE_GAIN = 1.00;
let WIND_BIAS     = -0.80;

let WIND_SCALE_T = 0.005;
let WIND_SCALE_Y = 0.002;
let noiseT = 0.0;

// ---------- GRAVEDAD ----------
let GRAVITY_ON = true;
let GRAVITY    = 0.45; // px/frame^2

// ---------- VIENTO VISIBLE ----------
let WIND_SPRITE_ON = true;
let WIND_UI_X = 360, WIND_UI_Y = 120, WIND_UI_SCALE = 0.25;
const WIND_ROT_MAX = 0.35;
let WIND_ACTIVE = false, WIND_VIS_T = 0;
const WIND_VIS_FADE_S = 20;

// Ráfagas auto
let GUSTS_ON = true;
let gust = { next:0, durOn:[1400, 3000], durOff:[1500, 2000] };

// ---------- AXES ----------
let axes = [];
function newAxe(){
  return {
    active:true, stuck:false, x:0, y:0, vx:0, vy:0, angle:0,
    stickStart:0, stickDepth:12,
    wobbleAmp:0.28, wobbleDecay:3.0, wobbleFreq:18.0,
  };
}
const AXE_SCALE = 0.70;
const AXE_DRAW_OFFSET_X = 280;
const AXE_DRAW_OFFSET_Y = -150;

let HAND_X = 0.72, HAND_Y = 0.08;

// ---------- TARGET ----------
const TARGET = {
  // La posición se pisa dinámicamente desde LEVELS[] al iniciar cada nivel.
  x:1650, y:540,
  rings: [
    { r:55,  points:100, name:'BULL' },
    { r:95,  points:50,  name:'MID'  },
    { r:135, points:25,  name:'OUT'  }
  ]
};
let COLLISION_SHRINK = 0.40; // 0..1 (más chico = más difícil)

// ---------- SCORE ----------
let score = 0;
let SCORE_MAX = 999, SCORE_MIN = 0;
let SCORE_PAD_3DIGITS = true;

const SCORE_X = 36, SCORE_Y = 34;
const SCORE_SCALE = 0.70;
const SCORE_TEXT_X = 230, SCORE_TEXT_Y = 103;
const SCORE_FONT_SIZE = 39;

let SCORE_FONT = null;
let SCORE_FONT_FILE = 'futuramdbt_bold.otf';

let scoreShakeT = 0;

// ---------- FX ----------
let hitFx = { active:false, x:0, y:0, t:0, dur:600 };
let floatTexts = []; // {text,x,y,t,dur}

// ---------- DEBUG ----------
let DEBUG = true;

// ---------- INTRO ----------
let hadThrownOnce = false;
let intro = {
  active:true, idx:0, t:0,
  inMs:650, holdMs:1100, outMs:650, gapMs:150,
  msgs:[
    { text:'HOLD TO GRAB THE AXE', size:44 },
    { text:'RELEASE TO THROW — SPEED FOLLOWS YOUR SWIPE', size:34 }
  ]
};
let introOffsetY = -430;

// ---------- MAIN MENU UI ----------
let menu = { btn: { x:0, y:0, w:0, h:0, pressed:false } };

// ---------- PRELOAD ----------
function preload(){
  // Escena Nivel 1 (se siguen usando, pero ahora además cargamos L2/L3)
  IMG_MAP['LEVEL 1 - BACKGROUND.png'] = loadImage('LEVEL 1 - BACKGROUND.png');
  IMG_MAP['LEVEL 1 - MIDGROUND.png']  = loadImage('LEVEL 1 - MIDGROUND.png');
  IMG_MAP['LEVEL 1 - FOREGROUND.png'] = loadImage('LEVEL 1 - FOREGROUND.png');

  // Escena Nivel 2
  IMG_MAP['LEVEL 2 - BACKGROUND.png'] = loadImage('LEVEL 2 - BACKGROUND.png');
  IMG_MAP['LEVEL 2 - MIDGROUND.png']  = loadImage('LEVEL 2 - MIDGROUND.png');
  IMG_MAP['LEVEL 2 - FOREGROUND.png'] = loadImage('LEVEL 2 - FOREGROUND.png');

  // Escena Nivel 3
  IMG_MAP['LEVEL 3 - BACKGROUND.png'] = loadImage('LEVEL 3 - BACKGROUND.png');
  IMG_MAP['LEVEL 3 - MIDGROUND.png']  = loadImage('LEVEL 3 - MIDGROUND.png');
  IMG_MAP['LEVEL 3 - FOREGROUND.png'] = loadImage('LEVEL 3 - FOREGROUND.png');

  // Sprites Bobby / HUD
  IMG_BOBBY_REST  = loadImage('BOBBY_REST.png');
  IMG_BOBBY_RISE  = loadImage('BOBBY_RISE.png');
  IMG_BOBBY_THROW = loadImage('BOBBY_THROW.png');

  IMG_AXE         = loadImage('AXE.png');
  IMG_SCORE       = loadImage('SCORE.png');

  IMG_WIND        = loadImage('WIND_VISSIBLE.png');

  // Main menu
  IMG_COVER             = loadImage('BOBBY AXE - COVER MASTER V3.png');
  IMG_BTN_START         = loadImage('START.png');
  IMG_BTN_START_PRESSED = loadImage('START PRESSED.png');

  // Fuente
  if (SCORE_FONT_FILE) SCORE_FONT = loadFont(SCORE_FONT_FILE);

  // Sonidos (con onError para no bloquear el preload si falta algo)
  if (typeof loadSound === 'function') {
    SND_AXE_THROW      = loadSound('AxeThrow.mp3',      null, () => SND_AXE_THROW=null);
    SND_BUTTON         = loadSound('Button.wav',        null, () => SND_BUTTON=null);
    SND_GRAB_AXE       = loadSound('GrabAxe.wav',       null, () => SND_GRAB_AXE=null);
    SND_LEVEL_COMPLETE = loadSound('LevelComplete.wav', null, () => SND_LEVEL_COMPLETE=null);
    SND_MAIN_MUSIC     = loadSound('Mainmusic.wav',     null, () => SND_MAIN_MUSIC=null);
    SND_POINTS_LOST    = loadSound('PointsLost.wav',    null, () => SND_POINTS_LOST=null);
    SND_TARGET         = loadSound('Target.mp3',        null, () => SND_TARGET=null);
    SND_WIND           = loadSound('Wind.wav',          null, () => SND_WIND=null);
    SND_AMB_LVL1       = loadSound('AmbLevel1.wav',     null, () => SND_AMB_LVL1=null);
  }

  // Asignar imágenes activas por defecto con el Nivel 1
  IMG_BG = IMG_MAP['LEVEL 1 - BACKGROUND.png'];
  IMG_MG = IMG_MAP['LEVEL 1 - MIDGROUND.png'];
  IMG_FG = IMG_MAP['LEVEL 1 - FOREGROUND.png'];
}

// ---------- SETUP ----------
function setup(){
  createCanvas(canvasWidth, canvasHeight);
  imageMode(CORNER);
  if (SCORE_FONT) textFont(SCORE_FONT);

  setMasterVol(AUDIO_VOLUME);

  // Prepara sprites recortados
  BOB_REST  = cropTransparent(IMG_BOBBY_REST, 1);
  BOB_RISE  = cropTransparent(IMG_BOBBY_RISE, 1);
  BOB_THROW = cropTransparent(IMG_BOBBY_THROW, 1);

  noiseSeed(Math.floor(Math.random()*100000));

  lastTime = millis();

  // Entramos al menú
  goToMenu();
}

// ---------- MAIN MENU ----------
function goToMenu(){
  gameState = GAME.MENU;

  // Colocar botón centrado abajo
  const bw = IMG_BTN_START ? IMG_BTN_START.width : 420;
  const bh = IMG_BTN_START ? IMG_BTN_START.height : 140;
  menu.btn.w = bw;
  menu.btn.h = bh;
  menu.btn.x = width/2 - bw/2;
  menu.btn.y = height - bh - 40;
  menu.btn.pressed = false;

  // Música principal ON en menú
  playMainMusic();

  // Volver a empezar desde el Nivel 1 al salir al menú
  currentLevelIndex = 0;
}

function renderMenu(){
  clear();
  if (IMG_COVER) {
    imageMode(CORNER);
    image(IMG_COVER, 0, 0, width, height);
  } else {
    background(10,9,14);
  }

  const b = menu.btn;
  const sprite = (b.pressed && IMG_BTN_START_PRESSED) ? IMG_BTN_START_PRESSED : IMG_BTN_START;
  if (sprite) image(sprite, b.x, b.y, b.w, b.h);
  else {
    noStroke(); fill(150,40,20,230); rect(b.x, b.y, b.w, b.h, 16);
    fill(255); textAlign(CENTER,CENTER); textSize(48); text('START', b.x+b.w/2, b.y+b.h/2);
  }
}

// ---------- LEVEL FLOW ----------
function applyLevelConfig(idx){
  const L = LEVELS[idx];

  // Target por nivel
  TARGET.x = L.target.x;
  TARGET.y = L.target.y;

  // Física por nivel
  GRAVITY  = L.gravity;
  WIND_POWER = L.windPower;
  WIND_BIAS  = L.windBias;
  WIND_AXE_GAIN = (typeof L.windGain === 'number') ? L.windGain : 1.0;

  // Objetivos/tiempo por nivel
  LEVEL_TIME_MS = Math.max(5, L.durationSec) * 1000;
  LEVEL_GOAL    = L.scoreTarget;

  // Fondos por nivel (mantiene orden BG -> MG -> Wind UI -> FG como en Nivel 1)
  IMG_BG = IMG_MAP[L.bg.bg] || IMG_BG;
  IMG_MG = IMG_MAP[L.bg.mg] || IMG_MG;
  IMG_FG = IMG_MAP[L.bg.fg] || IMG_FG;
}

function startLevel(){
  // Configurar a partir del nivel actual
  applyLevelConfig(currentLevelIndex);

  levelStartAt = millis();
  levelEndReason = '';
  overlay = { active:false, t:0, dur:600 };
  gameState = GAME.PLAY;
  hardReset(true);

  // asegurar música en niveles
  playMainMusic();

  hadThrownOnce = false;
  intro.active = true; intro.idx=0; intro.t=0;

  // Ambiente del nivel (opcional)
  if (SND_AMB_LVL1) {
    if (SND_AMB_LVL1.setLoop) SND_AMB_LVL1.setLoop(true);
    if (!SND_AMB_LVL1.isPlaying || !SND_AMB_LVL1.isPlaying()) {
      if (SND_AMB_LVL1.play) SND_AMB_LVL1.play();
    }
  }
}

function endLevel(){
  if (score > highScore) {
    highScore = score;
    try { if (window.localStorage) localStorage.setItem('bobby_highscore', String(highScore)); } catch(e){}
  }
  gameState = GAME.LEVEL_END;
  overlay.active = true; overlay.t = 0;

  // AUDIO: parar main music y sonar jingle
  stopMainMusic();
  if (SND_LEVEL_COMPLETE && SND_LEVEL_COMPLETE.play) SND_LEVEL_COMPLETE.play();
}

function goToNextScreen(){
  // Si hay un siguiente nivel, lo iniciamos. Si no, volvemos al menú.
  if (currentLevelIndex < LEVELS.length - 1) {
    currentLevelIndex++;
    restartLevel();
  } else {
    // Último nivel completado -> menú o reinicio del último
    goToMenu();
  }
}

function restartLevel(){
  score = 0;
  startLevel();
}

// ---------- DRAW ----------
function draw(){
  const now = millis();
  let dt = (now - lastTime)/1000;
  lastTime = now;
  if (dt > MAX_DT) dt = MAX_DT;

  if (!paused) {
    time += dt*1000;
    if (gameState === GAME.PLAY) update(dt);
    else if (gameState === GAME.LEVEL_END) updateOverlay(dt);
  }
  render();
}

// ---------- UPDATE ----------
function update(dt){
  recordInputSample(millis());

  const now = millis();
  if (currentPose === POSE.THROW) {
    if (now >= throwEndAt) currentPose = POSE.REST;
  }

  updateWindGusts(now, dt);
  updateAxes(dt);
  updateFx(dt);
  updateIntro(dt);
  updateTimerAndCheckEnd();

  noiseT += WIND_SCALE_T * (dt*60);
}

function updateFx(dt){
  if (hitFx.active) {
    hitFx.t += dt*1000;
    if (hitFx.t >= hitFx.dur) hitFx.active = false;
  }
  if (scoreShakeT > 0) {
    scoreShakeT -= dt*1000;
    if (scoreShakeT < 0) scoreShakeT = 0;
  }
  for (let i=floatTexts.length-1; i>=0; --i){
    const f = floatTexts[i];
    f.t += dt*1000;
    if (f.t >= f.dur) floatTexts.splice(i,1);
  }
}

function updateWindGusts(now, dt){
  if (GUSTS_ON && now >= gust.next) {
    const was = WIND_ACTIVE;
    WIND_ACTIVE = !WIND_ACTIVE;
    const range = WIND_ACTIVE ? gust.durOn : gust.durOff;
    const dur = random(range[0], range[1]);
    gust.next = now + dur;

    if (!was && WIND_ACTIVE && SND_WIND && SND_WIND.play) SND_WIND.play();
  }
  const target = WIND_ACTIVE ? 1 : 0;
  const k = WIND_VIS_FADE_S * dt;
  WIND_VIS_T += (target - WIND_VIS_T) * constrain(k, 0, 1);
}

function updateIntro(dt){
  if (!intro.active) return;
  if (gameState !== GAME.PLAY) { intro.active=false; return; }

  const cur = intro.msgs[intro.idx];
  if (!cur) { intro.active=false; return; }

  intro.t += dt*1000;
  const total = intro.inMs + intro.holdMs + intro.outMs + intro.gapMs;
  if (intro.t >= total) {
    intro.t = 0; intro.idx++;
    if (intro.idx >= intro.msgs.length) intro.active = false;
  }
}

function updateTimerAndCheckEnd(){
  const now = millis();
  const remain = Math.max(0, LEVEL_TIME_MS - (now - levelStartAt));
  if (score >= LEVEL_GOAL) {
    levelEndReason = 'Goal reached!';
    endLevel();
  } else if (remain === 0) {
    levelEndReason = "Time's up";
    endLevel();
  }
}

function updateOverlay(dt){
  if (!overlay.active) return;
  overlay.t += dt*1000;
  if (overlay.t > overlay.dur) overlay.t = overlay.dur;
}

// ---------- RENDER ----------
function render(){
  if (gameState === GAME.MENU) {
    renderMenu();
    return;
  }

  if (gameState === GAME.NEXT) {
    renderNextScreen();
    return;
  }

  clear();

  // Mantener el orden: BACKGROUND -> MIDGROUND -> (wind UI) -> FOREGROUND,
  // tal como en el Nivel 1
  image(IMG_BG, 0, 0, canvasWidth, canvasHeight);
  image(IMG_MG, 0, 0, canvasWidth, canvasHeight);

  drawWindSpriteSmall();

  image(IMG_FG, 0, 0, canvasWidth, canvasHeight);

  drawAxes();

  const r = getBobbyRect(currentPose);
  const sprite = (currentPose===POSE.THROW)?BOB_THROW:((currentPose===POSE.RISE)?BOB_RISE:BOB_REST);
  image(sprite.img, r.drawX, r.drawY, r.drawW, r.drawH);

  drawHUD();

  if (hitFx.active) drawHitFx();
  drawFloatTexts();

  drawIntro();

  if (DEBUG) {
    const hand = getHandPos();
    stroke(255,0,0); circle(hand.x, hand.y, 12);
    noFill(); stroke(0,255,0,130);
    for (const ring of TARGET.rings) circle(TARGET.x, TARGET.y, ring.r*2);
  }

  if (gameState === GAME.LEVEL_END) drawLevelEndOverlay();
}

function drawWindSpriteSmall(){
  if (!WIND_SPRITE_ON || !IMG_WIND) return;
  if (WIND_VIS_T <= 0.001) return;

  const ang = constrain(WIND_BIAS, -1, 1) * WIND_ROT_MAX;
  const eased = easeInOutCubic(constrain(WIND_VIS_T, 0, 1));

  const baseAlpha = 180;
  const extra     = 160 * constrain(Math.abs(WIND_POWER), 0, 1);
  const alpha     = constrain((baseAlpha + extra) * eased, 0, 255);

  push();
  translate(WIND_UI_X, WIND_UI_Y);
  rotate(ang);
  scale(WIND_UI_SCALE, WIND_UI_SCALE);
  tint(255, alpha);
  imageMode(CENTER);
  image(IMG_WIND, 0, 0);
  imageMode(CORNER);
  pop();
}

function drawHUD(){
  // Scoreboard
  push();
  const sbW = IMG_SCORE.width * SCORE_SCALE;
  const sbH = IMG_SCORE.height * SCORE_SCALE;
  let shakeX = 0, shakeY = 0;
  if (scoreShakeT > 0) {
    const k = scoreShakeT/250.0;
    shakeX = (noise(time*0.01)*2-1) * 6 * k;
    shakeY = (noise(time*0.013+9)*2-1) * 6 * k;
  }
  translate(shakeX, shakeY);
  image(IMG_SCORE, SCORE_X, SCORE_Y, sbW, sbH);

  score = constrain(score, SCORE_MIN, SCORE_MAX);
  const scoreStr = SCORE_PAD_3DIGITS ? pad3(score) : String(score);

  noStroke(); fill(255, 220, 160); textAlign(LEFT, TOP); textSize(SCORE_FONT_SIZE);
  text(scoreStr, SCORE_TEXT_X, SCORE_TEXT_Y);
  pop();

  // Timer Panel
  const remain = Math.max(0, LEVEL_TIME_MS - (millis() - levelStartAt));
  const secs = Math.ceil(remain/1000);
  const tStr = secs.toString().padStart(2,'0');

  const panelW = 150, panelH = 80;
  const px = width - panelW - 24;
  const py = 22;

  noStroke(); fill(18,16,24, 200);
  rect(px, py, panelW, panelH, 12);

  fill(255, 240, 220); textAlign(RIGHT, TOP);
  textSize(40);
  text(tStr, px + panelW - 12, py + 6);

  textSize(22); fill(220, 210, 200);
  textAlign(RIGHT, TOP);
  text('Goal: ' + LEVEL_GOAL, px + panelW - 12, py + 48);
}

function drawLevelEndOverlay(){
  const p = overlay.t/overlay.dur;
  const ease = easeOutCubic(p);
  const panelW = 640, panelH = 340;
  const x = width/2 - panelW/2;
  const yStart = -panelH - 40;
  const yEnd = height/2 - panelH/2;
  const y = lerp(yStart, yEnd, ease);

  noStroke(); fill(0, 0, 0, 140 * ease); rect(0,0,width,height);

  push();
  translate(0, y - yEnd);
  noStroke(); fill(25, 22, 30, 230);
  rect(x, yEnd, panelW, panelH, 18);

  fill(255);
  textAlign(CENTER, TOP);
  textSize(44); text('Level Complete', x+panelW/2, yEnd+28);
  textSize(26); fill(255,230,210);
  const reason = levelEndReason || 'Finished';
  text(reason, x+panelW/2, yEnd+88);

  textSize(28); fill(255);
  text('Score: '+score, x+panelW/2, yEnd+138);
  textSize(22); fill(220);
  text('Goal: '+LEVEL_GOAL, x+panelW/2, yEnd+174);

  const bw = 200, bh = 50, gap = 24;
  const btnY = yEnd + panelH - 86;

  const rx = x + panelW/2 - bw - gap/2;
  drawButton(rx, btnY, bw, bh, (currentLevelIndex===0?'Restart':'Retry'));
  overlayButtons.restart = {x:rx, y:btnY, w:bw, h:bh};

  const nx = x + panelW/2 + gap/2;
  drawButton(nx, btnY, bw, bh, (currentLevelIndex<LEVELS.length-1?'Next':'Menu'));
  overlayButtons.next = {x:nx, y:btnY, w:bw, h:bh};

  pop();
}

function drawButton(x,y,w,h,label){
  const hover = mouseX>=x && mouseX<=x+w && mouseY>=y && mouseY<=y+h;
  const c = hover ? 255 : 235;
  noStroke(); fill(60,60,70, 240); rect(x,y,w,h,10);
  fill(c);
  textAlign(CENTER, CENTER);
  textSize(22); text(label, x+w/2, y+h/2);
}

// ---------- INTRO RENDER ----------
function drawIntro(){
  if (!intro.active) return;
  const cur = intro.msgs[intro.idx];
  if (!cur) return;

  const t = intro.t;
  let a = 0.0;
  if (t < intro.inMs) {
    const p = t / intro.inMs; a = easeInOutCubic(constrain(p, 0, 1));
  } else if (t < intro.inMs + intro.holdMs) {
    a = 1.0;
  } else if (t < intro.inMs + intro.holdMs + intro.outMs) {
    const p = (t - (intro.inMs + intro.holdMs)) / intro.outMs;
    a = 1.0 - easeInOutCubic(constrain(p, 0, 1));
  } else {
    a = 0.0;
  }

  const alpha = 255 * a;
  if (alpha <= 1) return;

  push();
  textAlign(CENTER, CENTER);
  fill(0, 0, 0, alpha*0.6);
  noStroke();
  textSize(cur.size);
  text(cur.text, width/2 + 2, height/2 + 2 + introOffsetY);
  fill(255, 235, 210, alpha);
  text(cur.text, width/2, height/2 + introOffsetY);
  pop();
}

// ---------- INPUT HELPERS ----------
function inputDelta() {
  if (touches && touches.length > 0) {
    const t = touches[0];
    const p = {x: pmouseX, y: pmouseY};
    return { dx: t.x - p.x, dy: t.y - p.y };
  }
  return { dx: mouseX - pmouseX, dy: mouseY - pmouseY };
}

function getPointer(){
  if (touches && touches.length > 0) return {x: touches[0].x, y: touches[0].y};
  return {x: mouseX, y: mouseY};
}

function recordInputSample(now){
  const p = getPointer();
  _inputHist.push({t: now, x: p.x, y: p.y});
  const cutoff = now - Math.max(GESTURE_WINDOW_MS, 60);
  while (_inputHist.length > 1 && _inputHist[0].t < cutoff) _inputHist.shift();
}

function gestureSpeed(now){
  if (_inputHist.length < 2) return 0;
  const first = _inputHist[0];
  const last  = _inputHist[_inputHist.length-1];
  const dt = Math.max(1, last.t - first.t) / 1000.0;
  const distPx = Math.hypot(last.x-first.x, last.y-first.y);
  return distPx / dt;
}

// ---------- MATH & MISC ----------
function easeOutQuad(t){ return 1-(1-t)*(1-t); }
function easeOutCubic(t){ return 1-Math.pow(1-t,3); }
function easeInOutCubic(t){ return t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }

function pad3(n){ if (n<10) return '00'+n; if(n<100) return '0'+n; return ''+n; }

function fbm(x, y, octaves = 3) {
  let value = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * noise(x*freq, y*freq);
    amp *= 0.5; freq *= 2.0;
  }
  return value;
}

function cropTransparent(src, alphaThreshold = 1) {
  src.loadPixels();
  const w = src.width, h = src.height, px = src.pixels;
  let minX=w, minY=h, maxX=-1, maxY=-1;
  for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
    const i = (y*w+x)*4;
    if (px[i+3] > alphaThreshold) {
      if (x<minX) minX=x; if (y<minY) minY=y;
      if (x>maxX) maxX=x; if (y>maxY) maxY=y;
    }
  }
  if (maxX<minX || maxY<minY) return {img:src, ox:0, oy:0};
  const cw=maxX-minX+1, ch=maxY-minY+1;
  return {img:src.get(minX,minY,cw,ch), ox:minX, oy:minY};
}

function getBobbyRect(pose){
  const spr = (pose===POSE.THROW)?BOB_THROW:((pose===POSE.RISE)?BOB_RISE:BOB_REST);
  const mult = (pose===POSE.THROW)?POSE_SCALE.THROW:((pose===POSE.RISE)?POSE_SCALE.RISE:POSE_SCALE.REST);
  const targetH = desiredBobbyHeight * mult;
  const s = targetH / spr.img.height;
  const w = spr.img.width * s;
  const h = spr.img.height * s;
  const x = bobbyX;
  const y = groundY - h;
  return { drawX:x, drawY:y, drawW:w, drawH:h, scale:s };
}

function getHandPos(){
  const spr = BOB_RISE;
  const targetH = desiredBobbyHeight * POSE_SCALE.RISE;
  const s = targetH / spr.img.height;
  const w = spr.img.width * s;
  const h = spr.img.height * s;
  const x = bobbyX;
  const y = groundY - h;
  return { x: x + w * HAND_X, y: y + h * HAND_Y };
}

function pointsForDistance(d){
  for (const ring of TARGET.rings) {
    if (d <= ring.r * COLLISION_SHRINK) return ring.points;
  }
  return 0;
}

function mapRange(v, a0, a1, b0, b1){
  const denom = (a1 - a0);
  const t = denom === 0 ? 0 : (v - a0) / denom;
  return b0 + (b1 - b0) * constrain(t, 0, 1);
}

function spawnAxe(aimPoint = null){
  const hand = getHandPos();
  const axe = newAxe();
  axe.x = hand.x; axe.y = hand.y;

  // Dirección: al cursor si se aportó aimPoint; si no, al TARGET como fallback
  let tx = (aimPoint && typeof aimPoint.x === 'number') ? aimPoint.x : TARGET.x;
  let ty = (aimPoint && typeof aimPoint.y === 'number') ? aimPoint.y : TARGET.y;

  let dirX = tx - hand.x;
  let dirY = ty - hand.y;
  let len  = Math.hypot(dirX, dirY);

  // Evitar vector casi nulo: usa el último delta de gesto como respaldo
  if (len < 1e-3) {
    const first = _inputHist[0], last = _inputHist[_inputHist.length - 1];
    if (first && last) {
      dirX = last.x - first.x;
      dirY = last.y - first.y;
      len  = Math.hypot(dirX, dirY);
    }
    if (len < 1e-3) { dirX = 1; dirY = 0; len = 1; } // fallback duro
  }

  const ux = dirX / len;
  const uy = dirY / len;

  // Potencia por gesto (igual que antes)
  const vps = gestureSpeed(millis());
  let speedPF = mapRange(vps, GESTURE_VPS_MIN, GESTURE_VPS_MAX, THROW_SPEED_MIN, THROW_SPEED_MAX);
  speedPF = constrain(speedPF, THROW_SPEED_MIN, THROW_SPEED_MAX);
  _lastThrowSpeed = speedPF;

  // Sin clamp hacia delante: permite tiros hacia arriba si apuntas arriba
  axe.vx = ux * speedPF;
  axe.vy = uy * speedPF;

  axe.angle = Math.atan2(axe.vy, axe.vx);

  axes.push(axe);

  hadThrownOnce = true;
  intro.active = false;
}

function updateAxes(dt){
  for (let i=axes.length-1; i>=0; --i){
    const axe = axes[i];
    if (!axe.active) { axes.splice(i,1); continue; }

    if (!axe.stuck) {
      if (GRAVITY_ON) axe.vy += GRAVITY * (dt*60);

      // Viento con ráfagas + sesgo + potencia por nivel
      if (CHAOS_WIND_ON && WIND_ACTIVE) {
        const raw  = fbm(noiseT, axe.y * WIND_SCALE_Y, 4) * 2 - 1; // [-1..1]
        const bias = constrain(WIND_BIAS, -1, 1);                   // sesgo acotado
        const wind = (raw + bias) * WIND_POWER;
        axe.vx += wind * WIND_AXE_GAIN * (dt*60);
      }

      axe.x += axe.vx * (dt*60);
      axe.y += axe.vy * (dt*60);
      axe.angle = Math.atan2(axe.vy, axe.vx);

      const d = dist(axe.x, axe.y, TARGET.x, TARGET.y);
      let pts = pointsForDistance(d);
      if (pts > 0) {
        axe.stuck = true;
        axe.vx = axe.vy = 0;
        axe.stickStart = millis();
        score += pts;

        if (SND_TARGET && SND_TARGET.play) SND_TARGET.play();

        hitFx = { active:true, x:TARGET.x, y:TARGET.y, t:0, dur:600 };
      }

      if (axe.x < -120 || axe.x > width+120 || axe.y < -120 || axe.y > height+120) {
        axe.active = false;
        const pen = Math.min(10, score);
        score = constrain(score - pen, SCORE_MIN, SCORE_MAX);
        scoreShakeT = 300;
        floatTexts.push({ text:'-'+pen, x:SCORE_TEXT_X+60, y:SCORE_TEXT_Y+20, t:0, dur:800 });

        if (SND_POINTS_LOST && SND_POINTS_LOST.play) SND_POINTS_LOST.play();
      }
    } else {
      const t = (millis() - axe.stickStart) / 1000;
      const decay = Math.exp(-axe.wobbleDecay * t);
      const wob = Math.sin(axe.wobbleFreq * t) * axe.wobbleAmp * decay;
      axe.angle = wob;
      if (millis() - axe.stickStart > 1000) axe.active = false;
    }
  }
}

function drawAxes(){
  for (const axe of axes){
    if (!axe.active) continue;
    push();
    translate(axe.x, axe.y);
    rotate(axe.angle);
    imageMode(CENTER);
    image(IMG_AXE, AXE_DRAW_OFFSET_X, AXE_DRAW_OFFSET_Y, IMG_AXE.width * AXE_SCALE, IMG_AXE.height * AXE_SCALE);
    imageMode(CORNER);
    pop();
  }
}

function drawHitFx(){
  const p = hitFx.t / hitFx.dur;
  const r = lerp(10, 150, easeOutQuad(p));
  const a = 180 * (1 - p);
  noFill(); stroke(255, 245, 200, a); strokeWeight(4);
  circle(hitFx.x, hitFx.y, r*2);
}

function drawFloatTexts(){
  for (const f of floatTexts){
    const p = f.t / f.dur;
    const yy = lerp(0, -40, easeOutQuad(p));
    const a = 255 * (1 - p);
    push();
    noStroke(); fill(255,80,80,a);
    textAlign(LEFT, TOP); textSize(36);
    text(f.text, f.x, f.y + yy);
    pop();
  }
}

// ---------- INPUT ----------
function keyPressed(){
  if (key==='p'||key==='P') paused = !paused;
  if (key==='r'||key==='R') restartLevel();
  if (key==='v'||key==='V') {
    const was = WIND_ACTIVE;
    WIND_ACTIVE = !WIND_ACTIVE; 
    gust.next = millis() + 999999; // pausa auto
    if (!was && WIND_ACTIVE && SND_WIND && SND_WIND.play) SND_WIND.play();
  }
  if (gameState===GAME.LEVEL_END && (key==='n'||key==='N')) goToNextScreen();
}

function mousePressed(){
  // --- MENU ---
  if (gameState === GAME.MENU){
    const b = menu.btn;
    if (mouseX>=b.x && mouseX<=b.x+b.w && mouseY>=b.y && mouseY<=b.y+b.h){
      b.pressed = true;
      if (SND_BUTTON && SND_BUTTON.play) SND_BUTTON.play();
    }
    return;
  }

  // --- LEVEL_END OVERLAY ---
  if (gameState === GAME.LEVEL_END){
    const m = {x:mouseX, y:mouseY};
    const hit = (b)=> m.x>=b.x && m.x<=b.x+b.w && m.y>=b.y && m.y<=b.y+b.h;
    if (hit(overlayButtons.next))    { if (SND_BUTTON && SND_BUTTON.play) SND_BUTTON.play(); goToNextScreen(); return; }
    if (hit(overlayButtons.restart)) { if (SND_BUTTON && SND_BUTTON.play) SND_BUTTON.play(); restartLevel();    return; }
  }

  // --- PLAY ---
  beginHold();
}

function mouseReleased(){
  // --- MENU ---
  if (gameState === GAME.MENU){
    const b = menu.btn;
    const inside = mouseX>=b.x && mouseX<=b.x+b.w && mouseY>=b.y && mouseY<=b.y+b.h;
    const wasPressed = b.pressed;
    b.pressed = false;
    if (wasPressed && inside){ startLevel(); }
    return;
  }
  endHold();
}

// Touch wrappers
function touchStarted(){
  if (gameState === GAME.MENU){
    const b = menu.btn;
    if (touches.length){
      const t = touches[0];
      if (t.x>=b.x && t.x<=b.x+b.w && t.y>=b.y && t.y<=b.y+b.h){
        b.pressed = true;
        if (SND_BUTTON && SND_BUTTON.play) SND_BUTTON.play();
      }
    }
    return false;
  }
  beginHold();
  return false;
}
function touchEnded(){
  if (gameState === GAME.MENU){
    const b = menu.btn;
    const inside = mouseX>=b.x && mouseX<=b.x+b.w && mouseY>=b.y && mouseY<=b.y+b.h;
    const wasPressed = b.pressed;
    b.pressed = false;
    if (wasPressed && inside){ startLevel(); }
    return false;
  }
  endHold();
  return false;
}

function beginHold(){
  if (gameState !== GAME.PLAY) return;
  isHolding = true;
  currentPose = POSE.RISE;

  if (typeof userStartAudio === 'function') userStartAudio();
  if (SND_GRAB_AXE && SND_GRAB_AXE.play) SND_GRAB_AXE.play();

  _inputHist.length = 0;
  recordInputSample(millis());
}

function endHold(){
  if (!isHolding) return;
  isHolding = false;

  const now = millis();
  if (now - lastThrowAt < THROW_COOLDOWN_MS) {
    currentPose = POSE.REST; return;
  }

  currentPose = POSE.THROW;
  lastThrowAt = now;

  // El hacha apunta a donde esté el cursor al SOLTAR (puede ir hacia arriba)
  const aimPoint = getPointer();
  spawnAxe(aimPoint);

  throwEndAt = now + THROW_HOLD_MS;

  if (SND_AXE_THROW && SND_AXE_THROW.play) SND_AXE_THROW.play();
}

function renderNextScreen(){
  clear();
  background(10,9,14);
  noStroke(); fill(255);
  textAlign(CENTER, CENTER);
  textSize(44); text('Next level — coming soon', width/2, height/2 - 20);
  textSize(20); fill(220); text('Press R to restart current level', width/2, height/2 + 30);
}

function hardReset(keepScore=false){
  axes.length = 0;
  scoreShakeT = 0; 
  hitFx.active = false; hitFx.t = 0; 
  floatTexts.length = 0;
  currentPose = POSE.REST;
  if (!keepScore) score = 0;
}
