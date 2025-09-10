// ===== Bobby Axe Prototype - v0.7.5 =====
// p5.js

let canvasWidth = 1920, canvasHeight = 1080;

// ---------- ART ----------
let IMG_BG, IMG_MG, IMG_FG;
let IMG_BOBBY_REST, IMG_BOBBY_RISE, IMG_BOBBY_THROW;
let IMG_AXE, IMG_SCORE;
let IMG_WIND;

// ---------- SPRITES RECORTADOS ----------
let BOB_REST = null, BOB_RISE = null, BOB_THROW = null;

// ---------- PLACEMENT ----------
let groundY = canvasHeight - 150;
let bobbyX = 250;
let desiredBobbyHeight = 300;

// Escala por pose
const POSE_SCALE = {
  REST: 1.00,
  RISE: 1.15, // agranda el RISE
  THROW: 1.00
};

// ---------- FSM POSES ----------
const POSE = { REST: 'REST', RISE: 'RISE', THROW: 'THROW' };
let currentPose = POSE.REST;

// ---------- INPUT THRESHOLDS ----------
const UP_DY_THRESHOLD   = -3;
const FWD_DX_THRESHOLD  = 12;
const IDLE_MS           = 400;
const THROW_HOLD_MS     = 120;
const THROW_COOLDOWN_MS = 160; // intervalo mínimo entre spawns
let lastMoveAt  = 0;
let lastThrowAt = -9999;

// ---- GESTURE (velocidad) ----
const GESTURE_WINDOW_MS = 140; // ventana de muestreo reciente
const GESTURE_VPS_MIN = 300;   // px/seg (gesto mínimo)
const GESTURE_VPS_MAX = 2600;  // px/seg (gesto fuerte)
const THROW_SPEED_MIN = 18;    // px/frame (~60fps) mínimo
const THROW_SPEED_MAX = 72;    // px/frame máximo
const AIM_GESTURE_BLEND = 0.08; // no se usa para apuntar (dir al target)
let _inputHist = [];           // {t,x,y}
let _lastThrowSpeed = 34;      // debug

// ---------- GAME STATE ----------
const GAME = { PLAY:'PLAY', LEVEL_END:'LEVEL_END', NEXT:'NEXT' };
let gameState = GAME.PLAY;

// Nivel/Timer/Meta
let LEVEL_TIME_MS = 60000; // 60s
let LEVEL_GOAL = 300;      // meta por defecto
let levelStartAt = 0;      // ms epoch del comienzo
let levelEndReason = '';

// High Score (no se muestra en overlay, pero lo guardamos)
let highScore = 0;

// Overlay anim
let overlay = { active:false, t:0, dur:600 };
// Overlay buttons (cache)
let overlayButtons = { next:{x:0,y:0,w:0,h:0}, restart:{x:0,y:0,w:0,h:0} };

// ---------- GAME LOOP ----------
let paused = false;
let lastTime = 0;   // en ms
let time = 0;       // acumulado en ms
const MAX_DT = 1/30; // cap de dt (segundos)

// ---------- DIFICULTAD / VIENTO ----------
let CHAOS_WIND_ON   = true;   // si querés desactivar viento físico: false
let WIND_POWER      = 0.90;   // fuerza base del viento
let WIND_AXE_GAIN   = 0.70;   // cuánto afecta al hacha
let WIND_BIAS       = 0.10;   // sesgo de viento (-1 izquierda, +1 derecha)

let WIND_SCALE_T    = 0.005;  // escala temporal
let WIND_SCALE_Y    = 0.002;  // escala vertical
let noiseT = 0.0;

// ---------- GRAVEDAD ----------
let GRAVITY_ON = true;
let GRAVITY = 0.15; // px/frame^2 (~60fps). Se escala por dt*60

// ---------- VIENTO VISIBLE (icono pequeño) ----------
let WIND_SPRITE_ON    = true;   // mostrar viento visual
let WIND_UI_X         = 360;    // posición aprox entre Bobby y Score
let WIND_UI_Y         = 120;
let WIND_UI_SCALE     = 0.25;   // tamaño
const WIND_ROT_MAX    = 0.35;   // ±20°

