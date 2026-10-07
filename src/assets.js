// Ported from assets/assets.go

function pad3(n) {
  return String(n).padStart(3, '0');
}

function buildFramePaths(folder, prefix, count = 10) {
  const paths = [];
  for (let i = 0; i < count; i++) {
    paths.push(`/assets/archer/${folder}/${prefix}_${pad3(i)}.png`);
  }
  return paths;
}

const DEFAULT_MANIFEST = {
  playerSprite: '/assets/images/player.png',
  titleFont: '/assets/fonts/title.ttf',
  meteors: [
    '/assets/images/meteors/meteorBrown_big1.png',
    '/assets/images/meteors/meteorBrown_big2.png',
    '/assets/images/meteors/meteorBrown_big3.png',
    '/assets/images/meteors/meteorBrown_big4.png',
    '/assets/images/meteors/meteorGrey_big1.png',
    '/assets/images/meteors/meteorGrey_big2.png',
    '/assets/images/meteors/meteorGrey_big3.png',
    '/assets/images/meteors/meteorGrey_big4.png',
  ],
  meteorsSmall: [
    '/assets/images/meteors-small/meteorBrown_med1.png',
    '/assets/images/meteors-small/meteorBrown_med3.png',
    '/assets/images/meteors-small/meteorGrey_med1.png',
    '/assets/images/meteors-small/meteorGrey_med2.png',
  ],
  archer1: {
    idle: buildFramePaths(1, 'Elf_01__IDLE'),
    attack: buildFramePaths(1, 'Elf_01__ATTACK'),
    hurt: buildFramePaths(1, 'Elf_01__HURT'),
    die: buildFramePaths(1, 'Elf_01__DIE'),
  },
  archer2: {
    idle: buildFramePaths(2, 'Elf_02__IDLE'),
    attack: buildFramePaths(2, 'Elf_02__ATTACK'),
    hurt: buildFramePaths(2, 'Elf_02__HURT'),
    die: buildFramePaths(2, 'Elf_02__DIE'),
  },
  arrowSprite: '/assets/arrows/without_shadow/1.png',
  explosionSprite: '/assets/images/explosion.png',
};

export const assets = {
  PlayerSprite: null,
  TitleFont: 'TitleFont',
  MeteoresSprites: [],
  MeteoresSpritesSmall: [],

  ArcherIdle: [],
  ArcherAttack: [],
  ArcherHurt: [],
  ArcherHurtTinted: [],
  ArcherDie: [],

  Archer2Idle: [],
  Archer2Attack: [],
  Archer2Hurt: [],
  Archer2HurtTinted: [],
  Archer2Die: [],

  ArrowSprite: null,
  ExplosionSprite: null,
  loaded: false,
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function loadImages(paths) {
  return Promise.all(paths.map((p) => loadImage(p)));
}

/**
 * Pre-generates Ebiten's op.ColorScale.Scale(1.5, 0.4, 0.4, 1.0) hurt tint
 */
function createHurtTintedCanvas(img) {
  if (typeof document === 'undefined') return img;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  try {
    const imgData = ctx.getImageData(0, 0, c.width, c.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) {
        data[i] = Math.min(255, Math.round(data[i] * 1.5));
        data[i + 1] = Math.min(255, Math.round(data[i + 1] * 0.4));
        data[i + 2] = Math.min(255, Math.round(data[i + 2] * 0.4));
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch {
    // Fallback if canvas is tainted
  }
  return c;
}

async function loadTitleFont(url) {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') {
    return 'sans-serif';
  }
  try {
    const font = new FontFace('TitleFont', `url(${url})`);
    const loadedFace = await font.load();
    document.fonts.add(loadedFace);
    return 'TitleFont';
  } catch {
    return 'sans-serif';
  }
}

export async function loadAllAssets(onProgress) {
  let manifest = DEFAULT_MANIFEST;
  if (typeof fetch !== 'undefined') {
    try {
      const res = await fetch('/api/assets');
      if (res.ok) {
        manifest = await res.json();
      }
    } catch {
      // Use fallback manifest
    }
  }

  let completed = 0;
  const totalGroups = 12;
  const step = () => {
    completed++;
    if (onProgress) onProgress(completed / totalGroups);
  };

  const [
    titleFont,
    playerSprite,
    meteors,
    meteorsSmall,
    archer1Idle,
    archer1Attack,
    archer1Hurt,
    archer1Die,
    archer2Idle,
    archer2Attack,
    archer2Hurt,
    archer2Die,
    arrowSprite,
    explosionSprite,
  ] = await Promise.all([
    loadTitleFont(manifest.titleFont).then((res) => (step(), res)),
    loadImage(manifest.playerSprite).then((res) => (step(), res)),
    loadImages(manifest.meteors).then((res) => (step(), res)),
    loadImages(manifest.meteorsSmall).then((res) => (step(), res)),
    loadImages(manifest.archer1.idle).then((res) => (step(), res)),
    loadImages(manifest.archer1.attack).then((res) => (step(), res)),
    loadImages(manifest.archer1.hurt).then((res) => (step(), res)),
    loadImages(manifest.archer1.die).then((res) => (step(), res)),
    loadImages(manifest.archer2.idle).then((res) => (step(), res)),
    loadImages(manifest.archer2.attack).then((res) => (step(), res)),
    loadImages(manifest.archer2.hurt).then((res) => (step(), res)),
    loadImages(manifest.archer2.die).then((res) => (step(), res)),
    loadImage(manifest.arrowSprite),
    loadImage(manifest.explosionSprite),
  ]);

  assets.TitleFont = titleFont;
  assets.PlayerSprite = playerSprite;
  assets.MeteoresSprites = meteors;
  assets.MeteoresSpritesSmall = meteorsSmall;

  assets.ArcherIdle = archer1Idle;
  assets.ArcherAttack = archer1Attack;
  assets.ArcherHurt = archer1Hurt;
  assets.ArcherHurtTinted = archer1Hurt.map(createHurtTintedCanvas);
  assets.ArcherDie = archer1Die;

  assets.Archer2Idle = archer2Idle;
  assets.Archer2Attack = archer2Attack;
  assets.Archer2Hurt = archer2Hurt;
  assets.Archer2HurtTinted = archer2Hurt.map(createHurtTintedCanvas);
  assets.Archer2Die = archer2Die;

  assets.ArrowSprite = arrowSprite;
  assets.ExplosionSprite = explosionSprite;
  assets.loaded = true;

  return assets;
}

