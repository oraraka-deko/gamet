import test from 'node:test';
import assert from 'node:assert/strict';

import { Vector } from '../src/vector.js';
import { NewTimer } from '../src/timer.js';
import { input } from '../src/input.js';
import {
  NewArrow,
  ArrowFlying,
  ArrowStuck,
  DefaultGroundY,
  segmentIntersectsAABB,
} from '../src/arrow.js';
import {
  ArcherAttack,
  ArcherHurt,
  MinPower,
  MaxPower,
} from '../src/player.js';
import { transsitonMaxCount } from '../src/scene-manager.js';
import {
  NewGameScene,
  PhaseAiming,
  PhaseShooting,
  PhaseFlying,
  PhaseGameOver,
} from '../src/game-scene.js';
import { Game } from '../src/game.js';
import { getAssetManifest, createGameServer } from '../server.js';

function createMockCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    globalAlpha: 1,
    save() {},
    restore() {},
    fillRect() {},
    strokeRect() {},
    clearRect() {},
    beginPath() {},
    closePath() {},
    arc() {},
    ellipse() {},
    fill() {},
    stroke() {},
    moveTo() {},
    lineTo() {},
    fillText() {},
    translate() {},
    scale() {},
    rotate() {},
    drawImage() {},
  };
}

test('Vector normalize matches Go implementation', () => {
  const v = new Vector(3, 4);
  const n = v.Normalize();
  assert.ok(Math.abs(n.X - 0.6) < 1e-9);
  assert.ok(Math.abs(n.Y - 0.8) < 1e-9);
});

test('Timer ticks at 60 TPS and resets properly', () => {
  const timer = NewTimer(500);
  assert.equal(timer.targetTicks, 30);
  assert.equal(timer.IsReady(), false);

  for (let i = 0; i < 30; i++) {
    timer.Update();
  }
  assert.equal(timer.IsReady(), true);
  timer.Reset();
  assert.equal(timer.IsReady(), false);
});

test('Arrow ballistic trajectory, drag, weather-vaning, and ground embed', () => {
  const arrow = NewArrow(220, 420, 1250, -Math.PI / 4, 1);
  assert.equal(arrow.State, ArrowFlying);

  const dt = 1.0 / 60.0;
  let steps = 0;
  while (arrow.State === ArrowFlying && steps < 600) {
    arrow.Update(dt, DefaultGroundY);
    steps++;
  }

  assert.equal(arrow.State, ArrowStuck);
  assert.equal(arrow.VX, 0);
  assert.equal(arrow.VY, 0);
  assert.equal(arrow.Trail, null);
  const [, tipY] = arrow.TipPosition();
  assert.ok(Math.abs(tipY - DefaultGroundY) < 1e-6);
});

test('Liang-Barsky CCD collision detects fast arrow hitting opponent player', () => {
  const scene = NewGameScene();
  const target = scene.players[1];
  const [minX, minY, maxX, maxY] = target.HitboxBounds();

  assert.equal(
    segmentIntersectsAABB(
      minX - 50,
      (minY + maxY) / 2,
      maxX + 50,
      (minY + maxY) / 2,
      minX,
      minY,
      maxX,
      maxY
    ),
    true
  );

  const arrow = NewArrow(target.position.X - 40, target.position.Y - 70, 1500, 0, 1);
  arrow.Update(1 / 60, DefaultGroundY);
  assert.equal(arrow.CollidesWithPlayer(target), true);
});

test('Player attack animation spawns arrow on frame 6 and knockback launches airborne backflip', () => {
  const scene = NewGameScene();
  const p1 = scene.players[0];
  const p2 = scene.players[1];

  p1.AdjustAngle(-10);
  assert.equal(p1.GetAngleDegrees(), 80);
  p1.AdjustPower(5000);
  assert.equal(p1.AimPower, MaxPower);
  p1.AdjustPower(-5000);
  assert.equal(p1.AimPower, MinPower);

  scene.phase = PhaseShooting;
  p1.TriggerAttack();
  assert.equal(p1.state, ArcherAttack);

  for (let i = 0; i < 40; i++) {
    p1.Update();
  }
  assert.equal(scene.phase, PhaseFlying);
  assert.ok(scene.currentArrow !== null);

  const startX = p2.position.X;
  p2.TakeDamage(40);
  p2.ApplyKnockback(1500, -Math.PI / 4, 800);
  assert.equal(p2.IsAirborne(), true);
  assert.equal(p2.state, ArcherHurt);
  assert.equal(p2.Health, 60);

  let ticks = 0;
  while (p2.IsAirborne() && ticks < 300) {
    p2.Update();
    ticks++;
  }
  assert.equal(p2.IsAirborne(), false);
  assert.ok(p2.position.X > startX);
  assert.equal(p2.position.Y, DefaultGroundY);
});

