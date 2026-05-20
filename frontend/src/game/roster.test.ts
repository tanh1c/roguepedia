import { describe, expect, it } from 'vitest';
import { runtimeRoster } from './roster';
import { seedCharacter } from './seedData';

const validRarities = ['D', 'C', 'B', 'A', 'S'];

describe('runtime roster', () => {
  it('assigns a D to S rarity to every runtime character', () => {
    expect(seedCharacter.rarity).toBe('S');
    expect(runtimeRoster.length).toBeGreaterThan(0);
    expect(runtimeRoster.every((character) => validRarities.includes(character.rarity))).toBe(true);
  });
});