let WIND_ACTIVE       = false;  // si sopla
let WIND_VIS_T        = 0;      // fade 0..1 (arranca oculto)
const WIND_VIS_FADE_S = 20;     // velocidad de fade (1/seg)

// Ráfagas automáticas (toggle on/off)
let GUSTS_ON = true;
let gust = { next:0, durOn:[1400, 4000], durOff:[1800, 6000] };

// ---------- AXES (multiple) ----------
let axes = [];

function newAxe() {
  return {
    active:true, stuck:false, x:0, y:0, vx:0, vy:0, angle:0,
    stickStart:0, stickDepth:12,
    wobbleAmp:0.28, wobbleDecay:3.0, wobbleFreq:18.0,
  };
}

const AXE_SCALE         = 0.70;
const AXE_DRAW_OFFSET_X = 280;
const AXE_DRAW_OFFSET_Y = -150;

let HAND_X = 0.72; 
let HAND_Y = 0.08;

// ---------- TARGET ----------
const TARGET = {
  x: 1650,
  y: 548,
  rings: [
    { r: 55,  points: 100, name: 'BULL' },
    { r: 95,  points: 50,  name: 'MID'  },
    { r: 135, points: 25,  name: 'OUT'  }
  ]
};

let COLLISION_SHRINK = 0.30;  // más difícil
let MISS_PENALTY     = 10;    // penalización al fallar

// ---------- SCORE ----------
let score = 0;
let SCORE_MAX = 999;
let SCORE_MIN = 0;
let SCORE_PAD_3DIGITS = true;

const SCORE_X = 36, SCORE_Y = 34;
const SCORE_SCALE = 0.70;
const SCORE_TEXT_X = 230, SCORE_TEXT_Y = 103;
const SCORE_FONT_SIZE = 39;

// Tipografía global
let SCORE_FONT = null;            
let SCORE_FONT_FILE = 'futuramdbt_bold.otf'; // tu archivo OTF

// efecto shake del marcador
let scoreShakeT = 0; // ms restantes de shake

// ---------- HIT / MISS FX ----------
let hitFx = { active:false, x:0, y:0, t:0, dur:600 };
let floatTexts = []; // {text, x,y, t, dur}

// ---------- DEBUG ----------
let DEBUG = false;

// ---------- INTRO MESSAGES ----------
let hadThrownOnce = false;
let intro = {
  active: true,
  idx: 0,
  t: 0,
  // timings (ms)
  inMs: 650,
  holdMs: 1100,
  outMs: 650,
  gapMs: 150,
  msgs: [
    { text: 'CUT THE TAXES', size: 86 },
    { text: 'USE YOUR MOUSE / TOUCH TO CONTROL THE AXE', size: 34 }
  ]
};
// Ajuste manual de altura (negativo = más arriba)
let introOffsetY = -430;
// ---------- PRELOAD ----------
function preload() {
  IMG_BG          = loadImage('LEVEL 1 - BACKGROUND.png');
  IMG_MG          = loadImage('LEVEL 1 - MIDGROUND.png');
  IMG_FG          = loadImage('LEVEL 1 - FOREGROUND.png');

  IMG_BOBBY_REST  = loadImage('BOBBY_REST.png');
  IMG_BOBBY_RISE  = loadImage('BOBBY_RISE.png');
  IMG_BOBBY_THROW = loadImage('BOBBY_THROW.png');

  IMG_AXE         = loadImage('AXE.png');
  IMG_SCORE       = loadImage('SCORE.png');

  IMG_WIND        = loadImage('WIND_VISSIBLE.png'); // sprite visual viento

  if (SCORE_FONT_FILE) {
    SCORE_FONT = loadFont(SCORE_FONT_FILE);
  }
}

// ---------- SETUP ----------
function setup() {
  createCanvas(canvasWidth, canvasHeight);
  imageMode(CORNER);

  if (SCORE_FONT) {
    textFont(SCORE_FONT);   // fuente global para todo
  }

  BOB_REST  = cropTransparent(IMG_BOBBY_REST, 1);
  BOB_RISE  = cropTransparent(IMG_BOBBY_RISE, 1);
  BOB_THROW = cropTransparent(IMG_BOBBY_THROW, 1);

  noiseSeed(Math.floor(Math.random()*100000));

  lastMoveAt = millis();
  lastTime = millis();

  startLevel();
}

