// Ported constants from goastroids/game.go, goastroids/arrow.go, and goastroids/player.go

export const ScreenWidth = 800;
export const ScreenHeight = 600;
export const WorldWidth = 2000;
export const WorldHeight = 600;
export const TPS = 60;

// Arrow physics constants (from goastroids/arrow.go)
export const ArrowGravity = 450.0;   // Realistic gravity
export const ArrowDragCoeff = 0.0003; // Tuned drag
export const DefaultGroundY = 470.0; // Ground level in world pixels

// Player constants (from goastroids/player.go)
export const Player1StartX = 220.0;
export const Player2StartX = 1780.0;
export const ArcherSpriteScale = 0.28;
export const MinPower = 500.0;
export const MaxPower = 1900.0;
export const DefaultPower = 1250.0;
export const PlayerGravity = 950.0;

// Ebiten Key equivalents
export const Key = {
  None: '',
  Space: 'Space',
  Enter: 'Enter',
  Up: 'ArrowUp',
  Down: 'ArrowDown',
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
  W: 'KeyW',
  A: 'KeyA',
  S: 'KeyS',
  D: 'KeyD',
};

