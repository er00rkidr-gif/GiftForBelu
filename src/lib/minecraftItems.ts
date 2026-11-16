import * as THREE from 'three';

export type ItemCategory =
  | 'Weapons & Combat'
  | 'Tools'
  | 'Food & Potions'
  | 'Treasures & Materials'
  | 'Utility & Redstone'
  | 'Blocks';

export interface MinecraftItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  style: 'tool' | 'handheld' | 'block' | 'shield' | 'bow' | 'trident';
  metalness?: number;
  roughness?: number;
  lightColor?: number;
  emissiveColor?: number;
  iconUrl: string;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

type TierPalette = {
  prefix: string;
  namePrefix: string;
  main: string;
  light: string;
  dark: string;
  metalness: number;
  roughness: number;
};

const TIERS: TierPalette[] = [
  { prefix: 'wooden', namePrefix: 'Wooden', main: '#9c7444', light: '#bd9058', dark: '#6b4c28', metalness: 0.04, roughness: 0.85 },
  { prefix: 'stone', namePrefix: 'Stone', main: '#8a8a8a', light: '#a8a8a8', dark: '#5e5e5e', metalness: 0.08, roughness: 0.88 },
  { prefix: 'iron', namePrefix: 'Iron', main: '#d8dde3', light: '#f4f7fa', dark: '#9aa3ad', metalness: 0.82, roughness: 0.28 },
  { prefix: 'golden', namePrefix: 'Golden', main: '#facc15', light: '#fef08a', dark: '#ca8a04', metalness: 0.88, roughness: 0.22 },
  { prefix: 'diamond', namePrefix: 'Diamond', main: '#22d3ee', light: '#a5f3fc', dark: '#0891b2', metalness: 0.48, roughness: 0.22 },
  { prefix: 'netherite', namePrefix: 'Netherite', main: '#4c444d', light: '#716773', dark: '#2c262d', metalness: 0.72, roughness: 0.35 },
];

const px = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

const HANDLE_BROWN = '#6e4a27';
const HANDLE_DARK = '#4d3218';

function drawSword(ctx: CanvasRenderingContext2D, t: TierPalette) {
  // Handle & pommel
  px(ctx, 2, 13, t.dark, 2, 2);
  px(ctx, 3, 12, HANDLE_BROWN);
  px(ctx, 4, 11, HANDLE_DARK);
  // Crossguard
  px(ctx, 3, 9, t.dark, 2, 1);
  px(ctx, 5, 10, t.main, 1, 2);
  px(ctx, 6, 11, t.dark, 1, 2);
  px(ctx, 4, 10, t.light);
  // Blade diagonal
  for (let i = 0; i < 8; i++) {
    const bx = 6 + i;
    const by = 9 - i;
    px(ctx, bx, by, t.main);
    px(ctx, bx - 1, by, t.light);
    px(ctx, bx, by + 1, t.dark);
  }
  px(ctx, 13, 1, t.light, 2, 2);
  px(ctx, 14, 1, t.main);
}

function drawPickaxe(ctx: CanvasRenderingContext2D, t: TierPalette) {
  for (let i = 0; i < 10; i++) {
    px(ctx, 2 + i, 13 - i, i % 2 === 0 ? HANDLE_BROWN : HANDLE_DARK);
  }
  // Curved pick head
  px(ctx, 5, 2, t.light, 5, 2);
  px(ctx, 10, 3, t.main, 2, 2);
  px(ctx, 12, 4, t.main, 1, 3);
  px(ctx, 13, 6, t.dark, 1, 4);
  px(ctx, 11, 5, t.dark);
  px(ctx, 10, 3, t.light);
  px(ctx, 4, 3, t.dark, 2, 1);
}

function drawAxe(ctx: CanvasRenderingContext2D, t: TierPalette) {
  for (let i = 0; i < 11; i++) {
    px(ctx, 2 + i, 13 - i, i % 2 === 0 ? HANDLE_BROWN : HANDLE_DARK);
  }
  px(ctx, 9, 2, t.light, 4, 3);
  px(ctx, 8, 4, t.main, 4, 3);
  px(ctx, 11, 5, t.dark, 2, 3);
  px(ctx, 12, 2, t.main, 2, 3);
}

function drawShovel(ctx: CanvasRenderingContext2D, t: TierPalette) {
  for (let i = 0; i < 9; i++) {
    px(ctx, 2 + i, 13 - i, i % 2 === 0 ? HANDLE_BROWN : HANDLE_DARK);
  }
  px(ctx, 10, 2, t.light, 3, 3);
  px(ctx, 11, 1, t.main, 3, 3);
  px(ctx, 12, 2, t.dark, 2, 3);
  px(ctx, 13, 1, t.light);
}

function drawHoe(ctx: CanvasRenderingContext2D, t: TierPalette) {
  for (let i = 0; i < 10; i++) {
    px(ctx, 2 + i, 13 - i, i % 2 === 0 ? HANDLE_BROWN : HANDLE_DARK);
  }
  px(ctx, 7, 2, t.light, 6, 2);
  px(ctx, 12, 3, t.main, 2, 3);
  px(ctx, 11, 4, t.dark);
}

