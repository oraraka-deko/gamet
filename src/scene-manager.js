// Ported from goastroids/scene-manager.go
import { ScreenWidth, ScreenHeight } from './constants.js';

export const transsitonMaxCount = 25;

function createOffscreenCanvas() {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = ScreenWidth;
    c.height = ScreenHeight;
    return c;
  }
  return null;
}

export class SceneManager {
  constructor() {
    this.current = null;
    this.next = null;
    this.transsitionCount = 0;

    this.transsitonFrom = createOffscreenCanvas();
    this.transsitonTo = createOffscreenCanvas();
  }

  Draw(ctx) {
    if (!this.current) return;

    if (this.transsitionCount === 0 || !this.transsitonFrom || !this.transsitonTo) {
      this.current.Draw(ctx);
      return;
    }

    const fromCtx = this.transsitonFrom.getContext('2d');
    fromCtx.clearRect(0, 0, ScreenWidth, ScreenHeight);
    this.current.Draw(fromCtx);

    const toCtx = this.transsitonTo.getContext('2d');
    toCtx.clearRect(0, 0, ScreenWidth, ScreenHeight);
    this.next.Draw(toCtx);

    ctx.drawImage(this.transsitonFrom, 0, 0);

    const alpha = 1.0 - this.transsitionCount / transsitonMaxCount;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(this.transsitonTo, 0, 0);
    ctx.restore();
  }

  Update(inputState) {
    if (this.transsitionCount === 0) {
      if (this.current) {
        return this.current.Update({ SceneManager: this, Input: inputState });
      }
      return null;
    }

    this.transsitionCount--;
    if (this.transsitionCount > 0) {
      return null;
    }

    this.current = this.next;
    this.next = null;
    return null;
  }

  GoToScene(scene) {
    if (this.current === null) {
      this.current = scene;
    } else {
      this.next = scene;
      this.transsitionCount = transsitonMaxCount;
    }
  }
}

