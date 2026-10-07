// Ported from goastroids/game-scene.go with on-demand Android Touch Joystick Controller
import {
  ScreenWidth,
  ScreenHeight,
  WorldWidth,
  DefaultGroundY,
  Player1StartX,
  Player2StartX,
  MinPower,
  MaxPower,
  Key,
} from './constants.js';
import { input } from './input.js';
import { NewPlayer } from './player.js';
import { NewArrow, ArrowHit, ArrowStuck } from './arrow.js';
import { NewExplosion } from './explosion.js';
import { TouchController } from './touch-controller.js';
import {
  rgba,
  drawFilledRect,
  strokeRect,
  drawFilledCircle,
  strokeLine,
  drawText,
} from './draw-utils.js';

export const PhaseAiming = 0;
export const PhaseShooting = 1;
export const PhaseFlying = 2;
export const PhaseHolding = 3;
export const PhaseTransition = 4;
export const PhaseGameOver = 5;

function generateClouds(count) {
  const clouds = [];
  for (let i = 0; i < count; i++) {
    clouds.push([i * 180, 40 + ((i * 37) % 140), 0.15 + (i % 3) * 0.08]);
  }
  return clouds;
}

export class GameScene {
  constructor() {
    this.phase = PhaseAiming;
    this.activePlayerIndex = 0;
    this.roundNumber = 1;

    this.currentArrow = null;
    this.stuckArrows = [];
    this.explosions = [];

    this.camX = 0;
    this.camY = 0;

    this.holdTicks = 0;

    this.clouds = generateClouds(12);

    // Player 1 on the left (facing right), Player 2 on the right (facing left)
    this.players = [
      NewPlayer(this, 1, Player1StartX, DefaultGroundY, true),
      NewPlayer(this, 2, Player2StartX, DefaultGroundY, false),
    ];

    // On-demand Android touch joystick controller (hidden by default, visible only on touch)
    this.touchController = new TouchController();
  }

  ActivePlayer() {
    return this.players[this.activePlayerIndex];
  }

  OpponentPlayer() {
    return this.players[1 - this.activePlayerIndex];
  }

  IsAimCanceled() {
    return this.touchController && this.touchController.visible && this.touchController.isCanceled;
  }

  SpawnArrow(x, y, speed, angleRad, shooter) {
    this.currentArrow = NewArrow(x, y, speed, angleRad, shooter);
    this.phase = PhaseFlying;
  }

