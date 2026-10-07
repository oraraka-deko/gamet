// Ported from goastroids/explosion.go
import { ScreenWidth } from './constants.js';
import { assets } from './assets.js';

export class Explosion {
  constructor(x, y) {
    this.X = x;
    this.Y = y;
    this.ticks = 0;
    this.max = 18;
    this.Active = true;
  }

  Update() {
    if (!this.Active) {
      return;
    }
    this.ticks++;
    if (this.ticks >= this.max) {
      this.Active = false;
    }
  }

  Draw(ctx, camX, camY) {
    if (!this.Active || !assets.ExplosionSprite) {
      return;
    }

    const drawX = this.X - camX;
    const drawY = this.Y - camY;
    if (drawX < -80 || drawX > ScreenWidth + 80) {
      return;
    }

    const progress = this.ticks / this.max;
    const alpha = 1.0 - progress;
    const scale = 0.4 + progress * 0.5;

    const halfW = assets.ExplosionSprite.width / 2.0;
    const halfH = assets.ExplosionSprite.height / 2.0;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(drawX, drawY);
    ctx.scale(scale, scale);
    ctx.translate(-halfW, -halfH);
    ctx.drawImage(assets.ExplosionSprite, 0, 0);
    ctx.restore();
  }
}

export function NewExplosion(x, y) {
  return new Explosion(x, y);
}

