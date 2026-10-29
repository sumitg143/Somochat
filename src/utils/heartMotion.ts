import confetti from 'canvas-confetti';
import { sound } from './soundEffects';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotSpeed: number;
  alpha: number;
  color: string;
  emoji: string;
  wobble: number;
  wobbleSpeed: number;
}

class HeartMotionEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private particles: Particle[] = [];
  private animId: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initCanvas();
    }
  }

  private initCanvas() {
    if (this.canvas) return;
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'fixed';
    this.canvas.style.inset = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '999999';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /**
   * Triggers an animated heart burst with fountain motion, floating sparkles, and chime
   * @param originX screen X coordinate of source message
   * @param originY screen Y coordinate of source message
   */
  triggerHeartMotion(originX?: number, originY?: number) {
    this.initCanvas();
    sound.playHeartReact();

    const startX = originX !== undefined ? originX : window.innerWidth / 2;
    const startY = originY !== undefined ? originY : window.innerHeight / 2;

    // 1. Canvas particle fountain
    const heartEmojis = ['❤️', '💖', '💕', '💗', '💓', '✨', '🔥'];
    const colors = ['#ff2a6d', '#ff5e7e', '#ff99c8', '#ff3366', '#ff0055'];

    for (let i = 0; i < 28; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const speed = 6 + Math.random() * 14;
      this.particles.push({
        x: startX + (Math.random() - 0.5) * 40,
        y: startY + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 20 + Math.random() * 26,
        rotation: (Math.random() - 0.5) * 0.8,
        rotSpeed: (Math.random() - 0.5) * 0.1,
        alpha: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        emoji: heartEmojis[Math.floor(Math.random() * heartEmojis.length)],
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.08 + Math.random() * 0.12,
      });
    }

    if (!this.animId) {
      this.loop();
    }

    // 2. Confetti sparkle spray
    try {
      const xNorm = Math.max(0.1, Math.min(0.9, startX / window.innerWidth));
      const yNorm = Math.max(0.1, Math.min(0.9, startY / window.innerHeight));

      confetti({
        particleCount: 25,
        spread: 60,
        origin: { x: xNorm, y: yNorm },
        colors: ['#ff1493', '#ff69b4', '#ff85a2', '#ff477e', '#ffffff'],
        shapes: ['circle'],
        scalar: 0.85,
        ticks: 90,
      });
    } catch {
      // ignore
    }
  }

  /**
   * Generic emoji burst motion (for laughing, fire, party, etc.)
   */
  triggerEmojiMotion(emoji: string, originX?: number, originY?: number) {
    this.initCanvas();
    sound.playEmojiReact();

    const startX = originX !== undefined ? originX : window.innerWidth / 2;
    const startY = originY !== undefined ? originY : window.innerHeight / 2;

    for (let i = 0; i < 20; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 5 + Math.random() * 12;
      this.particles.push({
        x: startX + (Math.random() - 0.5) * 30,
        y: startY + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 22 + Math.random() * 22,
        rotation: (Math.random() - 0.5) * 1,
        rotSpeed: (Math.random() - 0.5) * 0.15,
        alpha: 1,
        color: '#ffffff',
        emoji: emoji,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.07 + Math.random() * 0.1,
      });
    }

    if (!this.animId) {
      this.loop();
    }
  }

  private loop = () => {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      p.wobble += p.wobbleSpeed;
      p.x += p.vx + Math.sin(p.wobble) * 1.5;
      p.y += p.vy;
      p.vy += 0.28; // gravity
      p.vx *= 0.98; // air drag
      p.rotation += p.rotSpeed;
      p.alpha -= 0.016; // gradual fade

      if (p.alpha <= 0 || p.y > this.canvas.height + 60) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation);

      // Draw emoji with glow
      this.ctx.font = `${Math.floor(p.size)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.shadowColor = 'rgba(255, 60, 120, 0.6)';
      this.ctx.shadowBlur = 10;
      this.ctx.fillText(p.emoji, 0, 0);

      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      this.animId = requestAnimationFrame(this.loop);
    } else {
      this.animId = null;
    }
  };
}

export const heartMotion = new HeartMotionEngine();
