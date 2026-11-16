import * as THREE from 'three';
import {
  BoneId,
  CharacterAnimationTrack,
  EasingMode,
  EMPTY_BONES,
  KeyframePose,
  SkinModelType,
  Vec3,
} from '../types/animation';
import { createMinecraftItemMountGroup } from './minecraftItems';
import { applyMinecraftBoxUVs, applyMinecraftSubBoxUVs } from './minecraftSkin';

const PX = 1 / 16; // 16px = 1.0 Minecraft block
const DEG2RAD = Math.PI / 180;

export interface MinecraftRig {
  characterId: string;
  root: THREE.Group;
  actorRoot: THREE.Group;
  selectionRing: THREE.Mesh;
  contactShadow: THREE.Mesh;
  bones: Record<BoneId, THREE.Group>;
  handMount: THREE.Group;
  offhandMount: THREE.Group;
  overlayMeshes: THREE.Mesh[];
  materials: {
    base: THREE.MeshStandardMaterial;
    overlay: THREE.MeshStandardMaterial;
  };
  rebuildModel: (modelType: SkinModelType) => void;
  setTexture: (texture: THREE.Texture) => void;
  setOverlayVisible: (visible: boolean) => void;
  setHeldItem: (slot: 'main' | 'offhand', itemId: string, enchanted: boolean) => void;
  updateEnchantShimmer: (elapsedSec: number) => void;
  setSelected: (selected: boolean) => void;
  applyPose: (
    basePosition: Vec3,
    baseYaw: number,
    pose: { rootOffset: Vec3; rootYawOffset: number; bones: Record<BoneId, Vec3> },
  ) => void;
  dispose: () => void;
}

function makeFullBox(
  wPx: number,
  hPx: number,
  dPx: number,
  uvOx: number,
  uvOy: number,
  material: THREE.Material,
  characterId: string,
  inflatePx = 0,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(
    (wPx + inflatePx * 2) * PX,
    (hPx + inflatePx * 2) * PX,
    (dPx + inflatePx * 2) * PX,
  );
  applyMinecraftBoxUVs(geo, uvOx, uvOy, wPx, hPx, dPx);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.characterId = characterId;
  return mesh;
}

