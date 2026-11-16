import {
  AnimationData,
  CharacterAnimationTrack,
  EasingMode,
  EMPTY_BONES,
  KeyframePose,
  SceneCharacter,
  Vec3,
} from '../types/animation';

export interface MineimatorKeyframeEntry {
  position: number;
  part_name?: string;
  values: Record<string, number | string>;
}

export interface MineimatorKeyframesFile {
  format: number;
  created_in: string;
  is_model: boolean;
  tempo: number;
  length: number;
  keyframes: MineimatorKeyframeEntry[];
}

const MINEIMATOR_TEMPO = 24;
const BLOCK_TO_PX = 16;

function roundVal(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function mapEasingToMineimatorTransition(easing?: EasingMode): string {
  switch (easing) {
    case 'linear':
      return 'linear';
    case 'snap':
      return 'easeoutback';
    case 'bounce':
      return 'easeoutbounce';
    case 'easeInOut':
    default:
      return 'easeinoutquad';
  }
}

/**
 * Converts a BlockRig Studio character animation track into a genuine
 * Mine-imator 2.0 `.miframes` keyframe file (24 FPS, 16px/block, Z-up).
 *
 * Coordinate mapping (BlockRig Y-up -> Mine-imator Z-up):
 *   POS_X = x * 16
 *   POS_Y = -z * 16
 *   POS_Z = y * 16
 *   ROT_X = pitch (X), ROT_Y = roll (Z), ROT_Z = yaw (Y)
 *   BEND_ANGLE_X = limb elbow/knee & spine bend
 */
export function buildMineimatorKeyframesFile(
  animation: AnimationData,
  character: SceneCharacter,
  track: CharacterAnimationTrack,
  includeBaseTransform = false,
): MineimatorKeyframesFile {
  const tempo = MINEIMATOR_TEMPO;
  const totalFrames = Math.max(1, Math.round(animation.duration * tempo));
  const sortedKeyframes = [...(track.keyframes || [])].sort((a, b) => a.time - b.time);

  const entries: MineimatorKeyframeEntry[] = [];

  for (let i = 0; i < sortedKeyframes.length; i++) {
    const kf: KeyframePose = sortedKeyframes[i];
    const framePos = Math.max(0, Math.round(kf.time * tempo));
    const transition = mapEasingToMineimatorTransition(kf.easing);

    const bones = kf.bones ?? EMPTY_BONES;
    const pelvis = bones.pelvis ?? ([0, 0, 0] as Vec3);
    const torso = bones.torso ?? ([0, 0, 0] as Vec3);
    const spineBend = bones.spineBend ?? ([0, 0, 0] as Vec3);
    const head = bones.head ?? ([0, 0, 0] as Vec3);
    const rightArm = bones.rightArm ?? ([0, 0, 0] as Vec3);
    const rightElbow = bones.rightElbow ?? ([0, 0, 0] as Vec3);
    const leftArm = bones.leftArm ?? ([0, 0, 0] as Vec3);
    const leftElbow = bones.leftElbow ?? ([0, 0, 0] as Vec3);
    const rightLeg = bones.rightLeg ?? ([0, 0, 0] as Vec3);
    const rightKnee = bones.rightKnee ?? ([0, 0, 0] as Vec3);
    const leftLeg = bones.leftLeg ?? ([0, 0, 0] as Vec3);
    const leftKnee = bones.leftKnee ?? ([0, 0, 0] as Vec3);

    const rootOffset = kf.rootOffset ?? [0, 0, 0];
    const basePos = includeBaseTransform ? character.basePosition : [0, 0, 0];
    const baseYaw = includeBaseTransform ? character.baseYaw : 0;

    const worldX = basePos[0] + rootOffset[0];
    const worldY = basePos[1] + rootOffset[1];
    const worldZ = basePos[2] + rootOffset[2];

    // 1. Root Human model keyframe (omits part_name in Mine-imator .miframes)
    entries.push({
      position: framePos,
      values: {
        POS_X: roundVal(worldX * BLOCK_TO_PX),
        POS_Y: roundVal(-worldZ * BLOCK_TO_PX),
        POS_Z: roundVal(worldY * BLOCK_TO_PX),
        ROT_X: roundVal(pelvis[0]),
        ROT_Y: roundVal(pelvis[2]),
        ROT_Z: roundVal(baseYaw + (kf.rootYawOffset ?? 0) + pelvis[1]),
        TRANSITION: transition,
      },
    });

    // 2. Body / Torso + Spine Bend
    entries.push({
      position: framePos,
      part_name: 'body',
      values: {
        ROT_X: roundVal(torso[0]),
        ROT_Y: roundVal(torso[2]),
        ROT_Z: roundVal(torso[1]),
        BEND_ANGLE_X: roundVal(spineBend[0]),
        BEND_ANGLE_Y: roundVal(spineBend[2]),
        BEND_ANGLE_Z: roundVal(spineBend[1]),
        TRANSITION: transition,
      },
    });

    // 3. Head
    entries.push({
      position: framePos,
      part_name: 'head',
      values: {
        ROT_X: roundVal(head[0]),
        ROT_Y: roundVal(head[2]),
        ROT_Z: roundVal(head[1]),
        TRANSITION: transition,
      },
    });

    // 4. Right Arm + Elbow Bend (Mine-imator arm bend forward is positive)
    entries.push({
      position: framePos,
      part_name: 'right_arm',
      values: {
        ROT_X: roundVal(-rightArm[0]),
        ROT_Y: roundVal(rightArm[2]),
        ROT_Z: roundVal(rightArm[1]),
        BEND_ANGLE_X: roundVal(Math.max(0, -rightElbow[0])),
        TRANSITION: transition,
      },
    });

    // 5. Left Arm + Elbow Bend
    entries.push({
      position: framePos,
      part_name: 'left_arm',
      values: {
        ROT_X: roundVal(-leftArm[0]),
        ROT_Y: roundVal(leftArm[2]),
        ROT_Z: roundVal(leftArm[1]),
        BEND_ANGLE_X: roundVal(Math.max(0, -leftElbow[0])),
        TRANSITION: transition,
      },
    });

    // 6. Right Leg + Knee Bend
    entries.push({
      position: framePos,
      part_name: 'right_leg',
      values: {
        ROT_X: roundVal(-rightLeg[0]),
        ROT_Y: roundVal(rightLeg[2]),
        ROT_Z: roundVal(rightLeg[1]),
        BEND_ANGLE_X: roundVal(rightKnee[0]),
        TRANSITION: transition,
      },
    });

    // 7. Left Leg + Knee Bend
    entries.push({
      position: framePos,
      part_name: 'left_leg',
      values: {
        ROT_X: roundVal(-leftLeg[0]),
        ROT_Y: roundVal(leftLeg[2]),
        ROT_Z: roundVal(leftLeg[1]),
        BEND_ANGLE_X: roundVal(leftKnee[0]),
        TRANSITION: transition,
      },
    });
  }

  return {
    format: 34,
    created_in: '2.0.2',
    is_model: true,
    tempo,
    length: totalFrames,
    keyframes: entries,
  };
}

export function triggerMiframesDownload(
  filename: string,
  payload: MineimatorKeyframesFile,
) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.miframes') ? filename : `${filename}.miframes`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugifyFilename(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'animation'
  );
}
