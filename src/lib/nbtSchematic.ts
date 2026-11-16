import { BlockKind, SchematicMapData, VoxelBlock } from '../types/animation';

// ---------- Built-in Starter Maps ----------

export function createFlatBaseplateMap(): SchematicMapData {
  const size = 24;
  const half = size / 2;
  const blocks: VoxelBlock[] = [];

  for (let x = -half; x < half; x++) {
    for (let z = -half; z < half; z++) {
      // Top grass layer sits from y = -1 to y = 0 (character feet rest at y = 0!)
      blocks.push({ x, y: -1, z, kind: 'grass' });
      // Edge border shows authentic superflat dirt & bedrock strata on outer rim
      const isRim =
        x === -half || x === half - 1 || z === -half || z === half - 1;
      if (isRim) {
        blocks.push({ x, y: -2, z, kind: 'dirt' });
        blocks.push({ x, y: -3, z, kind: 'bedrock' });
      }
    }
  }

  return {
    id: 'flat-baseplate',
    name: 'Flat Baseplate (Starter)',
    width: size,
    height: 3,
    length: size,
    blocks,
    groundY: 0,
  };
}

export function createDojoArenaMap(): SchematicMapData {
  const size = 22;
  const half = size / 2;
  const blocks: VoxelBlock[] = [];

  for (let x = -half; x < half; x++) {
    for (let z = -half; z < half; z++) {
      const dist = Math.max(Math.abs(x + 0.5), Math.abs(z + 0.5));
      if (dist <= 5.5) {
        blocks.push({ x, y: -1, z, kind: dist > 4.5 ? 'oak_log' : 'oak_planks' });
      } else {
        blocks.push({ x, y: -1, z, kind: 'stone' });
      }
    }
  }

  // Four corner pillars with glowing lanterns
  const corners = [
    [-6, -6],
    [5, -6],
    [-6, 5],
    [5, 5],
  ];
  for (const [cx, cz] of corners) {
    for (let y = 0; y < 4; y++) {
      blocks.push({ x: cx, y, z: cz, kind: 'oak_log' });
    }
    blocks.push({ x: cx, y: 4, z: cz, kind: 'lantern' });
  }

  // Low perimeter stone walls on back corners
  for (let x = -7; x <= 6; x++) {
    if (Math.abs(x) >= 3) {
      blocks.push({ x, y: 0, z: -8, kind: 'cobblestone' });
    }
  }

  return {
    id: 'dojo-arena',
    name: 'Sparring Dojo Arena',
    width: size,
    height: 6,
    length: size,
    blocks,
    groundY: 0,
  };
}

export function createVillageOutpostMap(): SchematicMapData {
  const size = 24;
  const half = size / 2;
  const blocks: VoxelBlock[] = [];

  for (let x = -half; x < half; x++) {
    for (let z = -half; z < half; z++) {
      const isPath = Math.abs(x) <= 1 && z >= -2 && z <= 9;
      blocks.push({ x, y: -1, z, kind: isPath ? 'cobblestone' : 'grass' });
    }
  }

  // Small Oak Cottage in back (-8..-3, 0..4, -8..-4)
  for (let x = -8; x <= -3; x++) {
    for (let z = -8; z <= -4; z++) {
      blocks.push({ x, y: 0, z, kind: 'cobblestone' });
      for (let y = 1; y <= 3; y++) {
        const isWall = x === -8 || x === -3 || z === -8 || z === -4;
        const isDoor = x === -6 && z === -4 && y <= 2;
        const isWindow = (x === -4 || x === -7) && z === -4 && y === 2;
        if (isWall && !isDoor) {
          blocks.push({ x, y, z, kind: isWindow ? 'glass' : 'oak_planks' });
        }
      }
      blocks.push({ x, y: 4, z, kind: 'bricks' });
    }
  }
  blocks.push({ x: -5, y: 2, z: -3, kind: 'lantern' });

  // Oak Tree on the right (6, 0..5, -5)
  for (let y = 0; y <= 3; y++) {
    blocks.push({ x: 6, y, z: -5, kind: 'oak_log' });
  }
  for (let lx = 4; lx <= 8; lx++) {
    for (let lz = -7; lz <= -3; lz++) {
      for (let ly = 3; ly <= 5; ly++) {
        if (ly === 5 && (Math.abs(lx - 6) > 1 || Math.abs(lz + 5) > 1)) continue;
        if (lx === 6 && lz === -5 && ly === 3) continue;
        blocks.push({ x: lx, y: ly, z: lz, kind: 'leaves' });
      }
    }
  }

  return {
    id: 'village-outpost',
    name: 'Village Outpost',
    width: size,
    height: 7,
    length: size,
    blocks,
    groundY: 0,
  };
}