function createItemRegistry(): MinecraftItemDef[] {
  const defs: Omit<MinecraftItemDef, 'iconUrl'>[] = [];

  // 1. All 6 Tool/Weapon Tiers (30 items)
  for (const t of TIERS) {
    defs.push({
      id: `${t.prefix}_sword`,
      name: `${t.namePrefix} Sword`,
      category: 'Weapons & Combat',
      style: 'tool',
      metalness: t.metalness,
      roughness: t.roughness,
      draw: (c) => drawSword(c, t),
    });
    defs.push({
      id: `${t.prefix}_pickaxe`,
      name: `${t.namePrefix} Pickaxe`,
      category: 'Tools',
      style: 'tool',
      metalness: t.metalness,
      roughness: t.roughness,
      draw: (c) => drawPickaxe(c, t),
    });
    defs.push({
      id: `${t.prefix}_axe`,
      name: `${t.namePrefix} Axe`,
      category: 'Tools',
      style: 'tool',
      metalness: t.metalness,
      roughness: t.roughness,
      draw: (c) => drawAxe(c, t),
    });
    defs.push({
      id: `${t.prefix}_shovel`,
      name: `${t.namePrefix} Shovel`,
      category: 'Tools',
      style: 'tool',
      metalness: t.metalness,
      roughness: t.roughness,
      draw: (c) => drawShovel(c, t),
    });
    defs.push({
      id: `${t.prefix}_hoe`,
      name: `${t.namePrefix} Hoe`,
      category: 'Tools',
      style: 'tool',
      metalness: t.metalness,
      roughness: t.roughness,
      draw: (c) => drawHoe(c, t),
    });
  }

  // 2. Specialized Combat & Ranged Weapons
  defs.push(
    {
      id: 'bow',
      name: 'Bow',
      category: 'Weapons & Combat',
      style: 'bow',
      draw: (c) => {
        px(c, 4, 2, HANDLE_BROWN, 2, 2);
        px(c, 6, 3, HANDLE_BROWN, 2, 2);
        px(c, 8, 5, HANDLE_DARK, 2, 2);
        px(c, 9, 7, HANDLE_BROWN, 2, 2);
        px(c, 8, 9, HANDLE_DARK, 2, 2);
        px(c, 6, 11, HANDLE_BROWN, 2, 2);
        px(c, 4, 12, HANDLE_BROWN, 2, 2);
        // Bowstring
        px(c, 4, 3, '#e2e8f0', 1, 10);
      },
    },
    {
      id: 'crossbow',
      name: 'Crossbow',
      category: 'Weapons & Combat',
      style: 'bow',
      metalness: 0.45,
      draw: (c) => {
        px(c, 3, 12, HANDLE_BROWN, 3, 2);
        px(c, 5, 10, HANDLE_DARK, 3, 2);
        px(c, 7, 8, '#64748b', 3, 2);
        px(c, 9, 6, HANDLE_BROWN, 3, 2);
        px(c, 4, 4, '#64748b', 2, 3);
        px(c, 10, 9, '#64748b', 3, 2);
        px(c, 5, 5, '#cbd5e1', 6, 1);
      },
    },
    {
      id: 'trident',
      name: 'Trident',
      category: 'Weapons & Combat',
      style: 'trident',
      metalness: 0.55,
      roughness: 0.25,
      draw: (c) => {
        for (let i = 0; i < 11; i++) px(c, 2 + i, 13 - i, '#2dd4bf');
        px(c, 10, 2, '#99f6e4', 2, 3);
        px(c, 13, 2, '#99f6e4', 2, 2);
        px(c, 11, 5, '#99f6e4', 3, 2);
        px(c, 9, 1, '#f0fdfa');
        px(c, 14, 1, '#f0fdfa');
        px(c, 14, 6, '#f0fdfa');
      },
    },
    {
      id: 'mace',
      name: 'Mace',
      category: 'Weapons & Combat',
      style: 'tool',
      metalness: 0.7,
      roughness: 0.3,
      draw: (c) => {
        for (let i = 0; i < 8; i++) px(c, 2 + i, 13 - i, '#38bdf8');
        px(c, 9, 2, '#475569', 5, 5);
        px(c, 10, 3, '#94a3b8', 3, 3);
        px(c, 11, 3, '#38bdf8', 2, 2);
      },
    },
    {
      id: 'shield',
      name: 'Shield',
      category: 'Weapons & Combat',
      style: 'shield',
      metalness: 0.5,
      roughness: 0.45,
      draw: (c) => {
        px(c, 3, 1, '#94a3b8', 10, 14);
        px(c, 4, 2, '#9c7444', 8, 12);
        px(c, 5, 3, '#bd9058', 6, 10);
        px(c, 7, 5, '#cbd5e1', 2, 6);
      },
    },
    {
      id: 'arrow',
      name: 'Arrow',
      category: 'Weapons & Combat',
      style: 'tool',
      draw: (c) => {
        for (let i = 0; i < 10; i++) px(c, 3 + i, 12 - i, HANDLE_BROWN);
        px(c, 11, 2, '#cbd5e1', 3, 3);
        px(c, 2, 11, '#f8fafc', 2, 3);
        px(c, 3, 13, '#e2e8f0', 2, 1);
      },
    },
    {
      id: 'spectral_arrow',
      name: 'Spectral Arrow',
      category: 'Weapons & Combat',
      style: 'tool',
      emissiveColor: 0xfacc15,
      draw: (c) => {
        for (let i = 0; i < 10; i++) px(c, 3 + i, 12 - i, '#fde047');
        px(c, 11, 2, '#facc15', 3, 3);
        px(c, 2, 11, '#fef08a', 2, 3);
      },
    },
    {
      id: 'fire_charge',
      name: 'Fire Charge',
      category: 'Weapons & Combat',
      style: 'handheld',
      emissiveColor: 0xf97316,
      lightColor: 0xf97316,
      draw: (c) => {
        px(c, 4, 4, '#7c2d12', 8, 8);
        px(c, 5, 3, '#ea580c', 6, 10);
        px(c, 5, 5, '#f97316', 6, 6);
        px(c, 6, 6, '#fde047', 4, 4);
      },
    },
    {
      id: 'wind_charge',
      name: 'Wind Charge',
      category: 'Weapons & Combat',
      style: 'handheld',
      emissiveColor: 0xbae6fd,
      draw: (c) => {
        px(c, 4, 4, '#94a3b8', 8, 8);
        px(c, 5, 5, '#e0f2fe', 6, 6);
        px(c, 6, 6, '#f8fafc', 4, 4);
      },
    },
    {
      id: 'snowball',
      name: 'Snowball',
      category: 'Weapons & Combat',
      style: 'handheld',
      draw: (c) => {
        px(c, 4, 4, '#cbd5e1', 8, 8);
        px(c, 5, 3, '#e2e8f0', 6, 10);
        px(c, 5, 5, '#ffffff', 5, 5);
      },
    },
    {
      id: 'totem_of_undying',
      name: 'Totem of Undying',
      category: 'Weapons & Combat',
      style: 'handheld',
      metalness: 0.78,
      roughness: 0.25,
      emissiveColor: 0xf59e0b,
      draw: (c) => {
        px(c, 5, 2, '#facc15', 6, 5);
        px(c, 6, 3, '#10b981', 1, 1);
        px(c, 9, 3, '#10b981', 1, 1);
        px(c, 2, 6, '#eab308', 12, 3);
        px(c, 5, 7, '#facc15', 6, 6);
        px(c, 6, 13, '#ca8a04', 4, 2);
      },
    },
  );

  // 3. Utility, Light & Redstone
  defs.push(
    {
      id: 'torch',
      name: 'Torch',
      category: 'Utility & Redstone',
      style: 'tool',
      lightColor: 0xffa94d,
      emissiveColor: 0xf59e0b,
      draw: (c) => {
        for (let i = 0; i < 8; i++) px(c, 4 + i, 12 - i, HANDLE_BROWN, 2, 2);
        px(c, 11, 3, '#f97316', 3, 3);
        px(c, 12, 2, '#fde047', 2, 2);
      },
    },
    {
      id: 'soul_torch',
      name: 'Soul Torch',
      category: 'Utility & Redstone',
      style: 'tool',
      lightColor: 0x22d3ee,
      emissiveColor: 0x06b6d4,
      draw: (c) => {
        for (let i = 0; i < 8; i++) px(c, 4 + i, 12 - i, '#422c1b', 2, 2);
        px(c, 11, 3, '#06b6d4', 3, 3);
        px(c, 12, 2, '#a5f3fc', 2, 2);
      },
    },
    {
      id: 'lantern',
      name: 'Lantern',
      category: 'Utility & Redstone',
      style: 'handheld',
      lightColor: 0xfbbf24,
      emissiveColor: 0xf59e0b,
      draw: (c) => {
        px(c, 6, 1, '#334155', 4, 2);
        px(c, 4, 3, '#1e293b', 8, 2);
        px(c, 4, 5, '#334155', 8, 9);
        px(c, 5, 6, '#f59e0b', 6, 6);
        px(c, 6, 7, '#fef08a', 4, 4);
      },
    },
    {
      id: 'soul_lantern',
      name: 'Soul Lantern',
      category: 'Utility & Redstone',
      style: 'handheld',
      lightColor: 0x38bdf8,
      emissiveColor: 0x22d3ee,
      draw: (c) => {
        px(c, 6, 1, '#1e293b', 4, 2);
        px(c, 4, 3, '#0f172a', 8, 2);
        px(c, 4, 5, '#1e293b', 8, 9);
        px(c, 5, 6, '#06b6d4', 6, 6);
        px(c, 6, 7, '#a5f3fc', 4, 4);
      },
    },
    {
      id: 'flint_and_steel',
      name: 'Flint and Steel',
      category: 'Utility & Redstone',
      style: 'handheld',
      metalness: 0.7,
      draw: (c) => {
        px(c, 3, 5, '#cbd5e1', 5, 7);
        px(c, 4, 6, '#94a3b8', 3, 5);
        px(c, 8, 7, '#334155', 5, 5);
        px(c, 9, 4, '#f97316', 2, 2);
      },
    },
    {
      id: 'fishing_rod',
      name: 'Fishing Rod',
      category: 'Utility & Redstone',
      style: 'tool',
      draw: (c) => {
        for (let i = 0; i < 11; i++) px(c, 2 + i, 13 - i, HANDLE_BROWN);
        px(c, 13, 3, '#e2e8f0', 1, 7);
        px(c, 12, 10, '#94a3b8', 2, 2);
      },
    },
    {
      id: 'spyglass',
      name: 'Spyglass',
      category: 'Utility & Redstone',
      style: 'tool',
      metalness: 0.75,
      draw: (c) => {
        for (let i = 0; i < 4; i++) px(c, 3 + i, 12 - i, '#c2410c', 2, 2);
        for (let i = 4; i < 8; i++) px(c, 3 + i, 12 - i, '#eab308', 2, 2);
        px(c, 11, 3, '#38bdf8', 3, 3);
      },
    },
    {
      id: 'compass',
      name: 'Compass',
      category: 'Utility & Redstone',
      style: 'handheld',
      metalness: 0.7,
      draw: (c) => {
        px(c, 4, 3, '#64748b', 8, 10);
        px(c, 3, 5, '#64748b', 10, 6);
        px(c, 5, 5, '#1e293b', 6, 6);
        px(c, 7, 5, '#ef4444', 2, 3);
        px(c, 7, 8, '#f8fafc', 2, 3);
      },
    },
    {
      id: 'clock',
      name: 'Clock',
      category: 'Utility & Redstone',
      style: 'handheld',
      metalness: 0.85,
      draw: (c) => {
        px(c, 4, 3, '#eab308', 8, 10);
        px(c, 3, 5, '#eab308', 10, 6);
        px(c, 5, 5, '#1e3a8a', 6, 6);
        px(c, 5, 8, '#4ade80', 6, 3);
        px(c, 7, 5, '#fde047', 2, 2);
      },
    },
    {
      id: 'shears',
      name: 'Shears',
      category: 'Utility & Redstone',
      style: 'tool',
      metalness: 0.8,
      draw: (c) => {
        px(c, 3, 9, '#94a3b8', 4, 4);
        px(c, 6, 6, '#cbd5e1', 5, 5);
        px(c, 9, 3, '#e2e8f0', 4, 4);
        px(c, 4, 10, '#1e293b', 2, 2);
      },
    },
    {
      id: 'bucket',
      name: 'Bucket',
      category: 'Utility & Redstone',
      style: 'handheld',
      metalness: 0.85,
      draw: (c) => {
        px(c, 4, 4, '#cbd5e1', 8, 9);
        px(c, 5, 5, '#94a3b8', 6, 2);
        px(c, 3, 4, '#e2e8f0', 10, 2);
      },
    },
    {
      id: 'water_bucket',
      name: 'Water Bucket',
      category: 'Utility & Redstone',
      style: 'handheld',
      metalness: 0.75,
      draw: (c) => {
        px(c, 4, 4, '#cbd5e1', 8, 9);
        px(c, 4, 4, '#3b82f6', 8, 3);
        px(c, 5, 5, '#60a5fa', 6, 2);
      },
    },
    {
      id: 'lava_bucket',
      name: 'Lava Bucket',
      category: 'Utility & Redstone',
      style: 'handheld',
      metalness: 0.65,
      lightColor: 0xf97316,
      emissiveColor: 0xea580c,
      draw: (c) => {
        px(c, 4, 4, '#cbd5e1', 8, 9);
        px(c, 4, 4, '#ea580c', 8, 3);
        px(c, 5, 5, '#facc15', 5, 2);
      },
    },
    {
      id: 'ender_pearl',
      name: 'Ender Pearl',
      category: 'Utility & Redstone',
      style: 'handheld',
      emissiveColor: 0x0d9488,
      draw: (c) => {
        px(c, 4, 4, '#0f766e', 8, 8);
        px(c, 5, 3, '#14b8a6', 6, 10);
        px(c, 6, 5, '#5eead4', 3, 3);
      },
    },
    {
      id: 'eye_of_ender',
      name: 'Eye of Ender',
      category: 'Utility & Redstone',
      style: 'handheld',
      emissiveColor: 0x10b981,
      draw: (c) => {
        px(c, 4, 4, '#0f766e', 8, 8);
        px(c, 5, 3, '#10b981', 6, 10);
        px(c, 7, 5, '#bef264', 2, 6);
        px(c, 7, 7, '#09090b', 2, 2);
      },
    },
    {
      id: 'blaze_rod',
      name: 'Blaze Rod',
      category: 'Utility & Redstone',
      style: 'tool',
      lightColor: 0xf59e0b,
      emissiveColor: 0xf59e0b,
      draw: (c) => {
        for (let i = 0; i < 11; i++) {
          px(c, 2 + i, 13 - i, i % 3 === 0 ? '#fef08a' : '#f59e0b', 2, 2);
        }
      },
    },
    {
      id: 'breeze_rod',
      name: 'Breeze Rod',
      category: 'Utility & Redstone',
      style: 'tool',
      emissiveColor: 0x38bdf8,
      draw: (c) => {
        for (let i = 0; i < 11; i++) {
          px(c, 2 + i, 13 - i, i % 3 === 0 ? '#e0f2fe' : '#6366f1', 2, 2);
        }
      },
    },
    {
      id: 'bone',
      name: 'Bone',
      category: 'Utility & Redstone',
      style: 'tool',
      draw: (c) => {
        for (let i = 0; i < 9; i++) px(c, 3 + i, 11 - i, '#f1f5f9', 2, 2);
        px(c, 2, 11, '#e2e8f0', 3, 3);
        px(c, 11, 2, '#e2e8f0', 3, 3);
      },
    },
    {
      id: 'stick',
      name: 'Stick',
      category: 'Utility & Redstone',
      style: 'tool',
      draw: (c) => {
        for (let i = 0; i < 11; i++) px(c, 2 + i, 13 - i, i % 2 === 0 ? HANDLE_BROWN : HANDLE_DARK);
      },
    },
    {
      id: 'book',
      name: 'Book',
      category: 'Utility & Redstone',
      style: 'handheld',
      draw: (c) => {
        px(c, 3, 3, '#78350f', 10, 11);
        px(c, 4, 4, '#92400e', 8, 9);
        px(c, 5, 11, '#f8fafc', 7, 2);
      },
    },
    {
      id: 'enchanted_book',
      name: 'Enchanted Book',
      category: 'Utility & Redstone',
      style: 'handheld',
      emissiveColor: 0xa855f7,
      draw: (c) => {
        px(c, 3, 3, '#7e22ce', 10, 11);
        px(c, 4, 4, '#a855f7', 8, 9);
        px(c, 6, 7, '#ef4444', 5, 2);
        px(c, 5, 11, '#fde047', 7, 2);
      },
    },
    {
      id: 'redstone_dust',
      name: 'Redstone Dust',
      category: 'Utility & Redstone',
      style: 'handheld',
      emissiveColor: 0xdc2626,
      draw: (c) => {
        px(c, 4, 6, '#991b1b', 8, 6);
        px(c, 5, 4, '#ef4444', 6, 7);
        px(c, 7, 6, '#fca5a5', 2, 2);
      },
    },
    {
      id: 'feather',
      name: 'Feather',
      category: 'Utility & Redstone',
      style: 'tool',
      draw: (c) => {
        for (let i = 0; i < 10; i++) px(c, 3 + i, 12 - i, '#e2e8f0');
        px(c, 6, 4, '#f8fafc', 6, 5);
        px(c, 8, 2, '#f8fafc', 5, 4);
      },
    },
  );

  // 4. Food & Potions
  defs.push(
    {
      id: 'apple',
      name: 'Apple',
      category: 'Food & Potions',
      style: 'handheld',
      draw: (c) => {
        px(c, 7, 2, HANDLE_BROWN, 2, 2);
        px(c, 4, 4, '#dc2626', 8, 9);
        px(c, 3, 5, '#dc2626', 10, 6);
        px(c, 5, 5, '#f87171', 2, 2);
      },
    },
    {
      id: 'golden_apple',
      name: 'Golden Apple',
      category: 'Food & Potions',
      style: 'handheld',
      metalness: 0.8,
      emissiveColor: 0xfacc15,
      draw: (c) => {
        px(c, 7, 2, HANDLE_BROWN, 2, 2);
        px(c, 4, 4, '#eab308', 8, 9);
        px(c, 3, 5, '#facc15', 10, 6);
        px(c, 5, 5, '#fef08a', 2, 2);
      },
    },
    {
      id: 'cooked_steak',
      name: 'Cooked Steak',
      category: 'Food & Potions',
      style: 'handheld',
      draw: (c) => {
        px(c, 3, 5, '#7c2d12', 10, 7);
        px(c, 4, 4, '#9a3412', 8, 8);
        px(c, 6, 6, '#d97706', 4, 3);
      },
    },
    {
      id: 'bread',
      name: 'Bread',
      category: 'Food & Potions',
      style: 'handheld',
      draw: (c) => {
        px(c, 3, 6, '#b45309', 10, 5);
        px(c, 4, 5, '#d97706', 8, 5);
        px(c, 5, 6, '#fbbf24', 5, 2);
      },
    },
    {
      id: 'carrot',
      name: 'Carrot',
      category: 'Food & Potions',
      style: 'tool',
      draw: (c) => {
        px(c, 10, 2, '#16a34a', 4, 4);
        for (let i = 0; i < 8; i++) px(c, 3 + i, 12 - i, '#f97316', 2, 2);
      },
    },
    {
      id: 'golden_carrot',
      name: 'Golden Carrot',
      category: 'Food & Potions',
      style: 'tool',
      metalness: 0.8,
      draw: (c) => {
        px(c, 10, 2, '#22c55e', 4, 4);
        for (let i = 0; i < 8; i++) px(c, 3 + i, 12 - i, '#facc15', 2, 2);
      },
    },
    {
      id: 'melon_slice',
      name: 'Melon Slice',
      category: 'Food & Potions',
      style: 'handheld',
      draw: (c) => {
        px(c, 3, 9, '#16a34a', 10, 3);
        px(c, 4, 6, '#ef4444', 8, 4);
        px(c, 6, 4, '#ef4444', 4, 3);
        px(c, 6, 7, '#18181b', 1, 1);
        px(c, 9, 7, '#18181b', 1, 1);
      },
    },
    {
      id: 'cookie',
      name: 'Cookie',
      category: 'Food & Potions',
      style: 'handheld',
      draw: (c) => {
        px(c, 4, 4, '#d97706', 8, 8);
        px(c, 5, 3, '#f59e0b', 6, 10);
        px(c, 6, 6, '#451a03', 1, 1);
        px(c, 9, 5, '#451a03', 1, 1);
        px(c, 8, 9, '#451a03', 1, 1);
      },
    },
    {
      id: 'potion_healing',
      name: 'Potion of Healing',
      category: 'Food & Potions',
      style: 'handheld',
      emissiveColor: 0xf43f5e,
      draw: (c) => {
        px(c, 6, 2, '#92400e', 4, 2);
        px(c, 6, 4, '#bae6fd', 4, 2);
        px(c, 4, 6, '#e0f2fe', 8, 8);
        px(c, 5, 7, '#f43f5e', 6, 6);
        px(c, 6, 8, '#fda4af', 2, 2);
      },
    },
    {
      id: 'potion_swiftness',
      name: 'Potion of Swiftness',
      category: 'Food & Potions',
      style: 'handheld',
      emissiveColor: 0x38bdf8,
      draw: (c) => {
        px(c, 6, 2, '#92400e', 4, 2);
        px(c, 6, 4, '#bae6fd', 4, 2);
        px(c, 4, 6, '#e0f2fe', 8, 8);
        px(c, 5, 7, '#38bdf8', 6, 6);
        px(c, 6, 8, '#bae6fd', 2, 2);
      },
    },
    {
      id: 'potion_strength',
      name: 'Potion of Strength',
      category: 'Food & Potions',
      style: 'handheld',
      emissiveColor: 0x991b1b,
      draw: (c) => {
        px(c, 6, 2, '#92400e', 4, 2);
        px(c, 6, 4, '#bae6fd', 4, 2);
        px(c, 4, 6, '#e0f2fe', 8, 8);
        px(c, 5, 7, '#b91c1c', 6, 6);
        px(c, 6, 8, '#f87171', 2, 2);
      },
    },
    {
      id: 'honey_bottle',
      name: 'Honey Bottle',
      category: 'Food & Potions',
      style: 'handheld',
      draw: (c) => {
        px(c, 6, 2, '#92400e', 4, 2);
        px(c, 5, 4, '#e0f2fe', 6, 10);
        px(c, 5, 7, '#f59e0b', 6, 6);
        px(c, 6, 8, '#fde047', 3, 2);
      },
    },
  );

  // 5. Treasures, Ores & Materials
  defs.push(
    {
      id: 'diamond',
      name: 'Diamond',
      category: 'Treasures & Materials',
      style: 'handheld',
      metalness: 0.45,
      roughness: 0.15,
      emissiveColor: 0x06b6d4,
      draw: (c) => {
        px(c, 5, 3, '#22d3ee', 6, 10);
        px(c, 3, 5, '#06b6d4', 10, 6);
        px(c, 5, 5, '#a5f3fc', 4, 4);
      },
    },
    {
      id: 'emerald',
      name: 'Emerald',
      category: 'Treasures & Materials',
      style: 'handheld',
      metalness: 0.35,
      roughness: 0.18,
      emissiveColor: 0x10b981,
      draw: (c) => {
        px(c, 5, 2, '#10b981', 6, 12);
        px(c, 4, 4, '#059669', 8, 8);
        px(c, 6, 4, '#6ee7b7', 3, 5);
      },
    },
    {
      id: 'iron_ingot',
      name: 'Iron Ingot',
      category: 'Treasures & Materials',
      style: 'handheld',
      metalness: 0.85,
      roughness: 0.25,
      draw: (c) => {
        px(c, 3, 6, '#94a3b8', 10, 5);
        px(c, 4, 5, '#e2e8f0', 8, 4);
        px(c, 5, 6, '#f8fafc', 5, 2);
      },
    },
    {
      id: 'gold_ingot',
      name: 'Gold Ingot',
      category: 'Treasures & Materials',
      style: 'handheld',
      metalness: 0.9,
      roughness: 0.2,
      draw: (c) => {
        px(c, 3, 6, '#ca8a04', 10, 5);
        px(c, 4, 5, '#facc15', 8, 4);
        px(c, 5, 6, '#fef08a', 5, 2);
      },
    },
    {
      id: 'copper_ingot',
      name: 'Copper Ingot',
      category: 'Treasures & Materials',
      style: 'handheld',
      metalness: 0.85,
      roughness: 0.25,
      draw: (c) => {
        px(c, 3, 6, '#9a3412', 10, 5);
        px(c, 4, 5, '#ea580c', 8, 4);
        px(c, 5, 6, '#fb923c', 5, 2);
      },
    },
    {
      id: 'netherite_ingot',
      name: 'Netherite Ingot',
      category: 'Treasures & Materials',
      style: 'handheld',
      metalness: 0.75,
      roughness: 0.35,
      draw: (c) => {
        px(c, 3, 6, '#27272a', 10, 5);
        px(c, 4, 5, '#52525b', 8, 4);
        px(c, 5, 6, '#71717a', 5, 2);
      },
    },
    {
      id: 'coal',
      name: 'Coal',
      category: 'Treasures & Materials',
      style: 'handheld',
      draw: (c) => {
        px(c, 4, 4, '#18181b', 8, 8);
        px(c, 5, 5, '#27272a', 5, 5);
        px(c, 6, 6, '#3f3f46', 2, 2);
      },
    },
    {
      id: 'amethyst_shard',
      name: 'Amethyst Shard',
      category: 'Treasures & Materials',
      style: 'handheld',
      emissiveColor: 0xc084fc,
      draw: (c) => {
        px(c, 6, 2, '#c084fc', 4, 11);
        px(c, 5, 5, '#9333ea', 6, 8);
        px(c, 7, 3, '#f3e8ff', 2, 4);
      },
    },
    {
      id: 'nether_star',
      name: 'Nether Star',
      category: 'Treasures & Materials',
      style: 'handheld',
      lightColor: 0xfef08a,
      emissiveColor: 0xfde047,
      draw: (c) => {
        px(c, 7, 1, '#fef9c3', 2, 14);
        px(c, 1, 7, '#fef9c3', 14, 2);
        px(c, 5, 5, '#ffffff', 6, 6);
        px(c, 4, 4, '#fde047', 2, 2);
        px(c, 10, 4, '#fde047', 2, 2);
        px(c, 4, 10, '#fde047', 2, 2);
        px(c, 10, 10, '#fde047', 2, 2);
      },
    },
    {
      id: 'heart_of_the_sea',
      name: 'Heart of the Sea',
      category: 'Treasures & Materials',
      style: 'handheld',
      emissiveColor: 0x0ea5e9,
      draw: (c) => {
        px(c, 4, 4, '#0284c7', 8, 8);
        px(c, 5, 5, '#38bdf8', 6, 6);
        px(c, 6, 6, '#e0f2fe', 4, 4);
      },
    },
    {
      id: 'echo_shard',
      name: 'Echo Shard',
      category: 'Treasures & Materials',
      style: 'handheld',
      emissiveColor: 0x06b6d4,
      draw: (c) => {
        px(c, 5, 3, '#0f172a', 6, 10);
        px(c, 6, 4, '#06b6d4', 4, 7);
        px(c, 7, 5, '#67e8f9', 2, 3);
      },
    },
    {
      id: 'music_disc_pigstep',
      name: 'Music Disc Pigstep',
      category: 'Treasures & Materials',
      style: 'handheld',
      draw: (c) => {
        px(c, 3, 4, '#18181b', 10, 8);
        px(c, 4, 3, '#18181b', 8, 10);
        px(c, 6, 6, '#ef4444', 4, 4);
        px(c, 7, 7, '#facc15', 2, 2);
      },
    },
  );

  // 6. Volumetric 3D Block Items Held in Hand
  const blockDefs: Array<{ id: string; name: string; draw: (c: CanvasRenderingContext2D) => void; emissiveColor?: number }> = [
    {
      id: 'block_grass',
      name: 'Grass Block',
      draw: (c) => {
        px(c, 0, 0, '#7c5537', 16, 16);
        px(c, 0, 0, '#5ea33b', 16, 5);
        px(c, 2, 5, '#559436', 4, 2);
        px(c, 10, 5, '#559436', 4, 2);
      },
    },
    {
      id: 'block_tnt',
      name: 'TNT Block',
      draw: (c) => {
        px(c, 0, 0, '#dc2626', 16, 16);
        px(c, 0, 5, '#f8fafc', 16, 6);
        px(c, 2, 6, '#18181b', 3, 4);
        px(c, 6, 6, '#18181b', 4, 4);
        px(c, 11, 6, '#18181b', 3, 4);
      },
    },
    {
      id: 'block_diamond',
      name: 'Diamond Block',
      draw: (c) => {
        px(c, 0, 0, '#22d3ee', 16, 16);
        px(c, 2, 2, '#67e8f9', 12, 12);
        px(c, 4, 4, '#a5f3fc', 8, 8);
      },
    },
    {
      id: 'block_gold',
      name: 'Gold Block',
      draw: (c) => {
        px(c, 0, 0, '#eab308', 16, 16);
        px(c, 2, 2, '#facc15', 12, 12);
        px(c, 4, 4, '#fef08a', 8, 8);
      },
    },
    {
      id: 'block_crafting_table',
      name: 'Crafting Table',
      draw: (c) => {
        px(c, 0, 0, '#9c7444', 16, 16);
        px(c, 2, 2, '#6b4c28', 12, 12);
        px(c, 4, 4, '#bd9058', 8, 8);
        px(c, 3, 6, '#94a3b8', 3, 4);
      },
    },
    {
      id: 'block_chest',
      name: 'Chest',
      draw: (c) => {
        px(c, 0, 0, '#9c7444', 16, 16);
        px(c, 0, 0, '#4d3218', 16, 2);
        px(c, 0, 5, '#4d3218', 16, 1);
        px(c, 6, 4, '#e2e8f0', 4, 4);
      },
    },
    {
      id: 'block_obsidian',
      name: 'Obsidian',
      draw: (c) => {
        px(c, 0, 0, '#181024', 16, 16);
        px(c, 3, 3, '#2e1f47', 4, 4);
        px(c, 9, 8, '#3b2459', 4, 4);
      },
    },
    {
      id: 'block_cobblestone',
      name: 'Cobblestone',
      draw: (c) => {
        px(c, 0, 0, '#71717a', 16, 16);
        px(c, 0, 4, '#52525b', 16, 1);
        px(c, 0, 10, '#52525b', 16, 1);
        px(c, 6, 0, '#52525b', 1, 5);
        px(c, 11, 5, '#52525b', 1, 5);
      },
    },
    {
      id: 'block_glowstone',
      name: 'Glowstone',
      emissiveColor: 0xfbbf24,
      draw: (c) => {
        px(c, 0, 0, '#b45309', 16, 16);
        px(c, 2, 2, '#f59e0b', 12, 12);
        px(c, 4, 4, '#fef08a', 8, 8);
      },
    },
  ];

  for (const b of blockDefs) {
    defs.push({
      id: b.id,
      name: b.name,
      category: 'Blocks',
      style: 'block',
      emissiveColor: b.emissiveColor,
      lightColor: b.emissiveColor,
      draw: b.draw,
    });
  }

  return defs.map((d) => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 16, 16);
    d.draw(ctx);
    return {
      ...d,
      iconUrl: canvas.toDataURL('image/png'),
    };
  });
}

