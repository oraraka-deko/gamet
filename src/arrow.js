// Ported from goastroids/arrow.go
import {
  ScreenWidth,
  ScreenHeight,
  WorldWidth,
  ArrowGravity,
  ArrowDragCoeff,
  DefaultGroundY,
} from './constants.js';
import { assets } from './assets.js';
import { rgba, strokeLine, drawText } from './draw-utils.js';

export { ArrowGravity, ArrowDragCoeff, DefaultGroundY };

export const ArrowFlying = 0;
export const ArrowStuck = 1;
export const ArrowHit = 2;

/**
 * Liang-Barsky parametric line-segment vs AABB intersection test
 */
export function segmentIntersectsAABB(x1, y1, x2, y2, minX, minY, maxX, maxY) {
  if (
    (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) ||
    (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY)
  ) {
    return true;
  }

  const dx = x2 - x1;
  const dy = y2 - y1;

  const p = [-dx, dx, -dy, dy];
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];

  let u1 = 0.0;
  let u2 = 1.0;

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) {
        return false;
      }
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > u1) {
          u1 = t;
        }
      } else {
        if (t < u2) {
          u2 = t;
        }
      }
      if (u1 > u2) {
        return false;
      }
    }
  }
  return true;
}

export class Arrow {
  constructor(startX, startY, speed, angleRad, shooter) {
    this.X = startX;
    this.Y = startY;
    this.PrevX = startX;
    this.PrevY = startY;
    this.VX = speed * Math.cos(angleRad);
    this.VY = speed * Math.sin(angleRad);
    this.Angle = angleRad;
    this.Length = 34.0;
    this.State = ArrowFlying;
    this.Active = true;
    this.Trail = [];
    this.Shooter = shooter; // 1 for Player 1, 2 for Player 2
    this.ShootingPower = speed;
    this.ShootingAngle = angleRad;
  }

  /**
   * Performs semi-implicit Euler integration with aerodynamic drag and weather-vaning pitch alignment.
   */
  Update(dt, groundY) {
    if (this.State !== ArrowFlying) {
      return;
    }

    this.PrevX = this.X;
    this.PrevY = this.Y;

    // 1. Current speed
    const speed = Math.hypot(this.VX, this.VY);

    // 2. Aerodynamic drag opposing velocity direction
    const ax = -ArrowDragCoeff * speed * this.VX;
    const ay = ArrowGravity - ArrowDragCoeff * speed * this.VY;

    // 3. Semi-implicit Euler integration
    this.VX += ax * dt;
    this.VY += ay * dt;
    this.X += this.VX * dt;
    this.Y += this.VY * dt;

    // 4. Aerodynamic alignment (weather-vaning) with torque smoothing
    const targetAngle = Math.atan2(this.VY, this.VX);
    let diff = targetAngle - this.Angle;
    while (diff > Math.PI) {
      diff -= 2 * Math.PI;
    }
    while (diff < -Math.PI) {
      diff += 2 * Math.PI;
    }
    this.Angle += diff * 0.22;

    // 5. Append trajectory trail
    if (!this.Trail) {
      this.Trail = [];
    }
    this.Trail.push([this.X, this.Y]);
    if (this.Trail.length > 75) {
      this.Trail.shift();
    }

    // 6. Ground penetration check: tip embeds into the earth even if outside normal screen borders
    const halfLen = this.Length / 2.0;
    const tipY = this.Y + Math.sin(this.Angle) * halfLen;
    const tipX = this.X + Math.cos(this.Angle) * halfLen;

    if (tipY >= groundY) {
      // Embed arrow tip into terrain and freeze motion
      this.Y = groundY - Math.sin(this.Angle) * halfLen;
      this.X = tipX - Math.cos(this.Angle) * halfLen;
      this.VX = 0;
      this.VY = 0;
      this.State = ArrowStuck;
      this.Trail = null; // Reset trajectory line when flight completes
    }

    // Broad bounds check: allows arrows to travel far outside the scene without being abruptly killed
    if (this.X < -3000 || this.X > WorldWidth + 3000 || this.Y > groundY + 500) {
      this.Active = false;
    }
  }

  TipPosition() {
    const halfLen = this.Length / 2.0;
    return [
      this.X + Math.cos(this.Angle) * halfLen,
      this.Y + Math.sin(this.Angle) * halfLen,
    ];
  }

  PrevTipPosition() {
    const halfLen = this.Length / 2.0;
    return [
      this.PrevX + Math.cos(this.Angle) * halfLen,
      this.PrevY + Math.sin(this.Angle) * halfLen,
    ];
  }