export function getBuiltInMaps(): SchematicMapData[] {
  return [
    createFlatBaseplateMap(),
    createDojoArenaMap(),
    createVillageOutpostMap(),
  ];
}

// ---------- NBT Binary Parser (.schematic & .schem) ----------

type NbtValue =
  | number
  | bigint
  | string
  | Uint8Array
  | Int32Array
  | NbtValue[]
  | { [key: string]: NbtValue };

class NbtReader {
  private view: DataView;
  private bytes: Uint8Array;
  private offset = 0;
  private decoder = new TextDecoder('utf-8');

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
  }

  readByte(): number {
    const v = this.view.getInt8(this.offset);
    this.offset += 1;
    return v;
  }

  readUByte(): number {
    const v = this.view.getUint8(this.offset);
    this.offset += 1;
    return v;
  }

  readShort(): number {
    const v = this.view.getInt16(this.offset, false);
    this.offset += 2;
    return v;
  }

  readInt(): number {
    const v = this.view.getInt32(this.offset, false);
    this.offset += 4;
    return v;
  }

  readLong(): bigint {
    const v = this.view.getBigInt64(this.offset, false);
    this.offset += 8;
    return v;
  }

  readFloat(): number {
    const v = this.view.getFloat32(this.offset, false);
    this.offset += 4;
    return v;
  }

  readDouble(): number {
    const v = this.view.getFloat64(this.offset, false);
    this.offset += 8;
    return v;
  }

  readString(): string {
    const len = this.view.getUint16(this.offset, false);
    this.offset += 2;
    const slice = this.bytes.subarray(this.offset, this.offset + len);
    this.offset += len;
    return this.decoder.decode(slice);
  }

  readPayload(tagType: number): NbtValue {
    switch (tagType) {
      case 1:
        return this.readByte();
      case 2:
        return this.readShort();
      case 3:
        return this.readInt();
      case 4:
        return this.readLong();
      case 5:
        return this.readFloat();
      case 6:
        return this.readDouble();
      case 7: {
        const len = this.readInt();
        const arr = this.bytes.slice(this.offset, this.offset + len);
        this.offset += len;
        return arr;
      }
      case 8:
        return this.readString();
      case 9: {
        const elemType = this.readUByte();
        const len = this.readInt();
        const list: NbtValue[] = [];
        for (let i = 0; i < len; i++) {
          list.push(this.readPayload(elemType));
        }
        return list;
      }
      case 10: {
        const compound: { [key: string]: NbtValue } = {};
        while (this.offset < this.bytes.length) {
          const t = this.readUByte();
          if (t === 0) break;
          const name = this.readString();
          compound[name] = this.readPayload(t);
        }
        return compound;
      }
      case 11: {
        const len = this.readInt();
        const arr = new Int32Array(len);
        for (let i = 0; i < len; i++) arr[i] = this.readInt();
        return arr;
      }
      case 12: {
        const len = this.readInt();
        const list: bigint[] = [];
        for (let i = 0; i < len; i++) list.push(this.readLong());
        return list;
      }
      default:
        throw new Error(`Unsupported NBT tag type: ${tagType}`);
    }
  }

  readRoot(): { [key: string]: NbtValue } {
    const rootType = this.readUByte();
    if (rootType !== 10) {
      throw new Error('Invalid NBT file: root tag is not a Compound.');
    }
    this.readString(); // root name
    return this.readPayload(10) as { [key: string]: NbtValue };
  }
}

async function gunzipIfNeeded(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(buffer);
  const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!isGzip) return buffer;

  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Gzip DecompressionStream is not supported in this browser.');
  }
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return await new Response(stream).arrayBuffer();
}

function mapLegacyBlockId(id: number): BlockKind | null {
  switch (id) {
    case 0:
      return null;
    case 1:
      return 'stone';
    case 2:
      return 'grass';
    case 3:
      return 'dirt';
    case 4:
    case 48:
    case 98:
      return 'cobblestone';
    case 5:
    case 53:
    case 85:
    case 126:
      return 'oak_planks';
    case 7:
      return 'bedrock';
    case 8:
    case 9:
      return 'water';
    case 12:
    case 24:
      return 'sand';
    case 14:
    case 41:
      return 'gold';
    case 15:
    case 42:
      return 'iron';
    case 17:
    case 162:
      return 'oak_log';
    case 18:
    case 161:
      return 'leaves';
    case 20:
    case 95:
    case 102:
      return 'glass';
    case 35:
      return 'wool_white';
    case 45:
    case 108:
    case 112:
      return 'bricks';
    case 49:
      return 'obsidian';
    case 50:
    case 89:
    case 169:
      return 'lantern';
    case 56:
    case 57:
      return 'diamond';
    default:
      return 'stone';
  }
}