export const MINECRAFT_ITEMS: MinecraftItemDef[] = createItemRegistry();
export const MINECRAFT_ITEM_MAP = new Map<string, MinecraftItemDef>(
  MINECRAFT_ITEMS.map((item) => [item.id, item]),
);

/**
 * Builds an extruded 3D voxel mesh from a 16x16 pixel-art canvas (identical to Minecraft's ItemModelGenerator)
 * with greedy boundary culling and linear vertex colors.
 */
function buildExtrudedSpriteGeometry(def: MinecraftItemDef): THREE.BufferGeometry {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  def.draw(ctx);
  const data = ctx.getImageData(0, 0, 16, 16).data;

  const isOpaque = (x: number, y: number) => {
    if (x < 0 || x >= 16 || y < 0 || y >= 16) return false;
    return data[(y * 16 + x) * 4 + 3] >= 128;
  };

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const pxSize = 1 / 16;
  const halfDepth = 0.5 / 16;
  const tmpColor = new THREE.Color();

  const pushQuad = (
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    n: [number, number, number],
    r: number,
    g: number,
    b: number,
  ) => {
    const base = positions.length / 3;
    positions.push(...p0, ...p1, ...p2, ...p3);
    normals.push(...n, ...n, ...n, ...n);
    colors.push(r, g, b, r, g, b, r, g, b, r, g, b);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  for (let py = 0; py < 16; py++) {
    for (let pxX = 0; pxX < 16; pxX++) {
      if (!isOpaque(pxX, py)) continue;

      const idx = (py * 16 + pxX) * 4;
      tmpColor.setRGB(data[idx] / 255, data[idx + 1] / 255, data[idx + 2] / 255, THREE.SRGBColorSpace);
      const r = tmpColor.r;
      const g = tmpColor.g;
      const b = tmpColor.b;

      const x0 = (pxX - 8) * pxSize;
      const x1 = x0 + pxSize;
      const y1 = (8 - py) * pxSize;
      const y0 = y1 - pxSize;
      const z0 = -halfDepth;
      const z1 = halfDepth;

      // Front (+Z)
      pushQuad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], r, g, b);
      // Back (-Z)
      pushQuad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], r, g, b);

      // Left (-X)
      if (!isOpaque(pxX - 1, py)) {
        pushQuad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], r, g, b);
      }
      // Right (+X)
      if (!isOpaque(pxX + 1, py)) {
        pushQuad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], r, g, b);
      }
      // Top (+Y)
      if (!isOpaque(pxX, py - 1)) {
        pushQuad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], r, g, b);
      }
      // Bottom (-Y)
      if (!isOpaque(pxX, py + 1)) {
        pushQuad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], r, g, b);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

