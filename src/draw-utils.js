// Ported Ebiten vector & text/v2 drawing helpers for HTML5 Canvas 2D
import { assets } from './assets.js';

export function rgba(r, g, b, a = 255) {
  return { R: r, G: g, B: b, A: a };
}

export function colorToCss(c) {
  if (!c) return 'rgba(255, 255, 255, 1)';
  if (typeof c === 'string') return c;
  const a = c.A !== undefined ? c.A / 255 : 1;
  return `rgba(${c.R | 0}, ${c.G | 0}, ${c.B | 0}, ${a.toFixed(4)})`;
}

export function drawFilledRect(ctx, x, y, width, height, color) {
  ctx.save();
  ctx.fillStyle = colorToCss(color);
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

export function strokeRect(ctx, x, y, width, height, strokeWidth, color) {
  ctx.save();
  ctx.strokeStyle = colorToCss(color);
  ctx.lineWidth = strokeWidth;
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

export function drawFilledCircle(ctx, cx, cy, radius, color) {
  if (radius <= 0) return;
  ctx.save();
  ctx.fillStyle = colorToCss(color);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function strokeCircle(ctx, cx, cy, radius, strokeWidth, color) {
  if (radius <= 0) return;
  ctx.save();
  ctx.strokeStyle = colorToCss(color);
  ctx.lineWidth = strokeWidth;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function strokeLine(ctx, x0, y0, x1, y1, strokeWidth, color) {
  ctx.save();
  ctx.strokeStyle = colorToCss(color);
  ctx.lineWidth = strokeWidth;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

/**
 * Replicates Ebiten text/v2 text.Draw with PrimaryAlign ('left' | 'center') and top baseline
 */
export function drawText(ctx, str, x, y, fontSize, color, align = 'left') {
  ctx.save();
  const fontFamily = assets.TitleFont || 'TitleFont, sans-serif';
  ctx.font = `${fontSize}px "${fontFamily}", sans-serif`;
  ctx.fillStyle = colorToCss(color);
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(str, x, y);
  ctx.restore();
}