function startLevel() {
  levelStartAt = millis();
  levelEndReason = '';
  overlay = { active:false, t:0, dur:600 };
  gameState = GAME.PLAY;
  hardReset(true); // true = no resetear score

  // intro reset
  hadThrownOnce = false;
  intro.active = true;
  intro.idx = 0;
  intro.t = 0;
}

// ---------- DRAW (Game Loop) ----------
function draw() {
  const now = millis();
  let dt = (now - lastTime) / 1000; // segundos
  lastTime = now;
  if (dt > MAX_DT) dt = MAX_DT;

  if (!paused) {
    time += dt * 1000; // acumulado en ms
    if (gameState === GAME.PLAY) update(dt);
    else if (gameState === GAME.LEVEL_END) updateOverlay(dt);
  }
  render();
}

// ---------- UPDATE ----------
function update(dt) {
  recordInputSample(millis());

  const {dx, dy} = inputDelta();
  const now = millis();
  if (Math.hypot(dx, dy) > 0.5) lastMoveAt = now;

  const throwHeld = (now - lastThrowAt) < THROW_HOLD_MS;
  if (currentPose === POSE.REST) {
    if (dy <= UP_DY_THRESHOLD) currentPose = POSE.RISE;
  } else if (currentPose === POSE.RISE) {
    if (dx >= FWD_DX_THRESHOLD) {
      if (now - lastThrowAt >= THROW_COOLDOWN_MS) {
        currentPose = POSE.THROW;
        lastThrowAt = now;
        spawnAxe();
      }
    } else if (now - lastMoveAt > IDLE_MS) {
      currentPose = POSE.REST;
    }
  } else if (currentPose === POSE.THROW) {
    if (!throwHeld) currentPose = POSE.REST;
  }

  updateWindGusts(now, dt);
  updateAxes(dt);
  updateFx(dt);
  updateIntro(dt);
  updateTimerAndCheckEnd();

  noiseT += WIND_SCALE_T * (dt*60); // viento tiempo
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
    WIND_ACTIVE = !WIND_ACTIVE;
    const range = WIND_ACTIVE ? gust.durOn : gust.durOff;
    const dur = random(range[0], range[1]);
    gust.next = now + dur;
  }
  const target = WIND_ACTIVE ? 1 : 0;
  const k = WIND_VIS_FADE_S * dt;
  WIND_VIS_T += (target - WIND_VIS_T) * constrain(k, 0, 1);
}

