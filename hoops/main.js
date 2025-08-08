const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const streakEl = document.getElementById('streak');
const bestEl = document.getElementById('best');
const overlay = document.getElementById('overlay');
const playBtn = document.getElementById('playBtn');
const muteBtn = document.getElementById('muteBtn');

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function now() { return performance.now() / 1000; }

// Audio
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let isMuted = false;
function ping(freq = 880, dur = 0.08, vol = 0.15){
  if (isMuted) return;
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}
function noiseClick(vol = 0.08, dur = 0.05){
  if (isMuted) return;
  const bufferSize = 2 * audioCtx.sampleRate * dur;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize));
  const src = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  gain.gain.value = vol;
  src.buffer = buffer;
  src.connect(gain).connect(audioCtx.destination);
  src.start();
}

// World
const WORLD = {
  width: canvas.width,
  height: canvas.height,
  gravity: 1800,
  floorY: canvas.height - 60,
};

// Player
const player = {
  x: 180,
  y: WORLD.floorY - 40,
  vx: 0,
  vy: 0,
  width: 28,
  height: 40,
  speed: 420,
  jumpSpeed: 800,
  onGround: true,
  facing: 1,
};

// Ball
const ball = {
  x: player.x + 15,
  y: WORLD.floorY - 55,
  vx: 0,
  vy: 0,
  r: 12,
  held: true,
  restitution: 0.55,
  spin: 0,
};

// Hoop
const hoop = {
  x: WORLD.width - 180,
  y: WORLD.height * 0.42,
  backboardW: 14,
  backboardH: 120,
  rimR: 18,
  rimOffsetX: -30,
  rimOffsetY: 10,
  netY: 32,
};

let score = 0;
let streak = 0;
let best = Number(localStorage.getItem('best_2d_hoops') || '0');
bestEl.textContent = String(best);

// Input
const keys = new Set();
let charging = false;
let chargeStart = 0;

