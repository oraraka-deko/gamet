// Ported from goastroids/title-scene.go (without cluttered virtual button)
import { ScreenWidth, ScreenHeight, DefaultGroundY, Key } from './constants.js';
import { assets } from './assets.js';
import { input } from './input.js';
import { NewGameScene } from './game-scene.js';
import { rgba, drawFilledRect, strokeLine, drawText } from './draw-utils.js';

export class TitleScene {
  constructor() {
    this.idleFrame = 0;
    this.idleTicks = 0;
  }

  Update(state) {
    this.idleTicks++;
    if (this.idleTicks >= 8) {
      this.idleTicks = 0;
      this.idleFrame++;
      const frameLen = assets.ArcherIdle.length || 10;
      if (this.idleFrame >= frameLen) {
        this.idleFrame = 0;
      }
    }

    if (
      input.IsTouchJustEnded() ||
      input.IsKeyJustPressed(Key.Space) ||
      input.IsKeyJustPressed(Key.Enter)
    ) {
      state.SceneManager.GoToScene(NewGameScene());
      return null;
    }

    return null;
  }

  Draw(ctx) {
    // Sky gradient
    drawFilledRect(ctx, 0, 0, ScreenWidth, ScreenHeight, rgba(16, 22, 38, 255));

    // Ground plane
    const groundY = DefaultGroundY + 2;
    drawFilledRect(
      ctx,
      0,
      groundY,
      ScreenWidth,
      ScreenHeight - groundY,
      rgba(34, 44, 64, 255)
    );
    strokeLine(ctx, 0, groundY, ScreenWidth, groundY, 3.0, rgba(68, 92, 132, 255));

    // Title Banner
    drawText(
      ctx,
      'ARCHER DUEL',
      ScreenWidth / 2,
      80,
      56,
      rgba(255, 215, 60, 255),
      'center'
    );

    // Subtitle
    drawText(
      ctx,
      'Turn-Based Ballistic Archery Battle',
      ScreenWidth / 2,
      150,
      20,
      rgba(180, 210, 250, 220),
      'center'
    );

    // Draw Archer 1 preview on left (facing right)
    if (assets.ArcherIdle.length > 0) {
      const frame1 = assets.ArcherIdle[this.idleFrame % assets.ArcherIdle.length];
      if (frame1) {
        ctx.save();
        ctx.translate(230, groundY);
        ctx.scale(0.32, 0.32);
        ctx.translate(-1000, -825);
        ctx.drawImage(frame1, 0, 0);
        ctx.restore();
      }
    }

    // "VS" Badge in center
    drawText(
      ctx,
      'VS',
      ScreenWidth / 2,
      groundY - 80,
      44,
      rgba(240, 80, 80, 255),
      'center'
    );

    // Draw Archer 2 preview on right (flipped facing left)
    if (assets.Archer2Idle.length > 0) {
      const frame2 = assets.Archer2Idle[this.idleFrame % assets.Archer2Idle.length];
      if (frame2) {
        ctx.save();
        ctx.translate(ScreenWidth - 230, groundY);
        ctx.scale(-0.32, 0.32);
        ctx.translate(-1000, -825);
        ctx.drawImage(frame2, 0, 0);
        ctx.restore();
      }
    }

    // Clean Touch / Space prompt
    drawText(
      ctx,
      'TOUCH TO START BATTLE',
      ScreenWidth / 2,
      ScreenHeight - 75,
      22,
      rgba(255, 225, 110, 235),
      'center'
    );
  }
}

export function NewTitleScene() {
  return new TitleScene();
}
