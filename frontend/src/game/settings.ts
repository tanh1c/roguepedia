import { initialCharacterProgress, type RunState } from './runEngine';

export type OverlayIntensity = 'soft' | 'balanced' | 'dark';

export type GalaxyBackground = {
  id: string;
  name: string;
  mood: string;
  url: string;
  previewUrl: string;
};

export type GameSettings = {
  showTutorial: boolean;
  reducedMotion: boolean;
  compactCards: boolean;
  autoEndTurnOnEnergyEmpty: boolean;
  galaxyBackgroundId: string;
  overlayIntensity: OverlayIntensity;
  animatedBackdrop: boolean;
  showSourceHints: boolean;
};

export const GALAXY_BACKGROUNDS: GalaxyBackground[] = [
  {
    id: 'nebula-drift',
    name: 'Nebula Drift',
    mood: 'violet dust / deep archive',
    url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=2400&q=85',
    previewUrl: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=640&q=70',
  },
  {
    id: 'stellar-rift',
    name: 'Stellar Rift',
    mood: 'blue starfield / cold tactics',
    url: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=2400&q=85',
    previewUrl: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=640&q=70',
  },
  {
    id: 'cosmic-bloom',
    name: 'Cosmic Bloom',
    mood: 'rose nebula / mythic run',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=2400&q=85',
    previewUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=640&q=70',
  },
  {
    id: 'void-atlas',
    name: 'Void Atlas',
    mood: 'dark cosmos / high contrast',
    url: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=2400&q=85',
    previewUrl: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=640&q=70',
  },
  {
    id: 'aurora-gate',
    name: 'Aurora Gate',
    mood: 'green glow / living worlds',
    url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=2400&q=85',
    previewUrl: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=640&q=70',
  },
  {
    id: 'archive-night',
    name: 'Archive Night',
    mood: 'quiet stars / readable UI',
    url: 'https://images.unsplash.com/photo-1454789548928-9efd52dc4031?auto=format&fit=crop&w=2400&q=85',
    previewUrl: 'https://images.unsplash.com/photo-1454789548928-9efd52dc4031?auto=format&fit=crop&w=640&q=70',
  },
];

const SETTINGS_STORAGE_KEY = 'roguepedia.settings.v1';

export const DEFAULT_SETTINGS: GameSettings = {
  showTutorial: true,
  reducedMotion: false,
  compactCards: false,
  autoEndTurnOnEnergyEmpty: true,
  galaxyBackgroundId: GALAXY_BACKGROUNDS[0].id,
  overlayIntensity: 'balanced',
  animatedBackdrop: true,
  showSourceHints: true,
};

export function selectedGalaxyBackground(settings: GameSettings): GalaxyBackground {
  return GALAXY_BACKGROUNDS.find((background) => background.id === settings.galaxyBackgroundId) ?? GALAXY_BACKGROUNDS[0];
}

export function updateSettings(settings: GameSettings, updates: Partial<GameSettings>): GameSettings {
  return normalizeSettings({ ...settings, ...updates });
}

export function loadSettings(storage: Pick<Storage, 'getItem'> = localStorage): GameSettings {
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? normalizeSettings(JSON.parse(raw) as Partial<GameSettings>) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: GameSettings, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
}

function normalizeSettings(settings: Partial<GameSettings>): GameSettings {
  const backgroundId = settings.galaxyBackgroundId && GALAXY_BACKGROUNDS.some((background) => background.id === settings.galaxyBackgroundId)
    ? settings.galaxyBackgroundId
    : DEFAULT_SETTINGS.galaxyBackgroundId;
  const overlayIntensity: OverlayIntensity = settings.overlayIntensity === 'soft' || settings.overlayIntensity === 'dark' || settings.overlayIntensity === 'balanced'
    ? settings.overlayIntensity
    : DEFAULT_SETTINGS.overlayIntensity;

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    galaxyBackgroundId: backgroundId,
    overlayIntensity,
  };
}

export function saveRunSnapshot(run: RunState): string {
  return JSON.stringify(run);
}

export function loadRunSnapshot(snapshot: string): RunState | null {
  try {
    return normalizeRunSnapshot(JSON.parse(snapshot) as RunState);
  } catch {
    return null;
  }
}

function normalizeRunSnapshot(run: RunState): RunState {
  const characterProgress = { ...(run.characterProgress ?? {}) };

  for (const character of [...run.party, ...run.reserveRoster]) {
    characterProgress[character.id] = characterProgress[character.id] ?? initialCharacterProgress();
  }

  const activeCharacterId = run.party.some((character) => character.id === run.activeCharacterId)
    ? run.activeCharacterId
    : run.party[0]?.id ?? '';

  return { ...run, characterProgress, activeCharacterId };
}