export function createMinecraftItemMountGroup(
  itemId: string,
  enchanted: boolean,
  isOffhand: boolean,
  characterId: string,
): THREE.Group | null {
  if (!itemId || itemId === 'none') return null;
  const def = MINECRAFT_ITEM_MAP.get(itemId);
  if (!def) return null;

  const group = new THREE.Group();
  const PX = 1 / 16;

  if (def.style === 'block') {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    def.draw(c.getContext('2d')!);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;

    const geo = new THREE.BoxGeometry(6 * PX, 6 * PX, 6 * PX);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.78,
      metalness: 0.1,
      emissive: enchanted ? new THREE.Color(0xa855f7) : new THREE.Color(def.emissiveColor ?? 0x000000),
      emissiveIntensity: enchanted ? 0.55 : def.emissiveColor ? 0.45 : 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.userData.characterId = characterId;
    mesh.userData.enchanted = enchanted;
    group.add(mesh);
    group.position.set(0, -5.5 * PX, 3.5 * PX);
    group.rotation.set(0.35, 0.65, 0);
  } else if (def.style === 'shield') {
    // True 3D volumetric Shield with wooden face, iron rim, and grip boss
    const bodyGeo = new THREE.BoxGeometry(10 * PX, 16 * PX, 1.5 * PX);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x9c7444,
      roughness: 0.78,
      metalness: 0.08,
      emissive: enchanted ? new THREE.Color(0xa855f7) : new THREE.Color(0x000000),
      emissiveIntensity: enchanted ? 0.5 : 0,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.userData.characterId = characterId;
    body.userData.enchanted = enchanted;

    const rimGeo = new THREE.BoxGeometry(11 * PX, 17 * PX, 1.0 * PX);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.35,
      metalness: 0.8,
      emissive: enchanted ? new THREE.Color(0xa855f7) : new THREE.Color(0x000000),
      emissiveIntensity: enchanted ? 0.45 : 0,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.z = -0.3 * PX;
    rim.castShadow = true;
    rim.userData.characterId = characterId;

    group.add(rim, body);
    group.position.set(isOffhand ? 2.5 * PX : -2.5 * PX, -4 * PX, 2.5 * PX);
    group.rotation.set(0, isOffhand ? Math.PI * 0.42 : -Math.PI * 0.42, 0);
  } else {
    const geo = buildExtrudedSpriteGeometry(def);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: def.roughness ?? 0.55,
      metalness: def.metalness ?? 0.15,
      emissive: enchanted
        ? new THREE.Color(0xa855f7)
        : new THREE.Color(def.emissiveColor ?? 0x000000),
      emissiveIntensity: enchanted ? 0.52 : def.emissiveColor ? 0.42 : 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.userData.characterId = characterId;
    mesh.userData.enchanted = enchanted;

    const scale = def.style === 'trident' ? 1.15 : def.style === 'tool' ? 0.85 : 0.55;
    mesh.scale.setScalar(scale);

    if (def.style === 'tool' || def.style === 'trident') {
      // Orient diagonal sprite (bottom-left grip -> top-right tip) straight forward along +Z
      mesh.rotation.set(0, Math.PI / 2, Math.PI / 4);
      mesh.position.set(0, -4.5 * PX, 4.5 * PX);
    } else if (def.style === 'bow') {
      mesh.rotation.set(0, Math.PI / 2, -Math.PI / 8);
      mesh.position.set(0, -4.5 * PX, 3.5 * PX);
    } else {
      // Handheld gems, apples, potions, lanterns, totems
      mesh.rotation.set(0.25, isOffhand ? -0.3 : 0.3, 0);
      mesh.position.set(0, -5 * PX, 3 * PX);
    }

    group.add(mesh);
  }

  // Optional dynamic hand light for Torches, Lanterns, Lava Buckets, Blaze Rods, Nether Stars
  if (def.lightColor) {
    const pt = new THREE.PointLight(def.lightColor, 2.4, 7.5, 1.6);
    pt.position.set(0, -2 * PX, 6 * PX);
    group.add(pt);
  }

  return group;
}
