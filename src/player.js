// Ported from goastroids/player.go
import {
  ScreenWidth,
  ScreenHeight,
  WorldWidth,
  Player1StartX,
  Player2StartX,
  ArcherSpriteScale,
  MinPower,
  MaxPower,
  DefaultPower,
  PlayerGravity,
  ArrowGravity,
  ArrowDragCoeff,
  DefaultGroundY,
} from './constants.js';
import { Vector } from './vector.js';
import { assets } from './assets.js';
import { rgba, drawFilledCircle, strokeLine } from './draw-utils.js';

export {
  Player1StartX,
  Player2StartX,
  ArcherSpriteScale,
  MinPower,
  MaxPower,
  DefaultPower,
  PlayerGravity,
};

export const ArcherIdle = 0;
export const ArcherAttack = 1;
export const ArcherHurt = 2;
export const ArcherDie = 3;

// ShootOutFactor is the global variable controlling how much a player gets shot out / launched when hit.
export let ShootOutFactor = 1.0;
export function setShootOutFactor(val) {
  ShootOutFactor = val;
}

function drawStar(ctx, cx, cy, r, c) {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5.0 - Math.PI / 2.0;
    const rad = i % 2 === 1 ? r * 0.42 : r;
    points.push([cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad]);
  }
  for (let i = 0; i < 10; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % 10];
    strokeLine(ctx, p1[0], p1[1], p2[0], p2[1], 2.0, c);
  }
  drawFilledCircle(ctx, cx, cy, r * 0.35, c);
}

export class Player {
  constructor(game, id, posX, posY, facingRight) {
    let defaultAngle = -Math.PI / 4.0; // -45 deg
    let name = 'Archer 1';
    if (!facingRight) {
      defaultAngle = (-Math.PI * 3.0) / 4.0; // -135 deg (aimed to the left)
      name = 'Archer 2';
    }

    this.game = game;
    this.ID = id;
    this.position = new Vector(posX, posY);
    this.FacingRight = facingRight;
    this.state = ArcherIdle;
    this.currentFrame = 0;
    this.frameTicks = 0;
    this.ticksPerFrame = 7;
    this.AimAngle = defaultAngle;
    this.AimPower = DefaultPower;
    this.Health = 100;
    this.MaxHealth = 100;
    this.invulnerableTicks = 0;
    this.hasShotCurrentAnim = false;
    this.scale = ArcherSpriteScale;
    this.Name = name;

    // Airborne dramatic jump & backflip physics
    this.launchVX = 0;
    this.launchVY = 0;
    this.rotation = 0;
    this.rotVelocity = 0;
    this.isAirborne = false;
    this.starAngle = 0;
    this.ShootOutMultiplier = 1.0;
  }

  TriggerAttack() {
    if (this.state === ArcherDie || this.state === ArcherHurt || this.isAirborne) {
      return;
    }
    if (this.state === ArcherAttack) {
      return;
    }
    this.state = ArcherAttack;
    this.currentFrame = 0;
    this.frameTicks = 0;
    this.ticksPerFrame = 4;
    this.hasShotCurrentAnim = false;
  }

  TakeDamage(amount) {
    if (this.state === ArcherDie) {
      return;
    }
    this.Health -= amount;

    if (this.Health <= 0) {
      this.Health = 0;
      this.state = ArcherDie;
      this.currentFrame = 0;
      this.frameTicks = 0;
      this.ticksPerFrame = 6;
    } else {
      this.state = ArcherHurt;
      this.currentFrame = 0;
      this.frameTicks = 0;
      this.ticksPerFrame = 5;
    }
  }

  ApplyKnockback(shootingPower, shootingAngle, impactVX) {
    if (shootingPower <= 0) {
      shootingPower = DefaultPower;
    }

    // 1. Calculate normalized power ratio (0.0 at MinPower to 1.0 at MaxPower)
    let powerRatio = (shootingPower - MinPower) / (MaxPower - MinPower);
    if (powerRatio < 0) powerRatio = 0;
    if (powerRatio > 1.0) powerRatio = 1.0;

    // 2. Resolve angle components
    const cosA = Math.abs(Math.cos(shootingAngle));
    const sinA = Math.abs(Math.sin(shootingAngle));

    const scale = ShootOutFactor * this.ShootOutMultiplier;

    // 3. Target horizontal displacement distance
    const targetDist =
      (70.0 + powerRatio * 380.0 + (shootingPower / MaxPower) * (cosA * 140.0)) *
      scale;

    // 4. Target jump height
    const targetHeight =
      (110.0 + powerRatio * 180.0 + (shootingPower / MaxPower) * (sinA * 130.0)) *
      scale;

    // 5. Initial vertical launch velocity to reach targetHeight under PlayerGravity
    this.launchVY = -Math.sqrt(2.0 * PlayerGravity * targetHeight);

    // 6. Exact flight air-time and required horizontal launch velocity
    let airTime = (2.0 * Math.abs(this.launchVY)) / PlayerGravity;
    if (airTime <= 0) {
      airTime = 1.0;
    }
    const horizSpeed = targetDist / airTime;

    // 7. Backflip spin rotation speed proportional to shooting power
    const rotSpeed = (7.0 + powerRatio * 6.0) * scale;

    if (impactVX > 0) {
      this.launchVX = horizSpeed;
      this.rotVelocity = rotSpeed;
    } else {
      this.launchVX = -horizSpeed;
      this.rotVelocity = -rotSpeed;
    }

    this.isAirborne = true;
    this.state = ArcherHurt;
    this.currentFrame = 0;
    this.frameTicks = 0;
    this.ticksPerFrame = 5;
  }