function mapModernBlockName(rawName: string): BlockKind | null {
  const name = rawName.split('[')[0].replace('minecraft:', '').toLowerCase();
  if (
    name === 'air' ||
    name === 'cave_air' ||
    name === 'void_air' ||
    name === 'barrier' ||
    name === 'structure_void'
  ) {
    return null;
  }
  if (name.includes('grass_block') || name === 'grass' || name === 'podzol' || name === 'mycelium') return 'grass';
  if (name.includes('dirt') || name.includes('coarse_dirt') || name.includes('farmland')) return 'dirt';
  if (name.includes('cobble') || name.includes('stone_brick') || name.includes('andesite') || name.includes('deepslate')) return 'cobblestone';
  if (name.includes('stone')) return 'stone';
  if (name.includes('plank') || name.includes('fence') || name.includes('slab') || name.includes('stair') || name.includes('door')) return 'oak_planks';
  if (name.includes('log') || name.includes('wood') || name.includes('bark')) return 'oak_log';
  if (name.includes('leaves') || name.includes('vine') || name.includes('moss')) return 'leaves';
  if (name.includes('brick') || name.includes('terracotta')) return 'bricks';
  if (name.includes('glass') || name.includes('pane')) return 'glass';
  if (name.includes('sand')) return 'sand';
  if (name.includes('bedrock')) return 'bedrock';
  if (name.includes('gold')) return 'gold';
  if (name.includes('diamond') || name.includes('emerald')) return 'diamond';
  if (name.includes('iron') || name.includes('quartz')) return 'iron';
  if (name.includes('obsidian') || name.includes('coal') || name.includes('blackstone')) return 'obsidian';
  if (name.includes('lantern') || name.includes('glowstone') || name.includes('torch') || name.includes('lamp')) return 'lantern';
  if (name.includes('red_wool') || name.includes('red_concrete')) return 'wool_red';
  if (name.includes('wool') || name.includes('concrete')) return 'wool_white';
  if (name.includes('water')) return 'water';
  return 'stone';
}

function cullHiddenBlocks(blocks: VoxelBlock[]): VoxelBlock[] {
  if (blocks.length <= 2500) return blocks;
  const occupied = new Set<string>();
  for (const b of blocks) {
    if (b.kind !== 'glass' && b.kind !== 'water' && b.kind !== 'leaves') {
      occupied.add(`${b.x},${b.y},${b.z}`);
    }
  }
  const visible: VoxelBlock[] = [];
  for (const b of blocks) {
    if (
      occupied.has(`${b.x + 1},${b.y},${b.z}`) &&
      occupied.has(`${b.x - 1},${b.y},${b.z}`) &&
      occupied.has(`${b.x},${b.y + 1},${b.z}`) &&
      occupied.has(`${b.x},${b.y - 1},${b.z}`) &&
      occupied.has(`${b.x},${b.y},${b.z + 1}`) &&
      occupied.has(`${b.x},${b.y},${b.z - 1}`)
    ) {
      continue;
    }
    visible.push(b);
  }
  // Hard safety cap for smooth browser rendering
  return visible.slice(0, 18000);
}

