import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadRunSnapshot, saveRunSnapshot, updateSettings } from './settings';
import { createInitialRunState } from './runEngine';
import { seedCharacter } from './seedData';

describe('settings', () => {
  it('updates display settings without mutating defaults', () => {
    const settings = updateSettings(DEFAULT_SETTINGS, { reducedMotion: true, showTutorial: false });

    expect(settings.reducedMotion).toBe(true);
    expect(settings.showTutorial).toBe(false);
    expect(DEFAULT_SETTINGS.reducedMotion).toBe(false);
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
});