function makeSubBox(
  wPx: number,
  fullHPx: number,
  dPx: number,
  uvOx: number,
  uvOy: number,
  segment: 'upper' | 'lower',
  material: THREE.Material,
  characterId: string,
  inflatePx = 0,
): THREE.Mesh {
  const halfH = fullHPx / 2;
  const geo = new THREE.BoxGeometry(
    (wPx + inflatePx * 2) * PX,
    (halfH + inflatePx * 1.4) * PX,
    (dPx + inflatePx * 2) * PX,
  );
  applyMinecraftSubBoxUVs(geo, uvOx, uvOy, wPx, fullHPx, dPx, segment);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.characterId = characterId;
  return mesh;
}

  // End of sub-box helpers

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMinecraftRig(
  characterId: string,
  initialTexture: THREE.Texture,
): MinecraftRig {
  const root = new THREE.Group();
  const actorRoot = new THREE.Group();
  root.add(actorRoot);

  // Subtle floor selection ring
  const ringGeo = new THREE.RingGeometry(0.52, 0.59, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const selectionRing = new THREE.Mesh(ringGeo, ringMat);
  selectionRing.position.y = 0.012;
  selectionRing.visible = false;
  root.add(selectionRing);

  // Per-character contact shadow
  const shadowTex = createContactShadowTexture();
  const shadowGeo = new THREE.PlaneGeometry(1.25, 1.25);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.y = 0.008;
  root.add(contactShadow);

  const baseMat = new THREE.MeshStandardMaterial({
    map: initialTexture,
    roughness: 0.82,
    metalness: 0.04,
    alphaTest: 0.1,
  });

  const overlayMat = new THREE.MeshStandardMaterial({
    map: initialTexture,
    roughness: 0.72,
    metalness: 0.08,
    transparent: true,
    alphaTest: 0.1,
    side: THREE.DoubleSide,
  });

  // Mine-imator 12-joint Bendable Bone Hierarchy
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 12 * PX, 0);
  actorRoot.add(pelvis);

  const torso = new THREE.Group();
  pelvis.add(torso);

  const spineBend = new THREE.Group();
  spineBend.position.set(0, 6 * PX, 0);
  torso.add(spineBend);

  const head = new THREE.Group();
  head.position.set(0, 6 * PX, 0);
  spineBend.add(head);

  const rightArm = new THREE.Group();
  rightArm.position.set(-6 * PX, 4 * PX, 0);
  spineBend.add(rightArm);

  const rightElbow = new THREE.Group();
  rightElbow.position.set(0, -4 * PX, 0);
  rightArm.add(rightElbow);

  const leftArm = new THREE.Group();
  leftArm.position.set(6 * PX, 4 * PX, 0);
  spineBend.add(leftArm);

  const leftElbow = new THREE.Group();
  leftElbow.position.set(0, -4 * PX, 0);
  leftArm.add(leftElbow);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(-2 * PX, 0, 0);
  pelvis.add(rightLeg);

  const rightKnee = new THREE.Group();
  rightKnee.position.set(0, -6 * PX, 0);
  rightLeg.add(rightKnee);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(2 * PX, 0, 0);
  pelvis.add(leftLeg);

  const leftKnee = new THREE.Group();
  leftKnee.position.set(0, -6 * PX, 0);
  leftLeg.add(leftKnee);

  const handMount = new THREE.Group();
  rightElbow.add(handMount);

  const offhandMount = new THREE.Group();
  leftElbow.add(offhandMount);

  const bones: Record<BoneId, THREE.Group> = {
    pelvis,
    torso,
    spineBend,
    head,
    rightArm,
    rightElbow,
    leftArm,
    leftElbow,
    rightLeg,
    rightKnee,
    leftLeg,
    leftKnee,
  };

  let overlayMeshes: THREE.Mesh[] = [];
  let createdGeometries: THREE.BufferGeometry[] = [];
  let overlayVisible = true;
  let mainItemGroup: THREE.Group | null = null;
  let offhandItemGroup: THREE.Group | null = null;

  const clearPartMeshes = (group: THREE.Group, keep: THREE.Object3D[] = []) => {
    const toRemove = group.children.filter((c) => !keep.includes(c));
    for (const child of toRemove) group.remove(child);
  };

  const disposeBuiltGeometries = () => {
    for (const geo of createdGeometries) geo.dispose();
    createdGeometries = [];
  };

  const reg = (mesh: THREE.Mesh, isOverlay = false) => {
    createdGeometries.push(mesh.geometry);
    if (isOverlay) {
      mesh.visible = overlayVisible;
      mesh.renderOrder = 2;
      overlayMeshes.push(mesh);
    }
    return mesh;
  };

  const rebuildModel = (modelType: SkinModelType) => {
    disposeBuiltGeometries();
    overlayMeshes = [];

    clearPartMeshes(torso, [spineBend]);
    clearPartMeshes(spineBend, [head, rightArm, leftArm]);
    clearPartMeshes(head);
    clearPartMeshes(rightArm, [rightElbow]);
    clearPartMeshes(rightElbow, [handMount]);
    clearPartMeshes(leftArm, [leftElbow]);
    clearPartMeshes(leftElbow, [offhandMount]);
    clearPartMeshes(rightLeg, [rightKnee]);
    clearPartMeshes(rightKnee);
    clearPartMeshes(leftLeg, [leftKnee]);
    clearPartMeshes(leftKnee);

    // Torso: lower waist (y=0..6px) + upper chest (spineBend, y=0..6px)
    const waistBase = reg(makeSubBox(8, 12, 4, 16, 16, 'lower', baseMat, characterId));
    waistBase.position.set(0, 3 * PX, 0);
    torso.add(waistBase);
    const waistOver = reg(makeSubBox(8, 12, 4, 16, 32, 'lower', overlayMat, characterId, 0.25), true);
    waistOver.position.set(0, 3 * PX, 0);
    torso.add(waistOver);

    const chestBase = reg(makeSubBox(8, 12, 4, 16, 16, 'upper', baseMat, characterId));
    chestBase.position.set(0, 3 * PX, 0);
    spineBend.add(chestBase);
    const chestOver = reg(makeSubBox(8, 12, 4, 16, 32, 'upper', overlayMat, characterId, 0.25), true);
    chestOver.position.set(0, 3 * PX, 0);
    spineBend.add(chestOver);

    // Head (8x8x8)
    const headBase = reg(makeFullBox(8, 8, 8, 0, 0, baseMat, characterId));
    headBase.position.set(0, 4 * PX, 0);
    head.add(headBase);
    const headOver = reg(makeFullBox(8, 8, 8, 32, 0, overlayMat, characterId, 0.45), true);
    headOver.position.set(0, 4 * PX, 0);
    head.add(headOver);

    // Arms (4px or 3px wide, split at elbow: upper 6px centered at -1px from shoulder pivot, forearm 6px centered at -3px from elbow)
    const armW = modelType === 'slim' ? 3 : 4;
    const armOffsetX = modelType === 'slim' ? 5.5 * PX : 6 * PX;
    rightArm.position.set(-armOffsetX, 4 * PX, 0);
    leftArm.position.set(armOffsetX, 4 * PX, 0);

    // Right Arm
    const rUpperArm = reg(makeSubBox(armW, 12, 4, 40, 16, 'upper', baseMat, characterId));
    rUpperArm.position.set(0, -1 * PX, 0);
    rightArm.add(rUpperArm);
    const rUpperArmOver = reg(makeSubBox(armW, 12, 4, 40, 32, 'upper', overlayMat, characterId, 0.25), true);
    rUpperArmOver.position.set(0, -1 * PX, 0);
    rightArm.add(rUpperArmOver);

    const rForearm = reg(makeSubBox(armW, 12, 4, 40, 16, 'lower', baseMat, characterId));
    rForearm.position.set(0, -3 * PX, 0);
    rightElbow.add(rForearm);
    const rForearmOver = reg(makeSubBox(armW, 12, 4, 40, 32, 'lower', overlayMat, characterId, 0.25), true);
    rForearmOver.position.set(0, -3 * PX, 0);
    rightElbow.add(rForearmOver);

    // Left Arm
    const lUpperArm = reg(makeSubBox(armW, 12, 4, 32, 48, 'upper', baseMat, characterId));
    lUpperArm.position.set(0, -1 * PX, 0);
    leftArm.add(lUpperArm);
    const lUpperArmOver = reg(makeSubBox(armW, 12, 4, 48, 48, 'upper', overlayMat, characterId, 0.25), true);
    lUpperArmOver.position.set(0, -1 * PX, 0);
    leftArm.add(lUpperArmOver);

    const lForearm = reg(makeSubBox(armW, 12, 4, 32, 48, 'lower', baseMat, characterId));
    lForearm.position.set(0, -3 * PX, 0);
    leftElbow.add(lForearm);
    const lForearmOver = reg(makeSubBox(armW, 12, 4, 48, 48, 'lower', overlayMat, characterId, 0.25), true);
    lForearmOver.position.set(0, -3 * PX, 0);
    leftElbow.add(lForearmOver);

    // Legs (thigh 6px centered at -3px below hip, shin 6px centered at -3px below knee)
    const rThigh = reg(makeSubBox(4, 12, 4, 0, 16, 'upper', baseMat, characterId));
    rThigh.position.set(0, -3 * PX, 0);
    rightLeg.add(rThigh);
    const rThighOver = reg(makeSubBox(4, 12, 4, 0, 32, 'upper', overlayMat, characterId, 0.25), true);
    rThighOver.position.set(0, -3 * PX, 0);
    rightLeg.add(rThighOver);

    const rShin = reg(makeSubBox(4, 12, 4, 0, 16, 'lower', baseMat, characterId));
    rShin.position.set(0, -3 * PX, 0);
    rightKnee.add(rShin);
    const rShinOver = reg(makeSubBox(4, 12, 4, 0, 32, 'lower', overlayMat, characterId, 0.25), true);
    rShinOver.position.set(0, -3 * PX, 0);
    rightKnee.add(rShinOver);

    const lThigh = reg(makeSubBox(4, 12, 4, 16, 48, 'upper', baseMat, characterId));
    lThigh.position.set(0, -3 * PX, 0);
    leftLeg.add(lThigh);
    const lThighOver = reg(makeSubBox(4, 12, 4, 0, 48, 'upper', overlayMat, characterId, 0.25), true);
    lThighOver.position.set(0, -3 * PX, 0);
    leftLeg.add(lThighOver);

    const lShin = reg(makeSubBox(4, 12, 4, 16, 48, 'lower', baseMat, characterId));
    lShin.position.set(0, -3 * PX, 0);
    leftKnee.add(lShin);
    const lShinOver = reg(makeSubBox(4, 12, 4, 0, 48, 'lower', overlayMat, characterId, 0.25), true);
    lShinOver.position.set(0, -3 * PX, 0);
    leftKnee.add(lShinOver);
  };

  rebuildModel('classic');

  const setTexture = (texture: THREE.Texture) => {
    baseMat.map = texture;
    overlayMat.map = texture;
    baseMat.needsUpdate = true;
    overlayMat.needsUpdate = true;
  };

  const setOverlayVisible = (visible: boolean) => {
    overlayVisible = visible;
    for (const m of overlayMeshes) m.visible = visible;
  };

  const disposeItemGroup = (group: THREE.Group | null, parent: THREE.Group) => {
    if (!group) return;
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if ((m as THREE.MeshStandardMaterial).map) {
            (m as THREE.MeshStandardMaterial).map?.dispose();
          }
          m.dispose();
        }
      }
    });
    parent.remove(group);
  };

  const setHeldItem = (slot: 'main' | 'offhand', itemId: string, enchanted: boolean) => {
    if (slot === 'main') {
      disposeItemGroup(mainItemGroup, handMount);
      mainItemGroup = null;
      const created = createMinecraftItemMountGroup(itemId, enchanted, false, characterId);
      if (created) {
        handMount.add(created);
        mainItemGroup = created;
      }
    } else {
      disposeItemGroup(offhandItemGroup, offhandMount);
      offhandItemGroup = null;
      const created = createMinecraftItemMountGroup(itemId, enchanted, true, characterId);
      if (created) {
        offhandMount.add(created);
        offhandItemGroup = created;
      }
    }
  };

  const updateEnchantShimmer = (elapsedSec: number) => {
    const pulse = 0.42 + Math.sin(elapsedSec * 4.2) * 0.24;
    for (const grp of [mainItemGroup, offhandItemGroup]) {
      if (!grp) continue;
      grp.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.userData.enchanted) {
          const mat = obj.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = pulse;
        }
      });
    }
  };

  const setSelected = (selected: boolean) => {
    selectionRing.visible = selected;
  };

  const applyPose = (
    basePosition: Vec3,
    baseYaw: number,
    pose: { rootOffset: Vec3; rootYawOffset: number; bones: Record<BoneId, Vec3> },
  ) => {
    const wx = basePosition[0] + pose.rootOffset[0];
    const wy = basePosition[1] + pose.rootOffset[1];
    const wz = basePosition[2] + pose.rootOffset[2];

    // Keep floor ring and contact shadow at actor's XZ ground plane
    actorRoot.position.set(wx, wy, wz);
    actorRoot.rotation.set(0, (baseYaw + pose.rootYawOffset) * DEG2RAD, 0);

    selectionRing.position.set(wx, basePosition[1] + 0.014, wz);
    contactShadow.position.set(wx, basePosition[1] + 0.008, wz);
    const lift = Math.max(0, pose.rootOffset[1]);
    contactShadow.scale.setScalar(Math.max(0.45, 1 - lift * 0.45));
    shadowMat.opacity = Math.max(0.18, 0.6 - lift * 0.32);

    (Object.keys(bones) as BoneId[]).forEach((boneId) => {
      const [rx, ry, rz] = pose.bones[boneId] ?? [0, 0, 0];
      bones[boneId].rotation.set(rx * DEG2RAD, ry * DEG2RAD, rz * DEG2RAD, 'YXZ');
    });
  };

  const dispose = () => {
    disposeBuiltGeometries();
    disposeItemGroup(mainItemGroup, handMount);
    disposeItemGroup(offhandItemGroup, offhandMount);
    mainItemGroup = null;
    offhandItemGroup = null;
    baseMat.dispose();
    overlayMat.dispose();
    ringGeo.dispose();
    ringMat.dispose();
    shadowTex.dispose();
    shadowGeo.dispose();
    shadowMat.dispose();
  };

  return {
    characterId,
    root,
    actorRoot,
    selectionRing,
    contactShadow,
    bones,
    handMount,
    offhandMount,
    overlayMeshes,
    materials: { base: baseMat, overlay: overlayMat },
    rebuildModel,
    setTexture,
    setOverlayVisible,
    setHeldItem,
    updateEnchantShimmer,
    setSelected,
    applyPose,
    dispose,
  };
}

