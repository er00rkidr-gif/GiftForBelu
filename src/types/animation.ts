export type BoneId =
  | 'pelvis'
  | 'torso'
  | 'spineBend'
  | 'head'
  | 'rightArm'
  | 'rightElbow'
  | 'leftArm'
  | 'leftElbow'
  | 'rightLeg'
  | 'rightKnee'
  | 'leftLeg'
  | 'leftKnee';

export type Vec3 = [number, number, number];

export type EasingMode = 'linear' | 'easeInOut' | 'snap' | 'bounce';

export interface KeyframePose {
  time: number;
  label?: string;
  easing?: EasingMode;
  rootOffset: Vec3;
  rootYawOffset: number;
  bones: Record<BoneId, Vec3>;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface CharacterAnimationTrack {
  characterId: string;
  characterName: string;
  keyframes: KeyframePose[];
}

export interface AnimationData {
  id: string;
  name: string;
  prompt: string;
  duration: number;
  loop: boolean;
  motionNotes: string;
  sources: GroundingSource[];
  tracks: Record<string, CharacterAnimationTrack>;
}

export type SkinModelType = 'classic' | 'slim';

export type CameraPreset = 'threeQuarter' | 'front' | 'side' | 'lowAction' | 'wideStage';

export type VfxPreset =
  | 'combat'
  | 'enchant'
  | 'fire'
  | 'ender'
  | 'speed'
  | 'none';

export type WeatherPreset = 'clear' | 'rain' | 'snow' | 'cherry' | 'ash';

export type LightingMood = 'studio' | 'sunset' | 'moonlight' | 'nether';

export interface SkinPreset {
  id: string;
  name: string;
  modelType: SkinModelType;
  dataUrl: string;
}

export interface SceneCharacter {
  id: string;
  name: string;
  skinId: string;
  skinDataUrl: string;
  modelType: SkinModelType;
  showOverlayLayer: boolean;
  /** Item ID in Right Hand (main hand), e.g. 'none', 'diamond_sword', 'totem_of_undying' */
  heldProp: string;
  /** Item ID in Left Hand (off-hand), e.g. 'none', 'shield', 'torch' */
  offhandItem: string;
  enchantedMainHand: boolean;
  enchantedOffhand: boolean;
  /** Per-character particle aura / VFX */
  vfxPreset: VfxPreset;
  /** Resting world coordinates on the map in blocks [x, y, z] */
  basePosition: Vec3;
  /** Resting facing direction in degrees (0 = +Z, 90 = +X, 180 = -Z, -90 = -X) */
  baseYaw: number;
}

export type BlockKind =
  | 'grass'
  | 'dirt'
  | 'stone'
  | 'cobblestone'
  | 'oak_planks'
  | 'oak_log'
  | 'leaves'
  | 'bricks'
  | 'glass'
  | 'sand'
  | 'bedrock'
  | 'gold'
  | 'diamond'
  | 'iron'
  | 'obsidian'
  | 'lantern'
  | 'wool_red'
  | 'wool_white'
  | 'water';

export interface VoxelBlock {
  x: number;
  y: number;
  z: number;
  kind: BlockKind;
}

export interface SchematicMapData {
  id: string;
  name: string;
  width: number;
  height: number;
  length: number;
  blocks: VoxelBlock[];
  groundY: number;
}

export const BONE_LABELS: Record<BoneId, string> = {
  pelvis: 'Pelvis / Root',
  torso: 'Lower Torso',
  spineBend: 'Upper Chest Bend',
  head: 'Head',
  rightArm: 'Right Shoulder',
  rightElbow: 'Right Elbow',
  leftArm: 'Left Shoulder',
  leftElbow: 'Left Elbow',
  rightLeg: 'Right Hip',
  rightKnee: 'Right Knee',
  leftLeg: 'Left Hip',
  leftKnee: 'Left Knee',
};

export const EMPTY_BONES: Record<BoneId, Vec3> = {
  pelvis: [0, 0, 0],
  torso: [0, 0, 0],
  spineBend: [0, 0, 0],
  head: [0, 0, 0],
  rightArm: [0, 0, 0],
  rightElbow: [0, 0, 0],
  leftArm: [0, 0, 0],
  leftElbow: [0, 0, 0],
  rightLeg: [0, 0, 0],
  rightKnee: [0, 0, 0],
  leftLeg: [0, 0, 0],
  leftKnee: [0, 0, 0],
};