function updateIntro(dt){
  if (!intro.active) return;
  if (gameState !== GAME.PLAY) { intro.active = false; return; }

  const cur = intro.msgs[intro.idx];
  if (!cur) { intro.active = false; return; }

  intro.t += dt*1000;
  const total = intro.inMs + intro.holdMs + intro.outMs + intro.gapMs;
  if (intro.t >= total) {
    intro.t = 0;
    intro.idx++;
    if (intro.idx >= intro.msgs.length) {
      intro.active = false;
    }
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

function endLevel(){
  if (score > highScore) {
    highScore = score;
    try { if (window.localStorage) localStorage.setItem('bobby_highscore', String(highScore)); } catch(e) {}
  }
  gameState = GAME.LEVEL_END;
  overlay.active = true; overlay.t = 0;
}

function updateOverlay(dt){
  if (!overlay.active) return;
  overlay.t += dt*1000;
  if (overlay.t > overlay.dur) overlay.t = overlay.dur;
}
// ---------- RENDER ----------
function render() {
  if (gameState === GAME.NEXT) {
    renderNextScreen();
    return;
  }

  clear();

  image(IMG_BG, 0, 0, canvasWidth, canvasHeight);
  image(IMG_MG, 0, 0, canvasWidth, canvasHeight);

  // Viento visible (icono pequeño)
  drawWindSpriteSmall();

  image(IMG_FG, 0, 0, canvasWidth, canvasHeight);

  // Axes
  drawAxes();

  // Bobby
  const {drawX, drawY, drawW, drawH} = getBobbyRect(currentPose);
  const sprite = (currentPose === POSE.THROW) ? BOB_THROW
                : (currentPose === POSE.RISE) ? BOB_RISE
                : BOB_REST;
  image(sprite.img, drawX, drawY, drawW, drawH);

  // HUD
  drawHUD();

  // FX
  if (hitFx.active) drawHitFx();
  drawFloatTexts();

  // Intro messages
  drawIntro();

  if (DEBUG) {
    const hand = getHandPos();
    stroke(255,0,0); circle(hand.x, hand.y, 12);
    noFill(); stroke(0,255,0,130);
    for (const ring of TARGET.rings) circle(TARGET.x, TARGET.y, ring.r*2);
  }

  if (gameState === GAME.LEVEL_END) drawLevelEndOverlay();
}

// ---------- WIND SPRITE ----------
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
  drawButton(rx, btnY, bw, bh, 'Restart');
  overlayButtons.restart = {x:rx, y:btnY, w:bw, h:bh};

  const nx = x + panelW/2 + gap/2;
  drawButton(nx, btnY, bw, bh, 'Next');
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
    const p = t / intro.inMs;
    a = easeInOutCubic(constrain(p, 0, 1));
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
  // Soporta mouse y touch (primer touch)
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
  // recortar ventana
  const cutoff = now - Math.max(GESTURE_WINDOW_MS, 60);
  while (_inputHist.length > 1 && _inputHist[0].t < cutoff) _inputHist.shift();
}

function gestureSpeed(now){
  if (_inputHist.length < 2) return 0;
  const first = _inputHist[0];
  const last  = _inputHist[_inputHist.length-1];
  const dt = Math.max(1, last.t - first.t) / 1000.0; // seg
  const distPx = Math.hypot(last.x-first.x, last.y-first.y);
  return distPx / dt; // px/seg
}

// ---------- MATH & MISC ----------
function easeOutQuad(t){ return 1-(1-t)*(1-t); }
function easeOutCubic(t){ return 1-Math.pow(1-t,3); }
function easeInOutCubic(t){ return t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }

function pad3(n) {
  if (n < 10) return '00' + n;
  if (n < 100) return '0' + n;
  return '' + n;
}

// FBM
function fbm(x, y, octaves = 3) {
  let value = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * noise(x*freq, y*freq);
    amp *= 0.5; freq *= 2.0;
  }
  return value;
}

// cropTransparent
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

// ---------- RENDER: AXES & BOBBY ----------
function getBobbyRect(pose) {
  const spr = (pose === POSE.THROW) ? BOB_THROW
            : (pose === POSE.RISE)  ? BOB_RISE
            : BOB_REST;

  const mult = (pose === POSE.THROW) ? POSE_SCALE.THROW
             : (pose === POSE.RISE)  ? POSE_SCALE.RISE
             : POSE_SCALE.REST;

  const targetH = desiredBobbyHeight * mult;
  const s = targetH / spr.img.height;

  const w = spr.img.width * s;
  const h = spr.img.height * s;
  const x = bobbyX;
  const y = groundY - h;
  return { drawX:x, drawY:y, drawW:w, drawH:h, scale:s };
}

function getHandPos() {
  // referencia del hand usando RISE
  const spr = BOB_RISE;
  const targetH = desiredBobbyHeight * POSE_SCALE.RISE;
  const s = targetH / spr.img.height;
  const w = spr.img.width * s;
  const h = spr.img.height * s;
  const x = bobbyX;
  const y = groundY - h;
  return { x: x + w * HAND_X, y: y + h * HAND_Y };
}

function pointsForDistance(d) {
  for (const ring of TARGET.rings) {
    if (d <= ring.r * COLLISION_SHRINK) return ring.points;
  }
  return 0;
}

function mapRange(v, a0, a1, b0, b1){
  const t = (v - a0) / (a1 - a0);
  return b0 + (b1 - b0) * constrain(t, 0, 1);
}

