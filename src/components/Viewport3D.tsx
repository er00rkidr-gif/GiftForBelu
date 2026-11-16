import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildSchematicWorld, BuiltSchematicWorld } from '../lib/minecraftBlocks';
import { MINECRAFT_ITEM_MAP } from '../lib/minecraftItems';
import { createMinecraftRig, MinecraftRig, sampleTrackAtTime } from '../lib/minecraftRig';
import {
  createSkinTextureFromCanvas,
  loadImageFromDataUrl,
  normalizeSkinImage,
} from '../lib/minecraftSkin';
import { ActorVfxSnapshot, MinecraftVfxSystem } from '../lib/minecraftVfx';
import {
  AnimationData,
  CameraPreset,
  LightingMood,
  SceneCharacter,
  SchematicMapData,
  WeatherPreset,
} from '../types/animation';

export interface Viewport3DHandle {
  captureScreenshot: () => void;
  startVideoRecording: (durationSec: number) => Promise<void>;
}

interface Viewport3DProps {
  characters: SceneCharacter[];
  selectedCharacterId: string;
  onSelectCharacter: (id: string) => void;
  schematicMap: SchematicMapData;
  mapOffsetY: number;
  weatherPreset: WeatherPreset;
  lightingMood: LightingMood;
  animation: AnimationData;
  isPlaying: boolean;
  playbackSpeed: number;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  cameraPreset: CameraPreset;
  cameraTrigger: number;
}

const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  threeQuarter: { pos: [3.2, 2.5, 4.2], target: [0, 1.0, 0] },
  front: { pos: [0, 1.7, 5.0], target: [0, 1.0, 0] },
  side: { pos: [5.0, 1.7, 0.2], target: [0, 1.0, 0] },
  lowAction: { pos: [2.2, 0.85, 3.2], target: [0, 1.1, 0] },
  wideStage: { pos: [8.5, 6.5, 10.5], target: [0, 1.2, 0] },
};

const LIGHTING_MOODS: Record<
  LightingMood,
  {
    bg: number;
    fogDensity: number;
    keyColor: number;
    keyIntensity: number;
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    rimColor: number;
    rimIntensity: number;
  }
> = {
  studio: {
    bg: 0x0e131a,
    fogDensity: 0.018,
    keyColor: 0xfff5e4,
    keyIntensity: 2.35,
    hemiSky: 0xdbeafe,
    hemiGround: 0x1e293b,
    hemiIntensity: 0.95,
    rimColor: 0x38bdf8,
    rimIntensity: 0.9,
  },
  sunset: {
    bg: 0x1c1218,
    fogDensity: 0.022,
    keyColor: 0xff9e5e,
    keyIntensity: 2.6,
    hemiSky: 0xfdba74,
    hemiGround: 0x311d2f,
    hemiIntensity: 0.85,
    rimColor: 0xa855f7,
    rimIntensity: 1.0,
  },
  moonlight: {
    bg: 0x060a14,
    fogDensity: 0.026,
    keyColor: 0x93c5fd,
    keyIntensity: 1.45,
    hemiSky: 0x3b82f6,
    hemiGround: 0x090d16,
    hemiIntensity: 0.65,
    rimColor: 0x22d3ee,
    rimIntensity: 1.15,
  },
  nether: {
    bg: 0x1a0808,
    fogDensity: 0.028,
    keyColor: 0xf97316,
    keyIntensity: 2.1,
    hemiSky: 0xdc2626,
    hemiGround: 0x2a0808,
    hemiIntensity: 0.8,
    rimColor: 0xfacc15,
    rimIntensity: 1.0,
  },
};

interface RigEntry {
  rig: MinecraftRig;
  texture: THREE.Texture | null;
  lastSkinUrl: string;
  lastModelType: string;
  lastOverlay: boolean;
  lastMainItem: string;
  lastMainEnchant: boolean;
  lastOffhandItem: string;
  lastOffhandEnchant: boolean;
  prevRightHand: THREE.Vector3;
  prevLeftHand: THREE.Vector3;
  prevRoot: THREE.Vector3;
  hasPrev: boolean;
  vfxSnapshot: ActorVfxSnapshot;
}

const _tmpRight = new THREE.Vector3();
const _tmpLeft = new THREE.Vector3();
const _tmpRoot = new THREE.Vector3();

