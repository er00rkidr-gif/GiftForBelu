import * as THREE from 'three';
import { SkinModelType, SkinPreset } from '../types/animation';

/**
 * Minecraft Skin UV Box helper.
 * Each box in a 64x64 skin texture is defined by its top-left pixel origin (ox, oy)
 * and voxel dimensions (w, h, d).
 * Three.js BoxGeometry face order: 0:+X (char left), 1:-X (char right), 2:+Y (top), 3:-Y (bottom), 4:+Z (front), 5:-Z (back)
 */
export function applyMinecraftBoxUVs(
  geometry: THREE.BoxGeometry,
  ox: number,
  oy: number,
  w: number,
  h: number,
  d: number,
  texW = 64,
  texH = 64,
) {
  const uvAttr = geometry.attributes.uv;
  if (!uvAttr) return;

  // Convert pixel rectangle [px, py, pw, ph] (origin top-left) to normalized UVs
  const mapFace = (
    faceIndex: number,
    px: number,
    py: number,
    pw: number,
    ph: number,
    flipX = false,
  ) => {
    const epsU = 0.0005;
    const epsV = 0.0005;
    let u0 = px / texW + epsU;
    let u1 = (px + pw) / texW - epsU;
    if (flipX) {
      const tmp = u0;
      u0 = u1;
      u1 = tmp;
    }
    const vTop = 1 - py / texH - epsV;
    const vBot = 1 - (py + ph) / texH + epsV;

    const base = faceIndex * 4;
    // BoxGeometry vertex order per face: 0=top-left, 1=top-right, 2=bottom-left, 3=bottom-right
    uvAttr.setXY(base + 0, u0, vTop);
    uvAttr.setXY(base + 1, u1, vTop);
    uvAttr.setXY(base + 2, u0, vBot);
    uvAttr.setXY(base + 3, u1, vBot);
  };

  // +X (Character's left side)
  mapFace(0, ox + d + w, oy + d, d, h);
  // -X (Character's right side)
  mapFace(1, ox, oy + d, d, h);
  // +Y (Top)
  mapFace(2, ox + d, oy, w, d);
  // -Y (Bottom)
  mapFace(3, ox + d + w, oy, w, d);
  // +Z (Front)
  mapFace(4, ox + d, oy + d, w, h);
  // -Z (Back)
  mapFace(5, ox + d + w + d, oy + d, w, h);

  uvAttr.needsUpdate = true;
}

/**
 * UV mapper for a vertically split upper/lower half of a Minecraft limb or torso
 * so bendable elbows, knees, and spine keep seamless skin textures.
 */
export function applyMinecraftSubBoxUVs(
  geometry: THREE.BoxGeometry,
  ox: number,
  oy: number,
  w: number,
  fullH: number,
  d: number,
  segment: 'upper' | 'lower',
  texW = 64,
  texH = 64,
) {
  const uvAttr = geometry.attributes.uv;
  if (!uvAttr) return;

  const halfH = fullH / 2;
  const sideY = segment === 'upper' ? oy + d : oy + d + halfH;

  const mapFace = (
    faceIndex: number,
    px: number,
    py: number,
    pw: number,
    ph: number,
  ) => {
    const epsU = 0.0005;
    const epsV = 0.0005;
    const u0 = px / texW + epsU;
    const u1 = (px + pw) / texW - epsU;
    const vTop = 1 - py / texH - epsV;
    const vBot = 1 - (py + ph) / texH + epsV;
    const base = faceIndex * 4;
    uvAttr.setXY(base + 0, u0, vTop);
    uvAttr.setXY(base + 1, u1, vTop);
    uvAttr.setXY(base + 2, u0, vBot);
    uvAttr.setXY(base + 3, u1, vBot);
  };

  // +X (Character left)
  mapFace(0, ox + d + w, sideY, d, halfH);
  // -X (Character right)
  mapFace(1, ox, sideY, d, halfH);
  // +Y (Top)
  if (segment === 'upper') {
    mapFace(2, ox + d, oy, w, d);
  } else {
    mapFace(2, ox + d, oy + d + halfH, w, 1);
  }
  // -Y (Bottom)
  if (segment === 'lower') {
    mapFace(3, ox + d + w, oy, w, d);
  } else {
    mapFace(3, ox + d, oy + d + halfH - 1, w, 1);
  }
  // +Z (Front)
  mapFace(4, ox + d, sideY, w, halfH);
  // -Z (Back)
  mapFace(5, ox + d + w + d, sideY, w, halfH);

  uvAttr.needsUpdate = true;
}

/**
 * Normalizes any uploaded 64x32 legacy skin or 64x64 modern skin (or HD 128x128 scaled down/preserved)
 * onto a crisp 64x64 canvas, and auto-detects slim (Alex) vs classic (Steve) arms.
 */