  Update(state) {
    const dt = 1.0 / 60.0;

    // Update clouds drift across the large world
    for (let i = 0; i < this.clouds.length; i++) {
      this.clouds[i][0] += this.clouds[i][2];
      if (this.clouds[i][0] > WorldWidth + 150) {
        this.clouds[i][0] = -150;
      }
    }

    // Update players
    this.players[0].Update();
    this.players[1].Update();

    // Update active explosions
    for (const e of this.explosions) {
      e.Update();
    }
    this.explosions = this.explosions.filter((e) => e.Active);

    switch (this.phase) {
      case PhaseGameOver: {
        this.touchController.Hide();
        if (
          input.IsTouchJustEnded() ||
          input.IsKeyJustPressed(Key.Space) ||
          input.IsKeyJustPressed(Key.Enter)
        ) {
          state.SceneManager.GoToScene(NewGameScene());
        }
        this.updateCamera(
          this.OpponentPlayer().position.X,
          this.OpponentPlayer().position.Y,
          false
        );
        return null;
      }

      case PhaseAiming: {
        const active = this.ActivePlayer();

        // Update on-demand Android touch controller
        this.touchController.Update(active);

        // Keyboard fallback support
        let angleStep = 0.02;
        if (!active.FacingRight) {
          angleStep = -0.02;
        }
        if (input.IsKeyPressed(Key.Up) || input.IsKeyPressed(Key.W)) {
          active.AdjustAngle(-angleStep);
        }
        if (input.IsKeyPressed(Key.Down) || input.IsKeyPressed(Key.S)) {
          active.AdjustAngle(angleStep);
        }
        if (input.IsKeyPressed(Key.Right) || input.IsKeyPressed(Key.D)) {
          active.AdjustPower(8.0);
        }
        if (input.IsKeyPressed(Key.Left) || input.IsKeyPressed(Key.A)) {
          active.AdjustPower(-8.0);
        }

        // Fire Action Trigger (on touch controller release or keyboard Space/Enter)
        if (
          this.touchController.shouldFire ||
          input.IsKeyJustPressed(Key.Space) ||
          input.IsKeyJustPressed(Key.Enter)
        ) {
          this.touchController.Hide();
          this.phase = PhaseShooting;
          active.TriggerAttack();
        }

        this.updateCamera(active.position.X, active.position.Y, false);
        break;
      }

      case PhaseShooting: {
        this.touchController.Hide();
        // Waiting for the attack animation to reach frame 6 and spawn the arrow
        this.updateCamera(
          this.ActivePlayer().position.X,
          this.ActivePlayer().position.Y,
          false
        );
        break;
      }

      case PhaseFlying: {
        this.touchController.Hide();
        if (this.currentArrow) {
          this.currentArrow.Update(dt, DefaultGroundY);

          // Check collision with opponent archer using full-body Continuous Collision Detection (CCD)
          const targetPlayer = this.players[2 - this.currentArrow.Shooter];
          if (this.currentArrow.CollidesWithPlayer(targetPlayer)) {
            this.currentArrow.State = ArrowHit;
            this.currentArrow.Trail = null;
            const damage = 35 + this.roundNumber * 5;
            targetPlayer.TakeDamage(damage);
            targetPlayer.ApplyKnockback(
              this.currentArrow.ShootingPower,
              this.currentArrow.ShootingAngle,
              this.currentArrow.VX
            );
            this.explosions.push(
              NewExplosion(this.currentArrow.X, this.currentArrow.Y)
            );

            if (targetPlayer.IsDead()) {
              this.phase = PhaseGameOver;
              return null;
            }
            this.phase = PhaseHolding;
            this.holdTicks = 85;
            return null;
          }

          // Check if arrow landed in the ground
          if (this.currentArrow.State === ArrowStuck) {
            this.currentArrow.Trail = null;
            this.stuckArrows.push(this.currentArrow);
            this.phase = PhaseHolding;
            this.holdTicks = 55;
            return null;
          }

          // Check if arrow became inactive
          if (!this.currentArrow.Active) {
            this.phase = PhaseHolding;
            this.holdTicks = 35;
            return null;
          }

          // Camera tracks the flying arrow horizontally and vertically across and outside the scene!
          this.updateCamera(this.currentArrow.X, this.currentArrow.Y, true);
        }
        break;
      }

      case PhaseHolding: {
        this.touchController.Hide();
        this.holdTicks--;
        const opponent = this.OpponentPlayer();
        if (opponent.IsAirborne()) {
          this.updateCamera(opponent.position.X, opponent.position.Y, true);
        } else if (this.currentArrow) {
          this.updateCamera(this.currentArrow.X, this.currentArrow.Y, true);
        }

        if (this.holdTicks <= 0 && !opponent.IsAirborne()) {
          this.activePlayerIndex = 1 - this.activePlayerIndex;
          this.phase = PhaseTransition;
          if (this.currentArrow) {
            this.currentArrow.Trail = null;
          }
          this.currentArrow = nilOrNull();
          if (this.activePlayerIndex === 0) {
            this.roundNumber++;
          }
        }
        break;
      }

      case PhaseTransition: {
        this.touchController.Hide();
        const targetX = this.ActivePlayer().position.X;
        let targetCamX = targetX - ScreenWidth / 2.0;
        if (targetCamX < 0) {
          targetCamX = 0;
        }
        if (targetCamX > WorldWidth - ScreenWidth) {
          targetCamX = WorldWidth - ScreenWidth;
        }

        this.camX += (targetCamX - this.camX) * 0.07;
        this.camY += (0.0 - this.camY) * 0.08;

        if (Math.abs(this.camX - targetCamX) < 14 && Math.abs(this.camY) < 10) {
          this.camX = targetCamX;
          this.camY = 0;
          this.phase = PhaseAiming;
        }
        break;
      }
    }

    return null;
  }

  updateCamera(focusX, focusY, allowOutside) {
    let targetCamX = focusX - ScreenWidth / 2.0;
    let minCamX = 0.0;
    let maxCamX = WorldWidth - ScreenWidth;
    if (allowOutside) {
      minCamX = -600.0;
      maxCamX = WorldWidth - ScreenWidth + 600.0;
    }
    if (targetCamX < minCamX) {
      targetCamX = minCamX;
    }
    if (targetCamX > maxCamX) {
      targetCamX = maxCamX;
    }
    this.camX += (targetCamX - this.camX) * 0.08;

    let targetCamY = 0.0;
    if (allowOutside && focusY < 180.0) {
      targetCamY = focusY - 180.0;
      if (targetCamY < -1000.0) {
        targetCamY = -1000.0;
      }
    }
    this.camY += (targetCamY - this.camY) * 0.09;
  }

