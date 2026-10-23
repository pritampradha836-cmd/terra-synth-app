import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BiomeSystem, BiomeType, TerrainParameters, DEFAULT_TERRAIN_PARAMS } from './procedural/BiomeSystem';
import { TerrainManager } from './procedural/TerrainManager';
import { Player } from './entities/Player';
import { EnemyManager } from './entities/EnemyManager';
import { ShrineManager } from './entities/ShrineManager';
import { ParticleSystem } from './particles/ParticleSystem';
import { DataScienceEngine } from './datascience/DataScienceEngine';
import { audioSystem } from './audio/ProceduralAudio';

export type GameState = 'TITLE' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'VICTORY';

export interface GameTelemetrySnapshot {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  biome: BiomeType;
  playerCoords: { x: number; y: number; z: number };
}

export class GameEngine {
  public container: HTMLElement;
  public canvas: HTMLCanvasElement;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;

  // Subsystems
  public biomeSystem: BiomeSystem;
  public terrainManager: TerrainManager;
  public player: Player;
  public enemyManager: EnemyManager;
  public shrineManager: ShrineManager;
  public particles: ParticleSystem;
  public dsEngine: DataScienceEngine;

  // Game Lifecycle State
  public state: GameState = 'TITLE';
  private isSoftwareGl: boolean = false;
  private animationFrameId: number = 0;
  private lastTime: number = 0;

  // Camera Spring Follow
  private camOffset = new THREE.Vector3(0, 5.5, -9.5);
  private camTarget = new THREE.Vector3();
  private camPosition = new THREE.Vector3();
  private camShake = 0;
  private cameraYaw = 0;

  // Lights & Fog
  private dirLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;

  // Controls input tracking
  private keysHeld = new Set<string>();
  private keysJustPressed = new Set<string>();
  private mouseDragging = false;
  private lastMouseX = 0;

  // Telemetry tracking
  private frameCount = 0;
  private fpsAccumulator = 0;
  public currentFps = 60;
  public currentFrameTimeMs = 16.6;
  private dsUpdateTimer = 0;