export function normalizeSkinImage(img: HTMLImageElement): {
  canvas: HTMLCanvasElement;
  detectedModel: SkinModelType;
  dataUrl: string;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const isLegacy64x32 = img.width === img.height * 2;
  if (isLegacy64x32) {
    // Draw top half
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, 64, 32);

    // Mirror Right Leg (0,16,16,16) -> Left Leg (16,48,16,16)
    copyRegion(ctx, 4, 16, 4, 4, 20, 48); // Top
    copyRegion(ctx, 8, 16, 4, 4, 24, 48); // Bottom
    copyRegion(ctx, 0, 20, 4, 12, 24, 52); // Outer -> Left
    copyRegion(ctx, 4, 20, 4, 12, 20, 52); // Front
    copyRegion(ctx, 8, 20, 4, 12, 16, 52); // Inner -> Right
    copyRegion(ctx, 12, 20, 4, 12, 28, 52); // Back

    // Mirror Right Arm (40,16,16,16) -> Left Arm (32,48,16,16)
    copyRegion(ctx, 44, 16, 4, 4, 36, 48); // Top
    copyRegion(ctx, 48, 16, 4, 4, 40, 48); // Bottom
    copyRegion(ctx, 40, 20, 4, 12, 40, 52); // Outer
    copyRegion(ctx, 44, 20, 4, 12, 36, 52); // Front
    copyRegion(ctx, 48, 20, 4, 12, 32, 52); // Inner
    copyRegion(ctx, 52, 20, 4, 12, 44, 52); // Back
  } else {
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, 64, 64);
  }

  // Detect slim arms by checking pixel transparency at x=54..55, y=20..31
  let transparentCount = 0;
  const armSample = ctx.getImageData(54, 20, 2, 12).data;
  for (let i = 3; i < armSample.length; i += 4) {
    if (armSample[i] < 128) transparentCount++;
  }
  const detectedModel: SkinModelType = transparentCount >= 18 ? 'slim' : 'classic';

  return {
    canvas,
    detectedModel,
    dataUrl: canvas.toDataURL('image/png'),
  };
}

function copyRegion(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
) {
  ctx.drawImage(ctx.canvas, sx, sy, sw, sh, dx, dy, sw, sh);
}

export function createSkinTextureFromCanvas(
  canvas: HTMLCanvasElement,
  anisotropy = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode skin image.'));
    img.src = dataUrl;
  });
}

// ---------- Procedural Built-In Minecraft Skin Presets ----------

function fillBoxRegion(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  w: number,
  h: number,
  d: number,
  colors: {
    base: string;
    shade?: string;
    highlight?: string;
  },
) {
  const { base, shade = base, highlight = base } = colors;
  // Top
  ctx.fillStyle = highlight;
  ctx.fillRect(ox + d, oy, w, d);
  // Bottom
  ctx.fillStyle = shade;
  ctx.fillRect(ox + d + w, oy, w, d);
  // Right (-X)
  ctx.fillStyle = shade;
  ctx.fillRect(ox, oy + d, d, h);
  // Front (+Z)
  ctx.fillStyle = base;
  ctx.fillRect(ox + d, oy + d, w, h);
  // Left (+X)
  ctx.fillStyle = shade;
  ctx.fillRect(ox + d + w, oy + d, d, h);
  // Back (-Z)
  ctx.fillStyle = shade;
  ctx.fillRect(ox + d + w + d, oy + d, w, h);
}

function addPixelNoise(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 0.08,
) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const seed = Math.sin(px * 12.9898 + py * 78.233) * 43758.5453;
      const frac = seed - Math.floor(seed);
      if (frac > 0.65) {
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(px, py, 1, 1);
      } else if (frac < 0.35) {
        ctx.fillStyle = `rgba(0,0,0,${alpha})`;
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }
}