window.addEventListener('keydown', (e) => {
  if (['Space','ArrowUp','ArrowLeft','ArrowRight','KeyW','KeyA','KeyD','KeyJ','KeyK','KeyR','KeyM'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if ((e.code === 'KeyJ' || e.code === 'KeyK') && ball.held) {
    charging = true; chargeStart = now();
  }
  if (e.code === 'KeyR') reset();
  if (e.code === 'KeyM') toggleMute();
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if ((e.code === 'KeyJ' || e.code === 'KeyK') && charging) {
    shoot();
  }
});

playBtn.addEventListener('click', () => { overlay.classList.add('hidden'); });
muteBtn.addEventListener('click', toggleMute);
function toggleMute(){
  isMuted = !isMuted; muteBtn.textContent = isMuted ? '🔈' : '🔊';
}

function resetBallHeld(){
  ball.held = true;
  ball.vx = ball.vy = 0; ball.spin = 0;
  ball.x = player.x + player.width * 0.6 * player.facing;
  ball.y = player.y - 15;
}
function reset(){
  score = 0; streak = 0; updateHUD();
  player.x = 180; player.y = WORLD.floorY - player.height; player.vx = 0; player.vy = 0; player.onGround = true; player.facing = 1;
  resetBallHeld();
}

function updateHUD(){
  scoreEl.textContent = String(score);
  streakEl.textContent = String(streak);
  bestEl.textContent = String(best);
}

function shoot(){
  charging = false;
  const t = clamp(now() - chargeStart, 0, 1.25);
  const power = lerp(550, 1050, t / 1.25);
  const angleDeg = clamp(lerp(35, 60, t / 1.25), 30, 65);
  const angle = angleDeg * Math.PI / 180;
  ball.held = false;
  const dir = player.facing;
  ball.vx = Math.cos(angle) * power * dir;
  ball.vy = -Math.sin(angle) * power;
  ball.spin = 5 * dir;
  ping(740, 0.08, 0.12);
}

function handleInput(dt){
  const left = keys.has('KeyA') || keys.has('ArrowLeft');
  const right = keys.has('KeyD') || keys.has('ArrowRight');
  const jump = keys.has('KeyW') || keys.has('ArrowUp') || keys.has('Space');

  player.vx = 0;
  if (left) { player.vx = -player.speed; player.facing = -1; }
  if (right){ player.vx = player.speed; player.facing = 1; }
  if (jump && player.onGround){ player.vy = -player.jumpSpeed; player.onGround = false; ping(440, 0.06, 0.08); }
}

function integrate(dt){
  // Player physics
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  if (!player.onGround) player.vy += WORLD.gravity * dt;
  if (player.y + player.height >= WORLD.floorY){
    player.y = WORLD.floorY - player.height; player.vy = 0; player.onGround = true;
  }
  player.x = clamp(player.x, 20, WORLD.width - 200);

  // Ball physics
  if (ball.held){
    ball.x = player.x + player.width * 0.6 * player.facing;
    ball.y = player.y - 15 - (charging ? 6 : 0);
  } else {
    ball.vy += WORLD.gravity * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Floor bounce
    if (ball.y + ball.r > WORLD.floorY){
      ball.y = WORLD.floorY - ball.r;
      ball.vy *= -ball.restitution;
      ball.vx *= 0.82;
      noiseClick(0.06, 0.04);
      if (Math.abs(ball.vy) < 60) {
        // settle and allow pickup if near player
        ball.vy = 0; ball.vx *= 0.92;
        if (Math.hypot(ball.x - (player.x + player.width * 0.6 * player.facing), ball.y - (player.y - 15)) < 30){
          resetBallHeld();
        }
      }
    }

    // Backboard collision (AABB)
    const bb = { x: hoop.x, y: hoop.y - hoop.backboardH/2, w: hoop.backboardW, h: hoop.backboardH };
    const nearestX = clamp(ball.x, bb.x, bb.x + bb.w);
    const nearestY = clamp(ball.y, bb.y, bb.y + bb.h);
    const dx = ball.x - nearestX;
    const dy = ball.y - nearestY;
    const dist2 = dx*dx + dy*dy;
    if (dist2 < ball.r*ball.r){
      const dist = Math.sqrt(dist2) || 0.0001;
      const nx = dx / dist; const ny = dy / dist;
      ball.x = nearestX + nx * (ball.r + 0.1);
      ball.y = nearestY + ny * (ball.r + 0.1);
      const vn = ball.vx * nx + ball.vy * ny;
      ball.vx -= (1.6) * vn * nx;
      ball.vy -= (1.6) * vn * ny;
      noiseClick(0.05, 0.04);
    }

    // Rim collision (two circles)
    const rimCx = hoop.x + hoop.rimOffsetX;
    const rimCy = hoop.y + hoop.rimOffsetY;
    const dxr = ball.x - rimCx;
    const dyr = ball.y - rimCy;
    const dr = Math.hypot(dxr, dyr);
    const minDist = ball.r + hoop.rimR;
    if (dr < minDist){
      const nx = dxr / (dr || 0.0001);
      const ny = dyr / (dr || 0.0001);
      ball.x = rimCx + nx * minDist;
      ball.y = rimCy + ny * minDist;
      const vn = ball.vx * nx + ball.vy * ny;
      ball.vx -= 1.4 * vn * nx;
      ball.vy -= 1.4 * vn * ny;
      noiseClick(0.05, 0.04);
    }

    // Net drag if passing below rim
    if (ball.y > hoop.y + hoop.netY - 6 && Math.abs(ball.x - (hoop.x + hoop.rimOffsetX)) < 22 && ball.vy > 0){
      ball.vy *= 0.96; ball.vx *= 0.985;
    }
  }
}

let lastTime = now();
let justScoredAt = -10;
let passedAbove = false;
function checkScore(){
  const rimX = hoop.x + hoop.rimOffsetX;
  const rimY = hoop.y + hoop.rimOffsetY;
  // Detect ball passing top-to-bottom through a small window
  const above = (ball.y + ball.r) < (rimY - 2);
  if (!above) {
    if (passedAbove && ball.y - ball.r > rimY + 10 && Math.abs(ball.x - rimX) < 16 && now() - justScoredAt > 0.6){
      score += 2; streak += 1; best = Math.max(best, score); localStorage.setItem('best_2d_hoops', String(best));
      updateHUD();
      ping(660, 0.08, 0.14); setTimeout(()=> ping(990, 0.08, 0.12), 60);
      justScoredAt = now();
      overlay.classList.remove('hidden');
      setTimeout(()=> overlay.classList.add('hidden'), 900);
    }
    passedAbove = false;
  } else {
    passedAbove = true;
  }
}

function draw(){
  // Sky
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, '#0b1220');
  grd.addColorStop(1, '#111827');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Court floor
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, WORLD.floorY, canvas.width, canvas.height - WORLD.floorY);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, WORLD.floorY);
  ctx.lineTo(canvas.width, WORLD.floorY);
  ctx.stroke();

  // Hoop
  // Backboard
  ctx.fillStyle = '#93c5fd';
  ctx.fillRect(hoop.x, hoop.y - hoop.backboardH/2, hoop.backboardW, hoop.backboardH);
  // Rim
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(hoop.x + hoop.rimOffsetX, hoop.y + hoop.rimOffsetY, hoop.rimR, 0, Math.PI*2);
  ctx.stroke();
  // Support
  ctx.strokeStyle = 'rgba(147,197,253,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hoop.x + hoop.backboardW, hoop.y);
  ctx.lineTo(hoop.x + hoop.rimOffsetX, hoop.y + hoop.rimOffsetY);
  ctx.stroke();

  // Player
  ctx.fillStyle = '#34d399';
  ctx.fillRect(player.x, player.y, player.width, player.height);
  // Arm holding ball indicator
  if (ball.held || charging){
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const armX = player.x + (player.facing === 1 ? player.width : 0);
    const armY = player.y + 10;
    ctx.moveTo(armX, armY);
    ctx.lineTo(ball.x, ball.y);
    ctx.stroke();
  }

  // Power bar when charging
  if (charging){
    const t = clamp(now() - chargeStart, 0, 1.25);
    const pct = t / 1.25;
    const barW = 120, barH = 10;
    const bx = player.x - 46, by = player.y - 24;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(bx, by, barW, barH);
    const grad = ctx.createLinearGradient(bx, by, bx + barW, by);
    grad.addColorStop(0, '#22c55e'); grad.addColorStop(1, '#ef4444');
    ctx.fillStyle = grad;
    ctx.fillRect(bx, by, barW * pct, barH);
  }

  // Ball
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r*0.6, 0, Math.PI*2);
  ctx.stroke();

  // Shadows
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  const shadowY = WORLD.floorY + 2;
  const sx = clamp(ball.x, 8, canvas.width-8);
  const sr = ball.held ? ball.r*0.7 : ball.r*0.9;
  ctx.beginPath();
  ctx.ellipse(sx, shadowY, sr, 4, 0, 0, Math.PI*2);
  ctx.fill();
}

function loop(){
  const t = now();
  let dt = t - lastTime; if (dt > 0.05) dt = 0.05; lastTime = t;
  handleInput(dt);
  integrate(dt);
  if (!ball.held) checkScore();
  draw();
  requestAnimationFrame(loop);
}

// Start
updateHUD();
reset();
requestAnimationFrame(loop);