  // React state sync hook
  public onStateChange?: (state: GameState) => void;
  public onTelemetryUpdate?: (snapshot: GameTelemetrySnapshot) => void;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Detect Software WebGL
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    // 2. Initialize Three.js Renderer
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: !this.isSoftwareGl,
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.canvas = this.renderer.domElement;
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);

    // 3. Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.2,
      350
    );

    // 4. Studio Environment Reflection (RoomEnvironment)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 5. Lighting Rig & Horizon Fog
    this.hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e293b, 1.2);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff7ed, 2.0);
    this.dirLight.position.set(40, 60, 30);
    this.dirLight.castShadow = !this.isSoftwareGl;
    if (this.dirLight.castShadow) {
      this.dirLight.shadow.mapSize.width = 1024;
      this.dirLight.shadow.mapSize.height = 1024;
      this.dirLight.shadow.camera.near = 10;
      this.dirLight.shadow.camera.far = 160;
      const d = 36;
      this.dirLight.shadow.camera.left = -d;
      this.dirLight.shadow.camera.right = d;
      this.dirLight.shadow.camera.top = d;
      this.dirLight.shadow.camera.bottom = -d;
      this.dirLight.shadow.bias = -0.0005;
      this.dirLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.dirLight);

    this.scene.fog = new THREE.FogExp2(0x102a24, 0.012);

    // 6. Subsystems initialization
    this.biomeSystem = new BiomeSystem(DEFAULT_TERRAIN_PARAMS);
    this.terrainManager = new TerrainManager(this.scene, this.biomeSystem);
    this.player = new Player(this.scene);
    this.enemyManager = new EnemyManager(this.scene, this.biomeSystem);
    this.shrineManager = new ShrineManager(this.scene, this.biomeSystem);
    this.particles = new ParticleSystem();
    this.scene.add(this.particles.mesh);

    this.dsEngine = new DataScienceEngine(this.biomeSystem, this.terrainManager, this.enemyManager);

    // Initial terrain stream
    this.terrainManager.updatePlayerPosition(0, 0);

    // Set initial player height on ground
    const spawnH = this.biomeSystem.getHeight(0, 0);
    this.player.position.set(0, spawnH, 0);
    this.camPosition.set(0, spawnH + 8, -14);
    this.camTarget.set(0, spawnH + 1.5, 0);
    this.camera.position.copy(this.camPosition);
    this.camera.lookAt(this.camTarget);

    // Bind event listeners
    this.bindEvents();

    // Start render loop
    this.lastTime = performance.now();
    this.tick();
  }

  private bindEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('resize', this.handleResize);

    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;

    // Edge-triggered actions
    if (!this.keysHeld.has(code)) {
      this.keysJustPressed.add(code);
    }
    this.keysHeld.add(code);

    // Game lifecycle shortcuts
    if (code === 'KeyP' || code === 'Escape') {
      if (this.state === 'PLAYING') {
        this.setState('PAUSED');
      } else if (this.state === 'PAUSED') {
        this.setState('PLAYING');
      }
    }

    if (code === 'KeyM') {
      audioSystem.toggleMute();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);
  };

  private handleBlur = (): void => {
    this.keysHeld.clear();
    this.keysJustPressed.clear();
  };

  private handleResize = (): void => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) {
      // Left click attack
      this.keysJustPressed.add('Mouse0');
    } else if (e.button === 2) {
      // Right click shockwave
      this.keysJustPressed.add('Mouse2');
    }
    this.mouseDragging = true;
    this.lastMouseX = e.clientX;
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (this.mouseDragging) {
      const deltaX = e.clientX - this.lastMouseX;
      this.lastMouseX = e.clientX;
      this.cameraYaw -= deltaX * 0.005;
    }
  };

  private handleMouseUp = (): void => {
    this.mouseDragging = false;
  };

  public setState(newState: GameState): void {
    this.state = newState;
    if (this.onStateChange) {
      this.onStateChange(newState);
    }
  }

  public startGame(): void {
    this.setState('PLAYING');
    // Ensure initial audio harmonic
    const { primaryBiome } = this.biomeSystem.getBiomeWeights(this.player.position.x, this.player.position.z);
    audioSystem.setBiomeHarmonic(primaryBiome.ambientFreq);
  }

  public restartGame(): void {
    this.player.stats.hp = this.player.stats.maxHp;
    this.player.stats.shield = this.player.stats.maxShield;
    this.player.stats.energy = this.player.stats.maxEnergy;
    this.player.stats.isDead = false;
    this.player.stats.score = 0;
    this.player.stats.shrinesActivated = 0;
    this.player.position.set(0, this.biomeSystem.getHeight(0, 0), 0);
    this.player.velocity.set(0, 0, 0);

    this.enemyManager.dispose();
    this.dsEngine.explorationTracker.clear();
    this.setState('PLAYING');
  }

  public addCameraShake(amount: number = 0.5): void {
    this.camShake = Math.min(1.2, this.camShake + amount);
  }

  private tick = (): void => {
    this.animationFrameId = requestAnimationFrame(this.tick);

    const now = performance.now();
    const rawDt = (now - this.lastTime) * 0.001;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05); // Frame delta clamping

    // FPS profiling
    this.frameCount++;
    this.fpsAccumulator += rawDt;
    if (this.fpsAccumulator >= 0.5) {
      this.currentFps = Math.round(this.frameCount / this.fpsAccumulator);
      this.currentFrameTimeMs = Math.round((this.fpsAccumulator / this.frameCount) * 1000 * 10) / 10;
      this.frameCount = 0;
      this.fpsAccumulator = 0;
    }

    if (this.state === 'TITLE') {
      this.updateTitleCinematic(dt);
    } else if (this.state === 'PLAYING') {
      this.updatePlaying(dt);
    } else if (this.state === 'PAUSED') {
      // Idle pause state
    }

    // Always render scene
    this.renderer.render(this.scene, this.camera);

    // Clear edge-triggered keys after loop frame
    this.keysJustPressed.clear();
  };

  private updateTitleCinematic(dt: number): void {
    // Cinematic camera sweep around origin
    const time = performance.now() * 0.0003;
    const radius = 24.0;
    const camX = Math.cos(time) * radius;
    const camZ = Math.sin(time) * radius;
    const targetH = this.biomeSystem.getHeight(0, 0);

    this.camPosition.set(camX, targetH + 9, camZ);
    this.camTarget.set(0, targetH + 1.5, 0);
    this.camera.position.copy(this.camPosition);
    this.camera.lookAt(this.camTarget);

    this.particles.update(dt);
  }

  private updatePlaying(dt: number): void {
    // Input translation
    let moveX = 0;
    let moveZ = 0;

    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) moveZ += 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) moveZ -= 1;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) moveX -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) moveX += 1;

    const jump = this.keysJustPressed.has('Space');
    const dash = this.keysJustPressed.has('ShiftLeft') || this.keysJustPressed.has('ShiftRight');
    const attack = this.keysJustPressed.has('KeyJ') || this.keysJustPressed.has('KeyF') || this.keysJustPressed.has('Mouse0');
    const shockwave = this.keysJustPressed.has('KeyQ') || this.keysJustPressed.has('Mouse2');
    const parry = this.keysJustPressed.has('KeyE');

    // Shrine interaction trigger with 'KeyE' if nearby
    if (this.keysJustPressed.has('KeyE') && this.shrineManager.nearbyShrine && !this.shrineManager.nearbyShrine.isActivated) {
      this.shrineManager.activateNearbyShrine(this.player, this.particles);
      this.addCameraShake(0.6);
    }

    // 1. Update Player
    this.player.handleInput(
      { moveX, moveZ, jump, dash, attack, shockwave, parry },
      this.cameraYaw,
      dt,
      this.biomeSystem,
      this.particles
    );

    // Camera Shake decay
    if (this.camShake > 0) {
      this.camShake = Math.max(0, this.camShake - 3.0 * dt);
    }

    // Check player death
    if (this.player.stats.isDead && this.state !== 'GAMEOVER') {
      this.setState('GAMEOVER');
      audioSystem.playHit(true);
    }

    // 2. Stream Terrain Chunks
    const px = this.player.position.x;
    const pz = this.player.position.z;
    this.terrainManager.updatePlayerPosition(px, pz);

    // Record exploration density and FPS performance telemetry
    this.dsEngine.explorationTracker.recordPosition(
      px,
      this.player.position.y,
      pz,
      dt,
      this.biomeSystem,
      this.currentFps,
      this.currentFrameTimeMs
    );

    // 3. Update Enemies & Combat
    this.enemyManager.update(dt, this.player, this.particles);

    // 4. Update Shrines
    this.shrineManager.update(this.player, this.particles);

    // 5. Update Particles
    this.particles.update(dt);

    // 6. Smooth Third-Person Spring Camera Follow
    const rotatedOffset = this.camOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraYaw);
    const idealCamPos = this.player.position.clone().add(rotatedOffset);
    const idealLookAt = this.player.position.clone().add(new THREE.Vector3(0, 1.8, 0));

    // Camera collision with terrain to prevent clipping underground
    const minCamH = this.biomeSystem.getHeight(idealCamPos.x, idealCamPos.z) + 1.2;
    if (idealCamPos.y < minCamH) {
      idealCamPos.y = minCamH;
    }

    // Damped interpolation
    this.camPosition.lerp(idealCamPos, Math.min(1.0, 12.0 * dt));
    this.camTarget.lerp(idealLookAt, Math.min(1.0, 14.0 * dt));

    // Apply camera shake
    if (this.camShake > 0) {
      const shakeOffset = new THREE.Vector3(
        (Math.random() - 0.5) * this.camShake * 0.4,
        (Math.random() - 0.5) * this.camShake * 0.4,
        (Math.random() - 0.5) * this.camShake * 0.4
      );
      this.camera.position.copy(this.camPosition).add(shakeOffset);
    } else {
      this.camera.position.copy(this.camPosition);
    }

    this.camera.lookAt(this.camTarget);

    // 7. Dynamic Biome Atmosphere & Lighting Sync
    const { primaryBiome } = this.biomeSystem.getBiomeWeights(px, pz);
    this.scene.fog!.color.lerp(primaryBiome.fogColor, Math.min(1.0, 2.0 * dt));
    this.hemiLight.color.lerp(primaryBiome.secondaryColor, Math.min(1.0, 2.0 * dt));
    this.dirLight.position.set(px + 40, 60, pz + 30);
    this.dirLight.target = this.player.group;

    audioSystem.setBiomeHarmonic(primaryBiome.ambientFreq);

    // 8. Data Science Workbench Telemetry Updates (throttled to 4 Hz)
    this.dsUpdateTimer += dt;
    if (this.dsUpdateTimer >= 0.25) {
      this.dsUpdateTimer = 0;
      this.dsEngine.analyzeElevation(px, pz);
      this.dsEngine.analyzeSpectrum();
      this.dsEngine.analyzeBiomeEntropy(px, pz);
      this.dsEngine.computeTopologicalHeatmap(px, pz);

      if (this.onTelemetryUpdate) {
        this.onTelemetryUpdate({
          fps: this.currentFps,
          frameTimeMs: this.currentFrameTimeMs,
          drawCalls: this.renderer.info.render.calls,
          triangles: this.renderer.info.render.triangles,
          biome: primaryBiome.id,
          playerCoords: {
            x: Math.round(px * 10) / 10,
            y: Math.round(this.player.position.y * 10) / 10,
            z: Math.round(pz * 10) / 10,
          },
        });
      }
    }
  }

  public updateTerrainParams(newParams: Partial<TerrainParameters>): void {
    this.biomeSystem.updateParams(newParams);
    this.terrainManager.rebuildAllChunks();
    this.dsEngine.analyzeSpectrum();
  }

  public dispose(): void {
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('resize', this.handleResize);

    this.terrainManager.dispose();
    this.enemyManager.dispose();
    this.shrineManager.dispose();
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
