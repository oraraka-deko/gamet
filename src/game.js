// Ported from goastroids/game.go and main.go
import { ScreenWidth, ScreenHeight, WorldWidth, WorldHeight, TPS } from './constants.js';
import { SceneManager } from './scene-manager.js';
import { NewTitleScene } from './title-scene.js';
import { input } from './input.js';
import { loadAllAssets } from './assets.js';
import { rgba, drawFilledRect, strokeRect, drawText } from './draw-utils.js';

export { ScreenWidth, ScreenHeight, WorldWidth, WorldHeight };

export class Game {
  constructor() {
    this.sceneManager = null;
    this.input = input;
  }

  Update() {
    if (!this.sceneManager) {
      this.sceneManager = new SceneManager();
      this.sceneManager.GoToScene(NewTitleScene());
    }
    this.input.Update();
    return this.sceneManager.Update(this.input);
  }

  Draw(ctx) {
    if (this.sceneManager) {
      this.sceneManager.Draw(ctx);
    }
  }

  Layout() {
    return [ScreenWidth, ScreenHeight];
  }
}

export async function runGame(canvas) {
  canvas.width = ScreenWidth;
  canvas.height = ScreenHeight;
  const ctx = canvas.getContext('2d');

  input.attach(canvas);

  const drawLoading = (progress) => {
    drawFilledRect(ctx, 0, 0, ScreenWidth, ScreenHeight, rgba(16, 22, 38, 255));
    drawText(
      ctx,
      'ARCHER DUEL',
      ScreenWidth / 2,
      220,
      46,
      rgba(255, 215, 60, 255),
      'center'
    );
    drawText(
      ctx,
      `LOADING ASSETS... ${Math.round(progress * 100)}%`,
      ScreenWidth / 2,
      290,
      18,
      rgba(180, 210, 250, 220),
      'center'
    );
    const barW = 320;
    const barX = (ScreenWidth - barW) / 2;
    drawFilledRect(ctx, barX, 330, barW, 14, rgba(30, 40, 60, 255));
    drawFilledRect(
      ctx,
      barX,
      330,
      barW * Math.min(1, progress),
      14,
      rgba(255, 215, 60, 255)
    );
    strokeRect(ctx, barX, 330, barW, 14, 1.5, rgba(180, 210, 250, 180));
  };

  drawLoading(0);
  await loadAllAssets((p) => drawLoading(p));

  const game = new Game();
  const stepMs = 1000 / TPS;
  let lastTime = performance.now();
  let accumulator = 0;

  function loop(now) {
    let elapsed = now - lastTime;
    lastTime = now;
    if (elapsed > 250) {
      elapsed = 250;
    }
    accumulator += elapsed;

    while (accumulator >= stepMs) {
      game.Update();
      accumulator -= stepMs;
    }

    ctx.clearRect(0, 0, ScreenWidth, ScreenHeight);
    game.Draw(ctx);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
  return game;
}