  Draw(ctx) {
    // 1. Sky Gradient
    drawFilledRect(ctx, 0, 0, ScreenWidth, ScreenHeight, rgba(18, 24, 40, 255));

    // Sun / Moon in the sky
    drawFilledCircle(ctx, 400 - this.camX * 0.1, 110, 36, rgba(255, 235, 180, 220));
    drawFilledCircle(ctx, 400 - this.camX * 0.1, 110, 48, rgba(255, 235, 180, 40));

    // Drifting Clouds (parallax speed 0.4)
    for (const c of this.clouds) {
      const cx = c[0] - this.camX * 0.4;
      const cy = c[1];
      if (cx > -120 && cx < ScreenWidth + 120) {
        drawFilledCircle(ctx, cx, cy, 32, rgba(60, 75, 105, 110));
        drawFilledCircle(ctx, cx + 26, cy - 6, 26, rgba(60, 75, 105, 110));
        drawFilledCircle(ctx, cx - 24, cy + 4, 24, rgba(60, 75, 105, 110));
      }
    }

    // Distant Mountains silhouette (parallax 0.3)
    const mountainBaseY = DefaultGroundY - 40 - this.camY * 0.4;
    for (let x = -400; x < WorldWidth + 400; x += 220) {
      const mountainBaseX = x - this.camX * 0.3;
      drawFilledCircle(ctx, mountainBaseX, mountainBaseY, 160, rgba(28, 36, 56, 255));
    }

    // 2. Ground and battlefield terrain
    const groundY = DefaultGroundY + 2 - this.camY;
    drawFilledRect(
      ctx,
      -100,
      groundY,
      ScreenWidth + 200,
      ScreenHeight - groundY + 800,
      rgba(38, 48, 68, 255)
    );
    strokeLine(
      ctx,
      -100,
      groundY,
      ScreenWidth + 200,
      groundY,
      3.5,
      rgba(72, 105, 145, 255)
    );

    // Decorative grass blades along ground
    for (let wx = -300; wx < WorldWidth + 300; wx += 28) {
      const sx = wx - this.camX;
      if (sx > -20 && sx < ScreenWidth + 20) {
        drawFilledRect(ctx, sx, groundY - 5, 8, 5, rgba(95, 145, 190, 200));
      }
    }

    // Archer 1 Base Pedestal & Flag (World X ~ 220)
    this.drawBaseFort(ctx, Player1StartX, groundY, rgba(235, 185, 50, 255), 'P1');
    // Archer 2 Base Pedestal & Flag (World X ~ 1780)
    this.drawBaseFort(ctx, Player2StartX, groundY, rgba(50, 185, 245, 255), 'P2');

    // 3. Draw Stuck Arrows embedded in the earth
    for (const a of this.stuckArrows) {
      a.Draw(ctx, this.camX, this.camY);
    }

    // 4. Draw Flying Arrow
    if (this.currentArrow) {
      this.currentArrow.Draw(ctx, this.camX, this.camY);
    }

    // 5. Draw Both Archers
    this.players[0].Draw(ctx, this.camX, this.camY);
    this.players[1].Draw(ctx, this.camX, this.camY);

    // 6. Draw Explosions
    for (const e of this.explosions) {
      e.Draw(ctx, this.camX, this.camY);
    }

    // 7. Draw HUD
    this.drawHUD(ctx);

    // 8. Draw On-Demand Android Touch Controller (hidden by default; only visible while touched)
    if (this.phase === PhaseAiming) {
      this.touchController.Draw(ctx);
    }

    // 9. Draw Game Over screen
    if (this.phase === PhaseGameOver) {
      this.drawGameOver(ctx);
    }
  }

  drawBaseFort(ctx, worldX, groundY, teamColor, tag) {
    const sx = worldX - this.camX;
    if (sx < -100 || sx > ScreenWidth + 100) {
      return;
    }

    // Stone platform
    drawFilledRect(ctx, sx - 60, groundY, 120, 18, rgba(50, 60, 85, 255));
    strokeLine(ctx, sx - 60, groundY, sx + 60, groundY, 2.0, teamColor);

    // Flagpole
    const flagX = tag === 'P2' ? sx + 45 : sx - 45;
    strokeLine(ctx, flagX, groundY - 80, flagX, groundY, 2.5, rgba(180, 195, 215, 255));

    // Flag banner
    const flagDir = tag === 'P2' ? -24 : 24;
    drawFilledRect(ctx, flagX, groundY - 80, flagDir, 16, teamColor);
  }