function spawnAxe() {
  const hand = getHandPos();
  const axe = newAxe();
  axe.x = hand.x; 
  axe.y = hand.y;

  // Dirección SIEMPRE al target (evita “rebotes” hacia atrás)
  let dirX = TARGET.x - hand.x;
  let dirY = TARGET.y - hand.y;
  let len  = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / len;
  const uy = dirY / len;

  // Potencia desde la velocidad del gesto (px/seg → px/frame)
  const vps = gestureSpeed(millis());
  let speedPF = mapRange(vps, GESTURE_VPS_MIN, GESTURE_VPS_MAX, THROW_SPEED_MIN, THROW_SPEED_MAX);
  speedPF = constrain(speedPF, THROW_SPEED_MIN, THROW_SPEED_MAX);
  _lastThrowSpeed = speedPF;

  // Velocidad inicial (con un mínimo hacia adelante)
  const MIN_FORWARD_VX = 6; // px/frame
  axe.vx = Math.max(MIN_FORWARD_VX, ux * speedPF);
  axe.vy = uy * speedPF;
  axe.angle = Math.atan2(axe.vy, axe.vx);

  axes.push(axe);

  // ocultar intro al primer tiro
  hadThrownOnce = true;
  intro.active = false;
}

function updateAxes(dt){
  for (let i=axes.length-1; i>=0; --i){
    const axe = axes[i];
    if (!axe.active) { axes.splice(i,1); continue; }

    if (!axe.stuck) {
      if (GRAVITY_ON) axe.vy += GRAVITY * (dt*60);

      // Viento solo cuando hay ráfaga activa
      if (CHAOS_WIND_ON && WIND_ACTIVE) {
        const n = fbm(noiseT, axe.y * WIND_SCALE_Y, 4);
        let wind = (n * 2 - 1 + WIND_BIAS) * WIND_POWER;
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
        hitFx = { active:true, x:TARGET.x, y:TARGET.y, t:0, dur:600 };
      }

      if (axe.x < -120 || axe.x > width+120 || axe.y < -120 || axe.y > height+120) {
        axe.active = false;
        const pen = Math.min(MISS_PENALTY, score);
        score = constrain(score - pen, SCORE_MIN, SCORE_MAX);
        scoreShakeT = 300;
        floatTexts.push({ text:'-'+pen, x:SCORE_TEXT_X+60, y:SCORE_TEXT_Y+20, t:0, dur:800 });
      }
    } else {
      const t = (millis() - axe.stickStart) / 1000;
      const decay = Math.exp(-axe.wobbleDecay * t);
      const wob = Math.sin(axe.wobbleFreq * t) * axe.wobbleAmp * decay;
      axe.angle = wob;
      if (millis() - axe.stickStart > 1000) axe.active = false; // desaparece tras 1s
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

function drawHitFx() {
  const p = hitFx.t / hitFx.dur;
  const r0 = 10;
  const r1 = 150;
  const r = lerp(r0, r1, easeOutQuad(p));
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
    textAlign(LEFT, TOP);
    textSize(36);
    text(f.text, f.x, f.y + yy);
    pop();
  }
}

// ---------- INPUT: KEYBOARD / MOUSE ----------
function keyPressed() {
  if (key === 'p' || key === 'P') paused = !paused;
  if (key === 'r' || key === 'R') restartLevel();
  if (key === 'v' || key === 'V') { // toggle manual de ráfaga para probar
    WIND_ACTIVE = !WIND_ACTIVE; 
    gust.next = millis() + 999999; // pausa el auto-toggle
  }
  if (gameState === GAME.LEVEL_END && (key === 'n' || key === 'N')) goToNextScreen();
}

function mousePressed(){
  if (gameState === GAME.LEVEL_END){
    const m = {x:mouseX, y:mouseY};
    const hit = (b)=> m.x>=b.x && m.x<=b.x+b.w && m.y>=b.y && m.y<=b.y+b.h;
    if (hit(overlayButtons.next)) { goToNextScreen(); return; }
    if (hit(overlayButtons.restart)) { restartLevel(); return; }
  }
}

function restartLevel(){
  // Reinicia el nivel completo (timer + score)
  score = 0;
  startLevel();
}

function goToNextScreen(){
  gameState = GAME.NEXT;
}

function renderNextScreen(){
  clear();
  background(10,9,14);
  noStroke(); fill(255);
  textAlign(CENTER, CENTER);
  textSize(44); text('Next level — coming soon', width/2, height/2 - 20);
  textSize(20); fill(220); text('Press R to restart current level', width/2, height/2 + 30);
}

function hardReset(keepScore=false) {
  axes.length = 0;
  scoreShakeT = 0; 
  hitFx.active = false; 
  hitFx.t = 0; 
  floatTexts.length = 0;
  currentPose = POSE.REST;
  if (!keepScore) score = 0;
}
