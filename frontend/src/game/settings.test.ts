import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, GALAXY_BACKGROUNDS, loadRunSnapshot, loadSettings, saveRunSnapshot, saveSettings, selectedGalaxyBackground, updateSettings } from './settings';
import { createInitialRunState } from './runEngine';
import { seedCharacter } from './seedData';

describe('settings', () => {
  it('updates display settings without mutating defaults', () => {
    const settings = updateSettings(DEFAULT_SETTINGS, { reducedMotion: true, showTutorial: false });

    expect(settings.reducedMotion).toBe(true);
    expect(settings.showTutorial).toBe(false);
    expect(DEFAULT_SETTINGS.reducedMotion).toBe(false);
  });

  it('persists visual settings and resolves the selected background', () => {
    const storage = createMemoryStorage();
    const settings = updateSettings(DEFAULT_SETTINGS, {
      galaxyBackgroundId: GALAXY_BACKGROUNDS[2].id,
      overlayIntensity: 'dark',
      animatedBackdrop: false,
      compactCards: true,
      showSourceHints: false,
    });

    saveSettings(settings, storage);

    const restored = loadSettings(storage);
    expect(restored.galaxyBackgroundId).toBe(GALAXY_BACKGROUNDS[2].id);
    expect(restored.overlayIntensity).toBe('dark');
    expect(restored.animatedBackdrop).toBe(false);
    expect(restored.compactCards).toBe(true);
    expect(restored.showSourceHints).toBe(false);
    expect(selectedGalaxyBackground(restored).id).toBe(GALAXY_BACKGROUNDS[2].id);
  });

  it('falls back to default settings when storage is invalid', () => {
    const storage = createMemoryStorage('{bad json');

    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it('serializes and restores a run snapshot', () => {
    const run = createInitialRunState(seedCharacter);

    const saved = saveRunSnapshot(run);
    const restored = loadRunSnapshot(saved);

    expect(restored?.party[0].id).toBe(seedCharacter.id);
    expect(restored?.summary[0]).toBe('Run started.');
    expect(restored?.characterProgress[seedCharacter.id]).toEqual({ level: 1, xp: 0, statBonuses: {}, pendingMajorUpgrade: false });
  });

  it('loads older snapshots without character progress', () => {
    const run = createInitialRunState(seedCharacter);
    const { characterProgress: _characterProgress, ...legacyRun } = run;

    const restored = loadRunSnapshot(JSON.stringify(legacyRun));

    expect(restored?.characterProgress[seedCharacter.id]).toEqual({ level: 1, xp: 0, statBonuses: {}, pendingMajorUpgrade: false });
  });

  it('loads older snapshots without an active character id', () => {
    const run = createInitialRunState(seedCharacter);
    const { activeCharacterId: _activeCharacterId, ...legacyRun } = run;

    const restored = loadRunSnapshot(JSON.stringify(legacyRun));

    expect(restored?.activeCharacterId).toBe(seedCharacter.id);
  });
});

function createMemoryStorage(initialValue?: string) {
  let value = initialValue ?? '';

  return {
    getItem: () => value || null,
    setItem: (_key: string, nextValue: string) => {
      value = nextValue;
    },
  };
}