function buildPresetSkin(
  palette: {
    skin: string;
    skinShade: string;
    hair: string;
    eye: string;
    shirt: string;
    shirtShade: string;
    pants: string;
    pantsShade: string;
    shoes: string;
    accent: string;
    visor?: boolean;
  },
  slim = false,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);

  // Head (8x8x8 at 0,0)
  fillBoxRegion(ctx, 0, 0, 8, 8, 8, {
    base: palette.skin,
    shade: palette.skinShade,
    highlight: palette.hair,
  });
  // Hair on top, back, sides
  ctx.fillStyle = palette.hair;
  ctx.fillRect(8, 0, 8, 8); // top
  ctx.fillRect(24, 8, 8, 8); // back
  ctx.fillRect(0, 8, 8, 3); // right side top
  ctx.fillRect(16, 8, 8, 3); // left side top
  ctx.fillRect(8, 8, 8, 2); // forehead bangs
  ctx.fillRect(8, 10, 1, 1);
  ctx.fillRect(15, 10, 1, 1);
  // Eyes & mouth on front face (8,8 -> 16,16)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(9, 12, 2, 1);
  ctx.fillRect(13, 12, 2, 1);
  ctx.fillStyle = palette.eye;
  ctx.fillRect(10, 12, 1, 1);
  ctx.fillRect(13, 12, 1, 1);
  ctx.fillStyle = palette.skinShade;
  ctx.fillRect(11, 13, 2, 1); // nose
  ctx.fillRect(11, 15, 2, 1); // mouth

  // Torso (8x12x4 at 16,16)
  fillBoxRegion(ctx, 16, 16, 8, 12, 4, {
    base: palette.shirt,
    shade: palette.shirtShade,
    highlight: palette.shirt,
  });
  // Collar & belt accent
  ctx.fillStyle = palette.skin;
  ctx.fillRect(22, 20, 4, 1);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(16, 30, 24, 1);
  ctx.fillStyle = '#e4e4e7';
  ctx.fillRect(23, 30, 2, 1);

  const armW = slim ? 3 : 4;
  // Right Arm (at 40,16) & Left Arm (at 32,48)
  for (const [ax, ay] of [
    [40, 16],
    [32, 48],
  ]) {
    fillBoxRegion(ctx, ax, ay, armW, 12, 4, {
      base: palette.skin,
      shade: palette.skinShade,
      highlight: palette.shirt,
    });
    // Sleeve top 4px
    ctx.fillStyle = palette.shirt;
    ctx.fillRect(ax, ay + 4, armW * 2 + 8, 4);
    ctx.fillStyle = palette.shirtShade;
    ctx.fillRect(ax + armW + 4, ay + 4, 4, 4);
    // Wristband accent
    ctx.fillStyle = palette.accent;
    ctx.fillRect(ax, ay + 13, armW * 2 + 8, 1);
  }

  // Right Leg (at 0,16) & Left Leg (at 16,48)
  for (const [lx, ly] of [
    [0, 16],
    [16, 48],
  ]) {
    fillBoxRegion(ctx, lx, ly, 4, 12, 4, {
      base: palette.pants,
      shade: palette.pantsShade,
      highlight: palette.pantsShade,
    });
    // Shoes bottom 2px
    ctx.fillStyle = palette.shoes;
    ctx.fillRect(lx, ly + 14, 16, 2);
  }

  // 2nd Layer Jacket / Helmet detail
  if (palette.visor) {
    // Cool 2nd-layer helmet rim / visor at (32, 0)
    ctx.fillStyle = palette.accent;
    ctx.fillRect(40, 8, 8, 2); // front brow
    ctx.fillRect(32, 8, 8, 2);
    ctx.fillRect(48, 8, 8, 2);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
    ctx.fillRect(41, 11, 6, 2); // translucent tactical visor
  } else {
    // Subtle 2nd-layer hair locks & jacket hem
    ctx.fillStyle = palette.hair;
    ctx.fillRect(40, 8, 8, 2);
    ctx.fillRect(40, 10, 2, 1);
    ctx.fillRect(46, 10, 2, 1);
  }

  addPixelNoise(ctx, 0, 0, 64, 32, 0.06);
  addPixelNoise(ctx, 16, 48, 32, 16, 0.06);

  return canvas.toDataURL('image/png');
}

export function getDefaultSkinPresets(): SkinPreset[] {
  return [
    {
      id: 'steve',
      name: 'Steve Classic',
      modelType: 'classic',
      dataUrl: buildPresetSkin({
        skin: '#d29e7b',
        skinShade: '#b8825e',
        hair: '#3b2414',
        eye: '#3b5bdb',
        shirt: '#17a2b8',
        shirtShade: '#117a8b',
        pants: '#2b3a8c',
        pantsShade: '#1f2a66',
        shoes: '#4b5563',
        accent: '#f59e0b',
      }),
    },
    {
      id: 'alex',
      name: 'Alex Explorer',
      modelType: 'slim',
      dataUrl: buildPresetSkin(
        {
          skin: '#f0c4a0',
          skinShade: '#d4a37c',
          hair: '#d96b27',
          eye: '#10b981',
          shirt: '#4d7c2b',
          shirtShade: '#3a5e20',
          pants: '#5c4033',
          pantsShade: '#422d24',
          shoes: '#27272a',
          accent: '#84cc16',
        },
        true,
      ),
    },
    {
      id: 'knight',
      name: 'Nether Striker',
      modelType: 'classic',
      dataUrl: buildPresetSkin({
        skin: '#c48f6c',
        skinShade: '#9e6c4c',
        hair: '#18181b',
        eye: '#ef4444',
        shirt: '#3f3f46',
        shirtShade: '#27272a',
        pants: '#18181b',
        pantsShade: '#09090b',
        shoes: '#71717a',
        accent: '#f97316',
        visor: true,
      }),
    },
    {
      id: 'emerald',
      name: 'Jade Sentinel',
      modelType: 'classic',
      dataUrl: buildPresetSkin({
        skin: '#e5b899',
        skinShade: '#c69574',
        hair: '#0f172a',
        eye: '#10b981',
        shirt: '#1e293b',
        shirtShade: '#0f172a',
        pants: '#334155',
        pantsShade: '#1e293b',
        shoes: '#0f172a',
        accent: '#10b981',
        visor: true,
      }),
    },
  ];
}
