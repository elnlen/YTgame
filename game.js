// game.js
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
  }
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.enabled = true;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
  playTone(freq, type, duration, vol = 0.1) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
  playPaddleHit() { this.playTone(300, 'sine', 0.1, 0.2); }
  playWallHit() { this.playTone(200, 'square', 0.1, 0.05); }
  playBrickHit(combo) {
    const baseFreq = 400;
    const freq = baseFreq + Math.min(combo * 50, 800);
    this.playTone(freq, 'square', 0.1, 0.1);
  }
  playGameOver() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 1);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 1);
  }
  playClear() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.setValueAtTime(500, this.ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(600, this.ctx.currentTime + 0.2);
    osc.frequency.setValueAtTime(800, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.5);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.5);
  }
}

class GameEngine {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;
    this.animationId = 0;
    this.width = 800;
    this.height = 600;
    this.state = 'START';
    this.score = 0;
    this.combo = 0;
    this.shake = 0;
    this.audio = new AudioEngine();
    this.paddle = { x: 340, y: 560, w: 120, h: 16 };
    this.baseSpeed = 8;
    this.ball = { x: 400, y: 530, r: 8, dx: 0, dy: 0, speed: 8 };
    this.bricks = [];
    this.particles = [];
    this.trails = [];
    this.COLORS = [
      '#ef4444', '#f97316', '#eab308', '#22c55e',
      '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef',
    ];
    this.touchHandler = this.handleTouch.bind(this);
    this.mouseHandler = this.handleMouse.bind(this);
    
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.initBricks();
    this.setupInput();
  }

  initBricks() {
    this.bricks = [];
    const rows = 8;
    const cols = 10;
    const padding = 10;
    const offsetTop = 60;
    const offsetLeft = 35;
    const w = (this.width - offsetLeft * 2 - padding * (cols - 1)) / cols;
    const h = 24;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.bricks.push({
          x: offsetLeft + c * (w + padding),
          y: offsetTop + r * (h + padding),
          w,
          h,
          active: true,
          color: this.COLORS[r % this.COLORS.length],
          value: (rows - r) * 10,
        });
      }
    }
  }

  setupInput() {
    this.canvas.addEventListener('touchmove', this.touchHandler, { passive: false });
    this.canvas.addEventListener('mousemove', this.mouseHandler);
  }

  handleTouch(e) {
    if (this.state !== 'PLAYING') return;
    e.preventDefault();
    this.movePaddle(e.touches[0].clientX);
  }

  handleMouse(e) {
    if (this.state !== 'PLAYING') return;
    this.movePaddle(e.clientX);
  }

  movePaddle(clientX) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    this.paddle.x = (clientX - rect.left) * scaleX - this.paddle.w / 2;

    if (this.paddle.x < 0) this.paddle.x = 0;
    if (this.paddle.x + this.paddle.w > this.width) {
      this.paddle.x = this.width - this.paddle.w;
    }
  }

  startGame() {
    this.audio.init();
    this.state = 'PLAYING';
    this.score = 0;
    this.combo = 0;
    this.ball.speed = this.baseSpeed;
    this.ball.x = 400;
    this.ball.y = 530;
    
    const angle = (Math.random() * (Math.PI / 2)) - (Math.PI / 4);
    this.ball.dx = this.ball.speed * Math.sin(angle);
    this.ball.dy = -this.ball.speed * Math.cos(angle);
    
    this.paddle.x = (this.width - this.paddle.w) / 2;
    this.particles = [];
    this.trails = [];
    this.initBricks();
    
    this.callbacks.onScore(this.score);
    this.callbacks.onCombo(this.combo);
    this.callbacks.onState(this.state);
    
    if (!this.animationId) {
      this.loop();
    }
  }

  setState(newState) {
    this.state = newState;
    this.callbacks.onState(newState);
  }

  triggerShake(intensity) {
    this.shake = intensity;
  }

  addScore(points) {
    const multiplier = 1 + Math.floor(this.combo / 5) * 0.5;
    this.score += Math.floor(points * multiplier);
    this.callbacks.onScore(this.score);
  }

  createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      this.particles.push({
        x, y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        life: 1.0,
        maxLife: Math.random() * 0.5 + 0.5,
        color,
        size: Math.random() * 4 + 2,
      });
    }
  }

  checkCollision(rect) {
    const closestX = Math.max(rect.x, Math.min(this.ball.x, rect.x + (rect.w || this.paddle.w)));
    const closestY = Math.max(rect.y, Math.min(this.ball.y, rect.y + (rect.h || this.paddle.h)));
    const distanceX = this.ball.x - closestX;
    const distanceY = this.ball.y - closestY;
    return (distanceX * distanceX + distanceY * distanceY) < (this.ball.r * this.ball.r);
  }

  update() {
    if (this.state !== 'PLAYING') return;

    if (this.shake > 0) {
      this.shake *= 0.9;
      if (this.shake < 0.1) this.shake = 0;
    }

    const isBerserk = this.combo >= 10;
    const ballColor = isBerserk ? '#ff3300' : '#ffffff';

    this.trails.push({ x: this.ball.x, y: this.ball.y, life: 1.0, color: ballColor });
    if (this.trails.length > (isBerserk ? 15 : 8)) {
      this.trails.shift();
    }

    this.ball.x += this.ball.dx;
    this.ball.y += this.ball.dy;

    if (this.ball.x - this.ball.r < 0) {
      this.ball.x = this.ball.r;
      this.ball.dx *= -1;
      this.audio.playWallHit();
      if (isBerserk) this.triggerShake(2);
    } else if (this.ball.x + this.ball.r > this.width) {
      this.ball.x = this.width - this.ball.r;
      this.ball.dx *= -1;
      this.audio.playWallHit();
      if (isBerserk) this.triggerShake(2);
    }

    if (this.ball.y - this.ball.r < 0) {
      this.ball.y = this.ball.r;
      this.ball.dy *= -1;
      this.audio.playWallHit();
      if (isBerserk) this.triggerShake(2);
    } else if (this.ball.y + this.ball.r > this.height) {
      this.setState('GAMEOVER');
      this.audio.playGameOver();
      this.triggerShake(15);
      return;
    }

    if (this.ball.dy > 0 && this.checkCollision(this.paddle)) {
      this.audio.playPaddleHit();
      if (this.combo > 0) {
        this.combo = 0;
        this.callbacks.onCombo(this.combo);
        this.ball.speed = this.baseSpeed;
      }

      this.triggerShake(3);
      this.createParticles(this.ball.x, this.ball.y + this.ball.r, '#ffffff', 5);

      const hitPoint = this.ball.x - (this.paddle.x + this.paddle.w / 2);
      const normalizedHit = hitPoint / (this.paddle.w / 2);
      const maxAngle = Math.PI / 3;
      const angle = normalizedHit * maxAngle;

      this.ball.dx = this.ball.speed * Math.sin(angle);
      this.ball.dy = -this.ball.speed * Math.cos(angle);
      this.ball.y = this.paddle.y - this.ball.r;
    }

    let activeBricks = 0;
    let hitBrick = false;

    for (const brick of this.bricks) {
      if (!brick.active) continue;
      activeBricks++;

      if (!hitBrick && this.checkCollision(brick)) {
        brick.active = false;
        hitBrick = true;
        
        this.combo++;
        this.audio.playBrickHit(this.combo);
        this.callbacks.onCombo(this.combo);
        this.addScore(brick.value);
        this.createParticles(brick.x + brick.w/2, brick.y + brick.h/2, brick.color, isBerserk ? 20 : 12);
        this.triggerShake(isBerserk ? 8 : 4);

        if (this.combo % 5 === 0 && this.ball.speed < 14) {
          this.ball.speed += 0.5;
        }

        const closestX = Math.max(brick.x, Math.min(this.ball.x, brick.x + brick.w));
        const closestY = Math.max(brick.y, Math.min(this.ball.y, brick.y + brick.h));
        
        if (Math.abs(this.ball.x - closestX) > Math.abs(this.ball.y - closestY)) {
          this.ball.dx *= -1;
        } else {
          this.ball.dy *= -1;
        }

        const currentSpeed = Math.sqrt(this.ball.dx**2 + this.ball.dy**2);
        this.ball.dx = (this.ball.dx / currentSpeed) * this.ball.speed;
        this.ball.dy = (this.ball.dy / currentSpeed) * this.ball.speed;
      }
    }

    if (activeBricks === 0 && this.bricks.length > 0) {
      this.setState('CLEAR');
      this.audio.playClear();
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.dx;
      p.y += p.dy;
      p.life -= 0.02 / p.maxLife;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i];
      t.life -= 0.05;
      if (t.life <= 0) {
        this.trails.splice(i, 1);
      }
    }
  }

  draw() {
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.save();
    
    if (this.shake > 0) {
      const dx = (Math.random() - 0.5) * this.shake;
      const dy = (Math.random() - 0.5) * this.shake;
      this.ctx.translate(dx, dy);
    }

    this.ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.trails.length; i++) {
      const t = this.trails[i];
      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, this.ball.r * t.life, 0, Math.PI * 2);
      this.ctx.fillStyle = t.color;
      this.ctx.globalAlpha = t.life * 0.5;
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1.0;
    this.ctx.globalCompositeOperation = 'source-over';

    for (const brick of this.bricks) {
      if (!brick.active) continue;
      this.ctx.fillStyle = brick.color;
      this.ctx.shadowColor = brick.color;
      this.ctx.shadowBlur = 10;
      this.ctx.beginPath();
      this.ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 4);
      this.ctx.fill();
    }
    this.ctx.shadowBlur = 0;

    this.ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.life;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1.0;
    this.ctx.globalCompositeOperation = 'source-over';

    this.ctx.fillStyle = '#e2e8f0';
    this.ctx.shadowColor = '#e2e8f0';
    this.ctx.shadowBlur = 15;
    this.ctx.beginPath();
    this.ctx.roundRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h, 8);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    const isBerserk = this.combo >= 10;
    this.ctx.fillStyle = isBerserk ? '#ff3300' : '#ffffff';
    this.ctx.shadowColor = isBerserk ? '#ff3300' : '#ffffff';
    this.ctx.shadowBlur = isBerserk ? 20 : 10;
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    this.ctx.restore();
  }

  loop() {
    this.update();
    this.draw();
    this.animationId = requestAnimationFrame(this.loop.bind(this));
  }

  destroy() {
    cancelAnimationFrame(this.animationId);
    this.canvas.removeEventListener('touchmove', this.touchHandler);
    this.canvas.removeEventListener('mousemove', this.mouseHandler);
  }
}

