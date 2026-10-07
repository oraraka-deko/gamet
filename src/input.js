// Input system supporting Android touch, pointer/mouse drag, and keyboard
import { ScreenWidth, ScreenHeight } from './constants.js';

class InputSystem {
  constructor() {
    this.keysDown = new Set();
    this.prevKeysDown = new Set();
    this.justPressedKeys = new Set();

    // Active touch / pointer state for the on-demand Android touch controller
    this.pointerActive = false;
    this.prevPointerActive = false;
    this.pointerJustStarted = false;
    this.pointerJustEnded = false;

    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.activeTouchId = null;

    this.canvas = null;
  }

  attach(canvas) {
    this.canvas = canvas;

    const toLogicalCoords = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return { x: 0, y: 0 };
      }
      const scaleX = ScreenWidth / rect.width;
      const scaleY = ScreenHeight / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.code)) {
        e.preventDefault();
      }
      this.keysDown.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keysDown.clear();
      this.pointerActive = false;
      this.activeTouchId = null;
    });

    // Android / Mobile Touch Events
    canvas.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        if (this.activeTouchId === null && e.changedTouches.length > 0) {
          const t = e.changedTouches[0];
          this.activeTouchId = t.identifier;
          const pos = toLogicalCoords(t.clientX, t.clientY);
          this.startX = pos.x;
          this.startY = pos.y;
          this.currentX = pos.x;
          this.currentY = pos.y;
          this.pointerActive = true;
        }
      },
      { passive: false }
    );

    canvas.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        if (this.activeTouchId !== null) {
          for (let i = 0; i < e.touches.length; i++) {
            const t = e.touches[i];
            if (t.identifier === this.activeTouchId) {
              const pos = toLogicalCoords(t.clientX, t.clientY);
              this.currentX = pos.x;
              this.currentY = pos.y;
              break;
            }
          }
        }
      },
      { passive: false }
    );

    const handleTouchEnd = (e) => {
      e.preventDefault();
      if (this.activeTouchId !== null) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.activeTouchId) {
            const pos = toLogicalCoords(t.clientX, t.clientY);
            this.currentX = pos.x;
            this.currentY = pos.y;
            this.pointerActive = false;
            this.activeTouchId = null;
            break;
          }
        }
      }
    };

    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    // Mouse fallback for testing touch controller on desktop browsers
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || this.activeTouchId !== null) return;
      const pos = toLogicalCoords(e.clientX, e.clientY);
      this.startX = pos.x;
      this.startY = pos.y;
      this.currentX = pos.x;
      this.currentY = pos.y;
      this.pointerActive = true;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.pointerActive || this.activeTouchId !== null) return;
      const pos = toLogicalCoords(e.clientX, e.clientY);
      this.currentX = pos.x;
      this.currentY = pos.y;
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button !== 0 || this.activeTouchId !== null) return;
      if (this.pointerActive) {
        const pos = toLogicalCoords(e.clientX, e.clientY);
        this.currentX = pos.x;
        this.currentY = pos.y;
        this.pointerActive = false;
      }
    });
  }

  /**
   * Called once per tick before scene update to compute frame transitions
   */
  Update() {
    this.justPressedKeys.clear();
    for (const code of this.keysDown) {
      if (!this.prevKeysDown.has(code)) {
        this.justPressedKeys.add(code);
      }
    }
    this.prevKeysDown = new Set(this.keysDown);

    this.pointerJustStarted = this.pointerActive && !this.prevPointerActive;
    this.pointerJustEnded = !this.pointerActive && this.prevPointerActive;
    this.prevPointerActive = this.pointerActive;
  }

  IsKeyPressed(key) {
    if (!key) return false;
    return this.keysDown.has(key);
  }

  IsKeyJustPressed(key) {
    if (!key) return false;
    return this.justPressedKeys.has(key);
  }

  IsTouchActive() {
    return this.pointerActive;
  }

  IsTouchJustStarted() {
    return this.pointerJustStarted;
  }

  IsTouchJustEnded() {
    return this.pointerJustEnded;
  }

  TouchOrigin() {
    return [this.startX, this.startY];
  }

  TouchPosition() {
    return [this.currentX, this.currentY];
  }
}

export const input = new InputSystem();
