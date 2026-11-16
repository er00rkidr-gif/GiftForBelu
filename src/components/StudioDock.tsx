import React, { useMemo, useRef, useState } from 'react';
import {
  Box,
  Camera,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Flame,
  Layers,
  Pause,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Search,
  Sparkles,
  Swords,
  Trash2,
  Upload,
  User,
  UserPlus,
  Wand2,
} from 'lucide-react';
import { ItemCategory, MINECRAFT_ITEM_MAP, MINECRAFT_ITEMS } from '../lib/minecraftItems';
import {
  AnimationData,
  BONE_LABELS,
  BoneId,
  CameraPreset,
  EMPTY_BONES,
  KeyframePose,
  LightingMood,
  SceneCharacter,
  SchematicMapData,
  SkinModelType,
  SkinPreset,
  VfxPreset,
  WeatherPreset,
} from '../types/animation';

export type DockTab = 'animate' | 'cast' | 'items' | 'world' | 'timeline';

interface StudioDockProps {
  activeTab: DockTab;
  onTabChange: (tab: DockTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  // Cast & Selection
  characters: SceneCharacter[];
  selectedCharacterId: string;
  onSelectCharacter: (id: string) => void;
  onAddCharacter: () => void;
  onRemoveCharacter: (id: string) => void;
  onUpdateCharacter: (id: string, patch: Partial<SceneCharacter>) => void;
  onArrangeDuel: () => void;
  // Playback
  animation: AnimationData;
  savedAnimations: AnimationData[];
  onSelectAnimation: (anim: AnimationData) => void;
  onUpdateAnimation: (anim: AnimationData) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  currentTime: number;
  onScrub: (time: number) => void;
  // AI Director
  onGenerateAnimation: (prompt: string, loop: boolean) => Promise<void>;
  isGenerating: boolean;
  genError: string | null;
  // Skins
  skinPresets: SkinPreset[];
  onUploadSkinFile: (file: File) => void;
  onSelectSkinPreset: (preset: SkinPreset) => void;
  onFetchUsernameSkin: (username: string) => Promise<void>;
  isFetchingSkin: boolean;
  skinError: string | null;
  // World, Weather & Lighting
  builtInMaps: SchematicMapData[];
  activeMap: SchematicMapData;
  onSelectMap: (map: SchematicMapData) => void;
  onUploadSchematicFile: (file: File) => Promise<void>;
  isLoadingMap: boolean;
  mapError: string | null;
  mapOffsetY: number;
  onMapOffsetYChange: (y: number) => void;
  weatherPreset: WeatherPreset;
  onWeatherChange: (w: WeatherPreset) => void;
  lightingMood: LightingMood;
  onLightingMoodChange: (m: LightingMood) => void;
  // Camera & Export
  cameraPreset: CameraPreset;
  onSelectCameraPreset: (preset: CameraPreset) => void;
  onExportMiframes: (mode: 'selected' | 'all') => void;
}

const QUICK_PROMPTS_SOLO = [
  { label: 'Punch', prompt: 'Make this character throw an explosive boxing punch' },
  { label: 'Roundhouse Kick', prompt: 'Perform a martial arts high roundhouse kick' },
  { label: 'Backflip', prompt: 'Jump up and perform an acrobatic backflip landing' },
  { label: 'Pickaxe Mine', prompt: 'Swing a pickaxe downward repeatedly to mine stone' },
  { label: 'Victory Dance', prompt: 'Celebrate with an energetic victory dance' },
];

const QUICK_PROMPTS_MULTI = [
  { label: 'Punch & Stumble', prompt: 'First character punches the second character who stumbles backward in shock' },
  { label: 'Sword Duel', prompt: 'Two characters clash swords in an energetic sparring exchange' },
  { label: 'High Five', prompt: 'Both characters step forward, jump slightly, and give each other a high five' },
  { label: 'Victory Dance', prompt: 'All characters celebrate together with a synchronized victory dance' },
];

const BONE_ORDER: BoneId[] = [
  'rightArm',
  'rightElbow',
  'leftArm',
  'leftElbow',
  'torso',
  'spineBend',
  'head',
  'rightLeg',
  'rightKnee',
  'leftLeg',
  'leftKnee',
  'pelvis',
];

const ITEM_CATEGORIES: Array<'All' | ItemCategory> = [
  'All',
  'Weapons & Combat',
  'Tools',
  'Food & Potions',
  'Treasures & Materials',
  'Utility & Redstone',
  'Blocks',
];

export const StudioDock: React.FC<StudioDockProps> = ({
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  characters,
  selectedCharacterId,
  onSelectCharacter,
  onAddCharacter,
  onRemoveCharacter,
  onUpdateCharacter,
  onArrangeDuel,
  animation,
  savedAnimations,
  onSelectAnimation,
  onUpdateAnimation,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onSpeedChange,
  currentTime,
  onScrub,
  onGenerateAnimation,
  isGenerating,
  genError,
  skinPresets,
  onUploadSkinFile,
  onSelectSkinPreset,
  onFetchUsernameSkin,
  isFetchingSkin,
  skinError,
  builtInMaps,
  activeMap,
  onSelectMap,
  onUploadSchematicFile,
  isLoadingMap,
  mapError,
  mapOffsetY,
  onMapOffsetYChange,
  weatherPreset,
  onWeatherChange,
  lightingMood,
  onLightingMoodChange,
  cameraPreset,
  onSelectCameraPreset,
  onExportMiframes,
}) => {
  const [promptInput, setPromptInput] = useState(animation.prompt);
  const [loopMode, setLoopMode] = useState(animation.loop);
  const [usernameInput, setUsernameInput] = useState('');
  const [isDraggingSkin, setIsDraggingSkin] = useState(false);
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const [selectedBone, setSelectedBone] = useState<BoneId>('rightArm');
  const [selectedKfIndex, setSelectedKfIndex] = useState(0);

  // Item Picker State
  const [itemSlot, setItemSlot] = useState<'main' | 'offhand'>('main');
  const [itemSearch, setItemSearch] = useState('');
  const [itemCategory, setItemCategory] = useState<'All' | ItemCategory>('All');

  const skinFileRef = useRef<HTMLInputElement>(null);
  const mapFileRef = useRef<HTMLInputElement>(null);

  const selectedChar =
    characters.find((c) => c.id === selectedCharacterId) ?? characters[0];

  const activeTrack =
    animation.tracks[selectedChar?.id] ||
    animation.tracks['default'] ||
    Object.values(animation.tracks)[0];

  const keyframes = activeTrack?.keyframes ?? [];
  const safeKfIndex = Math.min(selectedKfIndex, Math.max(0, keyframes.length - 1));
  const activeKf: KeyframePose | undefined = keyframes[safeKfIndex];

  const quickPrompts = characters.length > 1 ? QUICK_PROMPTS_MULTI : QUICK_PROMPTS_SOLO;

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    return MINECRAFT_ITEMS.filter((item) => {
      if (itemCategory !== 'All' && item.category !== itemCategory) return false;
      if (q && !item.name.toLowerCase().includes(q) && !item.id.includes(q)) return false;
      return true;
    });
  }, [itemSearch, itemCategory]);

  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = promptInput.trim();
    if (!cleaned || isGenerating) return;
    await onGenerateAnimation(cleaned, loopMode);
  };

  const handleQuickPrompt = async (qPrompt: string) => {
    setPromptInput(qPrompt);
    if (!isGenerating) {
      await onGenerateAnimation(qPrompt, loopMode);
    }
  };

  const updateActiveTrackKeyframes = (nextKeyframes: KeyframePose[]) => {
    const trackKey = animation.tracks[selectedChar.id] ? selectedChar.id : activeTrack.characterId;
    const nextTracks = {
      ...animation.tracks,
      [trackKey]: {
        characterId: trackKey,
        characterName: selectedChar.name,
        keyframes: nextKeyframes,
      },
    };
    onUpdateAnimation({ ...animation, tracks: nextTracks });
  };

  const handleBoneAxisChange = (axisIdx: 0 | 1 | 2, deg: number) => {
    if (!activeKf || !activeTrack) return;
    const nextKeyframes = keyframes.map((kf, idx) => {
      if (idx !== safeKfIndex) return kf;
      const cur = kf.bones[selectedBone] ?? [0, 0, 0];
      const updated: [number, number, number] = [cur[0], cur[1], cur[2]];
      updated[axisIdx] = deg;
      return {
        ...kf,
        bones: {
          ...kf.bones,
          [selectedBone]: updated,
        },
      };
    });
    updateActiveTrackKeyframes(nextKeyframes);
  };

  const handleRootOffsetAxisChange = (axisIdx: 0 | 1 | 2, val: number) => {
    if (!activeKf || !activeTrack) return;
    const nextKeyframes = keyframes.map((kf, idx) => {
      if (idx !== safeKfIndex) return kf;
      const cur = kf.rootOffset ?? [0, 0, 0];
      const updated: [number, number, number] = [cur[0], cur[1], cur[2]];
      updated[axisIdx] = val;
      return { ...kf, rootOffset: updated };
    });
    updateActiveTrackKeyframes(nextKeyframes);
  };

  const handleDuplicateKeyframe = () => {
    if (!activeKf || !activeTrack) return;
    const nextTime = Math.min(animation.duration, Number((activeKf.time + 0.15).toFixed(2)));
    const cloneBones = { ...EMPTY_BONES };
    for (const k of BONE_ORDER) {
      cloneBones[k] = [...(activeKf.bones[k] ?? [0, 0, 0])] as [number, number, number];
    }
    const clone: KeyframePose = {
      ...activeKf,
      time: nextTime,
      label: `${activeKf.label || 'Pose'} Copy`,
      rootOffset: [...(activeKf.rootOffset ?? [0, 0, 0])] as [number, number, number],
      rootYawOffset: activeKf.rootYawOffset ?? 0,
      bones: cloneBones,
    };
    const nextKeyframes = [...keyframes, clone].sort((a, b) => a.time - b.time);
    updateActiveTrackKeyframes(nextKeyframes);
    const newIdx = nextKeyframes.indexOf(clone);
    if (newIdx >= 0) {
      setSelectedKfIndex(newIdx);
      onScrub(clone.time);
    }
  };

  const handleDeleteKeyframe = () => {
    if (keyframes.length <= 2 || !activeTrack) return;
    const nextKeyframes = keyframes.filter((_, idx) => idx !== safeKfIndex);
    updateActiveTrackKeyframes(nextKeyframes);
    const nextIdx = Math.max(0, safeKfIndex - 1);
    setSelectedKfIndex(nextIdx);
    onScrub(nextKeyframes[nextIdx].time);
  };

  const handleResetBone = () => {
    if (!activeKf || !activeTrack) return;
    const nextKeyframes = keyframes.map((kf, idx) =>
      idx === safeKfIndex
        ? { ...kf, bones: { ...kf.bones, [selectedBone]: [0, 0, 0] as [number, number, number] } }
        : kf,
    );
    updateActiveTrackKeyframes(nextKeyframes);
  };

  const equippedId =
    selectedChar && (itemSlot === 'main' ? selectedChar.heldProp : selectedChar.offhandItem);
  const equippedEnchanted =
    selectedChar &&
    (itemSlot === 'main' ? selectedChar.enchantedMainHand : selectedChar.enchantedOffhand);

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(1040px,95vw)] transition-transform duration-300 ease-out ${
        isCollapsed ? 'translate-y-[calc(100%-36px)]' : 'translate-y-0'
      }`}
    >
      {/* Collapse / Expand Tab */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-[#141922] border border-b-0 border-white/10 rounded-t-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Toggle Studio Controls (H)"
        >
          {isCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Show Mine-imator Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              <span>Hide Controls</span>
            </>
          )}
        </button>
      </div>

      {/* Main Dock Surface */}
      <div className="bg-[#12161D]/95 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
        {/* Top Playback & Scrubber Bar */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-white/8 bg-[#0E1218]">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onTogglePlay}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-colors cursor-pointer"
              aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => onUpdateAnimation({ ...animation, loop: !animation.loop })}
              className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors cursor-pointer ${
                animation.loop
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-white/10 bg-transparent text-zinc-400 hover:text-zinc-200'
              }`}
              title="Toggle Loop"
              aria-label="Toggle loop"
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>

            <select
              value={playbackSpeed}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
              className="h-8 px-2 rounded-lg bg-[#171C26] border border-white/10 text-xs font-mono-num text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              aria-label="Playback speed"
            >
              <option value={0.25}>0.25x</option>
              <option value={0.5}>0.5x</option>
              <option value={1}>1.0x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2.0x</option>
            </select>
          </div>

          <div className="relative flex-1 min-w-[180px] flex items-center h-8">
            <div className="relative w-full flex items-center">
              <input
                type="range"
                min={0}
                max={animation.duration}
                step={0.01}
                value={Math.min(currentTime, animation.duration)}
                onChange={(e) => onScrub(Number(e.target.value))}
                className="studio-slider w-full relative z-10"
                aria-label="Animation timeline scrubber"
              />
              <div className="absolute inset-x-1.5 top-1/2 -translate-y-1/2 pointer-events-none h-3">
                {keyframes.map((kf, idx) => {
                  const pct = (kf.time / Math.max(0.1, animation.duration)) * 100;
                  return (
                    <span
                      key={`${kf.time}-${idx}`}
                      style={{ left: `${pct}%` }}
                      className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rotate-45 ${
                        idx === safeKfIndex && activeTab === 'timeline'
                          ? 'bg-amber-400'
                          : 'bg-zinc-400/70'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 text-xs text-zinc-400">
            <span className="font-mono-num text-zinc-200">
              {currentTime.toFixed(2)}s <span className="text-zinc-500">/ {animation.duration.toFixed(2)}s</span>
            </span>
            <span className="hidden sm:inline text-zinc-600" aria-hidden="true">·</span>
            <span className="hidden sm:inline font-medium text-zinc-300 max-w-[150px] truncate">
              {animation.name}
            </span>
          </div>
        </div>

        {/* Tab Strip + Camera Quick Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-white/8 bg-[#12161D]">
          <div className="flex items-center gap-1 p-0.5 bg-[#0B0E13] rounded-lg border border-white/8 overflow-x-auto">
            {(
              [
                ['animate', 'Motion Studio'],
                ['cast', `Characters (${characters.length})`],
                ['items', `Items & VFX (${MINECRAFT_ITEMS.length})`],
                ['world', 'Schematics'],
                ['timeline', 'Timeline'],
              ] as [DockTab, string][]
            ).map(([tabId, label]) => (
              <button
                key={tabId}
                type="button"
                onClick={() => onTabChange(tabId)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === tabId ? 'bg-[#1D2430] text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Camera className="w-3.5 h-3.5 text-zinc-500 mr-0.5 hidden md:block" />
            {(
              [
                ['threeQuarter', '3/4'],
                ['front', 'Front'],
                ['side', 'Side'],
                ['lowAction', 'Low'],
                ['wideStage', 'Stage'],
              ] as [CameraPreset, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => onSelectCameraPreset(id)}
                className={`px-2 py-1 text-xs rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  cameraPreset === id
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Active Tab Content */}
        <div className="p-4 max-h-[330px] overflow-y-auto">
          {/* TAB 1: AI DIRECTOR */}
          {activeTab === 'animate' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>Active Cast:</span>
                  <span className="text-zinc-200 font-medium">
                    {characters.map((c) => c.name).join(' · ')}
                  </span>
                  <span className="text-zinc-600" aria-hidden="true">·</span>
                  <span>Map: {activeMap.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onTabChange('cast')}
                  className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Manage Cast</span>
                </button>
              </div>

              <form onSubmit={handlePromptSubmit} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder={
                      characters.length > 1
                        ? `Direct ${characters.map((c) => c.name).join(' & ')} (e.g. ${characters[0].name} punches ${characters[1].name}...)`
                        : 'Describe an action (e.g. Make this character punch, do a backflip, mine stone)...'
                    }
                    className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#0B0E13] border border-white/12 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setLoopMode(!loopMode)}
                    className={`h-10 px-3 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      loopMode
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-white/12 bg-[#0B0E13] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {loopMode ? 'Looping' : 'One-Shot'}
                  </button>
                  <button
                    type="submit"
                    disabled={isGenerating || !promptInput.trim()}
                    className="h-10 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-semibold text-sm flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isGenerating ? 'Building Keyframes...' : 'Generate Motion'}</span>
                  </button>
                </div>
              </form>

              {genError && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                  {genError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-zinc-500 mr-1">Try prompt:</span>
                  {quickPrompts.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      disabled={isGenerating}
                      onClick={() => handleQuickPrompt(item.prompt)}
                      className="px-2.5 py-1 rounded-md bg-[#191F2A] hover:bg-[#222A38] border border-white/8 text-xs text-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500">Clips:</span>
                  <select
                    value={animation.id}
                    onChange={(e) => {
                      const found = savedAnimations.find((a) => a.id === e.target.value);
                      if (found) {
                        onSelectAnimation(found);
                        setPromptInput(found.prompt);
                      }
                    }}
                    className="h-7 px-2 rounded-md bg-[#0B0E13] border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[190px]"
                    aria-label="Select animation clip"
                  >
                    {savedAnimations.map((clip) => (
                      <option key={clip.id} value={clip.id}>
                        {clip.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(animation.motionNotes || animation.sources.length > 0) && (
                <div className="pt-2 border-t border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-zinc-400">
                  <p className="leading-relaxed line-clamp-2">{animation.motionNotes}</p>
                  {animation.sources.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      <span className="text-zinc-500">References:</span>
                      {animation.sources.slice(0, 3).map((src) => (
                        <a
                          key={src.uri}
                          href={src.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline max-w-[150px] truncate"
                        >
                          <span className="truncate">{src.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MULTI-CHARACTER CAST & SKINS */}
          {activeTab === 'cast' && selectedChar && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/8">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {characters.map((char) => (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => onSelectCharacter(char.id)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        char.id === selectedChar.id
                          ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
                          : 'border-white/10 bg-[#0B0E13] text-zinc-300 hover:border-white/25'
                      }`}
                    >
                      <span>{char.name}</span>
                      {characters.length > 1 && char.id === selectedChar.id && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveCharacter(char.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation();
                              onRemoveCharacter(char.id);
                            }
                          }}
                          className="text-zinc-400 hover:text-red-400"
                          title="Remove character"
                        >
                          <Trash2 className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={onAddCharacter}
                    disabled={characters.length >= 6}
                    className="px-2.5 py-1.5 rounded-lg bg-[#191F2A] hover:bg-[#222A38] disabled:opacity-40 border border-white/10 text-xs font-medium text-emerald-300 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Character</span>
                  </button>
                </div>

                {characters.length >= 2 && (
                  <button
                    type="button"
                    onClick={onArrangeDuel}
                    className="px-2.5 py-1.5 rounded-lg bg-[#191F2A] hover:bg-[#222A38] border border-white/10 text-xs text-zinc-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Swords className="w-3.5 h-3.5 text-amber-400" />
                    <span>Face-to-Face Stance</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <div className="md:col-span-5 space-y-2.5">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingSkin(true);
                    }}
                    onDragLeave={() => setIsDraggingSkin(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingSkin(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) onUploadSkinFile(file);
                    }}
                    onClick={() => skinFileRef.current?.click()}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border border-dashed cursor-pointer transition-colors ${
                      isDraggingSkin
                        ? 'border-emerald-400 bg-emerald-500/10'
                        : 'border-white/15 bg-[#0B0E13] hover:border-white/30'
                    }`}
                  >
                    <input
                      ref={skinFileRef}
                      type="file"
                      accept="image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onUploadSkinFile(file);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                    <div className="w-9 h-9 rounded-md bg-[#181E28] border border-white/10 shrink-0 overflow-hidden">
                      <img
                        src={selectedChar.skinDataUrl}
                        alt={selectedChar.name}
                        className="w-full h-full object-cover"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-100">
                        <Upload className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Upload Skin for {selectedChar.name}</span>
                      </div>
                      <p className="text-xs text-zinc-400 truncate">PNG 64x64 or 64x32</p>
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (usernameInput.trim() && !isFetchingSkin) {
                        onFetchUsernameSkin(usernameInput.trim());
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <div className="relative flex-1">
                      <User className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder="Java username (e.g. Notch)"
                        className="w-full h-8 pl-8 pr-2.5 rounded-lg bg-[#0B0E13] border border-white/12 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isFetchingSkin || !usernameInput.trim()}
                      className="h-8 px-3 rounded-lg bg-[#1D2430] hover:bg-[#263040] disabled:opacity-50 text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isFetchingSkin ? 'Loading...' : 'Load Skin'}
                    </button>
                  </form>
                  {skinError && <p className="text-xs text-red-400">{skinError}</p>}

                  <div className="flex flex-wrap items-center gap-1.5">
                    {skinPresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => onSelectSkinPreset(preset)}
                        className={`px-2 py-1 rounded-md border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          selectedChar.skinId === preset.id
                            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                            : 'border-white/10 bg-[#0B0E13] text-zinc-300 hover:border-white/25'
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-7 space-y-2.5">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <span className="text-xs text-zinc-400">Actor Name</span>
                      <input
                        type="text"
                        value={selectedChar.name}
                        onChange={(e) =>
                          onUpdateCharacter(selectedChar.id, { name: e.target.value })
                        }
                        className="w-full h-8 px-2.5 rounded-lg bg-[#0B0E13] border border-white/10 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-zinc-400">Arm Model</span>
                      <select
                        value={selectedChar.modelType}
                        onChange={(e) =>
                          onUpdateCharacter(selectedChar.id, {
                            modelType: e.target.value as SkinModelType,
                          })
                        }
                        className="w-full h-8 px-2 rounded-lg bg-[#0B0E13] border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="classic">Classic (4px)</option>
                        <option value="slim">Slim (3px)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-zinc-400">2nd Skin Layer</span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateCharacter(selectedChar.id, {
                            showOverlayLayer: !selectedChar.showOverlayLayer,
                          })
                        }
                        className={`w-full h-8 px-2.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                          selectedChar.showOverlayLayer
                            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                            : 'border-white/10 bg-[#0B0E13] text-zinc-400'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>{selectedChar.showOverlayLayer ? 'On' : 'Off'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#0B0E13] p-2.5 rounded-lg border border-white/8">
                    {(
                      [
                        ['Pos X', 0, -10, 10, 0.25],
                        ['Pos Y', 1, -2, 10, 0.25],
                        ['Pos Z', 2, -10, 10, 0.25],
                      ] as const
                    ).map(([label, idx, min, max, step]) => (
                      <div key={label} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-400">{label}</span>
                          <span className="font-mono-num text-zinc-200">
                            {selectedChar.basePosition[idx].toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          step={step}
                          value={selectedChar.basePosition[idx]}
                          onChange={(e) => {
                            const nextPos: [number, number, number] = [
                              ...selectedChar.basePosition,
                            ];
                            nextPos[idx] = Number(e.target.value);
                            onUpdateCharacter(selectedChar.id, { basePosition: nextPos });
                          }}
                          className="studio-slider w-full"
                        />
                      </div>
                    ))}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-400">Facing</span>
                        <span className="font-mono-num text-zinc-200">
                          {Math.round(selectedChar.baseYaw)}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        step={5}
                        value={selectedChar.baseYaw}
                        onChange={(e) =>
                          onUpdateCharacter(selectedChar.id, { baseYaw: Number(e.target.value) })
                        }
                        className="studio-slider w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FULL MINECRAFT ITEMS & 3D VISUAL EFFECTS */}
          {activeTab === 'items' && selectedChar && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {/* Left 7 cols: Searchable 100+ Minecraft Item Grid */}
              <div className="md:col-span-7 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Hand Slot Selector + Enchanted Glint */}
                  <div className="flex items-center gap-1 p-0.5 bg-[#0B0E13] rounded-lg border border-white/10">
                    <button
                      type="button"
                      onClick={() => setItemSlot('main')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                        itemSlot === 'main' ? 'bg-[#1D2430] text-white' : 'text-zinc-400'
                      }`}
                    >
                      Right Hand
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemSlot('offhand')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                        itemSlot === 'offhand' ? 'bg-[#1D2430] text-white' : 'text-zinc-400'
                      }`}
                    >
                      Left Offhand
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateCharacter(
                          selectedChar.id,
                          itemSlot === 'main'
                            ? { enchantedMainHand: !selectedChar.enchantedMainHand }
                            : { enchantedOffhand: !selectedChar.enchantedOffhand },
                        )
                      }
                      className={`px-2.5 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
                        equippedEnchanted
                          ? 'border-purple-400/50 bg-purple-500/20 text-purple-200'
                          : 'border-white/10 bg-[#0B0E13] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Enchant Glint</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onUpdateCharacter(
                          selectedChar.id,
                          itemSlot === 'main' ? { heldProp: 'none' } : { offhandItem: 'none' },
                        )
                      }
                      className="px-2.5 py-1 rounded-md border border-white/10 bg-[#0B0E13] text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                    >
                      Clear Hand
                    </button>
                  </div>
                </div>

                {/* Search + Category Filter */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      placeholder="Search any Minecraft item (e.g. Netherite, Trident, Totem, Potion)..."
                      className="w-full h-8 pl-8 pr-2.5 rounded-lg bg-[#0B0E13] border border-white/12 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value as 'All' | ItemCategory)}
                    className="h-8 px-2.5 rounded-lg bg-[#0B0E13] border border-white/12 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {ITEM_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Item Icon Grid */}
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5 max-h-[168px] overflow-y-auto p-1.5 rounded-lg bg-[#0B0E13] border border-white/8">
                  {filteredItems.map((item) => {
                    const isEquipped = equippedId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        title={item.name}
                        onClick={() =>
                          onUpdateCharacter(
                            selectedChar.id,
                            itemSlot === 'main'
                              ? { heldProp: item.id }
                              : { offhandItem: item.id },
                          )
                        }
                        className={`group flex flex-col items-center justify-center p-1.5 rounded-md border transition-colors cursor-pointer ${
                          isEquipped
                            ? 'border-emerald-400 bg-emerald-500/20'
                            : 'border-white/5 bg-[#151A22] hover:border-white/25 hover:bg-[#1C232E]'
                        }`}
                      >
                        <img
                          src={item.iconUrl}
                          alt={item.name}
                          className="w-7 h-7 object-contain"
                          style={{ imageRendering: 'pixelated' }}
                        />
                        <span className="text-[10px] text-zinc-400 group-hover:text-zinc-200 truncate w-full text-center mt-0.5">
                          {item.name}
                        </span>
                      </button>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <div className="col-span-full py-6 text-center text-xs text-zinc-500">
                      No matching Minecraft items found.
                    </div>
                  )}
                </div>
              </div>

              {/* Right 5 cols: Equipped Summary + 3D Particle VFX, Weather & Lighting */}
              <div className="md:col-span-5 space-y-2.5 bg-[#0B0E13] p-3 rounded-lg border border-white/8">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-white/8">
                  <span className="text-zinc-400">
                    {selectedChar.name} Hands:
                  </span>
                  <span className="text-zinc-200 font-medium truncate max-w-[200px]">
                    {MINECRAFT_ITEM_MAP.get(selectedChar.heldProp)?.name || 'Empty'} /{' '}
                    {MINECRAFT_ITEM_MAP.get(selectedChar.offhandItem)?.name || 'Empty'}
                  </span>
                </div>

                {/* Actor VFX Aura */}
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>{selectedChar.name} Action &amp; Particle VFX</span>
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        ['combat', 'Combat Slash'],
                        ['enchant', 'Enchant Runes'],
                        ['fire', 'Fire Embers'],
                        ['ender', 'Ender Portal'],
                        ['speed', 'Dash Trail'],
                        ['none', 'VFX Off'],
                      ] as [VfxPreset, string][]
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() =>
                          onUpdateCharacter(selectedChar.id, { vfxPreset: id })
                        }
                        className={`px-2 py-1.5 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                          selectedChar.vfxPreset === id
                            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                            : 'border-white/8 bg-[#141922] text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stage Weather + Lighting Mood */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <span className="text-xs text-zinc-400">Stage Weather</span>
                    <select
                      value={weatherPreset}
                      onChange={(e) => onWeatherChange(e.target.value as WeatherPreset)}
                      className="w-full h-8 px-2 rounded-lg bg-[#141922] border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="clear">Clear Sky</option>
                      <option value="rain">Minecraft Rain</option>
                      <option value="snow">Snowfall</option>
                      <option value="cherry">Cherry Petals</option>
                      <option value="ash">Nether Embers</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-zinc-400">Lighting Mood</span>
                    <select
                      value={lightingMood}
                      onChange={(e) => onLightingMoodChange(e.target.value as LightingMood)}
                      className="w-full h-8 px-2 rounded-lg bg-[#141922] border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="studio">Studio Daylight</option>
                      <option value="sunset">Golden Sunset</option>
                      <option value="moonlight">Midnight Moon</option>
                      <option value="nether">Nether Crimson</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: WORLD & SCHEMATICS */}
          {activeTab === 'world' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              <div className="md:col-span-6 space-y-2.5">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingMap(true);
                  }}
                  onDragLeave={() => setIsDraggingMap(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingMap(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) onUploadSchematicFile(file);
                  }}
                  onClick={() => mapFileRef.current?.click()}
                  className={`flex items-center gap-3 p-3.5 rounded-lg border border-dashed cursor-pointer transition-colors ${
                    isDraggingMap
                      ? 'border-emerald-400 bg-emerald-500/10'
                      : 'border-white/15 bg-[#0B0E13] hover:border-white/30'
                  }`}
                >
                  <input
                    ref={mapFileRef}
                    type="file"
                    accept=".schematic,.schem,.nbt,.json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUploadSchematicFile(file);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <div className="w-10 h-10 rounded-lg bg-[#181E28] border border-white/10 flex items-center justify-center shrink-0">
                    <Box className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-zinc-100">
                      {isLoadingMap
                        ? 'Parsing Minecraft Schematic...'
                        : 'Upload Schematic Map (.schematic / .schem / .json)'}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">
                      Supports WorldEdit, MCEdit, and Sponge NBT schematics
                    </p>
                  </div>
                </div>
                {mapError && <p className="text-xs text-red-400">{mapError}</p>}

                <div className="flex items-center gap-3 text-xs text-zinc-400 bg-[#0B0E13] px-3 py-2 rounded-lg border border-white/8">
                  <span className="font-medium text-zinc-200 truncate">{activeMap.name}</span>
                  <span className="text-zinc-600" aria-hidden="true">·</span>
                  <span className="font-mono-num shrink-0">
                    {activeMap.width}×{activeMap.height}×{activeMap.length}
                  </span>
                  <span className="text-zinc-600" aria-hidden="true">·</span>
                  <span className="font-mono-num shrink-0">
                    {activeMap.blocks.length.toLocaleString()} blocks
                  </span>
                </div>
              </div>

              <div className="md:col-span-6 space-y-3">
                <div className="space-y-1.5">
                  <span className="text-xs text-zinc-400">Starter &amp; Built-In Maps</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {builtInMaps.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onSelectMap(m)}
                        className={`px-3 py-2 rounded-lg border text-left text-xs font-medium transition-colors cursor-pointer ${
                          activeMap.id === m.id
                            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                            : 'border-white/10 bg-[#0B0E13] text-zinc-300 hover:border-white/25'
                        }`}
                      >
                        <div className="truncate">{m.name}</div>
                        <div className="text-[11px] text-zinc-500 font-mono-num mt-0.5">
                          {m.width}×{m.length} blocks
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#0B0E13] p-2.5 rounded-lg border border-white/8 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Map Ground Elevation (Y Offset)</span>
                    <span className="font-mono-num text-zinc-200">{mapOffsetY.toFixed(1)} blocks</span>
                  </div>
                  <input
                    type="range"
                    min={-5}
                    max={5}
                    step={0.5}
                    value={mapOffsetY}
                    onChange={(e) => onMapOffsetYChange(Number(e.target.value))}
                    className="studio-slider w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MULTI-TRACK TIMELINE & BENDABLE RIG EDITOR */}
          {activeTab === 'timeline' && activeKf && (
            <div className="space-y-3">
              <div className="space-y-1.5 bg-[#0B0E13] p-2.5 rounded-lg border border-white/8">
                {characters.map((char) => {
                  const charTrack =
                    animation.tracks[char.id] ||
                    animation.tracks['default'] ||
                    Object.values(animation.tracks)[0];
                  const charKfs = charTrack?.keyframes ?? [];
                  const isRowSelected = char.id === selectedChar.id;

                  return (
                    <div
                      key={char.id}
                      onClick={() => onSelectCharacter(char.id)}
                      className={`flex items-center gap-3 px-2 py-1 rounded-md cursor-pointer transition-colors ${
                        isRowSelected ? 'bg-[#19202B]' : 'hover:bg-white/5'
                      }`}
                    >
                      <span
                        className={`w-24 text-xs font-medium truncate shrink-0 ${
                          isRowSelected ? 'text-emerald-300' : 'text-zinc-400'
                        }`}
                      >
                        {char.name}
                      </span>
                      <div className="relative flex-1 h-5 bg-[#0E131B] rounded border border-white/8">
                        <div
                          style={{
                            left: `${(Math.min(currentTime, animation.duration) / Math.max(0.1, animation.duration)) * 100}%`,
                          }}
                          className="absolute inset-y-0 w-0.5 bg-emerald-400/80 pointer-events-none"
                        />
                        {charKfs.map((kf, idx) => {
                          const leftPct = (kf.time / Math.max(0.1, animation.duration)) * 100;
                          const activeDiamond = isRowSelected && idx === safeKfIndex;
                          return (
                            <button
                              key={`${char.id}-${idx}-${kf.time}`}
                              type="button"
                              title={`${kf.time.toFixed(2)}s · ${kf.label || `Pose ${idx + 1}`}`}
                              style={{ left: `${leftPct}%` }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectCharacter(char.id);
                                setSelectedKfIndex(idx);
                                onScrub(kf.time);
                              }}
                              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 transition-transform cursor-pointer ${
                                activeDiamond
                                  ? 'bg-amber-400 scale-125'
                                  : 'bg-zinc-400 hover:bg-white'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-zinc-400">
                  Editing <strong className="text-zinc-200">{selectedChar.name}</strong> ·{' '}
                  <span className="font-mono-num text-amber-300">{activeKf.time.toFixed(2)}s</span>{' '}
                  ({activeKf.label || `Pose ${safeKfIndex + 1}`})
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onExportMiframes('selected')}
                    className="px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                    title="Download Mine-imator 2.0 compatible .miframes keyframe file (24 FPS)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .miframes</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDuplicateKeyframe}
                    className="px-2.5 py-1 rounded-md bg-[#191F2A] hover:bg-[#232B3B] border border-white/10 text-xs text-zinc-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Duplicate Keyframe</span>
                  </button>
                  <button
                    type="button"
                    disabled={keyframes.length <= 2}
                    onClick={handleDeleteKeyframe}
                    className="px-2.5 py-1 rounded-md bg-[#191F2A] hover:bg-red-500/20 disabled:opacity-40 border border-white/10 text-xs text-zinc-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                <div className="md:col-span-5 flex flex-wrap gap-1">
                  {BONE_ORDER.map((bId) => (
                    <button
                      key={bId}
                      type="button"
                      onClick={() => setSelectedBone(bId)}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        selectedBone === bId
                          ? 'bg-emerald-500 text-zinc-950 font-semibold'
                          : 'bg-[#0B0E13] text-zinc-400 hover:text-zinc-200 border border-white/8'
                      }`}
                    >
                      {BONE_LABELS[bId]}
                    </button>
                  ))}
                </div>

                <div className="md:col-span-7 space-y-2 bg-[#0B0E13] p-2.5 rounded-lg border border-white/8">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(['Pitch (X)', 'Yaw (Y)', 'Roll (Z)'] as const).map((axisLabel, axisIdx) => {
                      const val = activeKf.bones[selectedBone]?.[axisIdx] ?? 0;
                      return (
                        <div key={axisLabel} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-400">{axisLabel}</span>
                            <span className="font-mono-num text-zinc-200">{Math.round(val)}°</span>
                          </div>
                          <input
                            type="range"
                            min={-180}
                            max={180}
                            step={1}
                            value={val}
                            onChange={(e) =>
                              handleBoneAxisChange(axisIdx as 0 | 1 | 2, Number(e.target.value))
                            }
                            className="studio-slider w-full"
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1.5 border-t border-white/8">
                    {(['Move X', 'Lift Y', 'Move Z'] as const).map((lbl, axisIdx) => {
                      const val = activeKf.rootOffset?.[axisIdx] ?? 0;
                      return (
                        <div key={lbl} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-500">{lbl}</span>
                            <span className="font-mono-num text-zinc-300">{val.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={-2}
                            max={2}
                            step={0.02}
                            value={val}
                            onChange={(e) =>
                              handleRootOffsetAxisChange(axisIdx as 0 | 1 | 2, Number(e.target.value))
                            }
                            className="studio-slider w-full"
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleResetBone}
                      className="text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Zero {BONE_LABELS[selectedBone]}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