  TailPosition() {
    const halfLen = this.Length / 2.0;
    return [
      this.X - Math.cos(this.Angle) * halfLen,
      this.Y - Math.sin(this.Angle) * halfLen,
    ];
  }

  /**
   * Uses Continuous Collision Detection (CCD) to test whether the arrow's flight path
   * or body intersects the player's full bounding area.
   */
  CollidesWithPlayer(p) {
    if (this.State !== ArrowFlying || !p) {
      return false;
    }

    const [minX, minY, maxX, maxY] = p.HitboxBounds();

    // 1. Check if current tip is inside player box
    const [tipX, tipY] = this.TipPosition();
    if (tipX >= minX && tipX <= maxX && tipY >= minY && tipY <= maxY) {
      return true;
    }

    // 2. Check if current tail is inside player box (body penetration)
    const [tailX, tailY] = this.TailPosition();
    if (tailX >= minX && tailX <= maxX && tailY >= minY && tailY <= maxY) {
      return true;
    }

    // 3. Continuous Collision Detection (CCD): Check segment between previous tip and current tip
    const [prevTipX, prevTipY] = this.PrevTipPosition();
    if (segmentIntersectsAABB(prevTipX, prevTipY, tipX, tipY, minX, minY, maxX, maxY)) {
      return true;
    }

    // 4. Check arrow shaft segment (tail to tip)
    return segmentIntersectsAABB(tailX, tailY, tipX, tipY, minX, minY, maxX, maxY);
  }

  Draw(ctx, camX, camY) {
    // 1. Draw trajectory arc ONLY while arrow is actively flying; resets completely after each shoot
    if (this.State === ArrowFlying && this.Trail) {
      const trailLen = this.Trail.length;
      for (let i = 1; i < trailLen; i++) {
        const p1 = this.Trail[i - 1];
        const p2 = this.Trail[i];
        const alpha = Math.round((i / trailLen) * 150.0);
        const trailColor =
          this.Shooter === 2
            ? rgba(80, 195, 255, alpha)
            : rgba(245, 190, 70, alpha);
        strokeLine(
          ctx,
          p1[0] - camX,
          p1[1] - camY,
          p2[0] - camX,
          p2[1] - camY,
          2.0,
          trailColor
        );
      }
    }

    const drawX = this.X - camX;
    const drawY = this.Y - camY;

    // If the arrow is soaring high above the visible screen, draw an off-screen sky indicator
    if (
      this.State === ArrowFlying &&
      drawY < 75 &&
      drawX >= 20 &&
      drawX <= ScreenWidth - 20
    ) {
      this.drawSkyIndicator(ctx, drawX, drawY);
    }

    // Draw Arrow Sprite if in screen bounds (with margin)
    if (
      drawX < -80 ||
      drawX > ScreenWidth + 80 ||
      drawY < -80 ||
      drawY > ScreenHeight + 80
    ) {
      return;
    }

    if (assets.ArrowSprite) {
      const scale = 0.22;
      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.scale(scale, scale);
      ctx.rotate(this.Angle + Math.PI / 4);
      ctx.translate(-128, -128);
      ctx.drawImage(assets.ArrowSprite, 0, 0);
      ctx.restore();
    }
  }

  drawSkyIndicator(ctx, sx, drawY) {
    const sy = 88;
    const indicatorColor =
      this.Shooter === 2 ? rgba(70, 200, 255, 240) : rgba(255, 215, 60, 240);

    // Chevron indicator pointing in vertical direction of flight
    if (this.VY < 0) {
      // Ascending (pointing up)
      strokeLine(ctx, sx - 7, sy + 6, sx, sy, 2.5, indicatorColor);
      strokeLine(ctx, sx + 7, sy + 6, sx, sy, 2.5, indicatorColor);
    } else {
      // Descending (pointing down)
      strokeLine(ctx, sx - 7, sy - 6, sx, sy, 2.5, indicatorColor);
      strokeLine(ctx, sx + 7, sy - 6, sx, sy, 2.5, indicatorColor);
    }

    // Height altitude readout
    const alt = Math.floor(Math.abs(drawY));
    const altText = `${alt}m`;
    drawText(ctx, altText, sx, sy + 8, 11, indicatorColor, 'center');
  }
}

export function NewArrow(startX, startY, speed, angleRad, shooter) {
  return new Arrow(startX, startY, speed, angleRad, shooter);
}

