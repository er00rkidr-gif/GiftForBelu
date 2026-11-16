import * as THREE from 'three';
import { BlockKind, SchematicMapData } from '../types/animation';

function makePixelCanvas(draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  return c;
}

function addNoisePixels(
  ctx: CanvasRenderingContext2D,
  palette: string[],
  seedOffset = 0,
) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const h = Math.sin((x + seedOffset) * 12.9898 + (y + seedOffset) * 78.233) * 43758.5453;
      const frac = h - Math.floor(h);
      const idx = Math.min(palette.length - 1, Math.floor(frac * palette.length));
      ctx.fillStyle = palette[idx];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function toNearestTex(canvas: HTMLCanvasElement, anisotropy: number): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = anisotropy;
  return tex;
}

interface MaterialBundle {
  materials: Map<BlockKind, THREE.Material | THREE.Material[]>;
  textures: THREE.Texture[];
}

function createBlockMaterialBundle(anisotropy: number): MaterialBundle {
  const textures: THREE.Texture[] = [];
  const makeTex = (draw: (ctx: CanvasRenderingContext2D) => void) => {
    const tex = toNearestTex(makePixelCanvas(draw), anisotropy);
    textures.push(tex);
    return tex;
  };

  const grassTop = makeTex((ctx) =>
    addNoisePixels(ctx, ['#559436', '#5ea33b', '#4d8730', '#69b043'], 1),
  );
  const dirt = makeTex((ctx) =>
    addNoisePixels(ctx, ['#7c5537', '#6f4b30', '#875e3e', '#62422a'], 2),
  );
  const grassSide = makeTex((ctx) => {
    addNoisePixels(ctx, ['#7c5537', '#6f4b30', '#875e3e', '#62422a'], 3);
    for (let x = 0; x < 16; x++) {
      const drop = x % 3 === 0 ? 4 : x % 2 === 0 ? 3 : 2;
      for (let y = 0; y < drop; y++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#559436' : '#5ea33b';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });
  const stone = makeTex((ctx) =>
    addNoisePixels(ctx, ['#7d7d7d', '#737373', '#8a8a8a', '#686868'], 4),
  );
  const cobble = makeTex((ctx) => {
    addNoisePixels(ctx, ['#6b6b6b', '#7b7b7b', '#5a5a5a'], 5);
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(0, 4, 16, 1);
    ctx.fillRect(0, 10, 16, 1);
    ctx.fillRect(5, 0, 1, 5);
    ctx.fillRect(11, 5, 1, 5);
    ctx.fillRect(7, 11, 1, 5);
  });
  const planks = makeTex((ctx) => {
    addNoisePixels(ctx, ['#a67d4c', '#997144', '#b48955'], 6);
    ctx.fillStyle = '#6e4e2b';
    ctx.fillRect(0, 3, 16, 1);
    ctx.fillRect(0, 7, 16, 1);
    ctx.fillRect(0, 11, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
  });
  const logSide = makeTex((ctx) => {
    addNoisePixels(ctx, ['#5e472d', '#503b24', '#6b5134'], 7);
    ctx.fillStyle = '#3f2d1b';
    ctx.fillRect(2, 0, 1, 16);
    ctx.fillRect(8, 0, 1, 16);
    ctx.fillRect(13, 0, 1, 16);
  });
  const logTop = makeTex((ctx) => {
    ctx.fillStyle = '#5e472d';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#b48a58';
    ctx.fillRect(2, 2, 12, 12);
    ctx.fillStyle = '#977043';
    ctx.fillRect(4, 4, 8, 8);
    ctx.fillStyle = '#b48a58';
    ctx.fillRect(6, 6, 4, 4);
  });
  const leaves = makeTex((ctx) =>
    addNoisePixels(ctx, ['#3a6f24', '#46832c', '#2f5c1d', '#519234'], 8),
  );
  const bricks = makeTex((ctx) => {
    ctx.fillStyle = '#9b4a3a';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#b7b0a6';
    ctx.fillRect(0, 3, 16, 1);
    ctx.fillRect(0, 7, 16, 1);
    ctx.fillRect(0, 11, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    ctx.fillRect(7, 0, 1, 3);
    ctx.fillRect(3, 4, 1, 3);
    ctx.fillRect(11, 4, 1, 3);
    ctx.fillRect(7, 8, 1, 3);
    ctx.fillRect(3, 12, 1, 3);
  });
  const glass = makeTex((ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = 'rgba(186, 230, 253, 0.35)';
    ctx.fillRect(1, 1, 14, 14);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 15, 15);
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(3, 3, 2, 1);
    ctx.fillRect(4, 4, 1, 2);
  });
  const sand = makeTex((ctx) =>
    addNoisePixels(ctx, ['#dfd29c', '#d5c68c', '#e6daaa'], 9),
  );
  const bedrock = makeTex((ctx) =>
    addNoisePixels(ctx, ['#3b3b3b', '#222222', '#525252', '#171717'], 10),
  );
  const gold = makeTex((ctx) =>
    addNoisePixels(ctx, ['#f5d042', '#e4b829', '#fae27a'], 11),
  );
  const diamond = makeTex((ctx) =>
    addNoisePixels(ctx, ['#55e5dc', '#3ecbc2', '#8bf2eb'], 12),
  );
  const iron = makeTex((ctx) =>
    addNoisePixels(ctx, ['#d8d8d8', '#c6c6c6', '#e6e6e6'], 13),
  );
  const obsidian = makeTex((ctx) =>
    addNoisePixels(ctx, ['#181024', '#261a38', '#110b19', '#34224d'], 14),
  );
  const lantern = makeTex((ctx) => {
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(2, 2, 12, 12);
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 14, 14);
  });
  const woolRed = makeTex((ctx) =>
    addNoisePixels(ctx, ['#b91c1c', '#991b1b', '#dc2626'], 15),
  );
  const woolWhite = makeTex((ctx) =>
    addNoisePixels(ctx, ['#e4e4e7', '#d4d4d8', '#f4f4f5'], 16),
  );
  const water = makeTex((ctx) =>
    addNoisePixels(ctx, ['#2563eb', '#3b82f6', '#1d4ed8'], 17),
  );

  const std = (map: THREE.Texture, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    new THREE.MeshStandardMaterial({
      map,
      roughness: 0.88,
      metalness: 0.04,
      ...extra,
    });

  const materials = new Map<BlockKind, THREE.Material | THREE.Material[]>();
  const grassSideMat = std(grassSide);
  const grassTopMat = std(grassTop);
  const dirtMat = std(dirt);
  materials.set('grass', [
    grassSideMat,
    grassSideMat,
    grassTopMat,
    dirtMat,
    grassSideMat,
    grassSideMat,
  ]);
  materials.set('dirt', dirtMat);
  materials.set('stone', std(stone));
  materials.set('cobblestone', std(cobble));
  materials.set('oak_planks', std(planks));
  const logSideMat = std(logSide);
  const logTopMat = std(logTop);
  materials.set('oak_log', [
    logSideMat,
    logSideMat,
    logTopMat,
    logTopMat,
    logSideMat,
    logSideMat,
  ]);
  materials.set('leaves', std(leaves, { roughness: 0.92 }));
  materials.set('bricks', std(bricks));
  materials.set(
    'glass',
    std(glass, { transparent: true, opacity: 0.72, roughness: 0.18, metalness: 0.1 }),
  );
  materials.set('sand', std(sand, { roughness: 0.95 }));
  materials.set('bedrock', std(bedrock, { roughness: 0.95 }));
  materials.set('gold', std(gold, { roughness: 0.35, metalness: 0.65 }));
  materials.set('diamond', std(diamond, { roughness: 0.28, metalness: 0.35 }));
  materials.set('iron', std(iron, { roughness: 0.38, metalness: 0.75 }));
  materials.set('obsidian', std(obsidian, { roughness: 0.45, metalness: 0.2 }));
  materials.set(
    'lantern',
    std(lantern, { emissive: new THREE.Color(0xf59e0b), emissiveIntensity: 0.9 }),
  );
  materials.set('wool_red', std(woolRed, { roughness: 0.95 }));
  materials.set('wool_white', std(woolWhite, { roughness: 0.95 }));
  materials.set('water', std(water, { transparent: true, opacity: 0.72, roughness: 0.15 }));

  return { materials, textures };
}

export interface BuiltSchematicWorld {
  group: THREE.Group;
  dispose: () => void;
}

export function buildSchematicWorld(
  mapData: SchematicMapData,
  anisotropy: number,
): BuiltSchematicWorld {
  const group = new THREE.Group();
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const { materials, textures } = createBlockMaterialBundle(anisotropy);

  // Bucket blocks by BlockKind for fast GPU instancing
  const buckets = new Map<BlockKind, Array<{ x: number; y: number; z: number }>>();
  for (const b of mapData.blocks) {
    let arr = buckets.get(b.kind);
    if (!arr) {
      arr = [];
      buckets.set(b.kind, arr);
    }
    arr.push(b);
  }

  const dummy = new THREE.Object3D();
  const meshes: THREE.InstancedMesh[] = [];

  for (const [kind, positions] of buckets.entries()) {
    const mat = materials.get(kind);
    if (!mat || positions.length === 0) continue;

    const inst = new THREE.InstancedMesh(unitBox, mat, positions.length);
    const isTransparent = kind === 'glass' || kind === 'water';
    inst.castShadow = !isTransparent;
    inst.receiveShadow = !isTransparent;

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      // Offset +0.5 on X/Y/Z so a block at y=-1 spans [-1, 0], leaving top surface cleanly at y=0!
      dummy.position.set(p.x + 0.5, p.y + 0.5, p.z + 0.5);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
    meshes.push(inst);
  }

  const dispose = () => {
    for (const m of meshes) group.remove(m);
    unitBox.dispose();
    const disposedMats = new Set<THREE.Material>();
    for (const m of materials.values()) {
      const list = Array.isArray(m) ? m : [m];
      for (const item of list) {
        if (!disposedMats.has(item)) {
          disposedMats.add(item);
          item.dispose();
        }
      }
    }
    for (const t of textures) t.dispose();
  };

  return { group, dispose };
}