test('TouchController is hidden by default, appears on Android touch, supports cancel icon, and fires on release', () => {
  const ctx = createMockCtx();
  const scene = NewGameScene();
  const tc = scene.touchController;

  // 1. Hidden by default
  assert.equal(tc.visible, false);

  // 2. Simulate Android touchstart at (300, 350)
  input.prevPointerActive = false;
  input.pointerActive = true;
  input.startX = 300;
  input.startY = 350;
  input.currentX = 300;
  input.currentY = 350;
  input.Update();
  scene.Update({});
  assert.equal(tc.visible, true);
  scene.Draw(ctx); // Renders controller while visible

  // 3. Drag knob down-left (slingshot pull-back like the reference image)
  input.currentX = 240;
  input.currentY = 410;
  input.Update();
  scene.Update({});
  assert.equal(tc.visible, true);
  assert.equal(tc.isCanceled, false);
  assert.equal(scene.ActivePlayer().GetAngleDegrees(), 45);
  assert.ok(scene.ActivePlayer().AimPower > MinPower);

  // 4. Drag onto the red cancel icon -> cancels shot on release
  const [cancelX, cancelY] = tc.getCancelPosition();
  input.currentX = cancelX;
  input.currentY = cancelY;
  input.Update();
  scene.Update({});
  assert.equal(tc.isCanceled, true);

  // Release while on cancel icon -> controller hides and stays in PhaseAiming
  input.pointerActive = false;
  input.Update();
  scene.Update({});
  assert.equal(tc.visible, false);
  assert.equal(scene.phase, PhaseAiming);

  // 5. Touch again, drag to aim, and release -> fires arrow and hides controller
  input.pointerActive = true;
  input.startX = 300;
  input.startY = 350;
  input.currentX = 230;
  input.currentY = 410;
  input.Update();
  scene.Update({});
  assert.equal(tc.visible, true);
  assert.equal(tc.isCanceled, false);

  input.pointerActive = false;
  input.Update();
  scene.Update({});
  assert.equal(tc.visible, false);
  assert.equal(scene.phase, PhaseShooting);

  // 6. Verify right-side player (Player 2, FacingRight = false) has mirrored cancel zone on bottom-left
  scene.phase = PhaseAiming;
  scene.activePlayerIndex = 1;
  input.pointerActive = true;
  input.startX = 500;
  input.startY = 350;
  input.currentX = 500;
  input.currentY = 350;
  input.Update();
  scene.Update({});
  const [p2CancelX, p2CancelY] = tc.getCancelPosition();
  assert.ok(p2CancelX < tc.originX);
  assert.ok(p2CancelY > tc.originY);
  input.pointerActive = false;
  input.Update();
  scene.Update({});
});

test('SceneManager, TitleScene, and GameScene Update and Draw execute cleanly across all phases', () => {
  const ctx = createMockCtx();
  const game = new Game();
  game.Update();
  game.Draw(ctx);

  const gameScene = NewGameScene();
  game.sceneManager.GoToScene(gameScene);
  for (let i = 0; i < transsitonMaxCount; i++) {
    game.Update();
    game.Draw(ctx);
  }
  assert.equal(game.sceneManager.current, gameScene);

  gameScene.Draw(ctx);
  gameScene.SpawnArrow(275, 420, 1400, -Math.PI / 3, 1);
  gameScene.Update({ SceneManager: game.sceneManager });
  gameScene.Draw(ctx);

  gameScene.players[1].TakeDamage(100);
  gameScene.phase = PhaseGameOver;
  gameScene.Draw(ctx);
});

test('Node HTTP server serves index.html, ES modules, asset manifest, and PNG sprites', async () => {
  const manifest = getAssetManifest();
  assert.equal(manifest.archer1.idle.length, 10);
  assert.equal(manifest.archer2.attack.length, 10);

  const server = createGameServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const htmlRes = await fetch(`${baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.ok(html.includes('src/game.js'));

    const apiRes = await fetch(`${baseUrl}/api/assets`);
    assert.equal(apiRes.status, 200);
    const json = await apiRes.json();
    assert.equal(json.arrowSprite, '/assets/arrows/without_shadow/1.png');

    const imgRes = await fetch(`${baseUrl}/assets/arrows/without_shadow/1.png`);
    assert.equal(imgRes.status, 200);
    assert.equal(imgRes.headers.get('content-type'), 'image/png');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