  HitboxBounds() {
    const halfW = 52.0;
    return [
      this.position.X - halfW,
      this.position.Y - 145.0,
      this.position.X + halfW,
      this.position.Y + 8.0,
    ];
  }

  AdjustAngle(delta) {
    this.AimAngle += delta;
    if (this.FacingRight) {
      const minA = -80.0 * (Math.PI / 180.0);
      const maxA = -10.0 * (Math.PI / 180.0);
      if (this.AimAngle < minA) this.AimAngle = minA;
      if (this.AimAngle > maxA) this.AimAngle = maxA;
    } else {
      const minA = -170.0 * (Math.PI / 180.0);
      const maxA = -100.0 * (Math.PI / 180.0);
      if (this.AimAngle < minA) this.AimAngle = minA;
      if (this.AimAngle > maxA) this.AimAngle = maxA;
    }
  }

  AdjustPower(delta) {
    this.AimPower += delta;
    if (this.AimPower < MinPower) this.AimPower = MinPower;
    if (this.AimPower > MaxPower) this.AimPower = MaxPower;
  }

  GetAngleDegrees() {
    let deg = (Math.abs(this.AimAngle) * 180.0) / Math.PI;
    if (!this.FacingRight) {
      deg = 180.0 - deg;
    }
    return Math.round(deg);
  }

  BowPosition() {
    const xOffset = this.FacingRight ? 55.0 : -55.0;
    return [this.position.X + xOffset, this.position.Y - 50.0];
  }

  Update() {
    const dt = 1.0 / 60.0;

    if (this.invulnerableTicks > 0) {
      this.invulnerableTicks--;
    }

    // Airborne jump & backflip trajectory physics
    if (this.isAirborne) {
      this.launchVY += PlayerGravity * dt;
      this.position.X += this.launchVX * dt;
      this.position.Y += this.launchVY * dt;
      this.rotation += this.rotVelocity * dt;
      this.starAngle += 8.0 * dt;

      // Clamp X to world boundaries
      if (this.position.X < 80.0) {
        this.position.X = 80.0;
        this.launchVX = 0;
      }
      if (this.position.X > WorldWidth - 80.0) {
        this.position.X = WorldWidth - 80.0;
        this.launchVX = 0;
      }

      // Landing check on ground
      if (this.position.Y >= DefaultGroundY) {
        this.position.Y = DefaultGroundY;
        this.launchVY = 0;
        this.launchVX = 0;
        this.isAirborne = false;
        this.rotation = 0;

        if (this.Health <= 0) {
          this.state = ArcherDie;
          const dieFrames = this.getFrames(ArcherDie);
          this.currentFrame = Math.max(0, dieFrames.length - 1);
        } else {
          this.state = ArcherIdle;
          this.currentFrame = 0;
          this.ticksPerFrame = 7;
        }
      }
    }

    this.frameTicks++;
    if (this.frameTicks >= this.ticksPerFrame) {
      this.frameTicks = 0;
      this.currentFrame++;

      const frames = this.getFrames(this.state);
      const frameCount = frames.length > 0 ? frames.length : 10;

      switch (this.state) {
        case ArcherIdle:
          if (this.currentFrame >= frameCount) {
            this.currentFrame = 0;
          }
          break;

        case ArcherAttack:
          // Spawn arrow at bow release frame (frame 6)
          if (this.currentFrame === 6 && !this.hasShotCurrentAnim) {
            this.shootArrow();
            this.hasShotCurrentAnim = true;
          }
          if (this.currentFrame >= frameCount) {
            this.state = ArcherIdle;
            this.currentFrame = 0;
            this.ticksPerFrame = 7;
            this.hasShotCurrentAnim = false;
          }
          break;

        case ArcherHurt:
          if (this.currentFrame >= frameCount) {
            if (!this.isAirborne) {
              this.state = ArcherIdle;
              this.currentFrame = 0;
              this.ticksPerFrame = 7;
            } else {
              this.currentFrame = frameCount - 1;
            }
          }
          break;

        case ArcherDie:
          if (this.currentFrame >= frameCount) {
            this.currentFrame = frameCount - 1;
          }
          break;
      }
    }
  }

  shootArrow() {
    if (!this.game) return;
    const [bowX, bowY] = this.BowPosition();
    this.game.SpawnArrow(bowX, bowY, this.AimPower, this.AimAngle, this.ID);
  }