// UI State Management
let engine = null;
const scoreDisplay = document.getElementById('score-display');
const comboDisplay = document.getElementById('combo-display');
const berserkIcon = document.getElementById('berserk-icon');
const gameoverScore = document.getElementById('gameover-score');
const clearScore = document.getElementById('clear-score');

const overlayStart = document.getElementById('overlay-start');
const overlayGameover = document.getElementById('overlay-gameover');
const overlayClear = document.getElementById('overlay-clear');

function onScore(score) {
  scoreDisplay.innerText = score.toLocaleString();
}

function onCombo(combo) {
  comboDisplay.innerText = combo + 'x';
  if (combo >= 10) {
    comboDisplay.classList.add('text-red-500', 'animate-pulse');
    comboDisplay.classList.remove('text-slate-200');
    berserkIcon.classList.remove('hidden');
  } else {
    comboDisplay.classList.remove('text-red-500', 'animate-pulse');
    comboDisplay.classList.add('text-slate-200');
    berserkIcon.classList.add('hidden');
  }
}

function onState(state) {
  overlayStart.classList.add('hidden');
  overlayGameover.classList.add('hidden');
  overlayClear.classList.add('hidden');

  if (state === 'START') {
    overlayStart.classList.remove('hidden');
  } else if (state === 'GAMEOVER') {
    overlayGameover.classList.remove('hidden');
    gameoverScore.innerText = `FINAL SCORE: ${engine.score.toLocaleString()}`;
  } else if (state === 'CLEAR') {
    overlayClear.classList.remove('hidden');
    clearScore.innerText = `FINAL SCORE: ${engine.score.toLocaleString()}`;
  }
}

function startGame() {
  if (!engine) {
    const canvas = document.getElementById('gameCanvas');
    engine = new GameEngine(canvas, {
      onScore,
      onState,
      onCombo
    });
  }
  engine.startGame();
}

// Initial state render
onState('START');

// Initial frame draw so the canvas isn't blank
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const tempEngine = new GameEngine(canvas, {onScore:()=>{}, onState:()=>{}, onCombo:()=>{}});
  tempEngine.draw();
});
