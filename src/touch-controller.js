// On-demand Android Touch Joystick Controller (hidden by default, visible only on touch)
import { ScreenWidth, ScreenHeight, MinPower, MaxPower } from './constants.js';
import { input } from './input.js';

export class TouchController {
  constructor() {
    // Hidden by default; only becomes visible when touched
    this.visible = false;

    this.originX = 0;
    this.originY = 0;
    this.knobX = 0;
    this.knobY = 0;

    this.baseRadius = 88;
    this.centerRadius = 26;
    this.knobRadius = 42;
    this.cancelRadius = 16;

    this.facingRight = true;
    this.isCanceled = false;
    this.shouldFire = false;
  }

  /**
   * Offset coordinates of the red cancel icon:
   * - Left player (facingRight = true): bottom-right of the outer ring
   * - Right player (facingRight = false): mirrored to bottom-left of the outer ring
   */
  getCancelPosition() {
    const dirX = this.facingRight ? 1 : -1;
    return [
      this.originX + dirX * this.baseRadius * 0.62,
      this.originY + this.baseRadius * 0.56,
    ];
  }

  /**
   * Updates controller visibility, thumbstick position, player aim angle/power, and fire/cancel state.
   * @param {import('./player.js').Player} activePlayer
   */
  Update(activePlayer) {
    this.shouldFire = false;
    if (activePlayer) {
      this.facingRight = activePlayer.FacingRight;
    }

    if (input.IsTouchJustStarted()) {
      const [sx, sy] = input.TouchOrigin();
      const margin = this.baseRadius + 16;
      this.originX = Math.max(margin, Math.min(ScreenWidth - margin, sx));
      this.originY = Math.max(95 + this.baseRadius * 0.5, Math.min(ScreenHeight - margin, sy));
      this.knobX = this.originX;
      this.knobY = this.originY;
      this.visible = true;
      this.isCanceled = true; // In center deadzone initially until dragged
    }

    if (this.visible && input.IsTouchActive()) {
      const [cx, cy] = input.TouchPosition();
      const rawDX = cx - this.originX;
      const rawDY = cy - this.originY;
      const rawDist = Math.hypot(rawDX, rawDY);

      // Check if finger is over the red cancel button
      const [cancelX, cancelY] = this.getCancelPosition();
      const distToCancel = Math.hypot(cx - cancelX, cy - cancelY);

      // Clamp knob within the outer ring radius
      const clampedDist = Math.min(rawDist, this.baseRadius);
      if (rawDist > 0.001) {
        this.knobX = this.originX + (rawDX / rawDist) * clampedDist;
        this.knobY = this.originY + (rawDY / rawDist) * clampedDist;
      } else {
        this.knobX = this.originX;
        this.knobY = this.originY;
      }

      if (distToCancel <= this.cancelRadius * 1.45 || clampedDist < 14) {
        this.isCanceled = true;
      } else {
        this.isCanceled = false;

        // Calculate aim angle and power from thumbstick displacement
        if (activePlayer) {
          let aimDX = rawDX;
          let aimDY = rawDY;

          // Support natural pull-back slingshot (like pulling down-left in the screenshot)
          // as well as direct directional aiming towards the opponent's side
          if (activePlayer.FacingRight && rawDX < 0) {
            aimDX = -rawDX;
            aimDY = -rawDY;
          } else if (!activePlayer.FacingRight && rawDX > 0) {
            aimDX = -rawDX;
            aimDY = -rawDY;
          }

          activePlayer.AimAngle = Math.atan2(aimDY, aimDX);
          activePlayer.AdjustAngle(0); // Clamp to valid elevation range

          const pullRatio = Math.max(0, Math.min(1, (clampedDist - 14) / (this.baseRadius - 14)));
          activePlayer.AimPower = MinPower + pullRatio * (MaxPower - MinPower);
        }
      }
    }

    if (this.visible && input.IsTouchJustEnded()) {
      if (!this.isCanceled) {
        this.shouldFire = true;
      }
      // Hide controller immediately when touch ends
      this.visible = false;
      this.isCanceled = false;
    }
  }

  Hide() {
    this.visible = false;
    this.isCanceled = false;
    this.shouldFire = false;
  }

