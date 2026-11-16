import * as THREE from 'three';
import { VfxPreset, WeatherPreset } from '../types/animation';

interface VoxelParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  size: number;
  gravity: number;
  r: number;
  g: number;
  b: number;
}

interface SlashEffect {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
  baseScale: number;
}

export interface ActorVfxSnapshot {
  id: string;
  worldPos: THREE.Vector3;
  rightHandPos: THREE.Vector3;
  leftHandPos: THREE.Vector3;
  rightHandSpeed: number;
  leftHandSpeed: number;
  rootSpeed: number;
  vfxPreset: VfxPreset;
  hasTorchLight: boolean;
  torchColor: number;
  hasEnchanted: boolean;
}

const MAX_VOXEL_PARTICLES = 450;
const MAX_WEATHER_PARTICLES = 240;

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export class MinecraftVfxSystem {
  public readonly group = new THREE.Group();

  private particles: VoxelParticle[] = [];
  private particleMesh: THREE.InstancedMesh;
  private particleCursor = 0;

  private weatherMesh: THREE.InstancedMesh;
  private weatherData: Array<{
    x: number;
    y: number;
    z: number;
    vy: number;
    vx: number;
    vz: number;
    rot: number;
  }> = [];
  private currentWeather: WeatherPreset = 'clear';

  private slashes: SlashEffect[] = [];
  private slashGeo: THREE.RingGeometry;
  private actorCooldowns = new Map<string, number>();
  private emitAccum = 0;

  constructor() {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const voxelMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
    });
    this.particleMesh = new THREE.InstancedMesh(boxGeo, voxelMat, MAX_VOXEL_PARTICLES);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;

    for (let i = 0; i < MAX_VOXEL_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        maxAge: 1,
        size: 0.08,
        gravity: 0,
        r: 1,
        g: 1,
        b: 1,
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      _color.setRGB(1, 1, 1);
      this.particleMesh.setColorAt(i, _color);
    }
    this.group.add(this.particleMesh);

    // Weather InstancedMesh
    const weatherGeo = new THREE.BoxGeometry(1, 1, 1);
    const weatherMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.78,
    });
    this.weatherMesh = new THREE.InstancedMesh(weatherGeo, weatherMat, MAX_WEATHER_PARTICLES);
    this.weatherMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.weatherMesh.frustumCulled = false;
    this.weatherMesh.visible = false;

    for (let i = 0; i < MAX_WEATHER_PARTICLES; i++) {
      this.weatherData.push({
        x: (Math.random() - 0.5) * 24,
        y: Math.random() * 12,
        z: (Math.random() - 0.5) * 24,
        vy: -4,
        vx: 0,
        vz: 0,
        rot: Math.random() * Math.PI,
      });
    }
    this.group.add(this.weatherMesh);

    // Sweep Slash Crescent Geometry
    this.slashGeo = new THREE.RingGeometry(0.45, 0.85, 20, 1, -Math.PI * 0.42, Math.PI * 0.84);
    this.slashGeo.rotateX(-Math.PI / 2);
  }

  public setWeather(weather: WeatherPreset) {
    if (this.currentWeather === weather) return;
    this.currentWeather = weather;
    this.weatherMesh.visible = weather !== 'clear';

    for (let i = 0; i < MAX_WEATHER_PARTICLES; i++) {
      const w = this.weatherData[i];
      w.x = (Math.random() - 0.5) * 24;
      w.y = Math.random() * 12;
      w.z = (Math.random() - 0.5) * 24;

      if (weather === 'rain') {
        w.vy = -12 - Math.random() * 4;
        w.vx = -0.5;
        w.vz = 0.2;
        _color.setHex(0x60a5fa);
      } else if (weather === 'snow') {
        w.vy = -1.4 - Math.random() * 0.8;
        w.vx = (Math.random() - 0.5) * 0.8;
        w.vz = (Math.random() - 0.5) * 0.8;
        _color.setHex(0xf8fafc);
      } else if (weather === 'cherry') {
        w.vy = -1.1 - Math.random() * 0.6;
        w.vx = 0.6 + Math.random() * 0.6;
        w.vz = (Math.random() - 0.5) * 0.5;
        _color.setHex(Math.random() > 0.35 ? 0xf9a8d4 : 0xf472b6);
      } else if (weather === 'ash') {
        w.vy = 0.7 + Math.random() * 0.9;
        w.vx = (Math.random() - 0.5) * 0.7;
        w.vz = (Math.random() - 0.5) * 0.7;
        _color.setHex(Math.random() > 0.3 ? 0xf97316 : 0xef4444);
      }
      this.weatherMesh.setColorAt(i, _color);
    }
    if (this.weatherMesh.instanceColor) {
      this.weatherMesh.instanceColor.needsUpdate = true;
    }
  }

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    colorHex: number,
    size = 0.1,
    maxAge = 0.65,
    gravity = 0,
  ) {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % MAX_VOXEL_PARTICLES;

    _color.setHex(colorHex);
    p.active = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.age = 0;
    p.maxAge = maxAge;
    p.size = size;
    p.gravity = gravity;
    p.r = _color.r;
    p.g = _color.g;
    p.b = _color.b;
  }

  public spawnImpactBurst(pos: THREE.Vector3, colorHex = 0xfbbf24) {
    // Critical hit burst + shockwave ring
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
      const spd = 1.6 + Math.random() * 2.4;
      this.spawnParticle(
        pos.x,
        pos.y,
        pos.z,
        Math.cos(ang) * spd,
        1.2 + Math.random() * 2.0,
        Math.sin(ang) * spd,
        i % 2 === 0 ? colorHex : 0xffffff,
        0.08 + Math.random() * 0.05,
        0.42 + Math.random() * 0.2,
        -6.5,
      );
    }

    const slashMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const slash = new THREE.Mesh(this.slashGeo, slashMat);
    slash.position.copy(pos);
    slash.rotation.y = Math.random() * Math.PI * 2;
    slash.rotation.z = (Math.random() - 0.5) * 0.45;
    this.group.add(slash);
    this.slashes.push({
      mesh: slash,
      age: 0,
      maxAge: 0.26,
      baseScale: 0.9,
    });
  }

  public update(delta: number, actors: ActorVfxSnapshot[]) {
    this.emitAccum += delta;
    const shouldEmitAmbient = this.emitAccum >= 0.05;
    if (shouldEmitAmbient) this.emitAccum = 0;

    for (const actor of actors) {
      const cooldown = Math.max(0, (this.actorCooldowns.get(actor.id) ?? 0) - delta);
      this.actorCooldowns.set(actor.id, cooldown);

      // 1. Velocity-driven Combat Slash & Impact Bursts
      if (actor.vfxPreset === 'combat' && cooldown <= 0) {
        if (actor.rightHandSpeed > 5.4) {
          this.spawnImpactBurst(actor.rightHandPos, 0x38bdf8);
          this.actorCooldowns.set(actor.id, 0.26);
        } else if (actor.leftHandSpeed > 5.4) {
          this.spawnImpactBurst(actor.leftHandPos, 0xfbbf24);
          this.actorCooldowns.set(actor.id, 0.26);
        }
      }

      if (!shouldEmitAmbient) continue;

      // 2. Torch / Lantern / Lava Hand Embers
      if (actor.hasTorchLight) {
        this.spawnParticle(
          actor.rightHandPos.x + (Math.random() - 0.5) * 0.14,
          actor.rightHandPos.y + 0.08,
          actor.rightHandPos.z + (Math.random() - 0.5) * 0.14,
          (Math.random() - 0.5) * 0.25,
          0.9 + Math.random() * 0.8,
          (Math.random() - 0.5) * 0.25,
          Math.random() > 0.3 ? actor.torchColor : 0x52525b,
          0.065,
          0.55 + Math.random() * 0.35,
          0.2,
        );
      }

      // 3. Enchanted Item Shimmer Sparkles
      if (actor.hasEnchanted || actor.vfxPreset === 'enchant') {
        const ang = Math.random() * Math.PI * 2;
        const rad = 0.45 + Math.random() * 0.45;
        this.spawnParticle(
          actor.worldPos.x + Math.cos(ang) * rad,
          actor.worldPos.y + 0.3 + Math.random() * 1.5,
          actor.worldPos.z + Math.sin(ang) * rad,
          (Math.random() - 0.5) * 0.25,
          0.5 + Math.random() * 0.7,
          (Math.random() - 0.5) * 0.25,
          Math.random() > 0.4 ? 0xc084fc : 0x67e8f9,
          0.075,
          0.85,
          0,
        );
      }

      // 4. Fire Aura
      if (actor.vfxPreset === 'fire') {
        const ang = Math.random() * Math.PI * 2;
        const rad = 0.25 + Math.random() * 0.35;
        this.spawnParticle(
          actor.worldPos.x + Math.cos(ang) * rad,
          actor.worldPos.y + 0.15 + Math.random() * 1.1,
          actor.worldPos.z + Math.sin(ang) * rad,
          (Math.random() - 0.5) * 0.4,
          1.2 + Math.random() * 1.1,
          (Math.random() - 0.5) * 0.4,
          Math.random() > 0.45 ? 0xf97316 : 0xfacc15,
          0.095,
          0.6,
          0.4,
        );
      }

      // 5. Ender / Nether Portal Aura
      if (actor.vfxPreset === 'ender') {
        const ang = Math.random() * Math.PI * 2;
        const rad = 0.55 + Math.random() * 0.4;
        this.spawnParticle(
          actor.worldPos.x + Math.cos(ang) * rad,
          actor.worldPos.y + 0.2 + Math.random() * 1.6,
          actor.worldPos.z + Math.sin(ang) * rad,
          -Math.cos(ang) * 0.5,
          0.35 + Math.random() * 0.4,
          -Math.sin(ang) * 0.5,
          Math.random() > 0.35 ? 0xa855f7 : 0xec4899,
          0.085,
          0.75,
          0,
        );
      }

      // 6. Speed / Footstep Dust Trail
      if (actor.vfxPreset === 'speed' && (actor.rootSpeed > 0.4 || actor.rightHandSpeed > 2.5)) {
        this.spawnParticle(
          actor.worldPos.x + (Math.random() - 0.5) * 0.5,
          actor.worldPos.y + 0.08,
          actor.worldPos.z + (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.7,
          0.5 + Math.random() * 0.5,
          (Math.random() - 0.5) * 0.7,
          Math.random() > 0.5 ? 0xe0f2fe : 0x94a3b8,
          0.11,
          0.48,
          -0.6,
        );
      }
    }

    // Integrate Voxel Particles
    for (let i = 0; i < MAX_VOXEL_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.age += delta;
      if (p.age >= p.maxAge) {
        p.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      p.vy += p.gravity * delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;

      const lifeT = p.age / p.maxAge;
      const scale = p.size * (1 - lifeT * 0.75);
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.age * 2.5, p.age * 3.1, 0);
      _dummy.scale.setScalar(Math.max(0.001, scale));
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);

      _color.setRGB(p.r, p.g, p.b);
      this.particleMesh.setColorAt(i, _color);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }

    // Update Sweep Slash Crescents
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      s.age += delta;
      if (s.age >= s.maxAge) {
        this.group.remove(s.mesh);
        (s.mesh.material as THREE.Material).dispose();
        this.slashes.splice(i, 1);
        continue;
      }
      const t = s.age / s.maxAge;
      s.mesh.scale.setScalar(s.baseScale + t * 1.15);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.85;
    }

    // Update Stage Weather
    if (this.currentWeather !== 'clear') {
      const isRain = this.currentWeather === 'rain';
      const isAscend = this.currentWeather === 'ash';
      for (let i = 0; i < MAX_WEATHER_PARTICLES; i++) {
        const w = this.weatherData[i];
        w.x += w.vx * delta;
        w.y += w.vy * delta;
        w.z += w.vz * delta;

        if (!isAscend && w.y < 0) {
          w.y = 11 + Math.random() * 2;
          w.x = (Math.random() - 0.5) * 24;
          w.z = (Math.random() - 0.5) * 24;
        } else if (isAscend && w.y > 12) {
          w.y = 0;
          w.x = (Math.random() - 0.5) * 24;
          w.z = (Math.random() - 0.5) * 24;
        }

        _dummy.position.set(w.x, w.y, w.z);
        _dummy.rotation.set(0, w.rot + (isRain ? 0 : performance.now() * 0.001), 0);
        if (isRain) {
          _dummy.scale.set(0.03, 0.42, 0.03);
        } else if (this.currentWeather === 'cherry') {
          _dummy.scale.set(0.12, 0.04, 0.12);
        } else {
          _dummy.scale.setScalar(0.09);
        }
        _dummy.updateMatrix();
        this.weatherMesh.setMatrixAt(i, _dummy.matrix);
      }
      this.weatherMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose() {
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.weatherMesh.geometry.dispose();
    (this.weatherMesh.material as THREE.Material).dispose();
    this.slashGeo.dispose();
    for (const s of this.slashes) {
      (s.mesh.material as THREE.Material).dispose();
    }
  }
}