export const Viewport3D = forwardRef<Viewport3DHandle, Viewport3DProps>(
  function Viewport3D(
    {
      characters,
      selectedCharacterId,
      onSelectCharacter,
      schematicMap,
      mapOffsetY,
      weatherPreset,
      lightingMood,
      animation,
      isPlaying,
      playbackSpeed,
      currentTime,
      onTimeUpdate,
      onPlayStateChange,
      cameraPreset,
      cameraTrigger,
    },
    ref,
  ) {
    const mountRef = useRef<HTMLDivElement>(null);
    const [contextLost, setContextLost] = useState(false);

    const stateRef = useRef({
      characters,
      selectedCharacterId,
      onSelectCharacter,
      animation,
      isPlaying,
      playbackSpeed,
      currentTime,
      onTimeUpdate,
      onPlayStateChange,
    });
    stateRef.current = {
      characters,
      selectedCharacterId,
      onSelectCharacter,
      animation,
      isPlaying,
      playbackSpeed,
      currentTime,
      onTimeUpdate,
      onPlayStateChange,
    };

    const sceneObjectsRef = useRef<{
      renderer: THREE.WebGLRenderer;
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      controls: OrbitControls;
      hemiLight: THREE.HemisphereLight;
      keyLight: THREE.DirectionalLight;
      rimLight: THREE.DirectionalLight;
      worldContainer: THREE.Group;
      actorsContainer: THREE.Group;
      vfx: MinecraftVfxSystem;
      builtWorld: BuiltSchematicWorld | null;
      rigEntries: Map<string, RigEntry>;
      camGoalPos: THREE.Vector3 | null;
      camGoalTarget: THREE.Vector3 | null;
    } | null>(null);

    useImperativeHandle(ref, () => ({
      captureScreenshot: () => {
        const objs = sceneObjectsRef.current;
        if (!objs) return;
        objs.renderer.render(objs.scene, objs.camera);
        const dataUrl = objs.renderer.domElement.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${stateRef.current.animation.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')}.png`;
        link.href = dataUrl;
        link.click();
      },
      startVideoRecording: async (durationSec: number) => {
        const objs = sceneObjectsRef.current;
        if (!objs) return;
        const canvas = objs.renderer.domElement;
        if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
          throw new Error('Video capture is not supported in this browser.');
        }

        const stream = canvas.captureStream(30);
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm';
        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: BlobPart[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        const donePromise = new Promise<void>((resolve) => {
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${stateRef.current.animation.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')}.webm`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            resolve();
          };
        });

        stateRef.current.onTimeUpdate(0);
        stateRef.current.onPlayStateChange(true);
        recorder.start();
        await new Promise((r) => setTimeout(r, Math.max(800, durationSec * 1000)));
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        await donePromise;
      },
    }));

    // Initialize Three.js Studio once
    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const isSoftwareGl = (() => {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      })();

      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;

      const renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);

      const handleContextLost = (e: Event) => {
        e.preventDefault();
        setContextLost(true);
      };
      const handleContextRestored = () => {
        setContextLost(false);
      };
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0e131a);
      scene.fog = new THREE.FogExp2(0x0e131a, 0.018);

      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();

      const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 220);
      camera.position.set(3.2, 2.5, 4.2);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 1.0, 0);
      controls.enableDamping = !isSoftwareGl;
      controls.dampingFactor = 0.07;
      controls.minDistance = 1.6;
      controls.maxDistance = 42;
      controls.maxPolarAngle = Math.PI * 0.495;

      const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.95);
      scene.add(hemiLight);

      const keyLight = new THREE.DirectionalLight(0xfff5e4, 2.35);
      keyLight.position.set(8, 14, 9);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(2048, 2048);
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 45;
      keyLight.shadow.camera.left = -14;
      keyLight.shadow.camera.right = 14;
      keyLight.shadow.camera.top = 14;
      keyLight.shadow.camera.bottom = -14;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
      rimLight.position.set(-7, 6, -8);
      scene.add(rimLight);

      const worldContainer = new THREE.Group();
      scene.add(worldContainer);

      const actorsContainer = new THREE.Group();
      scene.add(actorsContainer);

      const vfx = new MinecraftVfxSystem();
      scene.add(vfx.group);

      const objs = {
        renderer,
        scene,
        camera,
        controls,
        hemiLight,
        keyLight,
        rimLight,
        worldContainer,
        actorsContainer,
        vfx,
        builtWorld: null as BuiltSchematicWorld | null,
        rigEntries: new Map<string, RigEntry>(),
        camGoalPos: null as THREE.Vector3 | null,
        camGoalTarget: null as THREE.Vector3 | null,
      };
      sceneObjectsRef.current = objs;

      const cancelCamGoal = () => {
        objs.camGoalPos = null;
        objs.camGoalTarget = null;
      };
      controls.addEventListener('start', cancelCamGoal);

      // Raycasting click-to-select any character
      const raycaster = new THREE.Raycaster();
      const pointerDownPos = { x: 0, y: 0 };
      const pointerNdc = new THREE.Vector2();

      const onPointerDown = (e: PointerEvent) => {
        pointerDownPos.x = e.clientX;
        pointerDownPos.y = e.clientY;
      };

      const onPointerUp = (e: PointerEvent) => {
        const dx = e.clientX - pointerDownPos.x;
        const dy = e.clientY - pointerDownPos.y;
        if (Math.hypot(dx, dy) > 6) return;

        const rect = renderer.domElement.getBoundingClientRect();
        pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointerNdc, camera);
        const hits = raycaster.intersectObjects(actorsContainer.children, true);
        for (const hit of hits) {
          const cid = hit.object.userData?.characterId;
          if (typeof cid === 'string') {
            stateRef.current.onSelectCharacter(cid);
            break;
          }
        }
      };

      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointerup', onPointerUp);

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }

      const handleResize = () => {
        if (!container) return;
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', handleResize);

      let frameId = 0;
      let lastNow = performance.now();
      let lastUiSync = 0;
      let localTime = stateRef.current.currentTime;
      const vfxSnapshots: ActorVfxSnapshot[] = [];

      function afterDraw(cb: () => void) {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      }

      const tick = (now: number) => {
        const delta = Math.min(0.1, Math.max(0.001, (now - lastNow) / 1000));
        lastNow = now;
        const elapsedSec = now / 1000;

        const st = stateRef.current;

        if (st.isPlaying) {
          localTime += delta * st.playbackSpeed;
          const dur = Math.max(0.1, st.animation.duration);
          if (localTime >= dur) {
            if (st.animation.loop) {
              localTime = localTime % dur;
            } else {
              localTime = dur;
              st.onPlayStateChange(false);
            }
          }
          if (now - lastUiSync > 32) {
            lastUiSync = now;
            st.onTimeUpdate(localTime);
          }
        } else {
          localTime = st.currentTime;
        }

        const fallbackTrack =
          st.animation.tracks['default'] || Object.values(st.animation.tracks)[0];

        vfxSnapshots.length = 0;

        for (const char of st.characters) {
          const entry = objs.rigEntries.get(char.id);
          if (!entry) continue;
          const track = st.animation.tracks[char.id] || fallbackTrack;
          const pose = sampleTrackAtTime(
            track,
            st.animation.duration,
            st.animation.loop,
            localTime,
          );
          entry.rig.applyPose(char.basePosition, char.baseYaw, pose);
          entry.rig.setSelected(char.id === st.selectedCharacterId);
          entry.rig.updateEnchantShimmer(elapsedSec);
          entry.rig.actorRoot.updateMatrixWorld(true);

          // Sample world hand & root positions for velocity-driven VFX
          entry.rig.handMount.getWorldPosition(_tmpRight);
          entry.rig.offhandMount.getWorldPosition(_tmpLeft);
          entry.rig.actorRoot.getWorldPosition(_tmpRoot);

          let rightSpeed = 0;
          let leftSpeed = 0;
          let rootSpeed = 0;
          if (entry.hasPrev && st.isPlaying) {
            rightSpeed = _tmpRight.distanceTo(entry.prevRightHand) / delta;
            leftSpeed = _tmpLeft.distanceTo(entry.prevLeftHand) / delta;
            rootSpeed = _tmpRoot.distanceTo(entry.prevRoot) / delta;
          }
          entry.prevRightHand.copy(_tmpRight);
          entry.prevLeftHand.copy(_tmpLeft);
          entry.prevRoot.copy(_tmpRoot);
          entry.hasPrev = true;

          const mainDef = MINECRAFT_ITEM_MAP.get(char.heldProp);
          const offDef = MINECRAFT_ITEM_MAP.get(char.offhandItem);
          const lightDef = mainDef?.lightColor ? mainDef : offDef?.lightColor ? offDef : undefined;

          const snap = entry.vfxSnapshot;
          snap.worldPos.copy(_tmpRoot);
          snap.rightHandPos.copy(_tmpRight);
          snap.leftHandPos.copy(_tmpLeft);
          snap.rightHandSpeed = rightSpeed;
          snap.leftHandSpeed = leftSpeed;
          snap.rootSpeed = rootSpeed;
          snap.vfxPreset = char.vfxPreset;
          snap.hasTorchLight = Boolean(lightDef?.lightColor);
          snap.torchColor = lightDef?.lightColor ?? 0xf97316;
          snap.hasEnchanted = char.enchantedMainHand || char.enchantedOffhand;

          vfxSnapshots.push(snap);
        }

        vfx.update(delta, vfxSnapshots);

        // Smooth camera preset transitions
        if (objs.camGoalPos && objs.camGoalTarget) {
          camera.position.x = THREE.MathUtils.damp(camera.position.x, objs.camGoalPos.x, 7, delta);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, objs.camGoalPos.y, 7, delta);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, objs.camGoalPos.z, 7, delta);
          controls.target.x = THREE.MathUtils.damp(controls.target.x, objs.camGoalTarget.x, 7, delta);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, objs.camGoalTarget.y, 7, delta);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, objs.camGoalTarget.z, 7, delta);

          if (camera.position.distanceTo(objs.camGoalPos) < 0.015) {
            objs.camGoalPos = null;
            objs.camGoalTarget = null;
          }
        }

        controls.update();
        renderer.render(scene, camera);

        if (isSoftwareGl) {
          afterDraw(() => tick(performance.now()));
        } else {
          frameId = requestAnimationFrame(tick);
        }
      };

      frameId = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        window.removeEventListener('resize', handleResize);
        controls.removeEventListener('start', cancelCamGoal);
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
        renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

        controls.dispose();
        vfx.dispose();
        objs.builtWorld?.dispose();
        for (const entry of objs.rigEntries.values()) {
          entry.rig.dispose();
          entry.texture?.dispose();
        }
        objs.rigEntries.clear();
        scene.environment?.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
        sceneObjectsRef.current = null;
      };
    }, []);

    // Rebuild Schematic Map
    useEffect(() => {
      const objs = sceneObjectsRef.current;
      if (!objs) return;

      if (objs.builtWorld) {
        objs.worldContainer.remove(objs.builtWorld.group);
        objs.builtWorld.dispose();
        objs.builtWorld = null;
      }

      const maxAniso = objs.renderer.capabilities.getMaxAnisotropy();
      const built = buildSchematicWorld(schematicMap, maxAniso);
      objs.builtWorld = built;
      objs.worldContainer.add(built.group);
    }, [schematicMap]);

    // Sync world Y offset
    useEffect(() => {
      const objs = sceneObjectsRef.current;
      if (!objs) return;
      objs.worldContainer.position.y = mapOffsetY;
    }, [mapOffsetY]);

    // Sync weather & lighting mood
    useEffect(() => {
      sceneObjectsRef.current?.vfx.setWeather(weatherPreset);
    }, [weatherPreset]);

    useEffect(() => {
      const objs = sceneObjectsRef.current;
      if (!objs) return;
      const m = LIGHTING_MOODS[lightingMood];
      objs.scene.background = new THREE.Color(m.bg);
      objs.scene.fog = new THREE.FogExp2(m.bg, m.fogDensity);
      objs.keyLight.color.setHex(m.keyColor);
      objs.keyLight.intensity = m.keyIntensity;
      objs.hemiLight.color.setHex(m.hemiSky);
      objs.hemiLight.groundColor.setHex(m.hemiGround);
      objs.hemiLight.intensity = m.hemiIntensity;
      objs.rimLight.color.setHex(m.rimColor);
      objs.rimLight.intensity = m.rimIntensity;
    }, [lightingMood]);

    // Sync Scene Characters (rigs, skins, dual items, enchantments)
    useEffect(() => {
      const objs = sceneObjectsRef.current;
      if (!objs) return;

      const activeIds = new Set(characters.map((c) => c.id));
      const maxAniso = objs.renderer.capabilities.getMaxAnisotropy();

      for (const [id, entry] of objs.rigEntries.entries()) {
        if (!activeIds.has(id)) {
          objs.actorsContainer.remove(entry.rig.root);
          entry.rig.dispose();
          entry.texture?.dispose();
          objs.rigEntries.delete(id);
        }
      }

      for (const char of characters) {
        let entry = objs.rigEntries.get(char.id);
        if (!entry) {
          const blankCanvas = document.createElement('canvas');
          blankCanvas.width = 64;
          blankCanvas.height = 64;
          const blankTex = createSkinTextureFromCanvas(blankCanvas, maxAniso);
          const rig = createMinecraftRig(char.id, blankTex);
          objs.actorsContainer.add(rig.root);
          entry = {
            rig,
            texture: blankTex,
            lastSkinUrl: '',
            lastModelType: '',
            lastOverlay: true,
            lastMainItem: 'none',
            lastMainEnchant: false,
            lastOffhandItem: 'none',
            lastOffhandEnchant: false,
            prevRightHand: new THREE.Vector3(),
            prevLeftHand: new THREE.Vector3(),
            prevRoot: new THREE.Vector3(),
            hasPrev: false,
            vfxSnapshot: {
              id: char.id,
              worldPos: new THREE.Vector3(),
              rightHandPos: new THREE.Vector3(),
              leftHandPos: new THREE.Vector3(),
              rightHandSpeed: 0,
              leftHandSpeed: 0,
              rootSpeed: 0,
              vfxPreset: char.vfxPreset,
              hasTorchLight: false,
              torchColor: 0xf97316,
              hasEnchanted: false,
            },
          };
          objs.rigEntries.set(char.id, entry);
        }

        if (entry.lastModelType !== char.modelType) {
          entry.rig.rebuildModel(char.modelType);
          entry.lastModelType = char.modelType;
        }
        if (entry.lastOverlay !== char.showOverlayLayer) {
          entry.rig.setOverlayVisible(char.showOverlayLayer);
          entry.lastOverlay = char.showOverlayLayer;
        }
        if (
          entry.lastMainItem !== char.heldProp ||
          entry.lastMainEnchant !== char.enchantedMainHand
        ) {
          entry.rig.setHeldItem('main', char.heldProp, char.enchantedMainHand);
          entry.lastMainItem = char.heldProp;
          entry.lastMainEnchant = char.enchantedMainHand;
        }
        if (
          entry.lastOffhandItem !== char.offhandItem ||
          entry.lastOffhandEnchant !== char.enchantedOffhand
        ) {
          entry.rig.setHeldItem('offhand', char.offhandItem, char.enchantedOffhand);
          entry.lastOffhandItem = char.offhandItem;
          entry.lastOffhandEnchant = char.enchantedOffhand;
        }
        if (entry.lastSkinUrl !== char.skinDataUrl && char.skinDataUrl) {
          entry.lastSkinUrl = char.skinDataUrl;
          const targetEntry = entry;
          const targetUrl = char.skinDataUrl;
          loadImageFromDataUrl(targetUrl)
            .then((img) => {
              if (targetEntry.lastSkinUrl !== targetUrl) return;
              const { canvas } = normalizeSkinImage(img);
              const newTex = createSkinTextureFromCanvas(canvas, maxAniso);
              const oldTex = targetEntry.texture;
              targetEntry.rig.setTexture(newTex);
              targetEntry.texture = newTex;
              oldTex?.dispose();
            })
            .catch((err) => console.error('Failed to decode skin:', err));
        }
      }
    }, [characters]);

    // Smooth camera preset transitions
    useEffect(() => {
      const objs = sceneObjectsRef.current;
      if (!objs || cameraTrigger === 0) return;
      const preset = CAMERA_PRESETS[cameraPreset];
      objs.camGoalPos = new THREE.Vector3(...preset.pos);
      objs.camGoalTarget = new THREE.Vector3(...preset.target);
    }, [cameraPreset, cameraTrigger]);

    return (
      <div className="relative w-full h-full overflow-hidden bg-[#0E131A]">
        <div ref={mountRef} className="w-full h-full" />
        {contextLost && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0E131A]/90 text-center p-6">
            <div className="max-w-sm space-y-2">
              <p className="font-display text-lg font-semibold text-zinc-100">
                3D Viewport Paused
              </p>
              <p className="text-sm text-zinc-400">
                WebGL context was interrupted. Restoring the character studio automatically.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  },
);