  /**
   * Renders the virtual joystick controller only when visible (touched).
   * @param {CanvasRenderingContext2D} ctx
   */
  Draw(ctx) {
    if (!this.visible) {
      return;
    }

    ctx.save();

    // 1. Outer Base Circle (translucent white circle with double border ring)
    ctx.beginPath();
    ctx.arc(this.originX, this.originY, this.baseRadius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(20, 24, 34, 0.22)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.originX, this.originY, this.baseRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.originX, this.originY, this.baseRadius - 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // 2. Inner Center Origin Circle
    ctx.beginPath();
    ctx.arc(this.originX, this.originY, this.centerRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(50, 40, 40, 0.25)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 3. Red Cancel Icon (bottom-right of base ring)
    const [cancelX, cancelY] = this.getCancelPosition();
    const cancelR = this.isCanceled ? this.cancelRadius * 1.12 : this.cancelRadius;

    ctx.beginPath();
    ctx.arc(cancelX, cancelY, cancelR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(252, 244, 244, 0.94)';
    ctx.fill();
    ctx.strokeStyle = '#e53e38';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Diagonal slash inside cancel icon (mirrored for right player)
    const slashOffset = cancelR * 0.68;
    const dirX = this.facingRight ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(cancelX - dirX * slashOffset, cancelY - slashOffset);
    ctx.lineTo(cancelX + dirX * slashOffset, cancelY + slashOffset);
    ctx.strokeStyle = '#e53e38';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // 4. Movable Blue/Periwinkle Thumb Knob with 4-Way Arrows
    this.drawThumbKnob(ctx, this.knobX, this.knobY, this.knobRadius);

    ctx.restore();
  }

  drawThumbKnob(ctx, kx, ky, r) {
    // Subtle drop shadow
    ctx.beginPath();
    ctx.arc(kx, ky + 3, r + 1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 20, 38, 0.32)';
    ctx.fill();

    // Main periwinkle blue circle body
    ctx.beginPath();
    ctx.arc(kx, ky, r, 0, Math.PI * 2);
    ctx.fillStyle = '#b3c4ff';
    ctx.fill();

    // Inner light-blue top bevel arc
    ctx.beginPath();
    ctx.arc(kx, ky, r - 2.5, Math.PI * 0.85, Math.PI * 1.95);
    ctx.strokeStyle = '#d4e0ff';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Glossy white pill highlight on top-left
    ctx.save();
    ctx.translate(kx - r * 0.46, ky - r * 0.62);
    ctx.rotate(-Math.PI * 0.22);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.16, r * 0.065, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.fill();
    ctx.restore();

    // Dark navy outer border
    ctx.beginPath();
    ctx.arc(kx, ky, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#353e5c';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // 4 Directional Arrows inside the thumb knob (Up, Down, Left, Right)
    const arrowDirs = [
      [0, -1], // Up
      [0, 1],  // Down
      [-1, 0], // Left
      [1, 0],  // Right
    ];

    ctx.strokeStyle = '#869ad9';
    ctx.fillStyle = '#869ad9';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const [dx, dy] of arrowDirs) {
      const innerDist = r * 0.16;
      const shaftEndDist = r * 0.46;
      const tipDist = r * 0.62;
      const wingDist = r * 0.40;
      const wingSpread = r * 0.21;

      const px = -dy;
      const py = dx;

      // Arrow shaft
      ctx.beginPath();
      ctx.moveTo(kx + dx * innerDist, ky + dy * innerDist);
      ctx.lineTo(kx + dx * shaftEndDist, ky + dy * shaftEndDist);
      ctx.lineWidth = 6.5;
      ctx.stroke();

      // Rounded chevron / triangle arrowhead
      ctx.beginPath();
      ctx.moveTo(kx + dx * wingDist + px * wingSpread, ky + dy * wingDist + py * wingSpread);
      ctx.lineTo(kx + dx * tipDist, ky + dy * tipDist);
      ctx.lineTo(kx + dx * wingDist - px * wingSpread, ky + dy * wingDist - py * wingSpread);
      ctx.closePath();
      ctx.lineWidth = 4.5;
      ctx.fill();
      ctx.stroke();
    }
  }
}