  getFrames(state, useTintedHurt = false) {
    if (this.ID === 1) {
      switch (state) {
        case ArcherIdle:
          return assets.ArcherIdle;
        case ArcherAttack:
          return assets.ArcherAttack;
        case ArcherHurt:
          return useTintedHurt && assets.ArcherHurtTinted.length > 0
            ? assets.ArcherHurtTinted
            : assets.ArcherHurt;
        case ArcherDie:
          return assets.ArcherDie;
      }
    } else {
      switch (state) {
        case ArcherIdle:
          return assets.Archer2Idle;
        case ArcherAttack:
          return assets.Archer2Attack;
        case ArcherHurt:
          return useTintedHurt && assets.Archer2HurtTinted.length > 0
            ? assets.Archer2HurtTinted
            : assets.Archer2Hurt;
        case ArcherDie:
          return assets.Archer2Die;
      }
    }
    return [];
  }

  Draw(ctx, camX, camY) {
    const drawX = this.position.X - camX;
    const drawY = this.position.Y - camY;

    if (
      drawX < -180 ||
      drawX > ScreenWidth + 180 ||
      drawY < -500 ||
      drawY > ScreenHeight + 180
    ) {
      return;
    }

    const frames = this.getFrames(this.state, this.state === ArcherHurt);
    if (!frames || frames.length === 0) {
      return;
    }
    let idx = this.currentFrame;
    if (idx >= frames.length) {
      idx = frames.length - 1;
    }
    const sprite = frames[idx];
    if (!sprite) {
      return;
    }

    // Shadow on ground (shrinks when player jumps high)
    if (this.state !== ArcherDie) {
      const heightAboveGround = DefaultGroundY - this.position.Y;
      let shadowScale = 1.0 - heightAboveGround / 300.0;
      if (shadowScale < 0.25) {
        shadowScale = 0.25;
      }
      const groundDrawY = DefaultGroundY - camY;
      drawFilledCircle(
        ctx,
        drawX,
        groundDrawY + 2,
        34.0 * shadowScale,
        rgba(0, 0, 0, Math.round(75.0 * shadowScale))
      );
    }

    ctx.save();
    ctx.translate(drawX, drawY);
    if (this.rotation !== 0) {
      ctx.translate(0, -65);
      ctx.rotate(this.rotation);
      ctx.translate(0, 65);
    }
    if (this.FacingRight) {
      ctx.scale(this.scale, this.scale);
    } else {
      ctx.scale(-this.scale, this.scale);
    }
    ctx.translate(-1000, -825);
    ctx.drawImage(sprite, 0, 0);
    ctx.restore();

    // Draw golden dizzy stars orbiting the tumbling/airborne archer (Bowmasters style)
    if (this.isAirborne || this.state === ArcherHurt) {
      this.drawDizzyStars(ctx, drawX, drawY - 65);
    }

    // Draw Aim Guide Trajectory when active and aiming (unless canceled on touch controller)
    if (
      this.game &&
      this.game.ActivePlayer() === this &&
      this.state === ArcherIdle &&
      !this.isAirborne &&
      (!this.game.IsAimCanceled || !this.game.IsAimCanceled())
    ) {
      this.drawAimGuide(ctx, camX, camY);
    }
  }

  drawDizzyStars(ctx, cx, cy) {
    const numStars = 5;
    const orbitRadius = 48.0;
    const starColor = rgba(255, 220, 40, 255);

    for (let i = 0; i < numStars; i++) {
      const angle = this.starAngle + i * ((2.0 * Math.PI) / numStars);
      const sx = cx + Math.cos(angle) * orbitRadius;
      const sy = cy + Math.sin(angle) * (orbitRadius * 0.5);
      drawStar(ctx, sx, sy, 7.5, starColor);
    }
  }

  drawAimGuide(ctx, camX, camY) {
    let [simX, simY] = this.BowPosition();
    let simVX = this.AimPower * Math.cos(this.AimAngle);
    let simVY = this.AimPower * Math.sin(this.AimAngle);
    const dt = 1.0 / 60.0;

    const baseColor =
      this.ID === 2 ? { R: 70, G: 190, B: 255 } : { R: 255, G: 215, B: 50 };

    for (let step = 0; step < 26; step++) {
      const speed = Math.hypot(simVX, simVY);
      const ax = -ArrowDragCoeff * speed * simVX;
      const ay = ArrowGravity - ArrowDragCoeff * speed * simVY;
      simVX += ax * dt;
      simVY += ay * dt;
      simX += simVX * dt;
      simY += simVY * dt;

      if (step % 2 === 0) {
        const sx = simX - camX;
        const sy = simY - camY;
        const alpha = 230 - step * 7;
        drawFilledCircle(
          ctx,
          sx,
          sy,
          3.5 - step * 0.08,
          rgba(baseColor.R, baseColor.G, baseColor.B, alpha)
        );
      }
    }
  }

  CenterPosition() {
    return [this.position.X, this.position.Y - 65];
  }

  HitboxRadius() {
    return 48.0;
  }

  IsDead() {
    return this.state === ArcherDie || this.Health <= 0;
  }

  IsAirborne() {
    return this.isAirborne;
  }
}

export function NewPlayer(game, id, posX, posY, facingRight) {
  return new Player(game, id, posX, posY, facingRight);
}

