// Ported from goastroids/timer.go
import { TPS } from './constants.js';

export class Timer {
  /**
   * @param {number} durationMs Duration in milliseconds
   */
  constructor(durationMs) {
    this.currentTicks = 0;
    this.targetTicks = Math.floor((durationMs * TPS) / 1000);
  }

  Update() {
    if (this.currentTicks < this.targetTicks) {
      this.currentTicks++;
    }
  }

  IsReady() {
    return this.currentTicks >= this.targetTicks;
  }

  Reset() {
    this.currentTicks = 0;
  }
}

export function NewTimer(durationMs) {
  return new Timer(durationMs);
}