  drawHUD(ctx) {
    // Top Header Bar
    drawFilledRect(ctx, 0, 0, ScreenWidth, 75, rgba(10, 14, 24, 210));
    strokeLine(ctx, 0, 75, ScreenWidth, 75, 1.5, rgba(55, 75, 110, 180));

    // Player 1 Health Bar (Top Left)
    this.drawHealthBar(ctx, 25, 20, 220, 22, this.players[0], rgba(240, 180, 40, 255));

    // Player 2 Health Bar (Top Right)
    this.drawHealthBar(
      ctx,
      ScreenWidth - 245,
      20,
      220,
      22,
      this.players[1],
      rgba(50, 180, 245, 255)
    );

    // Center Turn Banner
    const active = this.ActivePlayer();
    const turnColor =
      active.ID === 2 ? rgba(70, 200, 255, 255) : rgba(255, 210, 50, 255);

    let turnText = `${active.Name}'S TURN`;
    if (this.phase === PhaseFlying) {
      turnText = 'ARROW IN FLIGHT...';
    } else if (this.phase === PhaseTransition) {
      turnText = 'SWITCHING SIDES...';
    }

    drawText(ctx, turnText, ScreenWidth / 2, 16, 24, turnColor, 'center');

    // Round indicator
    drawText(
      ctx,
      `ROUND ${this.roundNumber}`,
      ScreenWidth / 2,
      45,
      14,
      rgba(160, 180, 210, 190),
      'center'
    );

    // Bottom Stats Console
    if (this.phase === PhaseAiming) {
      this.drawStatsConsole(ctx, active);
    }
  }

  drawHealthBar(ctx, x, y, width, height, p, teamColor) {
    drawFilledRect(ctx, x, y, width, height, rgba(25, 30, 45, 230));
    strokeRect(ctx, x, y, width, height, 1.8, teamColor);

    let hpPct = p.Health / p.MaxHealth;
    if (hpPct < 0) hpPct = 0;

    let barColor = rgba(50, 210, 90, 240);
    if (hpPct < 0.35) {
      barColor = rgba(240, 60, 60, 240);
    } else if (hpPct < 0.65) {
      barColor = rgba(240, 180, 40, 240);
    }
    drawFilledRect(ctx, x + 2, y + 2, (width - 4) * hpPct, height - 4, barColor);

    drawText(
      ctx,
      `${p.Name} : ${p.Health} HP`,
      x + 6,
      y + 2,
      14,
      rgba(255, 255, 255, 240),
      'left'
    );
  }

  drawStatsConsole(ctx, p) {
    drawFilledRect(ctx, 25, ScreenHeight - 80, 280, 60, rgba(18, 24, 38, 220));
    strokeRect(ctx, 25, ScreenHeight - 80, 280, 60, 1.5, rgba(65, 88, 128, 200));

    const angleDeg = p.GetAngleDegrees();
    const powerPct = Math.round(
      ((p.AimPower - MinPower) / (MaxPower - MinPower)) * 100
    );

    const statText = `ANGLE: ${angleDeg}°  |  POWER: ${powerPct}%`;
    drawText(
      ctx,
      statText,
      40,
      ScreenHeight - 72,
      17,
      rgba(255, 225, 90, 255),
      'left'
    );

    // Power Gauge Bar
    const barWidth = 240;
    drawFilledRect(ctx, 40, ScreenHeight - 46, barWidth, 12, rgba(30, 40, 60, 255));
    const filledW = barWidth * (powerPct / 100.0);
    drawFilledRect(ctx, 40, ScreenHeight - 46, filledW, 12, rgba(245, 140, 30, 255));
    strokeRect(ctx, 40, ScreenHeight - 46, barWidth, 12, 1.0, rgba(200, 215, 240, 150));
  }

  drawGameOver(ctx) {
    drawFilledRect(ctx, 0, 0, ScreenWidth, ScreenHeight, rgba(8, 12, 20, 225));

    const winner = this.OpponentPlayer().IsDead()
      ? this.ActivePlayer()
      : this.OpponentPlayer();

    drawText(
      ctx,
      `${winner.Name} WINS!`,
      ScreenWidth / 2,
      170,
      54,
      rgba(255, 215, 60, 255),
      'center'
    );

    drawText(
      ctx,
      `VICTORY IN ${this.roundNumber} ROUNDS`,
      ScreenWidth / 2,
      250,
      22,
      rgba(200, 220, 255, 200),
      'center'
    );

    drawText(
      ctx,
      'TOUCH SCREEN FOR REMATCH',
      ScreenWidth / 2,
      340,
      22,
      rgba(255, 225, 110, 235),
      'center'
    );
  }

  Layout(outsideWidth, outsideHeight) {
    return [outsideWidth, outsideHeight];
  }
}

function nilOrNull() {
  return null;
}

export function NewGameScene() {
  return new GameScene();
}