export async function parseSchematicFile(file: File): Promise<SchematicMapData> {
  const lower = file.name.toLowerCase();

  // Support JSON voxel maps: { name?, blocks: [{ x, y, z, kind }] }
  if (lower.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const rawBlocks = Array.isArray(parsed) ? parsed : parsed.blocks;
    if (!Array.isArray(rawBlocks) || rawBlocks.length === 0) {
      throw new Error('JSON schematic has no blocks array.');
    }
    const blocks: VoxelBlock[] = rawBlocks.slice(0, 18000).map((b: Record<string, unknown>) => ({
      x: Math.round(Number(b.x) || 0),
      y: Math.round(Number(b.y) || 0),
      z: Math.round(Number(b.z) || 0),
      kind: mapModernBlockName(String(b.kind || b.type || 'stone')) || 'stone',
    }));
    return normalizeSchematicBounds(file.name.replace(/\.json$/i, ''), blocks);
  }

  const buffer = await file.arrayBuffer();
  const unzipped = await gunzipIfNeeded(buffer);
  const reader = new NbtReader(unzipped);
  let root = reader.readRoot();

  // Sponge Schematic v3 wraps data inside root.Schematic
  if (root.Schematic && typeof root.Schematic === 'object' && !Array.isArray(root.Schematic)) {
    root = root.Schematic as { [key: string]: NbtValue };
  }

  const width = Number(root.Width) || 0;
  const height = Number(root.Height) || 0;
  const length = Number(root.Length) || 0;

  if (width <= 0 || height <= 0 || length <= 0) {
    throw new Error('Invalid schematic dimensions. Upload a valid .schematic, .schem, or .json map.');
  }

  const blocks: VoxelBlock[] = [];

  // Format A: Classic MCEdit .schematic (Blocks byte array)
  if (root.Blocks instanceof Uint8Array) {
    const blockIds = root.Blocks;
    const addIds = root.AddBlocks instanceof Uint8Array ? root.AddBlocks : null;
    for (let y = 0; y < height; y++) {
      for (let z = 0; z < length; z++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * length + z) * width + x;
          let id = blockIds[idx] ?? 0;
          if (addIds) {
            const addByte = addIds[idx >> 1] ?? 0;
            id += (idx & 1) === 0 ? (addByte & 0x0f) << 8 : (addByte & 0xf0) << 4;
          }
          const kind = mapLegacyBlockId(id);
          if (kind) {
            blocks.push({ x, y, z, kind });
          }
        }
      }
    }
  } else {
    // Format B: Sponge .schem v2 (Palette + BlockData) or v3 (Blocks.Palette + Blocks.Data)
    let paletteCompound = root.Palette as { [key: string]: NbtValue } | undefined;
    let blockData = root.BlockData as Uint8Array | undefined;

    if (root.Blocks && typeof root.Blocks === 'object' && !(root.Blocks instanceof Uint8Array)) {
      const blocksTag = root.Blocks as { [key: string]: NbtValue };
      paletteCompound = blocksTag.Palette as { [key: string]: NbtValue } | undefined;
      blockData = blocksTag.Data as Uint8Array | undefined;
    }

    if (!paletteCompound || !(blockData instanceof Uint8Array)) {
      throw new Error('Unsupported schematic format. Try a standard .schematic or .schem file.');
    }

    const paletteLookup = new Map<number, BlockKind | null>();
    for (const [blockName, paletteId] of Object.entries(paletteCompound)) {
      paletteLookup.set(Number(paletteId), mapModernBlockName(blockName));
    }

    // Decode VarInt array (Y -> Z -> X)
    let ptr = 0;
    const total = width * height * length;
    for (let i = 0; i < total && ptr < blockData.length; i++) {
      let value = 0;
      let shift = 0;
      while (ptr < blockData.length) {
        const b = blockData[ptr++];
        value |= (b & 0x7f) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
      }
      const kind = paletteLookup.get(value) ?? null;
      if (kind) {
        const y = Math.floor(i / (width * length));
        const rem = i % (width * length);
        const z = Math.floor(rem / width);
        const x = rem % width;
        blocks.push({ x, y, z, kind });
      }
    }
  }

  if (blocks.length === 0) {
    throw new Error('The schematic contains no solid blocks.');
  }

  const culled = cullHiddenBlocks(blocks);
  return normalizeSchematicBounds(
    file.name.replace(/\.(schematic|schem|nbt)$/i, ''),
    culled,
  );
}

function normalizeSchematicBounds(name: string, rawBlocks: VoxelBlock[]): SchematicMapData {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const b of rawBlocks) {
    if (b.x < minX) minX = b.x;
    if (b.x > maxX) maxX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.y > maxY) maxY = b.y;
    if (b.z < minZ) minZ = b.z;
    if (b.z > maxZ) maxZ = b.z;
  }

  const cx = Math.floor((minX + maxX) / 2);
  const cz = Math.floor((minZ + maxZ) / 2);

  // Place bottom of schematic at y = -1 if it's a single-layer floor, or y = 0 on top of baseplate
  const height = maxY - minY + 1;
  const yShift = height === 1 ? -1 - minY : -minY;

  const centered: VoxelBlock[] = rawBlocks.map((b) => ({
    x: b.x - cx,
    y: b.y + yShift,
    z: b.z - cz,
    kind: b.kind,
  }));

  return {
    id: `schem-${Date.now()}`,
    name: name || 'Imported Schematic',
    width: maxX - minX + 1,
    height,
    length: maxZ - minZ + 1,
    blocks: centered,
    groundY: height === 1 ? 0 : 0,
  };
}