// ---------- High-Effort Catmull-Rom + Eased Pose Evaluator ----------

function applyEasing(t: number, mode: EasingMode = 'easeInOut'): number {
  const x = Math.max(0, Math.min(1, t));
  switch (mode) {
    case 'linear':
      return x;
    case 'snap':
      return 1 - Math.pow(1 - x, 3.4);
    case 'bounce': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }
    case 'easeInOut':
    default:
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

const BONE_IDS = Object.keys(EMPTY_BONES) as BoneId[];

export function sampleTrackAtTime(
  track: CharacterAnimationTrack | undefined,
  duration: number,
  loop: boolean,
  timeSec: number,
): { rootOffset: Vec3; rootYawOffset: number; bones: Record<BoneId, Vec3> } {
  const frames: KeyframePose[] = track?.keyframes ?? [];
  if (!frames.length) {
    return {
      rootOffset: [0, 0, 0],
      rootYawOffset: 0,
      bones: { ...EMPTY_BONES },
    };
  }
  if (frames.length === 1) {
    return {
      rootOffset: frames[0].rootOffset ?? [0, 0, 0],
      rootYawOffset: frames[0].rootYawOffset ?? 0,
      bones: { ...EMPTY_BONES, ...frames[0].bones },
    };
  }

  const safeDur = Math.max(0.1, duration);
  const clampedTime = loop
    ? ((timeSec % safeDur) + safeDur) % safeDur
    : Math.max(0, Math.min(safeDur, timeSec));

  let i1 = 0;
  for (let i = 0; i < frames.length - 1; i++) {
    if (clampedTime >= frames[i].time && clampedTime <= frames[i + 1].time) {
      i1 = i;
      break;
    }
    if (i === frames.length - 2 && clampedTime > frames[i + 1].time) {
      i1 = frames.length - 1;
    }
  }

  const i2 = i1 < frames.length - 1 ? i1 + 1 : loop ? 0 : i1;
  const i0 = i1 > 0 ? i1 - 1 : loop ? Math.max(0, frames.length - 2) : 0;
  const i3 = i2 < frames.length - 1 ? i2 + 1 : loop ? Math.min(1, frames.length - 1) : i2;

  const k0 = frames[i0];
  const k1 = frames[i1];
  const k2 = frames[i2];
  const k3 = frames[i3];

  const span =
    k2 === k1
      ? 1
      : k2.time >= k1.time
        ? k2.time - k1.time
        : safeDur - k1.time + k2.time;
  const elapsed =
    clampedTime >= k1.time ? clampedTime - k1.time : safeDur - k1.time + clampedTime;
  const rawT = span > 0.0001 ? elapsed / span : 0;
  const easing = k2.easing ?? 'easeInOut';
  const alpha = applyEasing(rawT, easing);

  const interpScalar = (v0: number, v1: number, v2: number, v3: number) => {
    if (easing === 'snap' || easing === 'linear') {
      return v1 + (v2 - v1) * alpha;
    }
    // Blend Catmull-Rom arc with eased linear to keep smooth continuity without wild overshoot
    const cr = catmullRom(v0, v1, v2, v3, rawT);
    const lin = v1 + (v2 - v1) * alpha;
    return cr * 0.45 + lin * 0.55;
  };

  const interpVec3 = (v0: Vec3, v1: Vec3, v2: Vec3, v3: Vec3): Vec3 => [
    interpScalar(v0[0], v1[0], v2[0], v3[0]),
    interpScalar(v0[1], v1[1], v2[1], v3[1]),
    interpScalar(v0[2], v1[2], v2[2], v3[2]),
  ];

  const outBones = {} as Record<BoneId, Vec3>;
  for (const id of BONE_IDS) {
    outBones[id] = interpVec3(
      k0.bones[id] ?? [0, 0, 0],
      k1.bones[id] ?? [0, 0, 0],
      k2.bones[id] ?? [0, 0, 0],
      k3.bones[id] ?? [0, 0, 0],
    );
  }

  return {
    rootOffset: interpVec3(
      k0.rootOffset ?? [0, 0, 0],
      k1.rootOffset ?? [0, 0, 0],
      k2.rootOffset ?? [0, 0, 0],
      k3.rootOffset ?? [0, 0, 0],
    ),
    rootYawOffset: interpScalar(
      k0.rootYawOffset ?? 0,
      k1.rootYawOffset ?? 0,
      k2.rootYawOffset ?? 0,
      k3.rootYawOffset ?? 0,
    ),
    bones: outBones,
  };
}
