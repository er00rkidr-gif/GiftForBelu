import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileJson, Film, Image as ImageIcon } from 'lucide-react';
import { DockTab, StudioDock } from './components/StudioDock';
import { Viewport3D, Viewport3DHandle } from './components/Viewport3D';
import {
  buildMineimatorKeyframesFile,
  slugifyFilename,
  triggerMiframesDownload,
} from './lib/mineimatorExport';
import { getDefaultSkinPresets, normalizeSkinImage } from './lib/minecraftSkin';
import { getBuiltInMaps, parseSchematicFile } from './lib/nbtSchematic';
import { PRESET_ANIMATIONS } from './lib/presetAnimations';
import {
  AnimationData,
  CameraPreset,
  LightingMood,
  SceneCharacter,
  SchematicMapData,
  SkinPreset,
  WeatherPreset,
} from './types/animation';

export default function App() {
  const skinPresets = useMemo(() => getDefaultSkinPresets(), []);
  const builtInMaps = useMemo(() => getBuiltInMaps(), []);

  // Multi-character Scene Cast (starts with Steve wielding Diamond Sword & combat VFX on Flat Baseplate)
  const [characters, setCharacters] = useState<SceneCharacter[]>(() => [
    {
      id: 'char-1',
      name: 'Steve',
      skinId: skinPresets[0].id,
      skinDataUrl: skinPresets[0].dataUrl,
      modelType: skinPresets[0].modelType,
      showOverlayLayer: true,
      heldProp: 'none',
      offhandItem: 'none',
      enchantedMainHand: false,
      enchantedOffhand: false,
      vfxPreset: 'combat',
      basePosition: [0, 0, 0],
      baseYaw: 0,
    },
  ]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('char-1');

  // Active World / Schematic Map + Weather & Lighting Mood
  const [activeMap, setActiveMap] = useState<SchematicMapData>(builtInMaps[0]);
  const [mapOffsetY, setMapOffsetY] = useState<number>(0);
  const [weatherPreset, setWeatherPreset] = useState<WeatherPreset>('clear');
  const [lightingMood, setLightingMood] = useState<LightingMood>('studio');
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Animations & Playback
  const [savedAnimations, setSavedAnimations] = useState<AnimationData[]>(PRESET_ANIMATIONS);
  const [activeAnimation, setActiveAnimation] = useState<AnimationData>(PRESET_ANIMATIONS[0]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);

  // Studio UI State
  const [activeTab, setActiveTab] = useState<DockTab>('animate');
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('threeQuarter');
  const [cameraTrigger, setCameraTrigger] = useState(0);

  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [isFetchingSkin, setIsFetchingSkin] = useState(false);
  const [skinError, setSkinError] = useState<string | null>(null);

  const [exportOpen, setExportOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const viewportRef = useRef<Viewport3DHandle>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT';
      if (isInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === 'h' || e.key === 'H') {
        setIsDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSelectCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
    setCameraTrigger((n) => n + 1);
  }, []);

  const handleScrub = useCallback((time: number) => {
    setIsPlaying(false);
    setCurrentTime(time);
  }, []);

  const handleSelectAnimation = useCallback((anim: AnimationData) => {
    setActiveAnimation(anim);
    setCurrentTime(0);
    setIsPlaying(true);
    setGenError(null);
  }, []);

  const handleUpdateAnimation = useCallback((updated: AnimationData) => {
    setActiveAnimation(updated);
    setSavedAnimations((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }, []);

  const handleAddCharacter = useCallback(() => {
    setCharacters((prev) => {
      if (prev.length >= 6) return prev;
      const idx = prev.length;
      const preset = skinPresets[idx % skinPresets.length];
      const names = ['Steve', 'Alex', 'Striker', 'Sentinel', 'Explorer', 'Knight'];
      const newId = `char-${Date.now()}`;
      const spacing = 1.6;
      const sideX = idx % 2 === 1 ? spacing * Math.ceil(idx / 2) : -spacing * Math.ceil(idx / 2);

      const added: SceneCharacter = {
        id: newId,
        name: names[idx] || `Actor ${idx + 1}`,
        skinId: preset.id,
        skinDataUrl: preset.dataUrl,
        modelType: preset.modelType,
        showOverlayLayer: true,
        heldProp: idx === 1 ? 'diamond_sword' : 'none',
        offhandItem: idx === 1 ? 'shield' : 'none',
        enchantedMainHand: false,
        enchantedOffhand: false,
        vfxPreset: 'combat',
        basePosition: [sideX, 0, 0],
        baseYaw: 0,
      };
      setSelectedCharacterId(newId);
      return [...prev, added];
    });
  }, [skinPresets]);

  const handleRemoveCharacter = useCallback((id: string) => {
    setCharacters((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((c) => c.id !== id);
      setSelectedCharacterId((cur) => (cur === id ? filtered[0].id : cur));
      return filtered;
    });
  }, []);

  const handleUpdateCharacter = useCallback((id: string, patch: Partial<SceneCharacter>) => {
    setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const handleArrangeDuel = useCallback(() => {
    setCharacters((prev) =>
      prev.map((c, idx) => {
        if (idx === 0) return { ...c, basePosition: [0, 0, -1.15], baseYaw: 0 };
        if (idx === 1) return { ...c, basePosition: [0, 0, 1.15], baseYaw: 180 };
        return {
          ...c,
          basePosition: [(idx % 2 === 0 ? -1 : 1) * (1.8 + idx * 0.4), 0, 0],
          baseYaw: idx % 2 === 0 ? 90 : -90,
        };
      }),
    );
    handleSelectCameraPreset('side');
  }, [handleSelectCameraPreset]);

  const handleGenerateAnimation = useCallback(
    async (prompt: string, loop: boolean) => {
      setIsGenerating(true);
      setGenError(null);
      try {
        const res = await fetch('/api/animate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            loop,
            mapName: activeMap.name,
            characters: characters.map((c) => ({
              id: c.id,
              name: c.name,
              basePosition: c.basePosition,
              baseYaw: c.baseYaw,
              heldProp: c.heldProp,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Animation generation failed.');
        }
        const generated = data as AnimationData;
        setSavedAnimations((prev) => [generated, ...prev]);
        setActiveAnimation(generated);
        setCurrentTime(0);
        setIsPlaying(true);
      } catch (err: unknown) {
        setGenError(err instanceof Error ? err.message : 'Unable to generate animation.');
      } finally {
        setIsGenerating(false);
      }
    },
    [activeMap.name, characters],
  );

  const handleUploadSkinFile = useCallback(
    (file: File) => {
      setSkinError(null);
      if (!file.type.startsWith('image/')) {
        setSkinError('Please select a PNG or WebP Minecraft skin image.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const img = new Image();
        img.onload = () => {
          if (img.width < 32 || img.height < 16) {
            setSkinError('Skin image is too small. Standard Minecraft skins are 64x64 or 64x32.');
            return;
          }
          const normalized = normalizeSkinImage(img);
          handleUpdateCharacter(selectedCharacterId, {
            skinId: 'custom-upload',
            skinDataUrl: normalized.dataUrl,
            modelType: normalized.detectedModel,
          });
        };
        img.onerror = () => setSkinError('Could not decode the uploaded image file.');
        img.src = result;
      };
      reader.readAsDataURL(file);
    },
    [handleUpdateCharacter, selectedCharacterId],
  );

  const handleSelectSkinPreset = useCallback(
    (preset: SkinPreset) => {
      setSkinError(null);
      handleUpdateCharacter(selectedCharacterId, {
        skinId: preset.id,
        skinDataUrl: preset.dataUrl,
        modelType: preset.modelType,
      });
    },
    [handleUpdateCharacter, selectedCharacterId],
  );

  const handleFetchUsernameSkin = useCallback(
    async (username: string) => {
      setIsFetchingSkin(true);
      setSkinError(null);
      try {
        const res = await fetch(`/api/skin/${encodeURIComponent(username)}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Could not load player skin.');
        }
        handleUpdateCharacter(selectedCharacterId, {
          skinId: `user-${data.username}`,
          skinDataUrl: data.dataUrl,
          modelType: data.modelType === 'slim' ? 'slim' : 'classic',
        });
      } catch (err: unknown) {
        setSkinError(err instanceof Error ? err.message : 'Failed to fetch player skin.');
      } finally {
        setIsFetchingSkin(false);
      }
    },
    [handleUpdateCharacter, selectedCharacterId],
  );

  const handleUploadSchematicFile = useCallback(
    async (file: File) => {
      setIsLoadingMap(true);
      setMapError(null);
      try {
        const parsedMap = await parseSchematicFile(file);
        setActiveMap(parsedMap);
        setMapOffsetY(0);
        handleSelectCameraPreset('wideStage');
      } catch (err: unknown) {
        setMapError(
          err instanceof Error ? err.message : 'Failed to parse schematic file.',
        );
      } finally {
        setIsLoadingMap(false);
      }
    },
    [handleSelectCameraPreset],
  );

  const handleExportMiframes = useCallback(
    (mode: 'selected' | 'all' = 'selected') => {
      setExportOpen(false);
      const fallbackTrack =
        activeAnimation.tracks['default'] || Object.values(activeAnimation.tracks)[0];
      const clipSlug = slugifyFilename(activeAnimation.name);

      if (mode === 'all' && characters.length > 1) {
        characters.forEach((char, idx) => {
          const track = activeAnimation.tracks[char.id] || fallbackTrack;
          if (!track) return;
          const payload = buildMineimatorKeyframesFile(activeAnimation, char, track, true);
          const charSlug = slugifyFilename(char.name);
          setTimeout(() => {
            triggerMiframesDownload(`${clipSlug}-${charSlug}.miframes`, payload);
          }, idx * 140);
        });
        return;
      }

      const targetChar =
        characters.find((c) => c.id === selectedCharacterId) ?? characters[0];
      if (!targetChar || !fallbackTrack) return;
      const track = activeAnimation.tracks[targetChar.id] || fallbackTrack;
      const payload = buildMineimatorKeyframesFile(activeAnimation, targetChar, track, false);
      const filename =
        characters.length > 1
          ? `${clipSlug}-${slugifyFilename(targetChar.name)}.miframes`
          : `${clipSlug}.miframes`;
      triggerMiframesDownload(filename, payload);
    },
    [activeAnimation, characters, selectedCharacterId],
  );

  const handleExportJson = () => {
    setExportOpen(false);
    const blob = new Blob([JSON.stringify(activeAnimation, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeAnimation.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleCapturePng = () => {
    setExportOpen(false);
    viewportRef.current?.captureScreenshot();
  };

  const handleRecordWebm = async () => {
    setExportOpen(false);
    if (isRecording) return;
    setIsRecording(true);
    try {
      const recordDuration = Math.min(6, Math.max(1.5, activeAnimation.duration * 2));
      await viewportRef.current?.startVideoRecording(recordDuration);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0E131A] select-none">
      <Viewport3D
        ref={viewportRef}
        characters={characters}
        selectedCharacterId={selectedCharacterId}
        onSelectCharacter={setSelectedCharacterId}
        schematicMap={activeMap}
        mapOffsetY={mapOffsetY}
        weatherPreset={weatherPreset}
        lightingMood={lightingMood}
        animation={activeAnimation}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        currentTime={currentTime}
        onTimeUpdate={setCurrentTime}
        onPlayStateChange={setIsPlaying}
        cameraPreset={cameraPreset}
        cameraTrigger={cameraTrigger}
      />

      {/* Minimal 3-Zone Top Bar */}
      <header className="fixed top-0 inset-x-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-[#0B0D10]/85 border-b border-white/8">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            handleSelectCameraPreset('threeQuarter');
          }}
          className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          BlockRig Studio
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
          <button
            type="button"
            onClick={() => {
              setIsDockCollapsed(false);
              setActiveTab('animate');
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'animate' && !isDockCollapsed ? 'text-white' : ''
            }`}
          >
            Motion Studio
          </button>
          <button
            type="button"
            onClick={() => {
              setIsDockCollapsed(false);
              setActiveTab('cast');
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'cast' && !isDockCollapsed ? 'text-white' : ''
            }`}
          >
            Characters
          </button>
          <button
            type="button"
            onClick={() => {
              setIsDockCollapsed(false);
              setActiveTab('items');
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'items' && !isDockCollapsed ? 'text-white' : ''
            }`}
          >
            Items &amp; VFX
          </button>
          <button
            type="button"
            onClick={() => {
              setIsDockCollapsed(false);
              setActiveTab('world');
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'world' && !isDockCollapsed ? 'text-white' : ''
            }`}
          >
            Schematics
          </button>
        </nav>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setExportOpen((v) => !v)}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isRecording ? 'Recording Clip...' : 'Export'}</span>
          </button>

          {exportOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[#141922] border border-white/12 shadow-xl py-1.5 z-40">
              <button
                type="button"
                onClick={() => handleExportMiframes('selected')}
                className="w-full px-3.5 py-2 text-left text-xs text-emerald-300 font-medium hover:bg-white/8 flex items-center gap-2.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  {characters.length > 1
                    ? 'Mine-imator Selected (.miframes)'
                    : 'Mine-imator Keyframes (.miframes)'}
                </span>
              </button>
              {characters.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleExportMiframes('all')}
                  className="w-full px-3.5 py-2 text-left text-xs text-zinc-200 hover:bg-white/8 flex items-center gap-2.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
                  <span>All Characters (.miframes)</span>
                </button>
              )}
              <div className="my-1 border-t border-white/8" />
              <button
                type="button"
                onClick={handleRecordWebm}
                disabled={isRecording}
                className="w-full px-3.5 py-2 text-left text-xs text-zinc-200 hover:bg-white/8 flex items-center gap-2.5 cursor-pointer"
              >
                <Film className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>Record Video (.webm)</span>
              </button>
              <button
                type="button"
                onClick={handleCapturePng}
                className="w-full px-3.5 py-2 text-left text-xs text-zinc-200 hover:bg-white/8 flex items-center gap-2.5 cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>Save Frame (.png)</span>
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="w-full px-3.5 py-2 text-left text-xs text-zinc-200 hover:bg-white/8 flex items-center gap-2.5 cursor-pointer"
              >
                <FileJson className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>Studio Clip (.json)</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Subtle Unboxed Viewport Hint */}
      <div className="fixed top-16 left-6 z-10 pointer-events-none flex items-center gap-2 text-xs text-zinc-400">
        <span>Click character to select</span>
        <span aria-hidden="true">·</span>
        <span>Drag to orbit</span>
        <span aria-hidden="true">·</span>
        <span>Space to play</span>
      </div>

      {/* Unified Collapsible Mine-imator Dock */}
      <StudioDock
        activeTab={activeTab}
        onTabChange={(t) => {
          setActiveTab(t);
          setIsDockCollapsed(false);
        }}
        isCollapsed={isDockCollapsed}
        onToggleCollapse={() => setIsDockCollapsed((c) => !c)}
        characters={characters}
        selectedCharacterId={selectedCharacterId}
        onSelectCharacter={setSelectedCharacterId}
        onAddCharacter={handleAddCharacter}
        onRemoveCharacter={handleRemoveCharacter}
        onUpdateCharacter={handleUpdateCharacter}
        onArrangeDuel={handleArrangeDuel}
        animation={activeAnimation}
        savedAnimations={savedAnimations}
        onSelectAnimation={handleSelectAnimation}
        onUpdateAnimation={handleUpdateAnimation}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        playbackSpeed={playbackSpeed}
        onSpeedChange={setPlaybackSpeed}
        currentTime={currentTime}
        onScrub={handleScrub}
        onGenerateAnimation={handleGenerateAnimation}
        isGenerating={isGenerating}
        genError={genError}
        skinPresets={skinPresets}
        onUploadSkinFile={handleUploadSkinFile}
        onSelectSkinPreset={handleSelectSkinPreset}
        onFetchUsernameSkin={handleFetchUsernameSkin}
        isFetchingSkin={isFetchingSkin}
        skinError={skinError}
        builtInMaps={builtInMaps}
        activeMap={activeMap}
        onSelectMap={(m) => {
          setActiveMap(m);
          setMapOffsetY(0);
          setMapError(null);
        }}
        onUploadSchematicFile={handleUploadSchematicFile}
        isLoadingMap={isLoadingMap}
        mapError={mapError}
        mapOffsetY={mapOffsetY}
        onMapOffsetYChange={setMapOffsetY}
        weatherPreset={weatherPreset}
        onWeatherChange={setWeatherPreset}
        lightingMood={lightingMood}
        onLightingMoodChange={setLightingMood}
        cameraPreset={cameraPreset}
        onSelectCameraPreset={handleSelectCameraPreset}
        onExportMiframes={handleExportMiframes}
      />
    </div>
  );
}
