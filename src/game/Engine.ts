export type GameState = 'START' | 'PLAYING' | 'GAMEOVER' | 'CLEAR';

import { AudioEngine } from './Audio';

export interface Callbacks {
  onScore: (score: number) => void;
  onState: (state: GameState) => void;
  onCombo: (combo: number) => void;
}

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  active: boolean;
  color: string;
  value: number;
}

interface Particle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Trail {
  x: number;
  y: number;
  life: number;
  color: string;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationId: number = 0;
  private callbacks: Callbacks;

  private width = 800;
  private height = 600;

  private state: GameState = 'START';
  private score = 0;
  private combo = 0;
  private shake = 0;
  private audio = new AudioEngine();

  private paddle = { x: 340, y: 560, w: 120, h: 16 };
  private baseSpeed = 8;
  private ball = { x: 400, y: 530, r: 8, dx: 0, dy: 0, speed: 8 };
  
  private bricks: Brick[] = [];
  private particles: Particle[] = [];
  private trails: Trail[] = [];

  private readonly COLORS = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#d946ef', // fuchsia
  ];

  private touchHandler: (e: TouchEvent) => void;
  private mouseHandler: (e: MouseEvent) => void;

  constructor(canvas: HTMLCanvasElement, callbacks: Callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.callbacks = callbacks;

    // Fixed logical size
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.initBricks();
    
    // Bind handlers for cleanup
    this.touchHandler = this.handleTouch.bind(this);
    this.mouseHandler = this.handleMouse.bind(this);
    this.setupInput();
  }

  private initBricks() {
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

  private setupInput() {
    this.canvas.addEventListener('touchmove', this.touchHandler, { passive: false });
    this.canvas.addEventListener('mousemove', this.mouseHandler);
  }

  private handleTouch(e: TouchEvent) {
    if (this.state !== 'PLAYING') return;
    e.preventDefault(); // Prevent scrolling while playing
    this.movePaddle(e.touches[0].clientX);
  }

  private handleMouse(e: MouseEvent) {
    if (this.state !== 'PLAYING') return;
    this.movePaddle(e.clientX);
  }

  private movePaddle(clientX: number) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    this.paddle.x = (clientX - rect.left) * scaleX - this.paddle.w / 2;

    if (this.paddle.x < 0) this.paddle.x = 0;
    if (this.paddle.x + this.paddle.w > this.width) {
      this.paddle.x = this.width - this.paddle.w;
    }
  }

  public startGame() {
    this.audio.init();
    this.state = 'PLAYING';
    this.score = 0;
    this.combo = 0;
    this.ball.speed = this.baseSpeed;
    this.ball.x = 400;
    this.ball.y = 530;
    
    // Start ball going up at a random angle
    const angle = (Math.random() * (Math.PI / 2)) - (Math.PI / 4); // -45 to +45 deg
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

  private setState(newState: GameState) {
    this.state = newState;
    this.callbacks.onState(newState);
  }

  private triggerShake(intensity: number) {
    this.shake = intensity;
  }

  private addScore(points: number) {
    // Berserker multiplier based on combo
    const multiplier = 1 + Math.floor(this.combo / 5) * 0.5;
    this.score += Math.floor(points * multiplier);
    this.callbacks.onScore(this.score);
  }

  private createParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      this.particles.push({
        x,
        y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        life: 1.0,
        maxLife: Math.random() * 0.5 + 0.5,
        color,
        size: Math.random() * 4 + 2,
      });
    }
  }

  private checkCollision(rect: Brick | typeof this.paddle): boolean {
    const closestX = Math.max(rect.x, Math.min(this.ball.x, rect.x + (rect.w || this.paddle.w)));
    const closestY = Math.max(rect.y, Math.min(this.ball.y, rect.y + (rect.h || this.paddle.h)));
    
    const distanceX = this.ball.x - closestX;
    const distanceY = this.ball.y - closestY;
    
    return (distanceX * distanceX + distanceY * distanceY) < (this.ball.r * this.ball.r);
  }

  private update() {
    if (this.state !== 'PLAYING') return;

    // Update shake
    if (this.shake > 0) {
      this.shake *= 0.9;
      if (this.shake < 0.1) this.shake = 0;
    }

    const isBerserk = this.combo >= 10;
    const ballColor = isBerserk ? '#ff3300' : '#ffffff';

    // Add trail
    this.trails.push({ x: this.ball.x, y: this.ball.y, life: 1.0, color: ballColor });
    if (this.trails.length > (isBerserk ? 15 : 8)) {
      this.trails.shift();
    }

    // Move ball
    this.ball.x += this.ball.dx;
    this.ball.y += this.ball.dy;

    // Wall collisions
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

    // Paddle collision
    if (this.ball.dy > 0 && this.checkCollision(this.paddle)) {
      this.audio.playPaddleHit();
      // Reset combo on paddle hit
      if (this.combo > 0) {
        this.combo = 0;
        this.callbacks.onCombo(this.combo);
        this.ball.speed = this.baseSpeed; // reset speed
      }

      this.triggerShake(3);
      this.createParticles(this.ball.x, this.ball.y + this.ball.r, '#ffffff', 5);

      // Calculate bounce angle based on where it hit the paddle
      const hitPoint = this.ball.x - (this.paddle.x + this.paddle.w / 2);
      const normalizedHit = hitPoint / (this.paddle.w / 2); // -1 to 1
      const maxAngle = Math.PI / 3; // 60 degrees
      const angle = normalizedHit * maxAngle;

      this.ball.dx = this.ball.speed * Math.sin(angle);
      this.ball.dy = -this.ball.speed * Math.cos(angle);
      
      // Ensure it's outside the paddle so it doesn't get stuck
      this.ball.y = this.paddle.y - this.ball.r;
    }

    // Brick collisions
    let activeBricks = 0;
    let hitBrick = false;

    for (const brick of this.bricks) {
      if (!brick.active) continue;
      activeBricks++;

      if (!hitBrick && this.checkCollision(brick)) {
        brick.active = false;
        hitBrick = true;
        
        // Exhilarating feedback
        this.combo++;
        this.audio.playBrickHit(this.combo);
        this.callbacks.onCombo(this.combo);
        this.addScore(brick.value);
        this.createParticles(brick.x + brick.w/2, brick.y + brick.h/2, brick.color, isBerserk ? 20 : 12);
        this.triggerShake(isBerserk ? 8 : 4);

        // Berserker speed up
        if (this.combo % 5 === 0 && this.ball.speed < 14) {
          this.ball.speed += 0.5;
        }

        // Calculate bounce direction
        const closestX = Math.max(brick.x, Math.min(this.ball.x, brick.x + brick.w));
        const closestY = Math.max(brick.y, Math.min(this.ball.y, brick.y + brick.h));
        
        // Penetration logic for extreme berserk? Let's just do normal bounce for stability
        if (Math.abs(this.ball.x - closestX) > Math.abs(this.ball.y - closestY)) {
          this.ball.dx *= -1; // Side hit
        } else {
          this.ball.dy *= -1; // Top/bottom hit
        }

        // Normalize speed
        const currentSpeed = Math.sqrt(this.ball.dx**2 + this.ball.dy**2);
        this.ball.dx = (this.ball.dx / currentSpeed) * this.ball.speed;
        this.ball.dy = (this.ball.dy / currentSpeed) * this.ball.speed;
      }
    }

    if (activeBricks === 0 && this.bricks.length > 0) {
      this.setState('CLEAR');
      this.audio.playClear();
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.dx;
      p.y += p.dy;
      p.life -= 0.02 / p.maxLife;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update trails
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i];
      t.life -= 0.05;
      if (t.life <= 0) {
        this.trails.splice(i, 1);
      }
    }
  }

  private draw() {
    this.ctx.fillStyle = '#0f172a'; // Slate 900 background
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.save();
    
    // Apply screen shake
    if (this.shake > 0) {
      const dx = (Math.random() - 0.5) * this.shake;
      const dy = (Math.random() - 0.5) * this.shake;
      this.ctx.translate(dx, dy);
    }

    // Draw trails
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

    // Draw bricks
    for (const brick of this.bricks) {
      if (!brick.active) continue;
      this.ctx.fillStyle = brick.color;
      this.ctx.shadowColor = brick.color;
      this.ctx.shadowBlur = 10;
      // Slight rounding
      this.ctx.beginPath();
      this.ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 4);
      this.ctx.fill();
    }
    this.ctx.shadowBlur = 0; // reset shadow

    // Draw particles
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

    // Draw paddle
    this.ctx.fillStyle = '#e2e8f0'; // slate 200
    this.ctx.shadowColor = '#e2e8f0';
    this.ctx.shadowBlur = 15;
    this.ctx.beginPath();
    this.ctx.roundRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h, 8);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    // Draw ball
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

  private loop = () => {
    this.update();
    this.draw();
    this.animationId = requestAnimationFrame(this.loop);
  };

  public destroy() {
    cancelAnimationFrame(this.animationId);
    this.canvas.removeEventListener('touchmove', this.touchHandler);
    this.canvas.removeEventListener('mousemove', this.mouseHandler);
  }
}
