import { initialCharacterProgress, type RunState } from './runEngine';

export type GameSettings = {
  showTutorial: boolean;
  reducedMotion: boolean;
  compactCards: boolean;
};

export const DEFAULT_SETTINGS: GameSettings = {
  showTutorial: true,
  reducedMotion: false,
  compactCards: false,
};

export function updateSettings(settings: GameSettings, updates: Partial<GameSettings>): GameSettings {
  return { ...settings, ...updates };
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

  return { ...run, characterProgress };
}
